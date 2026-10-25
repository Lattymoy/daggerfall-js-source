// @ts-check
// TESA10 (bible/03-World/Arena-Provinces.md TESA10) - SOLITUDE'S LANDMARKS: the port's own models of the city's
// signatures (world/tamrielCapitals.js SOLITUDE says where each stands) - the sea stack in the Karth's mouth with the Blue
// Palace on it, the great arch from the stack to the city's west terrace, the city's walls of square towers, Castle Dour
// and the Emperor's Tower just within the main gate (TESA-LORE), and the docks below the north wall - in metres, every
// model's origin Solitude's anchor on its ground. Shapes of the port's own in the spirit of the city's look - never another
// game's mesh. No game data.
import { MeshBuilder } from './detStandIns.js';
import {
  CAPITAL_ART, art, taper, translated, wallRun, merlons, gatedRun, roundTower, pyramid, gableRoof, hall, crenels, squareTower,
  darkDoor, entranceDoor, jitter, rockColumn, outward,
} from './capitalShapes.js';
import { SOLITUDE } from './tamrielCapitals.js';

const MARBLE = art(CAPITAL_ART.marble), GOLD = art(CAPITAL_ART.gold), ROOF = art(CAPITAL_ART.roof), BRIDGE = art(CAPITAL_ART.bridgeStone);
const DARK = art(CAPITAL_ART.dark), ROCK = art(CAPITAL_ART.rock), BLUE = art(CAPITAL_ART.blueSlate), TIMBER = art(CAPITAL_ART.timber), NORD = art(CAPITAL_ART.nordStone);

/** The arch's deck height at x: from the stack's top down to the terrace's. */
export const archTop = (x, A = SOLITUDE.arch) => A.topW + (A.topE - A.topW) * ((x - A.from) / (A.to - A.from));
/** The arch's opening at x: the intrados over the river between its springs, 0 past them. */
export const archOpening = (x, A = SOLITUDE.arch) => (x <= A.springW || x >= A.springE ? 0 : A.crown * Math.sin(Math.PI * ((x - A.springW) / (A.springE - A.springW))) ** 0.7);

/**
 * THE ARCH: the sea stack (a rock column from under the water to its top), the arch from the stack to the city - its deck
 * falling from the stack's top to the terrace's, its opening over the river between its springs, its sides rough rock
 * flaring to its foot, a parapet either side of its deck - and the terrace inside the west wall with its ramp down to
 * the street.
 */
