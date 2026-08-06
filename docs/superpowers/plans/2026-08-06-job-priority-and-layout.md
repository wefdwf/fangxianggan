# 岗位优先级 + 布局适配 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在推荐岗位中增加 AI 决定的投递优先级标签，侧边栏同步显示；岗位详情从聊天窗口重写为纯报告卡片；响应式适配移动端和网页端。

**Architecture:** 6 个文件改动，按依赖顺序执行：类型定义 → Prompt → 展示组件 → 详情卡片重写 → 布局适配。`priority` 作为可选 string 字段贯穿全链路。

**Tech Stack:** Next.js 15 + React 19 + TypeScript + Tailwind CSS + @ai-sdk/react

---

### Task 1: 数据模型 — JobMatch 新增 priority 字段

**Files:**
- Modify: `lib/types.ts:22-27`

- [ ] **Step 1: 在 JobMatch 接口中新增 priority 字段**

```typescript
// lib/types.ts，在 JobMatch 接口中新增 priority 字段
export interface JobMatch {
  title: string
  match: number         // 0-100
  priority?: string     // 新增：AI 给出的投递优先级标签，如 "主攻方向"、"并行准备"、"看见就投"、"长期关注"
  reasons: string[]
  gaps: string[]
}
```

- [ ] **Step 2: 验证编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无类型错误（旧代码引用 `job.priority` 的地方可能暂时报 warning，但 `priority` 为可选字段所以不会报错）。

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: JobMatch 新增 priority 可选字段，支持 AI 投递优先级标签"
```

---

### Task 2: Prompt 更新 — 指导 AI 输出 priority + 市场供需维度

**Files:**
- Modify: `lib/prompts.ts`

- [ ] **Step 1: 更新 showResults 工具说明**

修改 `lib/prompts.ts`，在 `showResults` 工具说明的 `jobMatches` 描述中补充 priority 字段说明：

找到文件中 showResults 工具说明部分（位于 SYSTEM_PROMPT 模板字符串内），在当前 `- **showResults** → ...` 说明块中补充：

```typescript
// lib/prompts.ts — 在 showResults 工具说明中，jobMatches 描述后追加：

每个 jobMatch 必须包含 priority 字段（字符串），用于标明投递优先级。确定优先级时必须综合考虑以下维度：

1. **匹配度**：用户能力与岗位要求的契合程度
2. **市场供需**：该岗位的招聘规模、竞争激烈程度、地域分布
   - 岗位少但匹配高 → 不宜主攻（投了也不一定有机会）
   - 岗位多且匹配高 → 优先投递
3. **用户基础**：用户当前能力与岗位的差距大小，补足成本
4. **行业前景**：该方向 3-5 年的增长趋势

常见标签示例：
- "主攻方向"：匹配高、市场有需求、用户基础好，应集中精力主攻
- "并行准备"：值得投递但需补一些能力，可作为第二志愿并行准备
- "看见就投"：匹配尚可但市场规模有限/竞争激烈，碰到合适机会就投，不用花主要精力
- "长期关注"：目前差距较大但方向有价值，列入长期关注清单
- 你也可以根据用户情况自创更贴切的标签

priority 用自然语言灵活表达，让用户一眼看懂推荐力度。不要用数字或固定枚举。
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无报错（prompts.ts 是纯字符串导出，不涉及类型变更）。

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: prompt 中补充 priority 字段说明 + 市场供需等四个维度指导 AI 决定优先级"
```

---

### Task 3: JobMatchCard — 推荐卡片加优先级徽章

**Files:**
- Modify: `components/JobMatchCard.tsx`

- [ ] **Step 1: 在卡片标题行加优先级徽章**

修改 `components/JobMatchCard.tsx`：

```typescript
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
```

- [ ] **Step 2: 验证编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add components/JobMatchCard.tsx
git commit -m "feat: JobMatchCard 加优先级徽章，按标签类型匹配颜色"
```

---

### Task 4: Sidebar — 岗位列表加优先级 + 移动端宽度适配

**Files:**
- Modify: `components/Sidebar.tsx:48-83`

- [ ] **Step 1: 侧边栏岗位列表加优先级徽章，宽度改为 viewport 适配**

修改 `components/Sidebar.tsx`，岗位列表区域（约第 48-83 行）：

