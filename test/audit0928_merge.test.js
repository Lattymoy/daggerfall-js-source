// AUDIT PRE-MERGE 0928 (the merge lens, M1 and M4) - the Sea Update's merge with main (f2f3598ab) set two sides' laws
// beside each other that had never met.
// M1: There's a Hole in the Bottom of the Ocean's GameManager.OnEnemySpawn (OH-E) heard main's PUPPETS - a REST-SYNC
// joiner's copy of the host's rest encounter, a party member's own-lane foe - as this player's own spawns, and processed
// them here (a flame kind destroyed, a General kind replaced); and its replacement (ApplyEnemySettings, the body rebuilt
// through retypeFoe) stood the new body without the room's word, so a replaced shared encounter or summon left the room.
// M4: PEERLIGHT's others' torches and Light-spell candles burned at full in the drowned dungeon, where the abyss puts
// every torch out and halves the candle.
// Mounted, not matched: HEAD's own statements sliced out of dungeonContext.js, world.js and worldModes.js
// (test/restsync.test.js's harness) over the real createOceanHolesAbyss, entered through its pit as
// test/oh_abyss.test.js enters it; the art, the careers, the motor and the renderer are the only stubs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { MobileUnit } from '../src/characters/mobileUnit.js';
import { enemyHierarchyOrder } from '../src/characters/dungeonEnemies.js';
import { createOceanHolesAbyss } from '../src/scenes/oceanHolesAbyss.js';
import { mapPixelToLongitudeLatitude, mapPixelToWorldCoord, worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { enemyRoster } from '../src/world/underwaterEnemies.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ABYSS_MAGIC_LIGHT_SCALE } from '../src/world/oceanHoles.js';
import { withPlayerLights, CANDLE } from '../src/scenes/magicCandle.js';
import { peerTorchLight, torchPoseByte } from '../src/systems/playerTorch.js';
import { effectiveLevel } from '../src/systems/mentorMode.js';   // SOFTCAP2: the mentor's level the spawn sites read (a free name there, the module's own import)
import { applyChampion } from '../src/systems/champions.js';   // LOOT7: applyEliteScaling stands a layout champion (a free name there, the module's own import)
import { inFireWard } from '../src/world/dungeonFires.js';   // REST3: the spawn's ward (a free name there, the module's own import)
import { freeLodgedFeet } from '../src/characters/foeSpacing.js';   // FIELD BUGS 2026-10-04d CRATE-FREE: the build's stand (a free name there, the module's own import)
import { auraWingLights } from '../src/render/auraRing.js';   // SERAPH-WINGS: peerTorchLights' tail

function sliced(path) {
  const S = readFileSync(new URL(path, import.meta.url), 'utf8');
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const find = (pred) => {
    let hit = null;
    (function walk(n) {
      if (!n || typeof n.type !== 'string' || hit) return;
      if (pred(n)) { hit = n; return; }
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(AST);
    return hit;
  };
  const fnSrc = (name) => {
    const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
    assert.ok(n, `${path} has function ${name}`);
    return S.slice(n.start, n.end);
  };
  const declSrc = (name) => {
    const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
    assert.ok(n, `${path} declares ${name}`);
    return S.slice(n.start, n.end);
  };
  /** A name this source may or may not declare (a helper the fix adds): its text, or nothing. */
  const optional = (name) => (find((x) => (x.type === 'FunctionDeclaration' && x.id?.name === name) || (x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name))) ? (find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name) ? fnSrc(name) : declSrc(name)) : '');
  /** The value of the property `prop` of the object literal `decl` is initialised with. */
  const propSrc = (decl, prop) => {
    const d = find((x) => x.type === 'VariableDeclarator' && x.id?.name === decl);
    assert.ok(d, `${path} declares ${decl}`);
    const p = d.init.properties.find((q) => q.key?.name === prop);
    assert.ok(p, `${decl}.${prop}`);
    return S.slice(p.value.start, p.value.end);
  };
  /** The value of the one property named `prop` anywhere in the source (a host literal's hook). */
  const hookSrc = (prop) => {
    const n = find((x) => x.type === 'Property' && x.key?.name === prop);
    assert.ok(n, `${path} hands ${prop}`);
    return S.slice(n.value.start, n.value.end);
  };
  return { fnSrc, declSrc, optional, propSrc, hookSrc };
}
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : k === 'effectiveLevel' ? effectiveLevel : k === 'applyProgressionScalingTo' ? () => {} : k === 'applyChampion' ? applyChampion : globalThis[k])),   // SOFTCAP2: the host's own import; LOOT7: and the champion's
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const settle = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0)); };

