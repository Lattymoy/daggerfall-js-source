// SEAT-REPLICA (2026-10-13, the account database overloaded from 14:11 UTC and still down at 18:10; read off D1's own
// query insights and the service's metrics - bible/11-Multiplayer/Scale-Arc.md SEAT-REPLICA): the seats' witness rows
// were read whole on the primary - 15,899 rows a read, the isolates many enough that two lists in three missed their
// isolate's kept copy, and in the outage more than half the primary's statement time and nine in ten of the rows it
// answered. The kept read is now a read replica's (server-account/src/townSeats.js SEAT_ROWS_FROM): any instance's
// first, the bookmark the last kept read ended at after it, and the primary's after this isolate's own write; and a
// witness's report the table already held lets the kept rows stand. Each pin failed on the build before it.
// tools/mutants/seat_replica.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seatReportText } from '../../src/net/townSeatLaw.js';
import { listSeats, confirmedSeats, witnessSeat, strikeSeat, SEAT_ROWS_KEPT_S, SEAT_ROWS_FROM, SEAT_ROWS_SQL, SEAT_JUDGED_SQL } from '../../server-account/src/townSeats.js';
import { countedDb } from '../../server-account/src/metrics.js';
import { standService, d1Position, T0 } from '../accountDb.mjs';

const DAY = 86400;
const ENV = { SEATS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ALCAIRE = { key: 3022, name: 'Alcaire', region: 21, tier: 'palace', pixel: [410, 160] };
const seatRead = (sql) => sql === SEAT_ROWS_SQL || sql === SEAT_JUDGED_SQL;   // LEAN-WITNESS (PIN MOVED): the rows the law judges by are a read of them
const PLAYER = { id: 'p-somebody', handle: 'Somebody', registered_at: T0 - 30 * DAY };
const DEV = { id: 'p-devra', handle: 'Devra', registered_at: T0 - 30 * DAY };

/** The service's database with three witnesses agreeing on Anticlere, its seat witness reads counted (`c.n`) and, with
 *  `c.fail` set, refused as an overloaded D1 refuses them - with `c.hold` set, held until `c.release()` first;
 *  `seatSessions()` the D1 sessions the seat read ran on. */
async function seatsDb() {
  const svc = await standService(ENV);
  const base = svc.env.DB;
  const raw = base._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  const c = { n: 0, fail: false, hold: false, held: false, release: () => {} };
  const db = Object.create(base);
  db.prepare = (sql) => {
    const st = base.prepare(sql);
    if (!seatRead(sql)) return st;
    c.n++;
    return {
      all: async () => {
        const failing = c.fail;
        if (c.hold) await new Promise((res) => { c.held = true; c.release = res; });
        if (failing) throw new Error('D1_ERROR: D1 DB is overloaded. Requests queued for too long.');
        return st.all();
      },
    };
  };
  const seatSessions = () => base._sessions.filter((s) => s.statements.some(seatRead)).map((s) => s.constraint);
  return { svc, base, db, c, seatSessions };
}

test('SEAT-REPLICA: the kept read is a session\'s - the first any instance\'s (SEAT_ROWS_FROM), each one after a kept read from the bookmark it ended at; a developer\'s list and the Turning\'s read the table on the binding, as it stands (mutants: the read on the binding; the first the primary\'s; the bookmark unkept)', async () => {
  const { base, db, c, seatSessions } = await seatsDb();
  assert.equal(SEAT_ROWS_FROM, 'first-unconstrained');
  const first = await listSeats({ db, nowS: T0 }, PLAYER, ENV);
  assert.deepEqual(first.seats.map((s) => s.key), [ANTICLERE.key], 'answered off the session as off the binding');
  assert.equal(c.n, 1);
  assert.deepEqual(seatSessions(), [SEAT_ROWS_FROM], 'the first read: any instance\'s - a replica, not the primary\'s queue');
  const mark = d1Position(base);
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S - 1 }, PLAYER, ENV);
  assert.equal(c.n, 1, 'within the minute: the kept rows, as before');
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, 2, 'a minute on: read again');
  assert.deepEqual(seatSessions(), [SEAT_ROWS_FROM, mark], 'from the bookmark the kept read ended at - never a replica behind it');
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S + 1 }, DEV, ENV);
  assert.equal(await confirmedSeats(db, T0 + SEAT_ROWS_KEPT_S + 2, { fresh: true }).then((m) => m.has(ANTICLERE.key)), true);
  assert.equal(c.n, 4, 'the developer\'s list and the Turning\'s each read the table');
  assert.deepEqual(seatSessions(), [SEAT_ROWS_FROM, mark], 'on the binding - the primary, as it stands (AUDIT-SEATS T2)');
});

