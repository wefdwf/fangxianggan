# 方向感 — AI 职业探索助手

帮你看清自己适合做什么，找到匹配的岗位方向。

## 功能

- **霍兰德职业兴趣测评**（RIASEC 六型 · 24 题问卷 + 雷达图）
- **偏好输入 + 爱好反思**（区分兴趣和职业方向）
- **简历能力提取**（AI 从简历中提取 3-5 项核心能力并打分）
- **能力自评 + 追问 + 补充**（对比 AI 初评，发现盲区）
- **岗位推荐**（最多 8 个，含匹配度、优先级、理由、差距分析）
- **岗位深度分析报告**（6 模块卡片 · 概述 / 核心工作 / 突出能力 / 准备路径 / 差距分析 / 下一步行动）
- **云端同步**（登录后数据云端保存，未登录纯本地运行）

## 技术栈

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Vercel AI SDK · 千问 / DeepSeek · Supabase

## 本地运行

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:3002
```

## 环境变量

创建 `.env.local`：

```env
# === AI 模型（千问优先，DeepSeek 自动降级） ===
AI_PROVIDER=qwen
AI_MODEL=qwen-plus
DASHSCOPE_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx  # 备用

# === 可选 — 不配则降级为纯本地模式（无需登录） ===
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```
