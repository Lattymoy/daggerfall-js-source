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
import { SD_HALL_GLOW_RECORD } from './sdHallArt.js';   // AUDIT SD II (L2 F14): the lamps' heads wear the hands' brass glow
import { pillarVisual } from './sdPillarModel.js';   // SD-LOOK S7: the pillars dressed, inside their squares

/** The realm's own textures (`realmArt`), a pseudo-archive beside the court's. */
export const SD_REALM_ARCHIVE = 38151;
export const SD_REALM_FLOOR_RECORD = 0;   // the Hour's floor: dark stone set in brass, its gears engraved
export const SD_REALM_BRASS_RECORD = 1;   // brass: the rims, the walk's kerbs, the pillars
export const SD_REALM_ROOT_RECORD = 2;    // the islands' dark stone, hanging into the void
export const SD_REALM_DIAL_RECORD = 3;    // the Hour-dial: the Orrery's floor, twelve hours round its rim
export const SD_REALM_ARENA_RECORD = 4;   // the Last Moment's floor: SD-LOOK - dark bronze plates laid in rings
export const SD_REALM_COBBLE_RECORD = 31; // SD-LOOK: the Threshold - the Bay's own street the Hollow swallowed
export const SD_REALM_EDGE_RECORD = 32;   // SD-LOOK: the gold line along every edge a body could fall from
export const SD_REALM_PILLAR_RECORD = 56; // SD-LOOK S7: the arena's pillars' basalt, ashlar in courses (world/sdPillarModel.js)
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
/** The floors' tile, metres. SD-LOOK: two (64 texels - 32 a metre, the Hollow's own density; it was four, 16 a metre). */
export const SD_FLOOR_TILE_M = 2;
/** SD-LOOK: THE RIMS' TEETH - a brass tooth on every rim's outer face each SD_TOOTH_PITCH round it, standing SD_TOOTH_OUT
 *  out, SD_TOOTH_W across, from SD_TOOTH_FOOT up to SD_TOOTH_TOP: under the rim's top and outside the disc, so the motor
 *  never meets one (realmClamp and the colliders' discs are the rims'). The Hour reads as broken clockwork from afar. */
export const SD_TOOTH_PITCH = 1.2;
export const SD_TOOTH_OUT = 0.22;
export const SD_TOOTH_W = 0.42;
export const SD_TOOTH_FOOT = -0.42;
export const SD_TOOTH_TOP = SD_RIM_H - 0.05;
/** SD-LOOK: THE EDGE LINE - a strip SD_EDGE_LINE square along the top of every edge a body could fall from, in the edge
 *  record's gold: geometry, never a row of texels (there are no mips - a texel row aliases), the one always-lit line. */
export const SD_EDGE_LINE = 0.03;
/** SD-LOOK: THE INLAY - brass laid in the floor as geometry, SD_INLAY_H proud (crisp at every distance): the Threshold's
 *  compass rose (its long point at the Orrery, its tail at the way back, SD_COMPASS lengths) and the walk's tie-plates,
 *  one each SD_TIE_EVERY. */
export const SD_INLAY_H = 0.012;
export const SD_COMPASS = Object.freeze({ north: 2.4, cardinal: 1.5, diagonal: 0.95, ring: 0.85 });
export const SD_TIE_EVERY = 3;
/** SD-LOOK: the arena's disc laid in this many rings, its bronze plates along each. */
export const SD_ARENA_BANDS = 8;
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
/** AUDIT SD II (L2 F14): a lamp's post (half its width) and its head (half its side, about the light): a head inside the
 *  point shadows' near plane (render/shadowPass.js SHADOW_POINT_NEAR, 0.1 m), so it never shadows its own light. */
