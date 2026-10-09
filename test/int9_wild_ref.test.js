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
import { newWildRef, wildZone, wildPose, wildBlow, wildPick, wildSigned, wildStep, wildVitals, wildGone, wildCarry, wildCarryOf, wildSignNow, wildFallOf, WILD_REF } from '../src/net/wildRef.js';
import { SIEGE_UNITS_PER_M, SIEGE_HIT, siegeVitality, siegeBlowMax, SIEGE_CASTS } from '../src/net/siegeRef.js';
import { mintRemainsOrder, verifyOrder, remainsDigest, REMAINS_RECORDS_MAX, mintToken, ORDER_TTL_S } from '../src/net/identityToken.js';
import { newRemains, foldFall, takeFrom, remainsWords, remainsFit, wildRemainsKey, WILD_REMAINS_BYTES_MAX, WILD_RECORD_BYTES_MAX, remainsSpent, remainsTakeover, remainsEvict, remainsOf, WILD_TOMB_MIN_MS, WILD_STALL_MS } from '../src/net/wildLaw.js';
import { takeWildDeath, wornOffer, wildRecord, wildPickOf, wildDropCandidates, wildTookOf, wildTakeTook } from '../src/systems/wildDropLaw.js';
import { WILD_PARTY_TRUCE_MS } from '../src/systems/wildZone.js';
import { TEMPLATES } from '../src/systems/itemKinds.js';
import { WILD_BODY_MS } from '../src/net/wildFight.js';
import { validWildData, validWildRefOut, WILD_ITEMS_MAX, WILD_REMAINS_ITEMS_MAX, WILD_REF_RELAY_MIN, relaySupportsWildRef, RELAY_VERSION, WILD_ORDER_MAX, worldRoom, PIXEL_UNITS, WILD_DATA_MAX, SOCIAL_ROOM } from '../src/net/wire.js';
import { OnlineSession, WILD_ZONE_KEEP_MS } from '../src/net/online.js';
import { wildChunks } from '../src/systems/wildDeath.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { fakeRoom, fakeRooms } from './fakeRoom.mjs';
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
const RC2 = 'r00000000000000000a02', RC3 = 'r00000000000000000a03';

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

test('INT9 THE REFEREE\'S LAW, A FALL: a strike clipped to the weapon the look holds and the arms the token signs, a cast to SIEGE_CASTS; the fall at none left, its killer the striker; the killer picks ONE worn piece once inside WILD_REF.pickMs, else it is signed with none; a fighter unstruck WILD_REF.mendMs is whole again; a fallen rises whole on its word that it stands in the zone once WILD_REF.riseMs has gone by (mutants: the arms unread; the cast unclipped; a second pick; a stranger\'s pick; the mend unread; the rise unread; AUDIT INT9: the rise at once)', () => {
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
  // AUDIT INT9 (the pins' own): the pick's window read alone - a fresh fall unsigned, picked at its last moment and past it
  const late = (dt) => { const s3 = zone(); const f3 = downOf(s3, 'acct-a', 'acct-b', 20_000); return wildPick(s3, 'acct-a', f3.r, 0, f3.at + WILD_REF.pickMs + dt); };
  assert.equal(late(1), null, 'too late');
  assert.equal(late(0)?.w, 0, 'at its last moment, taken');
  // the rise: never before WILD_REF.riseMs - AUDIT INT9: it rose on its next word, where it fell, whole
  wildZone(st2, 'acct-a', { id: 'peer-a2', lv: 10 }, false, at(5), t2 + 1000);
  assert.equal(wildBlow(st2, 'acct-b', 'acct-a', { d: 1, held: FIST }, t2 + 1300).why, 'zone');
  wildZone(st2, 'acct-a', { id: 'peer-a2', lv: 10 }, true, at(1), t2 + 2000);
  assert.equal(wildBlow(st2, 'acct-b', 'acct-a', { d: 1, held: FIST }, t2 + 2300).why, 'down', 'still down');
  wildZone(st2, 'acct-a', { id: 'peer-a2', lv: 10 }, true, at(1), t2 + WILD_REF.riseMs);
  assert.deepEqual(wildVitals(st2, 'acct-a', 'acct-b')[0], ['peer-a2', siegeVitality(10), siegeVitality(10)], 'risen whole, under its socket now');
});

/** `by`'s fists on `to` until it falls, from `t`: the fall. */
function downOf(st, by, to, t) {
  for (let k = 0; k < 400; k++) { const f = wildBlow(st, by, to, { d: 999, held: FIST, rid: `ddddddddd${String(k).padStart(3, '0')}` }, t += 300).fall; if (f) return f; }
  return null;
}

test('INT9 THE REFEREE\'S LAW, REACH: a blow\'s reach is from the fighters\' believed places - a run the referee allows believed at once; one past it (a gallop, a respawn, a reconnect) believed too, and the jumper strikes nothing for WILD_REF.jumpMs (AUDIT INT9: a jump was never believed, and the place stayed stale for good) (mutants: a jump struck from at once; a jump never believed)', () => {
  const st = zone();
  assert.equal(wildPose(st, 'acct-a', at(-1 + 0.5), 10_500), true);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789ab' }, 10_600).ok, true, 'a step, believed');
  assert.equal(wildPose(st, 'acct-a', at(-200), 10_700), true, 'heard');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789ac' }, 10_800).why, 'jump', 'the jumper waits');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789ad' }, 10_700 + WILD_REF.jumpMs).why, 'reach', 'then strikes from where it is believed - two hundred paces off');
  assert.equal(wildPose(st, 'acct-a', at(-1), 10_700 + WILD_REF.jumpMs + 100), true, 'and back: a jump again');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789ae' }, 10_700 + WILD_REF.jumpMs + 200).why, 'jump');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: '0123456789af' }, 10_800 + 2 * WILD_REF.jumpMs + 100).ok, true, 'a pace off, believed');
  assert.equal(wildPose(st, 'acct-c', at(0), 10_700), false, 'no fighter, no pose');
});

