import { useEffect, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useMidiStatus } from '../input/context.ts';
import { Piano } from '../piano/Piano.tsx';
import { DeviceHelp, DeviceStatus } from '../play/DeviceStatus.tsx';
import { KeyboardHint } from '../play/KeyboardHint.tsx';
import { NoteReadout } from '../play/NoteReadout.tsx';
import { SustainIndicator } from '../play/SustainIndicator.tsx';

export function PlayPage() {
  const t = useT();
  const { pointer } = useInput();
  const { held, sustained, sustain, lastChord } = useHubState();
  const status = useMidiStatus();
  const lookingLong = useLookingLong(status.state === 'pending');

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
      {status.state !== 'connected' && (status.state !== 'pending' || lookingLong) && (
        <KeyboardHint />
      )}
    </section>
  );
}

// Access is usually granted within milliseconds; only show the hint if the browser keeps asking,
// so a connected keyboard does not make it flash on every load.
function useLookingLong(pending: boolean): boolean {
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setLong(true), 1500);
    return () => clearTimeout(id);
  }, [pending]);
  return pending && long;
}
