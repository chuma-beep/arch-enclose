import { cn } from "cn"
import { CheckIcon, EllipsisIcon } from "lucide-react"

import type { BoardSummary } from "@shared/api"
import type { Building } from "@shared/board-format"
import { Badge } from "@/components/ui/badge"
import { elapsed, useNow } from "@/lib/time"
import { useJobOn } from "./boards"
import { stepsOf, type BoardJob, type BoardStepShown } from "./making"

/**
 * How a board being worked on is tagged, in place of "Unfinished": "Working", as a
 * project's card says it while Claude is at it, with the light passing along the word.
 */
export function WorkingBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-attention", className)}>
      {/* (on the word alone: the light is the word's fill, and would take the tag's) */}
      <span className="shimmer">Working</span>
    </Badge>
  )
}

/**
 * At the foot of PCB mode while an agent makes the board on screen in detail: the steps
 * it is made in, in a row, each with how long it took, or has taken so far, or that it
 * has not been begun on. It is where the whole of the making stands, which what the
 * agent says as it goes does not show. Nothing while no agent is making it.
 */
export function BoardSteps({
  projectId,
  board,
}: {
  projectId: string
  board: BoardSummary
}) {
  const job = useJobOn(projectId, board)
  return job && <Steps job={job} building={board.building} />
}

function Steps({
  job,
  building,
}: {
  job: BoardJob
  building: Building | null
}) {
  const now = useNow(1000)
  return (
    <ol className="flex animate-in items-center gap-8 duration-200 select-none fade-in slide-in-from-bottom-2">
      {stepsOf(job).map((step) => (
        <li key={step.name} className="flex items-center gap-3">
          <Mark
            step={step}
            // while it is routed, how far that has got goes round the step
            share={
              step.state === "now" &&
              step.name === "Routing" &&
              building?.stage === "routing"
                ? building.progress
                : null
            }
          />
          <span className="flex flex-col text-[13px] leading-[18px]">
            <span className="font-medium text-foreground">{step.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {step.from === null
                ? "Not started yet"
                : elapsed((step.to ?? now) - step.from)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The round mark a step has: ticked once it is done, going round while it is the one
 * under way (or filling, as far as that is told), and three dots before it is begun.
 */
function Mark({ step, share }: { step: BoardStepShown; share: number | null }) {
  if (step.state === "done")
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
        <CheckIcon className="size-4 text-foreground/80" aria-hidden />
      </span>
    )
  if (step.state === "later")
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
        <EllipsisIcon className="size-4 text-foreground/60" aria-hidden />
      </span>
    )
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground">
      <svg
        viewBox="0 0 16 16"
        className={cn("size-4", share === null ? "animate-spin" : "-rotate-90")}
        aria-hidden
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          strokeWidth="2"
          className="stroke-background/20"
        />
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={share === null ? 0.7 : 1 - Math.max(0.03, share)}
          // it is told how far along it is about once a second: it goes there evenly
          className="stroke-background transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
    </span>
  )
}
