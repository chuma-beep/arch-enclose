// The clock's board: it keeps the time and steps the motor that turns the hands.
//
// Power comes in on a USB-C socket (5 V, power only: 6 pins), which sits in a notch in
// the drum's wall. An ATtiny1616 keeps time from a 32.768 kHz watch crystal, on its own
// real-time counter, and steps a 28BYJ-48 motor through a ULN2003 driver: half a step
// about every 0.88 s, which turns the centre arbor once an hour. The button pokes out
// through the back cover; holding it runs the hands forward fast, to set them.
// It is programmed through the UPDI pads (5 V, UPDI, GND).
//
// The board is round, to fill the back of the drum, and screwed to three posts on the
// inside of the back cover. Its parts face forward, at the motor; only the button is on
// the back. Seen from the front, x is to the right and y up, about the clock's centre.
//
// These numbers are shared with model.py, which has them at its top: change both.
import { ULN2003ADR } from "./imports/ULN2003ADR"
import { B5B_XH_A_LF__SN_ } from "./imports/B5B_XH_A_LF__SN_"
import { Q13FC13500004 } from "./imports/Q13FC13500004"
import { TYPE_C_6P } from "./imports/TYPE_C_6P"
import { ATTINY1616_SNR } from "./imports/ATTINY1616_SNR"
import { A_1_1825910_4 } from "./imports/A_1_1825910_4"

const RADIUS = 55 // the board, inside the drum's bore (57)
const USB_ANGLE = -30 // where the socket comes out, degrees from +x (about four o'clock)
const TAB_REACH = 64.4 // how far out the tab the socket is on goes (the drum is 65)
const TAB_HALF = 5.5 // half the tab's width
const SOCKET_FRONT = 4.9 // how far the socket's mouth is from its own origin
const HOLES = [30, 150, 270] // the three mounting holes, degrees from +x
const HOLE_RADIUS = 47 // how far out they are
const HOLE_KEEPOUT = 3 // an M2.5 pan head is 5 mm across: 2.5 mm, and 0.5 mm more
const BUTTON = { x: 0, y: 46 } // the button, through the back cover
const MOTOR_PLUG = { x: 0, y: 31.5 } // the motor's plug, just above the motor

const rad = (degrees: number) => (degrees * Math.PI) / 180
const at = (angle: number, far: number) => ({
  x: far * Math.cos(rad(angle)),
  y: far * Math.sin(rad(angle)),
})

/** A circle, a point to every degree, with a tab out to the socket. */
function outline() {
  const half = (Math.asin(TAB_HALF / RADIUS) * 180) / Math.PI
  const points: { x: number; y: number }[] = []
  const steps = Math.round(360 - 2 * half)
  for (let i = 0; i <= steps; i++) {
    const angle = USB_ANGLE + half + ((360 - 2 * half) * i) / steps
    points.push(at(angle, RADIUS))
  }
  const ux = Math.cos(rad(USB_ANGLE))
  const uy = Math.sin(rad(USB_ANGLE))
  const vx = -uy
  const vy = ux
  points.push({ x: TAB_REACH * ux - TAB_HALF * vx, y: TAB_REACH * uy - TAB_HALF * vy })
  points.push({ x: TAB_REACH * ux + TAB_HALF * vx, y: TAB_REACH * uy + TAB_HALF * vy })
  return points
}

const usb = at(USB_ANGLE, TAB_REACH - SOCKET_FRONT)
const USB_TURN = USB_ANGLE + 90 // the socket is drawn mouth down: turned to face out
/** A point behind the socket, in its own frame: x along its pins, y back from its mouth. */
const behindUsb = (x: number, y: number) => ({
  x: usb.x + x * Math.cos(rad(USB_TURN)) - y * Math.sin(rad(USB_TURN)),
  y: usb.y + x * Math.sin(rad(USB_TURN)) + y * Math.cos(rad(USB_TURN)),
})
const r1 = behindUsb(-2.5, 7.5)
const r2 = behindUsb(2.5, 7.5)
const c1 = behindUsb(0, 11.5)
// the motor's coils draw about a tenth of an amp each: their traces are made wider
const COIL = "0.4mm"

