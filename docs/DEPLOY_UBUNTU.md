# 山遥 Ubuntu 原生部署手册 / Shanyao Native Ubuntu Deployment

本文档面向服务器 `43.155.160.136` 和域名 `sy.chexi.tech`，不使用 Docker。前端由 Caddy 提供静态文件，FastAPI 由 systemd 托管，PostgreSQL 使用 Ubuntu 系统服务。

> 当前媒体文件仍保存到服务器本地目录，因此首轮公网部署使用 `SHANYAO_ENVIRONMENT=staging`。这适合联调和微信审核前测试，但不等于已经完成对象存储、异地备份和视频转码的正式生产架构。

## 1. 部署结构 / Architecture

```text
Internet
   |
   v
https://sy.chexi.tech:443
   |
   v
Caddy
   |-- /              -> /srv/shanyao/app/dist
   |-- /api/*, /health -> 127.0.0.1:8000 (FastAPI)
   `-- /media/*       -> /srv/shanyao/shared/uploads
                              |
                              `-> PostgreSQL 127.0.0.1:5432
```

公网只开放 80/443。FastAPI 8000 和 PostgreSQL 5432 默认只监听或放行本机；文末另有临时开放 PostgreSQL 测试端口的步骤。

## 2. DNS 与腾讯云安全组 / DNS and security group

在域名解析控制台添加：

```text
记录类型：A
主机记录：sy
记录值：43.155.160.136
TTL：600（或使用服务商默认值）
```

腾讯云安全组至少放行：

```text
TCP 22   来源：你的固定公网 IP（SSH）
TCP 80   来源：0.0.0.0/0 和 ::/0
TCP 443  来源：0.0.0.0/0 和 ::/0
```

解析生效后检查：

```bash
getent hosts sy.chexi.tech
```

结果应包含 `43.155.160.136`。

## 3. 安装系统依赖 / System packages

以下命令适用于 Ubuntu 22.04/24.04：

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip build-essential libpq-dev postgresql postgresql-contrib caddy
```

前端构建还需要 Node.js。当前 Vite 要求 Node.js `^20.19.0` 或 `>=22.12.0`，推荐安装 Node.js 22 LTS，然后检查：

```bash
node --version
npm --version
python3 --version
psql --version
caddy version
```

## 4. 创建系统账号与目录 / Service account and directories

```bash
sudo useradd --system --create-home --home-dir /srv/shanyao --shell /usr/sbin/nologin shanyao
sudo mkdir -p /srv/shanyao/shared/uploads
sudo chown -R shanyao:shanyao /srv/shanyao
sudo chmod 755 /srv /srv/shanyao /srv/shanyao/shared /srv/shanyao/shared/uploads
```

拉取代码：

```bash
sudo -u shanyao git clone https://github.com/lucky-y8/mont-away.git /srv/shanyao/app
```

## 5. 初始化 PostgreSQL / PostgreSQL initialization

进入管理终端：

```bash
sudo -u postgres psql
```

在 `psql` 中执行。脚本会复用已经存在的 `shanyao_app` 角色：

```sql
SELECT 'CREATE ROLE shanyao_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shanyao_app') \gexec

ALTER ROLE shanyao_app
WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

\password shanyao_app

SELECT 'CREATE DATABASE shanyao_prod OWNER shanyao_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shanyao_prod') \gexec

ALTER DATABASE shanyao_prod OWNER TO shanyao_app;
REVOKE ALL ON DATABASE shanyao_prod FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE shanyao_prod TO shanyao_app;

\connect shanyao_prod
GRANT USAGE, CREATE ON SCHEMA public TO shanyao_app;
\q
```

本机验证：

```bash
psql -h 127.0.0.1 -U shanyao_app -d shanyao_prod -c 'select current_user, current_database();'
```

## 6. 配置根目录 `.env` / Environment configuration

创建未纳入 Git 的实际环境文件：

```bash
sudo -u shanyao cp /srv/shanyao/app/.env.example /srv/shanyao/app/.env
sudo chmod 600 /srv/shanyao/app/.env
sudo -u shanyao nano /srv/shanyao/app/.env
```

所有项目变量都有项目名前缀：后端和运维变量使用 `SHANYAO_`，Vite 浏览器变量使用 `VITE_SHANYAO_`。部署值至少应为：

```dotenv
# Frontend public variables / 前端公开变量
VITE_SHANYAO_API_URL=https://sy.chexi.tech
VITE_SHANYAO_AMAP_KEY=你的高德Web端JS API Key
VITE_SHANYAO_AMAP_SECURITY_JS_CODE=你的高德安全密钥
VITE_SHANYAO_AMAP_SERVICE_HOST=

# Backend runtime / 后端运行配置
SHANYAO_APP_NAME=Shanyao API
SHANYAO_ENVIRONMENT=staging
SHANYAO_API_PREFIX=/api/v1
SHANYAO_JWT_SECRET=至少32位的随机密钥
SHANYAO_ACCESS_TOKEN_MINUTES=15
SHANYAO_REFRESH_TOKEN_DAYS=30
SHANYAO_VERIFICATION_TOKEN_MINUTES=30
SHANYAO_PASSWORD_RESET_TOKEN_MINUTES=30
SHANYAO_OAUTH_CODE_MINUTES=5
SHANYAO_FRONTEND_URL=https://sy.chexi.tech
SHANYAO_CORS_ORIGINS=https://sy.chexi.tech
SHANYAO_EXPOSE_DEBUG_TOKENS=false

# Native PostgreSQL / 原生 PostgreSQL
SHANYAO_POSTGRES_HOST=127.0.0.1
SHANYAO_POSTGRES_PORT=5432
SHANYAO_POSTGRES_DB=shanyao_prod
SHANYAO_POSTGRES_USER=shanyao_app
SHANYAO_POSTGRES_PASSWORD=数据库强密码
SHANYAO_DATABASE_URL=postgresql+asyncpg://shanyao_app:URL编码后的数据库密码@127.0.0.1:5432/shanyao_prod

# QQ SMTP / QQ 邮箱
SHANYAO_EMAIL_NOTIFICATIONS=true
SHANYAO_EMAIL_BACKEND=smtp
SHANYAO_EMAIL_DRY_RUN=false
SHANYAO_SMTP_HOST=smtp.qq.com
SHANYAO_SMTP_PORT=465
SHANYAO_SMTP_USERNAME=你的发件邮箱
SHANYAO_SMTP_PASSWORD=QQ邮箱SMTP授权码
SHANYAO_SMTP_FROM=你的发件邮箱
SHANYAO_SMTP_STARTTLS=false
SHANYAO_SMTP_SSL=true

# Administration and rewards / 管理员与积分
SHANYAO_INITIAL_ADMIN_EMAIL=首个管理员邮箱
SHANYAO_POST_REWARD_POINTS=5

# Single-server staging media / 单机测试媒体
SHANYAO_MEDIA_BACKEND=local
SHANYAO_MEDIA_LOCAL_DIR=/srv/shanyao/shared/uploads
SHANYAO_MEDIA_PUBLIC_URL=https://sy.chexi.tech/media
SHANYAO_MAX_UPLOAD_BYTES=52428800

# WeChat OAuth / 微信登录
SHANYAO_WECHAT_APP_ID=
SHANYAO_WECHAT_APP_SECRET=
SHANYAO_WECHAT_REDIRECT_URI=https://sy.chexi.tech/api/v1/auth/wechat/callback
```

数据库密码若包含 `@`、`:`、`/`、`#`、`%` 等字符，必须在 `SHANYAO_DATABASE_URL` 中进行 URL 编码。`.env` 不得提交 Git，也不要把密码粘贴到聊天、工单或截图中。

## 7. 安装后端并执行迁移 / Backend and migrations

```bash
cd /srv/shanyao/app/backend
sudo -u shanyao python3 -m venv .venv
sudo -u shanyao .venv/bin/python -m pip install --upgrade pip
sudo -u shanyao .venv/bin/python -m pip install -r requirements.txt
sudo -u shanyao .venv/bin/python -m alembic upgrade head
sudo -u shanyao .venv/bin/python -m alembic current
```

迁移必须成功后才能启动服务。部署环境不会再依赖 FastAPI 启动时自动建表。

## 8. 构建前端 / Frontend build

Vite 会在构建时读取根目录 `.env`：

```bash
cd /srv/shanyao/app
sudo -u shanyao npm ci
sudo -u shanyao npm run build
test -f /srv/shanyao/app/dist/index.html
```

修改 `VITE_SHANYAO_` 变量后必须重新运行 `npm run build`。

## 9. 配置 systemd / FastAPI service

创建 `/etc/systemd/system/shanyao.service`：

```ini
[Unit]
Description=Shanyao FastAPI service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=shanyao
Group=shanyao
WorkingDirectory=/srv/shanyao/app/backend
ExecStart=/srv/shanyao/app/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=on-failure
RestartSec=3
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/srv/shanyao/shared/uploads

[Install]
WantedBy=multi-user.target
```

加载并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shanyao
sudo systemctl status shanyao --no-pager
curl -fsS http://127.0.0.1:8000/health
```

查看日志：

```bash
sudo journalctl -u shanyao -n 100 --no-pager
sudo journalctl -u shanyao -f
```

## 10. 配置 Caddy 与 HTTPS / Caddy and HTTPS

备份原配置：

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-shanyao
```

将 `/etc/caddy/Caddyfile` 配置为：

```caddyfile
sy.chexi.tech {
    encode zstd gzip

    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-Frame-Options SAMEORIGIN
    }

    @backend path /api/* /health
    reverse_proxy @backend 127.0.0.1:8000

    handle_path /media/* {
        root * /srv/shanyao/shared/uploads
        file_server
    }

    handle {
        root * /srv/shanyao/app/dist
        try_files {path} /index.html
        file_server
    }
}
```

验证并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy 申请证书要求 `sy.chexi.tech` 已解析到 `43.155.160.136`，并且腾讯云安全组和 Ubuntu 防火墙都允许 80/443。

## 11. Ubuntu 防火墙 / UFW

启用前先确认 SSH 规则，避免把自己锁在服务器外：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

不要为 FastAPI 8000 创建公网规则。

## 12. 上线检查 / Verification

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS https://sy.chexi.tech/health
curl -I https://sy.chexi.tech/
```

浏览器继续检查：

- PC 与移动端首页能够加载。
- 邮箱注册、验证邮件、登录和找回密码闭环。
- 地图加载、当前位置、选点和节点拖动。
- 图片上传后能通过 `/media/` 访问。
- 后台账号只能访问管理员接口。
- 页面无数据时不出现伪造帖子或榜单。

## 13. 微信开放平台 / WeChat Open Platform

网站应用审核资料填写：

```text
应用官网：https://sy.chexi.tech
授权回调域：sy.chexi.tech
后端回调地址：https://sy.chexi.tech/api/v1/auth/wechat/callback
```

审核通过后只在服务器 `.env` 中填写：

```dotenv
SHANYAO_WECHAT_APP_ID=审核得到的AppID
SHANYAO_WECHAT_APP_SECRET=审核得到的AppSecret
```

然后重启后端：

```bash
sudo systemctl restart shanyao
```

## 14. 临时允许所有 IP 访问 PostgreSQL / Temporary public database access

此配置仅用于短时测试。先查询实际配置路径：

```bash
sudo -u postgres psql -tAc "SHOW config_file;"
sudo -u postgres psql -tAc "SHOW hba_file;"
```

在 `postgresql.conf` 设置：

```conf
listen_addresses = '*'
port = 5432
```

在 `pg_hba.conf` 末尾添加，仅开放山遥数据库和应用账号：

```conf
host    shanyao_prod    shanyao_app    0.0.0.0/0    scram-sha-256
host    shanyao_prod    shanyao_app    ::/0         scram-sha-256
```

重启并临时开放防火墙：

```bash
sudo systemctl restart postgresql
sudo ufw allow 5432/tcp
sudo ss -lntp | grep ':5432'
```

腾讯云安全组也需要临时添加 TCP 5432、来源 `0.0.0.0/0`。外部机器测试：

```bash
psql -h 43.155.160.136 -U shanyao_app -d shanyao_prod
```

测试完成后，把 `pg_hba.conf` 的 `0.0.0.0/0` 改为指定公网 IP `/32`，或删除这两行，然后执行：

```bash
sudo ufw delete allow 5432/tcp
sudo systemctl restart postgresql
```

同时删除腾讯云安全组中的 5432 公网规则。

## 15. 更新版本 / Updating

```bash
sudo systemctl stop shanyao
cd /srv/shanyao/app
sudo -u shanyao git pull --ff-only
sudo -u shanyao npm ci
sudo -u shanyao npm run build
cd backend
sudo -u shanyao .venv/bin/python -m pip install -r requirements.txt
sudo -u shanyao .venv/bin/python -m alembic upgrade head
sudo systemctl start shanyao
curl -fsS https://sy.chexi.tech/health
```

## 16. 备份 / Backups

数据库和本地媒体都必须备份到另一台机器或对象存储：

```bash
sudo mkdir -p /srv/shanyao/backups
sudo chown shanyao:shanyao /srv/shanyao/backups
sudo -u shanyao pg_dump -h 127.0.0.1 -U shanyao_app -d shanyao_prod -Fc -f /srv/shanyao/backups/shanyao_prod.dump
sudo -u shanyao tar -C /srv/shanyao/shared -czf /srv/shanyao/backups/uploads.tar.gz uploads
```

不要只把备份留在同一块服务器磁盘。正式生产切换前仍需完成对象存储适配、定时异地备份、恢复演练、监控和告警。
