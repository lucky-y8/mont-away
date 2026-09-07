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

本地默认使用 SQLite，并在启动时补齐开发表。生产环境应使用 PostgreSQL、Alembic 数据库迁移、独立密钥管理及邮件服务。开发模式为了测试邮箱验证和密码重置，可在响应中返回调试令牌；生产配置强制禁止这一行为。

前后端共用仓库根目录的 `.env`，FastAPI 会按项目绝对路径读取，因此从根目录或 `backend` 目录启动都不会读错文件。QQ 邮箱使用 `smtp.qq.com:465`、`SMTP_SSL=true`、`SMTP_STARTTLS=false`；保持 `EMAIL_DRY_RUN=true` 时邮件仅演练、不真实发送。不要把 `.env` 或授权码提交到仓库。

数据库迁移：

```powershell
.venv\Scripts\python -m alembic upgrade head
```

Alembic 应用于空库或已经带有 `alembic_version` 版本号的迁移库。早期由 ORM 自动建表的本地 `shanyao.db` 可能没有有效版本号，不能直接执行 `upgrade head`；请先备份并使用新数据库，或在确认实际结构对应哪个迁移版本后再 `stamp`，不要盲目标记版本。生产环境不得使用自动建表代替迁移。