export const SD_LAMP_POST_W = 0.05;
export const SD_LAMP_HEAD = 0.09;
/** The realm's words: the way back's name on the plaque, and the refusals of what the Hour will not allow. */
export const SD_REALM_TEXT = Object.freeze({
  wayBack: 'To the Abyss Dungeon',   // AUDIT SD III (T15): the player's word for it
  noRest: 'You cannot rest in the Shattered Hour.',
  noSave: 'You cannot save in the Shattered Hour.',
  noMap: 'You cannot map the Shattered Hour.',
  noMark: 'You cannot set a Mark in the Shattered Hour.',
  noRecall: 'Nothing answers a Recall in the Shattered Hour.',
  lost: 'The way to the Shattered Hour is lost.',
  // AUDIT SD II (L6 F4): a death in the Hour is the Hour's own - said so through its veil (the gate's court: "You are cast
  // out of the Burning Court."), never the plain dungeon's waking
  died: 'The Shattered Hour casts you out for good. You wake before the Abyss Dungeon\'s door.',   // SD-ONELIFE: one life a Hollow
  // SD-ALONE (Mac: "We need to make sure companions dont enter the rift"): said as a player steps through with any at
  // their side - the court's own words for its gate (world/gateArena.js COURT_TEXT.noCompanions)
  noCompanions: 'Your companions cannot follow you through the Rift.',
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
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** SD-LOOK: a quad wound to face `want` (the dungeon's frame) whichever way its corners were listed - the realm's frame is
 *  mirrored into the dungeon's (realmToDungeon), and a face's side is its winding. */
function quadFacing(f, rec, a, b, c, d, ua, ub, uc, ud, want) {
  const u = sub3(b, a), v = sub3(c, a), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) f.quad(rec, a, b, c, d, ua, ub, uc, ud);
  else f.quad(rec, d, c, b, a, ud, uc, ub, ua);
}
const UP = [0, 1, 0];

/**
 * One island: its floor a disc of `rec` about (cx, cz) radius `r` (`uvOf` its texture's map, the tile by default), its
 * brass lip round the rim, and its root - a cone of dark stone from the rim down SD_ROOT_DEPTH into the void, its point a
 * little off centre so no two hang alike. Its floor at the realm's y 0, or `y` (SD7b: the Steps' checkpoints stand high).
 */
export function realmIsland(f, cx, cz, r, rec, { uvOf = tileUv, lean = 0, y: y0 = 0, bands = 0 } = {}) {
  const C = (x, y, z) => realmToDungeon(cx + x, y0 + y, cz + z);
  const tip = C(lean, -SD_ROOT_DEPTH - r * 0.6, lean * 0.5);
  const E = (rr, a, y) => C(Math.cos(a) * rr, y, Math.sin(a) * rr);
  for (let k = 0; k < SD_ISLAND_SIDES; k++) {
    const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    // the floor (wound up - its face toward +y), the rim's lip (its top, its outer side and - AUDIT SD II, L2 F6 - its
    // inner side, toward the floor: it was a lid with nothing under its inner edge), the root
    if (bands > 0) {
      // SD-LOOK: in rings, the plates' uv along each - u the arc at the ring's middle (a plate each SD_FLOOR_TILE_M), v
      // across it (one plate a ring): the floor lays as a clock's face, its seams radial and round
      for (let b = 0; b < bands; b++) {
        const r0 = (r * b) / bands, r1 = (r * (b + 1)) / bands, um = (r0 + r1) / 2 / SD_FLOOR_TILE_M, u0 = a0 * um, u1 = a1 * um;
        quadFacing(f, rec, E(r0, a0, 0), E(r0, a1, 0), E(r1, a1, 0), E(r1, a0, 0), [u0, 0], [u1, 0], [u1, 1], [u0, 1], UP);
      }
    } else f.tri(rec, C(0, 0, 0), C(x1, 0, z1), C(x0, 0, z0), uvOf(cx, cz), uvOf(cx + x1, cz + z1), uvOf(cx + x0, cz + z0));
    const ri = r - SD_RIM_W, xi0 = Math.cos(a0) * ri, zi0 = Math.sin(a0) * ri, xi1 = Math.cos(a1) * ri, zi1 = Math.sin(a1) * ri;
    f.quad(SD_REALM_BRASS_RECORD, C(xi0, SD_RIM_H, zi0), C(xi1, SD_RIM_H, zi1), C(x1, SD_RIM_H, z1), C(x0, SD_RIM_H, z0), [0, 0], [1, 0], [1, 0.2], [0, 0.2]);
    f.quad(SD_REALM_BRASS_RECORD, C(x0, 0, z0), C(x0, SD_RIM_H, z0), C(x1, SD_RIM_H, z1), C(x1, 0, z1), [0, 0], [0, 0.1], [1, 0.1], [1, 0]);
    f.quad(SD_REALM_BRASS_RECORD, C(xi1, 0, zi1), C(xi1, SD_RIM_H, zi1), C(xi0, SD_RIM_H, zi0), C(xi0, 0, zi0), [0, 0], [0, 0.1], [1, 0.1], [1, 0]);
    // SD-LOOK: the root's uv top (v 0, under the rim) to tip (v 1) - its strip is the cake cut through, lip to haze
    f.tri(SD_REALM_ROOT_RECORD, C(x0, 0, z0), C(x1, 0, z1), tip, [k / 8, 0], [(k + 1) / 8, 0], [(k + 0.5) / 8, 1]);
    // SD-LOOK: the edge line along the rim's outer top edge - its top and its outer face
    const re = r - SD_EDGE_LINE, ro = r + 0.004, ye = SD_RIM_H + 0.004, am = (a0 + a1) / 2;
    quadFacing(f, SD_REALM_EDGE_RECORD, E(re, a0, ye), E(re, a1, ye), E(ro, a1, ye), E(ro, a0, ye), [0, 0], [1, 0], [1, 1], [0, 1], UP);
    quadFacing(f, SD_REALM_EDGE_RECORD, E(ro, a0, ye - SD_EDGE_LINE), E(ro, a1, ye - SD_EDGE_LINE), E(ro, a1, ye), E(ro, a0, ye), [0, 0], [1, 0], [1, 1], [0, 1], sub3(E(r + 1, am, 0), E(r, am, 0)));
  }
  // SD-LOOK: the teeth, round the rim's outer face
  const n = Math.round((2 * Math.PI * r) / SD_TOOTH_PITCH);
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const at = (out, side, y) => C(ca * out - sa * side, y, sa * out + ca * side);
    for (const [q, want] of toothQuads(r - 0.02, r + SD_TOOTH_OUT, SD_TOOTH_W / 2, at)) quadFacing(f, SD_REALM_BRASS_RECORD, q[0], q[1], q[2], q[3], [0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], want);
  }
}
/** SD-LOOK: one tooth's five faces (its top, its face out, its two sides, its foot), each `[corners, the way it faces]` -
 *  `at(out, side, y)` the dungeon's point that far out from the island's centre, that far along the rim, that high. */
function toothQuads(i, o, hw, at) {
  const T = SD_TOOTH_TOP, F = SD_TOOTH_FOOT, mid = at((i + o) / 2, 0, (T + F) / 2);
  const face = (q) => [q, sub3([(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2], mid)];
  return [
    face([at(i, -hw, T), at(i, hw, T), at(o, hw, T), at(o, -hw, T)]),
    face([at(o, -hw, F), at(o, hw, F), at(o, hw, T), at(o, -hw, T)]),
    face([at(i, -hw, F), at(o, -hw, F), at(o, -hw, T), at(i, -hw, T)]),
    face([at(i, hw, F), at(o, hw, F), at(o, hw, T), at(i, hw, T)]),
    face([at(i, -hw, F), at(i, hw, F), at(o, hw, F), at(o, -hw, F)]),
  ];
}
/** SD-LOOK: THE HOUR-DIAL'S INLAY - what its art painted at 7 texels a metre (a stair-stepped orange ring) laid in brass
 *  as geometry SD_DIAL_INLAY.y proud, under the hall's lit segments and fray (world/sdHall.js, a hair higher): the twelve
 *  hours at the rim (the twelfth the widest, toward the arena, a gold thread down it), the ring within, and each of the
 *  six segments outlined (SD_LIT_RING's band, two hours wide about an odd hour - the hall lights them). Hour h stands at
 *  bearing h x 30 degrees from +z toward +x, as the art had it. */
export const SD_DIAL_INLAY = Object.freeze({ y: 0.006, hour0: 0.86, hour1: 0.97, twelfth: 0.035, hour: 0.02, ring: 0.82, ringW: 0.16, seg0: 0.5, seg1: 0.56, segHalfHours: 0.84, segW: 0.06 });
function dialInlay(f) {
  const D = SD_DIAL_INLAY, R = SD_ORRERY.r, y = +D.y;
  const at = (rr, a, yy = y) => realmToDungeon(SD_ORRERY.x + Math.sin(a) * rr, yy, SD_ORRERY.z + Math.cos(a) * rr);
  const arcStrip = (rec, r0, r1, a0, a1, n, yy = y) => {
    for (let k = 0; k < n; k++) {
      const b0 = a0 + ((a1 - a0) * k) / n, b1 = a0 + ((a1 - a0) * (k + 1)) / n;
      quadFacing(f, rec, at(r0, b0, yy), at(r0, b1, yy), at(r1, b1, yy), at(r1, b0, yy), [0, 0], [1, 0], [1, 0.1], [0, 0.1], UP);
    }
  };
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, half = (h === 0 ? D.twelfth : D.hour) * R, r0 = D.hour0 * R, r1 = D.hour1 * R;
    const side = [Math.cos(a), -Math.sin(a)];   // across the hour, in (x, z)
    const P = (rr, s, yy = y) => realmToDungeon(SD_ORRERY.x + Math.sin(a) * rr + side[0] * s, yy, SD_ORRERY.z + Math.cos(a) * rr + side[1] * s);
    quadFacing(f, SD_REALM_BRASS_RECORD, P(r0, -half), P(r1, -half), P(r1, half), P(r0, half), [0, 0], [1, 0], [1, 0.2], [0, 0.2], UP);
    if (h === 0) quadFacing(f, SD_REALM_EDGE_RECORD, P(r0 + 0.2, -0.03, y + 0.002), P(r1 - 0.2, -0.03, y + 0.002), P(r1 - 0.2, 0.03, y + 0.002), P(r0 + 0.2, 0.03, y + 0.002), [0, 0], [1, 0], [1, 1], [0, 1], UP);
  }
  arcStrip(SD_REALM_BRASS_RECORD, D.ring * R - D.ringW / 2, D.ring * R + D.ringW / 2, 0, Math.PI * 2, 96);
  for (let k = 0; k < 6; k++) {
    const mid = ((2 * k + 1) / 12) * Math.PI * 2, half = (D.segHalfHours / 12) * Math.PI * 2, a0 = mid - half, a1 = mid + half;
    const r0 = D.seg0 * R, r1 = D.seg1 * R, w = D.segW;
    arcStrip(SD_REALM_BRASS_RECORD, r0, r0 + w, a0, a1, 8);
    arcStrip(SD_REALM_BRASS_RECORD, r1 - w, r1, a0, a1, 8);
    for (const a of [a0, a1]) {
      const dw = w / r0;
      arcStrip(SD_REALM_BRASS_RECORD, r0, r1, a === a0 ? a : a - dw, a === a0 ? a + dw : a, 1);
    }
  }
}
/** SD-LOOK: THE COMPASS ROSE, inlaid at the arrival spot: eight brass points SD_INLAY_H proud - the long one at +z, the
 *  Orrery, its tail at -z, the way back - and a ring; a gold thread (the edge record, the ambient rung) down the long
 *  point's spine. The first thing a player sees tells them where to go. */
function compassRose(f, cx, cz) {
  const H = SD_INLAY_H, C = (x, z, y = H) => realmToDungeon(cx + x, y, cz + z);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, len = k === 0 ? SD_COMPASS.north : k % 2 === 0 ? SD_COMPASS.cardinal : SD_COMPASS.diagonal;
    const w = k % 2 === 0 ? 0.2 : 0.12, sa = Math.sin(a), ca = Math.cos(a);   // k 0 along +z
    const P = (along, side) => C(sa * along + ca * side, ca * along - sa * side);
    quadFacing(f, SD_REALM_BRASS_RECORD, P(0, -w), P(len, 0), P(0, w), P(-w * 0.6, 0), [0, 0], [0.5, 1], [1, 0], [0.5, 0], UP);
  }
  for (let k = 0; k < 32; k++) {
    const a0 = (k / 32) * Math.PI * 2, a1 = ((k + 1) / 32) * Math.PI * 2, r0 = SD_COMPASS.ring - 0.04, r1 = SD_COMPASS.ring + 0.04;
    const P = (rr, a) => C(Math.cos(a) * rr, Math.sin(a) * rr);
    quadFacing(f, SD_REALM_BRASS_RECORD, P(r0, a0), P(r0, a1), P(r1, a1), P(r1, a0), [0, 0], [1, 0], [1, 0.1], [0, 0.1], UP);
  }
  const t = 0.018, y = H + 0.002;
  quadFacing(f, SD_REALM_EDGE_RECORD, C(-t, 0.25, y), C(t, 0.25, y), C(t, SD_COMPASS.north - 0.35, y), C(-t, SD_COMPASS.north - 0.35, y), [0, 0], [1, 0], [1, 1], [0, 1], UP);
}
/** AUDIT SD II (L2 F4): where an island's floor - realmIsland's SD_ISLAND_SIDES-gon about (cx, cz), radius r - meets the
 *  line x, on its far side (`side` 1, z past its centre) or its near (-1); and the gon's corners on that side strictly
 *  between x0 and x1 (where that edge bends). The walk runs from one island's edge to the next and over neither: its
 *  floor and the Orrery's dial lay in one plane over the hall's mouth, and fought. */
