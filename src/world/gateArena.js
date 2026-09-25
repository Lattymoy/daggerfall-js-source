// @ts-check
// WB3b (2026-09-25, Mac: "a gate of oblivion which takes place in a large boss arena"): THE BURNING COURT - the place
// the gate opens onto. Design: bible/11-Multiplayer/World-Bosses.md section 4.
//
// NOT A FIFTH HOST. The four-hosts law (11-Multiplayer/Multiplayer.md "Constraints") exists because every host has
// been missed at least once, and an arena that needs combat, spells, the HUD, the inventory, other players, a death and
// a way out is a host's whole job. So the court is a DUNGEON - the dungeon host with a level made here:
//
//   - A MADE LOCATION (`gateArenaLocation`): the shape the dungeon host reads of a real one - one starting block, a
//     name, a region, a climate - and `gate: day`, which the room key, the exits, the rest and the saves read.
//   - AN EMPTY BLOCK (`gateArenaBlocks`): layoutDungeon asks a blocks file for a block by name and throws on one it
//     does not know; the court hands it a blocks file that answers ONE extra name with a made block holding nothing
//     but its start marker (the editor flat 199.10) - no model, no door, no foe marker, no water. Every system that
//     walks the level walks an empty one.
//   - THE COURT ITSELF (`buildCourtModel`): the floor, the rune ring the boss never crosses, the spires and braziers
//     round the edge, the broken bridge the players came by and the way home - the port's own geometry and art
//     (pseudo-archive COURT_ARCHIVE), added to the context the way the runtime pools add theirs, its floor to the
//     collider (`courtFloorTris`), its braziers to the light list (`courtLights`, `withCourtLights`), the way home to
//     the exit doors (`courtExitDoor`). WB6a: the sea of fire under it and the sky over it are not its mesh - the
//     Deadlands' own passes draw both, first in the frame (render/deadlands.js).
//
// THE FRAME. Metres, the dungeon's own: the one block at the grid's origin (RDB_SIDE 51.2 across), the court's centre at
// its middle (net/gateBrain.js COURT_CENTRE - the relay reads poses in the same place), the floor's top at y 0, the
// players arriving at +z (the bridge) and facing -z, at the boss.
//
// Not a DFU member. Ledger A (WB).
import { COURT_CENTRE, COURT_R, BOSS_REACH_R } from '../net/gateBrain.js';
import { faces, spike, GATE_ARCHIVE, GATE_STONE_RECORD } from './gateModel.js';
import { gateYaw } from '../net/gateLaw.js';

/** The court's own textures (world/gateArt.js courtArt) - the gate's pseudo-archive's neighbour. */
export const COURT_ARCHIVE = 38111;
export const COURT_FLOOR_RECORD = 0;
export const COURT_RUNE_RECORD = 1;
export const COURT_LAVA_RECORD = 2;
export const COURT_MEMBRANE_RECORD = 3;

/** The made block's name - no classic block is called this (they are eight characters and `.RDB`). */
export const GATE_ARENA_BLOCK = 'GATECOURT.RDB';
/** The index the made blocks file answers for it: far past any classic block (BLOCKS.BSA holds under 1,300). */
export const GATE_ARENA_BLOCK_INDEX = 900000;
/** The made location's record id - no classic location has one this high (the map ids are 32-bit, the record ids are not). */
export const GATE_ARENA_LOCATION_ID = 0x7ffff000;
/** The block's side, metres (world/rdbLayout.js RDB_SIDE - pinned equal): the court's centre is its middle. */
export const GATE_BLOCK_SIDE = 51.2;
/** Classic units a metre (1 / MeshReader.GlobalScale). */
const UNITS_PER_M = 40;

