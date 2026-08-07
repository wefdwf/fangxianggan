import { deepseek, createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, convertToModelMessages } from 'ai'
import { SYSTEM_PROMPT } from '@/lib/prompts'
import { clientTools } from '@/lib/tools'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

/** 根据 AI_PROVIDER 创建模型，千问优先、DeepSeek 自动降级 */
function getModel() {
  const provider = process.env.AI_PROVIDER || 'deepseek'

  if (provider === 'qwen') {
    const qwen = createDeepSeek({
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY,
    })
    return qwen(process.env.AI_MODEL || 'qwen-plus')
  }

  return deepseek(process.env.AI_MODEL || 'deepseek-v4-pro')
}

/** 获取降级模型（DeepSeek） */
function getFallbackModel() {
  return deepseek(process.env.AI_MODEL || 'deepseek-v4-pro')
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return 'local-user'
  }
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function buildSystemMessage(messages: unknown[], step: number, assessmentHistory: unknown[]) {
  let systemMessage = SYSTEM_PROMPT.replace('{step}', String(step || 1))

  let historyText = '暂无历史测评记录'
  if (assessmentHistory && assessmentHistory.length > 0) {
    historyText = assessmentHistory.map((r: unknown, i: number) => {
      const rec = r as Record<string, unknown>
      const dateStr = typeof rec.date === 'string' ? rec.date.slice(0, 10) : '未知日期'
      const hs = rec.hollandScores as Record<string, number> | undefined
      const holland = hs
        ? `R=${hs.R} I=${hs.I} A=${hs.A} S=${hs.S} E=${hs.E} C=${hs.C}`
        : '未测评'
      const skills = rec.skills as Array<{ name: string; aiScore: number; selfScore?: number }> | undefined
      const skillList = skills?.length
        ? skills.map((s) => `${s.name}(AI=${s.aiScore}${s.selfScore ? `, 自评=${s.selfScore}` : ''})`).join('、')
        : '无'
      const jobs = rec.jobMatches as Array<{ title: string }> | undefined
      const jobList = jobs?.length
        ? jobs.map((j) => j.title).join('、')
        : '无'
      return `第${i + 1}次测评（${dateStr}）—— 霍兰德：${holland}｜能力：${skillList}｜匹配岗位：${jobList}`
    }).join('\n')
  }
  systemMessage = systemMessage.replace('{assessmentHistory}', historyText)
  return systemMessage
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: '请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { messages, step, assessmentHistory } = body
  const systemMessage = buildSystemMessage(messages, step, assessmentHistory)

  // 先尝试主模型
  try {
    const result = streamText({
      model: getModel(),
      system: systemMessage,
      messages: convertToModelMessages(messages),
      tools: clientTools,
      temperature: 0.7,
      maxOutputTokens: 2048,
    })
    return result.toUIMessageStreamResponse()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[方向感] 主模型调用失败: ${msg.slice(0, 300)}`)

    // 尝试降级到 DeepSeek
    const provider = process.env.AI_PROVIDER || 'deepseek'
    if (provider === 'qwen' && process.env.DEEPSEEK_API_KEY) {
      console.warn('[方向感] 自动降级到 DeepSeek')
      try {
        const result = streamText({
          model: getFallbackModel(),
          system: systemMessage,
          messages: convertToModelMessages(messages),
          tools: clientTools,
          temperature: 0.7,
          maxOutputTokens: 2048,
        })
        return result.toUIMessageStreamResponse()
      } catch (e2: unknown) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2)
        console.error(`[方向感] DeepSeek 降级也失败: ${msg2.slice(0, 300)}`)
      }
    }

    return new Response(
      JSON.stringify({ error: `AI 服务调用失败：${msg}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
