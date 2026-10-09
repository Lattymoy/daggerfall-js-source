// @ts-check
// SD-LOOK S7 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 9): THE ARENA'S PILLARS, DRESSED - square
// clock-tower columns of dark basalt banded in brass, the arena's four (net/sdBrain.js SD_PILLAR_R on the diagonals),
// every face of them INSIDE THE LAW'S SQUARE (world/sdRealm.js pillarQuads - the collider and the Hour-Hand's shade,
// net/sdRemnant.js behindPillar; "no visual larger than the law"): a plinth flush with it, a chamfered shaft in from it
// with three brass bands and a conduit in each chamfer, a brass collar and a stepped capital, the CLOCK STAGE - a small
// clock on each face, its hand watching the Remnant (render/sdPillarPass.js draws the dials and the hands) - a brass
// cornice, the LANTERN - a brass cage open on every side, turned a quarter of a right angle so no bar stands between its
// flame (the pass's) and the arena's heart, the pillar's diagonal - carrying the brass hood and cap, flat at the square's
// own top, where a body standing on it stands.
//
// No collider: the square is the pillar's to the law (world/sdRealm.js realmPillarTris), and nothing here is on it.
// No light: the lantern is a light to see, not a light that lights - the Hour's light list keeps its count (the arena's
// eight rim lamps, world/sdRealm.js SD_LAMPS; pinned).
//
// Pure: `pillarVisual` lays one pillar into a faces() build (world/gateModel.js) in the dungeon's frame; `sdPillarDials`
// and `sdLanterns` say where the pass draws. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ARENA, SD_PILLAR_R, SD_PILLAR_W, SD_PILLAR_H, realmToDungeon } from '../net/sdBrain.js';

/** THE PILLAR'S PROFILE (metres; `w` a half-width from its centre, every one within SD_PILLAR_W / 2): the plinth flush
 *  with the square, the shaft in from it with its chamfers, the brass bands, the collar, the capital's step, the clock
 *  stage, the cornice, the lantern stage and its posts, the cap - flat at SD_PILLAR_H across the whole square. */
export const SD_PILLAR_LOOK = Object.freeze({
  plinth: Object.freeze({ y1: 0.45, w: SD_PILLAR_W / 2 }),
  plinthBand: Object.freeze({ y1: 0.58, w: SD_PILLAR_W / 2 - 0.02 }),
  shaft: Object.freeze({ y1: 10.0, w: 0.68, chamfer: 0.14 }),
  bands: Object.freeze([3.4, 6.5, 9.4]), band: Object.freeze({ h: 0.2, w: 0.73 }),
  conduit: Object.freeze({ at: 0.64, r: 0.045, sides: 6 }),
  collar: Object.freeze({ y1: 10.2, w: 0.74 }),
  step: Object.freeze({ y1: 10.4, w: 0.78 }),
  clock: Object.freeze({ y1: 12.2, w: 0.78 }),
  cornice: Object.freeze({ y1: 12.35, w: SD_PILLAR_W / 2 }),
  lantern: Object.freeze({ y1: 13.5, stem: 0.12 }),
  roof: Object.freeze({ y1: 13.75, w: SD_PILLAR_W / 2 - 0.02 }),
  cap: Object.freeze({ y1: SD_PILLAR_H, w: SD_PILLAR_W / 2 }),
});
/** THE DIALS on the clock stage's four faces: their centre's height, their radius, and how far out of the stage's face
 *  the pass lays them (inside the square still). */
export const SD_PILLAR_DIAL = Object.freeze({ y: 11.3, r: 0.66, lift: 0.01 });
/** THE LANTERN on the cornice: its cage's reach from its centre to a bar (a diamond to the square - its bars on the
 *  faces' middles, off every diagonal), its foot and its top, its bars' half-width, its plates' depth; its flame's
 *  centre (the pass's). */
export const SD_LANTERN = Object.freeze({ w: 0.3, y0: 12.43, y1: 13.3, bar: 0.025, plate: 0.08, flameY: 12.86 });

