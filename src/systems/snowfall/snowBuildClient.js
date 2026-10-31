// SNOW-THREAD (2026-10-26): the snow's builds off the main thread - the main thread's half. The runtime
// (systems/snowfallRuntime.js) posts a build where it would begin one and takes the finished arrays the first frame they
// are in; snowBuildKernel.js runs the build on snowBuildWorker.js's thread. The shape is terrainGenClient.js's (EV7).
// The fallback is the old path: no Worker, a factory that throws, a worker that dies, a ground with no snapshot, or
// `?snowthread=off` - the runtime builds on this thread. Crossing: masks and settings once; a pixel's ground (snowGroundLaw.js
// snowGroundSnapshot, keyed by its source arrays) copied once a version; a job's frame, keys and context; an answer's
// arrays transferred, and handed back to be written into again. A job a newer one replaced is never taken.
// `?snowthread=verify` (snowBuildVerify.js) builds every job again here from the live ground and compares.

import { MID } from '../snowfallRuntime.js';
import { snowGroundSources, snowPixelX, snowPixelY } from './snowGroundLaw.js';
import { SnowBuildVerifier, snowThreadVerify } from './snowBuildVerify.js';
import { pageHas } from '../pageQuery.js';

/** `?snowthread=off`: every snow build on the main thread (the ?terrainthread=off shape), read once a host. */
export function snowThreadDisabled(search = globalThis.location?.search) {
  try {
    return /[?&]snowthread=off\b/.test(search ?? '');
  } catch {
    return false;
  }
}

/** The one place the worker's URL is spelled. */
function defaultWorkerFactory() {
  return new Worker(new URL('./snowBuildWorker.js', import.meta.url), { type: 'module' });
}

/** A pixel's ground or roads unused this long is let go on the worker (sent again if it is asked for again). */
const UNUSED_MS = 10_000;
/** The metres past a build's reach whose pixels it is handed - a point on a pixel's very edge is read on either side. */
const REACH_MARGIN = 4;
/** A worker silent this long with a build out hangs without a fault: it is let go and the build made on the main thread. A
 *  build takes the worker tens of milliseconds; a page hidden long enough to pass this only falls back to the old path. */
const JOB_DEADLINE_MS = 10_000;

/** A copy of a typed array alone (structured clone would copy the whole buffer a view stands on). */
const own = (a) => (ArrayBuffer.isView(a) ? a.slice() : a);

export class SnowBuildClient {
  /**
   * @param {object} o
   * @param {Uint8Array[]} o.masks - the three surface masks (SnowCoverage's)
   * @param {any} o.settings - snowfallSettings()
   * @param {?Function} [o.workerFactory] - a test seam
   * @param {() => number} [o.clock] - milliseconds
   * @param {boolean} [o.verify] - the debug cross-check (snowBuildVerify.js), `?snowthread=verify` by default
   */
  constructor({
    masks,
    settings,
    workerFactory = null,
    clock = () => globalThis.performance?.now?.() ?? Date.now(),
    verify = snowThreadVerify(),
  }) {
    this.clock = clock;
    this._worker = null;
    this._job = 0;
    this._key = 0;
    /** @type {Map<number, any>} answers in, by job */
    this._answers = new Map();
    this._latest = { mid: 0, local: 0 };
    this._midTiles = { id: 0, tiles: new Map() };
    this._localPosted = 0;
    /** SnowTerrain -> { key, sources } */
    this._keys = new WeakMap();
    /** key -> last used; the grounds the worker holds */
    this._sent = new Map();
    /** BasicRoadsTerrain -> id */
    this._roadIds = new WeakMap();
    /** id -> last used; the roads the worker holds */
    this._roadsSent = new Map();
    this._nextPrune = 0;
    /** job -> the clock when it was posted, while it is out */
    this._postedAt = new Map();
    this._heardAt = -Infinity;
    this.posted = 0;
    this.taken = 0;
    /** @type {?SnowBuildVerifier} */
    this._verify = null;
    const factory =
      workerFactory ?? (snowThreadDisabled() || typeof Worker === 'undefined' ? null : defaultWorkerFactory);
    if (!factory) return;
    let w = null;
    try {
      w = factory();
      w.onerror = (e) => this._down(e?.message ?? e);
      w.onmessage = (ev) => this._answer(ev.data);
      const copies = masks.map((m) => m.slice());
      if (verify) {
        this._verify = new SnowBuildVerifier({ masks, clock });
        this._verify.message({ t: 'init', masks: copies, settings });
        if (pageHas('shot')) globalThis.__snowVerify = this._verify; // the in-game driver reads its report (a probe seam: behind the shot gate)
      }
      w.postMessage(
        { t: 'init', masks: copies, settings },
        copies.map((m) => m.buffer),
      );
      this._worker = w;
    } catch (e) {
      console.warn('[snowfall] build worker unavailable; the snow builds on the main thread', e);
      try {
        w?.terminate?.();
      } catch {
        /* never spawned or already gone */
      }
      this._worker = null;
    }
  }

