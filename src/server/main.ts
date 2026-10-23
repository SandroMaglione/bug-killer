/**
 * The production server: the built game from `dist/` and the runs, on one
 * port. `pnpm build && pnpm serve`; `PORT` picks the port (default 8080).
 */
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

import { attachRuns } from "./socket.ts"

const root = resolve(import.meta.dirname, "../../dist")
const port = Number(process.env.PORT ?? 8080)

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
}

const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname))
  let file = join(root, path)
  // Nothing outside dist/, and every unknown path is the game.
  if (!file.startsWith(root)) file = join(root, "index.html")
  const found = await stat(file).catch(() => null)
  if (!found || found.isDirectory()) file = join(root, "index.html")
  response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream")
  if (file.includes(`${join(root, "assets")}`)) response.setHeader("Cache-Control", "public, max-age=31536000, immutable")
  createReadStream(file).on("error", () => response.writeHead(404).end()).pipe(response)
})

attachRuns(server)
server.listen(port, () => console.log(`Bug Killer on http://localhost:${port}`))
