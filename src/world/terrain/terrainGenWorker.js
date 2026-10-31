// ═══════════════════════════════════════════════════════════════════
// EV7 — THE TERRAIN WORKER. The other half of terrainGenClient.js:
// one 'init' message hands it a COPY of the WOODS.WLD bytes (copied,
// never transferred - the reader's own buffer is what the main
// thread's travel map and heightAt keep reading for the session, the
// RA1 road-bake law), it builds its own WoodsFile once, and then each
// 'job' message runs the pure pixel kernel and answers ONE reply with
// the big typed arrays TRANSFERRED back. Jobs are answered in arrival
// order - the client keeps a FIFO on its side of the wire.
//
// This module may import ONLY pure, node-tested modules - no ui/, no
// scenes/, no render/, nothing that touches document at module scope -
// because a worker has no DOM and the import graph is evaluated whole.
// ═══════════════════════════════════════════════════════════════════

import { packNature, natureBuffers } from './natureWire.js';   // AUDIT BANTHA1 PERF-2
import { WoodsFile } from '../../formats/woodsFile.js';
import { groundWoods, dropGroundCache } from '../tamriel/tamrielGround.js';   // TAMRIEL2: the ground beyond the Bay
import { etherWoods } from '../ethericSea.js';   // ETHER-SEA: the Eltheric Ocean's ground
import { setTamrielTrace } from '../tamriel/tamrielLand.js';   // TAMRIEL3: the picture's own land
import { setTamrielFit } from '../tamriel/tamrielFrame.js';
import { generatePixelTerrain, restrideGrid } from './terrainGen.js';   // PERF-EXT26: and a built pixel's grid at another stride
import { buildMidRingHeights, buildFarFieldBytes, midRingPixel, farFieldCell } from './midRingGrid.js';   // MID-RING: the middle ring's ground, off the frame; FAR-FIELD: and the far field's
import { farCellClimate, midRingWet, DRY } from './farClimate.js';   // FAR-FIELD: a far cell's climate past the Bay, worked out here; MAP-WATERS: a middle-ring pixel's rivers
import { midRingFloraPixel, midRingCoverPixel, bandTreesPixel } from './floraCover.js';   // FAR-FLORA: the near law's woods at the middle ring's samples; FAR-TREES: a band pixel's own trees
import { lawWatersInk } from '../tamriel/watersInk.js';   // MAP-WATERS: the map's copy of the waters the kernel carves, compiled here
import { createLandforms } from '../landforms.js';
import { buildRoadsFromSettlements } from '../roadsProducer.js';   // AUDIT ROADS F2
import { cachedNetwork, roadsCacheKey } from '../roadsCache.js';   // ROADS 19
import { setArenaRoads, arenaRoadsLayer, unpackArenaRoads, mergeArenaRoads } from '../arenaRoads.js';   // TESA4/TESA14: the roads past the Bay

let woods = null;

let roads = null;   // ROADS 3
let sites = null;   // LANDFORM4: the game's own locations the landforms pull the ground to (landforms.js landformSites)
let climates = null;   // LANDFORM6: the world's climates, the land each wears (landforms.js landformClimates)
let beyond = null;   // BAY-LEFT-GROUND: the places past the Bay the landforms pull the ground to (landforms.js landformSitesBeyond)
let pendingRoads = null;   // ROADS 19: the cache lookup in flight
/** MID-RING / FAR-FIELD: the horizon's grounds kept a pixel (a cell) at a time across their rebuilds - a ring drifted
 *  three pixels asks some 170 new pixels of its 841, a far field drifted three cells some 1,100 new cells of its 14,641 -
 *  and let go whenever what they read moves (a new reader, network, table or trace: every message but a job). Each its
 *  own book, bounded past two of its grounds (a book smaller than one ground's walk would let go of every entry before
 *  the next rebuild asked it again): the one asked longest ago let go first. */
