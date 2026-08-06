'use client'

import { getSupabaseSafe } from './supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'

function getSupabase(): SupabaseClient {
  const client = getSupabaseSafe()
  if (!client) throw new Error('Supabase 未配置')
  return client
}
import type { ChatState, AssessmentRecord } from './types'
import type { UIMessage } from 'ai'

// ─── 会话（ChatState）───

export async function fetchConversation(): Promise<{
  conversationId: string
  state: ChatState
} | null> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('conversations')
    .select('id, state')
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    console.error('fetchConversation error:', error)
    return null
  }

  return { conversationId: data.id, state: data.state as ChatState }
}

/** 获取或创建会话（不存在时自动创建） */
export async function getOrCreateConversation(): Promise<{
  conversationId: string
  state: ChatState
}> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  // 先查已有会话
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, state')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return { conversationId: existing.id, state: (existing.state || { step: 1, skills: [], pendingSkills: [] }) as ChatState }
  }

  // 不存在则创建
  const defaultState: ChatState = { step: 1, skills: [], pendingSkills: [] }
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, state: defaultState as unknown as Record<string, unknown> })
    .select('id')
    .single()

  if (error || !created) throw new Error('创建会话失败')
  return { conversationId: created.id, state: defaultState }
}

export async function saveConversationState(state: ChatState): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('conversations')
    .update({ state: state as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) console.error('saveConversationState error:', error)
}

// ─── 消息 ───

export async function fetchMessages(conversationId: string): Promise<UIMessage[]> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('messages')
    .select('ui_message')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchMessages error:', error)
    return []
  }

  return (data || []).map((row: { ui_message: unknown }) => row.ui_message as UIMessage)
}

export async function replaceMessages(
  conversationId: string,
  messages: UIMessage[]
): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 删除旧消息
  await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)

  if (messages.length === 0) return

  const rows = messages.map((msg) => ({
    conversation_id: conversationId,
    ui_message: msg as unknown as Record<string, unknown>,
  }))

  // 分批插入，每批最多 100 条
  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('messages').insert(batch)
    if (error) console.error('replaceMessages batch insert error:', error)
  }
}

// ─── 测评 ───

export async function fetchAssessments(): Promise<AssessmentRecord[]> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('assessments')
    .select('record')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('fetchAssessments error:', error)
    return []
  }

  return (data || []).map((row: { record: unknown }) => row.record as AssessmentRecord)
}

export async function saveAssessmentCloud(record: AssessmentRecord): Promise<void> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase.from('assessments').insert({
    user_id: user.id,
    record: record as unknown as Record<string, unknown>,
  })

  if (error) console.error('saveAssessmentCloud error:', error)

  // 保留最近 3 条
  try {
    await supabase.rpc('trim_assessments', { uid: user.id })
  } catch {
    // rpc 可能不存在（还没建表），忽略
  }
}

// ─── 清除 ───

export async function clearCloudData(conversationId: string): Promise<void> {
  const supabase = getSupabase()

  await supabase.from('messages').delete().eq('conversation_id', conversationId)

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('assessments').delete().eq('user_id', user.id)
    await supabase
      .from('conversations')
      .update({ state: { step: 1, skills: [], pendingSkills: [] } })
      .eq('user_id', user.id)
  }
}