const DC = sliced('../src/scenes/dungeonContext.js');
const FNS = ['fitMaxima', 'buildFoeAt', 'applySpawnAlliance', 'applyEliteScaling', 'eliteLootOpts', 'dropCandidate', 'freeCorpse', 'retypeFoe',
  '_spawnEncounter', 'standSharedPuppet', 'applySharedRecords', 'applyFoeRecord', 'setFoeDead', 'dropSharedFoe', 'foesFrame', 'roomRecord',
  'spawnLooseFoe', 'ownFrame', 'standOwnPuppet', 'applyOwnRecord', 'dropOwnPuppet'];
const DECLS = ['isRoomFoe', 'onlineRoom', 'questPoolOps', 'abyssFoeView', 'ENCOUNTER_PLACE_ATTEMPTS', 'GENDER_BIT', 'q2', 'q3', 'canStandFoe',
  'SHARED_FOES_MAX', 'KILLED_BY_MS', 'FOES_FRAME_SLACK', 'ownLoose', 'ownQuestTag', 'ownShare', 'questTouched', 'ownPupKey', 'ownHeirIsMe', 'ownHeirElse',
  'foeMaxOf', 'FOE_MAX_PER_FRAME', '_maxLeft'];   // THE MERGE: AUDIT SETS M1's own lane pays a foe's maximum through these
// AUDIT REST II F1 (RE-AIMED): the rest encounter's spot is one home now - encounterSpot, which _spawnEncounter calls
// and a joiner's ask reads too - so it joins the optional helpers below
const CTX_BODY = `
  ${DECLS.map(DC.declSrc).join('\n')}
  ${['isPuppetFoe', 'runByAnother', 'takeRoomPlace', 'encounterSpot'].map(DC.optional).join('\n')}
  ${FNS.map(DC.fnSrc).join('\n')}
  const abyss = ${DC.propSrc('api', 'abyss')};
  return { buildFoeAt, retypeFoe, _spawnEncounter, standSharedPuppet, applySharedRecords, foesFrame, isRoomFoe, spawnLooseFoe, ownLoose, ownFrame, standOwnPuppet, abyss };
`;

