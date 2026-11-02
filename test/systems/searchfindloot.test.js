// OUTDOOR-LOOT, AC9 (2026-10-17): A DUNGEON'S SEARCH FIND IS ONE LIST FOR THE SEARCHER'S PARTY. RED PINS, PHASE 1.
// A searched object's find (`srch:<i>`, SEARCH1) is shared within the searcher's party (GRAVE-PARTY,
// scenes/searchRoom.js), and its room word is WORLD4's WHOLE LIST: scenes/dungeonContext.js `function applyLoot(list,
// from = null)` lands it over the find for every key that is not a room base container (PARTY-LOOT's ROOM_BASE_KINDS is
// loot, corpse and enc), except under the reader's own open window (AUDIT WORLD4 C1), and publishLoot says the whole find
// at the search and at every close. The last writer wins, so - inside one party, today:
//   - two partymates with the find open: the later close republishes a stale list - a piece the first took comes back
//     (a dupe), and a piece put in is erased;
//   - two searches of one object in one breath each mint their own find, and the closes cross: two lists;
//   - LOOT-BULK's Take all makes one stale close resurrect the whole find.
//
// MOUNTED, NOT MATCHED (DESIGN.md section 8.1: partyloot's `peer()` mount, extended with the searchables and a real
// createSearchRoom). Each player is the dungeon host's own loot doors sliced out of src/scenes/dungeonContext.js - the
// search (activateSearchable, whatever it calls at the find), the find's window door (the takeLoot member and the
// host's own openInventory, whose onClose says the close's word), the room word out and in (publishLoot, lootRecords,
// applyLoot, applyActions) - with the PARTY-LOOT block as the host constructs it (scenes/roomLootHost.js
// createRoomLoot, sliced as test/systems/partyloot.test.js slices it), every name they read that the two files import
// bound to the real module's export through their OWN import lists. GRAVE-PARTY's lens is each player's own hub
// picture (net/social.js SocialState, scenes/searchPartyHost.js), as test/systems/fb1016b_graveparty.test.js stands
// it. The relay is a queue of act frames fanned to everyone else in the dungeon. The window is a stand-in for the
// window the host's openInventory mounts (createInventoryWindow's deps: `loot.items()` the find's array, its `onClose`)
// that moves pieces as the loot window's own click does (itemTransfer.js planTake/planStore + applyTransfer), and, for
// Take all, THE REAL ENHANCED WINDOW over those deps (test/ui/lootbulk.test.js's mount), pressed.
//
// Run against the tree at 02706035cf the AC9 pins fail by their assertions; the guard (named so) passes.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { planTake, planStore, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { searchableKind, restoreSearchLedger, searchLedgerRecord, setSearchParty, searchPartyLens, searchKey, searchCooldownLeft, searchedText, SEARCH_COOLDOWN_MINUTES, _resetSearchLedgerForTests } from '../../src/systems/searchables.js';
import { validSocialFrame, sharedClassicMinutes } from '../../src/net/wire.js';
import { SocialState } from '../../src/net/social.js';
import { createSearchParty } from '../../src/scenes/searchPartyHost.js';
import { setSharedClock, worldMinutes } from '../../src/systems/worldTick.js';
import { ActionTextBox } from '../../src/ui/actionText.js';
import { ITEM_TEMPLATES } from '../../src/characters/paperdoll/paperdoll.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import * as RL from '../../src/systems/roomLoot.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';

installRoleplayRealismItems();   // the hosts' own install (scenes/shared.js): its weapons are among a search's finds
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const REAL_RANDOM = Math.random;
const REAL_NOW = Date.now;
const clock = { t: Date.UTC(2027, 3, 1, 12, 0, 0) };
afterEach(() => { Math.random = REAL_RANDOM; Date.now = REAL_NOW; setSharedClock(null); _resetSearchLedgerForTests(); setSearchParty(null); });

