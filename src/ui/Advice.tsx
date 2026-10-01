/**
 * What to work on next (docs/ADVICE.md): one sentence under a summary's figures, beside it the
 * button that does it, and under it a quiet line (what the run did to the piece's review).
 * Nothing when there is neither sentence nor line.
 */
export function Advice({
  text,
  note = null,
  action = null,
  compact = false,
}: {
  text: string | null;
  note?: string | null;
  /** The summary's primary button, when the advice has one. */
  action?: { label: string; onClick: () => void } | null;
  compact?: boolean;
}) {
  if (!text && !note) return null;
  return (
    <div className="advice">
      <div className="advice-words">
        {text && <p className="advice-text">{text}</p>}
        {note && <p className="advice-note">{note}</p>}
      </div>
      {text && action && (
        <button
          type="button"
          className={compact ? 'button button-primary is-compact' : 'button button-primary'}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
