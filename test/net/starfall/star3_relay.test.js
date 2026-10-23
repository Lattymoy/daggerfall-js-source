// STAR3 (bible/11-Multiplayer/Starfall.md sections 5, 6 and 9): THE RELAY HOLDS THE STAR - a word at a fallen star, its
// cell's ledger, the waves moved by the owner's word alone, the hold said once with its earners' receipts, the hub's
// half (everyone told, the night's held stars and each account's receipts kept for a hello), dawn, the cell's places, a
// hibernation's wake, and the session's doors. Driven through the real Room (test/fakeRoom.mjs) and the real session.
// tools/mutants/star3.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAR_HOUR_MS, STAR_PER_NIGHT, STAR_WAVES, STAR_LEVEL_MAX, STAR_KILLS_WIRE_MAX, STAR_BLOWS_WIRE_MAX,
  STAR_TOP_MAX, STAR_ACCOUNTS_MAX, STAR_LIGHT, STAR_PHASES, STAR_WORD_MS, STAR_GRACE_MS, STAR_REACH_M, STAR_UNITS_PER_M,
  STAR_ORPHAN_MS, STAR_LOST_DAWN, STAR_LOST_DARK, P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST, starTimes, starNativeOf, starLedgerId,
  starWaveSize, starNightGoneAt, STAR_WAVE_MAX, newStarLedger, starLedgerSane, starHeldWord, STAR_LIFE_MS, STAR_AFTER_MS, starLedgerState,
} from '../../../src/net/starfall/starfallLaw.js';
import { readStarReceipt, verifyStarReceipt, mintStarReceipt, STAR_RECEIPT_MAX, STAR_RECEIPT_V } from '../../../src/net/starfall/starReceipt.js';
import {
  parseClient, validStarIn, validStarOut, relaySupportsStar, STAR_RELAY_MIN, STAR_STARS_MAX, STAR_WAVES_MAX, STAR_LEVEL_WIRE_MAX,
  STAR_KILLS_MAX, STAR_BLOWS_MAX, STAR_TOP_WIRE_MAX, STAR_COUNT_MAX, STAR_LIGHT_MAX, STAR_PHASE_MAX, STAR_RECEIPT_WIRE_MAX,
  STAR_HELD_MAX, STAR_HELD_KEY, STAR_LEDGERS_MAX, STAR_LEDGERS_BY_MAX, STAR_IDLE_MS, STAR_KEEP_MS, STAR_RC_KEEP, STAR_RC_KEEP_MS,
  starLedgerKey, starReceiptKeyOf, LIVE_EVENTS, LIVE_EVENT_RELAY_MIN, relayKnowsLiveEvent, RELAY_VERSION, SOCIAL_ROOM,
  worldRoom, STAR_INTERNAL_HELD, STAR_WAVE_SIZE_MAX, STAR_WAVE_SIZE_OLD_MAX,
} from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

const subtle = globalThis.crypto.subtle;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

// ═══ THE RIG ══════════════════════════════════════════════════════════════════════════════════════

/** A night inside the window, its first star, and a pixel of the Bay. */
const N = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS) + 5, K = 0;
const PX = 100, PY = 200, CELL = worldRoom(PX, PY);
const T = starTimes(N, K);
/** A pose at the star the law places in (px, py) - `east` metres east of it. */
const at = (px = PX, py = PY, east = 0) => { const [x, z] = starNativeOf(N, K, px, py); return { x: x + east * STAR_UNITS_PER_M, y: 0, z, yaw: 0, pitch: 0 }; };
const ON = at(), OFF = at(PX, PY, STAR_REACH_M + 5);
const word = (o = {}) => ({ n: N, k: K, px: PX, py: PY, lv: 12, s: 0, o: 0, kw: 0, kn: 0, wc: 0, hb: 0, mf: 0, ...o });
const ID = (o = {}) => starLedgerId(word(o));
const LED = (o = {}) => starLedgerKey(ID(o));
const stars = (ws, k) => ws.sent.filter((m) => m.t === 'star' && (!k || m.k === k));
const seen = (ws) => stars(ws, 'st').at(-1);
const ledgers = (r) => [...r.store.keys()].filter((k) => k.startsWith('star:')).sort();

async function withStar(fn, t0 = T.fallAt + 1000) {
  const realNow = Date.now; let clock = t0; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(CELL);
  const say = (ws, o = {}) => r.raw(ws, JSON.stringify({ t: 'star', ...word(o) }));
  try { await quiet(() => fn({ world, r, say, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } })); } finally { Date.now = realNow; }
}
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};

/** An honest owner's word off what its screen last heard: this wave's foes dead, named by their wave, and the wave
 *  cleared (the relay believes it once it may), the master fallen, and its foes' blows on the star - one more a word
 *  while a wave stands. */
const ownerWord = (st, hb) => ({ o: 1, s: 1, kw: st?.p === P_WAVE ? st.w : 0, kn: st?.p === P_WAVE ? st.wz : 0, wc: st?.p === P_WAVE ? st.w : 0, hb, mf: st?.p === P_MASTER ? 1 : 0 });
/** The defense, a word every STAR_WORD_MS from each defender, until `until` holds of what the owner last heard (or
 *  `beats` pass). `others` are [socket, () => word] pairs; the owner's blows ride `blows`. */
async function defend({ say, step }, owner, others, { until = (st) => st.p === P_HELD, beats = 400, blows = { hb: 0 } } = {}) {
  for (let i = 0; i < beats; i++) {
    const st = seen(owner);
    if (st && until(st)) return st;
    if (st?.p === P_WAVE) blows.hb++;
    await say(owner, ownerWord(st, blows.hb));
    for (const [ws, w] of others) await say(ws, w());
    step(STAR_WORD_MS);
  }
  return seen(owner);
}

// ═══ THE WIRE ═════════════════════════════════════════════════════════════════════════════════════

