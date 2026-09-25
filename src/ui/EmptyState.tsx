import type { ReactNode } from 'react';
import { Link } from 'wouter';

// Bravura's restWhole, scaled to 10 units per staff space; it hangs from the line at y = 0.
const WHOLE_REST =
  'M11.28 4.36V0.68C11.28 0.08 10.8 -0.36 10.24 -0.36H1.04C0.44 -0.36 0 0.08 0 0.68V4.36C0 4.92 0.44 5.4 1.04 5.4H10.24C10.8 5.4 11.28 4.92 11.28 4.36Z';
const LINES = [10, 20, 30, 40, 50];

interface EmptyStateProps {
  children?: ReactNode;
  /** The one thing to do next. */
  action?: { href: string; label: string };
}

/** Nothing to show yet: a bar of rest on an empty staff, a sentence and the next step. */
export function EmptyState({ children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <svg className="empty-staff" viewBox="0 0 120 60" aria-hidden="true" focusable="false">
        {LINES.map((y) => (
          <line key={y} x1="0" x2="120" y1={y} y2={y} />
        ))}
        <path d={WHOLE_REST} transform="translate(54 20)" />
        <line className="empty-barline" x1="113.5" x2="113.5" y1="10" y2="50" />
        <rect x="116" y="10" width="4" height="40" />
      </svg>
      {children && <p>{children}</p>}
      {action && (
        <Link href={action.href} className="button button-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}
