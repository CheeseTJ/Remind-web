/**
 * Remind 业务接口（同源 /api，dev 下由 vite 代理到 :8085）。
 * 认证与 401 刷新单飞复用 ucenter.js 的 authFetch。
 */
import { authFetch } from './ucenter'

// API 根地址：同源部署（单二进制内嵌）时为空（走 /api 相对路径 + vite 代理）；
// 前后端分离部署（remind.taojun.top → remind.june-t.top）时由 VITE_API_BASE 注入
const ROOT = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

const BASE = `${ROOT}/api/memos`

export function listMemos() {
  return authFetch(BASE)
}

/** 单条备忘：{ ...memo } 或 404 */
export function getMemo(id) {
  return authFetch(`${BASE}/${id}`)
}

export function createMemo(data) {
  return authFetch(BASE, { method: 'POST', body: data })
}

export function updateMemo(id, data) {
  return authFetch(`${BASE}/${id}`, { method: 'PUT', body: data })
}

export function removeMemo(id) {
  return authFetch(`${BASE}/${id}`, { method: 'DELETE' })
}

/** 站点元信息：{ app_name, daily_send_time, timezone } */
export function getMeta() {
  return authFetch(`${ROOT}/api/meta`)
}

/** 立即给当前用户发一封测试提醒邮件 */
export function sendTestEmail() {
  return authFetch(`${ROOT}/api/test-email`, { method: 'POST' })
}
