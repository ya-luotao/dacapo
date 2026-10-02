import { useT } from '../../i18n/index.ts';
import { NOTE_KEYS, noteForKey } from '../../input/keyboard.ts';
import { useKeyboardOctave } from '../input/context.ts';
import { useNoteNames } from '../noteNames.ts';

// Where each key sits in a 16-column grid: the home row two columns per key, the upper row
// between its neighbours, like black keys between white keys.
const PLACE: Record<string, { column: number; row: 1 | 2 }> = {
  KeyA: { column: 1, row: 2 },
  KeyW: { column: 2, row: 1 },
  KeyS: { column: 3, row: 2 },
  KeyE: { column: 4, row: 1 },
  KeyD: { column: 5, row: 2 },
  KeyF: { column: 7, row: 2 },
  KeyT: { column: 8, row: 1 },
  KeyG: { column: 9, row: 2 },
  KeyY: { column: 10, row: 1 },
  KeyH: { column: 11, row: 2 },
  KeyU: { column: 12, row: 1 },
  KeyJ: { column: 13, row: 2 },
  KeyK: { column: 15, row: 2 },
};

/** The keys that play at `octave`, each with the note it plays (null: off the piano). */
function keysAt(octave: number) {
  return NOTE_KEYS.map(([code, letter]) => ({
    code,
    letter,
    midi: noteForKey(code, octave),
    ...PLACE[code]!,
  }));
}

/**
 * The computer keys that play, drawn as they lie on the keyboard with the note each plays, and
 * the two that move the octave. With `held` (the keys down, by MIDI number), a key lights while
 * its note sounds.
 */
export function Keycaps({ held }: { held?: ReadonlyMap<number, number> }) {
  const t = useT();
  const { midiName } = useNoteNames();
  const octave = useKeyboardOctave();

  return (
    <>
      <div className="keycaps">
        {keysAt(octave).map(({ code, letter, midi, column, row }) => (
          <div
            key={code}
            className={
              (row === 1 ? 'keycap is-upper' : 'keycap') +
              (midi !== null && held?.has(midi) ? ' is-held' : '')
            }
            style={{ gridColumn: `${column} / span 2`, gridRow: row }}
          >
            <kbd>{letter}</kbd>
            {midi === null ? (
              <span className="keycap-note" title={t('keys.offPiano')}>
                <span aria-hidden="true">—</span>
                <span className="visually-hidden">{t('keys.offPiano')}</span>
              </span>
            ) : (
              <span className="keycap-note">{midiName(midi)}</span>
            )}
          </div>
        ))}
      </div>
      <p className="keys-octave">
        <span>
          <kbd>Z</kbd> {t('keys.octaveDown')}
        </span>
        <span className="keys-octave-value">
          {t('keys.octave')} <strong>{octave}</strong>
        </span>
        <span>
          <kbd>X</kbd> {t('keys.octaveUp')}
        </span>
      </p>
    </>
  );
}

export function KeyboardHint() {
  const t = useT();
  const { midiName } = useNoteNames();
  const octave = useKeyboardOctave();
  const playable = keysAt(octave).flatMap(({ midi }) => (midi === null ? [] : [midi]));

  return (
    <section className="keys-hint" aria-labelledby="keys-hint-title">
      <h2 id="keys-hint-title">{t('keys.title')}</h2>
      <p className="help">{t('keys.body')}</p>
      <Keycaps />
      <p className="help">
        {t('keys.range', { low: midiName(playable[0]!), high: midiName(playable.at(-1)!) })}
      </p>
    </section>
  );
}
