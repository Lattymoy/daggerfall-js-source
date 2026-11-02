// EG-ZD (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 22, 16.5, 10.8, 13.2,
// 26 and 27.8): BACK INTO THE SPIRE, AND THE FALL - THE WAY BACK (scenes/eliteGates/egClient.js: a reload or a dropped connection, the
// account service's `live`, *Return to the Spire*, never refused as late, the circle the company holds, my last island)
// played against the real relay (test/fakeRoom.mjs - the room re-admits a member it counts, net/eliteGates/egBrain.js egAdmitWord);
// THE FALL (ui/eliteGates/egSpireHud.js egFallModel and drawEgFall, the client's sinking eye); THE SPANS' CLOCK (egClient
// spanSeconds/breachNow, scenes/world.js deadlandsSeconds/egNow); THE FEINT'S DASHED FADE (scenes/eliteGates/egFight.js,
// render/gate/gateTelegraph.js uLook 4); THE PAD reaching the Surplus's two buttons; THE BEATS ON THE CRITICAL BUS (systems/
// egMix.js `beat`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../../fakeRoom.mjs';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import { EG_INTERNAL_OPEN, validEgOut, validEgIn, EG_BRAIN_V } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egTimes, EG_SEALED_MS, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { egSupportAt, EG_HOLD } from '../../../src/net/eliteGates/egFair.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { createEgClient, egBackOf, EG_BACK_KEY, EG_BACK_TEXT, EG_BACK_WRITE_MS, EG_SPAN_REANCHOR_MS, EG_WITNESS_BACK } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight, egLookShapes, EG_FEINT_FADE_MS } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgCallPrompt } from '../../../src/scenes/eliteGates/egCall.js';
import { egFallModel, egDitherCells, egDitherCss, drawEgFall, destroyEgSpireHud, EG_FALL_MS, EG_FALL_SINK_MS, EG_FALL_CARD_MS, EG_FALL_DITHER_MS, EG_FALL_SINK_M, EG_FALL_SAT, EG_FALL_TEXT } from '../../../src/ui/eliteGates/egSpireHud.js';
import { EG_BEAT_SOUNDS } from '../../../src/ui/eliteGates/egBeats.js';
import { drawEgPanel, egPanelModel, destroyEgHud } from '../../../src/ui/eliteGates/egHud.js';
import { egAccessNow, EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { createSpireMix } from '../../../src/systems/eliteGates/egMix.js';
import { EG_LOOK_BIT } from '../../../src/world/eliteGates/egLook.js';
import { TELEGRAPH_FS_SPIRE, TELEGRAPH_KIND, TELEGRAPH_EDGE_DAGON } from '../../../src/render/gate/gateTelegraph.js';
import { TELL_FEINT_FADE } from '../../../src/ai/blowShapes.js';
import { EG_V_BY_KEY, EG_VESTIGES } from '../../../src/net/eliteGates/egVestige.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const ME = 'acct-mac';
const SEED = 4242;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const CO = [[ME, 'Mac', 1], ['acct-ann', 'Ann', 2]];
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const tick = () => new Promise((r) => setImmediate(r));
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const r2 = (v) => Math.round(v * 100) / 100;

/** Still ground (an island, net/eliteGates/egFair.js) on hall `spec`, at least 2 m from its arrival plate's heart - a last island. */
function islandOf(spec) {
  const a = spec.arrive;
  for (let d = 2; d < 30; d += 0.5) {
    for (const [dx, dz] of [[0, d], [d, 0], [-d, 0], [0, -d]]) {
      const x = a.x + dx, z = a.z + dz;
      for (const y of [a.y, spec.fight?.y ?? a.y]) if (egSupportAt(spec, x, y, z, 0) === EG_HOLD.island) return { x, y, z };
    }
  }
  return null;
}

/**
 * THE WAY BACK'S STAGE: a breach's room opened by its own internal door for a company of two (Ann never comes, so Hall 1's
 * arrival stands until the open window ends), my client between it and an account service whose keys answer says my live
 * breach once I am admitted. `reload(store)` is a page reloaded: the room's socket dropped, the page outside, a new client
 * over `store` (the device's).
 */
async function withReturn(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const eg = fakeRoom(egRoomKey(B), { now: () => clock });
  const said = [], mids = [], asked = { admit: [], enter: [], place: [], exits: 0, lands: [], keys: 0, looks: [] };
  const entity = { level: 20, health: 90, maxHealth: 100, magicka: 0, maxMagicka: 40, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(SITE.x, 0, SITE.z) };
  const from = { pos: [1, 2, 3], normal: [0, 0, 1] };
  let mode = 'exterior', hall = null, ws = null, live = null, seen = 0;
  const modes = {
    get mode() { return mode; },
    get stepping() { return false; },
    egHallBreach: () => (mode === 'dungeon' && hall ? hall.b : null),
    egHallCircle: () => (mode === 'dungeon' && hall ? hall.c : null),
    stepThroughFire: async (go, look) => { asked.looks.push(look); return go(); },   // MERGED WITH EG-ZE: which veil each step is under
    enterEgHall: (r) => { if (mode !== 'exterior') return false; asked.enter.push(r); mode = 'dungeon'; hall = r; player.pos = realmToDungeon(0, 0, 1.5); return true; },
    egPlace: (at) => { asked.place.push(at); player.pos = [...at]; return true; },
    egLeave: () => { mode = 'exterior'; hall = null; return true; },
    egHallReturn: () => (mode === 'dungeon' ? from : null),
    forceExitToExterior: () => { asked.exits++; mode = 'exterior'; hall = null; },
    get dungeonCtx() { return mode === 'dungeon' ? { exitDoors: [] } : null; },
  };
  const pending = [];
  const presence = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) }); if (!w || !ws || mode !== 'dungeon') return false; pending.push(eg.raw(ws, JSON.stringify({ t: 'eg', ...w }))); return true; } };
  let inflight = 0;
  const track = (f) => async (...a) => { inflight++; try { return await f(...a); } finally { inflight--; } };
  const account = {
    me: () => ME, guest: () => false,
    keys: track(async () => { asked.keys++; return { ok: true, data: { keys: 1, live } }; }),
    admit: track(async (b) => { asked.admit.push(b); live = { b, until: Math.floor(clock / 1000) + 3 * 3600 }; return { ok: true, data: { order: await mintEgOrder({ o: 'egadmit', s: ME, eb: b, ez: 'a'.repeat(20) }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b } }; }),
    claim: track(async () => ({ ok: false, error: 'server' })),
  };
  const makeClient = (store) => createEgClient({ modes: () => modes, online: () => presence, hub: () => null, account, now: () => clock, entity, player, cam: { pos: [0, 1.6, 0], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({ climateBase: 2, season: 0 }), wire: () => SITE, landAt: (l) => { asked.lands.push(l); return true; }, hurt: (n) => { entity.health -= n; }, store });
  let store = memStore();
  let client = makeClient(store);
  const pump = () => { if (!ws) return; for (; seen < ws.sent.length; seen++) { const m = ws.sent[seen]; if (m.t === 'eg') { const v = validEgOut(m); if (v) client.word(v); } } };
  const settle = async () => { for (let q = 0, k = 0; k < 5000 && q < 3; k++) { await tick(); const busy = inflight > 0 || pending.length > 0; await Promise.all(pending.splice(0)); pump(); q = busy ? 0 : q + 1; } };
  const beat = async (ms) => { const end = clock + Math.round(ms); while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); pump(); } clock = end; };
  const pose = () => { const [x, y, z] = player.pos; return { x, y, z, yaw: 0, pitch: 0 }; };
  const frame = async (ms = 300) => { client.frame(); await settle(); if (ws && mode === 'dungeon') await eg.pose(ws, pose()); await beat(ms); pump(); await settle(); };
  const enter = async () => { ws = eg.connect(); seen = 0; await eg.hello(ws, 'peer-mac', pose(), { kind: 'linked', tokenSub: ME, charLevel: 20 }); pump(); await settle(); };
  const reload = async (st = store) => { if (ws) { await eg.drop(ws); ws = null; } seen = 0; mode = 'exterior'; hall = null; player.pos = realmToDungeon(SITE.x, 0, SITE.z); store = st; client = makeClient(st); };
  const call = () => validEgOut({ k: 'call', b: B, o: 'Mac', os: ME, seed: SEED, op: T0, rh: 0, co: CO, site: SITE, ew: 0, wg: [] });
  try {
    await quiet(async () => {
      const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: SEED, op: T0, co: CO, site: SITE }) }));
      assert.equal(res.status, 200);
      clock += EG_SEALED_MS; await beat(1000);
      await fn({ get client() { return client; }, get store() { return store; }, said, mids, asked, player, entity, settle, frame, enter, reload, call, beat, rec: () => eg.room._eg, now: () => clock, step: (ms) => { clock += ms; }, standAt: (sx, z, y = 0) => { player.pos = realmToDungeon(sx, y, z); } });
    });
  } finally { Date.now = realNow; }
}

