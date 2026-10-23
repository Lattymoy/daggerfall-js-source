// FIELD BUGS 2026-10-18d SEAT-LIVE (FloopZe, "Castle Daggerfall guards loot duping": "I am able to continuously enter/exit
// the castle and the loot/corpses respawn, duping the items/gold upon re-entering the castle. (This fixed itself after a
// few exits...)"). THE REPORT'S LOOP, WALKED: a castle room whose host's page is hidden (its socket open, its frames
// stopped), and a player who walks in, takes every body the host left, walks out and back in, three times. Mounted, not
// matched: the dungeon host's real doors - the kill, the corpse, the room's loot block (PARTY-LOOT, scenes/roomLootHost.js),
// the quick door, the memory out and in (sharedWorld, restoreSharedWorld, applyWorld, patchFoe, applyLoot) - sliced out of
// src/scenes/dungeonContext.js over the real loot producers (as test/systems/partyloot.test.js mounts them), the castle's
// guards as class foes (a Knight), and the real relay Room over test/fakeRoom.mjs. The page's own gates are the ones
// scenes/world.js keeps: it publishes its memory only while the relay names it the room's host (worldPublish's
// `online.isHost()`), and its pose is said once the named host's stream has been silent FOES_STALE_MS (net/online.js
// `_askSeat`). Before SEAT-LIVE the relay named the silent host for as long as its tab lived: the farewell was refused,
// every visit was welcomed with the host's old memory, and the purse grew 2280 -> 4560 -> 6840.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { respawnDue, validSharedFoe, FOES_STALE_MS, PIXEL_UNITS } from '../../src/net/wire.js';
import { generateItems, addPileLootExtras, validLootList, LOOT_LIST_MAX, DUNGEON_LOOT_KEYS, LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { peerHanded, neverPeerHanded, notCarried } from '../../src/systems/peerWord.js';
import { addItem, stacksWith, isGoldPieces, addGoldPieces } from '../../src/systems/inventory.js';
import { isEquipped, unequipItem } from '../../src/systems/equip.js';
import { spawnEnemyLoot, wildLootAfter, rollRoomBonus } from '../../src/scenes/hostCombat.js';
import { raiseEnemyDeath, corpseTextureOf } from '../../src/scenes/corpseMarker.js';
import { rollCorpseKit, capFoeLoot } from '../../src/systems/foeLootCap.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { effectiveLevel } from '../../src/systems/mentorMode.js';
import { liveStat } from '../../src/systems/statMods.js';
import { setSigilOnline } from '../../src/systems/sigil/sigil.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { grantEliteLoot } from '../../src/systems/eliteFoes.js';
import { wildPileMore } from '../../src/systems/wild/wildZone.js';
import { seaPileMore } from '../../src/systems/sea/seaSpoils.js';   // PIN MOVED (SEA-SET): the room's base rolls the deep's Tidemail last (roomLootHost.js)
import { quickLootTake, foldQuickLoot, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { hoverLines } from '../../src/systems/worldHover.js';
import { asTheRoom } from '../../src/systems/online/onlineLane.js';
import { isDeepPileKey } from '../../src/systems/rest/restItems.js';
import { validActionRecord, sharedRecord } from '../../src/world/actionSystem.js';
import { keepRebuiltSpawn } from '../../src/characters/enemy/enemyAnchor.js';
import { copyEffectEntry } from '../../src/systems/save/save.js';
import { withoutCarried } from '../../src/world/interior/interiorShared.js';
import * as RL from '../../src/systems/roomLoot.js';
import { fakeRoom } from '../fakeRoom.mjs';

setPref(LOOT_RARITY_KEY, true);   // the loot ladder - forced on online (OL1)
setSigilOnline(true);
setPref('quickLoot', true);

const SRC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(SRC, { ecmaVersion: 'latest', sourceType: 'module' });
const MOD = readFileSync(new URL('../../src/scenes/roomLootHost.js', import.meta.url), 'utf8');
const MOD_AST = acorn.parse(MOD, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred, ast = AST) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  return hit;
}
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `src has function ${name}`); return SRC.slice(n.start, n.end); };
const optFn = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); return n ? SRC.slice(n.start, n.end) : ''; };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `src declares ${name}`); return SRC.slice(n.start, n.end); };
const memberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `src has member ${name}`);
  const body = SRC.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
