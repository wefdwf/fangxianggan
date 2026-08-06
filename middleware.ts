import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // 没配置 Supabase 环境变量 → 直接放行，应用降级为纯本地模式
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 未登录且不在登录页/auth → 重定向到 /login
  // 注意：API 路由也需要鉴权，但通过 route handler 内部的 Supabase auth 校验
  // middleware 层面检查 session cookie 是否存在（不调用 getUser 避免额外延迟）
  if (!user && !request.nextUrl.pathname.startsWith('/login')
      && !request.nextUrl.pathname.startsWith('/auth')) {
    // API 路由：检查是否有 session cookie（有则放行到 route handler 做详细校验）
    if (request.nextUrl.pathname.startsWith('/api')) {
      const hasSession = request.cookies.getAll().some((c) =>
        c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
      )
      if (!hasSession) {
        return new Response(JSON.stringify({ error: '请先登录' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 已登录且在登录页 → 重定向到首页
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
