'use client'

import type { SkillItem } from '@/lib/types'

interface Props {
  skills: SkillItem[]
}

function fontSize(score: number): number {
  if (score >= 85) return 24
  if (score >= 70) return 18
  if (score >= 50) return 14
  return 11
}

function color(score: number): string {
  if (score >= 80) return '#6366f1'
  if (score >= 60) return '#8b5cf6'
  return '#94a3b8'
}

export default function WordCloud({ skills }: Props) {
  if (skills.length === 0) {
    return <p className="text-xs text-text-muted">暂无能力数据</p>
  }
  return (
    <div className="bg-bg rounded-xl p-4 border border-border">
      <h4 className="text-sm font-semibold text-text mb-3">能力词云</h4>
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-center min-h-[120px]">
        {skills.map((skill, i) => {
          const score = skill.selfScore ?? skill.aiScore
          return (
            <span
              key={i}
              className={`inline-block font-semibold leading-tight ${skill.uncertain ? 'border-2 border-dashed border-border rounded px-1' : ''}`}
              style={{
                fontSize: `${fontSize(score)}px`,
                color: color(score),
                opacity: skill.uncertain ? 0.6 : 1,
              }}
              title={`${skill.name}: ${score} 分`}
            >
              {skill.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}
