// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use"; bible/11-Multiplayer/Staff-Events.md) -
// THE LAW (net/staffEvent/staffEventLaw.js): an event's shape and bounds, the words each way, the cell's ledger (the cap,
// the meter's boss once, a hand call one more, the boss's moments from the one who stands it, done), the signed order
// (identityToken.js 'sevent'), and the place picker's game half (net/staffPlaces.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validStaffEvent, staffEventFault, validStaffEventIn, validStaffEventOut, validStaffEventTell, newStaffLedger, staffEventCap, staffBossCall,
  foldStaffWord, staffEventDone, staffLedgerState, staffEventTell, staffEventKey, staffEventIdOf, staffEventLapsed, isAreaEvent,
  relaySupportsStaffEvents, staffEventKindOk, STAFF_EVENT_KILLS_BURST, STAFF_EVENT_KILL_MS, STAFF_BOSS_HEALTH_DEFAULT,
  STAFF_EVENT_ACCOUNTS_MAX, STAFF_EVENT_PRESENT_MS, STAFF_BOSS_HP_MAX,
} from '../../src/net/staffEvent/staffEventLaw.js';
import { mintStaffEventOrder, verifyOrder, orderValid, ORDER_KINDS } from '../../src/net/identityToken.js';
import { staffPlaces, staffHere, placeKind, gameMaps, keptMaps } from '../../src/net/staffPlaces.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';

const { subtle } = globalThis.crypto;
const EV = Object.freeze({ id: 'ab12cd34ef', rg: 17, loc: 0, px: 207, py: 213, nm: 'Daggerfall', ct: 1, mt: [7, 12], n: 50, m: 25, b: 24, bs: 200, bh: 10, at: 1_700_000_000_000, ue: 0, eb: 1, fb: 0, by: 'SirMcMobdon' });

test('STAFF-EVENT: an event is held to its bounds - kinds any monster but the two barred, the meter no past the total, the boss sized 1.5x-3x and 1x-100x its health', () => {
  assert.deepEqual(validStaffEvent(EV), { ...EV, mt: [7, 12], hp: 0 });
  assert.equal(validStaffEvent({ ...EV, bh: undefined }).bh, STAFF_BOSS_HEALTH_DEFAULT, 'an order before the health pick reads 10x');
  assert.equal(validStaffEvent({ ...EV, ct: 1 }).ct, 1, 'a city said as one');
  assert.equal(validStaffEvent({ ...EV, ct: undefined }).ct, 0, 'a place the panel did not call a city is an area');
  assert.equal(validStaffEvent({ ...EV, loc: -1, ct: 1 }).ct, 0, 'an area is never a city');
  for (const bad of [{ id: 'AB' }, { rg: 256 }, { loc: -2 }, { px: 1000 }, { py: 500 }, { mt: [] }, { mt: [39] }, { mt: [146] }, { mt: Array.from({ length: 13 }, (_, i) => i) },
    { n: 0 }, { n: 501 }, { m: 51 }, { m: 0 }, { b: 39 }, { bs: 149 }, { bs: 301 }, { bh: 0 }, { bh: 101 }, { bh: 2.5 }, { hp: -1 }, { hp: STAFF_BOSS_HP_MAX + 1 }, { hp: 1.5 }, { at: 0 }, { ue: EV.at }, { ue: EV.at + 24 * 3600_000 + 1 }, { fb: 100 }]) {
    assert.equal(validStaffEvent({ ...EV, ...bad }), null, JSON.stringify(bad));
    assert.ok(staffEventFault({ ...EV, ...bad }), `EVENT-FAULT names it: ${JSON.stringify(bad)}`);
  }
  assert.equal(staffEventFault(EV), null);
  assert.deepEqual([{ m: 51 }, { mt: [39] }, { bh: 0 }, { ue: EV.at }].map((x) => staffEventFault({ ...EV, ...x })), ['meter', 'monsters', 'health', 'runs']);
  assert.deepEqual(validStaffEvent({ ...EV, mt: [7, 7, 12] }).mt, [7, 12], 'each kind once');
  assert.equal(validStaffEvent({ ...EV, nm: '<b>Dagger\u0000fall</b>' }).nm, 'bDaggerfall/b', 'a name with no markup or control');
  for (const k of [0, 42, 128, 145, 256, 290, 384, 398]) assert.ok(staffEventKindOk(k), `kind ${k}`);
  assert.ok(isAreaEvent({ ...EV, loc: -1 }) && !isAreaEvent(EV));
  assert.ok(staffEventLapsed({ ...EV, ue: EV.at + 1000 }, EV.at + 1000) && !staffEventLapsed(EV, EV.at * 2));
  assert.equal(staffEventIdOf(staffEventKey(EV.id)), EV.id);
  assert.equal(staffEventIdOf('raid:17:0:3'), null);
  assert.ok(relaySupportsStaffEvents('world256') && !relaySupportsStaffEvents('world255') && !relaySupportsStaffEvents(null));
});

