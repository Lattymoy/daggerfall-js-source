// OUTDOOR-LOOT (2026-10-17): THE SHARED HARNESS of test/net/bodyloot.test.js (phase 1: what a party member's press on
// ANOTHER player's foe's body must do, through the doors the code has today) and test/net/bodyloot_protocol.test.js
// (slice 1: the body protocol the fix adds - the digest, the peek, the claim, the verdict - and the mixed builds, pinned
// BLACK-BOX: through the frames the relay stand-in captures and through the pools' existing doors, never a module that
// does not exist yet). Not a .test.js on purpose: the manifest counts suites, and this is a precondition, not one.
//
// MOUNTED, NOT MATCHED. Each player here is a real pool (createExteriorFoes over a crafted MONSTER.BSA - the street's as
// test/net/world6biiic.test.js stands it; a building's as worldModes.js wires it, its functions and members sliced out of
// the host), behind the REAL hit queue (net/hitPend.js makeHitPend - LOOT-DUP's), on a controllable clock, joined by a
// relay stand-in that carries the two lanes a pool speaks - its foes frames (foesFrame -> applyFoes) and its hits
// (onPeerHit -> applyHit, routed by `to`) - each direction with its own lateness, held by the test or lost on a dead link,
// a player able to leave the cell, drop off the socket or sit half-open. The plaque is the real resolveHover over the
// pool's own namer and contents doors (world.js's ladder); the press is the pool's own takeLoot (a building's:
// worldModes.js openInteriorBodyLoot) handed a WINDOW STAND-IN: it records any window the press opens and moves pieces
// through the window's own law - itemTransfer.js planTake/planStore + applyTransfer for a row, storeBulk.js runBulk +
// bulkVerdict for Take all (enhancedInventory.js bulkMove's walk), quickLoot.js quickLootTake for the quick door.
//
// What a test reads is where the pieces ARE once every timeout has passed (the owner's body, the owner's pack or a taker's
// pack, each piece in exactly one of them), and the frames that crossed the relay (`net.log`).
import '../modsOff.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { makeHitPend } from '../../src/net/hitPend.js';
import { FOES_MS, FOES_FULL_MS, FOES_STALE_MS } from '../../src/net/online.js';
import { generateItems } from '../../src/systems/loot/loot.js';
import { resolveHover, composeNamer, composeContents } from '../../src/systems/worldHover.js';
import { planTake, planStore, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { quickLootTake } from '../../src/systems/quickLoot.js';
import { isGoldPieces, addGoldPieces } from '../../src/systems/inventory.js';
import { filterStore } from '../../src/ui/storeFilter.js';
import { runBulk, bulkVerdict } from '../../src/ui/storeBulk.js';
import { lootPile } from '../../src/player/lootStack.js';
import { isActionDoorObject } from '../../src/world/actionSystem.js';
import { movedOutOf } from '../hostText.mjs';

export { FOES_MS, FOES_FULL_MS, FOES_STALE_MS };

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
export const settle = () => new Promise((r) => setTimeout(r, 0));
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
export const clone = (v) => JSON.parse(JSON.stringify(v));
export const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const collider = () => ({ raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } });
export const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

/** The body the owner's foe falls with: the loot table's own roll (loot.js generateItems, table F) - a purse of coin, a
 *  blade and a piece of armour, three pieces a plain foe's cap keeps (FOE-CAP). Places 0, 1, 2 of the body, in this order. */
export const PILE = () => generateItems('F', { level: 10, gender: 'male' }, lcg(2)).map((it) => ({ ...it }));
/** What a piece IS, whatever its count or its holder (a rarity roll at the death renames, never re-templates). */
export const pieceOf = (it) => `${it.group}:${it.templateIndex}`;
export const nameOf = (body, piece) => body.find((it) => pieceOf(it) === piece)?.name ?? piece;
export const GREAVES = 'Armor:104', SHORTSWORD = 'Weapons:116', GOLD = 'Currency:276';
/** The body a RELOADED owner's foe falls with (SLICE 1 REVIEW, S1-2): the same table's other roll - the same purse of coin at
 *  place 0, a broadsword and a pine branch where the first body held a shortsword and a greaves. Three places again, so the two
 *  bodies are told apart by their pieces alone. */
export const PILE2 = () => generateItems('F', { level: 10, gender: 'male' }, lcg(8)).map((it) => ({ ...it }));
export const BROADSWORD = 'Weapons:118', PINE = 'PlantIngredients1:14';

