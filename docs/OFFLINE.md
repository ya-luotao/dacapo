# dacapo — Offline specification (the web app without a network)

Status: G6a is built (the worker, the list, the registration, Settings' block; the decisions made
while building it are under "Clarifications" at the end). This extends [MVP.md](MVP.md) and the
later specifications; their principles and fixed decisions still apply: everything is part of the build, nothing comes from a CDN, and the
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
  service's paths, and the site's own pages: the lessons, the pieces and the home pages a search
  engine reads, [SITE.md](SITE.md)) and every other origin (the sync service). The worker does
  not touch these requests at all.

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
- **A release that raises the database version** (`DB_VERSION` in `src/storage/db.ts`) can meet
  an older stored page until the new worker has installed: the database is upgraded by a tab on
  the new files, and a page drawn from the store of the release before then finds a version
  later than its own. That page runs in memory, leaves the database untouched and says to
  reload ([LEARN.md](LEARN.md), "Clarifications (decided during G3)"); the reload brings the
  new files. Such a release cannot be rolled back to a lower version ([SYNC.md](SYNC.md),
  "Builds").
- `sw.js` is served with `Cache-Control: no-cache` (`public/_headers`), so a fix to the worker
  reaches browsers at their next visit. Should the worker ever have to go, a release ships a
  `sw.js` that unregisters itself and deletes the stores; that file is kept ready in the repository
  (`scripts/offline/sw-remove.js`) with a line in this document on when to use it.
- **Every deploy carries an `sw.js`.** From the first release with the worker on, every deploy
  must have an `sw.js` at its root: the built one, or `scripts/offline/sw-remove.js`. Reverting
  the commit that added the worker, or rolling back in the dashboard to a build from before it,
  is **not** a withdrawal: `/sw.js` becomes a 404 (answered by the account service), the
  browser's check for a new worker fails, and the registration, the worker and its stores stay
  as they are. On a slow load (more than three seconds) or without a network those browsers
  then show the build the worker stored, for as long as they live. So that this is not
  forgotten: the build fails when it has not written an `sw.js` with a sound list (the plugin
  in `vite.config.ts`, with `listProblems` in `src/offline/list.ts`), and
  `src/offline/list.test.ts` fails when the plugin is taken out of the build. Neither can see a
  revert of the whole commit or a rollback in the dashboard: for those there is only this rule.
- **A fix to the worker reaches a browser only where its install succeeds**: the new `sw.js`
  takes over once it has stored the whole app, so a browser that cannot (no space left, a file
  the server does not give) keeps the worker it has. The withdrawal worker is the one path that
  does not depend on that: it stores nothing, so it always installs.
- **When to withdraw the worker, and how.** When browsers are being served a broken app from the
  stores and a fix to the app or to `sw.js` does not cure it (the fix is always tried first: the
  page comes from the network, and a new `sw.js` replaces the old at the next visit), or when
  offline is given up. Ship a release whose `sw.js` is the withdrawal worker, by adding the copy
  to the build command (`pnpm build:site && cp scripts/offline/sw-remove.js dist/sw.js`), and in
  the same release take out both `registerOffline()` (`src/main.tsx`) and Settings' Offline block
  (`OfflineBlock` in `src/ui/settings/DataSection.tsx`). At its next visit with a network each
  browser replaces its worker with this one, which deletes the worker's stores at its scope,
  unregisters itself, answers no request and reloads nothing; IndexedDB and the preferences are
  not touched. Keep serving it for as long as a browser may still hold the old worker: a browser
  that never comes back keeps what it has.
  - What a page that still registers does: it registers the withdrawal worker again at every
    visit, and the worker unregisters itself again. With a second tab still open on the old
    registration, Chromium does not let go of it: the registration is revived and stays, with
    the withdrawal worker in it, which stores nothing and answers nothing. Inert and harmless,
    but it is there until the page stops registering; hence the two removals above.
  - What a block left in Settings does: it says "Not stored yet.", and each time it is opened it
    waits ten seconds for a status the withdrawal worker never gives (it has no ear for
    messages; the page cannot tell it from the real one, both being `sw.js`).

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

1. ✓ **G6a Offline** — the worker, the list, the registration, Settings' block, `_headers`.

## Clarifications (decided during G6a)

