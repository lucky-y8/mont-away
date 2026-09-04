# 山遥认证方案

## 首版范围

- 邮箱注册：邮箱、密码、邮件验证。
- 邮箱登录：邮箱、密码。
- 微信登录：移动 App 使用微信开放平台授权；PC Web 使用网站应用扫码授权。
- QQ、Google、快捷登录和手机号登录暂不开发。

当前提交只实现登录界面和前端校验。由于尚未配置服务端、数据库、邮件服务、微信开放平台资质及 App ID，不能进行真实登录。

## 建议 API

```text
POST /api/auth/email/register
POST /api/auth/email/verify
POST /api/auth/email/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/wechat/start
GET  /api/auth/wechat/callback
GET  /api/me
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
