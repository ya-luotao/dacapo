import { useId, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { fitsKeys, isFullKeys } from '../../core/instrument.ts';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN, type BuiltInPiece } from '../../pieces/library/index.ts';
import incipits from '../../pieces/library/incipits.json';
import { useInstrumentKeys } from '../instrument.ts';
import { usePieceFormat } from './format.ts';
import { PieceBeyond } from './PieceBeyond.tsx';
import { PieceProgress } from './PieceProgress.tsx';

type StatusFilter = 'all' | 'unplayed' | 'played';

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
  const keys = useInstrumentKeys();
  const narrowKeys = !isFullKeys(keys);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [onlyFits, setOnlyFits] = useState(false);

  const pieces = BUILT_IN.filter((p) => !p.leadSheet);
  const leadSheets = BUILT_IN.filter((p) => p.leadSheet).sort((a, b) => a.level - b.level);
  const levels = [...new Set(pieces.map((p) => p.level))].sort((a, b) => a - b);

  const normalizedQuery = query.trim().toLowerCase();
  const activeFilter = finished ? filter : 'all';
  const activeOnlyFits = narrowKeys && onlyFits;

  const matches = useMemo(
    () => (piece: BuiltInPiece) => {
      if (activeFilter === 'played' && !finished?.has(piece.id)) return false;
      if (activeFilter === 'unplayed' && finished?.has(piece.id)) return false;
      if (activeOnlyFits && piece.facts.keys && !fitsKeys(piece.facts.keys, keys)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        t(`library.${piece.id}.title`),
        t(`library.${piece.id}.composer`),
        t(`library.${piece.id}.style`),
        t(`library.${piece.id}.note`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    },
    [activeFilter, activeOnlyFits, finished, keys, normalizedQuery, t],
  );

  const levelGroups = levels
    .map((level) => {
      const all = pieces.filter((p) => p.level === level);
      const shown = all.filter(matches);
      return {
        level,
        shown,
        count: finished && {
          n: all.filter((piece) => finished.has(piece.id)).length,
          m: all.length,
        },
      };
    })
    .filter((group) => group.shown.length > 0);
  const shownLeadSheets = leadSheets.filter(matches);
  const nothingShown = levelGroups.length === 0 && shownLeadSheets.length === 0;

  return (
    <section className="library" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="visually-hidden">
        {t('pieces.library')}
      </h2>
      <div className="library-toolbar">
        <div className="library-search">
          <input
            type="search"
            className="library-search-input"
            aria-label={t('pieces.library.search')}
            placeholder={t('pieces.library.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="button-icon library-search-clear"
              aria-label={t('pieces.library.search.clear')}
              title={t('pieces.library.search.clear')}
              onClick={() => setQuery('')}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
        {finished && (
          <fieldset className="library-filter">
            <legend className="visually-hidden">{t('pieces.library.filter')}</legend>
            <div className="segmented is-compact">
              {(['all', 'unplayed', 'played'] as const).map((choice) => (
                <label key={choice}>
                  <input
                    type="radio"
                    name={`${id}-filter`}
                    value={choice}
                    checked={filter === choice}
                    onChange={() => setFilter(choice)}
                  />
                  <span>{t(`pieces.library.filter.${choice}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
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
      {nothingShown ? (
        <p className="muted library-empty">{t('pieces.library.empty')}</p>
      ) : (
        <>
          {levelGroups.map(({ level, shown, count }) => (
            <Group key={level} label={format.level(level)} pieces={shown} count={count} />
          ))}
          {shownLeadSheets.length > 0 && (
            <Group
              label={t('pieces.leadSheets')}
              help={t('pieces.leadSheets.help')}
              pieces={shownLeadSheets}
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
  count,
}: {
  label: string;
  /** A line over the list saying what the group holds. */
  help?: string;
  pieces: readonly BuiltInPiece[];
  /** Each piece's level, where the heading does not say it. */
  level?: (piece: BuiltInPiece) => string;
  /** A grade: the pieces played to their end out of all pieces in the grade ("2 of 6"). */
  count?: { n: number; m: number } | null;
}) {
  const t = useT();
  const id = useId();
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
