// 从 ChatArea.tsx 复制的函数
function findMatchingBrace(content, pos) {
  let depth = 0
  let inString = false
  for (let i = pos; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (ch === '\') { i++; continue }
      if (ch === '"') { inString = false }
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') { depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function tryExtractJson(content) {
  // 策略 1: 三反引号
  const tripleMatch = content.match(/```(?:json)?\s*\r?\n/)
  if (tripleMatch && tripleMatch.index !== undefined) {
    const afterMarker = tripleMatch.index + tripleMatch[0].length
    const openBrace = content.indexOf('{', afterMarker)
    if (openBrace >= 0) {
      const jsonEnd = findMatchingBrace(content, openBrace)
      if (jsonEnd >= 0) {
        try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) }
        catch(e) { console.log('  S1 parse err:', e.message.slice(0,60)) }
      } else { console.log('  S1: no matching }') }
    } else { console.log('  S1: no { after marker') }
  } else { console.log('  S1: no triple backtick match') }

  // 策略 2: 单反引号
  const backtickMatch = content.match(/`(?:json\s*)?\{/)
  if (backtickMatch && backtickMatch.index !== undefined) {
    const openBrace = backtickMatch.index + backtickMatch[0].length - 1
    const jsonEnd = findMatchingBrace(content, openBrace)
    if (jsonEnd >= 0) {
      try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) }
      catch(e) { console.log('  S2 parse err:', e.message.slice(0,60)) }
    } else { console.log('  S2: no matching }') }
  } else { console.log('  S2: no backtick+{ match') }

  // 策略 3: 裸 JSON
  const bareMatch = content.match(/\{\s*"(?:skills|jobMatches|matches)"/)
  if (bareMatch && bareMatch.index !== undefined) {
    const openBrace = bareMatch.index
    const jsonEnd = findMatchingBrace(content, openBrace)
    if (jsonEnd >= 0) {
      try { return JSON.parse(content.slice(openBrace, jsonEnd + 1)) }
      catch(e) { console.log('  S3 parse err:', e.message.slice(0,60)) }
    } else { console.log('  S3: no matching }') }
  } else { console.log('  S3: no bare JSON match') }

  return null
}

// 测试用例 1: 标准三反引号（Unix 换行）
const test1 = `好的，让我们回顾一下...

\`\`\`json
{
  "skills": [
    {"name": "实验操作", "aiScore": 80}
  ],
  "jobMatches": [
    {"title": "产品经理", "match": 80, "reasons": ["分析能力强"], "gaps": ["缺商业知识"]}
  ]
}
\`\`\`

<!-- RESULTS -->
<!-- STEP:8 -->`

console.log("=== 测试 1: 标准三反引号 ===")
console.log("content 长度:", test1.length)
console.log("包含 RESULTS:", test1.includes('RESULTS'))
console.log("包含三反引号:", test1.includes('```'))
const r1 = tryExtractJson(test1)
console.log("结果:", r1 ? `skills=${r1.skills?.length}, jobs=${r1.jobMatches?.length}` : 'NULL')

// 测试用例 2: Windows 换行 \r\n
const test2 = test1.replace(/\n/g, '\r\n')
console.log("\n=== 测试 2: Windows 换行 ===")
const r2 = tryExtractJson(test2)
console.log("结果:", r2 ? `skills=${r2.skills?.length}, jobs=${r2.jobMatches?.length}` : 'NULL')

// 测试用例 3: 无 json 标记的三反引号
const test3 = test1.replace('```json', '```')
console.log("\n=== 测试 3: 无 json 标记 ===")
const r3 = tryExtractJson(test3)
console.log("结果:", r3 ? `skills=${r3.skills?.length}, jobs=${r3.jobMatches?.length}` : 'NULL')

// 测试用例 4: 单反引号内联
const test4 = '推荐岗位：\`json {"skills":[{"name":"A","aiScore":80}],"jobMatches":[{"title":"PM","match":80}]}\`'
console.log("\n=== 测试 4: 单反引号内联 ===")
const r4 = tryExtractJson(test4)
console.log("结果:", r4 ? `skills=${r4.skills?.length}, jobs=${r4.jobMatches?.length}` : 'NULL')

// 测试用例 5: 裸 JSON
const test5 = '这是推荐：{"skills":[{"name":"A","aiScore":80}],"jobMatches":[{"title":"PM","match":80}]}请查看。'
console.log("\n=== 测试 5: 裸 JSON ===")
const r5 = tryExtractJson(test5)
console.log("结果:", r5 ? `skills=${r5.skills?.length}, jobs=${r5.jobMatches?.length}` : 'NULL')

