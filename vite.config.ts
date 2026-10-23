import { defineConfig } from "vite"
import type { Plugin } from "vite"

import { attachRuns } from "./src/server/socket.ts"

// The public tunnel to this machine; Vite rejects unknown Host headers otherwise.
const allowedHosts = ["bug-killer.giovannilondero.dev"]

/** The multiplayer runs, served by the dev and preview servers themselves. */
const runs = (): Plugin => ({
  name: "bug-killer-runs",
  configureServer: (server) => {
    if (server.httpServer) attachRuns(server.httpServer as import("node:http").Server)
  },
  configurePreviewServer: (server) => {
    attachRuns(server.httpServer as import("node:http").Server)
  }
})

export default defineConfig({
  plugins: [runs()],
  server: { port: 5199, allowedHosts },
  preview: { allowedHosts }
})
