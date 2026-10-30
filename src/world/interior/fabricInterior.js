// @ts-check
// IC-INTERIORS (2026-10-27, the owner's field report, item 5: "Interiors in the Imperial city need to match their exterior
// with varied layouts"; and on all of it, "No band aids or half assed work"; bible/03-World/Arena-Provinces.md
// IC-INTERIORS) - A FABRIC BUILDING'S OWN INTERIOR, laid from Daggerfall's own kit to its footprint, its storeys, its kind,
// its door and its windows.
//
// DFU's reference: a building's interior is its block's SUBRECORD's interior record - the models, flats, people, doors and
// spawn points its RMB's author laid (DaggerfallInterior.AddModels, AddFlats, AddPeople, AddActionDoors, AddSpawnPoints),
// in the frame of the building model its door is on; its storeys joined by Daggerfall's stair (31x23) or its ladder
// between a LadderBottom and a LadderTop marker (DaggerfallLadder). BLD (2026-10-26) gave each fabric building a DONOR's
// record whole - one of 53 of Daggerfall's own buildings, picked by its pool and its footprint's area - so a long shop
// held a square room, a narrow house a wide one, every house of a size the same three rooms, a five-storey house one
// storey, none of it where the street's windows were.
// DEPARTURE (named; Port-Ledger section A, IC-INTERIORS): the fabric building's record is WRITTEN here, in RMB's own shape
// (world/interior/interiorLayout.js layoutInterior reads it as it reads any), from Daggerfall's own pieces
// (world/interior/fabricInteriorKit.js) - never an invented model:
//   - THE GRID: 3.2 m cells (the kit's 128 units, the fabric's storey) in the door's frame - x along the front, z in from
//     it - its door's cell set so its 3002 wall's door stands at the building's door; a cell whose middle is inside the
//     building's footprint is a room's (`fabricInteriorGrid`), so a long building is a long interior, a big one has more
//     rooms, a narrow one is narrow;
//   - THE STOREYS: as many as its walls show (floor(eave / STOREY) - world/imperialFabricModels.js storeys' law), each 129
//     over the last (Daggerfall's own pitch), joined by Daggerfall's straight stair where one stands without cutting
//     either storey's floor in two, else by its ladder through a hole in the floor over it (a building one cell wide);
//   - THE ROOMS by its kind (the pool's - a shop, a tavern, a home, a guild hall, a bank, a library): a front room on the
//     street (the shop floor, the taproom, the living room, the hall), the rest cut into rooms by the building's own seed
//     (its key - the same on every visit and every client), a doorway and Daggerfall's door between each room and the
//     one it is reached from;
//   - THE WALLS: each room's walls the kit's, 6 units in from its cells' edges, a post where two walls leave a gap; the
//     street door's wall where the exterior's door is; a window wall where the exterior shows windows (every wall but a
//     party wall - world/imperialFabricModels.js partyEdges), plain where it is blind;
//   - THE FURNITURE by each room's part: a shop's counter (41126) with its keeper behind it and its stock on the shelves
//     Daggerfall's own shops of its trade carry (fabricInteriorKit.js POOL_SHELVES - stocked, DaggerfallInterior
//     AddFurnitureAction's ShopShelves); a tavern's bar of two counters, its tables, chairs, benches and hearth, its
//     rooms to rent; a home's living room, kitchen and bedrooms; a guild's hall and study; a bank's counting room and vault;
//   - THE CAST: its donor's people (their pictures, factions and flags - the keeper, the residents, a guild's members),
//     its donor's quest markers (so a quest's site is where it was - world/imperialFabricSites.js stays the bake), its
//     REST and treasure markers, its lights' pictures - each stood again in the building's own rooms.
// Pure: a building's plan is worked from its grid, its pool, its storeys and its key alone.
import {
  KIT_PIECE,
  KIT_CELL,
  KIT_STOREY,
  KIT_INSET,
  KIT_MEASURE,
  KIT_DOOR,
  KIT_LADDER,
  KIT_SHIFT,
  FURNITURE,
  TALL,
  POOL_SHELVES,
  PIECES,
  POOL_KIND,
  POOL_SETS,
  kitModel,
} from './fabricInteriorKit.js';
import { INTERIOR_MARKER, FLOOR_MODEL_TYPE, PROP_MODEL_TYPE } from './interiorLayout.js';
import { EDITOR_FLATS_ARCHIVE } from '../rmbFlats.js';
import { GLOBAL_SCALE } from '../meshReader.js';
import { inQuad } from '../imperialFabric.js';
import { hash32 } from '../blockHash.js';
import { seededRng } from '../../systems/wind/wind.js'; // the port's one seeded die (mulberry32)

const SALT = 0x1c1e;
/** A cell's sides: each side's outward way in the interior's frame (x along the front, z in from it) - 0 the front's. */
export const FABRIC_SIDES = Object.freeze([
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]);
const SIDE = FABRIC_SIDES;
/** The turn (yRotation, 2048 a whole turn) that takes side 1 (+x) to side s - trs's law: R(512)(x, z) = (-z, x). */
export const FABRIC_SIDE_TURN = Object.freeze([1536, 0, 512, 1024]);
const SIDE_TURN = FABRIC_SIDE_TURN;
const mod = (a, n) => ((a % n) + n) % n;
/** A local (x, z) turned by a right-angle yRotation (trs: R(f)(x, z) = (x cos f + z sin f, -x sin f + z cos f), f = -turn). */
export function fabricTurned(turn, x, z) {
  switch (mod(Math.round(turn / 512), 4)) {
    case 1:
      return [-z, x];
    case 2:
      return [-x, -z];
    case 3:
      return [z, -x];
    default:
      return [x, z];
  }
}
const turned = fabricTurned;
/** The door's cell middle along the front, units from the door's middle: the 3002 wall's door stands at its local z -50..0
 *  (KIT_MEASURE.exitDoorMid its middle) - in the side's half toward the front's -x, turned to the street - so the cell's
 *  middle stands that far the other way. */
export const FABRIC_DOOR_CELL_X = -KIT_MEASURE.exitDoorMid;
const cellX = (i) => i * KIT_CELL + FABRIC_DOOR_CELL_X;
const cellZ = (j) => j * KIT_CELL + KIT_CELL / 2;
/** A cell's middle in the interior's frame (classic units: x along the front, z in from it). */
export const fabricCellMiddle = (i, j) => [cellX(i), cellZ(j)];
const ck = (i, j) => `${i},${j}`;
const at = (c, s) => [c[0] + SIDE[s][0], c[1] + SIDE[s][1]];
/** The most cells a building's grid holds across its front either side of its door's cell, and in from its front. */
export const FABRIC_INTERIOR_MAX = Object.freeze({ across: 5, deep: 12 });
/** The storeys a building's interior stands at most - past the city's tallest (a tower's seven). */
export const FABRIC_INTERIOR_STOREYS = 8;
/** A wall and a post stretched up a hair (yScale - RMBLayout.GetModelScaleVector's): from a hand under its storey's floor to
 *  the next storey's, so no slit shows between two storeys where a stair or a ladder's hole looks up (126 tall, the pitch
 *  129). */
export const FABRIC_WALL_SCALE = 130 / 126;

/**
 * A BUILDING'S GRID: the kit's cells of its footprint, in the interior's frame - `q` its footprint (map metres, x east,
 * z south), `at` its door's middle on its front, `n` that front's outward normal (both map), `party` its party-wall bits
 * (world/imperialFabricModels.js partyEdges). A cell is the building's when its middle stands inside the footprint (so the
 * interior is the footprint to half a cell on every side), the door's always, and every cell reached from the door's.
 * Each outer side of a cell is blind when the footprint's edge outside it is a party wall. The interior's frame is the
 * door's: its local x along the front, z in from it - `[n.z, -n.x]` and `[-n.x, -n.z]` on the map, the frame the
 * building's subrecord stands its interior in (world/imperialFabricBuildings.js subRecordFrame, FABRIC_ENTRANCE).
 * @param {number[][]} q @param {number[]} door @param {number[]} n @param {number} [party]
 * @returns {{ cells: number[][], blind: string[], quad: number[][] }}
 */
export function fabricInteriorGrid(q, door, n, party = 0) {
  const ax = [n[1], -n[0]],
    az = [-n[0], -n[1]];
  const quad = q.map((p) => {
    const dx = p[0] - door[0],
      dz = p[1] - door[1];
    return [(dx * ax[0] + dz * ax[1]) / GLOBAL_SCALE, (dx * az[0] + dz * az[1]) / GLOBAL_SCALE];
  });
  const xs = quad.map((p) => p[0]),
    zs = quad.map((p) => p[1]),
    M = FABRIC_INTERIOR_MAX;
  const i0 = Math.max(-M.across, Math.floor((Math.min(...xs) - FABRIC_DOOR_CELL_X) / KIT_CELL)),
    i1 = Math.min(M.across, Math.ceil((Math.max(...xs) - FABRIC_DOOR_CELL_X) / KIT_CELL));
  const j1 = Math.min(M.deep - 1, Math.ceil(Math.max(...zs) / KIT_CELL));
  const inside = new Set([ck(0, 0)]);
  for (let j = 0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) if (inQuad(quad, cellX(i), cellZ(j))) inside.add(ck(i, j));
  // every cell reached from the door's
  const seen = new Set([ck(0, 0)]),
    todo = [[0, 0]];
  while (todo.length) {
    const c = /** @type {number[]} */ (todo.pop());
    for (let s = 0; s < 4; s++) {
      const nb = at(c, s),
        k = ck(nb[0], nb[1]);
      if (inside.has(k) && !seen.has(k)) {
        seen.add(k);
        todo.push(nb);
      }
    }
  }
  const cells = [...seen].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const blind = [];
  for (const [i, j] of cells)
    for (let s = 0; s < 4; s++) {
      if (seen.has(ck(i + SIDE[s][0], j + SIDE[s][1]))) continue;
      const px = cellX(i) + SIDE[s][0] * KIT_CELL * 0.75,
        pz = cellZ(j) + SIDE[s][1] * KIT_CELL * 0.75;
      let e = 0,
        best = Infinity;
      for (let k = 0; k < 4; k++) {
        const d = segDist(quad[k], quad[(k + 1) & 3], px, pz);
        if (d < best) {
          best = d;
          e = k;
        }
      }
      if (party & (1 << e)) blind.push(`${i},${j},${s}`);
    }
  return { cells, blind, quad };
}
function segDist(a, b, x, z) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz,
    t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0;
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}

// ---------------------------------------------------------------- the plan: the ways up, the rooms, the doorways

/** The share of a building's depth its front room takes, by kind (the shop floor, the taproom, the hall). */
const FRONT_SHARE = Object.freeze({
  shop: 0.6,
  tavern: 0.7,
  guild: 0.6,
  bank: 0.5,
  library: 0.7,
  house: 0.5,
  temple: 0.75,
});
/** The most cells a room holds, by kind, on the ground storey and above it; and the front room (its street's - the door's
 *  piece of a front cut where it is bigger). */
