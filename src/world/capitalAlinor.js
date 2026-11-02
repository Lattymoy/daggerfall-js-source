// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - ALINOR'S LANDMARKS: the port's own models of the city's
// signatures (world/capitalPlans.js ALINOR says where each stands) - the Royal Palace of white stone with its gilt
// spires, TESA-LORE on its height (three terraces and their grand stair: the city "built on mountain slopes", the palace
// at their top); the bridges over the river through the city's south; the harbour's quay and piers; the white walls with
// their gold-capped towers, open where the river runs under them - in metres, drawn as the map reads (+z south), every
// model's origin Alinor's anchor on its ground. Shapes of the port's own in the spirit of the city's look. No game data.
// TESA-LORE: the Crystal Tower stood on an isle in the harbour; it is Summerset's, not Alinor's, and is gone from here.
import { MeshBuilder } from './detStandIns.js';
import {
  CAPITAL_ART,
  art,
  taper,
  ledge,
  translated,
  wallRun,
  merlons,
  roundTower,
  hall,
  gableRoof,
  darkDoor,
  entranceDoor,
  outward,
} from './capitalShapes.js';
import { ALINOR } from './capitalPlans.js';
import { BLOCK_M } from './blockHash.js';
import { urbanArt } from './urban/urbanRecords.js'; // URBANIZER U2: the towns' own cut stone

const MARBLE = art(CAPITAL_ART.marble),
  GOLD = art(CAPITAL_ART.gold),
  DARK = art(CAPITAL_ART.dark),
  BRIDGE = art(CAPITAL_ART.bridgeStone);
/** A ground tile's side, metres: the bank's last tile, where the ground slopes to the river (FB1029 BRIDGE-ENDS). */
const BANK_TILE = BLOCK_M / 16;
/** URBANIZER U2 (world/urban/urbanArt.js): the palace's terraces, keep and wings in dressed white stone. */
const DRESSED = urbanArt('whiteAshlar');

/** TESA-LORE: the grand stair's height at z - from the ground at its foot to the top terrace's edge, straight. */
export const alinorStairY = (z, P = ALINOR.palace) => {
  const top = P.terraces[P.terraces.length - 1];
  return Math.max(0, Math.min(top[1], (top[1] * (P.stairFoot - z)) / (P.stairFoot - top[0] / 2)));
};

/**
 * THE ROYAL PALACE on its height - TESA-LORE: three terraces of white stone, each a step in and up, cut on the south by
 * the grand stair from the street to the top (`alinorStairY`, its slope walkable, low walls either side); on the top, the
 * keep of white stone banded in gold, its wings east and west under gilt gables, a spire at each of the keep's corners and
 * the great tower at its heart with its gilt crown; its door south, down the stair to the city and the sea.
 */