test('STAR3 THE WIRE: a star word projected whole and bounded - the wave its deaths belong to among it; each word a cell or the hub says, projected - the speaker\'s own blows on its ledger, bounded, a receipt by its shape, the held list by its entries; the law\'s bounds written again and pinned equal; an older relay is said none; the Starfall rides the festival\'s days, no live event of its own (mutants: the star\'s index unbounded; the deaths\' wave unbounded; the light unbounded; my blows unbounded; a junk name hiding the held list\'s count; the relay floor off)', () => {
  assert.deepEqual(validStarIn({ ...word(), junk: 1 }), word(), 'projected: nothing the law does not read rides on');
  assert.equal(validStarIn(word({ kw: STAR_WAVES, kn: 3 })).kw, STAR_WAVES, 'the deaths\' wave, to the last');
  for (const bad of [{ n: 0 }, { n: 1.5 }, { k: STAR_PER_NIGHT }, { k: -1 }, { px: 1000 }, { py: 500 }, { lv: 0 }, { lv: STAR_LEVEL_MAX + 1 }, { s: 2 }, { o: -1 }, { mf: 2 }, { kw: STAR_WAVES + 1 }, { kw: -1 }, { kw: undefined }, { kn: STAR_KILLS_WIRE_MAX + 1 }, { wc: STAR_WAVES + 1 }, { hb: STAR_BLOWS_WIRE_MAX + 1 }]) {
    assert.equal(validStarIn(word(bad)), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseClient(JSON.stringify({ t: 'star', ...word() })), { error: 'star before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'star', ...word() }), { hasHello: true }), { t: 'star', ...word() });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'star', ...word({ k: 3 }) }), { hasHello: true }), { error: 'bad star' });
  // what a cell and the hub say
  const st = { k: 'st', n: N, s: K, px: PX, py: PY, p: P_WAVE, w: 2, wz: 5, kn: 3, wl: 40_000, lt: 88, nd: 3, b: 2, ow: 1, hc: 12, hd: 0, lo: 0, why: 0 };
  assert.deepEqual(validStarOut({ ...st, extra: 1 }), st);
  assert.deepEqual(validStarOut({ ...st, hm: 7 }), { ...st, hm: 7 }, 'the speaker\'s own blows ride its copy');
  assert.equal(validStarOut({ ...st, hm: STAR_BLOWS_WIRE_MAX }).hm, STAR_BLOWS_WIRE_MAX);
  for (const hm of [STAR_BLOWS_WIRE_MAX + 1, -1, 1.5, '3', null]) assert.equal(validStarOut({ ...st, hm }), null, `hm ${hm} bounded as a count of blows`);
  assert.equal(validStarOut({ ...st, lt: STAR_LIGHT + 1 }), null, 'the light bounded');
  assert.equal(validStarOut({ ...st, p: STAR_PHASES.length }), null);
  assert.equal(validStarOut({ ...st, s: STAR_PER_NIGHT }), null);
  assert.equal(validStarOut({ ...st, wz: STAR_WAVE_MAX + 1 }), null);
  assert.equal(STAR_WAVE_SIZE_MAX, STAR_WAVE_MAX, 'STAR-TUNE: the wire\'s copy of the law\'s most');
  assert.equal(validStarOut({ ...st, wz: STAR_WAVE_MAX })?.wz, STAR_WAVE_MAX, 'a wave of twenty-four rides');
  // AUDIT STAR-TUNE F3: an older client's `st` read nine at most and dropped the whole frame past it - the cell says nine
  // and the wave whole in `wx`, which this reader folds back into `wz`
  assert.equal(STAR_WAVE_SIZE_OLD_MAX, 9, 'world235-world237\'s validStarOut: `wz` nine at most');
  const olderReads = (m) => Number.isInteger(m.wz) && m.wz >= 0 && m.wz <= STAR_WAVE_SIZE_OLD_MAX;   // an older client's bound on `wz`, its only one the wave moves
  const said = newStarLedger({ n: N, k: K, px: PX, py: PY }, T.fallAt + 5);
  for (let wz = 0; wz <= STAR_WAVE_MAX; wz++) {
    said.wz = wz;
    const out = JSON.parse(JSON.stringify(starLedgerState(said)));
    assert.ok(olderReads(out), `a wave of ${wz}: an older tab keeps the frame (wz ${out.wz})`);
    assert.equal(out.wx, wz > STAR_WAVE_SIZE_OLD_MAX ? wz : undefined, `a wave of ${wz}: whole in wx only past nine`);
    assert.equal(validStarOut(out)?.wz, wz, `a wave of ${wz}: read whole here`);
    assert.equal(validStarOut(out)?.wx, undefined, 'wx is the wire\'s, never the reader\'s');
  }
  for (const bad of [{ wz: 8, wx: 18 }, { wz: 9, wx: 9 }, { wz: 9, wx: STAR_WAVE_MAX + 1 }, { wz: 9, wx: 1.5 }, { wz: 9, wx: '18' }]) assert.equal(validStarOut({ ...st, ...bad }), null, `wx ${JSON.stringify(bad)}`);
  assert.deepEqual(validStarOut({ ...st, wl: -1 }).wl, -1, 'no phase clock running');
  const hd = validStarOut({ k: 'hd', n: N, s: K, px: PX, py: PY, at: T.fallAt + 5, top: [7, 'Ann', '', 'Bran', 'Cat', 'Dun'], c: 9 });
  assert.deepEqual(hd.top, ['Ann', 'Bran', 'Cat'], 'junk never hides a name');
  assert.equal(hd.c, 9);
  assert.equal(validStarOut({ k: 'hd', n: N, s: K, px: PX, py: PY, at: 5, top: ['Ann', 'Bran'], c: 1 }).c, 2, 'never fewer than it names');
  assert.equal(validStarOut({ k: 'hd', n: N, s: K, px: PX, py: PY, at: 0, top: [], c: 0 }), null, 'a hold has its moment');
  assert.deepEqual(validStarOut({ k: 'hds', l: [[N, K, PX, PY, 9], [N, 3, PX, PY, 9], 'x', [N, 1, PX, PY, 0]] }), { k: 'hds', l: [[N, K, PX, PY, 9]] });
  assert.equal(validStarOut({ k: 'hds', l: Array.from({ length: 20 }, () => [N, K, PX, PY, 9]) }).l.length, STAR_HELD_MAX);
  assert.equal(validStarOut({ k: 'rc', r: 'w1.abc.def' }), null, 'another shape\'s receipt');
  assert.equal(validStarOut({ k: 'rc', r: `j1.${'a'.repeat(STAR_RECEIPT_WIRE_MAX)}.` }), null, 'bounded');
  assert.deepEqual(validStarOut({ k: 'rc', r: 'j1.abc.' }), { k: 'rc', r: 'j1.abc.' }, 'unsigned is a real answer');
  // the law's bounds, pinned equal (the wire imports no law)
  assert.equal(STAR_STARS_MAX, STAR_PER_NIGHT);
  assert.equal(STAR_WAVES_MAX, STAR_WAVES);
  assert.equal(STAR_LEVEL_WIRE_MAX, STAR_LEVEL_MAX);
  assert.equal(STAR_KILLS_MAX, STAR_KILLS_WIRE_MAX);
  assert.equal(STAR_BLOWS_MAX, STAR_BLOWS_WIRE_MAX);
  assert.equal(STAR_TOP_WIRE_MAX, STAR_TOP_MAX);
  assert.equal(STAR_COUNT_MAX, STAR_ACCOUNTS_MAX);
  assert.equal(STAR_LIGHT_MAX, STAR_LIGHT);
  assert.equal(STAR_PHASE_MAX, STAR_PHASES.length - 1);
  assert.equal(STAR_RECEIPT_WIRE_MAX, STAR_RECEIPT_MAX);
  assert.equal(STAR_RECEIPT_V, 'j1');
  // the relay that speaks it - and no live event to stage: the stars fall on the festival's own days (net/festivalLaw.js)
  assert.equal(STAR_RELAY_MIN, 235);   // world233 on the branch, renumbered past SD-SEA's world233 and DEX1's world234 at the merge - neither keeps a star
  assert.equal(relaySupportsStar(`world${STAR_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsStar(`world${STAR_RELAY_MIN}`), true);
  assert.equal(relaySupportsStar(RELAY_VERSION), true, 'this build\'s relay keeps a star');
  assert.ok(!LIVE_EVENTS.includes('witchfest') && !Object.hasOwn(LIVE_EVENT_RELAY_MIN, 'witchfest'), 'no word of the hub\'s gates a star');
});

test('STAR3 THE STORED LEDGER: a ledger is what the law made, read back - its star, pixel, phase, accounts and receipts - and nothing else under a star\'s key is read as one (a word makes the star anew) or kept (the sweep forgets a value under a key not its own); the held word is the wire\'s; a night\'s held stars stand until its last star is gone (mutants: a phase past the law\'s read; a ledger without its receipts read; a value under another star\'s key kept; the night gone with its first star)', async () => {
  const led = newStarLedger(word(), 5, 'acct-x');
  assert.equal(led.by, 'acct-x'); assert.equal(led.said, false);
  assert.equal(starLedgerSane(structuredClone(led)), true);
  for (const bad of [null, 7, {}, { ...led, k: STAR_PER_NIGHT }, { ...led, n: 0 }, { ...led, px: 1.5 }, { ...led, p: P_LOST + 1 }, { ...led, p: -1 }, { ...led, a: null }, { ...led, rc: undefined }]) {
    assert.equal(starLedgerSane(bad), false, JSON.stringify(bad)?.slice(0, 60));
  }
  const held = { ...led, p: P_HELD, hd: T.fallAt + 9, top: ['Ann'], hn: 3 };
  assert.deepEqual(validStarOut(starHeldWord(held)), { k: 'hd', n: N, s: K, px: PX, py: PY, at: T.fallAt + 9, top: ['Ann'], c: 3 }, 'the wire\'s own word');
  assert.equal(starNightGoneAt(N), N * STAR_HOUR_MS + STAR_LIFE_MS + STAR_AFTER_MS, 'the night\'s last star falls at its midnight');
  await withStar(async ({ r, say, step }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    r.store.set(LED(), { junk: 1 });
    await say(a, { s: 1 });
    assert.equal(r.store.get(LED()).n, N, 'the junk was no ledger: the word made the star anew');
    const other = starLedgerKey(ID({ px: PX + 1 }));
    r.store.set(other, structuredClone(r.store.get(LED())));   // a ledger under a key not its own
    step(1000);
    await r.fire();
    assert.equal(r.store.has(other), false, 'forgotten by the sweep');
    assert.equal(r.store.has(LED()), true);
  });
});

// ═══ THE CELL ═════════════════════════════════════════════════════════════════════════════════════

test('STAR3 THE WORD: heard in the star\'s own cell alone (another cell\'s pixel is junk), never in a layer, and inside the star\'s life and the window; its ledger made only at the star, by a word from its pose, and only before its deadline - the grace hears its last words; a word from off the star is heard and counts nothing (mutants: the cell unchecked; a layer\'s ledger; the life unchecked; a ledger made from anywhere; a ledger made past the deadline; a word off the star counted)', async () => {
  await withStar(async ({ world, r, say, set, step }) => {
    const by = r.connect(); await r.hello(by, 'peer-0009', at(PX, PY, 2000));   // a bystander in the cell, far from the star
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    // another cell's pixel
    await say(a, { px: PX + 16 });
    assert.equal(r.room._meterOf(a).junk, 1, 'a word for another cell is junk');
    assert.deepEqual(ledgers(r), []);
    // outside the star's life
    step(1000); set(T.fallAt - 1); await say(a);
    step(1000); set(T.endAt + STAR_GRACE_MS); await say(a);
    assert.deepEqual(ledgers(r), [], 'nothing read, kept or said before its landing or past its grace');
    // a night outside the window
    const early = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS) - 3;
    set(starTimes(early, K).fallAt + 1000); await say(a, { n: early });
    assert.deepEqual(ledgers(r), [], 'a night before the window');
    assert.equal(r.room._meterOf(a).junk, 1, 'and nobody struck for them');
    // off the star: no ledger made
    set(T.fallAt + 5000);
    const off = r.connect(); await r.hello(off, 'peer-0002', OFF);
    await say(off, { s: 1, o: 1 });
    assert.deepEqual(ledgers(r), [], 'made only at the star');
    assert.deepEqual(stars(off), [], 'and nothing said');
    // a layer's word is nothing
    const L2 = world.room(`${CELL}#2`);
    const ly = L2.connect(); ly.att.key = CELL; ly.att.ly = 2; await L2.hello(ly, 'peer-0003', ON);
    await L2.raw(ly, JSON.stringify({ t: 'star', ...word({ s: 1 }) }));
    assert.equal([...L2.store.keys()].some((k) => k.startsWith('star:')), false, 'no ledger in a layer');
    assert.equal(L2.room._meterOf(ly).junk ?? 0, 0, 'nobody struck');
    // the star's own word
    step(1000);
    await say(a, { s: 1 });
    assert.deepEqual(ledgers(r), [LED()], 'made by a word from the star');
    const st = seen(by);
    assert.equal(st.p, P_GATHER, 'the coven gathers - said to the whole cell');
    assert.equal(st.nd, 1);
    assert.equal(r.store.get(LED()).by, 'acct-peer-0001', 'its maker kept');
    // a word from off the star once it stands: answered, counted as nobody standing there
    step(1000);
    await say(off, { s: 1, o: 1 });
    const led = r.room._stars.get(ID());
    assert.equal(led.a['acct-peer-0002'].near, false);
    assert.equal(led.a['acct-peer-0002'].s, 0, 'its strike not counted');
    assert.equal(led.own, '', 'nor its claim to the foes');
    assert.equal(seen(off).nd, 1, 'answered with the ledger');
    // the grace hears a ledger's last words; it never makes one
    const late = r.connect(); await r.hello(late, 'peer-0004', at(PX + 1));
    set(T.endAt); await say(late, { px: PX + 1, s: 1, o: 1 });
    assert.equal(r.store.has(LED({ px: PX + 1 })), false, 'no star made at its deadline - it would stand already lost');
    const told = stars(a).length;
    set(T.endAt + STAR_GRACE_MS - 1); await say(a, { s: 1 });
    assert.equal(stars(a).length, told + 1, 'its own ledger\'s last word heard in the grace');
    set(T.endAt + STAR_GRACE_MS); await say(a, { s: 1 });
    assert.equal(stars(a).length, told + 1, 'past the grace, nothing read, kept or said - the alarm says the dawn');
  });
});

test('STAR3 THE DEFENSE, HELD: the gathering, four waves and their breath, the master - its fall believed from the owner - then the hold said once: the ledger kept WITH each earner\'s receipt before a word of it, `hd` to the cell with its earners\' names, each receipt to its account\'s socket here, and the hub told - which says it to everyone online, keeps it for a hello and hands an earner away from the cell its receipt; one who stood and never struck earns none (mutants: the receipts minted after the word; a bystander paid; the hub never told; the receipts not carried to the hub; the level not the speaker\'s)', async () => {
  const { kp, pkcs8 } = await signing();
  await withStar(async (rig) => {
    const { world, r, say, step } = rig;
    r.env.GATE_SIGNING_KEY = pkcs8;
    const hub = world.room(SOCIAL_ROOM);
    const hb2 = hub.connect(); await hub.hello(hb2, 'peer-0002');
    const hz = hub.connect(); await hub.hello(hz, 'peer-0050');   // someone online far away
    const by = r.connect(); await r.hello(by, 'peer-0009', at(PX, PY, 2000));
    // AUDIT WB A10's order: what storage holds at the moment the hold is said
    let keptAtWord = null;
    const sent = by.send.bind(by);
    by.send = (s) => { const m = JSON.parse(s); if (m.t === 'star' && m.k === 'hd') { const v = r.store.get(LED()); keptAtWord = v?.said === true && !!v.rc['acct-peer-0001']; } return sent(s); };
    const a = r.connect(), b = r.connect(), c = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON); await r.hello(c, 'peer-0003', ON);
    let bSays = true;
    const others = [[b, () => (bSays ? { s: 1, lv: 20 } : null)], [c, () => ({ s: 0 })]];
    const sayOthers = { ...rig, say: (ws, o) => (o ? say(ws, o) : null) };
    // the gathering, then the waves - each wave's size by the defenders standing as it starts
    let st = await defend(sayOthers, a, others, { until: (x) => x.p === P_WAVE });
    assert.equal(st.w, 1);
    assert.equal(st.wz, starWaveSize(1, 3), 'three defenders: eight foes');
    assert.equal(st.b, 2, 'the band of the defenders\' levels (12, 20, 12): the second');
    const blows = { hb: 0 };
    st = await defend(sayOthers, a, others, { until: (x) => x.p === P_BREATH, blows });
    assert.ok(st.lt < STAR_LIGHT && st.lt > 0, 'the coven\'s blows drink the light');
    st = await defend(sayOthers, a, others, { until: (x) => x.p === P_MASTER, blows });
    assert.equal(st.w, STAR_WAVES, 'four waves, then the master');
    assert.equal(stars(by, 'hd').length, 0);
    // the master stands; b's link drops before its fall - still an earner, within STAR_PRESENT_MS of it
    st = await defend(sayOthers, a, others, { beats: 18, until: () => false, blows });
    bSays = false;
    await r.drop(b);
    st = await defend(sayOthers, a, others, { blows });
    assert.equal(st.p, P_HELD, 'the master\'s fall holds the star');
    // kept before said
    assert.equal(keptAtWord, true, 'the ledger kept with its receipts before a word of the hold');
    const kept = r.store.get(LED());
    assert.equal(kept.said, true);
    assert.equal(kept.told, true, 'and the hub answered');
    assert.deepEqual(Object.keys(kept.rc).sort(), ['acct-peer-0001', 'acct-peer-0002'], 'the two who struck and stood there; the one who only stood earns none');
    for (const [acct, rc] of Object.entries(kept.rc)) {
      const cl = readStarReceipt(rc);
      assert.equal(cl.s, acct); assert.equal(cl.night, N); assert.equal(cl.star, K); assert.equal(cl.signed, true);
      assert.equal(cl.l, acct === 'acct-peer-0002' ? 20 : 12, 'the level its own last word said');
      assert.equal((await verifyStarReceipt(rc, kp.publicKey, { subtle, nowS: Math.floor(Date.now() / 1000) })).ok, true, 'the relay\'s own signature');
    }
    // said to the cell, once
    const hds = stars(by, 'hd');
    assert.equal(hds.length, 1, 'held, said once');
    assert.deepEqual(hds[0].top, ['peer-0001', 'peer-0002']);
    assert.equal(hds[0].c, 2);
    assert.equal(seen(by).p, P_HELD);
    assert.deepEqual(stars(a, 'rc').map((m) => m.r), [kept.rc['acct-peer-0001']], 'an earner\'s receipt to its socket here');
    assert.deepEqual(stars(c, 'rc'), [], 'none for one who never struck');
    // the hub
    assert.equal(stars(hz, 'hd').length, 1, 'everyone online hears it');
    assert.deepEqual(hub.store.get(STAR_HELD_KEY), [[N, K, PX, PY, hds[0].at]], 'kept for a hello');
    assert.deepEqual(stars(hb2, 'rc').map((m) => m.r), [kept.rc['acct-peer-0002']], 'an earner away from the cell is handed it where it stands');
    assert.deepEqual(hub.store.get(starReceiptKeyOf('acct-peer-0002')).map((e) => e.r), [kept.rc['acct-peer-0002']]);
    // a word after the hold: answered with the ledger, and an earner with its receipt again
    step(STAR_WORD_MS);
    await say(a, ownerWord(seen(a), blows.hb));
    assert.equal(stars(a, 'rc').length, 2, 'its receipt again (a reconnect that missed it)');
    assert.equal(stars(by, 'hd').length, 1, 'and the hold never said twice');
    assert.deepEqual(r.store.get(LED()).rc, kept.rc, 'nor minted twice');
    // a later hello at the hub
    const late = hub.connect(); await hub.hello(late, 'peer-0002');
    assert.deepEqual(stars(late, 'hds')[0].l, [[N, K, PX, PY, hds[0].at]], 'the night\'s held stars');
    assert.deepEqual(stars(late, 'rc').map((m) => m.r), [kept.rc['acct-peer-0002']], 'and its receipt');
  });
});

test('STAR3 THE OWNER\'S WORD ALONE: a wave cleared, the deaths, the blows and the master\'s fall are believed from the owner - the first VERIFIED account to say it owns the foes, until silent STAR_ORPHAN_MS or until it says it no longer does; another\'s word moves none of them (mutants: every speaker one account)', async () => {
  await withStar(async (rig) => {
    const { r, say, step } = rig;
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { o: 1, s: 1 });
    await say(b, { o: 1, s: 1 });
    const led = () => r.room._stars.get(ID());
    assert.equal(led().own, 'acct-peer-0001', 'the first to say so');
    let st = await defend(rig, a, [[b, () => ({ o: 1, s: 1 })]], { until: (x) => x.p === P_WAVE });
    // the wave long past its quickest clearing: b says it cleared, b says its deaths and blows - nothing moves
    for (let i = 0; i < 12; i++) { step(STAR_WORD_MS); await say(a, { o: 1, s: 1 }); await say(b, { o: 1, s: 1, kn: st.wz, wc: st.w, hb: 40 }); }
    assert.equal(led().p, P_WAVE, 'a defender who does not own the foes clears nothing');
    assert.equal(led().kn, 0);
    assert.equal(led().lt, STAR_LIGHT, 'nor drinks the light');
    // a falls silent: b takes the foes once a has said nothing for STAR_ORPHAN_MS
    for (let t = 0; t <= STAR_ORPHAN_MS; t += STAR_WORD_MS) { step(STAR_WORD_MS); await say(b, { o: 1, s: 1 }); }
    assert.equal(led().own, 'acct-peer-0002', 'an owner silent STAR_ORPHAN_MS is no owner');
    st = seen(b);
    step(STAR_WORD_MS); await say(b, { o: 1, s: 1, kn: st.wz, wc: st.w });
    assert.equal(led().p, P_BREATH, 'the owner\'s word clears it');
    // the owner lets go
    step(STAR_WORD_MS); await say(b, { o: 0, s: 1 });
    assert.equal(led().own, '', 'it says it owns them no longer');
    step(STAR_WORD_MS); await say(a, { o: 1, s: 1 });
    assert.equal(led().own, 'acct-peer-0001', 'and the next who says so does');
  });
});

test('STAR3 DAWN: a star nobody holds by its deadline and the grace is lost at dawn by the cell\'s alarm, armed there - nobody need stand there to step it - and said to the cell; the ledger kept STAR_KEEP_MS past its deadline, the cell forgetting nothing else meanwhile, then forgotten (mutants: the deadline never swept; the alarm past the deadline; the cell\'s forgetting runs over a kept star)', async () => {
  await withStar(async ({ r, say, set }) => {
    const by = r.connect(); await r.hello(by, 'peer-0009', at(PX, PY, 2000));
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    await say(a, { s: 1, o: 1 });
    await r.drop(a);
    assert.equal(r.alarm.at, T.endAt + STAR_GRACE_MS, 'the alarm armed for the deadline and the grace - a fall said in flight still holds');
    set(T.endAt + STAR_GRACE_MS);
    await r.fire();
    const st = seen(by);
    assert.equal(st.p, P_LOST);
    assert.equal(st.why, STAR_LOST_DAWN, 'dawn');
    assert.equal(r.store.get(LED()).p, P_LOST, 'kept');
    assert.equal(r.alarm.at, T.endAt + STAR_KEEP_MS, 'then its forgetting');
    // nobody in the cell: its world is forgotten only once its star is
    await r.drop(by);
    r.store.set('world:0', { x: 1 });
    set(T.endAt + 60_000); await r.fire();
    assert.equal(r.store.has('world:0'), true, 'a cell keeping a star forgets nothing yet');
    assert.equal(r.store.has(LED()), true);
    set(T.endAt + STAR_KEEP_MS); await r.fire();
    assert.equal(r.store.has(LED()), false, 'the ledger forgotten');
    assert.equal(r.store.has('world:0'), false, 'and the cell\'s world with it');
  });
});

/** Pixel `i` east of the star's own, in the one cell. */
const px = (i) => ({ px: PX + i });
/** The owner's blows drink star `i`'s light until it is lost, dark - the cheapest way a ledger ends (a forged pixel's). */
async function drain({ r, say, step }, ws, i) {
  for (let hb = 6; r.store.get(LED(px(i)))?.p !== P_LOST && hb < 400; hb += 6) { step(600); await say(ws, { ...px(i), o: 1, hb }); }
  assert.equal(r.store.get(LED(px(i))).p, P_LOST, `star ${i} drained`);
}

test('STAR3 THE CELL\'S PLACES: a cell keeps STAR_LEDGERS_MAX live stars and one account makes STAR_LEDGERS_BY_MAX of them; a star over costs no place and counts to no account, kept to its end and never put out; full, a new star takes the place of the live one stood at least lately that nobody stands at - an account stands where its last word in the cell came from, within STAR_IDLE_MS; with none, it waits (mutants: the account unbounded; an over star costs a place; an account at every star it spoke at; the idle bound dropped; the freshest put out)', async () => {
  await withStar(async (rig) => {
    const { r, say, step } = rig;
    for (let i = 0; i < 8; i++) assert.equal(worldRoom(PX + i, PY), CELL);
    const [a, b, c, d, e, f] = [r.connect(), r.connect(), r.connect(), r.connect(), r.connect(), r.connect()];
    await r.hello(a, 'peer-0001', at(PX)); await r.hello(b, 'peer-0002', at(PX + 3)); await r.hello(c, 'peer-0003', at(PX + 4));
    await r.hello(d, 'peer-0004', at(PX + 5)); await r.hello(e, 'peer-0005', at(PX + 6)); await r.hello(f, 'peer-0006', at(PX + 7));
    await say(a, px(0));
    await r.pose(a, at(PX + 1)); step(600); await say(a, px(1));
    await r.pose(a, at(PX + 2)); step(600); await say(a, px(2));
    assert.deepEqual(ledgers(r), [LED(px(0)), LED(px(1))], 'one account makes two live');
    // one of a's is lost: it keeps its ledger, costs no place, counts to nothing - a makes its third
    await r.pose(a, at(PX + 1)); await drain(rig, a, 1);
    await r.pose(a, at(PX + 2)); step(600); await say(a, px(2));
    assert.deepEqual(ledgers(r), [LED(px(0)), LED(px(1)), LED(px(2))], 'a third, its lost one kept');
    await say(b, px(3)); step(600); await say(c, px(4));   // c's stood at a moment later than b's
    assert.equal(ledgers(r).length, STAR_LEDGERS_MAX + 1, 'four live and one over: the over one took no place');
    // full: a stands at its third now, b and c at theirs - a's first, left for its third, gives its place
    step(600); await say(d, px(5));
    assert.deepEqual(ledgers(r), [LED(px(1)), LED(px(2)), LED(px(3)), LED(px(4)), LED(px(5))], 'the live star nobody stands at gave its place; the lost one kept');
    // b and c fall silent past STAR_IDLE_MS while a and d stand at theirs: the one stood at least lately goes first
    for (let t = 0; t <= STAR_IDLE_MS; t += STAR_WORD_MS) { step(STAR_WORD_MS); await say(a, px(2)); await say(d, px(5)); }
    await say(e, px(6));
    assert.deepEqual(ledgers(r), [LED(px(1)), LED(px(2)), LED(px(4)), LED(px(5)), LED(px(6))], 'b\'s star, stood at least lately, gave its place');
    // c speaks again at its own: every place stood at - the next star waits
    step(STAR_WORD_MS); await say(c, px(4)); await say(a, px(2)); await say(d, px(5)); await say(e, px(6));
    await say(f, px(7));
    assert.equal(r.store.has(LED(px(7))), false, 'every live star stood at: it waits');
    assert.equal(r.store.get(LED(px(1))).p, P_LOST, 'and the star over is kept through it all');
    assert.equal(STAR_LEDGERS_BY_MAX, 2);
  });
});

test('STAR3 A FORGED PIXEL STANDS IN NO OTHER\'S WAY: two accounts that make two stars each of pixels the law places none in, and drive them lost, hold no place against the real star - its first defender makes its ledger at once, and it is defended to its end (mutants: an over star costs a place)', async () => {
  await withStar(async (rig) => {
    const { r, say, step, set } = rig;
    const g1 = r.connect(), g2 = r.connect();
    await r.hello(g1, 'grief-0001', at(PX + 3)); await r.hello(g2, 'grief-0002', at(PX + 5));
    for (const [ws, i] of [[g1, 3], [g1, 4], [g2, 5], [g2, 6]]) {
      await r.pose(ws, at(PX + i)); step(600); await say(ws, px(i));
      await drain(rig, ws, i);
    }
    assert.deepEqual(ledgers(r), [3, 4, 5, 6].map((i) => LED(px(i))), 'four forged stars, lost and kept');
    // the honest player at the real star
    const h = r.connect(); await r.hello(h, 'honest-0001', ON);
    step(2000); await say(h, { o: 1, s: 1 });
    assert.equal(r.store.has(LED()), true, 'the real star\'s ledger made at once');
    assert.equal(seen(h).p, P_GATHER, 'and the coven gathers');
    for (const [ws, i] of [[g1, 3], [g1, 4]]) { step(600); await say(ws, px(i)); }
    set(T.endAt - 1000); await say(h, { o: 1, s: 1 });
    assert.equal(r.store.has(LED()), true, 'kept to its deadline');
    assert.deepEqual(ledgers(r).filter((k) => r.store.get(k).p === P_LOST), [3, 4, 5, 6].map((i) => LED(px(i))), 'the forged ones kept to their end - none fought again');
  });
});

test('STAR3 THE NIGHT\'S THIRD STAR: one account that made the night\'s first two stars in a cell makes its third as it lands - the first, at its deadline then, holds no place - and the cell\'s places count only stars still standing (mutants: a star past its deadline holds its place; an over star costs a place)', async () => {
  await withStar(async ({ r, set, step }) => {
    const atK = (k, x) => { const [nx, nz] = starNativeOf(N, k, x, PY); return { x: nx, y: 0, z: nz, yaw: 0, pitch: 0 }; };
    const sites = [[0, PX], [1, PX + 5], [2, PX + 10]];
    for (const [, x] of sites) assert.equal(worldRoom(x, PY), CELL);
    const a = r.connect(); await r.hello(a, 'solo-0001', atK(0, PX));
    for (const [k, x] of sites) {
      set(starTimes(N, k).fallAt + 1000);
      await r.pose(a, atK(k, x)); step(600);
      await r.raw(a, JSON.stringify({ t: 'star', ...word({ k, px: x, o: 1, s: 1 }) }));
      assert.equal(r.store.has(starLedgerKey(starLedgerId({ n: N, k, px: x, py: PY }))), true, `star ${k} made as it lands`);
    }
    assert.equal(starTimes(N, 2).fallAt, starTimes(N, 0).endAt, 'the third lands on the first\'s deadline');
  });
});

test('STAR3 A STAR STOOD AT KEEPS ITS PLACE: a defender standing at the real star keeps it its place however many stars others make about it - a star somebody stands at is never put out, so N accounts hold at most N places, and with every place stood at a new star waits; a star whose speaker\'s last word came from off it, or whose maker has gone to make another, is stood at by nobody (mutants: a stood-at star put out; a far word stands; the maker stands where it was)', async () => {
  await withStar(async (rig) => {
    const { r, say, step } = rig;
    const h = r.connect(); await r.hello(h, 'honest-0001', ON);
    const tick = async () => { step(600); await say(h, { o: 1, s: 1 }); };
    await say(h, { o: 1, s: 1 });
    const [g1, g2, g3, g4] = [r.connect(), r.connect(), r.connect(), r.connect()];
    await r.hello(g1, 'grief-0001', at(PX + 1)); await r.hello(g2, 'grief-0002', at(PX + 3));
    await r.hello(g3, 'grief-0003', at(PX + 4)); await r.hello(g4, 'grief-0004', at(PX + 5));
    await tick(); await say(g1, px(1));
    await r.pose(g1, at(PX + 2)); await tick(); await say(g1, px(2));
    await tick(); await say(g2, px(3));
    assert.equal(ledgers(r).length, STAR_LEDGERS_MAX, 'full');
    await tick(); await say(g3, px(4));
    assert.deepEqual(ledgers(r), [LED(), LED(px(2)), LED(px(3)), LED(px(4))].sort(), 'the forged star its maker left gave its place; the real star kept');
    // four accounts, each standing at its own: four places held - the fifth waits
    await tick(); await say(g1, px(2)); await say(g2, px(3)); await say(g3, px(4));
    await say(g4, px(5));
    assert.equal(r.store.has(LED(px(5))), false, 'every place stood at: it waits');
    // g1's last word comes from off its star: it stands at none
    await r.pose(g1, at(PX + 2, PY, STAR_REACH_M + 5)); await tick(); await say(g1, px(2));
    await say(g4, px(5));
    assert.deepEqual(ledgers(r), [LED(), LED(px(3)), LED(px(4)), LED(px(5))].sort(), 'a word from off a star stands nobody at it');
    // g3 goes to make another: the star it made and spoke at last is its no longer
    await r.pose(g3, at(PX + 6)); await tick(); await say(g2, px(3)); await say(g4, px(5));
    await say(g3, px(6));
    assert.deepEqual(ledgers(r), [LED(), LED(px(3)), LED(px(5)), LED(px(6))].sort(), 'its maker stands at the new one');
    assert.equal(seen(h).p, P_GATHER, 'and the real star stood through it all');
  });
});

test('STAR3 THE KEPT STARS NEVER CROWD THE LIVE ONES OUT: what a cell keeps over is bounded - a ledger is made once, from its star\'s landing to its deadline, so 256 pixels by a night\'s three stars, one night at a time - and none of it is held in hand: a live star\'s copy stays the one its words fold into through a new star\'s listing, a sweep, and the forgetting of hundreds (mutants: a settled star held in hand; the forgotten held in hand at a sweep; the forgotten held in hand at a new star)', async () => {
  assert.ok(starTimes(N, STAR_PER_NIGHT - 1).endAt + STAR_KEEP_MS < starTimes(N + 1, 0).fallAt, 'one night\'s stars kept at a time');
  const T2 = starTimes(N, 2), T0 = starTimes(N, 0);
  const atK = (k, x) => { const [nx, nz] = starNativeOf(N, k, x, PY); return { x: nx, y: 0, z: nz, yaw: 0, pitch: 0 }; };
  const keepLost = (r) => {   // the first star's forged pixels, twenty of them, lost and kept
    for (let i = 0; i < 20; i++) {
      const led = newStarLedger(word({ k: 0, px: 96 + (i % 16), py: 192 + Math.floor(i / 16) }), T0.fallAt + 1000, `acct-grief-${i}`);
      led.p = P_LOST; led.lo = T0.fallAt + 9000; led.why = STAR_LOST_DARK;
      r.store.set(starLedgerKey(starLedgerId(led)), structuredClone(led));
    }
  };
  for (const forget of ['make', 'sweep']) {
    await withStar(async ({ r, set, step }) => {
      keepLost(r);
      const h = r.connect(), m = r.connect();
      await r.hello(h, 'honest-0001', atK(2, PX)); await r.hello(m, 'maker-0001', atK(2, PX + 1));
      await r.raw(h, JSON.stringify({ t: 'star', ...word({ k: 2, o: 1, s: 1 }) }));
      const id = starLedgerId({ n: N, k: 2, px: PX, py: PY });
      const mine = r.room._stars.get(id);
      assert.ok(mine && mine.k === 2, 'the live star in hand');
      step(600); await r.raw(m, JSON.stringify({ t: 'star', ...word({ k: 2, px: PX + 1 }) }));
      assert.equal(r.room._stars.get(id), mine, 'a new star listed the twenty: the live copy kept');
      set(T0.endAt + STAR_KEEP_MS);
      if (forget === 'make') { const n2 = r.connect(); await r.hello(n2, 'maker-0002', atK(2, PX + 2)); await r.raw(n2, JSON.stringify({ t: 'star', ...word({ k: 2, px: PX + 2 }) })); }
      else await r.fire();
      assert.equal(ledgers(r).filter((k) => k.startsWith(`star:${N}.0@`)).length, 0, `the twenty forgotten (${forget})`);
      assert.equal(r.room._stars.get(id), mine, `the live copy kept through their forgetting (${forget})`);
      await r.raw(h, JSON.stringify({ t: 'star', ...word({ k: 2, o: 1, s: 1 }) }));
      assert.equal(r.room._stars.get(id), mine);
    }, T2.fallAt + 1000);
  }
});

test('STAR3 MY OWN BLOWS: the ledger said to the socket that spoke carries its own account\'s credited blows (`hm`) - in the fan and in the answer to a word that moved nothing - so a reloaded or new device counts on from them, owner or not; everyone else hears the shared ledger without it (mutants: my blows to everyone; my blows unsaid; the owner\'s blows for mine)', async () => {
  await withStar(async ({ r, say, step }) => {
    const by = r.connect(); await r.hello(by, 'peer-0009', at(PX, PY, 2000));
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    await say(a, { o: 1, s: 1 }); await say(b, { s: 1 });
    step(STAR_WORD_MS); await say(a, { o: 1, s: 1, hb: 5 });
    assert.equal(seen(a).hm, 5, 'the owner\'s own credited blows, in its copy of the fan');
    assert.equal(seen(a).hc, 5);
    assert.equal('hm' in seen(by), false, 'a bystander hears the shared ledger');
    assert.equal('hm' in seen(b), false, 'and so does a defender who did not speak');
    step(STAR_WORD_MS); await say(b, { s: 1 });
    assert.equal(seen(b).hm, 0, 'a word that moved nothing: answered with its own count, not the owner\'s');
    assert.equal(seen(b).hc, 5);
    const mine = { ...seen(a) }; delete mine.t;
    assert.deepEqual(validStarOut(mine), mine, 'the wire\'s own word');
  });
});

test('STAR3 A WAKE: a cell that hibernates mid-fight reads its star back from storage and fights on to the hold, minted once; a star held keeps its receipts through a wake (mutants: the ledger never written as it moves)', async () => {
  const { pkcs8 } = await signing();
  await withStar(async (rig) => {
    const { r, say, step } = rig;
    r.env.GATE_SIGNING_KEY = pkcs8;
    const a = r.connect(); await r.hello(a, 'peer-0001', ON);
    const blows = { hb: 0 };
    await defend(rig, a, [], { until: (x) => x.p === P_BREATH, blows });
    const before = r.room._stars.get(ID());
    r.wake();
    assert.equal(r.room._stars.size, 0, 'a fresh object');
    step(STAR_WORD_MS);
    await say(a, ownerWord(seen(a), blows.hb));
    const after = r.room._stars.get(ID());
    assert.equal(after.w, before.w, 'its waves');
    assert.ok(Math.abs(after.ec - before.ec) <= 5000 + STAR_WORD_MS, 'its encounter clock, within a write\'s worth');
    assert.equal(after.lt, before.lt, 'its light');
    const st = await defend(rig, a, [], { blows });
    assert.equal(st.p, P_HELD);
    const rc = r.store.get(LED()).rc['acct-peer-0001'];
    assert.ok(rc);
    r.wake();
    step(STAR_WORD_MS);
    await say(a, ownerWord(seen(a), blows.hb));
    assert.equal(r.store.get(LED()).rc['acct-peer-0001'], rc, 'never minted again');
    assert.equal(stars(a, 'rc').at(-1).r, rc, 'and handed again');
  });
});

test('STAR3 MINTED ONCE: the master\'s fall mints its receipts once - the alarm\'s sweep that meets the star mid-mint leaves it to the word minting it, and a word that lands meanwhile is not heard; the hold is said when the mint is done (mutants: the sweep mints again mid-mint)', async () => {
  const { pkcs8 } = await signing();
  await withStar(async (rig) => {
    const { r, say, step } = rig;
    r.env.GATE_SIGNING_KEY = pkcs8;
    const by = r.connect(); await r.hello(by, 'peer-0009', at(PX, PY, 2000));
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON);
    const blows = { hb: 0 };
    const others = [[b, () => ({ s: 1 })]];
    await defend(rig, a, others, { until: (x) => x.p === P_MASTER, blows });
    await defend(rig, a, others, { beats: 21, until: () => false, blows });   // the master stood 42 s: the next words fell it
    // the mint held open until the alarm has fired
    let release;
    const gate = new Promise((res) => { release = res; });
    const keyOf = r.room._receiptKeyOf.bind(r.room);
    r.room._receiptKeyOf = async () => { await gate; return keyOf(); };
    const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((res) => setImmediate(res)); };
    step(4 * STAR_WORD_MS);
    const fall = say(a, { ...ownerWord(seen(a), blows.hb), mf: 1 });
    await settle();
    assert.equal(r.room._starHolding.has(ID()), true, 'the fall\'s word is minting');
    await r.fire();
    const bHad = stars(b).length;
    await say(b, { s: 1 });
    assert.equal(stars(b).length, bHad, 'a word mid-mint is not heard');
    assert.equal(stars(by, 'hd').length, 0, 'and nothing said yet');
    release();
    await fall;
    assert.equal(stars(by, 'hd').length, 1, 'the hold said once');
    assert.equal(stars(a, 'rc').length, 1, 'its receipt handed once');
    assert.equal(r.store.get(LED()).said, true);
  });
});

