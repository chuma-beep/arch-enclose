import { describe, expect, it } from "vitest"
import * as THREE from "three"

import { PCB_SLOTS, type PcbColours } from "@shared/theme-format"
import type { Circuit } from "./boards"
import { boardPaint, inShade, keepOutsOf, repaint, shadedOf } from "./colours"

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

/** A theme with a colour of its own for each of a board's, and the mask and traces said. */
const THEME = {
  ...(Object.fromEntries(
    PCB_SLOTS.map(({ id }, index) => [
      id,
      `#${(index * 8 + 16).toString(16).padStart(2, "0")}4020`,
    ])
  ) as PcbColours),
  "board-mask": "#112233",
  "board-traces": "#445566",
}

const hex = (colour: THREE.Color) => `#${colour.getHexString()}`

describe("boardPaint", () => {
  it("draws the board's colours in the theme's, its edge in the traces', and its holes as they were", () => {
    const paint = boardPaint(THEME)
    const drawn = paint.colours.value.map(hex)
    expect(drawn).toContain("#112233")
    expect(drawn).toContain("#445566")
    expect(hex(paint.edge)).toBe("#445566")
    // a hole is as dark as tscircuit draws it, whatever the theme
    expect(drawn.at(-1)).toBe("#000000")
    expect(paint.keepOuts.top.count.value).toBe(0)
    expect(paint.keepOuts.bottom.count.value).toBe(0)
  })

  it("is drawn in the new colours in place, when the theme changes them", () => {
    const paint = boardPaint(THEME)
    const [mask] = paint.colours.value
    const { edge } = paint
    repaint(paint, {
      ...THEME,
      "board-mask": "#aa0000",
      "board-traces": "#00bb00",
    })
    // the very colours the shaders were handed, changed
    expect(paint.colours.value[0]).toBe(mask)
    expect(hex(mask)).toBe("#aa0000")
    expect(paint.edge).toBe(edge)
    expect(hex(edge)).toBe("#00bb00")
    expect(hex(paint.colours.value.at(-1)!)).toBe("#000000")
  })
})

describe("keepOutsOf", () => {
  const keepOut = (fields: Record<string, unknown>) => ({
    type: "pcb_keepout",
    layers: ["top"],
    center: { x: 1, y: 2 },
    ...fields,
  })
  const zones = (
    paint: ReturnType<typeof boardPaint>,
    side: "top" | "bottom"
  ) =>
    paint.keepOuts[side].at.value
      .slice(0, paint.keepOuts[side].count.value)
      .map((zone) => zone.toArray())

  it("has a circle as its middle and radius, and a rectangle as its middle and half its sides", () => {
    const paint = boardPaint(THEME)
    keepOutsOf(paint, [
      keepOut({ shape: "circle", radius: 3 }),
      keepOut({ shape: "rect", width: 4, height: 6, center: { x: -1, y: 0 } }),
    ] as unknown as Circuit)
    expect(zones(paint, "top")).toEqual([
      [1, 2, 3, -1],
      [-1, 0, 2, 3],
    ])
  })

  it("puts each on the sides it is on, and leaves out what is no keep-out or says too little", () => {
    const paint = boardPaint(THEME)
    keepOutsOf(paint, [
      keepOut({ shape: "circle", radius: 1, layers: ["bottom"] }),
      keepOut({ shape: "circle", radius: 2, layers: ["top", "bottom"] }),
      // not keep-outs, or not ones that can be drawn
      {
        type: "pcb_hole",
        shape: "circle",
        radius: 1,
        layers: ["top"],
        center: { x: 0, y: 0 },
      },
      keepOut({ shape: "circle" }),
      keepOut({ shape: "rect", width: 2 }),
      keepOut({ shape: "polygon", radius: 1 }),
      keepOut({ shape: "circle", radius: 1, layers: "top" }),
      keepOut({ shape: "circle", radius: 1, center: undefined }),
    ] as unknown as Circuit)
    expect(zones(paint, "top")).toEqual([[1, 2, 2, -1]])
    expect(zones(paint, "bottom")).toEqual([
      [1, 2, 1, -1],
      [1, 2, 2, -1],
    ])
  })

  it("hatches no more than 24 on a side", () => {
    const paint = boardPaint(THEME)
    keepOutsOf(
      paint,
      Array.from({ length: 30 }, (_, index) =>
        keepOut({ shape: "circle", radius: index + 1 })
      ) as unknown as Circuit
    )
    expect(paint.keepOuts.top.count.value).toBe(24)
    expect(zones(paint, "top").at(-1)).toEqual([1, 2, 24, -1])
    expect(paint.keepOuts.bottom.count.value).toBe(0)
  })

  it("forgets the last board's, for another board or for none", () => {
    const paint = boardPaint(THEME)
    keepOutsOf(paint, [
      keepOut({ shape: "circle", radius: 3, layers: ["top", "bottom"] }),
      keepOut({ shape: "circle", radius: 4 }),
    ] as unknown as Circuit)
    keepOutsOf(paint, [
      keepOut({ shape: "circle", radius: 5 }),
    ] as unknown as Circuit)
    expect(zones(paint, "top")).toEqual([[1, 2, 5, -1]])
    expect(zones(paint, "bottom")).toEqual([])
    keepOutsOf(paint, null)
    expect(paint.keepOuts.top.count.value).toBe(0)
  })
})
