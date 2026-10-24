// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SKY-KETCH'S ART - the textures the Rourken ship
// wears (pseudo-archive KT_ARCHIVE, registered in world/eliteGates/pseudoArchives.js), painted here in code through the
// Shattered Hour's paint box (world/superDungeon/sdPixelKit.js): 1-px bevels lit from the top-left, dark joints, 3x3
// rivets, an ordered dither between a ramp's steps - Daggerfall's own pixel art, the same pixels every boot.
//
// KETCH-LOOK KL2 (bible/11-Multiplayer/Sky-Ketch-Look.md section 2, "Palette" and "Materials and grain"): HER METAL IS
// DAGGERFALL'S DWARVEN, IN ITS OWN INDEX SPACE. Every texel is a step of her ramps (world/ketch/ketchLook.js KT_PAL), an
// ART_PAL index beside its colour (sdPixelKit quantizeIndexed): each record is `{ albedo, emission, index }`, drawn in the
// port's fallback colours and resolved through the player's own palette at upload (resolveKetchArt). The grain is
// Daggerfall's (TEXTURE.155's riveted iron, TEXTURE.371's gold): big bevelled panels framed by 2-px strips with rivets,
// their faces mottled in blotches four to eight texels across - never the single-texel noise that read as cloth from 5 m.
// The Hour's orange brass leaves her: her trim, rails and plate are the Dwarven band every Dwarven blade and cuirass in the
// Iliac Bay is worn in (characters/dyes.js METAL_TABLES.Dwarven).
//
//   deck   Dwemer steel plate, a metre across and two long in courses along the keel, joints staggered, each plate
//          framed in Dwarven strip and riveted; a quiet tread - the darker metal, so a telegraph owns the floor
//   hull   Dwarven plate in courses a metre tall and two long, lapped (a shadow under each lap), riveted along the
//          laps, butt joints staggered a plate apart; verdigris weeping below the laps
//   brass  the rails, posts and trim: Dwarven, its top edge rubbed bright, banded and riveted
//   iron   the machinery: Dwemer steel in bolted panels a metre square
//   inner  the hold's walls from within: the plates' backs, a Dwarven stringer every metre - no outside wall's laps
//   copper the pipes and coils, banded in Dwarven, verdigris at every band
//   grate  steel grating over a black gap
//   aether / ember   the two lights a cell and a resonator burn with
//   vane   a sail-vane: Dwarven leaf, pierced (its holes cut out), ribs fanning from its foot
//   gilt   gold leaf, engraved - the helm, the cabin, the Ketchmaster's hold
//   stone  Dwemer dressed stone, warm sand ashlar a metre by half a metre, a Dwarven string course every metre
//   edge   the always-lit gold line (the Hour's own, in her lamp's ramp)
//   gear   a gear's face: the engine's drum, the helm's wheel
//   ground the Iliac Bay's fields far below the keel (256 x 256): fields, hedges, a road, a river - where no data stands
//   cloud / steam   puffs, with alpha
//   arc0-3 an arc-coil's lightning, four frames
//   lamp   a lamp's glass
//   chain  the anchor chain and the rigging's links
//   net    the rigging nets - Dwarven cord in its darker steps, a diamond a cell (KT_NET_M), knotted, its holes cut out
//          (alpha 0: the mesh shader's cutout), so the sky shows through and the deck reads rigging, not a fence
//   glass  a port's glass, lit from within (the hull's portholes, the superstructure's windows)
//
// Not a DFU member. Ledger A (KETCH).
import { rng, noiseField, image, putTexel, ramp, step, bevel, rivet, scale, quantizeIndexed } from '../superDungeon/sdPixelKit.js';
import { realmEdgeArt } from '../superDungeon/sdRealmArt.js';
import { KT_PAL } from './ketchLook.js';

