# dacapo

_Da capo_ — "from the beginning."

An open-source web app for learning the piano with a MIDI keyboard: sight-reading drills
on a real grand staff, reaction-time tracking, a per-note weakness heatmap, and a practice log.
All data stays in your browser.

**Status:** early development. See [docs/MVP.md](docs/MVP.md) for the MVP specification.

## Why

The first real wall for a self-taught pianist is reading: seeing a note on the grand staff
and finding the key without counting lines. dacapo drills exactly that on real notation
(no falling notes), measures every answer — right or wrong, and how fast — and keeps
practising the notes you are slowest at. Progress is visible day by day, and the app works
in English and Simplified Chinese.

## Requirements

- **Browser:** Chrome or Edge on desktop. They support
  [Web MIDI](https://developer.mozilla.org/docs/Web/API/Web_MIDI_API), which dacapo uses to
  read your keyboard. Other browsers can still use the fallback input.
- **MIDI keyboard:** recommended, but optional. You can also play with your computer
  keyboard or by clicking the on-screen piano.
- No account, no server. Everything is stored locally in your browser; Settings can export it
  as a JSON file for a backup or to move to another computer.

## Development

You need [Node.js](https://nodejs.org/) 22.13 or newer (the CI uses the version in `.nvmrc`)
and [pnpm](https://pnpm.io/). The pnpm version is pinned in `packageManager` in `package.json`;
install that version with `npm install -g pnpm@10.34.5`, or let
[Corepack](https://nodejs.org/api/corepack.html) pick it up if you have it enabled.

```sh
pnpm install
pnpm dev
```

Then open the URL Vite prints (usually http://localhost:5173).

### Scripts

| Script              | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Start the dev server with hot reload                   |
| `pnpm build`        | Type-check and build for production into `dist/`       |
| `pnpm preview`      | Serve the production build locally                     |
| `pnpm typecheck`    | Run the TypeScript compiler without emitting           |
| `pnpm lint`         | Run ESLint                                             |
| `pnpm format`       | Format all files with Prettier                         |
| `pnpm format:check` | Check formatting without writing                       |
| `pnpm test`         | Run the unit tests once with Vitest                    |
| `pnpm check`        | Typecheck, lint, test and build — run this before a PR |

The app uses hash-based routes (`/#/read`), so the `dist/` folder can be served by any
static file host without rewrite rules.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

Notation is drawn with [VexFlow](https://github.com/vexflow/vexflow) (MIT) and the
[Bravura](https://github.com/steinbergmedia/bravura) music font (SIL Open Font License 1.1).
Both are bundled into the build, so the app never loads them from a CDN.
