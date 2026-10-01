// The tunes of the Ear page (docs/HARMONY.md, "Playing by ear (H5)"): which they are and how many
// phrases each has, which is all that the levels, the items and the mastery need. The melodies
// themselves are in tuneData.ts, which only the Ear page and the validators load.

/** The library's lead sheets, in the library's order (the easiest first). */
export const TUNE_IDS = [
  'trad-twinkle-twinkle',
  'trad-frere-jacques',
  'lyte-row-your-boat',
  'trad-amazing-grace',
  'pierpont-jingle-bells',
  'foster-oh-susanna',
  'trad-auld-lang-syne',
  'trad-swing-low',
] as const;
export type TuneId = (typeof TUNE_IDS)[number];

export const isTuneId = (v: unknown): v is TuneId =>
  typeof v === 'string' && (TUNE_IDS as readonly string[]).includes(v);

/** The phrases of each tune as it is sung, a repeated section's twice (a test holds it to tuneData.ts). */
export const TUNE_PHRASES: Readonly<Record<TuneId, number>> = {
  'trad-twinkle-twinkle': 6,
  'trad-frere-jacques': 5,
  'lyte-row-your-boat': 4,
  'trad-amazing-grace': 4,
  'pierpont-jingle-bells': 8,
  'foster-oh-susanna': 8,
  'trad-auld-lang-syne': 12,
  'trad-swing-low': 12,
};

/** A phrase of a tune (1-based, in the order sung), or the whole tune. */
export type TunePart = number | 'whole';
export const WHOLE_TUNE = 'whole';

/** `tune:trad-amazing-grace:2`, `tune:trad-amazing-grace:whole`. */
export const tuneItem = (tune: TuneId, part: TunePart) => `tune:${tune}:${part}`;

/** The part an item's last field names, when the tune has it. */
export function tunePartOf(tune: TuneId, field: string | undefined): TunePart | null {
  if (field === WHOLE_TUNE) return WHOLE_TUNE;
  if (field === undefined || !/^[1-9]\d?$/.test(field)) return null;
  const phrase = Number(field);
  return phrase <= TUNE_PHRASES[tune] ? phrase : null;
}

/** `tune:<id>:<phrase>` or `tune:<id>:whole`, of a tune and a part it has; null otherwise. */
export function parseTuneItem(item: string): { tune: TuneId; part: TunePart } | null {
  const [kind, id, field, ...rest] = item.split(':');
  if (kind !== 'tune' || rest.length > 0 || !isTuneId(id)) return null;
  const part = tunePartOf(id, field);
  return part === null ? null : { tune: id, part };
}

/** What a session of a tune asks, in order: its phrases, then the whole tune. */
export function tuneItems(tune: TuneId): string[] {
  const phrases = Array.from({ length: TUNE_PHRASES[tune] }, (_, i) => tuneItem(tune, i + 1));
  return [...phrases, tuneItem(tune, WHOLE_TUNE)];
}
