# Circuit boards

A project in Enclose can have circuit boards: the boards that go in the thing that is
modelled. Each is designed with [tscircuit](https://docs.tscircuit.com), which writes a
board as React in TypeScript, and is built with the app's own script. The user finds
the boards with the PCB button beside the view, each with a picture of it, and opens
one in PCB mode, where it takes the model's place: drawn as it is made (copper, pads and
print on the board), as its schematic, or in 3D. A board that is only roughed out so far
is listed as Unfinished.

A board is also part of the model. Its 3D comes out of the build as a STEP file, which
`model.py` reads and puts where the board goes in the thing, so that the case is shaped
round the board as it will be made.

## The files

A board's files are all in `pcb/`, at the top of the project, each named for the board:
lower-case letters, figures and hyphens (`main`, `power-board`).

```
pcb/
  main.circuit.tsx      the board, which you write
  main.board.json       what it is called, and whether it is finished
  build/                what the build makes of it: never edit these by hand
    main.circuit.json   the board as tscircuit has it, which the app draws it from
    main.glb            the board in 3D, as the app shows it
    main.step           the board in 3D, for model.py to read
    main.pcb.png        pictures of it, for you to check it by
    main.schematic.png
    main.3d.png
```

`main.board.json` is small, and written by you:

```json
{ "name": "Main board", "finished": false }
```

`name` is what the list and PCB mode call it. `finished` is false while the board is
only roughed out, and true once it is the board to be made. Write it with the board,
and change `finished` when that changes.

Keep everything a board is made of in `pcb/`: the build copies that folder, and nothing
else, to build in.

## Building

From the top of the project:

```
node "<the app's kit>/board.mjs" pcb/main.circuit.tsx
```

Your instructions give the script's path. It runs tscircuit's own `tsci build`, at the
version the app is known to work with, and writes `pcb/build/`. The app shows what it
built by itself: there is nothing to tell it. Do not copy the script into the project.

- It needs Node.js 18 or later (`node --version`). Where there is none, say that the
  boards need Node.js, and offer to install it (`brew install node`, or nodejs.org).
- The first build fetches tscircuit itself, some hundreds of megabytes, once, and takes
  a minute or two. Later builds take seconds, and longer for a board with much to route.
- It prints tscircuit's errors and warnings. On an error the build fails and what was
  built before is left as it was. Warnings that no part number was given, or that a
  pin's use is not said, matter for a detailed board, not a rough one.
- Anything after the board's file goes to `tsci build` as it is.

Look at the three pictures in `pcb/build/` before you report a board, and mend what is
wrong. Your screenshot tool shows the model's view, not PCB mode.

## Writing a board

A board is a default export that returns a `<board>`. Sizes are in millimetres. A part is
placed by its middle, from the middle of the board (`pcbX`, `pcbY`, with Y up), and
turned with `pcbRotation`, in degrees.

```tsx
export default () => (
  <board width="50mm" height="30mm" thickness="1.6mm">
    <chip
      name="U1"
      footprint="soic8"
      pinLabels={{ pin1: "VCC", pin4: "GND", pin8: "OUT" }}
      pcbX={-10}
      pcbY={0}
    />
    <resistor name="R1" resistance="10k" footprint="0603" pcbX={6} pcbY={5} />
    <led name="D1" color="red" footprint="0805" pcbX={16} pcbY={5} />
    <trace from=".U1 > .OUT" to=".R1 > .pin1" />
    <trace from=".R1 > .pin2" to=".D1 > .anode" />
    <trace from=".U1 > .GND" to="net.GND" />
    <hole diameter="3.2mm" pcbX={-22} pcbY={12} />
  </board>
)
```

- A board that is not a rectangle has an `outline` in place of its size: points round
  it, about its middle (`outline={[{ x: -20, y: -10 }, ...]}`). A round one is a ring of
  points, 48 or so.
- Give its thickness: 1.6 mm is what most boards are made at, and tscircuit's own is
  1.4 mm.
- A footprint is named as tscircuit names them (`0402`, `0603`, `soic8`, `sot23`,
  `qfn32`, `pinrow4`, `pushbutton`), or comes with a real part. To find one with its
  stock: `npm_config_allow_git=all npx --yes -p tscircuit tsci search --jlcpcb "ESP32-C3"`.
- The rest of what tscircuit has, and how each element is used, is in its documentation
  at https://docs.tscircuit.com. Where you have a skill for tscircuit, use it.

## A rough board, and a detailed one

Designing a board in detail is other work than shaping the thing, and takes a good while.
So a board is often made rough first, to keep the design of the thing going, and made in
detail later, when the user is ready for it.

A rough board (`"finished": false`) is what the shape of the thing needs to know:

- its outline, cut to the room the thing has for it, and its thickness;
- its mounting holes, where the thing's posts or screws will be;
- the parts that decide the shape, at their real footprints and where they go:
  connectors at the edge where they come through the case, buttons, lights that show,
  a display, the battery or its holder, a module such as an ESP32 or a Pi Pico;
- and nothing else: no small parts, no traces, and `routingDisabled` on the board.

Make it in minutes, build it, fit it into the model, and say in your reply that it is
rough and can be made in detail when they want.

A detailed board (`"finished": true`) is the board to be made: every part a real one,
named by its maker's part number or its JLCPCB number; every pin that is used labelled;
every connection made, with traces and nets; routed by the build; and built without
errors. Make it from the rough one, where there is one: keep its outline, holes and
the parts the thing was shaped round where they were, unless the user agrees to move
them, and say what moved.

## Fitting it into the model

The board is read into `model.py` from its STEP file. The file has the board lying flat,
its middle at the origin and halfway through its thickness, the side its parts are on
facing up (+Z), and the board's own X and Y as the model's. Put it where it goes with a
placing, as one part, in the group for the electronics:

```python
from build123d import Pos, Rot
from enclose import read_step

placing = Pos(0, 0, 12) * Rot(0, 0, 90)  # where the board goes, and which way round
model.part(
    "main_board",
    [placing * found.shape for found in read_step("pcb/build/main.step")],
    label="Main board",
    group=electronics,
)
```

- Where the model had a plain block standing in for the board, the board takes its
  place: the same spot, the same way up.
- Take the numbers that the case and the board share from one place: the outline, the
  holes and the posts under them, and where a connector comes through a wall. Write
  them once, at the top of `model.py`, and copy them into the board, so that when one
  changes both are changed.
- Build the board before the model, then the model, and check them together in a
  screenshot.
- When the board needs more room than the thing has, say so, and change the one the user
  cares less about: the case to fit the board, or the board to fit the case. Say which.
