// Renders the sample documents in test/fixtures to samples/, one PDF per fixture.
import fs from 'node:fs'
import path from 'node:path'
import { composePdf, formatReport } from '../lib/compose.js'

const root = path.resolve(import.meta.dirname, '..')
const only = process.argv.slice(2)
const fixtures = path.join(root, 'test', 'fixtures')
for (const file of fs.readdirSync(fixtures).filter(f => f.endsWith('.json'))) {
  const name = path.basename(file, '.json')
  if (only.length > 0 && !only.includes(name)) continue
  const args = JSON.parse(fs.readFileSync(path.join(fixtures, file), 'utf8'))
  if (args.body_path) args.body_path = path.join('test', 'fixtures', args.body_path)
  const started = Date.now()
  const report = await composePdf({ path: `samples/${name}.pdf`, ...args }, { root })
  console.log(formatReport(report))
  console.log(`${name}: ${((Date.now() - started) / 1000).toFixed(1)} s\n`)
}
