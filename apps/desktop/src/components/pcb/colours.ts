// The colours a circuit board is drawn in, in 3D in PCB mode: the app's own, in place of
// those tscircuit gives it. Its 3D file has each side of the board as a picture, of its
// mask, copper and lettering in tscircuit's colours, and its edge as one colour: each of
// those is drawn in the app's colour for it instead.
import * as THREE from "three"

/**
 * The materials tscircuit gives the board itself, as against what is on it: its top and
 * its bottom, each a picture of its copper, mask and lettering, and its edge.
 */
export const BOARD_ITSELF = /^(TopMaterial|BottomMaterial|GreenSideMaterial)/

/** Each colour tscircuit draws a board's sides in, and the app's in its place. */
const COLOURS: readonly (readonly [theirs: string, ours: string])[] = [
  // the mask
  ["#0f4f30", "#073d19"],
  // the mask over copper: traces and pours
  ["#17613b", "#137a2b"],
  // bare copper: pads
  ["#ffe066", "#e1cf4d"],
  // the lettering
  ["#ffffff", "#ffffff"],
  // keep-outs, hatched
  ["#ff6b6b", "#ffffff"],
  // holes, shaded darker over the rest
  ["#000000", "#000000"],
]
/** The board's edge, which has no picture on it: the lighter of the greens. */
const EDGE = "#137a2b"

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
    const vec3 ours[${COLOURS.length}] = vec3[](${COLOURS.map(([, ours]) => glsl(ours)).join(", ")});
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
          drawn = mix(ours[i], ours[j], t);
        }
      }
    }
    diffuseColor.rgb = drawn;
  }`

/**
 * Have one of the board's own materials drawn in the app's colours (see `BOARD_ITSELF`):
 * its picture recoloured as it is drawn, or its edge given the app's colour. What else
 * is done to it as it is drawn is done as well, after this.
 */
export function inOurColours(material: THREE.Material) {
  if (
    !BOARD_ITSELF.test(material.name) ||
    !(material instanceof THREE.MeshStandardMaterial)
  )
    return
  if (!material.map) {
    material.color.set(EDGE)
    return
  }
  const before = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>${RECOLOURING}`
    )
    before(shader, renderer)
  }
  const key = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `board in our colours+${key()}`
}