test('STAFF-EVENT: the words each way are projected - a player\'s word, the hub\'s book and end, a cell\'s ledger, a tell', () => {
  assert.deepEqual(validStaffEventIn({ k: 'w', id: EV.id, px: 207, py: 213, n: 4, s: 1, extra: 9 }), { k: 'w', id: EV.id, px: 207, py: 213, n: 4, s: 1, bu: 0, bk: 0, fb: 0, h: 0 });
  for (const bad of [{ k: 'x' }, { n: -1 }, { n: 10_000 }, { bu: 2 }, { fb: 100 }, { px: 1000 }]) assert.equal(validStaffEventIn({ k: 'w', id: EV.id, px: 207, py: 213, n: 1, ...bad }), null);
  const book = validStaffEventOut({ k: 'ev', l: [EV, EV, { ...EV, id: 'zz' }, { ...EV, id: 'cc22dd33ee' }] });
  assert.deepEqual(book.l.map((e) => e.id), [EV.id, 'cc22dd33ee'], 'each event once, a bad one dropped');
  assert.deepEqual(validStaffEventOut({ k: 'end', id: EV.id, why: 'nope' }), { k: 'end', id: EV.id, why: 'staff' });
  assert.deepEqual(validStaffEventOut({ k: 'st', id: EV.id, n: 3, bd: 1, fc: 2 }), { k: 'st', id: EV.id, n: 3, bd: 1, bu: 0, bk: 0, fc: 2 });
  assert.equal(validStaffEventOut({ k: 'st', id: EV.id, n: 501 }), null);
  assert.deepEqual(validStaffEventTell({ id: EV.id, n: 3, f: 2 }), { id: EV.id, n: 3, bd: 0, bu: 0, bk: 0, fc: 0, bossN: 0, f: 2 });
  assert.equal(validStaffEventTell({ id: EV.id, n: 3, f: STAFF_EVENT_ACCOUNTS_MAX + 1 }), null);
});

