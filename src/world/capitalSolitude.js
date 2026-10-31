// @ts-check
// TESA10 (bible/03-World/Arena-Provinces.md TESA10) - SOLITUDE'S LANDMARKS: the port's own models of the city's
// signatures (world/tamrielCapitals.js SOLITUDE says where each stands) - the sea stack and the Blue Palace on it, the
// great arch, the walls, Castle Dour and the Emperor's Tower (TESA-LORE), the docks - every model's origin Solitude's
// anchor. Shapes of the port's own in the spirit of the city's look - never another game's mesh. No game data.
// SOLITUDE-RELIEF: the landmarks at its rock's heights (world/solitudeRelief.js; the streets at 46 m, every model's y 0) -
// the arch of rock over the sea, the walls sunk into their cliffs, Castle Dour on its crag, the docks at the water, the
// Gate Road up the slope, and the cliffs' rock over every steep cell of the ground.
import { MeshBuilder } from './detStandIns.js';
import { urbanArt } from './urban/urbanRecords.js'; // URBANIZER U2: the towns' own cut stone and half-timbering
import {
  CAPITAL_ART,
  art,
  taper,
  translated,
  wallRun,
  merlons,
  gatedRun,
  roundTower,
  pyramid,
  gableRoof,
  hall,
  crenels,
  squareTower,
  darkDoor,
  entranceDoor,
  jitter,
  rockColumn,
  outward,
  blob,
  cap,
} from './capitalShapes.js';
import { SOLITUDE } from './tamrielCapitals.js';
import {
  solitudeHeight,
  inDocks,
  gateRoadPoints,
  gateRoadAt,
  SOLITUDE_LEVELS,
  SOLITUDE_PIXEL,
  SOLITUDE_EDGE_BAND,
  SOLITUDE_DOCKS,
  SOLITUDE_GATE_ROAD,
  SOLITUDE_CRAG,
  SOLITUDE_LANE,
  SOLITUDE_TERRACES,
} from './solitudeRelief.js'; // SOLITUDE-RELIEF: its ground
import { perlinNoise } from './perlin.js';

const MARBLE = art(CAPITAL_ART.marble),
  GOLD = art(CAPITAL_ART.gold),
  ROOF = art(CAPITAL_ART.roof),
  BRIDGE = art(CAPITAL_ART.bridgeStone);
const DARK = art(CAPITAL_ART.dark),
  ROCK = art(CAPITAL_ART.rock),
  BLUE = art(CAPITAL_ART.blueSlate),
  TIMBER = art(CAPITAL_ART.timber),
  NORD = art(CAPITAL_ART.nordStone);
const WATER = art(CAPITAL_ART.water);
/** URBANIZER U2 (world/urban/urbanArt.js): Castle Dour's keep and the Emperor's Tower in dressed stone, the warehouse's
 *  timber framing over plaster on a stone ground storey WAREHOUSE_PLINTH high (metres). */
const ASHLAR = urbanArt('ashlar'),
  HALF_TIMBER = urbanArt('halfTimber');
export const WAREHOUSE_PLINTH = 3;

