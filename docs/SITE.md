# dacapo — Site specification (pages a search engine can read)

Status: planned. This extends [MVP.md](MVP.md) and the later specifications; their principles and
fixed decisions still apply: everything is part of the build, nothing comes from a CDN, no
account, and the app itself is unchanged by this.

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

1. **W1 Lessons and home pages** — the build step, `/learn/…` in three languages, the home pages,
   `lang` in the app, the sitemap, the reserved names.
2. **W2 Pieces** — `/pieces/…` in five languages with the engraved scores.