export const HORIZON_KEPT = Object.freeze({ mid: 4096, far: 32768 });
const keptBook = (limit) => {
  const book = new Map();
  const take = (key, make) => {
    let v = book.get(key);
    if (v) { book.delete(key); book.set(key, v); return v; }
    v = make();
    book.set(key, v);
    while (book.size > limit) book.delete(book.keys().next().value);
    return v;
  };
  take.clear = () => book.clear();
  take.size = () => book.size;
  return take;
};
const keptMid = keptBook(HORIZON_KEPT.mid), keptFar = keptBook(HORIZON_KEPT.far);
globalThis.onmessage = (ev) => handle(ev.data ?? {});

function handle(m) {
  try {
    if (m.t === 'init' || m.t === 'roads' || m.t === 'landform-tables' || m.t === 'landform-beyond' || m.t === 'tamriel') { keptMid.clear(); keptFar.clear(); }   // MID-RING: what the grounds read moved; BAY-LEFT-GROUND: the sites past the Bay too
    if (m.t === 'init') {
      const w = new WoodsFile();
      if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the terrain worker');
      // TAMRIEL2: the continent round the Bay, composed here as the host composes its own (the fallback law's) - the
      // same pure modules, so a pixel built on the worker is the bytes one built on the main thread is
      woods = m.tamriel ? groundWoods(w) : w;
      if (m.ether) woods = etherWoods(woods);   // ETHER-SEA: the Eltheric Ocean over it, as the host composes its own
      return;
    }
    // LANDFORM4/6: the landforms' tables - the sites and the climates - arrive once, after init and before any job (the
    // client posts them as the world mounts), and ride every job and every promotion from then on; null clears them.
    if (m.t === 'landform-tables') { sites = m.sites ?? null; climates = m.climates ?? null; return; }
    // BAY-LEFT-GROUND: the sites past the Bay - made again whenever the places past the Bay move; every job after it reads it
    if (m.t === 'landform-beyond') { beyond = m.beyond ?? null; return; }
    // TAMRIEL3: the picture's own land and the Bay's fit, as the host's modules hold them
    if (m.t === 'tamriel') { setTamrielTrace(m.trace ?? null); setTamrielFit(m.fit ?? null); dropGroundCache(); return; }
    // MAP-WATERS: the held map's rivers and lakes - the law this worker compiles for its carve anyway, packed and moved
    if (m.t === 'waters') { const { ink, transfer } = lawWatersInk(); globalThis.postMessage({ t: 'watersInk', ink }, transfer); return; }
    // ROADS 3: the network arrives ONCE, after init, and rides every job
    // from then on. null clears it (a new game with a different archive).
    // AUDIT ROADS F2: the network is BUILT HERE, not shipped here. The
    // settlement list is a few thousand small objects; the build is
    // thousands of A* runs, which is exactly what the worker exists to
    // keep off the frame. The stats go back so the host can log them.
    if (m.t === 'roads') {
      roads = null;
      // ROADS 22: a network handed in ready-made rides every job from now
      // on; no build, no cache, nothing to wait for (the tests' door).
      // AUDIT 58 F3: `smooth` rides it on this arm too.
      if (m.net) { roads = { roads: m.net.roads, tracks: m.net.tracks, rivers: m.net.rivers ?? null, streams: m.net.streams ?? null, water: !!m.net.water, smooth: m.net.smooth !== false }; globalThis.postMessage({ t: 'roads', stats: m.stats ?? null, net: null }); return; }
      if (m.settlements && woods) {
        // ROADS 19: through the cache. The key is everything that shapes
        // the network; a hit skips the 4.4-second build, a miss pays it
        // once and stores it. The message loop is synchronous by design
        // (the job spread below must not race), so the async cache is
        // awaited here and jobs queue behind it exactly as they queued
        // behind the build.
        pendingRoads = cachedNetwork({
          key: roadsCacheKey({ settlements: m.settlements, woodsLength: woods._bytes?.byteLength ?? 0 }),
          build: () => buildRoadsFromSettlements(m.settlements, woods),
        }).then((net) => {
          roads = net ? { roads: net.roads, tracks: net.tracks, rivers: net.rivers ?? null, streams: net.streams ?? null, ...(m.switches ?? {}) } : null;   // ROADS 24; OWN-WORK2: the rivers
          // ROADS 7: the map draws the network too, on this thread's other
          // side, so the arrays go back ONCE - a copy, transferred - and
          // the worker keeps its own for the terrain jobs.
          const back = roads ? { roads: roads.roads.slice(), tracks: roads.tracks.slice(), rivers: roads.rivers?.slice() ?? null, streams: roads.streams?.slice() ?? null } : null;
          const stats = net ? { ...net.stats, cached: !!net.cached } : null;
          globalThis.postMessage({ t: 'roads', stats, net: back }, back ? [back.roads, back.tracks, back.rivers, back.streams].filter(Boolean).map((a) => a.buffer) : []);
          pendingRoads = null;
        });
      }
      return;
    }
    // TESA4: Arena's roads past the Bay - synchronous, so no job posted after it is answered before it, and none posted
    // before it waits for it (the host asked the roads' cache before it posted: the jobs' order is the FIFO's)
    if (m.t === 'arena-roads') { answerArenaRoads(m); return; }
    // PERF-EXT26: a promotion's grid needs no network, so it never waits
    // behind one, and it answers by its id - never through the jobs' FIFO.
    // LANDFORM1-3: unless it is the landforms' grid - its ghost rows are cut
    // along the network, so it waits for the one the pixel was cut along.
    if (m.t === 'grid' && m.landform && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t === 'grid') { answerGrid(m); return; }
    // MID-RING: the middle ring's heights, by id as a grid is - the landforms' wait for the network theirs is cut along
    if (m.t === 'midring' && m.landform && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t === 'midring') { answerMidRing(m); return; }
    if (m.t === 'farfield') { answerFarField(m); return; }   // FAR-FIELD: the heightmap alone - no network to wait for
    if (m.t === 'floraband' && m.landform && pendingRoads) { pendingRoads.then(() => handle(m)); return; }   // FAR-TREES: the landforms the roads shape, as the stream's
    if (m.t === 'floraband') { answerFloraBand(m); return; }   // FAR-TREES: the band's trees past the grid
    // ROADS 19: a job that arrives while the network is still loading
    // waits for it, so no chunk is ever generated roadless.
    if (m.t === 'job' && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t !== 'job') return;
    if (!woods) throw new Error('terrain worker got a job before init');
    // AUDIT EV F-DOC1: the job crosses WHOLE - a spread, not a
    // hand-copied field list, so a new kernel input can never be
    // silently dropped at the wire (the audit found the explicit list
    // was the one place a field could rot with every test green).
    const out = generatePixelTerrain({ ...m, woods, roads, sites, beyond, climates });
    const transfer = [out.samples.buffer, out.tilemap.buffer, out.positions.buffer, out.normals.buffer, out.tilemapBytes.buffer];
    if (out.paths) transfer.push(out.paths.buffer);   // GRASS-PATH1: null on a roadless pixel, and a null is not a buffer
    if (out.beach) transfer.push(out.beach.buffer);   // AUDIT LANDFORMS II H2: a location's DFU blend, with the row on
    if (out.landProps?.length) transfer.push(out.landProps.buffer);   // TESA-LANDS: the landmarks (a Fens pixel's 5,000 reeds)
    if (out.bed) transfer.push(out.bed.depths.buffer, out.bed.sheetDepths.buffer, out.bed.positions.buffer, out.bed.normals.buffer, ...(out.bed.halo ? [out.bed.halo.bits.buffer] : []));   // AUDIT WATER-NEXT P1: the bed, carved here
    out.nature = packNature(out.nature);   // AUDIT BANTHA1 PERF-2: by column, its buffers transferred - never a clone of 12,000 objects
    transfer.push(...natureBuffers(out.nature));
    globalThis.postMessage({ t: 'done', ...out }, transfer);
  } catch (e) {
    globalThis.postMessage({ t: 'error', message: e?.message ?? String(e) });
  }
}

