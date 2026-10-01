import { describe, expect, it } from 'vitest';
import config from '../../vite.config.ts?raw';
import { groupOf, type OfflineFile, type OfflineList } from './files.ts';
import { listProblems } from './list.ts';

// The build fails when its list is not sound (the plugin in vite.config.ts calls `listProblems`
// and then looks for the `sw.js` it wrote). These are the rules it fails on.

const VERSION = '0123456789ab';
const FILES: OfflineFile[] = [
  ['', 'app', 7956],
  ['assets/index-AAAA.js', 'app', 1000],
  ['assets/index-BBBB.css', 'app', 500],
  ['assets/verovio-module-CCCC.mjs', 'engraver', 7000],
  ['manifest.webmanifest', 'app', 50],
  ['piano/A4-mf.mp3', 'piano', 400],
];
const list = (files: OfflineFile[] = FILES, version = VERSION): OfflineList => ({ version, files });

const page = (base: string, ...names: string[]) =>
  `<!doctype html><html><head><link rel="manifest" href="${base}manifest.webmanifest" />${names
    .map((name) => `<script type="module" crossorigin src="${base}assets/${name}"></script>`)
    .join(
      '',
    )}<link rel="stylesheet" crossorigin href="${base}assets/index-BBBB.css"></head></html>`;

describe('listProblems', () => {
  it('a list that has the page, and every file under assets/ the page names, is sound', () => {
    expect(listProblems(list(), page('/', 'index-AAAA.js'), '/')).toEqual([]);
    expect(listProblems(list(), page('/dacapo/', 'index-AAAA.js'), '/dacapo/')).toEqual([]);
  });

  it('the page must be in the list, as one of the app’s files', () => {
    expect(listProblems(list(FILES.slice(1)), page('/', 'index-AAAA.js'), '/')).toEqual([
      'the page is not in the list as one of the app’s files',
    ]);
    const misplaced: OfflineFile[] = [['', 'pictures', 7956], ...FILES.slice(1)];
    expect(listProblems(list(misplaced), page('/', 'index-AAAA.js'), '/')).toHaveLength(1);
  });

  it('every file under assets/ that the page names must be in the list', () => {
    expect(listProblems(list(), page('/', 'index-AAAA.js', 'react-RRRR.js'), '/')).toEqual([
      'the page names a file under assets/ that the list does not have, or none',
    ]);
    // A page built for another base names nothing below this one.
    expect(listProblems(list(), page('/', 'index-AAAA.js'), '/dacapo/')).toHaveLength(1);
    expect(listProblems(list(), '<html></html>', '/')).toHaveLength(1);
  });

  it('no page but the app’s is listed, and never the worker itself', () => {
    const more: OfflineFile[] = [...FILES, ['icons/about.html', 'app', 10], ['sw.js', 'app', 10]];
    expect(listProblems(list(more), page('/', 'index-AAAA.js'), '/')).toEqual([
      'icons/about.html: a page other than the app’s is listed',
      'sw.js is listed',
    ]);
  });

  it('a file is listed once, and the list has its version', () => {
    const twice: OfflineFile[] = [...FILES, ['piano/A4-mf.mp3', 'piano', 400]];
    expect(listProblems(list(twice), page('/', 'index-AAAA.js'), '/')).toEqual([
      'a file is listed twice',
    ]);
    expect(listProblems(list(FILES, ''), page('/', 'index-AAAA.js'), '/')).toEqual([
      'the list has no version',
    ]);
  });
});

describe('what the build lists', () => {
  it('never lists a page other than index.html, in whatever folder', () => {
    // Cloudflare answers x.html with a redirect to x, which cannot be stored: one such file
    // among the app's would fail every install.
    expect(groupOf('icons/about.html')).toBeNull();
    expect(groupOf('learn/figure.html')).toBeNull();
    expect(groupOf('piano/index.html')).toBeNull();
    expect(groupOf('licenses/verovio/notice.html')).toBeNull();
    expect(groupOf('assets/page-AAAA.html')).toBeNull();
    expect(groupOf('404.html')).toBeNull();
    expect(groupOf('index.html')).toBe('app');
  });

  it('never lists the worker', () => {
    expect(groupOf('sw.js')).toBeNull();
  });
});

describe('the build', () => {
  // docs/OFFLINE.md, "Releases": from the first release with the worker, every deploy carries an
  // sw.js. Taking the plugin out of the build is not a way to withdraw the worker.
  it('still has the plugin that writes sw.js and fails without it', () => {
    expect(config).toMatch(/plugins: \[[^\]]*\bofflineWorker\(\)/);
    expect(config).toContain('listProblems(list, page, config.base)');
    expect(config).toContain('The build did not write sw.js');
  });
});
