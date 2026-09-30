import { useEffect, useId, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { pieceFacts, type PieceFacts } from '../../core/pieceRecords.ts';
import {
  keyTonic,
  parseProgressionPieceId,
  PATTERN_IDS,
  PROGRESSION_IDS,
  PROGRESSIONS,
  progressionKeys,
  progressionPieceId,
  type ProgressionSpec,
} from '../../core/progressions.ts';
import { PROGRESSION_HANDS, progressionXml } from '../../core/progressionXml.ts';
import { useT } from '../../i18n/index.ts';
import { readScore } from '../../pieces/load.ts';
import { prefetchVerovio } from '../notation/verovio.ts';
import { PieceProgress } from '../pieces/PieceProgress.tsx';
import { writePiecePrefs } from '../pieces/prefs.ts';
import { usePractice } from '../practice/context.ts';
import { Segmented } from '../Segmented.tsx';
import { tonicName } from '../scales/format.ts';
import {
  PROGRESSION_TEMPOS,
  prefsKey,
  readProgressionTempo,
  writeProgressionTempo,
  type HarmonyPrefs,
} from './prefs.ts';
import { NumeralsText } from './NumeralsText.tsx';
import { keySymbols, progressionPath, useProgressionFormat } from './progressionFormat.ts';

interface ProgressionsSetupProps {
  prefs: HarmonyPrefs;
  onPrefs: (patch: Partial<HarmonyPrefs>) => void;
}

/** A key's name on its button: `F♯`, `B♭`, and a minor key's as `f♯` would be too small: `F♯m`. */
const keyLabel = (key: string) => {
  const { tonic, mode } = keyTonic(key);
  return `${tonicName(tonic)}${mode === 'minor' ? 'm' : ''}`;
};

/**
 * Progressions (docs/HARMONY.md, "Progressions (H2)"): a progression, a key round the circle of
 * fifths, the left hand's pattern and a tempo; practising opens the score as a piece. Below, the
 * progressions practised lately, each with how it went.
 */
export function ProgressionsSetup({ prefs, onPrefs }: ProgressionsSetupProps) {
  const t = useT();
  const format = useProgressionFormat();
  const id = useId();
  const [, navigate] = useLocation();
  const progression = PROGRESSIONS[prefs.progression];
  const key = prefsKey(prefs);
  const spec: ProgressionSpec = { progression: prefs.progression, key, pattern: prefs.pattern };
  // The score is drawn by Verovio: fetch it while the user chooses.
  useEffect(prefetchVerovio, []);

  function start() {
    const pieceId = progressionPieceId(spec);
    writeProgressionTempo(pieceId, prefs.bpm);
    // The tempo chosen here is the one practised at: the session's own control starts at 100 %.
    writePiecePrefs(pieceId, { tempo: 100 });
    navigate(progressionPath(spec));
  }

  return (
    <>
      <form
        className="read-setup progression-setup"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <div className="progression-choose">
          <fieldset className="field">
            <legend>{t('harmony.progression')}</legend>
            <div className="levels progressions">
              {PROGRESSION_IDS.map((p) => {
                const checked = p === prefs.progression;
                const mode = PROGRESSIONS[p].mode;
                const inKey = mode === progression.mode ? key : progressionKeys(mode)[0]!;
                return (
                  <label key={p} className={checked ? 'level is-checked' : 'level'}>
                    <input
                      type="radio"
                      name={`${id}-progression`}
                      value={p}
                      checked={checked}
                      onChange={() => onPrefs({ progression: p })}
                    />
                    <span className="level-id progression-numerals">
                      <NumeralsText id={p} />
                    </span>
                    <span className="level-body">
                      <span className="level-name">{format.name(p)}</span>
                      <span className="level-range">
                        {t('harmony.progression.inKey', {
                          key: format.key(inKey),
                          chords: keySymbols(p, inKey),
                        })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Segmented
            legend={t('harmony.key')}
            name={`${id}-key`}
            className="progression-keys"
            options={progressionKeys(progression.mode).map((k) => ({
              value: k,
              label: <span aria-label={format.key(k)}>{keyLabel(k)}</span>,
            }))}
            value={key}
            onChange={(k) =>
              onPrefs(progression.mode === 'major' ? { majorKey: k } : { minorKey: k })
            }
            help={t('harmony.key.help')}
          />

          <fieldset className="field">
            <legend>{t('harmony.pattern')}</legend>
            <div className="levels patterns">
              {PATTERN_IDS.map((pattern) => {
                const checked = pattern === prefs.pattern;
                return (
                  <label key={pattern} className={checked ? 'level is-checked' : 'level'}>
                    <input
                      type="radio"
                      name={`${id}-pattern`}
                      value={pattern}
                      checked={checked}
                      onChange={() => onPrefs({ pattern })}
                    />
                    <span className="level-body">
                      <span className="level-name">{format.pattern(pattern)}</span>
                      <span className="level-range">{format.patternDetail(pattern)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="read-options">
          <p className="read-options-level progression-chosen" aria-hidden="true">
            <NumeralsText id={prefs.progression} />
            <span className="progression-chosen-pattern">
              {t('harmony.progression.chosen', {
                key: format.key(key),
                pattern: format.pattern(prefs.pattern),
              })}
            </span>
          </p>
          <Segmented
            legend={t('harmony.tempo')}
            name={`${id}-tempo`}
            className="progression-tempo"
            options={PROGRESSION_TEMPOS.map((bpm) => ({ value: bpm, label: String(bpm) }))}
            value={prefs.bpm}
            onChange={(bpm) => onPrefs({ bpm })}
            help={t('harmony.tempo.help')}
          />
          <button type="submit" className="button button-primary read-start">
            {t('harmony.progression.start')}
          </button>
        </div>
      </form>
      <YourProgressions />
    </>
  );
}

/** How many progressions "Your progressions" lists. */
const YOURS = 8;

/** The progressions practised, the latest first, each with its piece's progress line. */
function YourProgressions() {
  const t = useT();
  const id = useId();
  const format = useProgressionFormat();
  const { sessions } = usePractice();
  const yours = useMemo(() => {
    const last = new Map<string, number>();
    for (const s of sessions) {
      if (s.kind !== 'piece' || !parseProgressionPieceId(s.pieceId)) continue;
      last.set(s.pieceId, Math.max(last.get(s.pieceId) ?? 0, s.endedAt));
    }
    return [...last.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, YOURS)
      .map(([pieceId]) => {
        const spec = parseProgressionPieceId(pieceId)!;
        let facts: PieceFacts | undefined;
        try {
          facts = pieceFacts(readScore(progressionXml(spec), PROGRESSION_HANDS));
        } catch {
          facts = undefined;
        }
        return { pieceId, spec, facts };
      });
  }, [sessions]);

  return (
    <section className="progression-yours" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('harmony.yours')}</h3>
      {yours.length === 0 ? (
        <p className="muted">{t('harmony.yours.empty')}</p>
      ) : (
        <ul className="library-list">
          {yours.map(({ pieceId, spec, facts }) => (
            <li key={pieceId}>
              <Link href={progressionPath(spec)} className="library-piece">
                <span className="library-piece-title">{format.title(spec)}</span>
                <span className="library-piece-composer">
                  {t('harmony.progression.piece.detail', {
                    pattern: format.pattern(spec.pattern),
                    tempo: t('harmony.tempo.bpm', { bpm: readProgressionTempo(pieceId) }),
                  })}
                </span>
                <PieceProgress pieceId={pieceId} facts={facts} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