test('INT9 (AUDIT) THE REFEREE\'S LAW, NO FREE BAR: a word off and on keeps the bar (whole again only away WILD_REF.riseMs, or unstruck WILD_REF.mendMs after it stood in the zone as long); a fighter takes the bar it carries from another room (the hub\'s word, newer than when it left this one); a fallen carried is down until its rise; a socket gone is out of the zone and its place a newcomer\'s; a full room\'s oldest fall is handed back to be signed; a building\'s fall signed at once; the pick signs what the offer showed (mutants: a word off and on a heal; the carry unread; the eviction unsigned; the gone socket still fighting)', () => {
  const whole = siegeVitality(10);
  // off and on: no heal
  let st = zone();
  wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: 'eeeeeeeeeee1' }, 10_300);
  const hit = wildVitals(st, 'acct-a', 'acct-b')[1][1];
  assert.ok(hit < whole);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 10_400);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), 10_500);
  assert.equal(wildVitals(st, 'acct-a', 'acct-b')[1][1], hit, 'a word off and on: the bar kept');
  wildBlow(st, 'acct-b', 'acct-a', { d: 1, held: FIST, rid: 'eeeeeeeeeee2' }, 10_300 + WILD_REF.mendMs + 1);
  assert.equal(wildVitals(st, 'acct-a', 'acct-b')[1][1], hit, 'unstruck the mend, but in the zone again less than it: not yet');
  wildBlow(st, 'acct-b', 'acct-a', { d: 1, held: FIST, rid: 'eeeeeeeeeee3' }, 10_500 + WILD_REF.mendMs + 600);
  assert.equal(wildVitals(st, 'acct-a', 'acct-b')[1][1], whole, 'and then whole');
  st = zone();
  wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: 'eeeeeeeeeee4' }, 10_300);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 10_400);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), 10_400 + WILD_REF.riseMs);
  assert.equal(wildVitals(st, 'acct-a', 'acct-b')[1][1], whole, 'away the rise: whole');
  // the carry
  st = zone();
  wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: 'eeeeeeeeeee5' }, 10_300);
  const c = wildCarry(st, 'acct-b', 10_300);
  assert.deepEqual(wildCarryOf(JSON.parse(JSON.stringify(c))), c, 'the hub\'s word, as the room wrote it');
  const next = newWildRef();
  wildZone(next, 'acct-b', { id: 'peer-b', lv: 10, carry: c }, true, at(1), 11_000);
  assert.equal(next.fighters.get('acct-b').f.hp, hit, 'a step into another cell keeps the bar');
  const stale = newWildRef();
  wildZone(stale, 'acct-b', { id: 'peer-b', lv: 10, carry: c }, true, at(1), 10_300 + WILD_REF.mendMs);
  assert.equal(stale.fighters.get('acct-b').f.hp, whole, 'a word older than the mend: whole');
  // back to a room it left, having fought elsewhere since
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 10_400);
  const worse = { ...c, hp: 7, at: 12_000 };
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, carry: worse }, true, at(1), 12_500);
  assert.equal(st.fighters.get('acct-b').f.hp, 7, 'the bar it carries back');
  // a fallen carried
  const fs = zone();
  const f = downOf(fs, 'acct-a', 'acct-b', 20_000);
  const dc = wildCarry(fs, 'acct-b', f.at);
  const there = newWildRef();
  wildZone(there, 'acct-b', { id: 'peer-b', lv: 10, carry: dc }, true, at(1), f.at + 5_000);
  assert.equal(there.fighters.get('acct-b').down, true, 'down in the next cell too');
  // a socket gone
  st = zone();
  wildGone(st, 'acct-b', 10_100);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: 'eeeeeeeeeee6' }, 10_200).why, 'zone', 'out of the zone');
  // a full room's oldest fall
  const full = newWildRef();
  const ev = [];
  for (let i = 0; i <= WILD_REF.fallsMax; i++) {
    wildZone(full, `acct-k${i}`, { id: `peer-k${i}`, lv: 1, ci: RC }, true, at(-1), 100);
    wildZone(full, `acct-v${i}`, { id: `peer-v${i}`, lv: 1, ci: RC }, true, at(1), 100);
    for (let k = 0; k < 400; k++) { const r = wildBlow(full, `acct-k${i}`, `acct-v${i}`, { d: 999, held: FIST, rid: `${i.toString(16).padStart(6, '0')}${k.toString(16).padStart(6, '0')}` }, 1000 + k * 300); if (r.evicted) ev.push(r.evicted); if (r.fell) break; }
  }
  assert.equal(full.falls.size, WILD_REF.fallsMax);
  assert.equal(ev.length, 1, 'the oldest handed back');
  assert.deepEqual([ev[0].fallen, ev[0].picked], ['acct-v0', true], 'to be signed without its pick - never forgotten');
  // a building's fall, and the pick's piece
  const b = zone();
  const bf = downOf(b, 'acct-a', 'acct-b', 20_000);
  assert.equal(wildSignNow(b, bf.r), bf);
  assert.equal(wildSignNow(b, bf.r), null, 'once');
  const p = zone();
  const pf = downOf(p, 'acct-a', 'acct-b', 20_000);
  assert.deepEqual(wildPick(p, 'acct-a', pf.r, 1, pf.at + 10, [123, 9]).wt, [123, 9]);
  assert.deepEqual(wildFallOf(JSON.parse(JSON.stringify(pf))), pf, 'a fall kept in storage reads back whole');
});

// ─── THE DROP'S LAW (one at both ends) ──────────────────────────────────────────────────────────────────────────

const weapon = (t, extra = {}) => ({ group: 'Weapons', templateIndex: t, material: 0, ...extra });
const potion = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };
const kinds = (list) => list.map((i) => (i.group === 'Currency' ? 'gold' : i === potion || i.templateIndex === TEMPLATES.Glass_Bottle ? 'potion' : i.templateIndex));
function sheet() {
  return {
    goldPieces: 101,
    items: [weapon(113, { equipSlot: 5, uid: '00000000000000a1' }), potion, weapon(120, { uid: '00000000000000a2', magic: true, value: 2000 }), weapon(121, { equipSlot: 6, uid: '00000000000000a3' })],   // the bag's sword a magic one: a piece the ledger follows
    wagonItems: [weapon(122, { uid: '00000000000000a4' }), { group: 'Currency', templateIndex: 0, stackCount: 40 }],
  };
}

