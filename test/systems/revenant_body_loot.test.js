// OUTDOOR-LOOT, SLICE 3, D-2.3 (DESIGN-REVIEW D-2 item 3; DESIGN 9, "A revenant's body underground keeps WORLD4's whole-list word
// (RVN8), with the same stale-close race. The carried kind can take it."): WHAT IS TRUE, PINNED.
//
// The brief was to make a revenant's body underground a carried kind like `srch:` - its list as minted the base, the takes claims, the
// dungeon host the judge - and red-pin "a stale close on a revenant body never brings back or erases a piece". Read in the code, the
// premise does not hold: A REVENANT'S BODY UNDERGROUND RIDES NO WORD AT ALL, so there is no stale close to race.
//   - Underground a revenant is a LOOSE foe of its owner's (bible/12-Enhanced-AI/Feud-Arc.md 18.4/19: "a loose foe of mine (online, on
//     the room's SUMMON-SYNC lane - never a room's layout foe)"): `standLairRevenant` -> `spawnLooseFoe`, indexed past `_layoutFoes`.
//   - `lootHolder('corpse:<i>')` answers a list only for `i < _layoutFoes`, so `roomLootKey` is null for it: the window opens over the
//     body's own `entity.items` with NO `lootKey` (takeLoot's `roomLootKey(key)`), and its close publishes nothing (`publishLoot`
//     answers false); `lootRecords` never names it and `applyLoot` ignores a word about its index.
//   - The one other way a revenant could stand in a dungeon is a REST ENCOUNTER (`enc:<n>`, the room's by number): `restInLair` and
//     `restReturn` run OFFLINE alone (`if (l === 0 && !onlineRoom() && restInLair())`, `if (!onlineRoom()) return restReturn(hit) ...`),
//     and the online host stands its encounter `shared` with no revenant record.
//   - Its body is the owner's alone: a puppet of it on another client is a puppet (`_ownFrom`/past the layout), not a container.
// `roomCanonOfFoe`'s own `f.entity?.revenant` guard (scenes/roomLootHost.js) stands behind all of it: a revenant never gets a room key.
// These pins pass today; they fail if a later change gives a revenant's body a room key without the carried kind that would have to
// judge it.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { createRoomLoot } from '../../src/scenes/roomLootHost.js';
import { respawnDue } from '../../src/net/wire.js';
import { peerHanded } from '../../src/systems/peerWord.js';
import { validLootList, LOOT_LIST_MAX, LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { withoutCarried } from '../../src/world/interior/interiorShared.js';
import { carriedPieces } from '../../src/systems/item/itemIds.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { corpseTextureOf } from '../../src/scenes/corpseMarker.js';   // AUDIT DEX A1: the corpse mints read it
import { RAY_DISTANCE } from '../../src/player/activate.js';

const SRC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const AST = acorn.parse(SRC, { ecmaVersion: 'latest', sourceType: 'module' });
function walk(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  fn(n);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, fn)); else if (v && typeof v.type === 'string') walk(v, fn); }
}
function find(pred) { let hit = null; walk(AST, (n) => { if (!hit && pred(n)) hit = n; }); return hit; }
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `dungeonContext.js has function ${name}`); return SRC.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `dungeonContext.js declares ${name}`); return SRC.slice(n.start, n.end); };
const memberSrc = (name) => {
  const n = find((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `dungeonContext.js has member ${name}`);
  const body = SRC.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const PILE_BUILD = (() => {
  const lines = SRC.split('\n');
  const from = lines.findIndex((x) => x.trim().startsWith('const items = ') && x.includes('rollPileItems()'));
  const to = lines.findIndex((x, i) => i > from && x.trim().startsWith('lootPiles.push({ pos: [m.x + b.originX'));
  assert.ok(from > 0 && to > from && to - from < 8, 'the pile loop builds a pile, its list to its push');
  return lines.slice(from, to + 1).join('\n');
})();

/** Every name the dungeon's namer reads that dungeonContext.js imports, bound to the real module's export. */
const NAMER_BOUND = await (async () => {
  const map = new Map();
  for (const n of AST.body) {
    if (n.type !== 'ImportDeclaration') continue;
    const from = new URL(n.source.value, new URL('../../src/scenes/dungeonContext.js', import.meta.url)).href;
    for (const s of n.specifiers) if (!map.has(s.local.name)) map.set(s.local.name, [from, s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : s.type === 'ImportDefaultSpecifier' ? 'default' : '*']);
  }
  const names = new Set();
  walk(acorn.parse(`(function () {\n${fnSrc('_dungeonHoverName')}\n})`, { ecmaVersion: 'latest' }), (n) => { if (n.type === 'Identifier') names.add(n.name); });
  const out = {};
  for (const name of names) { const hit = map.get(name); if (!hit) continue; const mod = await import(hit[0]); out[name] = hit[1] === '*' ? mod : mod[hit[1]]; }
  return out;
})();


const ROOM = 'dungeon:m777';
const clock = { t: Date.UTC(2027, 3, 1, 12, 0, 0) };
const REV_ITEMS = () => [{ name: 'Gold Pieces', templateIndex: 276, group: 'Currency', value: 1, stackCount: 90 }, { name: 'Torc', templateIndex: 138, group: 'Jewellery', value: 120 }];

/** A joiner in a dungeon whose layout holds one dead orc (index 0) and where a dead REVENANT lies past the layout (index 1, a loose foe). */
function dungeon() {
  const frames = [], windows = [];
  const dead = (items, entity = {}) => ({ mobileType: 7, dead: true, corpse: true, _ownFrom: null, entity: { items, ...entity }, ai: { feet: [0, 0, 0] } });
  const state = {
    ...NAMER_BOUND,
    foes: [dead(REV_ITEMS().slice(1)), dead(REV_ITEMS(), { revenant: { id: 'rvn-1', rank: 2 } })],
    _layoutFoes: 1, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: false, _deepCleared: new Set(), _deepFoeCleared: new Set(), _wildDungeon: false, _wildRing: null, wildPileMore: () => {},
    opts: { selfId: () => 'b0b0-0002', onActions: (data) => { frames.push(data); return true; }, onLootClaimed: () => {}, partyLevels: () => [], roomHost: () => 'a0a0-0001' },
    _foesFrom: 'a0a0-0001', _sharedStamp: 'st1', _roomClaimN: 0, _roomMintHold: 0, _roomNowMs: 0,
    lootKey: 'N', onlineRoom: () => true, _wallNow: () => clock.t, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, withoutCarried, carriedPieces,
    eliteLootOpts: () => ({}), _sharedFoe: () => false, fightN: () => 1, rollPileItems: () => [], settleLootFlat: () => {}, searchHeard: () => {}, searchRoom: { ours: () => true, fields: () => ({}) },
    ENEMY_BASICS, corpseTextureOf, RAY_DISTANCE, setMidScreenText: () => {}, activeOverlay: null, droppedLoot: { physical: { owns: () => false }, pileFor: () => null, contents: () => null }, droppedTorches: { activate: () => false },
    camps: { activate: () => false }, plaqueActionFor: () => null, silverFindKey: () => null, silverFindAt: () => {}, quickLootTake: () => false, showPickups: null, lootPile: () => null, RANDOM_TREASURE_ARCHIVE: 216,
    openInventory: (source, onEmptied, o) => { const w = { source, onEmptied, lootKey: o?.lootKey ?? null, done: false }; windows.push(w); return w; },
    activateSearchable: () => 0,
  };
  const handles = `{ _deepCleared, _deepFoeCleared, _sharedFoe, _wildDungeon, _wildRing, eliteLootOpts, fightN, foes, lootKeyOf, lootableBody, opts, respawnDue, rollPileItems, roomLootKey, settleLootFlat,
    get _authority() { return _authority; }, get _foesFrom() { return _foesFrom; }, get _layoutFoes() { return _layoutFoes; }, get _locationKey() { return _locationKey; }, get _lootAt() { return _lootAt; }, get _lootOpenKey() { return _lootOpenKey; }, get _lootSeen() { return _lootSeen; }, get _lootTooBig() { return _lootTooBig; }, get _lootUnreadable() { return _lootUnreadable; },
    get _roomClaimN() { return _roomClaimN; }, set _roomClaimN(v) { _roomClaimN = v; }, get _roomMintHold() { return _roomMintHold; }, get _roomNowMs() { return _roomNowMs; }, set _roomNowMs(v) { _roomNowMs = v; }, get _sharedById() { return _sharedById; }, get _sharedStamp() { return _sharedStamp; }, get _wallNow() { return _wallNow; }, get lootKey() { return lootKey; }, get lootPiles() { return lootPiles; }, get onlineRoom() { return onlineRoom; } }`;
  const h = mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${fnSrc('lootKeyOf')}
    ${fnSrc('lootableBody')}
    ${fnSrc('lootHolder')}
    ${fnSrc('roomLootKey')}
    const { _roomState, isRoomBaseContainer, landRoomWord, roomCanonOfFoe, roomClaimTick, roomBodyBorn, roomUnborn, composeRoomContainer, holderList, roomBaseHolder, roomRecordOf, roomSayNow, roomSettle, settleRoomBonus } = createRoomLoot(${handles});
    ${fnSrc('lootRecords')}
    ${fnSrc('publishLoot')}
    ${fnSrc('sayRoomWord')}
    ${fnSrc('applyLoot')}
    ${fnSrc('corpseAt')}
    const api = { lootContents: ${memberSrc('lootContents')}, takeLoot: ${memberSrc('takeLoot')} };
    return { api, applyLoot, lootRecords, publishLoot, roomLootKey, lootHolder, roomCanonOfFoe, isRoomBaseContainer, roomClaimTick, _roomState };
  `, { ...state, createRoomLoot });
  return { state, h, frames, windows };
}

test('D-2.3 (RVN8): a revenant\'s body underground is no room container - it has no room key and no holder, while the layout body beside it has one', () => {
  const d = dungeon();
  const [layoutBody, revenant] = d.state.foes;
  assert.equal(d.h.roomCanonOfFoe(revenant), null, 'roomCanonOfFoe: a revenant never gets a room key');
  assert.equal(d.h.roomLootKey('corpse:1'), null, 'and the host names no container for its index (a loose foe, past the layout)');
  assert.equal(d.h.lootHolder('corpse:1'), null);
  assert.equal(d.h.isRoomBaseContainer('corpse:1'), false);
  assert.equal(d.h.roomCanonOfFoe(layoutBody), 'corpse:0', 'the layout body beside it is a room container (guard)');
  assert.equal(d.h.roomLootKey('corpse:0'), 'corpse:0');
});

test('D-2.3 (RVN8): nothing about a revenant\'s body rides a word - not said at a window\'s close, not in the room\'s memory, and a word about its index lands nothing: there is no whole-list word for a stale close to race', () => {
  const d = dungeon();
  const rev = d.state.foes[1];
  const before = JSON.stringify(rev.entity.items);
  assert.deepEqual(d.h.lootRecords(['corpse:1']), [], 'the memory names no such container');
  assert.equal(d.h.publishLoot('corpse:1'), false, 'a close says nothing for it');
  assert.equal(d.h.publishLoot('corpse:1', { claim: true }), false, 'nor an open');
  assert.deepEqual(d.frames, [], 'nothing was said to the room');
  // a stale whole list about that index (a peer\'s, an older build\'s, a memory\'s) is a word about a container this host has not got
  const stale = [{ k: 'corpse:1', r: [{ name: 'Gold Pieces', templateIndex: 276, group: 'Currency', value: 1, stackCount: 5 }], t: clock.t }];
  assert.equal(d.h.applyLoot(stale, 'a0a0-0001'), 0, 'it lands nothing');
  assert.equal(JSON.stringify(rev.entity.items), before, 'the body keeps its own list: neither a piece brought back nor one erased');
});

test('D-2.3 (RVN8): the revenant\'s body opens as its owner\'s own list - the window is handed the body\'s items with NO room key, so its close has nothing to publish', () => {
  const d = dungeon();
  const rev = d.state.foes[1];
  const n = d.h.api.takeLoot('corpse:1', 'grab');
  assert.equal(n, rev.entity.items.length, 'the press opens the body');
  assert.equal(d.windows.length, 1, 'one window');
  assert.equal(d.windows[0].source, rev.entity.items, 'over the body\'s own list');
  assert.equal(d.windows[0].lootKey, null, 'with no room key: its close publishes nothing (WORLD4\'s `onClose: if (lootKey) publishLoot`)');
  assert.deepEqual(d.frames, []);
});

test('D-2.3 (RVN8) by source: a revenant stands underground only as a loose foe or an offline rest encounter, and never as the room\'s shared encounter body (`enc:`)', () => {
  assert.match(fnSrc('roomLootKey'), /canon && lootHolder\(canon\) \? canon : null/, 'the room\'s key needs a holder');
  assert.match(fnSrc('lootHolder'), /if \(kind === 'corpse'\) \{ const f = foes\[i\]; return i < _layoutFoes && lootableBody\(f\)/, 'a corpse is a room container only inside the layout\'s run');
  assert.match(SRC, /if \(l === 0 && !onlineRoom\(\) && restInLair\(\)\) break;/, 'a lair rest\'s revenant is offline alone');
  assert.match(SRC, /if \(!onlineRoom\(\)\) return restReturn\(hit\) \? null : _spawnEncounter\(hit\);/, 'so is a rest\'s return');
  assert.match(SRC, /if \(_authority\) return _spawnEncounter\(hit, \{ shared: true \}\);/, 'the online host stands its encounter shared, with no revenant record');
  assert.match(SRC, /const f = await spawnLooseFoe\(r\.mobileType, \[sp\.x, sp\.y, sp\.z\], \{ gender: so\.gender, level: so\.level, revenant: r, lairStand: true \}\)/, 'a lair stand is a loose foe');
  const RH = readFileSync(new URL('../../src/scenes/roomLootHost.js', import.meta.url), 'utf8');
  assert.match(RH, /if \(!f \|\| f\._ownFrom != null \|\| f\.entity\?\.revenant \|\| f\.companion != null\) return null;/, 'and the PARTY-LOOT block gives a revenant no room key');
});
