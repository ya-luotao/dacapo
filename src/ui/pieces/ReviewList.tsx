import { useId } from 'react';
import { Link } from 'wouter';
import { REVIEW_INTERVALS } from '../../core/review.ts';
import { useI18n, useT } from '../../i18n/index.ts';
import { usePracticeStore } from '../practice/context.ts';
import { usePieceReviews, useSinceLabel } from './review.ts';

/**
 * Due for review (docs/PIECES.md, "Review schedule"): the pieces whose date has come, first on the
 * Pieces page, each with how long it has been and a way to take it out of review.
 */
export function ReviewList() {
  const t = useT();
  const { locale } = useI18n();
  const id = useId();
  const store = usePracticeStore();
  const { reviews } = usePieceReviews();
  const since = useSinceLabel();
  const due = reviews.filter((r) => r.status.isDue && !r.out);
  if (due.length === 0) return null;
  const list = new Intl.ListFormat(locale, { type: 'conjunction' });

  return (
    <section className="review-due" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('pieces.review.title')}</h2>
      <p className="help">
        {t('pieces.review.help', {
          days: list.format(REVIEW_INTERVALS.map((d) => String(d))),
        })}
      </p>
      <ul className="library-list review-list">
        {due.map((review) => (
          <li key={review.pieceId} className="your-piece">
            <div className="your-piece-row">
              <Link href={`/pieces/${review.pieceId}`} className="library-piece">
                <span className="library-piece-title">{review.title}</span>
                {review.composer && (
                  <span className="library-piece-composer">{review.composer}</span>
                )}
                <span className="library-piece-progress">{since(review)}</span>
              </Link>
              <div className="your-piece-actions">
                <button
                  type="button"
                  className="button-link"
                  aria-label={t('pieces.review.takeOut.label', { title: review.title })}
                  onClick={() => store.setPieceReview(review.pieceId, false)}
                >
                  {t('pieces.review.takeOut')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