export function buildAlinorPalace(A = ALINOR) {
  const mb = new MeshBuilder(),
    P = A.palace,
    k = P.keep / 2,
    w = P.stairW / 2;
  let y0 = 0;
  for (const [side, top] of P.terraces) {
    const s = side / 2,
      zc =
        P.stairFoot -
        ((P.stairFoot - P.terraces[P.terraces.length - 1][0] / 2) * top) / P.terraces[P.terraces.length - 1][1]; // where the stair reaches this terrace's top
    hall(mb, DRESSED, -(s + w) / 2, 0, s - w, side, y0 - 3, top, 0.2); // URBANIZER U2: the terraces in dressed white stone
    hall(mb, DRESSED, (s + w) / 2, 0, s - w, side, y0 - 3, top, 0.2);
    hall(mb, DRESSED, 0, (zc - s) / 2, 2 * w, zc + s, y0 - 3, top, 0.2);
    for (const sx of [1, -1])
      translated(mb, (sx * (s + w)) / 2, top - 0.6, 0, () => mb.box(GOLD, [0, 0.3, s - 0.3], [s - w, 0.6, 0.6], 0.5)); // a gilt course on its south face
    y0 = top;
  }
  const top = y0,
    foot = [0, 0, P.stairFoot],
    head = [0, top, P.terraces[P.terraces.length - 1][0] / 2];
  const a = [-w, foot[1], foot[2]],
    b = [w, foot[1], foot[2]],
    c = [w, head[1], head[2]],
    d = [-w, head[1], head[2]];
  mb.quad(MARBLE, a, b, c, d, outward(a, b, c, [0, -10, 0]), [
    [0, 0],
    [2, 0],
    [2, -8],
    [0, -8],
  ]);
  for (const sx of [1, -1]) {
    const x = sx * (w + 0.3),
      lo = [x, 0, foot[2]],
      hi = [x, top + 1, head[2]];
    mb.quad(MARBLE, [x, 0, lo[2]], [x, 0, hi[2]], hi, [x, 1, lo[2]], [sx, 0, 0]);
    mb.quad(MARBLE, [x, 0, hi[2]], [x, 0, lo[2]], [x, 1, lo[2]], hi, [-sx, 0, 0]);
  }
  translated(mb, 0, top, 0, () => {
    hall(mb, DRESSED, 0, 0, P.keep, P.keep, -3, P.keepH, 0.2); // URBANIZER U2: the keep and its wings dressed stone, the spires marble
    translated(mb, 0, P.keepH - 1.2, 0, () => mb.box(GOLD, [0, 0.6, 0], [P.keep + 0.6, 1.2, P.keep + 0.6], 0.5));
    const [ww, wd, wh] = P.wing;
    for (const s of [1, -1]) {
      hall(mb, DRESSED, s * (k + ww / 2), 0, ww, wd, -3, wh, 0.2);
      gableRoof(mb, GOLD, DRESSED, s * (k + ww / 2), 0, ww, wd, wh, 7);
    }
    for (const sx of [1, -1])
      for (const sz of [1, -1])
        roundTower(mb, sx * k, sz * k, P.spireR, P.spireH, { wall: MARBLE, roof: GOLD, roofH: P.spireRoof, sides: 12 });
    taper(mb, MARBLE, 12, P.towerR, P.keepH, P.towerR * 0.85, P.towerH, { vRepeat: 6, uRepeat: 2 });
    ledge(mb, GOLD, 12, P.towerR + 0.6, P.towerR * 0.85, P.towerH, P.towerH + 1.4);
    taper(mb, GOLD, 12, P.towerR * 0.85, P.towerH + 1.4, 0.05, P.towerH + 1.4 + P.crown, { vRepeat: 6 });
    darkDoor(mb, DARK, 0, k, 5, 8, [0, 1]);
  });
  return { ...mb.build(), doors: [entranceDoor(0, k, 5, 8, [0, 1], top)] }; // WW7-4: the palace's halls, its door on the top (world/capitalCastles.js)
}

/** FB1029 BRIDGE-ENDS: an abutment's foot over the model's origin (the street, 5 cm under it) - its top rises from 2 cm
 *  over the street to the deck's end, a slope, never a ledge: a 0.35 m edge stalls the motor's step-up (AUDIT FB1029 A1). */
const ABUT_FOOT = -0.03;
/** FB1029 BRIDGE-ENDS: each bridge's two abutments, [x0, z0, x1, z1] in the anchor's metres - the bank's last ground
 *  tile under each end, which RUMARE-WATER's ground slopes a metre down to the river (terrain/capitalSea.js). */
export const alinorAbutments = (A = ALINOR) =>
  A.bridges.flatMap((x) => [
    [x - A.bridgeW / 2, A.river.z0 - BANK_TILE, x + A.bridgeW / 2, A.river.z0],
    [x - A.bridgeW / 2, A.river.z1, x + A.bridgeW / 2, A.river.z1 + BANK_TILE],
  ]);

/**
 * TESA-LORE: THE BRIDGES over the river through the city's south - each of white stone from bank to bank, its deck
 * rising in an arch to `bridgeRise` over the water's middle (its slope walkable), its parapets, a pier in the water at
 * each quarter. FB1029 BRIDGE-ENDS: each end on an abutment over the bank's last tile (alinorAbutments), its top a ramp
 * from the street to the deck, its sides and its faces down into the ground.
 */
