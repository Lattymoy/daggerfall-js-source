// OUTDOOR-LOOT, AC8 (2026-10-17): THE SHARED HARNESS of test/net/containerloot.test.js (phase 1: what a building's cupboard must be
// for everyone in it, read as where the pieces ARE) and test/net/containerloot_protocol.test.js (slice 2: the claims one seat
// judges, the first-open tie-break, the seat's handover, the protections and the older builds - pinned BLACK-BOX, before the fix
// exists). Not a .test.js on purpose: the manifest counts suites, and this is a precondition, not one.
//
// MOUNTED, NOT MATCHED. Each player is the interior host's own doors sliced out of src/scenes/worldModes.js - the container arm
// of the press (tryExit's `key.startsWith('container:')` arm, whatever it calls), the frame's loot settle, the bag's mint at
// the building's mount, the act and memory members the world host calls (applyPlaceActions, placeSharedWorld,
// restorePlaceSharedWorld, placeActionRecords), the plaque's peek (createInteriorPeek as the host builds it), the building's
// teardown (the statements of exitInteriorNow that read the bag) - over the real pure half and the real producers
// (shopStock.js stockHouseContainer on each player's own dice), every name they read that the host imports resolved through
// the host's OWN import list, so a door that moves into a module the host imports is followed. DESIGN.md section 4.9 moves
// WORLD6a's loot block out of createWorldModes (interiorPublishLoot, interiorLootOpened, interiorLootSettle ->
// interiorLootOpen, interiorLootFrame, interiorLootUnborn, interiorLootRoll in world/interior/): a mount that no longer finds
// today's functions in the host reads the moved doors through the host's imports, so the SAME tests run red today and green
// after the move. A name the mounted doors read that neither the host's imports nor this file's `hostScope` provides is
// REPORTED BY NAME (a TypeError with `missing` in hand becomes an assertion that says what to add), never a bare TypeError.
// The host's act path is world.js's own (actSend, actFlush - the pending set that heals a refused act, through the host's
// placeActionRecords), over a session whose sendAct is net/online.js's: the real actGate (ACT_HZ_MAX) and actFrameFits.
//
// WHAT THE MOUNT READS OF THE HOST - the places a fix must leave findable (a pin that cannot find one says which, by an assertion):
//   - the container arm: tryExit's `if (key.startsWith('container:'))` branch that opens the window with interiorInventory(...);
//   - the frame's settle: `if (mode === 'interior') interiorLoot...(...)` (the statement may call any `interiorLoot*` door);
//   - the mint: the smallest block that contains `_intShared = mintInteriorShared(` (the bag, and whatever `net` it is handed);
//   - the members applyPlaceActions, placeSharedWorld, restorePlaceSharedWorld, placeActionRecords, and the consts
//     ownsThisInterior and interiorPeek, and openShelf (the shut shop's stealing window - a function declaration);
//   - the building's teardown: in exitInteriorNow, every statement that READS THE BAG (`_intShared`) ahead of `_intShared = null` is
//     what `leave()` runs - that is where a claim in flight is kept (D-1a); forceExitToExterior must do the same (a by-source pin);
//   - world.js's act path as the host builds it: _actPend, _actLive, _actRoom, _actTooBig, actTooBig, actSend, actFlush.
// WHAT IT PROVIDES them (`hostScope` in player()): the live names the host's closure holds - mode, interiorCtx, _intShared,
// playerEntity, interiorBuilding, interiorHome, stockedToday, houseOwnedAt, host.{onActions, onLootClaimed, roomHost, selfId},
// interiorInventory, interiorWindows, setMidScreenText, say ... - and two producers' stand-ins a pin may choose (the cupboard's
// first-open roll, the shelf's stock); a name outside them is reported, never silently undefined.
// F-1 (PR A phase 1b, test/net/shelfloot.test.js) ADDS, additively: the OPEN shop's counter - openShelf's trade arm, openTradeWindow, commitTrade and
// openMerchantSell sliced out of the host the same way, the real trade window the door (ui/tradeDoor.js) builds - and the helpers to drive it
// as a player does (`openCounter`, `openSell`, `stage`, `stageLocal`, `steal` - the roll chosen through the player's own dice, never the law replaced
// -, `buy` - the mode action and its Yes -, `closeCounter`, `bulkAsync` for the enhanced counter's lazy chunk); a `shelves`/`shelfRoll`/`building`
// option per player was already here; `older()` plays a shelf too (`key`), `p.stowed` is AUTO-HOLD's per-reader hold, `p.guards` the guards the
// caught Steal called, `offline` a player with no peer id, `p.counters` the windows the door built.
// TWO CHOICES TO KNOW. (1) A cupboard whose container holds a list of its own (`items` an array) is not UNBORN to the peek,
// whatever the room's state says: phase 1's CONTAINER-PEEK guards hand-assign `items` and expect the plaque to list them; the
// pins that need a null peek (T26, M2) get it because the roll and the scene's cache are held aside, `items` null. (2) A press
// takes 2 ms of the shared clock (`pressYes`), so two first-opens are never stamped by the very same millisecond unless a pin says
// so (`advance: 0`), and a piece's identity (`sig`) is read as the item law reads it (a piece in a room's word comes back with
// the `value` the law adds).
//
// THE CLOCKS. `clock.t` is the local monotonic clock (performance.now); each player reads it plus their own `skew`, and
// Date.now the same (the machine's clock may be minutes off - R-3). The SHARED clock (WORLD5's, the relay's) is one function
// of `clock.t` that no skew touches: it is what a stamp two machines compare must be read from (worldTick.js
// setSharedClock; the wire's wallMsForClassicMinutes over worldMinutes, as dungeonContext's _wallNow reads it).
// Time passes by the test advancing `clock.t` (elapse) - never a real sleep.
import '../modsOff.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { withDom, fakeDom } from '../invdrag.mjs';
import { movedOutOf } from '../hostText.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { planTake, planStore, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { runBulk, bulkVerdict, listAtCap, CONTAINER_LIST_CAP } from '../../src/ui/storeBulk.js';
import { resolveHover } from '../../src/systems/worldHover.js';
import { houseContainerHover } from '../../src/systems/worldTooltips.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { setSeed } from '../../src/formats/dfRandom.js';
import { setCarriedFilter, peerHanded } from '../../src/systems/peerWord.js';
import { carriedPieces, setStowedKeys } from '../../src/systems/item/itemIds.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { sharedClassicMinutes, actGate, actFrameFits } from '../../src/net/wire.js';
import { validLootList, LOOT_LIST_MAX } from '../../src/systems/loot/loot.js';
import { clearStolen } from '../../src/systems/stolenGoods.js';
import { ITEM_TEMPLATES } from '../../src/characters/paperdoll/paperdoll.js';
import { GROUP_TEMPLATE_INDICES, setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { MB_BUTTONS } from '../../src/ui/messageBox.js';
import { setCrimeGuildClock } from '../../src/systems/crimeGuilds.js';

export { LOOT_LIST_MAX };
export const REAL_RANDOM = Math.random;
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
export const clone = (v) => JSON.parse(JSON.stringify(v));

// ═══ THE HOST'S DOORS, sliced (test/systems/partyloot.test.js's method) ═══════════════════════════════════════════════
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
function walk(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  fn(n);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, fn)); else if (v && typeof v.type === 'string') walk(v, fn); }
}
const mentions = (node, name) => { let hit = false; walk(node, (n) => { if (n.type === 'Identifier' && n.name === name) hit = true; }); return hit; };

