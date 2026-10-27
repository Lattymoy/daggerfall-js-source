// F1: the law's sampler against the kernel's (generateSamples + blend + capitalSeaGround) on the freeware, and its cost
import { setup, imp } from '/tmp/claude-0/-home-user-daggerfall-js-source/dae0405a-f226-582d-9131-f2490d1f38e5/scratchpad/audit/F/probes/setup.mjs';
const { ground } = await setup({ maps: false });
const { rumareWaterSampler, rumareClass, TamrielWatersBake } = await imp('src/world/tamrielWatersBake.js');
const { coarseCandidateBits, fineMaskBits, WATER_THRESHOLD, PIXEL_LAND, PIXEL_SEA } = await imp('src/world/deepWater/deepWatersBake.js');
const { generateSamples } = await imp('src/world/terrain/terrainSampler.js');
const { blendLocationTerrain } = await imp('src/world/terrain/terrainTiles.js');
const { capitalSeaGround, CAPITAL_LAND } = await imp('src/world/terrain/capitalSea.js');
const { rumareSliceRect } = await imp('src/world/rumareWaters.js');
const { CAPITAL_RIM_TILES } = await imp('src/world/capitalPlans.js');
const kernel = (px, py) => { const rect = rumareSliceRect(px, py, CAPITAL_RIM_TILES); const S = generateSamples(ground, px, py), nat = Float32Array.from(S); blendLocationTerrain(S, CAPITAL_LAND, rect); capitalSeaGround(S, nat, null, rect, px, py); const water = (x, y) => S[x * 129 + y] <= WATER_THRESHOLD; return { water, quick: (x, y) => (water(x, y) ? 1 : 0), exact: water }; };
let diffV = 0, diffC = 0, diffF = 0, n = 0, classes = { land: 0, sea: 0, mixed: 0 }, classWrong = 0;
for (let py = 646; py <= 670; py++) for (let px = 2057; px <= 2081; px++) {
  const a = rumareWaterSampler(ground, px, py), b = kernel(px, py); n++;
  for (let x = 0; x < 129; x++) for (let y = 0; y < 129; y++) if (a.water(x, y) !== b.water(x, y)) diffV++;
  const ca = coarseCandidateBits(a), cb = coarseCandidateBits(b); for (let k = 0; k < 8; k++) if (ca[k] !== cb[k]) diffC++;
  const fa = fineMaskBits(a), fb = fineMaskBits(b); for (let k = 0; k < fa.length; k++) if (fa[k] !== fb[k]) diffF++;
  const c = rumareClass(px, py); classes[c === PIXEL_LAND ? 'land' : c === PIXEL_SEA ? 'sea' : 'mixed']++;
  if (c === PIXEL_LAND && fb.some((v) => v)) classWrong++;
  if (c === PIXEL_SEA && fb.some((v) => v !== 0xff)) classWrong++;
}
console.log({ pixels: n, vertexDiffs: diffV, coarseDiffs: diffC, fineDiffs: diffF, classes, classWrong });
let t = performance.now(); for (let k = 0; k < 40; k++) coarseCandidateBits(rumareWaterSampler(ground, 2060 + (k % 20), 655 + (k % 7))); console.log('law sampler coarse ms/pixel', ((performance.now() - t) / 40).toFixed(2));
const b = new TamrielWatersBake({ woods: ground });
t = performance.now(); b.seaBits(2069, 669); console.log('cell flood holding the lake ms', (performance.now() - t).toFixed(0));
t = performance.now(); for (let y = 646; y <= 670; y++) for (let x = 2057; x <= 2081; x++) b.seaBits(x, y); console.log('every other cell over the span ms', (performance.now() - t).toFixed(0));
b.evictOutside(0, 0, 4);
t = performance.now(); b.seaBits(2069, 669); console.log('after evictOutside, the cell again ms', (performance.now() - t).toFixed(0));
t = performance.now(); let f = 0; for (let y = 646; y <= 670; y++) for (let x = 2057; x <= 2081; x++) f += b.fineBits(x, y).length; console.log('fine bits of all 625 ms', (performance.now() - t).toFixed(0));
