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
    main.parts.json     the makers' own 3D models of its parts, which read_board
    main.parts/         puts on the board (see Fitting it into the model)
    main.gerbers.zip    what a board house makes it from, which the user saves from
                        PCB mode: Gerbers, drill files, a BOM and where each part goes
    main.preview.json   a quick look at it, unrouted, which the app makes by itself as
                        you write it, for the user to see it come together: leave it be
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

Build again after every change to a board, however small, before you report it: a
part number, a value, a footprint. The Gerbers' zip, with its BOM, and the STEP file
are made only by a build. While you write the board, the app redraws it in PCB mode by
itself, but that is a quick look and builds none of these. So a change made without a
build shows in PCB mode while the user would still order the board as it was before.

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
  points, one for every degree or so (360 for a whole circle): with fewer, the model
  shows its edge as flat sides.
- Give its thickness: 1.6 mm is what most boards are made at, and tscircuit's own is
  1.4 mm.
- A mounting hole is a `<hole>` with a keep-out round it, so that no trace runs where the
  screw's head, or its washer, presses on the board (or, under it, the post it goes
  into): a circle on both sides, as wide as the head, or the washer, and 0.5 mm more all
  round. The library of screws has how wide each head is
  (`Screw("M2.5", 6, "pan").head_diameter`).

  ```tsx
  {/* an M2.5 pan head is 5 mm across: 2.5 mm, and 0.5 mm more */}
  <hole diameter="2.9mm" pcbX={20} pcbY={-13} />
  <keepout shape="circle" radius="3mm" pcbX={20} pcbY={-13} layers={["top", "bottom"]} />
  ```

  Give it its layers: without them the router runs traces through it as if it were not
  there. (`<pcbkeepout>`, which tscircuit's documentation names, is not known to the
  tscircuit the app builds with: it is `<keepout>`.)
- A footprint is named as tscircuit names them (`0402`, `0603`, `soic8`, `sot23`,
  `qfn32`, `pinrow4`, `pushbutton`), or comes with a real part. To find one with its
  stock: `npm_config_allow_git=all npx --yes -p tscircuit tsci search --jlcpcb "ESP32-C3"`.
- The rest of what tscircuit has, and how each element is used, is in its documentation
  at https://docs.tscircuit.com. Where you have a skill for tscircuit, use it.

## Choosing parts

The board is made by a board house and often put together by hand, and its traces are
run by tscircuit's router, which does well with parts whose pins are well apart and
badly with fine ones. So of the parts that do the job, take the one that is easiest to
route and to solder:

- a chip in a package with leads, SOIC, SOT or TSSOP, over QFN or BGA: the same chip
  usually comes in both (the ATtiny1616 as SOIC-20, ATTINY1616-SNR, as well as QFN-20);
- resistors and capacitors in 0603 or 0805, and 0402 only where there is no room;
- for USB-C that only brings power in, a socket with power pins alone (6 pins: VBUS, GND,
  CC1, CC2), not the 16 or 24 pin one, whose pins are 0.5 mm apart;
- a module (an ESP32, a Pi Pico) where it does what a chip and its parts would.

Take a finer part only where the thing needs it, and say why in your reply.

## Parts that JLCPCB can assemble

JLCPCB assembles a board from the BOM in its Gerbers' zip. A part with no JLCPCB part
number there is left blank, and the user has to find each one by hand before they can
order. tscircuit gives many resistors and capacitors a number by itself. Every other
part gets one only if the board gives it, alongside the maker's own number:

```tsx
<chip
  name="U2"
  manufacturerPartNumber="AMS1117-3.3"
  supplierPartNumbers={{ jlcpcb: ["C6186"] }}
  footprint="sot223"
  ...
/>
```

- Look each part up with `tsci search --jlcpcb` (above), and take one that JLCPCB has
  in stock, in the quantity the user is making. The search matches loosely, and can
  give a different part from the one asked for: check that the part it gives is that
  one, or does the same job in the same footprint.
- Where the maker's part is not stocked, or is discontinued, take one that does the
  same job in the same footprint, and say in your reply which part changed and why.
- After each build, the build lists any part the BOM still has no JLCPCB number for. A
  finished board has none. If no stocked part can be found for one, say which and
  why, so the user knows to source it themselves.

## Routing

Let the router try first. Draw a trace by hand (`pcbPath`) only where it fails, which is
most often in getting out from among a part's fine pins: as much of the trace as gets
it clear, and the router does the rest. Keep traces 0.15 mm wide or more, and those that
carry the current of a motor or a light wider. Read the build's warnings for traces
that cross, or come too close: a board with any is not done.

## A rough board, and a detailed one

Designing a board in detail is other work than shaping the thing, and takes a good while.
So a board is often made rough first, to keep the design of the thing going, and made in
detail later, when the user is ready for it.

A rough board (`"finished": false`) is what the shape of the thing needs to know:

- its outline, cut to the room the thing has for it, and its thickness;
- its mounting holes, where the thing's posts or screws will be, each with its keep-out;
- the parts that decide the shape, at their real footprints and where they go:
  connectors at the edge where they come through the case, buttons, lights that show,
  a display, the battery or its holder, a module such as an ESP32 or a Pi Pico;
- and nothing else: no small parts, no traces, and `routingDisabled` on the board.

Make it in minutes, build it, fit it into the model, and say in your reply that it is
rough and can be made in detail when they want.

A detailed board (`"finished": true`) is the board to be made: every part a real one,
named by its maker's part number and by the JLCPCB number of a part in stock (see Parts
that JLCPCB can assemble); every pin that is used labelled; every connection made, with
traces and nets; routed by the build; and built without errors. Make it from the rough
one, where there is one: keep its outline, holes and the parts the thing was shaped
round where they were, unless the user agrees to move them, and say what moved.

A detailed board takes a while, and the user watches it come together in PCB mode,
which the app opens on the board when it is first built in a turn. So build it in
steps, and build after each one, rather than once at the end:

1. its outline, holes and every part, placed where it goes, with `routingDisabled`;
2. every connection, still unrouted, which the drawing shows as straight lines;
3. routed.

Say in a few words what you are at as you go: it is how the user follows the work.

## Fitting it into the model

The board is read into `model.py` with `enclose.read_board`, by its name. It gives the
board from its STEP file, and every part on it whose maker's own 3D model tscircuit could
not put in that file (it often cannot): the build fetches those, and `read_board` puts
each where the board's layout has it. So draw no stand-in for a part that is on the board:
it is there as it is made. All of it has the board lying flat, its middle at the origin
and halfway through its thickness, the side its parts are on facing up (+Z), and the
board's own X and Y as the model's. Put it where it goes with one placing, as one part,
in the group for the electronics:

```python
from build123d import Pos, Rot
from enclose import read_board

placing = Pos(0, 0, 12) * Rot(0, 0, 90)  # where the board goes, and which way round
model.part(
    "main_board",
    [placing * found.shape for found in read_board("main")],
    label="Main board",
    group=electronics,
)
```

An `enclose.py` with no `read_board` in it is an older copy: copy the app's in again
first. Give a part of the board a part of its own (`found.label` is its name on the
board, U1 or J2) only where it is to be told apart in the model: a button that comes out
through the case, say.

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
