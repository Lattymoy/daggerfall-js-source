// LODE-HERD and HUNT-LEAN (2026-10-29, the account database overloaded through the evening of 2026-10-28 and at 00:00
// UTC; bible/11-Multiplayer/Scale-Arc.md LODE-HERD, HUNT-LEAN). At the day's turn every Motherlodes read ran the pick's
// scan until the mark was kept - 33 scans of 1.8 s in a minute. Now one read a minute holds the day's claim and picks;
// the rest answer none, and the clock picks without asking. The hunt's read wrote a rate window on every page's poll;
// it writes nothing now, and a replica serves it. Each pin failed on the build before it. tools/mutants/lode_herd.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { d1, standService, T0 } from '../accountDb.mjs';
import { motherlodesOf, LODE_PICK_CLAIM, LODE_PICK_WINDOW_S } from '../../server-account/src/motherlodes.js';
import { MINUTE_JOBS } from '../../server-account/src/cron.js';
import { REPLICA_ROUTES } from '../../server-account/src/service.js';
import { busyRead } from '../../src/net/busyLaw.js';
import { D1_BOOKMARK_READS } from '../../src/net/accountClient.js';
import { HUNT_STATE_MS } from '../../src/net/huntBook.js';
import { MOTHERLODE_CLIMATES } from '../../src/net/motherlodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

/** A database with one pixel confirmed long before day `D`, and a count of the pick's scans run on it. */
function ground() {
  const P = d1();
  const raw = P._raw;
  for (let i = 1; i <= 3; i++) raw.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`a${i}`);
  for (const a of ['a1', 'a2', 'a3']) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', '10,10', ?, ?, 5, 1)").run(a, `${MOTHERLODE_CLIMATES[0]},5`);
  const scans = { n: 0 };
  const prepare = P.prepare.bind(P);
  P.prepare = (sql) => { if (/FROM world_witness/.test(sql)) scans.n++; return prepare(sql); };
  const kept = (day) => raw.prepare('SELECT COUNT(*) AS n FROM motherlode_days WHERE day = ?').get(day).n;
  return { P, raw, scans, kept };
}

test('LODE-HERD: the reads racing a day\'s turn run one scan between them - the claim\'s holder picks and answers the day, the rest answer none and scan nothing (mutant: the claim unasked)', async () => {
  const { P, scans, kept } = ground();
  const D = utcDay(T0) + 1;
  const ctx = { db: P, nowS: D * 86400 + 1, rand: Math.random };
  const answers = await Promise.all(Array.from({ length: 6 }, () => motherlodesOf(ctx, D)));
  assert.equal(scans.n, 1, 'one scan for six reads');
  assert.equal(kept(D), 1, 'the day kept');
  assert.deepEqual(answers.map((a) => a.length), [1, 0, 0, 0, 0, 0], 'the holder answers the day, the rest none');
  assert.equal((await motherlodesOf(ctx, D)).length, 1, 'once kept, every read answers it');
  assert.equal(scans.n, 1, 'and scans nothing');
});

test('LODE-HERD: a claim whose holder never kept the day holds its minute only - a read in the next window picks (mutant: the window unbounded)', async () => {
  const { P, raw, scans, kept } = ground();
  const D = utcDay(T0) + 2;
  const t = D * 86400 + 5;
  // a reader that claimed and died before its batch
  raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)').run(`${LODE_PICK_CLAIM}${D}`, Math.floor(t / LODE_PICK_WINDOW_S) * LODE_PICK_WINDOW_S);
  assert.deepEqual(await motherlodesOf({ db: P, nowS: t + 10, rand: Math.random }, D), [], 'inside the dead holder\'s minute: none');
  assert.equal(scans.n, 0);
  assert.equal(kept(D), 0);
  assert.equal((await motherlodesOf({ db: P, nowS: t + 60, rand: Math.random }, D)).length, 1, 'the next minute\'s reader picks');
  assert.equal(scans.n, 1);
  assert.equal(kept(D), 1);
});

test('LODE-HERD: the clock picks whatever claim a reader holds - the minute\'s own job too (mutants: the clock asks the claim; the job asks it)', async () => {
  const { P, raw, kept } = ground();
  const hold = (D, t) => raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)').run(`${LODE_PICK_CLAIM}${D}`, Math.floor(t / LODE_PICK_WINDOW_S) * LODE_PICK_WINDOW_S);
  const D = utcDay(T0) + 3;
  hold(D, D * 86400 + 5);
  assert.equal((await motherlodesOf({ db: P, nowS: D * 86400 + 5, rand: Math.random }, D, { clock: true })).length, 1);
  assert.equal(kept(D), 1);
  const job = MINUTE_JOBS.find(([name]) => name === 'motherlodes')[1];
  const E = D + 1;
  hold(E, E * 86400 + 5);
  assert.equal(await job({ db: P, nowS: E * 86400 + 5, rand: Math.random }, { PROFESSIONS_OPEN: 'on' }), 1, 'the minute\'s job picks');
  assert.equal(kept(E), 1);
});

test('HUNT-LEAN: the hunt\'s read writes nothing - no rate window - and runs on a D1 session, a replica\'s read the client bookmarks and holds back in an overload; the book asks it every ten minutes (mutants: the rate window back; the route off the replica; the busy read dropped; the two minutes back)', async (t) => {
  const NOON = utcDay(T0) * 86_400 + 12 * 3600;
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ SEATS_OPEN: 'on' });
  const mac = await s.seated('Mac');
  const raw = s.env.DB._raw;
  const before = s.env.DB._sessions.length;
  const r = await s.call('/v1/hunt/state', { character: mac.character }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE 'hunt:%'").get().n, 0, 'no rate window written');
  const sessions = s.env.DB._sessions.slice(before);
  assert.ok(sessions.some((x) => x.statements.some((q) => /FROM hunt_clears/.test(q))), 'its reads on a session');
  assert.equal(REPLICA_ROUTES.get('/v1/hunt/state'), 'POST');
  assert.equal(D1_BOOKMARK_READS.get('/v1/hunt/state'), 'POST');
  assert.equal(busyRead('/v1/hunt/state', 'POST'), true);
  assert.equal(HUNT_STATE_MS, 600_000);
});
