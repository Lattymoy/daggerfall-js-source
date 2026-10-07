// @ts-check
// SD5a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR - the
// place the Warp left: the moment of the Numidium's walk, kept outside time, where the Bay's broken endings still turn
// against each other and the last of the Brass God still walks. Entered by a Hollow's Rift (SD4b).
//
// NOT A FIFTH HOST - the Burning Court's law (world/gateArena.js): the realm is a DUNGEON, the dungeon host with a level
// made here:
//   - A MADE LOCATION (`sdRealmLocation`): one starting block, a name, a region, a climate - and `sdRealm`, the Hollow's
//     slot, which the room key (`sd:<s>`, the relay's realm), the rest, the saves and the way back read; `sdHollow`, the
//     Hollow it was entered from (its key, its pixel, its name: where the way back leads).
//   - AN EMPTY BLOCK (`sdRealmBlocks`): a blocks file answering ONE extra name with a made block holding nothing but its
//     start marker, on the Threshold - no model, no door, no foe marker, no water.
//   - THE HOUR ITSELF (`buildRealmModel`): its floors - the Threshold, the walk, the Orrery's hall and its dial, the Last
//     Moment's arena and its four pillars - each an island hanging in the void on a root of dark stone; the port's own
//     geometry and art (pseudo-archive SD_REALM_ARCHIVE, `realmArt`), its floors to the collider (`realmFloorTris`; SD8c:
//     its pillars too, `realmPillarTris` - `realmColliderTris` the two), its lamps to the light list (`realmLights`), its
//     edges to the motor (`realmClamp`). Its sky is no mesh: render/sdSky.js paints it.
//
// THE FRAME is net/sdBrain.js's (SD_REALM_ORIGIN and the stages): metres, the dungeon's own, every floor's top at y 0,
// laid along +z. The players arrive on the Threshold facing +z - the Orrery ahead, the Rift home at their backs.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_REALM_ORIGIN, SD_THRESHOLD, SD_WALK, SD_ORRERY, SD_ARENA, SD_PILLAR_R, SD_PILLAR_W, SD_PILLAR_H, realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';

/** The realm's own textures (`realmArt`), a pseudo-archive beside the court's. */
export const SD_REALM_ARCHIVE = 38151;
export const SD_REALM_FLOOR_RECORD = 0;   // the Hour's floor: dark stone set in brass, its gears engraved
export const SD_REALM_BRASS_RECORD = 1;   // brass: the rims, the walk's kerbs, the pillars
export const SD_REALM_ROOT_RECORD = 2;    // the islands' dark stone, hanging into the void
export const SD_REALM_DIAL_RECORD = 3;    // the Hour-dial: the Orrery's floor, twelve hours round its rim
export const SD_REALM_ARENA_RECORD = 4;   // the Last Moment's floor: cracked brass, the Mantella's light in its seams
/** The made block's name and index, and the made location's id (the court's are 'GATECOURT.RDB', 900000, 0x7ffff000). */
export const SD_REALM_BLOCK = 'SDHOUR.RDB';
export const SD_REALM_BLOCK_INDEX = 900200;
export const SD_REALM_LOCATION_ID = 0x7ffff200;
/** Classic units a metre (1 / MeshReader.GlobalScale). */
const UNITS_PER_M = 40;
/** Where the players arrive, in the realm's frame: on the Threshold a step ahead of its centre, facing +z. */
export const SD_ARRIVE_Z = 1;
/** The way back: the Rift at the Threshold's back, its foot this far behind the centre, this tall (the way home's ring
 *  is the Hollow's own art - scenes/sdEnd.js). */
