# 山遥认证方案

## 首版范围

- 邮箱注册：邮箱、密码、邮件验证。
- 邮箱登录：邮箱、密码。
- 微信登录：当前只做 Web 网站应用扫码授权；原生移动 App 已暂停。
- QQ、Google、快捷登录和手机号登录暂不开发。

邮箱认证及找回密码的前后端闭环已实现。邮箱验证和密码重置令牌均在数据库中保存哈希且短时有效；验证成功后的同一链接按幂等成功处理，未验证账号可安全重发验证邮件。重置密码令牌仍严格单次使用，并会撤销该账号的所有现有会话。本地开发可使用邮件演练模式并暴露调试令牌；生产环境必须关闭演练和调试令牌。微信 OAuth 流程和安全交换码已实现，但真实授权仍需要微信开放平台网站应用资质、App ID、AppSecret 和备案回调域名。

## 建议 API

```text
POST /api/v1/auth/email/register
POST /api/v1/auth/email/verify
POST /api/v1/auth/email/verification/resend
POST /api/v1/auth/email/login
POST /api/v1/auth/email/password/forgot
POST /api/v1/auth/email/password/reset
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
password_resets
sessions
auth_audit_logs
```

## QQ 邮箱 SMTP

当前适配 QQ 邮箱的隐式 TLS 配置为 `smtp.qq.com:465`、`SHANYAO_SMTP_SSL=true`、`SHANYAO_SMTP_STARTTLS=false`。所有后端变量统一使用 `SHANYAO_` 前缀，不再兼容无前缀旧名称。开发环境保持 `SHANYAO_EMAIL_DRY_RUN=true` 时不会建立网络连接；真实发送前需在不提交 Git 的根目录 `.env` 中填写 `SHANYAO_SMTP_PASSWORD`（QQ 邮箱 SMTP 授权码，而非网页登录密码），然后改为 `SHANYAO_EMAIL_DRY_RUN=false`。

手机号字段本阶段不加入必填约束；未来增加手机号登录时，通过新的 identity 记录关联到现有用户。
