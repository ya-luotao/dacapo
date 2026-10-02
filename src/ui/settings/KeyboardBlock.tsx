import { useEffect, useId, useRef, useState } from 'react';
import {
  capturedKeys,
  keyboardChoice,
  KEYBOARD_SIZES,
  KEYBOARDS,
  type KeyboardSize,
} from '../../core/instrument.ts';
import { PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { useInput, useMidiStatus } from '../input/context.ts';
import { useInstrumentKeys, writeInstrumentKeys } from '../instrument.ts';
import { useNoteNames } from '../noteNames.ts';

const OTHER = 'other';

/**
 * A keyboard of the player's own being set: its lowest key is waited for, then its highest
 * (`short`: the key pressed last was less than an octave from the lowest, and is asked again).
 */
type Capture = { low: null } | { low: number; short: boolean };

/**
 * Your keyboard (docs/PERSONAL.md, "The instrument's keys"): how many keys the instrument in
 * front of this device has, one of the usual sizes or **Other**, set by pressing its lowest key
 * and then its highest. Only the MIDI keyboard's own keys set it: the computer keys and the keys
 * on the screen reach every note.
 */
export function KeyboardBlock() {
  const t = useT();
  const id = useId();
  const { midiName } = useNoteNames();
  const { onMidiKey } = useInput();
  const connected = useMidiStatus().state === 'connected';
  const keys = useInstrumentKeys();
  const choice = keyboardChoice(keys);
  const [capture, setCapture] = useState<Capture | null>(null);
  const select = useRef<HTMLSelectElement>(null);

  // The two keys, as they come from the MIDI keyboard.
  const state = useRef(capture);
  useEffect(() => {
    state.current = capture;
  });
  const capturing = capture !== null;
  useEffect(() => {
    if (!capturing) return;
    return onMidiKey((midi) => {
      const now = state.current;
      if (!now) return;
      const key = Math.max(PIANO_LOWEST, Math.min(PIANO_HIGHEST, midi));
      if (now.low === null) {
        setCapture({ low: key, short: false });
        return;
      }
      const captured = capturedKeys(now.low, key);
      if (!captured) {
        setCapture({ low: now.low, short: true });
        return;
      }
      writeInstrumentKeys(captured);
      setCapture(null);
      select.current?.focus({ preventScroll: true });
    });
  }, [capturing, onMidiKey]);

  function cancel() {
    setCapture(null);
    select.current?.focus({ preventScroll: true });
  }

  const sizeLabel = (size: KeyboardSize) =>
    t('settings.keyboard.size', {
      n: size,
      low: midiName(KEYBOARDS[size].low),
      high: midiName(KEYBOARDS[size].high),
    });

  return (
    <div
      className="field sound-keyboard"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !capturing) return;
        e.preventDefault();
        cancel();
      }}
    >
      <label htmlFor={`${id}-keyboard`}>{t('settings.keyboard')}</label>
      <div className="sound-row">
        <select
          id={`${id}-keyboard`}
          ref={select}
          value={capturing ? OTHER : String(choice)}
          aria-describedby={`${id}-keyboard-help`}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setCapture({ low: null });
              return;
            }
            setCapture(null);
            writeInstrumentKeys(KEYBOARDS[Number(e.target.value) as KeyboardSize]);
          }}
        >
          {KEYBOARD_SIZES.map((size) => (
            <option key={size} value={size}>
              {sizeLabel(size)}
            </option>
          ))}
          <option value={OTHER}>
            {choice === OTHER && !capturing
              ? t('settings.keyboard.other.keys', {
                  n: keys.high - keys.low + 1,
                  low: midiName(keys.low),
                  high: midiName(keys.high),
                })
              : t('settings.keyboard.other')}
          </option>
        </select>
        {choice === OTHER && !capturing && (
          <button type="button" className="button" onClick={() => setCapture({ low: null })}>
            {t('settings.keyboard.again')}
          </button>
        )}
      </div>
      {capture && (
        <div className="sound-capture">
          <p role="status">
            {capture.low === null
              ? t('settings.keyboard.lowest')
              : capture.short
                ? t('settings.keyboard.short', { low: midiName(capture.low) })
                : t('settings.keyboard.highest', { low: midiName(capture.low) })}
          </p>
          {!connected && <p className="help">{t('settings.keyboard.midi')}</p>}
          <button type="button" className="button" onClick={cancel}>
            {t('settings.keyboard.cancel')}
          </button>
        </div>
      )}
      <p id={`${id}-keyboard-help`} className="help">
        {t('settings.keyboard.help')}
      </p>
    </div>
  );
}
