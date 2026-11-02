// @ts-check
// GATE-ROADS (2026-10-28, the owner: "With cities, roads still do not like up properly with gates and pathways in the
// town. Gates can lead to a bunch of buildings and it just doesnt make any sense"; bible/03-World/Town-Shapes.md
// GATE-ROADS, a departure: Port-Ledger A). The road painter brings each road to a walled town's ground and rings it
// (roadPainter.js, Basic Roads' to the byte); the town's gates stand on its wall, its ground between - so no road reached
// a gate. Each gate's road is laid here, the terrain kernel's, after the painter: from the town's nearest street inside,
// through the gate, out to the nearest painted road - round every house, never over water or the wall. Pure and the
// worker's: the gates and what blocks them come from the main thread on the location's rect (world/townGates.js).
import { TILE, TRACK_TILES } from './roadPainter.js';
import { ROAD_RECORDS } from './roadEdge.js';
import { convertTile } from '../terrain/terrainSurface.js';
import { WATER_MASK_TABLE } from '../water/waterCorners.js';

/** The road's measures, in tiles: how far either side of a gate's middle its passage runs at the least (past the wall's
 *  half thickness - two tiles more to clear its towers), the longest link it lays, a tile's cost to cross under a model or
 *  a flat, along paving (the town's own street out of its gate is the way), and a turn's. */
export const GATE_ROAD = Object.freeze({ through: 1.5, reach: 40, flat: 6, paved: 0.25, turn: 0.4 });
/** A gate's road's blocks (world/townGates.js): a house's or the wall's tile, never crossed; a model's or a flat's. */
export const GATE_BLOCK = Object.freeze({ hard: 1, soft: 2 });

const D = 128,
  TD = 129;
const STEPS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]);

/** Whether tile `i` holds water: a painted or stamped tile of water (its raw byte's water corners), else a land tile with a
 *  corner of the sea (tileData's kind 0). */
function wet(tilemap, tileData, i) {
  const r = tilemap[i];
  if (r) return r === 0xff || WATER_MASK_TABLE[convertTile(r)] !== 0;
  const x = i % D,
    y = (i - x) / D,
    c = x + y * TD;
  return !tileData[c] || !tileData[c + 1] || !tileData[c + TD] || !tileData[c + TD + 1];
}

/** A small binary heap of [cost, state]. */
function heap() {
  const a = [];
  return {
    get size() {
      return a.length;
    },
    push(c, s) {
      a.push([c, s]);
      let i = a.length - 1;
      while (i) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    },
    pop() {
      const top = a[0],
        last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1,
            r = l + 1;
          let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    },
  };
}

/** The cheapest way from tile `from` to any tile `goal(i)` says, through tiles `open(i)` says (a cost, or Infinity), within
 *  GATE_ROAD.reach: its tiles, the goal's last - or null. A turn costs GATE_ROAD.turn, so a way runs straight where it can. */
export function gateWay(from, open, goal) {
  const best = new Float64Array(D * D * 9).fill(Infinity),
    back = new Int32Array(D * D * 9).fill(-1),
    q = heap();
  const start = from * 9 + 8;
  best[start] = 0;
  q.push(0, start);
  while (q.size) {
    const [c, s] = q.pop();
    if (c > best[s]) continue;
    const i = (s / 9) | 0,
      dir = s % 9;
    if (i !== from && goal(i)) {
      const out = [];
      for (let k = s; k >= 0; k = back[k]) out.push((k / 9) | 0);
      return out.reverse();
    }
    const x = i % D,
      y = (i - x) / D;
    for (let d = 0; d < 8; d++) {
      const nx = x + STEPS[d][0],
        ny = y + STEPS[d][1];
      if (nx < 0 || ny < 0 || nx >= D || ny >= D) continue;
      const j = nx + ny * D,
        w = open(j);
      if (!(w < Infinity)) continue;
      if (d >= 4 && !(open(nx + y * D) < Infinity && open(x + ny * D) < Infinity)) continue; // no corner cut past a house
      const nc = c + (d >= 4 ? Math.SQRT2 : 1) * w + (dir !== 8 && dir !== d ? GATE_ROAD.turn : 0);
      if (nc > GATE_ROAD.reach || nc >= best[j * 9 + d]) continue;
      best[j * 9 + d] = nc;
      back[j * 9 + d] = s;
      q.push(nc, j * 9 + d);
    }
  }
  return null;
}