test('INT9 THE DROP\'S LAW (systems/wildDropLaw.js takeWildDeath): the killer\'s worn piece first, then half the purse and the cart\'s coin, then the bag\'s and the cart\'s drop by worth - a piece `keep` names stays where it lies, what does not fit one remains goes back where it came from (AUDIT INT9: the gold came last, so a bag of junk ahead of it kept the gold and the valuables; a coin put back went into the purse, the cart\'s too); the same on a live pack and its JSON (mutants: the killer\'s piece after the drop; a kept piece taken; the fit\'s rest destroyed; the drop in the pack\'s order; the gold last)', () => {
  const s = sheet();
  const offer = wornOffer(s.items);
  assert.deepEqual(offer.map((i) => i.templateIndex), [113, 121]);
  const json = JSON.parse(JSON.stringify(s));
  const d = takeWildDeath(s, 1);
  assert.equal(d.killer, true);
  assert.deepEqual(kinds(d.taken), [121, 'gold', 120, 122], 'the killer\'s, the coin, the magic sword before the plain one');
  assert.deepEqual(d.from, ['bag', 'gold', 'bag', 'cart']);
  assert.equal(d.taken[1].stackCount, 50 + 20, 'half the purse and half the cart\'s coin');
  assert.deepEqual(d.gold, { purse: 50, cart: 20 });
  assert.deepEqual(d.records, d.taken.map(wildRecord));
  assert.deepEqual(kinds(s.items), [113, 'potion'], 'the worn piece not picked, and the potion, stay');
  assert.deepEqual([s.goldPieces, s.wagonItems.map((i) => i.stackCount ?? 1)], [51, [20]]);
  assert.deepEqual(takeWildDeath(json, 1).records, d.records, 'a record and its live pack agree to the piece');
  // kept: the ledger's word - it lies where it lay, in its place
  const k = sheet();
  const kd = takeWildDeath(k, 1, (it) => it.uid === '00000000000000a2' || it.uid === '00000000000000a3');
  assert.equal(kd.killer, false, 'the killer\'s piece kept');
  assert.deepEqual(kinds(kd.taken), ['gold', 122]);
  assert.deepEqual(kinds(k.items), [113, 'potion', 120, 121]);
  // the fit: past one remains, the rest goes back - the junk, never the gold or the valuables
  const junk = Array.from({ length: WILD_REMAINS_ITEMS_MAX + 4 }, (_, i) => weapon(113 + (i % 9), { uid: i.toString(16).padStart(16, '0') }));
  const many = { goldPieces: 1000, items: [...junk, weapon(120, { uid: '00000000000000ff', magic: true, value: 2000 })], wagonItems: [] };
  const md = takeWildDeath(many, -1);
  assert.equal(md.records.length, WILD_REMAINS_ITEMS_MAX);
  assert.deepEqual(kinds(md.taken.slice(0, 2)), ['gold', 120], 'the gold and the valuable ahead of a bag of junk');
  assert.equal(many.items.length, 6, 'what does not fit stays with the fallen (the gold one of the remains\' records)');
  assert.equal(many.goldPieces, 500);
  const poor = { goldPieces: 0, items: junk.map((it) => ({ ...it })), wagonItems: [{ group: 'Currency', templateIndex: 0, stackCount: 400 }] };
  const pd = takeWildDeath(poor, -1);
  assert.deepEqual([pd.gold, poor.wagonItems[0].stackCount, poor.goldPieces], [{ purse: 0, cart: 200 }, 200, 0], 'the cart\'s coin out of the cart');
  assert.deepEqual(remainsFit(Array.from({ length: 3 }, () => ({ name: 'x'.repeat(WILD_REMAINS_BYTES_MAX / 2) }))).length, 1, 'the bytes bound');
});

test('INT9 (AUDIT) THE DROP\'S LAW, ITS EDGES: a record heavier than WILD_RECORD_BYTES_MAX stays with the fallen (it fit no frame); the record\'s lit light follows its piece; the killer\'s piece is what the offer showed (`wt`) - the place\'s when it still is, else the first that is, else none; every piece a death could take named for the ledger before any is taken; and the fallen\'s game takes out EXACTLY what the service took, by id, else by its marks (mutants: the light left on another piece; the place alone believed; the candidates the fitted few; the game\'s own law run again)', () => {
  const heavy = weapon(120, { uid: '00000000000000b1', magic: true, note: 'x'.repeat(WILD_RECORD_BYTES_MAX) });
  const h = { goldPieces: 0, items: [heavy, weapon(122, { uid: '00000000000000b2' })], wagonItems: [] };
  assert.deepEqual(kinds(takeWildDeath(h, -1).taken), [122]);
  assert.deepEqual(h.items, [heavy], 'too heavy to lie in a remains');
  // the light
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch };
  const l = { goldPieces: 0, lightSourceIndex: 2, items: [weapon(120), weapon(121), torch], wagonItems: [] };
  takeWildDeath(l, -1);
  assert.equal(l.items[l.lightSourceIndex], torch, 'the lit light, still lit');
  // the killer's piece by what the offer showed
  const worn = [weapon(113, { equipSlot: 5 }), weapon(121, { equipSlot: 6, material: 3 })];
  assert.equal(wildPickOf(worn, 1, [121, 3]), worn[1]);
  assert.equal(wildPickOf(worn, 0, [121, 3]), worn[1], 'the place moved: the piece the offer showed');
  assert.equal(wildPickOf(worn, 1, [999, 0]), null, 'no such piece worn: none');
  assert.equal(wildPickOf(worn, 1), worn[1], 'a receipt with none: the place');
  // the candidates
  const c = sheet();
  assert.deepEqual(kinds(wildDropCandidates(c, 1)), [121, 120, 122], 'the killer\'s and every piece of the drop');
  assert.deepEqual(kinds(c.items), [113, 'potion', 120, 121], 'untouched');
  // the fallen's game: what the service took, out of the live pack
  const record = sheet(), live = sheet();
  const took = takeWildDeath(record, 1);
  const out = wildTakeTook(live, wildTookOf(took.taken, took.from), took.gold, (it) => { it.unequipped = true; });
  assert.deepEqual(kinds(out), [121, 120, 122]);
  assert.deepEqual(kinds(live.items), kinds(record.items));
  assert.deepEqual([live.goldPieces, live.wagonItems.map((i) => i.stackCount ?? 1)], [record.goldPieces, record.wagonItems.map((i) => i.stackCount ?? 1)]);
  assert.equal(out[0].unequipped, true, 'told before each leaves');
  const plain = { goldPieces: 0, items: [{ group: 'Weapons', templateIndex: 130, material: 2 }, { group: 'Weapons', templateIndex: 130, material: 2 }], wagonItems: [] };
  wildTakeTook(plain, [{ g: 'Weapons', t: 130, m: 2, u: null, p: null, n: 1, f: 'bag' }], null);
  assert.equal(plain.items.length, 1, 'one with no id, by its marks - one');
});

// ─── THE ORDER AND THE ROOM'S REMAINS ───────────────────────────────────────────────────────────────────────────

const rec1 = (n) => ({ group: 'Weapons', templateIndex: 110 + n, material: 0 });

