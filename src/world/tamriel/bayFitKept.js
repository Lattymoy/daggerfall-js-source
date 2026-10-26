// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE BAY'S FIT, KEPT.
//
// Where the Bay stands on the picture of Tamriel (tamrielLand.js fitBayToPicture: 25 scales, 49 x 49 offsets) is 0.25 s
// of a frame just after the world's first, every launch, for the same answer. The fit reads two things: the picture's
// trace (TMAP00I0 and TAMRIEL2, ui/tamrielTrace.js) and the Bay's land by the one water law (CLIMATE.PAK and WOODS.WLD,
// as the boot left them). So it is kept in the player's derived store under:
//   - BAY_FIT_VERSION, bumped by hand when the fit's law changes shape (its scales, its weights), and the build (BUILD_TAG);
//   - a stamp over the trace's land (its every pixel) and over the Bay's land at every pixel the fit can sample - the
//     inputs themselves, not the files' names, so a boot repair or another archive is another key.
// The answer is a handful of numbers.

import { fitBayToPicture } from './tamrielLand.js';
import { BAY_W, BAY_H } from './tamrielFrame.js';
import { BUILD_TAG } from '../../buildTag.js';
import { fnv1a, keptAnswer, derivedValueStore } from '../../systems/firstVisit/firstVisitStore.js';

/** Bump when the fit's law changes shape. */
export const BAY_FIT_VERSION = 1;

/** The key of the fit over these inputs. @param {(x: number, y: number) => boolean} bayLand @param {{ w: number, h: number, land: ArrayLike<number> }} trace */
export function bayFitKey(bayLand, trace) {
  const bay = new Uint8Array(Math.ceil((BAY_W * BAY_H) / 8));
  for (let y = 0; y < BAY_H; y++) for (let x = 0; x < BAY_W; x++) if (bayLand(x, y)) { const i = y * BAY_W + x; bay[i >>> 3] |= 1 << (i & 7); }
  const land = trace.land instanceof Uint8Array ? trace.land : Uint8Array.from(trace.land);
  return `fv-bayfit:v${BAY_FIT_VERSION}:${BUILD_TAG}:${trace.w}x${trace.h}:${fnv1a(land).toString(36)}:${fnv1a(bay).toString(36)}`;
}

const isFit = (v) => !!v && ['ox', 'oy', 'ppu', 'score', 'cells', 'seam', 'edge'].every((k) => Number.isFinite(v[k]));

/**
 * fitBayToPicture at its defaults: the kept answer for these inputs, or the fit's own, kept. A fit of nothing (null) is
 * worked out every time - it is no stall worth a record.
 * @param {{ bayLand: (x: number, y: number) => boolean, trace: { w: number, h: number, land: ArrayLike<number> } }} o
 */
export async function keptBayFit({ bayLand, trace }, store = derivedValueStore()) {
  if (!store) return fitBayToPicture({ bayLand, trace });
  const { value } = await keptAnswer({ key: bayFitKey(bayLand, trace), build: () => fitBayToPicture({ bayLand, trace }), accept: isFit, store });
  return value;
}
