# 刷题与山遥共用网站

本次只修改本地工程，未连接或更新你的服务器，也未改动现有 Sites 线上刷题站点。

| 地址 | 功能 |
| --- | --- |
| `/` | 知网自习室：361 道初始题、答案与解析、匿名上传/批量导入、编辑与历史版本 |
| `/shanyao/` | 原山遥首页 |
| `/shanyao/en/`、`/shanyao/ja/` | 山遥英语、日语页面 |
| `/shanyao/posts/...`、`/shanyao/places/...` | 山遥分享、游记与景点 |
| `/api/v1/...`、`/media/...` | 山遥原有业务接口与媒体，地址保留 |
| `/api/study/questions` | 刷题公共题库接口 |
| `/study-assets/...` | 刷题独立 PDF 和题图 |

旧的 `/posts/...`、`/places/...`、`/en/...`、`/ja/...`、`/auth/...` 以及原山遥导航路径会以 308 跳到对应 `/shanyao/...`，保留查询参数。原首页 `/` 已按要求换为刷题页。登录邮件和密码重置邮件、微信登录后的前端回调会生成新路径；微信开放平台的后端回调 `/api/v1/auth/wechat/callback` 不变。

## 代码与数据隔离

- `study-room/src/`：独立刷题 React 页面与 CSS；只在根入口加载。
- `study-room/data/`：初始题库和逐页提取报告。
- `study-room/public/study-assets/`：12 份课件及原题图片，构建时复制到 dist。
- `backend/app/study_room/`：独立刷题接口、输入校验、SQLite 事务与历史记录。
- `shanyao/index.html`：山遥独立入口，原业务源码仍在 `src/`、`backend/app/`。
- `backend/app/web.py`：生产页面分流、公开文件和旧链接跳转。

默认刷题数据库在 `study-room/runtime/study.sqlite3`，已忽略版本管理。可在共享 `.env` 设置 `SHANYAO_STUDY_DATABASE_PATH` 为绝对路径。它不读取或修改山遥的用户、游记、积分、媒体或 PostgreSQL 表，不需要修改山遥的 Alembic 迁移。

此处导入的是本地初始题库；Sites/Cloudflare 上的后续在线修订没有自动迁入。本地与 Sites 的编辑各自保存，不会互相同步。原课件答案、OCR 和 AI 补充的标记均保留；个人错题/收藏仍保存在当前浏览器。

## 背景、原题图与自行上传

- 顶部“背景”提供 6 个预设与自选颜色，自动保存在当前浏览器；仅改变刷题页的背景。
- 原课件题图和上传题图默认展开，可收起并点击放大。答案与解析仍需各自点击展开。
- 顶部“上传题目”支持手动填写题干、题型、章节、选项、答案、解析和署名。文字草稿保存在当前浏览器；图片需在关闭窗口后重新选择。
- 支持 PNG/JPG/WebP，每题最多 4 张，每张不超过 5 MB。服务端验证真实图像、移除附加元数据，并将长边超过 3200 像素的图像缩小，转为 PNG 保存。
- 批量导入支持 UTF-8 CSV 与 JSON，一次 1–200 题、文件不超过 2 MB；下载入口内的模板，上传后校验并预览，点击“确认导入”才会写入共享题库。批量模板用于文字题；带图题使用手动录入。
- 题目可归入原章节，也可放在“自建题目”。侧栏“同学上传”可快速筛选，所有新增题目支持原有匿名编辑、并发冲突检查和历史恢复。
- 新增题目、图片和修改历史均保存在独立的刷题 SQLite 文件中；服务器重启或更新前端不会清空。升级自动补建新表，不覆盖既有修订。
- 上传接口：POST /api/study/questions；预览接口：POST /api/study/import/preview?filename=...，直接发送文件内容；图片地址：GET /api/study/images/{id}。整批题目与图片统一事务保存，重复提交同一请求编号不会重复入库。
- 反向代理需允许最大 32 MB 的 JSON 请求；示例 Nginx 已设置 55 MB，可满足 4 张图片的 Base64 请求。备份刷题数据库即可一并保留上传题图。

## 本地运行

需要原工程的 Node 与 Python 环境。没有依赖时先在根目录运行 `npm ci`，并在后端虚拟环境安装 `backend/requirements.txt`。上传题图新增 Pillow 依赖，需重新安装后端 requirements；前端未新增 npm 依赖。

先在项目根目录构建：

```powershell
npm run build
```

