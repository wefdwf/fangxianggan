'use client'

import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        '缺少 Supabase 环境变量。请在 .env.local 中配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY'
      )
    }
    _client = createBrowserClient(url, key)
  }
  return _client
}

/** 安全获取 Supabase 客户端——缺少环境变量时返回 null，不抛异常 */
export function getSupabaseSafe() {
  try {
    return getSupabase()
  } catch {
    return null
  }
}
