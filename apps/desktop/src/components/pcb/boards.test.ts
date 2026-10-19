import { describe, expect, it, vi } from "vitest"

import type { BoardSummary } from "@shared/api"
import { sizeSaid } from "./boards"

// the window's store, which the hooks beside it read: sizeSaid needs none of it
vi.mock("@/lib/store", () => ({ useStore: () => null }))

const sized = (size: BoardSummary["size"]) => ({ size }) as BoardSummary

describe("sizeSaid", () => {
  it("says how big a board is, across and then from top to bottom, in mm", () => {
    expect(sizeSaid(sized([40, 25]))).toBe("40 × 25 mm")
  })

  it("says it to a tenth of a mm, and no closer", () => {
    expect(sizeSaid(sized([40.04, 25.06]))).toBe("40 × 25.1 mm")
    expect(sizeSaid(sized([12.345, 0.25]))).toBe("12.3 × 0.3 mm")
  })

  it("says nothing while how big it is is not known", () => {
    expect(sizeSaid(sized(null))).toBeNull()
  })
})
