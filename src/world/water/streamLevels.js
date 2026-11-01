// @ts-check
// WATER-LEVEL: THE STREAMED WORLD'S LEVELS, each body's own law, asked at a vertex the tiles mark as water (world/water/
// waterLevel.js waterLevels): World 2.0's surface where a region holds the whole ground (regionSampler.js waterAt, the
// gate paintGen2Waters paints by), Cyrodiil's river or lake (tamrielWaters.js waterAt), and the sea where the ground
// stands at its clamp. Any other water stands at its uncarved ground. The terrain worker and the host's re-carve ask it.
import { gen2At, gen2Regions, gen2Touches } from '../gen2/gen2Ground.js';
import { tamrielWaters, waterAt as tamrielWaterAt } from '../tamriel/tamrielWaters.js';
import { inBay } from '../tamriel/tamrielFrame.js';
import { seaLevelAt, SEA_LEVEL_Y } from './waterLevel.js';

/** World 2.0's metres over the sea in the scene: regionSampler.js kernelUnits at the streamed scale, 34 + m. */
export const gen2LevelY = (m) => SEA_LEVEL_Y + m;

/** The regions' summed share of the ground at a world point (gen2Ground.js's own gate, read through its exports). */
const shareAt = (x, y) => { let s = 0; for (const r of gen2Regions()) if (r.owns(x, y)) s += r.weight(x, y); return s; };

/**
 * The painted waters' level at a world point - World 2.0's and Cyrodiil's, the waters the kernel paints as tiles - or
 * NaN. `g2` whether a region reaches the pixel, `law` Cyrodiil's compiled waters past the Bay (null on it).
 * @param {number} x @param {number} wy @param {boolean} g2 @param {?ReturnType<typeof tamrielWaters>} law
 */
function paintedLevel(x, wy, g2, law) {
  if (g2) {
    const r = gen2At(x, wy), w = r && r.weight(x, wy) >= 0.5 && shareAt(x, wy) >= 0.999 ? r.waterAt(x, wy) : null;
    if (w) return gen2LevelY(w.surface);
  }
  if (law) {
    const k = Math.floor(x) * 65536 + Math.floor(wy);
    const w = law.index.has(k) || law.lakeIndex.has(k) ? tamrielWaterAt(x, wy) : null;
    if (w && w.kind !== 'sea') return w.level;
  }
  return NaN;
}

/**
 * A pixel's level source for waterLevels: (vx, vz, y) of its grid at `stride` -> the scene level, or NaN for none. The
 * vertex's world point is the kernel's sample (bible/03-World/World-2-Canon.md, Coordinates).
 * @param {number} px @param {number} py @param {number} [stride]
 */
export function streamLevelAt(px, py, stride = 1) {
  const g2 = gen2Touches(px, py), law = inBay(px, py) ? null : tamrielWaters();
  return (vx, vz, y) => {
    const x = px + (vx * stride) / 128, wy = py + 1 - (vz * stride) / 128, painted = paintedLevel(x, wy, g2, law);
    return Number.isFinite(painted) ? painted : seaLevelAt(y);
  };
}

/** The bed's halo's painted waters about a pixel (world/water/waterBed.js bedHalo): a world point is water where World
 *  2.0 or Cyrodiil paints it - the neighbour's kernel cannot see those, so a lake met its seam as a bank, a line of foam. */
export function paintedWaterAt(px, py) {
  const g2 = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => gen2Touches(px + dx, py + dy))), law = inBay(px, py) ? null : tamrielWaters();
  return g2 || law ? (x, wy) => Number.isFinite(paintedLevel(x, wy, g2, law)) : null;
}
