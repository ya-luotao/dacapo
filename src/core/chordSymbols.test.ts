import { describe, expect, it } from 'vitest';
import {
  bassMissing,
  bassTone,
  formatSymbol,
  getHarmonyLevel,
  HARMONY_LEVEL_IDS,
  HARMONY_LEVELS,
  harmonyItemInLevel,
  harmonyLevelItems,
  isSymbolRoot,
  judgeSymbolKeys,
  nextHarmonyLevel,
  parseSymbol,
  parseSymbolItem,
  rootlessSuffix,
  rootPc,
  spellRoot,
  symbolItem,
  symbolPitchClasses,
  symbolTones,
  symbolVoicing,
  SYMBOL_QUALITIES,
  SYMBOL_ROOTS,
  type ChordSymbol,
  type SymbolQuality,
} from './chordSymbols.ts';
import { CHORD_QUALITIES } from './earItems.ts';

const SIGNS: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };
const sym = (text: string): ChordSymbol => {
  const parsed = parseSymbol(text);
  if (!parsed) throw new Error(`not a symbol: ${text}`);
  return parsed;
};
const tones = (text: string) =>
  symbolTones(sym(text))
    .map((t) => `${t.step}${SIGNS[t.alter]}`)
    .join(' ');
const pcs = (text: string) => [...symbolPitchClasses(sym(text))].sort((a, b) => a - b);

describe('the symbols', () => {
  it('writes and reads every quality in the one style of the app', () => {
    const written = SYMBOL_QUALITIES.map((quality) =>
      formatSymbol({ root: { step: 'D', alter: 0 }, quality, bass: null }),
    );
    expect(written).toEqual([
      'D',
      'Dm',
      'D°',
      'D+',
      'Dsus2',
      'Dsus4',
      'D7',
      'Dmaj7',
      'Dm7',
      'Dm7♭5',
      'D°7',
      'D6',
      'Dm6',
      'Dadd9',
    ]);
    for (const text of [...written, 'B♭', 'F♯m', 'C/E', 'Am/G', 'E♭m/D♭', 'C♯°7', 'G♭/B♭']) {
      expect(formatSymbol(sym(text))).toBe(text);
    }
    expect(sym('F♯m7♭5')).toEqual({
      root: { step: 'F', alter: 1 },
      quality: 'hdim7',
      bass: null,
    });
    expect(sym('Am/G').bass).toEqual({ step: 'G', alter: 0 });
  });

  it('names a quality without its root in the same style, the major triad as maj', () => {
    // The Ear page's and Read's chords, as Progress heads their columns.
    expect(CHORD_QUALITIES.map(rootlessSuffix)).toEqual([
      'maj',
      'm',
      '°',
      '+',
      '7',
      'maj7',
      'm7',
      'm7♭5',
    ]);
  });

  it('refuses other spellings and anything else', () => {
    for (const bad of [
      'Bb',
      'A#',
      'CM7',
      'CΔ7',
      'Cmin',
      'Cdim',
      'Caug',
      'Cø7',
      'C–',
      'c',
      'H',
      'C/',
      'C/E/G',
      'C/C',
      'C/B♯',
      'Cm/Cm',
      'Cmaj9',
      'C7♭9',
      '',
      ' C',
      null,
      7,
    ]) {
      expect(parseSymbol(bad)).toBeNull();
    }
  });

  it('holds the pitch classes of its chord and of a bass outside it', () => {
    expect(pcs('C')).toEqual([0, 4, 7]);
    expect(pcs('Dm7')).toEqual([0, 2, 5, 9]);
    expect(pcs('C/E')).toEqual([0, 4, 7]);
    expect(pcs('Am/G')).toEqual([0, 4, 7, 9]);
    expect(pcs('Cadd9')).toEqual([0, 2, 4, 7]);
    expect(pcs('Csus4')).toEqual([0, 5, 7]);
    expect(pcs('C°7')).toEqual([0, 3, 6, 9]);
    expect(pcs('B♭m6')).toEqual([1, 5, 7, 10]);
  });

  it('names its tones by letters above the root, double signs included', () => {
    expect(tones('Dm7')).toBe('D F A C');
    expect(tones('C°7')).toBe('C E♭ G♭ B𝄫');
    expect(tones('B+')).toBe('B D♯ F𝄪');
    expect(tones('Cadd9')).toBe('C E G D');
    expect(tones('Gsus4')).toBe('G C D');
    expect(tones('E♭6')).toBe('E♭ G B♭ C');
    // A bass that is a tone is that tone; one that is not comes last.
    expect(tones('C/E')).toBe('C E G');
    expect(tones('Am/G')).toBe('A C E G');
    expect(bassTone(sym('C/E'))).toEqual({ step: 'E', alter: 0 });
    expect(bassTone(sym('C'))).toBeNull();
  });
});

