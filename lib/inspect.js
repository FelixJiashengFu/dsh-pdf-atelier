// Reads the finished PDF back: heading → page numbers for the contents, how full
// each page is, and a design review a blind model can act on.

import { getDocumentProxy } from 'unpdf'

async function flattenOutline(doc, items, out = []) {
  for (const item of items ?? []) {
    let page = null
    try {
      const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
      if (dest?.[0]) page = (await doc.getPageIndex(dest[0])) + 1
    } catch { /* an unresolved destination simply has no page */ }
    out.push({ title: item.title, page })
    await flattenOutline(doc, item.items, out)
  }
  return out
}

/**
 * @param bytes - the PDF.
 * @returns { pageCount, outline: [{title, page}], fill: per-page { top, bottom, chars, drawn } }
 */
export async function analysePdf(bytes) {
  const doc = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 })
  try {
    const outline = await flattenOutline(doc, await doc.getOutline())
    const pages = []
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n)
      const { height } = page.getViewport({ scale: 1 })
      const text = await page.getTextContent()
      let bottom = 0
      let chars = 0
      // Running heads and page numbers sit in the margins and do not count as content.
      for (const item of text.items) {
        const str = item.str?.trim()
        if (!str) continue
        const y = height - item.transform[5]
        if (y < height * 0.068 || y > height * 0.925) continue
        chars += str.length
        bottom = Math.max(bottom, y)
      }
      const ops = await page.getOperatorList()
      pages.push({ page: n, fill: bottom / height, chars, ops: ops.fnArray.length })
    }
    return { pageCount: doc.numPages, outline, pages }
  } finally {
    await doc.loadingTask?.destroy?.()
  }
}

/** Match outline entries back to heading ids; the outline is in document order. */
export function pageMap(outline, headingIds) {
  if (outline.length !== headingIds.length) return null
  const map = {}
  headingIds.forEach((id, i) => { map[id] = outline[i].page })
  return map
}

/** Pages near the end of a chapter holding a stub of content: the classic ugly page. */
export function stubPages(analysis, lastPages) {
  return analysis.pages.filter(p => lastPages.has(p.page) && p.chars > 0 && p.fill < 0.2).map(p => p.page)
}

/** Structural review of the rendered body: what would an art director ask for? */
export function reviewContent({ chapters, intro, renderer, zh, pageCount, analysis, coverPages, lastPages }) {
  const review = []
  const counts = renderer.counts
  const visuals = counts.images + counts.figures + counts.charts
  const unit = zh ? '字' : 'words'
  const size = s => (zh ? s.replace(/\s/g, '').length : s.split(/\s+/).length)
  const longLimit = zh ? 420 : 170
  const runLimit = zh ? 1500 : 620

  for (const section of [{ plain: '(opening)', body: intro }, ...chapters]) {
    const blocks = section.body.split(/(?=<(?:p|h[2-6]|figure|aside|div|table|ol|ul|pre|blockquote|dl)\b)/)
    let run = 0
    let reported = false
    for (const block of blocks) {
      const isVisual = /^<(figure|aside|div|table|pre|blockquote|dl|ol)\b/.test(block)
      const isHeading = /^<h[2-3]\b/.test(block)
      if (/^<p\b/.test(block)) {
        const textLen = size(block.replace(/<svg[\s\S]*?<\/svg>/g, 'x').replace(/<[^>]+>/g, ''))
        run += textLen
        if (textLen > longLimit) review.push(`“${section.plain.slice(0, 24)}” has a ${textLen}-${unit} paragraph; split it, or pull the key sentence into :::quote`)
      }
      if (isVisual || isHeading) {
        if (run > runLimit && !reported) {
          review.push(`“${section.plain.slice(0, 24)}” runs ${run} ${unit} with nothing to rest the eye; add a figure, table, :::stats or :::callout`)
          reported = true
        }
        run = 0
      }
    }
    if (run > runLimit && !reported) review.push(`“${section.plain.slice(0, 24)}” ends with ${run} ${unit} of unbroken text; add a figure, table or :::callout`)
  }
  if (pageCount >= 6 && visuals === 0) {
    review.push('no image, figure or chart anywhere in the document; add at least one ```chart, ```figure or real image per chapter where the subject allows')
  }
  if (counts.components === 0 && pageCount >= 4) {
    review.push('no layout component was used; :::stats, :::steps, :::timeline, :::cards or :::key would give the pages rhythm')
  }
  for (const p of analysis.pages) {
    if (coverPages.has(p.page)) continue
    if (p.chars === 0 && p.ops < 14) review.push(`page ${p.page} is blank; remove a stray :::pagebreak`)
    else if (lastPages.has(p.page) && p.chars > 0 && p.fill < 0.2) review.push(`page ${p.page} holds only a few lines at the end of a section; trim the text a little or add a figure before it`)
  }
  return review
}
