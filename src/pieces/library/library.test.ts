// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from '../../core/musicxml.ts';
import { isBlack } from '../../core/note.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { demoIncludes, performedNotes } from '../../core/playback.ts';
import { buildSteps, TICKS_PER_QUARTER, type Score } from '../../core/score.ts';
import bachPreludeInC from './bach-prelude-in-c.musicxml?raw';
import beethovenFurElise from './beethoven-fur-elise.musicxml?raw';
import beethovenOdeToJoy from './beethoven-ode-to-joy.musicxml?raw';
import burgmullerArabesque from './burgmuller-arabesque.musicxml?raw';
import petzoldMinuetInG from './petzold-minuet-in-g.musicxml?raw';
import schumannSoldiersMarch from './schumann-soldiers-march.musicxml?raw';

const Q = TICKS_PER_QUARTER;

const FILES: Record<string, string> = {
  'petzold-minuet-in-g': petzoldMinuetInG,
  'beethoven-fur-elise': beethovenFurElise,
  'beethoven-ode-to-joy': beethovenOdeToJoy,
  'burgmuller-arabesque': burgmullerArabesque,
  'schumann-soldiers-march': schumannSoldiersMarch,
  'bach-prelude-in-c': bachPreludeInC,
};

function parse(id: string): Score {
  return parseMusicXml(new DOMParser().parseFromString(FILES[id]!, 'application/xml'));
}

/** FNV-1a, 32 bits: enough to notice any change to the notes. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The written measure runs of the performance order, e.g. "0-15,0-31". */
function runs(score: Score): string {
  const out: string[] = [];
  let first = -1;
  let last = -2;
  for (const { measure } of performanceOrder(score.measures)) {
    if (measure === last + 1) {
      last = measure;
      continue;
    }
    if (first >= 0) out.push(`${first}-${last}`);
    first = last = measure;
  }
  out.push(`${first}-${last}`);
  return out.join(',');
}

/**
 * Locks every note of every built-in piece: a deliberate edit to a file must update its line here.
 * The sequence is (written onset, MIDI pitch, duration, hand) in the parser's note order.
 */
const LOCKED: Record<string, { notes: number; checksum: string }> = {
  'petzold-minuet-in-g': { notes: 203, checksum: 'b80fe0e1' },
  'beethoven-fur-elise': { notes: 157, checksum: '2718f11a' },
  'beethoven-ode-to-joy': { notes: 85, checksum: '7a47ee21' },
  'burgmuller-arabesque': { notes: 285, checksum: '7db61cc9' },
  'schumann-soldiers-march': { notes: 212, checksum: '3deaa5fc' },
  'bach-prelude-in-c': { notes: 619, checksum: 'aaa8934c' },
};

