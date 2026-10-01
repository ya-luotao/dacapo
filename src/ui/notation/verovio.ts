// Verovio (LGPL-3.0-or-later) draws the score. Its two files are shipped unmodified as their own
// assets and loaded by URL, never bundled into our chunks, so they can be swapped for another
// build of the same version (see THIRD_PARTY_NOTICES.md). Only the Pieces routes load them.

import toolkitUrl from 'verovio/esm?url';
import moduleUrl from 'verovio/wasm?url';
import type { Score } from '../../core/score.ts';
import { matchNotes, writtenOnsets, type NoteMapping, type TimemapEntry } from './mapping.ts';

/** The part of Verovio's toolkit we use. */
export interface Toolkit {
  getVersion(): string;
  setOptions(options: Record<string, unknown>): void;
  loadData(data: string): boolean;
  redoLayout(options?: Record<string, unknown>): void;
  renderToSVG(page?: number): string;
  renderToTimemap(options?: Record<string, unknown>): TimemapEntry[];
  getMIDIValuesForElement(id: string): { pitch: number };
  getElementAttr(id: string): Record<string, string>;
  getLog(): string;
}

interface ToolkitModule {
  VerovioToolkit: new (module: unknown) => Toolkit;
}

interface WasmModule {
  default: () => Promise<unknown>;
}

let loading: Promise<Toolkit> | null = null;
let modules: Promise<[ToolkitModule, WasmModule]> | null = null;

function importModules() {
  modules ??= Promise.all([
    import(/* @vite-ignore */ toolkitUrl) as Promise<ToolkitModule>,
    import(/* @vite-ignore */ moduleUrl) as Promise<WasmModule>,
  ]);
  return modules;
}

/** The engine, loaded once. A failed load can be retried. */
export function loadVerovio(): Promise<Toolkit> {
  loading ??= (async () => {
    const [{ VerovioToolkit }, { default: createModule }] = await importModules();
    // The WASM is inlined in the module file (Emscripten SINGLE_FILE).
    return new VerovioToolkit(await createModule());
  })().catch((error: unknown) => {
    loading = null;
    modules = null;
    throw error;
  });
  return loading;
}

