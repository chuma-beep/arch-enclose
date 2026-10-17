# Enclose

A desktop workbench for CAD projects that are built from code
([enclose.dev](https://enclose.dev)). You look at the model in 3D, click the part you
mean, say what should change, and Claude edits the project and rebuilds it.

The circuit boards that go in a model are designed with
[tscircuit](https://tscircuit.com), and drawn in the app with its libraries.

Early days: for macOS and Linux, and of CAD files it opens STEP, STL and OBJ.

## Install

Download the latest version from
[GitHub Releases](https://github.com/enclosedev/enclose/releases/latest): the disk image
that ends in `arm64` for Apple silicon, `x64` for Intel, or on Linux the AppImage, deb,
pacman package or rpm. It needs macOS 13 or newer, or Linux on x86_64 or aarch64, and
[Claude Code](https://code.claude.com/docs/en/overview) installed and signed in; and
for circuit boards, [Node.js](https://nodejs.org).

## Documentation

[docs/](docs/README.md): installing, how the app works, and running it from source.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) says how.

## License

[AGPL-3.0](LICENSE). [NOTICE.md](NOTICE.md) has the copyright, an added permission for
the Claude Agent SDK, and what came from others.