/**
 * GATE-ROADS: EACH GATE'S ROAD laid on a pixel's tilemap (raw bytes, x + y * 128, before the squares run) and the
 * painter's paths (GRASS-PATH1: the tiles a road holds) - `gates` each `{ x, y, ox, oy, half }` (its opening's middle in
 * the pixel's tiles, x east and y north, its outward normal and the opening's half width), `blocked` per tile
 * (GATE_BLOCK). A gate whose way out reaches no painted road within GATE_ROAD.reach lays none; its way in, where it
 * reaches the town's paving, joins it. Answers the gates given a road. FB1028: with `town.inside` and `ground` (its
 * townGroundMask) the painter's arms there taken up first (takeUpArms), each cut one joined to a gate after (joinArms).
 * @param {Uint8Array} tilemap @param {Uint8Array} paths @param {Uint8Array} tileData 129 x 129 corner kinds @param {{ gates: Array<{ x: number, y: number, ox: number, oy: number, half?: number }>, blocked: Uint8Array, inside?: Uint8Array }} town @param {?Uint8Array} [ground] */
export function layGateRoads(tilemap, paths, tileData, town, ground = null) {
  const { gates, blocked } = town;
  const tileAt = (x, y) => (x >= 0 && y >= 0 && x < D && y < D ? Math.floor(x) + Math.floor(y) * D : -1);
  const paving = (i) => ROAD_RECORDS.includes(tilemap[i] & 0x3f) && tilemap[i] !== 0xff;
  const cut = town.inside && ground ? takeUpArms(tilemap, paths, town.inside, ground) : null;
  const ways = []; // FB1028: every tile a gate's road lays or keeps, the arms' joins' goal
  let laid = 0;
  for (const g of gates) {
    const len = Math.hypot(g.ox, g.oy) || 1,
      ox = g.ox / len,
      oy = g.oy / len,
      T = GATE_ROAD.through,
      h = (g.half ?? 0) / 2;
    // the passage through the gate: each line across its opening (its middle's, and half its half width to either side -
    // an opening on a tile's edge opens onto both tiles), from the middle out to its first open tile past the wall's half
    // thickness, two tiles more at most - through the wall and its towers, never over water; its tiles the passage where
    // it comes through, the nearest line's open tile the way on
    const passage = new Set();
    const through = (sg) => {
      let from = -1,
        at = Infinity;
      for (const j of [0, -h, h]) {
        const run = [];
        for (let t = 0; t <= T + 2; t += 0.25) {
          const i = tileAt(g.x + sg * ox * t - oy * j, g.y + sg * oy * t + ox * j);
          if (i < 0 || wet(tilemap, tileData, i)) break;
          if (t >= T && blocked[i] !== GATE_BLOCK.hard) {
            for (const k of run) if (k !== i) passage.add(k);
            if (t < at) {
              from = i;
              at = t;
            }
            break;
          }
          if (run[run.length - 1] !== i) run.push(i);
        }
      }
      return from;
    };
    const outer = through(1),
      inner = through(-1);
    if (outer < 0) continue;
    const away = (i) =>
      passage.has(i) || blocked[i] === GATE_BLOCK.hard || wet(tilemap, tileData, i)
        ? Infinity
        : paving(i)
          ? GATE_ROAD.paved
          : blocked[i] === GATE_BLOCK.soft
            ? GATE_ROAD.flat
            : 1;
    const out = gateWay(outer, away, (i) => !!paths[i] && !passage.has(i) && !wet(tilemap, tileData, i));
    if (!out) continue;
    const into = inner >= 0 ? gateWay(inner, away, (i) => paving(i) && !paths[i]) : null;
    // the way out two tiles wide where there is room, as the painter lays a road: each laid step's right-hand neighbour (a
    // street it runs along is the town's, its width its own)
    const beside = [];
    for (let k = 1; k < out.length - 1; k++) {
      if (paving(out[k])) continue;
      const ax = out[k - 1] % D,
        ay = (out[k - 1] - ax) / D,
        bx = out[k] % D,
        by = (out[k] - bx) / D,
        j = tileAt(bx + (by - ay), by - (bx - ax));
      if (j >= 0 && away(j) === 1 && !paving(j)) beside.push(j);
    }
    for (const i of [...passage, ...out.slice(0, -1), ...beside, ...(into ? into.slice(0, -1) : [])]) {
      ways.push(i);
      if (paving(i)) continue; // a road there already - the town's own paving, or the painter's - kept as it lies
      tilemap[i] = TILE.road;
      paths[i] = 1;
    }
    laid++;
  }
  if (cut) joinArms(tilemap, paths, tileData, town, cut, ways);
  return laid;
}

/** FB1028 YARDS (the owner: every yard where #1184 stood it): the paths as #1184 laid them - the painter's, and the gates'
 *  roads of the wall it stood (`town.yard`, townGates.js), nothing taken up - for the yards' ground alone; null with no
 *  such wall. Run before layGateRoads, on copies. @param {Uint8Array} tilemap @param {?Uint8Array} paths
 *  @param {Uint8Array} tileData @param {any} town */
