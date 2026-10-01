import { useMemo, useRef, useState } from 'react';
import { parseMusicXml } from '../../core/musicxml.ts';
import type { TuneId } from '../../core/tuneList.ts';
import { getTune } from '../../core/tunes.ts';
import { tuneHands, tuneInk, tunePhraseXml } from '../../core/tuneXml.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import type { Engraving } from '../notation/verovio.ts';

const NO_KEYS: readonly number[] = [];
/** The phrase is stretched across its sheet, as a sight-reading fragment is. */
const STRETCHED: Engraving = { lastJustification: 0 };
/** Over two systems the second keeps its own width: a bar alone is not pulled across the sheet. */
const AS_SET: Engraving = {};
/**
 * The staff's sizes against a page of a piece, the largest first: a phrase alone on the card is
 * drawn a size larger, and a long one at the first size that keeps it on one system.
 */
const ZOOMS = [1.2, 1, 0.85] as const;
/** A phrase too long for one system at any of them (on a phone) takes two, at a size to read. */
const WRAPPED_ZOOM = 1;

interface TuneStaffProps {
  tune: TuneId;
  /** 0-based. */
  phrase: number;
  /** Semitones from the tune's written key. */
  semitones: number;
  /** The key played wrong: the key of the tune it was played for (an index), and the key played. */
  wrongKey: number;
  wrongMidi: number;
  /** What the drawing says, in words. */
  label: string;
}

/**
 * A phrase of a tune gone wrong (docs/HARMONY.md, "Playing by ear (H5)"): drawn by Verovio in its
 * rhythm and its key, the notes played right in the right colour, the key played wrong in the
 * wrong one beside the note it should have been. Loaded when a tune's first answer goes wrong:
 * the Ear page starts without Verovio.
 */
export default function TuneStaff({
  tune,
  phrase,
  semitones,
  wrongKey,
  wrongMidi,
  label,
}: TuneStaffProps) {
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });
  const box = useRef<HTMLDivElement>(null);
  const drawn = useMemo(() => {
    const data = getTune(tune);
    const wrong = { key: wrongKey, midi: wrongMidi };
    const xml = tunePhraseXml(data, phrase, semitones, wrong);
    const score = parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
      hands: tuneHands(),
    });
    return { xml, score, marks: tuneInk(score, data, phrase, semitones, wrong) };
  }, [tune, phrase, semitones, wrongKey, wrongMidi]);

  // The size this drawing has been found to need, and whether it still takes two systems there.
  const [fit, setFit] = useState({ xml: '', size: 0, wrapped: false });
  const { size, wrapped } = fit.xml === drawn.xml ? fit : { size: 0, wrapped: false };

  function onStatus(next: ScoreStatus) {
    setStatus(next);
    if (next.state !== 'ready') return;
    const systems = box.current?.querySelectorAll('g.system').length ?? 1;
    if (systems < 2 || wrapped) return;
    const last = size === ZOOMS.length - 1;
    setFit({ xml: drawn.xml, size: last ? size : size + 1, wrapped: last });
  }

  return (
    <div className="ear-tune-staff" data-state={status.state} ref={box}>
      <ScoreView
        xml={drawn.xml}
        score={drawn.score}
        title={label}
        step={null}
        pressed={NO_KEYS}
        hands="both"
        onStatus={onStatus}
        marks={drawn.marks}
        engraving={wrapped ? AS_SET : STRETCHED}
        zoom={wrapped ? WRAPPED_ZOOM : ZOOMS[size]}
        fillHeight={false}
      />
    </div>
  );
}
