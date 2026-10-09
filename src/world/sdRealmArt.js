// @ts-check
// SD5a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S ART -
// the textures its floors wear (pseudo-archive SD_REALM_ARCHIVE, world/sdRealm.js), made here in code as the court's are
// (world/gateArt.js): nothing ships, the same pixels every boot. Each `{ albedo, emission }`, the renderer's color32 shape
// (RGBA rows), the emission its own light.
//
// SD-LOOK (2026-10-08; bible/11-Multiplayer/Super-Dungeons-Look.md section 6): REPAINTED through the Hour's paint box
// (world/sdPixelKit.js) from its ramps (world/sdLook.js SD_RAMP), in Daggerfall's own pixel art: 1-px bevels lit from the
// top-left, dark joints, ordered dither between a ramp's steps and every texel forced into the ramps at the end. Stone
// and metal are structure and do not glow - the brass joints that were the floors' neon grid (0.18 of their colour),
// the roots' gold veins (0.35) and the arena's lit cracks (0.8) are gone; brass keeps 0.04 on its rubbed edges alone.
//
//   floor  - the walk and the checkpoints: dressed basalt flags in running bond, a metre each, their joints dark
//   brass  - the rims, the kerbs, the pillars: warm metal, rubbed bright along its grain, riveted plates
//   root   - the islands' undersides, top to tip (64 x 128): the torn lip, earth and its roots, the dungeon's block
//            stone, the Numidium's works welded through the rock, the tips fading into the void's haze
//   dial   - the Orrery's floor, the Hour-dial: a disc of dark stone, twelve brass hours round its rim, a ring of six
//            segments within (each stone's, which the hall lights for every stone at its true hour - SD6)
//   arena  - the Last Moment's floor: dark bronze plates laid in rings, the quietest thing in the Hour, so its
//            telegraphs own it
//   cobble - the Threshold: the Bay's own street the Hollow swallowed, its cracks welded with brass (metal, not light)
//   edge   - the one always-lit line in the Hour: gold along the top of every edge a body could fall from
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_RAMP } from './sdLook.js';
import { rng, noiseField, image, putTexel, blendRgb, scale, ramp, step, bevel, rivet, paletteOf, quantize } from './sdPixelKit.js';

/** The tiles' side, texels (SD-LOOK: a tile is two metres - 32 texels a metre); the dial's (one image over the whole
 *  hall); the root's strip, its height (top to tip). */
export const SD_ART_SIZE = 64;
export const SD_DIAL_SIZE = 256;
export const SD_ROOT_ART_H = 128;
export const SD_BRASS = Object.freeze([196, 146, 64]);
export const SD_BRASS_BRIGHT = Object.freeze([246, 206, 120]);
export const SD_STONE = Object.freeze([34, 30, 28]);
export const SD_STONE_DARK = Object.freeze([16, 14, 14]);
/** SD-LOOK: the brass's own light on its rubbed edges, of its colour (it was 0.12 of every texel's); the gold edge line's
 *  (the ambient rung, L2). */
export const SD_BRASS_EDGE_GLOW = 0.04;
export const SD_EDGE_GLOW = 0.36;

const { basalt: B, brass: Br, cobble: Co, bronze: Bz, earth: Ea, verdigris: Vg, void: Vo } = SD_RAMP;
const black = () => image(SD_ART_SIZE);

/** The walk's and the checkpoints' floor: basalt flags a metre square (32 texels) in running bond, each bevelled, their
 *  faces quiet (the read is in the flags, never in one texel's noise), a chip or a crack here and there, joints dark. */
export function realmFloorArt(seed = 0x5d50) {
  const S = SD_ART_SIZE, albedo = image(), emission = black(), r = rng(seed);
  const tone = noiseField(seed + 1, 4), fine = noiseField(seed + 2, 16);
  const F = 32, J = 2;   // a flag's side, its joint
  const shade = Array.from({ length: 8 }, () => 0.35 + 0.3 * r());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / F), xs = x + (row % 2) * (F / 2);
    const fx = ((xs % F) + F) % F, fy = y % F, k = row * 4 + Math.floor(((xs % S) + S) % S / F);
    if (fx < J || fy < J) { putTexel(albedo, x, y, step(B, 0)); continue; }
    const t = shade[k % 8] + 0.18 * (tone(x, y) - 0.5) + 0.08 * (fine(x, y) - 0.5);
    putTexel(albedo, x, y, ramp(B, t, x, y));
  }
  // each flag's bevel: lit top-left, shadowed bottom-right (inside its joint)
  for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) {
    const x0 = c * F - (row % 2) * (F / 2) + J, y0 = row * F + J;
    bevel(albedo, x0, y0, F - J, F - J, step(B, 3), step(B, 1));
  }
  // chips and a hairline crack (4-8 texel features)
  for (let n = 0; n < 5; n++) {
    let x = Math.floor(r() * S), y = Math.floor(r() * S);
    const len = 4 + Math.floor(r() * 6), dx = r() < 0.5 ? 1 : 0;
    for (let i = 0; i < len; i++) { putTexel(albedo, x, y, step(B, 0)); x += dx || (r() < 0.5 ? 1 : 0); y += 1 - dx || (r() < 0.5 ? 1 : 0); }
  }
  quantize(albedo, paletteOf(B));
  return { albedo, emission };
}

