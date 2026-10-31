// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE BAY'S FIT, KEPT.
// fitBayToPicture (tamrielLand.js: 25 scales, 49 x 49 offsets) takes 0.25 s just after the world's first frame, every
// launch. It reads the picture's trace (TMAP00I0, TAMRIEL2) and the Bay's land (CLIMATE.PAK, WOODS.WLD), so the answer is
// kept in the derived store. The key holds:
//   - firstVisitPin('bayFit'), the pin of the fit's code (tools/computationPin.mjs);
//   - a stamp over the trace's land and the Bay's land at every pixel the fit can sample (the inputs, not file names).
// The answer is a few numbers; one is kept, a new one sweeps the last (`fv-bayfit:`).

import { fitBayToPicture } from './tamrielLand.js';
import { BAY_W, BAY_H } from './tamrielFrame.js';
import { fnv1a, keptAnswer, derivedValueStore, firstVisitPin } from '../../systems/firstVisit/firstVisitStore.js';

/** The cache's scope: one fit, the last made. */
export const BAY_FIT_SCOPE = 'fv-bayfit:';

/** The key of the fit over these inputs. @param {(x: number, y: number) => boolean} bayLand @param {{ w: number, h: number, land: ArrayLike<number> }} trace */
export function bayFitKey(bayLand, trace) {
  const bay = new Uint8Array(Math.ceil((BAY_W * BAY_H) / 8));
  // BAY-OWN: the fit's key reads the Bay's own grid, a bit a pixel (the formatter put its two loops on two lines)
  for (let y = 0; y < BAY_H; y++)
    for (let x = 0; x < BAY_W; x++)
      if (bayLand(x, y)) {
        const i = y * BAY_W + x;
        bay[i >>> 3] |= 1 << (i & 7);
      }
  const land = trace.land instanceof Uint8Array ? trace.land : Uint8Array.from(trace.land);
  return `${BAY_FIT_SCOPE}${firstVisitPin('bayFit')}:${trace.w}x${trace.h}:${fnv1a(land).toString(36)}:${fnv1a(bay).toString(36)}`;
}

const isFit = (v) => !!v && ['ox', 'oy', 'ppu', 'score', 'cells', 'seam', 'edge'].every((k) => Number.isFinite(v[k]));

/**
 * fitBayToPicture at its defaults: the kept answer for these inputs, or the fit's own, kept. A fit of nothing (null) is
 * worked out every time - it is no stall worth a record.
 * @param {{ bayLand: (x: number, y: number) => boolean, trace: { w: number, h: number, land: ArrayLike<number> } }} o
 */
export async function keptBayFit({ bayLand, trace }, store = derivedValueStore()) {
  if (!store) return fitBayToPicture({ bayLand, trace });
  const { value } = await keptAnswer({
    key: bayFitKey(bayLand, trace),
    scope: BAY_FIT_SCOPE,
    build: () => fitBayToPicture({ bayLand, trace }),
    accept: isFit,
    store,
  });
  return value;
}
