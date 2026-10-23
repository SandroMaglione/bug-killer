import { defaultLocale, isLocale, text } from "../content/i18n.ts"
import type { Locale, Strings } from "../content/i18n.ts"

const STORAGE_KEY = "bugkiller:lang"

/** `?lang=it` wins, then the last choice, then English. */
const initial = (): Locale => {
  const fromUrl = new URLSearchParams(location.search).get("lang")
  if (isLocale(fromUrl)) return fromUrl
  const saved = localStorage.getItem(STORAGE_KEY)
  return isLocale(saved) ? saved : defaultLocale
}

let current: Locale = initial()
document.documentElement.lang = current

export const locale = (): Locale => current

/** The strings for the current language: read it at draw time, not once. */
export const t = (): Strings => text[current]

export const setLocale = (next: Locale) => {
  current = next
  document.documentElement.lang = next
  localStorage.setItem(STORAGE_KEY, next)
}

export const formatNumber = (n: number): string => n.toLocaleString(t().tag)
