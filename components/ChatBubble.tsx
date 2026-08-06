'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { renderMarkdown } from '@/lib/markdown'

interface Props {
  role: 'user' | 'assistant'
  content: string
  /** 仅用户消息可编辑，传入回调后显示编辑按钮 */
  onEdit?: (newContent: string) => void
}

export default function ChatBubble({ role, content, onEdit }: Props) {
  const isUser = role === 'user'
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 进入编辑态时自动聚焦并选中全部文字
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  const handleSave = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    onEdit?.(trimmed)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditText(content)
    setEditing(false)
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-surface border border-border text-text rounded-bl-md shadow-sm'
        }`}
      >
        {editing ? (
          <div className="min-w-[200px]">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKey}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/50"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={handleCancel}
                className="text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-0.5"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editText.trim()}
                className="text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1 transition-colors disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <>
            {renderMarkdown(content)}
            {/* 编辑按钮：仅用户消息 + 有 onEdit 回调时显示，hover 时出现 */}
            {isUser && onEdit && (
              <button
                onClick={() => {
                  setEditText(content)
                  setEditing(true)
                }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-bg border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-primary/10 hover:border-primary/40"
                title="编辑消息"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
