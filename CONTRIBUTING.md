# Contributing to dacapo

Thanks for your interest in dacapo. Bug reports, ideas and pull requests are welcome.
Please read [docs/MVP.md](docs/MVP.md) first — it describes the scope and the technical
decisions the project has already made.

## Setup

1. Install Node.js 22.13 or newer (see `.nvmrc`) and pnpm — the version pinned in
   `packageManager` in `package.json` (`npm install -g pnpm@10.34.5`, or `corepack enable`).
2. `pnpm install`
3. `pnpm dev` and open the printed URL in Chrome or Edge.

## Before you open a pull request

Run:

```sh
pnpm check
```

It runs typecheck, lint, tests and the production build — the same steps as CI. Please
also run `pnpm format` so diffs stay free of formatting noise.

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

The UI is available in English and Simplified Chinese. Strings live in `src/i18n/`:

- `en.ts` is the source of truth.
- `zh-CN.ts` must contain exactly the same keys. A missing or extra key is a compile error.

**Every user-facing string goes into both dictionaries** — never hard-code text in a
component. When adding a key, write natural Chinese, not a word-for-word translation; if you
are not comfortable writing Chinese, say so in the pull request and a maintainer will help.

Use the `useT()` hook to read strings in components:

```tsx
const t = useT();
return <h1>{t('settings.title')}</h1>;
```

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
   `src/pieces/library/index.ts`, with a level, and add its title, composer and one-sentence note
   to both dictionaries in `src/i18n/`.
5. **Lock it.** Add a checksum line and a structure test to `src/pieces/library/library.test.ts`.
   Add the oracle to `scripts/pieces/verify-library.sh`, and a line to
   [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) if the encoding is not ours.

Fingering stays out unless it has been checked against a public-domain edition.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
