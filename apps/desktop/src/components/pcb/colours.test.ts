import { describe, expect, it } from "vitest"
import * as THREE from "three"

import type { PcbColours } from "@shared/theme-format"
import { inShade, shadedOf } from "./colours"

/** The theme's shades for what is on a board, as src/index.css has them, and the rest. */
const OWN = {
  "components-light": "#e7e7e7",
  "components-mid": "#9c9c9c",
  "components-dark": "#737373",
} as PcbColours

const drawn = (colour: string, theme: PcbColours) => {
  const shaded = shadedOf(new THREE.Color(colour))
  return (
    shaded && `#${inShade(shaded, theme, new THREE.Color()).getHexString()}`
  )
}

describe("shadedOf", () => {
  it("is the shade of a grey on a board by how light it is, and of nothing else", () => {
    expect(shadedOf(new THREE.Color("#fcfdfe"))?.shade).toBe("components-light")
    expect(shadedOf(new THREE.Color("#9c9c9c"))?.shade).toBe("components-mid")
    expect(shadedOf(new THREE.Color("#a79f9f"))?.shade).toBe("components-mid")
    expect(shadedOf(new THREE.Color("#666666"))?.shade).toBe("components-dark")
    // an LED, gold, a capacitor's tan
    expect(shadedOf(new THREE.Color("#00bc00"))).toBeNull()
    expect(shadedOf(new THREE.Color("#f9e276"))).toBeNull()
    expect(shadedOf(new THREE.Color("#bfae95"))).toBeNull()
  })
})

describe("inShade", () => {
  it("leaves each grey as it was where the theme gives no shades of its own", () => {
    for (const grey of ["#fcfdfe", "#d5dae3", "#9c9c9c", "#7c7c7c", "#5a5a5a"])
      expect(drawn(grey, OWN)).toBe(grey)
  })

  it("draws a grey in the theme's shade, as much lighter or darker than it was", () => {
    const red = { ...OWN, "components-mid": "#cc0000" }
    expect(drawn("#9c9c9c", red)).toBe("#cc0000")
    const lighter = drawn("#a3a3a3", red)!
    expect(new THREE.Color(lighter).r).toBeGreaterThan(
      new THREE.Color("#cc0000").r
    )
    expect(new THREE.Color(lighter).g).toBe(0)
  })
})
