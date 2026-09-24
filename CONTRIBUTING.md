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

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
