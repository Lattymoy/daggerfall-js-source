// PARTY-LOOT (2026-10-14, the field - "Loot | Data Sync Bug?": "In a dungeon with multiple people OR party, each of us DO
// NOT see the same loot on Mobs/Containers/Floor etc." - and Mac, asked: "Shared base + personal bonus"). TWO PEERS IN ONE
// DUNGEON ROOM, MOUNTED, NOT MATCHED: each peer is the REAL dungeon host's loot doors - lootContents (the plaque),
// takeLoot (the quick door), publishLoot, applyLoot, applyActions, setFoeDead/spawnCorpse, respawnSweep and
// rollPileItems - sliced out of src/scenes/dungeonContext.js, the PARTY-LOOT block with them, over the REAL producers
// (systems/loot/loot.js generateItems and the pile trio, hostCombat.js spawnEnemyLoot, the kit's ladder, the death's
// subscribers). The two peers stand at different levels, Luck, Renown, dice and mod switches, and are joined by a relay
// that queues their act frames. The pile loop's two lines are sliced out of the build too; buildFoeAt's spawnEnemyLoot
// is called as the build calls it - the one stand-in. Run against the dungeon host before PARTY-LOOT, the first three
// tests fail: each peer's plaque is its own roll, and a take replaces the other's list with the taker's leftovers.
// Recorded in bible/06-Systems/Online-Arc.md PARTY-LOOT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { respawnDue, sharedClassicMinutes } from '../../src/net/wire.js';
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
import { registerRollerLevel, withRollerLevel } from '../../src/systems/loot/lootLevelGate.js';   // AUDIT UPDATE L1: each peer's own level registered, as lootPowers.js registers it
import { liveStat } from '../../src/systems/statMods.js';
import { setSigilOnline, setSigilRenown } from '../../src/systems/sigil/sigil.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { setModSetting } from '../../src/systems/modSettings.js';
import { FORAGING_VENDOR } from '../../src/systems/foraging/foragingLaw.js';
import { installForaging } from '../../src/systems/foraging/foragingInstall.js';
import { installSmithing } from '../../src/systems/smithItems.js';
import { installHealingSupply } from '../../src/systems/healingSupply.js';
import { installRestItemLoot, isDeepPileKey } from '../../src/systems/rest/restItems.js';
import { installSurvivalLoot } from '../../src/systems/survival/loot.js';
import { grantEliteLoot } from '../../src/systems/eliteFoes.js';
import { wildPileMore } from '../../src/systems/wild/wildZone.js';
import { seaPileMore } from '../../src/systems/sea/seaSpoils.js';   // PIN MOVED (SEA-SET): the room's base rolls the deep's Tidemail last (roomLootHost.js)
import { quickLootTake, foldQuickLoot, resetQuickLoot, quickLootWheel } from '../../src/systems/quickLoot.js';
import { hoverLines } from '../../src/systems/worldHover.js';
import { asTheRoom, rollingAsTheRoom } from '../../src/systems/online/onlineLane.js';
import { modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import * as RL from '../../src/systems/roomLoot.js';
import { ITEM_TEMPLATES } from '../../src/characters/paperdoll/paperdoll.js';
import { planTake, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { runBulk, bulkVerdict } from '../../src/ui/storeBulk.js';
import '../../src/systems/card/cardSources.js';   // CARDS9's death handler registers at import, as the hosts load it
import '../../src/scenes/physicalItemsLayer.js';   // PI1's

installForaging(); installSmithing(); installHealingSupply(); installRestItemLoot(); installSurvivalLoot();   // the hosts' order (scenes/shared.js), and the corpse food the online room mints
setPref(LOOT_RARITY_KEY, true);   // the loot ladder - forced on online (OL1)
setSigilOnline(true);   // an online page: the sigils' and the Renown's door

const SRC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(SRC, { ecmaVersion: 'latest', sourceType: 'module' });
/** HOST-SPLIT (FIELD BUGS 2026-10-14): the PARTY-LOOT block left buildDungeonContext for src/scenes/roomLootHost.js
 *  (createRoomLoot, moved by tools/hostMove.mjs) - read here as the dungeon host's is. */
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
/** A function of the block's, as the module holds it. */
const modFn = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name, MOD_AST); assert.ok(n, `roomLootHost.js has function ${name}`); return MOD.slice(n.start, n.end); };
const fnNode = (name) => find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
const fnSrc = (name) => { const n = fnNode(name); assert.ok(n, `src has function ${name}`); return SRC.slice(n.start, n.end); };
const optFn = (name) => { const n = fnNode(name); return n ? SRC.slice(n.start, n.end) : ''; };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `src declares ${name}`); return SRC.slice(n.start, n.end); };
const memberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `src has member ${name}`);
  const body = SRC.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
/** The PARTY-LOOT block whole, as the dungeon host runs it (absent before PARTY-LOOT). PIN MOVED (HOST-SPLIT): it was the
 *  host's own lines, from its banner to `const _retyping`; it is now the host's three counters and its construction of
 *  the module, both sliced from dungeonContext.js, under the module's own `createRoomLoot` sliced from roomLootHost.js -
 *  the host destructures the returns into the mount's scope, where its doors mounted beside it reach them, and the
 *  module's imports (the player, the mid-screen line) are this peer's, as the host's were. */
const PARTS = (() => {
  const ctor = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.init?.type === 'CallExpression' && d.init.callee?.name === 'createRoomLoot'));
  const fn = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === 'createRoomLoot', MOD_AST);
  const a = SRC.indexOf('  let _roomMintHold = 0;');
  if (!ctor || !fn || a < 0 || a > ctor.start) return null;
  const body = fn.body.body;
  assert.equal(body[body.length - 1].type, 'ReturnStatement', 'the module ends in its returns');
  const handles = ctor.declarations[0].init.arguments[0];
  return { lets: SRC.slice(a, ctor.start), fn: MOD.slice(fn.start, fn.end), ctor: SRC.slice(ctor.start, ctor.end), handles: SRC.slice(handles.start, handles.end), body: MOD.slice(body[0].start, body[body.length - 2].end) };
})();
const BLOCK = PARTS ? `${PARTS.lets}${PARTS.fn}\n  ${PARTS.ctor}\n` : '';
/** The block's own scope alone - the module's body under the host's handles (built outside it, so its by-value names
 *  are the mount's, never the body's own destructured copies of them), `tail` run in it with the block's internal
 *  members (rollRoomBase) in reach - for a mount with none of the host's doors beside it. */
