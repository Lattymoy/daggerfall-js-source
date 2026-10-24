// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 31, EG-PLAY): THE ELITE BREACH
// ON THE CLIENT, PLAYED AGAINST THE REAL RELAY - scenes/eliteGates/egClient.js (the key, the call, the answer, the halls, the fight's
// seams, the Redoubt, the way out, the receipts) wired to the relay's real Room over fake objects (test/fakeRoom.mjs):
// every word the client sends is the relay's to judge, every word the relay says is the client's to fold. The mode
// machine, the body and the account service stand as fakes that record what they were asked (the service's own law is
// test/net/eliteGates/egplay_service.test.js's; the orders here are signed with the key of the room that verifies them). And the
// client's own pieces: the tracker (ui/eliteGates/egHud.js), the spans (scenes/eliteGates/egSpan.js), the made level (world/eliteGates/egHall.js), the
// hosts' wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY, validEgOut, validEgIn, EG_BRAIN_V } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egCircleSpecs, egOnArrive, egFirstHallOf, EG_SEALED_MS, EG_GATHER_MS, EG_REST_MS, EG_TEXT, EG_VOID_Y, EG_COUNT_START_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgClient, egClaimDone, egRefusalText, EG_END_WALK_MS, EG_CLAIMS_KEY } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egHudModel, EG_HUD_LOW_MS } from '../../../src/ui/eliteGates/egHud.js';
import { createEgSpan, EG_FLOOR_KEY, egStepKey } from '../../../src/scenes/eliteGates/egSpan.js';
import { egHallBlock, egHallLocation, isEgHall, egToDungeon, egFromDungeon, buildEgCircleModel, egCircleColliderTris, egGateParts, EG_HALL_BLOCK } from '../../../src/world/eliteGates/egHall.js';
import { isWeirKey, weirKeysHeld } from '../../../src/systems/eliteGates/weirKey.js';
import { EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_RD_WINDOW_MS } from '../../../src/net/eliteGates/egBrain.js';
import { madeLevelRule, madeLevelSays } from '../../../src/systems/madeLevel.js';   // EG-H2: the made level's law the hosts read

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const ME = 'acct-mac';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const tick = () => new Promise((r) => setImmediate(r));
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

/**
 * THE WHOLE LOOP: a hub and a breach room on the real Room, the client between them. `fn` gets the client, the fakes'
 * records and the helpers: `settle()` (every send answered), `pump()` (every word said heard), `frame(ms)` (one client
 * frame, my pose to the room, the room's beat over `ms`), `enter()` (the room socket opened once the mode machine has
 * stepped in), `standAt(sx, z)` (my feet in the Spire's frame).
 */
