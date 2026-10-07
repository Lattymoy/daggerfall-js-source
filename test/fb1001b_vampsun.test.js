// FB1001b - VAMP-SUN (FIELD BUGS 2026-10-01b, 2026-10-01; Mac: "Sunlight debuff applies in interior (Should be buffed
// in interiors) (Vampires)"). VAMP-DAY (2026-09-26) traded the vampire's sun burn for 20 off seven stats by day and keyed
// it on the HOUR alone - "wherever the vampire stands" (vampirism.js vampireStatMod read isDayFromMinutes) - so at noon a
// vampire in a tavern or a crypt was 20 DOWN where Daggerfall Unity gives him 20 up. DFU's sun reaches the street and
// nothing else: DamageFromSunlight (PassiveSpecialsEffect.cs:149-172) strikes only `if (IsPlayerInSunlight)` (:168),
// which is `IsDay && !IsPlayerInside && !PlayerEntity.InPrison` (PlayerEnterExit.cs:371), IsPlayerInside raised by a
// building's EnableInteriorParent (:1086) and a dungeon's EnableDungeonParent (:1110); out of it a vampire has
// ApplyVampireAdvantages' +20 (VampirismEffect.cs:349-359) at every hour. The -20 now asks that same flag through the
// seam every host registers (passiveSpecials.js playerInSunlight). Over the real modules: the player singleton cursed by
// createVampirismCurse, its minutes through the hosts' own ticker (scenes/shared.js createPlayerTicker -> worldTick's
// round); THE FOUR HOSTS - world.js's street and exterior.js both build the mode machine (worldModes), which answers the
// street and its buildings, and is walked here into a real tavern through its own entry; a dungeon, a town's crypt under
// worldModes or the ?dungeon scene, answers through dungeonContext's own registration, lifted from src/ and run
// (audit26_dungeonfoes' law: the statements are the ones in src/). Each pin failed on the code before the fix.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVampirismCurse, VAMPIRE_STATS, VAMPIRE_STAT_MOD, VAMPIRE_SKILL_MOD } from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../src/systems/infection.js';
import { setPassiveSpecialsHost, playerInSunlight } from '../src/systems/passiveSpecials.js';
import { setWorldMinutes, worldMinutes, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import { liveStat } from '../src/systems/statMods.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DAY = 400;   // a classic day number, far from the start
const at = (hour, minute = 0) => DAY * MINUTES_PER_DAY + hour * 60 + minute;
const STATS = { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 };
/** The seven stats ApplyVampireAdvantages sets (VampirismEffect.cs:353-359), each at `mod`. */
const seven = (mod) => Object.fromEntries(VAMPIRE_STATS.map((s) => [s, mod]));
const statsOf = (v) => Object.fromEntries(VAMPIRE_STATS.map((s) => [s, v.racialOverride.statMods[s]]));

/** Quiet while the stand-in world warns of the ARENA2 it has not got. */
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}

/** THE PLAYER - the singleton every host ticks - cursed by the producer, VampirismEffect.Start's port. */
async function vampire(clan = VAMPIRE_CLANS.Lyrezi) {
  Object.assign(playerEntity, {
    stats: { ...STATS }, activeEffects: [], spells: [], racialOverride: null, inPrison: false,
    health: 100, maxHealth: 100, lastGameMinutes: at(11),
  });
  delete playerEntity.racialOverridePending;
  await quietly(() => createVampirismCurse(playerEntity, clan, { now: at(11) }));
  assert.ok(playerEntity.racialOverride?.sunDamage, 'the curse is the producer\'s, its sun flag minted');
  return playerEntity;
}

/** One classic minute from `minute`, through the hosts' own ticker (world.js, exterior.js and worldModes build it;
 *  the dungeon calls the same tickPlayerMinutes) - one magic round, the curse's MagicRound among its laws. */
function liveMinute(entity, minute) {
  setWorldMinutes(minute); resetMagicRoundMarker(minute); entity.lastGameMinutes = minute;
  createPlayerTicker(entity, {}).advance(1);
  assert.equal(Math.floor(worldMinutes()), minute + 1, 'one minute ran');
  return statsOf(entity);
}

