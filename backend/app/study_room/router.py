"""Anonymous question editing with revision checks. / 免登录编辑，保留并发校验。"""
import json
import logging
import sqlite3
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from . import store
router = APIRouter(prefix='/api/study', tags=['study'])
logger = logging.getLogger(__name__)

def result(data, status=200):
    return JSONResponse(data, status_code=status, headers={'Cache-Control': 'no-store'})

def unavailable():
    logger.exception('Study database operation failed')
    return result({'error': '共享题库暂时无法连接，请稍后重试。'}, 503)

@router.get('/questions')
def questions():
    try: return result({'questions': store.questions()})
    except (sqlite3.Error, OSError): return unavailable()

@router.get('/questions/{question_id}')
def history(question_id: str):
    if question_id not in store.originals(): return result({'error': '题目不存在'}, 404)
    try: return result({'history': store.history(question_id)})
    except (sqlite3.Error, OSError): return unavailable()

def valid(body):
    if not isinstance(body, dict): return False
    if type(body.get('revision')) is not int or not 0 <= body['revision'] <= 9007199254740991: return False
    for key, limit in [('stem', 12000), ('answer', 8000), ('explanation', 16000)]:
        if not isinstance(body.get(key), str) or len(body[key]) > limit: return False
    if not body['stem'].strip() or body.get('type') not in ('single', 'multiple', 'short', 'calculation', 'truefalse'): return False
    options = body.get('options')
    if not isinstance(options, list) or len(options) > 12 or any(not isinstance(v, str) or len(v) > 2000 for v in options): return False
    if body['type'] in ('single', 'multiple') and len([v for v in options if v.strip()]) < 2: return False
    return isinstance(body.get('editor', ''), str) and len(body.get('editor', '')) <= 30

@router.put('/questions/{question_id}')
async def save(question_id: str, request: Request):
    if question_id not in store.originals(): return result({'error': '题目不存在'}, 404)
    # Reverse proxies must preserve Host and forward the scheme from trusted IPs. / 代理保留 Host，协议仅信任受信代理。
    if request.headers.get('origin') and request.headers['origin'] != str(request.base_url).rstrip('/'):
        return result({'error': '请从本站提交修改'}, 403)
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
        return result({'error': '请使用 JSON 提交'}, 415)
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 160000: return result({'error': '内容过长，请精简后提交'}, 413)
    try:
        text = raw.decode('utf-8')
        if len(text) > 40000: return result({'error': '内容过长，请精简后提交'}, 413)
        body = json.loads(text)
    except (ValueError, UnicodeError): return result({'error': '内容格式错误'}, 400)
    if not valid(body): return result({'error': '请检查题干、选项和答案的填写格式及长度'}, 400)
    try: saved, question = await run_in_threadpool(store.save, question_id, body)
    except (sqlite3.Error, OSError): return unavailable()
    if not saved: return result({'error': '这道题刚被其他同学修改。你的草稿已保留，请载入最新版本后合并。', 'current': question}, 409)
    return result({'question': question})
