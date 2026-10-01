import {
  anticipation,
  backingChecksum,
  classifyNote,
  improvPieceId,
  improvPlan,
  type ImprovPlan,
  type ImprovSpec,
  type NoteClass,
} from '../../core/improv.ts';
import {
  improvSession,
  playedNotes,
  sessionSpec,
  type ImprovSession,
  type PlayedNote,
} from '../../core/improvFigures.ts';
import {
  startTake,
  TAKE_CHUNK_EVENTS,
  takeChunkId,
  takeEvents,
  takeNoteOff,
  takeNoteOn,
  takePedal,
  type PedalPositions,
  type TakeEvent,
  type TakePedal,
  type TakeState,
} from '../../core/takes.ts';
import { createBackingRun, type BackingRun } from '../../output/backing.ts';
import type { ClickTrack } from '../../output/click.ts';
import type { MidiOutput } from '../../output/output.ts';
import type { Clock, Scheduler } from '../../output/scheduler.ts';
import type { PracticeStore } from '../practice/store.ts';

// Improvise (docs/HARMONY.md, "Improvise (H6)"): one loop over a backing at a time. Starts the
// backing, hears every key against it (a chord tone, a scale tone, outside), keeps the take as it
// goes, and when the loop stops records the session (kind `improv`) with its figures and the take
// under its id; plays a take back with its backing. Framework-free, so it is testable.

/** The session is stored again this often while the loop goes on, so a closed tab keeps it. */
export const CHECKPOINT_MS = 30_000;

export interface ImprovStart {
  /** Everything but the calls' seed, which each loop draws anew. */
  spec: Omit<ImprovSpec, 'seed'>;
  click: boolean;
  /** The accompaniment level (Settings) and the backing's MIDI channel. */
  level: number;
  channel: number;
  /** From the calibration: how much later than the sound a key arrives. */
  latency: number;
  /** The pedals' positions as the loop starts. */
  pedals: PedalPositions;
}

/** What is being played back: a take with its backing. */
export interface ImprovPlayback {
  sessionId: string;
  plan: ImprovPlan;
  notes: readonly PlayedNote[];
}

/** A session's take, as saving it as a MIDI file needs it. */
export interface ImprovTake {
  events: readonly TakeEvent[];
  latency: number;
  /** Epoch ms of time 0, the first bar's 1. */
  startedAt: number;
}

export interface ImprovView {
  /** The setup (no loop yet or closed), a loop going, or its feedback. */
  phase: 'idle' | 'running' | 'done';
  plan: ImprovPlan | null;
  click: boolean;
  /** The keys held now in the loop, as each was heard when struck. */
  heard: ReadonlyMap<number, NoteClass>;
  /** The loop just stopped as recorded; null when nothing was played in it. */
  session: ImprovSession | null;
  playback: ImprovPlayback | null;
  /** The session whose take is being read back from storage to be played. */
  loading: string | null;
  /** The session whose take was asked for and is not on this device (it was never synced). */
  missing: string | null;
}

export interface ImprovController {
  getState: () => ImprovView;
  subscribe: (onChange: () => void) => () => void;
  /** From the Start click (the click track may need the AudioContext it makes). */
  start: (options: ImprovStart) => void;
  stop: () => void;
  press: (midi: number, velocity: number, time: number) => void;
  release: (midi: number, time: number) => void;
  pedal: (controller: TakePedal, value: number, time: number) => void;
  /** ms from time 0 of the loop or the playback going on, or null. */
  position: () => number | null;
  /** Notified on every beat of the loop or playback. */
  subscribeBeat: (onChange: () => void) => () => void;
  /** Plays a take back with its backing: the loop just played, or a stored session's. */
  playBack: (session: ImprovSession, sound: { level: number; channel: number }) => void;
  stopPlayback: () => void;
  /** A session's take: the loop just played, or a stored one; null when it is not on this device. */
  take: (session: ImprovSession) => Promise<ImprovTake | null>;
  /** Leaves the feedback for the setup. */
  close: () => void;
  /** Stops everything and stores what is left. The controller stays usable. */
  dispose: () => void;
}

export interface ImprovControllerOptions {
  practice: PracticeStore;
  scheduler: Scheduler;
  clock: Clock;
  onInterrupt?: MidiOutput['onInterrupt'];
  /** The click track, from the Start gesture; null without Web Audio. */
  clicks: () => ClickTrack | null;
  /** Pauses the metronome while a loop or a playback lasts; returns the release. */
  hold: () => () => void;
  /** Epoch ms. */
  now?: () => number;
  newId?: () => string;
  newSeed?: () => number;
}

interface Recording {
  id: string;
  plan: ImprovPlan;
  click: boolean;
  latency: number;
  /** Epoch ms of Start. */
  startedAt: number;
  take: TakeState;
  /** Events stored so far, in how many chunks; the take is closed once all are. */
  sent: number;
  chunks: number;
  closed: boolean;
  /** The loop is over (its session recorded): only the keys held then are still followed. */
  ended: boolean;
}