test('INT9 THE ORDER: the service\'s `remains` word - the fall\'s id, the records\' digest and count, the room it is laid in (`wm` - AUDIT INT9), the killer\'s piece (`wk`, `wi`), the fallen\'s guild (`wg`) - its own fields alone; a remains is said to the room only once its records digest to it, and the killer\'s piece is the killer\'s alone (mutants: the digest unread; the count unread; the piece anyone\'s; a remains said unvouched; the room unread)', async () => {
  const kp = await keys();
  const items = [rec1(1), rec1(2), rec1(3)];
  const wh = await remainsDigest(items, { subtle });
  const o = await mintRemainsOrder({ s: 'acct-aaaa', wr: '0123456789ab', wh, wn: 3, wm: CELL, wk: 'acct-bbbb', wi: 0, wg: 'gabcdefghij' }, kp.privateKey, { subtle, nowS: T });
  const v = await verifyOrder(o, kp.publicKey, { subtle, nowS: T + 1, kind: 'remains' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.wr, v.claims.wh, v.claims.wn, v.claims.wm, v.claims.wk, v.claims.wi, v.claims.wg], ['acct-aaaa', '0123456789ab', wh, 3, CELL, 'acct-bbbb', 0, 'gabcdefghij']);
  assert.equal((await verifyOrder(o, kp.publicKey, { subtle, nowS: T + 1, kind: 'stake' })).ok, false, 'no other order');
  assert.ok(o.length <= WILD_ORDER_MAX, 'the wire carries it');
  for (const bad of [{ wn: REMAINS_RECORDS_MAX + 1 }, { wk: 'acct-aaaa', wi: 0 }, { wk: 'acct-bbbb', wi: 3 }, { wr: 'nope' }, { wh: 'nope' }, { wm: undefined }, { wm: 'chat:general' }, { wg: 'nope' }]) {
    await assert.rejects(mintRemainsOrder({ s: 'acct-aaaa', wr: '0123456789ab', wh, wn: 3, wm: CELL, ...bad }, kp.privateKey, { subtle, nowS: T }), TypeError, JSON.stringify(bad));
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

test('INT9 (AUDIT) THE ROOM\'S REMAINS, ONCE: an emptied remains is a TOMBSTONE - kept, said to nobody, never laid again while it lives, and never let go for a newcomer younger than WILD_TOMB_MIN_MS (a full room of them lays nothing); a deposit stalled WILD_STALL_MS is another carrier\'s to lay afresh, never sooner; a remains read back keeps its guild and its last chunk\'s time (mutants: the tombstone let go; the takeover at once; the guild lost on a wake)', () => {
  const items = [rec1(1)];
  const rec = newRemains({ r: '0123456789ab', os: 'acct-aaaa', oid: 'peer-a', p: [1, 2, 3], now: 1000, gi: 'gabcdefghij', wh: 'x', wn: 1 });
  foldFall(rec, { oid: 'peer-a', items, last: 1 }, 1000);
  rec.ok = true;
  assert.equal(remainsSpent(rec), false);
  takeFrom(rec, 0, 1, 'acct-cccc');
  assert.equal(remainsSpent(rec), true, 'emptied: a tombstone');
  assert.deepEqual(remainsWords(rec, 1500).flatMap((w) => w.items ?? []).filter(Boolean), [], 'said to nobody');
  const map = new Map();
  for (let i = 0; i < 24; i++) { const t = { ...rec, r: `00000000${String(i).padStart(4, '0')}`, at: 1000 + i, items: [null] }; map.set(t.r, t); }
  assert.equal(remainsEvict(map, 1000 + WILD_TOMB_MIN_MS - 1), '', 'a room full of young tombstones lays nothing');
  assert.equal(remainsEvict(map, 1000 + WILD_TOMB_MIN_MS), '000000000000', 'the oldest let go once it is old enough');
  const half = newRemains({ r: '0123456789ab', os: 'acct-aaaa', oid: 'peer-a', p: [1, 2, 3], now: 1000, wh: 'x', wn: 2 });
  foldFall(half, { oid: 'peer-a', items, last: 0 }, 1000);
  assert.equal(remainsTakeover(half, 'peer-b', 1000 + WILD_STALL_MS - 1), false, 'its carrier still laying it');
  assert.equal(remainsTakeover(half, 'peer-b', 1000 + WILD_STALL_MS), true, 'stalled: laid afresh');
  assert.deepEqual([half.oid, half.items, half.open], ['peer-b', [], true]);
  half.ok = true;
  assert.equal(remainsTakeover(half, 'peer-c', 1e9), false, 'never a vouched one');
  const back = remainsOf(JSON.parse(JSON.stringify(rec)));
  assert.deepEqual([back.gi, back.lastAt, back.ok], ['gabcdefghij', 1000, true]);
});

test('INT9 THE WIRE: a blow carries the striker\'s rolled number (`d`) and no sheet; the pick is the relay\'s (`r`, `w`), the zone word a bit, a deposit its order on every chunk; the referee\'s three words projected; the relay that first referees (mutants: a deposit with no order; a pick with an unbounded place)', () => {
  assert.deepEqual(validWildData({ k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [1, 2, 3], d: 9, a: { lv: 5 } }), { to: 'peer-0002', k: 'strike', n: 1, by: 'melee', p: [1, 2, 3], d: 9 }, 'no attacker\'s sheet for a defender to read');
  assert.deepEqual(validWildData({ k: 'zone', z: 1 }), { k: 'zone', z: 1 });
  assert.equal(validWildData({ k: 'zone', z: 2 }), null);
  assert.deepEqual(validWildData({ k: 'pick', r: '0123456789ab', w: 3, to: 'peer-0002' }), { k: 'pick', r: '0123456789ab', w: 3 }, 'to the room, never to the fallen');
  assert.equal(validWildData({ k: 'pick', r: '0123456789ab', w: WILD_ITEMS_MAX }), null);
  assert.deepEqual(validWildData({ k: 'pick', r: '0123456789ab', w: 3, t: 123, m: 9 }), { k: 'pick', r: '0123456789ab', w: 3, t: 123, m: 9 }, 'AUDIT INT9: what the offer showed there');
  for (const bad of [{ t: 123 }, { t: -1, m: 0 }, { t: 1, m: 65536 }, { w: -1, t: 1, m: 0 }]) assert.equal(validWildData({ k: 'pick', r: '0123456789ab', w: 3, ...bad }), null, JSON.stringify(bad));
  const fall = { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: [rec1(1)], last: 1, o: 'o1.x.y' };
  assert.deepEqual(validWildData(fall), fall);
  assert.equal(validWildData({ ...fall, o: undefined }), null, 'no deposit without the service\'s order');
  assert.equal(validWildData({ ...fall, o: 'x'.repeat(WILD_ORDER_MAX + 1) }), null);
  for (const k of ['result', 'gave']) assert.equal(validWildData({ k, to: 'peer-0002', n: 1, s: 'abcdef12', i: 0 }), null, `${k}: retired`);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'hp', by: 'peer-0001', to: 'peer-0002', d: 4, r: 0, h: [['peer-0001', 320, 320], ['peer-0002', 316, 320]] }).h[1], ['peer-0002', 316, 320]);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'fell', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' }), { k: 'fell', id: 'peer-0002', by: 'peer-0001', r: '0123456789ab' });
  assert.equal(validWildRefOut({ t: 'wref', k: 'rc', r: '0123456789ab', rc: 'x'.repeat(WILD_RECEIPT_MAX + 1) }), null);
  assert.equal(WILD_REF_RELAY_MIN, 184);   // PIN MOVED: world183 on its branch, renumbered past CHAP4c's world183 at the merge
  assert.deepEqual(['world183', 'world184', null].map(relaySupportsWildRef), [false, true, false]);
  assert.ok(relaySupportsWildRef(RELAY_VERSION));
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = (items = []) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items });
const CI = { 'peer-0001': RC2, 'peer-0002': RC };
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));
const wilds = (ws, k) => ws.sent.filter((m) => m.t === 'wild' && !m.data && (!k || m.k === k));
async function withZone(fn) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom(CELL, { now: () => clock });
  const relayKp = await keys();
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', relayKp.privateKey)).toString('base64');
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
  const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK(), rc: 1, ci: CI[id] ?? RC3, ...extra }); return ws; };   // AUDIT INT9: a fighter is a realm character in play
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
  // AUDIT INT7 (the pins' own): the zone's referee clips a weapon's blow to the arms the striker's token signs
  const armed = await join('peer-0006', 0, { look: LOOK([{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }]), wa: [5, 0] });
  await say(armed, { k: 'zone', z: 1 });
  step(300);
  await say(armed, { k: 'strike', to: 'peer-0002', n: 1, w: { t: 123, m: 9, c: 100 }, by: 'melee', p: W(0), d: 999 });
  assert.equal(refs(armed, 'hp').at(-1)?.d, siegeBlowMax(123, 9, [5, 0]), 'a Daedric Dai-Katana, struck at the reach its pack signs');
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
  assert.deepEqual([v.claims.r, v.claims.w, v.claims.c], [f.r, -1, RC], 'no piece; the fallen\'s realm character');
  assert.equal(rd('server/src/index.js').includes("const kin = (duel && (duel.a.sub === tb.sub || duel.b.sub === tb.sub)) || await this._wdunKinOf(a.sub, tb.sub, now);"), true, 'a duel\'s two, and the hub\'s party and its truce, are kin');
}));

