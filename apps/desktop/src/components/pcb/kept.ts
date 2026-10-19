// The pictures drawn of circuit boards, and of the kinds of part on them, kept to be
// shown again: of the latest build of each board alone, and no more of them than so many.

/**
 * Pictures kept by what they are of: a board (`of`), as it was built (`built`), and
 * whatever else tells one apart (`what`: the colours it was drawn in, the kind of part).
 * A picture of a board built again is no longer of anything: once a picture of the new
 * build is kept, every one of an earlier build is let go. And past `most` of them, the
 * one looked at least lately goes.
 */
export function keptPictures(most: number) {
  const kept = new Map<string, string>()
  const keyOf = (of: string, built: number | null, what: string) =>
    `${of}\n${built}\n${what}`
  return {
    get(of: string, built: number | null, what: string): string | undefined {
      const key = keyOf(of, built, what)
      const url = kept.get(key)
      // (as it was looked at last)
      if (url !== undefined) {
        kept.delete(key)
        kept.set(key, url)
      }
      return url
    },
    has(of: string, built: number | null, what: string): boolean {
      return kept.has(keyOf(of, built, what))
    },
    set(of: string, built: number | null, what: string, url: string) {
      const board = `${of}\n`
      const build = `${of}\n${built}\n`
      for (const key of kept.keys())
        if (key.startsWith(board) && !key.startsWith(build)) kept.delete(key)
      const key = keyOf(of, built, what)
      kept.delete(key)
      kept.set(key, url)
      for (const old of kept.keys()) {
        if (kept.size <= most) break
        kept.delete(old)
      }
    },
    get size() {
      return kept.size
    },
  }
}