// ═══ THE HUB ══════════════════════════════════════════════════════════════════════════════════════

test('STAR3 THE HUB: a hold told again is neither said nor kept twice; a receipt is kept only signed, for its own account and its own star; one told after its night keeps its receipts and says nothing; a night\'s held stars go once its last star is gone; the sweep lets a spent keep go; a hello hands the list and the account\'s receipts (mutants: told twice said twice; another account\'s receipt kept; an unsigned one kept; the night kept for ever; the sweep blind)', async () => {
  const { kp } = await signing();
  const priv = kp.privateKey;
  await withStar(async ({ world, now }) => {
    const hub = world.room(SOCIAL_ROOM);
    const h = hub.connect(); await hub.hello(h, 'peer-0001');
    const nowS = Math.floor(now() / 1000);
    const mint = (s, k = K, key = priv) => mintStarReceipt({ n: N, k, s, c: 7, l: 9 }, key, { subtle, nowS });
    const tell = (o) => hub.room._starHeldInternal(new Request(`https://relay.internal${STAR_INTERNAL_HELD}`, { method: 'POST', body: JSON.stringify({ k: 'hd', n: N, s: K, px: PX, py: PY, at: T.fallAt + 60_000, top: ['peer-0001'], c: 1, ...o }) }));
    const mine = await mint('acct-peer-0001');
    const res = await tell({ rc: { 'acct-peer-0001': mine, 'acct-peer-0002': await mint('acct-peer-0003'), 'acct-peer-0004': await mint('acct-peer-0004', 1), 'acct-peer-0005': await mint('acct-peer-0005', K, null) } });
    assert.equal(res.status, 200);
    assert.equal(stars(h, 'hd').length, 1);
    assert.deepEqual(stars(h, 'rc').map((m) => m.r), [mine]);
    assert.deepEqual(hub.store.get(starReceiptKeyOf('acct-peer-0001')).map((e) => e.r), [mine]);
    for (const acct of ['acct-peer-0002', 'acct-peer-0004', 'acct-peer-0005']) assert.equal(hub.store.has(starReceiptKeyOf(acct)), false, `${acct}: another account's, another star's, or unsigned - not kept`);
    await tell({ rc: { 'acct-peer-0001': mine } });
    assert.equal(stars(h, 'hd').length, 1, 'told again: not news');
    assert.equal(stars(h, 'rc').length, 1, 'and nothing handed twice');
    assert.equal(hub.store.get(STAR_HELD_KEY).length, 1);
    assert.equal((await tell({ s: 9 })).status, 400, 'a word the wire would not carry');
    // a later night's tell after its night is gone: receipts kept, nothing said
    const late = await mintStarReceipt({ n: N, k: 1, s: 'acct-peer-0001', c: 8, l: 9 }, priv, { subtle, nowS });
    const realNow = Date.now; const t = starNightGoneAt(N);
    Date.now = () => t;
    try { await tell({ s: 1, rc: { 'acct-peer-0001': late } }); } finally { Date.now = realNow; }
    assert.equal(stars(h, 'hd').length, 1, 'nothing said of a night gone');
    assert.equal(hub.store.get(starReceiptKeyOf('acct-peer-0001')).length, 2, 'its receipt kept');
    // the list, a hello, and the night's end
    const again = hub.connect(); await hub.hello(again, 'peer-0001');
    assert.equal(stars(again, 'hds')[0].l.length, 1);
    assert.equal(stars(again, 'rc').length, 2, 'every receipt kept for it');
    assert.deepEqual(await hub.room._starHeldOf(starNightGoneAt(N)), [], 'gone with its night\'s last star');
    // the sweep
    hub.store.set(starReceiptKeyOf('acct-gone'), [{ r: 'j1.x.y', until: now() - 1 }]);
    await hub.room._sweepHub(now());
    assert.equal(hub.store.has(starReceiptKeyOf('acct-gone')), false, 'the sweep let it go');
    assert.equal(hub.store.has(starReceiptKeyOf('acct-peer-0001')), true, 'a live keep stays');
    const had = stars(again, 'rc').length;
    await hub.room._starReceiptsTo(again, 'acct-peer-0001', starNightGoneAt(N) + STAR_RC_KEEP_MS);   // the hello's own door, a day past the later keep
    assert.equal(stars(again, 'rc').length, had, 'a day on, nothing handed');
    assert.equal(hub.store.has(starReceiptKeyOf('acct-peer-0001')), false, 'and let go');
    assert.equal(STAR_RC_KEEP, 9);
  });
});