export const SD_WAY_BACK_Z = -5;
export const SD_WAY_BACK_SIZE = 5;
/** The islands: their discs' sides, how far their roots hang into the void, the rims' brass lip. */
export const SD_ISLAND_SIDES = 48;
export const SD_ROOT_DEPTH = 22;
export const SD_RIM_W = 0.35;
export const SD_RIM_H = 0.12;
/** The floors' tile, metres. */
export const SD_FLOOR_TILE_M = 4;
/** The walk's brass kerbs: their width and height. */
export const SD_KERB_W = 0.25;
export const SD_KERB_H = 0.15;
/** The void's air: a thin brass haze the sky's horizon meets (render/sdSky.js). */
export const SD_REALM_FOG = Object.freeze({ mode: 'exp', density: 0.0045, color: Object.freeze([0.2, 0.15, 0.07]) });
/** The lamps on the rims: their colour, their reach, and how many stand round each stage. */
export const SD_LAMP_COLOR = Object.freeze([1.0, 0.78, 0.4]);
export const SD_LAMP_RANGE = 12;
export const SD_LAMP_H = 2.4;
export const SD_LAMPS = Object.freeze({ threshold: 4, orrery: 8, arena: 8 });
/** The realm's words: the way back's name on the plaque, and the refusals of what the Hour will not allow. */
export const SD_REALM_TEXT = Object.freeze({
  wayBack: 'To the Hollow',
  noRest: 'You cannot rest in the Shattered Hour.',
  noSave: 'You cannot save in the Shattered Hour.',
  noMap: 'You cannot map the Shattered Hour.',
  noMark: 'You cannot set a Mark in the Shattered Hour.',
  noRecall: 'Nothing answers a Recall in the Shattered Hour.',
  lost: 'The way to the Shattered Hour is lost.',
  // AUDIT SD II (L6 F4): a death in the Hour is the Hour's own - said so through its veil (the gate's court: "You are cast
  // out of the Burning Court."), never the plain dungeon's waking
  died: 'The Shattered Hour casts you out. You wake before the Hollow\'s door.',
});
/** The floors a player is kept on until the Concord lays the bridge (SD6): the Threshold, the walk and the Orrery's
 *  hall. Discs { x, z, r } and the walk's band { x, z0, z1, halfW }, the realm's frame. */
export const SD_REALM_FLOORS = Object.freeze([
  Object.freeze({ kind: 'disc', ...SD_THRESHOLD }),
  Object.freeze({ kind: 'band', ...SD_WALK }),
  Object.freeze({ kind: 'disc', ...SD_ORRERY }),
]);

/**
 * THE MADE LOCATION - what the dungeon host reads of a real one, and no more: a name, a region, a climate, the map
 * table's row (map id 0 - no world room keys off it; the realm's room is the relay's own `sd:<s>`), the dungeon's record
 * and its one block. `sdRealm` is the Hollow's slot, `sdHollow` the Hollow it was entered from.
 * @param {{ s: number, hollow?: { key: string, px: number, py: number, name: string } | null, regionIndex?: number, regionName?: string, climate?: { worldClimate: number, climateType: number } }} o
 */
export function sdRealmLocation({ s, hollow = null, regionIndex = -1, regionName = '', climate = { worldClimate: 231, climateType: 2 } }) {
  return {
    name: 'The Shattered Hour', regionIndex, regionName, locationIndex: -1, hasDungeon: true,
    climate: { worldClimate: climate.worldClimate, climateType: climate.climateType },
    mapTableData: { mapId: 0, locationType: -1, dungeonType: 0, longitude: 0, latitude: 0 },
    exterior: { exteriorData: { locationId: SD_REALM_LOCATION_ID } },
    dungeon: {
      recordElement: { header: { locationId: SD_REALM_LOCATION_ID, unknown: 0 } },
      blocks: [{ x: 0, z: 0, blockName: SD_REALM_BLOCK, isStartingBlock: true, blockIndex: 0, blockNumber: 0, blockNumberStartIndexBitfield: 0 }],
    },
    sdRealm: s, sdHollow: hollow ? { key: hollow.key, px: hollow.px, py: hollow.py, name: hollow.name } : null,
  };
}