```typescript
// components/Sidebar.tsx — 替换侧边栏宽度和岗位列表部分

// 第 33 行：侧边栏宽度从 w-[260px] 改为响应式
<div className="fixed left-0 top-0 bottom-0 w-[min(280px,85vw)] bg-surface border-r border-border z-50 shadow-xl animate-slide-in flex flex-col">

// 第 48-83 行：替换推荐职位列表部分
{/* 推荐职位列表 */}
{jobMatches.length > 0 && (
  <div>
    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">推荐职位</h3>
    <div className="space-y-2">
      {jobMatches.map((job, i) => {
        const badgeBg = job.priority?.includes('主攻') ? '#fef2f2'
          : job.priority?.includes('并行') ? '#fffbeb'
          : job.priority?.includes('看见') || job.priority?.includes('就投') ? '#eff6ff'
          : job.priority?.includes('长期') ? '#f3f4f6'
          : '#f8fafc'
        const badgeText = job.priority?.includes('主攻') ? '#dc2626'
          : job.priority?.includes('并行') ? '#d97706'
          : job.priority?.includes('看见') || job.priority?.includes('就投') ? '#2563eb'
          : job.priority?.includes('长期') ? '#6b7280'
          : '#64748b'
        return (
          <button
            key={i}
            onClick={() => onJobClick?.(job)}
            className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
          >
            {job.priority && (
              <div className="mb-1">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: badgeText, backgroundColor: badgeBg }}
                >
                  {job.priority}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                {job.title}
              </span>
              <span className="text-xs font-bold text-primary tabular-nums">
                {job.match}%
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {job.reasons.slice(0, 2).map((r, ri) => (
                <span key={ri} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                  ✓ {r}
                </span>
              ))}
              {job.gaps.slice(0, 2).map((g, gi) => (
                <span key={gi} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                  ⚠ {g}
                </span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: 验证编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: Sidebar 岗位列表加优先级徽章；宽度改为 85vw 上限适配手机屏幕"
```

---

### Task 5: JobDetail — 重写为纯报告卡片

**Files:**
- Modify: `components/JobDetail.tsx`（全量重写）

- [ ] **Step 1: 重写 JobDetail.tsx**


```typescript
'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef } from 'react'
import type { JobMatch, SkillItem, HollandScores } from '@/lib/types'
import { renderMarkdown } from '@/lib/markdown'

interface Props {
  job: JobMatch
  skills: SkillItem[]
  hollandScores?: HollandScores
  onBack: () => void
}

/** 从 UIMessage 的 parts 中提取纯文本 */
function getText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
}

/** 优先级徽章颜色 */
function priorityBadgeStyle(priority: string): { bg: string; text: string } {
  if (priority.includes('主攻')) return { bg: '#fef2f2', text: '#dc2626' }
  if (priority.includes('并行')) return { bg: '#fffbeb', text: '#d97706' }
  if (priority.includes('看见') || priority.includes('就投')) return { bg: '#eff6ff', text: '#2563eb' }
  if (priority.includes('长期')) return { bg: '#f3f4f6', text: '#6b7280' }
  return { bg: '#f8fafc', text: '#64748b' }
}

/** 构建初始查询 prompt */
function buildQuery(job: JobMatch, skills: SkillItem[], hollandScores?: HollandScores): string {
  const skillsSummary = skills
    .map((s) => `${s.name}(AI评分${s.aiScore}${s.selfScore ? `,自评${s.selfScore}` : ''})`)
    .join('；')

  const hollandSummary = hollandScores
    ? `R=${hollandScores.R} I=${hollandScores.I} A=${hollandScores.A} S=${hollandScores.S} E=${hollandScores.E} C=${hollandScores.C}`
    : '未测评'

  return `请为【${job.title}】生成一份完整的岗位分析报告。投递优先级：${job.priority || '未指定'}。匹配度：${job.match}%。

按以下 6 个模块依次展开，每模块用小标题（###），内容充实、具体、可执行：

### 📖 岗位概述
这个岗位是做什么的、核心价值是什么、在哪些行业/公司中常见、行业分布特点。

### 💼 日常工作
典型的一天或一周工作内容、主要产出物、与哪些角色协作、痛点与挑战。

### ⭐ 你需要突出的能力
结合以下用户测评数据，指出面试和简历中最应强调的 3-5 项能力，并说明为什么：
- 霍兰德得分：${hollandSummary}
- 能力评估：${skillsSummary}
- 推荐理由：${job.reasons.join('、')}

### 🛤️ 准备路径
入行或转岗前需要补的知识/技能、推荐的学习资源（课程/书籍/项目）、大致时间规划。

### 📊 能力差距分析
将用户当前能力与岗位要求逐项对比，按差距优先级排列，给出补足建议。
- 需要补足：${job.gaps.join('、')}

