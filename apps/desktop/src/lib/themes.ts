// The theme the window is drawn in, over its light or dark look (theme-provider.tsx): the
// app's own, or one of the themes beside it (shared/theme-format.ts). A theme's colours
// are put in place of the app's tokens wherever the window is in that look, and of the
// palette's colours in the 3D view. Under every theme is the app's own look, with what
// themes/default.json changes of it. Run from a checkout, themes are made in the theme
// creator, and taken away in the settings; the app's own look is changed there too, and
// taken away never.
import * as React from "react"
import { create } from "zustand"

import { PALETTE, type PaletteName } from "@shared/palette"
import {
  DEFAULT_THEME,
  readLooks,
  readTheme,
  SLOTS,
  type Defaults,
  type ThemeLooks,
  type Mode,
  type Theme,
  type ThemeColours,
} from "@shared/theme-format"
import { setPalettes } from "./palette"

/** Where the theme chosen is kept, whole: so that the window is drawn in it from the first. */
const CHOSEN_KEY = "enclose:colour-theme"
/** And what is changed of the app's own look, likewise. */
const DEFAULTS_KEY = "enclose:theme-defaults"

/** A theme's colours for one look, as the tokens they are put in place of. */
export function propertiesOf(colours: ThemeColours): Record<string, string> {
  const properties: Record<string, string> = {}
  for (const { id, token } of SLOTS) {
    const value = colours[id]
    if (value) properties[token] = value
  }
  return properties
}

/**
 * The palette in one look: a theme's colours (`colours`), over what is changed of the
 * app's own (`under`), over the app's own.
 */
export const paletteOf = (
  colours: ThemeColours | undefined,
  under?: ThemeColours
): Record<PaletteName, string> => ({
  ...PALETTE,
  ...under?.parts,
  ...colours?.parts,
})

/**
 * A theme's colours as they are put on something that shows it, whatever the window is
 * drawn in: on what carries the class of each look, inside something marked
 * data-theme-preview, which the theme the window is in leaves alone. What the theme
 * leaves out is the app's own look there, as it has been changed. Marked
 * data-theme-base as well, it is the app's own look as it is in src/index.css.
 */
export const previewOf = (theme: ThemeLooks | null) =>
  ({
    light: propertiesOf(theme?.light ?? {}),
    dark: propertiesOf(theme?.dark ?? {}),
  }) as Record<Mode, React.CSSProperties>

/** What the window's looks are written into, after the app's own tokens. */
let sheet: HTMLStyleElement | null = null
/** How many times the window has been put into a theme: what tells the view to look again. */
let applied = 0

/** Some colours put in place of the app's tokens, in each look, where `outside` says. */
function rules(looks: ThemeLooks | null, outside: string) {
  return (["light", "dark"] as const).map((mode) => {
    const properties = Object.entries(propertiesOf(looks?.[mode] ?? {}))
    if (properties.length === 0) return ""
    const said = properties.map(([token, value]) => `${token}: ${value};`)
    return `.${mode}:not(${outside}, ${outside} *) { ${said.join(" ")} }`
  })
}

/**
 * Draw the window in a theme, or (null) in the app's own look, over what is changed of
 * that: in each look, the one everywhere but in the app's own as it is in src/index.css,
 * and the theme everywhere but where another is shown; and the palette likewise. The
 * view hears of it by the root's data-theme, which it watches (see css-color.ts).
 */
function apply(theme: Theme | null, defaults: ThemeLooks) {
  if (typeof document === "undefined") return
  if (!sheet) {
    sheet = document.createElement("style")
    sheet.dataset.theme = ""
    document.head.append(sheet)
  }
  sheet.textContent = [
    ...rules(defaults, "[data-theme-base]"),
    ...rules(theme, "[data-theme-preview]"),
  ]
    .filter(Boolean)
    .join("\n")
  setPalettes(
    paletteOf(theme?.light, defaults.light),
    paletteOf(theme?.dark, defaults.dark)
  )
  document.documentElement.dataset.theme = `${theme?.id ?? DEFAULT_THEME} ${++applied}`
}

/** What was kept under a key, as JSON; nothing, if nothing is. */
function kept(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null")
  } catch {
    return null
  }
}

