// Art directions. Every theme is a complete decision about paper, ink, type and
// page furniture; none of them is black on white. `recommendTheme` reads the
// document and picks one, and a seed drawn from the title nudges hue and cover
// composition so two documents in one theme still look like different objects.

import { contrast, ensureContrast, inkOn, isHex, lightness, mix, rotateHue } from './color.js'

const LATIN = {
  fraunces: "'Fraunces Variable'",
  sourceSerif: "'Source Serif 4 Variable'",
  inter: "'Inter Variable'",
  playfair: "'Playfair Display Variable'",
  mono: "'JetBrains Mono Variable'",
}
const CJK = {
  serif: "'Noto Serif SC Variable','Noto Serif SC','Songti SC','SimSun'",
  sans: "'Noto Sans SC Variable','Noto Sans SC','PingFang SC','Microsoft YaHei'",
  kai: "'LXGW WenKai','Kaiti SC','KaiTi'",
}

const face = (latin, cjk, generic) => ({ latin: LATIN[latin], cjk: CJK[cjk], generic })

export const THEMES = {
  xuan: {
    zh: '宣纸朱砂', en: 'Rice Paper & Cinnabar',
    mood: '宣纸底、松烟墨、朱砂印：文史、哲学、古典、散文、中国主题',
    paper: '#f3ecdd', ink: '#2b2622', accent: '#a8341f', accent2: '#3f5c64', accent3: '#a98a4e', deep: '#2b2622', onDeep: '#c9452f',
    display: face('sourceSerif', 'serif', 'serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('sourceSerif', 'kai', 'serif'),
    motif: 'mountains', covers: ['scroll'], chapter: 'numeral', radius: '0', displayWeight: 800, labelCase: 'none', indent: true, seal: true,
  },
  reagent: {
    zh: '试剂青', en: 'Reagent Teal',
    mood: '冷静的青绿与珊瑚橙：化学、材料、实验报告、药学',
    paper: '#edf2ec', ink: '#14312f', accent: '#0f6f69', accent2: '#d9622f', accent3: '#7f9a3c', deep: '#0d3b3a', onDeep: '#ec8a5e',
    display: face('inter', 'sans', 'sans-serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('mono', 'sans', 'monospace'),
    motif: 'hexlattice', covers: ['field', 'split'], chapter: 'band', radius: '2mm', displayWeight: 700, labelCase: 'uppercase',
  },
  euclid: {
    zh: '欧几里得', en: 'Byrne’s Euclid',
    mood: '奶油纸上的朱红、普鲁士蓝与藤黄，致敬 Byrne 版《几何原本》：数学、几何、逻辑、理论',
    paper: '#f4ecd8', ink: '#1f2a3a', accent: '#c8372a', accent2: '#1f4e8c', accent3: '#d9a31e', deep: '#1a2c4d', onDeep: '#e4503d',
    display: face('fraunces', 'serif', 'serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'construction', covers: ['paper', 'split'], chapter: 'rule', radius: '0', displayWeight: 700, labelCase: 'uppercase', dropcap: true,
  },
  nocturne: {
    zh: '夜航', en: 'Nocturne',
    mood: '通篇深色、星光金字：天文、宇宙、物理前沿、科幻、未来展望',
    paper: '#11162a', ink: '#e8e3d3', accent: '#e8b86d', accent2: '#7fb5d6', accent3: '#c78fb5', deep: '#0a0d1c', onDeep: '#e8b86d',
    display: face('playfair', 'serif', 'serif'), body: face('inter', 'sans', 'sans-serif'), label: face('mono', 'sans', 'monospace'),
    motif: 'orbits', covers: ['field'], chapter: 'rule', radius: '1.5mm', displayWeight: 700, labelCase: 'uppercase', dark: true,
  },
  moss: {
    zh: '苔原', en: 'Moss & Clay',
    mood: '苔绿配陶土色，等高线纹样：生态、农业、地理、气候、户外、可持续',
    paper: '#f0ede0', ink: '#27332a', accent: '#3f6b48', accent2: '#b5623a', accent3: '#a3973f', deep: '#24412f', onDeep: '#d68f5f',
    display: face('sourceSerif', 'serif', 'serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'contour', covers: ['split', 'field'], chapter: 'band', radius: '3mm', displayWeight: 650, labelCase: 'none',
  },
  ledger: {
    zh: '账簿', en: 'Ledger Green',
    mood: '墨绿与黄铜，克制的商业气质：金融、经济、投资、咨询、年报、商业计划',
    paper: '#f3f0e6', ink: '#1c2a25', accent: '#0f5140', accent2: '#a67c23', accent3: '#7b4a3a', deep: '#0d3a2e', onDeep: '#cfa64c',
    display: face('playfair', 'serif', 'serif'), body: face('inter', 'sans', 'sans-serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'bars', covers: ['field', 'split'], chapter: 'rule', radius: '0', displayWeight: 700, labelCase: 'uppercase',
  },
  graphite: {
    zh: '石墨', en: 'Graphite Signal',
    mood: '石墨灰配信号蓝与荧光黄，等宽标签：软件、工程、API、架构、技术文档',
    paper: '#ecebe6', ink: '#1a1c22', accent: '#2f49d1', accent2: '#c43d7b', accent3: '#8a8f12', deep: '#191b22', onDeep: '#8296ff',
    display: face('inter', 'sans', 'sans-serif'), body: face('inter', 'sans', 'sans-serif'), label: face('mono', 'sans', 'monospace'),
    motif: 'circuit', covers: ['field', 'split'], chapter: 'band', radius: '1.5mm', displayWeight: 750, labelCase: 'none',
  },
  tide: {
    zh: '潮汐', en: 'Tide',
    mood: '海军蓝配珊瑚，清爽有序：医学、公共卫生、海洋、气象、物理教学',
    paper: '#ebf1f3', ink: '#14293b', accent: '#14507a', accent2: '#e0603f', accent3: '#2f9a94', deep: '#0f3454', onDeep: '#f08a68',
    display: face('inter', 'sans', 'sans-serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'waves', covers: ['split', 'field'], chapter: 'band', radius: '2.5mm', displayWeight: 700, labelCase: 'uppercase',
  },
  terra: {
    zh: '赤陶', en: 'Terracotta Studio',
    mood: '赤陶与茄紫，包豪斯式几何：艺术、设计、建筑、时尚、作品集',
    paper: '#f3e5d6', ink: '#33202a', accent: '#b34a2a', accent2: '#3f2a55', accent3: '#d29b35', deep: '#3a1f33', onDeep: '#e39150',
    display: face('playfair', 'serif', 'serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'bauhaus', covers: ['split', 'paper'], chapter: 'numeral', radius: '0', displayWeight: 800, labelCase: 'uppercase', dropcap: true,
  },
  playground: {
    zh: '游乐场', en: 'Playground',
    mood: '奶黄底配番茄红与湖蓝，圆润活泼：儿童、入门教程、科普、家长读物',
    paper: '#fff4d6', ink: '#2c3e50', accent: '#e4572e', accent2: '#17809a', accent3: '#d99a0c', deep: '#17678a', onDeep: '#ffc44d',
    display: face('fraunces', 'sans', 'sans-serif'), body: face('fraunces', 'kai', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'confetti', covers: ['field', 'paper'], chapter: 'band', radius: '5mm', displayWeight: 800, labelCase: 'none',
  },
  plum: {
    zh: '梅子', en: 'Plum',
    mood: '梅紫配玫瑰灰，温润内敛：心理、教育、社会、人物、生活方式、个人陈述',
    paper: '#f4ecec', ink: '#32202d', accent: '#6d2c55', accent2: '#b65c6e', accent3: '#a58245', deep: '#40203a', onDeep: '#dc8ea0',
    display: face('fraunces', 'serif', 'serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('sourceSerif', 'kai', 'serif'),
    motif: 'ripple', covers: ['paper', 'split'], chapter: 'rule', radius: '2mm', displayWeight: 600, labelCase: 'none',
  },
  chlorophyll: {
    zh: '叶绿', en: 'Chlorophyll',
    mood: '叶绿配品红，生命科学的鲜活：生物、基因、细胞、神经、医学研究',
    paper: '#f0f1e2', ink: '#20301f', accent: '#3d7a2c', accent2: '#b0327a', accent3: '#d18a1f', deep: '#1f4a2a', onDeep: '#e06aad',
    display: face('inter', 'sans', 'sans-serif'), body: face('sourceSerif', 'serif', 'serif'), label: face('inter', 'sans', 'sans-serif'),
    motif: 'helix', covers: ['field', 'split'], chapter: 'band', radius: '2.5mm', displayWeight: 700, labelCase: 'none',
  },
  synapse: {
    zh: '突触', en: 'Synapse',
    mood: '深紫靛底的页眉配电光青：人工智能、机器学习、数据科学、算法',
    paper: '#eeedf5', ink: '#1d1b33', accent: '#4a35b8', accent2: '#0f9aa8', accent3: '#d5502f', deep: '#1c1646', onDeep: '#46d6e2',
    display: face('inter', 'sans', 'sans-serif'), body: face('inter', 'sans', 'sans-serif'), label: face('mono', 'sans', 'monospace'),
    motif: 'network', covers: ['field', 'split'], chapter: 'band', radius: '2mm', displayWeight: 750, labelCase: 'none',
  },
}

export const MOTIFS = ['mountains', 'hexlattice', 'construction', 'orbits', 'contour', 'bars', 'circuit', 'waves', 'bauhaus', 'confetti', 'ripple', 'helix', 'network']

// Subject keywords → an art direction. Weights accumulate over title, brief,
// headings and body, so one stray word cannot flip the choice.
const TOPICS = [
  ['reagent', 'hexlattice', ['化学', '有机', '无机', '分子', '反应', '催化', '合成', '光谱', '核磁', '滴定', '试剂', '晶体', '材料', 'chemistry', 'chemical', 'molecul', 'synthesis', 'catalys', 'spectro', 'nmr', 'reagent', 'titration', 'polymer', 'organic', 'compound', 'lab report', '实验报告', '实验']],
  ['euclid', 'construction', ['数学', '几何', '代数', '微积分', '定理', '证明', '公式', '函数', '方程', '线性', '概率', '拓扑', '矩阵', 'math', 'geometry', 'algebra', 'calculus', 'theorem', 'proof', 'equation', 'matrix', 'integral', 'derivative', 'topology', 'logic', '逻辑']],
  ['nocturne', 'orbits', ['天文', '宇宙', '星系', '黑洞', '行星', '恒星', '航天', '火箭', '量子', '相对论', '科幻', 'astronom', 'cosmo', 'galaxy', 'black hole', 'planet', 'stellar', 'quantum', 'relativity', 'space', 'orbit', 'telescope', 'sci-fi']],
  ['moss', 'contour', ['生态', '环境', '气候', '农业', '森林', '土壤', '可持续', '碳', '地理', '地质', '徒步', '植物', 'ecolog', 'environment', 'climate', 'agricultur', 'forest', 'soil', 'sustainab', 'carbon', 'geograph', 'geolog', 'hiking', 'garden', 'biodiversity', '校园', 'campus']],
  ['ledger', 'bars', ['金融', '财务', '投资', '经济', '市场', '商业', '营收', '利润', '股票', '基金', '年报', '融资', '战略', '咨询', '预算', '估值', 'finance', 'financial', 'invest', 'econom', 'market', 'revenue', 'profit', 'business', 'strategy', 'budget', 'valuation', 'startup', 'annual report', 'consulting']],
  ['graphite', 'circuit', ['软件', '编程', '代码', '架构', '接口', '后端', '前端', '数据库', '服务器', '部署', '开发', '工程', '系统设计', '云', 'software', 'code', 'programming', 'api', 'backend', 'frontend', 'database', 'server', 'deploy', 'kubernetes', 'architecture', 'devops', 'engineering', 'plugin', '插件', 'rust', 'typescript', 'python']],
  ['synapse', 'network', ['人工智能', '机器学习', '深度学习', '神经网络', '大模型', '模型', '算法', '数据科学', '智能体', 'transformer', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', ' llm', 'gpt', 'agent', 'algorithm', 'data science', 'diffusion model', 'deepseek']],
  ['tide', 'waves', ['医学', '临床', '公共卫生', '护理', '海洋', '气象', '流体', '波动', '声学', '水文', 'medic', 'clinical', 'health', 'patient', 'ocean', 'marine', 'weather', 'fluid', 'wave', 'acoustic', 'physics', '物理', '力学', '电磁']],
  ['chlorophyll', 'helix', ['生物', '基因', '细胞', '蛋白', '遗传', 'dna', 'rna', '神经科学', '免疫', '进化', '酶', '代谢', 'biolog', 'gene', 'cell', 'protein', 'genom', 'neuroscience', 'immun', 'evolution', 'enzyme', 'metabol', 'crispr']],
  ['terra', 'bauhaus', ['艺术', '设计', '建筑', '时尚', '摄影', '绘画', '美学', '作品集', '展览', '品牌', 'art', 'design', 'architect', 'fashion', 'photograph', 'painting', 'aesthetic', 'portfolio', 'exhibition', 'brand', 'typography', '字体']],
  ['xuan', 'mountains', ['历史', '古代', '诗', '词', '文学', '哲学', '儒', '道家', '佛', '唐', '宋', '明清', '国学', '书法', '茶', '水墨', '文化', 'history', 'ancient', 'poetry', 'literature', 'philosophy', 'dynasty', 'classic', 'calligraphy', 'culture', 'essay']],
  ['playground', 'confetti', ['儿童', '小学', '孩子', '二年级', '启蒙', '绘本', '乘法', '家长', '趣味', '入门', '零基础', '小朋友', 'kids', 'children', 'elementary', 'beginner', 'for parents', 'fun with', 'primer', 'playful']],
  ['plum', 'ripple', ['心理', '情绪', '教育', '社会', '人物', '生活', '个人陈述', '简历', '成长', '婚礼', '旅行', '回忆', 'psycholog', 'emotion', 'education', 'society', 'biography', 'lifestyle', 'personal statement', 'resume', 'wedding', 'travel', 'memoir', 'wellbeing']],
]

const FALLBACKS = ['euclid', 'moss', 'tide', 'terra', 'plum', 'ledger']

export function hashSeed(text) {
  let h = 2166136261
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function countHits(text, key) {
  if (!text) return 0
  let hits = 0
  let at = text.indexOf(key)
  while (at !== -1 && hits < 40) {
    // An English key must start a word, or "art" would match "chart" and "part".
    if (!/^[a-z]/.test(key) || at === 0 || !/[a-z]/.test(text[at - 1])) hits += 1
    at = text.indexOf(key, at + key.length)
  }
  return hits
}

/**
 * Rank the art directions for a document.
 * @returns the ranked list with score and matched words.
 */
export function recommendTheme({ title = '', brief = '', body = '' }) {
  const titleText = title.toLowerCase()
  const briefText = brief.toLowerCase()
  const headings = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1]).join(' ').toLowerCase()
  const bodyText = body.replace(/^\s*(`{3,}|~{3,})[\s\S]*?^\s*\1\s*$/gm, '').toLowerCase().slice(0, 60000)
  const scored = TOPICS.map(([theme, motif, keys]) => {
    let score = 0
    const matched = []
    for (const key of keys) {
      const fromTitle = countHits(titleText, key)
      const fromBrief = countHits(briefText, key)
      const fromHeadings = countHits(headings, key)
      const fromBody = countHits(bodyText, key)
      // Single-character zh keys and very short keys are weak on their own.
      const weight = key.trim().length <= 1 ? 0.3 : 1
      const gain = weight * (fromTitle * 12 + fromBrief * 8 + fromHeadings * 3 + Math.min(fromBody, 12))
      if (gain > 0) {
        score += gain
        matched.push(key.trim())
      }
    }
    return { theme, motif, score, matched }
  }).sort((a, b) => b.score - a.score)
  if (scored[0].score < 3) {
    const theme = FALLBACKS[hashSeed(title + brief) % FALLBACKS.length]
    return [{ theme, motif: THEMES[theme].motif, score: 0, matched: [] }, ...scored.filter(s => s.theme !== theme)]
  }
  return scored
}

/**
 * Resolve a theme id plus overrides into concrete, contrast-checked tokens.
 * @param id - a key of THEMES.
 * @param overrides - optional { accent, accent2, paper, ink, deep }.
 * @param seed - document seed; jitters hues slightly.
 */
export function buildPalette(id, overrides = {}, seed = 0) {
  const base = THEMES[id]
  if (!base) throw new Error(`unknown theme "${id}"; choose one of: ${Object.keys(THEMES).join(', ')}`)
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && !isHex(value)) throw new Error(`theme override "${key}" must be a hex colour, got "${value}"`)
  }
  const jitter = (seed % 9) - 4
  const paper = overrides.paper ?? base.paper
  const dark = lightness(paper) < 0.5
  const ink = ensureContrast(overrides.ink ?? base.ink, paper, 10)
  const raw = overrides.accent ?? rotateHue(base.accent, jitter)
  const accent = ensureContrast(raw, paper, 3.6)
  const accentText = ensureContrast(raw, paper, 4.6)
  const accent2 = ensureContrast(overrides.accent2 ?? rotateHue(base.accent2, jitter), paper, 3)
  const accent3 = ensureContrast(overrides.accent3 ?? base.accent3, paper, 2.2)
  const deep = overrides.deep ?? (overrides.accent ? mix(overrides.accent, dark ? '#000000' : base.ink, 0.62) : base.deep)
  const deepInk = dark ? ink : inkOn(deep, '#16161a', mix(paper, '#ffffff', 0.45))
  const ink2 = ensureContrast(mix(ink, paper, 0.2), paper, 7)
  const ink3 = ensureContrast(mix(ink, paper, 0.42), paper, 4.6)
  const rule = mix(ink, paper, dark ? 0.76 : 0.82)
  const panel = mix(paper, accent, dark ? 0.1 : 0.07)
  const panel2 = mix(paper, ink, dark ? 0.1 : 0.06)
  const codeBg = dark ? mix(paper, '#000000', 0.32) : mix(paper, ink, 0.05)
  const onDeepAccent = ensureContrast(overrides.accent ? mix(accent, '#ffffff', 0.35) : base.onDeep, deep, 4)
  const chart = [accent, accent2, accent3, mix(accent, ink, 0.45), mix(accent2, paper, 0.4), mix(accent3, ink, 0.4)]
  return {
    id, zh: base.zh, en: base.en, mood: base.mood, dark,
    paper, ink, ink2, ink3, rule, panel, panel2, accent, accentText, accent2, accent3, deep, deepInk, onDeepAccent, codeBg,
    accentInk: inkOn(accent, '#16161a', '#fdfaf3'),
    chart,
    display: base.display, body: base.body, label: base.label,
    covers: base.covers, chapter: base.chapter, radius: base.radius, displayWeight: base.displayWeight,
    labelCase: base.labelCase, indent: !!base.indent, dropcap: !!base.dropcap, seal: !!base.seal, motif: base.motif,
    contrastInk: contrast(ink, paper),
  }
}

export function themeCatalog() {
  return Object.entries(THEMES).map(([id, t]) => ({ id, name: t.zh, english: t.en, mood: t.mood, motif: t.motif }))
}
