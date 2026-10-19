import { describe, expect, it } from "vitest"

import { rateWhen } from "./watched"

describe("rateWhen", () => {
  it("draws as often as asked in a window in front", () => {
    expect(rateWhen("focused", 20)).toBe(20)
  })

  it("draws half as often in a window behind another", () => {
    expect(rateWhen("shown", 20)).toBe(10)
  })

  it("draws nothing in a window that cannot be seen", () => {
    expect(rateWhen("hidden", 20)).toBe(0)
  })
})
