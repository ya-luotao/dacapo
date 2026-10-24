import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { currentAssignments } from '../../core/assignmentRecords.ts';
import { dayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { readLegacyLessons } from '../learn/progress.ts';
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

/** The tagline's sentences, each set on its own line: "Read the staff." / "Find the key." */
function sentences(text: string): string[] {
  return text.split(/(?<=[.。])\s*/).filter(Boolean);
}

export function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * Whether the visitor has practised here before: a session stored, or a lesson ticked; or has
 * said on the start page where they start from (docs/START.md). The answer is read at once. The
 * sessions and the ticks are records and take a moment to read, so until they are in, what was
 * known last time (kept in the browser) decides, and the page is laid out right before the
 * records are read. Ticks an earlier version kept in the preferences say so at once as well:
 * they are moved into the records as those are read, and whoever has only them never sees the
 * first visit's page. When the records cannot be read (no storage to use, a database of a later
 * version, a read that failed) what was known last time goes on deciding, with what this tab
 * holds, and is never cleared: only records read and found empty say "a first visit".
 */
function useReturning(): boolean {
  const { loaded, read } = useStorageStatus();
  const { sessions, lessons } = usePractice();
  const [answered] = useState(() => readStartPref() !== null);
  const [known] = useState(() => readReturning() || readLegacyLessons().length > 0);
  const practised = sessions.length > 0 || lessons.length > 0;
  const returning = answered || practised || (!read && known);
  useEffect(() => {
    // Kept once the store has loaded; cleared only by records that were read.
    if (read || (loaded && returning)) writeReturning(returning);
  }, [loaded, read, returning]);
  return returning;
}

/**
 * A first visit: the tagline, the lede and the specimen, and the way to the start page (where
 * you start from, and whether your keys are heard). Someone sent an assignment before they ever
 * practised here has it under them.
 */
export function FirstVisit() {
  const t = useT();
  const { loaded } = useStorageStatus();
  const { assignments } = usePractice();
  const today = dayKey(useNow());
  const assigned = loaded && currentAssignments(assignments, today).length > 0;

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-text">
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
 * the plan for the day and the keyboard under it (docs/TODAY.md). The practices are in the
 * navigation; what a newcomer asks is answered on About.
 */
export function HomePage() {
  const returning = useReturning();
  return <div className="home">{returning ? <Today /> : <FirstVisit />}</div>;
}
