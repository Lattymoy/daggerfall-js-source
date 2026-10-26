// AUDIT EG IV (2026-10-13, the Elite Gates arc's fourth audit; bible/11-Multiplayer/Elite-Gates.md sections 6.1, 16.1, 20,
// 21, 22 and 23) - THE NET GROUP'S RELAY HALF, PINNED against the relay's real Room (test/fakeRoom.mjs - a hub and the
// breach rooms over fake objects, the binding between them a fetch this file can refuse) and the director's own producers
// (net/eliteGates/egBrain.js egBreachNew, egEnter, egStep, egHeal, egEnd; net/eliteGates/egReceipt.js mintEgReceipt):
//   lane3 #2   the breach room's hello hands only the receipts it still owes the hub - the hub is their holder of record;
//   lane3 #3   a healer's part in a hall is corroborated by the room's relayed cast (an idle account no word makes an earner);
//   lane3 #5   the hub's own breach words on a bucket of their own at the social rate, and a void asked again answered from
//              the hub's held copy;
//   lane3 #7   every receipt field on its own kind, as the mint makes it;
//   lane3 #8   section 23's receipt table the mint's (lane3 #15: an end's `n` its entrants);
//   lane3 #9   the hub's sweep forgets a call past its open window;
//   lane3 #11  the opener the first wake finds outside is owed their end then;
//   lane3 #12  a retried open calls the company the room froze;
//   lane3 #14  a fallen member returns as a witness (section 6.1);
//   lane3 #17  the public `/v1/eg/live` asks the hub one ask at a time an isolate;
//   lane3 #19  THE HOLD's sentence the recorded behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms, fakeRoom } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import worker from '../../../server/src/index.js';
import { SOCIAL_ROOM, EG_KEY, RELAY_VERSION, SOCIAL_HZ_MAX, EG_HZ_MAX, EG_HUB_HZ_MAX, EG_HUB_BURST, EG_HUB_KINDS, egHubGate, egCallKey } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egTimes, EG_SEALED_MS, EG_GATHER_MS, EG_ADMIT_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_INTERNAL_RCPT, EG_INTERNAL_VOID, EG_RC_TELL_MS, egRcKey, egRcLive } from '../../../src/net/eliteGates/egDurable.js';
import { EG_LIVE_PATH } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew, egEnter, egStep, egHeal, egEnd, egAdmitWord, egFall, egForsake, EG_HEAL_CAST_MS } from '../../../src/net/eliteGates/egBrain.js';
import { mintEgReceipt, readEgReceipt, egReceiptValid, EG_END_WHYS, EG_RECEIPT_LIST_MAX, EG_RECEIPT_RELS_MAX } from '../../../src/net/eliteGates/egReceipt.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { healRef } from '../../../src/net/gate/gateBrain.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { OnlineSession } from '../../../src/net/online.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef', B2 = 'fedcba9876543210';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const at = (sx, z) => { const [x, y, dz] = realmToDungeon(sx, 0, z); return { x, y, z: dz, yaw: 0, pitch: 0 }; };
const egs = (ws) => ws.sent.filter((m) => m.t === 'eg');
const rcpts = (ws) => [...new Set(egs(ws).filter((m) => m.k === 'rcpt').map((m) => m.r))];
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
/** A section of the design page, by its heading. */
const section = (n) => { const P = rd('bible/11-Multiplayer/Elite-Gates.md'), i = P.indexOf(`\n## ${n}. `), j = P.indexOf('\n## ', i + 4); assert.ok(i > 0 && j > i, `section ${n}`); return P.slice(i, j); };
/** A heal spell's cast frame's data (ALLY-CAST's - test/systems/allycast.test.js's own shape). */
const HEAL_CAST = (to) => ({ to, level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [{ type: 10, subType: 8, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] } });

/** The hub and the breach rooms over a driven clock (test/net/eliteGates/egz_keys.test.js `withRelay`): `acct-mac` on the hub, `acct-ann`
 *  too (in his party when `party`); the binding a fetch `refuseIf` can make unreachable, every call kept (`calls`). */