test('INT9 THE RELAY, THE DEPOSIT: the room keeps remains only on the service\'s order (its key, this fall\'s id), and only once its records digest to it; a second carrier\'s deposit of a vouched remains is nothing; the killer\'s piece is said with its owner and taken by them alone (mutants: a deposit with no order kept; the digest unread; the piece anyone\'s)', () => withZone(async ({ r, say, join, now }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1), c = await join('peer-0003', 3);
  const items = [rec1(1), rec1(2), rec1(3)];
  const wh = await remainsDigest(items, { subtle });
  const nowS = Math.floor(now() / 1000);
  const order = await mintRemainsOrder({ s: 'acct-peer-0001', wr: '0123456789ab', wh, wn: 3, wm: CELL, wk: 'acct-peer-0002', wi: 0 }, (await r.signer()).privateKey, { subtle, nowS });
  const forged = await mintRemainsOrder({ s: 'acct-peer-0001', wr: '0123456789ab', wh, wn: 3, wm: CELL }, (await keys()).privateKey, { subtle, nowS });
  const elsewhere = await mintRemainsOrder({ s: 'acct-peer-0001', wr: '0123456789ab', wh, wn: 3, wm: worldRoom(PX + 16, PY) }, (await r.signer()).privateKey, { subtle, nowS });
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: elsewhere });
  assert.equal(r.store.get(wildRemainsKey('0123456789ab')), undefined, 'AUDIT INT9: another room\'s order - nothing kept here');
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
  // AUDIT INT9: emptied, a TOMBSTONE - its order (good its minute) lays nothing again, here or after a wake
  await say(c, { k: 'take', r: '0123456789ab', i: 2, n: 1 });
  assert.deepEqual(wilds(c, 'gone').map((m) => m.r), ['0123456789ab'], 'gone, said once');
  assert.equal(r.store.get(wildRemainsKey('0123456789ab'))?.ok, true, 'kept, emptied');
  r.wake();
  const told = c.sent.length;
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: order });
  assert.equal(c.sent.length, told, 'the same order lays nothing twice');
  const d = await join('peer-0004', 5);
  assert.equal(wilds(d, 'ri').length, 0, 'a tombstone said to nobody');
}));

test('INT9 (AUDIT) THE RELAY, THE ORDER\'S WORD WINS: the remains\' guild is the order\'s (whoever carries it - the killer\'s own was written); another carrier\'s chunks on a remains half laid are nothing, quietly, until its carrier has stalled WILD_STALL_MS - then laid afresh (mutants: the carrier\'s guild; a stalled deposit never laid)', () => withZone(async ({ r, say, join, step, now }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1), c = await join('peer-0003', 3);
  const items = [rec1(1), rec1(2)];
  const wh = await remainsDigest(items, { subtle });
  const order = await mintRemainsOrder({ s: 'acct-peer-0002', wr: '0123456789ab', wh, wn: 2, wm: CELL, wg: 'gbbbbbbbbbb' }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(now() / 1000) });
  await say(a, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: items.slice(0, 1), last: 0, o: order });   // the killer carries it, and stalls
  await say(c, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: order });
  assert.equal(c.closed, null, 'another carrier: nothing, and no strike');
  assert.equal(wilds(c, 'ri').length, 0);
  step(WILD_STALL_MS);
  await say(c, { k: 'fall', r: '0123456789ab', p: [1, 2, 3], items, last: 1, o: order });
  assert.equal(wilds(c, 'ri')[0]?.items.length, 2, 'stalled: laid afresh, whole');
  assert.equal(r.store.get(wildRemainsKey('0123456789ab')).gi, 'gbbbbbbbbbb', 'the fallen\'s guild, the order\'s word');
  void b;
}));

