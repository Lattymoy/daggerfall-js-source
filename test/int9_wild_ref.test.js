// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE OPEN ZONE REFEREED. WILD1 left every blow between two players in the zone to the defender's own
// machine, a fall to the fallen's own health, and a death's drop and the killer's worn piece to the fallen's own hands -
// so a client that never took a blow never fell, and one that fell dropped what it chose (any records at all, for its
// friends to take). Now the relay holds the zone's fights (net/wildRef.js) and signs each fall (net/wildReceipt.js `f1`),
// the account service takes the drop off the fallen's judged record against it (server-account/src/wild.js) and signs
// what it took (identityToken.js `remains`), and the room keeps a deposit only on that order (net/wildLaw.js). Pinned:
// each law alone, the relay over the real Room (test/fakeRoom.mjs), the service over the real Worker, and the client's
// glue - a crafted client's every lie it used to tell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mintWildReceipt, readWildReceipt, verifyWildReceipt, wildReceiptValid, WILD_RECEIPT_V, WILD_RECEIPT_TTL_S, WILD_RECEIPT_MAX, WILD_FALL_GRACE_S, WILD_WORN_MAX } from '../src/net/wildReceipt.js';
import { mintDuelReceipt, verifyDuelReceipt } from '../src/net/duelReceipt.js';
import { newWildRef, wildZone, wildPose, wildBlow, wildPick, wildSigned, wildStep, wildVitals, WILD_REF } from '../src/net/wildRef.js';
import { SIEGE_UNITS_PER_M, SIEGE_HIT, siegeVitality, siegeBlowMax, SIEGE_CASTS } from '../src/net/siegeRef.js';
import { mintRemainsOrder, verifyOrder, remainsDigest, REMAINS_RECORDS_MAX, mintToken } from '../src/net/identityToken.js';
import { newRemains, foldFall, takeFrom, remainsWords, remainsFit, wildRemainsKey, WILD_REMAINS_BYTES_MAX } from '../src/net/wildLaw.js';
import { takeWildDeath, wornOffer, wildRecord } from '../src/systems/wildDropLaw.js';
import { WILD_PARTY_TRUCE_MS } from '../src/systems/wildZone.js';
import { TEMPLATES } from '../src/systems/itemKinds.js';
import { WILD_BODY_MS } from '../src/net/wildFight.js';
import { validWildData, validWildRefOut, WILD_ITEMS_MAX, WILD_REMAINS_ITEMS_MAX, WILD_REF_RELAY_MIN, relaySupportsWildRef, RELAY_VERSION, WILD_ORDER_MAX, worldRoom, PIXEL_UNITS } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { WILD_FALLS_KEEP_S } from '../server-account/src/wild.js';
import { HOUR_JOBS } from '../server-account/src/cron.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000;
const keys = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const RC = 'r00000000000000000a01';

test('INT9 THE RECEIPT: `f1` names the fallen, its realm character, the killer, the remains\' id and the worn piece picked, an hour\'s life; the version inside the signature (a duel\'s `d1` never reads as one, nor one as it), another receipt\'s fields refused outright, a fall at one\'s own hand none; unsigned with no key, which the service declines (mutants: the version outside the signed bytes; a foreign field admitted; the piece unbounded; a self-kill)', async () => {
  const kp = await keys();
  const rc = await mintWildReceipt({ f: 'acct-aaaa', c: RC, k: 'acct-bbbb', r: '0123456789ab', w: 2 }, kp.privateKey, { subtle, nowS: T });
  assert.ok(rc.startsWith(`${WILD_RECEIPT_V}.`) && rc.length <= WILD_RECEIPT_MAX);
  assert.deepEqual(readWildReceipt(rc), { f: 'acct-aaaa', c: RC, k: 'acct-bbbb', r: '0123456789ab', w: 2, i: T, e: T + WILD_RECEIPT_TTL_S, signed: true });
  assert.equal((await verifyWildReceipt(rc, kp.publicKey, { subtle, nowS: T + 10 })).ok, true);
  assert.equal((await verifyWildReceipt(rc, kp.publicKey, { subtle, nowS: T + WILD_RECEIPT_TTL_S })).why, 'expired');
  const [, body, sig] = rc.split('.');
  assert.equal((await verifyDuelReceipt(`d1.${body}.${sig}`, kp.publicKey, { subtle, nowS: T })).ok, false, 'a fall is no duel\'s result');
  const d1 = await mintDuelReceipt({ f: ['acct-aaaa', 'acct-bbbb'], w: 1, n: '0123456789ab' }, kp.privateKey, { subtle, nowS: T });
  assert.equal((await verifyWildReceipt(d1, kp.publicKey, { subtle, nowS: T })).why, 'version');
  const [, db, ds] = d1.split('.');
  assert.equal((await verifyWildReceipt(`f1.${db}.${ds}`, kp.publicKey, { subtle, nowS: T })).ok, false, 'nor a d1\'s body under f1');
  const ok = { f: 'acct-aaaa', c: '', k: 'acct-bbbb', r: '0123456789ab', w: -1, i: T, e: T + 60 };
  assert.equal(wildReceiptValid(ok), true, 'a fall with no realm character signed, no piece picked');
  for (const bad of [{ w: WILD_WORN_MAX }, { w: -2 }, { w: '0' }, { k: 'acct-aaaa' }, { r: 'ZZ' }, { r: '0123456789abc' }, { c: 'nope' }, { e: T + WILD_RECEIPT_TTL_S + 1 }, { n: '0123456789ab' }, { s: 'x' }, { d: 1 }, { a: 'p' }]) {
    assert.equal(wildReceiptValid({ ...ok, ...bad }), false, JSON.stringify(bad));
  }
  const unsigned = await mintWildReceipt({ f: 'acct-aaaa', c: '', k: 'acct-bbbb', r: '0123456789ab', w: -1 }, null, { subtle, nowS: T });
  assert.equal(readWildReceipt(unsigned).signed, false);
  assert.equal((await verifyWildReceipt(unsigned, kp.publicKey, { subtle, nowS: T })).why, 'unsigned');
  assert.equal(WILD_WORN_MAX, WILD_ITEMS_MAX, 'the offer\'s most, pinned equal');
});

