import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { lessonLinks, linkState, type PracticeLink } from '../../core/lessonLinks.ts';
import { dayKey } from '../../core/streak.ts';
import { useI18n } from '../../i18n/index.ts';
import type { LessonPractice } from '../../learn/lessons.ts';
import { useScaleKeyWords, useTaskFormat } from '../assignments/taskFormat.ts';
import { useNow } from '../progress/useNow.ts';
import { useInstrumentKeys } from '../instrument.ts';
import { readStartPref } from '../start/prefs.ts';
import { practiceLinkPath } from '../startParams.ts';
import { useTodayFormat } from '../today/format.ts';
import { useTodayRecords } from '../today/useTodayRecords.ts';
import { useLessonsDone } from './progress.ts';

/**
 * Practise it (docs/LEARN.md, "Practise it goes to the thing itself"): a lesson's one or two
 * links, each opening its practice with its settings as a task's button does, and saying what it
 * opens ("Practise it: Read · Rhythm · R1"). They are resolved against where the reader stands
 * now; until the records are read each leads to its page. Loaded apart from the lesson's text:
 * resolving them takes the mastery rule of every practice, as today's plan does.
 */
export function PracticeLinks({ practice }: { practice: readonly LessonPractice[] }) {
  const { t } = useI18n();
  const today = useTodayFormat();
  const tasks = useTaskFormat(useScaleKeyWords());
  const records = useTodayRecords();
  const lessonsDone = useLessonsDone();
  const day = dayKey(useNow());
  // Where the visitor said they start from (docs/START.md): Read's notes begin at a player's
  // floor here as on the Read page, and a player has a piece to begin.
  const [start] = useState(readStartPref);
  // The player's keyboard: a scale that runs beyond it is not the next one.
  const keys = useInstrumentKeys();
  const links = useMemo(
    () =>
      lessonLinks(
        practice,
        records && linkState(records, { today: day, lessonsDone, start, keys }),
      ),
    [practice, records, day, lessonsDone, start, keys],
  );

  /** What a link opens, by the names the pages, the plan and the checklist give it. */
  const name = (link: PracticeLink): string => {
    switch (link.kind) {
      case 'page':
        return t(`nav.${link.page}`);
      case 'level':
        return tasks.title({
          kind: 'level',
          id: '',
          family: link.family,
          level: link.level,
          goal: 1,
        });
      case 'scale':
        return today.exercise(link.exercise);
      case 'piece':
        return today.pieceTitle(link.id) ?? t('nav.pieces');
    }
  };

  return (
    <div className="lesson-practice">
      {links.map((link, i) => (
        <Link
          key={i}
          href={practiceLinkPath(link)}
          className={i === 0 ? 'button button-primary' : 'button'}
        >
          {t('learn.practice', { what: name(link) })}
        </Link>
      ))}
    </div>
  );
}