/** A host's source, WHOLE (its file, then every module moved out of it), as an AST to slice doors from, and its import list. */
function sourceOf(hostPath) {
  const files = [hostPath, ...movedOutOf(hostPath)].map((p) => { const src = rd(p); return { p, src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }; });
  /** Every node of the host (and of the modules moved out of it) the predicate takes, with its file. */
  const nodes = (pred) => { const out = []; for (const f of files) walk(f.ast, (n) => { if (pred(n, f.src)) out.push({ f, n }); }); return out; };
  const text = ({ f, n }) => f.src.slice(n.start, n.end);
  const named = (type, name) => (n) => n.type === type && n.id?.name === name;
  const imports = new Map();
  for (const f of files) for (const n of f.ast.body) {
    if (n.type !== 'ImportDeclaration') continue;
    const from = new URL(n.source.value, new URL(`../../${f.p}`, import.meta.url)).href;
    for (const s of n.specifiers) if (!imports.has(s.local.name)) imports.set(s.local.name, [from, s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : s.type === 'ImportDefaultSpecifier' ? 'default' : '*']);
  }
  /** A function declaration's text, '' where the door has moved out of the host. */
  const fnOf = (name) => nodes(named('FunctionDeclaration', name)).map(text)[0] ?? '';
  const declOf = (name) => { const hit = nodes((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)).map(text)[0]; assert.ok(hit, `${hostPath} declares ${name}`); return hit; };
  const memberOf = (name) => {
    const hit = nodes((n) => n.type === 'Property' && !n.computed && n.key?.name === name && (n.value.type === 'FunctionExpression' || n.value.type === 'ArrowFunctionExpression'))[0];
    assert.ok(hit, `${hostPath} has the member ${name} (the world host's door)`);
    const body = hit.f.src.slice(hit.n.value.start, hit.n.value.end);
    return hit.n.method ? `function ${body}` : body;
  };
  /** Every name `code` reads that the host IMPORTS, bound to the module's own export. */
  const bind = async (code) => {
    const names = new Set();
    walk(acorn.parse(`(function () {\n${code}\n})`, { ecmaVersion: 'latest' }), (n) => { if (n.type === 'Identifier') names.add(n.name); });
    const out = {};
    for (const name of names) {
      const hit = imports.get(name);
      if (!hit) continue;
      const mod = await import(hit[0]);
      out[name] = hit[1] === '*' ? mod : mod[hit[1]];
    }
    return out;
  };
  return { files, nodes, text, named, imports, fnOf, declOf, memberOf, bind };
}
const HOST = 'src/scenes/worldModes.js';
const WORLD = 'src/scenes/world.js';
const modes = sourceOf(HOST);
const { nodes, text, named, fnOf, declOf, memberOf } = modes;