/** One dungeon context's foe half - HEAD's statements - over stubs for the art, the careers, the motor and the renderer. */
function context({ authority, self }) {
  let batchN = 0;
  const heard = [];
  const state = {
    console: { error: () => {}, warn: () => {}, info: () => {} },
    ENEMY_BASICS, MobileUnit, enemyHierarchyOrder, validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, CELL_FRAME_RECORDS_MAX,
    foes: [], _layoutFoes: 0, _layoutStood: true, _spawnUid: 0, _ctxDead: false, _authority: authority,
    _sharedSeq: 0, _sharedById: new Map(), _sharedPending: new Map(), _foesSeq: 0, _locationKey: 'dungeon:7',
    _ownSeq: 0, _ownFrameSeq: 0, _ownPups: new Map(), _ownPending: new Map(), _ownPendLoose: new Set(), _ownOwners: new Map(), _ownAdopted: new Map(),
    _retyping: new Set(), _lootSeen: new Set(), _lootAt: new Map(), flatGroups: new Map(), billboardBatches: [],
    lastPlayerFeet: [0, 0, 0], _motorYaw: 0, collider: {}, dfLocation: null, dungeon: { blocks: [] },
    opts: { selfId: () => self, questShare: () => null, onEnemySpawn: (rec) => { heard.push(rec); state.hook?.(rec); } },
    renderer: { createBillboardBatch: () => ({ id: ++batchN }), destroyBillboardBatch: () => {} },
    foeDeps: {
      floorLanding: (c, p) => [p[0], p[1] - 0.2, p[2]],
      loadMonsterCareer: async () => ({}),
      makeEnemyEntity: (t, b) => ({ health: 30, maxHealth: 30, items: [], team: b.team ?? null, level: 1 }),
      playerEntity: { level: 1, reflexes: 2 },
      EnemyAI: class { constructor(c, pos, yaw) { this.feet = [...pos]; this.yaw = yaw; this.target = null; } },
      EnhancedEnemyAI: class {},
      EnemyAttack: class {},
      ClassFile: class { load() {} get career() { return {}; } },
      fetchBytes: async () => new Uint8Array(0),
    },
    getTexture: async () => ({ getFrameCount: () => 1 }), idleSpriteHeight: () => 1.8, feetFromCentre: (p) => p,
    enemyControllerHeight: () => 1.8, waterSurfaceYAt: () => null, isActionDoor: () => false, hasBowAttack: () => false,
    getPref: () => false, enhancedNav: {}, liveStat: () => 50, spawnEnemyLoot: () => {}, asCandidate: (r) => r,
    assignFoeSpells: () => {}, registerFoeDoor: () => {}, damageFoe: () => {}, renownFoeCarry: () => {}, renownFoeRevived: () => {},
    renownFoeDied: () => {}, reportPlayerKill: () => {}, addCorpseFood: () => {}, stampWonWeapons: () => {}, spawnCorpse: (f) => { f.corpse = true; },
    playerEntity: {}, _wallNow: () => 1000, _sharedFoe: () => false, fightN: () => 1,
    placeFoeEnv: (o) => o, entityOccupancy: () => () => false, fieldOfView: () => 1.2, placeFoeFreely: () => ({ x: 6, y: 0, z: 6 }),
    inFireWard, dungeonFires: [],   // REST3: the spawn's ward (a free name there, the law's own import), no fire placed here
    freeLodgedFeet,   // FIELD BUGS 2026-10-04d CRATE-FREE: the build's stand - a collider with nothing to ask holds nobody
    sharedClockOn: () => false, ambushNight: () => false,   // AUDIT REST-PARTY C1/A1: the ward online's alone, and a night running told of the stand - free names there too
    performance: { now: () => 0 },
  };
  const api = mount(CTX_BODY, state);
  return { state, api, heard };
}

// ---- the real abyss, entered through its pit over a context's own seams ----
const PIT = { x: 392, y: 338 };
function templateAt(px, py) {
  const ll = mapPixelToLongitudeLatitude(px, py);
  return {
    loaded: true, hasDungeon: true, name: 'Template Crypt', regionIndex: 0, locationIndex: 0,
    mapTableData: { mapId: 5000, longitude: ll.x, latitude: ll.y, dungeonType: 6 },
    exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } },
    dungeon: { blocks: Array.from({ length: 3 }, (_, i) => ({ blockName: `B${i}.RDB`, waterLevel: 10000 })) },
  };
}
const WS = sliced('../src/scenes/world.js');
/** `seams(clone)` answers the live dungeon's abyss seams once CloneDungeon has handed its copy; world.js's own
 *  ohDungeonOf and onEnemySpawn stand between them and the mod. */
