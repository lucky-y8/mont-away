"""Localized API messages. / API 多语言消息。"""

from typing import Annotated

from fastapi import Depends, Header

DEFAULT_LOCALE = "zh-CN"
SUPPORTED_LOCALES = {"zh-CN", "en", "ja"}

MESSAGES = {
    "zh-CN": {
        "authentication_required": "请先登录。",
        "invalid_token": "令牌无效或已过期。",
        "invalid_token_purpose": "令牌用途无效。",
        "user_unavailable": "用户不存在或账号不可用。",
        "email_exists": "该邮箱已经注册。",
        "user_not_found": "用户不存在。",
        "email_verified": "邮箱验证成功。",
        "invalid_verification_token": "邮箱验证链接无效、已使用或已过期。",
        "invalid_credentials": "邮箱或密码错误。",
        "password_reset_requested": "如果该邮箱已注册，重置邮件已经发送。",
        "invalid_password_reset_token": "密码重置链接无效、已使用或已过期。",
        "password_reset": "密码已重置，请重新登录。",
        "account_disabled": "账号已被停用。",
        "email_unverified": "邮箱尚未验证。",
        "email_delivery_failed": "验证邮件暂时无法发送，请稍后重试。",
        "invalid_refresh_token": "刷新令牌无效或已过期。",
        "logged_out": "已退出登录。",
        "wechat_not_configured": "微信登录尚未配置。",
        "wechat_auth_failed": "微信授权失败。",
        "wechat_profile_failed": "无法读取微信用户资料。",
        "invalid_login_code": "登录交换码无效或已过期。",
        "post_not_found": "帖子不存在或当前不可见。",
        "post_created": "帖子已发布并进入审核队列。",
        "draft_saved": "草稿已保存。",
        "comment_not_found": "评论不存在或无权操作。",
        "comment_deleted": "评论已删除。",
        "bookmark_saved": "已收藏。",
        "bookmark_removed": "已取消收藏。",
        "report_received": "举报已提交，管理员会进行处理。",
        "report_not_found": "举报记录不存在。",
        "report_resolved": "举报已处理。",
        "notification_post_commented": "{author} 评论了你的帖子《{title}》。",
        "media_invalid_type": "仅支持 JPG、PNG、WebP、MP4 和 MOV 文件。",
        "media_too_large": "文件超过允许的大小。",
        "media_not_found": "媒体文件不存在或不属于当前用户。",
        "media_backend_not_configured": "媒体存储服务尚未配置。",
        "admin_required": "需要管理员权限。",
        "post_approved": "帖子审核通过。",
        "post_removed": "帖子已下架并通知作者。",
        "notification_post_approved": "你的帖子《{title}》已通过审核。",
        "notification_post_removed": "你的帖子《{title}》已下架。原因：{reason}",
        "validation_error": "请求参数不符合要求。",
        "not_found": "请求的资源不存在。",
        "internal_error": "服务器暂时无法处理请求。",
    },
    "en": {
        "authentication_required": "Please sign in first.",
        "invalid_token": "The token is invalid or has expired.",
        "invalid_token_purpose": "The token has an invalid purpose.",
        "user_unavailable": "The user does not exist or the account is unavailable.",
        "email_exists": "This email address is already registered.",
        "user_not_found": "The user was not found.",
        "email_verified": "Email verified successfully.",
        "invalid_verification_token": "The email verification link is invalid, used, or expired.",
        "invalid_credentials": "The email or password is incorrect.",
        "password_reset_requested": "If the email is registered, a password reset message has been sent.",
        "invalid_password_reset_token": "The password reset link is invalid, used, or expired.",
        "password_reset": "The password was reset. Please sign in again.",
        "account_disabled": "This account has been disabled.",
        "email_unverified": "The email address has not been verified.",
        "email_delivery_failed": "The verification email could not be sent. Please try again later.",
        "invalid_refresh_token": "The refresh token is invalid or has expired.",
        "logged_out": "Signed out successfully.",
        "wechat_not_configured": "WeChat sign-in is not configured.",
        "wechat_auth_failed": "WeChat authorization failed.",
        "wechat_profile_failed": "Unable to read the WeChat profile.",
        "invalid_login_code": "The login exchange code is invalid or has expired.",
        "post_not_found": "The post was not found or is not currently visible.",
        "post_created": "The post is public and has entered the review queue.",
        "draft_saved": "Draft saved.",
        "comment_not_found": "The comment was not found or cannot be changed by this user.",
        "comment_deleted": "Comment deleted.",
        "bookmark_saved": "Saved to bookmarks.",
        "bookmark_removed": "Removed from bookmarks.",
        "report_received": "The report was submitted for administrator review.",
        "report_not_found": "The report was not found.",
        "report_resolved": "The report has been resolved.",
        "notification_post_commented": "{author} commented on your post “{title}”.",
        "media_invalid_type": "Only JPG, PNG, WebP, MP4, and MOV files are supported.",
        "media_too_large": "The file exceeds the upload size limit.",
        "media_not_found": "The media file was not found or does not belong to this user.",
        "media_backend_not_configured": "Media storage is not configured.",
        "admin_required": "Administrator access is required.",
        "post_approved": "The post has been approved.",
        "post_removed": "The post has been removed and the author was notified.",
        "notification_post_approved": "Your post “{title}” has been approved.",
        "notification_post_removed": "Your post “{title}” was removed. Reason: {reason}",
        "validation_error": "The request parameters are invalid.",
        "not_found": "The requested resource was not found.",
        "internal_error": "The server could not process the request.",
    },
    "ja": {
        "authentication_required": "先にログインしてください。",
        "invalid_token": "トークンが無効か、有効期限が切れています。",
        "invalid_token_purpose": "トークンの用途が無効です。",
        "user_unavailable": "ユーザーが存在しないか、アカウントを利用できません。",
        "email_exists": "このメールアドレスは既に登録されています。",
        "user_not_found": "ユーザーが見つかりません。",
        "email_verified": "メールアドレスを確認しました。",
        "invalid_verification_token": "確認リンクが無効、使用済み、または期限切れです。",
        "invalid_credentials": "メールアドレスまたはパスワードが正しくありません。",
        "password_reset_requested": "登録済みの場合、パスワード再設定メールを送信しました。",
        "invalid_password_reset_token": "再設定リンクが無効、使用済み、または期限切れです。",
        "password_reset": "パスワードを再設定しました。もう一度ログインしてください。",
        "account_disabled": "このアカウントは停止されています。",
        "email_unverified": "メールアドレスが確認されていません。",
        "email_delivery_failed": "確認メールを送信できませんでした。後でもう一度お試しください。",
        "invalid_refresh_token": "更新トークンが無効か、有効期限が切れています。",
        "logged_out": "ログアウトしました。",
        "wechat_not_configured": "WeChatログインはまだ設定されていません。",
        "wechat_auth_failed": "WeChat認証に失敗しました。",
        "wechat_profile_failed": "WeChatのプロフィールを取得できません。",
        "invalid_login_code": "ログイン交換コードが無効か、有効期限が切れています。",
        "post_not_found": "投稿が存在しないか、現在表示できません。",
        "post_created": "投稿を公開し、審査待ちになりました。",
        "draft_saved": "下書きを保存しました。",
        "comment_not_found": "コメントが存在しないか、操作する権限がありません。",
        "comment_deleted": "コメントを削除しました。",
        "bookmark_saved": "保存しました。",
        "bookmark_removed": "保存を解除しました。",
        "report_received": "報告を送信しました。管理者が確認します。",
        "report_not_found": "報告が見つかりません。",
        "report_resolved": "報告を処理しました。",
        "notification_post_commented": "{author}さんが投稿「{title}」にコメントしました。",
        "media_invalid_type": "JPG、PNG、WebP、MP4、MOVファイルのみ対応しています。",
        "media_too_large": "ファイルがアップロード上限を超えています。",
        "media_not_found": "メディアが存在しないか、このユーザーのものではありません。",
        "media_backend_not_configured": "メディアストレージが設定されていません。",
        "admin_required": "管理者権限が必要です。",
        "post_approved": "投稿を承認しました。",
        "post_removed": "投稿を非公開にし、投稿者へ通知しました。",
        "notification_post_approved": "投稿「{title}」が承認されました。",
        "notification_post_removed": "投稿「{title}」が非公開になりました。理由：{reason}",
        "validation_error": "リクエストの項目が正しくありません。",
        "not_found": "指定されたリソースが見つかりません。",
        "internal_error": "サーバーはリクエストを処理できませんでした。",
    },
}


def resolve_locale(accept_language: str | None) -> str:
    """Select a supported locale from Accept-Language. / 从请求语言中选择受支持语言。"""
    if not accept_language:
        return DEFAULT_LOCALE
    for item in accept_language.split(","):
        code = item.split(";", 1)[0].strip().lower()
        if code.startswith("zh"):
            return "zh-CN"
        if code.startswith("en"):
            return "en"
        if code.startswith("ja"):
            return "ja"
    return DEFAULT_LOCALE


def translate(locale: str, code: str) -> str:
    return MESSAGES.get(locale, MESSAGES[DEFAULT_LOCALE]).get(code, MESSAGES[DEFAULT_LOCALE].get(code, code))


async def get_locale(accept_language: Annotated[str | None, Header()] = None) -> str:
    return resolve_locale(accept_language)


Locale = Annotated[str, Depends(get_locale)]
