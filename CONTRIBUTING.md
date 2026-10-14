# Contributing to dacapo

Thanks for your interest in dacapo. Bug reports, ideas and pull requests are welcome.
Please read [docs/MVP.md](docs/MVP.md) first — it describes the scope and the technical
decisions the project has already made.

## Setup

1. Install Node.js 22.13 or newer (see `.nvmrc`) and pnpm — the version pinned in
   `packageManager` in `package.json` (`npm install -g pnpm@10.34.5`, or `corepack enable`).
2. `pnpm install`
3. `pnpm dev` and open the printed URL in Chrome or Edge.

## Day-to-day development

Keep the feedback loop focused while editing:

```sh
# Keep TypeScript checking changes, without emitting JavaScript.
pnpm typecheck:watch

# In another terminal, watch the tests for the module you are changing.
pnpm test:watch src/core/wait.test.ts

# Run that test file once instead of watching it.
pnpm test src/core/wait.test.ts

# Reuse lint results for unchanged files during local iteration.
pnpm lint:fast
```

`pnpm typecheck` is an incremental, one-shot check. Its build information and the local lint
cache live under the ignored `node_modules/` directory. Use `pnpm typecheck --force` to recheck
every TypeScript project from scratch.

`lint:fast` caches by file content, not modification time. It is only a local shortcut: ESLint
does not track cross-file dependencies, so changing an imported type can leave a cached result
stale. Run `pnpm lint` for a full, uncached check after shared type changes and before a PR.
Focused tests and cached lint never replace `pnpm check`.

### Reproducible browser scenarios

Use a disposable scenario instead of completing onboarding or practising by hand before each UI
change. Start one command and open its printed URL in Chrome or Edge:

| Command             | Port | Starting state                                                                                     |
| ------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `pnpm dev:empty`    | 5174 | Empty practice data, at the onboarding questions.                                                  |
| `pnpm dev:progress` | 5175 | Progress with ten sessions over five recent days, 100 reading answers and a note heatmap.          |
| `pnpm dev:piece`    | 5176 | Ode to Joy, wait mode, right hand, bars 1–4; use the existing computer keyboard or on-screen keys. |

**Reload resets the scenario**, including practice, preferences and the starting route. These are
disposable origins: do not use them for real practice or import data you want to keep. Keep ports
5174–5176 reserved for these commands. Ports cannot be overridden or silently advanced when busy.
Each scenario has separate IndexedDB and localStorage from the others and ordinary `pnpm dev`.
An origin with an existing database or `dacapo.*` preferences is refused unless a previous scenario
initialization marked it disposable; use a fresh browser profile rather than clearing real data.
Unrelated localStorage keys are preserved.

The fixtures use English and the light theme. Progress dates are relative to startup, so the
recent-history widgets remain useful. Changes within the app work normally until a reload;
React Fast Refresh can preserve them while editing. Keep one tab per scenario: a second tab stops
without resetting the first. Close the first tab and reload the second to switch. Localhost or
HTTPS is required for the browser's cross-tab lock; a service-worker-controlled origin is refused.

The separate [scenario config](vite.scenarios.config.ts) forces sync off, even if
`VITE_SYNC_ENDPOINT` is set, and finishes seeding before importing the normal app entry. It cannot
build or preview a production bundle. Ordinary `pnpm dev` and production builds still use
the normal config and do not load the scenario entry or fixtures. No MIDI simulator is involved.

### Browser smoke checks

```sh
# Once after installing or upgrading Playwright (Chromium only).
pnpm exec playwright install --with-deps chromium

# Start the test servers, run the browser checks, and stop the servers afterwards.
pnpm test:smoke

# Focus on one flow while editing.
pnpm test:smoke --grep 'piece:'

# Open the last HTML report, including screenshots and traces for failed tests.
pnpm exec playwright show-report
```

Close servers on ports 5173–5176 first. The suite deliberately refuses to reuse an existing
server, so it cannot silently test another checkout or config. Playwright owns the four servers
for the test run and gives each test a fresh browser context; it does not use your normal browser
profile. Ordinary development is a persistence control alongside the three disposable scenarios.

The checks use the real UI, keyboard events and IndexedDB: onboarding, progress figures, wait-mode
input, reload/reset, existing-data refusal, cross-tab exclusion, and ordinary-profile isolation.
They run in one Chromium worker with no automatic retries; a flaky failure stays a failure.
There are no screenshot golden files, physical MIDI, native Apple, sync-service or deployment
checks in this suite. They exercise the Vite development app, not a deployed production bundle.

Failures keep screenshots and traces in `test-results/`; the HTML report is in
`playwright-report/`. Both directories are ignored. CI uploads them as `browser-smoke-results`
for seven days. The separate smoke job is required by the existing `check` gate.
`pnpm check` remains browser-install-free; run **both** `pnpm check` and `pnpm test:smoke` before a PR.

### Test tiers

```sh
# The shorter suite for broad feedback during local iteration.
pnpm test:fast

# Exhaustive score/generator checks, whole-site rendering and the 88-key regression.
pnpm test:regression

# Watch just the fast tier; without --config, test:watch watches every test.
pnpm test:watch --config vitest.fast.config.ts
```

