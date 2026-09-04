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

本地默认使用 SQLite，并在启动时自动创建表。生产环境应使用 PostgreSQL、Alembic 数据库迁移、独立密钥管理及邮件服务。开发模式为了测试邮箱验证和密码重置，可在响应中返回调试令牌；生产配置强制禁止这一行为。

QQ 邮箱使用 `smtp.qq.com:465`、`SMTP_SSL=true`、`SMTP_STARTTLS=false`。复制 `.env.example` 为 `.env` 后填写 SMTP 授权码；保持 `EMAIL_DRY_RUN=true` 时邮件仅演练、不真实发送。不要把 `.env` 或授权码提交到仓库。

数据库迁移：

```powershell
.venv\Scripts\python -m alembic upgrade head
```