/** THE MODE MACHINE over a stub host - AUDIT 68's own rig (test/audit68_worldmodes.test.js buildModes). Building it
 *  registers its sunlight seam (worldModes' setPassiveSpecialsHost), as both town pages' boots do. */
async function buildModes(overrides = {}) {
  const noop = () => {};
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
  const player = { pos: [0, 0, 0], eye: [0, 1.6, 0], height: 1.8, eyeAt: () => [0, 1.6, 0], feetAt: () => [0, 0, 0], spawn: noop, collider: null };
  return quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam: { yaw: 0, pitch: 0, pos: [0, 1.6, 0] }, keys: new Set(), latch: { edge: deep() },
    blocks: null,
    pipeline: { getGpuMesh: async () => null, cpuModels: new Map(), getTexture: async () => null, uploadRecord: noop, uploadRecordFrame: noop, arch: null, palette: null, getMachineryParts: noop },
    doorTargets: () => [], baseCollider: () => ({ raycast: () => Infinity, heightAt: () => 0 }),
    ...overrides,
  }));
}

/** A tavern's door as the layout mints it (GetStaticDoors), its interior one RMB record with an Enter marker
 *  (editor flat 199.8) the landing stands on, and the save's identity for it - the entry restoreInterior takes. */
function tavern() {
  const matrix = new Float32Array(16); matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
  const [door] = getStaticDoors({ doors: [{ type: 0, index: 0, vert0: { x: -0.5, y: 0, z: 0 }, vert2: { x: 0.5, y: 2, z: 0.2 }, normal: { x: 0, y: 0, z: 1 } }] }, 7, 2, matrix);
  const interior = {
    header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 42, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [{ textureArchive: 199, textureRecord: 8, xPos: 0, yPos: 0, zPos: 100 }],
    blockDoorRecords: [], blockPeopleRecords: [], blockSection3Records: [],
  };
  const dfBlock = { index: 7, name: 'TVRNAL01.RMB', rmbBlock: { subRecords: [{}, {}, { interior }] } };
  const entry = { door, dfBlock, recordIndex: 2, climateBase: 0, season: 0, dfLocation: null, group: 'g' };
  const saved = {
    door: { blockIndex: door.blockIndex, recordIndex: door.recordIndex, doorIndex: door.doorIndex, buildingKey: 7 },
    building: { buildingKey: 7, buildingType: BUILDING_TYPES.Tavern, regionIndex: 0, quality: 10, factionId: 0, nameSeed: 1 },
  };
  // FIELD BUGS 2026-10-04d VOID-ENTRY: its one model is its floor - the law lands a player only where a floor stands, and
  // refuses a room with none (this record's model was not in the stub's ARCH3D: a room of nothing)
  const floor = { modelIdNum: 42, positions: new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [], doors: [] };
  const cpuModels = new Map();
  const pipeline = { getGpuMesh: async (id) => (id === 42 ? (cpuModels.set(42, floor), { id }) : null), cpuModels, getTexture: async () => null, uploadRecord: () => {}, uploadRecordFrame: () => {}, arch: null, palette: null, getMachineryParts: () => {} };
  return { entry, saved, pipeline };
}

// ── dungeonContext's own statements, mounted ─────────────────────────────────────────────────────────────────────
const DC = read('src/scenes/dungeonContext.js');
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i + head.length);
  assert.ok(j > i, 'and it ends');
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

