import { describe, expect, it } from "vitest"

import { stepsOf, type BoardJob } from "./making"

const job = (reached: BoardJob["reached"]): BoardJob => ({
  board: "main",
  name: "Main board",
  since: 1000,
  reached,
})

describe("stepsOf", () => {
  it("has the first step under way, and the rest to come, before it is built", () => {
    expect(stepsOf(job({}))).toEqual([
      { name: "Parts placed", from: 1000, to: null, state: "now" },
      { name: "Joined", from: null, to: null, state: "later" },
      { name: "Routing", from: null, to: null, state: "later" },
      { name: "Checking", from: null, to: null, state: "later" },
    ])
  })

  it("begins each step when the one before it is done", () => {
    expect(stepsOf(job({ placed: 4000, joined: 6000 }))).toEqual([
      { name: "Parts placed", from: 1000, to: 4000, state: "done" },
      { name: "Joined", from: 4000, to: 6000, state: "done" },
      { name: "Routing", from: 6000, to: null, state: "now" },
      { name: "Checking", from: null, to: null, state: "later" },
    ])
  })

  it("is checking from when it was routed until it is over", () => {
    const steps = stepsOf(job({ placed: 4000, joined: 6000, routed: 9000 }))
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "now",
    ])
    expect(steps[3]).toMatchObject({ from: 9000, to: null })
  })
})
