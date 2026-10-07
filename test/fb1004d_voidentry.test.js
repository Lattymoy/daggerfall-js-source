// VOID-ENTRY (FIELD BUGS 2026-10-04d, two Discord reports of 2026-10-04): "Entering a house sent me to the void: I
// entered a house (in Warvale Village) and when I loaded inside I immediately fell through the floor", and online
// "Complete darkness and possibly stuck: This happened after I lockpicked a door of a random house and went in. Now
// I'm stuck in there, can't leave, can't interact with anything, can't see anything. And of course, a torch doesn't
// have any effect" (the HUD, the chat, the compass and the vitals drawn, the 3D view black).
//
// One cause. Beautiful Villages and Beautiful Cities keep a copy of the building's own EXTERIOR model - sometimes
// another building's - inside the room, and an exterior door faces OUT. DFU's TransitionInterior lands the player at
// the interior door nearest the enter marker, 0.75 along its normal (PlayerEnterExit.cs:737-765): where that is the
// copy's door, the landing stands outside the room, over nothing. SetStanding's ray finds no floor (:1240-1254), a
// room's collider has no ground, and the body falls for good - past the room's walls (single-sided, unseen from
// outside) into the black, every door and every light out of reach. Warvale (location-17-842) stands GENRAS00, whose
// houses #1, #2 and #7 are three of the 146 entries of both packs that land so (54 village, 92 city - 2,214 of the
// 7,317 villages and 405 of the 410 cities hold one), out of 10,309; Daggerfall's own blocks have 16 of 11,452 (the
// desert blocks' floorless halves; FIELD BUGS 2026-10-07b TOWER-FLOORS stood two more - a library's and a bookshop's
// rooms, half a shell under the street - on their floors). The fix: the landing law takes only a spot it can stand on (enterExit.js
// interiorLanding's `standsAt`, the host's standsOnFloor over the room), a room with nowhere to stand is refused in
// DFU's own words, a room that will not lay out says them as DFU does, and a body below everything a building stands
// on is stood again at the door (worldModes.js frame()).
//
// Fixtures from the producers: Warvale's grid off its own location file, GENRAS00 rebuilt by the pack's reader
// (openWorldDataPack, the author's whole SubRecords over a classic stand-in) through blockFromJson, its exterior door
// by layoutRmbBlock and getStaticDoors, the room by buildInteriorContext, the entry through the mode machine both town
// hosts build (worldModes) with the player's real motor. The two models the house's doors are on (31714, the room;
// 158, the house) are Daggerfall's - no ARENA2 here - so each stands in as dfMeshToModel mints it from the planes that
// matter, measured on the player's ARCH3D: the door's four corners and the room's floor (158 has no floor at all).
// With ARENA2_PATH the whole of both packs and of BLOCKS.BSA is entered through every door (the last test).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { openWorldDataPack } from '../src/formats/worldDataPack.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { dfMeshToModel, DOOR_TYPE } from '../src/world/meshReader.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';
import {
  interiorLanding, doorWorldPosition, doorWorldNormal, floorLanding, standsOnFloor,
  interiorVoidRescue, standFromVoid, ENTER_DOOR_OFFSET, MARKER_UP_OFFSET, NOTHING_OF_VALUE_TEXT, INTERIOR_VOID_TEXT, INTERIOR_VOID_DROP,
} from '../src/player/enterExit.js';
import { trs } from '../src/world/mat4.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, FIXED_DT } from '../src/player/motor.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';

const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const packJson = (v) => JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'));
const VILLAGES = packJson('beautiful-villages');
const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const near = (a, b, eps = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < eps);

/** Quiet while the stand-in world warns of the ARENA2 it has not got. */
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}

// ── the house ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Warvale's block grid, as the author's own location file sets it (`location-17-842.json`'s ops - its base is
 *  MAPS.BSA's Warvale, the grid the author's whole). */
function warvaleGrid() {
  const [, base, ops] = JSON.parse(VILLAGES.files['location-17-842.json']);
  assert.deepEqual(base, ['l', 17, 842, 'Warvale']);
  return ops.find((op) => op[0] === 's' && op[1].join('.') === 'Exterior.ExteriorData.BlockNames')[2];
}
/** GENRAS00.RMB as the world-data door serves it: the pack's own file rebuilt by the pack's reader over a classic
 *  stand-in at its index (the author sets every SubRecord whole; one `$c` reads the classic block's thirteenth
 *  interior, so the stand-in has thirteen), through the door's own converter. */
function genras00() {
  const classic = tinyRmb(270, 'GENRAS00.RMB');
  classic.rmbBlock.subRecords = Array.from({ length: 13 }, () => classic.rmbBlock.subRecords[0]);
  const pack = openWorldDataPack(VILLAGES, { blocks: fakeBlocks(classic) });
  return blockFromJson(pack.rebuild('GENRAS00.RMB.json'), 270);
}