async function withRelay(fn, { party = false } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const calls = [];
  let refuse = () => false;
  const realGet = world.ROOMS.get;
  world.ROOMS.get = (id) => ({ fetch: async (request) => { const path = new URL(request.url).pathname; calls.push([id, path]); if (refuse(id, path)) throw new Error('unreachable'); return realGet(id).fetch(request); } });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
      const ann = hub.connect(); await hub.hello(ann, 'peer-ann', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', kind: 'linked' });
      const partyUp = async () => {
        clock += 600; await hub.raw(mac, JSON.stringify({ t: 'social', k: 'party.invite', peer: 'peer-ann' }));
        clock += 600; await hub.raw(ann, JSON.stringify({ t: 'social', k: 'party.accept', party: mac.att.party }));
        clock += 600;
        assert.ok(hub.store.get(`party:${mac.att.party}`)?.members?.includes('acct-ann'), 'a party of two');
      };
      if (party) await partyUp();
      const order = async (eb, ez, s = 'acct-mac') => mintEgOrder({ o: 'egopen', s, eb, ez }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const say = (ws, w) => hub.raw(ws, JSON.stringify({ t: 'eg', ...w }));
      const room = (b) => world.room(egRoomKey(b));
      const beat = async (eg, ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
      const admit = async (eg, b, sub, ez) => mintEgOrder({ o: 'egadmit', s: sub, eb: b, ez }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const enter = async (b, sub, peer, sx, z, ez = 'a'.repeat(20)) => {
        const eg = room(b), ws = eg.connect(); await eg.hello(ws, peer, at(sx, z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
        await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await admit(eg, b, sub, ez), lv: 20, bv: 2 }));
        await eg.pose(ws, at(sx, z));
        return ws;
      };
      await fn({ world, hub, mac, ann, calls, partyUp, refuseIf: (f) => { refuse = f; }, order, say, room, beat, admit, enter, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}
/** Breach B opened by Mac for his party of two, both admitted and standing on Hall 1's plate - into its trial. */
async function twoInTrial(rig) {
  const { mac, say, order, room, beat, enter, step } = rig;
  await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
  const R = room(B), spec = egHallOf(R.store.get(EG_KEY).seed, 1);
  step(EG_SEALED_MS); await beat(R, 1000);
  const macWs = await enter(B, 'acct-mac', 'peer-mac', spec.x0 + spec.arrive.x, spec.arrive.z);
  const annWs = await enter(B, 'acct-ann', 'peer-ann', spec.x0 + spec.arrive.x + 0.5, spec.arrive.z, 'b'.repeat(20));
  await beat(R, EG_GATHER_MS + 1000);
  assert.equal(R.room._eg.sg, 'trial', 'both in, the hall woke');
  return { R, spec, macWs, annWs };
}

/**
 * The director's own breach of `n` (`acct-0` the opener) on seed 12345 - `entered` admitted - stepped from its rising: the
 * rest as egaudit3_count's fixture beats it (each entered member on the arrival plate).
 */
function opened(n, entered, seed = 12345) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  Br.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const sub of entered) assert.equal(egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  const step = (ms = 1000) => {
    now += ms;
    const sp = Br.h > 0 ? egHallOf(seed, Br.h, 0) : null;
    return egStep(Br, now, entered.filter((sub) => Br.mem[sub]?.alive).map((sub, i) => ({ sub, sx: sp ? sp.x0 + sp.arrive.x + i * 0.5 : 0, z: sp ? sp.arrive.z : 0, dead: false, at: now })), rng);
  };
  return { B: Br, step, now: () => now };
}
/** Opened breach `D` walked to its first Redoubt (egaudit3_count's way): each hall woken, `earners` dealing in it, pulled,
 *  until the Court's lord falls. */
function toRedoubt(D, earners) {
  const toTrial = () => { for (let k = 0; k < 2000 && D.B.sg !== 'trial'; k++) D.step(250); assert.equal(D.B.sg, 'trial', `hall ${D.B.h} woke`); };
  for (let h = 1; h <= 4; h++) {
    toTrial();
    for (const sub of earners) { D.B.mem[sub].dh = 100; D.B.mem[sub].dc += 100; }
    const was = D.B.h; D.B.sg = 'closing'; D.B.dn = D.now() - 45_000; D.B.su = D.now() + 250; D.step(250); assert.equal(D.B.h, was + 1, 'pulled');
  }
  toTrial();
  for (const sub of earners) D.B.mem[sub].dc += 100;
  D.B.F.mem.lordsFell = 1;
  D.step(250);
  assert.equal(D.B.rd, 1, 'Redoubt 1 taken');
}

// ── lane3 #2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #2 THE ROOM\'S HELLO HANDS WHAT THE HUB DOES NOT HOLD YET (section 23, step 5): a member\'s end minted mid-breach is handed on its socket and told the hub, which holds it; her hello to the room after that hands nothing (it handed every receipt it ever minted, at every hello - a reload, a blip, every deploy - and each was claimed again), while one the hub has not taken yet (its tell refused) is handed by the room\'s hello, and a relay with no hub to tell hands all it minted (mutants: the room\'s hello unfiltered; the hub-less relay handing none)', async () => {
  await withRelay(async (rig) => {
    const { hub, refuseIf, beat, step } = rig;
    const { R, spec, annWs } = await twoInTrial(rig);
    refuseIf((id, path) => path === EG_INTERNAL_RCPT);   // the hub does not take the room's tell
    R.room._eg.mem['acct-ann'].recall = 0;   // her recall spent: her fall is final, her end owed while Mac plays on
    await R.raw(annWs, JSON.stringify({ t: 'eg', k: 'fell' }));
    await R.raw(annWs, JSON.stringify({ t: 'eg', k: 'yield' }));   // PIN MOVED (AUDIT WORLD-EVENTS L1-4): a death lies down first - the fall given in to
    const [r] = rcpts(annWs);
    assert.deepEqual([readEgReceipt(r)?.q, readEgReceipt(r)?.why], ['x', 'fall'], 'her end, handed on her socket');
    assert.equal(R.room._eg.rq.length, 1, 'owed to the hub');
    const hello = async () => { const ws = R.connect(); await R.hello(ws, 'peer-ann', at(spec.x0 + spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: 'acct-ann', charLevel: 20 }); const got = rcpts(ws); R.drop(ws); return got; };
    R.drop(annWs);
    assert.deepEqual(await hello(), [r], 'owed to the hub still: the room\'s hello hands it');
    refuseIf(() => false);
    await beat(R, EG_RC_TELL_MS + 1000);
    assert.deepEqual(R.room._eg.rq, [], 'told');
    assert.deepEqual(egRcLive(hub.store.get(egRcKey('acct-ann')), Math.floor(Date.now() / 1000)), [r], 'the hub holds it for her');
    for (let k = 0; k < 3; k++) assert.deepEqual(await hello(), [], `hello ${k + 1} to the room: the hub's to hand, never the room's again`);
    step(1000);
  }, { party: true });
  // a relay built without the hub's binding keeps them in the room alone: its hello hands them all
  const realNow = Date.now; let clock = T0; Date.now = () => clock;
  try {
    await quiet(async () => {
      const R = fakeRoom(egRoomKey(B), { now: () => clock });
      const tell = { b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 9, op: clock, co: [['acct-mac', 'Mac', 1], ['acct-ann', 'Ann', 2]], site: SITE, wg: [] };
      assert.equal((await (await R.room.fetch(new Request('https://relay.internal/internal/eg/open', { method: 'POST', body: JSON.stringify(tell) }))).json()).ok, true);
      const E = R.room._eg;
      E.owe.push({ sub: 'acct-ann', claims: { q: 'x', b: B, s: 'acct-ann', z: 'z'.repeat(20), h: 0, t: 0, n: 2, ew: 0, l: 20, why: 'forsake', fl: 1 } });
      await R.room._egMint(E, clock);
      assert.deepEqual(E.rq, [], 'no hub to owe');
      clock += EG_SEALED_MS + 1000;
      const ws = R.connect(); await R.hello(ws, 'peer-ann', at(0, 0), { kind: 'linked', tokenSub: 'acct-ann', charLevel: 20 });
      assert.equal(rcpts(ws).length, 1, 'handed by the room, the only holder there is');
    });
  } finally { Date.now = realNow; }
});

// ── lane3 #3 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #3 A HEALER\'S PART IS CORROBORATED (section 16.1, AUDIT EG0 A6; section 21): a heal word names its healers, and only one whose own socket the room relayed a cast from to that member within EG_HEAL_CAST_MS is credited the hall\'s part - a word naming a companion who never cast credits the recap\'s healing alone; a cast older than the window corroborates nothing; and egaudit3_count\'s leech circle, its player\'s client naming an idle alt its healer once a hall, earns the alt no Redoubt, where a healer the room saw cast does earn it (mutants: the cast unread; the window unbounded; the room never noting a cast)', async () => {
  assert.equal(EG_HEAL_CAST_MS, 5000);
  await withRelay(async (rig) => {
    const { step } = rig;
    const { R, macWs, annWs } = await twoInTrial(rig);
    const E = () => R.room._eg;
    const heal = (n) => R.raw(macWs, JSON.stringify({ t: 'eg', k: 'heal', h: [['peer-ann', n]] }));
    await heal(30);
    assert.ok(E().mem['acct-ann'].ht > 0, 'the recap counts the word');
    assert.equal(E().mem['acct-ann'].hh ?? 0, 0, 'Ann never cast on Mac: no part');
    await R.raw(annWs, JSON.stringify({ t: 'cast', data: HEAL_CAST('peer-mac') }));
    assert.ok(macWs.sent.some((m) => m.t === 'cast' && m.id === 'peer-ann'), 'her cast relayed to him');
    step(1000);
    await heal(30);
    const part = E().mem['acct-ann'].hh;
    assert.ok(part > 0, 'the room saw her cast on him: her part');
    step(EG_HEAL_CAST_MS + 1);
    await heal(30);
    assert.equal(E().mem['acct-ann'].hh, part, 'a cast past the window corroborates nothing');
  }, { party: true });
  // THE LEECH CIRCLE (lane 3's probe, egaudit3_count's fixture): a player's client names an idle alt its healer each hall
  const circle = (cast) => {
    let s = 12345;
    const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    const co = [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]];
    const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
    Br.pr = '';
    let now = T0 + EG_SEALED_MS + 100;
    for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
    Br.h = 1; Br.sg = 'arrive'; Br.wk = now; Br.cnt = { left: 30 * 60_000, at: 0 }; Br.pulledAt = now; Br.su = now + 60_000;
    const step = (ms = 250) => { now += ms; const sp = egHallOf(12345, Br.h, 0); return egStep(Br, now, co.map(([sub], i) => ({ sub, sx: sp.x0 + sp.arrive.x + i * 0.5, z: sp.arrive.z, dead: false, at: now })), rng); };
    const toTrial = () => { for (let k = 0; k < 400 && Br.sg !== 'trial'; k++) step(); assert.equal(Br.sg, 'trial'); };
    for (let h = 1; h <= 4; h++) {
      toTrial();
      Br.mem['acct-0'].dh = 100; Br.mem['acct-0'].dc += 100; Br.ctk = 0.3;
      egHeal(Br, 'acct-0', [['acct-1', 0.05 * healRef(40)]], now, LINE, false, cast);   // "acct-1 healed me"
      const hh = Br.h; Br.sg = 'closing'; Br.dn = now - 45_000; Br.su = now + 250; step(); assert.equal(Br.h, hh + 1, 'pulled');
    }
    toTrial();
    Br.F.mem.lordsFell = 1;
    step();
    return Br.owe.filter((o) => o.claims.q === 'w').map((o) => o.sub);
  };
  assert.deepEqual(circle(undefined), ['acct-0'], 'the room never saw the alt cast: the leech earns nothing');
  assert.deepEqual(circle(() => false), ['acct-0']);
  assert.deepEqual(circle((by) => by === 'acct-1'), ['acct-0', 'acct-1'], 'a healer the room saw cast earns its Redoubt');
  const P = section(16);
  assert.match(P, /EG_HEAL_CAST_MS/, 'section 16.1 says the corroboration');
  assert.match(section(21), /\*\*A healer's part\*\*/, 'and section 21');
});

