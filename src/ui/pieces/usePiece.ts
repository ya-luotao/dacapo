import { useEffect, useMemo, useState } from 'react';
import type { Score } from '../../core/score.ts';
import type { StoredPiece } from '../../core/storedPiece.ts';
import { useT } from '../../i18n/index.ts';
import {
  BUILT_IN_IDS,
  builtInPiece,
  loadBuiltIn,
  type BuiltInId,
  type BuiltInPiece,
} from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { usePractice, useStorageStatus } from '../practice/context.ts';

export interface OpenPiece {
  id: string;
  title: string;
  composer: string;
  xml: string;
  score: Score;
  builtIn: BuiltInPiece | null;
  stored: StoredPiece | null;
}

export type PieceState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'ready'; piece: OpenPiece };

const isBuiltIn = (id: string): id is BuiltInId => (BUILT_IN_IDS as readonly string[]).includes(id);

/** A built-in piece or one the user imported, parsed. */
export function usePiece(id: string): PieceState {
  const t = useT();
  const { pieces } = usePractice();
  const { loaded } = useStorageStatus();
  const stored = pieces.find((p) => p.id === id) ?? null;
  const [builtInXml, setBuiltInXml] = useState<string | null>(null);

  useEffect(() => {
    if (!isBuiltIn(id)) return;
    let cancelled = false;
    void loadBuiltIn(id).then((xml) => {
      if (!cancelled) setBuiltInXml(xml);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const xml = isBuiltIn(id) ? builtInXml : (stored?.xml ?? null);
  const hands = stored?.hands ?? null;
  const parsed = useMemo(() => {
    if (xml === null) return null;
    try {
      return readScore(xml, hands);
    } catch {
      return 'unreadable' as const;
    }
  }, [xml, hands]);

  if (isBuiltIn(id)) {
    if (!parsed) return { status: 'loading' };
    if (parsed === 'unreadable') return { status: 'unreadable' };
    return {
      status: 'ready',
      piece: {
        id,
        title: t(`library.${id}.title`),
        composer: t(`library.${id}.composer`),
        xml: xml!,
        score: parsed,
        builtIn: builtInPiece(id)!,
        stored: null,
      },
    };
  }
  if (!stored) return loaded ? { status: 'missing' } : { status: 'loading' };
  if (!parsed) return { status: 'loading' };
  if (parsed === 'unreadable') return { status: 'unreadable' };
  return {
    status: 'ready',
    piece: {
      id,
      title: stored.title || t('pieces.untitled'),
      composer: stored.composer,
      xml: stored.xml,
      score: parsed,
      builtIn: null,
      stored,
    },
  };
}