/** A DFMesh (Arch3dFile.getMesh's shape) of `planes` given in metres in Unity's frame - dfMeshToModel turns them back. */
function dfMesh(planes) {
  const subMeshes = planes.map(({ archive, record = 0, points }) => ({
    textureArchive: archive, textureRecord: record, totalTriangles: points.length - 2,
    planes: [{ points: points.map(([x, y, z]) => ({ x: x * 40, y: -y * 40, z: z * 40, nx: 0, ny: 0, nz: 0, u: 0, v: 0 })) }],
  }));
  return { totalVertices: planes.reduce((n, p) => n + p.points.length, 0), totalTriangles: subMeshes.reduce((n, s) => n + s.totalTriangles, 0), subMeshes };
}
const mint = (planes) => dfMeshToModel(dfMesh(planes), () => ({ width: 64, height: 64 }));
const BUILDING_DOOR = 74;   // LoadVertices' door archive
/** 31714, the room: its floor (166_3, y -1.575 across +-1.45) and its door in its +z wall, facing in (0, 0, -1). */
const ROOM = 31714;
const roomModel = () => mint([
  { archive: 166, record: 3, points: [[-1.45, -1.575, -1.45], [1.45, -1.575, -1.45], [1.45, -1.575, 1.45], [-1.45, -1.575, 1.45]] },
  { archive: BUILDING_DOOR, points: [[1.25, 0.675, 1.45], [0, 0.675, 1.45], [0, -1.575, 1.45], [1.25, -1.575, 1.45]] },
]);
/** 158, the house: its front door in the x = 0 plane, facing out (-1, 0, 0) - and no floor (the model has none). */
const HOUSE = 158;
const houseModel = () => mint([
  { archive: BUILDING_DOOR, points: [[0, 2.25, 0.35], [0, 2.25, 1.6], [0, 0, 1.6], [0, 0, 0.35]] },
]);
/** The House2 design the town mods stand in nine records (TVRNAS03 #4, PAWNAM02 #9, RESIAS02 #5, DARKAA00 #8...):
 *  31019, its room - its floor (116_3, y -1.575 across +-1.45 by +-1.525) and its door in its +z wall, facing in... */
const ROOM2 = 31019;
const room2Model = () => mint([
  { archive: 116, record: 3, points: [[-1.45, -1.575, -1.525], [1.45, -1.575, -1.525], [1.45, -1.575, 1.525], [-1.45, -1.575, 1.525]] },
  { archive: BUILDING_DOOR, points: [[1.25, 0.675, 1.525], [0, 0.675, 1.525], [0, -1.575, 1.525], [1.25, -1.575, 1.525]] },
]);
/** ...and 201, its house: the front door in the x = -1.6 plane, facing out - no floor. */
const HOUSE2 = 201;
const house2Model = () => mint([
  { archive: BUILDING_DOOR, points: [[-1.6, 2.25, -1.25], [-1.6, 2.25, 0], [-1.6, 0, 0], [-1.6, 0, -1.25]] },
]);
/** TVRNAS03.RMB (Beautiful Villages' roadside tavern block) as the door serves it - its file sets every piece whole
 *  and reads no classic node. */
function tvrnas03() {
  const pack = openWorldDataPack(VILLAGES, { blocks: fakeBlocks(tinyRmb(565, 'TVRNAS03.RMB')) });
  return blockFromJson(pack.rebuild('TVRNAS03.RMB.json'), 565);
}

/** No picture of any record (a TEXTURE file with none): every climate swap is pruned, every flat and person skipped;
 *  and no TEXTURE.210, so no lights. Pictures move no vertex. */
const noPictures = async (archive) => (archive === 210 ? null : { recordCount: 0 });
/** The pipeline the context builds through: the models given, nothing else (every other id is not in this ARCH3D -
 *  getGpuMesh's null, the placement skipped). */
function pipelineOf(models, { fail = null } = {}) {
  const cpuModels = new Map();
  return {
    cpuModels, getTexture: noPictures, uploadRecord: () => {}, uploadRecordFrame: () => {}, arch: null, palette: null, getMachineryParts: () => {},
    getGpuMesh: async (id) => {
      if (fail) throw fail;
      const m = models[id]?.();
      if (!m) return null;
      cpuModels.set(id, { modelIdNum: id, ...m });
      return { id };
    },
  };
}
const noop = () => {};
const fakeRenderer = { createBillboardBatch: () => ({}), destroyBatch: noop, createMesh: () => ({}), destroyMesh: noop };

/** House #`ri` of `block`: its exterior door as the street mints it, and its room as the host builds it - parented at
 *  that door's matrix (P8, DFU's ownerPosition + buildingMatrix). */
async function houseOf(block, ri, models = { [ROOM]: roomModel, [HOUSE]: houseModel }, house = HOUSE) {
  const placed = layoutRmbBlock(block).models.find((p) => p.recordIndex === ri && p.modelIdNum === house);
  const [door] = getStaticDoors(models[house](), block.index, ri, placed.matrix);
  const pipe = pipelineOf(models);
  const ctx = await quietly(() => buildInteriorContext({ ...pipe, renderer: fakeRenderer }, block, block.index, ri, 300, 0, door.matrix, {}));
  return { door, ctx };
}

