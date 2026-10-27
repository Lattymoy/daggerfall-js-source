// RPT1026-PROGRESS (a private report, 2026-10-26: the Skull's copies were looted like any foe), the online half. Online in
// a dungeon an artifact's summon is its player's loose stand (SUMMON-SYNC): it rides the room's own lane and every other
// player in the room stands it as a puppet built on their own machine - and that build rolled its kind's loot there, its
// death there its kit, food and card. The summoner's own body was bare (SUMMON-BARE) and a friend's copy of it was not.
// The owner's frame names its summons (`sm`), and a reader's puppet of one is bare (systems/foeLootCap.js summonedWord,
// summonedRecord, markSummoned). Mounted, not matched: HEAD's own statements sliced out of dungeonContext.js - the
// own lane's frame and its reader, the puppet's stand and record, the build (its loot roll the real spawnEnemyLoot)
// and the stream's death (the real kit, food, card and cap) - test/characters/audit0928_merge.test.js's harness, over
// stubs for the art, the careers, the motor and the renderer. The summon is stood through the one enchant ctx's
// allied door (scenes/hostEnchant.js createEnchantCtx spawnAlliedFoe) over the host's own loose stand.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, CELL_FRAME_RECORDS_MAX, CELL_LOOSE_PUPPETS } from '../../src/net/wire.js';
import { ENEMY_BASICS, enemyEntityType, isClassEnemyId } from '../../src/characters/enemy/enemyBasics.js';
import { MobileUnit } from '../../src/characters/mobile/mobileUnit.js';
import { enemyHierarchyOrder } from '../../src/characters/dungeonEnemies.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { effectiveLevel } from '../../src/systems/mentorMode.js';
import { applyChampion } from '../../src/systems/champions.js';
import { inFireWard } from '../../src/world/dungeon/dungeonFires.js';
import { freeLodgedFeet } from '../../src/characters/foeSpacing.js';
import { foeSeed, applyWireLook } from '../../src/characters/foeBodies.js';
import { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame } from '../../src/scenes/foeTraitsHost.js';
import { bossClockS } from '../../src/systems/bossTraits.js';
import { partyOnlyQuestShare } from '../../src/scenes/quest/questFoeHost.js';
import { ROOM_LOOT_OFF } from '../roomLootOff.mjs';
import { setupFoeLook } from '../../src/characters/enemy/foeLook.js';
import { appliedOwnerTm } from '../../src/net/ownerClock.js';
import { validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX, validLooseSeqs, companionNames, PEER_REVENANT_PUPPETS_MAX } from '../../src/scenes/exteriorFoes.js';
import { spawnEnemyLoot } from '../../src/scenes/hostCombat.js';
import { rollCorpseKit, capFoeLoot, summonedWord, summonedRecord, markSummoned } from '../../src/systems/foeLootCap.js';
import { addCorpseFood } from '../../src/systems/survival/loot.js';
import { dropFoeCard } from '../../src/systems/card/cardSources.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';

const TRAIT_DOORS = { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame, bossClockS };
const S = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => {
  const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
  assert.ok(n, `dungeonContext.js has function ${name}`);
  return S.slice(n.start, n.end);
};
const declSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
  assert.ok(n, `dungeonContext.js declares ${name}`);
  return S.slice(n.start, n.end);
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : k === 'effectiveLevel' ? effectiveLevel : k === 'applyProgressionScalingTo' ? () => {} : k === 'applyChampion' ? applyChampion : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const settle = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0)); };

const FNS = ['fitMaxima', 'buildFoeAt', 'applySpawnAlliance', 'applyEliteScaling', 'eliteLootOpts', 'dropCandidate', 'freeCorpse', 'applyFoeRecord',
  'setFoeDead', 'roomRecord', 'spawnLooseFoe', 'ownFrame', 'applyOwnFrame', 'ownPuppetsOf', 'standOwnPuppet', 'keepOwnRecord', 'applyOwnRecord',
  'companionPuppet', 'dropOwnPuppet', 'adoptOwn', 'letGoOwn', 'standDownMarkerCopies', 'ownHandOverFrame'];
const DECLS = ['isRoomFoe', 'questPoolOps', 'GENDER_BIT', 'q2', 'q3', 'canStandFoe', 'FOES_FRAME_SLACK', 'ownLoose', 'ownQuestTag', 'ownShare',
  'questTouched', 'ownPupKey', 'ownHeirIsMe', 'ownHeirElse', 'foeMaxOf', 'FOE_MAX_PER_FRAME', '_maxLeft', 'LOOSE_PUPPETS_MAX'];
const CTX_BODY = `
  ${DECLS.map(declSrc).join('\n')}
  ${FNS.map(fnSrc).join('\n')}
  return { spawnLooseFoe, ownFrame, applyOwnFrame, ownHandOverFrame };
`;

