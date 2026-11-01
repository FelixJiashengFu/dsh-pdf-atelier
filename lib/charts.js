// Declarative charts drawn as inline SVG in the theme's colours. Text stays real
// text, so it is selectable and set in the document's label font.

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f = n => (Math.round(n * 100) / 100).toString()

function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1
  const span = max - min
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step)
  return { ticks, lo, hi }
}

function fmt(value, unit = '') {
  const abs = Math.abs(value)
  let text
  if (abs >= 1e6) text = `${+(value / 1e6).toFixed(1)}M`
  else if (abs >= 1e4) text = `${+(value / 1e3).toFixed(1)}k`
  else if (Number.isInteger(value)) text = String(value)
  else text = String(+value.toFixed(abs < 1 ? 3 : 2))
  return text + unit
}

function normalize(spec) {
  const labels = spec.x ?? spec.labels ?? (Array.isArray(spec.data) ? spec.data.map(d => d.label ?? d.x) : undefined)
  let series = spec.series
  if (!series && Array.isArray(spec.data)) {
    series = [{ name: spec.name ?? '', values: spec.data.map(d => d.value ?? d.y) }]
  }
  if (!series && Array.isArray(spec.values)) series = [{ name: spec.name ?? '', values: spec.values }]
  if (!Array.isArray(series) || series.length === 0) throw new Error('chart needs "series" [{name, values}] or "data" [{label, value}]')
  for (const s of series) {
    if (!Array.isArray(s.values) || s.values.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error(`chart series "${s.name ?? ''}" must have numeric "values"`)
    }
  }
  return { labels: labels ?? series[0].values.map((_, i) => String(i + 1)), series }
}

function legend(series, palette, x, y, width) {
  if (series.length < 2) return ''
  let cx = x
  let cy = y
  const out = []
  series.forEach((s, i) => {
    const w = 15 + String(s.name).length * (/[㐀-鿿]/.test(s.name) ? 10.5 : 6)
    if (cx + w > x + width) { cx = x; cy += 15 }
    out.push(`<rect x="${f(cx)}" y="${f(cy - 8)}" width="9" height="9" rx="2" fill="${palette[i % palette.length]}"/><text x="${f(cx + 13)}" y="${f(cy)}" class="ct">${esc(s.name)}</text>`)
    cx += w + 14
  })
  return out.join('')
}

function yAxis(frame, scale, ticks, unit, tokens) {
  return ticks.map(t => {
    const y = scale(t)
    return `<line x1="${frame.l}" x2="${frame.r}" y1="${f(y)}" y2="${f(y)}" stroke="${t === 0 ? tokens.ink3 : tokens.rule}" stroke-width="${t === 0 ? 0.9 : 0.6}"/><text x="${frame.l - 7}" y="${f(y + 3.5)}" class="ct mu" text-anchor="end">${esc(fmt(t, unit))}</text>`
  }).join('')
}

function barChart(spec, tokens, W, H) {
  const { labels, series } = normalize(spec)
  const stacked = spec.type === 'stacked'
  const values = stacked
    ? labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    : series.flatMap(s => s.values)
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  const legendH = series.length > 1 ? 24 : 0
  const frame = { l: 46, r: W - 6, t: 10 + legendH, b: H - 26 }
  const scale = v => frame.b - ((v - lo) / (hi - lo)) * (frame.b - frame.t)
  const band = (frame.r - frame.l) / labels.length
  const palette = tokens.chart
  const out = [legend(series, palette, frame.l, 12, W - frame.l), yAxis(frame, scale, ticks, spec.unit ?? '', tokens)]
  const peak = Math.max(...values)
  labels.forEach((label, i) => {
    const x0 = frame.l + i * band
    if (stacked) {
      let acc = 0
      series.forEach((s, k) => {
        const v = s.values[i] ?? 0
        out.push(`<rect x="${f(x0 + band * 0.18)}" y="${f(scale(acc + v))}" width="${f(band * 0.64)}" height="${f(Math.abs(scale(acc) - scale(acc + v)))}" fill="${palette[k % palette.length]}"/>`)
        acc += v
      })
      out.push(`<text x="${f(x0 + band / 2)}" y="${f(scale(acc) - 4)}" class="ct" text-anchor="middle">${esc(fmt(acc, spec.unit ?? ''))}</text>`)
    } else {
      const inner = band * 0.72
      const w = inner / series.length
      series.forEach((s, k) => {
        const v = s.values[i] ?? 0
        const y = scale(Math.max(v, 0))
        const h = Math.abs(scale(v) - scale(0))
        const single = series.length === 1
        const fill = single
          ? (spec.highlight === label || spec.highlight === i || (spec.highlight === 'max' && v === peak) ? tokens.chart[1] : tokens.chart[0])
          : palette[k % palette.length]
        out.push(`<rect x="${f(x0 + (band - inner) / 2 + k * w + 0.6)}" y="${f(y)}" width="${f(w - 1.2)}" height="${f(Math.max(h, 0.5))}" rx="${f(Math.min(1.6, w / 5))}" fill="${fill}"/>`)
        if (single && labels.length <= 14) out.push(`<text x="${f(x0 + band / 2)}" y="${f(y - 4)}" class="ct" text-anchor="middle">${esc(fmt(v, spec.unit ?? ''))}</text>`)
      })
    }
    out.push(`<text x="${f(x0 + band / 2)}" y="${f(frame.b + 15)}" class="ct mu" text-anchor="middle">${esc(label)}</text>`)
  })
  return out.join('')
}

