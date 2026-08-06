import type { ChatState, AssessmentRecord } from './types'

const KEY = 'fangxianggan_state'
const MSG_KEY = 'fangxianggan_messages'
const ASSESS_KEY = 'fangxianggan_assessments'

const DEFAULT: ChatState = {
  step: 1,
  skills: [],
  pendingSkills: [],
}

export function loadState(): ChatState {
  if (typeof window === 'undefined') return { ...DEFAULT }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveState(state: ChatState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // localStorage 满了或不可用，静默失败
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

// ---- 聊天消息持久化 ----

/** 保存聊天消息到 localStorage（最多保留 200 条，防爆） */
export function saveMessages(messages: unknown[]): void {
  if (typeof window === 'undefined') return
  try {
    // 只保留最近 200 条
    const toSave = messages.length > 200 ? messages.slice(-200) : messages
    localStorage.setItem(MSG_KEY, JSON.stringify(toSave))
  } catch {
    // 静默失败
  }
}

/** 从 localStorage 加载聊天消息 */
export function loadMessages(): unknown[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MSG_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 清除聊天消息 */
export function clearMessages(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(MSG_KEY)
  } catch {
    // ignore
  }
}

// ---- 测评历史持久化（最多保留 3 条，清除聊天不动这里） ----

/** 保存一条测评记录，保留最近 3 条 */
export function saveAssessment(record: AssessmentRecord): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadAssessments()
    existing.unshift(record)
    localStorage.setItem(ASSESS_KEY, JSON.stringify(existing.slice(0, 3)))
  } catch {
    // 静默失败
  }
}

/** 加载全部测评历史（最多 3 条） */
export function loadAssessments(): AssessmentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ASSESS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 获取最近一条测评记录 */
export function getLatestAssessment(): AssessmentRecord | null {
  const all = loadAssessments()
  return all.length > 0 ? all[0] : null
}

// ---- 岗位分析报告缓存（持久化，清除记录时一并清理） ----

const REPORT_CACHE_KEY = 'fangxianggan_job_reports'

/** 保存单个岗位的分析报告 */
export function saveJobReport(title: string, content: string): void {
  if (typeof window === 'undefined') return
  try {
    const all = loadAllJobReports()
    all[title] = content
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(all))
  } catch {
    // 静默失败
  }
}

/** 读取单个岗位的分析报告，无缓存返回 null */
export function loadJobReport(title: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const all = loadAllJobReports()
    return all[title] ?? null
  } catch {
    return null
  }
}

/** 读取全部岗位报告缓存 */
function loadAllJobReports(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(REPORT_CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** 清除全部岗位报告缓存 */
export function clearJobReports(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(REPORT_CACHE_KEY)
  } catch {
    // ignore
  }
}