const blockBody = (tail) => (PARTS ? `${PARTS.lets}const host = ${PARTS.handles};\n  {\n  ${PARTS.body}\n  ${tail}\n  }\n` : '');
/** The build's pile loop, its list and its open zone's ring - the two lines the build mints a pile's list with. */
const PILE_BUILD = (() => { const m = /\n(\s*const items = [^\n]*rollPileItems\(\);[^\n]*\n\s*if \(_wildDungeon[^\n]*)\n/.exec(SRC); assert.ok(m, 'the build mints a pile\'s list'); return m[1]; })();
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

const ROOM = 'dungeon:4242';
const DUNGEON_TYPE = 12;   // a Natural Cave's piles: key DUNGEON_LOOT_KEYS[12], one of the deep J-O keys (the potions, the rest supplies)
const ORC = 7;             // a humanoid foe with a table ('A'), a kit and PLAIN-LOOT's keep
const FOES = 6, PILES = 4;   // a room's handful: six layout bodies, four layout piles
const ELITE_FOE = 2;   // AUDIT UPDATE L1: the layout's elite - its base reads the most gates (the kit, the elite's share) of any body
const KEYS = [...Array.from({ length: FOES }, (_, i) => `corpse:${i}`), ...Array.from({ length: PILES }, (_, i) => `loot:${i}`)];
const clock = { t: 1_700_000_000_000 };

/** THE RELAY: every act frame queued, then handed to everyone in the room but its author, in each one's own world. */
function relay() {
  const peers = [];
  const q = [];
  const gone = new Set();
  const sent = [];   // every frame said, kept
  return {
    join(p) { peers.push(p); },
    send(from, data) { if (gone.has(from)) return false; const f = { from, data: JSON.parse(JSON.stringify(data)) }; q.push(f); sent.push(f); return true; },
    /** A peer leaves the room: gone from it, and whatever it had not yet said goes with it. */
    leave(p) { gone.add(p.id); const i = peers.indexOf(p); if (i >= 0) peers.splice(i, 1); for (let k = q.length - 1; k >= 0; k--) if (q[k].from === p.id) q.splice(k, 1); },
    flush() { while (q.length) { const { from, data } = q.shift(); for (const p of peers) if (p.id !== from) p.as(() => p.host.applyActions(from, data)); } },
    frames: q,
    sent,
  };
}

/** ONE PEER: a character (its level, Luck, Renown, dice and its own mod switch), and the real dungeon host's loot
 *  doors over one layout pile and one layout foe - built as the build builds them, on this peer's own roll. */
function peer(net, { id, level, luck, renown, seed, host, foraging, partners, characterId, seat = { id: host ? id : null } }) {
  const player = { level, gender: 'male', name: id, characterId, stats: { luck, strength: 60 }, activeEffects: [], items: [], goldPieces: 0 };
  const said = [];   // what the mid-screen line said to this player (the refusal's line)
  const own = lcg(seed);
  const as = (fn) => {
    const realRandom = Math.random;
    Math.random = own;
    setSigilRenown(renown);
    setModSetting(FORAGING_VENDOR, 'Enabled', foraging);
    registerRollerLevel(() => effectiveLevel(player));   // AUDIT UPDATE L1: the shipping client's LOOT-GATE registry - this peer's own level, never the room's
    try { return fn(); } finally { Math.random = realRandom; registerRollerLevel(null); }
  };
  const state = {
    foes: [], _layoutFoes: FOES, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: host, playerEntity: player, dfLocation: { mapTableData: { dungeonType: DUNGEON_TYPE } }, lootKey: DUNGEON_LOOT_KEYS[DUNGEON_TYPE],
    _superTier: false, _wildDungeon: false, _wildRing: null, _deepCleared: new Set(), _deepFoeCleared: new Set(),
    SUPER_LOOT_DROP_MULT: 1.5, ELITE_LOOT_DROP_MULT: 1.2, SUPER_LOOT_QUALITY_MULT: 1.5, ELITE_LOOT_QUALITY_MULT: 1.2,
    opts: { selfId: () => id, onActions: (data) => net.send(id, data), onLootClaimed: () => {}, partyLevels: () => partners, roomHost: () => seat.id },
    _foesFrom: host ? null : seat.id, _sharedStamp: `st${seed}`, _foesSeqIn: -1, clearSurplus: () => {},   // WORLD2: the host this client follows, and the seat's handover
    addItem, stacksWith, isGoldPieces, addGoldPieces, isEquipped, unequipItem, neverPeerHanded, notCarried,   // AUDIT AUTO-HOLD: the give asks it (offline here: no filter)
    onlineRoom: () => true, _wallNow: () => clock.t, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, ENEMY_BASICS, corpseTextureOf,   // AUDIT DEX A1: the corpse mints read it
    generateLootItems: generateItems, addPileLootExtras, rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons,
    spawnEnemyLoot, wildLootAfter, grantEliteLoot, rollCorpseKit, raiseEnemyDeath, capFoeLoot, rollRoomBonus,
    wildPileMore, seaPileMore, isDeepPileKey, effectiveLevel, liveStat, asTheRoom, withRollerLevel, CLAIM_KEEP_MS, CLAIMS_KEPT_MAX, SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX, sharedClassicMinutes, ...RL,
    eliteLootOpts: () => ({}), searchHeard: () => {}, settleLootFlat: () => {}, _sharedFoe: () => false, fightN: () => 1,
    spawnCorpseNow: async (f) => { f.corpsePos = [...f.ai.feet]; }, renderer: { destroyBillboardBatch: () => {} }, billboardBatches: [], renownFoeRevived: () => {},
    respawnFoe: () => false, camps: { applyOwner: () => {}, activate: () => false }, roomEncounterAsked: () => false, actions: { applyRemote: () => 0 },
    droppedLoot: { physical: { owns: () => false }, pileFor: () => null, lootFinds: () => [] }, lootCrown: (pos) => pos, droppedTorches: { activate: () => false }, plaqueActionFor: () => null,
    activateSearchable: () => 0, setMidScreenText: (t) => said.push(t), activeOverlay: null, silverFindKey: () => null, silverFindAt: () => {},
    quickLootTake, showPickups: null, lootPile: () => null, pileBody: () => null, openInventory: () => null, RANDOM_TREASURE_ARCHIVE: 216,
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
    ${optFn('setAuthority')}
    const api = { lootContents: ${memberSrc('lootContents')}, takeLoot: ${memberSrc('takeLoot')}, lootFinds: ${memberSrc('lootFinds')}, corpseKeyOf: ${memberSrc('corpseKeyOf')} };
    const buildPile = () => { ${PILE_BUILD}
      return items; };
    return { api, applyActions, setFoeDead, respawnSweep, rollPileItems, buildPile, publishLoot, setAuthority: typeof setAuthority === 'function' ? setAuthority : null, roomClaimTick: typeof roomClaimTick === 'function' ? roomClaimTick : () => {}, lootBuiltOf: typeof lootBuiltOf === 'function' ? lootBuiltOf : null, bases: typeof _roomBase === 'undefined' ? null : _roomBase };
  `, state);
  // THE BUILD, as dungeonContext builds it: the pile loop's own lines and buildFoeAt's chain, each on THIS peer's dice
  as(() => {
    for (let i = 0; i < PILES; i++) state.lootPiles.push({ pos: [i, 0, 0], record: 0, items: h.buildPile(), isFixed: false, batch: {}, half: [0.5, 0.5] });
    for (let i = 0; i < FOES; i++) {
      const entity = makeEnemyEntity(ORC, ENEMY_BASICS[ORC], null, effectiveLevel(player), Math.random);
      spawnEnemyLoot(entity, ORC, ENEMY_BASICS[ORC], player, { where: 'dungeon' });
      if (i === ELITE_FOE) entity.eliteFoe = true;   // AUDIT UPDATE L1: one of the layout's foes an elite, marked on every client alike (pickDungeonElites)
      const f = { mobileType: ORC, gender: 'male', entity, dead: false, corpse: false, src: { mobileType: ORC, ...(i === ELITE_FOE ? { eliteFoe: true } : {}) }, ai: { feet: [i, 0, 0] } };
      if (h.lootBuiltOf) f._lootBuilt = h.lootBuiltOf(entity);
      state.foes.push(f);
    }
  });
  const p = { id, host: h, state, player, as, said, seat };
  net.join(p);
  return p;
}

/** A room of two: A hosts (level 30, Luck 70, Ascendant Renown, Foraging on), B joins (level 3, Luck 30, Faint Renown,
 *  Foraging OFF) - in one party, so each one's party is the other. */
function room() {
  RL._resetRoomLootForTests();
  resetQuickLoot();
  const net = relay();
  const seat = { id: 'aaaa' };   // the relay's seat: A's
  const A = peer(net, { id: 'aaaa', level: 30, luck: 70, renown: 45, seed: 11, host: true, foraging: true, partners: [3], characterId: 'char-a', seat });
  const B = peer(net, { id: 'bbbb', level: 3, luck: 30, renown: 1, seed: 29, host: false, foraging: false, partners: [30], characterId: 'char-b', seat });
  return { net, A, B, seat };
}
/** A room of three: A hosts, B and C join (C at level 12, Luck 55, Renown 30 - a bonus of its own). */
function room3() {
  RL._resetRoomLootForTests();
  resetQuickLoot();
  const net = relay();
  const seat = { id: 'aaaa' };
  const A = peer(net, { id: 'aaaa', level: 30, luck: 70, renown: 45, seed: 11, host: true, foraging: true, partners: [3, 12], characterId: 'char-a', seat });
  const B = peer(net, { id: 'bbbb', level: 3, luck: 30, renown: 1, seed: 29, host: false, foraging: false, partners: [30, 12], characterId: 'char-b', seat });
  const C = peer(net, { id: 'cccc', level: 12, luck: 55, renown: 30, seed: 41, host: false, foraging: true, partners: [30, 3], characterId: 'char-c', seat });
  return { net, A, B, C, seat };
}
/** The foe falls (the host's death, then the stream's on the joiners) and the room settles: the sweep's minute, the words. */
function fall({ net, A, B, C = null }) {
  const all = [A, B, C].filter(Boolean);
  for (const p of all) p.as(() => { for (const f of p.state.foes) p.host.setFoeDead(f, true); });
  net.flush();
  clock.t += 2000;
  for (const p of all) p.as(() => { p.host.respawnSweep(clock.t / 1000); });
  net.flush();
  clock.t += 7000;
  for (const p of all) p.as(() => { p.host.respawnSweep(clock.t / 1000); });
  net.flush();
}
const shown = (p, key) => p.as(() => p.host.api.lootContents(key)) ?? [];
const sig = (it) => JSON.stringify(it);
const baseRows = (list) => list.filter((it) => !RL.isPersonalLoot(it)).map(sig);
const mineRows = (list) => list.filter((it) => RL.isPersonalLoot(it)).map(sig);
/** What a piece IS, whatever its count or its holder. */
const pieceKey = (it) => `${it.group}.${it.templateIndex}.${it.material ?? ''}.${it.name ?? ''}`;
/** How much of a piece a player holds: its coin in the purse, else its count across the pack. */
const holding = (p, it) => (isGoldPieces(it) ? (p.player.goldPieces ?? 0) : p.player.items.filter((x) => pieceKey(x) === pieceKey(it)).reduce((n, x) => n + RL.pieceCount(x), 0));
/** The quick door's press on a PIECE of `key` (by what it is), wherever it stands in this player's list. */
function quickTakePiece(p, key, piece) {
  const row = shown(p, key).findIndex((it) => pieceKey(it) === pieceKey(piece));
  assert.ok(row >= 0, `${p.id} sees ${piece.name} on ${key}`);
  return quickTake(p, key, row);
}
/** The quick door's press on row `row` of `key`, as the plaque lights it. */
function quickTake(p, key, row) {
  return p.as(() => {
    const items = p.host.api.lootContents(key);
    const { shown: rows, rest, empty } = hoverLines(items, Infinity);
    const frame = { key, kind: 'items', title: 'x', subs: [], rows, rest, empty };
    resetQuickLoot();
    foldQuickLoot(frame);
    for (let i = 0; i < row; i++) { quickLootWheel(1); foldQuickLoot(frame); }   // the wheel steps the light down a row, folded on the frame as the host folds it
    const took = items[row];
    p.host.api.takeLoot(key);
    return took;
  });
}

test('PARTY-LOOT: two players in one dungeon see ONE base for every body and every pile - the same pieces in the same order, whatever their levels, Luck, Renown, dice and mod switches (it was each one\'s own roll: the report\'s "Person A sees: Sword, Boots, 15 Gold. Person B sees: Dagger, 25 Gold, Potion")', () => {
  setPref('quickLoot', true);
  const r = room();
  // before the host's word: the joiner's fallen copy names nothing - none of its own roll is the room's (UNBORN)
  r.A.as(() => { for (const f of r.A.state.foes) r.A.host.setFoeDead(f, true); });
  r.B.as(() => { for (const f of r.B.state.foes) r.B.host.setFoeDead(f, true); });
  for (let i = 0; i < FOES; i++) assert.equal(r.B.as(() => r.B.host.api.lootContents(`corpse:${i}`)), null, `corpse:${i}: unborn on the joiner until the room's word comes`);
  for (let i = 0; i < PILES; i++) assert.equal(r.A.as(() => r.A.host.api.lootContents(`loot:${i}`)), null, `loot:${i}: unborn on the host too, until the memory has had its moment`);
  // ...and an unborn container HOLDS nothing: the readers no gate stands before - LOOT11's line of light over a find,
  // Hunting's body key - find none of a copy's own roll (the build rolls no pile of its own online; a fallen copy's own
  // list is emptied at its fall)
  assert.deepEqual(r.B.as(() => r.B.host.api.lootFinds()), [], 'no line of light on the joiner over its own roll');
  for (const f of r.B.state.foes) assert.equal(r.B.as(() => r.B.host.api.corpseKeyOf(f)), null, 'no body key on the joiner\'s own roll');
  for (const p of [r.A, r.B]) assert.ok(p.state.lootPiles.every((x) => x.items.length === 0), `${p.id}: no pile holds this player's own roll`);
  // the host minted every body at its death, at the party's level (SOFTCAP1's group reference of 30 and 3: 5)
  const births = r.net.frames.flatMap((q) => q.data.l ?? []);
  assert.deepEqual(births.map((w) => w.k).sort(), Array.from({ length: FOES }, (_, i) => `corpse:${i}`).sort(), 'one birth word a body, from the host');
  assert.ok(births.every((w) => w.lv === RL.roomBaseLevel(30, [3]) && w.lv === 5 && !('r' in w)), 'each at the party\'s level, and none of them a list');
  fall(r);
  let pieces = 0;
  for (const key of KEYS) {
    const a = baseRows(shown(r.A, key)), b = baseRows(shown(r.B, key));
    pieces += a.length;
    assert.deepEqual(b, a, `${key}: the joiner's plaque names exactly the host's base, piece for piece`);
  }
  const finds = (p) => p.as(() => p.host.api.lootFinds()).map((x) => x.items.filter((it) => !RL.isPersonalLoot(it)).map(sig));
  assert.deepEqual(finds(r.B), finds(r.A), 'and the line of light stands over the same base on both');
  assert.ok(pieces >= KEYS.length, `the room's base is a real roll (${pieces} pieces over ${KEYS.length} containers)`);
});

test('PARTY-LOOT: a take removes THE SAME PIECE for everyone - B quick-takes a row, and A\'s list loses that piece and keeps every other one; it was A\'s whole list replaced by B\'s leftovers ("Person A now sees 25 Gold, Potion")', () => {
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  let took = 0;
  for (const key of KEYS) {
    const before = baseRows(shown(r.A, key));
    if (!before.length) continue;
    const it = quickTake(r.B, key, 0);
    assert.ok(it && !RL.isPersonalLoot(it), `${key}: B took a base piece`);
    r.net.flush();
    const expect = before.slice(); expect.splice(expect.indexOf(sig(it)), 1);
    const after = baseRows(shown(r.A, key));
    assert.deepEqual(after, expect, `${key}: A's base lost the one piece B took and nothing else`);
    assert.deepEqual(baseRows(shown(r.B, key)), after, `${key}: and B sees what A sees`);
    took++;
  }
  assert.ok(took >= 4, `taken from ${took} containers`);
});

test('PARTY-LOOT: two takes in the same breath both land - A and B each take a different piece before either hears the other, and both lists lose both (WORLD4\'s last writer brought the slower one\'s take back)', () => {
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  let raced = 0;
  for (const key of KEYS) {
    const before = baseRows(shown(r.A, key));
    if (before.length < 2) continue;
    const a = quickTake(r.A, key, 0);
    const b = quickTake(r.B, key, 1);
    r.net.flush();
    const expect = before.slice();
    expect.splice(expect.indexOf(sig(a)), 1);
    expect.splice(expect.indexOf(sig(b)), 1);
    assert.deepEqual(baseRows(shown(r.A, key)), expect, `${key}: A sees both gone`);
    assert.deepEqual(baseRows(shown(r.B, key)), expect, `${key}: B sees both gone`);
    assert.ok(!shown(r.A, key).includes(a) && !shown(r.B, key).includes(b), `${key}: neither piece is back under its taker`);
    raced++;
  }
  assert.ok(raced >= 1, 'at least one container held two pieces to race over');
});

test('PARTY-LOOT: each player\'s BONUS is their own - rolled at their own Renown and Luck, marked theirs on the plaque, never in the room\'s word nor another\'s list, the same at every compose, and a piece taken stays taken through the character\'s save', () => {
  setPref('quickLoot', true);
  const r = room();
  const words = [];
  const send = r.net.send;
  r.net.send = (from, data) => { words.push(data); return send(from, data); };
  fall(r);
  const mineA = [];
  for (const key of KEYS) {
    const aList = shown(r.A, key), bList = shown(r.B, key);
    mineA.push(...mineRows(aList));
    assert.equal(mineRows(bList).length, 0, `${key}: B rolls at the base's own stage (Faint) - no bonus`);
    assert.equal(bList.length, baseRows(aList).length, `${key}: B's list is the base alone - none of A's own pieces`);
    const rows = r.A.as(() => hoverLines(aList, Infinity).shown);
    assert.equal(rows.filter((x) => x.mine).length, mineRows(aList).length, `${key}: the plaque marks A's own rows as A's`);
  }
  assert.ok(mineA.length >= 1, `A (Ascendant) holds a bonus somewhere in the room (${mineA.length} pieces)`);
  for (const w of words) for (const rec of w.l ?? []) for (const it of rec.s ?? []) assert.ok(!mineA.includes(sig(it)), 'no bonus piece rides the room\'s word');
  // the same bonus again for the same character, whatever the build's dice: a re-entry - the room's deaths and its words,
  // as a restore lands the room's memory (the words before the bodies fall here, the deaths at the room's own stamps)
  const reenter = (seed) => {
    const p = peer(relay(), { id: 'aaaa', level: 30, luck: 70, renown: 45, seed, host: true, foraging: true, partners: [3], characterId: 'char-a' });
    p.as(() => {
      p.state.foes.forEach((f, i) => { f._diedAt = r.A.state.foes[i]._diedAt; });
      p.host.applyActions('bbbb', { k: ROOM, l: words.flatMap((w) => w.l ?? []) });
      for (const f of p.state.foes) p.host.setFoeDead(f, true);
    });
    return p;
  };
  // spent: A takes one of their own pieces; the save records it, and a character loaded from that save finds it gone
  const key = KEYS.find((k) => shown(r.A, k).some(RL.isPersonalLoot));
  const list = shown(r.A, key);
  const mine = list.find(RL.isPersonalLoot);
  quickTake(r.A, key, list.indexOf(mine));
  r.A.as(() => r.A.host.publishLoot(key));
  const saved = JSON.parse(JSON.stringify(modSaveRecords()[RL.ROOM_BONUS_SAVE_VENDOR]));
  assert.ok(saved.spent.some(([k]) => k.endsWith('|char-a')), 'the character\'s save records the spent piece');
  RL._resetRoomLootForTests();
  const again = reenter(99);
  const fresh = KEYS.flatMap((key) => mineRows(shown(again, key)));
  assert.deepEqual(fresh, mineA, 'the same bonus at the same character\'s every compose');
  RL._resetRoomLootForTests();
  restoreModSaveRecords({ [RL.ROOM_BONUS_SAVE_VENDOR]: saved });
  const back = reenter(7);
  assert.equal(KEYS.flatMap((k) => mineRows(shown(back, k))).length, mineA.length - 1, 'a character loaded from that save finds every bonus piece but the one it took');
  assert.ok(!mineRows(shown(back, key)).includes(sig(mine)) || mineA.filter((x) => x === sig(mine)).length > 1, 'and not that one');
});

test('PARTY-LOOT, HOST ARBITRATES (Mac, 2026-10-15: "Host arbitrates"): the SAME piece taken by two players in one breath goes to ONE of them - the host\'s own take against a joiner\'s, two joiners\' against each other - and the loser is told "Someone took that first." and holds none of it (both kept it); the host\'s own take and a player\'s bonus wait on nobody', () => {
  setPref('quickLoot', true);
  // the host against a joiner: the host's take is judged where it stands, before the joiner's claim reaches it
  {
    const r = room();
    fall(r);
    let raced = 0;
    for (const key of KEYS) {
      const piece = shown(r.A, key).find((it) => !RL.isPersonalLoot(it));
      if (!piece) continue;
      const n = RL.pieceCount(piece), a0 = holding(r.A, piece), b0 = holding(r.B, piece);
      r.B.said.length = 0;
      quickTakePiece(r.A, key, piece);
      assert.equal(holding(r.A, piece) - a0, n, `${key}: the host's own take is in its pack at once - no round trip`);
      const like = (p) => shown(p, key).filter((it) => !RL.isPersonalLoot(it) && pieceKey(it) === pieceKey(piece)).length;
      const was = like(r.B);
      quickTakePiece(r.B, key, piece);   // B's plaque still names it: A's word has not come
      assert.equal(holding(r.B, piece) - b0, 0, `${key}: a joiner's take waits for the host's grant`);
      assert.equal(like(r.B), was - 1, `${key}: and reads as taken on B's own plaque meanwhile`);
      r.net.flush();
      assert.equal((holding(r.A, piece) - a0) + (holding(r.B, piece) - b0), n, `${key}: ONE copy between them`);
      assert.equal(holding(r.B, piece) - b0, 0, `${key}: the host had it first`);
      assert.ok(r.B.said.includes(RL.ROOM_TAKEN_TEXT), `${key}: and B is told so (said: ${JSON.stringify(r.B.said)})`);
      assert.deepEqual(baseRows(shown(r.B, key)), baseRows(shown(r.A, key)), `${key}: one list on both`);
      raced++;
    }
    assert.ok(raced >= 4, `raced over ${raced} containers`);
  }
  // two joiners against each other: the claim that reaches the host first holds the piece
  {
    const r = room3();
    fall(r);
    let raced = 0;
    for (const key of KEYS) {
      const piece = shown(r.B, key).find((it) => !RL.isPersonalLoot(it));
      if (!piece) continue;
      const n = RL.pieceCount(piece), b0 = holding(r.B, piece), c0 = holding(r.C, piece);
      r.B.said.length = 0; r.C.said.length = 0;
      quickTakePiece(r.B, key, piece);
      quickTakePiece(r.C, key, piece);
      r.net.flush();
      assert.equal(holding(r.B, piece) - b0, n, `${key}: B's claim reached the host first, and B holds the piece`);
      assert.equal(holding(r.C, piece) - c0, 0, `${key}: C holds none of it`);
      assert.ok(r.C.said.includes(RL.ROOM_TAKEN_TEXT) && !r.B.said.includes(RL.ROOM_TAKEN_TEXT), `${key}: the loser alone is told`);
      for (const p of [r.B, r.C]) assert.deepEqual(baseRows(shown(p, key)), baseRows(shown(r.A, key)), `${key}: ${p.id} sees the host's list`);
      raced++;
    }
    assert.ok(raced >= 4, `raced over ${raced} containers`);
    // a player's own bonus is theirs at once - never a claim, never the host's
    const key = KEYS.find((k) => shown(r.C, k).some(RL.isPersonalLoot));
    assert.ok(key, 'C (Renown 30) holds a bonus somewhere in the room');
    const mine = shown(r.C, key).find(RL.isPersonalLoot);
    const m0 = holding(r.C, mine), frames = r.net.frames.length;
    quickTake(r.C, key, shown(r.C, key).indexOf(mine));
    assert.equal(holding(r.C, mine) - m0, RL.pieceCount(mine), 'C\'s bonus piece is in its pack at once');
    assert.ok(r.net.frames.slice(frames).every((f) => (f.data.l ?? []).every((w) => !w.q)), 'and C claimed nothing of the host');
  }
  // nobody but the host says the room's state, and nobody claims in another's name
  {
    const r = room3();
    fall(r);
    const key = KEYS.find((k) => baseRows(shown(r.C, k)).length >= 1);
    const word = r.net.sent.map((f) => (f.from === 'aaaa' ? (f.data.l ?? []).find((w) => w.k === key && Number.isInteger(w.g)) : null)).find(Boolean);
    assert.ok(word, 'the host said the container');
    const onC = baseRows(shown(r.C, key)), onA = baseRows(shown(r.A, key));
    const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0, value: 10 };
    r.net.send('bbbb', { k: ROOM, l: [{ ...word, x: Array.from({ length: onC.length + 4 }, (_, i) => i), s: [dagger], si: ['bbbb:forged:1'] }] });
    r.net.send('bbbb', { k: ROOM, l: [{ k: word.k, g: word.g, lv: word.lv, ...(word.n ? { n: word.n } : {}), tm: word.tm, h: word.h, q: [{ id: 'cccc:forged:2', p: 0, n: 1, tm: clock.t }] }] });   // PIN MOVED (AUDIT OUTDOOR-LOOT D5): stamped now - a claim older than half CLAIM_KEEP_MS is refused for its age alone, and the forgery must be refused for its NAME
    r.net.flush();
    assert.deepEqual(baseRows(shown(r.C, key)), onC, 'a joiner\'s word saying takes lands none of them on another joiner');
    assert.ok(!shown(r.C, key).some((it) => it.name === 'Dagger'), 'nor its stored pieces');
    assert.deepEqual(baseRows(shown(r.A, key)), onA, 'nor on the host - and a claim in another\'s name is granted to nobody');
  }
});