test('INT9 (AUDIT) THE RELAY, A FALL KEPT: a fall waiting on its pick is kept in the room\'s storage and signed after a restart; a fighter needs a realm character in play; a socket gone leaves the zone; a building\'s or a dungeon\'s fall is signed at once; the pick\'s piece signed (`wt`) (mutants: the fall in memory alone; a fighter with no character; the gone socket still a fighter; the room\'s fall a minute late)', () => withZone(async ({ r, say, join, step, fell, relayKp }) => {
  const a = await join('peer-0001', -1), b = await join('peer-0002', 1);
  for (const ws of [a, b]) await say(ws, { k: 'zone', z: 1 });
  const f = await fell(a, 'peer-0002');
  assert.ok(r.store.get(`wildfall:${f.r}`), 'kept');
  r.wake();
  step(WILD_REF.pickMs + 1);
  await say(a, { k: 'zone', z: 1 });
  const [rc] = refs(b, 'rc');
  assert.ok(rc, 'signed by the room that woke');
  assert.equal(r.store.get(`wildfall:${f.r}`), undefined, 'and let go');
  // the pick's piece
  const c = await join('peer-0003', 0);
  await say(c, { k: 'zone', z: 1 });
  let g = null;
  for (let k = 0; k < 400 && !g; k++) { step(300); await say(c, { k: 'strike', to: 'peer-0001', n: 500 + k, by: 'melee', p: W(0), d: 999 }); g = refs(c, 'fell').find((x) => x.id === 'peer-0001') ?? null; }
  assert.ok(g, 'A fell');
  await say(c, { k: 'pick', r: g.r, w: 1, t: 123, m: 9 });
  const v = await verifyWildReceipt(refs(c, 'rc').at(-1).rc, relayKp.publicKey, { subtle, nowS: T + 600 });
  assert.deepEqual([v.claims.w, v.claims.wt], [1, [123, 9]]);
  // no realm character: no fighter
  const n = await join('peer-0005', 2, { rc: undefined, ci: undefined });   // a token with no realm word at all (the door admits it)
  await say(n, { k: 'zone', z: 1 });
  assert.equal(r.room._wildRef.fighters.has('acct-peer-0005'), false);
  // a socket gone
  await r.drop(a);
  assert.equal(r.room._wildRef.fighters.get('acct-peer-0001').zone, false, 'out of the zone');
}));

test('INT9 (AUDIT) THE RELAY, KIN AT THE HUB: a blow between two of one party never lands, nor under its truce (a party one of them left inside WILD_REF.truceMs) - the hub\'s word, asked over the real door; past the truce they are strangers; a hub that does not answer is KIN (it answered strangers) (mutants: the party unread; the truce unread; the truce endless; a silent hub strangers)', async () => {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM), r = world.room(CELL);
    const join = async (room, id, x) => { const ws = room.connect(); await room.hello(ws, id, P(x), { lv: 10, look: LOOK(), rc: 1, ci: CI[id] }); await room.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1 } })); return ws; };
    const hit = async (room, a, b, n) => { clock += 300; await room.raw(a, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0002', n, by: 'melee', p: W(-1), d: 999 } })); return refs(b, 'hp').length; };
    hub.store.set('acct:acct-peer-0001', { party: 'p1' }); hub.store.set('acct:acct-peer-0002', { party: 'p1' });
    const a = await join(r, 'peer-0001', -1), b = await join(r, 'peer-0002', 1);
    assert.equal(await hit(r, a, b, 1), 0, 'one party: no blow');
    hub.store.set('acct:acct-peer-0002', { party: null, partyWas: { id: 'p1', at: clock } }); hub.wake();
    clock += 61_000;   // the room's word on the pair, asked again
    assert.equal(await hit(r, a, b, 2), 0, 'under the truce: no blow');
    clock += WILD_REF.truceMs;
    hub.wake();
    assert.equal(await hit(r, a, b, 3), 1, 'past the truce: strangers');
    // a hub that does not answer
    const silent = fakeRoom(worldRoom(PX + 16, PY), { now: () => clock, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error('down'); } }) } });
    const a2 = await join(silent, 'peer-0001', -1), b2 = await join(silent, 'peer-0002', 1);
    assert.equal(await hit(silent, a2, b2, 4), 0, 'no answer: kin, nothing lands');
  } finally { Date.now = realNow; }
});

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
const fall = (svc, who, body) => svc.call('/v1/wild/fall', { room: CELL, ...body }, who.secret);

test('INT9 THE SERVICE, THE FALLEN\'S OWN ACT: the drop taken off the judged record against the relay\'s receipt (the killer\'s worn piece first, half the purse, the bag and the cart by worth) at its tab\'s `at`, and the service\'s order over what it took - the killer\'s piece theirs alone, for the room the fallen names; what the record lost answered as the game finds it again; asked again, the same records and THE SAME ORDER (good its minute alone - AUDIT INT9: a fresh one each asking laid one fall twice), nothing moved twice, and the record\'s sequence told (mutants: the receipt unread; the killer\'s piece unmarked; a second asking a second drop; a fresh order each asking; the room unread)', async () => {
  const { svc, ria, bo, R, saved, receipt } = await fallen();
  const rc = await receipt();
  const at = R.at();
  assert.deepEqual((await fall(svc, ria, { receipt: rc, realm: at, room: 'chat:general' })).body.error, 'room', 'no room its remains could lie in');
  const res = await fall(svc, ria, { receipt: rc, realm: at });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.deepEqual(kinds(d.items), [121, 'gold', 120, 122], 'the killer\'s pick (the second worn piece), the coin, the magic sword, the cart\'s');
  assert.equal(d.realm.seq, at.seq + 1);
  assert.deepEqual([d.kept, d.wi, d.gold], [[], 0, { purse: 50, cart: 20 }]);
  assert.deepEqual(d.took.map((x) => [x.t, x.u, x.f]), [[121, '00000000000000a3', 'bag'], [120, '00000000000000a2', 'bag'], [122, '00000000000000a4', 'cart']], 'what the record lost, by the ids the game holds');
  const v = await verifyOrder(d.order, svc.identityPublic, { subtle, nowS: nowS(), kind: 'remains' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.wr, v.claims.wn, v.claims.wm, v.claims.wk, v.claims.wi, v.claims.wh], [ria.id, '0123456789ab', 4, CELL, bo.id, 0, await remainsDigest(d.items, { subtle })]);
  const after = saved();
  assert.deepEqual(kinds(after.items), [113, 'potion'], 'the record lost what the room holds');
  assert.equal(after.goldPieces, 51);
  const again = await fall(svc, ria, { receipt: rc, realm: R.at(), room: worldRoom(PX + 16, PY) });
  assert.equal(again.status, 200);
  assert.deepEqual([again.body.items, again.body.order, again.body.realm?.seq, again.body.took], [d.items, d.order, at.seq + 1, d.took], 'the same records, the same order (its first room), and where the record stands');
  assert.equal(R.at().seq, at.seq + 1, 'nothing moved twice');
  const row = svc.env.DB._raw.prepare('SELECT player, killer, wi, burnt, wm FROM wild_falls WHERE r = ?').get('0123456789ab');
  assert.deepEqual({ ...row }, { player: ria.id, killer: bo.id, wi: 0, burnt: 0, wm: CELL });
  svc.env.DB._raw.prepare('UPDATE wild_falls SET oi = oi - 10').run();
  const later = await verifyOrder((await fall(svc, ria, { receipt: rc, realm: R.at() })).body.order, svc.identityPublic, { subtle, nowS: nowS(), kind: 'remains' });
  assert.equal(later.claims.i, v.claims.i - 10, 'asked later inside its minute: issued at its first minting, never now');
  svc.env.DB._raw.prepare('UPDATE wild_falls SET oi = oi - ?').run(ORDER_TTL_S);
  assert.equal((await fall(svc, ria, { receipt: rc, realm: R.at() })).body.order, null, 'its minute gone: no order at all');
  // a receipt names its character: the fallen's act at another of its characters' records is refused
  const R2 = await seatRealm(svc.env, ria.secret, 'Second', record());
  const other = await fall(svc, ria, { receipt: await receipt({ r: 'aaaaaaaaaaaa' }), realm: R2.at() });
  assert.deepEqual([other.status, other.body.error], [403, 'not-yours'], 'never another character\'s record');
});

