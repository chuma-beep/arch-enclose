// The app as something to install: on a Mac, the production build made into
// Enclose (Alpha).app, and that into a disk image to download, one for each kind of
// Mac; on Linux, an AppImage, a deb, a pacman package and an rpm instead. They are
// written to release/, and with them what an installed app makes itself the next
// version from: the app again as an archive, and latest-mac.yml or latest-linux.yml,
// which says what the newest version is and names the archives.
//   npm run dist                build, then make installers for this system
//   npm run dist -- --arm64     ...only the one for Apple silicon (--x64: for Intel)
//   npm run dist -- --appimage  ...only the AppImage (--deb, --pacman, --rpm: likewise)
// (made, and no more: a release is put up by hand, as docs/development.md says)
//
// A Mac opens an app that was downloaded only if a developer Apple knows has signed it
// and Apple has looked it over (notarized it). Both are done here where they can be:
//   signed      with the "Developer ID Application" certificate in the keychain, which
//               is found by itself
//   notarized   with what APPLE_KEYCHAIN_PROFILE names, a profile kept by `xcrun
//               notarytool store-credentials`; or with an App Store Connect key, given
//               as APPLE_API_KEY (its file), APPLE_API_KEY_ID and APPLE_API_ISSUER
// With neither the app is still made, and runs on the Mac that made it.
import { resolve } from "node:path"

import { Arch, Platform, build } from "electron-builder"

const ROOT = resolve(import.meta.dirname, "..")

const asked = ["arm64", "x64"].filter((arch) =>
  process.argv.includes(`--${arch}`)
)
// On a Mac both kinds are made; on Linux the machine's own, unless asked.
const host = process.arch === "arm64" ? "arm64" : "x64"
const archs =
  asked.length > 0 ? asked : process.platform === "darwin" ? ["arm64", "x64"] : [host]

const notarized = Boolean(
  process.env.APPLE_KEYCHAIN_PROFILE ||
  (process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER)
)

// The app again as files to download, and what names them: a disk image for each kind
// of Mac, where a Mac is what it is made on, and an AppImage, a deb, a pacman package
// and an rpm, where Linux is. An installed app updates itself from the archives the
// yml file names, so it has to be the one made for every kind at once: latest-mac.yml
// on a Mac, latest-linux.yml on Linux.
const linuxKinds = ["AppImage", "deb", "pacman", "rpm"]
const askedKinds = linuxKinds.filter((kind) =>
  process.argv.includes(`--${kind.toLowerCase()}`)
)

const shared = {
  // what every system knows the app by, and files what it lets the app do under: not
  // to be changed once people have the app
  appId: "dev.enclose.desktop",
  copyright: "Copyright © 2026 Glauber",
  directories: { output: "release" },
  // The build, and of the icons the ones a window is given. Of node_modules, what the
  // Electron side loads as it runs comes along by itself: the package's dependencies,
  // which is why what Vite bundles into the window is listed as a devDependency.
  files: [
    "dist",
    "dist-electron",
    "icons/icon-512.png",
    "icons/icon.ico",
    "!**/*.map",
    // The agent SDK brings a Claude Code of its own, a quarter of a gigabyte of it.
    // The app runs the one on the user's machine (see `running` in electron/claude.ts).
    "!**/node_modules/@anthropic-ai/claude-agent-sdk-*/**",
  ],
  // The kit goes in as it is, beside the app's archive and not in it: Python reads it,
  // and an agent copies from it (`TOP` in electron/main.ts is where it is looked for).
  extraResources: [
    {
      from: "../../kit",
      to: "kit",
      filter: ["**/*", "!**/__pycache__", "!**/.DS_Store"],
    },
  ],
  // Where an app that is installed looks for the versions after it: the releases of
  // the app's repository, the latest of them. It is written into the app, and is why
  // latest-mac.yml (or latest-linux.yml) is made.
  publish: { provider: "github", owner: "enclosedev", repo: "enclose" },
}

