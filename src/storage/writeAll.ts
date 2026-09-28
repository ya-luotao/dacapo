/**
 * Issues the writes in order and waits for the transaction to commit. If any write fails, even
 * synchronously, the transaction is aborted so none of them is kept.
 */
export async function writeAll(
  tx: { done: Promise<void>; abort: () => void },
  writes: readonly (() => Promise<unknown>)[],
): Promise<void> {
  const pending: Promise<unknown>[] = [];
  try {
    for (const write of writes) pending.push(write());
  } catch (error) {
    tx.abort();
    await Promise.allSettled([...pending, tx.done]);
    throw error;
  }
  await Promise.all([...pending, tx.done]);
}