test('INT9 (AUDIT) THE SERVICE, THE DROP\'S LEDGER: every valuable piece dropped lies in the remains under a FRESH id, and the id it had is written down as the fallen\'s own copy - a game that kept the piece holds a copy that moves by no route, and whoever takes it up holds it clean (it charged the taker); a crafted piece keeps its craft\'s key, written down the same; the save two back dropped (mutants: the old id in the remains; no copy written; the old save left)', async () => {
  const { svc, ria, R, receipt } = await fallen();
  const prevObj = () => svc.env.DB._raw.prepare('SELECT prev FROM realm_characters WHERE id = ?').get(R.id).prev;
  const res = await fall(svc, ria, { receipt: await receipt(), realm: R.at() });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sword = res.body.items.find((it) => it.templateIndex === 120);
  assert.match(sword.uid, /^[0-9a-f]{16}$/);
  assert.notEqual(sword.uid, '00000000000000a2', 'the magic sword (a piece the ledger follows): never the id it had');
  assert.deepEqual(res.body.items.filter((it) => it.templateIndex !== 120 && it.uid).map((it) => it.uid).sort(), ['00000000000000a3', '00000000000000a4'], 'a plain piece is no piece the ledger follows: as it was');
  const copies = svc.env.DB._raw.prepare('SELECT uid FROM item_dupes WHERE char_id = ? ORDER BY uid').all(R.id).map((x) => x.uid);
  assert.deepEqual(copies, ['00000000000000a2'], 'the id it had, the fallen\'s copy');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM item_uids WHERE uid = ?').get(sword.uid).n, 0, 'the fresh id, nobody\'s yet');
  assert.ok(prevObj() == null || svc.env.SAVES._map.has(prevObj()), 'the row names no object that is gone');
  assert.ok(rd('server-account/src/wild.js').includes('await dropObjects(ctx.bucket, [moved.prev]);'), 'the save two back dropped, as every act drops it');
});

test('INT9 (AUDIT) THE SERVICE, EVERY CANDIDATE ASKED: the ledger is asked of every piece the death could take, never a dry run\'s fitted few - a barred piece in the fit lets in one past it, and that one is asked too (mutants: the fitted few asked)', async () => {
  const svc = await standService();
  const ria = await svc.registered('Riadne');
  // ninety-seven magic blades, each worth less than the one before: the gold and ninety-five of them fit one remains
  const blades = Array.from({ length: 97 }, (_, i) => weapon(113 + (i % 9), { uid: (0xb000 + i).toString(16).padStart(16, '0'), magic: true, value: 5000 - i }));
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', { name: 'Riadne', level: 9, goldPieces: 100, items: blades, wagonItems: [] });
  const A = blades[0].uid, X = blades[95].uid;   // the most worth, and the first past the dry run's fit
  for (const uid of [A, X]) svc.env.DB._raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, 'someone', 'rffffffffffffffffffff', 1, 'held', ?, 1)").run(uid, `${blades[uid === A ? 0 : 95].templateIndex}:0`);
  const res = await svc.call('/v1/wild/fall', { n: '00112233445566aa', realm: R.at(), room: CELL }, ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([...res.body.kept].sort(), [A, X].sort(), 'both barred: the one in the fit, and the one it let in');
  assert.equal(res.body.took.some((x) => x.u === X), false, 'the one past the fit never taken');
});

test('INT9 THE SERVICE, THE KILLER\'S SEIZURE: the killer carries the receipt only once WILD_FALL_GRACE_S has gone by - then the record is taken where it stands and its lease cleared (whatever tab held it plays a record that moved under it); a stranger carries nothing (mutants: the grace unread; the lease kept; a stranger\'s carry)', async () => {
  const { svc, bo, cy, R, saved, receipt } = await fallen();
  const early = await fall(svc, bo, { receipt: await receipt() });   // the killer names the room that refereed the fall
  assert.deepEqual([early.status, early.body.error], [409, 'grace']);
  assert.deepEqual([(await fall(svc, cy, { receipt: await receipt() })).status], [403], 'not theirs');
  const at = R.at();
  const late = await fall(svc, bo, { receipt: await receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 }) });
  assert.equal(late.status, 200, JSON.stringify(late.body));
  assert.equal(late.body.realm, undefined, 'no record of the killer\'s moved');
  assert.deepEqual([R.at().seq, R.at().lease], [at.seq + 1, null], 'moved where it stood, the lease cleared');
  assert.deepEqual(kinds(saved().items), [113, 'potion']);
});

