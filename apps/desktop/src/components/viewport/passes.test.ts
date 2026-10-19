import { describe, expect, it } from "vitest"

import { passSize } from "./passes"

describe("passSize", () => {
  it("draws the picture as the view is, on a screen of one pixel to a pixel", () => {
    expect(passSize(1200, 800, 1)).toEqual([1200, 800])
    expect(passSize(1800, 1200, 1.5)).toEqual([1800, 1200])
  })

  it("draws it at one and a half to a pixel on a finer screen", () => {
    expect(passSize(2400, 1600, 2)).toEqual([1800, 1200])
    expect(passSize(3000, 2000, 2.5)).toEqual([1800, 1200])
  })

  it("never draws it at nothing", () => {
    expect(passSize(1, 1, 2)).toEqual([1, 1])
  })
})
