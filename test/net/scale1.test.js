// SCALE1 (2026-09-30, the scaling audit - Mac: "set the stage for a larger player base in the future"; "This is all
// you man. Just do whatever is best"). The account service's half, before any relay deploy:
//
//   A. the per-request writes: `last_seen` touched only once it has gone stale (SESSION_TOUCH_S), both rows in one
//      round trip - two of every authenticated request's three D1 writes;
//   B. every request counted to Workers Analytics Engine (server-account/src/metrics.js) - and never at a request's cost;
//   C. the statements that read a whole table, indexed (0043_scale_indexes.sql), asked of the real migrations' planner;
//   D. D1's 100 bound parameters a statement: the market's materials asked as one bound JSON array;
//   E. the deploys: the relay's and the service's wait for the suite, and the database's bookmark is written before
//      the migrations;
//   F. how a tab asks again (net/backoff.js): jittered, and never at once into a minute's refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, d1 } from '../accountDb.mjs';
import { createGuest, resolveSession, SESSION_TOUCH_S } from '../../server-account/src/accounts.js';
import { measured, routeLabel, countedDb } from '../../server-account/src/metrics.js';
import { marketCatalogue } from '../../src/net/marketLaw.js';
import { jittered, ASK_AGAIN_NOW } from '../../src/net/backoff.js';
import { createProfBook, PROF_RETRY_MS } from '../../src/net/profBook.js';
import { createMarksBook, MARKS_RETRY_MS, MARKS_TRIES } from '../../src/net/marksBook.js';
import { createMarketBook, MARKET_RETRY_MS } from '../../src/net/marketBook.js';
import { createWritBook, WRIT_RETRY_MS } from '../../src/net/writBook.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const NOW = 1_790_000_000;

// ═══ A. THE PER-REQUEST WRITES ═══════════════════════════════════════════════════════════════════════════════════════

/** D1 with its writes counted (UPDATE statements, alone or in a batch). */
function writesCounted(db) {
  const tally = { updates: 0 };
  return {
    tally,
    db: {
      _raw: db._raw,
      prepare(sql) { const st = db.prepare(sql); if (/^\s*UPDATE/i.test(sql)) st._isUpdate = true; return st; },
      async batch(list) { tally.updates += list.filter((st) => st._isUpdate).length; return db.batch(list); },
    },
  };
}

test('SCALE1 A: a session resolved within SESSION_TOUCH_S of its last touch writes nothing; one gone stale writes both rows in ONE batch; the idle bound and the device list read the same (mutants: every request touches again; the stale touch dropped)', async () => {
  const base = d1();
  const made = await createGuest({ db: base, subtle, rand, nowS: NOW }, { deviceLabel: 'a phone' });
  const { db, tally } = writesCounted(base);
  const seen = () => base._raw.prepare('SELECT s.last_seen AS s, p.last_seen AS p FROM sessions s JOIN players p ON p.id = s.player_id').get();
  // within the window: resolved, nothing written
  for (const dt of [1, 60, SESSION_TOUCH_S - 1]) assert.ok(await resolveSession({ db, subtle, nowS: NOW + dt }, made.secret));
  assert.equal(tally.updates, 0, 'a fresh session costs no write');
  assert.deepEqual({ ...seen() }, { s: NOW, p: NOW });
  // stale: both rows, one batch
  assert.ok(await resolveSession({ db, subtle, nowS: NOW + SESSION_TOUCH_S }, made.secret));
  assert.equal(tally.updates, 2, 'both rows, in one round trip');
  assert.deepEqual({ ...seen() }, { s: NOW + SESSION_TOUCH_S, p: NOW + SESSION_TOUCH_S });
  // and the window starts again from the touch
  assert.ok(await resolveSession({ db, subtle, nowS: NOW + SESSION_TOUCH_S + 5 }, made.secret));
  assert.equal(tally.updates, 2);
  assert.ok(SESSION_TOUCH_S <= 60 * 60, 'coarse enough to save the writes, fine enough for a device list');   // SCALE4h (PIN MOVED): an hour, from ten minutes - still nothing reads it finer
});

test('SCALE1 A: a stale touch that fails never fails the request it rode in on (AUDIT-ACC F10, kept)', async () => {
  const base = d1();
  const made = await createGuest({ db: base, subtle, rand, nowS: NOW }, {});
  const brittle = { _raw: base._raw, prepare: (sql) => base.prepare(sql), async batch() { throw new Error('D1_ERROR: storage is having a day'); } };
  const who = await resolveSession({ db: brittle, subtle, nowS: NOW + SESSION_TOUCH_S + 1 }, made.secret);
  assert.equal(who?.player.id, made.id);
});

// ═══ B. EVERY REQUEST COUNTED ════════════════════════════════════════════════════════════════════════════════════════