test('VOID-ENTRY: Warvale\'s house - GENRAS00 #1, the author\'s room keeps the house\'s own exterior model, whose door faces OUT and is the door nearest the enter marker; DFU\'s landing stands outside the room over nothing, the law lands on the room\'s floor before its own door', async () => {
  assert.ok(warvaleGrid().includes('GENRAS00.RMB'), 'Warvale stands GENRAS00');
  const block = genras00();
  const sub = block.rmbBlock.subRecords[1];
  assert.equal(sub.exterior.block3dObjectRecords[0].modelIdNum, HOUSE, 'the house is model 158');
  assert.ok(sub.interior.block3dObjectRecords.some((o) => o.modelIdNum === HOUSE), 'and its room keeps a copy of it');
  assert.ok(sub.interior.block3dObjectRecords.some((o) => o.modelIdNum === ROOM), 'beside the room, 31714');
  const { door, ctx } = await houseOf(block, 1);
  assert.equal(ctx.doors.length, 2, 'two interior doors: the room\'s and the copy\'s');
  const stands = (p) => standsOnFloor(ctx.collider, p);
  // DFU's own law, verbatim: the marker nearest the street's door, the interior door nearest the marker
  const dfu = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors);
  const copy = ctx.doors.find((d) => doorWorldNormal(d).every((v, i) => Math.abs(v - doorWorldNormal(door)[i]) < 1e-6));
  assert.ok(copy, 'the copy\'s door faces the way the street\'s does - out');
  const copyAt = doorWorldPosition(copy), out = doorWorldNormal(copy);
  assert.ok(near(dfu, copyAt.map((v, i) => v + out[i] * ENTER_DOOR_OFFSET)), 'DFU lands 0.75 out from the copy\'s door');
  assert.equal(stands(dfu), false, 'over nothing - the void the report fell into');
  assert.deepEqual(floorLanding(ctx.collider, dfu), dfu, 'FixStanding finds no floor and leaves the body to gravity');
  // the law
  const landing = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors, stands);
  assert.equal(stands(landing), true, 'the law lands where there is a floor');
  const own = ctx.doors.find((d) => d !== copy);
  const ownAt = doorWorldPosition(own), into = doorWorldNormal(own);
  assert.ok(near(landing, ownAt.map((v, i) => v + into[i] * ENTER_DOOR_OFFSET)), 'in front of the room\'s own door, the next nearest the marker');
  const floor = floorLanding(ctx.collider, landing);
  assert.ok(Math.abs(floor[1] - (landing[1] - 1.125)) < 0.01, 'on the room\'s floor, the door\'s centre 1.125 over it');
  assert.ok(Math.hypot(landing[0] - doorWorldPosition(door)[0], landing[2] - doorWorldPosition(door)[2]) < 2, 'a step in from the street\'s door');
});

test('VOID-ENTRY: the House2 design with NO enter marker (199.8) - TVRNAS03 #4, its one marker a Rest (199.4), which DFU takes for an enter marker (DaggerfallInterior.cs:242-246): the copy\'s outward door nearest it, the same void, and the law\'s floor; and with no marker at all (the check is the street\'s door, PlayerEnterExit.cs:740) the same', async () => {
  const models = { [ROOM2]: room2Model, [HOUSE2]: house2Model };
  const land = async (block) => {
    const { door, ctx } = await houseOf(block, 4, models, HOUSE2);
    const stands = (p) => standsOnFloor(ctx.collider, p);
    const dfu = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors);
    const law = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors, stands);
    const own = ctx.doors.find((d) => doorWorldNormal(d).some((v, i) => Math.abs(v - doorWorldNormal(door)[i]) > 1e-6));
    return { ctx, dfu, law, stands, ownLanding: doorWorldPosition(own).map((v, i) => v + doorWorldNormal(own)[i] * ENTER_DOOR_OFFSET) };
  };
  const block = tvrnas03();
  const sub = block.rmbBlock.subRecords[4];
  assert.equal(sub.exterior.block3dObjectRecords[0].modelIdNum, HOUSE2, 'the house is model 201');
  assert.ok([HOUSE2, ROOM2].every((id) => sub.interior.block3dObjectRecords.some((o) => o.modelIdNum === id)), 'its room keeps a copy of it, beside 31019');
  const editor = sub.interior.blockFlatObjectRecords.filter((f) => f.textureArchive === 199);
  assert.deepEqual([editor.filter((f) => f.textureRecord === 8).length, editor.filter((f) => f.textureRecord === 4).length], [0, 1], 'no enter marker, one rest marker');
  const rest = await land(block);
  assert.equal(rest.ctx.enterMarkers.length, 1, 'the rest marker stands for the enter marker');
  assert.equal(rest.stands(rest.dfu), false, 'DFU\'s landing: over nothing');
  assert.ok(near(rest.law, rest.ownLanding) && rest.stands(rest.law), 'the law: on the room\'s floor, before its own door');
  // the same room with no marker of either kind
  const bare = tvrnas03();
  const flats = bare.rmbBlock.subRecords[4].interior.blockFlatObjectRecords;
  bare.rmbBlock.subRecords[4].interior.blockFlatObjectRecords = flats.filter((f) => !(f.textureArchive === 199 && f.textureRecord === 4));
  const none = await land(bare);
  assert.equal(none.ctx.enterMarkers.length, 0);
  assert.equal(none.stands(none.dfu), false, 'the copy\'s door is the street\'s own, nearest of all');
  assert.ok(near(none.law, none.ownLanding) && none.stands(none.law), 'the law, again');
});