test('EG-ZD THE WAY BACK, ON THE RELAY (section 22, slice EG10): a counted member\'s page reloaded mid-breach is offered *Return to the Spire* once the service\'s keys answer says the breach lives - its strip says Return - and answering asks no new order and no admission: a hello as an entrant, the room re-admitting a member it counts; between trials it stands me on the hall\'s arrival plate; in a trial, past the open window and with the old call held, it is NEVER refused as late and resumes me on my last island; a record whose seed is not the room\'s is taken back too, the circle rebuilt in place once the room says its seed (mutants: `live` unread; the record unkept; the late refusal kept; a new admission asked; the plate for the island; the seed never checked)', async () => {
  await withReturn(async (P) => {
    const { said, asked, rec } = P;
    // the first step in - the call answered in its window, the room's count of me
    P.client.word(P.call());
    await P.frame(0);
    P.client.command('');
    await P.settle();
    assert.deepEqual(asked.admit, [B], 'the first answer is admitted');
    assert.equal(asked.enter.length, 1);
    await P.enter();
    await P.frame(300); await P.frame(300);
    assert.equal(rec().mem[ME]?.in, 1, 'counted by the room');
    const kept = egBackOf(P.store.getItem(EG_BACK_KEY));
    assert.deepEqual([kept.b, kept.seed, kept.in, kept.h], [B, SEED, 1, 1], 'THE WAY BACK kept on the device: the breach, its seed, my count, the hall');
    const zs = rec().zs.length;

    // A RELOAD BETWEEN TRIALS (Hall 1's arrival stands for Ann): the page boots outside, a new client over the device's record
    await P.reload();
    assert.equal(P.client.returnable(), false, 'nothing offered before the service has answered');
    await P.frame(300); await P.frame(300); await P.frame(300);
    assert.equal(said.filter((t) => t === EG_BACK_TEXT.offer).length, 1, 'offered once');
    assert.deepEqual(P.client.promptModel(), { text: EG_BACK_TEXT.prompt, answerable: true, button: EG_BACK_TEXT.button, left: 0 }, 'the strip says Return');
    P.client.command('');
    await P.settle();
    assert.deepEqual(asked.admit, [B], 'no admission asked again');
    assert.deepEqual([asked.enter.at(-1).b, asked.enter.at(-1).seed, asked.enter.at(-1).c], [B, SEED, 1], 'into the circle of the hall my record stood in');
    assert.ok(said.includes(EG_BACK_TEXT.back));
    const places = asked.place.length;
    await P.enter();
    assert.equal(rec().mem[ME].in, 1);
    await P.frame(300);
    assert.equal(rec().zs.length, zs, 'no order spent: a hello as an entrant');
    assert.equal(P.client.state().sg, 'arrive');
    assert.ok(asked.place.length > places, 'stood');
    const s1 = egHallOf(SEED, 1, 0), plate = egToDungeon(s1, s1.arrive.x, s1.arrive.y + 0.1, s1.arrive.z);
    assert.deepEqual(asked.place[places].map(r2), plate.map(r2), 'between trials: the hall\'s arrival plate');

    // THE TRIAL: the open window ends with Ann never come, the hall wakes; I walk to still ground - my last island
    for (let i = 0; i < 80 && rec().sg !== 'trial'; i++) await P.frame(5000);
    assert.equal(rec().sg, 'trial');
    assert.ok(P.now() >= egTimes({ openedAt: T0 }).admitUntil, 'past the open window');
    const isle = islandOf(s1);
    assert.ok(isle, 'still ground on Hall 1');
    await P.frame(300);   // the plate my first island of the trial
    P.standAt(s1.x0 + isle.x, isle.z, isle.y);
    await P.frame(300);   // a second within the write's spacing - kept for the next
    P.step(EG_BACK_WRITE_MS); await P.frame(300);
    assert.deepEqual(egBackOf(P.store.getItem(EG_BACK_KEY)).li.map(r2), [1, isle.x, isle.y, isle.z].map(r2), 'my last island on the record');

    // A RELOAD IN THE TRIAL, the old call still held: never late, resumed on the island
    await P.reload();
    await P.frame(0); await P.frame(0);
    P.client.word(P.call());
    said.length = 0;
    P.client.command('');
    await P.settle();
    assert.ok(!said.includes(EG_TEXT.late('Mac')), 'never refused as late');
    assert.deepEqual(asked.admit, [B]);
    const at = asked.place.length;
    await P.enter();
    await P.frame(0);
    assert.ok(asked.place.length > at);
    const [sx, sy, sz] = dungeonToRealm(...asked.place[at]);
    assert.deepEqual([r2(sx - s1.x0), r2(sy - 0.1), r2(sz)], [isle.x, isle.y, isle.z].map(r2), 'resumed on my last island, not the plate');
    assert.ok(asked.looks.length > 0 && asked.looks.every((l) => ['egFall', 'egVeil', 'egCut'].includes(l)), `the way back under the stair's veil, never the Hour's (${asked.looks})`);   // MERGED WITH EG-ZE
    assert.equal(rec().mem[ME].alive, 1, 'and counted alive');

    // A RECORD WHOSE SEED IS NOT THE ROOM'S (one another build wrote): the circle stood from it, rebuilt once the room says
    // its seed. PIN MOVED (EG-ZM): this was a device with no record, which now waits under the veil for the room's first
    // word and stands the room's circle at once - test/net/eliteGates/egz_ends_return.test.js
    const stale = memStore();
    stale.setItem(EG_BACK_KEY, JSON.stringify({ b: B, seed: SEED + 1, op: T0, geo: 0, ew: 0, rh: 0, h: 1, in: 1, li: null, wf: 0 }));
    await P.reload(stale);
    await P.frame(0); await P.frame(0);
    assert.ok(said.includes(EG_BACK_TEXT.offer));
    assert.equal(P.client.useKey(), EG_BACK_TEXT.back, 'the key\'s use takes me back too');
    await P.settle();
    assert.equal(asked.enter.at(-1).seed, SEED + 1, 'the record\'s seed');
    await P.enter();
    await P.frame(0); await P.frame(0);
    assert.equal(asked.enter.at(-1).seed, SEED, 'rebuilt from the room\'s seed');
    assert.ok(asked.exits >= 1);
    const now = egBackOf(P.store.getItem(EG_BACK_KEY));
    assert.deepEqual([now.seed, now.in, now.h], [SEED, 1, 1], 'kept from here on this device');
  });
});