/** A height over the sea as a landmark's y: every model's origin is the anchor on the streets' level. */
export const levelY = (h) => h - SOLITUDE_LEVELS.city;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The arch's deck at x, metres over the sea: from the stack's top (the palace's floor) to the terrace's, the terrace's
 *  past its east end. */
export const archTop = (x, A = SOLITUDE.arch) =>
  SOLITUDE_LEVELS.stack + (SOLITUDE_LEVELS.terrace - SOLITUDE_LEVELS.stack) * clamp01((x - A.from) / (A.to - A.from));
/** The arch's opening at x, metres over the sea: its intrados between its springs - rounded, its crown A.crown over the
 *  water - and the sea's 0 past them (its feet in the water). */
export const archOpening = (x, A = SOLITUDE.arch) =>
  x <= A.springW || x >= A.springE
    ? 0
    : A.crown * Math.sin(Math.PI * ((x - A.springW) / (A.springE - A.springW))) ** 0.55;
/** How far under the water the arch's feet and the stack's foot reach (metres). */
const UNDER = 16;

/**
 * THE ARCH (SOLITUDE-RELIEF): the sea stack - a column of rock from under the water to the palace's floor, its strata
 * stepping in as it climbs, boulders at its foot - and the natural arch from it to the city: its deck the stack's top
 * falling to the terrace's (archTop), paved between parapets; its body rough rock from its deck's lip down to its opening
 * over the water (archOpening), its sides flaring to its feet where they meet the water, its feet in the stack and the
 * city's cliff; then the palace terrace on the streets inside the west wall, its parapets, and its grand stair down east
 * to the street (steps of 0.3 m - the walk's step is 0.5).
 */
export function buildSolitudeArch(S = SOLITUDE) {
  const mb = new MeshBuilder(),
    A = S.arch,
    st = S.stack,
    L = S.landing;
  // the stack, its strata stepping in as it climbs
  const levels = [
    [-UNDER, st.foot + 5],
    [-2, st.foot + 3],
    [6, st.foot + 1],
    [14, st.foot - 2],
    [22, st.foot - 3],
    [31, st.foot - 6],
    [39, st.foot - 7],
    [47, st.foot - 10],
    [55, st.r + 3],
    [st.top, st.r],
  ];
  rockColumn(
    mb,
    ROCK,
    BRIDGE,
    st.x,
    st.z,
    32,
    levels.map(([y, r]) => [levelY(y), r]),
    { rough: 5.5, seed: 0x501 },
  );
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + jitter(0x507, i) * 0.6,
      r = st.foot + 2 + jitter(0x508, i) * 7,
      s = 3 + jitter(0x509, i) * 4;
    if (Math.cos(a) > 0.55 && Math.abs(Math.sin(a)) < 0.5) continue; // none in the opening under the arch
    blob(mb, ROCK, st.x + Math.cos(a) * r, levelY(0.5), st.z + Math.sin(a) * r, s * 1.4, s * 0.8, s, {
      n: 8,
      rings: 4,
      rough: 0.3,
      seed: 0x50a + i,
    });
  }
  // the arch: stations from inside the stack to inside the terrace, a section of rock at each
  const x0 = A.from - 6,
    x1 = 4,
    N = 44,
    hw = A.w / 2;
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  /** The section at station i, one side (s = +1 south, -1 north): its points from the deck's lip down to the soffit's
   *  middle, [z, y] in metres over the sea. */
  const section = (i, s) => {
    const x = xs[i],
      D = archTop(x, A),
      o = archOpening(x, A),
      I = o > 0 ? o : -UNDER,
      depth = D - I;
    const flare = (y) => 14 * clamp01((14 - y) / 30); // the feet widen where they meet the water
    const j = (k, w) => (jitter(0x502, i, k, s) - 0.5) * 2 * w;
    const pts = [
      [hw + 0.6, D - 0.2],
      [hw + 1.8 + j(1, 0.5), D - 2.2],
      [hw + 3.5 + j(2, 1.6) + flare(D - 0.18 * depth), D - 0.18 * depth + j(12, 1)],
      [hw + 6 + j(3, 2.4) + flare(D - 0.4 * depth), D - 0.4 * depth + j(13, 1.4)],
      [hw + 6.5 + j(4, 2.4) + flare(D - 0.62 * depth), D - 0.62 * depth + j(14, 1.4)],
      [hw + 4.5 + j(5, 2) + flare(D - 0.82 * depth), D - 0.82 * depth + j(15, 1)],
      [hw + 1 + j(6, 1.5) + flare(I + 1.5) * 0.6, I + 1.5 + j(16, 0.6)],
      [hw - 6 + j(7, 2), I + j(17, 0.8)],
      [0, I - 1.2 + j(18, 0.8)],
    ];
    return pts.map(([z, y]) => [x, levelY(y), s * z]);
  };
  const secS = xs.map((_, i) => section(i, 1)),
    secN = xs.map((_, i) => section(i, -1));
  for (let i = 0; i < N; i++) {
    const mid = [(xs[i] + xs[i + 1]) / 2, levelY((archTop(xs[i], A) + Math.max(-UNDER, archOpening(xs[i], A))) / 2), 0];
    for (const sec of [secS, secN]) {
      for (let k = 0; k + 1 < sec[i].length; k++) {
        const a = sec[i][k],
          b = sec[i + 1][k],
          c = sec[i + 1][k + 1],
          d = sec[i][k + 1];
        mb.quad(ROCK, a, b, c, d, outward(a, b, c, mid));
      }
    }
    // the deck: paved between the parapets, its lips the rock's
    const t0 = levelY(archTop(xs[i], A)),
      t1 = levelY(archTop(xs[i + 1], A)),
      pz = hw - 0.6;
    mb.quad(BRIDGE, [xs[i], t0, -pz], [xs[i + 1], t1, -pz], [xs[i + 1], t1, pz], [xs[i], t0, pz], [0, 1, 0]);
    for (const s of [1, -1]) {
      const sec = s > 0 ? secS : secN;
      mb.quad(ROCK, [xs[i], t0, s * pz], [xs[i + 1], t1, s * pz], sec[i + 1][0], sec[i][0], [0, 1, 0]);
      // the deck's wall: its outer face, its inner face and its walk, a merlon every few metres
      const zo = s * (pz + 0.5),
        zi = s * (pz - 0.5),
        ph = A.parapet;
      if (xs[i] >= A.from - 1 && xs[i + 1] <= A.to + 1) {
        mb.quad(
          NORD,
          [xs[i], t0 - 0.6, zo],
          [xs[i + 1], t1 - 0.6, zo],
          [xs[i + 1], t1 + ph, zo],
          [xs[i], t0 + ph, zo],
          [0, 0, s],
        );
        mb.quad(NORD, [xs[i], t0, zi], [xs[i + 1], t1, zi], [xs[i + 1], t1 + ph, zi], [xs[i], t0 + ph, zi], [0, 0, -s]);
        mb.quad(
          NORD,
          [xs[i], t0 + ph, zi],
          [xs[i + 1], t1 + ph, zi],
          [xs[i + 1], t1 + ph, zo],
          [xs[i], t0 + ph, zo],
          [0, 1, 0],
        );
        if (i % 2 === 0) mb.box(NORD, [(xs[i] + xs[i + 1]) / 2, (t0 + t1) / 2 + ph + 0.6, s * pz], [1.4, 1.2, 1], 0.4);
      }
    }
  }
  // the palace's gate on the deck at the stack's edge: two towers astride it and the gate's storey between them
  const gx = A.from + 6,
    gy = levelY(archTop(gx, A)),
    Gt = A.gate;
  for (const s of [1, -1])
    squareTower(mb, gx, s * (hw - Gt.s / 2 + 1.2), Gt.s, gy + Gt.h, { wall: NORD, roof: BLUE, roofH: 6, foot: gy - 6 });
  hall(mb, NORD, gx, 0, Gt.s - 1.5, A.w - 2 * Gt.s + 3, gy + Gt.gateH, gy + Gt.h - 2);
  crenels(mb, NORD, gx, 0, Gt.s - 1.5, A.w - 2 * Gt.s + 3, gy + Gt.h - 2, { pitch: 2.2 });
  // the palace terrace on the upper tier inside the west wall: a platform of dark stone, paved, its parapets; the grand
  // stair down east to the Avenues' street
  const top = levelY(L.top),
    foot = levelY(SOLITUDE_LEVELS.upper),
    cx = (L.x0 + L.x1) / 2,
    hz = L.w / 2,
    sw = L.stairW / 2;
  hall(mb, NORD, cx, 0, L.x1 - L.x0, L.w, foot - 3, top);
  mb.quad(
    BRIDGE,
    [L.x0, top + 0.02, -hz],
    [L.x1, top + 0.02, -hz],
    [L.x1, top + 0.02, hz],
    [L.x0, top + 0.02, hz],
    [0, 1, 0],
  );
  for (const s of [1, -1]) {
    wallRun(mb, NORD, [L.x0 + 4, s * (hz - 0.4)], [L.x1, s * (hz - 0.4)], 0.8, top + 1.1, -top, 4); // on its top, its faces the platform's
    wallRun(mb, NORD, [L.x1 - 0.4, s * hz], [L.x1 - 0.4, s * (sw + 0.6)], 0.8, top + 1.1, -top, 4);
  }
  stair(mb, [L.x1, 0], [L.stairTo, 0], L.stairW, top, foot);
  return mb.build();
}

/**
 * SOLITUDE-RELIEF: A STAIR of 0.3 m steps (the walk's step is 0.5) from its head at `a` (the anchor's metres, x and z
 * south) at `top` down to its foot at `b` at `foot` (the models' y), `w` wide, its steps paved and their fronts solid to a
 * metre under its foot, a balustrade falling with it either side. Its first tread is the head's level and its last a step
 * over the foot's, so a ground ramping straight from head to foot (world/solitudeRelief.js's lane stair) runs under every
 * tread, meeting each at its back edge.
 */