async function drowned(seams) {
  const template = templateAt(100, 100);
  const corner = mapPixelToWorldCoord(PIT.x, PIT.y);
  const gps = { x: corner.x + 20000, z: corner.y + 12000 };
  const P = { insideDungeon: false };
  let live = null, ctx = null;
  const modes = {
    get dungeonCtx() { return ctx; },
    async enterAbyss(clone) {
      ctx = { abyss: seams(clone) };
      live = W.ohDungeonOf(ctx);
      await ab.onDungeonSet(live);
      P.insideDungeon = true;
      ab.onDungeonEntered(live);
      return true;
    },
    dungeon: () => live,
    removeDungeonQuestResources: () => {},
  };
  const W = mount(`${WS.declSrc('ohDungeonOf')}\nconst onEnemySpawn = ${WS.hookSrc('onEnemySpawn')};\nreturn { ohDungeonOf, onEnemySpawn };`,
    { _ohDungeons: new Map(), modes, get ohAbyss() { return ab; } });
  const ab = createOceanHolesAbyss({
    settings: () => ({ dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    maps: { regionCount: 1, locationCount: () => 1, location: () => template },
    siteLinks: () => [], isMainStoryDungeon: () => false,
    gps: { worldX: () => gps.x, worldZ: () => gps.z, currentMapPixel: () => worldCoordToMapPixel(gps.x, gps.z), currentLocation: () => null },
    teleportToWorld: async (x, z) => { gps.x = x; gps.z = z; return true; },
    renameGps: () => {},
    player: {
      isInside: () => P.insideDungeon, isInsideDungeon: () => P.insideDungeon, isSwimming: () => true, anchor: () => null,
      teleportedIntoDungeon: () => false, isRespawning: () => false, loadInProgress: () => false,
      placeFeet: () => {}, placeCentreY: () => {}, clearFallingDamage: () => {},
    },
    modes,
    pitEntrance: (x, y) => (x === PIT.x && y === PIT.y && worldCoordToMapPixel(gps.x, gps.z).x === PIT.x ? { position: [555, -150.175, 588], topY: -150 } : null),
    oceanSurfaceY: (x, y) => (worldCoordToMapPixel(gps.x, gps.z).x === x && worldCoordToMapPixel(gps.x, gps.z).y === y ? 34 : null),
    pitPlacement: () => ({ x: 600, z: 610 }), terrainReady: () => true, hud: () => {},
    roster: () => enemyRoster(), nowSeconds: () => 0, waitFrame: () => Promise.resolve(),
  });
  assert.equal(await ab.tryEnterPit(PIT.x, PIT.y), true, 'down the pit');
  assert.equal(ab.isBoundAbyssDungeon(), true, 'the live dungeon is the abyss');
  return { ab, live: () => live, onEnemySpawn: W.onEnemySpawn };
}
/** A context in the bound abyss: its `abyss` seam is the api's own (dungeonContext.js), the flood and the lights stubbed. */
async function inTheAbyss({ authority, self }) {
  const c = context({ authority, self });
  const d = await drowned((clone) => {
    c.state.dfLocation = clone;
    return Object.assign(c.api.abyss, { startMarkerY: () => 10, maxMeshTopY: () => 30, setAllBlockWaterLevels() {}, setBlockWaterLevel() {}, removeLightFixtures() {} });
  });
  c.state.hook = (rec) => d.onEnemySpawn(rec);
  return { ...c, ...d };
}
const record = (over = {}) => ({ i: 1, t: MOBILE_TYPES.Rat, f: [6, 0, 6], y: 0, h: 30, d: 0, a: 0, m: 0, g: '', c: 0, s: 0, ...over });

test('AUDIT PRE-MERGE 0928 M1: the host\'s rest encounter the abyss replaces stays the room\'s - the new body takes the room\'s number, the room\'s map holds it, and the full frame carries it as its new species', async () => {
  const h = await inTheAbyss({ authority: true, self: 'host' });
  h.state._spawnUid = 0;   // its LoadID 1: at this pit the mod makes a Rat a Dreugh (EnemyHash, TryPickUnderwaterEnemy)
  const stood = await h.api._spawnEncounter({ mobileType: MOBILE_TYPES.Rat, minDistance: 4, maxDistance: 10, lineOfSightCheck: false }, { shared: true });
  await settle();
  const live = h.state.foes[h.state.foes.length - 1];
  assert.equal(live.mobileType, MOBILE_TYPES.Dreugh, 'the premise: the abyss replaced the encounter (ApplyEnemySettings)');
  assert.notEqual(live, stood, 'rebuilt as a new body');
  assert.equal(live._encId, stood._encId, 'the new body keeps the room\'s number');
  assert.equal(h.api.isRoomFoe(live), true, 'a room foe - it hunts every player there');
  assert.equal(h.state._sharedById.get(live._encId), live, 'the room\'s map holds the live body, not the dead one');
  const frame = h.api.foesFrame(true);
  assert.deepEqual(frame.x?.map((r) => [r.i, r.t, r.d]), [[live._encId, MOBILE_TYPES.Dreugh, 0]], 'and every joiner hears it, as its new species');
  assert.equal(frame.xf, 1);
});

test('AUDIT PRE-MERGE 0928 M1: a joiner\'s copy of the host\'s encounter is the host\'s - no OnEnemySpawn and no LoadID of mine, never replaced or destroyed here (a Fire Atronach stands whole), the host\'s records land on the body drawn, and the host\'s new species by that number stands anew', async () => {
  const j = await inTheAbyss({ authority: false, self: 'joiner' });
  j.state._spawnUid = 0;   // were it mine, its LoadID 1 would make it a Dreugh here
  j.api.applySharedRecords([record()], true);
  await settle();
  const pup = j.state._sharedById.get(1);
  assert.ok(pup && j.state.foes.includes(pup), 'the puppet is the body drawn');
  assert.equal(pup.mobileType, MOBILE_TYPES.Rat, 'the host\'s species - my abyss replaced nothing');
  assert.equal(j.heard.length, 0, 'a puppet is no spawn of mine: OnEnemySpawn heard nothing');
  assert.equal(pup.src.loadID, undefined, 'and it took no LoadID of mine');
  assert.ok(!pup.dead, 'alive');
  j.api.applySharedRecords([record({ f: [9, 0, 9], h: 12 })], true);
  assert.deepEqual([pup._pup.feet, pup.entity.health], [[9, 0, 9], 12], 'the host\'s next record lands on it');
  // the host's abyss replaced its encounter: the same number, another species - stood anew as the host's
  j.api.applySharedRecords([record({ t: MOBILE_TYPES.Dreugh })], true);
  await settle();
  const again = j.state._sharedById.get(1);
  assert.ok(again && again !== pup && j.state.foes.includes(again) && !j.state.foes.includes(pup), 'another species by that number: the old puppet goes, a new one stands');
  assert.equal(again.mobileType, MOBILE_TYPES.Dreugh);
  // a flame kind the host streams (its own abyss did not destroy it): mine does not either - it stands whole
  const k = await inTheAbyss({ authority: false, self: 'joiner' });
  k.api.applySharedRecords([record({ t: MOBILE_TYPES.FireAtronach })], true);
  await settle();
  const fire = k.state._sharedById.get(1);
  assert.ok(fire && k.state.foes.includes(fire), 'the host\'s Fire Atronach stands here');
  assert.equal(!!fire.abyssDestroyed, false, 'not Object.Destroy\'d by my abyss');
  assert.ok(!fire.dead, 'alive');
  assert.ok(fire.batch, 'and it keeps its batch - no live foe without one for drawFoes\' `f.batch.conceal`');
});

test('AUDIT PRE-MERGE 0928 M1: a party member\'s own-lane foe stood here is theirs - no OnEnemySpawn of mine, not replaced (their own abyss already had it)', async () => {
  const j = await inTheAbyss({ authority: false, self: 'joiner' });
  j.state._spawnUid = 0;
  j.state._ownOwners.set('aaa', { n: 1, at: 0, gen: 1 });
  const r = record({ t: MOBILE_TYPES.Rat });
  j.state._ownPending.set('aaa:1', r);
  const pup = await j.api.standOwnPuppet('aaa', r, null, 1, true);
  await settle();
  assert.ok(pup && j.state.foes.includes(pup) && j.state._ownPups.get('aaa:1') === pup, 'their loose stand stands here as their puppet');
  assert.equal(pup.mobileType, MOBILE_TYPES.Rat, 'as their species');
  assert.equal(j.heard.length, 0, 'no spawn of mine');
  // their Fire Atronach too; and no pass of my abyss reaches either later (the quota after a spawn of mine, a prepare):
  // they are theirs, whoever holds the seat
  const r2 = record({ i: 2, t: MOBILE_TYPES.FireAtronach });
  j.state._ownPending.set('aaa:2', r2);
  const fire = await j.api.standOwnPuppet('aaa', r2, null, 1, true);
  await settle();
  assert.ok(fire && j.state.foes.includes(fire) && !fire.dead && fire.batch, 'their Fire Atronach stands here whole');
  j.state._authority = true;
  const d = j.live();
  assert.equal(d.foes().some((v) => v.rec === pup || v.rec === fire), false, 'neither among the living my abyss reads');
  j.ab.processAbyssEnemy(d, d.foeView(fire), true);
  assert.equal(!!fire.abyssDestroyed, false, 'nor destroyed when handed to it');
  assert.ok(!fire.dead && fire.batch);
});

test('AUDIT PRE-MERGE 0928 M1: my summon the abyss replaces is still a loose stand - the room\'s own lane carries the new body, under the number it already had', async () => {
  const o = await inTheAbyss({ authority: true, self: 'owner' });
  o.state._spawnUid = 0;   // LoadID 1: a Rat is made a Dreugh here
  const stood = await o.api.spawnLooseFoe(MOBILE_TYPES.Rat, [6, 0, 6], { allied: true });
  await settle();
  const live = o.state.foes[o.state.foes.length - 1];
  assert.equal(live.mobileType, MOBILE_TYPES.Dreugh, 'the premise: replaced');
  assert.notEqual(live, stood);
  assert.equal(o.api.ownLoose(live), true, 'still a loose stand (SUMMON-SYNC)');
  assert.equal(live.entity.team, 'PlayerAlly', 'and still an ally (AUDIT OH-F C4)');
  const frame = o.api.ownFrame(true);
  assert.deepEqual(frame?.f.map((r) => r.t), [MOBILE_TYPES.Dreugh], 'the own lane carries it');
  assert.deepEqual(frame.lf, [frame.f[0].i], 'as a loose stand');
  // numbered on the lane before the mod replaced it (a summon stood before the abyss held the dungeon - a Recall's
  // reactivation - streamed a while, then the quota took it): the same number after
  const p = await inTheAbyss({ authority: true, self: 'owner' });
  p.state._layoutStood = false;   // stood unheard by the mod
  const mine = await p.api.spawnLooseFoe(MOBILE_TYPES.Rat, [6, 0, 6], { allied: true });
  p.state._layoutStood = true;
  await settle();
  assert.equal(p.state.foes[p.state.foes.length - 1], mine, 'the premise: untouched so far');
  const n = p.api.ownFrame(true).f[0].i;
  const d = p.live();
  d.replaceFoe(d.foeView(mine), MOBILE_TYPES.Dreugh);   // ApplyEnemySettings, as the quota's pass makes it
  await d.settle();
  const now = p.state.foes[p.state.foes.length - 1];
  assert.equal(now.mobileType, MOBILE_TYPES.Dreugh);
  assert.deepEqual(p.api.ownFrame(true).f.map((r) => [r.i, r.t]), [[n, MOBILE_TYPES.Dreugh]], 'the room hears the same number, the new species (their copies stand it anew)');
});

test('AUDIT PRE-MERGE 0928 M1: under another\'s seat the abyss leaves the room\'s foes to their runner - the living it reads omit them, its destroy and its replacement refuse them (no Object.Destroy flag on a live foe), and my own it still processes', async () => {
  const j = await inTheAbyss({ authority: true, self: 'joiner' });
  // two of the layout's foes, built before the flag rises (the layout loop), each with the layout's LoadID
  j.state._layoutStood = false;
  const fire = await j.api.buildFoeAt({ mobileType: MOBILE_TYPES.FireAtronach, gender: 'male', x: 3, y: 0, z: 3, spawnDistanceType: 0, loadID: 7 }, false);
  const rat = await j.api.buildFoeAt({ mobileType: MOBILE_TYPES.Rat, gender: 'male', x: 4, y: 0, z: 4, spawnDistanceType: 0, loadID: 1 }, false);
  j.state._layoutStood = true;
  j.state._layoutFoes = j.state.foes.length;
  j.state._authority = false;   // the seat is another's (worldModes.js setAuthority) - a Recall's reactivation, a load's prepare
  const d = j.live();
  assert.deepEqual(d.foes().map((v) => v.rec), [], 'the living the mod reads are this player\'s alone');
  j.ab.processAbyssEnemy(d, d.foeView(fire), true);
  j.ab.processAbyssEnemy(d, d.foeView(rat), true, true);   // the quota's own pass (EnsureAquaticEnemyQuota's aquatic arm)
  assert.equal(!!fire.abyssDestroyed, false, 'no Object.Destroy flag on the host\'s live foe');
  assert.ok(!fire.dead, 'alive');
  assert.ok(fire.batch, 'its batch kept');
  assert.equal(rat.retypedTo, undefined, 'and no replacement of it');
  // my own spawn is still the mod's to process
  const mine = await j.api.spawnLooseFoe(MOBILE_TYPES.FireAtronach, [5, 0, 5], {});
  assert.equal(mine.abyssDestroyed, true, 'my own flame foe is destroyed, as DFU destroys it');
  assert.equal(mine.dead, true);
});

// ---- M4 ----
const MS = sliced('../src/scenes/worldModes.js');
/** world.js's peerTorchLights and its host hook, and worldModes' dungeon light list - HEAD's statements - for one peer
 *  holding a lit torch whose Light spell also burns, under the abyss's presentation or none. */
function dungeonLights(abyss) {
  const pose = { x: 10, y: 0, z: 4, yaw: 0, lt: torchPoseByte({ _torch: { range: 8 }, lightSource: { templateIndex: 247, currentCondition: 1000 } }) };
  const candle = { x: 11, y: 1.6, z: 5, range: CANDLE.range, carried: true };   // the peer's candle, as hostMagic.peerCandles hands it
  const world = mount(`
    ${WS.declSrc('PEER_LIGHTS_MAX')}
    ${WS.declSrc('_peerLights')}
    ${WS.declSrc('_peerLightPhase')}
    ${WS.declSrc('peerTorchLights')}
    return { peerLights: ${WS.hookSrc('peerLights')} };
  `, {
    online: { peers: new Map([['p1', { id: 'p1', shown: pose }]]), visible: () => true },
    cam: { pos: [8, 1.7, 4], yaw: 0 }, onlineToScene: (s) => [s.x, s.y, s.z], peerTorchLight, _peerCandleLights: [candle],
    performance: { now: () => 0 },
    auraWingLights, _auraWearers: [], _auraLights: [],   // SERAPH-WINGS: the list's tail - no wings worn here
  });
  const dgColor = new Float32Array([0.8, 0.6, 0.4]);
  const lit = mount(`
    ${MS.declSrc('abyssCandle')}
    ${MS.declSrc('_dgTint')}
    ${MS.declSrc('_dgLit')}
    return _dgLit;
  `, {
    withPlayerLights, _dgNear: { data: new Float32Array(0), colors: new Float32Array(0) }, _dgColor: dgColor, _abyss: abyss,
    dungeonCtx: { candleLight: () => null, campLights: () => [], torchLights: () => [] },
    playerTorchLight: () => null, thunderlockMuzzleLight: () => null, playerEntity: {}, player: { feetAt: () => [8, 0, 4] }, cam: { pos: [8, 1.7, 4], yaw: 0 },
    host: { peerLights: world.peerLights, modeLights: () => [] },
  });
  const lights = [];
  for (let i = 0; i < lit.data.length / 4; i++) lights.push({ at: [lit.data[i * 4], lit.data[i * 4 + 1], lit.data[i * 4 + 2]], range: lit.data[i * 4 + 3], color: [...lit.colors.slice(i * 3, i * 3 + 3)] });
  return { lights, torch: peerTorchLight(pose, [pose.x, pose.y, pose.z]), candle, dgColor };
}

test('AUDIT PRE-MERGE 0928 M4: in the drowned dungeon the others\' torches burn nowhere and their candles at half, as mine do (SuppressAbyssLights) - world.js\'s peerTorchLights through the host\'s hook into worldModes\' dungeon list; outside the abyss they burn as they did', async () => {
  const d = await drowned((clone) => ({
    location: () => ({ regionIndex: clone.regionIndex, locationIndex: clone.locationIndex }), summaryName: () => clone.name, summaryId: () => clone.mapTableData.mapId,
    rename(n, id) { clone.name = n; clone.mapTableData = { ...clone.mapTableData, mapId: id }; },
    startMarkerY: () => 10, maxMeshTopY: () => 30, originY: () => 0, setAllBlockWaterLevels() {}, setBlockWaterLevel() {},
    foes: () => [], foeView: (r) => r, destroyFoe() {}, replaceFoe() {}, settle: () => Promise.resolve(), removeQuestFoes() {}, removeLightFixtures() {},
  }));
  const abyss = d.ab.presentation({ fogColor: [0.1, 0.2, 0.3, 1], dungeonAmbient: [0.2, 0.2, 0.2, 1] }, 1);
  assert.equal(abyss.torchOff, true, 'the producer\'s word: every torch out');
  assert.equal(abyss.magicLightScale, ABYSS_MAGIC_LIGHT_SCALE);
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const dry = dungeonLights(null);
  assert.ok(dry.lights.some((l) => near(l.at, [dry.torch.x, dry.torch.y, dry.torch.z])), 'dry: the peer\'s torch lights the dungeon');
  const dryCandle = dry.lights.find((l) => near(l.at, [dry.candle.x, dry.candle.y, dry.candle.z]));
  assert.ok(dryCandle && Math.abs(dryCandle.range - CANDLE.range) < 1e-6, 'dry: the peer\'s candle at its own range');
  assert.ok(near(dryCandle.color, [...dry.dgColor]), '...in the dungeon\'s colour, as PEERLIGHT1 tints it');
  const wet = dungeonLights(abyss);
  assert.equal(wet.lights.some((l) => near(l.at, [wet.torch.x, wet.torch.y, wet.torch.z])), false, 'the abyss: no peer\'s torch burns');
  const wetCandle = wet.lights.find((l) => near(l.at, [wet.candle.x, wet.candle.y, wet.candle.z]));
  assert.ok(wetCandle, 'their candle still burns');
  assert.ok(Math.abs(wetCandle.range - CANDLE.range * ABYSS_MAGIC_LIGHT_SCALE) < 1e-6, 'at half its range');
  assert.ok(near(wetCandle.color, [...wet.dgColor].map((c) => c * ABYSS_MAGIC_LIGHT_SCALE)), 'and half its intensity');
});
