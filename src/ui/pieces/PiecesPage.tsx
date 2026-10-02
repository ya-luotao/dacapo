import { useEffect } from 'react';
import { useT } from '../../i18n/index.ts';
import { LessonLine } from '../learn/LessonLine.tsx';
import { prefetchVerovio } from '../notation/verovio.ts';
import { Library } from './Library.tsx';
import { NextForYou } from './NextForYou.tsx';
import { usePieceReviews } from './review.ts';
import { ReviewList } from './ReviewList.tsx';
import { usePiecesStanding } from './standing.ts';
import { YourPieces } from './YourPieces.tsx';

export function PiecesPage() {
  const t = useT();
  // The notation engine is large: fetch it while the user looks through the library.
  useEffect(prefetchVerovio, []);
  // A piece played to its end is in review: whoever has one knows the library (LessonLine).
  const { reviews, loading } = usePieceReviews();
  // Where the pieces stand: the piece in hand or the next one, and each grade's pieces played.
  const standing = usePiecesStanding();

  return (
    <section className="pieces">
      <h1>{t('pieces.title')}</h1>
      <p className="muted pieces-intro">{t('pieces.intro')}</p>
      <LessonLine practice="pieces" known={loading || reviews.length > 0} />
      <ReviewList />
      <NextForYou standing={standing} />
      <Library finished={standing?.finished ?? null} />
      <YourPieces />
    </section>
  );
}