/** Brass: rubbed along its grain (u), in riveted plates 32 texels long - its body dark, its rubbed rows bright, verdigris
 *  in the seams. Its own light only on the rubbed edge (SD_BRASS_EDGE_GLOW), so a silhouette holds where no lamp is. */
export function realmBrassArt(seed = 0x5d51) {
  const S = SD_ART_SIZE, albedo = image(), emission = black();
  const grain = noiseField(seed, 16, S, S, 2), broad = noiseField(seed + 2, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const g = 0.55 * grain(x, y) + 0.45 * broad(x, y);
    putTexel(albedo, x, y, ramp(Br, 0.2 + 0.55 * g, x, y));
  }
  for (let px = 0; px < S; px += 32) {
    for (let y = 0; y < S; y++) { putTexel(albedo, px, y, step(Br, 0)); putTexel(albedo, px + 1, y, (y % 8 < 3 ? step(Vg, 0) : step(Br, 1))); }
    for (const ry of [4, S - 5]) rivet(albedo, px + 6, ry, step(Br, 3), step(Br, 0), step(Br, 5));
  }
  // the rubbed edges, top and bottom rows of each band of 16: bright, and the only brass that glows
  for (let x = 0; x < S; x++) for (const y of [0, 16, 32, 48]) {
    putTexel(albedo, x, y, step(Br, 4)); putTexel(emission, x, y, scale(step(Br, 4), SD_BRASS_EDGE_GLOW));
    putTexel(albedo, x, y + 15, step(Br, 0));
  }
  quantize(albedo, paletteOf(Br, Vg));
  return { albedo, emission };
}

/** The islands' undersides, top (v 0) to tip (v 1): a strip 64 x SD_ROOT_ART_H, like a cake cut through - the torn lip
 *  of the floor above, a band of earth with roots, the dungeon's dark block stone in courses, the Numidium's brass works
 *  welded through the rock (gear teeth, a pipe), then the rock thinning to the void's haze at the tips, so the texture
 *  and the fog agree. Nothing glows. */
export function realmRootArt(seed = 0x5d52) {
  const W = SD_ART_SIZE, H = SD_ROOT_ART_H, albedo = image(W, H), emission = image(W, H), r = rng(seed);
  const tone = noiseField(seed, 8, W, H), wob = noiseField(seed + 3, 6, W, H);
  const LIP = 8, EARTH = 28, BLOCK = 72, WORKS = 100;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = tone(x, y), w = (wob(x, y) - 0.5) * 6, yy = y + w;
    let c;
    if (yy < LIP) c = ramp(B, 0.55 + 0.3 * n, x, y);
    else if (yy < EARTH) c = ramp(Ea, 0.25 + 0.45 * n, x, y);
    else if (yy < BLOCK) {
      const course = Math.floor((y - EARTH) / 11), bx = ((x + (course % 2) * 8) % 16 + 16) % 16, by = (y - EARTH) % 11;
      c = bx < 1 || by < 1 ? step(B, 0) : ramp(B, 0.15 + 0.35 * n, x, y);
      if (by === 1 && bx >= 1) c = step(B, 2);
    } else if (yy < WORKS) c = ramp(B, 0.05 + 0.3 * n, x, y);
    else c = blendRgb(ramp(B, 0.1 + 0.2 * n, x, y), step(Vo, 3), Math.min(1, (y - WORKS) / (H - WORKS)) * 0.5);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, [0, 0, 0]);
  }
  // the roots, wandering down through the earth
  for (let k = 0; k < 7; k++) {
    let x = r() * W;
    for (let y = LIP; y < EARTH + 6; y++) { putTexel(albedo, x, y, step(Ea, 0)); if (r() < 0.3) putTexel(albedo, x + 1, y, step(Ea, 1)); x += r() < 0.5 ? -0.6 : 0.6; }
  }
  // the works: a run of gear teeth and a pipe, brass in the rock
  const gx = Math.floor(r() * W);
  for (let i = 0; i < 40; i++) {
    const x = gx + i, toothy = Math.floor(i / 3) % 2 === 0 ? 0 : 3;
    for (let y = BLOCK + 6 + toothy; y < BLOCK + 13; y++) putTexel(albedo, x, y, step(Br, y === BLOCK + 6 + toothy ? 3 : 1));
  }
  const py = BLOCK + 18;
  for (let x = 0; x < W; x++) { putTexel(albedo, x, py, step(Br, 3)); putTexel(albedo, x, py + 1, step(Br, 2)); putTexel(albedo, x, py + 2, step(Br, 1)); putTexel(albedo, x, py + 3, step(Br, 0)); }
  quantize(albedo, paletteOf(B, Ea, Br, Vo));
  return { albedo, emission };
}

