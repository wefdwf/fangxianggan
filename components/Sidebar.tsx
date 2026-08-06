'use client'

import ProgressBar from './ProgressBar'
import PendingBox from './PendingBox'
import type { SkillItem, JobMatch } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onClear: () => void
  step: number
  pendingSkills: SkillItem[]
  jobMatches: JobMatch[]
  onStepClick?: (step: number) => void
  onJobClick?: (job: JobMatch) => void
}

export default function Sidebar({ open, onClose, onClear, step, pendingSkills, jobMatches, onStepClick, onJobClick }: Props) {
  if (!open) return null

  const handleClear = () => {
    if (window.confirm('确定要清除所有聊天记录和测评数据吗？此操作不可恢复。')) {
      onClear()
    }
  }

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* 滑出面板 — 宽度适配手机视口 */}
      <div className="fixed left-0 top-0 bottom-0 w-[min(280px,85vw)] bg-surface border-r border-border z-50 shadow-xl animate-slide-in flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <span className="text-sm font-semibold text-text">探索进度</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-lg leading-none p-1"
            aria-label="关闭菜单"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ProgressBar current={step} onStepClick={onStepClick} />
          <PendingBox items={pendingSkills} />

          {/* 推荐职位列表 */}
          {jobMatches.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">推荐职位</h3>
              <div className="space-y-2">
                {jobMatches.map((job, i) => {
                  const badgeBg = job.priority?.includes('主攻') ? '#fef2f2'
                    : job.priority?.includes('并行') ? '#fffbeb'
                    : job.priority?.includes('看见') || job.priority?.includes('就投') ? '#eff6ff'
                    : job.priority?.includes('长期') ? '#f3f4f6'
                    : '#f8fafc'
                  const badgeText = job.priority?.includes('主攻') ? '#dc2626'
                    : job.priority?.includes('并行') ? '#d97706'
                    : job.priority?.includes('看见') || job.priority?.includes('就投') ? '#2563eb'
                    : job.priority?.includes('长期') ? '#6b7280'
                    : '#64748b'
                  return (
                    <button
                      key={i}
                      onClick={() => onJobClick?.(job)}
                      className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                    >
                      {job.priority && (
                        <div className="mb-1">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ color: badgeText, backgroundColor: badgeBg }}
                          >
                            {job.priority}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                          {job.title}
                        </span>
                        <span className="text-xs font-bold text-primary tabular-nums">
                          {job.match}%
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {job.reasons.slice(0, 2).map((r, ri) => (
                          <span key={ri} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                            ✓ {r}
                          </span>
                        ))}
                        {job.gaps.slice(0, 2).map((g, gi) => (
                          <span key={gi} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                            ⚠ {g}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 清除记录按钮 */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleClear}
            className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            清除所有记录
          </button>
        </div>
      </div>

      {/* 滑入动画 */}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </>
  )
}