// ═══ THE CELL: a clock, a relay stand-in and the players ═══════════════════════════════════════════════════════════
export const clock = { t: 1_000_000 };
/** THE RELAY, as far as a pool's two lanes go: a hit is routed to its `to` (the relay reads no further - WORLD6b-iii(c)),
 *  each direction `from>to` as late as the test says; a foes frame goes to everyone else in the cell. The sender's door
 *  is the session's `sendHit`: false while its wire is shut, and false for a `to` not in its roster
 *  (net/online.js `sendHit`: "the owner must be a peer I KNOW"), so the frame waits in the sender's hit queue. A player
 *  away from the cell or off its socket sends nothing and hears nothing - a frame already on the wire to one is lost, as
 *  the relay loses a frame with no target.
 *
 *  What the stand-in adds for the body protocol's pins: `log` - every hit the relay ACCEPTED, as its sender said it
 *  (`{ from, to, data, at }`, the owner's verdicts and a taker's claims among them); `held` - a direction `from>to` whose
 *  frames wait in the relay until the test releases them; `dead` - a player whose socket is HALF-OPEN (R-2: a Wi-Fi drop
 *  until the relay's dead-socket detection fires): still in every roster, so a frame to it is ACCEPTED and lost, and it
 *  sends and hears nothing; `tamper(from, to, data)` - the frame as it travels (null: lost in transit; the log keeps what
 *  the sender said); `foesFilter(from, frame)` - the foes frame as its readers hear it (an OLDER owner's is the real
 *  owner's with `bw` stripped); `unseen` (SLICE 1 REVIEW, S1-1) - a player the others' pools do NOT read in their pose list
 *  (`peers()`: a cell crossed, a stale pose, a deck below) while the roster still holds it: a frame to it is still ACCEPTED
 *  (net/online.js `sendHit` tests the roster, `this.peers.has(owner)`) and a frame from it still arrives. */
export function relay() {
  const players = new Map();
  const q = [];
  const late = new Map();
  const shut = new Set();   // a sender whose wire refuses for now (the rate gate, a socket mid-reconnect): its hit queue holds
  const held = new Set();
  const dead = new Set();
  const unseen = new Set();   // in the roster, out of the pose list
  const log = [];
  const foesLog = [];
  const events = [];   // [at, fn] - what happens to the cell at a time (a socket back)
  return {
    players, late, shut, held, dead, unseen, log, foesLog, tamper: null, foesFilter: null,
    at(t, fn) { events.push([t, fn]); },
    due() { for (let i = 0; i < events.length;) { if (events[i][0] <= clock.t) events.splice(i, 1)[0][1](); else i++; } },
    join(p) { players.set(p.id, p); },
    hold(dir) { held.add(dir); },
    release(dir) { held.delete(dir); },
    here: (id) => players.get(id)?.here === true,
    /** Whether `to` is in `from`'s roster: both in the cell (a player across a seam is reported through its halo). */
    reaches(from, to) { return this.here(to) && players.get(to).id !== from; },
    peersOf(id) { return [...players.values()].filter((p) => p.id !== id && p.here && !unseen.has(p.id)).map((p) => ({ id: p.id, feet: [...p.feet], height: 1.8 })); },
    sendHit(from, data) {
      if (!this.here(from) || shut.has(from) || dead.has(from) || !data || typeof data.to !== 'string' || !this.reaches(from, data.to)) return false;
      log.push({ from, to: data.to, data: clone(data), at: clock.t });
      const wire = this.tamper ? this.tamper(from, data.to, clone(data)) : clone(data);
      if (wire) q.push({ from, to: data.to, data: wire, at: clock.t + (late.get(`${from}>${data.to}`) ?? 0) });
      return true;
    },
    sendFoes(from, frame) {
      if (dead.has(from)) return;
      foesLog.push({ from, frame: clone(frame), at: clock.t });
      for (const p of players.values()) {
        if (p.id === from || !p.here || dead.has(p.id)) continue;
        const f = this.foesFilter ? this.foesFilter(from, clone(frame)) : clone(frame);
        if (f) p.foes(from, f);
      }
    },
    deliver() {
      for (let i = 0; i < q.length;) {
        const e = q[i];
        if (e.at > clock.t || held.has(`${e.from}>${e.to}`)) { i++; continue; }
        q.splice(i, 1);
        if (this.here(e.to) && !dead.has(e.to)) players.get(e.to).hit(e.from, e.data);
      }
    },
  };
}
/** One player's frame, as world.js runs it: the pool's update, the hit queue flushed, the foes stream (FOES_MS, every
 *  one FOES_FULL_MS apart - world.js foesStream / ownStream), and the owners gone from the cell pruned (an answer only
 *  while the socket is open - AUDIT WORLD6b-iii(b) C3/B5: no answer is not "nobody"). */
