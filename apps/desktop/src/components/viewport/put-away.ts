// When the section's handle is put away, and when it comes back. It goes once the cut is
// where it was wanted (dragged there and let go of, or a click on nothing), for as long
// as the cut stays there. A cut chosen afresh brings it back: even one that is where the
// cut already was, as Reset cut is after nothing has moved it, or the key of the axis it
// is already across. So the cuts chosen afresh are counted, and the handle is put away
// at a count as well as at a cut.
import * as React from "react"

import type { Vec3 } from "@shared/api"
import type { Turn } from "@/lib/orient"

/** Where a cut is: through which point, and turned which way. */
export type Cut = { position: Vec3; turn: Turn }
/** Where the handle was put away, and how many cuts had been chosen afresh by then. */
export type PutAway = { cut: Cut; chosen: number }

let chosen = 0
const hearing = new Set<() => void>()

/** Say that a cut has been chosen afresh (sectionAcross does, for every cut it makes). */
export function cutChosen() {
  chosen++
  for (const heard of hearing) heard()
}

/** How many cuts have been chosen afresh, so far. */
export const cutsChosen = () => chosen

function hear(heard: () => void) {
  hearing.add(heard)
  return () => void hearing.delete(heard)
}

/** How many cuts have been chosen afresh, in a component: it is drawn again at each. */
export const useCutsChosen = () =>
  React.useSyncExternalStore(hear, cutsChosen, cutsChosen)

/** The same cut: through the same point, and turned the same way. */
export const sameCut = (a: Cut, b: Cut) =>
  a.position.every((v, i) => v === b.position[i]) &&
  a.turn.every((v, i) => v === b.turn[i])

/** Whether the handle is still away: the cut is where it was left, and none was chosen since. */
export const stillAway = (away: PutAway | null, cut: Cut, now: number) =>
  away !== null && away.chosen === now && sameCut(away.cut, cut)