test('PARTY-LOOT, HOST ARBITRATES: a host that LEAVES mid-claim neither dupes nor drops - the claims it left unanswered are judged by the next seat in one order (roomClaimOrder), each piece to one claimer, none twice, none lost; a claim with no verdict comes back to its claimer\'s list after ROOM_CLAIM_TIMEOUT_MS, and a verdict that comes late still lands', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => baseRows(shown(r.B, k)).length >= 3);
  assert.ok(key, 'a container with three pieces of the room\'s');
  const [x, y, z] = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  const n = (it) => RL.pieceCount(it);
  const b0 = { x: holding(r.B, x), y: holding(r.B, y), z: holding(r.B, z) }, c0 = { x: holding(r.C, x), y: holding(r.C, y) };
  // X: B's claim, answered by the host before it goes - granted, and said to everyone
  quickTakePiece(r.B, key, x);
  r.net.flush();
  assert.equal(holding(r.B, x) - b0.x, n(x), 'X is B\'s, granted by A');
  // Y: B and C claim it in one breath; Z: B alone - and A leaves before either reaches it
  quickTakePiece(r.B, key, y);
  quickTakePiece(r.C, key, y);
  quickTakePiece(r.B, key, z);
  r.net.leave(r.A);
  r.net.flush();   // the claims reach B and C, and nobody judges them
  assert.equal(holding(r.B, y) - b0.y + holding(r.C, y) - c0.y, 0, 'Y in nobody\'s pack while no seat answers');
  // no verdict in time: B's Z comes back to B's list (and is still B's claim, heard by C)
  clock.t += 100;
  r.B.as(() => r.B.host.roomClaimTick(10 * RL.ROOM_CLAIM_TIMEOUT_MS));
  assert.ok(shown(r.B, key).some((it) => pieceKey(it) === pieceKey(z)), 'Z is back on B\'s list after the timeout');
  assert.equal(holding(r.B, z) - b0.z, 0, 'and not in B\'s pack');
  // the seat passes to C (the relay's word, then WORLD2's handover)
  r.seat.id = 'cccc';
  r.B.said.length = 0; r.C.said.length = 0;
  r.C.as(() => r.C.host.setAuthority(true));
  r.net.flush();
  assert.equal((holding(r.B, y) - b0.y) + (holding(r.C, y) - c0.y), n(y), 'Y: ONE copy, judged by the new seat');
  assert.equal(holding(r.B, y) - b0.y, n(y), 'to B, whose claim comes first in the one order (the same clock, the lower id)');
  assert.ok(r.C.said.includes(RL.ROOM_TAKEN_TEXT), 'and C is told');
  assert.equal(holding(r.B, z) - b0.z, n(z), 'Z: B\'s claim, unanswered when A left and timed out since, granted late - not lost');
  assert.equal(holding(r.B, x) - b0.x, n(x), 'X: still B\'s once, never judged again');
  assert.equal(holding(r.C, x) - c0.x, 0, 'and never C\'s');
  for (const it of [x, y, z]) assert.ok(![r.B, r.C].some((p) => shown(p, key).some((s) => pieceKey(s) === pieceKey(it) && !RL.isPersonalLoot(s))), `${it.name}: gone from both lists`);
  assert.deepEqual(baseRows(shown(r.B, key)), baseRows(shown(r.C, key)), 'one list under the new seat');
});

