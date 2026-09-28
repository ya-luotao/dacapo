import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useT } from '../../i18n/index.ts';
import { isTextEntry } from '../../input/keyboard.ts';
import { currentShell } from '../../lib/shell.ts';
import { MetronomeChip } from '../metronome/MetronomeChip.tsx';
import {
  setFocus,
  setFocusKeyboard,
  setFocusZoom,
  stepZoom,
  useFocusState,
  useFocusSurface,
} from './focus.ts';

/** Full screen, where the browser offers it (not in the Apple app, which is full screen). */
function useFullscreen() {
  const available =
    currentShell() === 'web' && typeof document !== 'undefined' && document.fullscreenEnabled;
  const [on, setOn] = useState(() => available && document.fullscreenElement !== null);
  useEffect(() => {
    if (!available) return;
    const onChange = () => setOn(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [available]);
  const toggle = () => {
    const request = on
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Refused (no user gesture, a policy): the page simply stays as it is.
    request.catch(() => {});
  };
  return { available, on, toggle };
}

/**
 * The one row focus mode leaves above the score: the way back, the name of what is practised, the
 * size of the notes, the keyboard, the settings (folded away until asked for), the metronome, full
 * screen and the way out. Escape leaves focus mode (after anything open on the page has had it).
 */
export function FocusBar({
  heading,
  back,
  settings,
}: {
  heading: ReactNode;
  back?: { href: string; label: string };
  settings: { open: boolean; onToggle: () => void; controls: string };
}) {
  const t = useT();
  useFocusSurface();
  const { zoom, keyboard } = useFocusState();
  const settingsButton = useRef<HTMLButtonElement>(null);
  const fullscreen = useFullscreen();
  const smaller = stepZoom(zoom, -1);
  const larger = stepZoom(zoom, 1);

  const leave = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setFocus(false);
  };

  // Escape folds the settings away first, then leaves. Panels and dialogs that close on Escape
  // mark it handled (preventDefault) on the way here; a select or a text field keeps it. The
  // listener stays put while the page renders (every beat in rhythm mode) and reads the latest.
  const { open, onToggle } = settings;
  const onEscape = useRef(() => {});
  useLayoutEffect(() => {
    onEscape.current = open
      ? () => {
          // What had the focus is folded away with the settings: the button takes it back.
          settingsButton.current?.focus();
          onToggle();
        }
      : leave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTextEntry(e.target)) return;
      onEscape.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="focus-bar" role="group" aria-label={t('focus.bar')}>
      {back && (
        <Link
          href={back.href}
          className="button-icon focus-back"
          aria-label={back.label}
          title={back.label}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </Link>
      )}
      <div className="focus-heading">{heading}</div>
      <div className="focus-tools">
        <button
          type="button"
          className="button-icon"
          aria-label={t('focus.zoomOut')}
          title={t('focus.zoomOut')}
          disabled={smaller === null}
          onClick={() => smaller !== null && setFocusZoom(smaller)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M5 7h4M10.5 10.5L14 14" />
          </svg>
        </button>
        <button
          type="button"
          className="button-icon"
          aria-label={t('focus.zoomIn')}
          title={t('focus.zoomIn')}
          disabled={larger === null}
          onClick={() => larger !== null && setFocusZoom(larger)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M5 7h4M7 5v4M10.5 10.5L14 14" />
          </svg>
        </button>
        <button
          type="button"
          className="button-icon"
          aria-label={t('focus.keyboard')}
          title={t('focus.keyboard')}
          aria-pressed={keyboard}
          onClick={() => setFocusKeyboard(!keyboard)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
            <path d="M5.5 3.5v5M8 3.5v9M10.5 3.5v5" />
          </svg>
        </button>
        <button
          type="button"
          ref={settingsButton}
          className={
            open ? 'button is-compact focus-settings is-open' : 'button is-compact focus-settings'
          }
          aria-expanded={open}
          aria-controls={settings.controls}
          onClick={onToggle}
        >
          {t('focus.settings')}
        </button>
        <MetronomeChip />
        {fullscreen.available && (
          <button
            type="button"
            className="button-icon"
            aria-label={fullscreen.on ? t('focus.fullscreen.exit') : t('focus.fullscreen')}
            title={fullscreen.on ? t('focus.fullscreen.exit') : t('focus.fullscreen')}
            onClick={fullscreen.toggle}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {fullscreen.on ? (
                <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
              ) : (
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
              )}
            </svg>
          </button>
        )}
        <button
          type="button"
          className="button is-compact focus-leave"
          title={t('focus.leave.help')}
          onClick={leave}
        >
          {t('focus.leave')}
        </button>
      </div>
    </div>
  );
}

/** The button that enters focus mode, next to the name of what is practised. */
export function FocusEnter() {
  const t = useT();
  return (
    <button
      type="button"
      className="button is-compact focus-enter"
      title={t('focus.enter.help')}
      onClick={() => setFocus(true)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
      </svg>
      <span>{t('focus.enter')}</span>
    </button>
  );
}
