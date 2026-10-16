// What is done to a model by hand in the app, kept so that Cmd+Z can take it back: the
// colours given to parts, how the parts are put into groups, and which are out of
// sight. (What Claude does to a project's files is kept by the app's own process, a
// turn at a time: see electron/changes.ts. Cmd+Z takes back whichever was done last,
// and a turn only at a second press.)

import type { Undoable, Undone } from "@shared/api"
import type { PaletteName } from "@shared/palette"
import type { Arrangement } from "./arrange"
import { elapsed } from "./time"

/** The colours parts have been given, by part: those that have been given one. */
export type Colours = Record<string, PaletteName>

/** What some parts have for a colour, by part: null where one has the model's own. */
type Had = Record<string, PaletteName | null>

/** Parts given a colour, or their own back: what they had, what they have, and when. */
export type Recolour = {
  kind: "colour"
  at: number
  /** when it was taken back, while it is */
  undoneAt: number | null
  before: Had
  after: Had
}

/**
 * The parts put into groups another way, or a group called something else: how they
 * were arranged before, how after, and what was done, in words that follow "Undid".
 */
export type Rearranged = {
  kind: "arrangement"
  at: number
  undoneAt: number | null
  before: Arrangement
  after: Arrangement
  said: string
}

/**
 * Parts put out of sight by hand, or brought back: which went, and which came back.
 * Taken back, it does the opposite to those parts alone, whatever has been done since
 * to the rest, or to them by the way (a part that is picked out is brought back).
 */
export type Rehidden = {
  kind: "hidden"
  at: number
  undoneAt: number | null
  hid: string[]
  shown: string[]
}

/** One thing done by hand. */
export type Change = Recolour | Rearranged | Rehidden

/** What has been done, the latest last; and what of it is taken back, the latest last. */
export type History = { done: Change[]; undone: Change[] }

/** Stable for a project nothing has been done to. */
export const NO_HISTORY: History = { done: [], undone: [] }

/** How much is kept: more than anyone goes back through. */
const KEPT = 200

/**
 * What giving some parts a colour (or, with none, their own back) changes: nothing, and
 * so null, where each of them has it already.
 */
export function recolour(
  colours: Colours,
  partIds: string[],
  colour: PaletteName | null,
  at: number
): Recolour | null {
  const changed = partIds.filter((id) => (colours[id] ?? null) !== colour)
  if (changed.length === 0) return null
  return {
    kind: "colour",
    at,
    undoneAt: null,
    before: Object.fromEntries(changed.map((id) => [id, colours[id] ?? null])),
    after: Object.fromEntries(changed.map((id) => [id, colour])),
  }
}

/** The colours with some parts put to what they had on one side of a change. */
export function coloured(colours: Colours, had: Had): Colours {
  const next = Object.fromEntries(
    Object.entries(colours).filter(([id]) => !(id in had))
  )
  for (const [id, colour] of Object.entries(had)) if (colour) next[id] = colour
  return next
}

/** The parts arranged another way: how they were, how they are, and what was done. */
export function rearranged(
  before: Arrangement,
  after: Arrangement,
  said: string,
  at: number
): Rearranged {
  return { kind: "arrangement", at, undoneAt: null, before, after, said }
}

/**
 * What putting the parts that are out of sight to others changes: the ones that go, and
 * the ones that come back. Null where it changes nothing.
 */
export function rehidden(
  hidden: string[],
  next: string[],
  at: number
): Rehidden | null {
  const hid = next.filter((id) => !hidden.includes(id))
  const shown = hidden.filter((id) => !next.includes(id))
  if (hid.length === 0 && shown.length === 0) return null
  return { kind: "hidden", at, undoneAt: null, hid, shown }
}

/** The parts out of sight, with such a change taken back (`back`), or done again. */
export function hiddenWith(
  hidden: string[],
  change: Rehidden,
  back: boolean
): string[] {
  const [going, coming] = back
    ? [change.hid, change.shown]
    : [change.shown, change.hid]
  return [
    ...new Set([...hidden.filter((id) => !going.includes(id)), ...coming]),
  ]
}

