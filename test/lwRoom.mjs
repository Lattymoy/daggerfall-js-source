// LW-ROOMS (bible/06-Systems/Living-World.md "LW-ROOMS"): A SYNTHETIC TAVERN on the port's own collider
// (player/collider.js) - the room the living world's pins and probes stand residents in, with no game data: a hall of `w`
// by `d` metres, its floor at 0 and four walls, its way in the middle of the south wall (shut: a building's door is a face
// of its wall, as DFU's interiors draw it), a counter by the north wall, nine tables scaled to the hall and a stair up the
// north-west corner (a quarter metre a step); and where asked a partition across it, a doorway through it by the north
// wall (`partition`: the wall's x, 0.3 m thick; `doorway`: the doorway's z from and to - AUDIT LW-ROOMS: a narrow one
// off the lattice's lines, as the game's taverns have them). AUDIT LW-ROOMS, as the game's rooms have them too: an action
// door hung in the doorway (`door`: the port's own ActionSystem, shut as built - `actions` to swing it), a lip across the
// hall at `lip` (x; `lipH` high, 0.3 m across - what a body steps over) and a dais (`dais`: its x and z from and to,
// 0.3 m high - a floor a step up).
import { Collider } from '../src/player/collider.js';
import { ActionSystem } from '../src/world/actionSystem.js';

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A box's twelve triangles into `pos` and `idx`, its corners (x0, y0, z0) and (x1, y1, z1). */
export function boxInto(pos, idx, x0, y0, z0, x1, y1, z1) {
  const b = pos.length / 3;
  for (const [x, y, z] of [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]) pos.push(x, y, z);
  for (const [a, c, e] of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]) idx.push(b + a, b + c, b + e);
}

/** The tables' middles in a hall of 24 by 18 (scaled to the hall's own), each 1.4 by 1 m and 0.8 m high. */
export const HALL_TABLES = Object.freeze([[-8, -3], [-8, 3], [-3, -1], [-3, 5], [3, 0], [3, 5], [8, -4], [-6, -6.5], [6, -6.5]]);
export const TABLE_TOP = 0.8;

/**
 * The hall: its collider, the floor under a point (the host's own: a ray down, world.js livingIndoorsStep), and its way
 * in - `landing` as the host hands it (the door's middle, ~1 m up: interiorLanding's door centre), `door` on the floor.
 * @param {{ w?: number, d?: number, tables?: boolean, stair?: boolean, partition?: number | null, doorway?: number[], door?: boolean, lip?: number | null, lipH?: number, dais?: number[] | null }} [o]
 */
export function tavernHall({ w = 24, d = 18, tables = true, stair = true, partition = null, doorway = [d / 2 - 3, d / 2], door = false, lip = null, lipH = 0.45, dais = null } = {}) {
  const collider = new Collider(() => -100);
  const pos = [], idx = [];
  boxInto(pos, idx, -w / 2 - 1, -0.5, -d / 2 - 1, w / 2 + 1, 0, d / 2 + 1);   // the floor
  boxInto(pos, idx, -w / 2 - 0.3, 0, -d / 2 - 0.3, -w / 2, 4, d / 2 + 0.3);   // the walls
  boxInto(pos, idx, w / 2, 0, -d / 2 - 0.3, w / 2 + 0.3, 4, d / 2 + 0.3);
  boxInto(pos, idx, -w / 2, 0, d / 2, w / 2, 4, d / 2 + 0.3);
  boxInto(pos, idx, -w / 2, 0, -d / 2 - 0.3, w / 2, 4, -d / 2);
  if (tables) {
    boxInto(pos, idx, w / 2 - 7, 0, d / 2 - 2.2, w / 2 - 1, 1.1, d / 2 - 1.4);   // the counter
    for (const [fx, fz] of HALL_TABLES) { const x = (fx * w) / 24, z = (fz * d) / 18; boxInto(pos, idx, x - 0.7, 0, z - 0.5, x + 0.7, TABLE_TOP, z + 0.5); }
  }
  if (partition != null) {   // the wall either side of its doorway
    if (doorway[0] > -d / 2) boxInto(pos, idx, partition, 0, -d / 2, partition + 0.3, 4, doorway[0]);
    if (doorway[1] < d / 2) boxInto(pos, idx, partition, 0, doorway[1], partition + 0.3, 4, d / 2);
  }
  if (stair) for (let i = 0; i < 12; i++) boxInto(pos, idx, -w / 2, 0, d / 2 - 4, -w / 2 + 1.4, 0.25 * (i + 1), d / 2 - 4 + 0.3 * (i + 1));
  if (lip != null) boxInto(pos, idx, lip, 0, -d / 2, lip + 0.3, lipH, d / 2);
  if (dais) boxInto(pos, idx, dais[0], 0, dais[1], dais[2], 0.3, dais[3]);
  collider.addMesh('interior', new Float32Array(pos), new Uint32Array(idx), I4);
  const actions = new ActionSystem(collider);
  if (door && partition != null) {   // the doorway's door: its own bucket, solid while shut
    const dp = [], di = [];
    boxInto(dp, di, partition + 0.1, 0, doorway[0], partition + 0.2, 2.2, doorway[1]);
    actions.addDoor({ positions: new Float32Array(dp), indices: new Uint32Array(di) }, I4, {});
  }
  const floorAt = (x, y, z) => { const r = collider.raycast([x, y, z], [0, -1, 0], 3); return Number.isFinite(r) ? y - r : null; };
  const way = [0, 0, -d / 2 + 0.75];
  return { collider, floorAt, door: way, landing: [way[0], 1.05, way[2]], w, d, actions };
}
