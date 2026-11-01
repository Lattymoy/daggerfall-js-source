// ═══════════════════════════════════════════════════════════════════
// EV7 — TERRAIN GENERATION, OFF THE MAIN THREAD. buildPixel's kernel
// (terrainGen.js - the ~84,000 perlin calls per pixel) runs in a
// module Worker so the frame keeps painting while a map-pixel
// crossing streams its up-to-13 new pixels in; the browser could not
// paint through the old single-task build, so a healthy crossing read
// as a stutter.
//
// The shape is the RA1 road-bake client's, recovered law for law:
//  - `new Worker(new URL(...))` stays in exactly that spelling
//    (eslint.config.js's own note: Vite's static analysis matches the
//    bare constructor to bundle the worker entry).
//  - The factory is split out and injectable so node never evaluates
//    `new Worker` and tests drive a hand-rolled fake.
//  - The WOODS bytes are COPIED to the worker, never transferred -
//    the reader's own buffer is what heightAt, the ghost rows and the
//    travel map keep reading for the rest of the session, and a
//    transfer would detach it.
//  - THE FALLBACK IS THE OLD PATH, NOT A FAILURE: no Worker (node, a
//    test, an ancient host), a factory that throws, a worker that
//    dies mid-job, or ?terrainthread=off all run the same kernel on
//    this thread - every law lives in modules this thread already
//    holds, so the fallback costs the stall and nothing else.
//  - A FIFO, not a single slot: pump() serializes the streaming
//    queue, but the teleport core builds its destination pixel
//    directly and can overlap a pump build mid-flight.
// ═══════════════════════════════════════════════════════════════════

import { unpackNature } from './natureWire.js';   // AUDIT BANTHA1 PERF-2
import { setTamrielTrace } from '../tamriel/tamrielLand.js';   // TAMRIEL3: the trace, for the fallback kernel
import { setTamrielFit } from '../tamriel/tamrielFrame.js';
import { dropGroundCache } from '../tamriel/tamrielGround.js';
import { gen2Install, gen2Shipped } from '../gen2/gen2Ground.js';   // The published regions, on both threads
import { generatePixelTerrain, restrideGrid } from './terrainGen.js';   // PERF-EXT26: and the promotion's grid, on either thread
import { buildRoadsFromSettlements } from '../roadsProducer.js';   // AUDIT ROADS F2
import { packArenaRoads, mergeArenaRoads, arenaRoadsLayer, setArenaRoads as installArenaRoads } from '../arenaRoads.js';   // TESA4/TESA14: the roads past the Bay
import { midRingSide, farFieldSide } from './midRingGrid.js';   // MID-RING / FAR-FIELD: a ground's bands
import { setWatersInk, lawWatersInk } from '../tamriel/watersInk.js';   // MAP-WATERS: the held map's copy of the waters

/** MID-RING / FAR-FIELD: how many of a ground's rows a worker answers at a time - the stream's own jobs run between bands
 *  (a band is one message; the next is posted when it lands), so no pixel waits behind a whole horizon. */
export const HORIZON_BAND_ROWS = { mid: 4, far: 16 };
/** FAR-TREES: the band's pixels an ask (some 40 ms of the worker's a pixel: a stream job waits a band's ask at most). */
export const BAND_PIXELS_AN_ASK = 4;

/** The escape hatch, read once at scene build (the ?cull=off shape). */
export function terrainThreadDisabled(search = globalThis.location?.search) {
  try { return /[?&]terrainthread=off\b/.test(search ?? ''); }
  catch { return false; }
}

