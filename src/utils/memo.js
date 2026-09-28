/**
 * 备忘前端工具：农历中文映射、卡片日期文案、提交 payload 组装。
 */

/* ---------- 农历中文 ---------- */

export const LUNAR_MONTHS = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月',
]

export const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五',
  '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五',
  '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五',
  '廿六', '廿七', '廿八', '廿九', '三十',
]

export function lunarMonthName(month, leap) {
  const name = LUNAR_MONTHS[Number(month) - 1] || ''
  if (!name) return ''
  return `${leap ? '闰' : ''}${name}`
}

export function lunarDayName(day) {
  return LUNAR_DAYS[Number(day) - 1] || ''
}

/* ---------- 日期解析 / 格式化 ---------- */

/** "2006-01-02" → 本地时区 Date（避免 UTC 偏移导致差一天） */
export function parseDay(s) {
  if (!s) return null
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** "2006-01-02" → "2006年1月2日" */
export function formatCNDay(s) {
  const d = parseDay(s)
  if (!d) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** "2006-01-02" → "11月15日" */
export function formatShortDay(s) {
  const d = parseDay(s)
  if (!d) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** next_date 距今天的天数（自然日差，可能为负） */
export function daysUntil(day) {
  const d = parseDay(day)
  if (!d) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d - today) / 86400000)
}

/** RFC3339 时间 → "9月27日"（解析失败回退原文） */
export function formatUpdatedAt(s) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s || ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/* ---------- 卡片文案 ---------- */

export const REPEAT_TEXT = {
  yearly: '每年',
  monthly: '每月',
  daily: '每日',
  once: '单次',
}

/** 卡片大字日期：农历→「五月廿五」；solar yearly→「10月23日」；monthly→「每月 8 日」；daily→「每日」；once→「11月15日」 */
export function bigDateText(memo) {
  if (memo.date_type === 'lunar') {
    return `${lunarMonthName(memo.lunar_month, memo.lunar_leap)}${lunarDayName(memo.lunar_day)}`
  }
  switch (memo.repeat) {
    case 'monthly':
      return `每月 ${memo.day} 日`
    case 'daily':
      return '每日'
    case 'once':
      return formatShortDay(memo.once_date) || '某天'
    default:
      return `${memo.month}月${memo.day}日`
  }
}

/** 类型胶囊文案：「农历 · 每年」 */
export function kindText(memo) {
  const kind = memo.date_type === 'lunar' ? '农历' : '阳历'
  return `${kind} · ${REPEAT_TEXT[memo.repeat] || memo.repeat}`
}

/** 保存 / 更新时的全量字段 payload */
export function toPayload(memo) {
  return {
    title: memo.title,
    content: memo.content || '',
    date_type: memo.date_type || 'solar',
    repeat: memo.repeat || 'yearly',
    month: Number(memo.month) || 1,
    day: Number(memo.day) || 1,
    lunar_month: Number(memo.lunar_month) || 1,
    lunar_day: Number(memo.lunar_day) || 1,
    lunar_leap: !!memo.lunar_leap,
    advance_offsets: normalizeOffsets(memo.advance_offsets),
    once_date: memo.once_date || '',
    enabled: !!memo.enabled,
  }
}

/** 去重、去非法值、升序；空则兜底 [0] */
export function normalizeOffsets(offsets) {
  const set = new Set()
  for (const o of Array.isArray(offsets) ? offsets : []) {
    const n = Number(o)
    if (Number.isInteger(n) && n >= 0) set.add(n)
  }
  if (!set.size) set.add(0)
  return [...set].sort((a, b) => a - b)
}
