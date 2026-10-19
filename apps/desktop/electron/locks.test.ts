import { describe, expect, it } from "vitest"

import { Locks } from "./locks"

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe("Locks", () => {
  it("does what is asked of a project one at a time, in the order it was asked", async () => {
    const locks = new Locks()
    const done: string[] = []
    const slow = locks.hold("p1", async () => {
      await tick()
      done.push("first")
    })
    const quick = locks.hold("p1", async () => {
      done.push("second")
      return 2
    })
    expect(await quick).toBe(2)
    await slow
    expect(done).toEqual(["first", "second"])
  })

  it("goes on after something that failed, which fails for its own asker alone", async () => {
    const locks = new Locks()
    const failed = locks.hold("p1", async () => {
      throw new Error("no room")
    })
    const after = locks.hold("p1", async () => "went")
    await expect(failed).rejects.toThrow("no room")
    expect(await after).toBe("went")
  })

  it("keeps projects from waiting on each other", async () => {
    const locks = new Locks()
    let release = () => {}
    const held = locks.hold(
      "p1",
      () => new Promise<void>((resolve) => (release = resolve))
    )
    expect(await locks.hold("p2", async () => "free")).toBe("free")
    release()
    await held
  })
})