const ROOM_MAX = Object.freeze({
  shop: [4, 4],
  tavern: [4, 2],
  guild: [6, 4],
  bank: [4, 4],
  library: [6, 6],
  house: [4, 4],
  temple: [4, 4],
});
const FRONT_MAX = Object.freeze({ shop: 9, tavern: 12, guild: 9, bank: 6, library: 12, house: 6, temple: 16 }); // a temple's nave the most of its floor
/** Each storey's rooms' parts, by kind - the ground's and the storeys over it: the first room's the first, the rest in turn. */
const ROLES = Object.freeze({
  shop: [
    ['shop', 'store', 'bedroom', 'store'],
    ['living', 'bedroom', 'store', 'bedroom'],
  ],
  tavern: [['taproom', 'kitchen', 'cellar', 'guestroom'], ['guestroom']],
  house: [
    ['living', 'kitchen', 'bedroom', 'store', 'bedroom'],
    ['bedroom', 'bedroom', 'store', 'bedroom', 'study'],
  ],
  guild: [
    ['hall', 'study', 'store', 'bedroom'],
    ['bedroom', 'study', 'bedroom'],
  ],
  bank: [
    ['counting', 'vault', 'store'],
    ['study', 'bedroom'],
  ],
  library: [
    ['library', 'library', 'study'],
    ['library', 'study'],
  ],
  temple: [
    ['nave', 'study', 'store', 'bedroom'],
    ['study', 'bedroom'],
  ], // IC-PROPS x IC-INTERIORS: its nave first, the priests' rooms behind
});
/** The kinds whose front room stands a counter, its keeper behind it. */
const COUNTER_KINDS = new Set(['shop', 'bank']);
/** A home of one storey: its bedroom next to its living room (no storey over it to sleep on). */
const HOME_ONE_STOREY = Object.freeze(['living', 'bedroom', 'kitchen', 'bedroom', 'store']);
const edgeKey = (a, b) =>
  a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])
    ? `${ck(a[0], a[1])}|${ck(b[0], b[1])}`
    : `${ck(b[0], b[1])}|${ck(a[0], a[1])}`;
/** The cells of a set in its 4-connected pieces. */
function pieces(cells) {
  const left = new Map(cells.map((c) => [ck(c[0], c[1]), c])),
    out = [];
  while (left.size) {
    const [k0, c0] = left.entries().next().value;
    left.delete(k0);
    const part = [c0],
      todo = [c0];
    while (todo.length) {
      const c = /** @type {number[]} */ (todo.pop());
      for (let s = 0; s < 4; s++) {
        const nb = at(c, s),
          k = ck(nb[0], nb[1]),
          o = left.get(k);
        if (o) {
          left.delete(k);
          part.push(o);
          todo.push(o);
        }
      }
    }
    out.push(part.sort((a, b) => a[1] - b[1] || a[0] - b[0]));
  }
  return out;
}
const joined = (cells) => cells.length > 0 && pieces(cells).length === 1;
/** A set of cells cut into rooms of at most `max` cells: along its longer way at a seeded cut near its middle, again and
 *  again; a room small enough is now and then cut once more (the seed's), so two buildings of a size differ. */
function cutRooms(cells, max, rng, out) {
  for (const part of pieces(cells)) {
    const is = part.map((c) => c[0]),
      js = part.map((c) => c[1]);
    const w = Math.max(...is) - Math.min(...is) + 1,
      d = Math.max(...js) - Math.min(...js) + 1;
    if (part.length <= 1 || (part.length <= max && (part.length <= 2 || rng() < 0.8)) || (w < 2 && d < 2)) {
      out.push(part);
      continue;
    }
    const alongX = w > d || (w === d && rng() < 0.5) ? w >= 2 : d < 2;
    const lo = alongX ? Math.min(...is) : Math.min(...js),
      len = alongX ? w : d;
    const cut = lo + Math.max(1, Math.min(len - 1, Math.round(len / 2 + (rng() - 0.5) * (len / 2))));
    cutRooms(
      part.filter((c) => (alongX ? c[0] : c[1]) < cut),
      max,
      rng,
      out,
    );
    cutRooms(
      part.filter((c) => (alongX ? c[0] : c[1]) >= cut),
      max,
      rng,
      out,
    );
  }
  return out;
}
/** The rooms' doorways: from the first room, each room reached by one doorway on a cell edge it shares with a room already
 *  reached (the seed's pick of the edges, none on `avoid`'s cells - a ladder's hole), every room so reached. */
function doorwaysOf(rooms, roomOf, rng, avoid) {
  const ways = new Map(),
    reached = new Set([0]),
    order = [0];
  while (order.length) {
    const r = /** @type {number} */ (order.shift());
    const shared = new Map();
    for (const c of rooms[r].cells)
      for (let s = 0; s < 4; s++) {
        const nb = at(c, s),
          o = roomOf.get(ck(nb[0], nb[1]));
        if (
          o === undefined ||
          o < 0 ||
          o === r ||
          reached.has(o) ||
          avoid.has(ck(c[0], c[1])) ||
          avoid.has(ck(nb[0], nb[1]))
        )
          continue;
        if (!shared.has(o)) shared.set(o, []);
        shared.get(o).push({ e: edgeKey(c, nb), a: c, b: nb });
      }
    for (const o of [...shared.keys()].sort((x, y) => x - y)) {
      const list = shared.get(o),
        pick = list[Math.floor(rng() * list.length)];
      ways.set(pick.e, { a: pick.a, b: pick.b, from: r, to: o });
      reached.add(o);
      order.push(o);
    }
  }
  return ways;
}

/** A way up's cell on the storey over it (a stair's well, a ladder's hole), and where a climber stands there (a hatch's:
 *  its own cell, across from the hatch). */
const wayCell = (w) => ck(w.i, w.j);
export const fabricArrival = (w) =>
  w.kind === 'stair' ? at([w.i, w.j], (w.e + 2) % 4) : w.kind === 'hatch' ? [w.i, w.j] : w.top;
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

/**
 * A BUILDING'S PLAN: its storeys - each its rooms (their cells and their parts), the doorways between them, its way up
 * (Daggerfall's stair or its ladder) and its way in from below - the street door's cell and the building set it wears,
 * from its grid (fabricInteriorGrid), its pool (world/imperialFabricBuildings.js FABRIC_DONORS' pools), the storeys its
 * walls show and its key (the plot's: the seed - the same plan every visit, on every client).
 * @param {{ key: number, pool: string, cells: number[][], blind?: string[], storeys?: number }} spec
 */
