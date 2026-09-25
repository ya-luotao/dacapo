# dacapo — Apple apps (iPhone, iPad, Mac)

Status: planned. The web app stays the primary codebase; the Apple apps wrap it.

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

- The App Store build uses **OpenSheetMusicDisplay** (BSD-3-Clause) for the Pieces score; the web
  build keeps **Verovio** (LGPL-3.0). App Store distribution conflicts with LGPL-3's requirement
  that users can replace the library (and its Installation Information rules for user products);
  this is not legal advice, but we avoid the risk. Both engines sit behind the same notation
  adapter, selected at build time. If the Verovio authors grant an App Store exception, the apps
  can switch back.
- Everything else is compatible: our code (MIT), Bravura and Source fonts (OFL), VexFlow (MIT),
  PDMX-derived pieces (CC BY 4.0, attributed). The in-app licences screen lists them.

## Distribution

App Store (iOS/iPadOS and Mac App Store), in English and Simplified Chinese. No accounts, no
tracking, no data collection (privacy label "Data Not Collected"); a privacy manifest; no
non-exempt encryption.

## Milestones

1. **A0 Spike** — project layout, custom-scheme hosting of the web build, the CoreMIDI bridge (in
   and out) with timestamp accuracy measured, the OSMD adapter at production quality check,
   sandbox/entitlements on macOS, simulator and device testing strategy, App Store review risks
   (guidelines 2.5.2, 4.2). Report; no polish.
2. **A1 App** — production shell on iPhone, iPad and Mac; bridge hardened; export/import through
   native file UI; lifecycle (background, audio session, screen awake); OSMD build variant;
   layout checks on iPad and iPhone.
3. **A2 Store** — icons, launch screen, privacy manifest, licences screen, App Store metadata and
   screenshots (en, zh-CN), review notes, TestFlight, submission.
