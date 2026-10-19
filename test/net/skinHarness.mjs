// PARTY-SKIN (PR B, test-harness/loot-followups/DESIGN-B.md section 8): THE SKINNER, over the harnesses' real pools.
//
// A player who skins is the REAL gathering host (scenes/gatherHost.js) with Hunting's REAL kind (scenes/huntHost.js huntKind over
// bodiesHere for the player's own pool), the real body stamps registered as world.js registers them, and a real profession book
// over a door that answers a harvest as the service does and records what it was asked. Nothing the code under test decides is
// stood in for: the pools, the hit queue, the host, the kind, the act, the kill credit and the book are the game's.
//
// Not a .test.js on purpose (the manifest counts suites): the shared precondition of test/net/partyskin.test.js.
//
//   - `hunter(s, p, o)`   a player's gathering host standing at a body, its knife in the pack or not;
//   - `go(net, ms)`       time passing for the cell AND every hunter's host (each is offered a frame as the cell's frame runs);
//   - `h.trace(net)`      the knife drawn along the act's own line, the cell running under it, then waiting for the harvest;
//   - `bsOf` / `sqLog`    what crossed the relay: an owner's streamed skin entry for a body, a player's claims.
import { createProfBook } from '../../src/net/profBook.js';
import { utcDayOfMs } from '../../src/net/nodeLaw.js';
import { xpForRank, SKINNING_KNIFE } from '../../src/net/professionLaw.js';
import { createBodyStamps, bodiesHere, huntKind } from '../../src/scenes/huntHost.js';
import { createGatherHost, aimAt } from '../../src/scenes/gatherHost.js';
import { registerPlayerKillListener } from '../../src/systems/playerKills.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { run, actor, as, clock } from './bodyLootHarness.mjs';

export const DAY = 20_833;
export const NOW = DAY * 86_400_000 + 3_600_000;
/** The skinners' wall clock (the shared clock: `createBodyStamps({ nowMs })`, the book's `now`). A test moves it across midnight. */
export const utc = { t: NOW };
export const NIGHT = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 2, climate: 231, region: 59, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
export const TOWN = { ...NIGHT, inLocationRect: true, locationType: 0 };
export const SEA = { ...NIGHT, climate: CLIMATES.Ocean };
/** A global order of events the pins compare across modules: a harvest asked, a frame built. */
export const order = { n: 0 };
/** The ground every hunter stands on (the foraging host's world): a test moves it to a settlement or the sea. */
export const skinWorld = { w: NIGHT };
export const knifeOf = (condition = 50) => ({ templateIndex: SKINNING_KNIFE.templateIndex, name: 'Skinning Knife', currentCondition: condition, maxCondition: 50 });

const HUNTERS = [];
/** Every hunter standing (the dungeon's frame offers each its click). */
export const hunters = () => HUNTERS;
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));

/** Every hunter gone and the kill listeners with them (a test's afterEach). */
export function unhunt() {
  for (const h of HUNTERS.splice(0)) { registerPlayerKillListener(`skin:${h.p.id}`, null); h.host.dispose(); }
  setForagingHost(null);
  utc.t = NOW; skinWorld.w = NIGHT;
}
/** Time passing for the cell and for every hunter's host: each hunter is offered a frame as the cell's frame runs. */
export const go = (net, ms) => run(net, ms, HUNTERS.map((h) => ({ click: h.click })));
/** The book's harvests answered and said - the service's door is real I/O in the book, never a fixed count of ticks. */
export async function answered(...hs) {
  for (let i = 0; i < 400 && hs.some((h) => h.book.pendingHarvests); i++) await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 4; i++) await tick();
}

/** The body of foe `f` (a pool's foe) where its pool says it lies. */
/**
 * The knife drawn along each hunter's act's own line at once, the cell running under them (E held), then the cell run on - E
 * let go, an act at its end holding for the authority's word - until every act has ended or `waitMs` have passed.
 * `pitchOff` - degrees off the line (a torn pelt); `slip` - let go on the last step.
 */
