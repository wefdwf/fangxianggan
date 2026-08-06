'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSupabaseSafe } from '@/lib/supabase-client'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseSafe()
    if (!supabase) {
      // 缺少环境变量，直接跳过认证
      setLoading(false)
      return
    }

    // 初始 session
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })

    // 监听登录/登出变化
    const { data: { subscription } }: { data: { subscription: { unsubscribe: () => void } } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
