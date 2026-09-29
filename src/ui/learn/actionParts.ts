// The parts of the piano action the drawing names (PianoActionDrawing.tsx).

export type PartId =
  | 'key'
  | 'capstan'
  | 'wippen'
  | 'jack'
  | 'letoff'
  | 'repetition'
  | 'hammer'
  | 'backcheck'
  | 'damper'
  | 'string'
  | 'soundboard';

export const PART_IDS: readonly PartId[] = [
  'key',
  'capstan',
  'wippen',
  'jack',
  'letoff',
  'repetition',
  'hammer',
  'backcheck',
  'damper',
  'string',
  'soundboard',
];