test('VOID-ENTRY: the law - every landing DFU makes on a floor is DFU\'s own, byte for byte; one over nothing goes to the next door nearest the check, then the marker nearest the street\'s door (+ up 1.08); none that stands is null', () => {
  const I = trs(0, 0, 0, 0, 0, 0);
  const door = (x, z, nx, nz) => ({ matrix: I, centre: { x, y: 1, z }, normal: { x: nx, y: 0, z: nz }, size: { x: 0.1, y: 2.2, z: 1 } });
  const doors = [door(10, 0, 1, 0), door(0, 0, 0, 1), door(4, 4, -1, 0)];
  const markers = [[9, 0, 0.5], [1, 0, 2]];
  const ext = [1, 1, 0];
  const dfu = interiorLanding(ext, markers, doors);
  // the check is the marker nearest the street's door ([1, 0, 2]); the door nearest it is (0, 0)
  assert.deepEqual(interiorLanding(ext, markers, doors, () => true), dfu, 'a floor under DFU\'s landing: DFU\'s, exactly');
  assert.deepEqual(dfu, [0, 1, ENTER_DOOR_OFFSET]);
  const without = (...spots) => (p) => !spots.some((s) => near(p, s));
  assert.deepEqual(interiorLanding(ext, markers, doors, without(dfu)), [4 - ENTER_DOOR_OFFSET, 1, 4], 'the next door nearest the check (4,4 at 3.7; 10,0 at 9.3)');
  assert.deepEqual(interiorLanding(ext, markers, doors, without(dfu, [4 - ENTER_DOOR_OFFSET, 1, 4])), [10 + ENTER_DOOR_OFFSET, 1, 0], 'and the last');
  const noDoor = without(dfu, [4 - ENTER_DOOR_OFFSET, 1, 4], [10 + ENTER_DOOR_OFFSET, 1, 0]);
  assert.deepEqual(interiorLanding(ext, markers, doors, noDoor), [1, MARKER_UP_OFFSET, 2], 'no door stands: DFU\'s marker arm, the marker nearest the street\'s door');
  assert.deepEqual(interiorLanding(ext, markers, doors, (p) => noDoor(p) && !near(p, [1, MARKER_UP_OFFSET, 2])), [9, MARKER_UP_OFFSET, 0.5], 'then the next marker');
  assert.equal(interiorLanding(ext, markers, doors, () => false), null, 'nowhere stands: refused');
  // the markers rank from the street's door, not from the nearest marker (the check): from the door (0,0,0) M1 is
  // nearest; then M3 (1.80) before M2 (2.00), where from M1 it would be M2 (1.00) before M3 (1.50)
  const ms = [[1, 0, 0], [2, 0, 0], [1, 0, 1.5]];
  const onlyM2M3 = (p) => near(p, [2, MARKER_UP_OFFSET, 0]) || near(p, [1, MARKER_UP_OFFSET, 1.5]);
  assert.deepEqual(interiorLanding([0, 0, 0], ms, [], onlyM2M3), [1, MARKER_UP_OFFSET, 1.5]);
  // a tie keeps the array's order, as `closest`'s strict < does
  const twins = [door(2, 0, 1, 0), door(-2, 0, -1, 0)];
  assert.deepEqual(interiorLanding([0, 1, 0], [], twins), [2 + ENTER_DOOR_OFFSET, 1, 0]);
  assert.deepEqual(interiorLanding([0, 1, 0], [], twins, () => true), [2 + ENTER_DOOR_OFFSET, 1, 0]);
  // a seeded sweep: wherever DFU's landing stands, the law IS DFU's; where it does not, the law is the first of the
  // doors by distance from the check, then the markers by distance from the street's door, that stands
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 20 - 10;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (let k = 0; k < 200; k++) {
    const ds = Array.from({ length: 1 + (k % 4) }, () => door(rnd(), rnd(), ...(k % 2 ? [1, 0] : [0, -1])));
    const mk = Array.from({ length: k % 3 }, () => [rnd(), 0, rnd()]);
    const e = [rnd(), 1, rnd()];
    const ref = interiorLanding(e, mk, ds);
    assert.deepEqual(interiorLanding(e, mk, ds, () => true), ref);
    const check = mk.length ? mk.reduce((b, m) => (d2(m, e) < d2(b, e) ? m : b)) : e;
    const cands = [
      ...ds.map((d) => ({ at: doorWorldPosition(d), d })).sort((a, b) => d2(a.at, check) - d2(b.at, check)).map(({ at, d }) => at.map((v, i) => v + doorWorldNormal(d)[i] * ENTER_DOOR_OFFSET)),
      ...mk.slice().sort((a, b) => d2(a, e) - d2(b, e)).map((m) => [m[0], m[1] + MARKER_UP_OFFSET, m[2]]),
    ];
    const pick = cands[k % cands.length];
    assert.deepEqual(interiorLanding(e, mk, ds, (p) => near(p, pick, 1e-9)), pick, `sweep ${k}`);
  }
});

test('VOID-ENTRY: standsOnFloor is floorLanding\'s own answer - its footprint meets a floor within its reach, or the collider\'s ground is under the spot; a building\'s collider has no ground', () => {
  const room = new Collider(() => -Infinity);
  room.addMesh('i', [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], [0, 1, 2, 0, 2, 3], trs(0, 0, 0, 0, 0, 0));
  assert.equal(standsOnFloor(room, [0, 1.1, 0]), true);
  assert.equal(standsOnFloor(room, [0.9, 1.1, 0]), true, 'the footprint: a ring at 0.18 about the centre');
  assert.equal(standsOnFloor(room, [1.15, 1.1, 0]), true, 'the ring still meets the floor\'s edge');
  assert.equal(standsOnFloor(room, [1.25, 1.1, 0]), false, 'past the ring: nothing - and floorLanding leaves it to gravity');
  assert.deepEqual(floorLanding(room, [1.25, 1.1, 0]), [1.25, 1.1, 0]);
  assert.equal(standsOnFloor(room, [0, 9.9, 0]), true, 'within its reach (ten, from 0.2 over the spot)');
  assert.equal(standsOnFloor(room, [0, 10.1, 0]), false, 'and not past it');
  assert.equal(standsOnFloor(room, [0, -0.5, 0]), false, 'a body under the floor stands on nothing below it');
  const street = new Collider(() => 4);
  assert.equal(standsOnFloor(street, [50, 9, 50]), true, 'the street\'s ground is a floor (floorLanding stands it there)');
  assert.deepEqual(floorLanding(street, [50, 9, 50]), [50, 4, 50]);
});

