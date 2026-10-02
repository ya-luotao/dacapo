import { useId, useMemo, useState, type ReactNode } from 'react';
import type { LessonLanguage } from '../../learn/lessons.ts';
import { LetterNames } from '../LetterNames.tsx';
import { LessonContext, useCopy } from './lesson.ts';

// The parts of a lesson's page: the lesson itself (its language, and which exercise listens),
// sections, numbered plates, notes in the margin, pictures and a row of choices.

export function LessonProvider({
  slug,
  language,
  children,
}: {
  slug: string;
  language: LessonLanguage;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const value = useMemo(() => ({ slug, language, active, setActive }), [slug, language, active]);
  // A lesson teaches the letters: its text, its figures and their keyboards keep them whatever
  // the note names chosen in Settings (docs/PERSONAL.md).
  return (
    <LessonContext value={value}>
      <LetterNames>{children}</LetterNames>
    </LessonContext>
  );
}

// The page.

/** A section of the lesson; its title is listed in the lesson's contents. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="lesson-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** A figure to look at or play with, numbered like the plates of a method book. */
export function Plate({
  caption,
  wide = false,
  children,
}: {
  caption?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const copy = useCopy();
  return (
    <figure className={wide ? 'plate is-wide' : 'plate'}>
      <div className="plate-body">{children}</div>
      {caption && (
        <figcaption className="plate-caption">
          <span className="plate-number">{copy('plate')} </span>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** A note in the margin: a rhyme to remember, a tip, a warning. */
export function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="lesson-aside">
      <p className="lesson-aside-title">{title}</p>
      {children}
    </aside>
  );
}

/** A picture: an etching painted for the lesson, 3:2. */
export function Picture({ src, alt, caption }: { src: string; alt: string; caption?: ReactNode }) {
  return (
    <figure className="lesson-picture">
      <img
        src={`${import.meta.env.BASE_URL}${src}`}
        alt={alt}
        width={1200}
        height={800}
        loading="lazy"
        decoding="async"
      />
      {caption && <figcaption className="plate-caption">{caption}</figcaption>}
    </figure>
  );
}

/** A button that plays what a figure shows: Listen, or a label of its own. */
export function PlayButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const copy = useCopy();
  return (
    <button type="button" className="button is-compact" onClick={onClick}>
      <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
        <path d="M1 1l8 5-8 5z" />
      </svg>
      {label ?? copy('listen')}
    </button>
  );
}

/** A row of choices over a figure, drawn as the app's segmented control. */
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** The group's name for assistive technology, when the options alone do not say it. */
  label?: string;
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      className={`segmented is-compact plate-choices${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