/** Pillar `k`'s centre in the realm's frame (pillarQuads' and net/sdRemnant.js SD_PILLARS'). */
export function pillarCentre(k) {
  const a = Math.PI / 4 + (k * Math.PI) / 2;
  return [SD_ARENA.x + Math.cos(a) * SD_PILLAR_R, SD_ARENA.z + Math.sin(a) * SD_PILLAR_R];
}
/** A square of half-width `w`, its corners in the order whose sides face out (pillarQuads' own). */
const square = (w) => [[-w, -w], [w, -w], [w, w], [-w, w]];
/** A square of half-width `w` with its corners cut `c` (an octagon), the same order. */
const chamfered = (w, c) => [[-w + c, -w], [w - c, -w], [w, -w + c], [w, w - c], [w - c, w], [-w + c, w], [-w, w - c], [-w, -w + c]];
/** A square of half-diagonal `w` turned a quarter of a right angle (a diamond, its corners on the axes), the same order. */
const diamond = (w) => [[0, -w], [w, 0], [0, w], [-w, 0]];

/**
 * A PRISM about (px, pz) (the realm's frame): the polygon `P` (offsets, the order whose sides face out) from y0 to y1 -
 * its sides, its top and (a part proud of what it stands on is seen from under) its underside; uv metres over `tile`
 * (u along each side, v down the height, so the picture's top row is up). Into faces() `f` in the dungeon's frame.
 */
function prism(f, rec, px, pz, P, y0, y1, { tile = 2, top = true, under = true } = {}) {
  const C = (o, y) => realmToDungeon(px + o[0], y, pz + o[1]);
  let u = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    f.quad(rec, C(a, y0), C(a, y1), C(b, y1), C(b, y0), [u / tile, -y0 / tile], [u / tile, -y1 / tile], [(u + len) / tile, -y1 / tile], [(u + len) / tile, -y0 / tile]);
    u += len;
  }
  const c = [0, 0], cu = (o) => [0.5 + o[0] / tile, 0.5 + o[1] / tile];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    if (top) f.tri(rec, C(c, y1), C(b, y1), C(a, y1), cu(c), cu(b), cu(a));
    if (under) f.tri(rec, C(c, y0), C(a, y0), C(b, y0), cu(c), cu(a), cu(b));
  }
}
/** A conduit: a pipe of `sides` sides, radius r, about (px + ox, pz + oz) from y0 to y1 - its sides alone. */
function pipe(f, rec, px, pz, ox, oz, r, sides, y0, y1) {
  const P = [];
  for (let i = 0; i < sides; i++) { const a = (-i / sides) * Math.PI * 2; P.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]); }
  // the order whose sides face out, as pillarQuads' square runs: a side a -> b faces (b.z - a.z, a.x - b.x)
  const [a, b] = [P[0], P[1]], mx = (a[0] + b[0]) / 2 - ox, mz = (a[1] + b[1]) / 2 - oz;
  if ((b[1] - a[1]) * mx + (a[0] - b[0]) * mz < 0) P.reverse();
  prism(f, rec, px, pz, P, y0, y1, { tile: 1, top: false, under: false });
}

/**
 * PILLAR `k` DRESSED, into faces() `f` (the dungeon's frame): `rec.stone` its basalt, `rec.brass` its brass. Every vertex
 * inside its square (|dx|, |dz| <= SD_PILLAR_W / 2) from the floor to SD_PILLAR_H.
 * @param {ReturnType<typeof import('./gateModel.js').faces>} f @param {number} k @param {{ stone: number, brass: number }} rec
 */
