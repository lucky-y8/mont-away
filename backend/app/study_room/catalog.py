"""Small query indexes and bounded question batches. / 目录查询与按需取题。"""
import json
from collections import Counter
from functools import lru_cache
from hashlib import sha256
from . import store
from ..config import PROJECT_ROOT

PAGE_SIZE = 20

@lru_cache
def resources():
    folder = PROJECT_ROOT / 'study-room/data'
    names = ['questions.json', 'focus-priorities.json', 'predictions.json', 'prediction-learning.json']
    raw = [(folder / name).read_bytes() for name in names]
    return (sha256(b''.join(raw)).hexdigest()[:20], json.loads(raw[1]), json.loads(raw[2]))

@lru_cache
def lessons():
    data = json.loads((PROJECT_ROOT / 'study-room/data/prediction-learning.json').read_bytes())
    return {item['id']: item for item in data['items']}

def fingerprint(q):
    text = json.dumps([q['type'], q['stem'], q['options']], ensure_ascii=False, separators=(',', ':'))
    data = text.encode('utf-16-le', errors='surrogatepass')
    value = 2166136261
    for i in range(0, len(data), 2):
        value = ((value ^ (data[i] | data[i+1] << 8)) * 16777619) & 0xffffffff
    return f'{value:08x}'

def clock(db):
    row = db.execute('SELECT epoch, sequence FROM study_sync_clock WHERE singleton=1').fetchone()
    return f'{resources()[0]}.{row["epoch"]}.{row["sequence"]}'

def changes(cursor):
    with store.database() as db:
        db.execute('BEGIN')
        version = clock(db)
        prefix, end = version.rsplit('.', 1)
        try:
            previous, seq = cursor.rsplit('.', 1)
            seq = int(seq)
            valid = previous == prefix and 0 <= seq <= int(end)
        except (AttributeError, ValueError): valid = False
        if not valid:
            return {'cursor': version, 'reset': True, 'changed': [], 'hasMore': False}
        if cursor == version: return None
        rows = db.execute('SELECT question_id, sequence FROM study_changes WHERE sequence>? ORDER BY sequence LIMIT 101', (seq,)).fetchall()
        more = len(rows) > 100
        rows = rows[:100]
        next_seq = rows[-1]['sequence'] if more else int(end)
        return {'cursor': f'{prefix}.{next_seq}', 'reset': False,
                'changed': [row['question_id'] for row in rows], 'hasMore': more}

def rows_in(db):
    bases = dict(store.originals())
    bases.update({r['question_id']: json.loads(r['content']) for r in db.execute('SELECT * FROM question_uploads ORDER BY created_at, rowid')})
    for r in db.execute('SELECT * FROM question_edits'):
        if r['question_id'] in bases: bases[r['question_id']] = store.merge(r, bases[r['question_id']])
    return list(bases.values())

def query(filters):
    with store.database() as db:
        db.execute('BEGIN')
        version = clock(db)
        rows = rows_in(db)
    _, focus, prediction = resources()
    topics = {t['id']: t for t in focus['topics']}
    prediction_by_id = {e['id']: e for e in prediction['items']}
    assessments, available = {}, {}
    for q in rows:
        fp = fingerprint(q)
        entry = focus['questions'].get(q['id'])
        matched = [topics[t] for t in entry['topics'] if t in topics] if not q.get('origin') and entry and fp == entry['fingerprint'] else []
        matched.sort(key=lambda t: (-t['stars'], -len(t['examTerms'])))
        assessments[q['id']] = (max([t['stars'] for t in matched], default=0), [t['id'] for t in matched], len(matched[0]['examTerms']) if matched else 0)
        p = prediction_by_id.get(q['id'])
        if not q.get('origin') and p and fp == p['fingerprint']: available[q['id']] = q
    extended = [available[e['id']] for e in prediction['items'] if e['id'] in available]
    core = [available[id] for id in prediction['paperIds'] if id in available]
    mastered = set(filters.get('mastered', []))
    summary = {'total': len(rows), 'mastered': sum(q['id'] in mastered for q in rows), 'uploads': sum(q.get('origin') == 'upload' for q in rows),
               'chapters': dict(Counter(q['chapter'] for q in rows)),
               'sourceCounts': dict(Counter(q['chapter'] for q in rows if not q.get('origin'))),
               'topics': dict(Counter(t for a in assessments.values() for t in a[1])),
               'prediction': {'paper': [{'id': q['id'], 'type': q['type']} for q in core],
                              'extended': [{'id': q['id'], 'type': q['type']} for q in extended]}}
    pool = core if filters.get('prediction') == 'paper' else extended if filters.get('prediction') == 'extended' else rows
    chosen_ids = set(filters.get('ids', []))
    term = filters.get('query', '').strip().lower()
    def matches(q):
        if filters.get('type', 'all') != 'all' and q['type'] != filters['type']: return False
        if not filters.get('prediction'):
            if filters.get('chapter') is not None and q['chapter'] != filters['chapter']: return False
            scope = filters.get('scope', 'all')
            if scope == 'uploads' and q.get('origin') != 'upload': return False
            if scope in ('favorites', 'wrong') and q['id'] not in chosen_ids: return False
            stars, matched, _ = assessments[q['id']]
            if filters.get('focusTopic') and filters['focusTopic'] not in matched: return False
            level = filters.get('focusLevel', 'all')
            if level == 'unrated' and stars != 0: return False
            if level not in ('all', 'unrated'):
                if level.endswith('+') and stars < int(level[:-1]): return False
                if not level.endswith('+') and stars != int(level): return False
        return not term or term in f"{q['stem']} {' '.join(q['options'])} {' '.join(q['tags'])} {q['id']}".lower()
    selected = [q for q in pool if matches(q)]
    if not filters.get('prediction') and filters.get('focusSort') == 'priority':
        selected.sort(key=lambda q: (-assessments[q['id']][0], -assessments[q['id']][2]))
    # No stems, answers or explanations in the index response. / 索引不包含题干答案。
    return {'version': version, 'ids': [q['id'] for q in selected], 'summary': summary}

def batch(ids):
    with store.database() as db:
        db.execute('BEGIN')
        version = clock(db)
        questions, missing = [], []
        for id in ids:
            base = store.base_question(id, db)
            if base is None:
                missing.append(id)
                continue
            edit = db.execute('SELECT * FROM question_edits WHERE question_id=?', (id,)).fetchone()
            q = store.merge(edit, base) if edit else dict(base)
            if id in lessons(): q['learning'] = lessons()[id]
            questions.append(q)
    return {'version': version, 'questions': questions, 'missing': missing}

def validate_ids(ids, maximum=PAGE_SIZE):
    return isinstance(ids, list) and len(ids) <= maximum and all(isinstance(id, str) and 0 < len(id) <= 120 for id in ids) and len(ids) == len(set(ids))

def validate_filters(body):
    if not isinstance(body, dict): return False
    if body.get('chapter') is not None and (type(body['chapter']) is not int or not 0 <= body['chapter'] <= 1000): return False
    choices = {'scope': ['all','uploads','favorites','wrong'], 'type': ['all','single','multiple','truefalse','fill','short','calculation'],
               'focusLevel': ['all','5','4+','3+','2','1','unrated'], 'focusSort': ['original','priority'], 'prediction': [None,'paper','extended']}
    for key, options in choices.items():
        if key in body and body[key] not in options: return False
    return all(isinstance(body.get(k,''),str) and len(body.get(k,'')) <= limit for k,limit in [('query',1000),('focusTopic',100)]) and all(validate_ids(body.get(k,[]),5000) for k in ('ids','mastered'))