test('OUTDOOR-LOOT (a claim GIVEN UP): a joiner\'s claim no seat answered for CLAIM_KEEP_MS is let go where its claimer heard it too - the claimer taking the seat later does not grant it to nobody: the piece stands in the room and in no pack', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => baseRows(shown(r.B, k)).length >= 1);
  assert.ok(key, 'a container with a piece of the room\'s');
  const [z] = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  const b0 = holding(r.B, z);
  const listed = (p) => shown(p, key).some((it) => pieceKey(it) === pieceKey(z) && !RL.isPersonalLoot(it));
  quickTakePiece(r.B, key, z);
  r.net.leave(r.A);
  r.net.flush();   // the claim reaches C, and nobody judges it
  clock.t += 100;
  r.B.as(() => r.B.host.roomClaimTick(CLAIM_KEEP_MS + RL.ROOM_CLAIM_TIMEOUT_MS));
  assert.equal(holding(r.B, z) - b0, 0, 'given up: not in B\'s pack (guard)');
  assert.ok(listed(r.B), 'and back on B\'s list (guard)');
  r.seat.id = r.B.id;
  r.B.as(() => r.B.host.setAuthority(true));
  r.net.flush();
  assert.ok(listed(r.B), 'B, now the seat, still lists the piece - it did not grant itself a claim it had given up');
  assert.ok(listed(r.C), 'and so does C');
  assert.equal(holding(r.B, z) - b0, 0, 'and it is in nobody\'s pack');
});

