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
  sizeOf,
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
      const files = [boardFileOf(id), builtOf(id).circuit, builtOf(id).model]
      const stamps = files.map((file) => {
        const stat = statOf(path.join(folder, file))
        return stat ? `${stat.mtimeMs}:${stat.size}` : "-"
      })
      return [id, ...stamps].join(":")
    })
    .join("|")
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
    const { circuit, model } = builtOf(id)
    const built = statOf(path.join(folder, circuit))
    let size: [number, number] | null = null
    if (built && built.size <= MOST_CIRCUIT_BYTES)
      try {
        size = sizeOf(
          JSON.parse(fs.readFileSync(path.join(folder, circuit), "utf8"))
        )
      } catch {
        // half written, or not tscircuit's: it is shown when it is built again
      }
    return {
      id,
      name,
      finished,
      built: built ? Math.round(built.mtimeMs) : null,
      size,
      model: statOf(path.join(folder, model)) !== null,
      trouble,
    }
  })
}

/** The folder in a project's pcb/ that what is built of its boards goes in. */
export const builtFolder = (root: string) =>
  path.join(root, BOARD_FOLDER, BUILT_FOLDER)