// ── lane3 #5 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #5 THE HUB\'S OWN BREACH WORDS ON A BUCKET OF THEIR OWN (section 23): `open`, `void` and `claimed` spend egHubGate - the social acts\' rate, eight deep - never the breach room\'s sixteen-a-second blow bucket, so forty `claimed` words in one instant write the hub\'s storage eight times, not sixteen; this screen never sends one the hub would refuse; and a void asked again is answered from the hub\'s held copy without asking the room (mutants: the hub\'s words on egGate; the burst; the client on the room\'s bucket; the held copy unread)', async () => {
  assert.deepEqual([EG_HUB_HZ_MAX, EG_HUB_BURST, EG_HZ_MAX], [SOCIAL_HZ_MAX, 8, 16]);
  assert.deepEqual([...EG_HUB_KINDS], ['open', 'void', 'claimed']);
  let b = null, pass = 0;
  for (let i = 0; i < 20; i++) { const g = egHubGate(b, 1000); b = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, EG_HUB_BURST, 'eight at once');
  assert.equal(egHubGate(b, 1000 + 1000 / EG_HUB_HZ_MAX).pass, true, 'then the social rate');
  await withRelay(async ({ hub, mac, calls, order, say, step }) => {
    let puts = 0;
    const put = hub.state.storage.put;
    hub.state.storage.put = async (k, v) => { if ((typeof k === 'string' && k.startsWith('egrc:')) || (k && typeof k === 'object' && Object.keys(k).some((x) => x.startsWith('egrc:')))) puts++; return put(k, v); };
    for (let i = 0; i < 40; i++) await say(mac, { k: 'claimed', b: (i.toString(16).padStart(2, '0')).repeat(8), q: 'w', w: 1 });
    hub.state.storage.put = put;
    assert.equal(puts, EG_HUB_BURST, 'forty in an instant: eight written');
    assert.equal(mac.closed, null, 'dropped, not closed');
    // a void asked again: the room asked once, the held copy handed again
    const z = await order(B2, 'y'.repeat(20));   // an open no call answered: this order never reached the hub
    step(1000 * EG_HUB_BURST / EG_HUB_HZ_MAX);   // the bucket full again
    await say(mac, { k: 'void', z });
    const first = rcpts(mac);
    assert.equal(first.length, 1, 'the void handed');
    const asked = calls.filter(([id, p]) => id === egRoomKey(B2) && p === EG_INTERNAL_VOID).length;
    mac.sent.length = 0;
    step(1000);
    await say(mac, { k: 'void', z });
    assert.deepEqual(rcpts(mac), first, 'the same void, handed again');
    assert.equal(calls.filter(([id, p]) => id === egRoomKey(B2) && p === EG_INTERNAL_VOID).length, asked, 'from the hub\'s held copy - the room not asked again');
  });
  // this screen: a hub word over the hub's bucket is never sent
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  await quiet(() => s.join(SOCIAL_ROOM, null));
  const ws = sockets[0]; ws.open();
  await quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION }));
  const sent = Array.from({ length: EG_HUB_BURST + 1 }, () => s.sendEg('claimed', { b: B, q: 'x', w: 0 }));
  assert.deepEqual(sent, [...Array(EG_HUB_BURST).fill(true), false], 'the hub\'s own bucket, at home');
});

