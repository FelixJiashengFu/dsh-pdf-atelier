// Host half of dsh-pdf-atelier.
//
// Six model-facing tools:
//   atelier_pdf       Markdown → an art-directed PDF, the plugin's reason to exist
//   atelier_themes    the art directions, ranked for a given subject
//   atelier_formula   LaTeX → font-free SVG/PNG
//   atelier_figure    declarative geometry/function figure → SVG/PNG
//   atelier_convert   formula, SVG or image file → embeddable image
//   atelier_document  Markdown/HTML/LaTeX document with those images inserted
//
// The last four are @jaxzhou/dsh-mathmatic-symbol (MIT) mounted under new names,
// so this plugin works next to that one without a tool-name collision.

import path from 'node:path'
import { apply as applyMathSymbol } from '@jaxzhou/dsh-mathmatic-symbol'
import { composePdf, formatReport } from './compose.js'
import { MOTIFS, THEMES, recommendTheme, themeCatalog } from './themes.js'

export const name = 'pdf-atelier'
export const inject = ['tools']

const RENAMES = {
  math_formula: 'atelier_formula',
  math_figure: 'atelier_figure',
  math_convert: 'atelier_convert',
  math_document: 'atelier_document',
}

function renameTools(text) {
  return text.replace(/math_(formula|figure|convert|document)/g, 'atelier_$1')
}

