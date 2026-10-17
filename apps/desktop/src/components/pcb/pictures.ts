// A picture of each of a project's circuit boards, for the list of them: the board in 3D,
// as tscircuit built it, from its front right corner and from above, in the app's own
// colours (see `inOurGreen`). They are drawn off screen, by a renderer of their own that
// is thrown away when it is done.
import * as React from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import type { BoardSummary } from "@shared/api"
import { PALETTE } from "@shared/palette"
import { frame, stage } from "@/components/viewport/thumbnails"
import { boardUrl } from "./boards"

/** Pixels a side: twice the size they are shown at, for sharp screens. */
const PICTURE = 400
/** How much of its picture a board fills. */
const FILL = 0.9

/**
 * Where a board is seen from, as the way from it to the eye. tscircuit builds a board
 * in 3D lying flat, its top up the Y axis, and with its own X and Y as -X and Z: this
 * is its front right corner, from above, as a part is pictured from.
 */
export const BOARD_FROM = new THREE.Vector3(-0.5, 0.62, -0.6).normalize()

/** Everything a loaded board holds that is to be given back. */
export function disposeBoard(board: THREE.Object3D) {
  board.traverse((thing) => {
    if (!(thing instanceof THREE.Mesh)) return
    thing.geometry.dispose()
    const materials = Array.isArray(thing.material)
      ? thing.material
      : [thing.material]
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    }
  })
}

/** A board in 3D, loaded from where it was built. */
export async function loadBoard(url: string): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().loadAsync(url)
  return gltf.scene
}

/**
 * The materials tscircuit gives the board itself, as against what is on it: its top and
 * its bottom, each a picture of its copper, mask and lettering, and its edge.
 */
const BOARD_ITSELF = /^(TopMaterial|BottomMaterial|GreenSideMaterial)/

/**
 * The colour of what is on a board, in its picture: near black, short of it so that the
 * light still shows each part's shape, and dark against the board's light green.
 */
const ON_BOARD = "#262626"
/** The colour the board itself is drawn in: the green the app draws a part in. */
const BOARD_GREEN = new THREE.Color(PALETTE.green)
/**
 * How light tscircuit's own green is, which most of a board is (its mask): of white, as
 * light is counted before it is shown. Each of the board's colours is drawn as much
 * lighter or darker than the app's green as it is than that.
 */
const THEIR_GREEN = 0.059
/**
 * How many times lighter than tscircuit's green a colour is when it is drawn as dark as
 * what is on the board: its pads and its lettering, which are drawn as part of it.
 */
const MARKED_AT = 4

/**
 * A board as the list of them pictures it, as the app draws a part: the board itself in
 * the app's green, and what is on it near black, its parts and the pads and lettering
 * drawn on it alike. The mask is that green, and the rest of the board darker as it was
 * darker than tscircuit's own green, or the lighter it was the nearer what is on it:
 * copper a little darker green, pads and lettering near black.
 */
function inOurGreen(board: THREE.Object3D) {
  const glsl = (colour: THREE.Color) =>
    `vec3(${colour
      .toArray()
      .map((value) => value.toFixed(4))
      .join(", ")})`
  const green = glsl(BOARD_GREEN)
  const marked = glsl(new THREE.Color(ON_BOARD))
  board.traverse((thing) => {
    if (!(thing instanceof THREE.Mesh)) return
    const materials: THREE.Material[] = Array.isArray(thing.material)
      ? thing.material
      : [thing.material]
    const painted = materials.map((material) => {
      if (
        !BOARD_ITSELF.test(material.name) ||
        !(material instanceof THREE.MeshStandardMaterial)
      ) {
        material.dispose()
        return new THREE.MeshStandardMaterial({
          color: ON_BOARD,
          roughness: 0.7,
          metalness: 0,
        })
      }
      // its edge has no picture on it, only a colour: the app's green, a little darker
      if (!material.map) {
        material.color.copy(BOARD_GREEN).multiplyScalar(0.8)
        return material
      }
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float lighter = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / ${THEIR_GREEN.toFixed(3)};
          diffuseColor.rgb = lighter <= 1.0
            ? ${green} * lighter
            : mix(${green}, ${marked}, min(1.0, (lighter - 1.0) / ${(MARKED_AT - 1).toFixed(1)}));`
        )
      }
      material.customProgramCacheKey = () => "board in the app's green"
      return material
    })
    thing.material = Array.isArray(thing.material) ? painted : painted[0]
  })
}

/** The pictures drawn, by board and by when it was built: drawn again only when it is. */
const pictured = new Map<string, string>()
const pictureOf = (projectId: string, board: BoardSummary) =>
  `${projectId}:${board.id}:${board.built}`

/** A picture of each of some boards, handed over as a data URL as each is drawn. */
async function draw(
  projectId: string,
  boards: BoardSummary[],
  each: (board: BoardSummary, url: string) => void,
  stopped: () => boolean
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(2)
  renderer.setSize(PICTURE / 2, PICTURE / 2, false)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const { scene } = stage()
  const camera = new THREE.OrthographicCamera()
  try {
    for (const board of boards) {
      const loaded = await loadBoard(boardUrl(projectId, board, "model")).catch(
        () => null
      )
      if (stopped()) {
        if (loaded) disposeBoard(loaded)
        break
      }
      if (!loaded) continue
      inOurGreen(loaded)
      scene.add(loaded)
      loaded.updateMatrixWorld(true)
      frame(camera, new THREE.Box3().setFromObject(loaded), BOARD_FROM, FILL)
      renderer.render(scene, camera)
      each(board, renderer.domElement.toDataURL("image/png"))
      scene.remove(loaded)
      disposeBoard(loaded)
    }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

/**
 * The pictures of a project's boards, by what each is known by, filling in as they are
 * drawn. A board is drawn once for each time it is built, and not at all until it has
 * been built in 3D.
 */
export function useBoardPictures(
  projectId: string,
  boards: BoardSummary[]
): Record<string, string> {
  // (counts the pictures drawn since this was up, to show each as it is drawn)
  const [, setDrawn] = React.useState(0)
  React.useEffect(() => {
    const wanted = boards.filter(
      (board) =>
        board.model &&
        board.built !== null &&
        !pictured.has(pictureOf(projectId, board))
    )
    if (wanted.length === 0) return
    let stopped = false
    void draw(
      projectId,
      wanted,
      (board, url) => {
        pictured.set(pictureOf(projectId, board), url)
        if (!stopped) setDrawn((count) => count + 1)
      },
      () => stopped
    )
    return () => {
      stopped = true
    }
  }, [projectId, boards])
  return Object.fromEntries(
    boards.flatMap((board) => {
      const url = pictured.get(pictureOf(projectId, board))
      return url ? [[board.id, url]] : []
    })
  )
}