export function stair(mb, a, b, w, top, foot) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / len,
    uz = (b[1] - a[1]) / len,
    nx = -uz,
    nz = ux;
  const steps = Math.max(1, Math.round((top - foot) / 0.3)),
    run = len / steps;
  const P = (along, across, y) => [a[0] + ux * along + nx * across, y, a[1] + uz * along + nz * across];
  for (let k = 0; k < steps; k++) {
    const y = top - ((top - foot) * k) / steps,
      s0 = run * k,
      s1 = Math.min(len, run * (k + 1) + 0.02);
    const q = [P(s0, -w / 2, y), P(s1, -w / 2, y), P(s1, w / 2, y), P(s0, w / 2, y)];
    mb.quad(BRIDGE, q[0], q[1], q[2], q[3], [0, 1, 0]);
    mb.quad(BRIDGE, P(s1, -w / 2, foot - 1), P(s1, w / 2, foot - 1), P(s1, w / 2, y), P(s1, -w / 2, y), [ux, 0, uz]); // its front
    for (const side of [1, -1])
      mb.quad(
        NORD,
        P(s0, (side * w) / 2, foot - 1),
        P(s1, (side * w) / 2, foot - 1),
        P(s1, (side * w) / 2, y),
        P(s0, (side * w) / 2, y),
        [nx * side, 0, nz * side],
      );
  }
  for (const side of [1, -1]) {
    const e = side * (w / 2 + 0.3),
      h0 = top + 1.1,
      h1 = foot + 1.1;
    for (const off of [0.3, -0.3])
      mb.quad(NORD, P(0, e + off, top), P(len, e + off, foot), P(len, e + off, h1), P(0, e + off, h0), [
        nx * Math.sign(off),
        0,
        nz * Math.sign(off),
      ]);
    mb.quad(NORD, P(0, e - 0.3, h0), P(len, e - 0.3, h1), P(len, e + 0.3, h1), P(0, e + 0.3, h0), [0, 1, 0]);
  }
}

/**
 * THE BLUE PALACE on the stack's top (SOLITUDE-RELIEF: the city's highest floor): its court paved over the rock within a
 * balustrade, open to the arch, a fountain before the doors; the long hall under a gable of blue slate, its tall windows
 * and its portico on four columns facing the arch with the door (WW7-4: the palace's halls behind it); the north and south
 * wings round the court; the square tower over the hall's west end with its blue spire and gilt finial; round turrets at
 * the hall's west corners and the wings' east ends - pale stone under blue roofs.
 */
export function buildBluePalace(S = SOLITUDE) {
  const mb = new MeshBuilder(),
    B = S.palace,
    st = S.stack,
    y = levelY(st.top);
  // the court: paved over the stack's top, a balustrade round its rim but where the arch comes in, a fountain
  translated(mb, st.x, 0, st.z, () => cap(mb, BRIDGE, 28, st.r - 0.5, y + 0.03, 1));
  translated(mb, st.x, 0, st.z, () => {
    for (let i = 0; i < 28; i++) {
      const a0 = (i / 28) * Math.PI * 2,
        a1 = ((i + 1) / 28) * Math.PI * 2;
      if (Math.cos((a0 + a1) / 2) > 0.92) continue; // open to the arch (east)
      const r = st.r - 1.2,
        p = [Math.cos(a0) * r, Math.sin(a0) * r],
        q = [Math.cos(a1) * r, Math.sin(a1) * r];
      translated(mb, 0, y, 0, () => wallRun(mb, MARBLE, p, q, 0.6, 1.1, 0.2, 3));
    }
  });
  const F = B.fountain;
  translated(mb, F.x, y, F.z, () => {
    taper(mb, MARBLE, 16, F.r, 0, F.r, 0.9, { vRepeat: 1 });
    cap(mb, WATER, 16, F.r - 0.3, 0.6);
    taper(mb, MARBLE, 8, 0.5, 0.6, 0.35, 3.2, { vRepeat: 2 });
  });
  // the hall, its windows and its roof
  const Hh = B.hall;
  hall(mb, MARBLE, Hh.x, Hh.z, Hh.w, Hh.d, y - 1, y + Hh.h);
  gableRoof(mb, BLUE, MARBLE, Hh.x, Hh.z, Hh.w, Hh.d, y + Hh.h, Hh.roof);
  for (let wx = Hh.x - Hh.w / 2 + 4; wx <= Hh.x + Hh.w / 2 - 4; wx += 4.5) {
    for (const s of [1, -1]) {
      darkDoor(mb, DARK, wx, Hh.z + (s * Hh.d) / 2, 1.6, 4.2, [0, s], y + 4);
      darkDoor(mb, DARK, wx, Hh.z + (s * Hh.d) / 2, 1.4, 2.6, [0, s], y + 10.4);
    }
  }
  // the wings round the court
  for (const s of [1, -1]) {
    const Wg = B.wing,
      wz = Hh.z + s * Wg.dz;
    hall(mb, MARBLE, Wg.x, wz, Wg.w, Wg.d, y - 1, y + Wg.h);
    gableRoof(mb, BLUE, MARBLE, Wg.x, wz, Wg.w, Wg.d, y + Wg.h, Wg.roof);
    for (let wx = Wg.x - Wg.w / 2 + 3; wx <= Wg.x + Wg.w / 2 - 3; wx += 4)
      darkDoor(mb, DARK, wx, wz - (s * Wg.d) / 2, 1.4, 3.4, [0, -s], y + 3.5);
    roundTower(mb, Wg.x + Wg.w / 2, wz + s * (Wg.d / 2 - 1), B.turret.r - 0.8, B.turret.h - 8, {
      y,
      wall: MARBLE,
      roof: BLUE,
      roofH: B.turret.roof - 2,
    });
  }
  // the portico facing the arch: four columns, its pediment, the door
  const ex = Hh.x + Hh.w / 2,
    Po = B.portico;
  for (const cz of [-4.5, -1.5, 1.5, 4.5])
    translated(mb, ex + Po.d - 0.9, y, Hh.z + cz, () => taper(mb, MARBLE, 10, 0.55, 0, 0.48, Po.h, { vRepeat: 3 }));
  hall(mb, MARBLE, ex + Po.d / 2, Hh.z, Po.d, Po.w, y + Po.h, y + Po.h + 1.2);
  gableRoof(mb, BLUE, MARBLE, ex + Po.d / 2, Hh.z, Po.d, Po.w, y + Po.h + 1.2, 3, { alongX: true, over: 0.4 });
  hall(mb, MARBLE, ex + Po.d / 2, Hh.z, Po.d, Po.w, y - 0.6, y + 0.25);
  darkDoor(mb, DARK, ex, Hh.z, 4, 6.5, [1, 0], y);
  // the tower over the hall's west end: its shaft, crenels, its blue spire and gilt finial
  const T = B.tower,
    tx = Hh.x - Hh.w / 2 + T.s / 2 + 3;
  hall(mb, MARBLE, tx, Hh.z, T.s, T.s, y + Hh.h, y + T.h);
  for (const s of [1, -1]) {
    darkDoor(mb, DARK, tx, Hh.z + (s * T.s) / 2, 1.4, 4, [0, s], y + T.h - 9);
    darkDoor(mb, DARK, tx + (s * T.s) / 2, Hh.z, 1.4, 4, [s, 0], y + T.h - 9);
  }
  crenels(mb, MARBLE, tx, Hh.z, T.s, T.s, y + T.h, { pitch: 2.2, mh: 1 });
  pyramid(mb, BLUE, tx, Hh.z, T.s + 1, T.s + 1, y + T.h + 1, T.spire);
  translated(mb, tx, y + T.h + 1 + T.spire - 0.5, Hh.z, () => taper(mb, GOLD, 6, 0.5, 0, 0.02, 5, { vRepeat: 2 }));
  for (const s of [1, -1])
    roundTower(mb, Hh.x - Hh.w / 2, Hh.z + (s * Hh.d) / 2, B.turret.r, B.turret.h, {
      y,
      wall: MARBLE,
      roof: BLUE,
      roofH: B.turret.roof,
    });
  return { ...mb.build(), doors: [entranceDoor(ex, Hh.z, 4, 6.5, [1, 0], y)] }; // WW7-4: the palace's halls (world/capitalCastles.js)
}

