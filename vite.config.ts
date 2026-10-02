import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import { dictionaryPreloadScript } from './src/i18n/dictionaryPreload.ts';
import { groupOf, PAGE, type OfflineFile, type OfflineList } from './src/offline/files.ts';
import { listProblems } from './src/offline/list.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Every file below `dir`, as paths from it with `/`. */
function filesBelow(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesBelow(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

/**
 * The offline worker (docs/OFFLINE.md): once the build is written, lists its files, each with its
 * group and size, and builds src/offline/sw.ts to `sw.js` at the root of the build, without a
 * content hash, with the list and the list's hash in it. Only in a build: `pnpm dev` and the
 * tests have no worker.
 *
 * A build of the site that ends without a sound `sw.js` fails here: from the first release with
 * the worker, every deploy must carry one (docs/OFFLINE.md, "Releases"), or the browsers that
 * have a worker keep it, and what it stored, for good.
 */
function offlineWorker(): Plugin {
  let config: ResolvedConfig;
  /** What each file under assets/ was made from, as `groupOf` wants it. */
  let made: Map<string, string[]> | null = null;
  return {
    name: 'dacapo:offline-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      made = null;
    },
    generateBundle(_options, bundle) {
      made = new Map();
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset') made.set(file.fileName, file.originalFileNames);
        else if (file.isDynamicEntry && file.facadeModuleId) {
          made.set(file.fileName, [file.facadeModuleId]);
        }
      }
    },
    async closeBundle() {
      // Not after a failed build, and not for a build that is not the site (SSR).
      if (!made || config.build.ssr) return;
      const outDir = resolve(config.root, config.build.outDir);
      const files: OfflineFile[] = [];
      for (const path of filesBelow(outDir).sort()) {
        const group = groupOf(path, made.get(path));
        if (!group) continue;
        const bytes = statSync(join(outDir, path)).size;
        files.push([path === 'index.html' ? PAGE : path, group, bytes]);
      }
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
      const list: OfflineList = { version, files };
      made = null;
      const page = readFileSync(join(outDir, 'index.html'), 'utf8');
      const problems = listProblems(list, page, config.base);
      if (problems.length > 0) {
        throw new Error(`The offline worker's list is not sound: ${problems.join('; ')}.`);
      }
      const worker = join(outDir, 'sw.js');
      // Never the worker of a build before, left in a directory that was not emptied.
      rmSync(worker, { force: true });
      await build({
        configFile: false,
        root: config.root,
        mode: config.mode,
        logLevel: 'warn',
        publicDir: false,
        define: { __OFFLINE_LIST__: JSON.stringify(list) },
        build: {
          outDir,
          emptyOutDir: false,
          // One plain script, as a worker is registered: nothing imported, nothing exported.
          rolldownOptions: {
            input: resolve(config.root, 'src/offline/sw.ts'),
            output: { format: 'iife', entryFileNames: 'sw.js' },
          },
        },
      });
      let written = '';
      try {
        written = readFileSync(worker, 'utf8');
      } catch {
        // Not written: the same failure as one written without the list.
      }
      if (!written.includes(version)) {
        throw new Error('The build did not write sw.js with its list (docs/OFFLINE.md).');
      }
    },
  };
}

/**
 * The reader's dictionary beside the app's script (src/i18n/dictionaryPreload.ts): writes into the
 * built page's head the few lines that name the dictionary of the language the app will start
 * in, each by the name this build gave its chunk. Only in a build: `pnpm dev` loads the
 * dictionaries as modules of their own.
 *
 * The addresses are in the page as `href`s, so the offline worker's check of the page holds them
 * to its list like every other file under assets/ (`listProblems`, below).
 */
function dictionaryPreload(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'dacapo:dictionary-preload',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.bundle) return;
        const addresses: Record<string, string> = {};
        for (const file of Object.values(context.bundle)) {
          if (file.type !== 'chunk' || !file.isDynamicEntry || !file.facadeModuleId) continue;
          const dictionary = /[\\/]src[\\/]i18n[\\/]([^\\/]+)\.ts$/.exec(file.facadeModuleId);
          if (dictionary) addresses[dictionary[1]!] = `${config.base}${file.fileName}`;
        }
        // English is a chunk of its own, loaded like the others (src/i18n/locale.ts): were it
        // part of the app's script again, every reader of another language would download both.
        if (!addresses.en) throw new Error('The build made no chunk of the English dictionary.');
        const script = dictionaryPreloadScript(addresses);
        if (script === null) {
          config.logger.warn('The page asks for no dictionary ahead: an address is not plain.');
          return;
        }
        // Just before the app's script, as Vite has written it into the head: after the page's
        // encoding (which must come within its first 1024 bytes) and before the stylesheet (a
        // script after a stylesheet waits for it, and this one must not wait).
        const app = html.indexOf('<script type="module"');
        const head = html.indexOf('</head>');
        if (app < 0 || app > head) {
          throw new Error('The built page has no script of the app in its head.');
        }
        return `${html.slice(0, app)}<script>${script}</script>\n    ${html.slice(app)}`;
      },
    },
  };
}

