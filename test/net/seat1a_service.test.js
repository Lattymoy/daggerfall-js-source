// SEAT1a (2026-09-30, Mac: "Finish the seats"): THE SEATS' WITNESSED REGISTRY, AS THE SERVICE KEEPS IT - driven through
// the real Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md
// 3.2; `06-Systems/Online-Arc.md` SEAT1a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { WITNESS } from '../../src/net/nodeLaw.js';
import { seatReportText, SEAT_WITNESS_REPORTS_HOUR } from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [610, 118] };

/** The service, the seats open (or `seats`), and accounts: `aged(handle)` a week and a day registered - a witness. */
async function stood({ seats = 'on' } = {}) {
  const svc = await standService({ ...(seats ? { SEATS_OPEN: seats } : {}), DEVELOPER_HANDLES: 'Devra' });
  const raw = svc.env.DB._raw;
  const aged = async (handle) => {
    const who = await svc.registered(handle);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(T0 - WITNESS.ageS - 86400, who.id);
    return who;
  };
  const witness = (who, seat = ANTICLERE) => svc.call('/v1/seats/witness', { seat }, who.secret);
  const list = async (who) => (await svc.call('/v1/seats/list', {}, who.secret)).body;
  return { svc, raw, aged, witness, list };
}

test('SEAT1a three witnesses a week old confirm a seat byte for byte; a younger account and a guest count for nothing; the first answer of each stands (mutants: the age; the confirm count; the INSERT OR IGNORE)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, raw, aged, witness, list } = await stood();
  const [a, b, c] = [await aged('Adala'), await aged('Bodil'), await aged('Cyril')];
  const young = await svc.registered('Newt');
  const y = await witness(young);
  assert.deepEqual([y.status, y.body.counted, y.body.why], [200, false, 'young'], 'a new account is answered and counts for nothing');
  const guest = await svc.guest();
  assert.equal((await svc.call('/v1/seats/witness', { seat: ANTICLERE }, guest.secret)).body.error, 'seats-need-account');
  assert.equal((await witness(a)).body.counted, true);
  assert.equal((await witness(b)).body.counted, true);
  assert.deepEqual((await list(a)).seats, [], 'two agree: not yet');
  assert.equal((await witness(c)).body.counted, true);
  assert.deepEqual((await list(a)).seats, [{ ...ANTICLERE, state: 'confirmed', holder: null, battle: null }]);   // SEAT1c (PIN MOVED): each seat's holder and battle beside it
  assert.deepEqual((await list(a)).me, { witness: true, developer: false });
  assert.equal((await list(young)).me.witness, false);
  // the first answer stands: a witness's second, different report changes nothing
  await witness(a, { ...ANTICLERE, name: 'Anticlair' });
  assert.equal(raw.prepare("SELECT report FROM world_witness WHERE kind = 'seat' AND account = ?").get(a.id).report, seatReportText(ANTICLERE));
});

test('SEAT1a the one dispute rule: a lone dissenter is counted, not obeyed; two agreeing on another answer DISPUTE the seat, which keeps its confirmed answer and every effect; an account whose disagreements match nobody else\'s three times is ignored (mutants: the dispute count; the confirmed answer kept; the ignored filter)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { aged, witness: say, list, raw } = await stood();
  const witness = (who, seat) => { now += 60; return say(who, seat); };   // each report its own moment: the law reads them in order
  const w = [];
  for (const h of ['Adala', 'Bodil', 'Cyril', 'Dinah', 'Edric', 'Fayre']) w.push(await aged(h));
  for (const x of w.slice(0, 3)) await witness(x);
  await witness(w[3], { ...ANTICLERE, pixel: [402, 152] });
  assert.deepEqual((await list(w[0])).seats.map((s) => s.state), ['confirmed'], 'one dissenter: still confirmed');
  await witness(w[4], { ...ANTICLERE, pixel: [402, 152] });
  const d = (await list(w[0])).seats;
  assert.deepEqual(d, [{ ...ANTICLERE, state: 'disputed', holder: null, battle: null }], 'two agree on another answer: disputed - the confirmed answer still in force');
  // a lone liar, three times over: every report of theirs matches nobody - ignored
  const liar = w[5];
  const seats = [{ ...WAYREST }, { key: 7001, name: 'Glenpoint', region: 18, tier: 'palace', pixel: [200, 100] }, { key: 7002, name: 'Tulune', region: 58, tier: 'palace', pixel: [150, 120] }];
  for (const s of seats) for (const x of w.slice(0, 3)) await witness(x, s);
  for (const s of seats) await witness(liar, { ...s, pixel: [s.pixel[0] + 1, s.pixel[1]] });
  assert.equal((await list(liar)).me.witness, false, 'the liar is ignored');
  assert.equal((await witness(liar, { key: 7003, name: 'Somewhere', region: 18, tier: 'palace', pixel: [1, 1] })).body.why, 'ignored');
  void raw;
});

