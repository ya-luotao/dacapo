# dacapo — Account and sync specification

Status: C1–C4 are built: the service is deployed, the official web build has the account in
Settings, and the Apple app has it too, with its privacy manifest; its App Store privacy label is
entered with the first submission (APPLE.md, A2). This extends [MVP.md](MVP.md) and the later
specifications; their principles and fixed decisions still apply, with one change: **no backend is
required.** dacapo works fully without an account, offline, as before. An account is optional and
only adds sync between the user's own devices (the browser on a computer, an iPad on the music
stand, a Mac).

Goal: practise on any of your devices and see the same log, streak, heatmap, pieces and scale
progress on all of them, without giving up the export file or working offline.

## What lives where

- **This repository** (MIT) holds the sync _client_ and this protocol. The client is off unless the
  build sets `VITE_SYNC_ENDPOINT`; a build without it (a fork, a self-built copy, the tests) has no
  account UI and makes no network request, exactly as today. (The official web site also counts
  visits with Cloudflare Web Analytics, which Cloudflare adds to its pages as they are served, set
  up in the dashboard: no cookies, no personal data, nothing about practice. It is not in the
  repository, so no build has it, the Apple app included.)
- **The service** is a separate, private project (`dacapo-cloud`) on Cloudflare: one Worker at
  `https://api.playdacapo.com`, D1 for accounts, one Durable Object with its own SQLite per user for
  the records, R2 for piece files, Cloudflare Email Service for sign-in codes. It depends on no
  third-party auth or sync framework.
- **The protocol is the only contract.** The service stores records as opaque JSON under a
  collection name and an id; it never reads or validates what is inside. Every rule about what a
  record means (which copy wins, what a deletion does) is in the client, next to `validate.ts`, so
  the data model keeps evolving in this repository alone. Anyone could run a compatible service.

## Accounts

- **Email and a 6-digit code.** No passwords, no magic links (a link opens Safari, not the Apple
  app, whose page is served from the `dacapo://` scheme), no third-party sign-in (so App Store
  guideline 4.8 does not require Sign in with Apple). The address is trimmed and lower-cased. The
  first successful code creates the account.
- A code is valid for 10 minutes and for 5 tries; asking again replaces it. At most one code per
  address per minute and 10 per hour, and 20 tries per address per day over all its codes (a new
  code gives no new tries: the chance of guessing is at most about 10⁻⁴ a day); requests are also
  limited per IP. The response is the same whether or not the address has an account. What the
  limits need (the address, a hash of the code, the counts) is kept for at most a day.
- **A token per device.** A correct code returns a random 256-bit token; the service stores only
  its SHA-256, with the device name the client sent and when it was last used. The client keeps
  the token in IndexedDB (`meta`) and sends it as `Authorization: Bearer …`. No cookies: the page
  runs on several origins (the web build, `dacapo://` in the app), and a bearer token works the
  same on all of them. Tokens do not expire; signing out revokes the device's token.
- **Deleting the account** is in the app (App Store guideline 5.1.1(v)) and removes everything on
  the service: tokens, records, piece files, codes, the account. Local data stays on the device.

## Protocol

JSON over HTTPS, versioned in the path. CORS allows any origin without credentials and allows the
`Authorization` and `Content-Type` headers. Errors are `{ "error": "<code>" }` with a status: 400
`invalid-request`, 401 `unauthorized` (missing, unknown or revoked token), 401 `invalid-code`, 413
`too-large`, 429 `rate-limited` (with `Retry-After`), 404 `not-found`, 503 `unavailable` (the code
email could not be sent, or the account is being deleted; try again later).

| Request                                          | Response                                   |
| ------------------------------------------------ | ------------------------------------------ |
| `POST /v1/auth/code` `{ email, locale }`         | 204; sends the code in the user's language |
| `POST /v1/auth/verify` `{ email, code, device }` | 200 `{ token, account: { id, email } }`    |
| `GET /v1/account`                                | 200 `{ id, email, createdAt }`             |
| `POST /v1/auth/signout`                          | 204; revokes this token                    |
| `DELETE /v1/account`                             | 204; 401 once done (see below)             |
| `POST /v1/sync` `{ cursor, changes }`            | 200 `{ rejected, cursor, changes, more }`  |
| `HEAD`, `PUT`, `GET /v1/blobs/<sha256>`          | 200 or 404; 204 on `PUT`                   |
| `GET /privacy`                                   | the service's privacy policy (HTML)        |

