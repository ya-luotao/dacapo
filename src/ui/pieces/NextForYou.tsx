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
import { piecePath, pieceStartPath } from '../startParams.ts';
import { usePieceFormat } from './format.ts';
import { useNextStep } from './planSource.ts';
import { usePlanWords } from './planWords.ts';
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
 * was last played, its bars steady and the next step of its plan as the way on (G5c); else the
 * piece to begin next, with its grade and length. Nothing when there is neither. Its place is
 * kept while the records and the piece in hand's score are read, so the library under it does
 * not move.
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

type Way = { label: string; href: string };

/**
 * The piece in hand: when it was last played and its bars steady, and Continue with the next
 * step of its plan, which the link opens. A piece whose score cannot be read is opened as it was
 * left.
 */
function InHand({ piece, day }: { piece: RowPiece; day: DayKey }) {
  const t = useT();
  const words = usePlanWords();
  const today = dayKey(useNow());
  const days = daysBetween(day, today);
  const last =
    days <= 0
      ? t('pieces.next.today')
      : days === 1
        ? t('today.why.inHand.one')
        : t('today.why.inHand.other', { n: days });
  const step = useNextStep(piece.id);
  const way: Way | null =
    step === undefined
      ? null
      : step
        ? {
            label: t('pieces.next.continue.step', { step: words.step(step) }),
            href: pieceStartPath(piece.id, step),
          }
        : { label: t('pieces.next.continue'), href: piecePath(piece.id) };
  if (piece.facts) return <InHandSteady piece={piece} facts={piece.facts} last={last} way={way} />;
  return way ? <Row piece={piece} line={last} action={way} /> : <Waiting />;
}

/** The row once the piece's step records are in: its steady bars are told by them. */
function InHandSteady({
  piece,
  facts,
  last,
  way,
}: {
  piece: RowPiece;
  facts: PieceFacts;
  last: string;
  /** Null while the plan's step is being read. */
  way: Way | null;
}) {
  const t = useT();
  const steady = useSteadyBars(piece.id, facts);
  if (steady === null || way === null) return <Waiting />;
  const bars = t('pieces.progress.steady', {
    n: steady.steady,
    m: steady.of,
    hands: t(`pieces.progress.hands.${steady.hands}`),
  });
  return <Row piece={piece} line={[last, bars].join(' · ')} action={way} />;
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
