// Writing what the app keeps so that it is never found half written. What is to be in a
// file is written into another beside it, made to reach the disk, and then put in its
// place in one step: an app that is quit, or a machine that goes off, in the middle of
// it leaves the file as it was, or as it is now, and never a part of each. And a file
// the app finds it cannot read is moved aside, under a name that says so, before
// anything is written in its place: nothing that was kept is written over unseen.
import fs from "node:fs"

/** How many files have been written so far: no two at once go to the same name beside. */
let written = 0

/** Where what is to be in a file is written first: beside it, by a name of this run's own. */
const besideOf = (file: string) => `${file}.tmp-${process.pid}-${++written}`

/**
 * Write a file whole, or not at all. `mode` is who may read it, where that is not
 * everyone the system lets read what the app writes.
 */
export function writeWhole(
  file: string,
  data: string | Uint8Array,
  mode?: number
) {
  const beside = besideOf(file)
  try {
    const fd = fs.openSync(beside, "w", mode ?? 0o666)
    try {
      // (what the system takes off a mode as a file is made is taken off this too)
      if (mode !== undefined) fs.fchmodSync(fd, mode)
      fs.writeFileSync(fd, data)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(beside, file)
  } catch (error) {
    fs.rmSync(beside, { force: true })
    throw error
  }
}

/** The same, without holding the app up while the disk is written to. */
export async function writeWholeSoon(
  file: string,
  data: string | Uint8Array,
  mode?: number
) {
  const beside = besideOf(file)
  try {
    const handle = await fs.promises.open(beside, "w", mode ?? 0o666)
    try {
      if (mode !== undefined) await handle.chmod(mode)
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await fs.promises.rename(beside, file)
  } catch (error) {
    await fs.promises.rm(beside, { force: true })
    throw error
  }
}

/**
 * Move a file that could not be read out of the way, beside where it was, as
 * `<name>.corrupt-<when>`: for whoever wants what was in it, and so that nothing is
 * written over it. Where it went; null if it was not there, or could not be moved.
 */
export function setAside(file: string, now = Date.now()): string | null {
  const aside = `${file}.corrupt-${now}`
  try {
    fs.renameSync(file, aside)
    return aside
  } catch {
    return null
  }
}

/** Whether what went wrong reading a file is only that there is none. */
export const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException | null)?.code === "ENOENT"