let _seed = 7;
const dice = () => { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; };
/** One player's dungeon - the context's foe half and its own lane, HEAD's statements over stubs. */
function context(self) {
  let batchN = 0;
  const pe = { level: 20, reflexes: 2, gender: 'male', items: [], stats: {}, skills: new Array(40).fill(50) };
  const state = {
    ...ROOM_LOOT_OFF, foeSeed, applyWireLook, ...TRAIT_DOORS, appliedOwnerTm,
    console: { error: (...a) => assert.fail(a.join(' ')), warn: () => {}, info: () => {} },
    ENEMY_BASICS, enemyEntityType, isClassEnemyId, setupFoeLook, MobileUnit, enemyHierarchyOrder, validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, CELL_FRAME_RECORDS_MAX, CELL_LOOSE_PUPPETS,
    validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX, validLooseSeqs, companionNames, PEER_REVENANT_PUPPETS_MAX,
    summonedWord, summonedRecord, markSummoned,   // RPT1026-PROGRESS: the free names the fix adds to the lane
    spawnEnemyLoot: (e, mt, b, p, o) => spawnEnemyLoot(e, mt, b, p, { ...o, rolls: dice }),   // the build's own loot roll, on fixed dice
    rollCorpseKit, capFoeLoot, addCorpseFood, dropFoeCard, stampWonWeapons: () => {},   // the stream's death: the kit, the food, the card, the cap
    foes: [], _layoutFoes: 0, _layoutStood: true, _spawnUid: 0, _ctxDead: false, _authority: true, _locationKey: 'dungeon:7', _foesFrom: null,
    _ownSeq: 0, _ownFrameSeq: 0, _ownGen: 0, _ownPups: new Map(), _ownPending: new Map(), _ownPendLoose: new Set(), _ownOwners: new Map(), _ownAdopted: new Map(), _ownKept: new Map(),
    _retyping: new Set(), flatGroups: new Map(), billboardBatches: [],
    lastPlayerFeet: [0, 0, 0], _motorYaw: 0, collider: {}, dfLocation: null, dungeon: { blocks: [] },
    partyOnlyQuestShare, opts: { selfId: () => self, questShare: () => null, onEnemySpawn: () => {} },
    renderer: { createBillboardBatch: () => ({ id: ++batchN }), destroyBillboardBatch: () => {} },
    foeDeps: {
      floorLanding: (c, p) => [p[0], p[1] - 0.2, p[2]],
      loadEnemyCareer: async () => ({}),
      makeEnemyEntity: (t, b) => ({ health: 30, maxHealth: 30, items: [], team: b.team ?? null, level: 1 }),
      playerEntity: pe,
      EnemyAI: class { constructor(c, pos, yaw) { this.feet = [...pos]; this.yaw = yaw; this.target = null; } resumeLive() {} },
      EnhancedEnemyAI: class {},
      EnemyAttack: class {},
      fetchBytes: async () => new Uint8Array(0),
    },
    getTexture: async () => ({ getFrameCount: () => 1 }), idleSpriteHeight: () => 1.8, feetFromCentre: (p) => p,
    enemyControllerHeight: () => 1.8, waterSurfaceYAt: () => null, isActionDoor: () => false, hasBowAttack: () => false,
    getPref: () => false, enhancedNav: {}, liveStat: () => 50, asCandidate: (r) => r,
    assignFoeSpells: () => {}, registerFoeDoor: () => {}, damageFoe: () => {}, renownFoeCarry: () => {}, renownFoeRevived: () => {},
    renownFoeDied: () => {}, reportPlayerKill: () => {}, spawnCorpse: (f) => { f.corpse = true; }, egFindStruck: async () => {}, sayEnemyDied: () => {},
    hudText: { add: () => {} }, foeTitle: () => null, enemyDisplayName: () => '', applyBlowRecord: () => {}, feudFromWire: (x) => x, puppetRevenantBlows: () => {},
    playerEntity: pe, _wallNow: () => 1000, _sharedFoe: () => false, fightN: () => 1,
    placeFoeEnv: (o) => o, entityOccupancy: () => () => false, fieldOfView: () => 1.2, placeFoeFreely: () => ({ x: 6, y: 0, z: 6 }),
    inFireWard, dungeonFires: [], freeLodgedFeet, sharedClockOn: () => false, ambushNight: () => false,
    performance: { now: () => 0 },
  };
  const api = mount(CTX_BODY, state);
  // the one enchant ctx every host mounts, its allied door over this host's own loose stand (dungeonContext.js's
  // standLooseFoe arm: spawnLooseFoe, the alliance passed through)
  const ctx = createEnchantCtx({
    playerEntity: pe, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, magic: null,
    foes: () => state.foes, foeSinks: () => ({}), feet: () => [0, 0, 0],
    standLooseFoe: (mt, o = {}) => api.spawnLooseFoe(mt, [4, 0, 4], { allied: o.allied }),
  });
  return { state, api, ctx };
}
const carried = (f) => (f?.entity?.items ?? []).length;
const pupOf = (c, owner) => [...c.state._ownPups.values()].find((f) => f._ownFrom === owner) ?? null;

