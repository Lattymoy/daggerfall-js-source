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
import { generatePixelTerrain } from './terrainGen.js';
import { buildRoadsFromSettlements } from './roadsProducer.js';   // AUDIT ROADS F2
import { cachedNetwork, roadsCacheKey } from './roadsCache.js';   // ROADS 19

let woods = null;

let roads = null;   // ROADS 3
let pendingRoads = null;   // ROADS 19: the cache lookup in flight
globalThis.onmessage = (ev) => handle(ev.data ?? {});

function handle(m) {
  try {
    if (m.t === 'init') {
      const w = new WoodsFile();
      if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the terrain worker');
      woods = w;
      return;
    }
    // ROADS 3: the network arrives ONCE, after init, and rides every job
    // from then on. null clears it (a new game with a different archive).
    // AUDIT ROADS F2: the network is BUILT HERE, not shipped here. The
    // settlement list is a few thousand small objects; the build is
    // thousands of A* runs, which is exactly what the worker exists to
    // keep off the frame. The stats go back so the host can log them.
    if (m.t === 'roads') {
      roads = null;
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
          roads = net ? { roads: net.roads, tracks: net.tracks } : null;
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
    // ROADS 19: a job that arrives while the network is still loading
    // waits for it, so no chunk is ever generated roadless.
    if (m.t === 'job' && pendingRoads) { pendingRoads.then(() => handle(m)); return; }
    if (m.t !== 'job') return;
    if (!woods) throw new Error('terrain worker got a job before init');
    // AUDIT EV F-DOC1: the job crosses WHOLE - a spread, not a
    // hand-copied field list, so a new kernel input can never be
    // silently dropped at the wire (the audit found the explicit list
    // was the one place a field could rot with every test green).
    const out = generatePixelTerrain({ ...m, woods, roads });
    globalThis.postMessage(
      { t: 'done', ...out },
      [out.samples.buffer, out.tilemap.buffer, out.positions.buffer, out.normals.buffer, out.tilemapBytes.buffer]
    );
  } catch (e) {
    globalThis.postMessage({ t: 'error', message: e?.message ?? String(e) });
  }
}