/** The press's container arm: tryExit's `if (key.startsWith('container:')) { ... }` that opens the cupboard's window. */
const ARM = (() => {
  const hits = nodes((n, src) => n.type === 'IfStatement' && src.slice(n.test.start, n.test.end) === "key.startsWith('container:')" && /interiorInventory\(/.test(src.slice(n.consequent.start, n.consequent.end)));
  assert.equal(hits.length, 1, 'the host has ONE container arm that opens a cupboard\'s window (tryExit)');
  return text({ f: hits[0].f, n: hits[0].n.consequent });
})();
/** The frame's loot settle: `if (mode === 'interior') interiorLoot...(...)` - the close's word, every interior frame. */
const SETTLE = (() => {
  const hits = nodes((n, src) => n.type === 'IfStatement' && src.slice(n.test.start, n.test.end) === "mode === 'interior'" && /interiorLoot\w*\(/.test(src.slice(n.consequent.start, n.consequent.end)));
  assert.equal(hits.length, 1, 'the host\'s frame runs ONE interior loot settle');
  return text(hits[0]);
})();
/** The building's room, minted at the mount: the block that mints `_intShared` (WORLD6a's bag) for the context. */
const MINT = (() => {
  const hits = nodes((n, src) => n.type === 'BlockStatement' && src.slice(n.start, n.end).includes('_intShared = mintInteriorShared(')).sort((a, b) => (a.n.end - a.n.start) - (b.n.end - b.n.start));
  assert.ok(hits.length, 'the host mints the building\'s bag');
  return text(hits[0]);
})();
/** THE BUILDING'S TEARDOWN, as far as the room goes: every place the host drops the bag (`_intShared = null`) - exitInteriorNow
 *  is the door out, forceExitToExterior the teleport's and the load's - with the statements that read the bag AHEAD of it. A
 *  claimer's own teardown is where a claim in flight and not lapsed is kept (DESIGN-REVIEW D-1/D-1a): the host tells the room
 *  there (`interiorLootLeave`), ahead of the drop. */
const LEAVE_SITES = (() => {
  const sites = [];
  for (const name of ['exitInteriorNow', 'forceExitToExterior']) {
    const fn = nodes((n) => n.type === 'FunctionDeclaration' && n.id?.name === name)[0]
      ?? nodes((n) => n.type === 'Property' && n.key?.name === name && n.value?.body)[0];
    assert.ok(fn, `the host has ${name}, a door out of a building that drops the bag`);
    const drops = nodes((n) => n.type === 'AssignmentExpression' && n.left?.type === 'Identifier' && n.left.name === '_intShared' && n.right?.type === 'Literal' && n.right.value === null)
      .filter((d) => d.n.start >= (fn.n.value?.start ?? fn.n.start) && d.n.end <= (fn.n.value?.end ?? fn.n.end));
    assert.equal(drops.length, 1, `${name} drops the building's bag (\`_intShared = null\`) exactly once`);
    const block = [];
    walk(fn.n.value?.body ?? fn.n.body, (b) => { if (b.type === 'BlockStatement' && b.body.some((s) => s.expression === drops[0].n)) block.push(b); });
    assert.equal(block.length, 1, `${name}'s drop of the bag stands in one block`);
    const body = block[0].body;
    const at = body.findIndex((s) => s.expression === drops[0].n);
    const before = body.slice(0, at).filter((s) => mentions(s, '_intShared')).map((s) => drops[0].f.src.slice(s.start, s.end));
    sites.push({ name, before });
  }
  return sites;
})();
const LEAVE = `${LEAVE_SITES[0].before.join('\n')}\n_intShared = null;`;
export { LEAVE_SITES };
/** The shut shop's shelf: openShelf's stealing window (DESIGN 4.7 - a shelf stays on WORLD6a's whole-list law). */
const SHELF = `${fnOf('openShelf')}\n${fnOf('shelfLootSpawned')}`;
/** F-1 (the shelf joins the cupboard law, test/net/shelfloot.test.js): the OPEN shop's counter, its doors sliced the same way - the
 *  trade window's own opener, the deal it concludes (Buy, Sell) and the merchant's Sell screen, with the host-local helpers they
 *  read (the price adjustment, the delivery, the HUD line). Additive: a mount that finds none of them reads them from the host's
 *  imports or reports them by name. */
const TRADE = ['openTradeWindow', 'commitTrade', 'openMerchantSell', 'shopAdjustment'].map((n) => fnOf(n)).join('\n');

const CLIENT = `
  ${SHELF}
  ${TRADE}
  ${declOf('ownsThisInterior')}
  ${declOf('interiorPeek')}
  ${MINT}
  const members = { applyPlaceActions: ${memberOf('applyPlaceActions')}, placeSharedWorld: ${memberOf('placeSharedWorld')}, restorePlaceSharedWorld: ${memberOf('restorePlaceSharedWorld')}, placeActionRecords: ${memberOf('placeActionRecords')} };
  return {
    members,
    press: (key) => { ${ARM} },
    frame: () => { ${SETTLE} },
    peek: (key) => interiorPeek(key),
    bag: () => _intShared,
    leave: () => { ${LEAVE} },
    openShelf: (i) => openShelf(i),
    openMerchantSell: () => (typeof openMerchantSell === 'function' ? openMerchantSell() : false),
  };
`;
const BOUND = await modes.bind(CLIENT);

/** The host's act path (world.js, over a session): actSend through the pending set that heals a refused act, and actFlush. */
const world = sourceOf(WORLD);
const ACT = `
  ${['_actPend', '_actLive', '_actRoom', '_actTooBig', 'actTooBig', 'actSend', 'actFlush'].map((n) => world.declOf(n)).join('\n')}
  return { send: actSend, flush: actFlush, pend: _actPend };
`;
const ACT_BOUND = await world.bind(ACT);

/** A name the mounted doors read that nothing provides is recorded here, to be NAMED if a door then throws. */
const scoped = (state, missing) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => {
    if (k === Symbol.unscopables) return undefined;
    if (k in t) return t[k];
    if (typeof k === 'string' && !(k in globalThis)) missing.add(k);
    return globalThis[k];
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state, missing) => new Function('__s', `with (__s) { ${body} }`)(scoped(state, missing));
/** A door of a mounted host, its throw explained: a TypeError after a name nothing provided is the HARNESS's gap, not the code's. */
function guarded(who, missing, fn) {
  return (...args) => {
    try { return fn(...args); } catch (e) {
      if (e?.name === 'AssertionError' || !missing.size) throw e;
      throw new assert.AssertionError({ message: `${who}: a mounted door of the host threw (${e?.message ?? e}) after reading ${[...missing].map((m) => `\`${m}\``).join(', ')}, which neither the host's imports nor containerLootHarness.mjs's hostScope provide - add it to hostScope (the host's wiring changed)` });
    }
  };
}

// ═══ THE BUILDING: a relay of act frames, and the players in it ═════════════════════════════════════════════════════
export const TODAY = 2026 * 1000 + 290;   // shopStock.js createStockedDate's shape: year * 1000 + the day of the year
export const KEY = 'container:0';
export const ROOM = 'interior:m1.7';   // interiorLocationKey(1, 7): the relay room of the building the mount builds
/** The local monotonic clock (performance.now), milliseconds. Every client reads it plus its own skew. */
export const clock = { t: 5_000_000 };
/** The relay's wall clock at `clock.t` = 0: the SHARED clock reads WALL0 + clock.t, whatever a machine's own clock says. */
export const WALL0 = Date.UTC(2026, 9, 17, 12, 0, 0);
/** The shared clock now, as a stamp two machines compare reads it (the relay's millisecond). */
export const wallNow = () => WALL0 + clock.t;
/** A stranger's cupboard as interiorContext builds one (a house's chest model; never stocked: `items` null). */
export const cupboard = () => ({ modelIdNum: 41000, stockedDate: 0, items: null });
/** The room's longest socket is its seat (the relay's `host`). */
export const idOf = (p) => (typeof p === 'string' ? p : p?.id);

export function relay() {
  setSharedClock(() => sharedClassicMinutes(WALL0 + clock.t));   // online, WORLD5's clock stands: the relay's, the same on every client
  const players = [];
  const q = [];
  const log = [];
  const waiting = [];
  const net = {
    players, log, frames: q,
    /** The relay's host - told in the welcome and in a host frame when it changes (net/online.js `host`). */
    seatId: null,
    /** `(from, data) => true`: the relay LOSES the word silently (its room budget), the sender having been told it went. */
    drop: null,
    held: new Set(), cut: new Set(), dead: new Set(),
    join(p) { players.push(p); if (net.seatId == null) net.seatId = p.id; },
    seat: () => net.seatId,
    /** The seat's socket is gone and the relay says so: the longest socket left is the seat. */
    handOver() { const next = players.find((p) => p.here && !net.dead.has(p.id) && p.id !== net.seatId); net.seatId = next?.id ?? null; return net.seatId; },
    /** A word accepted by the relay, as its sender said it (the wire's JSON round trip). */
    accept(from, data) {
      log.push({ from, data: clone(data), at: clock.t });
      if (net.drop?.(from, clone(data))) return true;
      q.push({ from, data: clone(data) });
      return true;
    },
    /** net/online.js sendAct, as far as the wire goes: the socket open, ACT_HZ_MAX a second at home, the small cap. */
    sendAct(p, data) {
      if (!p.here || net.dead.has(p.id) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
      const gate = actGate(p.abucket, clock.t);
      if (!gate.pass) return false;
      if (!actFrameFits(data)) return false;
      p.abucket = gate.bucket;
      return net.accept(p.id, data);
    },
    /** Spend a player's act budget for the second (ACT_HZ_MAX tokens): the next word it says is refused at home. */
    exhaust(p) { p.abucket = { tokens: 0, at: clock.t }; },
    hold(dir) { net.held.add(dir); },
    release(dir) { net.held.delete(dir); for (let i = 0; i < waiting.length;) { if (waiting[i].dir === dir) { q.unshift({ ...waiting[i], resumed: true }); waiting.splice(i, 1); } else i++; } },
    /** A word as a peer says it from OUTSIDE the mounted players (an older build's, a hostile client's): fanned to everyone.
     *  (`send` is the phase-1 relay's name for the same.) */
    say(from, data) { return net.accept(from, data); },
    send(from, data) { return net.accept(from, data); },
    /** Every word said so far, landed on everyone in the building but its author (world.js online.onAct -> modes.applyPlaceActions).
     *  Delivery is instant; a direction held or cut, a dead socket, a player out of the building hears nothing. A relay that
     *  never goes quiet is a live-lock, and said so. */
    flush(limit = 400) {
      let n = 0;
      while (q.length) {
        assert.ok(n++ < limit, `the building's relay never went quiet: ${limit} words delivered and ${q.length} still queued (a verdict that answers a verdict that answers a verdict?)`);
        const w = q.shift();
        for (const p of players) {
          if (p.id === w.from || !p.here || net.dead.has(p.id)) continue;
          const dir = `${w.from}>${p.id}`;
          if (w.resumed && w.to !== p.id) continue;
          if (net.cut.has(dir)) continue;
          if (net.held.has(dir)) { waiting.push({ from: w.from, data: w.data, dir, to: p.id }); continue; }
          p.recv(w.from, clone(w.data));
        }
      }
    },
    /** The words from `from` the relay accepted about the cupboard (its records, in the order said). */
    words(from = null, key = KEY) { return log.filter((e) => (from == null || e.from === idOf(from)) && Array.isArray(e.data?.l)).flatMap((e) => e.data.l.filter((r) => r?.k === key).map((r) => ({ ...r, __from: e.from, __at: e.at }))); },
  };
  return net;
}

// ═══ ONE PLAYER: their own copy of the interior, the host's doors over it, their dice, their clock ═════════════════════
const filterOf = (entity) => (list) => {   // AUTO-HOLD's rule as the realm session registers it (scenes/realmHoldHost.js): never a piece the reader carries
  const c = carriedPieces(entity);
  const keys = new Set(c.keys);
  return list.filter((it) => { const k = c.keyOf(it); if (!k) return true; if (keys.has(k)) return false; keys.add(k); return true; });
};

/** One player in the building. Options: `seed` their dice, `home` the interior's home record, `skew` how far their machine's
 *  clock is from the true one (ms), `roll` a function answering the cupboard's first-open roll (a stand-in for the producer
 *  where a pin needs a chosen stock; else stockHouseContainer on their own dice), `cached` the scene cache's list at the
 *  mount, `owned` the player owns this house, `building` the interior's building record. */
export function player(net, id, { seed = 1, home = null, skew = 0, roll = null, cached = null, owned = false, building = null, name = id, shelves = 0, shelfRoll = null, offline = false } = {}) {
  const entity = { name, level: 5, gender: 'male', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, luck: 50, agility: 50 }, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [] };
  const said = [];
  const open = new Set();
  const missing = new Set();
  const thefts = [];
  const counters = [];   // F-1: the trade windows the open shop's arms mounted, in order
  const guards = [];     // F-1: every SpawnCityGuards the counter's caught Steal called
  const ctx = { containers: [cupboard()], shelves: Array.from({ length: shelves }, () => ({ modelIdNum: 41000, stockedDate: 0, items: null })), actions: { applyRemote: () => 0, collectSaveData: () => [], onChanged: null } };
  if (cached) { ctx.containers[0].items = cached.map(clone); ctx.containers[0].stockedDate = TODAY; }
  const p = { id, kind: 'client', entity, said, ctx, open, here: true, window: null, rand: lcg(seed), dfSeed: seed * 7919, skew, roll, shelfRoll, thefts, counters, guards, stowed: [], dayShift: 0, abucket: undefined, missing };
  p.as = (fn) => {
    const was = { random: Math.random, perf: performance.now, date: Date.now };
    Math.random = p.rand;
    performance.now = () => clock.t + p.skew;
    Date.now = () => WALL0 + clock.t + p.skew;
    setSeed(p.dfSeed);
    setCarriedFilter(filterOf(entity));
    setStowedKeys(() => p.stowed);   // AUTO-HOLD: the ledger keys of the pieces THIS reader has put in a ship's hold (a shop's shelf never offers them back)
    const guildClock = setCrimeGuildClock(() => 1_000_000);   // F-1: the Thieves Guild's tally reads the world clock (crimeGuilds.js: with none registered it is inert)
    try { return fn(); } finally {
      p.dfSeed = (p.dfSeed * 1103515245 + 12345) >>> 0;
      Math.random = was.random; performance.now = was.perf; Date.now = was.date;
      setCarriedFilter(null);
      setStowedKeys(null);
      setCrimeGuildClock(guildClock);
    }
  };
  p.online = { status: 'open', room: ROOM, sendAct: (data) => net.sendAct(p, data) };
  const REAL = { stockHouseContainer: BOUND.stockHouseContainer, privatePropertyTheft: BOUND.privatePropertyTheft, stockShopShelf: BOUND.stockShopShelf };
  /** What the host's scope holds that its imports do not: the live names the mounted doors read. */
  const hostScope = {
    mode: 'interior', interiorCtx: ctx, ctx, _intShared: null, playerEntity: entity,
    interiorBuilding: building ?? { buildingKey: 7, buildingType: BUILDING_TYPES.House2, quality: 10 },
    interiorHome: home, interiorSeatHall: null, privateVisitRoom: null, interiorCabin: null, interiorDecor: null,
    questSceneCtx: () => ({ mapId: 1 }), visitLayoutNow: () => null,
    stockedToday: () => TODAY + (p.dayShift | 0), /* F-1: a pin turns the day by setting `p.dayShift` (the world's day is shared: every player's) */ hallMemberHere: () => false, caravanGuestHere: () => false, openHallChest: () => {},
    houseOwnedAt: () => owned,   // worldModes.js "const houseOwnedAt = (b, key) =>"; a stranger's cupboard: the player owns no house here
    hallOfRecordsHere: () => false, decorDeliverCarried: () => {}, decorDeliver: () => {},   // DECOR2b's furnisher delivers: no furniture stands on a pin's shelf
    host: { onActions: offline ? undefined : (data) => p.act.send(data), onLootClaimed: () => {}, spawnCityGuards: (f) => guards.push(f), roomHost: () => net.seat(), selfId: () => (offline ? null : id) },
    interiorInventory: (deps) => p.window?.open(deps) ?? null,
    interiorWindows: { containsWindow: (w) => open.has(w) },
    interiorOverlay: null, mountInterior: () => {},
    setMidScreenText: (t) => said.push(t), say: (t) => said.push(t),
    // F-1: the open shop's counter - the town's talk records what the counter says (the roll's line, the keeper's), the art is the host's
    // own gate answered (the enhanced skin reads no ARENA2), the textures a window's icons ask for are none
    townTalk: { say: (t) => said.push(t), lines: () => [], cityName: () => 'Daggerfall', overlay: null, factionDict: null },
    tradeDoorReady: () => true, renderer: { textures: new Map() }, getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {},
    /** The door itself (ui/tradeDoor.js createTradeWindow), unchanged - the window it builds is kept for the pin to drive and stands in the interior's window stack. */
    createTradeWindow: (hooks) => { const w = BOUND.createTradeWindow(hooks); if (w) { counters.push(w); open.add(w); } return w; },
    /** The producer's stand-in only where a pin needs a chosen stock; else the real one on this player's own dice. */
    stockHouseContainer: (...a) => (p.roll ? clone(p.roll()) : REAL.stockHouseContainer(...a)),
    stockShopShelf: (...a) => (p.shelfRoll ? clone(p.shelfRoll()) : REAL.stockShopShelf(...a)),
    /** The theft's decision, observed: the basket it was handed (the attempt - STOLEN-GOODS, DESIGN-REVIEW R-5), then the real one. */
    privatePropertyTheft: (args) => { thefts.push({ basket: [...(args?.basket ?? [])] }); return REAL.privatePropertyTheft(args); },
  };
  const state = { ...BOUND, ...hostScope };
  p.state = state;
  p.h = mount(CLIENT, state, missing);
  for (const k of ['press', 'frame', 'peek', 'bag', 'leave', 'openShelf']) p.h[k] = guarded(id, missing, p.h[k]);
  for (const k of Object.keys(p.h.members)) p.h.members[k] = guarded(id, missing, p.h.members[k]);
  p.act = mount(ACT, { ...ACT_BOUND, online: p.online, _onlineKey: ROOM, modes: { placeActionRecords: (keys) => p.h.members.placeActionRecords(keys) } }, new Set());
  p.recv = (from, data) => p.as(() => p.h.members.applyPlaceActions(from, data));
  /** A callback the mounted doors handed out (the Yes of the question, a window's hooks and its onClose): its throw explained too. */
  p.guard = (fn) => guarded(id, missing, fn)();
  net.join(p);
  return p;
}

/** A SHUT SHOP (insideOpenShop false): its shelf opens the stealing window (openShelf - DESIGN 4.7), the one shelf door a pin can
 *  mount without a trade window. */
export const SHOP = Object.freeze({ buildingKey: 7, buildingType: BUILDING_TYPES.GeneralStore, quality: 10, insideOpenShop: false });
/** The press on the shelf `i` through the host's own openShelf; answers the window it opened, or null. */
export function openShelfOf(p, win, i = 0) {
  p.window = win;
  p.as(() => p.h.openShelf(i));
  return win.cur;
}
/** The shelf's items as player `p` sees them. */
export const shelfOf = (p, i = 0) => p.ctx.shelves[i].items;

/** The press on the cupboard through the host's own arm, and the player's answer to the private-property question (Yes by
 *  default). Answers the window the press opened, or null. */
export function pressYes(p, win, answer = 'Yes', { advance = 2 } = {}) {
  p.window = win;
  p.as(() => {
    p.h.press(KEY);
    const box = p.state.interiorOverlay;
    if (box && typeof box.onYes === 'function' && !win.cur) { p.state.interiorOverlay = null; p.guard(() => (answer === 'Yes' ? box.onYes : box.onNo)()); }
  });
  clock.t += advance;   // a press takes a moment: two first-opens are never stamped by the very same millisecond unless a pin says so (advance: 0)
  return win.cur;
}
/** The press, answered No ("No claims nothing"). */
export const pressNo = (p, win) => pressYes(p, win, 'No');
/** The interior's frame - the settle that says a closed window's word, and the act path's heal of a refused one. */
export const frame = (p) => p.as(() => { p.h.frame(); p.act.flush(); });
export const items = (p) => p.ctx.containers[0].items;
/** What a piece IS, whatever its holder: its record, less the marks a holder adds (a theft's, a ledger's), and as the item law
 *  reads it - a piece that travels in a room's word (a put, a stored piece, a base) comes back from validLootList with the
 *  fields the law adds (`value`), and a comparison of the bare records would call one piece two. Keys sorted, so the order a
 *  record was built in is no part of it. */
export const sig = (it) => {
  const { stolen: _s, stolenFrom: _f, ...rest } = it ?? {};
  const law = (() => { try { return validLootList([JSON.parse(JSON.stringify(rest))])?.[0] ?? rest; } catch { return rest; } })();
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  return JSON.stringify(sorted(law));
};
export const names = (list) => (list ?? []).map((it) => it.name);
/** A piece as the templates mint it (test/ui/lootbulk.test.js's `mk`). */
export const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
export const mk = (name, group = 'Weapons', extra = {}) => { const t = tmpl(name); assert.ok(t, `${name} is a template`); return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50, ...extra }; };
/** The plaque over the cupboard: the real resolveHover over the host's peek and the house container's own namer. */
export const plaque = (p) => resolveHover({ key: KEY, distance: 1, reach: 3 }, { name: (k) => (k.startsWith('container:') ? houseContainerHover('Cupboard', { owned: false }) : null), contents: (k) => p.as(() => p.h.peek(k)) });
export const peekNames = (p) => { const f = plaque(p); return f?.kind === 'items' ? f.rows.map((r) => r.name) : []; };
/** How many of a piece a list holds (two pieces of one record are one piece twice). */
export const count = (list, it) => (list ?? []).filter((x) => sig(x) === sig(it)).length;

/** The number of a named piece a list holds, by stack. */
export const have = (list, name) => (list ?? []).filter((it) => it?.name === name).reduce((n, it) => n + (Number.isInteger(it.stackCount) && it.stackCount > 0 ? it.stackCount : 1), 0);
/** What `p` holds of a named piece in the pack. */
export const packHas = (p, name) => have(p.entity.items, name);
/** Whom the named piece is listed for: the cupboard's list (the room's, as each client sees it) - by player id. */
export const listedFor = (s, name) => s.ps.filter((p) => p.kind === 'client' || p.kind === 'older').filter((p) => have(items(p), name) > 0).map((p) => p.id);
/** The pieces named in a list, as ids of a census: `name x n`. */
export const census = (list) => { const m = new Map(); for (const it of list ?? []) m.set(it.name, (m.get(it.name) ?? 0) + (it.stackCount ?? 1)); return Object.fromEntries([...m].sort()); };

/** THE WINDOW STAND-IN: records the window the arm opens (its deps: `loot.items()` the cupboard's array, the arm's
 *  `stolenFrom`, its `onClose`), and moves pieces through it as the loot window's own click does. Closing it is the
 *  player's close: gone from the window stack first, then the window's own hooks. */
export function windowOf(p) {
  const w = { cur: null, opened: 0 };
  w.open = (deps) => { const win = { done: false, deps }; w.cur = win; w.opened++; p.open.add(win); p.guard(() => deps?.loot?.opened?.()); return win; };
  w.list = () => w.cur?.deps?.loot?.items?.() ?? null;
  w.take = (pick) => {
    const list = w.list();
    const it = list?.find(pick);
    assert.ok(it, `${p.id}'s window shows the piece to take`);
    const plan = planTake(it, { bag: p.entity.items, entity: p.entity, mode: 'remove' });
    assert.ok(plan.ok, `${p.id} may take it`);
    applyTransfer(it, plan, list, p.entity.items, { entity: p.entity, toPlayer: true, stolenFrom: w.cur.deps.loot.stolenFrom ?? null });
    return it;
  };
  /** A click on the row of the named piece. */
  w.takeNamed = (name) => w.take((it) => it.name === name);
  /** A take of part of a stack (the window's amount): `n` of the named piece. */
  w.takeAmount = (name, n) => {
    const list = w.list();
    const it = list?.find((x) => x.name === name);
    assert.ok(it, `${p.id}'s window shows the ${name} to take`);
    const plan = planTake(it, { bag: p.entity.items, entity: p.entity, mode: 'remove' });
    assert.ok(plan.ok, `${p.id} may take it`);
    applyTransfer(it, { ...plan, amount: n }, list, p.entity.items, { entity: p.entity, toPlayer: true, stolenFrom: w.cur.deps.loot.stolenFrom ?? null });
    return it;
  };
  w.put = (it) => {
    const list = w.list();
    const plan = planStore(it, { remote: list });
    assert.ok(plan.ok, `${p.id} may put ${it.name} in`);
    applyTransfer(it, plan, p.entity.items, list, { entity: p.entity, fromLocal: true, returnTo: w.cur.deps.loot.stolenFrom ?? null });
  };
  w.close = () => {
    const win = w.cur;
    w.cur = null;
    win.done = true;
    p.open.delete(win);
    p.guard(() => win.deps?.loot?.closed?.());
    p.as(() => p.guard(() => win.deps?.onClose?.()));
  };
  return w;
}

/** THE REAL WINDOW: the enhanced pack mounted over the hooks the host's arm opens (test/ui/lootbulk.test.js's mount), its
 *  buttons pressed as a player presses them. */
export function realWindowOf(p, dom) {
  const w = windowOf(p);
  w.open = (deps) => {
    const node = dom.mk('div');
    dom.body.append(node);
    const view = mountEnhancedInventory(node, { entity: p.entity, items: () => p.entity.items, wagonItems: () => (p.entity.wagonItems ??= []), onExit: () => {}, loot: deps.loot });
    const win = { done: false, deps, view, node };
    w.cur = win; w.opened++; p.open.add(win); p.guard(() => deps?.loot?.opened?.());
    return win;
  };
  w.press = (label) => { const b = [...w.cur.node.querySelectorAll('button')].find((x) => x.textContent === label); assert.ok(b, `the window has ${label}`); b.onclick(); };
  const close = w.close;
  w.close = () => { w.cur.view.unmount(); close(); };
  return w;
}
export const bulk = (fn) => { resetPrefs(); globalThis.location = { search: '?skin=enhanced' }; return withDom(fn); };

/** STASH ALL, through bulkMove's own operations (enhancedInventory.js `function bulkMove(dir)`, its 'stash' arm): the
 *  pack page top to bottom, each row the single click's plan (planStore), the container's cap (listAtCap), the walk
 *  (runBulk, bulkVerdict) and the transfer (applyTransfer, the owner's keeping as `returnTo`). The enhanced window does
 *  not OFFER the button over a stranger's cupboard - a loot session is take-only there (MAC-M2: the pack opens beside a
 *  loot target only for the player's own storage) - so the walk is driven over the window's own lists; the classic
 *  window puts into it two-way, a piece at a time (AC8 (b)). */
export function stashAll(p, w) {
  const from = p.entity.items, to = w.list();
  return runBulk([...from], (item) => {
    if (!from.includes(item)) return { verdict: 'skip' };
    if (listAtCap(to, item, CONTAINER_LIST_CAP)) return { verdict: 'stop', refusal: { text: 'full' } };
    const plan = planStore(item, { remote: to });
    return { verdict: bulkVerdict(item, plan), refusal: plan.refusal, plan };
  }, (item, d) => { applyTransfer(item, { ...d.plan, amount: d.plan.amount }, from, to, { entity: p.entity, fromLocal: true, toPlayer: false, returnTo: w.cur.deps.loot.stolenFrom ?? null }); });
}

// ═══ THE OPEN SHOP'S COUNTER (F-1, test/net/shelfloot.test.js) ═════════════════════════════════════════════════════════
/** An OPEN shop (insideOpenShop true): openShelf's other arm - the Buy counter, whose Steal rolls (DFU's DoSteal). */
export const SHOP_OPEN = Object.freeze({ ...SHOP, insideOpenShop: true });
/** The counter the host's arm mounted for `p` (the trade window the door built - ui/tradeDoor.js, whichever skin), or null. */
export const counterOf = (p) => p.counters.at(-1) ?? null;
/** The press on the shelf `i` of an OPEN shop, through the host's own openShelf: answers the counter it mounted, or null. */
export function openCounter(p, i = 0) {
  const n = p.counters.length;
  p.as(() => p.h.openShelf(i));
  return p.counters.length > n ? counterOf(p) : null;
}
/** The merchant's own Sell screen (worldModes.js openMerchantSell), over the building's first shelf: answers the counter. */
export function openSell(p) {
  const n = p.counters.length;
  p.as(() => p.h.openMerchantSell());
  return p.counters.length > n ? counterOf(p) : null;
}
/** Gold in the purse, for a counter that asks for a price. */
export const rich = (p, gold = 3000) => { p.entity.goldPieces = gold; return p; };
/** A click on the shelf's row of the named piece (NativeTradeWindow._pickRemote): staged in the basket. `n` of a stack: Control's
 *  how-many field (DISC25-F), answered. The window is the classic skin's - the one a node page builds. */
export function stage(p, win, name, n = null) {
  const at = win.remoteList().findIndex((it) => it.name === name);
  assert.ok(at >= 0, `${p.id}'s counter shows the ${name} to stage (${JSON.stringify(names(win.remoteList()))})`);
  p.as(() => {
    if (n != null) win.input('ControlLeft');
    win._pickRemote(at - win.remoteScroll);
    if (n != null) { assert.ok(win.inputBox, `${p.id}'s counter asked how many ${name}`); win.inputBox.value = String(n); win.input('Enter'); win.keyup('ControlLeft'); }
  });
  return win.basket;
}
/** A click on a PACK row of the Sell screen (the named piece staged on the counter), or on a BASKET row of the Buy counter (taken
 *  back). The local list is paged by tab: every tab is tried. */
export function stageLocal(p, win, name) {
  for (const tab of ['weapons', 'armor', 'clothing', 'magic', 'all', 'misc', win.tab]) {
    win.tab = tab;
    const at = win.localList().findIndex((it) => it.name === name);
    if (at >= 0) { p.as(() => win._pickLocal(at - win.localScroll)); return true; }
  }
  return assert.fail(`${p.id}'s counter lists a ${name} on none of its pages`);
}
/** The Steal button (DoSteal) - the roll set through the player's own dice, never the law replaced: 0.999 is a success (the
 *  chance is clamped to 95), 0 is a catch. */
export function steal(p, win, { caught = false } = {}) {
  const was = p.rand;
  p.rand = () => (caught ? 0 : 0.999);
  try { p.as(() => win._doSteal()); } finally { p.rand = was; }
}
/** The mode action and its Yes (the trade's confirm): the host's commitTrade concludes the deal. Answers the price paid. */
export function buy(p, win) {
  p.as(() => {
    win._modeAction();
    assert.ok(win.box?.buttons === 'YesNo', `${p.id}'s counter asks Yes or No (${JSON.stringify(win.box?.rows)})`);
    win._dismissBox(MB_BUTTONS.Yes);
  });
  return win.lastPrice;
}
/** Walk away from the counter the way the Escape key does (OnPop: the basket goes back to the shelf). */
export function closeCounter(p, win) { p.as(() => win._close()); }
/** `bulk`, awaited: the enhanced counter mounts from a lazy chunk (ui/enhanced/enhancedChunk.js), so a pin drives it across a few
 *  ticks of the event loop with the document still up. */
export async function bulkAsync(fn) {
  resetPrefs();
  globalThis.location = { search: '?skin=enhanced' };
  const dom = fakeDom();
  const saved = { doc: globalThis.document, had: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame, iw: globalThis.innerWidth, ih: globalThis.innerHeight };
  globalThis.document = dom.doc; globalThis.addEventListener = dom.win.addEventListener; globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0; globalThis.innerWidth = dom.w; globalThis.innerHeight = dom.h;
  try { return await fn(dom); } finally {
    if (saved.had) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.rem; globalThis.requestAnimationFrame = saved.raf;
    globalThis.innerWidth = saved.iw; globalThis.innerHeight = saved.ih;
  }
}

/** The building: A, the room's first (the seat - the relay's longest socket), B and C; A's first open stocks the cupboard
 *  on A's dice and says it, and everyone has heard it. */
export function building(n = 3, opts = {}) {
  const net = relay();
  const ps = ['aaaa-0001', 'bbbb-0002', 'cccc-0003', 'dddd-0004'].slice(0, n).map((id, i) => player(net, id, { seed: 11 + i * 17, ...(opts.each?.[i] ?? {}) }));
  return { net, A: ps[0], B: ps[1], C: ps[2] ?? null, D: ps[3] ?? null, ps };
}
export function stocked(n = 3, opts = {}) {
  const s = building(n, opts);
  const wa = windowOf(s.A);
  assert.ok(pressYes(s.A, wa), 'A\'s press opened the cupboard');
  const stock = items(s.A).map((it) => ({ ...it }));
  assert.ok(stock.length >= 2, `A's first open stocked it on A's dice (${JSON.stringify(names(stock))})`);
  wa.close(); frame(s.A); s.net.flush();
  for (const p of s.ps) assert.deepEqual(names(items(p)), names(stock), `${p.id} holds the room's one list (guard)`);
  return { ...s, stock };
}
/** A memory, as the seat publishes it, restored by a player walking in later (world.js worldPublish -> the relay's room
 *  memory -> restorePlaceSharedWorld). */
export function joiner(s, id, opts = {}) {
  const seat = s.ps.find((p) => p.id === s.net.seat()) ?? s.A;
  const memory = seat.as(() => seat.h.members.placeSharedWorld());
  const D = player(s.net, id, { seed: 97, ...opts });
  D.as(() => D.h.members.restorePlaceSharedWorld(clone(memory)));
  s.ps.push(D);
  return D;
}

/** A building with chosen first-open stocks (the producer's stand-in): A, B, C (and D) with a roll each - `rolls[i]` a list of
 *  pieces, a function answering one, or null (their own dice) - and nothing opened yet. Every ask for a roll hands out fresh
 *  records. */
export function rolled(n = 3, rolls = [], opts = {}) {
  const roll = (i) => { const r = rolls[i]; return typeof r === 'function' ? r : (Array.isArray(r) ? () => r : null); };
  return building(n, { ...opts, each: Array.from({ length: n }, (_, i) => ({ roll: roll(i), ...(opts.each?.[i] ?? {}) })) });
}
/** A first open: the press, the Yes, the window - and the window's list as the player sees it. */
export function firstOpen(p, opts = {}) {
  const w = windowOf(p);
  assert.ok(pressYes(p, w, 'Yes', opts), `${p.id}'s press opened the cupboard`);
  return w;
}
/** Time passes: `ms` of the local clock in `step`s, every present client's frame run each step (not those in `skip`), the
 *  relay flushed after each. Windows stay as they are - the test closes them. */
export function elapse(s, ms, { step = 250, skip = [] } = {}) {
  const skipped = new Set(skip.map(idOf));
  for (let t = 0; t < ms; t += step) {
    clock.t += step;
    for (const p of s.ps) if (p.kind === 'client' && p.here && !s.net.dead.has(p.id) && !skipped.has(p.id)) frame(p);
    s.net.flush();
  }
}
/** Everything quiet: every timeout passed (the claims' lapse, the re-says, the resend backoff's longest wait). */
export const quiesce = (s, opts = {}) => elapse(s, 40_000, opts);

/** The `l` records of an act frame as the frame says them. */
export const recordsOf = (e) => (Array.isArray(e?.data?.l) ? e.data.l : []);

// ═══ AN OLDER BUILD: the whole-list law of 02706035cf, frozen ════════════════════════════════════════════════════════
// A player on the build before this fix says WORLD6a's word - `{ k, r, d }`, the container's whole list and the day it was
// stocked - and lands every word it hears over its own list, except on the container it has open. These are that build's
// interiorShared.js applyInteriorLoot, interiorLootRecords and withoutCarried VERBATIM (the doors, the vocabulary and the cap
// are unchanged by the fix for a shelf), so the fix is held to the mixed building the relay makes of two builds.
const OLD_KEY_RE = /^(shelf|container):(0|[1-9][0-9]{0,4})$/;
function oldKeyOf(key) { if (typeof key !== 'string') return null; const m = OLD_KEY_RE.exec(key); return m ? `${m[1]}:${Number(m[2])}` : null; }
function oldTarget(ctx, key) {
  const canon = oldKeyOf(key);
  if (!canon || !ctx) return null;
  const [kind, iStr] = canon.split(':');
  const list = kind === 'shelf' ? ctx.shelves : ctx.containers;
  return (Array.isArray(list) && list[Number(iStr)]) || null;
}
function oldWithoutCarried(list, carried = null, { stowed = false } = {}) {
  if (typeof carried?.keyOf !== 'function') return list;
  const keys = new Set([...(carried.keys ?? []), ...(stowed ? carried.stowed ?? [] : [])]);
  return list.filter((it) => {
    const k = carried.keyOf(it);
    if (!k) return true;
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
}
/** The older build's applyInteriorLoot (verbatim, less its comments). */
export function olderApplyInteriorLoot(ctx, list, { seen = new Set(), openKey = null, today = null, unreadable = null, carried = null } = {}) {
  let n = 0;
  for (const rec of Array.isArray(list) ? list : []) {
    const canon = oldKeyOf(rec?.k);
    if (!canon) continue;
    if (!Number.isFinite(rec.d) || rec.d < 0 || (today != null && rec.d > today + 1)) continue;
    const its = peerHanded(validLootList(rec.r));
    if (!its) { if (unreadable && oldTarget(ctx, canon)) { seen.add(canon); unreadable.add(canon); } continue; }
    const t = oldTarget(ctx, canon);
    if (!t) continue;
    for (const it of its) clearStolen(it);
    seen.add(canon);
    unreadable?.delete(canon);
    if (canon === openKey) { n++; continue; }
    const lands = oldWithoutCarried(its, carried, { stowed: canon.startsWith('shelf:') });
    if (Array.isArray(t.items)) { t.items.length = 0; for (const it of lands) t.items.push(it); } else t.items = lands;
    t.stockedDate = Math.max(Number.isFinite(t.stockedDate) ? t.stockedDate : 0, Math.floor(rec.d));
    n++;
  }
  return n;
}
/** The older build's interiorLootRecords (verbatim): whole lists. */
export function olderLootRecords(ctx, keys, tooBig = new Set()) {
  const out = [];
  for (const key of keys ?? []) {
    const canon = oldKeyOf(key);
    const t = canon && oldTarget(ctx, canon);
    if (!t || !Array.isArray(t.items)) continue;
    if (t.items.length > LOOT_LIST_MAX) { tooBig.add(canon); continue; }
    tooBig.delete(canon);
    out.push({ k: canon, r: peerHanded(t.items).map((it) => clearStolen({ ...it })), d: Number.isFinite(t.stockedDate) ? t.stockedDate : 0 });
  }
  return out;
}
/** A player on the older build: no module, WORLD6a's whole-list law. `say()` is its open or its close (the list it holds,
 *  whole); it lands what it hears the way the older build does. `key` (F-1): the container it plays - the cupboard (default) or
 *  a shop's shelf (`shelf:0`), which that build said and landed by the very same whole-list word. */
export function older(net, id, { list = null, key = KEY } = {}) {
  const onShelf = key.startsWith('shelf:');
  const ctx = { containers: [cupboard()], shelves: onShelf ? [cupboard()] : [], actions: null };
  const slot = onShelf ? ctx.shelves : ctx.containers;
  if (list) { slot[0].items = list.map(clone); slot[0].stockedDate = TODAY; }
  const bag = { seen: new Set(), unreadable: new Set(), tooBig: new Set(), openKey: null, applied: false, stamp: `older-${id.slice(0, 8)}` };
  const o = {
    id, kind: 'older', here: true, ctx, bag, said: [], entity: { items: [] }, key,
    recv(from, data) { if (data?.k === ROOM && Array.isArray(data.l)) olderApplyInteriorLoot(ctx, data.l, { seen: bag.seen, openKey: bag.openKey, today: TODAY, unreadable: bag.unreadable }); },
    /** The older build's open or close: the container's whole list, said. */
    say() { bag.seen.add(key); return net.accept(id, { k: ROOM, l: olderLootRecords(ctx, [key], bag.tooBig) }); },
    /** Its word as it would say it now, without saying it. */
    word() { return olderLootRecords(ctx, [key], bag.tooBig)[0] ?? null; },
    /** The memory it publishes as the room's seat. */
    memory() { return { locationKey: ROOM, stamp: bag.stamp, world: { loot: olderLootRecords(ctx, [...bag.seen], bag.tooBig), actions: [] } }; },
    open() { bag.openKey = key; },
    close() { bag.openKey = null; },
    /** The container's list as this build holds it. */
    items: () => slot[0].items,
    take(name) { const l = slot[0].items; const at = l.findIndex((it) => it.name === name); assert.ok(at >= 0, `${id} holds ${name} to take`); return l.splice(at, 1)[0]; },
    put(it) { slot[0].items.push(it); },
  };
  net.join(o);
  return o;
}

// ═══ PIECES a pin can hand a roll ═══════════════════════════════════════════════════════════════════════════════════════
/** `n` DISTINCT light pieces (distinct templates, no two stack), each as a store mints it and the item law reads it: what a
 *  Take all of more than 32 rows needs to be every row a row of its own. */
export function lightPieces(n) {
  const out = [];
  for (const g of ['Gems', 'Jewellery', 'Drugs', 'UselessItems1', 'UselessItems2', 'ReligiousItems', 'MensClothing', 'WomensClothing']) {
    for (const idx of GROUP_TEMPLATE_INDICES[g] ?? []) {
      if (out.length >= n) return out;
      const t = ITEM_TEMPLATES.find((x) => x.index === idx);
      if (!t || (t.baseWeight ?? 1) > 0.5) continue;
      const it = clone(mintCondition(setItemFields({ group: g, templateIndex: idx })));
      const ok = validLootList([clone(it)]);
      if (ok?.length === 1 && !out.some((o) => o.templateIndex === idx)) out.push(it);
    }
  }
  assert.ok(out.length >= n, `${n} distinct light pieces exist (${out.length})`);
  return out;
}
