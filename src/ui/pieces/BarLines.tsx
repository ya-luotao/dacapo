import type { BarGrid } from './barGrid.ts';
import type { PieceFormat } from './format.ts';

/** The bar lines of an Expression chart from `top` to `bottom`, with the numbers at `labelY`. */
export function BarLines({
  grid,
  format,
  labelY,
  top,
  bottom,
}: {
  grid: BarGrid;
  format: PieceFormat;
  labelY: number;
  top: number;
  bottom: number;
}) {
  return grid.bars.map((i) => (
    <g key={i} className={grid.newRound(i) ? 'chart-bar is-round' : 'chart-bar'}>
      <line x1={grid.x(i)} x2={grid.x(i)} y1={top} y2={bottom} />
      {grid.labelled.has(i) && (
        <text x={grid.x(i) + 2} y={labelY}>
          {format.barShort(grid.slots[i]!.measure)}
        </text>
      )}
    </g>
  ));
}