test('SCALE1 B: every request writes ONE point - the route as a template, the method, the status, a refusal\'s word, wall ms and the D1 statements it ran - and nothing that names a player (mutants: the point never written; the route\'s ids kept; the statements uncounted)', async () => {
  const s = await standService();
  const points = [];
  s.env.METRICS = { writeDataPoint: (p) => points.push(p) };
  const g = await s.guest();
  assert.equal(points.length, 1, 'the guest\'s own request');
  const [guest] = points;
  assert.deepEqual(guest.indexes, ['/v1/auth/guest']);
  assert.deepEqual(guest.blobs.slice(0, 4), ['/v1/auth/guest', 'POST', '200', '']);
  assert.equal(guest.doubles[1], 200);
  assert.ok(guest.doubles[0] >= 0, 'wall ms');
  assert.ok(guest.doubles[2] >= 2, `the D1 statements it ran (${guest.doubles[2]})`);
  // a refusal says its word
  points.length = 0;
  await s.call('/v1/account', undefined, 'not-a-real-secret-at-all');
  assert.deepEqual(points[0].blobs.slice(2, 4), ['401', 'auth']);
  // a save slot and a realm character's save are counted by their shape, never their ids or names
  points.length = 0;
  await s.fetch(`https://accounts.invalid/v1/saves/c0ffee00-1111-2222-3333-444455556666/${encodeURIComponent('my secret name')}/data`, { method: 'GET', headers: { authorization: `Bearer ${g.secret}` } });
  await s.fetch('https://accounts.invalid/v1/realm/r0123456789abcdef0123/data', { method: 'GET', headers: { authorization: `Bearer ${g.secret}` } });
  assert.deepEqual(points.map((p) => p.indexes[0]), ['/v1/saves/:slot/data', '/v1/realm/:id/data']);
  const said = JSON.stringify(points);
  for (const secret of [g.secret, g.id, 'c0ffee00', 'my secret name', 'r0123456789abcdef0123']) assert.ok(!said.includes(secret), `no point carries ${secret}`);
  // labels are a bounded set
  assert.equal(routeLabel('/v1/who/knows/what'), 'other');
  assert.equal(routeLabel('/v1/health'), '/v1/health');
});

test('SCALE1 B: a metric never costs a request - no binding serves as before, a sink that throws is skipped, and the service is handed its own D1 (counted) and every other binding untouched', async () => {
  const served = [];
  const serve = async (req, env) => { served.push(env); await env.DB?.prepare('SELECT 1').first(); return new Response('{"error":"rate"}', { status: 429, headers: { 'content-type': 'application/json' } }); };
  const req = () => new Request('https://accounts.invalid/v1/realm');
  const db = { prepare: () => ({ first: async () => ({}) }), batch: async () => [] };
  // no binding: the env as it came
  const bare = { DB: db, SAVES: 'r2' };
  assert.equal((await measured(req(), bare, serve)).status, 429);
  assert.equal(served.at(-1), bare);
  // a sink that throws: answered all the same
  const res = await measured(req(), { DB: db, SAVES: 'r2', METRICS: { writeDataPoint() { throw new Error('the dataset is away'); } } }, serve);
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: 'rate' }, 'the body is the service\'s, unread by the metric');
  assert.equal(served.at(-1).SAVES, 'r2');
  // the count: a statement prepared is one, whatever runs it
  const tally = { n: 0 };
  const counted = countedDb(db, tally);
  counted.prepare('SELECT 1'); await counted.batch([counted.prepare('A'), counted.prepare('B')]);
  assert.equal(tally.n, 3);
  assert.match(src('server-account/wrangler.toml'), /^\[\[analytics_engine_datasets\]\]\nbinding = "METRICS"\ndataset = "daggerfall_accounts"$/m);
});

// ═══ C. THE STATEMENTS THAT READ A WHOLE TABLE ═══════════════════════════════════════════════════════════════════════

const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const planned = () => {
  const db = new DatabaseSync(':memory:');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
};

