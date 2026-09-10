# 山遥 SEO 上线与提交清单

更新日期：2026-09-10
站点：https://sy.chexi.tech/

## 上线前

- 部署最新后端 `backend/app/routers/seo.py`。
- 重启 FastAPI 服务。
- 将 `docs/DEPLOY_NGINX.md` 中 `/robots.txt`、`/sitemap.xml`、`/llms.txt`、`/map`、`/ranking`、`/contact` 的精确匹配规则同步到线上 Nginx。
- 执行 `sudo nginx -t`，成功后再执行 `sudo systemctl reload nginx`。
- 至少准备 3 篇审核通过的真实游记；未审核或测试帖子不进入 sitemap。

## 上线验证

```bash
curl -fsS https://sy.chexi.tech/robots.txt
curl -fsS https://sy.chexi.tech/sitemap.xml
curl -fsS https://sy.chexi.tech/llms.txt
curl -fsS https://sy.chexi.tech/map | grep -F 'href="https://sy.chexi.tech/map"'
curl -fsS https://sy.chexi.tech/ranking | grep -F 'href="https://sy.chexi.tech/ranking"'
curl -fsS https://sy.chexi.tech/contact | grep -F 'href="https://sy.chexi.tech/contact"'
```

预期结果：

- 三个抓取文件均返回 `200`。
- `/map` 的 canonical 是 `https://sy.chexi.tech/map`。
- `/ranking` 的 canonical 是 `https://sy.chexi.tech/ranking`。
- `/contact` 的 canonical 是 `https://sy.chexi.tech/contact`。
- 英文和日文页面具有对应的 `hreflang`、应用名和结构化数据。

## 搜索平台提交

统一提交地址：

```text
https://sy.chexi.tech/sitemap.xml
```

### Google Search Console

1. 添加 `sy.chexi.tech` 对应资源，优先使用 DNS TXT 验证所有权。
2. 在“站点地图”中提交 `sitemap.xml`。
3. 用 URL 检查分别测试首页、`/map`、`/ranking` 和首批真实游记详情页。
4. 页面抓取成功后，对最重要的少量页面请求编入索引；批量页面交给 sitemap。

### Bing Webmaster Tools

1. 添加并验证站点，也可以从 Google Search Console 导入。
2. 在 Sitemaps 中提交完整 sitemap URL。
3. 首批真实游记上线时，可用 URL Submission 提交少量重点页面。

### 百度搜索资源平台

1. 添加 `sy.chexi.tech` 并完成站点所有权验证。
2. 在“资源提交 / 普通收录”中按账号当前开放方式提交 sitemap 或重点 URL。
3. 使用抓取诊断检查首页、地图页和游记详情页。
4. 不批量提交空页面、草稿、未审核内容或重复多语言 URL。

## 每周检查

- sitemap 的读取状态、发现 URL 数和错误数。
- 已抓取但未索引页面，以及 canonical 是否被搜索引擎改选。
- 404、服务器错误、重定向链和被 robots 阻止的公开页面。
- 真实游记的标题、地点名称、首图、正文摘要和路线信息是否完整。
- 搜索词、展现、点击和访问后首次发布转化率。

## 安全约定

- 登录、验证码和 DNS 控制台由站点所有者本人完成。
- 不在聊天或仓库中保存搜索平台密码、验证码或验证密钥。
- 添加 DNS、提交 sitemap、请求收录等外部操作在执行前逐项确认。
