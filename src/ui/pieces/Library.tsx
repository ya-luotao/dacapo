import { useId } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN, type BuiltInPiece } from '../../pieces/library/index.ts';
import { usePieceFormat } from './format.ts';
import { PieceProgress } from './PieceProgress.tsx';

/**
 * The built-in pieces, by level, like the contents page of a method book; then the lead sheets
 * under a heading of their own (docs/HARMONY.md, "Lead sheets (H3)"), the easiest first, each
 * with its level.
 */
export function Library() {
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
}: {
  label: string;
  /** A line over the list saying what the group holds. */
  help?: string;
  pieces: readonly BuiltInPiece[];
  /** Each piece's level, where the heading does not say it. */
  level?: (piece: BuiltInPiece) => string;
}) {
  const t = useT();
  const id = useId();
  return (
    <section className="library-level" aria-labelledby={id}>
      <h3 id={id} className="library-level-name">
        {label}
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
