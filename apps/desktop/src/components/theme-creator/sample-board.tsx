// A circuit board for the theme creator's window to show in PCB mode, in the colours a
// theme gives one: the same board each time, built once with tscircuit and kept beside
// this, in sample/. Each of the three ways PCB mode looks at a board is drawn as PCB mode
// draws it, in 3D or as tscircuit draws it, and nothing in it does anything but show the
// colours.
//
// The board is plate.circuit.tsx, with the parts it brings in from lib/, after Scott
// Bezek's open-source split-flap display (github.com/scottbez1/splitflap). Of what is
// built of it, plate.circuit.json and plate.glb are kept. To change it, copy those
// sources into the pcb/ folder of a project of their own, build it there with
// kit/board.mjs as kit/pcb.md says, and copy those two back from its pcb/build/.
import * as React from "react"
import * as THREE from "three"
import { Canvas, useThree } from "@react-three/fiber"

import type { PcbColours } from "@shared/theme-format"
import type { Circuit } from "@/components/pcb/boards"
import { readDrawing, standing, useDrawn } from "@/components/pcb/board-mode"
import { disposeBoard, loadBoard } from "@/components/pcb/pictures"
import { FOV, HOME_DIRECTION, toWorld } from "@/components/viewport/rig"
import type { BoardAs } from "@/lib/store"
import circuitUrl from "./sample/plate.circuit.json?url"
import modelUrl from "./sample/plate.glb?url"

/** What the board is called, as PCB mode says over it. */
export const SAMPLE_NAME = "Main plate board"

/** The board as tscircuit has it: loaded once, the first time it is wanted. */
let circuit: Promise<Circuit> | null = null
const loadCircuit = () =>
  (circuit ??= fetch(circuitUrl).then(
    (response) => response.json() as Promise<Circuit>
  ))

/** The board as tscircuit has it, once it is loaded. */
export function useSampleCircuit(): Circuit | null {
  const [had, setHad] = React.useState<Circuit | null>(null)
  React.useEffect(() => {
    let over = false
    void loadCircuit().then((loaded) => {
      if (!over) setHad(loaded)
    })
    return () => {
      over = true
    }
  }, [])
  return had
}

/** How big the board is, as PCB mode says under its name: "90 × 60 mm". */
export function sampleSize(board: Circuit | null): string | null {
  const said = board?.find((element) => element.type === "pcb_board")
  if (typeof said?.width !== "number" || typeof said.height !== "number")
    return null
  return `${Math.round(said.width)} × ${Math.round(said.height)} mm`
}

/** How much of the room it has the board fills, in 3D and drawn: as PCB mode has it. */
const FIT = 0.86

/**
 * How much of the board's drawing is shown, from where across it and how far across,
 * each against the whole: all of the board as it is made; and of its schematic, which
 * is wide and would be small, the left of it (its power, and its stepper drive), where
 * every one of its colours is.
 */
const SHOWN: Record<"pcb" | "schematic", [number, number]> = {
  pcb: [0, 1],
  schematic: [0, 0.52],
}

/** The board's own colours changed, drawn again in them. */
function Painting({
  shown,
  colours,
}: {
  shown: ReturnType<typeof standing>
  colours: PcbColours
}) {
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    shown.paint(colours)
    invalidate()
  }, [shown, colours, invalidate])
  return null
}

/** The camera where a model's is when it opens, the whole board in view. */
function Framing({ seen }: { seen: THREE.Box3 }) {
  const get = useThree((state) => state.get)
  const size = useThree((state) => state.size)
  React.useLayoutEffect(() => {
    const { camera, invalidate } = get()
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const middle = seen.getCenter(new THREE.Vector3())
    const toward = toWorld(HOME_DIRECTION)
    camera.aspect = size.width / size.height
    camera.position.copy(middle).add(toward)
    camera.lookAt(middle)
    camera.updateMatrixWorld()
    // as near as each of the box's corners lets it, along the way it looks: a corner
    // so far across, and so far toward it, needs it that far off
    const high = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * FIT
    const wide = high * camera.aspect
    const corner = new THREE.Vector3()
    const turned = new THREE.Matrix4().extractRotation(
      camera.matrixWorldInverse
    )
    let away = 0
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? seen.max.x : seen.min.x,
          i & 2 ? seen.max.y : seen.min.y,
          i & 4 ? seen.max.z : seen.min.z
        )
        .sub(middle)
        .applyMatrix4(turned)
      away = Math.max(
        away,
        corner.z + Math.abs(corner.x) / wide,
        corner.z + Math.abs(corner.y) / high
      )
    }
    camera.position.copy(middle).addScaledVector(toward, away)
    camera.near = away / 50
    camera.far = away * 4
    camera.updateProjectionMatrix()
    invalidate()
  }, [get, size, seen])
  return null
}

/** The board in 3D, lit as PCB mode lights it, from where a model is first seen. */
function InThreeD({ colours }: { colours: PcbColours }) {
  const [shown, setShown] = React.useState<ReturnType<typeof standing> | null>(
    null
  )
  // (in the colours as they are when it is loaded: Painting has it in others)
  const first = React.useRef(colours)
  React.useEffect(() => {
    let over = false
    let had: ReturnType<typeof standing> | null = null
    void loadBoard(modelUrl).then((loaded) => {
      if (over) return disposeBoard(loaded)
      had = standing(loaded, first.current)
      setShown(had)
    })
    return () => {
      over = true
      had?.dispose()
    }
  }, [])
  if (!shown) return null
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV }}
      // (it is drawn scaled down to fit: sized by its own box, not as it is seen)
      resize={{ offsetSize: true }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#7d828c", 0.7]} />
      <directionalLight position={[180, 320, 220]} intensity={1.7} />
      <directionalLight position={[-240, 160, -180]} intensity={0.55} />
      <primitive object={shown.holder} />
      <Framing seen={shown.seen} />
      <Painting shown={shown} colours={colours} />
    </Canvas>
  )
}

/**
 * The board drawn as tscircuit draws it, as it is made or as its schematic: as big as it
 * fits. While it is drawn again in other colours, it stays as it was.
 */
function Drawn({
  board,
  as,
  colours,
  dark,
  ground,
}: {
  board: Circuit
  as: "pcb" | "schematic"
  colours: PcbColours
  dark: boolean
  ground: string
}) {
  const markup = useDrawn(board, as, colours, dark, ground, "top")
  const holder = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const held = holder.current
    if (!held || !markup) return
    const read = readDrawing(markup)
    if (!read) return
    // as much of it as is shown, as big as it fits
    const [x, width] = SHOWN[as]
    read.svg.setAttribute(
      "viewBox",
      `${x * read.width} 0 ${width * read.width} ${read.height}`
    )
    held.replaceChildren(read.svg)
  }, [markup, as])
  // (another way of drawing it starts afresh)
  React.useEffect(() => holder.current?.replaceChildren(), [as])
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        ref={holder}
        style={{ width: `${FIT * 100}%`, height: `${FIT * 100}%` }}
      />
    </div>
  )
}

/**
 * The board, the way it is looked at, in a theme's colours for it: on the view's ground
 * (`ground`), which shows through it where it is drawn as it is made.
 */
export function SampleBoard({
  as,
  colours,
  dark,
  ground,
}: {
  as: BoardAs
  colours: PcbColours
  dark: boolean
  ground: string
}) {
  const board = useSampleCircuit()
  if (as === "3d") return <InThreeD colours={colours} />
  if (!board) return null
  return (
    <Drawn
      board={board}
      as={as}
      colours={colours}
      dark={dark}
      ground={ground}
    />
  )
}
