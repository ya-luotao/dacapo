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
 * key on it (the player's, the computer's or the screen's) starts the plan's next step.
 */
export function HomeKeys({ next }: { next: NextStep }) {
  const t = useT();
  const { hub, pointer } = useInput();
  const { held, sustained } = useHubState();
  const [, navigate] = useLocation();

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') navigate(next.href);
      }),
    [hub, navigate, next.href],
  );

  return (
    <div className="home-keys">
      <p className="home-keys-hint">{t('today.anyKey', { name: next.name })}</p>
      <Piano held={held} sustained={sustained} pointer={pointer} range={RANGE} />
    </div>
  );
}
