// 霍兰德六型
export type HollandType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C'

export interface HollandScores {
  R: number  // 实际型
  I: number  // 研究型
  A: number  // 艺术型
  S: number  // 社会型
  E: number  // 企业型
  C: number  // 传统型
}

export interface SkillItem {
  name: string
  aiScore: number       // AI 初评分 1-100
  selfScore?: number    // 用户自评 1-100
  reason?: string       // 用户自评理由
  uncertain: boolean    // 是否待确定
  category?: string     // 来源：resume | ai追问 | user补充
}

export interface JobMatch {
  title: string
  match: number         // 0-100
  priority?: string     // AI 给出的投递优先级标签，如 "主攻方向"、"并行准备"、"看见就投"、"长期关注"
  reasons: string[]
  gaps: string[]
}

export interface AssessmentRecord {
  date: string              // ISO 时间戳
  hollandScores?: HollandScores
  skills: SkillItem[]
  jobMatches?: JobMatch[]
}

export interface ChatState {
  step: number          // 当前步骤 1-9
  hollandScores?: HollandScores
  preferences?: string
  skills: SkillItem[]
  pendingSkills: SkillItem[]  // 待确定框
  jobMatches?: JobMatch[]
  finalAdvice?: string
}
