'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ChatArea from '@/components/ChatArea'
import Sidebar from '@/components/Sidebar'
import JobDetail from '@/components/JobDetail'
import { loadState, saveState, clearState, clearMessages, clearJobReports, saveJobReport, loadJobReport, getAllLocalJobReports, loadMessages, saveMessages } from '@/lib/storage'
import { getOrCreateConversation, saveConversationState, clearCloudData, replaceMessages, fetchMessages } from '@/lib/cloud-storage'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase, getSupabaseSafe } from '@/lib/supabase-client'
import type { ChatState, HollandScores, SkillItem, JobMatch } from '@/lib/types'

const DEFAULT_STATE: ChatState = { step: 1, skills: [], pendingSkills: [] }

const STEP_LABELS = [
  '霍兰德测评', '偏好与爱好', '简历能力',
  '自评+补充', '评分+推荐', '确认意向',
]

export default function Home() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // 始终用默认值初始化，保证 hydration 时服务端/客户端一致
  const [state, setState] = useState<ChatState>(DEFAULT_STATE)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const convIdRef = useRef<string | null>(null)

  // 客户端挂载后：优先从云端恢复状态，云端没有则回退 localStorage
  useEffect(() => {
    if (authLoading) return

    const init = async () => {
      // 尝试从云端加载
      if (user) {
        try {
          const result = await getOrCreateConversation()
          convIdRef.current = result.conversationId
          setConversationId(result.conversationId)
          // 云端有状态就用云端的
          if (result.state && result.state.step) {
            setState(result.state)
            // 云端有岗位报告 → 同步到本地
            if (result.state.jobReports) {
              for (const [title, content] of Object.entries(result.state.jobReports)) {
                if (!loadJobReport(title)) saveJobReport(title, content as string)
              }
            }
            // 本地所有报告 → 上传到云端（本地覆盖云端）
            const localKeys = Object.keys(getAllLocalJobReports())
            if (localKeys.length > 0) {
              const merged = { ...result.state.jobReports }
              for (const k of localKeys) {
                const c = loadJobReport(k)
                if (c) merged[k] = c
              }
              setState((prev) => ({ ...prev, jobReports: merged }))
            }
          } else {
            // 云端没有有效状态，回退 localStorage
            const local = loadState()
            setState(local)
          }
        } catch (err) {
          console.error('云端加载失败，回退 localStorage:', err)
          const local = loadState()
          setState(local)
        }
      } else {
        // 未登录，回退 localStorage
        const local = loadState()
        setState(local)
      }
      loadedRef.current = true
    }

    init()
  }, [authLoading, user])

  // Supabase 已配置但用户未登录 → 跳转登录页
  useEffect(() => {
    if (authLoading) return
    const supabase = getSupabaseSafe()
    if (supabase && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // 状态变化自动保存（跳过首次加载前，防止覆盖已保存状态）
  useEffect(() => {
    if (!loadedRef.current) return
    // localStorage 始终保存（兜底）
    saveState(state)
    // 云端同步
    if (convIdRef.current) {
      saveConversationState(state).catch((err) =>
        console.error('云端状态保存失败:', err)
      )
    }
  }, [state])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatKey, setChatKey] = useState(0)
  const [jumpTarget, setJumpTarget] = useState<number | null>(null)
  const [jobQuery, setJobQuery] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')

  // 清除所有记录
  const handleClear = useCallback(() => {
    clearState()
    clearMessages()
    clearJobReports()
    if (convIdRef.current) {
      clearCloudData(convIdRef.current).catch((err) =>
        console.error('云端清除失败:', err)
      )
    }
    setState(DEFAULT_STATE)
    setChatKey((k) => k + 1) // 强制 ChatArea 重新挂载，清空内存中的消息
    setSidebarOpen(false)
  }, [])

  // 退出登录
  const handleLogout = useCallback(async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  // 手动同步：本地有消息→上传云端，本地空→从云端下载
  const handleSync = useCallback(async () => {
    if (!convIdRef.current) return
    setSyncStatus('syncing')

    try {
      const localMsgs = loadMessages() as Array<{ id: string }>
      const hasRealMessages = localMsgs.length > 0 && localMsgs[0]?.id !== 'welcome'

      if (hasRealMessages) {
        // 桌面端：上传本地 → 云端
        await replaceMessages(convIdRef.current, localMsgs as any)
        // 同时上传岗位报告
        const localReports = getAllLocalJobReports()
        if (Object.keys(localReports).length > 0) {
          setState((prev) => ({ ...prev, jobReports: { ...prev.jobReports, ...localReports } }))
        }
        console.log('[方向感] 同步完成：已上传', localMsgs.length, '条消息到云端')
      } else {
        // 移动端：从云端下载 → 本地
        const cloudMsgs = await fetchMessages(convIdRef.current)
        if (cloudMsgs.length > 0) {
          saveMessages(cloudMsgs)
          setChatKey((k) => k + 1) // 触发 ChatArea 重新加载
          console.log('[方向感] 同步完成：已从云端下载', cloudMsgs.length, '条消息')
        } else {
          console.log('[方向感] 同步完成：云端也无消息，跳过')
        }
      }

      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch (err) {
      console.error('[方向感] 同步失败:', err)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
  }, [])

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, step }))
  }, [])

  const setHollandScores = useCallback((scores: HollandScores) => {
    setState((s) => ({ ...s, hollandScores: scores }))
  }, [])

  const setSkills = useCallback((skills: SkillItem[]) => {
    setState((s) => ({ ...s, skills }))
  }, [])

  const setPendingSkills = useCallback((skills: SkillItem[]) => {
    setState((s) => ({ ...s, pendingSkills: skills }))
  }, [])

  const setJobMatches = useCallback((jobs: JobMatch[]) => {
    setState((s) => ({ ...s, jobMatches: jobs }))
  }, [])

  // 等待认证状态确定后再渲染
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-text-muted">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-lg md:max-w-5xl mx-auto bg-surface shadow-sm border-x border-border relative">
      {/* 顶部导航栏 */}
      <nav className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 -ml-1 rounded-lg hover:bg-bg transition-colors text-text-muted"
          aria-label="打开菜单"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-text">方向感</span>
          {user && typeof user.email === 'string' && (
            <span className="text-[11px] text-text-muted hidden sm:inline" title={user.email}>
              {user.email.split('@')[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted tabular-nums">
            {state.step}/6 · {STEP_LABELS[state.step - 1]}
          </span>
          {user && (
            <button
              onClick={handleSync}
              disabled={syncStatus === 'syncing'}
              title={
                syncStatus === 'syncing' ? '同步中...' :
                syncStatus === 'success' ? '同步成功！' :
                syncStatus === 'error' ? '同步失败，请重试' :
                '同步云端数据'
              }
              className="text-xs text-text-muted hover:text-primary disabled:opacity-50 transition-colors px-1"
            >
              {syncStatus === 'syncing' ? '⏳' :
               syncStatus === 'success' ? '✅' :
               syncStatus === 'error' ? '❌' :
               '🔄'}
            </button>
          )}
          {user && (
            <button
              onClick={handleLogout}
              title="退出登录"
              className="text-xs text-text-muted hover:text-red-500 transition-colors px-1"
            >
              退出
            </button>
          )}
        </div>
      </nav>

      {/* 主聊天区域 */}
      <main className="flex-1 min-h-0 flex flex-col">
        <ChatArea
          key={chatKey}
          conversationId={conversationId}
          step={state.step}
          hollandScores={state.hollandScores}
          skills={state.skills}
          jobMatches={state.jobMatches || []}
          onStepChange={setStep}
          onHollandComplete={setHollandScores}
          onSkillsUpdate={setSkills}
          onPendingUpdate={setPendingSkills}
          onJobMatchesUpdate={setJobMatches}
          jumpTarget={jumpTarget}
          onJumpDone={() => setJumpTarget(null)}
          jobQuery={jobQuery}
          onJobQueryDone={() => setJobQuery(null)}
        />
      </main>

      {/* 侧边栏：始终为滑出式 */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onClear={handleClear}
        step={state.step}
        pendingSkills={state.pendingSkills}
        jobMatches={state.jobMatches || []}
        onStepClick={(s) => {
          setJumpTarget(s)
          setSidebarOpen(false)
        }}
        onJobClick={(job) => {
          setSelectedJob(job)
          setSidebarOpen(false)
        }}
      />

      {/* 职位详情浮层 */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          skills={state.skills}
          hollandScores={state.hollandScores}
          onBack={() => setSelectedJob(null)}
          onReportGenerated={(title, content) => {
            setState((prev) => ({
              ...prev,
              jobReports: { ...prev.jobReports, [title]: content },
            }))
          }}
        />
      )}
    </div>
  )
}
