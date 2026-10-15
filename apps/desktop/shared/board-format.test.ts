import { describe, expect, it } from "vitest"

import { calledFrom, readBoard, sizeOf } from "./board-format"

describe("readBoard", () => {
  it("reads what a board is called, and whether it is finished", () => {
    expect(readBoard({ name: "  Main   board ", finished: false })).toEqual({
      name: "Main board",
      finished: false,
    })
  })

  it("takes a board that says nothing of it to be finished, and to have no name", () => {
    expect(readBoard({})).toEqual({ name: null, finished: true })
  })

  it("says what is wrong with one that does not read", () => {
    expect(() => readBoard([])).toThrow("is an object")
    expect(() => readBoard({ finished: "no" })).toThrow('"finished"')
  })
})

describe("calledFrom", () => {
  it("is a board's file's name, as it would be written", () => {
    expect(calledFrom("main")).toBe("Main")
    expect(calledFrom("power-board")).toBe("Power board")
  })
})

describe("sizeOf", () => {
  it("is a rectangular board's own size", () => {
    expect(
      sizeOf([
        { type: "source_board" },
        { type: "pcb_board", center: { x: 3, y: 0 }, width: 40, height: 25 },
      ])
    ).toEqual([40, 25])
  })

  it("is its outline's, where it has one", () => {
    const outline = [
      { x: -10, y: -5 },
      { x: 12, y: -5 },
      { x: 0, y: 9 },
    ]
    expect(
      sizeOf([{ type: "pcb_board", center: { x: 0, y: 0 }, outline }])
    ).toEqual([22, 14])
  })

  it("is nothing, where there is no board", () => {
    expect(sizeOf([{ type: "pcb_trace" }])).toBeNull()
    expect(sizeOf({})).toBeNull()
  })
})
