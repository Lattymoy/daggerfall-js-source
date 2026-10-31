// AUDIT RPT1026 L3 (lane L, MISC - the audit of FIELD BUGS 2026-10-26r): BED-PRESS-INDOOR, DRIVEN THROUGH THE REAL INTERIOR
// HOST. The fix prices a building's rest by the bed's press (restSession.js interiorRestSpot, handed worldModes.js's
// `_restFromBed`), and the press's flag lives only as long as the press: `restFromInteriorBed` raises it around
// toggleRest and drops it in its `finally`. toggleRest opens the rest window at once - unless the player is poisoned or
// diseased, when REST-WARN asks first (a DecisionBoxWindow), and the window opens on its Yes, after the flag is down.
// The mode machine over a stub host (test/world/fb1007_hallfolk.test.js's rig: Warvale's house #1, GENRAS00 as
// Beautiful Villages serves it), a bed pressed: the rest's place is read at the window's open (shared.js setResting).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { openWorldDataPack } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { getStaticDoors } from '../../src/world/staticDoors.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { startPoison, POISONS } from '../../src/systems/poisons.js';
import { DecisionBoxWindow } from '../../src/ui/decisionBox.js';
import { tinyRmb, fakeBlocks } from '../wd3Fakes.mjs';
import { createRestDeps } from '../../src/scenes/shared.js';
import { createRestWindow } from '../../src/ui/restDoor.js';
import { setWorldMinutes, setSharedClock, setOwnMinutes } from '../../src/systems/worldTick.js';


const VILLAGES = null;   // OWN-WORK3: Beautiful Villages retired - no pack to build its rooms from
const noop = () => {};
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}
function genras00() {
  const classic = tinyRmb(270, 'GENRAS00.RMB');
  classic.rmbBlock.subRecords = Array.from({ length: 13 }, () => classic.rmbBlock.subRecords[0]);
  const pack = openWorldDataPack(VILLAGES, { blocks: fakeBlocks(classic) });
  return blockFromJson(pack.rebuild('GENRAS00.RMB.json'), 270);
}
function dfMesh(planes) {
  const subMeshes = planes.map(({ archive, record = 0, points }) => ({
    textureArchive: archive, textureRecord: record, totalTriangles: points.length - 2,
    planes: [{ points: points.map(([x, y, z]) => ({ x: x * 40, y: -y * 40, z: z * 40, nx: 0, ny: 0, nz: 0, u: 0, v: 0 })) }],
  }));
  return { totalVertices: planes.reduce((n, p) => n + p.points.length, 0), totalTriangles: subMeshes.reduce((n, s) => n + s.totalTriangles, 0), subMeshes };
}
const mint = (planes) => dfMeshToModel(dfMesh(planes), () => ({ width: 64, height: 64 }));
const BUILDING_DOOR = 74;
const ROOM = 31714;
const roomModel = () => mint([
  { archive: 166, record: 3, points: [[-1.45, -1.575, -1.45], [1.45, -1.575, -1.45], [1.45, -1.575, 1.45], [-1.45, -1.575, 1.45]] },
  { archive: BUILDING_DOOR, points: [[1.25, 0.675, 1.45], [0, 0.675, 1.45], [0, -1.575, 1.45], [1.25, -1.575, 1.45]] },
]);
const HOUSE = 158;
const houseModel = () => mint([{ archive: BUILDING_DOOR, points: [[0, 2.25, 0.35], [0, 2.25, 1.6], [0, 0, 1.6], [0, 0, 0.35]] }]);
function pipeline() {
  const cpuModels = new Map();
  const models = { [ROOM]: roomModel, [HOUSE]: houseModel };
  return {
    cpuModels, getTexture: async (archive) => (archive === 210 ? null : { recordCount: 0 }), uploadRecord: noop, uploadRecordFrame: noop,
    arch: null, palette: null, getMachineryParts: noop,
    getGpuMesh: async (id) => { const m = models[id]?.(); if (!m) return null; cpuModels.set(id, { modelIdNum: id, ...m }); return { id }; },
  };
}
const KEY = 7;
function warvale() {
  const block = genras00();
  const placed = layoutRmbBlock(block).models.find((p) => p.recordIndex === 1 && p.modelIdNum === HOUSE);
  const [door] = getStaticDoors(houseModel(), block.index, 1, placed.matrix);
  const entry = { door, dfBlock: block, recordIndex: 1, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
  const saved = {
    door: { blockIndex: door.blockIndex, recordIndex: 1, doorIndex: door.doorIndex, buildingKey: KEY },
    building: { buildingKey: KEY, buildingType: BUILDING_TYPES.House2, regionIndex: 17, quality: 4, factionId: 0, nameSeed: 0, townMapId: 7 },
  };
  return { entry, saved };
}
async function buildModes(entry) {
  const deep = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()), apply: () => deep(), construct: () => deep() });
  globalThis.addEventListener ??= noop;
  globalThis.removeEventListener ??= noop;
  globalThis.fetch = async () => { throw new Error('no ARENA2 in this test'); };
  const { createWorldModes } = await import('../../src/scenes/worldModes.js');
  globalThis.window = globalThis;
  const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const street = new Collider(() => 0);
  const player = new PlayerMotor(street);
  const modes = await quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam: { yaw: 0, pitch: 0, pos: [0, 1.6, 0] }, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline: pipeline(), townTalk: { say: noop }, doorTargets: () => [entry], baseCollider: () => street,
  }));
  return { modes, player };
}

test('AUDIT RPT1026 L3: the law, in the one door and the one bag - a window a bed\'s press opened rests in the bed and stands on it, offline and online; any other window keeps the host\'s word; the street\'s ship bed carries its press through the box too (mutants: auditl-bed-press-unmarked, auditl-bed-press-place-unread, auditl-bed-press-point-unread, auditl-bed-press-street-dropped, auditl-bed-press-kept)', () => {
  const sleeper = () => ({ health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] });
  const bagOf = (e) => createRestDeps(e, { restKind: () => 'rough', restPoint: () => ({ kind: 'rough', where: null }), endLines: () => null });
  // offline: the place the open reads
  const e1 = sleeper(), b1 = bagOf(e1);
  const pressed = createRestWindow(b1, true);
  assert.equal(e1.restKind, 'bed', 'opened by a bed\'s press: the bed\'s rest');
  assert.equal(b1.bedPressed, undefined, 'the press is the open\'s alone - the bag keeps nothing of it');
  pressed.dispose?.();
  b1.setResting(false);
  const e2 = sleeper(), b2 = bagOf(e2);
  createRestWindow(b2);
  assert.equal(e2.restKind, 'rough', 'the Rest key: the host\'s own word');
  b2.setResting(false);
  // online: the point the act opens on
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  try {
    const b3 = bagOf(sleeper());
    b3.bedPressed = true;
    assert.deepEqual(b3.restAct()?.point, { kind: 'bed', where: null }, 'the act stands on the bed pressed');
    b3.bedPressed = false;
    assert.deepEqual(b3.restAct()?.point, { kind: 'rough', where: null }, 'and on the host\'s point otherwise');
  } finally { setSharedClock(null); }
  // the street's host: its ship's bed is pressed around toggleRest (`_restFromBed`), read as the toggle runs
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const bed = _restFromBed, restNow = \(\) => \{ if \(modes\) markPartyRestSpent\(\); townTalk\.showOverlay\(createRestWindow\(outdoorRestDeps, bed\)\); \};/);
});