function islandEdgeZ(cx, cz, r, x, side) {
  for (let k = 0; k < SD_ISLAND_SIDES; k++) {
    const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
    const ax = cx + Math.cos(a0) * r, az = Math.sin(a0) * r, bx = cx + Math.cos(a1) * r, bz = Math.sin(a1) * r;
    if (az * side < -1e-9 || bz * side < -1e-9 || ax === bx || (x - ax) * (x - bx) > 0) continue;
    return cz + az + ((x - ax) / (bx - ax)) * (bz - az);
  }
  return cz + side * Math.sqrt(Math.max(0, r * r - (x - cx) ** 2));
}
function islandEdgeXs(cx, r, side, x0, x1) {
  const out = [];
  for (let k = 0; k < SD_ISLAND_SIDES; k++) {
    const a = (k / SD_ISLAND_SIDES) * Math.PI * 2, x = cx + Math.cos(a) * r;
    if (Math.sin(a) * side > 1e-9 && x > x0 + 1e-9 && x < x1 - 1e-9) out.push(x);
  }
  return out;
}
/** The walk's two ends at x (the realm's frame): the Threshold's far edge and the Orrery's near edge. */
export const walkNearZ = (x) => islandEdgeZ(SD_THRESHOLD.x, SD_THRESHOLD.z, SD_THRESHOLD.r, x, 1);
export const walkFarZ = (x) => islandEdgeZ(SD_ORRERY.x, SD_ORRERY.z, SD_ORRERY.r, x, -1);
/** The x where either end bends between x0 and x1, with both - the walk's floor is laid in strips between them, so its
 *  ends follow the islands' own edges exactly. */