// ─── THE REFEREE'S LAW ───────────────────────────────────────────────────────────────────────────────────────────

const at = (x, z = 0) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M + z * M });
const FIST = { w: -1, m: 0 };
/** Two fighters in the zone, a pace apart. */
function zone(now = 10_000) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: RC }, true, at(-1), now);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: '' }, true, at(1), now);
  return st;
}

test('INT9 THE REFEREE\'S LAW, WHO FIGHTS: a blow lands only between two fighters that BOTH said they stand in the zone, neither down, never kin (the party, its truce, a duel\'s two), never one\'s self; whole at the Royal Tourney\'s vitality (mutants: one fighter\'s word enough; kin unread; a down fighter struck)', () => {
  let st = zone();
  const whole = siegeVitality(10);
  assert.deepEqual(wildVitals(st, 'acct-a', 'acct-b'), [['peer-a', whole, whole], ['peer-b', whole, whole]]);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, kin: true, rid: '0123456789ab' }, 10_100).why, 'kin');
  assert.equal(wildBlow(st, 'acct-a', 'acct-a', { d: 5, held: FIST }, 10_100).why, 'no-fighter');
  assert.equal(wildBlow(st, 'acct-a', 'acct-c', { d: 5, held: FIST }, 10_100).why, 'no-fighter', 'one that never said a word');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 10_200);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST }, 10_300).why, 'zone', 'a crafted client opts out of the fights - never into another\'s');
  assert.equal(wildBlow(st, 'acct-b', 'acct-a', { d: 5, held: FIST }, 10_300).why, 'zone', 'and strikes nobody either');
  st = zone();
  const r = wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: '0123456789ab' }, 10_100);
  assert.deepEqual([r.ok, r.dealt, r.fell], [true, siegeBlowMax(-1, 0), false], 'a fist, to a fist\'s most');
  assert.equal(WILD_REF.truceMs, WILD_PARTY_TRUCE_MS, 'the party\'s truce, the hub\'s and the client\'s one number');
  assert.equal(WILD_REF.pickMs, WILD_BODY_MS, 'the body\'s window, the referee\'s pick');
});