export async function traceAll(net, hs, { steps = 40, stepMs = 50, waitMs = 8000, slip = false, pitchOff = 0, drive = null } = {}) {
  const step = drive ?? ((ms) => go(net, ms));   // the dungeon's cell runs async, through its wire
  const lines = hs.map((h) => {
    if (!h.host.acting()) return null;
    const at = h.look();
    h.host.tick(0.001);
    const pts = h.seen.meter?.state?.points;
    return pts ? { h, at, pts } : null;
  }).filter(Boolean);
  for (let i = 0; i <= steps; i++) {
    for (const { h, at, pts } of lines) {
      const u = (i / steps) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      h.view.yaw = -at.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      h.view.pitch = -at.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t + pitchOff;
      h.input.held = !(slip && i === steps);
    }
    await step(stepMs);
  }
  for (let ms = 0; ms < waitMs && hs.some((h) => h.host.acting()); ms += 50) await step(50);
  for (const { h } of lines) h.input.held = false;
  await answered(...hs);
}
/** The cell run on, `ms` at a time, until `pred()` or `maxMs` have passed. Answers whether it came true. */
export function until(net, pred, maxMs = 15000, stepMs = 50) {
  for (let ms = 0; ms < maxMs; ms += stepMs) { if (pred()) return true; go(net, stepMs); }
  return pred();
}
/** `until` for a cell that runs async (the dungeon's wire): `drive(ms)` runs it. */
export async function untilAsync(drive, pred, maxMs = 15000, stepMs = 50) {
  for (let ms = 0; ms < maxMs; ms += stepMs) { if (pred()) return true; await drive(stepMs); }
  return pred();
}
/** A blow of `p`'s on the owner's live foe (Bob's own on `s.rat`; a taker's on its puppet of it): the pool's own damage door. */
export function strike(s, p, damage = 9999) {
  const f = p === s.bob ? s.rat : p.pool().foes.find((x) => x.puppet === s.bob.id && !x.dead);
  if (!f) throw new Error(`${p.id} stands no live foe of ${s.bob.id}'s to strike`);
  as(p, () => p.pool().damageFoe(f, damage, [p.feet[0], p.feet[1], p.feet[2]], [0, 0, 1], { kind: 'melee' }));
}
export const bodyOf = (p, f) => p.pool().corpseAt?.(f) ?? f.corpseMarker?.pos ?? f.ai.feet;

/**
 * A player's gathering host at the body.
 * @param {{ bob: any, rat: any }} s the scene @param {any} p the harness player
 * @param {{ bodies?: (stamps: any) => any[], bodyAt?: () => number[], stand?: boolean, account?: string, knife?: any, rank?: number, hides?: number, high?: number, world?: any, stores?: number,
 *   respond?: (b: any) => any, foe?: () => any, standAt?: number, gentle?: boolean }} [o]
 *   `respond` - the service's answer to a harvest (default: one hide); `foe` - the body's foe in this player's pool;
 *   `knife` - an item, null for none (default a fresh one); `stores` - the Stores' cap (0: full)
 */