async function withPlay(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  const eg = world.room(egRoomKey(B));
  const pending = [], said = [], mids = [], asked = { open: [], admit: [], claim: [], enter: [], place: [], leave: 0, exits: 0, lands: [] };
  const entity = { level: 20, health: 60, maxHealth: 100, magicka: 0, maxMagicka: 40, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(SITE.x, 0, SITE.z) };
  const from = { pos: [1, 2, 3], normal: [0, 0, 1] };
  let mode = 'exterior', hall = null, ws = null, macHub = null;
  const exitDoors = [];
  const modes = {
    get mode() { return mode; },
    get stepping() { return false; },
    egHallBreach: () => (mode === 'dungeon' && hall ? hall.b : null),
    egHallCircle: () => (mode === 'dungeon' && hall ? hall.c : null),
    stepThroughFire: async (go) => go(),
    enterEgHall: (r) => { if (mode !== 'exterior') return false; asked.enter.push(r); mode = 'dungeon'; hall = r; player.pos = realmToDungeon(0, 0, 1.5); exitDoors.length = 0; return true; },
    egPlace: (at) => { asked.place.push(at); player.pos = [...at]; return true; },
    egLeave: () => { asked.leave++; mode = 'exterior'; hall = null; return true; },
    egHallReturn: () => (mode === 'dungeon' ? from : null),
    forceExitToExterior: () => { asked.exits++; mode = 'exterior'; hall = null; },
    get dungeonCtx() { return mode === 'dungeon' ? { exitDoors } : null; },
  };
  const send = (room, sock, w) => { pending.push(room.raw(sock, JSON.stringify({ t: 'eg', ...w }))); return true; };
  const hubLink = { get egOk() { return true; }, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); return w && macHub ? send(hub, macHub, w) : false; } };
  const presence = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) }); return w && ws && mode === 'dungeon' ? send(eg, ws, w) : false; } };
  // every ask of the service counted while it is out (settle() waits for them - a signature's time is the machine's)
  let inflight = 0;
  const track = (fn) => async (...a) => { inflight++; try { return await fn(...a); } finally { inflight--; } };
  const account = {
    me: () => ME, guest: () => false,
    keys: track(async () => ({ ok: true, data: { keys: 2 } })),
    open: track(async (rq, rh) => { asked.open.push({ rq, rh }); return { ok: true, data: { order: await mintEgOrder({ o: 'egopen', s: ME, eb: B, ez: 'z'.repeat(20), ...(rh ? { rh: 1 } : {}) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b: B, ez: 'z'.repeat(20), keys: rh ? 2 : 1, until: 0, rh: rh ? 1 : 0 } }; }),
    admit: track(async (b) => { asked.admit.push(b); return { ok: true, data: { order: await mintEgOrder({ o: 'egadmit', s: ME, eb: b, ez: 'a'.repeat(20) }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b } }; }),
    claim: track(async (r) => { asked.claim.push(r); const c = readEgReceipt(r); return { ok: true, data: { recorded: true, q: c.q, b: c.b, ...(c.q === 'w' ? { w: c.w } : {}), keys: 1 } }; }),
  };
  const store = memStore();
  const client = createEgClient({
    modes: () => modes, online: () => presence, hub: () => hubLink, account, now: () => clock, entity, player, cam: { pos: player.pos },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({ climateBase: 2, season: 0 }), wire: () => SITE,
    landAt: (l) => { asked.lands.push(l); return true; }, hurt: (n) => { entity.health -= n; }, store,
    fight: (link) => createEgFight({ link, now: () => clock, feet: () => (mode === 'dungeon' ? player.pos : null), player: () => entity,
      sendHit: (h) => presence.sendEg('hit', h), me: () => ME }),
  });
  const seen = new Map();
  const pump = (room = null, sock = null) => {
    for (const [r, s] of [[SOCIAL_ROOM, macHub], [egRoomKey(B), ws]]) {
      if (!s) continue;
      let i = seen.get(s) ?? 0;
      for (; i < s.sent.length; i++) { const m = s.sent[i]; if (m.t === 'eg') client.word(validEgOut(m), r); }
      seen.set(s, i);
    }
    void room; void sock;
  };
  /** Every send answered and every word heard: until nothing is out - no service ask, no relay frame - three turns running. */
  const settle = async () => {
    for (let quiet = 0, k = 0; k < 5000 && quiet < 3; k++) {
      await tick();
      const busy = inflight > 0 || pending.length > 0;
      await Promise.all(pending.splice(0));
      pump();
      quiet = busy ? 0 : quiet + 1;
    }
  };
  const beat = async (ms) => { const end = clock + Math.round(ms); while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); pump(); } clock = end; };
  const pose = () => { const [x, y, z] = player.pos; return { x, y, z, yaw: 0, pitch: 0, ...(entity.health > 0 ? {} : { dd: 1 }) }; };   // the presence pose: a dead body says so
  const frame = async (ms = 300) => { client.frame(); await settle(); if (ws && mode === 'dungeon') await eg.pose(ws, pose()); await beat(ms); pump(); await settle(); };
  const enter = async () => { ws = eg.connect(); await eg.hello(ws, 'peer-mac', pose(), { kind: 'linked', tokenSub: ME, charLevel: 20 }); pump(); await settle(); };
  const standAt = (sx, z, y = 0) => { player.pos = realmToDungeon(sx, y, z); };
  // EG-H1: a member WALKS to a credit - THE FAIR TRAIL (net/eliteGates/egFair.js) refuses a step through the door from a teleport
  const walkTo = async (sx, z, y = 0) => { const [x0, , z0] = dungeonToRealm(player.pos[0], player.pos[1], player.pos[2]), n = Math.max(1, Math.ceil(Math.hypot(sx - x0, z - z0) / 2)); for (let k = 1; k <= n; k++) { standAt(x0 + ((sx - x0) * k) / n, z0 + ((z - z0) * k) / n, y); await frame(250); } };
  const rec = () => eg.room._eg ?? eg.store.get(EG_KEY);   // the room's live record (its storage is a checkpoint)
  try {
    await quiet(async () => {
      macHub = hub.connect(); await hub.hello(macHub, 'peer-mac', null, { name: 'Mac', acct: ME, asecret: 'secret-of-acct-mac', kind: 'linked' });
      await fn({ client, said, mids, asked, entity, player, modes, exitDoors, store, settle, pump, beat, frame, enter, standAt, walkTo, rec, eg, hub, presence, step: (ms) => { clock += ms; }, now: () => clock, ws: () => ws });
    });
  } finally { Date.now = realNow; }
}

/** Into the breach: the key turned, the call heard, the open waited out, the answer, the room's hello, the gather. */
async function intoFirstHall(P) {
  const { client, settle, step, beat, enter, frame, rec } = P;
  assert.equal(client.useKey(), EG_TEXT.opening);
  await settle();
  step(EG_SEALED_MS); await beat(1000);
  client.command('');
  await settle();
  egGive8(rec().seed, [1]);   // PIN MOVED (THE ASCENT): the first circle given at law 8 (below)
  await enter();
  await frame(300);
  for (let i = 0; i < 6 && rec().sg !== 'trial'; i++) await frame(EG_GATHER_MS / 3);
}

