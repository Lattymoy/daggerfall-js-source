// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - HELSTROM'S LANDMARKS: the port's own models of the city's
// signatures (world/capitalPlans.js HELSTROM says where each stands) - the Great Xanmeer, a stepped pyramid of mossy
// stone with its stairs and its shrine; the Hist on its isle in the canal, twisted, sap-gilt, its crown of leaves; the
// boardwalks over the canal; the palisade of sharpened logs round the city with its watchtowers on stilts - in metres,
// drawn as the map reads (+z south), every model's origin Helstrom's anchor on its ground. TESA-LORE: the Hist grown
// greater, its standing stones round it on its isle. Shapes of the port's own in the spirit of the marsh city. No game
// data.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, hall, pyramid, wallRun, blob, limb, jitter, entranceDoor } from './capitalShapes.js';
import { HELSTROM, histStones } from './capitalPlans.js';

const MOSS = art(CAPITAL_ART.mossStone),
  BARK = art(CAPITAL_ART.bark),
  LEAVES = art(CAPITAL_ART.leaves),
  GOLD = art(CAPITAL_ART.gold);
const TIMBER = art(CAPITAL_ART.timber),
  DARK = art(CAPITAL_ART.dark);

/**
 * THE GREAT XANMEER: its tiers, each a step in and up; a stair up the middle of each face from the ground to the top;
 * the shrine on its top under a pyramid, its doorways dark on all four sides.
 */
