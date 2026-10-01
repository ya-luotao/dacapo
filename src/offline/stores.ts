// The names of the offline worker's stores (the browser's Cache Storage, which a whole origin
// shares): `dacapo-offline:<scope path>:<order>:<version>`. The scope is in the name so that two
// copies of dacapo on one origin, or anything else there, never touch each other's; the order
// counts the stores made on this device, so "the one before" is the release this device ran
// before, whatever was built when.

const VERSION = /^[0-9a-f]{6,64}$/;

/** What every store of the worker at this scope starts with. `scopePath` ends in `/`. */
export function storePrefix(scopePath: string): string {
  return `dacapo-offline:${scopePath}:`;
}

interface StoreName {
  name: string;
  order: number;
  version: string;
}

function parse(name: string, prefix: string): StoreName | null {
  if (!name.startsWith(prefix)) return null;
  const match = /^([1-9]\d{0,14}):(.+)$/.exec(name.slice(prefix.length));
  if (!match || !VERSION.test(match[2]!)) return null;
  return { name, order: Number(match[1]), version: match[2]! };
}

/** The worker's own stores among `names`, the latest first. Any other name is never touched. */
function own(names: readonly string[], prefix: string): StoreName[] {
  return names
    .map((name) => parse(name, prefix))
    .filter((store) => store !== null)
    .sort((a, b) => b.order - a.order);
}

/** The latest store of `version`, or null when there is none. */
export function storeOf(names: readonly string[], prefix: string, version: string): string | null {
  return own(names, prefix).find((store) => store.version === version)?.name ?? null;
}

/** The latest store of all, or null. */
export function latestStore(names: readonly string[], prefix: string): string | null {
  return own(names, prefix)[0]?.name ?? null;
}

/** The name of a new store for `version`: one after the latest. */
export function nextStore(names: readonly string[], prefix: string, version: string): string {
  const latest = own(names, prefix)[0]?.order ?? 0;
  return `${prefix}${latest + 1}:${version}`;
}

/** The worker's stores other than `mine`, the latest first. */
export function otherStores(names: readonly string[], prefix: string, mine: string): string[] {
  return own(names, prefix)
    .map((store) => store.name)
    .filter((name) => name !== mine);
}

/**
 * The stores to delete once `mine` is in charge: all of the worker's but it and the one before.
 * `complete` are the stores an install finished (they hold the page, which is stored last). The
 * one before is the latest complete one: a store left by an install that was cut short is not a
 * release's store, so it is deleted and never kept in a release's place. One later than `mine`
 * may be an install still running, and is left to it.
 */
export function obsoleteStores(
  names: readonly string[],
  prefix: string,
  mine: string,
  complete: ReadonlySet<string>,
): string[] {
  const order = parse(mine, prefix)?.order ?? Infinity;
  const others = own(names, prefix).filter((store) => store.name !== mine);
  const before = others.find((store) => complete.has(store.name));
  return others
    .filter((store) => (complete.has(store.name) ? store !== before : store.order < order))
    .map((store) => store.name);
}
