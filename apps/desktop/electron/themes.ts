// The themes there are: a file to each in themes/ at the top of the repository, which
// goes out with the app among its resources (see shared/theme-format.ts). Run from a
// checkout, the app's theme creator writes one there, and the settings take one away;
// made into a package, the app only reads them.
import fs from "node:fs"
import path from "node:path"

import {
  DEFAULT_THEME,
  nameOf,
  readLooks,
  readTheme,
  THEME_ID,
  themeFile,
  themeIdOf,
  type Defaults,
  type Theme,
} from "../shared/theme-format"

/** Every theme in the folder, by name; none, where there is no folder. Files that are no theme are passed over. */
export function listThemes(dir: string): Theme[] {
  let names: string[]
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith(".json"))
  } catch {
    return []
  }
  return (
    names
      .flatMap((name) => {
        try {
          const written: unknown = JSON.parse(
            fs.readFileSync(path.join(dir, name), "utf8")
          )
          const theme = readTheme(name.slice(0, -".json".length), written)
          return theme ? [theme] : []
        } catch {
          return []
        }
      })
      // (and two of a name by what their files are called)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  )
}

/**
 * Write a new theme into the folder, under a name of its own: what it is called comes
 * from its name, numbered where that is taken. Gives back the theme as it was written.
 */
export function saveTheme(dir: string, given: Omit<Theme, "id">): Theme {
  const name = nameOf(given.name)
  if (!name) throw new Error("A theme needs a name.")
  fs.mkdirSync(dir, { recursive: true })
  const taken = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
  const id = themeIdOf(name, taken)
  const file = themeFile({ name, light: given.light, dark: given.dark })
  const theme = readTheme(id, JSON.parse(file))
  if (!theme) throw new Error(`"${name}" could not be made a theme.`)
  fs.writeFileSync(path.join(dir, `${id}.json`), file)
  return theme
}

/**
 * Take a theme out of the folder. Nothing but a theme's own file is taken: the app's own
 * look is no file, and is not to be had by any name.
 */
export function removeTheme(dir: string, id: string): void {
  if (!THEME_ID.test(id) || !readTheme(id, { name: id }))
    throw new Error(`There is no theme "${id}" to take away.`)
  fs.rmSync(path.join(dir, `${id}.json`), { force: true })
}

/** The file of what is changed of the app's own look. */
const defaultsIn = (dir: string) => path.join(dir, `${DEFAULT_THEME}.json`)

/** What is changed of the app's own look, and what it is called: nothing, where there is no file of it. */
export function readDefaults(dir: string): Defaults {
  try {
    return readLooks(JSON.parse(fs.readFileSync(defaultsIn(dir), "utf8")))
  } catch {
    return readLooks(null)
  }
}

/** Write what is changed of the app's own look, and what it is called, and give it back as it was written. */
export function saveDefaults(dir: string, given: Defaults): Defaults {
  const read = readLooks(given)
  const defaults = { ...read, name: nameOf(read.name) }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(defaultsIn(dir), themeFile(defaults))
  return defaults
}