/** The one place the worker URL is spelled. Split out so tests can
 *  inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./terrainGenWorker.js', import.meta.url), { type: 'module' });
}

export class TerrainGenClient {
  /**
   * @param {object} deps
   * @param {object} deps.woods - the MAIN thread's WoodsFile (the
   *   fallback kernel runs over it; never handed to the worker).
   * @param {Uint8Array} [deps.woodsBytes] - the raw WOODS.WLD bytes;
   *   a COPY crosses to the worker once. Absent = same-thread only.
   * @param {?Function} [deps.workerFactory] - test seam.
   */
  constructor({ woods, woodsBytes = null, workerFactory = null } = {}) {
    this._woods = woods;
    this._tamriel = !!woods?.isTamrielGround;   // TAMRIEL2: the host's reader has the continent round it (world/tamriel/tamrielGround.js groundWoods) - the worker composes its own copy the same way
    this._ether = !!woods?.isEtherGround;   // ETHER-SEA: ...and the Eltheric Ocean (world/ethericSea.js etherWoods), composed there the same way
    this._sites = null;   // LANDFORM4: setLandformTables
    this._climates = null;   // LANDFORM6: setLandformTables
    this._beyond = null;   // BAY-LEFT-GROUND: setLandformBeyond
    this._worker = null;
    this._fifo = [];   // {job, resolve} - the worker answers in arrival order
    this._grids = new Map();   // PERF-EXT26: id -> {job, resolve}, the promotions out on the worker
    this._gridId = 0;
    this._mids = new Map();   // MID-RING: id -> resolve, the middle rings out on the worker
    this._arenaAsks = 0;
    /** TESA4: the epoch a job posted now is built under, and the one this thread holds the layer of. */
    this.arenaRoadsEpoch = 0;
    this.arenaRoadsLanded = 0;
    /** FLORA-GROUND: how many times the ground's inputs have moved - the network, the landforms' tables, the sites past
     *  the Bay, the continent's trace and its relief (each a message the worker drops its kept grounds on). A layer laid
     *  on the ground off the stream (the far trees' band, the middle ring under it) is laid again when it moves, so a
     *  tree never stands on a ground the walker's no longer is. */
    this.groundEpoch = 0;
    const factory = workerFactory
      ?? ((terrainThreadDisabled() || typeof Worker === 'undefined' || !woodsBytes)
        ? null : defaultWorkerFactory);
    if (!factory) return;
    let w = null;
    try {
      w = factory();
      w.onerror = (e) => this._down(e?.message ?? 'terrain worker failed');
      w.onmessage = (ev) => {
        const m = ev.data ?? {};
        if (m.t === 'roads') {
          // ROADS 7: the arrays come back for the map (and, as it happens,
          // for the fallback - the lazy build stands down when they do).
          // AUDIT 58 F3 (R1): this is the FOURTH rebuild of the network
          // object, and the one on the OURS path - the worker posts `net`
          // back only from the settlements arm (terrainGenWorker.js's
          // `back`, a deliberate two-field slice, for the map). It took
          // the two fields and dropped the switches, and once it has run
          // `_roadsFallback()` early-returns, so the one rebuild that
          // carries them could never re-establish them: a same-thread
          // build after a worker job error or a worker death then ran
          // `smoothRoadHeights` with SmoothRoads off. The switches come
          // from `_switches` - the same object the worker is running, and
          // the shape terrainGenWorker.js and _roadsFallback() both use.
          if (m.net) this._roads = { roads: m.net.roads, tracks: m.net.tracks, ...(this._switches ?? {}), source: this._roadsSource ?? 'generated' };   // TO1: whose network this is
          else if (!this._roads) this._settlements = null;   // AUDIT 68 S22: the build answered no network - it is not a known one (hasRoads)
          if (m.stats && this._roadsStats) this._roadsStats(m.stats);
          return;
        }
        if (m.t === 'grid' || m.t === 'gridError') { this._gridAnswer(m); return; }   // PERF-EXT26: by id, never through the FIFO
        if (m.t === 'mid' || m.t === 'midError' || m.t === 'far' || m.t === 'farError' || m.t === 'band' || m.t === 'bandError') { this._midAnswer(m); return; }   // MID-RING, FAR-FIELD: by id too; FAR-TREES: and the band's
        if (m.t === 'watersInk') { setWatersInk(m.ink ?? null); return; }   // MAP-WATERS: the held map's rivers and lakes landed
        this._answer(m);
      };
      // a COPY - transferring the reader's own bytes would detach the
      // buffer the rest of the session still reads (the RA1 law)
      const bytes = woodsBytes.slice();
      w.postMessage({ t: 'init', woodsBytes: bytes, tamriel: this._tamriel, ether: this._ether }, [bytes.buffer]);   // TAMRIEL2: the worker composes its own reader the same way (ETHER-SEA: the Eltheric Ocean's too)
      this._worker = w;
    } catch (e) {
      console.warn('[terrain] worker unavailable; generating on the main thread', e);
      // AUDIT EV F-SIM4: a factory that SPAWNED but whose init post
      // threw would otherwise strand a live idle worker for the page
      try { w?.terminate?.(); } catch { /* never spawned or already gone */ }
      this._worker = null;
    }
  }

  /** The kernel's answer, produced off this thread when a worker is
   *  up and on it when one is not. The job's tilemap is CLONED to the
   *  worker (16 KB - and the original must survive for the fallback a
   *  dying worker falls back to); the reply's big arrays arrive
   *  TRANSFERRED. Always resolves - a worker failure resolves through
   *  the same-thread kernel, never rejects. */
  /** ROADS 3: hand the network to both kernels - the worker gets a
   *  COPY (the RA1 law: the arrays this thread keeps are the fallback's)
   *  and this thread keeps its own for the same-thread path. null
   *  clears both. */
  setRoads(settlements, onStats = null, switches = null) {   // ROADS 24: the mod's switches ride the fallback too
    // AUDIT ROADS F2: the worker BUILDS from the list with its own woods;
    // this thread builds only if it has to - lazily, on the fallback
    // path, from the list it kept. A build is never paid twice and never
    // paid on the frame while a worker is up.
    this._settlements = settlements ?? null;
    this._roads = null;
    this._roadsStats = onStats;
    this._switches = switches;
    this._roadsSource = 'generated';   // TO1: the port's own network, not Hazelnut's
    this.groundEpoch++;   // FLORA-GROUND: our roads cut the shaped ground
    if (this._worker && this._settlements) this._worker.postMessage({ t: 'roads', settlements: this._settlements, switches });
    else if (!this._worker) this._roadsFallback();
  }

  /** LANDFORM4/6: the landforms' tables - the game's own locations they pull the ground to and the world's climates
   *  whose lands they stand (world/landforms.js landformSites, landformClimates) - kept here for the same-thread kernel,
   *  COPIES posted to the worker (the RA1 law). Handed once as the world mounts, before its first job, so no pixel is
   *  ever cut without them; null clears either. */
  /** The picture's own land and the Bay's fit on it (world/tamriel/tamrielLand.js, world/tamriel/tamrielFrame.js) - set
   *  HERE for the fallback kernel (the modules' own state) and posted to the worker, which sets its own copies the
   *  same way; the ground's cache dropped on both. `trace` null puts the authored shape back. `wg2`: the published
   *  regions' bakes (world/gen2/gen2Ground.js), installed on both. */
  setTamriel({ trace = null, fit = null, wg2 = [] } = {}) {
    setTamrielTrace(trace);
    setTamrielFit(fit);
    gen2Install(wg2, fit);   // The published regions' bakes, read against this fit
    dropGroundCache();
    this.groundEpoch++;   // FLORA-GROUND: the continent's ground, its relief with it
    if (!this._worker) { setWatersInk(lawWatersInk().ink); return; }   // MAP-WATERS: no worker, this thread's own law
    const t = trace ? { w: trace.w, h: trace.h, land: trace.land.slice(), province: trace.province.slice(), relief: trace.relief ? trace.relief.slice() : null } : null;   // TAMRIEL-RELIEF: the heightmap's cells with it
    this._worker.postMessage({ t: 'tamriel', trace: t, fit: fit ? { ox: fit.ox, oy: fit.oy, ppu: fit.ppu } : null, wg2: gen2Shipped() }, t ? [t.land.buffer, t.province.buffer, ...(t.relief ? [t.relief.buffer] : [])] : []);
    this._worker.postMessage({ t: 'waters' });   // MAP-WATERS: the map's copy of the waters, compiled there (answered 'watersInk')
  }

  /**
   * TESA14: THE ROADS PAST THE BAY (world/tamrielRoads.js), a region at a time, for both kernels and this thread's verge:
   * `add` (a region's layer, or the crossings' joins - world/arenaRoads.js) merged into the one installed; `reset` drops
   * that first (a new mount, a new build). Each add is an EPOCH: every job posted from its post on is built with the
   * layer as it then stands (`arenaRoadsEpoch` - the host stamps it on the pixel it posts; the worker takes its messages
   * in order), this thread's layer merged at once (`arenaRoadsLanded`) and `onLanded(epoch, add, reset)` told. With no
   * worker this thread's layer is every kernel's. Answers the epoch.
   * @param {?{ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> }} add
   * @param {?Function} [onLanded] @param {{ reset?: boolean }} [o]
   */
  addArenaRoads(add, onLanded = null, { reset = false } = {}) {
    const epoch = ++this._arenaAsks;
    this.arenaRoadsEpoch = epoch;
    const layer = reset || !arenaRoadsLayer() ? { roads: new Map(), tracks: new Map(), join: new Map() } : arenaRoadsLayer();
    if (add) mergeArenaRoads(layer, add);
    installArenaRoads(layer, reset ? null : add);   // TESA15: a region's add moves only the ink tiles it reaches
    if (this._worker) {
      const packed = add ? packArenaRoads(add) : null;
      this._worker.postMessage({ t: 'arena-roads', epoch, reset, layer: packed }, packed ? [packed.keys.buffer, packed.roads.buffer, packed.tracks.buffer, packed.joinKeys.buffer, packed.join.buffer] : []);
    }
    this.arenaRoadsLanded = epoch;
    onLanded?.(epoch, add, reset);
    return epoch;
  }

  setLandformTables({ sites = null, climates = null } = {}) {
    this._sites = sites;
    this._climates = climates;
    this.groundEpoch++;   // FLORA-GROUND: the sites and the lands the ground is shaped by
    if (!this._worker) return;
    const s = sites ? sites.slice() : null, c = climates ? climates.slice() : null;
    this._worker.postMessage({ t: 'landform-tables', sites: s, climates: c }, [s, c].filter(Boolean).map((a) => a.buffer));
  }

  /** BAY-LEFT-GROUND (bible/03-World/Landforms.md "BAY-LEFT-GROUND"): THE SITES PAST THE BAY (world/landforms.js
   *  landformSitesBeyond - the places past the Bay every client stands alike, by the world's key) - kept here for the
   *  same-thread kernel, a copy posted to the worker, which takes it before any job posted after it (its messages in
   *  order). Made again whenever the places past the Bay move (scenes/landformSitesHost.js); null clears it. */
  setLandformBeyond(beyond = null) {
    this._beyond = beyond;
    this.groundEpoch++;   // FLORA-GROUND: the sites past the Bay
    if (this._worker) this._worker.postMessage({ t: 'landform-beyond', beyond });
  }

  /** ROADS 7: the network for whoever draws it - null until built. */
  roads() { return this._roads; }

  /** ROADS 22: a ready-made network (his) - kept here for the map and
   *  the fallback, a copy posted to the worker. No build anywhere. */
  /** ROADS 25: whether a network is known to this client - set the
   *  moment setRoads/setRoadsData is called, before the worker has it. */
  get hasRoads() { return !!this._roads || !!this._settlements; }

  setRoadsData(net, onStats = null) {
    this._settlements = null;
    // BR3: the switches ride HERE too. setRoads kept them in `_switches`
    // and this did not, so the three rebuilds that read `_switches` (the
    // worker's net-back arm and _roadsFallback) would have rebuilt his
    // network with the switches dropped - the AUDIT 58 F3 defect exactly,
    // in the one place that fix did not reach. Inert today only because
    // `_roads` below is set inline and _roadsFallback early-returns on it.
    this._switches = { water: !!net.water, smooth: net.smooth !== false };
    // AUDIT 58 F3: `smooth` rides his data too. It was dropped by all three
    // rebuilds of the network object below while `water` survived them, so the
    // Mods pane's SmoothRoads switch reached the kernel only on the fallback
    // path and read `undefined` - i.e. ON - on the path the game takes.
    // `!== false` keeps the kernel's default-on gate for a caller that omits it.
    // TO1: WHOSE NETWORK THIS IS, on the object itself. The port draws
    // roads either way - Hazelnut's vendored arrays when Basic Roads is
    // on, its OWN generated network when it is off or his files cannot
    // be read (bible/03-World/Roads.md, the deliberate inversion) - and
    // until now nothing the network was handed to could tell the two
    // apart. Travel Options must: path FOLLOWING is his mod's feature,
    // gated on his mod being enabled, and a follower that walked the
    // port's generated tracks would be offering a feature the player
    // never switched on. `source` is set at all THREE assembly sites and
    // in the worker's own, which is the AUDIT 58 F3 / BR3 lesson: a
    // field added to one of them is silently inert on the path the game
    // actually takes.
    this._roadsSource = net.source ?? 'basic-roads';
    this.groundEpoch++;   // FLORA-GROUND: his roads cut the shaped ground
    this._roads = { roads: net.roads, tracks: net.tracks, rivers: net.rivers ?? null, streams: net.streams ?? null, water: !!net.water, smooth: net.smooth !== false, source: this._roadsSource };
    this._roadsStats = onStats;
    if (this._worker) {
      const copy = { roads: net.roads.slice(), tracks: net.tracks.slice(), rivers: net.rivers ? net.rivers.slice() : null, streams: net.streams ? net.streams.slice() : null, water: !!net.water, smooth: net.smooth !== false };
      const xfer = [copy.roads.buffer, copy.tracks.buffer]; if (copy.rivers) xfer.push(copy.rivers.buffer); if (copy.streams) xfer.push(copy.streams.buffer);
      this._worker.postMessage({ t: 'roads', net: copy, stats: net.stats ?? null }, xfer);
    } else if (onStats) onStats(net.stats ?? { source: 'basic-roads' });
  }

  _roadsFallback() {
    if (this._roads || !this._settlements) return;
    const net = buildRoadsFromSettlements(this._settlements, this._woods);
    this._roads = net ? { roads: net.roads, tracks: net.tracks, ...(this._switches ?? {}), source: this._roadsSource ?? 'generated' } : null;   // TO1
    if (!net) this._settlements = null;   // AUDIT 68 S22: a failed build is not a known network, and is not paid again on every job
    if (net && this._roadsStats) this._roadsStats(net.stats);
  }

  generate(job) {
    if (!this._worker) {
      this._roadsFallback();
      return Promise.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...job }));
    }
    return new Promise((resolve) => {
      this._fifo.push({ job, resolve });
      this._worker.postMessage({ t: 'job', ...job });
    });
  }

  /** PERF-EXT26: whether a job runs off this thread. The world host
   *  sends STREAM1's promotions here only when it does; otherwise it keeps
   *  its one-a-frame queue (no Worker, `?terrainthread=off`, a dead one). */
  get threaded() { return !!this._worker; }

  /**
   * PERF-EXT26 (2026-09-25, the players: "fps issues in the exterior but
   * fine in the interior", "me too my friend.. don't know why. I got a
   * RX6600"): a built pixel's grid at `stride` (terrainGen.js
   * restrideGrid), off this thread when a worker is up. The samples are
   * CLONED to it - the pixel keeps its own, for the grass, the ground
   * under the feet and a fallback. Always resolves: a worker failure or
   * death builds that grid here instead.
   * @param {{ px: number, py: number, stride: number, samples: Float32Array, bed?: ?Uint8Array }} job
   * @returns {Promise<{ positions: Float32Array, normals: Float32Array, bed: ?object }>}
   */
  grid(job) {
    if (!this._worker) return Promise.resolve(restrideGrid({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...job }));   // LANDFORM1-3: the fallback's own network
    const id = ++this._gridId;
    return new Promise((resolve) => {
      this._grids.set(id, { job, resolve });
      this._worker.postMessage({ t: 'grid', id, ...job });
    });
  }

  /**
   * MID-RING (render/midRing.js): the middle ring's heights round {baseX, baseY} (world/terrain/midRingGrid.js
   * buildMidRingHeights), ON THE WORKER ALONE - a ring is some 100 ms of kernel, and with no worker (node, a test,
   * `?terrainthread=off`, a dead one) there is no middle ring: null, and the far ring stands as it always did. Never on
   * this thread, never a reject.
   * @param {{ baseX: number, baseY: number, radius: number, sub: number, landform?: boolean, flora?: boolean, lands?: boolean }} job
   * @returns {Promise<?{ heights: Float32Array, wet?: ?Uint8Array, flora?: ?Uint32Array, cover?: ?Uint8Array }>}
   */
  midRing(job) {
    if (!this._worker) return Promise.resolve(null);
    const n = 2 * job.radius + 1, side = midRingSide(job.radius, job.sub), heights = new Float32Array(side * side);
    let wet = null;   // MAP-WATERS: stream G's rivers and lakes in the ring, where a band had any
    let flora = null;   // FAR-FLORA: the near law's woods at each sample (world/terrain/floraCover.js), where the job asks them
    let cover = null;   // TESA-LANDS: the forest field's own value at each sample, with the lands' row
    return this._bands('midring', job, n, HORIZON_BAND_ROWS.mid, (m, pj0, pj1) => {
      if (!m?.heights) return false;
      heights.set(m.heights, pj0 * job.sub * side);
      if (m.wet) (wet ??= new Uint8Array(side * side)).set(m.wet, pj0 * job.sub * side);
      if (m.flora) (flora ??= new Uint32Array(side * side)).set(m.flora, pj0 * job.sub * side);
      if (m.cover) (cover ??= new Uint8Array(side * side)).set(m.cover, pj0 * job.sub * side);
      return pj1 === n ? { heights, wet, flora, cover } : true;
    });
  }

  /**
   * FAR-TREES (render/farTrees.js): the band's trees for `job.pixels` ([px, py, nature archive, climate type] four a pixel)
   * - ON THE WORKER ALONE, BAND_PIXELS_AN_ASK pixels an ask (the next posted as the last lands, so the stream's own jobs run
   * between them): an array of each pixel's `[x, y, z, record]` trees, in order; null with no worker or on an error.
   * TESA-LANDS: `lands` the row - a zone's own trees past the Bay (world/terrain/floraCover.js bandTreesPixel).
   * @param {{ pixels: Int32Array, forests: boolean, landform: boolean, lands?: boolean }} job
   * @returns {Promise<?Float32Array[]>}
   */
  floraBand(job) {
    if (!this._worker) return Promise.resolve(null);
    const n = job.pixels.length / 4, out = [];
    const ask = (p0) => new Promise((resolve) => {
      if (!this._worker) { resolve(null); return; }
      const id = ++this._gridId;
      this._mids.set(id, resolve);
      this._worker.postMessage({ t: 'floraband', id, forests: job.forests, landform: job.landform, lands: !!job.lands, pixels: job.pixels.slice(p0 * 4, Math.min(n, p0 + BAND_PIXELS_AN_ASK) * 4) });
    });
    const next = (p0) => (p0 >= n ? Promise.resolve(out) : ask(p0).then((m) => {
      if (!m?.trees) return null;
      out.push(...m.trees);
      return next(p0 + BAND_PIXELS_AN_ASK);
    }));
    return next(0);
  }

  /** MID-RING / FAR-FIELD: a ground asked a band of `rows` at a time, the next band posted when the last lands; `take`
   *  keeps each answer (false: a band failed, the ground is null) and answers the ground at the last. */
  _bands(t, job, total, rows, take) {
    const ask = (r0) => new Promise((resolve) => {
      if (!this._worker) { resolve(null); return; }
      const id = ++this._gridId;
      this._mids.set(id, resolve);
      this._worker.postMessage({ t, id, ...job, rows: [r0, Math.min(total, r0 + rows)] });
    });
    const next = (r0) => ask(r0).then((m) => {
      const r1 = Math.min(total, r0 + rows), kept = take(m, r0, r1);
      return kept === false ? null : kept === true ? next(r1) : kept;
    });
    return next(0);
  }

  /**
   * FAR-FIELD (render/farField.js): the far field's cells round {baseCX, baseCY} (world/terrain/midRingGrid.js
   * buildFarFieldBytes) - on the worker alone, as the middle ring: null with none, and the far ring closes into the sky.
   * RELIEF-PEAKS: `relief` (the Landforms row) and each cell's vertex's ground (`ground`, world units).
   * @param {{ baseCX: number, baseCY: number, radius: number, cell: number, seaByte: number, relief?: boolean }} job
   * @returns {Promise<?{ high: Uint8Array, low: Uint8Array, clim: Uint8Array, ground: Float32Array }>}
   */
  farField(job) {
    if (!this._worker) return Promise.resolve(null);
    const side = farFieldSide(job.radius), high = new Uint8Array(side * side), low = new Uint8Array(side * side), clim = new Uint8Array(side * side), ground = new Float32Array(side * side);
    return this._bands('farfield', job, side, HORIZON_BAND_ROWS.far, (m, j0, j1) => {
      if (!m?.high) return false;
      high.set(m.high, j0 * side); low.set(m.low, j0 * side); clim.set(m.clim, j0 * side); ground.set(m.ground, j0 * side);
      return j1 === side ? { high, low, clim, ground } : true;
    });
  }

  _midAnswer(m) {
    const resolve = this._mids.get(m.id);
    if (!resolve) return;
    this._mids.delete(m.id);
    if (m.t === 'midError' || m.t === 'farError' || m.t === 'bandError') console.warn('[terrain] worker horizon failed -', m.message);
    resolve(m.t === 'band' ? { trees: m.trees } : m.t === 'mid' ? { heights: m.heights, wet: m.wet ?? null, flora: m.flora ?? null, cover: m.cover ?? null } : m.t === 'far' ? { high: m.high, low: m.low, clim: m.clim, ground: m.ground } : null);
  }

  _gridAnswer(m) {
    const g = this._grids.get(m.id);
    if (!g) return;
    this._grids.delete(m.id);
    if (m.t === 'gridError') {
      console.warn('[terrain] worker grid failed; building it on the main thread -', m.message);
      g.resolve(restrideGrid({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...g.job }));
      return;
    }
    g.resolve({ positions: m.positions, normals: m.normals, bed: m.bed ?? null });   // AUDIT WATER-NEXT P1: the bed the worker carved
  }

  _answer(m) {
    if (m.t !== 'done' && m.t !== 'error') return;
    const p = this._fifo.shift();
    if (!p) return;
    if (m.t === 'error') {
      // this job's inputs are still whole on this side - run them here
      console.warn('[terrain] worker job failed; generating on the main thread -', m.message);
      this._roadsFallback();   // AUDIT ROADS F2: a one-off same-thread job still wants its roads
      p.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...p.job }));
      return;
    }
    // The reply crosses WHOLE, like the job: the envelope tag comes
    // off and the rest of the kernel's result passes through untouched,
    // so a new generatePixelTerrain output can never be dropped on the
    // worker path alone - the fallback arms resolve the whole object,
    // and node always takes the fallback.
    const { t: _tag, ...out } = m;
    out.nature = unpackNature(out.nature);   // AUDIT BANTHA1 PERF-2: the flats again, from the columns the worker transferred
    p.resolve(out);
  }

  _down(message) {
    console.warn('[terrain] worker died; generating on the main thread -', message);
    const pending = this._fifo;
    this._fifo = [];
    try { this._worker?.terminate?.(); } catch { /* already gone */ }
    this._worker = null;
    this._roadsFallback();   // AUDIT ROADS F2: the worker took its network down with it (TESA14: the roads past the Bay are this thread's already)
    for (const p of pending) p.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...p.job }));
    // PERF-EXT26: and the promotions it held - built here, once each
    const grids = [...this._grids.values()];
    this._grids.clear();
    for (const resolve of this._mids.values()) resolve(null);   // MID-RING: no worker, no middle ring
    this._mids.clear();
    for (const g of grids) g.resolve(restrideGrid({ woods: this._woods, roads: this._roads ?? null, sites: this._sites, beyond: this._beyond, climates: this._climates, ...g.job }));
  }
}
