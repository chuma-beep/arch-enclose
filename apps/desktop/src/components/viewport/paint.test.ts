import * as THREE from "three"
import { describe, expect, it } from "vitest"

import type { Part } from "@/lib/model"
import { drawnIn } from "@/lib/palette"
import { PALETTE } from "@shared/palette"
import { finish, skinColour } from "./paint"

/**
 * A part of the second group, as plain as one comes, with what is said of it here; in a
 * model with a circuit board in it, if `boards`.
 */
const part = (said: Partial<Part> = {}, boards = false) => ({
  part: {
    id: "lid",
    label: "Lid",
    group: "case",
    file: "lid.glb",
    edges: null,
    color: null,
    paint: "all" as const,
    matrix: null,
    explode: [0, 0, 0] as [number, number, number],
    metal: false,
    clear: false,
    mesh: false,
    board: null,
    ...said,
  },
  turn: 1,
  boards,
})
/** A skin that came with this colour in its file, or with none. */
const skin = (color: string | null = null) => ({
  color: color ? new THREE.Color(color) : null,
})
const hex = (color: THREE.Color) => `#${color.getHexString()}`

describe("skinColour", () => {
  it("is the colour that falls to the part's group, where none is given", () => {
    expect(hex(skinColour(part(), skin(), true))).toBe(drawnIn(null, 1))
  })

  it("is the colour the model names", () => {
    expect(hex(skinColour(part({ color: "blue" }), skin(), true))).toBe(
      PALETTE.blue
    )
  })

  it("is the colour the user gave the part, over whatever the model says", () => {
    expect(
      hex(skinColour(part({ color: "blue", metal: true }), skin(), true, "red"))
    ).toBe(PALETTE.red)
  })

  it("keeps the colours in the file only where the part is painted bare", () => {
    const blue = skin("#0000ff")
    // all of the part wears the model's colour, whatever its file has
    expect(hex(skinColour(part({ color: "red" }), blue, true))).toBe(
      PALETTE.red
    )
    // bare, a face the file coloured is drawn as the nearest of the app's colours
    expect(
      hex(skinColour(part({ color: "red", paint: "bare" }), blue, true))
    ).toBe(drawnIn("#0000ff", 1))
    // and a face it left uncoloured wears the model's
    expect(
      hex(skinColour(part({ color: "red", paint: "bare" }), skin(), true))
    ).toBe(PALETTE.red)
  })

  it("draws what is clear with no colour, unless it is given one of its own", () => {
    expect(hex(skinColour(part({ clear: true }), skin(), true))).toBe("#ffffff")
    expect(
      hex(skinColour(part({ clear: true, color: "cyan" }), skin(), true))
    ).toBe(PALETTE.cyan)
  })

  it("draws metal in the colour of its metal, and not one of the app's", () => {
    expect(hex(skinColour(part({ metal: true }), skin(), true))).toBe("#aeb2b9")
    expect(
      hex(skinColour(part({ metal: true, color: "#b08d57" }), skin(), true))
    ).toBe("#b08d57")
  })

  it("has metal that is nearly black go steel in the dark, where it would vanish", () => {
    const black = part({ metal: true, color: "#1c1c1c" })
    expect(hex(skinColour(black, skin(), true))).toBe("#aab0b8")
    expect(hex(skinColour(black, skin(), false))).toBe("#1c1c1c")
  })

  it("draws a circuit board in green, whatever the model names", () => {
    const board = part({ board: "main", color: "blue" }, true)
    expect(hex(skinColour(board, skin(), true))).toBe(PALETTE.green)
    // what its file colours is what is on it, in its own colours
    expect(
      hex(
        skinColour(
          part({ board: "main", paint: "bare" }, true),
          skin("#0000ff"),
          true
        )
      )
    ).toBe(drawnIn("#0000ff", 1))
    expect(hex(skinColour(board, skin(), true, "red"))).toBe(PALETTE.red)
  })

  it("keeps green for the boards, in a model with one", () => {
    expect(hex(skinColour(part({ color: "green" }, true), skin(), true))).toBe(
      PALETTE.indigo
    )
    expect(hex(skinColour({ ...part({}, true), turn: 2 }, skin(), true))).toBe(
      PALETTE.indigo
    )
    expect(hex(skinColour(part({ color: "green" }), skin(), true))).toBe(
      PALETTE.green
    )
    // what the user gives a part is what it is drawn in
    expect(hex(skinColour(part({}, true), skin(), true, "green"))).toBe(
      PALETTE.green
    )
  })
})

describe("finish", () => {
  it("has metal take the light as metal does, and anything else as plastic", () => {
    const metal = finish(part({ metal: true }))
    const plastic = finish(part())
    expect(metal.metalness).toBeGreaterThan(plastic.metalness)
    expect(metal.roughness).toBeLessThan(plastic.roughness)
  })
})
