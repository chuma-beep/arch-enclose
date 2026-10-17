// The theme creator, which the app has only as it is worked on: over the whole window, a
// colour picker for each thing a theme colours down the left, and the window drawn in
// what is picked on the right, in the light look or the dark. What is picked in one look
// is that look's alone; what is not picked is the app's own. Saved, the theme is a file
// in themes/ at the top of the repository, to be put to the app in a pull request. From
// the one checkout that may (EDIT_DEFAULTS in lib/themes.ts) it changes the app's own
// look as well, in themes/default.json: then what is not picked is the app's own as
// src/index.css has it.
import * as React from "react"
import { cn } from "cn"
import { MoonIcon, SunIcon, XIcon } from "lucide-react"

import { PALETTE_NAMES, type PaletteName } from "@shared/palette"
import {
  changes,
  SLOTS,
  THEME_FOLDER,
  type Mode,
  type ThemeLooks,
  type SlotId,
} from "@shared/theme-format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hexOf } from "@/lib/css-color"
import { useStore } from "@/lib/store"
import { paletteOf, useLook, useThemes, type Making } from "@/lib/themes"
import { Mockup, MOCKUP } from "./mockup"
import { ColourPicker } from "./picker"

/** The parts of the window, in the order their colours are picked. */
const AREAS = ["Sidebar", "Viewer", "Chat", "Tools"] as const

/**
 * What each thing a theme colours is drawn in, in one look of the app's own: as it has
 * been changed, or (`base`) as src/index.css has it.
 */
function defaultsOf(mode: Mode, base: boolean): Record<SlotId, string> {
  // read off something of that look that no theme the window is in reaches
  const probe = document.createElement("div")
  probe.dataset.themePreview = ""
  if (base) probe.dataset.themeBase = ""
  probe.className = mode
  probe.hidden = true
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const read = Object.fromEntries(
    SLOTS.map(({ id, token }) => [
      id,
      hexOf(style.getPropertyValue(token).trim()),
    ])
  ) as Record<SlotId, string>
  probe.remove()
  return read
}

