import type * as Random from "@typeonce/ritmo-math/Random"

import { ARENA, SPAWN_SAFE_DISTANCE } from "./constants.ts"
import type { Vec } from "./schema.ts"
import { Ops } from "@typeonce/ritmo-math"

export const length = (v: Vec): number => Ops.hypot(v.x, v.y)

export const normalize = (v: Vec): Vec => {
  const l = length(v)
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }
}

export const distanceSquared = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

export const overlaps = (a: Vec, ra: number, b: Vec, rb: number): boolean => distanceSquared(a, b) < (ra + rb) ** 2

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const clampToArena = (p: Vec, radius: number): Vec => ({
  x: clamp(p.x, radius, ARENA.width - radius),
  y: clamp(p.y, radius, ARENA.height - radius)
})

export const angleTo = (from: Vec, to: Vec): number => Ops.atan2(to.y - from.y, to.x - from.x)

/** The point of `points` closest to `from`, or null when there is none. */
export const nearest = (from: Vec, points: ReadonlyArray<Vec>): Vec | null => {
  let best: Vec | null = null
  let bestDistance = Infinity
  for (const point of points) {
    const d = distanceSquared(from, point)
    if (d < bestDistance) {
      best = point
      bestDistance = d
    }
  }
  return best
}

/** A point on the arena's edge, as far from `avoid` as a few tries allow. */
export const edgePoint = (random: Random.Random, avoid: Vec | null): Vec => {
  let best: Vec = { x: 60, y: 60 }
  let bestDistance = -1
  for (let attempt = 0; attempt < 6; attempt++) {
    const side = random.integer(0, 4)
    const along = random.range(60, side % 2 === 0 ? ARENA.width - 60 : ARENA.height - 60)
    const point =
      side === 0 ? { x: along, y: 50 }
      : side === 1 ? { x: ARENA.width - 50, y: along }
      : side === 2 ? { x: along, y: ARENA.height - 50 }
      : { x: 50, y: along }
    const d = avoid === null ? Infinity : distanceSquared(point, avoid)
    if (d > SPAWN_SAFE_DISTANCE ** 2) {
      return point
    }
    if (d > bestDistance) {
      best = point
      bestDistance = d
    }
  }
  return best
}

/** A point inside the arena at least `minDistance` from `avoid`. */
export const openPoint = (random: Random.Random, avoid: Vec, minDistance: number): Vec => {
  for (let attempt = 0; attempt < 12; attempt++) {
    const point = { x: random.range(140, ARENA.width - 140), y: random.range(140, ARENA.height - 140) }
    if (distanceSquared(point, avoid) > minDistance ** 2) {
      return point
    }
  }
  return { x: ARENA.width - avoid.x, y: ARENA.height - avoid.y }
}
