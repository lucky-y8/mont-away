const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Access tokens stay in memory on the web. / Web 端访问令牌仅保存在内存中。
const session = { accessToken: null, refreshToken: sessionStorage.getItem('shanyao-refresh-token') }
let refreshPromise = null

function saveTokens(tokens) {
  session.accessToken = tokens.access_token
  session.refreshToken = tokens.refresh_token
  sessionStorage.setItem('shanyao-refresh-token', tokens.refresh_token)
  return tokens
}

async function request(path, { locale = 'zh-CN', retry = true, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', 'Accept-Language': locale, ...options.headers }
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
  session.refreshToken = null
  sessionStorage.removeItem('shanyao-refresh-token')
}

export async function registerEmail(email, password, locale) {
  return request('/api/v1/auth/email/register', { method: 'POST', locale, body: JSON.stringify({ email, password }) })
}

export async function verifyEmail(token, locale) {
  return request('/api/v1/auth/email/verify', { method: 'POST', locale, body: JSON.stringify({ token }) })
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
  if (!session.accessToken) await refreshSession(locale)
  return session.accessToken ? getCurrentUser(locale) : null
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

export function listPosts(locale, search = '', sort = 'recent') {
  const params = new URLSearchParams({ sort })
  if (search) params.set('search', search)
  return request(`/api/v1/posts?${params}`, { locale })
}

export function getNotifications(locale) {
  return request('/api/v1/account/notifications', { locale })
}

export function getPointAccount(locale) {
  return request('/api/v1/account/points', { locale })
}

export function getModerationQueue(locale) {
  return request('/api/v1/admin/posts', { locale })
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

export function setPostLike(postId, liked, locale) {
  return request(`/api/v1/posts/${postId}/likes`, { method: liked ? 'POST' : 'DELETE', locale })
}

export function beginWeChatLogin() {
  window.location.assign(`${API_BASE}/api/v1/auth/wechat/start`)
}