/** What `src/site/main.ts` gives the build, as far as this file needs to know it. */
interface SiteModule {
  renderSite: (sources: {
    appPage: string;
    origin: string | null;
    parseXml: (xml: string) => unknown;
  }) => Promise<{ path: string; content: string }[]>;
}

/**
 * The site's address without its path, from `SITE_URL` (`https://playdacapo.com` for the official
 * build, `pnpm build:site`); the path is the base path. Null for a build that has none: its pages
 * link relatively and it has no sitemap (docs/SITE.md, "Forks and sub-paths").
 */
function siteOrigin(): string | null {
  const given = process.env.SITE_URL?.trim();
  if (!given) return null;
  let url: URL;
  try {
    url = new URL(given);
  } catch {
    throw new Error(`SITE_URL is not an address: ${given}`);
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error(`SITE_URL is not a web address: ${given}`);
  return url.origin;
}

/**
 * The pages a search engine can read (docs/SITE.md): once the app's bundle is written, builds
 * src/site/main.ts for Node, runs it, and writes the pages, the pieces' scores and the sitemap
 * into the build. Only in a build: `pnpm dev` and the tests have no pages.
 *
 * They are written before the offline worker's list is taken (below), which leaves them out: a
 * page is none of the app's files (`groupOf` in src/offline/files.ts). A page that cannot be
 * drawn, or one that would take the place of a file of the app, fails the build.
 */
function sitePages(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'dacapo:site-pages',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    async writeBundle(_options, bundle) {
      // Not for a build that is not the site (SSR: this plugin's own, for one).
      if (config.build.ssr) return;
      const outDir = resolve(config.root, config.build.outDir);
      // Beside the dependencies it leaves to Node (React, Verovio), and out of the build.
      const work = resolve(config.root, 'node_modules/.dacapo/site');
      rmSync(work, { recursive: true, force: true });
      await build({
        configFile: false,
        root: config.root,
        base: config.base,
        mode: config.mode,
        logLevel: 'warn',
        publicDir: false,
        plugins: [react()],
        define: { __APP_VERSION__: JSON.stringify(pkg.version) },
        build: {
          ssr: resolve(config.root, 'src/site/main.ts'),
          outDir: work,
          emptyOutDir: true,
        },
      });
      // The address differs from build to build, so a second build in one process runs its own.
      const built = `${pathToFileURL(join(work, 'main.js')).href}?${Date.now()}`;
      const { renderSite } = (await import(built)) as SiteModule;
      // The scores are MusicXML, read as the app reads them: with a DOM parser, here jsdom's.
      const parser = new new JSDOM('').window.DOMParser();
      const files = await renderSite({
        appPage: readFileSync(join(outDir, 'index.html'), 'utf8'),
        origin: siteOrigin(),
        parseXml: (xml) => parser.parseFromString(xml, 'application/xml'),
      });
      // The app's own files: what the bundle holds and what public/ gave.
      const taken = new Set(Object.keys(bundle));
      if (config.publicDir) for (const file of filesBelow(config.publicDir)) taken.add(file);
      for (const file of files) {
        if (taken.has(file.path)) {
          throw new Error(`A page of the site would replace a file of the app: ${file.path}.`);
        }
        const to = join(outDir, file.path);
        mkdirSync(dirname(to), { recursive: true });
        writeFileSync(to, file.content);
      }
      const bytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
      config.logger.info(
        `site: ${files.length} files (${(bytes / 1e6).toFixed(1)} MB), ${
          siteOrigin() ?? 'no address: relative links, no sitemap'
        }`,
      );
    },
  };
}

export default defineConfig({
  // A sub-path such as `/dacapo/` when the app is served below the site root; `/` by default.
  base: process.env.BASE_PATH ?? '/',
  // The pages before the worker: its list is taken from the build as it then stands.
  plugins: [react(), dictionaryPreload(), sitePages(), offlineWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rolldownOptions: {
      output: {
        // React in a chunk of its own: it changes with a dependency update, not with every
        // release, so a returning visitor keeps it cached while the app's own chunk changes.
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