export function fabricInteriorPlan({ key, pool, cells, blind = [], storeys = 1 }) {
  const rng = seededRng(hash32(SALT, key >>> 0, 1));
  const kind = POOL_KIND[pool] ?? 'house';
  const setList = POOL_SETS[pool] ?? POOL_SETS[kind];
  const set = setList[Math.floor(rng() * setList.length)];
  const has = new Set(cells.map(([i, j]) => ck(i, j)));
  const inside = (c) => has.has(ck(c[0], c[1]));
  // STOREY BY STOREY, as many as the walls show: its way up - Daggerfall's stair where one stands whose foot leaves this
  // storey's floor one piece and whose well leaves the next's (a stair's cell is a dead end below and a well above), along
  // an outer wall and off the street first; else, its rooms cut, Daggerfall's ladder against an outer wall in a room it
  // leaves whole, under a hole that leaves the floor over it whole; then the storey's rooms. A ladder's room is carried up
  // whole (`carry`): the hole's walls the ladder's walls, storey on storey, so no wall's thickness opens under the hole.
  const want = Math.max(1, Math.min(FABRIC_INTERIOR_STOREYS, Math.floor(storeys)));
  const [maxGround, maxUp] = ROOM_MAX[kind];
  const plan = [];
  const floorOf = (...off) => cells.filter(([i, j]) => !off.includes(ck(i, j)));
  /** @type {any} */
  let down = null;
  /** @type {Set<string> | null} */
  let carry = null;
  for (let k = 0; k < want; k++) {
    // the cell the way from below takes out of this storey's floor (a stair's well, a ladder's hole - a hatch takes a quarter)
    const hole = down && down.kind !== 'hatch' ? wayCell(down) : null,
      arrive = down ? fabricArrival(down) : null;
    const isArrival = (c) => arrive !== null && c[0] === arrive[0] && c[1] === arrive[1];
    const usable = (c) =>
      inside(c) && ck(c[0], c[1]) !== hole && !(k === 0 && c[0] === 0 && c[1] === 0) && !isArrival(c);
    /** @type {any} */
    let up = null;
    if (k + 1 < want) {
      const stairs = [];
      for (const c of cells)
        for (let e = 0; e < 4; e++) {
          const E = at(c, e),
            X = at(c, (e + 2) % 4),
            S = ck(c[0], c[1]);
          if (!usable(c) || carry?.has(S) || !inside(E) || !inside(X) || ck(E[0], E[1]) === hole) continue;
          if (!joined(floorOf(S, hole ?? '')) || !joined(floorOf(S))) continue;
          const outer = [(e + 1) % 4, (e + 3) % 4].some((sd) => !inside(at(c, sd)));
          const street = k === 0 && (c[1] === 0 || (E[0] === 0 && E[1] === 0));
          stairs.push({ i: c[0], j: c[1], e, tier: (outer ? 0 : 1) + (street ? 2 : 0) });
        }
      if (stairs.length) {
        const best = Math.min(...stairs.map((w) => w.tier)),
          { i, j, e } = pick(
            stairs.filter((w) => w.tier === best),
            rng,
          );
        up = { kind: 'stair', i, j, e };
      }
    }
    // the rooms on this storey's floor (less a stair's foot and the well or hole from below)
    const floor = floorOf(hole ?? '', up ? wayCell(up) : '');
    let rooms;
    if (k === 0) rooms = groundRooms(floor, kind, maxGround, rng);
    else if (down.kind !== 'ladder') {
      const cut = cutRooms(floor, maxUp, rng, []),
        first = cut.findIndex((c) => c.some(([i, j]) => i === arrive[0] && j === arrive[1]));
      rooms = [cut[first], ...cut.filter((_, n) => n !== first)];
    } else {
      const kept = floor.filter(([i, j]) => carry?.has(ck(i, j)));
      rooms = [
        kept,
        ...cutRooms(
          floor.filter(([i, j]) => !carry?.has(ck(i, j))),
          maxUp,
          rng,
          [],
        ),
      ];
    }
    if (!up && k + 1 < want) {
      // a ladder's cell: one whose hole leaves the floor over it whole, against an outer wall, with a landing beside it in its
      // room as the room stands on the storey over it (whole without it; the room a ladder from below comes up in holds that
      // ladder's hole, floored over) - or a room of its one cell, joined then to the room of a cell beside it; the cell a
      // climber arrives in from below last of all (a building two cells wide: its ladders climb turn about, hole by landing)
      const ladders = [];
      const roomAt = (o) => rooms.findIndex((room) => room.some((q) => q[0] === o[0] && q[1] === o[1]));
      const holeRoom = down?.kind === 'ladder' ? roomAt(down.top) : -1;
      // (a shop's or a bank's counter stands in its front room's deepest row: a ladder there last but one)
      const counterCell = (room, c) => COUNTER_KINDS.has(kind) && c[1] === Math.max(...room.map((q) => q[1]));
      rooms.forEach((room, r) => {
        const over = r === holeRoom ? [...room, [down.i, down.j]] : room;
        for (const c of room) {
          const L = ck(c[0], c[1]),
            rest = over.filter((o) => ck(o[0], o[1]) !== L);
          if (
            !inside(c) ||
            (k === 0 && c[0] === 0 && c[1] === 0) ||
            (down?.kind === 'hatch' && isArrival(c)) ||
            !joined(floorOf(L))
          )
            continue;
          const beside = [0, 1, 2, 3].map((sd) => at(c, sd));
          // (a room carried up over a ladder keeps its sides at the hole - the hole's walls are the walls under it - so a lone
          // cell beside the hole never joins it)
          const byHole = hole !== null && beside.some((o) => ck(o[0], o[1]) === hole);
          const tops = rest.length
            ? joined(rest)
              ? beside.filter((o) => rest.some((q) => q[0] === o[0] && q[1] === o[1]))
              : []
            : beside.filter((o) => roomAt(o) >= 0 && !(byHole && roomAt(o) === holeRoom));
          for (let sd = 0; sd < 4; sd++)
            if (!inside(at(c, sd)) && tops.length)
              ladders.push({
                i: c[0],
                j: c[1],
                s: sd,
                tops,
                r,
                tier:
                  (rest.length ? 0 : 2) +
                  (k === 0 && r === 0 ? (counterCell(room, c) ? 2 : 1) : 0) +
                  (isArrival(c) ? 4 : 0),
              });
        }
      });
      if (ladders.length) {
        // its landing beside the ladder's wall where one is (a climber steps off the ladder's top there, as Daggerfall's own
        // stand 2 to 3 m from theirs), else across the hole from it
        const best = Math.min(...ladders.map((w) => w.tier)),
          { i, j, s, tops, r } = pick(
            ladders.filter((w) => w.tier === best),
            rng,
          );
        const beside = tops.filter((o) => (o[0] - i) * SIDE[s][0] + (o[1] - j) * SIDE[s][1] === 0),
          top = pick(beside.length ? beside : tops, rng);
        let room = r;
        if (rooms[r].length === 1 && r !== holeRoom) {
          // the ladder's lone cell joins its landing's room (the room keeps its place in the order, the lone one goes)
          const t = roomAt(top);
          rooms[t] = [...rooms[t], ...rooms[r]].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
          rooms.splice(r, 1);
          room = t > r ? t - 1 : t;
        }
        up = { kind: 'ladder', i, j, s, top, room };
      }
    }
    if (!up && k + 1 < want) {
      // THE HATCH, where neither stands (a building of one cell): the ladder in a quarter of a cell at a corner of two outer
      // walls, that quarter of the floor over it left open, the landing across the cell from it - never at the street door's
      // wall, never over the hatch from below
      const hatches = [];
      for (const c of rooms.flat())
        for (let s = 0; s < 4; s++)
          for (const t of [(s + 1) % 4, (s + 3) % 4]) {
            if (inside(at(c, s)) || inside(at(c, t)) || (k === 0 && c[0] === 0 && c[1] === 0 && (s === 0 || t === 0)))
              continue;
            const q = [SIDE[s][0] + SIDE[t][0], SIDE[s][1] + SIDE[t][1]];
            if (down?.kind === 'hatch' && isArrival(c) && down.q[0] === q[0] && down.q[1] === q[1]) continue;
            hatches.push({ i: c[0], j: c[1], s, t, q });
          }
      if (hatches.length) up = { kind: 'hatch', ...pick(hatches, rng) };
    }
    plan.push(storeyOf(k, rooms, kind, rng, { up, down, single: want === 1 }));
    if (!up) break;
    // a ladder's room carried up whole - with the hole it holds from below, floored over on the storey over it
    const held = up.kind === 'ladder' ? rooms[up.room] : null;
    const withHole =
      held !== null && down?.kind === 'ladder' && held.some(([i, j]) => i === down.top[0] && j === down.top[1]);
    carry = held ? new Set([...held, ...(withHole ? [[down.i, down.j]] : [])].map(([i, j]) => ck(i, j))) : null;
    down = up;
  }
  plan[0].exit = [0, 0, 0];
  return {
    key: key >>> 0,
    pool,
    kind,
    set,
    cells: cells.map((c) => [...c]),
    blind: new Set(blind),
    storeys: plan,
    want,
  };
}
/** The ground storey's rooms: the front room on the street (the share of the depth its kind takes - of a front too big for
 *  one room, the door's own rectangle of it, frontOf; now and then a side room off it), the rest cut into rooms. */
function groundRooms(floor, kind, max, rng) {
  const rows = Math.max(...floor.map((c) => c[1])) + 1,
    tiny = floor.length <= 3;
  const jitter = rng() < 0.5 ? 0 : rng() < 0.5 ? -1 : 1;
  let f = tiny ? rows : Math.max(1, Math.min(rows - (rows > 1 ? 1 : 0), Math.round(rows * FRONT_SHARE[kind]) + jitter));
  // (a shop or a bank whose front is a cell wide is its floor the building's depth: its counter at the end of it, past
  // every way through)
  if (COUNTER_KINDS.has(kind) && new Set(floor.filter((c) => c[1] < f).map((c) => c[0])).size === 1) f = rows;
  const zone = pieces(floor.filter((c) => c[1] < f)).find((p) => p.some(([i, j]) => i === 0 && j === 0)) ?? [[0, 0]];
  const zoneSet = new Set(zone.map(([i, j]) => ck(i, j)));
  let front = frontOf(zone, FRONT_MAX[kind], rng);
  const inFront = new Set(front.map(([i, j]) => ck(i, j)));
  let side = zone.filter(([i, j]) => !inFront.has(ck(i, j)));
  const cols = [...new Set(front.map((c) => c[0]))].sort((a, b) => a - b);
  if (!tiny && cols.length >= 4 && rng() < 0.4) {
    const end = rng() < 0.5 ? cols[0] : cols[cols.length - 1],
      kept = front.filter((c) => c[0] !== end);
    if (end !== 0 && joined(kept)) {
      side = [...side, ...front.filter((c) => c[0] === end)];
      front = kept;
    }
  }
  return [
    front,
    ...cutRooms(side, max, rng, []),
    ...cutRooms(
      floor.filter(([i, j]) => !zoneSet.has(ck(i, j))),
      max,
      rng,
      [],
    ),
  ];
}
/** THE FRONT ROOM of a front zone too big for one: the zone's rectangle about the street door's cell (its columns either
 *  side of the door's, its rows from the street) of the most cells a front room holds, wider than deep where it can be,
 *  the seed's pick among the best - so a shop's floor is the shop's breadth at its door, never a sliver of it. */
function frontOf(zone, max, rng) {
  if (zone.length <= max) return zone;
  const is = zone.map((c) => c[0]),
    rows = Math.max(...zone.map((c) => c[1])) + 1;
  let best = null,
    bestScore = -1;
  for (let a = Math.min(...is); a <= 0; a++)
    for (let b = 0; b <= Math.max(...is); b++)
      for (let h = 1; h <= rows; h++) {
        const part = zone.filter(([i, j]) => i >= a && i <= b && j < h);
        if (part.length > max || !part.some(([i, j]) => i === 0 && j === 0) || !joined(part)) continue;
        const score = part.length * 4 + (b - a + 1 >= h ? 2 : 0) + rng();
        if (score > bestScore) {
          bestScore = score;
          best = part;
        }
      }
  return best ?? [[0, 0]];
}
/** The stairwell's own room ids (no room's): a stair's foot on its storey, its well on the storey over it. */
const FOOT = -1,
  WELL = -2;
/** A storey's rooms, their parts (the first room's its first, the rest in turn), its special cells and its doorways. */
function storeyOf(k, roomCells, kind, rng, { up, down, single = false }) {
  const roles = kind === 'house' && single ? HOME_ONE_STOREY : ROLES[kind][Math.min(k, 1)],
    alone = roomCells.filter((c) => c.length).length === 1;
  const roleOf = (n) => (n === 0 || roles.length === 1 ? roles[0] : roles[1 + ((n - 1) % (roles.length - 1))]);
  const rooms = roomCells
    .filter((c) => c.length)
    .map((cells, n) => ({ cells, role: alone && kind === 'house' && k === 0 ? 'cottage' : roleOf(n) }));
  const roomOf = new Map();
  rooms.forEach((r, n) => r.cells.forEach(([i, j]) => roomOf.set(ck(i, j), n)));
  const avoid = new Set();
  if (down?.kind === 'ladder') {
    roomOf.set(wayCell(down), roomOf.get(ck(down.top[0], down.top[1])));
    avoid.add(wayCell(down));
  }
  if (down?.kind === 'stair') roomOf.set(wayCell(down), WELL);
  if (up?.kind === 'stair') roomOf.set(wayCell(up), FOOT);
  return {
    k,
    rooms,
    roomOf,
    doorways: doorwaysOf(rooms, roomOf, rng, avoid),
    up,
    down,
    exit: /** @type {number[] | null} */ (null),
  };
}

// ---------------------------------------------------------------- the storey's cells, as the record reads them

/** Whether a cell is a stairwell's on this storey (a stair's foot, or the well of the stair from below). */
const isStair = (st, key) =>
  (st.up?.kind === 'stair' && key === wayCell(st.up)) || (st.down?.kind === 'stair' && key === wayCell(st.down));
/** The stair's open edge on this storey: its foot's to the cell it is climbed from, its well's to the cell it is left by. */
function openEdges(st) {
  const out = [];
  if (st.up?.kind === 'stair') out.push([[st.up.i, st.up.j], at([st.up.i, st.up.j], st.up.e)]);
  if (st.down?.kind === 'stair') out.push([[st.down.i, st.down.j], fabricArrival(st.down)]);
  return out;
}
const isOpen = (st, a, b) =>
  openEdges(st).some(
    ([p, q]) =>
      (p[0] === a[0] && p[1] === a[1] && q[0] === b[0] && q[1] === b[1]) ||
      (p[0] === b[0] && p[1] === b[1] && q[0] === a[0] && q[1] === a[1]),
  );
/** The hole a ladder from below comes up through (a whole cell), the hatch one comes up through (a quarter of one), and
 *  the ladder up from a storey (in a cell of its own, or in a hatch's quarter). */
