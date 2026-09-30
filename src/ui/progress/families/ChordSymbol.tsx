import type { ChordQuality, Inversion } from '../../../core/earItems.ts';
import { QualityText } from '../../harmony/SymbolText.tsx';

/**
 * A chord in a cell's heading: its quality as the Harmony page writes a symbol, without its root
 * (maj, m, °, +, 7, maj7, m7, m7♭5), and its inversion as figured bass (⁶, ⁶₄).
 */
export function ChordSymbol({
  quality,
  inversion,
}: {
  quality: ChordQuality;
  inversion: Inversion;
}) {
  return (
    <>
      <QualityText quality={quality} />
      {inversion !== 'root' && (
        <span className="cm-figures">
          <span>6</span>
          {inversion === '2nd' && <span>4</span>}
        </span>
      )}
    </>
  );
}