/** Is this location the Shattered Hour (a made one, keyed by its slot)? */
export const isSdRealm = (loc) => Number.isSafeInteger(loc?.sdRealm) && loc?.dungeon?.recordElement?.header?.locationId === SD_REALM_LOCATION_ID;

/** THE EMPTY BLOCK: an RDB block as BlocksFile.getBlock hands one over, holding its start marker on the Threshold and
 *  nothing else (its flat names no water - soundIndex 0 - and no castle - magnitude 0; world/rdbLayout.js reads both). */
export function sdRealmBlock() {
  const [x, , z] = realmToDungeon(0, 0, SD_ARRIVE_Z);
  const marker = {
    type: 0x03, position: 1, index: 0,
    xPos: Math.round(x * UNITS_PER_M), yPos: 0, zPos: Math.round(z * UNITS_PER_M),
    resources: { flatResource: { textureArchive: 199, textureRecord: 10, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action: 0, position: 0 } },
  };
  return { name: SD_REALM_BLOCK, position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [marker] }] } };
}

/** THE BLOCKS FILE THE REALM IS LAID FROM: the real one, answering one name more. */
export function sdRealmBlocks(real) {
  const block = sdRealmBlock();
  return {
    getBlockIndex: (name) => (name === SD_REALM_BLOCK ? SD_REALM_BLOCK_INDEX : real ? real.getBlockIndex(name) : -1),
    getBlock: (i) => (i === SD_REALM_BLOCK_INDEX ? block : real ? real.getBlock(i) : null),
  };
}

/** The tile's uv for a point of the realm's floor (its own frame), SD_FLOOR_TILE_M a repeat. */
const tileUv = (x, z) => [x / SD_FLOOR_TILE_M, z / SD_FLOOR_TILE_M];

/**
 * One island: its floor a disc of `rec` about (cx, cz) radius `r` (`uvOf` its texture's map, the tile by default), its
 * brass lip round the rim, and its root - a cone of dark stone from the rim down SD_ROOT_DEPTH into the void, its point a
 * little off centre so no two hang alike. Its floor at the realm's y 0, or `y` (SD7b: the Steps' checkpoints stand high).
 */
export function realmIsland(f, cx, cz, r, rec, { uvOf = tileUv, lean = 0, y: y0 = 0 } = {}) {
  const C = (x, y, z) => realmToDungeon(cx + x, y0 + y, cz + z);
  const tip = C(lean, -SD_ROOT_DEPTH - r * 0.6, lean * 0.5);
  for (let k = 0; k < SD_ISLAND_SIDES; k++) {
    const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    // the floor (wound up - its face toward +y), the rim's lip, the root
    f.tri(rec, C(0, 0, 0), C(x1, 0, z1), C(x0, 0, z0), uvOf(cx, cz), uvOf(cx + x1, cz + z1), uvOf(cx + x0, cz + z0));
    const ri = r - SD_RIM_W, xi0 = Math.cos(a0) * ri, zi0 = Math.sin(a0) * ri, xi1 = Math.cos(a1) * ri, zi1 = Math.sin(a1) * ri;
    f.quad(SD_REALM_BRASS_RECORD, C(xi0, SD_RIM_H, zi0), C(xi1, SD_RIM_H, zi1), C(x1, SD_RIM_H, z1), C(x0, SD_RIM_H, z0), [0, 0], [1, 0], [1, 0.2], [0, 0.2]);
    f.quad(SD_REALM_BRASS_RECORD, C(x0, 0, z0), C(x0, SD_RIM_H, z0), C(x1, SD_RIM_H, z1), C(x1, 0, z1), [0, 0], [0, 0.1], [1, 0.1], [1, 0]);
    f.tri(SD_REALM_ROOT_RECORD, C(x0, 0, z0), C(x1, 0, z1), tip, [k / 8, 0], [(k + 1) / 8, 0], [(k + 0.5) / 8, SD_ROOT_DEPTH / 6]);
  }
}

