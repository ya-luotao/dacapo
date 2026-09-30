// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from '../../core/musicxml.ts';
import { builtInPiece } from '../../pieces/library/index.ts';
import furElise from '../../pieces/library/beethoven-fur-elise.musicxml?raw';
import minuetInG from '../../pieces/library/petzold-minuet-in-g.musicxml?raw';
import odeToJoy from '../../pieces/library/beethoven-ode-to-joy.musicxml?raw';
import oldFrenchSong from '../../pieces/library/tchaikovsky-old-french-song.musicxml?raw';
import { COMPOSERS, FORMS, formSegments, PERIOD_SPANS, type FormName } from './styles.ts';

const FILES: Record<string, string> = {
  'beethoven-fur-elise': furElise,
  'petzold-minuet-in-g': minuetInG,
  'beethoven-ode-to-joy': odeToJoy,
  'tchaikovsky-old-french-song': oldFrenchSong,
};

function sections(form: FormName): string[] {
  const spec = FORMS[form];
  const xml = new DOMParser().parseFromString(FILES[spec.piece]!, 'application/xml');
  return formSegments(parseMusicXml(xml, { hands: null }), spec.starts).map(
    (s) => `${s.label} ${s.from}-${s.to}`,
  );
}

describe('the forms of the library’s pieces', () => {
  it('are pieces of the library', () => {
    for (const spec of Object.values(FORMS)) expect(builtInPiece(spec.piece)).toBeDefined();
  });

  it('play the Ode to Joy as a a′ b a′, four bars each', () => {
    expect(sections('period')).toEqual(['a 1-4', 'a′ 5-8', 'b 9-12', 'a′ 13-16']);
  });

  it('play the Minuet in G as two halves, each repeated', () => {
    expect(sections('binary')).toEqual(['A 1-16', 'A 1-16', 'B 17-32', 'B 17-32']);
  });

  it('play the Old French Song as a a b a', () => {
    expect(sections('songForm')).toEqual(['a 0-8', 'a 9-16', 'b 17-24', 'a 25-32']);
  });

  it('play Für Elise’s A section as a, a, then b a twice, each ending its own way', () => {
    expect(sections('rondoSection')).toEqual([
      'a 0-8',
      'a 0-9',
      'b 10-15',
      'a 16-23',
      'b 10-15',
      'a 16-24',
    ]);
  });

  it('place every composer in the period of their music', () => {
    for (const c of COMPOSERS) {
      const [from, to] = PERIOD_SPANS[c.period];
      expect(c.died, c.id).toBeGreaterThan(from);
      expect(c.born, c.id).toBeLessThan(to);
    }
  });
});
