import { useState } from 'react';
import { Link } from 'wouter';
import { HARMONY_LEVELS } from '../core/chordSymbols.ts';
import { EAR_LEVELS } from '../core/earItems.ts';
import { goalOn } from '../core/goal.ts';
import { LEVELS } from '../core/levels.ts';
import { MAX_BPM, MIN_BPM } from '../core/pulse.ts';
import { RHYTHM_LEVELS } from '../core/rhythmCells.ts';
import { RHYTHM_EAR_LEVEL_IDS } from '../core/rhythmEar.ts';
import { SIGHT_LEVELS } from '../core/sightLevels.ts';
import { dayKey } from '../core/streak.ts';
import { THEORY_LEVELS } from '../core/theoryItems.ts';
import { TUNE_IDS } from '../core/tuneList.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { LESSONS } from '../learn/lessons.ts';
import { currentShell } from '../lib/shell.ts';
import { BUILT_IN_IDS } from '../pieces/library/ids.ts';
import { Arrow, FirstVisit } from '../ui/home/HomePage.tsx';
import { readGoal } from '../ui/progress/goal.ts';
import { PRINCIPLES, QUESTIONS } from '../ui/home/questions.ts';

/** The practices, each with a line and its size: what a search engine and a newcomer read first. */
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
    // Its minutes are today's goal, which the player may have chosen: filled in by the page.
    meta: 'home.progress.meta',
  },
];

/**
 * The site's home page in each language (docs/SITE.md), the page a search engine reads: the first
 * visit's title page, then the practices as contents, what makes dacapo what it is and what a
 * newcomer asks. The app's own home is Today for a returning player; these sections are on About.
 */
export function Landing() {
  const t = useT();
  const web = currentShell() === 'web';
  // The contents name today's goal: five minutes, unless another was chosen in Settings.
  const [goalMinutes] = useState(() => goalOn(readGoal(), dayKey(Date.now())));

  return (
    <div className="home">
      <FirstVisit />

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
                <span className="contents-meta">
                  {t(item.meta, item.path === '/progress' ? { n: goalMinutes } : item.values)}
                </span>
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
