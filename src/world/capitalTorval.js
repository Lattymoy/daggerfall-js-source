// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - TORVAL'S LANDMARKS: the port's own models of the city's
// signatures (world/capitalPlans.js TORVAL says where each stands) - the Mane's Palace under its great dome with its four
// minarets, the Temple of the Two Moons on its terraces with Masser's dome and Secunda's, the quay on Topal Bay, the
// sandstone walls with their domed towers - in metres, drawn as the map reads (+z south), every model's origin Torval's
// anchor on its ground. TESA-LORE: the palace's estate of sugarcane in mirrored beds within its own wall, the Mane's
// palanquin on its dais, and a gilt crescent moon on every dome. Shapes of the port's own in the spirit of the city's
// look. No game data.
import { MeshBuilder } from './detStandIns.js';
import {
  CAPITAL_ART,
  art,
  taper,
  ledge,
  translated,
  gatedRun,
  hall,
  crenels,
  darkDoor,
  entranceDoor,
  dome,
  squareTower,
  outward,
  limb,
  pyramid,
} from './capitalShapes.js';
import { TORVAL, estateBeds } from './capitalPlans.js';
import { urbanArt } from './urban/urbanRecords.js'; // URBANIZER U2: the towns' own brick

const SAND = art(CAPITAL_ART.sandstone),
  TERRA = art(CAPITAL_ART.terracotta),
  GOLD = art(CAPITAL_ART.gold),
  MARBLE = art(CAPITAL_ART.marble);
const DARK = art(CAPITAL_ART.dark),
  TIMBER = art(CAPITAL_ART.timber),
  CANE = art(CAPITAL_ART.cane),
  CLOTH = art(CAPITAL_ART.cloth);
/** URBANIZER U2 (world/urban/urbanArt.js): the Mane's estate walled in sandstone brick. */
const SAND_BRICK = urbanArt('sandBrick');

/**
 * TESA-LORE: A CRESCENT MOON of gilt at (x, y, z) - the Khajiit's moons over their domes: a short shaft, then an arc of
 * radius `r` opening upward, thick at its foot and thin at its horns, twice (crossed), so it reads from every side.
 */
export function crescent(mb, x, y, z, r, tex = GOLD) {
  taper(mb, tex, 6, r * 0.12, y, r * 0.08, y + r * 0.5, { vRepeat: 1 });
  const cy = y + r * 1.3,
    n = 8,
    a0 = Math.PI * 1.05,
    a1 = Math.PI * 1.95;
  for (const [ux, uz] of [
    [1, 0],
    [0, 1],
  ]) {
    for (let i = 0; i < n; i++) {
      const t0 = i / n,
        t1 = (i + 1) / n,
        b0 = a0 + (a1 - a0) * t0,
        b1 = a0 + (a1 - a0) * t1,
        th = (t) => r * (0.06 + 0.16 * Math.sin(Math.PI * t));
      limb(
        mb,
        tex,
        [x + ux * Math.cos(b0) * r, cy + Math.sin(b0) * r, z + uz * Math.cos(b0) * r],
        [x + ux * Math.cos(b1) * r, cy + Math.sin(b1) * r, z + uz * Math.cos(b1) * r],
        th(t0),
        th(t1),
        { n: 5 },
      );
    }
  }
}

/** A minaret at (x, z): its slender shaft, a balcony's ledge two-thirds up, its small dome and gilt finial. */
export function minaret(mb, x, z, r, h, { wall = SAND, roof = TERRA } = {}) {
  translated(mb, x, 0, z, () => {
    taper(mb, wall, 10, r, -3, r * 0.85, h, { vRepeat: 6 });
    ledge(mb, wall, 10, r + 0.8, r * 0.85, h * 0.66, h * 0.66 + 0.6);
    ledge(mb, wall, 10, r * 0.85 + 0.4, r * 0.85, h, h + 0.8);
  });
  dome(mb, roof, x, h + 0.8, z, r, r * 1.3, { n: 10, rings: 5, onion: 0.35 });
  crescent(mb, x, h + 0.8 + r * 1.3 - 0.2, z, 1.1); // TESA-LORE: its moon, where a spike stood
}

/**
 * THE MANE'S PALACE: a square palace of sandstone, crenellated, its great dome on its drum at the heart with a gilt
 * finial, a minaret at each corner; its door south, to the temple.
 */
