// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { pieceFacts } from './pieceRecords.ts';
import {
  arrangeProgression,
  PATTERN_IDS,
  PROGRESSION_IDS,
  PROGRESSIONS,
  progressionKeys,
  type ProgressionSpec,
} from './progressions.ts';
import { numeralText, PROGRESSION_HANDS, progressionXml } from './progressionXml.ts';
import { TICKS_PER_QUARTER } from './score.ts';

const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const read = (spec: ProgressionSpec, bpm?: number) =>
  parseMusicXml(domParse(progressionXml(spec, { bpm })), { hands: PROGRESSION_HANDS });
const EIGHTH = TICKS_PER_QUARTER / 2;

function* allSpecs(): Generator<ProgressionSpec> {
  for (const progression of PROGRESSION_IDS)
    for (const key of progressionKeys(PROGRESSIONS[progression].mode))
      for (const pattern of PATTERN_IDS) yield { progression, key, pattern };
}

describe('progressionXml', () => {
  it('reads back as the arrangement, note for note, for every progression, key and pattern', () => {
    for (const spec of allSpecs()) {
      const a = arrangeProgression(spec);
      const score = read(spec);
      expect(score.warnings).toEqual([]);
      expect(score.measures).toHaveLength(a.bars.length);
      expect(score.measures.every((m) => m.beats === a.beats && m.beatType === 4)).toBe(true);
      const barTicks = a.beats * TICKS_PER_QUARTER;
      const expected = a.bars
        .flatMap((bar, m) =>
          bar.notes.map((n) => ({
            onset: m * barTicks + n.onset * EIGHTH,
            duration: n.duration * EIGHTH,
            midi: n.midi,
            pitch: n.pitch,
            hand: n.hand,
          })),
        )
        .sort((x, y) => x.onset - y.onset || x.midi - y.midi);
      const parsed = score.notes
        .map(({ onset, duration, midi, pitch, hand }) => ({ onset, duration, midi, pitch, hand }))
        .sort((x, y) => x.onset - y.onset || x.midi - y.midi);
      expect(parsed).toEqual(expected);
    }
  });

  it('writes the tempo chosen, which leaves the notes (and the checksum) as they are', () => {
    const spec: ProgressionSpec = { progression: 'I-vi-IV-V', key: 'G', pattern: 'waltz' };
    expect(read(spec).tempos).toEqual([{ tick: 0, bpm: 80 }]);
    expect(read(spec, 112).tempos).toEqual([{ tick: 0, bpm: 112 }]);
    expect(pieceFacts(read(spec, 112)).checksum).toBe(pieceFacts(read(spec)).checksum);
  });

  it('prints the chord symbols above and the numerals below', () => {
    const xml = progressionXml({ progression: 'ii-V-I', key: 'Bb', pattern: 'block' });
    const doc = domParse(xml);
    const harmonies = [...doc.getElementsByTagName('harmony')].map((h) => ({
      step: h.getElementsByTagName('root-step')[0]!.textContent,
      alter: h.getElementsByTagName('root-alter')[0]?.textContent ?? '0',
      kind: h.getElementsByTagName('kind')[0]!.getAttribute('text'),
    }));
    expect(harmonies).toEqual([
      { step: 'C', alter: '0', kind: 'm7' },
      { step: 'F', alter: '0', kind: '7' },
      { step: 'B', alter: '-1', kind: 'maj7' },
      { step: 'B', alter: '-1', kind: 'maj7' },
    ]);
    const words = [...doc.getElementsByTagName('words')].map((w) => w.textContent);
    expect(words).toEqual(['ii⁷', 'V⁷', 'Imaj⁷', 'Imaj⁷']);
    expect(numeralText({ numeral: 'IV', figure: '' })).toBe('IV');
    // Nothing printed is read as a dynamic or a marking.
    const score = read({ progression: 'ii-V-I', key: 'Bb', pattern: 'block' });
    expect(score.markings.dynamics).toEqual([]);
  });

  it('writes the signs the key does not give, again in each bar, and a courtesy one after', () => {
    // C7 in C: B♭ with its flat; F7 in bars 5 and 6: E♭; back to C7 in bar 7: E with a natural.
    const doc = domParse(progressionXml({ progression: 'blues', key: 'C', pattern: 'block' }));
    const signs = [...doc.getElementsByTagName('measure')].map((m) =>
      [...m.getElementsByTagName('note')]
        .filter((n) => n.getElementsByTagName('staff')[0]!.textContent === '1')
        .filter((n) => n.getElementsByTagName('accidental').length > 0)
        .map(
          (n) =>
            `${n.getElementsByTagName('step')[0]!.textContent}${n.getElementsByTagName('octave')[0]!.textContent}:${n.getElementsByTagName('accidental')[0]!.textContent}`,
        ),
    );
    expect(signs[0]).toEqual(['B4:flat']);
    expect(signs[4]).toEqual(['E4:flat']);
    expect(signs[5]).toEqual(['E4:flat']);
    expect(signs[6]).toEqual(['E4:natural', 'B4:flat']);
    // G♯ minor's D♯ major: F𝄪.
    const minor = domParse(
      progressionXml({ progression: 'i-iv-V-i', key: 'G#m', pattern: 'block' }),
    );
    const bar3 = [...minor.getElementsByTagName('measure')[2]!.getElementsByTagName('accidental')];
    expect(bar3.map((a) => a.textContent)).toContain('double-sharp');
  });

  it('beams the Alberti bass by the half bar', () => {
    const doc = domParse(progressionXml({ progression: 'I-IV-V-I', key: 'C', pattern: 'alberti' }));
    const beams = [...doc.getElementsByTagName('measure')[0]!.getElementsByTagName('beam')].map(
      (b) => b.textContent,
    );
    expect(beams).toEqual([
      'begin',
      'continue',
      'continue',
      'end',
      'begin',
      'continue',
      'continue',
      'end',
    ]);
  });

  // Records are kept by checksum (docs/PIECES.md): a change to the notes a progression is written
  // with orphans every step recorded on it, so it must be deliberate.
  it('keeps the notes of every progression as they are', () => {
    const checksums = Object.fromEntries(
      PROGRESSION_IDS.flatMap((progression) =>
        PATTERN_IDS.map((pattern) => {
          const key = progressionKeys(PROGRESSIONS[progression].mode)[0]!;
          return [
            `${progression}:${pattern}`,
            pieceFacts(read({ progression, key, pattern })).checksum,
          ];
        }),
      ),
    );
    expect(checksums).toMatchInlineSnapshot(`
      {
        "I-IV-V-I:alberti": "ae5536a6",
        "I-IV-V-I:arpeggio": "8e26de66",
        "I-IV-V-I:block": "0a867b6f",
        "I-IV-V-I:rootFifth": "3c59f414",
        "I-IV-V-I:stride": "c2fe79f9",
        "I-IV-V-I:waltz": "1a5cdac5",
        "I-vi-IV-V:alberti": "67fcfe00",
        "I-vi-IV-V:arpeggio": "91735efd",
        "I-vi-IV-V:block": "ef3b77ac",
        "I-vi-IV-V:rootFifth": "9368909e",
        "I-vi-IV-V:stride": "753f5dea",
        "I-vi-IV-V:waltz": "d92bd303",
        "blues:alberti": "fd3bb444",
        "blues:arpeggio": "82e172fc",
        "blues:block": "226cafb8",
        "blues:rootFifth": "3fa72f5f",
        "blues:stride": "ffa44ab7",
        "blues:waltz": "1339857b",
        "i-iv-V-i:alberti": "bc99b07b",
        "i-iv-V-i:arpeggio": "035f7b10",
        "i-iv-V-i:block": "1a38d69a",
        "i-iv-V-i:rootFifth": "67bbff51",
        "i-iv-V-i:stride": "6100b9cb",
        "i-iv-V-i:waltz": "18413375",
        "ii-V-I:alberti": "73a775b4",
        "ii-V-I:arpeggio": "b080e875",
        "ii-V-I:block": "544fff13",
        "ii-V-I:rootFifth": "5de699d7",
        "ii-V-I:stride": "17da9dbb",
        "ii-V-I:waltz": "c7d68420",
        "vi-ii-V-I:alberti": "d52e8460",
        "vi-ii-V-I:arpeggio": "e3fce0b7",
        "vi-ii-V-I:block": "7be1ba13",
        "vi-ii-V-I:rootFifth": "aab4d293",
        "vi-ii-V-I:stride": "8dcc2954",
        "vi-ii-V-I:waltz": "47cd7575",
      }
    `);
  });
});