test('INT9 THE REFEREE\'S LAW, A FALL: a strike clipped to the weapon the look holds and the arms the token signs, a cast to SIEGE_CASTS; the fall at none left, its killer the striker; the killer picks ONE worn piece once inside WILD_REF.pickMs, else it is signed with none; a fighter unstruck WILD_REF.mendMs is whole again; a fallen rises whole on its next word that it stands in the zone (mutants: the arms unread; the cast unclipped; a second pick; a stranger\'s pick; the mend unread; the rise unread)', () => {
  const st = zone();
  let t = 10_000;
  const r = wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: { w: 123, m: 9 }, wa: [16, 0], rid: 'aaaaaaaaaaaa' }, t += 300);
  assert.equal(r.dealt, siegeBlowMax(123, 9, [16, 0]), 'the Dai-Katana its look holds, clipped to the Longsword its pack does');
  const c = wildBlow(st, 'acct-a', 'acct-b', { d: 999, r: SIEGE_HIT.Spell, rid: 'aaaaaaaaaaab' }, t += 300);
  assert.equal(c.dealt, SIEGE_CASTS.damageMax, 'a cast to its harm\'s most');
  // the mend: unstruck for mendMs, whole
  t += WILD_REF.mendMs;
  wildBlow(st, 'acct-b', 'acct-a', { d: 1, held: FIST, rid: 'aaaaaaaaaaac' }, t);
  assert.equal(wildVitals(st, 'acct-a', 'acct-b')[1][1], siegeVitality(10), 'whole again');
  // fists until B falls
  let fall = null;
  for (let k = 0; k < 400 && !fall; k++) fall = wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: `bbbbbbbbb${String(k).padStart(3, '0')}` }, t += 300).fall;
  assert.ok(fall, 'B fell');
  assert.deepEqual([fall.fallen, fall.fallenId, fall.killer, fall.killerId, fall.ci, fall.w, fall.picked], ['acct-b', 'peer-b', 'acct-a', 'peer-a', '', -1, false]);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 9, held: FIST }, t += 300).why, 'down', 'nothing more lands on the fallen');
  assert.equal(wildPick(st, 'acct-b', fall.r, 0, t), null, 'the fallen picks nothing of its own');
  assert.equal(wildPick(st, 'acct-a', fall.r, WILD_WORN_MAX, t), null, 'an offer\'s place');
  assert.equal(wildPick(st, 'acct-a', fall.r, 1, t).w, 1);
  assert.equal(wildPick(st, 'acct-a', fall.r, 0, t), null, 'one pick a fall');
  wildSigned(st, fall.r);
  assert.equal(st.falls.size, 0, 'signed: forgotten');
  // a fall nobody picks is signed without a piece once pickMs has gone by
  const st2 = zone();
  let f2 = null, t2 = 10_000;
  for (let k = 0; k < 400 && !f2; k++) f2 = wildBlow(st2, 'acct-b', 'acct-a', { d: 999, held: FIST, rid: `ccccccccc${String(k).padStart(3, '0')}` }, t2 += 300).fall;
  assert.equal(f2.ci, RC, 'the realm character the token signs, carried to the receipt');
  assert.deepEqual(wildStep(st2, t2 + WILD_REF.pickMs), [], 'not yet');
  assert.deepEqual(wildStep(st2, t2 + WILD_REF.pickMs + 1).map((f) => [f.r, f.w]), [[f2.r, -1]]);
  assert.equal(wildPick(st2, 'acct-b', f2.r, 0, t2 + WILD_REF.pickMs + 2), null, 'too late');
  // the rise
  wildZone(st2, 'acct-a', { id: 'peer-a2', lv: 10 }, false, at(5), t2 + 1000);
  assert.equal(wildBlow(st2, 'acct-b', 'acct-a', { d: 1, held: FIST }, t2 + 1300).why, 'zone');
  wildZone(st2, 'acct-a', { id: 'peer-a2', lv: 10 }, true, at(1), t2 + 2000);
  assert.deepEqual(wildVitals(st2, 'acct-a', 'acct-b')[0], ['peer-a2', siegeVitality(10), siegeVitality(10)], 'risen whole, under its socket now');
});

test('INT9 THE REFEREE\'S LAW, REACH: a blow\'s reach is from the fighters\' last BELIEVED places - a run the referee allows, never a teleport (mutants: a teleport believed for reach)', () => {
  const st = zone();
  assert.equal(wildPose(st, 'acct-a', at(-1 + 0.5), 10_500), true);
  assert.equal(wildPose(st, 'acct-a', at(-200), 10_600), true, 'heard');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789ab' }, 10_700).ok, true, 'still where it was believed - a pace from B');
  assert.equal(wildPose(st, 'acct-c', at(0), 10_700), false, 'no fighter, no pose');
});

// ─── THE DROP'S LAW (one at both ends) ──────────────────────────────────────────────────────────────────────────

const weapon = (t, extra = {}) => ({ group: 'Weapons', templateIndex: t, material: 0, ...extra });
const potion = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };
const kinds = (list) => list.map((i) => (i.group === 'Currency' ? 'gold' : i === potion || i.templateIndex === TEMPLATES.Glass_Bottle ? 'potion' : i.templateIndex));
function sheet() {
  return {
    goldPieces: 101,
    items: [weapon(113, { equipSlot: 5, uid: '00000000000000a1' }), potion, weapon(120, { uid: '00000000000000a2', magic: true }), weapon(121, { equipSlot: 6, uid: '00000000000000a3' })],   // the bag's sword a magic one: a piece the ledger follows
    wagonItems: [weapon(122, { uid: '00000000000000a4' }), { group: 'Currency', templateIndex: 0, stackCount: 40 }],
  };
}