/** TESA14: THE ROADS PAST THE BAY (world/tamrielRoads.js) - a region's layer, or the crossings' joins, merged into the
 *  one installed for every job from now on (`reset` drops it first). Built by the roads' own worker; nothing is built
 *  here. */
function answerArenaRoads(m) {
  const layer = m.reset || !arenaRoadsLayer() ? { roads: new Map(), tracks: new Map(), join: new Map() } : arenaRoadsLayer();
  if (m.layer) mergeArenaRoads(layer, unpackArenaRoads(m.layer));
  setArenaRoads(layer);
}

/** MID-RING (render/midRing.js): the middle ring's heights round {baseX, baseY} - the kernel's own at whole samples
 *  (world/terrain/midRingGrid.js), the landforms' where the job carries the row, on this worker's own network and tables
 *  - TRANSFERRED back under the job's id. A failure answers `midError`: the client answers null and the far ring stands. */
function answerMidRing(m) {
  try {
    if (!woods) throw new Error('terrain worker got a middle ring before init');
    const landforms = m.landform ? createLandforms({ woods, roads, sites, beyond, climates }) : null;
    const pixel = (px, py) => keptMid(`${px},${py},${m.sub},${m.landform ? 1 : 0}`, () => midRingPixel(woods, px, py, m.sub, landforms));
    const heights = buildMidRingHeights({ woods, baseX: m.baseX, baseY: m.baseY, radius: m.radius, sub: m.sub, landforms, rows: m.rows ?? null, pixel });
    // MAP-WATERS: and where stream G's rivers and lakes stand in it - sent only when one does
    let anyWet = false;
    const wetPixel = (px, py) => { const v = keptMid(`w${px},${py},${m.sub}`, () => midRingWet(px, py, m.sub)); if (v !== DRY) anyWet = true; return v; };
    const wet = buildMidRingHeights({ woods, baseX: m.baseX, baseY: m.baseY, radius: m.radius, sub: m.sub, rows: m.rows ?? null, pixel: wetPixel, Kind: Uint8Array });
    // FAR-FLORA: and the woods the near law grows at each sample (world/terrain/floraCover.js), kept by the pixel as its heights are
    const flora = m.flora ? buildMidRingHeights({ woods, baseX: m.baseX, baseY: m.baseY, radius: m.radius, sub: m.sub, rows: m.rows ?? null, pixel: (px, py) => keptMid(`f${px},${py},${m.sub},${m.landform ? 1 : 0}`, () => midRingFloraPixel(pixel(px, py), px, py, m.sub)), Kind: /** @type {any} */ (Uint32Array) }) : null;
    // TESA-LANDS (AUDIT): and with the lands' row the forest field's own value there (floraCover.js midRingCoverPixel) - a
    // zone's woods are its recipe's edge on it
    const cover = m.flora && m.lands ? buildMidRingHeights({ woods, baseX: m.baseX, baseY: m.baseY, radius: m.radius, sub: m.sub, rows: m.rows ?? null, pixel: (px, py) => keptMid(`c${px},${py},${m.sub}`, () => midRingCoverPixel(px, py, m.sub)), Kind: Uint8Array }) : null;
    const moved = [heights.buffer, ...(anyWet ? [wet.buffer] : []), ...(flora ? [flora.buffer] : []), ...(cover ? [cover.buffer] : [])];
    globalThis.postMessage({ t: 'mid', id: m.id, heights, wet: anyWet ? wet : null, flora, cover }, moved);
  } catch (e) {
    globalThis.postMessage({ t: 'midError', id: m.id, message: e?.message ?? String(e) });
  }
}