const NOTHING_HEARD: ReadonlyMap<number, NoteClass> = new Map();

export function createImprovController(options: ImprovControllerOptions): ImprovController {
  const { practice, scheduler, clock } = options;
  const now = options.now ?? Date.now;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const newSeed = options.newSeed ?? (() => Math.floor(Math.random() * 0x100000000));

  let view: ImprovView = {
    phase: 'idle',
    plan: null,
    click: false,
    heard: NOTHING_HEARD,
    session: null,
    playback: null,
    loading: null,
    missing: null,
  };
  let run: BackingRun | null = null;
  let player: BackingRun | null = null;
  let recording: Recording | null = null;
  /** The last loop's take, kept to play it back. */
  let lastTake: ({ sessionId: string } & ImprovTake) | null = null;
  let releaseHold: (() => void) | null = null;
  let releasePlaybackHold: (() => void) | null = null;
  let stopCheckpoints: (() => void) | null = null;
  let unsubscribeBeat: (() => void) | null = null;
  let loadToken = 0;
  const listeners = new Set<() => void>();
  const beatListeners = new Set<() => void>();

  function publish(patch: Partial<ImprovView>) {
    view = { ...view, ...patch };
    for (const listener of [...listeners]) listener();
  }

  const beat = () => {
    for (const listener of [...beatListeners]) listener();
  };

  function follow(next: BackingRun | null) {
    unsubscribeBeat?.();
    unsubscribeBeat = next ? next.subscribe(beat) : null;
    beat();
  }

  /** The epoch ms of performance.now() time `time`. */
  const epochOf = (time: number) => now() - clock.now() + time;

  /** The session of the loop so far (or at its end), or null while nothing has been played. */
  function sessionOf(r: Recording, endedAt: number): ImprovSession | null {
    return improvSession(r.plan, {
      id: r.id,
      spec: r.plan.spec,
      click: r.click,
      startedAt: r.startedAt,
      zero: r.take.startedAt,
      endedAt,
      events: r.take.events,
      latency: r.latency,
    });
  }

  /** Stores the take's full chunks (and with `final` the rest), once its session is stored. */
  function flushTake(r: Recording, final: boolean) {
    if (r.closed) return;
    const { events } = r.take;
    while (events.length - r.sent >= TAKE_CHUNK_EVENTS || (final && events.length > r.sent)) {
      const chunk = events.slice(r.sent, r.sent + TAKE_CHUNK_EVENTS);
      practice.recordTake({
        id: takeChunkId(r.id, r.chunks),
        sessionId: r.id,
        pieceId: improvPieceId(r.plan.spec),
        checksum: backingChecksum(r.plan),
        hands: 'both',
        repeats: 'play',
        tempo: 100,
        mode: 'rhythm',
        latency: Math.round(r.latency),
        startedAt: r.take.startedAt,
        chunk: r.chunks,
        events: chunk.map((e) => [...e]),
      });
      r.sent += chunk.length;
      r.chunks++;
    }
    if (final) {
      r.closed = true;
      lastTake = {
        sessionId: r.id,
        events: r.take.events,
        latency: r.latency,
        startedAt: r.take.startedAt,
      };
    }
  }

  /** While the loop goes on: a full chunk is stored with the session so far before it. */
  function maybeChunk(r: Recording) {
    if (r.take.events.length - r.sent < TAKE_CHUNK_EVENTS) return;
    const session = sessionOf(r, now());
    if (!session) return;
    practice.recordSession(session);
    flushTake(r, false);
  }

  function checkpoint() {
    const r = recording;
    if (!r || r.ended) return;
    const session = sessionOf(r, now());
    if (session) practice.recordSession(session);
  }

  /** Stores what is left of the take of a loop that is over, and forgets it. */
  function closeRecording() {
    const r = recording;
    if (!r) return;
    recording = null;
    if (r.ended && !r.closed) flushTake(r, true);
  }

  /** The loop is over (stopped, or cut from outside): its session, and its take once let go. */
  function finish() {
    const r = recording;
    stopCheckpoints?.();
    stopCheckpoints = null;
    releaseHold?.();
    releaseHold = null;
    run = null;
    follow(null);
    if (!r) return;
    r.ended = true;
    const session = sessionOf(r, now());
    if (session) {
      practice.recordSession(session);
      flushTake(r, false);
      if (r.take.held.length === 0) closeRecording();
    } else {
      // Nothing played: no session, and no take without one.
      r.closed = true;
      recording = null;
    }
    publish({ phase: 'done', session, heard: NOTHING_HEARD });
  }

  function stopPlayback() {
    loadToken++;
    player?.stop();
    player = null;
  }

  function endPlayback() {
    player = null;
    releasePlaybackHold?.();
    releasePlaybackHold = null;
    follow(run);
    publish({ playback: null, loading: null });
  }

  return {
    getState: () => view,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(start) {
      run?.stop();
      stopPlayback();
      closeRecording();
      const spec: ImprovSpec = { ...start.spec, seed: newSeed() };
      const plan = improvPlan(spec);
      const id = newId();
      const startedAt = now();
      releaseHold = options.hold();
      const next = createBackingRun({
        plan,
        level: start.level,
        channel: start.channel,
        scheduler,
        clock,
        clicks: options.clicks(),
        click: start.click,
        countIn: true,
        onInterrupt: options.onInterrupt,
        onEnd: () => finish(),
      });
      run = next;
      const origin = next.start();
      recording = {
        id,
        plan,
        click: start.click,
        latency: start.latency,
        startedAt,
        take: startTake(origin, epochOf(origin), start.pedals, start.latency),
        sent: 0,
        chunks: 0,
        closed: false,
        ended: false,
      };
      stopCheckpoints = clock.every(CHECKPOINT_MS, checkpoint);
      follow(next);
      publish({
        phase: 'running',
        plan,
        click: start.click,
        heard: NOTHING_HEARD,
        session: null,
        playback: null,
        loading: null,
        missing: null,
      });
    },
    stop: () => run?.stop(),
    press(midi, velocity, time) {
      const r = recording;
      if (!r || r.ended) return;
      r.take = takeNoteOn(r.take, time, midi, velocity, -1);
      const at = time - r.take.origin - r.latency;
      const heard = new Map(view.heard);
      heard.set(midi, classifyNote(r.plan, midi, at));
      maybeChunk(r);
      publish({ heard });
    },
    release(midi, time) {
      const r = recording;
      if (!r) return;
      if (r.ended && !r.take.held.includes(midi)) return;
      r.take = takeNoteOff(r.take, time, midi);
      if (r.ended) {
        if (r.take.held.length === 0) closeRecording();
        return;
      }
      maybeChunk(r);
      if (view.heard.has(midi)) {
        const heard = new Map(view.heard);
        heard.delete(midi);
        publish({ heard });
      }
    },
    pedal(controller, value, time) {
      const r = recording;
      if (!r || r.ended) return;
      r.take = takePedal(r.take, time, controller, value);
      maybeChunk(r);
    },
    position: () => (player ?? run)?.position() ?? null,
    subscribeBeat(onChange) {
      beatListeners.add(onChange);
      return () => void beatListeners.delete(onChange);
    },
    playBack(session, sound) {
      if (run) return;
      stopPlayback();
      const token = ++loadToken;
      const plan = improvPlan(sessionSpec(session));
      const play = (events: readonly TakeEvent[], latency: number) => {
        if (token !== loadToken) return;
        const last = events.reduce((latest, e) => Math.max(latest, e[0]! - latency), 0);
        const notes = playedNotes(events, latency, Math.max(session.figures.ms, last)).filter(
          (n) => n.on >= -anticipation(plan),
        );
        releasePlaybackHold?.();
        releasePlaybackHold = options.hold();
        const next = createBackingRun({
          plan,
          level: sound.level,
          channel: sound.channel,
          scheduler,
          clock,
          clicks: null,
          click: false,
          countIn: false,
          onInterrupt: options.onInterrupt,
          extra: notes,
          until: session.figures.ms,
          onEnd: () => {
            if (player === next) endPlayback();
          },
        });
        player = next;
        next.start();
        follow(next);
        publish({ playback: { sessionId: session.id, plan, notes }, loading: null, missing: null });
      };
      // The loop just played is still here; an older one is read back.
      const own = recording?.id === session.id ? recording : null;
      if (own) {
        play(own.take.events, own.latency);
        return;
      }
      if (lastTake?.sessionId === session.id) {
        play(lastTake.events, lastTake.latency);
        return;
      }
      publish({ loading: session.id, missing: null });
      void practice.takes({ sessionId: session.id }).then(
        (chunks) => {
          if (token !== loadToken) return;
          if (chunks.length === 0) {
            publish({ loading: null, missing: session.id });
            return;
          }
          play(takeEvents(chunks), chunks[0]!.latency ?? 0);
        },
        () => {
          if (token === loadToken) publish({ loading: null });
        },
      );
    },
    stopPlayback() {
      stopPlayback();
      publish({ loading: null });
    },
    take(session) {
      // As playing back finds it: the loop just played is still here, an older one is read back.
      const own = recording?.id === session.id ? recording : null;
      if (own) {
        const { events, startedAt } = own.take;
        return Promise.resolve({ events, latency: own.latency, startedAt });
      }
      if (lastTake?.sessionId === session.id) return Promise.resolve(lastTake);
      return practice.takes({ sessionId: session.id }).then(
        (chunks) =>
          chunks.length === 0
            ? null
            : {
                events: takeEvents(chunks),
                latency: chunks[0]!.latency ?? 0,
                startedAt: chunks[0]!.startedAt,
              },
        () => null,
      );
    },
    close() {
      stopPlayback();
      closeRecording();
      publish({ phase: 'idle', session: null, heard: NOTHING_HEARD });
    },
    dispose() {
      run?.stop();
      stopPlayback();
      closeRecording();
      releasePlaybackHold?.();
      releasePlaybackHold = null;
    },
  };
}
