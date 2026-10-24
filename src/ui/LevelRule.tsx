import type { ReactNode } from 'react';
import { useT } from '../i18n/index.ts';

/**
 * How a level is mastered, folded under one question: the rule matters once, not on every visit
 * to a setup. `id` is the paragraph's, for the level list's `aria-describedby`.
 */
export function LevelRule({ id, children }: { id: string; children: ReactNode }) {
  const t = useT();
  return (
    <details className="level-rule">
      <summary>{t('level.rule.ask')}</summary>
      <p id={id} className="help">
        {children}
      </p>
    </details>
  );
}
