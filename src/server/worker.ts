/**
 * The production deploy on Cloudflare: the built game is static assets
 * (`wrangler.jsonc`), and the runs live in one Durable Object, the same
 * rooms `socket.ts` serves on Node. Only `/runs` reaches this Worker.
 */
import { DurableObject } from "cloudflare:workers"

import { MESSAGE_MAX, SOCKET_PATH } from "../net/protocol.ts"
import type { ServerMessage } from "../net/protocol.ts"
import { PARTY } from "../sim/constants.ts"
import { MAX_ROOMS, makeRooms } from "./rooms.ts"
import type { Peer } from "./rooms.ts"

const TICK_MS = 1000 / 60
/** Every run full, and some more for whoever is on the lobby form or about to be told the server is busy. */
const MAX_CONNECTIONS = MAX_ROOMS * PARTY.maxPlayers + 10
/** Two teams behind one office's address fit; one script opening sockets does not get far. */
const MAX_CONNECTIONS_PER_ADDRESS = 8
/** A few missed keepalives (`KEEPALIVE_MS`), and over a minute: Chrome wakes a tab hidden for a while only once a minute. */
const SILENT_MS = 90000

interface Env {
  readonly RUNS: DurableObjectNamespace<Runs>
}

interface Connection {
  readonly peer: Peer
  /** When this browser last said anything, input or keepalive. */
  seen: number
}

/**
 * Every run in one object: like the Node server, one process that knows all
 * the codes. It stays in memory while anyone is connected or a run is still
 * waiting for its developers, and nothing is stored: a deploy ends the runs.
 */
export class Runs extends DurableObject<Env> {
  private readonly rooms = makeRooms()
  private readonly sockets = new Map<WebSocket, Connection>()
  private ticker: ReturnType<typeof setInterval> | null = null

  override fetch(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 })
    const { 0: client, 1: socket } = new WebSocketPair()
    socket.accept()
    const address = request.headers.get("CF-Connecting-IP")
    if (this.sockets.size >= MAX_CONNECTIONS || (address !== null && this.connectionsFrom(address) >= MAX_CONNECTIONS_PER_ADDRESS)) {
      // Accepted only to say why: a refused upgrade reaches the browser as a bare failure.
      socket.send(JSON.stringify({ t: "error", code: "busy" } satisfies ServerMessage))
      socket.close(1013, "busy")
      return new Response(null, { status: 101, webSocket: client })
    }
    const connection: Connection = {
      peer: {
        send: (message: ServerMessage) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
        },
        ...(address === null ? {} : { address })
      },
      seen: performance.now()
    }
    this.sockets.set(socket, connection)
    socket.addEventListener("message", (event) => {
      connection.seen = performance.now()
      if (typeof event.data === "string" && event.data.length <= MESSAGE_MAX) this.rooms.receive(connection.peer, event.data)
    })
    socket.addEventListener("close", () => this.drop(socket))
    socket.addEventListener("error", () => this.drop(socket))
    this.start()
    return new Response(null, { status: 101, webSocket: client })
  }

  private connectionsFrom(address: string) {
    let count = 0
    for (const connection of this.sockets.values()) if (connection.peer.address === address) count += 1
    return count
  }

  private drop(socket: WebSocket) {
    const connection = this.sockets.get(socket)
    if (!connection) return
    this.sockets.delete(socket)
    this.rooms.leave(connection.peer)
  }

  /** Steps the rooms at 60 Hz until nobody is connected and no run is left. */
  private start() {
    if (this.ticker !== null) return
    let last = performance.now()
    this.ticker = setInterval(() => {
      const now = performance.now()
      this.rooms.advance((now - last) / 1000)
      last = now
      // A phone that went to sleep never says goodbye: it just stops talking.
      for (const [socket, connection] of this.sockets) {
        if (now - connection.seen <= SILENT_MS) continue
        this.drop(socket)
        socket.close(1001, "silent")
      }
      if (this.sockets.size === 0 && this.rooms.count() === 0 && this.ticker !== null) {
        clearInterval(this.ticker)
        this.ticker = null
      }
    }, TICK_MS)
  }
}

export default {
  fetch: (request, env) => {
    if (new URL(request.url).pathname !== SOCKET_PATH) return new Response("Not found", { status: 404 })
    return env.RUNS.getByName("runs").fetch(request)
  }
} satisfies ExportedHandler<Env>
