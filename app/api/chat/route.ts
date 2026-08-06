import { deepseek } from '@ai-sdk/deepseek'
import { streamText, convertToModelMessages } from 'ai'
import { SYSTEM_PROMPT } from '@/lib/prompts'
import { clientTools } from '@/lib/tools'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

/** 从请求 cookie 中校验用户身份，返回 userId 或 null */
async function getUserId(req: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    // 未配置 Supabase → 降级为本地模式，允许无鉴权访问
    return 'local-user'
  }
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() {}, // API 路由不需要写 cookie
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: '请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, step, assessmentHistory } = await req.json()

  let systemMessage = SYSTEM_PROMPT.replace('{step}', String(step || 1))

  // 注入测评历史
  let historyText = '暂无历史测评记录'
  if (assessmentHistory && assessmentHistory.length > 0) {
    historyText = assessmentHistory.map((r: { date: string; hollandScores?: Record<string, number>; skills?: Array<{ name: string; aiScore: number; selfScore?: number }>; jobMatches?: Array<{ title: string }> }, i: number) => {
      const dateStr = r.date ? r.date.slice(0, 10) : '未知日期'
      const holland = r.hollandScores
        ? `R=${r.hollandScores.R} I=${r.hollandScores.I} A=${r.hollandScores.A} S=${r.hollandScores.S} E=${r.hollandScores.E} C=${r.hollandScores.C}`
        : '未测评'
      const skillList = r.skills?.length
        ? r.skills.map((s) => `${s.name}(AI=${s.aiScore}${s.selfScore ? `, 自评=${s.selfScore}` : ''})`).join('、')
        : '无'
      const jobList = r.jobMatches?.length
        ? r.jobMatches.map((j) => j.title).join('、')
        : '无'
      return `第${i + 1}次测评（${dateStr}）—— 霍兰德：${holland}｜能力：${skillList}｜匹配岗位：${jobList}`
    }).join('\n')
  }
  systemMessage = systemMessage.replace('{assessmentHistory}', historyText)

  const result = streamText({
    model: deepseek('deepseek-v4-pro'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
    tools: clientTools,
    temperature: 0.7,
    maxOutputTokens: 4096,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
  })

  return result.toUIMessageStreamResponse()
}
