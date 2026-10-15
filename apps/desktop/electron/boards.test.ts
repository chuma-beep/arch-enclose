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
        trouble: null,
      },
    ])
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