const holeOf = (st) => (st.down?.kind === 'ladder' ? [st.down.i, st.down.j] : null);
const hatchOf = (st) => (st.down?.kind === 'hatch' ? st.down : null);
const ladderOf = (st) => (st.up?.kind === 'ladder' || st.up?.kind === 'hatch' ? st.up : null);
/** A cell's four quarters (their ways from its middle) but one. */
const QUARTERS = Object.freeze([
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]);
const quartersBut = (q) => QUARTERS.filter(([a, b]) => a !== q[0] || b !== q[1]);
/** Where a climber up a hatch lands: the quarter across the cell from it, else (a hatch up from the same cell standing
 *  there) a quarter beside it - its middle's way from the cell's middle. */
function hatchLanding(st) {
  const h = /** @type {any} */ (hatchOf(st)),
    up = st.up?.kind === 'hatch' && st.up.i === h.i && st.up.j === h.j ? st.up.q : null;
  return [
    [-h.q[0], -h.q[1]],
    [-h.q[0], h.q[1]],
    [h.q[0], -h.q[1]],
  ].find(([a, b]) => !up || a !== up[0] || b !== up[1]);
}

/** What a cell's side is on a storey: 'exit', 'doorway', 'window', 'wall' - or null where it opens on its own room, on a
 *  stair's open end, or where the stair's own walls stand (a stairwell lays none of its own). */
export function fabricSideOf(plan, st, i, j, s) {
  const here = ck(i, j),
    nb = at([i, j], s),
    there = ck(nb[0], nb[1]);
  if (isStair(st, here) || isOpen(st, [i, j], nb)) return null;
  const r = st.roomOf.get(here),
    o = st.roomOf.get(there);
  if (o === r) return null;
  if (st.exit && st.exit[0] === i && st.exit[1] === j && st.exit[2] === s) return 'exit';
  const lad = ladderOf(st);
  if (lad && lad.i === i && lad.j === j && lad.s === s) return 'wall';
  if (o === undefined)
    return plan.blind.has(`${i},${j},${s}`) || hash32(SALT, plan.key, st.k, i + 64, j + 64, s) % 4 === 0
      ? 'wall'
      : 'window';
  return st.doorways.has(edgeKey([i, j], nb)) ? 'doorway' : 'wall';
}

// ---------------------------------------------------------------- the record: the kit, the furniture, the cast

/** A position on the record: a whole unit, or a half where a quarter piece's edge needs one (a hatch's floor and ceiling). */
const half = (v) => Math.round(v * 2) / 2;
const model = (id, type, x, y, z, yRotation, scale = null) => ({
  modelId: String(id),
  modelIdNum: id,
  objectType: type,
  xPos: half(x),
  yPos: half(y),
  zPos: half(z),
  xRotation: 0,
  yRotation: mod(Math.round(yRotation), 2048),
  zRotation: 0,
  ...(scale ? scale : {}),
});
/**
 * A KIT PIECE where the plan stands it: its set-0 origin at (x, up, z) - `up` classic units over the interior's ground -
 * turned `turn`, stretched about its origin by `sx` along, `sy` up and `sz` across (RMBLayout.GetModelScaleVector's
 * xScale, yScale and zScale); a piece made elsewhere (KIT_SHIFT) moved back so its own geometry stands where set 0's would.
 * The record's position is its model's origin (RMB's: y negated - interiorLayout.js).
 */
function kitPiece(piece, set, objectType, x, up, z, turn, sy = 1, sx = 1, sz = 1) {
  const id = kitModel(piece, set),
    [hx, hy, hz] = KIT_SHIFT[id] ?? [0, 0, 0],
    [ox, oz] = turned(turn, hx * sx, hz * sz);
  const scale =
    sx === 1 && sy === 1 && sz === 1
      ? null
      : {
          ...(sx === 1 ? {} : { xScale: sx }),
          ...(sy === 1 ? {} : { yScale: sy }),
          ...(sz === 1 ? {} : { zScale: sz }),
        };
  return model(id, objectType, x - ox, -(up - hy * sy), z - oz, turn, scale);
}
/** A QUARTER of a floor or a ceiling tile: the piece at half its size, its outer edges on the whole tile's (its measured
 *  extent, KIT_MEASURE's floor and ceiling boxes) - in the quarter `q` of the cell (x, z). */
function quarterPiece(piece, set, objectType, x, up, z, q) {
  const [x0, x1, z0, z1] = piece === KIT_PIECE.floor ? KIT_MEASURE.floorBox : KIT_MEASURE.ceilingBox;
  return kitPiece(
    piece,
    set,
    objectType,
    x + (q[0] > 0 ? x1 : x0) / 2,
    up,
    z + (q[1] > 0 ? z1 : z0) / 2,
    0,
    1,
    0.5,
    0.5,
  );
}
const flat = (archive, record, x, y, z, extra = {}) => ({
  xPos: Math.round(x),
  yPos: Math.round(y),
  zPos: Math.round(z),
  textureArchive: archive,
  textureRecord: record,
  textureBitfield: (archive << 7) | record,
  factionID: 0,
  flags: 0,
  ...extra,
});
/** A hatch's ladder stands in its quarter this far along the corner's other wall from its cell's middle: the ladder's
 *  half width and a hand clear of that wall's face. */
const HATCH_ALONG = KIT_MEASURE.wallHalf - FURNITURE[KIT_LADDER][1] - 1;
/** Where the ladder stands in its cell: its back (+z) a hand off its side's wall - a hatch's in its quarter - and how far
 *  before it its foot's marker stands (a whole cell's: across the cell, 16 past its middle; a hatch's: 40 - Daggerfall's
 *  own stand 40 to 64 before theirs). */
function ladderAt(w) {
  const d = SIDE[w.s],
    e = w.kind === 'hatch' ? SIDE[w.t] : [0, 0],
    off = KIT_MEASURE.wallHalf - FURNITURE[KIT_LADDER][3] - 1;
  return {
    x: cellX(w.i) + d[0] * off + e[0] * HATCH_ALONG,
    z: cellZ(w.j) + d[1] * off + e[1] * HATCH_ALONG,
    turn: SIDE_TURN[w.s] - SIDE_TURN[2],
    foot: w.kind === 'hatch' ? 40 : off + 16,
  };
}
/** A piece's footprint (interior units: [x0, z0, x1, z1]) stood at (x, z) turned `turn`. */
export function fabricPieceBox(id, turn, x, z) {
  const [x0, x1, z0, z1] = FURNITURE[id],
    c = [turned(turn, x0, z0), turned(turn, x1, z0), turned(turn, x1, z1), turned(turn, x0, z1)];
  return [
    Math.min(...c.map((p) => p[0])) + x,
    Math.min(...c.map((p) => p[1])) + z,
    Math.max(...c.map((p) => p[0])) + x,
    Math.max(...c.map((p) => p[1])) + z,
  ];
}
const overlaps = (a, b, m = 2) => a[0] < b[2] + m && b[0] < a[2] + m && a[1] < b[3] + m && b[1] < a[3] + m;
/** A post's face stands KIT_INSET out from its corner (and the model's face KIT_MEASURE.postFace behind its origin). */
const POST_OUT = KIT_INSET + KIT_MEASURE.postFace;
/** A STAIR'S LINTELS (classic units over its foot's storey): the stair is Daggerfall's at its own pitch - its foot's end
 *  wall starts 126 up and its ceiling stands 255 up, where the rooms' ceilings stand 128 and 257 (KIT_STOREY + KIT_CELL) -
 *  so a look up into either mouth met the back of its end wall, or the dark over its ceiling, in a band two units high.
 *  A lintel the band's own height (the set's wall, its height a sixty-third part) closes each from the mouth's side alone:
 *  its foot exactly at the end wall's foot (126) and at the stair's ceiling (255), so nothing of it shows from inside the
 *  stair (a lower one showed its back there), its top at the room's ceiling (128, 257), under the next storey's floor (a
 *  taller one stood out of that floor, against the first riser of a stair standing over the mouth) - its middle at
 *  `foot` and at `head`. */
const STAIR_LINTEL = Object.freeze({ foot: KIT_CELL - 1, head: KIT_STOREY + KIT_CELL - 1, scale: 2 / 126 });

/**
 * A BUILDING'S INTERIOR RECORD - RMB's own shape (BlocksFile's parsed subrecord interior: its header, 3D objects, flats,
 * section-3 spawn points, people and doors) - from its plan and its cast (its donor's interior record, read from the
 * player's BLOCKS.BSA: its people, its quest, rest and treasure markers, its lights' pictures; none, and the rooms stand
 * empty of people). Every model is the kit's or a prop of FURNITURE; every position the kit's grid's.
 * @param {ReturnType<typeof fabricInteriorPlan>} plan @param {any} [cast]
 */
