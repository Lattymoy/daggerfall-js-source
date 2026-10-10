// SD9a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE HOUR'S RECEIPT - the
// relay's signature on the Brass Remnant's fall (net/sdReceipt.js, an `h1`), minted in the realm for each fighter who
// earned it (the gate's `earned`) before the fall is said, handed to them there and again at a late `in`, kept by the hub
// for its life (held from a realm fighter's hellos while its floor spends it; handed at once to every other earner's
// newest socket; spent at the account's word), swept when it expires - and the page's half: its receipt heard from its
// own realm or the hub, and its spoils said spent to the hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  SD_RECEIPT_V, SD_RECEIPT_TTL_S, SD_RECEIPT_MAX, SD_EARNED, SD_RECEIPT_BOSS, SD_RECEIPT_SLOT_MAX, SD_RECEIPT_LV_MAX,
  sdReceiptValid, mintSdReceipt, readSdReceipt, verifySdReceipt,
} from '../src/net/sdReceipt.js';
import { mintReceipt, verifyReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { mintSerpentReceipt, verifySerpentReceipt, readSerpentReceipt } from '../src/net/serpentReceipt.js';
import { readReceipt } from '../src/net/gateReceipt.js';
import {
  validSdIn, validSdOut, validSdFellTell, SD_KINDS, SD_OUT_KINDS, SD_SLOT_MAX, SD_RECEIPT_WIRE_MAX, SD_RC_PREFIX, sdReceiptKey,
  SD_HERE_HOLD_MS, SD_FIGHT_KEY, SD_KEY, SD_BRAIN_V, SOCIAL_ROOM, worldRoom, PIXEL_UNITS, RELAY_VERSION,
} from '../src/net/wire.js';
import { realmToDungeon, SD_ARENA } from '../src/net/sdBrain.js';
import { SD_OPENING_MS } from '../src/net/sdRemnant.js';
import { HIT_KINDS, RECEIPT_SHARE } from '../src/net/gateBrain.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { fakeRooms } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';

const subtle = webcrypto.subtle;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const T0 = 1_800_000_000_000, T0S = T0 / 1000;
const keypair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
async function relayKeys() {
  const kp = await keypair();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  return { pkcs8, priv: await importReceiptKey(pkcs8, { subtle }), pub: kp.publicKey };
}
const CLAIM = { d: 7, s: 'acct-ann', c: 12345, x: 'dealt', l: 30 };

// ── the receipt ───────────────────────────────────────────────────────

test('SD9a THE RECEIPT: an `h1` - its slot, the Remnant, the account, the seed, how it was earned, the level, issued and a week to expiry - minted signed or (no key) unsigned, read by the page signed or not, verified by the service rung for rung; never confused with a gate\'s or a serpent\'s receipt either way, nor with another signed shape\'s fields (mutants: another boss believed; a serpent\'s hull let through; the version unread; an expired one good)', async () => {
  const { priv, pub } = await relayKeys();
  assert.equal(SD_RECEIPT_V, 'h1'); assert.equal(SD_RECEIPT_TTL_S, 7 * 24 * 3600); assert.equal(SD_RECEIPT_BOSS, 'remnant');
  assert.deepEqual([...SD_EARNED], ['dealt', 'stood']);
  assert.equal(SD_RECEIPT_MAX, SD_RECEIPT_WIRE_MAX, 'the wire\'s bound is the receipt\'s');
  assert.equal(SD_RECEIPT_SLOT_MAX, SD_SLOT_MAX, 'and its slots the record\'s');
  const r = await mintSdReceipt(CLAIM, priv, { subtle, nowS: T0S });
  assert.match(r, /^h1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(r.length <= SD_RECEIPT_MAX);
  const c = readSdReceipt(r);
  assert.deepEqual(c, { d: 7, b: 'remnant', s: 'acct-ann', c: 12345, x: 'dealt', l: 30, i: T0S, e: T0S + SD_RECEIPT_TTL_S, signed: true });
  const v = await verifySdReceipt(r, pub, { subtle, nowS: T0S + 60 });
  assert.equal(v.ok, true);
  assert.equal(v.claims.s, 'acct-ann');
  const bare = await mintSdReceipt(CLAIM, null, { subtle, nowS: T0S });
  assert.match(bare, /^h1\.[A-Za-z0-9_-]+\.$/, 'no key: unsigned');
  assert.equal(readSdReceipt(bare).signed, false, 'the page still reads its seed');
  assert.deepEqual(await verifySdReceipt(bare, pub, { subtle, nowS: T0S }), { ok: false, why: 'unsigned' });
  assert.deepEqual(await verifySdReceipt(r, pub, { subtle, nowS: T0S + SD_RECEIPT_TTL_S }), { ok: false, why: 'expired' });
  assert.deepEqual(await verifySdReceipt(r, pub, { subtle, nowS: T0S - 3600 }), { ok: false, why: 'future' });
  assert.deepEqual(await verifySdReceipt(r, pub, { subtle, nowS: NaN }), { ok: false, why: 'clock' });
  const [, body, sig] = r.split('.');
  assert.deepEqual(await verifySdReceipt(`h1.${body}.${sig.slice(0, -4)}AAAA`, pub, { subtle, nowS: T0S }), { ok: false, why: 'signature' });
  // the other receipts: never one for another
  const gate = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-ann', c: 1, x: 'dealt', l: 30 }, priv, { subtle, nowS: T0S });
  const serp = await mintSerpentReceipt({ d: 700, b: 'sethrakul', s: 'acct-ann', c: 1, x: 'dealt', h: 2, l: 30 }, priv, { subtle, nowS: T0S });
  assert.deepEqual(await verifySdReceipt(gate, pub, { subtle, nowS: T0S }), { ok: false, why: 'version' });
  assert.deepEqual(await verifySdReceipt(serp, pub, { subtle, nowS: T0S }), { ok: false, why: 'version' });
  assert.equal((await verifyReceipt(r, pub, { subtle, nowS: T0S })).ok, false, 'the gate\'s verifier refuses an h1');
  assert.equal((await verifySerpentReceipt(r, pub, { subtle, nowS: T0S })).ok, false, 'and the serpent\'s');
  assert.equal(readReceipt(r), null); assert.equal(readSerpentReceipt(r), null); assert.equal(readSdReceipt(gate), null);
  assert.equal(readSdReceipt(`r1.${r.split('.')[1]}.`), null, 'an h1\'s own body under another\'s version is not read');
  assert.deepEqual(await verifySdReceipt(`h1.${gate.split('.')[1]}.${gate.split('.')[2]}`, pub, { subtle, nowS: T0S }), { ok: false, why: 'signature' }, 'a gate\'s body relabelled: its signature was over r1');
  // the claims' shape
  const good = { ...CLAIM, b: 'remnant', i: T0S, e: T0S + 100 };
  assert.equal(sdReceiptValid(good), true);
  for (const bad of [{ b: 'ruhn' }, { b: 'sethrakul' }, { d: 0 }, { d: SD_RECEIPT_SLOT_MAX + 1 }, { x: 'rite' }, { l: 0 }, { l: SD_RECEIPT_LV_MAX + 1 }, { s: 'x' }, { c: -1 }, { c: 2 ** 32 }, { e: T0S }, { e: T0S + SD_RECEIPT_TTL_S + 1 },
    { h: 2 }, { r: 1 }, { w: 1 }, { y: 1 }, { t: 'x' }, { n: 'x' }, { k: 'x' }, { o: 1 }]) assert.equal(sdReceiptValid({ ...good, ...bad }), false, JSON.stringify(bad));
  await assert.rejects(() => mintSdReceipt({ ...CLAIM, x: 'rite' }, priv, { subtle, nowS: T0S }), 'never minted bad');
});

test('SD9a THE WIRE: a client says a slot\'s spoils `spent`; the realm and the hub say an `h1` receipt (bounded, signed or not - nothing else\'s); the fall\'s tell to the hub carries its receipts and who stood in the realm, each projected - an account\'s id, the wire\'s own receipts alone (mutants: an r1 let through; the tell\'s receipts unbounded)', async () => {
  assert.ok(SD_KINDS.includes('spent') && SD_OUT_KINDS.includes('rcpt'));
  assert.deepEqual(validSdIn({ k: 'spent', s: 7, x: 1 }), { k: 'spent', s: 7 });
  for (const s of [0, -1, SD_SLOT_MAX + 1, 1.5, '7']) assert.equal(validSdIn({ k: 'spent', s }), null);
  const bare = await mintSdReceipt(CLAIM, null, { subtle, nowS: T0S });
  assert.deepEqual(validSdOut({ k: 'rcpt', r: bare, x: 1 }), { k: 'rcpt', r: bare });
  const gate = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-ann', c: 1, x: 'dealt', l: 30 }, null, { subtle, nowS: T0S });
  assert.equal(validSdOut({ k: 'rcpt', r: gate }), null, 'a gate\'s is not the Hour\'s');
  assert.equal(validSdOut({ k: 'rcpt', r: 'h1.' + 'a'.repeat(SD_RECEIPT_WIRE_MAX) + '.' }), null, 'bounded');
  assert.equal(validSdOut({ k: 'rcpt', r: 'h1..' }), null);
  const t = validSdFellTell({ s: 7, at: T0, top: 'Ann', n: 2, rc: [['acct-ann', bare], ['acct-bo', gate], ['x', bare], [5, bare], 'junk'], here: ['acct-ann', 'x', 7, 'acct-bo'] });
  assert.deepEqual(t.rc, [['acct-ann', bare]], 'the wire\'s own receipts, each to an account');
  assert.deepEqual(t.here, ['acct-ann', 'acct-bo']);
  assert.equal(validSdFellTell({ s: 7, at: T0, top: 'Ann', n: 2, rc: Array.from({ length: 400 }, () => ['acct-ann', bare]) }).rc.length, 256, 'bounded');
  assert.equal(sdReceiptKey('acct-ann'), `${SD_RC_PREFIX}acct-ann`);
  assert.equal(SD_HERE_HOLD_MS, 2 * 60 * 1000, 'the gate\'s hold');
});

// ── the relay ─────────────────────────────────────────────────────────

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0 }; };
const sds = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev');
const rcpts = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k === 'rcpt').map((m) => m.r);
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome') && !ws.closed;
const say = (o) => JSON.stringify({ t: 'sd', ...o });
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room('chat:r17'); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }   // AUDIT SD: past the Orrery, kept as a realm keeps it - the fight's door asks its Concord (PIN MOVED)
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      await fn({ world, hub, realm, rec, beat, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD9a THE RELAY SIGNS THE FALL: each fighter who earned it - who dealt its share\'s part, or stood alive in the arena half the fight - is minted an `h1` before the fall is said, signed by the relay\'s key, handed in the realm after the fall and again at a late `in`; one who earned nothing has none; the fight keeps them, and who stood there (mutants: a receipt to one who earned nothing; minted after the fall was said; the late `in` handed nothing)', async () => {
  const { pkcs8, pub } = await relayKeys();
  await withRealm(async ({ realm, rec, beat }) => {
    realm.env.GATE_SIGNING_KEY = pkcs8;
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -6), { name: 'Ann' });
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(3, -6), { name: 'Bo' });
    for (const ws of [ann, bo]) await realm.raw(ws, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    await beat(SD_OPENING_MS + 2000);
    const cy = realm.connect(); await realm.hello(cy, 'peer-cy', inArenaAt(-3, -6), { name: 'Cy' });
    await realm.raw(cy, say({ k: 'in', lv: 20, bv: SD_BRAIN_V }));   // in at the last moment: stood nothing, dealt nothing
    const f = realm.room._sdFight;
    assert.ok(f.players['acct-peer-cy'], 'Cy fights - and has earned nothing');
    f.players['acct-peer-ann'].dealt = f.players['acct-peer-ann'].share * RECEIPT_SHARE * 2;   // Ann dealt her part
    f.phase = 3; f.outUntil = 0; f.ec = null; f.hp = 30; f.resetAt = Date.now() + 600_000;
    const fan = realm.room._sdFightFan.bind(realm.room);
    let keptAtFall = null;
    realm.room._sdFightFan = (ws) => { if (ws.some((w) => w.k === 'fell')) keptAtFall ??= realm.store.get(SD_FIGHT_KEY); return fan(ws); };
    await realm.raw(bo, say({ k: 'hit', q: 9, d: 50, r: HIT_KINDS.Spell }));
    const fellAt = sds(ann).findIndex((m) => m.k === 'fell');
    assert.ok(fellAt >= 0, 'fallen');
    assert.deepEqual(Object.keys(keptAtFall?.rc ?? {}).sort(), ['acct-peer-ann', 'acct-peer-bo'], 'its receipts kept before the fall is said');
    const ra = rcpts(ann), rb = rcpts(bo);
    assert.equal(ra.length, 1); assert.equal(rb.length, 1);
    assert.ok(sds(ann).findIndex((m) => m.k === 'rcpt') > fellAt, 'handed after the fall');
    assert.deepEqual(rcpts(cy), [], 'Cy earned nothing');
    const va = await verifySdReceipt(ra[0], pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
    const vb = await verifySdReceipt(rb[0], pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(va.ok && vb.ok, 'signed by the relay\'s key');
    assert.deepEqual([va.claims.d, va.claims.s, va.claims.x, va.claims.l], [rec.s, 'acct-peer-ann', 'dealt', 30]);
    assert.deepEqual([vb.claims.s, vb.claims.x], ['acct-peer-bo', 'stood']);
    assert.notEqual(va.claims.c, vb.claims.c, 'a seed each');
    const kept = realm.store.get(SD_FIGHT_KEY);
    assert.deepEqual(Object.keys(kept.rc).sort(), ['acct-peer-ann', 'acct-peer-bo'], 'kept with the fall');
    assert.deepEqual([...kept.here].sort(), ['acct-peer-ann', 'acct-peer-bo'], 'and who stood there');
    // a late `in`: the fall, and the receipt again
    await realm.raw(bo, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.deepEqual(sds(bo).slice(-2).map((m) => m.k), ['st', 'rcpt']);
    assert.equal(sds(bo).at(-1).r, rb[0], 'the same receipt');
    await realm.raw(cy, say({ k: 'in', lv: 20, bv: SD_BRAIN_V }));
    assert.equal(sds(cy).at(-1).k, 'st', 'Cy: the fall alone');
  });
});

test('SD9a THE HUB KEEPS THEM: told the fall, it keeps each earner\'s receipt for its life - held from the hellos of one who stood in the realm while its floor spends it, handed at once to every other earner\'s newest socket, never over a newer slot\'s or its account\'s word that it is spent; a hello hands a good one, never a spent or expired one; `spent` from the hub alone (anywhere else junk); the sweep forgets the expired (mutants: no hold; handed to a realm fighter\'s tab; the spent mark ignored; an expired one handed)', async () => {
  const { pkcs8 } = await relayKeys();
  await withRealm(async ({ hub, realm, rec, beat, step }) => {
    realm.env.GATE_SIGNING_KEY = pkcs8;
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -6), { name: 'Ann' });
    const dee = realm.connect(); await realm.hello(dee, 'peer-dee', inArenaAt(3, -6), { name: 'Dee' });
    for (const ws of [ann, dee]) await realm.raw(ws, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    await beat(SD_OPENING_MS + 2000);
    // Dee stood her part and left the realm for the town; her hub socket stays
    const deeHub = hub.connect(); await hub.hello(deeHub, 'peer-dee', null, { name: 'Dee' });
    step(1000);
    const deeHub2 = hub.connect(); await hub.hello(deeHub2, 'peer-dee-2', null, { name: 'Dee', tokenSub: 'acct-peer-dee', cl: 1 });   // a new tab of hers takes the seat (ONE-SEAT): the old one closed
    assert.ok(deeHub.closed && !deeHub2.closed);
    await realm.drop(dee);
    const annHub = hub.connect(); await hub.hello(annHub, 'peer-ann', null, { name: 'Ann' });
    const f = realm.room._sdFight;
    f.phase = 3; f.outUntil = 0; f.ec = null; f.hp = 30; f.resetAt = Date.now() + 600_000;
    await realm.raw(ann, say({ k: 'hit', q: 9, d: 50, r: HIT_KINDS.Spell }));
    const kAnn = hub.store.get(sdReceiptKey('acct-peer-ann')), kDee = hub.store.get(sdReceiptKey('acct-peer-dee'));
    assert.ok(kAnn && kDee, 'kept for each');
    assert.deepEqual([kAnn.s, typeof kAnn.r, Number.isFinite(kAnn.hold), kDee.hold], [rec.s, 'string', true, undefined], 'Ann stood in the realm: held');
    assert.deepEqual(rcpts(annHub), [], 'not to Ann\'s tab - her floor spends it');
    assert.deepEqual([rcpts(deeHub), rcpts(deeHub2)], [[], [kDee.r]], 'to the tab that holds her seat, at once');
    // hellos: Ann's held, then handed once the hold lapses
    const annLater = hub.connect(); await hub.hello(annLater, 'peer-ann', null, { name: 'Ann' });
    assert.ok(welcomed(annLater)); assert.deepEqual(rcpts(annLater), [], 'held');
    step(SD_HERE_HOLD_MS + 1000);
    const annLate = hub.connect(); await hub.hello(annLate, 'peer-ann', null, { name: 'Ann' });
    assert.deepEqual(rcpts(annLate), [kAnn.r], 'its hold lapsed: handed');
    // spent: the hub's alone; then never handed again, nor written over by a late tell
    await hub.raw(annLate, say({ k: 'spent', s: rec.s }));
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-ann')).spent, true);
    const annAfter = hub.connect(); await hub.hello(annAfter, 'peer-ann', null, { name: 'Ann' });
    assert.ok(welcomed(annAfter)); assert.deepEqual(rcpts(annAfter), [], 'spent: never again');
    await hub.room._sdKeepReceipts({ s: rec.s, rc: [['acct-peer-ann', kAnn.r]], here: [] }, Date.now());
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-ann')).spent, true, 'a tell told again stores nothing over the spent mark');
    await hub.room._sdKeepReceipts({ s: rec.s, rc: [['acct-peer-cy', kDee.r]], here: [] }, Date.now());
    await hub.room._sdKeepReceipts({ s: rec.s + 1, rc: [['acct-peer-dee', kDee.r]], here: [] }, Date.now());
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-cy')), undefined, 'another\'s receipt is never kept for an account');
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-dee')).s, rec.s, 'nor one under another slot');
    // an older slot's tell, or its word that it is spent, never over a newer slot's receipt
    const nowS = Math.floor(Date.now() / 1000);
    const eveNew = await mintSdReceipt({ d: rec.s + 1, s: 'acct-peer-eve', c: 1, x: 'stood', l: 30 }, null, { subtle, nowS });
    const eveOld = await mintSdReceipt({ d: rec.s, s: 'acct-peer-eve', c: 2, x: 'stood', l: 30 }, null, { subtle, nowS });
    await hub.room._sdKeepReceipts({ s: rec.s + 1, rc: [['acct-peer-eve', eveNew]], here: [] }, Date.now());
    await hub.room._sdKeepReceipts({ s: rec.s, rc: [['acct-peer-eve', eveOld]], here: [] }, Date.now());
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-eve')).r, eveNew, 'an older slot\'s tell never over a newer receipt');
    await hub.room._sdSpent('acct-peer-eve', rec.s, Date.now());
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-eve')).r, eveNew, 'nor its word that it is spent');
    const junkBefore = realm.room._meterOf(ann).junk ?? 0;
    await realm.raw(ann, say({ k: 'spent', s: rec.s }));
    assert.equal((realm.room._meterOf(ann).junk ?? 0), junkBefore + 1, 'a `spent` in the realm is junk');
    // expired: never handed at a hello (and forgotten there); the sweep forgets the rest
    step(SD_RECEIPT_TTL_S * 1000 + 60_000);
    const deeLate = hub.connect(); await hub.hello(deeLate, 'peer-dee-2', null, { name: 'Dee', tokenSub: 'acct-peer-dee' });   // her seat's tab, reconnecting
    assert.ok(welcomed(deeLate)); assert.deepEqual(rcpts(deeLate), [], 'expired: never handed');
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-dee')), undefined, 'and forgotten');
    assert.ok(hub.store.get(sdReceiptKey('acct-peer-ann')), 'a spent mark waits for the sweep');
    await hub.room._sweepHub(Date.now());
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-ann')), undefined, 'swept: an expired spent mark');
    assert.equal(hub.store.get(sdReceiptKey('acct-peer-eve')), undefined, 'and an expired receipt never fetched');
  });
});

