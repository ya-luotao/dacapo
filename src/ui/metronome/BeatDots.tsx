import { useId, type Ref } from 'react';
import type { BeatAccent, Subdivision } from '../../core/pulse.ts';
import { useT } from '../../i18n/index.ts';

/**
 * The beats of the bar: a dot each (large for an accent, hollow for a muted beat) with the
 * subdivisions between. With `onCycle` each dot is a button that turns it accented, muted or
 * plain again.
 */
export function BeatDots({
  accents,
  subdivision,
  onCycle,
  help,
  ref,
  className,
}: {
  accents: readonly BeatAccent[];
  subdivision: Subdivision;
  onCycle?: (beat: number) => void;
  /** How to change the beats: a tooltip and the group's description. */
  help?: string;
  ref?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const t = useT();
  const id = useId();
  return (
    <div
      className={className ?? 'beat-dots'}
      ref={ref}
      role={onCycle ? 'group' : undefined}
      aria-label={onCycle ? t('metronome.beats') : undefined}
      aria-describedby={help ? `${id}-help` : undefined}
      aria-hidden={onCycle ? undefined : true}
      title={help}
    >
      {help && (
        <span id={`${id}-help`} className="visually-hidden">
          {help}
        </span>
      )}
      {accents.map((accent, i) => {
        const subs = Array.from({ length: subdivision - 1 }, (_, k) => (
          <span key={k} className="beat-sub" data-beat={i} data-sub={k + 1} />
        ));
        const mark = <span className="beat-dot-mark" />;
        return (
          <span key={i} className="beat-slot">
            {onCycle ? (
              <button
                type="button"
                className="beat-dot"
                data-beat={i}
                data-accent={accent}
                aria-label={t('metronome.beat', {
                  n: i + 1,
                  state: t(`metronome.accent.${accent}`),
                })}
                onClick={() => onCycle(i)}
              >
                {mark}
              </button>
            ) : (
              <span className="beat-dot" data-beat={i} data-accent={accent}>
                {mark}
              </span>
            )}
            {subs}
          </span>
        );
      })}
    </div>
  );
}
