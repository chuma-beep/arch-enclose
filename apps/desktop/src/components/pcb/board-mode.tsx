// PCB mode: one of the project's circuit boards, where the view of the model was, on a
// ground of its own colour. It is looked at three ways, by the buttons down the right:
// drawn as it is made, its copper, pads and print on the board; as its schematic; and
// in 3D, as tscircuit built it. Both drawings are tscircuit's own (circuit-to-svg), and
// the 3D is the board it built, so all three are the board as it will be made.
//
// The drawings are moved about as the model is: fingers across a trackpad or a drag move
// them, and a pinch or a mouse wheel zooms, on the place under the pointer. A double
// click puts the whole of the board back in view. The 3D turns, as the model does.
import * as React from "react"
import * as THREE from "three"
import { Canvas, useThree } from "@react-three/fiber"
import {
  CameraControls,
  CameraControlsImpl,
  ContactShadows,
} from "@react-three/drei"
import { XIcon } from "lucide-react"

import type { BoardSummary } from "@shared/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useThemeColors } from "@/lib/css-color"
import { usePreferences } from "@/lib/preferences"
import { SCROLL_PAUSE, scrollSource } from "@/lib/scroll"
import { useStore, type BoardAs } from "@/lib/store"
import { boardUrl, sizeSaid, useCircuit, type Circuit } from "./boards"
import { DRAWN, GROUND } from "./ground"
import { BOARD_FROM, disposeBoard, loadBoard } from "./pictures"

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
 * The board in 3D, lit as the model is, with its shadow on the ground under it, from
 * its front right corner. Fingers across a trackpad, or a drag, turn it round; a pinch
 * or a wheel goes nearer, a drag with the right button moves it.
 */
function InThreeD({ url }: { url: string }) {
  return (
    <Canvas
      className="touch-none"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 30, near: 0.1, far: 20000, position: [0, 0, 100] }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#7d828c", 0.7]} />
      <directionalLight position={[180, 320, 220]} intensity={1.7} />
      <directionalLight position={[-240, 160, -180]} intensity={0.55} />
      <Board url={url} />
    </Canvas>
  )
}

/** The board itself, loaded, and the camera put where all of it is in view. */
function Board({ url }: { url: string }) {
  const [board, setBoard] = React.useState<THREE.Group | null>(null)
  const controls = React.useRef<CameraControlsImpl>(null)
  const dom = useThree((state) => state.gl.domElement)

  React.useEffect(() => {
    let over = false
    let had: THREE.Group | null = null
    void loadBoard(url).then(
      (loaded) => {
        if (over) return disposeBoard(loaded)
        had = loaded
        setBoard(loaded)
      },
      () => {
        if (!over) setBoard(null)
      }
    )
    return () => {
      over = true
      if (had) disposeBoard(had)
    }
  }, [url])

  const box = React.useMemo(
    () => (board ? new THREE.Box3().setFromObject(board) : null),
    [board]
  )
  // from the corner the list pictures it from, as near as shows all of it
  const framed = React.useRef<string | null>(null)
  React.useEffect(() => {
    const camera = controls.current
    if (!camera || !box || framed.current === url.split("?")[0]) return
    framed.current = url.split("?")[0]
    const middle = box.getCenter(new THREE.Vector3())
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const eye = middle.clone().addScaledVector(BOARD_FROM, sphere.radius * 4)
    void camera
      .setLookAt(eye.x, eye.y, eye.z, middle.x, middle.y, middle.z, false)
      .then(() => camera.fitToSphere(sphere, false))
  }, [box, url])

  // Fingers across a trackpad turn the board, as they turn the model: the controls
  // would take them for a wheel, and go nearer. A pinch, or a wheel, is left to them.
  React.useEffect(() => {
    const source = scrollSource()
    let last = -Infinity
    const wheel = (event: WheelEvent) => {
      const camera = controls.current
      if (!camera || event.ctrlKey) return
      const { scrolling, turnSpeed } = usePreferences.getState()
      const now = performance.now()
      const from =
        scrolling === "auto"
          ? source(event, now)
          : scrolling === "trackpad"
            ? "fingers"
            : "wheel"
      if (from !== "fingers") return
      event.preventDefault()
      event.stopImmediatePropagation()
      // a swipe that coasts on after a pinch is not a turn
      if (now - last < SCROLL_PAUSE && Math.abs(event.deltaY) < 1) return
      last = now
      const rate = 0.006 * turnSpeed
      void camera.rotate(-event.deltaX * rate, -event.deltaY * rate, true)
    }
    dom.addEventListener("wheel", wheel, { capture: true, passive: false })
    return () => dom.removeEventListener("wheel", wheel, { capture: true })
  }, [dom])

  const size = box?.getSize(new THREE.Vector3())
  return (
    <>
      {board && box && size && (
        <>
          <primitive object={board} />
          <ContactShadows
            position={[0, box.min.y - size.y * 0.02, 0]}
            scale={Math.max(size.x, size.z) * 1.6}
            far={Math.max(size.y * 4, 4)}
            blur={2.4}
            opacity={0.5}
            frames={1}
          />
        </>
      )}
      <CameraControls
        ref={controls}
        makeDefault
        dollyToCursor
        smoothTime={0.12}
      />
    </>
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
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: dark ? GROUND.dark : GROUND.light }}
    >
      {board.built === null ? (
        <Nothing
          title="Not built yet"
          detail="There is nothing of this board to show until it is built. Ask Claude to build it."
        />
      ) : as === "3d" ? (
        board.model ? (
          // (keyed by the board, so that another one is framed afresh)
          <InThreeD key={board.id} url={boardUrl(projectId, board, "model")} />
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

      {/* what it is, at the top: where the window is not dragged by */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
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
      </div>
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