/** The Ketch's pseudo-archive (world/eliteGates/pseudoArchives.js holds it taken). */
export const KT_ARCHIVE = 38311;
/** Each picture's record under it. */
export const KT_REC = Object.freeze({
  deck: 0, hull: 1, brass: 2, iron: 3, copper: 4, grate: 5, aether: 6, ember: 7, vane: 8, gilt: 9, stone: 10, edge: 11, gear: 12,
  ground: 13, cloud: 14, steam: 15, arc0: 16, arc1: 17, arc2: 18, arc3: 19, lamp: 20, chain: 21, net: 22, glass: 23, inner: 24,
});
/** The tiles' side (texels - 32 a metre, the Hour's density: a tile is two metres), the ground's and the puffs'. */
export const KT_ART_SIZE = 64;
export const KT_GROUND_SIZE = 256;
export const KT_PUFF_SIZE = 64;
/** The net's cell (m): one picture a diamond, 1.5 m across - the 1 m mesh read as a chain-link fence (KETCH-LOOK KL2). */
export const KT_NET_M = 1.5;
/** How strongly the lit things burn (a share of their own colour): the aether and the ember whole, a lamp's glass, the
 *  arc; a rubbed metal edge at most `rubbed` (realmBrassArt's rule - structure stays on its rung). */
export const KT_GLOW = Object.freeze({ aether: 0.95, ember: 0.9, lamp: 0.85, arc: 1, rubbed: 0.04 });

const P = KT_PAL, F = (r) => r.fallback;
const Dw = F(P.dwarven), St = F(P.steel), Cu = F(P.copper), Vg = F(P.verdigris), Sn = F(P.stone);
const S = KT_ART_SIZE;
const black = (W = S, H = W) => image(W, H);
/** The mottle: blotches about six texels across (Daggerfall's grain), and the broad tone a plate wears under it. */
const mottle = (seed) => noiseField(seed, 10);
/** A record: its picture quantized to `ramps`' steps, the index image beside it. */
const rec = (albedo, emission, ramps) => ({ albedo, emission, index: quantizeIndexed(albedo, ramps) });

/** The decks: Dwemer steel plate a metre across (u) and two long (v), in two courses a tile, the second staggered a plate's
 *  half; each plate framed by its dark joint and a Dwarven strip, riveted every 16 texels along its long sides (dark
 *  heads, no glint), bevelled inside its frame, its face mottled and a quiet tread across it. Its lightest texel the
 *  steel's step 3 (the bevel's lit edge, the tread's crests half the shadows' depth): her noon sun put step 4 at the
 *  floor's p95 over the ladder's 0.30 (KETCH-LOOK KL2, measured 0.31-0.32 on every open deck). */
export function ketchDeckArt(seed = 0x6b01) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 3), mot = mottle(seed + 1), r = rng(seed + 2);
  const W = 32, L = 64, shade = Array.from({ length: 4 }, () => 0.24 + 0.12 * r());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const col = Math.floor(x / W), vv = (y + col * (L / 2)) % L, u = x % W, k = col * 2 + (Math.floor((y + col * (L / 2)) / L) % 2);
    if (u < 2 || vv < 2) { putTexel(albedo, x, y, u === 0 || vv === 0 ? step(St, 0) : step(Dw, 0)); continue; }   // the joint, then its Dwarven strip - dark, so the plates read and not a grid
    let t = shade[k] + 0.12 * (mot(x, y) - 0.5) + 0.06 * (tone(x, y) - 0.5);
    const du = (u + vv) % 6, dv = (u - vv + 60) % 6;
    if (du === 0 || dv === 0) t += 0.02; else if (du === 1 || dv === 1) t -= 0.04;
    putTexel(albedo, x, y, ramp(St, t, x, y));
  }
  for (let col = 0; col < 2; col++) for (let s = 0; s < 2; s++) {
    const x0 = col * W, y0 = ((s * L - col * (L / 2)) % S + S) % S;
    for (let j = 0; j < L; j++) {
      const y = (y0 + j) % S;
      if (j > 2) { putTexel(albedo, x0 + 2, y, step(St, 3)); putTexel(albedo, x0 + W - 1, y, step(St, 1)); }
      if (j % 16 === 8) for (const xx of [x0 + 5, x0 + W - 4]) rivet(albedo, xx, y, step(Dw, 1), step(St, 0), step(Dw, 2));
    }
    for (let i = 3; i < W - 1; i++) putTexel(albedo, x0 + i, (y0 + 2) % S, step(St, 3));
  }
  return rec(albedo, emission, [P.steel, P.dwarven]);
}

/** The hull: Dwarven plate in courses a metre tall (32 texels) and two long (the tile), the second course's butt joint a
 *  plate's half along; each course laps the one under it - its top row lit and rubbed, a 2-px shadow along the foot of the
 *  course above - riveted along every lap every 8 texels; verdigris weeping in runs below the laps. */
