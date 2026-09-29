import type { ActionState } from '../../core/pianoAction.ts';
import { PART_IDS, type PartId } from './actionParts.ts';

// A grand piano's action for one key, in cross-section, the player on the left. Each part turns
// about its own pivot, driven by the state from core/pianoAction.ts: the key about the balance
// rail, the wippen about its flange, the jack about its seat on the wippen, the hammer about its
// flange. Proportions follow a real action, with the key's dip made larger to be seen.

const KEY_PIVOT = [330, 380] as const;
const WIPPEN_PIVOT = [392, 326] as const;
const JACK_PIVOT = [520, 318] as const;
const HAMMER_PIVOT = [445, 232] as const;
/** Radians: the key at the bottom of its dip; the hammer against the string; the jack let go. */
const KEY_ANGLE = 0.069;
const WIPPEN_RATIO = 1.805;
const HAMMER_ANGLE = 0.2128;
const JACK_ANGLE = 0.3;
const DAMPER_LIFT = 22;
const STRING_Y = 150;
const STRING_FROM = 388;
const STRING_TO = 878;

const deg = (radians: number) => (radians * 180) / Math.PI;

/** Where each part's name goes, and the point on the part its line leads to. */
const LABELS: Record<
  PartId,
  { at: [number, number]; to: [number, number]; anchor: 'start' | 'end' | 'middle' }
> = {
  key: { at: [150, 426], to: [150, 370], anchor: 'middle' },
  capstan: { at: [470, 426], to: [469, 352], anchor: 'middle' },
  wippen: { at: [330, 300], to: [420, 326], anchor: 'end' },
  jack: { at: [330, 262], to: [514, 288], anchor: 'end' },
  letoff: { at: [330, 238], to: [496, 276], anchor: 'end' },
  repetition: { at: [560, 212], to: [590, 253], anchor: 'middle' },
  hammer: { at: [600, 176], to: [672, 206], anchor: 'end' },
  backcheck: { at: [690, 302], to: [705, 262], anchor: 'end' },
  damper: { at: [830, 108], to: [808, 134], anchor: 'start' },
  string: { at: [560, 128], to: [560, 150], anchor: 'middle' },
  soundboard: { at: [866, 206], to: [866, 180], anchor: 'middle' },
};

interface DrawingProps {
  state: ActionState;
  /** Seconds, for the string's vibration. */
  time: number;
  names: Record<PartId, string> | null;
  focus: PartId | null;
  onFocus: (part: PartId | null) => void;
  label: string;
}

