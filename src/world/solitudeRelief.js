// @ts-check
// SOLITUDE-RELIEF (2026-10-27, the owner: "transform solitude to match this as close to 1:1 as possible", "solitude is the
// first city where I want to really explore varied depths of terrain"; bible/03-World/Arena-Provinces.md) - Solitude's
// ground: metres over the sea at any point of its pixel, the anchor's metres (x east, z south). Two tiers on the headland,
// cliffs to the sea west and north and to the country east, the docks' shelf and the Docks Way under the north cliff, the
// south slope and the Gate Road. Daggerfall's blocks stand on its tiers (capitalBlockLift), the landmarks at its heights
// (capitalSolitude.js), the pixel's edge band eased to the land's own (terrain/capitalRelief.js). Pure and worker-safe:
// the terrain worker asks it a vertex at a time.
import { perlinNoise } from './perlin.js';
import { BLOCK_M } from './blockHash.js';

/** The terrain's sample spacing, metres (world/terrain/terrainSampler.js: 819.2 / 128). */
const CELL = BLOCK_M / 16;
/** The pixel's west and north edges in the anchor's metres (the anchor the plan's grid point (2, 3)). */
export const SOLITUDE_PIXEL = Object.freeze({ x0: -2 * BLOCK_M, z0: -3 * BLOCK_M, side: 8 * BLOCK_M });
/** How many samples in from the pixel's edge the land's own heights are eased to (world/terrain/capitalRelief.js). */
export const SOLITUDE_EDGE_BAND = 3;

/** SOLITUDE'S LEVELS, metres over the sea: the Well District's streets and the main gate (`city` - the location's own
 *  flatten, every landmark's y 0), the upper tier's (the Avenues, Castle Dour's grounds), the palace terrace (the arch's
 *  deck at the city's end), the stack's top (the Blue Palace's floor) and the quay. */
export const SOLITUDE_LEVELS = Object.freeze({ city: 46, upper: 52, terrace: 60, stack: 64, quay: 2.4 });

/**
 * THE HEADLAND'S EDGES (the cliffs' tops, the anchor's metres) and each cliff's band - how far out from its top it meets
 * its foot - and the noise that wears each line: its top worn outward by up to `wear` metres and its band widened by up
 * to `widen` of itself, along a wavelength of `wave`. The tops stand outside the walls' outer faces (world/
 * tamrielCapitals.js SOLITUDE.wall: west -7, north -108, east 530, their faces 2.5 m out) by at least 1.5 m. The west's
 * and the north's feet are the sea; the east's is the country's own height along the pixel's east edge
 * (SOLITUDE_EAST_EDGE) - the sea north of the headland's neck, the hill to the south-east.
 */
export const SOLITUDE_CLIFFS = Object.freeze({
  west: -12,
  north: -112,
  east: 546,
  south: 422,
  bandWest: 15,
  bandNorth: 13,
  bandEast: 18,
  wear: 12,
  widen: 0.5,
  wave: 47,
});
/** A cliff's profile: the height's share at `t` of its band (0 its top, 1 its foot) - sheer at the top, a talus below. */
export const cliffProfile = (t) => (t <= 0 ? 1 : t >= 1 ? 0 : (1 - t) ** 2.2);

/**
 * THE DOCKS (the anchor's metres, every edge on the terrain's sample lines - multiples of its cell from the pixel's
 * north-west corner): the quay's shelf at the quay level from x0 to x1, its sea edge at `edge` (north) and its back at
 * `back` - reaching to `arrival.z1` where the causeway comes down; the Docks Way's ledge (`upper`, west from the north
 * gate's landing to the hairpin) and causeway (`lower`, east from the hairpin to the quay) - each deck between two rows of
 * samples, so the ground under it is flat across, its heights a line from end to end; the north gate's landing outside
 * the wall and the hairpin's. Inside the docks' square (x0..x1, edge..`top`) no ground is the sea's.
 */
export const SOLITUDE_DOCKS = Object.freeze({
  x0: 51.2,
  x1: 409.6,
  edge: -166.4,
  back: -134.4,
  top: -108.8,
  gate: Object.freeze({ x0: 236.8, x1: 262.4, z0: -121.6, z1: -108.8 }),
  upper: Object.freeze({ z0: -121.6, z1: -115.2, x0: 83.2, x1: 236.8, h0: 34, h1: SOLITUDE_LEVELS.upper }),
  hairpin: Object.freeze({ x0: 57.6, x1: 83.2, z0: -134.4, z1: -115.2, h: 34 }),
  lower: Object.freeze({ z0: -134.4, z1: -128, x0: 83.2, x1: 377.6, h0: 34, h1: SOLITUDE_LEVELS.quay }),
  arrival: Object.freeze({ x0: 377.6, x1: 409.6, z1: -128 }),
});

