// @ts-check
// STAR4 (2026-10-20): THE FALLEN STAR'S ART - every picture its crater and its stone wear, painted in code on the
// Super dungeon's pixel kit (world/superDungeon/sdPixelKit.js: seeded noise, ramps through the ordered dither, a palette
// held), under a pseudo-archive of its own (world/eliteGates/pseudoArchives.js). No ARENA2 pixel is in it. Design:
// bible/11-Multiplayer/Starfall.md section 3.
//
// Each record is `{ albedo, emission }`: what the surface is, and what of it glows of itself (black: nothing) - the
// renderer's own pair (world/gate/gateArt.js). The crater is earth the star burned, cracked with its light; its rim the
// earth it threw; the stone pale glass lit from inside, veined; the coven's thread black. Held, the glass goes gold; lost,
// it goes dark and its light all but out.
//
// Pure. Not a DFU member. Ledger A (STARFALL).
import { image, putTexel, noiseField, ramp, paletteOf, quantize } from '../superDungeon/sdPixelKit.js';

/** The star's pseudo-archive (registered in world/eliteGates/pseudoArchives.js). */
export const STAR_ARCHIVE = 38301;
/** Its records: the crater's burned earth, its rim, the stone's glass, the thread, the glass held and the glass lost. */
export const STAR_EARTH_RECORD = 0;
export const STAR_RIM_RECORD = 1;
export const STAR_GLASS_RECORD = 2;
export const STAR_THREAD_RECORD = 3;
export const STAR_GOLD_RECORD = 4;
export const STAR_DARK_RECORD = 5;
/** Every picture is this square. */
export const STAR_ART_SIZE = 64;

/** The ramps, darkest first. */
export const STAR_RAMPS = Object.freeze({
  char: Object.freeze([[16, 13, 12], [28, 23, 20], [42, 35, 30], [58, 49, 42], [76, 65, 56]]),
  ash: Object.freeze([[86, 82, 80], [108, 104, 100], [130, 126, 122]]),
  crack: Object.freeze([[42, 12, 74], [96, 46, 168], [176, 128, 255]]),
  earth: Object.freeze([[50, 39, 28], [70, 55, 38], [92, 73, 50], [116, 93, 64]]),
  stone: Object.freeze([[78, 78, 84], [102, 102, 108], [126, 126, 132]]),
  glass: Object.freeze([[146, 136, 188], [178, 170, 220], [206, 200, 240], [230, 226, 252], [248, 246, 255]]),
  vein: Object.freeze([[84, 62, 168], [152, 122, 242], [222, 212, 255]]),
  thread: Object.freeze([[6, 4, 10], [14, 10, 22], [26, 19, 38]]),
  gold: Object.freeze([[186, 146, 68], [218, 182, 98], [240, 212, 138], [252, 238, 190]]),
  goldGlow: Object.freeze([[156, 106, 28], [238, 188, 78], [255, 236, 170]]),
  dark: Object.freeze([[20, 18, 28], [32, 28, 44], [46, 42, 62]]),
  darkGlow: Object.freeze([[10, 6, 20], [22, 13, 38]]),
});
const R = STAR_RAMPS;
const BLACK = [0, 0, 0];

/** A picture painted texel by texel by `paint(x, y) -> [albedo rgb, emission rgb]`, then held to its palettes. */
function painted(seed, paint, albedoRamps, emissionRamps) {
  const W = STAR_ART_SIZE, albedo = image(W, W), emission = image(W, W);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const [a, e] = paint(x, y);
      putTexel(albedo, x, y, a);
      putTexel(emission, x, y, e);
    }
  }
  quantize(albedo, paletteOf(...albedoRamps));
  quantize(emission, paletteOf([BLACK], ...emissionRamps));
  return { albedo, emission, seed };
}

/** THE CRATER'S FLOOR: charred earth under a skin of ash, cracked - the cracks lit violet from beneath. */
function earthArt() {
  const n = noiseField(0x5a01, 8), fine = noiseField(0x5a02, 24), cr = noiseField(0x5a03, 6);
  return painted(0x5a00, (x, y) => {
    const v = 0.65 * n(x, y) + 0.35 * fine(x, y);
    const c = Math.abs(cr(x, y) - 0.5);   // a crack where the field crosses its middle
    if (c < 0.035) return [ramp(R.char, 0.1, x, y), ramp(R.crack, 1 - c / 0.035, x, y)];
    if (v > 0.72) return [ramp(R.ash, (v - 0.72) / 0.28, x, y), BLACK];
    return [ramp(R.char, v / 0.72, x, y), BLACK];
  }, [R.char, R.ash], [R.crack]);
}
/** THE RIM: the earth the star threw, stones in it. */
function rimArt() {
  const n = noiseField(0x5b01, 6), fine = noiseField(0x5b02, 20), st = noiseField(0x5b03, 14);
  return painted(0x5b00, (x, y) => {
    const s = st(x, y);
    if (s > 0.74) return [ramp(R.stone, (s - 0.74) / 0.26, x, y), BLACK];
    return [ramp(R.earth, 0.6 * n(x, y) + 0.4 * fine(x, y), x, y), BLACK];
  }, [R.earth, R.stone], []);
}
/** GLASS: facets of a ramp, veined - `glow` the veins' light (and the facets' own, faint). */
function glassArt(seed, body, veinRamp, faint) {
  const facet = noiseField(seed + 1, 5), fine = noiseField(seed + 2, 16), vn = noiseField(seed + 3, 7);
  return painted(seed, (x, y) => {
    const f = Math.floor(facet(x, y) * 5) / 4;   // facets: the field in five flat steps
    const v = Math.abs(vn(x, y) - 0.5);
    const shade = Math.min(1, 0.75 * f + 0.25 * fine(x, y));
    if (v < 0.03) return [ramp(body, 1, x, y), ramp(veinRamp, 1 - v / 0.03, x, y)];
    return [ramp(body, shade, x, y), faint && f > 0.74 ? ramp(veinRamp, 0, x, y) : BLACK];
  }, [body], [veinRamp]);
}
/** THE THREAD: black, a sheen running along it. */
function threadArt() {
  return painted(0x5d00, (x, y) => [ramp(R.thread, (Math.sin((x + y * 0.25) * 0.4) + 1) / 2, x, y), BLACK], [R.thread], []);
}

let _art = null;
/**
 * THE ART: `[record, { albedo, emission }]` for each of the star's records, made once. Pure but for its cache.
 * @returns {Array<[number, { albedo: any, emission: any }]>}
 */
export function starArt() {
  _art ??= [
    [STAR_EARTH_RECORD, earthArt()],
    [STAR_RIM_RECORD, rimArt()],
    [STAR_GLASS_RECORD, glassArt(0x5c00, R.glass, R.vein, true)],
    [STAR_THREAD_RECORD, threadArt()],
    [STAR_GOLD_RECORD, glassArt(0x5e00, R.gold, R.goldGlow, true)],
    [STAR_DARK_RECORD, glassArt(0x5f00, R.dark, R.darkGlow, false)],
  ];
  return _art;
}