const walkXs = (x0, x1) => [x0, x1, ...islandEdgeXs(SD_THRESHOLD.x, SD_THRESHOLD.r, 1, x0, x1), ...islandEdgeXs(SD_ORRERY.x, SD_ORRERY.r, -1, x0, x1)]
  .sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-6);

/**
 * THE HOUR, WHOLE: renderer.createMesh's model shape in the DUNGEON's frame - the Threshold, the walk and its kerbs, the
 * Orrery's hall on its dial, the Last Moment's arena and its four pillars. Sub-meshes by record (sorted), 32-bit
 * indices (the renderer's one index type - WBX1).
 */
export function buildRealmModel() {
  const f = faces();
  realmIsland(f, SD_THRESHOLD.x, SD_THRESHOLD.z, SD_THRESHOLD.r, SD_REALM_COBBLE_RECORD, { lean: 1.5 });   // SD-LOOK: the Bay's street
  compassRose(f, SD_THRESHOLD.x, SD_ARRIVE_Z);
  // the walk: a slab of the floor's stone between brass kerbs, from the Threshold's rim to the Orrery's - AUDIT SD II
  // (L2 F4): laid from one island's edge to the other's and over neither (it ran z 7-25, over the dial's own floor at the
  // hall's mouth, in its plane); its sides down to its underside, which faces down (L2 F6: it faced up)
  {
    const { x, halfW: h } = SD_WALK, t = 0.8;
    const C = (xx, y, zz) => realmToDungeon(xx, y, zz);
    const xs = walkXs(x - h, x + h);
    for (let k = 0; k + 1 < xs.length; k++) {
      const xa = xs[k], xb = xs[k + 1], na = walkNearZ(xa), fa = walkFarZ(xa), nb = walkNearZ(xb), fb = walkFarZ(xb);
      f.quad(SD_REALM_FLOOR_RECORD, C(xa, 0, na), C(xa, 0, fa), C(xb, 0, fb), C(xb, 0, nb), tileUv(xa, na), tileUv(xa, fa), tileUv(xb, fb), tileUv(xb, nb));
    }
    const zn = walkNearZ(x + h), zf = walkFarZ(x + h);   // the islands are centred on the walk's line: its two sides alike
    const a = C(x - h, 0, zn), b = C(x - h, 0, zf), c = C(x + h, 0, zf), d = C(x + h, 0, zn);
    const down = (p) => [p[0], p[1] - t, p[2]];
    f.quad(SD_REALM_ROOT_RECORD, down(b), b, a, down(a), [0, 0], [0, 0.2], [4, 0.2], [4, 0]);
    f.quad(SD_REALM_ROOT_RECORD, down(d), d, c, down(c), [0, 0], [0, 0.2], [4, 0.2], [4, 0]);
    f.quad(SD_REALM_ROOT_RECORD, down(d), down(c), down(b), down(a), [0, 0], [0, 4], [1, 4], [1, 0]);
    // the kerbs, each a brass box along an edge from island to island: AUDIT SD II (L2 F6) its top wound up on both sides
    // (the left one faced down, and was culled), and its two sides and its two ends - it was a lid alone
    for (const sd of [-1, 1]) {
      const xo = x + sd * h, xi = x + sd * (h - SD_KERB_W), xa = Math.min(xi, xo), xb = Math.max(xi, xo);
      const P = (xx, y, near) => C(xx, y, near ? walkNearZ(xx) : walkFarZ(xx));
      const H = SD_KERB_H;
      f.quad(SD_REALM_BRASS_RECORD, P(xa, H, true), P(xa, H, false), P(xb, H, false), P(xb, H, true), [0, 0], [4, 0], [4, 0.1], [0, 0.1]);
      f.quad(SD_REALM_BRASS_RECORD, P(xa, 0, false), P(xa, H, false), P(xa, H, true), P(xa, 0, true), [0, 0], [0, 0.1], [4, 0.1], [4, 0]);   // toward -x
      f.quad(SD_REALM_BRASS_RECORD, P(xb, 0, true), P(xb, H, true), P(xb, H, false), P(xb, 0, false), [0, 0], [0, 0.1], [4, 0.1], [4, 0]);   // toward +x
      f.quad(SD_REALM_BRASS_RECORD, P(xa, 0, true), P(xa, H, true), P(xb, H, true), P(xb, 0, true), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0]);   // its end on the Threshold
      f.quad(SD_REALM_BRASS_RECORD, P(xb, 0, false), P(xb, H, false), P(xa, H, false), P(xa, 0, false), [0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0]);   // its end in the hall
      // SD-LOOK: the edge line along the kerb's outer top edge, island to island
      const xl = Math.min(xo - sd * SD_EDGE_LINE, xo + sd * 0.004), xr = Math.max(xo - sd * SD_EDGE_LINE, xo + sd * 0.004), Y = H + 0.004;
      quadFacing(f, SD_REALM_EDGE_RECORD, P(xl, Y, true), P(xl, Y, false), P(xr, Y, false), P(xr, Y, true), [0, 0], [0, 1], [1, 1], [1, 0], UP);
    }
    // SD-LOOK: the tie-plates - brass across the walk between its kerbs, one each SD_TIE_EVERY
    const z0 = walkNearZ(x), z1 = walkFarZ(x), hi = h - SD_KERB_W;
    for (let zz = z0 + SD_TIE_EVERY / 2; zz < z1 - 0.5; zz += SD_TIE_EVERY) {
      quadFacing(f, SD_REALM_BRASS_RECORD, C(x - hi, SD_INLAY_H, zz - 0.09), C(x + hi, SD_INLAY_H, zz - 0.09), C(x + hi, SD_INLAY_H, zz + 0.09), C(x - hi, SD_INLAY_H, zz + 0.09), [0, 0], [1, 0], [1, 0.1], [0, 0.1], UP);
    }
  }
  // the Orrery's hall: its floor the Hour-dial, one face over the whole disc (the dial's art is the disc's)
  const R = SD_ORRERY.r;
  realmIsland(f, SD_ORRERY.x, SD_ORRERY.z, R, SD_REALM_DIAL_RECORD, { lean: -3, uvOf: (x, z) => [0.5 + (x - SD_ORRERY.x) / (2 * R), 0.5 + (z - SD_ORRERY.z) / (2 * R)] });
  dialInlay(f);   // SD-LOOK: its hours, its ring and its six segments laid in brass, crisp at every distance
  // the Last Moment: the arena, and its four pillars on the diagonals
  realmIsland(f, SD_ARENA.x, SD_ARENA.z, SD_ARENA.r, SD_REALM_ARENA_RECORD, { lean: 4, bands: SD_ARENA_BANDS });   // SD-LOOK: a face, in rings
  for (let k = 0; k < 4; k++) pillarVisual(f, k, PILLAR_RECORDS);   // SD-LOOK S7: clock-towers of basalt and brass inside the law's squares (pillarQuads - the collider's)
  // AUDIT SD II (L2 F14): THE LAMPS the Hour's lights hang from - a brass post, its head alight round the light (the
  // hands' own brass glow), a brass cap; the lights were pools from nowhere 2.4 m over the rims
  for (const p of realmLampFeet()) {
    lampBoxQuads(p, SD_LAMP_POST_W, 0, SD_LAMP_H - SD_LAMP_HEAD).forEach((q, i) => f.quad(SD_REALM_BRASS_RECORD, q[0], q[1], q[2], q[3], ...(i < 4 ? LAMP_SIDE_UV : PILLAR_TOP_UV)));
    lampBoxQuads(p, SD_LAMP_HEAD, SD_LAMP_H - SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD, true).forEach((q) => f.quad(SD_HALL_GLOW_RECORD.brass, q[0], q[1], q[2], q[3], ...PILLAR_TOP_UV));
    lampBoxQuads(p, SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD, SD_LAMP_H + SD_LAMP_HEAD + 0.03).forEach((q) => f.quad(SD_REALM_BRASS_RECORD, q[0], q[1], q[2], q[3], ...PILLAR_TOP_UV));
  }
  return packRealmFaces(f);
}
const PILLAR_RECORDS = Object.freeze({ stone: SD_REALM_PILLAR_RECORD, brass: SD_REALM_BRASS_RECORD });
const PILLAR_TOP_UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
const LAMP_SIDE_UV = [[0, 0], [0, SD_LAMP_H / 3], [0.1, SD_LAMP_H / 3], [0.1, 0]];
/** AUDIT SD II (L2 F14): a lamp's box about its foot `p` (the realm's frame) - `w` either way across, from y0 to y1 - its
 *  four sides and its top as quads (the dungeon's frame, wound to face out), pillarQuads' own shape: one geometry for the
 *  post's draw and its collider. AUDIT SD IV (R4): `under` its underside too, facing down - the head hangs over the eye,
 *  and from under it the sky showed through a ring round every post. */
