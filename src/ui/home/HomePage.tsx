import { useMemo } from 'react';
import { Link } from 'wouter';
import { EAR_LEVELS } from '../../core/earItems.ts';
import { RHYTHM_LEVELS } from '../../core/rhythmCells.ts';
import { THEORY_LEVELS } from '../../core/theoryItems.ts';
import { LEVELS } from '../../core/levels.ts';
import { LESSONS } from '../../learn/lessons.ts';
import { MAX_BPM, MIN_BPM } from '../../core/pulse.ts';
import { practiceLog, STREAK_GOAL_MS } from '../../core/streak.ts';
import { useT, type MessageKey } from '../../i18n/index.ts';
import { currentShell } from '../../lib/shell.ts';
import { BUILT_IN_IDS } from '../../pieces/library/index.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { useNow } from '../progress/useNow.ts';
import { Specimen } from './Specimen.tsx';

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
    values: { n: LEVELS.length + THEORY_LEVELS.length + RHYTHM_LEVELS.length },
  },
  {
    path: '/ear',
    numeral: 'III',
    title: 'nav.ear',
    text: 'home.ear.text',
    meta: 'home.ear.meta',
    values: { n: EAR_LEVELS.length },
  },
  {
    path: '/scales',
    numeral: 'IV',
    title: 'nav.scales',
    text: 'home.scales.text',
    meta: 'home.scales.meta',
  },
  {
    path: '/pieces',
    numeral: 'V',
    title: 'nav.pieces',
    text: 'home.pieces.text',
    meta: 'home.pieces.meta',
    values: { n: BUILT_IN_IDS.length },
  },
  {
    path: '/metronome',
    numeral: 'VI',
    title: 'nav.metronome',
    text: 'home.metronome.text',
    meta: 'home.metronome.meta',
    values: { min: MIN_BPM, max: MAX_BPM },
  },
  {
    path: '/progress',
    numeral: 'VII',
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

/** For a returning player: today, the streak and the way to the rest. */
function Welcome() {
  const t = useT();
  const format = useLogFormat();
  const { sessions } = usePractice();
  const now = useNow();
  const log = useMemo(() => practiceLog(sessions, { now }), [sessions, now]);
  const reached = log.todayMs >= STREAK_GOAL_MS;

  return (
    <section className="home-welcome" aria-labelledby="home-welcome">
      <h2 id="home-welcome" className="eyebrow">
        {t('home.welcome')}
      </h2>
      <dl className="figures">
        <div>
          <dt>{t('progress.today')}</dt>
          <dd>{format.minutes(log.todayMs)}</dd>
        </div>
        <div>
          <dt>{t('progress.streak')}</dt>
          <dd>{format.days(log.currentStreak)}</dd>
        </div>
        <div>
          <dt>{t('progress.longest')}</dt>
          <dd>{format.days(log.longestStreak)}</dd>
        </div>
      </dl>
      <p className="home-welcome-end">
        <span className={reached ? 'goal is-reached' : 'goal'}>
          {reached
            ? t('progress.today.reached')
            : t('progress.today.toGo', {
                n: Math.ceil((STREAK_GOAL_MS - log.todayMs) / MINUTE_MS),
              })}
        </span>
        <Link href="/progress" className="home-link">
          {t('home.welcome.link')}
          <Arrow />
        </Link>
      </p>
    </section>
  );
}

/**
 * The first page: what dacapo is and the way in, the practices it has as a contents page, and in
 * the web app the questions a newcomer asks. It is also the page search engines read.
 */
export function HomePage() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { sessions } = usePractice();
  const web = currentShell() === 'web';

  return (
    <div className="home">
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
            <Link href="/read" className="button button-primary button-large">
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

      {loaded && sessions.length > 0 && <Welcome />}

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
