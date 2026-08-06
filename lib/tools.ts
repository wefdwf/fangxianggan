import { tool } from 'ai'
import { z } from 'zod'

/**
 * 客户端 UI 工具定义
 *
 * 这些工具由 AI 在对话中调用，触发前端渲染对应的交互组件。
 * 无 execute 函数——工具调用由 ChatArea 的 onToolCall 处理并通过 addToolOutput 返回结果。
 */

// skill-item schema（复用）
const skillItem = z.object({
  name: z.string().describe('能力名称'),
  aiScore: z.number().min(1).max(100).describe('AI 初评分 (1-100)'),
  reason: z.string().optional().describe('AI 初评的简短理由'),
})

// job-match schema（复用）
const jobMatch = z.object({
  title: z.string().describe('岗位名称'),
  match: z.number().min(0).max(100).describe('匹配度百分比'),
  priority: z.string().optional().describe('投递优先级标签，如：主攻方向、并行准备、看见就投、长期关注'),
  reasons: z.array(z.string()).describe('推荐理由列表'),
  gaps: z.array(z.string()).describe('能力差距列表'),
})

export const clientTools = {
  /** Step 1: 显示霍兰德职业兴趣测评（24 题交互问卷 + 雷达图） */
  showHollandAssessment: tool({
    description:
      '显示霍兰德职业兴趣测评（RIASEC 六型）的 24 题交互问卷。在 Step 1 使用。' +
      '用户完成测评后会看到雷达图结果。注意：调用此工具前，先用文字简单介绍什么是霍兰德测评。',
    inputSchema: z.object({}),
  }),

  /** Step 4 & Step 8: 显示能力自评表格 */
  showSelfAssessment: tool({
    description:
      '显示能力自评表格，包含 AI 初评分和滑块供用户自评。' +
      '在 Step 4（简历能力提取后）和 Step 8（综合评分调整后）使用。' +
      'skills 数组包含 AI 从简历/对话中提取的每项能力及其初评分和理由。',
    inputSchema: z.object({
      skills: z.array(skillItem).min(1).describe('能力列表，3-5 项'),
    }),
  }),

  /** Step 8 & Step 9: 显示综合结果面板（词云 + 岗位匹配卡片） */
  showResults: tool({
    description:
      '显示综合结果面板，包含能力词云、岗位匹配卡片（匹配度百分比 + 推荐理由 + 差距分析）。' +
      '在 Step 8（综合建议）和 Step 9（确认意向）使用。' +
      'confirmed=false：预览模式，结果仅展示在聊天区，不更新侧边栏。' +
      'confirmed=true：用户已确认意向岗位，结果会同步到左侧边栏。' +
      '用户确认意向后，只输出用户选中的岗位，且 confirmed 必须设为 true。',
    inputSchema: z.object({
      skills: z
        .array(
          z.object({
            name: z.string(),
            aiScore: z.number().optional(),
            selfScore: z.number().optional(),
            finalScore: z.number().optional(),
            uncertain: z.boolean().optional(),
          })
        )
        .optional()
        .describe('最终能力评分列表（用于词云）'),
      jobMatches: z.array(jobMatch).optional().describe('岗位匹配列表'),
      confirmed: z
        .boolean()
        .optional()
        .describe('是否用户已确认意向岗位。false=预览（不更新侧边栏），true=确认（同步到侧边栏）。默认 false。'),
    }),
  }),

  /** 步骤同步：每条回复末尾调用，驱动前端进度条 */
  setStep: tool({
    description:
      '更新当前探索步骤编号（1-6），驱动前端进度条同步。每条回复的末尾必须调用此工具。' +
      '步骤列表：1=霍兰德测评, 2=偏好输入+爱好反思, 3=简历能力提取, 4=能力自评+追问+自由补充, 5=综合评分+岗位推荐, 6=确认意向',
    inputSchema: z.object({
      step: z.number().int().min(1).max(6).describe('当前步骤编号 (1-6)'),
    }),
  }),
}
