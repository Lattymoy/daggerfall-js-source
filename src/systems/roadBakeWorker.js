// ═══════════════════════════════════════════════════════════════════
// RA1 — THE BAKE WORKER. The other half of roadBakeClient.js: receives
// one marshalled job (cost plane, heights copy, locations - plain data
// only, see the client's header for why the cost field is built on the
// main thread), runs the pure builder, and answers ONE flat buffer.
//
// This module may import ONLY pure, node-tested modules - no ui/, no
// scenes/, nothing that touches document at module scope - because a
// worker has no DOM and the import graph is evaluated whole.
//
// PROGRESS IS THROTTLED HERE, at the producer. The spur stage reports
// once per location - ~14,800 times at full scale - and every
// postMessage is a structured-clone plus a main-thread task. A report
// every ~80ms is indistinguishable to a human and thousands of times
// cheaper. Phase edges and final counts always go through, so the
// status line never skips a stage or ends short of its total.
// ═══════════════════════════════════════════════════════════════════

import { buildRoadNetwork } from './roads.js';
import { serializeRoads } from './roadBake.js';

const PROGRESS_EVERY_MS = 80;

globalThis.onmessage = (ev) => {
  const { cost, minStep, width, height, heightBytes, locations } = ev.data;
  try {
    let lastAt = 0, lastPhase = '';
    const onProgress = ({ phase, done, total }) => {
      const now = Date.now();
      if (phase === lastPhase && done !== total && now - lastAt < PROGRESS_EVERY_MS) return;
      lastPhase = phase;
      lastAt = now;
      globalThis.postMessage({ t: 'progress', phase, done, total });
    };
    const { network, stats } = buildRoadNetwork({
      field: { cost, width, height, minStep },
      heightBytes, locations, onProgress,
    });
    const bytes = serializeRoads(network);
    globalThis.postMessage({ t: 'done', bytes, stats }, [bytes.buffer]);
  } catch (e) {
    globalThis.postMessage({ t: 'error', message: e?.message ?? String(e) });
  }
};
