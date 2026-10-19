import { describe, expect, it } from "vitest"

import type { PcbColours } from "@shared/theme-format"
import { fromUnder, holesEdged, turnedOver } from "./drawing"
import { DRAWN } from "./ground"

describe("fromUnder", () => {
  it("has the bottom drawn over the top, and the rest of the board in its place", () => {
    const order = [
      "global",
      "board",
      "soldermask-top",
      "top",
      "inner1",
      "inner2",
      "bottom",
      "through",
      "drill",
      "overlay",
    ].map(fromUnder)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(fromUnder("bottom")).toBeGreaterThan(fromUnder("top"))
    // both masks lie on the board, under either side's copper
    expect(fromUnder("soldermask-bottom")).toBe(fromUnder("soldermask-top"))
  })

  it("puts the inner layers in order between the sides, by their numbers", () => {
    expect(fromUnder("inner2")).toBeGreaterThan(fromUnder("inner1"))
    expect(fromUnder("inner6")).toBeLessThan(fromUnder("bottom"))
    // one with no number is the first of them
    expect(fromUnder("inner")).toBe(fromUnder("top") + 1)
  })

  it("has what is on no layer over everything, and a layer it does not know between the sides", () => {
    expect(fromUnder(null)).toBeGreaterThan(fromUnder("overlay"))
    expect(fromUnder("silkscreen")).toBeGreaterThan(fromUnder("top"))
    expect(fromUnder("silkscreen")).toBeLessThan(fromUnder("bottom"))
  })
})

describe("turnedOver", () => {
  it("turns the drawing over left to right, about its own width", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect/></svg>'
    expect(turnedOver(svg)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
        '<g transform="translate(800 0) scale(-1 1)"><rect/></g></svg>'
    )
  })

  it("takes a drawing that says no width to be as wide as they are made", () => {
    expect(turnedOver("<svg><rect/></svg>\n")).toBe(
      `<svg><g transform="translate(${DRAWN.width} 0) scale(-1 1)"><rect/></g></svg>`
    )
  })
})

describe("holesEdged", () => {
  it("edges every hole through the board, in the theme's colour for its edge, as thin at any zoom", () => {
    const colours = { "technical-edge": "#abcdef" } as PcbColours
    const svg =
      '<circle data-type="pcb_hole"/><circle data-type="pcb_plated_hole"/><circle data-type="pcb_hole"/>'
    const edged = holesEdged(svg, colours)
    expect(edged.match(/stroke="#abcdef"/g)).toHaveLength(2)
    expect(edged).toContain('vector-effect="non-scaling-stroke"')
    // a pad's hole has the pad's copper round it
    expect(edged).toContain('<circle data-type="pcb_plated_hole"/>')
  })
})
