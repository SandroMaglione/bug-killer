/**
 * Fullscreen for phones. Android browsers (and iPad) support the Fullscreen
 * API and can lock to landscape once fullscreen; iPhone Safari does not,
 * so there the way is "Add to Home Screen" with the web app manifest.
 */

type OrientationWithLock = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> }

const root = document.documentElement

export const fullscreenSupported = (): boolean => typeof root.requestFullscreen === "function" && document.fullscreenEnabled

/** Launched from the home screen: already fullscreen as far as the browser allows. */
export const standalone = (): boolean =>
  matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isFullscreen = (): boolean => document.fullscreenElement !== null

/** Must run inside a user gesture (a tap). Failures are fine: the game works windowed. */
export const enterFullscreen = async (): Promise<void> => {
  if (!fullscreenSupported() || isFullscreen()) return
  try {
    await root.requestFullscreen({ navigationUI: "hide" })
    await (screen.orientation as OrientationWithLock).lock?.("landscape")
  } catch {
    // Denied, or orientation lock unsupported: stay as we are.
  }
}

export const toggleFullscreen = async (): Promise<void> => {
  if (isFullscreen()) await document.exitFullscreen().catch(() => undefined)
  else await enterFullscreen()
}

export const onFullscreenChange = (listener: () => void) => document.addEventListener("fullscreenchange", listener)