/** THE MAIN GATE: its middle on the south wall's line, on the gate's lane (world/tamrielCapitals.js SOLITUDE.wall's
 *  `southGate` and `south` - AUDIT TESA II C10: between the tavern's block and Castle Dour's west curtain). */
export const SOLITUDE_MAIN_GATE = Object.freeze({ x: 318.4, z: 416 });
/**
 * THE GATE ROAD: the country's road on from the pixel's south edge's middle (world/tamrielRoads.js; painted through the
 * rim, SOLITUDE `rimTiles`) - north, east along the slope's foot, up under the walls in a switchback, and onto the gate's
 * own line, square into the gate at its width. `corners` its line, each bend an arc of `bend` m (gateRoadLine); its
 * heights the slope's, never falling, never steeper than `grade`, the gate's at the most (gateRoadPoints); `half` its
 * half-width, `shoulder` the bank where the slope meets it.
 */
export const SOLITUDE_GATE_ROAD = Object.freeze({
  corners: Object.freeze(
    [
      [204.8, 512],
      [204.8, 480],
      [470, 480],
      [470, 444],
      [SOLITUDE_MAIN_GATE.x, 444],
      [SOLITUDE_MAIN_GATE.x, SOLITUDE_MAIN_GATE.z - 3],
    ].map((p) => Object.freeze(p)),
  ),
  bend: 10,
  half: 5,
  shoulder: 12,
  grade: 0.16,
});
/** THE EAST: the land's own height along the pixel's east edge the east cliff falls to - [z, metres] (the freeware's,
 *  measured: the sea north of the headland's neck, the hill rising south). A design line, as the south's. */
export const SOLITUDE_EAST_EDGE = Object.freeze(
  [
    [-307.2, 0],
    [51.2, 0],
    [102.4, 10],
    [153.6, 18],
    [204.8, 27],
    [256, 34],
    [307.2, 39],
    [358.4, 42],
    [409.6, 43],
    [460.8, 45],
    [512, 47],
  ].map((p) => Object.freeze(p)),
);
/** THE SOUTH: the land's own height along the pixel's south edge the slope below the walls falls to - [x, metres] (the
 *  freeware's, measured: the sea west of 150 m, the country rising east to the south-east corner's hill). A design line:
 *  the edge band eases to whatever the land is there. */
export const SOLITUDE_SOUTH_EDGE = Object.freeze(
  [
    [-204.8, 0],
    [150, 0],
    [204.8, 7],
    [256, 16],
    [307.2, 24],
    [358.4, 31],
    [409.6, 36],
    [460.8, 40],
    [512, 41],
    [563.2, 44],
    [614.4, 47],
  ].map((p) => Object.freeze(p)),
);

/** CASTLE DOUR'S CRAG: its square (the curtain's middle line, world/tamrielCapitals.js SOLITUDE.castle), its yard on the
 *  upper tier inside the curtain's inner face; a ramp inside its west gate `ramp` metres long and `rampW` wide, from the
 *  lane's level at the curtain to the yard's (its north gate opens level onto the upper tier). */
export const SOLITUDE_CRAG = Object.freeze({
  x: 4 * BLOCK_M,
  z: 3 * BLOCK_M,
  half: 80,
  inner: 78,
  ramp: 26,
  rampW: 12,
});
/** THE GATE'S LANE: from the main gate north along Castle Dour's west curtain (its outer face `x1`) on the Well District's
 *  level, to its stair (`stairFoot` to `stairTop`, z south) up to the upper tier at Castle Dour's north court. */
export const SOLITUDE_LANE = Object.freeze({
  x0: 3 * BLOCK_M,
  x1: 327.6,
  stairTop: 81 * CELL - 3 * BLOCK_M,
  stairFoot: 84 * CELL - 3 * BLOCK_M,
  south: 416,
});
/** THE TERRACES' WORKS (world/capitalSolitude.js buildSolitudeTerraces): the retaining wall between the tiers - its face on
 *  the Well District's north edge (`line`, from the west wall's inner face to the lane), its body the upper blocks' edge
 *  cell (`depth`) - and its stairs up its face, each `stairW` wide from its foot (x0, on the street) east to its head (x1):
 *  each in a Daggerfall block's street clear of its houses, room before its foot, its head clear of the upper block's
 *  houses (measured on the freeware's automaps - test/world/solitude_relief.test.js's ARENA2 pin); and the spur south
 *  from Castle Dour's south-west corner to the city wall (`spur`), where the lane meets the castle's raised south yard. */
