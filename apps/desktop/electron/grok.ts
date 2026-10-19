// Grok, xAI's command-line agent, as one of the agents the app runs. It is started as
// `grok agent stdio`, which speaks the Agent Client Protocol (JSON-RPC) on its standard
// input and output: a session is a conversation, a prompt is one message answered, and
// what it does on the way arrives as updates. The account it works for is whichever is
// signed in to the Grok on this machine.
import os from "node:os"

import { EFFORTS, type Access, type ModelChoice } from "../shared/api"
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

/** The models Grok has, as it says so on taking up the line. */
export type GrokModels = {
  currentModelId?: string | null
  availableModels?: {
    modelId: string
    name?: string | null
    description?: string | null
    _meta?: {
      supportsReasoningEffort?: boolean
      reasoningEfforts?: { id?: string; value?: string }[]
    } | null
  }[]
}

type Hello = {
  _meta?: {
    agentVersion?: string
    defaultAuthMethodId?: string
    modelState?: GrokModels
  } | null
}

/** What Grok says of its models, as the app offers them. */
export function grokModels(state: GrokModels | undefined): ModelChoice[] {
  type Row = NonNullable<GrokModels["availableModels"]>[number]
  const rows = state?.availableModels ?? []
  const efforts = (row: Row) =>
    row._meta?.supportsReasoningEffort === false
      ? []
      : EFFORTS.filter((effort) =>
          row._meta?.reasoningEfforts?.some(
            (one) => (one.value ?? one.id) === effort
          )
        )
  const standing = rows.find((row) => row.modelId === state?.currentModelId)
  return [
    // there is always the choice of leaving it to Grok
    {
      id: null,
      name: "Default",
      short: standing?.name ?? "Default",
      detail: "The model Grok is set to run",
      efforts: standing ? efforts(standing) : [],
    },
    ...rows.map((row): ModelChoice => ({
      id: row.modelId,
      name: row.name ?? row.modelId,
      short: row.name ?? row.modelId,
      detail: row.description ?? "",
      efforts: efforts(row),
    })),
  ]
}

/** Which of Grok's ways of signing in is the one in use: a key in its environment, or its own. */
const authMethod = (launch: Launch, hello: Hello) =>
  launch.env.XAI_API_KEY?.trim()
    ? "xai.api_key"
    : (hello._meta?.defaultAuthMethodId ?? "cached_token")

/**
 * How much Grok may do without asking, in its own terms. It has no mode of its own for
 * changing files freely and asking about the rest: there it asks, and the app answers
 * for the changes to files (see where it asks leave, below).
 *
 * Said outright each time, though Grok may not go by it: its own settings come first,
 * and Claude Code's where it finds them, so that a machine set to let its agents act on
 * their own judgement has Grok do so whatever is chosen here.
 */
const MODES: Record<Access, string> = {
  supervised: "default",
  edits: "default",
  auto: "auto",
  full: "bypassPermissions",
}

/**
 * Grok's command line: how much it may do, where that is being chosen, then that it is
 * to speak the protocol, with what the user would add put where Grok looks for it.
 */
const command = (launch: Launch, access?: Access) => [
  ...(access ? ["--permission-mode", MODES[access]] : []),
  "agent",
  ...launch.args,
  "stdio",
]

/**
 * What the installed Grok says of itself: its version, the account it is signed in to,
 * and the models it offers.
 */
export async function lookAtGrok(launch: Launch): Promise<Looked> {
  const peer = startPeer(launch.path, command(launch), {
    cwd: os.tmpdir(),
    env: launch.env,
    versioned: true,
    onNotification: () => {},
    onRequest: (method) =>
      Promise.reject(
        new RpcError(NO_SUCH_METHOD, `Method not found: ${method}`)
      ),
  })
  const asking = async (): Promise<Looked> => {
    const hello = await peer.request<Hello>("initialize", HELLO)
    const methodId = authMethod(launch, hello)
    // it signs in with what it has kept, or says that it has nothing
    const who = await peer
      .request<{
        _meta?: { subscription_tier?: string | null } | null
      }>("authenticate", { methodId })
      .catch(() => null)
    return {
      version: hello._meta?.agentVersion ?? null,
      signedIn: who !== null,
      account: who
        ? (who._meta?.subscription_tier ??
          (methodId === "xai.api_key" ? "API key" : "Grok account"))
        : null,
      trouble: null,
      models: grokModels(hello._meta?.modelState),
    }
  }
  try {
    return await Promise.race([
      asking(),
      tooLong(ASKING_TIMEOUT_MS, "Grok did not answer."),
    ])
  } finally {
    peer.close()
  }
}

/** A tool call as Grok reports one, in as much as the app reads of it. */
type ToolCall = AcpToolCall

type Option = AcpOption

/** What kind of thing a tool call is, in a word, by the kind Grok gives it. */
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

