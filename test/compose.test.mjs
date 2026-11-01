import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getDocumentProxy } from 'unpdf'
import { composePdf } from '../lib/compose.js'
import { apply, name } from '../lib/index.js'

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-test-')))
test.after(() => fs.rmSync(root, { recursive: true, force: true }))

async function pageTexts(file) {
  const doc = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)), { verbosity: 0 })
  const pages = []
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent()
    pages.push(content.items.map(i => i.str).join('').replace(/\s+/g, ''))
  }
  return pages
}

const CHAPTERS = n => Array.from({ length: n }, (_, i) => `# 章节${'甲乙丙丁戊'[i]}\n\n这是第 ${i + 1} 章的内容，含公式 $a^2+b^2=c^2$ 与一些文字。\n\n## 小节${i + 1}\n\n${'文字用于撑开页面。'.repeat(40)}`).join('\n\n')

test('contents page numbers match where the chapters really are', async () => {
  const report = await composePdf({ path: 'a/toc.pdf', title: '目录测试', body: CHAPTERS(4), doc_type: 'report' }, { root })
  assert.equal(report.warnings.length, 0, report.warnings.join('; '))
  const pages = await pageTexts(report.host_path)
  assert.equal(pages.length, report.pages)
  const contents = pages[1]
  for (const title of ['章节甲', '章节乙', '章节丙', '章节丁']) {
    const actual = pages.findIndex((text, i) => i > 1 && text.includes(title)) + 1
    assert.ok(actual > 2, title)
    assert.match(contents, new RegExp(`${title}${actual}`), `${title} should point at page ${actual}`)
  }
})

test('Chinese text copies out as real characters, not Kangxi radicals', async () => {
  const report = await composePdf({ path: 'copy.pdf', title: '复制测试', body: '# 第一章\n\n一二三文字面对。\n\n# 第二章\n\n正文。\n\n# 第三章\n\n正文。', doc_type: 'report', lang: 'zh' }, { root })
  const text = (await pageTexts(report.host_path)).join('')
  assert.ok(text.includes('一二三文字面对'), text.slice(0, 200))
  assert.ok(!/[⺀-⿟]/.test(text), 'radical code points leaked into the text layer')
})

test('a lone top heading becomes the title and sections become chapters', async () => {
  const body = `# 我的报告\n\n## 第一节\n\n${'内容。'.repeat(300)}\n\n## 第二节\n\n${'内容。'.repeat(300)}\n\n## 第三节\n\n内容。`
  const report = await composePdf({ path: 'lift.pdf', body }, { root })
  assert.equal(report.doc_type, 'report')
  const pages = await pageTexts(report.host_path)
  assert.ok(pages[0].includes('我的报告'))
  assert.ok(pages[1].includes('目录'))
})

