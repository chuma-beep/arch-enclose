// The git the app runs: its own, with Git LFS, which it has beside it (dugite), and not
// whatever the machine has or lacks. Nobody is asked anything by it: what it needs to
// be told, the app tells it.
import { exec } from "dugite"

import type { Git } from "./backup"

/** What every run of it is given: no prompt, and nothing of the user's kept from it. */
const QUIET = {
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
}

/**
 * What every run of it is told, over whatever a repository's own config says: anything
 * in the folder can write that, the agent included. So no hook it has is run, nor a file
 * watcher, nor anything to sign with; Git LFS's filters are Git LFS's; and nothing is
 * pushed or fetched by a command of the repository's choosing.
 */
const OVER = [
  // a password asked for is never kept by whatever keeps the user's own
  "credential.helper=",
  "core.hooksPath=/dev/null",
  "core.fsmonitor=false",
  "core.askPass=",
  "commit.gpgSign=false",
  "protocol.ext.allow=never",
  "protocol.ssh.allow=never",
  "filter.lfs.clean=git-lfs clean -- %f",
  "filter.lfs.smudge=git-lfs smudge -- %f",
  "filter.lfs.process=git-lfs filter-process",
  "filter.lfs.required=true",
].flatMap((setting) => ["-c", setting])

export const git: Git = async (args, cwd, env = {}) => {
  const done = await exec([...OVER, ...args], cwd, {
    env: { ...QUIET, ...env },
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    code: done.exitCode,
    stdout: String(done.stdout),
    stderr: String(done.stderr),
  }
}