/** A client inside a breach of two at hall `h`'s `sg`, its words the director's own (test/net/eliteGates/egfull_client.test.js's
 *  harness), with a store, an audio stub, a music stub for the fight's mix when `withFight`. */
function inBreach({ h = 2, sg = 'trial', store = null, withFight = false, keysLive = null, said0 = true } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = h; Br.sg = sg; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], said = [], mids = [], played = [], ducked = [], keysAsked = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  let inside = true;
  const entered = [];
  const modes = { get mode() { return inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (inside ? Br.b : null), egHallCircle: () => Math.ceil(h / 5), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => go(), enterEgHall: (r) => { entered.push(r); inside = true; return true; } };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  let peers = [];
  const st = store ?? memStore();
  const audio = { playOneShot: (rec, vol, pitch) => played.push({ rec, vol, pitch }), play3d: () => {} };
  const music = { duck: (db, s) => ducked.push([db, s]) };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null,
    account: { me: () => ME, guest: () => false, keys: async () => { keysAsked.push(clock); return keysLive === false ? { ok: false } : { ok: true, data: { keys: 1, live: keysLive } }; } }, now: () => clock, entity, player, cam: { pos: [3, 1.6, 4], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { entity.health -= n; }, peers: () => peers, store: st, audio,
    win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    ...(withFight ? { fight: (link) => createEgFight({ link, now: () => clock, music, audio, me: () => ME, player: () => entity }) } : {}) });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  if (said0) tell(egStateOf(Br, clock));
  const spec = egHallOf(77, h, 0);
  if (spec.arrive) player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B: Br, entity, player, sent, said, mids, played, ducked, keysAsked, online, tell, spec, store: st, entered, step: (ms) => { clock += ms; }, now: () => clock, setPeers: (p) => { peers = p; }, out: () => { inside = false; } };
}

