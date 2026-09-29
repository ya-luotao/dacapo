import type { ComponentProps } from 'react';
import { useHubState, useInput } from '../input/context.ts';
import { Piano } from '../piano/Piano.tsx';

type PianoFigureProps = Omit<ComponentProps<typeof Piano>, 'held' | 'sustained' | 'pointer'>;

/** The app's piano, playing and lighting from every keyboard. */
export function LessonPiano({ className, ...props }: PianoFigureProps) {
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  return (
    <Piano
      held={held}
      sustained={sustained}
      pointer={pointer}
      className={className ? `lesson-piano ${className}` : 'lesson-piano'}
      {...props}
    />
  );
}
