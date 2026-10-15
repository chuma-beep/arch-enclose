// A project's circuit boards, as the window has them: the list of them, read again
// whenever one is written or built, and what is built of each, loaded from the project's
// folder (see shared/board-format.ts).
import * as React from "react"

import {
  BOARD_HOST,
  MODEL_SCHEME,
  type BoardSummary,
  type Project,
} from "@shared/api"
import { builtOf } from "@shared/board-format"

/** Stable while a project has no boards. */
const NONE: BoardSummary[] = []

/**
 * Where one of a board's built files is had from: as it was last built, and loaded again
 * whenever it is built again.
 */
export const boardUrl = (
  projectId: string,
  board: BoardSummary,
  file: keyof ReturnType<typeof builtOf>
) =>
  `${MODEL_SCHEME}://${projectId}.${BOARD_HOST}/${builtOf(board.id)[file]}?r=${board.built ?? 0}`

/**
 * A project's boards, in the order of their files: none if it has none. Null until they
 * have been read for it, and of no project. Read again whenever one is written or built.
 */
export function useBoards(project: Project | null): BoardSummary[] | null {
  const [read, setRead] = React.useState<{
    of: string
    boards: BoardSummary[]
  } | null>(null)
  const id = project?.id ?? null
  const revision = project?.boards ?? null
  React.useEffect(() => {
    if (id === null) return
    let over = false
    void (
      revision === null ? Promise.resolve(NONE) : window.cad.boards.read(id)
    ).then((boards) => {
      // (those it had stay up until the ones it has now are read)
      if (!over) setRead({ of: id, boards })
    })
    return () => {
      over = true
    }
  }, [id, revision])
  return id !== null && read?.of === id ? read.boards : null
}

/** A board as tscircuit has it: a list of what is in it, each a plain object. */
export type Circuit = Record<string, unknown>[]

/** The boards as tscircuit has them, by where each was had from: the last few. */
const circuits = new Map<string, Promise<Circuit>>()
const KEPT = 6

/** A board as tscircuit has it, as it was last built: loaded once for each time it is. */
function loadCircuit(url: string): Promise<Circuit> {
  const had = circuits.get(url)
  if (had) return had
  const loading = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("The board has not been built.")
      return response.json() as Promise<unknown>
    })
    .then((read) => {
      if (!Array.isArray(read)) throw new Error("The board does not read.")
      return read as Circuit
    })
  circuits.set(url, loading)
  for (const old of [...circuits.keys()].slice(0, -KEPT)) circuits.delete(old)
  // it would not load: the next asking tries again
  loading.catch(() => {
    if (circuits.get(url) === loading) circuits.delete(url)
  })
  return loading
}

/**
 * A board as tscircuit has it, for as long as it is wanted: null until it is loaded, and
 * while there is nothing built of it. While it is built again, the one before stays.
 */
export function useCircuit(
  projectId: string,
  board: BoardSummary | null
): { circuit: Circuit | null; trouble: string | null } {
  const url =
    board && board.built !== null ? boardUrl(projectId, board, "circuit") : null
  const [had, setHad] = React.useState<{
    of: string
    circuit: Circuit | null
    trouble: string | null
  } | null>(null)
  React.useEffect(() => {
    if (!url) return
    let over = false
    void loadCircuit(url).then(
      (circuit) => {
        if (!over) setHad({ of: url, circuit, trouble: null })
      },
      (error: unknown) => {
        if (!over)
          setHad({
            of: url,
            circuit: null,
            trouble: error instanceof Error ? error.message : String(error),
          })
      }
    )
    return () => {
      over = true
    }
  }, [url])
  if (!url) return { circuit: null, trouble: null }
  // the board built before, while it is built again: but not another board's
  const same = had && had.of.split("?")[0] === url.split("?")[0]
  return same
    ? { circuit: had.circuit, trouble: had.of === url ? had.trouble : null }
    : { circuit: null, trouble: null }
}

/** How big a board is, as it is said under its name: "40 × 25 mm". */
export function sizeSaid(board: BoardSummary): string | null {
  if (!board.size) return null
  const round = (mm: number) => String(Math.round(mm * 10) / 10)
  return `${round(board.size[0])} × ${round(board.size[1])} mm`
}