/** Downloads the engine while the browser is idle, without starting it. */
export function prefetchVerovio(): () => void {
  const start = () => void importModules().catch(() => (modules = null));
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(start, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(start, 1500);
  return () => clearTimeout(id);
}

/**
 * The MusicXML as it is drawn: part names are hidden, since the practice view names the piece
 * itself and the label would only indent the first system.
 */
export function drawingXml(xml: string): string {
  return xml.replace(
    /<(part-name|part-abbreviation)(?![^>]*print-object)(\s[^>]*)?>/g,
    (tag, name: string) => tag.replace(`<${name}`, `<${name} print-object="no"`),
  );
}

/** The most a tall frame enlarges the staff: 40% (on an iPad in portrait, for example). */
export const MAX_TALL_ZOOM = 1.4;
/**
 * Frames up to this tall for their width keep the base staff size: a laptop window (about 0.4)
 * and an iPad in landscape (0.58–0.62 measured), the layouts the practice page was designed at.
 * An iPad in portrait measures about 0.95.
 */
const TALL_FROM = 0.65;

/**
 * Staff size: Verovio's `scale` is a percentage of its default spacing. It follows the width;
 * when the frame's height is given and the frame is taller than 0.65 of its width, the staff grows
 * with it (up to MAX_TALL_ZOOM), so a tall sheet is filled with larger systems rather than left
 * half empty. The height is only given where it does not depend on the score itself (the
 * one-screen layout of the practice page).
 */
export function scaleFor(width: number, height: number | null = null): number {
  const base = width < 480 ? 34 : width < 800 ? 38 : 42;
  if (height === null || width <= 0) return base;
  const zoom = Math.min(MAX_TALL_ZOOM, Math.max(1, height / width / TALL_FROM));
  return Math.round(base * zoom);
}

/** Engraving choices a page can make; by default Verovio's, as on the Pieces pages. */
export interface Engraving {
  /**
   * How full the last system must be (0–1) to be stretched across the page like the others;
   * Verovio's own is 0.8, so a short last system keeps its natural width.
   */
  lastJustification?: number;
  /** Octave lines as "8va" and "15ma", stacked above the fingering (a lone "8" collides with it). */
  ottavaText?: boolean;
  /**
   * Notes spaced nearly by how long they last, with room between the systems: a rhythm line,
   * whose counts the page writes under each beat (Read's rhythm, docs/READING.md).
   */
  rhythm?: boolean;
  /**
   * Systems break where the file says (`<print new-system>`: a sight-reading fragment's second
   * phrase), from `PHRASE_BREAKS_FROM` px wide; a narrower page breaks where it must.
   */
  phrases?: boolean;
}

/** The narrowest page that keeps a phrase of four bars on one system. */
export const PHRASE_BREAKS_FROM = 560;

/** Verovio's own threshold for stretching the last system. */
const DEFAULT_LAST_JUSTIFICATION = 0.8;

/** Verovio's own spacing: its default options. */
const SPACING = { spacingLinear: 0.25, spacingNonLinear: 0.6, spacingSystem: 4 };
/**
 * A rhythm line's: close to proportional (a sixteenth has room for its count, and a half note
 * looks twice a quarter), and space between systems for the counts and the timings.
 */
const RHYTHM_SPACING = { spacingLinear: 0.15, spacingNonLinear: 0.9, spacingSystem: 10 };

/** The engraving as a value: equal engravings give equal keys, whatever object holds them. */
export const engravingKey = (e: Engraving): string =>
  `${e.lastJustification ?? DEFAULT_LAST_JUSTIFICATION}:${e.ottavaText === true}:${e.rhythm === true}:${e.phrases === true}`;

const sameEngraving = (a: Engraving, b: Engraving) => engravingKey(a) === engravingKey(b);

export function layoutOptions(
  width: number,
  scale = scaleFor(width),
  engraving: Engraving = {},
): Record<string, unknown> {
  return {
    // Verovio lays out in its own units; the page is `width` px at our scale.
    pageWidth: Math.round((width * 100) / scale),
    pageHeight: 60000,
    adjustPageHeight: true,
    scale,
    breaks: engraving.phrases === true && width >= PHRASE_BREAKS_FROM ? 'encoded' : 'auto',
    font: 'Bravura',
    header: 'none',
    footer: 'none',
    pageMarginLeft: 30,
    pageMarginRight: 30,
    pageMarginTop: 40,
    pageMarginBottom: 60,
    svgViewBox: true,
    svgHtml5: true,
    svgRemoveXlink: true,
    // The timemap stays in written order; repeats are ours to unroll (core/repeats.ts).
    expandNever: true,
    // Never 'linked': that would fetch a stylesheet from verovio.org.
    smuflTextFont: 'embedded',
    // Always both: the toolkit is shared and keeps any option it is not given again, so a page
    // that says nothing must set Verovio's defaults back.
    minLastJustification: engraving.lastJustification ?? DEFAULT_LAST_JUSTIFICATION,
    octaveAlternativeSymbols: engraving.ottavaText === true,
    ...(engraving.rhythm === true ? RHYTHM_SPACING : SPACING),
  };
}

// The toolkit holds one document at a time; remember which, and at what width and scale.
let loaded: { xml: string; width: number; scale: number; engraving: Engraving } | null = null;

/** Loads the piece into the toolkit; throws when Verovio cannot read it. */
export function loadPiece(
  tk: Toolkit,
  xml: string,
  width: number,
  scale = scaleFor(width),
  engraving: Engraving = {},
): void {
  loaded = null;
  tk.setOptions(layoutOptions(width, scale, engraving));
  if (!tk.loadData(drawingXml(xml))) throw new Error(`Verovio: ${tk.getLog()}`);
  loaded = { xml, width, scale, engraving };
}

/**
 * Lays the piece out for `width` at `scale`. Returns true when it had to be loaded again because
 * another document took its place: Verovio's element ids are new then.
 */
export function layoutPiece(
  tk: Toolkit,
  xml: string,
  width: number,
  scale = scaleFor(width),
  engraving: Engraving = {},
): boolean {
  if (loaded?.xml !== xml) {
    loadPiece(tk, xml, width, scale, engraving);
    return true;
  }
  if (
    loaded.width !== width ||
    loaded.scale !== scale ||
    !sameEngraving(loaded.engraving, engraving)
  ) {
    tk.setOptions(layoutOptions(width, scale, engraving));
    tk.redoLayout();
    loaded = { xml, width, scale, engraving };
  }
  return false;
}

/**
 * Maps our notes to Verovio's note ids, from its timemap. `measureIds` are Verovio's measure ids
 * in written order (the order of `g.measure` in the drawing).
 */
export function mapNotes(
  tk: Toolkit,
  score: Score,
  measureIds: readonly string[],
): NoteMapping<string> {
  const index = new Map(measureIds.map((id, i) => [id, i] as const));
  const onsets = writtenOnsets(
    tk.renderToTimemap({ includeRests: false, includeMeasures: true }),
    index,
    score.measures.map((m) => m.start),
  );
  const seen = new Set<string>();
  const drawn = [];
  for (const { id, tick } of onsets) {
    if (seen.has(id)) continue;
    seen.add(id);
    drawn.push({
      item: id,
      tick,
      midi: tk.getMIDIValuesForElement(id).pitch,
      grace: 'grace' in tk.getElementAttr(id),
    });
  }
  return matchNotes(score.notes, drawn);
}

/** Measure ids in written order, read from an SVG string (for the import check, off-screen). */
export function measureIdsOf(svg: string): string[] {
  return [...svg.matchAll(/<g data-id="([^"]+)" data-class="measure"/g)].map((m) => m[1]!);
}

/** How many notes to press could not be found on the drawn score. */
export async function countUnplaced(xml: string, score: Score): Promise<number> {
  const tk = await loadVerovio();
  loadPiece(tk, xml, 1000);
  const svg = tk.renderToSVG(1);
  return mapNotes(tk, score, measureIdsOf(svg)).unplaced.length;
}
