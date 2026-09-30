import { useMemo } from 'react';
import { pieceFacts } from '../../core/pieceRecords.ts';
import { parseProgressionPieceId, progressionPieceId } from '../../core/progressions.ts';
import { PROGRESSION_HANDS, progressionXml } from '../../core/progressionXml.ts';
import { useT } from '../../i18n/index.ts';
import { readScore } from '../../pieces/load.ts';
import { EmptyState } from '../EmptyState.tsx';
import { PieceSession } from '../pieces/PieceSession.tsx';
import type { OpenPiece } from '../pieces/usePiece.ts';
import { readProgressionTempo } from './prefs.ts';
import { progressionTitle, useProgressionFormat } from './progressionFormat.ts';

/** A path segment as the route gives it: decoded once more where it still carries escapes. */
function segment(text: string): string {
  try {
    return text.includes('%') ? decodeURIComponent(text) : text;
  } catch {
    return text;
  }
}

/**
 * A progression practised as a piece (docs/HARMONY.md, "Progressions (H2)"): its score generated
 * from the progression, key and pattern, at the tempo it was opened at, and handed to the Pieces
 * machinery under a piece id naming the three.
 */
export function ProgressionPage(params: { progression: string; keyName: string; pattern: string }) {
  const t = useT();
  const format = useProgressionFormat();
  const id = `prog:${params.progression}:${segment(params.keyName)}:${params.pattern}`;
  const piece = useMemo((): OpenPiece | null => {
    const spec = parseProgressionPieceId(id);
    if (!spec) return null;
    const pieceId = progressionPieceId(spec);
    const xml = progressionXml(spec, { bpm: readProgressionTempo(pieceId) });
    const score = readScore(xml, PROGRESSION_HANDS);
    return {
      id: pieceId,
      title: progressionTitle(t, spec),
      composer: format.pattern(spec.pattern),
      xml,
      score,
      facts: pieceFacts(score),
      builtIn: null,
      stored: null,
    };
  }, [id, t, format]);

  if (!piece) {
    return (
      <section className="page">
        <EmptyState action={{ href: '/harmony', label: t('harmony.back') }}>
          {t('harmony.progression.notFound')}
        </EmptyState>
      </section>
    );
  }
  return (
    <PieceSession
      key={piece.id}
      piece={piece}
      back={{ href: '/harmony', label: t('harmony.back') }}
    />
  );
}
