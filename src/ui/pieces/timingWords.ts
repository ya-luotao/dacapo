import { useT } from '../../i18n/index.ts';

/** How a note was timed, in words: "23 ms late", "on the beat", "missed". */
export function useTimingWords() {
  const t = useT();
  return (deviation: number | null) => {
    if (deviation === null) return t('pieces.rhythm.table.missed');
    const ms = Math.round(Math.abs(deviation));
    if (ms === 0) return t('pieces.timing.onBeat');
    return deviation > 0 ? t('pieces.timing.late', { ms }) : t('pieces.timing.early', { ms });
  };
}
