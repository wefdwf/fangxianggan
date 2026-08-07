import { createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, convertToModelMessages } from 'ai'
import { SYSTEM_PROMPT } from '@/lib/prompts'
import { clientTools } from '@/lib/tools'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

/** 创建千问模型实例 */
function createQwenModel() {
  const qwen = createDeepSeek({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.DASHSCOPE_API_KEY,
  })
  return qwen(process.env.AI_MODEL || 'qwen-plus')
}

/** 创建 DeepSeek 模型实例 */
function createDsModel() {
  const ds = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  })
  return ds(process.env.AI_MODEL || 'deepseek-v4-pro')
}

/** 根据 AI_PROVIDER 返回主模型和备用模型 */
function getModels() {
  const provider = process.env.AI_PROVIDER || 'qwen'
  if (provider === 'deepseek') {
    return { primary: createDsModel(), fallback: createQwenModel() }
  }
  return { primary: createQwenModel(), fallback: createDsModel() }
}

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

  const { primary, fallback } = getModels()

  /** 执行 streamText，失败时自动切换备用模型 */
  async function tryStream(model: ReturnType<typeof createQwenModel>, label: string) {
    return streamText({
      model,
      system: systemMessage,
      messages: convertToModelMessages(messages),
      tools: clientTools,
      temperature: 0.7,
      maxOutputTokens: 4096,
    })
  }

  try {
    const result = await tryStream(primary, 'primary')
    return result.toUIMessageStreamResponse()
  } catch (e) {
    // 主模型失败（余额不足 / 网络异常），自动降级到备用模型
    console.warn(`[方向感] 主模型失败，自动切换备用模型：${String(e).slice(0, 200)}`)
    try {
      const result = await tryStream(fallback, 'fallback')
      return result.toUIMessageStreamResponse()
    } catch (e2) {
      console.error(`[方向感] 备用模型也失败了：${String(e2).slice(0, 200)}`)
      return new Response(
        JSON.stringify({ error: 'AI 服务暂时不可用，两个模型都调用失败，请稍后重试' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }
}
