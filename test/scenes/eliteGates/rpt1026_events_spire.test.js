// RPT1026-EVENTS (private reports, 2026-10-24 and 10-25), the Elite Breach's two:
//
// SPIRE-SPOILS (two reports: a Redoubt's spoils lay on the Court's floor and none could be taken) - A REDOUBT'S SPOILS
// ARE PRESSED IN THE SPIRE. A Redoubt's spoils
// are thrown from its Court's heart into the Hour's pool (scenes/world.js egSpoilsPaid), and the press takes a piece as a
// target the one ray wins. The gate's court and the Hour's realm stood the pool's targets and their names in the context
// they stand in; the Spire's circle stood neither, so every piece lay drawn on the Court's floor and no press reached it.
// The real circle (scenes/eliteGates/egCircleHost.js) stood into a context of the dungeon host's shape; the real pool
// (scenes/spoilsPool.js) throwing a Redoubt's real spoils (systems/eliteGates/egSpoils.js egSpoilsList) from the Court's
// heart over the circle's own collider, kept to its floor as the client keeps them (scenes/eliteGates/egClient.js beaconAt).
//
// SPIRE-CATCHUP (a report: a member whose window was in the background when the rest ended stayed in the finished
// circle and lost what they carried)
// - A MEMBER WHOSE WINDOW SLEPT IS TAKEN INTO THE COMPANY'S CIRCLE when it draws again. Played against the relay's real Room
// (EG-PLAY's harness, test/world/eliteGates/egswap_client.test.js withPlay's), with a hidden window's beats beside it: the
// room's words still come (a socket's events fire in a hidden tab), and no frame of mine runs and no pose of mine is sent.
//
// tools/mutants/rpt1026_events.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../../src/player/collider.js';
import { createEgCircleHost } from '../../../src/scenes/eliteGates/egCircleHost.js';
import { createSpoilsPool, SPOIL_KEY, SPOIL_GOLD_KEY } from '../../../src/scenes/spoilsPool.js';
import { egHallOf, egCircleSpecs, egRoomKey, egOnArrive, egCircleOfHall, EG_SEALED_MS, EG_GATHER_MS, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { createEgClient, EG_BEACON_SPEW_UP, EG_BEACON_RIM_M } from '../../../src/scenes/eliteGates/egClient.js';
import { egSpoilsList, egSpoilsDay } from '../../../src/systems/eliteGates/egSpoils.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, validEgOut, validEgIn, EG_BRAIN_V } from '../../../src/net/wire.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';

const SEED = 1, C = 1;
const B = '0123456789abcdef';

/** A context of the dungeon host's shape (scenes/dungeonContext.js): its draws, its collider, its targets' and namers' doors. */
function contextOf() {
  const providers = [], namers = [];
  return {
    dynamicDraws: [], collider: new Collider(() => -Infinity), providers, namers,
    addActivationTargets(fn) { providers.push(fn); }, addActivationNamer(fn) { namers.push(fn); }, addTeardown() {},
    targets: () => providers.flatMap((fn) => fn() ?? []),
    name: (key) => { for (const n of namers) { const v = n(key); if (v) return v; } return null; },
  };
}

test('RPT1026-EVENTS SPIRE-SPOILS: a Redoubt\'s spoils thrown from its Court\'s heart come to rest on the circle\'s own floor, and the circle stood into its context offers every resting piece to the activation ray and names it - the host\'s floor pool asked, as the gate\'s court and the Hour\'s arena ask it (mutants: the targets never offered; the pieces never named)', () => {
  // the circle's Court - its fifth hall - and its heart's place, as the client's beaconAt says it
  const court = egCircleSpecs(SEED, C, 0).find((s) => s.kind === 'court');
  assert.ok(court, 'the circle\'s Court');
  const spec = egHallOf(SEED, court.h, 0), r = spec.ring, f = spec.fight ?? spec.end;
  const floor = egToDungeon(spec, r.x, f.y ?? 0, r.z);
  const at = [floor[0], floor[1] + EG_BEACON_SPEW_UP, floor[2]], keep = { centre: floor, r: Math.max(2, r.r - EG_BEACON_RIM_M), floorY: floor[1] };
  const ctx = contextOf();
  let clock = 1_800_000_000_000;
  const pool = createSpoilsPool({
    ray: (from, dir, len) => { const h = ctx.collider.raycastHit(from, dir, len); return Number.isFinite(h?.dist) ? h : null; },
    now: () => clock, take: () => {}, who: () => 'char-1', itemName: () => ({ title: 'a piece' }),
  });
  const host = { egGateOpen: () => false, spoilTargets: () => pool.targets(), spoilName: (key) => pool.nameOf(key) };
  const circle = createEgCircleHost({ renderer: null, host, wm: { mode: 'dungeon', dungeonCtx: ctx, dungeonLoc: null } });
  circle.standEgHall(ctx, { b: B, seed: SEED, c: C, geo: 0 });
  assert.ok(ctx.collider._buckets.has('eg:hall'), 'its floors on the collider');
  // the Redoubt's spoils, the claim's own roll at its depth
  const level = 20, roll = () => egSpoilsList(42, level, 1, { lord: court.lord ?? '', pity: [], goldOnly: false, embers: 0 });
  assert.ok(pool.spew({ day: egSpoilsDay(B, 1), seed: 42, level, at, bearing: 0.7, acct: 'acct-1', keep, roll }), 'thrown');
  for (let t = 0; t < 9000; t += 16) { clock += 16; pool.frame(); }
  const pieces = pool.state().pieces;
  assert.ok(pieces.length >= 2 && pieces.every((q) => q.rest), 'every piece at rest');
  assert.ok(pieces.every((q) => Math.abs(q.pos[1] - keep.floorY) < 0.05), 'on the Court\'s floor');
  // THE PRESS: the context's ray is offered every resting piece, by its key, and names it
  const keys = ctx.targets().map((q) => q.key).filter((k) => k.startsWith(SPOIL_KEY) || k.startsWith(SPOIL_GOLD_KEY));
  assert.equal(keys.length, pieces.length, `every piece offered: ${keys}`);
  for (const k of keys) assert.ok(ctx.name(k), `${k} named`);
  assert.ok(pool.pick(keys.find((k) => k.startsWith(SPOIL_KEY)) ?? keys[0]), 'and the press takes it');
});

// ── SPIRE-CATCHUP, played ──────────────────────────────────────────────────────────────────────────────────────────
const T0 = 1_800_000_000_000;
const ME = 'acct-mac';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const tick = () => new Promise((r) => setImmediate(r));
async function withPlay(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  const eg = world.room(egRoomKey(B));
  const pending = [], asked = { enter: [], exits: 0, lands: [] };
  const entity = { level: 20, health: 100, maxHealth: 100, magicka: 0, maxMagicka: 40, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(SITE.x, 0, SITE.z) };
  const from = { pos: [1, 2, 3], normal: [0, 0, 1] };
  let mode = 'exterior', hall = null, ws = null, macHub = null;
  const modes = {
    get mode() { return mode; },
    egHallBreach: () => (mode === 'dungeon' && hall ? hall.b : null),
    egHallCircle: () => (mode === 'dungeon' && hall ? hall.c : null),
    stepThroughFire: async (go) => go(),
    enterEgHall: (r) => { if (mode !== 'exterior') return false; asked.enter.push(r); mode = 'dungeon'; hall = { ...r }; player.pos = realmToDungeon(0, 0, 1.5); return true; },
    egPlace: (at) => { player.pos = [...at]; return true; },
    egLeave: () => { mode = 'exterior'; hall = null; return true; },
    egHallReturn: () => (mode === 'dungeon' ? from : null),
    forceExitToExterior: () => { asked.exits++; mode = 'exterior'; hall = null; },
    egPrebuild: () => null,   // no build offered: a new circle is stepped into the old way, out under the veil and in
    egSwapCircle: () => false,
    egSwapDrop: () => {},
    get dungeonCtx() { return mode === 'dungeon' ? { exitDoors: [] } : null; },
  };
  const send = (room, sock, w) => { pending.push(room.raw(sock, JSON.stringify({ t: 'eg', ...w }))); return true; };
  const hubLink = { get egOk() { return true; }, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); return w && macHub ? send(hub, macHub, w) : false; } };
  const presence = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) }); return w && ws && mode === 'dungeon' ? send(eg, ws, w) : false; } };
  let inflight = 0;
  const track = (f) => async (...a) => { inflight++; try { return await f(...a); } finally { inflight--; } };
  const account = {
    me: () => ME, guest: () => false,
    keys: track(async () => ({ ok: true, data: { keys: 2 } })),
    open: track(async (rq, rh) => ({ ok: true, data: { order: await mintEgOrder({ o: 'egopen', s: ME, eb: B, ez: 'z'.repeat(20), ...(rh ? { rh: 1 } : {}) }, (await hub.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) }), b: B, ez: 'z'.repeat(20), keys: 1, until: 0, rh: rh ? 1 : 0 } })),
    admit: track(async (b) => ({ ok: true, data: { order: await mintEgOrder({ o: 'egadmit', s: ME, eb: b, ez: 'a'.repeat(20) }, (await eg.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) }), b } })),
    claim: track(async (r) => { const c = readEgReceipt(r); return { ok: true, data: { recorded: true, q: c.q, b: c.b, ...(c.q === 'w' ? { w: c.w } : {}), keys: 1 } }; }),
  };
  const client = createEgClient({
    modes: () => modes, online: () => presence, hub: () => hubLink, account, now: () => clock, entity, player, cam: { pos: player.pos },
    say: () => {}, mid: () => {}, site: () => ({ climateBase: 2, season: 0 }), wire: () => SITE,
    landAt: (l) => { asked.lands.push(l); return true; }, hurt: (n) => { entity.health -= n; },
  });
  const seen = new Map();
  const pump = () => {
    for (const [r, s] of [[SOCIAL_ROOM, macHub], [egRoomKey(B), ws]]) {
      if (!s) continue;
      let i = seen.get(s) ?? 0;
      for (; i < s.sent.length; i++) { const m = s.sent[i]; if (m.t === 'eg') client.word(validEgOut(m), r); }
      seen.set(s, i);
    }
  };
  const settle = async () => { for (let q = 0, k = 0; k < 5000 && q < 3; k++) { await tick(); const busy = inflight > 0 || pending.length > 0; await Promise.all(pending.splice(0)); pump(); q = busy ? 0 : q + 1; } };
  const beat = async (ms) => { const end = clock + Math.round(ms); while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); pump(); } clock = end; };
  const pose = () => { const [x, y, z] = player.pos; return { x, y, z, yaw: 0, pitch: 0 }; };
  const frame = async (ms = 300) => { client.frame(); await settle(); if (ws && mode === 'dungeon') await eg.pose(ws, pose()); await beat(ms); pump(); await settle(); };
  /** THE WINDOW HIDDEN: the room beats and its words are heard - no frame of mine runs, no pose of mine is sent. */
  const asleep = async (ms = 300) => { await beat(ms); pump(); await settle(); };
  const enter = async () => { ws = eg.connect(); await eg.hello(ws, 'peer-mac', pose(), { kind: 'linked', tokenSub: ME, charLevel: 20 }); pump(); await settle(); };
  const rec = () => eg.room._eg;
  try {
    await quiet(async () => {
      macHub = hub.connect(); await hub.hello(macHub, 'peer-mac', null, { name: 'Mac', acct: ME, asecret: 'secret-of-acct-mac', kind: 'linked' });
      assert.equal(client.useKey(), EG_TEXT.opening);
      await settle();
      clock += EG_SEALED_MS; await beat(1000);
      client.command('');
      await settle();
      await enter();
      await frame(300);
      for (let i = 0; i < 6 && rec().sg !== 'trial'; i++) await frame(EG_GATHER_MS / 3);
      await fn({ client, asked, player, modes, frame, asleep, rec, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('RPT1026-EVENTS SPIRE-CATCHUP: a member whose window slept through the Redoubt\'s descent - the rest, the stair and the next circle\'s gather all heard and none drawn - is taken into the company\'s circle at the first frame it draws, its trial already begun, its feet on the hall\'s arrival plate and alive; the step into a new circle was taken in the arrival\'s seconds alone, so a member back later stood in the finished Court until the absent law cast them out (mutants: the step taken at the arrival alone)', async () => {
  await withPlay(async (P) => {
    const { asked, frame, asleep, rec, modes, player, client } = P;
    // the breach carried to its first Court's rest, heard and drawn
    const B0 = rec(); B0.h = 5; B0.sg = 'rest'; B0.F = null; B0.sa = P.now(); B0.su = P.now() + 8000; B0.rd = 1;
    for (let i = 0; i < 20 && client.state().sg !== 'rest'; i++) await frame(300);
    assert.equal(client.state().sg, 'rest');
    await frame(300);
    assert.equal(modes.egHallCircle(), 1, 'in the first circle at its rest');
    // the window hidden from the rest on: the room descends, waits on me at the arrival, and wakes the next circle's first hall
    for (let i = 0; i < 200 && !(rec().sg === 'trial' && egCircleOfHall(rec().h) === 2); i++) await asleep(1000);
    assert.deepEqual([rec().sg, egCircleOfHall(rec().h)], ['trial', 2], 'the company in the next circle\'s trial');
    assert.equal(client.state().sg, 'trial', 'my screen heard it');
    assert.equal(modes.egHallCircle(), 1, 'and drew none of it: still the old Court');
    const h = rec().h;
    assert.ok(rec().mem[ME]?.alive, 'alive still - the absent law\'s minutes not spent');
    // the window shown again
    for (let i = 0; i < 6 && modes.egHallCircle() !== 2; i++) await frame(300);
    assert.equal(modes.egHallCircle(), 2, 'taken into the company\'s circle');
    assert.ok(asked.enter.some((r) => r.c === 2), 'its level entered');
    const s = egHallOf(rec().seed, h, rec().geo ?? 0), [sx, , z] = dungeonToRealm(player.pos[0], player.pos[1], player.pos[2]);
    assert.ok(egOnArrive(s, sx - s.x0, z, 0.5), 'on the hall\'s arrival plate');
    for (let i = 0; i < 4; i++) await frame(300);
    assert.ok(rec().mem[ME]?.alive, 'and alive in its trial');
  });
});