/** The theme kept as chosen, if it is one. */
function keptTheme(): Theme | null {
  const saved = kept(CHOSEN_KEY)
  if (typeof saved !== "object" || saved === null || !("id" in saved))
    return null
  return readTheme(String(saved.id), saved)
}

/** The theme creator, making a theme, or changing the app's own look. */
export type Making = "theme" | "defaults"

type ThemesState = {
  /** the themes there are beside the app's own look, by name */
  themes: Theme[]
  /** the theme the window is drawn in: null for the app's own look */
  chosen: Theme | null
  /** what is changed of the app's own look, under every theme, and what it is called */
  defaults: Defaults
  /** what the theme creator is up for, over the whole window, if it is */
  creating: Making | null
  /** the look it shows at first: the one the window is in, where none is given */
  creatingIn: Mode | null
  /**
   * read the themes there are again, and what is changed of the app's own look; one
   * chosen that is gone gives way to the app's own
   */
  load(): Promise<void>
  /** draw the window in one of them, or in the app's own look (DEFAULT_THEME) */
  choose(id: string): void
  /** write a theme, new or in place of one (`replacing`), and draw the window in it */
  save(theme: Omit<Theme, "id">, replacing?: string): Promise<Theme>
  /** write what is changed of the app's own look, and what it is called */
  saveDefaults(defaults: Defaults): Promise<void>
  /** take one away: if the window was in it, it goes back to the app's own look */
  remove(id: string): Promise<void>
  setCreating(creating: Making | null, look?: Mode): void
}

const atFirst =
  typeof localStorage === "undefined"
    ? { chosen: null, defaults: readLooks(null) }
    : { chosen: keptTheme(), defaults: readLooks(kept(DEFAULTS_KEY)) }
apply(atFirst.chosen, atFirst.defaults)

export const useThemes = create<ThemesState>()((set, get) => {
  /** Draw the window in what is chosen now, and keep that for the next time. */
  const put = (chosen: Theme | null, defaults: Defaults) => {
    if (chosen) localStorage.setItem(CHOSEN_KEY, JSON.stringify(chosen))
    else localStorage.removeItem(CHOSEN_KEY)
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
    set({ chosen, defaults })
    apply(chosen, defaults)
  }
  return {
    themes: [],
    ...atFirst,
    creating: null,
    creatingIn: null,

    async load() {
      if (!window.cad) return
      const [themes, defaults] = await Promise.all([
        window.cad.themes.list(),
        window.cad.themes.defaults(),
      ])
      const { chosen, defaults: before } = get()
      // the one chosen as it is now: what its file says may have changed since, or it
      // may be gone
      const now = themes.find((theme) => theme.id === chosen?.id) ?? null
      set({ themes })
      if (
        JSON.stringify(now) !== JSON.stringify(chosen) ||
        JSON.stringify(defaults) !== JSON.stringify(before)
      )
        put(now, defaults)
    },

    choose(id) {
      put(get().themes.find((one) => one.id === id) ?? null, get().defaults)
    },

    async save(theme, replacing) {
      const saved = await window.cad.themes.save(theme, replacing)
      set((state) => ({
        themes: [
          ...state.themes.filter(
            (one) => one.id !== saved.id && one.id !== replacing
          ),
          saved,
        ].sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        ),
      }))
      get().choose(saved.id)
      return saved
    },

    async saveDefaults(defaults) {
      put(get().chosen, await window.cad.themes.saveDefaults(defaults))
    },

    async remove(id) {
      const themes = await window.cad.themes.remove(id)
      set({ themes })
      if (!themes.some((theme) => theme.id === get().chosen?.id))
        get().choose(DEFAULT_THEME)
    },

    setCreating(creating, look) {
      set({ creating, creatingIn: look ?? null })
    },
  }
})

const lookNow = (): Mode =>
  document.documentElement.classList.contains("dark") ? "dark" : "light"

/** The look the window is drawn in now, however that was chosen (theme-provider.tsx). */
export function useLook(): Mode {
  return React.useSyncExternalStore((changed) => {
    const watching = new MutationObserver(changed)
    watching.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => watching.disconnect()
  }, lookNow)
}
