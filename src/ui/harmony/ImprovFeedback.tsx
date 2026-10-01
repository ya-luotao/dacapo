import { useEffect, useMemo, useState } from 'react';
import { classifyNote, loopBars, type ImprovPlan, type NoteClass } from '../../core/improv.ts';
import { readFigures, type ImprovSession, type PlayedNote } from '../../core/improvFigures.ts';
import { steadyGrid } from '../../core/smfWrite.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { saveMidi } from '../pieces/saveMidi.ts';
import { SaveMidiButton } from '../pieces/SaveMidiButton.tsx';
import { useLogFormat } from '../progress/format.ts';
import { useReadFormat } from '../read/format.ts';
import { useHarmonyFormat } from './format.ts';
import type { ImprovController, ImprovPlayback, ImprovView } from './improvController.ts';
import { improvNoteName, useImprovFormat } from './improvFormat.ts';
import { loopPlace } from './improvPlace.ts';
import { HeardLegend, ImprovKeyboard, LoopStrip, NowNext } from './ImprovStage.tsx';
import { SymbolText } from './SymbolText.tsx';

interface ImprovFeedbackProps {
  view: ImprovView;
  controller: ImprovController;
  /** The accompaniment level and the backing's channel, for playing back. */
  sound: { level: number; channel: number };
  onAgain: () => void;
  onChange: () => void;
}

/** After a loop: how it was played, in words and bar by bar, and the take played back. */
export function ImprovFeedback({
  view,
  controller,
  sound,
  onAgain,
  onChange,
}: ImprovFeedbackProps) {
  const t = useT();
  const format = useImprovFormat();
  const log = useLogFormat();
  const { session, plan } = view;
  const spec = plan!.spec;
  const playing = view.playback?.sessionId === session?.id && session !== null;

  return (
    <section className="read-summary improv-feedback" aria-labelledby="improv-feedback-title">
      <h2 id="improv-feedback-title">{t('harmony.improv.feedback')}</h2>
      <p className="muted">
        {format.title(spec.backing, spec.key)}
        {session &&
          ` · ${t('harmony.improv.summary', {
            time: log.duration(session.figures.ms),
            bpm: spec.bpm,
            feel: format.feel(spec.feel),
          })}`}
      </p>
      {session ? (
        <>
          <Figures session={session} plan={plan!} />
          <BarChart session={session} plan={plan!} />
          {playing && view.playback && (
            <PlaybackStage playback={view.playback} controller={controller} />
          )}
        </>
      ) : (
        <p className="improv-nothing">{t('harmony.improv.nothing')}</p>
      )}
      <div className="actions">
        {session && (
          <PlayBackButton
            session={session}
            view={view}
            controller={controller}
            sound={sound}
            className="button"
          />
        )}
        {session && <SaveImprovMidi session={session} controller={controller} />}
        <button type="button" className="button button-primary" onClick={onAgain}>
          {t('harmony.improv.again')}
        </button>
        <button type="button" className="button" onClick={onChange}>
          {t('harmony.improv.change')}
        </button>
      </div>
    </section>
  );
}

/** Play back (or stop playing back) a session's take with its backing. */
export function PlayBackButton({
  session,
  view,
  controller,
  sound,
  className,
}: {
  session: ImprovSession;
  view: ImprovView;
  controller: ImprovController;
  sound: { level: number; channel: number };
  className?: string;
}) {
  const t = useT();
  const mine = view.playback?.sessionId === session.id;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={mine}
        disabled={view.loading !== null}
        onClick={() => (mine ? controller.stopPlayback() : controller.playBack(session, sound))}
      >
        {t(
          mine
            ? 'harmony.improv.playBack.stop'
            : view.loading === session.id
              ? 'harmony.improv.playBack.loading'
              : 'harmony.improv.playBack',
        )}
      </button>
      {view.missing === session.id && (
        <span className="help improv-missing" role="status">
          {t('harmony.improv.playBack.none')}
        </span>
      )}
    </>
  );
}

/**
 * Save a session's take as a MIDI file (docs/PIECES.md, "A take as a MIDI file"): the player's
 * keys on the backing's beat, in 4/4 at its tempo from the first bar's 1. The backing is not in
 * the take, so it is not in the file.
 */
export function SaveImprovMidi({
  session,
  controller,
}: {
  session: ImprovSession;
  controller: ImprovController;
}) {
  const t = useT();
  const format = useImprovFormat();
  const [missing, setMissing] = useState(false);
  async function save() {
    const take = await controller.take(session);
    const saved =
      take !== null &&
      saveMidi({
        title: format.title(session.backing, session.key),
        events: take.events,
        startedAt: take.startedAt,
        latency: take.latency,
        grid: steadyGrid(session.bpm),
      });
    setMissing(!saved);
  }
  return (
    <>
      <SaveMidiButton onClick={() => void save()} help={t('harmony.improv.saveMidi.help')} />
      {missing && (
        <span className="help improv-missing" role="status">
          {t('harmony.improv.playBack.none')}
        </span>
      )}
    </>
  );
}

