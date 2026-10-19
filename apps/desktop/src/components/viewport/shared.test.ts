import { describe, expect, it, vi } from "vitest"

import { sharing } from "./shared"

/** Long enough for what was let go of to be done with. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("sharing", () => {
  it("makes a thing once, however many take it", async () => {
    const shared = sharing<{ n: number }>(() => {})
    const make = vi.fn(async () => ({ n: 1 }))
    const [a, b] = await Promise.all([
      shared.take("a", make),
      shared.take("a", make),
    ])
    expect(make).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(shared.size).toBe(1)
  })

  it("frees a thing once the last that took it lets go, and not before", async () => {
    const free = vi.fn()
    const shared = sharing<string>(free)
    await shared.take("a", async () => "mesh")
    await shared.take("a", async () => "another")
    shared.give("a")
    await settled()
    expect(free).not.toHaveBeenCalled()
    shared.give("a")
    await settled()
    expect(free).toHaveBeenCalledExactlyOnceWith("mesh")
    expect(shared.size).toBe(0)
  })

  it("makes a thing again once it has been freed", async () => {
    const shared = sharing<number>(() => {})
    await shared.take("a", async () => 1)
    shared.give("a")
    expect(await shared.take("a", async () => 2)).toBe(2)
  })

  it("keeps nothing of what could not be made", async () => {
    const free = vi.fn()
    const shared = sharing<number>(free)
    await expect(
      shared.take("a", async () => {
        throw new Error("broken")
      })
    ).rejects.toThrow("broken")
    await settled()
    expect(shared.size).toBe(0)
    expect(await shared.take("a", async () => 3)).toBe(3)
    expect(free).not.toHaveBeenCalled()
  })

  it("lets go of nothing it does not have", () => {
    const shared = sharing<number>(() => {})
    expect(() => shared.give("nothing")).not.toThrow()
  })
})
