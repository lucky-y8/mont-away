# 山遥 FastAPI 后端

## 本地运行

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

- API 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`

本地默认使用 SQLite，并在启动时自动创建表。生产环境应使用 PostgreSQL、Alembic 数据库迁移、独立密钥管理及邮件服务。开发模式为了测试邮箱验证会在注册响应中返回验证令牌；生产配置强制禁止这一行为。