export const SOLITUDE_TERRACES = Object.freeze({
  line: Object.freeze({ z: 2 * BLOCK_M, x0: -4.5, x1: 3 * BLOCK_M, depth: CELL }),
  stairs: Object.freeze(
    [
      [49.4, 62.8],
      [130, 150],
      [236, 256],
    ].map((s) => Object.freeze(s)),
  ),
  stairW: 3.6,
  spur: Object.freeze({ x: 329.6, z0: 393, z1: 416, half: CELL / 2 }),
});
/** THE TIERS, by the plan's cell (its column and row, the anchor at (2, 3)): the Well District - the city's south-west six
 *  blocks inside the main gate - the lower; every other cell of the plateau the upper. */
export const SOLITUDE_LOWER = Object.freeze(
  [
    [2, 5],
    [3, 5],
    [4, 5],
    [2, 6],
    [3, 6],
    [4, 6],
  ].map((c) => Object.freeze(c)),
);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
/** a to b by t, exact at both ends. */
const lerp = (a, b, t) => a * (1 - t) + b * t;
/** A line's noise at `along` metres (0..1), seeded per line: a long wander and a short break in it. */
const lineNoise = (along, seed) =>
  clamp01(
    perlinNoise(along / SOLITUDE_CLIFFS.wave + seed * 17.3, seed * 7.1) * 0.75 +
      perlinNoise((along * 3.3) / SOLITUDE_CLIFFS.wave + seed * 5.9, seed * 3.7 + 40) * 0.25,
  );
/** A piecewise-linear table [x, v]'s value at x. */
function tableAt(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, v0] = table[i - 1],
        [x1, v1] = table[i];
      return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** The plan's cell (column, row) a point of the plateau reads its tier from: its own, the nearest of the city's (columns
 *  2 to 7, rows 2 to 6) for a point outside them - the strip between a wall and its cliff's top. */
export const tierCell = (x, z) => [
  Math.min(7, Math.max(2, Math.floor((x - SOLITUDE_PIXEL.x0) / BLOCK_M))),
  Math.min(6, Math.max(2, Math.floor((z - SOLITUDE_PIXEL.z0) / BLOCK_M))),
];
const LOWER = new Set(SOLITUDE_LOWER.map(([c, r]) => r * 8 + c));
/** Is a point of the plateau on the lower tier - the Well District's cells, or the gate's lane below its stair. A point on
 *  a cell's edge reads the cell south and east of it, so the upper tier's edge cell holds the step (its retaining wall). */
export function lowerTier(x, z) {
  const N = SOLITUDE_LANE;
  if (x >= N.x0 && x < N.x1 && z >= N.stairFoot) return true;
  const [c, r] = tierCell(x, z);
  return LOWER.has(r * 8 + c);
}
/** The plateau's own height at a point on it: its tier's level, the lane's stair, and Castle Dour's yard with the ramp
 *  inside its west gate. */
export function plateauHeight(x, z) {
  const L = SOLITUDE_LEVELS,
    C = SOLITUDE_CRAG,
    N = SOLITUDE_LANE,
    dx = x - C.x,
    dz = z - C.z;
  if (Math.abs(dx) <= C.inner && Math.abs(dz) <= C.inner) {
    if (Math.abs(dz) <= C.rampW / 2 && dx < -C.inner + C.ramp)
      return L.city + (L.upper - L.city) * smooth((dx + C.half) / (C.ramp + C.half - C.inner));
    return L.upper;
  }
  if (x >= N.x0 && x < N.x1 && z >= N.stairTop && z < N.stairFoot)
    return L.upper + ((L.city - L.upper) * (z - N.stairTop)) / (N.stairFoot - N.stairTop);
  return lowerTier(x, z) ? L.city : L.upper;
}
/** SOLITUDE-RELIEF: the lift a classic block of the plan's cell (column, row) stands at over the location's own flatten
 *  (metres) - its tier's. */
export const solitudeBlockLift = (c, r) => (LOWER.has(r * 8 + c) ? 0 : SOLITUDE_LEVELS.upper - SOLITUDE_LEVELS.city);