function lampBoxQuads(p, w, y0, y1, under = false) {
  const C = (dx, y, dz) => realmToDungeon(p[0] + dx, y, p[2] + dz);
  const corners = [[-w, -w], [w, -w], [w, w], [-w, w]];
  const out = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    out.push([C(ax, y0, az), C(ax, y1, az), C(bx, y1, bz), C(bx, y0, bz)]);
  }
  out.push([C(-w, y1, -w), C(-w, y1, w), C(w, y1, w), C(w, y1, -w)]);
  if (under) out.push([C(-w, y0, -w), C(w, y0, -w), C(w, y0, w), C(-w, y0, w)]);
  return out;
}
/** THE ARENA'S PILLAR `k` - on the diagonals, SD_PILLAR_R out, a square SD_PILLAR_W across and SD_PILLAR_H tall: its four
 *  sides and its top as quads (four corners each, the dungeon's frame, wound to face out) - (SD8c) its collider, and the
 *  square every face of its dress stands inside (SD-LOOK S7: world/sdPillarModel.js pillarVisual - it was its draw too). */
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
/** What the realm stands on the collider: its floors, its pillars and (AUDIT SD II, L2 F14) its lamps' posts, one bucket. */
export function realmColliderTris() {
  const floors = realmFloorTris(), pillars = realmPillarTris(), lamps = realmLampTris(), out = new Float32Array(floors.length + pillars.length + lamps.length);
  out.set(floors);
  out.set(pillars, floors.length);
  out.set(lamps, floors.length + pillars.length);
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

/** THE LAMPS' FEET, the realm's frame: the Threshold's four and the Orrery's and the arena's eight, a metre inside each
 *  rim - `[x, 0, z]` each, their lights SD_LAMP_H over them (AUDIT SD II, L2 F14: each a lamp the model stands there). */
export function realmLampFeet() {
  const out = [];
  const ring = ({ x: cx, z: cz, r }, n, from = 0) => {
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * Math.PI * 2;
      out.push([cx + Math.cos(a) * (r - 1), 0, cz + Math.sin(a) * (r - 1)]);
    }
  };
  ring(SD_THRESHOLD, SD_LAMPS.threshold, Math.PI / 4);
  ring(SD_ORRERY, SD_LAMPS.orrery, Math.PI / 8);
  ring(SD_ARENA, SD_LAMPS.arena, Math.PI / 8);
  return out;
}
/** THE SD_LAMPS: brass lamps on the rims - each `{ x, y, z, range, color }` in the dungeon's frame, the light list's own
 *  shape, at its lamp's head. */
