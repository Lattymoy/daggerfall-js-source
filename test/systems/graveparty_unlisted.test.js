// OUTDOOR-LOOT, SLICE 3, D-2.2 (DESIGN-REVIEW D-2 item 2; DESIGN 9, recorded): THE "EMPTY" PILE.
//
// GRAVE-PARTY (FIELD BUGS 2026-10-16b) made a dungeon container whose room word this build CANNOT READ (another build's - AUDIT SETS
// M2's `_lootUnreadable`) a TARGET again, so its press says "Reload to open it". Its plaque is another matter: `lootContents` answers
// null for it (the list is the room's, in words this build cannot read), and worldHover.js `resolveHover`'s itemised arm reads
// `hoverLines(contents?.(key) ?? null, Infinity)` - null becomes `empty: true`, and the plaque draws "Empty" over a pile (or a body) that
// is FULL, for a player who may then walk away from it. It is the street body's report ("I can still click on an 'Empty' body") in the
// dungeon. The fix is slice 1's: the namer says `unlisted` (a container this reader can name and cannot read), and the plaque draws the
// NAME ALONE - `kind 'name'`, never `empty: true`.
//
// MOUNTED, NOT MATCHED (test/systems/fb1016b_graveparty.test.js's mount of the host's doors, the dungeon's own namer sliced beside
// them, read through the real resolveHover as the plaque reads it).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { createRoomLoot } from '../../src/scenes/roomLootHost.js';
import { resolveHover } from '../../src/systems/worldHover.js';
import { respawnDue } from '../../src/net/wire.js';
import { peerHanded } from '../../src/systems/peerWord.js';
import { validLootList, LOOT_LIST_MAX, LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { withoutCarried } from '../../src/world/interior/interiorShared.js';
import { carriedPieces } from '../../src/systems/item/itemIds.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
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
const own = [{ name: 'Gold Pieces', templateIndex: 276, group: 'Currency', value: 1, stackCount: 40 }, { name: 'Torc', templateIndex: 138, group: 'Jewellery', value: 120 }];

/** One joiner in a dungeon with two piles and one dead layout foe, its doors mounted. */
function dungeon() {
  const state = {
    ...NAMER_BOUND,
    foes: [{ mobileType: 7, dead: true, corpse: true, _ownFrom: null, entity: { items: [{ name: 'Torc', templateIndex: 138, group: 'Jewellery', value: 120 }] }, ai: { feet: [0, 0, 0] } }],
    _layoutFoes: 1, _sharedById: new Map(), lootPiles: [], searchables: [], _locationKey: ROOM,
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _authority: false, _deepCleared: new Set(), _deepFoeCleared: new Set(), _wildDungeon: false, _wildRing: null, wildPileMore: () => {},
    opts: { selfId: () => 'b0b0-0002', onActions: () => true, onLootClaimed: () => {}, partyLevels: () => [], roomHost: () => 'a0a0-0001' },
    _foesFrom: 'a0a0-0001', _sharedStamp: 'st1', _roomClaimN: 0, _roomMintHold: 0, _roomNowMs: 0,
    lootKey: 'N', onlineRoom: () => true, _wallNow: () => clock.t, respawnDue, validLootList, peerHanded, LOOT_LIST_MAX, LOOT_NEWER_TEXT, withoutCarried, carriedPieces,
    eliteLootOpts: () => ({}), _sharedFoe: () => false, fightN: () => 1, rollPileItems: () => own.map((it) => ({ ...it })), settleLootFlat: () => {}, searchHeard: () => {}, searchRoom: { ours: () => true, fields: () => ({}) },
    ENEMY_BASICS, RAY_DISTANCE, setMidScreenText: () => {}, activeOverlay: null, droppedLoot: { contents: () => null, labelFor: () => null }, quickLootTake: () => false,
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
    const { _roomState, isRoomBaseContainer, landRoomWord, roomUnborn, mintUnbornRoom } = createRoomLoot(${handles});
    ${fnSrc('corpseAt')}
    ${fnSrc('applyLoot')}
    ${fnSrc('_dungeonHoverName')}
    const api = { lootContents: ${memberSrc('lootContents')} };
    const buildPile = (m, b, bi, isRandom, isFixed, record) => { ${PILE_BUILD} };
    return { api, applyLoot, name: _dungeonHoverName, mintUnbornRoom, buildPile };
  `, { ...state, createRoomLoot });
  const pileAt = (x) => { h.buildPile({ x, y: 0, z: 0, position: 100 + x }, { originX: 0, originZ: 0 }, 0, true, false, 0); Object.assign(state.lootPiles.at(-1), { half: [0.5, 0.5], batch: {} }); return state.lootPiles.length - 1; };
  const unreadable = (key) => h.applyLoot([{ k: key, g: 0, lv: 1, n: 1, tm: clock.t, x: 'from another build', c: [] }], 'a0a0-0001');
  /** The plaque over `key`, as the host's hover reads it: the dungeon's namer and its contents door through resolveHover. */
  const plaque = (key) => resolveHover({ key, distance: 1, reach: 3 }, { name: (k) => h.name(k), contents: (k) => h.api.lootContents(k) });
  return { state, h, pileAt, unreadable, plaque };
}

test('D-2.2: the plaque over a dungeon PILE whose room word this build cannot read names the pile alone - never "Empty" (kind name, no `empty`)', () => {
  const d = dungeon();
  const p = d.pileAt(0);
  d.unreadable('loot:0');
  assert.ok(d.state._lootUnreadable.has('loot:0'), 'the room has spoken, in words this build cannot read');
  assert.equal(d.h.api.lootContents('loot:0'), null, 'the contents door answers null: the list is the room\'s, unread (guard)');
  const f = d.plaque('loot:0');
  assert.ok(f, 'a plaque draws');
  assert.notEqual(f.empty, true, `D-2.2: the plaque says "Empty" over a pile that is full for the room: ${JSON.stringify(f)}`);
  assert.equal(f.kind, 'name', 'it draws the name alone');
  assert.ok(f.title, 'under a title');
  assert.equal(d.state.lootPiles[p].items.length, 0, 'and nothing of this copy\'s is listed (guard)');
});

test('D-2.2: the same over a dungeon BODY whose room word this build cannot read - its name alone, never "Empty"', () => {
  const d = dungeon();
  d.unreadable('corpse:0');
  assert.ok(d.state._lootUnreadable.has('corpse:0'), 'the body\'s word is unreadable here');
  const f = d.plaque('corpse:0');
  assert.ok(f, 'a plaque draws');
  assert.notEqual(f.empty, true, `D-2.2: the plaque says "Empty" over a body that is full for the room: ${JSON.stringify(f)}`);
  assert.equal(f.kind, 'name', 'it draws the name alone');
  assert.ok(f.title, 'under its title');
});

test('D-2.2 (guard): a readable pile still lists its rows - the name alone is for the container this reader CANNOT read, not a reader who can', () => {
  const d = dungeon();
  const p = d.pileAt(3);
  d.h.mintUnbornRoom(0); d.h.mintUnbornRoom(10_000);
  assert.deepEqual(d.state.lootPiles[p].items.map((it) => it.name), ['Gold Pieces', 'Torc'], 'the room\'s base, composed');
  const f = d.plaque('loot:0');
  assert.equal(f.kind, 'items');
  assert.equal(f.empty, false);
  assert.equal(f.rows.length, 2);
});