test('INT9 THE DROP\'S LAW (systems/wildDropLaw.js takeWildDeath): the killer\'s worn piece first, the bag\'s and the cart\'s drop, half the purse and the cart\'s coin - a piece `keep` names stays where it lies, what does not fit one remains goes back where it came from; the same on a live pack and its JSON (mutants: the killer\'s piece after the drop; a kept piece taken; the fit\'s rest destroyed)', () => {
  const s = sheet();
  const offer = wornOffer(s.items);
  assert.deepEqual(offer.map((i) => i.templateIndex), [113, 121]);
  const json = JSON.parse(JSON.stringify(s));
  const d = takeWildDeath(s, 1);
  assert.equal(d.killer, true);
  assert.deepEqual(kinds(d.taken), [121, 120, 122, 'gold'], 'the killer\'s, the bag\'s, the cart\'s, the coin');
  assert.equal(d.taken[3].stackCount, 50 + 20, 'half the purse and half the cart\'s coin');
  assert.deepEqual(d.records, d.taken.map(wildRecord));
  assert.deepEqual(kinds(s.items), [113, 'potion'], 'the worn piece not picked, and the potion, stay');
  assert.deepEqual([s.goldPieces, s.wagonItems.map((i) => i.stackCount ?? 1)], [51, [20]]);
  assert.deepEqual(takeWildDeath(json, 1).records, d.records, 'a record and its live pack agree to the piece');
  // kept: the ledger's word - it lies where it lay, in its place
  const k = sheet();
  const kd = takeWildDeath(k, 1, (it) => it.uid === '00000000000000a2' || it.uid === '00000000000000a3');
  assert.equal(kd.killer, false, 'the killer\'s piece kept');
  assert.deepEqual(kinds(kd.taken), [122, 'gold']);
  assert.deepEqual(kinds(k.items), [113, 'potion', 120, 121]);
  // the fit: past one remains, the rest goes back
  const many = { goldPieces: 0, items: Array.from({ length: WILD_REMAINS_ITEMS_MAX + 4 }, (_, i) => weapon(113 + (i % 9), { uid: i.toString(16).padStart(16, '0') })), wagonItems: [] };
  const md = takeWildDeath(many, -1);
  assert.equal(md.records.length, WILD_REMAINS_ITEMS_MAX);
  assert.equal(many.items.length, 4, 'what does not fit stays with the fallen');
  assert.deepEqual(remainsFit(Array.from({ length: 3 }, () => ({ name: 'x'.repeat(WILD_REMAINS_BYTES_MAX / 2) }))).length, 1, 'the bytes bound');
});

// ─── THE ORDER AND THE ROOM'S REMAINS ───────────────────────────────────────────────────────────────────────────

const rec1 = (n) => ({ group: 'Weapons', templateIndex: 110 + n, material: 0 });

test('INT9 THE ORDER: the service\'s `remains` word - the fall\'s id, the records\' digest and count, the killer\'s piece (`wk`, `wi`) - its own fields alone; a remains is said to the room only once its records digest to it, and the killer\'s piece is the killer\'s alone (mutants: the digest unread; the count unread; the piece anyone\'s; a remains said unvouched)', async () => {
  const kp = await keys();
  const items = [rec1(1), rec1(2), rec1(3)];
  const wh = await remainsDigest(items, { subtle });
  const o = await mintRemainsOrder({ s: 'acct-aaaa', wr: '0123456789ab', wh, wn: 3, wk: 'acct-bbbb', wi: 0 }, kp.privateKey, { subtle, nowS: T });
  const v = await verifyOrder(o, kp.publicKey, { subtle, nowS: T + 1, kind: 'remains' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.wr, v.claims.wh, v.claims.wn, v.claims.wk, v.claims.wi], ['acct-aaaa', '0123456789ab', wh, 3, 'acct-bbbb', 0]);
  assert.equal((await verifyOrder(o, kp.publicKey, { subtle, nowS: T + 1, kind: 'stake' })).ok, false, 'no other order');
  assert.ok(o.length <= WILD_ORDER_MAX, 'the wire carries it');
  for (const bad of [{ wn: REMAINS_RECORDS_MAX + 1 }, { wk: 'acct-aaaa', wi: 0 }, { wk: 'acct-bbbb', wi: 3 }, { wr: 'nope' }, { wh: 'nope' }]) {
    await assert.rejects(mintRemainsOrder({ s: 'acct-aaaa', wr: '0123456789ab', wh, wn: 3, ...bad }, kp.privateKey, { subtle, nowS: T }), TypeError, JSON.stringify(bad));
  }
  assert.equal(await remainsDigest([...items].reverse(), { subtle }) === wh, false, 'the order of the records is the digest\'s');
  // the room's remains: unvouched, said to nobody, taken by nobody; the killer's piece the killer's
  const rec = newRemains({ r: '0123456789ab', os: 'acct-aaaa', oid: 'peer-a', nm: 'Ria', p: [1, 2, 3], now: 1000, wh, wn: 3, wk: 'acct-bbbb', wi: 0 });
  foldFall(rec, { oid: 'peer-a', items, last: 1 });
  assert.deepEqual(remainsWords(rec, 1500), [], 'its records not yet checked against the order');
  assert.equal(takeFrom(rec, 1, 1, 'acct-cccc'), null);
  rec.ok = true;
  assert.deepEqual(remainsWords(rec, 1500)[0].wk, 'acct-bbbb');
  assert.equal(takeFrom(rec, 0, 1, 'acct-cccc'), null, 'the killer\'s piece, nobody else\'s');
  assert.equal(takeFrom(rec, 0, 1, 'acct-bbbb').it.templateIndex, 111);
  assert.equal(takeFrom(rec, 1, 1, 'acct-cccc').it.templateIndex, 112, 'the rest is anyone\'s');
});