function hbarChart(spec, tokens, W) {
  const { labels, series } = normalize(spec)
  const s = series[0]
  const longest = Math.max(...labels.map(l => String(l).length * (/[㐀-鿿]/.test(l) ? 11 : 6.2)))
  const left = Math.min(W * 0.36, longest + 12)
  const rowH = 25
  const H = labels.length * rowH + 6
  const max = Math.max(...s.values, 0)
  const span = W - left - 44
  const out = []
  labels.forEach((label, i) => {
    const y = i * rowH + 3
    const v = s.values[i]
    const hit = spec.highlight === label || spec.highlight === i || (spec.highlight === 'max' && v === max)
    out.push(`<text x="${f(left - 8)}" y="${f(y + 13.5)}" class="ct" text-anchor="end">${esc(label)}</text>`)
    out.push(`<rect x="${f(left)}" y="${f(y + 2)}" width="${f(Math.max(1, (v / (max || 1)) * span))}" height="16" rx="1.6" fill="${hit ? tokens.chart[1] : tokens.chart[0]}"/>`)
    out.push(`<text x="${f(left + Math.max(1, (v / (max || 1)) * span) + 6)}" y="${f(y + 13.5)}" class="ct">${esc(fmt(v, spec.unit ?? ''))}</text>`)
  })
  return { markup: out.join(''), H }
}

function lineChart(spec, tokens, W, H) {
  const { labels, series } = normalize(spec)
  const all = series.flatMap(s => s.values)
  const { ticks, lo, hi } = niceTicks(spec.type === 'area' ? Math.min(0, ...all) : Math.min(...all), Math.max(...all))
  const frame = { l: 46, r: W - (series.length > 1 ? 74 : 40), t: 10, b: H - 26 }
  const scale = v => frame.b - ((v - lo) / (hi - lo)) * (frame.b - frame.t)
  const xs = i => frame.l + (labels.length === 1 ? 0 : (i / (labels.length - 1)) * (frame.r - frame.l))
  const out = [yAxis(frame, scale, ticks, spec.unit ?? '', tokens)]
  const every = Math.ceil(labels.length / 9)
  labels.forEach((label, i) => {
    if (i % every === 0 || i === labels.length - 1) {
      out.push(`<text x="${f(xs(i))}" y="${f(frame.b + 15)}" class="ct mu" text-anchor="middle">${esc(label)}</text>`)
    }
  })
  series.forEach((s, k) => {
    const color = tokens.chart[k % tokens.chart.length]
    const pts = s.values.map((v, i) => `${f(xs(i))} ${f(scale(v))}`)
    if (spec.type === 'area') {
      out.push(`<path d="M${pts.join('L')}L${f(xs(s.values.length - 1))} ${f(scale(Math.max(lo, 0)))}L${f(xs(0))} ${f(scale(Math.max(lo, 0)))}Z" fill="${color}" opacity="${series.length > 1 ? 0.2 : 0.16}"/>`)
    }
    out.push(`<path d="M${pts.join('L')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`)
    const i = s.values.length - 1
    out.push(`<circle cx="${f(xs(i))}" cy="${f(scale(s.values[i]))}" r="2.6" fill="${color}"/>`)
    if (series.length > 1) out.push(`<text x="${f(xs(i) + 6)}" y="${f(scale(s.values[i]) + 3.5)}" class="ct" fill="${color}" style="fill:${color}">${esc(s.name)}</text>`)
    else out.push(`<text x="${f(xs(i) + 6)}" y="${f(scale(s.values[i]) + 3.5)}" class="ct">${esc(fmt(s.values[i], spec.unit ?? ''))}</text>`)
  })
  return out.join('')
}

