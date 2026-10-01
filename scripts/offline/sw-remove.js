// The worker that takes the offline worker away (docs/OFFLINE.md, "Releases"). Shipped as `sw.js`
// in place of the built one, it replaces the worker in every browser at its next visit, deletes
// the worker's stores at this scope, and unregisters itself. It answers no request and reloads
// nothing: the tab that is open goes on as it is, and from the next load the browser fetches
// everything from the network, as it did before there was a worker.
//
// The stores' names are those of src/offline/stores.ts (`dacapo-offline:<scope path>:…`); a test
// (src/offline/remove.test.ts) keeps the two in step. Nothing else of the origin is touched:
// not the practice data (IndexedDB), not another scope's stores.

self.addEventListener('install', () => {
  // In place of the worker before it at once, open tabs or not.
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const prefix = `dacapo-offline:${new URL(self.registration.scope).pathname}:`;
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(prefix)).map((name) => caches.delete(name)),
      );
      await self.registration.unregister();
    })(),
  );
});