test('INT9 THE WIRE: a blow carries the striker\'s rolled number (`d`) and no sheet; the pick is the relay\'s (`r`, `w`), the zone word a bit, a deposit its order on every chunk; the referee\'s three words projected; the relay that first referees (mutants: a deposit with no order; a pick with an unbounded place)', () => {
  assert.deepEqual(validWildData({ k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [1, 2, 3], d: 9, a: { lv: 5 } }), { to: 'peer-0002', k: 'strike', n: 1, by: 'melee', p: [1, 2, 3], d: 9 }, 'no attacker\'s sheet for a defender to read');
  assert.deepEqual(validWildData({ k: 'zone', z: 1 }), { k: 'zone', z: 1 });
  assert.equal(validWildData({ k: 'zone', z: 2 }), null);
  assert.deepEqual(validWildData({ k: 'pick', r: '0123456789ab', w: 3, to: 'peer-0002' }), { k: 'pick', r: '0123456789ab', w: 3 }, 'to the room, never to the fallen');
  assert.equal(validWildData({ k: 'pick', r: '0123456789ab', w: WILD_ITEMS_MAX }), null);
  const fall = { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: [rec1(1)], last: 1, o: 'o1.x.y' };
  assert.deepEqual(validWildData(fall), fall);
  assert.equal(validWildData({ ...fall, o: undefined }), null, 'no deposit without the service\'s order');
  assert.equal(validWildData({ ...fall, o: 'x'.repeat(WILD_ORDER_MAX + 1) }), null);
  for (const k of ['result', 'gave']) assert.equal(validWildData({ k, to: 'peer-0002', n: 1, s: 'abcdef12', i: 0 }), null, `${k}: retired`);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'hp', by: 'peer-0001', to: 'peer-0002', d: 4, r: 0, h: [['peer-0001', 320, 320], ['peer-0002', 316, 320]] }).h[1], ['peer-0002', 316, 320]);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'fell', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' }), { k: 'fell', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' });
  assert.equal(validWildRefOut({ t: 'wref', k: 'rc', r: '0123456789ab', rc: 'x'.repeat(WILD_RECEIPT_MAX + 1) }), null);
  assert.equal(WILD_REF_RELAY_MIN, 183);
  assert.deepEqual(['world182', 'world183', null].map(relaySupportsWildRef), [false, true, false]);
  assert.ok(relaySupportsWildRef(RELAY_VERSION));
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = (items = []) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items });
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));
const wilds = (ws, k) => ws.sent.filter((m) => m.t === 'wild' && !m.data && (!k || m.k === k));
async function withZone(fn) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom(CELL, { now: () => clock });
  const relayKp = await keys();
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', relayKp.privateKey)).toString('base64');
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
  const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK(), ...extra }); return ws; };
  const step = (ms) => { clock += ms; };
  /** `a`'s fists on `b` until it falls: the `fell` word */
  const fell = async (a, to, ws = a) => {
    for (let k = 0; k < 400; k++) {
      step(300);
      await say(a, { k: 'strike', to, n: 100 + k, by: 'melee', p: W(-1), d: 999 });
      const f = refs(ws, 'fell')[0];
      if (f) return f;
    }
    return null;
  };
  try { await fn({ r, say, join, step, fell, relayKp, now: () => clock }); } finally { Date.now = realNow; }
}

test('INT9 THE RELAY, THE FIGHT: a strike in the zone is the referee\'s - routed to nobody, landed only where both said they stand in it, both fighters told what landed; a fall said to the room, its killer\'s pick taken by the room that refereed it and the fall signed and handed to BOTH; one away hears it on its next zone word; the client\'s own `wref` never routed (mutants: the strike routed to the defender; one zone word enough; the receipt to the killer alone; the owed receipt lost)', () => withZone(async ({ r, say, join, step, fell, relayKp }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1, { rc: 1, ci: RC }), c = await join('peer-0003', 30);
  await say(a, { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: W(-1), d: 999 });
  assert.equal(refs(a).length + refs(b).length, 0, 'nobody said they stand in the zone: nothing lands');
  await say(a, { k: 'zone', z: 1 });
  step(300);
  await say(a, { k: 'strike', to: 'peer-0002', n: 2, by: 'melee', p: W(-1), d: 999 });
  assert.equal(refs(b).length, 0, 'one fighter\'s word is not the other\'s');
  await say(b, { k: 'zone', z: 1 });
  step(300);
  await say(a, { k: 'strike', to: 'peer-0002', n: 3, by: 'melee', p: W(-1), d: 999 });
  const whole = siegeVitality(10), fist = siegeBlowMax(-1, 0);
  for (const ws of [a, b]) assert.deepEqual(refs(ws, 'hp').at(-1), { t: 'wref', k: 'hp', by: 'peer-0001', to: 'peer-0002', d: fist, r: SIEGE_HIT.Melee, h: [['peer-0001', whole, whole], ['peer-0002', whole - fist, whole]] });
  assert.equal(b.sent.filter((m) => m.t === 'wild' && m.data && (m.data.k === 'strike' || m.data.k === 'spell')).length, 0, 'routed to nobody: the defender resolves nothing');
  const f = await fell(a, 'peer-0002');
  assert.ok(f, 'B fell');
  assert.deepEqual([f.id, f.by], ['peer-0002', 'peer-0001']);
  assert.ok(validWildRefOut(f));
  assert.deepEqual(refs(c, 'fell'), [f], 'the room hears a fall');
  await say(b, { k: 'pick', r: f.r, w: 0 });
  assert.equal(refs(a, 'rc').length, 0, 'the fallen picks nothing');
  // the fallen's socket goes before the killer picks: the receipt is kept for its next word on the zone
  await r.drop(b);
  await say(a, { k: 'pick', r: f.r, w: 0 });
  const [rc] = refs(a, 'rc');
  assert.ok(rc, 'the killer has it');
  const v = await verifyWildReceipt(rc.rc, relayKp.publicKey, { subtle, nowS: T + 60 });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.c, v.claims.k, v.claims.r, v.claims.w], ['acct-peer-0002', RC, 'acct-peer-0001', f.r, 0], 'the relay\'s signature names both by their verified accounts');
  const b2 = await join('peer-0002', 40, { rc: 1, ci: RC });
  assert.equal(refs(b2, 'rc').length, 0);
  await say(b2, { k: 'zone', z: 0 });
  assert.deepEqual(refs(b2, 'rc'), [rc], 'said again on its next word');
  // a client's own referee word is nobody's
  await r.raw(a, JSON.stringify({ t: 'wref', k: 'fell', id: 'peer-0003', by: 'peer-0001', r: '0123456789ab' }));
  assert.equal(refs(c, 'fell').length, 1, 'never routed');
}));

