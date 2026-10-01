// The service worker of the web app (docs/OFFLINE.md), built to sw.js at the root of the build
// (vite.config.ts, which also gives it the build's list). Only the worker's events are here; what
// they do is worker.ts. Whatever goes wrong in a handler, the request goes to the network as if
// there were no worker.

import type { OfflineList } from './files.ts';
import { createOfflineWorker } from './worker.ts';

declare const self: ServiceWorkerGlobalScope;
/** The build's files, each with its group, and the hash of the list (vite.config.ts). */
declare const __OFFLINE_LIST__: OfflineList;

const worker = createOfflineWorker({
  scope: self.registration.scope,
  list: __OFFLINE_LIST__,
  stores: self.caches,
  fetch: (input, init) => self.fetch(input, init),
});

self.addEventListener('install', (event) => {
  // A failed install leaves the worker before (or none) in charge. A finished one takes over at
  // once: a page of the release before still finds its files, by address, in that release's store.
  event.waitUntil(worker.install().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    worker
      .activate()
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  let answer: Promise<Response> | null;
  try {
    answer = worker.answer(event.request, (work) => {
      try {
        event.waitUntil(work);
      } catch {
        // The event is over: the work goes on for as long as the worker lives.
      }
    });
  } catch {
    return;
  }
  if (answer) event.respondWith(answer);
});

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil(
    worker.message(event.data).then(
      (reply) => port.postMessage(reply),
      () => port.postMessage(null),
    ),
  );
});