### 🚀 下一步行动
3-5 条具体可执行的行动建议，每一条包含"做什么 + 怎么做 + 预期结果"。`
}

export default function JobDetail({ job, skills, hollandScores, onBack }: Props) {
  const matchColor = job.match >= 80 ? '#22c55e' : job.match >= 60 ? '#6366f1' : job.match >= 40 ? '#f59e0b' : '#ef4444'
  const badge = job.priority ? priorityBadgeStyle(job.priority) : null

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { step: 9 },
    }),
  })

  // 组件挂载后自动发送分析请求（仅一次）
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    requestAnimationFrame(() => {
      sendMessage({ text: buildQuery(job, skills, hollandScores) })
    })
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)
  const isBusy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 仅取 assistant 消息，过滤掉用户消息（初始查询不需要展示）
  const reportMessages = messages.filter((m) => m.role === 'assistant')

  return (
    <div className="absolute inset-0 z-50 bg-bg flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-lg hover:bg-bg transition-colors text-text-muted"
          aria-label="返回主对话"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {badge && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ color: badge.text, backgroundColor: badge.bg }}
            >
              {job.priority}
            </span>
          )}
          <span className="text-sm font-semibold text-text truncate">{job.title}</span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: matchColor, backgroundColor: `${matchColor}18` }}
        >
          {job.match}% 匹配
        </span>
      </div>

      {/* 报告内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {reportMessages.length === 0 && isBusy && (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
            <p className="text-sm">正在生成岗位分析报告...</p>
          </div>
        )}

        {reportMessages.length === 0 && !isBusy && (
          <div className="text-center py-10">
            <p className="text-text-muted text-sm">报告生成失败，请返回重试</p>
          </div>
        )}

        {reportMessages.map((m) => {
          const content = getText(m.parts)
          if (!content.trim()) return null
          return (
            <div key={m.id} className="prose prose-sm max-w-none text-text">
              {renderMarkdown(content)}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* 底部：仅返回按钮，无输入框 */}
      <div className="border-t border-border bg-surface p-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text-muted hover:text-text hover:border-primary/40 transition-colors"
        >
          ← 返回主对话
        </button>
      </div>
    </div>
  )
}
```

注意：`useChat` 的 `sendMessage` 在 `useEffect` 的 `requestAnimationFrame` 回调里调用是项目已有模式（参考 ChatArea.tsx 中 jumpTarget 的实现），没问题。`messages` 包含用户消息和 assistant 回复，只展示 `role === 'assistant'` 的消息。流式输出时 `useChat` 会更新同一条消息对象，`.map()` 单次渲染即可，不需要重复渲染。

- [ ] **Step 2: 验证编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add components/JobDetail.tsx
git commit -m "feat: JobDetail 重写为纯报告卡片，自动生成6模块分析，移除子对话"
```

---

### Task 6: page.tsx — 容器响应式宽度 + JobDetail 容器内定位

**Files:**
- Modify: `app/page.tsx:138-222`

- [ ] **Step 1: 主容器加 md:max-w-2xl**

`app/page.tsx` 第 139 行：

```diff
- <div className="flex flex-col h-full max-w-lg mx-auto bg-surface shadow-sm border-x border-border relative">
+ <div className="flex flex-col h-full max-w-lg md:max-w-2xl mx-auto bg-surface shadow-sm border-x border-border relative">
```

这个改动只需要一行，`relative` 已经存在（`border-border relative`），JobDetail 的 `absolute inset-0` 可以直接定位在容器内。

- [ ] **Step 2: 验证编译**

```bash
cd fangxianggan && npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: 主容器响应式宽度，移动端 max-w-lg，md+ 屏幕 max-w-2xl"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 编译 + Lint 检查**

```bash
cd fangxianggan && npm run build
```

Expected: 无 TypeScript 错误，无 lint 报错。

- [ ] **Step 2: 启动开发服务器，手动验证**

```bash
cd fangxianggan && npm run dev
```

验证项目：
1. 打开 `http://localhost:3000`
2. 完成 9 步流程（或跳转到 Step 8/9 查看推荐岗位）
3. 检查推荐卡片中是否有优先级徽章
4. 打开侧边栏，检查岗位列表是否显示优先级
5. 侧边栏宽度是否在手机视口内（可用 Chrome DevTools 模拟 iPhone SE: 375px）
6. 点击岗位 → 是否在容器内打开报告卡片（而非全屏）
7. 报告是否包含 6 大模块
8. 报告卡片底部是否只有"返回主对话"按钮，无输入框
9. 调整浏览器宽度到 768px+，容器是否变为 672px

- [ ] **Step 3: 标记验证完成**

```bash
touch .claude/.verification-done
```

- [ ] **Step 4: Commit**

```bash
git add .claude/.verification-done
git commit -m "chore: 标记验证完成 — 优先级+布局适配"
```

---

## 改动文件汇总

| # | 文件 | 改动 | 行数 |
|---|------|------|------|
| 1 | `lib/types.ts` | `JobMatch` 加 `priority?: string` | +1 |
| 2 | `lib/prompts.ts` | showResults 说明补充 priority + 市场供需 | +20 |
| 3 | `components/JobMatchCard.tsx` | 卡片标题加优先级徽章 | +15 |
| 4 | `components/Sidebar.tsx` | 岗位列表加优先级 + 宽度适配 | +20 |
| 5 | `components/JobDetail.tsx` | 全量重写（聊天→报告卡片） | 重写 |
| 6 | `app/page.tsx` | `max-w-lg` → `max-w-lg md:max-w-2xl` | 1 行 |
