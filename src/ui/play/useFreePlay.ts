import { useEffect } from 'react';
import { useInput } from '../input/context.ts';
import { usePracticeStore } from '../practice/context.ts';
import { createFreePlayTracker } from './freePlayTracker.ts';

/** Records free play while the calling component (the Play page) is mounted and the tab visible. */
export function useFreePlay(): void {
  const { hub } = useInput();
  const practice = usePracticeStore();

  useEffect(() => {
    const tracker = createFreePlayTracker({
      onHubEvent: hub.onEvent,
      practice,
      isVisible: () => document.visibilityState === 'visible',
    });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') tracker.end();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', tracker.end);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', tracker.end);
      tracker.dispose();
    };
  }, [hub, practice]);
}