/** A sample line on a dock's edge is on it: a vertex's metres (capitalRelief.js reliefVertexAt) miss the edge's own
 *  number by float's error, either way. */
const ON = 1e-6;
/** Is v from a to b, its ends' sample lines in. */
const within = (v, a, b) => v >= a - ON && v <= b + ON;
/** Is a point in the docks' square (the quay's x, from its sea edge to the cliff's top). */
export const inDocks = (x, z) =>
  within(x, SOLITUDE_DOCKS.x0, SOLITUDE_DOCKS.x1) && z >= SOLITUDE_DOCKS.edge - ON && z < SOLITUDE_DOCKS.top;
/** The docks' height at a point of their decks, landings and shelf, or null off them. */
export function docksHeight(x, z) {
  const D = SOLITUDE_DOCKS,
    G = D.gate,
    U = D.upper,
    P = D.hairpin,
    W = D.lower,
    A = D.arrival;
  if (within(x, G.x0, G.x1) && within(z, G.z0, G.z1)) return SOLITUDE_LEVELS.upper;
  if (within(z, U.z0, U.z1) && within(x, U.x0, U.x1)) return lerp(U.h0, U.h1, clamp01((x - U.x0) / (U.x1 - U.x0)));
  if (within(x, P.x0, P.x1) && within(z, P.z0, P.z1)) return P.h;
  if (within(z, W.z0, W.z1) && within(x, W.x0, W.x1)) return lerp(W.h0, W.h1, clamp01((x - W.x0) / (W.x1 - W.x0)));
  if (within(x, D.x0, D.x1) && z >= D.edge - ON && (z <= D.back + ON || (within(x, A.x0, A.x1) && z <= A.z1 + ON)))
    return SOLITUDE_LEVELS.quay;
  return null;
}

/** The slope below the south wall alone: from the plateau's edge at the city's level to the land's own at the pixel's
 *  south edge, steepest under the wall. */
export function southSlope(x, z) {
  const C = SOLITUDE_CLIFFS,
    end = SOLITUDE_PIXEL.z0 + SOLITUDE_PIXEL.side,
    T = tableAt(SOLITUDE_SOUTH_EDGE, x),
    top = lowerTier(x, C.south - 6) ? SOLITUDE_LEVELS.city : SOLITUDE_LEVELS.upper;
  return T + (top - T) * (1 - clamp01((z - C.south) / (end - C.south))) ** 1.5;
}
/** The Gate Road's line, [x, z]: its corners, each bend between two straight runs drawn as an arc (a point every 15
 *  degrees of its turn), each straight run a point every ROAD_STEP metres at the most - so its heights follow the slope. */
const ROAD_STEP = 12;
export const gateRoadLine = (() => {
  const C = SOLITUDE_GATE_ROAD.corners,
    R = SOLITUDE_GATE_ROAD.bend,
    out = [[C[0][0], C[0][1]]];
  const run = (x, z) => {
    const [px, pz] = out[out.length - 1],
      n = Math.ceil(Math.hypot(x - px, z - pz) / ROAD_STEP);
    for (let k = 1; k <= n; k++) out.push([px + ((x - px) * k) / n, pz + ((z - pz) * k) / n]);
  };
  for (let i = 1; i < C.length - 1; i++) {
    const [ax, az] = C[i - 1],
      [bx, bz] = C[i],
      [cx, cz] = C[i + 1];
    const l1 = Math.hypot(bx - ax, bz - az),
      l2 = Math.hypot(cx - bx, cz - bz),
      d1 = [(bx - ax) / l1, (bz - az) / l1],
      d2 = [(cx - bx) / l2, (cz - bz) / l2];
    const turn = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]),
      t = R * Math.tan(Math.abs(turn) / 2);
    const s0 = [bx - d1[0] * t, bz - d1[1] * t],
      side = Math.sign(turn),
      centre = [s0[0] - d1[1] * R * side, s0[1] + d1[0] * R * side];
    const a0 = Math.atan2(s0[1] - centre[1], s0[0] - centre[0]),
      n = Math.max(1, Math.ceil(Math.abs(turn) / (Math.PI / 12)));
    run(s0[0], s0[1]);
    for (let k = 1; k <= n; k++) {
      const a = a0 + (turn * k) / n;
      out.push([centre[0] + Math.cos(a) * R, centre[1] + Math.sin(a) * R]);
    }
  }
  run(C[C.length - 1][0], C[C.length - 1][1]);
  return Object.freeze(out.map((p) => Object.freeze(p)));
})();
/** The Gate Road's points, [x, z, height]: its line's, each at the slope's height there - never under the point before
 *  it, never more than `grade` over it, never over the gate's level, the last the gate's. */