test('EG-PLAY THE CLIENT ON THE RELAY: the Weir Key turned stakes it and hands the hub its order; the hub\'s call is said and kept; /breach before the open is told the time, after it admits me and steps me in under the veil; inside, my admission goes to the room once; the company gathered on the plate wakes the hall; the rifts broken through the fight\'s own seam open the door, my step through it is said and the pull stands me on Hall 2\'s plate (mutants: the open never sent; the call unheard; the step taken while it is sealed; the admission never said; the pull never stood)', async () => {
  await withPlay(async (P) => {
    const { client, said, asked, settle, step, beat, enter, frame, rec, standAt, walkTo, player } = P;
    assert.equal(client.useKey(), EG_TEXT.opening);
    await settle();
    assert.equal(asked.open.length, 1);
    assert.equal(asked.open[0].rh, false);
    assert.ok(rec(), 'the hub opened the breach\'s room');
    const call = client.state().call;
    assert.ok(call && call.b === B && call.os === ME, 'the call heard');
    assert.match(said.at(-1), /Your Elite Breach rises and opens in 5:00\./);
    assert.equal(client.useKey(), EG_TEXT.held, 'a second key turned while the breach stands opens nothing');
    // sealed: told when
    said.length = 0;
    client.command('');
    await settle();
    assert.match(said.at(-1), /^The breach opens in /);
    assert.equal(asked.enter.length, 0);
    // open: in
    step(EG_SEALED_MS); await beat(1000);
    client.command('');
    await settle();
    assert.deepEqual(asked.admit, [B]);
    assert.equal(asked.enter.length, 1);
    assert.deepEqual([asked.enter[0].b, asked.enter[0].c, asked.enter[0].seed], [B, 1, rec().seed]);
    // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the breach's first circle given at spec law 8 (test/egGive8.mjs - its
    // seed the hub's own draw), before the client stands it: I strike the rifts and walk to the door on law 8's ground
    egGive8(rec().seed, [1]);
    await enter();
    await frame(300);
    assert.equal(rec().mem[ME].in, 1, 'my admission said to the room');
    const zs = rec().zs.length;
    await frame(300);
    assert.equal(rec().zs.length, zs, 'and never again');
    // the gather and the wake
    for (let i = 0; i < 6 && rec().sg !== 'trial'; i++) await frame(EG_GATHER_MS / 3);
    assert.equal(rec().sg, 'trial');
    assert.equal(client.state().sg, 'trial');
    const spec = egHallOf(rec().seed, 1);
    assert.equal(spec.kind, 'yard');
    // the rifts and the legion, through the fight's own seam (EG-FULL: every one a body by its number - the legion first,
    // a Sapper opening a closed rift again)
    for (let guard = 0; guard < 4000 && rec().sg === 'trial'; guard++) {
      const cur = rec();
      const live = cur.F.bodies.filter((t) => t.hp > 0 && !(t.fl & (2 | 16 | 128)));
      const tgt = live.find((t) => t.role === 1) ?? live[0];
      if (!tgt) { await frame(250); continue; }
      standAt(spec.x0 + tgt.x - Math.sin(tgt.yaw ?? 0) * 1.5, tgt.z - Math.cos(tgt.yaw ?? 0) * 1.5);
      await frame(0);
      if (!client.state().fight.bodies.some((q) => q.i === tgt.i)) { await frame(250); continue; }
      assert.equal(client.fight().hostHit({ i: tgt.i, d: 200, r: 1 }), true, 'a standing body is one my blows meet');
      await frame(250);
    }
    assert.equal(rec().sg, 'closing', 'the last rift closed opens the door');
    assert.equal(client.state().sg, 'closing');
    // the door: my step through it, then the pull - PIN MOVED (EG-H1): walked there, not stood there (THE FAIR TRAIL refuses a
    // step through the door from a teleport - test/net/eliteGates/egint_relay.test.js pins it)
    await walkTo(spec.x0 + spec.end.x, spec.end.z);
    await frame(300);
    for (let i = 0; i < 4 && rec().h === 1; i++) await frame(300);
    assert.deepEqual([rec().h, rec().sg], [2, 'arrive'], 'my step through the door pulls the company');
    await frame(300);
    const s2 = egHallOf(rec().seed, 2);
    const placed = asked.place.at(-1);
    assert.ok(placed, 'the pull stands me');
    const [sx, , z] = dungeonToRealm(placed[0], placed[1], placed[2]);
    assert.ok(egOnArrive(s2, sx - s2.x0, z, 0.5), 'on Hall 2\'s arrival plate');
    assert.deepEqual([player.pos[0], player.pos[2]], [placed[0], placed[2]]);
    assert.ok(said.includes(EG_TEXT.pulled));
  });
});

