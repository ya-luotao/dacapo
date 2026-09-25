import { useT } from '../../i18n/index.ts';

/** A note value (in quarter notes) as an engraved glyph: half, quarter, eighth, dotted. */
export function NoteValue({ unit, className }: { unit: number; className?: string }) {
  const dotted = unit === 1.5 || unit === 3;
  const base = dotted ? unit / 1.5 : unit;
  const open = base >= 2;
  return (
    <svg className={className ?? 'note-value'} viewBox="0 0 18 26" aria-hidden="true">
      <ellipse
        cx="6"
        cy="20.5"
        rx="4.6"
        ry="3.2"
        transform="rotate(-22 6 20.5)"
        className={open ? 'is-open' : undefined}
      />
      <path d="M10.1 19.6V3" className="note-stem" />
      {base === 0.5 && <path d="M10.1 3c.6 3.6 5.6 5 4.3 10.4 1.5-5.4-2-6.6-4.3-7.2z" />}
      {dotted && <circle cx="15.6" cy="21" r="1.35" />}
    </svg>
  );
}

const UNIT_KEYS = {
  0.5: 'metronome.unit.eighth',
  1: 'metronome.unit.quarter',
  1.5: 'metronome.unit.dottedQuarter',
  2: 'metronome.unit.half',
  3: 'metronome.unit.dottedHalf',
} as const;

/** "♩ = 120", with the note of the meter's beat and a spoken form. */
export function TempoMark({
  unit,
  bpm,
  className,
}: {
  unit: number;
  bpm: number;
  className?: string;
}) {
  const t = useT();
  const key = UNIT_KEYS[unit as keyof typeof UNIT_KEYS] ?? UNIT_KEYS[1];
  return (
    <span
      className={className ?? 'tempo-mark'}
      role="img"
      aria-label={t('metronome.mark', { unit: t(key), bpm })}
    >
      <NoteValue unit={unit} />
      <span aria-hidden="true">= {bpm}</span>
    </span>
  );
}