export function realmLights() {
  return realmLampFeet().map((p) => {
    const [x, y, z] = realmToDungeon(p[0], SD_LAMP_H, p[2]);
    return { x, y, z, range: SD_LAMP_RANGE, color: [...SD_LAMP_COLOR] };
  });
}
/** AUDIT SD II (L2 F14): THE LAMPS' POSTS, FOR THE COLLIDER - each one's sides and top (lampBoxQuads, its draw's own): a
 *  body walks round a lamp, never through it. */
export function realmLampTris() {
  const out = [];
  for (const p of realmLampFeet()) for (const [a, b, c, d] of lampBoxQuads(p, SD_LAMP_POST_W, 0, SD_LAMP_H - SD_LAMP_HEAD)) out.push(...a, ...b, ...c, ...a, ...c, ...d);
  return new Float32Array(out);
}

/** THE HOUR'S LIGHT (a dungeon trilight, the court's shape - render/deadlands.js courtLighting): brass light from the void
 *  over it, a warm middle, the dark under the islands; and a key light from the great clock-face behind the arena (+z,
 *  high), pale gold. SD-LOOK: the void over it dimmer (it lifted every floor to the amber soup), and the FURNACE BELOW -
 *  the works' glow at the nadir, warm up-light on every facet that faces down, rimming the undersides in gold against
 *  the black; the key paler and a little stronger, so lit stone reads as stone. */
