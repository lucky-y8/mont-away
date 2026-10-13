# 山遥 Nginx 部署配置 / Shanyao Nginx Deployment

本文档适用于以下部署结构（根路径 `/` 为刷题页，山遥位于 `/shanyao/`）：

- 域名：`sy.chexi.tech`
- 仓库目录：`/home/ubuntu/prod/mont-away`，后端从该目录下的 `dist` 读取两个 HTML 入口
- Nginx 静态目录：`/var/www/sy.chexi.tech`，从仓库 `dist` 同步
- FastAPI：`127.0.0.1:9005`
- Nginx 对外提供 HTTP/HTTPS

FastAPI 应只监听本机地址，例如：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 9005 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

将以下内容保存到 `/etc/nginx/sites-available/sy.chexi.tech`：

```nginx
# Shared host: study /, travel /shanyao/, APIs keep separate namespaces.
upstream shanyao_backend {
    server 127.0.0.1:9005;
    keepalive 16;
}
server {
    listen 80;
    listen [::]:80;
    server_name sy.chexi.tech;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name sy.chexi.tech;
    ssl_certificate /etc/letsencrypt/live/sy.chexi.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sy.chexi.tech/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;
    client_max_body_size 55m;
    root /var/www/sy.chexi.tech;
    charset utf-8;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location ^~ /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location ^~ /study-assets/ {
        try_files $uri =404;
        expires 1d;
    }
    location ~ /\.(?!well-known) { deny all; }
    # FastAPI selects the right HTML, renders travel SEO, and redirects old links.
    # Do not strip /shanyao or fall back every request to the study index.
    location / {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

启用并检查：

```bash
sudo ln -s /etc/nginx/sites-available/sy.chexi.tech /etc/nginx/sites-enabled/sy.chexi.tech
sudo nginx -t
sudo systemctl reload nginx
```

上线验证：

```bash
curl -fsS http://127.0.0.1:9005/health
curl -I https://sy.chexi.tech/
curl -fsS https://sy.chexi.tech/ | grep -F '13017刷题'
curl -fsS https://sy.chexi.tech/shanyao/ | grep -F '山遥'
curl -fsS https://sy.chexi.tech/api/study/questions | python -c 'import json,sys; print(len(json.load(sys.stdin)["questions"]))'
curl -I https://sy.chexi.tech/study-assets/sources/ch00.pdf
curl -I https://sy.chexi.tech/en/
curl -fsS https://sy.chexi.tech/robots.txt
curl -fsS https://sy.chexi.tech/sitemap.xml
curl -fsS https://sy.chexi.tech/shanyao/map | grep -F 'href="https://sy.chexi.tech/shanyao/map"'
curl -fsS https://sy.chexi.tech/shanyao/ranking | grep -F 'href="https://sy.chexi.tech/shanyao/ranking"'
curl -fsS https://sy.chexi.tech/shanyao/contact | grep -F 'href="https://sy.chexi.tech/shanyao/contact"'
```

生产构建前，根目录 `.env` 至少应包含：

```dotenv
VITE_SHANYAO_API_URL=
VITE_SHANYAO_SITE_URL=https://sy.chexi.tech
SHANYAO_FRONTEND_URL=https://sy.chexi.tech
SHANYAO_CORS_ORIGINS=https://sy.chexi.tech
SHANYAO_ALLOWED_HOSTS=sy.chexi.tech,127.0.0.1,localhost
```

前端环境变量在构建时写入；修改后必须重新运行 `npm run build`。

## 刷题集成后的更新

先阅读 [STUDY_INTEGRATION.md](STUDY_INTEGRATION.md)。后端仍为原来的 FastAPI 服务；新的 `/api/study/` 使用独立 SQLite 文件。设置 `SHANYAO_STUDY_DATABASE_PATH=/srv/shanyao/shared/study.sqlite3`，确保运行用户对目录有写权限。不要沿用所有 URL 回退到 `/index.html` 的旧规则；可直接采用仓库 `deploy/nginx-shared.conf`。

已有 HTTPS 站点请把新的 `location` 规则合并到原站点配置，保留现有证书路径和高德 `/_AMapService` 代理。模板中的证书路径仅在该路径确实存在时适用。