test('RPT1026-PROGRESS (the Skull\'s copies, online): my summon in a dungeon is bare on every other player\'s machine - its owner\'s frame names it (`sm`), the copy a friend stands of it carries nothing alive, and its death there lays nothing on it; theirs is bare on mine the same way (mutants: the frame says nothing; the reader drops the word; the puppet never marked)', async () => {
  const amy = context('aaa-0001'), bob = context('bob-0005');
  // my summon, through the artifact's own door (the Sanguine Rose's Daedroth; the Skull's copy rides the same door)
  amy.ctx.spawnAlliedFoe(MOBILE_TYPES.Daedroth);
  await settle();
  const mine = amy.state.foes.find((f) => f._loose && f.mobileType === MOBILE_TYPES.Daedroth);
  assert.ok(mine && mine.entity.summoned === true && carried(mine) === 0, 'mine stands bare (SUMMON-BARE)');
  const frame = amy.api.ownFrame(true);
  assert.deepEqual([frame.lf, frame.sm], [[mine._ownSeq], [mine._ownSeq]], 'my frame names it loose, and a summon');
  // the friend's copy: the real build rolls its kind's loot - and the owner's word takes it off
  assert.equal(bob.api.applyOwnFrame('aaa-0001', frame), true);
  await settle();
  const copy = pupOf(bob, 'aaa-0001');
  assert.ok(copy, 'the friend stands it');
  assert.deepEqual([copy.entity.summoned, carried(copy)], [true, 0], 'the friend\'s copy of my summon carries nothing');
  // it falls: the owner's body word, the friend's copy rolls its death (its kit, its food, its card) - and keeps none
  mine.dead = true; mine.corpse = true; mine.entity.health = 0;
  bob.api.applyOwnFrame('aaa-0001', amy.api.ownFrame(false));
  assert.equal(copy.dead, true, 'it fell on the friend\'s machine too');
  assert.equal(carried(copy), 0, 'and its body there is bare');
  // the other way: the friend's summon on my machine
  bob.ctx.spawnAlliedFoe(MOBILE_TYPES.Daedroth);
  await settle();
  amy.api.applyOwnFrame('bob-0005', bob.api.ownFrame(true));
  await settle();
  const theirs = pupOf(amy, 'bob-0005');
  assert.deepEqual([theirs?.entity?.summoned, carried(theirs)], [true, 0], 'their summon\'s copy on my machine is bare too');
});

test('RPT1026-PROGRESS (the Skull\'s copies, online): the mark is the summon\'s alone - a loose stand that is no summon (a Wabbajack\'s change) keeps its loot on a friend\'s copy; a summon handed to its heir streams on as a summon to the rest of the room (mutants: every loose stand named a summon; every record marked)', async () => {
  const amy = context('aaa-0001'), bob = context('bob-0005'), cal = context('cal-0009');
  const plain = await amy.api.spawnLooseFoe(MOBILE_TYPES.Daedroth, [6, 0, 6], {});   // a loose stand of no artifact's
  amy.ctx.spawnAlliedFoe(MOBILE_TYPES.Daedroth);
  await settle();
  const summon = amy.state.foes.find((f) => f._loose && f.entity.summoned === true);
  const frame = amy.api.ownFrame(true);
  assert.deepEqual(frame.sm, [summon._ownSeq], 'the frame names the summon, never the plain loose stand');
  bob.api.applyOwnFrame('aaa-0001', frame);
  await settle();
  const pups = [...bob.state._ownPups.values()];
  const plainCopy = pups.find((f) => f._ownI === plain._ownSeq), summonCopy = pups.find((f) => f._ownI === summon._ownSeq);
  assert.ok(carried(plainCopy) > 0 && plainCopy.entity.summoned !== true, 'the plain loose stand\'s copy keeps its own roll, as before');
  assert.equal(carried(summonCopy), 0);
  // I go: the summon is handed to the friend, who takes it and streams it on - a third player's copy is bare
  bob.api.applyOwnFrame('aaa-0001', amy.api.ownHandOverFrame((f) => (f === summon ? 'bob-0005' : null)));
  assert.deepEqual([summonCopy._ownFrom, summonCopy._loose, summonCopy.entity.summoned], [null, true, true], 'the heir holds it, still a summon');
  const onward = bob.api.ownFrame(true);
  assert.deepEqual(onward.sm, [summonCopy._ownSeq], 'the heir\'s frame names it a summon');
  cal.api.applyOwnFrame('bob-0005', onward);
  await settle();
  assert.equal(carried(pupOf(cal, 'bob-0005')), 0, 'and the third player\'s copy is bare');
});
