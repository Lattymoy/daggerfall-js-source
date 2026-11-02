// SEAT-FACTS (2026-10-13, after SEAT-REPLICA; the owner: "1, 2 and 3"; bible/11-Multiplayer/Scale-Arc.md SEAT-FACTS):
// every isolate read every seat row of world_witness once a minute and counted the facts over them on every ask - after
// SEAT-REPLICA some 100 reads of 15,899 rows a minute on the one replica, its p99 from 2 ms to some 60 ms. The minute's
// clock (server-account/src/cron.js `seat-facts`) now reads the rows once and keeps what they say in one row
// (migration 0112), and every isolate reads that row: fresh (SEAT_FACTS_FRESH_S) and newer than its own last write, or
// the rows as before. Each pin failed on the build before it. tools/mutants/seat_facts.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seatReportText } from '../../src/net/townSeatLaw.js';
import {
  listSeats, confirmedSeats, witnessSeat, strikeSeat, seatFacts, keepSeatFacts, seatFactsText, seatFactsOfText,
  SEAT_ROWS_KEPT_S, SEAT_FACTS_FRESH_S, SEAT_ROWS_SQL, SEAT_JUDGED_SQL } from '../../server-account/src/townSeats.js';
import { runCron, CRON_MINUTE, MINUTE_JOBS, _resetCronForTests } from '../../server-account/src/cron.js';
import { standService, T0 } from '../accountDb.mjs';

const DAY = 86400;
const ENV = { SEATS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ALCAIRE = { key: 3022, name: 'Alcaire', region: 21, tier: 'palace', pixel: [410, 160] };
const WITNESS_SQL = SEAT_ROWS_SQL;
const seatRead = (sql) => sql === SEAT_ROWS_SQL || sql === SEAT_JUDGED_SQL;   // LEAN-WITNESS (PIN MOVED): the rows the law judges by are a read of them
const FACTS_SQL = 'SELECT at, facts FROM seat_facts_kept WHERE id = 1';
const PLAYER = { id: 'p-somebody', handle: 'Somebody', registered_at: T0 - 30 * DAY };
const DEV = { id: 'p-devra', handle: 'Devra', registered_at: T0 - 30 * DAY };

/** The service with three witnesses agreeing on Anticlere and one on Alcaire; the seat rows' reads (`c.n`) and the kept
 *  row's (`c.f`) counted on a database of the request's. */
async function seatsDb(env = ENV) {
  const svc = await standService(env);
  const base = svc.env.DB;
  const put = base._raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)");
  for (const w of [await svc.guest(), await svc.guest(), await svc.guest()]) put.run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  put.run(String(ALCAIRE.key), (await svc.guest()).id, seatReportText(ALCAIRE), ALCAIRE.region, T0 - DAY);
  const c = { n: 0, f: 0 };
  const db = Object.create(base);
  db.prepare = (sql) => {
    if (seatRead(sql)) c.n++;
    if (sql === FACTS_SQL) c.f++;
    return base.prepare(sql);
  };
  return { svc, base, db, c };
}
const rowsOf = (base) => base._raw.prepare(WITNESS_SQL).all().map((r) => ({ key: String(r.key), account: r.account, report: r.report, at: Number(r.at) }));

test('SEAT-FACTS: the clock keeps the seats\' facts in one row - the seats that stand by key, state and report, and the accounts ignored - read back as seatFacts counts them; a minute\'s job, none while the seats are shut; any other text is no answer (mutants: an unconfirmed seat kept; the job dropped; the job run behind `off`)', async () => {
  const { svc, base } = await seatsDb();
  assert.equal(await keepSeatFacts(base, T0), 1);
  const row = base._raw.prepare(FACTS_SQL).get();
  assert.equal(row.at, T0);
  const counted = seatFacts(rowsOf(base), T0);
  const read = seatFactsOfText(row.facts);
  assert.ok(read, 'the clock\'s text reads back');
  assert.deepEqual(read.seats, [{ key: ANTICLERE.key, fact: counted.seats.find((x) => x.key === ANTICLERE.key).fact }], 'the confirmed seat, and never the unconfirmed one');
  assert.deepEqual([...read.ignored], [...counted.ignored]);
  assert.equal(seatFactsText(counted), row.facts);
  for (const bad of ['', 'null', '{"seats":[[3021,"unconfirmed","[]"]],"ignored":[]}', '{"seats":[[3021,"confirmed","not a seat"]],"ignored":[]}', '{"seats":[]}']) {
    assert.equal(seatFactsOfText(bad), null, `${bad || '(empty)'}: no answer`);
  }

  assert.ok(MINUTE_JOBS.some(([name]) => name === 'seat-facts'), 'a minute\'s job');
  _resetCronForTests();
  const ran = await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0 + 60, rand: () => {} });
  assert.equal(ran.find((j) => j.name === 'seat-facts')?.changed, 1);
  assert.equal(base._raw.prepare(FACTS_SQL).get().at, T0 + 60, 'kept again on the minute');

  const shut = await seatsDb({ SEATS_OPEN: 'off' });
  _resetCronForTests();
  const quiet = await runCron(shut.svc.env, { cron: CRON_MINUTE, nowS: T0, rand: () => {} });
  assert.deepEqual(['changed', 'statements'].map((k) => quiet.find((j) => j.name === 'seat-facts')[k]), [0, 0]);
  assert.equal(shut.base._raw.prepare(FACTS_SQL).get(), undefined, 'nothing kept while the seats are shut');
});

