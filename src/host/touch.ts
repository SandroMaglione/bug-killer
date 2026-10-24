import type { Vec } from "../sim/schema.ts"
import { fullscreenSupported, isFullscreen, onFullscreenChange } from "./fullscreen.ts"
import { t } from "./language.ts"

const STICK_RADIUS = 56
const DEADZONE = 0.18

// Touch mode starts on coarse-pointer devices, or the first time a finger touches the page.
let touch = matchMedia("(pointer: coarse)").matches
const listeners = new Set<() => void>()
document.body.classList.toggle("touch", touch)
window.addEventListener(
  "pointerdown",
  (event) => {
    if (touch || event.pointerType !== "touch") return
    touch = true
    document.body.classList.add("touch")
    for (const listener of listeners) listener()
  },
  { capture: true }
)

// iOS Safari can leave the page scrolled by its bar height after a rotation or when its bars
// collapse: the fixed layers then draw higher than where they take taps. Keep it at the origin.
const pin = () => {
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
}
window.addEventListener("scroll", pin, { passive: true })
window.visualViewport?.addEventListener("resize", pin)
window.addEventListener("orientationchange", () => window.setTimeout(pin, 300))

export const touchMode = (): boolean => touch
export const onTouchMode = (listener: () => void) => listeners.add(listener)

export interface TouchSnapshot {
  readonly move: Vec
  /** Unit direction of the right stick; `null` when it is held still (fire at the nearest bug). */
  readonly aim: Vec | null
  readonly fire: boolean
  readonly dash: boolean
  readonly bomb: boolean
}

const el = (tag: string, className: string, text = ""): HTMLElement => {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

/** A thumb stick that appears where the finger lands inside its zone. */
const stick = (zone: HTMLElement) => {
  const base = el("div", "stick")
  const knob = el("div", "knob")
  base.append(knob)
  zone.append(base)
  let id: number | null = null
  let origin: Vec = { x: 0, y: 0 }
  let value: Vec = { x: 0, y: 0 }

  const show = (at: Vec) => {
    base.style.left = `${at.x}px`
    base.style.top = `${at.y}px`
    base.classList.add("held")
  }
  const release = () => {
    id = null
    value = { x: 0, y: 0 }
    knob.style.transform = ""
    base.classList.remove("held")
  }

  zone.addEventListener("pointerdown", (event) => {
    if (id !== null) return
    event.preventDefault()
    id = event.pointerId
    zone.setPointerCapture(event.pointerId)
    const box = zone.getBoundingClientRect()
    origin = { x: event.clientX - box.left, y: event.clientY - box.top }
    value = { x: 0, y: 0 }
    show(origin)
  })
  zone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== id) return
    const box = zone.getBoundingClientRect()
    const dx = event.clientX - box.left - origin.x
    const dy = event.clientY - box.top - origin.y
    const length = Math.hypot(dx, dy)
    const clamped = Math.min(length, STICK_RADIUS)
    const k = length > 0 ? clamped / length : 0
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`
    value = { x: (dx * k) / STICK_RADIUS, y: (dy * k) / STICK_RADIUS }
  })
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    zone.addEventListener(type, (event) => {
      if (event.pointerId === id) release()
    })
  }

  return {
    held: () => id !== null,
    value: () => value,
    release
  }
}

/** A button that latches a press until the next simulation tick reads it. */
const latch = (button: HTMLElement) => {
  let pressed = false
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault()
    event.stopPropagation()
    pressed = true
    button.classList.add("down")
  })
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    button.addEventListener(type, () => button.classList.remove("down"))
  }
  return () => {
    const was = pressed
    pressed = false
    return was
  }
}

/**
 * Twin-stick controls: left thumb moves, right thumb aims and fires
 * (held still, it fires at the nearest bug), plus dash and `git reset`.
 */
export const makeTouchControls = (root: HTMLElement, actions: { pause: () => void; mute: () => void; fullscreen: () => void }) => {
  root.replaceChildren()
  const left = el("div", "stick-zone left")
  const right = el("div", "stick-zone right")
  const dashButton = el("button", "touch-btn dash")
  const bombButton = el("button", "touch-btn bomb", "⏪")
  const bar = el("div", "touch-bar")
  const pauseButton = el("button", "touch-small", "⏸")
  const muteButton = el("button", "touch-small", "🔊")
  bar.append(pauseButton, muteButton)
  if (fullscreenSupported()) {
    const fullscreenButton = el("button", "touch-small", "⛶")
    const label = () => {
      fullscreenButton.classList.toggle("active", isFullscreen())
      fullscreenButton.setAttribute("aria-label", t().touch.fullscreen)
    }
    label()
    onFullscreenChange(label)
    fullscreenButton.addEventListener("click", actions.fullscreen)
    bar.append(fullscreenButton)
  }
  root.append(left, right, dashButton, bombButton, bar)

  const move = stick(left)
  const aim = stick(right)
  const dash = latch(dashButton)
  const bomb = latch(bombButton)
  pauseButton.addEventListener("click", actions.pause)
  muteButton.addEventListener("click", actions.mute)

  return {
    snapshot: (): TouchSnapshot => {
      const m = move.value()
      const a = aim.value()
      const magnitude = Math.hypot(a.x, a.y)
      return {
        move: Math.hypot(m.x, m.y) < DEADZONE ? { x: 0, y: 0 } : m,
        aim: magnitude < DEADZONE ? null : { x: a.x / magnitude, y: a.y / magnitude },
        fire: aim.held(),
        dash: dash(),
        bomb: bomb()
      }
    },
    setVisible: (visible: boolean) => {
      root.hidden = !visible
      if (!visible) {
        move.release()
        aim.release()
      }
      dashButton.textContent = t().touch.dash
      dashButton.setAttribute("aria-label", t().touch.dash)
      bombButton.setAttribute("aria-label", "git reset --hard")
    },
    setMuted: (muted: boolean) => {
      muteButton.textContent = muted ? "🔇" : "🔊"
    }
  }
}

export type TouchControls = ReturnType<typeof makeTouchControls>
