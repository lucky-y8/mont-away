"""Separate SQLite database; never writes travel tables. / 独立数据库，不写山遥业务表。"""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from threading import Lock
from ..config import PROJECT_ROOT, settings

_initialization_lock = Lock()

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
        # Serialize first-use WAL/schema setup, not queries. / 仅串行初始化，避免首次并发请求争抢数据库锁。
        with _initialization_lock:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS question_edits (question_id TEXT PRIMARY KEY, content TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, edited_at TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS question_history (question_id TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, edited_at TEXT NOT NULL, PRIMARY KEY(question_id, revision))')
            db.execute('CREATE TABLE IF NOT EXISTS question_uploads (question_id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS question_images (image_id TEXT PRIMARY KEY, content BLOB NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS question_submissions (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, question_ids TEXT NOT NULL)')
        yield db
    finally:
        db.close()

def base_question(question_id, db=None):
    if question_id in originals(): return originals()[question_id]
    if db is None:
        with database() as conn: return base_question(question_id, conn)
    row = db.execute('SELECT content FROM question_uploads WHERE question_id=?', (question_id,)).fetchone()
    return json.loads(row['content']) if row else None


def merge(row, base):
    return {**base, **json.loads(row['content']), 'revision': row['revision'],
            'editor': row['editor'], 'editedAt': row['edited_at']}


def questions():
    with database() as db:
        bases = dict(originals())
        bases.update({r['question_id']: json.loads(r['content']) for r in db.execute('SELECT * FROM question_uploads ORDER BY created_at, rowid')})
        updates = {r['question_id']: merge(r, bases[r['question_id']]) for r in db.execute('SELECT * FROM question_edits') if r['question_id'] in bases}
    return [updates.get(key, q) for key, q in bases.items()]


def history(question_id):
    with database() as db:
        base = base_question(question_id, db)
        if base is None: return None
        rows = db.execute('SELECT * FROM question_history WHERE question_id=? ORDER BY revision DESC', (question_id,)).fetchall()
    return [dict(revision=r['revision'], editor=r['editor'], editedAt=r['edited_at'], question=merge(r, base)) for r in rows] + [
        dict(revision=0, editor=base.get('editor', '初始题库'), editedAt=base.get('editedAt', ''), question=base)]


def image(image_id):
    with database() as db:
        row = db.execute('SELECT content FROM question_images WHERE image_id=?', (image_id,)).fetchone()
        return row['content'] if row else None


def create(records, request_id, fingerprint):
    # One transaction includes images and the idempotency key. / 题目、图片与防重复标记原子提交。
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        try:
            previous = db.execute('SELECT * FROM question_submissions WHERE request_id=?', (request_id,)).fetchone()
            if previous:
                db.rollback()
                if previous['fingerprint'] != fingerprint: raise ValueError('提交编号已被使用，请重新打开上传窗口后再试。')
                saved = []
                for key in json.loads(previous['question_ids']):
                    base = base_question(key, db)
                    edit = db.execute('SELECT * FROM question_edits WHERE question_id=?', (key,)).fetchone()
                    saved.append(merge(edit, base) if edit else base)
                return saved
            timestamp = datetime.now(timezone.utc).isoformat()
            created = []
            for record in records:
                figures = []
                for content in record['images']:
                    image_id = uuid.uuid4().hex
                    db.execute('INSERT INTO question_images VALUES (?,?)', (image_id, content))
                    figures.append('/api/study/images/' + image_id)
                question_id = 'custom-' + uuid.uuid4().hex
                chapter = record['chapter']
                title = next((q['chapterTitle'] for q in originals().values() if q['chapter'] == chapter), '自建题目')
                q = {key: record[key] for key in ('stem','type','options','answer','explanation','editor')}
                q.update(id=question_id, chapter=chapter, chapterTitle=title, origin='upload', revision=0,
                         answerSource='community' if record['answer'] else 'missing',
                         explanationSource='community' if record['explanation'] else 'missing',
                         sourceFile='同学上传', sourceUrl=figures[0] if figures else '', pages=[], figures=figures,
                         tags=['同学上传'], needsReview=not record['reviewed'], editedAt=timestamp)
                db.execute('INSERT INTO question_uploads VALUES (?,?,?)', (question_id, json.dumps(q, ensure_ascii=False), timestamp))
                created.append(q)
            db.execute('INSERT INTO question_submissions VALUES (?,?,?)', (request_id, fingerprint, json.dumps([q['id'] for q in created])))
            db.commit()
            return created
        except BaseException:
            db.rollback()
            raise


def save(question_id, body):
    # Lock, compare, save, and append history in one transaction. / 比对版本与保存历史在同一事务中完成。
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        try:
            row = db.execute('SELECT * FROM question_edits WHERE question_id=?', (question_id,)).fetchone()
            base = base_question(question_id, db)
            if base is None: raise KeyError(question_id)
            current = merge(row, base) if row else base
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
            return True, {**base, **content, 'revision': revision, 'editor': editor, 'editedAt': timestamp}
        except BaseException:
            db.rollback()
            raise