test('EG-ZD THE WAY BACK\'S RECORD (section 22): read off the device strictly; kept as the room says it; let go at the end, at my way home, at forsaking and when the room refuses me back - kept when a socket is merely lost, the service asked again at once; a record of another breach (or of none) let go on the service\'s word; a call still open to a member the room never counted is the call\'s own door, never the way back; the strip\'s button takes the way back\'s word (mutants: the end keeping it; a refusal keeping it; a lost socket letting it go; the call\'s window ignored; the strip\'s word fixed)', async () => {
  assert.deepEqual(egBackOf({ b: B, seed: 77, op: T0, geo: 2, ew: 5, rh: 1, h: 7, in: 1, li: [7, 1.5, 0, 22], wf: 1 }), { b: B, seed: 77, op: T0, geo: 2, ew: 5, rh: 1, h: 7, in: 1, li: [7, 1.5, 0, 22], wf: 1 });
  assert.equal(egBackOf('{"b":"nothex"}'), null);
  assert.equal(egBackOf('not json'), null);
  assert.equal(egBackOf(null), null);
  assert.equal(egBackOf({ b: B, x: 1 }), null, 'a breach marked over is none');
  assert.deepEqual(egBackOf({ b: B, seed: -4, h: 1.5, in: 2, li: [0, 1, 2, 3] }), { b: B, seed: 0, op: 0, geo: 0, ew: 0, rh: 0, h: 0, in: 0, li: null, wf: 0 }, 'every field held to its shape');
  // kept as the room says it, and let go at the end
  const P = inBreach();
  P.client.frame();
  assert.deepEqual((({ b, seed, in: i, h }) => [b, seed, i, h])(egBackOf(P.store.getItem(EG_BACK_KEY))), [B, 77, 1, 2]);
  P.B.end = 'wipe'; P.tell(egStateOf(P.B, P.now())); P.client.frame(); P.client.frame();
  assert.equal(P.client.backRecord(), null, 'and never kept again while the end stands');
  assert.ok(!egBackOf(P.store.getItem(EG_BACK_KEY)), 'the device let go of it');
  // home and forsaking
  for (const k of ['home', 'forsaken']) {
    const Q = inBreach();
    Q.client.frame();
    assert.ok(Q.client.backRecord());
    Q.B.mem[ME][k] = 1; if (k === 'forsaken') Q.B.mem[ME].alive = 0;
    Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame(); Q.client.frame();
    assert.equal(Q.client.backRecord(), null, `${k}: let go`);
  }
  // the room refusing me back lets it go; a lost socket keeps it and asks the service again at once
  const R = inBreach();
  R.client.frame();
  R.online.terminal = true; R.online.error = 'the breach is closed';
  R.client.frame();
  assert.equal(R.client.backRecord(), null, 'refused: let go');
  const R2 = inBreach({ store: R.store, keysLive: { b: B, until: 0 }, said0: false });
  R2.out();
  R2.client.frame(); await tick(); await tick();
  assert.equal(R2.client.backRecord(), null, 'the service still says it lives (my end unclaimed), but the room refused me: never offered again');
  assert.equal(R2.client.returnable(), false);
  const S = inBreach();
  S.client.frame();
  await tick();
  const asked = S.keysAsked.length;
  S.online.terminal = true; S.online.error = 'the relay refused a frame';
  S.client.frame(); S.client.frame();
  assert.ok(S.client.backRecord(), 'a lost socket keeps the way back');
  assert.equal(S.keysAsked.length, asked + 1, 'and the service is asked again at once');
  // outside: the service says another breach - let go; a call still open to an uncounted member is its own door
  const store = memStore();
  store.setItem(EG_BACK_KEY, JSON.stringify({ b: B, seed: 77, op: T0, h: 2, in: 1 }));
  const O = inBreach({ store, keysLive: { b: 'fedcba9876543210', until: 0 } });
  O.out();
  O.client.frame(); await tick(); await tick();
  assert.equal(O.client.backRecord()?.b, 'fedcba9876543210', 'another breach is live: this one is over, that one the way back');
  const store2 = memStore();
  store2.setItem(EG_BACK_KEY, JSON.stringify({ b: B, seed: 77, op: T0, h: 2, in: 1 }));
  const N = inBreach({ store: store2, keysLive: null });
  N.out();
  N.client.frame(); await tick(); await tick();
  assert.equal(N.client.backRecord(), null, 'none live: over');
  assert.ok(!egBackOf(store2.getItem(EG_BACK_KEY)));
  const C = inBreach({ store: memStore(), keysLive: { b: B, until: 0 }, said0: false });
  C.out();
  C.client.frame(); await tick(); await tick();
  assert.ok(C.client.backRecord(), 'a live breach with no record kept as one');
  C.tell({ k: 'call', b: B, o: 'Mac', os: ME, seed: 77, op: C.now() - EG_SEALED_MS - 1000, rh: 0, co: [[ME, 'Mac', 1]], site: SITE, ew: 0, wg: [] });
  assert.equal(C.client.returnable(), false, 'the call\'s window still open: its own answer is the door');
  assert.equal(C.client.promptModel()?.answerable, true);
  assert.notEqual(C.client.promptModel()?.button, EG_BACK_TEXT.button);
  C.step(egTimes({ openedAt: 0 }).admitUntil);
  assert.equal(C.client.returnable(), true, 'the window past: the way back');
  // the circle of the hall my record last stood in
  const deep = memStore();
  deep.setItem(EG_BACK_KEY, JSON.stringify({ b: B, seed: 77, op: T0, h: 7, in: 1 }));
  const D = inBreach({ store: deep, keysLive: { b: B, until: 0 }, said0: false });
  D.out();
  D.client.frame(); await tick(); await tick();
  D.client.command(''); await tick(); await tick();
  assert.deepEqual([D.entered.at(-1)?.b, D.entered.at(-1)?.seed, D.entered.at(-1)?.c], [B, 77, 2], 'Hall 7: the second circle');
  // the strip: the way back's word on its button, the call's own when it says none
  const doc = fakeDoc();
  const strip = createEgCallPrompt({ onAnswer: () => {}, doc });
  strip.draw({ text: EG_BACK_TEXT.prompt, answerable: true, button: EG_BACK_TEXT.button });
  const btn = doc.body.children.at(-1).children[1];
  assert.equal(btn.textContent, 'Return');
  strip.draw({ text: 'Answer the call - 5:00', answerable: true });
  assert.equal(btn.textContent, 'Answer');
});

