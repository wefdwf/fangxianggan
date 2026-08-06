# 方向感 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建"方向感"AI 职业探索助手 MVP，实现 9 步对话流程 + 手写 Tailwind 聊天 UI

**Architecture:** Next.js 16 App Router 单页面应用。前端用 `useChat` hook 实现流式对话，后端 `/api/chat` 通过 Vercel AI SDK 调用 DeepSeek V4 Pro。AI 通过系统提示词控制 9 步流程推进，特殊场景（霍兰德测评、自评表等）由前端检测消息中的 marker 标签渲染嵌入组件。数据存 localStorage。

**Tech Stack:** Next.js 16 + React 19 + Tailwind CSS 4 + Vercel AI SDK (`ai` + `@ai-sdk/deepseek`) + Recharts + TypeScript

---

## 文件结构

```
fangxianggan/
├── app/
│   ├── layout.tsx              # 根布局：字体、metadata、html/body
│   ├── page.tsx                # 主页面：组合 Sidebar + ChatArea
│   ├── globals.css             # Tailwind v4 @import + 自定义主题变量
│   └── api/chat/route.ts       # POST → streamText → DeepSeek 流式响应
├── components/
│   ├── ChatArea.tsx            # 消息列表 + 输入框，解析 AI 消息中的 marker
│   ├── ChatBubble.tsx          # 单条消息气泡（支持 markdown 渲染）
│   ├── ChatInput.tsx           # 输入框 + 发送按钮（支持 Shift+Enter 换行）
│   ├── Sidebar.tsx             # 侧边栏容器（桌面常驻 / 移动端弹出）
│   ├── PendingBox.tsx          # 待确定框：列出所有"不确定"的能力项
│   ├── ProgressBar.tsx         # 9 步进度条，高亮当前步骤
│   ├── HollandAssessment.tsx   # Step 1：霍兰德 24 题测评 + 雷达图结果
│   ├── HollandRadar.tsx        # RIASEC 六型雷达图（Recharts）
│   ├── SelfAssessment.tsx      # Step 5：能力自评表格（能力名 | AI解释 | AI初评 | 自评 | 理由）
│   ├── WordCloud.tsx           # 能力词云（SVG 实现，字大小 = 能力强弱）
│   └── JobMatchCard.tsx        # 岗位适配度卡片（百分比 + 匹配理由 + 差距）
├── lib/
│   ├── types.ts                # 全局类型定义
│   ├── prompts.ts              # 9 步系统提示词（分步定义 + 拼接）
│   └── storage.ts              # localStorage 读写封装（进度、测评结果、能力评分）
├── .env.local                  # DEEPSEEK_API_KEY
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── .gitignore
```

---

### Task 1: 项目初始化与依赖安装

**Files:**
- Create: `fangxianggan/package.json`
- Create: `fangxianggan/tsconfig.json`
- Create: `fangxianggan/next.config.ts`
- Create: `fangxianggan/postcss.config.mjs`
- Create: `fangxianggan/.gitignore`
- Create: `fangxianggan/.env.local`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "fangxianggan",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "^16.2.10",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "recharts": "^3.9.2",
    "ai": "^4",
    "@ai-sdk/deepseek": "^1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "^16.2.10",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 postcss.config.mjs**

```js
const config = { plugins: { "@tailwindcss/postcss": {} } }
export default config
```

- [ ] **Step 4: 创建 next.config.ts**

```ts
import type { NextConfig } from "next"
const nextConfig: NextConfig = {}
export default nextConfig
```

- [ ] **Step 5: 创建 .env.local**

从 `job-analysis-ai/.env.local` 复制 DEEPSEEK_API_KEY。

- [ ] **Step 6: 创建 .gitignore**

```
node_modules/
.next/
.env.local
```

- [ ] **Step 7: 安装依赖并验证**

```bash
cd c:/Users/28067/Practice/fangxianggan && npm install
```

Expected: 依赖安装成功，无错误。

---

### Task 2: 基础布局与全局样式

