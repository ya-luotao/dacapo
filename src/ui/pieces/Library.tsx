import { useId } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN, type BuiltInPiece, type PieceLevel } from '../../pieces/library/index.ts';
import { usePieceFormat } from './format.ts';

/** The built-in pieces, by level, like the contents page of a method book. */
export function Library() {
  const t = useT();
  const format = usePieceFormat();
  const id = useId();
  const levels = [...new Set(BUILT_IN.map((p) => p.level))].sort((a, b) => a - b);

  return (
    <section className="library" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="visually-hidden">
        {t('pieces.library')}
      </h2>
      {levels.map((level) => (
        <LevelGroup
          key={level}
          label={format.level(level)}
          pieces={BUILT_IN.filter((p) => p.level === level)}
          level={level}
        />
      ))}
      <p className="help library-help">{t('pieces.levels.help')}</p>
    </section>
  );
}

function LevelGroup({
  label,
  pieces,
  level,
}: {
  label: string;
  pieces: readonly BuiltInPiece[];
  level: PieceLevel;
}) {
  const t = useT();
  const id = useId();
  return (
    <section className="library-level" aria-labelledby={id} data-level={level}>
      <h3 id={id} className="library-level-name">
        {label}
      </h3>
      <ul className="library-list">
        {pieces.map((piece) => (
          <li key={piece.id}>
            <Link href={`/pieces/${piece.id}`} className="library-piece">
              <span className="library-piece-title">{t(`library.${piece.id}.title`)}</span>
              <span className="library-piece-composer">{t(`library.${piece.id}.composer`)}</span>
              <span className="library-piece-note">{t(`library.${piece.id}.note`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