test('INT9 THE RELAY, A FALL UNPICKED AND KIN: a fall whose killer never picks is signed without a piece on the room\'s next frame past WILD_REF.pickMs; a blow at one\'s own duel opponent is the duel\'s, never the zone\'s (mutants: the step unread; the duel\'s two fighting in the zone)', () => withZone(async ({ say, join, step, fell, relayKp }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1);
  for (const ws of [a, b]) await say(ws, { k: 'zone', z: 1 });
  const f = await fell(a, 'peer-0002');
  step(WILD_REF.pickMs + 1);
  await say(a, { k: 'zone', z: 1 });   // any frame the room takes
  const [rc] = refs(b, 'rc');
  assert.ok(rc, 'signed without a pick');
  const v = await verifyWildReceipt(rc.rc, relayKp.publicKey, { subtle, nowS: T + 200 });
  assert.deepEqual([v.claims.r, v.claims.w, v.claims.c], [f.r, -1, ''], 'no piece; no realm character the token signed');
  assert.equal(rd('server/src/index.js').includes("const kin = (duel && (duel.a.sub === tb.sub || duel.b.sub === tb.sub)) || await this._wdunKinOf(a.sub, tb.sub, now);"), true, 'a duel\'s two, and the hub\'s party and its truce, are kin');
}));

test('INT9 THE RELAY, THE DEPOSIT: the room keeps remains only on the service\'s order (its key, this fall\'s id), and only once its records digest to it; a second carrier\'s deposit of a vouched remains is nothing; the killer\'s piece is said with its owner and taken by them alone (mutants: a deposit with no order kept; the digest unread; the piece anyone\'s)', () => withZone(async ({ r, say, join, now }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1), c = await join('peer-0003', 3);
  const items = [rec1(1), rec1(2), rec1(3)];
  const wh = await remainsDigest(items, { subtle });
  const nowS = Math.floor(now() / 1000);
  const order = await mintRemainsOrder({ s: 'acct-peer-0001', wr: '0123456789ab', wh, wn: 3, wk: 'acct-peer-0002', wi: 0 }, (await r.signer()).privateKey, { subtle, nowS });
  const forged = await mintRemainsOrder({ s: 'acct-peer-0001', wr: '0123456789ab', wh, wn: 3 }, (await keys()).privateKey, { subtle, nowS });
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: forged });
  assert.equal(r.store.get(wildRemainsKey('0123456789ab')), undefined, 'another key\'s order: nothing kept');
  await say(a, { k: 'fall', r: 'ffffffffffff', p: [1, 2, 3], items, last: 1, o: order });
  assert.equal(r.store.get(wildRemainsKey('ffffffffffff')), undefined, 'another fall\'s order');
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: [rec1(1), rec1(9), rec1(3)], last: 1, o: order });
  assert.equal(r.store.get(wildRemainsKey('0123456789ab')), undefined, 'records that are not the order\'s: none of it');
  assert.equal(wilds(c, 'ri').length, 0, 'said to nobody');
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: items.slice(0, 2), last: 0, o: order });
  assert.equal(wilds(c, 'ri').length, 0, 'not said until it is whole');
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: items.slice(2), last: 1, o: order });
  const [ri] = wilds(c, 'ri');
  assert.deepEqual([ri.items.length, ri.os, ri.wk, ri.wi], [3, 'acct-peer-0001', 'acct-peer-0002', 0]);
  const before = c.sent.length;
  await say(b, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: order });
  assert.equal(c.sent.length, before, 'a second carrier\'s deposit: nothing');
  assert.equal(b.closed, null, 'and no strike for it');
  await say(c, { k: 'take', r: '0123456789ab', i: 0, n: 1 });
  assert.deepEqual(wilds(c, 'no').map((m) => m.i), [0], 'the killer\'s piece, nobody else\'s');
  await say(b, { k: 'take', r: '0123456789ab', i: 0, n: 1 });
  assert.equal(wilds(b, 'got')[0].it.templateIndex, 111, 'the killer\'s');
  await say(c, { k: 'take', r: '0123456789ab', i: 1, n: 1 });
  assert.equal(wilds(c, 'got')[0].it.templateIndex, 112, 'the rest is anyone\'s');
}));

