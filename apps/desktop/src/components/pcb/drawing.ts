// A circuit board drawn as tscircuit draws one (circuit-to-svg): as it is made, its
// copper, pads and print on the board; or as its schematic. Each is drawn on the ground
// PCB mode has, in the dark or the light. This is loaded only when a board is first
// drawn: it is a good deal of the app.
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"

import type { Circuit } from "./boards"
import { DRAWN, GROUND } from "./ground"

/**
 * The schematic's colours on the dark ground. tscircuit draws one as KiCad does, for
 * paper: on the dark, its lines and words are given lighter colours of the same kinds.
 */
const RED = "rgb(236, 128, 116)"
const TEAL = "rgb(118, 206, 194)"
const WORDS = "rgb(214, 226, 217)"
const DARK_SCHEMATIC = {
  component_outline: RED,
  component_body: "rgb(30, 38, 32)",
  pin: RED,
  pin_number: RED,
  pin_name: TEAL,
  reference: TEAL,
  value: WORDS,
  wire: "rgb(86, 214, 118)",
  junction: "rgb(86, 214, 118)",
  label_local: WORDS,
  label_global: RED,
  label_hier: "rgb(222, 190, 110)",
  net_name: "rgb(150, 162, 153)",
  no_connect: RED,
  label_background: "rgba(10, 14, 11, 0.6)",
  aux_items: WORDS,
  table: "rgb(150, 162, 153)",
  note: "rgb(140, 170, 255)",
  fields: "rgb(206, 140, 220)",
}
/** And the one colour tscircuit writes into a chip's name for itself, whatever it is told. */
const CHIP_NAME = "#006464"

/** A board drawn the one way or the other, on the ground it is seen on. */
export function drawingOf(
  circuit: Circuit,
  as: "pcb" | "schematic",
  dark: boolean
): string {
  const ground = dark ? GROUND.dark : GROUND.light
  const elements = circuit as unknown as AnyCircuitElement[]
  if (as === "pcb")
    return convertCircuitJsonToPcbSvg(elements, {
      ...DRAWN,
      backgroundColor: ground,
      matchBoardAspectRatio: true,
      showSolderMask: true,
      // a board with nothing routed yet has what is to be joined drawn straight across
      // (drawn over a routed one, the lines would be there whether routed or not)
      shouldDrawRatsNest: !elements.some(
        (element) => element.type === "pcb_trace"
      ),
      colorOverrides: {
        // a hole is a hole: the ground shows through it
        drill: ground,
        ...(dark ? {} : { boardOutline: "rgba(10, 46, 24, 0.55)" }),
      },
    })
  const drawn = convertCircuitJsonToSchematicSvg(elements, {
    ...DRAWN,
    colorOverrides: {
      schematic: { background: ground, ...(dark ? DARK_SCHEMATIC : {}) },
    },
  })
  return dark ? drawn.replaceAll(CHIP_NAME, TEAL) : drawn
}