test('STAFF-EVENT: THE LEDGER - kills credited the most each account said, under the cap and the total; the meter calls one boss; it stands and falls by its stander\'s word; a hand call is one more', () => {
  const e = validStaffEvent({ ...EV, n: 30, m: 12 });
  const t0 = 1000;
  const led = newStaffLedger(e, t0);
  // the cap: a burst at once, then one each STAFF_EVENT_KILL_MS
  let r = foldStaffWord(led, e, 'acctA', 'Ann', { n: 25, s: 1 }, t0);
  assert.equal(r.credited, STAFF_EVENT_KILLS_BURST);
  assert.equal(led.n, STAFF_EVENT_KILLS_BURST);
  assert.equal(staffEventCap(led, t0 + 4 * STAFF_EVENT_KILL_MS), STAFF_EVENT_KILLS_BURST + 4);
  r = foldStaffWord(led, e, 'acctA', 'Ann', { n: 25 }, t0 + 4 * STAFF_EVENT_KILL_MS);
  assert.equal(led.n, 14, 'the cap grows with time');
  assert.ok(r.boss && led.bd === 1, 'the meter at 12 calls the boss');
  assert.equal(staffBossCall(led, e), false, 'one at a time: never again while it stands');
  // a word that says less credits nothing; another account adds its own
  foldStaffWord(led, e, 'acctA', 'Ann', { n: 3 }, t0 + 5000);
  assert.equal(led.n, 14);
  foldStaffWord(led, e, 'acctB', 'Bo', { n: 4 }, t0 + 5000);
  assert.equal(led.n, 18);
  // the total bounds the count
  foldStaffWord(led, e, 'acctB', 'Bo', { n: 999 }, t0 + 60_000);
  assert.equal(led.n, 30);
  // the boss's moments: stood (for the call it answers), then fell
  assert.equal(foldStaffWord(led, e, 'acctA', 'Ann', { n: 25, bk: 1 }, t0 + 61_000).boss, false, 'a fall before it stood moves nothing');
  assert.ok(foldStaffWord(led, e, 'acctA', 'Ann', { n: 25, bu: 1 }, t0 + 61_000).boss && led.bu === 1);
  assert.equal(staffEventDone(led, e), null, 'every monster dead but the boss stands: not done');
  assert.ok(foldStaffWord(led, e, 'acctA', 'Ann', { n: 25, bu: 1, bk: 1 }, t0 + 62_000).boss && led.bk === 1 && led.bossN === 1);
  assert.equal(staffEventDone(led, e), 'boss', 'its fall ends it (eb)');
  assert.equal(staffEventDone(led, { ...e, eb: 0 }), 'done', 'or every monster is dead');
  // a hand call: one more boss, its moments read for that call alone
  const e2 = { ...e, eb: 0, fb: 1 };
  assert.ok(staffBossCall(led, e2) && led.fc === 1 && led.bd === 1 && led.bu === 0 && led.bk === 0);
  assert.equal(foldStaffWord(led, e2, 'acctA', 'Ann', { n: 25, bu: 1, fb: 0 }, t0 + 63_000).boss, false, 'an old call\'s word');
  assert.ok(foldStaffWord(led, e2, 'acctA', 'Ann', { n: 25, bu: 1, fb: 1 }, t0 + 63_000).boss);
  assert.deepEqual(staffLedgerState(led), { k: 'st', id: e.id, n: 30, bd: 1, bu: 1, bk: 0, fc: 1 });
  assert.equal(staffEventTell(led, t0 + 63_000).f, 2);
  assert.equal(staffEventTell(led, t0 + 63_000 + STAFF_EVENT_PRESENT_MS + 1).f, 0, 'nobody fighting after 15 s quiet');
  led.ended = 1;
  assert.deepEqual(foldStaffWord(led, e2, 'acctC', 'C', { n: 5 }, t0), { credited: 0, known: false, boss: false }, 'an ended ledger hears nothing');
});

test('BOSS-HP and BOSS-AGAIN (mob 2026-10-25: "need be able to eneter a exact amount of healt for mini bosses", "boss seems to not spawn every time"): an exact health carried; the meter calls a boss each time it fills, one at a time; a hand call between moves the next call on', () => {
  assert.equal(validStaffEvent({ ...EV, hp: 12345 }).hp, 12345, 'the exact health staff typed');
  assert.equal(validStaffEvent({ ...EV, hp: undefined }).hp, 0, 'an order before it reads none - the times its kind\'s');
  const e = validStaffEvent({ ...EV, n: 100, m: 10, eb: 0 });
  const led = newStaffLedger(e, 0);
  const t = (/** @type {number} */ s) => s * 1000;
  foldStaffWord(led, e, 'a', 'Ann', { n: 10 }, t(10));
  assert.ok(led.bd === 1 && led.fc === 0 && led.mc === 1, 'the first fill: boss call 0');
  foldStaffWord(led, e, 'a', 'Ann', { n: 25, bu: 1, fb: 0 }, t(20));
  assert.equal(led.fc, 0, 'past the second fill while it stands: no call yet');
  foldStaffWord(led, e, 'a', 'Ann', { n: 25, bu: 1, bk: 1, fb: 0 }, t(21));
  assert.ok(led.bk === 1 && led.bossN === 1);
  assert.ok(foldStaffWord(led, e, 'a', 'Ann', { n: 25, fb: 0 }, t(22)).boss && led.fc === 1 && led.bd === 1 && led.bu === 0 && led.bk === 0 && led.mc === 2, 'fallen: the second fill calls the next');
  foldStaffWord(led, e, 'a', 'Ann', { n: 26, bu: 1, bk: 1, fb: 1 }, t(23));
  assert.equal(staffBossCall(led, e), false, 'the third fill waits for 30');
  assert.ok(staffBossCall(led, { ...e, fb: 1 }) && led.fc === 2 && led.hc === 1, 'a hand call: the next call, its own');
  assert.equal(staffBossCall(led, { ...e, fb: 1 }), false, 'the same hand once');
  foldStaffWord(led, e, 'a', 'Ann', { n: 30, bu: 1, bk: 1, fb: 2 }, t(30));
  assert.ok(staffBossCall(led, { ...e, fb: 1 }) && led.fc === 3 && led.mc === 3, 'the third fill');
  // a ledger kept before BOSS-AGAIN: its meter boss called, a hand call taken as fc 1
  const old = { ...newStaffLedger(e, 0), n: 12, bd: 1, bu: 1, bk: 1, fc: 1, bossN: 2 };
  delete old.hc; delete old.mc;
  assert.equal(staffBossCall(old, { ...e, fb: 1 }), false, 'its hand taken, its meter once: 12 kills call nothing');
  old.n = 20;
  assert.ok(staffBossCall(old, { ...e, fb: 1 }) && old.fc === 2, 'its second fill calls the next');
});

