import { useId, useState } from 'react';
import type { StartingPoint } from '../../core/startingPoint.ts';
import { useT } from '../../i18n/index.ts';
import { readStartPref, writeStartPref } from '../start/prefs.ts';
import { StartingPointFields } from '../start/StartingPointFields.tsx';

/**
 * Your starting point (docs/START.md): the start page's first question, to answer or change at
 * any time. It is kept on this device; today's plan stays as it is, and the next one follows.
 */
export function StartSection() {
  const t = useT();
  const id = useId();
  const [start, setStart] = useState(readStartPref);

  function change(next: StartingPoint) {
    setStart(next);
    writeStartPref(next);
  }

  return (
    <section className="field data start-point" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('settings.start')}</h2>
      <p className="help">{t('settings.start.help')}</p>
      <StartingPointFields value={start} onChange={change} />
    </section>
  );
}
