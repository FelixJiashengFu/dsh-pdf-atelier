// The whole pipeline: read the content, choose the art direction, typeset, print,
// read the result back, tighten stub pages, fill in the contents, review.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { analysePdf, pageMap, reviewContent, stubPages } from './inspect.js'
import { buildHtml, buildTocEntries, hasOwnNumber, PAGE_SIZES, plain, splitChapters } from './layout.js'
import { BodyRenderer } from './markdown.js'
import { MOTIFS, THEMES, buildPalette, hashSeed, recommendTheme } from './themes.js'
import { PdfEngine } from './render.js'

const DOC_TYPES = ['auto', 'report', 'book', 'article', 'brief']
const COVERS = ['field', 'split', 'paper', 'scroll']
const DENSITIES = [1, 0.978, 0.955]

function detectLang(text) {
  const sample = text.slice(0, 20000)
  const cjk = (sample.match(/[㐀-鿿]/g) ?? []).length
  const latin = (sample.match(/[A-Za-z]+/g) ?? []).length
  return cjk > 0 && cjk >= latin * 0.6 ? 'zh' : 'en'
}

/** Resolve an output path, refusing anything that escapes the workspace through `..` or a symlink. */
function resolveOutput(root, requested) {
  const resolvedRoot = fs.realpathSync(root)
  let target = path.resolve(resolvedRoot, requested)
  if (!path.extname(target)) target += '.pdf'
  if (path.extname(target).toLowerCase() !== '.pdf') throw new Error(`"path" must end in .pdf, got "${requested}"`)
  let probe = path.dirname(target)
  while (!fs.existsSync(probe)) probe = path.dirname(probe)
  const real = fs.realpathSync(probe)
  const rel = path.relative(resolvedRoot, real)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`"path" must stay inside the workspace (${resolvedRoot})`)
  return target
}

function eachLineOutsideFences(text, visit) {
  let inFence = false
  return text.split('\n').map(line => {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      return line
    }
    return inFence ? line : visit(line)
  }).join('\n')
}

/**
 * A document written as one `# Title` over `##` sections is really a titled
 * document with chapters: lift the title out and promote the headings.
 */
