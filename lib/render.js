// Drives a local headless Chrome or Edge over the DevTools protocol. Chrome is the
// only engine here that does CJK autospace, named pages, margin boxes and PDF
// outlines, and it is already on nearly every machine.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CANDIDATES = {
  win32: [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium', '/usr/bin/microsoft-edge',
  ],
}

export function findBrowser(explicit) {
  const list = [explicit, process.env.DSH_ATELIER_CHROME, ...(CANDIDATES[process.platform] ?? CANDIDATES.linux)]
  const found = list.find(p => p && fs.existsSync(p))
  if (!found) {
    throw new Error('no Chrome, Edge or Chromium was found. Install one, or set the plugin config "chromePath" or the DSH_ATELIER_CHROME environment variable')
  }
  return found
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.seq = 0
    this.pending = new Map()
    this.listeners = new Set()
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined) {
        const waiter = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) waiter?.reject(new Error(`${waiter.method}: ${msg.error.message}`))
        else waiter?.resolve(msg.result)
      } else {
        for (const listener of this.listeners) listener(msg)
      }
    })
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method })
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  once(method, sessionId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(handler)
        reject(new Error(`timed out waiting for ${method}`))
      }, timeoutMs)
      const handler = msg => {
        if (msg.method === method && msg.sessionId === sessionId) {
          clearTimeout(timer)
          this.listeners.delete(handler)
          resolve(msg.params)
        }
      }
      this.listeners.add(handler)
    })
  }
}

/** One headless browser, reused for all the passes of a document. */
export class PdfEngine {
  static async start({ chromePath, signal } = {}) {
    const executable = findBrowser(chromePath)
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-chrome-'))
    const child = spawn(executable, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-component-update',
      '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore', windowsHide: true })
    const engine = new PdfEngine()
    engine.child = child
    engine.profile = profile
    engine.executable = executable
    const abort = () => engine.close()
    signal?.addEventListener('abort', abort, { once: true })
    engine.removeAbort = () => signal?.removeEventListener('abort', abort)
    try {
      const portFile = path.join(profile, 'DevToolsActivePort')
      let content = ''
      for (let i = 0; i < 300 && content.split('\n').length < 2; i += 1) {
        if (child.exitCode !== null) throw new Error(`browser exited early with code ${child.exitCode}`)
        await delay(100)
        if (fs.existsSync(portFile)) content = fs.readFileSync(portFile, 'utf8')
      }
      const [port, wsPath] = content.trim().split('\n')
      if (!port || !wsPath) throw new Error('browser did not open a debugging port within 30 s')
      const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`)
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true })
        ws.addEventListener('error', () => reject(new Error('could not connect to the browser')), { once: true })
      })
      engine.ws = ws
      engine.cdp = new Cdp(ws)
      return engine
    } catch (error) {
      await engine.close()
      throw error
    }
  }

  /** Print one HTML file to PDF bytes, after fonts and images have settled. */
  async print(htmlPath, { timeoutMs = 120000 } = {}) {
    const { cdp } = this
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    try {
      await cdp.send('Page.enable', {}, sessionId)
      await cdp.send('Runtime.enable', {}, sessionId)
      await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId)
      const loaded = cdp.once('Page.loadEventFired', sessionId, timeoutMs)
      await cdp.send('Page.navigate', { url: pathToFileURL(htmlPath).href }, sessionId)
      await loaded
      const settled = await cdp.send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async()=>{
          await document.fonts.ready;
          await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));
          await document.fonts.ready;
          const content=document.querySelector('.sheet');
          const limit=content?content.getBoundingClientRect().right-parseFloat(getComputedStyle(content).paddingRight)+2:innerWidth;
          const overflow=[...document.querySelectorAll('.sheet pre,.sheet table,.sheet svg.m,.sheet img')]
            .filter(e=>!e.closest('.size-wide,.size-full,.toc-art,.opener-band,.masthead,.backcover,.part,.opener-numeral')&&e.getBoundingClientRect().right>limit+1)
            .map(e=>(e.textContent||e.getAttribute('aria-label')||e.tagName).trim().slice(0,60));
          return {missing:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),overflow};
        })()`,
      }, sessionId)
      const info = settled.result?.value ?? {}
      const printed = await cdp.send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        generateDocumentOutline: true,
        generateTaggedPDF: true,
        displayHeaderFooter: false,
      }, sessionId)
      return { bytes: Buffer.from(printed.data, 'base64'), missing: info.missing ?? [], overflow: info.overflow ?? [] }
    } finally {
      await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
    }
  }

  async close() {
    this.removeAbort?.()
    try { this.ws?.close() } catch { /* already gone */ }
    if (this.child && this.child.exitCode === null) {
      this.child.kill()
      await Promise.race([new Promise(resolve => this.child.once('exit', resolve)), delay(3000)])
    }
    for (let i = 0; i < 6; i += 1) {
      try {
        fs.rmSync(this.profile, { recursive: true, force: true })
        return
      } catch {
        await delay(300)
      }
    }
  }
}
