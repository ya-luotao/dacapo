import { useId, useState } from 'react';
import {
  DEFAULT_READS,
  readingFloor,
  READS,
  type Reads,
  type StartingPoint,
} from '../../core/startingPoint.ts';
import { useT } from '../../i18n/index.ts';

const FROM = ['new', 'player'] as const;

interface StartingPointFieldsProps {
  /** The answer shown; null while none was given (Settings, for someone never asked). */
  value: StartingPoint | null;
  onChange: (next: StartingPoint) => void;
}

/**
 * Where you start from (docs/START.md), as the start page asks it and Settings changes it: new to
 * the piano or playing already, each a plain option with one line saying what it means; and for
 * someone who plays, what they read without counting lines, with where Read's notes then begin.
 */
export function StartingPointFields({ value, onChange }: StartingPointFieldsProps) {
  const t = useT();
  const id = useId();
  // What was read stays chosen while the first answer goes to "new" and back.
  const [reads, setReads] = useState<Reads>(value?.from === 'player' ? value.reads : DEFAULT_READS);
  const floor = readingFloor(value);

  return (
    <div className="start-fields">
      <fieldset className="field start-from">
        <legend>{t('start.from')}</legend>
        <div className="levels">
          {FROM.map((from) => {
            const checked = value?.from === from;
            return (
              <label
                key={from}
                className={checked ? 'level start-choice is-checked' : 'level start-choice'}
              >
                <input
                  type="radio"
                  name={`${id}-from`}
                  value={from}
                  checked={checked}
                  onChange={() => onChange(from === 'new' ? { from } : { from, reads })}
                />
                <span className="level-body">
                  <span className="start-choice-name">{t(`start.from.${from}`)}</span>
                  <span className="level-range">{t(`start.from.${from}.text`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {value?.from === 'player' && (
        <fieldset className="field start-reads" aria-describedby={`${id}-begins`}>
          <legend>{t('start.reads')}</legend>
          <div className="levels">
            {READS.map((option) => {
              const checked = value.reads === option;
              return (
                <label
                  key={option}
                  className={checked ? 'level start-choice is-checked' : 'level start-choice'}
                >
                  <input
                    type="radio"
                    name={`${id}-reads`}
                    value={option}
                    checked={checked}
                    onChange={() => {
                      setReads(option);
                      onChange({ from: 'player', reads: option });
                    }}
                  />
                  <span className="level-name">{t(`start.reads.${option}`)}</span>
                </label>
              );
            })}
          </div>
          <p id={`${id}-begins`} className="help">
            {floor === null
              ? t('start.reads.begins.unknown')
              : t('start.reads.begins', { id: floor, name: t(`read.level.${floor}`) })}
          </p>
        </fieldset>
      )}
    </div>
  );
}