// ── lane3 #7 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #7 EVERY RECEIPT FIELD ON ITS OWN KIND (section 20, EG-E3; section 23): egReceiptValid refuses the shapes lane 3 found taken - `lb: \'yes\'`, `fl: -7`, `vs` not a list, `rl` an object and `wg: \'all\'` on an end, `lk` and `ft` on an end, `rl` on a Redoubt, Vestiges past their pairs - and takes every shape the director mints, at its bounds: a member holding forty Vestiges and seventy Reliquaries has its Redoubt\'s and its end\'s receipts minted whole (mutants: each bound dropped; a list on the other kind)', () => {
  const base = { b: B, s: 'acct-0', z: 'z'.repeat(20), c: 1, h: 5, t: 60, n: 2, ew: 0, l: 20, i: 100, e: 200 };
  const x = { ...base, q: 'x', why: 'home' }, w = { ...base, q: 'w', w: 1 };
  assert.equal(egReceiptValid(x), true);
  assert.equal(egReceiptValid(w), true);
  for (const bad of [{ lb: 'yes' }, { lb: 1 }, { fl: -7 }, { fl: 3 }, { vs: 'not a list' }, { vs: [[1, 1]] }, { rl: { a: 1 } }, { rl: [0] }, { wg: 'all' }, { wg: [1, 2, 3, 4] }, { wg: [32] }, { lk: 'garoth' }, { ft: 3 }]) assert.equal(egReceiptValid({ ...x, ...bad }), false, `an end with ${JSON.stringify(bad)}`);
  for (const bad of [{ rl: [1] }, { vs: [[1, 4]] }, { vs: [[100, 1]] }, { vs: [[1]] }, { vs: Array.from({ length: EG_RECEIPT_LIST_MAX + 1 }, () => [1, 1]) }, { lb: 2 }]) assert.equal(egReceiptValid({ ...w, ...bad }), false, `a Redoubt with ${JSON.stringify(bad).slice(0, 60)}`);
  assert.equal(egReceiptValid({ ...x, rl: Array.from({ length: EG_RECEIPT_RELS_MAX + 1 }, (_, i) => i + 1) }), false, 'past sixty-four Reliquaries');
  assert.equal(egReceiptValid({ ...w, vs: [[26, 3], [0, 1]], lb: 1, fl: 2, wg: [0, 18], lk: 'garoth', ft: 7 }), true);
  assert.equal(egReceiptValid({ ...x, rl: [1, 2], fl: 0, wg: [4], an: 3 }), true);
  // the director's own, at its bounds
  const D = opened(2, ['acct-0', 'acct-1']);
  for (const m of Object.values(D.B.mem)) m.vs = Array.from({ length: 40 }, (_, i) => [i % 27, 1 + (i % 3)]);
  D.B.wg = [0, 4, 9];
  toRedoubt(D, ['acct-0', 'acct-1']);
  const W = D.B.owe.filter((o) => o.claims.q === 'w');
  assert.equal(W.length, 2, 'the Redoubt owed both');
  for (const m of Object.values(D.B.mem)) m.rel = Array.from({ length: 70 }, (_, i) => i + 1);
  egEnd(D.B, 'home', D.now(), []);
  const X = D.B.owe.filter((o) => o.claims.q === 'x');
  assert.equal(X.length, 2, 'both ends owed');
  return Promise.all([...W, ...X].map(async (o) => {
    const r = readEgReceipt(await mintEgReceipt({ ...o.claims, c: 7 }, null, { subtle, nowS: 1000 }));
    assert.ok(r, `${o.claims.q} minted and read`);
    if (o.claims.q === 'w') assert.ok(r.vs.length <= EG_RECEIPT_LIST_MAX && r.wg.length === 3);
    else assert.ok(r.rl.length <= EG_RECEIPT_RELS_MAX && r.vs === undefined);
  }));
});

