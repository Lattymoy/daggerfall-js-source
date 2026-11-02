// SNOW-THREAD (2026-10-26): the snow's builds on the build worker. The two progressive builds that sample the ground -
// the local window's recentre and the middle ring's rebuild (systems/snowfallRuntime.js) - run here, whole, over a copy
// of the ground they read; the main thread keeps the rest and takes the finished arrays (snowBuildClient.js).
// One code path: a SnowfallRuntime whose commits are the build's halves alone, driven with no frame budget over a
// SnowWorld made of snapshots - snowGroundLaw.js's laws over copied arrays, the streaming frame and the origins at the
// post, and the context the main thread prepared. The bytes equal the main thread's (test/systems/snowthread.test.js).
// The ring copies from the worker's own last ring (AUDIT ENVIRONS P3); the window's recentre copies the window the main
// thread holds, so it is handed that window unless it is the worker's last one (`mirror`).

import { SnowfallRuntime } from '../snowfallRuntime.js';
import { SnowCoverage, BasicRoadsTerrain } from '../snowfall.js';
import {
  snowGroundHeight,
  snowGroundNormal,
  snowGroundBare,
  snowPixelX,
  snowPixelY,
  snowGlobalOf,
} from './snowGroundLaw.js';
import { worldPixelKey, inWorldGrid } from '../../world/worldWide/worldGrid.js'; // BAY-LEFT-GROUND: the main thread's pixel key (scenes/snowGround.js pixelOn)

/** The runtime's builds alone: a commit is the build's own half - the tracks' half is the main thread's. */
class SnowBuildRuntime extends SnowfallRuntime {
  _midCommit() {
    this._midFinish();
    this.mid.building = false;
    this.mid.completed++;
  }
  _commitRecenter() {
    this._localFinish();
    this.local.recentering = false;
    this.local.committed = true;
  }
}

/** The arrays a finished build hands back, by the runtime's names. */
export const MID_ARRAYS = Object.freeze([
  'pos',
  'nrm',
  'ctxA',
  'ctxB',
  'ctxC',
  'heights',
  'bnrm',
  'statics',
  'context',
  'meshTile',
  'statTile',
]);
export const LOCAL_ARRAYS = Object.freeze(['pos', 'nrm', 'statics', 'context']);
/** The spent arrays kept a size, to copy the next answers into. */
const POOL_PER_SIZE = 4;

/** A pixel's SnowTerrain over its snapshot (snowBuildClient.js `_tile`): its origin is set by each job. */
function terrainOf(rec) {
  const g = rec.ground;
  const t = {
    key: rec.key,
    mapX: rec.mapX,
    mapY: rec.mapY,
    size: rec.size,
    tileMap: rec.tileMap,
    winterArchive: rec.winterArchive,
    roads: null,
    _o: [0, 0, 0],
    origin: (out) => {
      out[0] = t._o[0];
      out[1] = t._o[1];
      out[2] = t._o[2];
      return out;
    },
    height: (lx, lz) => snowGroundHeight(g, g.floors, lx, lz),
    normal: (lx, lz, out) => snowGroundNormal(g, lx, lz, out),
    bare: rec.bare === 'all' ? () => true : rec.bare === 'ground' ? (lx, lz) => snowGroundBare(g, lx, lz) : undefined,
  };
  return t;
}

export class SnowBuildKernel {
  constructor() {
    this.rt = null;
    /** key -> SnowTerrain */
    this.tiles = new Map();
    /** id -> BasicRoadsTerrain */
    this.roads = new Map();
    /** byteLength -> ArrayBuffer[] */
    this.pool = new Map();
    this.frame = [0, 0, 0, 0, 1];
    /** worldPixelKey -> SnowTerrain, this job's */
    this.pixels = new Map();
    /** the job whose window the runtime's local arrays are (0: none) */
    this.localDone = 0;
    const g = [0, 0];
    this.world = {
      terrainAt: (x, z) => {
        const f = this.frame;
        const px = snowPixelX(f[0], f[2], f[4], x);
        const py = snowPixelY(f[1], f[3], f[4], z);
        return inWorldGrid(px, py) ? (this.pixels.get(worldPixelKey(px, py)) ?? null) : null;
      },
      toGlobal: (x, z) => {
        const f = this.frame;
        return snowGlobalOf(f[0], f[1], f[2], f[3], f[4], x, z, g);
      },
      footprints: () => [],
    };
  }

  /** One message from the main thread: answers `{ reply, transfer }` for a build, nothing for the rest. */
  handle(m) {
    switch (m.t) {
      case 'init':
        this.rt = new SnowBuildRuntime({
          world: this.world,
          coverage: new SnowCoverage(m.masks),
          settings: m.settings,
          frameBudgetMs: Infinity,
        });
        return null;
      case 'settings':
        this._settings(m.settings);
        return null;
      case 'tiles':
        for (const rec of m.tiles) this.tiles.set(rec.key, terrainOf(rec));
        return null;
      case 'roads':
        this.roads.set(m.id, Object.setPrototypeOf(m.roads, BasicRoadsTerrain.prototype));
        return null;
      case 'drop':
        for (const k of m.tiles ?? []) this.tiles.delete(k);
        for (const id of m.roads ?? []) this.roads.delete(id);
        return null;
      case 'offset':
        this.rt.offsetOrigin(m.offset);
        return null;
      case 'recycle':
        for (const b of m.buffers) this._keep(b);
        return null;
      case 'mid':
        return this._mid(m);
      case 'local':
        return this._local(m);
      default:
        return null;
    }
  }