/** Where the players arrive, in the court's frame: on the floor by the bridge, facing the boss. */
export const ARRIVE_Z = COURT_R - 4;
/** The way home: the small membrane at the floor's edge by the bridge - its centre, half-width and height. */
export const EXIT_Z = COURT_R - 0.6;
export const EXIT_HALF_W = 2.2;
export const EXIT_H = 4.6;
/** The floor: a disc of this many sides, its skirt this deep under the rim. */
export const FLOOR_SIDES = 48;
export const FLOOR_SKIRT = 3;
/** The flagstones' tile, metres. */
export const FLOOR_TILE_M = 6;
/** The rune ring the boss keeps inside: its band either side of BOSS_REACH_R. */
export const RUNE_HALF_W = 0.45;
/** The spires round the edge (standing off the floor, beyond the ring the motor keeps a player in) and the braziers
 *  between them; the bridge's gap is left clear of both. */
export const SPIRES = 10;
export const BRAZIERS = 6;
export const RIM_OUT = COURT_R + 2.2;
/** The sea of fire: this far under the floor (render/deadlands.js draws it, a disc going on to the horizon). */
export const LAVA_Y = -36;
/** The rock the court stands on: a spire narrowing from the floor's rim down into the fire. */
export const ROOT_SIDES = 12;
export const ROOT_FOOT_R = 5;
/** The Deadlands' air: the fog the court stands in (the dungeon's own black replaced) - the haze the sky's horizon
 *  meets (render/deadlands.js HORIZON_GLSL). */
export const COURT_FOG = Object.freeze({ mode: 'exp', density: 0.009, color: Object.freeze([0.32, 0.05, 0.02]) });
/** The court's words: the way home's name on the plaque, and the refusals of the things the Deadlands will not allow. */
export const COURT_TEXT = Object.freeze({
  wayHome: 'The way back to Tamriel',
  noRest: 'You cannot rest in the Deadlands.',
  noSave: 'You cannot save in the Deadlands.',
  noMap: 'The Deadlands are not yours to map.',
  noMark: 'The Deadlands will not hold your mark.',
  castOut: 'You are cast out of the Burning Court.',
  collapse: 'The Burning Court comes apart around you.',
  lost: 'The Burning Court slips away from you - the way through is lost.',   // AUDIT WB B5: the relay's link gone for good
});
/** A brazier's fire: its colour and reach. */
export const BRAZIER_COLOR = Object.freeze([1.0, 0.45, 0.16]);
export const BRAZIER_RANGE = 14;

/** A point in the court's frame, in the dungeon's. */
export const courtToDungeon = (x, y, z) => [COURT_CENTRE[0] + x, COURT_CENTRE[1] + y, COURT_CENTRE[2] + z];

/**
 * THE MADE LOCATION - what the dungeon host reads of a real one, and no more: a name, a region, a climate, the map
 * table's row (map id 0 - no world room keys off it; the arena's room is the gate's own, `gate:<day>`), the dungeon's
 * record and its one block. `gate` is the day, and `gateAt` where the gate stands outside (the way home).
 * @param {{day: number, near?: string, regionIndex?: number, regionName?: string, climate?: {worldClimate: number, climateType: number}, landing?: object|null}} g
 */
export function gateArenaLocation({ day, near = '', regionIndex = -1, regionName = '', climate = { worldClimate: 231, climateType: 2 }, landing = null }) {
  return {
    name: 'The Burning Court', regionIndex, regionName, locationIndex: -1, hasDungeon: true,
    climate: { worldClimate: climate.worldClimate, climateType: climate.climateType },
    mapTableData: { mapId: 0, locationType: -1, dungeonType: 0, longitude: 0, latitude: 0 },
    exterior: { exteriorData: { locationId: GATE_ARENA_LOCATION_ID } },
    dungeon: {
      recordElement: { header: { locationId: GATE_ARENA_LOCATION_ID, unknown: 0 } },
      blocks: [{ x: 0, z: 0, blockName: GATE_ARENA_BLOCK, isStartingBlock: true, blockIndex: 0, blockNumber: 0, blockNumberStartIndexBitfield: 0 }],
    },
    gate: day, gateNear: near, gateAt: landing,
  };
}

/** Is this location the court (a made one, keyed by its day)? */
export const isGateArena = (loc) => Number.isSafeInteger(loc?.gate) && loc?.dungeon?.recordElement?.header?.locationId === GATE_ARENA_LOCATION_ID;

