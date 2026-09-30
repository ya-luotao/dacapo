import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { beatsPerBar, timeSignature, type RhythmMeter } from '../../core/rhythmCells.ts';
import { cellStarts, type TappedBar } from '../../core/rhythmEar.ts';
import { inTime } from '../../core/rhythmRead.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { CalibrationSheet, TimingMark } from '../pieces/RhythmParts.tsx';
import { readLatency, type Latency } from '../pieces/rhythmPrefs.ts';
import { useReadFormat } from '../read/format.ts';
import { CountDots, TapPads } from '../read/RhythmPads.tsx';
import { useRhythmFormat } from '../read/rhythmFormat.ts';
import { HearAgain, KeyIcon, ResultIcon, SpeakerIcon } from './EarSession.tsx';
import type { RhythmEarController, RhythmEarView } from './rhythmController.ts';
import { useRhythmEarFormat } from './rhythmEarFormat.ts';
import { BarFigure } from './rhythmFigure.tsx';
import { earShortcut, nameKey } from './shortcuts.ts';

interface RhythmEarSessionProps {
  view: RhythmEarView;
  controller: RhythmEarController;
}

/**
 * The count heard (of the time signature: an eighth in 6/8), from the prompt's downbeat;
 * negative in the first count-in. Null when nothing sounds.
 */
