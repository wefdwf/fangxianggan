'use client'

import { useState, type FormEvent } from 'react'
import { getSupabaseSafe } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = getSupabaseSafe()
    if (!supabase) {
      setError('系统配置错误：缺少 Supabase 连接信息，请联系管理员')
      setLoading(false)
      return
    }

    try {
      const { error: authError } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password })

      if (authError) {
        const msg = typeof authError.message === 'string' ? authError.message : String(authError.message || '未知错误')
        setError(msg)
        return
      }

      // 用 window.location 做完整刷新，确保中间件能读到 createBrowserClient 写入的 cookie
      window.location.href = '/'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || '未知错误')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full bg-bg">
      <div className="w-full max-w-sm mx-4">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text mb-1">🧭 方向感</h1>
          <p className="text-sm text-text-muted">AI 职业探索助手</p>
        </div>

        {/* 表单卡片 */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4"
        >
          {/* 登录/注册 Tab */}
          <div className="flex rounded-lg bg-bg p-0.5">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-white text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              注册
            </button>
          </div>

          {/* 错误提示 */}
          {!!error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {typeof error === 'string' ? error : String(error)}
            </div>
          )}

          {/* 邮箱 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少 6 位"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
