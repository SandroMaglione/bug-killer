// Runs the renderer bench in a real (headed, GPU) Chromium and prints a table.
// `pnpm dev` first, then `node bench/run.ts [canvas,pixi] [60,150,300]`.
// CHROMIUM_PATH picks the browser; CPU throttling 4x stands in for a mid-range phone.
import { chromium } from "playwright-core"

const renderers = (process.argv[2] ?? "canvas,pixi").split(",")
const counts = (process.argv[3] ?? "60,150,300").split(",").map(Number)
const base = process.env.BENCH_URL ?? "http://127.0.0.1:5199/bench/"

const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const rows: Array<Record<string, unknown>> = []
for (const throttle of [1, 4]) {
  for (const count of counts) {
    for (const renderer of renderers) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle })
      page.on("pageerror", (e) => console.error(renderer, e.message))
      await page.goto(`${base}?renderer=${renderer}&bugs=${count}&frames=480`)
      const result = await page.waitForFunction(() => (window as unknown as { __bench?: unknown }).__bench, null, { timeout: 120_000 })
      const r = (await result.jsonValue()) as { draw: { median: number; p95: number }; fps: number }
      rows.push({ cpu: `${throttle}x`, bugs: count, renderer, "draw ms (median)": r.draw.median, "draw ms (p95)": r.draw.p95, fps: r.fps })
      await context.close()
    }
  }
}
await browser.close()
console.table(rows)
