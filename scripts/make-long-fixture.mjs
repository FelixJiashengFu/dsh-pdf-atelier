// Generates the stress-test fixture: a long book with parts, many sections and
// every component, so pagination, the contents and the stub logic get exercised.
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(import.meta.dirname, '..', 'test', 'fixtures')
const para = i => `第 ${i} 段用于检验长文档的分页表现。这里的文字只是排版测试用的占位内容，不陈述任何事实：段落有长有短，行距和字距需要保持稳定，中文与 English 混排时应当自动留出间隙，数字 ${i * 37} 也一样。标点不能出现在行首，“引号”和（括号）要贴紧相邻的文字。`

let md = ':::part 第一部分的名字\n:::\n\n'
for (let ch = 1; ch <= 9; ch += 1) {
  if (ch === 5) md += ':::part 第二部分的名字\n:::\n\n'
  md += `# 第 ${ch} 个主题的展开\n\n${para(ch)}\n\n`
  for (let sec = 1; sec <= 3; sec += 1) {
    md += `## 小节 ${ch}.${sec}\n\n${para(ch * 10 + sec)}\n\n${para(ch * 10 + sec + 1)}\n\n`
    if (sec === 1) md += `:::stats\n- ${ch * 11}% | 占位指标甲 | 测试数据\n- ${ch * 3} 项 | 占位指标乙 | 测试数据\n- ${ch}.${sec} | 占位指标丙 | 测试数据\n:::\n\n`
    if (sec === 2) md += `\`\`\`chart\n{"type":"${ch % 2 ? 'line' : 'bar'}","x":["甲","乙","丙","丁","戊"],"series":[{"name":"测试","values":[${ch},${ch * 2},${ch + 3},${ch * 3},${ch + 1}]}],"caption":"测试图表 ${ch}.${sec}，数据为占位。"}\n\`\`\`\n\n`
    if (sec === 3) md += `![占位配图 ${ch}，使用插件自带的示例图](demo.png "half")\n\n:::note 小结\n${para(ch)}\n:::\n\n### 更细一层\n\n${para(ch + 100)}\n\n`
  }
  if (ch % 3 === 0) {
    md += 'Table: 长表格跨页测试（占位）。\n\n| 序号 | 名称 | 数值 | 备注 |\n|---|---|---|---|\n'
    for (let r = 1; r <= 30; r += 1) md += `| ${r} | 条目 ${r} | ${(r * 3.14).toFixed(2)} | 占位说明文字 |\n`
    md += '\n'
  }
}
fs.writeFileSync(path.join(dir, 'long.md'), md)
const pkg = path.resolve(import.meta.dirname, '..', 'node_modules', '@jaxzhou', 'dsh-mathmatic-symbol', 'media', 'demo.png')
fs.copyFileSync(pkg, path.join(dir, 'demo.png'))