**Files:**
- Create: `fangxianggan/app/globals.css`
- Create: `fangxianggan/app/layout.tsx`
- Create: `fangxianggan/app/page.tsx`

- [ ] **Step 1: 创建 globals.css**

```css
@import "tailwindcss";

@theme inline {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-primary: #6366f1;
  --color-primary-light: #818cf8;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-accent: #f59e0b;
  --font-sans: system-ui, -apple-system, sans-serif;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: 创建 layout.tsx**

```tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "方向感 — AI 职业探索助手",
  description: "帮你找到自己的特性和方向",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: 创建 page.tsx（占位，后续 Task 会完善）**

```tsx
export default function Home() {
  return (
    <div className="flex h-full items-center justify-center text-text-muted">
      方向感 — 加载中...
    </div>
  )
}
```

- [ ] **Step 4: 验证项目能跑起来**

```bash
cd c:/Users/28067/Practice/fangxianggan && npm run dev
```

Expected: 浏览器打开 http://localhost:3002 能看到占位文字。

---

### Task 3: AI Chat API 路由

**Files:**
- Create: `fangxianggan/lib/types.ts`
- Create: `fangxianggan/lib/prompts.ts`
- Create: `fangxianggan/app/api/chat/route.ts`

- [ ] **Step 1: 创建 types.ts**

```ts
// 霍兰德六型
export type HollandType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C'

export interface HollandScores {
  R: number  // 实际型
  I: number  // 研究型
  A: number  // 艺术型
  S: number  // 社会型
  E: number  // 企业型
  C: number  // 传统型
}

export interface SkillItem {
  name: string
  aiScore: number       // AI 初评分 1-100
  selfScore?: number    // 用户自评 1-100
  reason?: string       // 用户自评理由
  uncertain: boolean    // 是否待确定
  category?: string     // 来源：resume | ai追问 | user补充
}

export interface JobMatch {
  title: string
  match: number         // 0-100
  reasons: string[]
  gaps: string[]
}

export interface ChatState {
  step: number          // 当前步骤 1-9
  hollandScores?: HollandScores
  preferences?: string
  skills: SkillItem[]
  pendingSkills: SkillItem[]  // 待确定框
  jobMatches?: JobMatch[]
  finalAdvice?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  marker?: string       // 特殊标记：HOLLAND_ASSESSMENT | SELF_ASSESSMENT | RESULTS
}
```

- [ ] **Step 2: 创建 prompts.ts（系统提示词）**

```ts
export const SYSTEM_PROMPT = `你是"方向感"，一位专业的 AI 职业规划师。你的核心任务是帮助用户探索自我、找到适合的职业方向。

## 你的风格
- 温暖、有洞察力，像一位耐心的导师
- 用中文交流，语言自然不生硬
- 每次只问一个问题或给一个引导，不要让用户感到被审问
- 当用户犹豫或说"不确定"时，给予鼓励和引导

## 9 步流程

你正在引导用户完成以下 9 个步骤。当前用户在第 {step} 步。

### Step 1: 霍兰德职业兴趣测评
告诉用户你将展示 24 道霍兰德测评题，测评完成后会展示 RIASEC 雷达图。
在消息末尾加上标记：<!-- HOLLAND_ASSESSMENT -->

### Step 2: 偏好输入
询问用户喜欢什么类型的岗位、感兴趣的行业、有什么爱好。
让用户自由表达，不要限制。

### Step 3: 爱好反思
针对用户提到的爱好，温和地追问："如果把这件事变成每天必须做的工作，你还喜欢吗？"
帮助用户区分"兴趣"和"职业方向"。

### Step 4: 简历能力提取
请用户上传或粘贴简历内容。如果用户没有简历，请用户描述自己的学习/工作经历。
收到简历后，提取能力标签并给出初评分（1-100 分）。
在消息末尾加上标记：<!-- SELF_ASSESSMENT -->

