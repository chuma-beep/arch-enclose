import { describe, expect, it } from "vitest"

import { keptPictures } from "./kept"

describe("keptPictures", () => {
  it("keeps a picture of a board as it was built, in each colouring", () => {
    const kept = keptPictures(10)
    kept.set("p:main", 1, "light", "a")
    kept.set("p:main", 1, "dark", "b")
    expect(kept.get("p:main", 1, "light")).toBe("a")
    expect(kept.get("p:main", 1, "dark")).toBe("b")
    expect(kept.has("p:main", 2, "light")).toBe(false)
  })

  it("lets go of a board's earlier builds once one of the next is kept", () => {
    const kept = keptPictures(10)
    kept.set("p:main", 1, "light", "a")
    kept.set("p:main", 1, "dark", "b")
    kept.set("p:other", 1, "light", "c")
    kept.set("p:main", 2, "light", "d")
    expect(kept.has("p:main", 1, "light")).toBe(false)
    expect(kept.has("p:main", 1, "dark")).toBe(false)
    expect(kept.get("p:main", 2, "light")).toBe("d")
    // (another board's are its own)
    expect(kept.get("p:other", 1, "light")).toBe("c")
    expect(kept.size).toBe(2)
  })

  it("does not take one board for another whose name begins as its does", () => {
    const kept = keptPictures(10)
    kept.set("p:main", 1, "light", "a")
    kept.set("p:main2", 2, "light", "b")
    expect(kept.get("p:main", 1, "light")).toBe("a")
  })

  it("keeps no more than so many, letting go of the one looked at least lately", () => {
    const kept = keptPictures(2)
    kept.set("p:a", 1, "light", "a")
    kept.set("p:b", 1, "light", "b")
    kept.get("p:a", 1, "light")
    kept.set("p:c", 1, "light", "c")
    expect(kept.has("p:a", 1, "light")).toBe(true)
    expect(kept.has("p:b", 1, "light")).toBe(false)
    expect(kept.has("p:c", 1, "light")).toBe(true)
  })
})