/** The window drawn as big as it fits in what holds it, and no bigger than it is. */
function Fitted({ children }: { children: React.ReactNode }) {
  const box = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(0.5)
  React.useLayoutEffect(() => {
    const held = box.current
    if (!held) return
    const fit = () =>
      setScale(
        Math.min(
          1,
          held.clientWidth / MOCKUP.width,
          held.clientHeight / MOCKUP.height
        )
      )
    fit()
    const watching = new ResizeObserver(fit)
    watching.observe(held)
    return () => watching.disconnect()
  }, [])
  return (
    <div
      ref={box}
      className="absolute inset-x-10 top-16 bottom-24 flex items-center justify-center"
    >
      <div
        style={{ width: MOCKUP.width * scale, height: MOCKUP.height * scale }}
      >
        <div
          style={{
            ...MOCKUP,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** One thing the theme colours: what it is, on the left, and its picker. */
function Row({
  area,
  label,
  changed,
  reset,
  onReset,
  children,
}: {
  area: string
  label: string
  /** the theme has a colour of its own for it, in this look */
  changed: boolean
  /** what is said of putting it back as it was */
  reset: string
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <section className="flex gap-5 border-t py-5">
      <div className="flex w-28 shrink-0 flex-col items-start text-sm">
        <span>{area}</span>
        {label !== area && (
          <span className="text-muted-foreground">{label}</span>
        )}
        {changed && (
          <button
            type="button"
            onClick={onReset}
            className="mt-2 cursor-pointer rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {reset}
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  )
}

export function ThemeCreator({ making }: { making: Making }) {
  const setCreating = useThemes((state) => state.setCreating)
  const save = useThemes((state) => state.save)
  const saveDefaults = useThemes((state) => state.saveDefaults)
  const under = useThemes((state) => state.defaults)
  const look = useLook()
  const base = making === "defaults"
  // the look being made: the one the window is in, to begin with
  const [mode, setMode] = React.useState<Mode>(look)
  // a theme from nothing of its own; the app's own look from what is changed of it now
  const [start] = React.useState<ThemeLooks>(() =>
    base ? structuredClone(under) : { light: {}, dark: {} }
  )
  const [made, setMade] = React.useState<ThemeLooks>(start)
  const [name, setName] = React.useState("")
  const [part, setPart] = React.useState<PaletteName>("blue")
  const [said, setSaid] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const naming = React.useRef<HTMLInputElement>(null)
  const parts = React.useRef<HTMLDivElement>(null)

  const defaults = React.useMemo(() => defaultsOf(mode, base), [mode, base])
  const colours = made[mode]
  const palette = base ? paletteOf(colours) : paletteOf(colours, under[mode])
  const anything = changes(made.light) || changes(made.dark)
  const changed = JSON.stringify(made) !== JSON.stringify(start)
  const reset = base ? "Back to the original" : "Back to the app's"

  const colour = (id: SlotId, value: string | null) =>
    setMade((before) => {
      const next = { ...before[mode] }
      if (value) next[id] = value
      else delete next[id]
      return { ...before, [mode]: next }
    })
  const partColour = (which: PaletteName, value: string | null) =>
    setMade((before) => {
      const next = { ...before[mode].parts }
      if (value) next[which] = value
      else delete next[which]
      return { ...before, [mode]: { ...before[mode], parts: next } }
    })

  // Esc puts it away while nothing has been picked, and is heard by nothing under it
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.preventDefault()
      if (!changed) setCreating(null)
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [changed, setCreating])

  const done = async () => {
    if (base) {
      setSaving(true)
      try {
        await saveDefaults(made)
        setCreating(null)
        useStore
          .getState()
          .say(`Saved the default theme in ${THEME_FOLDER}/default.json`, 6000)
      } catch (error) {
        setSaid(error instanceof Error ? error.message : String(error))
        setSaving(false)
      }
      return
    }
    if (!name.trim()) {
      setSaid("Give the theme a name first.")
      naming.current?.focus()
      return
    }
    if (!anything) {
      setSaid(
        "Change a colour first: a theme with none of its own is the app's look."
      )
      return
    }
    setSaving(true)
    try {
      const theme = await save({ name, light: made.light, dark: made.dark })
      setCreating(null)
      useStore
        .getState()
        .say(
          `Saved “${theme.name}” as ${THEME_FOLDER}/${theme.id}.json: open a pull request with it to share it`,
          8000
        )
    } catch (error) {
      setSaid(error instanceof Error ? error.message : String(error))
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Theme creator"
      className="fixed inset-0 z-50 flex animate-in bg-background text-foreground duration-200 fade-in-0"
    >
      <aside className="no-drag flex w-104 shrink-0 flex-col border-r">
        {/* room for the window's traffic lights, and something to drag it by */}
        <div className="drag h-12 shrink-0" />
        <header className="flex items-start justify-between gap-4 px-7 pt-3 pb-6">
          <div className="flex flex-col text-xl font-medium">
            <h1>{base ? "Default theme" : "Theme Generator"}</h1>
            <span className="text-muted-foreground">
              {mode === "dark" ? "Dark mode" : "Light mode"}
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setCreating(null)}
          >
            <XIcon />
            <span className="sr-only">Close the theme creator</span>
          </Button>
        </header>
        {!base && (
          <div className="px-7 pb-5">
            <Input
              ref={naming}
              aria-label="What the theme is called"
              placeholder="Name your theme"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setSaid(null)
              }}
            />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
          {AREAS.map((area) => (
            <React.Fragment key={area}>
              {SLOTS.filter((slot) => slot.area === area).map((slot) => (
                <Row
                  key={slot.id}
                  area={area}
                  label={slot.label}
                  changed={colours[slot.id] !== undefined}
                  reset={reset}
                  onReset={() => colour(slot.id, null)}
                >
                  <ColourPicker
                    label={`${area}, ${slot.label}`}
                    value={colours[slot.id] ?? defaults[slot.id]}
                    onChange={(value) => colour(slot.id, value)}
                  />
                </Row>
              ))}
              {area === "Viewer" && (
                <div ref={parts} className="scroll-my-4">
                  <Row
                    area="Viewer"
                    label="Parts"
                    changed={colours.parts?.[part] !== undefined}
                    reset={reset}
                    onReset={() => partColour(part, null)}
                  >
                    {/* each of the palette's colours, the one being changed lit; a
                        part in the window opposite picks its colour too */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {PALETTE_NAMES.map((name) => (
                        <button
                          key={name}
                          type="button"
                          title={name}
                          aria-pressed={part === name}
                          onClick={() => setPart(name)}
                          className="relative aspect-square cursor-pointer rounded-full ring-1 ring-foreground/15 outline-offset-2 outline-foreground ring-inset hover:ring-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:outline-2"
                          style={{ background: palette[name] }}
                        >
                          {colours.parts?.[name] && (
                            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground ring-2 ring-background" />
                          )}
                          <span className="sr-only">{name}</span>
                        </button>
                      ))}
                    </div>
                    <ColourPicker
                      label={`Parts, ${part}`}
                      value={palette[part]}
                      onChange={(value) => partColour(part, value)}
                    />
                  </Row>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        <div className="drag absolute inset-x-0 top-0 h-12" />
        <Button
          variant="secondary"
          size="icon"
          className="no-drag absolute top-3 right-4 rounded-full"
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        >
          {mode === "dark" ? <SunIcon /> : <MoonIcon />}
          <span className="sr-only">
            {mode === "dark" ? "Make the light look" : "Make the dark look"}
          </span>
        </Button>
        <Fitted>
          <Mockup
            mode={mode}
            colours={colours}
            base={base}
            palette={palette}
            picked={part}
            onPick={(name) => {
              setPart(name)
              parts.current?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              })
            }}
          />
        </Fitted>
        <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
          {said && <p className="text-sm text-muted-foreground">{said}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={() => void done()}
            className={cn(
              "h-9 cursor-pointer rounded-full bg-foreground px-4.5 text-sm font-medium text-background shadow-md outline-none hover:bg-foreground/85 focus-visible:ring-[3px] focus-visible:ring-ring/50",
              saving && "opacity-60"
            )}
          >
            {saving ? "Saving…" : base ? "Save default theme" : "Save theme"}
          </button>
        </div>
      </main>
    </div>
  )
}