/**
 * THE HOUR, WHOLE: renderer.createMesh's model shape in the DUNGEON's frame - the Threshold, the walk and its kerbs, the
 * Orrery's hall on its dial, the Last Moment's arena and its four pillars. Sub-meshes by record (sorted), 32-bit
 * indices (the renderer's one index type - WBX1).
 */
export function buildRealmModel() {
  const f = faces();
  realmIsland(f, SD_THRESHOLD.x, SD_THRESHOLD.z, SD_THRESHOLD.r, SD_REALM_FLOOR_RECORD, { lean: 1.5 });
  // the walk: a slab of the floor's stone between brass kerbs, from the Threshold's rim into the Orrery's
  {
    const { x, z0, z1, halfW: h } = SD_WALK, t = 0.8;
    const C = (xx, y, zz) => realmToDungeon(xx, y, zz);
    const a = C(x - h, 0, z0), b = C(x - h, 0, z1), c = C(x + h, 0, z1), d = C(x + h, 0, z0);
    f.quad(SD_REALM_FLOOR_RECORD, a, b, c, d, tileUv(x - h, z0), tileUv(x - h, z1), tileUv(x + h, z1), tileUv(x + h, z0));
    const down = (p) => [p[0], p[1] - t, p[2]];
    f.quad(SD_REALM_ROOT_RECORD, down(b), b, a, down(a), [0, 0], [0, 0.2], [4, 0.2], [4, 0]);
    f.quad(SD_REALM_ROOT_RECORD, down(d), d, c, down(c), [0, 0], [0, 0.2], [4, 0.2], [4, 0]);
    f.quad(SD_REALM_ROOT_RECORD, down(a), down(b), down(c), down(d), [0, 0], [0, 4], [1, 4], [1, 0]);
    for (const sd of [-1, 1]) {
      const xo = x + sd * h, xi = x + sd * (h - SD_KERB_W);
      f.quad(SD_REALM_BRASS_RECORD, C(xi, SD_KERB_H, z0), C(xi, SD_KERB_H, z1), C(xo, SD_KERB_H, z1), C(xo, SD_KERB_H, z0), [0, 0], [4, 0], [4, 0.1], [0, 0.1]);
    }
  }
  // the Orrery's hall: its floor the Hour-dial, one face over the whole disc (the dial's art is the disc's)
  const R = SD_ORRERY.r;
  realmIsland(f, SD_ORRERY.x, SD_ORRERY.z, R, SD_REALM_DIAL_RECORD, { lean: -3, uvOf: (x, z) => [0.5 + (x - SD_ORRERY.x) / (2 * R), 0.5 + (z - SD_ORRERY.z) / (2 * R)] });
  // the Last Moment: the arena, and its four pillars on the diagonals
  realmIsland(f, SD_ARENA.x, SD_ARENA.z, SD_ARENA.r, SD_REALM_ARENA_RECORD, { lean: 4 });
  for (let k = 0; k < 4; k++) pillarQuads(k).forEach((q, i) => f.quad(SD_REALM_BRASS_RECORD, q[0], q[1], q[2], q[3], ...(i < 4 ? PILLAR_SIDE_UV : PILLAR_TOP_UV)));
  return packRealmFaces(f);
}
const PILLAR_SIDE_UV = [[0, 0], [0, SD_PILLAR_H / 3], [1, SD_PILLAR_H / 3], [1, 0]];
const PILLAR_TOP_UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
/** THE ARENA'S PILLAR `k` - on the diagonals, SD_PILLAR_R out, a square SD_PILLAR_W across and SD_PILLAR_H tall: its four
 *  sides and its top as quads (four corners each, the dungeon's frame, wound to face out) - one geometry for its draw and
 *  (SD8c) its collider. */
