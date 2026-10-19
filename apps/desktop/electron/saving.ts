// Where a dialog to save with opens: in the folder the last thing was saved into, whatever
// it was (a part, a board, a guide, drawings), for as long as that folder is there; and
// until anything has been, where it is told to (Downloads). Kept in a file of its own, for
// the next time the app is opened as well.
import fs from "node:fs"
import path from "node:path"

import { writeWhole } from "./atomic"

const isFolder = (at: string) => {
  try {
    return fs.statSync(at).isDirectory()
  } catch {
    return false
  }
}

export class SaveFolder {
  /** the file the folder is kept in */
  private readonly kept: string
  /** where to save until anything has been, or where the last was has gone */
  private readonly otherwise: () => string
  private last: string | null = null

  constructor(kept: string, otherwise: () => string) {
    this.kept = kept
    this.otherwise = otherwise
    try {
      this.last = fs.readFileSync(kept, "utf8").trim() || null
    } catch {
      // nothing has been saved yet
    }
  }

  /** The folder a dialog opens in. */
  folder(): string {
    return this.last && isFolder(this.last) ? this.last : this.otherwise()
  }

  /** Where a file of this name goes in it: what a dialog that saves one offers. */
  offer(name: string): string {
    return path.join(this.folder(), name)
  }

  /** Something was saved into this folder: the next dialog opens there. */
  savedIn(folder: string) {
    this.last = folder
    try {
      fs.mkdirSync(path.dirname(this.kept), { recursive: true })
      writeWhole(this.kept, `${folder}\n`)
    } catch {
      // not kept for the next time the app is opened: it is still kept until then
    }
  }
}
