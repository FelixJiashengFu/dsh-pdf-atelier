import assert from 'node:assert/strict'
import test from 'node:test'
import { contrast } from '../lib/color.js'
import { MOTIFS, THEMES, buildPalette, recommendTheme } from '../lib/themes.js'
import { motifSvg } from '../lib/motifs.js'
import { renderChart } from '../lib/charts.js'

test('no theme is black on white, and all text meets contrast', () => {
  for (const id of Object.keys(THEMES)) {
    for (const seed of [0, 3, 8, 1234567]) {
      const t = buildPalette(id, {}, seed)
      assert.notEqual(t.paper.toLowerCase(), '#ffffff', id)
      assert.ok(contrast(t.ink, t.paper) >= 10, `${id} ink`)
      assert.ok(contrast(t.ink3, t.paper) >= 4.5, `${id} captions`)
      assert.ok(contrast(t.accentText, t.paper) >= 4.5, `${id} accent text`)
      assert.ok(contrast(t.deepInk, t.deep) >= 4.5, `${id} text on deep`)
      assert.ok(contrast(t.onDeepAccent, t.deep) >= 4, `${id} accent on deep`)
    }
  }
})

test('a bad override is corrected rather than shipped unreadable', () => {
  const t = buildPalette('moss', { accent: '#f7f4e0', ink: '#d9d6c8' }, 1)
  assert.ok(contrast(t.ink, t.paper) >= 10)
  assert.ok(contrast(t.accentText, t.paper) >= 4.5)
  assert.throws(() => buildPalette('moss', { accent: 'red' }), /hex colour/)
  assert.throws(() => buildPalette('nope'), /unknown theme/)
})

test('the subject picks the art direction', () => {
  const cases = [
    ['有机化学反应机理', '', 'reagent'],
    ['Linear Algebra Notes', 'matrix and theorem proofs', 'euclid'],
    ['2025 年度财务报告', '投资 营收', 'ledger'],
    ['唐诗三百首读书札记', '诗 文学', 'xuan'],
    ['黑洞与星系演化', '天文', 'nocturne'],
    ['Kubernetes API design', 'backend software', 'graphite'],
    ['九九乘法表', '给二年级小朋友的趣味启蒙', 'playground'],
    ['CRISPR gene editing', 'biology', 'chlorophyll'],
    ['Transformer 与大模型', '深度学习', 'synapse'],
  ]
  for (const [title, brief, expected] of cases) {
    assert.equal(recommendTheme({ title, brief })[0].theme, expected, title)
  }
})

test('English keys match whole-word starts, and code fences do not vote', () => {
  const body = '```chart\n{"type":"bar"}\n```\n\nThe chart of the party started apart.'
  const art = recommendTheme({ title: 'x', body }).find(r => r.theme === 'terra')
  assert.equal(art.score, 0)
})

test('motifs are deterministic and differ by seed', () => {
  const colors = { fg: '#111111', fg2: '#222222', fg3: '#333333', fg4: '#444444', bg: '#eeeeee' }
  for (const name of MOTIFS) {
    const a = motifSvg(name, { seed: 42, width: 210, height: 160, colors })
    assert.equal(a, motifSvg(name, { seed: 42, width: 210, height: 160, colors }), name)
    assert.notEqual(a, motifSvg(name, { seed: 43, width: 210, height: 160, colors }), name)
    assert.ok(!/NaN|undefined/.test(a), `${name} drew a bad value`)
  }
})

test('every chart type renders and bad data is refused', () => {
  const t = buildPalette('tide', {}, 0)
  const series = [{ name: 'a', values: [1, 2, 3] }, { name: 'b', values: [2, 1, 4] }]
  for (const type of ['bar', 'stacked', 'line', 'area']) {
    const svg = renderChart({ type, x: ['x', 'y', 'z'], series }, t)
    assert.ok(svg.startsWith('<svg') && !/NaN/.test(svg), type)
  }
  assert.ok(!/NaN/.test(renderChart({ type: 'hbar', data: [{ label: 'x', value: 2 }, { label: 'y', value: 0 }] }, t)))
  assert.ok(!/NaN/.test(renderChart({ type: 'donut', x: ['x', 'y'], series: [series[0]] }, t)))
  assert.ok(!/NaN/.test(renderChart({ type: 'scatter', points: [[1, 2], [3, 4]] }, t)))
  assert.throws(() => renderChart({ type: 'bar', series: [{ values: ['a'] }] }, t), /numeric/)
  assert.throws(() => renderChart({ type: 'pie3d', series }, t), /unknown chart type/)
})
