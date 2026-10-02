import { useEffect, useMemo, useReducer, useState, type CSSProperties } from 'react';
import { parseMusicXml } from '../../core/musicxml.ts';
import { handsPlaying, scaleNotes } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { scaleHands, scaleMusicXml } from '../../core/scaleXml.ts';
import { buildSteps, keyRange } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput } from '../input/context.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import type { Engraving } from '../notation/verovio.ts';
import { useNoteNames } from '../noteNames.ts';
import { Piano } from '../piano/Piano.tsx';
import { keyboardRange, whiteKeys } from '../piano/range.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { useFocusState } from '../focus/focus.ts';
import { stepNames, useExerciseTitle } from './format.ts';
import {
  loopKey,
  loopNotes,
  loopSpan,
  noteIdsOf,
  noteKey,
  startLoop,
  stepCount,
  type LoopPlace,
} from './loop.ts';

/** A loop is a few notes: drawn as large as one octave of a scale. */
const LOOP_ZOOM = 1.6;
const ENGRAVING: Engraving = { lastJustification: 0.35, ottavaText: true };

/**
 * A focus loop on one place of the scale: its few notes either side on the score between repeat
 * signs, the keyboard marking each next key with its finger, round and round until Stop. Nothing
 * here is timed, analysed or recorded: the page's run and its recorder are not even mounted.
 */
export function ScaleLoop({
  exercise,
  place,
  perBeat,
  onStop,
}: {
  exercise: ScaleExercise;
  place: LoopPlace;
  perBeat: number;
  onStop: () => void;
}) {
  const t = useT();
  const title = useExerciseTitle();
  const noteNames = useNoteNames();
  const focus = useFocusState();
  const { hub, pointer } = useInput();
  const { held, sustained } = useHubState();
  const hands = handsPlaying(exercise.hands);
  const notes = useMemo(() => scaleNotes(exercise), [exercise]);
  const run = notes[place.hand];
  const steps = stepCount(run);
  const span = useMemo(() => loopSpan(steps, place.index), [steps, place.index]);
  const expected = useMemo(() => loopNotes(notes, span), [notes, span]);
  const xml = useMemo(
    () => scaleMusicXml(exercise, { notesPerBeat: perBeat, loop: span }),
    [exercise, perBeat, span],
  );
  const score = useMemo(
    () =>
      parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: scaleHands(exercise),
      }),
    [xml, exercise],
  );
  const scoreSteps = useMemo(() => buildSteps(score, hands), [score, hands]);
  // The loop's notes on the score: each hand's notes by onset are its notes of the span.
  const noteIds = useMemo(
    () =>
      noteIdsOf(score, {
        right: expected.filter((n) => n.hand === 'right'),
        left: expected.filter((n) => n.hand === 'left'),
      }),
    [score, expected],
  );
  const stepOfNote = useMemo(
    () => new Map(scoreSteps.flatMap((s) => s.noteIds.map((id) => [id, s] as const))),
    [scoreSteps],
  );
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [loop, dispatch] = useReducer(loopKey, expected, startLoop);
  // The screen stays on while the loop is played.
  useKeepAwake(loop.rounds > 0 || loop.played.length > 0, KEEP_AWAKE_IDLE_MS);

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') dispatch(event.midi);
      }),
    [hub],
  );

  const idOf = (n: number) => {
    const note = expected[n];
    return note ? noteIds.get(noteKey(note)) : undefined;
  };
  const due = loop.steps[loop.next] ?? [];
  const nextId = due[0] === undefined ? undefined : idOf(due[0]);
  const step = nextId === undefined ? null : (stepOfNote.get(nextId) ?? null);
  const marks = new Map<string, string>();
  for (const n of loop.played) {
    const id = idOf(n);
    if (id) marks.set(id, 'is-pressed');
  }
  const dueNotes = due.map((n) => expected[n]!);
  const marked = new Set(dueNotes.map((note) => note.midi));
  const fingers = new Map(
    dueNotes.flatMap((note): [number, number][] =>
      note.finger === null ? [] : [[note.midi, note.finger]],
    ),
  );
  const wrong = new Set(loop.wrongKey === null ? [] : [loop.wrongKey]);
  const keys = useMemo(() => {
    const range = keyRange(score, hands) ?? [60, 72];
    return keyboardRange(range[0], range[1]);
  }, [score, hands]);
  const where = stepNames(run, noteNames)[place.index] ?? '';

  return (
    <div className="scale-session scale-loop">
      <div className="scale-head">
        <h2 className="scale-title">
          {t('scales.loop.title', { scale: title(exercise), key: where })}
        </h2>
        <p className="scale-status" role="status">
          {loop.rounds === 0 && loop.next === 0 && loop.played.length === 0
            ? t('scales.loop.start', {
                key:
                  stepNames(
                    dueNotes.filter((n) => n.hand === dueNotes[0]!.hand),
                    noteNames,
                  )[0] ?? '',
              })
            : t('scales.loop.rounds', { n: loop.rounds })}
        </p>
        <div className="scale-head-tools">
          <button type="button" className="button is-compact" onClick={onStop}>
            {t('scales.loop.stop')}
          </button>
        </div>
      </div>
      <p className="help scale-loop-help">{t('scales.loop.help')}</p>

      <div className="scale-sheet">
        <ScoreView
          xml={xml}
          score={score}
          title={t('scales.loop.title', { scale: title(exercise), key: where })}
          step={step}
          pressed={[]}
          hands={hands}
          onStatus={setStatus}
          marks={marks}
          zoom={LOOP_ZOOM * (focus.on ? focus.zoom : 1)}
          engraving={ENGRAVING}
          fillHeight={false}
        />
        {status.state !== 'ready' && (
          <div className="piece-overlay" role="status">
            <p className={status.state === 'failed' ? 'piece-error' : 'muted'}>
              {status.state === 'loading'
                ? t('pieces.preparing')
                : status.reason === 'engine'
                  ? t('pieces.engineFailed')
                  : t('pieces.renderFailed')}
            </p>
          </div>
        )}
      </div>

      {(!focus.on || focus.keyboard) && (
        <div className="scale-keys" style={{ '--piece-whites': whiteKeys(keys) } as CSSProperties}>
          <Piano
            held={held}
            sustained={sustained}
            pointer={pointer}
            wrong={wrong}
            marked={marked}
            fingers={fingers}
            range={keys}
            className="piece-piano"
          />
        </div>
      )}
    </div>
  );
}
