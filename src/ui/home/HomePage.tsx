import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { HARMONY_LEVELS } from '../../core/chordSymbols.ts';
import { EAR_LEVELS } from '../../core/earItems.ts';
import { RHYTHM_LEVELS } from '../../core/rhythmCells.ts';
import { RHYTHM_EAR_LEVEL_IDS } from '../../core/rhythmEar.ts';
import { SIGHT_LEVELS } from '../../core/sightLevels.ts';
import { TUNE_IDS } from '../../core/tuneList.ts';
import { THEORY_LEVELS } from '../../core/theoryItems.ts';
import { currentAssignments } from '../../core/assignmentRecords.ts';
import { LEVELS } from '../../core/levels.ts';
import { LESSONS } from '../../learn/lessons.ts';
import { MAX_BPM, MIN_BPM } from '../../core/pulse.ts';
import { dayKey, STREAK_GOAL_MS } from '../../core/streak.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { currentShell } from '../../lib/shell.ts';
import { BUILT_IN_IDS } from '../../pieces/library/index.ts';
import { readDone } from '../learn/progress.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { readStartPref } from '../start/prefs.ts';
import { readReturning, writeReturning } from '../today/prefs.ts';
import { Specimen } from './Specimen.tsx';
import { Today } from './Today.tsx';

// The current assignment's open tasks: loaded only when there is one (ui/assignments/).
const HomeAssignment = lazy(() =>
  import('../assignments/HomeAssignment.tsx').then((m) => ({ default: m.HomeAssignment })),
);

const MINUTE_MS = 60_000;

/** The contents, like the first page of a method book: each practice, numbered as a movement. */
const CONTENTS: readonly {
  path: string;
  numeral: string;
  title: MessageKey;
  text: MessageKey;
  meta: MessageKey;
  values?: Record<string, number>;
}[] = [
  {
    path: '/learn',
    numeral: 'I',
    title: 'nav.learn',
    text: 'home.learn.text',
    meta: 'home.learn.meta',
    values: { n: LESSONS.filter((lesson) => lesson.ready).length },
  },
  {
    path: '/read',
    numeral: 'II',
    title: 'nav.read',
    text: 'home.read.text',
    meta: 'home.read.meta',
    values: {
      n: LEVELS.length + THEORY_LEVELS.length + RHYTHM_LEVELS.length + SIGHT_LEVELS.length,
    },
  },
  {
    path: '/ear',
    numeral: 'III',
    title: 'nav.ear',
    text: 'home.ear.text',
    meta: 'home.ear.meta',
    // The tunes are counted apart: each is a tune, not a level.
    values: {
      n: EAR_LEVELS.length - TUNE_IDS.length + RHYTHM_EAR_LEVEL_IDS.length,
      tunes: TUNE_IDS.length,
    },
  },
  {
    path: '/harmony',
    numeral: 'IV',
    title: 'nav.harmony',
    text: 'home.harmony.text',
    meta: 'home.harmony.meta',
    values: { n: HARMONY_LEVELS.length },
  },
  {
    path: '/scales',
    numeral: 'V',
    title: 'nav.scales',
    text: 'home.scales.text',
    meta: 'home.scales.meta',
  },
  {
    path: '/pieces',
    numeral: 'VI',
    title: 'nav.pieces',
    text: 'home.pieces.text',
    meta: 'home.pieces.meta',
    values: { n: BUILT_IN_IDS.length },
  },
  {
    path: '/metronome',
    numeral: 'VII',
    title: 'nav.metronome',
    text: 'home.metronome.text',
    meta: 'home.metronome.meta',
    values: { min: MIN_BPM, max: MAX_BPM },
  },
  {
    path: '/progress',
    numeral: 'VIII',
    title: 'nav.progress',
    text: 'home.progress.text',
    meta: 'home.progress.meta',
    values: { n: STREAK_GOAL_MS / MINUTE_MS },
  },
];

const PRINCIPLES: readonly [MessageKey, MessageKey][] = [
  ['home.principle.keyboard', 'home.principle.keyboard.text'],
  ['home.principle.private', 'home.principle.private.text'],
  ['home.principle.open', 'home.principle.open.text'],
  ['home.principle.languages', 'home.principle.languages.text'],
];