  /** The settings the main thread runs: a window of another size is made again (the main thread's _rebuildGrid). */
  _settings(s) {
    const rt = this.rt,
      was = rt.settings;
    rt.settings = s;
    if (
      s.snowRadius !== was.snowRadius ||
      s.meshResolution !== was.meshResolution ||
      s.maskResolution !== was.maskResolution
    ) {
      rt._rebuildGrid();
      this.localDone = 0;
    }
  }

  /** The job's world: its frame, and each pixel it may read with its origin now. Answers a key it does not hold. */
  _stand(m) {
    this.frame = m.frame;
    this.pixels.clear();
    for (const [px, py, key, ox, oy, oz] of m.pixels) {
      const t = this.tiles.get(key);
      if (!t) return key;
      t._o[0] = ox;
      t._o[1] = oy;
      t._o[2] = oz;
      this.pixels.set(worldPixelKey(px, py), t);
    }
    return 0;
  }

  /** The context the main thread prepared (SnowContext.prepare), its roads this thread's. False for a road not held. */
  _context(c, d) {
    const roads = [];
    for (const r of d.roads) {
      const data = this.roads.get(r.id);
      if (!data) return false;
      roads.push({ data, x: r.x, z: r.z, tileMetres: r.tileMetres, archive: r.archive, mapX: r.mapX, mapY: r.mapY });
    }
    c.roads = roads;
    c.settlements = d.settlements;
    c.locations = d.locations;
    c.settings = this.rt.settings;
    c.settlementFeather = d.settlementFeather;
    c.locationFeather = d.locationFeather;
    return true;
  }

  /** The middle ring round `m.center` (_midStart, then _midProcess until it stands or a pixel is missing). */
  _mid(m) {
    const rt = this.rt,
      M = rt.mid;
    const missing = this._stand(m);
    if (missing || !this._context(M.context0, m.context)) return { reply: { t: 'mid', id: m.id, ok: false, missing } };
    M.buildCenter = [m.center[0], m.center[1]];
    const before = M.completed;
    rt._midStart();
    const f = { now: 0 };
    while (M.building) rt._midProcess(M.buildCenter, f);
    if (M.completed === before) return { reply: { t: 'mid', id: m.id, ok: false } }; // a pixel not loaded: _midFail's
    const { arrays, transfer } = this._answer(M, MID_ARRAYS);
    return { reply: { t: 'mid', id: m.id, ok: true, arrays, tiles: M.tiles.map((t) => t.key) }, transfer };
  }

  /** The local window's recentre the main thread began (_beginRecenter), run until it commits or a pixel is missing. */
  _local(m) {
    const rt = this.rt;
    let L = rt.local;
    if (L.res !== m.res || L.sres !== m.sres) {
      rt._rebuildGrid();
      this.localDone = 0;
      L = rt.local;
    }
    const missing = this._stand(m);
    if (missing || !this._context(rt.context, m.context))
      return { reply: { t: 'local', id: m.id, ok: false, missing } };
    if (m.arrays) {
      L.pos.set(m.arrays.pos);
      L.nrm.set(m.arrays.nrm);
      L.statics.set(m.arrays.statics);
      L.context.set(m.arrays.context);
    } else if (!m.full && m.mirror !== this.localDone)
      return { reply: { t: 'local', id: m.id, ok: false, mirror: true } };
    L.center = [m.center[0], m.center[1]];
    L.nextCenter = [m.nextCenter[0], m.nextCenter[1]];
    L.nextDyn = [m.nextDyn[0], m.nextDyn[1]];
    L.nextStat = [m.nextStat[0], m.nextStat[1]];
    L.meshDelta = [m.meshDelta[0], m.meshDelta[1]];
    L.statDelta = [m.statDelta[0], m.statDelta[1]];
    L.fullRebuild = m.full;
    L.baseY = m.baseY;
    L.outrun = true; // no frame to stop for here
    L.meshCursor = 0;
    L.statCursor = 0;
    L.recentering = true;
    L.committed = false;
    const f = { now: 0 };
    while (L.recentering) rt._processRecenter(m.player[0], m.player[1], f);
    if (!L.committed) {
      // a pixel not loaded: _cancelForRetry's - the runtime's window is still the last one committed
      return { reply: { t: 'local', id: m.id, ok: false } };
    }
    this.localDone = m.id;
    const { arrays, transfer } = this._answer(L, LOCAL_ARRAYS);
    return { reply: { t: 'local', id: m.id, ok: true, arrays }, transfer };
  }

  /** Copies of a build's committed arrays, into spent buffers where there are some - the runtime keeps its own. */
  _answer(o, names) {
    const arrays = {},
      transfer = [];
    for (const k of names) {
      const a = o[k];
      const free = this.pool.get(a.byteLength);
      const out = new a.constructor(free?.pop() ?? new ArrayBuffer(a.byteLength));
      out.set(a);
      arrays[k] = out;
      transfer.push(out.buffer);
    }
    return { arrays, transfer };
  }

  _keep(buffer) {
    if (!buffer?.byteLength) return;
    let list = this.pool.get(buffer.byteLength);
    if (!list) this.pool.set(buffer.byteLength, (list = []));
    if (list.length < POOL_PER_SIZE) list.push(buffer);
  }
}
