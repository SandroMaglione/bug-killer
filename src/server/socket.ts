/**
 * The rooms over WebSockets, on any Node HTTP server: Vite's dev server
 * (see `vite.config.ts`) or the production one (`main.ts`).
 */
import type { Server } from "node:http"

import { WebSocketServer } from "ws"
import type { WebSocket } from "ws"

import { SOCKET_PATH } from "../net/protocol.ts"
import type { ServerMessage } from "../net/protocol.ts"
import { makeRooms } from "./rooms.ts"
import type { Peer } from "./rooms.ts"

const TICK_MS = 1000 / 60
const HEARTBEAT_MS = 15000

export const attachRuns = (http: Server) => {
  const rooms = makeRooms()
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 })
  const alive = new WeakMap<WebSocket, boolean>()

  http.on("upgrade", (request, socket, head) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname
    // Other upgrades (Vite's hot reload) are not ours.
    if (path !== SOCKET_PATH) return
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request))
  })

  sockets.on("connection", (ws: WebSocket) => {
    const peer: Peer = {
      send: (message: ServerMessage) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
      }
    }
    alive.set(ws, true)
    ws.on("pong", () => alive.set(ws, true))
    ws.on("message", (data, binary) => {
      if (!binary) rooms.receive(peer, data.toString())
    })
    ws.on("close", () => rooms.leave(peer))
    ws.on("error", () => ws.terminate())
  })

  let last = performance.now()
  const ticker = setInterval(() => {
    const now = performance.now()
    rooms.advance((now - last) / 1000)
    last = now
  }, TICK_MS)

  // A phone that went to sleep never says goodbye: drop connections that stop answering.
  const heartbeat = setInterval(() => {
    for (const ws of sockets.clients) {
      if (alive.get(ws) === false) {
        ws.terminate()
        continue
      }
      alive.set(ws, false)
      ws.ping()
    }
  }, HEARTBEAT_MS)

  http.on("close", () => {
    clearInterval(ticker)
    clearInterval(heartbeat)
    sockets.close()
  })
  return rooms
}
