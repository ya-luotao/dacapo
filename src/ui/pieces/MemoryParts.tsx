import { useId } from 'react';
import { MEMORY_STAGES, type MemoryStage } from '../../core/memory.ts';
import { useT } from '../../i18n/index.ts';
import type { BarBoxes } from '../notation/ScoreView.tsx';
import type { PieceFormat } from './format.ts';

// Memory mode's parts of the practice page (docs/PIECES.md, "Memorising"): the stage chosen under
// Options, and the number of each hidden bar in its middle.

/** How much of the score is shown: first under Options in memory mode. */
export function MemoryStageSelect({
  stage,
  onChange,
}: {
  stage: MemoryStage;
  onChange: (stage: MemoryStage) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <label className="piece-option memory-stage">
      <span className="piece-control-label">{t('pieces.memory.stage')}</span>
      <select
        className="is-compact"
        aria-describedby={id}
        value={stage}
        onChange={(e) => onChange(e.target.value as MemoryStage)}
      >
        {MEMORY_STAGES.map((choice) => (
          <option key={choice} value={choice}>
            {t(`pieces.memory.stage.${choice}`)}
          </option>
        ))}
      </select>
      <span id={id} className="visually-hidden">
        {t('pieces.memory.stage.help')}
      </span>
    </label>
  );
}

/** Each hidden bar's number, in the middle of its empty staff. */
export function HiddenBarNumbers({
  hidden,
  boxes,
  format,
}: {
  hidden: ReadonlySet<number>;
  boxes: BarBoxes;
  format: PieceFormat;
}) {
  return [...hidden].map((index) => {
    const box = boxes.get(index);
    if (!box) return null;
    return (
      <span
        key={index}
        className="bar-hidden-number"
        aria-hidden="true"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        {format.barNumber(index)}
      </span>
    );
  });
}