test('FB1001b: the vampire\'s day is the SUN\'s - IsPlayerInSunlight\'s three terms through the seam: 20 down in the street at noon; under a roof, in a cell or by night DFU\'s +20 (ApplyVampireAdvantages), the skills\' +30 throughout', async () => {
  const where = { inside: false, prison: false };
  const prev = setPassiveSpecialsHost({ isInside: () => where.inside, inPrison: () => where.prison });
  try {
    const v = await vampire();
    assert.deepEqual(liveMinute(v, at(12)), seven(-VAMPIRE_STAT_MOD), 'the street at noon: VAMP-DAY\'s -20 stands, in the sun');
    assert.equal(liveStat(v, 'strength'), 40);
    where.inside = true;   // PlayerEnterExit.IsPlayerInside - a building or a dungeon
    assert.equal(playerInSunlight(at(12)), false, 'no sun under a roof');
    assert.deepEqual(liveMinute(v, at(12)), seven(VAMPIRE_STAT_MOD), 'under a roof at noon: DFU\'s +20');
    assert.equal(liveStat(v, 'strength'), 80, 'buffed, as DFU has him at every hour');
    assert.deepEqual(liveMinute(v, at(16, 30)), seven(VAMPIRE_STAT_MOD), 'all afternoon');
    where.inside = false; where.prison = true;   // PlayerEntity.InPrison
    assert.deepEqual(liveMinute(v, at(12)), seven(VAMPIRE_STAT_MOD), 'in a cell at noon');
    where.prison = false;
    assert.deepEqual(liveMinute(v, at(22)), seven(VAMPIRE_STAT_MOD), 'the street by night');
    assert.deepEqual(liveMinute(v, at(7)), seven(-VAMPIRE_STAT_MOD), 'the street the next morning: the sun\'s again');
    for (const k of Object.keys(v.racialOverride.skillMods)) assert.equal(v.racialOverride.skillMods[k], VAMPIRE_SKILL_MOD, 'the skills are the curse\'s, sun or none');
    // an Anthotis mind is one of the curse's stats too (VampirismEffect.cs:371-372)
    const a = await vampire(VAMPIRE_CLANS.Anthotis);
    where.inside = true;
    liveMinute(a, at(12));
    assert.equal(a.racialOverride.statMods.intelligence, VAMPIRE_STAT_MOD, 'an Anthotis indoors at noon: the mind\'s +20');
    where.inside = false;
    liveMinute(a, at(12));
    assert.equal(a.racialOverride.statMods.intelligence, -VAMPIRE_STAT_MOD, 'and dimmed with the rest in the sun');
  } finally { setPassiveSpecialsHost(prev); }
});

test('FB1001b: a BUILDING - the mode machine world.js\'s street and exterior.js both build (worldModes) takes the vampire into a tavern at noon: DFU\'s +20 inside, the sun\'s -20 back in the street, DFU\'s +20 in a cell', async () => {
  const prev = setPassiveSpecialsHost(null);
  try {
    const v = await vampire();
    const { entry, saved, pipeline } = tavern();
    const modes = await buildModes({ doorTargets: () => [entry], pipeline });
    assert.equal(modes.mode, 'exterior');
    assert.deepEqual(liveMinute(v, at(12)), seven(-VAMPIRE_STAT_MOD), 'the street at noon (the mode machine\'s own answer)');
    assert.equal(await quietly(() => modes.restoreInterior(saved, [0, 0, 0])), true, 'the tavern stands and the player is in it');
    assert.equal(modes.mode, 'interior');
    assert.equal(modes.interiorBuilding?.buildingType, BUILDING_TYPES.Tavern);
    assert.deepEqual(liveMinute(v, at(12)), seven(VAMPIRE_STAT_MOD), 'in the tavern at noon: DFU\'s +20 - the code before read -20 here');
    assert.equal(liveStat(v, 'strength'), 80);
    assert.deepEqual(liveMinute(v, at(23)), seven(VAMPIRE_STAT_MOD), 'and by night, as ever');
    await quietly(() => modes.forceExitToExterior({ cacheScene: false }));
    assert.equal(modes.mode, 'exterior', 'out through the mode machine\'s own exit');
    assert.deepEqual(liveMinute(v, at(12)), seven(-VAMPIRE_STAT_MOD), 'back in the street at noon: the sun\'s -20');
    playerEntity.inPrison = true;   // worldModes' inPrison member reads the same singleton
    assert.deepEqual(liveMinute(v, at(12)), seven(VAMPIRE_STAT_MOD), 'a cell: no sun reaches it');
  } finally { playerEntity.inPrison = false; setPassiveSpecialsHost(prev); }
});

