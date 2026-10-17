// A theme: colours of its own for some of what the window is drawn in, in the light look
// and in the dark, and for the parts of a model. What it leaves out is the app's own. A
// theme is a file to itself in themes/ at the top of the repository, which goes out with
// the app; run from a checkout, the app's theme creator writes one there, for it to be
// put to the app in a pull request. The app's own look, light and dark, is no theme
// that can be taken away: it is src/index.css and the palette, with what
// themes/default.json changes of them, under every theme. That file is written in the
// theme creator too, and put to the app the same way.
import { PALETTE_NAMES, type PaletteName } from "./palette"

/** The folder at the top of the repository that the themes are in. */
export const THEME_FOLDER = "themes"

/** The app's own look, which no theme is called; what is changed of it is in a file of this name. */
export const DEFAULT_THEME = "default"

/** What the app's own look is called, where its file does not say. */
export const DEFAULT_NAME = "Default"

/** How long a theme's name may be, in characters. */
export const NAME_LENGTH = 20

/** A name as a theme is written under it: trimmed, and no longer than NAME_LENGTH. */
export const nameOf = (name: string) => name.trim().slice(0, NAME_LENGTH).trim()

/** The two looks a theme has colours for. */
export type Mode = "light" | "dark"
export const MODES: Mode[] = ["light", "dark"]

/**
 * What of the window a theme colours, by the part of the window it is in, and the token
 * of the app's that each is drawn in (see src/index.css).
 */
export const SLOTS = [
  {
    id: "cards",
    area: "Sidebar",
    label: "Cards",
    detail: "Each project's card",
    token: "--sidebar-accent",
  },
  {
    id: "attention",
    area: "Sidebar",
    label: "Working",
    detail: "What is going on, and what needs you",
    token: "--attention",
  },
  {
    id: "viewer",
    area: "Viewer",
    label: "Background",
    detail: "Behind the model",
    token: "--sidebar",
  },
  {
    id: "chat",
    area: "Chat",
    label: "Background",
    detail: "Behind the conversation",
    token: "--chat",
  },
  {
    id: "message",
    area: "Chat",
    label: "User message",
    detail: "The bubble of what you say",
    token: "--user-message",
  },
  {
    id: "tools",
    area: "Tools",
    label: "Tools",
    detail: "The project's own tools, and their panel",
    token: "--tool",
  },
] as const

export type SlotId = (typeof SLOTS)[number]["id"]

/**
 * A theme's colours for one look, each "#rrggbb": those it changes, of the window and of
 * the parts of a model (by the palette's names). What it leaves out is the app's own.
 */
export type ThemeColours = Partial<Record<SlotId, string>> & {
  parts?: Partial<Record<PaletteName, string>>
}

export type Theme = {
  /** what its file is called, without .json */
  id: string
  name: string
  light: ThemeColours
  dark: ThemeColours
}

/** A theme's colours for each look, or what is changed of the app's own. */
export type ThemeLooks = Pick<Theme, "light" | "dark">

/** What is changed of the app's own look, and what it is called. */
export type Defaults = Omit<Theme, "id">

/** A colour as a theme gives one. */
const HEX = /^#[0-9a-f]{6}$/i

/** What a theme's file may be called: lower case, and nothing an address cannot hold. */
export const THEME_ID = /^[a-z0-9][a-z0-9-]*$/

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The colours of one look, as written: only those that are colours, of what it can colour. */
function readColours(written: unknown): ThemeColours {
  if (!isObject(written)) return {}
  const colours: ThemeColours = {}
  for (const { id } of SLOTS) {
    const value = written[id]
    if (typeof value === "string" && HEX.test(value))
      colours[id] = value.toLowerCase()
  }
  if (isObject(written.parts)) {
    const parts: Partial<Record<PaletteName, string>> = {}
    for (const name of PALETTE_NAMES) {
      const value = written.parts[name]
      if (typeof value === "string" && HEX.test(value))
        parts[name] = value.toLowerCase()
    }
    if (Object.keys(parts).length > 0) colours.parts = parts
  }
  return colours
}

/**
 * A theme from what its file says, as it is called (`id`); nothing, if it is not one: if
 * it is called what the app's own look is, or has no name. Anything in it that is not a
 * colour of something a theme colours is left out.
 */
export function readTheme(id: string, written: unknown): Theme | null {
  if (!THEME_ID.test(id) || id === DEFAULT_THEME || !isObject(written))
    return null
  const name = typeof written.name === "string" ? written.name.trim() : ""
  if (!name) return null
  return {
    id,
    name,
    light: readColours(written.light),
    dark: readColours(written.dark),
  }
}

/**
 * What is changed of the app's own look, and what it is called, from what its file says:
 * nothing, and DEFAULT_NAME, where it says nothing of them.
 */
export function readLooks(written: unknown): Defaults {
  const looks = isObject(written) ? written : {}
  const name = typeof looks.name === "string" ? looks.name.trim() : ""
  return {
    name: name || DEFAULT_NAME,
    light: readColours(looks.light),
    dark: readColours(looks.dark),
  }
}

/** What a theme's file says: its name and its colours, without what the file is called. */
export function themeFile({ name, light, dark }: Omit<Theme, "id">): string {
  return `${JSON.stringify({ name, light, dark }, null, 2)}\n`
}

/**
 * What a theme of this name is to be called: its name in lower case, with dashes, and a
 * number after it where one already goes by that (`taken`), or the app's own look does.
 */
export function themeIdOf(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "theme"
  const used = new Set([...taken, DEFAULT_THEME])
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** Whether a look of a theme changes anything. */
export const changes = (colours: ThemeColours) =>
  SLOTS.some(({ id }) => colours[id]) ||
  Object.keys(colours.parts ?? {}).length > 0
