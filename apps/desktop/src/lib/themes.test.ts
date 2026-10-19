import { describe, expect, it } from "vitest"

import { PALETTE } from "@shared/palette"
import { SLOTS } from "@shared/theme-format"
import { paletteOf, propertiesOf, previewOf } from "./themes"

describe("propertiesOf", () => {
  it("puts each of a theme's colours in place of the app's token for it", () => {
    expect(propertiesOf({ cards: "#112233", "board-mask": "#445566" })).toEqual(
      { "--sidebar-accent": "#112233", "--board-mask": "#445566" }
    )
  })

  it("leaves out what the theme leaves out, and what is not a colour of a slot", () => {
    expect(propertiesOf({})).toEqual({})
    expect(propertiesOf({ cards: "" })).toEqual({})
    // (the parts' colours go to the 3D view, not to tokens)
    expect(propertiesOf({ parts: { red: "#ff0000" } })).toEqual({})
  })

  it("has a token for every slot", () => {
    const all = Object.fromEntries(SLOTS.map(({ id }) => [id, "#010203"]))
    expect(Object.keys(propertiesOf(all))).toHaveLength(SLOTS.length)
  })
})

describe("previewOf", () => {
  it("has each look's tokens, and none for a look the theme leaves out", () => {
    expect(
      previewOf({ light: { cards: "#111111" }, dark: {} } as never)
    ).toEqual({ light: { "--sidebar-accent": "#111111" }, dark: {} })
    expect(previewOf(null)).toEqual({ light: {}, dark: {} })
  })
})

describe("paletteOf", () => {
  it("is the app's own palette where nothing changes it", () => {
    expect(paletteOf(undefined)).toEqual(PALETTE)
    expect(paletteOf({})).toEqual(PALETTE)
  })

  it("has a theme's colours over what is changed of the app's own, over the app's own", () => {
    const palette = paletteOf(
      { parts: { red: "#ff0000" } },
      { parts: { red: "#880000", blue: "#000088" } }
    )
    expect(palette).toEqual({ ...PALETTE, red: "#ff0000", blue: "#000088" })
  })
})
