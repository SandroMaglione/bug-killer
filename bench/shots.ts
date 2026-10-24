// Screenshots every saved scene with each renderer and reports how many pixels differ.
// `pnpm dev` first, then `node bench/shots.ts <out-dir> [canvas,pixi] [reference-dir]`.
import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { chromium } from "playwright-core"

const out = process.argv[2] ?? "/tmp/bug-killer-shots"
const renderers = (process.argv[3] ?? "canvas,pixi").split(",")
const reference = process.argv[4]
const base = process.env.BENCH_URL ?? "http://127.0.0.1:5199/bench/"
const scenes = Object.keys(JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) as object)
const sizes = [{ name: "desktop", width: 1280, height: 720, dpr: 2 }, { name: "phone", width: 844, height: 390, dpr: 3 }]

mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const differ = await (await browser.newContext()).newPage()

/** Share of pixels whose channels differ by more than 48 out of 255, compared in the browser. */
const diff = async (a: string, b: string) =>
  differ.evaluate(async ([a, b]) => {
    const load = async (b64: string) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const [x, y] = await Promise.all([load(a), load(b)])
    const read = (img: ImageBitmap) => {
      const c = new OffscreenCanvas(img.width, img.height)
      const g = c.getContext("2d")!
      g.drawImage(img, 0, 0)
      return g.getImageData(0, 0, img.width, img.height).data
    }
    const p = read(x)
    const q = read(y)
    let off = 0
    for (let i = 0; i < p.length; i += 4) {
      if (Math.abs(p[i]! - q[i]!) > 48 || Math.abs(p[i + 1]! - q[i + 1]!) > 48 || Math.abs(p[i + 2]! - q[i + 2]!) > 48) off++
    }
    return off / (p.length / 4)
  }, [a, b] as const)

const rows: Array<Record<string, unknown>> = []
for (const size of sizes) {
  for (const scene of scenes) {
    const shots: Record<string, Buffer> = {}
    for (const renderer of renderers) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr })
      const page = await context.newPage()
      page.on("pageerror", (e) => console.error(scene, renderer, e.message))
      await page.goto(`${base}?renderer=${renderer}&scene=${scene}`)
      await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready, null, { timeout: 30_000 })
      shots[renderer] = await page.screenshot({ path: join(out, `${size.name}-${scene}-${renderer}.png`) })
      await context.close()
    }
    const row: Record<string, unknown> = { size: size.name, scene }
    if (shots.canvas && shots.pixi) row["pixi vs canvas"] = `${((await diff(shots.canvas.toString("base64"), shots.pixi.toString("base64"))) * 100).toFixed(2)}%`
    if (reference) {
      for (const renderer of renderers) {
        const before = readFileSync(join(reference, `${size.name}-${scene}-${renderer}.png`))
        row[`${renderer} vs reference`] = `${((await diff(before.toString("base64"), shots[renderer]!.toString("base64"))) * 100).toFixed(2)}%`
      }
    }
    rows.push(row)
  }
}
await browser.close()
console.table(rows)