export function ketchHullArt(seed = 0x6b02) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 3), mot = mottle(seed + 1), run = noiseField(seed + 2, 32, S, S, 2);
  const H = 32;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const course = Math.floor(y / H), v = y % H, butt = (x + course * (S / 2)) % S;
    const weep = run(x, y) > 0.7 && v > 2 && v < 16;
    let c;
    if (v >= H - 2) c = step(Dw, 0);                                     // the shadow under the lap above
    else if (v === 0) c = step(Dw, 5);                                   // the lap's lit edge
    else if (butt === 0) c = step(Dw, 1);                                // a butt joint
    else if (weep) c = ramp(Vg, 0.35 + 0.25 * (mot(x, y) - 0.5) + 0.25 * (1 - v / 16), x, y);
    else c = ramp(Dw, 0.4 + 0.16 * (mot(x, y) - 0.5) + 0.08 * (tone(x, y) - 0.5) - (v > H - 6 ? 0.08 : 0), x, y);
    putTexel(albedo, x, y, c);
    if (v === 0) putTexel(emission, x, y, scale(c, KT_GLOW.rubbed));
  }
  for (let course = 0; course < 2; course++) for (let x = 4; x < S; x += 8) rivet(albedo, x, course * H + 3, step(Dw, 4), step(Dw, 0), step(Dw, 4));
  return rec(albedo, emission, [P.dwarven, P.verdigris]);
}

/** The rails, posts and trim: Dwarven, its top edge rubbed (the worn step), a dark seam at its foot, banded every 16
 *  texels and riveted at each band; its face mottled. */
export function ketchBrassArt(seed = 0x6b05) {
  const albedo = image(), emission = black(), mot = mottle(seed), R1 = F(P.rubbed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const band = x % 16 < 2;
    let c;
    if (y < 3) c = y === 0 ? R1[0] : step(Dw, 4);
    else if (y > S - 3) c = step(Dw, 0);
    else if (band) c = step(Dw, x % 16 === 0 ? 1 : 3);
    else c = ramp(Dw, 0.4 + 0.14 * (mot(x, y) - 0.5), x, y);
    putTexel(albedo, x, y, c);
    if (y === 0) putTexel(emission, x, y, scale(c, KT_GLOW.rubbed));
  }
  for (let x = 8; x < S; x += 16) for (const y of [6, S - 7]) rivet(albedo, x, y, step(Dw, 3), step(Dw, 0), step(Dw, 4));
  return rec(albedo, emission, [P.dwarven, P.rubbed]);
}

/** The machinery: Dwemer steel in bolted panels a metre square - each framed and bevelled from the top-left, a bolt at its
 *  corners and its middles, its face mottled; a little oil (rust) weeping below the lower bolts. */
export function ketchIronArt(seed = 0x6b03) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 3), mot = mottle(seed + 1), oil = noiseField(seed + 2, 16, S, S, 2);
  const Ru = F(P.rust);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x % 32, v = y % 32;
    const weep = v > 26 && oil(x, y) > 0.72;
    putTexel(albedo, x, y, weep ? ramp(Ru, 0.5 + 0.3 * (mot(x, y) - 0.5), x, y) : ramp(St, 0.5 + 0.16 * (mot(x, y) - 0.5) + 0.08 * (tone(x, y) - 0.5), x, y));
    if (u === 0 || v === 0) putTexel(albedo, x, y, step(St, 1));
  }
  for (let py = 0; py < S; py += 32) for (let px = 0; px < S; px += 32) {
    bevel(albedo, px + 1, py + 1, 31, 31, step(St, 6), step(St, 2));
    for (const [cx, cy] of [[5, 5], [26, 5], [5, 26], [26, 26], [16, 5], [16, 26]]) rivet(albedo, px + cx, py + cy, step(St, 6), step(St, 1), step(St, 7));
  }
  return rec(albedo, emission, [P.steel, P.rust]);
}

/** The hold's walls from within: the plates' backs - steel panels two metres by a metre, a stiffener's shadow down each
 *  one's middle - under a Dwarven stringer every metre (4 texels, riveted). No lap of the outside's: from within, a hull
 *  is its frames and its plates' backs, never the strakes that read as shelves in the dark. */