export function pillarVisual(f, k, rec) {
  const L = SD_PILLAR_LOOK, [px, pz] = pillarCentre(k);
  prism(f, rec.stone, px, pz, square(L.plinth.w), 0, L.plinth.y1, { under: false });
  prism(f, rec.brass, px, pz, square(L.plinthBand.w), L.plinth.y1, L.plinthBand.y1, { under: false });
  prism(f, rec.stone, px, pz, chamfered(L.shaft.w, L.shaft.chamfer), L.plinthBand.y1, L.shaft.y1, { top: false, under: false });
  for (const y of L.bands) prism(f, rec.brass, px, pz, square(L.band.w), y, y + L.band.h);
  const C = L.conduit;
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pipe(f, rec.brass, px, pz, sx * C.at, sz * C.at, C.r, C.sides, L.plinthBand.y1, L.shaft.y1);
  prism(f, rec.brass, px, pz, square(L.collar.w), L.shaft.y1, L.collar.y1);
  prism(f, rec.stone, px, pz, square(L.step.w), L.collar.y1, L.step.y1);
  prism(f, rec.stone, px, pz, square(L.clock.w), L.step.y1, L.clock.y1, { under: false });
  prism(f, rec.brass, px, pz, square(L.cornice.w), L.clock.y1, L.cornice.y1);
  // the lantern, open on every side, carrying its hood
  const T = L.lantern;
  lanternCage(f, rec.brass, px, pz);
  prism(f, rec.brass, px, pz, square(T.stem), SD_LANTERN.y1 + SD_LANTERN.plate, T.y1, { top: false, under: false });
  prism(f, rec.brass, px, pz, square(L.roof.w), T.y1, L.roof.y1);
  prism(f, rec.brass, px, pz, square(L.cap.w), L.roof.y1, L.cap.y1);
}
/** The lantern's cage about (px, pz): a foot plate on the cornice, four bars on the axes, a top plate - brass, open
 *  between its bars, a diamond to the square. */
function lanternCage(f, rec, px, pz) {
  const N = SD_LANTERN, foot = SD_PILLAR_LOOK.cornice.y1;
  prism(f, rec, px, pz, diamond(N.w + 0.06), foot, N.y0, { under: false });
  for (const [sx, sz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) prism(f, rec, px, pz, square(N.bar).map(([x, z]) => [sx * N.w + x, sz * N.w + z]), N.y0, N.y1, { top: false, under: false });
  prism(f, rec, px, pz, diamond(N.w + 0.06), N.y1, N.y1 + N.plate);
}

/** The four faces' ways out, the realm's frame (the square's sides, as pillarQuads lays them). */
export const SD_PILLAR_FACES = Object.freeze([Object.freeze([1, 0]), Object.freeze([0, 1]), Object.freeze([-1, 0]), Object.freeze([0, -1])]);
/**
 * THE SIXTEEN DIALS, pillar by pillar, face by face (index 4k + j): each `{ k, j, at, n, right }` - its centre in the
 * dungeon's frame, the way it faces (horizontal), and its right along the face (up x n): a dial's own (u, v) is right
 * and up. Made once.
 * @returns {ReadonlyArray<{ k: number, j: number, at: number[], n: number[], right: number[] }>}
 */
export const sdPillarDials = (() => {
  let made = null;
  return () => {
    if (made) return made;
    const D = SD_PILLAR_DIAL, out = [];
    for (let k = 0; k < 4; k++) {
      const [px, pz] = pillarCentre(k);
      for (let j = 0; j < 4; j++) {
        const [nx, nz] = SD_PILLAR_FACES[j], d = SD_PILLAR_LOOK.clock.w + D.lift;
        out.push(Object.freeze({ k, j, at: Object.freeze(realmToDungeon(px + nx * d, D.y, pz + nz * d)), n: Object.freeze([nx, 0, nz]), right: Object.freeze([nz, 0, -nx]) }));
      }
    }
    return (made = Object.freeze(out));
  };
})();
/** THE FOUR LANTERNS' FLAMES, the dungeon's frame. */
export const sdLanterns = (() => {
  let made = null;
  return () => (made ??= Object.freeze([0, 1, 2, 3].map((k) => { const [px, pz] = pillarCentre(k); return Object.freeze(realmToDungeon(px, SD_LANTERN.flameY, pz)); })));
})();
