import { useId, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { fitsKeys, isFullKeys } from '../../core/instrument.ts';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN, type BuiltInPiece } from '../../pieces/library/index.ts';
import incipits from '../../pieces/library/incipits.json';
import { useInstrumentKeys } from '../instrument.ts';
import { usePractice } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { PieceBeyond } from './PieceBeyond.tsx';
import { PieceProgress } from './PieceProgress.tsx';

type StatusFilter = 'all' | 'started' | 'finished';

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
  const { sessions } = usePractice();
  const keys = useInstrumentKeys();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [onlyFits, setOnlyFits] = useState(false);

  const narrowKeys = !isFullKeys(keys);
  const activeOnlyFits = narrowKeys && onlyFits;
  const needle = query.trim().toLowerCase();
  const hasFilter = needle !== '' || status !== 'all' || activeOnlyFits;

  const started = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sessions) {
      if (s.kind === 'piece') ids.add(s.pieceId);
    }
    return ids;
  }, [sessions]);

  const matches = (piece: BuiltInPiece): boolean => {
    if (needle) {
      const hay = [
        t(`library.${piece.id}.title`),
        t(`library.${piece.id}.composer`),
        t(`library.${piece.id}.style`),
      ];
      if (!hay.some((text) => text.toLowerCase().includes(needle))) return false;
    }
    if (status === 'finished' && !finished?.has(piece.id)) return false;
    if (status === 'started' && (!started.has(piece.id) || finished?.has(piece.id))) return false;
    if (activeOnlyFits && piece.facts.keys && !fitsKeys(piece.facts.keys, keys)) return false;
    return true;
  };

  const pieces = BUILT_IN.filter((p) => !p.leadSheet);
  const leadSheets = BUILT_IN.filter((p) => p.leadSheet).sort((a, b) => a.level - b.level);
  const levels = [...new Set(pieces.map((p) => p.level))].sort((a, b) => a - b);
  const visibleLevels = levels
    .map((level) => ({
      level,
      pieces: pieces.filter((p) => p.level === level && (!hasFilter || matches(p))),
    }))
    .filter((group) => group.pieces.length > 0);
  const visibleLeadSheets = hasFilter ? leadSheets.filter(matches) : leadSheets;
  const totalVisible =
    visibleLevels.reduce((n, group) => n + group.pieces.length, 0) + visibleLeadSheets.length;

  return (
    <section className="library" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="visually-hidden">
        {t('pieces.library')}
      </h2>
      <div className="library-filter">
        <input
          type="search"
          className="library-filter-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pieces.filter.search')}
          aria-label={t('pieces.filter.search')}
        />
        <div className="filter-pills">
          {(
            [
              ['all', 'pieces.filter.all'],
              ['started', 'pieces.filter.started'],
              ['finished', 'pieces.filter.finished'],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              className="filter-pill"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        {narrowKeys && (
          <label className="check library-filter-fits">
            <input
              type="checkbox"
              checked={onlyFits}
              onChange={(e) => setOnlyFits(e.target.checked)}
            />
            <span>{t('pieces.filter.fits')}</span>
          </label>
        )}
      </div>
      {totalVisible === 0 && hasFilter ? (
        <div className="library-empty">
          <p className="muted">{t('pieces.filter.empty')}</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setQuery('');
              setStatus('all');
              setOnlyFits(false);
            }}
          >
            {t('pieces.filter.reset')}
          </button>
        </div>
      ) : (
        <>
          {visibleLevels.map((group) => (
            <Group
              key={group.level}
              label={format.level(group.level)}
              pieces={group.pieces}
              finished={finished}
            />
          ))}
          {visibleLeadSheets.length > 0 && (
            <Group
              label={t('pieces.leadSheets')}
              help={t('pieces.leadSheets.help')}
              pieces={visibleLeadSheets}
              level={(piece) => format.level(piece.level)}
            />
          )}
        </>
      )}
      <p className="help library-help">{t('pieces.levels.help')}</p>
    </section>
  );
}

/**
 * A piece's first bars, as a catalogue prints them beside its title (docs/PIECES.md, "Incipits"):
 * engraved in advance, and drawn in the page's ink through the image as a mask, so that they
 * follow the theme. Its size is known before the image arrives, so the list never moves.
 */
function Incipit({ id }: { id: string }) {
  const size = (incipits as Record<string, number[] | undefined>)[id];
  if (!size) return null;
  const url = `url("${import.meta.env.BASE_URL}incipits/${id}.svg")`;
  return (
    <span
      className="library-piece-incipit"
      aria-hidden="true"
      style={{ aspectRatio: `${size[0]} / ${size[1]}`, maskImage: url, WebkitMaskImage: url }}
    />
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
                <span className="library-piece-text">
                  <span className="library-piece-title">{t(`library.${piece.id}.title`)}</span>
                  <span className="library-piece-composer">
                    {t(`library.${piece.id}.composer`)}
                  </span>
                  <span className="library-piece-style">
                    {level && `${level(piece)} · `}
                    {t(`library.${piece.id}.style`)}
                  </span>
                  <span className="library-piece-note">{t(`library.${piece.id}.note`)}</span>
                  <PieceBeyond facts={piece.facts} />
                  <PieceProgress pieceId={piece.id} facts={piece.facts} />
                </span>
                <Incipit id={piece.id} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
