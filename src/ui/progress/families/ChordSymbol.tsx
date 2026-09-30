import type { ChordQuality, Inversion } from '../../../core/earItems.ts';

/** A chord's quality as a chord symbol, without its root: M, m, °, +, 7, M7, m7, ø7. */
const CHORD_SYMBOL: Readonly<Record<ChordQuality, string>> = {
  maj: 'M',
  min: 'm',
  dim: '°',
  aug: '+',
  dom7: '7',
  maj7: 'M7',
  min7: 'm7',
  hdim7: 'ø7',
};

/** A chord in a cell's heading: its symbol, and its inversion as figured bass (⁶, ⁶₄). */
export function ChordSymbol({
  quality,
  inversion,
}: {
  quality: ChordQuality;
  inversion: Inversion;
}) {
  return (
    <>
      {CHORD_SYMBOL[quality]}
      {inversion !== 'root' && (
        <span className="cm-figures">
          <span>6</span>
          {inversion === '2nd' && <span>4</span>}
        </span>
      )}
    </>
  );
}