// ─── THE ACCOUNT SERVICE ────────────────────────────────────────────────────────────────────────────────────────

const nowS = () => Math.floor(Date.now() / 1000);
const record = () => ({ name: 'Riadne', level: 9, ...sheet() });
async function fallen() {
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin'), cy = await svc.registered('Cyrus');
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', record());
  const saved = () => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  const receipt = (o = {}) => mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789ab', w: 1, ...o }, svc.gatePriv, { subtle, nowS: o.nowS ?? nowS() });
  return { svc, ria, bo, cy, R, saved, receipt };
}
const fall = (svc, who, body) => svc.call('/v1/wild/fall', body, who.secret);

test('INT9 THE SERVICE, THE FALLEN\'S OWN ACT: the drop taken off the judged record against the relay\'s receipt (the killer\'s worn piece first, the bag, the cart, half the purse) at its tab\'s `at`, and the service\'s order over what it took - the killer\'s piece theirs alone; asked again, the same records under a fresh order and nothing moved twice (mutants: the receipt unread; the killer\'s piece unmarked; a second asking a second drop)', async () => {
  const { svc, ria, bo, R, saved, receipt } = await fallen();
  const rc = await receipt();
  const at = R.at();
  const res = await fall(svc, ria, { receipt: rc, realm: at });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.deepEqual(kinds(d.items), [121, 120, 122, 'gold'], 'the killer\'s pick (the second worn piece), the bag\'s, the cart\'s, the coin');
  assert.equal(d.realm.seq, at.seq + 1);
  assert.deepEqual(d.kept, []);
  const v = await verifyOrder(d.order, svc.identityPublic, { subtle, nowS: nowS(), kind: 'remains' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.wr, v.claims.wn, v.claims.wk, v.claims.wi, v.claims.wh], [ria.id, '0123456789ab', 4, bo.id, 0, await remainsDigest(d.items, { subtle })]);
  const after = saved();
  assert.deepEqual(kinds(after.items), [113, 'potion'], 'the record lost what the room holds');
  assert.equal(after.goldPieces, 51);
  const again = await fall(svc, ria, { receipt: rc, realm: R.at() });
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.items, d.items, 'the same records');
  assert.equal(R.at().seq, at.seq + 1, 'nothing moved twice');
  const row = svc.env.DB._raw.prepare('SELECT player, killer, wi, burnt FROM wild_falls WHERE r = ?').get('0123456789ab');
  assert.deepEqual({ ...row }, { player: ria.id, killer: bo.id, wi: 0, burnt: 0 });
});

test('INT9 THE SERVICE, THE KILLER\'S SEIZURE: the killer carries the receipt only once WILD_FALL_GRACE_S has gone by - then the record is taken where it stands and its lease cleared (whatever tab held it plays a record that moved under it); a stranger carries nothing (mutants: the grace unread; the lease kept; a stranger\'s carry)', async () => {
  const { svc, bo, cy, R, saved, receipt } = await fallen();
  const early = await fall(svc, bo, { receipt: await receipt() });
  assert.deepEqual([early.status, early.body.error], [409, 'grace']);
  assert.deepEqual([(await fall(svc, cy, { receipt: await receipt() })).status], [403], 'not theirs');
  const at = R.at();
  const late = await fall(svc, bo, { receipt: await receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 }) });
  assert.equal(late.status, 200, JSON.stringify(late.body));
  assert.equal(late.body.realm, undefined, 'no record of the killer\'s moved');
  assert.deepEqual([R.at().seq, R.at().lease], [at.seq + 1, null], 'moved where it stood, the lease cleared');
  assert.deepEqual(kinds(saved().items), [113, 'potion']);
});

test('INT9 THE SERVICE, A DEATH TO A FOE: no receipt - the fallen\'s own act on its own nonce (the remains\' id a digest of the character and the nonce, so asked again it is the same fall and never a relay\'s id), no worn piece; a bad nonce refused (mutants: the nonce unread; a worn piece taken)', async () => {
  const { svc, ria, R } = await fallen();
  assert.deepEqual([(await fall(svc, ria, { realm: R.at() })).body.error], ['nonce']);
  const res = await fall(svc, ria, { n: '00112233445566ff', realm: R.at() });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.r, /^[0-9a-f]{12}$/);
  assert.deepEqual(kinds(res.body.items), [120, 122, 'gold'], 'the worn pieces stay');
  const v = await verifyOrder(res.body.order, svc.identityPublic, { subtle, nowS: nowS(), kind: 'remains' });
  assert.equal(v.claims.wk, undefined, 'nobody\'s piece');
  const again = await fall(svc, ria, { n: '00112233445566ff', realm: R.at() });
  assert.deepEqual([again.body.r, again.body.items], [res.body.r, res.body.items], 'the same fall');
});

