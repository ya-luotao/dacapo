import { useId } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN, type BuiltInPiece } from '../../pieces/library/index.ts';
import { usePieceFormat } from './format.ts';
import { PieceProgress } from './PieceProgress.tsx';

/**
 * The built-in pieces, by level, like the contents page of a method book, each grade's heading
 * with how many of its pieces were played to the end (docs/PIECES.md, "Next for you"; `finished`,
 * null while the records are read); then the lead sheets under a heading of their own
 * (docs/HARMONY.md, "Lead sheets (H3)"), the easiest first, each with its level.
 */
export function Library({ finished }: { finished: ReadonlySet<string> | null }) {
  const t = useT();
  const format = usePieceFormat();
  const id = useId();
  const pieces = BUILT_IN.filter((p) => !p.leadSheet);
  const leadSheets = BUILT_IN.filter((p) => p.leadSheet).sort((a, b) => a.level - b.level);
  const levels = [...new Set(pieces.map((p) => p.level))].sort((a, b) => a - b);

  return (
    <section className="library" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="visually-hidden">
        {t('pieces.library')}
      </h2>
      {levels.map((level) => (
        <Group
          key={level}
          label={format.level(level)}
          pieces={pieces.filter((p) => p.level === level)}
          finished={finished}
        />
      ))}
      {leadSheets.length > 0 && (
        <Group
          label={t('pieces.leadSheets')}
          help={t('pieces.leadSheets.help')}
          pieces={leadSheets}
          level={(piece) => format.level(piece.level)}
        />
      )}
      <p className="help library-help">{t('pieces.levels.help')}</p>
    </section>
  );
}

function Group({
  label,
  help,
  pieces,
  level,
  finished,
}: {
  label: string;
  /** A line over the list saying what the group holds. */
  help?: string;
  pieces: readonly BuiltInPiece[];
  /** Each piece's level, where the heading does not say it. */
  level?: (piece: BuiltInPiece) => string;
  /** A grade: the pieces played to their end, for its heading's count ("2 of 6"). */
  finished?: ReadonlySet<string> | null;
}) {
  const t = useT();
  const id = useId();
  const count = finished && {
    n: pieces.filter((piece) => finished.has(piece.id)).length,
    m: pieces.length,
  };
  return (
    <section className="library-level" aria-labelledby={id}>
      <h3 id={id} className="library-level-name">
        {count ? (
          <>
            <span aria-hidden="true">
              {label}
              <span className="library-level-played">{t('pieces.level.played', count)}</span>
            </span>
            <span className="visually-hidden">
              {t('pieces.level.played.label', { level: label, ...count })}
            </span>
          </>
        ) : (
          label
        )}
      </h3>
      <div>
        {help && <p className="library-level-help">{help}</p>}
        <ul className="library-list">
          {pieces.map((piece) => (
            <li key={piece.id}>
              <Link href={`/pieces/${piece.id}`} className="library-piece">
                <span className="library-piece-title">{t(`library.${piece.id}.title`)}</span>
                <span className="library-piece-composer">{t(`library.${piece.id}.composer`)}</span>
                <span className="library-piece-style">
                  {level && `${level(piece)} · `}
                  {t(`library.${piece.id}.style`)}
                </span>
                <span className="library-piece-note">{t(`library.${piece.id}.note`)}</span>
                <PieceProgress pieceId={piece.id} facts={piece.facts} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
