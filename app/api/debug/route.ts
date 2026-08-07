import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    provider: process.env.AI_PROVIDER || '(未设, 默认deepseek)',
    model: process.env.AI_MODEL || '(未设)',
    hasDsKey: !!process.env.DEEPSEEK_API_KEY,
    dsKeyLen: (process.env.DEEPSEEK_API_KEY || '').length,
    hasQwenKey: !!process.env.DASHSCOPE_API_KEY,
    qwenKeyLen: (process.env.DASHSCOPE_API_KEY || '').length,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}
