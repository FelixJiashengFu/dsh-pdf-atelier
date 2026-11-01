// Copies only the font files the themes use out of the dev dependencies and
// writes assets/fonts/fonts.css, so an install does not pull every weight.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'assets', 'fonts')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

const SOURCES = [
  ['@fontsource-variable/noto-serif-sc', ['wght.css']],
  ['@fontsource-variable/noto-sans-sc', ['wght.css']],
  ['@fontsource-variable/fraunces', ['wght.css', 'wght-italic.css']],
  ['@fontsource-variable/source-serif-4', ['wght.css', 'wght-italic.css']],
  ['@fontsource-variable/inter', ['wght.css']],
  ['@fontsource-variable/jetbrains-mono', ['wght.css']],
  ['@fontsource-variable/playfair-display', ['wght.css', 'wght-italic.css']],
  ['lxgw-wenkai-webfont', ['lxgwwenkai-regular.css']],
]

let css = ''
let bytes = 0
for (const [pkg, sheets] of SOURCES) {
  const dir = path.join(root, 'node_modules', pkg)
  const slug = pkg.split('/').pop()
  fs.mkdirSync(path.join(out, slug), { recursive: true })
  for (const license of ['LICENSE', 'OFL.txt']) {
    if (fs.existsSync(path.join(dir, license))) fs.copyFileSync(path.join(dir, license), path.join(out, slug, license))
  }
  for (const sheet of sheets) {
    let text = fs.readFileSync(path.join(dir, sheet), 'utf8')
    // Keep latin + cyrillic-free faces only for the western fonts.
    text = text.replace(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}/g, block =>
      /cyrillic|greek|vietnamese/.test(block) && !pkg.includes('sc') ? '' : block)
    text = text.replace(/,?\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '')
    text = text.replace(/url\(([^)]+?\.woff2)\)/g, (_, ref) => {
      const clean = ref.replace(/^['"]|['"]$/g, '')
      const name = path.basename(clean)
      const src = path.join(dir, clean)
      fs.copyFileSync(src, path.join(out, slug, name))
      bytes += fs.statSync(src).size
      return `url(${slug}/${name})`
    })
    css += text + '\n'
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), css)
console.log(`fonts.css ${(css.length / 1024).toFixed(0)} KB, font files ${(bytes / 1e6).toFixed(1)} MB`)
console.log([...new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map(m => m[1]))])

// Chinese text wants full-width quotes and dashes from the CJK face, but the Latin
// face comes first in every stack. These aliases put just those characters first.
const PUNCT = [0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026]
const inRange = (range, cp) => range.split(',').some(part => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-')
  const lo = parseInt(a, 16)
  return cp >= lo && cp <= (b ? parseInt(b, 16) : lo)
})
let aliases = ''
for (const [family, alias] of [['Noto Serif SC Variable', 'Atelier Punct Serif'], ['Noto Sans SC Variable', 'Atelier Punct Sans']]) {
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]).filter(b => b.includes(`'${family}'`))
  for (const cp of PUNCT) {
    const face = faces.find(b => inRange(/unicode-range:\s*([^;]+);/.exec(b)?.[1] ?? '', cp))
    if (!face) { console.log('no face for', family, cp.toString(16)); continue }
    const src = /src:\s*([^;]+);/.exec(face)[1]
    const weight = /font-weight:\s*([^;]+);/.exec(face)[1]
    aliases += `@font-face{font-family:'${alias}';font-style:normal;font-weight:${weight};src:${src};unicode-range:U+${cp.toString(16).toUpperCase()}}\n`
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), aliases + css)
console.log('punctuation aliases:', aliases.split('\n').length - 1)
