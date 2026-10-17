// The colours the user gives parts by hand in the app: kept in a file of the project's
// own, at the top of its folder, so that they go wherever the project goes: into its
// history with the rest of it, into each conversation's version of it, and to another
// machine. By part, as the manifest calls each ("id"), and each one of the palette's
// names. What the model names for a part is drawn only where the user has given it none.
import { PALETTE_NAMES, type PaletteName } from "./palette"

/** The file they are kept in, at the top of the project's folder. */
export const COLOURS_FILE = "enclose.colors.json"

/** The colours given to a project's parts by hand, by part. */
export type PartColours = Record<string, PaletteName>

const NAMES = new Set<string>(PALETTE_NAMES)

/**
 * The colours a file says, as written: only those that are the palette's, of parts
 * that are named. Nothing, where it says nothing that is.
 */
export function readColours(written: unknown): PartColours {
  if (typeof written !== "object" || written === null || Array.isArray(written))
    return {}
  const colours: PartColours = {}
  for (const [part, colour] of Object.entries(written))
    if (
      part &&
      part !== "__proto__" &&
      typeof colour === "string" &&
      NAMES.has(colour)
    )
      colours[part] = colour as PaletteName
  return colours
}

/** What the file says: its parts in order, so that it changes only where a colour does. */
export function coloursFile(colours: PartColours): string {
  const ordered = Object.fromEntries(
    Object.keys(colours)
      .sort()
      .map((part) => [part, colours[part]])
  )
  return `${JSON.stringify(ordered, null, 2)}\n`
}
