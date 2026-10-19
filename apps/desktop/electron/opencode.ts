// opencode, SST's command-line agent, as one of the agents the app runs. It is started
// as `opencode acp`, which speaks the Agent Client Protocol (JSON-RPC) on its standard
// input and output: a session is a conversation, a prompt is one message answered, and
// what it does on the way arrives as updates. It answers with an account signed in or
// without one, on its free models, so reaching it is the whole of asking after it.
import os from "node:os"

import { type Access, type ModelChoice } from "../shared/api"
import {
  ASKING_TIMEOUT_MS,
  HELLO,
  LOADING_TIMEOUT_MS,
  REPLAY_QUIET_MS,
  STOPPING_TIMEOUT_MS,
  AcpTurn,
  field,
  tooLong,
  type AcpOption,
  type AcpToolCall,
} from "./acp"
import type { Launch, Looked } from "./providers"
import { NO_SUCH_METHOD, RpcError, startPeer } from "./rpc"
import {
  changesOnlyInside,
  guideAgain,
  inside,
  piecesOf,
  stopped,
  type Turn,
} from "./turn"

/** A model opencode offers, as a session says of it. */
export type OpencodeModelOption = { value: string; name: string }

/** What opencode says of its models, as the app offers them. */
export function opencodeModels(
  current: string | null | undefined,
  options: OpencodeModelOption[] | undefined
): ModelChoice[] {
  const rows = options ?? []
  const standing = rows.find((row) => row.value === current)
  return [
    // there is always the choice of leaving it to opencode
    {
      id: null,
      name: "Default",
      short: standing?.name ?? "Default",
      detail: "The model opencode is set to run",
      efforts: [],
    },
    ...rows.map((row): ModelChoice => ({
      id: row.value,
      name: row.name,
      short: row.name,
      detail: "",
      efforts: [],
    })),
  ]
}

/** How much opencode may do without asking, in its own terms. opencode's own defaults
 * let the agent change files and run commands outright, so what the app chooses has to
 * be said here as well: with nothing said, a supervised turn would edit files and run
 * commands without the app ever being asked, and the questions below would never come
 * up. The app's own tools are never asked about in any case (see where it asks leave).
 *
 * opencode has no way to judge for itself what is routine, so its `auto` and the app's
 * are not quite the same: where the agent is meant to judge, opencode is simply let to
 * change the project's files and run commands, and only what reaches outside the
 * project is still asked about. `full` lets it do that too, outside as well.
 */
const PERMISSION: Record<Access, string | Record<string, string>> = {
  supervised: { edit: "ask", bash: "ask", webfetch: "ask", websearch: "ask" },
  edits: { edit: "allow", bash: "ask", webfetch: "ask", websearch: "ask" },
  auto: { edit: "allow", bash: "allow", webfetch: "allow", websearch: "allow" },
  full: "allow",
}

/**
 * What opencode is started with, as its environment: the app's choice of how much it
 * may do without asking, said as opencode's own permission config (it has no protocol
 * one). What the user has put in that variable already is kept, with the app's choice
 * laid over it; what is not readable as JSON is left out rather than fail a turn.
 */
export function withAccess(
  env: Record<string, string | undefined>,
  access: Access
): Record<string, string | undefined> {
  let base: Record<string, unknown> = {}
  const given = env.OPENCODE_CONFIG_CONTENT
  if (given) {
    try {
      const parsed = JSON.parse(given)
      if (parsed && typeof parsed === "object") base = parsed
    } catch {
      // not a config: nothing to keep
    }
  }
  return {
    ...env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      ...base,
      permission: PERMISSION[access],
    }),
  }
}

type ConfigOption = {
  id?: string
  currentValue?: string | null
  options?: { value?: string; name?: string }[] | null
}

/**
 * What the installed opencode says of itself: that it is there, and the models it
 * offers. Its models come only with a session, which has no delete: one empty session
 * is left behind each time it is looked at.
 */
