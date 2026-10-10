"""Anonymous question editing with revision checks. / 免登录编辑，保留并发校验。"""
import json
import re
from hashlib import sha256
import logging
import sqlite3
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from . import store, importing
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
    try:
        rows = store.history(question_id)
        return result({'history': rows}) if rows is not None else result({'error': '题目不存在'}, 404)
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
    try:
        if store.base_question(question_id) is None: return result({'error': '题目不存在'}, 404)
    except (sqlite3.Error, OSError): return unavailable()
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


async def limited_body(request, maximum):
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > maximum: raise OverflowError
        data.extend(chunk)
    return data


def same_origin(request):
    return not request.headers.get('origin') or request.headers['origin'] == str(request.base_url).rstrip('/')


@router.post('/questions')
async def create(request: Request):
    if not same_origin(request): return result({'error':'请从本站提交题目'},403)
    if request.headers.get('content-type','').split(';')[0].strip().lower() != 'application/json': return result({'error':'请使用 JSON 提交'},415)
    try:
        raw=await limited_body(request,32*1024*1024)
        body=json.loads(raw)
        if not isinstance(body,dict): raise ValueError('提交格式错误')
        request_id=body.get('requestId')
        if not isinstance(request_id,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{12,80}',request_id): raise ValueError('缺少有效的提交编号，请重新打开上传窗口')
        records=await run_in_threadpool(importing.prepare,body.get('questions'))
        fingerprint=sha256(json.dumps(body['questions'],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        created=await run_in_threadpool(store.create,records,request_id,fingerprint)
        return result({'questions':created},201)
    except OverflowError: return result({'error':'提交过大，请分批上传；一次最多 32 MB'},413)
    except (ValueError,UnicodeError) as error: return result({'error':str(error) if not isinstance(error,json.JSONDecodeError) else 'JSON 格式错误'},400)
    except (sqlite3.Error,OSError): return unavailable()


@router.post('/import/preview')
async def preview(request: Request, filename: str = ''):
    if not same_origin(request): return result({'error':'请从本站上传文件'},403)
    try:
        data=await limited_body(request,2*1024*1024)
        return result(await run_in_threadpool(importing.preview,data,filename))
    except OverflowError: return result({'error':'导入文件不能超过 2 MB，请分批导入'},413)
    except ValueError as error: return result({'error':str(error)},400)


@router.get('/images/{image_id}')
def image(image_id: str):
    if not re.fullmatch(r'[a-f0-9]{32}',image_id): return result({'error':'图片不存在'},404)
    try:
        content=store.image(image_id)
        if content is None: return result({'error':'图片不存在'},404)
        return Response(content,media_type='image/png',headers={'X-Content-Type-Options':'nosniff'})
    except (sqlite3.Error,OSError): return unavailable()