/** The city wall's corners, in the order whose runs face their merlons out: north-east, north-west, south-west,
 *  south-east. */
export function solitudeWallCorners(W = SOLITUDE.wall) {
  return [
    [W.east, W.north],
    [W.west, W.north],
    [W.west, W.south],
    [W.east, W.south],
  ];
}
/**
 * THE WALLS: a towered rectangle of dark stone - the north side's gate down to the docks, the south side's main gate
 * under its gatehouse, the west side open where the arch's terrace meets it - square towers at its corners, either side
 * of each gate and of the arch, and along its sides. SOLITUDE-RELIEF: the north and west runs and their towers stand on
 * the cliffs' edges, sunk deep into the rock (`cliffSink`) so the cliff rises into the wall; and the Gate Road paved from
 * the slope's foot up to the main gate (gateRoad).
 */
export function buildSolitudeWall(S = SOLITUDE) {
  const mb = new MeshBuilder(),
    W = S.wall,
    deep = W.cliffSink,
    T = SOLITUDE_TERRACES,
    up = levelY(SOLITUDE_LEVELS.upper);
  const [ne, nw, sw, se] = solitudeWallCorners(W);
  // SOLITUDE-RELIEF: each run on its tier - the north, the east and the west's upper reach on the upper tier, the west's lower
  // reach and the south's as far as the lane on the Well District's; a tower where a run steps
  const on = (base, fn) => translated(mb, 0, base, 0, fn);
  const stepW = [W.west, T.line.z],
    stepS = [T.spur.x, W.south];
  on(up, () => gatedRun(mb, NORD, ne, nw, W.thick, W.h, W.east - W.northGate, W.gate, W.gateH, deep.north));
  const gapN = [W.west, -W.archGap],
    gapS = [W.west, W.archGap];
  on(up, () => {
    wallRun(mb, NORD, nw, gapN, W.thick, W.h, deep.west);
    merlons(mb, NORD, nw, gapN, W.thick, W.h);
  });
  on(up, () => {
    wallRun(mb, NORD, gapS, stepW, W.thick, W.h, deep.west);
    merlons(mb, NORD, gapS, stepW, W.thick, W.h);
  });
  wallRun(mb, NORD, stepW, sw, W.thick, W.h, deep.west);
  merlons(mb, NORD, stepW, sw, W.thick, W.h);
  gatedRun(mb, NORD, sw, stepS, W.thick, W.h, W.southGate - W.west, W.gate, W.gateH);
  on(up, () => {
    wallRun(mb, NORD, stepS, se, W.thick, W.h, 3 + up);
    merlons(mb, NORD, stepS, se, W.thick, W.h);
  });
  on(up, () => {
    wallRun(mb, NORD, se, ne, W.thick, W.h);
    merlons(mb, NORD, se, ne, W.thick, W.h);
  });
  // a tower stands on its run's tier: the west's below the step and the south's west of the lane's spur on the lower
  // the main gate's east tower stands where the south wall steps at the spur: on the upper tier, its foot down to the lane
  const step = (x, z) => z === W.south && Math.abs(x - T.spur.x) < W.tower;
  const towerBase = (x, z) =>
    (x === W.west && z > T.line.z) || (z === W.south && x < T.spur.x && !step(x, z)) ? 0 : up;
  for (const [x, z] of [...solitudeTowers(W), stepW]) {
    on(towerBase(x, z), () =>
      squareTower(mb, x, z, W.tower, W.towerH, {
        wall: NORD,
        roof: ROOF,
        roofH: 7,
        foot: z === W.north ? -deep.north : x === W.west ? -deep.west : step(x, z) ? -up - 3 : -3,
      }),
    );
  }
  // the main gate's gatehouse: a storey over the gate between its towers, crenellated
  const G = W.gatehouse,
    gx = W.southGate;
  hall(mb, NORD, gx, W.south, W.gate + 1, W.thick + 2 * G.out, W.gateH, W.h + G.up);
  crenels(mb, NORD, gx, W.south, W.gate + 1, W.thick + 2 * G.out, W.h + G.up, { pitch: 2.4 });
  darkDoor(mb, DARK, gx, W.south + W.thick / 2 + G.out, 1.4, 2.2, [0, 1], W.h);
  gateRoad(mb);
  return mb.build();
}
/** The wall's towers: its corners, a pair at each gate and at the arch, and those its sides stand between them. */
export function solitudeTowers(W = SOLITUDE.wall) {
  const g = W.gate / 2 + W.tower / 2 + 0.5;
  return [
    ...solitudeWallCorners(W),
    [W.northGate - g, W.north],
    [W.northGate + g, W.north],
    [W.southGate - g, W.south],
    [W.southGate + g, W.south],
    [W.west, -W.archGap - W.tower / 2 - 1.5],
    [W.west, W.archGap + W.tower / 2 + 1.5],
    ...W.along.north.map((x) => [x, W.north]),
    ...W.along.south.map((x) => [x, W.south]),
    ...W.along.west.map((z) => [W.west, z]),
    ...W.along.east.map((z) => [W.east, z]),
  ];
}
/** SOLITUDE-RELIEF: THE GROUND AS THE TERRAIN DRAWS IT - the relief at the terrain's own vertices (world/terrain/
 *  capitalRelief.js), each cell cut south-west to north-east (world/terrain/terrainSurface.js surfaceHeightAt's): `h` its
 *  vertices' metres over the sea (x east, y north, `N` + 1 a side, `cell` metres apart), `H(x, y)` one of them (held to
 *  the pixel), `at(x, z)` the drawn ground's metres over the sea at a point of the anchor's metres. Made once. */