// ═══ THE DUNGEON HOST'S DOORS, sliced (test/systems/partyloot.test.js's method) ═════════════════════════════════════
const FILES = ['src/scenes/dungeonContext.js', 'src/scenes/roomLootHost.js'].map((p) => { const src = rd(p); return { p, src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }; });
const [DC, RH] = FILES;
function walk(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  fn(n);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, fn)); else if (v && typeof v.type === 'string') walk(v, fn); }
}
function first(f, pred) { let hit = null; walk(f.ast, (n) => { if (!hit && pred(n)) hit = n; }); return hit; }
const fnSrc = (name) => { const n = first(DC, (x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `dungeonContext.js has function ${name}`); return DC.src.slice(n.start, n.end); };
const optFn = (name) => { const n = first(DC, (x) => x.type === 'FunctionDeclaration' && x.id?.name === name); return n ? DC.src.slice(n.start, n.end) : ''; };
const declSrc = (name) => { const n = first(DC, (x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `dungeonContext.js declares ${name}`); return DC.src.slice(n.start, n.end); };
const memberSrc = (name) => {
  const n = first(DC, (x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'));
  assert.ok(n, `dungeonContext.js has member ${name}`);
  const body = DC.src.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
/** The PARTY-LOOT block as the dungeon host constructs it (partyloot.test.js's PARTS): the host's counters, the
 *  module's createRoomLoot, and the host's construction of it - whose returns land in the mount's scope. */
const BLOCK = (() => {
  const ctor = first(DC, (x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.init?.type === 'CallExpression' && d.init.callee?.name === 'createRoomLoot'));
  const fn = first(RH, (x) => x.type === 'FunctionDeclaration' && x.id?.name === 'createRoomLoot');
  const a = DC.src.indexOf('  let _roomMintHold = 0;');
  assert.ok(ctor && fn && a >= 0 && a < ctor.start, 'the dungeon host constructs the PARTY-LOOT block (scenes/roomLootHost.js createRoomLoot)');
  return `${DC.src.slice(a, ctor.start)}${RH.src.slice(fn.start, fn.end)}\n  ${DC.src.slice(ctor.start, ctor.end)}\n`;
})();
const PLAYER = `
  ${declSrc('_respawnMs')}
  ${declSrc('respawnDue')}
  ${declSrc('LOOT_KEY_RE')}
  ${fnSrc('lootKeyOf')}
  ${fnSrc('lootableBody')}
  ${fnSrc('lootHolder')}
  ${fnSrc('roomLootKey')}
  ${declSrc('_wallNow')}
  ${declSrc('searchRoom')}
  ${fnSrc('lootRecords')}
  ${fnSrc('publishLoot')}
  ${optFn('sayRoomWord')}
  ${fnSrc('applyLoot')}
  ${fnSrc('applyActions')}
  ${BLOCK}
  ${fnSrc('searchLocationKey')}
  ${fnSrc('searchHeard')}
  ${fnSrc('activateSearchable')}
  ${fnSrc('openInventory')}
  const api = { takeLoot: ${memberSrc('takeLoot')} };
  let _respawnSweptAt = -Infinity;
  const RESPAWN_BURST = 4;
  ${fnSrc('respawnSweep')}
  return { api, applyActions, respawnSweep, roomClaimTick: typeof roomClaimTick === 'function' ? roomClaimTick : () => {} };
`;
/** Every name the mounted doors read that either file imports, bound to the real module's export. */
const BOUND = await (async () => {
  const map = new Map();
  for (const f of FILES) for (const n of f.ast.body) {
    if (n.type !== 'ImportDeclaration') continue;
    const from = new URL(n.source.value, new URL(`../../${f.p}`, import.meta.url)).href;
    for (const s of n.specifiers) if (!map.has(s.local.name)) map.set(s.local.name, [from, s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : s.type === 'ImportDefaultSpecifier' ? 'default' : '*']);
  }
  const names = new Set();
  walk(acorn.parse(`(function () {\n${PLAYER}\n})`, { ecmaVersion: 'latest' }), (n) => { if (n.type === 'Identifier') names.add(n.name); });
  const out = {};
  for (const name of names) {
    const hit = map.get(name);
    if (!hit) continue;
    const mod = await import(hit[0]);
    out[name] = hit[1] === '*' ? mod : mod[hit[1]];
  }
  return out;
})();
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

// ═══ THE PARTY IN THE CRYPT ═════════════════════════════════════════════════════════════════════════════════════════
/** A player's hub picture (fb1016b_graveparty.test.js's `picture`): `party` the accounts seated together, the first
 *  its leader. */
const PLAYERS = { 'acct-ann': { name: 'Ann', peer: 'a0a0-0001' }, 'acct-bob': { name: 'Bob', peer: 'b0b0-0002' }, 'acct-dan': { name: 'Dan', peer: 'd0d0-0004' }, 'acct-eve': { name: 'Eve', peer: 'e0e0-0003' } };
const PARTY = ['acct-ann', 'acct-bob', 'acct-dan'];
function picture(social, acct, party = null) {
  const row = (a) => ({ acct: a, name: PLAYERS[a].name, online: true, peers: [PLAYERS[a].peer] });
  const f = validSocialFrame({ t: 'social', k: 'state', acct, name: PLAYERS[acct].name, peers: [PLAYERS[acct].peer], friends: [], in: [], out: [], invites: [],
    party: party ? { id: 'party-0001', leader: party[0], members: party.map(row) } : null });
  assert.ok(f, 'a hub picture the wire takes');
  social.apply(f);
  return social;
}
const ROOM = 'dungeon:m777';   // a Graveyard's Cemetery (dungeonType 18): its crypt's coffins
const COFFIN = 41315;          // TEXTURE.092's low wooden coffin (systems/searchables.js)
/** A searchable as the build mints it (dungeonContext.js: `{ kind, aabb, key, lock: 0, items: [], records }`). */
const coffinAt = (i) => ({ kind: searchableKind(COFFIN), aabb: { min: [i * 3, 0, 0], max: [i * 3 + 0.8, 0.45, 2] }, key: `0:${100 + i}`, lock: 0, items: [], records: false });
function actRoom() {
  const players = [], q = [], sent = [];
  return {
    players,
    sent,   // every act frame said, kept
    join(p) { players.push(p); },
    send(from, data) { const f = { from, data: clone(data) }; q.push(f); sent.push(f); return true; },
    /** The act frames said so far, landed on everyone else in the dungeon, and each player's claims tick after. */
    flush() {
      for (let guard = 0; q.length && guard < 64; guard++) {
        while (q.length) { const { from, data } = q.shift(); for (const p of players) if (p.id !== from) p.as(() => p.h.applyActions(from, data)); }
        for (const p of players) p.as(() => p.h.roomClaimTick(clock.t));
      }
    },
  };
}
/** One player in the crypt: the host's doors over two coffins, their own dice, ledger and party lens. `host` is the
 *  dungeon's seat (WORLD2's _authority) - the first player in. */
function player(net, acct, { party = PARTY, host = false } = {}) {
  const id = PLAYERS[acct].peer;
  const social = picture(new SocialState({ acct }), acct, party);
  createSearchParty({ social });
  const lens = searchPartyLens();
  const said = [], boxes = [];
  const entity = { level: 6, gender: 'male', name: PLAYERS[acct].name, characterId: `char-${acct}`, career: { name: 'Spellsword' }, stats: { luck: 50, strength: 50, endurance: 48 }, activeEffects: [], items: [], goldPieces: 0 };
  const P = { id, acct, entity, said, boxes, social, ledger: { rows: [] }, rand: lcg(acct.length * 104729 + acct.charCodeAt(5)), next: null, window: null, skew: 0 };
  P.as = (fn) => {
    restoreSearchLedger(P.ledger); setSearchParty(lens);
    Math.random = () => { if (P.next != null) { const v = P.next; P.next = null; return v; } return P.rand(); };
    Date.now = () => clock.t + P.skew;   // this machine's OWN clock, which may be minutes off the relay's (R-3); the shared clock (setSharedClock) is the relay's
    try { return fn(); } finally { Math.random = REAL_RANDOM; Date.now = REAL_NOW; P.ledger = searchLedgerRecord(); }
  };
  const seat = net.players[0]?.id ?? id;
  const state = {
    ...BOUND, ...RL,
    searchables: [coffinAt(0), coffinAt(1)], lootPiles: [], foes: [], _layoutFoes: 0, _sharedById: new Map(),
    _lootSeen: new Set(), _lootUnreadable: new Set(), _lootAt: new Map(), _lootOpenKey: null, _lootTooBig: new Set(),
    _locationKey: ROOM, dfLocation: { name: 'The Tombs of Test', mapTableData: { mapId: 777, dungeonType: 18 } },
    _authority: host, _foesFrom: host ? null : seat, _sharedStamp: `st-${acct}`, _deepCleared: new Set(), _deepFoeCleared: new Set(), _wildDungeon: false, _wildRing: null, _superTier: false,
    playerEntity: entity, activeOverlay: null, _ctxDead: false, enemies: [], lootKey: null,
    opts: { selfId: () => id, onActions: (data) => net.send(id, data), onLootClaimed: () => {}, party: () => [], partyLevels: () => [], roomHost: () => seat },
    onlineRoom: () => true, settleLootFlat: () => {}, _sharedFoe: () => false, fightN: () => 1, eliteLootOpts: () => ({}), rollPileItems: () => [],
    camps: { applyOwner: () => {}, activate: () => false }, roomEncounterAsked: () => false, actions: { applyRemote: () => 0 },
    droppedLoot: { physical: { owns: () => false }, pileFor: () => null, releaseEmptied: () => {} }, droppedTorches: { activate: () => false }, plaqueActionFor: () => null,
    setMidScreenText: (t) => said.push(t), pushDungeonWindow: (w) => boxes.push(w), presentNpcInfoText: (s) => s,
    /** The window the host's openInventory mounts - the stand-in's (below). */
    createInventoryWindow: (deps) => P.window?.open(deps) ?? null,
    surfacePlayer: () => {}, hudText: { add: () => {} }, renderer: { textures: new Map() }, packDoors: {}, useHooks: {}, weaponRig: { playerWeapon: {} },
    silverFindKey: () => null, silverFindAt: () => {}, showPickups: null, lootPile: () => null,
    searchFoeCount: () => 2, respawnFoe: () => false, wildPileMore: () => {}, searchFoeSpots: () => [], spawnLooseFoe: () => {},
  };
  P.state = state;
  P.h = P.as(() => mount(PLAYER, state));
  net.join(P);
  return P;
}
/** The search: the host's press on a coffin (`search:<i>`, takeLoot's door), its die `roll` (0.5: a find), and - the
 *  message box clicked away - the find's window, opened over the room's list by the box's own onClose. */
function search(P, i, win, roll = 0.5) {
  P.window = win;
  return P.as(() => {
    P.next = roll;
    P.h.api.takeLoot(`search:${i}`, 'grab');
    const box = P.boxes.at(-1);
    assert.ok(box instanceof ActionTextBox, `${P.id}'s search stood its message box`);
    const close = box.onClose; box.onClose = null;
    close?.();
    return win.cur;
  });
}
/** A partymate's press on a searched coffin inside its five hours: the room's find, as it stands, in the window. */
function openFind(P, i, win) { P.window = win; P.as(() => P.h.api.takeLoot(`search:${i}`, 'grab')); return win.cur; }
const find = (P, i = 0) => P.state.searchables[i].items;
const sig = (it) => JSON.stringify(it);
/** The same piece, whoever's copy: a searcher's roll and the party's copies of it (each through the wire's projection) differ in form, never in what they are. */
const alike = (a, b) => a.group === b.group && a.templateIndex === b.templateIndex && a.name === b.name && (a.stackCount ?? 1) === (b.stackCount ?? 1);
const names = (list) => (list ?? []).map((it) => it.name);
/** THE WINDOW STAND-IN over the deps the host's openInventory hands createInventoryWindow (`loot.items()`, `onClose`). */
function windowOf(P) {
  const w = { cur: null };
  w.open = (deps) => { const win = { done: false, deps }; w.cur = win; deps?.loot?.opened?.(); return win; };
  w.list = () => w.cur?.deps?.loot?.items?.() ?? null;
  w.take = (pick) => {
    const list = w.list(); const it = list?.find(pick);
    assert.ok(it, `${P.id}'s window shows the piece`);
    const plan = planTake(it, { bag: P.entity.items, entity: P.entity, mode: 'remove' });
    assert.ok(plan.ok, `${P.id} may take it`);
    P.as(() => applyTransfer(it, plan, list, P.entity.items, { entity: P.entity, toPlayer: true }));
    return it;
  };
  w.put = (it) => {
    const list = w.list(); const plan = planStore(it, { remote: list });
    assert.ok(plan.ok, `${P.id} may put ${it.name} in`);
    applyTransfer(it, plan, P.entity.items, list, { entity: P.entity, fromLocal: true });
  };
  /** The player's close: the window done and out of the host's slot first, then its own close (the host's onClose
   *  says the close's word). */
  w.close = () => { const win = w.cur; w.cur = null; win.done = true; P.state.activeOverlay = null; win.deps?.loot?.closed?.(); P.as(() => win.deps?.onClose?.()); };
  return w;
}
const crypt = ({ strangerHost = false } = {}) => {
  setSharedClock(() => sharedClassicMinutes(clock.t));
  const net = actRoom();
  const eve = strangerHost ? player(net, 'acct-eve', { party: null, host: true }) : null;   // the dungeon's seat is a stranger to the party
  const ann = player(net, 'acct-ann', { host: !strangerHost });
  const bob = player(net, 'acct-bob');
  const dan = player(net, 'acct-dan');
  return { net, ann, bob, dan, eve, all: [ann, bob, dan] };
};
/** Ann searches coffin 0 and finds; the party hears it; Ann's find window closes again. */
function found() {
  const s = crypt();
  const wa = windowOf(s.ann);
  assert.ok(search(s.ann, 0, wa), 'Ann\'s search found something, and its window opened');
  const theFind = find(s.ann).map((it) => ({ ...it }));
  assert.ok(theFind.length >= 2, `a find of at least two pieces (${JSON.stringify(names(theFind))})`);
  wa.close();
  s.net.flush();
  for (const p of s.all) assert.deepEqual(names(find(p)), names(theFind), `${p.id}: the party's one find (guard)`);
  return { ...s, theFind };
}
const gold = (P) => P.entity.goldPieces | 0;
const holds = (P, it) => (it.group === 'Currency' ? gold(P) : P.entity.items.filter((x) => alike(x, it)).length);

// ═══ AC9 (a) - A STALE CLOSE NEVER BRINGS BACK A TAKEN PIECE ═══════════════════════════════════════════════════════

test('AC9 (a): two partymates have Ann\'s find open; Ann takes a piece and closes; Bob closes untouched - the piece never comes back in any partymate\'s find, and Ann holds it once', () => {
  const s = found();
  const wa = windowOf(s.ann), wb = windowOf(s.bob);
  assert.ok(openFind(s.bob, 0, wb), 'Bob opens the party\'s find');
  assert.ok(openFind(s.ann, 0, wa), 'Ann opens it again');
  const X = wa.take((it) => it.name === s.theFind[0].name);
  const had = holds(s.ann, X);
  wa.close(); s.net.flush();
  wb.close(); s.net.flush();
  const back = s.all.filter((p) => find(p).some((it) => alike(it, X))).map((p) => p.id);
  assert.deepEqual(back, [], `AC9 (a): ${X.name}, taken by Ann, is back in the find for ${back.join(', ')} - Bob's untouched close said its stale whole list (publishLoot -> lootRecords) and dungeonContext.js applyLoot landed it over the find (srch: is not a room base container): a dupe`);
  assert.equal(holds(s.ann, X), had, 'and Ann holds it, once');
});

// ═══ AC9 (b) - A STALE CLOSE NEVER ERASES A PUT ═════════════════════════════════════════════════════════════════════

test('AC9 (b): Ann\'s window stands open on the find; Bob opens it, puts a piece in and closes; Ann closes untouched - the piece stays in every partymate\'s find, once, and Bob holds it no more', () => {
  const s = found();
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Mace');
  const Y = { name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50 };
  s.bob.entity.items.push(Y);
  const wa = windowOf(s.ann), wb = windowOf(s.bob);
  assert.ok(openFind(s.ann, 0, wa), 'Ann opens the find, and leaves it open');
  assert.ok(openFind(s.bob, 0, wb), 'Bob opens it');
  wb.put(Y);
  wb.close(); s.net.flush();
  wa.close(); s.net.flush();
  const lost = s.all.filter((p) => find(p).filter((it) => alike(it, Y)).length !== 1).map((p) => p.id);
  assert.deepEqual(lost, [], `AC9 (b): the Mace Bob put in is not in the find, once, for ${lost.join(', ')} - Ann's untouched close of a window opened before the put said her stale whole list over the party's: the put is ERASED`);
  assert.equal(s.bob.entity.items.some((it) => alike(it, Y)), false, 'and Bob holds it no more');
});

// ═══ AC9 (c) - TWO SEARCHES IN ONE BREATH CONVERGE ═════════════════════════════════════════════════════════════════

test('AC9 (c): Ann and Bob search one coffin in one breath (each finds on their own dice); both close their windows - every partymate ends with the same find', () => {
  const s = crypt();
  const wa = windowOf(s.ann), wb = windowOf(s.bob);
  assert.ok(search(s.ann, 1, wa), 'Ann\'s search finds');
  assert.ok(search(s.bob, 1, wb), 'Bob\'s search, in the same breath, finds');
  assert.notDeepEqual(find(s.ann, 1).map(sig), find(s.bob, 1).map(sig), 'two searches, two finds (each player\'s own dice - guard)');
  wa.close(); wb.close();
  s.net.flush();
  const lists = s.all.map((p) => find(p, 1).map(sig));
  assert.deepEqual(lists[1], lists[0], `AC9 (c): Ann and Bob end with different finds - Ann ${JSON.stringify(names(find(s.ann, 1)))}, Bob ${JSON.stringify(names(find(s.bob, 1)))}: each search's whole list landed over the other's (the last writer wins, and the two closes crossed)`);
  assert.deepEqual(lists[2], lists[0], 'and Dan holds that find too');
});

// ═══ LOOT-BULK - Take all through the REAL window ═══════════════════════════════════════════════════════════════════

test('LOOT-BULK (AC9): Ann\'s Take all (the real window\'s bulk walk) under Bob\'s open window - Bob\'s untouched close never brings the find back: every partymate\'s find stays empty, and Ann holds each piece once', () => {
  resetPrefs(); globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const s = found();
    const wa = windowOf(s.ann), wb = windowOf(s.bob);
    let view = null, node = null;
    wa.open = (deps) => { node = dom.mk('div'); dom.body.append(node); view = mountEnhancedInventory(node, { entity: s.ann.entity, items: () => s.ann.entity.items, wagonItems: () => (s.ann.entity.wagonItems ??= []), onExit: () => {}, loot: deps.loot }); const win = { done: false, deps }; wa.cur = win; return win; };
    assert.ok(openFind(s.bob, 0, wb), 'Bob opens the find');
    assert.ok(openFind(s.ann, 0, wa), 'Ann opens it, in the real window');
    const b = [...node.querySelectorAll('button')].find((x) => x.textContent === 'Take all');
    assert.ok(b, 'the find\'s window offers Take all');
    s.ann.as(() => b.onclick());
    assert.deepEqual(find(s.ann), [], 'Ann\'s Take all emptied her find (guard)');
    view.unmount();
    wa.close(); s.net.flush();
    wb.close(); s.net.flush();
    const back = s.all.map((p) => [p.id, names(find(p))]).filter(([, l]) => l.length);
    assert.deepEqual(back, [], `LOOT-BULK (AC9): Ann took the whole find, and Bob's untouched close brought it ALL back - ${JSON.stringify(back)}`);
    for (const it of s.theFind) assert.ok(holds(s.ann, it) >= 1, `Ann holds ${it.name}`);
  });
});

// ═══ GUARD ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('GRAVE-PARTY (guard - passes today): a stranger\'s search in the same crypt lands nothing on the party - her word is kept, unlanded, and the party\'s find stands as it was', () => {
  const s = found();
  const eve = player(s.net, 'acct-eve', { party: null });
  const we = windowOf(eve);
  assert.ok(search(eve, 0, we), 'Eve, a stranger who never heard Ann\'s word, searches coffin 0 for herself and finds');
  we.close();
  s.net.flush();
  for (const p of s.all) assert.deepEqual(names(find(p)), names(s.theFind), `${p.id}: the party's find, untouched by a stranger's word`);
});

// ═══ SLICE 3 (2026-10-18) - T28-T30's REST: THE FIND IS A CARRIED KIND, JUDGED BY THE DUNGEON'S HOST ═════════════════════
// DESIGN.md section 5 and 8.2 (T28-T30), DESIGN-REVIEW D-1/D-1a and R-3. Outcomes only: where each piece is, for every player,
// once the relay has been flushed - the way the find is carried (a base, takes, claims) is the build's own.
const desc = (it) => `${it.name}x${it.stackCount ?? 1}`;
const findDesc = (P, i = 0) => find(P, i).map(desc);
const objectKey = (i) => searchKey('d777', `0:${100 + i}`);   // the ledger's name for coffin i of this dungeon (searchLocationKey: DFU's map id)
/** The five hours left on coffin `i` for this player, in game minutes (0: none run). */
const hoursLeft = (P, i = 0) => P.as(() => searchCooldownLeft(objectKey(i), worldMinutes()));
/** Start every scene early in a period of the search clock (SEARCH_COOLDOWN_MINUTES), so a few seconds never cross its edge. */
const alignPeriod = () => { for (let n = 0; n < 400 && sharedClassicMinutes(clock.t) % SEARCH_COOLDOWN_MINUTES > 100; n++) clock.t += 1000; };
/** The piece of the find a window takes: the first one that is not coin (a coin is counted by its amount). */
const aPiece = (list) => list.find((it) => it.group !== 'Currency') ?? list[0];

test('T29 / R-3: two partymates search one coffin in one breath - the EARLIER mint by the SHARED clock wins on every client, whatever each machine\'s own clock says, and both windows end on that one find', () => {
  const s = crypt();
  alignPeriod();
  s.ann.skew = 20 * 60_000;    // Ann\'s own clock runs twenty minutes FAST
  s.bob.skew = -20 * 60_000;   // Bob\'s twenty minutes SLOW: Date.now() would hand Bob every first-open
  const wa = windowOf(s.ann), wb = windowOf(s.bob);
  assert.ok(search(s.ann, 1, wa), 'Ann\'s search finds, first by the relay\'s clock');
  const annFind = findDesc(s.ann, 1);
  clock.t += 700;
  assert.ok(search(s.bob, 1, wb), 'Bob\'s search finds, 0.7 s later by the relay\'s clock, before he has heard Ann\'s');
  assert.notDeepEqual(findDesc(s.bob, 1), annFind, 'two searches, two finds (each player\'s own dice - guard)');
  wa.close(); wb.close();
  s.net.flush();
  for (const p of s.all) assert.deepEqual(findDesc(p, 1), annFind, `T29/R-3: ${p.id} ends on Ann's find - the earlier mint by the shared clock - not ${JSON.stringify(findDesc(p, 1))}: a later close landed a whole list over the earlier search's`);
});

test('T29: first come at the host - Bob and Dan take the SAME piece of the party\'s find in one breath: exactly one copy between them, the later claim is told "taken", and nobody\'s list shows it again', () => {
  const s = found();
  const wb = windowOf(s.bob), wd = windowOf(s.dan);
  assert.ok(openFind(s.bob, 0, wb) && openFind(s.dan, 0, wd), 'both partymates open the find');
  const X = wb.take((it) => it.name === aPiece(s.theFind).name);
  wd.take((it) => it.name === X.name);
  s.bob.said.length = 0; s.dan.said.length = 0;
  wb.close();
  wd.close();
  s.net.flush();
  const want = X.group === 'Currency' ? X.stackCount : 1;
  assert.equal(holds(s.bob, X) + holds(s.dan, X), want, `T29: ${X.name} - Bob holds ${holds(s.bob, X)}, Dan holds ${holds(s.dan, X)}: both kept it (each took it from its own window and said a whole list)`);
  assert.equal(holds(s.bob, X), want, 'to Bob, whose claim reached the host first');
  assert.ok(s.dan.said.includes(RL.ROOM_TAKEN_TEXT), 'and Dan is told');
  for (const p of s.all) assert.equal(find(p).some((it) => it.name === X.name), false, `${p.id}: gone from the find`);
});

test('T29 / GRAVE-PARTY: the dungeon\'s host is a STRANGER to the searcher\'s party - it judges every claim on the find, never shows the find, and never starts its own five hours', () => {
  const s = crypt({ strangerHost: true });
  const { eve } = s;
  const wa = windowOf(s.ann);
  assert.ok(search(s.ann, 0, wa), 'Ann searches and finds');
  const theFind = find(s.ann).map((it) => ({ ...it }));
  wa.close();
  s.net.flush();
  for (const p of s.all) assert.deepEqual(findDesc(p), theFind.map(desc), `${p.id}: the party's one find (guard)`);
  assert.deepEqual(find(eve), [], 'the host is not of the party: it is shown nothing');
  assert.equal(hoursLeft(eve), 0, 'and no five hours run for it');
  assert.ok(hoursLeft(s.bob) > 0, 'while they run for the party (guard)');
  const wb = windowOf(s.bob), wd = windowOf(s.dan);
  assert.ok(openFind(s.bob, 0, wb) && openFind(s.dan, 0, wd), 'two partymates open the find');
  const X = wb.take((it) => it.name === aPiece(theFind).name);
  wd.take((it) => it.name === X.name);
  s.dan.said.length = 0;
  wb.close(); wd.close();
  s.net.flush();
  const want = X.group === 'Currency' ? X.stackCount : 1;
  assert.equal(holds(s.bob, X) + holds(s.dan, X), want, `T29/GRAVE-PARTY: ${X.name} - Bob holds ${holds(s.bob, X)}, Dan holds ${holds(s.dan, X)}: the host outside the party judged nothing, so both kept it`);
  assert.ok(s.dan.said.includes(RL.ROOM_TAKEN_TEXT), 'the later claim is told');
  assert.deepEqual(find(eve), [], 'the host still shows no find');
  assert.equal(hoursLeft(eve), 0, 'and still starts no hours of its own');
  for (const p of s.all) assert.equal(find(p).some((it) => it.name === X.name), false, `${p.id}: gone from the party's find`);
});

test('T30 (guard): SEARCH1\'s five hours run for the searcher\'s party alone - a stranger in the same crypt may search the same coffin for herself', () => {
  const s = found();
  const eve = player(s.net, 'acct-eve', { party: null });
  assert.ok(hoursLeft(s.ann) > 0 && hoursLeft(s.bob) > 0 && hoursLeft(s.dan) > 0, 'the five hours run for the party');
  assert.equal(hoursLeft(eve), 0, 'and not for a stranger');
  assert.ok(search(eve, 0, windowOf(eve)), 'the stranger searches the same coffin and finds for herself');
});

test('T30 / GRAVE-PARTY: a find heard before the party was formed is KEPT unlanded, and the coffin presses it again - the party then holds the find, its five hours, the searcher\'s name, and a take of it is the party\'s claim', () => {
  const s = found();
  const late = player(s.net, 'acct-eve', { party: null });   // not yet seated with Ann
  s.net.sent.length = 0;
  const wa = windowOf(s.ann);
  assert.ok(openFind(s.ann, 0, wa), 'Ann opens her find again');
  wa.close();
  s.net.flush();
  assert.deepEqual(find(late), [], 'a stranger lands nothing');
  assert.equal(hoursLeft(late), 0, 'and starts no hours');
  for (const p of [...s.all, late]) picture(p.social, p.acct, [...PARTY, 'acct-eve']);   // Ann's party takes Eve in: every member's hub picture says so
  const we = windowOf(late);
  assert.ok(openFind(late, 0, we), 'the press reads the kept word again: the find opens');
  assert.deepEqual(findDesc(late), findDesc(s.ann), 'the same find as the party\'s');
  assert.ok(hoursLeft(late) > 0, 'her five hours run now');
  assert.match(late.as(() => searchedText(objectKey(0))), /Ann/, 'and she is told whose search it was');
  const X = we.take((it) => it.name === aPiece(s.theFind).name);
  we.close(); s.net.flush();
  const want = X.group === 'Currency' ? X.stackCount : 1;
  assert.equal(holds(late, X) + holds(s.ann, X) + holds(s.bob, X) + holds(s.dan, X), want, 'a take of it is one copy in the room');
  for (const p of [...s.all, late]) assert.equal(find(p).some((it) => it.name === X.name), false, `${p.id}: gone from the find`);
});

test('T30 / WORLD8 (guard): a word about a find stamped past the respawn is not the room\'s - a partymate who hears it lands nothing and starts no hours', () => {
  const s = crypt();
  const wa = windowOf(s.ann);
  assert.ok(search(s.ann, 0, wa), 'Ann searches and finds');
  wa.close();
  const word = s.net.sent.map((f) => f.data.l?.find((r) => r.k === 'srch:0')).filter(Boolean).at(-1);
  assert.ok(word, 'Ann said the find to the room');
  const stale = clone(word); stale.t = clock.t - 3 * 24 * 3600_000;
  s.net.sent.length = 0;
  s.dan.as(() => s.dan.h.applyActions('a0a0-0001', { k: ROOM, l: [stale] }));
  assert.deepEqual(find(s.dan), [], 'a word past the room\'s hour lands nothing');
  assert.equal(hoursLeft(s.dan), 0, 'and starts no hours');
});

test('T30 / mixed builds: a NEW find word is no WORLD4 list (it says a base, not `r`, so an older build marks it unreadable and a stranger\'s is kept by nobody there) - and carries its searcher', () => {
  const s = crypt();
  const wa = windowOf(s.ann);
  assert.ok(search(s.ann, 0, wa), 'Ann searches and finds');
  const words = s.net.sent.flatMap((f) => f.data.l ?? []).filter((r) => r.k === 'srch:0');
  assert.ok(words.length >= 1, 'the search was said to the room');
  for (const w of words) {
    assert.equal('r' in w, false, 'T30: the word carries no whole list for an older build to land (`r`)');
    assert.equal(w.by, 'acct-ann', 'it names its searcher (GRAVE-PARTY)');
  }
  const birth = words.find((w) => Array.isArray(w.b));
  assert.ok(birth, 'and the search said a base `b`');
  assert.equal(birth.b.length, find(s.ann).length, 'the find\'s own records');
});

test('T30 / mixed builds: an OLDER build\'s whole-list word is a BIRTH when the room has none, then that peer\'s DIFF - never a list landed over the room\'s: its untouched second word brings back no taken piece, a piece gone from it is its take, one added its put', () => {
  setSharedClock(() => sharedClassicMinutes(clock.t));
  const net = actRoom();
  const bob = player(net, 'acct-bob', { host: true });   // the dungeon's host is a new build; the searcher is Ann on an older one
  const dan = player(net, 'acct-dan');
  const t = ITEM_TEMPLATES;
  const mk = (name, extra = {}) => { const x = t.find((q) => q.name === name); return { group: 'Weapons', templateIndex: x.index, name, material: 0, value: 40, currentCondition: x.hitPoints ?? 50, maxCondition: x.hitPoints ?? 50, ...extra }; };
  const coin = { group: 'Currency', templateIndex: 276, name: 'Gold Pieces', value: 1, stackCount: 80 };
  const old = (list) => ({ k: 'srch:0', r: list.map((it) => ({ ...it })), t: clock.t, by: 'acct-ann', bn: 'Ann' });
  const sayOld = (list) => { net.send('a0a0-0001', { k: ROOM, l: [old(list)] }); net.flush(); };
  const OLD = [coin, mk('Mace'), mk('Dagger')];
  sayOld(OLD);
  for (const p of [bob, dan]) assert.deepEqual(find(p).map((it) => it.name), ['Gold Pieces', 'Mace', 'Dagger'], `${p.id}: the older build's search is the party's find (a birth)`);
  const wb = windowOf(bob), wd = windowOf(dan);
  assert.ok(openFind(bob, 0, wb) && openFind(dan, 0, wd), 'two partymates open it');
  wb.take((it) => it.name === 'Mace'); wd.take((it) => it.name === 'Mace');
  dan.said.length = 0;
  wb.close(); wd.close(); net.flush();
  assert.equal(holds(bob, mk('Mace')) + holds(dan, mk('Mace')), 1, 'first come at the host: one Mace between them, where each kept its own');
  assert.ok(dan.said.includes(RL.ROOM_TAKEN_TEXT), 'and the later claim is told');
  sayOld(OLD);   // the older build closes a window it opened before: its list, untouched
  for (const p of [bob, dan]) assert.equal(find(p).some((it) => it.name === 'Mace'), false, `T30: the Mace is back in ${p.id}'s find - the older build's untouched word was landed as a list`);
  sayOld([coin, mk('Mace')]);   // its next word: the Dagger gone
  for (const p of [bob, dan]) assert.equal(find(p).some((it) => it.name === 'Dagger'), false, `${p.id}: the Dagger it took is gone`);
  sayOld([coin, mk('Mace'), mk('Flail')]);   // and a Flail laid in
  for (const p of [bob, dan]) assert.equal(find(p).filter((it) => it.name === 'Flail').length, 1, `${p.id}: the Flail it put in is the find's, once`);
  assert.equal(find(bob).some((it) => it.name === 'Mace'), false, 'and the Mace is still not back, though the older build\'s every word says it');
});

// ═══ SLICE 3, THE EDGES OF THE LAW (green with the fix; the first two are guards on what the law keeps) ════════════════════

test('T29 (the loser\'s window): Bob\'s window stands open on his own find when Ann\'s EARLIER search of the coffin reaches him - what his window took of a roll that never was the room\'s is lifted back out of his pack and told, what it laid in comes home, and the list is the party\'s one find', () => {
  const s = crypt();
  alignPeriod();
  const wa = windowOf(s.ann), wb = windowOf(s.bob);
  assert.ok(search(s.ann, 1, wa), 'Ann searches and finds');
  const annFind = findDesc(s.ann, 1);
  clock.t += 700;
  assert.ok(search(s.bob, 1, wb), 'Bob searches 0.7 s later, before he has heard her');
  const mine = find(s.bob, 1).map((it) => ({ ...it }));
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Mace');
  const Y = { name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50 };
  s.bob.entity.items.push(Y);
  const X = wb.take((it) => it.group !== 'Currency');   // a piece of HIS roll, taken in his window
  wb.put(Y);
  s.net.flush();   // Ann's earlier birth reaches Bob while his window stands open on the find
  s.bob.said.length = 0;
  wb.close();
  s.net.flush();
  assert.equal(holds(s.bob, X), 0, `${X.name}, a piece of the roll that lost, is out of Bob's pack again`);
  assert.equal(s.bob.entity.items.some((it) => alike(it, Y)), true, 'and the Mace he laid in is home in his pack');
  assert.ok(s.bob.said.includes(RL.ROOM_TAKEN_TEXT), 'he is told');
  for (const p of s.all) assert.deepEqual(findDesc(p, 1), annFind, `${p.id}: the party's one find, Ann's`);
  assert.notDeepEqual(mine.map(desc), annFind, 'two rolls (guard)');
});

test('T29 (a stranger\'s claim, guard): a stranger in the crypt who knows the find\'s base says a claim on it - the party\'s host, who shows the find, does not hear it', () => {
  const s = found();
  const eve = player(s.net, 'acct-eve', { party: null });
  const birth = s.net.sent.flatMap((f) => f.data.l ?? []).find((w) => w.k === 'srch:0' && Array.isArray(w.b));
  assert.ok(birth, 'the base travelled with the birth');
  const claim = { k: 'srch:0', g: birth.g, lv: birth.lv, tm: birth.tm, h: birth.h, b: birth.b, by: birth.by, bn: birth.bn, t: birth.t, q: [{ id: `${eve.id}:st:1`, p: 0, n: 1, tm: clock.t }] };
  s.net.send(eve.id, { k: ROOM, l: [clone(claim)] });
  s.net.flush();
  for (const p of s.all) assert.deepEqual(findDesc(p), s.theFind.map(desc), `${p.id}: nothing taken from the party's find by a stranger's claim`);
  assert.equal(holds(eve, s.theFind[0]), 0, 'and she holds none of it');
});

test('D-2.1 (a re-asked claim, guard): Bob\'s claim on the find is said again after the host answered it - the host answers it from its ledger, never judges it twice, and the piece lands once', () => {
  const s = found();
  const wb = windowOf(s.bob);
  assert.ok(openFind(s.bob, 0, wb), 'Bob opens the find');
  const X = wb.take((it) => it.name === aPiece(s.theFind).name);
  wb.close();
  s.net.flush();
  const want = X.group === 'Currency' ? X.stackCount : 1;
  assert.equal(holds(s.bob, X), want, 'granted');
  const claimed = s.net.sent.flatMap((f) => f.data.l ?? []).find((w) => w.k === 'srch:0' && Array.isArray(w.q) && w.q.length);
  assert.ok(claimed, 'Bob said his claim');
  s.net.send(s.bob.id, { k: ROOM, l: [clone(claimed)] });   // the same claim again (his verdict frame was lost)
  s.net.flush();
  assert.equal(holds(s.bob, X), want, 'still once');
  for (const p of s.all) assert.equal(find(p).some((it) => it.name === X.name), false, `${p.id}: gone from the find`);
});

// ═══ AUDIT OUTDOOR-LOOT (2026-10-18, PR #1019's audit) - TWO PARTIES, A SECOND SEARCH, WORLD8 ═════════════════════════════
// D1: the seat judged every find in the room's ONE state an object, so a stranger's find of the coffin the seat's party had searched
// was dropped whole (her take lifted and lapsed for good), and a stranger's search first hid the seat's party's own find from the
// seat. A stranger's find is judged in a state of its own now (roomLootHost.js judgeStrangerFind). D2: only the FIRST word of a
// find ever started a partymate's five hours - a search after the five hours left the party unlocked, and a partymate's search then
// wrote its roll over the room's find. D3: WORLD8's sweep let a find go twenty minutes after its last word - inside its five hours -
// and its list stood unshared on every machine: two partymates each took the same piece.
const oneOf = (X) => (X.group === 'Currency' ? X.stackCount : 1);
test('AUDIT OUTDOOR-LOOT D1: a STRANGER searches the coffin the seat\'s party already searched - she takes from her own find, and the party\'s find is untouched', () => {
  const s = found();
  const eve = player(s.net, 'acct-eve', { party: null });
  const we = windowOf(eve);
  assert.ok(search(eve, 0, we), 'Eve searches coffin 0 for herself and finds');
  const X = we.take((it) => it.name === aPiece(find(eve)).name);
  we.close();
  s.net.flush();
  for (let k = 0; k < 10; k++) { clock.t += 2000; s.net.flush(); for (const p of [...s.all, eve]) p.as(() => p.h.roomClaimTick(clock.t)); s.net.flush(); }
  assert.equal(holds(eve, X), oneOf(X), 'D1: Eve holds the piece she took from her own find - the seat judged her claim');
  for (const p of s.all) assert.deepEqual(findDesc(p), s.theFind.map(desc), `${p.id}: the party's find stands as it was`);
});
test('AUDIT OUTDOOR-LOOT D1: a STRANGER searched first - Bob (the seat\'s party, not the seat) takes from his own find, and the seat shows the party Bob\'s', () => {
  const s = crypt();
  const eve = player(s.net, 'acct-eve', { party: null });
  const we = windowOf(eve);
  assert.ok(search(eve, 0, we), 'Eve searches first (guard)'); we.close(); s.net.flush();
  clock.t += 5000;
  const wb = windowOf(s.bob);
  assert.ok(search(s.bob, 0, wb), 'Bob searches the same coffin and finds');
  const bobFind = findDesc(s.bob);
  const X = wb.take((it) => it.name === aPiece(find(s.bob)).name);
  wb.close();
  s.net.flush();
  for (let k = 0; k < 5; k++) { clock.t += 2000; s.net.flush(); for (const p of [...s.all, eve]) p.as(() => p.h.roomClaimTick(clock.t)); s.net.flush(); }
  assert.equal(holds(s.bob, X), oneOf(X), 'D1: Bob holds the piece he took - the seat judged it on his find, not on the stranger\'s');
  const left = bobFind.filter((d, i) => i !== bobFind.indexOf(desc(X)));
  for (const p of s.all) assert.deepEqual(findDesc(p), left, `${p.id} sees Bob's find, less what he took`);
});
test('AUDIT OUTDOOR-LOOT D2: a SECOND search after the five hours starts every partymate\'s five hours again - Bob is told, and the party\'s new find stands whole', () => {
  setSharedClock(() => sharedClassicMinutes(clock.t));
  alignPeriod();
  const s = found();
  clock.t += 26 * 60_000;   // past the five hours (25 real minutes)
  assert.equal(hoursLeft(s.bob), 0, 'Bob may search again (guard)');
  const wa = windowOf(s.ann);
  assert.ok(search(s.ann, 0, wa), 'Ann searches again and finds'); wa.close(); s.net.flush();
  const second = findDesc(s.ann);
  for (const p of [s.bob, s.dan]) assert.ok(hoursLeft(p) > 0, `D2: ${p.id}'s five hours run for Ann's second search (${hoursLeft(p)} left)`);
  for (const p of s.all) assert.deepEqual(findDesc(p), second, `${p.id} sees Ann's second find`);
});
test('AUDIT OUTDOOR-LOOT D3: WORLD8\'s sweep twenty minutes after the find\'s last word leaves a find that still holds pieces the room\'s - two partymates never take the same piece', () => {
  const s = found();
  clock.t += 21 * 60_000;
  for (const p of s.all) p.as(() => p.h.respawnSweep(clock.t / 1000));
  s.net.flush();
  const X = aPiece(s.theFind);
  const wb = windowOf(s.bob), wd = windowOf(s.dan);
  assert.ok(openFind(s.bob, 0, wb), 'Bob opens the find');
  wb.take((it) => it.name === X.name); wb.close(); s.net.flush();
  assert.ok(openFind(s.dan, 0, wd), 'Dan opens the find');
  if (wd.list().some((it) => it.name === X.name)) wd.take((it) => it.name === X.name);
  wd.close(); s.net.flush();
  for (let k = 0; k < 4; k++) { clock.t += 2000; s.net.flush(); for (const p of s.all) p.as(() => p.h.roomClaimTick(clock.t)); s.net.flush(); }
  assert.equal(holds(s.bob, X) + holds(s.dan, X), oneOf(X), 'D3: one piece, one holder');
});
test('AUDIT OUTDOOR-LOOT (T30, a second older peer): an older build\'s FIRST word about a find the room already holds is a baseline - its list as it stands adds nothing (read as a diff from nothing, every piece of it was a put: the find twice over)', () => {
  setSharedClock(() => sharedClassicMinutes(clock.t));
  const net = actRoom();
  const bob = player(net, 'acct-bob', { host: true });
  const dan = player(net, 'acct-dan');
  const t = ITEM_TEMPLATES;
  const mk = (name) => { const x = t.find((q) => q.name === name); return { group: 'Weapons', templateIndex: x.index, name, material: 0, value: 40, currentCondition: x.hitPoints ?? 50, maxCondition: x.hitPoints ?? 50 }; };
  const coin = { group: 'Currency', templateIndex: 276, name: 'Gold Pieces', value: 1, stackCount: 80 };
  const OLD = [coin, mk('Mace'), mk('Dagger')];
  const old = (list) => ({ k: 'srch:0', r: list.map((it) => ({ ...it })), t: clock.t, by: 'acct-ann', bn: 'Ann' });
  net.send('a0a0-0001', { k: ROOM, l: [old(OLD)] }); net.flush();   // Ann's search on an older build: the find's birth
  for (const p of [bob, dan]) assert.deepEqual(find(p).map((it) => it.name), ['Gold Pieces', 'Mace', 'Dagger'], `${p.id}: the older build's search is the party's find (guard)`);
  net.send('a0a0-0009', { k: ROOM, l: [old(OLD)] }); net.flush();   // Ann's second tab, an older build too: its FIRST word, the list as it stands
  for (const p of [bob, dan]) assert.deepEqual(find(p).map((it) => it.name), ['Gold Pieces', 'Mace', 'Dagger'], `${p.id}: the second peer's first word added nothing`);
});
test('AUDIT OUTDOOR-LOOT D3 (the other half): an EMPTIED find is let go at its hour - WORLD8\'s sweep forgets it, as an emptied pile', () => {
  const s = found();
  const wb = windowOf(s.bob);
  assert.ok(openFind(s.bob, 0, wb), 'Bob opens the find (guard)');
  for (const it of [...wb.list()]) wb.take((x) => x === it);
  wb.close(); s.net.flush();
  for (let k = 0; k < 3; k++) { clock.t += 2000; s.net.flush(); for (const p of s.all) p.as(() => p.h.roomClaimTick(clock.t)); s.net.flush(); }
  for (const p of s.all) assert.equal(find(p).length, 0, `${p.id}: the find is emptied (guard)`);
  clock.t += 21 * 60_000;
  for (const p of s.all) p.as(() => p.h.respawnSweep(clock.t / 1000));
  for (const p of s.all) assert.equal(p.state._lootSeen.has('srch:0'), false, `${p.id}: the emptied find is let go`);
});
test('AUDIT OUTDOOR-LOOT D2 (a search that keeps the room\'s mint): a partymate who searches in the same period as the find the room holds sees the room\'s find - his roll written in place never stands over it, and no piece of it leaves for nobody', () => {
  setSharedClock(() => sharedClassicMinutes(clock.t));
  alignPeriod();
  const s = found();
  s.bob.ledger = { rows: [] };   // Bob's five hours forgotten (a ledger his machine lost): he may search the coffin again in the same period
  clock.t += 30_000;
  const wb = windowOf(s.bob);
  assert.ok(search(s.bob, 0, wb), 'Bob searches again (guard)'); wb.close(); s.net.flush();
  for (let k = 0; k < 3; k++) { clock.t += 2000; s.net.flush(); for (const p of s.all) p.as(() => p.h.roomClaimTick(clock.t)); s.net.flush(); }
  for (const p of s.all) assert.deepEqual(findDesc(p), s.theFind.map(desc), `D2: ${p.id}: the room's find stands whole`);
});