export function ketchInnerArt(seed = 0x6b11) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 3), mot = mottle(seed + 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y % 32;
    let c;
    if (v < 4) c = step(Dw, v === 0 ? 4 : v === 3 ? 0 : 2);
    else if (x % 64 === 0) c = step(St, 1);
    else c = ramp(St, 0.46 + 0.14 * (mot(x, y) - 0.5) + 0.1 * (tone(x, y) - 0.5) - (Math.abs((x % 64) - 32) < 1 ? 0.12 : 0), x, y);
    putTexel(albedo, x, y, c);
  }
  for (let py = 0; py < S; py += 32) for (let x = 6; x < S; x += 12) rivet(albedo, x, py + 2, step(Dw, 4), step(Dw, 0), step(Dw, 4));
  return rec(albedo, emission, [P.steel, P.dwarven]);
}

/** The pipes and coils: copper, its grain along the pipe (u), lit along its crown across v; a Dwarven band every 16
 *  texels with verdigris creeping from it. */
export function ketchCopperArt(seed = 0x6b04) {
  const albedo = image(), emission = black(), grain = noiseField(seed, 4, S, S, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y / S, round = 0.5 + 0.5 * Math.sin(v * Math.PI * 2);   // the pipe's roundness across v: its lit crown
    putTexel(albedo, x, y, ramp(Cu, 0.2 + 0.5 * round + 0.12 * (grain(x, y) - 0.5), x, y));
  }
  for (let x = 0; x < S; x += 16) for (let y = 0; y < S; y++) {
    putTexel(albedo, x, y, step(Dw, 4)); putTexel(albedo, x + 1, y, step(Dw, 2)); putTexel(albedo, x + 2, y, y % 6 < 2 ? step(Vg, 2) : step(Dw, 0));
  }
  return rec(albedo, emission, [P.copper, P.dwarven, P.verdigris]);
}

/** Steel grating: bars 3 texels wide on an 8-texel lattice over a black gap, each bar lit on its top-left. */
export function ketchGrateArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x % 8, v = y % 8, bar = u < 3 || v < 3;
    putTexel(albedo, x, y, bar ? step(St, u === 0 || v === 0 ? 5 : u === 2 || v === 2 ? 2 : 4) : step(St, 0));
  }
  return rec(albedo, emission, [P.steel]);
}

/** A glass of light (`L` its ramp): its heart bright, swirling bands round it, its rim dark - lit with its own colour, a
 *  share `glow` of it. The aether a cell and a true resonator burn with; the ember of one put out of tune. */
function lightGlassArt(L, glow, seed) {
  const albedo = image(), emission = black(), swirl = noiseField(seed, 6), C = F(L);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), d = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const band = 0.5 + 0.5 * Math.sin(a * 3 + d * 9 + 6 * swirl(x, y));
    const t = Math.max(0, Math.min(1, 1 - d * 0.85 + 0.25 * (band - 0.5)));
    const c = ramp(C, t, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, glow * (0.35 + 0.65 * t)));
  }
  return rec(albedo, emission, [L]);
}
export const ketchAetherArt = () => lightGlassArt(P.aether, KT_GLOW.aether, 0x6b06);
export const ketchEmberArt = () => lightGlassArt(P.ember, KT_GLOW.ember, 0x6b07);

/** A sail-vane: pierced Dwarven leaf - ribs fanning from the vane's foot (v 1), the leaf between them mottled and pierced
 *  in rows of holes (alpha 0, cut out: the sky through them), its foot a riveted band. */
export function ketchVaneArt(seed = 0x6b08) {
  const albedo = image(), emission = black(), mot = mottle(seed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = Math.atan2(x - S / 2, S - y), f = (((a * 8) / Math.PI) % 1 + 1) % 1, rib = f < 0.12 || f > 0.94;
    const hx = x % 8 - 3.5, hy = y % 8 - 3.5, hole = !rib && y > 6 && y < S - 4 && hx * hx + hy * hy < 2.6;
    if (hole) { putTexel(albedo, x, y, step(Dw, 0), 0); continue; }
    putTexel(albedo, x, y, rib ? step(Dw, y > S - 8 ? 4 : 5) : ramp(Dw, 0.38 + 0.18 * (mot(x, y) - 0.5), x, y));
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(Dw, 6)); putTexel(albedo, x, 1, step(Dw, 4)); putTexel(albedo, x, 2, step(Dw, 1)); }
  return rec(albedo, emission, [P.dwarven]);
}

