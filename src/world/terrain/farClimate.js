// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-FIELD (2026-10-26, bible/06-Systems/Travel-View.md MID-RING and FAR-FIELD): A FAR CELL'S CLIMATE, READ ON THE
// TERRAIN WORKER where the worker reads it as the main thread's reader does - past the Bay, the continent's
// (world/tamriel/tamrielGround.js groundClimateIndex: its trace installed on the worker by 'tamriel'), outside the
// Eltheric Ocean's box (whose law the main thread holds: scenes/world.js etherClimateIndex). Everywhere else
// FAR_CLIMATE_ASK - the main thread's own map, which reads the Bay's climate off an array. Measured on the freeware's
// ground: the continent's first climate read works its biomes out in some 150 ms, and a cold centre some 16
// microseconds after - the far field's 14,641 centres asked on the main thread ran a step of its build to 196 ms.
// WORKER-SAFE: pure modules only (test/world/terrain/terrainworker.test.js EV7).
// ═══════════════════════════════════════════════════════════════════

import { tamrielClimateAt } from '../tamriel/tamrielGround.js';
import { tamrielTrace } from '../tamriel/tamrielLand.js';
import { inBay } from '../tamriel/tamrielFrame.js';
import { inEtherLaw } from '../ethericSea.js';
import { FAR_CLIMATE_ASK } from './midRingGrid.js';

/** A far cell's centre pixel's climate as the main thread's reader answers it, or FAR_CLIMATE_ASK where this thread
 *  cannot say (the Bay, the Eltheric Ocean's box, no continent installed). */
export function farCellClimate(x, y) {
  return tamrielTrace() && !inBay(x, y) && !inEtherLaw(x, y) ? tamrielClimateAt(x, y) & 255 : FAR_CLIMATE_ASK;
}