test('AUDIT OUTDOOR-LOOT D5 (a claim GIVEN UP, a THIRD seat): a claim its claimer let go is not granted by another client that heard it and takes the seat later - granted, the piece left the room for nobody; it stands in the room and in no pack', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => baseRows(shown(r.B, k)).length >= 1);
  assert.ok(key, 'a container with a piece of the room\'s');
  const [z] = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  const b0 = holding(r.B, z), c0 = holding(r.C, z);
  const listed = (p) => shown(p, key).some((it) => pieceKey(it) === pieceKey(z) && !RL.isPersonalLoot(it));
  quickTakePiece(r.B, key, z);
  r.net.leave(r.A);
  r.net.flush();   // the claim reaches C, and nobody judges it
  clock.t += CLAIM_KEEP_MS + RL.ROOM_CLAIM_TIMEOUT_MS;   // the shared clock runs on with no seat
  r.B.as(() => r.B.host.roomClaimTick(CLAIM_KEEP_MS + RL.ROOM_CLAIM_TIMEOUT_MS));
  assert.equal(holding(r.B, z) - b0, 0, 'B gave the claim up: the piece is not in its pack (guard)');
  r.seat.id = r.C.id;
  r.C.as(() => r.C.host.setAuthority(true));
  r.net.flush();
  assert.ok(listed(r.C), 'D5: C, now the seat, still lists the piece - it granted nobody a claim its claimer had let go');
  assert.ok(listed(r.B), 'and so does B');
  assert.equal((holding(r.B, z) - b0) + (holding(r.C, z) - c0), 0, 'and it is in nobody\'s pack');
});

test('AUDIT OUTDOOR-LOOT D4 (the HOST\'s put, then a split under the same window): the room stores the put\'s own copy, never the window\'s record - a split of it took from the judge\'s record and four arrows left the world', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = 'loot:0';
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Arrow');
  const arrows = { group: 'Weapons', templateIndex: t.index, name: 'Arrow', material: 0, value: 1, stackCount: 10, currentCondition: t.hitPoints ?? 1, maxCondition: t.hitPoints ?? 1 };
  assert.equal(validLootList([arrows])?.length, 1, 'the arrows are a piece the room carries (guard)');
  r.A.player.items.push(arrows);
  const held = (p) => p.player.items.filter((x) => x.name === 'Arrow').reduce((n, x) => n + RL.pieceCount(x), 0);
  const listed = (p) => shown(p, key).filter((x) => x.name === 'Arrow' && !RL.isPersonalLoot(x)).reduce((n, x) => n + RL.pieceCount(x), 0);
  r.A.state._lootOpenKey = key;   // the host's window stands open on the pile
  const list = shown(r.A, key);
  r.A.as(() => applyTransfer(arrows, { ok: true, amount: 10 }, r.A.player.items, list, { entity: r.A.player, fromLocal: true }));   // the window's put of the stack
  r.A.as(() => r.A.host.roomClaimTick(clock.t));
  r.net.flush();
  const inList = list.find((x) => x.name === 'Arrow');
  const plan = planTake(inList, { bag: r.A.player.items, entity: null, mode: 'remove' });
  r.A.as(() => applyTransfer(inList, { ...plan, amount: 4 }, list, r.A.player.items, { entity: r.A.player, toPlayer: true }));   // four back, under the same window
  r.A.as(() => r.A.host.roomClaimTick(clock.t));
  r.net.flush();
  r.A.state._lootOpenKey = null;
  r.A.as(() => r.A.host.roomClaimTick(clock.t + 100));
  r.net.flush();
  clock.t += 5000;
  for (const p of [r.A, r.B, r.C]) p.as(() => p.host.roomClaimTick(clock.t));
  r.net.flush();
  assert.equal(held(r.A), 4, 'the host holds the four it took back');
  for (const p of [r.A, r.B, r.C]) assert.equal(listed(p), 6, `D4: ${p.id}'s pile shows the six left (${listed(p)})`);
});