/**
 * THE EMPTY BLOCK: an RDB block as BlocksFile.getBlock hands one over, holding its start marker and nothing else. The
 * marker's flat resource names no water (soundIndex 0) and no castle (magnitude 0) - world/rdbLayout.js reads both off
 * the first start marker - and it stands where the players arrive.
 */
export function gateArenaBlock() {
  const [x, , z] = courtToDungeon(0, 0, ARRIVE_Z);
  const marker = {
    type: 0x03, position: 1, index: 0,
    xPos: Math.round(x * UNITS_PER_M), yPos: 0, zPos: Math.round(z * UNITS_PER_M),
    resources: { flatResource: { textureArchive: 199, textureRecord: 10, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action: 0, position: 0 } },
  };
  return { name: GATE_ARENA_BLOCK, position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [marker] }] } };
}

/**
 * THE BLOCKS FILE THE COURT IS LAID FROM: the real one, answering one name more. Every other name and index goes to
 * the real file untouched (a court never asks for another, but the file is the dungeon host's for the life of the
 * context).
 * @param {{getBlockIndex(name: string): number, getBlock(i: number): any}|null} real
 */
export function gateArenaBlocks(real) {
  const block = gateArenaBlock();
  return {
    getBlockIndex: (name) => (name === GATE_ARENA_BLOCK ? GATE_ARENA_BLOCK_INDEX : real ? real.getBlockIndex(name) : -1),
    getBlock: (i) => (i === GATE_ARENA_BLOCK_INDEX ? block : real ? real.getBlock(i) : null),
  };
}

/**
 * THE COURT, WHOLE: renderer.createMesh's model shape in the DUNGEON's frame - the floor (flagstones over its skirt of
 * the gate's basalt), the rune ring, the spires and braziers round the edge, the broken bridge and the way home's arch
 * and membrane. Sub-meshes by (archive, record): the court's own four and the gate's stone.
 */
