// HALL-FOLK (FIELD BUGS 2026-10-07, a player's report, "NPCs in purchased guild halls"): "Sometimes there are NPCs in
// the player guild halls. It's ok that you can't remove everything or decorate from scratch, but it is a bit annoying
// if the NPCs don't disappear. And I think they are supposed to (because they do when you purchase a regular player
// Home)."
//
// A guild's hall IS an online home (GUILD1d: the homes table's row, its character the guild's own mark), and the
// door's build already stood none of its people: the build reads the town's answer once (`home`), and AddPeople's
// owned arm hides every resident of a home - anyone's. The "sometimes" was the REST. The rest window's close runs
// DaggerfallInterior.UpdateNpcPresence (ROAD-B B5), which stands back up every person of a building whose hours pass
// and never asks who owns it - DFU's own law, written for the bank's deed. A House2-4 is open 6-18, so any rest by
// day - the window opened and shut, or a night's sleep in the hall's own beds (GUILD1d made a member's hall their bed)
// - put the house's old residents back in the hall. A HouseForSale, a House1, a House5 or a House6 never passes, which
// is why a home seemed to keep them out: the same re-roll stands them in a House2-4 home too. The fix: the host's
// re-roll refuses a player's room online - the build's own answer, latched as `interiorHome` (and the private room's).
//
// Everything here is the producer's: the account service's own town answer (the real Worker over node:sqlite, a hall
// bought from a treasury, a home claimed on a realm record), the client registry that reads it (createOnlineHomes), and
// the mode machine both town hosts build (worldModes), restoring a real room - GENRAS00 #1 as Beautiful Villages serves
// it - and closing a real rest window over its own deps. `06-Systems/Online-Arc.md` HALL-FOLK.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { openWorldDataPack } from '../src/formats/worldDataPack.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor } from '../src/player/motor.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { createOnlineHomes } from '../src/systems/onlineHomes.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';
import { standService } from './accountDb.mjs';

const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const packJson = (v) => JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'));
const VILLAGES = packJson('beautiful-villages');
const noop = () => {};

async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}

// ── the room: Warvale's house #1 (test/fb1004d_voidentry.test.js's own), with two of the house's residents ────────────
/** GENRAS00.RMB as the world-data door serves it (the pack's file over a classic stand-in at its index). */
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
const houseModel = () => mint([
  { archive: BUILDING_DOOR, points: [[0, 2.25, 0.35], [0, 2.25, 1.6], [0, 0, 1.6], [0, 0, 0.35]] },
]);
const noPictures = async (archive) => (archive === 210 ? null : { recordCount: 0 });
function pipeline() {
  const cpuModels = new Map();
  const models = { [ROOM]: roomModel, [HOUSE]: houseModel };
  return {
    cpuModels, getTexture: noPictures, uploadRecord: noop, uploadRecordFrame: noop, arch: null, palette: null, getMachineryParts: noop,
    getGpuMesh: async (id) => {
      const m = models[id]?.();
      if (!m) return null;
      cpuModels.set(id, { modelIdNum: id, ...m });
      return { id };
    },
  };
}
/** Two of the house's people, as the block's people records carry them (BlocksFile's shape) - its residents. */
const RESIDENTS = [
  { position: 4101, xPos: -20, yPos: 63, zPos: -20, textureArchive: 182, textureRecord: 1, factionID: 0, flags: 0 },
  { position: 4102, xPos: 20, yPos: 63, zPos: 20, textureArchive: 182, textureRecord: 2, factionID: 0, flags: 0 },
];
const TOWN = 7;
const KEY = 7;
/** Warvale's house #1 - its people put in - the entry the street hands the mode machine, and an inside save's identity
 *  for it (IS1): a House2 of no faction, the type HOME2 sells and a guild buys as its hall (homeCandidate). */
function warvale(buildingType = BUILDING_TYPES.House2) {
  const block = genras00();
  const sr = block.rmbBlock.subRecords[1];
  block.rmbBlock.subRecords[1] = { ...sr, interior: { ...sr.interior, blockPeopleRecords: RESIDENTS.map((p) => ({ ...p })) } };
  const placed = layoutRmbBlock(block).models.find((p) => p.recordIndex === 1 && p.modelIdNum === HOUSE);
  const [door] = getStaticDoors(houseModel(), block.index, 1, placed.matrix);
  const entry = { door, dfBlock: block, recordIndex: 1, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
  const saved = {
    door: { blockIndex: door.blockIndex, recordIndex: 1, doorIndex: door.doorIndex, buildingKey: KEY },
    building: { buildingKey: KEY, buildingType, regionIndex: 17, quality: 4, factionId: 0, nameSeed: 0, townMapId: TOWN },
  };
  return { entry, saved };
}

/** THE MODE MACHINE over a stub host (AUDIT 68's rig, test/fb1004d_voidentry.test.js buildModes), online: the host's
 *  homes registry is `onlineHomes`. */
async function buildModes({ entry, onlineHomes = null }) {
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
  return quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline: pipeline(), townTalk: { say: noop },
    doorTargets: () => [entry], baseCollider: () => street,
    ...(onlineHomes ? { onlineHomes } : {}),
  }));
}

