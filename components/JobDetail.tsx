'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState } from 'react'
import type { JobMatch, SkillItem, HollandScores } from '@/lib/types'
import { renderMarkdown } from '@/lib/markdown'
import { loadJobReport, saveJobReport } from '@/lib/storage'

interface Props {
  job: JobMatch
  skills: SkillItem[]
  hollandScores?: HollandScores
  onBack: () => void
  onReportGenerated?: (title: string, content: string) => void
}

/** 从 UIMessage 的 parts 中提取纯文本 */
function getText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
}

/** 优先级徽章颜色 */
function priorityBadgeStyle(priority: string): { bg: string; text: string } {
  if (priority.includes('主攻')) return { bg: '#fef2f2', text: '#dc2626' }
  if (priority.includes('并行')) return { bg: '#fffbeb', text: '#d97706' }
  if (priority.includes('看见') || priority.includes('就投')) return { bg: '#eff6ff', text: '#2563eb' }
  if (priority.includes('长期')) return { bg: '#f3f4f6', text: '#6b7280' }
  return { bg: '#f8fafc', text: '#64748b' }
}

/** 精简版 prompt——适配 Netlify 10s 超时 */
function buildQuery(job: JobMatch, skills: SkillItem[], hollandScores?: HollandScores): string {
  const skillsSummary = skills
    .map((s) => `${s.name}(AI评分${s.aiScore}${s.selfScore ? `,自评${s.selfScore}` : ''})`)
    .join('；')

  const hollandSummary = hollandScores
    ? `R=${hollandScores.R} I=${hollandScores.I} A=${hollandScores.A} S=${hollandScores.S} E=${hollandScores.E} C=${hollandScores.C}`
    : '未测评'

  return `请为【${job.title}】生成一份精简的岗位分析报告。投递优先级：${job.priority || '未指定'}。匹配度：${job.match}%。

**全局约束：每模块 2-3 条要点，每条 1 句话。从第一个 ### 直接开始，不要在前面写任何开场白。**

按以下 6 个模块依次展开，每模块用小标题（###）：

### 📖 岗位概述
这个岗位是做什么的、核心价值是什么、在哪些行业/公司中常见。

### 💼 核心工作
这个岗位实际解决什么问题、每天主要做什么、最重要的产出是什么。

### ⭐ 你需要突出的能力
结合以下用户测评数据，指出面试和简历中最应强调的 2-3 项能力，并说明为什么：
- 霍兰德得分：${hollandSummary}
- 能力评估：${skillsSummary}
- 推荐理由：${job.reasons.join('、')}

### 🛤️ 准备路径
入行或转岗前需要补的知识/技能（2-3 项），每项附一个推荐学习资源。

### 📊 能力差距分析
将用户当前能力与岗位要求逐项对比，按差距优先级排列，给出补足建议。
- 需要补足：${job.gaps.join('、')}

### 🚀 下一步行动
2-3 条具体可执行的行动建议，每条一句话：做什么 + 怎么做。`
}

/** 完整版 prompt——本地重新生成时使用，无超时限制 */
function buildQueryFull(job: JobMatch, skills: SkillItem[], hollandScores?: HollandScores): string {
  const skillsSummary = skills
    .map((s) => `${s.name}(AI评分${s.aiScore}${s.selfScore ? `,自评${s.selfScore}` : ''})`)
    .join('；')

  const hollandSummary = hollandScores
    ? `R=${hollandScores.R} I=${hollandScores.I} A=${hollandScores.A} S=${hollandScores.S} E=${hollandScores.E} C=${hollandScores.C}`
    : '未测评'

  return `请为【${job.title}】生成一份详细的岗位分析报告。投递优先级：${job.priority || '未指定'}。匹配度：${job.match}%。

**全局约束：每模块 3-5 条要点，每条 1-2 句话。从第一个 ### 直接开始，不要在前面写任何开场白。**

按以下 6 个模块依次展开，每模块用小标题（###）：

### 📖 岗位概述
这个岗位是做什么的、核心价值是什么、在哪些行业/公司中常见。

### 💼 核心工作
这个岗位实际解决什么问题、每天主要做什么、最重要的产出是什么。

### ⭐ 你需要突出的能力
结合以下用户测评数据，指出面试和简历中最应强调的 3-5 项能力，并说明为什么：
- 霍兰德得分：${hollandSummary}
- 能力评估：${skillsSummary}
- 推荐理由：${job.reasons.join('、')}

### 🛤️ 准备路径
入行或转岗前需要补的知识/技能（3-5 项），每项附一个推荐学习资源。

### 📊 能力差距分析
将用户当前能力与岗位要求逐项对比，按差距优先级排列，给出补足建议。
- 需要补足：${job.gaps.join('、')}

### 🚀 下一步行动
3-5 条具体可执行的行动建议，每条一句话：做什么 + 怎么做。`
}

/** 将报告文本按 ### 标题拆分为分段 */
function splitSections(markdown: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = []
  const parts = markdown.split(/^### /gm)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const newlineIdx = trimmed.indexOf('\n')
    const title = newlineIdx > 0 ? trimmed.slice(0, newlineIdx).trim() : trimmed
    const body = newlineIdx > 0 ? trimmed.slice(newlineIdx + 1).trim() : ''
    sections.push({ title, body })
  }
  return sections
}

/** 每个模块的图标映射 */
function sectionIcon(title: string): string {
  if (title.includes('概述')) return '📖'
  if (title.includes('日常') || title.includes('核心')) return '💼'
  if (title.includes('突出') || title.includes('能力')) return '⭐'
  if (title.includes('准备') || title.includes('路径')) return '🛤️'
  if (title.includes('差距')) return '📊'
  if (title.includes('下一步') || title.includes('行动')) return '🚀'
  return '📌'
}

