// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): A BRASS FISSURE'S ART, painted in code on the Super
// dungeon's pixel kit under a pseudo-archive of its own, as the fallen star's (world/starfall/starArt.js) - no ARENA2
// pixel in it. Each record `{ albedo, emission }`: the scorched earth with brass flecks and lit hairlines, the crack black
// with the aetherium's blue rising out of it, the heaved slabs' soil and rock. The wreckage wears the Sky-Ketch's metals
// (world/ketch/ketchArt.js), painted by its painters under this archive - the Ketch's upload is its own.
// Pure. Not a DFU member. Ledger A (STOREFRONT).
import { image, putTexel, noiseField, ramp, paletteOf, quantize } from './superDungeon/sdPixelKit.js';
import { ketchBrassArt, ketchGearArt, ketchCopperArt, ketchStoneArt } from './ketch/ketchArt.js';

/** The fissure's pseudo-archive (registered in world/eliteGates/pseudoArchives.js). */
export const FISSURE_ARCHIVE = 38361;
/** Its records: the scorched earth, the crack, the slabs, and the wreckage's brass, cogs, copper and stone. */
export const FISSURE_REC = Object.freeze({ earth: 0, crack: 1, slab: 2, brass: 3, gear: 4, copper: 5, stone: 6 });
/** Every picture is this square. */
export const FISSURE_ART_SIZE = 64;

/** The ramps, darkest first. */
export const FISSURE_RAMPS = Object.freeze({
  scorch: Object.freeze([[24, 20, 18], [38, 32, 27], [54, 46, 38], [72, 62, 50], [90, 79, 64]]),
  ash: Object.freeze([[96, 92, 88], [118, 114, 108]]),
  fleck: Object.freeze([[150, 112, 52], [206, 160, 74]]),
  deep: Object.freeze([[4, 6, 12], [10, 14, 24], [20, 26, 40]]),
  lip: Object.freeze([[46, 42, 40], [66, 60, 56], [88, 80, 74], [108, 100, 92]]),
  aether: Object.freeze([[18, 60, 120], [40, 120, 210], [110, 200, 255], [210, 246, 255]]),
  soil: Object.freeze([[52, 40, 26], [70, 54, 34], [88, 70, 44], [74, 78, 40]]),
  rock: Object.freeze([[58, 54, 50], [78, 72, 66], [98, 92, 84], [120, 112, 102]]),
});
const R = FISSURE_RAMPS;
const BLACK = [0, 0, 0];

/** A picture painted texel by texel by `paint(x, y) -> [albedo rgb, emission rgb]`, then held to its palettes. */
function painted(paint, albedoRamps, emissionRamps) {
  const N = FISSURE_ART_SIZE, albedo = image(N, N), emission = image(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [a, e] = paint(x, y);
      putTexel(albedo, x, y, a);
      putTexel(emission, x, y, e);
    }
  }
  quantize(albedo, paletteOf(...albedoRamps));
  quantize(emission, paletteOf([BLACK], ...emissionRamps));
  return { albedo, emission };
}

/** THE SCORCHED EARTH: soot over the ground, ash where the steam settled, brass flecks in it, hairline cracks lit blue. */
function earthArt() {
  const n = noiseField(0x5e01, 8), fine = noiseField(0x5e02, 24), cr = noiseField(0x5e03, 5), fl = noiseField(0x5e04, 32);
  return painted((x, y) => {
    const v = 0.6 * n(x, y) + 0.4 * fine(x, y);
    const c = Math.abs(cr(x, y) - 0.5);
    if (c < 0.012) return [ramp(R.scorch, 0.05, x, y), ramp(R.aether, 0.3 - c / 0.06, x, y)];
    if (fl(x, y) > 0.91) return [ramp(R.fleck, (fl(x, y) - 0.91) / 0.09, x, y), BLACK];
    if (v > 0.74) return [ramp(R.ash, (v - 0.74) / 0.26, x, y), BLACK];
    return [ramp(R.scorch, v / 0.74, x, y), BLACK];
  }, [R.scorch, R.ash, R.fleck], [R.aether]);
}
/** THE CRACK, its length along u and its width across v: black depths at the middle with the aetherium's seam lit in them,
 *  the blue climbing the walls and dying out at the broken lip. */
function crackArt() {
  const N = FISSURE_ART_SIZE, warp = noiseField(0x5f01, 6), grain = noiseField(0x5f02, 20), speck = noiseField(0x5f03, 28);
  return painted((x, y) => {
    const v = Math.abs((y + 0.5) / N - 0.5 + (warp(x, y) - 0.5) * 0.12);   // 0 the middle, 0.5 the edge
    const g = grain(x, y);
    if (v < 0.08) return [ramp(R.deep, 0.2 * g, x, y), ramp(R.aether, 0.85 + 0.15 * g, x, y)];
    if (v < 0.24) { const t = (v - 0.08) / 0.16; return [ramp(R.deep, 0.3 + 0.7 * t, x, y), ramp(R.aether, 0.7 * (1 - t) + 0.1 * g, x, y)]; }
    return [ramp(R.lip, 0.35 + 0.65 * g, x, y), speck(x, y) > 0.9 ? ramp(R.aether, 0.2, x, y) : BLACK];
  }, [R.deep, R.lip], [R.aether]);
}
/** THE SLABS: soil and its last grass on top (v under a half), the rock's strata on their broken faces (over it). */
function slabArt() {
  const N = FISSURE_ART_SIZE, n = noiseField(0x6001, 10), fine = noiseField(0x6002, 24), strata = noiseField(0x6003, 3);
  return painted((x, y) => {
    if (y < N / 2) return [ramp(R.soil, 0.55 * n(x, y) + 0.45 * fine(x, y), x, y), BLACK];
    const band = (Math.sin((y + strata(x, y) * 10) * 0.9) + 1) / 2;
    return [ramp(R.rock, 0.6 * band + 0.4 * fine(x, y), x, y), BLACK];
  }, [R.soil, R.rock], []);
}

let _art = null;
/**
 * THE ART: `[record, { albedo, emission }]` for each of the fissure's records, made once. Pure but for its cache.
 * @returns {Array<[number, { albedo: any, emission: any }]>}
 */
export function fissureArt() {
  _art ??= [
    [FISSURE_REC.earth, earthArt()],
    [FISSURE_REC.crack, crackArt()],
    [FISSURE_REC.slab, slabArt()],
    [FISSURE_REC.brass, ketchBrassArt(0x6101)],
    [FISSURE_REC.gear, ketchGearArt()],
    [FISSURE_REC.copper, ketchCopperArt(0x6102)],
    [FISSURE_REC.stone, ketchStoneArt(0x6103)],
  ];
  return _art;
}