function pillarQuads(k) {
  const a = Math.PI / 4 + (k * Math.PI) / 2;
  const px = SD_ARENA.x + Math.cos(a) * SD_PILLAR_R, pz = SD_ARENA.z + Math.sin(a) * SD_PILLAR_R, w = SD_PILLAR_W / 2;
  const C = (dx, y, dz) => realmToDungeon(px + dx, y, pz + dz);
  const corners = [[-w, -w], [w, -w], [w, w], [-w, w]];
  const out = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    out.push([C(ax, 0, az), C(ax, SD_PILLAR_H, az), C(bx, SD_PILLAR_H, bz), C(bx, 0, bz)]);
  }
  out.push([C(-w, SD_PILLAR_H, -w), C(-w, SD_PILLAR_H, w), C(w, SD_PILLAR_H, w), C(w, SD_PILLAR_H, -w)]);
  return out;
}

/** A faces() build packed into renderer.createMesh's model shape - the realm's records, sorted (SD6c: the hall's too). */
export function packRealmFaces(f) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec);
    const n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: SD_REALM_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/** THE FLOORS, FOR THE COLLIDER: the Threshold, the walk, the Orrery's hall and the arena, as triangles in the dungeon's
 *  frame (both faces are one to the collider). */
export function realmFloorTris() {
  const out = [];
  const disc = ({ x: cx, z: cz, r }) => {
    for (let k = 0; k < SD_ISLAND_SIDES; k++) {
      const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
      out.push(...realmToDungeon(cx, 0, cz), ...realmToDungeon(cx + Math.cos(a1) * r, 0, cz + Math.sin(a1) * r), ...realmToDungeon(cx + Math.cos(a0) * r, 0, cz + Math.sin(a0) * r));
    }
  };
  disc(SD_THRESHOLD);
  disc(SD_ORRERY);
  disc(SD_ARENA);
  const { x, z0, z1, halfW: h } = SD_WALK;
  const a = realmToDungeon(x - h, 0, z0), b = realmToDungeon(x - h, 0, z1), c = realmToDungeon(x + h, 0, z1), d = realmToDungeon(x + h, 0, z0);
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
  return new Float32Array(out);
}

/** SD8c (Super-Dungeons.md section 10): THE ARENA'S PILLARS, FOR THE COLLIDER - each one's sides and top, so a body stands
 *  behind one out of the Hour-Hand's sweep (net/sdRemnant.js behindPillar - the same squares) and never walks through it. */
export function realmPillarTris() {
  const out = [];
  for (let k = 0; k < 4; k++) for (const [a, b, c, d] of pillarQuads(k)) out.push(...a, ...b, ...c, ...a, ...c, ...d);
  return new Float32Array(out);
}
/** What the realm stands on the collider: its floors and its pillars, one bucket. */
export function realmColliderTris() {
  const floors = realmFloorTris(), pillars = realmPillarTris(), out = new Float32Array(floors.length + pillars.length);
  out.set(floors);
  out.set(pillars, floors.length);
  return out;
}

/**
 * THE EDGE (the motor's clamp - player/motor.js `arena.clamp`): where on the realm's floors `pos` ([x, y, z], the
 * dungeon's frame) is put back to, its body's `inset` kept off the edge - null where it stands on one already. The floors
 * are `floors` (SD_REALM_FLOORS until the bridge is laid); a body off them all is put back to the nearest.
 */