The username, the profile settings and the public profile page have their own requests, in
[PROFILE.md](PROFILE.md); `GET /v1/account` also returns `username`, `profile` and
`profileVersion` there.

### Sync

A **change** is `{ collection, id, body }`: `collection` matches `^[a-zA-Z]{1,32}$`, `id` is 1–128
characters, `body` is any JSON value up to 64 KB serialized. A request carries at most 500 changes
and 8 MB. The service compares bodies as text, so the client sends every body with the keys of
every object in sorted order: two devices' copies of a record then serialize the same.

The service keeps, per user, one row per `(collection, id)` with the latest body, a per-user
sequence number `seq` that grows with every write, and the token that wrote it. `POST /v1/sync`:

1. stores the changes in the request, in order, in one transaction. A write to a stored
   `(collection, id)` replaces its body and takes a new `seq` **only if the device has seen the
   stored record**: it wrote it last, or its `seq` is at most `cursor`. Otherwise the change is
   listed in `rejected` (`[{ collection, id }]`) and not stored, so a device never overwrites what
   it has not pulled yet (a rename over a deletion, an older copy over a newer one). The same body
   again is neither stored nor rejected;
2. returns the rows with `seq > cursor` in `seq` order, at
   most 1,000 or about 4 MB of bodies, **leaving out rows whose latest write came from this token**
   (the device has them already), with `cursor` the highest `seq` looked at and `more` true when
   there are further rows. A body pushed again unchanged keeps its row and its `seq`, so it is not
   sent to anyone again.

The service decides nothing else: there is no delete, no merge, no schema. A deletion is a record
too (see pieces below). A new device starts with `cursor: 0`.

### Piece files

A piece's MusicXML can be larger than a record may be, so it is stored as a blob named by the
SHA-256 (lower-case hex) of its UTF-8 text, up to 16 MB, and the piece record carries the hash.
`PUT` checks the hash. Blobs are kept per user; `DELETE /v1/account` removes them. Blobs no longer
referenced are left in place for now (pieces are few and small).

## What syncs, and which copy wins

The client pushes records in these collections, with these rules on pull. Everything else stays on
the device. Where two copies differ and neither rule decides, the one whose canonical text is longer wins,
and of two as long the one that sorts later, so every device picks the same. **When the copy here wins over a different pulled
one, it goes in the outbox again**, so the service, and through it every device, ends up with the
winner.

| Collection                                                | Body                                                    | On pull                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `attempts`, `pieceSteps`, `scaleRuns`, `answers`, `takes` | the record as stored                                    | added when its id is not stored; replaces a stored copy that differs (below) |
| `sessions`                                                | the record as stored                                    | the later copy wins (below)                                                  |
| `pieces`                                                  | `StoredPiece` without `xml` and `facts`, plus `xmlHash` | the later copy wins (below); a deletion is final                             |

- **Sessions.** A session grows while it is played, so of two copies the one with more runs (a
  scale or sight-reading session, both stored again after every run), or else the one that ended later, wins. That matters because a device can hold
  a copy that is not the last: the session it rebuilds at startup for answers that arrived before
  their session (as it does for a tab closed mid-session), which the finished session replaces.
- **Pieces.** `updatedAt` (epoch ms) is set when a piece is renamed or its hands are changed, to
  the later of now and one more than the piece's own (so a change made after seeing another is
  later even when this device's clock is behind); without it, `importedAt` counts. The copy with
  the later `updatedAt` wins. `facts` are derived: they are not synced, and filling them in
  neither changes `updatedAt` nor sends the piece. A pulled piece is stored only with its MusicXML
  downloaded and checked against its hash, so `StoredPiece.xml` stays a required string; a piece
  whose file is missing or does not match is skipped, like a record that does not validate.
- **Deleting a piece** pushes `{ deleted: true, at, withSteps }` under the piece's id. A deletion is
  final: it wins over any copy of the piece, earlier or later, and a device that pulls it deletes
  the piece and, with `withSteps`, its step records and takes, as `deletePiece` does. Two deletions of the
  same piece combine (`withSteps` if either has it). Every device keeps the deletions it has made
  or pulled (in `meta`, a few bytes each), so a copy of the piece, or with `withSteps` a step
  record or a take of it, that arrives later (from a device that practised it offline) is dropped, and so
  is one in an import file. (Importing the same MusicXML file again makes a new piece with a new
  id.)
