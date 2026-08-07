'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useRef, useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { HollandScores, SkillItem, JobMatch } from '@/lib/types'
import { loadMessages, saveMessages, loadAssessments, saveAssessment, getLatestAssessment } from '@/lib/storage'
import { fetchMessages, replaceMessages, saveAssessmentCloud } from '@/lib/cloud-storage'
import ChatBubble from './ChatBubble'
import HollandAssessment from './HollandAssessment'
import SelfAssessment from './SelfAssessment'
import ResultsPanel from './ResultsPanel'

interface Props {
  conversationId: string | null
  step: number
  hollandScores?: HollandScores
  skills: SkillItem[]
  jobMatches: JobMatch[]
  onStepChange: (step: number) => void
  onHollandComplete: (scores: HollandScores) => void
  onSkillsUpdate: (skills: SkillItem[]) => void
  onPendingUpdate: (skills: SkillItem[]) => void
  onJobMatchesUpdate: (jobs: JobMatch[]) => void
  jumpTarget: number | null
  onJumpDone: () => void
  jobQuery: string | null
  onJobQueryDone: () => void
}

// ─── 工具函数 ───

/** 从 UIMessage parts 中提取纯文本 */
function getText(parts: ReadonlyArray<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
}

/**
 * 从消息 parts 中查找指定工具的调用输入。
 * 工具调用 part 的 type 格式为 `tool-${toolName}`，state 为 'call'。
 */
function getToolCallInput<T = unknown>(
  parts: ReadonlyArray<{ type: string; input?: unknown; state?: string }>,
  toolName: string
): T | null {
  const part = parts.find(
    (p) => p.type === `tool-${toolName}` && p.state === 'call'
  )
  if (!part || !part.input) return null
  return part.input as T
}

// ─── 文字回退：从 AI 文本中提取 JSON（向后兼容低版本 AI 或不支持 tool-call 的模型）───

/** 从 content[pos] 开始，跳过 JSON 字符串，找到配对的 } 并返回位置 */
function findMatchingBrace(content: string, pos: number): number {
  let depth = 0
  let inString = false
  for (let i = pos; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === '"') { inString = false }
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') { depth++ }
    else if (ch === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** 尝试从文本中提取 JSON 对象（三反引号、单反引号、裸 JSON 三种策略） */
function tryExtractJson(content: string): Record<string, unknown> | null {
  // S1: ```json\n...\n```
  const tripleMatch = content.match(/```(?:json)?\s*\r?\n/)
  if (tripleMatch && tripleMatch.index !== undefined) {
    const afterMarker = tripleMatch.index + tripleMatch[0].length
    const openBrace = content.indexOf('{', afterMarker)
    if (openBrace >= 0) {
      const jsonEnd = findMatchingBrace(content, openBrace)
      if (jsonEnd >= 0) {
        try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) } catch { /* fall through */ }
      }
    }
  }
  // S2: `json {...}` 或 `{...}`
  const backtickMatch = content.match(/`(?:json\s*)?\{/)
  if (backtickMatch && backtickMatch.index !== undefined) {
    const openBrace = backtickMatch.index + backtickMatch[0].length - 1
    const jsonEnd = findMatchingBrace(content, openBrace)
    if (jsonEnd >= 0) {
      try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) } catch { /* fall through */ }
    }
  }
  // S3: 裸 JSON {"skills"... 或 {"jobMatches"...
  const bareMatch = content.match(/\{\s*"(?:skills|jobMatches|matches)"/)
  if (bareMatch && bareMatch.index !== undefined) {
    const openBrace = bareMatch.index
    const jsonEnd = findMatchingBrace(content, openBrace)
    if (jsonEnd >= 0) {
      try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) } catch { /* fall through */ }
    }
  }
  return null
}

/** 从文本中提取 skills */
function extractSkillsFromText(content: string): SkillItem[] | null {
  const parsed = tryExtractJson(content)
  if (parsed && parsed.skills && Array.isArray(parsed.skills)) {
    return parsed.skills as SkillItem[]
  }
  return null
}

