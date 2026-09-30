# dacapo — Username and public profile specification

Status: P1–P5 are built; the service changes are not deployed yet. This extends
[SYNC.md](SYNC.md); its principles still apply, and one more: **a profile is opt-in and off by
default.** Signed out, or signed in without turning the profile on, nothing is public and nothing
changes.

Goal: a signed-in user can pick a username and publish a page, like a GitHub profile, with their
year of practice as a grid of weeks. They choose whether the page also shows what they practised:
private activity keeps the grid and hides everything else.

## Principles

- **The service still never reads records.** The public page is not built from the synced
  records: the client computes a small profile document from what it has locally and publishes it.
  The profile document is the one thing the service does read, because it renders it; its schema
  is versioned and checked on both sides.
- **Only what is chosen is published.** The document holds exactly what the chosen visibility
  shows, never more, so hiding something is not a matter of the page leaving it out. Changing the
  visibility removes the published document at once.
- **No free text but piece titles, and those behind their own switch.** A username and the numbers
  the app computes. No bio, no avatar, no display name.
- **No social features in the app.** No following, no feed, no search of users, no indexing by
  search engines. A profile is found by its link.

## Username

- 3–30 characters of `a-z`, `0-9` and `-`, starting and ending with a letter or digit, no `--`.
  Typed in any case, stored lower-case; unique over all accounts.
- Not available (the same answer as a taken name): the paths the service uses or may use (`api`,
  `v1`, `u`, `privacy`, `terms`, `about`, `help`, `support`, `settings`, `admin`, `app`, `www`,
  `mail`, `static`, `assets`, `blog`, `docs`, `report`, `robots`, `favicon`), the web app's folders
  (`icons`, `licenses`, `piano`), `dacapo`, `playdacapo`, and names containing a word on the service's blocklist of offensive words.
- Optional: an account without a username syncs as before. A username can exist with the profile
  off; it is reserved and nobody sees it.
- It can be changed at any time. The old name is free again at once and its URL is 404, as on
  GitHub; the profile moves to the new URL.
- Removing the username turns the profile off. Deleting the account frees it.

## Visibility

Two settings, kept on the service (so every device of the account knows them):

| `visibility` | The public page shows                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| `off`        | nothing: the URL is 404, and the service holds no profile document (default)    |
| `private`    | the username, the year grid, the current and longest streak, the total practice |
| `public`     | as `private`, plus the activity                                                 |

`titles` (default false), for `public` only: the activity names the pieces. Without it a piece is
"a piece". A piece's title comes from the imported MusicXML or a rename and can be anything.

**Activity**, per day with practice: the time per kind (reading, free play, pieces, scales), and
the pieces and scales practised that day with their time. The page lists the last 30 days under
the grid; choosing an earlier day in the grid shows that day's.

Never published: accuracy, reaction times, wrong notes, tempo, the weakness heatmap, note stats,
piece files, the composer, the file name, the email address, the account id, the time zone.

## The profile document

Built by `src/core/profile.ts` (pure, next to `streak.ts`) from the sessions and pieces in the
store, and sent whole; it replaces the previous one.

```jsonc
{
  "v": 1,
  "visibility": "public", // "private" or "public": the service's setting when built
  "titles": false, // the service's setting; always false with "private"
  "today": "2026-09-29", // the owner's local date when built
  "firstDay": 1, // the owner's week start in the app (1 Monday … 7 Sunday)
  "days": { "2026-09-28": 1260000, "2026-09-29": 300000 },
  "streak": { "current": 4, "longest": 21 },
  "totals": { "days": 143, "ms": 91800000 },
  "activity": {
    // "public" only; absent with "private"
    "2026-09-29": {
      "kinds": { "read": 120000, "scale": 180000 },
      "scales": [{ "type": "major", "tonic": "D", "ms": 180000 }],
    },
    "2026-09-28": {
      "kinds": { "piece": 1260000 },
      "pieces": [{ "title": "Clair de lune", "ms": 1260000 }], // "title" only with "titles"
    },
  },
}
```

