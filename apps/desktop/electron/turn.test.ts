import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  bare,
  changesOnlyInside,
  guideAgain,
  inside,
  isInside,
  piecesOf,
  Saying,
  stopped,
} from "./turn"

describe("isInside", () => {
  it("goes by where a file really is, wherever links lead", () => {
    // (on a Mac the temporary folder is a link itself: /var is /private/var)
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-inside-"))
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-outside-"))
    try {
      fs.mkdirSync(path.join(root, "parts"))
      fs.symlinkSync(outside, path.join(root, "out"))
      fs.symlinkSync(path.join(outside, "gone"), path.join(root, "nowhere"))
      const real = fs.realpathSync(root)
      expect(isInside(root, "model.py")).toBe(true)
      expect(isInside(root, path.join(real, "parts", "new", "lid.py"))).toBe(
        true
      )
      expect(isInside(real, path.join(root, "model.py"))).toBe(true)
      expect(isInside(root, "../elsewhere.py")).toBe(false)
      expect(isInside(root, "out/x.py")).toBe(false)
      expect(isInside(root, "out/new/x.py")).toBe(false)
      // a link that leads nowhere yet: whatever is written to it lands out there
      expect(isInside(root, "nowhere")).toBe(false)
      expect(isInside(root, `${root}-sibling/x.py`)).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })
})

describe("changesOnlyInside", () => {
  const root = os.tmpdir()
  it("is every file the call names being inside", () => {
    expect(
      changesOnlyInside(root, {
        locations: [{ path: "a.py" }],
        rawInput: { file_path: "b.py" },
      })
    ).toBe(true)
    expect(
      changesOnlyInside(root, {
        locations: [{ path: "a.py" }],
        rawInput: { filePath: "/etc/hosts" },
      })
    ).toBe(false)
  })

  it("is not known of a call that names nothing, or carries a patch", () => {
    expect(changesOnlyInside(root, { rawInput: {} })).toBe(false)
    expect(
      changesOnlyInside(root, {
        locations: [{ path: "a.py" }],
        rawInput: { patchText: "*** Update File: /etc/hosts" },
      })
    ).toBe(false)
  })
})

describe("bare", () => {
  it("is a command without the shell it was wrapped in to be run", () => {
    expect(bare('/bin/zsh -lc "python3 model.py"')).toBe("python3 model.py")
    expect(bare("bash -lc 'ls -la build'")).toBe("ls -la build")
    expect(bare("sh -c 'echo hi'")).toBe("echo hi")
  })

  it("leaves any other command as it is", () => {
    expect(bare("python3 model.py")).toBe("python3 model.py")
    expect(bare("  git status ")).toBe("git status")
  })
})

describe("piecesOf", () => {
  it("is the words, of a message that is only words", () => {
    expect(piecesOf("A lid")).toEqual([{ type: "text", text: "A lid" }])
  })

  it("is the words and pictures in the order they come", () => {
    expect(
      piecesOf([
        { type: "text", text: "Picture 1: from the front" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "AAAA" },
        },
        { type: "text", text: "The parts" },
      ])
    ).toEqual([
      { type: "text", text: "Picture 1: from the front" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
      { type: "text", text: "The parts" },
    ])
  })
})

describe("guideAgain", () => {
  it("puts what the agent is to know now where it cannot be taken for the message", () => {
    const again = guideAgain("- The build command is: python3 model.py")
    expect(again.startsWith("<enclose>\n")).toBe(true)
    expect(again.endsWith("\n</enclose>")).toBe(true)
    expect(again).toContain("- The build command is: python3 model.py")
  })
})

describe("stopped", () => {
  it("rejects once the turn is stopped, and at once if it already was", async () => {
    const abort = new AbortController()
    const halt = stopped(abort.signal)
    abort.abort()
    await expect(halt).rejects.toThrow("Stopped.")
    await expect(stopped(abort.signal)).rejects.toThrow("Stopped.")
  })
})

describe("Saying", () => {
  /** everything it gives, until it ends */
  const all = async (saying: Saying) => {
    const heard: string[] = []
    for await (const said of saying) heard.push(said)
    return heard
  }

  it("gives what is said as it is said, and ends when it is ended", async () => {
    const saying = new Saying()
    const heard = all(saying)
    saying.say("Use a 0603 crystal.")
    await new Promise((done) => setTimeout(done, 5))
    saying.say("Keep the holes.")
    saying.end()
    expect(await heard).toEqual(["Use a 0603 crystal.", "Keep the holes."])
  })

  // (what a board made in the background was told by: its session waits for it to end,
  // and a job whose result was in was never done with)
  it("ends with nothing said at all, while it is being waited on", async () => {
    const saying = new Saying()
    const heard = all(saying)
    await new Promise((done) => setTimeout(done, 5))
    saying.end()
    expect(await heard).toEqual([])
  })

  it("takes nothing more once it has ended", async () => {
    const saying = new Saying()
    saying.end()
    expect(saying.say("Too late.")).toBe(false)
    expect(await all(saying)).toEqual([])
  })
})

describe("inside", () => {
  it("says where a file is from the folder, and leaves one outside it whole", () => {
    const from = inside("/a/b")
    expect(from("/a/b/model.py")).toBe("model.py")
    expect(from("/a/b/build/enclose.model.json")).toBe(
      path.join("build", "enclose.model.json")
    )
    // a folder whose name only begins as this one's is another folder
    expect(from("/a/bc/model.py")).toBe("/a/bc/model.py")
    expect(from("/a/b")).toBe("/a/b")
  })

  it("knows the folder by the other way to it, as an agent may give it", () => {
    // as /tmp is to /private/tmp on a Mac
    const top = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-inside-"))
    try {
      const real = path.join(top, "private-tmp")
      const link = path.join(top, "tmp")
      fs.mkdirSync(real)
      fs.symlinkSync(real, link)
      const from = inside(link)
      expect(from(path.join(link, "model.py"))).toBe("model.py")
      expect(from(path.join(fs.realpathSync(real), "model.py"))).toBe(
        "model.py"
      )
      expect(from(`${fs.realpathSync(real)}x/model.py`)).toBe(
        `${fs.realpathSync(real)}x/model.py`
      )
    } finally {
      fs.rmSync(top, { recursive: true, force: true })
    }
  })

  it("has the one name for a folder that is not there", () => {
    expect(inside("/nowhere/at/all")("/nowhere/at/all/model.py")).toBe(
      "model.py"
    )
  })
})
