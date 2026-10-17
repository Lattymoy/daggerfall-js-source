// ACCT-RATE-MEM (2026-10-04, the login outage - Mac: "You log in and it sends you straight to title screen", "We have
// 300 people trying to log in at once") - AUDIT-ACC F12's per-account bound upserted an `acct:` row in D1 on EVERY
// authenticated request, so every read the game makes was also a write to the one database: 4,783,193 runs of it on
// the day in D1's own query insights, the most time of any statement. Two relay deploys sent every player back through
// the door at once, D1 answered "overloaded. Requests queued for too long", the session read failed under it, the
// service said 500 and the client went back to the title. The bound is counted in the isolate's memory
// (server-account/src/accounts.js overAccountRate); the open doors' `login:` and `ip:` keys stay in D1.
// bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { overAccountRate, accountRateKeys, ACCOUNT_MAX, ACCOUNT_WINDOW_S, ACCOUNT_RATE_KEYS } from '../../server-account/src/accounts.js';

/** The Worker on a fresh database, every statement it prepares counted - the writes by their verb. */
async function counted() {
  const s = await standService();
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  const log = { writes: [], all: 0 };
  s.env.DB.prepare = (sql) => {
    log.all++;
    if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)) log.writes.push(sql.replace(/\s+/g, ' ').slice(0, 60));
    return prepare(sql);
  };
  return { ...s, log };
}

test('ACCT-RATE-MEM an authenticated read writes nothing: a town\'s yards, the account - asked again and again, no row in rate_limits and no write to D1 (the `acct:` upsert was one on every request)', async () => {
  const s = await counted();
  const g = await s.guest();
  s.log.writes.length = 0; s.log.all = 0;
  for (let i = 0; i < 5; i++) {
    assert.equal((await s.call('/v1/homes/yards', { mapId: 1234 }, g.secret)).status, 200, 'the yards answered');
    const acct = await s.fetch('https://accounts.invalid/v1/account', { method: 'GET', headers: { authorization: `Bearer ${g.secret}` } });
    assert.equal(acct.status, 200, 'the account answered');
  }
  assert.deepEqual(s.log.writes, [], 'no write on a read');
  assert.ok(s.log.all > 0, 'the reads were asked of D1');
  assert.equal(s.env.DB._raw.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE 'acct:%'").get().n, 0, 'no account row');
});

test('ACCT-RATE-MEM the bound is F12\'s: ACCOUNT_MAX a window per account, the next refused; another account its own; the next window fresh; a request stamped in a window already past counted in the one open (AUDIT RENOWN1, as overRate)', () => {
  const t = Math.floor(1_900_000_000 / ACCOUNT_WINDOW_S) * ACCOUNT_WINDOW_S + 1;
  for (let i = 0; i < ACCOUNT_MAX; i++) assert.equal(overAccountRate('mem-ann', t), false, `call ${i + 1} within`);
  assert.equal(overAccountRate('mem-ann', t), true, 'the next over');
  assert.equal(overAccountRate('mem-bob', t), false, 'another account unaffected');
  assert.equal(overAccountRate('mem-ann', t + ACCOUNT_WINDOW_S), false, 'the next window starts fresh');
  for (let i = 1; i < ACCOUNT_MAX; i++) {
    assert.equal(overAccountRate('mem-ann', t - 2), false, 'a past stamp, counted in the open window');
  }
  assert.equal(overAccountRate('mem-ann', t - 2), true, 'and not a fresh window: past stamps never reset the count');
});

test('ACCT-RATE-MEM bounded: past ACCOUNT_RATE_KEYS accounts the closed windows go, the open ones stay; every one open, all of them go (a count forgotten frees a caller early, never refuses one)', () => {
  const t = Math.floor(1_950_000_000 / ACCOUNT_WINDOW_S) * ACCOUNT_WINDOW_S;
  const base = accountRateKeys();
  for (let i = base; i < ACCOUNT_RATE_KEYS; i++) overAccountRate(`old-${i}`, t);
  assert.equal(accountRateKeys(), ACCOUNT_RATE_KEYS, 'full');
  for (let i = 0; i < 5; i++) overAccountRate('kept', t + ACCOUNT_WINDOW_S);   // an existing key never prunes
  assert.ok(accountRateKeys() <= ACCOUNT_RATE_KEYS);
  overAccountRate('new-one', t + ACCOUNT_WINDOW_S + 1);
  assert.ok(accountRateKeys() <= 3, `the closed windows gone: ${accountRateKeys()}`);
  for (let i = 0; i < ACCOUNT_MAX - 5; i++) overAccountRate('kept', t + ACCOUNT_WINDOW_S);
  assert.equal(overAccountRate('kept', t + ACCOUNT_WINDOW_S), true, 'an open window kept its count through the prune');
  const u = t + 10 * ACCOUNT_WINDOW_S;
  for (let i = accountRateKeys(); i < ACCOUNT_RATE_KEYS; i++) overAccountRate(`open-${i}`, u);
  overAccountRate('prunes-the-closed', u);
  assert.equal(accountRateKeys(), ACCOUNT_RATE_KEYS - 1, 'the two closed windows gone, the newcomer in');
  overAccountRate('fills', u);
  assert.equal(accountRateKeys(), ACCOUNT_RATE_KEYS, 'full, every window open');
  overAccountRate('one-more', u);
  assert.equal(accountRateKeys(), 1, 'every window open: all forgotten, the newcomer counted');
});
