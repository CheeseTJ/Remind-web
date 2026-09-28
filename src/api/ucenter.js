/**
 * Ucenter 认证客户端 —— 仿照 Ucenter/web/src/shared/api.ts。
 *
 * 本服务只认 Authorization 头里的 Bearer 令牌，不依赖 Cookie，
 * 所以令牌存 localStorage，跨域请求不需要 credentials。
 */

// 默认指向线上用户中心；本地联调时用 .env 里的 VITE_UCENTER_BASE 覆盖
export const BASE =
  (import.meta.env.VITE_UCENTER_BASE || 'https://ucenter.june-t.top').replace(/\/+$/, '')

/** 本端在用户中心注册的应用标识，决定 JWT 的 aud */
export const APP = 'remind'

const KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
  device: 'device_id',
}

/* ---------- 令牌与设备号 ---------- */

function lsGet(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    // 隐私模式下 localStorage 可能不可用
    return ''
  }
}

function lsSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* 同上 */
  }
}

export function getToken() {
  return lsGet(KEYS.access)
}

function getRefreshToken() {
  return lsGet(KEYS.refresh)
}

function setTokens(pair) {
  lsSet(KEYS.access, pair.access_token || '')
  lsSet(KEYS.refresh, pair.refresh_token || '')
}

/** 只清登录态，保留设备号：设备号是「同一台设备」的身份，换账号也该延续 */
export function clearTokens() {
  lsSet(KEYS.access, '')
  lsSet(KEYS.refresh, '')
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  // 非 secure context 下 randomUUID 可能缺失，手写 v4 兜底
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * 设备号持久化。用户中心靠它把令牌归到同一台设备下，
 * 便于在「我的设备」里单独吊销某一台。
 */
export function deviceId() {
  let id = lsGet(KEYS.device)
  if (!id) {
    id = uuid()
    lsSet(KEYS.device, id)
  }
  return id
}

/* ---------- 错误 ---------- */

/** 统一错误形态：{ code, message }，附带 HTTP status 便于调用方细分 */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function parse(res) {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data || {}
    throw new ApiError(
      res.status,
      err.code || err.error || 'request_failed',
      err.message || err.error || `请求失败 ${res.status}`
    )
  }
  return data
}

/* ---------- 令牌续签（单飞） ---------- */

let refreshing = null

/**
 * 刷新令牌是一次性的，并发复用会被服务端判为泄露并吊销整条链，
 * 所以这里做单飞：同一时刻只发一次刷新请求，其余 401 等它落盘后重试。
 */
export function refreshTokens() {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function doRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new ApiError(401, 'no_refresh_token', '未登录')

  const res = await fetch(`${BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, app: APP }),
  })
  const pair = await parse(res)
  setTokens(pair)
}

/** 登录态失效兜底：清本地令牌并整页跳回 /login（history 路由） */
function expireSession() {
  clearTokens()
  window.location.assign('/login')
}

/* ---------- 请求出口 ---------- */

/**
 * 带认证的请求核心：带 Bearer；401 时单飞刷新后重试原请求一次，
 * 刷新也失败则清令牌跳登录。ucenter 与 remind 的接口都走这里，
 * 保证全局只有一条刷新单飞。
 */
export async function authFetch(url, options = {}) {
  const { method = 'GET', body } = options

  const send = () => {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let res = await send()
  if (res.status === 401) {
    try {
      await refreshTokens()
      res = await send()
    } catch {
      expireSession()
      throw new ApiError(401, 'session_expired', '登录已过期，请重新登录')
    }
  }
  return parse(res)
}

/** Ucenter 接口专用出口（相对路径，自动拼 BASE） */
export function ucenterFetch(path, options) {
  return authFetch(BASE + path, options)
}

/* ---------- 接口封装 ---------- */

/**
 * 登录。成功后令牌落盘并返回 user（{ id, email }）。
 * 服务端响应：{ user, access_token, refresh_token, device_id }
 */
export async function login(email, password) {
  const data = await ucenterFetch('/v1/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
      app: APP,
      device_id: deviceId(),
      device_name: 'remind-web',
      platform: 'web',
    },
  })
  setTokens(data)
  if (data.device_id) lsSet(KEYS.device, data.device_id)
  return data.user
}

/** 登出：尽力通知服务端吊销刷新令牌，无论成败都清本地登录态 */
export async function logout() {
  const refreshToken = getRefreshToken()
  clearTokens()
  if (!refreshToken) return
  try {
    await fetch(`${BASE}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    /* 旁路请求，失败不影响本地登出 */
  }
}
