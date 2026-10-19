import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Drafts } from "./drafts"

let top: string
let root: string
let manifest: string
let working: boolean
let changes: number
let drafts: Drafts

const write = (file: string, content: string) => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

/** A build that writes a manifest where enclose.py would: in the draft's folder, if named. */
const BUILD = `out="\${ENCLOSE_DRAFT:-build}"; mkdir -p "$out"; echo '{"parts":[]}' > "$out/enclose.model.json"`

function make() {
  drafts = new Drafts({
    folder: path.join(top, "drafts"),
    ids: () => ["p"],
    project: () => ({ path: root, build: "sh build.sh", manifest }),
    working: () => working,
    env: () => process.env,
    onChange: () => changes++,
  })
}

beforeEach(() => {
  top = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "enclose-test-")))
  root = path.join(top, "project")
  manifest = path.join(root, "build", "enclose.model.json")
  write("build.sh", BUILD)
  write("enclose.py", 'DRAFT = "ENCLOSE_DRAFT"\n')
  write("build/enclose.model.json", '{"parts":[]}')
  // the project's own build is from before
  const before = new Date(Date.now() - 60_000)
  fs.utimesSync(manifest, before, before)
  working = true
  changes = 0
})
afterEach(() => {
  drafts.close()
  fs.rmSync(top, { recursive: true, force: true })
})

/**
 * A moment for the folder to be watched from: a watch begun in a busy process can miss
 * what is written the instant after (in the app it is begun as the turn is, well before)
 */
const watched = () => new Promise((done) => setTimeout(done, 500))

/** how long a draft is waited for: a build, under the load of every other test */
const WAIT_MS = 10_000

describe("Drafts", { timeout: 15_000 }, () => {
  it("builds the model by itself as the agent writes its script, and shows that", async () => {
    make()
    drafts.sync()
    await watched()
    write("model.py", "print('changed')")
    await vi.waitFor(() => expect(drafts.shown("p")).not.toBeNull(), {
      timeout: WAIT_MS,
    })
    const shown = drafts.shown("p")!
    expect(shown.startsWith(path.join(top, "drafts", "p"))).toBe(true)
    expect(fs.existsSync(shown)).toBe(true)
    expect(drafts.stamp("p")).toBe(1)
    expect(changes).toBe(1)
    // the project's own build is left as it was
    expect(fs.statSync(manifest).mtimeMs).toBeLessThan(Date.now() - 30_000)
  })

  it("shows the project's own build once that is newer", async () => {
    make()
    drafts.sync()
    await watched()
    write("model.py", "")
    await vi.waitFor(() => expect(drafts.shown("p")).not.toBeNull(), {
      timeout: WAIT_MS,
    })
    write("build/enclose.model.json", '{"parts":[]}')
    expect(drafts.shown("p")).toBeNull()
  })

  it("puts the draft away once the agent is done", async () => {
    make()
    drafts.sync()
    await watched()
    write("model.py", "")
    await vi.waitFor(() => expect(drafts.shown("p")).not.toBeNull(), {
      timeout: WAIT_MS,
    })
    working = false
    drafts.sync()
    expect(drafts.shown("p")).toBeNull()
    // the view loads the project's own build again
    expect(drafts.stamp("p")).toBe(2)
    expect(fs.existsSync(path.join(top, "drafts", "p"))).toBe(false)
  })

  it("makes none with an older copy of the exporter, which would write build/", async () => {
    write("enclose.py", "# an older copy\n")
    make()
    drafts.sync()
    await watched()
    write("model.py", "")
    await new Promise((done) => setTimeout(done, 1600))
    expect(drafts.shown("p")).toBeNull()
    expect(fs.statSync(manifest).mtimeMs).toBeLessThan(Date.now() - 30_000)
    // and it was heard: brought up to date, the exporter makes one
    write("enclose.py", 'DRAFT = "ENCLOSE_DRAFT"\n')
    await vi.waitFor(() => expect(drafts.shown("p")).not.toBeNull(), {
      timeout: WAIT_MS,
    })
    expect(fs.statSync(manifest).mtimeMs).toBeLessThan(Date.now() - 30_000)
  })

  it("makes none while no agent is at work", async () => {
    working = false
    make()
    drafts.sync()
    await watched()
    write("model.py", "")
    await new Promise((done) => setTimeout(done, 1600))
    expect(drafts.shown("p")).toBeNull()
    expect(changes).toBe(0)
    // none was made unseen, either: with an agent at work now, there is still none
    working = true
    expect(drafts.shown("p")).toBeNull()
    // until the script is written again
    drafts.sync()
    await watched()
    write("model.py", "print('changed')")
    await vi.waitFor(() => expect(drafts.shown("p")).not.toBeNull(), {
      timeout: WAIT_MS,
    })
    expect(changes).toBe(1)
  })
})