// ── the page ──────────────────────────────────────────────────────────

function rig(room, { acct = null, v = RELAY_VERSION } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000, ...(acct ? { acct, asecret: `secret-of-${acct}` } : {}) });
  const got = [];
  s.onSdReceipt = (r, rm) => got.push([r, rm]);
  const info = console.info; console.info = () => {};
  try {
    s.join(room, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v });
  } finally { console.info = info; }
  const ws = sockets[0];
  return { s, ws, got, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'sd') };
}

test('SD9a THE PAGE: my receipt heard from my own realm or the hub - never a cell\'s, never another\'s shape; a slot\'s spoils said `spent` to the hub alone, by a signed-in account (mutants: a receipt from anywhere; spent from a realm)', async () => {
  const bare = await mintSdReceipt(CLAIM, null, { subtle, nowS: T0S });
  const realm = rig(sdRoomKey(7), { acct: 'acct-ann' });
  realm.ws.receive({ t: 'sd', k: 'rcpt', r: bare });
  assert.deepEqual(realm.got, [[bare, sdRoomKey(7)]]);
  const hub = rig(SOCIAL_ROOM, { acct: 'acct-ann' });
  hub.ws.receive({ t: 'sd', k: 'rcpt', r: bare });
  assert.deepEqual(hub.got.map(([r]) => r), [bare]);
  hub.ws.receive({ t: 'sd', k: 'rcpt', r: 'r1.abc.' });
  assert.equal(hub.got.length, 1, 'never another\'s shape');
  const cell = rig(worldRoom(PX, PY));
  cell.ws.receive({ t: 'sd', k: 'rcpt', r: bare });
  assert.deepEqual(cell.got, [], 'nor from a cell');
  assert.equal(hub.s.sendSdSpent(7), true);
  assert.deepEqual(hub.out().at(-1), { t: 'sd', k: 'spent', s: 7 });
  assert.equal(hub.s.sendSdSpent(0), false, 'the wire\'s law first');
  assert.equal(hub.s.sendSdSpent(8), false, 'on the find\'s own bucket - a word a second');
  assert.equal(realm.s.sendSdSpent(7), false, 'never from a realm');
  assert.equal(rig(SOCIAL_ROOM).s.sendSdSpent(7), false, 'never without an account');
  assert.equal(rig(SOCIAL_ROOM, { acct: 'acct-ann', v: 'world175' }).s.sendSdSpent(7), false, 'never to a relay that closes on it');
});