test('PARTY-LOOT, HOST ARBITRATES: the WINDOW\'s takes are claims too, and so is a piece the host takes under its own open window after the room granted it to another (AUDIT WORLD4 C1 - nothing lands under it, so it still showed); a PUT is the host\'s to land, and a stored piece raced for goes to one', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => shown(r.B, k).filter((it) => !RL.isPersonalLoot(it) && !isGoldPieces(it)).length >= 1);
  assert.ok(key, 'a container holding a piece that is not coin');
  const p = shown(r.B, key).find((it) => !RL.isPersonalLoot(it) && !isGoldPieces(it));
  const a0 = holding(r.A, p), b0 = holding(r.B, p), c0 = holding(r.C, p);
  // the host's window stands open on the container; B takes the piece and the host grants it
  r.A.state._lootOpenKey = key;
  quickTakePiece(r.B, key, p);
  r.net.flush();
  assert.equal(holding(r.B, p) - b0, RL.pieceCount(p), 'B holds it, granted');
  const aList = shown(r.A, key);
  const there = aList.find((it) => !RL.isPersonalLoot(it) && pieceKey(it) === pieceKey(p));
  assert.ok(there, 'and the host\'s open window still shows it (C1)');
  // the host's window moves it into the host's pack - the take is judged against the room, and refused
  r.A.said.length = 0;
  aList.splice(aList.indexOf(there), 1);
  addItem(r.A.player.items, there);
  r.A.as(() => r.A.host.roomClaimTick(clock.t));
  assert.equal(holding(r.A, p) - a0, 0, 'the host holds none of it: the room had granted it to B');
  assert.ok(r.A.said.includes(RL.ROOM_TAKEN_TEXT), 'and the host is told');
  r.A.state._lootOpenKey = null;
  r.A.as(() => r.A.host.publishLoot(key));
  r.net.flush();
  // B's window lays the piece back in: a put, landed by the host and seen by everyone as the room's stored piece
  const bList = shown(r.B, key);
  const held = r.B.player.items.find((x) => pieceKey(x) === pieceKey(p));
  r.B.player.items.splice(r.B.player.items.indexOf(held), 1);
  bList.push(held);
  r.B.as(() => r.B.host.roomClaimTick(clock.t));
  r.net.flush();
  for (const peerOf of [r.A, r.B, r.C]) assert.equal(shown(peerOf, key).filter((it) => !RL.isPersonalLoot(it) && pieceKey(it) === pieceKey(p)).length, 1, `${peerOf.id}: the put stands in the container once`);
  assert.equal(holding(r.B, p) - b0, 0, 'and B holds it no more');
  // B and C race for the stored piece: one copy
  r.B.said.length = 0; r.C.said.length = 0;
  quickTakePiece(r.C, key, p);
  quickTakePiece(r.B, key, p);
  r.net.flush();
  assert.equal((holding(r.B, p) - b0) + (holding(r.C, p) - c0), RL.pieceCount(p), 'one copy of the stored piece');
  assert.equal(holding(r.C, p) - c0, RL.pieceCount(p), 'to C, whose claim reached the host first');
  assert.ok(r.B.said.includes(RL.ROOM_TAKEN_TEXT), 'and B is told');
  for (const peerOf of [r.A, r.B, r.C]) assert.equal(shown(peerOf, key).filter((it) => !RL.isPersonalLoot(it) && pieceKey(it) === pieceKey(p)).length, 0, `${peerOf.id}: gone from the container`);
});

test('PARTY-LOOT: THE BASE IS THE ROOM\'S ROLL ALONE - one name and one set of terms give one list under any player\'s level, Luck, Renown, finders, mod switches and dice, and no draw of it reaches Math.random', () => {
  const r = room();
  fall(r);
  const lists = new Map();
  for (const p of [r.A, r.B]) {
    // a pile's every generation in a run of them, so a term one player could reach (their Luck on the ladder's every
    // threshold, their finders) shows somewhere in the run
    for (const [key, g] of [...['loot:0', 'loot:3'].flatMap((k) => Array.from({ length: 24 }, (_, g) => [k, g])), ['corpse:0', 0], ['corpse:5', 0]]) {
      const terms = { g, lv: 9, n: 2, tm: 5 };
      const got = p.as(() => {
        const own = Math.random;
        Math.random = () => { if (rollingAsTheRoom()) throw new Error(`${key}: a base draw reached Math.random`); return own(); };
        try { return sig(mount(blockBody('return { rollRoomBase };'),{ ...p.state, rollPileItems: p.host.rollPileItems }).rollRoomBase(key, terms).items); }
        finally { Math.random = own; }
      });
      if (lists.has(`${key}#${g}`)) assert.equal(got, lists.get(`${key}#${g}`), `${key}#${g}: one list on both machines`);
      else lists.set(`${key}#${g}`, got);
    }
  }
  assert.ok([...lists.values()].some((v) => v !== '[]'), 'and it is a real roll');
});

test('PARTY-LOOT by source: no Math.random in the room\'s law (systems/roomLoot.js) nor in the dungeon\'s PARTY-LOOT block; the base rolls inside asTheRoom; the readers turn an unborn container away; the kill, the stream and the memory roll nothing of their own onto a room body', () => {
  const strip = (t) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(strip(readFileSync(new URL('../../src/systems/roomLoot.js', import.meta.url), 'utf8')), /Math\.random/, 'the room\'s law draws only on its seeded dice');
  assert.ok(BLOCK, 'the dungeon carries the PARTY-LOOT block (PIN MOVED, HOST-SPLIT: constructed from src/scenes/roomLootHost.js)');
  assert.doesNotMatch(strip(BLOCK), /Math\.random/, 'and the block takes no draw of its own');
  assert.match(modFn('rollRoomBase'), /asTheRoom\(\(\) => withRollerLevel\(terms\.lv, \(\) => \{\s*if \(h\.pile\) items = roomPileBase\(h, terms, rolls, gender\);\s*else \(\{ items, lootCap \} = roomBodyBase\(h\.foe, terms, rolls, gender, rejects\)\);\s*\}\)\);/);   // PIN MOVED (AUDIT UPDATE L1): and at the room's level, every LOOT-GATE under it
  assert.match(modFn('roomBodyBase'), /spawnEnemyLoot\(e, f\.mobileType, ENEMY_BASICS\[f\.mobileType\], roller, \{ \.\.\.eliteLootOpts\(f\.src\), where: 'dungeon', \.\.\.o, rejects \}\);/);
  assert.match(memberSrc('lootContents'), /if \(\(kind === 'loot' \|\| kind === 'corpse'\) && \(roomUnborn\(key\) \|\| _lootUnreadable\.has\(roomLootKey\(key\)\)\)\) return null;/);   // PIN MOVED (AUDIT GRAVE-PARTY G2): nor a container whose word this build cannot read - a target again, its plaque naming no list (test/systems/fb1016b_graveparty.test.js)
  assert.match(memberSrc('takeLoot'), /if \(\(kind === 'loot' \|\| kind === 'corpse'\) && roomUnborn\(key\)\) return 0;/);
  assert.match(fnSrc('lootTargets'), /if \(!p\.batch \|\| roomUnborn\(`loot:\$\{i\}`\)\) return;/);
  assert.match(SRC, /const _roomBody = roomLootOn\(\) && roomCanonOfFoe\(foe\) != null;\s*if \(!_roomBody\) rollCorpseKit/);
  assert.match(SRC, /if \(r\.d === 1 && !f\.dead && !\(roomLootOn\(\) && roomCanonOfFoe\(f\) != null\)\) \{ rollCorpseKit/);
  assert.match(SRC, /if \(wire && sf\.dead && !f\.dead && sf\.items == null && !\(roomLootOn\(\) && roomCanonOfFoe\(f\) != null\)\) \{ rollCorpseKit/);
  assert.match(fnSrc('spawnCorpse'), /f\.corpse = true;\s*roomBodyBorn\(f\);/);
  assert.match(fnSrc('publishLoot'), /if \(isRoomBaseContainer\(canon\)\) return sayRoomWord\(canon, claim\);/);
  assert.match(fnSrc('applyLoot'), /if \(isRoomBaseContainer\(canon\)\) \{ n \+= landRoomWord\(canon, rec, from\); continue; \}/);
  // HOST ARBITRATES: the takes read every frame, the seat's handover judging what the last host left, and a claim in
  // flight leaving with its claimer when the dungeon goes
  assert.match(SRC, /respawnSweep\(_ecvT\);[^\n]*\n\s*roomClaimTick\(_ecvT \* 1000\);/);
  assert.match(fnSrc('setAuthority'), /clearSurplus\(\);[^\n]*\n\s*if \(on\) roomTakeSeat\(\);/);
  assert.match(SRC, /droppedLoot\.physical\.destroy\(\);[^\n]*\n\s*for \(const m of _roomMine\.values\(\)\) if \(m\.claim && !m\.lapsed\) roomGive\(m\.item, m\.give\);/);
});

test('PARTY-LOOT: the word and its merge - projected and bounded; takes merge the same in either order and never come back; a WORLD4 list (an older build\'s, a memory from before) is migrated on every machine alike, never landed over the base', () => {
  assert.equal(RL.validRoomWord({ g: 0, lv: 0 }), null, 'a level of none is no term');
  assert.equal(RL.validRoomWord({ g: -1, lv: 3 }), null);
  assert.equal(RL.validRoomWord({ g: 0, lv: 3, x: [1, 1] }), null, 'a place gone twice');
  assert.equal(RL.validRoomWord({ g: 0, lv: 3, x: [RL.ROOM_BASE_MAX] }), null);
  assert.equal(RL.validRoomWord({ g: 0, lv: 3, c: [[0, 0]] }), null, 'a stack drawn to nothing is a place gone, not a count');
  assert.equal(RL.validRoomWord({ g: 0, lv: 3, s: [{ group: 'Weapons' }] }), null, 'a stored piece no template carries');
  const w = RL.validRoomWord({ g: 0, lv: 3, tm: 7, x: [2], c: [[0, 4]], s: [] });
  assert.deepEqual(w, { g: 0, lv: 3, n: 1, tm: 7, x: [2], c: [[0, 4]], s: [], si: [], q: [], a: [], y: [] });
  const one = RL.mergeRoomWord(RL.mergeRoomWord(null, { ...w, x: [2], c: [] }).state, { ...w, x: [1], c: [[0, 4]] }).state;
  const two = RL.mergeRoomWord(RL.mergeRoomWord(null, { ...w, x: [1], c: [[0, 4]] }).state, { ...w, x: [2], c: [] }).state;
  assert.deepEqual([[...one.taken].sort(), [...one.counts]], [[...two.taken].sort(), [...two.counts]], 'either order, one state');
  assert.equal(RL.mergeRoomWord(one, { ...w, x: [], c: [[0, 9]] }).state.counts.get(0), 4, 'a count only falls');
  assert.equal(RL.mergeRoomWord(one, { ...w, lv: 4, tm: 99 }).changed, false, 'a later mint of another base loses');
  assert.ok(RL.roomTermsBeat({ g: 5, lv: 9, tm: 99 }, { g: 0, lv: 1, tm: 0 }), 'a newer generation beats any mint of the old');
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  const old = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0, value: 10 }];
  r.net.send('zzzz', { k: ROOM, l: [{ k: 'loot:0', r: old }] });
  r.net.flush();
  for (const p of [r.A, r.B]) assert.deepEqual(shown(p, 'loot:0').filter((it) => !RL.isPersonalLoot(it)).map((it) => it.name), ['Dagger'], `${p.id}: the old word is the room's - its list stored, every base piece gone`);
});