let made
let feed
if (process.platform === "darwin") {
  made = await build({
    projectDir: ROOT,
    targets: Platform.MAC.createTarget(
      ["dmg", "zip"],
      ...archs.map((arch) => Arch[arch])
    ),
    // (made, and no more: a release is put up by hand, as docs/development.md says)
    publish: "never",
    config: {
      ...shared,
      mac: {
        category: "public.app-category.graphics-design",
        icon: "icons/icon.icns",
        // (by the name alone: what the app is shown as has spaces in it, and a download
        // is linked to by this)
        artifactName: "Enclose-${version}-${arch}.${ext}",
        notarize: notarized,
        // A Mac asks its user before an app, or anything the app runs, reads one of these
        // folders, and shows them this as the reason.
        extendInfo: {
          NSDocumentsFolderUsageDescription:
            "Enclose keeps its projects in your Documents folder, and opens the ones you have there.",
          NSDesktopFolderUsageDescription:
            "Enclose opens the projects and CAD files you have on your Desktop.",
          NSDownloadsFolderUsageDescription:
            "Enclose opens the projects and CAD files you have in Downloads.",
        },
      },
      // The window the disk image opens: the app, and the Applications folder it is
      // dragged to, with an arrow between them. The arrow is in the picture behind
      // (installer/background.svg, which `npm run icons` makes pictures of), and the
      // window is the size of that picture. It is a light one: Finder writes the names
      // under the icons in black whatever is behind them.
      dmg: {
        // The disk images are named for the kind of Mac and not for the version, so that
        // the newest of each is always at one address: the site's download button, and
        // enclose.dev/download, go to
        //   github.com/enclosedev/enclose/releases/latest/download/Enclose-arm64.dmg
        // (and -x64), which GitHub answers with whichever release is the latest. The
        // archives an installed app updates from keep their versions: latest-mac.yml
        // names them, and nothing else has to find them.
        artifactName: "Enclose-${arch}.${ext}",
        title: "${productName}",
        background: "installer/background.png",
        iconSize: 128,
        iconTextSize: 13,
        contents: [
          { x: 180, y: 166, type: "file" },
          { x: 480, y: 166, type: "link", path: "/Applications" },
        ],
      },
    },
  })
  feed = "latest-mac.yml"
} else {
  // Building a deb takes dpkg-deb, and an rpm takes rpmbuild: on Arch both come from
  // the system (`sudo pacman -S dpkg rpm-tools`). An AppImage and a pacman package
  // need nothing but what npm installs.
  const kinds = askedKinds.length > 0 ? askedKinds : linuxKinds
  made = await build({
    projectDir: ROOT,
    targets: Platform.LINUX.createTarget(
      kinds,
      ...archs.map((arch) => Arch[arch])
    ),
    // (made, and no more: a release is put up by hand, as docs/development.md says)
    publish: "never",
    config: {
      ...shared,
      linux: {
        category: "Graphics",
        icon: "icons/icon-512.png",
        executableName: "enclose",
        // The contact stamped into the deb, pacman and rpm metadata. fpm takes it
        // as it is; without it (or an author email in package.json) those targets
        // refuse to build.
        maintainer: "Enclose (https://enclose.dev)",
        // What the window manager knows the app by, so a running window links to
        // the desktop entry instead of showing a second icon (`desktopName` in
        // package.json is what Electron takes as its app_id).
        syncDesktopName: true,
        // The names keep their versions: latest-linux.yml names the archives an
        // installed app updates from, and nothing else has to find them.
        artifactName: "Enclose-${version}-${arch}.${ext}",
        // CAD files open in the app from the file manager, and the entry the desktop
        // shows the app under.
        desktop: {
          entry: {
            Name: "Enclose (Alpha)",
            Comment: "CAD workbench with a Claude handoff",
            MimeType: "model/step;",
          },
        },
      },
      pacman: {
        // electron-builder's defaults name `http-parser` and `libappindicator-gtk3`,
        // neither of which Arch's repositories still carry (http-parser was dropped;
        // the app sets no status icon, so no indicator library is needed). The rest
        // is the default list, unchanged.
        depends: [
          "c-ares",
          "ffmpeg",
          "gtk3",
          "libevent",
          "libvpx",
          "libxslt",
          "libxss",
          "minizip",
          "nss",
          "re2",
          "snappy",
          "libnotify",
        ],
      },
    },
  })
  feed = "latest-linux.yml"
  if (asked.length > 0 && archs.length < 2)
    console.warn(
      `[dist] made for ${archs.join(", ")} only: ${feed} names no update for the other kinds, and is not one to release`
    )
}

// what goes up with a release
for (const file of [
  ...made.filter((one) => !/\.(yml|yaml)$/.test(one)),
  resolve(ROOT, `release/${feed}`),
])
  console.log(`[dist] ${file}`)
if (process.platform === "darwin") {
  if (archs.length < 2)
    console.warn(
      "[dist] made for one kind of Mac only: latest-mac.yml names no update for the other, and is not one to release"
    )
  if (!notarized)
    console.warn(
      "[dist] not notarized: a Mac that downloads this will not open it. Set APPLE_KEYCHAIN_PROFILE, or the APPLE_API_KEY three (see the top of scripts/dist.mjs)"
    )
}
