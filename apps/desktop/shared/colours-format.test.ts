import { describe, expect, it } from "vitest"

import { coloursFile, readColours } from "./colours-format"

describe("readColours", () => {
  it("reads the palette's colours of the parts it names, and nothing else", () => {
    expect(
      readColours({
        dial: "blue",
        lid: "#ff0000",
        "": "red",
        case: "grey",
        foot: 3,
      })
    ).toEqual({ dial: "blue", case: "grey" })
    expect(
      readColours(JSON.parse('{"__proto__": "red", "knob": "constructor"}'))
    ).toEqual({})
  })

  it("reads nothing from what is no list of colours", () => {
    expect(readColours(null)).toEqual({})
    expect(readColours(["blue"])).toEqual({})
    expect(readColours("blue")).toEqual({})
  })
})

describe("coloursFile", () => {
  it("writes the parts in order, to be read back as they were", () => {
    const file = coloursFile({ lid: "red", dial: "blue" })
    expect(file).toBe('{\n  "dial": "blue",\n  "lid": "red"\n}\n')
    expect(readColours(JSON.parse(file))).toEqual({ dial: "blue", lid: "red" })
  })
})