export async function lookAtOpencode(launch: Launch): Promise<Looked> {
  const peer = startPeer(launch.path, ["acp", ...launch.args], {
    cwd: os.tmpdir(),
    // (a look changes nothing, but it is started as a supervised turn would be)
    env: withAccess(launch.env, "supervised"),
    versioned: true,
    onNotification: () => {},
    onRequest: (method) =>
      Promise.reject(
        new RpcError(NO_SUCH_METHOD, `Method not found: ${method}`)
      ),
  })
  const asking = async (): Promise<Looked> => {
    await peer.request("initialize", HELLO)
    // asked so that the sign-in is awake, whatever comes of it: it answers on its
    // free models with nothing signed in, so nothing here can fail the look
    await peer
      .request("authenticate", { methodId: "opencode-login" })
      .catch(() => null)
    const made = await peer.request<{
      sessionId: string
      configOptions?: ConfigOption[] | null
    }>("session/new", { cwd: os.tmpdir(), mcpServers: [] })
    const model = (made.configOptions ?? []).find(
      (option) => option.id === "model"
    )
    return {
      // null: the version `opencode --version` printed stands, which is looked up first
      version: null,
      // it answers with an account signed in or without one, so no account is claimed:
      // the UI says it is ready rather than that somebody is signed in
      signedIn: null,
      account: null,
      trouble: null,
      models: opencodeModels(
        model?.currentValue,
        (model?.options ?? []).flatMap((option) =>
          option.value
            ? [{ value: option.value, name: option.name ?? option.value }]
            : []
        )
      ),
    }
  }
  try {
    return await Promise.race([
      asking(),
      tooLong(ASKING_TIMEOUT_MS, "opencode did not answer."),
    ])
  } finally {
    peer.close()
  }
}

/** A tool call as opencode reports one, in as much as the app reads of it. */
type ToolCall = AcpToolCall

type Option = AcpOption

/** What kind of thing a tool call is, in a word, by the kind opencode gives it. */
const KINDS: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  delete: "Delete",
  move: "Move",
  search: "Search",
  execute: "Run",
  fetch: "Fetch",
}

/** What leave is asked for, by the kind of thing it is for. */
const QUESTIONS: Record<string, string> = {
  read: "Read this file?",
  edit: "Change this file?",
  delete: "Delete this file?",
  move: "Move this file?",
  execute: "Run this command?",
  fetch: "Fetch this page?",
}

