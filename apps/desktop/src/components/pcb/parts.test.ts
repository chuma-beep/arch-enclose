import { describe, expect, it } from "vitest"

import { countSaid, partsOf } from "./parts"

/** A part as tscircuit has it on a board, with its footprint and the room it takes up. */
const part = (
  id: string,
  name: string,
  fields: Record<string, unknown>,
  footprint = "0603"
) => [
  { type: "source_component", source_component_id: id, name, ...fields },
  {
    type: "cad_component",
    source_component_id: id,
    footprinter_string: footprint,
  },
  {
    type: "pcb_component",
    source_component_id: id,
    width: 1.6,
    height: 0.8,
  },
]

describe("partsOf", () => {
  it("has each kind of part once, with all the names it has on the board", () => {
    const circuit = [
      ...part("a", "C10", {
        ftype: "simple_capacitor",
        display_capacitance: "100nF",
      }),
      ...part("b", "C2", {
        ftype: "simple_capacitor",
        display_capacitance: "100nF",
      }),
      ...part("c", "C1", {
        ftype: "simple_capacitor",
        display_capacitance: "6.8pF",
      }),
      // the same value in another footprint is another part
      ...part(
        "d",
        "C3",
        { ftype: "simple_capacitor", display_capacitance: "100nF" },
        "0805"
      ),
    ]
    const parts = partsOf(circuit)
    expect(parts.map((one) => [one.title, one.names])).toEqual([
      ["6.8pF capacitor", ["C1"]],
      // (C2 before C10, as they are counted)
      ["100nF capacitor", ["C2", "C10"]],
      ["100nF capacitor", ["C3"]],
    ])
    expect(parts[0].size).toEqual([1.6, 0.8])
  })

  it("calls a part by its maker's number where it has no value", () => {
    const parts = partsOf([
      ...part("u", "U1", {
        ftype: "simple_chip",
        manufacturer_part_number: "ATTINY1614-SSNR",
      }),
      ...part("j", "J2", { ftype: "simple_connector" }),
      ...part("y", "Y1", { ftype: "simple_crystal", frequency: 32768 }),
      ...part("s", "S1", { ftype: "simple_slide_switch" }),
    ])
    expect(parts.map((one) => one.title)).toEqual([
      "connector",
      "slide switch",
      "ATTINY1614-SSNR",
      "32.768 kHz crystal",
    ])
  })
})

describe("countSaid", () => {
  it("says how many there are, and their names, or the name of the one", () => {
    expect(
      countSaid({ key: "", title: "", names: ["R3", "R4"], size: null })
    ).toBe("×2 · R3, R4")
    expect(countSaid({ key: "", title: "", names: ["U1"], size: null })).toBe(
      "U1"
    )
  })
})