/** Such a change in words that follow "Undid" and "Redid": "hiding 2 parts". */
export function hidingSaid(change: Rehidden): string {
  const parts = (count: number) => (count === 1 ? "a part" : `${count} parts`)
  return change.hid.length > 0
    ? `hiding ${parts(change.hid.length)}`
    : `showing ${parts(change.shown.length)}`
}

/** Something was done: it is the latest, and what was taken back cannot be put back over it. */
export function record(history: History, change: Change): History {
  return { done: [...history.done, change].slice(-KEPT), undone: [] }
}

/** The latest thing done, taken back at a given time: null if nothing was done. */
export function back(
  history: History,
  at: number
): { history: History; change: Change } | null {
  const change = history.done.at(-1)
  if (!change) return null
  return {
    change,
    history: {
      done: history.done.slice(0, -1),
      undone: [...history.undone, { ...change, undoneAt: at }],
    },
  }
}

/** What was last taken back, put back: null if nothing is taken back. */
export function forth(
  history: History
): { history: History; change: Change } | null {
  const change = history.undone.at(-1)
  if (!change) return null
  return {
    change,
    history: {
      done: [...history.done, { ...change, undoneAt: null }],
      undone: history.undone.slice(0, -1),
    },
  }
}

/**
 * Which of two things was done later, and so is the one to take back first: what was
 * done by hand (`mine`), or what Claude did (`claudes`). Each is when it was, or null
 * if there is none. Null if there is neither.
 */
export function later(
  mine: number | null,
  claudes: number | null
): "mine" | "claudes" | null {
  if (mine === null) return claudes === null ? null : "claudes"
  return claudes === null || mine >= claudes ? "mine" : "claudes"
}

/**
 * What was asked for in a turn, cut short at a word to be said in a line with more:
 * without the marks of its pictures, which are no words, nor the stop it may end in,
 * since the line has its own.
 */
export function briefly(asked: string, most = 36): string {
  const what = asked
    .replace(/\s*\[Image \d+\]/g, "")
    .replace(/[\s.,;:!?…]+$/, "")
  if (what.length <= most) return what
  const cut = what.slice(0, most + 1)
  const word = cut.lastIndexOf(" ")
  return `${(word > most / 2 ? cut.slice(0, word) : cut.slice(0, most)).replace(/[\s.,;:]+$/, "")}…`
}

/**
 * What a first Cmd+Z says where it would take back what an agent did in a turn, which
 * only a second press does: how much work that was, where that is known, and what the
 * turn was asked.
 */
export function askedAgain(turn: Undoable, mac: boolean): string {
  const work =
    turn.took === null
      ? "the agent's last turn"
      : `${elapsed(turn.took)} of the agent's work`
  return `Press ${mac ? "⌘Z" : "Ctrl Z"} again to undo ${work}: “${briefly(turn.what)}”`
}

/**
 * What the app says of taking back something Claude did, or putting it back, once it
 * has tried to: null where there was nothing to do, which needs no saying. What was
 * taken back says how it is put back.
 */
export function saidOf(
  way: "undo" | "redo",
  outcome: Undone,
  mac: boolean
): string | null {
  if (outcome.ok)
    return way === "undo"
      ? `Undid “${briefly(outcome.what)}”. ${mac ? "⇧⌘Z" : "Shift Ctrl Z"} puts it back`
      : `Redid “${briefly(outcome.what)}”`
  const done = way === "undo" ? "undone" : "redone"
  if (outcome.why === "busy")
    return `Claude is at work: nothing can be ${done} until it is through`
  if (outcome.why === "board")
    return `A board is being made: nothing can be ${done} until it is done`
  if (outcome.why === "changed") {
    const [first, ...rest] = outcome.files
    const more = rest.length > 0 ? ` and ${rest.length} more` : ""
    return `Not ${done}: ${first}${more} changed since`
  }
  return null
}
