// A built-in piece's score as an image (docs/SITE.md): engraved when the site is built, by the
// engraver the app uses, with the app's own options, at one width. The same file for the same
// piece, whenever it is built.

import { drawingXml, layoutOptions, scaleFor, type Toolkit } from '../ui/notation/verovio.ts';

/**
 * The page the score is laid out for, in CSS pixels: the measure of a piece's page on a laptop.
 * A phone shows the same image smaller, and the image opens on its own to be enlarged.
 */
export const SCORE_WIDTH = 720;

export interface EngravedScore {
  svg: string;
  /** The image's size in CSS pixels at `SCORE_WIDTH`. */
  width: number;
  height: number;
}

/** The engraver, loaded as Node loads it (the two files the app fetches by their addresses). */
export async function loadEngraver(): Promise<Toolkit> {
  const [{ VerovioToolkit }, { default: createModule }] = await Promise.all([
    import('verovio/esm'),
    import('verovio/wasm'),
  ]);
  return new VerovioToolkit(await createModule()) as unknown as Toolkit;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Engraves `xml` whole, as one tall image in black on nothing, with `title` as its name. The ids
 * Verovio gives its elements are random by default: seeded, they are the same in every build.
 * What only a page with scripts could use is taken out (the ids of the notes, for the cursor),
 * and so is the indentation.
 */
export function engrave(tk: Toolkit, xml: string, title: string): EngravedScore {
  tk.setOptions({ ...layoutOptions(SCORE_WIDTH, scaleFor(SCORE_WIDTH)), xmlIdSeed: 1 });
  if (!tk.loadData(drawingXml(xml))) throw new Error(`Verovio: ${tk.getLog()}`);
  // One page holds the tallest score the options allow; a longer one would be cut off unseen.
  const pages = (tk as Toolkit & { getPageCount(): number }).getPageCount();
  if (pages !== 1) throw new Error(`The score of ${title} takes ${pages} pages, not one image.`);
  const drawn = tk.renderToSVG(1);
  const box = /^<svg viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(drawn);
  if (!box) throw new Error('Verovio drew a score without a size.');
  const svg = drawn
    .replace(/ data-(?:id|class)="[^"]*"/g, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/^(<svg [^>]*>)/, `$1\n<title>${escapeXml(title)}</title>`);
  return { svg, width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
}

/** An incipit's width in CSS pixels, as the library lays it out; every incipit is this wide. */
export const INCIPIT_WIDTH = 320;
/** Its staff, smaller than a page's: a line of a catalogue, not a score to read from. */
const INCIPIT_SCALE = 30;

/**
 * What a few bars at the head of a list need not carry: tempo words, pedalling and "simile"
 * (`<direction>`), fingering and lyrics.
 */
function bareXml(xml: string): string {
  return xml
    .replace(/<direction\b[\s\S]*?<\/direction>/g, '')
    .replace(/<fingering\b[^>]*(?:\/>|>[\s\S]*?<\/fingering>)/g, '')
    .replace(/<lyric\b[\s\S]*?<\/lyric>/g, '');
}

/**
 * A piece's incipit, as a catalogue prints it: its first two bars (three when the first is an
 * upbeat; fewer when they do not fit on one system), stretched to `INCIPIT_WIDTH`, so that every incipit's staff is the same size. Drawn in
 * black on nothing: the library uses it as a mask, coloured with the page's ink.
 */
export function engraveIncipit(tk: Toolkit, xml: string, title: string): EngravedScore {
  const upbeat = /<measure\b[^>]*\bimplicit="yes"/.test(/<measure\b[^>]*>/.exec(xml)?.[0] ?? '');
  tk.setOptions({
    ...layoutOptions(INCIPIT_WIDTH, INCIPIT_SCALE),
    pageMarginLeft: 0,
    pageMarginRight: 0,
    pageMarginTop: 0,
    pageMarginBottom: 0,
    minLastJustification: 0,
    xmlIdSeed: 1,
  });
  if (!tk.loadData(drawingXml(bareXml(xml)))) throw new Error(`Verovio: ${tk.getLog()}`);
  // As many of those bars as one system holds: a dense bar (Bach's Prelude in C) stands alone.
  let drawn = '';
  for (let bars = upbeat ? 3 : 2; bars >= 1; bars--) {
    (tk as Toolkit & { select(selection: object): boolean }).select({
      measureRange: bars === 1 ? '1' : `1-${bars}`,
    });
    tk.redoLayout();
    drawn = tk.renderToSVG(1);
    if ((drawn.match(/<g [^>]*class="system"/g) ?? []).length === 1) break;
  }
  const box = /^<svg viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(drawn);
  if (!box) throw new Error('Verovio drew an incipit without a size.');
  const svg = drawn
    .replace(/ (?:data-[a-z-]+|class)="[^"]*"/g, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/^(<svg [^>]*>)/, `$1\n<title>${escapeXml(title)}</title>`);
  return { svg, width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
}
