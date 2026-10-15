// PCB mode: one of the project's circuit boards, where the view of the model was, on a
// ground of its own colour. It is looked at three ways, by the buttons down the right:
// drawn as it is made, its copper, pads and print on the board; as its schematic; and
// in 3D, as tscircuit built it. Both drawings are tscircuit's own (circuit-to-svg), and
// the 3D is the board it built, so all three are the board as it will be made.
//
// The drawings are moved about as the model is: fingers across a trackpad or a drag move
// them, and a pinch or a mouse wheel zooms, on the place under the pointer. A double
// click puts the whole of the board back in view. The 3D has the model's own camera, and
// is turned and moved by the same hand.
import * as React from "react"
import { cn } from "cn"
import * as THREE from "three"
import { Canvas } from "@react-three/fiber"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { XIcon } from "lucide-react"

import type { BoardSummary } from "@shared/api"
import type { Building } from "@shared/board-format"
import { LIVE } from "@/components/steps"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useThemeColors } from "@/lib/css-color"
import { usePreferences } from "@/lib/preferences"
import { scrollSource } from "@/lib/scroll"
import { useStore, type BoardAs } from "@/lib/store"
import { boardUrl, sizeSaid, useCircuit, type Circuit } from "./boards"
import { DRAWN, GROUND } from "./ground"
import { contoursOf } from "@/components/viewport/contours"
import { EDGE } from "@/components/viewport/paint"
import { onlyWhereItTurns } from "@/components/viewport/scene"
import { FOV, REACH, Rig } from "@/components/viewport/rig"
import { disposeBoard, loadBoard } from "./pictures"

/** How much of the view a drawing fills when the whole of it is shown. */
const FIT = 0.86
/** How far in a drawing can be zoomed, and out, against the whole of it. */
const NEAREST = 60
const FURTHEST = 0.5
/** How hard a wheel zooms, a pixel of it; and a pinch, against a wheel. */
const ZOOM = 0.0022
const PINCH = 2.25

/**
 * A drawing, as the page can have it: read as SVG, with nothing in it that runs (the
 * board's files are the project's, and anything could have been written into them),
 * made to fill what it is put in. With how big it was drawn, in its own pixels.
 */
function readDrawing(
  markup: string
): { svg: SVGSVGElement; width: number; height: number } | null {
  const read = new DOMParser().parseFromString(markup, "image/svg+xml")
  const svg = read.documentElement
  if (!(svg instanceof SVGSVGElement)) return null
  for (const thing of svg.querySelectorAll(
    "script, foreignObject, iframe, object, embed, a"
  ))
    thing.remove()
  // and no frame round the room the board is drawn in: the ground is all there is
  for (const frame of svg.querySelectorAll('[data-type="pcb_boundary"]'))
    frame.remove()
  for (const thing of [svg, ...svg.querySelectorAll("*")])
    for (const { name, value } of [...thing.attributes])
      if (
        name.toLowerCase().startsWith("on") ||
        (/href$/i.test(name) && !value.startsWith("#"))
      )
        thing.removeAttribute(name)
  const width = Number(svg.getAttribute("width")) || DRAWN.width
  const height = Number(svg.getAttribute("height")) || DRAWN.height
  svg.setAttribute("width", "100%")
  svg.setAttribute("height", "100%")
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
  svg.style.display = "block"
  return { svg, width, height }
}

/** Where a drawing is looked at: the middle of what is shown, and its pixels to the view's one. */
type Looking = { x: number; y: number; scale: number }

/**
 * A drawing of the board, filling the view, moved about and zoomed by the hand. It
 * keeps where it was looked at as long as it is the same board drawn the same way.
 */