- **The list** (`src/offline/files.ts`, written by the plugin in `vite.config.ts`). 336 files in
  the build of release 0.2.0: the app's 221 (4.5 MB as stored), the engraver's 2 (7.3 MB), the
  piano's 90 samples (3.8 MB), the lessons' 6 pictures (0.8 MB), the 4 dictionaries (0.8 MB) and
  the 13 licence texts (0.1 MB). The pages of [SITE.md](SITE.md) are not among them. A file's group comes from what the
  build made it from, never from its name: the engraver is whatever comes out of
  `node_modules/verovio`, a language is a chunk loaded on demand for a file of `src/i18n/`. The
  lessons' own texts (per lesson and language) are small and are the app. Of `public/` only what
  is named is listed (the manifest, the favicon, `icons/`, `piano/`, `learn/`, `licenses/`):
  `_headers`, `robots.txt`, the sitemap, the social card and whatever is added later are not the
  worker's; nor are the site's pages and the pieces' scores, which the build writes before the
  list is taken (`learn/staff.html` beside the lessons' pictures, `pieces/…`, `zh-cn/…`:
  [SITE.md](SITE.md)), so `sw.js` is the same with them and without. No page but the app's is
  ever listed, in whatever folder: Cloudflare answers
  `x.html` with a redirect to `x`, which cannot be stored, and one such file among the app's
  would fail every install. The build fails when its list is not sound (`listProblems`,
  `src/offline/list.ts`: the page is there, every file under `/assets/` the page names is there,
  no other page and not `sw.js`) or when it has not written `sw.js`. The **licence texts**, which About fetches when one is opened, are not in the
  specification's groups: they are in the second (stored when first read, and with Store
  everything). Each entry has the file's size, so Settings says "about 12 MB" from the list. The
  version is the first 12 hex digits of the SHA-256 of the list.
- **`sw.js` is the same for the same list.** No build time is in it: a push that changes no file
  of the list (documentation, the Apple app) gives the same `sw.js` byte for byte, browsers see no
  new worker, and the stores are not turned over.
- **Store names: `dacapo-offline:<scope path>:<order>:<version>`**, e.g.
  `dacapo-offline:/:3:8f7cb91a81f9` (`src/offline/stores.ts`). Cache Storage belongs to the whole
  origin, so the scope is in the name: two copies of dacapo on one origin (`/` and `/dacapo/`)
  keep apart, and a worker only ever opens or deletes names that start with its own prefix and
  parse as an order and a version; no other cache and no IndexedDB database is touched. The
  **order** counts the stores made on this device (one more than the latest), so "the one before"
  is the release this browser ran before, whatever was built when; a version this device ran
  earlier (a release taken back) gets a new store with the next number. A fix to the worker alone
  has the same list and takes up its store again.
- **Install.** The app's files are fetched six at a time; the page, the manifest and the icons
  past the browser's own cache (`cache: 'reload'`), the files under `/assets/` through it. A file under
  `/assets/` that an older store of the worker holds is copied, not fetched; so is whatever an
  older store holds of the second group (the engraver, the piano), so that it does not go when
  that store is deleted. **The page is stored last**, so a store that holds the page is one
  whose install finished. If one of the app's files cannot be stored (no network, an error
  answer, no space left), the install fails, the store it had begun is deleted, and the worker
  before (or none) stays in charge; the browser tries again at the next visit.
- **A store left by an install that was cut short** (the browser was closed, the worker killed)
  has no page. The worker that made it takes it up again at its next install. Another worker
  taking over does not count it as "the one before" (that is the latest store that holds a
  page) and deletes it with the obsolete ones, so the tab still open on the last release that
  did install keeps its store. One with a later number than the worker's own may be an install
  still running and is left alone. The worker's own store is never deleted. (An empty store of
  an old name can also appear when a lookup opens a store at the moment another worker deletes
  it; it has no page either, and goes the same way.)
- **Work behind an answer is bounded.** Renewing the stored page or a sample, and storing a
  file just fetched, go on after the answer is given and hold the worker meanwhile; for thirty
  seconds at most (`BEHIND_WAIT`). A request that the network accepts and never answers would
  otherwise hold the worker for good, and a release waiting to take over with it.
- **The page is the scope's address, never `index.html`.** Cloudflare redirects `/index.html` to
  `/`, and a redirected answer cannot be given to a navigation. So the list has the page as the
  scope itself, a navigation to the scope or to `index.html` below it (with any query) is the
  page, and no redirected answer is ever stored.
- **What is never stored**: an answer that is not a plain 200, a redirected one, and a page
  (`text/html`) where a file was asked for. A host that answers every unknown address with the
  app (as `vite preview` does) would otherwise have a page stored as a script, and the app would
  stay broken until the next release.