  get up() {
    return !!this._worker;
  }

  /** The ring the runtime has just begun (its buildCenter, its prepared context0) - the job's id, or 0 to build here. */
  postMid(rt) {
    const M = rt.mid,
      c = M.buildCenter;
    const job = this._world(rt, c[0], c[1], MID.radius + REACH_MARGIN, M.context0);
    if (!job) return 0;
    const id = ++this._job;
    this._forget(this._latest.mid);
    this._latest.mid = id; // before the post: an answer is taken for the newest build of its kind alone
    this._midTiles = { id, tiles: job.tiles };
    return this._post({ t: 'mid', id, center: [c[0], c[1]], ...job.message }, [], job.live) ? id : 0;
  }

  /** The recentre the runtime has just begun (_beginRecenter's state, its prepared context) - the job's id, or 0. */
  postLocal(rt) {
    const L = rt.local,
      c = L.nextCenter;
    const job = this._world(rt, c[0], c[1], rt.gridRadius + REACH_MARGIN, rt.context);
    if (!job) return 0;
    const id = ++this._job;
    const mirror = L.fromJob && L.fromJob === this._localPosted ? L.fromJob : 0;
    const p = rt.outerCenter ?? c;
    const m = {
      t: 'local',
      id,
      ...job.message,
      player: [p[0], p[1]],
      res: L.res,
      sres: L.sres,
      mirror,
      center: [...L.center],
      nextCenter: [...L.nextCenter],
      nextDyn: [...L.nextDyn],
      nextStat: [...L.nextStat],
      meshDelta: [...L.meshDelta],
      statDelta: [...L.statDelta],
      full: L.fullRebuild,
      baseY: L.baseY,
    };
    const transfer = [];
    if (!mirror && !L.fullRebuild) {
      // the worker does not hold the window this recentre copies from
      m.arrays = { pos: L.pos.slice(), nrm: L.nrm.slice(), statics: L.statics.slice(), context: L.context.slice() };
      for (const a of Object.values(m.arrays)) transfer.push(a.buffer);
    }
    this._forget(this._latest.local);
    this._latest.local = id;
    this._localPosted = id;
    return this._post(m, transfer, job.live) ? id : 0;
  }

  /** A job's answer once it is in: { ok, arrays, tiles } (tiles the runtime's own), { ok: false } for a build that
   *  could not stand, { down: true } for one the worker will never answer; null while it is out. */
  take(id) {
    const r = this._answers.get(id);
    if (!r) {
      if (!this._worker) return { down: true };
      if (this._silentFor() > JOB_DEADLINE_MS) {
        this._down({ silentMs: this._silentFor() });
        return { down: true };
      }
      return null;
    }
    this._answers.delete(id);
    this.taken++;
    if (r.ok && r.t === 'mid') {
      const tiles = this._midTiles.id === id ? this._midTiles.tiles : null;
      r.tiles = r.tiles.map((k) => tiles?.get(k));
      this._midTiles = { id: 0, tiles: new Map() };
      if (r.tiles.some((t) => !t)) return { ok: false };
    }
    if (r.mirror) return { down: true }; // never expected: the worker's window was not the one named - built here
    return r;
  }

