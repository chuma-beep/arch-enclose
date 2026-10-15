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
 * has it, the board in 3D, as the view shows it and as a STEP file, and the files a
 * board house makes it from; and, while it is being built, how far that has got.
 */
export const builtOf = (id: string) => ({
  circuit: `${BUILT_FOLDER}/${id}.circuit.json`,
  model: `${BUILT_FOLDER}/${id}.glb`,
  step: `${BUILT_FOLDER}/${id}.step`,
  gerbers: `${BUILT_FOLDER}/${id}.gerbers.zip`,
  building: `${BUILT_FOLDER}/${id}.building.json`,
  // a quick look at it, unrouted, made by the app as its file is written (see previews.ts)
  preview: `${BUILT_FOLDER}/${id}.preview.json`,
})

/** How long a build can go without saying how far it has got and still be at it, ms. */
export const QUIET_BUILD_MS = 3 * 60_000

/**
 * How far a board's build has got, from what kit/board.mjs writes while it builds: or
 * nothing, where that says nothing a build would, or has said nothing for so long that
 * the build must be over without having cleared it away. `now` is the time, in ms.
 */
export function readBuilding(written: unknown, now: number): Building | null {
  if (!isObject(written)) return null
  const { since, at, stage } = written
  if (typeof since !== "number" || typeof at !== "number") return null
  if (stage !== "building" && stage !== "routing" && stage !== "finishing")
    return null
  if (now - at > QUIET_BUILD_MS) return null
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null
  const progress = number(written.progress)
  return {
    since,
    stage,
    progress: progress === null ? null : Math.min(1, Math.max(0, progress)),
    phase: number(written.phase),
    phases: number(written.phases),
    step: typeof written.step === "string" ? written.step : null,
  }
}

/** How far a board's build has got (see `readBuilding`). */
export type Building = {
  /** when it began, in ms */
  since: number
  /** what it is at: laying the board out, routing it, or writing what was made */
  stage: "building" | "routing" | "finishing"
  /** how far the routing is, 0 to 1, while it is routing; null where there is no telling */
  progress: number | null
  /** which stage of the routing, of how many, where the board is routed in several */
  phase: number | null
  phases: number | null
  /** what the router is at, as it names it ("topologyPlanningSolver") */
  step: string | null
}

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

/** The 3D models a part can have, any of which makes it more than a bare hole. */
const MODELS = [
  "model_obj_url",
  "model_stl_url",
  "model_3mf_url",
  "model_gltf_url",
  "model_glb_url",
  "model_step_url",
  "model_wrl_url",
  "model_jscad",
]

/**
 * The parts on a board, by name (U1, L1), that the BOM in its Gerbers' zip lists with no
 * JLCPCB part number: which JLCPCB cannot assemble from that BOM. tscircuit gives one
 * by itself to many resistors and capacitors, and to the rest only where the board says
 * (`supplierPartNumbers`). It goes by the rule tscircuit's BOM is written by: every part
 * that is placed, but for test points and holes with nothing else to them. kit/board.mjs
 * goes by the same rule, to tell the agent that builds the board.
 */
export function unsourcedOf(circuit: unknown): string[] {
  if (!Array.isArray(circuit)) return []
  const elements = circuit.filter(isObject)
  const sources = new Map(
    elements
      .filter((one) => one.type === "source_component")
      .map((one) => [one.source_component_id, one])
  )
  const numbered = (numbers: unknown) =>
    Array.isArray(numbers) &&
    numbers.some((one) => typeof one === "string" && one.trim() !== "")
  const unsourced: string[] = []
  for (const placed of elements) {
    if (placed.type !== "pcb_component" || placed.do_not_place) continue
    const source = sources.get(placed.source_component_id)
    if (!source || source.ftype === "simple_test_point") continue
    const suppliers = isObject(source.supplier_part_numbers)
      ? source.supplier_part_numbers
      : {}
    if (numbered(suppliers.jlcpcb) || numbered(suppliers.lcsc)) continue
    const mine = (one: Record<string, unknown>) =>
      one.pcb_component_id === placed.pcb_component_id
    const bareHole =
      source.ftype === "simple_chip" &&
      !(
        typeof source.manufacturer_part_number === "string" &&
        source.manufacturer_part_number.trim()
      ) &&
      !Object.values(suppliers).some(numbered) &&
      !elements.some(
        (one) =>
          one.type === "cad_component" &&
          mine(one) &&
          MODELS.some((model) => one[model])
      ) &&
      (() => {
        const shape = elements.filter(
          (one) =>
            (one.type === "pcb_plated_hole" ||
              one.type === "pcb_hole" ||
              one.type === "pcb_smtpad") &&
            mine(one)
        )
        return shape.length === 1 && shape[0].type !== "pcb_smtpad"
      })()
    if (bareHole) continue
    const name =
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim()
        : String(placed.pcb_component_id)
    if (!unsourced.includes(name)) unsourced.push(name)
  }
  return unsourced.sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
}
