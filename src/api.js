const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Access tokens stay in memory on the web. / Web 端访问令牌仅保存在内存中。
const session = { accessToken: null, accessTokenExpiresAt: 0, refreshToken: sessionStorage.getItem('shanyao-refresh-token') }
let refreshPromise = null

function saveTokens(tokens) {
  session.accessToken = tokens.access_token
  // Refresh shortly before expiry so an expected rotation does not appear as a failed request in the UI. / 提前轮换令牌，避免正常过期在界面中表现为失败请求。
  session.accessTokenExpiresAt = Date.now() + tokens.expires_in * 1000
  session.refreshToken = tokens.refresh_token
  sessionStorage.setItem('shanyao-refresh-token', tokens.refresh_token)
  return tokens
}

async function request(path, { locale = 'zh-CN', retry = true, ...options } = {}) {
  if (retry && path !== '/api/v1/auth/refresh' && session.accessToken && session.accessTokenExpiresAt - Date.now() < 15_000 && session.refreshToken) {
    await refreshSession(locale)
  }
  const headers = { 'Accept-Language': locale, ...options.headers }
  // The browser supplies multipart boundaries for FormData. / FormData 的分隔符交给浏览器生成。
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))
  // Rotate an expired access token once. / 访问令牌过期时仅轮换重试一次。
  if (response.status === 401 && retry && session.refreshToken && path !== '/api/v1/auth/refresh') {
    try {
      await refreshSession(locale)
      return request(path, { locale, retry: false, ...options })
    } catch {
      clearSession()
    }
  }
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`)
  return body
}

function clearSession() {
  session.accessToken = null
  session.accessTokenExpiresAt = 0
  session.refreshToken = null
  sessionStorage.removeItem('shanyao-refresh-token')
}

export async function registerEmail(email, password, locale) {
  return request('/api/v1/auth/email/register', { method: 'POST', locale, body: JSON.stringify({ email, password }) })
}

export async function verifyEmail(token, locale) {
  return request('/api/v1/auth/email/verify', { method: 'POST', locale, body: JSON.stringify({ token }) })
}

export function requestPasswordReset(email, locale) {
  return request('/api/v1/auth/email/password/forgot', { method: 'POST', locale, body: JSON.stringify({ email }) })
}

export async function resetPassword(token, password, locale) {
  const result = await request('/api/v1/auth/email/password/reset', { method: 'POST', locale, retry: false, body: JSON.stringify({ token, password }) })
  // Password reset revokes every server session, so remove stale browser credentials too. / 重置密码会撤销服务端全部会话，同时清理浏览器旧凭据。
  clearSession()
  return result
}

export async function loginEmail(email, password, locale) {
  const tokens = await request('/api/v1/auth/email/login', { method: 'POST', locale, body: JSON.stringify({ email, password }) })
  return saveTokens(tokens)
}

export async function refreshSession(locale) {
  if (!session.refreshToken) return null
  if (!refreshPromise) {
    const refreshToken = session.refreshToken
    refreshPromise = request('/api/v1/auth/refresh', { method: 'POST', locale, retry: false, body: JSON.stringify({ refresh_token: refreshToken }) })
      .then(saveTokens)
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function exchangeWeChatCode(code, locale) {
  const tokens = await request('/api/v1/auth/wechat/exchange', { method: 'POST', locale, body: JSON.stringify({ code }) })
  return saveTokens(tokens)
}

export function getCurrentUser(locale) {
  return request('/api/v1/auth/me', { locale })
}

export async function restoreCurrentUser(locale) {
  try {
    if (!session.accessToken) await refreshSession(locale)
    return session.accessToken ? getCurrentUser(locale) : null
  } catch (error) {
    // A revoked or expired persisted refresh token should not poison later public requests. / 已撤销或过期的持久刷新令牌不应影响后续公开请求。
    clearSession()
    throw error
  }
}

export function hasStoredSession() {
  return Boolean(session.accessToken || session.refreshToken)
}

export async function logout(locale) {
  if (session.refreshToken) {
    await request('/api/v1/auth/logout', { method: 'POST', locale, retry: false, body: JSON.stringify({ refresh_token: session.refreshToken }) })
  }
  clearSession()
}

export function listPosts(locale, search = '', sort = 'recent', feed = 'all', location = null) {
  const params = new URLSearchParams({ sort })
  if (search) params.set('search', search)
  if (feed !== 'all') params.set('feed', feed)
  if (location) {
    params.set('latitude', location.latitude)
    params.set('longitude', location.longitude)
    params.set('radius_km', location.radiusKm || 50)
  }
  return request(`/api/v1/posts?${params}`, { locale })
}

export function getPost(postId, locale) {
  return request(`/api/v1/posts/${postId}`, { locale })
}

export function getPlace(placeId, locale) {
  return request(`/api/v1/places/${placeId}`, { locale })
}

export function setUserFollow(userId, following, locale) {
  return request(`/api/v1/users/${userId}/follow`, { method: following ? 'POST' : 'DELETE', locale })
}

export function getNotifications(locale) {
  return request('/api/v1/account/notifications', { locale })
}

export function getPointAccount(locale) {
  return request('/api/v1/account/points', { locale })
}

export function listGifts(locale) {
  return request('/api/v1/gifts', { locale })
}

export function redeemGift(giftId, payload, locale) {
  return request(`/api/v1/gifts/${giftId}/redeem`, { method: 'POST', locale, body: JSON.stringify(payload) })
}

export function getRedemptions(locale) {
  return request('/api/v1/account/redemptions', { locale })
}

export function cancelRedemption(redemptionId, locale) {
  return request(`/api/v1/account/redemptions/${redemptionId}/cancel`, { method: 'POST', locale })
}

export function getModerationQueue(locale) {
  return request('/api/v1/admin/posts', { locale })
}

export function getReportQueue(locale) {
  return request('/api/v1/admin/reports', { locale })
}

export function getAdminUsers(locale, search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : ''
  return request(`/api/v1/admin/users${params}`, { locale })
}

export function getAdminGifts(locale) {
  return request('/api/v1/admin/gifts', { locale })
}

export function createGift(payload, locale) {
  return request('/api/v1/admin/gifts', { method: 'POST', locale, body: JSON.stringify(payload) })
}

export function updateGift(giftId, payload, locale) {
  return request(`/api/v1/admin/gifts/${giftId}`, { method: 'PATCH', locale, body: JSON.stringify(payload) })
}

export function getAdminRedemptions(locale, status = '') {
  const params = status ? `?redemption_status=${encodeURIComponent(status)}` : '?redemption_status='
  return request(`/api/v1/admin/redemptions${params}`, { locale })
}

export function shipRedemption(redemptionId, trackingNumber, locale) {
  return request(`/api/v1/admin/redemptions/${redemptionId}/ship`, { method: 'POST', locale, body: JSON.stringify({ tracking_number: trackingNumber }) })
}

export function adminCancelRedemption(redemptionId, locale) {
  return request(`/api/v1/admin/redemptions/${redemptionId}/cancel`, { method: 'POST', locale })
}

export function banUser(userId, reason, durationHours, locale) {
  return request(`/api/v1/admin/users/${userId}/ban`, { method: 'POST', locale, body: JSON.stringify({ reason, duration_hours: durationHours }) })
}

export function unbanUser(userId, locale) {
  return request(`/api/v1/admin/users/${userId}/unban`, { method: 'POST', locale })
}

export function resolveReport(reportId, resolution, locale) {
  return request(`/api/v1/admin/reports/${reportId}/resolve`, { method: 'POST', locale, body: JSON.stringify({ resolution }) })
}

export function approvePost(postId, reason, locale) {
  return request(`/api/v1/admin/posts/${postId}/approve`, { method: 'POST', locale, body: JSON.stringify({ reason }) })
}

export function removePost(postId, reason, locale) {
  return request(`/api/v1/admin/posts/${postId}/remove`, { method: 'POST', locale, body: JSON.stringify({ reason }) })
}

export function createPost(payload, locale) {
  return request('/api/v1/posts', { method: 'POST', locale, body: JSON.stringify(payload) })
}

export function getMyPosts(locale) {
  return request('/api/v1/posts/mine', { locale })
}

export function updatePost(postId, payload, locale) {
  return request(`/api/v1/posts/${postId}`, { method: 'PATCH', locale, body: JSON.stringify(payload) })
}

export function uploadMedia(file, locale) {
  const body = new FormData()
  body.append('file', file)
  return request('/api/v1/media', { method: 'POST', locale, body })
}

export function setPostLike(postId, liked, locale) {
  return request(`/api/v1/posts/${postId}/likes`, { method: liked ? 'POST' : 'DELETE', locale })
}

export function listComments(postId, locale) {
  return request(`/api/v1/posts/${postId}/comments`, { locale })
}

export function addComment(postId, body, locale) {
  return request(`/api/v1/posts/${postId}/comments`, { method: 'POST', locale, body: JSON.stringify({ body }) })
}

export function setPostBookmark(postId, bookmarked, locale) {
  return request(`/api/v1/posts/${postId}/bookmarks`, { method: bookmarked ? 'POST' : 'DELETE', locale })
}

export function reportPost(postId, reason, locale) {
  return request(`/api/v1/posts/${postId}/reports`, { method: 'POST', locale, body: JSON.stringify({ category: 'other', reason }) })
}

export function getBookmarks(locale) {
  return request('/api/v1/account/bookmarks', { locale })
}

export function beginWeChatLogin() {
  window.location.assign(`${API_BASE}/api/v1/auth/wechat/start`)
}
