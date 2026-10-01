import { describe, expect, it } from 'vitest';
import { groupOf } from './files.ts';

const ROOT = '/Users/someone/dacapo';
const VEROVIO = `${ROOT}/node_modules/.pnpm/verovio@6.3.0/node_modules/verovio/dist`;

describe('groupOf', () => {
  it('the page, the scripts, the stylesheet and the fonts are the app', () => {
    expect(groupOf('index.html')).toBe('app');
    expect(groupOf('assets/index-CUBJweyU.js')).toBe('app');
    expect(groupOf('assets/index-DCuy0hfT.css', [`${ROOT}/src/ui/styles.css`])).toBe('app');
    expect(groupOf('assets/bravura-CBWYXOFh.woff2', [`${ROOT}/src/ui/fonts/bravura.woff2`])).toBe(
      'app',
    );
    // A page or a lesson's text loaded on demand is still the app.
    expect(groupOf('assets/ReadPage-BImptz4n.js', [`${ROOT}/src/ui/pages/ReadPage.tsx`])).toBe(
      'app',
    );
    expect(
      groupOf('assets/pedals.zh-CN-C4_wkXlc.js', [`${ROOT}/src/ui/learn/lessons/pedals.zh-CN.tsx`]),
    ).toBe('app');
  });

  it('the manifest and the icons are the app', () => {
    expect(groupOf('manifest.webmanifest')).toBe('app');
    expect(groupOf('favicon.svg')).toBe('app');
    expect(groupOf('icons/icon-192.png')).toBe('app');
    expect(groupOf('icons/apple-touch-icon.png')).toBe('app');
  });

  it('Verovio’s two files are the engraver, by where they come from', () => {
    expect(groupOf('assets/verovio-Dwzu0msT.mjs', [`${VEROVIO}/verovio.mjs`])).toBe('engraver');
    expect(groupOf('assets/verovio-module-6TqgM-wq.mjs', [`${VEROVIO}/verovio-module.mjs`])).toBe(
      'engraver',
    );
    expect(
      groupOf('assets/x-00000000.mjs', ['C:\\dacapo\\node_modules\\verovio\\dist\\verovio.mjs']),
    ).toBe('engraver');
    // A file of ours that only has the name is not.
    expect(groupOf('assets/verovio-00000000.js', [`${ROOT}/src/ui/notation/verovio.ts`])).toBe(
      'app',
    );
    expect(groupOf('assets/verovio-00000000.js')).toBe('app');
  });

  it('a dictionary loaded on demand is a language', () => {
    expect(groupOf('assets/ja-BEuMdkYH.js', [`${ROOT}/src/i18n/ja.ts`])).toBe('languages');
    expect(groupOf('assets/zh-CN-IBSTt3t5.js', [`${ROOT}/src/i18n/zh-CN.ts`])).toBe('languages');
    expect(groupOf('assets/x.js', ['C:\\dacapo\\src\\i18n\\ko.ts'])).toBe('languages');
    expect(groupOf('assets/x.js', [`${ROOT}/src/i18n/sub/ko.ts`])).toBe('app');
  });

  it('the samples, the lessons’ pictures and the licence texts are stored when fetched', () => {
    expect(groupOf('piano/A0-f.mp3')).toBe('piano');
    expect(groupOf('learn/two-hands.webp')).toBe('pictures');
    expect(groupOf('licenses/verovio/COPYING')).toBe('licences');
  });

  it('nothing else is the worker’s', () => {
    expect(groupOf('sw.js')).toBeNull();
    expect(groupOf('_headers')).toBeNull();
    expect(groupOf('robots.txt')).toBeNull();
    expect(groupOf('sitemap.xml')).toBeNull();
    expect(groupOf('social-card.png')).toBeNull();
    expect(groupOf('something-new/file.bin')).toBeNull();
    expect(groupOf('assets/index-CUBJweyU.js.map')).toBeNull();
  });
});
