# 山遥 Nginx 部署配置 / Shanyao Nginx Deployment

本文档适用于以下部署结构：

- 域名：`sy.chexi.tech`
- 前端目录：`/srv/shanyao/app/dist`
- FastAPI：`127.0.0.1:9005`
- Nginx 对外提供 HTTP/HTTPS

FastAPI 应只监听本机地址，例如：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 9005 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

将以下内容保存到 `/etc/nginx/sites-available/sy.chexi.tech`：

```nginx
# 山遥 FastAPI 后端，仅通过 Nginx 访问。
upstream shanyao_backend {
    server 127.0.0.1:9005;
    keepalive 16;
}


# HTTP：统一跳转到 HTTPS。
server {
    listen 80;
    listen [::]:80;

    server_name sy.chexi.tech;

    return 301 https://$host$request_uri;
}


# HTTPS：静态前端、API、媒体与 SEO 页面。
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name sy.chexi.tech;

    # Vite 构建产物。
    root /srv/shanyao/app/dist;
    index index.html;
    charset utf-8;

    # Certbot 为 sy.chexi.tech 生成的证书。
    ssl_certificate /etc/letsencrypt/live/sy.chexi.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sy.chexi.tech/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 10m;
    ssl_session_cache shared:SHANYAO_SSL:10m;
    server_tokens off;

    # 后端允许 50 MiB 文件；为 multipart 边界预留少量空间。
    client_max_body_size 55m;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), payment=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API 路径保持不变：/api/v1/... -> 127.0.0.1:9005/api/v1/...
    location ^~ /api/ {
        proxy_pass http://shanyao_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 健康检查。
    location = /health {
        proxy_pass http://shanyao_backend/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 本地媒体由 FastAPI 提供；^~ 防止图片扩展名被静态资源规则截获。
    location ^~ /media/ {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 动态 robots、站点地图和大模型站点说明。
    # sitemap.xml 会自动包含审核通过的公开游记与地点。
    location = /robots.txt {
        proxy_pass http://shanyao_backend/robots.txt;
    }
    location = /sitemap.xml {
        proxy_pass http://shanyao_backend/sitemap.xml;
    }
    location = /llms.txt {
        proxy_pass http://shanyao_backend/llms.txt;
    }

    # 公开详情页交给 FastAPI 输出带动态 Meta/JSON-LD 的 HTML，随后仍由 React 接管。
    location ^~ /posts/ {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location ^~ /places/ {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 英文版和日文版使用独立 URL，确保 hreflang 与 canonical 稳定。
    location = /en {
        return 301 /en/;
    }
    location ^~ /en/ {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /ja {
        return 301 /ja/;
    }
    location ^~ /ja/ {
        proxy_pass http://shanyao_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 指纹化前端资源可长期缓存。
    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }

    # 其他静态资源。
    location ~* \.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$ {
        expires 7d;
        access_log off;
        try_files $uri =404;
    }

    # 中文 SPA 页面；未知前端路径回退至 index.html。
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 禁止访问隐藏文件，但保留证书验证目录。
    location ~ /\.(?!well-known) {
        deny all;
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
curl -I https://sy.chexi.tech/en/
curl -fsS https://sy.chexi.tech/robots.txt
curl -fsS https://sy.chexi.tech/sitemap.xml
```

生产构建前，根目录 `.env` 至少应包含：

```dotenv
VITE_SHANYAO_API_URL=https://sy.chexi.tech
VITE_SHANYAO_SITE_URL=https://sy.chexi.tech
SHANYAO_FRONTEND_URL=https://sy.chexi.tech
SHANYAO_CORS_ORIGINS=https://sy.chexi.tech
SHANYAO_ALLOWED_HOSTS=sy.chexi.tech,127.0.0.1,localhost
```

前端环境变量在构建时写入；修改后必须重新运行 `npm run build`。
