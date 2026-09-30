import { rootlessSuffix, type ChordSymbol, type SymbolQuality } from '../../core/chordSymbols.ts';
import type { Root } from '../../core/theoryItems.ts';

/**
 * How a symbol is set, as lead sheets set it: the part written on the line after the root (the
 * `m` of a minor chord, `°` and `+`), and the extension raised above it (`7`, `maj7`, `7♭5`,
 * `sus4`, `add9`). Read in sequence, the two are the symbol as written.
 */
const SETTING: Readonly<Record<SymbolQuality, readonly [line: string, raised: string]>> = {
  maj: ['', ''],
  min: ['m', ''],
  dim: ['°', ''],
  aug: ['+', ''],
  sus2: ['', 'sus2'],
  sus4: ['', 'sus4'],
  dom7: ['', '7'],
  maj7: ['', 'maj7'],
  min7: ['m', '7'],
  hdim7: ['m', '7♭5'],
  dim7: ['°', '7'],
  maj6: ['', '6'],
  min6: ['m', '6'],
  add9: ['', 'add9'],
};

const SIGN: Readonly<Record<number, string>> = { [-1]: '♭', 1: '♯' };

function Note({ note }: { note: Root }) {
  const sign = SIGN[note.alter];
  return (
    <>
      {note.step}
      {sign && <span className="sym-sign">{sign}</span>}
    </>
  );
}

/**
 * A quality without its root, set as a symbol sets it (`m`, `°` on the line, `7`, `maj7`, `7♭5`
 * raised) for a heading where no root is asked; the major triad, whose symbol is its root alone,
 * is `maj`. Hidden from assistive technology: the caller says it.
 */
export function QualityText({ quality }: { quality: SymbolQuality }) {
  const [line, raised] = quality === 'maj' ? [rootlessSuffix('maj'), ''] : SETTING[quality];
  return (
    <span className="sym" aria-hidden="true">
      {line && <span className={line === '°' ? 'sym-line sym-degree' : 'sym-line'}>{line}</span>}
      {raised && <span className="sym-raised">{raised}</span>}
    </span>
  );
}

/**
 * A chord symbol typeset: the root and its sign, the quality on the line, the extension raised,
 * a slash and the bass. `label` is what assistive technology reads instead (the symbol in words);
 * without it, the typeset symbol is hidden from it and the caller says it.
 */
export function SymbolText({
  symbol,
  label,
  className,
}: {
  symbol: ChordSymbol;
  label?: string;
  className?: string;
}) {
  const [line, raised] = SETTING[symbol.quality];
  const set = (
    <span className={className ? `sym ${className}` : 'sym'} aria-hidden="true">
      <Note note={symbol.root} />
      {line && <span className={line === '°' ? 'sym-line sym-degree' : 'sym-line'}>{line}</span>}
      {raised && <span className="sym-raised">{raised}</span>}
      {symbol.bass && (
        <span className="sym-bass">
          /<Note note={symbol.bass} />
        </span>
      )}
    </span>
  );
  if (!label) return set;
  return (
    <>
      {set}
      <span className="visually-hidden">{label}</span>
    </>
  );
}
