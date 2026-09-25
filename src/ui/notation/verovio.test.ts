import { describe, expect, it, vi } from 'vitest';
import { layoutOptions, layoutPiece, MAX_TALL_ZOOM, scaleFor, type Toolkit } from './verovio.ts';

describe('scaleFor', () => {
  it('follows the width alone when no height is given', () => {
    expect(scaleFor(375)).toBe(34);
    expect(scaleFor(700)).toBe(38);
    expect(scaleFor(1340)).toBe(42);
  });

  it('keeps the base size for laptop and iPad landscape frames (measured in the app)', () => {
    expect(scaleFor(979, 358)).toBe(42); // Mac window 1280×820
    expect(scaleFor(979, 570)).toBe(42); // iPad Pro 13" landscape viewport, 1376×1000
    expect(scaleFor(992, 613)).toBe(42); // the same during a run
    expect(scaleFor(1000, 650)).toBe(42);
  });

  it('grows with a taller frame, up to a limit (iPad portrait)', () => {
    expect(scaleFor(1000, 780)).toBe(50);
    expect(scaleFor(992, 938)).toBe(Math.round(42 * MAX_TALL_ZOOM)); // iPad Pro 13" portrait
    expect(scaleFor(760, 2000)).toBe(Math.round(38 * MAX_TALL_ZOOM));
  });

  it('lays the page out at the given scale', () => {
    expect(layoutOptions(1000, 50)).toMatchObject({ scale: 50, pageWidth: 2000 });
    expect(layoutOptions(1000)).toMatchObject({ scale: 42 });
  });
});

describe('layoutPiece', () => {
  it('lays out again when only the scale changes, and not when nothing does', () => {
    const setOptions = vi.fn();
    const loadData = vi.fn(() => true);
    const redoLayout = vi.fn();
    const tk = { setOptions, loadData, redoLayout, getLog: () => '' } as unknown as Toolkit;
    expect(layoutPiece(tk, '<score-partwise/>', 1000, 42)).toBe(true);
    expect(layoutPiece(tk, '<score-partwise/>', 1000, 42)).toBe(false);
    expect(redoLayout).not.toHaveBeenCalled();
    expect(layoutPiece(tk, '<score-partwise/>', 1000, 58)).toBe(false);
    expect(redoLayout).toHaveBeenCalledTimes(1);
    expect(setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 58 }));
    expect(loadData).toHaveBeenCalledTimes(1);
  });
});
