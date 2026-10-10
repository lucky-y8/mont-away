"""Separate SQLite database; never writes travel tables. / 独立数据库，不写山遥业务表。"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from ..config import PROJECT_ROOT, settings

@lru_cache
def originals():
    rows = json.loads((PROJECT_ROOT / 'study-room/data/questions.json').read_text(encoding='utf-8-sig'))
    return {q['id']: {**q, 'sourceUrl': '/study-assets' + q['sourceUrl'],
                     'figures': ['/study-assets' + p for p in q['figures']], 'revision': 0} for q in rows}

@contextmanager
def database():
    path = Path(settings.study_database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15, isolation_level=None)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE IF NOT EXISTS question_edits (question_id TEXT PRIMARY KEY, content TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, edited_at TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS question_history (question_id TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, edited_at TEXT NOT NULL, PRIMARY KEY(question_id, revision))')
        yield db
    finally:
        db.close()

def merge(row):
    return {**originals()[row['question_id']], **json.loads(row['content']), 'revision': row['revision'],
            'editor': row['editor'], 'editedAt': row['edited_at']}

def questions():
    with database() as db:
        updates = {r['question_id']: merge(r) for r in db.execute('SELECT * FROM question_edits') if r['question_id'] in originals()}
    return [updates.get(key, q) for key, q in originals().items()]

def history(question_id):
    with database() as db:
        rows = db.execute('SELECT * FROM question_history WHERE question_id=? ORDER BY revision DESC', (question_id,)).fetchall()
    return [dict(revision=r['revision'], editor=r['editor'], editedAt=r['edited_at'], question=merge(r)) for r in rows] + [
        dict(revision=0, editor='初始题库', editedAt='', question=originals()[question_id])]

def save(question_id, body):
    # Lock, compare, save, and append history in one transaction. / 比对版本与保存历史在同一事务中完成。
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        try:
            row = db.execute('SELECT * FROM question_edits WHERE question_id=?', (question_id,)).fetchone()
            current = merge(row) if row else originals()[question_id]
            if current['revision'] != body['revision']:
                db.rollback()
                return False, current
            content = {key: body[key].strip() for key in ('stem', 'answer', 'explanation')}
            content.update(type=body['type'], options=[v.strip() for v in body['options'] if v.strip()], needsReview=body.get('reviewed') is not True)
            for field in ('answer', 'explanation'):
                content[field + 'Source'] = current[field + 'Source'] if content[field] == current[field] else 'community' if content[field] else 'missing'
            revision = current['revision'] + 1
            editor = body.get('editor', '').strip() or '匿名同学'
            timestamp = datetime.now(timezone.utc).isoformat()
            values = (question_id, json.dumps(content, ensure_ascii=False), revision, editor, timestamp)
            db.execute('INSERT INTO question_edits VALUES(?,?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET content=excluded.content, revision=excluded.revision, editor=excluded.editor, edited_at=excluded.edited_at', values)
            db.execute('INSERT INTO question_history VALUES(?,?,?,?,?)', values)
            db.commit()
            return True, {**originals()[question_id], **content, 'revision': revision, 'editor': editor, 'editedAt': timestamp}
        except BaseException:
            db.rollback()
            raise
