// A project's circuit boards, as the app's own process has them: found in the project's
// folder, with what has been built of each (see shared/board-format.ts). They are built
// there by an agent, with the app's kit/board.mjs: the app only reads them.
import fs from "node:fs"
import path from "node:path"

import type { BoardSummary } from "../shared/api"
import {
  BOARD_FOLDER,
  BOARD_SOURCE,
  BOARD_STEPS,
  boardFileOf,
  BUILT_FOLDER,
  builtOf,
  calledFrom,
  madeOf,
  MOST_BOARD_BYTES,
  MOST_BOARDS,
  MOST_CIRCUIT_BYTES,
  readBoard,
  readBuilding,
  sizeOf,
  unsourcedOf,
  type BoardStep,
  type Building,
  type MadeOf,
} from "../shared/board-format"

/** The boards in a folder's pcb/, by what each is known by, in the order of their files. */
export function findBoards(root: string): string[] {
  let names: string[]
  try {
    names = fs.readdirSync(path.join(root, BOARD_FOLDER))
  } catch {
    return []
  }
  return names
    .map((name) => BOARD_SOURCE.exec(name)?.[1])
    .filter((id): id is string => id !== undefined)
    .sort()
    .slice(0, MOST_BOARDS)
}

/** When a file was last written (ms), and how big it is: null where there is none. */
function statOf(file: string): fs.Stats | null {
  try {
    return fs.statSync(file)
  } catch {
    return null
  }
}

/**
 * How a folder's boards stand, in a line: what has been written and built of each, and
 * when. It changes whenever any of that does, and is what they are watched by.
 */
export function boardsWritten(root: string): string {
  const folder = path.join(root, BOARD_FOLDER)
  return findBoards(root)
    .map((id) => {
      const { circuit, model, building, preview } = builtOf(id)
      const files = [
        `${id}.circuit.tsx`,
        boardFileOf(id),
        circuit,
        model,
        building,
        preview,
      ]
      const stamps = files.map((file) => {
        const stat = statOf(path.join(folder, file))
        return stat ? `${stat.mtimeMs}:${stat.size}` : "-"
      })
      return [id, ...stamps].join(":")
    })
    .join("|")
}

/**
 * How big a built board is, as `sizeOf` has it, the parts its BOM has no JLCPCB number
 * for (`unsourcedOf`), and what it has on it (`madeOf`): read once for each time it is
 * built, since the boards are read again as often as a build says how far it has got.
 */
type Read = { size: [number, number] | null; unsourced: string[]; made: MadeOf }
const reads = new Map<string, { at: number; read: Read }>()
function readAt(file: string, stat: fs.Stats): Read {
  const had = reads.get(file)
  if (had?.at === stat.mtimeMs) return had.read
  let read: Read = { size: null, unsourced: [], made: madeOf(null) }
  if (stat.size <= MOST_CIRCUIT_BYTES)
    try {
      const circuit: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
      read = {
        size: sizeOf(circuit),
        unsourced: unsourcedOf(circuit),
        made: madeOf(circuit),
      }
    } catch {
      // half written, or not tscircuit's: it is shown when it is built again
    }
  reads.set(file, { at: stat.mtimeMs, read })
  return read
}

/** How far a board's build has got, where it is being built (see kit/board.mjs). */
function buildingAt(file: string): Building | null {
  try {
    return readBuilding(JSON.parse(fs.readFileSync(file, "utf8")), Date.now())
  } catch {
    return null
  }
}

/** A folder's boards as the list of them has it, in the order of their files. */
export function boardsIn(root: string): BoardSummary[] {
  const folder = path.join(root, BOARD_FOLDER)
  return findBoards(root).map((id): BoardSummary => {
    let name = calledFrom(id)
    let finished = true
    let trouble: string | null = null
    const said = path.join(folder, boardFileOf(id))
    const told = statOf(said)
    if (told)
      try {
        if (told.size > MOST_BOARD_BYTES)
          throw new Error("The file is too long to say what a board is.")
        const board = readBoard(JSON.parse(fs.readFileSync(said, "utf8")))
        name = board.name ?? name
        finished = board.finished
      } catch (error) {
        trouble = error instanceof Error ? error.message : String(error)
      }
    const files = builtOf(id)
    const built = statOf(path.join(folder, files.circuit))
    const there = (file: string) => statOf(path.join(folder, file)) !== null
    const preview = statOf(path.join(folder, files.preview))
    const written = statOf(path.join(folder, `${id}.circuit.tsx`))
    const read = built
      ? readAt(path.join(folder, files.circuit), built)
      : { size: null, unsourced: [] }
    return {
      id,
      name,
      finished,
      built: built ? Math.round(built.mtimeMs) : null,
      size: read.size,
      model: there(files.model),
      step: there(files.step),
      gerbers: there(files.gerbers),
      outdated: !!built && !!written && written.mtimeMs > built.mtimeMs,
      unsourced: read.unsourced,
      building: buildingAt(path.join(folder, files.building)),
      preview:
        preview && (!built || preview.mtimeMs > built.mtimeMs)
          ? Math.round(preview.mtimeMs)
          : null,
      trouble,
    }
  })
}

/** The folder in a project's pcb/ that what is built of its boards goes in. */
export const builtFolder = (root: string) =>
  path.join(root, BOARD_FOLDER, BUILT_FOLDER)

/**
 * A board as it was last built: when (ms), and what it has on it. Null while it has not
 * been built.
 */
function lastBuilt(
  root: string,
  id: string
): { at: number; made: MadeOf } | null {
  const file = path.join(root, BOARD_FOLDER, builtOf(id).circuit)
  const built = statOf(file)
  return built ? { at: built.mtimeMs, made: readAt(file, built).made } : null
}

/**
 * A board an agent is making, followed as it goes: each time it is built, how far it has
 * got (see `madeOf`). It is looked at after each thing the agent does, which is when a
 * build of it would be over, and once more at the end.
 */
export class Following {
  private readonly root: string
  private readonly id: string
  /** when it was last built (ms), as it was last looked at: null while it is not */
  private last: number | null
  /** it had been built before it was begun on: a rough board, made in detail from */
  readonly rough: boolean
  /** how many times it has been built since */
  builds = 0
  /** what it has on it, as it was last built: null while it has not been */
  made: MadeOf | null
  /** when it was first built as far as each step (ms) */
  readonly reached: Partial<Record<BoardStep, number>> = {}

  constructor(root: string, id: string) {
    this.root = root
    this.id = id
    const built = lastBuilt(root, id)
    this.last = built?.at ?? null
    this.rough = built !== null
    this.made = built?.made ?? null
  }

  /** Whether it has got to a step it had not got to before. */
  look(): boolean {
    const built = lastBuilt(this.root, this.id)
    if (!built || built.at === this.last) return false
    this.last = built.at
    this.builds += 1
    this.made = built.made
    const { step } = built.made
    if (!step) return false
    let further = false
    // (a build that got further than the step after the last one got to both at once)
    for (const one of BOARD_STEPS.slice(0, BOARD_STEPS.indexOf(step) + 1))
      if (this.reached[one] === undefined) {
        this.reached[one] = built.at
        further = true
      }
    return further
  }
}
