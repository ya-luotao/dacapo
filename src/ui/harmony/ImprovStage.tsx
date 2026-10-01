import { useMemo } from 'react';
import {
  BACKINGS,
  chordOfBar,
  isCallBar,
  loopBar,
  loopBars,
  type ImprovPlan,
  type NoteClass,
} from '../../core/improv.ts';
import { useT } from '../../i18n/index.ts';
import type { PointerInput } from '../../input/index.ts';
import { Piano } from '../piano/Piano.tsx';
import { useHarmonyFormat } from './format.ts';
import { NumeralsText } from './NumeralsText.tsx';
import { IMPROV_KEYS, type LoopPlace } from './improvPlace.ts';
import { SymbolText } from './SymbolText.tsx';

// What Improvise shows while a backing plays, live or played back: the chord now and the next,
// large; the loop's bars as a lead sheet lays them out, the one playing lit; the keyboard with the
// scale marked lightly, the chord's tones a shade darker, and each key held tinted as it sounds.

/** The chord now and the next, large, and with call and response whose turn it is. */
export function NowNext({ plan, place }: { plan: ImprovPlan; place: LoopPlace }) {
  const t = useT();
  const format = useHarmonyFormat();
  const now = chordOfBar(plan, place.bar);
  const next = chordOfBar(plan, place.bar + 1);
  const numeral = BACKINGS[plan.spec.backing].bars[loopBar(plan, place.bar)]!;
  const listen = plan.spec.call && isCallBar(plan, place.bar);
  return (
    <div className="improv-now-next">
      <p className="improv-now">
        <span className="improv-label">{t('harmony.improv.now')}</span>
        <SymbolText
          symbol={now.symbol}
          label={format.words(now.symbol)}
          className="improv-symbol"
        />
        <NumeralsText chords={[numeral]} />
      </p>
      <p className="improv-next">
        <span className="improv-label">{t('harmony.improv.next')}</span>
        <SymbolText
          symbol={next.symbol}
          label={format.words(next.symbol)}
          className="improv-symbol"
        />
      </p>
      {plan.spec.call && (
        <p className={listen ? 'improv-turn is-listen' : 'improv-turn is-answer'}>
          {t(listen ? 'harmony.improv.listen' : 'harmony.improv.answer')}
        </p>
      )}
    </div>
  );
}

/** The loop's bars, four to a line, each with its chord; the bar playing lit, the calls marked. */
export function LoopStrip({ plan, place }: { plan: ImprovPlan; place: LoopPlace | null }) {
  const bars = loopBars(plan);
  const current = place && place.countIn === null ? loopBar(plan, place.bar) : null;
  // With call and response a loop of two bars still shows whose turn the bar is this time round.
  return (
    <ol className="improv-strip" aria-hidden="true">
      {Array.from({ length: bars }, (_, n) => {
        const absolute = place ? place.bar - loopBar(plan, place.bar) + n : n;
        const call = plan.spec.call && isCallBar(plan, absolute);
        return (
          <li
            key={n}
            className={`improv-strip-bar${n === current ? ' is-now' : ''}${call ? ' is-call' : ''}`}
          >
            <SymbolText symbol={plan.chords[n]!.symbol} />
          </li>
        );
      })}
    </ol>
  );
}

const HEARD_CLASS: Readonly<Record<NoteClass, string>> = {
  chord: 'is-heard-chord',
  scale: 'is-heard-scale',
  outside: 'is-heard-outside',
};

interface ImprovKeyboardProps {
  plan: ImprovPlan;
  bar: number;
  held: ReadonlyMap<number, number>;
  sustained: ReadonlySet<number>;
  /** How each key held now was heard. */
  heard: ReadonlyMap<number, NoteClass>;
  pointer: PointerInput;
}

/** The keyboard: the scale marked lightly, the chord's tones darker, the keys held tinted. */
export function ImprovKeyboard({
  plan,
  bar,
  held,
  sustained,
  heard,
  pointer,
}: ImprovKeyboardProps) {
  const chord = chordOfBar(plan, bar);
  const keyClasses = useMemo(() => {
    const classes = new Map<number, string>();
    for (let midi = IMPROV_KEYS[0]; midi <= IMPROV_KEYS[1]; midi++) {
      const pc = midi % 12;
      const marks: string[] = [];
      if (chord.pcs.includes(pc)) marks.push('improv-chord');
      else if (plan.scalePcs.has(pc)) marks.push('improv-scale');
      const how = heard.get(midi);
      if (how) marks.push(HEARD_CLASS[how]);
      if (marks.length > 0) classes.set(midi, marks.join(' '));
    }
    return classes;
  }, [chord, plan, heard]);
  return (
    <Piano
      className="improv-piano"
      held={held}
      sustained={sustained}
      pointer={pointer}
      range={IMPROV_KEYS}
      keyClasses={keyClasses}
    />
  );
}

/** What the tints say, as swatches. */
export function HeardLegend() {
  const t = useT();
  return (
    <ul className="improv-legend" aria-label={t('harmony.improv.legend')}>
      {(['chord', 'scale', 'outside'] as const).map((how) => (
        <li key={how} className={`improv-legend-${how}`}>
          <span className="improv-swatch" aria-hidden="true" />
          {t(`harmony.improv.heard.${how}`)}
        </li>
      ))}
    </ul>
  );
}
