// The brand lockup: a whole note (the Bravura noteheadWhole glyph, drawn as an outline so it needs
// no font; SIL Open Font License) beside the name, set in the page's own sans like the rest.
// The note's coordinates are font units (1000 per em), with the baseline at y = 0.

const NOTE_BOX = '0 -476 802 476';
const NOTE =
  'M410 -476C158 -476 0 -371 0 -242C0 -114 108 0 391 0C703 0 802 -109 802 -242C802 -377 587 -476 410 -476ZM211 -358C232 -424 302 -434 361 -434C492 -434 597 -293 597 -179C597 -120 572 -67 509 -52C490 -46 469 -44 450 -44C382 -44 312 -90 272 -143C234 -187 205 -251 205 -312C205 -327 207 -342 211 -358Z';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox={NOTE_BOX} focusable="false">
        <path d={NOTE} />
      </svg>
      dacapo
    </span>
  );
}
