// The colours a circuit board is drawn in, in 3D in PCB mode: the app's own, as the theme
// the window is in has them, in place of those tscircuit gives it. Its 3D file has each
// side of the board as a picture, of its mask, copper and lettering in tscircuit's
// colours, and its edge as one colour: each of those is drawn in the app's colour for it
// instead, and drawn again in another as soon as the theme changes it. What is on the
// board is in its makers' colours, which are mostly greys: each grey is drawn in the
// theme's shade for greys as light, as much lighter or darker than that as it was.
import * as THREE from "three"

import type { PcbColours } from "@shared/theme-format"

/**
 * The materials tscircuit gives the board itself, as against what is on it: its top and
 * its bottom, each a picture of its copper, mask and lettering, and its edge.
 */
export const BOARD_ITSELF = /^(TopMaterial|BottomMaterial|GreenSideMaterial)/

/** What of the theme's colours a board in 3D is drawn in. */
type BoardColour = Extract<keyof PcbColours, `board-${string}`>

/**
 * Each colour tscircuit draws a board's sides in, and which of the app's is drawn in its
 * place: none, where it stays as it is.
 */
const COLOURS: readonly (readonly [
  theirs: string,
  ours: BoardColour | null,
])[] = [
  // the mask
  ["#0f4f30", "board-mask"],
  // the mask over copper: traces and pours
  ["#17613b", "board-traces"],
  // bare copper: pads
  ["#ffe066", "board-pads"],
  // the lettering
  ["#ffffff", "board-print"],
  // keep-outs, hatched: as the lettering
  ["#ff6b6b", "board-print"],
  // holes, shaded darker over the rest
  ["#000000", null],
]
/** The board's edge, which has no picture on it: the lighter of the greens. */
const EDGE: BoardColour = "board-traces"

/**
 * The shades of grey of what is on a board, from the lightest, each with the grey it is
 * when the theme gives none (as src/index.css has it), and how light a grey is to be
 * drawn in it: at least this much, of 255, at its lightest. Mid is chips' packages;
 * light, what is lighter (connectors, pins, shields); dark, what is darker (resistors,
 * headers' plastic).
 */
const SHADES: readonly (readonly [
  shade: Extract<keyof PcbColours, `components-${string}`>,
  own: string,
  from: number,
])[] = [
  ["components-light", "#e7e7e7", 190],
  ["components-mid", "#9c9c9c", 136],
  ["components-dark", "#737373", 0],
]
/** How far apart, of 255, a colour's channels can be for it still to be a grey. */
const GREY = 24

/**
 * What is on a board that is drawn in one of the theme's shades (see SHADES): which, and
 * how much lighter or darker its own grey is than that shade's own, channel by channel,
 * for it to be as much lighter or darker than the theme's. Null for what is not a grey:
 * an LED, gold, a capacitor's tan, which stay as they are.
 */
export type Shaded = {
  shade: (typeof SHADES)[number][0]
  share: THREE.Color
}

/** Which of the theme's shades a colour of what is on a board is drawn in, if any. */
export function shadedOf(colour: THREE.Color): Shaded | null {
  const seen = colour.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace)
  const [r, g, b] = [seen.r, seen.g, seen.b].map((channel) => channel * 255)
  const light = Math.max(r, g, b)
  if (light - Math.min(r, g, b) > GREY) return null
  const [shade, own] = SHADES.find(([, , from]) => light >= from)!
  const base = new THREE.Color(own)
  return {
    shade,
    share: new THREE.Color(
      colour.r / base.r,
      colour.g / base.g,
      colour.b / base.b
    ),
  }
}

/** The colour something on a board is drawn in, in the theme's shade for it. */
export const inShade = (
  { shade, share }: Shaded,
  theme: PcbColours,
  colour: THREE.Color
) =>
  colour
    .set(theme[shade])
    .multiply(share)
    .setRGB(Math.min(1, colour.r), Math.min(1, colour.g), Math.min(1, colour.b))

const glsl = (colour: string) =>
  `vec3(${new THREE.Color(colour)
    .toArray()
    .map((value) => value.toFixed(4))
    .join(", ")})`

/**
 * The shader's way from tscircuit's colours to the app's. Where two colours meet the
 * picture blends them, so each of its colours is taken as the nearest blend of two of
 * tscircuit's, and drawn as the same blend of the app's: the edges stay as smooth.
 */
const RECOLOURING = `
  {
    const vec3 theirs[${COLOURS.length}] = vec3[](${COLOURS.map(([theirs]) => glsl(theirs)).join(", ")});
    vec3 seen = diffuseColor.rgb;
    vec3 drawn = seen;
    float nearest = 1e9;
    for (int i = 0; i < ${COLOURS.length}; i++) {
      for (int j = i + 1; j < ${COLOURS.length}; j++) {
        vec3 along = theirs[j] - theirs[i];
        float t = clamp(dot(seen - theirs[i], along) / dot(along, along), 0.0, 1.0);
        float off = distance(seen, theirs[i] + along * t);
        if (off < nearest) {
          nearest = off;
          drawn = mix(boardColours[i], boardColours[j], t);
        }
      }
    }
    diffuseColor.rgb = drawn;
  }`

/**
 * The app's colours for one board, as its shaders have them: one for each of
 * tscircuit's (see COLOURS), and its edge's. Changed in place, the board is drawn in
 * the new ones the next time it is drawn.
 */
export type BoardPaint = {
  colours: { value: THREE.Color[] }
  edge: THREE.Color
}

/** The app's colours for a board, as the theme has them (see `BoardPaint`). */
export function boardPaint(theme: PcbColours): BoardPaint {
  const paint: BoardPaint = {
    colours: { value: COLOURS.map(() => new THREE.Color()) },
    edge: new THREE.Color(),
  }
  repaint(paint, theme)
  return paint
}

/** Have a board drawn in other colours of the theme's. */
export function repaint(paint: BoardPaint, theme: PcbColours) {
  COLOURS.forEach(([theirs, ours], index) =>
    paint.colours.value[index].set(ours ? theme[ours] : theirs)
  )
  paint.edge.set(theme[EDGE])
}

/**
 * Have one of the board's own materials drawn in the app's colours (see `BOARD_ITSELF`):
 * its picture recoloured as it is drawn, or (its "edge") given the app's colour for it,
 * which is then its own. What else is done to it as it is drawn is done as well, after
 * this. Null for any other material, which is left as it is.
 */
export function inOurColours(
  material: THREE.Material,
  paint: BoardPaint
): "picture" | "edge" | null {
  if (
    !BOARD_ITSELF.test(material.name) ||
    !(material instanceof THREE.MeshStandardMaterial)
  )
    return null
  if (!material.map) {
    material.color.copy(paint.edge)
    return "edge"
  }
  const before = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.boardColours = paint.colours
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 boardColours[${COLOURS.length}];\nvoid main() {`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>${RECOLOURING}`
      )
    before(shader, renderer)
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `board in our colours+${key()}`
  return "picture"
}