// ── lane3 #8, lane3 #15 ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #8 / #15 SECTION 23\'S RECEIPT TABLE IS THE MINT\'S, AND AN END\'S `n` ITS ENTRANTS (sections 20 and 23): every field the director mints on a Redoubt and on an end is named in its row, an end\'s row names nothing a Redoubt alone carries (`lb`, `lk`, `ft`, `vs`), its `why` list is EG_END_WHYS whole; a Redoubt\'s `n` counts its earners and an end\'s and `co` its entrants, as section 20 now says (mutants: a field the table drops)', () => {
  const P = section(23);
  const row = (k) => { const line = P.split('\n').find((l) => l.startsWith(`| \`k:'${k}'\``)); assert.ok(line, k); return line; };
  const fields = (line) => new Set([...line.split('|')[2].matchAll(/`([a-z]{1,3})`/g)].map((m) => m[1]));
  const D = opened(3, ['acct-0', 'acct-1', 'acct-2']);
  D.B.mem['acct-0'].vs = [[1, 1]]; D.B.wg = [4];
  toRedoubt(D, ['acct-0']);
  const W = D.B.owe.filter((o) => o.claims.q === 'w');
  assert.equal(W.length, 1, 'one earner of three');
  D.B.mem['acct-1'].pages = 3;
  egEnd(D.B, 'home', D.now(), []);
  const X = D.B.owe.filter((o) => o.claims.q === 'x');
  const wRow = fields(row('w')), xRow = fields(row('x'));
  for (const k of Object.keys(W[0].claims)) if (k !== 'q') assert.ok(wRow.has(k), `the Redoubt's row names \`${k}\``);
  for (const o of X) for (const k of Object.keys(o.claims)) if (k !== 'q') assert.ok(xRow.has(k), `the end's row names \`${k}\``);
  for (const k of ['l', 'lk', 'ft', 'c']) assert.ok(wRow.has(k), `the Redoubt's \`${k}\``);
  for (const k of ['l', 'an', 'rh', 'c', 'nr']) assert.ok(xRow.has(k), `the end's \`${k}\``);
  for (const k of ['lb', 'lk', 'ft', 'vs']) assert.ok(!xRow.has(k), `an end carries no \`${k}\``);
  const whys = new Set([...row('x').matchAll(/`'([a-z]+)'`/g)].map((m) => m[1]));
  for (const why of EG_END_WHYS) assert.ok(whys.has(why), `the why '${why}'`);
  // `n`: a Redoubt's its earners, an end's its entrants - and the company's count the same
  assert.equal(W[0].claims.n, 1);
  assert.ok(X.every((o) => o.claims.n === 3 && o.claims.co[0] === 3), 'an end\'s `n` and `co` count every entrant');
  assert.match(row('x'), /`n` \(entrants\)/);
  assert.doesNotMatch(section(20), /earning entrants/, 'section 20: entrants, earning or not');
});