export function buildAlinorBridges(A = ALINOR) {
  const mb = new MeshBuilder(),
    R = A.river,
    hw = A.bridgeW / 2,
    N = 16,
    ph = A.parapet;
  const yAt = (z) => 0.3 + (A.bridgeRise - 0.3) * Math.sin((Math.PI * (z - R.z0)) / (R.z1 - R.z0));
  /** A length from za to zb in n pieces: its walk at y(z), its parapets, its underside `under` below the walk - or, with
   *  none, its sides down to `foot`. */
  const span = (x, za, zb, y, n, under, foot) => {
    for (let i = 0; i < n; i++) {
      const z0 = za + ((zb - za) * i) / n,
        z1 = za + ((zb - za) * (i + 1)) / n,
        y0 = y(z0),
        y1 = y(z1);
      const b0 = under == null ? foot : y0 - under,
        b1 = under == null ? foot : y1 - under;
      const up = outward([x - hw, y0, z0], [x + hw, y0, z0], [x + hw, y1, z1], [x, -20, (z0 + z1) / 2]);
      mb.quad(BRIDGE, [x - hw, y0, z0], [x + hw, y0, z0], [x + hw, y1, z1], [x - hw, y1, z1], up, [
        [0, 0],
        [2, 0],
        [2, -1],
        [0, -1],
      ]);
      if (under != null) {
        const dn = outward([x - hw, b0, z0], [x + hw, b0, z0], [x + hw, b1, z1], [x, 40, (z0 + z1) / 2]);
        mb.quad(BRIDGE, [x - hw, b0, z0], [x + hw, b0, z0], [x + hw, b1, z1], [x - hw, b1, z1], dn);
      }
      for (const s of [1, -1]) {
        const xo = x + s * hw,
          xi = x + s * (hw - 0.6);
        mb.quad(MARBLE, [xo, b0, z0], [xo, b1, z1], [xo, y1 + ph, z1], [xo, y0 + ph, z0], [s, 0, 0]);
        mb.quad(MARBLE, [xi, y0, z0], [xi, y1, z1], [xi, y1 + ph, z1], [xi, y0 + ph, z0], [-s, 0, 0]);
        mb.quad(MARBLE, [xi, y0 + ph, z0], [xi, y1 + ph, z1], [xo, y1 + ph, z1], [xo, y0 + ph, z0], [0, 1, 0]);
      }
    }
  };
  for (const x of A.bridges) {
    span(x, R.z0, R.z1, yAt, N, 1.2, null);
    for (const t of [0.25, 0.5, 0.75]) {
      const z = R.z0 + (R.z1 - R.z0) * t;
      hall(mb, BRIDGE, x, z, A.bridgeW - 1, 3, -4, yAt(z) - 1.2, 0.3);
    }
    for (const [zs, ze] of [
      [R.z0 - BANK_TILE, R.z0],
      [R.z1 + BANK_TILE, R.z1],
    ]) {
      span(x, zs, ze, (z) => ABUT_FOOT + ((0.3 - ABUT_FOOT) * (z - zs)) / (ze - zs), 1, null, -2);
      const out = [0, 0, Math.sign(zs - ze)];
      mb.quad(BRIDGE, [x - hw, -2, zs], [x + hw, -2, zs], [x + hw, ABUT_FOOT, zs], [x - hw, ABUT_FOOT, zs], out); // its foot's face, in the ground
      for (const s of [1, -1])
        mb.quad(
          MARBLE,
          [x + s * hw, ABUT_FOOT, zs],
          [x + s * (hw - 0.6), ABUT_FOOT, zs],
          [x + s * (hw - 0.6), ABUT_FOOT + ph, zs],
          [x + s * hw, ABUT_FOOT + ph, zs],
          out,
        ); // its parapets' ends
      mb.quad(
        BRIDGE,
        [x - hw, -2, ze],
        [x + hw, -2, ze],
        [x + hw, 0.3 - 1.2, ze],
        [x - hw, 0.3 - 1.2, ze],
        [0, 0, -out[2]],
      ); // under the deck's end, to the water
    }
  }
  return mb.build();
}

/** THE HARBOUR: the quay's kerb along the water and piers of white stone out into the bay. */
export function buildAlinorHarbour(A = ALINOR) {
  const mb = new MeshBuilder(),
    Q = A.quay;
  hall(mb, MARBLE, 0, Q.edge - 0.5, 614, 1, -2, 0.6, 0.5);
  for (const x of Q.piers) {
    hall(mb, BRIDGE, x, (Q.edge + Q.pierTo) / 2, Q.pierW, Q.pierTo - Q.edge, -3, Q.deck, 0.3);
    for (const s of [1, -1])
      hall(
        mb,
        MARBLE,
        x + s * (Q.pierW / 2 - 0.3),
        (Q.edge + Q.pierTo) / 2,
        0.6,
        Q.pierTo - Q.edge,
        Q.deck,
        Q.deck + 0.9,
        0.5,
      );
  }
  return mb.build();
}

