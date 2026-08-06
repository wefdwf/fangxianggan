'use client'

import { useState } from 'react'
import HollandRadar from './HollandRadar'
import type { HollandScores, HollandType } from '@/lib/types'

interface Question {
  id: number
  text: string
  type: HollandType
}

const QUESTIONS: Question[] = [
  // R - 实际型
  { id: 1, text: '我喜欢动手修理或组装东西', type: 'R' },
  { id: 2, text: '我喜欢在户外工作或活动', type: 'R' },
  { id: 3, text: '我喜欢使用工具或操作机器', type: 'R' },
  { id: 4, text: '我对动手建造或制作物品感兴趣', type: 'R' },
  // I - 研究型
  { id: 5, text: '我喜欢分析问题寻找原因', type: 'I' },
  { id: 6, text: '我对抽象概念和理论感兴趣', type: 'I' },
  { id: 7, text: '我喜欢做实验或收集数据', type: 'I' },
  { id: 8, text: '我喜欢独立钻研复杂的问题', type: 'I' },
  // A - 艺术型
  { id: 9, text: '我喜欢创意表达（写作/绘画/音乐等）', type: 'A' },
  { id: 10, text: '我喜欢不受约束地发挥想象力', type: 'A' },
  { id: 11, text: '我对美感和设计有自己独特的追求', type: 'A' },
  { id: 12, text: '我喜欢尝试新的表达方式', type: 'A' },
  // S - 社会型
  { id: 13, text: '我喜欢帮助别人解决问题', type: 'S' },
  { id: 14, text: '我擅长和不同的人打交道', type: 'S' },
  { id: 15, text: '我喜欢教学或指导他人', type: 'S' },
  { id: 16, text: '我对社会问题和服务他人有热情', type: 'S' },
  // E - 企业型
  { id: 17, text: '我喜欢说服别人接受我的想法', type: 'E' },
  { id: 18, text: '我对创业或领导项目感兴趣', type: 'E' },
  { id: 19, text: '我喜欢竞争和挑战', type: 'E' },
  { id: 20, text: '我善于在团队中推动事情发生', type: 'E' },
  // C - 传统型
  { id: 21, text: '我喜欢按流程和规则做事', type: 'C' },
  { id: 22, text: '我注重细节和准确性', type: 'C' },
  { id: 23, text: '我喜欢整理和分类信息', type: 'C' },
  { id: 24, text: '我倾向于在结构化环境中工作', type: 'C' },
]

const OPTIONS = [
  { value: 1, label: '非常不符合' },
  { value: 2, label: '不太符合' },
  { value: 3, label: '一般' },
  { value: 4, label: '比较符合' },
  { value: 5, label: '非常符合' },
]

interface Props {
  onComplete: (scores: HollandScores) => void
}

export default function HollandAssessment({ onComplete }: Props) {
  const [page, setPage] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<HollandScores | null>(null)

  const perPage = 8
  const totalPages = Math.ceil(QUESTIONS.length / perPage)
  const start = page * perPage
  const pageQuestions = QUESTIONS.slice(start, start + perPage)
  const answeredOnPage = pageQuestions.filter((q) => answers[q.id] !== undefined).length

  const handleAnswer = (qid: number, val: number) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }))
  }

  const goNext = () => {
    if (page < totalPages - 1) {
      setPage(page + 1)
    } else {
      const scores: HollandScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
      QUESTIONS.forEach((q) => {
        const val = answers[q.id] || 3
        scores[q.type] += val
      })
      setResult(scores)
      onComplete(scores)
    }
  }

  const goPrev = () => {
    if (page > 0) setPage(page - 1)
  }

  if (result) {
    return <HollandRadar scores={result} />
  }

  return (
    <div className="bg-bg rounded-xl p-4 border border-border">
      <h4 className="text-sm font-semibold text-text mb-1">
        霍兰德职业兴趣测评（{page + 1}/{totalPages}）
      </h4>
      <p className="text-xs text-text-muted mb-4">
        每题选择最符合你的程度，没有对错之分
      </p>
      <div className="space-y-4">
        {pageQuestions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <p className="text-sm text-text">
              {q.id}. {q.text}
            </p>
            <div className="flex gap-1.5">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(q.id, opt.value)}
                  className={`flex-1 text-[11px] py-1.5 rounded-lg border transition-colors ${
                    answers[q.id] === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface text-text-muted border-border hover:border-primary/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <button
          onClick={goPrev}
          disabled={page === 0}
          className="text-xs text-text-muted disabled:opacity-30 hover:text-text px-3 py-1.5"
        >
          ← 上一页
        </button>
        <span className="text-xs text-text-muted self-center">
          {answeredOnPage}/{pageQuestions.length} 已答
        </span>
        <button
          onClick={goNext}
          disabled={answeredOnPage < pageQuestions.length}
          className="text-xs bg-primary text-white rounded-lg px-4 py-1.5 disabled:opacity-40 hover:bg-primary-light transition-colors"
        >
          {page < totalPages - 1 ? '下一页 →' : '查看结果'}
        </button>
      </div>
    </div>
  )
}
