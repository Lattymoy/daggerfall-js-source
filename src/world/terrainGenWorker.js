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

import { WoodsFile } from '../formats/woodsFile.js';
import { groundWoods, dropGroundCache } from './tamrielGround.js';   // TAMRIEL2: the ground beyond the Bay
import { setTamrielTrace } from './tamrielLand.js';   // TAMRIEL3: the picture's own land
import { setTamrielFit } from './tamrielFrame.js';
import { generatePixelTerrain, restrideGrid } from './terrainGen.js';   // PERF-EXT26: and a built pixel's grid at another stride
import { buildRoadsFromSettlements } from './roadsProducer.js';   // AUDIT ROADS F2
import { cachedNetwork, roadsCacheKey } from './roadsCache.js';   // ROADS 19

let woods = null;

let roads = null;   // ROADS 3
let sites = null;   // LANDFORM4: the game's own locations the landforms pull the ground to (landforms.js landformSites)
let climates = null;   // LANDFORM6: the world's climates, the land each wears (landforms.js landformClimates)
let pendingRoads = null;   // ROADS 19: the cache lookup in flight
globalThis.onmessage = (ev) => handle(ev.data ?? {});

function handle(m) {
  try {
    if (m.t === 'init') {
      const w = new WoodsFile();
      if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the terrain worker');
      // TAMRIEL2: the continent round the Bay, composed here as the host composes its own (the fallback law's) - the
      // same pure modules, so a pixel built on the worker is the bytes one built on the main thread is
      woods = m.tamriel ? groundWoods(w) : w;
      return;
    }
    // LANDFORM4/6: the landforms' tables - the sites and the climates - arrive once, after init and before any job (the
    // client posts them as the world mounts), and ride every job and every promotion from then on; null clears them.
    if (m.t === 'landform-tables') { sites = m.sites ?? null; climates = m.climates ?? null; return; }
    // TAMRIEL3: the picture's own land and the Bay's fit, as the host's modules hold them
    if (m.t === 'tamriel') { setTamrielTrace(m.trace ?? null); setTamrielFit(m.fit ?? null); dropGroundCache(); return; }
    // ROADS 3: the network arrives ONCE, after init, and rides every job
    // from then on. null clears it (a new game with a different archive).
    // AUDIT ROADS F2: the network is BUILT HERE, not shipped here. The
    // settlement list is a few thousand small objects; the build is
    // thousands of A* runs, which is exactly what the worker exists to
    // keep off the frame. The stats go back so the host can log them.
    if (m.t === 'roads') {
      roads = null;
      // ROADS 22: his arrays arrive ready-made and ride every job from
      // now on; no build, no cache, nothing to wait for.
      // AUDIT 58 F3: `smooth` rides his data on this arm too - it was
      // dropped here (and at both of the client's rebuilds) while `water`
      // survived, so the Mods pane's SmoothRoads switch was inert on the
      // path the game actually takes.
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
          roads = net ? { roads: net.roads, tracks: net.tracks, ...(m.switches ?? {}) } : null;   // ROADS 24
          // ROADS 7: the map draws the network too, on this thread's other
          // side, so the arrays go back ONCE - a copy, transferred - and
          // the worker keeps its own for the terrain jobs.
          const back = roads ? { roads: roads.roads.slice(), tracks: roads.tracks.slice() } : null;
          const stats = net ? { ...net.stats, cached: !!net.cached } : null;
          globalThis.postMessage({ t: 'roads', stats, net: back }, back ? [back.roads.buffer, back.tracks.buffer] : []);
          pendingRoads = null;
        });
      }
      return;
    }
    // PERF-EXT26: a promotion's grid needs no network, so it never waits
    // behind one, and it answers by its id - never through the jobs' FIFO.
    // LANDFORM1-3: unless it is the landforms' grid - its ghost rows are cut
    // along the network, so it waits for the one the pixel was cut along.
    if (m.t === 'grid' && m.landform && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t === 'grid') { answerGrid(m); return; }
    // ROADS 19: a job that arrives while the network is still loading
    // waits for it, so no chunk is ever generated roadless.
    if (m.t === 'job' && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t !== 'job') return;
    if (!woods) throw new Error('terrain worker got a job before init');
    // AUDIT EV F-DOC1: the job crosses WHOLE - a spread, not a
    // hand-copied field list, so a new kernel input can never be
    // silently dropped at the wire (the audit found the explicit list
    // was the one place a field could rot with every test green).
    const out = generatePixelTerrain({ ...m, woods, roads, sites, climates });
    const transfer = [out.samples.buffer, out.tilemap.buffer, out.positions.buffer, out.normals.buffer, out.tilemapBytes.buffer];
    if (out.paths) transfer.push(out.paths.buffer);   // GRASS-PATH1: null on a roadless pixel, and a null is not a buffer
    if (out.beach) transfer.push(out.beach.buffer);   // AUDIT LANDFORMS II H2: a location's DFU blend, with the row on
    if (out.bed) transfer.push(out.bed.depths.buffer, out.bed.sheetDepths.buffer, out.bed.positions.buffer, out.bed.normals.buffer, ...(out.bed.halo ? [out.bed.halo.bits.buffer] : []));   // AUDIT WATER-NEXT P1: the bed, carved here
    globalThis.postMessage({ t: 'done', ...out }, transfer);
  } catch (e) {
    globalThis.postMessage({ t: 'error', message: e?.message ?? String(e) });
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
    const { positions, normals, bed } = restrideGrid({ ...m, woods, roads, sites, climates });
    const transfer = [positions.buffer, normals.buffer];
    if (bed) transfer.push(bed.depths.buffer, bed.sheetDepths.buffer, bed.positions.buffer, bed.normals.buffer, ...(bed.halo ? [bed.halo.bits.buffer] : []));   // AUDIT WATER-NEXT P1: and its bed
    globalThis.postMessage({ t: 'grid', id: m.id, positions, normals, bed }, transfer);
  } catch (e) {
    globalThis.postMessage({ t: 'gridError', id: m.id, message: e?.message ?? String(e) });
  }
}