export const gateRoadPoints = (() => {
  const L = gateRoadLine,
    G = SOLITUDE_GATE_ROAD,
    city = SOLITUDE_LEVELS.city;
  let h = southSlope(L[0][0], L[0][1]);
  return Object.freeze(
    L.map(([x, z], i) => {
      if (i)
        h =
          i === L.length - 1
            ? city
            : Math.min(city, Math.max(h, southSlope(x, z)), h + G.grade * Math.hypot(x - L[i - 1][0], z - L[i - 1][1]));
      return Object.freeze([x, z, h]);
    }),
  );
})();
/** The nearest point of the Gate Road's line to (x, z): its distance and the road's height there. */
export function gateRoadAt(x, z) {
  const P = gateRoadPoints;
  let best = Infinity,
    h = 0;
  for (let i = 1; i < P.length; i++) {
    const [ax, az, ah] = P[i - 1],
      [bx, bz, bh] = P[i],
      ux = bx - ax,
      uz = bz - az,
      l2 = ux * ux + uz * uz;
    const t = clamp01(((x - ax) * ux + (z - az) * uz) / l2),
      d = Math.hypot(x - ax - ux * t, z - az - uz * t);
    if (d < best) {
      best = d;
      h = ah + (bh - ah) * t;
    }
  }
  return { d: best, h };
}

/** CAPITAL-CARRIAGES (world/capitalCarriages.js): the carriage's stand outside the main gate - the Well District's ledge
 *  under the south wall carried out level west of the Gate Road's last run, its edge banked down to the slope over `bank`
 *  metres, clear of the road and its shoulder. The slope there falls half a metre a metre: no carriage stood on it.
 *  AUDIT CAPITAL-CARRIAGES L4/L5: its edges and its bank's on the terrain's vertex lines (6.4 m from the pixel's corner), so
 *  the ground drawn on it is level to its edge; its bank short of the shoulder it had reshaped. */
export const SOLITUDE_CARRIAGE_STAND = Object.freeze({
  x0: 262.4,
  x1: 294.4,
  z0: SOLITUDE_CLIFFS.south,
  z1: 435.2,
  bank: 6.4,
});

/** The slope below the south wall: from the plateau's edge to the land's own at the pixel's south edge, steepest under
 *  the wall - and the Gate Road cut and filled across it, and the carriage's stand filled out level beside it. */
export function southHeight(x, z) {
  const slope = southSlope(x, z),
    R = SOLITUDE_GATE_ROAD,
    r = gateRoadAt(x, z);
  if (r.d <= R.half) return r.h;
  const h = r.d < R.half + R.shoulder ? r.h + (slope - r.h) * smooth((r.d - R.half) / R.shoulder) : slope;
  const S = SOLITUDE_CARRIAGE_STAND,
    d = Math.hypot(Math.max(S.x0 - x, 0, x - S.x1), Math.max(S.z0 - z, 0, z - S.z1));
  return d >= S.bank ? h : SOLITUDE_LEVELS.city + (h - SOLITUDE_LEVELS.city) * smooth(d / S.bank);
}

/** How far out a point stands in a cliff's band (0 at its top, 1 at its foot): `out` metres past the line's unworn top,
 *  `along` the line, its noise `seed` - the top worn outward, the band widened. */
function bandReach(out, along, seed, band) {
  const C = SOLITUDE_CLIFFS,
    a = lineNoise(along, seed),
    b = lineNoise(along * 0.61 + 400, seed + 5);
  return (out - C.wear * a) / (band * (1 + C.widen * b));
}
/** A side's fall at `t` of its band, from `top` to `foot`. */
const fall = (top, foot, t) => (t <= 0 ? top : foot + (Math.max(top, foot) - foot) * cliffProfile(t));

/**
 * SOLITUDE'S GROUND: metres over the sea at (x, z), the anchor's metres - the docks' decks and shelf where they are, else
 * the lowest of the cliffs' falls from the plateau (or from the south's slope, where a cliff runs past the south wall) to
 * their feet - the sea west and north, the country east - else the plateau, else the south. Never under the sea's own 0;
 * inside the docks' square never under the quay (the docks' cliff faces between their decks, never a pit).
 */
