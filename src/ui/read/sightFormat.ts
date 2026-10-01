import { useMemo } from 'react';
import type { SightKey, SightLevelId } from '../../core/sightLevels.ts';
import { SIGHT_MASTERY_SHARE, type SightLevelProgress } from '../../core/sightRead.ts';
import { useI18n } from '../../i18n/index.ts';
import { tonicName } from '../scales/format.ts';
import { useReadFormat } from './format.ts';

/** Locale-aware wording of Read's sight-reading: levels, keys, their progress. */
export function useSightFormat() {
  const { t } = useI18n();
  const read = useReadFormat();
  return useMemo(() => {
    const levelName = (id: SightLevelId) => t(`sight.level.${id}`);
    return {
      levelName,
      levelDetail: (id: SightLevelId) => t(`sight.level.${id}.detail`),
      level: (id: SightLevelId) => `${id} · ${levelName(id)}`,
      /** "D major", "F♯ minor". */
      key: (k: SightKey) => t(`theory.key.${k.mode}`, { tonic: tonicName(k.tonic) }),
      /** The level's figures towards mastery: how many of its last fragments were good enough. */
      stats: (p: SightLevelProgress) =>
        p.window.length === 0
          ? t('sight.level.none')
          : t('sight.level.stats', {
              passed: p.window.filter((s) => s >= SIGHT_MASTERY_SHARE).length,
              count: p.window.length,
            }),
      share: read.percent,
    };
  }, [t, read]);
}

export type SightFormat = ReturnType<typeof useSightFormat>;