/** The figures in words: a few large, then each in a sentence. */
function Figures({ session, plan }: { session: ImprovSession; plan: ImprovPlan }) {
  const t = useT();
  const read = useReadFormat();
  const f = session.figures;
  const reading = readFigures(f, plan.barMs);
  const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toLocaleString();
  const sentences: string[] = [];
  sentences.push(
    f.strong > 0
      ? t('harmony.improv.fig.strong', {
          percent: read.percent(reading.strongChord),
          chord: f.strongChord,
          notes: f.strong,
        })
      : t('harmony.improv.fig.strongNone'),
  );
  sentences.push(
    t('harmony.improv.fig.heard', {
      notes: f.notes,
      chord: read.percent(reading.chord),
      scale: read.percent(reading.scale),
      outside: read.percent(reading.outside),
    }),
  );
  if (f.low !== null && f.high !== null)
    sentences.push(
      f.low === f.high
        ? t('harmony.improv.fig.rangeOne', { low: improvNoteName(f.low, session) })
        : t('harmony.improv.fig.range', {
            low: improvNoteName(f.low, session),
            high: improvNoteName(f.high, session),
            n: f.high - f.low,
          }),
    );
  sentences.push(
    t('harmony.improv.fig.density', {
      n: oneDecimal(reading.notesPerBar),
      bars: oneDecimal(reading.bars),
    }),
  );
  if (reading.silence !== null)
    sentences.push(t('harmony.improv.fig.silence', { percent: read.percent(reading.silence) }));
  sentences.push(
    reading.repeated === null
      ? t('harmony.improv.fig.repeatedFew')
      : t('harmony.improv.fig.repeated', { percent: read.percent(reading.repeated) }),
  );
  if (session.call)
    sentences.push(t('harmony.improv.fig.calls', { answered: f.answered, calls: f.calls }));

  return (
    <>
      <dl className="figures">
        <div>
          <dt>{t('progress.session.strongChord')}</dt>
          <dd>{read.percent(reading.strongChord)}</dd>
        </div>
        <div>
          <dt>{t('progress.session.played')}</dt>
          <dd>{f.notes}</dd>
        </div>
        <div>
          <dt>{t('harmony.improv.heard.outside')}</dt>
          <dd>{read.percent(reading.outside)}</dd>
        </div>
      </dl>
      <ul className="improv-figures">
        {sentences.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </>
  );
}

/** Chord tones bar by bar: a column for each bar of the loop, its chord under it. */
function BarChart({ session, plan }: { session: ImprovSession; plan: ImprovPlan }) {
  const t = useT();
  const read = useReadFormat();
  const format = useHarmonyFormat();
  const bars = loopBars(plan);
  return (
    <figure className="improv-chart">
      <figcaption>
        <span className="improv-chart-title">{t('harmony.improv.chart')}</span>
        <span className="help">{t('harmony.improv.chart.help')}</span>
      </figcaption>
      <ol className={bars > 4 ? 'improv-chart-bars is-long' : 'improv-chart-bars'}>
        {session.figures.byBar.map(([chord, notes], n) => {
          const c = plan.chords[n]!;
          const share = notes > 0 ? chord / notes : null;
          const label =
            share === null
              ? t('harmony.improv.chart.empty', { bar: n + 1, chord: format.words(c.symbol) })
              : t('harmony.improv.chart.bar', {
                  bar: n + 1,
                  chord: format.words(c.symbol),
                  percent: read.percent(share),
                  notes,
                });
          return (
            <li key={n} className={share === null ? 'is-empty' : undefined}>
              <span className="visually-hidden">{label}</span>
              <span className="improv-chart-column" aria-hidden="true">
                <span
                  className="improv-chart-fill"
                  style={{ blockSize: `${Math.round((share ?? 0) * 100)}%` }}
                />
              </span>
              <span className="improv-chart-value" aria-hidden="true">
                {share === null ? '–' : read.percent(share)}
              </span>
              <span className="improv-chart-chord" aria-hidden="true">
                <SymbolText symbol={c.symbol} />
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

const NO_KEYS: ReadonlySet<number> = new Set();

/** A frame's time on the performance.now() clock, while `active`. */
function useFrameTime(active: boolean): number {
  const [time, setTime] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let frame = requestAnimationFrame(function tick(now) {
      setTime(now);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return time;
}

/** The take played back: where the backing is, and the keys of the take sounding, tinted. */
export function PlaybackStage({
  playback,
  controller,
}: {
  playback: ImprovPlayback;
  controller: ImprovController;
}) {
  const { pointer } = useInput();
  const { plan, notes } = playback;
  useFrameTime(true);
  const at = controller.position();
  const place = loopPlace(plan, at);
  const classes = useMemo(
    () => new Map(notes.map((n): [PlayedNote, NoteClass] => [n, classifyNote(plan, n.midi, n.on)])),
    [notes, plan],
  );
  const { held, heard } = useMemo(() => {
    const held = new Map<number, number>();
    const heard = new Map<number, NoteClass>();
    if (at !== null)
      for (const n of notes) {
        if (n.on > at || n.off <= at) continue;
        held.set(n.midi, n.velocity);
        heard.set(n.midi, classes.get(n)!);
      }
    return { held, heard };
    // Recomputed every frame: `at` moves.
  }, [at, notes, classes]);
  return (
    <div className="improv-playback">
      <div className="improv-stage">
        <NowNext plan={plan} place={place} />
        <LoopStrip plan={plan} place={place} />
      </div>
      <ImprovKeyboard
        plan={plan}
        bar={place.bar}
        held={held}
        sustained={NO_KEYS}
        heard={heard}
        pointer={pointer}
      />
      <HeardLegend />
    </div>
  );
}
