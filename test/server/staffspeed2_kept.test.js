// STAFF-SPEED-2 (2026-10-29, the staff panel "runs slow", "slow switching pages between any of them", "server refuses a
// lot") - THE PANEL'S HEAVY READS KEPT IN ONE ROW EVERY ISOLATE READS (server-account/src/staffKept.js, migration
// 0195_staff_kept), on the node:sqlite database every account pin stands on (test/accountDb.mjs): fresh, the row answers
// and nothing is made; stale, the row answers at once and one request makes it again; past stale, or with no row, made
// and kept before it is answered; a row too big, or no table, made every time, as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { staffKept, staffKeptAll, staffKeptForget, _resetStaffKeptForTests, _otherIsolateForTests, STAFF_KEPT_MAX_BYTES, STAFF_KEPT_BUSY_S } from '../../server-account/src/staffKept.js';
import { HOME_KEPT, HOME_WATCHES } from '../../server-account/src/staffStatus.js';

const T = 1_800_000_000;

/** A fresh database, and `maker(value)`: a make that counts its calls. */
async function stand() {
  _resetStaffKeptForTests();
  const s = await standService();
  const db = s.env.DB;
  const maker = (/** @type {any} */ value) => { const f = async () => { f.calls++; return typeof value === 'function' ? value() : value; }; f.calls = 0; return f; };
  // a test's keys stand apart from an earlier test's (_resetStaffKeptForTests): the row by its key's end
  const row = (/** @type {string} */ key) => db._raw.prepare("SELECT * FROM staff_kept WHERE key = ?1 OR key LIKE '%:' || ?1").get(key);
  return { s, db, maker, row };
}

test('STAFF-SPEED-2: made once and kept for every isolate - a fresh row answers another isolate without making it again', async () => {
  const { db, maker, row } = await stand();
  const make = maker({ n: 1, list: ['a'] });
  assert.deepEqual(await staffKept({ db, nowS: T }, 'k', 60, 600, make), { n: 1, list: ['a'] });
  assert.equal(make.calls, 1);
  assert.deepEqual([row('k').at, JSON.parse(row('k').body)], [T, { n: 1, list: ['a'] }]);
  _otherIsolateForTests();   // another isolate
  assert.deepEqual(await staffKept({ db, nowS: T + 59 }, 'k', 60, 600, make), { n: 1, list: ['a'] });
  assert.equal(make.calls, 1, 'the row answered');
});

test('STAFF-SPEED-2: stale, the row answers at once and the one request whose claim lands makes it again after the answer', async () => {
  const { db, maker, row } = await stand();
  let v = 1;
  const make = maker(() => ({ v }));
  await staffKept({ db, nowS: T }, 'k', 60, 600, make);
  v = 2;
  _otherIsolateForTests();
  /** @type {Promise<any>[]} */
  const after = [];
  const later = (/** @type {Promise<any>} */ p) => { after.push(p); };
  assert.deepEqual(await staffKept({ db, nowS: T + 100, later }, 'k', 60, 600, make), { v: 1 }, 'the stale row, at once');
  assert.equal(after.length, 1);
  // a second request while the first makes it: the claim is held, it answers stale and makes nothing
  _otherIsolateForTests();
  const later2 = (/** @type {Promise<any>} */ p) => { after.push(p); };
  await Promise.all(after);
  assert.deepEqual([row('k').at, JSON.parse(row('k').body)], [T + 100, { v: 2 }], 'made again and kept');
  assert.equal(make.calls, 2);
  _otherIsolateForTests();
  assert.deepEqual(await staffKept({ db, nowS: T + 120, later: later2 }, 'k', 60, 600, make), { v: 2 });
  assert.equal(make.calls, 2);
  // the claim: two stale asks at the same time make it once
  v = 3;
  _otherIsolateForTests();
  const both = [];
  const l3 = (/** @type {Promise<any>} */ p) => { both.push(p); };
  await staffKept({ db, nowS: T + 300, later: l3 }, 'k', 60, 600, make);
  _otherIsolateForTests();
  await staffKept({ db, nowS: T + 300, later: l3 }, 'k', 60, 600, make);
  await Promise.all(both);
  assert.equal(make.calls, 3, 'one claim landed');
  assert.ok(STAFF_KEPT_BUSY_S > 0);
});

