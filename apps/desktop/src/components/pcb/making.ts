// The steps a circuit board made in detail in the background is made in, as the window
// shows them (see kit/pcb.md, and `madeOf` in shared/board-format.ts).
import type { ConversationSummary } from "@shared/api"

/** A board being made in detail in the background, as a conversation says. */
export type BoardJob = NonNullable<ConversationSummary["job"]>

/**
 * A step a detailed board is made in, as it is shown: when it was begun on, and when it
 * was done (ms), each null until it was; and so whether it is done, the one under way,
 * or still to come.
 */
export type BoardStepShown = {
  name: string
  from: number | null
  to: number | null
  state: "done" | "now" | "later"
}

/**
 * The steps a board made in detail in the background is made in (kit/pcb.md), as far
 * as it has got with them: its parts placed, joined, routed, and then checked, for as
 * long as it is still being made after that. Each is begun when the one before it is
 * done, the first when the making was.
 */
export function stepsOf(job: BoardJob): BoardStepShown[] {
  const { placed, joined, routed } = job.reached
  const steps: [string, number | undefined, number | undefined][] = [
    ["Parts placed", job.since, placed],
    ["Joined", placed, joined],
    ["Routing", joined, routed],
    ["Checking", routed, undefined],
  ]
  return steps.map(([name, from = null, to = null]) => ({
    name,
    from,
    to,
    state: to !== null ? "done" : from !== null ? "now" : "later",
  }))
}