/** A fake document: the DOM calls the HUD, the panel and the strip make. */
function fakeDoc() {
  const doc = {};
  const node = (tag) => {
    const n = { tagName: String(tag).toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', _text: '', _cls: '', dataset: {}, hidden: false };
    n.style = { _p: {}, setProperty(k, v) { this._p[k] = String(v); }, getPropertyValue(k) { return this._p[k] ?? ''; } };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); } });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.replaceChildren = (...cs) => { n.children = []; n.append(...cs); };
    n.querySelectorAll = () => [];
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0] ?? null;

test('EG-ZD THE FALL (section 16.5): the camera sinks 1.2 m over 1.2 s as the screen drains to a fifth of its colour; the gate\'s card reads FALLEN with whether a Redoubt can call me back, and *Reliquaries lost: N* in the palette\'s red where any were held; 2.5 s on the witness view dithers in through an ordered dither, the eye handed over at its darkest; reduced motion cuts every step; the room\'s word makes it the last; a fall this device saw is not shown again after a reload; the company\'s low toll at clip 107, pitch 0.42 (mutants: no sink; the colour never drained; the card\'s line the wrong one; the lost line with nothing lost; the dither skipped; motion under reduced motion; the screen replayed)', () => {
  assert.deepEqual([EG_FALL_SINK_MS, EG_FALL_CARD_MS, EG_FALL_DITHER_MS, EG_FALL_MS, EG_FALL_SINK_M, EG_FALL_SAT], [1200, 2500, 600, 4300, 1.2, 0.2]);
  const f = { at: 1000, final: false, lost: 4 };
  assert.equal(egFallModel(f, 999), null, 'not before it');
  assert.equal(egFallModel(f, 1000 + EG_FALL_MS), null, 'and not once the witness view stands');
  const a = egFallModel(f, 1000), m = egFallModel(f, 1600), c = egFallModel(f, 1000 + 1500);
  assert.deepEqual([a.phase, a.sink, a.sat, a.eye, a.veil, a.card], ['sink', 0, 1, 'fall', 0, null]);
  assert.deepEqual([m.phase, m.sink, m.sat], ['sink', 1.05, 0.6], 'eased down, half drained at half time');
  assert.deepEqual([c.phase, c.sink, c.sat, c.eye], ['card', 1.2, 0.2, 'fall']);
  assert.deepEqual([c.card.main, c.card.sub, c.card.lost], ['Fallen', 'The next Redoubt can call you back.', 'Reliquaries lost: 4']);
  assert.equal(egFallModel({ ...f, final: true }, 2500).card.sub, EG_TEXT.fallen, 'the last fall\'s line');
  assert.equal(egFallModel({ ...f, lost: 0 }, 2500).card.lost, '', 'nothing lost, nothing said');
  const C0 = 1000 + EG_FALL_SINK_MS + EG_FALL_CARD_MS;
  const d1 = egFallModel(f, C0 + 75), d2 = egFallModel(f, C0 + 290), d3 = egFallModel(f, C0 + 310), d4 = egFallModel(f, C0 + 525);
  assert.deepEqual([d1.veil, d1.eye, d2.veil, d2.eye, d3.veil, d3.eye, d3.sat, d4.veil], [0.25, 'fall', 1, 'fall', 1, 'witness', 1, 0.25], 'into black and out of it, the eye handed over at its darkest');
  assert.deepEqual(egDitherCells(0.5), [[0, 0], [1, 1]], 'Bayer\'s order');
  assert.equal(egDitherCss(0), 'none'); assert.equal(egDitherCss(1), '#000');
  assert.match(egDitherCss(0.25), /^url\("data:image\/svg\+xml,/);
  const s = egFallModel(f, 1100, { still: true }), s2 = egFallModel(f, C0 + 150, { still: true });
  assert.deepEqual([s.sink, s.sat, s2.eye, s2.veil, s2.sat], [0, EG_FALL_SAT, 'witness', 0, 1], 'reduced motion: no sink, the colour cut, the witness view cut in');
  assert.equal(egFallModel(f, 1000 + EG_FALL_SINK_MS + 10, { still: true }).card.fresh, false, 'the card never rising');
  assert.equal(EG_BEAT_SOUNDS.lowToll.rec, 107); assert.equal(EG_BEAT_SOUNDS.lowToll.pitch, 0.42);
  // the client: my Reliquaries held, the death save, the screen drawn and the eye sinking where I fell
  const P = inBreach();
  P.B.mem[ME].rel = [1, 2, 3, 4];
  P.tell(egStateOf(P.B, P.now()));
  const g = globalThis.document, doc = fakeDoc();
  globalThis.document = /** @type {any} */ (doc);
  try {
    destroyEgSpireHud();
    P.client.frame();
    assert.equal(P.client.fallSave(), true);
    const eye0 = { pos: [0, 0, 0] };
    assert.equal(P.client.witnessEye(eye0, 0), true, 'the fall\'s own eye');
    assert.deepEqual(eye0.pos, [3, 1.6, 4], 'where I fell');
    P.step(600); P.client.frame();
    const e1 = { pos: [0, 0, 0] };
    P.client.witnessEye(e1, 0);
    assert.equal(r2(e1.pos[1]), r2(1.6 - 1.05), 'sinking');
    assert.equal(one(doc.body, 'eg-fall-drain').style.backdropFilter, 'saturate(0.6)', 'draining');
    P.step(1000); P.client.frame();
    const card = one(doc.body, 'eg-fall-card');
    assert.equal(one(card, 'wb-title-main').textContent, 'Fallen');
    assert.equal(one(card, 'wb-title-sub').textContent, EG_FALL_TEXT.first);
    assert.equal(one(card, 'eg-fall-lost').textContent, 'Reliquaries lost: 4');
    const pal = EG_DANGER_PALETTES.standard.danger;
    assert.equal(one(card, 'eg-fall-lost').style.color, `rgb(${Math.round(pal[0] * 255)}, ${Math.round(pal[1] * 255)}, ${Math.round(pal[2] * 255)})`);
    // the room's word: the last fall
    P.tell({ k: 'fall', s: ME, n: 'Mac', at: P.now(), fin: 1 }); P.client.frame();
    assert.equal(one(card, 'wb-title-sub').textContent, EG_TEXT.fallen, 'the room says it is the last');
    // the dither, then the witness view behind a living companion
    P.setPeers([{ sub: 'acct-1', pos: [10, 2, 20] }]);
    P.B.mem[ME].alive = 0; P.B.mem[ME].wit = 1; P.B.mem[ME].falls = 1; P.B.mem[ME].recall = 0;
    P.tell(egStateOf(P.B, P.now()));
    P.step(EG_FALL_CARD_MS - 400 + 150); P.client.frame();
    assert.notEqual(one(doc.body, 'eg-fall-veil').style.background, 'none', 'dithering');
    P.step(EG_FALL_MS); P.client.frame();
    assert.equal(one(doc.body, 'eg-fall').style.display, 'none', 'the witness view stands');
    const e2 = { pos: [0, 0, 0] };
    assert.equal(P.client.witnessEye(e2, 0), true);
    assert.deepEqual(e2.pos.map(r2), [10, 2 + 1.5 + 1.6, 20 - EG_WITNESS_BACK]);
    // a reload: the witness comes back, and its fall is not shown again
    const Q = inBreach({ store: P.store });
    Q.B.mem[ME].alive = 0; Q.B.mem[ME].wit = 1; Q.B.mem[ME].falls = 1;
    Q.tell(egStateOf(Q.B, Q.now()));
    destroyEgSpireHud();
    Q.client.frame();
    assert.equal(Q.client.witnessing(), true);
    assert.equal(one(doc.body, 'eg-fall'), null, 'no second screen for a fall already seen');
    // reduced motion: the eye never sinks
    setPref('reducedMotion', true);
    const R = inBreach();
    R.client.fallSave(); R.step(900);
    const e3 = { pos: [0, 0, 0] };
    R.client.witnessEye(e3, 0);
    assert.deepEqual(e3.pos, [3, 1.6, 4], 'still');
  } finally { globalThis.document = g; setPref('reducedMotion', false); destroyEgSpireHud(); }
  // a fall with no recall left is the last, before the room has said so
  const L = inBreach();
  L.B.mem[ME].recall = 0;
  L.tell(egStateOf(L.B, L.now()));
  L.client.frame(); L.client.fallSave();
  const g2 = globalThis.document, doc2 = fakeDoc();
  globalThis.document = /** @type {any} */ (doc2);
  try { destroyEgSpireHud(); L.step(EG_FALL_SINK_MS + 100); L.client.frame(); assert.equal(one(one(doc2.body, 'eg-fall-card'), 'wb-title-sub').textContent, EG_TEXT.fallen, 'no recall: the last'); } finally { globalThis.document = g2; destroyEgSpireHud(); }
  // the company's toll for another's fall
  const T = inBreach();
  T.client.frame();
  T.tell({ k: 'fall', s: 'acct-1', n: 'Ann', at: T.now(), fin: 0 }); T.client.frame();
  assert.ok(T.played.some((p) => p.rec === 107 && p.pitch === 0.42), 'a low toll at 0.42');
});

test('EG-ZD THE SPANS\' CLOCK (section 10.8, EG-H1\'s host flag): the breach\'s client hands the host the corrected shared clock - its milliseconds (`breachNow`) and its anchored seconds (`spanSeconds`) - only inside the breach and once the room has answered a ping; the seconds never step for a median that wanders less than EG_SPAN_REANCHOR_MS, and move with one past it; the world host\'s `deadlandsSeconds` and `egNow` read them first, out of the frame (mutants: the welcome\'s clock kept in the breach; the clock read outside it; re-anchored on every sample)', () => {
  const realNow = Date.now, realPerf = performance.now;
  let wall = T0 + 400_000;
  Date.now = () => wall;
  performance.now = () => 1000;   // the page's clock held still: a slow runner's pause must not read as a re-anchor
  try {
    const P = inBreach();
    assert.equal(P.client.breachNow(), null, 'no answer yet');
    assert.equal(P.client.spanSeconds(), null);
    P.client.frame();
    const ping = P.sent.find((w) => w.k === 'clk');
    assert.ok(ping, 'pinged');
    wall += 100;
    P.tell({ k: 'clk', c: ping.c, now: wall - 50 + 777 });   // the relay's clock 777 ms ahead, a 100 ms round trip
    assert.equal(P.client.clockOffset(), 777);
    assert.equal(P.client.breachNow(), wall + 777);
    const s0 = P.client.spanSeconds();
    assert.ok(Math.abs(s0 - (wall + 777) / 1000) < 0.05, 'the corrected clock, in seconds');
    // a second sample 3 ms off: the median moves under the step - the anchor stays; one 40 ms off moves it
    P.client.frame();
    const p2 = P.sent.filter((w) => w.k === 'clk').at(-1);
    wall += 100;
    P.tell({ k: 'clk', c: p2.c, now: wall - 50 + 777 + 6 });
    assert.ok(Math.abs(P.client.clockOffset() - 777) <= EG_SPAN_REANCHOR_MS);
    const s1 = P.client.spanSeconds();
    assert.ok(s1 - s0 < 0.05, 'not re-anchored for a wander under the step');
    for (let k = 0; k < 4; k++) { P.step(300); wall += 300; P.client.frame(); const pk = P.sent.filter((w) => w.k === 'clk').at(-1); wall += 100; P.tell({ k: 'clk', c: pk.c, now: wall - 50 + 777 + 60 }); }
    assert.ok(P.client.clockOffset() > 777 + EG_SPAN_REANCHOR_MS);
    assert.ok(Math.abs(P.client.spanSeconds() - (wall + P.client.clockOffset()) / 1000) < 0.02, 'taken again past the step');
    P.out();
    assert.equal(P.client.breachNow(), null, 'outside the breach: the host\'s own clock');
    assert.equal(P.client.spanSeconds(), null);
  } finally { Date.now = realNow; performance.now = realPerf; }
  const W = rd('src/scenes/world.js');
  assert.match(W, /const deadlandsShared = anchoredClock\(\{ perf: \(\) => performance\.now\(\), wall: \(\) => Date\.now\(\) \+ _sharedOffsetMs \}\);\n\s+const deadlandsSeconds = \(\) => egClient\?\.spanSeconds\(\) \?\? deadlandsShared\(\);/);
  assert.match(W, /const egNow = \(\) => egClient\?\.breachNow\(\) \?\? Date\.now\(\) \+ _sharedOffsetMs;/);
  const frameAt = W.indexOf('\n  function frame(now) {');
  assert.ok(frameAt > 0 && W.indexOf('const deadlandsSeconds = () =>') < frameAt && W.indexOf('const egNow = () =>') < frameAt, 'host functions, never the frame (PERF-V8)');
  assert.match(W, /sdClock: \(\) => host\.deadlandsSeconds\?\.\(\) \?\? performance\.now\(\) \/ 1000,|deadlandsSeconds: \(\) => deadlandsSeconds\(\),/, 'the spans ride the host\'s seconds');
});

test('EG-ZD THE FEINT\'S DASHED FADE (section 13.2, Feud-Arc section 7.3): a blow cut as a feint keeps its fill where the cut found it, fades over TELL_FEINT_FADE and is drawn dashed (the Spire stage\'s uLook 4); an honest blow is never dashed; the stage breaks a dashed shape into stripes where the plain one is whole (mutants: the fill running on past the cut; the dash on every blow; the stage ignoring the bit)', () => {
  assert.equal(EG_FEINT_FADE_MS, Math.round(TELL_FEINT_FADE * 1000));
  assert.equal(EG_LOOK_BIT.dash, 4);
  let spec = null, seed = 0;
  for (seed = 1; seed < 50 && !spec; seed++) { const s = egHallOf(seed, 1, 0); if (s.kind === 'yard') spec = s; }
  seed--;
  let t = 50_000;
  const me = [spec.fight?.x ?? 0, spec.fight?.z ?? 20];
  const body = (i, role, x, z) => ({ i, role, k: 0, pt: 0, x, z, hp: 100, max: 100, fl: 0, mv: null, born: 0 });
  const blow = (i, at, cut = null) => ({ i, o: 1, at, wu: 1500, s: [['d', me[0] + 20, me[1], 3]], ch: 0, el: null, p: 0.1, b: 0, nm: 'x', sp: 0, pu: 0, ...(cut != null ? { cut } : {}) });
  const F = { ...EG_FIGHT_EMPTY, h: 1, bodies: [body(1, EG_ROLE.lord, me[0] + 8, me[1])], blows: [] };
  const E = { b: B, h: 1, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: F, co: [] };
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => ME });
  const from = t - 500, cutAt = from + 825;   // cut at FEINT_AT of a 1500 ms wind-up
  F.blows = [blow(10, t + 1000, cutAt), blow(11, t + 1000)];
  t = cutAt + 75;
  fight.frame();
  const shapes = egLookShapes(fight.shapes(), egAccessNow(null), 'trial');
  const cut = shapes.find((s) => s.cut), honest = shapes.find((s) => !s.cut && s.edge !== undefined && s.pool === 0);
  assert.ok(cut, 'the feint drawn while it fades');
  assert.equal(cut.t, 0.55, 'its fill frozen where the cut found it');
  assert.equal(cut.alpha, 0.5, 'half faded at half its fade');
  assert.ok((cut.look & EG_LOOK_BIT.dash) !== 0, 'dashed');
  assert.ok(honest && (honest.look & EG_LOOK_BIT.dash) === 0, 'an honest blow is never dashed');
  t = cutAt + EG_FEINT_FADE_MS + 1;
  fight.frame();
  assert.ok(!fight.shapes().some((s) => s.cut), 'gone past its fade');
  F.blows = [blow(12, t + 1000, t - 10)];
  fight.frame();
  assert.ok(egLookShapes(fight.shapes(), egAccessNow(null), 'trial')[0].cut, 'a lone feint in the first slot');
  F.blows = [];
  F.zones = [{ i: 1, kind: 'burn', s: ['d', me[0] + 20, me[1], 3], from: t - 100, until: t + 5000, p: 0.01, b: 0, el: 'fire' }];
  t += 20;
  fight.frame();
  const zone = egLookShapes(fight.shapes(), egAccessNow(null), 'trial')[0];
  assert.ok(zone && (zone.look & EG_LOOK_BIT.dash) === 0, 'a zone in the slot a feint held is never dashed');
  // the stage: a dashed line broken into stripes
  const frag = (p, look) => {
    const fns = glslFunctions(TELEGRAPH_FS_SPIRE, {
      uKind: TELEGRAPH_KIND.disc, uOrigin: [0, 0], uYaw: 0, uR: 4, uHalfArc: 0, uBody: 0, uEnd: [0, 0], uHalfW: 0, uR0: 0, uR1: 0, uPts: Array.from({ length: 10 }, () => [0, 0]), uCount: 0,
      uT: 0.55, uFlash: 0, uAlpha: 1, uColor: [1, 0.4, 0.1], uEdgeCol: [...TELEGRAPH_EDGE_DAGON], uCourt: [0, 0], uFloorR: 40, uStyle: 0, uSince: 1, uSpan: 2, uAfter: -1, uPool: 0, uRunS: 0, uLineW: 1,
      uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 20, 20], uFocus: [0, 0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0],
      uFogFloor: [0, 0, 1], uFillK: 1, uLook: look, vCourt: p, vWorld: [p[0], 0.05, p[1]], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => 0.04) : 0.04),
    });
    try { fns.main(); return [...fns.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
  };
  const sum = (o) => (o ? o[0] + o[1] + o[2] : 0);
  const plain = [], dashed = [];
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2, p = [Math.sin(a) * 4, Math.cos(a) * 4]; plain.push(sum(frag(p, 0))); dashed.push(sum(frag(p, EG_LOOK_BIT.dash))); }
  assert.ok(Math.min(...plain) > 0.2, 'the plain line whole');
  assert.ok(dashed.filter((v) => v < 1e-9).length >= 8 && dashed.filter((v) => v > 0.2).length >= 8, 'the dashed one in stripes');
});