const QUESTIONS: readonly [MessageKey, MessageKey][] = [
  ['home.faq.midi.q', 'home.faq.midi.a'],
  ['home.faq.browser.q', 'home.faq.browser.a'],
  ['home.faq.free.q', 'home.faq.free.a'],
  ['home.faq.data.q', 'home.faq.data.a'],
];

/** The tagline's sentences, each set on its own line: "Read the staff." / "Find the key." */
function sentences(text: string): string[] {
  return text.split(/(?<=[.。])\s*/).filter(Boolean);
}

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * Whether the visitor has practised here before: a session stored, or a lesson ticked; or has
 * said on the start page where they start from (docs/START.md). The ticks and the answer are
 * read at once; the sessions take a moment, so until they are in, what was known last time (kept
 * in the browser) decides, and the page is laid out right before the records are read.
 */
function useReturning(): boolean {
  const { loaded } = useStorageStatus();
  const { sessions } = usePractice();
  const [ticked] = useState(() => readDone().size > 0);
  const [answered] = useState(() => readStartPref() !== null);
  const [known] = useState(readReturning);
  const returning = ticked || answered || (loaded ? sessions.length > 0 : known);
  useEffect(() => {
    if (loaded) writeReturning(returning);
  }, [loaded, returning]);
  return returning;
}

/**
 * A first visit: the tagline, the lede and the specimen, and the way to the start page (where
 * you start from, and whether your keys are heard). Someone sent an assignment before they ever
 * practised here has it under them.
 */
function FirstVisit() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const today = dayKey(useNow());
  const assigned = loaded && currentAssignments(assignments, today).length > 0;

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-text">
          <p className="eyebrow">{t('home.eyebrow')}</p>
          <h1 id="home-title" className="home-title">
            {sentences(t('app.tagline')).map((sentence, i) => (
              <span key={i}>{sentence}</span>
            ))}
          </h1>
          <p className="home-lede">{t('home.lede')}</p>
          <div className="home-actions">
            <Link href="/start" className="button button-primary button-large">
              {t('home.start')}
              <Arrow />
            </Link>
            <Link href="/play" className="home-link">
              {t('home.play')}
            </Link>
          </div>
          <p className="home-facts">{t('home.facts')}</p>
        </div>
        <Specimen />
      </section>

      {assigned && (
        <Suspense fallback={null}>
          <HomeAssignment />
        </Suspense>
      )}
    </>
  );
}

/**
 * The first page. A first visit: what dacapo is and the way in. A returning player: today, with
 * the figures of the practice log and the plan for the day (docs/TODAY.md). Then the practices
 * as a contents page, and in the web app the questions a newcomer asks. It is also the page
 * search engines read.
 */
export function HomePage() {
  const t = useT();
  const returning = useReturning();
  const web = currentShell() === 'web';

  return (
    <div className="home">
      {returning ? <Today /> : <FirstVisit />}

      <section className="home-contents" aria-labelledby="home-contents">
        <h2 id="home-contents" className="eyebrow">
          {t('home.contents')}
        </h2>
        <ol className="contents">
          {CONTENTS.map((item) => (
            <li key={item.path}>
              <Link href={item.path} className="contents-row">
                <span className="contents-numeral" aria-hidden="true">
                  {item.numeral}
                </span>
                <span className="contents-body">
                  <span className="contents-title">{t(item.title)}</span>
                  <span className="contents-text">{t(item.text)}</span>
                </span>
                <span className="contents-meta">{t(item.meta, item.values)}</span>
                <Arrow />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-principles" aria-labelledby="home-principles">
        <h2 id="home-principles">{t('home.principles')}</h2>
        <dl>
          {PRINCIPLES.map(([title, text]) => (
            <div key={title}>
              <dt>{t(title)}</dt>
              <dd>{t(text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {web && (
        <section className="home-faq" aria-labelledby="home-faq">
          <h2 id="home-faq">{t('home.faq')}</h2>
          <div className="home-faq-list">
            {QUESTIONS.map(([q, a]) => (
              <details key={q} className="home-question">
                <summary>{t(q)}</summary>
                <p>{t(a)}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