export function realmClamp(pos, inset = 0, floors = SD_REALM_FLOORS) {
  const x = pos[0] - SD_REALM_ORIGIN[0], z = pos[2] - SD_REALM_ORIGIN[2];
  let best = null, bestD = Infinity;
  for (const fl of floors) {
    let to;
    if (fl.kind === 'disc') {
      const dx = x - fl.x, dz = z - fl.z, d = Math.hypot(dx, dz), rr = Math.max(0, fl.r - inset);
      if (d <= rr) return null;
      to = d > 1e-9 ? [fl.x + (dx / d) * rr, fl.z + (dz / d) * rr] : [fl.x + rr, fl.z];
    } else {
      const hw = Math.max(0, fl.halfW - inset);
      const cx = Math.max(fl.x - hw, Math.min(fl.x + hw, x)), cz = Math.max(fl.z0, Math.min(fl.z1, z));
      if (cx === x && cz === z) return null;
      to = [cx, cz];
    }
    const d = Math.hypot(to[0] - x, to[1] - z);
    if (d < bestD) { bestD = d; best = to; }
  }
  return best ? [best[0] + SD_REALM_ORIGIN[0], best[1] + SD_REALM_ORIGIN[2]] : null;
}

/** THE SD_LAMPS: brass lamps on the rims, the Threshold's four and the Orrery's and the arena's eight - each `{ x, y, z,
 *  range, color }` in the dungeon's frame, the light list's own shape. */
export function realmLights() {
  const out = [];
  const ring = ({ x: cx, z: cz, r }, n, from = 0) => {
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * Math.PI * 2;
      const [x, y, z] = realmToDungeon(cx + Math.cos(a) * (r - 1), SD_LAMP_H, cz + Math.sin(a) * (r - 1));
      out.push({ x, y, z, range: SD_LAMP_RANGE, color: [...SD_LAMP_COLOR] });
    }
  };
  ring(SD_THRESHOLD, SD_LAMPS.threshold, Math.PI / 4);
  ring(SD_ORRERY, SD_LAMPS.orrery, Math.PI / 8);
  ring(SD_ARENA, SD_LAMPS.arena, Math.PI / 8);
  return out;
}

/** THE HOUR'S LIGHT (a dungeon trilight, the court's shape - render/deadlands.js courtLighting): brass light from the void
 *  over it, a warm middle, the dark under the islands; and a key light from the great clock-face behind the arena (+z,
 *  high), pale gold. */
export const SD_REALM_TRILIGHT = Object.freeze({
  sky: Object.freeze([0.46, 0.38, 0.22]),
  equator: Object.freeze([0.3, 0.25, 0.15]),
  ground: Object.freeze([0.12, 0.1, 0.07]),
});
export const SD_REALM_KEY_LIGHT = Object.freeze({
  scale: 0.5,
  dir: Object.freeze((() => { const d = [0, 0.62, 1], l = Math.hypot(d[0], d[1], d[2]); return d.map((v) => v / l); })()),
  color: Object.freeze([1.0, 0.88, 0.62]),
});
/** The realm's light for the frame: `{ tri, key }`, fresh arrays (the host may hand them on). */
export const realmLighting = () => ({
  tri: { sky: [...SD_REALM_TRILIGHT.sky], equator: [...SD_REALM_TRILIGHT.equator], ground: [...SD_REALM_TRILIGHT.ground] },
  key: { scale: SD_REALM_KEY_LIGHT.scale, dir: [...SD_REALM_KEY_LIGHT.dir], color: [...SD_REALM_KEY_LIGHT.color] },
});
let _lampsNear = null;
/** The lamps nearest `eye` first (the renderer's cap drops the far ones) - one list, sorted in place each frame. */
export function realmLightsNear(eye) {
  const L = (_lampsNear ??= realmLights());
  if (eye) L.sort((a, b) => ((a.x - eye[0]) ** 2 + (a.z - eye[2]) ** 2) - ((b.x - eye[0]) ** 2 + (b.z - eye[2]) ** 2));
  return L;
}

/** THE MOTOR'S ARENA in the Hour (player/motor.js `arena`): its clamp the realm's edge over `floors` - one object, kept by
 *  the host and handed every frame the player stands in the realm. */
export const realmArena = (floors = SD_REALM_FLOORS) => ({ centre: [...SD_REALM_ORIGIN], radius: SD_ARENA.z + SD_ARENA.r, clamp: (pos, inset = 0) => realmClamp(pos, inset, floors) });
