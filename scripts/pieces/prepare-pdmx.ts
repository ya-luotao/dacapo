// Turns a CC0 MuseScore export from the PDMX dataset into a built-in piece: fingering of unknown
// origin removed, provenance written into <identification>, optionally cut to one movement. The
// music is otherwise left exactly as exported.
//
//   node --experimental-strip-types scripts/pieces/prepare-pdmx.ts <id> <file.mxl>
//
// Reads scripts/pieces/pdmx/<id>.json and writes src/pieces/library/<id>.musicxml.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { musicXmlFromBytes, parseMusicXml } from '../../src/core/musicxml.ts';
import { parseXml, serializeXml } from './dom.ts';

interface Manifest {
  pdmx: number;
  zenodoPath: string;
  sha256: string;
  title: string;
  workNumber: string;
  composer: string;
  uploader: string;
  url: string;
  checkedAgainst: string;
  /** Keep measures up to this index (inclusive), in every part. */
  cutAfterMeasure: number | null;
  /** Drop <direction>s whose text contains any of these (dedications that are not music). */
  removeDirections: string[];
}

const PDMX =
  'the PDMX dataset (Long, Novack, McAuley and Berg-Kirkpatrick, 2025; ' +
  'https://zenodo.org/records/15571083, CC BY 4.0)';

const [id, input] = process.argv.slice(2);
if (!id || !input) {
  console.error('usage: prepare-pdmx.ts <id> <file.mxl>');
  process.exit(2);
}
const here = new URL('.', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL(`pdmx/${id}.json`, here), 'utf8')) as Manifest;
const bytes = readFileSync(input);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== manifest.sha256)
  throw new Error(`${input}: sha256 ${hash}, expected ${manifest.sha256}`);

const doc = parseXml(musicXmlFromBytes(new Uint8Array(bytes), parseXml));
const root = doc.documentElement;

/** Removes `el` and the indentation before it, so no blank line is left behind. */
function remove(el: Element) {
  const before = el.previousSibling;
  if (before && before.nodeType === before.TEXT_NODE && !before.textContent?.trim())
    before.remove();
  el.remove();
}

const children = (el: Element, name: string) =>
  [...el.children].filter((c) => c.localName === name);
const all = (name: string) => [...doc.getElementsByTagName(name)];

function make(name: string, text?: string, attrs: Record<string, string> = {}): Element {
  const el = doc.createElement(name);
  if (text !== undefined) el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Fingering, and the <technical>/<notations> it leaves empty.
let fingerings = 0;
for (const el of all('fingering')) {
  remove(el);
  fingerings++;
}
for (const name of ['technical', 'notations'])
  for (const el of all(name)) if (el.children.length === 0) remove(el);

// One movement only.
if (manifest.cutAfterMeasure !== null) {
  for (const part of children(root, 'part')) {
    const measures = children(part, 'measure');
    for (const m of measures.slice(manifest.cutAfterMeasure + 1)) remove(m);
    const lastMeasure = measures[manifest.cutAfterMeasure]!;
    for (const b of children(lastMeasure, 'barline'))
      if (b.getAttribute('location') === 'right') remove(b);
    const barline = indented(make('barline', undefined, { location: 'right' }), 4, [
      make('bar-style', 'light-heavy'),
    ]);
    lastMeasure.append(barline, doc.createTextNode('\n      '));
  }
}

for (const direction of all('direction'))
  if (manifest.removeDirections.some((text) => direction.textContent?.includes(text)))
    remove(direction);

// Title blocks on the page: the app shows the title itself.
for (const el of children(root, 'credit')) remove(el);
for (const name of ['movement-title', 'movement-number'])
  for (const el of children(root, name)) remove(el);

// <work> and <identification> with the provenance; they come first in <score-partwise>.
const supports = all('supports');
for (const name of ['work', 'identification']) for (const el of children(root, name)) remove(el);

/** Appends `items` to `parent`, each on its own line at `depth` levels of indentation. */
function indented(parent: Element, depth: number, items: Element[]): Element {
  for (const item of items) parent.append(doc.createTextNode(`\n${'  '.repeat(depth)}`), item);
  // MuseScore puts the closing tag at the children's indentation; so do we.
  parent.append(doc.createTextNode(`\n${'  '.repeat(depth)}`));
  return parent;
}

const work = indented(make('work'), 2, [
  make('work-number', manifest.workNumber),
  make('work-title', manifest.title),
]);
const encoding = indented(make('encoding'), 3, [
  make('encoder', manifest.uploader),
  make('software', 'MuseScore 3.6.2'),
  make('software', 'dacapo scripts/pieces/prepare-pdmx.ts'),
  make('encoding-date', '2025-01-14'),
  ...supports,
]);
const identification = indented(make('identification'), 2, [
  make('creator', manifest.composer, { type: 'composer' }),
  make(
    'rights',
    `Music: public domain. This encoding: ${manifest.uploader}, dedicated to the public domain ` +
      `(CC0 1.0) on MuseScore (${manifest.url}); from ${PDMX}. Fingering removed by the dacapo project.`,
  ),
  encoding,
  make(
    'source',
    `MuseScore score ${manifest.pdmx} (${manifest.url}), as exported in ${PDMX}, file ` +
      `${manifest.zenodoPath} (sha256 ${manifest.sha256}). Checked note for note against ${manifest.checkedAgainst}.`,
  ),
]);
const first = root.firstElementChild;
root.insertBefore(work, first);
root.insertBefore(doc.createTextNode('\n  '), first);
root.insertBefore(identification, first);
root.insertBefore(doc.createTextNode('\n  '), first);

const comment = doc.createComment(
  ` ${manifest.composer}, ${manifest.title} (${manifest.workNumber}). CC0 encoding by ` +
    `${manifest.uploader}, via PDMX; prepared for dacapo by scripts/pieces/prepare-pdmx.ts ` +
    `(${fingerings} fingerings removed${manifest.cutAfterMeasure !== null ? `, cut after measure index ${manifest.cutAfterMeasure}` : ''}). `,
);
doc.insertBefore(comment, root);

const out = `<?xml version="1.0" encoding="UTF-8"?>\n${serializeXml(doc)
  .replace(/><!--/, '>\n<!--')
  .replace(/--><score-partwise/, '-->\n<score-partwise')
  .replace(/(<score-partwise[^>]*>)<work>/, '$1\n  <work>')}\n`;

// The result must still read as the same music.
const score = parseMusicXml(parseXml(out));
if (/<fingering\b/.test(out)) throw new Error('fingering left behind');
const target = new URL(`../../src/pieces/library/${id}.musicxml`, here);
writeFileSync(target, out);
console.log(
  `wrote src/pieces/library/${id}.musicxml: ${score.measures.length} measures, ` +
    `${score.notes.length} notes, ${fingerings} fingerings removed`,
);