/** FAR-FIELD (render/farField.js): the far field's cells round {baseCX, baseCY} - each its vertex's byte and its count of
 *  the sea's floor, off this worker's own reader (world/terrain/midRingGrid.js buildFarFieldBytes), RELIEF-PEAKS and its
 *  vertex's ground (`relief` the Landforms row) - TRANSFERRED back under the job's id; a failure answers `farError`, and the
 *  far ring closes into the sky as it always did. */
function answerFarField(m) {
  try {
    if (!woods) throw new Error('terrain worker got a far field before init');
    const cellAt = (cx, cy) => keptFar(`${cx},${cy},${m.cell},${m.seaByte},${m.relief ? 1 : 0}`, () => farFieldCell(woods, cx, cy, m.cell, m.seaByte, farCellClimate, !!m.relief));
    const { high, low, clim, ground } = buildFarFieldBytes({ woods, baseCX: m.baseCX, baseCY: m.baseCY, radius: m.radius, cell: m.cell, seaByte: m.seaByte, rows: m.rows ?? null, cellAt });
    globalThis.postMessage({ t: 'far', id: m.id, high, low, clim, ground }, [high.buffer, low.buffer, clim.buffer, ground.buffer]);
  } catch (e) {
    globalThis.postMessage({ t: 'farError', id: m.id, message: e?.message ?? String(e) });
  }
}

