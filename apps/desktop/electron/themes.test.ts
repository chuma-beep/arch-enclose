import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  listThemes,
  readDefaults,
  removeTheme,
  saveDefaults,
  saveTheme,
} from "./themes"

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "themes-"))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const write = (name: string, text: string) =>
  fs.writeFileSync(path.join(dir, name), text)

describe("listThemes", () => {
  it("lists the themes in the folder by name, passing over what is none", () => {
    write("b.json", JSON.stringify({ name: "Beach", light: {}, dark: {} }))
    write("a.json", JSON.stringify({ name: "Zinc", light: {}, dark: {} }))
    write("broken.json", "{ not json")
    write("nameless.json", JSON.stringify({ light: {} }))
    write("default.json", JSON.stringify({ name: "Not the app's own" }))
    write("notes.txt", "hello")
    expect(listThemes(dir).map((theme) => [theme.id, theme.name])).toEqual([
      ["b", "Beach"],
      ["a", "Zinc"],
    ])
  })

  it("lists none where there is no folder", () => {
    expect(listThemes(path.join(dir, "nowhere"))).toEqual([])
  })
})

describe("saveTheme", () => {
  it("writes a theme under a name made of its own, numbered where it is taken", () => {
    const first = saveTheme(path.join(dir, "made"), {
      name: " Deep Ocean ",
      light: { viewer: "#F0F4F8" },
      dark: { parts: { blue: "#3366cc" } },
    })
    expect(first).toEqual({
      id: "deep-ocean",
      name: "Deep Ocean",
      light: { viewer: "#f0f4f8" },
      dark: { parts: { blue: "#3366cc" } },
    })
    const second = saveTheme(path.join(dir, "made"), {
      name: "Deep Ocean",
      light: {},
      dark: {},
    })
    expect(second.id).toBe("deep-ocean-2")
    expect(listThemes(path.join(dir, "made")).map((t) => t.id)).toEqual([
      "deep-ocean",
      "deep-ocean-2",
    ])
  })

  it("will not write one with no name", () => {
    expect(() => saveTheme(dir, { name: " ", light: {}, dark: {} })).toThrow()
  })
})

describe("removeTheme", () => {
  it("takes a theme's file away", () => {
    const theme = saveTheme(dir, { name: "Dusk", light: {}, dark: {} })
    removeTheme(dir, theme.id)
    expect(listThemes(dir)).toEqual([])
  })

  it("takes nothing that is not a theme's own file", () => {
    write("default.json", "{}")
    expect(() => removeTheme(dir, "default")).toThrow()
    expect(() => removeTheme(dir, "../escape")).toThrow()
    expect(fs.existsSync(path.join(dir, "default.json"))).toBe(true)
  })
})

describe("the app's own look", () => {
  it("is changed in a file of its own, which is no theme on the list", () => {
    expect(readDefaults(dir)).toEqual({ light: {}, dark: {} })
    const saved = saveDefaults(dir, {
      light: { chat: "#FAFAF7" },
      dark: { parts: { green: "#99eeaa" } },
    })
    expect(saved).toEqual({
      light: { chat: "#fafaf7" },
      dark: { parts: { green: "#99eeaa" } },
    })
    expect(readDefaults(dir)).toEqual(saved)
    expect(listThemes(dir)).toEqual([])
    expect(() => removeTheme(dir, "default")).toThrow()
  })
})