export function fabricInteriorRecord(plan, cast = null) {
  const rng = seededRng(hash32(SALT, plan.key, 2));
  const objs = [],
    flats = [],
    people = [],
    doors = [],
    spawns = [];
  const W = KIT_MEASURE.wallHalf,
    set = plan.set;
  /** @type {Array<{ k: number, x: number, z: number, room: number, used: boolean, near: number }>} */
  const spots = [];
  /** @type {{ k: number, x: number, z: number } | null} */
  let keeper = null;
  const beds = [];
  for (const st of plan.storeys) {
    const y0 = st.k * KIT_STOREY,
      hatchIn = hatchOf(st),
      hatchUp = st.up?.kind === 'hatch' ? st.up : null;
    const below = st.down && !hatchIn ? wayCell(st.down) : null,
      above = st.up && !hatchUp ? wayCell(st.up) : null;
    // the floors (none over a well or a hole, three quarters round a hatch), the ceilings (none under a way up - three
    // quarters round a hatch - none over a well, the stair's own), the spawn points (DaggerfallInterior.AddSpawnPoints'
    // section-3 records: a cell's middle on the floor a body stands on - a hatch's cell's, its landing's quarter)
    for (const [i, j] of plan.cells) {
      const x = cellX(i),
        z = cellZ(j),
        here = ck(i, j),
        hatched = hatchIn !== null && here === wayCell(hatchIn);
      if (hatched)
        for (const q of quartersBut(hatchIn.q))
          objs.push(quarterPiece(KIT_PIECE.floor, set, FLOOR_MODEL_TYPE, x, y0, z, q));
      else if (here !== below) objs.push(kitPiece(KIT_PIECE.floor, set, FLOOR_MODEL_TYPE, x, y0, z, 0));
      if (hatchUp && here === wayCell(hatchUp))
        for (const q of quartersBut(hatchUp.q))
          objs.push(quarterPiece(KIT_PIECE.ceiling, set, 13, x, y0 + KIT_CELL, z, q));
      else if (here !== above && !(st.down?.kind === 'stair' && here === below))
        objs.push(kitPiece(KIT_PIECE.ceiling, set, 13, x, y0 + KIT_CELL, z, 0));
      const [lx, lz] = hatched ? hatchLanding(st) : [0, 0];
      if (here !== below && !(st.up?.kind === 'stair' && here === above))
        spawns.push({
          xPos: Math.round(x + lx * 32),
          yPos: -y0,
          zPos: Math.round(z + lz * 32),
          unknown1: 0,
          unknown2: 10,
          unknown3: 0,
        });
    }
    // the walls: each cell's side on another room or the street, its face KIT_INSET in from the edge
    const wy = y0 + KIT_CELL / 2;
    for (const [i, j] of plan.cells)
      for (let s = 0; s < 4; s++) {
        const kind = fabricSideOf(plan, st, i, j, s);
        if (!kind) continue;
        const x = cellX(i),
          z = cellZ(j),
          d = SIDE[s],
          piece =
            kind === 'exit'
              ? KIT_PIECE.exit
              : kind === 'doorway'
                ? KIT_PIECE.doorway
                : kind === 'window'
                  ? KIT_PIECE.window
                  : KIT_PIECE.wall;
        const out = W + (kind === 'doorway' ? KIT_MEASURE.doorwayBack : 0);
        objs.push(kitPiece(piece, set, 13, x + d[0] * out, wy, z + d[1] * out, SIDE_TURN[s], FABRIC_WALL_SCALE));
      }
    // the posts: at each corner of the grid where a wall meets another or ends, a face toward every way out of the corner
    // that opens between two cells of the building - half a face where the other half is a stair's own wall
    const roomAt = (c) => st.roomOf.get(ck(c[0], c[1]));
    const corners = new Set();
    for (const [i, j] of plan.cells)
      for (const [a, b] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        corners.add(ck(i + a, j + b));
    for (const v of [...corners].sort()) {
      const [i, j] = v.split(',').map(Number),
        vx = cellX(i) - KIT_CELL / 2,
        vz = cellZ(j) - KIT_CELL / 2;
      // the four ways out of the corner: [its side's way, the cell on its one hand, the cell on its other]
      const spokes = /** @type {Array<[number, number[], number[]]>} */ ([
        [0, [i - 1, j - 1], [i, j - 1]],
        [1, [i, j - 1], [i, j]],
        [2, [i - 1, j], [i, j]],
        [3, [i - 1, j - 1], [i - 1, j]],
      ]);
      const wall = spokes.map(([, a, b]) => roomAt(a) !== roomAt(b) && !isOpen(st, a, b));
      if (!wall.some(Boolean)) continue;
      for (const [s, a, b] of spokes) {
        if (wall[s] || roomAt(a) === undefined || roomAt(b) === undefined) continue;
        const d = SIDE[s],
          turn = SIDE_TURN[s] - SIDE_TURN[0];
        const half = isStair(st, ck(a[0], a[1])) ? b : isStair(st, ck(b[0], b[1])) ? a : null;
        if (!half) {
          objs.push(
            kitPiece(KIT_PIECE.post, set, 13, vx + d[0] * POST_OUT, wy, vz + d[1] * POST_OUT, turn, FABRIC_WALL_SCALE),
          );
          continue;
        }
        // the half on the room's side of the corner: the post's width halved, its middle a quarter of it toward the room
        // (across the way out: along x where the way runs along z, and along z where it runs along x)
        const ux = d[0] ? 0 : Math.sign(cellX(half[0]) - vx),
          uz = d[0] ? Math.sign(cellZ(half[1]) - vz) : 0,
          q = KIT_INSET / 2;
        objs.push(
          kitPiece(
            KIT_PIECE.post,
            set,
            13,
            vx + d[0] * POST_OUT + ux * q,
            wy,
            vz + d[1] * POST_OUT + uz * q,
            turn,
            FABRIC_WALL_SCALE,
            0.5,
          ),
        );
      }
    }
    // the doors: Daggerfall's in each doorway, in the far half of the wall from the room it is reached from
    for (const w of [...st.doorways.values()]) {
      const fromA = st.roomOf.get(ck(w.a[0], w.a[1])) === w.from,
        [ci, cj] = fromA ? w.a : w.b,
        [ni, nj] = fromA ? w.b : w.a;
      const s = SIDE.findIndex(([dx, dz]) => ci + dx === ni && cj + dz === nj);
      const [ox, oz] = turned(SIDE_TURN[s], KIT_DOOR.out, KIT_DOOR.along);
      doors.push({
        xPos: Math.round(cellX(ci) + ox),
        yPos: KIT_DOOR.y - y0,
        zPos: Math.round(cellZ(cj) + oz),
        yRotation: mod(KIT_DOOR.yRotation + SIDE_TURN[s], 2048),
        openRotation: KIT_DOOR.openRotation,
        doorModelIndex: KIT_DOOR.index,
        unknown: KIT_DOOR.unknown,
        nullValue1: 0,
      });
    }
    // the way up: Daggerfall's stair (its foot on this storey, its well the next's), or its ladder and the climb's markers
    if (st.up?.kind === 'stair') {
      const { i, j, e } = st.up,
        x = cellX(i),
        z = cellZ(j),
        f = SIDE[e],
        h = SIDE[(e + 2) % 4],
        E = KIT_CELL / 2;
      objs.push(kitPiece(KIT_PIECE.stair, set, 13, x, y0 + KIT_CELL, z, SIDE_TURN[e] - SIDE_TURN[2]));
      // its lintels: the set's wall a band high over each mouth, facing out of it - over its foot from under the next
      // storey's floor down past this storey's ceiling, over its head from its own ceiling up past the next storey's
      objs.push(
        kitPiece(
          KIT_PIECE.wall,
          set,
          13,
          x + f[0] * E,
          y0 + STAIR_LINTEL.foot,
          z + f[1] * E,
          SIDE_TURN[(e + 2) % 4],
          STAIR_LINTEL.scale,
        ),
      );
      objs.push(
        kitPiece(
          KIT_PIECE.wall,
          set,
          13,
          x + h[0] * E,
          y0 + STAIR_LINTEL.head,
          z + h[1] * E,
          SIDE_TURN[e],
          STAIR_LINTEL.scale,
        ),
      );
    }
    const lad = ladderOf(st);
    if (lad) {
      const a = ladderAt(lad),
        d = SIDE[lad.s];
      objs.push(model(KIT_LADDER, PROP_MODEL_TYPE, a.x, y0 + 2, a.z, a.turn));
      flats.push(
        flat(EDITOR_FLATS_ARCHIVE, INTERIOR_MARKER.LADDER_BOTTOM, a.x - d[0] * a.foot, -y0, a.z - d[1] * a.foot),
      );
    }
    const hole = holeOf(st);
    if (hole && st.down) {
      // the landing: beside the hole, a stride in from its edge
      const t = st.down.top,
        s = SIDE.findIndex(([dx, dz]) => t[0] + dx === hole[0] && t[1] + dz === hole[1]);
      flats.push(
        flat(
          EDITOR_FLATS_ARCHIVE,
          INTERIOR_MARKER.LADDER_TOP,
          cellX(t[0]) + SIDE[s][0] * 30,
          -y0,
          cellZ(t[1]) + SIDE[s][1] * 30,
        ),
      );
    }
    if (hatchIn) {
      // a hatch's landing: in the quarter across its cell from it
      const [lx, lz] = hatchLanding(st);
      flats.push(
        flat(
          EDITOR_FLATS_ARCHIVE,
          INTERIOR_MARKER.LADDER_TOP,
          cellX(hatchIn.i) + lx * 30,
          -y0,
          cellZ(hatchIn.j) + lz * 30,
        ),
      );
    }
    // the furniture
    const fk = furnishStorey(plan, st, rng, objs, spots, {
      needBed: plan.kind === 'house' && st.k === plan.storeys.length - 1 && !beds.length,
    });
    keeper ??= fk.keeper;
    beds.push(...fk.beds);
  }
  // the street door's landing (InteriorMarkerTypes.Enter): its cell's middle
  flats.push(flat(EDITOR_FLATS_ARCHIVE, INTERIOR_MARKER.ENTER, cellX(0), 0, cellZ(0)));
  castInto(plan, cast, { flats, people, spots, keeper, beds, rng });
  return {
    header: {
      num3dObjectRecords: objs.length,
      numFlatObjectRecords: flats.length,
      numSection3Records: spawns.length,
      numPeopleRecords: people.length,
      numDoorRecords: doors.length,
    },
    block3dObjectRecords: objs,
    blockFlatObjectRecords: flats,
    blockSection3Records: spawns,
    blockPeopleRecords: people,
    blockDoorRecords: doors,
  };
}

// ---------------------------------------------------------------- the furniture

/** What each part of a building is furnished with, in order: [part, how many] - 'counter' the keeper's (a shop's, a
 *  bank's), 'bar' a tavern's two counters, 'shelf' the pool's shelves (POOL_SHELVES), 'table' a table and its seats. */
const PARTS = Object.freeze({
  shop: [
    ['counter', 1],
    ['shelf', 9],
    ['crate', 2],
    ['chest', 1],
  ],
  store: [
    ['crate', 4],
    ['cabinet', 1],
    ['chest', 1],
    ['shelf', 1],
    ['crate', 3],
  ],
  bedroom: [
    ['bed', 1],
    ['wardrobe', 1],
    ['chest', 1],
    ['dresser', 1],
    ['bed', 1],
    ['cupboard', 1],
  ],
  living: [
    ['hearth', 1],
    ['table', 1],
    ['cupboard', 1],
    ['bench', 1],
    ['dresser', 1],
    ['shelf', 1],
    ['table', 1],
    ['crate', 1],
  ],
  kitchen: [
    ['table', 1],
    ['cabinet', 2],
    ['crate', 2],
    ['cupboard', 1],
    ['hearth', 1],
  ],
  cottage: [
    ['bed', 1],
    ['hearth', 1],
    ['table', 1],
    ['chest', 1],
    ['cupboard', 1],
    ['crate', 1],
  ],
  taproom: [
    ['bar', 1],
    ['hearth', 1],
    ['table', 4],
    ['bench', 2],
    ['crate', 2],
    ['table', 4],
  ],
  cellar: [
    ['crate', 6],
    ['cabinet', 1],
    ['shelf', 1],
  ],
  guestroom: [
    ['bed', 1],
    ['chest', 1],
    ['dresser', 1],
    ['bed', 1],
  ],
  hall: [
    ['table', 2],
    ['shelf', 4],
    ['hearth', 1],
    ['bench', 2],
    ['chest', 1],
    ['table', 2],
    ['shelf', 4],
  ],
  study: [
    ['shelf', 4],
    ['table', 1],
    ['pedestal', 1],
    ['chest', 1],
  ],
  counting: [
    ['counter', 1],
    ['chest', 3],
    ['shelf', 2],
    ['crate', 1],
  ],
  vault: [
    ['chest', 6],
    ['crate', 3],
  ],
  library: [
    ['shelf', 12],
    ['table', 2],
    ['pedestal', 1],
  ],
  nave: [
    ['pedestal', 2],
    ['bench', 4],
    ['table', 1],
    ['shelf', 2],
    ['bench', 4],
  ], // a temple's: its altar stands and its pews
});
/** The keeper stands KEEPER_AT behind the counter's cell's middle (the counter 12 toward the door, 13 deep), the floor to
 *  KEEPER_BACK kept clear behind them. */
const KEEPER_AT = 18,
  KEEPER_BACK = 32;
/** A BODY'S ROOM (classic units): the player's capsule's radius (player/motor.js CAPSULE_RADIUS, 0.35 m) - a body's middle
 *  stands that far from every wall and every piece. The walk's pixel, and the share of a room's free floor a piece may
 *  leave cut off from its ways (a corner behind a wardrobe; never a way, never half the room). */
const BODY = 14,
  PX = 8,
  WALK_SHARE = 0.8;
/** Where a body stands to pass a way: THRESHOLD in from its wall's face (a doorway's, the street door's, a stair's mouth).
 *  Kept clear of every piece: a door's swing either side of its doorway (DaggerfallActionDoor's leaf, 48 wide, turning
 *  about its hinge - KIT_DOOR), SWING deep and its opening's width and a hand (DOOR_SPAN either side of its middle); a
 *  stair's mouth its width, MOUTH deep; the street door's way to its landing (the Enter marker, its cell's middle). */
const THRESHOLD = 24,
  SWING = 48,
  MOUTH = 44,
  DOOR_SPAN = 30;
/** Each way through a storey's cells: [cell, side, kind] - its doorways (both ends), its street door, a stair's open ends
 *  (the cell it is climbed from, the cell it is left by). */
function waysOf(st) {
  const out = [];
  for (const w of st.doorways.values()) {
    const s = SIDE.findIndex(([dx, dz]) => w.a[0] + dx === w.b[0] && w.a[1] + dz === w.b[1]);
    out.push([w.a, s, 'door'], [w.b, (s + 2) % 4, 'door']);
  }
  if (st.exit) out.push([[st.exit[0], st.exit[1]], st.exit[2], 'exit']);
  for (const [p, q] of openEdges(st))
    out.push([q, SIDE.findIndex(([dx, dz]) => q[0] + dx === p[0] && q[1] + dz === p[1]), 'stair']);
  return out;
}
/** A box `depth` deep in from the wall on side `s` of cell (i, j), `half` either side of the side's middle. */
function sideBox(i, j, s, depth, half) {
  const x = cellX(i),
    z = cellZ(j),
    d = SIDE[s],
    W = KIT_CELL / 2,
    a = d[0] ? [x + d[0] * W, x + d[0] * (W - depth)] : [z + d[1] * W, z + d[1] * (W - depth)];
  return d[0]
    ? [Math.min(...a), z - half, Math.max(...a), z + half]
    : [x - half, Math.min(...a), x + half, Math.max(...a)];
}

/**
 * A ROOM'S WALK: the floor a body's middle can stand on (BODY from every wall and post - its cells' inner floor, on across
 * a side open on its own room, the corner between four of its cells where no post stands), the pieces stood on it (their
 * boxes BODY wider) and its ANCHORS - where its ways are passed (its doorways', its street door's and a stair's mouth's
 * thresholds), a ladder's foot and a landing's marker. A piece is stood only where every anchor is still reached from the
 * first, and no more of the free floor than WALK_SHARE's rest is cut off: every room stays walkable, every way open.
 */
function roomWalk(plan, st, cells, anchors) {
  const inRoom = new Set(cells.map(([i, j]) => ck(i, j)));
  const openMemo = new Map();
  const open = (i, j, s) => {
    const k = `${i},${j},${s}`;
    if (!openMemo.has(k)) {
      const nb = at([i, j], s);
      openMemo.set(k, inRoom.has(ck(nb[0], nb[1])) && fabricSideOf(plan, st, i, j, s) === null);
    }
    return openMemo.get(k);
  };
  const xs = cells.map(([i]) => cellX(i)),
    zs = cells.map(([, j]) => cellZ(j)),
    H = KIT_CELL / 2;
  const x0 = Math.min(...xs) - H,
    z0 = Math.min(...zs) - H,
    nx = Math.round((Math.max(...xs) + H - x0) / PX),
    nz = Math.round((Math.max(...zs) + H - z0) / PX);
  const N = nx * nz,
    free = new Uint8Array(N),
    L = KIT_MEASURE.wallHalf - BODY;
  let freeCount = 0;
  // cell by cell (a cell's pixels its own: the pixel divides the cell): its inner floor, on toward an open side, into a
  // corner where no post stands
  const side = (i, j, ex, ez) => {
    if ((ex >= 0 && !open(i, j, ex)) || (ez >= 0 && !open(i, j, ez))) return false;
    if (ex < 0 || ez < 0) return true;
    const di = i + SIDE[ex][0],
      dj = j + SIDE[ez][1];
    return inRoom.has(ck(di, dj)) && open(di, dj, (ex + 2) % 4) && open(di, dj, (ez + 2) % 4);
  };
  for (const [i, j] of cells) {
    const p0 = Math.round((cellX(i) - H - x0) / PX),
      q0 = Math.round((cellZ(j) - H - z0) / PX),
      n = KIT_CELL / PX;
    const ok = new Map();
    for (let pz = q0; pz < q0 + n; pz++)
      for (let px = p0; px < p0 + n; px++) {
        const dx = x0 + (px + 0.5) * PX - cellX(i),
          dz = z0 + (pz + 0.5) * PX - cellZ(j),
          ex = dx > L ? 1 : dx < -L ? 3 : -1,
          ez = dz > L ? 2 : dz < -L ? 0 : -1;
        const k = (ex + 1) * 5 + ez + 1;
        if (!ok.has(k)) ok.set(k, side(i, j, ex, ez));
        if (ok.get(k)) {
          free[pz * nx + px] = 1;
          freeCount++;
        }
      }
  }
  /** The pixels whose middles stand inside a box: [px0, pz0, px1, pz1] (empty where px1 < px0). */
  const rect = (b, by) => [
    Math.max(0, Math.floor((b[0] - by - x0) / PX - 0.5) + 1),
    Math.max(0, Math.floor((b[1] - by - z0) / PX - 0.5) + 1),
    Math.min(nx - 1, Math.ceil((b[2] + by - x0) / PX - 0.5) - 1),
    Math.min(nz - 1, Math.ceil((b[3] + by - z0) / PX - 0.5) - 1),
  ];
  /** A box no body stands in (a piece's, a hatch's open quarter) - `by` round it. */
  const block = (b, by = BODY) => {
    const r = rect(b, by);
    for (let pz = r[1]; pz <= r[3]; pz++)
      for (let px = r[0]; px <= r[2]; px++) {
        const p = pz * nx + px;
        if (free[p]) {
          free[p] = 0;
          freeCount--;
        }
      }
  };
  const mark = new Uint32Array(N),
    todo = new Int32Array(N);
  let gen = 0;
  /** The pixel a point stands in or beside that `test` takes, else -1. */
  const near = ([x, z], test) => {
    const cx = Math.floor((x - x0) / PX),
      cz = Math.floor((z - z0) / PX);
    for (const [ox, oz] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const px = cx + ox,
        pz = cz + oz;
      if (px >= 0 && pz >= 0 && px < nx && pz < nz && test(pz * nx + px)) return pz * nx + px;
    }
    return -1;
  };
  /** The free floor reached from the first anchor (with `extra`, a piece's box, stood too): its generation's marks (the
   *  pixels reached), how many, and how many free. */
  const reach = (extra) => {
    const r = extra ? rect(extra, BODY) : [1, 1, 0, 0];
    let total = freeCount;
    for (let pz = r[1]; pz <= r[3]; pz++) for (let px = r[0]; px <= r[2]; px++) if (free[pz * nx + px]) total--;
    const g = ++gen,
      out = (p) => {
        const px = p % nx,
          pz = (p - px) / nx;
        return px < r[0] || px > r[2] || pz < r[1] || pz > r[3];
      };
    const start = anchors.length ? near(anchors[0], (p) => free[p] === 1 && out(p)) : -1;
    if (start < 0) return { g, total, reached: 0 };
    let n = 0,
      top = 0;
    mark[start] = g;
    todo[top++] = start;
    const take = (q) => {
      if (free[q] && mark[q] !== g && out(q)) {
        mark[q] = g;
        todo[top++] = q;
      }
    };
    while (n < top) {
      const p = todo[n++],
        px = p % nx;
      if (px > 0) take(p - 1);
      if (px < nx - 1) take(p + 1);
      if (p >= nx) take(p - nx);
      if (p + nx < N) take(p + nx);
    }
    return { g, total, reached: top };
  };
  const reachedBy = (r) => (pt) => near(pt, (q) => mark[q] === r.g) >= 0;
  // the anchors a body can stand at as the room is built (an anchor the walls leave no floor at is no anchor), the first
  // one with floor first
  const onFloor = anchors.findIndex((a) => near(a, (q) => free[q] === 1) >= 0);
  if (onFloor > 0) anchors.unshift(...anchors.splice(onFloor, 1));
  const first = reachedBy(reach(null));
  for (let n = anchors.length - 1; n > 0; n--) if (!first(anchors[n])) anchors.splice(n, 1);
  return {
    block,
    /** Whether a piece of box `b` may stand: every anchor (and each of `needs`) still reached, the free floor kept. */
    keeps(b, needs = []) {
      if (!anchors.length) return true;
      const r = reach(b);
      if (r.reached < WALK_SHARE * r.total) return false;
      const reached = reachedBy(r);
      return anchors.every(reached) && needs.every(reached);
    },
    /** Whether a point is on the floor a body reaches now. */
    reached() {
      return reachedBy(reach(null));
    },
  };
}

/**
 * A storey's furniture, room by room: each part stood where it fits - against a wall (a wall's side with no doorway, door
 * or ladder in it, at its middle or in a corner of it; a tall piece by a blind wall first), or on the floor of a cell - and
 * only where its room stays walkable (roomWalk: every way still reached, its floor kept), clear of a door's swing, a
 * stair's mouth, a ladder and its foot, a landing. A home's storey that is its last with no bed stood yet takes one in the
 * first room that has room for it. Answers the keeper's spot (behind the counter) and the beds; fills `spots` with the
 * free floor a body reaches (the cast's places).
 */
function furnishStorey(plan, st, rng, objs, spots, { needBed = false } = {}) {
  const y0 = st.k * KIT_STOREY,
    W = KIT_MEASURE.wallHalf;
  const occ = [],
    placed = []; // every box kept clear of pieces, and the pieces' own
  const lad = ladderOf(st),
    hole = holeOf(st),
    hatch = hatchOf(st),
    ways = waysOf(st);
  /** Each room's anchors: [x, z] (roomWalk). */
  const anchors = st.rooms.map(() => /** @type {number[][]} */ ([]));
  const roomAt = (c) => st.roomOf.get(ck(c[0], c[1]));
  const anchor = (c, pt) => {
    const r = roomAt(c);
    if (r !== undefined && r >= 0) anchors[r].push(pt);
  };
  // the ways: each one's threshold an anchor, a door's swing and a stair's mouth kept clear
  for (const [c, s, kind] of ways) {
    const d = SIDE[s];
    anchor(c, [cellX(c[0]) + d[0] * (W - THRESHOLD), cellZ(c[1]) + d[1] * (W - THRESHOLD)]);
    occ.push(
      kind === 'stair'
        ? sideBox(c[0], c[1], s, KIT_INSET + MOUTH, W)
        : sideBox(c[0], c[1], s, kind === 'door' ? KIT_INSET + SWING : KIT_CELL / 2 + 20, DOOR_SPAN),
    );
    if (kind === 'exit') anchor(c, [cellX(c[0]), cellZ(c[1])]); // the street door's landing (the Enter marker)
  }
  // the ladder and the floor before it (a climber's way to it, past its foot's marker)
  if (lad) {
    const d = SIDE[lad.s],
      a = ladderAt(lad),
      near = [a.x - d[0] * 32, a.z - d[1] * 32],
      far = [a.x - d[0] * (a.foot + 24), a.z - d[1] * (a.foot + 24)];
    occ.push(fabricPieceBox(KIT_LADDER, a.turn, a.x, a.z));
    occ.push(
      d[0]
        ? [Math.min(near[0], far[0]), a.z - DOOR_SPAN, Math.max(near[0], far[0]), a.z + DOOR_SPAN]
        : [a.x - DOOR_SPAN, Math.min(near[1], far[1]), a.x + DOOR_SPAN, Math.max(near[1], far[1])],
    );
    anchor([lad.i, lad.j], [a.x - d[0] * a.foot, a.z - d[1] * a.foot]);
  }
  // a ladder's landing beside its hole, a hatch's in its cell
  if (hole && st.down) {
    const t = st.down.top,
      s = SIDE.findIndex(([dx, dz]) => t[0] + dx === hole[0] && t[1] + dz === hole[1]),
      p = [cellX(t[0]) + SIDE[s][0] * 30, cellZ(t[1]) + SIDE[s][1] * 30];
    occ.push([p[0] - 20, p[1] - 20, p[0] + 20, p[1] + 20]);
    anchor(t, p);
  }
  /** @type {number[] | null} */
  let hatchQuarter = null;
  if (hatch) {
    const x = cellX(hatch.i),
      z = cellZ(hatch.j),
      [lx, lz] = hatchLanding(st),
      H = KIT_CELL / 2,
      p = [x + lx * 30, z + lz * 30];
    hatchQuarter = [
      Math.min(x, x + hatch.q[0] * H),
      Math.min(z, z + hatch.q[1] * H),
      Math.max(x, x + hatch.q[0] * H),
      Math.max(z, z + hatch.q[1] * H),
    ];
    occ.push(hatchQuarter, [p[0] - 20, p[1] - 20, p[0] + 20, p[1] + 20]);
    anchor([hatch.i, hatch.j], p);
  }
  let keeper = null;
  const beds = [];
  const busy = new Set(ways.map(([c]) => ck(c[0], c[1])));
  if (lad) busy.add(ck(lad.i, lad.j));
  if (hatch) busy.add(ck(hatch.i, hatch.j));
  const blocked = new Set();
  const shelves = POOL_SHELVES[plan.pool] ?? POOL_SHELVES.house2;
  const rooms = st.rooms.map((room, r) => {
    const cells = room.cells.filter((c) => !hole || c[0] !== hole[0] || c[1] !== hole[1]);
    const inRoom = new Set(room.cells.map(([i, j]) => ck(i, j)));
    const walk = roomWalk(plan, st, cells, anchors[r]);
    if (lad && inRoom.has(ck(lad.i, lad.j))) {
      const a = ladderAt(lad);
      walk.block(fabricPieceBox(KIT_LADDER, a.turn, a.x, a.z));
    }
    if (hatchQuarter && inRoom.has(ck(/** @type {any} */ (hatch).i, /** @type {any} */ (hatch).j)))
      walk.block(hatchQuarter, BODY);
    // the room's wall slots: [cell, side, window?]
    const slots = [];
    for (const [i, j] of cells)
      for (let s = 0; s < 4; s++) {
        const kind = fabricSideOf(plan, st, i, j, s);
        if (kind !== 'wall' && kind !== 'window') continue;
        if (lad && lad.i === i && lad.j === j && lad.s === s) continue;
        slots.push({ i, j, s, window: kind === 'window', used: false });
      }
    for (let n = slots.length - 1; n > 0; n--) {
      const m = Math.floor(rng() * (n + 1));
      [slots[n], slots[m]] = [slots[m], slots[n]];
    }
    /** The rectangle a piece in cell (i, j) may stand in: the cell's walls, or on into a neighbour of its own room. */
    const room4 = (i, j) => [
      cellX(i) - W - (inRoom.has(ck(i - 1, j)) ? KIT_CELL : 0),
      cellZ(j) - W - (inRoom.has(ck(i, j - 1)) ? KIT_CELL : 0),
      cellX(i) + W + (inRoom.has(ck(i + 1, j)) ? KIT_CELL : 0),
      cellZ(j) + W + (inRoom.has(ck(i, j + 1)) ? KIT_CELL : 0),
    ];
    const within = (b, a) => b[0] >= a[0] && b[1] >= a[1] && b[2] <= a[2] && b[3] <= a[3];
    const stand = (id, x, z, turn, i, j, needs = []) => {
      const b = fabricPieceBox(id, turn, x, z);
      if (!within(b, room4(i, j)) || occ.some((o) => overlaps(b, o)) || !walk.keeps(b, needs)) return false;
      occ.push(b);
      placed.push(b);
      walk.block(b);
      objs.push(model(id, PROP_MODEL_TYPE, x, y0 + 2, z, turn));
      return true;
    };
    /** A piece against a wall: its back to the slot's wall, a hand off the wall's face - at the wall's middle, else in
     *  either corner of it (the seed's order). */
    const atWall = (id, preferBlind) => {
      const [x0, , z0, z1, h, back] = FURNITURE[id];
      const order =
        preferBlind && h > TALL ? [...slots.filter((sl) => !sl.window), ...slots.filter((sl) => sl.window)] : slots;
      for (const sl of order) {
        if (sl.used) continue;
        const bi = back === '+z' ? 2 : back === '-x' ? 3 : 0,
          turn = SIDE_TURN[sl.s] - SIDE_TURN[bi];
        const ext = bi === 2 ? z1 : bi === 3 ? -x0 : -z0,
          off = W - ext - 1,
          d = SIDE[sl.s],
          u = SIDE[(sl.s + 1) % 4];
        const cx = cellX(sl.i),
          cz = cellZ(sl.j),
          bx = cx + d[0] * off,
          bz = cz + d[1] * off,
          b0 = fabricPieceBox(id, turn, bx, bz);
        // its reach along the wall from the side's middle, and how far it slides either way and stays on the wall
        const lo = u[0] ? (u[0] > 0 ? b0[0] - cx : cx - b0[2]) : u[1] > 0 ? b0[1] - cz : cz - b0[3],
          hi = u[0] ? (u[0] > 0 ? b0[2] - cx : cx - b0[0]) : u[1] > 0 ? b0[3] - cz : cz - b0[1];
        const slides = rng() < 0.5 ? [0, W - 1 - hi, -W + 1 - lo] : [0, -W + 1 - lo, W - 1 - hi];
        for (const t of slides) {
          if (t !== 0 && (t > W - 1 - hi + 1e-6 || t < -W + 1 - lo - 1e-6 || Math.abs(t) < 1)) continue;
          const x = bx + u[0] * t,
            z = bz + u[1] * t;
          if (stand(id, x, z, turn, sl.i, sl.j)) {
            sl.used = true;
            return { ...sl, id, turn, x, z };
          }
        }
      }
      return null;
    };
    /** Floor cells for a table: no way through first, the seed's order. */
    const floorCells = () => {
      const free = cells.filter(([i, j]) => !blocked.has(ck(i, j)));
      for (let n = free.length - 1; n > 0; n--) {
        const m = Math.floor(rng() * (n + 1));
        [free[n], free[m]] = [free[m], free[n]];
      }
      return [...free.filter(([i, j]) => !busy.has(ck(i, j))), ...free.filter(([i, j]) => busy.has(ck(i, j)))];
    };
    const tableSet = () => {
      const id = pick(st.k === 0 && cells.length >= 4 && rng() < 0.3 ? PIECES.bigTable : PIECES.table, rng),
        along = rng() < 0.5 ? 0 : 512;
      const seat = pick(room.role === 'taproom' && rng() < 0.4 ? PIECES.bench : PIECES.chair, rng),
        wobble = [Math.round((rng() - 0.5) * 60), Math.round((rng() - 0.5) * 60)];
      for (const [i, j] of floorCells()) {
        const x = cellX(i),
          z = cellZ(j);
        if (!stand(id, x, z, along, i, j)) continue;
        blocked.add(ck(i, j));
        const reach = FURNITURE[id][3] + 15;
        // seats on the table's two long sides (a chair facing it, a bench along it)
        [-1, 1].forEach((side, n) => {
          const [ox, oz] = turned(along, 0, side * reach),
            face = mod(along + (side < 0 ? 0 : 1024), 2048);
          if (FURNITURE[seat][5] === '-z') stand(seat, x + ox, z + oz, face + wobble[n], i, j);
          else stand(seat, x + ox, z + oz, along, i, j);
        });
        return true;
      }
      return false;
    };
    /** THE COUNTER: across its cell, facing the street (the keeper between it and the cell's back), its front reached - in
     *  the room's cell deepest from its door that takes one; else facing along the room (a shop a cell wide: the keeper by
     *  a side wall); a bar two, side by side. */
    const counter = (n) => {
      const cand = cells
        .filter(([i, j]) => !blocked.has(ck(i, j)))
        .sort(
          (a, b) =>
            b[1] - a[1] ||
            Math.abs(a[0]) - Math.abs(b[0]) ||
            Number(busy.has(ck(a[0], a[1]))) - Number(busy.has(ck(b[0], b[1]))),
        );
      // `f` the way it faces (its customers' side): the street's first, then either side, then the back
      const posed = (i, j, f) => ({
        x: cellX(i) + f[0] * 12,
        z: cellZ(j) + f[1] * 12,
        turn: f[0] ? 512 : 0,
        front: [cellX(i) + f[0] * (12 + 14 + BODY + 2), cellZ(j) + f[1] * (12 + 14 + BODY + 2)],
      });
      for (const f of [SIDE[0], SIDE[1], SIDE[3], SIDE[2]])
        for (const [i, j] of cand) {
          const c = posed(i, j, f);
          if (blocked.has(ck(i, j)) || !stand(PIECES.counter[0], c.x, c.z, c.turn, i, j, [c.front])) continue;
          blocked.add(ck(i, j));
          if (n > 1) {
            // its mate beside it, along its length
            const u = [Math.abs(f[1]), Math.abs(f[0])];
            for (const m of [
              [i + u[0], j + u[1]],
              [i - u[0], j - u[1]],
            ]) {
              if (!cells.some(([a, b]) => a === m[0] && b === m[1]) || blocked.has(ck(m[0], m[1]))) continue;
              const cm = posed(m[0], m[1], f);
              if (stand(PIECES.counter[0], cm.x, cm.z, cm.turn, m[0], m[1], [cm.front])) {
                blocked.add(ck(m[0], m[1]));
                break;
              }
            }
          }
          // the keeper's place behind it, kept clear (a shelf behind them stands no deeper than a shelf)
          const kx = cellX(i) - f[0] * KEEPER_AT,
            kz = cellZ(j) - f[1] * KEEPER_AT,
            a0 = [cellX(i) - f[0] * 4, cellZ(j) - f[1] * 4],
            a1 = [cellX(i) - f[0] * KEEPER_BACK, cellZ(j) - f[1] * KEEPER_BACK];
          occ.push(
            f[0]
              ? [Math.min(a0[0], a1[0]), kz - 16, Math.max(a0[0], a1[0]), kz + 16]
              : [kx - 16, Math.min(a0[1], a1[1]), kx + 16, Math.max(a0[1], a1[1])],
          );
          keeper ??= { k: st.k, x: kx, z: kz };
          return true;
        }
      return false;
    };
    /** A BED, and the floor beside it a body reaches - at its foot, else by either side - kept clear and kept reached: where
     *  a rented room's rest marker stands (MoveToBed). */
    const bed = () => {
      const b = atWall(
        pick(room.role === 'bedroom' && plan.pool === 'house1' ? PIECES.bedWealthy : PIECES.bed, rng),
        false,
      );
      if (!b) return false;
      const box = fabricPieceBox(b.id, b.turn, b.x, b.z),
        d = SIDE[b.s],
        u = SIDE[(b.s + 1) % 4],
        m = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
      const half = (d[0] ? box[2] - box[0] : box[3] - box[1]) / 2,
        wide = (d[0] ? box[3] - box[1] : box[2] - box[0]) / 2,
        reached = walk.reached();
      const by = (a, c) => [m[0] - d[0] * a + u[0] * c, m[1] - d[1] * a + u[1] * c];
      const rest = [
        by(half + BODY + 4, 0),
        by(half + BODY + 14, 0),
        ...[0, half - 20].flatMap((a) => [by(a, wide + BODY + 4), by(a, -wide - BODY - 4)]),
      ].find((p) => reached(p) && !placed.some((o) => overlaps([p[0] - 12, p[1] - 12, p[0] + 12, p[1] + 12], o, 0)));
      if (rest) {
        occ.push([rest[0] - 14, rest[1] - 14, rest[0] + 14, rest[1] + 14]);
        anchors[r].push(rest);
      }
      beds.push({ k: st.k, ...b, rest: rest ?? null });
      return true;
    };
    return { room, r, cells, walk, atWall, stand, floorCells, tableSet, counter, bed };
  });
  // a home's last storey and no bed in it yet: a bed first, in the first room with room for one (a bedroom's, a guest's
  // first) - before any room's other pieces take its floor (that room's own first bed the one stood)
  const slept = new Set();
  if (needBed && !beds.length) {
    const sleep = (R) =>
      ['bedroom', 'guestroom', 'cottage'].includes(R.room.role) ? 0 : R.room.role === 'living' ? 1 : 2;
    for (const R of [...rooms].sort((a, b) => sleep(a) - sleep(b) || a.r - b.r))
      if (R.bed()) {
        slept.add(R);
        break;
      }
  }
  for (const R of rooms) {
    for (const [part, count] of PARTS[R.room.role] ?? PARTS.store) {
      for (let n = 0; n < count; n++) {
        if (part === 'counter') R.counter(1);
        else if (part === 'bar') R.counter(2);
        else if (part === 'table') R.tableSet();
        else if (part === 'shelf') R.atWall(pick(shelves, rng), true);
        else if (part === 'bed') {
          if (!slept.delete(R)) R.bed();
        } else if (part === 'hearth') R.atWall(pick(PIECES.hearth, rng), true);
        else R.atWall(pick(PIECES[part], rng), part !== 'crate' && part !== 'chest' && part !== 'cabinet');
      }
    }
    // a shop is never without its stock: a shelf stood free on the floor where no wall would take one
    if (R.room.role === 'shop' && !objs.some((o) => shelves.includes(o.modelIdNum) && o.yPos === y0 + 2)) {
      const id = shelves.find((m) => FURNITURE[m][5] === null) ?? 41046;
      for (const [i, j] of R.floorCells())
        if (R.stand(id, cellX(i), cellZ(j), 0, i, j)) {
          blocked.add(ck(i, j));
          break;
        }
    }
  }
  // the floor left: each cell's middle and its quarters a body reaches and no piece stands on (the cast's places)
  for (const R of rooms) {
    const reached = R.walk.reached();
    for (const [i, j] of R.cells) {
      for (const [ox, oz] of [
        [0, 0],
        [-30, -30],
        [30, 30],
        [30, -30],
        [-30, 30],
      ]) {
        const x = cellX(i) + ox,
          z = cellZ(j) + oz,
          b = [x - 12, z - 12, x + 12, z + 12];
        if (reached([x, z]) && !occ.some((o) => overlaps(b, o, 0)))
          spots.push({ k: st.k, x, z, room: R.r, used: false, near: ox || oz ? 1 : 0 });
      }
    }
  }
  return { keeper, beds };
}

// ---------------------------------------------------------------- the cast

/** The editor markers carried from the donor (InteriorMarkerTypes Rest, Treasure; Place.cs's quest spawn 11 and item 18). */
const CARRIED_MARKERS = new Set([INTERIOR_MARKER.REST, INTERIOR_MARKER.TREASURE, 11, 18]);
/** The light flats' archive (TEXTURE.210 - DaggerfallInterior.AddLight), and how high a lamp hangs (Daggerfall's own: 80
 *  units over its floor - RESIAL00.RMB, GENRAL00.RMB). */
const LIGHTS = 210,
  LAMP_UP = 80;
/**
 * THE CAST STOOD AGAIN: the donor's people (the first the keeper, behind the counter where there is one), its quest, rest
 * and treasure markers (a rest marker by a bed - a tavern's rented room), its lights' pictures (a light a room, more in a
 * big one, at a lamp's height over the room's cells) - each on a free spot of the plan's floors.
 */
function castInto(plan, cast, { flats, people, spots, keeper, beds, rng }) {
  const takeSpot = (pref = null) => {
    const order = spots
      .filter((s) => !s.used)
      .sort((a, b) => (pref ? pref(a) - pref(b) : 0) || a.near - b.near || a.k - b.k);
    const s = order[0];
    if (!s) return null;
    // a spot taken takes the spots round it (a body's room)
    for (const o of spots) if (o.k === s.k && Math.hypot(o.x - s.x, o.z - s.z) < 40) o.used = true;
    return s;
  };
  const yOf = (k) => -k * KIT_STOREY;
  // the lights: the donor's pictures, else Daggerfall's commonest (210.13)
  const lightRecords = [
    ...new Set(
      (cast?.blockFlatObjectRecords ?? []).filter((f) => f.textureArchive === LIGHTS).map((f) => f.textureRecord),
    ),
  ].sort((a, b) => a - b);
  const lights = lightRecords.length ? lightRecords : [13];
  for (const st of plan.storeys) {
    const hole = holeOf(st);
    for (const room of st.rooms) {
      const lit = room.cells.filter(([i, j]) => !hole || i !== hole[0] || j !== hole[1]);
      const n = Math.max(1, Math.round(lit.length / 3));
      for (let m = 0; m < n && lit.length; m++) {
        const [i, j] = lit[Math.floor(((m + 0.5) * lit.length) / n)];
        flats.push(flat(LIGHTS, pick(lights, rng), cellX(i), yOf(st.k) - LAMP_UP, cellZ(j)));
      }
    }
  }
  // the rest markers first, each on the floor kept beside a bed (where MoveToBed stands the one who rented it), else the
  // free spot nearest it
  const carried = (cast?.blockFlatObjectRecords ?? []).filter(
    (f) => f.textureArchive === EDITOR_FLATS_ARCHIVE && CARRIED_MARKERS.has(f.textureRecord),
  );
  const bedsLeft = [...beds].sort((a, b) => (a.rest ? 0 : 1) - (b.rest ? 0 : 1)),
    rests = new Map(); // the beds with their floor kept first
  for (const f of carried) {
    if (f.textureRecord !== INTERIOR_MARKER.REST || !bedsLeft.length) continue;
    const b = /** @type {any} */ (bedsLeft.shift());
    const where = b.rest
      ? { k: b.k, x: b.rest[0], z: b.rest[1] }
      : takeSpot((s) => (s.k === b.k ? 0 : 1e6) + Math.hypot(s.x - b.x, s.z - b.z));
    if (where) rests.set(f, where);
  }
  // the people: the first behind the counter (or the front room's floor), the rest about the floors
  const list = cast?.blockPeopleRecords ?? [];
  list.forEach((p, n) => {
    const spot = n === 0 && keeper ? keeper : takeSpot(n === 0 ? (s) => s.k * 100 + s.room : null);
    const where = spot ?? { k: 0, x: cellX(0), z: cellZ(0) };
    // (who they are is where their own record stood them - `castPos`, characters/interiorPeople.js: their name, their
    // identity, the same as the questor pool reads off the cast - interiorLayout.js interiorCast)
    people.push({
      ...p,
      xPos: Math.round(where.x),
      yPos: yOf(where.k),
      zPos: Math.round(where.z),
      castPos: [p.xPos, p.yPos, p.zPos],
    });
  });
  // the markers, in their record's order: a rest marker where it was stood above, every other on a free spot (the quest's
  // spread over the floors)
  for (const f of carried) {
    const where = rests.get(f) ?? takeSpot((s) => -s.room * 10 - s.k) ?? { k: 0, x: cellX(0), z: cellZ(0) };
    flats.push({
      ...f,
      xPos: Math.round(where.x),
      yPos: yOf(where.k),
      zPos: Math.round(where.z),
      castPos: [f.xPos, f.yPos, f.zPos],
    });
  }
}

/** The kind a pool's building is laid out as (fabricInteriorKit.js POOL_KIND). */
export const fabricInteriorKind = (pool) => POOL_KIND[pool] ?? 'house';