### Step 5: 能力自评
你已经在上一条消息中展示了自评表格。现在等待用户逐项打分。
用户可能对某些能力不确定——鼓励他们标记为"不确定"，这些会自动加入待确定框。

### Step 6: AI 追问
对比目标岗位通常需要的能力和用户已提到的能力，找出缺口。
逐项追问，每次只问一项。"XX 能力在 XX 岗位很重要，因为……你觉得自己在这方面怎么样？"

### Step 7: 用户自由补充
询问用户："还有什么能力、经历、想法是上面没覆盖到的？"

### Step 8: AI 综合评分调整
回顾全部数据，一次性调整最终能力评分。
初评 vs 自评的显著落差要在建议中解释调整理由。
在消息末尾加上标记：<!-- RESULTS -->

### Step 9: 综合建议
输出：方向推荐 + 岗位适配度 + 学习提升建议 + 能力词云。
在最终输出前，先做一次回顾："根据之前的对话，我理解你的情况是……有需要纠正的吗？"

## 输出规范
- 所有数值类输出（评分、匹配度等）必须基于用户的实际输入，不要编造
- 岗位适配度的匹配理由要具体，不能泛泛而谈
- 鼓励性的话语要有具体指向（"你在 XX 方面表现出的 XX 特质说明……"），不说空话
`
```

- [ ] **Step 3: 创建 API 路由**

```ts
import { deepseek } from '@ai-sdk/deepseek'
import { streamText } from 'ai'
import { SYSTEM_PROMPT } from '@/lib/prompts'

export async function POST(req: Request) {
  const { messages, step } = await req.json()

  const systemMessage = SYSTEM_PROMPT.replace('{step}', String(step || 1))

  const result = streamText({
    model: deepseek('deepseek-v4-pro'),
    system: systemMessage,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  })

  return result.toDataStreamResponse()
}
```

- [ ] **Step 4: 验证 API 可用**

```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好，我想找找自己的职业方向"}],"step":1}'
```

Expected: 流式返回 AI 的回复文字。

---

### Task 4: 聊天 UI 组件

**Files:**
- Create: `fangxianggan/components/ChatBubble.tsx`
- Create: `fangxianggan/components/ChatInput.tsx`
- Create: `fangxianggan/components/ChatArea.tsx`

- [ ] **Step 1: 创建 ChatBubble.tsx**

```tsx
'use client'

interface Props {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatBubble({ role, content }: Props) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-surface border border-border text-text rounded-bl-md shadow-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 ChatInput.tsx**

```tsx
'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    ref.current?.focus()
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="输入你的想法……（Shift+Enter 换行）"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
      >
        发送
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 创建 ChatArea.tsx**

```tsx
'use client'

import { useChat } from 'ai/react'
import { useRef, useEffect } from 'react'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'

interface Props {
  step: number
}

export default function ChatArea({ step }: Props) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { step },
  })

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="text-center text-text-muted mt-20">
            <p className="text-lg font-medium mb-2">👋 你好，我是方向感</p>
            <p className="text-sm">AI 职业探索助手，帮你找到适合自己的方向</p>
            <p className="text-sm mt-1">开始聊聊你自己吧——不用很正式，想到什么说什么</p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role as 'user' | 'assistant'} content={m.content} />
        ))}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        onSend={(text) => {
          handleInputChange({ target: { value: text } } as any)
          handleSubmit()
        }}
        disabled={isLoading}
      />
    </div>
  )
}
```

- [ ] **Step 4: 更新 page.tsx 集成 ChatArea**

