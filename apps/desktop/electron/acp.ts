// The Agent Client Protocol, as the agents that speak it are run: what the app says on
// taking up the line, how long each step is waited for, and what an agent says and does
// over one turn, kept as it comes. Grok and opencode each say the protocol's parts in
// their own words; this is the part that is the same for both.
import type { ThreadItem } from "../shared/api"
import type { Turn } from "./turn"

/**
 * What the app says it is and can do, on taking up the line. It reads no files and runs
 * no terminals for the agent: the agent has its own of both.
 */
export const HELLO = {
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: false, writeTextFile: false },
    terminal: false,
  },
  clientInfo: { name: "enclose", version: "0.1.0" },
}

/** How long an agent is given to say what it has. */
export const ASKING_TIMEOUT_MS = 20_000
/** How long it is given to take a conversation up again. */
export const LOADING_TIMEOUT_MS = 90_000
/**
 * A conversation taken up again is played back to the app, and an agent does not always
 * say when that is over: this long with nothing more of it is taken for the end.
 */
export const REPLAY_QUIET_MS = 2000
/** How long an agent is given to wind a turn up once it has been told to stop. */
export const STOPPING_TIMEOUT_MS = 3000

/** A tool call as an agent reports one, in as much as the app reads of it. */
export type AcpToolCall = {
  toolCallId?: string
  /** the tool's own name, as some agents give it */
  name?: string | null
  title?: string | null
  kind?: string | null
  status?: string | null
  rawInput?: unknown
  locations?: { path?: string }[] | null
  /** what an agent says of a tool of its own making, beyond what the protocol has room for */
  _meta?: { "x.ai/tool"?: { name?: string; kind?: string } | null } | null
}

export type AcpUpdate = AcpToolCall & {
  sessionUpdate?: string
  content?: { type?: string; text?: string } | null
}

export type AcpOption = { optionId: string; kind: string }

/** What an agent says over the line, as the app reads it. */
export type AcpTold = {
  sessionId?: string
  update?: AcpUpdate
  stopReason?: string | null
  _meta?: { isReplay?: boolean } | null
}

/** A value out of a tool call's input, by the first of these names that has one. */
export function field(input: unknown, ...keys: string[]) {
  for (const key of keys) {
    const value = (input as Record<string, unknown> | null)?.[key]
    if (typeof value === "string" && value) return value
    if (Array.isArray(value) && value.every((one) => typeof one === "string"))
      return value.join(" ")
  }
  return ""
}

/**
 * One turn of a conversation, as the agent says it: what it is saying now, what has been
 * said of each tool call, and what is on show of them. It is the state that used to be
 * kept in each runner's closures.
 */
export class AcpTurn {
  /** the agent's name for the conversation, once it has said it */
  sessionId = ""
  /** a conversation is being taken up again: what arrives is what was said before */
  private replaying = false
  private replayedAt = 0
  /** what the agent is saying now; what it does next ends it, and it begins another */
  private speech: {
    now: Extract<ThreadItem, { kind: "assistant" }> | null
    count: number
  } = { now: null, count: 0 }
  private calls = new Map<string, AcpToolCall>()
  private tools = new Map<string, Extract<ThreadItem, { kind: "tool" }>>()
  private over: (stopReason: string | null) => void = () => {}
  private readonly turn: Turn
  private readonly run: string
  private readonly step: (call: AcpToolCall) => {
    name: string
    detail: string
  }
  private readonly done?: (
    method: string,
    told: AcpTold,
    sessionId: string
  ) => string | null | undefined
  /**
   * Resolves when the agent says the turn is over apart from the prompt's answer. Some
   * agents do not; an unresolved promise is no one's wait.
   */
  readonly finished: Promise<string | null>

  constructor(
    turn: Turn,
    run: string,
    step: (call: AcpToolCall) => { name: string; detail: string },
    done?: (
      method: string,
      told: AcpTold,
      sessionId: string
    ) => string | null | undefined
  ) {
    this.turn = turn
    this.run = run
    this.step = step
    this.done = done
    this.finished = new Promise((resolve) => (this.over = resolve))
  }

  /** What is arriving now is the conversation being taken up again, played back. */
  beginReplay() {
    this.replaying = true
    this.replayedAt = 0
  }

  endReplay() {
    this.replaying = false
  }

  /** When the last of what was played back arrived, or 0 if none has. */
  get replayed() {
    return this.replayedAt
  }

  /** The call a question is about, as it has been said of so far. */
  call(id: string | undefined): AcpToolCall {
    return this.calls.get(id ?? "") ?? {}
  }

  hush() {
    if (!this.speech.now) return
    this.turn.put({ ...this.speech.now, streaming: false })
    this.speech.now = null
    this.turn.touched()
  }

  update(given: AcpUpdate) {
    switch (given.sessionUpdate) {
      case "agent_message_chunk": {
        const text = given.content?.type === "text" ? given.content.text : ""
        if (!text || (!this.speech.now && !text.trim())) return
        this.speech.now = {
          kind: "assistant",
          id: `${this.run}:said:${this.speech.now ? this.speech.count : ++this.speech.count}`,
          at: this.speech.now?.at ?? Date.now(),
          text: (this.speech.now?.text ?? "") + text,
          streaming: true,
        }
        this.turn.put({ ...this.speech.now })
        return
      }
      case "tool_call":
      case "tool_call_update": {
        const key = given.toolCallId?.trim()
        if (!key) return
        this.hush()
        // each update says only what is new of the call
        const call = { ...this.calls.get(key) }
        for (const [name, value] of Object.entries(given))
          if (value !== null && value !== undefined)
            (call as Record<string, unknown>)[name] = value
        this.calls.set(key, call)
        // what it turns over in its own head is no step to show
        if (call.kind === "think") return
        const closed = call.status === "completed" || call.status === "failed"
        const item = {
          kind: "tool" as const,
          id: `${this.run}:${key}`,
          at: this.tools.get(key)?.at ?? Date.now(),
          ...this.step(call),
          state:
            call.status === "failed"
              ? ("failed" as const)
              : closed
                ? ("done" as const)
                : ("running" as const),
        }
        if (closed) this.tools.delete(key)
        else this.tools.set(key, item)
        this.turn.put(item)
        // what it just did may have written the model for the first time, or moved it
        if (closed) this.turn.touched()
        return
      }
    }
  }

  notification = (method: string, params: unknown) => {
    const told = (params ?? {}) as AcpTold
    if (method === "session/update") {
      if (this.replaying) {
        this.replayedAt = Date.now()
        return
      }
      // a subagent's session reports on the same line, and is no part of this
      // conversation; nor is what is played back of the one being taken up again
      if (
        told._meta?.isReplay ||
        told.sessionId !== this.sessionId ||
        !told.update
      )
        return
      this.update(told.update)
      return
    }
    const stop = this.done?.(method, told, this.sessionId)
    if (stop !== undefined) this.over(stop)
  }

  /** What was in flight did not finish: it is left as it stood, and marked so. */
  abandon() {
    if (this.speech.now) this.turn.put({ ...this.speech.now, streaming: false })
    for (const item of this.tools.values())
      this.turn.put({ ...item, state: "failed" })
  }
}

/** Rejects when an agent has been waited on for too long. */
export const tooLong = (ms: number, why: string) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(why)), ms).unref()
  )