test('SCALE1 C: every statement the audit found reading a whole table finds its rows by an index now - asked of the real migrations\' planner (mutants: each index dropped)', () => {
  const plan = planned();
  const cases = [
    ["SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?", 'idx_home_decor_pv'],
    ['SELECT 1 FROM market_deliveries WHERE provenance = ? AND collected = 0', 'idx_market_deliveries_provenance'],
    ['DELETE FROM market_deliveries WHERE collected = 1 AND at < ?1', 'idx_market_deliveries_at'],
    ["DELETE FROM realm_trades WHERE a_player = ? AND a_char = ? AND state = 'waiting' AND sid != ?", 'idx_realm_trades_waiting'],
    ['SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL AND played_at >= ?1 AND played_at < ?2', 'idx_players_played'],
    ['SELECT spent FROM realm_census WHERE char_id = ? LIMIT 1', 'idx_realm_census_char'],
    ['DELETE FROM market_fills WHERE day < ?1', 'idx_market_fills_day'],
    ["DELETE FROM market_listings WHERE state != 'open' AND closed_at < ?1 AND (returned = 1 OR state = 'sold')", 'idx_market_listings_closed'],
    ["DELETE FROM market_orders WHERE state != 'open' AND closed_at < ?1 AND returned = 1", 'idx_market_orders_closed'],
    ["DELETE FROM market_bids WHERE at < ?1 AND state != 'high' AND (returned = 1 OR state = 'won')", 'idx_market_bids_at'],
    ['DELETE FROM node_harvests WHERE rowid IN (SELECT rowid FROM node_harvests WHERE day < ? LIMIT 500)', 'idx_node_harvests_day'],
    [`SELECT id FROM guild_writs WHERE (state = 'open' AND expires_at <= ?1)
      OR (state != 'open' AND returned = 0 AND (escrow = 0 OR COALESCE((SELECT balance FROM guild_marks WHERE guild_id = guild_writs.guild_id), 0) + escrow <= ?2))
      ORDER BY expires_at LIMIT 20`, 'idx_guild_writs_unreturned'],
  ];
  for (const [sql, index] of cases) {
    const p = plan(sql);
    assert.ok(p.includes(index), `${index} is the way in:\n  ${sql}\n  ${p}`);
    assert.ok(!/SCAN (home_decor|market_deliveries|realm_trades|players|realm_census|market_fills|market_listings|market_orders|market_bids|node_harvests|guild_writs)(?! USING)/.test(p), `no table read whole: ${p}`);
  }
  // the statements the service runs are the ones planned above: every provenance asked of the decor spells the
  // expression as the index does, or the planner cannot use it
  for (const f of ['market.js', 'writs.js', 'decor.js']) {
    const text = src(`server-account/src/${f}`);
    // Goods-family listing filters also extract item.group. Inspect the decor SELECTs themselves,
    // without filtering on the expected JSON path: a wrong or missing provenance path must fail.
    const asked = [...text.matchAll(/SELECT 1 FROM home_decor WHERE ([^\n]+)/g)];
    const expected = { 'market.js': 4, 'writs.js': 3, 'decor.js': 1 };
    assert.equal(asked.length, expected[f], `${f} retains every audited decor provenance query`);
    for (const [, predicate] of asked) {
      const e = /^\s*(json_extract\(\s*item[^)]*\))/.exec(predicate)?.[1];
      assert.equal(e, "json_extract(item, '$.pv')", `${f}: ${predicate}`);
      assert.ok(plan(`SELECT 1 FROM home_decor WHERE ${e} = ?`).includes('idx_home_decor_pv'),
        `${f}: the actual decor expression uses its provenance index`);
    }
  }
});

// ═══ D. D1'S HUNDRED BOUND PARAMETERS ════════════════════════════════════════════════════════════════════════════════

/** D1 as D1 refuses: past 100 bound parameters a statement is an error (node:sqlite takes 32766, so the pins never saw). */
function d1Limited(db) {
  return new Proxy(db, {
    get(t, k) {
      if (k !== 'prepare') { const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; }
      return (sql) => {
        const st = t.prepare(sql);
        const bind = st.bind.bind(st);
        st.bind = (...args) => { if (args.length > 100) throw new Error(`D1_ERROR: too many SQL variables (${args.length})`); return bind(...args); };
        return st;
      };
    },
  });
}

