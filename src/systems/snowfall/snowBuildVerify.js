// SNOW-THREAD VERIFY (2026-10-26): `?snowthread=verify`, a debug cross-check that the build worker never builds from a
// stale copy of the ground. The client (snowBuildClient.js) keeps one copy of a pixel's ground on the worker for as long
// as the arrays it was taken from are the same arrays. A ground rewritten in place, a road tile or a mask changed under
// a copy, would build from old bytes without any error. This mode rebuilds every job on the main thread from what is live
// at the post and compares the worker's answer with it, byte for byte.
//
// How:
//  - A shadow SnowBuildKernel runs on this thread. It is handed every message the worker is, in the same order, so its
//    runtime state (the ring it copies from, the window it holds, the settings, the floating origin) is the worker's.
//  - It is never handed the client's copies. Each job gets fresh copies of the live ground and roads of the pixels the
//    job names, under keys of its own, dropped after the job.
//  - Its answer is kept by job; the worker's answer, when it lands, is compared array for array.
//  - A mismatch is counted and logged with the events that came before it, and with the pixels whose held copy differs
//    from the live ground now.
//
// Off (the default), the client holds no verifier and pays one null check a post and an answer. On, every job is built
// twice on the main thread's time: it is for driving the game to look for mismatches, never for play.

import { SnowBuildKernel } from './snowBuildKernel.js';

/** `?snowthread=verify`: the cross-check on, read once a host. */
export function snowThreadVerify(search = globalThis.location?.search) {
  try { return /[?&]snowthread=verify\b/.test(search ?? ''); } catch { return false; }
}

/** The events kept to say what came before a mismatch. */
const EVENTS_KEPT = 24;
/** The mismatches kept in full (all are counted). */
const MISMATCHES_KEPT = 20;
/** Shadow keys and road ids start here, clear of the client's. */
const SHADOW_KEYS_FROM = 1 << 30;

const bytesOf = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const own = (a) => (ArrayBuffer.isView(a) ? a.slice() : a);

