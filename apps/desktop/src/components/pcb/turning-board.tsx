import { cn } from "cn"

/** The pads round the chip, as a share of the board's side from its top left: x, y. */
const PADS = [0.3, 0.4, 0.5, 0.6, 0.7].flatMap((at) => [
  [at, 0.22],
  [at, 0.78],
])
/** And its holes, in its corners. */
const HOLES = [
  [0.11, 0.11],
  [0.89, 0.11],
  [0.11, 0.89],
  [0.89, 0.89],
]

/**
 * A board turning round, slowly, seen from above at a slant: where one is being made and
 * there is nothing of it yet to show. Only a square of a board, with a chip, a row of
 * pads each side of it, and a hole in each corner; in the colours of a board in 3D. Its
 * size is what it is given.
 */
export function TurningBoard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("turning-board", className)}>
      <div className="turning-board-face">
        <span className="absolute top-[34%] left-[26%] h-[32%] w-[48%] rounded-[3%] bg-[#55585e]" />
        {PADS.map(([x, y]) => (
          <span
            key={`${x}:${y}`}
            className="absolute h-[9%] w-[5%] -translate-1/2 rounded-[1px] bg-[#d8c17b]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        ))}
        {HOLES.map(([x, y]) => (
          <span
            key={`${x}:${y}`}
            className="absolute size-[9%] -translate-1/2 rounded-full border-[1.5px] border-[#b07a52] bg-[#0f2a18]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
