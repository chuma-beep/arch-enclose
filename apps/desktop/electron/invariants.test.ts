import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { CHANNEL } from "../shared/api"
import { SLOTS } from "../shared/theme-format"

// What has to agree across files that cannot be checked by the types alone.
//
// Each way the window and the app's own process talk is named once, in shared/api.ts:
// one the window has no way to, or that nothing in the app's process answers or sends
// on, is a button that does nothing. (Read as they are written: neither can be loaded
// here, without Electron.)
const here = import.meta.dirname
const read = (file: string) => fs.readFileSync(path.join(here, file), "utf8")
const named = (source: string, key: string) =>
  new RegExp(`CHANNEL\\.${key}\\b`).test(source)

/** All of the app's own process: main.ts, and whatever it has handed its work to. */
const mainProcess = fs
  .readdirSync(here)
  .filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      file !== "preload.ts"
  )
  .map(read)
  .join("\n")

describe("CHANNEL", () => {
  const keys = Object.keys(CHANNEL)

  it("has every way answered or sent on by the app's own process", () => {
    expect(keys.filter((key) => !named(mainProcess, key))).toEqual([])
  })

  it("has every way given to the window by the preload script", () => {
    const preload = read("preload.ts")
    expect(keys.filter((key) => !named(preload, key))).toEqual([])
  })

  it("names each way once", () => {
    const names = Object.values(CHANNEL)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe("the app's own look", () => {
  it("has a colour in src/index.css for every token a theme can colour", () => {
    const css = fs.readFileSync(
      path.join(here, "..", "src", "index.css"),
      "utf8"
    )
    // the light look's tokens, which the dark look has where it has none of its own
    const light = /:root,\s*\.light\s*\{([^}]*)\}/.exec(css)?.[1] ?? ""
    expect(light).not.toBe("")
    const missing = SLOTS.map(({ token }) => token).filter(
      (token) => !new RegExp(`^\\s*${token}:`, "m").test(light)
    )
    expect(missing).toEqual([])
  })
})
