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

let woods = null;

globalThis.onmessage = (ev) => {
  const m = ev.data ?? {};
  try {
    if (m.t === 'init') {
      const w = new WoodsFile();
      if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the terrain worker');
      woods = w;
      return;
    }
    if (m.t !== 'job') return;
    if (!woods) throw new Error('terrain worker got a job before init');
    const out = generatePixelTerrain({
      woods,
      px: m.px, py: m.py, stride: m.stride,
      tilemap: m.tilemap, locationRect: m.locationRect,
      hasLocation: m.hasLocation, climateType: m.climateType,
    });
    globalThis.postMessage(
      { t: 'done', ...out },
      [out.samples.buffer, out.tilemap.buffer, out.positions.buffer, out.normals.buffer, out.tilemapBytes.buffer]
    );
  } catch (e) {
    globalThis.postMessage({ t: 'error', message: e?.message ?? String(e) });
  }
};
