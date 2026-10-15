// Builds one of a project's circuit boards, for Enclose (https://enclose.dev).
//
// This file belongs to Enclose: run it from where the app keeps it, and do not copy it
// into a project. A board is written with tscircuit, in a project's pcb/ folder, and
// this builds it with tscircuit's own command line (`tsci build`), fetched by npx the
// first time and kept from then on:
//
//     node /path/to/kit/board.mjs pcb/main.circuit.tsx
//
// What it makes goes in pcb/build/, beside the board, each file named for it:
//
//     main.circuit.json   the board as tscircuit has it: what the app draws it from
//     main.glb            the board in 3D, as the app shows it
//     main.step           the board in 3D, for the model to take in
//     main.pcb.png        pictures of it, to check it by: the board,
//     main.schematic.png  its schematic,
//     main.3d.png         and the board in 3D
//
// It is built in a folder of its own, out of the project, so that nothing of tscircuit's
// is left in the project but what it made. Anything after the board's file is handed on
// to `tsci build` as it is (--routing-disabled, say). Where the build fails, what was
// built before is left as it was, and it says why.
//
// It needs Node.js 18 or later, and the internet the first time, for tscircuit itself.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/** The tscircuit it builds with: the one the app is known to work with. */
const TSCIRCUIT = "tscircuit@0.0.2892"

/** What a board's file is called: its name, as the app knows the board by it, and this. */
const ENDING = ".circuit.tsx"
/** What the app takes for a board's name: lower case, and nothing an address cannot hold. */
const NAME = /^[a-z0-9][a-z0-9-]*$/

/** What the build writes, under what each is called in pcb/build/. */
const MADE = [
  ["3d.glb", "glb"],
  ["3d.step", "step"],
  ["pcb.png", "pcb.png"],
  ["schematic.png", "schematic.png"],
  ["3d.png", "3d.png"],
  // last: what the app goes by, so that the rest is there by the time it looks
  ["circuit.json", "circuit.json"],
]

const stop = (why) => {
  console.error(why)
  process.exit(1)
}

const [given, ...rest] = process.argv.slice(2)
if (!given)
  stop("Say which board to build: node board.mjs pcb/<name>.circuit.tsx")
const file = path.resolve(given)
if (!fs.existsSync(file)) stop(`There is no ${given}.`)
const name = path.basename(file).endsWith(ENDING)
  ? path.basename(file).slice(0, -ENDING.length)
  : null
if (!name || !NAME.test(name))
  stop(
    `A board's file is called <name>${ENDING}, its name in lower case letters, figures and hyphens (main${ENDING}): ${path.basename(file)} is not.`
  )

// The board's folder, as it is, but for what was built of it: in a folder of its own
// that is kept from one build to the next, for what tscircuit keeps there of the parts
// it has looked up.
const folder = path.dirname(file)
const built = path.join(folder, "build")
const work = path.join(
  os.tmpdir(),
  "enclose-boards",
  createHash("sha1").update(folder).digest("hex").slice(0, 12)
)
fs.mkdirSync(work, { recursive: true })
for (const entry of fs.readdirSync(work))
  if (entry !== ".tscircuit")
    fs.rmSync(path.join(work, entry), { recursive: true, force: true })
for (const entry of fs.readdirSync(folder))
  if (entry !== "build" && !entry.startsWith("."))
    fs.cpSync(path.join(folder, entry), path.join(work, entry), {
      recursive: true,
    })

const ran = spawnSync(
  "npx",
  [
    "--yes",
    "-p",
    TSCIRCUIT,
    "tsci",
    "build",
    path.basename(file),
    "--glbs",
    "--step",
    "--pcb-png",
    "--schematic-png",
    "--3d-png",
    ...rest,
  ],
  {
    cwd: work,
    stdio: "inherit",
    // npm 12 fetches nothing from git unless it is let: tscircuit has a part that is
    // (as an environment variable, which an older npm passes over)
    env: { ...process.env, npm_config_allow_git: "all" },
    shell: process.platform === "win32",
  }
)
if (ran.error)
  stop(
    `Could not run npx: ${ran.error.message}. tscircuit needs Node.js 18 or later.`
  )
if (ran.status !== 0) {
  console.error(
    `\nThe board did not build, so what was built of it before is left as it was.`
  )
  process.exit(ran.status ?? 1)
}

// where it put them: dist/, under the board's file's name
const out = path.join(work, "dist", name)
if (!fs.existsSync(path.join(out, "circuit.json")))
  stop(`tscircuit built the board but wrote no circuit.json in ${out}.`)
fs.mkdirSync(built, { recursive: true })
const wrote = []
for (const [from, to] of MADE) {
  const source = path.join(out, from)
  if (!fs.existsSync(source)) continue
  const target = path.join(built, `${name}.${to}`)
  // whole, or not at all: the app may read it the moment it is there
  fs.copyFileSync(source, `${target}.part`)
  fs.renameSync(`${target}.part`, target)
  wrote.push(path.relative(process.cwd(), target))
}
console.log(`\nBuilt ${name}:\n${wrote.map((one) => `  ${one}`).join("\n")}`)
