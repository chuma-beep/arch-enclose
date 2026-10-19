// Whether the window is being looked at: what something that moves on its own, over and
// over, goes by to know how often it is worth drawing.

import * as React from "react"

/** How the window is seen: in front, behind another window, or not at all. */
export type Watched = "focused" | "shown" | "hidden"

function watchedNow(): Watched {
  if (document.visibilityState === "hidden") return "hidden"
  return document.hasFocus() ? "focused" : "shown"
}

/** How the window is seen, as that changes. */
export function useWatched(): Watched {
  const [watched, setWatched] = React.useState(watchedNow)
  React.useEffect(() => {
    const changed = () => setWatched(watchedNow())
    document.addEventListener("visibilitychange", changed)
    window.addEventListener("focus", changed)
    window.addEventListener("blur", changed)
    return () => {
      document.removeEventListener("visibilitychange", changed)
      window.removeEventListener("focus", changed)
      window.removeEventListener("blur", changed)
    }
  }, [])
  return watched
}

/**
 * How many times a second something that moves over and over is drawn, as it asks to be
 * (`rate`) in a window in front: half as often in one behind another, where it is still
 * seen going on but nobody is at it, and not at all in one that cannot be seen.
 */
export function rateWhen(watched: Watched, rate: number): number {
  return watched === "focused" ? rate : watched === "shown" ? rate / 2 : 0
}
