// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from '../../core/musicxml.ts';
import { performanceOrder } from '../../core/repeats.ts';
import { TICKS_PER_QUARTER, type Score, type SpelledPitch } from '../../core/score.ts';
import { pieceKey } from '../../core/transpose.ts';
import { TUNE_SOURCES } from '../../core/tuneData.ts';
import { TUNE_IDS, TUNE_PHRASES } from '../../core/tuneList.ts';
import { getTune } from '../../core/tunes.ts';
import { BUILT_IN } from './index.ts';

// The tunes played by ear (docs/HARMONY.md, "Playing by ear (H5)") are the library's lead sheets:
// tuneData.ts holds each melody so that the Ear page and the validators need no MusicXML, and
// this test holds it to the files, note for note.

const FILES = import.meta.glob<string>('./*.musicxml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const SIXTEENTH = TICKS_PER_QUARTER / 4;
const scoreOf = (id: string) =>
  parseMusicXml(new DOMParser().parseFromString(FILES[`./${id}.musicxml`]!, 'application/xml'));

const nameOf = (p: SpelledPitch) =>
  `${p.step}${p.alter === 1 ? '#' : p.alter === -1 ? 'b' : ''}${p.octave}`;

/** The right hand as it is sung, in tuneData.ts's notation: every bar with its rests. */
function melodyOf(score: Score): string {
  const tokens: string[] = [];
  for (const played of performanceOrder(score.measures)) {
    const m = score.measures[played.measure]!;
    let at = m.start;
    const rest = (to: number) => {
      if (to > at) tokens.push(`r/${(to - at) / SIXTEENTH}`);
    };
    for (const n of score.notes) {
      if (n.measure !== m.index || n.hand !== 'right') continue;
      // One note at a time: a melody.
      expect(n.onset).toBeGreaterThanOrEqual(at);
      rest(n.onset);
      tokens.push(`${nameOf(n.pitch)}/${n.duration / SIXTEENTH}${n.tieStart ? '~' : ''}`);
      at = n.onset + n.duration;
    }
    rest(m.start + m.duration);
    tokens.push('|');
  }
  return tokens.join(' ');
}

const normal = (lines: readonly string[]) => lines.join(' ').split(/\s+/).join(' ');

describe('the tunes played by ear', () => {
  it('are the library’s lead sheets, in its order', () => {
    expect([...TUNE_IDS]).toEqual(BUILT_IN.filter((p) => p.leadSheet).map((p) => p.id));
  });

  it.each(TUNE_IDS)('%s: the table is the file’s melody as it is sung', (id) => {
    const score = scoreOf(id);
    const source = TUNE_SOURCES[id];
    expect(normal(source.phrases)).toBe(melodyOf(score));
    expect(pieceKey(score)).toEqual({ fifths: source.fifths, mode: 'major' });
    const first = score.measures[0]!;
    expect([first.beats, first.beatType]).toEqual([source.beats, source.beatType]);
    expect(
      score.measures.every((m) => m.beats === first.beats && m.beatType === first.beatType),
    ).toBe(true);
  });

  it.each(TUNE_IDS)('%s: its keys are the keys a run of the piece presses', (id) => {
    const score = scoreOf(id);
    const tune = getTune(id);
    const played = performanceOrder(score.measures).flatMap((p) =>
      score.notes.filter((n) => n.measure === p.measure && n.hand === 'right' && !n.tieStop),
    );
    expect(tune.notes.map((n) => n.midi)).toEqual(played.map((n) => n.midi));
    expect(tune.notes.map((n) => n.pitch)).toEqual(played.map((n) => n.pitch));
    expect(tune.notes).toHaveLength(BUILT_IN.find((p) => p.id === id)!.facts.notes!.play);
    // The bars are the file's, as played.
    expect(tune.bars.map((b) => b.duration)).toEqual(
      performanceOrder(score.measures).map((p) => score.measures[p.measure]!.duration),
    );
  });

  it('have the phrases the levels count', () => {
    expect(Object.fromEntries(TUNE_IDS.map((id) => [id, getTune(id).phrases.length]))).toEqual(
      TUNE_PHRASES,
    );
  });
});