function normalizeHeadings(body, title) {
  const h1 = []
  let h2 = 0
  eachLineOutsideFences(body, line => {
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (m) h1.push(m[1])
    if (/^##\s/.test(line)) h2 += 1
    return line
  })
  let text = body
  let found = title
  if (h1.length === 1 && (!title || h1[0] === title || /^\s*#\s/.test(body.trimStart().split('\n')[0]))) {
    found = title ?? h1[0]
    let removed = false
    text = eachLineOutsideFences(text, line => {
      if (!removed && /^#\s/.test(line)) {
        removed = true
        return ''
      }
      return line
    })
    if (h2 >= 2) text = eachLineOutsideFences(text, line => line.replace(/^(#{2,6})(\s)/, (_, hashes, sp) => hashes.slice(1) + sp))
  } else if (h1.length === 0 && h2 >= 3) {
    text = eachLineOutsideFences(text, line => line.replace(/^(#{2,6})(\s)/, (_, hashes, sp) => hashes.slice(1) + sp))
  }
  return { body: text, title: found }
}

function readBody(args, root) {
  if (typeof args.body === 'string' && args.body.trim() !== '') return { text: args.body, dirs: [root] }
  const sources = args.body_path === undefined ? [] : [args.body_path].flat()
  if (sources.length === 0) throw new Error('provide "body" (Markdown text) or "body_path" (Markdown file or list of files)')
  const dirs = new Set([root])
  const parts = sources.map(file => {
    const full = path.resolve(root, file)
    if (!fs.existsSync(full)) throw new Error(`body_path not found: ${file}`)
    dirs.add(path.dirname(full))
    return fs.readFileSync(full, 'utf8')
  })
  return { text: parts.join('\n\n'), dirs: [...dirs] }
}

function chooseDocType(requested, size, chapterCount, parts) {
  if (requested && requested !== 'auto') return requested
  if (parts > 0 || size > 22000) return 'book'
  if (chapterCount >= 3 || size > 3600) return 'report'
  return size < 1100 ? 'brief' : 'article'
}

/**
 * @param args - the tool arguments (see the schema in index.js).
 * @param env - { root, chromePath, signal, assetsDir }
 * @returns the delivery report.
 */
export async function composePdf(args, env) {
  const { root, chromePath, signal } = env
  if (!args.path) throw new Error('"path" is required, e.g. "reports/my-report.pdf"')
  if (args.doc_type !== undefined && !DOC_TYPES.includes(args.doc_type)) throw new Error(`"doc_type" must be one of ${DOC_TYPES.join(', ')}`)
  if (args.cover_layout !== undefined && !COVERS.includes(args.cover_layout)) throw new Error(`"cover_layout" must be one of ${COVERS.join(', ')}`)
  if (args.motif !== undefined && !MOTIFS.includes(args.motif)) throw new Error(`"motif" must be one of ${MOTIFS.join(', ')}`)
  const pageSize = PAGE_SIZES[args.page_size ?? 'A4']
  if (!pageSize) throw new Error(`"page_size" must be one of ${Object.keys(PAGE_SIZES).join(', ')}`)
  const output = resolveOutput(root, args.path)

  const { text: rawBody, dirs } = readBody(args, root)
  const { body, title } = normalizeHeadings(rawBody.replace(/\r\n?/g, '\n'), args.title)
  if (!title) throw new Error('"title" is required when the body has no single top-level "# heading"')
  const lang = args.lang ?? detectLang(`${title}\n${body}`)
  const zh = lang === 'zh'

  // Art direction.
  const ranking = recommendTheme({ title, brief: args.brief ?? '', body })
  const top = ranking[0]
  const requested = args.theme && args.theme !== 'auto' ? args.theme : null
  const themeId = requested ?? top.theme
  if (!THEMES[themeId]) throw new Error(`unknown theme "${themeId}"; choose one of: ${Object.keys(THEMES).join(', ')}, or "auto"`)
  const seed = hashSeed(`${title}|${args.subtitle ?? ''}`)
  const t = buildPalette(themeId, args.palette ?? {}, seed)
  const fromTopic = ranking.find(r => r.theme === themeId)
  const motif = args.motif ?? (fromTopic && fromTopic.score > 0 ? fromTopic.motif : t.motif)
  const rationale = requested
    ? `theme "${themeId}" was requested${top.theme !== themeId ? ` (content analysis would have chosen "${top.theme}")` : ''}`
    : top.matched.length > 0
      ? `chosen from the content: ${top.matched.slice(0, 6).join(', ')}`
      : 'no strong subject signal; chosen from the title'

  // Content.
  const renderer = new BodyRenderer({
    tokens: t,
    lang,
    figures: args.figures ?? {},
    charts: args.charts ?? {},
    baseDirs: dirs,
  })
  const rendered = await renderer.renderDocument(body)
  const finished = renderer.finish(rendered.html)
  const notes = rendered.notes ? renderer.expand(rendered.notes) : ''
  const { intro, chapters } = splitChapters(finished, renderer)
  const size = plain(finished).replace(zh ? /\s/g : /$^/, '').length
  const docType = chooseDocType(args.doc_type, size, chapters.length, renderer.parts.length)
  const flowing = docType === 'article' || docType === 'brief'

  const numbered = args.number_chapters ?? (chapters.length >= 2 && !chapters.some(c => hasOwnNumber(c.plain)))
  chapters.forEach(c => { c.tocNum = numbered ? String(c.n).padStart(2, '0') : '' })

  // Parts sit at the end of the section before them, so find which chapter they precede.
  const partsInOrder = []
  const scanParts = (html, before) => {
    for (const m of html.matchAll(/<!--atelier-part-(\d+)-->/g)) {
      partsInOrder.push({ id: `p${m[1]}`, title: renderer.parts[+m[1]], before })
    }
  }
  scanParts(intro, 0)
  chapters.forEach((c, i) => scanParts(c.body, i + 1))
  const h2ByChapter = chapters.map(c => [...c.body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(m => ({ id: m[1], html: m[2] })))
  const h2Total = h2ByChapter.reduce((sum, list) => sum + list.length, 0)
  const toc = args.toc ?? (!flowing && chapters.length >= 3)
  const tocEntries = toc && !flowing
    ? buildTocEntries({ chapters, partsInOrder, h2ByChapter, showSubs: chapters.length + h2Total <= 30 })
    : []

  let heroUrl = null
  if (args.cover_image) {
    heroUrl = renderer.resolveImage(args.cover_image)
  }

  const doc = {
    meta: {
      title,
      subtitle: args.subtitle,
      author: args.author,
      org: args.org,
      date: args.date,
      kicker: args.kicker,
      seal: args.seal,
    },
    t, motif, seed, page: pageSize, lang, docType,
    cover: !flowing && (args.cover ?? true),
    toc: toc && !flowing,
    backCover: !flowing && (args.back_cover ?? docType === 'book'),
    coverLayout: args.cover_layout ?? t.covers[seed % t.covers.length],
    numbered, intro, chapters, partTitles: renderer.parts, notes, heroUrl, tocEntries,
    density: 1,
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-doc-'))
  const htmlPath = path.join(work, 'document.html')
  const engine = await PdfEngine.start({ chromePath, signal })
  try {
    const printOnce = async pages => {
      fs.writeFileSync(htmlPath, buildHtml(doc, pages))
      return engine.print(htmlPath)
    }
    const headingIds = html => [...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"/g)].map(m => m[1])
    const ids = headingIds(buildHtml(doc, null))

    const typeset = async density => {
      doc.density = density
      let printed = await printOnce(null)
      let analysis = await analysePdf(printed.bytes)
      let pages = pageMap(analysis.outline, ids)
      if (doc.toc && pages) {
        // The contents length is fixed by the entries, so a second pass settles it;
        // a third covers a page number that changed the wrapping.
        for (let pass = 0; pass < 2; pass += 1) {
          printed = await printOnce(pages)
          analysis = await analysePdf(printed.bytes)
          const again = pageMap(analysis.outline, ids)
          if (!again || JSON.stringify(again) === JSON.stringify(pages)) break
          pages = again
        }
      }
      const starts = chapters.map(c => pages?.[c.id]).filter(Boolean).sort((a, b) => a - b)
      const lastPages = new Set(starts.map(s => s - 1).filter(p => p >= 1))
      const end = analysis.pageCount - (doc.backCover ? 1 : 0)
      lastPages.add(end)
      return { printed, analysis, pages, lastPages, stubs: stubPages(analysis, lastPages), density }
    }

    let best = await typeset(DENSITIES[0])
    for (const density of DENSITIES.slice(1)) {
      if (best.stubs.length === 0) break
      const attempt = await typeset(density)
      if (attempt.stubs.length < best.stubs.length) best = attempt
    }
    if (best.density !== doc.density) {
      best = await typeset(best.density)
    }
    const { printed, analysis, lastPages, pages } = best

    const warnings = [...renderer.warnings]
    const unused = renderer.unusedSpecs()
    if (unused.length > 0) warnings.push(`specs never referenced in the body: ${unused.join(', ')}`)
    if (!pages && doc.toc) warnings.push('page numbers for the contents could not be resolved; the contents list has no numbers')
    for (const src of printed.missing) warnings.push(`image failed to load: ${src}`)
    for (const what of printed.overflow) warnings.push(`too wide for the page, shorten or break it: ${what}`)

    const coverPages = new Set()
    if (doc.cover) coverPages.add(1)
    if (doc.backCover) coverPages.add(analysis.pageCount)
    for (const p of partsInOrder) if (pages?.[p.id]) coverPages.add(pages[p.id])
    const review = reviewContent({
      chapters, intro, renderer, zh, pageCount: analysis.pageCount, analysis, coverPages, lastPages,
    })

    fs.mkdirSync(path.dirname(output), { recursive: true })
    const temp = `${output}.${process.pid}.tmp`
    fs.writeFileSync(temp, printed.bytes)
    fs.renameSync(temp, output)
    let htmlOut = null
    if (args.keep_html) {
      htmlOut = output.replace(/\.pdf$/i, '.html')
      fs.copyFileSync(htmlPath, htmlOut)
    }

    return {
      path: path.relative(fs.realpathSync(root), output).replaceAll('\\', '/'),
      host_path: output,
      html_path: htmlOut ?? '',
      pages: analysis.pageCount,
      bytes: printed.bytes.length,
      doc_type: docType,
      language: lang,
      theme: themeId,
      theme_name: zh ? t.zh : t.en,
      motif,
      cover_layout: doc.cover ? doc.coverLayout : 'masthead',
      rationale,
      palette: { paper: t.paper, ink: t.ink, accent: t.accent, accent2: t.accent2, accent3: t.accent3, deep: t.deep },
      contents_pages: doc.toc,
      density: best.density,
      elements: renderer.counts,
      warnings,
      review,
      browser: path.basename(engine.executable),
      preview_url: pathToFileURL(output).href,
    }
  } finally {
    await engine.close()
    fs.rmSync(work, { recursive: true, force: true })
  }
}

export function formatReport(v) {
  const lines = [
    `<pdf path="${v.path}" pages="${v.pages}" size="${(v.bytes / 1024).toFixed(0)} KB" type="${v.doc_type}" lang="${v.language}">`,
    `absolute path: ${v.host_path}`,
    `art direction: ${v.theme} (${v.theme_name}), motif ${v.motif}, cover ${v.cover_layout}; ${v.rationale}`,
    `palette: paper ${v.palette.paper}, ink ${v.palette.ink}, accent ${v.palette.accent}, ${v.palette.accent2}, ${v.palette.accent3}, deep ${v.palette.deep}`,
    `contains: ${Object.entries(v.elements).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') || 'text only'}`,
  ]
  if (v.warnings.length > 0) lines.push('problems to fix:', ...v.warnings.map(w => `- ${w}`))
  if (v.review.length > 0) lines.push('art director review (act on these, then call the tool again):', ...v.review.map(r => `- ${r}`))
  if (v.warnings.length === 0 && v.review.length === 0) lines.push('review: clean, ready to deliver')
  lines.push('</pdf>')
  return lines.join('\n')
}
