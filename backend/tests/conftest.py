"""Isolated test database setup. / 隔离的测试数据库配置。"""

import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["EXPOSE_DEBUG_TOKENS"] = "true"
os.environ["INITIAL_ADMIN_EMAIL"] = "admin@example.com"