test('STAFF-EVENT: THE ORDER - its own kind, only its own fields, each op with what it needs; minted and verified', async () => {
  assert.ok(ORDER_KINDS.includes('sevent'));
  const base = { o: 'sevent', s: 'acct_1234', i: 100, e: 160 };
  assert.ok(orderValid({ ...base, op: 'start', ev: EV }));
  assert.ok(orderValid({ ...base, op: 'boss', ei: EV.id }) && orderValid({ ...base, op: 'end', ei: EV.id }) && orderValid({ ...base, op: 'look' }));
  for (const bad of [{ op: 'start' }, { op: 'start', ev: EV, ei: EV.id }, { op: 'end' }, { op: 'boss', ei: 'X' }, { op: 'look', ei: EV.id }, { op: 'nuke' }, { op: 'look', fz: 1 }]) {
    assert.equal(orderValid({ ...base, ...bad }), false, JSON.stringify(bad));
  }
  assert.equal(orderValid({ o: 'smsg', s: 'acct_1234', mi: 'abcd', op: 'look', i: 100, e: 160 }), false, 'no other kind carries an op');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(Date.now() / 1000);
  const tok = await mintStaffEventOrder({ s: 'acct_1234', op: 'start', ev: EV }, kp.privateKey, { subtle, nowS });
  const v = await verifyOrder(tok, kp.publicKey, { subtle, nowS, kind: 'sevent' });
  assert.ok(v.ok);
  assert.deepEqual(v.claims.ev, EV);
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS, kind: 'smsg' })).ok, false);
  await assert.rejects(mintStaffEventOrder({ s: 'acct_1234', op: 'start', ev: { ...EV, n: 0 } }, kp.privateKey, { subtle, nowS }), /refused/);
});

test('STAFF-EVENT: THE PLACE PICKER (the game\'s half) - a region\'s named places off the maps, towns first; where I stand; the maps kept as the boot makes them', () => {
  const T = LOCATION_TYPES;
  const rows = [{ locationType: T.TownCity, longitude: 0, latitude: 0 }, { locationType: T.DungeonLabyrinth, longitude: 0, latitude: 0 }, { locationType: T.TownHamlet, longitude: 0, latitude: 0 }, { locationType: T.Tavern, longitude: 0, latitude: 0 }];
  const names = ['Daggerfall', 'Copperham', 'Ashfield', ''];
  const maps = { getRegion: (r) => (r === 17 ? { mapTable: rows, mapNames: names } : null), baseLocationCount: () => 4, getRegionName: (r) => (r === 17 ? 'Daggerfall' : ''), getRegionIndexAt: () => 17 };
  const p = staffPlaces(maps, 17);
  assert.equal(p.dfoStaff, 'places');
  assert.deepEqual(p.list.map((x) => [x.loc, x.name, x.kind]), [[2, 'Ashfield', 'town'], [0, 'Daggerfall', 'town'], [1, 'Copperham', 'dungeon']], 'towns first, by name; a place with no name left out');
  assert.deepEqual(staffPlaces(maps, 62).list, [], 'no region past the politic map');
  assert.deepEqual(staffPlaces(null, 17).list, []);
  const px = p.list[0];
  assert.deepEqual(staffHere(maps, { x: px.px, y: px.py }), { dfoStaff: 'here', region: 17, name: 'Daggerfall', loc: 2, place: 'Ashfield', kind: 'town', px: px.px, py: px.py });
  assert.equal(staffHere(maps, { x: 999, y: 1 }).kind, null, 'no place on that pixel: an area, no kind');
  assert.equal(staffHere(null, { x: 1, y: 1 }).region, null);
  assert.equal(placeKind(T.ReligionCult), 'temple');
  assert.equal(placeKind(T.HomeWealthy), 'home');
  const m = {};
  assert.equal(gameMaps(m), m);
  assert.equal(keptMaps(), m);
});