export default () => (
  // (the placement check boxes the socket square to the board, and so finds it off the
  // tab it sits on when it is turned: it is checked by eye, in pcb/build/main.pcb.png)
  <board
    outline={outline()}
    thickness="1.6mm"
    title="Table clock"
    placementDrcChecksDisabled
    minTraceWidth="0.15mm"
    // vias of the size a board house makes as standard
    pcbStyle={{ viaHoleDiameter: "0.3mm", viaPadDiameter: "0.6mm" }}
  >
    {/* the supply and its return carry the motor's current too: wider than the rest */}
    <net name="V5" isPowerNet nominalTraceWidth="0.5mm" />
    <net name="GND" isGroundNet nominalTraceWidth="0.5mm" />
    {/* the coils are routed first, while there is room for them */}
    <autoroutingphase
      phaseIndex={0}
      connections={["U2.1C", "U2.2C", "U2.3C", "U2.4C", "J2.pin1", "J2.pin2", "J2.pin3", "J2.pin4"]}
    />

    {/* power in: 5 V from USB-C, asking any C-to-C charger for it with 5.1k on CC */}
    <TYPE_C_6P name="J1" pcbX={usb.x} pcbY={usb.y} pcbRotation={USB_TURN} schX={-10} schY={2} />
    <resistor name="R1" resistance="5.1k" footprint="0603" supplierPartNumbers={{ jlcpcb: ["C22356467"] }} pcbX={r1.x} pcbY={r1.y} pcbRotation={USB_TURN + 90} schX={-7} schY={-1} />
    <resistor name="R2" resistance="5.1k" footprint="0603" supplierPartNumbers={{ jlcpcb: ["C22356467"] }} pcbX={r2.x} pcbY={r2.y} pcbRotation={USB_TURN + 90} schX={-6} schY={-1} />
    <capacitor name="C1" capacitance="10uF" footprint="0805" supplierPartNumbers={{ jlcpcb: ["C15850"] }} pcbX={c1.x} pcbY={c1.y} pcbRotation={USB_TURN} schX={-8} schY={4} />
    <trace from=".J1 > .VBUS1" to="net.V5" />
    <trace from=".J1 > .VBUS2" to="net.V5" />
    <trace from=".J1 > .GND1" to="net.GND" />
    <trace from=".J1 > .GND2" to="net.GND" />
    <trace from=".J1 > .EH" to="net.GND" />
    <trace from=".J1 > .CC1" to=".R1 > .pin1" />
    <trace from=".J1 > .CC2" to=".R2 > .pin1" />
    <trace from=".R1 > .pin2" to="net.GND" />
    <trace from=".R2 > .pin2" to="net.GND" />
    <trace from=".C1 > .pin1" to="net.V5" />
    <trace from=".C1 > .pin2" to="net.GND" />

    {/* the microcontroller (ATtiny1616 in SOIC-20, wide: ATTINY1616-SNR), and the watch
        crystal it keeps time by */}
    <ATTINY1616_SNR name="U1" pcbX={-29} pcbY={31} schX={0} schY={0} />
    <capacitor name="C2" capacitance="100nF" footprint="0603" supplierPartNumbers={{ jlcpcb: ["C14663"] }} pcbX={-38} pcbY={31} pcbRotation={90} schX={-3} schY={3} />
    <Q13FC13500004 name="Y1" pcbX={-25.2} pcbY={21.5} schX={4} schY={-3} />
    <capacitor name="C3" capacitance="18pF" footprint="0603" supplierPartNumbers={{ jlcpcb: ["C1647"] }} pcbX={-29.7} pcbY={21.5} pcbRotation={90} schX={3} schY={-5} />
    <capacitor name="C4" capacitance="18pF" footprint="0603" supplierPartNumbers={{ jlcpcb: ["C1647"] }} pcbX={-20.7} pcbY={21.5} pcbRotation={90} schX={5} schY={-5} />
    <trace from=".U1 > .VDD" to="net.V5" />
    <trace from=".U1 > .GND" to="net.GND" />
    <trace from=".C2 > .pin1" to="net.V5" />
    <trace from=".C2 > .pin2" to="net.GND" />
    <trace from=".U1 > .TOSC1" to=".Y1 > .pin1" />
    <trace from=".U1 > .TOSC2" to=".Y1 > .pin2" />
    <trace from=".Y1 > .pin1" to=".C3 > .pin1" />
    <trace from=".Y1 > .pin2" to=".C4 > .pin1" />
    <trace from=".C3 > .pin2" to="net.GND" />
    <trace from=".C4 > .pin2" to="net.GND" />

    {/* the button that sets the hands: on the back, pulled up inside the chip. A TE
        1-1825910-4 (FSM), 6 x 6 mm through the board, 9.5 mm tall from the board with a
        round stem (EasyEDA's 3D model of it is drawn only 4.5 mm tall) */}
    <A_1_1825910_4
      name="SW1"
      layer="bottom"
      pcbX={BUTTON.x}
      pcbY={BUTTON.y}
      schX={4}
      schY={2}
    />
    {/* (corner to corner, which is across the switch whichever way its legs pair) */}
    <trace from=".U1 > .PA1" to=".SW1 > .pin1" />
    <trace from=".SW1 > .pin3" to="net.GND" />

    {/* the pads it is programmed through: 5 V, UPDI, GND */}
    <pinheader
      name="J3"
      pinCount={3}
      pitch="2.54mm"
      gender="male"
      doNotPlace
      showSilkscreenPinLabels
      pinLabels={["V5", "UPDI", "GND"]}
      pcbX={-20}
      pcbY={47.5}
      schX={4}
      schY={4}
    />
    <trace from=".J3 > .V5" to="net.V5" />
    <trace from=".U1 > .UPDI" to=".J3 > .UPDI" />
    <trace from=".J3 > .GND" to="net.GND" />

    {/* the motor driver, and the plug the motor's lead goes into */}
    <ULN2003ADR name="U2" pcbX={-15} pcbY={38} pcbRotation={270} schX={9} schY={0} />
    <B5B_XH_A_LF__SN_ name="J2" pcbX={MOTOR_PLUG.x} pcbY={MOTOR_PLUG.y} schX={13} schY={0} />
    <capacitor name="C5" capacitance="10uF" footprint="0805" supplierPartNumbers={{ jlcpcb: ["C15850"] }} pcbX={-10} pcbY={30} pcbRotation={90} schX={11} schY={3} />
    <trace from=".U1 > .PC0" to=".U2 > .1B" />
    <trace from=".U1 > .PC1" to=".U2 > .2B" />
    <trace from=".U1 > .PC2" to=".U2 > .3B" />
    <trace from=".U1 > .PC3" to=".U2 > .4B" />
    <trace from=".U2 > .5B" to="net.GND" />
    <trace from=".U2 > .6B" to="net.GND" />
    <trace from=".U2 > .7B" to="net.GND" />
    <trace from=".U2 > .E" to="net.GND" />
    <trace from=".U2 > .COM" to="net.V5" />
    <trace from=".U2 > .1C" to=".J2 > .pin1" thickness={COIL} />
    <trace from=".U2 > .2C" to=".J2 > .pin2" thickness={COIL} />
    <trace from=".U2 > .3C" to=".J2 > .pin3" thickness={COIL} />
    <trace from=".U2 > .4C" to=".J2 > .pin4" thickness={COIL} />
    <trace from=".J2 > .pin5" to="net.V5" />
    <trace from=".C5 > .pin1" to="net.V5" />
    <trace from=".C5 > .pin2" to="net.GND" />

    {/* held to the back cover by three M2.5 pan head screws, with nothing run under
        their heads, on either side */}
    {HOLES.map((angle) => {
      const p = at(angle, HOLE_RADIUS)
      return <hole key={`hole${angle}`} diameter="2.9mm" pcbX={p.x} pcbY={p.y} />
    })}
    {HOLES.map((angle) => {
      const p = at(angle, HOLE_RADIUS)
      return (
        <keepout
          key={`keepout${angle}`}
          shape="circle"
          radius={`${HOLE_KEEPOUT}mm`}
          pcbX={p.x}
          pcbY={p.y}
          layers={["top", "bottom"]}
        />
      )
    })}

    <silkscreentext text="TABLE CLOCK" pcbX={0} pcbY={-30} fontSize="2mm" />
  </board>
)
