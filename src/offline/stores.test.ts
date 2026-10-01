import { describe, expect, it } from 'vitest';
import {
  latestStore,
  nextStore,
  obsoleteStores,
  otherStores,
  storeOf,
  storePrefix,
} from './stores.ts';

const P = storePrefix('/');
const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';
const C = 'cccccccccccc';

describe('store names', () => {
  it('carry the scope, an order and the version', () => {
    expect(P).toBe('dacapo-offline:/:');
    expect(storePrefix('/dacapo/')).toBe('dacapo-offline:/dacapo/:');
    expect(nextStore([], P, A)).toBe(`dacapo-offline:/:1:${A}`);
    expect(nextStore([`${P}1:${A}`, `${P}7:${B}`], P, C)).toBe(`${P}8:${C}`);
  });

  it('the order is a number, not a string', () => {
    const names = [`${P}9:${A}`, `${P}10:${B}`];
    expect(latestStore(names, P)).toBe(`${P}10:${B}`);
    expect(nextStore(names, P, C)).toBe(`${P}11:${C}`);
  });

  it('a version’s store is its latest', () => {
    const names = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${A}`];
    expect(storeOf(names, P, A)).toBe(`${P}3:${A}`);
    expect(storeOf(names, P, B)).toBe(`${P}2:${B}`);
    expect(storeOf(names, P, C)).toBeNull();
    expect(storeOf([], P, A)).toBeNull();
    expect(latestStore([], P)).toBeNull();
  });

  it('the others come latest first: the first is the one before', () => {
    const names = [`${P}1:${A}`, `${P}3:${C}`, `${P}2:${B}`];
    expect(otherStores(names, P, `${P}3:${C}`)).toEqual([`${P}2:${B}`, `${P}1:${A}`]);
    expect(otherStores(names, P, `${P}2:${B}`)).toEqual([`${P}3:${C}`, `${P}1:${A}`]);
  });
});

describe('obsoleteStores', () => {
  const all = (names: readonly string[]) => new Set(names);

  it('keeps the store in charge and the one before it', () => {
    const names = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${C}`];
    expect(obsoleteStores(names, P, `${P}3:${C}`, all(names))).toEqual([`${P}1:${A}`]);
    expect(obsoleteStores(names.slice(1), P, `${P}3:${C}`, all(names))).toEqual([]);
    expect(obsoleteStores([`${P}3:${C}`], P, `${P}3:${C}`, all(names))).toEqual([]);
    expect(obsoleteStores([], P, `${P}1:${A}`, all([]))).toEqual([]);
  });

  it('after going back to an earlier version, the one before is the one that ran before', () => {
    // A, then B, then A again: A's new store is the third.
    const names = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${A}`];
    expect(obsoleteStores(names, P, `${P}3:${A}`, all(names))).toEqual([`${P}1:${A}`]);
  });

  it('a store left by an install that was cut short is not the one before, and goes', () => {
    // B's install never finished; C is in charge now, and the tabs still open run A.
    const names = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${C}`];
    const complete = all([`${P}1:${A}`, `${P}3:${C}`]);
    expect(obsoleteStores(names, P, `${P}3:${C}`, complete)).toEqual([`${P}2:${B}`]);
    // Two of them, and two releases before them: the later release stays.
    const more = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${C}`, `${P}4:${C}`, `${P}5:${A}`];
    expect(obsoleteStores(more, P, `${P}5:${A}`, all([`${P}1:${A}`, `${P}2:${B}`]))).toEqual([
      `${P}4:${C}`,
      `${P}3:${C}`,
      `${P}1:${A}`,
    ]);
    // None is whole: nothing is the one before.
    expect(obsoleteStores(names, P, `${P}3:${C}`, all([]))).toEqual([`${P}2:${B}`, `${P}1:${A}`]);
  });

  it('the store in charge is never deleted, whole or not', () => {
    const names = [`${P}1:${A}`, `${P}2:${B}`];
    expect(obsoleteStores(names, P, `${P}2:${B}`, all([]))).toEqual([`${P}1:${A}`]);
    expect(obsoleteStores(names, P, `${P}2:${B}`, all([`${P}1:${A}`]))).toEqual([]);
  });

  it('an unfinished store later than the one in charge may be an install still running', () => {
    const names = [`${P}1:${A}`, `${P}2:${B}`, `${P}3:${C}`];
    const complete = all([`${P}1:${A}`, `${P}2:${B}`]);
    expect(obsoleteStores(names, P, `${P}2:${B}`, complete)).toEqual([]);
  });

  it('never names a store that is not the worker’s own at this scope', () => {
    const foreign = [
      'workbox-precache-v2',
      'dacapo',
      'dacapo-offline',
      'dacapo-offline:',
      `dacapo-offline:/dacapo/:1:${A}`,
      `dacapo-offline:/dacapo/:2:${B}`,
      `dacapo-offline:/other/:5:${A}`,
      // The prefix, then something that is not an order and a version.
      `${P}x:${A}`,
      `${P}0:${A}`,
      `${P}1:`,
      `${P}1:not-a-version`,
      `${P}:1:${A}`,
      `${P}1:${A}:more`,
    ];
    const names = [...foreign, `${P}1:${A}`, `${P}2:${B}`, `${P}3:${C}`];
    expect(obsoleteStores(names, P, `${P}3:${C}`, all(names))).toEqual([`${P}1:${A}`]);
    // Unfinished or not, what is not the worker's is not named.
    expect(obsoleteStores(names, P, `${P}3:${C}`, all([`${P}2:${B}`]))).toEqual([`${P}1:${A}`]);
    expect(otherStores(foreign, P, `${P}3:${C}`)).toEqual([]);
    expect(latestStore(foreign, P)).toBeNull();
  });

  it('a scope below another keeps its own stores', () => {
    const inner = storePrefix('/a/b/');
    const outer = storePrefix('/a/');
    const names = [`${outer}1:${A}`, `${outer}2:${B}`, `${outer}3:${C}`, `${inner}1:${A}`];
    expect(obsoleteStores(names, outer, `${outer}3:${C}`, all(names))).toEqual([`${outer}1:${A}`]);
    expect(obsoleteStores(names, inner, `${inner}1:${A}`, all(names))).toEqual([]);
  });
});
