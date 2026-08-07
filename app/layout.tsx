import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/Providers"
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "方向感 — AI 职业探索助手",
  description: "帮你找到自己的特性和方向",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
