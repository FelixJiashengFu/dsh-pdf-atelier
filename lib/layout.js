// Assembles the HTML: cover, contents, chapter openers, parts, running heads.
// Layout decisions live here so a model only has to write the content.

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mix } from './color.js'
import { motifSvg } from './motifs.js'
import { esc } from './markdown.js'
import { buildCss } from './style.js'

const ASSETS = path.resolve(import.meta.dirname, '..', 'assets')
export const PAGE_SIZES = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } }

const ZH_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
function zhNumber(n) {
  if (n <= 10) return ZH_NUM[n]
  if (n < 20) return `十${ZH_NUM[n - 10]}`
  return `${ZH_NUM[Math.floor(n / 10)]}十${n % 10 ? ZH_NUM[n % 10] : ''}`
}

// Running heads are plain strings, so a formula is reduced to its visible letters.
const texToText = tex => tex.replace(/\\[a-zA-Z]+/g, '').replace(/[{}_^$~\\]/g, '')

export const plain = html => html
  .replace(/<svg[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>/g, (_, tex) => texToText(tex))
  .replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const hasOwnNumber = title => /^(第\s*[\d一二三四五六七八九十百]+\s*[章节篇部讲回]|chapter\s+\d|part\s+\d|\d+(\.\d+)*[.\s、)]|[一二三四五六七八九十]+、)/i.test(title)

/** Colours for art on the deep field, on the paper and at quiet strength. */
function artColors(t, on) {
  if (on === 'deep') {
    return {
      fg: mix(t.deepInk, t.deep, 0.42),
      fg2: t.onDeepAccent,
      fg3: mix(t.accent3, t.deepInk, 0.15),
      fg4: mix(t.deep, t.accent, 0.42),
      bg: t.deep,
    }
  }
  return { fg: mix(t.ink, t.paper, 0.2), fg2: t.accent, fg3: t.accent2, fg4: t.accent3, bg: t.paper }
}

function titleSize(title, zh) {
  const units = [...title].reduce((sum, ch) => sum + (/[㐀-鿿]/.test(ch) ? 1 : 0.55), 0)
  if (units <= 7) return zh ? 58 : 66
  if (units <= 12) return 50
  if (units <= 18) return 42
  if (units <= 28) return 35
  if (units <= 44) return 29
  return 24
}

function coverHtml({ meta, t, motif, seed, page, layout, heroUrl, zh }) {
  const metaBits = [meta.author, meta.org, meta.date].filter(Boolean).map(s => `<span>${esc(s)}</span>`)
  const kicker = meta.kicker ? `<div class="cover-kicker">${esc(meta.kicker)}</div>` : ''
  const size = titleSize(meta.title, zh)
  const title = `<div class="cover-title" style="font-size:${size}pt;line-height:${size > 44 ? 1.08 : 1.16}">${esc(meta.title)}</div>`
  const sub = meta.subtitle ? `<div class="cover-sub">${esc(meta.subtitle)}</div>` : ''
  const metaRow = metaBits.length ? `<div class="cover-meta">${metaBits.join('')}</div>` : ''
  const hero = heroUrl ? `<img class="hero" src="${esc(heroUrl)}" alt="">` : null
  if (layout === 'field') {
    const art = hero ?? motifSvg(motif, { seed, width: page.w, height: page.h, colors: artColors(t, 'deep') })
    return `<section class="cover cover-field">${art}<div class="scrim"></div><div class="cover-text">${kicker}${title}${sub}</div>${metaRow}</section>`
  }
  if (layout === 'split') {
    const art = hero ?? motifSvg(motif, { seed, width: page.w, height: page.h * 0.56, colors: artColors(t, 'deep') })
    return `<section class="cover cover-split"><div class="top">${art}</div><div class="cover-text">${kicker}${title}${sub}</div>${metaRow}</section>`
  }
  if (layout === 'scroll' && zh && [...meta.title].length <= 16) {
    const vsize = Math.min(56, Math.floor(180 / Math.max(4, [...meta.title].length) * 2.1))
    const art = hero ?? motifSvg(motif, { seed, width: page.w, height: page.h * 0.58, colors: artColors(t, 'paper') })
    const seal = t.seal ? `<div class="seal">${esc(([...(meta.seal ?? meta.title)].slice(0, 4)).join(''))}</div>` : ''
    return `<section class="cover cover-scroll"><div class="plate">${art}</div><div class="v-title" style="font-size:${vsize}pt">${esc(meta.title)}</div>${meta.subtitle ? `<div class="v-sub">${esc(meta.subtitle)}</div>` : ''}${seal}${metaRow}</section>`
  }
  const art = hero ?? motifSvg(motif, { seed, width: page.w, height: page.h * 0.58, colors: artColors(t, 'paper') })
  return `<section class="cover cover-paper"><div class="plate">${art}</div><div class="cover-text">${kicker}${title}${sub}</div>${metaRow}</section>`
}

