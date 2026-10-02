# dacapo — Site specification (pages a search engine can read)

Status: W1 and W2 are built (the build step, the lessons' and the pieces' pages with the engraved
scores, the home pages, `lang` in the app, the sitemap, the reserved names in the app; the
decisions made while building them are under "Clarifications" at the end). The service's own
list of reserved names waits for its next deploy. This extends [MVP.md](MVP.md) and the later
specifications; their principles and fixed decisions still apply: everything is part of the
build, nothing comes from a CDN, no account, and the app itself is unchanged by this.

Goal: to a search engine dacapo is one page. The app's pages are routes after a `#`
(`playdacapo.com/#/learn/staff`), which are not addresses of their own, and what they show is
drawn by scripts; `sitemap.xml` lists the home page and nothing else, truthfully. Yet the site has
writing worth finding: sixteen lessons in three languages, and thirty-one public-domain pieces
with their notes, their fingering and where each comes from. Someone who searches for "how to read
the bass clef" or "Türk Handstücke easy piano" cannot land on any of it, and a crawler that runs
no scripts (Baidu, most of the others) sees a title and a description. This gives the lessons and
the pieces **pages of their own**, written into the build as plain HTML, each with the way into
the app; and a home page in each language for the same crawlers.

## The pages

Generated when the site is built, from the same sources the app shows (the lessons' own texts,
the library's entries and scores, the dictionaries), so they cannot drift from it.

| Address                              | Page                                                                | Languages                                    |
| ------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------- |
| `/learn/`                            | The lessons: the fifteen and Inside the piano, with their summaries | en; `/zh-cn/learn/`, `/zh-tw/learn/`         |
| `/learn/<slug>`                      | A lesson: its whole text, with its figures as they first appear     | en; `/zh-cn/learn/<slug>`, `/zh-tw/…`        |
| `/pieces/`                           | The library: every built-in piece by grade, the lead sheets after   | en; `/zh-cn/…`, `/zh-tw/…`, `/ja/…`, `/ko/…` |
| `/pieces/<id>`                       | A piece: what it is, its note and style, its source, and its score  | the same five                                |
| `/zh-cn/`, `/zh-tw/`, `/ja/`, `/ko/` | The home page in that language (what a first visit shows)           | each its own                                 |

- **English has no prefix**; the other languages are under their code in lower case. The home
  page in English stays `/`, the app itself.
- **Lessons exist where their text does**: English, Simplified and Traditional Chinese. Japanese
  and Korean readers get the English lesson (their `/ja/` and `/ko/` home pages link to
  `/learn/`), not a page that repeats the English under another address.
- **A lesson's page** is the lesson as the app shows it when it opens, rendered once: the prose,
  the plates with their figures drawn (a staff, a keyboard, a rhythm line are SVG and need no
  script), the captions, the pictures. What needs a script to mean anything is left out and said
  so: a figure's buttons, and each exercise, in whose place one line says "This exercise is
  played in the app." The page begins and ends with **Open this lesson in dacapo** (the app at
  that lesson, in that language), and links to the lesson before and after.
- **A piece's page** has the title and composer as the library names them in that language, the
  grade, its period and form, the library's note on it, the bars, key and time, whether it carries
  its edition's fingering, where it comes from (the source edition, the encoder, the licence, as
  the About page credits them) and **its score, engraved at build time** by the engraver the app
  uses, as an image shared by the piece's pages in every language (`/pieces/<id>.svg`), with a
  text alternative. **Practise it in dacapo** opens the piece in the app. A lead sheet's page says
  what a lead sheet is.
- **The home pages** are what the app's home shows a first visitor in that language (the tagline,
  the lede, the contents, the principles, the questions), with **Start** going to the app in that
  language.
- Every page is one HTML document with the site's own stylesheet and fonts (the app's, as built:
  one look), the brand as the way home, the languages the page exists in as links, and the
  footer. No script but one small inline one that follows the visitor's stored theme. It works
  with scripts off.

## For a search engine

- Each page has its own `<title>` and description (the lesson's or piece's own summary), a
  canonical address, `hreflang` alternates for the languages it exists in with `x-default` on the
  English one, Open Graph and Twitter tags, `<html lang>`, and structured data (`LearningResource`
  for a lesson, `MusicComposition` for a piece, `WebSite` for a home page; `BreadcrumbList` on
  each).
- `/` (the app) gains the `hreflang` alternates of the home pages and plain links to `/learn/` and
  `/pieces/` in its footer.
- **`sitemap.xml` is written by the build**: `/`, every page above, each with its alternates. No
  dates: the build is the same whenever it is made.
- `robots.txt` is unchanged. Profile pages stay `noindex`.

## The way into the app

