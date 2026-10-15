import { describe, expect, it } from "vitest"

import { calledFrom, readBoard, sizeOf, unsourcedOf } from "./board-format"

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

describe("unsourcedOf", () => {
  /** A part as tscircuit has it: what it is, and where it is placed. */
  const part = (name: string, source: Record<string, unknown> = {}) => [
    { type: "source_component", source_component_id: name, name, ...source },
    {
      type: "pcb_component",
      pcb_component_id: `pcb-${name}`,
      source_component_id: name,
    },
  ]

  it("is every part the BOM has no JLCPCB number for, in order", () => {
    expect(
      unsourcedOf([
        ...part("U10", { ftype: "simple_chip", manufacturer_part_number: "X" }),
        ...part("U2", { ftype: "simple_chip", manufacturer_part_number: "Y" }),
        ...part("R1", {
          ftype: "simple_resistor",
          supplier_part_numbers: { jlcpcb: ["C25744"] },
        }),
        ...part("C1", {
          ftype: "simple_capacitor",
          supplier_part_numbers: { lcsc: ["C14663"] },
        }),
        ...part("L1", {
          ftype: "simple_inductor",
          supplier_part_numbers: { jlcpcb: [" "], digikey: ["445-1"] },
        }),
      ])
    ).toEqual(["L1", "U2", "U10"])
  })

  it("leaves out what the BOM leaves out: test points, parts not placed, bare holes", () => {
    expect(
      unsourcedOf([
        ...part("TP1", { ftype: "simple_test_point" }),
        { type: "source_component", source_component_id: "D1", name: "D1" },
        {
          type: "pcb_component",
          pcb_component_id: "pcb-D1",
          source_component_id: "D1",
          do_not_place: true,
        },
        ...part("H1", { ftype: "simple_chip" }),
        { type: "pcb_hole", pcb_component_id: "pcb-H1" },
      ])
    ).toEqual([])
  })

  it("has a hole with a model of its own, or pads, as a part", () => {
    expect(
      unsourcedOf([
        ...part("H1", { ftype: "simple_chip" }),
        { type: "pcb_plated_hole", pcb_component_id: "pcb-H1" },
        {
          type: "cad_component",
          pcb_component_id: "pcb-H1",
          model_step_url: "https://example.com/h.step",
        },
        ...part("J1", { ftype: "simple_chip" }),
        { type: "pcb_smtpad", pcb_component_id: "pcb-J1" },
      ])
    ).toEqual(["H1", "J1"])
  })

  it("is nothing of what is not a board", () => {
    expect(unsourcedOf({})).toEqual([])
    expect(unsourcedOf([null, 3])).toEqual([])
  })
})