function tocHtml({ entries, pages, t, motif, seed, labels, page }) {
  // With room to spare the page ends in an echo of the cover; a long list gets the whole page.
  const single = entries.length <= 17
  const art = single ? `<div class="toc-art">${motifSvg(motif, { seed: seed + 11, width: page.w, height: 92, colors: artColors(t, 'paper') })}</div>` : ''
  const numbered = entries.some(e => e.num)
  const rows = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    const p = pages?.[e.id] ?? ''
    if (e.level === 0) {
      rows.push(`<li class="l0"><a href="#${e.id}"><span>${e.html}</span><span class="t-p">${p}</span></a></li>`)
      i += 1
      continue
    }
    if (e.level === 1) {
      rows.push(`<li class="l1"><a href="#${e.id}">${numbered ? `<span class="t-n">${e.num ?? ''}</span>` : ''}<span>${e.html}</span><span class="t-p">${p}</span></a>`)
      i += 1
      const subs = []
      while (i < entries.length && entries[i].level === 2) {
        const s = entries[i]
        subs.push(`<li class="l2"><a href="#${s.id}"><span></span><span>${s.html}</span><span class="t-p">${pages?.[s.id] ?? ''}</span></a></li>`)
        i += 1
      }
      rows.push(subs.length ? `<ol>${subs.join('')}</ol></li>` : '</li>')
      continue
    }
    i += 1
  }
  return `<section class="toc sheet${single ? ' single' : ''}${numbered ? '' : ' flat'}">${art}<div class="toc-title">${labels.contents}</div><ol>${rows.join('')}</ol></section>`
}

function chapterOpener({ ch, t, motif, seed, labels, lang, numbered }) {
  const num = numbered
    ? (t.chapter === 'rule' ? String(ch.n).padStart(2, '0')
      : (lang === 'zh' ? `第${zhNumber(ch.n)}章` : `${labels.chapter} ${String(ch.n).padStart(2, '0')}`))
    : ''
  const numEl = num ? `<div class="chap-num">${esc(num)}</div>` : ''
  const h1 = `<h1 class="chap-title" id="${ch.id}">${ch.html}</h1>`
  if (t.chapter === 'band') {
    const art = motifSvg(motif, { seed: seed + ch.n * 97, width: 130, height: 60, colors: artColors(t, 'deep') })
    return `<header class="opener-band">${art}<div class="scrim"></div>${numEl}${h1}</header>`
  }
  if (t.chapter === 'numeral') {
    const art = motifSvg(motif, { seed: seed + ch.n * 97, width: 66, height: 52, colors: artColors(t, 'paper') })
    return `<header class="opener-numeral"><div class="op-art">${art}</div>${numEl}${h1}</header>`
  }
  return `<header class="opener-rule">${numEl}${h1}</header>`
}

function firstParagraphLead(html) {
  return html.replace(/^(\s*)<p>(?!\s*<img)/, (m, ws) => `${ws}<p class="lead">`)
}

/** Split the rendered body at chapter marks into structured sections. */
export function splitChapters(html, renderer) {
  const parts = html.split(/<!--atelier-chapter-(\d+)-->/)
  const intro = parts[0]
  const chapters = []
  for (let i = 1; i < parts.length; i += 2) {
    const idx = +parts[i]
    const title = renderer.expandInline(renderer.chapters[idx].html)
    chapters.push({ id: `c${idx}`, html: title, plain: plain(title), body: parts[i + 1] ?? '', n: chapters.length + 1 })
  }
  return { intro, chapters }
}

function partHtml(title, index, ctx) {
  const art = motifSvg(ctx.motif, { seed: ctx.seed + 500 + index, width: ctx.page.w, height: ctx.page.h, colors: artColors(ctx.t, 'deep') })
  const label = ctx.lang === 'zh' ? `第${zhNumber(index + 1)}部分` : `Part ${index + 1}`
  return `<section class="part">${art}<div class="part-inner"><div class="part-num">${label}</div><h1 id="p${index}">${esc(title)}</h1></div></section>`
}