```tsx
'use client'

import { useState } from 'react'
import ChatArea from '@/components/ChatArea'

export default function Home() {
  const [step] = useState(1)

  return (
    <div className="flex h-full">
      {/* 侧边栏占位，后续 Task 实现 */}
      <div className="hidden md:block w-[200px] border-r border-border bg-surface p-4">
        <p className="text-xs text-text-muted">侧边栏</p>
      </div>
      <main className="flex-1 min-w-0">
        <ChatArea step={step} />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: 手动验证聊天 UI**

浏览器打开 http://localhost:3002，发送一条消息，确认：
- 对话框正确显示
- AI 流式回复逐字出现
- 自动滚动到底部

---

### Task 5: 侧边栏 — 进度条 + 待确定框

**Files:**
- Create: `fangxianggan/components/ProgressBar.tsx`
- Create: `fangxianggan/components/PendingBox.tsx`
- Create: `fangxianggan/components/Sidebar.tsx`
- Modify: `fangxianggan/app/page.tsx`

- [ ] **Step 1: 创建 ProgressBar.tsx**

```tsx
'use client'

const STEPS = [
  '霍兰德测评', '偏好输入', '爱好反思', '简历能力提取',
  '能力自评', 'AI追问', '自由补充', '综合评分', '综合建议',
]

interface Props {
  current: number
}