/** Mount the math plugin through a context that renames its tools and drops its prompt section. */
function mountMathTools(ctx, config) {
  const tools = new Proxy(ctx.tools, {
    get(target, key) {
      if (key === 'register') {
        return definition => target.register({
          ...definition,
          name: RENAMES[definition.name] ?? definition.name,
          description: renameTools(definition.description),
        })
      }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const wrapped = new Proxy(ctx, {
    get(target, key) {
      if (key === 'tools') return tools
      if (key === 'inject' || key === 'systemPrompt') return undefined
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  applyMathSymbol(wrapped, {
    outputDir: config.outputDir ?? 'atelier-assets',
    ...(config.scale !== undefined ? { scale: config.scale } : {}),
    ...(config.workspaceRoot !== undefined ? { workspaceRoot: config.workspaceRoot } : {}),
  })
}

const BODY_SYNTAX = [
  'Body is Markdown (GFM tables, lists, code fences with syntax colouring) plus:',
  '- "# heading" starts a chapter with a designed opener and new page; "##"/"###" are sections. Do not repeat the title as a heading.',
  '- $inline$ and $$display$$ LaTeX, typeset as vector outlines.',
  '- ![caption](path "wide") is a numbered figure; the optional title is wide, full, half, small or side. Two or three images on one line form a gallery. Remote URLs are not fetched: save the file in the workspace first.',
  '- ```chart fenced JSON: {"type":"bar|stacked|hbar|line|area|donut|scatter","x":[...],"series":[{"name":"","values":[...]}],"unit":"%","highlight":"max","caption":"..."}; or {"data":[{"label":"","value":0}]}; scatter takes {"points":[[x,y],...]}. Colours come from the theme: never set them.',
  '- ```figure fenced JSON: the atelier_figure spec for geometry and function plots, plus "caption" and "size". Colours may be omitted or be accent, accent2, accent3, ink, muted, rule. [[figure:name caption="..." size=wide]] uses the "figures" argument; [[chart:name]] uses "charts".',
  '- "Table: caption" (or "表：标题") in the paragraph right before a table captions and numbers it.',
  '- [^id] with a line "[^id]: text" adds a note collected at the end.',
  'Layout components, each opened by a ":::name" line and closed by a ":::" line:',
  '  :::key, :::note, :::tip, :::warn, :::example, :::summary, :::theorem, :::definition, :::lemma, :::proof (optional title after the name, e.g. ":::key 三个结论"). Use :::key for the one thing a reader must keep.',
  '  :::lead  large opening paragraph (the first paragraph of each chapter gets this automatically).',
  '  :::quote author="Name"  a large pull quote.',
  '  :::stats  lines "- 42% | label | small note"; 2 to 4 lines. For headline numbers.',
  '  :::steps  lines "- Title | detail". :::timeline  lines "- 2019 | Title | detail". :::glossary  lines "- Term | meaning".',
  '  :::cards  "### Title" then text per card (2, 3 or 4 cards). :::columns and :::compare  columns separated by a line "---".',
  '  :::aside title="..."  a small margin note. :::part Title  a full-page part divider before a chapter. :::pagebreak  forces a new page.',
].join('\n')

const PDF_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: { type: 'string', description: 'Workspace-relative output file ending in .pdf.' },
    title: { type: 'string', description: 'Document title. Keep it short; it is set very large on the cover. Taken from a lone "# heading" when omitted.' },
    subtitle: { type: 'string', description: 'One line under the title.' },
    kicker: { type: 'string', description: 'A small label above the title, such as "实验报告" or "Annual Report 2026".' },
    author: { type: 'string' },
    org: { type: 'string', description: 'Organisation, course or department.' },
    date: { type: 'string', description: 'Date as it should be printed. Omitted when not given; never guess it.' },
    brief: { type: 'string', description: 'What the document is about, who reads it and the tone wanted. Drives the art direction when theme is "auto".' },
    body: { type: 'string', description: 'The content as extended Markdown. For long documents write a file and use body_path.' },
    body_path: {
      description: 'Markdown file, or list of files concatenated in order, instead of "body". Relative image paths also resolve against each file\'s folder.',
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    theme: { type: 'string', description: `"auto" (default) picks from the content; or one of: ${Object.keys(THEMES).join(', ')}. See atelier_themes.` },
    palette: {
      type: 'object',
      additionalProperties: false,
      description: 'Hex overrides on top of the theme, for a brand or a subject colour. Text contrast is corrected automatically.',
      properties: {
        accent: { type: 'string' }, accent2: { type: 'string' }, accent3: { type: 'string' },
        paper: { type: 'string' }, ink: { type: 'string' }, deep: { type: 'string' },
      },
    },
    motif: { type: 'string', enum: MOTIFS, description: 'The generative art on the cover and openers. Chosen from the subject when omitted.' },
    doc_type: { type: 'string', enum: ['auto', 'report', 'book', 'article', 'brief'], description: 'report and book have a cover, contents and chapter pages; article and brief start with a masthead and flow. "auto" decides from length.' },
    cover_layout: { type: 'string', enum: ['field', 'split', 'paper', 'scroll'], description: 'scroll has a vertical CJK title.' },
    cover_image: { type: 'string', description: 'Local image to use as the cover art instead of the generated motif.' },
    cover: { type: 'boolean' },
    back_cover: { type: 'boolean' },
    toc: { type: 'boolean', description: 'Contents page with real page numbers. Default: on when there are three or more chapters.' },
    number_chapters: { type: 'boolean', description: 'Default: numbered unless the headings already carry numbers.' },
    seal: { type: 'string', description: 'Text of the red seal on the rice-paper cover, 1 to 4 characters.' },
    page_size: { type: 'string', enum: ['A4', 'Letter'] },
    lang: { type: 'string', enum: ['zh', 'en'], description: 'Sets typography rules and label language. Detected when omitted.' },
    figures: { type: 'object', additionalProperties: true, description: 'Name → atelier_figure spec, for [[figure:name]].' },
    charts: { type: 'object', additionalProperties: true, description: 'Name → chart spec, for [[chart:name]].' },
    keep_html: { type: 'boolean', description: 'Also keep the intermediate HTML beside the PDF, for debugging.' },
  },
}

const PDF_OUTPUT = {
  type: 'object',
  additionalProperties: true,
  required: ['path', 'host_path', 'pages', 'theme', 'warnings', 'review'],
  properties: {
    path: { type: 'string' },
    host_path: { type: 'string' },
    pages: { type: 'integer' },
    theme: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    review: { type: 'array', items: { type: 'string' } },
  },
}

function workspaceRoot(config, exec) {
  if (config.workspaceRoot) return path.resolve(config.workspaceRoot)
  const fromSession = exec.agent?.session.header.cwd
  return fromSession ? path.resolve(fromSession) : process.cwd()
}

function pdfTool(config) {
  return {
    name: 'atelier_pdf',
    description: 'Typeset a finished, beautifully designed PDF from extended Markdown. Palette, typography, cover art, chapter openers, contents with real page numbers and running heads are all chosen from the document\'s subject; pages are never black on white. Use this whenever the deliverable is a PDF, instead of writing your own HTML, CSS, LaTeX or a reportlab script. Returns the path, the art direction taken and a review listing anything worth improving.\n\n' + BODY_SYNTAX,
    parameters: PDF_PARAMETERS,
    output: {
      schema: PDF_OUTPUT,
      render(_args, value) {
        return [{ type: 'text', text: formatReport(value) }]
      },
    },
    execute: (args, exec) => composePdf(args, {
      root: workspaceRoot(config, exec),
      chromePath: config.chromePath,
      signal: exec.signal,
    }),
  }
}

function themesTool() {
  return {
    name: 'atelier_themes',
    description: 'List the PDF art directions, ranked for a subject when "brief" is given. Use it only to choose or explain a look; atelier_pdf already picks automatically.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brief: { type: 'string', description: 'The document\'s subject, audience or title.' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true, required: ['themes'], properties: { themes: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      render(_args, value) {
        const rows = value.themes.map(t => `- ${t.id} (${t.name} / ${t.english}): ${t.mood}; motif ${t.motif}`)
        const head = value.recommended ? `Best fit: ${value.recommended}\n` : ''
        return [{ type: 'text', text: `${head}${rows.join('\n')}\nMotifs: ${MOTIFS.join(', ')}` }]
      },
    },
    async execute(args) {
      const themes = themeCatalog()
      if (typeof args?.brief !== 'string' || args.brief.trim() === '') return { themes }
      const ranking = recommendTheme({ brief: args.brief })
      const order = new Map(ranking.map((r, i) => [r.theme, i]))
      themes.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
      return { themes, recommended: ranking[0].theme }
    },
  }
}

const GUIDANCE = [
  'PDF deliverables: whenever the user wants a PDF (report, handout, guide, proposal, 讲义, 报告, 文档…), produce it with `atelier_pdf`. Do not write your own HTML/CSS, LaTeX, reportlab or similar, and do not hand over a plain black-on-white document.',
  'The design is the tool\'s job; your job is content worth designing:',
  '- Pass "brief" (subject, reader, tone), a short "title", a "subtitle", and "kicker", "author", "date" only when actually known.',
  '- Structure with "#" chapters and "##" sections. Short paragraphs. Vary the rhythm: every page or two should have a chart, figure, table, image, :::stats, :::steps, :::timeline, :::cards, :::quote or :::key. Use components because they fit the content, and never more than one or two per page.',
  '- Put real data in ```chart and geometry or functions in ```figure directly in the body, so they take the theme\'s colours. If you already made an image with atelier_figure, reference its .svg rather than the .png. Never invent numbers to decorate a page.',
  '- If an image-generation tool is available and the subject deserves a picture, generate one, save it in the workspace, and pass it as "cover_image" or as a figure.',
  '- Read the returned review. If it lists problems, fix the content and call again, two or three rounds at most. Deliver the file path to the user when it is clean or the remaining notes do not apply. Do not render pages to images to check them: the review already covers layout.',
  'For a formula, figure, or converted image on its own, or for Markdown/HTML/LaTeX documents with those images inserted, use `atelier_formula`, `atelier_figure`, `atelier_convert` and `atelier_document`. Plain chat answers keep using LaTeX text.',
].join('\n')

export function apply(ctx, config = {}) {
  ctx.tools.register(pdfTool(config))
  ctx.tools.register(themesTool())
  mountMathTools(ctx, config)
  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], promptCtx => {
      const prompt = promptCtx.systemPrompt
      prompt.section({
        name: 'tool:pdf-atelier',
        order: prompt.getSectionOrder('TOOL_REPORT'),
        text: ({ scope }) => (ctx.tools.get?.('atelier_pdf', scope) === undefined ? '' : GUIDANCE),
      })
    })
  }
}
