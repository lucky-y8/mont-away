"""Stable API errors with localized presentation. / 稳定错误码与本地化展示。"""

from fastapi import HTTPException


class APIError(HTTPException):
    def __init__(self, status_code: int, code: str, context: dict | None = None):
        self.code = code
        self.context = context or {}
        super().__init__(status_code=status_code, detail=code)
