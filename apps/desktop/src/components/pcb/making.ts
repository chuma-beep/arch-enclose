// The steps a circuit board made in detail in the background is made in, as the window
// shows them (see kit/pcb.md, and `madeOf` in shared/board-format.ts).
import type { ConversationSummary } from "@shared/api"
import { MAKING_STEPS, type MakingStep } from "@shared/board-format"

/** A board being made in detail in the background, as a conversation says. */
export type BoardJob = NonNullable<ConversationSummary["job"]>

/**
 * A step a detailed board is made in, as it is shown: when it was begun on, and when it
 * was done (ms), each null until it was (or where it was gone past); and so whether it
 * is done, the one under way, or still to come.
 */
export type BoardStepShown = {
  name: string
  from: number | null
  to: number | null
  state: "done" | "now" | "later"
}

/** What each step is called where it is shown. */
const NAMES: Record<MakingStep, string> = {
  placing: "Placing parts",
  connecting: "Connecting",
  routing: "Routing",
  checking: "Checking",
}

/**
 * The steps a board made in detail in the background is made in (kit/pcb.md), as far
 * as it has got with them: its parts placed, connected, routed, and then checked. The one
 * it is at is under way, those before it done, and those after it still to come: so
 * where it has gone back to an earlier one, the ones after that are to come again. A
 * step done is shown as it was done the last time, and one it went past without being
 * at has no time.
 */
export function stepsOf(job: BoardJob): BoardStepShown[] {
  const gone = job.steps
  const at = gone[gone.length - 1]
  const now = MAKING_STEPS.indexOf(at?.step ?? "placing")
  return MAKING_STEPS.map((step, index): BoardStepShown => {
    const name = NAMES[step]
    if (index > now) return { name, from: null, to: null, state: "later" }
    if (index === now)
      return { name, from: at?.at ?? job.since, to: null, state: "now" }
    const last = gone.findLastIndex((one) => one.step === step)
    return last < 0
      ? { name, from: null, to: null, state: "done" }
      : { name, from: gone[last].at, to: gone[last + 1].at, state: "done" }
  })
}
