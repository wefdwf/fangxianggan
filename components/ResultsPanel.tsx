'use client'

import type { HollandScores, SkillItem, JobMatch } from '@/lib/types'
import HollandRadar from './HollandRadar'
import WordCloud from './WordCloud'
import JobMatchCard from './JobMatchCard'

interface Props {
  hollandScores?: HollandScores
  skills: SkillItem[]
  jobMatches: JobMatch[]
}

export default function ResultsPanel({ hollandScores, skills, jobMatches }: Props) {
  return (
    <div className="space-y-4">
      {hollandScores && <HollandRadar scores={hollandScores} />}
      {skills.length > 0 && <WordCloud skills={skills} />}
      {jobMatches.length > 0 && <JobMatchCard matches={jobMatches} />}
      {!hollandScores && skills.length === 0 && jobMatches.length === 0 && (
        <p className="text-xs text-text-muted">AI 正在准备你的综合报告...</p>
      )}
    </div>
  )
}