- **The stored page is renewed only with a page of the same build**: one in which every file
  under `/assets/` that it names is in the worker's list. The specification renews it with every
  navigation; but the first load after a release is answered by the old worker with the new
  page, and stored beside the old files that page would open without a network and find none of
  its own. The new page is passed on to the browser as it is, and its own worker, installing at
  that moment, stores it with its files. The install checks the page the same way, for the
  moment a release is being deployed, and so does the worker when the page asks it to store the
  page again (`store`), which it does only once the rest of the app is in the store. What the rule still does: a page that changes without a
  new list (its description, a header the host adds) is renewed.
- **A navigation gets the server's answer whenever there is one**, errors included; the stored
  page is for no answer at all, or none within three seconds (the network's answer, if it comes
  later, still renews the copy).
- **A file under `/assets/` that the list does not have** is looked for in the worker's stores (a
  tab on the release before finds its file there), then left to the network, and not kept.
  Lookups go to the current store first, then the others, the latest first, by address alone
  (`ignoreVary`).
- **Not answered at all**: anything but GET, another origin, any navigation that is not the
  page, a request with a `Range` header (a stored copy is the whole file; the piano fetches its
  samples whole, so nothing in the app asks for a part), and a file's address with a query.
- **"Stored when first fetched" also means fetched before the worker took over.** On the first
  visit the page has loaded the dictionary in use (and perhaps a lesson's pictures, the samples)
  before there is a worker. Once one is in charge, the page asks it to store the files of its
  list that the page has loaded already (`performance.getEntriesByType('resource')`,
  `src/offline/client.ts`), so a Chinese, Japanese or Korean reader's app opens in its language
  without a network after the first visit.
- **Store everything** is the page asking the worker, file by file and four at a time, to store
  what its list has and its store lacks (`status` and `store` messages, `src/offline/messages.ts`;
  the worker may be another build's than the page's, so the two messages are all there is, and a
  reply is checked before it is believed). The worker answers each file with whether it is stored
  now, so a file that could not be fetched and one the device has no room for (a
  `QuotaExceededError`) are both counted; the block then says which groups are incomplete ("Could
  not be stored: the notation engine, the lessons' pictures."), and pressing again fetches only
  what is missing. The page waits ten seconds for a status and two minutes for a file.
  **The choice is kept** (`dacapo.offline.everything` in `localStorage`): a
  release renames the dictionaries and most scripts, and where everything was stored once, the
  page stores the new list's rest again, without a word, when the new worker takes over. There
  is no button to undo it; clearing the site's data does.
- **Settings' block** is under Your data, below export and import, in the web app only (the Apple
  app carries the build and shows nothing). "Not stored yet." while there is no worker in charge
  or a file of the app is missing (which the page then asks the worker to store again); "This
  browser does not keep the app offline." where there are no service workers, where the browser
  refuses the registration (some private modes), and in `pnpm dev`. Store everything appears
  once a worker has answered, and gives way to "Everything is stored: …" when nothing is
  missing. The count ("23 of 115 files") replaces the help under the button and is not announced
  file by file; the end is. In the interface the engraver is "the notation engine", as the Pieces
  page already calls it.
- **Registration**: `register('sw.js', { scope: './' })`, relative to the page, after the first
  render and the window's `load`; any failure is swallowed and leaves the page as it is without
  a worker.
- **TypeScript.** `src/offline/sw.ts` (the worker's events) is checked by `tsconfig.worker.json`
  with the `WebWorker` library and is excluded from the app's project, whose libraries are
  unchanged; everything it does is in `worker.ts`, which uses only what both libraries have and
  runs in the unit tests with stores and a network handed in. The plugin builds `sw.ts` in a
  second, small build into one plain script (`iife`), so it registers as a classic worker.
- **The Apple app**: its build runs the same Vite build, so `sw.js` is written, and
  `apple/scripts/embed-web.sh` leaves it out of the bundle beside `_headers`. It would be
  harmless there: the app never registers it.
- **Verified in Chrome** (headless, against `vite preview`, the server stopped for "without a
  network"): the first load, the app without a network, a first visit in Chinese, Store
  everything and every page, piece, picture and language without a network, three releases on
  one profile with a tab left open on the first, the paths that are not the app's, a build below
  `/dacapo/`, the withdrawal worker, a network that accepts the connection and does not answer
  (the stored page after three seconds; a release waiting behind such a request takes over
  after thirty), and a release after an install cut short by killing the worker. Not run in
  Safari or Firefox.