let _drawn = null;
export function solitudeDrawn() {
  if (_drawn) return _drawn;
  const P = SOLITUDE_PIXEL,
    N = 128,
    Hd = N + 1,
    cell = P.side / N,
    h = new Float32Array(Hd * Hd);
  for (let x = 0; x <= N; x++)
    for (let y = 0; y <= N; y++) h[x * Hd + y] = solitudeHeight(P.x0 + x * cell, P.z0 + (N - y) * cell);
  const clampI = (v) => Math.max(0, Math.min(N, v)),
    H = (x, y) => h[clampI(x) * Hd + clampI(y)];
  const at = (ax, az) => {
    const fx = (ax - P.x0) / cell,
      fy = N - (az - P.z0) / cell,
      qx = Math.max(0, Math.min(N - 1, Math.floor(fx))),
      qy = Math.max(0, Math.min(N - 1, Math.floor(fy)));
    const u = fx - qx,
      v = fy - qy,
      h00 = H(qx, qy),
      h10 = H(qx + 1, qy),
      h01 = H(qx, qy + 1),
      h11 = H(qx + 1, qy + 1);
    return v >= u ? h00 + v * (h01 - h00) + u * (h11 - h01) : h00 + u * (h10 - h00) + v * (h11 - h10);
  };
  return (_drawn = { h, H, at, N, Hd, cell });
}
/** The Gate Road's paving keeps north of this (anchor metres, z south): the edge band's last row of samples, the land's own
 *  ground eased in south of it (world/terrain/capitalRelief.js) - the country's road painted over that stretch (the
 *  city's own step, world/tamrielRoads.js). */
const ROAD_FROM = SOLITUDE_PIXEL.z0 + SOLITUDE_PIXEL.side - SOLITUDE_EDGE_BAND * (SOLITUDE_PIXEL.side / 128);
/** The Gate Road's paving's strips either side of its middle line. */
const ACROSS = 4;
/**
 * SOLITUDE-RELIEF: THE GATE ROAD, paved (world/solitudeRelief.js SOLITUDE_GATE_ROAD): its line every 2 m, its width laid
 * across it square to its run (through a bend, square to the bend - the paving never folds), every corner on the ground
 * the terrain draws there a hand over it; a low wall on whichever side the ground falls more than a man's height below
 * its edge. From the edge band's last row to the main gate's passage - its last straight run the gate's own line.
 */
function gateRoad(mb) {
  const G = SOLITUDE_GATE_ROAD,
    P = gateRoadPoints,
    D = solitudeDrawn(),
    pts = [];
  for (let i = 1; i < P.length; i++) {
    const [ax, az] = P[i - 1],
      [bx, bz] = P[i],
      n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  const across = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  });
  // a point across the road (s from -1, its right edge, to 1, its left), on the drawn ground a hand over it - ACROSS strips
  // a side, so the paving bends with the ground where the terrain's own cells crease under it
  const edge = (i, s) => {
    const x = pts[i][0] + across[i][0] * G.half * s,
      z = pts[i][1] + across[i][1] * G.half * s;
    return [x, levelY(D.at(x, z)) + 0.1, z];
  };
  const falls = (i, s) => {
    const [x, y, z] = edge(i, s);
    return y - levelY(D.at(x + across[i][0] * 6 * s, z + across[i][1] * 6 * s)) > 1.8;
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a0 = edge(i, -1),
      a1 = edge(i, 1),
      b0 = edge(i + 1, -1),
      b1 = edge(i + 1, 1);
    if (Math.max(a0[2], a1[2], b0[2], b1[2]) > ROAD_FROM) continue; // the band's: the land's own ground, the country's road on it
    for (let j = 0; j < 2 * ACROSS; j++) {
      const s0 = j / ACROSS - 1,
        s1 = (j + 1) / ACROSS - 1;
      mb.quad(BRIDGE, edge(i, s0), edge(i + 1, s0), edge(i + 1, s1), edge(i, s1), [0, 1, 0]);
    }
    for (const s of [1, -1]) {
      if (!falls(i, s) || !falls(i + 1, s)) continue;
      const pa = s > 0 ? a1 : a0,
        pb = s > 0 ? b1 : b0;
      wallRun(
        mb,
        NORD,
        [pa[0], pa[2]],
        [pb[0], pb[2]],
        0.6,
        (pa[1] + pb[1]) / 2 + 0.9,
        -Math.min(pa[1], pb[1]) + 2.5,
        3,
      );
    }
  }
}

/**
 * CASTLE DOUR: a square curtain of dark stone with square towers at its corners and two gates - TESA-LORE: west, to the
 * lane from the city's main gate it stands just within, and north, to the city and the Temple of the Divines on its
 * grounds (UESP: "Castle Dour has two gateways"); the keep inside under a slate gable, a turret at each of its corners, its
 * door to the yard; the Emperor's Tower in the north-west of the yard, the tallest thing on the city's ground.
 * SOLITUDE-RELIEF: on its crag (world/solitudeRelief.js SOLITUDE_CRAG) - its yard over the streets, the curtain rising from
 * the street outside to its walk over the yard, its gates at the street's level, a ramp inside each.
 */
