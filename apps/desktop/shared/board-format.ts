// A project's circuit boards: the boards that go in the thing that is modelled, each
// designed with tscircuit. They are kept in a folder at the top of the project, a board
// to a file of its own (`main.circuit.tsx`), and built there by the app's
// kit/board.mjs, into a folder beside them: the board as tscircuit has it, which is what
// it is drawn from, and the board in 3D. Beside each there can be a small file that says
// what the board is called, and whether it is finished or only roughed out so far.
//
// kit/pcb.md says how one is written and built, and is what an agent reads before it
// makes one.

/** The folder at the top of a project that its boards are in. */
export const BOARD_FOLDER = "pcb"

/** The folder in it that what is built of them goes in. */
export const BUILT_FOLDER = "build"

/** What a board's own file is called: lower case, and nothing an address cannot hold. */
export const BOARD_SOURCE = /^([a-z0-9][a-z0-9-]*)\.circuit\.tsx$/

/** What the file is called that says what a board is called, and how far along it is. */
export const boardFileOf = (id: string) => `${id}.board.json`

/**
 * What is built of a board, within the folder its file is in: the board as tscircuit
 * has it, and the board in 3D.
 */
export const builtOf = (id: string) => ({
  circuit: `${BUILT_FOLDER}/${id}.circuit.json`,
  model: `${BUILT_FOLDER}/${id}.glb`,
})

/** The most boards a project has shown, and the most that is read of what says what one is. */
export const MOST_BOARDS = 24
export const MOST_BOARD_BYTES = 20_000
/** The most that is read of a board as tscircuit has it, for how big it is, in bytes. */
export const MOST_CIRCUIT_BYTES = 50_000_000

/** What a board's own small file says of it. */
export type BoardSaid = {
  /** what it is called, as the list of boards has it */
  name: string | null
  /** whether it is a board to be made: false of one that is only roughed out so far */
  finished: boolean
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * What a board's own small file says of it: or what is wrong with it, said so that
 * whoever wrote it can put it right.
 */
export function readBoard(written: unknown): BoardSaid {
  if (!isObject(written)) throw new Error("A board's file is an object.")
  const name =
    typeof written.name === "string" && written.name.trim()
      ? written.name.trim().replace(/\s+/g, " ")
      : null
  if (written.finished !== undefined && typeof written.finished !== "boolean")
    throw new Error('"finished" is true or false.')
  return { name, finished: written.finished !== false }
}

/**
 * What a board is called where nothing says: its file's name, as it would be written.
 * "main" is Main, "power-board" Power board.
 */
export const calledFrom = (id: string) =>
  id.charAt(0).toUpperCase() + id.slice(1).replace(/-+/g, " ")

/**
 * How big a board is, mm across and from top to bottom, from the board as tscircuit has
 * it: the board's own size, or its outline's, where it is not a rectangle; and of
 * several, as tscircuit lays a panel out, all of them. Null where it has none.
 */
export function sizeOf(circuit: unknown): [number, number] | null {
  if (!Array.isArray(circuit)) return null
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const take = (x: unknown, y: unknown) => {
    if (typeof x !== "number" || typeof y !== "number") return
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (const element of circuit) {
    if (!isObject(element) || element.type !== "pcb_board") continue
    if (Array.isArray(element.outline) && element.outline.length > 2) {
      for (const point of element.outline)
        if (isObject(point)) take(point.x, point.y)
      continue
    }
    const center = isObject(element.center) ? element.center : null
    const { width, height } = element
    if (!center || typeof width !== "number" || typeof height !== "number")
      continue
    if (typeof center.x !== "number" || typeof center.y !== "number") continue
    take(center.x - width / 2, center.y - height / 2)
    take(center.x + width / 2, center.y + height / 2)
  }
  if (x1 < x0 || y1 < y0) return null
  return [x1 - x0, y1 - y0]
}