export function tickPlayer(net, p, ms) {
  if (p.ghost) return;   // an older build with no pool: it only hears, and says what the test hands it
  p.pool().update(ms / 1000, p.feet, [p.feet[0], 1.6, p.feet[2]], senses(p.entity));
  p.pend.flush(clock.t);
  if (!p.here) return;
  if (clock.t - p.sentAt >= FOES_MS) {
    p.sentAt = clock.t;
    const full = clock.t - p.fullAt >= FOES_FULL_MS;
    const frame = p.frame(full);
    if (frame) { if (full) p.fullAt = clock.t; net.sendFoes(p.id, frame); }
  }
  p.prune(new Set([...net.players.values()].filter((o) => o !== p && o.here).map((o) => o.id)));
}
/** Time passing for the whole cell, 50 ms a frame; every window still standing is offered its click again each frame
 *  (a window the press opens empty and fills when the owner's word comes is clicked when the piece is in it). */
export function run(net, ms, windows = []) {
  const end = clock.t + ms;
  while (clock.t < end) {
    clock.t += 50;
    net.due();
    for (const p of net.players.values()) tickPlayer(net, p, 50);
    net.deliver();
    for (const w of windows) w.click();
  }
}

/** `run`, with the event loop let in between: the pools' builds are async (a puppet's stand, a body's texture), and a
 *  page lives while its clock runs. For a long outage a puppet is swept and stood again - the sync loop would starve it. */
export async function runLive(net, ms, windows = []) {
  const end = clock.t + ms;
  while (clock.t < end) { run(net, Math.min(500, end - clock.t), windows); await settle(); }
}

const poolFor = (entity, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() }, collider: collider(),
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: entity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const ROOM_STREET = 'world:3,12';
/** A street player: the encounter pool world.js mounts outdoors, its net as world.js's `exteriorFoes.setNet` builds it
 *  (the hit through the pending queue with its own fate - LOOT-DUP), the press the pool's own door. */
export function streetPlayer(net, id, feet) {
  const entity = playerEntity(), said = [];
  const pool = poolFor(entity, said);
  const p = { id, entity, said, feet, here: true, room: ROOM_STREET, halo: new Set(), sentAt: -Infinity, fullAt: -Infinity, pool: () => pool };
  p.pend = makeHitPend({ send: (h) => net.sendHit(id, h), room: () => p.room, now: () => clock.t, warn: () => {} });
  pool.setNet({ room: () => p.room, inRoom: (k) => p.halo.has(k), selfId: () => id, peers: () => net.peersOf(id), now: () => clock.t, staleMs: FOES_STALE_MS, onPeerHit: (h, fate) => p.pend.send(h, fate), toWire: (f) => [f[0], f[1], f[2]], toScene: (q) => [q[0], q[1], q[2]] });
  Object.assign(p, {
    hit: (from, data) => pool.applyHit(from, data),   // world.js online.onHit, a cell's arm
    foes: (from, data) => pool.applyFoes(from, data),
    frame: (full) => pool.foesFrame(full),
    prune: (ids) => pool.pruneOwners(ids, clock.t),
    clear: () => pool.clearPuppets(),   // world.js: a room change that is no seam
    /** The press on a body: the pool's own door, `takeLoot(key, say, openWindow)`, the window the stand-in's - behind the
     *  host's quick door (world.js openBodyLoot: `quickLootTake` before the window, null with the switch off). */
    press: (key, win) => pool.takeLoot(key, (l) => said.push(l), (hooks) => (quickLootTake(key, hooks, entity, (l) => said.push(l)) ? true : win.open(hooks))),
    names: (key) => pool.hoverName?.(key) ?? null,
    holds: (key) => pool.hoverContents?.(key) ?? null,
  });
  net.join(p);
  return p;
}