再在后端目录启动（沿用原来的 `.env`，不要覆盖已有配置）：

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 9005
```

打开 `http://127.0.0.1:9005/` 刷题，打开 `http://127.0.0.1:9005/shanyao/` 使用山遥。原 `VITE_SHANYAO_API_URL` 若指向另一个地址，山遥仍会访问它；同源部署建议该值留空，并重新构建。既有山遥用户数据由原 `.env` 的 `SHANYAO_DATABASE_URL` 控制。

开发热更新：先启动后端，在另一个终端运行 `npm run dev`；后端默认代理到 8000，可用 `SHANYAO_DEV_BACKEND=http://127.0.0.1:9005` 覆盖。前端 `/api`、`/media` 和刷题素材通过同源代理访问后端。`npm run preview` 也采用相同代理。

## 服务器部署

保持原山遥服务、数据库和密钥配置；增加以下非密钥配置：

```dotenv
SHANYAO_STUDY_DATABASE_PATH=/srv/shanyao/shared/study.sqlite3
```

确保服务账号对 `/srv/shanyao/shared` 有写权限。`SHANYAO_FRONTEND_URL` 可以继续填写原域名，也可以写带 `/shanyao` 的 URL；代码会避免重复加前缀。`VITE_SHANYAO_SITE_URL` 应填写公开域名，`VITE_SHANYAO_API_URL` 留空时使用同源接口。

1. 备份原配置、代码和数据库，部署本工程全部源码及 `study-room/`。
2. Git 仓库和发布压缩包均包含已构建的 `dist/index.html`、`dist/shanyao/index.html` 和 `dist/study-assets/`，服务器可以直接使用；只有修改前端构建配置时才需运行 `npm ci`、`npm run build`。
3. 使用 [Nginx 配置](../deploy/nginx-shared.conf) 或 [Ubuntu 文档中的 Caddy 配置](DEPLOY_UBUNTU.md)，保留完整请求路径。后端端口必须与配置一致。
4. 重启原 FastAPI 服务，并检查根页、`/shanyao/`、两个 API、PDF、旧游记跳转和匿名修改历史。

刷题修订不随构建清空；不要把数据库放进 `dist/`。SQLite 使用 WAL，备份时使用 SQLite backup API 或在停止服务后复制数据库，不能只在运行时复制主文件而忽略 WAL。多台服务器共同运行时需要另行换成共享数据库，此版本按单台服务器持久化实现。

### 当前 Ubuntu 目录的更新步骤

以下沿用仓库 `/home/ubuntu/prod/mont-away`、Conda 环境 `shanyao`、后端 9005 端口和 Nginx 静态目录 `/var/www/sy.chexi.tech`。先按上述说明备份；保留服务器原 `.env`，只补充 `SHANYAO_STUDY_DATABASE_PATH`，不要用示例文件覆盖密钥。

```bash
cd /home/ubuntu/prod/mont-away
git pull --ff-only origin main
sudo cp -a dist/. /var/www/sy.chexi.tech/
```

上传题图新增 Pillow 依赖。更新代码后，使用服务的 Python 环境安装：

```bash
/home/ubuntu/miniconda3/envs/shanyao/bin/python -m pip install -r backend/requirements.txt
```

不需要修改山遥 PostgreSQL 结构。首次创建刷题数据库时，原后端运行账号必须可以写入 `/srv/shanyao/shared`；若后端由 `ubuntu` 运行且该目录尚未准备好，可执行：

```bash
sudo install -d -o ubuntu -g ubuntu -m 750 /srv/shanyao/shared
sudo -u ubuntu test -w /srv/shanyao/shared && echo 'study directory writable'
```

重启现有后端服务，让它加载新代码。若一直手动启动，则先停止原进程，再运行以下命令；不要额外启动第二个后端进程：

```bash
cd /home/ubuntu/prod/mont-away/backend
/home/ubuntu/miniconda3/envs/shanyao/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 9005 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

接着按 [Nginx 文档](DEPLOY_NGINX.md) 合并路由，保留现有证书与高德代理，然后执行 `sudo nginx -t && sudo systemctl reload nginx`。验证首页是自习室、题库接口返回至少 361 题（含原始题库与后来上传的题目）、PDF 可访问。仅同步静态文件而不更新后端和代理，不能完成本次上线。

## 验证

```powershell
npm run build
node --test study-room/tests/paths.test.mjs
cd backend
.\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```

测试使用临时题库数据库和山遥内存数据库，不写现有用户数据。覆盖原山遥认证与业务流程、SEO、双页面分流、题库素材、匿名修改、持久历史、版本恢复、并发冲突和输入校验；还覆盖图片上传、整批校验、重复提交、CSV/JSON 模板、图片持久化和旧数据库升级。
