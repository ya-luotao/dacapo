# dacapo for iPhone, iPad and Mac

The Apple apps wrap the web app in a `WKWebView`, with a small native layer: a CoreMIDI bridge
that gives the page Web MIDI (WebKit has none), native file export and import, and the app
lifecycle. The web app is the same build as the website; it runs unchanged. The design and its
reasons are in [docs/APPLE.md](../docs/APPLE.md).

## Requirements

- Xcode 26 or newer (the project uses synchronized folders and Swift 6). The app runs on
  iOS/iPadOS 17 and macOS 14 or newer.
- The web toolchain from [CONTRIBUTING.md](../CONTRIBUTING.md): Node.js and pnpm, `pnpm install`.

## Build and run

Open `apple/Dacapo.xcodeproj` in Xcode, pick the `Dacapo` scheme and a destination (My Mac, an
iPad or iPhone simulator) and run. Or from the repository root:

```sh
# Mac
xcodebuild -project apple/Dacapo.xcodeproj -scheme Dacapo -destination 'platform=macOS' build
# iOS simulator
xcodebuild -project apple/Dacapo.xcodeproj -scheme Dacapo \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' build
# Native unit tests (DacapoTests), on the Mac or a simulator
xcodebuild -project apple/Dacapo.xcodeproj -scheme Dacapo -destination 'platform=macOS' test
```

Each build runs `scripts/embed-web.sh`, which builds the web app with Vite into the build folder
and copies it into the app as `web/`. With `DACAPO_SKIP_WEB_BUILD=YES` it copies the repository's
existing `dist/` instead (run `pnpm build` first), which is faster when only Swift changes and is
what CI does. Type checking and web tests stay with `pnpm check`.

## Layout

```
apple/
  Dacapo.xcodeproj/   one multiplatform target (iOS, iPadOS, macOS) and the test target; the
                      folders below are synchronized, so adding a file never touches the project
  Config/             every build setting, as .xcconfig files; Info.plist keys that have no
                      INFOPLIST_KEY_ setting; the Mac entitlements
  Dacapo/
    App/              the SwiftUI app, menus, lifecycle (keep awake, audio session, visibility)
    Web/              web view host, dacapo:// scheme handler, downloads, page ↔ app messages,
                      app-shell.js (marks the page as running in the app)
    MIDI/             CoreMIDI engine, UMP ↔ MIDI 1.0 bytes, the bridge and midi-bridge.js (the
                      Web MIDI shim injected into the page)
    Resources/        asset catalog (paper colour, accent), native strings (en, zh-Hans)
    Debug/            the test harness; Debug builds only
  DacapoTests/        unit tests of the native layer (Swift Testing)
  scripts/            build phase and CI helpers
```

**Build settings belong in `Config/*.xcconfig`, never in the project file.** Xcode's build
settings editor writes into `project.pbxproj`; `scripts/check-pbxproj.sh` (run by CI) fails when
it finds settings there.

The web side of the app lives with the web app: `src/lib/shell.ts` (the app marker and the
keep-awake message), app wording as `.app` keys in `src/i18n/` (see `src/i18n/shellWording.ts`),
and `src/apple/midi-bridge.test.ts`, which runs `MIDI/midi-bridge.js` under vitest.

## Signing

The repository has no signing team. Without one:

- the Mac app is signed to run locally (ad hoc), sandboxed, with the hardened runtime;
- simulator builds are unsigned;
- device builds, archives and TestFlight need a team.

To sign with your own team, create `apple/Config/Local.xcconfig` (git-ignored):

```
DEVELOPMENT_TEAM = ABCDE12345
// Optional, if the placeholder identifier is taken in your account:
// PRODUCT_BUNDLE_IDENTIFIER = com.example.dacapo
```

`Dacapo.xcconfig` includes it when it exists. Never commit a team or signing identity.

## The test harness (Debug builds)

`Dacapo/Debug/Harness.swift` drives the app for tests that need the real web view and CoreMIDI:
a hosting probe, MIDI timing and hot-plugging with virtual ports, a wait-mode and a rhythm-mode
demo, export and import, lifecycle checks. It is compiled out of Release (`#if DEBUG`), its files
are excluded from Release (`Config/Dacapo-Release.xcconfig`), and `scripts/embed-web.sh` fails a
Release build that contains any of it or the Debug-only Info.plist keys.

Debug builds on iOS declare the `audio` background mode: iOS refuses virtual MIDI endpoints
without it (`kMIDINotPermitted`). Release builds never declare it.

Run it from the Mac's Debug menu, or with launch arguments on any platform:

```sh
# on a simulator: install, run, collect the JSON results, check them (as CI does)
apple/scripts/run-harness.sh <simulator udid> <path/to/Debug-iphonesimulator/Dacapo.app> \
  probe,hotplug,timing apple/build/harness
apple/scripts/check-harness.py apple/build/harness

# on the Mac
open -W <path/to/Debug/Dacapo.app> --args -dacapoAuto probe,hotplug,timing -dacapoQuit YES
```

| Mode                                                          | What it does                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `probe`                                                       | Hosting checks: origin, secure context, MIME types, WebAssembly, fonts, lazy routes                                            |
| `hotplug`                                                     | A virtual source comes and goes; `statechange` and the Play page follow                                                        |
| `timing`                                                      | 192 messages from a virtual source (idle and with a busy page), 100 scheduled notes out; timestamps, delivery, output accuracy |
| `wait`, `rhythm`                                              | Ode to Joy in wait mode and in rhythm mode, played by the virtual source                                                       |
| `lifecycle`                                                   | Keep-awake around a Read session; the native panic on hiding                                                                   |
| `export`                                                      | The Settings export through the download handling (`-dacapoPresent YES` shows the share sheet or save panel)                   |
| `file`                                                        | The Pieces import (Mac: the open panel is answered with a bundled score; `-dacapoImportMXL YES` for the `.mxl`)                |
| `seed`                                                        | Copies test scores into Documents, which Debug builds share with the Files app                                                 |
| `shell`, `audio`, `utypes`                                    | App marker and browser-only wording on every page; audio session; MusicXML types                                               |
| `route:#/…`, `sleep:N`, `shot:name`, `window:WxH`, `orient:…` | Helpers for screenshots                                                                                                        |

Results go to `Documents/harness/*.json` in the app's container (on the Mac:
`~/Library/Containers/io.github.yaluotao.dacapo/Data/Documents/harness`).

The iOS simulator does not see the Mac's MIDI devices; the harness's virtual ports stand in for a
keyboard. Test a real keyboard on a device (see docs/APPLE.md).
