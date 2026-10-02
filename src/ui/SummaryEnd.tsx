import type { ReactNode } from 'react';
import type { CardAction, CardAdvice } from '../core/advice.ts';
import type { LevelFamily } from '../core/assignmentRecords.ts';
import { pageOfFamily } from '../core/assignments.ts';
import { SENTENCE_GAP, useI18n } from '../i18n/index.ts';
import { Advice } from './Advice.tsx';
import { familyKey, levelKey } from './assignments/taskFormat.ts';

interface SummaryEndProps {
  /** The family the session was of, and its level by name ("L3 · Bass: middle C position"). */
  family: LevelFamily;
  level: string;
  /** Where the level stands: mastered, or how far towards it, in the summary's own words. */
  mastery: { mastered: boolean; text: string };
  /** The share of the session's answers right, as the summary writes it. */
  percent: string;
  /** What to work on next (docs/ADVICE.md, "Cards"); null when no rule applied. */
  advice?: CardAdvice | null;
  onAdvice?: (action: CardAction) => void;
  onAgain: () => void;
  /** Null after the family's last level. */
  onNextLevel: (() => void) | null;
  onChooseLevel: () => void;
  /** A family's own words for the two buttons (a tune is no level). */
  labels?: { next?: string; choose?: string };
  /** A family's own buttons, after Again. */
  children?: ReactNode;
}

/**
 * The end of a summary of cards, the same for every family of Read, Ear and Harmony: where the
 * level stands, one sentence of advice at most (the level mastered just now, or a level too far)
 * and the buttons. The sentence's button leads them and is the one focused on arrival; without
 * one that is Again, as ever. "Practise these" has no sentence: it is a button among the others,
 * whenever the session has items for it.
 */
export function SummaryEnd({
  family,
  level,
  mastery,
  percent,
  advice = null,
  onAdvice,
  onAgain,
  onNextLevel,
  onChooseLevel,
  labels,
  children,
}: SummaryEndProps) {
  const { t, locale } = useI18n();
  const levelName = (id: string) =>
    family === 'tune' ? t(levelKey(family, id)) : `${id} · ${t(levelKey(family, id))}`;
  const familyName = (f: LevelFamily) => [t(`nav.${pageOfFamily(f)}`), t(familyKey(f))].join(' · ');
  const nextLabel = labels?.next ?? t('read.nextLevel');

  const say = advice?.say ?? null;
  const masteredNow = say?.rule === 'mastered';
  const action = say && onAdvice ? say.action : null;
  const text =
    say?.rule === 'mastered'
      ? [
          t('read.advice.mastered', { level }),
          ...(say.action?.kind === 'family'
            ? [t('read.advice.next', { family: familyName(say.action.family) })]
            : []),
        ].join(SENTENCE_GAP[locale])
      : say?.rule === 'tooFar'
        ? t('read.advice.tooFar', { percent, below: levelName(say.below) })
        : null;
  // The sentence's button: the next level, the family to go on with, or the level below.
  const lead =
    action === null
      ? null
      : masteredNow
        ? action.kind === 'family'
          ? familyName(action.family)
          : nextLabel
        : levelName(action.level);
  const practise = advice && onAdvice ? advice.practise : null;

  return (
    <>
      {/* Mastered just now: the advice says so, once. */}
      {!masteredNow && (
        <p className={mastery.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
          {mastery.text}
        </p>
      )}
      {text && (
        <div className={masteredNow ? 'card-advice is-mastered' : 'card-advice'}>
          <Advice text={text} />
        </div>
      )}
      <div className="actions">
        {lead !== null && action && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => onAdvice?.(action)}
            autoFocus
          >
            {lead}
          </button>
        )}
        {/* Focused on arrival unless the advice has a button: Enter or Space starts again. */}
        <button
          type="button"
          className={lead === null ? 'button button-primary' : 'button'}
          onClick={onAgain}
          autoFocus={lead === null}
        >
          {t('read.again')}
        </button>
        {practise && (
          <button type="button" className="button" onClick={() => onAdvice?.(practise)}>
            {t('read.practise')}
          </button>
        )}
        {children}
        {onNextLevel && !(masteredNow && action?.kind === 'level') && (
          <button type="button" className="button" onClick={onNextLevel}>
            {nextLabel}
          </button>
        )}
        <button type="button" className="button" onClick={onChooseLevel}>
          {labels?.choose ?? t('read.chooseLevel')}
        </button>
      </div>
    </>
  );
}