export default function JobDetail({ job, skills, hollandScores, onBack, onReportGenerated }: Props) {
  const matchColor = job.match >= 80 ? '#22c55e' : job.match >= 60 ? '#6366f1' : job.match >= 40 ? '#f59e0b' : '#ef4444'
  const badge = job.priority ? priorityBadgeStyle(job.priority) : null

  // 缓存的报告内容（优先从 localStorage 读取）
  const [cachedReport, setCachedReport] = useState<string | null>(() => {
    return loadJobReport(job.title)
  })

  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ step: 6, maxTokens: isLocal ? 8192 : undefined }),
    }),
  })

  // 0 = 首次加载，>0 = 重新生成次数
  const [regenerateCount, setRegenerateCount] = useState(0)

  useEffect(() => {
    if (regenerateCount === 0) {
      // 首次：优先读缓存
      const cached = loadJobReport(job.title)
      if (cached) {
        setCachedReport(cached)
        return
      }
    } else {
      // 重新生成：清空消息和缓存
      setMessages([])
      setCachedReport(null)
    }

    const query = regenerateCount > 0
      ? buildQueryFull(job, skills, hollandScores)
      : buildQuery(job, skills, hollandScores)

    requestAnimationFrame(() => {
      sendMessage({ text: query })
    })
  }, [regenerateCount])

  const handleRegenerate = () => {
    setRegenerateCount((k) => k + 1)
  }

  // 流式完成后才写入缓存（确保内容完整）
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current === 'streaming' && status === 'ready') {
      // 小延迟确保最后的消息已写入 messages 数组
      const timer = setTimeout(() => {
        const reportMessages = messages.filter((m) => m.role === 'assistant')
        const fullText = reportMessages.map((m) => getText(m.parts)).join('\n\n')
        if (fullText.trim().length > 200) {
          saveJobReport(job.title, fullText)
          setCachedReport(fullText)
          onReportGenerated?.(job.title, fullText)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = status
  }, [status, messages, job.title])

  const bottomRef = useRef<HTMLDivElement>(null)
  const isBusy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (!isBusy) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isBusy, cachedReport])

  // 展示内容：优先缓存，其次流式
  const reportMessages = messages.filter((m) => m.role === 'assistant')
  const displayContent = cachedReport
    ? cachedReport
    : reportMessages.map((m) => getText(m.parts)).join('\n\n')

  const hasContent = displayContent.trim().length > 0
  const sections = hasContent ? splitSections(displayContent) : []

  return (
    <div className="absolute inset-0 z-50 bg-bg flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-bg transition-colors text-text-muted"
          aria-label="返回主对话"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {badge && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ color: badge.text, backgroundColor: badge.bg }}
            >
              {job.priority}
            </span>
          )}
          <span className="text-sm font-semibold text-text truncate">{job.title}</span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: matchColor, backgroundColor: `${matchColor}18` }}
        >
          {job.match}% 匹配
        </span>
        {isLocal && (
          <button
            onClick={handleRegenerate}
            disabled={isBusy}
            title="重新生成完整报告（本地不限时）"
            className="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-muted hover:text-primary hover:border-primary/40 disabled:opacity-30 transition-colors flex-shrink-0"
          >
            {isBusy ? '生成中...' : '重新生成'}
          </button>
        )}
      </div>

      {/* 报告内容区 */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* 加载态 */}
        {!hasContent && isBusy && (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
            <p className="text-sm">正在生成岗位分析报告...</p>
          </div>
        )}

        {/* 失败态 */}
        {!hasContent && !isBusy && (
          <div className="text-center py-10">
            <p className="text-text-muted text-sm">报告生成失败，请返回重试</p>
          </div>
        )}

        {/* 分段卡片 */}
        {hasContent && sections.length > 0 && (
          <div className="space-y-4">
            {sections.map((section, i) => (
              <div
                key={i}
                className="bg-white border border-border rounded-xl shadow-sm overflow-hidden"
              >
                {/* 模块标题栏 */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/70 border-b border-border/60">
                  <span className="text-sm">{sectionIcon(section.title)}</span>
                  <h3 className="text-[13px] font-semibold text-text">{section.title}</h3>
                </div>
                {/* 模块内容 */}
                <div className="px-4 py-3">
                  <div className="prose prose-sm max-w-none text-[12px] leading-relaxed text-text-muted
                    prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5
                    prose-li:my-0.5
                    prose-strong:text-text
                    [&_ul]:list-none [&_ul]:pl-0
                    [&_ul>li]:relative [&_ul>li]:pl-4
                    [&_ul>li::before]:content-['•'] [&_ul>li::before]:absolute [&_ul>li::before]:left-0 [&_ul>li::before]:text-primary/60
                  ">
                    {renderMarkdown(section.body)}
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}

        {/* 无分段时的回退：整段渲染 */}
        {hasContent && sections.length === 0 && (
          <div className="bg-white border border-border rounded-xl shadow-sm px-5 py-4">
            <div className="prose prose-sm max-w-none text-text">
              {renderMarkdown(displayContent)}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 底部提示 */}
      <div className="border-t border-border bg-surface p-3 flex-shrink-0">
        <p className="text-[11px] text-text-muted text-center leading-relaxed">
          以上内容基于 AI 知识库与网络公开信息生成，可能与具体岗位实际情况存在出入。建议结合招聘网站上的具体 JD 和行业人士的建议进一步核实。
        </p>
      </div>
    </div>
  )
}
