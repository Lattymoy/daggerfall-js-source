// DFMOD3 - A FEW WORKERS FOR EVERY ATTACHED MOD, NOT ONE EACH.
//
// A player with DREAM's HD set attached (ten-plus bundles) ran the tab out of memory: "Array buffer allocation
// failed" on decodes, then on the game's own classic textures, IndexedDB and the navmesh. Each bundle had its own
// worker (unityBundleClient.js) - its own V8 heap - and every archive's preload sent its asks all at once, so every
// worker was decoding full-size pictures at the same time, each heap growing on its own garbage.
//
// So the player's mods share a POOL:
//   - `size` workers (default 2), each holding EVERY opened bundle (an open is the header and the object table, read
//     by range from the stored Blob - milliseconds and a few MB, since the stored index skips the texture heads);
//   - ONE decode in flight per worker; the rest wait here, on this side, as names - not as pixels;
//   - an ask carries a DEADLINE: one still waiting when it passes is answered null without being sent (the classic
//     art draws for it this time) - a queue can never grow into minutes of work nobody is waiting for any more;
//   - a worker that dies takes its asks with it (answered null) and the pool carries on with the ones left.
// Speaks unityBundleWorker.js's protocol with a bundle id (`bid`) on every message.

let _nextBid = 1;

function defaultWorkerFactory() {
  return new Worker(new URL('./unityBundleWorker.js', import.meta.url), { type: 'module' });
}

/**
 * @param {{ size?: number, workerFactory?: () => Worker }} [opts]
 * @returns {{ open(src: Blob|Uint8Array, o?: object): Promise<{ rgba(name: string, o?: object): Promise<object|null>, close(): void }>, busy(): number, close(): void }}
 */
export function createBundlePool({ size = 2, workerFactory = defaultWorkerFactory } = {}) {
  const lanes = [];
  let nextId = 1;
  const laneOf = (i) => {
    if (!lanes[i]) {
      const lane = { w: null, dead: null, pending: new Map(), queue: [], inFlight: 0 };
      try {
        lane.w = workerFactory();
        lane.w.onerror = (e) => kill(lane, e?.message ?? 'bundle worker failed');
        lane.w.onmessage = (ev) => {
          const m = ev.data ?? {};
          const p = lane.pending.get(m.id);
          if (!p) return;
          lane.pending.delete(m.id);
          if (p.decode) lane.inFlight--;
          if (m.t === 'error') p.reject(new Error(m.message)); else p.resolve(m);
          pump(lane);
        };
      } catch (e) { lane.dead = e; }
      lanes[i] = lane;
    }
    return lanes[i];
  };
  const kill = (lane, why) => {
    if (lane.dead) return;
    lane.dead = new Error(why);
    for (const p of lane.pending.values()) p.reject(lane.dead);
    lane.pending.clear();
    for (const q of lane.queue) q.resolve(null);
    lane.queue = [];
    try { lane.w?.terminate?.(); } catch { /* gone */ }
  };
  const send = (lane, msg, transfer = [], decode = false) => new Promise((resolve, reject) => {
    if (lane.dead) { reject(lane.dead); return; }
    const id = nextId++;
    lane.pending.set(id, { resolve, reject, decode });
    if (decode) lane.inFlight++;
    try { lane.w.postMessage({ ...msg, id }, transfer); } catch (e) { lane.pending.delete(id); if (decode) lane.inFlight--; reject(e); }
  });
  /** Send the next ask still worth doing; one decode at a time per worker. */
  const pump = (lane) => {
    while (!lane.dead && lane.inFlight === 0 && lane.queue.length) {
      const q = lane.queue.shift();
      if (q.deadline && Date.now() > q.deadline) { q.resolve(null); continue; }   // nobody is waiting for it any more
      send(lane, q.msg, [], true).then((m) => q.resolve(q.msg.t === 'layers' ? (m.images ?? null) : (m.image ?? null)), () => q.resolve(null));
    }
  };
  const live = () => { const out = []; for (let i = 0; i < Math.max(1, size); i++) { const l = laneOf(i); if (!l.dead) out.push(l); } return out; };

  return {
    /** Open a bundle in every worker. Rejects only when no worker can hold it. */
    async open(src, { maxTextureSize = Infinity, knownTextures = null } = {}) {
      const bid = _nextBid++;
      const isBlob = typeof Blob !== 'undefined' && src instanceof Blob;
      const ls = live();
      if (!ls.length) throw new Error('no bundle worker could start');
      const results = await Promise.allSettled(ls.map((lane) => send(lane, isBlob
        ? { t: 'open', bid, blob: src, maxTextureSize, knownTextures, quiet: true }
        : { t: 'open', bid, bytes: src.slice(), maxTextureSize, knownTextures, quiet: true })));
      const held = ls.filter((_, i) => results[i].status === 'fulfilled');
      if (!held.length) throw results[0].reason;
      return {
        onThread: false,
        /** One picture, top-down RGBA - or null when it is missing, would not decode, or its deadline passed first. */
        rgba(name, { maxSize, deadline = 0 } = {}) {
          const ready = held.filter((l) => !l.dead);
          if (!ready.length) return Promise.resolve(null);
          const lane = ready.reduce((a, b) => (a.queue.length + a.inFlight <= b.queue.length + b.inFlight ? a : b));
          return new Promise((resolve) => {
            lane.queue.push({ msg: { t: 'rgba', bid, name, maxSize }, deadline, resolve });
            pump(lane);
          });
        },
        /** GROUND1: every slice of a texture array - queued as a picture is, with no deadline (the ground waits for it). */
        layers(name) {
          const ready = held.filter((l) => !l.dead);
          if (!ready.length) return Promise.resolve(null);
          const lane = ready.reduce((a, b) => (a.queue.length + a.inFlight <= b.queue.length + b.inFlight ? a : b));
          return new Promise((resolve) => { lane.queue.push({ msg: { t: 'layers', bid, name }, deadline: 0, resolve }); pump(lane); });
        },
        close() { for (const l of held) { if (!l.dead) try { l.w.postMessage({ t: 'close', bid }); } catch { /* gone */ } } },
      };
    },
    /** How many asks are waiting or decoding, over every worker. */
    busy: () => lanes.reduce((n, l) => n + (l ? l.queue.length + l.inFlight : 0), 0),
    close() { for (const l of lanes) if (l) kill(l, 'bundle pool closed'); lanes.length = 0; },
  };
}
