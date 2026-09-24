import { midiName } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import type { HubState } from '../../input/index.ts';

/** Held notes low to high; when nothing is held, the last chord, dimmed. */
export function NoteReadout({ held, lastChord }: Pick<HubState, 'held' | 'lastChord'>) {
  const t = useT();
  const live = held.size > 0;
  const notes = live ? [...held.keys()].sort((a, b) => a - b) : lastChord;

  return (
    <div className="readout">
      <span className="readout-label">
        {live || notes.length === 0 ? t('play.readout.label') : t('play.readout.last')}
      </span>
      <output className={live ? 'readout-notes is-live' : 'readout-notes'} aria-live="polite">
        {notes.length > 0 ? notes.map((midi) => midiName(midi)).join(' ') : t('play.readout.empty')}
      </output>
    </div>
  );
}
