import { useEffect, useRef } from 'react';
import { loopBars } from '../../core/improv.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import type { ImprovController, ImprovView } from './improvController.ts';
import { useImprovFormat } from './improvFormat.ts';
import { useLoopPlace } from './improvPlace.ts';
import { HeardLegend, ImprovKeyboard, LoopStrip, NowNext } from './ImprovStage.tsx';

interface ImprovSessionProps {
  view: ImprovView;
  controller: ImprovController;
}

/** The loop going on: the chords, where it is, the keyboard, and Stop. */
export function ImprovSession({ view, controller }: ImprovSessionProps) {
  const t = useT();
  const format = useImprovFormat();
  const region = useRef<HTMLElement>(null);
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  const plan = view.plan!;
  const { spec } = plan;
  const place = useLoopPlace(controller, plan);

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);

  const bars = loopBars(plan);
  const position =
    place.countIn !== null
      ? t('harmony.improv.countIn', { beat: place.countIn })
      : t('harmony.improv.position', {
          bar: (place.bar % bars) + 1,
          bars,
          beat: place.beat,
        });

  return (
    <section
      className="read-session improv-session"
      ref={region}
      tabIndex={-1}
      aria-label={t('harmony.practice.improvise')}
    >
      <div className="read-bar">
        <p className="read-level">{format.title(spec.backing, spec.key)}</p>
        <p className="read-count improv-position">{position}</p>
        <button type="button" className="button" onClick={controller.stop}>
          {t('read.stop')}
        </button>
      </div>

      <div className="improv-stage">
        <NowNext plan={plan} place={place} />
        <LoopStrip plan={plan} place={place} />
      </div>

      <p className="improv-scale-line">
        <span className="improv-scale-name">{format.scaleOf(spec.key, spec.scale)}</span>{' '}
        <span className="improv-scale-notes">{format.scaleNotes(spec.key, spec.scale)}</span>
      </p>

      <ImprovKeyboard
        plan={plan}
        bar={place.bar}
        held={held}
        sustained={sustained}
        heard={view.heard}
        pointer={pointer}
      />
      <HeardLegend />
      <KeyboardLine />
    </section>
  );
}

/** Without a MIDI keyboard, the octave the computer keyboard plays in. */
function KeyboardLine() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="help read-keyboard">{t('read.keyboard', { octave })}</p>;
}