export function yardRoads(tilemap, paths, tileData, town) {
  if (!town?.yard || !paths) return null;
  const was = Uint8Array.from(paths);
  layGateRoads(Uint8Array.from(tilemap), was, tileData, town.yard);
  return was;
}

/** FB1028 ROADS: a painter's road or track tile - its record one of the two tables' (never a river's or a stream's, never
 *  water) - or a track's mark over dirt (written as nothing, VERGE1). @param {Uint8Array} tilemap @param {number} i */
const isArmTile = (tilemap, i) => tilemap[i] !== 0xff && (tilemap[i] === 0 || ARM_RECORDS.has(tilemap[i] & 0x3f));
const ARM_RECORDS = new Set([
  ...ROAD_RECORDS,
  ...TRACK_TILES.flatMap((t) => t ?? []).filter((r) => r > 0 && r !== TILE.NO_CHANGE),
]);

/**
 * FB1028 ROADS (the owner's staff, after #1184: "roads lead to nowhere"): A BAY WALL'S GROUND TAKES UP THE PAINTER'S ARMS.
 * GATE-ROADS slid each gate along the wall onto a street, and the arm it left ran on into blank wall. On the town's ground
 * (`ground`) every painter's tile outside the wall's inner face (`inside` 0) is taken up, and every one inside it joined
 * to those by painter's tiles (the arm's stub, between the wall and the town's blocks). The ring round the ground is off
 * it and stays. Answers the tiles taken up.
 * @param {Uint8Array} tilemap @param {Uint8Array} paths @param {Uint8Array} inside @param {Uint8Array} ground
 */
export function takeUpArms(tilemap, paths, inside, ground) {
  const cut = new Uint8Array(D * D),
    stack = [];
  for (let i = 0; i < D * D; i++)
    if (paths[i] && ground[i] && !inside[i] && isArmTile(tilemap, i)) {
      cut[i] = 1;
      stack.push(i);
    }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop()),
      x = i % D,
      y = (i - x) / D;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx,
        ny = y + dy,
        j = nx + ny * D;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < D &&
        ny < D &&
        !cut[j] &&
        paths[j] &&
        ground[j] &&
        inside[j] &&
        isArmTile(tilemap, j)
      ) {
        cut[j] = 1;
        stack.push(j);
      }
    }
  }
  for (let i = 0; i < D * D; i++)
    if (cut[i]) {
      tilemap[i] = 0;
      paths[i] = 0;
    }
  return cut;
}

/**
 * FB1028 ROADS: EACH ARM CUT JOINED TO A GATE - an arm's end (a painter's tile beside one taken up) that no run of road
 * tiles joins to a gate's road has its way laid to the nearest gate's (gateWay, GATE_ROAD.reach), round houses and the
 * wall, never over water: the ring round the town does it where the pixel has roads, this where it has only tracks.
 * @param {Uint8Array} tilemap @param {Uint8Array} paths @param {Uint8Array} tileData @param {{ blocked: Uint8Array }} town
 * @param {Uint8Array} cut takeUpArms' @param {number[]} ways every gate's road's tiles
 */
function joinArms(tilemap, paths, tileData, town, cut, ways) {
  const road = (i) => !!paths[i] || (ROAD_RECORDS.includes(tilemap[i] & 0x3f) && tilemap[i] !== 0xff);
  const joined = new Uint8Array(D * D),
    stack = [];
  const reach = (from) => {
    for (const i of from)
      if (!joined[i]) {
        joined[i] = 1;
        stack.push(i);
      }
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop()),
        x = i % D,
        y = (i - x) / D;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx,
          ny = y + dy,
          j = nx + ny * D;
        if (nx >= 0 && ny >= 0 && nx < D && ny < D && !joined[j] && road(j)) {
          joined[j] = 1;
          stack.push(j);
        }
      }
    }
  };
  reach(ways);
  const goal = new Set(ways);
  for (let i = 0; i < D * D; i++) {
    if (!paths[i] || joined[i] || cut[i]) continue;
    const x = i % D,
      y = (i - x) / D;
    if (
      !STEPS.some(([dx, dy]) => {
        const nx = x + dx,
          ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < D && ny < D && cut[nx + ny * D];
      })
    )
      continue;
    const away = (j) =>
      town.blocked[j] === GATE_BLOCK.hard || wet(tilemap, tileData, j)
        ? Infinity
        : town.blocked[j] === GATE_BLOCK.soft
          ? GATE_ROAD.flat
          : 1;
    const way = gateWay(i, away, (j) => goal.has(j));
    if (!way) continue;
    for (const j of way)
      if (!road(j)) {
        tilemap[j] = TILE.road;
        paths[j] = 1;
      }
    reach(way);
  }
}
