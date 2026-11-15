import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLocation } from 'wouter';
import type { StoredPiece } from '../core/storedPiece.ts';
import { useI18n } from '../i18n/index.ts';
import {
  buildJumpEntries,
  filterJumpEntries,
  JUMP_GROUPS,
  type JumpEntry,
  type JumpGroup,
} from './QuickJumpData.ts';
import { PracticeContext } from './practice/context.ts';

export interface QuickJumpProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY_PIECES: readonly StoredPiece[] = [];
const subscribeNothing = () => () => undefined;

function useCustomPieces(): readonly StoredPiece[] {
  const store = useContext(PracticeContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNothing,
    () => (store ? store.getSnapshot().pieces : EMPTY_PIECES),
    () => EMPTY_PIECES,
  );
}

/**
 * Command-palette Quick Jump modal: filters pages, practice modes, pieces, lessons, and glossary
 * terms, supports Arrow/Enter/Escape keyboard navigation, and loads lazily on first open.
 */
export function QuickJump({ open, onClose }: QuickJumpProps) {
  const { t, locale } = useI18n();
  const [, setLocation] = useLocation();
  const customPieces = useCustomPieces();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const skipRestoreRef = useRef(false);
  const listId = useId();
  const optionPrefix = useId();

  const allEntries = useMemo(
    () => buildJumpEntries({ t, locale, customPieces }),
    [t, locale, customPieces],
  );
  const filtered = useMemo(() => filterJumpEntries(allEntries, query), [allEntries, query]);
  const safeActiveIndex = filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);
  const activeEntry = safeActiveIndex >= 0 ? filtered[safeActiveIndex] : undefined;

  const restorePreviousFocus = useCallback(() => {
    const target = previousFocusRef.current;
    previousFocusRef.current = null;
    if (target && target.isConnected) target.focus();
  }, []);

  const closeWithoutRestore = useCallback(() => {
    skipRestoreRef.current = true;
    previousFocusRef.current = null;
    onClose();
  }, [onClose]);

  const closeAndRestore = useCallback(() => {
    skipRestoreRef.current = true;
    restorePreviousFocus();
    onClose();
  }, [onClose, restorePreviousFocus]);

  const navigateTo = useCallback(
    (entry: JumpEntry) => {
      setLocation(entry.href);
      closeWithoutRestore();
    },
    [setLocation, closeWithoutRestore],
  );

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      skipRestoreRef.current = false;
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    } else if (!open && wasOpenRef.current && !skipRestoreRef.current) {
      restorePreviousFocus();
    }
    wasOpenRef.current = open;
  }, [open, restorePreviousFocus]);

  useEffect(() => {
    if (!open || safeActiveIndex < 0) return;
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open, safeActiveIndex]);

  const grouped = useMemo(() => {
    const byGroup = new Map<JumpGroup, { entry: JumpEntry; index: number }[]>();
    filtered.forEach((entry, index) => {
      const bucket = byGroup.get(entry.group);
      if (bucket) bucket.push({ entry, index });
      else byGroup.set(entry.group, [{ entry, index }]);
    });
    return JUMP_GROUPS.map((group) => ({ group, items: byGroup.get(group) ?? [] })).filter(
      (section) => section.items.length > 0,
    );
  }, [filtered]);

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestore();
      return;
    }
    if (filtered.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => {
        const clamped = Math.min(current, filtered.length - 1);
        return (clamped + 1) % filtered.length;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        const clamped = Math.min(current, filtered.length - 1);
        return (clamped - 1 + filtered.length) % filtered.length;
      });
    } else if (event.key === 'Enter' && event.target === inputRef.current && activeEntry) {
      event.preventDefault();
      navigateTo(activeEntry);
    }
  };

  return (
    <div
      className="jump-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeAndRestore();
      }}
    >
      <div
        className="jump-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('jump.open')}
        onKeyDown={handleKeyDown}
      >
        <div className="jump-search">
          <svg className="jump-search-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="jump-input"
            role="combobox"
            aria-expanded={true}
            aria-controls={listId}
            aria-activedescendant={activeEntry ? `${optionPrefix}-${activeEntry.id}` : undefined}
            aria-label={t('jump.placeholder')}
            placeholder={t('jump.placeholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
          <kbd className="jump-esc-kbd" aria-hidden="true">
            Esc
          </kbd>
        </div>

        <div id={listId} className="jump-list" role="listbox" aria-label={t('jump.open')}>
          {filtered.length === 0 ? (
            <p className="jump-empty">{t('jump.empty', { query })}</p>
          ) : (
            grouped.map(({ group, items }) => (
              <div
                key={group}
                className="jump-group"
                role="group"
                aria-label={t(`jump.group.${group}`)}
              >
                <div className="jump-group-title" aria-hidden="true">
                  {t(`jump.group.${group}`)}
                </div>
                {items.map(({ entry, index }) => {
                  const isActive = index === safeActiveIndex;
                  return (
                    <button
                      key={entry.id}
                      ref={isActive ? activeOptionRef : undefined}
                      id={`${optionPrefix}-${entry.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={isActive ? 'jump-item is-active' : 'jump-item'}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => navigateTo(entry)}
                    >
                      <span className="jump-item-title">{entry.title}</span>
                      {entry.subtitle && (
                        <span className="jump-item-subtitle">{entry.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default QuickJump;