export function solitudeHeight(x, z) {
  const d = docksHeight(x, z);
  if (d != null) return d;
  const C = SOLITUDE_CLIFFS,
    top = z > C.south ? southHeight(x, z) : plateauHeight(x, z);
  const h = Math.min(
    fall(top, 0, bandReach(C.west - x, z, 1, C.bandWest)),
    fall(top, 0, bandReach(C.north - z, x, 2, C.bandNorth)),
    fall(top, tableAt(SOLITUDE_EAST_EDGE, z), bandReach(x - C.east, z, 3, C.bandEast)),
  );
  return Math.max(inDocks(x, z) ? SOLITUDE_LEVELS.quay : 0, h);
}

/** Is a point of Solitude the sea's - its ground at the water. */
export const solitudeSeaAt = (x, z) => solitudeHeight(x, z) <= 1e-3;

/** THE GROUND TILES (Daggerfall's climate set's records): the water, the bare rock and earth of a cliff, a garden's grass,
 *  the city's paving. */
export const SOLITUDE_TILES = Object.freeze({ water: 0, rock: 1, grass: 2, stone: 3 });
/** How steep, metres over a tile's side, a tile's corners differ before it is the cliff's rock. */
const STEEP = 3.2;
/**
 * A TILE OF SOLITUDE'S OWN GROUND at its centre (x, z): the water where all four of its corners are the sea's (so a
 * water vertex - capitalReliefGround's - is never a cliff's), the rock where its corners climb more than STEEP, else
 * `land` (the block's own: the quay's and the plateau's paving, a garden's grass).
 * @param {number} x @param {number} z @param {number} [land] @returns {number}
 */
export function solitudeGroundTile(x, z, land = SOLITUDE_TILES.stone) {
  const h = CELL / 2,
    c = [
      solitudeHeight(x - h, z - h),
      solitudeHeight(x + h, z - h),
      solitudeHeight(x - h, z + h),
      solitudeHeight(x + h, z + h),
    ];
  if (c.every((v) => v <= 1e-3)) return SOLITUDE_TILES.water;
  return Math.max(...c) - Math.min(...c) > STEEP ? SOLITUDE_TILES.rock : land;
}

/**
 * SOLITUDE-RELIEF: ITS ROCK, WHERE NO SHIP'S JETTY LANDS (systems/naval/harbourKeep.js): a tile of its pixel's land as the
 * game draws it (solitudeGroundTile's: its corners not all the sea's) - but the docks' quay and the tile row on its sea
 * edge. So a ship lies at the docks, never at a cliff's foot. Anchor metres.
 * @param {number} x @param {number} z
 */
export function onSolitudeRock(x, z) {
  const P = SOLITUDE_PIXEL,
    D = SOLITUDE_DOCKS,
    i = Math.floor((x - P.x0) / CELL),
    j = Math.floor((z - P.z0) / CELL),
    n = P.side / CELL;
  if (i < 0 || j < 0 || i >= n || j >= n) return false;
  if (docksHeight(x, z < D.edge && z >= D.edge - CELL ? D.edge : z) === SOLITUDE_LEVELS.quay) return false;
  return solitudeGroundTile(P.x0 + (i + 0.5) * CELL, P.z0 + (j + 0.5) * CELL) !== SOLITUDE_TILES.water;
}

/**
 * SOLITUDE-RELIEF: WHERE NO WALKER GOES (world/townWalls.js townWalkShut): the terraces' retaining wall and its spur, a
 * metre either side (their bodies stand on the step the ground makes, their tops the upper tier's), every stair's
 * footing, and the lane's stair - so the town's people keep each to their tier, as the walk grid has no height to climb.
 * Anchor metres.
 */
export function solitudeWalkShut(x, z) {
  const T = SOLITUDE_TERRACES,
    L = T.line,
    N = SOLITUDE_LANE,
    S = T.spur;
  if (x >= L.x0 - 1 && x <= L.x1 && z >= L.z - L.depth - 1 && z <= L.z + 1) return true;
  if (z >= L.z && z <= L.z + T.stairW + 1 && T.stairs.some(([a, b]) => x >= a - 1 && x <= b + T.stairW + 1))
    return true;
  if (x >= N.x0 && x <= N.x1 && z >= N.stairTop - 3 && z <= N.stairFoot + 1) return true;
  return Math.abs(x - S.x) <= S.half + 1 && z >= S.z0 - 1 && z <= S.z1;
}