export function buildSolitudeArch(S = SOLITUDE) {
  const mb = new MeshBuilder(), A = S.arch, st = S.stack, L = S.landing, N = 26;
  rockColumn(mb, ROCK, NORD, st.x, st.z, 14, [[-4, st.r + 11], [10, st.r + 7], [22, st.r + 3], [st.top, st.r]], { rough: 3.5, seed: 0x501 });
  const xs = Array.from({ length: N + 1 }, (_, i) => A.from + ((A.to - A.from) * i) / N);
  const HW = [A.w / 2 + 4, A.w / 2 + 2.5, A.w / 2 + 1, A.w / 2];   // the half-widths, the foot (its opening) to the deck
  const foot = (x) => { const o = archOpening(x, A); return o > 0 ? o : -4; };
  const yOf = (i, b) => foot(xs[i]) + (archTop(xs[i], A) - foot(xs[i])) * (b / 3);
  const zOf = (i, b, s) => s * (HW[b] + (b === 3 ? 0 : (jitter(0x502, i, b, s) - 0.5) * 2.4));
  const P = (i, b, s) => [xs[i], yOf(i, b), zOf(i, b, s)];
  for (let i = 0; i < N; i++) {
    const mid = [(xs[i] + xs[i + 1]) / 2, (yOf(i, 0) + yOf(i, 3)) / 2, 0];
    for (const s of [1, -1]) {
      for (let b = 0; b < 3; b++) {
        const a = P(i, b, s), c = P(i + 1, b, s), d = P(i + 1, b + 1, s), e = P(i, b + 1, s);
        mb.quad(ROCK, a, c, d, e, outward(a, c, d, mid), [[0, 0], [1.2, 0], [1.2, -1], [0, -1]]);
      }
      // the parapet: a hand of wall along the deck's edge, its outer face, its inner face and its top
      const t0 = archTop(xs[i], A), t1 = archTop(xs[i + 1], A), zo = s * A.w / 2, zi = s * (A.w / 2 - 0.6), ph = A.parapet;
      mb.quad(NORD, [xs[i], t0, zo], [xs[i + 1], t1, zo], [xs[i + 1], t1 + ph, zo], [xs[i], t0 + ph, zo], [0, 0, s]);
      mb.quad(NORD, [xs[i], t0, zi], [xs[i + 1], t1, zi], [xs[i + 1], t1 + ph, zi], [xs[i], t0 + ph, zi], [0, 0, -s]);
      mb.quad(NORD, [xs[i], t0 + ph, zi], [xs[i + 1], t1 + ph, zi], [xs[i + 1], t1 + ph, zo], [xs[i], t0 + ph, zo], [0, 1, 0]);
    }
    const below = [mid[0], mid[1] - 40, 0], above = [mid[0], mid[1] + 40, 0];
    const d0 = P(i, 3, -1), d1 = P(i + 1, 3, -1), d2 = P(i + 1, 3, 1), d3 = P(i, 3, 1);
    mb.quad(BRIDGE, d0, d1, d2, d3, outward(d0, d1, d2, below), [[0, 0], [1, 0], [1, -A.w / 5], [0, -A.w / 5]]);
    if (archOpening(xs[i], A) > 0 || archOpening(xs[i + 1], A) > 0) {
      const u0 = P(i, 0, 1), u1 = P(i + 1, 0, 1), u2 = P(i + 1, 0, -1), u3 = P(i, 0, -1);
      mb.quad(ROCK, u0, u1, u2, u3, outward(u0, u1, u2, above), [[0, 0], [1, 0], [1, -3], [0, -3]]);
    }
  }
  // the terrace inside the west wall, and its ramp down to the street
  hall(mb, NORD, (L.x0 + L.x1) / 2, 0, L.x1 - L.x0, L.w, -3, L.top, 0.2);
  const hw = L.rampW / 2, r0 = [L.x1, L.top, -hw], r1 = [L.rampTo, 0, -hw], r2 = [L.rampTo, 0, hw], r3 = [L.x1, L.top, hw];
  mb.quad(BRIDGE, r0, r1, r2, r3, outward(r0, r1, r2, [L.x1, 0, 0]), [[0, 0], [6, 0], [6, -2], [0, -2]]);
  for (const s of [1, -1]) mb.tri(NORD, [L.x1, 0, s * hw], [L.rampTo, 0, s * hw], [L.x1, L.top, s * hw], [0, 0, s]);
  return mb.build();
}

/**
 * THE BLUE PALACE on the stack's top: its long hall under a gable of blue slate, the wing across its east end facing
 * the arch with its door, the square tower over the hall with its blue spire and gilt finial, round turrets at the
 * hall's west corners and the wing's outer ones - pale stone under blue roofs.
 */