describe('spelling by key', () => {
  const on = (pc: number, quality: SymbolQuality) =>
    formatSymbol({ root: spellRoot(pc, quality), quality, bass: null });

  it('writes a root as lead sheets do', () => {
    expect(on(10, 'maj')).toBe('B♭');
    expect(on(6, 'min')).toBe('F♯m');
    expect(on(1, 'maj')).toBe('D♭');
    expect(on(1, 'min')).toBe('C♯m');
    expect(on(8, 'maj')).toBe('A♭');
    expect(on(8, 'min')).toBe('G♯m');
    expect(on(10, 'min')).toBe('B♭m');
    expect(on(6, 'dom7')).toBe('F♯7');
    expect(on(3, 'dim')).toBe('D♯°');
    expect(on(3, 'dim7')).toBe('D♯°7');
    expect(on(1, 'hdim7')).toBe('C♯m7♭5');
  });

  it('breaks a tie by the smaller key signature, then with flats', () => {
    // G♯m6 (G♯ B D♯ E♯) and A♭m6 (A♭ C♭ E♭ F) need as many signs: G♯ minor has five sharps.
    expect(on(8, 'min6')).toBe('G♯m6');
    // F♯ and G♭ major, D♯ and E♭ minor tie on both.
    expect(on(6, 'maj')).toBe('G♭');
    expect(on(3, 'min')).toBe('E♭m');
  });

  it('never writes E♯, F♭, B♯ or C♭ as a root or a bass', () => {
    expect(SYMBOL_ROOTS).toHaveLength(17);
    for (const level of HARMONY_LEVELS) {
      for (const text of level.symbols) {
        const symbol = sym(text);
        expect(isSymbolRoot(symbol.root), text).toBe(true);
        if (symbol.bass) expect(isSymbolRoot(symbol.bass), text).toBe(true);
      }
    }
  });

  it('keeps double sharps and flats out of every tone but those of the natural roots', () => {
    // C°7 is C E♭ G♭ B𝄫 however it is spelled; a sharp or flat root is chosen to avoid them.
    for (const level of HARMONY_LEVELS) {
      for (const text of level.symbols) {
        const symbol = sym(text);
        const doubles = symbolTones(symbol).some((t) => Math.abs(t.alter) > 1);
        if (symbol.root.alter !== 0) expect(doubles, text).toBe(false);
      }
    }
  });
});

describe('judging the keys held', () => {
  it('is right with exactly the pitch classes, in any octave, voicing and inversion', () => {
    expect(judgeSymbolKeys(sym('C'), [60, 64, 67])).toBe('right');
    expect(judgeSymbolKeys(sym('C'), [52, 67, 72])).toBe('right');
    expect(judgeSymbolKeys(sym('C'), [48, 60, 64, 67, 72])).toBe('right');
    expect(judgeSymbolKeys(sym('Dm7'), [48, 62, 65, 69])).toBe('right');
    expect(judgeSymbolKeys(sym('Cadd9'), [60, 62, 64, 67])).toBe('right');
  });

  it('waits for the rest, and is wrong at the first key outside', () => {
    expect(judgeSymbolKeys(sym('C'), [60])).toBe('pending');
    expect(judgeSymbolKeys(sym('C'), [60, 64])).toBe('pending');
    expect(judgeSymbolKeys(sym('C'), [60, 63])).toBe('wrong');
    expect(judgeSymbolKeys(sym('C7'), [60, 64, 67])).toBe('pending');
    expect(judgeSymbolKeys(sym('C'), [60, 64, 67, 70])).toBe('wrong');
  });

  it('needs a slash chord’s bass lowest, and waits for it rather than failing', () => {
    expect(judgeSymbolKeys(sym('C/E'), [52, 60, 67])).toBe('right');
    expect(judgeSymbolKeys(sym('C/E'), [60, 64, 67])).toBe('pending');
    expect(bassMissing(sym('C/E'), [60, 64, 67])).toBe(true);
    // The left hand a moment late: the bass below the chord makes it right.
    expect(judgeSymbolKeys(sym('C/E'), [52, 60, 64, 67])).toBe('right');
    expect(judgeSymbolKeys(sym('Am/G'), [55, 57, 60, 64])).toBe('right');
    expect(judgeSymbolKeys(sym('Am/G'), [57, 60, 64])).toBe('pending');
    expect(judgeSymbolKeys(sym('Am/G'), [57, 60, 64, 67])).toBe('pending');
    expect(bassMissing(sym('Am/G'), [57, 60, 64])).toBe(false);
    expect(judgeSymbolKeys(sym('Am/G'), [55, 57, 60, 65])).toBe('wrong');
    expect(bassMissing(sym('C'), [64, 67, 72])).toBe(false);
  });
});