test('VOID-ENTRY: the failsafe\'s two halves - the record a room leaves (where the door landed the player; INTERIOR_VOID_DROP under its lowest triangle; none for a room of no triangle), and the stand (a body under that depth stands at the door, its fall cleared; at or over it, left alone)', () => {
  const room = new Collider(() => -Infinity);
  room.addMesh('floor', [-1, -2, -1, 1, -2, -1, 1, -2, 1, -1, -2, 1], [0, 1, 2, 0, 2, 3], trs(0, 0, 0, 0, 0, 0));
  room.addMesh('ceiling', [-1, 3, -1, 1, 3, -1, 1, 3, 1, -1, 3, 1], [0, 1, 2, 0, 2, 3], trs(0, 0, 0, 0, 0, 0));
  const at = [0, -2, 0];
  assert.equal(INTERIOR_VOID_DROP, 10);
  assert.deepEqual(interiorVoidRescue(room, at), { at, belowY: -12 }, 'ten under the floor, the lowest triangle');
  assert.equal(interiorVoidRescue(new Collider(() => -Infinity), at), null, 'no triangle, no record');
  const rescue = interiorVoidRescue(room, at);
  const body = new PlayerMotor(room);
  body.spawn(5, -12, 5);
  assert.equal(standFromVoid(rescue, body), false, 'at the depth: left alone');
  assert.deepEqual([...body.pos], [5, -12, 5]);
  body.spawn(5, -12.5, 5);
  Object.assign(body, { falling: true, fallStart: 1.2, velY: -30 });   // a fall carried in (a load's restoreFall)
  assert.equal(standFromVoid(rescue, body), true, 'under it: stood again');
  assert.deepEqual([...body.pos], at);
  assert.equal(body.falling, false);
  assert.equal(body.velY, 0, 'the fall cleared - nothing to bill on landing');
  assert.equal(standFromVoid(null, body), false, 'a room with no record');
});

// ── the mode machine ─────────────────────────────────────────────────────────────────────────────────────────────
/** THE MODE MACHINE over a stub host - AUDIT 68's own rig (test/audit68_worldmodes.test.js buildModes), with the
 *  player's real motor and a HUD line catcher (townTalk.say, DaggerfallUI.AddHUDText's door). */