export function buildCastleDour(S = SOLITUDE) {
  const mb = new MeshBuilder(),
    C = S.castle,
    h = C.half,
    up = levelY(SOLITUDE_LEVELS.upper);
  const ne = [C.x + h, C.z - h],
    nw = [C.x - h, C.z - h],
    sw = [C.x - h, C.z + h],
    se = [C.x + h, C.z + h];
  gatedRun(mb, NORD, ne, nw, C.thick, up + C.h, h, C.gate, up + C.gateH); // SOLITUDE-RELIEF: the north gate level with the upper tier's court
  gatedRun(mb, NORD, nw, sw, C.thick, up + C.h, h, C.gate, C.gateH); // the west gate at the lane's level
  wallRun(mb, NORD, sw, se, C.thick, up + C.h);
  merlons(mb, NORD, sw, se, C.thick, up + C.h);
  wallRun(mb, NORD, se, ne, C.thick, up + C.h);
  merlons(mb, NORD, se, ne, C.thick, up + C.h);
  for (const [x, z] of [ne, nw, sw, se])
    squareTower(mb, x, z, C.tower, up + C.towerH, { wall: NORD, roof: ROOF, roofH: 8 });
  const K = S.keep,
    kx = C.x + K.dx,
    kz = C.z + K.dz;
  hall(mb, ASHLAR, kx, kz, K.w, K.d, up - 3, up + K.h); // URBANIZER U2: the keep in dressed stone, its curtain the rubble round it
  gableRoof(mb, ROOF, ASHLAR, kx, kz, K.d, K.w, up + K.h, K.roof, { alongX: false });
  darkDoor(mb, DARK, kx - K.w / 2, kz, 3.6, 5.5, [-1, 0], up);
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      squareTower(mb, kx + (sx * K.w) / 2, kz + (sz * K.d) / 2, 6, up + K.h + 6, {
        wall: NORD,
        roof: ROOF,
        roofH: 5,
        foot: up - 3,
      }); // TESA-LORE: its corner turrets
  const E = S.emperorsTower;
  squareTower(mb, C.x + E.dx, C.z + E.dz, E.s, up + E.h, { wall: ASHLAR, roof: ROOF, roofH: E.roof, foot: up - 3 }); // URBANIZER U2: dressed stone
  // SOLITUDE-RELIEF: the west curtain's foot where the ground steps under it - a plinth along the lane and a walk inside it
  // (either side of the gate), and the ramp's retaining walls from the west gate up to the yard
  const P = 1.6,
    wx = C.x - h,
    R = SOLITUDE_CRAG;
  for (const [z0, z1] of [
    [C.z - h, C.z - C.gate / 2],
    [C.z + C.gate / 2, C.z + h],
  ]) {
    hall(mb, NORD, wx - C.thick / 2 - P / 2, (z0 + z1) / 2, P, z1 - z0, -1, 1.6);
    hall(mb, BRIDGE, wx + C.thick / 2 + P / 2, (z0 + z1) / 2, P, z1 - z0, up - 2, up + 0.05);
  }
  for (const s of [1, -1]) {
    const z = C.z + s * (R.rampW / 2 + 0.4),
      x0 = wx + C.thick / 2,
      x1 = wx + R.ramp + (R.half - R.inner);
    wallRun(mb, NORD, [x0, z], [x1, z], 0.8, up + 1.1, 1, 4);
  }
  return mb.build();
}

/**
 * THE DOCKS (SOLITUDE-RELIEF: at the water, under the north cliff): the quay's kerb along the sea and round its ends,
 * timber piers out over the sea on posts, the East Empire Company's long warehouse against the causeway's wall under a
 * slate gable, its doors to the quay and to the Docks Way's foot; and the Docks Way's parapets - along the ledge's outer
 * edge and the gate's landing, round the hairpin, and along the causeway wherever its fall to the quay is more than a man's
 * height - each following its deck down (world/solitudeRelief.js SOLITUDE_DOCKS).
 */
export function buildSolitudeDocks(S = SOLITUDE) {
  const mb = new MeshBuilder(),
    D = S.docks,
    Q = S.quay,
    R = SOLITUDE_DOCKS,
    q = levelY(SOLITUDE_LEVELS.quay),
    sea = levelY(0);
  // the kerb a cell out over the sea's side: the ground falls from the quay's edge to the sea across that cell
  const c = SOLITUDE_PIXEL.side / 128,
    n = D.edge - c;
  hall(mb, NORD, (Q.x0 + Q.x1) / 2, (n + D.edge + 1.2) / 2, Q.x1 - Q.x0 + 2 * c, c + 1.2, sea - 4, q + 0.4, 0.5);
  hall(mb, NORD, Q.x0 + (1.2 - c) / 2, (n + R.back) / 2, c + 1.2, R.back - n, sea - 4, q + 0.4, 0.5);
  hall(mb, NORD, Q.x1 - (1.2 - c) / 2, (n + R.arrival.z1) / 2, c + 1.2, R.arrival.z1 - n, sea - 4, q + 0.4, 0.5);
  for (const x of D.piers) {
    const len = D.edge - D.pierTo,
      zc = (D.edge + D.pierTo) / 2;
    hall(mb, TIMBER, x, zc, D.pierW, len, q + D.deck - 0.4, q + D.deck, 0.5);
    for (let z = D.edge - 4; z > D.pierTo; z -= 8)
      for (const s of [1, -1])
        mb.box(
          TIMBER,
          [x + s * (D.pierW / 2 - 0.5), (q + D.deck - 0.4 + sea - 4) / 2, z],
          [0.6, q + D.deck - 0.4 - sea + 4, 0.6],
          0.5,
        );
    for (const s of [1, -1])
      mb.box(TIMBER, [x + s * (D.pierW / 2 - 0.4), q + D.deck + 0.5, D.pierTo + 1.5], [0.5, 1, 0.5], 0.5); // its bollards
  }
  const H = D.warehouse;
  hall(mb, NORD, H.x, H.z, H.w, H.d, q - 1, q + WAREHOUSE_PLINTH); // URBANIZER U2: a stone ground storey, timber framing over plaster above it
  hall(mb, HALF_TIMBER, H.x, H.z, H.w, H.d, q + WAREHOUSE_PLINTH, q + H.h);
  gableRoof(mb, ROOF, HALF_TIMBER, H.x, H.z, H.w, H.d, q + H.h, H.roof);
  for (const dx of [-H.w / 4, H.w / 4]) darkDoor(mb, DARK, H.x + dx, H.z - H.d / 2, 5, 5, [0, -1], q);
  darkDoor(mb, DARK, H.x + H.w / 2, H.z, 4, 4.5, [1, 0], q);
  // the quay's goods: crates and barrels by the warehouse's doors
  for (let i = 0; i < 10; i++) {
    const x = H.x - H.w / 2 + 4 + jitter(0x5d1, i) * (H.w - 8),
      z = H.z - H.d / 2 - 2.5 - jitter(0x5d2, i) * 3,
      s = 0.9 + jitter(0x5d3, i) * 0.5;
    if (i % 3) mb.box(TIMBER, [x, q + s / 2, z], [s, s, s], 0.6);
    else
      translated(mb, x, q, z, () => {
        taper(mb, TIMBER, 8, 0.42, 0, 0.42, 1.1, { vRepeat: 1 });
        cap(mb, TIMBER, 8, 0.42, 1.1);
      });
  }
  // the Docks Way's parapets
  const U = R.upper,
    P = R.hairpin,
    Wy = R.lower,
    G = R.gate,
    ph = 1.1;
  const deckAt = (x, z) => levelY(solitudeHeight(x, z));
  /** @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {(x: number, z: number) => boolean} [keep] */
  const parapet = (x0, z0, x1, z1, keep = () => true) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3.2));
    for (let k = 0; k < n; k++) {
      const ax = x0 + ((x1 - x0) * k) / n,
        az = z0 + ((z1 - z0) * k) / n,
        bx = x0 + ((x1 - x0) * (k + 1)) / n,
        bz = z0 + ((z1 - z0) * (k + 1)) / n;
      if (!keep((ax + bx) / 2, (az + bz) / 2)) continue;
      const ya = deckAt(ax, az),
        yb = deckAt(bx, bz);
      wallRun(mb, NORD, [ax, az], [bx, bz], 0.6, Math.max(ya, yb) + ph, -Math.min(ya, yb) + 1.2, 3);
    }
  };
  const inset = 0.5;
  parapet(P.x0 + inset, U.z0 + inset, G.x1, U.z0 + inset); // the ledge's and the landing's outer edge
  parapet(P.x0 + inset, U.z1, P.x0 + inset, P.z0 + inset); // the hairpin's west end
  parapet(P.x0 + inset, P.z0 + inset, P.x1, P.z0 + inset); // the hairpin's north edge
  parapet(
    Wy.x0,
    Wy.z0 + inset,
    Wy.x1,
    Wy.z0 + inset,
    (x, z) => solitudeHeight(x, z + 0.5 - inset) - SOLITUDE_LEVELS.quay > 1.8,
  ); // the causeway's, while it stands over the quay
  return mb.build();
}