export const SD_REALM_TRILIGHT = Object.freeze({
  sky: Object.freeze([0.2, 0.17, 0.13]),
  equator: Object.freeze([0.16, 0.12, 0.08]),
  ground: Object.freeze([0.34, 0.2, 0.08]),
});
export const SD_REALM_KEY_LIGHT = Object.freeze({
  scale: 0.65,
  dir: Object.freeze((() => { const d = [0, 0.62, 1], l = Math.hypot(d[0], d[1], d[2]); return d.map((v) => v / l); })()),
  color: Object.freeze([0.95, 0.9, 0.78]),
});
/** The realm's light for the frame: `{ tri, key }` - AUDIT SD II (L2 F9): the frame's ONE object, its arrays set again
 *  each call (they were fresh each frame; the renderer copies what it keeps - setAmbientTrilight, setMoonlight - and the
 *  arm's equator goes through its own scratch). */
const _realmLight = {
  tri: { sky: [0, 0, 0], equator: [0, 0, 0], ground: [0, 0, 0] },
  key: { scale: 0, dir: [0, 0, 0], color: [0, 0, 0] },
};
export const realmLighting = () => {
  const { tri, key } = _realmLight;
  for (let k = 0; k < 3; k++) {
    tri.sky[k] = SD_REALM_TRILIGHT.sky[k]; tri.equator[k] = SD_REALM_TRILIGHT.equator[k]; tri.ground[k] = SD_REALM_TRILIGHT.ground[k];
    key.dir[k] = SD_REALM_KEY_LIGHT.dir[k]; key.color[k] = SD_REALM_KEY_LIGHT.color[k];
  }
  key.scale = SD_REALM_KEY_LIGHT.scale;
  return _realmLight;
};
let _lampsNear = null;
/** The lamps nearest `eye` first (the renderer's cap drops the far ones) - one list, sorted in place each frame (AUDIT SD
 *  II, L2 F9: by an insertion sort of its own - a comparator closed over the eye was made every frame). */
export function realmLightsNear(eye) {
  const L = (_lampsNear ??= realmLights());
  if (!eye) return L;
  const ex = eye[0], ez = eye[2];
  for (let i = 1; i < L.length; i++) {
    const l = L[i], dl = (l.x - ex) ** 2 + (l.z - ez) ** 2;
    let j = i - 1;
    while (j >= 0 && (L[j].x - ex) ** 2 + (L[j].z - ez) ** 2 > dl) { L[j + 1] = L[j]; j--; }
    L[j + 1] = l;
  }
  return L;
}
/** AUDIT SD II (L2 F9): the frame's lights in the Hour - the arm's own (`lit`, withPlayerLights' `{ data, colors }` with
 *  its carried mask), then `extra` (the spoils' light), then the lamps nearest `eye` - in arrays made once and grown
 *  when a frame wants more, each length's views kept: world/gateArena.js withCourtLights' composition, which the court
 *  keeps (it made three arrays and an array a lamp, every frame). Pinned equal to it. */
const _hourLit = { cap: 0, data: new Float32Array(0), colors: new Float32Array(0), carried: new Uint8Array(0), views: new Map() };
/** AUDIT SD III (V9): the lights a frame lights at the least (render/renderer.js's classic cap): past it, the Hour's own
 *  (the spoils', the landings' flashes, the Ending's stone) and its lamps are sorted in together by how far the eye
 *  stands outside each one's reach - every flash went first, and a busy moment put out the lamps nearest the player. */