function useCount(origin: number | null, countMs: number): number | null {
  const [count, setCount] = useState<{ origin: number; count: number } | null>(null);
  useEffect(() => {
    if (origin === null) return;
    let frame = 0;
    const tick = () => {
      const next = Math.floor((performance.now() - origin) / countMs + 1e-6);
      setCount((c) => (c?.origin === origin && c.count === next ? c : { origin, count: next }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [origin, countMs]);
  return origin !== null && count?.origin === origin ? count.count : null;
}

/**
 * A session of rhythm dictation: the bar heard after a bar of count-in, then tapped back after a
 * second one (on any key, a letter or the pad) or chosen among bars written out; after the
 * answer, the bar drawn (inked by how each note was tapped) or the right choice marked.
 */
export function RhythmEarSession({ view, controller }: RhythmEarSessionProps) {
  const t = useT();
  const read = useReadFormat();
  const rhythm = useRhythmFormat();
  const format = useRhythmEarFormat();
  const { pointer } = useInput();
  const region = useRef<HTMLElement>(null);
  const { session, sound, last, stopped } = view;
  const { question } = session;
  const { status, meter, bar } = question;
  const tapBack = session.by === 'play';
  const answered = status !== 'waiting';
  const answer = session.answers.at(-1);
  const [latency, setLatency] = useState<Latency | null>(readLatency);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  // The count heard, for the dots and for what to do now.
  const perBar = timeSignature(meter)[0];
  const beatMs = 60_000 / session.bpm;
  const countMs = (beatMs * beatsPerBar(meter)) / perBar;
  const count = useCount(sound?.origin ?? null, countMs);
  const phase =
    sound === null || count === null
      ? null
      : count < perBar || sound.kind !== 'tap'
        ? 'listen'
        : count < 2 * perBar
          ? 'countIn'
          : 'tap';

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);

  // Space hears again, Enter goes on after an answer, 1–4 choose a bar.
  const latest = useRef(view);
  useLayoutEffect(() => {
    latest.current = view;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = earShortcut(e);
      if (!shortcut) return;
      const current = latest.current;
      switch (shortcut.kind) {
        case 'hearAgain':
          e.preventDefault();
          controller.hearAgain();
          return;
        case 'next':
          // Otherwise Enter does what it does on the focused control.
          if (current.session.question.status === 'waiting') return;
          e.preventDefault();
          controller.next();
          return;
        case 'name': {
          const choices = current.session.question.choice?.choices ?? [];
          if (current.session.by !== 'name' || shortcut.index >= choices.length) return;
          e.preventDefault();
          controller.choose(shortcut.index, e.timeStamp);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller]);

  const sounding = sound !== null;
  const tappedText = question.tapped
    ? t('ear.rhythm.tapped', {
        right: question.tapped.right,
        total: question.tapped.cells.length,
      })
    : '';
  const title = answered
    ? status === 'correct'
      ? t('read.correct')
      : tapBack
        ? tappedText
        : t('ear.rhythm.wrong')
    : phase === 'countIn'
      ? t('ear.rhythm.countIn')
      : phase === 'tap'
        ? t('ear.rhythm.tap')
        : sounding
          ? t('ear.listen')
          : t('ear.turn');
  const task = tapBack
    ? stopped
      ? t('ear.rhythm.stopped')
      : t('ear.rhythm.by.play.help')
    : t('ear.rhythm.choose');

  return (
    <section
      className={`read-session ear-session rhythm-ear-session${tapBack ? ' is-tap' : ' is-choose'}`}
      ref={region}
      tabIndex={-1}
      aria-label={t('ear.session')}
      // Development only: when each tap is due and which bar is right, for driving a session
      // from a script.
      data-run={
        import.meta.env.DEV
          ? JSON.stringify({
              origin: sound?.origin ?? null,
              kind: sound?.kind ?? null,
              steps: sound?.run.plan.steps.map((s) => s.at) ?? [],
              answerStart: sound?.run.answer?.start ?? null,
              opensAt: question.opensAt,
              right: question.choice?.right ?? null,
              bar: bar,
            })
          : undefined
      }
    >
      <div className="read-bar">
        <p className="read-level">{rhythm.level(session.level)}</p>
        <p className="read-count">
          {t('ear.rhythm.count', {
            n: Math.min(question.index + 1, session.length),
            total: session.length,
          })}
        </p>
        <p className="read-count rhythm-ear-tempo">
          {rhythm.tempo(meter, session.bpm)} · {meter}
        </p>
        <button type="button" className="button ear-stop" onClick={controller.stop}>
          {t('read.stop')}
        </button>
      </div>
      <div className="read-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${question.index / session.length})` }} />
      </div>

      <div className={`read-card ear-card rhythm-ear-card is-${status}`}>
        <div className="ear-state">
          {!answered &&
            (sounding && phase !== 'tap' ? (
              <SpeakerIcon className="ear-state-icon is-sounding" />
            ) : (
              <KeyIcon />
            ))}
          <p className="ear-title">
            {title}
            {phase === 'tap' && !answered && (
              <>
                {' '}
                <TimingMark last={last} />
              </>
            )}
          </p>
        </div>
        <CountDots counts={perBar} lit={sounding ? count : null} compound={meter === '6/8'} />
        {!answered && <p className="ear-task">{task}</p>}
        {answered && tapBack && question.tapped && (
          <TapResult tapped={question.tapped} bar={bar} meter={meter} />
        )}
      </div>

      <div className={`read-feedback ear-feedback is-${status}`} role="status">
        {!answered && <p className="visually-hidden">{title}</p>}
        {status === 'correct' && (
          <p className="read-result">
            <ResultIcon ok />
            {answer?.by === 'name'
              ? t('read.correct.time', { time: read.seconds(answer.ms) })
              : tappedText}
          </p>
        )}
        {status === 'wrong' &&
          (tapBack ? (
            <p className="visually-hidden">{title}</p>
          ) : (
            <p className="read-result">
              <ResultIcon ok={false} />
              {t('ear.rhythm.wrong.choose')}
            </p>
          ))}
        {status === 'wrong' ? (
          <>
            <div className="ear-next">
              <button
                type="button"
                className="button button-primary"
                onClick={controller.next}
                aria-keyshortcuts="Enter"
              >
                {t('ear.next')}
                <kbd>{t('ear.key.enter')}</kbd>
              </button>
              <HearAgain onClick={controller.hearAgain} />
            </div>
            <p className="help ear-next-help">{t('ear.rhythm.next.help')}</p>
          </>
        ) : (
          !answered && (
            <div className="ear-next">
              <HearAgain onClick={controller.hearAgain} />
            </div>
          )
        )}
      </div>

      {!tapBack && question.choice && (
        <div
          className="rhythm-ear-choices"
          role="group"
          aria-label={t('ear.rhythm.choices')}
          style={{ '--columns': question.choice.choices.length === 4 ? 2 : 3 } as CSSProperties}
        >
          {question.choice.choices.map((cells, i) => {
            const key = nameKey(i);
            const right = answered && i === question.choice!.right;
            const chosen = answered && i === question.chosen && !right;
            const inactive = answered || question.opensAt === null;
            return (
              <button
                key={i}
                type="button"
                className={`button rhythm-ear-choice${right ? ' is-right' : ''}${chosen ? ' is-chosen' : ''}`}
                aria-disabled={inactive || undefined}
                aria-keyshortcuts={key ?? undefined}
                aria-label={t('ear.rhythm.choice', { n: i + 1, cells: format.cells(cells) })}
                onClick={(e) => {
                  if (!inactive) controller.choose(i, e.timeStamp);
                }}
              >
                {key && <kbd aria-hidden="true">{key}</kbd>}
                {right && <ResultIcon ok />}
                {chosen && <ResultIcon ok={false} />}
                <BarFigure
                  cells={cells}
                  meter={meter}
                  label={format.cells(cells)}
                  className="rhythm-ear-figure"
                />
              </button>
            );
          })}
        </div>
      )}

      {tapBack && !answered && <TapPads hands={false} pointer={pointer} />}

      {tapBack && (
        <p className="rhythm-latency">
          <span>
            {latency ? t('pieces.latency', { ms: latency.offset }) : t('pieces.latency.none')}
          </span>
          <button
            type="button"
            className="button is-compact"
            disabled={sounding}
            onClick={() => setCalibrationOpen(true)}
          >
            {t('pieces.latency.calibrate')}
          </button>
          <span className="muted">{t('ear.rhythm.keys')}</span>
        </p>
      )}

      {calibrationOpen && (
        <CalibrationSheet
          offer={false}
          onCalibrate={() => setCalibrationOpen(true)}
          onStart={() => {
            if (!calibrating) setCalibrationOpen(false);
          }}
          onRunning={setCalibrating}
          onChange={setLatency}
          onClose={() => setCalibrationOpen(false)}
        />
      )}
    </section>
  );
}

/** A bar tapped back: drawn with its counts, each note inked by how it was tapped. */
function TapResult({
  tapped,
  bar,
  meter,
}: {
  tapped: TappedBar;
  bar: readonly string[];
  meter: RhythmMeter;
}) {
  const t = useT();
  const rhythm = useRhythmFormat();
  const format = useRhythmEarFormat();
  const starts = cellStarts(bar);
  const wrong = tapped.cells.filter((c) => !c.correct);
  return (
    <div className="rhythm-ear-result">
      <BarFigure
        cells={bar}
        meter={meter}
        tapped={tapped}
        counts
        label={t('ear.rhythm.bar', { meter, cells: format.cells(bar) })}
        className="rhythm-ear-figure is-result"
      />
      <p className="rhythm-tendency">{rhythm.tendency(tapped.tendency)}</p>
      <ul className="rhythm-key" aria-hidden="true">
        <li className="is-in">{t('rhythm.ink.inTime')}</li>
        <li className="is-early">{t('rhythm.ink.early')}</li>
        <li className="is-late">{t('rhythm.ink.late')}</li>
        <li className="is-missed">{t('rhythm.ink.missed')}</li>
        <li className="is-extra">{t('rhythm.ink.extra')}</li>
      </ul>
      {wrong.length > 0 && (
        <ul className="visually-hidden">
          {wrong.map((c) => {
            const timings = c.deviations.flatMap((d) =>
              d === null
                ? [t('rhythm.timing.missed')]
                : inTime(d)
                  ? []
                  : [
                      t(d < 0 ? 'pieces.timing.early' : 'pieces.timing.late', {
                        ms: Math.abs(d),
                      }),
                    ],
            );
            if (c.extras.length > 0)
              timings.push(
                c.extras.length === 1
                  ? t('rhythm.timing.extras.one')
                  : t('rhythm.timing.extras.other', { n: c.extras.length }),
              );
            return (
              <li key={c.cell}>
                {t('ear.rhythm.cellResult', {
                  beat: Math.floor(starts[c.cell]!) + 1,
                  cell: rhythm.cell(c.key),
                  timings: timings.join(t('app.listSeparator')),
                })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