- **Answers** (ear training and theory cards, [EAR.md](EAR.md)) sync as `answers`, like
  `attempts`: added when the id is not stored, never changed afterwards.
- **Takes** (what was played in a piece run, [EXPRESSION.md](EXPRESSION.md)) sync as `takes`, one
  record per chunk of at most 2,000 events, well under the 64 KB a body may have; like `answers`,
  a chunk is added when its id is not stored and never changed afterwards.
- **A build that learns a collection pulls everything again.** An older build skips records it does
  not know (a collection, a session kind, or records its validation refuses, such as an ear
  family it has not learnt) but still moves its cursor past them, so after an update it would
  never see them. `SYNC_SCHEMA` in `src/sync/records.ts` counts what a build understands (1: the
  collections above without `answers`; 2: `answers` and `ear` sessions; 3: echo, the answers and
  ear sessions of the family `echo`; 4: scale runs and sessions with the click, arpeggios and
  contrary motion; 5: `takes`, which older builds skip; 6: the theory cards on Read, answers of
  the families `readInterval`, `keySignature` and `readChord` and sessions of kind `theory`, which
  older builds skip; 7: rhythm on Read, answers of the family `rhythm` and sessions of kind
  `rhythm`, which older builds skip; 8: the chord symbols of the Harmony page, answers of the family
  `chordSymbol` and sessions of kind `harmony`, which older builds skip; 9: the technique
  exercises' runs and sessions, whose exercise keys older builds do not validate; 10: the same for
  S7's — the sevenths, repeated notes, trills, thirds and octaves; 11: cadences by ear, answers
  and ear sessions of the family `cadence`, which older builds skip; 13: sight-reading on Read,
  sessions of kind `sight`, which older builds skip; 14: rhythm dictation on Ear, answers of the
  family `rhythmEar` and `ear` sessions of that family, which older builds skip), and the sync
  state keeps the
  schema its cursor was reached with. When the build's is higher, the next round starts again from
  cursor 0. Pulling a record already stored changes nothing, except where the stored copy differs:
  an older build that did not know a field kept the record without it. A record that never changes
  (`attempts`, `pieceSteps`, `scaleRuns`, `answers`, `takes`) is then replaced by the pulled copy,
  and where two copies of a session or a piece tie by the rules above, the longer text wins before
  the text's order decides, so the copy with the field is kept and sent again, never the one
  without it.
- **Not synced:** `noteStats` (rebuilt from attempts), the free-play sessions and piece runs still
  in progress in `meta` (they become sessions when they end), the preferences (language and theme
  stay per device), the settings in `localStorage`, the token.

## The client (`src/sync/`)

- **Outbox.** Database version 5 adds an `outbox` store of `{ collection, id }` (with the body for
  a deletion, whose record is gone), written in the same transaction as the record, **only while
  signed in**. Signing in for the first time on a device pushes everything already stored, in
  batches, before the outbox takes over. Signing out clears the outbox and the cursor; the records
  stay.
- **Push, then pull, in one request.** A round sends up to 500 outbox entries (read fresh from
  their stores; a record deleted since is skipped; a body over 64 KB is skipped and logged) and
  removes the accepted ones from the outbox once the response arrives, then keeps pulling while
  `more` is true. A rejected entry stays: the newer record arrives in the pull, the rules below
  decide which copy is kept here, and the next request sends this device's record again, which is
  accepted now and changes nothing when the other copy won. The cursor is stored in `meta` after
  every applied page.
- **Applying a pull** validates every body with `validate.ts` (an invalid record is skipped and
  counted, as in an import), applies the rules above in one transaction per page, and rebuilds the
  note stats only when the page added attempts (the stats depend on the order of answers, so
  adding them one by one out of order would differ from a rebuild). The store then reloads and
  tells other tabs. A reload repairs nothing: finishing runs left open by a closed tab and
  rebuilding sessions for answers without one happen only at startup, never for a run still being
  played in this or another tab. A tab that is practising reloads when it stops.
- **When.** At start, when practising stops, when the page is hidden or shown again, after
  signing in, on "Sync now", and every 5 minutes while the page is open. A page closed during a
  round loses nothing: the outbox keeps what was not acknowledged, and the cursor only moves once
  a page is applied. One tab syncs at a time (Web Locks). **Never while a session, a run, a demo
  or the metronome is going** (`beginPractice` in `src/lib/shell.ts`, taken with the screen's
  hold but not let go when the player pauses), so sync never touches the timing of what is being
  measured; a round that finds practice started between two requests stops there. Failed rounds
  retry with backoff (at least `Retry-After`); being offline shows as offline, not as an error.
  A 401 signs the device out only if the token that got it is still the stored one.