- `days`: active ms per local date, as the Progress page counts it (`dailyTotals`), for the dates
  of the grid's 53 weeks (`GRID_WEEKS`) up to `today`, days with practice only. The page shades
  them with `practiceLevel`, so the owner's grid and the public one agree.
- `streak` and `totals` (days with practice, and active ms, over all time) are as of `today`.
- `activity` has the same dates as `days`. `kinds` has the kinds practised that day (`read`,
  `free`, `piece`, `scale`). `pieces` and `scales` are the five longest of the day, longest first,
  with `morePieces` / `moreScales` counting the rest when there are more. A piece's time is the
  time of its runs. Its title is the piece's current one, at most 80 characters (longer ones are
  cut, with `…`); a piece deleted since, or whose title was made from its file name (a score
  without a title), is "a piece", as the file name is never published. A scale's time is that of
  its runs, first key to last, whatever the octaves and hands. Only the five scale types the service knows are named (major,
  the three minors, chromatic); arpeggios and anything later are counted in `moreScales` until the
  service learns them.
- All numbers are non-negative integers (times are rounded: scale runs are timed to fractions of
  a millisecond). At most 256 KB serialized; a year of daily practice is
  well under, and a document over it leaves out the oldest days' activity until it fits.
- The page is as fresh as the owner's last publish and says when that was, to the day only
  ("Updated in the last day", "Updated 3 days ago"): next to the owner's date, the minute of a
  publish would tell the owner's time zone. The owner's `today` is not moved forward for the
  viewer: without the owner's time zone the page cannot know it, so the grid ends at the last
  publish.

## Protocol

Added to SYNC.md's table; the same errors, plus 400 `invalid-username`, 409
`username-unavailable`, 409 `no-username` and 409 `profile-changed`.

| Request                                            | Response                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /v1/account`                                  | 200 `{ id, email, createdAt, username, profile }`                      |
| `PUT /v1/account/username` `{ username }`          | 200 `{ username }`; 400 `invalid-username`; 409 `username-unavailable` |
| `DELETE /v1/account/username`                      | 204; the profile is off                                                |
| `PUT /v1/account/profile` `{ visibility, titles }` | 200 `{ visibility, titles }`; 409 `no-username` unless `off`           |
| `PUT /v1/profile` `{ document }`                   | 204; 409 `profile-changed`; 400 `invalid-request`; 413 `too-large`     |
| `GET https://playdacapo.com/<username>`            | the public page (HTML), or 404                                         |

- `username` is null without one; `profile` is `{ visibility, titles }`, `{ "off", false }` by
  default.
- `PUT /v1/account/profile` removes the published document whenever the settings change (and
  `off` keeps none); the client publishes a new one right after. Until it does, the page is 404:
  never a document with more than the new settings allow.
- `PUT /v1/profile` is accepted only when the document's `visibility` and `titles` are the
  service's current settings and the visibility is not `off`, else 409 `profile-changed`: a device
  that has not heard of a change made on another cannot publish under the old settings. The
  service checks the document against the schema above (unknown keys, bad dates, scale types or
  tonics, too many entries, a title with `titles` false, `activity` with `private`: 400) and keeps
  it with the time of the request.
- Renaming, `DELETE /v1/account/username` and `PUT /v1/account/profile` are limited per account
  (10 a minute), and so is `PUT /v1/profile` (20 a minute: D1 serializes every write, sign-ins'
  included). The page is limited per IP and sent with `Cache-Control: no-cache`, so turning the
  profile off or narrowing it shows at once. A name that is unknown, has the profile off or has no
  document yet is the same 404. A name in upper case redirects (301) to its lower-case URL.

### When the client publishes

- After every sync round that completes (outside the round and its lock, so it holds up neither
  other tabs nor new changes), and right after changing the settings; only while signed in, with a
  username and a visibility other than `off` (as last heard from the service). It therefore
  inherits sync's rule: never while practising.
- Only when the document differs from the last one this device sent (its hash in `meta`, saved
  only while the settings it was built for are still the stored ones, as another tab may have
  changed them), so a day without practice still publishes once, when `today` moves. Right after
  a change of settings it publishes whatever the hash. A failed publish is retried after the next
  round, and Settings says it failed until one works.