test('SEAT1a the shape: a crown stands in its crown\'s region and bears its name; a bad seat is refused; the switch - off, and at dev the developers alone; the hour\'s reports bounded (mutants: the crown\'s name; the switch; the rate)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, aged, witness } = await stood({ seats: 'dev' });
  const a = await aged('Adala');
  assert.equal((await witness(a)).body.error, 'seats-closed', 'at dev a player who is no developer sees none');
  const dev = await aged('Devra');
  assert.equal((await witness(dev, { ...WAYREST, name: 'Daggerfall' })).body.error, 'bad-seat', 'a crown bearing another\'s name');
  assert.equal((await witness(dev, { ...WAYREST, region: 21 })).body.error, 'bad-seat', 'a crown outside its region');
  assert.equal((await witness(dev, { ...ANTICLERE, pixel: [1000, 1] })).body.error, 'bad-seat');
  assert.equal((await witness(dev, { ...ANTICLERE, name: ' Anticlere' })).body.error, 'bad-seat', 'the canonical name alone');
  assert.equal((await witness(dev, WAYREST)).status, 200);
  for (let i = 1; i < SEAT_WITNESS_REPORTS_HOUR; i++) await witness(dev);
  assert.equal((await witness(dev)).body.error, 'seats-rate');
  const off = await stood({ seats: null });
  assert.equal((await off.svc.call('/v1/seats/list', {}, (await off.aged('Xenia')).secret)).body.error, 'seats-closed');
  void svc;
});

test('SEAT1a a developer\'s strike: the seat\'s reports go, a history row says so, and the key is never witnessed again; a developer reads the unconfirmed and the audit - a seat confirmed by exactly three whom nobody else joined (mutants: the developer asked; the history row; the struck check; the audit)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, raw, aged, witness, list } = await stood();
  const w = [await aged('Adala'), await aged('Bodil'), await aged('Cyril')];
  const dev = await aged('Devra');
  for (const x of w) await witness(x);
  await witness(w[0], WAYREST);
  const dv = await list(dev);
  assert.deepEqual(dv.audit, [ANTICLERE.key], 'confirmed by exactly three whom nobody else joined - for a person to read');
  const fourth = await aged('Quade');
  await witness(fourth);
  assert.deepEqual((await list(dev)).audit, [], 'a fourth agreeing: off the audit');
  assert.deepEqual(dv.unconfirmed, [{ ...WAYREST, state: 'unconfirmed', witnesses: 1 }]);
  assert.equal((await list(w[0])).audit, undefined, 'the audit is the developers\'');
  assert.equal((await svc.call('/v1/seats/strike', { key: ANTICLERE.key }, w[0].secret)).body.error, 'not-developer');
  const s = await svc.call('/v1/seats/strike', { key: ANTICLERE.key }, dev.secret);
  assert.deepEqual([s.status, s.body.reports], [200, 4]);
  assert.deepEqual((await list(w[0])).seats, []);
  const h = raw.prepare('SELECT key, kind, data FROM town_seat_history').all();
  assert.deepEqual(h.map((r) => [r.key, r.kind, JSON.parse(r.data).by]), [[ANTICLERE.key, 'strike', 'Devra']]);
  assert.equal((await witness(w[1])).body.error, 'seat-struck', 'never witnessed again');
});
