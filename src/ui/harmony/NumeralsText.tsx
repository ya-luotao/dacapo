import { Fragment } from 'react';
import {
  progressionNumerals,
  type ProgressionChord,
  type ProgressionId,
} from '../../core/progressions.ts';

/** A numeral set as an analysis sets it: `ii` on the line, its `7` raised. */
function Numeral({ chord }: { chord: ProgressionChord }) {
  return (
    <>
      {chord.numeral}
      {chord.figure && <span className="sym-raised">{chord.figure}</span>}
    </>
  );
}

/**
 * A progression's numerals typeset (`ii⁷–V⁷–Imaj⁷`, the figures raised), or those of `chords`
 * (Improvise's backings). Hidden from assistive technology, which reads `label` instead, or
 * nothing when the caller says it.
 */
export function NumeralsText(
  props: { id: ProgressionId } | { chords: readonly ProgressionChord[] },
) {
  const chords = 'chords' in props ? props.chords : progressionNumerals(props.id);
  return (
    <span className="sym numerals" aria-hidden="true">
      {chords.map((c, n) => (
        <Fragment key={n}>
          {n > 0 && '–'}
          <Numeral chord={c} />
        </Fragment>
      ))}
    </span>
  );
}