// ── lane3 #9 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #9 THE HUB SWEEPS A CALL PAST ITS OPEN WINDOW (section 23, step 4): an open keeps its call for each member (`egcall:<sub>`), and the hub\'s own sweep forgets each once the open window has ended - it was forgotten only by that account\'s own next hello, so a called member who never returned left it for good; a call still open is kept (mutants: the prefix unswept; a live call swept)', async () => {
  await withRelay(async ({ hub, mac, order, say, step, now }) => {
    await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
    assert.ok(hub.store.has(egCallKey('acct-ann')) && hub.store.has(egCallKey('acct-mac')), 'kept for both');
    await hub.room._sweepHub(now());
    assert.ok(hub.store.has(egCallKey('acct-ann')), 'its window still open: kept');
    step(EG_SEALED_MS + EG_ADMIT_MAX_MS + 1000);
    await hub.room._sweepHub(now());
    assert.equal(hub.store.has(egCallKey('acct-ann')), false, 'past its window: swept');
    assert.equal(hub.store.has(egCallKey('acct-mac')), false);
    assert.doesNotMatch(rd('src/net/wire.js'), /never a swept prefix/);
  }, { party: true });
});

// ── lane3 #11 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #11 THE OPENER WHO NEVER STEPS IN IS OWED THEIR END AT THE FIRST WAKE (section 23, `eg_live`): the company plays on without its opener, and the wake that closes the door to them owes their end then - `\'empty\'`, nothing cleared - so their stake settles and their `eg_live` clears, never three hours on; owed once, nothing more at the breach\'s end; an opener who entered is owed nothing there (mutants: the opener never owed; owed when in)', () => {
  const D = opened(2, ['acct-1']);
  for (let k = 0; k < 2000 && !(D.B.wk > 0); k++) D.step(1000);
  assert.ok(D.B.wk > 0, 'the hall woke for acct-1');
  const mine = () => D.B.owe.filter((o) => o.sub === 'acct-0').map((o) => o.claims);
  assert.equal(mine().length, 1, 'owed at the wake');
  const [x] = mine();
  assert.deepEqual([x.q, x.why, x.h, x.t, x.z, x.b], ['x', 'empty', 0, 0, 'z'.repeat(20), B], 'its end: never admitted, nothing cleared');
  assert.ok(egReceiptValid({ ...x, c: 1, i: 1, e: 2 }), 'a receipt the mint takes');
  egEnd(D.B, 'tear', D.now() + 60_000, []);
  assert.equal(mine().length, 1, 'nothing more at the end');
  const In = opened(2, ['acct-0', 'acct-1']);
  for (let k = 0; k < 2000 && !(In.B.wk > 0); k++) In.step(1000);
  assert.ok(In.B.wk > 0);
  assert.equal(In.B.owe.filter((o) => o.sub === 'acct-0').length, 0, 'an opener who stepped in: nothing at the wake');
  assert.match(section(23), /an opener the first wake finds outside is owed\ntheir end then/);
});