test('FB1001b: a DUNGEON - dungeonContext\'s own registration (a town\'s crypt over worldModes, and the ?dungeon scene), lifted from src/ and run: DFU\'s +20 underground at noon; its destroy() hands the street back, and the sun\'s -20 with it', async () => {
  const prev = setPassiveSpecialsHost(null);
  try {
    const v = await vampire();
    const modes = await buildModes();   // the town page's mode machine, standing in its street
    assert.equal(modes.mode, 'exterior');
    assert.deepEqual(liveMinute(v, at(12)), seven(-VAMPIRE_STAT_MOD), 'the street at noon');
    // buildDungeonContext's own statement, as worldModes' dungeon branch and the ?dungeon scene run it
    const head = 'const _prevPassiveHost = setPassiveSpecialsHost({';
    assert.ok(DC.indexOf('export async function buildDungeonContext(') < DC.indexOf(head), 'the registration is the context build\'s');
    const street = mount({ setPassiveSpecialsHost, worldMinutes, _activity: { swimming: false } }, cut(DC, head, '});'), '_prevPassiveHost');
    assert.ok(street && typeof street.isInside === 'function', 'it displaced the mode machine\'s registration and kept it');
    assert.deepEqual(liveMinute(v, at(12)), seven(VAMPIRE_STAT_MOD), 'in the crypt at noon: DFU\'s +20 - the code before read -20 here');
    assert.equal(liveStat(v, 'agility'), 80);
    assert.deepEqual(liveMinute(v, at(3)), seven(VAMPIRE_STAT_MOD), 'and by night');
    // destroy()'s hand-back, the statement in src/
    mount({ setPassiveSpecialsHost, _prevPassiveHost: street }, cut(DC, 'setPassiveSpecialsHost(_prevPassiveHost)', ';'), 'true');
    assert.deepEqual(liveMinute(v, at(12)), seven(-VAMPIRE_STAT_MOD), 'out of the crypt at noon: the street\'s sun again');
  } finally { setPassiveSpecialsHost(prev); }
});

test('FB1001b: ONE sun - the curse\'s -20 asks passiveSpecials.js playerInSunlight (PlayerEnterExit.IsPlayerInSunlight\'s one port) and keeps no hour of its own; THE FOUR HOSTS answer it', () => {
  const src = read('src/systems/vampirism.js');
  assert.match(src, /^import \{ playerInSunlight, careerSunAverse \} from '\.\/passiveSpecials\.js';/m, 'the seam\'s reader, imported');   // PIN MOVED (HOOD-CAREER): beside the career's hooded rung
  const law = src.slice(src.indexOf('export const vampireStatMod'), src.indexOf('\n', src.indexOf('export const vampireStatMod')));
  assert.equal(law, 'export const vampireStatMod = (clockMinutes, sunAverse = true) => (sunAverse && playerInSunlight(clockMinutes) ? -VAMPIRE_STAT_MOD : VAMPIRE_STAT_MOD);   // HOOD-SUN: a raised hood (racialSunAverse false) keeps the sun off',   // PIN MOVED (HOOD-SUN): the hood's arm
    'the day\'s -20 is the sun\'s, the +20 DFU\'s everywhere else - never the hour alone');
  // world.js's street and exterior.js are served by the mode machine each builds; it and the dungeon context register
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(host), /createWorldModes\(\{/, `${host} builds the mode machine`);
  const wm = read('src/scenes/worldModes.js');
  const reg = cut(wm, 'setPassiveSpecialsHost({', '});');
  assert.match(reg, /isInside: \(\) => mode !== 'exterior',/, 'worldModes: a building and a town dungeon are inside, by live mode');
  assert.match(reg, /inPrison: \(\) => !!playerEntity\.inPrison,/, 'and a cell is out of the sun');
  assert.match(cut(DC, 'const _prevPassiveHost = setPassiveSpecialsHost({', '});'), /isInside: \(\) => true,/, 'dungeonContext: always inside');
});