// ═══ OUTDOOR-LOOT, SLICE 3 - D-2.1: THE DUNGEON'S TAKE ALL LOSS (DESIGN-REVIEW D-2 item 1; DESIGN 9 item 9, recorded) ════════
// Two losses PARTY-LOOT's block carried (scenes/roomLootHost.js):
//   - a CLAIMER's word said `q.slice(-ROOM_CLAIMS_MAX)`: the oldest claims of a Take all past 32 were never said, and a claim
//     was never said AGAIN (only a put was) - so those pieces lapsed back unclaimed, and a verdict frame the relay dropped was
//     never asked for twice;
//   - a HOST's word said `recentAnswers(st)`, the newest ROOM_ANSWERS_KEPT (32) verdicts: two bulk takes judged together pushed
//     a claimer's verdict out of the word that carried its piece's removal - the piece left the list and reached nobody.
// The pieces are the host's own PUTS (stored pieces: the host lays them in the body's list, judged at once, said to everyone),
// the bulk take is the window's own walk (ui/storeBulk.js runBulk over planTake/applyTransfer, test/ui/lootbulk.test.js's
// drive), and the outcome asserted is WHERE EACH PIECE IS for every player once every timeout has passed.
const BULK_N = 40;
/** `n` distinct weapons, every one a piece of its own (a template and a metal), each through the item law the wire applies. */
function distinctPieces(n) {
  const names = ['Dagger', 'Tanto', 'Staff', 'Shortsword', 'Broadsword', 'Saber', 'Longsword', 'Katana', 'Claymore', 'Mace', 'Flail', 'Warhammer', 'Battle Axe', 'War Axe', 'Short Bow', 'Long Bow'];
  const out = [];
  for (const material of [0, 1, 2, 3]) {
    for (const name of names) {
      const t = ITEM_TEMPLATES.find((x) => x.name === name);
      const it = { group: 'Weapons', templateIndex: t.index, name, material, value: 10 + out.length, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50 };
      if (validLootList([it])?.length === 1) out.push(it);
      if (out.length === n) return out;
    }
  }
  assert.fail(`${n} distinct valid pieces`);
}
/** The host lays `pieces` in the body's list (its window's puts): judged at once, stored, said to everyone. */
function stockBody(r, key, pieces) {
  shown(r.A, key).push(...pieces.map((it) => ({ ...it })));
  r.A.as(() => r.A.host.roomClaimTick(clock.t));
  r.net.flush();
  for (const peerOf of [r.A, r.B, r.C].filter(Boolean)) assert.ok(pieces.every((it) => shown(peerOf, key).some((s) => pieceKey(s) === pieceKey(it))), `${peerOf.id}: sees the ${pieces.length} stored pieces (guard)`);
}
/** The window's Take all (LOOT-BULK) over `rows` of `key`'s list as `p` sees it - the walk, from the top, through the single click's plan. */
function takeAll(p, key, pick = () => true) {
  const list = shown(p, key);
  const bag = p.player.items;
  const { moved } = runBulk(list.filter((it) => !RL.isPersonalLoot(it) && pick(it)), (item) => {
    if (!list.includes(item)) return { verdict: 'skip' };
    const plan = planTake(item, { bag, entity: null, mode: 'remove' });   // no carry gate: forty weapons outweigh any pack, and the weight is not what is under test
    return { verdict: bulkVerdict(item, plan), refusal: plan.refusal, plan };
  }, (item, d) => { applyTransfer(item, { ...d.plan, amount: d.plan.amount }, list, bag, { entity: p.player, toPlayer: true }); });
  p.as(() => p.host.roomClaimTick(clock.t));
  return moved;
}
/** Every timeout passed: the claims' lapse, the re-says and the late verdicts, each peer ticked and the relay flushed, a few rounds. */
function settleAll(r, rounds = 12) {
  for (let i = 0; i < rounds; i++) {
    clock.t += RL.ROOM_CLAIM_TIMEOUT_MS;
    for (const peerOf of [r.A, r.B, r.C].filter(Boolean)) peerOf.as(() => peerOf.host.roomClaimTick(clock.t));
    r.net.flush();
  }
}
const wholeKey = (it) => pieceKey(it);
/** What a list holds of each piece, counted together: two pieces alike (the body's own roll, on the clock's dice, can hold one the
 *  same as a stored piece) are one count - read one by one, each was "got twice" (AUDIT OUTDOOR-LOOT: a flake at one moment of the
 *  clock, never a dupe). */
const wantedByKey = (list) => list.reduce((m, it) => m.set(wholeKey(it), (m.get(wholeKey(it)) ?? 0) + RL.pieceCount(it)), new Map());
const firstOfEach = (list) => list.filter((it, i) => list.findIndex((x) => wholeKey(x) === wholeKey(it)) === i);
/** Where a piece is, for every player: `held` the copies in packs, `listed` the copies in lists. */
function whereIs(players, key, it) {
  const held = players.reduce((n, p) => n + holding(p, it), 0);
  const listed = players.reduce((n, p) => n + shown(p, key).filter((s) => !RL.isPersonalLoot(s) && wholeKey(s) === wholeKey(it)).length, 0);
  return { held, listed };
}

test('OUTDOOR-LOOT D-2.1 (Take all, one claimer): a joiner\'s Take all of a body holding FORTY stored pieces lands every one of them exactly once - claims go in consecutive words of 32 and the host answers each (the oldest eight were never said: only q.slice(-32) was, and they lapsed back unclaimed)', () => {
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  const key = KEYS.find((k) => k.startsWith('corpse:'));
  const pieces = distinctPieces(BULK_N);
  stockBody(r, key, pieces);
  const wanted = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  assert.ok(wanted.length >= BULK_N, `the body holds ${wanted.length} pieces of the room's`);
  const before = new Map(wanted.map((it) => [wholeKey(it), holding(r.B, it)]));
  const moved = takeAll(r.B, key);
  assert.equal(moved, wanted.length, `the walk moved every row (${moved} of ${wanted.length})`);
  settleAll(r);
  const lost = [], duped = [], stuck = [];
  const want = wantedByKey(wanted);
  for (const it of firstOfEach(wanted)) {
    const w = whereIs([r.A, r.B], key, it), got = holding(r.B, it) - before.get(wholeKey(it)), n = want.get(wholeKey(it));
    if (w.listed) stuck.push(it.name);
    else if (got < n) lost.push(`${it.name}#${it.material}`);
    else if (got > n || holding(r.A, it) > 0) duped.push(it.name);
  }
  assert.deepEqual({ lost, duped, stuck }, { lost: [], duped: [], stuck: [] }, `D-2.1: of ${wanted.length} pieces B took with one Take all, ${lost.length} reached nobody and ${stuck.length} lapsed back into the body (lost = [${lost.slice(0, 4)}...]) - B's word said only q.slice(-${RL.ROOM_CLAIMS_MAX}), so the oldest claims were never said, and a claim was never said again`);
});