/** One turn of a conversation, run by opencode. Resolves once it is over. */
export async function runOpencode(turn: Turn): Promise<void> {
  const { launch, manner } = turn
  const halt = stopped(turn.signal)
  const run = turn.id("opencode")
  const relative = inside(turn.cwd)

  /**
   * Whether a tool call is to one of the app's own tools, and if so which. opencode
   * calls a tool it was brought over MCP by the server's name and the tool's, joined
   * with one line: viewport_screenshot. It says which tool that is under `name`, the
   * tool's own name, and that alone is gone by here, exactly. Never the title, nor
   * anything in what the tool was given: those are often words the model wrote (a bash
   * call's description for one), and a call it titled "viewport screenshot" would
   * otherwise be taken for the app's own tool and let go without a question. Nor is a
   * call opencode says runs a command or changes a file, whatever it is called.
   */
  const ours = (call: ToolCall) => {
    if (call.kind && call.kind !== "other") return null
    for (const [set, tools_] of Object.entries(turn.tools))
      for (const tool of tools_)
        if (
          call.name === `${set}_${tool.name}` ||
          call.name === `${set}__${tool.name}`
        )
          return `mcp__${set}__${tool.name}`
    return null
  }

  /** A tool call in a few words: what kind of thing, and on what. */
  const step = (call: ToolCall): { name: string; detail: string } => {
    const own = ours(call)
    if (own) return turn.describe(own, call.rawInput)
    // what kind of thing it is, it says at first only in its own words
    const kind = call.kind && call.kind !== "other" ? call.kind : ""
    const file = field(
      call.rawInput,
      "path",
      "file_path",
      "filePath",
      "target_file"
    )
    const detail =
      kind === "execute"
        ? field(call.rawInput, "command", "cmd")
        : kind === "search"
          ? field(call.rawInput, "pattern", "query", "regex")
          : kind === "fetch"
            ? field(call.rawInput, "url", "query")
            : relative(file || (call.locations?.[0]?.path ?? ""))
    if (KINDS[kind])
      return { name: KINDS[kind], detail: detail || (call.title ?? "") }
    // a tool someone else brought it, or one of its own that is none of the above
    const called = field(call.rawInput, "tool_name") || call.title || "Tool"
    return { name: called.replaceAll("__", " "), detail }
  }

  const state = new AcpTurn(turn, run, step)

  const onRequest = async (method: string, params: unknown) => {
    if (method === "session/request_permission") {
      const wanted = (params ?? {}) as {
        toolCall?: ToolCall
        options?: Option[]
      }
      const options = wanted.options ?? []
      // what it asks leave for it has often said more of already
      const call: ToolCall = {
        ...state.call(wanted.toolCall?.toolCallId),
        ...wanted.toolCall,
      }
      const choose = (...kinds: string[]) => {
        for (const kind of kinds) {
          const option = options.find((one) => one.kind === kind)
          if (option)
            return {
              outcome: { outcome: "selected", optionId: option.optionId },
            }
        }
        return { outcome: { outcome: "cancelled" } }
      }
      // The app's own tools are the point of it: they are never asked about. Where
      // everything is let, nothing is either, for the whole session; and where
      // the project's files are the agent's to change, changing them is not
      // asked about: only them, and not a file anywhere else, nor one a link in the
      // project leads out to.
      if (
        ours(call) ||
        access === "full" ||
        (access === "edits" &&
          call.kind === "edit" &&
          changesOnlyInside(turn.cwd, call))
      )
        return access === "full" && !ours(call)
          ? choose("allow_always", "allow_once")
          : choose("allow_once", "allow_always")
      const shown = step(call)
      const answer = await turn.ask({
        title: QUESTIONS[call.kind ?? ""] ?? `Let opencode use ${shown.name}?`,
        detail: shown.detail,
        canAlways: options.some((one) => one.kind === "allow_always"),
      })
      if (turn.signal.aborted) return { outcome: { outcome: "cancelled" } }
      return answer === "deny"
        ? choose("reject_once")
        : answer === "always"
          ? choose("allow_always", "allow_once")
          : choose("allow_once")
    }
    // anything else it wants a say on has no form here, and goes without
    throw new RpcError(NO_SUCH_METHOD, `Method not found: ${method}`)
  }

  // (a model is looked over with the app's tools: anything else is put to the user)
  const access = turn.lookOver ? "supervised" : manner.access
  const peer = startPeer(launch.path, ["acp", ...launch.args], {
    cwd: turn.cwd,
    // started with the app's choice of how much it may do without asking, said as
    // opencode's own permission config; without it, opencode would not ask at all
    env: withAccess(launch.env, access),
    versioned: true,
    onNotification: state.notification,
    onRequest,
  })
  // gone before the turn was over: what it last said to stderr is why, if anything is
  const died = peer.gone.then(() => {
    throw new Error(
      peer.stderr() || "opencode exited before the turn was over."
    )
  })
  died.catch(() => {})

  try {
    await Promise.race([peer.request("initialize", HELLO), halt, died])
    // asked so that the sign-in is awake, whatever comes of it: it answers on its
    // free models with nothing signed in
    await Promise.race([
      peer.request("authenticate", { methodId: "opencode-login" }),
      halt,
      died,
    ]).catch(() => {})

    const where = {
      cwd: turn.cwd,
      // where the app's own tools answer, for as long as this turn lasts
      mcpServers: Object.entries(turn.served).map(([name, url]) => ({
        type: "http",
        name,
        url,
        headers: [],
      })),
    }
    const begin = async () => {
      const made = await peer.request<{ sessionId: string }>(
        "session/new",
        where
      )
      return made.sessionId
    }
    /** Take up the session the conversation was last in. Whether it could be. */
    const resume = async (id: string) => {
      state.beginReplay()
      const quiet = new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (
            state.replayed > 0 &&
            Date.now() - state.replayed >= REPLAY_QUIET_MS
          ) {
            clearInterval(timer)
            resolve()
          }
        }, 200)
        timer.unref()
        void peer.gone.then(() => clearInterval(timer))
      })
      try {
        await Promise.race([
          peer.request("session/load", { sessionId: id, ...where }),
          quiet,
          tooLong(
            LOADING_TIMEOUT_MS,
            "opencode took too long to take the conversation up again."
          ),
        ])
        return true
      } catch (error) {
        if (turn.signal.aborted) throw error
        return false
      } finally {
        state.endReplay()
      }
    }

    let resumed = false
    if (turn.sessionId) {
      resumed = await Promise.race([resume(turn.sessionId), halt, died])
      if (resumed) state.sessionId = turn.sessionId
      else
        turn.notice(
          "info",
          "opencode could not find its record of this conversation, so it carries on without what was said before."
        )
    }
    if (!resumed) state.sessionId = await Promise.race([begin(), halt, died])
    turn.session(state.sessionId)

    // which model answers is said only where the user chose: opencode takes no
    // session for how hard it thinks
    if (manner.model)
      await Promise.race([
        peer.request("session/set_config_option", {
          sessionId: state.sessionId,
          configId: "model",
          value: manner.model,
        }),
        halt,
        died,
      ]).catch((error: unknown) => {
        if (turn.signal.aborted) throw error
        turn.notice(
          "info",
          `opencode would not take ${manner.model} for its model, and answers as it is set.`
        )
      })

    // opencode takes no instructions apart from the message: a session begun
    // afresh is told of the project with it, and one taken up again keeps what
    // it began with
    const pieces = piecesOf(turn.content)
    type Block =
      | { type: "text"; text: string }
      | { type: "image"; data: string; mimeType: string }
    const words = (text: string): Block => ({ type: "text", text })
    const picture = (data: string, mimeType: string): Block => ({
      type: "image",
      data,
      mimeType,
    })
    const prompt: Block[] = [
      ...(!resumed ? [words(turn.guide)] : []),
      ...(resumed && turn.guideChanged ? [words(guideAgain(turn.guide))] : []),
      ...pieces.flatMap((piece): Block[] =>
        piece.type === "text"
          ? [words(piece.text)]
          : [picture(piece.data, piece.mimeType)]
      ),
    ]
    // opencode answers the prompt it was sent: its stop is in the answer
    const answered = peer
      .request<{ stopReason?: string | null }>("session/prompt", {
        sessionId: state.sessionId,
        prompt,
      })
      .then((result) => result?.stopReason ?? null)
    const stopReason = await Promise.race([answered, halt, died])
    state.hush()
    if (stopReason === "refusal")
      turn.notice("error", "opencode declined to answer this.")
    else if (stopReason === "max_tokens" || stopReason === "max_turn_requests")
      turn.notice(
        "info",
        "opencode stopped before it was done: it had reached the most it does in one turn."
      )
  } catch (error) {
    // Stopped part of the way: opencode is told, and given a moment to leave the
    // session as it should be left, so that the conversation can be carried on
    // from here.
    if (turn.signal.aborted && state.sessionId) {
      peer.notify("session/cancel", { sessionId: state.sessionId })
      await Promise.race([
        peer.gone,
        new Promise((resolve) => setTimeout(resolve, STOPPING_TIMEOUT_MS)),
      ])
    }
    throw error
  } finally {
    // what was in flight did not finish
    state.abandon()
    peer.close()
  }
}