export const SD_LIGHTS_CAP = 16;
const _litKey = new Float64Array(64), _litIdx = new Int32Array(64);
/** SD-LOOK S7: whether a lamp (the light list's shape, the dungeon's frame) is one of the arena's - inside its disc. */
const ARENA_X = SD_REALM_ORIGIN[0] + SD_ARENA.x, ARENA_Z = SD_REALM_ORIGIN[2] + SD_ARENA.z;
export const arenaLamp = (l) => (l.x - ARENA_X) * (l.x - ARENA_X) + (l.z - ARENA_Z) * (l.z - ARENA_Z) < SD_ARENA.r * SD_ARENA.r;
/** SD-LOOK S7: realmLightsWith's `dim` - the arena's lamps' share of their light (scenes/sdArenaWatch.js sdLampDimAt - the Reset's
 *  dimming): its lamps alone, never the arm's own lights, the Hour's (`extra`) or the other stages' lamps. */
export function realmLightsWith(lit, extra, eye, dim = 1) {
  const n = lit.data.length / 4, lamps = realmLightsNear(eye), m = n + extra.length + lamps.length, H = _hourLit;
  if (m > H.cap) {
    H.cap = Math.max(m, H.cap * 2, 32);
    H.data = new Float32Array(H.cap * 4); H.colors = new Float32Array(H.cap * 3); H.carried = new Uint8Array(H.cap);
    H.views.clear();
  }
  for (let j = 0; j < n * 4; j++) H.data[j] = lit.data[j];
  for (let j = 0; j < n * 3; j++) H.colors[j] = lit.colors[j];
  const lc = lit.data.carried;
  for (let j = 0; j < m; j++) H.carried[j] = j < n && lc ? lc[j] : 0;
  const k = m - n, sorted = !!eye && m > SD_LIGHTS_CAP && k <= _litIdx.length;
  if (sorted) {
    for (let i = 0; i < k; i++) {
      const l = i < extra.length ? extra[i] : lamps[i - extra.length], dx = l.x - eye[0], dy = l.y - eye[1], dz = l.z - eye[2];
      const key = Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - l.range);
      let j = i - 1;
      while (j >= 0 && _litKey[j] > key) { _litKey[j + 1] = _litKey[j]; _litIdx[j + 1] = _litIdx[j]; j--; }
      _litKey[j + 1] = key; _litIdx[j + 1] = i;
    }
  }
  for (let i = n; i < m; i++) {
    const q = sorted ? _litIdx[i - n] : i - n;
    const l = q < extra.length ? extra[q] : lamps[q - extra.length];
    H.data[i * 4] = l.x; H.data[i * 4 + 1] = l.y; H.data[i * 4 + 2] = l.z; H.data[i * 4 + 3] = l.range;
    const k = dim < 1 && q >= extra.length && arenaLamp(l) ? dim : 1;   // SD-LOOK S7: the Reset's dimming, the arena's lamps alone
    H.colors[i * 3] = l.color[0] * k; H.colors[i * 3 + 1] = l.color[1] * k; H.colors[i * 3 + 2] = l.color[2] * k;
  }
  let v = H.views.get(m);
  if (!v) {
    /** @type {Float32Array & { carried?: Uint8Array }} */
    const data = H.data.subarray(0, m * 4), carried = H.carried.subarray(0, m);
    data.carried = carried;
    v = { data, colors: H.colors.subarray(0, m * 3), carried };
    H.views.set(m, v);
  }
  return v;
}

/** THE MOTOR'S ARENA in the Hour (player/motor.js `arena`): its clamp the realm's edge over `floors` - one object, kept by
 *  the host and handed every frame the player stands in the realm. */
export const realmArena = (floors = SD_REALM_FLOORS) => ({ centre: [...SD_REALM_ORIGIN], radius: SD_ARENA.z + SD_ARENA.r, clamp: (pos, inset = 0) => realmClamp(pos, inset, floors) });
/** AUDIT SD III (F2): THE ARENA HOLDS WHAT IT HAS TAKEN. Its own floor alone - the disc, no Steps' band - and whether it
 *  holds a body: joined to a fight that lives (net/sdFightLink.js joined) and standing inside the rim, the realm's frame.
 *  The band let go of the arena's near edge as of the Steps' far one, and a step off it over the void was a fall cast
 *  back to the Crumble's checkpoint - out of the arena, out of every blow of the whole arena, for the void's 15%: a
 *  Mantella Pulse of 70% dodged by walking off the edge before it landed. Held, a fighter leaves the fight by its end,
 *  by death, or by the way home - never by the rim. */
export const SD_ARENA_FLOORS = Object.freeze([Object.freeze({ kind: 'disc', ...SD_ARENA })]);
export const arenaHolds = (joined, x, z) => !!joined && Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x - SD_ARENA.x, z - SD_ARENA.z) <= SD_ARENA.r;