test('EG-ZD THE PAD AND THE SURPLUS (section 27.8, EG-G1\'s departure 7): with a Surplus to spend, the pad\'s left and right move past the offer\'s cards to the Surplus\'s two buttons - up on the first spends a fourth card, on the second a reroll - and the panel marks the one chosen; with none, the cards alone (mutants: the Surplus unreachable; the two swapped; the panel\'s mark off the button)', () => {
  const cards = [EG_V_BY_KEY.ironfooting.id, EG_VESTIGES[5].id, EG_VESTIGES[12].id];
  const P = inBreach({ h: 5, sg: 'rest' });
  P.B.sur = 1;
  P.tell(egStateOf(P.B, P.now()));
  P.tell({ k: 'offer', v: cards, n: 1 });
  P.client.frame();
  assert.equal(P.client.padUp(), true);
  for (let k = 0; k < 3; k++) P.client.padGesture('right', 'tap');
  P.client.padGesture('up', 'tap');
  assert.deepEqual(P.sent.filter((w) => w.k === 'surplus').at(-1), { k: 'surplus', use: 0 }, 'a fourth card');
  P.client.padGesture('right', 'tap'); P.client.padGesture('up', 'tap');
  assert.deepEqual(P.sent.filter((w) => w.k === 'surplus').at(-1), { k: 'surplus', use: 1 }, 'a reroll');
  P.client.padGesture('right', 'tap'); P.client.padGesture('up', 'tap');
  assert.deepEqual(P.sent.filter((w) => w.k === 'pick').at(-1), { k: 'pick', v: cards[0] }, 'round again to the first card');
  const Q = inBreach({ h: 5, sg: 'rest' });
  Q.tell({ k: 'offer', v: cards, n: 1 });
  Q.client.frame();
  for (let k = 0; k < 3; k++) Q.client.padGesture('right', 'tap');
  Q.client.padGesture('up', 'tap');
  assert.equal(Q.sent.filter((w) => w.k === 'surplus').length, 0, 'no Surplus, no buttons');
  assert.deepEqual(Q.sent.filter((w) => w.k === 'pick').at(-1), { k: 'pick', v: cards[0] });
  // the panel's mark
  const doc = fakeDoc();
  const model = egPanelModel(P.client.state(), ME, P.now());
  for (const [focus, label] of [[3, /a fourth card/], [4, /draw new cards/]]) {
    destroyEgHud();
    drawEgPanel(model, { doc, focus });
    const marked = find(doc.body, 'eg-focus');
    assert.equal(marked.length, 1);
    assert.match(marked[0].textContent, label);
  }
  destroyEgHud();
});