test('SCALE1 D: the market\'s materials view asked for the whole catalogue binds under D1\'s hundred - its materials one bound JSON array, and the medians\' the same (mutants: the keys bound one each)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  s.env.DB = d1Limited(s.env.DB);
  const mac = await s.registered('Mac');
  const all = marketCatalogue().map((c) => c.key);
  assert.ok(all.length > 99, `the catalogue alone passes the bound (${all.length})`);
  const r = await s.call('/v1/market/read', { character: mac.character, region: 17, view: 'materials', materials: all, hubs: { 17: [207, 212] } }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.rows, []);
  const market = src('server-account/src/market.js');
  assert.match(market, /material IN\s*\(SELECT value FROM json_each\(\?2\)\)`\)\.bind\(today - MARKET_MEDIAN_DAYS, JSON\.stringify\(keys\)\)/, 'the medians bind their keys as one');
});

// ═══ E. THE DEPLOYS ══════════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE1 E: the account service deploys only after the suite passes; the relay runs the suite only when it would deploy, and deploys only when it passed; the bookmark is written before the migrations (mutants: each gate dropped)', () => {
  const acct = src('.github/workflows/account-deploy.yml');
  assert.match(acct, /\n {2}verify:\n {4}uses: \.\/\.github\/workflows\/verify\.yml\n {4}with:\n {6}build: false\n/);
  assert.match(acct, /\n {2}deploy:\n {4}needs: verify\n/);
  const bookmark = acct.indexOf("time-travel info \"$DB_NAME\" --json");
  const apply = acct.indexOf('d1 migrations apply "$DB_NAME" --remote');
  assert.ok(bookmark > 0 && apply > bookmark, 'the bookmark before the migrations');
  const relay = src('.github/workflows/relay-deploy.yml');
  assert.match(relay, /\n {2}verify:\n {4}needs: drift\n {4}if: needs\.drift\.outputs\.deploying == 'true'\n {4}uses: \.\/\.github\/workflows\/verify\.yml/);
  assert.match(relay, /\n {2}deploy:\n {4}needs: \[drift, verify\]\n/);
  assert.match(relay, /if: \$\{\{ !cancelled\(\) && needs\.drift\.result == 'success' && \(needs\.verify\.result == 'success' \|\| needs\.verify\.result == 'skipped'\) \}\}/);
});

// ═══ F. HOW A TAB ASKS AGAIN ═════════════════════════════════════════════════════════════════════════════════════════

test('SCALE1 F: a wait is jittered to [half, one and a half) of itself; only the network and the service\'s own fault are asked again at once (mutants: no jitter; `rate` asked again)', () => {
  assert.equal(jittered(1000, () => 0), 500);
  assert.equal(jittered(1000, () => 0.999999), 1500);
  assert.equal(jittered(1000, () => 0.5), 1000);
  for (let i = 0; i < 200; i++) { const w = jittered(400); assert.ok(w >= 200 && w <= 600, String(w)); }
  assert.deepEqual([...ASK_AGAIN_NOW], ['offline', 'server']);
});

test('SCALE1 F: the professions\' book asks `rate` and `maintenance` ONCE (kept, for its pump) and the network three times with jittered waits; the Drakes\' book waits between its asks now (mutants: the quick retry into a minute\'s refusal; the Drakes\' asks back to back; either unjittered)', async (t) => {
  t.mock.method(Math, 'random', () => 0);   // every jitter at its floor: half the wait, exactly
  for (const [error, asks] of [['rate', 1], ['maintenance', 1], ['offline', 3], ['server', 3]]) {
    let asked = 0;
    const waits = [];
    const door = { account: () => 'acct-1', state: async () => { asked++; return { ok: false, error }; } };
    const book = createProfBook({ door, storage: null, character: () => 'c1', sleep: async (ms) => { waits.push(ms); } });
    await book.refresh();
    assert.equal(asked, asks, `${error}: asked ${asks}`);
    assert.equal(waits.length, asks - 1);
    assert.deepEqual(waits, PROF_RETRY_MS.slice(0, asks - 1).map((b) => b / 2), `${error}: the waits, jittered`);
  }
  let asked = 0;
  const waits = [];
  const marks = createMarksBook({ door: { account: () => 'acct-1', balance: async () => { asked++; return { ok: false, error: 'server' }; } }, sleep: async (ms) => { waits.push(ms); } });
  await marks.refresh();
  assert.equal(asked, MARKS_TRIES);
  assert.equal(waits.length, MARKS_TRIES - 1);
  assert.deepEqual(waits, MARKS_RETRY_MS.map((b) => b / 2), 'the Drakes\' waits, jittered');
});

test('SCALE1 F: the market\'s and the writs\' books ask `rate` once and the network three times, their waits jittered (mutants: either book\'s quick retry into a minute\'s refusal, or its waits unjittered)', async (t) => {
  t.mock.method(Math, 'random', () => 0);
  const books = [
    ['market', MARKET_RETRY_MS, (door, sleep) => createMarketBook({ door, character: () => 'c1', sleep }), (b) => b.read('materials', {}, { force: true }), 'read'],
    ['writs', WRIT_RETRY_MS, (door, sleep) => createWritBook({ door, character: () => 'c1', sleep }), (b) => b.budget(5), 'budget'],
  ];
  for (const [name, base, make, press, route] of books) {
    for (const [error, asks] of [['rate', 1], ['offline', 3]]) {
      let asked = 0;
      const waits = [];
      const door = { account: () => 'acct-1', [route]: async () => { asked++; return { ok: false, error }; } };
      await press(make(door, async (ms) => { waits.push(ms); }));
      assert.equal(asked, asks, `${name} ${error}: asked ${asks}`);
      assert.deepEqual(waits, base.slice(0, asks - 1).map((b) => b / 2), `${name} ${error}: the waits, jittered`);
    }
  }
});