/**
 * Build the page-ready HTML.
 * @param doc - resolved document: { meta, t, motif, seed, page, lang, docType, cover, toc, numbered,
 *              intro, chapters, partTitles, notes, heroUrl, density, coverLayout }
 * @param pages - map of heading id → page number, or null on the first pass.
 */
export function buildHtml(doc, pages) {
  const { meta, t, motif, seed, page, lang, docType, intro, chapters, partTitles, notes } = doc
  const zh = lang === 'zh'
  const labels = zh ? { contents: '目录', chapter: '第' } : { contents: 'Contents', chapter: 'Chapter' }
  const gutter = zh ? 27 : 33
  const flowing = docType === 'article' || docType === 'brief'
  const css = buildCss({
    t, lang, page, gutter, density: doc.density, title: meta.title,
    chapters: flowing ? [] : chapters, single: flowing,
  })
  const ctx = { t, motif, seed, page, lang }
  const expandParts = html => html.replace(/<!--atelier-part-(\d+)-->/g, (_, i) => partHtml(partTitles[+i], +i, ctx))

  let content = ''
  if (flowing) {
    const metaLine = [meta.author, meta.org, meta.date].filter(Boolean).map(esc).join(' · ')
    const art = motifSvg(motif, { seed, width: page.w, height: docType === 'brief' ? 46 : 66, colors: artColors(t, 'deep') })
    content += `<div class="sheet"><header class="masthead">${art}<div class="scrim"></div><div>${meta.kicker ? `<div class="mast-kicker">${esc(meta.kicker)}</div>` : ''}<div class="mast-title">${esc(meta.title)}</div>${meta.subtitle ? `<div class="mast-sub">${esc(meta.subtitle)}</div>` : ''}${metaLine ? `<div class="mast-meta">${metaLine}</div>` : ''}</div></header>`
    content += firstParagraphLead(intro)
    for (const ch of chapters) content += `<h1 class="plain" id="${ch.id}">${ch.html}</h1>${ch.body}`
    content += `${notes}</div>`
  } else {
    if (doc.cover) content += coverHtml({ meta, t, motif, seed, page, layout: doc.coverLayout, heroUrl: doc.heroUrl, zh })
    if (doc.toc) content += tocHtml({ entries: doc.tocEntries, pages, t, motif, seed, labels, page })
    if (intro.trim() !== '') content += `<section class="chapter sheet" style="page:bare">${firstParagraphLead(expandParts(intro))}</section>`
    chapters.forEach((ch, i) => {
      const opener = chapterOpener({ ch, t, motif, seed, labels, lang, numbered: doc.numbered })
      const tail = i === chapters.length - 1 ? notes : ''
      content += `<section class="chapter sheet" style="page:ch${i}">${opener}${firstParagraphLead(expandParts(ch.body))}${tail}</section>`
    })
    if (notes && chapters.length === 0) content += `<section class="sheet" style="page:bare">${notes}</section>`
    if (doc.backCover) {
      const art = motifSvg(motif, { seed: seed + 3, width: page.w, height: page.h, colors: artColors(t, 'deep') })
      content += `<div class="sheet"><section class="backcover">${art}<div class="scrim"></div><div class="colophon"><b>${esc(meta.title)}</b>${[meta.author, meta.org, meta.date].filter(Boolean).map(esc).join('<br>')}</div></section></div>`
    }
  }

  const fontsHref = pathToFileURL(path.join(ASSETS, 'fonts', 'fonts.css')).href
  return `<!doctype html>
<html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' file:; font-src file: data:; img-src file: data:">
<title>${esc(meta.title)}</title>
<link rel="stylesheet" href="${fontsHref}">
<style>${css}</style></head><body>${content}</body></html>`
}

/** Decide the contents entries; subsection lines are kept only when they fit. */
export function buildTocEntries({ chapters, partsInOrder, h2ByChapter, showSubs }) {
  const entries = []
  chapters.forEach((ch, i) => {
    for (const part of partsInOrder.filter(p => p.before === i)) entries.push({ id: part.id, level: 0, html: esc(part.title) })
    entries.push({ id: ch.id, level: 1, html: ch.html, num: ch.tocNum ?? '' })
    if (showSubs) for (const s of h2ByChapter[i] ?? []) entries.push({ id: s.id, level: 2, html: s.html })
  })
  return entries
}

export { hasOwnNumber }
