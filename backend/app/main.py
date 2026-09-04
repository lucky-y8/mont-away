from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import create_tables
from .i18n import MESSAGES, resolve_locale, translate
from .routers import account, admin, auth, health, posts


@asynccontextmanager
async def lifespan(_: FastAPI):
    await create_tables()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(health.router)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(posts.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(account.router, prefix=settings.api_prefix)


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Return stable codes plus localized text. / 返回稳定错误码和本地化文本。"""
    locale = resolve_locale(request.headers.get("accept-language"))
    known_codes = MESSAGES["zh-CN"]
    code = str(exc.detail) if isinstance(exc.detail, str) and exc.detail in known_codes else ("not_found" if exc.status_code == 404 else "internal_error")
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": code, "message": translate(locale, code)}}, headers={**(exc.headers or {}), "Content-Language": locale})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    locale = resolve_locale(request.headers.get("accept-language"))
    fields = [{"path": ".".join(str(x) for x in item["loc"]), "type": item["type"]} for item in exc.errors()]
    return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": translate(locale, "validation_error"), "fields": fields}}, headers={"Content-Language": locale})
