// Run in the page by the debug harness (Debug/Harness.swift): the file is one function expression.
// Arguments: assets (paths under /assets/ to fetch), fileInput (bool), download (bool).
async ({ assets, fileInput, download }) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (test, ms = 10000) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const value = test();
      if (value) return value;
      await sleep(50);
    }
    return null;
  };
  const attempt = async (fn) => {
    try {
      return await fn();
    } catch (error) {
      return { error: `${error?.name ?? ''}: ${error?.message ?? error}` };
    }
  };
  const r = {};

  r.page = {
    url: location.href,
    origin: location.origin,
    isSecureContext,
    userAgent: navigator.userAgent,
    rendered: document.querySelector('#root')?.children.length > 0,
    moduleScripts: [...document.querySelectorAll('script[type=module]')].map((s) => s.src),
    performanceTick: globalThis.__dacapoMidi?.clock.tick ?? null,
    timeOrigin: performance.timeOrigin,
    crossOriginIsolated: globalThis.crossOriginIsolated ?? null,
    requestIdleCallback: typeof globalThis.requestIdleCallback,
    structuredClone: typeof globalThis.structuredClone,
    cryptoRandomUUID: typeof globalThis.crypto?.randomUUID,
    cryptoSubtle: typeof globalThis.crypto?.subtle,
  };

  // MIME types and status codes as served by the scheme handler.
  const fetchInfo = async (url) => {
    const response = await fetch(url);
    const bytes = (await response.arrayBuffer()).byteLength;
    return { status: response.status, type: response.headers.get('content-type'), bytes };
  };
  r.fetch = {};
  for (const url of [
    '/',
    '/index.html',
    '/favicon.svg',
    '/__probe/probe.wasm',
    '/missing.js',
    '/../../etc/hosts',
    ...assets,
  ])
    r.fetch[url] = await attempt(() => fetchInfo(url));

  // WebAssembly: streaming compile needs application/wasm.
  r.wasm = {
    streaming: await attempt(async () => {
      const { instance } = await WebAssembly.instantiateStreaming(fetch('/__probe/probe.wasm'));
      return instance.exports.add(2, 3);
    }),
  };

  // Fonts (the UI's two text fonts, and Bravura for the Read page's staff once it is open).
  await document.fonts.ready;
  r.fontsAtStart = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);

  // Hash routing and lazy chunks: the Read page is its own chunk (VexFlow + Bravura).
  location.hash = '#/read';
  r.readRoute = {
    hash: location.hash,
    loaded: Boolean(
      await waitFor(() => document.querySelector('main svg, main canvas, .read-setup, main form')),
    ),
    mainText: document.querySelector('main')?.textContent?.slice(0, 80),
  };
  await sleep(300);
  await document.fonts.ready;
  r.fontsAfterRead = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
  r.fontChecks = {
    sourceSerif: document.fonts.check('16px "Source Serif 4"'),
    sourceSans: document.fonts.check('16px "Source Sans 3"'),
  };

  // Persistence: counters that survive a relaunch only if storage persists.
  r.localStorage = await attempt(() => {
    const key = 'dacapo.probe.launches';
    const before = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(before + 1));
    return { before };
  });
  r.indexedDB = await attempt(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dacapo-probe', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = () =>
      new Promise((resolve, reject) => {
        const q = db.transaction('kv').objectStore('kv').get('launches');
        q.onsuccess = () => resolve(q.result ?? 0);
        q.onerror = () => reject(q.error);
      });
    const before = await get();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(before + 1, 'launches');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const databases =
      (await indexedDB.databases?.())?.map((d) => `${d.name} v${d.version}`) ?? 'n/a';
    return { before, databases };
  });
  r.storageManager = await attempt(async () => ({
    persist: typeof navigator.storage?.persist,
    persisted: await navigator.storage?.persisted?.(),
    estimate: await navigator.storage?.estimate?.(),
  }));

  // BroadcastChannel (the practice store syncs tabs with it).
  r.broadcastChannel = await attempt(async () => {
    const a = new BroadcastChannel('dacapo-probe');
    const b = new BroadcastChannel('dacapo-probe');
    const got = await new Promise((resolve) => {
      b.onmessage = (e) => resolve(e.data);
      a.postMessage('hello');
      setTimeout(() => resolve('timeout'), 1000);
    });
    a.close();
    b.close();
    return got;
  });

  // Web Audio: the click's clock mapping uses getOutputTimestamp, else base/output latency.
  r.webAudio = await attempt(async () => {
    const context = new AudioContext({ latencyHint: 'interactive' });
    await context.resume();
    const osc = new OscillatorNode(context, { frequency: 1000 });
    const gain = new GainNode(context, { gain: 0.0001 });
    osc.connect(gain).connect(context.destination);
    osc.start(context.currentTime + 0.05);
    osc.stop(context.currentTime + 0.1);
    await sleep(600);
    const readings = [];
    for (let i = 0; i < 5; i++) {
      const stamp = context.getOutputTimestamp?.();
      readings.push({
        now: performance.now(),
        currentTime: context.currentTime,
        contextTime: stamp?.contextTime,
        performanceTime: stamp?.performanceTime,
      });
      await sleep(100);
    }
    const result = {
      state: context.state,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
      outputLatency: context.outputLatency,
      getOutputTimestamp: typeof context.getOutputTimestamp,
      readings,
    };
    await context.close();
    return result;
  });

  // Web MIDI through the bridge.
  r.webMidi = await attempt(async () => {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const again = await navigator.requestMIDIAccess();
    const ports = (map) =>
      [...map.values()].map((p) => `${p.name} [${p.id}] ${p.state}/${p.connection}`);
    const clock = globalThis.__dacapoMidi.clock;
    return {
      shared: access === again,
      inputs: ports(access.inputs),
      outputs: ports(access.outputs),
      sysex: await navigator.requestMIDIAccess({ sysex: true }).then(
        () => 'granted',
        (e) => e.name,
      ),
      clock: {
        tick: clock.tick,
        width: clock.hi - clock.lo,
        samples: clock.samples,
        resets: clock.resets,
        minRtt: clock.minRtt,
      },
    };
  });

  // A download link, as lib/download.ts makes one.
  if (download) {
    const before = location.href;
    const url = URL.createObjectURL(new Blob(['{"probe":true}\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dacapo-probe.json';
    document.body.append(link);
    link.click();
    link.remove();
    await sleep(1500);
    r.download = { before, after: location.href, stillHere: location.href === before };
  }

  // File input: the Pieces page's import.
  if (fileInput) {
    location.hash = '#/pieces';
    const input = await waitFor(() => document.querySelector('input[type=file]'));
    await sleep(500);
    r.fileInput = {
      found: Boolean(input),
      accept: input?.accept,
      presentBefore: document.body.textContent.includes('A0 Probe Tune'),
    };
    if (input) {
      const changed = new Promise((resolve) => {
        input.addEventListener(
          'change',
          () => resolve([...input.files].map((f) => `${f.name} ${f.size}`)),
          { once: true },
        );
        setTimeout(() => resolve('no change event'), 5000);
      });
      input.click();
      r.fileInput.files = await changed;
      r.fileInput.imported = Boolean(
        await waitFor(() => document.body.textContent.includes('A0 Probe Tune'), 5000),
      );
    }
  }

  location.hash = '#/';
  return JSON.stringify(r);
};
