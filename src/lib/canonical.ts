/**
 * A copy with every object's keys in sorted order, so two copies of a record that list their
 * fields in different orders serialize the same (the sync service compares bodies as text, and
 * devices break ties between two copies by that text).
 */
export function canonical<T>(value: T): T {
  if (Array.isArray(value)) return value.map(canonical) as T;
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  ) as T;
}

export const canonicalText = (value: unknown): string => JSON.stringify(canonical(value));
