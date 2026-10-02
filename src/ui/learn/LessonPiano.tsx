import type { ComponentProps } from 'react';
import { useHubState, useInput } from '../input/context.ts';
import { Piano } from '../piano/Piano.tsx';
import { useStaticPage } from './lesson.ts';

type PianoFigureProps = Omit<
  ComponentProps<typeof Piano>,
  'held' | 'sustained' | 'pointer' | 'still'
>;

/**
 * The app's piano, playing and lighting from every keyboard; on a page without scripts, the same
 * keyboard as a picture.
 */
export function LessonPiano({ className, ...props }: PianoFigureProps) {
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  const still = useStaticPage();
  return (
    <Piano
      held={held}
      sustained={sustained}
      pointer={pointer}
      still={still}
      className={className ? `lesson-piano ${className}` : 'lesson-piano'}
      {...props}
    />
  );
}
