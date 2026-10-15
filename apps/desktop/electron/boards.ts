// A project's circuit boards, as the app's own process has them: found in the project's
// folder, with what has been built of each (see shared/board-format.ts). They are built
// there by an agent, with the app's kit/board.mjs: the app only reads them.
import fs from "node:fs"
import path from "node:path"

import type { BoardSummary } from "../shared/api"
import {
  BOARD_FOLDER,
  BOARD_SOURCE,
  boardFileOf,
  BUILT_FOLDER,
  builtOf,
  calledFrom,
  MOST_BOARD_BYTES,
  MOST_BOARDS,
  MOST_CIRCUIT_BYTES,
  readBoard,
  readBuilding,
  sizeOf,
  type Building,
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
      const files = [boardFileOf(id), circuit, model, building, preview]
      const stamps = files.map((file) => {
        const stat = statOf(path.join(folder, file))
        return stat ? `${stat.mtimeMs}:${stat.size}` : "-"
      })
      return [id, ...stamps].join(":")
    })
    .join("|")
}

/**
 * How big a built board is, as `sizeOf` has it: read once for each time it is built,
 * since the boards are read again as often as a build says how far it has got.
 */
const sizes = new Map<string, { at: number; size: [number, number] | null }>()
function sizeAt(file: string, stat: fs.Stats): [number, number] | null {
  const had = sizes.get(file)
  if (had?.at === stat.mtimeMs) return had.size
  let size: [number, number] | null = null
  if (stat.size <= MOST_CIRCUIT_BYTES)
    try {
      size = sizeOf(JSON.parse(fs.readFileSync(file, "utf8")))
    } catch {
      // half written, or not tscircuit's: it is shown when it is built again
    }
  sizes.set(file, { at: stat.mtimeMs, size })
  return size
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
    return {
      id,
      name,
      finished,
      built: built ? Math.round(built.mtimeMs) : null,
      size: built ? sizeAt(path.join(folder, files.circuit), built) : null,
      model: there(files.model),
      step: there(files.step),
      gerbers: there(files.gerbers),
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