describe('the keyboard', () => {
  it('shows a chord from its root at or above middle C, and a bass below it', () => {
    expect(symbolVoicing(sym('C'))).toEqual([60, 64, 67]);
    expect(symbolVoicing(sym('B7'))).toEqual([71, 75, 78, 81]);
    expect(symbolVoicing(sym('C/E'))).toEqual([52, 60, 64, 67]);
    expect(symbolVoicing(sym('Am/G'))).toEqual([55, 69, 72, 76]);
    expect(symbolVoicing(sym('B♭add9'))).toEqual([58, 62, 65, 72]);
    for (const level of HARMONY_LEVELS) {
      for (const text of level.symbols) {
        const keys = symbolVoicing(sym(text));
        expect(Math.min(...keys), text).toBeGreaterThanOrEqual(48);
        expect(Math.max(...keys), text).toBeLessThanOrEqual(83);
        expect(judgeSymbolKeys(sym(text), keys), text).toBe('right');
      }
    }
  });
});

describe('levels', () => {
  const symbols = (id: (typeof HARMONY_LEVEL_IDS)[number]) => getHarmonyLevel(id).symbols;

  it('asks for the table’s symbols', () => {
    expect(symbols('H1')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm', 'D', 'Gm', 'B♭']);
    expect(symbols('H2')).toHaveLength(24);
    expect(symbols('H2').slice(0, 4)).toEqual(['C', 'Cm', 'D♭', 'C♯m']);
    expect(symbols('H3')).toHaveLength(36);
    expect(new Set(symbols('H3').map((s) => sym(s).quality))).toEqual(
      new Set(['dom7', 'maj7', 'min7']),
    );
    expect(symbols('H4')).toHaveLength(84);
    expect(symbols('H4')).toEqual(
      expect.arrayContaining(['C/E', 'C/G', 'G/B', 'Am/G', 'Am/C', 'F/G', 'C/B', 'D/F♯']),
    );
    expect(symbols('H4').every((s) => sym(s).bass !== null)).toBe(true);
    expect(symbols('H5')).toHaveLength(108);
    expect(new Set(symbols('H5').map((s) => sym(s).quality))).toEqual(
      new Set(['dim', 'aug', 'sus2', 'sus4', 'hdim7', 'dim7', 'maj6', 'min6', 'add9']),
    );
  });

  it('covers every root once per quality, each symbol once', () => {
    for (const level of HARMONY_LEVELS) {
      expect(new Set(level.symbols).size, level.id).toBe(level.symbols.length);
    }
    for (const id of ['H2', 'H3', 'H5'] as const) {
      const byQuality = new Map<SymbolQuality, Set<number>>();
      for (const text of symbols(id)) {
        const { root, quality } = sym(text);
        byQuality.set(quality, (byQuality.get(quality) ?? new Set()).add(rootPc(root)));
      }
      for (const roots of byQuality.values()) expect(roots.size).toBe(12);
    }
  });

  it('keys an item by its symbol', () => {
    const level = getHarmonyLevel('H3');
    expect(harmonyLevelItems(level)[0]).toBe('sym:C7');
    expect(harmonyItemInLevel(symbolItem('Dm7'), level)).toBe(true);
    expect(harmonyItemInLevel('sym:Dm', level)).toBe(false);
    expect(harmonyItemInLevel('Dm7', level)).toBe(false);
    expect(parseSymbolItem('sym:F♯m7♭5')?.quality).toBe('hdim7');
    expect(parseSymbolItem('sym:Bb')).toBeNull();
    expect(parseSymbolItem('Dm7')).toBeNull();
    expect(nextHarmonyLevel('H1')).toBe('H2');
    expect(nextHarmonyLevel('H5')).toBeNull();
  });
});
