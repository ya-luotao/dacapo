import { useId } from 'react';
import { Link } from 'wouter';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import type { PiecesStanding } from '../../core/piecesStanding.ts';
import { daysBetween } from '../../core/review.ts';
import { dayKey, type DayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { builtInPiece, type PieceLevel } from '../../pieces/library/index.ts';
import { usePractice } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { piecePath } from '../startParams.ts';
import { usePieceFormat } from './format.ts';
import { useSteadyBars } from './steady.ts';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/** A piece as its row names it: built-in or imported. */
interface RowPiece {
  id: string;
  title: string;
  composer: string;
  /** Null for an imported piece whose facts are not kept yet. */
  facts: PieceFacts | null;
  /** A built-in piece's grade. */
  level: PieceLevel | null;
}

function usePieceOf(id: string | null): RowPiece | null {
  const t = useT();
  const { pieces } = usePractice();
  if (id === null) return null;
  const builtIn = builtInPiece(id);
  if (builtIn)
    return {
      id: builtIn.id,
      title: t(`library.${builtIn.id}.title`),
      composer: t(`library.${builtIn.id}.composer`),
      facts: builtIn.facts,
      level: builtIn.level,
    };
  const stored = pieces.find((piece) => piece.id === id);
  if (!stored) return null;
  return {
    id,
    title: stored.title || t('pieces.untitled'),
    composer: stored.composer,
    facts: stored.facts ?? null,
    level: null,
  };
}

/**
 * Next for you (docs/PIECES.md, G5b): one row above the library. The piece in hand, with when it
 * was last played, its bars steady and the way on; else the piece to begin next, with its grade
 * and length. Nothing when there is neither. Its place is kept while the records are read, so
 * the library under it does not move.
 */
export function NextForYou({ standing }: { standing: PiecesStanding | null }) {
  const t = useT();
  const id = useId();
  const inHand = usePieceOf(standing?.inHand?.id ?? null);
  const next = usePieceOf(standing?.next ?? null);
  if (standing && !inHand && !next) return null;

  return (
    <section className="review-due next-piece" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('pieces.next.title')}</h2>
      {inHand && standing?.inHand ? (
        <InHand piece={inHand} day={standing.inHand.day} />
      ) : next ? (
        <NextPiece piece={next} />
      ) : (
        <Waiting />
      )}
    </section>
  );
}

/** The row's place, while what it says is being read. */
function Waiting() {
  const t = useT();
  return (
    <div className="next-piece-waiting" role="status">
      <span className="visually-hidden">{t('storage.loading')}</span>
    </div>
  );
}

function Row({
  piece,
  line,
  action,
}: {
  piece: RowPiece;
  line: string;
  /** The way on: its words, and where it goes. */
  action: { label: string; href: string };
}) {
  return (
    <ul className="library-list review-list">
      <li className="your-piece">
        <div className="your-piece-row">
          <Link href={piecePath(piece.id)} className="library-piece">
            <span className="library-piece-title">{piece.title}</span>
            {piece.composer && <span className="library-piece-composer">{piece.composer}</span>}
            <span className="library-piece-progress">{line}</span>
          </Link>
          <div className="your-piece-actions">
            <Link href={action.href} className="home-link">
              {action.label}
              <Arrow />
            </Link>
          </div>
        </div>
      </li>
    </ul>
  );
}

/** The piece in hand: when it was last played and its bars steady, and Continue. */
function InHand({ piece, day }: { piece: RowPiece; day: DayKey }) {
  const t = useT();
  const today = dayKey(useNow());
  const days = daysBetween(day, today);
  const last =
    days <= 0
      ? t('pieces.next.today')
      : days === 1
        ? t('today.why.inHand.one')
        : t('today.why.inHand.other', { n: days });
  return piece.facts ? (
    <InHandSteady piece={piece} facts={piece.facts} last={last} />
  ) : (
    <Row
      piece={piece}
      line={last}
      action={{ label: t('pieces.next.continue'), href: piecePath(piece.id) }}
    />
  );
}

/** The row once the piece's step records are in: its steady bars are told by them. */
function InHandSteady({
  piece,
  facts,
  last,
}: {
  piece: RowPiece;
  facts: PieceFacts;
  last: string;
}) {
  const t = useT();
  const steady = useSteadyBars(piece.id, facts);
  if (steady === null) return <Waiting />;
  const bars = t('pieces.progress.steady', {
    n: steady.steady,
    m: steady.of,
    hands: t(`pieces.progress.hands.${steady.hands}`),
  });
  return (
    <Row
      piece={piece}
      line={[last, bars].join(' · ')}
      action={{ label: t('pieces.next.continue'), href: piecePath(piece.id) }}
    />
  );
}

/** The piece to begin next: its grade and its length, and Begin. */
function NextPiece({ piece }: { piece: RowPiece }) {
  const t = useT();
  const format = usePieceFormat();
  const facts = [
    ...(piece.level === null ? [] : [format.level(piece.level)]),
    ...(piece.facts ? [t('pieces.next.bars', { n: piece.facts.bars.both })] : []),
  ];
  return (
    <Row
      piece={piece}
      line={facts.join(' · ')}
      action={{ label: t('pieces.next.begin'), href: piecePath(piece.id) }}
    />
  );
}