export function buildCourtModel() {
  const f = faces();
  const byArchive = new Map();   // record key -> archive
  const C = (x, y, z) => courtToDungeon(x, y, z);
  const STONE = GATE_STONE_RECORD + 1000;   // the gate's basalt, told apart from the court's own records below
  byArchive.set(STONE, [GATE_ARCHIVE, GATE_STONE_RECORD]);
  for (const rec of [COURT_FLOOR_RECORD, COURT_RUNE_RECORD, COURT_LAVA_RECORD, COURT_MEMBRANE_RECORD]) byArchive.set(rec, [COURT_ARCHIVE, rec]);
  const uvFloor = (p) => [(p[0] - COURT_CENTRE[0]) / FLOOR_TILE_M, (p[2] - COURT_CENTRE[2]) / FLOOR_TILE_M];
  // the floor: a fan of flagstones (wound to face up), and its skirt down into the dark
  for (let k = 0; k < FLOOR_SIDES; k++) {
    const a0 = (k / FLOOR_SIDES) * Math.PI * 2, a1 = ((k + 1) / FLOOR_SIDES) * Math.PI * 2;
    const c = C(0, 0, 0), p0 = C(Math.cos(a0) * COURT_R, 0, Math.sin(a0) * COURT_R), p1 = C(Math.cos(a1) * COURT_R, 0, Math.sin(a1) * COURT_R);
    f.tri(COURT_FLOOR_RECORD, c, p1, p0, uvFloor(c), uvFloor(p1), uvFloor(p0));
    const b0 = [p0[0], -FLOOR_SKIRT, p0[2]], b1 = [p1[0], -FLOOR_SKIRT, p1[2]];
    f.quad(STONE, b0, p0, p1, b1, [0, 0], [0, 1], [1, 1], [1, 0]);
  }
  // the rock under it: the floor's rim tapering down into the fire (its sides the gate's basalt)
  for (let k = 0; k < ROOT_SIDES; k++) {
    const a0 = (k / ROOT_SIDES) * Math.PI * 2, a1 = ((k + 1) / ROOT_SIDES) * Math.PI * 2;
    const t0 = C(Math.cos(a0) * COURT_R, -FLOOR_SKIRT, Math.sin(a0) * COURT_R), t1 = C(Math.cos(a1) * COURT_R, -FLOOR_SKIRT, Math.sin(a1) * COURT_R);
    const b0 = C(Math.cos(a0 + 0.2) * ROOT_FOOT_R, LAVA_Y - 2, Math.sin(a0 + 0.2) * ROOT_FOOT_R), b1 = C(Math.cos(a1 + 0.2) * ROOT_FOOT_R, LAVA_Y - 2, Math.sin(a1 + 0.2) * ROOT_FOOT_R);
    f.quad(STONE, b0, t0, t1, b1, [0, 0], [0, 8], [2, 8], [2, 0]);
    f.tri(STONE, t0, C(0, -FLOOR_SKIRT, 0), t1, [0, 0], [1, 1], [2, 0]);   // its underside's lid, so the rim never shows sky through it
  }
  // the rune ring, a hair over the floor, its u round the circle
  const RING_SIDES = 96, rr0 = BOSS_REACH_R - RUNE_HALF_W, rr1 = BOSS_REACH_R + RUNE_HALF_W, y = 0.02;
  for (let k = 0; k < RING_SIDES; k++) {
    const a0 = (k / RING_SIDES) * Math.PI * 2, a1 = ((k + 1) / RING_SIDES) * Math.PI * 2;
    const u0 = (k / RING_SIDES) * 24, u1 = ((k + 1) / RING_SIDES) * 24;
    const i0 = C(Math.cos(a0) * rr0, y, Math.sin(a0) * rr0), i1 = C(Math.cos(a1) * rr0, y, Math.sin(a1) * rr0);
    const o0 = C(Math.cos(a0) * rr1, y, Math.sin(a0) * rr1), o1 = C(Math.cos(a1) * rr1, y, Math.sin(a1) * rr1);
    f.quad(COURT_RUNE_RECORD, i0, i1, o1, o0, [u0, 0], [u1, 0], [u1, 1], [u0, 1]);
  }
  // WB6a: the sea of fire and the sky are not the court's mesh - render/deadlands.js draws both, first in the pass
  // the spires round the edge, rising out of the fire and leaning out; the braziers between them; the bridge's gap
  // (the +z side the players came by) left clear
  const clearOfBridge = (a) => Math.abs(Math.atan2(Math.cos(a), Math.sin(a))) > 0.35;   // +z is a = PI/2
  for (let k = 0; k < SPIRES; k++) {
    const a = ((k + 0.5) / SPIRES) * Math.PI * 2;
    if (!clearOfBridge(a)) continue;
    const r = RIM_OUT + 1.5 + (k % 3) * 0.8;
    const base = C(Math.cos(a) * r, -14, Math.sin(a) * r);
    const tip = C(Math.cos(a) * (r + 3.5), 11 + (k % 4) * 2.5, Math.sin(a) * (r + 3.5));
    spike(f, base, 1.6, tip);
  }
  for (const [, p] of courtBraziers()) {
    const [bx, , bz] = p;
    const top = C(bx, 1.1, bz), foot = C(bx, -10, bz);
    const R = 0.55, sides = 6;
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const t0 = [top[0] + Math.cos(a0) * R, top[1], top[2] + Math.sin(a0) * R], t1 = [top[0] + Math.cos(a1) * R, top[1], top[2] + Math.sin(a1) * R];
      const f0 = [foot[0] + Math.cos(a0) * R, foot[1], foot[2] + Math.sin(a0) * R], f1 = [foot[0] + Math.cos(a1) * R, foot[1], foot[2] + Math.sin(a1) * R];
      f.quad(STONE, f0, t0, t1, f1, [0, 0], [0, 3], [0.3, 3], [0.3, 0]);
      f.tri(COURT_LAVA_RECORD, top, t1, t0, [0.5, 0.5], [0.5 + Math.cos(a1) * 0.1, 0.5 + Math.sin(a1) * 0.1], [0.5 + Math.cos(a0) * 0.1, 0.5 + Math.sin(a0) * 0.1]);   // the fire bed
    }
  }
  // the broken bridge: a slab from the floor's edge out over the fire, its far end snapped off
  {
    const w = 3, z0 = COURT_R - 0.5, z1 = COURT_R + 9, t = 1.2;
    const q = (x, yy, z) => C(x, yy, z);
    const uv = (p) => [(p[0] - COURT_CENTRE[0]) / FLOOR_TILE_M, (p[2] - COURT_CENTRE[2]) / FLOOR_TILE_M];
    const tl = q(-w, 0, z0), tr = q(w, 0, z0), fr = q(w, 0, z1 - 1.5), fl = q(-w, 0, z1);
    f.quad(COURT_FLOOR_RECORD, tl, fl, fr, tr, uv(tl), uv(fl), uv(fr), uv(tr));
    const d = (p) => [p[0], p[1] - t, p[2]];
    f.quad(STONE, d(tl), tl, tr, d(tr), [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    f.quad(STONE, d(tr), tr, fr, d(fr), [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    f.quad(STONE, d(fr), fr, fl, d(fl), [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    f.quad(STONE, d(fl), fl, tl, d(tl), [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
  }
  // the way home: two posts and a lintel of the gate's stone, and the membrane between them, facing the court
  {
    const z = EXIT_Z, hw = EXIT_HALF_W, h = EXIT_H;
    for (const s of [-1, 1]) spike(f, C(s * (hw + 0.4), 0, z), 0.5, C(s * (hw + 0.1), h + 1.4, z));
    spike(f, C(-hw - 0.4, h + 0.2, z), 0.35, C(hw + 0.4, h + 0.6, z));
    const a = C(-hw, 0.05, z), b = C(hw, 0.05, z), c = C(hw, h, z), d = C(-hw, h, z);
    f.quad(COURT_MEMBRANE_RECORD, a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1]);   // seen from the court (-z)
    f.quad(COURT_MEMBRANE_RECORD, b, a, d, c, [0, 0], [1, 0], [1, 1], [0, 1]);   // and from the bridge
  }
  const recs = [...f.byRec.keys()].sort((x, yy) => x - yy);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec);
    const n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    const [textureArchive, textureRecord] = byArchive.get(rec);
    subMeshes.push({ textureArchive, textureRecord, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/** The braziers: `[index, [x, y, z] in the court's frame]`, spaced round the edge between the spires, clear of the bridge. */
export function courtBraziers() {
  const out = [];
  for (let k = 0; k < BRAZIERS; k++) {
    const a = (k / BRAZIERS) * Math.PI * 2 - Math.PI / 2;   // the first due -z, behind the boss
    if (Math.abs(Math.atan2(Math.cos(a), Math.sin(a))) <= 0.35) continue;
    out.push([k, [Math.cos(a) * (COURT_R + 1.2), 0, Math.sin(a) * (COURT_R + 1.2)]]);
  }
  return out;
}

/** The braziers' lights, in the dungeon's frame: `{ x, y, z, range, color }` over each fire bed, their colour their own. */
export const courtLights = () => courtBraziers().map(([, p]) => { const [x, y, z] = courtToDungeon(p[0], 2.2, p[2]); return { x, y, z, range: BRAZIER_RANGE, color: BRAZIER_COLOR }; });

/**
 * The braziers joined to the frame's lights. The paired shape the dungeon host hands the renderer in (`{ data, colors }`,
 * scenes/magicCandle.js withPlayerLights - the carried mask on `data`), the same shape out, the braziers AFTER all it
 * held: the player's own lights keep their slots and their mask (the torch is still the hand's, and casts no shadow),
 * and the renderer's cap drops a brazier before any of them. Not a player-light composer - nothing here is carried.
 * @param {{ data: Float32Array & { carried?: Uint8Array }, colors: Float32Array }} lit
 * @param {Array<{ x: number, y: number, z: number, range: number, color: readonly number[] }>} lights
 */
export function withCourtLights(lit, lights) {
  const n = lit.data.length / 4, k = lights.length;
  /** @type {Float32Array & { carried?: Uint8Array }} */
  const data = new Float32Array((n + k) * 4);
  const colors = new Float32Array((n + k) * 3), carried = new Uint8Array(n + k);
  data.set(lit.data);
  colors.set(lit.colors.subarray(0, n * 3));
  if (lit.data.carried) carried.set(lit.data.carried.subarray(0, n));
  lights.forEach((l, i) => { data.set([l.x, l.y, l.z, l.range], (n + i) * 4); colors.set(l.color, (n + i) * 3); });
  data.carried = carried;
  return { data, colors, carried };
}

/** The collider's floor: the disc's top and the bridge's deck, as unindexed triangles in the dungeon's frame (the
 *  motor keeps a player inside COURT_R; the deck is there so a step onto its lip never falls through). */
export function courtFloorTris() {
  const out = [];
  const C = (x, z) => courtToDungeon(x, 0, z);
  for (let k = 0; k < FLOOR_SIDES; k++) {
    const a0 = (k / FLOOR_SIDES) * Math.PI * 2, a1 = ((k + 1) / FLOOR_SIDES) * Math.PI * 2;
    out.push(...C(0, 0), ...C(Math.cos(a1) * COURT_R, Math.sin(a1) * COURT_R), ...C(Math.cos(a0) * COURT_R, Math.sin(a0) * COURT_R));
  }
  return new Float32Array(out);
}

/**
 * THE WAY HOME IS THE COURT'S EXIT DOOR: a door record in the dungeon's own exit doors' shape (scenes/dungeonContext.js
 * `exitDoors`; player/enterExit.js reads a matrix, the centre and size in its frame and the side a player stands), so
 * the exit family's ray, name, ladder and wagon word take it as the level's door - no family of its own. A body tall
 * and the membrane wide, at the membrane, its face into the court.
 */
export function courtExitDoor() {
  const [x, y, z] = courtToDungeon(0, 0, EXIT_Z);
  return {
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
    centre: { x: 0, y: EXIT_H / 2, z: 0 },
    size: { x: 1, y: EXIT_H, z: EXIT_HALF_W * 2 },
    normal: { x: 0, y: 0, z: -1 },
  };
}

/** The ring the motor keeps a player inside (player/motor.js `arena`): the court's centre and the floor's radius. */
export const courtRing = () => ({ centre: [...COURT_CENTRE], radius: COURT_R });

/** How far before the gate the way home lands, metres (clear of its plinth - world/gateModel.js PLINTH_R 8.2). */
export const GATE_LANDING_M = 10;
/**
 * WHERE THE WAY HOME LANDS: before the gate outside, on the side its fire faces (the gate's own +z - trs's R_y turns it
 * to (sin yaw, cos yaw)), turned away from it - `{ pos, normal }`, a door landing's own shape (player/enterExit.js
 * dungeonEntranceLanding), in the scene's frame NOW: the gate's pixel's translation plus its spot (systems/gateOmen.js
 * gateSceneXZ's own sum), so a recentre since the player went in moves it with the world. Null off the built ground.
 * @param {{day: number, px: number, py: number, spot: number[]}} g the gate walked into (scenes/gatePool.js enter)
 * @param {{pixelTranslation: (px: number, py: number) => number[], heightAt: (x: number, z: number) => number}} at
 */
export function gateLandingFor(g, { pixelTranslation, heightAt }, out = GATE_LANDING_M) {
  if (!g || !Array.isArray(g.spot) || !Number.isSafeInteger(g.day)) return null;
  const t = pixelTranslation(g.px, g.py);
  const yaw = gateYaw(g.day), dx = Math.sin(yaw), dz = Math.cos(yaw);
  const x = t[0] + g.spot[0] + dx * out, z = t[2] + g.spot[1] + dz * out;
  const y = heightAt(x, z);
  return Number.isFinite(y) ? { pos: [x, y, z], normal: [dx, 0, dz] } : null;
}