describe('built-in pieces', () => {
  it.each(Object.keys(FILES))('%s: notes are locked by checksum', (id) => {
    const score = parse(id);
    const sequence = score.notes
      .map((n) => `${n.onset},${n.midi},${n.duration},${n.hand}`)
      .join(';');
    expect({ notes: score.notes.length, checksum: fnv1a(sequence) }).toEqual(LOCKED[id]);
  });

  it.each(Object.keys(FILES))('%s: provenance, no fingering, both hands', (id) => {
    const xml = FILES[id]!;
    expect(xml).not.toMatch(/<fingering\b/);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const identification = doc.querySelector('score-partwise > identification')!;
    expect(identification.querySelector('creator[type="composer"]')?.textContent).toBeTruthy();
    expect(identification.querySelector('rights')?.textContent).toMatch(/public domain/i);
    expect(identification.querySelector('source')?.textContent).toMatch(/https:\/\//);
    expect(identification.querySelector('encoding > encoder')?.textContent).toBeTruthy();
    const score = parse(id);
    expect(score.title).not.toBe('');
    expect(score.hands).toEqual({ '0.1': 'right', '0.2': 'left' });
    expect(buildSteps(score, 'right').length).toBeGreaterThan(0);
    expect(buildSteps(score, 'left').length).toBeGreaterThan(0);
  });

  it('Minuet in G: 32 bars of 3/4, both halves repeated', () => {
    const score = parse('petzold-minuet-in-g');
    expect(score.title).toBe('Minuet in G major');
    expect(score.measures).toHaveLength(32);
    expect(score.measures.every((m) => m.duration === 3 * Q)).toBe(true);
    expect(score.notes.filter((n) => n.hand === 'right')).toHaveLength(128);
    expect(score.notes.filter((n) => n.hand === 'left')).toHaveLength(75);
    expect(score.warnings).toEqual(expect.arrayContaining(['grace-notes', 'ornaments']));
    expect(score.tempos).toEqual([]);
    expect(runs(score)).toBe('0-15,0-31,16-31');
    const right = buildSteps(score, 'right');
    expect(right.slice(0, 6).map((s) => s.midis)).toEqual([[74], [67], [69], [71], [72], [74]]);
    expect(right[1]).toMatchObject({ measure: 0, beat: 2, tick: Q });
    // Bar 1 starts with the right hand's D5 over the left hand's G3–B3–D4.
    expect(buildSteps(score, 'both')[0]!.midis).toEqual([55, 59, 62, 74]);
    // Bar 32: the right hand's two voices make one chord.
    expect(right.at(-1)).toMatchObject({ measure: 31, pass: 2, midis: [59, 62, 67] });
    // Bar 30, left hand: E3 G3 F♯3 (see the file's comment).
    const bar30 = score.notes.filter((n) => n.measure === 29 && n.hand === 'left');
    expect(bar30.map((n) => n.midi)).toEqual([52, 55, 54]);
  });

  it('Für Elise: the A section with both repeats, closing on its cadence', () => {
    const score = parse('beethoven-fur-elise');
    expect(score.measures).toHaveLength(25);
    expect(score.measures[0]).toMatchObject({ number: '0', duration: Q / 2 });
    expect(score.measures[8]!.repeat).toMatchObject({ ending: [1], backwardTimes: 2 });
    expect(score.measures[24]!.repeat.ending).toEqual([2]);
    expect(runs(score)).toBe('0-8,0-7,9-23,10-22,24-24');
    const right = buildSteps(score, 'right');
    expect(right.slice(0, 4).map((s) => s.midis)).toEqual([[76], [75], [76], [75]]);
    // Hands alternate in the episode: the left hand takes E5 and D♯5.
    const left = buildSteps(score, 'left').filter((s) => s.measure === 14 && s.pass === 1);
    expect(left.map((s) => s.midis)).toEqual([[76], [75], [76]]);
    // It ends as the piece does: A4 over octave As; with the pickup, the last bar is a full bar.
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([33, 45, 69]);
    expect(score.measures[0]!.duration + score.measures[24]!.duration).toBe(3 * (Q / 2));
    expect(score.tempos).toEqual([{ tick: 0, bpm: 72 }]);
  });

  it('Ode to Joy: 16 bars in C, the right hand on white keys from G3 to G4', () => {
    const score = parse('beethoven-ode-to-joy');
    expect(score.measures).toHaveLength(16);
    expect(score.measures.every((m) => m.beats === 4 && m.beatType === 4)).toBe(true);
    const right = score.notes.filter((n) => n.hand === 'right');
    expect(right.every((n) => !isBlack(n.midi) && n.midi >= 55 && n.midi <= 67)).toBe(true);
    const left = new Set(score.notes.filter((n) => n.hand === 'left').map((n) => n.midi));
    expect([...left].sort((a, b) => a - b)).toEqual([43, 48, 52, 55]);
    expect(
      buildSteps(score, 'right')
        .slice(0, 4)
        .map((s) => s.midis),
    ).toEqual([[64], [64], [65], [67]]);
    expect(buildSteps(score, 'both').at(-1)!.midis).toEqual([48, 52, 55, 60]);
  });

  it('Arabesque: the first ending without its repeat sign still goes back', () => {
    const score = parse('burgmuller-arabesque');
    expect(score.measures).toHaveLength(33);
    expect(score.measures[0]).toMatchObject({ beats: 2, beatType: 4 });
    expect(runs(score)).toBe('0-9,2-8,10-26,11-25,27-32');
    expect(score.notes.filter((n) => n.tieStop)).toHaveLength(2);
  });

  it("Soldiers' March: the second half repeated", () => {
    const score = parse('schumann-soldiers-march');
    expect(score.measures).toHaveLength(32);
    expect(runs(score)).toBe('0-31,16-31');
  });

  it('Prelude in C: the prelude alone, 35 bars without repeats', () => {
    const score = parse('bach-prelude-in-c');
    expect(score.measures).toHaveLength(35);
    expect(score.measures.at(-1)!.number).toBe('35');
    expect(runs(score)).toBe('0-34');
    expect(score.notes.filter((n) => !n.tieStop)).toHaveLength(549);
    // Bar 1: C major broken upwards, C4 E4 held under G4 C5 E5.
    expect(
      buildSteps(score, 'both')
        .slice(0, 5)
        .map((s) => s.midis),
    ).toEqual([[60], [64], [67], [72], [76]]);
  });

  it.each(Object.keys(FILES))(
    '%s: the demo strikes exactly the keys wait mode asks for, for each hand selection',
    (id) => {
      const score = parse(id);
      const order = performanceOrder(score.measures);
      for (const hands of ['right', 'left', 'both'] as const) {
        const keys = buildSteps(score, hands, order).reduce((n, s) => n + s.midis.length, 0);
        expect(performedNotes(score, order, demoIncludes(hands)), hands).toHaveLength(keys);
      }
    },
  );
});