// ── lane3 #12 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #12 A RETRIED OPEN CALLS THE COMPANY THE ROOM FROZE (section 23, step 3): Mac opens alone, then Ann joins his party and his client sends the open again (EG_OPEN_TRIES) - the hub re-reads the party, but the room answers with the company and the site it kept, and the call is theirs: Ann is never called into a breach that answers only to its first company, and no call is kept for her (mutants: the call off the party; the room\'s company unsaid)', async () => {
  await withRelay(async ({ hub, mac, ann, partyUp, order, say }) => {
    const z = await order(B, 'z'.repeat(20));
    await say(mac, { k: 'open', z, site: SITE });
    assert.deepEqual(egs(mac).filter((m) => m.k === 'call').at(-1)?.co, [['acct-mac', 'Mac', 1]], 'his company of one');
    await partyUp();
    mac.sent.length = 0; ann.sent.length = 0;
    await say(mac, { k: 'open', z, site: { ...SITE, px: 301 } });   // the retry - the order again, its site wherever it stands
    const call = egs(mac).filter((m) => m.k === 'call').at(-1);
    assert.deepEqual(call?.co, [['acct-mac', 'Mac', 1]], 'the room\'s company, never the party as the retry finds it');
    assert.equal(call?.site?.px, 300, 'and the site the room kept');
    assert.equal(egs(ann).filter((m) => m.k === 'call').length, 0, 'Ann is not called');
    assert.equal(hub.store.has(egCallKey('acct-ann')), false, 'nor kept a call');
  });
});