test('STAFF-SPEED-2: past stale, made before it answers; a make that throws keeps nothing and throws as before', async () => {
  const { db, maker, row } = await stand();
  let v = 1;
  const make = maker(() => ({ v }));
  await staffKept({ db, nowS: T }, 'k', 60, 600, make);
  v = 2;
  _otherIsolateForTests();
  assert.deepEqual(await staffKept({ db, nowS: T + 600 }, 'k', 60, 600, make), { v: 2 });
  await assert.rejects(staffKept({ db, nowS: T + 2000 }, 'k', 60, 600, async () => { throw new Error('the read failed'); }), /the read failed/);
  assert.deepEqual(JSON.parse(row('k').body), { v: 2 }, 'the last good row stands');
});

test('STAFF-SPEED-2: one read for many - every row asked in one statement, every answer kept in one batch; too big is never kept', async () => {
  const { db, maker, row } = await stand();
  const a = maker({ a: 1 }), b = maker({ b: 'x'.repeat(STAFF_KEPT_MAX_BYTES + 1) });
  const sent = [];
  const prepare = db.prepare.bind(db);
  db.prepare = (/** @type {string} */ sql) => { sent.push(sql); return prepare(sql); };
  const out = await staffKeptAll({ db, nowS: T }, ['a', 'b'], async (ctx) => [await staffKept(ctx, 'a', 60, 600, a), await staffKept(ctx, 'b', 60, 600, b)]);
  assert.deepEqual(out.map((x) => Object.keys(x)), [['a'], ['b']]);
  assert.equal(sent.filter((q) => q.startsWith('SELECT') && q.includes('staff_kept')).length, 1, 'one read');
  assert.ok(row('a'));
  assert.equal(row('b'), undefined, 'past the cap: made every time');
  db.prepare = prepare;
  _otherIsolateForTests();
  await staffKeptAll({ db, nowS: T + 1 }, ['a', 'b'], async (ctx) => [await staffKept(ctx, 'a', 60, 600, a), await staffKept(ctx, 'b', 60, 600, b)]);
  assert.deepEqual([a.calls, b.calls], [1, 2]);
  // forgotten: made again at once
  await staffKeptForget(db, ['a']).run();
  assert.equal(row('a'), undefined);
});

test('STAFF-SPEED-2: no table (a Worker ahead of its migration) - every answer made as before, nothing thrown', async () => {
  const { db, maker } = await stand();
  db._raw.prepare('DROP TABLE staff_kept').run();
  const make = maker({ ok: true });
  assert.deepEqual(await staffKept({ db, nowS: T }, 'k', 60, 600, make), { ok: true });
  _otherIsolateForTests();
  assert.deepEqual(await staffKeptAll({ db, nowS: T }, ['k'], (ctx) => staffKept(ctx, 'k', 60, 600, make)), { ok: true });
  assert.equal(make.calls, 2);
});

test('STAFF-SPEED-2: what Home keeps is the Admins\' alone - never Reports nor a member\'s own Watchlist; the migration makes the table', () => {
  const ids = HOME_WATCHES.map((w) => w.id);
  for (const id of HOME_KEPT) assert.ok(ids.includes(id), id);
  for (const w of HOME_WATCHES) if (HOME_KEPT.includes(w.id)) assert.equal(w.role, 'admin', w.id);
  assert.ok(!HOME_KEPT.includes('reports') && !HOME_KEPT.includes('watchlist'));
  assert.match(readFileSync(new URL('../../server-account/migrations/0195_staff_kept.sql', import.meta.url), 'utf8'), /CREATE TABLE IF NOT EXISTS staff_kept \(\s*key\s+TEXT PRIMARY KEY/);
});
