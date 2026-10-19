// What comes in from the app's own process is new each time it comes, even where it is
// just as it was: the projects, with their conversations, are sent whole whenever any
// of them changes. Whatever is drawn from them would be drawn again, all of it, for the
// one thing that changed.

/** Something as data is: a plain object or a list, all the way down. */
const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null)

/** A list of things that each say which they are, by an id of their own. */
const byId = (list: unknown[]) =>
  list.every((item) => plain(item) && typeof item.id === "string")
    ? new Map(list.map((item) => [(item as { id: string }).id, item]))
    : null

/**
 * What has come (`next`), with whatever of it is the same as what was there (`was`)
 * being what was there, the very same objects: all of it, where none of it changed, and
 * otherwise everything but the way down to what did. Things in a list that each have an
 * id are told apart by that, and not by where they are in it.
 */
export function keptAsWas<T>(was: unknown, next: T): T {
  if (Object.is(was, next)) return next
  if (Array.isArray(next)) {
    if (!Array.isArray(was)) return next
    const before = byId(was)
    let same = was.length === next.length
    const kept = next.map((item, index) => {
      const had =
        before && plain(item) && typeof item.id === "string"
          ? before.get(item.id)
          : was[index]
      const one = keptAsWas(had, item)
      if (one !== was[index]) same = false
      return one
    })
    return (same ? was : kept) as T
  }
  if (!plain(next) || !plain(was)) return next
  const keys = Object.keys(next)
  let same = keys.length === Object.keys(was).length
  const kept: Record<string, unknown> = {}
  for (const key of keys) {
    const one = keptAsWas(was[key], next[key])
    if (one !== was[key] || !(key in was)) same = false
    kept[key] = one
  }
  return (same ? was : kept) as T
}
