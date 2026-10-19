import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { missing, setAside, writeWhole, writeWholeSoon } from "./atomic"

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-atomic-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("writeWhole", () => {
  it("writes a file, and writes over it, leaving nothing beside it", () => {
    const file = path.join(dir, "kept.json")
    writeWhole(file, "one")
    writeWhole(file, "two")
    expect(fs.readFileSync(file, "utf8")).toBe("two")
    expect(fs.readdirSync(dir)).toEqual(["kept.json"])
  })

  it("gives the file the mode it is asked to have, whatever it had", () => {
    const file = path.join(dir, "secret.json")
    fs.writeFileSync(file, "{}", { mode: 0o644 })
    writeWhole(file, "{}", 0o600)
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  })

  it("leaves the file as it was where it cannot be written, and nothing beside it", () => {
    const file = path.join(dir, "kept.json")
    writeWhole(file, "one")
    // a folder where the file would go: it cannot take the file's place
    const blocked = path.join(dir, "blocked")
    fs.mkdirSync(path.join(blocked, "x"), { recursive: true })
    expect(() => writeWhole(blocked, "two")).toThrow()
    expect(fs.readFileSync(file, "utf8")).toBe("one")
    expect(fs.readdirSync(dir).sort()).toEqual(["blocked", "kept.json"])
  })

  it("does the same without holding anything up", async () => {
    const file = path.join(dir, "kept.json")
    await writeWholeSoon(file, "one", 0o600)
    await writeWholeSoon(file, "two", 0o600)
    expect(fs.readFileSync(file, "utf8")).toBe("two")
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(dir)).toEqual(["kept.json"])
  })
})

describe("setAside", () => {
  it("moves a file out of the way, under a name that says so, with what was in it", () => {
    const file = path.join(dir, "projects.json")
    fs.writeFileSync(file, "{ cut short")
    const aside = setAside(file, 1234)
    expect(aside).toBe(`${file}.corrupt-1234`)
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.readFileSync(aside!, "utf8")).toBe("{ cut short")
  })

  it("has nothing to move where there is no file", () => {
    expect(setAside(path.join(dir, "none.json"))).toBeNull()
  })
})

describe("missing", () => {
  it("tells there being no file from anything else going wrong", () => {
    let error: unknown
    try {
      fs.readFileSync(path.join(dir, "none.json"))
    } catch (caught) {
      error = caught
    }
    expect(missing(error)).toBe(true)
    try {
      fs.readFileSync(dir)
    } catch (caught) {
      error = caught
    }
    expect(missing(error)).toBe(false)
  })
})
