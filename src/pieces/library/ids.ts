// The built-in pieces by id, in the library's order. Apart from what the library says of each
// (index.ts: the edition, the facts, some 19 kB), because the home page, which is loaded when the
// app starts, only counts them.

export const BUILT_IN_IDS = [
  'turk-aller-anfang',
  'beethoven-ode-to-joy',
  'czerny-op599-no11',
  'turk-muntere-knabe',
  'beyer-kinderlied',
  'turk-hans-ohne-sorgen',
  'turk-matt-und-krank',
  'turk-bey-der-wiege',
  'beyer-abendlied',
  'beyer-op101-no66',
  'schumann-melodie',
  'petzold-minuet-in-g',
  'burgmuller-arabesque',
  'schumann-soldiers-march',
  'beethoven-fur-elise',
  'bach-prelude-in-c',
  'petzold-minuet-in-g-minor',
  'bach-musette-in-d',
  'burgmuller-candeur',
  'tchaikovsky-old-french-song',
  'tchaikovsky-morning-prayer',
  'chopin-prelude-in-c-minor',
  'satie-gymnopedie-1',
  'trad-twinkle-twinkle',
  'trad-frere-jacques',
  'lyte-row-your-boat',
  'trad-amazing-grace',
  'pierpont-jingle-bells',
  'foster-oh-susanna',
  'trad-auld-lang-syne',
  'trad-swing-low',
] as const;

export type BuiltInId = (typeof BUILT_IN_IDS)[number];