export function buildXanmeer(H = HELSTROM) {
  const mb = new MeshBuilder(),
    X = H.xanmeer,
    top = X.tiers.length * X.tierH;
  X.tiers.forEach((s, i) => hall(mb, MOSS, 0, 0, s, s, i === 0 ? -3 : i * X.tierH, (i + 1) * X.tierH, 0.15));
  const base = X.tiers[0] / 2,
    inner = X.tiers[X.tiers.length - 1] / 2,
    w = X.stair / 2;
  for (const [ux, uz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const P = (along, side, y) => [ux * along + uz * side, y, uz * along + ux * side];
    const a = P(base + 6, -w, 0),
      b = P(base + 6, w, 0),
      c = P(inner, w, top),
      d = P(inner, -w, top);
    const run = Math.hypot(base + 6 - inner, top),
      n = [(ux * top) / run, (base + 6 - inner) / run, (uz * top) / run];
    mb.quad(MOSS, a, b, c, d, n, [
      [0, 0],
      [1, 0],
      [1, -run / 4],
      [0, -run / 4],
    ]);
  }
  hall(mb, MOSS, 0, 0, X.shrine, X.shrine, top, top + X.shrineH, 0.2);
  pyramid(mb, MOSS, 0, 0, X.shrine + 2, X.shrine + 2, top + X.shrineH, X.shrine * 0.6);
  for (const [nx, nz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const e = X.shrine / 2 + 0.05,
      x = nx * e,
      z = nz * e,
      tx = -nz,
      tz = nx;
    mb.quad(
      DARK,
      [x - tx * 1.6, top, z - tz * 1.6],
      [x + tx * 1.6, top, z + tz * 1.6],
      [x + tx * 1.6, top + 4.5, z + tz * 1.6],
      [x - tx * 1.6, top + 4.5, z - tz * 1.6],
      [nx, 0, nz],
    );
  }
  return { ...mb.build(), doors: [entranceDoor(0, X.shrine / 2, 3.2, 4.5, [0, 1], top)] }; // WW7-4: the shrine's south doorway the castle's halls (world/capitalCastles.js)
}

/**
 * THE HIST: its trunk twisting up in four turns from its roots on the isle, its boughs out from its top, its crown of
 * leaves, and the sap gilt on its bark; TESA-LORE: its standing stones in a ring about it, each a mossy pillar under a
 * capstone.
 */
export function buildHist(H = HELSTROM) {
  const mb = new MeshBuilder(),
    T = H.hist,
    seg = 4,
    pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg,
      a = t * Math.PI * 1.5;
    pts.push([T.x + Math.cos(a) * 3 * t, -1 + T.h * t, T.z + Math.sin(a) * 3 * t]);
  }
  for (let i = 0; i < seg; i++)
    limb(mb, BARK, pts[i], pts[i + 1], T.r * (1 - (i / seg) * 0.55), T.r * (1 - ((i + 1) / seg) * 0.55), { n: 10 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4,
      c = Math.cos(a),
      s = Math.sin(a);
    limb(
      mb,
      BARK,
      [T.x + c * 1.5, -1, T.z + s * 1.5],
      [T.x + c * (T.r + 7), -1.5, T.z + s * (T.r + 7)],
      T.r * 0.45,
      0.8,
      { n: 6 },
    );
  }
  const top = pts[seg],
    tips = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2,
      c = Math.cos(a),
      s = Math.sin(a),
      r = 12 + jitter(0xe01, i) * 8;
    const tip = [top[0] + c * r, top[1] + 4 + jitter(0xe02, i) * 6, top[2] + s * r];
    limb(mb, BARK, [top[0], top[1] - 4, top[2]], tip, T.r * 0.35, 0.6, { n: 6 });
    tips.push(tip);
  }
  tips.forEach(([x, y, z], i) =>
    blob(mb, LEAVES, x, y + 3, z, T.crown * 0.55, T.crown * 0.32, T.crown * 0.55, { seed: 0xe10 + i }),
  );
  blob(mb, LEAVES, top[0], top[1] + 8, top[2], T.crown, T.crown * 0.45, T.crown, { seed: 0xe20, n: 12 });
  for (let i = 0; i < 9; i++) {
    const t = 0.15 + 0.7 * jitter(0xe30, i),
      a = jitter(0xe31, i) * Math.PI * 2,
      p = pts[Math.min(seg - 1, Math.floor(t * seg))],
      r = T.r * (1 - t * 0.55) + 0.2;
    blob(mb, GOLD, p[0] + Math.cos(a) * r, -1 + T.h * t, p[2] + Math.sin(a) * r, 0.9, 1.6, 0.9, {
      n: 6,
      rings: 4,
      rough: 0.1,
      seed: 0xe40 + i,
    });
  }
  for (const [x, z] of histStones(T)) {
    hall(mb, MOSS, x, z, T.stoneW, T.stoneW, -1, T.stoneH, 0.25);
    hall(mb, MOSS, x, z, T.stoneW + 0.8, T.stoneW + 0.8, T.stoneH, T.stoneH + 0.7, 0.25);
  }
  return mb.build();
}

/** THE BOARDWALKS: timber decks over the canal on their posts, a rail either side. */
export function buildHelstromWalks(H = HELSTROM) {
  const mb = new MeshBuilder(),
    C = H.canal,
    len = C.z1 - C.z0 + 1,
    zc = (C.z0 + C.z1) / 2; // AUDIT-TESA A6-3: half a metre onto each bank - 4 m stood in a house's block
  for (const x of H.walks) {
    hall(mb, TIMBER, x, zc, H.walkW, len, H.walkDeck - 0.35, H.walkDeck, 0.5);
    for (let z = C.z0 + 2; z < C.z1; z += 7)
      for (const s of [1, -1])
        mb.box(TIMBER, [x + s * (H.walkW / 2 - 0.3), (H.walkDeck - 3) / 2, z], [0.5, H.walkDeck + 3, 0.5], 0.5);
    for (const s of [1, -1])
      mb.box(TIMBER, [x + s * (H.walkW / 2 - 0.15), H.walkDeck + 0.95, zc], [0.2, 0.2, len], 0.5);
  }
  return mb.build();
}

/** The palisade's corners, in the order whose runs face their teeth out. */
export function helstromCorners(P = HELSTROM.palisade) {
  return [
    [P.east, P.north],
    [P.west, P.north],
    [P.west, P.south],
    [P.east, P.south],
  ];
}
/** The palisade's openings: the north and south gates on the anchor's line, and the canal where it crosses the west
 *  and east sides - each [side's index, the distance along it, the width]. */
export function helstromOpenings(H = HELSTROM) {
  const P = H.palisade,
    C = H.canal,
    ns = P.south - P.north;
  return [
    [0, P.east, P.gate],
    [2, -P.west, P.gate],
    [1, (C.z0 + C.z1) / 2 - P.north, C.z1 - C.z0],
    [3, ns - ((C.z0 + C.z1) / 2 - P.north), C.z1 - C.z0],
  ];
}
/**
 * THE PALISADE: logs side by side - a wall of timber, its top a row of sharpened points on both faces - broken for its
 * gates and the canal; a watchtower on stilts at each corner, its platform and its roof.
 */
export function buildPalisade(H = HELSTROM) {
  const mb = new MeshBuilder(),
    P = H.palisade,
    C = helstromCorners(P),
    open = helstromOpenings(H);
  for (let i = 0; i < 4; i++) {
    const p = C[i],
      q = C[(i + 1) % 4],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      ux = (q[0] - p[0]) / len,
      uz = (q[1] - p[1]) / len;
    const gaps = open
      .filter(([side]) => side === i)
      .map(([, at, w]) => [at - w / 2, at + w / 2])
      .sort((a, b) => a[0] - b[0]);
    let s0 = 0;
    for (const [g0, g1] of [...gaps, [len, len]]) {
      if (g0 > s0) {
        const a = [p[0] + ux * s0, p[1] + uz * s0],
          b = [p[0] + ux * g0, p[1] + uz * g0];
        wallRun(mb, TIMBER, a, b, 0.8, P.h, 1.5, 3);
        const nx = -uz,
          nz = ux;
        for (let t = s0; t + P.tooth <= g0; t += P.tooth)
          for (const side of [1, -1]) {
            const x0 = p[0] + ux * t + nx * 0.4 * side,
              z0 = p[1] + uz * t + nz * 0.4 * side,
              x1 = x0 + ux * P.tooth,
              z1 = z0 + uz * P.tooth;
            const l = Math.hypot(1, 0.3);
            mb.tri(
              TIMBER,
              [x0, P.h, z0],
              [x1, P.h, z1],
              [(x0 + x1) / 2 - nx * 0.4 * side, P.h + 1.2, (z0 + z1) / 2 - nz * 0.4 * side],
              [(nx * side) / l, 0.3 / l, (nz * side) / l],
            );
          }
      }
      s0 = Math.max(s0, g1);
    }
  }
  for (const [x, z] of C) {
    const s = P.tower / 2 - 0.4;
    for (const [dx, dz] of [
      [-s, -s],
      [s, -s],
      [-s, s],
      [s, s],
    ])
      mb.box(TIMBER, [x + dx, (P.towerH - 3) / 2, z + dz], [0.6, P.towerH + 3, 0.6], 0.5);
    hall(mb, TIMBER, x, z, P.tower, P.tower, P.towerH - 0.5, P.towerH, 0.5);
    hall(mb, TIMBER, x, z, P.tower, P.tower, P.towerH, P.towerH + 1.2, 0.5);
    pyramid(mb, TIMBER, x, z, P.tower + 1.6, P.tower + 1.6, P.towerH + 3.4, 3.5);
    for (const [dx, dz] of [
      [-s, -s],
      [s, -s],
      [-s, s],
      [s, s],
    ])
      mb.box(TIMBER, [x + dx, P.towerH + 2.3, z + dz], [0.4, 2.2, 0.4], 0.5);
  }
  return mb.build();
}
