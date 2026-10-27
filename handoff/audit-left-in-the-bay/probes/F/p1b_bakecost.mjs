import { setup, imp } from './setup.mjs';
const { ground } = await setup({ maps: false });
const { TamrielWatersBake, rumareWaterSampler } = await imp('src/world/tamrielWatersBake.js');
const { coarseCandidateBits, fineMaskBits } = await imp('src/world/deepWater/deepWatersBake.js');
const { generateSamples } = await imp('src/world/terrain/terrainSampler.js');
const { blendLocationTerrain } = await imp('src/world/terrain/terrainTiles.js');
const { capitalSeaGround, CAPITAL_LAND } = await imp('src/world/terrain/capitalSea.js');
const { rumareSliceRect, rumareSlice } = await imp('src/world/rumareWaters.js');
const { CAPITAL_RIM_TILES } = await imp('src/world/capitalPlans.js');
// warm
for (let k = 0; k < 20; k++) coarseCandidateBits(rumareWaterSampler(ground, 2060 + (k % 10), 650 + (k >> 2)));
const N = 40;
let t = performance.now(); for (let k = 0; k < N; k++) generateSamples(ground, 2060 + (k % 20), 655 + (k % 7)); const gs = (performance.now() - t) / N;
t = performance.now(); for (let k = 0; k < N; k++) { const px = 2060 + (k % 20), py = 655 + (k % 7); const S = generateSamples(ground, px, py), nat = Float32Array.from(S); blendLocationTerrain(S, CAPITAL_LAND, rumareSliceRect(px, py, CAPITAL_RIM_TILES)); capitalSeaGround(S, nat, null, rumareSliceRect(px, py, CAPITAL_RIM_TILES), px, py); } const full = (performance.now() - t) / N;
t = performance.now(); for (let k = 0; k < N; k++) coarseCandidateBits(rumareWaterSampler(ground, 2060 + (k % 20), 655 + (k % 7))); const coarse = (performance.now() - t) / N;
t = performance.now(); for (let k = 0; k < N; k++) fineMaskBits(rumareWaterSampler(ground, 2060 + (k % 20), 655 + (k % 7))); const fine = (performance.now() - t) / N;
console.log({ generateSamples_ms: gs.toFixed(2), sampler_with_capitalSea_ms: full.toFixed(2), coarse_ms: coarse.toFixed(2), fine_ms: fine.toFixed(2) });
// a fresh bake, warm JIT: the city cell flood
const b = new TamrielWatersBake({ woods: ground });
const f = b.frame, C = 32, A = 16;
const cx0 = f.x0 + Math.floor((2069 - f.x0) / C) * C, cy0 = f.y0 + Math.floor((669 - f.y0) / C) * C;
let cityIn = 0; for (let y = cy0 - A; y < cy0 + C + A; y++) for (let x = cx0 - A; x < cx0 + C + A; x++) if (rumareSlice(x, y)) cityIn++;
t = performance.now(); b.seaBits(2069, 669); console.log('warm: cell flood holding the lake ms', (performance.now() - t).toFixed(0), 'city pixels in its window', cityIn);
// all cells covering the span, whole
t = performance.now();
for (let y = 646; y <= 670; y++) for (let x = 2057; x <= 2081; x++) b.seaBits(x, y);
console.log('every other cell over the span ms', (performance.now() - t).toFixed(0));
// evict and re-ask
b.evictOutside(0, 0, 4);
t = performance.now(); b.seaBits(2069, 669); console.log('after evictOutside, the cell again ms', (performance.now() - t).toFixed(0));
