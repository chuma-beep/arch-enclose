import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { boardsIn, findBoards } from "./boards"
import { Projects } from "./projects"

let root: string
const write = (file: string, content: string) => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

beforeEach(() => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "enclose-test-"))
  )
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const BOARD = JSON.stringify([
  { type: "pcb_board", center: { x: 0, y: 0 }, width: 40, height: 25 },
])

describe("findBoards", () => {
  it("finds none in a folder that has no pcb/", () => {
    write("model.py", "")
    expect(findBoards(root)).toEqual([])
    expect(boardsIn(root)).toEqual([])
  })

  it("goes by the boards' own files, plainly named", () => {
    write("pcb/main.circuit.tsx", "")
    write("pcb/power-board.circuit.tsx", "")
    write("pcb/Main Board.circuit.tsx", "")
    write("pcb/notes.tsx", "")
    write("pcb/stray.board.json", "{}")
    expect(findBoards(root)).toEqual(["main", "power-board"])
  })
})

describe("boardsIn", () => {
  it("says what each is called, how far along it is, and what is built of it", () => {
    write("pcb/main.circuit.tsx", "")
    write("pcb/main.board.json", '{ "name": "Main board", "finished": false }')
    write("pcb/build/main.circuit.json", BOARD)
    write("pcb/build/main.glb", "")
    const [board] = boardsIn(root)
    expect(board).toMatchObject({
      id: "main",
      name: "Main board",
      finished: false,
      size: [40, 25],
      model: true,
      trouble: null,
    })
    expect(board.built).toBeGreaterThan(0)
  })

  it("has a board that is not built yet, or says nothing of itself, listed all the same", () => {
    write("pcb/power-board.circuit.tsx", "")
    expect(boardsIn(root)).toEqual([
      {
        id: "power-board",
        name: "Power board",
        finished: true,
        built: null,
        size: null,
        model: false,
        step: false,
        gerbers: false,
        building: null,
        preview: null,
        trouble: null,
      },
    ])
  })

  it("says how far a build has got, while one is under way and saying so", () => {
    write("pcb/main.circuit.tsx", "")
    const now = Date.now()
    write(
      "pcb/build/main.building.json",
      JSON.stringify({ since: now, at: now, stage: "routing", progress: 0.4 })
    )
    expect(boardsIn(root)[0].building).toMatchObject({
      stage: "routing",
      progress: 0.4,
    })
    // one that has said nothing for a long while is over, whatever it left behind
    write(
      "pcb/build/main.building.json",
      JSON.stringify({ since: 0, at: 0, stage: "routing" })
    )
    expect(boardsIn(root)[0].building).toBeNull()
  })

  it("has a quick look at a board as it is written, where that is newer than its build", () => {
    write("pcb/main.circuit.tsx", "")
    write("pcb/build/main.circuit.json", BOARD)
    write("pcb/build/main.preview.json", BOARD)
    const later = new Date(Date.now() + 5000)
    fs.utimesSync(path.join(root, "pcb/build/main.preview.json"), later, later)
    expect(boardsIn(root)[0].preview).toBe(Math.round(later.getTime()))
    // built since, it is the build that is shown
    const latest = new Date(Date.now() + 10_000)
    fs.utimesSync(
      path.join(root, "pcb/build/main.circuit.json"),
      latest,
      latest
    )
    expect(boardsIn(root)[0].preview).toBeNull()
  })

  it("says why what says what a board is did not read", () => {
    write("pcb/main.circuit.tsx", "")
    write("pcb/main.board.json", "{ not json")
    const [board] = boardsIn(root)
    expect(board.name).toBe("Main")
    expect(board.trouble).toBeTruthy()
  })
})

describe("a project's boards", () => {
  it("are known of from the first, and counted again when one is built", () => {
    write("model.py", "")
    const projects = new Projects(path.join(root, "projects.json"), () => {})
    const id = projects.add(root)
    const boards = () => projects.list(() => [])[0].boards
    expect(boards()).toBeNull()
    write("pcb/main.circuit.tsx", "")
    projects.refresh(id)
    const first = boards()
    expect(first).not.toBeNull()
    // looked at again with nothing written or built: it is as it was
    projects.refresh(id)
    expect(boards()).toBe(first)
    write("pcb/build/main.circuit.json", BOARD)
    projects.refresh(id)
    expect(boards()).toBe(first! + 1)
    projects.close()
  })
})