/** 从文本中提取 results（skills + jobMatches） */
function extractResultsFromText(content: string): { skills: SkillItem[]; jobMatches: JobMatch[] } {
  const parsed = tryExtractJson(content)
  if (parsed) {
    return {
      skills: (parsed.skills as SkillItem[]) || [],
      jobMatches: (parsed.jobMatches || parsed.matches || []) as JobMatch[],
    }
  }
  return { skills: [], jobMatches: [] }
}

// ─── 组件 ───

export default function ChatArea({
  conversationId,
  step,
  hollandScores,
  skills,
  jobMatches,
  onStepChange,
  onHollandComplete,
  onSkillsUpdate,
  onPendingUpdate,
  onJobMatchesUpdate,
  jumpTarget,
  onJumpDone,
  jobQuery,
  onJobQueryDone,
}: Props) {
  // 用 ref 跟踪最新 step，确保 body 函数每次都能取到最新值
  const stepRef = useRef(step)
  stepRef.current = step

  const { messages, sendMessage, status, setMessages, addToolOutput } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ step: stepRef.current, assessmentHistory: loadAssessments() }),
    }),
    /** 当 AI 调用客户端工具时触发——更新进度条和侧边栏，然后返回结果让流继续 */
    async onToolCall({ toolCall }) {
      // setStep → 同步进度条
      if (toolCall.toolName === 'setStep') {
        const input = toolCall.input as { step: number }
        if (input.step >= 1 && input.step <= 6 && input.step !== stepRef.current) {
          onStepChange(input.step)
          stepRef.current = input.step
        }
        addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: 'ok' })
        return
      }

      // showResults → 仅在 confirmed 时更新侧边栏 + 保存测评历史
      if (toolCall.toolName === 'showResults') {
        const input = toolCall.input as {
          skills?: SkillItem[]
          jobMatches?: JobMatch[]
          confirmed?: boolean
        }
        // 只有用户确认意向后（confirmed=true）才更新侧边栏岗位列表
        if (input.confirmed && input.jobMatches && input.jobMatches.length > 0) {
          onJobMatchesUpdate(input.jobMatches)
        }
        // 保存测评历史（本地 + 云端双写）
        const latest = getLatestAssessment()
        const record = {
          date: new Date().toISOString(),
          hollandScores: latest?.hollandScores ?? hollandScores,
          skills: input.skills || latest?.skills || skills,
          jobMatches: input.jobMatches || [],
        }
        saveAssessment(record)
        saveAssessmentCloud(record).catch((err) =>
          console.error('云端测评保存失败:', err)
        )
        addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: 'ok' })
        return
      }

      // showHollandAssessment / showSelfAssessment：纯 UI 触发，不需额外处理
      addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: 'ok' })
    },
    onError(error) {
      console.error('[方向感] 对话请求失败:', error)
    },
  })

  // 客户端挂载后：本地消息优先（本地只有欢迎消息时除外，走云端）
  useEffect(() => {
    const init = async () => {
      const saved = loadMessages() as UIMessage[]

      // 判断本地是否只有欢迎消息（防止空记录覆盖云端真实对话）
      const onlyWelcome = saved.length === 1 && saved[0].id === 'welcome'

      if (conversationId) {
        try {
          if (saved.length > 0 && !onlyWelcome) {
            // 本地有真实消息 → 用本地，上传覆盖云端（等上传完成）
            setMessages(saved)
            try {
              await replaceMessages(conversationId, saved)
              console.log('[方向感] 本地消息已上传云端，共', saved.length, '条')
            } catch (err) {
              console.error('[方向感] 云端消息上传失败:', err)
            }
            return
          }
          // 本地空/仅欢迎消息 → 用云端
          const cloudMsgs = await fetchMessages(conversationId)
          if (cloudMsgs.length > 0) {
            setMessages(cloudMsgs)
            return
          }

          // 云端也无消息，但进度 > 1 → 诊断提示（消息同步可能失败）
          if (cloudMsgs.length === 0 && step > 1) {
            setMessages([
              {
                id: 'sync-missing',
                role: 'assistant' as const,
                parts: [{
                  type: 'text' as const,
                  text: `⚠️ **云端同步诊断**

你的进度已保存（第 ${step} 步），但**聊天消息未能从云端加载**。

**修复步骤：**
1. 在**桌面端**重新打开方向感并登录
2. 确认控制台出现 \`[方向感] 本地消息已上传云端，共 X 条\`
3. 回到**本页面**刷新

如果桌面端控制台报错，请截图给我。`,
                }],
                createdAt: new Date(),
              } as UIMessage,
            ])
            return
          }
        } catch (err) {
          console.error('云端消息加载失败:', err)
        }
      }

      if (saved.length > 0) {
        setMessages(saved)
        return
      }
      // 全新用户：显示欢迎消息
      setMessages([
        {
          id: 'welcome',
          role: 'assistant' as const,
          parts: [{
            type: 'text' as const,
            text: '你好！我是**方向感**，你的 AI 职业探索助手 👋\n\n我会通过 **6 个步骤** 帮你系统梳理职业方向：\n\n1. 🧭 **霍兰德测评** — 了解你的职业兴趣类型\n2. 💬 **偏好与爱好** — 你喜欢什么、适合什么\n3. 📄 **简历能力提取** — 从经历中提炼核心能力\n4. 📊 **自评+补充** — 给自己打分，查漏补缺\n5. 🎯 **评分+推荐** — 岗位推荐 + 匹配度分析\n6. ✅ **确认意向** — 选中目标岗位，保存到侧边栏\n\n**我能帮你做的事：**\n- 职业方向探索与岗位匹配\n- 能力评估与差距分析\n- 具体岗位的深度分析报告\n- 简历中能力的提炼与定位\n\n**我做不到的事：**\n- 修改或撰写完整简历\n- 模拟面试\n- 内推或投递岗位\n- 其他与职业探索无关的事\n\n不用紧张，就像和朋友聊天一样自然。\n\n**先跟我介绍一下你自己吧**——你的专业、兴趣、目前在忙什么，想到什么说什么！'
          }],
          createdAt: new Date(),
        } as UIMessage,
      ])
    }
    init()
  }, [conversationId])

  // 云消息保存防抖 timer
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 每次消息变化时自动保存到 localStorage + 云端（防抖 2s）
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages)
      if (conversationId) {
        if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current)
        cloudSaveTimerRef.current = setTimeout(() => {
          replaceMessages(conversationId, messages).catch((err) =>
            console.error('云端消息保存失败:', err)
          )
        }, 2000)
      }
    }
  }, [messages, conversationId])

  // 外部跳步：侧边栏点击步骤时触发
  useEffect(() => {
    if (jumpTarget === null) return
    stepRef.current = jumpTarget
    onStepChange(jumpTarget)
    const stepLabels = [
      '霍兰德测评', '偏好输入', '爱好反思', '简历能力提取',
      '能力自评+追问', '自由补充', '综合评分', '综合建议', '确认意向',
    ]
    const label = stepLabels[jumpTarget - 1]
    sendMessage({ text: `（跳转到第${jumpTarget}步：${label}。请从这里开始引导我。）` })
    onJumpDone()
  }, [jumpTarget])

  // 外部职位查询：侧边栏点击职位时触发
  useEffect(() => {
    if (jobQuery === null) return
    sendMessage({ text: jobQuery })
    onJobQueryDone()
  }, [jobQuery])

  // 文字回退：当 AI 没用 tool-call 但在文本中输出了 jobMatches JSON 时，同步到侧边栏
  const processedJobsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role !== 'assistant') continue
      if (processedJobsRef.current.has(m.id)) continue
      // 先检查是否有 tool-call；有 tool-call 的由 onToolCall 处理，这里跳过
      const hasResultsToolCall = getToolCallInput(m.parts, 'showResults') !== null
      if (hasResultsToolCall) {
        processedJobsRef.current.add(m.id)
        continue
      }
      // 文字回退：只在 Step 9（确认意向）时才更新侧边栏，预览阶段不写入
      const { jobMatches: jobs } = extractResultsFromText(getText(m.parts))
      if (jobs.length > 0) {
        processedJobsRef.current.add(m.id)
        // step >= 6 才认为是确认后的结果，避免预览阶段的岗位误入侧边栏
        if (step >= 6) {
          onJobMatchesUpdate(jobs)
        }
        const latest = getLatestAssessment()
        const record = {
          date: new Date().toISOString(),
          hollandScores: latest?.hollandScores ?? hollandScores,
          skills: latest?.skills || skills,
          jobMatches: jobs,
        }
        saveAssessment(record)
        saveAssessmentCloud(record).catch((err) => console.error('云端测评保存失败:', err))
        break
      }
    }
  }, [messages])

  const [input, setInput] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isBusy = status === 'submitted' || status === 'streaming'
  // 记录用户是否在底部附近（用于判断是否自动滚到底部）
  const nearBottomRef = useRef(true)

  /** 判断滚动容器是否接近底部 */
  function checkNearBottom() {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  /** 处理用户手动滚动：更新 nearBottom 状态 */
  const handleScroll = () => {
    nearBottomRef.current = checkNearBottom()
  }

  useEffect(() => {
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isBusy) return
    nearBottomRef.current = true
    sendMessage({ text: trimmed })
    setInput('')
    // 对话步骤自动推进：步骤 2/4 在用户每次发消息后 +1
    const autoAdvanceSteps = [2, 4]
    if (autoAdvanceSteps.includes(stepRef.current)) {
      const next = stepRef.current + 1
      onStepChange(next)
      stepRef.current = next
    }
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  /** 解析 PDF 文件，提取纯文本 */
  const parsePDF = async (file: File): Promise<string> => {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const texts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter((item: unknown) => (item as { str?: string }).str != null)
        .map((item: unknown) => (item as { str: string }).str)
        .join(' ')
      texts.push(pageText)
    }
    return texts.join('\n\n')
  }

  /** 简历文件上传 */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      if (ext === 'pdf') {
        const text = await parsePDF(file)
        if (!text.trim()) {
          alert('PDF 中未提取到文字（可能是扫描件或图片型 PDF），请直接粘贴简历内容')
          return
        }
        setUploadedFileName(file.name)
        setInput((prev) => {
          const separator = prev.trim() ? '\n\n--- 简历内容（从 PDF 提取）---\n' : ''
          return prev + separator + text.slice(0, 8000)
        })
      } else if (ext === 'txt') {
        const text = await file.text()
        setUploadedFileName(file.name)
        setInput((prev) => {
          const separator = prev.trim() ? '\n\n--- 简历内容 ---\n' : ''
          return prev + separator + text.slice(0, 8000)
        })
      } else if (ext === 'doc' || ext === 'docx') {
        alert('暂不支持 Word 文档直接解析。请将简历内容复制粘贴到输入框，或转换为 PDF/TXT 后上传')
        return
      } else {
        alert('不支持的文件格式，请上传 PDF 或 TXT 文件')
        return
      }
    } catch (err) {
      console.error('文件解析失败:', err)
      alert('文件解析失败，请重试或直接粘贴内容')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** 清除已上传的文件内容 */
  const clearUploadedFile = () => {
    setUploadedFileName(null)
    setInput((prev) => {
      const idx = prev.indexOf('\n\n--- 简历内容')
      if (idx === -1) return ''
      return prev.slice(0, idx).trimEnd()
    })
  }

  /** 编辑用户消息：截断该消息及之后的所有消息，重新发送 */
  const handleEdit = (messageId: string, newText: string) => {
    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return
    setMessages(messages.slice(0, idx))
    requestAnimationFrame(() => {
      sendMessage({ text: newText })
    })
  }

  /** 回退到指定消息：保留该消息及之前的内容，删除之后所有消息 */
  const handleRollback = (messageId: string) => {
    const idx = messages.findIndex((m) => m.id === messageId)
    if (idx === -1) return
    setMessages(messages.slice(0, idx + 1))
    requestAnimationFrame(() => {
      sendMessage({ text: '（从这里继续，请接着上面的内容引导我下一步。）' })
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 && (
          <div className="text-center text-text-muted mt-20">
            <p className="text-lg font-medium mb-2">你好，我是方向感</p>
            <p className="text-sm">AI 职业探索助手，帮你找到适合自己的方向</p>
            <p className="text-sm mt-1">开始聊聊你自己吧——不用很正式，想到什么说什么</p>
          </div>
        )}

        {/* 去重：同名 ID 只保留最后一条（修复 localStorage 恢复时的重复 bug） */}
        {(() => {
          const seen = new Map<string, number>()
          const deduped: typeof messages = []
          for (let idx = messages.length - 1; idx >= 0; idx--) {
            if (!seen.has(messages[idx].id)) {
              seen.set(messages[idx].id, idx)
              deduped.unshift(messages[idx])
            }
          }
          return deduped
        })().map((m) => {
          // 纯文本内容（排除工具调用 parts）
          const content = getText(m.parts)

          // ── 检测组件触发条件（tool-call 优先，文字回退兜底）──
          const hollandInput =
            m.role === 'assistant'
              ? getToolCallInput<Record<string, never>>(m.parts, 'showHollandAssessment')
              : null
          const selfAssessmentInput =
            m.role === 'assistant'
              ? getToolCallInput<{ skills: SkillItem[] }>(m.parts, 'showSelfAssessment')
              : null
          const resultsInput =
            m.role === 'assistant'
              ? getToolCallInput<{
                  skills?: SkillItem[]
                  jobMatches?: JobMatch[]
                }>(m.parts, 'showResults')
              : null

          // 文字回退：AI 没用 tool-call 时，尝试从文本中解析标记和 JSON
          const hasHollandMarker = /<!--\s*HOLLAND_ASSESSMENT\s*-->/i.test(content)
          const hasSelfAssessmentMarker = /<!--\s*SELF_ASSESSMENT\s*-->/i.test(content)
          const hasResultsMarker = /<!--\s*RESULTS\s*-->/i.test(content)
          const fallbackSkills = extractSkillsFromText(content)
          const fallbackResults = extractResultsFromText(content)

          const showHolland = hollandInput !== null || hasHollandMarker
          const showResults = resultsInput !== null || fallbackResults.jobMatches.length > 0 || fallbackResults.skills.length > 0 || hasResultsMarker
          // 优先 results：如果同时有 results 标记/数据，就不显示 self-assessment
          const showSelf = !showResults && (selfAssessmentInput !== null || fallbackSkills !== null || hasSelfAssessmentMarker)

          // 清理消息中的标记和 JSON 代码块（tool-call 消息不会有这些，但文字回退的会有）
          const cleanContent = content
            .replace(/<!--\s*HOLLAND_ASSESSMENT\s*-->/gi, '')
            .replace(/<!--\s*SELF_ASSESSMENT\s*-->/gi, '')
            .replace(/<!--\s*RESULTS\s*-->/gi, '')
            .replace(/<!--\s*STEP\s*:\s*\d+\s*-->/gi, '')
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/```([^\n]{1,40})```/g, '$1')   // 短内联 ```xxx``` → 保留内容
            .replace(/```[\s\S]*?\n[\s\S]*?```/g, '') // 多行代码块 → 清除
            .replace(/`json\s*\{[\s\S]*?\}`/g, '')
            .replace(/`\{[\s\S]*?\}`/g, '')
            .replace(/\{\s*"skills"[\s\S]*?"jobMatches"[\s\S]*?\}/g, '')
            .replace(/\{\s*"jobMatches"[\s\S]*?\}/g, '')
            .trim()

          return (
            <div key={m.id} className="group relative">
              {/* 回退按钮 */}
              <button
                onClick={() => handleRollback(m.id)}
                title="回退到此消息，删除之后所有内容"
                className="absolute -top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-white border border-border rounded px-1.5 py-0.5 text-text-muted hover:text-red-500 hover:border-red-300 shadow-sm"
              >
                回退到此
              </button>

              {cleanContent && (
                <ChatBubble
                  role={m.role as 'user' | 'assistant'}
                  content={cleanContent}
                  onEdit={
                    m.role === 'user'
                      ? (newText) => handleEdit(m.id, newText)
                      : undefined
                  }
                />
              )}

              {showHolland && (
                <div className="mb-4 max-w-[85%]">
                  <HollandAssessment
                    onComplete={(scores) => {
                      onHollandComplete(scores)
                      onStepChange(2)
                      stepRef.current = 2
                      // 保存测评历史
                      const latest = getLatestAssessment()
                      const record = {
                        date: new Date().toISOString(),
                        hollandScores: scores,
                        skills: latest?.skills || [],
                        jobMatches: latest?.jobMatches || [],
                      }
                      saveAssessment(record)
                      saveAssessmentCloud(record).catch((err) =>
                        console.error('云端测评保存失败:', err)
                      )
                      const msg = `我的霍兰德测评完成。得分：R=${scores.R} I=${scores.I} A=${scores.A} S=${scores.S} E=${scores.E} C=${scores.C}`
                      sendMessage({ text: msg })
                    }}
                  />
                </div>
              )}

              {showSelf && (
                <div className="mb-4 max-w-[85%]">
                  <SelfAssessment
                    skills={selfAssessmentInput?.skills || fallbackSkills || []}
                    onComplete={(completed, pending) => {
                      onSkillsUpdate(completed)
                      onPendingUpdate(pending)
                      const nextStep = stepRef.current + 1
                      onStepChange(nextStep)
                      stepRef.current = nextStep
                      // 更新测评历史
                      const latest = getLatestAssessment()
                      const record = {
                        date: new Date().toISOString(),
                        hollandScores: latest?.hollandScores ?? hollandScores,
                        skills: completed,
                        jobMatches: latest?.jobMatches || [],
                      }
                      saveAssessment(record)
                      saveAssessmentCloud(record).catch((err) =>
                        console.error('云端测评保存失败:', err)
                      )
                      const completedSummary = completed
                        .map((s) => `${s.name}=${s.selfScore}`)
                        .join(', ')
                      const pendingSummary = pending.map((s) => s.name).join(', ')
                      let msg = `我的能力自评完成。已评：${completedSummary}`
                      if (pending.length > 0) {
                        msg += `；待确定：${pendingSummary}`
                      }
                      sendMessage({ text: msg })
                    }}
                  />
                </div>
              )}

              {showResults && (
                <div className="mb-4 ml-0 max-w-[85%]">
                  <ResultsPanel
                    hollandScores={hollandScores}
                    skills={resultsInput?.skills || fallbackResults.skills}
                    jobMatches={resultsInput?.jobMatches || fallbackResults.jobMatches}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* AI 思考中指示器 */}
        {(() => {
          const lastMsg = messages[messages.length - 1]
          const lastText = lastMsg ? getText(lastMsg.parts) : ''
          const showThinking =
            status === 'submitted' ||
            (status === 'streaming' &&
              lastMsg?.role === 'assistant' &&
              !lastText.trim())
          if (!showThinking) return null
          return (
            <div className="flex justify-start mb-4">
              <div className="bg-surface border border-border rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted">思考中</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        <div ref={bottomRef} />
      </div>

      {/* 输入区域 */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="flex items-end gap-2 border-t border-border bg-surface p-3"
      >
        {/* 简历上传按钮 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          aria-label="上传简历"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          title="上传简历（txt/pdf/doc/docx）"
          className="flex-shrink-0 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-muted hover:text-primary hover:border-primary/40 disabled:opacity-40 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        {uploadedFileName && (
          <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 flex-shrink-0 max-w-[140px]">
            <span className="truncate">📎 {uploadedFileName}</span>
            <button
              type="button"
              onClick={clearUploadedFile}
              className="flex-shrink-0 ml-0.5 text-primary/60 hover:text-primary"
              title="移除文件"
            >
              ×
            </button>
          </span>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="输入你的想法……（Shift+Enter 换行）"
          rows={1}
          disabled={isBusy}
          className="flex-1 resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-light disabled:opacity-40 transition-colors min-w-[56px] flex items-center justify-center"
        >
          {isBusy ? (
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="opacity-75"
              />
            </svg>
          ) : (
            '发送'
          )}
        </button>
      </form>
    </div>
  )
}
