// The clock's tool: it sets the time the hands show, runs the movement, and holds down
// the button on the back that sets it.
//
// The wheels turn by the numbers of their teeth (model.py), so their teeth stay in
// mesh. The motor turns the centre wheel once an hour, and with it the minute hand; the
// third wheel goes round eight times, and the fourth, with the seconds hand, sixty; in
// front of the plates the hour wheel goes a twelfth of a turn.
//
// The motor is a 28BYJ-48, which goes round once in 4076 half steps (64 to a turn of
// its rotor, geared down 63.68 to one). At the clock's own pace the board gives it one
// half step every 0.88 s or so, and the hands go on in those small steps: the seconds
// hand by about five degrees at each. Run faster, they go smoothly. Held down, the button
// runs the motor as fast as it goes, about 15 turns a minute: a quarter of an hour of
// the clock's time each second.

// Where each arbor is, in mm: model.py prints these when it builds.
const CENTRE = [0, 0, 82]
const THIRD = [21.515, 0, 65.688]
const FOURTH = [0, 0, 52]
const STUD = [-16.971, 0, 98.971]

// How many times each part goes round in an hour: clockwise, seen from the front.
const TURNING = [
  { part: "centre-wheel", about: CENTRE, perHour: 1 },
  { part: "minute-hand", about: CENTRE, perHour: 1 },
  { part: "third-wheel", about: THIRD, perHour: -64 / 8 },
  { part: "fourth-wheel", about: FOURTH, perHour: 60 },
  { part: "seconds-hand", about: FOURTH, perHour: 60 },
  { part: "minute-wheel", about: STUD, perHour: -12 / 36 },
  { part: "hour-wheel", about: CENTRE, perHour: 1 / 12 },
  { part: "hour-hand", about: CENTRE, perHour: 1 / 12 },
]

// The motor: half steps to a turn of the centre wheel, which is an hour; how long one
// half step takes to make; and how fast the button runs the hands, in the clock's
// seconds to each second.
const STEPS = 4076
const STEP_TIME = 0.06
const SETTING = 15 * 60

const HALF_DAY = 12 * 60 * 60
// what the model is built showing, in seconds past twelve: ten past ten
const BUILT = 10 * 3600 + 10 * 60
const RUNNING = { back: -1, paused: 0, forward: 1 }

/** The time shown, in seconds past twelve. Null until the first frame. */
let time = null

/** From nought to one, starting and ending gently. */
const eased = (part) => part * part * (3 - 2 * part)

const two = (n) => String(Math.floor(n)).padStart(2, "0")
const worded = (seconds) =>
  `${Math.floor(seconds / 3600) || 12}:${two((seconds / 60) % 60)}:${two(seconds % 60)}`

function computerTime() {
  const now = new Date()
  return (
    (now.getHours() % 12) * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds() +
    now.getMilliseconds() / 1000
  )
}

export default {
  name: "Clock",
  controls: {
    shown: {
      kind: "readout",
      title: "Time",
      description: "What the hands show.",
    },
    set: {
      kind: "slider",
      title: "Set",
      description: "Drag to move the hands.",
      min: 0,
      max: 12 * 60 - 1,
      step: 1,
      value: BUILT / 60,
      format: (minutes) =>
        `${Math.floor(minutes / 60) || 12}:${two(minutes % 60)}`,
      change(minutes, tool) {
        time = minutes * 60
        tool.values.follow = false
      },
    },
    run: {
      kind: "choice",
      title: "Run",
      description: "Run it, pause it or wind it back.",
      options: [
        { id: "back", icon: "rewind" },
        { id: "paused", icon: "pause" },
        { id: "forward", icon: "play" },
      ],
      value: "paused",
      change(_, tool) {
        tool.values.follow = false
      },
    },
    button: {
      kind: "toggle",
      title: "Set button",
      description: "Hold the button on the back: the hands run forward fast.",
      value: false,
      change(_, tool) {
        tool.values.follow = false
      },
    },
    speed: {
      kind: "choice",
      title: "Speed",
      description: "How fast it runs.",
      options: [
        { id: "1", label: "1×" },
        { id: "60", label: "60×" },
        { id: "600", label: "600×" },
      ],
      value: "60",
      change(_, tool) {
        tool.values.follow = false
      },
    },
    follow: {
      kind: "toggle",
      title: "Computer time",
      description: "Keep to this computer’s clock.",
      value: false,
    },
    jump: {
      kind: "buttons",
      title: "Jump",
      description: "Go straight to an hour.",
      options: [
        { id: "0", label: "12:00" },
        { id: "3", label: "3:00" },
        { id: "6", label: "6:00" },
        { id: "9", label: "9:00" },
      ],
      press(hour, tool) {
        time = Number(hour) * 3600
        tool.values.follow = false
      },
    },
  },

  frame(tool) {
    // (started again, it goes on from where its slider was left)
    if (time === null) time = tool.values.set * 60
    // the button runs the motor up to its full speed and back, as a motor does
    const setting = tool.glide("button", tool.values.button ? SETTING : 0, 0.3)
    if (tool.values.follow) time = computerTime()
    else
      time +=
        (RUNNING[tool.values.run] * Number(tool.values.speed) + setting) * tool.dt
    time = ((time % HALF_DAY) + HALF_DAY) % HALF_DAY

    tool.values.shown = worded(time)
    tool.values.set = Math.floor(time / 60)

    // At its own pace the motor is stepped: it moves on by a half step, quickly, each
    // time the clock has gone on by one, and stands still between.
    const ownPace =
      setting < 1 && (tool.values.follow || tool.values.speed === "1")
    const step = 3600 / STEPS
    let going = time
    if (ownPace) {
      const steps = Math.floor(time / step)
      const into = (time - steps * step) / STEP_TIME
      going = (steps + eased(Math.min(1, into))) * step
    }

    // a turn about +Y is clockwise seen from the front, which is the way a clock goes
    const hours = (going - BUILT) / 3600
    for (const { part, about, perHour } of TURNING)
      tool.part(part).turn({ by: hours * perHour * 360, axis: "y", about })
  },
}