test('SD9a the relay by source: the receipts minted before the fall is said, by the gate\'s `earned`; handed at the late `in`; the hub told them with who stood there; kept, handed at a hello, spent, swept (mutants: each step dropped)', () => {
  const w = read('server/src/index.js');
  assert.match(w, /for \(const sub of Object\.keys\(f\.players\)\.filter\(\(x\) => earned\(f, x\)\)\) \{\n\s+try \{ f\.rc\[sub\] = await mintSdReceipt\(\{ d: f\.s, s: sub, c: rand32\(\), x: earnedBy\(f, sub\), l: f\.players\[sub\]\.lv, \.\.\.this\._bodyMeasureOf\(f, sub, earned\) \}, key, \{ subtle: crypto\.subtle, nowS \}\); \}/);   // PIN MOVED (INT14): and the count's measure
  const at = (re) => w.search(re);
  assert.ok(at(/f\.rc\[sub\] = await mintSdReceipt/) < at(/f\.said = true;   \/\/ kept before it is said/) && at(/f\.said = true;   \/\/ kept before it is said/) < at(/this\._sdFightFan\(\[\{ k: 'fell', \.\.\.f\.fell \}\]\);/), 'minted, kept, then said');
  assert.match(w, /rc: Object\.entries\(f\.rc \?\? \{\}\), here: f\.here \?\? \[\] \}\), signal: AbortSignal\.timeout\(SD_TELL_RETRY_MS\)/);
  assert.match(w, /await this\._sdKeepReceipts\(c, Date\.now\(\)\);/);
  assert.match(w, /if \(isSocialRoom\(a\.key\) && who\.subject\) \{ try \{ await this\._sdReceiptTo\(ws, who\.subject, now\); \}/);
  assert.match(w, /'sweep:sdrc'/);
  assert.match(w, /import \{ mintSdReceipt, readSdReceipt, SD_RECEIPT_TTL_S \} from '\.\.\/\.\.\/src\/net\/sdReceipt\.js';/);
  assert.match(read('test/relayversion.test.js'), /'src\/net\/sdReceipt\.js'\]/, 'net/sdReceipt.js in the bundle');   // PIN MOVED (INT12): last still - net/sdRemnant.js walks earlier now, under net/bossRef.js
});
