"""Isolated test database setup. / 隔离的测试数据库配置。"""

import os
import atexit
import shutil
import tempfile

media_test_dir = tempfile.mkdtemp(prefix="shanyao-media-tests-")
atexit.register(shutil.rmtree, media_test_dir, True)
os.environ["SHANYAO_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SHANYAO_ENVIRONMENT"] = "local"
os.environ["SHANYAO_ALLOWED_HOSTS"] = "testserver,127.0.0.1,localhost"
os.environ["SHANYAO_EXPOSE_DEBUG_TOKENS"] = "true"
os.environ["SHANYAO_EMAIL_BACKEND"] = "console"
os.environ["SHANYAO_EMAIL_DRY_RUN"] = "true"
os.environ["SHANYAO_INITIAL_ADMIN_EMAIL"] = "admin@example.com"
os.environ["SHANYAO_MEDIA_LOCAL_DIR"] = media_test_dir
os.environ["SHANYAO_MEDIA_PUBLIC_URL"] = "http://testserver/media"
