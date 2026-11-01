// Small colour toolkit: OKLCH conversions, mixing and WCAG contrast, so a theme
// override can never produce unreadable text.

const clamp01 = x => Math.min(1, Math.max(0, x))
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) throw new Error(`"${hex}" is not a hex colour such as "#2f6f6a"`)
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
}

export function isHex(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

const toHex = rgb => '#' + rgb.map(c => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')).join('')

function hexToOklab(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return toHex([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(c => toGamma(clamp01(c))))
}

/** Perceptual mix: t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const A = hexToOklab(a)
  const B = hexToOklab(b)
  return oklabToHex(A.map((v, i) => v + (B[i] - v) * t))
}

export function lightness(hex) {
  return hexToOklab(hex)[0]
}

/** Rotate hue by `deg` degrees, keeping lightness and chroma. */
export function rotateHue(hex, deg) {
  const [L, a, b] = hexToOklab(hex)
  const r = (deg * Math.PI) / 180
  return oklabToHex([L, a * Math.cos(r) - b * Math.sin(r), a * Math.sin(r) + b * Math.cos(r)])
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Move `fg` in lightness, away from `bg`, until it reaches `min` contrast. */
export function ensureContrast(fg, bg, min) {
  if (contrast(fg, bg) >= min) return fg
  const [L, a, b] = hexToOklab(fg)
  const dir = lightness(bg) > 0.55 ? -1 : 1
  for (let step = 1; step <= 40; step += 1) {
    const candidate = oklabToHex([clamp01(L + dir * step * 0.02), a, b])
    if (contrast(candidate, bg) >= min) return candidate
  }
  return dir < 0 ? '#111111' : '#f5f5f5'
}

/** The readable ink to put on a filled colour. */
export function inkOn(bg, dark = '#17171a', light = '#fbf8f1') {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark
}