/** The walls' corners on the landward sides, in the order whose runs face their merlons out: the south-east end at the
 *  quay, the north-east, the north-west, the south-west end. */
export function alinorWallCorners(W = ALINOR.wall) {
  return [
    [W.east, W.south],
    [W.east, W.north],
    [W.west, W.north],
    [W.west, W.south],
  ];
}
/** A run of the walls from p to q broken for each of `gaps` ([the distance along it, the width, the lintel's foot or
 *  null - a gate under its lintel, or the river's way open to the sky]). */
function brokenRun(mb, p, q, W, gaps) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]),
    ux = (q[0] - p[0]) / len,
    uz = (q[1] - p[1]) / len,
    P = (t) => [p[0] + ux * t, p[1] + uz * t];
  let s0 = 0;
  for (const [at, w, lintel] of [...gaps].sort((a, b) => a[0] - b[0])) {
    const a = P(s0),
      b = P(at - w / 2);
    wallRun(mb, MARBLE, a, b, W.thick, W.h);
    merlons(mb, MARBLE, a, b, W.thick, W.h);
    if (lintel !== null)
      translated(mb, 0, lintel, 0, () => wallRun(mb, MARBLE, P(at - w / 2), P(at + w / 2), W.thick, W.h - lintel, 0));
    s0 = at + w / 2;
  }
  wallRun(mb, MARBLE, P(s0), q, W.thick, W.h);
  merlons(mb, MARBLE, P(s0), q, W.thick, W.h);
}
/** TESA-LORE: where the river runs under the walls - its way along the east side from its south end and along the west
 *  side from its north end: [the distance, the width]. */
export function alinorRiverGaps(A = ALINOR) {
  const W = A.wall,
    R = A.river,
    w = R.z1 - R.z0 - 2 * (W.tower + 1);
  return { east: [W.south - (R.z0 + R.z1) / 2, w], west: [(R.z0 + R.z1) / 2 - W.north, w] };
}
/** THE WALLS: white stone on the three landward sides - the north gate, a gate west and east - slender towers under
 *  gold cones at the corners, by the gates, at the quay and between; TESA-LORE: open where the river runs under the
 *  west and east sides, a tower on either bank. */
export function buildAlinorWall(A = ALINOR) {
  const mb = new MeshBuilder(),
    W = A.wall,
    [se, ne, nw, sw] = alinorWallCorners(W),
    side = W.south - W.north,
    g = alinorRiverGaps(A);
  brokenRun(mb, se, ne, W, [
    [side / 2, W.gate, W.gateH],
    [...g.east, null],
  ]);
  brokenRun(mb, ne, nw, W, [[W.east - W.northGate, W.gate, W.gateH]]); // AUDIT TESA II C10: on its lane, off the palace's height (29 m from its blank north face)
  brokenRun(mb, nw, sw, W, [
    [side / 2, W.gate, W.gateH],
    [...g.west, null],
  ]);
  for (const [x, z] of alinorTowers(W))
    roundTower(mb, x, z, W.tower, W.towerH, { wall: MARBLE, roof: GOLD, roofH: W.roof, sides: 12 });
  return mb.build();
}
/** The walls' towers: the four ends, a pair at each gate, and between; TESA-LORE: a pair at the river. */
export function alinorTowers(W = ALINOR.wall, R = ALINOR.river) {
  const g = W.gate / 2 + W.tower + 0.5,
    midZ = (W.south + W.north) / 2,
    out = /** @type {number[][]} */ (alinorWallCorners(W).slice());
  out.push(
    [W.west, midZ - g],
    [W.west, midZ + g],
    [W.east, midZ - g],
    [W.east, midZ + g],
    [W.northGate - g, W.north],
    [W.northGate + g, W.north],
  );
  for (let x = W.every; x < W.east - W.tower * 2; x += W.every) out.push([x + g, W.north], [-x - g, W.north]);
  for (const x of [W.west, W.east]) out.push([x, R.z0 + W.tower], [x, R.z1 - W.tower]);
  return out;
}