export async function hunter(s, p, o = {}) {
  const { account = p.id, knife = knifeOf(), rank = 10, hides = 0, high = 0, world = NIGHT, stores = 5000, standAt = 2.2 } = o;
  skinWorld.w = world;
  setForagingHost({ world: () => skinWorld.w });
  const asked = [];
  const door = {
    account: () => account,
    state: async () => ({ ok: true, data: { day: utcDayOfMs(utc.t), character: 'c1', tracks: [{ profession: 'hunting', xp: xpForRank(rank), rank, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores, withdraw: 200, highHides: 3 }, hunt: { hides, high } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async (b) => {
      asked.push({ ...b, account, at: clock.t, order: ++order.n });
      if (o.respond) return o.respond(b);
      return { ok: true, data: { node: b.node, kind: b.kind, material: 'hide:rat', qty: 1, xp: 10, track: { profession: 'hunting', xp: xpForRank(rank) + 10, rank }, today: 1, hunt: { hides: hides + 1, high } } };
    },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => utc.t, sleep: noWait });
  await book.refresh();
  const stamps = createBodyStamps({ nowMs: () => utc.t });
  registerPlayerKillListener(`skin:${p.id}`, (e) => { if (actor.id === p.id) stamps.stamp(e); });   // world.js's 'hunting' listener, for THIS player's kills alone
  const entity = { items: knife ? [knife] : [] };
  const seen = { prompt: null, meter: null, toasts: [], haul: [] };
  const hud = { setPrompt: (x) => { seen.prompt = x; }, setMeter: (m) => { seen.meter = m; }, toast: (x) => seen.toasts.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const foe = o.foe ?? (() => (p === s.bob ? s.rat : p.pool().foes.find((x) => x.puppet === s.bob.id && x.corpse)));
  const body = () => (o.bodyAt ? o.bodyAt() : bodyOf(p, foe()));
  const stand = () => { const at0 = body(); p.feet[0] = at0[0]; p.feet[1] = at0[1]; p.feet[2] = at0[2] - standAt; };   // the pool's reach tests (the owner's A1/C7) read the harness's feet
  if (o.stand !== false) stand();
  const view = { yaw: 0, pitch: 0 };
  const input = { held: false, attack: false, choice: false };
  const eyePos = () => [p.feet[0], p.feet[1] + 1.6, p.feet[2]];
  const lists = [];
  const nodes = () => (o.bodies ? o.bodies(stamps) : bodiesHere(s.where === 'building' ? 'interior' : 'exterior', { street: p.pool(), interior: p.pool() }, stamps));
  const host = createGatherHost({
    book, hud, kinds: [huntKind({ book, bodies: () => nodes(), openLoot: (key) => lists.push(key) })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: 231, region: 59 }), nowMs: () => utc.t,
    eye: () => ({ pos: eyePos(), dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => p.feet, entity: () => entity, keyLabel: (a) => (a === 'ActChoice' ? 'R' : 'E'), input: () => input, active: () => true, lit: () => h.lit,
  });
  const h = {
    lit: /** @type {string|null} */ (null),
    p, host, seen, book, stand, asked, stamps, entity, input, view, lists, account,
    click: () => host.tick(0.05),
    /** Look at the body from where the player stands. */
    look() { const at = aimAt(eyePos(), [body()[0], body()[1] + 0.2, body()[2]], { yaw: 0, pitch: 0 }); view.yaw = -at.yaw; view.pitch = -at.pitch; return at; },
    /** Look and let the host see it: the target, the prompt. */
    aim() { h.look(); host.tick(0.016); return host.target; },
    /** WHAT THE SKIN POP-UP SAYS over the body, as the plaque's menu lists it: the Skin row, "<label> | ready" or "<label> | <why it is
     *  refused>" (a body that holds loot also lists Search, and a ready Search makes the prompt "Search the Rat" - the row is the pop-up). */
    row() {
      const t = h.aim();
      if (!t) return 'no node';
      const r = host.hoverName(`prof:${t.node.key}`)?.actions.find((a) => a.id === 'hide');
      return r ? (r.disabled ? `${r.label} | ${r.why}` : `${r.label} | ready`) : 'no menu';
    },
    /** The row ids the plaque's menu would list over the body. */
    menu() { h.aim(); return host.target ? host.hoverName(`prof:${host.target.node.key}`)?.actions.map((a) => a.id) ?? null : null; },
    /** Whether an act is under way. */
    get acting() { return host.acting(); },
    /** The foe's number in its owner's pool (the record's `i`). */
    foe,
    /** The bodies this player's host is offered (the pool's, by shared id or private stamp). */
    nodes,
    /**
     * The knife drawn along the act's own line, the cell running under it (E held), then the cell run on - E let go,
     * the act at its end holding for the authority's word - until a harvest is asked, or `waitMs` have passed.
     * @returns {Promise<boolean>} whether this player's book was asked a harvest
     */
    async trace(net, o2 = {}) { await traceAll(net, [h], o2); return asked.length > 0; },
    /** The line drawn as far as its end and no further (the act holds there if the hold is on): E stays held. */
    async toTheEnd(net, o2 = {}) { await traceAll(net, [h], { ...o2, waitMs: 0 }); },
    /** Escape. */
    cancel() { return host.cancel(); },
  };
  if (o.stand !== false) h.look();
  HUNTERS.push(h);
  return h;
}

/** The owner's last streamed skin entry for the body `ref` (street: the foe's number), off the relay's log. */
export function bsOf(net, owner, ref) {
  for (let i = net.foesLog.length - 1; i >= 0; i--) {
    const e = net.foesLog[i];
    if (e.from !== owner || !Array.isArray(e.frame.bs)) continue;
    const hit = e.frame.bs.find((x) => Array.isArray(x) && x[0] === ref);
    if (hit) return hit;
  }
  return undefined;
}
/** Every entry the owner streamed for `ref`, in order. */
export const bsHistory = (net, owner, ref) => net.foesLog.filter((e) => e.from === owner && Array.isArray(e.frame.bs)).flatMap((e) => e.frame.bs.filter((x) => Array.isArray(x) && x[0] === ref).map((x) => ({ at: e.at, entry: x })));
/** The claims the relay accepted (hits carrying `sq`), as `{ from, to, at, cid, id, op }`. */
export const sqLog = (net, from = null) => net.log.filter((e) => Array.isArray(e.data.sq) && (from == null || e.from === from)).map((e) => ({ from: e.from, to: e.to, at: e.at, cid: e.data.sq[0], id: e.data.sq[1], op: e.data.sq[2], data: e.data }));