/** The client registry over the account service's own route, as the world builds it (world.js accountHomes). */
const registryOf = (svc, who) => createOnlineHomes({
  api: { town: async (mapId, character) => { const r = await svc.call('/v1/homes/town', { mapId, character }, who.secret); return { ok: r.status === 200, data: r.body }; } },
  character: () => who.character,
});
/** A guild of Gwen's that bought Warvale's house #1 as its hall, from its treasury (auditguild1d's stood). */
async function hallOfGwen() {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, mapId: TOWN, buildingKey: KEY, region: 17, price: 20_000, layout: null }, gm.secret)).status, 200);
  return { svc, gm };
}
/** Aldric's own home, Warvale's house #1, claimed on his realm record (accountDb's seatHome). */
async function homeOfAldric() {
  const svc = await standService();
  const aldric = await svc.registered('Aldric');
  const r = await svc.seatHome(aldric, { mapId: TOWN, buildingKey: KEY, region: 17, price: 20_000 });
  assert.equal(r.status, 200);
  aldric.character = r.character;
  return { svc, aldric };
}

const NOON = 12 * 60;
const MIDNIGHT = 0;
/** Who of the room's people stands. */
const standing = (modes) => modes.interiorCtx.people.map((p) => p.active);
/** THE REST WINDOW over the interior host's own deps, opened and shut (Esc, its ONE close door - restWindow.js _close):
 *  OnPop's UpdateNpcPresence at the sky's hour. */
function restAndRise(modes) {
  const w = new RestWindow(modes.restDeps());
  w.input('back');
  w.keyup('back');
  assert.equal(w.done, true, 'the window shut');
}
/** Into the room as a load made inside it does (restoreInterior, IS1), at `minutes` o'clock. */
async function inside(modes, saved, minutes) {
  setWorldMinutes(minutes);
  assert.equal(await quietly(() => modes.restoreInterior(saved, null)), true, 'the room stands and the player is in it');
  assert.equal(modes.mode, 'interior');
  assert.equal(modes.interiorCtx.people.length, RESIDENTS.length, 'the house\'s people, listed');
}

test('HALL-FOLK the guild\'s hall bought from its treasury, the service\'s own answer read by the client\'s registry: a member walks into a hall that stands none of the house\'s people, rests in it by day - and it STILL stands none (the re-roll stood them all back up; mutant: the re-roll unguarded)', async () => {
  const { svc, gm } = await hallOfGwen();
  const homes = registryOf(svc, gm);
  const { entry, saved } = warvale();
  const modes = await buildModes({ entry, onlineHomes: homes });
  await inside(modes, saved, NOON);
  const hall = homes.homeAt(TOWN, KEY);
  assert.equal(hall?.hall?.name, 'The Silver Hand', 'the service names the guild\'s hall');
  assert.equal(hall.member, true, 'and Gwen its member');
  assert.equal(hall.own, false, 'a hall is no character\'s own');
  assert.deepEqual(standing(modes), [false, false], 'the door\'s build: a home, anyone\'s - a hall among them - has no residents');
  restAndRise(modes);
  assert.deepEqual(standing(modes), [false, false], 'a rest by day brings none of them back');
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
});

test('HALL-FOLK the same re-roll in a home: a player\'s home - Aldric\'s own, claimed on his record - rested in by day keeps its residents out too (the bug was the home\'s as much as the hall\'s, in a House2-4)', async () => {
  const { svc, aldric } = await homeOfAldric();
  const homes = registryOf(svc, aldric);
  const { entry, saved } = warvale();
  const modes = await buildModes({ entry, onlineHomes: homes });
  await inside(modes, saved, NOON);
  assert.equal(homes.homeAt(TOWN, KEY)?.own, true, 'the service names Aldric\'s home his own');
  assert.deepEqual(standing(modes), [false, false]);
  restAndRise(modes);
  assert.deepEqual(standing(modes), [false, false], 'a rest by day brings none of them back');
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
});

test('HALL-FOLK the re-roll still stands what it always stood: a stranger\'s House2 entered at midnight (shut, its people hidden by the hours) and rested in by day takes its people back - DFU\'s UpdateNpcPresence, untouched (mutant: the re-roll refused everywhere)', async () => {
  const homes = createOnlineHomes({ api: { town: async () => ({ ok: true, data: { homes: [] } }) } });   // the town answered: nobody's home
  const { entry, saved } = warvale();
  const modes = await buildModes({ entry, onlineHomes: homes });
  await inside(modes, saved, MIDNIGHT);
  assert.equal(homes.homeAt(TOWN, KEY), null);
  assert.deepEqual(standing(modes), [false, false], 'a House2 is shut at midnight: AddPeople\'s hours arm');
  setWorldMinutes(NOON);
  restAndRise(modes);
  assert.deepEqual(standing(modes), [true, true], 'by day the re-roll stands them');
  await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
});

test('HALL-FOLK by source: the interior host\'s re-roll asks the build\'s own latches (the visit\'s home, the private room) before the law, and nothing else of the dep moved', () => {
  const dep = WM.slice(WM.indexOf('    updateNpcPresence: () => {'));
  const body = dep.slice(0, dep.indexOf('\n    },\n'));
  assert.match(body, /if \(!interiorBuilding \|\| !interiorCtx\) return;[\s\S]*?if \(interiorHome \|\| privateVisitRoom\) return;[\s\S]*?if \(!updateNpcPresence\(interiorBuilding\?\.buildingType/, 'the room first, then DFU\'s law');
  assert.match(WM, /interiorHome = home;   \/\/ HOME1: the visit's latch/, 'the latch is the build\'s own answer');
  assert.match(WM, /isHouseOwned: \(key\) => home !== null \|\| isHouseOwned\(/, 'the one the people gate read');
});