function Drawing({ markup }: { markup: string }) {
  const holder = React.useRef<HTMLDivElement>(null)
  const looking = React.useRef<Looking | null>(null)
  /** how big the whole of it is shown: what zooming in and out is counted from */
  const whole = React.useRef(1)

  React.useLayoutEffect(() => {
    const within = holder.current
    const drawing = readDrawing(markup)
    if (!within || !drawing) return
    const { svg, ...size } = drawing
    within.replaceChildren(svg)

    const show = () => {
      const at = looking.current
      const { width, height } = within.getBoundingClientRect()
      if (!at || width === 0 || height === 0) return
      const w = width * at.scale
      const h = height * at.scale
      svg.setAttribute("viewBox", `${at.x - w / 2} ${at.y - h / 2} ${w} ${h}`)
    }
    const fit = () => {
      const { width, height } = within.getBoundingClientRect()
      if (width === 0 || height === 0) return
      whole.current = Math.max(size.width / width, size.height / height) / FIT
      looking.current = {
        x: size.width / 2,
        y: size.height / 2,
        scale: whole.current,
      }
      show()
    }
    /** Zoom by so much, on a place in the view, as its pixels from the top left. */
    const zoom = (by: number, px: number, py: number) => {
      const at = looking.current
      if (!at) return
      const { width, height } = within.getBoundingClientRect()
      const scale = Math.min(
        whole.current / FURTHEST,
        Math.max(whole.current / NEAREST, at.scale * by)
      )
      // the place under the pointer stays under it
      const dx = px - width / 2
      const dy = py - height / 2
      looking.current = {
        x: at.x + dx * (at.scale - scale),
        y: at.y + dy * (at.scale - scale),
        scale,
      }
      show()
    }
    const move = (dx: number, dy: number) => {
      const at = looking.current
      if (!at) return
      looking.current = {
        ...at,
        x: at.x - dx * at.scale,
        y: at.y - dy * at.scale,
      }
      show()
    }

    // a board drawn again, or the other way, starts whole; and so it does the first time
    if (looking.current === null) fit()
    else show()
    const sized = new ResizeObserver(() => (looking.current ? show() : fit()))
    sized.observe(within)

    const source = scrollSource()
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const { scrolling, wheelReversed, zoomSpeed } = usePreferences.getState()
      const from =
        scrolling === "auto"
          ? source(event, performance.now())
          : scrolling === "trackpad"
            ? "fingers"
            : "wheel"
      // fingers across a trackpad move it, as a page is moved; a pinch arrives as a
      // scroll with Ctrl held, and zooms, as a wheel does
      if (!event.ctrlKey && from === "fingers") {
        move(-event.deltaX, -event.deltaY)
        return
      }
      const lines = event.deltaMode === 1 ? 16 : 1
      const way = !event.ctrlKey && wheelReversed ? -1 : 1
      const box = within.getBoundingClientRect()
      zoom(
        Math.exp(
          event.deltaY *
            lines *
            ZOOM *
            (event.ctrlKey ? PINCH : 1) *
            way *
            zoomSpeed
        ),
        event.clientX - box.left,
        event.clientY - box.top
      )
    }
    let held: { x: number; y: number } | null = null
    const down = (event: PointerEvent) => {
      held = { x: event.clientX, y: event.clientY }
      within.setPointerCapture(event.pointerId)
    }
    const drag = (event: PointerEvent) => {
      if (!held) return
      move(event.clientX - held.x, event.clientY - held.y)
      held = { x: event.clientX, y: event.clientY }
    }
    const up = () => {
      held = null
    }
    within.addEventListener("wheel", wheel, { passive: false })
    within.addEventListener("pointerdown", down)
    within.addEventListener("pointermove", drag)
    within.addEventListener("pointerup", up)
    within.addEventListener("pointercancel", up)
    within.addEventListener("dblclick", fit)
    return () => {
      sized.disconnect()
      within.removeEventListener("wheel", wheel)
      within.removeEventListener("pointerdown", down)
      within.removeEventListener("pointermove", drag)
      within.removeEventListener("pointerup", up)
      within.removeEventListener("pointercancel", up)
      within.removeEventListener("dblclick", fit)
    }
  }, [markup])

  return (
    <div
      ref={holder}
      className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
    />
  )
}

/**
 * Two triangles that meet at more than this, in degrees, have an edge between them: as
 * the model's parts made of a mesh have (viewport/load.ts).
 */
const CREASE = 20
/** How strong a line of an edge is, as the model's are in its solid look. */
const LINE_OPACITY = 0.85

/** A line drawn as the model's are: a pixel wide, whatever the distance, and dark. */
const lineMaterial = () =>
  new LineMaterial({
    color: EDGE,
    linewidth: 1,
    transparent: true,
    opacity: LINE_OPACITY,
    depthWrite: false,
  })

/**
 * A board in 3D as the view shows it: as tscircuit built it, in its own colours, with
 * its lines drawn as the model's parts made of a mesh have theirs: wherever two of its
 * triangles meet at an edge, and the outline of its curved faces, wherever that is
 * seen from. It is turned half round, so that its own X and Y are the model's (as its
 * STEP file has them) and the view's camera comes to it from its front right corner, as
 * to a model. With the box round it, in the model's frame, which the camera goes by.
 */
