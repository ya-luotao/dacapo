// The site's pages, written when the app is built (docs/SITE.md). vite.config.ts builds this file
// for Node once the app's bundle is on disk, runs `renderSite`, and writes what it returns into
// the build. Nothing here touches a file: the build hands in what Node has (a reader of XML) and
// takes the pages back.

import { parseMusicXml } from '../core/musicxml.ts';
import type { Score } from '../core/score.ts';
import { pieceKey } from '../core/transpose.ts';
import { BUILT_IN, loadBuiltIn, type BuiltInId } from '../pieces/library/index.ts';
import { rememberLibraryScore } from '../ui/learn/libraryScores.ts';
import { scorePath } from './addresses.ts';
import { absolute, hasAddress, siteOf } from './document.ts';
import { pageFile, sitemap, sitePages } from './pages.ts';
import { renderPage, type PieceSheet } from './render.tsx';
import { engrave, loadEngraver } from './score.ts';
import { translator } from './words.ts';

export interface SiteSources {
  /** The app's page as the build wrote it: the pages share its stylesheet and icons. */
  appPage: string;
  /** The site's address without its path (`https://playdacapo.com`), or null when it has none. */
  origin: string | null;
  /** Reads XML into a document, as the browser's `DOMParser` does for the app. */
  parseXml: (xml: string) => Document;
}

/** A file of the site: its path below the build's root, and its text. */
export interface SiteFile {
  path: string;
  content: string;
}

/** A piece's time signatures in the order they first appear. */
function timesOf(score: Score): string[] {
  return [...new Set(score.measures.map((measure) => `${measure.beats}/${measure.beatType}`))];
}

/**
 * Every file of the site: each piece's score, each page, and the sitemap where the site has an
 * address. The same sources give the same files, byte for byte. A page that cannot be drawn
 * throws: there is no site with a page missing.
 */
export async function renderSite(sources: SiteSources): Promise<SiteFile[]> {
  const site = siteOf(sources.appPage, import.meta.env.BASE_URL, sources.origin);
  const files: SiteFile[] = [];

  // The scores first: a lesson's figures read them too (the forms of the library's pieces).
  const engraver = await loadEngraver();
  const sheets = new Map<BuiltInId, PieceSheet>();
  for (const piece of BUILT_IN) {
    const xml = await loadBuiltIn(piece.id);
    const score = parseMusicXml(sources.parseXml(xml));
    rememberLibraryScore(piece.id, score);
    // Named in English, as the file itself is.
    const title = translator('en')(`library.${piece.id}.title`);
    const { svg, width, height } = engrave(engraver, xml, `${title}, ${piece.composer}`);
    files.push({ path: scorePath(piece.id), content: svg });
    sheets.set(piece.id, {
      bars: score.measures.length,
      key: pieceKey(score),
      times: timesOf(score),
      fingering: score.notes.some((note) => note.finger !== null),
      image: { width, height },
    });
  }

  const pages = sitePages();
  for (const page of pages) {
    files.push({ path: pageFile(page.path), content: renderPage(page, site, sheets) });
  }

  if (hasAddress(site)) {
    files.push({ path: 'sitemap.xml', content: sitemap(pages, (path) => absolute(site, path)) });
  }
  return files;
}