test('EG-PLAY THE REDOUBT AND THE WAY HOME, PLAYED: the Court\'s lord felled is the circle\'s Redoubt - its receipt carried to the account service, the company healed once, the way home stood at the Court\'s heart (an exit door and its portal); pressed once it asks, again it walks - the room counts me home, my end receipt is carried too, the door goes and I walk out to where I answered from (mutants: the receipt never claimed; no heal; the way home taken at one press; the walk never taken)', async () => {
  await withPlay(async (P) => {
    const { client, said, mids, asked, entity, exitDoors, settle, frame, rec, eg, standAt, store } = P;
    await intoFirstHall(P);
    assert.equal(rec().sg, 'trial');
    // the breach carried to its Court: its record stood at Hall 5's trial, its lord one blow from the fall
    const B0 = eg.room._eg, seed = B0.seed, court = egHallOf(seed, 5);
    standAt(court.x0 + court.fight.x, court.fight.z);
    await frame(0);
    B0.h = 5; B0.sg = 'arrive'; B0.F = null; B0.gatherAt = 0; B0.pulledAt = P.now(); B0.mem[ME].hereH = 0;
    standAt(court.x0 + court.arrive.x, court.arrive.z);
    for (let i = 0; i < 8 && rec().sg !== 'trial'; i++) await frame(EG_GATHER_MS / 3);
    assert.equal(rec().sg, 'trial');
    standAt(court.x0 + court.ring.x, court.ring.z);
    const lordOf = () => eg.room._eg.F?.bodies.find((t) => t.role === 0);
    for (let i = 0; i < 6 && !lordOf()?.up2; i++) await frame(1000);
    const L = lordOf();
    assert.ok(L?.up2, 'the lord woke for the company in its ring');
    L.hp = 1; L.hpFloor = 0;
    standAt(court.x0 + L.x - Math.sin(L.yaw ?? 0) * 2, L.z - Math.cos(L.yaw ?? 0) * 2);
    await frame(0);
    assert.ok(client.state().fight.bodies.some((q) => q.i === L.i && q.role === 0), 'the lord is a body my blows meet');
    assert.equal(client.target?.() ?? null, null);
    assert.equal(client.fight().hostHit({ i: L.i, d: 50, r: 0 }), true);
    for (let i = 0; i < 6 && rec().sg !== 'rest'; i++) await frame(300);
    assert.equal(rec().sg, 'rest', 'the Court\'s fall is the Redoubt');
    assert.equal(rec().rd, 1);
    entity.health = 40;
    for (let i = 0; i < 30 && entity.health < entity.maxHealth; i++) await frame(300);
    // its receipt claimed, the company healed, the way home stood
    const w = asked.claim.map(readEgReceipt).find((c) => c.q === 'w');
    assert.ok(w, 'the Redoubt\'s receipt carried to the account service');
    assert.deepEqual([w.b, w.s, w.w], [B, ME, 1]);
    assert.ok(said.some((t) => /Redoubt 1 is yours/.test(t)));
    assert.equal(entity.health, entity.maxHealth, 'the Redoubt heals (the room\'s `eheal` at the rest\'s window)');
    assert.equal(exitDoors.length, 1, 'the way home stands - the level\'s exit door');
    const door = exitDoors[0];
    const [dsx, , dz] = dungeonToRealm(door.matrix[12], door.matrix[13], door.matrix[14]);
    assert.ok(Math.hypot(dsx - court.x0 - court.fight.x, dz - court.fight.z) < 0.01, 'at the Court\'s heart');
    // pressed once: asked (the way home opens once the rest's window has passed)
    for (let i = 0; i < 30 && P.now() < rec().rdAt + EG_RD_WINDOW_MS; i++) await frame(300);
    assert.equal(client.wayHome(), false);
    assert.match(mids.at(-1), /Walk home\?/);
    assert.equal(rec().mem[ME].home, 0);
    // again: walked
    assert.equal(client.wayHome(), true);
    await settle();
    assert.ok(rec().mem[ME].home > 0, 'the room counts me home');
    await frame(300);
    assert.equal(asked.leave, 1, 'out to where I answered from');
    const x = asked.claim.map(readEgReceipt).find((c) => c.q === 'x');
    assert.ok(x && x.why === 'home' && x.h === 5, 'my end receipt carried too');
    await frame(300);
    assert.equal(client.state().b, null, 'outside, the breach forgotten');
    assert.deepEqual(JSON.parse(store.getItem(EG_CLAIMS_KEY)), [], 'every receipt counted, none kept');
  });
});

test('EG-PLAY THE NEXT CIRCLE, PLAYED: the rest over, the room pulls the living to the next circle\'s first hall - the client steps out under the veil to where it answered from and into the new circle\'s level, its plate under my feet (mutants: the circle never rebuilt; the new level built over the old one)', async () => {
  await withPlay(async (P) => {
    const { client, asked, frame, rec, eg, step } = P;
    await intoFirstHall(P);
    const B0 = eg.room._eg;
    B0.h = 5; B0.sg = 'rest'; B0.F = null; B0.sa = P.now(); B0.su = P.now() + 1000; B0.rd = 1;
    await frame(300);
    step(EG_REST_MS); await frame(1500);
    assert.deepEqual([rec().h, rec().sg], [egFirstHallOf(2), 'arrive']);
    await frame(300);
    assert.equal(asked.exits, 1, 'out of the old circle');
    assert.equal(asked.lands.length, 1, 'stood where I answered from');
    assert.equal(asked.enter.length, 2);
    assert.deepEqual([asked.enter[1].b, asked.enter[1].c], [B, 2], 'into the next circle\'s level');
    assert.equal(P.modes.egHallCircle(), 2);
    assert.ok(client.state().b === B);
  });
});

test('EG-PLAY ONE LIFE AND THE VOID, PLAYED (EG-FULL, section 16.5): a blow that would kill me in the breach is a fall the death save turns aside - the client tells the room (`fell`), takes no blow while it watches (THE WITNESS) and walks nobody out itself; the room\'s fall is said, the company wiped, my end receipt carried, and the end walks me out at my health; the void\'s cost is a tenth of my health, never below a quarter (mutants: a death walked out twice; the void killing; the cost uncapped; a witness struck)', async () => {
  await withPlay(async (P) => {
    const { client, asked, entity, frame, rec, said } = P;
    await intoFirstHall(P);
    // the void: 10% of 100, at 60 -> 50; at 30 -> 25, never below a quarter; at 20 -> nothing
    entity.health = 60; client.castBack(); assert.equal(entity.health, 50);
    entity.health = 30; client.castBack(); assert.equal(entity.health, 25);
    entity.health = 20; client.castBack(); assert.equal(entity.health, 20);
    assert.equal(client.diedHere(), true, 'a death now is the Spire\'s');
    // the killing blow: the death save takes it
    assert.equal(client.witnessing(), false);
    assert.equal(client.fallSave(), true, 'the death save turns it aside');
    assert.equal(client.fallSave(), false, 'once');
    assert.equal(client.witnessing(), true, 'I watch');
    assert.ok(entity.health >= 1, 'never a death screen');
    await frame(1000);
    assert.equal(rec().mem[ME].alive, 0);
    assert.equal(rec().mem[ME].wit, 1);
    assert.equal(rec().end, 'wipe');
    assert.equal(asked.leave, 0, 'not walked out while the end\'s words stand');
    const x = asked.claim.map(readEgReceipt).find((c) => c.q === 'x');
    assert.ok(x && x.why === 'wipe', 'my end receipt carried');
    for (let i = 0; i < 20 && asked.leave === 0; i++) await frame(500);
    assert.equal(asked.leave, 1, 'the end walks me out - once');
    assert.equal(client.witnessing(), false);
    assert.ok(said.length > 0);
  });
});