test('a formula in a chapter heading reaches the opener, contents and running head', async () => {
  const body = '# 晶体 $\\mathrm{ABX_3}$ 的结构\n\n正文。\n\n# 第二章\n\n正文。\n\n# 第三章\n\n正文。'
  const report = await composePdf({ path: 'mathhead.pdf', title: '公式标题', body, doc_type: 'report', keep_html: true }, { root })
  const html = fs.readFileSync(report.html_path, 'utf8')
  assert.ok(!/[\uE000-\uE005]/.test(html), 'a placeholder leaked into the page')
  assert.match(html, /@top-right\{content:"晶体 ABX3 的结构"/)
  const toc = html.slice(html.indexOf('class="toc'), html.indexOf('</section>', html.indexOf('class="toc')))
  assert.match(toc, /<svg class="m"/)
})

test('punctuation after a formula cannot start a line', async () => {
  const report = await composePdf({ path: 'punct.pdf', title: '标点', body: '电压 $V_{oc}$，然后是 $x$。', keep_html: true }, { root })
  const html = fs.readFileSync(report.html_path, 'utf8')
  assert.match(html, /<span class="nb"><svg[^]*?<\/svg>，<\/span>/)
  assert.match(html, /<span class="nb"><svg[^]*?<\/svg>。<\/span>/)
})

test('a long headline number shrinks its row instead of wrapping', async () => {
  const body = ':::stats\n- 75 kJ/mol | 甲\n- 56 kJ/mol | 乙\n- ≈ 2×10³ 倍 | 丙\n:::\n\n:::stats\n- 3 | 甲\n- 5 | 乙\n:::'
  const report = await composePdf({ path: 'stats.pdf', title: '数字', body, keep_html: true }, { root })
  const html = fs.readFileSync(report.html_path, 'utf8')
  assert.match(html, /<div class="stats n3" style="--stat:\d+pt">/)
  assert.match(html, /<div class="stats n2">/)
})

test('short documents flow from a masthead with no cover', async () => {
  const report = await composePdf({ path: 'short.pdf', title: '备忘', body: '一段很短的文字。' }, { root })
  assert.equal(report.doc_type, 'brief')
  assert.equal(report.pages, 1)
})

test('problems are reported, not swallowed', async () => {
  const body = '![缺失](nope.png)\n\n![远程](https://example.com/a.png)\n\n[[figure:ghost]]\n\n$\\frac{1}{$\n\n:::wat\n正文\n:::\n\n```chart\nnot json\n```\n'
  const report = await composePdf({ path: 'bad.pdf', title: '问题', body, figures: { unused: { elements: [] } } }, { root })
  const all = report.warnings.join('\n')
  assert.match(all, /image not found: nope\.png/)
  assert.match(all, /remote image skipped/)
  assert.match(all, /\[\[figure:ghost\]\] has no spec/)
  assert.match(all, /LaTeX/)
  assert.match(all, /unknown component ":::wat"/)
  assert.match(all, /not valid JSON/)
  assert.match(all, /never referenced in the body: figure:unused/)
})

test('the review asks for rhythm on a wall of text', async () => {
  const wall = `${'一段没有任何图表的长文字，读起来会很累。'.repeat(25)}\n\n`.repeat(14)
  const report = await composePdf({ path: 'wall.pdf', title: '长文', body: `# 一\n\n${wall}\n\n# 二\n\n正文。\n\n# 三\n\n正文。`, doc_type: 'report' }, { root })
  const all = report.review.join('\n')
  assert.match(all, /no image, figure or chart/)
  assert.match(all, /paragraph/)
})

test('output cannot leave the workspace, and bad arguments are named', async () => {
  await assert.rejects(composePdf({ path: '../escape.pdf', title: 'x', body: 'y' }, { root }), /inside the workspace/)
  await assert.rejects(composePdf({ path: 'a.docx', title: 'x', body: 'y' }, { root }), /\.pdf/)
  await assert.rejects(composePdf({ path: 'a.pdf', title: 'x' }, { root }), /body/)
  await assert.rejects(composePdf({ path: 'a.pdf', body: 'no heading' }, { root }), /title/)
  await assert.rejects(composePdf({ path: 'a.pdf', title: 'x', body: 'y', theme: 'nope' }, { root }), /unknown theme/)
  await assert.rejects(composePdf({ path: 'a.pdf', title: 'x', body: 'y', motif: 'nope' }, { root }), /motif/)
})

test('the plugin registers all six tools under its own names and steers the prompt', async () => {
  const registered = new Map()
  const sections = []
  const ctx = {
    tools: { register: def => registered.set(def.name, def), get: toolName => registered.get(toolName) },
    effect() {},
    get() {},
    inject(_deps, callback) {
      callback({ systemPrompt: { getSectionOrder: () => 1, section: s => sections.push(s) } })
    },
  }
  assert.equal(name, 'pdf-atelier')
  apply(ctx, {})
  assert.deepEqual([...registered.keys()].sort(), ['atelier_convert', 'atelier_document', 'atelier_figure', 'atelier_formula', 'atelier_pdf', 'atelier_themes'])
  for (const def of registered.values()) assert.ok(!/math_(formula|figure|convert|document)/.test(def.description), def.name)
  assert.equal(sections.length, 1)
  const text = sections[0].text({ scope: undefined })
  assert.match(text, /atelier_pdf/)
  // {{name}} is interpolated by the Harness and throws on anything unknown.
  for (const def of registered.values()) assert.ok(!def.description.includes('{{'), def.name)
  assert.ok(!text.includes('{{'))
})

test('the wrapped math tools still write their files', async () => {
  const registered = new Map()
  const ctx = {
    tools: { register: def => registered.set(def.name, def), get: toolName => registered.get(toolName) },
    effect() {},
    get() {},
  }
  apply(ctx, { workspaceRoot: root })
  const exec = { signal: new AbortController().signal }
  const formula = await registered.get('atelier_formula').execute({ latex: 'E=mc^2', format: 'svg', name: 'energy' }, exec)
  assert.ok(fs.existsSync(formula.svg_host_path))
  assert.ok(formula.svg_path.startsWith('atelier-assets'))
  const figure = await registered.get('atelier_figure').execute({ figure: { elements: [{ type: 'circle', center: [0, 0], radius: 1 }] }, format: 'svg', name: 'c' }, exec)
  assert.ok(fs.existsSync(figure.svg_host_path))
  const doc = await registered.get('atelier_document').execute({ path: 'd.md', body: 'x $a$', math: 'image', image_format: 'svg' }, exec)
  assert.ok(fs.existsSync(path.join(root, 'd.md')), JSON.stringify(doc))
  const themed = await registered.get('atelier_themes').execute({ brief: '有机化学' })
  assert.equal(themed.recommended, 'reagent')
})
