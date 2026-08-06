'use client'

import type { JobMatch } from '@/lib/types'

interface Props {
  matches: JobMatch[]
}

function barColor(match: number): string {
  if (match >= 80) return '#22c55e'
  if (match >= 60) return '#6366f1'
  if (match >= 40) return '#f59e0b'
  return '#ef4444'
}

/** 根据 priority 文本返回徽章颜色 */
function priorityBadgeStyle(priority: string): { bg: string; text: string } {
  if (priority.includes('主攻')) return { bg: '#fef2f2', text: '#dc2626' }
  if (priority.includes('并行')) return { bg: '#fffbeb', text: '#d97706' }
  if (priority.includes('看见') || priority.includes('就投')) return { bg: '#eff6ff', text: '#2563eb' }
  if (priority.includes('长期')) return { bg: '#f3f4f6', text: '#6b7280' }
  return { bg: '#f8fafc', text: '#64748b' }
}

export default function JobMatchCard({ matches }: Props) {
  if (matches.length === 0) {
    return <p className="text-xs text-text-muted">暂无适配度数据</p>
  }
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
        推荐岗位
      </h4>
      {matches.map((m, i) => {
        const badge = m.priority ? priorityBadgeStyle(m.priority) : null
        return (
          <div
            key={i}
            className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            {/* 岗位名 + 优先级徽章 + 匹配度 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {m.priority && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ color: badge!.text, backgroundColor: badge!.bg }}
                  >
                    {m.priority}
                  </span>
                )}
                <span className="text-sm font-semibold text-text truncate">{m.title}</span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums flex-shrink-0 ml-2"
                style={{ color: barColor(m.match), background: `${barColor(m.match)}15` }}
              >
                {m.match}%
              </span>
            </div>

            {/* 匹配度进度条 */}
            <div className="w-full h-1.5 bg-border/60 rounded-full overflow-hidden mb-2.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${m.match}%`, background: barColor(m.match) }}
              />
            </div>

            {/* 理由 + 差距 */}
            <div className="grid grid-cols-1 gap-1.5 text-[11px]">
              {m.reasons.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-green-600 flex-shrink-0 mt-0.5">✓</span>
                  <span className="text-text-muted">{m.reasons.slice(0, 3).join('；')}</span>
                </div>
              )}
              {m.gaps.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-amber-600 flex-shrink-0 mt-0.5">⚠</span>
                  <span className="text-text-muted">{m.gaps.slice(0, 3).join('；')}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
