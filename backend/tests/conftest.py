"""Isolated test database setup. / 隔离的测试数据库配置。"""

import os
import atexit
import shutil
import tempfile

media_test_dir = tempfile.mkdtemp(prefix="shanyao-media-tests-")
atexit.register(shutil.rmtree, media_test_dir, True)
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["EXPOSE_DEBUG_TOKENS"] = "true"
os.environ["INITIAL_ADMIN_EMAIL"] = "admin@example.com"
os.environ["MEDIA_LOCAL_DIR"] = media_test_dir
os.environ["MEDIA_PUBLIC_URL"] = "http://testserver/media"