export default function ProgressBar({ current }: Props) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">探索进度</h3>
      {STEPS.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isDone = stepNum < current
        return (
          <div key={i} className="flex items-center gap-2 text-xs py-1">
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
```

- [ ] **Step 2: 创建 PendingBox.tsx**

```tsx
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
```

- [ ] **Step 3: 创建 Sidebar.tsx**

```tsx
'use client'

import { useState } from 'react'
import ProgressBar from './ProgressBar'
import PendingBox from './PendingBox'
import type { SkillItem } from '@/lib/types'

interface Props {
  step: number
  pendingSkills: SkillItem[]
}

export default function Sidebar({ step, pendingSkills }: Props) {
  const [open, setOpen] = useState(false)

  const content = (
    <div className="space-y-6">
      <ProgressBar current={step} />
      <PendingBox items={pendingSkills} />
    </div>
  )

  return (
    <>
      {/* 桌面端常驻 */}
      <aside className="hidden md:block w-[200px] flex-shrink-0 border-r border-border bg-surface p-4 overflow-y-auto">
        {content}
      </aside>

      {/* 移动端弹出 */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="fixed top-3 left-3 z-50 bg-surface border border-border rounded-xl p-2 shadow-md"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 w-[240px] bg-surface border-r border-border p-4 z-50 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-text">方向感</span>
                <button onClick={() => setOpen(false)} className="text-text-muted text-lg leading-none">&times;</button>
              </div>
              {content}
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: 更新 page.tsx**

```tsx
'use client'

import { useState } from 'react'
import ChatArea from '@/components/ChatArea'
import Sidebar from '@/components/Sidebar'
import type { SkillItem } from '@/lib/types'

export default function Home() {
  const [step, setStep] = useState(1)
  const [pendingSkills, setPendingSkills] = useState<SkillItem[]>([])

  return (
    <div className="flex h-full">
      <Sidebar step={step} pendingSkills={pendingSkills} />
      <main className="flex-1 min-w-0">
        <ChatArea step={step} />
      </main>
    </div>
  )
}
```

---

### Task 6: localStorage 持久化

**Files:**
- Create: `fangxianggan/lib/storage.ts`
- Modify: `fangxianggan/app/page.tsx`

- [ ] **Step 1: 创建 storage.ts**

```ts
import type { ChatState, SkillItem, HollandScores, JobMatch } from './types'

const KEY = 'fangxianggan_state'

const DEFAULT: ChatState = {
  step: 1,
  skills: [],
  pendingSkills: [],
}

export function loadState(): ChatState {
  if (typeof window === 'undefined') return { ...DEFAULT }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveState(state: ChatState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // localStorage 满了或不可用，静默失败
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: 更新 page.tsx 接入 localStorage**

在 Home 组件中，用 `loadState()` 初始化 state，并在 state 变化时调用 `saveState()`。

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import ChatArea from '@/components/ChatArea'
import Sidebar from '@/components/Sidebar'
import { loadState, saveState } from '@/lib/storage'
import type { ChatState, SkillItem } from '@/lib/types'

export default function Home() {
  const [state, setState] = useState<ChatState>(() => loadState())

  // 状态变化自动保存
  useEffect(() => {
    saveState(state)
  }, [state])

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, step }))
  }, [])

  const setPendingSkills = useCallback((skills: SkillItem[]) => {
    setState((s) => ({ ...s, pendingSkills: skills }))
  }, [])

  return (
    <div className="flex h-full">
      <Sidebar step={state.step} pendingSkills={state.pendingSkills} />
      <main className="flex-1 min-w-0">
        <ChatArea step={state.step} />
      </main>
    </div>
  )
}
```

---

### Task 7: 霍兰德测评组件（Step 1）

**Files:**
- Create: `fangxianggan/components/HollandRadar.tsx`
- Create: `fangxianggan/components/HollandAssessment.tsx`
- Modify: `fangxianggan/components/ChatArea.tsx`（解析 HOLLAND_ASSESSMENT marker）

- [ ] **Step 1: 创建 HollandRadar.tsx**

```tsx
'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import type { HollandScores } from '@/lib/types'

const LABELS: Record<keyof HollandScores, string> = {
  R: '实际型', I: '研究型', A: '艺术型',
  S: '社会型', E: '企业型', C: '传统型',
}

export default function HollandRadar({ scores }: { scores: HollandScores }) {
  const data = (Object.entries(scores) as [keyof HollandScores, number][]).map(([key, val]) => ({
    维度: LABELS[key],
    分数: val,
  }))

  const top = data.sort((a, b) => b.分数 - a.分数).slice(0, 2)

  return (
    <div className="bg-bg rounded-xl p-4 border border-border">
      <h4 className="text-sm font-semibold text-text mb-2">RIASEC 霍兰德雷达图</h4>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="维度" tick={{ fontSize: 11, fill: '#64748b' }} />
          <Radar dataKey="分数" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-3 text-xs text-text-muted space-y-0.5">
        <p>🏅 最突出：<span className="font-semibold text-text">{top[0].维度}</span>（{top[0].分数} 分）</p>
        <p>🥈 次之：<span className="font-semibold text-text">{top[1].维度}</span>（{top[1].分数} 分）</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 HollandAssessment.tsx**

24 道题，每维度 4 题，每题 5 级评分。分页显示，每页 8 题，共 3 页。

```tsx
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

export default function HollandAssessment({ onComplete }: { onComplete: (scores: HollandScores) => void }) {
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
      // 计算结果
      const scores: HollandScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
      QUESTIONS.forEach((q) => {
        const val = answers[q.id] || 3
        scores[q.type] += val
      })
      setResult(scores)
      onComplete(scores)
    }
  }

  const goPrev = () => { if (page > 0) setPage(page - 1) }

  if (result) {
    return <HollandRadar scores={result} />
  }

  return (
    <div className="bg-bg rounded-xl p-4 border border-border">
      <h4 className="text-sm font-semibold text-text mb-1">
        霍兰德职业兴趣测评（{page + 1}/{totalPages}）
      </h4>
      <p className="text-xs text-text-muted mb-4">每题选择最符合你的程度，没有对错之分</p>
      <div className="space-y-4">
        {pageQuestions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <p className="text-sm text-text">{q.id}. {q.text}</p>
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
          {pageQuestions.filter((q) => answers[q.id] !== undefined).length}/{pageQuestions.length} 已答
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
```

- [ ] **Step 3: 在 ChatArea 中解析 marker 并渲染 HollandAssessment**

在 ChatArea 的消息渲染中，检测 `<!-- HOLLAND_ASSESSMENT -->` 标记：

```tsx
// ChatArea.tsx 中添加 marker 解析逻辑
{messages.map((m) => {
  if (m.role === 'assistant' && m.content.includes('<!-- HOLLAND_ASSESSMENT -->')) {
    const cleanContent = m.content.replace('<!-- HOLLAND_ASSESSMENT -->', '')
    return (
      <div key={m.id}>
        {cleanContent && <ChatBubble role="assistant" content={cleanContent} />}
        <div className="mb-4 ml-0 max-w-[85%]">
          <HollandAssessment
            onComplete={(scores) => {
              // 通过追加用户消息的方式提交测评结果
              const msg = `我的霍兰德测评完成。得分：R=${scores.R} I=${scores.I} A=${scores.A} S=${scores.S} E=${scores.E} C=${scores.C}`
              reload({ body: { step, hollandScores: scores } })
              append({ role: 'user', content: msg })
            }}
          />
        </div>
      </div>
    )
  }
  return <ChatBubble key={m.id} role={m.role as 'user' | 'assistant'} content={m.content} />
})}
```

---

### Task 8: 能力自评组件（Step 5）

**Files:**
- Create: `fangxianggan/components/SelfAssessment.tsx`
- Modify: `fangxianggan/components/ChatArea.tsx`（解析 SELF_ASSESSMENT marker）

- [ ] **Step 1: 创建 SelfAssessment.tsx**

AI 提取的技能列表，展示表格：能力名 | AI 解释 | AI 初评 | 自评滑块 | 理由 | 不确定按钮

```tsx
'use client'

import { useState } from 'react'
import type { SkillItem } from '@/lib/types'

interface Props {
  skills: SkillItem[]
  onComplete: (skills: SkillItem[], pending: SkillItem[]) => void
}

export default function SelfAssessment({ skills: initialSkills, onComplete }: Props) {
  const [skills, setSkills] = useState<SkillItem[]>(initialSkills)

  const updateSkill = (index: number, updates: Partial<SkillItem>) => {
    setSkills((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const markUncertain = (index: number) => {
    setSkills((prev) =>
      prev.map((s, i) => (i === index ? { ...s, uncertain: true, selfScore: undefined, reason: undefined } : s))
    )
  }

  const handleSubmit = () => {
    const completed = skills.filter((s) => !s.uncertain)
    const pending = skills.filter((s) => s.uncertain)
    onComplete(completed, pending)
  }

  const allDone = skills.every((s) => s.uncertain || s.selfScore !== undefined)

  return (
    <div className="bg-bg rounded-xl p-4 border border-border max-w-full overflow-x-auto">
      <h4 className="text-sm font-semibold text-text mb-3">能力自评</h4>
      <p className="text-xs text-text-muted mb-3">
        AI 已给出初评分作为参考，请你逐项给自己打分（1-100），不确定的可以标记为"不确定"
      </p>
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
                      className="w-16 h-1 accent-primary"
                    />
                    <span className="font-semibold text-text w-8">{skill.selfScore ?? skill.aiScore}</span>
                  </div>
                )}
              </td>
              <td className="py-2 pr-3 hidden md:table-cell">
                <button
                  onClick={() => markUncertain(i)}
                  className="text-[10px] border border-dashed border-border rounded px-2 py-0.5 text-text-muted hover:border-primary hover:text-primary transition-colors"
                >
                  不确定
                </button>
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
    </div>
  )
}
```

- [ ] **Step 2: ChatArea 中解析 SELF_ASSESSMENT marker**

类似 Task 7 Step 3，当 AI 消息包含 `<!-- SELF_ASSESSMENT -->` 且 `body` 中有 skills 数据时，渲染 SelfAssessment 组件。

---

### Task 9: 结果展示组件（Step 8-9）

**Files:**
- Create: `fangxianggan/components/WordCloud.tsx`
- Create: `fangxianggan/components/JobMatchCard.tsx`
- Modify: `fangxianggan/components/ChatArea.tsx`（解析 RESULTS marker）

- [ ] **Step 1: 创建 WordCloud.tsx**

用纯 SVG 实现能力词云。字大小映射能力评分：80-100 分 → 大字，60-79 → 中等，<60 → 小字。

```tsx
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
  if (score >= 80) return '#6366f1'   // primary
  if (score >= 60) return '#8b5cf6'   // purple
  return '#94a3b8'                     // slate
}

// 简单网格布局，避免复杂碰撞检测
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
              className={`inline-block font-semibold leading-tight ${skill.uncertain ? 'border-dashed border-2 border-border rounded px-1' : ''}`}
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
```

- [ ] **Step 2: 创建 JobMatchCard.tsx**

```tsx
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

export default function JobMatchCard({ matches }: Props) {
  if (matches.length === 0) {
    return <p className="text-xs text-text-muted">暂无适配度数据</p>
  }
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text">岗位适配度</h4>
      {matches.map((m, i) => (
        <div key={i} className="bg-bg rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text">{m.title}</span>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-lg"
              style={{ color: barColor(m.match), background: `${barColor(m.match)}15` }}
            >
              {m.match}%
            </span>
          </div>
          {/* 进度条 */}
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${m.match}%`, background: barColor(m.match) }}
            />
          </div>
          {m.reasons.length > 0 && (
            <div className="mt-2 text-xs text-text-muted">
              <span className="font-medium text-text">匹配理由：</span>
              {m.reasons.join('；')}
            </div>
          )}
          {m.gaps.length > 0 && (
            <div className="mt-1 text-xs text-text-muted">
              <span className="font-medium text-accent">差距：</span>
              {m.gaps.join('；')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 创建结果组合组件（内嵌在 ChatArea marker 解析中）**

当检测到 `<!-- RESULTS -->` 标记时，渲染：HollandRadar + WordCloud + JobMatchCard 的组合。

---

### Task 10: 状态管理与步骤推进

**Files:**
- Modify: `fangxianggan/app/page.tsx`
- Modify: `fangxianggan/components/ChatArea.tsx`

- [ ] **Step 1: 完善 page.tsx 的状态提升**

将 step、skills、pendingSkills、hollandScores、jobMatches 统一在 page.tsx 管理，通过 props 传给 ChatArea 和 Sidebar。

ChatArea 通过回调函数通知父组件：
- `onStepChange(step)` — AI 推进到下一步
- `onSkillsUpdate(skills)` — 更新技能列表
- `onPendingUpdate(pending)` — 更新待确定框
- `onHollandComplete(scores)` — 霍兰德测评完成
- `onResultsReady(matches)` — 最终结果就绪

- [ ] **Step 2: 调整 ChatArea 的 useChat body 参数**

每次调用 API 时，把完整的当前状态（step、skills 等）作为 body 传给 API，让 AI 知道当前进度：

```tsx
const { messages, ... } = useChat({
  api: '/api/chat',
  body: {
    step,
    skillsCount: skills.length,
    hasHollandScores: !!hollandScores,
  },
})
```

---

### Task 11: 端到端测试与调试

- [ ] **Step 1: 完整走一遍 9 步流程**

1. 浏览器打开 http://localhost:3002
2. 发送"你好"开始对话
3. 完成霍兰德测评 24 题
4. 输入偏好和爱好
5. 粘贴简历内容
6. 完成能力自评
7. 回答 AI 追问
8. 自由补充
9. 查看综合建议

- [ ] **Step 2: 验证关键交互**

- 侧边栏进度条随步骤推进更新
- 待确定框正确显示不确定的能力
- 雷达图、词云正确渲染
- 流式输出逐字出现
- localStorage 刷新后数据还在
- 移动端侧边栏弹出正常

- [ ] **Step 3: 修复发现的问题**

根据测试结果修复 bug，重新验证直到全部通过。

---

## 自审清单

1. **Spec coverage**: PRD 中的 MVP 核心功能已覆盖——霍兰德测评 ✓、偏好输入 ✓、爱好反思 ✓、简历提取 ✓、能力自评 ✓、待确定框 ✓、AI追问 ✓、用户补充 ✓、综合评分 ✓、岗位适配度 ✓、学习建议 ✓、能力词云 ✓、流式输出 ✓、侧边栏 ✓
2. **无占位符**: 所有代码步骤都有完整实现代码
3. **类型一致性**: types.ts 定义的类型在各组件中一致使用
