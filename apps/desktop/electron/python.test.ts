import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fetchUv, Python, type PythonStatus } from "./python"

describe("Python", () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-python-"))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  /** A python3 that has build123d where the file `has` is there. */
  const pythonAt = (file: string, has: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `#!/bin/sh\n[ -e "${has}" ]\n`, { mode: 0o755 })
  }

  /**
   * A uv that makes a python3 where it is asked to, and puts build123d in it, unless
   * `fails`. What it was asked is kept in `asked`.
   */
  const fakeUv = (fails = false) => {
    const uv = path.join(dir, "fake-uv")
    const asked = path.join(dir, "asked")
    fs.writeFileSync(
      uv,
      [
        "#!/bin/sh",
        `echo "$@" >> "${asked}"`,
        'if [ "$1" = venv ]; then',
        "  for last; do :; done",
        '  mkdir -p "$last/bin"',
        `  printf '#!/bin/sh\\n[ -e "%s/has" ]\\n' "$last" > "$last/bin/python3"`,
        '  chmod +x "$last/bin/python3"',
        "  exit 0",
        "fi",
        fails
          ? 'echo "error: No solution found for build123d" >&2; exit 1'
          : [
              'while [ "$1" != --python ]; do shift; done',
              'touch "$(dirname "$(dirname "$2")")/has"',
            ].join("\n"),
      ].join("\n"),
      { mode: 0o755 }
    )
    return {
      uv,
      asked: () => fs.readFileSync(asked, "utf8").trim().split("\n"),
    }
  }

  const make = (theirs: string | null, uv: string) => {
    const seen: PythonStatus[] = []
    const python = new Python({
      dir: path.join(dir, "app"),
      env: () => ({ ...process.env }),
      locate: async () => theirs,
      onChange: () => seen.push(python.get()),
      uv: async () => uv,
    })
    return { python, seen }
  }

  it("builds with the python3 a terminal would run, where that has build123d", async () => {
    const theirs = path.join(dir, "bin", "python3")
    pythonAt(theirs, theirs)
    const { python } = make(theirs, "/nonexistent")
    expect(await python.ready()).toBe(true)
    expect(python.get()).toEqual({ state: "theirs" })
    // nothing to put first on the PATH: theirs is on it
    expect(python.bin()).toBeNull()
  })

  it("makes a Python of its own where there is none with build123d, once", async () => {
    const theirs = path.join(dir, "bin", "python3")
    pythonAt(theirs, path.join(dir, "nothing"))
    const { uv, asked } = fakeUv()
    const { python, seen } = make(theirs, uv)
    expect(await python.ready()).toBe(true)
    expect(python.get()).toEqual({ state: "ours" })
    expect(python.bin()).toBe(path.join(dir, "app", "env", "bin"))
    expect(seen.map((one) => ("step" in one ? one.step : one.state))).toEqual([
      "Getting uv",
      "Getting Python",
      "Getting build123d",
      "ours",
    ])
    expect(asked()).toHaveLength(2)
    // the build123d the app is known to work with, and not whichever is newest
    expect(asked()[1].split(" ").at(-1)).toBe("build123d==0.11.1")

    // the next time the app opens, the one it made is there to be used
    const again = make(theirs, uv)
    expect(await again.python.ready()).toBe(true)
    expect(again.python.get()).toEqual({ state: "ours" })
    expect(asked()).toHaveLength(2)
  })

  it("says why it could not make one, and tries again when asked again", async () => {
    const { uv } = fakeUv(true)
    const { python } = make(null, uv)
    expect(await python.ready()).toBe(false)
    expect(python.get()).toEqual({
      state: "failed",
      detail: "error: No solution found for build123d",
    })
    expect(python.bin()).toBeNull()

    fakeUv()
    expect(await python.ready()).toBe(true)
    expect(python.get()).toEqual({ state: "ours" })
  })
})

describe("fetchUv", () => {
  let dir: string
  beforeEach(() => {
    dir = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "enclose-uv-")),
      "python"
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(path.dirname(dir), { recursive: true, force: true })
  })

  /** A download that hands over these bytes, keeping where it was asked for. */
  const download = (bytes: string) => {
    const asked: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url)
      return new Response(bytes)
    })
    return asked
  }

  it("runs nothing it was not made knowing, and writes none of it", async () => {
    const asked = download("not uv")
    await expect(fetchUv(dir)).rejects.toThrow(
      "The uv that was downloaded is not the one expected."
    )
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatch(/^https:\/\/github\.com\/astral-sh\/uv\//)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it("says so where it cannot be downloaded", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }))
    await expect(fetchUv(dir)).rejects.toThrow("Could not download uv (503).")
    expect(fs.existsSync(dir)).toBe(false)
  })

  it("downloads none where it has it already", async () => {
    // where it would be, by the name its download has
    const first = download("not uv")
    await fetchUv(dir).catch(() => {})
    const name = path.basename(first[0], ".tar.gz")
    const uv = path.join(dir, name, "uv")
    fs.mkdirSync(path.dirname(uv), { recursive: true })
    fs.writeFileSync(uv, "")
    const asked = download("not uv")
    expect(await fetchUv(dir)).toBe(uv)
    expect(asked).toEqual([])
  })
})
