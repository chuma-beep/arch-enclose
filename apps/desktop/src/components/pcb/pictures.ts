// A picture of each of a project's circuit boards, for the list of them: the board in 3D,
// as tscircuit built it, from its front right corner and from above, in the theme's
// colours for a board, as PCB mode draws it (see `inBoardColours`). They are drawn off
// screen, by a renderer of their own that is thrown away when it is done.
import * as React from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import type { BoardSummary } from "@shared/api"
import type { PcbColours } from "@shared/theme-format"
import { frame, stage } from "@/components/viewport/thumbnails"
import { useThemeColors } from "@/lib/css-color"
import { boardUrl } from "./boards"
import { boardPaint, inOurColours, inShade, shadedOf } from "./colours"

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
 * A board as its pictures have it, as PCB mode draws it (see colours.ts): the board
 * itself in the theme's colours for a board, and what is on it that is a grey in the
 * theme's shade for greys as light. What else is on it (an LED, gold) is as it was.
 */
export function inBoardColours(board: THREE.Object3D, colours: PcbColours) {
  const paint = boardPaint(colours)
  // (parts of one kind share their materials: each is done the once)
  const done = new Set<THREE.Material>()
  board.traverse((thing) => {
    if (!(thing instanceof THREE.Mesh)) return
    for (const material of [thing.material as THREE.Material].flat()) {
      if (done.has(material)) continue
      done.add(material)
      if (
        inOurColours(material, paint) !== null ||
        !(material instanceof THREE.MeshStandardMaterial)
      )
        continue
      const shaded = shadedOf(material.color)
      if (shaded) inShade(shaded, colours, material.color)
    }
  })
}

/**
 * The pictures drawn, by board, by when it was built and by the colours it was drawn in
 * (as JSON): drawn again only when it is built again, or the window is put in a theme
 * that colours a board otherwise.
 */
const pictured = new Map<string, string>()
const pictureOf = (projectId: string, board: BoardSummary, colours: string) =>
  `${projectId}:${board.id}:${board.built}:${colours}`

/** A picture of each of some boards, handed over as a data URL as each is drawn. */
async function draw(
  projectId: string,
  boards: BoardSummary[],
  colours: PcbColours,
  each: (board: BoardSummary, url: string) => void,
  stopped: () => boolean
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(2)
  renderer.setSize(PICTURE / 2, PICTURE / 2, false)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // as PCB mode has them drawn (react-three-fiber's way)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
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
      inBoardColours(loaded, colours)
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
  // (by what they are, and not by which object has them)
  const colours = JSON.stringify(useThemeColors().pcb)
  React.useEffect(() => {
    const wanted = boards.filter(
      (board) =>
        board.model &&
        board.built !== null &&
        !pictured.has(pictureOf(projectId, board, colours))
    )
    if (wanted.length === 0) return
    let stopped = false
    void draw(
      projectId,
      wanted,
      JSON.parse(colours) as PcbColours,
      (board, url) => {
        pictured.set(pictureOf(projectId, board, colours), url)
        if (!stopped) setDrawn((count) => count + 1)
      },
      () => stopped
    )
    return () => {
      stopped = true
    }
  }, [projectId, boards, colours])
  return Object.fromEntries(
    boards.flatMap((board) => {
      const url = pictured.get(pictureOf(projectId, board, colours))
      return url ? [[board.id, url]] : []
    })
  )
}