- A link into the app is `/?lang=<code>#/learn/<slug>` (or `#/pieces/<id>`, `#/start`). The app
  takes `lang` as the visitor's language when they have not chosen one (it becomes their choice,
  as picking it in Settings would); with a choice stored it changes nothing. The parameter is then
  dropped from the address.
- The app links back: a lesson and a piece in the app have nothing new (the app is where one
  practises), but About names the pages.

## What it must not disturb

- **The app**: its routes stay after the `#`; nothing in it loads these pages or depends on them.
- **The offline worker** (OFFLINE.md): a navigation to any of these addresses is not the app's
  page, so the worker leaves it to the network, and none of these files is in its list (its
  version changes only when the app's files do). They are not stored for offline.
- **Usernames** (PROFILE.md): profile pages live at the top of the site (`/<name>`), and a file of
  the build is served before the service is asked. So `learn`, `pieces`, `zh-cn`, `zh-tw` (and
  `en`, `start`, `sitemap`, kept for later) join the names nobody can take: in the app's own check
  now, and in the service's list with its next deploy (`dacapo-cloud`, by the maintainer).
- **The Apple app**: the build it carries leaves these pages out.
- **Forks and sub-paths**: the addresses are made from the site's address and base path
  (`https://playdacapo.com/` for the official build); a build without one writes relative links
  and no sitemap.

## Code

- `src/site/`: the pages as React components rendered to static HTML at build time (an entry of
  its own, built for Node after the app is, by a plugin in `vite.config.ts` beside the offline
  worker's), the list of pages as data (address, language, alternates, title, description) with
  tests, and the sitemap written from it. The lessons' components are rendered as they are, with
  stand-ins for what a page without scripts has no use for (the input, the practice store, the
  sound); a lesson's component that cannot render without a browser is made to.
- The engraver runs at build time for the scores; the files it writes are deterministic.
- No new dependency in the app; none at all unless the build cannot do without, and then named
  here.

## Milestones

1. ✓ **W1 Lessons and home pages** — the build step, `/learn/…` in three languages, the home
   pages, `lang` in the app, the sitemap, the reserved names.
2. ✓ **W2 Pieces** — `/pieces/…` in five languages with the engraved scores.

## Clarifications (decided during W1/W2)

- **The build** of 2026-10-02 writes 247 files, 9.5 MB (about 2.3 MB over the wire): 215 pages
  (4 home pages; 3 lists of lessons and 48 lessons, 3.1 MB; 5 lists of pieces and 155 pieces,
  3.5 MB), 31 scores (2.6 MB) and the sitemap (0.15 MB). The largest page is lesson 8 (121 kB,
  17 kB over the wire); a piece's page is about 22 kB. `vite build` takes 2.5 s where it took
  0.7 s; `pnpm build` as a whole is as long as before within what can be measured (12 s, mostly
  the type check).
- **The build step** (`sitePages` in `vite.config.ts`) runs in `writeBundle`, once the app's
  files are on disk and before the offline worker's list is taken in `closeBundle`. It builds
  `src/site/main.ts` for Node (Vite's SSR build, into `node_modules/.dacapo/site/`, beside the
  dependencies it leaves to Node), runs `renderSite`, and writes what it returns. `src/site/` has
  no Node in it and is checked with the app: the build hands in the app's built page, the site's
  address, and a reader of XML (jsdom's `DOMParser`, as the tests use; the scores are MusicXML
  and the app's parser wants a document). No dependency is added: `react-dom/server`, `verovio`
  and `jsdom` were there. A page that cannot be drawn throws, and the build fails; so does a
  file of the site that would take the place of one of the app's (the bundle's or `public/`'s).
  `public/sitemap.xml` is gone: the build writes it.
- **The site's address is `SITE_URL`** (`https://playdacapo.com` in `pnpm build:site`; only its
  scheme and host are read, the path is `BASE_PATH`). Nothing said where the site is before:
  the canonical in `index.html` is written out. A build without it (`pnpm build`, a fork, the
  Apple app's) writes the same pages with links from the host's root (`/dacapo/learn/staff`)
  and leaves out what must be a whole address: the canonical, the alternates, `og:url` and
  `og:image`, the structured data, and the sitemap. The alternates of `/` in `index.html` are
  written out like its canonical, and a test holds them to the list.
- **The list of pages** is `sitePages()` in `src/site/pages.ts`, made from `LESSONS`, `EXTRAS`,
  `LESSON_LANGUAGES`, `BUILT_IN` and `LOCALES`: a lesson, a piece or a language added to the app
  has its pages with no list to edit. `src/site/addresses.ts` has the addresses alone, which the
  app's footer and About use too. A lesson not `ready` has no page.
- **Addresses.** `learn/staff.html` is `/learn/staff`, `learn/index.html` is `/learn/`: checked
  with `wrangler dev`, Cloudflare answers those with 200 and redirects every other spelling to
  them with a 307 (`/learn` to `/learn/`, `/learn/staff.html` and `/learn/staff/` to
  `/learn/staff`, `/zh-cn` to `/zh-cn/`). The lessons' pictures (`learn/*.webp`) and the scores
  (`pieces/<id>.svg`) sit beside the pages and are served as they were. `vite preview` serves
  the pages too, but answers `/learn` with the app.
- **A link into the app from an English page has no `lang`.** The specification gives every
  link `?lang=<code>`. But the English lessons are also where Japanese and Korean readers are
  sent, and `?lang=en` would turn their app to English and keep it so. So a page that is not
  English carries its language (`/?lang=zh-TW#/learn/staff`), and an English one opens the app
  as `/` does, in the visitor's own language (`/#/learn/staff`). The one link that says
  `?lang=en` is "English" among a home page's languages: there the visitor asks for it by name.
- **`lang` in the app** (`src/i18n/langParam.ts`, read in `main.tsx` before anything else). The
  code is taken in any case (`zh-tw`); the pages write it as the app does (`zh-TW`). When no
  language was chosen it is stored as the choice, and holds for the visit even where the browser
  keeps nothing. With a choice stored, with a code the app does not have, or with none, nothing
  changes. Whenever the parameter is there it leaves the address (`history.replaceState`): the
  rest of the query, the route after `#` and the settings a route carries after its own `?`
  stay.
- **A lesson's page** is drawn by the lesson's own component, inside `LessonProvider` with
  `staticPage` (`ui/learn/lesson.ts`), which the lesson's parts read: `Choices` and `PlayButton`
  leave themselves out, an `ExerciseFrame` (and the beat to tap with, which is an exercise in
  all but its frame) becomes "This exercise is played in the app.", the keyboard is drawn with
  its keys as plain boxes and its name (`Piano`'s `still`), and a control a figure draws itself
  is left out by the figure. Where a control was also the figure's words they stay as words: the
  rungs of the tempo ladder, the sections of a piece's form, and the parts of the action, which
  the app names one at a time when pointed at and the page lists whole. Under the first button
  one line says what the app adds ("In the app the figures sound and answer to your keyboard,
  and the exercises check what you play."). A figure that only shows what is played says what
  it says in the app before a key is pressed ("Play any key"). The captions are the lesson's own
  and may name a button that is not there. Practise it is not on the page: its links depend on
  the reader's records.
- **What the app's components needed to be drawn without a browser.** `useSyncExternalStore`
  was given its third argument in `ui/input/context.ts`, `ui/practice/context.ts` and
  `ui/focus/focus.ts` (the same snapshot: nothing changes in the app). The figures that read a
  library piece's score in an effect (`ui/learn/libraryScores.ts`, moved out of
  `styleFigures.tsx`) start from a score already in hand when there is one, and the build hands
  them every piece's. Nothing else touched the window at render or when its module loads. The
  input is the app's own, never started; the practice store is one never started either, said
  to be read and empty (a newcomer's: the Learn page marks lesson 1 as next); the router writes
  a link and follows none. A timeline drawn a unit to a pixel is drawn at the width the app
  falls back to (640 or 560), and scrolls sideways on a phone; so does the whole keyboard,
  which starts at its lowest key where the app scrolls it to middle C.
- **The Learn page and the home pages are the app's own components** (`LearnPage`, `HomePage`),
  with the same stand-ins: a first visit's home, the specimen at its first note. A link inside
  any page leads to the page that stands for the route when there is one in that language
  (`/learn`, `/learn/<slug>`, `/pieces`, `/pieces/<id>`), else into the app: so the home page's
  first row leads to the lessons' pages (the English ones from `/ja/` and `/ko/`), its sixth to
  the pieces', the others into the app. The list of pieces is drawn by the site, in the
  library's classes and words: `Library.tsx` shows each piece's progress and is still changing.
- **A piece's page** has the title, the composer, the note and the style as the library has
  them; its level in the eyebrow; the work, the source (a link to the edition), the encoder and
  the licence in English, as `BUILT_IN` has them, marked `lang="en"`; the written bars, the key
  (`pieceKey`, named as the Key control names it) and the time signatures, read from the file;
  and "Fingering: as the source edition prints it" where a note of the file has a finger. A lead
  sheet's page has one more paragraph saying what a lead sheet is.
- **The scores** are engraved by Verovio 6.3.0 under Node (`src/site/score.ts`), with the app's
  `layoutOptions` for a page 720 px wide (scale 38, as the app has between 480 and 800), whole,
  as one image: `xmlIdSeed` makes Verovio's ids the same in every build, the ids the app uses
  for its cursor (`data-id`, `data-class`) and the indentation are taken out, and a `<title>`
  names the piece. Black on nothing. 24 kB to 361 kB (the Prelude in C; 96 kB over the wire),
  60 kB at the median, 2.6 MB in all. A score that took more than the one page Verovio allows
  would fail the build. On the page the image sits on a sheet of the surface colour and, in the
  dark theme, is inverted to the paper's colour (`filter: invert(0.9)`), as the app draws its
  score; on a phone the sheet scrolls sideways at 544 px rather than shrink the notes, and a
  link opens the image alone.
- **The head.** Title, description, canonical, the alternates (each language the page exists
  in, and `x-default` on the English), `og:type` (`article` for a lesson and a piece),
  `og:title`, `og:description`, `og:url`, `og:locale` and its alternates, the site's social
  card as `og:image`, `twitter:card`, `robots`. The stylesheet, the icons and the theme colours
  are the app's own tags, taken from its built page. The structured data is one `@graph`: the
  thing (`LearningResource` with its language, its minutes and `isAccessibleForFree`;
  `MusicComposition` with its composer, unless the tune is traditional, its key and its score
  as `image`; `WebSite` for a home page; `CollectionPage` for the two lists, which the
  specification does not name) and a `BreadcrumbList`. The titles are "{title} — a piano
  lesson · dacapo" and "{title}, {composer} — score · dacapo", in each language's own words.
- **The page around the content**: the app's header bar with the brand (to the home page in
  that language) and two links, Lessons and Pieces; a trail (dacapo › Lessons › the lesson); the
  page's other languages by their own names, over the footer; and the app's own `Footer`. What
  only the pages need of CSS (`src/site/site.css`, about 5 kB) is written into each page's
  head, so the app's stylesheet does not grow. The one script sets `data-theme` from
  `dacapo.theme` before the stylesheet is read.
- **Strings.** What only the pages say is the `site.*` block of the five dictionaries (the
  exercise's line, the two buttons and the line under each, the titles, the piece's labels,
  About's sentence); everything else is the app's own strings. In the other languages the
  exercise's line names dacapo, as the dictionaries do, where the English says "the app". Notes
  are named by letter: the page's `t` is pinned to the letters (`src/site/words.ts`), and the
  guard of `ui/noteNames.test.ts` now reads `src/site/` too.
- **The app's side.** The footer has Lessons and Pieces before About, in the reader's language
  (`/zh-cn/learn/`; the English lessons for Japanese and Korean); About has a sentence and the
  two links, in the web app only; the page's `<noscript>` names the two lists. In `pnpm dev`
  there are no pages and the links lead to the app.
- **The offline worker.** `groupOf` already left every page but the app's out, and whatever it
  does not name: no rule was added, tests hold every file of the site to it, and `sw.js` of a
  build with the pages is byte for byte that of the same build without them. In Chrome, with
  the worker in charge, a navigation to `/learn/staff`, `/learn/`, `/zh-cn/`, a piece's page,
  its score or the sitemap is not answered by it, its store holds none of them, and the app
  still opens without a network.
- **Usernames.** `learn`, `pieces`, `zh-cn`, `zh-tw`, `en`, `start` and `sitemap` are in the
  app's `RESERVED_USERNAMES`. `ja`, `ko` (and `en`) are too short to be usernames. A test takes
  the first part of every address of the site and fails when one that could be a username is
  not reserved. **Pending the maintainer**: the same seven names in `RESERVED` of
  `dacapo-cloud/src/username.ts`, with its next deploy. Until then the service would give
  `learn` to whoever asks past the app; the profile could never be seen (the build's file is
  served first), and nothing else follows from it.
- **The Apple app.** `apple/scripts/embed-web.sh` leaves out `learn/*.html`, `pieces/`,
  `zh-cn/`, `zh-tw/`, `ja/`, `ko/` and `sitemap.xml`, and keeps the lessons' pictures; a test
  reads the script's `rsync` line against every file of the site. Its build has no `SITE_URL`.
- **Verified** with `vite preview` and with `wrangler dev` (the build's files as Cloudflare
  serves them): every page of the sitemap answers 200 as `text/html` with one `h1`, a title, a
  description, a canonical that is its own address and alternates that answer, and no internal
  link or image is broken (215 pages, 261 addresses). With scripts off in Chrome the pages are
  whole at 1280 and 375 px in both themes. `html-validate` (standard and document rules) finds
  nothing but the stylesheet's missing `integrity`, which is the app's own tag, and two notes
  on the app's own markup (a lesson's `aside`s have no names; an `ol` has an `aria-label`). Not
  run in Safari or Firefox.