/** Gold leaf, engraved: the gilt worked in a scroll of lines every 16 texels, its edges rubbed bright and faintly alight. */
export function ketchGiltArt(seed = 0x6b09) {
  const albedo = image(), emission = black(), mot = mottle(seed), G = F(P.gilt);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const scroll = Math.abs(Math.sin((x / 16) * Math.PI) * 6 - (y % 16) + 8) < 1;
    putTexel(albedo, x, y, scroll ? step(G, 1) : ramp(G, 0.55 + 0.3 * (mot(x, y) - 0.5), x, y));
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(G, 5)); putTexel(emission, x, 0, scale(step(G, 5), 0.06)); putTexel(albedo, x, S - 1, step(G, 0)); }
  return rec(albedo, emission, [P.gilt]);
}

/** Dwemer dressed stone: warm sand ashlar a metre by half a metre in courses (each block bevelled from the top-left, its
 *  face mottled), a Dwarven string course along the top of every second course - one a metre. */
export function ketchStoneArt(seed = 0x6b0a) {
  const albedo = image(), emission = black(), r = rng(seed), mot = mottle(seed + 1);
  const W = 32, H = 16, J = 2, shade = Array.from({ length: 16 }, () => 0.36 + 0.24 * r());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / H), xs = x + (row % 2) * (W / 2), bx = ((xs % W) + W) % W, by = y % H, k = row * 2 + Math.floor((((xs % S) + S) % S) / W);
    if (by < J && row % 2 === 0) { putTexel(albedo, x, y, step(Dw, by === 0 ? 5 : 2)); continue; }
    if (bx < J || by < J) { putTexel(albedo, x, y, step(Sn, 0)); continue; }
    putTexel(albedo, x, y, ramp(Sn, shade[k % 16] + 0.12 * (mot(x, y) - 0.5), x, y));
  }
  for (let row = 0; row < S / H; row++) for (let c = 0; c < 3; c++) bevel(albedo, c * W - (row % 2) * (W / 2) + J, row * H + J, W - J, H - J, step(Sn, 5), step(Sn, 1));
  return rec(albedo, emission, [P.stone, P.dwarven]);
}

/** The always-lit gold line along every edge a body could fall from: the Hour's own (world/superDungeon/sdRealmArt.js
 *  realmEdgeArt), in her lamp's ramp. */
export function ketchEdgeArt() {
  const { albedo, emission } = realmEdgeArt();
  return rec(albedo, emission, [P.lamp]);
}

/** A gear's face: its hub and spokes in steel, its rim and teeth Dwarven, rings of rivets - the engine's drum, the helm's
 *  wheel. One picture over the whole disc (u, v 0..1 across it). */
export function ketchGearArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5 - S / 2) / (S / 2), dy = (y + 0.5 - S / 2) / (S / 2), d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const spoke = Math.abs(Math.sin(a * 3)) < 0.18, tooth = d > 0.86 && Math.sin(a * 24) > 0;
    const c = d > 1 ? step(St, 0) : tooth ? step(Dw, 4) : d > 0.78 ? step(Dw, 2) : d < 0.2 ? step(Dw, 5) : spoke ? step(St, 5) : step(St, 2);
    putTexel(albedo, x, y, c);
  }
  return rec(albedo, emission, [P.steel, P.dwarven]);
}

/** THE LAND BELOW where no data stands - the fields outside Daggerfall as a hawk sees them from the Ketch's height: patched
 *  fields and meadow in their greens and ploughed soil, hedgerows between them, a road and a river across, the patches'
 *  pattern tiling at its edges. Matte: the frame's light and the fog over it. */
export function ketchGroundArt(seed = 0x6b0d) {
  const G = 256, albedo = image(G), emission = black(G), r = rng(seed), Fd = F(P.field), Md = F(P.meadow), Sl = F(P.soil), Wt = F(P.water);
  const tone = noiseField(seed + 1, 16, G, G), cell = 32;
  const plots = Array.from({ length: (G / cell) * (G / cell) }, () => { const k = r(); return { L: k < 0.4 ? Fd : k < 0.66 ? Md : Sl, t: 0.3 + 0.45 * r(), furrow: r() < 0.5 }; });
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const p = plots[Math.floor(y / cell) * (G / cell) + Math.floor(x / cell)], u = x % cell, v = y % cell;
    const hedge = u < 1 || v < 1, furrow = p.L === Sl && (p.furrow ? x : y) % 4 === 0;
    putTexel(albedo, x, y, hedge ? step(Fd, 1) : ramp(p.L, p.t + 0.12 * (tone(x, y) - 0.5) - (furrow ? 0.12 : 0), x, y));
  }
  // a road and a river across the tile, each wrapping at its edges so the tiles meet
  for (let x = 0; x < G; x++) {
    const ry = Math.round(G * 0.3 + 10 * Math.sin((x / G) * Math.PI * 2)), wy = Math.round(G * 0.72 + 18 * Math.sin((x / G) * Math.PI * 4 + 1));
    for (let k = -1; k <= 1; k++) putTexel(albedo, x, ry + k, step(Sl, 3));
    for (let k = -3; k <= 3; k++) putTexel(albedo, x, wy + k, step(Wt, Math.abs(k) > 2 ? 0 : Math.abs(k) > 0 ? 2 : 4));
  }
  return rec(albedo, emission, [P.field, P.meadow, P.soil, P.water]);
}

