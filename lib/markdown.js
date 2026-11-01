// Extended Markdown → themed HTML. Plain Markdown plus:
//   $inline$  $$display$$            MathJax, typeset as font-free outlines
//   ```chart / ```figure             declarative charts and geometry figures
//   [[figure:name size=wide]]        a figure from the `figures` argument
//   ![caption](path "wide")          auto-numbered figure with caption
//   :::callout key 标题 … :::        layout components (see COMPONENTS)
//   [^id] / [^id]: text              notes collected at the end of the document

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Marked } from 'marked'
import hljs from 'highlight.js/lib/common'
import { renderFigure, renderTex, scanDocument } from '@jaxzhou/dsh-mathmatic-symbol'
import { renderChart } from './charts.js'

const INLINE_OPEN = ''
const INLINE_CLOSE = ''
const FIG_MARK = 'F'
const TABLE_MARK = 'T'
const blockToken = i => `<!--atelier-block-${i}-->`
const BLOCK_RE = /<!--atelier-block-(\d+)-->/g
const INLINE_RE = /(\d+)/g

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const LABELS = {
  zh: {
    note: '注', tip: '提示', warn: '注意', key: '要点', example: '例', theorem: '定理', definition: '定义', proof: '证明', lemma: '引理', summary: '小结',
    figure: '图', table: '表', notes: '注释',
  },
  en: {
    note: 'Note', tip: 'Tip', warn: 'Caution', key: 'Key point', example: 'Example', theorem: 'Theorem', definition: 'Definition', proof: 'Proof', lemma: 'Lemma', summary: 'Summary',
    figure: 'Figure', table: 'Table', notes: 'Notes',
  },
}
const CALLOUTS = new Set(['note', 'tip', 'warn', 'key', 'example', 'theorem', 'definition', 'proof', 'lemma', 'summary'])

function parseAttrs(text) {
  const attrs = {}
  const rest = []
  const re = /([A-Za-z_][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))|"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(text ?? '')) !== null) {
    if (m[1]) attrs[m[1]] = m[2] ?? m[3] ?? m[4]
    else rest.push(m[5] ?? m[6])
  }
  return { attrs, rest }
}

function sizeClass(value) {
  return ['wide', 'full', 'half', 'small', 'side'].includes(value) ? ` size-${value}` : ''
}

/** Substitute theme tokens and give undecorated curves the palette, so a spec written without colours still looks designed. */
function themeFigureSpec(spec, tokens) {
  const named = {
    accent: tokens.accent, accent2: tokens.accent2, accent3: tokens.accent3,
    ink: tokens.ink, muted: tokens.ink3, paper: tokens.paper, rule: tokens.rule,
  }
  const clone = JSON.parse(JSON.stringify(spec))
  const swap = (obj, key) => {
    if (typeof obj[key] === 'string' && named[obj[key]]) obj[key] = named[obj[key]]
  }
  if (Array.isArray(clone.elements)) {
    let cycle = 0
    for (const el of clone.elements) {
      swap(el, 'color')
      swap(el, 'fill')
      const stroked = ['curve', 'parametric', 'polar', 'vector', 'ray'].includes(el.type)
      if (stroked && el.color === undefined) {
        el.color = tokens.chart[cycle % 3]
        cycle += 1
      }
      if (el.type === 'polygon' && el.fill === undefined) el.fill = tokens.accent
      if (el.type === 'circle' && el.color === undefined) el.color = tokens.accent
      if (el.type === 'point' && el.color === undefined) el.color = tokens.ink
      if (el.type === 'angle' && el.color === undefined) el.color = tokens.accentText
    }
  }
  return clone
}

function themeFigureSvg(svg, tokens) {
  return svg
    .replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1')
    .replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1')
    .replaceAll('#1f2937', tokens.ink)
    .replaceAll('#94a3b8', tokens.ink3)
    .replaceAll('#e2e8f0', tokens.rule)
    .replaceAll('#0f172a', tokens.ink)
    .replaceAll('#ffffff', tokens.paper)
}

