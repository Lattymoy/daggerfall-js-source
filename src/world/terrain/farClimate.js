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
import { FAR_CLIMATE_ASK, MID_SUB } from './midRingGrid.js';
import { waterAt } from '../tamriel/tamrielWaters.js';
import { bayEdgeDistance, SEAM_PX, BLEND_PX } from '../tamriel/tamrielGround.js';

/** A far cell's centre pixel's climate as the main thread's reader answers it, or FAR_CLIMATE_ASK where this thread
 *  cannot say (the Bay, the Eltheric Ocean's box, no continent installed). */
export function farCellClimate(x, y) {
  return tamrielTrace() && !inBay(x, y) && !inEtherLaw(x, y) ? tamrielClimateAt(x, y) & 255 : FAR_CLIMATE_ASK;
}

/** MAP-WATERS: a middle-ring pixel with no river and no lake of stream G's in it (shared: nothing to lay or to move). */
export const DRY = new Uint8Array(0);
/**
 * MAP-WATERS: A MIDDLE-RING PIXEL'S WATER - its (sub + 1)^2 samples (the middle ring's own: i east, j north, at whole
 * samples) flagged 255 where stream G's law puts a river's channel or a lake (world/tamriel/tamrielWaters.js waterAt,
 * the water the kernel carves and paints), so the middle ring draws a river as water at the level the carve lays it;
 * DRY where none reaches the pixel (the Bay and its seam, no continent installed, dry land).
 */
export function midRingWet(px, py, sub = MID_SUB) {
  if (!tamrielTrace() || bayEdgeDistance(px, py) <= SEAM_PX + BLEND_PX) return DRY;
  const w = sub + 1,
    out = new Uint8Array(w * w);
  let any = false;
  for (let j = 0; j <= sub; j++) {
    for (let i = 0; i <= sub; i++) {
      const at = waterAt(px + i / sub, py + 1 - j / sub); // sample j north of the pixel's south edge (Bay y runs south)
      if (at && (at.kind === 'river' || at.kind === 'lake')) {
        out[j * w + i] = 255;
        any = true;
      }
    }
  }
  return any ? out : DRY;
}