/** One turn of a conversation, run by Grok. Resolves once it is over. */
export async function runGrok(turn: Turn): Promise<void> {
  const { launch, manner } = turn
  const halt = stopped(turn.signal)
  const run = turn.id("grok")
  const relative = inside(turn.cwd)

  /**
   * Whether a tool call is to one of the app's own tools, and if so which. Grok calls a
   * tool that was brought to it through one of its own, use_tool, by a name it makes of
   * the set and the tool: viewport__screenshot. Only such a call is gone by, by that
   * name exactly: never the title, which can be words the model wrote, and never a call
   * Grok says runs a command or changes a file, whatever it is called.
   */
  const ours = (call: ToolCall) => {
    if (call.kind && call.kind !== "other") return null
    const its = call._meta?.["x.ai/tool"]?.name
    if (its && its !== "use_tool") return null
    const named = field(call.rawInput, "tool_name")
    for (const [set, tools_] of Object.entries(turn.tools))
      for (const tool of tools_)
        if (named === `${set}__${tool.name}`) return `mcp__${set}__${tool.name}`
    return null
  }

  /** A tool call in a few words: what kind of thing, and on what. */
  const step = (call: ToolCall): { name: string; detail: string } => {
    const own = ours(call)
    if (own) return turn.describe(own, call.rawInput)
    const its = call._meta?.["x.ai/tool"] ?? {}
    // it looks a tool up before it calls on one it was brought
    if (its.name === "search_tool")
      return { name: "Find tool", detail: field(call.rawInput, "query") }
    // what kind of thing it is, it says at first only in its own words
    const kind =
      call.kind && call.kind !== "other" ? call.kind : (its.kind ?? "")
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

  // Grok does not always answer the prompt it was sent: it also says so apart
  const state = new AcpTurn(turn, run, step, (method, told, sessionId) =>
    method === "_x.ai/session/prompt_complete" && told.sessionId === sessionId
      ? (told.stopReason ?? null)
      : undefined
  )

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
      // The app's own tools are the point of it: they are never asked about. And where
      // the project's files are the agent's to change, changing them is not asked either:
      // only them, and not a file anywhere else, nor one a link in the project leads out to.
      if (
        ours(call) ||
        (access === "edits" &&
          call.kind === "edit" &&
          changesOnlyInside(turn.cwd, call))
      )
        return choose("allow_once", "allow_always")
      const shown = step(call)
      const answer = await turn.ask({
        title: QUESTIONS[call.kind ?? ""] ?? `Let Grok use ${shown.name}?`,
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
    // it would need its own form here; until then Grok asks in plain text
    if (
      method === "_x.ai/ask_user_question" ||
      method === "x.ai/ask_user_question"
    )
      return { outcome: "cancelled" }
    throw new RpcError(NO_SUCH_METHOD, `Method not found: ${method}`)
  }

  // (a model is looked over with the app's tools: anything else is put to the user)
  const access = turn.lookOver ? "supervised" : manner.access
  const peer = startPeer(launch.path, command(launch, access), {
    cwd: turn.cwd,
    env: launch.env,
    versioned: true,
    onNotification: state.notification,
    onRequest,
  })
  // gone before the turn was over: what it last said to stderr is why, if anything is
  const died = peer.gone.then(() => {
    throw new Error(peer.stderr() || "Grok exited before the turn was over.")
  })
  died.catch(() => {})

  try {
    const hello = await Promise.race([
      peer.request<Hello>("initialize", HELLO),
      halt,
      died,
    ])
    await Promise.race([
      peer.request("authenticate", { methodId: authMethod(launch, hello) }),
      halt,
      died,
    ]).catch((error: unknown) => {
      if (turn.signal.aborted) throw error
      throw new Error(
        "Nobody is signed in to Grok. Run `grok login` in a terminal, then try again."
      )
    })

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
      const made = await peer.request<{ sessionId: string }>("session/new", {
        ...where,
        _meta: {
          rules: turn.guide,
          // how much it may do without asking, said again where a session can be told
          ...(access === "full"
            ? { yoloMode: true }
            : access === "auto"
              ? { autoMode: true }
              : {}),
        },
      })
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
            "Grok took too long to take the conversation up again."
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
          "Grok could not find its record of this conversation, so it carries on without what was said before."
        )
    }
    if (!resumed) state.sessionId = await Promise.race([begin(), halt, died])
    turn.session(state.sessionId)

    // which model answers, and how hard it thinks: said only where the user chose
    const set = (configId: string, value: string) =>
      Promise.race([
        peer.request("session/set_config_option", {
          sessionId: state.sessionId,
          configId,
          value,
        }),
        halt,
        died,
      ]).catch((error: unknown) => {
        if (turn.signal.aborted) throw error
        turn.notice(
          "info",
          `Grok would not take ${value} for its ${configId.replace("_", " ")}, and answers as it is set.`
        )
      })
    if (manner.model) await set("model", manner.model)
    if (manner.effort) await set("reasoning_effort", manner.effort)

    // Grok takes no pictures in a message: it is told what it is told in words
    const text = piecesOf(turn.content).flatMap((piece) =>
      piece.type === "text" ? [piece.text] : []
    )
    const answered = peer
      .request<{ stopReason?: string | null }>("session/prompt", {
        sessionId: state.sessionId,
        prompt: [
          // a session taken up again keeps the rules it began with
          ...(resumed && turn.guideChanged ? [guideAgain(turn.guide)] : []),
          ...text,
        ].map((words) => ({ type: "text", text: words })),
      })
      .then((result) => result?.stopReason ?? null)
    const stopReason = await Promise.race([
      answered,
      state.finished,
      halt,
      died,
    ])
    state.hush()
    if (stopReason === "refusal")
      turn.notice("error", "Grok declined to answer this.")
    else if (stopReason === "max_tokens" || stopReason === "max_turn_requests")
      turn.notice(
        "info",
        "Grok stopped before it was done: it had reached the most it does in one turn."
      )
  } catch (error) {
    // Stopped part of the way: Grok is told, and given a moment to leave the session as
    // it should be left, so that the conversation can be carried on from here.
    if (turn.signal.aborted && state.sessionId) {
      peer.notify("session/cancel", { sessionId: state.sessionId })
      await Promise.race([
        state.finished,
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