/** The Hour-dial, one image over the Orrery's hall: dark stone, quiet. SD-LOOK: its hours, its ring and its six segments
 *  are brass laid in it as geometry now (world/sdRealm.js SD_DIAL_INLAY) - painted at 7 texels a metre they were a
 *  stair-stepped orange ring; what is left is the stone under them, a faint ring of wear where the hours are walked. */
export function realmDialArt(seed = 0x5d53) {
  const S = SD_DIAL_SIZE, albedo = image(S), emission = image(S);
  const tone = noiseField(seed, 16, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = ((x + 0.5) / S) * 2 - 1, v = ((y + 0.5) / S) * 2 - 1, r = Math.hypot(u, v);
    const worn = r > 0.6 && r < 0.78 ? 0.12 : 0;
    putTexel(albedo, x, y, blendRgb(step(B, 0), step(B, 2), 0.3 + 0.55 * tone(x, y) + worn)); putTexel(emission, x, y, [0, 0, 0]);
  }
  return { albedo, emission };
}

/** The Last Moment's floor: one dark bronze plate a tile (64 texels, two metres along its ring and a band across - the
 *  arena's disc lays it in rings, world/sdRealm.js), its seams dark, riveted at the corners, an engraved minute line
 *  across its middle. The quietest thing in the Hour: telegraphs own this floor. No light of its own. */
export function realmArenaArt(seed = 0x5d54) {
  const S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seed + 1, 4), fine = noiseField(seed + 2, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (x < 2 || y < 2) { putTexel(albedo, x, y, step(Bz, 0)); continue; }
    putTexel(albedo, x, y, ramp(Bz, 0.3 + 0.35 * tone(x, y) + 0.1 * (fine(x, y) - 0.5), x, y));
  }
  bevel(albedo, 2, 2, S - 2, S - 2, step(Bz, 3), step(Bz, 0));
  for (let x = 6; x < S - 4; x++) if (x % 8 !== 0) putTexel(albedo, x, S / 2, step(Bz, 1));
  for (const [x, y] of [[6, 6], [S - 5, 6], [6, S - 5], [S - 5, S - 5]]) rivet(albedo, x, y, step(Bz, 3), step(Bz, 0), step(Bz, 4));
  quantize(albedo, paletteOf(Bz));
  return { albedo, emission };
}

/** The Threshold: the Bay's street, torn up with the Hollow - grey-brown cobbles a hand across (about 8 texels), set in
 *  dark mortar, each lit from the top-left; a crack or two through them welded shut with brass, as metal - not light. */
export function realmCobbleArt(seed = 0x5d55) {
  const S = SD_ART_SIZE, albedo = image(), emission = black(), r = rng(seed);
  const N = 8, cell = S / N;
  const seeds = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) seeds.push([(i + 0.2 + 0.6 * r()) * cell, (j + 0.2 + 0.6 * r()) * cell, 0.2 + 0.38 * r()]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = Infinity, d2 = Infinity, best = seeds[0];
    for (const s of seeds) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const d = Math.hypot(x + 0.5 - s[0] - ox, y + 0.5 - s[1] - oy);
      if (d < d1) { d2 = d1; d1 = d; best = [s[0] + ox, s[1] + oy, s[2]]; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 1.6) { putTexel(albedo, x, y, step(Co, 0)); continue; }
    const lx = (x + 0.5 - best[0]) / cell, ly = (y + 0.5 - best[1]) / cell;   // the stone's own face, lit from the top-left
    const lit = best[2] - 0.35 * (lx + ly) - (d2 - d1 < 2.6 ? 0.12 : 0);
    putTexel(albedo, x, y, ramp(Co, lit, x, y));
  }
  // the cracks, welded with brass
  for (let n = 0; n < 2; n++) {
    let x = r() * S, y = r() * S;
    const dx = r() - 0.5, len = 18 + Math.floor(r() * 14);
    for (let i = 0; i < len; i++) { putTexel(albedo, x, y, step(Br, 1)); putTexel(albedo, x + 1, y, step(Br, 0)); x += dx + (r() - 0.5) * 0.8; y += 1; }
  }
  quantize(albedo, paletteOf(Co, Br));
  return { albedo, emission };
}

/** The edge line's gold: rubbed brass, alight at the ambient rung - the one line in the Hour that is always lit, along
 *  the top of every edge a body could fall from. */
export function realmEdgeArt() {
  const S = 8, albedo = image(S), emission = image(S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = step(Br, y < 2 ? 5 : 4);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, SD_EDGE_GLOW));
  }
  return { albedo, emission };
}

/** Every texture the realm wears, by record: `[record, { albedo, emission }]` (records as world/sdRealm.js names them -
 *  SD-LOOK's two after the Remnant's, 31 and 32). */
/** @returns {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
export const realmArt = () => [
  [0, realmFloorArt()], [1, realmBrassArt()], [2, realmRootArt()], [3, realmDialArt()], [4, realmArenaArt()],
  [31, realmCobbleArt()], [32, realmEdgeArt()],
];
