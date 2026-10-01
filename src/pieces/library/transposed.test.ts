// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { keyAlter, parseMusicXml } from '../../core/musicxml.ts';
import type { Letter } from '../../core/note.ts';
import { pieceChecksum } from '../../core/pieceRecords.ts';
import type { Score } from '../../core/score.ts';
import { pieceKey, transposedFifths, TRANSPOSITIONS } from '../../core/transpose.ts';
import { transposed, withLeftHand } from '../derive.ts';
import { BUILT_IN } from './index.ts';

// Every library piece in every key it can be moved to (docs/HARMONY.md, "Transposing (H4)"):
// what the parser reads is the written piece a number of semitones away, and what the file
// prints is what sounds.

const FILES = import.meta.glob<string>('./*.musicxml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const IDS = BUILT_IN.map((p) => p.id);
const xmlOf = (id: string) => FILES[`./${id}.musicxml`]!;
/** Parsed once: the tests read each piece in each key several times. */
const cache = new Map<string, { xml: string; score: Score }>();
function moved(id: string, n: number): { xml: string; score: Score } {
  const key = `${id}:${n}`;
  let found = cache.get(key);
  if (!found) {
    found =
      n === 0
        ? { xml: xmlOf(id), score: parseMusicXml(domParse(xmlOf(id))) }
        : transposed(xmlOf(id), moved(id, 0).score.hands, n);
    cache.set(key, found);
  }
  return found;
}
const written = (id: string) => moved(id, 0).score;
const SHIFTS = TRANSPOSITIONS.filter((n) => n !== 0);

const SIGNS: Record<string, number> = {
  sharp: 1,
  natural: 0,
  flat: -1,
  'double-sharp': 2,
  'flat-flat': -2,
};

const el = (parent: Element, name: string) => parent.getElementsByTagName(name)[0] ?? null;

/**
 * Reads the file as a player reads the page: a note sounds as its own sign says, else as an
 * earlier sign on its line in the bar, else as the key signature. Returns the notes whose pitch
 * is not what the page shows.
 */
function misprints(xml: string): string[] {
  const out: string[] = [];
  const doc = domParse(xml);
  for (const part of doc.getElementsByTagName('part')) {
    let fifths = new Map<number, number>([[0, 0]]);
    for (const measure of part.getElementsByTagName('measure')) {
      const inBar = new Map<string, number>();
      for (const node of measure.children) {
        if (node.localName === 'attributes') {
          for (const key of node.getElementsByTagName('key')) {
            const staff = Number(key.getAttribute('number'));
            const value = Number(el(key, 'fifths')?.textContent);
            if (staff > 0) fifths.set(staff, value);
            else fifths = new Map([[0, value]]);
          }
        }
        const pitch = node.localName === 'note' ? el(node, 'pitch') : null;
        if (!pitch) continue;
        const step = el(pitch, 'step')!.textContent as Letter;
        const alter = Number(el(pitch, 'alter')?.textContent ?? 0);
        const staff = Number(el(node, 'staff')?.textContent ?? 1);
        const place = `${staff}:${step}${el(pitch, 'octave')!.textContent}`;
        const sign = el(node, 'accidental')?.textContent;
        const tiedOver = [...node.getElementsByTagName('tie'), ...node.getElementsByTagName('tied')]
          .map((t) => t.getAttribute('type'))
          .includes('stop');
        // A note tied over carries its sign from the note it is tied to.
        if (tiedOver && sign === undefined) continue;
        const shown =
          sign !== undefined
            ? SIGNS[sign]
            : (inBar.get(place) ?? keyAlter(fifths.get(staff) ?? fifths.get(0) ?? 0, step));
        if (shown !== alter)
          out.push(`bar ${measure.getAttribute('number')} ${place} is ${alter}, shown ${shown}`);
        inBar.set(place, alter);
      }
    }
  }
  return out;
}

/** What must be the same in every key: everything but the keys themselves. */
const shape = (score: Score, shift: number) =>
  score.notes.map((n) => ({
    id: n.id,
    onset: n.onset,
    duration: n.duration,
    midi: n.midi - shift,
    hand: n.hand,
    staff: n.staff,
    tieStart: n.tieStart,
    tieStop: n.tieStop,
    finger: n.finger,
    graces: n.graces?.map((g) => g.midi - shift),
    ornaments: n.ornaments?.map((o) => [o.kind, o.upper - shift, o.lower - shift]),
  }));

describe('the library as written', () => {
  it.each(IDS)('%s prints every note as it sounds', (id) => {
    expect(misprints(xmlOf(id))).toEqual([]);
  });

  it('names each piece’s key', () => {
    const names = Object.fromEntries(
      IDS.map((id) => {
        const { fifths, mode } = pieceKey(written(id));
        return [id, `${fifths} ${mode}`];
      }),
    );
    // Without a `<mode>` in the file, by the note the piece ends on. The Musette ends on its
    // dominant (its first half is played again to end), so its file names the mode.
    expect(names).toEqual({
      'beethoven-ode-to-joy': '0 major',
      'petzold-minuet-in-g': '1 major',
      'burgmuller-arabesque': '0 minor',
      'schumann-soldiers-march': '1 major',
      'beethoven-fur-elise': '0 minor',
      'bach-prelude-in-c': '0 major',
      'petzold-minuet-in-g-minor': '-2 minor',
      'bach-musette-in-d': '2 major',
      'burgmuller-candeur': '0 major',
      'tchaikovsky-old-french-song': '-2 minor',
      'tchaikovsky-morning-prayer': '1 major',
      'chopin-prelude-in-c-minor': '-3 minor',
      'satie-gymnopedie-1': '2 major',
      'trad-twinkle-twinkle': '1 major',
      'trad-frere-jacques': '-1 major',
      'lyte-row-your-boat': '2 major',
      'trad-amazing-grace': '1 major',
      'pierpont-jingle-bells': '1 major',
      'foster-oh-susanna': '1 major',
      'trad-auld-lang-syne': '1 major',
      'trad-swing-low': '-1 major',
    });
  });
});

// Reading the longest piece in twelve keys takes a few seconds under jsdom.
describe('the library transposed', { timeout: 60_000 }, () => {
  it.each(IDS)('%s: the same piece, so many semitones away, in each of its twelve keys', (id) => {
    const before = written(id);
    for (const n of SHIFTS) {
      const { score } = moved(id, n);
      expect(score.warnings).toEqual(before.warnings);
      expect(shape(score, n)).toEqual(shape(before, 0));
      expect(score.measures).toEqual(before.measures);
      expect(score.markings).toEqual(before.markings);
      // Its records are the written piece's: the checksum is taken in the written key.
      const back = score.notes.map((note) => ({ ...note, midi: note.midi - n }));
      expect(pieceChecksum({ notes: back })).toBe(pieceChecksum(before));
    }
  });

  it.each(IDS)('%s: every key signature the simpler one, every note within a double sign', (id) => {
    const before = written(id);
    for (const n of SHIFTS) {
      const { score } = moved(id, n);
      expect(score.keys?.map((k) => k.fifths)).toEqual(
        before.keys?.map((k) => transposedFifths(k.fifths, n)),
      );
      for (const k of score.keys ?? []) {
        expect(k.fifths).toBeGreaterThanOrEqual(-5);
        expect(k.fifths).toBeLessThanOrEqual(6);
      }
      for (const note of score.notes) expect(Math.abs(note.pitch.alter)).toBeLessThanOrEqual(2);
    }
  });

  it.each(IDS)('%s: a note of the written key is a note of the new key', (id) => {
    const before = written(id);
    const from = before.keys?.[0]?.fifths ?? 0;
    // Pieces that keep one signature: every note is under it.
    if ((before.keys ?? []).length > 1) return;
    for (const n of SHIFTS) {
      const { score } = moved(id, n);
      const to = transposedFifths(from, n);
      before.notes.forEach((note, k) => {
        const now = score.notes[k]!.pitch;
        const inKey = note.pitch.alter === keyAlter(from, note.pitch.step);
        expect(now.alter === keyAlter(to, now.step), `${id} ${n} ${note.id}`).toBe(inKey);
        // And as far outside it as it was.
        expect(now.alter - keyAlter(to, now.step)).toBe(
          note.pitch.alter - keyAlter(from, note.pitch.step),
        );
      });
    }
  });

  it.each(IDS)('%s: prints every note as it sounds in every key', (id) => {
    for (const n of SHIFTS) expect(misprints(moved(id, n).xml), `${id} ${n}`).toEqual([]);
  });

  it('moves the chord symbols with the notes, each still a symbol the app writes', () => {
    for (const id of IDS.filter((i) => written(i).harmonies)) {
      const before = written(id);
      for (const n of SHIFTS) {
        const { score } = moved(id, n);
        expect(score.harmonies).toHaveLength(before.harmonies!.length);
        score.harmonies!.forEach((h, k) => {
          const was = before.harmonies![k]!;
          expect(h.symbol, `${id} ${n} ${h.text}`).not.toBeNull();
          expect(h.symbol!.quality).toBe(was.symbol!.quality);
          expect([h.tick, h.kind, h.measure]).toEqual([was.tick, was.kind, was.measure]);
        });
      }
    }
  });

  it('moves a left hand made from the symbols with the melody', () => {
    const base = withLeftHand(xmlOf('trad-amazing-grace'), written('trad-amazing-grace'), 'waltz');
    for (const n of SHIFTS) {
      const { score } = transposed(base.xml, base.score.hands, n);
      expect(shape(score, n)).toEqual(shape(base.score, 0));
      expect(misprints(transposed(base.xml, base.score.hands, n).xml)).toEqual([]);
    }
  });
});