export function buildManePalace(T = TORVAL) {
  const mb = new MeshBuilder(),
    P = T.palace;
  hall(mb, SAND, P.x, P.z, P.w, P.d, -3, P.h, 0.2);
  crenels(mb, SAND, P.x, P.z, P.w, P.d, P.h, { pitch: 3, mw: 1.4, mh: 1.4 });
  translated(mb, P.x, 0, P.z, () => {
    taper(mb, SAND, 16, P.domeR, P.h, P.domeR, P.h + P.drumH, { vRepeat: 4, uRepeat: 2 });
    ledge(mb, GOLD, 16, P.domeR + 0.5, P.domeR, P.h + P.drumH - 0.8, P.h + P.drumH);
  });
  dome(mb, TERRA, P.x, P.h + P.drumH, P.z, P.domeR, P.domeH, { n: 16, rings: 7, onion: 0.3 });
  crescent(mb, P.x, P.h + P.drumH + P.domeH - 0.4, P.z, 2.6); // TESA-LORE: its moon, where a spike stood
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      minaret(
        mb,
        P.x + sx * (P.w / 2 + P.minaretR * 0.4),
        P.z + sz * (P.d / 2 + P.minaretR * 0.4),
        P.minaretR,
        P.minaretH,
      );
  darkDoor(mb, DARK, P.x, P.z + P.d / 2, 6, 9, [0, 1]);
  return { ...mb.build(), doors: [entranceDoor(P.x, P.z + P.d / 2, 6, 9, [0, 1])] }; // WW7-4: the palace's halls (world/capitalCastles.js)
}

/**
 * THE TEMPLE OF THE TWO MOONS: three terraces of sandstone, each a step in; on the top two domes on their drums side
 * by side - Masser's the greater, of red tile, Secunda's the lesser, of white stone; its stair north, to the palace.
 */
export function buildTwoMoonsTemple(T = TORVAL) {
  const mb = new MeshBuilder(),
    M = T.temple;
  M.tiers.forEach((s, i) => hall(mb, SAND, M.x, M.z, s, s, i === 0 ? -3 : i * M.tierH, (i + 1) * M.tierH, 0.2));
  const top = M.tiers.length * M.tierH;
  for (const [[dx, r, h], tex] of [
    [M.masser, TERRA],
    [M.secunda, MARBLE],
  ]) {
    translated(mb, M.x + dx, 0, M.z, () => taper(mb, SAND, 14, r, top, r, top + M.drumH, { vRepeat: 4 }));
    dome(mb, tex, M.x + dx, top + M.drumH, M.z, r, h, { n: 14, rings: 6 });
    crescent(mb, M.x + dx, top + M.drumH + h - 0.2, M.z, r * 0.16); // TESA-LORE: each moon's own over its dome
  }
  // the stair: a ramp from the ground to the top terrace's north edge
  const w = 8,
    z0 = M.z - M.tiers[0] / 2 - 18,
    z1 = M.z - M.tiers[M.tiers.length - 1] / 2;
  const a = [M.x - w / 2, 0, z0],
    b = [M.x + w / 2, 0, z0],
    c = [M.x + w / 2, top, z1],
    d = [M.x - w / 2, top, z1];
  mb.quad(SAND, a, b, c, d, outward(a, b, c, [M.x, 0, M.z]), [
    [0, 0],
    [2, 0],
    [2, -8],
    [0, -8],
  ]);
  for (const s of [1, -1])
    mb.tri(SAND, [M.x + (s * w) / 2, 0, z0], [M.x + (s * w) / 2, 0, z1], [M.x + (s * w) / 2, top, z1], [s, 0, 0]);
  return mb.build();
}

/**
 * TESA-LORE: THE MANE'S ESTATE - "the Mane's palaces stand among gardens of sugarcane laid out in symmetry, where the
 * Mane meditates on a palanquin" (UESP): its own low wall of sandstone round the palace's four blocks, its one gate south
 * to the temple; its sugarcane in beds mirrored about the palace's axis (`estateBeds`); the palanquin on its dais on the
 * axis north of the palace - its litter, its four posts, its canopy of cloth, its poles fore and aft.
 */