// ═══ A BUILDING: the interior pool as worldModes.js wires it, sliced out of the host ════════════════════════════════
/** The host and every module moved out of it (HOST-SPLIT), each parsed once. */
const WM = ['src/scenes/worldModes.js', ...movedOutOf('src/scenes/worldModes.js')].map((p) => { const src = rd(p); return { p, src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }; });
function findIn(ast, pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  return hit;
}
function wmNode(pred, what) {
  for (const f of WM) { const n = findIn(f.ast, pred); if (n) return { f, n }; }
  return assert.fail(`worldModes.js (or a module moved out of it) carries ${what} - the building's body doors this file mounts`);
}
const wmFn = (name) => { const { f, n } = wmNode((x) => x.type === 'FunctionDeclaration' && x.id?.name === name, `function ${name}`); return f.src.slice(n.start, n.end); };
const wmDecl = (name) => { const { f, n } = wmNode((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name), `the declaration of ${name}`); return f.src.slice(n.start, n.end); };
const wmMember = (name) => {
  const { f, n } = wmNode((x) => x.type === 'Property' && !x.computed && x.key?.name === name && (x.value.type === 'FunctionExpression' || x.value.type === 'ArrowFunctionExpression'), `the member ${name}`);
  const body = f.src.slice(n.value.start, n.value.end);
  return n.method ? `function ${body}` : body;
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
/** The building's body doors, in the host's own words: the pool's mint (`makeInteriorFoes`), its net (`ensureInteriorNet`
 *  over world.js's `interiorFoesNet` - the own lane, OWN1, a hit marked `own`), the press (`openInteriorBodyLoot`, whose
 *  window is the stand-in's), and the members world.js calls on the own lane. */
const BUILDING = () => `
  ${wmFn('makeInteriorFoes')}
  ${wmDecl('_intNetOn')}
  ${wmFn('ensureInteriorNet')}
  ${wmFn('openInteriorBodyLoot')}
  const members = { ownFoesFrame: ${wmMember('ownFoesFrame')}, applyOwnFoes: ${wmMember('applyOwnFoes')}, applyOwnHit: ${wmMember('applyOwnHit')}, pruneOwnOwners: ${wmMember('pruneOwnOwners')}, clearOwnPuppets: ${wmMember('clearOwnPuppets')} };
  interiorFoes = makeInteriorFoes(interiorCtx);   // the building's mount: worldModes.js "interiorFoes = makeInteriorFoes(ctx);"
  _intNetOn = false; ensureInteriorNet();
  return { members, press: openInteriorBodyLoot, pool: () => interiorFoes };
`;
export const ROOM_BUILDING = 'interior:m1.7';   // worldModes.js interiorLocationKey's spelling (map 1, building 7)
export function buildingPlayer(net, id, feet) {
  const entity = playerEntity(), said = [];
  const p = { id, entity, said, feet, here: true, room: ROOM_BUILDING, sentAt: -Infinity, fullAt: -Infinity, window: null };
  p.pend = makeHitPend({ send: (h) => net.sendHit(id, h), room: () => p.room, now: () => clock.t, warn: () => {} });
  const state = {
    mode: 'interior', interiorFoes: null, interiorGuards: null, dungeonCtx: null,
    interiorCtx: { collider: collider(), actions: { objects: new Map() } }, interiorNav: null,
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
    playerEntity: entity, audio: null, isActionDoorObject, interiorHitEffects: null, interiorDropped: { dropPile: () => {} }, interiorWeapon: { playerWeapon: { sheathed: false } },
    interiorTicker: { ownMinutes: 0, sinks: null }, spellsByIndex: () => null, magic: null, player: { pos: feet, height: 1.8 },
    say: (l) => said.push(l), quickLootTake, showPickups: null, questBridge: null, lootPile, mountInterior: () => {},
    interiorInventory: (deps) => (p.window?.open(deps?.loot, deps) ? { done: false } : null),   // the window the press opens - the stand-in's
    host: {
      // world.js `interiorFoesNet`: the building's own lane - my foes out, a peer's in, a blow (or a take) on a peer's foe
      // to its owner marked `own` (OWN1)
      interiorFoesNet: () => ({ room: () => p.room, inRoom: () => false, selfId: () => id, peers: () => net.peersOf(id), now: () => clock.t, staleMs: FOES_STALE_MS, onPeerHit: (hit, fate) => p.pend.send({ ...hit, own: 1 }, fate), toWire: (f) => [f[0], f[1], f[2]], toScene: (q) => [q[0], q[1], q[2]] }),
      foesQuestShare: () => null,
    },
    createExteriorFoes,
  };
  const h = mount(BUILDING(), state);
  Object.assign(p, {
    pool: h.pool,
    hit: (from, data) => (data?.own === 1 ? h.members.applyOwnHit(from, data) : false),   // world.js online.onHit: `data?.own === 1` -> modes.applyOwnHit
    foes: (from, data) => h.members.applyOwnFoes(from, data),   // world.js online.onOwnFoes
    frame: (full) => h.members.ownFoesFrame(full),   // world.js ownStream
    prune: (ids) => h.members.pruneOwnOwners(ids, clock.t, FOES_STALE_MS),
    clear: () => h.members.clearOwnPuppets(),
    /** The press on a body: the host's own door, openInteriorBodyLoot (the quick door first, then the window), whose
     *  window is the stand-in's. */
    press: (key, win) => { p.window = win; return h.press(key); },
    names: (key) => h.pool()?.hoverName?.(key) ?? null,   // worldModes.js: "(key) => interiorFoes?.hoverName?.(key) ?? null"
    holds: (key) => h.pool()?.hoverContents?.(key) ?? null,   // worldModes.js: "(key) => interiorFoes?.hoverContents?.(key) ?? null"
  });
  net.join(p);
  return p;
}
/** The building pool rolls on Math.random (its mint hands no dice): seeded for the length of each test that stands a
 *  scene, so a run is one run. */
const REAL_RANDOM = Math.random;
export const restoreRandom = () => { Math.random = REAL_RANDOM; };

/** AN OLDER BUILD: a peer in the roster with no pool - it hears the owner's hits and lands what its build lands (a
 *  grant: the coin to its counter, the rest to its pack), and says what the test hands it (`send`), as an older client's
 *  `take: 1` and `back: 1` read. Its foes stream says nothing. */
export function ghostPlayer(net, id, feet, room) {
  const entity = { items: [], goldPieces: 0 }, got = [];
  const p = {
    id, ghost: true, entity, said: [], feet, here: true, room, halo: new Set(), got,
    hit: (from, data) => {
      got.push({ from, data: clone(data) });
      if (Array.isArray(data?.grant)) for (const rec of data.grant) { if (isGoldPieces(rec)) addGoldPieces(entity, rec.stackCount ?? 1); else entity.items.push({ ...rec }); }
      return true;
    },
    foes: () => {},
    send: (data) => net.sendHit(id, data),
  };
  net.join(p);
  return p;
}

/** AN OFFLINE OWNER (T19): the encounter pool with NO net - the bench, the single-player game - whose foe falls with the
 *  PILE; the owner stands at the body. `tick()` is the pool's frame. */
export async function offlineOwner() {
  const entity = playerEntity(), said = [];
  const pool = poolFor(entity, said);
  const feet = [30, 0, 30];
  Math.random = lcg(7);
  const rat = await pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.ok(rat, 'the offline owner\'s foe stands');
  const tick = () => pool.update(0.05, feet, [feet[0], 1.6, feet[2]], senses(entity));
  tick();
  rat.entity.items = PILE();
  pool.damageFoe(rat, 9999, [12, 0, 11]);
  for (let i = 0; i < 40 && !(rat.corpse && rat.corpseMarker); i++) { await settle(); clock.t += 200; tick(); }
  assert.ok(rat.corpse && rat.corpseMarker, 'the foe fell and its body lies');
  const at = rat.corpseMarker.pos;
  feet[0] = at[0]; feet[1] = at[1]; feet[2] = at[2] + 0.5;
  const key = `foeCorpse:${rat.uid}`;
  return {
    pool, entity, said, rat, key, tick,
    names: (k) => pool.hoverName?.(k) ?? null,
    holds: (k) => pool.hoverContents?.(k) ?? null,
    /** The press: the pool's own door behind the host's quick door (world.js openBodyLoot), the window the stand-in's. */
    press: (win) => pool.takeLoot(key, (l) => said.push(l), (hooks) => (quickLootTake(key, hooks, entity, (l) => said.push(l)) ? true : win.open(hooks))),
  };
}

// ═══ THE SCENE: Bob's foe falls, his party members stand over its body ═════════════════════════════════════════════
/** Bob (the owner) and the takers: Bob's foe stands - the takers see it alive first, as a party member in the field
 *  does - and falls with the PILE; every taker's puppet of it says so. Each taker stands at the body.
 *
 *  Options (the phase-1 pins pass none): `extra` pieces on the body; `ghosts` - older builds standing at the body;
 *  `stripBw` - Bob is an OLDER OWNER (his foes frames reach the takers without the takes digest `bw`); `hold` - directions
 *  `from>to` whose hits wait in the relay from the start (a peek answer not yet heard); `late` - `{ 'from>to': ms }`;
 *  `tamper` - the relay's in-transit rewrite of a hit. */
export async function scene(where, takers = ['mac-0001'], { extra = [], ghosts = [], stripBw = false, hold = [], late = {}, tamper = null } = {}) {
  const net = relay();
  if (stripBw) net.foesFilter = (from, frame) => { delete frame.bw; return frame; };
  for (const [dir, ms] of Object.entries(late)) net.late.set(dir, ms);
  for (const dir of hold) net.hold(dir);
  net.tamper = tamper;
  const mk = where === 'building' ? buildingPlayer : streetPlayer;
  const bob = mk(net, 'bob-0002', [30, 0, 30]);
  const them = takers.map((id, i) => mk(net, id, [11 + i, 0, 11]));
  Math.random = lcg(7);
  {
    const rat = await bob.pool().spawnFoe(0, [12, 0, 12], { feetGiven: true });
    assert.ok(rat, 'the owner\'s foe stands');
    run(net, 400);
    for (let i = 0; i < 40 && !them.every((t) => t.pool().foes.some((x) => x.puppet === bob.id)); i++) { await settle(); run(net, 50); }
    const pile = () => [...PILE(), ...extra.map((it) => ({ ...it }))];
    rat.entity.items = pile();
    if (extra.length) delete rat.entity.lootCap;   // FOE-CAP: a body carrying more than a plain foe's three (a revenant's, a boss's)
    bob.pool().damageFoe(rat, 9999, [12, 0, 11]);
    // the death chain rolls on the dice (a collector's card, a rarity, FOE-CAP trimming a piece for it - the building pool rolls
    // on Math.random, whose order of use the event loop moves): the body is the pile this test names, whatever they rolled
    rat.entity.items = pile();
    for (let i = 0; i < 40 && !them.every((t) => t.pool().foes.some((x) => x.puppet === bob.id && x.corpse && (x._pup?.o | 0) > 0)); i++) { await settle(); run(net, 200); }
    run(net, FOES_FULL_MS + 400);
    const at = rat.corpseMarker?.pos ?? rat.ai.feet;
    them.forEach((t, i) => { t.feet[0] = at[0] + 0.5 * i; t.feet[1] = at[1]; t.feet[2] = at[2] + 0.5; });   // at the body, inside its reach
    const roomKey = where === 'building' ? ROOM_BUILDING : ROOM_STREET;
    const olds = ghosts.map((id, i) => ghostPlayer(net, id, [at[0] + 0.5 * (them.length + i), at[1], at[2] + 0.5], roomKey));
    const keyOf = (t) => { const pup = t.pool().foes.find((x) => x.puppet === bob.id && x.corpse); return pup ? `foeCorpse:${pup.uid}` : null; };
    for (const t of them) assert.ok(keyOf(t), `${t.id} stands Bob's foe's body`);
    const body = rat.entity.items.map((it) => ({ ...it }));
    assert.equal(body.length, 3 + extra.length, 'the body holds the pieces it fell with');
    const before = new Map([bob, ...them, ...olds].map((p) => [p.id, { items: p.entity.items.map(pieceOf), gold: p.entity.goldPieces | 0 }]));
    /** A hit frame a build would hand Bob about this body: the cell's key, the body's number, and the building's own lane. */
    const frame = (to, fields) => ({ to, k: roomKey, i: rat.seq, ...(where === 'building' ? { own: 1 } : {}), ...fields });
    return { where, net, bob, them, mac: them[0], eve: them[1] ?? null, ghosts: olds, old: olds[0] ?? null, rat, body, keyOf, before, roomKey, frame };
  }
}

/** THE OWNER'S PAGE RELOADS (SLICE 1 REVIEW, S1-2): the SAME peer id (net/online.js `peerId` keeps it in sessionStorage - "survives a
 *  reload of that tab") under a NEW pool, whose seq, frame counter and generation counter all start over; the old body went with
 *  the old page. The relay's roster never loses him - the new hello replaces the old socket, no leave in between - so the readers
 *  keep what they hold of him: his record (applyFoes refuses a frame no newer than the last it took, `data.n <= o.n`), his puppet
 *  and the state of his body.
 *
 *  The new pool stands a foe of its own (seq 1 again) and strikes it, short of death, until its frame counter reaches the last one
 *  the readers took - a quick fight - so that the first frame a reader takes is the DEAD body's: a body that dies and streams. The
 *  foe then falls with `pile`. Answers the scene as it stands: `s` with the new owner, his foe, its body, what every pack held
 *  (so `census` and `misplaced` read the new body) and `since` - where the relay's foes log stood at the reload. */
export async function reloadOwner(s, pile) {
  const { net } = s;
  const lastN = net.foesLog.filter((e) => e.from === s.bob.id).reduce((n, e) => Math.max(n, e.frame.n), 0);
  const mark = net.foesLog.length;
  const bob = (s.where === 'building' ? buildingPlayer : streetPlayer)(net, s.bob.id, [...s.bob.feet]);
  const rat = await bob.pool().spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.ok(rat, 'the reloaded owner\'s foe stands');
  const framesSent = () => net.foesLog.slice(mark).filter((e) => e.from === bob.id).length;
  run(net, 100);
  for (let i = 0; i < 8 && framesSent() < lastN; i++) { bob.pool().damageFoe(rat, 1, [12, 0, 11]); run(net, 250); await settle(); }
  assert.equal(rat.dead, false, 'the reloaded owner\'s foe is still alive while the readers refuse its frames (guard)');
  rat.entity.items = pile();
  bob.pool().damageFoe(rat, 9999, [12, 0, 11]);
  rat.entity.items = pile();   // the death chain rolls on the dice: the body is the pile this test names (as scene() does)
  assert.ok(rat.corpse, 'the reloaded owner\'s foe fell and lies a body');
  run(net, 400);
  await settle();
  const before = new Map([bob, ...s.them, ...s.ghosts].map((p) => [p.id, { items: p.entity.items.map(pieceOf), gold: p.entity.goldPieces | 0 }]));
  return {
    ...s, bob, rat, body: rat.entity.items.map((it) => ({ ...it })), before, since: mark,
    frame: (to, fields) => ({ to, k: s.roomKey, i: rat.seq, ...(s.where === 'building' ? { own: 1 } : {}), ...fields }),
  };
}

/** THE WINDOW STAND-IN (phase 1): records what the press opens, takes ONE piece `choose` picks from it - once - and shuts
 *  it on the next frame, as a player does. The window's own doors are called as a real one calls them: the loot hooks'
 *  `opened()` once it stands and `closed()` once it shuts (ui/inventoryDoor.js createInventoryWindow and
 *  systems/inventorySession.js closeSession - DESIGN.md 3.6), and its deps' `onClose`. A window the press opens before
 *  the piece is in it waits for it, open. */
export function windowFor(p, choose) {
  const w = { opened: [], took: [] };
  w.open = (hooks, deps = null) => { w.opened.push({ hooks, deps, took: false, shut: false }); hooks?.opened?.(); w.click(); return true; };
  w.click = () => {
    for (const o of w.opened) {
      if (o.took) { if (!o.shut) { o.shut = true; o.hooks?.closed?.(); o.deps?.onClose?.(); } continue; }
      const list = o.hooks?.items?.();
      if (!Array.isArray(list)) continue;
      const it = list.find((x) => x && choose(x));
      if (!it) continue;
      const plan = planTake(it, { bag: (p.entity.items ??= []), entity: p.entity, mode: 'remove' });
      if (!plan.ok) continue;
      applyTransfer(it, plan, list, p.entity.items, { entity: p.entity, toPlayer: true });
      o.took = true;
      w.took.push(pieceOf(it));
    }
  };
  return w;
}
export const choosing = (piece) => (it) => pieceOf(it) === piece;

/** THE WINDOW STAND-IN, whole (slice 1): a window the TEST drives, as a player does - it stands open until `close()`, and
 *  moves pieces one door at a time through the window's own law:
 *    take(choose)   a click on a row: planTake + applyTransfer out of the hooks' `items()` into the pack;
 *    takeAll(filter) Take all: enhancedInventory.js bulkMove's take arm - the rows the filter shows (storeFilter.js
 *                   filterStore), top to bottom, each the single click's plan, through runBulk and bulkVerdict;
 *    store(piece)   a click on a PACK row: planStore + applyTransfer out of the pack into the container (the classic
 *                   window puts into a container two-way, a piece at a time);
 *    stashAll(rows) Stash all: bulkMove's stash arm over `rows` (the pack page as the window last drew it);
 *    close()        the hooks' `closed()` and the deps' `onClose`, once.
 *  `opened` lists every window the press opened; `list()` is the rows of the current one. */
export function lootWindow(p) {
  const w = { opened: [], cur: null };
  w.open = (hooks, deps = null) => { const o = { hooks, deps, shut: false }; w.opened.push(o); w.cur = o; hooks?.opened?.(); return true; };
  w.click = () => {};   // run() offers every window a click each frame: this one waits for its test
  w.list = () => w.cur?.hooks?.items?.() ?? null;
  w.take = (choose) => {
    const list = w.list();
    const it = Array.isArray(list) ? list.find((x) => x && choose(x)) : null;
    if (!it) return null;
    const plan = planTake(it, { bag: (p.entity.items ??= []), entity: p.entity, mode: 'remove' });
    if (!plan.ok) return null;
    const landed = applyTransfer(it, plan, list, p.entity.items, { entity: p.entity, toPlayer: true });
    return list.includes(it) ? null : (landed ?? it);   // the piece that moved (a coin: the row, spent into the purse), or null when nothing did
  };
  w.takeAll = (filter = null) => {
    const from = w.list(), to = (p.entity.items ??= []);
    const shown = filter ? filterStore(from, filter, (it) => it.name) : from;
    return runBulk([...shown], (item) => {
      if (!from.includes(item)) return { verdict: 'skip' };
      const plan = planTake(item, { bag: to, entity: p.entity, mode: 'remove' });
      return { verdict: bulkVerdict(item, plan), refusal: plan.refusal, plan };
    }, (item, d) => { applyTransfer(item, { ...d.plan, amount: d.plan.amount }, from, to, { entity: p.entity, fromLocal: false, toPlayer: true }); });
  };
  w.store = (piece) => {
    const list = w.list();
    const plan = planStore(piece, { remote: list });
    if (!plan.ok) return false;
    applyTransfer(piece, plan, (p.entity.items ??= []), list, { entity: p.entity, fromLocal: true, toPlayer: false });
    return true;
  };
  w.stashAll = (rows) => {
    const from = (p.entity.items ??= []), to = w.list();
    return runBulk([...rows], (item) => {
      if (!from.includes(item)) return { verdict: 'skip' };   // bulkMove's own first line: a row the pack no longer holds is left
      const plan = planStore(item, { remote: to });
      return { verdict: bulkVerdict(item, plan), refusal: plan.refusal, plan };
    }, (item, d) => { applyTransfer(item, { ...d.plan, amount: d.plan.amount }, from, to, { entity: p.entity, fromLocal: true, toPlayer: false }); });
  };
  w.close = () => { for (const o of w.opened) if (!o.shut) { o.shut = true; o.hooks?.closed?.(); o.deps?.onClose?.(); } };
  return w;
}

/** WHERE EVERY PIECE IS: on the owner's body, in the owner's pack, or in a taker's pack (what each holds past what it
 *  held at the press) - a piece's count, or a purse's coin. Answers each place's count per piece of the body. */
export function census(s) {
  const places = [['the owner\'s body', s.rat.entity.items ?? [], 0, null], ...[s.bob, ...s.them, ...(s.ghosts ?? [])].map((p) => [`${p.id === s.bob.id ? 'the owner' : p.id}'s pack`, p.entity.items ?? [], (p.entity.goldPieces | 0) - s.before.get(p.id).gold, s.before.get(p.id).items])];
  const out = new Map(s.body.map((it) => [pieceOf(it), []]));
  for (const [where, items, coin, had] of places) {
    const counts = new Map();
    for (const it of items) { if (!it) continue; const k = pieceOf(it); counts.set(k, (counts.get(k) ?? 0) + (it.stackCount ?? 1)); }
    if (had) for (const k of had) counts.set(k, (counts.get(k) ?? 0) - 1);
    if (coin) counts.set(GOLD, (counts.get(GOLD) ?? 0) + coin);
    for (const [k, n] of counts) if (out.has(k) && n > 0) out.get(k).push([where, n]);
  }
  return out;
}
/** The pieces that are not in exactly one place - destroyed (in none, or fewer than the body held) or doubled. */
export function misplaced(s) {
  const out = [];
  for (const [k, at] of census(s)) {
    const want = s.body.filter((it) => pieceOf(it) === k).reduce((n, it) => n + (it.stackCount ?? 1), 0);
    const have = at.reduce((n, [, c]) => n + c, 0);
    const name = nameOf(s.body, k);
    if (have < want) out.push(`${name}: ${want - have} of ${want} DESTROYED - in no place (${at.length ? at.map(([w, c]) => `${w} ${c}`).join(', ') : 'nowhere'})`);
    else if (have > want || at.length > 1) out.push(`${name}: ${have > want ? `${have} where the body held ${want} - DUPED` : 'split'} (${at.map(([w, c]) => `${w} ${c}`).join(', ')})`);
  }
  return out;
}
/** The plaque a player sees over a body: the real resolveHover over the pool's own doors, as the hosts' ladders read them. */
export const plaque = (p, key) => resolveHover({ key, distance: 1, reach: 3.75 }, { name: composeNamer([(k) => p.names(k)]), contents: composeContents([(k) => p.holds(k)]) });
export const saysEmpty = (f) => f?.kind === 'items' && f.empty === true;
export const SETTLED_MS = 120_000;   // past every timeout the street has (TAKE_WINDOW_MS, GRANT_BACK_MS, FOES_STALE_MS) and any a fix adds, many times over

// ═══ SCENARIO DRIVERS ═════════════════════════════════════════════════════════════════════════════════════════════════
/** Mac presses Bob's body through the window, choosing the Greaves; the owner's answer (`bob>mac`) or the ask
 *  (`mac>bob`) runs as late as the test says; once every timeout has passed each piece is in exactly one place. */
export async function lateCase(where, { answerLate = 0, askLate = 0 } = {}) {
  const s = await scene(where);
  s.net.late.set(`${s.bob.id}>${s.mac.id}`, answerLate);
  s.net.late.set(`${s.mac.id}>${s.bob.id}`, askLate);
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, answerLate + askLate + SETTLED_MS, [w]);
  return s;
}
/** Mac presses; the owner's answer is 1.5 s on the wire; `what` happens 300 ms after the press - mid-claim. */
export async function midClaim(where, what) {
  const s = await scene(where);
  s.net.late.set(`${s.bob.id}>${s.mac.id}`, 1500);
  const w = windowFor(s.mac, choosing(GREAVES));
  s.mac.press(s.keyOf(s.mac), w);
  run(s.net, 300, [w]);
  what(s);
  run(s.net, SETTLED_MS, [w]);
  return s;
}
/** A player walks out of the cell: another room (its hit queue's room moves, so what it held is ended), its puppets taken
 *  down (world.js's room change), and nothing more of the old cell's reaches it - nor its frames the cell. */
export const leave = (p) => { p.here = false; p.room = 'world:9,9'; p.clear(); };
/** A player crosses into the next cell, holding the old one as a halo (WORLD6b-iii(b)): its room moves (its hit queue
 *  ends what it held), its puppets of the old cell are swept, and the old cell's frames still reach it. */
export const cross = (p) => { p.room = 'world:4,12'; p.halo.add('world:3,12'); p.clear(); };
/** A player's socket drops for `ms` and comes back to the same cell: nothing sent or heard meanwhile. */
export const drop = (net, p, ms) => { p.here = false; net.at(clock.t + ms, () => { p.here = true; }); };