  /** Arrays the runtime is done with, back to the worker to write the next answers into. */
  recycle(arrays) {
    if (!this._worker) return;
    const seen = new Set();
    for (const a of arrays) if (a?.buffer?.byteLength && !seen.has(a.buffer)) seen.add(a.buffer);
    if (seen.size) this._post({ t: 'recycle', buffers: [...seen] }, [...seen]);
  }

  /** The runtime's world reset (a door, a load, a fast travel) with these builds out: they are let go. */
  reset(ids) {
    this._verify?.letGo(ids.filter(Boolean));
  }

  settings(s) {
    if (this._worker) this._post({ t: 'settings', settings: s });
  }

  offset(o) {
    if (this._worker) this._post({ t: 'offset', offset: [o[0], o[1], o[2]] });
  }

  dispose() {
    try {
      this._worker?.terminate?.();
    } catch {
      /* already gone */
    }
    this._worker = null;
  }

  // ---- the job's world ----
  /** The pixels a build round (cx, cz) may read within `reach`, their grounds sent where the worker lacks them, and
   *  the prepared context - null where the ground cannot be copied (the build is the main thread's). */
  _world(rt, cx, cz, reach, context) {
    const world = rt.world;
    if (!this._worker || !world.frame || !world.terrainOn) return null;
    const frame = world.frame();
    if (!frame) return null;
    const [mx, my, fx, fz, size] = frame;
    const now = this.clock();
    const x0 = snowPixelX(mx, fx, size, cx - reach),
      x1 = snowPixelX(mx, fx, size, cx + reach);
    const y0 = snowPixelY(my, fz, size, cz + reach),
      y1 = snowPixelY(my, fz, size, cz - reach);
    const pixels = [],
      tiles = new Map(),
      out = [0, 0, 0];
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const t = world.terrainOn(px, py);
        if (!t) continue;
        const key = this._tile(t, now);
        if (!key) return null;
        const o = t.origin(out);
        pixels.push([px, py, key, o[0], o[1], o[2]]);
        tiles.set(key, t);
      }
    }
    const roads = [];
    for (const r of context.roads) {
      const id = this._road(r.data, now);
      if (!id) return null;
      roads.push({ id, x: r.x, z: r.z, tileMetres: r.tileMetres, archive: r.archive, mapX: r.mapX, mapY: r.mapY });
    }
    this._prune(now);
    const ctx = {
      roads,
      settlements: context.settlements,
      locations: context.locations,
      settlementFeather: context.settlementFeather,
      locationFeather: context.locationFeather,
    };
    const live = this._verify ? { tiles, roads: context.roads.map((r) => r.data) } : null; // the cross-check's alone
    return { tiles, live, message: { frame: [mx, my, fx, fz, size], pixels, context: ctx } };
  }

  /** A pixel's key on the worker - its ground sent first if the worker does not hold this version of it. 0: no data. */
  _tile(t, now) {
    const snap = t.snapshot?.();
    if (!snap) return 0;
    const g = snap.ground;
    const sources = [...snowGroundSources(g), snap.tileMap, g._stride, g.floors, snap.winterArchive, snap.bare];
    let rec = this._keys.get(t);
    if (!rec || rec.sources.some((s, i) => s !== sources[i])) {
      if (rec) this._verify?.groundReread(snap.mapX, snap.mapY);
      rec = { key: ++this._key, sources };
      this._keys.set(t, rec);
    }
    if (!this._sent.has(rec.key)) {
      const dw = g.deepWaters;
      const ground = {
        samples: own(g.samples),
        _stride: g._stride,
        groundNormals: own(g.groundNormals),
        _bed: g._bed ? { depths: own(g._bed.depths) } : null,
        deepWaters: dw
          ? {
              holes: own(dw.holes),
              floor: dw.floor
                ? { vertexLocalY: own(dw.floor.vertexLocalY), floorQuadWater: own(dw.floor.floorQuadWater) }
                : null,
            }
          : null,
        floors: g.floors,
      };
      const tile = {
        key: rec.key,
        mapX: snap.mapX,
        mapY: snap.mapY,
        size: snap.size,
        tileMap: own(snap.tileMap),
        winterArchive: snap.winterArchive,
        bare: snap.bare,
        ground,
      };
      if (!this._post({ t: 'tiles', tiles: [tile] })) return 0;
    }
    this._sent.set(rec.key, now);
    return rec.key;
  }

  /** A Basic Roads tile's id on the worker, sent first if it does not hold it. 0: not a tile the worker can rebuild. */
  _road(data, now) {
    let id = this._roadIds.get(data);
    if (!id) {
      id = ++this._key;
      this._roadIds.set(data, id);
    }
    if (!this._roadsSent.has(id)) {
      const roads = {
        mapX: data.mapX,
        mapY: data.mapY,
        tiles: own(data.tiles),
        kinds: own(data.kinds),
        roadTiles: data.roadTiles,
        pathTiles: data.pathTiles,
      };
      if (!(roads.tiles instanceof Uint8Array) || !(roads.kinds instanceof Uint8Array)) return 0;
      if (!this._post({ t: 'roads', id, roads })) return 0;
    }
    this._roadsSent.set(id, now);
    return id;
  }

  /** What the worker holds and no build asked for a while, let go there. */
  _prune(now) {
    if (now < this._nextPrune) return;
    this._nextPrune = now + UNUSED_MS / 2;
    const tiles = [],
      roads = [];
    for (const [k, at] of this._sent)
      if (now - at > UNUSED_MS) {
        tiles.push(k);
        this._sent.delete(k);
      }
    for (const [k, at] of this._roadsSent)
      if (now - at > UNUSED_MS) {
        roads.push(k);
        this._roadsSent.delete(k);
      }
    if (tiles.length || roads.length) this._post({ t: 'drop', tiles, roads });
  }

  /** How long the worker has said nothing while a build is out - since the oldest build out was posted, or since its
   *  last answer, whichever is later (a ring the player outruns is posted again; the worker's silence is what counts). */
  _silentFor() {
    if (!this._postedAt.size) return 0;
    return this.clock() - Math.max(this._heardAt, Math.min(...this._postedAt.values()));
  }

  /** A build a newer one of its kind replaces: an answer already in (a build a door or a teleport let go before it
   *  landed) is never taken - its arrays go back. */
  _forget(id) {
    const r = this._answers.get(id);
    if (!r) return;
    this._answers.delete(id);
    this._verify?.handedBack(id, 'replaced');
    if (r.arrays) this.recycle(Object.values(r.arrays));
  }

  // ---- the wire ----
  _post(m, transfer = [], live = null) {
    try {
      this._verify?.message(m, live);
      this._worker.postMessage(m, transfer);
      if (m.t === 'mid' || m.t === 'local') {
        this.posted++;
        this._postedAt.set(m.id, this.clock());
      }
      return true;
    } catch (e) {
      console.warn('[snowfall] a build could not cross to the worker; it is built on the main thread', e?.message ?? e);
      return false;
    }
  }

  _answer(m) {
    if (m.t === 'error') {
      this._down(m.message);
      return;
    }
    this._verify?.answer(m);
    this._postedAt.delete(m.id); // answered: no deadline left to keep
    this._heardAt = this.clock();
    if (m.missing) {
      this._sent.delete(m.missing);
    } // never expected: sent again with the next build
    if (m.id !== this._latest[m.t]) {
      // replaced by a newer build of its kind: never taken
      this._verify?.handedBack(m.id, 'late');
      if (m.arrays) this.recycle(Object.values(m.arrays));
      return;
    }
    this._answers.set(m.id, m);
  }

  _down(message) {
    this._verify?.event('workerDown');
    console.warn('[snowfall] the build worker stopped - the snow builds on the main thread from here:', message);
    this.dispose();
  }
}
