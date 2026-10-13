"""Validate public submissions before writing anything. / 所有题目先校验，全部成功才入库。"""
import base64
import binascii
import csv
import io
import json
import warnings
from ..config import PROJECT_ROOT
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_FILE = 5 * 1024 * 1024
MAX_RECORDS = 200
TYPE_NAMES = {'单选题':'single','多选题':'multiple','简答题':'short','计算题':'calculation','判断题':'truefalse','填空题':'fill'}
TYPES = set(TYPE_NAMES.values())
CHAPTER_IDS = {12, *(m['chapter'] for m in json.loads((PROJECT_ROOT / 'study-room/data/materials.json').read_text(encoding='utf-8')))}
FIELDS = {'题干':'stem','题型':'type','选项':'options','答案':'answer','解析':'explanation','章节':'chapter','署名':'editor'}


def normalize(record):
    if not isinstance(record, dict): raise ValueError('每道题必须是一个对象')
    row = {FIELDS.get(key, key): value for key, value in record.items()}
    for field, title, limit in [('stem','题干',12000),('answer','答案',8000),('explanation','解析',16000),('editor','署名',30)]:
        value = row.get(field, '')
        if not isinstance(value, str) or len(value) > limit: raise ValueError(f'{title}必须是文字，且不超过 {limit} 字')
        row[field] = value.strip()
    if not row['stem']: raise ValueError('请填写题干；纯图片题也请填写简短标题')
    kind = row.get('type', 'short')
    if not isinstance(kind, str): raise ValueError('题型格式错误')
    row['type'] = TYPE_NAMES.get(kind.strip(), kind.strip())
    if row['type'] not in TYPES: raise ValueError('题型需为单选题、多选题、简答题、计算题、判断题或填空题')
    options = row.get('options', [])
    if isinstance(options, str): options = options.split('|') if '|' in options else options.splitlines()
    if not isinstance(options, list) or len(options) > 12 or any(not isinstance(v,str) or len(v)>2000 for v in options): raise ValueError('选项最多 12 个，每项不超过 2000 字')
    row['options'] = [v.strip() for v in options if v.strip()]
    if row['type'] in ('single','multiple') and len(row['options']) < 2: raise ValueError('选择题至少填写两个选项')
    chapter = row.get('chapter', 12)
    if chapter in ('', None, '自建题目'): chapter = 12
    if isinstance(chapter,str) and chapter.strip().isdigit(): chapter=int(chapter.strip())
    if type(chapter) is not int or chapter not in CHAPTER_IDS: raise ValueError('请选择已有章节或资料，或填写“自建题目”')
    row['chapter'] = chapter
    row['editor'] = row['editor'] or '匿名同学'
    row['reviewed'] = row.get('reviewed') is True
    images = row.get('images', [])
    if not isinstance(images, list) or len(images)>4: raise ValueError('每道题最多上传 4 张图片')
    row['images'] = images
    return {key: row[key] for key in ('stem','type','options','answer','explanation','chapter','editor','reviewed','images')}


def decode_image(value):
    if not isinstance(value, str) or not value.startswith(('data:image/png;base64,','data:image/jpeg;base64,','data:image/webp;base64,')):
        raise ValueError('图片仅支持 PNG、JPG 和 WebP')
    try:
        encoded = value.split(',',1)[1]
        if len(encoded) > (MAX_FILE + 2)//3*4: raise ValueError('每张图片不能超过 5 MB')
        raw = base64.b64decode(encoded, validate=True)
        if len(raw)>MAX_FILE: raise ValueError('每张图片不能超过 5 MB')
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ('PNG','JPEG','WEBP'): raise ValueError('不支持此图片格式')
                if image.width * image.height > 20000000: raise ValueError('图片像素过大，请缩小到 2000 万像素以内')
                image.load()
                image = ImageOps.exif_transpose(image)
                image.thumbnail((3200,3200))
                clean = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
                clean.info.clear()
                output=io.BytesIO()
                clean.save(output,format='PNG')
        data=output.getvalue()
        if len(data)>8*1024*1024: raise ValueError('图片处理后过大，请缩小尺寸后重试')
        return data
    except (binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError('图片损坏或格式不正确，请重新选择') from error


def prepare(records):
    if not isinstance(records,list) or not 1 <= len(records) <= MAX_RECORDS: raise ValueError('一次请提交 1–200 道题目')
    result=[]
    image_bytes=0
    for i,record in enumerate(records,1):
        try:
            row=normalize(record)
            decoded=[]
            for value in row['images']:
                content=decode_image(value)
                image_bytes += len(content)
                if image_bytes > 32*1024*1024: raise ValueError('本批题图处理后超过 32 MB，请分批上传')
                decoded.append(content)
            row['images']=decoded
            result.append(row)
        except ValueError as error: raise ValueError(f'第 {i} 道题：{error}') from error
    return result


def preview(data, filename):
    try:
        text=data.decode('utf-8-sig')
    except UnicodeError as error: raise ValueError('文件编码不是 UTF-8，请另存为 CSV UTF-8 或 JSON') from error
    try:
        if filename.lower().endswith('.csv'):
            reader=csv.DictReader(io.StringIO(text,newline=''),strict=True)
            headers=reader.fieldnames or []
            if not any(key in headers for key in ('题干','stem')): raise ValueError('CSV 缺少“题干”列，请使用模板')
            if len(set(headers)) != len(headers): raise ValueError('CSV 有重复列名')
            records=[]
            for row in reader:
                if None in row or any(v is None for v in row.values()): raise ValueError('CSV 列数不一致，请检查引号和分隔符')
                if any(value.strip() for value in row.values()): records.append(row)
                if len(records)>MAX_RECORDS: raise ValueError('一次最多导入 200 道题')
        elif filename.lower().endswith('.json'):
            records=json.loads(text)
            if isinstance(records,dict): records=records.get('questions')
        else: raise ValueError('请选择 CSV 或 JSON 文件')
    except (json.JSONDecodeError,csv.Error) as error: raise ValueError('文件格式错误，请对照模板检查') from error
    if not isinstance(records,list) or not 1 <= len(records) <= MAX_RECORDS: raise ValueError('文件应包含 1–200 道题')
    result=[]; errors=[]
    for i, record in enumerate(records,1):
        try:
            row=normalize(record)
            if row['images']: raise ValueError('批量模板用于文字题目；图片请在“手动录入”中上传')
            result.append(row)
        except ValueError as error: errors.append(f'第 {i} 道题：{error}')
    return {'questions':result if not errors else [],'errors':errors,'total':len(records)}
