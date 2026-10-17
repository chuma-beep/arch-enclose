// The theme creator, which the app has only as it is worked on: over the whole window, a
// colour picker for each thing a theme colours down the left, and the window drawn in
// what is picked on the right, in the light look or the dark. What is picked in one look
// is that look's alone; what is not picked is the app's own. Saved, the theme is a file
// in themes/ at the top of the repository, to be put to the app in a pull request. It
// changes the app's own look as well, in themes/default.json, put to the app the same
// way: then what is not picked is the app's own as src/index.css has it. What the theme
// is called is its title, changed where it stands.
import * as React from "react"
import { cn } from "cn"
import { MoonIcon, RotateCcwIcon, SunIcon, XIcon } from "lucide-react"

import { PALETTE_NAMES, type PaletteName } from "@shared/palette"
import {
  changes,
  NAME_LENGTH,
  SLOTS,
  THEME_FOLDER,
  type Mode,
  type ThemeLooks,
  type SlotId,
} from "@shared/theme-format"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onReset}
                  className="mt-2 -ml-1 flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              }
            >
              <RotateCcwIcon className="size-3.5" />
              <span className="sr-only">{reset}</span>
            </TooltipTrigger>
            <TooltipContent>{reset}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  )
}

export function ThemeCreator({
  making,
  look: given,
}: {
  making: Making
  /** the look shown at first: the one the window is in, where none is given */
  look?: Mode
}) {
  const setCreating = useThemes((state) => state.setCreating)
  const save = useThemes((state) => state.save)
  const saveDefaults = useThemes((state) => state.saveDefaults)
  const under = useThemes((state) => state.defaults)
  const look = useLook()
  const base = making === "defaults"
  // the look being made: the one asked for, or the one the window is in
  const [mode, setMode] = React.useState<Mode>(given ?? look)
  // a theme from nothing of its own; the app's own look from what is changed of it now
  const [start] = React.useState<ThemeLooks>(() =>
    base
      ? structuredClone({ light: under.light, dark: under.dark })
      : { light: {}, dark: {} }
  )
  const [made, setMade] = React.useState<ThemeLooks>(start)
  const [startName] = React.useState(base ? under.name : "")
  const [name, setName] = React.useState(startName)
  const [part, setPart] = React.useState<PaletteName>("blue")
  const [said, setSaid] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const naming = React.useRef<HTMLInputElement>(null)
  const parts = React.useRef<HTMLDivElement>(null)

  const defaults = React.useMemo(() => defaultsOf(mode, base), [mode, base])
  const colours = made[mode]
  const palette = base ? paletteOf(colours) : paletteOf(colours, under[mode])
  const anything = changes(made.light) || changes(made.dark)
  const changed =
    JSON.stringify(made) !== JSON.stringify(start) || name !== startName
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

  // Esc leaves the title, if it is being changed; else puts it all away while nothing
  // has been picked. Nothing under it hears it
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      event.preventDefault()
      if (event.target === naming.current) naming.current?.blur()
      else if (!changed) setCreating(null)
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [changed, setCreating])

  const done = async () => {
    if (base) {
      setSaving(true)
      try {
        await saveDefaults({ name: name.trim() || startName, ...made })
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
          <div className="flex min-w-0 flex-1 flex-col text-xl/[1.2] font-medium">
            {/* what it is called, changed where it stands */}
            <input
              ref={naming}
              aria-label={
                base
                  ? "What the app's own look is called"
                  : "What the theme is called"
              }
              placeholder="Untitled theme"
              spellCheck={false}
              maxLength={NAME_LENGTH}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setSaid(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur()
              }}
              // the app's own look is always called something
              onBlur={() => {
                if (base && !name.trim()) setName(startName)
              }}
              // as wide as what is in it, or what it asks for
              className="-ml-1.5 field-sizing-content max-w-full min-w-0 cursor-text self-start rounded-md bg-transparent px-1.5 outline-none placeholder:text-muted-foreground hover:bg-muted focus:bg-muted"
            />
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