test('SEAT-FACTS: a list, a claim\'s seats and a witness\'s standing read the kept row - its one statement, never the rows, kept SEAT_ROWS_KEPT_S; a row older than SEAT_FACTS_FRESH_S, or none, and the rows are read as before, the row not asked again within the minute (mutants: the age unread; the facts unkept; an unfit row asked again on every ask; an overload taken for no row)', async () => {
  const { base, db, c } = await seatsDb();
  await keepSeatFacts(base, T0);
  const list = await listSeats({ db, nowS: T0 + 5 }, PLAYER, ENV);
  assert.deepEqual(list.seats.map((x) => x.key), [ANTICLERE.key]);
  assert.deepEqual([c.f, c.n], [1, 0], 'the kept row, not the rows');
  assert.equal((await confirmedSeats(db, T0 + 6)).has(ANTICLERE.key), true);
  assert.deepEqual([c.f, c.n], [1, 0], 'a claim\'s seats: the isolate\'s kept facts');
  await listSeats({ db, nowS: T0 + 5 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.deepEqual([c.f, c.n], [2, 0], 'a minute on: the row asked again');
  // the clock stopped: past SEAT_FACTS_FRESH_S the row is no answer
  const late = T0 + SEAT_FACTS_FRESH_S + 1;
  const stale = await listSeats({ db, nowS: late + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.deepEqual(stale.seats.map((x) => x.key), [ANTICLERE.key]);
  assert.deepEqual([c.f, c.n], [3, 1], 'too old: the rows');
  await listSeats({ db, nowS: late + SEAT_ROWS_KEPT_S + 1 }, PLAYER, ENV);
  assert.deepEqual([c.f, c.n], [3, 1], 'and within the minute neither is asked again');
  // no row at all (a deploy before its first minute)
  const none = await seatsDb();
  assert.deepEqual((await listSeats({ db: none.db, nowS: T0 }, PLAYER, ENV)).seats.map((x) => x.key), [ANTICLERE.key]);
  await listSeats({ db: none.db, nowS: T0 + 1 }, PLAYER, ENV);
  assert.deepEqual([none.c.f, none.c.n], [1, 1], 'none kept: the rows, the row asked once');
  // an overloaded database is the overload's, as every read's is - never taken for no row
  const busy = await seatsDb();
  const prepare = busy.db.prepare;
  busy.db.prepare = (sql) => (sql === FACTS_SQL ? { first: async () => { throw new Error('D1_ERROR: D1 DB is overloaded. Requests queued for too long.'); } } : prepare(sql));
  await assert.rejects(listSeats({ db: busy.db, nowS: T0 }, PLAYER, ENV), /overloaded/);
  assert.equal(busy.c.n, 0, 'and the rows not read behind it');
});

test('SEAT-FACTS: an isolate that wrote reads the rows until the clock keeps the facts after its write - a witness\'s new report or a strike - and the kept row again once it does (mutants: the write\'s clock unkept; the row\'s age against the write unread; the write\'s own second taken as after it)', async () => {
  const { svc, base, db, c } = await seatsDb();
  await keepSeatFacts(base, T0);
  await listSeats({ db, nowS: T0 + 1 }, PLAYER, ENV);
  assert.deepEqual([c.f, c.n], [1, 0]);
  const wit = await svc.registered('Witness');
  assert.deepEqual(await witnessSeat({ db, nowS: T0 + 2 }, { id: wit.id, handle: 'Witness', registered_at: T0 - 30 * DAY }, ENV, { seat: ALCAIRE }), { ok: true, counted: true });
  await listSeats({ db, nowS: T0 + 3 }, PLAYER, ENV);
  assert.equal(c.n, 1, 'the report written here: the rows, at once - the kept row is from before it');
  await keepSeatFacts(base, T0 + 2);   // the clock in the write's own second: not after it
  await listSeats({ db, nowS: T0 + 3 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, 2, 'a row of the write\'s second is not after it: the rows again');
  await keepSeatFacts(base, T0 + 10);
  const n = c.n;
  await listSeats({ db, nowS: T0 + 4 + 2 * SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, n, 'the clock kept after the write: its row again');
  assert.equal((await strikeSeat({ db, nowS: T0 + 5 + 2 * SEAT_ROWS_KEPT_S }, DEV, ENV, { key: ANTICLERE.key })).ok, true);
  const after = await listSeats({ db, nowS: T0 + 6 + 2 * SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, n + 1, 'the strike written here: the rows');
  assert.deepEqual(after.seats, [], 'the struck seat gone, though the kept row still names it');
});
