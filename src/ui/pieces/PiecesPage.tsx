import { useEffect } from 'react';
import { useT } from '../../i18n/index.ts';
import { prefetchVerovio } from '../notation/verovio.ts';
import { Library } from './Library.tsx';
import { YourPieces } from './YourPieces.tsx';

export function PiecesPage() {
  const t = useT();
  // The notation engine is large: fetch it while the user looks through the library.
  useEffect(prefetchVerovio, []);

  return (
    <section className="pieces">
      <h1>{t('pieces.title')}</h1>
      <p className="muted pieces-intro">{t('pieces.intro')}</p>
      <Library />
      <YourPieces />
    </section>
  );
}
