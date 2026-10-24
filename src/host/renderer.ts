import { makePixiRenderer } from "./render-pixi.ts"
import { makeRenderer } from "./render.ts"
import type { Renderer } from "./render.ts"

const webgl = () => {
  const probe = document.createElement("canvas")
  return (probe.getContext("webgl2") ?? probe.getContext("webgl")) !== null
}

/**
 * Pixi (WebGL) when the browser has it, the Canvas 2D renderer otherwise or with `?renderer=canvas`.
 * Returns the canvas actually drawn on: a failed WebGL start leaves its canvas unusable for 2D, so it is replaced.
 */
export const createRenderer = async (canvas: HTMLCanvasElement): Promise<{ renderer: Renderer; canvas: HTMLCanvasElement }> => {
  if (new URLSearchParams(location.search).get("renderer") !== "canvas" && webgl()) {
    try {
      return { renderer: await makePixiRenderer(canvas), canvas }
    } catch (error) {
      console.warn("WebGL renderer unavailable, drawing with Canvas 2D", error)
      const fresh = canvas.cloneNode() as HTMLCanvasElement
      canvas.replaceWith(fresh)
      return { renderer: makeRenderer(fresh), canvas: fresh }
    }
  }
  return { renderer: makeRenderer(canvas), canvas }
}