// ── lane3 #14 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #14 A FALLEN MEMBER RETURNS AS A WITNESS (sections 6.1 and 16.5): the room admits a member it counts whatever its falls - a final fall leaves a witness, and a reload of one comes back - and refuses the forsaken and the gone home; section 6.1 says so, never "not fallen twice" (mutants: the fallen refused)', () => {
  const D = opened(2, ['acct-0', 'acct-1']);
  for (let k = 0; k < 2000 && !(D.B.wk > 0); k++) D.step(1000);
  const m = D.B.mem['acct-1'];
  m.recall = 0;
  egFall(D.B, 'acct-1', D.now(), []);
  assert.equal(m.falls, 1);
  assert.equal(egAdmitWord(D.B, 'acct-1', D.now()), null, 'a final fall: back in as a witness');
  m.falls = 2;
  assert.equal(egAdmitWord(D.B, 'acct-1', D.now()), null, 'fallen twice: a witness still');
  egForsake(D.B, 'acct-1', D.now(), []);
  assert.equal(egAdmitWord(D.B, 'acct-1', D.now()), 'you have fallen', 'forsaken: refused');
  const P = rd('bible/11-Multiplayer/Elite-Gates.md');
  const s61 = P.slice(P.indexOf('### 6.1 The company'), P.indexOf('### 6.2 The clock'));
  assert.doesNotMatch(s61, /not fallen twice/);
  assert.match(s61, /a fallen member as a witness \(section 16\.5\)/);
});

// ── lane3 #17 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #17 THE PUBLIC LIVE DOOR ASKS THE HUB ONE ASK AT A TIME (section 22, THE COST): `/v1/eg/live` is public and every request on it was a request on the hub - asks that come together are answered by one asking of it (coalesced, none refused), and nothing is kept past its answer, so an ask after it asks the hub again and a breach the hub adds is counted at once (mutants: never coalesced; kept past its answer)', async () => {
  await withRelay(async ({ world, calls, mac, order, say }) => {
    const ROOMS = world.ROOMS;
    const live = async () => (await worker.fetch(new Request(`https://relay.example${EG_LIVE_PATH}`), { ROOMS })).json();
    const hubAsks = () => calls.filter(([id, p]) => id === SOCIAL_ROOM && p === '/internal/eg/live').length;
    const many = await Promise.all(Array.from({ length: 6 }, () => live()));
    assert.ok(many.every((a) => a.live === 0), 'every ask answered');
    assert.equal(hubAsks(), 1, 'six together: one ask of the hub');
    await say(mac, { k: 'open', z: await order(B, 'z'.repeat(20)), site: SITE });
    assert.equal((await live()).live, 1, 'asked again after its answer - the breach counted at once');
    assert.equal(hubAsks(), 2);
  });
});

// ── lane3 #19 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #19 THE HOLD AS RECORDED (section 22; EG-H2\'s departure 2): the deploy never asks a room to hold - an unauthenticated ask would let anyone freeze a breach - and the page says each room holds itself as it wakes; the relay keeps no door a deploy could ask it on (mutants: the old sentence)', () => {
  const S22 = section(22);
  assert.doesNotMatch(S22, /asks each room to hold/);
  assert.match(S22, /each room holds itself as it wakes between trials - no deploy asks it/);
  assert.doesNotMatch(rd('src/net/eliteGates/egDurable.js'), /EG_INTERNAL_HOLD/);
  assert.doesNotMatch(rd('.github/workflows/relay-deploy.yml'), /internal\/eg\/hold/);
});
