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

/**
 * How long what goes over the network is given, ms: a push to a connection that has
 * stalled would otherwise hold up every commit after it, for good.
 */
export const NETWORK_TIMEOUT_MS = 2 * 60_000

/** Whether a run of git goes over the network: what is given a time to be done in. */
export const overNetwork = (args: string[]) =>
  ["push", "fetch", "pull", "clone", "ls-remote"].includes(
    args[0] === "lfs" ? args[1] : args[0]
  )

export const git: Git = async (args, cwd, env = {}) => {
  const signal = overNetwork(args)
    ? AbortSignal.timeout(NETWORK_TIMEOUT_MS)
    : undefined
  try {
    const done = await exec([...OVER, ...args], cwd, {
      env: { ...QUIET, ...env },
      maxBuffer: 64 * 1024 * 1024,
      signal,
    })
    return {
      code: done.exitCode,
      stdout: String(done.stdout),
      stderr: String(done.stderr),
    }
  } catch (error) {
    if (signal?.aborted)
      throw new Error(
        `git ${args.join(" ")} took longer than ${NETWORK_TIMEOUT_MS / 60_000} minutes, and was stopped.`,
        { cause: error }
      )
    throw error
  }
}
