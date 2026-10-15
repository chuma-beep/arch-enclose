// What of other people's code goes out with the app, and under what terms: written down
// at each build, in one file the app carries beside it and opens from its settings
// (THIRD-PARTY-LICENSES.txt). It is everything that is bundled into the window and into
// the page of an assembly guide, as the bundlers say they took it, and every package the
// app's own process loads as it is, from node_modules: each one by its name, its version
// and its license, and with the license's own text, where the package has it.
import fs from "node:fs"
import path from "node:path"

const HERE = path.resolve(import.meta.dirname, "..")
/** Where it is written: beside the Electron side, which the app is packed with. */
export const LICENSES = path.join(
  HERE,
  "dist-electron",
  "THIRD-PARTY-LICENSES.txt"
)

/** What a file of a license is called, as packages name it. */
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i

/** The package a file in node_modules is of: its folder, under the last node_modules. */
export function packageOf(file) {
  const parts = file.split(/[\\/]/)
  const at = parts.lastIndexOf("node_modules")
  if (at < 0) return null
  const scoped = parts[at + 1]?.startsWith("@")
  const name = scoped ? `${parts[at + 1]}/${parts[at + 2]}` : parts[at + 1]
  if (!name) return null
  return path.join(parts.slice(0, at + 1).join(path.sep) || path.sep, name)
}

/**
 * The packages the app's own process loads from node_modules as it runs: the app's
 * dependencies and all of theirs, as the lockfile has them installed, but for what the
 * build leaves out (the Claude Code the agent SDK brings, which the app does not use).
 */
function shipped() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(HERE, "package-lock.json"), "utf8")
  )
  return Object.entries(lock.packages ?? {})
    .filter(([where, entry]) => where && !entry.dev && !entry.link)
    .map(([where]) => path.join(HERE, where))
    .filter(
      (folder) =>
        fs.existsSync(path.join(folder, "package.json")) &&
        !/@anthropic-ai[\\/]claude-agent-sdk-/.test(folder)
    )
}

/** A package as it is written down: its name, version, license and the license's text. */
function entryOf(folder) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(folder, "package.json"), "utf8")
  )
  const license =
    typeof manifest.license === "string"
      ? manifest.license
      : (manifest.license?.type ??
        manifest.licenses?.map((one) => one.type ?? one).join(" OR ") ??
        "not stated")
  const files = fs
    .readdirSync(folder)
    .filter((name) => LICENSE_FILE.test(name))
    .sort()
  const text = files
    .map((name) => fs.readFileSync(path.join(folder, name), "utf8").trim())
    .join("\n\n")
  return {
    name: manifest.name ?? path.basename(folder),
    version: manifest.version ?? "",
    license,
    homepage:
      manifest.homepage ??
      (typeof manifest.repository === "string"
        ? manifest.repository
        : manifest.repository?.url) ??
      "",
    text,
  }
}

/**
 * Write the file, from the files the bundlers took (`bundled`, absolute paths) and the
 * packages the app loads as it runs. Returns how many packages are in it.
 */
export function writeLicenses(bundled) {
  const folders = new Set(shipped())
  for (const file of bundled) {
    const folder = packageOf(file)
    if (folder && fs.existsSync(path.join(folder, "package.json")))
      folders.add(folder)
  }
  // one entry to a name and version, wherever in node_modules it was found
  const entries = new Map()
  for (const folder of folders) {
    const entry = entryOf(folder)
    entries.set(`${entry.name}@${entry.version}`, entry)
  }
  const sorted = [...entries.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const rule = "-".repeat(78)
  const written = [
    "Enclose is free software under the GNU AGPL, version 3 (see its LICENSE). It is",
    "built with the work of others, which goes out with it under their own terms: each",
    "package below, by its name and version, with its license, and that license's text",
    "where the package has one.",
    "",
    ...sorted.flatMap((entry) => [
      rule,
      `${entry.name} ${entry.version}`,
      `License: ${
        entry.license === "not stated" && entry.text
          ? "as its text below says"
          : entry.license
      }`,
      ...(entry.homepage ? [entry.homepage.replace(/^git\+/, "")] : []),
      // a package that has no text of its license with it is under the standard one
      ...(entry.text
        ? ["", entry.text]
        : /^[A-Za-z0-9.-]+$/.test(entry.license)
          ? [
              "",
              `It comes with no text of its license: the ${entry.license} license is at https://spdx.org/licenses/${entry.license}.html`,
            ]
          : []),
      "",
    ]),
  ].join("\n")
  fs.mkdirSync(path.dirname(LICENSES), { recursive: true })
  fs.writeFileSync(LICENSES, written)
  return sorted.length
}
