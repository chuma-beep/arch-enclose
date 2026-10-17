// A circuit board drawn as tscircuit draws one (circuit-to-svg): as it is made, its
// copper, pads and print on the board; or as its schematic. Each is drawn on the ground
// PCB mode has, in the dark or the light. This is loaded only when a board is first
// drawn: it is a good deal of the app.
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
  type PcbSvgOptions,
} from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"

import type { Circuit } from "./boards"
import { DRAWN } from "./ground"

/**
 * The schematic's colours. tscircuit draws one as KiCad does, for paper, its parts and
 * pins in red: here they are drawn in one ink, white on the dark ground and near black
 * on the light, with the wires green and the names in a second colour, as they were.
 */
const TEAL = "rgb(118, 206, 194)"
const WORDS = "rgb(214, 226, 217)"
const INK = { dark: "rgb(232, 238, 234)", light: "rgb(22, 30, 24)" }
const inked = (ink: string) => ({
  component_outline: ink,
  pin: ink,
  pin_number: ink,
  label_global: ink,
  no_connect: ink,
})
const SCHEMATIC = {
  dark: {
    ...inked(INK.dark),
    component_body: "rgb(30, 38, 32)",
    pin_name: TEAL,
    reference: TEAL,
    value: WORDS,
    wire: "rgb(86, 214, 118)",
    junction: "rgb(86, 214, 118)",
    label_local: WORDS,
    label_hier: "rgb(222, 190, 110)",
    net_name: "rgb(150, 162, 153)",
    label_background: "rgba(10, 14, 11, 0.6)",
    aux_items: WORDS,
    table: "rgb(150, 162, 153)",
    note: "rgb(140, 170, 255)",
    fields: "rgb(206, 140, 220)",
  },
  light: {
    ...inked(INK.light),
    component_body: "rgb(255, 255, 255)",
  },
}
/**
 * And the colours tscircuit writes into some of it for itself, whatever it is told: a
 * chip's name; and the reds of the numbers of some pins, and of some of its symbols (a
 * crystal's, say), which are all the parts' ink here.
 */
const CHIP_NAME = "#006464"
const REDS = [
  "rgb(169, 0, 0)",
  "rgba(132, 0, 0)",
  "rgb(132, 0, 0)",
  "#880000",
  "#8D2323",
]

/** The colour a board's edge is drawn in: KiCad's grey, which on the light is too pale. */
const edgeOf = (dark: boolean) =>
  dark ? "rgb(208, 210, 205)" : "rgba(20, 24, 22, 0.6)"

/**
 * The colour of what is printed on a board, its lettering and the outlines of its
 * parts, on either side: white, as it is printed, and not KiCad's colour for each side;
 * near black on the light ground, where white would not be seen.
 */
const printOf = (dark: boolean) => (dark ? "#ffffff" : "#1c1c1c")

/**
 * The holes through the board that are no part of a pad, its mounting holes, drawn with
 * an edge, as its own edge is: a hole is the ground showing through, and with nothing
 * drawn round it, on the ground, it would not be seen at all. (A pad's hole has the
 * pad's copper round it.) The line is as thin at any zoom.
 */
const holesEdged = (markup: string, dark: boolean) =>
  markup.replaceAll(
    'data-type="pcb_hole"',
    `stroke="${edgeOf(dark)}" stroke-width="1" vector-effect="non-scaling-stroke" data-type="pcb_hole"`
  )

/**
 * How the board is drawn as it is made: as KiCad draws one, on the ground it is seen on.
 */
function pcbLook(
  elements: AnyCircuitElement[],
  dark: boolean,
  ground: string
): PcbSvgOptions {
  return {
    ...DRAWN,
    backgroundColor: ground,
    matchBoardAspectRatio: true,
    // drawn as KiCad draws a board: its copper in the colours of its layers, and not
    // under the green of its mask, as it is made (which the 3D shows)
    showSolderMask: false,
    // a board with nothing routed yet has what is to be joined drawn straight across
    // (drawn over a routed one, the lines would be there whether routed or not)
    shouldDrawRatsNest: !elements.some(
      (element) => element.type === "pcb_trace"
    ),
    colorOverrides: {
      // a hole is a hole: the ground shows through it
      drill: ground,
      // and its edge in KiCad's grey for one, which on the light ground is too pale
      boardOutline: edgeOf(dark),
      silkscreen: { top: printOf(dark), bottom: printOf(dark) },
    },
  }
}

/**
 * A drawing of the bottom of a board turned over, as the board is when it is turned
 * over to be looked at from under: left is right, and its print reads as it should.
 */
function turnedOver(markup: string): string {
  const width =
    Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(markup)?.[1]) || DRAWN.width
  return markup
    .replace(
      /(<svg[^>]*>)/,
      `$1<g transform="translate(${width} 0) scale(-1 1)">`
    )
    .replace(/<\/svg>\s*$/, "</g></svg>")
}

/** A board drawn the one way or the other, on the ground it is seen on. */
export function drawingOf(
  circuit: Circuit,
  as: "pcb" | "schematic",
  dark: boolean,
  /** the colour it is drawn on */
  ground: string,
  /** which side of the board is drawn, where it is drawn as it is made */
  side: "top" | "bottom" = "top"
): string {
  const elements = circuit as unknown as AnyCircuitElement[]
  if (as === "pcb" && side === "bottom")
    return turnedOver(
      holesEdged(
        convertCircuitJsonToPcbSvg(elements, {
          ...pcbLook(elements, dark, ground),
          // what is on the bottom, and what goes through: seen from under the board
          layer: "bottom",
        }),
        dark
      )
    )
  if (as === "pcb")
    return holesEdged(
      convertCircuitJsonToPcbSvg(elements, pcbLook(elements, dark, ground)),
      dark
    )
  const theme = dark ? "dark" : "light"
  const drawn = convertCircuitJsonToSchematicSvg(elements, {
    ...DRAWN,
    colorOverrides: {
      schematic: { background: ground, ...SCHEMATIC[theme] },
    },
  })
  const inkedAll = REDS.reduce(
    (svg, red) => svg.replaceAll(red, INK[theme]),
    drawn
  )
  return dark ? inkedAll.replaceAll(CHIP_NAME, TEAL) : inkedAll
}