test('EG-ZD THE BEATS ON THE CRITICAL BUS (section 26, EG-G1\'s departure 9): a beat\'s one-shot rides THE SPIRE MIX - played and the score ducked 6 dB for 300 ms, never culled; in the breach the client plays every HUD beat through its fight\'s mix (over the host\'s music), and nothing in the client plays a beat past it (mutants: a beat that never ducks; the client\'s own engine call)', () => {
  const played = [], ducked = [];
  const mix = createSpireMix({ audio: { playOneShot: (rec, vol, pitch) => played.push([rec, vol, pitch]) }, music: { duck: (db, s) => ducked.push([db, s]) } });
  assert.equal(mix.beat({ rec: 107, vol: 0.9, pitch: 0.42 }), true);
  assert.deepEqual(played, [[107, 0.9, 0.42]]);
  assert.deepEqual(ducked, [[6, 0.3]]);
  assert.equal(mix.beat(null), false);
  assert.equal(mix.beat({ by: 'veil' }), false, 'a sound another part plays is none of the bus\'s');
  assert.equal(ducked.length, 1);
  assert.equal(createSpireMix({ music: { duck: () => ducked.push(1) } }).beat({ rec: 25 }), false, 'no engine: nothing played');
  assert.equal(ducked.length, 2, 'the score ducked all the same');
  // the client: in the breach, the fight's mix
  const P = inBreach({ withFight: true });
  P.client.frame();
  const d0 = P.ducked.length;
  P.client.beat('key');
  assert.ok(P.played.some((p) => p.rec === EG_BEAT_SOUNDS.rare.rec && p.vol === EG_BEAT_SOUNDS.rare.vol), 'played');
  assert.equal(P.ducked.length, d0 + 1, 'the score ducked under it');
  const SRC = rd('src/scenes/eliteGates/egClient.js');
  assert.ok(!/audio\?\.playOneShot/.test(SRC), 'no beat past the bus');
  assert.match(SRC, /const bus = \(\) => fight\?\.mix\?\.\(\) \?\? \(ownMix \?\?= createSpireMix\(\{ audio, now \}\)\);/);
});
