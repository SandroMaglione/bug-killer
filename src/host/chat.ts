import { clients } from "../content/clients.ts"
import type { ClientId } from "../content/clients.ts"
import type { ChatValue, MissionsValue } from "../sim/schema.ts"
import type { View } from "../sim/simulation.ts"
import { t } from "./language.ts"

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const avatar = (client: ClientId): HTMLElement => {
  const node = el("div", "avatar", clients[client].name[0])
  node.style.background = clients[client].color
  return node
}

/** Message text with `_word_` rendered in italics, built as nodes (never as HTML). */
const rich = (text: string): Array<Node> =>
  text.split(/(_[^_]+_)/).filter(Boolean).map((part) => {
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return el("em", "", part.slice(1, -1))
    }
    return document.createTextNode(part)
  })

const clock = () => new Date().toLocaleTimeString(t().tag, { hour: "2-digit", minute: "2-digit" })

/** The client chat: messages slide in after a typing indicator; the active mission is pinned on top. */
export const makeChat = (root: HTMLElement, onMessage: (event: ChatValue) => void) => {
  root.replaceChildren()
  const header = el("div", "chat-header")
  const channel = el("span", "")
  const members = el("span", "chat-members")
  header.append(el("span", "chat-dot"), channel, members)
  const pinned = el("div", "mission hidden")
  const pinnedCall = el("div", "mission call hidden")
  const list = el("div", "chat-list")
  root.append(header, pinned, pinnedCall, list)

  const timers = new Set<number>()
  let pinnedKey = ""

  const push = (event: ChatValue) => {
    const client = clients[event.client]
    const row = el("div", "msg typing")
    const bubble = el("div", "bubble")
    const meta = el("div", "meta")
    const name = el("span", "name", client.name)
    name.style.color = client.color
    meta.append(name, el("span", "role", t().people[event.client].role), el("span", "time", clock()))
    const body = el("div", "text")
    body.append(el("span", "dots", "● ● ●"))
    bubble.append(meta, body)
    row.append(avatar(event.client), bubble)
    if (event.type === "outcome") row.classList.add(event.success ? "ok" : "ko")
    if (event.type === "resurrect") row.classList.add("zombie")
    if (event.type === "nudge") row.classList.add("nudge")
    if (event.type === "call") row.classList.add("call")
    list.prepend(row)
    while (list.children.length > 3) list.lastElementChild?.remove()

    const delay = event.client === "ugo" ? 350 : 800
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      row.classList.remove("typing")
      body.replaceChildren(...rich(event.text))
      onMessage(event)
    }, delay)
    timers.add(timer)
  }

  let pinnedCallKey = ""
  /** The bonus call, pinned under the mission while it rings. */
  const updateCall = (calls: View["calls"]) => {
    const call = calls.active
    if (!call) {
      if (pinnedCallKey) {
        pinnedCall.classList.add("hidden")
        pinnedCallKey = ""
      }
      return
    }
    const key = `${call.client}:${call.kind}:${call.title}`
    if (key !== pinnedCallKey) {
      pinnedCallKey = key
      pinnedCall.classList.remove("hidden")
      const top = el("div", "mission-top")
      top.append(avatar(call.client), el("span", "mission-kind", `${t().calls.bonus} · ${t().calls.kinds[call.kind]}`), el("span", "mission-time", ""))
      const bar = el("div", "bar")
      bar.append(el("div", "fill"))
      pinnedCall.replaceChildren(top, el("div", "mission-goal", ""), bar)
    }
    const time = pinnedCall.querySelector<HTMLElement>(".mission-time")
    const goal = pinnedCall.querySelector<HTMLElement>(".mission-goal")
    const fill = pinnedCall.querySelector<HTMLElement>(".fill")
    if (time) {
      time.textContent = `${Math.max(0, call.timeLeft).toFixed(1)}s`
      time.classList.toggle("urgent", call.timeLeft < 5)
    }
    if (goal) goal.textContent = call.kind === "meet" ? t().calls.meetProgress(Math.floor(call.progress), call.goal) : t().calls.slackProgress(call.progress, call.goal)
    if (fill) fill.style.width = `${Math.min(100, (call.progress / Math.max(1, call.goal)) * 100)}%`
  }

  const update = (missions: MissionsValue, calls: View["calls"]) => {
    updateCall(calls)
    const mission = missions.active
    if (!mission) {
      if (pinnedKey) {
        pinned.classList.add("hidden")
        pinnedKey = ""
      }
      return
    }
    const key = `${mission.client}:${mission.text}`
    if (key !== pinnedKey) {
      pinnedKey = key
      pinned.classList.remove("hidden")
      pinned.replaceChildren()
      const top = el("div", "mission-top")
      top.append(avatar(mission.client), el("span", "mission-kind", `${t().chat.mission} · ${t().chat.kinds[mission.kind]}`), el("span", "mission-time", ""))
      const goal = el("div", "mission-goal", "")
      const bar = el("div", "bar")
      bar.append(el("div", "fill"))
      pinned.append(top, goal, bar)
    }
    const time = pinned.querySelector<HTMLElement>(".mission-time")
    const goal = pinned.querySelector<HTMLElement>(".mission-goal")
    const fill = pinned.querySelector<HTMLElement>(".fill")
    if (time) {
      time.textContent = `${Math.max(0, mission.timeLeft).toFixed(1)}s`
      time.classList.toggle("urgent", mission.timeLeft < 5)
    }
    if (goal) {
      goal.textContent =
        mission.kind === "killTarget" ? `🎯 ${mission.target ?? ""}`
        : mission.kind === "noHit" ? t().chat.noHit(Math.floor(mission.progress), mission.goal)
        : mission.kind === "combo" ? t().chat.combo(mission.progress, mission.goal)
        : mission.kind === "priorityHunt" ? `🔺 ${mission.priority ?? ""}: ${mission.progress}/${mission.goal}`
        : t().chat.killCount(mission.progress, mission.goal)
    }
    if (fill) fill.style.width = `${Math.min(100, (mission.progress / Math.max(1, mission.goal)) * 100)}%`
  }

  return {
    push,
    update,
    /** Clears messages and the pinned mission, keeping the panel for the next level. */
    reset: () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      channel.textContent = t().chat.channel
      members.textContent = t().chat.members(5)
      list.replaceChildren()
      pinned.classList.add("hidden")
      pinnedKey = ""
      pinnedCall.classList.add("hidden")
      pinnedCallKey = ""
    }
  }
}
