'use client'

const STEPS = [
  '霍兰德测评', '偏好与爱好', '简历能力提取',
  '自评+补充', '评分+推荐', '确认意向',
]

interface Props {
  current: number
  onStepClick?: (step: number) => void
}

export default function ProgressBar({ current, onStepClick }: Props) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">探索进度</h3>
      {STEPS.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isDone = stepNum < current
        return (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs py-1 ${onStepClick ? 'cursor-pointer hover:bg-bg rounded px-1 -mx-1 transition-colors' : ''}`}
            onClick={() => onStepClick?.(stepNum)}
          >
            <span
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isDone
                  ? 'bg-primary text-white'
                  : isActive
                  ? 'bg-primary/20 text-primary ring-1 ring-primary'
                  : 'bg-border text-text-muted'
              }`}
            >
              {isDone ? '✓' : stepNum}
            </span>
            <span className={`${isActive ? 'text-primary font-semibold' : isDone ? 'text-text-muted' : 'text-text-muted/60'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