- The settings are read with `GET /v1/account` once after the app starts (before its first
  publish), when the Settings page opens, and on 409 `profile-changed`, after which it builds and
  sends again once (or stops, when the profile is now off). So a device learns that the profile was
  turned on or off on another one the next time it starts.
- Several devices: each builds from its own store, which after a pull holds the same records, so
  the last device to publish shows the full picture. A device that has not pulled yet can publish
  a slightly older grid until the next round; the service does not merge documents. Each device
  builds in its own time zone and with the week start of its own language, so devices set
  differently publish the grid shifted by a day or starting on another weekday.

## The public page

- Rendered by the service at `playdacapo.com/<username>`. The web app's Worker serves
  `playdacapo.com`: its files first, and any other path (`/privacy`, a profile) through a service
  binding to the service (see SYNC.md, "Builds"). One static HTML page with its CSS inline, no script, readable without JavaScript,
  the same shades as the app's grid, light and dark. Its language is the best match of
  `Accept-Language` among the app's five (English otherwise).
- The username, "Updated …", the streaks and totals, the grid with its legend (each day's cell has
  its minutes as a title and, with `public`, links to its day), and with `public` the activity.
  Scale names in the page's language ("D major", "D 大调"); letter names as the app writes them.
- `<meta name="robots" content="noindex">` and `X-Robots-Tag: noindex`.
- A link to the app, and "Report this profile": a `mailto:report@playdacapo.com` with the username
  in the subject.

## Moderation

- The blocklist is in the service (`src/username.ts`): a short list of offensive words in
  English and romanized Chinese, Japanese and Korean, matched against the name's hyphen-separated
  parts, and a shorter list of unambiguous ones matched anywhere in the name without hyphens.
- A reported profile is handled by hand: the service README has the D1 statement that removes a
  username, turns its profile off and deletes its document. Adding the name to the blocklist
  keeps it from being taken again.

## Client (`src/`)

- `core/profile.ts`: the document builder and the username check (the same rules as the service,
  but for the blocklist, so the field says what is wrong before asking). Tests.
- `sync/`: the calls in `api.ts`; publishing after a round in `client.ts`; the settings, the
  username and the last sent hash in `meta`, cleared on signing out.
- Settings, Account section, while signed in: a Profile block with the username (set, change,
  remove), the visibility (Off / Grid only / Grid and activity), "Show piece titles", the link to
  the page with a copy button, and one line saying what the chosen visibility makes public. Every
  language.

## Service (`dacapo-cloud`)

- D1 migration: `accounts.username TEXT` with a unique index, `accounts.profile_visibility TEXT
NOT NULL DEFAULT 'off'`, `accounts.profile_titles INTEGER NOT NULL DEFAULT 0`; a `profiles`
  table `(account_id primary key, document, updated_at)`. Profiles are few and small; D1 serves
  the page without waking the account's Durable Object.
- Deleting the account deletes its profile with the account (the same batch), which frees the
  username.
- The privacy policy gains a section: what a profile publishes, that it is off by default, that
  anyone with the link can see it, and that turning it off removes it from the service.

## Privacy and Apple

- With a profile on, the practice summary is visible to anyone with the link. The App Store privacy
  label keeps its categories (User Content, linked to the user, App Functionality); the privacy
  policy and APPLE.md's review notes say what is published and that it is opt-in.
- **Guideline 1.2 (user-generated content).** A username, and with `titles` piece titles, shown to
  others is user content. The first version answers it with the blocklist, the report link on every
  page, and removal by hand; there is nothing to block inside the app, which shows no other user.

## Milestones

1. **P1 Service** — the migration, the username, settings and profile endpoints with the document
   check, the limits, the account deletion, the privacy page; tested locally. Deploying (the
   migration first) and the `report@` forwarding rule wait for the maintainer's go-ahead.
2. **P2 Client** — `core/profile.ts`, the API calls, publishing after sync and on 409; tests
   against the fake service.
3. **P3 Settings** — the Profile block in every language.
4. **P4 Public page** — the Worker's page in five languages, report link, noindex.
5. **P5 Apple** — APPLE.md, the review notes, the privacy label rechecked; SYNC.md's table.
