# dacapo — Offline specification (the web app without a network)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply: everything is part of the build, nothing comes from a CDN, and the
practice data never leaves the browser unless its owner syncs it.

Goal: a piano often stands where the network does not reach, and a practice app that opens only
with a connection fails exactly there. The web app is installable (a manifest) but keeps nothing:
after the first load it lives on the browser's HTTP cache, which holds what happened to be
fetched and promises nothing. This adds a service worker so that the app opens and works without
a network once it has been opened with one, and a way to store the rest on purpose. The Apple app
carries the build inside it and is not concerned.

## What is stored

A build's files fall in three groups (the worker is generated with the build and carries the
list, each file with the group it is in, and a version that is the hash of the list):

- **The app**: `index.html`, every script and stylesheet under `/assets/` except the two below,
  the fonts, the manifest, the icons. Stored when the worker is installed, in the background, after
  the page has loaded: from then on every page of the app opens without a network.
- **Large and not always needed**: the music engraver (Verovio, about 7 MB, for Pieces and
  Scales), the built-in piano's samples (about 4 MB), the lessons' pictures, and the dictionaries
  of the languages not in use. Stored when first fetched; all at once with **Store everything**
  (below).
- **Not the app's**: anything else on the origin (the privacy page, profile pages, the account
  service's paths) and every other origin (the sync service). The worker does not touch these
  requests at all.

## How a request is answered

- **A navigation to the app** (the page itself): from the network, and the copy stored is renewed
  with it; without a network, or after three seconds without an answer, from the copy stored. So a
  new release is seen at the next load with a network, as today, and a tab never needs to be told
  to reload.
- **A file under `/assets/`** (named by its content, so it never changes): from the store when it
  is there, else from the network, and kept.
- **The other files of the list** (the samples, pictures, icons): from the store when there, and
  fetched again in the background to renew the copy.
- **Anything not in the list**: not answered by the worker (the browser does as it would without
  one).
- An error inside the worker never becomes the answer: whatever fails falls back to the network.

## Releases

- The store is named by the build's version. A new worker installs beside the running one, stores
  its app files, and takes over at once (the worker has no logic that belongs to one build: it
  answers by address, and a page of the release before finds its files in the store of the release
  before).
- On taking over it deletes every store but its own and the one before it: a tab still open on the
  release before keeps working, and nothing older is kept.
- `sw.js` is served with `Cache-Control: no-cache` (`public/_headers`), so a fix to the worker
  reaches browsers at their next visit. Should the worker ever have to go, a release ships a
  `sw.js` that unregisters itself and deletes the stores; that file is kept ready in the repository
  (`scripts/offline/sw-remove.js`) with a line in this document on when to use it.

## In the app

- Registered by the web app only, in a production build, after the first render (`main.tsx`); not
  in the Apple app, not in development, and not where the browser has no service workers. A build
  below a sub-path (`BASE_PATH`) registers it there, with that scope.
- **Settings → Your data** gains **Offline**: what is stored ("The app is stored on this device
  and opens without a network." / "Not stored yet." / "This browser does not keep the app
  offline."), and **Store everything** ("the engraver, the piano and every language, about
  12 MB"), which fetches the rest of the list with a count as it goes and says when it is done or
  what could not be fetched. Nothing is stored that the build does not contain, and nothing of
  the player's.
- Without a network the app says nothing: practice needs none. The account's sync already waits
  and tries again.

## Code

- `src/offline/`: the routing decision as a pure function with tests (a request's address and
  kind in; one of the answers above out), the worker's source built to `sw.js` at the root of the
  build without a content hash, and the registration with its state for Settings. A small plugin
  in `vite.config.ts` writes the list from the build's own output. No new dependency.

## Milestones

1. **G6a Offline** — the worker, the list, the registration, Settings' block, `_headers`.
