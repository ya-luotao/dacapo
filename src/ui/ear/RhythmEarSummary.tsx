import { useMemo } from 'react';
import type { CardAction, CardAdvice } from '../../core/advice.ts';
import { getRhythmLevel } from '../../core/rhythmCells.ts';
import {
  nextRhythmEarLevel,
  type RhythmEarLevelProgress,
  type RhythmEarSessionSummary,
} from '../../core/rhythmEar.ts';
import { useT } from '../../i18n/index.ts';
import { SummaryEnd } from '../SummaryEnd.tsx';
import { useReadFormat } from '../read/format.ts';
import { useRhythmFormat } from '../read/rhythmFormat.ts';
import { useRhythmEarFormat } from './rhythmEarFormat.ts';

interface RhythmEarSummaryProps {
  summary: RhythmEarSessionSummary;
  progress: RhythmEarLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
  /** What to work on next (docs/ADVICE.md, "Cards"), and what its button does. */
  advice?: CardAdvice | null;
  onAdvice?: (action: CardAction) => void;
}

/** A session of rhythm dictation, done or stopped: its figures, what to work on, mastery. */
export function RhythmEarSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
  advice,
  onAdvice,
}: RhythmEarSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const rhythm = useRhythmFormat();
  const format = useRhythmEarFormat();
  const complete = summary.questions >= summary.length;
  const next = nextRhythmEarLevel(summary.level);
  const level = rhythm.level(summary.level);
  const tapBack = summary.by === 'play';
  const compound = getRhythmLevel(summary.level).meters.includes('6/8');
  // Each miss once, with how often, the most frequent first.
  const missed = useMemo(() => {
    const counts = new Map<string, { text: string; count: number }>();
    for (const m of summary.missed) {
      const text = format.miss(m, summary.by);
      const seen = counts.get(text);
      if (seen) seen.count++;
      else counts.set(text, { text, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [summary, format]);

  return (
    <section className="read-summary ear-summary" aria-labelledby="ear-summary-title">
      <h2 id="ear-summary-title">{t(complete ? 'read.summary.done' : 'read.summary.stopped')}</h2>
      <p className="muted">
        {level} · {t(`ear.rhythm.by.${summary.by}`)} ·{' '}
        {rhythm.tempo(compound ? '6/8' : null, summary.bpm)}
      </p>

      <dl className="figures ear-figures">
        <div>
          <dt>{t('ear.rhythm.summary.bars')}</dt>
          <dd>{summary.questions}</dd>
        </div>
        <div>
          <dt>{t(tapBack ? 'rhythm.summary.cells' : 'read.summary.accuracy')}</dt>
          <dd>{read.percent(summary.accuracy)}</dd>
        </div>
        <div>
          <dt>{t(tapBack ? 'rhythm.summary.median' : 'ear.summary.median')}</dt>
          <dd>{tapBack ? rhythm.ms(summary.medianDeviation) : read.seconds(summary.medianMs)}</dd>
        </div>
        <div>
          <dt>{t('ear.summary.replays')}</dt>
          <dd>{summary.replays}</dd>
        </div>
      </dl>

      <div className="note-list ear-missed">
        <h3>{t(tapBack ? 'rhythm.summary.missed' : 'ear.summary.missed')}</h3>
        {missed.length > 0 ? (
          <ul>
            {missed.map((m) => (
              <li key={m.text}>
                {m.text}
                {m.count > 1 && (
                  <span className="muted"> {t('rhythm.summary.times', { n: m.count })}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('read.summary.none')}</p>
        )}
      </div>

      <SummaryEnd
        family="rhythmEar"
        level={level}
        mastery={{
          mastered: progress.mastered,
          text: progress.mastered
            ? t('read.summary.mastered', { level })
            : t('read.summary.progress', { level, stats: format.levelStats(progress) }),
        }}
        percent={read.percent(summary.accuracy)}
        advice={advice}
        onAdvice={onAdvice}
        onAgain={onAgain}
        onNextLevel={next ? onNextLevel : null}
        onChooseLevel={onChooseLevel}
      />
    </section>
  );
}