function standing(board: THREE.Group) {
  const holder = new THREE.Group()
  holder.rotation.y = Math.PI
  holder.add(board)
  const made: { dispose(): void }[] = []
  const slight = Math.cos((CREASE * Math.PI) / 180)
  const meshes: THREE.Mesh[] = []
  board.traverse((thing) => {
    if (thing instanceof THREE.Mesh) meshes.push(thing)
  })
  for (const mesh of meshes) {
    // the faces stand back a little, for the lines over them to be seen
    for (const material of [mesh.material].flat())
      Object.assign(material, {
        polygonOffset: true,
        polygonOffsetFactor: 1.5,
        polygonOffsetUnits: 1.5,
      })
    const creases = new THREE.EdgesGeometry(mesh.geometry, CREASE)
    const edges = new LineSegmentsGeometry().setPositions(
      creases.attributes.position.array as Float32Array
    )
    creases.dispose()
    const drawn = lineMaterial()
    mesh.add(new LineSegments2(edges, drawn))
    made.push(edges, drawn)
    const { index, attributes } = mesh.geometry
    if (!index) continue
    const { ends, ways } = contoursOf(
      attributes.position.array,
      index.array,
      (_, __, cos) => cos > slight
    )
    if (ends.length === 0) continue
    const outline = new LineSegmentsGeometry().setPositions(ends)
    const each = new THREE.InstancedInterleavedBuffer(
      Float32Array.from(ways),
      6,
      1
    )
    outline.setAttribute(
      "wayA",
      new THREE.InterleavedBufferAttribute(each, 3, 0)
    )
    outline.setAttribute(
      "wayB",
      new THREE.InterleavedBufferAttribute(each, 3, 3)
    )
    const turning = lineMaterial()
    turning.onBeforeCompile = onlyWhereItTurns
    mesh.add(new LineSegments2(outline, turning))
    made.push(outline, turning)
  }
  holder.updateMatrixWorld(true)
  const { min, max } = new THREE.Box3().setFromObject(holder)
  // (the world's Y is the model's Z, and its Z the model's -Y)
  const box = new THREE.Box3(
    new THREE.Vector3(min.x, -max.z, min.y),
    new THREE.Vector3(max.x, -min.z, max.y)
  )
  return {
    holder,
    box,
    dispose: () => {
      for (const thing of made) thing.dispose()
      disposeBoard(board)
    },
  }
}

/**
 * The board in 3D, in a view of its own that is looked round as the model's is: the
 * same camera, which the same hand moves, lit as the model is.
 */