/**
 * SOLITUDE-RELIEF: THE TERRACES' WORKS (world/solitudeRelief.js SOLITUDE_TERRACES): the retaining wall between the Well
 * District and the upper tier - its body the upper blocks' edge cell, where the ground steps, from the west wall to the
 * lane, faced in dark stone, paved on top, a parapet along its edge but over each stair's landing; the stairs up its
 * face, each from its foot on the Well District's street to a landing at the wall's top; the lane's stair from the main
 * gate's lane up to Castle Dour's north court; and the spur south from the castle's south-west tower to the city wall,
 * where the lane meets the castle's raised south yard.
 */
export function buildSolitudeTerraces() {
  const mb = new MeshBuilder(),
    T = SOLITUDE_TERRACES,
    L = T.line,
    N = SOLITUDE_LANE,
    S = T.spur,
    up = levelY(SOLITUDE_LEVELS.upper),
    sw = T.stairW;
  const z0 = L.z - L.depth,
    z1 = L.z + 0.4;
  hall(mb, NORD, (L.x0 + L.x1) / 2, (z0 + z1) / 2, L.x1 - L.x0, z1 - z0, -1, up);
  mb.quad(
    BRIDGE,
    [L.x0, up + 0.03, z0],
    [L.x1, up + 0.03, z0],
    [L.x1, up + 0.03, z1],
    [L.x0, up + 0.03, z1],
    [0, 1, 0],
  );
  // its parapet, open over every stair's landing
  const gaps = T.stairs.map(([, b]) => [b, b + sw]).sort((p, q) => p[0] - q[0]);
  let from = /** @type {number} */ (L.x0);
  for (const [g0, g1] of [...gaps, [L.x1, L.x1]]) {
    if (g0 - from > 0.5) wallRun(mb, NORD, [from, z1 - 0.3], [g0, z1 - 0.3], 0.6, up + 1.1, -up, 3); // on the wall's top, its face the wall's
    from = g1;
  }
  for (const [a, b] of T.stairs) {
    const zc = z1 + sw / 2;
    stair(mb, [b, zc], [a, zc], sw, up, 0);
    hall(mb, BRIDGE, b + sw / 2, zc, sw, sw, -1, up); // its landing at the wall's top
    // its parapets along its south and east edges, on its top
    wallRun(mb, NORD, [b, z1 + sw - 0.3], [b + sw, z1 + sw - 0.3], 0.6, up + 1.1, -up, 3);
    wallRun(mb, NORD, [b + sw - 0.3, z1], [b + sw - 0.3, z1 + sw - 0.6], 0.6, up + 1.1, -up, 3);
  }
  // the lane's stair, its head on the upper tier at Castle Dour's north court
  const lw = N.x1 - N.x0 - 4.4,
    lx = N.x0 + 0.4 + lw / 2;
  stair(mb, [lx, N.stairTop], [lx, N.stairFoot], lw, up, 0);
  // the spur: the castle's south yard's retaining wall along the lane, to the city wall
  hall(mb, NORD, S.x, (S.z0 + S.z1) / 2, 2 * S.half, S.z1 - S.z0, -1, up);
  mb.quad(
    BRIDGE,
    [S.x - S.half, up + 0.03, S.z0],
    [S.x + S.half, up + 0.03, S.z0],
    [S.x + S.half, up + 0.03, S.z1],
    [S.x - S.half, up + 0.03, S.z1],
    [0, 1, 0],
  );
  wallRun(mb, NORD, [S.x - S.half + 0.3, S.z0], [S.x - S.half + 0.3, S.z1], 0.6, up + 1.1, -up, 3); // its parapet on its top
  return mb.build();
}

// ---------------------------------------------------------------- SOLITUDE-RELIEF: the rock

/** How steep, metres across a terrain cell's corners, a cell is before the rock is drawn over it. */
export const CLIFF_STEEP = 3.2;
/** The rock's reach out of the ground: its least everywhere (the cliff's lip where it meets the level ground) and how much
 *  more its strata bulge where every cell round a vertex is the cliff's; the masonry of the Docks Way's walls a hand's. */
export const CLIFF_SKIN = Object.freeze({ least: 0.15, bulge: 1.5, masonry: 0.25, sub: 4, under: 6 });