// ═══ THE SESSION ══════════════════════════════════════════════════════════════════════════════════

test('STAR3 THE SESSION: a star word goes down the socket of the star\'s cell - my own or a halo\'s - only when that socket\'s own relay keeps a star; a cell\'s ledger is heard from a cell, the night\'s held list from the hub, a hold and a receipt from either (mutants: the halo sent on the primary\'s word; the hub\'s list heard from a cell)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = T.fallAt;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const log = console.info; console.info = () => {};
  try {
    s.join(CELL, { x: ON.x, y: 0, z: ON.z, yaw: 0 });
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: `world${STAR_RELAY_MIN - 1}` });
    assert.equal(s.starReady(CELL), false);
    assert.equal(s.sendStar(word(), CELL), false, 'an older relay would close the socket for it');
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
    assert.equal(s.sendStar(word(), CELL), true);
    assert.equal(sockets[0].sent.filter((x) => JSON.parse(x).t === 'star').length, 1);
    assert.equal(s.sendStar(word({ k: 7 }), CELL), false, 'a word the wire would refuse');
    const other = worldRoom(PX + 16, PY);
    s.setHalo([other]);
    const halo = sockets[1];
    halo.open();
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: `world${STAR_RELAY_MIN - 1}` });
    t += 1000;
    assert.equal(s.sendStar(word({ px: PX + 16 }), other), false, 'the halo\'s own relay would close the socket for it');
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION });
    const before = sockets[0].sent.filter((x) => JSON.parse(x).t === 'star').length;
    assert.equal(s.sendStar(word({ px: PX + 16 }), other), true);
    assert.equal(halo.sent.filter((x) => JSON.parse(x).t === 'star').length, 1, 'down the halo\'s socket');
    assert.equal(sockets[0].sent.filter((x) => JSON.parse(x).t === 'star').length, before, 'never the primary\'s');
    // what is heard, and from where
    const heard = [];
    s.onStar = (w, room) => heard.push([w.k, room]);
    const st = { t: 'star', k: 'st', n: N, s: K, px: PX, py: PY, p: P_WAVE, w: 1, wz: 4, kn: 0, wl: 1000, lt: 100, nd: 1, b: 1, ow: 1, hc: 0, hd: 0, lo: 0, why: 0 };
    sockets[0].receive(st);
    sockets[0].receive({ t: 'star', k: 'hds', l: [[N, K, PX, PY, 5]] });
    sockets[0].receive({ t: 'star', k: 'hd', n: N, s: K, px: PX, py: PY, at: 5, top: [], c: 1 });
    sockets[0].receive({ t: 'star', k: 'rc', r: 'j1.abc.' });
    assert.deepEqual(heard, [['st', CELL], ['hd', CELL], ['rc', CELL]], 'a cell says no held list');
  } finally { console.info = log; }
});