function InThreeD({ url, id }: { url: string; id: string }) {
  const [shown, setShown] = React.useState<ReturnType<typeof standing> | null>(
    null
  )
  React.useEffect(() => {
    let over = false
    let had: ReturnType<typeof standing> | null = null
    void loadBoard(url).then(
      (loaded) => {
        if (over) return disposeBoard(loaded)
        had = standing(loaded)
        setShown(had)
      },
      () => {
        if (!over) setShown(null)
      }
    )
    return () => {
      over = true
      had?.dispose()
    }
  }, [url])
  if (!shown) return null
  const radius = shown.box.getSize(new THREE.Vector3()).length() / 2 || 1
  return (
    <Canvas
      className="touch-none"
      frameloop="demand"
      resize={{ debounce: 0 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{
        fov: FOV,
        near: (radius * REACH.nearest) / 4,
        far: radius * REACH.furthest * 2,
        position: [radius * 3, radius * 3, radius * 3],
      }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#7d828c", 0.7]} />
      <directionalLight position={[180, 320, 220]} intensity={1.7} />
      <directionalLight position={[-240, 160, -180]} intensity={0.55} />
      <primitive object={shown.holder} />
      {/* (framed afresh for another board, and not for the same one built again) */}
      <Rig box={shown.box} homeKey={`board:${id}`} bridged={false} />
    </Canvas>
  )
}

/**
 * A board drawn the one way or the other, as SVG: null while it is being drawn, and not
 * at all in 3D. What draws it is loaded the first time it is wanted: it is a good deal of
 * the app, and no use to a project that has no boards. False where it cannot be drawn.
 */
function useDrawn(
  circuit: Circuit | null,
  as: BoardAs,
  dark: boolean
): string | false | null {
  const [drawn, setDrawn] = React.useState<{
    of: [Circuit, BoardAs, boolean]
    markup: string | false
  } | null>(null)
  React.useEffect(() => {
    if (!circuit || as === "3d") return
    let over = false
    void import("./drawing").then(({ drawingOf }) => {
      let markup: string | false
      try {
        markup = drawingOf(circuit, as, dark)
      } catch {
        // nothing tscircuit could draw: it is said so
        markup = false
      }
      if (!over) setDrawn({ of: [circuit, as, dark], markup })
    })
    return () => {
      over = true
    }
  }, [circuit, as, dark])
  if (!drawn || as === "3d") return null
  const [was, wasAs, wasDark] = drawn.of
  return was === circuit && wasAs === as && wasDark === dark
    ? drawn.markup
    : null
}

/** What PCB mode says where it has nothing of the board to show. */
function Nothing({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center select-none">
      <div className="text-xl/[1.3] font-bold">{title}</div>
      <div className="max-w-md text-xl/[1.3] text-balance text-foreground/45">
        {detail}
      </div>
    </div>
  )
}

/**
 * PCB mode, with one of the project's boards in it: the board, the way the buttons have
 * it looked at, and over it at the top what it is called and how big it is.
 */
export function BoardMode({
  projectId,
  board,
}: {
  projectId: string
  board: BoardSummary
}) {
  const as: BoardAs = useStore((state) => state.view.boardAs)
  const { dark } = useThemeColors()
  const { circuit, trouble } = useCircuit(projectId, board)
  const markup = useDrawn(circuit, as, dark)
  const size = sizeSaid(board)

  return (
    // (its ground comes in over the model as the buttons change over)
    <div
      className="absolute inset-0 animate-in overflow-hidden duration-300 fade-in motion-reduce:animate-none"
      style={{ background: dark ? GROUND.dark : GROUND.light }}
    >
      {board.built === null && board.preview === null ? (
        <Nothing
          title="Not built yet"
          detail="There is nothing of this board to show until it is built. Ask Claude to build it."
        />
      ) : as === "3d" ? (
        board.model ? (
          // (keyed by the board, so that another one is framed afresh)
          <InThreeD
            key={board.id}
            id={board.id}
            url={boardUrl(projectId, board, "model")}
          />
        ) : (
          <Nothing
            title="No 3D yet"
            detail="This board was built without its 3D. Ask Claude to build it again."
          />
        )
      ) : markup ? (
        // (keyed by the board and the way it is drawn, so that each starts whole)
        <Drawing key={`${board.id}:${as}`} markup={markup} />
      ) : trouble || markup === false ? (
        <Nothing
          title="The board could not be drawn"
          detail={trouble ?? "What was built of it does not read as a board."}
        />
      ) : null}

      {/* what it is, at the top: where the window is not dragged by; and under that,
          while it is being built, how far that has got */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-col items-center gap-2">
        <div className="flex max-w-[50%] items-center gap-2 text-sm select-none">
          <span className="truncate font-medium">{board.name}</span>
          {size && (
            <span className="shrink-0 text-foreground/45 tabular-nums">
              {size}
            </span>
          )}
          {!board.finished && (
            <Badge variant="outline" className="shrink-0">
              Unfinished
            </Badge>
          )}
        </div>
        {board.building && <BuildingLine building={board.building} />}
      </div>
    </div>
  )
}

/**
 * How far a board's build has got, in a line: what it is at, and while it is routing
 * how far along that is, with a bar that fills as it goes. Each build of a board is
 * shown as it comes in, so this is what is waited for meanwhile.
 */
function BuildingLine({ building }: { building: Building }) {
  const { stage, progress, phase, phases } = building
  const routing = stage === "routing"
  const share = routing && progress !== null ? progress : null
  return (
    <div className="flex animate-in flex-col items-center gap-1.5 text-xs text-foreground/60 duration-200 fade-in">
      <span className={cn("tabular-nums", LIVE)}>
        {stage === "building"
          ? "Building the board"
          : stage === "finishing"
            ? "Writing what was built"
            : `Routing${phases && phases > 1 ? ` (${phase} of ${phases})` : ""}${share !== null ? ` · ${Math.round(share * 100)}%` : ""}`}
      </span>
      {routing && (
        <div className="h-0.5 w-32 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground/60 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(3, (share ?? 0) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/** At the foot of the view in PCB mode: what takes it back to the model. */
export function ExitBoard() {
  const setView = useStore((state) => state.setView)
  return (
    <Button
      size="lg"
      // room either side of the words, a little less of it past the cross
      className="pointer-events-auto animate-in gap-2 pr-4.5 pl-5 shadow-md duration-150 fade-in slide-in-from-bottom-2"
      onClick={() => setView({ board: null })}
    >
      Exit PCB mode
      <XIcon
        className="size-5"
        size={20}
        absoluteStrokeWidth
        strokeWidth={1.25}
      />
    </Button>
  )
}
