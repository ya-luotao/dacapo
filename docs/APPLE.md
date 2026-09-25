# dacapo — Apple apps (iPhone, iPad, Mac)

Status: A1 (the app) is built in [`apple/`](../apple/README.md); A2 (store) is next. The web app
stays the primary codebase; the Apple apps wrap it.

## Approach

A **SwiftUI multiplatform app** (iOS, iPadOS, macOS from one project) hosting the built web app
in a **WKWebView**, with a small native layer:

- **Web MIDI bridge.** WebKit has no Web MIDI on any Apple platform. A CoreMIDI bridge provides
  the subset of the Web MIDI API that dacapo uses (`navigator.requestMIDIAccess`, inputs and
  outputs, `midimessage`, `statechange`, `MIDIOutput.send(data, timestamp)`), injected before the
  page loads, so the web code does not change. Timestamps are taken natively when a message
  arrives and converted to the page's `performance.now()` timeline; outgoing messages are
  scheduled natively from their timestamps. Reaction-time and rhythm measurements must be as
  accurate as in Chrome.
- **Bundled, offline.** The production web build ships inside the app and is served through a
  custom URL scheme (stable origin for IndexedDB, correct MIME types for ES modules and WASM).
  No network access is needed.
- **Native affordances.** Export through the share sheet / save panel; keep the screen awake
  while practising; silence MIDI output when the app goes to the background; sensible window
  sizes on Mac; iPad in landscape on a music stand is the primary layout.

## Renderer and licences

- The apps use **Verovio** like the web build, shipped unmodified. Its lead maintainer stated
  publicly (rism-digital/verovio#2559, #998) that App Store apps may use Verovio without a
  re-linking mechanism provided Verovio is credited in the App Store metadata and in the app's
  About screen, and any modifications are published under the LGPL. We credit it in both places
  and do not modify it.
- Everything else is compatible: our code (MIT), Bravura and Source fonts (OFL), VexFlow (MIT),
  PDMX-derived pieces (CC BY 4.0, attributed). The in-app licences screen lists them.

## Distribution

App Store (iOS/iPadOS and Mac App Store), in English and Simplified Chinese. No accounts, no
tracking, no data collection (privacy label "Data Not Collected"); a privacy manifest; no
non-exempt encryption.

## Milestones

1. **A0 Spike** — project layout, custom-scheme hosting of the web build, the CoreMIDI bridge (in
   and out) with timestamp accuracy measured, Verovio in the app (size, memory, load time, credits),
   sandbox/entitlements on macOS, simulator and device testing strategy, App Store review risks
   (guidelines 2.5.2, 4.2). Report; no polish.
2. **A1 App** — production shell on iPhone, iPad and Mac; bridge hardened; export/import through
   native file UI; lifecycle (background, audio session, screen awake);
   layout checks on iPad and iPhone.
3. **A2 Store** — icons, launch screen, privacy manifest, licences screen, App Store metadata and
   screenshots (en, zh-CN), review notes, TestFlight, submission.

## Clarifications

Decided while building A1; the reasons are in the code comments and `apple/README.md`.

- **One project, one target, settings as text.** `apple/Dacapo.xcodeproj` has one multiplatform
  app target (native macOS, not Catalyst) and a unit-test target, both on synchronized folders.
  Every build setting is in `apple/Config/*.xcconfig`; CI fails if the project file gains any.
- **One window.** The app has one web view and one practice state: a single `Window` on the Mac
  (1280×820 by default, 720×560 at least) and no multiple scenes on iPad.
- **The Debug harness never ships.** It is compiled out of Release, its files are excluded, and
  the build fails if a Release product contains any of it or the Debug-only Info.plist keys
  (the `audio` background mode that virtual MIDI ports need on iOS, and Files sharing).
- **Silencing on leaving the screen.** The page stops and silences itself on `visibilitychange`,
  as in a browser. The app also sends the page's panic sequence (sustain up, all notes off, all
  sound off on every channel) to every output the page used, and releases notes it had scheduled
  for later, like the page's own panic. It does **not** use `MIDIFlushOutput`: CoreMIDI delivers a
  flush to a virtual destination as a System Reset message (0xFF), and a System Reset must not
  reach an instrument. On the Mac, "leaving the screen" is the window being hidden or covered,
  which is when WebKit hides the page.
- **Screen awake.** The page asks the app (`src/lib/shell.ts`) while a Read session, a piece run,
  a demo or a rhythm run is active. Sessions that wait for the player let go after five minutes
  without a key played. On the Mac the display may still sleep while the window is hidden.
- **The click with the silent switch on.** The app's audio session is `.playback` with
  `.mixWithOthers`, and the page's `navigator.audioSession.type` is `playback`.
- **Files.** Export goes through the share sheet (iPhone, iPad) or a save panel (Mac); the page
  keeps using a `download` link. The app declares the MusicXML types (`com.recordare.musicxml`,
  `.mxl` as `com.recordare.musicxml.compressed`) so the iPad document picker offers those files.
- **App wording.** In the app, a message key with a `.app` variant uses it (no browser, tab,
  site data or download wording, no other platform named; guideline 2.3.10). A test fails when a
  browser-only message has no app variant. The About page (`#/about`) with the Verovio credit and
  every licence text is part of the web build too.
- **Languages.** WebKit reports the app's own language to the page, so the app bundle must be
  localised into every language the web app offers (`Resources/Localizable.xcstrings` and the
  project's `knownRegions`: en, zh-Hans, zh-Hant, ja, ko). A new web locale needs its app
  localisation as well; the page maps `zh-Hant` to zh-TW.
- **Layout.** The page uses the whole screen (`viewport-fit=cover`) and pads itself with the safe
  areas. Where the practice page is one screen and its sheet is tall for its width (an iPad in
  portrait), the score is drawn up to 40 % larger instead of leaving the sheet half empty.
- **A crashed web process** (usually memory pressure in the background) reloads the route it
  showed; after three crashes in a minute it starts from Play.
- **Deployment floor** stays iOS/iPadOS 17 and macOS 14. The app was checked on the iOS 18.0
  simulator; no iOS 17 simulator runtime was available.
