// RPT1026-ITEMS RE-ENTRY - a private report (a party in small, medium and elite dungeons): after looting some bodies
// and then dying or walking out, two or three of the same bodies held their loot again on the way back in.
//
// THE REPORT'S LOOP, WALKED in a real two-player room: the relay's Room over test/fakeRoom.mjs names the room's host, keeps
// its memory and hands it to whoever walks in (the welcome), and the two players' act frames go through a queue to each
// other in order (test/systems/partyloot.test.js's relay). Each player is the dungeon host's REAL doors, sliced out of
// src/scenes/dungeonContext.js - the kill, the corpse, the room's loot block (scenes/roomLootHost.js createRoomLoot), the
// quick door, the seat (setAuthority) and the memory out and in (sharedWorld, restoreSharedWorld, collectWorld,
// applyWorld, patchFoe, bodyRecords) - over the real loot producers, as partyloot.test.js and
// test/scenes/fb1018d_seatloop.test.js mount them. The layout is a party's worst case for the report's 2-3 bodies: class
// foes at a LocationId whose champions' hash marks two of the six (CHAMP-BASE's), a level-12 host and a level-2 partner.
//
// What it asks, for every way the report's loop can go: is a piece the looter took offered to them again? On this tree,
// never - the four walks below. The way it WAS offered is CHAMP-BASE's (FIELD BUGS 2026-10-25b, after the report): a body
// the layout marks a champion was rolled at each builder's own level, so the level-2 partner read the host's word about
// it as another build's and held it unread; a memory that partner wrote as the room's host left the body out (it had no
// room state), and the looter walked back in to that body's pieces, rolled afresh (the fourth walk; mutant
// RE-ENTRY-the-builders-champion puts the old base back and every walk fails). A memory older than the looter's own
// takes (the host's fifteen seconds) still SHOWS them for a moment, and the host refuses the press (the second walk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { respawnDue, sharedClassicMinutes, validSharedFoe, PIXEL_UNITS } from '../../src/net/wire.js';
import { CLAIM_KEEP_MS, CLAIMS_KEPT_MAX } from '../../src/systems/loot/claimLedger.js';
import { SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX } from '../../src/systems/searchables.js';
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
import { effectiveLevel } from '../../src/systems/mentorMode.js';
import { registerRollerLevel, withRollerLevel } from '../../src/systems/loot/lootLevelGate.js';
import { liveStat } from '../../src/systems/statMods.js';
import { setSigilOnline } from '../../src/systems/sigil/sigil.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { installHealingSupply } from '../../src/systems/healingSupply.js';
import { installRestItemLoot, isDeepPileKey } from '../../src/systems/rest/restItems.js';
import { installSurvivalLoot } from '../../src/systems/survival/loot.js';
import { grantEliteLoot, promoteEliteFoe } from '../../src/systems/eliteFoes.js';
import { markDungeonChampions, applyChampion, championTraitFor } from '../../src/systems/champions.js';
import { ClassFile } from '../../src/formats/classFile.js';
import { wildPileMore } from '../../src/systems/wild/wildZone.js';
import { seaPileMore } from '../../src/systems/sea/seaSpoils.js';
import { markRoomCarried } from '../../src/systems/loot/roomCarriedList.js';
import { quickLootTake, foldQuickLoot, resetQuickLoot } from '../../src/systems/quickLoot.js';
import { hoverLines } from '../../src/systems/worldHover.js';
import { asTheRoom } from '../../src/systems/online/onlineLane.js';
import { validActionRecord, sharedRecord } from '../../src/world/actionSystem.js';
import { keepRebuiltSpawn } from '../../src/characters/enemy/enemyAnchor.js';
import { copyEffectEntry } from '../../src/systems/save/save.js';
import { withoutCarried } from '../../src/world/interior/interiorShared.js';
import * as RL from '../../src/systems/roomLoot.js';
import '../../src/systems/card/cardSources.js';   // CARDS9's death handler registers at import, as the hosts load it
import '../../src/scenes/physicalItemsLayer.js';   // PI1's
import { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame } from '../../src/scenes/foeTraitsHost.js';
import { bossClockS, eliteTraits } from '../../src/systems/bossTraits.js';
import { fakeRoom } from '../fakeRoom.mjs';

