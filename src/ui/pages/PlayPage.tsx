import { useMemo, useState, type CSSProperties } from 'react';
import { isFullKeys } from '../../core/instrument.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { useInstrumentKeys } from '../instrument.ts';
import { Piano } from '../piano/Piano.tsx';
import { instrumentRange, whiteKeys } from '../piano/range.ts';
import { DeviceHelp, DeviceStatus } from '../play/DeviceStatus.tsx';
import { KeyboardHint } from '../play/KeyboardHint.tsx';
import { NoteReadout } from '../play/NoteReadout.tsx';
import { SustainIndicator } from '../play/SustainIndicator.tsx';
import { useFreePlay } from '../play/useFreePlay.ts';

export function PlayPage() {
  const t = useT();
  const { pointer } = useInput();
  const { held, sustained, sustain, lastChord } = useHubState();
  const keyboardFallback = useKeyboardFallback();
  useFreePlay();
  // The keyboard on the screen shows the instrument's keys (docs/PERSONAL.md, "The instrument's
  // keys"), and every key when asked: the keys on the screen reach every note.
  const keys = useInstrumentKeys();
  const fewer = !isFullKeys(keys);
  const [all, setAll] = useState(false);
  const range = useMemo(
    () => (fewer && !all ? instrumentRange(keys.low, keys.high) : undefined),
    [fewer, all, keys],
  );

  return (
    <section className="play">
      <div className="play-head">
        <h1>{t('play.title')}</h1>
        <DeviceStatus />
      </div>
      <DeviceHelp />
      <div className="play-now">
        <NoteReadout held={held} lastChord={lastChord} />
        <SustainIndicator down={sustain} />
      </div>
      <div
        className={range ? 'play-keys is-fewer' : 'play-keys'}
        style={range && ({ '--play-whites': whiteKeys(range) } as CSSProperties)}
      >
        <Piano held={held} sustained={sustained} pointer={pointer} range={range} />
      </div>
      {fewer && (
        <label className="check play-all-keys">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          <span>{t('settings.keyboard.all')}</span>
        </label>
      )}
      {keyboardFallback && <KeyboardHint />}
    </section>
  );
}