test('EG-PLAY THE REHEARSAL, AND THE REFUSALS: /breach rehearse opens with no key (the order\'s `rh`), its end the Rehearsal\'s words; the service\'s refusals in the Spire\'s words; a kept receipt dropped once the service has counted it or refused it for good, kept while it is offline (mutants: the Rehearsal staking a key; a refusal said as the embers\' words; an offline claim dropped)', async () => {
  await withPlay(async (P) => {
    const { client, asked, settle, said } = P;
    client.command('rehearse');
    await settle();
    assert.equal(asked.open[0].rh, true);
    assert.equal(P.rec().rh, 1, 'the breach is a Rehearsal');
    assert.match(said.find((t) => /Rehearsal rises/.test(t)) ?? '', /Your Rehearsal rises/);
  });
  assert.equal(egRefusalText('short'), EG_TEXT.noKeys);
  assert.equal(egRefusalText('live'), EG_TEXT.held);
  assert.match(egRefusalText('unproven'), /^The Spire opens only to those who have closed a Dagon's Breach\.$/);
  assert.match(egRefusalText('unproven'), /closed a Dagon's Breach\./);   // PIN MOVED (VOICE2): the sentence whole, no dash aside (Voice.md rule 5)
  assert.equal(egRefusalText('anything-else'), EG_TEXT.shut);
  assert.equal(egClaimDone({ ok: true, data: { recorded: false, why: 'claimed' } }), true);
  assert.equal(egClaimDone({ ok: false, error: 'receipt' }), true);
  assert.equal(egClaimDone({ ok: false, error: 'offline' }), false);
  assert.equal(egClaimDone({ ok: false, error: 'server' }), false);
});

test('EG-PLAY THE KEYS\' FACE: the balance the service says restacks the pack - one stack of n, or none; a Rampart\'s portcullis stands closed until its hall\'s door opens or the company is past it (mutants: the pack never restacked; the gate open through the trial)', async () => {
  await withPlay(async (P) => {
    const { client, entity } = P;
    client.restack(3);
    assert.equal(weirKeysHeld(entity.items), 3);
    assert.equal(entity.items.filter(isWeirKey).length, 1);
    client.restack(0);
    assert.equal(weirKeysHeld(entity.items), 0);
    const st = (h, sg) => { const L = client.link; L.word({ k: 'st', b: B, seed: 1, egv: 1, op: T0, wk: 0, h, sg, sa: 0, su: 0, cl: 0, ca: 0, hw: 0, dn: 0, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]], rd: 0, rh: 0, dg: 0, end: null }); };
    st(4, 'trial'); assert.equal(client.gateOpen(4), false, 'through the trial, shut');
    st(4, 'arrive'); assert.equal(client.gateOpen(4), false);
    st(4, 'closing'); assert.equal(client.gateOpen(4), true, 'its door open, the gate up');
    st(5, 'arrive'); assert.equal(client.gateOpen(4), true, 'the company past it');
    st(3, 'trial'); assert.equal(client.gateOpen(4), false, 'a hall ahead');
  });
});