`pnpm test` and `pnpm check` still run every Vitest test. The tiers partition files, not assertions:
the measured expensive suites are listed once in
[vitest.regression.config.ts](vitest.regression.config.ts), and `fast` runs every other test file.
New Vitest tests enter `fast` by default; move a file to `regression` when its measured cost warrants it.
The tier configs reuse the main Vite config without changing isolation, environments, cases or
snapshots. The full suite keeps its single-project scheduling. Run the regression tier when
changing the behavior it covers, not only before a PR.

## Before you open a pull request

Run:

```sh
pnpm check
pnpm test:smoke
```

`pnpm check` runs typecheck, full uncached lint, all Vitest tests and the production bundle;
`pnpm test:smoke` runs the browser checks. TypeScript is checked once in that sequence, including
the browser tests and their config. CI runs the same checks in parallel: static checks, both
Vitest tiers, browser smoke and bundling. Its final `check` gate requires all jobs to succeed;
a failure, cancellation or skipped job does not pass the gate. The test jobs do not cancel each
other on failure. They have separate job IDs so the gate checks each tier's result when rerunning
only one job.

`pnpm build` still checks types before bundling when run on its own; `pnpm build:bundle` only
bundles and is for workflows with a separate required typecheck. Please also run `pnpm format`
so diffs stay free of formatting noise.

## Dependencies

`pnpm-workspace.yaml` sets `minimumReleaseAge`, so pnpm only resolves package versions that have been
published for at least three days. A release younger than that will not install; wait, or use an
older version. Keep new dependencies to a minimum.

## Scope of a change

Keep pull requests focused on one change, and add or update tests for logic you touch.
Domain logic in `src/core/` must stay free of React and browser APIs so it can be unit-tested.

## Language

English for all code, comments, commit messages, pull requests and issues.

## Translations (i18n)

The UI is available in English, Simplified Chinese, Traditional Chinese (Taiwan), Japanese and
Korean. Strings live in `src/i18n/`:

- `en.ts` is the source of truth.
- `zh-CN.ts`, `zh-TW.ts`, `ja.ts` and `ko.ts` must contain exactly the same keys. A missing or
  extra key is a compile error.

**Every user-facing string goes into every dictionary** — never hard-code text in a component.
Write natural text in each language, not a word-for-word translation. If you cannot write one of
the languages, add the English text there, say so in the pull request, and a maintainer or a
native speaker will translate it before the release.

Use the `useT()` hook to read strings in components:

```tsx
const t = useT();
return <h1>{t('settings.title')}</h1>;
```

[docs/TRANSLATING.md](docs/TRANSLATING.md) has the rules, the glossary and tone of each language,
and how to add a language. Proofreading a language you speak natively is one of the most useful
contributions: open a translation issue or a pull request.

## Adding a built-in piece

The built-in pieces live in `src/pieces/library/`, one MusicXML file each. Only encodings we may
redistribute go there: our own encodings of public-domain editions (MIT, like the code) or
encodings dedicated to the public domain (CC0). Never a copyrighted arrangement, and never an
encoding under CC BY-SA or a non-commercial licence. The tools are in `scripts/pieces/`; its
[README](scripts/pieces/README.md) has every option.

1. **Choose one public-domain edition**: a Mutopia source edition, or an IMSLP scan marked public
   domain. Find an independent oracle if one exists, usually the MIDI file of a public-domain
   Mutopia edition.
2. **Encode it.**
   - Our own encoding: token lists in `scripts/pieces/sources/<id>.py`, then
     `python3 scripts/pieces/generate.py`.
   - A CC0 MuseScore file from [PDMX](https://zenodo.org/records/15571083): a manifest
     `scripts/pieces/pdmx/<id>.json`, then
     `node --experimental-strip-types scripts/pieces/prepare-pdmx.ts <id> <file.mxl>`.
     This removes all fingering and writes the provenance.
3. **Check it.** Run `node --experimental-strip-types scripts/pieces/verify.ts <file> <oracle.mid>`
   until every key press matches. Settle each difference against the edition, and note editorial
   decisions in the file's comment. Without an oracle, a second person proofreads the file
   against the scan.
4. **Record where it comes from.** `<identification>` in the file names the composer, the
   licence, the encoder and the source edition with a URL. Repeat these in
   `src/pieces/library/index.ts`, with a level; add its id to `ids.ts` beside it, and its title,
   composer and one-sentence note to every dictionary in `src/i18n/`.
5. **Lock it.** Add a checksum line and a structure test to `src/pieces/library/library.test.ts`.
   Add the oracle to `scripts/pieces/verify-library.sh`, and a line to
   [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) if the encoding is not ours.

Markings (dynamics, hairpins, slurs, articulations, pedal marks, ornaments) come from the same
edition as the notes, and only those it prints. Fingering stays out unless it has been checked
against a public-domain edition.

## The Apple apps

The iPhone, iPad and Mac apps in `apple/` wrap the web app. How to build and run them, sign
them and use their test harness: [apple/README.md](apple/README.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
