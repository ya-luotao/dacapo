import { useMemo } from 'react';
import { parseNoteKey, type LevelId } from '../../core/levels.ts';
import { formatPitch } from '../../core/note.ts';
import { useI18n } from '../../i18n/index.ts';

/** Locale-aware formatting of the figures shown on the Read route. */
export function useReadFormat() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return {
      percent: (value: number | null) => (value === null ? t('read.none') : percent.format(value)),
      seconds: (ms: number | null) =>
        ms === null ? t('read.none') : t('read.seconds', { value: decimal.format(ms / 1000) }),
      /** `C#4@bass` → `C♯4 (bass staff)`. */
      note: (key: string) => {
        const note = parseNoteKey(key);
        if (!note) return key;
        return t('read.noteOnStaff', {
          note: formatPitch(note.pitch),
          staff: t(`read.level.${note.clef}`),
        });
      },
      level: (id: LevelId) => `${id} · ${t(`read.level.${id}`)}`,
    };
  }, [t, locale]);
}

export type ReadFormat = ReturnType<typeof useReadFormat>;