function donutChart(spec, tokens, W, H) {
  const { labels, series } = normalize(spec)
  const values = series[0].values
  const total = values.reduce((a, b) => a + b, 0) || 1
  const R = Math.min(H / 2 - 6, W * 0.22)
  const r = R * 0.62
  const cx = R + 12
  const cy = H / 2
  let angle = -Math.PI / 2
  const out = []
  const palette = tokens.chart
  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2
    const end = angle + sweep - 0.012
    const large = sweep > Math.PI ? 1 : 0
    const p = (a, rad) => `${f(cx + rad * Math.cos(a))} ${f(cy + rad * Math.sin(a))}`
    out.push(`<path d="M${p(angle, R)}A${f(R)} ${f(R)} 0 ${large} 1 ${p(end, R)}L${p(end, r)}A${f(r)} ${f(r)} 0 ${large} 0 ${p(angle, r)}Z" fill="${palette[i % palette.length]}"/>`)
    const ly = cy - (values.length * 21) / 2 + i * 21 + 13
    const lx = cx + R + 28
    out.push(`<rect x="${f(lx)}" y="${f(ly - 9)}" width="10" height="10" rx="2" fill="${palette[i % palette.length]}"/>`)
    out.push(`<text x="${f(lx + 16)}" y="${f(ly)}" class="ct">${esc(labels[i])}</text>`)
    out.push(`<text x="${f(W - 4)}" y="${f(ly)}" class="ct nm" text-anchor="end">${esc(`${+((v / total) * 100).toFixed(1)}%`)}</text>`)
    angle += sweep
  })
  if (spec.center) out.push(`<text x="${f(cx)}" y="${f(cy + 5)}" class="ct big" text-anchor="middle">${esc(spec.center)}</text>`)
  return out.join('')
}

function scatterChart(spec, tokens, W, H) {
  const groups = spec.series ?? [{ name: spec.name ?? '', points: spec.points }]
  for (const g of groups) {
    if (!Array.isArray(g.points)) throw new Error('scatter chart needs "points" [[x, y], …] or "series" [{name, points}]')
  }
  const xs = groups.flatMap(g => g.points.map(p => p[0]))
  const ys = groups.flatMap(g => g.points.map(p => p[1]))
  const X = niceTicks(Math.min(...xs), Math.max(...xs))
  const Y = niceTicks(Math.min(...ys), Math.max(...ys))
  const legendH = groups.length > 1 ? 24 : 0
  const frame = { l: 46, r: W - 10, t: 10 + legendH, b: H - 30 }
  const sx = v => frame.l + ((v - X.lo) / (X.hi - X.lo)) * (frame.r - frame.l)
  const sy = v => frame.b - ((v - Y.lo) / (Y.hi - Y.lo)) * (frame.b - frame.t)
  const out = [legend(groups, tokens.chart, frame.l, 12, W - frame.l), yAxis(frame, sy, Y.ticks, spec.unit ?? '', tokens)]
  X.ticks.forEach(t => out.push(`<text x="${f(sx(t))}" y="${f(frame.b + 15)}" class="ct mu" text-anchor="middle">${esc(fmt(t))}</text>`))
  groups.forEach((g, k) => g.points.forEach(p => {
    out.push(`<circle cx="${f(sx(p[0]))}" cy="${f(sy(p[1]))}" r="2.8" fill="${tokens.chart[k % tokens.chart.length]}" opacity=".78"/>`)
  }))
  if (spec.x_label) out.push(`<text x="${f(frame.r)}" y="${f(H - 2)}" class="ct mu" text-anchor="end">${esc(spec.x_label)}</text>`)
  if (spec.y_label) out.push(`<text x="${frame.l}" y="${f(frame.t - 2 + legendH * 0)}" class="ct mu">${esc(spec.y_label)}</text>`)
  return out.join('')
}

/**
 * Render a chart spec to inline SVG.
 * @param spec - { type: bar|stacked|hbar|line|area|donut|scatter, x, series, data, unit, highlight, height }
 * @param tokens - the theme palette.
 */
export function renderChart(spec, tokens) {
  if (typeof spec !== 'object' || spec === null) throw new Error('chart spec must be a JSON object')
  const type = spec.type ?? 'bar'
  const W = 520
  let H = Math.min(420, Math.max(120, spec.height ?? (type === 'donut' ? 190 : 250)))
  let markup
  if (type === 'bar' || type === 'stacked') markup = barChart(spec, tokens, W, H)
  else if (type === 'hbar') ({ markup, H } = hbarChart(spec, tokens, W))
  else if (type === 'line' || type === 'area') markup = lineChart(spec, tokens, W, H)
  else if (type === 'donut' || type === 'pie') markup = donutChart(spec, tokens, W, H)
  else if (type === 'scatter') markup = scatterChart(spec, tokens, W, H)
  else throw new Error(`unknown chart type "${type}"; use bar, stacked, hbar, line, area, donut or scatter`)
  return `<svg class="chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">${markup}</svg>`
}
