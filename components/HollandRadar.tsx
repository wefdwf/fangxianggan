'use client'

import { useMemo } from 'react'
import type { HollandScores } from '@/lib/types'

const LABELS: Record<keyof HollandScores, string> = {
  R: '实际型',
  I: '研究型',
  A: '艺术型',
  S: '社会型',
  E: '企业型',
  C: '传统型',
}

const KEYS: (keyof HollandScores)[] = ['R', 'I', 'A', 'S', 'E', 'C']
const LEVELS = [20, 40, 60, 80, 100]

/** 计算六边形顶点坐标（6 轴雷达图，从顶部顺时针） */
function getPolygonPoints(cx: number, cy: number, radius: number, values: number[]): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
      const r = (v / 100) * radius
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    })
    .join(' ')
}

export default function HollandRadar({ scores }: { scores: HollandScores }) {
  const values = KEYS.map((k) => scores[k])

  const top = useMemo(() => {
    return KEYS.map((k) => ({ key: k, label: LABELS[k], score: scores[k] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
  }, [scores])

  // 固定画布尺寸，完全避免 resize 循环
  const size = 280
  const cx = size / 2
  const cy = size / 2
  const radius = 100
  const labelRadius = radius + 22

  // 网格线（5 层同心六边形）
  const gridPolygons = LEVELS.map((level) => {
    const points = getPolygonPoints(cx, cy, radius, Array(6).fill(level))
    return <polygon key={level} points={points} fill="none" stroke="#e2e8f0" strokeWidth={level === 100 ? 1.5 : 0.5} />
  })

  // 轴线（中心到 6 个顶点）
  const axisLines = KEYS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
    return (
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={cx + radius * Math.cos(angle)}
        y2={cy + radius * Math.sin(angle)}
        stroke="#e2e8f0"
        strokeWidth={0.5}
      />
    )
  })

  // 轴标签
  const labels = KEYS.map((k, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
    const lx = cx + labelRadius * Math.cos(angle)
    const ly = cy + labelRadius * Math.sin(angle)
    // 根据位置调整 text-anchor 和 dy
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    let dy = '0.3em'
    if (Math.abs(lx - cx) < 5) {
      // 顶部或底部
      dy = lx < cx ? '0.3em' : '0.3em'
      if (ly < cy) dy = '-0.4em'  // 顶部
      else dy = '1.2em'  // 底部
    }
    return (
      <text
        key={k}
        x={lx}
        y={ly}
        textAnchor={anchor}
        dy={dy}
        fontSize={11}
        fill="#64748b"
      >
        {LABELS[k]}
      </text>
    )
  })

  // 数据多边形
  const dataPoints = getPolygonPoints(cx, cy, radius, values)
  const dataDots = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
    const r = (v / 100) * radius
    return (
      <circle
        key={i}
        cx={cx + r * Math.cos(angle)}
        cy={cy + r * Math.sin(angle)}
        r={3}
        fill="#6366f1"
      />
    )
  })

  return (
    <div className="bg-bg rounded-xl p-4 border border-border">
      <h4 className="text-sm font-semibold text-text mb-2">RIASEC 霍兰德雷达图</h4>
      <div className="flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {gridPolygons}
          {axisLines}
          {labels}
          <polygon points={dataPoints} fill="#6366f1" fillOpacity={0.25} stroke="#6366f1" strokeWidth={2} />
          {dataDots}
        </svg>
      </div>
      <div className="mt-3 text-xs text-text-muted space-y-0.5">
        <p>
          🏅 最突出：
          <span className="font-semibold text-text">{top[0].label}</span>
          （{top[0].score} 分）
        </p>
        <p>
          🥈 次之：
          <span className="font-semibold text-text">{top[1].label}</span>
          （{top[1].score} 分）
        </p>
      </div>
    </div>
  )
}