/** A puff (a cloud's or the steam's): white in the cloud's ramps, round and lumpy, its alpha falling off to its rim - a
 *  billboard's picture. The steam's shadow leans blue-grey. */
function puffArt(seed, steam = false) {
  const N = KT_PUFF_SIZE, albedo = image(N), emission = black(N), lump = noiseField(seed, 6, N, N), fine = noiseField(seed + 1, 10, N, N);
  const C = F(P.cloud), B = F(P.cloudBlue);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5 - N / 2) / (N / 2), dy = (y + 0.5 - N / 2) / (N / 2), d = Math.hypot(dx, dy * 1.15);
    const edge = 0.62 + 0.32 * lump(x, y);
    if (d > edge) { putTexel(albedo, x, y, step(C, 0), 0); continue; }
    const t = 0.35 + 0.55 * (1 - dy) / 2 + 0.15 * (fine(x, y) - 0.5);   // lit from above
    putTexel(albedo, x, y, steam && t < 0.5 ? ramp(B, t * 1.6, x, y) : ramp(C, t, x, y), d > edge - 0.12 ? 128 : 255);
  }
  return rec(albedo, emission, [P.cloud, P.cloudBlue]);
}
export const ketchCloudArt = () => puffArt(0x6b0e);
export const ketchSteamArt = () => puffArt(0x6b0f, true);

/** AN ARC-COIL'S LIGHTNING, frame `k` of four: a jagged bolt along u across the picture, its core white and its glow the
 *  aether's, each frame its own path - on black, so its quad adds nothing but the light it gives. */
export function ketchArcArt(k) {
  const albedo = image(), emission = black(), r = rng(0x6b10 + k), A = F(P.aether);
  let yy = S / 2;
  for (let x = 0; x < S; x++) {
    yy = Math.max(10, Math.min(S - 10, yy + (r() - 0.5) * 7));
    for (let dy = -4; dy <= 4; dy++) {
      const a = Math.abs(dy), c = a === 0 ? step(A, 6) : a < 2 ? step(A, 5) : step(A, 2);
      if (a > 3 && r() < 0.5) continue;
      putTexel(albedo, x, yy + dy, c); putTexel(emission, x, yy + dy, scale(c, KT_GLOW.arc * (a === 0 ? 1 : a < 2 ? 0.8 : 0.4)));
    }
  }
  return rec(albedo, emission, [P.aether, P.steel]);
}

/** A lamp's glass: warm lamplight, brightest at its heart. */
export function ketchLampArt() {
  const L = F(P.lamp), albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.min(1, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2)), c = ramp(L, 1 - 0.7 * d, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, KT_GLOW.lamp * (1 - 0.5 * d)));
  }
  return rec(albedo, emission, [P.lamp]);
}

/** The anchor chain's and the rigging's links: steel ovals along v, every other one turned edge-on (a bar). */
export function ketchChainArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y % 16, link = Math.floor(y / 16) % 2, u = Math.abs(x - S / 2);
    const on = link === 0 ? Math.abs(Math.hypot(u / 1.6, v - 8) - 6) < 2 : u < 4;
    putTexel(albedo, x, y, on ? step(St, v < 6 ? 5 : 3) : step(St, 0));
  }
  return rec(albedo, emission, [P.steel]);
}

/** The rigging nets: Dwarven cord in its darker steps - one diamond a picture (KT_NET_M across), a cord two texels thick
 *  lit on its upper-left, a 3x3 knot at every crossing; every hole transparent (alpha 0 - a cutout), so the deck's view of
 *  the sky is the net's own and the cord reads under the sky, not as bright as it. */
