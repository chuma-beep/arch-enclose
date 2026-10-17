import { describe, expect, it } from "vitest"

import { stepsOf, type BoardJob } from "./making"

const job = (steps: BoardJob["steps"]): BoardJob => ({
  board: "main",
  name: "Main board",
  since: 1000,
  steps,
})

describe("stepsOf", () => {
  it("has the first step under way, and the rest to come, as it begins", () => {
    expect(stepsOf(job([{ step: "placing", at: 1000 }]))).toEqual([
      { name: "Placing parts", from: 1000, to: null, state: "now" },
      { name: "Connecting", from: null, to: null, state: "later" },
      { name: "Routing", from: null, to: null, state: "later" },
      { name: "Checking", from: null, to: null, state: "later" },
    ])
  })

  it("has the steps before the one it is at done, each until the next was begun", () => {
    expect(
      stepsOf(
        job([
          { step: "placing", at: 1000 },
          { step: "connecting", at: 4000 },
          { step: "routing", at: 6000 },
        ])
      )
    ).toEqual([
      { name: "Placing parts", from: 1000, to: 4000, state: "done" },
      { name: "Connecting", from: 4000, to: 6000, state: "done" },
      { name: "Routing", from: 6000, to: null, state: "now" },
      { name: "Checking", from: null, to: null, state: "later" },
    ])
  })

  it("has the steps after one it went back to still to come, and each done as it was last", () => {
    const steps = stepsOf(
      job([
        { step: "placing", at: 1000 },
        { step: "connecting", at: 4000 },
        { step: "routing", at: 6000 },
        { step: "checking", at: 9000 },
        { step: "connecting", at: 10_000 },
        { step: "routing", at: 11_000 },
      ])
    )
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "now",
      "later",
    ])
    expect(steps[1]).toMatchObject({ from: 10_000, to: 11_000 })
    expect(steps[2]).toMatchObject({ from: 11_000, to: null })
  })

  it("has a step it went past without being at done, with no time", () => {
    expect(
      stepsOf(
        job([
          { step: "placing", at: 1000 },
          { step: "routing", at: 4000 },
        ])
      )[1]
    ).toEqual({ name: "Connecting", from: null, to: null, state: "done" })
  })
})