export function PianoActionDrawing({ state, time, names, focus, onFocus, label }: DrawingProps) {
  const key = deg(KEY_ANGLE * state.key);
  const wippen = deg(KEY_ANGLE * state.key * WIPPEN_RATIO);
  const hammer = deg(HAMMER_ANGLE * state.hammer);
  const jack = deg(JACK_ANGLE * state.jack);
  const lift = DAMPER_LIFT * state.damper;

  // The string: a half sine along its length, swinging at a visible rate.
  const swing = state.ring * 7 * Math.sin(2 * Math.PI * 9 * time);
  const points: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const x = STRING_FROM + ((STRING_TO - STRING_FROM) * i) / 32;
    points.push(`${x.toFixed(1)},${(STRING_Y + swing * Math.sin((Math.PI * i) / 32)).toFixed(2)}`);
  }

  const part = (id: PartId) => ({
    className: focus === id ? `act-part is-focus` : 'act-part',
    'data-part': id,
    onPointerEnter: () => onFocus(id),
    onPointerDown: () => onFocus(id),
  });

  return (
    <svg className="act" viewBox="10 84 905 348" role="img" aria-label={label}>
      <g onPointerLeave={() => onFocus(null)}>
        {/* The case: key bed, balance rail, front rail, the iron frame over the strings. */}
        <rect className="act-case" x={20} y={404} width={880} height={12} />
        <rect className="act-wood-dark" x={316} y={380} width={28} height={24} />
        {/* The front rail's felt, where the key stops at the bottom of its dip. */}
        <rect className="act-felt" x={60} y={400} width={24} height={4} />
        <path className="act-iron" d="M352 96h92v26h-40v24h-30v-24h-22z" />

        <g {...part('soundboard')}>
          <rect className="act-wood" x={820} y={172} width={92} height={8} />
          <path className="act-wood-dark" d="M862 150h28l5 22h-38z" />
        </g>

        {/* The damper, lifted by the key's far end, or by the sustain pedal. */}
        <g {...part('damper')} transform={`translate(0 ${-lift})`}>
          <rect className="act-wood" x={740} y={346} width={112} height={7} rx={2} />
          <rect className="act-metal" x={786} y={150} width={3} height={196} />
          <rect className="act-wood" x={768} y={124} width={40} height={18} rx={2} />
          <rect className="act-felt" x={768} y={142} width={40} height={7} />
        </g>

        {/* The key, about the balance rail: with the capstan and the backcheck it carries. */}
        <g transform={`rotate(${-key} ${KEY_PIVOT[0]} ${KEY_PIVOT[1]})`}>
          <g {...part('key')}>
            <rect className="act-wood" x={40} y={362} width={722} height={18} rx={2} />
            <rect className="act-ivory" x={40} y={355} width={112} height={8} rx={2} />
          </g>
          <g {...part('capstan')}>
            <rect className="act-brass" x={462} y={348} width={14} height={14} rx={2} />
          </g>
          <g {...part('backcheck')}>
            <rect className="act-metal" x={702} y={256} width={4} height={106} />
            <path className="act-felt" d="M692 240l24-4v18l-24 4z" />
          </g>
        </g>

        {/* The let-off button, fixed on its rail over the jack's toe. */}
        <g {...part('letoff')}>
          <rect className="act-wood-dark" x={470} y={262} width={40} height={7} />
          <rect className="act-metal" x={498} y={269} width={3} height={6} />
          <circle className="act-felt" cx={499.5} cy={279} r={5} />
        </g>

        {/* The wippen, about its flange, lifted by the capstan: it carries the jack and the
            repetition lever. */}
        <rect className="act-wood-dark" x={380} y={318} width={24} height={20} rx={2} />
        <g transform={`rotate(${-wippen} ${WIPPEN_PIVOT[0]} ${WIPPEN_PIVOT[1]})`}>
          <g {...part('wippen')}>
            <path className="act-wood" d="M392 320L606 314v14L392 332z" />
            <rect className="act-wood" x={460} y={330} width={18} height={18} />
          </g>
          <g {...part('repetition')}>
            <rect className="act-wood" x={556} y={258} width={8} height={58} />
            <rect className="act-wood" x={468} y={252} width={44} height={6} rx={1} />
            <rect className="act-wood" x={528} y={252} width={76} height={6} rx={1} />
          </g>
          <g {...part('jack')} transform={`rotate(${-jack} ${JACK_PIVOT[0]} ${JACK_PIVOT[1]})`}>
            <rect className="act-wood-dark" x={514} y={250} width={12} height={70} rx={2} />
            <rect className="act-wood-dark" x={486} y={296} width={30} height={7} rx={2} />
          </g>
          <circle className="act-pivot" cx={JACK_PIVOT[0]} cy={JACK_PIVOT[1]} r={2.5} />
        </g>
        <circle className="act-pivot" cx={WIPPEN_PIVOT[0]} cy={WIPPEN_PIVOT[1]} r={3} />

        {/* The hammer, about its flange on the hammer rail. */}
        <rect className="act-wood-dark" x={428} y={232} width={34} height={22} rx={2} />
        <g
          {...part('hammer')}
          transform={`rotate(${-hammer} ${HAMMER_PIVOT[0]} ${HAMMER_PIVOT[1]})`}
        >
          <rect className="act-wood" x={445} y={229} width={240} height={6} rx={2} />
          <circle className="act-felt" cx={520} cy={243} r={7} />
          <path className="act-wood" d="M672 208h18v24l10 6h-28z" />
          <rect className="act-hammer-felt" x={669} y={200} width={24} height={14} rx={8} />
        </g>
        <circle className="act-pivot" cx={HAMMER_PIVOT[0]} cy={HAMMER_PIVOT[1]} r={3} />
        <circle className="act-pivot" cx={KEY_PIVOT[0]} cy={KEY_PIVOT[1]} r={3} />

        {/* The string, from the agraffe on the frame to the bridge on the soundboard. */}
        <g {...part('string')}>
          <polyline className="act-string" points={points.join(' ')} />
          <rect className="act-brass" x={372} y={143} width={16} height={14} rx={2} />
        </g>

        {names && (
          <g className="act-names" aria-hidden="true">
            {PART_IDS.map((id) => {
              const { at, to, anchor } = LABELS[id];
              return (
                <g key={id} className={focus === id ? 'is-focus' : undefined}>
                  <line x1={at[0]} y1={at[1] + (at[1] > to[1] ? -12 : 4)} x2={to[0]} y2={to[1]} />
                  <text x={at[0]} y={at[1]} textAnchor={anchor}>
                    {names[id]}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </g>
    </svg>
  );
}