export function ketchNetArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + y) % S, v = (x - y + S) % S, cord = u < 2 || v < 2, knot = (u < 3 || u > S - 2) && (v < 3 || v > S - 2);
    if (!cord && !knot) { putTexel(albedo, x, y, step(Dw, 0), 0); continue; }
    putTexel(albedo, x, y, knot ? step(Dw, 1) : u === 0 || v === 0 ? step(Dw, 3) : step(Dw, 2));
  }
  return rec(albedo, emission, [P.dwarven]);
}

/** A port's glass: lamplight behind leaded panes, its frame Dwarven, its leads steel - lit with its own light. */
export function ketchGlassArt() {
  const albedo = image(), emission = black(), L = F(P.lamp);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lead = x % 16 < 2 || y % 16 < 2, rim = x < 3 || y < 3 || x > S - 4 || y > S - 4;
    const c = rim ? step(Dw, 3) : lead ? step(St, 1) : ramp(L, 0.6 + 0.3 * Math.sin((x + y) * 0.2), x, y);
    putTexel(albedo, x, y, c); if (!rim && !lead) putTexel(emission, x, y, scale(c, KT_GLOW.lamp * 0.7));
  }
  return rec(albedo, emission, [P.lamp, P.dwarven, P.steel]);
}

/** EVERY TEXTURE THE KETCH WEARS, by record: `[record, { albedo, emission, index }]` - the index image ART_PAL's. */
/** @returns {Array<[number, { albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img, index: Uint8Array }]>} */
export const ketchArt = () => [
  [KT_REC.deck, ketchDeckArt()], [KT_REC.hull, ketchHullArt()], [KT_REC.brass, ketchBrassArt()], [KT_REC.iron, ketchIronArt()],
  [KT_REC.copper, ketchCopperArt()], [KT_REC.grate, ketchGrateArt()], [KT_REC.aether, ketchAetherArt()], [KT_REC.ember, ketchEmberArt()],
  [KT_REC.vane, ketchVaneArt()], [KT_REC.gilt, ketchGiltArt()], [KT_REC.stone, ketchStoneArt()], [KT_REC.edge, ketchEdgeArt()],
  [KT_REC.gear, ketchGearArt()], [KT_REC.ground, ketchGroundArt()], [KT_REC.cloud, ketchCloudArt()], [KT_REC.steam, ketchSteamArt()],
  [KT_REC.arc0, ketchArcArt(0)], [KT_REC.arc1, ketchArcArt(1)], [KT_REC.arc2, ketchArcArt(2)], [KT_REC.arc3, ketchArcArt(3)],
  [KT_REC.lamp, ketchLampArt()], [KT_REC.chain, ketchChainArt()], [KT_REC.net, ketchNetArt()], [KT_REC.glass, ketchGlassArt()],
  [KT_REC.inner, ketchInnerArt()],
];
/** The records drawn as billboards (their alpha their own). */
export const KT_PUFF_RECORDS = Object.freeze([KT_REC.cloud, KT_REC.steam]);

/**
 * A RECORD THROUGH THE PLAYER'S PALETTE: its albedo's every texel the palette's colour at its index (alpha kept), its
 * emission each channel the same share of its new colour as of its fallback (a lit texel is its colour times its glow) -
 * written into fresh pictures; `rgb` the palette's 256 colours (768 bytes, formats/dfPalette.js's). With no palette the
 * record as it stands (its fallback colours). Pure.
 * @param {{ albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img, index: Uint8Array }} art
 * @param {ArrayLike<number> | null} rgb
 */
export function resolveKetchArt(art, rgb) {
  if (!rgb || !art.index) return art;
  const a = art.albedo.colors, e = art.emission.colors, n = art.index.length;
  const albedo = image(art.albedo.width, art.albedo.height), emission = image(art.emission.width, art.emission.height);
  for (let t = 0, j = 0; t < n; t++, j += 4) {
    const i = art.index[t] * 3;
    for (let k = 0; k < 3; k++) {
      const was = a[j + k], now = rgb[i + k];
      albedo.colors[j + k] = now;
      emission.colors[j + k] = was > 0 ? Math.min(255, Math.round((e[j + k] * now) / was)) : 0;
    }
    albedo.colors[j + 3] = a[j + 3]; emission.colors[j + 3] = e[j + 3];
  }
  return { albedo, emission, index: art.index };
}
