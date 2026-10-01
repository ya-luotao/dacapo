import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { defineConfig } from 'vitest/config';
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

export default defineConfig({
  // A sub-path such as `/dacapo/` when the app is served below the site root; `/` by default.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), offlineWorker()],
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