export function buildBluePalace(S = SOLITUDE) {
  const mb = new MeshBuilder(), B = S.palace, y = S.stack.top;
  hall(mb, MARBLE, B.hall.x, B.hall.z, B.hall.w, B.hall.d, y - 1, y + B.hall.h);
  gableRoof(mb, BLUE, MARBLE, B.hall.x, B.hall.z, B.hall.w, B.hall.d, y + B.hall.h, B.hall.roof);
  hall(mb, MARBLE, B.wing.x, B.wing.z, B.wing.w, B.wing.d, y - 1, y + B.wing.h);
  gableRoof(mb, BLUE, MARBLE, B.wing.x, B.wing.z, B.wing.d, B.wing.w, y + B.wing.h, B.wing.roof, { alongX: false });
  darkDoor(mb, DARK, B.wing.x + B.wing.w / 2, B.wing.z, 4, 6.5, [1, 0], y);
  const T = B.tower;
  hall(mb, MARBLE, B.hall.x, B.hall.z, T.s, T.s, y + B.hall.h, y + T.h);
  crenels(mb, MARBLE, B.hall.x, B.hall.z, T.s, T.s, y + T.h, { pitch: 2.2, mh: 1 });
  pyramid(mb, BLUE, B.hall.x, B.hall.z, T.s + 1, T.s + 1, y + T.h + 1, T.spire);
  translated(mb, B.hall.x, y + T.h + 1 + T.spire - 0.5, B.hall.z, () => taper(mb, GOLD, 6, 0.5, 0, 0.02, 5, { vRepeat: 2 }));
  for (const s of [1, -1]) {
    roundTower(mb, B.hall.x - B.hall.w / 2, B.hall.z + s * B.hall.d / 2, B.turret.r, B.turret.h, { y, wall: MARBLE, roof: BLUE, roofH: B.turret.roof });
    roundTower(mb, B.wing.x + B.wing.w / 2, B.wing.z + s * B.wing.d / 2, B.turret.r - 0.8, B.turret.h - 6, { y, wall: MARBLE, roof: BLUE, roofH: B.turret.roof - 2 });
  }
  return { ...mb.build(), doors: [entranceDoor(B.wing.x + B.wing.w / 2, B.wing.z, 4, 6.5, [1, 0], y)] };   // WW7-4: the palace's halls (world/capitalCastles.js)
}

/** The city wall's corners, in the order whose runs face their merlons out: north-east, north-west, south-west,
 *  south-east. */
export function solitudeWallCorners(W = SOLITUDE.wall) {
  return [[W.east, W.north], [W.west, W.north], [W.west, W.south], [W.east, W.south]];
}
/**
 * THE WALLS: a towered rectangle of dark stone - the north side's gate down to the docks, the south side's main gate,
 * the west side open where the arch's terrace meets it - square towers at its corners, either side of each gate and of
 * the arch, and along its sides.
 */
export function buildSolitudeWall(S = SOLITUDE) {
  const mb = new MeshBuilder(), W = S.wall;
  const [ne, nw, sw, se] = solitudeWallCorners(W);
  gatedRun(mb, NORD, ne, nw, W.thick, W.h, W.east - W.northGate, W.gate, W.gateH);
  const gapN = [W.west, -W.archGap], gapS = [W.west, W.archGap];
  wallRun(mb, NORD, nw, gapN, W.thick, W.h); merlons(mb, NORD, nw, gapN, W.thick, W.h);
  wallRun(mb, NORD, gapS, sw, W.thick, W.h); merlons(mb, NORD, gapS, sw, W.thick, W.h);
  gatedRun(mb, NORD, sw, se, W.thick, W.h, W.southGate - W.west, W.gate, W.gateH);
  wallRun(mb, NORD, se, ne, W.thick, W.h); merlons(mb, NORD, se, ne, W.thick, W.h);
  for (const [x, z] of solitudeTowers(W)) squareTower(mb, x, z, W.tower, W.towerH, { wall: NORD, roof: ROOF, roofH: 7 });
  return mb.build();
}
/** The wall's towers: its corners, a pair at each gate and at the arch, and those its sides stand between them. */
export function solitudeTowers(W = SOLITUDE.wall) {
  const g = W.gate / 2 + W.tower / 2 + 0.5;
  return [
    ...solitudeWallCorners(W),
    [W.northGate - g, W.north], [W.northGate + g, W.north], [W.southGate - g, W.south], [W.southGate + g, W.south],
    [W.west, -W.archGap - W.tower / 2 - 1.5], [W.west, W.archGap + W.tower / 2 + 1.5],
    ...W.along.north.map((x) => [x, W.north]), ...W.along.south.map((x) => [x, W.south]),
    ...W.along.west.map((z) => [W.west, z]), ...W.along.east.map((z) => [W.east, z]),
  ];
}