test('INT9 THE SERVICE, THE LEDGER AND THE FREEZE: a piece the ledger bars from leaving (another\'s, a claim waiting) stays on the record and is named `kept`; a record the judge holds still loses its drop and the room is given none of it - no order (lane 1\'s freeze: a held character hands no value to another player); the falls swept past WILD_FALLS_KEEP_S (mutants: a barred piece taken; the hold unread; the sweep unread)', async () => {
  const f = await fallen();
  f.svc.env.DB._raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES ('00000000000000a2', 'someone', 'rffffffffffffffffffff', 1, 'held', '120:0', 1)").run();
  const res = await fall(f.svc, f.ria, { receipt: await f.receipt(), realm: f.R.at() });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.kept, ['00000000000000a2']);
  assert.deepEqual(kinds(res.body.items), [121, 122, 'gold']);
  assert.deepEqual(kinds(f.saved().items), [113, 'potion', 120], 'kept where it lay');
  const h = await fallen();
  h.svc.env.DB._raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(h.R.id);
  const held = await fall(h.svc, h.ria, { receipt: await h.receipt(), realm: h.R.at() });
  assert.equal(held.status, 200, JSON.stringify(held.body));
  assert.deepEqual([held.body.burnt, held.body.order], [true, null], 'nothing for the room');
  assert.equal(held.body.items.length, 4, 'and the death cost the drop');
  assert.deepEqual(kinds(h.saved().items), [113, 'potion']);
  // the sweep
  const job = HOUR_JOBS.find(([name]) => name === 'wild-falls');
  assert.ok(job, 'the hour sweeps them');
  h.svc.env.DB._raw.prepare('UPDATE wild_falls SET at = ?').run(nowS() - WILD_FALLS_KEEP_S - 1);
  await job[1]({ db: h.svc.env.DB, nowS: nowS(), budget: 100 }, h.svc.env);
  assert.equal(h.svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM wild_falls').get().n, 0);
});

// ─── THE CLIENT ─────────────────────────────────────────────────────────────────────────────────────────────────

test('INT9 THE CLIENT: the zone word on every socket and again at each welcome; a blow rolled on my own sheet and sent as a number; no defender\'s resolve; the referee\'s fall a death through the SetHealth(0) door; my drop the service\'s act on my record, its kept pieces back, the room given the service\'s records on its order; a fall I won seized after the grace when no remains of theirs stand (mutants: the zone word unsaid; the defender\'s resolve kept; a drop of my own choosing deposited; the seizure unread)', () => {
  const w = rd('src/scenes/world.js'), o = rd('src/net/online.js');
  assert.ok(o.includes('if (primary) this.wildOk = relaySupportsWildRef(relayV);'), 'a relay that referees the zone, or none of it');
  assert.ok(o.includes("if (this._wildZone === 1) { const zw = primary ? this._ws : this._halo.get(room)?.ws;"), 'said again at each welcome');
  assert.ok(o.includes("} else if (m.t === 'wref') {"));
  assert.ok(w.includes('online?.setWildZone?.(wildCan() ? 1 : 0);'));
  assert.ok(w.includes("const n = wildFight.blow(to, 'strike', { by, p: campToWire(player.feetAt()), d: Math.trunc(r.dmg),"));
  assert.ok(!w.includes('resolveDuelStrike(d, playerEntity'), 'the defender resolves nothing');
  assert.ok(w.includes('if (playerEntity.health > 0) hurtPlayer(playerEntity, playerEntity.health, { bypassShield: true });'));
  assert.ok(w.includes('call: (at) => wildAccount.fall({ ...(c ? { receipt: rc } : { n: nonce }), realm: at }),'));
  assert.ok(w.includes('took = takeWildDeath(playerEntity, c ? c.w : -1);'), 'the same law as the service\'s, on my pack');
  assert.ok(w.includes("if (d.order && n && body) wildDeposit({ r: d.r, items: d.items, o: d.order,"), 'the service\'s records, on its order');
  assert.ok(w.includes("online?.sendWild({ k: 'fall', r: dep.r, p: dep.p, items: dep.chunks[dep.k], last: dep.k === dep.chunks.length - 1 ? 1 : 0, o: dep.o }, { room: dep.room })"));
  assert.ok(w.includes('if (wildRemains.has(r)) continue;   // their tab took it: its remains stand'));
  assert.ok(!/takeWildDrop\(|takeWildGold\(/.test(w), 'no drop of the client\'s own making');
});
