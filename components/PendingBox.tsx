'use client'

import type { SkillItem } from '@/lib/types'

interface Props {
  items: SkillItem[]
}

export default function PendingBox({ items }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
        待确定 ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted/60">还没有不确定的能力</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-text border border-dashed border-border rounded-lg px-2.5 py-1.5 bg-bg">
              <span className="font-medium">{item.name}</span>
              {item.category && (
                <span className="text-text-muted ml-1">· {item.category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