test('AUDIT OUTDOOR-LOOT (D-2.1\'s consecutive words, at once): a joiner\'s Take all of FORTY lands every piece in ONE round of the relay - no re-say, no time passing: every claim goes in consecutive words of 32 and every verdict comes back the same way (a word of the newest 32 claims, or of the first 32 verdicts, left eight for the re-say)', () => {
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  const key = KEYS.find((k) => k.startsWith('corpse:'));
  stockBody(r, key, distinctPieces(BULK_N));
  const wanted = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  assert.ok(wanted.length > RL.ROOM_CLAIMS_MAX, `more pieces than one word carries (${wanted.length}) (guard)`);
  const before = new Map(wanted.map((it) => [wholeKey(it), holding(r.B, it)]));
  assert.equal(takeAll(r.B, key), wanted.length, 'the walk moved every row (guard)');
  r.net.flush();   // the claim words reach the host, judged on receipt, and its verdict words come straight back - one round, nothing re-said
  const want = wantedByKey(wanted);
  const short = firstOfEach(wanted).filter((it) => holding(r.B, it) - before.get(wholeKey(it)) < want.get(wholeKey(it))).map((it) => it.name);
  assert.deepEqual(short, [], `every piece is B's after one round (${short.length} of ${wanted.length} waiting on a re-say)`);
});

test('OUTDOOR-LOOT D-2.1 (judged together): two joiners\' bulk takes of one body are judged by the NEW SEAT in one go (the old host left with both unanswered) - every verdict reaches its claimer and every piece is in exactly one place (a host word said only the newest 32 verdicts: the first eight of B\'s were pushed out, and those pieces left the list and reached nobody)', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => k.startsWith('corpse:'));
  const pieces = distinctPieces(BULK_N);
  stockBody(r, key, pieces);
  const stored = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it) && pieces.some((p) => wholeKey(p) === wholeKey(it)));
  assert.equal(stored.length, BULK_N);
  const mineB = new Set(stored.slice(0, 20).map(wholeKey)), mineC = new Set(stored.slice(20).map(wholeKey));
  const b0 = new Map(stored.map((it) => [wholeKey(it), holding(r.B, it)])), c0 = new Map(stored.map((it) => [wholeKey(it), holding(r.C, it)]));
  r.net.leave(r.A);   // the host goes with neither bulk take answered
  takeAll(r.B, key, (it) => mineB.has(wholeKey(it)));
  takeAll(r.C, key, (it) => mineC.has(wholeKey(it)));
  r.net.flush();
  r.seat.id = 'cccc';
  r.C.as(() => r.C.host.setAuthority(true));   // the relay's seat passes to C, which judges all forty claims at once
  r.net.flush();
  settleAll(r);
  const lost = [], duped = [], stuck = [];
  for (const it of stored) {
    const b = holding(r.B, it) - b0.get(wholeKey(it)), c = holding(r.C, it) - c0.get(wholeKey(it)), w = whereIs([r.B, r.C], key, it);
    if (w.listed) stuck.push(it.name);
    else if (b + c === 0) lost.push(`${it.name}#${it.material}`);
    else if (b + c > RL.pieceCount(it)) duped.push(it.name);
  }
  assert.deepEqual({ lost, duped, stuck }, { lost: [], duped: [], stuck: [] }, `D-2.1: of ${BULK_N} pieces taken by two bulk takes judged together, ${lost.length} are in nobody's pack (${lost.slice(0, 4)}...), ${stuck.length} are back in the body: the seat's word carried only the newest ${RL.ROOM_ANSWERS_KEPT} verdicts`);
  const mine = (set, p, c0m) => stored.filter((it) => set.has(wholeKey(it)) && holding(p, it) - c0m.get(wholeKey(it)) === 0).map((it) => it.name);
  assert.deepEqual(mine(mineB, r.B, b0), [], 'every piece B took is B\'s (the first come at the seat: the lower claim id)');
  assert.deepEqual(mine(mineC, r.C, c0), [], 'and every piece C took is C\'s');
});

test('AUDIT OUTDOOR-LOOT (D-2.1\'s consecutive verdicts, at once): a joiner\'s Take all of FORTY, judged together by the NEW SEAT, reaches its claimer in ONE round - the verdicts in consecutive words of 32 (a word of the first 32 left eight for the re-say)', () => {
  setPref('quickLoot', true);
  const r = room3();
  fall(r);
  const key = KEYS.find((k) => k.startsWith('corpse:'));
  stockBody(r, key, distinctPieces(BULK_N));
  const wanted = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it));
  assert.ok(wanted.length > RL.ROOM_ANSWERS_KEPT, `more claims than one word answers (${wanted.length}) (guard)`);
  const before = new Map(wanted.map((it) => [wholeKey(it), holding(r.B, it)]));
  r.net.leave(r.A);   // the host goes with nothing answered
  assert.equal(takeAll(r.B, key), wanted.length, 'the walk moved every row (guard)');
  r.net.flush();   // C hears every claim; nobody judges them
  r.seat.id = 'cccc';
  r.C.as(() => r.C.host.setAuthority(true));   // the relay's seat passes to C, which judges them all at once
  r.net.flush();   // its verdict words reach B - one round, nothing said again
  const want = wantedByKey(wanted);
  const short = firstOfEach(wanted).filter((it) => holding(r.B, it) - before.get(wholeKey(it)) < want.get(wholeKey(it))).map((it) => it.name);
  assert.deepEqual(short, [], `every piece is B's after one round (${short.length} waiting on a re-say)`);
});

test('OUTDOOR-LOOT D-2.1 (a verdict frame the relay dropped): the host\'s word with a joiner\'s verdicts is lost; the joiner says its claims AGAIN until answered, the host answers them from its ledger (never judged twice), and every piece lands once (a claim was never said again)', () => {
  setPref('quickLoot', true);
  const r = room();
  fall(r);
  const key = KEYS.find((k) => k.startsWith('corpse:'));
  const pieces = distinctPieces(12);
  stockBody(r, key, pieces);
  const stored = shown(r.B, key).filter((it) => !RL.isPersonalLoot(it) && pieces.some((p) => wholeKey(p) === wholeKey(it)));
  const b0 = new Map(stored.map((it) => [wholeKey(it), holding(r.B, it)]));
  takeAll(r.B, key, (it) => stored.includes(it));
  // B's claims reach the host, which judges them; the word that carries its verdicts back is dropped by the relay
  const claims = r.net.frames.filter((f) => f.from === 'bbbb');
  assert.ok(claims.length >= 1, 'B said its claims (guard)');
  r.net.frames.splice(0, r.net.frames.length);
  for (const f of claims) r.A.as(() => r.A.host.applyActions(f.from, f.data));
  const answers = r.net.frames.filter((f) => f.from === 'aaaa' && (f.data.l ?? []).some((w) => Array.isArray(w.y) && w.y.length));
  assert.ok(answers.length >= 1, 'the host answered B\'s claims in a word of verdicts (guard)');
  r.net.frames.splice(0, r.net.frames.length);   // dropped on the way back
  assert.equal(stored.some((it) => holding(r.B, it) - b0.get(wholeKey(it)) > 0), false, 'nothing of it landed yet (guard)');
  settleAll(r);
  const lost = stored.filter((it) => holding(r.B, it) - b0.get(wholeKey(it)) !== RL.pieceCount(it)).map((it) => it.name);
  assert.deepEqual(lost, [], `D-2.1: ${lost.length} of ${stored.length} pieces whose verdict frame was dropped never reached B - its claims were not said again`);
  for (const it of stored) assert.equal(holding(r.A, it), 0, `${it.name}: not in the host's pack either`);
  for (const it of stored) assert.equal(whereIs([r.A, r.B], key, it).listed, 0, `${it.name}: gone from the body`);
});