test('SEAT-REPLICA: a write here sends the next read to the primary - a witness\'s new report or a strike, then \'first-primary\', and the read after that from its bookmark; a report the table already held lets nothing go (mutants: the write unmarked; the primary skipped; the mark never cleared; every report forgets; no report forgets)', async () => {
  const { svc, base, db, c, seatSessions } = await seatsDb();
  const wit = await svc.registered('Witness');
  const W = { id: wit.id, handle: 'Witness', registered_at: T0 - 30 * DAY };
  await listSeats({ db, nowS: T0 }, PLAYER, ENV);
  assert.deepEqual(await witnessSeat({ db, nowS: T0 + 1 }, W, ENV, { seat: ALCAIRE }), { ok: true, counted: true });
  assert.equal(c.n, 1, 'the report read the kept rows');
  await listSeats({ db, nowS: T0 + 2 }, PLAYER, ENV);
  assert.equal(c.n, 2, 'the new report written here: read afresh at once');
  assert.deepEqual(seatSessions(), [SEAT_ROWS_FROM, 'first-primary'], 'the read after a write here: the primary\'s, which has it');
  const mark = d1Position(base);
  assert.deepEqual(await witnessSeat({ db, nowS: T0 + 3 }, W, ENV, { seat: ALCAIRE }), { ok: true, counted: true }, 'the same report again: answered as before');
  await listSeats({ db, nowS: T0 + 4 }, PLAYER, ENV);
  assert.equal(c.n, 2, 'a report the table already held (the first answer stands): the kept rows stand');
  await listSeats({ db, nowS: T0 + 2 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, 3);
  assert.deepEqual(seatSessions().slice(2), [mark], 'the write read back: the next read from the bookmark the primary\'s ended at');
  assert.equal((await strikeSeat({ db, nowS: T0 + 3 + SEAT_ROWS_KEPT_S }, DEV, ENV, { key: ANTICLERE.key })).ok, true);
  const after = await listSeats({ db, nowS: T0 + 4 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, 4, 'the strike written here: read afresh at once');
  assert.deepEqual(seatSessions().slice(3), ['first-primary'], 'on the primary');
  assert.deepEqual(after.seats, [], 'the struck seat gone from the list');
});

test('SEAT-REPLICA: a read that failed from a bookmark leaves it - the next starts from SEAT_ROWS_FROM, and never a newer read\'s bookmark; a session D1 will not open is the request\'s database; and the session is counted on the request\'s own point (mutants: the failed bookmark kept; a newer read\'s bookmark let go; the open unguarded; the session opened past the request\'s count)', async () => {
  const { base, db, c, seatSessions } = await seatsDb();
  await listSeats({ db, nowS: T0 }, PLAYER, ENV);
  c.fail = true;
  await assert.rejects(listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S }, PLAYER, ENV), /overloaded/);
  c.fail = false;
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S + 1 }, PLAYER, ENV);
  assert.equal(seatSessions().at(-1), SEAT_ROWS_FROM, 'the bookmark of a failed read let go: any instance\'s again');
  // a read from an older bookmark fails after a write here and the primary's read past it: the newer bookmark stands
  const old = d1Position(base);
  c.fail = true;
  c.hold = true;
  const failing = listSeats({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S + 1 }, PLAYER, ENV);
  while (!c.held) await new Promise((res) => { setImmediate(res); });   // SEAT-FACTS: the kept facts asked first, then the rows
  const releaseOld = c.release;
  c.fail = false;
  c.hold = false;
  assert.equal((await strikeSeat({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S + 1 }, DEV, ENV, { key: ALCAIRE.key })).ok, true);
  await listSeats({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S + 2 }, PLAYER, ENV);
  const newer = d1Position(base);
  assert.notEqual(newer, old);
  assert.deepEqual(seatSessions().slice(-2), [old, 'first-primary']);
  releaseOld();
  await assert.rejects(failing, /overloaded/);
  await listSeats({ db, nowS: T0 + 3 * SEAT_ROWS_KEPT_S + 2 }, PLAYER, ENV);
  assert.equal(seatSessions().at(-1), newer, 'the older read\'s failure left the newer read\'s bookmark');

  const refused = await seatsDb();
  refused.db.withSession = () => { throw new Error('D1_ERROR: invalid bookmark'); };
  const r = await listSeats({ db: refused.db, nowS: T0 }, PLAYER, ENV);
  assert.deepEqual(r.seats.map((s) => s.key), [ANTICLERE.key], 'a session refused: the rows read as the request holds them');
  assert.equal(refused.c.n, 1);

  const counted = await seatsDb();
  const tally = { n: 0 };
  await listSeats({ db: countedDb(counted.db, tally), nowS: T0 }, PLAYER, ENV);
  assert.equal(tally.n, 2, 'the sessions\' statements on the request\'s metrics point (metrics.js countedDb) - PIN MOVED (SEAT-FACTS): the kept facts\' row asked first, none there, then the rows');
  assert.deepEqual(counted.seatSessions(), [SEAT_ROWS_FROM]);
});
