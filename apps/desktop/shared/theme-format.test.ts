import { describe, expect, it } from "vitest"

import {
  changes,
  readLooks,
  readTheme,
  themeFile,
  themeIdOf,
} from "./theme-format"

describe("readTheme", () => {
  it("reads a theme's name and the colours of each look", () => {
    expect(
      readTheme("ocean", {
        name: " Ocean ",
        light: { viewer: "#F2F6FA", parts: { blue: "#336699" } },
        dark: { tools: "#00aaff" },
      })
    ).toEqual({
      id: "ocean",
      name: "Ocean",
      light: { viewer: "#f2f6fa", parts: { blue: "#336699" } },
      dark: { tools: "#00aaff" },
    })
  })

  it("leaves out what is not a colour of something a theme colours", () => {
    const theme = readTheme("odd", {
      name: "Odd",
      light: {
        viewer: "blue",
        sidebar: "#ffffff",
        chat: "#12345",
        parts: { teal: "#00ffff", red: 3, pink: "#ff00aa" },
      },
      dark: "#000000",
    })
    expect(theme).toEqual({
      id: "odd",
      name: "Odd",
      light: { parts: { pink: "#ff00aa" } },
      dark: {},
    })
  })

  it("is no theme without a name, or called what the app's own look is", () => {
    expect(readTheme("nameless", { light: {} })).toBeNull()
    expect(readTheme("default", { name: "Mine" })).toBeNull()
    expect(readTheme("Not An Id", { name: "Mine" })).toBeNull()
    expect(readTheme("list", [])).toBeNull()
  })

  it("reads back what it writes", () => {
    const theme = {
      name: "Dusk",
      light: { message: "#eeeeff" },
      dark: { cards: "#202030", parts: { green: "#88ffaa" } },
    }
    expect(readTheme("dusk", JSON.parse(themeFile(theme)))).toEqual({
      id: "dusk",
      ...theme,
    })
  })
})

describe("themeIdOf", () => {
  it("is the name in lower case, with dashes", () => {
    expect(themeIdOf("Deep Ocean!", [])).toBe("deep-ocean")
    expect(themeIdOf("Café Noir", [])).toBe("cafe-noir")
    expect(themeIdOf("???", [])).toBe("theme")
  })

  it("is numbered where one goes by it already, or the app's own look does", () => {
    expect(themeIdOf("Ocean", ["ocean"])).toBe("ocean-2")
    expect(themeIdOf("Ocean", ["ocean", "ocean-2"])).toBe("ocean-3")
    expect(themeIdOf("Default", [])).toBe("default-2")
  })
})

describe("changes", () => {
  it("is whether a look of a theme changes anything", () => {
    expect(changes({})).toBe(false)
    expect(changes({ parts: {} })).toBe(false)
    expect(changes({ chat: "#000000" })).toBe(true)
    expect(changes({ parts: { red: "#ff0000" } })).toBe(true)
  })
})

describe("readLooks", () => {
  it("reads what is changed of the app's own look, and nothing from what says nothing", () => {
    expect(
      readLooks({ name: " Paper ", light: { chat: "#FAFAFA" }, dark: [] })
    ).toEqual({ name: "Paper", light: { chat: "#fafafa" }, dark: {} })
    expect(readLooks(null)).toEqual({ name: "Default", light: {}, dark: {} })
    expect(readLooks({ name: "  " }).name).toBe("Default")
  })
})
