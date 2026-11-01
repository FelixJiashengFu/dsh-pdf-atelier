// Generative vector art. Each motif is drawn from a seed, so a document gets its
// own cover that nobody else has, and the same document always gets the same one.
// Everything is flat SVG (no filters) so Chrome keeps it vector in the PDF.

export function makeRng(seed) {
  let s = seed >>> 0 || 1
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.range = (a, b) => a + next() * (b - a)
  next.int = (a, b) => Math.floor(next.range(a, b + 1))
  next.pick = list => list[Math.floor(next() * list.length)]
  return next
}

const f = n => (Math.round(n * 100) / 100).toString()

function smoothClosed(points) {
  const n = points.length
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

function smoothOpen(points) {
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

const DRAW = {
  hexlattice(rng, W, H, c) {
    const R = Math.max(W, H) / rng.range(11, 14)
    const dx = Math.sqrt(3) * R
    const dy = 1.5 * R
    const out = []
    const cx0 = W * rng.range(0.55, 0.8)
    const cy0 = H * rng.range(0.25, 0.55)
    const reach = Math.max(W, H) * 0.62
    for (let row = -1; row * dy < H + R; row += 1) {
      for (let col = -1; col * dx < W + dx; col += 1) {
        const x = col * dx + (row % 2 ? dx / 2 : 0)
        const y = row * dy
        const dist = Math.hypot(x - cx0, y - cy0)
        const keep = 1 - dist / reach
        if (keep <= 0 || rng() > keep + 0.25) continue
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6
          return [x + R * Math.cos(a), y + R * Math.sin(a)]
        })
        const op = f(0.25 + keep * 0.75)
        const roll = rng()
        if (roll < 0.1) out.push(`<path d="M${pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}Z" fill="${c.fg2}" opacity="${f(0.72 * +op + 0.15)}"/>`)
        else if (roll < 0.17) out.push(`<path d="M${pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}Z" fill="${c.fg3}" opacity="${f(0.5 * +op)}"/>`)
        out.push(`<path d="M${pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}Z" fill="none" stroke="${c.fg}" stroke-width="${f(R * 0.035)}" opacity="${op}" stroke-linejoin="round"/>`)
        if (rng() < 0.38) {
          for (let i = 0; i < 6; i += 2) {
            const a = pts[i]
            const b = pts[(i + 1) % 6]
            const k = 0.8
            const ax = x + (a[0] - x) * k
            const ay = y + (a[1] - y) * k
            const bx = x + (b[0] - x) * k
            const by = y + (b[1] - y) * k
            out.push(`<line x1="${f(ax + (bx - ax) * 0.12)}" y1="${f(ay + (by - ay) * 0.12)}" x2="${f(bx - (bx - ax) * 0.12)}" y2="${f(by - (by - ay) * 0.12)}" stroke="${c.fg}" stroke-width="${f(R * 0.03)}" opacity="${op}"/>`)
          }
        }
        if (rng() < 0.24) {
          const p = rng.pick(pts)
          out.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(R * 0.14)}" fill="${rng() < 0.5 ? c.fg2 : c.fg}" opacity="${op}"/>`)
        }
      }
    }
    return out.join('')
  },

  construction(rng, W, H, c) {
    const out = []
    const unit = Math.min(W, H) * rng.range(0.28, 0.36)
    const ax = W * rng.range(0.34, 0.46)
    const ay = H * rng.range(0.42, 0.56)
    const bx = ax + unit
    const by = ay
    const px = ax + unit / 2
    const py = ay - (Math.sqrt(3) / 2) * unit
    const stroke = `stroke="${c.fg}" stroke-width="${f(unit * 0.008)}" fill="none"`
    out.push(`<circle cx="${f(ax)}" cy="${f(ay)}" r="${f(unit)}" ${stroke}/>`)
    out.push(`<circle cx="${f(bx)}" cy="${f(by)}" r="${f(unit)}" ${stroke}/>`)
    out.push(`<path d="M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}L${f(px)} ${f(py)}Z" fill="${c.fg2}"/>`)
    const qx = ax + unit / 2
    const qy = ay + (Math.sqrt(3) / 2) * unit
    out.push(`<path d="M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}L${f(qx)} ${f(qy)}Z" fill="${c.fg3}"/>`)
    const r2 = unit * 0.5
    out.push(`<path d="M${f(bx)} ${f(by)}m${f(r2)} 0A${f(r2)} ${f(r2)} 0 0 1 ${f(bx - r2 * 0.5)} ${f(by + r2 * 0.866)}L${f(bx)} ${f(by)}Z" fill="${c.fg4}"/>`)
    out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="${f(unit * 0.5)}" ${stroke}/>`)
    out.push(`<line x1="${f(ax - unit * 1.4)}" y1="${f(ay)}" x2="${f(bx + unit * 1.4)}" y2="${f(by)}" ${stroke}/>`)
    out.push(`<line x1="${f(px)}" y1="${f(py - unit * 0.9)}" x2="${f(qx)}" y2="${f(qy + unit * 0.9)}" ${stroke} stroke-dasharray="${f(unit * 0.03)} ${f(unit * 0.03)}"/>`)
    for (const [x, y] of [[ax, ay], [bx, by], [px, py], [qx, qy]]) {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(unit * 0.018)}" fill="${c.fg}"/>`)
    }
    const arcs = rng.int(3, 5)
    for (let i = 0; i < arcs; i += 1) {
      const r = unit * rng.range(1.25, 2.1)
      out.push(`<circle cx="${f(rng.pick([ax, bx, px]))}" cy="${f(rng.pick([ay, py]))}" r="${f(r)}" ${stroke} opacity=".45"/>`)
    }
    return out.join('')
  },

  orbits(rng, W, H, c) {
    const out = []
    const stars = Math.round((W * H) / 170)
    for (let i = 0; i < stars; i += 1) {
      const big = rng() < 0.08
      out.push(`<circle cx="${f(rng.range(0, W))}" cy="${f(rng.range(0, H))}" r="${f(big ? rng.range(0.32, 0.5) : rng.range(0.08, 0.2))}" fill="${big ? c.fg2 : c.fg}" opacity="${f(rng.range(0.3, 0.95))}"/>`)
    }
    const cx = W * rng.range(0.62, 0.8)
    const cy = H * rng.range(0.24, 0.42)
    const R = Math.min(W, H) * rng.range(0.1, 0.15)
    const tilt = rng.range(-28, -10)
    const rings = rng.int(5, 7)
    for (let i = 0; i < rings; i += 1) {
      const rx = R * (1.7 + i * 0.85)
      const ry = rx * 0.34
      out.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(tilt)} ${f(cx)} ${f(cy)})" fill="none" stroke="${c.fg}" stroke-width="${f(0.1 + (rings - i) * 0.03)}" opacity="${f(0.75 - i * 0.08)}"/>`)
      const a = rng.range(0, Math.PI * 2)
      const t = (tilt * Math.PI) / 180
      const ex = rx * Math.cos(a)
      const ey = ry * Math.sin(a)
      const size = rng.range(0.5, 1.5)
      out.push(`<circle cx="${f(cx + ex * Math.cos(t) - ey * Math.sin(t))}" cy="${f(cy + ex * Math.sin(t) + ey * Math.cos(t))}" r="${f(size)}" fill="${i % 2 ? c.fg2 : c.fg3}"/>`)
    }
    out.unshift(`<defs><radialGradient id="planet" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${c.fg2}"/><stop offset=".55" stop-color="${c.fg4}"/><stop offset="1" stop-color="${c.bg}"/></radialGradient></defs>`)
    out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="url(#planet)"/>`)
    return out.join('')
  },

  contour(rng, W, H, c) {
    const out = []
    const peaks = rng.int(2, 3)
    for (let k = 0; k < peaks; k += 1) {
      const cx = W * rng.range(0.15, 0.95)
      const cy = H * rng.range(0.1, 0.9)
      const phases = Array.from({ length: 5 }, () => rng.range(0, Math.PI * 2))
      const amps = [0.2, 0.13, 0.08, 0.05, 0.03].map(a => a * rng.range(0.7, 1.3))
      const levels = rng.int(9, 15)
      const step = Math.max(W, H) * rng.range(0.04, 0.06)
      for (let l = 1; l <= levels; l += 1) {
        const pts = []
        for (let i = 0; i < 44; i += 1) {
          const a = (i / 44) * Math.PI * 2
          let wob = 1
          amps.forEach((amp, j) => { wob += amp * Math.sin(a * (j + 2) + phases[j] + l * 0.09) })
          const r = l * step * wob
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.82])
        }
        const accent = l % 5 === 0
        out.push(`<path d="${smoothClosed(pts)}" fill="none" stroke="${accent ? c.fg2 : c.fg}" stroke-width="${accent ? 0.34 : 0.17}" opacity="${f(accent ? 0.9 : 0.62)}"/>`)
      }
      out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(step * 0.2)}" fill="${c.fg2}"/>`)
    }
    return out.join('')
  },

  mountains(rng, W, H, c) {
    const out = []
    const sunX = W * rng.range(0.58, 0.82)
    const sunY = H * rng.range(0.16, 0.3)
    const sunR = Math.min(W, H) * rng.range(0.07, 0.11)
    const defs = []
    const layers = 6
    for (let l = 0; l < layers; l += 1) {
      defs.push(`<linearGradient id="mt${l}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.fg}" stop-opacity="${f(0.2 + l * 0.14)}"/><stop offset=".92" stop-color="${c.fg}" stop-opacity="0"/></linearGradient>`)
    }
    out.push(`<defs>${defs.join('')}</defs>`)
    out.push(`<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(sunR)}" fill="${c.fg2}"/>`)
    for (let l = 0; l < layers; l += 1) {
      const base = H * (0.38 + l * 0.1)
      const amp = H * (0.13 - l * 0.012)
      const phases = [rng.range(0, 7), rng.range(0, 7), rng.range(0, 7)]
      const freq = [rng.range(1.4, 2.4), rng.range(3.2, 5), rng.range(7, 11)]
      const pts = []
      for (let i = 0; i <= 60; i += 1) {
        const x = (i / 60) * W
        const t = i / 60
        const y = base
          - amp * (0.62 * Math.sin(t * freq[0] * Math.PI + phases[0])
            + 0.28 * Math.sin(t * freq[1] * Math.PI + phases[1])
            + 0.1 * Math.sin(t * freq[2] * Math.PI + phases[2]))
        pts.push([x, y])
      }
      out.push(`<path d="${smoothOpen(pts)}L${f(W)} ${f(H)}L0 ${f(H)}Z" fill="url(#mt${l})"/>`)
    }
    return out.join('')
  },

  waves(rng, W, H, c) {
    const out = []
    const lines = rng.int(26, 36)
    const phases = [rng.range(0, 7), rng.range(0, 7), rng.range(0, 7)]
    const top = H * rng.range(0.2, 0.32)
    for (let l = 0; l < lines; l += 1) {
      const u = l / (lines - 1)
      const base = top + u * (H - top) * 1.02
      const amp = H * (0.055 + 0.05 * Math.sin(u * 3.1))
      const pts = []
      for (let i = 0; i <= 42; i += 1) {
        const t = i / 42
        const y = base + amp * (Math.sin(t * 6.2 + phases[0] + u * 2.4) * 0.6
          + Math.sin(t * 13 + phases[1] - u * 3.1) * 0.25
          + Math.sin(t * 2.4 + phases[2] + u) * 0.5)
        pts.push([t * W, y])
      }
      const band = l % 6 === 2
      if (band) {
        out.push(`<path d="${smoothOpen(pts)}L${f(W)} ${f(H)}L0 ${f(H)}Z" fill="${c.fg2}" opacity=".1"/>`)
      }
      out.push(`<path d="${smoothOpen(pts)}" fill="none" stroke="${band ? c.fg2 : c.fg}" stroke-width="${band ? 0.42 : 0.17}" opacity="${f(0.4 + u * 0.5)}"/>`)
    }
    return out.join('')
  },

  bars(rng, W, H, c) {
    const out = []
    const n = rng.int(20, 28)
    const gap = W / n
    const w = gap * 0.56
    let v = rng.range(0.14, 0.24)
    const line = []
    for (let i = 0; i < n; i += 1) {
      v = Math.min(0.86, Math.max(0.08, v + rng.range(-0.035, 0.06)))
      const h = v * H
      const x = i * gap + (gap - w) / 2
      const hit = i === n - 1 || rng() < 0.1
      out.push(`<rect x="${f(x)}" y="${f(H - h)}" width="${f(w)}" height="${f(h)}" fill="${hit ? c.fg2 : c.fg}" opacity="${hit ? 1 : f(0.14 + (i / n) * 0.36)}"/>`)
      line.push([x + w / 2, H - h - H * 0.06])
    }
    out.push(`<path d="${smoothOpen(line)}" fill="none" stroke="${c.fg2}" stroke-width=".42"/>`)
    const last = line[line.length - 1]
    out.push(`<circle cx="${f(last[0])}" cy="${f(last[1])}" r="1.1" fill="${c.fg2}"/>`)
    for (let t = 1; t <= 4; t += 1) {
      const y = H - (t / 5) * H
      out.push(`<line x1="0" x2="${f(W)}" y1="${f(y)}" y2="${f(y)}" stroke="${c.fg}" stroke-width=".1" stroke-dasharray=".6 1.4" opacity=".55"/>`)
    }
    return out.join('')
  },

  circuit(rng, W, H, c) {
    const out = []
    const g = Math.max(W, H) / rng.range(28, 36)
    for (let x = 0; x <= W; x += g) {
      for (let y = 0; y <= H; y += g) {
        out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(g * 0.022)}" fill="${c.fg}" opacity=".45"/>`)
      }
    }
    const traces = Math.round(Math.max(W, H) / g * 1.05)
    for (let i = 0; i < traces; i += 1) {
      let x = Math.round(rng.range(0.1, 1) * W / g) * g
      let y = Math.round(rng.range(0, 1) * H / g) * g
      const pts = [[x, y]]
      let dir = rng.int(0, 3)
      const steps = rng.int(3, 7)
      for (let s = 0; s < steps; s += 1) {
        const len = rng.int(2, 6) * g
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir]
        x += dx * len
        y += dy * len
        pts.push([x, y])
        dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4
      }
      const hot = rng() < 0.16
      const d = pts.map((p, k) => `${k ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('')
      out.push(`<path d="${d}" fill="none" stroke="${hot ? c.fg2 : c.fg}" stroke-width="${f(g * (hot ? 0.11 : 0.05))}" stroke-linejoin="round" opacity="${hot ? 1 : 0.62}"/>`)
      const end = pts[pts.length - 1]
      out.push(`<circle cx="${f(end[0])}" cy="${f(end[1])}" r="${f(g * 0.2)}" fill="${c.bg}" stroke="${hot ? c.fg2 : c.fg}" stroke-width="${f(g * 0.06)}"/>`)
    }
    const chips = rng.int(2, 4)
    for (let i = 0; i < chips; i += 1) {
      const cw = g * rng.int(4, 7)
      const ch = g * rng.int(3, 5)
      const x = Math.round(rng.range(0.25, 0.8) * W / g) * g
      const y = Math.round(rng.range(0.05, 0.75) * H / g) * g
      out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="${i === 0 ? c.fg2 : c.fg4}" stroke="${c.fg}" stroke-width="${f(g * 0.05)}"/>`)
    }
    return out.join('')
  },

  bauhaus(rng, W, H, c) {
    const out = []
    const cols = rng.int(5, 6)
    const s = W / cols
    const rows = Math.ceil(H / s)
    const fills = [c.fg, c.fg2, c.fg3, c.fg4]
    for (let r = 0; r < rows; r += 1) {
      for (let q = 0; q < cols; q += 1) {
        const x = q * s
        const y = r * s
        const kind = rng.int(0, 6)
        const a = rng.pick(fills)
        let b = rng.pick(fills)
        if (a === b) b = c.bg
        const rot = rng.int(0, 3) * 90
        const t = `rotate(${rot} ${f(x + s / 2)} ${f(y + s / 2)})`
        if (kind === 0) out.push(`<path transform="${t}" d="M${f(x)} ${f(y)}H${f(x + s)}A${f(s)} ${f(s)} 0 0 1 ${f(x)} ${f(y + s)}Z" fill="${a}"/>`)
        else if (kind === 1) out.push(`<circle cx="${f(x + s / 2)}" cy="${f(y + s / 2)}" r="${f(s * 0.42)}" fill="${a}"/>`)
        else if (kind === 2) out.push(`<path transform="${t}" d="M${f(x)} ${f(y + s / 2)}A${f(s / 2)} ${f(s / 2)} 0 0 1 ${f(x + s)} ${f(y + s / 2)}Z" fill="${a}"/>`)
        else if (kind === 3) {
          out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" fill="${a}"/>`)
          out.push(`<circle cx="${f(x + s / 2)}" cy="${f(y + s / 2)}" r="${f(s * 0.24)}" fill="${b}"/>`)
        } else if (kind === 4) {
          for (let i = 0; i < 5; i += 1) out.push(`<rect transform="${t}" x="${f(x)}" y="${f(y + (i * s) / 5)}" width="${f(s)}" height="${f(s / 10)}" fill="${a}"/>`)
        } else if (kind === 5) out.push(`<path transform="${t}" d="M${f(x)} ${f(y)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y + s)}Z" fill="${a}"/>`)
      }
    }
    return out.join('')
  },

  confetti(rng, W, H, c) {
    const out = []
    const fills = [c.fg, c.fg2, c.fg3, c.fg4]
    const blobs = rng.int(2, 3)
    for (let i = 0; i < blobs; i += 1) {
      const cx = W * rng.range(0.1, 0.95)
      const cy = H * rng.range(0.1, 0.9)
      const R = Math.min(W, H) * rng.range(0.16, 0.3)
      const pts = Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2
        const r = R * rng.range(0.78, 1.18)
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
      })
      out.push(`<path d="${smoothClosed(pts)}" fill="${fills[i % 4]}" opacity=".95"/>`)
    }
    const n = Math.round((W * H) / 105)
    const u = Math.min(W, H) / 26
    for (let i = 0; i < n; i += 1) {
      const x = rng.range(0, W)
      const y = rng.range(0, H)
      const s = u * rng.range(0.38, 0.9)
      const fill = rng.pick(fills)
      const rot = rng.range(0, 360)
      const kind = rng.int(0, 4)
      const t = `transform="rotate(${f(rot)} ${f(x)} ${f(y)})"`
      if (kind === 0) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(s / 2)}" fill="${fill}"/>`)
      else if (kind === 1) out.push(`<path ${t} d="M${f(x)} ${f(y - s / 2)}L${f(x + s / 2)} ${f(y + s / 2)}L${f(x - s / 2)} ${f(y + s / 2)}Z" fill="${fill}"/>`)
      else if (kind === 2) out.push(`<rect ${t} x="${f(x - s / 2)}" y="${f(y - s / 5)}" width="${f(s)}" height="${f((s * 2) / 5)}" rx="${f(s / 5)}" fill="${fill}"/>`)
      else if (kind === 3) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(s / 2)}" fill="none" stroke="${fill}" stroke-width="${f(s / 5)}"/>`)
      else out.push(`<path ${t} d="M${f(x - s)} ${f(y)}q${f(s / 2)} ${f(-s)} ${f(s)} 0t${f(s)} 0" fill="none" stroke="${fill}" stroke-width="${f(s / 5)}" stroke-linecap="round"/>`)
    }
    return out.join('')
  },

  ripple(rng, W, H, c) {
    const out = []
    const sources = [[W * rng.range(0.55, 0.85), H * rng.range(0.2, 0.45)], [W * rng.range(0.1, 0.4), H * rng.range(0.55, 0.9)]]
    const step = Math.min(W, H) * rng.range(0.035, 0.05)
    sources.forEach(([x, y], k) => {
      const rings = Math.ceil(Math.hypot(W, H) / step)
      for (let i = 1; i < rings; i += 1) {
        const hot = i % 6 === 0
        out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(i * step)}" fill="none" stroke="${hot ? (k ? c.fg3 : c.fg2) : c.fg}" stroke-width="${f(hot ? 0.3 : 0.14)}" opacity="${f(Math.max(0.1, (hot ? 1 : 0.72) - (i / rings) * 0.7))}"/>`)
      }
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(step * 0.72)}" fill="${k ? c.fg3 : c.fg2}"/>`)
    })
    return out.join('')
  },

  helix(rng, W, H, c) {
    const out = []
    const strands = rng.int(2, 3)
    const horizontal = W > H
    const L = horizontal ? W : H
    const S = horizontal ? H : W
    for (let k = 0; k < strands; k += 1) {
      const offset = S * ((k + 0.5) / strands + rng.range(-0.06, 0.06))
      const amp = (S / strands) * rng.range(0.28, 0.36)
      const period = L / rng.range(2.2, 3.2)
      const phase = rng.range(0, 7)
      const n = Math.round(L / 1.1)
      const a = []
      const b = []
      for (let i = 0; i <= n; i += 1) {
        const t = (i / n) * L
        const v = Math.sin((t / period) * 2 * Math.PI + phase)
        a.push([t, offset + amp * v])
        b.push([t, offset - amp * v])
      }
      const P = p => (horizontal ? p : [p[1], p[0]])
      const every = Math.max(2, Math.round(n / (L / period) / 9))
      for (let i = 0; i <= n; i += every) {
        const [x1, y1] = P(a[i])
        const [x2, y2] = P(b[i])
        out.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${i % (every * 3) === 0 ? c.fg2 : c.fg3}" stroke-width=".62" opacity=".85"/>`)
      }
      out.push(`<path d="${smoothOpen(a.filter((_, i) => i % 6 === 0).map(P))}" fill="none" stroke="${c.fg}" stroke-width="1.05"/>`)
      out.push(`<path d="${smoothOpen(b.filter((_, i) => i % 6 === 0).map(P))}" fill="none" stroke="${c.fg2}" stroke-width="1.05"/>`)
    }
    return out.join('')
  },

  network(rng, W, H, c) {
    const out = []
    const layers = rng.int(5, 7)
    const nodes = []
    for (let l = 0; l < layers; l += 1) {
      const count = rng.int(3, 7)
      const col = []
      for (let i = 0; i < count; i += 1) {
        col.push([W * ((l + 0.5) / layers) + rng.range(-1, 1), H * ((i + 0.5) / count) + rng.range(-1, 1)])
      }
      nodes.push(col)
    }
    const lines = []
    for (let l = 0; l < layers - 1; l += 1) {
      for (const a of nodes[l]) {
        for (const b of nodes[l + 1]) {
          if (rng() > 0.62) continue
          const mx = (a[0] + b[0]) / 2
          lines.push(`<path d="M${f(a[0])} ${f(a[1])}C${f(mx)} ${f(a[1])} ${f(mx)} ${f(b[1])} ${f(b[0])} ${f(b[1])}" fill="none" stroke="${c.fg}" stroke-width=".14" opacity="${f(rng.range(0.2, 0.7))}"/>`)
        }
      }
    }
    out.push(lines.join(''))
    let cur = rng.pick(nodes[0])
    const hot = [cur]
    for (let l = 1; l < layers; l += 1) {
      const next = rng.pick(nodes[l])
      const mx = (cur[0] + next[0]) / 2
      out.push(`<path d="M${f(cur[0])} ${f(cur[1])}C${f(mx)} ${f(cur[1])} ${f(mx)} ${f(next[1])} ${f(next[0])} ${f(next[1])}" fill="none" stroke="${c.fg2}" stroke-width=".6"/>`)
      cur = next
      hot.push(cur)
    }
    const r = Math.min(W, H) * 0.012 + 0.6
    for (const col of nodes) {
      for (const n of col) {
        const on = hot.includes(n)
        out.push(`<circle cx="${f(n[0])}" cy="${f(n[1])}" r="${f(on ? r * 1.5 : r)}" fill="${on ? c.fg2 : c.bg}" stroke="${on ? c.fg2 : c.fg}" stroke-width=".28"/>`)
      }
    }
    return out.join('')
  },
}

/**
 * Draw one motif as a standalone <svg>.
 * @param name - a motif id.
 * @param opts - { seed, width, height, colors: { fg, fg2, fg3, fg4, bg }, slice, className }
 */
export function motifSvg(name, { seed, width, height, colors, className = 'art', slice = true }) {
  const draw = DRAW[name]
  if (!draw) throw new Error(`unknown motif "${name}"; choose one of: ${Object.keys(DRAW).join(', ')}`)
  const inner = draw(makeRng(seed), width, height, colors)
  const unique = `m${(seed >>> 0).toString(36)}x${Math.round(width)}x${Math.round(height)}`
  const scoped = inner.replace(/id="(\w+)"/g, `id="$1${unique}"`).replace(/url\(#(\w+)\)/g, `url(#$1${unique})`)
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}" preserveAspectRatio="xMidYMid ${slice ? 'slice' : 'meet'}" aria-hidden="true">${scoped}</svg>`
}