/**
 * THE CLIFFS (SOLITUDE-RELIEF): the rock over every steep cell of the terrain's own grid (corners climbing more than
 * CLIFF_STEEP), clear of the pixel's edge band - drawn on the terrain's own triangles (terrainSurface.js surfaceHeightAt),
 * CLIFF_SKIN.sub a side, stood off along the ground's smooth normal: its least everywhere, its strata's bulge where every
 * cell round a vertex is the cliff's, eased so two cells meet without a crack. Its foot plunges CLIFF_SKIN.under metres
 * under the sea; inside the docks' square it is the Docks Way's battered masonry.
 */
export function buildSolitudeCliffs() {
  const mb = new MeshBuilder(),
    P = SOLITUDE_PIXEL,
    band = SOLITUDE_EDGE_BAND,
    K = CLIFF_SKIN.sub,
    { N, Hd, cell, H } = solitudeDrawn();
  const ax = (x) => P.x0 + x * cell,
    az = (y) => P.z0 + (N - y) * cell; // a vertex (x east, y north) in the anchor's metres
  const G = SOLITUDE_GATE_ROAD,
    onRoad = (x, z) => gateRoadAt(x, z).d < G.half + G.shoulder + cell; // the Gate Road's banks earth, not a cliff - a cell past their foot
  const steep = new Uint8Array(N * N),
    Wl = SOLITUDE.wall,
    inCity = (x, z) => x > Wl.west && x < Wl.east && z > Wl.north && z < Wl.south;
  for (let x = band + 1; x < N - band - 1; x++) {
    // a cell clear of the band: its skin, stood off, never reaches into it
    for (let y = band + 1; y < N - band - 1; y++) {
      if (inCity(ax(x + 0.5), az(y + 0.5)) || onRoad(ax(x + 0.5), az(y + 0.5))) continue; // inside the walls the terraces' own works stand on the steps
      const c = [H(x, y), H(x + 1, y), H(x, y + 1), H(x + 1, y + 1)];
      if (Math.max(...c) - Math.min(...c) > CLIFF_STEEP) steep[x * N + y] = 1;
    }
  }
  // a lone steep cell no cliff: one with fewer than two steep neighbours of its eight is the ground's own (a bank's foot)
  const lone = [];
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      if (!steep[x * N + y]) continue;
      let n = 0;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < N && y + dy < N && steep[(x + dx) * N + y + dy]) n++;
      if (n < 2) lone.push(x * N + y);
    }
  }
  for (const i of lone) steep[i] = 0;
  const isSteep = (x, y) => x >= 0 && y >= 0 && x < N && y < N && steep[x * N + y] === 1;
  // a vertex's weight: whole where every cell round it is the cliff's; its normal the ground's (central differences)
  const W = new Float32Array(Hd * Hd),
    nrm = new Float32Array(Hd * Hd * 3);
  for (let x = 0; x <= N; x++) {
    for (let y = 0; y <= N; y++) {
      W[x * Hd + y] = isSteep(x - 1, y - 1) && isSteep(x, y - 1) && isSteep(x - 1, y) && isSteep(x, y) ? 1 : 0;
      // the map's frame: x east, y up, z south - the slope along z south is minus the slope north
      const gx = (H(x + 1, y) - H(x - 1, y)) / (2 * cell),
        gzS = -(H(x, y + 1) - H(x, y - 1)) / (2 * cell),
        l = Math.hypot(gx, 1, gzS);
      nrm.set([-gx / l, 1 / l, -gzS / l], (x * Hd + y) * 3);
    }
  }
  for (let qx = 0; qx < N; qx++) {
    for (let qy = 0; qy < N; qy++) {
      if (!steep[qx * N + qy]) continue;
      const masonry = inDocks(ax(qx + 0.5), az(qy + 0.5)),
        tex = masonry ? NORD : ROCK;
      const h00 = H(qx, qy),
        h10 = H(qx + 1, qy),
        h01 = H(qx, qy + 1),
        h11 = H(qx + 1, qy + 1);
      const corner = (A, k) => [
        A[(qx * Hd + qy) * k],
        A[((qx + 1) * Hd + qy) * k],
        A[(qx * Hd + qy + 1) * k],
        A[((qx + 1) * Hd + qy + 1) * k],
      ];
      // a point of the cell (u east, v north, 0..1): its place on the drawn ground, stood off along the eased normal
      const at = (u, v) => {
        const base = v >= u ? h00 + v * (h01 - h00) + u * (h11 - h01) : h00 + u * (h10 - h00) + v * (h11 - h10);
        const bl = (c) => c[0] * (1 - u) * (1 - v) + c[1] * u * (1 - v) + c[2] * (1 - u) * v + c[3] * u * v;
        const w = bl(corner(W, 1));
        const n = [0, 1, 2].map((k) =>
          bl([
            nrm[(qx * Hd + qy) * 3 + k],
            nrm[((qx + 1) * Hd + qy) * 3 + k],
            nrm[(qx * Hd + qy + 1) * 3 + k],
            nrm[((qx + 1) * Hd + qy + 1) * 3 + k],
          ]),
        );
        const nl = Math.hypot(n[0], n[1], n[2]) || 1,
          x = ax(qx + u),
          z = az(qy + v);
        // strata: bands along the height, broken along the face
        const strata =
          perlinNoise((x + z) * 0.09, base * 0.33) * 0.7 + perlinNoise(x * 0.31 + 91, z * 0.31 - base * 0.12) * 0.3;
        const d = masonry ? CLIFF_SKIN.masonry : CLIFF_SKIN.least + w * CLIFF_SKIN.bulge * strata;
        const y = base <= 0.02 ? levelY(base) - CLIFF_SKIN.under : levelY(base);
        return [x + (n[0] / nl) * d, y + (n[1] / nl) * d, z + (n[2] / nl) * d];
      };
      const pts = [];
      for (let i = 0; i <= K; i++) {
        pts.push([]);
        for (let j = 0; j <= K; j++) pts[i].push(at(i / K, j / K));
      }
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          // the drawn ground's own diagonal, south-west (i, j) to north-east (i + 1, j + 1)
          const sw = pts[i][j],
            se = pts[i + 1][j],
            nw = pts[i][j + 1],
            ne = pts[i + 1][j + 1];
          for (const [a, b, c] of [
            [sw, nw, ne],
            [sw, ne, se],
          ]) {
            const n = faceUp(a, b, c);
            if (n) mb.tri(tex, a, b, c, n);
          }
        }
      }
    }
  }
  return mb.build();
}
/** A triangle's own unit normal turned up out of the ground (a face of the rock over the ground's height field), or null
 *  for a sliver. */
function faceUp(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]);
  if (!(l > 1e-6)) return null;
  return n[1] < 0 ? n.map((k) => -k / l) : n.map((k) => k / l);
}
