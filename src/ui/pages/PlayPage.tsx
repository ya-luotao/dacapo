import { useT } from '../../i18n/index.ts';
import { useHubState, useInput } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { Piano } from '../piano/Piano.tsx';
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
      <Piano held={held} sustained={sustained} pointer={pointer} />
      {keyboardFallback && <KeyboardHint />}
    </section>
  );
}
