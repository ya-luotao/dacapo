import { useT } from '../../i18n/index.ts';
import { useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';

/** Without a MIDI keyboard: which octave the computer keyboard plays, and how to change it. */
export function KeyboardHint() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="muted scale-keyboard">{t('read.keyboard', { octave })}</p>;
}