- **UI.** Settings gains an Account section: sign in (address, then code), the signed-in address,
  the last sync, "Sync now", sign out, delete the account (with a confirmation that says local data
  stays). Nothing else in the app changes; the storage notice and the export stay as they are.

## Builds

- The official builds set `VITE_SYNC_ENDPOINT=https://api.playdacapo.com`: the web build with
  `pnpm build:site`, the Apple app in `apple/scripts/embed-web.sh`
  (`DACAPO_SYNC_ENDPOINT` overrides it; empty builds an app without accounts). Every other build
  (`pnpm dev`, `pnpm build`, the tests, a fork) has no account unless it sets the variable.
- To work on sync locally, run the service with `wrangler dev` (its email is printed, code
  included, instead of sent) and start dacapo with `VITE_SYNC_ENDPOINT=http://localhost:8787`.
- The Settings link to the privacy policy is the service's own `/privacy`.
- The web app is at `https://playdacapo.com`: a Worker (`wrangler.jsonc`, `web/worker.ts`) serves
  the build's files, and passes any other path (`/privacy`, profile pages) to the service through a
  service binding; the service itself answers at `api.playdacapo.com`. Cloudflare Workers Builds
  deploys it on every push to `main` (build command `pnpm build:site`, deploy command
  `npx wrangler deploy`). The old address, `ya-luotao.github.io/dacapo`, redirects every link
  there (`scripts/moved/`, `.github/workflows/pages.yml`); what a browser stored at the old
  address stays there, as storage belongs to the address.

## Service storage (`dacapo-cloud`)

- **D1**: `accounts` (id, unique email, created), `tokens` (hash as the key, account, device,
  created, last used) and `codes` (email as the key, the code's hash, expiry, wrong tries, and the
  send counts for the limits).
- **One Durable Object per account** (named by the account id), SQLite:
  `records (collection, id, body, seq, writer, primary key (collection, id))` with an index on
  `seq` (the next `seq` is one more than the largest). One object per user keeps writes serialized
  (two devices pushing at once cannot interleave) and puts each user under the per-object 10 GB
  limit rather than all users under D1's 10 GB: step records are one per note played, a few hundred
  bytes each, so a daily hour of practice is on the order of 100 MB a year.
- **R2** `u/<account id>/<sha256>`.
- Deleting an account: mark the account as being deleted (from then on its tokens only work to
  finish the deletion), delete the object's storage, delete the R2 prefix, then the tokens, the
  codes and the account in one batch. A retry with the same token after any failure finishes the
  job; once it is done the token is gone and a retry gets 401, which the client takes as done. The
  other devices get 401 and sign out. A sync or file upload already on its way when the mark is
  set removes what it wrote. A deletion whose device lost its token is finished by signing in to
  the address again (the right code proves ownership; a new, empty account is made), or by the
  daily clean-up an hour later, which also forgets codes that no longer count for a limit.

## Privacy and the Apple app

- Signed out, nothing changes: no network request, "Data Not Collected" holds for anyone who never
  signs in. With an account the service holds the email address and the practice records, linked
  to the account, for sync only; the App Store privacy label and the privacy manifest change
  accordingly, and a privacy policy is published at `https://playdacapo.com/privacy`.
- APPLE.md's "No network access is needed" becomes "when signed out"; the app already has the
  `network.client` entitlement.

## Milestones

1. ✓ **C1 Service** — `dacapo-cloud`: accounts and codes, tokens, sync, blobs, account deletion,
   the privacy page; tested locally (Workers test pool), then deployed to `api.playdacapo.com` with
   the sending domain verified.
2. ✓ **C2 Client** — database version 5 and the outbox, the sync engine and the pull rules, piece
   `updatedAt` and deletion records, the first push; against the protocol with a fake service in
   tests.
3. ✓ **C3 Account UI** — the Account section in Settings in every language (with app wording),
   sync status, sign out, delete account; which official builds set `VITE_SYNC_ENDPOINT`.
4. ✓ **C4 Apple** — privacy label and manifest, review notes, APPLE.md.