/**
 * CASTLE DOUR: a square curtain of dark stone with square towers at its corners and two gates - TESA-LORE: west, to the
 * lane from the city's main gate it stands just within, and north, to the city and the Temple of the Divines on its
 * grounds (UESP: "Castle Dour has two gateways"); the keep inside under a slate gable, a turret at each of its corners, its
 * door to the yard; the Emperor's Tower in the north-west of the yard, the tallest thing on the city's ground.
 */
export function buildCastleDour(S = SOLITUDE) {
  const mb = new MeshBuilder(), C = S.castle, h = C.half;
  const ne = [C.x + h, C.z - h], nw = [C.x - h, C.z - h], sw = [C.x - h, C.z + h], se = [C.x + h, C.z + h];
  gatedRun(mb, NORD, ne, nw, C.thick, C.h, h, C.gate, C.gateH);
  gatedRun(mb, NORD, nw, sw, C.thick, C.h, h, C.gate, C.gateH);
  wallRun(mb, NORD, sw, se, C.thick, C.h); merlons(mb, NORD, sw, se, C.thick, C.h);
  wallRun(mb, NORD, se, ne, C.thick, C.h); merlons(mb, NORD, se, ne, C.thick, C.h);
  for (const [x, z] of [ne, nw, sw, se]) squareTower(mb, x, z, C.tower, C.towerH, { wall: NORD, roof: ROOF, roofH: 8 });
  const K = S.keep, kx = C.x + K.dx, kz = C.z + K.dz;
  hall(mb, NORD, kx, kz, K.w, K.d, -3, K.h);
  gableRoof(mb, ROOF, NORD, kx, kz, K.d, K.w, K.h, K.roof, { alongX: false });
  darkDoor(mb, DARK, kx - K.w / 2, kz, 3.6, 5.5, [-1, 0]);
  for (const sx of [1, -1]) for (const sz of [1, -1]) squareTower(mb, kx + sx * K.w / 2, kz + sz * K.d / 2, 6, K.h + 6, { wall: NORD, roof: ROOF, roofH: 5 });   // TESA-LORE: its corner turrets
  const E = S.emperorsTower;
  squareTower(mb, C.x + E.dx, C.z + E.dz, E.s, E.h, { wall: NORD, roof: ROOF, roofH: E.roof });
  return mb.build();
}

/**
 * THE DOCKS: the quay's stone kerb along the water, timber piers out over the sea on posts, and the trading company's
 * long warehouse on the quay under a slate gable, its doors to the gate and to the water.
 */
export function buildSolitudeDocks(S = SOLITUDE) {
  const mb = new MeshBuilder(), D = S.docks, Q = S.quay;
  hall(mb, NORD, (Q.x0 + Q.x1) / 2, D.edge + 0.5, Q.x1 - Q.x0, 1, -2, 0.6, 0.5);
  for (const x of D.piers) {
    const len = D.edge - D.pierTo, zc = (D.edge + D.pierTo) / 2;
    hall(mb, TIMBER, x, zc, D.pierW, len, D.deck - 0.4, D.deck, 0.5);
    for (let z = D.edge - 4; z > D.pierTo; z -= 8) for (const s of [1, -1]) mb.box(TIMBER, [x + s * (D.pierW / 2 - 0.5), (D.deck - 0.4 - 3) / 2, z], [0.6, D.deck - 0.4 + 3, 0.6], 0.5);
  }
  const H = D.warehouse;
  hall(mb, NORD, H.x, H.z, H.w, H.d, -1, H.h);
  gableRoof(mb, ROOF, TIMBER, H.x, H.z, H.w, H.d, H.h, H.roof);
  darkDoor(mb, DARK, H.x, H.z + H.d / 2, 5, 5, [0, 1]);
  darkDoor(mb, DARK, H.x, H.z - H.d / 2, 5, 5, [0, -1]);
  return mb.build();
}