test('INT9 THE SERVICE, A DEATH TO A FOE: no receipt - the fallen\'s own act on its own nonce (the remains\' id a digest of the character and the nonce, so asked again it is the same fall and never a relay\'s id), no worn piece; a bad nonce refused (mutants: the nonce unread; a worn piece taken)', async () => {   // the room: fall()'s own
  const { svc, ria, R } = await fallen();
  assert.deepEqual([(await fall(svc, ria, { realm: R.at() })).body.error], ['nonce']);
  const res = await fall(svc, ria, { n: '00112233445566ff', realm: R.at() });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.r, /^[0-9a-f]{12}$/);
  assert.deepEqual(kinds(res.body.items), ['gold', 120, 122], 'the worn pieces stay');
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
  assert.deepEqual(kinds(res.body.items), [121, 'gold', 122]);
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

test('INT9 THE CLIENT: a blow rolled on my own sheet and sent as a number; no defender\'s resolve; the referee\'s fall a DEATH no door turns aside (AUDIT INT9: the SetHealth(0) door\'s AvoidDeath and withholding stood a fallen up); my drop the service\'s act on my record, naming the room my remains lie in, and EXACTLY what it took out of my pack (AUDIT INT9: the game ran the law again without the ledger\'s word); the room given the service\'s records on its order, chunked by their bytes; a fall I won seized after the grace where the body fell (mutants: the defender\'s resolve kept; a drop of my own choosing taken; the seizure unread; the deposit in one heavy frame)', () => {
  const w = rd('src/scenes/world.js'), o = rd('src/net/online.js');
  assert.ok(o.includes('if (primary) this.wildOk = relaySupportsWildRef(relayV);'), 'a relay that referees the zone, or none of it');
  assert.ok(o.includes("} else if (m.t === 'wref') {"));
  assert.ok(w.includes('online?.setWildZone?.(wildCan() ? 1 : 0);'));
  assert.ok(w.includes("const n = wildFight.blow(to, 'strike', { by, p: campToWire(player.feetAt()), d: Math.trunc(r.dmg),"));
  assert.ok(!w.includes('resolveDuelStrike(d, playerEntity'), 'the defender resolves nothing');
  assert.ok(w.includes('      forcePlayerDeath(playerEntity);\n'), 'the referee\'s fall, a death');
  assert.ok(w.includes('call: (at) => wildAccount.fall({ ...(c ? { receipt: rc } : { n: nonce }), realm: at, room: lay }),'));
  assert.ok(w.includes('const out = wildTakeTook(playerEntity, d.took, d.gold, (it) => { if (isEquipped(it)) unequipItem(playerEntity, it); });'), 'what the service took, and nothing of my own reckoning');
  assert.ok(!w.includes('takeWildDeath('), 'the law never run again on my pack');
  assert.ok(w.includes('if (d.order && n && body) wildDeposit({ r: d.r, items: d.items, o: d.order, p: body.p, room, mine: body });'), 'the service\'s records, on its order');
  assert.ok(w.includes("online?.sendWild({ k: 'fall', r: dep.r, p: dep.p, items: dep.chunks[dep.k], last: dep.k === dep.chunks.length - 1 ? 1 : 0, o: dep.o }, { room: dep.room })"));
  assert.ok(w.includes('_wildDeposits.push({ ...dep, chunks: wildChunks(dep.items, WILD_ITEMS_MAX, room), k: 0, at: Date.now() });'), 'chunked by their bytes');
  assert.ok(w.includes('wildAccount.fall({ receipt: s.rc, room: s.room }).then((a) => {'), 'the seizure names the room that refereed it');
  assert.ok(w.includes('const p = s.p ?? campToWire(player.feetAt());'), 'laid where the body fell');
  assert.ok(!/takeWildDrop\(|takeWildGold\(/.test(w), 'no drop of the client\'s own making');
  // the chunks: every frame of a heavy drop inside the wire's bound
  const heavy = Array.from({ length: 16 }, (_, i) => ({ group: 'Weapons', templateIndex: 120, material: 0, note: `${i}`.repeat(1500) }));
  const room = WILD_DATA_MAX - JSON.stringify({ k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: [], last: 0, o: 'x'.repeat(900) }).length - 16;
  const chunks = wildChunks(heavy, WILD_ITEMS_MAX, room);
  assert.ok(chunks.length > 1 && chunks.flat().length === 16);
  for (const c of chunks) assert.ok(validWildData({ k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: c, last: 0, o: 'x'.repeat(900) }), 'each a frame the wire takes');
  assert.equal(validWildData({ k: 'fall', r: '0123456789ab', p: [1, 2, 3], items: heavy, last: 0, o: 'x'.repeat(900) }), null, 'the drop in one frame: refused');
});

test('INT9 (AUDIT) THE CLIENT\'S LINK: my zone word on MY OWN CELL\'S socket alone - a halo hears none (each held a whole bar of its own) - said again every WILD_ZONE_KEEP_MS while it stands; at a crossing the cell left hears 0 and the one crossed into 1, the zone\'s relay word going with each socket; a pick or a deposit for a room I no longer hold goes nowhere (it went down my own socket); the duel referee\'s word heard on any socket, with its room (mutants: the word on a halo; the keepalive unsaid; the crossing unsaid; the room\'s fallback; the referee\'s word on the primary alone)', () => {
  const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
  quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const clock = { t: 1000 };
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t });
    const pose = { x: 1, y: 0, z: 1, yaw: 0 };
    const welcome = { t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, v: RELAY_VERSION };
    s.join('world:2,12', pose); sockets[0].open(); sockets[0].receive(welcome);
    s.setHalo(['world:3,12']); sockets[1].open(); sockets[1].receive(welcome);
    const zones = (ws) => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'wild' && m.data?.k === 'zone').map((m) => m.data.z);
    s.setWildZone(1);
    assert.deepEqual([zones(sockets[0]), zones(sockets[1])], [[1], []], 'my cell\'s, never a halo\'s');
    clock.t += WILD_ZONE_KEEP_MS - 1; s.setWildZone(1);
    assert.deepEqual(zones(sockets[0]), [1]);
    clock.t += 1; s.setWildZone(1);
    assert.deepEqual(zones(sockets[0]), [1, 1], 'said again while it stands');
    s.join('world:3,12', pose);
    assert.deepEqual([zones(sockets[0]), zones(sockets[1])], [[1, 1, 0], [1]], 'the cell left hears I left it; the one crossed into, that I stand in it');
    assert.equal(s.wildOk, true, 'the zone\'s relay word crossed with its socket');
    assert.equal(s.sendWild({ k: 'pick', r: '0123456789ab', w: 0 }, { room: 'world:9,9' }), false, 'a room I do not hold: nowhere');
    const refs = []; s.onDuelRef = (g, room) => refs.push([g.k, room]);
    sockets[0].receive({ t: 'dref', k: 'no', s: 'duel123456', why: 'busy' });
    assert.deepEqual(refs, [['no', 'world:2,12']], 'the referee\'s word on a halo, with its room');
  });
});