/** FAR-TREES (render/farTrees.js): THE BAND'S TREES - each pixel of `pixels` ([px, py, nature archive, climate type] four
 *  a pixel) its own trees as the stream would stand them (world/terrain/floraCover.js bandTreesPixel), kept by the pixel
 *  in the horizon's book and answered as copies, TRANSFERRED; a failure answers `bandError`, and the band waits. */
function answerFloraBand(m) {
  try {
    if (!woods) throw new Error('terrain worker got a band before init');
    const landforms = m.landform ? createLandforms({ woods, roads, sites, beyond, climates }) : null;
    const trees = [];
    for (let k = 0; k + 3 < m.pixels.length; k += 4) {
      const [px, py, archive, climateType] = [m.pixels[k], m.pixels[k + 1], m.pixels[k + 2], m.pixels[k + 3]];
      trees.push(keptMid(`t${px},${py},${archive},${climateType},${m.forests ? 1 : 0},${m.landform ? 1 : 0},${m.lands ? 1 : 0}`, () => bandTreesPixel({ woods, px, py, archive, climateType, forests: !!m.forests, landforms, lands: !!m.lands })).slice());   // TESA-LANDS: a zone's own, with the row
    }
    globalThis.postMessage({ t: 'band', id: m.id, trees }, trees.map((t) => t.buffer));
  } catch (e) {
    globalThis.postMessage({ t: 'bandError', id: m.id, message: e?.message ?? String(e) });
  }
}

/** PERF-EXT26: STREAM1's promotion, off the frame - {id, px, py, stride,
 *  samples} in (the samples a clone: the main thread keeps its own), the
 *  grid's two arrays TRANSFERRED back under the same id. A failure answers
 *  `gridError` under the id, and the client builds that one on its own
 *  thread - the fallback, never a hole. */
function answerGrid(m) {
  try {
    if (!woods) throw new Error('terrain worker got a grid before init');
    // LANDFORM1-3: the ghost rows are the shaped ground when the job carries the Landforms row, cut along this
    // worker's own network - the one its jobs paint
    const { positions, normals, bed } = restrideGrid({ ...m, woods, roads, sites, beyond, climates });
    const transfer = [positions.buffer, normals.buffer];
    if (bed) transfer.push(bed.depths.buffer, bed.sheetDepths.buffer, bed.positions.buffer, bed.normals.buffer, ...(bed.halo ? [bed.halo.bits.buffer] : []));   // AUDIT WATER-NEXT P1: and its bed
    globalThis.postMessage({ t: 'grid', id: m.id, positions, normals, bed }, transfer);
  } catch (e) {
    globalThis.postMessage({ t: 'gridError', id: m.id, message: e?.message ?? String(e) });
  }
}