function sameBytes(a, b) {
  if (!a || !b) return a === b;
  const x = bytesOf(a), y = bytesOf(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** The ground record the worker is handed (snowBuildClient.js `_tile`'s shape), copied from a live snapshot. */
function groundRecord(key, snap) {
  const g = snap.ground, dw = g.deepWaters;
  return {
    key, mapX: snap.mapX, mapY: snap.mapY, size: snap.size, tileMap: own(snap.tileMap), winterArchive: snap.winterArchive, bare: snap.bare,
    ground: {
      samples: own(g.samples), _stride: g._stride, groundNormals: own(g.groundNormals), _bed: g._bed ? { depths: own(g._bed.depths) } : null,
      deepWaters: dw ? { holes: own(dw.holes), floor: dw.floor ? { vertexLocalY: own(dw.floor.vertexLocalY), floorQuadWater: own(dw.floor.floorQuadWater) } : null } : null,
      floors: g.floors,
    },
  };
}

/** The fields of two ground records that differ, by name ([] when they are the same ground). */
function groundDiff(held, live) {
  const out = [];
  const a = held.ground, b = live.ground;
  if (!sameBytes(held.tileMap, live.tileMap)) out.push('tileMap');
  if (held.winterArchive !== live.winterArchive) out.push('winterArchive');
  if (held.bare !== live.bare) out.push('bare');
  if (a._stride !== b._stride) out.push('stride');
  if (a.floors !== b.floors) out.push('floors');
  if (!sameBytes(a.samples, b.samples)) out.push('samples');
  if (!sameBytes(a.groundNormals, b.groundNormals)) out.push('groundNormals');
  if (!sameBytes(a._bed?.depths, b._bed?.depths)) out.push('bed');
  if (!sameBytes(a.deepWaters?.holes, b.deepWaters?.holes)) out.push('holes');
  if (!sameBytes(a.deepWaters?.floor?.vertexLocalY, b.deepWaters?.floor?.vertexLocalY)) out.push('floorY');
  if (!sameBytes(a.deepWaters?.floor?.floorQuadWater, b.deepWaters?.floor?.floorQuadWater)) out.push('floorWater');
  return out;
}

export class SnowBuildVerifier {
  /**
   * @param {object} o
   * @param {Uint8Array[]} o.masks - the live surface masks (compared with the worker's copy at each job)
   * @param {() => number} o.clock - milliseconds
   */
  constructor({ masks, clock }) {
    this.clock = clock;
    this.shadow = new SnowBuildKernel();
    this.liveMasks = masks;
    this.maskCopies = null;
    /** key -> the ground record the worker holds under it */
    this.held = new Map();
    /** job id -> { kind, reply, keys: shadow key -> client key, pixels } */
    this.expected = new Map();
    this.nextKey = SHADOW_KEYS_FROM;
    this.events = [];
    this.mismatchLog = [];
    this.counts = { posted: 0, compared: 0, mismatches: 0, letGo: 0, handedBack: 0, groundsReread: 0, masksChanged: 0 };
  }

  /** Something that changes what a build reads, or what becomes of one: kept to explain a mismatch after it. */
  event(what) {
    this.events.push({ at: Math.round(this.clock()), what });
    if (this.events.length > EVENTS_KEPT) this.events.shift();
  }

  /** A message on its way to the worker - before it is posted, while its transferred arrays are still here. `live` is
   *  the job's live grounds (client key -> SnowTerrain) and road tiles (in the context's order). */
  message(m, live) {
    switch (m.t) {
      case 'init':
        this.maskCopies = m.masks.map((a) => a.slice());
        this.shadow.handle({ t: 'init', masks: this.maskCopies.map((a) => a.slice()), settings: structuredClone(m.settings) });
        return;
      case 'settings':
        this.event('settings');
        this.shadow.handle(structuredClone(m));
        return;
      case 'offset':
        this.event(`floating origin moved (${m.offset.map((v) => v.toFixed(1)).join(', ')})`);
        this.shadow.handle(structuredClone(m));
        return;
      case 'tiles':
        for (const rec of m.tiles) this.held.set(rec.key, rec);
        return;
      case 'drop':
        for (const k of m.tiles ?? []) this.held.delete(k);
        if (m.tiles?.length || m.roads?.length) this.event(`unused copies let go on the worker: ${m.tiles?.length ?? 0} grounds, ${m.roads?.length ?? 0} roads`);
        return;
      case 'mid':
      case 'local':
        this._job(m, live);
        return;
      default:
        return;   // roads cross as they are needed; recycled buffers change no bytes
    }
  }

  /** The job rebuilt on the shadow from the live grounds and roads, its answer kept for the worker's. */
  _job(m, live) {
    this.counts.posted++;
    this.event(`posted ${m.t} #${m.id}`);
    if (this.maskCopies && this.liveMasks.some((a, i) => !sameBytes(a, this.maskCopies[i]))) {
      this.counts.masksChanged++;
      this.event('the live surface masks differ from the worker\'s copy');
    }
    const keys = new Map(), tiles = [], pixels = [];
    for (const [px, py, key, ox, oy, oz] of m.pixels) {
      const fresh = this.nextKey++;
      keys.set(fresh, key);
      tiles.push(groundRecord(fresh, live.tiles.get(key).snapshot()));
      pixels.push([px, py, fresh, ox, oy, oz]);
    }
    const roads = m.context.roads.map((r, i) => {
      const data = live.roads[i];
      const id = this.nextKey++;
      this.shadow.handle({ t: 'roads', id, roads: structuredClone({ mapX: data.mapX, mapY: data.mapY, tiles: data.tiles, kinds: data.kinds, roadTiles: data.roadTiles, pathTiles: data.pathTiles }) });
      return { ...r, id };
    });
    this.shadow.handle({ t: 'tiles', tiles });
    const job = structuredClone({ ...m, pixels, context: { ...m.context, roads } });
    const out = this.shadow.handle(job);
    this.shadow.handle({ t: 'drop', tiles: [...keys.keys()], roads: roads.map((r) => r.id) });
    this.expected.set(m.id, { kind: m.t, reply: out?.reply ?? null, keys, pixels: m.pixels, tilesLive: live.tiles });
  }

  /** The worker's answer, as it lands: compared with the shadow's build of the same job. */
  answer(m) {
    const e = this.expected.get(m.id);
    if (!e) return;
    this.expected.delete(m.id);
    this.counts.compared++;
    const diffs = this._diff(e, m);
    if (!diffs.length) return;
    this.counts.mismatches++;
    const stale = [];
    for (const [px, py, key] of e.pixels) {
      const held = this.held.get(key), t = e.tilesLive.get(key);
      if (!held || !t) continue;
      const fields = groundDiff(held, groundRecord(key, t.snapshot()));
      if (fields.length) stale.push(`(${px},${py}) ${fields.join('+')}`);
    }
    const record = { job: m.id, kind: e.kind, diffs, staleCopies: stale, before: this.events.slice(-8).map((v) => `${v.at}ms ${v.what}`) };
    this.mismatchLog.push(record);
    if (this.mismatchLog.length > MISMATCHES_KEPT) this.mismatchLog.shift();
    console.warn('[snowfall] verify: the worker\'s build differs from the main thread\'s', record);
  }

  _diff(e, m) {
    const want = e.reply;
    if (!want) return ['the shadow made no answer'];
    if (m.missing) return [`the worker lacked ground ${m.missing}`];
    if (!!want.ok !== !!m.ok) return [`ok: worker ${!!m.ok}, main thread ${!!want.ok}`];
    if (!!want.mirror !== !!m.mirror) return [`window refused: worker ${!!m.mirror}, main thread ${!!want.mirror}`];
    if (!m.ok) return [];
    const out = [];
    for (const k of Object.keys(want.arrays)) if (!sameBytes(want.arrays[k], m.arrays?.[k])) out.push(k);
    if (e.kind === 'mid') {
      const tiles = want.tiles.map((k) => e.keys.get(k));
      if (tiles.length !== m.tiles.length || tiles.some((k, i) => k !== m.tiles[i])) out.push('tiles');
    }
    return out;
  }

  /** What the client let go: a build out when the world was reset (a door, a load, a fast travel). */
  letGo(ids) {
    for (const id of ids) {
      this.counts.letGo++;
      this.event(`world reset with build #${id} out: let go`);
    }
  }

  /** An answer never taken, handed back to the worker (`why` says which path). */
  handedBack(id, why) {
    this.counts.handedBack++;
    this.event(`answer #${id} handed back (${why})`);
  }

  /** A pixel's ground the client copies again (its arrays are new). */
  groundReread(px, py) {
    this.counts.groundsReread++;
    this.event(`ground re-read at (${px},${py})`);
  }

  report() {
    return { ...this.counts, outstanding: this.expected.size, mismatchLog: this.mismatchLog.slice(), lastEvents: this.events.slice(-8) };
  }
}