export function buildManeEstate(T = TORVAL) {
  const mb = new MeshBuilder(),
    E = T.estate,
    P = T.palace,
    h = E.half;
  const ne = [P.x + h, P.z - h],
    nw = [P.x - h, P.z - h],
    sw = [P.x - h, P.z + h],
    se = [P.x + h, P.z + h];
  for (const [p, q] of [
    [ne, nw],
    [nw, sw],
    [se, ne],
  ]) {
    hall(
      mb,
      SAND_BRICK,
      (p[0] + q[0]) / 2,
      (p[1] + q[1]) / 2,
      Math.abs(q[0] - p[0]) + E.thick,
      Math.abs(q[1] - p[1]) + E.thick,
      -1,
      E.h,
      0.25,
    );
  }
  gatedRun(mb, SAND_BRICK, sw, se, E.thick, E.h, h, E.gate, E.gateH); // URBANIZER U2: the estate's wall of sandstone brick
  for (const [x, z, w, d] of estateBeds(T)) hall(mb, CANE, x, z, w, d, -0.3, E.bedH, 0.3);
  const Q = T.palanquin,
    qz = P.z + Q.dz;
  hall(mb, SAND, P.x, qz, Q.dais, Q.dais, -1, Q.daisH, 0.25);
  const y = Q.daisH;
  hall(mb, TIMBER, P.x, qz, 2.4, 3.4, y + 0.6, y + 1.3, 0.5);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) mb.box(TIMBER, [P.x + sx * 1.05, y + 2.1, qz + sz * 1.55], [0.18, 1.6, 0.18], 0.5);
    mb.box(TIMBER, [P.x + sx * 0.9, y + 0.9, qz], [0.16, 0.16, 6.4], 0.5); // its carrying poles
  }
  pyramid(mb, CLOTH, P.x, qz, 2.9, 3.9, y + 2.9, 1.3);
  return mb.build();
}

/** THE QUAY: its kerb along the bay and timber piers out over the water. */
export function buildTorvalQuay(T = TORVAL) {
  const mb = new MeshBuilder(),
    Q = T.quay;
  hall(mb, SAND, 0, Q.edge - 0.5, 614, 1, -2, 0.6, 0.5);
  for (const x of Q.piers) {
    hall(mb, TIMBER, x, (Q.edge + Q.pierTo) / 2, Q.pierW, Q.pierTo - Q.edge, Q.deck - 0.4, Q.deck, 0.5);
    for (let z = Q.edge + 4; z < Q.pierTo; z += 8)
      for (const s of [1, -1])
        mb.box(TIMBER, [x + s * (Q.pierW / 2 - 0.5), (Q.deck - 0.4 - 3) / 2, z], [0.6, Q.deck - 0.4 + 3, 0.6], 0.5);
  }
  return mb.build();
}

/** The walls' corners on the landward sides, in the order whose runs face their merlons out. */
export function torvalWallCorners(W = TORVAL.wall) {
  return [
    [W.east, W.south],
    [W.east, W.north],
    [W.west, W.north],
    [W.west, W.south],
  ];
}
/** THE WALLS: sandstone on the three landward sides, a gate in each, square towers under small domes at the corners, by
 *  the gates and between. */
export function buildTorvalWall(T = TORVAL) {
  const mb = new MeshBuilder(),
    W = T.wall,
    [se, ne, nw, sw] = torvalWallCorners(W),
    side = W.south - W.north;
  gatedRun(mb, SAND, se, ne, W.thick, W.h, side / 2, W.gate, W.gateH);
  gatedRun(mb, SAND, ne, nw, W.thick, W.h, W.east - W.northGate, W.gate, W.gateH); // AUDIT TESA II C10: on its lane, off the estate's closed back (26 m from it)
  gatedRun(mb, SAND, nw, sw, W.thick, W.h, side / 2, W.gate, W.gateH);
  for (const [x, z] of torvalTowers(W)) {
    squareTower(mb, x, z, W.tower, W.towerH, { wall: SAND, roofH: 0 });
    dome(mb, TERRA, x, W.towerH + 1.4, z, W.tower * 0.36, W.tower * 0.42, { n: 10, rings: 4, onion: 0.3 });
  }
  return mb.build();
}
/** The walls' towers: the four ends, a pair at each gate, and between. */
export function torvalTowers(W = TORVAL.wall) {
  const g = W.gate / 2 + W.tower / 2 + 0.5,
    midZ = (W.south + W.north) / 2,
    out = /** @type {number[][]} */ (torvalWallCorners(W).slice());
  out.push(
    [W.west, midZ - g],
    [W.west, midZ + g],
    [W.east, midZ - g],
    [W.east, midZ + g],
    [W.northGate - g, W.north],
    [W.northGate + g, W.north],
  );
  for (let x = W.every; x < W.east - W.tower; x += W.every) out.push([x + g, W.north], [-x - g, W.north]);
  return out;
}
