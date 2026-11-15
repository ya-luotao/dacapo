import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useI18n, type MessageKey } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';
import { isBuiltin } from '../../output/output.ts';
import { useInstrumentKeys } from '../instrument.ts';
import { useNoteNames } from '../noteNames.ts';
import { useOutputSound, useOutputState } from '../output/context.ts';
import { useInput, useMidiStatus } from './context.ts';
import { useTouchOnly } from './touchOnly.ts';

const FLASH_MS = 1200;

const MIDI_STATUS_KEYS: Record<Exclude<MidiStatus['state'], 'connected'>, MessageKey> = {
  pending: 'midi.status.pending',
  unsupported: 'midi.status.unsupported',
  'no-permission': 'midi.status.noPermission',
  'no-device': 'midi.status.noDevice',
};

/**
 * Compact live instrument and sound status chip placed beside the metronome chip. Flashes played
 * notes briefly and opens a quick-check popover for MIDI status, sound output, and range.
 */
export function InstrumentChip() {
  const { t, locale } = useI18n();
  const status = useMidiStatus();
  const { hub, midi } = useInput();
  const sound = useOutputSound();
  const { selected } = useOutputState();
  const names = useNoteNames();
  const touch = useTouchOnly();
  const keys = useInstrumentKeys();

  const [open, setOpen] = useState(false);
  const [flashNote, setFlashNote] = useState<string | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = hub.onEvent((event) => {
      if (event.type !== 'on') return;
      const note = names.midiName(event.midi);
      setLastNote(note);
      setFlashNote(note);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        setFlashNote(null);
        timer = undefined;
      }, FLASH_MS);
    });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      stop();
    };
  }, [hub, names]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const dotClass =
    status.state === 'connected'
      ? 'is-connected'
      : status.state === 'no-permission' || status.state === 'unsupported'
        ? 'is-denied'
        : 'is-idle';

  const compactLabel =
    flashNote ??
    (status.state === 'connected'
      ? status.names[0]?.trim() || t('instrument.chip.midi')
      : t(touch ? 'instrument.chip.touch' : 'instrument.chip.keys'));

  const midiText =
    status.state === 'connected'
      ? t('midi.status.connected', {
          names: new Intl.ListFormat(locale, { type: 'conjunction' }).format(
            status.names.map((name) => name || t('midi.unnamedDevice')),
          ),
        })
      : t(MIDI_STATUS_KEYS[status.state]);

  const soundLabel =
    sound === 'none'
      ? t('instrument.chip.soundMuted')
      : selected && !isBuiltin(selected)
        ? selected.name || t('midi.unnamedDevice')
        : sound === 'waiting'
          ? t('midi.status.pending')
          : t('instrument.chip.soundBuiltin');

  const rangeText = t('settings.keyboard.size', {
    n: keys.high - keys.low + 1,
    low: names.midiName(keys.low),
    high: names.midiName(keys.high),
  });

  const canRetry = status.state === 'no-permission' || status.state === 'unsupported';
  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="instrument-chip">
      <button
        ref={toggleRef}
        type="button"
        className="instrument-chip-toggle"
        aria-expanded={open}
        aria-label={t('instrument.chip.label')}
        title={t('instrument.chip.label')}
        onClick={() => setOpen((was) => !was)}
      >
        <span className={`instrument-dot ${dotClass}`} aria-hidden="true" />
        <span className={flashNote ? 'instrument-chip-label is-note' : 'instrument-chip-label'}>
          {compactLabel}
        </span>
      </button>

      {open && (
        <div className="instrument-popover" role="dialog" aria-label={t('instrument.chip.label')}>
          <div className="instrument-popover-row">
            <p className="instrument-popover-status">{midiText}</p>
            {canRetry && (
              <button
                type="button"
                className="instrument-retry"
                onClick={() => {
                  midi.retry();
                }}
              >
                {t('instrument.chip.retry')}
              </button>
            )}
          </div>
          <p className="instrument-popover-line instrument-popover-note">
            {lastNote
              ? t('instrument.chip.lastNote', { note: lastNote })
              : t('instrument.chip.testPrompt')}
          </p>
          <p className="instrument-popover-line">
            {t('instrument.chip.sound', { output: soundLabel })}
          </p>
          <p className="instrument-popover-line instrument-popover-range">{rangeText}</p>
          <div className="instrument-popover-links">
            <Link href="/play" className="instrument-popover-link" onClick={close}>
              {t('nav.play')}
            </Link>
            <Link href="/settings" className="instrument-popover-link" onClick={close}>
              {t('nav.settings')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
