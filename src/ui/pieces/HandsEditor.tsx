import { useId, useMemo, useState } from 'react';
import { staffKey, type Hand, type StaffHands } from '../../core/score.ts';
import type { StoredPiece } from '../../core/storedPiece.ts';
import { useT } from '../../i18n/index.ts';
import { readScore } from '../../pieces/load.ts';

type Choice = Hand | 'none';

/**
 * Which hand plays each staff of an imported piece. `onDone` gets the new override (null: as
 * detected), or undefined when cancelled.
 */
export function HandsEditor({
  piece,
  onDone,
}: {
  piece: StoredPiece;
  onDone: (hands: StaffHands | null | undefined) => void;
}) {
  const t = useT();
  const id = useId();
  const detected = useMemo(() => {
    try {
      return readScore(piece.xml);
    } catch {
      return null;
    }
  }, [piece.xml]);
  const [choices, setChoices] = useState<Record<string, Choice>>(() => {
    const out: Record<string, Choice> = {};
    for (const [key, hand] of Object.entries(detected?.hands ?? {}))
      out[key] = (piece.hands && key in piece.hands ? piece.hands[key] : hand) ?? 'none';
    return out;
  });
  if (!detected) return null;

  const staves = detected.parts.flatMap((part) =>
    Array.from({ length: part.staves }, (_, i) => ({
      key: staffKey(part.index, i + 1),
      label: t('pieces.hands.staff', {
        part: part.name || t('pieces.hands.part', { n: part.index + 1 }),
        n: i + 1,
      }),
    })),
  );

  return (
    <form
      className="your-piece-panel hands"
      onSubmit={(e) => {
        e.preventDefault();
        const hands: Record<string, Hand | null> = {};
        for (const [key, choice] of Object.entries(choices))
          hands[key] = choice === 'none' ? null : choice;
        const same = Object.entries(hands).every(([key, hand]) => detected.hands[key] === hand);
        onDone(same ? null : hands);
      }}
      aria-describedby={`${id}-help`}
    >
      <p id={`${id}-help`} className="help">
        {t('pieces.hands.help')}
      </p>
      <div className="hands-grid">
        {staves.map(({ key, label }) => (
          <label key={key} className="hands-row">
            <span>{label}</span>
            <select
              value={choices[key] ?? 'none'}
              onChange={(e) => setChoices({ ...choices, [key]: e.target.value as Choice })}
            >
              <option value="right">{t('pieces.hands.right')}</option>
              <option value="left">{t('pieces.hands.left')}</option>
              <option value="none">{t('pieces.hands.none')}</option>
            </select>
          </label>
        ))}
      </div>
      <div className="actions">
        <button type="submit" className="button button-primary">
          {t('pieces.save')}
        </button>
        <button type="button" className="button" onClick={() => onDone(null)}>
          {t('pieces.hands.detected')}
        </button>
        <button type="button" className="button" onClick={() => onDone(undefined)}>
          {t('pieces.cancel')}
        </button>
      </div>
    </form>
  );
}