/** The room's loot block as the dungeon host constructs it (test/systems/partyloot.test.js's own slice). */
const BLOCK = (() => {
  const ctor = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.init?.type === 'CallExpression' && d.init.callee?.name === 'createRoomLoot'));
  const fn = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === 'createRoomLoot', MOD_AST);
  const a = SRC.indexOf('  let _roomMintHold = 0;');
  assert.ok(ctor && fn && a >= 0 && a < ctor.start, 'the dungeon host builds its room loot');
  return `${SRC.slice(a, ctor.start)}${MOD.slice(fn.start, fn.end)}\n  ${SRC.slice(ctor.start, ctor.end)}\n`;
})();
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

const ROOM = 'dungeon:m1291010263';   // Daggerfall's own: the castle
const GUARD = MOBILE_TYPES.Knight;
const GUARDS = 6;
const CAREER = { strength: 60, intelligence: 50, willpower: 50, agility: 55, endurance: 60, personality: 40, speed: 55, luck: 50, hitPointsPerLevel: 12 };
const at = (k = 0) => ({ x: PIXEL_UNITS + 10 + k, y: 0, z: PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });

/** ONE ENTRY: the dungeon host's doors over this entry's own build of the castle's guards, at `id`'s level and dice. */
function entry({ id, seed, characterId, player, authority, clock }) {
  const own = lcg(seed);
  const as = (fn) => { const real = Math.random; Math.random = own; try { return fn(); } finally { Math.random = real; } };
  const state = {
    foes: [], _layoutFoes: GUARDS, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: authority, playerEntity: player, dfLocation: { mapTableData: { dungeonType: 0 } }, lootKey: DUNGEON_LOOT_KEYS[0],
    _superTier: false, _wildDungeon: false, _wildRing: null, _deepCleared: new Set(), _deepFoeCleared: new Set(),
    SUPER_LOOT_DROP_MULT: 1.5, ELITE_LOOT_DROP_MULT: 1.2, SUPER_LOOT_QUALITY_MULT: 1.5, ELITE_LOOT_QUALITY_MULT: 1.2,
    opts: { selfId: () => id, onActions: () => true, onLootClaimed: () => {}, partyLevels: () => [], roomHost: () => null },
    _foesFrom: null, _sharedStamp: `${id}:${seed}`, _sharedApplied: false, _eliteOnline: true, _foesSeqIn: -1, clearSurplus: () => {},
    addItem, stacksWith, isGoldPieces, addGoldPieces, isEquipped, unequipItem, neverPeerHanded, notCarried,
    onlineRoom: () => true, _wallNow: () => clock.t, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, ENEMY_BASICS, corpseTextureOf,   // AUDIT DEX A1: the corpse mints read it
    generateLootItems: generateItems, addPileLootExtras, rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons,
    spawnEnemyLoot, wildLootAfter, grantEliteLoot, rollCorpseKit, raiseEnemyDeath, capFoeLoot, rollRoomBonus,
    wildPileMore, seaPileMore, isDeepPileKey, effectiveLevel, liveStat, asTheRoom, ...RL,
    eliteLootOpts: () => ({}), searchHeard: () => {}, settleLootFlat: () => {}, _sharedFoe: () => false, fightN: () => 1,
    spawnCorpseNow: async (f) => { f.corpsePos = [...f.ai.feet]; }, renderer: { destroyBillboardBatch: () => {} }, billboardBatches: [], renownFoeRevived: () => {},
    respawnFoe: () => false, retypeFoe: async () => false, roomEncounterAsked: () => false,
    droppedTorches: { activate: () => false, snapshot: () => [], restore: () => {} }, plaqueActionFor: () => null,
    droppedLoot: { physical: { owns: () => false }, pileFor: () => null, lootFinds: () => [], _piles: [], restorePiles: () => {} }, lootCrown: (pos) => pos,
    camps: { applyOwner: () => {}, activate: () => false, snapshot: () => [], dropOwn: () => {}, restore: () => {} },
    actions: { applyRemote: () => 0, collectSaveData: () => [], restoreSaveData: () => {} },
    activateSearchable: () => 0, setMidScreenText: () => {}, activeOverlay: null, silverFindKey: () => null, silverFindAt: () => {},
    quickLootTake, showPickups: null, lootPile: () => null, pileBody: () => null, openInventory: () => null, RANDOM_TREASURE_ARCHIVE: 216,
    validSharedFoe, validActionRecord, sharedRecord, keepRebuiltSpawn, copyEffectEntry, withoutCarried,
    carriedPieces: () => ({ keys: new Set(), stowed: new Set(), keyOf: () => null }),
    freeLodgedFeet: () => {}, collider: null, ownMinutes: () => 0, addCorpseFood: () => {}, dropFoeCard: () => null,
    questPoolOps: { removeFoe: () => {} }, dropCandidate: () => {}, clearOwnPuppets: () => {}, forgetDelveRun: () => {},
    applyCampMemory: () => {}, campMemory: () => [], searchRoom: { records: () => [] },
  };
  const doors = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${fnSrc('lootKeyOf')}
    ${fnSrc('lootableBody')}
    ${fnSrc('lootHolder')}
    ${fnSrc('roomLootKey')}
    ${fnSrc('lootRecords')}
    ${fnSrc('publishLoot')}
    ${optFn('sayRoomWord')}
    ${fnSrc('applyLoot')}
    ${BLOCK}
    ${fnSrc('freeCorpse')}
    ${fnSrc('setFoeDead')}
    ${fnSrc('spawnCorpse')}
    let _respawnSweptAt = -Infinity;
    const RESPAWN_BURST = 4;
    ${fnSrc('respawnSweep')}
    ${fnSrc('rollPileItems')}
    ${fnSrc('bodyRecords')}
    ${fnSrc('patchFoe')}
    ${fnSrc('applyWorld')}
    ${fnSrc('collectWorld')}
    const sharedWorld = ${memberSrc('sharedWorld')};
    const restoreSharedWorld = ${memberSrc('restoreSharedWorld')};
    const lootContents = ${memberSrc('lootContents')};
    const takeLoot = ${memberSrc('takeLoot')};
    return { setFoeDead, respawnSweep, sharedWorld, restoreSharedWorld, lootContents, takeLoot, roomClaimTick: typeof roomClaimTick === 'function' ? roomClaimTick : () => {} };
  `, state);
  // THE BUILD: the castle's guards as buildFoeAt stands a class foe - its entity, SetEnemyCareer's loot chain
  as(() => {
    for (let i = 0; i < GUARDS; i++) {
      const entity = makeEnemyEntity(GUARD, ENEMY_BASICS[GUARD], CAREER, effectiveLevel(player), Math.random);
      spawnEnemyLoot(entity, GUARD, ENEMY_BASICS[GUARD], player, { where: 'dungeon' });
      state.foes.push({ mobileType: GUARD, gender: 'male', entity, dead: false, corpse: false, src: { mobileType: GUARD, reaction: 'passive' }, ai: { feet: [i, 0, 0], yaw: 0, isHostile: false } });
    }
  });
  const sweep = () => as(() => { doors.respawnSweep(clock.t / 1000); doors.roomClaimTick(clock.t); });
  return {
    state, as, sweep,
    /** every guard falls (the fight) */
    fall() { as(() => { for (const f of state.foes) doors.setFoeDead(f, true); }); clock.t += 2000; sweep(); },
    restore(shared) { return as(() => doors.restoreSharedWorld(shared)); },
    shared() { return JSON.parse(JSON.stringify(as(() => doors.sharedWorld()))); },
    /** the quick door, row by row, over every body - what a player does who empties them */
    lootAll() {
      let n = 0;
      for (let i = 0; i < GUARDS; i++) {
        const key = `corpse:${i}`;
        for (let guard = 0; guard < 40; guard++) {
          const items = as(() => doors.lootContents(key)) ?? [];
          if (!items.length) break;
          as(() => { const { shown: rows, rest, empty } = hoverLines(items, Infinity); resetQuickLoot(); foldQuickLoot({ key, kind: 'items', title: 'x', subs: [], rows, rest, empty }); doors.takeLoot(key); });
          n++;
        }
      }
      sweep();
      return n;
    },
    held(key) { return (as(() => doors.lootContents(key)) ?? []).length; },
  };
}

/** A PAGE in the room: its socket on the real relay, and the two gates scenes/world.js keeps on it. */
function page(r, id) {
  let ws = null;
  const named = () => { const said = ws.sent.filter((m) => m.t === 'welcome' || m.t === 'host'); return said.length ? said.at(-1).host ?? said.at(-1).id : null; };
  return {
    async enter() { ws = r.connect(); await r.hello(ws, id, at()); return ws.sent.find((m) => m.t === 'welcome'); },
    named,
    pose: (k) => r.pose(ws, at(k)),
    /** worldPublish: `!online.isHost()` returns before anything is said */
    async publish(shared, final = false) { if (named() !== id) return false; await r.world(ws, shared, final ? { final: true } : {}); return true; },
    /** a world frame past the page's gate - a page that has not yet heard it lost the seat */
    write: (shared) => r.world(ws, shared),
    async leave() { await r.drop(ws); },
  };
}

/** ONE INSTANT for the Room, the doors and the bodies - a body's base is seeded by its name and its death's stamp
 *  (systems/roomLoot.js), so a wall-clock start rolled a different castle every run, and one in twenty stood a Map on a
 *  guard: quick loot reads a map where it lies and never moves it (systems/quickLoot.js takeOneItem), so that body could
 *  never be emptied and the pin failed by its dice (test/net/partyloot_wire.test.js starts its rooms at a T0 the same way). */
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
async function onClock(fn) {
  const real = Date.now;
  const clock = { t: T0 };
  Date.now = () => clock.t;
  try { return await fn(clock); } finally { Date.now = real; }
}

test('SEAT-LIVE THE REPORT\'S LOOP: a castle room whose host\'s page is hidden - the player who walks in and empties the bodies the host left finds them empty at every walk back in, and the purse stays what one emptying made it; the host back from hiding is a joiner and its frozen world is not the room\'s (mutants: the relay\'s walk by seniority alone - the purse grew 2280 -> 4560 -> 6840; the kept host never asked again; the page\'s ask never said)', async () => {
  RL._resetRoomLootForTests();
  await onClock(async (clock) => {
    const r = fakeRoom(ROOM);
    // THE HOST: in the castle, the guards fall, its memory published - and its page hidden (no frame from here on)
    const H = page(r, 'hhhh-0001');
    await H.enter();
    const host = entry({ id: 'hhhh-0001', seed: 5, characterId: 'char-h', player: { level: 12, gender: 'male', name: 'h', characterId: 'char-h', stats: { luck: 50, strength: 60 }, activeEffects: [], items: [], goldPieces: 0 }, authority: true, clock });
    host.fall();
    assert.equal(await H.publish(host.shared()), true, 'the host\'s memory: the guards dead, their bodies untouched');
    const frozen = host.shared();
    clock.t += 60_000;
    // THE PLAYER: three visits, each walking in, waiting out the host's silence, emptying every body, walking out
    const player = { level: 12, gender: 'male', name: 'p', characterId: 'char-p', stats: { luck: 50, strength: 60 }, activeEffects: [], items: [], goldPieces: 0 };
    const P = page(r, 'pppp-0002');
    const purse = [];
    for (let visit = 1; visit <= 3; visit++) {
      const welcome = await P.enter();
      assert.ok(welcome.world, `visit ${visit}: the room's memory rides the welcome`);
      // SEAT-HEAL: the named host silent FOES_STALE_MS - this page runs the room's foes and judges its claims
      const me = entry({ id: 'pppp-0002', seed: 40 + visit, characterId: 'char-p', player, authority: true, clock });
      assert.equal(me.restore(welcome.world), true, `visit ${visit}: the memory lands on the fresh build`);
      clock.t += 2000; me.sweep();
      clock.t += FOES_STALE_MS;
      await P.pose(visit);   // net/online.js _askSeat: the host's stream has not come - my pose, so the relay hears me
      if (visit === 3) {   // the host's page comes back while the player is in: a joiner, told so - its frozen world refused
        await H.pose(9);
        assert.equal(await H.publish(frozen), false, 'the host back from hiding is told it is a joiner (its page\'s gate holds)');
        await H.write(frozen);
        assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'and its frame said past that gate is refused by the relay');
      }
      const took = me.lootAll();
      if (visit === 1) assert.ok(took >= GUARDS, `visit 1: the bodies the host left were full (${took} rows taken)`);
      else assert.equal(took, 0, `visit ${visit}: every body is as the player left it - empty`);
      for (let i = 0; i < GUARDS; i++) assert.equal(me.held(`corpse:${i}`), 0, `visit ${visit}: corpse:${i} is empty`);
      purse.push(player.goldPieces ?? 0);
      assert.equal(P.named(), 'pppp-0002', `visit ${visit}: the relay names the player who runs the room`);
      assert.equal(await P.publish(me.shared(), true), true, `visit ${visit}: so its farewell is the room's memory`);
      await P.leave();
      clock.t += 1000;
    }
    assert.ok(purse[0] > 0, `the bodies held gold (${purse[0]})`);
    assert.deepEqual(purse, [purse[0], purse[0], purse[0]], `the purse is what one emptying made it, visit after visit (${purse.join(' -> ')})`);
    assert.equal(r.store.get('world:meta')?.by, 'pppp-0002', 'the room\'s memory is the player\'s, never the hidden host\'s frozen one');
  });
});