async function buildModes({ entry, pipeline, said }) {
  const deep = () => new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()),
    apply: () => deep(),
    construct: () => deep(),
  });
  globalThis.addEventListener ??= noop;
  globalThis.removeEventListener ??= noop;
  globalThis.fetch = async () => { throw new Error('no ARENA2 in this test'); };
  const { createWorldModes } = await import('../src/scenes/worldModes.js');
  globalThis.window = globalThis;
  const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const street = new Collider(() => 0);
  const player = new PlayerMotor(street);
  const cam = { yaw: 0, pitch: 0, pos: [0, 1.6, 0] };
  const modes = await quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline, townTalk: { say: (l) => said.push(l) },
    doorTargets: () => [entry], baseCollider: () => street,
  }));
  return { modes, player, cam };
}
/** Warvale's house #1, the entry the street hands the mode machine, and an inside save's identity for it (IS1). */
async function warvaleEntry() {
  const block = genras00();
  const placed = layoutRmbBlock(block).models.find((p) => p.recordIndex === 1 && p.modelIdNum === HOUSE);
  const [door] = getStaticDoors(houseModel(), block.index, 1, placed.matrix);
  assert.equal(door.doorType, DOOR_TYPE.BUILDING);
  const entry = { door, dfBlock: block, recordIndex: 1, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
  const saved = {
    door: { blockIndex: door.blockIndex, recordIndex: 1, doorIndex: door.doorIndex, buildingKey: 7 },
    building: { buildingKey: 7, buildingType: BUILDING_TYPES.House2, regionIndex: 17, quality: 4, factionId: 0, nameSeed: 0 },
  };
  return { entry, saved };
}

test('VOID-ENTRY: through the mode machine both town hosts build (worldModes) - Warvale\'s house #1 entered: the player stands on the room\'s floor, and a second later still does (it fell through the floor before)', async () => {
  const { entry, saved } = await warvaleEntry();
  const said = [];
  const { modes, player } = await buildModes({ entry, pipeline: pipelineOf({ [ROOM]: roomModel, [HOUSE]: houseModel }), said });
  assert.equal(await quietly(() => modes.restoreInterior(saved, null)), true, 'the house stands and the player is in it');
  assert.equal(modes.mode, 'interior');
  const room = modes.interiorCtx.collider;
  assert.equal(player.collider, room);
  assert.equal(standsOnFloor(room, player.pos), true, 'on a floor - the code before stood the player over nothing here');
  const at = [...player.pos];
  for (let f = 0; f < 60; f++) player.update(FIXED_DT, IDLE, 0);
  assert.ok(Math.abs(player.pos[1] - at[1]) < 0.05, `still on it a second later (${at[1].toFixed(2)} -> ${player.pos[1].toFixed(2)})`);
  assert.deepEqual(said, [], 'an entry that stands says nothing');
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
});

test('VOID-ENTRY: a room with nowhere to stand is REFUSED in DFU\'s words - the house without its room (the copy\'s outward door, no floor anywhere): the player stays in the street, "This house has nothing of value.", nothing committed', async () => {
  assert.equal(NOTHING_OF_VALUE_TEXT, 'This house has nothing of value.', 'Internal_Strings thisHouseHasNothingOfValue (Internal_Strings_en.asset m_Id 8)');
  const { entry, saved } = await warvaleEntry();
  const said = [];
  const { modes, player } = await buildModes({ entry, pipeline: pipelineOf({ [HOUSE]: houseModel }), said });
  const before = [...player.pos];
  assert.equal(await quietly(() => modes.restoreInterior(saved, null)), false, 'refused - the code before entered, into the void');
  assert.equal(modes.mode, 'exterior');
  assert.equal(modes.interiorCtx, null, 'nothing published');
  assert.equal(modes.interiorBuilding, null);
  assert.deepEqual([...player.pos], before, 'the player never moved');
  assert.deepEqual(said, [NOTHING_OF_VALUE_TEXT]);
});

test('VOID-ENTRY: a room that will not lay out says DFU\'s old chestnut (TransitionInterior\'s catch, PlayerEnterExit.cs:719-730) and leaves the player in the street; a build the world moved under (a load, a teleport) says nothing', async () => {
  const { entry, saved } = await warvaleEntry();
  const said = [];
  const { modes } = await buildModes({ entry, pipeline: pipelineOf({}, { fail: new Error('fetch failed') }), said });
  assert.equal(await quietly(() => modes.restoreInterior(saved, null)), false);
  assert.equal(modes.mode, 'exterior');
  assert.deepEqual(said, [NOTHING_OF_VALUE_TEXT], 'the code before said nothing at all');
  // the race (AUDIT 68 X3): the build hangs, the world moves, then the build fails - that is no house refusing anyone
  let fail = null;
  const hung = { ...pipelineOf({}), getGpuMesh: () => new Promise((_, rej) => { fail = rej; }) };
  const said2 = [];
  const { modes: m2 } = await buildModes({ entry, pipeline: hung, said: said2 });
  const p = quietly(() => m2.restoreInterior(saved, null));
  for (let i = 0; i < 8 && !fail; i++) await Promise.resolve();
  assert.ok(fail, 'the build is in flight');
  m2.abortTransition();
  fail(new Error('fetch failed'));
  assert.equal(await p, false);
  assert.deepEqual(said2, []);
});

/** frame()'s own failsafe statement, lifted from worldModes.js: the building's arm, UNSTUCK1's drain's else. */
const RESCUE = (() => {
  const frameAt = WM.indexOf('  function frame(dt, now) {');
  const drain = '    if (pendingInteriorExit) { pendingInteriorExit = false; exitInteriorNow(); return true; } else ';
  const lineAt = WM.indexOf(drain, frameAt);
  assert.ok(frameAt > 0 && lineAt > frameAt, 'the failsafe is frame()\'s, the else of the building arm\'s drain');
  const at = lineAt + drain.length;
  const end = WM.indexOf('}', WM.indexOf('say(INTERIOR_VOID_TEXT);', at)) + 1;
  assert.ok(end > at && WM.slice(at, end).startsWith('if (standFromVoid(interiorCtx.voidRescue, player)) {'));
  assert.ok(WM.indexOf('renderer.setLighting(', end) - end < 400, 'before the building is drawn');
  // eslint-disable-next-line no-new-func
  return new Function('interiorCtx', 'player', 'cam', 'say', 'INTERIOR_VOID_TEXT', 'standFromVoid', WM.slice(at, end));
})();

test('VOID-ENTRY: THE FAILSAFE - a body below everything the building stands on (a save or an anchor made in the void, a floorless half walked off) is stood again where the door landed it, its fall cleared, and told; anywhere above that it is left alone', async () => {
  const { entry, saved } = await warvaleEntry();
  const said = [];
  const { modes, player, cam } = await buildModes({ entry, pipeline: pipelineOf({ [ROOM]: roomModel, [HOUSE]: houseModel }), said });
  assert.equal(await quietly(() => modes.restoreInterior(saved, null)), true);
  const ctx = modes.interiorCtx;
  const door = [...player.pos];
  const lowest = ctx.collider.bounds().min[1];
  assert.ok(near(ctx.voidRescue.at, door), 'the record the entry leaves: where the door landed the player...');
  assert.equal(ctx.voidRescue.belowY, lowest - INTERIOR_VOID_DROP, '...and the void\'s depth under the lowest triangle the building has');
  const rescue = () => RESCUE(ctx, player, cam, (l) => said.push(l), INTERIOR_VOID_TEXT, standFromVoid);
  // where DFU's own landing stood the player: outside the room, over nothing
  const voidSpot = interiorLanding(doorWorldPosition(entry.door), ctx.enterMarkers, ctx.doors);
  assert.equal(standsOnFloor(ctx.collider, voidSpot), false);
  // standing in the room, and anywhere above the void's depth: nothing
  rescue();
  assert.ok(near(player.pos, door));
  player.spawn(voidSpot[0], lowest - INTERIOR_VOID_DROP + 0.1, voidSpot[2]);
  rescue();
  assert.ok(player.pos[1] > lowest - INTERIOR_VOID_DROP, 'just above the depth: left alone');
  assert.deepEqual(said, []);
  // in the void: DFU's landing, the real motor stepping it - it never meets anything (the room has no ground)
  player.spawn(voidSpot[0], voidSpot[1], voidSpot[2]);
  for (let f = 0; f < 180 && player.pos[1] >= lowest - INTERIOR_VOID_DROP; f++) player.update(FIXED_DT, IDLE, 0);
  assert.ok(player.pos[1] < lowest - INTERIOR_VOID_DROP && player.falling, 'it fell clear of the building - the code before left it falling for good');
  rescue();
  assert.ok(near(player.pos, door), 'stood again where the door landed it');
  assert.equal(player.falling, false, 'the fall is cleared - it lands unhurt');
  assert.deepEqual(cam.pos, [...player.eye]);
  assert.deepEqual(said, [INTERIOR_VOID_TEXT]);
  // a save made in the void restores there, raw (RestorePosition) - and the failsafe stands it at the door
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
  assert.equal(await quietly(() => modes.restoreInterior(saved, [voidSpot[0], -500, voidSpot[2]])), true);
  assert.equal(player.pos[1], -500, 'DFU\'s RestorePosition: the saved spot, raw');
  RESCUE(modes.interiorCtx, player, cam, (l) => said.push(l), INTERIOR_VOID_TEXT, standFromVoid);
  assert.ok(near(player.pos, modes.interiorCtx.voidRescue.at) && standsOnFloor(modes.interiorCtx.collider, player.pos), 'at the door, on the floor');
  assert.deepEqual(said, [INTERIOR_VOID_TEXT, INTERIOR_VOID_TEXT]);
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
});

// ── with the player's own data ───────────────────────────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));

test('VOID-ENTRY with ARENA2: every building of both packs and of BLOCKS.BSA entered through every exterior door - DFU\'s law stands 146 of the packs\' 10,309 entries over nothing (Warvale\'s GENRAS00 #1, #2, #7, and the nine House2 rooms with no enter marker, among them) and 16 of Daggerfall\'s own 11,452, every one from a check marker over nothing (TOWER-FLOORS stood the other two on their floors); the law lands every one of the packs\' on a floor, lands 12 of Daggerfall\'s and refuses 4, and moves no landing DFU made on a floor', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 300000 }, async () => {
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { patchSeams } = await import('../src/world/arch3dSeams.js');
  const { installTownStandIns } = await import('../src/world/townStandIns.js');
  const { customModelBuilt, customAliasFor } = await import('../src/world/customModels.js');
  const blocks = new BlocksFile(); assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
  installTownStandIns(() => true);
  const size = () => ({ width: 64, height: 64 });   // a picture's size moves a UV, never a vertex
  const classicModel = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : dfMeshToModel(arch.getMesh(i), size); };
  const cpuModels = new Map(), built = new Map();
  const getGpuMesh = async (id) => {
    if (built.has(id)) return built.get(id);
    let m = await customModelBuilt(id, { classicModel });
    if (!m) { const al = customAliasFor(id), mid = al ? al.model : id, i = arch.getRecordIndex(mid); m = i === -1 ? null : dfMeshToModel(patchSeams(mid, arch.getMesh(i)), size); }
    if (m) cpuModels.set(id, { modelIdNum: id, ...m, doors: m.doors ?? [] });
    built.set(id, m ? { id } : null);
    return built.get(id);
  };
  const deps = { renderer: fakeRenderer, getGpuMesh, cpuModels, getTexture: noPictures, uploadRecord: noop, uploadRecordFrame: noop, palette: null, getMachineryParts: null };
  const voids = [];
  // THE TWO SHAPES OF A MARKER (the towns audit's): a room with no enter marker (199.8) - its one marker a Rest
  // (199.4), which DFU takes for one, or none - and the marker the law checks from (the nearest the street's door)
  // standing over nothing. Each entry of either is counted with what DFU's law and the law make of it.
  async function enterAll(label, names, blockOf) {
    const t = { entries: 0, dfuVoid: 0, lawVoid: 0, refused: 0, moved: 0, unbuilt: 0,
      no8: 0, no8DfuVoid: 0, no8LawFloor: 0, noMarker: 0, markerVoid: 0, markerVoidLawFloor: 0, markerVoidRefused: 0 };
    for (const name of names) {
      const block = blockOf(name);
      const ext = new Map();
      for (const p of layoutRmbBlock(block).models) {
        if (p.recordIndex === undefined) continue;
        await getGpuMesh(p.modelIdNum);
        const cpu = cpuModels.get(p.modelIdNum);
        for (const d of (cpu?.doors?.length ? getStaticDoors(cpu, block.index, p.recordIndex, p.matrix) : []) ?? []) {
          if (d.doorType === DOOR_TYPE.BUILDING) ext.set(p.recordIndex, [...(ext.get(p.recordIndex) ?? []), d]);
        }
      }
      for (const [ri, doors] of ext) {
        for (const door of doors) {
          let ctx;
          try { ctx = await buildInteriorContext(deps, block, block.index, ri, 300, 0, door.matrix, {}); } catch { t.unbuilt++; continue; }
          t.entries++;
          const stands = (p) => standsOnFloor(ctx.collider, p);
          const dfu = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors);
          const law = interiorLanding(doorWorldPosition(door), ctx.enterMarkers, ctx.doors, stands);
          if (dfu && !stands(dfu)) { t.dfuVoid++; voids.push(`${label}:${name}#${ri}`); }
          if (!law) t.refused++;
          else if (!stands(law)) t.lawVoid++;
          if (dfu && stands(dfu) && !(law && dfu.every((v, i) => v === law[i]))) t.moved++;
          const editor = block.rmbBlock.subRecords[ri].interior.blockFlatObjectRecords.filter((f) => f.textureArchive === 199);
          if (!editor.some((f) => f.textureRecord === 8)) {
            t.no8++;
            if (!editor.some((f) => f.textureRecord === 4)) t.noMarker++;
            if (dfu && !stands(dfu)) t.no8DfuVoid++;
            if (law && stands(law)) t.no8LawFloor++;
          }
          const e = doorWorldPosition(door);
          const check = ctx.enterMarkers.reduce((b, m) => (!b || (m[0] - e[0]) ** 2 + (m[1] - e[1]) ** 2 + (m[2] - e[2]) ** 2 < (b[0] - e[0]) ** 2 + (b[1] - e[1]) ** 2 + (b[2] - e[2]) ** 2 ? m : b), null);
          if (check && !stands([check[0], check[1] + MARKER_UP_OFFSET, check[2]])) {
            t.markerVoid++;
            if (!law) t.markerVoidRefused++;
            else if (stands(law)) t.markerVoidLawFloor++;
          }
          ctx.destroy();
        }
      }
    }
    return t;
  }
  const quiet = console.warn; console.warn = noop;
  const logs = console.log; console.log = noop;
  try {
    const packs = {};
    let next = 5000;
    for (const v of ['beautiful-villages', 'beautiful-cities']) {
      const pack = openWorldDataPack(packJson(v), { blocks });
      const names = pack.names().filter((n) => /\.RMB\.json$/i.test(n)).map((n) => n.replace(/\.json$/i, ''));
      packs[v] = await enterAll(v, names, (n) => { const i = blocks.getBlockIndex(n); return blockFromJson(pack.rebuild(`${n}.json`), i >= 0 ? i : next++); });
    }
    const classicNames = [];
    for (let i = 0; i < blocks.count; i++) { const n = blocks.getBlockName(i); if (/\.RMB$/i.test(n ?? '')) classicNames.push(n); }
    const classic = await enterAll('classic', classicNames, (n) => blocks.getBlock(blocks.getBlockIndex(n)));
    // the packs: DFU's law stands 146 entries over nothing - the nine of the House2 design with no enter marker among
    // them - the law none; no check marker of theirs stands over nothing, and none moved
    assert.deepEqual(packs['beautiful-villages'], { entries: 2805, dfuVoid: 54, lawVoid: 0, refused: 0, moved: 0, unbuilt: 0,
      no8: 4, no8DfuVoid: 4, no8LawFloor: 4, noMarker: 0, markerVoid: 0, markerVoidLawFloor: 0, markerVoidRefused: 0 });
    assert.deepEqual(packs['beautiful-cities'], { entries: 7504, dfuVoid: 92, lawVoid: 0, refused: 0, moved: 0, unbuilt: 0,
      no8: 5, no8DfuVoid: 5, no8LawFloor: 5, noMarker: 0, markerVoid: 0, markerVoidLawFloor: 0, markerVoidRefused: 0 });
    // Daggerfall's own: 16 over nothing, every one from a check marker over nothing (the desert blocks' floorless
    // halves) - 12 landed, 4 with nowhere to stand refused; two rooms with no marker at all land as DFU lands them.
    // There were 18: LIBRAM00 #7's and BOOKAS00 #8's second doors stood their rooms half a shell under the street
    // until FIELD BUGS 2026-10-07b TOWER-FLOORS stood their floor models on their storeys
    assert.deepEqual(classic, { entries: 11452, dfuVoid: 16, lawVoid: 0, refused: 4, moved: 0, unbuilt: 6,
      no8: 2, no8DfuVoid: 0, no8LawFloor: 2, noMarker: 2, markerVoid: 16, markerVoidLawFloor: 12, markerVoidRefused: 4 }, 'the six graveyard records with no interior models are DFU\'s own throw (AssignBlockData)');
    for (const r of [1, 2, 7]) assert.ok(voids.includes(`beautiful-villages:GENRAS00.RMB#${r}`), `Warvale's house #${r}`);
    for (const k of ['classic:LIBRAM00.RMB#7', 'classic:BOOKAS00.RMB#8']) assert.ok(!voids.includes(k), `TOWER-FLOORS: ${k} lands at its own door`);
    for (const k of ['beautiful-villages:TVRNAS03.RMB#4', 'beautiful-villages:PAWNAM02.RMB#9', 'beautiful-villages:RESIAS02.RMB#5', 'beautiful-cities:DARKAA00.RMB#8']) assert.ok(voids.includes(k), `the House2 design: ${k}`);
  } finally { console.warn = quiet; console.log = logs; }
});