export class BodyRenderer {
  /**
   * @param options - { tokens, lang, figures, charts, baseDirs }
   */
  constructor({ tokens, lang, figures = {}, charts = {}, baseDirs = [] }) {
    this.tokens = tokens
    this.lang = lang
    this.labels = LABELS[lang] ?? LABELS.en
    this.figures = figures
    this.charts = charts
    this.baseDirs = baseDirs
    this.blocks = []
    this.inlines = []
    this.chapters = []
    this.parts = []
    this.warnings = []
    this.usedFigures = new Set()
    this.notes = new Map()
    this.noteOrder = []
    this.headingSeq = 0
    this.nested = 0
    this.counts = { images: 0, figures: 0, charts: 0, components: 0, formulas: 0, tables: 0, code: 0 }
    this.marked = this.makeMarked()
  }

  warn(message) {
    if (!this.warnings.includes(message)) this.warnings.push(message)
  }

  makeMarked() {
    const self = this
    const marked = new Marked({ gfm: true, breaks: false })
    marked.use({
      renderer: {
        heading({ tokens, depth }) {
          const html = this.parser.parseInline(tokens)
          if (depth === 1 && self.nested === 0) {
            self.chapters.push({ html })
            return `<!--atelier-chapter-${self.chapters.length - 1}-->`
          }
          const level = self.nested > 0 ? Math.min(6, depth + 3) : depth
          self.headingSeq += 1
          return `<h${level} id="s${self.headingSeq}">${html}</h${level}>\n`
        },
        paragraph({ tokens }) {
          const meaningful = tokens.filter(t => !(t.type === 'text' && t.raw.trim() === '') && t.type !== 'br')
          if (meaningful.length > 0 && meaningful.every(t => t.type === 'image')) {
            return meaningful.length === 1 ? self.figureFromImage(meaningful[0]) : self.galleryFromImages(meaningful)
          }
          return `<p>${this.parser.parseInline(tokens)}</p>\n`
        },
        image({ href, text }) {
          const src = self.resolveImage(href)
          return src ? `<img class="inline" src="${esc(src)}" alt="${esc(text ?? '')}">` : ''
        },
        code({ text, lang }) {
          return self.codeBlock(text, (lang ?? '').trim().split(/\s+/)[0])
        },
        table(token) {
          self.counts.tables += 1
          const numeric = token.header.map((_, col) => {
            const cells = token.rows.map(row => row[col]?.text ?? '').filter(c => c.trim() !== '')
            const hits = cells.filter(c => /^[-+−~≈]?\s*[$¥€£]?\s*\d[\d,.]*\s*(%|‰|万|亿|k|m|b|x|倍|元|mg|g|kg|ml|mm|cm|nm|°C|K)?$/i.test(c.trim()))
            return cells.length > 0 && hits.length / cells.length >= 0.7
          })
          const cls = (i, align) => {
            const a = align ?? (numeric[i] ? 'right' : null)
            return a ? ` class="${a === 'right' ? 'num' : a === 'center' ? 'ctr' : ''}"` : ''
          }
          const head = token.header.map((c, i) => `<th${cls(i, c.align)}>${this.parser.parseInline(c.tokens)}</th>`).join('')
          const rows = token.rows.map(row => `<tr>${row.map((c, i) => `<td${cls(i, c.align)}>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('\n')
          return `<div class="table-wrap${token.rows.length <= 12 ? ' keep' : ''}"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`
        },
        link({ href, tokens }) {
          return `<a href="${esc(href)}">${this.parser.parseInline(tokens)}</a>`
        },
      },
    })
    return marked
  }

  resolveImage(href) {
    if (/^data:image\//i.test(href)) return href
    if (/^https?:/i.test(href)) {
      this.warn(`remote image skipped (${href}): PDFs are built offline; save the file into the workspace and reference that path`)
      return null
    }
    const clean = decodeURI(href.replace(/^file:\/\/\/?/, ''))
    const candidates = path.isAbsolute(clean) ? [clean] : this.baseDirs.map(dir => path.resolve(dir, clean))
    const found = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    if (!found) {
      this.warn(`image not found: ${href}`)
      return null
    }
    return pathToFileURL(found).href
  }

  figureHtml(inner, caption, size) {
    const cap = caption
      ? `<figcaption><span class="fig-n">${this.labels.figure} ${FIG_MARK}</span>${caption}</figcaption>`
      : ''
    return `<figure class="fig${sizeClass(size)}">${inner}${cap}</figure>`
  }

  figureFromImage(token) {
    const src = this.resolveImage(token.href)
    if (!src) return ''
    this.counts.images += 1
    const caption = token.text ? this.marked.parseInline(token.text) : ''
    return this.figureHtml(`<img src="${esc(src)}" alt="${esc(token.text ?? '')}">`, caption, token.title ?? undefined)
  }

  galleryFromImages(tokens) {
    const items = tokens.map(t => {
      const src = this.resolveImage(t.href)
      if (!src) return ''
      this.counts.images += 1
      return `<div class="gal-item"><img src="${esc(src)}" alt="${esc(t.text ?? '')}">${t.text ? `<div class="gal-cap">${this.marked.parseInline(t.text)}</div>` : ''}</div>`
    })
    return `<div class="gallery n${Math.min(3, tokens.length)}">${items.join('')}</div>`
  }

  codeBlock(text, lang) {
    this.counts.code += 1
    let body = esc(text)
    if (lang && hljs.getLanguage(lang)) {
      try {
        body = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
      } catch { /* fall back to plain text */ }
    }
    const tag = lang ? `<span class="code-lang">${esc(lang)}</span>` : ''
    return `<pre class="code">${tag}<code>${body}</code></pre>\n`
  }

  stashBlock(html) {
    this.blocks.push(html)
    return `\n\n${blockToken(this.blocks.length - 1)}\n\n`
  }

  async mathSvg(tex, display) {
    this.counts.formulas += 1
    try {
      const r = await renderTex(tex, display)
      if (r.errored) this.warn(`LaTeX error in: ${tex.slice(0, 80)}`)
      const total = r.above + r.depth
      const svg = `<svg class="m" xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-r.above} ${r.width} ${total}" style="width:${(r.width / 1000).toFixed(3)}em;height:${(total / 1000).toFixed(3)}em;vertical-align:${(-r.depth / 1000).toFixed(3)}em" role="img" aria-label="${esc(tex)}">${r.inner}</svg>`
      return svg
    } catch (error) {
      this.warn(`LaTeX failed (${error.message}): ${tex.slice(0, 80)}`)
      return `<code>${esc(tex)}</code>`
    }
  }

  /** Replace math in a run of text with placeholders; inline code stays untouched. */
  async prepInline(text) {
    const codes = []
    const guarded = text.replace(/(`+)[\s\S]*?\1/g, m => {
      codes.push(m)
      return `${codes.length - 1}`
    })
    let out = ''
    for (const seg of scanDocument(guarded)) {
      if (seg.kind === 'text') out += seg.text
      else if (seg.kind === 'figure') out += `[[figure:${seg.name}]]`
      else if (seg.display) {
        out += this.stashBlock(`<div class="eq">${await this.mathSvg(seg.tex, true)}</div>`)
      } else {
        this.inlines.push(await this.mathSvg(seg.tex, false))
        out += `${INLINE_OPEN}${this.inlines.length - 1}${INLINE_CLOSE}`
      }
    }
    return out.replace(/(\d+)/g, (_, i) => codes[+i])
  }

  async inline(text) {
    return this.marked.parseInline(await this.prepInline(text.trim()))
  }

  async nestedBlocks(text) {
    this.nested += 1
    try {
      return await this.render(text)
    } finally {
      this.nested -= 1
    }
  }

  async figureBlock(name, specRaw, attrs) {
    if (typeof specRaw !== 'object' || specRaw === null) throw new Error('figure spec must be a JSON object')
    const { caption: specCaption, size: specSize, ...spec } = specRaw
    this.counts.figures += 1
    try {
      const rendered = await renderFigure(themeFigureSpec(spec, this.tokens), { background: 'transparent', padding: 8 })
      for (const w of rendered.warnings) this.warn(`figure ${name}: ${w}`)
      const caption = attrs.caption ?? specCaption
      const inner = `<div class="fig-svg" style="--w:${rendered.width}">${themeFigureSvg(rendered.svg, this.tokens)}</div>`
      return this.figureHtml(inner, caption ? await this.inline(caption) : '', attrs.size ?? specSize)
    } catch (error) {
      this.warn(`figure ${name} failed: ${error.message}`)
      return ''
    }
  }

  async chartBlock(specRaw, attrs) {
    this.counts.charts += 1
    try {
      const { caption: specCaption, size: specSize, ...spec } = specRaw
      const caption = attrs.caption ?? specCaption
      return this.figureHtml(renderChart(spec, this.tokens), caption ? await this.inline(caption) : '', attrs.size ?? specSize)
    } catch (error) {
      this.warn(`chart failed: ${error.message}`)
      return ''
    }
  }

  parseJsonFence(text, kind) {
    try {
      return JSON.parse(text)
    } catch (error) {
      this.warn(`\`\`\`${kind} block is not valid JSON: ${error.message}`)
      return null
    }
  }

  async items(text) {
    const rows = []
    for (const line of text.split('\n')) {
      const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)
      if (m) rows.push(await Promise.all(m[1].split(/\s+\|\s+/).map(cell => this.inline(cell))))
      else if (line.trim() !== '' && rows.length > 0) {
        const last = rows[rows.length - 1]
        last[last.length - 1] += ` ${await this.inline(line)}`
      }
    }
    return rows
  }

  async component(name, rest, attrs, inner) {
    this.counts.components += 1
    const label = t => `<div class="c-label">${t}</div>`
    const kind = CALLOUTS.has(name) ? name : (name === 'callout' ? (rest[0] && CALLOUTS.has(rest[0]) ? rest[0] : 'note') : null)
    if (kind) {
      const words = name === 'callout' && rest[0] === kind ? rest.slice(1) : rest
      const custom = attrs.title ?? words.join(' ')
      const head = custom ? `${this.labels[kind]} · ${await this.inline(custom)}` : this.labels[kind]
      return `<aside class="callout k-${kind}">${label(head)}${await this.nestedBlocks(inner)}</aside>`
    }
    switch (name) {
      case 'lead':
        return `<div class="lead">${await this.nestedBlocks(inner)}</div>`
      case 'quote': {
        const who = attrs.author ?? attrs.by ?? rest.join(' ')
        return `<blockquote class="pull"><div class="pull-text">${await this.nestedBlocks(inner)}</div>${who ? `<div class="pull-by">${await this.inline(who)}</div>` : ''}</blockquote>`
      }
      case 'stats': {
        const rows = await this.items(inner)
        const cells = rows.map(r => `<div class="stat"><div class="stat-v">${r[0] ?? ''}</div><div class="stat-l">${r[1] ?? ''}</div>${r[2] ? `<div class="stat-n">${r[2]}</div>` : ''}</div>`)
        // Headline numbers stay on one line: the whole row shrinks to fit its longest value.
        const widest = Math.max(0, ...rows.map(r => [...(r[0] ?? '').replace(/<svg[^]*?<\/svg>/g, 'xx').replace(/<[^>]+>/g, '')].reduce((sum, ch) => sum + (/[\u3400-\u9fff]/.test(ch) ? 1.8 : 1), 0)))
        const room = { 1: 30, 2: 13, 3: 8.5, 4: 5.8 }[Math.min(4, rows.length)] ?? 5.8
        const fit = widest > room ? ` style="--stat:${Math.max(13, Math.floor((25 * room) / widest))}pt"` : ''
        return `<div class="stats n${Math.min(4, rows.length)}"${fit}>${cells.join('')}</div>`
      }
      case 'timeline': {
        const rows = await this.items(inner)
        return `<ol class="timeline">${rows.map(r => `<li><div class="tl-t">${r[0] ?? ''}</div><div class="tl-b"><div class="tl-h">${r[1] ?? ''}</div>${r[2] ? `<div class="tl-d">${r[2]}</div>` : ''}</div></li>`).join('')}</ol>`
      }
      case 'steps': {
        const rows = await this.items(inner)
        return `<ol class="steps">${rows.map((r, i) => `<li><div class="st-n">${String(i + 1).padStart(2, '0')}</div><div class="st-b"><div class="st-h">${r[0] ?? ''}</div>${r[1] ? `<div class="st-d">${r[1]}</div>` : ''}</div></li>`).join('')}</ol>`
      }
      case 'glossary': {
        const rows = await this.items(inner)
        return `<dl class="glossary">${rows.map(r => `<div><dt>${r[0] ?? ''}</dt><dd>${r[1] ?? ''}</dd></div>`).join('')}</dl>`
      }
      case 'cards': {
        const sections = inner.split(/^(?=#{1,4}\s)/m).filter(s => s.trim() !== '')
        const cards = await Promise.all(sections.map(async s => {
          const m = /^#{1,4}\s+(.*)\n?([\s\S]*)$/.exec(s)
          return m
            ? `<div class="card"><div class="card-h">${await this.inline(m[1])}</div>${await this.nestedBlocks(m[2])}</div>`
            : `<div class="card">${await this.nestedBlocks(s)}</div>`
        }))
        return `<div class="cards n${attrs.cols ?? Math.min(3, Math.max(2, cards.length === 4 ? 2 : cards.length))}">${cards.join('')}</div>`
      }
      case 'columns':
      case 'compare': {
        const parts = inner.split(/^\s*(?:---|\+\+\+)\s*$/m)
        const cols = await Promise.all(parts.map(p => this.nestedBlocks(p)))
        return `<div class="${name} n${Math.min(3, cols.length)}">${cols.map(c => `<div class="col">${c}</div>`).join('')}</div>`
      }
      case 'aside':
        return `<aside class="margin">${attrs.title ? label(await this.inline(attrs.title)) : ''}${await this.nestedBlocks(inner)}</aside>`
      case 'part': {
        const title = attrs.title ?? rest.join(' ')
        this.parts.push(title)
        return `<!--atelier-part-${this.parts.length - 1}-->`
      }
      default:
        this.warn(`unknown component ":::${name}" rendered as plain text; known: callout, note, tip, warn, key, example, theorem, definition, proof, lemma, summary, lead, quote, stats, timeline, steps, glossary, cards, columns, compare, aside, part, pagebreak`)
        return await this.nestedBlocks(inner)
    }
  }

  /** Walk lines; fences and directives become placeholders, the rest goes through math and Markdown. */
  async render(text) {
    const lines = text.split('\n')
    let out = ''
    let buffer = []
    const flush = async () => {
      if (buffer.length === 0) return
      out += await this.prepInline(buffer.join('\n'))
      buffer = []
    }
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const fence = /^(\s{0,3})(`{3,}|~{3,})\s*([\w+-]*)\s*(.*)$/.exec(line)
      if (fence) {
        const close = new RegExp(`^\\s{0,3}${fence[2][0]}{${fence[2].length},}\\s*$`)
        let j = i + 1
        while (j < lines.length && !close.test(lines[j])) j += 1
        const content = lines.slice(i + 1, j).join('\n')
        const lang = fence[3].toLowerCase()
        await flush()
        if (lang === 'chart' || lang === 'figure') {
          const spec = this.parseJsonFence(content, lang)
          const { attrs } = parseAttrs(fence[4])
          if (spec) out += this.stashBlock(lang === 'chart' ? await this.chartBlock(spec, attrs) : await this.figureBlock('(inline)', spec, attrs))
        } else {
          out += this.stashBlock(this.codeBlock(content, lang))
        }
        i = j
        continue
      }
      const ref = /^\s*(?:\[\[|\{\{)(figure|chart):([\w-]+)(?:\s+([^\]}]*))?(?:\]\]|\}\})\s*$/.exec(line)
      if (ref) {
        await flush()
        const { attrs } = parseAttrs(ref[3])
        const source = ref[1] === 'figure' ? this.figures : this.charts
        const spec = source[ref[2]]
        if (spec === undefined) {
          this.warn(`[[${ref[1]}:${ref[2]}]] has no spec; provided: ${Object.keys(source).join(', ') || '(none)'}`)
        } else {
          this.usedFigures.add(`${ref[1]}:${ref[2]}`)
          out += this.stashBlock(ref[1] === 'figure' ? await this.figureBlock(ref[2], spec, attrs) : await this.chartBlock(spec, attrs))
        }
        continue
      }
      const dir = /^\s{0,3}(:{3,})\s*([A-Za-z][\w-]*)\s*(.*)$/.exec(line)
      if (dir) {
        const name = dir[2].toLowerCase()
        await flush()
        if (name === 'pagebreak') {
          out += this.stashBlock('<div class="pagebreak"></div>')
          const next = lines[i + 1]
          if (next !== undefined && /^\s{0,3}:{3,}\s*$/.test(next)) i += 1
          continue
        }
        let depth = 1
        let j = i + 1
        let inFence = false
        for (; j < lines.length; j += 1) {
          if (/^\s{0,3}(`{3,}|~{3,})/.test(lines[j])) inFence = !inFence
          if (inFence) continue
          if (/^\s{0,3}:{3,}\s*$/.test(lines[j])) {
            depth -= 1
            if (depth === 0) break
          } else if (/^\s{0,3}:{3,}\s*[A-Za-z]/.test(lines[j]) && !/^\s{0,3}:{3,}\s*pagebreak\b/i.test(lines[j])) depth += 1
        }
        const { attrs, rest } = parseAttrs(dir[3])
        const html = await this.component(name, rest, attrs, lines.slice(i + 1, j).join('\n'))
        out += html.startsWith('<!--atelier-part-') ? `\n\n${html}\n\n` : this.stashBlock(html)
        i = j
        continue
      }
      buffer.push(line)
    }
    await flush()
    return this.nested > 0 ? this.marked.parse(out) : out
  }

  /** Top level: notes, then render, then Markdown. */
  async renderDocument(body) {
    let text = body.replace(/\r\n?/g, '\n')
    const defs = new Map()
    text = text.replace(/^\[\^([^\]\s]+)\]:\s*(.+(?:\n(?:[ \t]+.+))*)/gm, (_, id, note) => {
      defs.set(id, note.replace(/\n[ \t]+/g, ' '))
      return ''
    })
    const noteRefs = new Map()
    text = text.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
      if (!defs.has(id)) return m
      if (!noteRefs.has(id)) noteRefs.set(id, noteRefs.size + 1)
      const n = noteRefs.get(id)
      return `<sup class="fnref"><a href="#fn${n}">${n}</a></sup>`
    })
    const prepared = await this.render(text)
    let html = this.marked.parse(prepared)
    let notes = ''
    if (noteRefs.size > 0) {
      const rows = []
      for (const [id, n] of noteRefs) rows.push(`<li id="fn${n}">${await this.inline(defs.get(id))}</li>`)
      notes = `<section class="notes"><div class="notes-h">${this.labels.notes}</div><ol>${rows.join('')}</ol></section>`
    }
    return { html, notes }
  }

  expand(html) {
    let out = html
    // Blocks can contain blocks, so substitute until stable.
    for (let pass = 0; pass < 8 && BLOCK_RE.test(out); pass += 1) {
      BLOCK_RE.lastIndex = 0
      out = out.replace(BLOCK_RE, (_, i) => this.blocks[+i])
    }
    BLOCK_RE.lastIndex = 0
    out = out.replace(/<p>\s*(?=<(?:div|figure|aside|ol|dl|blockquote|pre)\b)/g, '').replace(/(<\/(?:div|figure|aside|ol|dl|blockquote|pre)>)\s*<\/p>/g, '$1')
    return this.expandInline(out)
  }

  expandInline(html) {
    // An SVG is a break opportunity, so closing punctuation has to be tied to it by hand.
    return html
      .replace(/\uE000(\d+)\uE001([，。、；：！？）》」』”’,.;:!?)]+)/g, (_, i, punct) => `<span class="nb">${this.inlines[+i]}${punct}</span>`)
      .replace(INLINE_RE, (_, i) => this.inlines[+i])
  }

  /** Attach table captions and number figures and tables in final reading order. */
  finish(html) {
    let out = this.expand(html)
    out = out.replace(/<p>(?:表|Table)\s*[:：]\s*([\s\S]*?)<\/p>\s*<div class="table-wrap( keep)?">/g, (_, cap, keep) =>
      `<div class="table-wrap${keep ?? ''}"><div class="tbl-cap"><span class="fig-n">${this.labels.table} ${TABLE_MARK}</span>${cap}</div>`)
    let fig = 0
    let tbl = 0
    out = out.replaceAll(FIG_MARK, () => String(++fig)).replaceAll(TABLE_MARK, () => String(++tbl))
    return out
  }

  unusedSpecs() {
    const unused = []
    for (const n of Object.keys(this.figures)) if (!this.usedFigures.has(`figure:${n}`)) unused.push(`figure:${n}`)
    for (const n of Object.keys(this.charts)) if (!this.usedFigures.has(`chart:${n}`)) unused.push(`chart:${n}`)
    return unused
  }
}