test('EG-PLAY THE TRACKER: outside, the call for my company - when it opens, then how long it takes members and the word to answer; inside, THE COUNT (gold while it holds, red under five minutes), the circle and the hall by name, what the stage asks, how many stand; nothing for a stranger or once the call is past (mutants: the count never red; a stranger shown the call)', () => {
  const call = { k: 'call', b: B, o: 'Ann', os: 'acct-ann', seed: 7, op: T0, rh: 0, co: [[ME, 'Mac', 1], ['acct-ann', 'Ann', 2]], site: SITE };
  const E = { ...EG_STATE_EMPTY, call, b: B, seed: 7, h: 0, sg: 'wait', co: [] };
  const sealed = egHudModel(E, ME, T0 + 60_000);
  assert.match(sealed.title, /Ann opens an Elite Breach/);
  assert.equal(sealed.line, 'The breach opens in 4:00.');
  const open = egHudModel(E, ME, T0 + EG_SEALED_MS + 30_000);
  assert.equal(open.line, 'Answer the call - 4:30');
  assert.equal(open.sub, 'Answer the call to step through.');   // PIN MOVED (AUDIT EG V, c: L7-20 - the prompt answers it, Enter, the pad's A, a tap or /breach; no line tells a screen in hand to type)
  assert.equal(egHudModel(E, 'acct-stranger', T0 + 60_000), null, 'a stranger is shown nothing');
  assert.equal(egHudModel(E, ME, T0 + 11 * 60_000), null, 'the call past');
  const inside = { ...E, h: 3, sg: 'trial', wk: T0, cl: 20 * 60_000, ca: T0 + 1000, op: T0, co: [[ME, 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-ann', 'Ann', 2, 0, 0, 1, 1, 0, 1, 1]], rd: 0, rh: 0 };
  const m = egHudModel(inside, ME, T0 + 61_000, { inSpire: true });
  assert.equal(m.title, `Circle 1 - Hall 3: ${egHallOf(7, 3).name}`);
  assert.equal(m.count, '19:00');
  assert.equal(m.countCls, 'gold', 'gold while it holds past ten minutes');
  assert.equal(m.line, egHallOf(7, 3).objective);
  assert.match(m.company, /^1 of 2 standing\n/);
  assert.match(m.company, /Ann.*(watching|witness)/i, 'a fallen companion watches');
  assert.match(m.run, /potions 2\/2/, 'THE POTION LAW\'s pip');
  assert.equal(egHudModel({ ...inside, ca: T0 }, ME, T0 + 20 * 60_000 - 9 * 60_000, { inSpire: true }).countCls, '');
  assert.equal(egHudModel({ ...inside, ca: T0 }, ME, T0 + 20 * 60_000 - EG_HUD_LOW_MS + 1000, { inSpire: true }).countCls, 'low');
  assert.equal(egHudModel({ ...inside, ca: 0 }, ME, T0, { inSpire: true }).countCls, 'held');
  assert.equal(egHudModel({ ...inside, wk: 0, sg: 'arrive', su: T0 + 8000 }, ME, T0, { inSpire: true }).count, '30:00', 'thirty minutes before the first wake');
  assert.equal(EG_COUNT_START_MS, 30 * 60_000);
  assert.match(egHudModel({ ...inside, sg: 'rest', rd: 1, su: T0 + 60_000 }, ME, T0, { inSpire: true }).line, /^Redoubt 1/);
});

test('EG-PLAY THE SPANS: every step of a circle stood as a moving bucket where the law has it; the step I stand on carries me; a Crumble falls under my foot and is gone; a body fallen EG_VOID_Y below the floor it last stood on is cast back to it (mutants: the void never casting back; a drift never carrying)', () => {
  const seed = 0x51ee, specs = egCircleSpecs(seed, 1);
  const added = new Map(), draws = [];
  const collider = { addMesh: (key, p, i, m, T) => added.set(key, T) };
  const span = createEgSpan({ seed, c: 1 });
  assert.equal(span.stand({ dynamicDraws: draws, collider }), true);
  assert.equal(span.stand({ dynamicDraws: draws, collider }), false, 'once');
  // every step a bucket - and (EG-FULL LAYERS TWO and THREE) every Falling Wall and Collapsing Tube segment, each of
  // Grath's islands, each false wall
  const all = specs.reduce((n, s) => n + s.steps.length, 0) + span.walls.length + span.tubes.length + span.isles.length + span.seals.length;
  assert.equal(added.size, all, 'every step a bucket');
  assert.equal(span.isles.length, specs.find((s) => s.kind === 'court')?.lord === 'hound' ? 3 : 0, 'Grath\'s three islands stand as buckets');
  // on the floor: the cast-back's place set
  const floorAt = realmToDungeon(0, 0, 1.5);
  const body = { pos: [...floorAt], grounded: true, groundKey: EG_FLOOR_KEY, carried: [0, 0, 0], carryBy(dx, dy, dz) { this.carried[0] += dx; this.carried[1] += dy; this.carried[2] += dz; } };
  assert.equal(span.ride(10, 0.016, body, true), null);
  assert.deepEqual(span.safe(), floorAt);
  // falling: past EG_VOID_Y under it, cast back
  body.grounded = false; body.groundKey = null; body.pos = [floorAt[0], floorAt[1] + EG_VOID_Y - 1, floorAt[2]];
  const back = span.ride(10.1, 0.016, body, true);
  assert.ok(back && Math.abs(back[1] - (floorAt[1] + 0.2)) < 1e-9 && back[0] === floorAt[0], 'cast back to the floor it last stood on');
  // a drift carries
  const drift = specs.flatMap((s) => s.steps.map((st) => ({ s, st }))).find((q) => q.st.kind === 'drift');
  assert.ok(drift, 'the first circle has a Drift');
  const key = egStepKey(drift.s.h, drift.st.i);
  const db = { pos: [...floorAt], grounded: true, groundKey: key, carried: [0, 0, 0], carryBy(dx, dy, dz) { this.carried[0] += dx; } };
  span.ride(20, 0.016, db, true);
  span.ride(20.5, 0.5, db, true);
  assert.ok(Math.abs(db.carried[0]) > 1e-4, 'the Drift carried me with it');
  // a crumble under my foot falls and is gone
  const cr = specs.flatMap((s) => s.steps.map((st) => ({ s, st }))).find((q) => q.st.kind === 'crumble');
  if (cr) {
    const ck = egStepKey(cr.s.h, cr.st.i), cb = { pos: [...floorAt], grounded: true, groundKey: ck, carryBy() {} };
    span.ride(30, 0.016, cb, true);
    span.ride(33, 0.016, { pos: [...floorAt], grounded: false }, true);
    assert.equal(span.steps.find((q) => q.key === ck).solid, false, 'gone under my foot');
  }
  span.clear();
});

test('EG-PLAY THE MADE LEVEL: one circle a location the dungeon arm takes (a made id, one block, its start marker on the first hall\'s arrival plate); the halls\' mesh and collider build finite; a Rampart\'s portcullis its own part; the hall frame and the dungeon\'s are inverse (mutants: the start marker off the plate; a NaN in the mesh)', () => {
  const loc = egHallLocation({ b: B, seed: 99, c: 1 });
  assert.equal(isEgHall(loc), true);
  assert.equal(isEgHall({ ...loc, egBreach: 5 }), false);
  assert.equal(loc.dungeon.blocks[0].blockName, EG_HALL_BLOCK);
  const mk = egHallBlock().rdbBlock.objectRootList[0].rdbObjects[0];
  const [sx, , z] = dungeonToRealm(mk.xPos / 40, 0, mk.zPos / 40);
  assert.ok(egOnArrive(egHallOf(99, 1), sx, z, 0), 'the start marker stands on Hall 1\'s plate');
  for (const c of [1, 2]) {
    const m = buildEgCircleModel(99, c);
    assert.ok(m.positions.length > 0 && m.positions.every(Number.isFinite), `circle ${c}'s mesh is finite`);
    assert.ok(m.subMeshes.length > 0);
    const tris = egCircleColliderTris(99, c);
    assert.ok(tris.length > 0 && tris.length % 9 === 0 && tris.every(Number.isFinite));
  }
  const ramp = egCircleSpecs(99, 1).find((s) => s.kind === 'rampart');
  const parts = egGateParts(ramp);
  assert.ok(parts && parts.tris.length % 9 === 0, 'the Rampart\'s portcullis');
  assert.equal(egGateParts(egCircleSpecs(99, 1).find((s) => s.kind === 'yard')), null);
  const spec = egHallOf(99, 3), p = egToDungeon(spec, 4.5, 1, 30);
  assert.deepEqual(egFromDungeon(spec, p).map((v) => Math.round(v * 1000) / 1000), [4.5, 1, 30]);
});

test('EG-PLAY THE GATE\'S SEAMS IN A HALL, EXECUTED (scenes/worldModes.js, its own source run): inside an Elite Breach\'s circle the dungeon host\'s six gate seams answer the hall\'s fight and the billboards carry its bodies; in any other dungeon, and outside, each is the gate\'s own as it was (mutant: the seams the gate\'s alone)', () => {
  const M = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const from = M.indexOf("  for (const [gate, eg] of [['gateBoss', 'egBoss']"), to = M.indexOf('\n', M.indexOf('  { const own = host.extraBillboards;'));
  assert.ok(from > 0 && to > from, 'the routing found');
  const stand = new Function('host', 'isEgHall', `let mode = 'exterior', dungeonLoc = null;\n${M.slice(from, to)}\nreturn (m, l) => { mode = m; dungeonLoc = l; };`);
  const host = {
    gateBoss: () => 'the gate\'s boss', egBoss: () => 'the hall\'s foe',
    onBossHit: (h) => `gate hit ${h.d}`, egBossHit: (h) => `hall hit ${h.d}`,
    gateCrystals: () => ['crystal'], egRifts: () => ['rift'],
    onCrystalHit: () => 'crystal hit', egRiftHit: () => 'rift hit',
    gateHost: () => ['add'], egHost: () => ['harrier'],
    onHostHit: () => 'add hit', egHostHit: () => 'harrier hit',
    extraBillboards: () => ['peer'], egBatches: () => ['kynreeve'],
  };
  const at = stand(host, (l) => !!l?.egBreach);
  const seen = () => [host.gateBoss(), host.onBossHit({ d: 7 }), host.gateCrystals(), host.onCrystalHit({}), host.gateHost(), host.onHostHit({}), host.extraBillboards()];
  at('dungeon', { egBreach: B });
  assert.deepEqual(seen(), ['the hall\'s foe', 'hall hit 7', ['rift'], 'rift hit', ['harrier'], 'harrier hit', ['peer', 'kynreeve']]);
  at('dungeon', { name: 'a court' });
  assert.deepEqual(seen(), ['the gate\'s boss', 'gate hit 7', ['crystal'], 'crystal hit', ['add'], 'add hit', ['peer']]);
  at('exterior', { egBreach: B });
  assert.deepEqual(seen(), ['the gate\'s boss', 'gate hit 7', ['crystal'], 'crystal hit', ['add'], 'add hit', ['peer']], 'outside, the gate\'s whatever the location says');
});

test('EG-PLAY THE HOSTS WIRED: the world host builds the client online and hears the breach\'s words on both sockets, keys the breach\'s room, steps it every online frame, routes the death, the Levitate ward, the court\'s law, the companions, Mark and Recall and /unstuck; the mode machine routes the gate\'s seams to the hall\'s fight and stands the level, its light and its way home; the dungeon host refuses saves, maps and rests and rides the spans (mutants: any seam unwired)', () => {
  const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const M = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const D = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const E = readFileSync(new URL('../../../src/characters/playerEntity.js', import.meta.url), 'utf8');
  assert.match(W, /const egClient = params\.has\('online'\) \? createEgClient\(\{/);
  assert.match(W, /online\.onEg = \(w, room\) => egClient\?\.word\(w, room\);/);
  assert.match(W, /if \(tab\.room === SOCIAL_ROOM\) link\.onEg = \(w, room\) => egClient\?\.word\(w, room\);/);
  assert.match(W, /else if \(modes\?\.roomIdentity\?\.\(\)\?\.kind === 'eg'\) key = egRoomKey\(modes\?\.roomIdentity\?\.\(\)\?\.b\);/);
  assert.match(W, /\n {4}egFrame\(\);/);
  assert.match(W, /const diedInSpire = madeRuleHere\('death'\) === 'fall';/);   // PIN MOVED (EG-H2): a death in the Spire is the made level's law's - a fall (systems/madeLevel.js)
  assert.match(W, /if \(diedInSpire\) \{[^\n]*\n {8}modes\?\.forceExitToExterior\(\);\n {8}if \(spireBack && egLandAt\(spireBack\)\)/);
  // PIN MOVED (EG-H2, Elite-Gates.md section 24): every per-level door asks the made level's law - the Spire's Levitate ward
  // OR'd into the ONE ward (section 10.7), the court's law the frame's one setCourtRules, the companions kept out, Mark and
  // Recall refused in the Spire's words; the law's own rows pinned here and in test/systems/eliteGates/egmade_law.test.js
  assert.match(W, /registerLevitateWard\(\(\) => inSiegeRoom\(\) \|\| madeRuleHere\('levitate'\) === 'banned'\);/);
  assert.match(W, /setCourtRules\(madeRuleHere\('regen'\) === 'off'\);/);
  assert.match(W, /if \(madeRuleHere\('companions'\) === 'out'\) return null;/);
  assert.match(W, /if \(madeRuleHere\('companions'\) === 'out'\) return \[\];/);
  assert.match(W, /if \(madeRuleHere\('mark'\) === 'refused'\) \{ madeSay\('mark'\); return; \}/);
  assert.match(W, /if \(madeRuleHere\('recall'\) === 'refused'\) \{ madeSay\('recall'\); return; \}/);
  for (const [rule, want] of [['levitate', 'banned'], ['regen', 'off'], ['companions', 'out'], ['mark', 'refused'], ['recall', 'refused'], ['save', 'refused'], ['automap', 'off'], ['rest', 'refused']]) assert.equal(madeLevelRule('spire', rule), want, rule);
  assert.equal(madeLevelSays('spire', 'mark'), EG_TEXT.noRecall, 'the Spire holds you');
  assert.match(W, /\{ const arg = breachCommandOf\(text\); if \(arg != null\) \{/);   // PIN MOVED (AUDIT EG V, c: L7-1 - the one-word door read every two-word /breach command as no command; its words whole, net/chatCommands.js breachCommandOf)
  assert.match(W, /egClient\?\.claimKeys\(\);/);
  assert.match(W, /claim: \(r\) => _accountSds\.claim\(r\)\.then\(weirHeard\),/);
  assert.match(W, /weirHeard\(a\);/);
  assert.doesNotMatch(E, /export function registerSpireLevitateWard/, 'PIN MOVED (EG-H2): the second seam retired - one ward, the made level\'s law OR\'d into it');
  assert.match(M, /for \(const \[gate, eg\] of \[\['gateBoss', 'egBoss'\], \['onBossHit', 'egBossHit'\], \['gateCrystals', 'egRifts'\], \['onCrystalHit', 'egRiftHit'\], \['gateHost', 'egHost'\], \['onHostHit', 'egHostHit'\]\]\)/);
  assert.match(M, /if \(hit\.egHall\) standEgHall\(ctx, hit\.egHall\);/);
  assert.match(M, /isEgHall\(dungeonLoc\) \? \{ kind: 'eg', b: dungeonLoc\.egBreach \}/);
  assert.match(M, /if \(isEgHall\(dungeonLoc\)\) \{ host\.egWayHome\?\.\(\); return true; \}/);
  assert.match(M, /if \(isEgHall\(dungeonLoc\)\) host\.drawEgFight\?\.\(\{ proj, view, eye: mwv\.eye \}\);/);
  assert.match(M, /egLeave: \(\) => \{ if \(mode !== 'dungeon' \|\| !isEgHall\(dungeonLoc\) \|\| !dungeonCtx\) return false; pendingDungeonExit = true; return true; \},/);
  assert.match(M, /if \(egBack && egPlace\(egBack\)\) host\.egCastBack\?\.\(\);/);
  // PIN MOVED (EG-H2): the dungeon host's refusals are the made level's law's, each in its level's own words
  assert.match(D, /if \(madeLevelRule\(_made, 'automap'\) === 'off'\) \{ hudText\.add\(madeLevelSays\(_made, 'automap'\)\); return; \}/);
  assert.match(D, /if \(madeLevelRule\(_made, 'rest'\) === 'refused'\) \{ hudText\.add\(madeLevelSays\(_made, 'rest'\)\); return; \}/);
  assert.match(D, /if \(madeLevelRule\(_made, 'save'\) === 'refused'\) \{ if \(!quiet\) hudText\.add\(madeLevelSays\(_made, 'save'\)\); return false; \}/);
  assert.match(D, /egSpanRide\(dt, body, live = true\) \{ return egSpanRide\(dt, body, live\); \},/);
});