const TRAIT_DOORS = { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame, bossClockS, eliteTraits };
installHealingSupply(); installRestItemLoot(); installSurvivalLoot();
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
/** The room's loot block as the dungeon host constructs it (partyloot.test.js's own slice). */
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

const ROOM_ID = 150;   // CHAMP-BASE's LocationId: its champions' hash marks two of the six
const ROOM = `dungeon:m${ROOM_ID}`;   // the room a dungeon's players share (net/online.js roomKeyFor), and its context's key
const DUNGEON_TYPE = 12;
const NIGHTBLADE = 133;   // a class foe - built at its builder's level (SetEnemyCareer)
const FOES = 6;
const ELITE_FOE = 2;
const HOST = 'aaaa-0001', PARTNER = 'bbbb-0002';
const at = (k = 0) => ({ x: PIXEL_UNITS + 10 + k, y: 0, z: PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
function classCareer() {
  const b = new Uint8Array(74);
  const v = new DataView(b.buffer);
  for (let i = 0; i < 12; i++) b[16 + i] = 40 + i;
  v.setUint16(52, 8, true);
  [55, 66, 45, 50, 40, 35, 60, 30].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  const cf = new ClassFile();
  cf.load(b);
  return cf.career;
}
const CAREER = classCareer();

/** THE ACT FRAMES between the two: queued in order, handed to everyone in the room but the author. */
function relay() {
  const peers = [];
  const q = [];
  const gone = new Set();
  return {
    join(p) { gone.delete(p.id); peers.push(p); },
    send(from, data) { if (gone.has(from)) return false; q.push({ from, data: JSON.parse(JSON.stringify(data)) }); return true; },
    leave(p) { gone.add(p.id); const i = peers.indexOf(p); if (i >= 0) peers.splice(i, 1); for (let k = q.length - 1; k >= 0; k--) if (q[k].from === p.id) q.splice(k, 1); },
    flush() { while (q.length) { const { from, data } = q.shift(); for (const p of peers) if (p.id !== from) p.as(() => p.host.applyActions(from, data)); } },
  };
}
const character = (id, level) => ({ level, gender: 'male', name: id, characterId: `char-${id}`, stats: { luck: 50, strength: 60 }, activeEffects: [], items: [], goldPieces: 0 });

/** ONE VISIT of one player: the dungeon host's doors over this visit's own build of the layout, on its own dice. */
function visit(net, { id, player, seed, host, partners, seat, clock }) {
  const own = lcg(seed);
  const as = (fn) => {
    const real = Math.random;
    Math.random = own;
    registerRollerLevel(() => effectiveLevel(player));
    try { return fn(); } finally { Math.random = real; registerRollerLevel(null); }
  };
  const state = {
    foes: [], _layoutFoes: FOES, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: host, playerEntity: player, dfLocation: { mapTableData: { dungeonType: DUNGEON_TYPE } }, lootKey: DUNGEON_LOOT_KEYS[DUNGEON_TYPE],
    _superTier: false, _wildDungeon: false, _wildRing: null, _deepCleared: new Set(), _deepFoeCleared: new Set(),
    SUPER_LOOT_DROP_MULT: 1.5, ELITE_LOOT_DROP_MULT: 1.2, SUPER_LOOT_QUALITY_MULT: 1.5, ELITE_LOOT_QUALITY_MULT: 1.2,
    opts: { selfId: () => id, onActions: (data) => net.send(id, data), onLootClaimed: () => {}, partyLevels: () => partners, roomHost: () => seat.id },
    _foesFrom: host ? null : seat.id, _sharedStamp: `${id}:${seed}`, _sharedApplied: false, _foesSeqIn: -1, clearSurplus: () => {}, ...TRAIT_DOORS,
    addItem, stacksWith, isGoldPieces, addGoldPieces, isEquipped, unequipItem, neverPeerHanded, notCarried,
    onlineRoom: () => true, _wallNow: () => clock.t, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, ENEMY_BASICS, corpseTextureOf,
    generateLootItems: generateItems, addPileLootExtras, rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons,
    spawnEnemyLoot, wildLootAfter, grantEliteLoot, rollCorpseKit, raiseEnemyDeath, capFoeLoot, rollRoomBonus, applyChampion, championTraitFor, promoteEliteFoe, _retyping: new Set(),
    wildPileMore, seaPileMore, isDeepPileKey, effectiveLevel, liveStat, asTheRoom, withRollerLevel, markRoomCarried, CLAIM_KEEP_MS, CLAIMS_KEPT_MAX, SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX, sharedClassicMinutes, ...RL,
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
    applyCampMemory: () => {}, campMemory: () => [], searchRoom: { records: () => [], ours: () => true, fields: () => ({}), whose: () => null },
  };
  const h = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${fnSrc('lootKeyOf')}
    ${fnSrc('lootableBody')}
    ${fnSrc('lootHolder')}
    ${fnSrc('roomLootKey')}
    ${fnSrc('lootRecords')}
    ${fnSrc('publishLoot')}
    ${optFn('sayRoomWord')}
    ${fnSrc('applyLoot')}
    ${fnSrc('applyActions')}
    ${BLOCK}
    ${fnSrc('freeCorpse')}
    ${fnSrc('setFoeDead')}
    ${fnSrc('spawnCorpse')}
    let _respawnSweptAt = -Infinity;
    const RESPAWN_BURST = 4;
    ${fnSrc('respawnSweep')}
    ${fnSrc('rollPileItems')}
    ${fnSrc('setAuthority')}
    ${fnSrc('applyEliteScaling')}
    ${fnSrc('bodyRecords')}
    ${fnSrc('patchFoe')}
    ${fnSrc('applyWorld')}
    ${fnSrc('collectWorld')}
    const sharedWorld = ${memberSrc('sharedWorld')};
    const restoreSharedWorld = ${memberSrc('restoreSharedWorld')};
    const api = { lootContents: ${memberSrc('lootContents')}, takeLoot: ${memberSrc('takeLoot')} };
    return { api, applyActions, setFoeDead, respawnSweep, setAuthority, applyEliteScaling, sharedWorld, restoreSharedWorld, roomClaimTick: typeof roomClaimTick === 'function' ? roomClaimTick : () => {}, lootBuiltOf: typeof lootBuiltOf === 'function' ? lootBuiltOf : null };
  `, state);
  // THE BUILD, as dungeonContext builds it: the layout's champions marked by the LocationId, the elite, each class foe at
  // this player's own level and on its own dice
  const records = Array.from({ length: FOES }, () => ({ mobileType: NIGHTBLADE }));
  markDungeonChampions(records, ROOM_ID);
  as(() => {
    for (let i = 0; i < FOES; i++) {
      if (i === ELITE_FOE) records[i].eliteFoe = true;
      const entity = makeEnemyEntity(NIGHTBLADE, ENEMY_BASICS[NIGHTBLADE], CAREER, effectiveLevel(player), Math.random);
      h.applyEliteScaling(entity, records[i]);
      spawnEnemyLoot(entity, NIGHTBLADE, ENEMY_BASICS[NIGHTBLADE], player, { where: 'dungeon' });
      const f = { mobileType: NIGHTBLADE, gender: 'male', entity, dead: false, corpse: false, src: records[i], ai: { feet: [i, 0, 0], yaw: 0, isHostile: false } };
      if (h.lootBuiltOf) f._lootBuilt = h.lootBuiltOf(entity);
      state.foes.push(f);
    }
  });
  const p = {
    id, host: h, state, player, as,
    sweep() { as(() => { h.respawnSweep(clock.t / 1000); h.roomClaimTick(clock.t); }); },
    shared() { return JSON.parse(JSON.stringify(as(() => h.sharedWorld()))); },
    restore(shared) { return as(() => h.restoreSharedWorld(shared)); },
    shown(key) { return as(() => h.api.lootContents(key)) ?? []; },
    /** The quick door over one body, row by row, until it is empty - what a player does who empties it. */
    empty(key) {
      let n = 0;
      for (let guard = 0; guard < 60; guard++) {
        const items = as(() => h.api.lootContents(key)) ?? [];
        if (!items.length) break;
        as(() => { const { shown: rows, rest, empty } = hoverLines(items, Infinity); resetQuickLoot(); foldQuickLoot({ key, kind: 'items', title: 'x', subs: [], rows, rest, empty }); h.api.takeLoot(key); });
        n++;
      }
      return n;
    },
  };
  net.join(p);
  return p;
}

/** A PAGE in the room: its socket on the real relay, and scenes/world.js's gate on its memory (worldPublish's isHost). */
function page(r, id) {
  let ws = null;
  const named = () => { const said = ws.sent.filter((m) => m.t === 'welcome' || m.t === 'host'); return said.length ? said.at(-1).host ?? said.at(-1).id : null; };
  return {
    async enter(k = 0) { ws = r.connect(); await r.hello(ws, id, at(k)); return ws.sent.find((m) => m.t === 'welcome'); },
    named,
    async publish(shared, final = false) { if (named() !== id) return false; await r.world(ws, shared, final ? { final: true } : {}); return true; },
    async leave() { await r.drop(ws); },
  };
}

const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
async function onClock(fn) {
  const real = Date.now;
  const clock = { t: T0 };
  Date.now = () => clock.t;
  try { return await fn(clock); } finally { Date.now = real; }
}
/** The fight: every layout foe falls on the host and, by its stream, on the partner; the room settles. */
function fall(net, clock, players) {
  for (const p of players) p.as(() => { for (const f of p.state.foes) p.host.setFoeDead(f, true); });
  net.flush();
  for (let i = 0; i < 3; i++) { clock.t += 3000; for (const p of players) p.sweep(); net.flush(); }
}
/** A player's whole take: the purse and every piece in the pack, by what it is. */
const holdings = (player) => ({ gold: player.goldPieces ?? 0, pieces: player.items.map((it) => `${it.group}.${it.templateIndex}.${it.name}`).sort() });
/** The body's base rows - the room's own pieces, never this player's bonus. */
const baseOf = (p, key) => p.shown(key).filter((it) => !RL.isPersonalLoot(it)).map((it) => JSON.stringify(it));
const LOOTED = ['corpse:2', 'corpse:3', 'corpse:4'];   // the elite, a plain body and the champion: the report's two or three
const LEFT = ['corpse:0', 'corpse:1', 'corpse:5'];

/** The room, the two players in it, the fight over: `looter` empties LOOTED; the room's host publishes as the page does. */
async function roomAfterLooting(clock, { looter }) {
  RL._resetRoomLootForTests();
  resetQuickLoot();
  const r = fakeRoom(ROOM);
  const net = relay();
  const seat = { id: HOST };
  const P = { [HOST]: page(r, HOST), [PARTNER]: page(r, PARTNER) };
  await P[HOST].enter(0);
  await P[PARTNER].enter(1);
  assert.equal(P[HOST].named(), HOST, 'the first in is the room\'s host');
  const chars = { [HOST]: character(HOST, 12), [PARTNER]: character(PARTNER, 2) };
  const v = {
    [HOST]: visit(net, { id: HOST, player: chars[HOST], seed: 11, host: true, partners: [2], seat, clock }),
    [PARTNER]: visit(net, { id: PARTNER, player: chars[PARTNER], seed: 29, host: false, partners: [12], seat, clock }),
  };
  fall(net, clock, [v[HOST], v[PARTNER]]);
  const unreadAtFall = [...v[PARTNER].state._lootUnreadable];   // asserted at the end: what the re-entry shows first
  assert.equal(await P[HOST].publish(v[HOST].shared()), true, 'the host\'s memory, as its fifteen seconds say it: every body full');
  const full = Object.fromEntries(LOOTED.map((k) => [k, baseOf(v[HOST], k)]));
  for (const k of LOOTED) assert.ok(full[k].length > 0, `${k} holds the room's pieces`);
  let rows = 0;
  for (const k of LOOTED) rows += v[looter].empty(k);
  net.flush();
  for (let i = 0; i < 2; i++) { clock.t += 1000; v[HOST].sweep(); v[PARTNER].sweep(); net.flush(); }
  assert.ok(rows >= LOOTED.length, `the looter emptied the three bodies (${rows} rows)`);
  for (const k of LOOTED) for (const id of [HOST, PARTNER]) assert.deepEqual(baseOf(v[id], k), [], `${id} sees ${k} emptied`);
  return { r, net, seat, P, chars, v, took: holdings(chars[looter]), unreadAtFall };
}
/** The looter walks back in, on a fresh build of the dungeon, welcomed with the room's memory. */
async function walkBackIn(room, clock, id, { host }) {
  const welcome = await room.P[id].enter(2);
  assert.ok(welcome?.world, 'the room\'s memory rides the welcome');
  const back = visit(room.net, { id, player: room.chars[id], seed: 77, host, partners: [id === HOST ? 2 : 12], seat: room.seat, clock });
  assert.equal(back.restore(welcome.world), true, 'the memory lands on the fresh build');
  for (let i = 0; i < 3; i++) { clock.t += 2000; back.sweep(); room.net.flush(); }
  return back;
}
/** Nothing the looter took is offered again, and pressing every looted body takes nothing more. */
function nothingTwice(room, back, id, other) {
  for (const k of LOOTED) assert.deepEqual(baseOf(back, k), [], `${k}: the room's pieces the looter took are not offered again`);
  for (const k of LOOTED) assert.deepEqual(back.shown(k).filter((it) => RL.isPersonalLoot(it)), [], `${k}: nor the looter's own bonus, spent`);
  if (other) for (const k of LEFT) assert.deepEqual(baseOf(back, k), baseOf(other, k), `${k}: an untouched body is the room's, as the partner holds it`);
  for (const k of LOOTED) back.empty(k);
  room.net.flush();
  for (let i = 0; i < 3; i++) { room.net.flush(); }
  assert.deepEqual(holdings(room.chars[id]), room.took, 'the pack and the purse are what one emptying made them');
  assert.deepEqual(room.unreadAtFall, [], 'and the level-2 partner read every body as the room\'s from the fall (CHAMP-BASE)');
}

test('RE-ENTRY: the host loots three bodies, dies (the death screen\'s farewell), the seat passes to the partner, and the looter walks back in as a joiner - nothing taken is offered again', async () => {
  await onClock(async (clock) => {
    const room = await roomAfterLooting(clock, { looter: HOST });
    assert.equal(await room.P[HOST].publish(room.v[HOST].shared(), true), true, 'the death screen\'s farewell: the host\'s memory, the takes in it');
    await room.P[HOST].leave();
    room.net.leave(room.v[HOST]);
    assert.equal(room.P[PARTNER].named(), PARTNER, 'the relay passes the seat to the partner');
    room.seat.id = PARTNER;
    room.v[PARTNER].as(() => room.v[PARTNER].host.setAuthority(true));
    clock.t += 6000;
    assert.equal(await room.P[PARTNER].publish(room.v[PARTNER].shared()), true, 'the new host says the room\'s memory after the change');
    assert.equal(room.r.store.get('world:meta')?.by, PARTNER);
    clock.t += 60_000;
    const back = await walkBackIn(room, clock, HOST, { host: false });
    nothingTwice(room, back, HOST, room.v[PARTNER]);
  });
});

test('RE-ENTRY: the partner loots three bodies (the host grants each claim), walks out, and walks back in under a memory written BEFORE the takes - the bodies are refused to it, never taken twice, and empty again at the host\'s next word', async () => {
  await onClock(async (clock) => {
    const room = await roomAfterLooting(clock, { looter: PARTNER });
    await room.P[PARTNER].leave();
    room.net.leave(room.v[PARTNER]);
    clock.t += 3000;   // inside the host's fifteen seconds: its memory is still the one from before the takes
    const back = await walkBackIn(room, clock, PARTNER, { host: false });
    // the memory is the one from before the takes, so the walker's fresh build shows the bodies full (the host's next
    // word is at most WORLD_PUBLISH_MS away); the host, who granted the takes, refuses every claim on them
    assert.ok(LOOTED.some((k) => baseOf(back, k).length > 0), 'the memory from before the takes shows the pieces again');
    back.empty(LOOTED[0]); back.empty(LOOTED[1]); back.empty(LOOTED[2]);
    for (let i = 0; i < 4; i++) { room.net.flush(); clock.t += 2000; back.sweep(); room.v[HOST].sweep(); room.net.flush(); }
    assert.deepEqual(holdings(room.chars[PARTNER]), room.took, 'a piece the host knows is gone is refused - the pack is what one emptying made it');
    for (const k of LOOTED) assert.deepEqual(baseOf(back, k), [], `${k}: and the refusal's answer empties it on the walker's screen`);
    // the host's next memory (after a welcome it says again) lands the takes on the walker
    clock.t += 15_000;
    assert.equal(await room.P[HOST].publish(room.v[HOST].shared()), true);
    back.restore(room.v[HOST].shared());
    for (let i = 0; i < 2; i++) { clock.t += 1000; back.sweep(); room.net.flush(); }
    nothingTwice(room, back, PARTNER, room.v[HOST]);
  });
});

test('RE-ENTRY: the partner loots three bodies, walks out, the host leaves too (its farewell), and the partner walks back into the empty room and holds the seat - nothing taken is offered again', async () => {
  await onClock(async (clock) => {
    const room = await roomAfterLooting(clock, { looter: PARTNER });
    await room.P[PARTNER].leave();
    room.net.leave(room.v[PARTNER]);
    clock.t += 6000;
    assert.equal(await room.P[HOST].publish(room.v[HOST].shared(), true), true, 'the host\'s farewell: the room\'s memory, the partner\'s granted takes in it');
    await room.P[HOST].leave();
    room.net.leave(room.v[HOST]);
    clock.t += 60_000;
    room.seat.id = PARTNER;
    const back = await walkBackIn(room, clock, PARTNER, { host: true });
    assert.equal(room.P[PARTNER].named(), PARTNER, 'alone, the walker is the room\'s host');
    nothingTwice(room, back, PARTNER, null);
  });
});

test('RE-ENTRY: the host loots three bodies and walks out with the partner still in; the partner leaves later, and the host walks back into the empty room - the partner\'s farewell kept the takes', async () => {
  await onClock(async (clock) => {
    const room = await roomAfterLooting(clock, { looter: HOST });
    assert.equal(await room.P[HOST].publish(room.v[HOST].shared(), true), true);
    await room.P[HOST].leave();
    room.net.leave(room.v[HOST]);
    room.seat.id = PARTNER;
    room.v[PARTNER].as(() => room.v[PARTNER].host.setAuthority(true));
    clock.t += 6000;
    assert.equal(await room.P[PARTNER].publish(room.v[PARTNER].shared(), true), true, 'the partner\'s farewell, as the room\'s host');
    await room.P[PARTNER].leave();
    room.net.leave(room.v[PARTNER]);
    clock.t += 60_000;
    const back = await walkBackIn(room, clock, HOST, { host: true });
    assert.equal(room.P[HOST].named(), HOST);
    nothingTwice(room, back, HOST, null);
  });
});
