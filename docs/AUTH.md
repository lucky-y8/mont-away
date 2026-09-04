# 山遥认证方案

## 首版范围

- 邮箱注册：邮箱、密码、邮件验证。
- 邮箱登录：邮箱、密码。
- 微信登录：移动 App 使用微信开放平台授权；PC Web 使用网站应用扫码授权。
- QQ、Google、快捷登录和手机号登录暂不开发。

邮箱认证前后端闭环已实现并通过自动化与浏览器回归。本地开发使用控制台验证链接并可暴露调试令牌；生产环境必须关闭调试令牌并配置 SMTP。微信 OAuth 流程和安全交换码已实现，但真实授权仍需要微信开放平台网站应用资质、App ID、AppSecret 和备案回调域名。

## 建议 API

```text
POST /api/v1/auth/email/register
POST /api/v1/auth/email/verify
POST /api/v1/auth/email/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/wechat/start
GET  /api/v1/auth/wechat/callback
POST /api/v1/auth/wechat/exchange
GET  /api/v1/auth/me
```

## 安全要求

- 密码只在服务端使用 Argon2id 哈希，不保存或记录明文。
- 邮箱验证令牌与找回密码令牌必须短时有效且只能使用一次。
- 微信 `AppSecret` 只保存在服务端密钥管理中，绝不进入前端仓库。
- OAuth 请求校验 `state`，移动端同时使用 PKCE 或平台推荐的等效保护。
- Web 会话优先使用 `Secure`、`HttpOnly`、`SameSite` Cookie。
- 登录、注册、验证码和找回密码接口需要限流及异常登录审计。
- 微信账号与邮箱账号通过独立身份表关联，不能仅凭昵称或同名邮箱自动合并。

## 数据模型

```text
users
identities              # email / wechat
email_verifications
sessions
auth_audit_logs
```

手机号字段本阶段不加入必填约束；未来增加手机号登录时，通过新的 identity 记录关联到现有用户。
