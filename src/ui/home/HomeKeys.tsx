import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput } from '../input/context.ts';
import { Piano } from '../piano/Piano.tsx';

/** Five octaves, C2 to C7: wide enough to read as the instrument, not as a chart. */
const RANGE = [36, 96] as const;

export interface NextStep {
  href: string;
  name: string;
}

/**
 * The keyboard at the foot of Today: the instrument is there before anything is chosen, and any
 * key of the player's MIDI keyboard, or of this one on the screen, starts the plan's next step.
 * The computer's letter keys do not: a letter typed by chance must not leave the page.
 */
export function HomeKeys({ next }: { next: NextStep }) {
  const t = useT();
  const { onMidiKey, pointer } = useInput();
  const { held, sustained } = useHubState();
  const [, navigate] = useLocation();

  useEffect(() => onMidiKey(() => navigate(next.href)), [onMidiKey, navigate, next.href]);

  return (
    <div className="home-keys">
      <p className="home-keys-hint">{t('today.anyKey', { name: next.name })}</p>
      {/* A key pressed on the screen starts it too: the keys' pointer events bubble here. */}
      <div onPointerDown={() => navigate(next.href)}>
        <Piano held={held} sustained={sustained} pointer={pointer} range={RANGE} />
      </div>
    </div>
  );
}
