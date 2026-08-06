'use client'

import { useState } from 'react'
import type { SkillItem } from '@/lib/types'

interface Props {
  skills: SkillItem[]
  onComplete: (completed: SkillItem[], pending: SkillItem[]) => void
}

export default function SelfAssessment({ skills: initialSkills, onComplete }: Props) {
  const [skills, setSkills] = useState<SkillItem[]>(initialSkills)

  const updateSkill = (index: number, updates: Partial<SkillItem>) => {
    setSkills((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const markUncertain = (index: number) => {
    setSkills((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, uncertain: true, selfScore: undefined, reason: undefined } : s
      )
    )
  }

  const markCertain = (index: number) => {
    setSkills((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, uncertain: false } : s
      )
    )
  }

  const handleSubmit = () => {
    // 没动滑块的自动用 AI 初评分兜底（不动 = 认可 AI 评分）
    const completed = skills
      .filter((s) => !s.uncertain)
      .map((s) => (s.selfScore !== undefined ? s : { ...s, selfScore: s.aiScore }))
    const pending = skills.filter((s) => s.uncertain)
    onComplete(completed, pending)
  }

  // 只要有技能列表就可以提交（不动滑块 = 认可 AI 初评分）
  const allDone = skills.length > 0

  return (
    <div className="bg-bg rounded-xl p-4 border border-border max-w-full overflow-x-auto">
      <h4 className="text-sm font-semibold text-text mb-3">能力自评</h4>
      <p className="text-xs text-text-muted mb-3">
        AI 已给出初评分作为参考，请你逐项给自己打分（1-100），不确定的可以标记为"不确定"
      </p>
      {skills.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          未能从 AI 回复中解析到能力列表。请尝试重新输入简历内容，或直接粘贴简历文字。
        </p>
      )}
      {skills.length > 0 && (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left py-2 pr-3 font-medium">能力</th>
                <th className="text-left py-2 pr-3 font-medium hidden md:table-cell">AI 初评</th>
                <th className="text-left py-2 pr-3 font-medium">你的自评</th>
                <th className="text-left py-2 pr-3 font-medium hidden md:table-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill, i) => (
                <tr key={i} className={`border-b border-border/50 ${skill.uncertain ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-text">{skill.name}</div>
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    <span className="bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                      {skill.aiScore}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {skill.uncertain ? (
                      <span className="text-text-muted italic">不确定</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={skill.selfScore ?? skill.aiScore}
                          onChange={(e) => updateSkill(i, { selfScore: Number(e.target.value) })}
                          className="w-24 h-3 accent-primary cursor-pointer"
                        />
                        <span className="font-semibold text-text w-8">{skill.selfScore ?? skill.aiScore}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    {skill.uncertain ? (
                      <button
                        onClick={() => markCertain(i)}
                        className="text-[10px] border border-dashed border-primary rounded px-2 py-0.5 text-primary hover:bg-primary/10 transition-colors"
                      >
                        恢复
                      </button>
                    ) : (
                      <button
                        onClick={() => markUncertain(i)}
                        className="text-[10px] border border-dashed border-border rounded px-2 py-0.5 text-text-muted hover:border-primary hover:text-primary transition-colors"
                      >
                        不确定
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleSubmit}
            disabled={!allDone}
            className="mt-4 text-xs bg-primary text-white rounded-lg px-4 py-2 disabled:opacity-40 hover:bg-primary-light transition-colors"
          >
            提交自评
          </button>
        </>
      )}
    </div>
  )
}
