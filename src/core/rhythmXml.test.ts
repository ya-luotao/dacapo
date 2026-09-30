// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { seededRng } from './random.ts';
import { RHYTHM_LEVELS } from './rhythmCells.ts';
import {
  buildExercise,
  drawExercise,
  exerciseOnsets,
  exerciseSteps,
  LINE_KEYS,
  type RhythmExercise,
} from './rhythmExercise.ts';
import { rhythmHands, rhythmMusicXml } from './rhythmXml.ts';
import { buildSteps } from './score.ts';

const parse = (e: RhythmExercise) =>
  parseMusicXml(new DOMParser().parseFromString(rhythmMusicXml(e), 'application/xml'), {
    hands: rhythmHands(e),
  });

const SAMPLES: RhythmExercise[] = [
  buildExercise('R6', '4/4', ['q', 'trip', 'ed-s', 'qr', 'h', '~q', 'ee']),
  buildExercise('R4', '3/4', ['q', '~q', 'ee', 'hd', '~q', '~ee', 'q']),
  buildExercise('R7', '4/4', ['er-e', 'q', 'e-q-e', 'tie-q-e', 'e-q-e']),
  buildExercise('R5', '2/4', ['ssss', 'e-ss', 'ss-e', 'ed-s']),
  buildExercise('R8', '6/8', ['c:qe', 'c:eq', 'c:eee', 'c:qdr']),
  buildExercise('R9', '3/4', ['h|q', 'q|q', 'er-e|q', 'qd-e|q']),
  buildExercise('R10', '2/4', ['trip|ee', 'ee|trip', 'qr|ee', 'q|er-e']),
  ...RHYTHM_LEVELS.map((level) =>
    drawExercise({ level, meter: level.meters.at(-1)!, bars: 4, stats: {}, rng: seededRng(11) }),
  ),
];

describe('the rhythm line as MusicXML', () => {
  it('reads back as the exercise: every onset of each hand, ties held, the bars', () => {
    for (const e of SAMPLES) {
      const label = e.cells.map((c) => c.key).join(' ');
      const score = parse(e);
      expect(score.measures, label).toHaveLength(e.bars + 1);
      expect(score.measures[0]).toMatchObject({
        beats: Number(e.meter[0]),
        beatType: Number(e.meter.slice(2)),
      });
      e.lines.forEach((_, line) => {
        const hand = line === 0 ? 'right' : 'left';
        const struck = score.notes
          .filter((n) => n.hand === hand && !n.tieStop)
          .map((n) => [n.onset, n.midi]);
        const expected = exerciseOnsets(e)
          .filter((o) => o.line === line)
          .map((o) => [o.tick, LINE_KEYS[line]]);
        expect(struck, label).toEqual(expected);
      });
      expect(score.warnings, label).toEqual([]);
      // The parsed score's steps are the plan's, one for one.
      expect(
        buildSteps(score, 'both').map((s) => [s.tick, s.midis]),
        label,
      ).toEqual(exerciseSteps(e).map((s) => [s.tick, s.midis]));
    }
  });

  it('draws one line per hand, without clefs, beamed by the beat', () => {
    const xml = rhythmMusicXml(SAMPLES[6]!);
    expect(xml).toContain('<staves>2</staves>');
    expect(xml.match(/<staff-lines>1<\/staff-lines>/g)).toHaveLength(2);
    expect(xml.match(/<clef number="\d" print-object="no">/g)).toHaveLength(2);
    // The triplet's 3 without a bracket (its beam shows the group).
    expect(xml).toContain(
      '<tuplet type="start" bracket="no" show-number="actual" placement="above"/>',
    );
    expect(xml).toContain(
      '<tuplet type="start" bracket="no" show-number="actual" placement="below"/>',
    );
    const sixteenths = rhythmMusicXml(SAMPLES[3]!);
    // ed-s: the sixteenth hooks back towards the dotted eighth.
    expect(sixteenths).toContain('<beam number="2">backward hook</beam>');
    expect(sixteenths).toContain('<beam number="2">continue</beam>');
    const six = rhythmMusicXml(SAMPLES[4]!);
    // Three eighths under one beam in 6/8; a lone eighth keeps its flag.
    expect(six.match(/<beam number="1">continue<\/beam>/g)).toHaveLength(1);
    expect(six).toContain('<type>quarter</type><dot/>');
    expect(six).toContain('<bar-style>light-heavy</bar-style>');
  });
});
