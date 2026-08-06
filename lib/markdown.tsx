import React from 'react'

/**
 * 轻量级 Markdown → JSX 渲染器
 * 支持：**加粗** __加粗__ *斜体* `代码` #标题 列表 表格
 */

/** 渲染行内格式：加粗、斜体、行内代码 */
function renderInline(text: string): React.ReactNode[] {
  // 保护行内代码，避免被加粗/斜体正则误匹配
  const codePlaceholders: string[] = []
  let protected_ = text.replace(/`([^`]+)`/g, (_, code) => {
    codePlaceholders.push(code)
    return `\x00CODE${codePlaceholders.length - 1}\x00`
  })

  // 加粗 **text** 或 __text__
  const boldParts = protected_.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  const elements: React.ReactNode[] = []

  boldParts.forEach((part, i) => {
    if (!part) return
    // **加粗**
    if (part.startsWith('**') && part.endsWith('**')) {
      elements.push(<strong key={`b${i}`}>{part.slice(2, -2)}</strong>)
      return
    }
    // __加粗__
    if (part.startsWith('__') && part.endsWith('__')) {
      elements.push(<strong key={`b${i}`}>{part.slice(2, -2)}</strong>)
      return
    }

    // 斜体 *text*（但不能是 ** 开头）
    const italicParts = part.split(/((?<!\*)\*(?!\*)[^*]+\*(?!\*))/g)
    italicParts.forEach((ip, j) => {
      if (!ip) return
      if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
        elements.push(<em key={`i${i}${j}`}>{ip.slice(1, -1)}</em>)
      } else {
        // 恢复行内代码
        const restored = ip.replace(/\x00CODE(\d+)\x00/g, (_, idx) => {
          const code = codePlaceholders[parseInt(idx)]
          return `\x01CODE${idx}\x01`
        })
        if (restored !== ip) {
          // 拆分恢复后的内容
          const codeParts = restored.split(/(\x01CODE\d+\x01)/g)
          codeParts.forEach((cp, k) => {
            const cm = cp.match(/^\x01CODE(\d+)\x01$/)
            if (cm) {
              elements.push(
                <code key={`c${i}${j}${k}`} className="bg-border/50 text-primary text-xs px-1 py-0.5 rounded font-mono">
                  {codePlaceholders[parseInt(cm[1])]}
                </code>
              )
            } else if (cp) {
              elements.push(<React.Fragment key={`t${i}${j}${k}`}>{cp}</React.Fragment>)
            }
          })
        } else {
          elements.push(<React.Fragment key={`t${i}${j}`}>{part}</React.Fragment>)
        }
      }
    })
  })

  return elements.length > 0 ? elements : [text]
}

export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行
    if (!trimmed) {
      i++
      continue
    }

    // 表格：| col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: string[][] = []
      while (i < lines.length) {
        const row = lines[i].trim()
        if (!row.startsWith('|') || !row.endsWith('|')) break
        // 跳过分隔行（| --- | --- |）
        if (/^\|[\s\-:|]+\|$/.test(row)) {
          i++
          continue
        }
        tableRows.push(row.split('|').slice(1, -1).map((c) => c.trim()))
        i++
      }
      if (tableRows.length > 0) {
        const header = tableRows[0]
        const body = tableRows.slice(1)
        nodes.push(
          <div key={nodes.length} className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              {header && body.length > 0 && (
                <thead>
                  <tr className="border-b border-border">
                    {header.map((h, hi) => (
                      <th key={hi} className="px-2 py-1.5 text-left font-semibold text-text">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-text-muted">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // 标题：### 或 ## 或 #
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes = ['text-base', 'text-sm', 'text-xs']
      const weights = ['font-bold', 'font-semibold', 'font-medium']
      nodes.push(
        <h3
          key={nodes.length}
          className={`${sizes[level - 1]} ${weights[level - 1]} text-text mt-3 mb-1`}
        >
          {renderInline(headingMatch[2])}
        </h3>
      )
      i++
      continue
    }

    // 分隔线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      nodes.push(<hr key={nodes.length} className="my-3 border-border" />)
      i++
      continue
    }

    // 无序列表
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      const items: React.ReactNode[] = []
      while (i < lines.length) {
        const li = lines[i].trim()
        const m = li.match(/^[-*]\s+(.+)/)
        if (!m) break
        items.push(<li key={i} className="text-sm">{renderInline(m[1])}</li>)
        i++
      }
      nodes.push(
        <ul key={nodes.length} className="list-disc pl-5 my-2 space-y-0.5">
          {items}
        </ul>
      )
      continue
    }

    // 有序列表
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      const items: React.ReactNode[] = []
      while (i < lines.length) {
        const li = lines[i].trim()
        const m = li.match(/^\d+\.\s+(.+)/)
        if (!m) break
        items.push(<li key={i} className="text-sm">{renderInline(m[1])}</li>)
        i++
      }
      nodes.push(
        <ol key={nodes.length} className="list-decimal pl-5 my-2 space-y-0.5">
          {items}
        </ol>
      )
      continue
    }

    // 普通段落
    const paragraphLines: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      const t = l.trim()
      if (!t || /^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t) || /^#{1,3}\s+/.test(t) ||
        (t.startsWith('|') && t.endsWith('|')) || /^[-*_]{3,}$/.test(t)) break
      paragraphLines.push(l)
      i++
    }
    if (paragraphLines.length > 0) {
      nodes.push(
        <p key={nodes.length} className="mb-2 last:mb-0">
          {renderInline(paragraphLines.join('\n'))}
        </p>
      )
    }
  }

  if (nodes.length === 0) return <span>{text}</span>
  return <>{nodes}</>
}
