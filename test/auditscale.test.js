// AUDIT SCALE (2026-10-08, Mac: "Do a comprehensive audit on this and ensure perfection") - the audit of SCALE3 and
// SCALE4a-c (bible/11-Multiplayer/Scale-Arc.md; the record bible/01-Overview/Audit-Scale.md). Four review lanes read a
// snapshot of the pushed head (26594ff5): the account service (A), the client's heartbeat (B), the load harness and its
// numbers (C), the tests' honesty and the record (D). Every finding fixed here was reproduced first, and each pin below
// fails on the code as it stood - or, for a law that already held and no pin held (lane D's surviving mutants), dies
// under its mutant (tools/mutants/auditscale.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';

import { standService, T0 } from './accountDb.mjs';
import { MARKS_MAX } from '../src/net/marksLaw.js';
import { saleTax, AUCTION_S, AUCTION_GRACE_S, MARKET_KEEP_DAYS } from '../src/net/marketLaw.js';
import { seatReportText } from '../src/net/townSeatLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import {
  runCron, CRON_MINUTE, CRON_HOUR, MINUTE_JOBS, HOUR_JOBS, FIRING_STATEMENTS_MAX, RATE_ROW_KEEP_S, _resetCronForTests,
} from '../server-account/src/cron.js';
import { closeContracts } from '../server-account/src/contracts.js';
import { pruneMarketHistory, TITHE_PCT_MOST } from '../server-account/src/market.js';
import { ARENA_CHAMPION_STORED_S, ARENA_CHAMPION_CLOCK_S } from '../server-account/src/arena.js';
import { SESSION_TOUCH_S } from '../server-account/src/accounts.js';
import worker from '../server-account/src/index.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rand = (b) => webcrypto.getRandomValues(b);
const DAY = 86_400;
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });

/** Every statement the service asks, counted by its SQL. */
function counting(s) {
  const base = s.env.DB;
  const asked = [];
  s.env.DB = { _raw: base._raw, prepare(sql) { asked.push(sql); return base.prepare(sql); }, batch: (list) => base.batch(list) };
  return { asked, restore: () => { s.env.DB = base; } };
}
/** The SQL a function asks of a database that answers nothing - the statements, as written. */
async function sqlOf(fn) {
  const asked = [];
  const st = { bind() { return st; }, all: async () => ({ results: [] }), first: async () => null, run: async () => ({ meta: { changes: 0 } }), _sql: '' };
  const db = { prepare(sql) { asked.push(sql); return st; }, batch: async (list) => list.map(() => ({ meta: { changes: 0 } })) };
  await fn(db);
  return asked;
}
/** EXPLAIN QUERY PLAN over every migration, with each `?n` bound to 0. */
function planOf(sql) {
  const db = new DatabaseSync(':memory:');
  for (const m of readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) db.exec(src(`server-account/migrations/${m}`));
  const n = Math.max(0, ...[...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])));
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array(n).fill(0)).map((r) => r.detail).join(' | ');
}

// ═══ A. THE ACCOUNT SERVICE ═════════════════════════════════════════════════════════════════════════════════════════

/** A seat holding Anticlere at a Tithe of 8, as test/seat1d_service.test.js stands one; a seller and a buyer. */
async function tithedMarket() {
  clock(T0);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  for (const w of [await svc.guest(), await svc.guest(), await svc.guest()]) {
    raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  }
  const gm = await svc.registered('Holder', { renown: 12 });
  await svc.found(gm, { name: 'The Holders', tag: 'HLD' });
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(gm.id).guild_id;
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed) VALUES (?, ?, ?, ?, 0, 50, NULL, ?, 8, 0)`)
    .run(ANTICLERE.key, gid, ANTICLERE.region, ANTICLERE.tier, T0 - 7 * DAY);
  const seller = await svc.registered('Seller', { renown: 10 });
  const buyer = await svc.registered('Buyer', { renown: 10 });
  svc.seedMarks(seller, 100_000, 's'); svc.seedMarks(buyer, 100_000, 'b');
  return { svc, raw, seller, buyer, HUBS: { 21: [402, 151] } };
}

test('AUDIT SCALE A1: an auction won under a seat\'s Tithe, its seller within the Tithe of the Marks cap, SELLS at its end - the room is decided by the proceeds less the seat\'s real Tithe, the very `gets` both decisions guard on; it had waited out the whole grace, then been picked every time and closed by neither, twenty of them holding the page so no auction after them closed', async () => {
  const { svc, raw, seller, buyer, HUBS } = await tithedMarket();
  let rid = 0;
  raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES ('00000000000000a1', ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 4242, 'p1.x', ?)`).run(seller.id, seller.character, T0);
  const posted = await svc.call('/v1/market/auction', { character: seller.character, region: 21, provenance: '00000000000000a1', wear: 900, opening: 1000, hubs: HUBS, board: [405, 150], rid: `audit-${String(++rid).padStart(6, '0')}` }, seller.secret);
  assert.equal(posted.status, 200, JSON.stringify(posted.body));
  const a = posted.body.auction;
  assert.equal((await svc.call('/v1/market/bid', { character: buyer.character, region: 21, auction: a.id, amount: 1000, hubs: HUBS, rid: `audit-${String(++rid).padStart(6, '0')}` }, buyer.secret)).status, 200);
  // the seller's purse in the band: room for what the sale pays under the Tithe (1000 - 50 tax - 80 Tithe = 870), not
  // for what it pays with none (950)
  const bal = () => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(seller.id)?.balance ?? 0);
  svc.seedMarks(seller, MARKS_MAX - 900 - bal(), 'band');
  assert.equal(MARKS_MAX - bal(), 900);
  assert.ok(1000 - saleTax(1000) - 80 <= 900 && 1000 - saleTax(1000) > 900, 'the band: room under the Tithe, none without it');
  assert.ok(TITHE_PCT_MOST >= 8, 'the least a seller can be owed reads the most a Tithe can take');
  // just past its end, inside the grace: the seller's read closes it - sold, the bid won
  clock(T0 + AUCTION_S + 60);
  await svc.call('/v1/market/read', { character: seller.character, region: 21, view: 'mine', hubs: HUBS }, seller.secret);
  assert.equal(raw.prepare('SELECT state FROM market_auctions WHERE id = ?').get(a.id).state, 'sold');
  assert.equal(raw.prepare('SELECT state FROM market_bids WHERE auction = ?').get(a.id).state, 'won');
  // twenty such - a second seller's, in the band - past the grace, and a plain unbid one behind them: the clock's minutes
  // close all twenty-one
  const second = await svc.registered('Second', { renown: 10 });
  svc.seedMarks(second, MARKS_MAX - 900, 'band');
  const A = { ...raw.prepare('SELECT * FROM market_auctions WHERE id = ?').get(a.id), seller: second.id, char_id: second.character };
  const B = { ...raw.prepare('SELECT * FROM market_bids WHERE auction = ?').get(a.id) };
  const put = (table, row) => { const k = Object.keys(row); raw.prepare(`INSERT INTO ${table} (${k.join(', ')}) VALUES (${k.map(() => '?').join(', ')})`).run(...k.map((c) => row[c])); };
  const prov = (i) => `00000000000000${(0xb0 + i).toString(16)}`;
  for (let i = 1; i <= 21; i++) {
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 4242, 'p1.x', ?)`).run(prov(i), second.id, second.character, T0);
    const bid = i <= 20;
    put('market_auctions', { ...A, id: `${a.id}x${i}`, provenance: prov(i), rid: `${A.rid}x${i}`, high_bid: null, state: 'open', closed_at: null, cn: null, returned: 0, tithe: 0, ...(bid ? {} : { high: null, bids: 0 }) });
    if (bid) {
      put('market_bids', { ...B, id: `${B.id}x${i}`, auction: `${a.id}x${i}`, rid: `${B.rid}x${i}`, state: 'high', returned: 0 });
      raw.prepare('UPDATE market_auctions SET high_bid = ? WHERE id = ?').run(`${B.id}x${i}`, `${a.id}x${i}`);
    }
  }
  clock(T0 + AUCTION_S + AUCTION_GRACE_S + 120);
  _resetCronForTests();
  const ran = await runCron(svc.env, { cron: CRON_MINUTE, nowS: _now, rand });
  const job = ran.find((j) => j.name === 'auctions');
  const open = raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n;
  assert.equal(open, 21 - job.changed, 'the job says what it closed');
  assert.ok(job.changed > 0, 'and it closed');
  // one sale fills the second seller's cap: the rest, past the grace, close unsold - nothing is picked forever
  for (let m = 1; m <= 30 && raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n; m++) await runCron(svc.env, { cron: CRON_MINUTE, nowS: _now + 60 * m, rand });
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n, 0);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE id = ? AND state = 'unsold'").get(`${a.id}x21`).n, 1, 'the plain one closed');
});

test('AUDIT SCALE A2: a firing keeps under D1\'s thousand statements an invocation - each job its share of FIRING_STATEMENTS_MAX, a settler stopping between items once its share is spent and asking again only while a full page MOVED; a backlog goes on the next minute, every job still runs, and the job says what it closed, never what it picked', async () => {
  clock(T0);
  const svc = await standService({ MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const seller = await svc.registered('Seller');
  const put = raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n)
    VALUES (?, ?, ?, 21, ?, 900, 100, 1, ?, ?, ?, 'n')`);
  raw.exec('BEGIN');
  for (let i = 0; i < 600; i++) put.run(`backlog-${i}`, seller.id, seller.character, i.toString(16).padStart(16, '0'), T0 - DAY, T0 - 600 + i, `rid-${i}`);
  raw.exec('COMMIT');
  const share = Math.floor(FIRING_STATEMENTS_MAX / MINUTE_JOBS.length);
  // D1 answers an invocation a thousand queries (Workers Paid); a firing runs its budget and one item a job past it - an
  // auction's sale is about eleven, a sweep's round one, the History's nine
  for (const jobs of [MINUTE_JOBS, HOUR_JOBS]) assert.ok(FIRING_STATEMENTS_MAX + jobs.length * 11 <= 1000, `${FIRING_STATEMENTS_MAX} + ${jobs.length} items under D1's thousand`);
  _resetCronForTests();
  const ran = await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0, rand });
  const job = ran.find((j) => j.name === 'auctions');
  assert.ok(job.statements <= share + 2, `the auctions' share kept: ${job.statements} of ${share} (an unbid close is two)`);
  assert.equal(job.changed, 600 - raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n, 'what it closed');
  assert.ok(job.changed > 20, 'more than one page, under its share');
  assert.ok(ran.every((j) => j.ok), 'every job ran');
  assert.ok(ran.reduce((n, j) => n + j.statements, 0) <= FIRING_STATEMENTS_MAX + MINUTE_JOBS.length * 11);
  // the minute after goes on where it stopped
  const before = raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n;
  await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0 + 60, rand });
  assert.ok(raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE state = 'open'").get().n < before);
  // D1's own cap, modelled: the thousand-and-first statement of an invocation refused - no job reaches it
  const real = svc.env.DB;
  let n = 0;
  svc.env.DB = { _raw: real._raw, prepare(sql) { if (++n > 1000) throw new Error('D1_ERROR: too many queries (modelled)'); return real.prepare(sql); }, batch: (l) => real.batch(l) };
  const capped = await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0 + 120, rand });
  svc.env.DB = real;
  assert.ok(capped.every((j) => j.ok), JSON.stringify(capped.map((j) => [j.name, j.ok, j.statements])));
});

test('AUDIT SCALE A3 A5: the clock\'s reads by an index - the contracts past their days or owed their escrow (closeContracts, every minute; the table is never pruned) by 0091\'s pair, and an old auction\'s bids (pruneMarketHistory, and the cascade its delete sets off) by 0091\'s idx_market_bids_auction; every delete of the History\'s prune takes a page at most', async () => {
  const [due] = await sqlOf((db) => closeContracts({ db, nowS: T0 }));
  const contracts = planOf(due);
  assert.doesNotMatch(contracts, /SCAN guild_contracts/, contracts);
  assert.match(contracts, /idx_guild_contracts_open_due|idx_guild_contracts_unreturned/, contracts);
  const prune = await sqlOf((db) => pruneMarketHistory(db, T0, 1000));
  assert.equal(prune.length, 9, 'nine tables');
  for (const sql of prune) assert.match(sql, /^DELETE FROM (\w+) WHERE rowid IN \(SELECT rowid FROM \1 WHERE [\s\S]+ LIMIT \?2\)$/, sql);
  const auctions = prune.find((sql) => sql.startsWith('DELETE FROM market_auctions'));
  const plan = planOf(auctions);
  assert.doesNotMatch(plan, /SCAN market_bids/, plan);
  assert.match(plan, /idx_market_bids_auction/, plan);
});

test('AUDIT SCALE A7: a heartbeat part that throws is answered `{ error: \'server\' }` - its route\'s 500 - and the others theirs; it had been the whole request\'s 500, the box lost with the board and the beat credited unanswered', async () => {
  clock(T0);
  const svc = await standService({ BOARD_OPEN: 'on' });
  const me = await svc.registered('Hearty');
  const real = svc.env.DB;
  svc.env.DB = { _raw: real._raw, prepare(sql) { if (/FROM board_notes n JOIN players/.test(sql)) throw new Error('D1_ERROR: the board is down (a test)'); return real.prepare(sql); }, batch: (l) => real.batch(l) };
  const quiet = console.warn; console.warn = () => {};
  const r = await svc.call('/v1/heartbeat', { beat: true, mail: true, board: 1234 }, me.secret);
  console.warn = quiet;
  svc.env.DB = real;
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.board, { error: 'server' });
  assert.ok(Array.isArray(r.body.mail?.letters), JSON.stringify(r.body.mail));
  assert.ok(Number.isSafeInteger(r.body.beat?.playedS), JSON.stringify(r.body.beat));
});

test('AUDIT SCALE A4: the arena clock\'s margin - it counts a kept word ARENA_CHAMPION_CLOCK_S old, so a word is never seen past ARENA_CHAMPION_STORED_S by a reader between two of its minutes (lane D: a margin of 30 s survived the only pin, `<`)', () => {
  assert.ok(ARENA_CHAMPION_STORED_S - ARENA_CHAMPION_CLOCK_S >= 2 * 60, `${ARENA_CHAMPION_STORED_S - ARENA_CHAMPION_CLOCK_S} s`);
});

test('AUDIT SCALE D2: the clock\'s moment in seconds - scheduled() hands runCron the firing\'s scheduledTime over a thousand; in milliseconds every session was a year idle and the hour signed everyone out', async () => {
  clock(T0);
  const svc = await standService();
  const g = await svc.guest();
  await worker.scheduled({ cron: CRON_HOUR, scheduledTime: T0 * 1000 }, svc.env, { waitUntil() {} });
  const r = await svc.call('/v1/account/played', {}, g.secret);
  assert.equal(r.status, 200, 'a session of a moment ago still signs in');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(g.id).n, 1);
});

test('AUDIT SCALE D7: on a quiet world the clock is six statements a minute and twenty an hour - each job asks once and, its page short, never again; the Motherlodes are not picked behind `dev`; a metrics write that throws costs no job', async () => {
  clock(T0);
  const svc = await standService({ SEATS_OPEN: 'on', PROFESSIONS_OPEN: 'on' });
  _resetCronForTests();
  await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0, rand });   // the day's Motherlodes picked, the seats' week settled
  const minute = await runCron(svc.env, { cron: CRON_MINUTE, nowS: T0 + 60, rand });
  assert.deepEqual(minute.map((j) => j.statements), [1, 1, 1, 1, 1, 1, 0], JSON.stringify(minute.map((j) => [j.name, j.statements])));   // PIN MOVED (CARDS10): Iliac Hand's season #1 asks once too
  const hour = await runCron(svc.env, { cron: CRON_HOUR, nowS: T0 + 120, rand });
  // PIN MOVED (INT2/INT5, 2026-10-09): the hour sweeps the judge's findings and the wealth-hours past their keep - one
  // statement each, its page short; seventeen became nineteen. PIN MOVED (LW15): the patrons' towns waiting asked once -
  // none, so no town read; nineteen became twenty
  assert.deepEqual(hour.map((j) => [j.name, j.statements]), [['board', 2], ['guild-board', 1], ['harvests', 2], ['market-history', 9], ['rate-limits', 1], ['sessions', 1], ['guild-invites', 1], ['realm-findings', 1], ['realm-wealth-hours', 1], ['patrons', 1]]);
  assert.equal(minute.reduce((n, j) => n + j.statements, 0) + hour.reduce((n, j) => n + j.statements, 0), 6 + 20);
  // behind `dev` the Motherlodes are a developer's: never picked by the clock
  const dev = await standService({ PROFESSIONS_OPEN: 'dev' });
  _resetCronForTests();
  const quiet = await runCron(dev.env, { cron: CRON_MINUTE, nowS: T0, rand });
  assert.deepEqual(['changed', 'statements'].map((k) => quiet.find((j) => j.name === 'motherlodes')[k]), [0, 0]);
  // a metrics sink that throws: every job still runs, and says it ran
  const broke = await standService();
  _resetCronForTests();
  const ran = await runCron({ ...broke.env, METRICS: { writeDataPoint() { throw new Error('the sink is down'); } } }, { cron: CRON_HOUR, nowS: T0, rand });
  assert.equal(ran.length, HOUR_JOBS.length);
  assert.ok(ran.every((j) => j.ok), JSON.stringify(ran));
});

test('AUDIT SCALE D8: a rate window\'s keep to the second - a row exactly RATE_ROW_KEEP_S old stays, one a second older goes, and one two hour-long windows old stays (the longest window any bucket counts)', async () => {
  clock(T0);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1), (?, ?, 1), (?, ?, 1)')
    .run('at-the-keep', T0 - RATE_ROW_KEEP_S, 'a-second-past', T0 - RATE_ROW_KEEP_S - 1, 'two-windows', T0 - 2 * 3600);
  _resetCronForTests();
  await runCron(svc.env, { cron: CRON_HOUR, nowS: T0, rand });
  assert.deepEqual(raw.prepare('SELECT key FROM rate_limits ORDER BY key').all().map((r) => r.key), ['at-the-keep', 'two-windows']);
  assert.ok(RATE_ROW_KEEP_S >= 2 * 3600 * 6, 'a day, many windows');
});

test('AUDIT SCALE D9: the History\'s keep to the day in all nine of its tables - a row of MARKET_KEEP_DAYS ago stays, one a day older goes (lane D: seven tables and the boundary held by nothing)', async () => {
  clock(T0);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const p = await svc.registered('Pruned');
  const keepFrom = utcDay(T0) - MARKET_KEEP_DAYS;
  const days = { kept: keepFrom, gone: keepFrom - 1 };
  for (const [k, day] of Object.entries(days)) {
    const at = day * DAY + 10;
    raw.prepare('INSERT INTO market_prices (day, material, price, units) VALUES (?, ?, 5, 1)').run(day, `ore:${k}`);
    raw.prepare('INSERT INTO market_gold_prices (day, material, price, units) VALUES (?, ?, 5, 1)').run(day, `ore:${k}`);
    raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, units, price, total, tax, from_region, to_region, arrives_at, delivered, at, day, n)
      VALUES (?, ?, 'c', 'l', ?, 'material', 'ore:iron', 1, 5, 5, 0, 1, 1, ?, 1, ?, ?, 'n')`).run(p.id, `sale-${k}`, p.id, at, at, day);
    raw.prepare(`INSERT INTO market_fills (filler, rid, char_id, order_id, poster, material, units, price, pay, tax, at, day, n)
      VALUES (?, ?, 'c', 'o', ?, 'ore:iron', 1, 5, 5, 0, ?, ?, 'n')`).run(p.id, `fill-${k}`, p.id, at, day);
    raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, price, fee, at, expires_at, state, closed_at, returned, rid, n)
      VALUES (?, ?, 'c', 1, 'material', 'ore:iron', 1, 5, 1, ?, ?, 'sold', ?, 1, ?, 'n')`).run(`listing-${k}`, p.id, at, at, at, `lrid-${k}`);
    raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, state, closed_at, returned, rid, n)
      VALUES (?, ?, 'c', 1, 'ore:iron', 1, 0, 5, 0, ?, ?, 'filled', ?, 1, ?, 'n')`).run(`order-${k}`, p.id, at, at, at, `orid-${k}`);
    raw.prepare(`INSERT INTO market_deliveries (id, player, char_id, provenance, wear, why, arrives_at, collected, at)
      VALUES (?, ?, 'c', '0000000000000000', 900, 'bought', ?, 1, ?)`).run(`delivery-${k}`, p.id, at, at);
    raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, state, closed_at, returned, rid, n)
      VALUES (?, ?, 'c', 1, ?, 900, 100, 1, ?, ?, 'unsold', ?, 1, ?, 'n')`).run(`auction-${k}`, p.id, k === 'kept' ? '00000000000000aa' : '00000000000000bb', at, at, at, `arid-${k}`);
    raw.prepare(`INSERT INTO market_bids (id, auction, bidder, char_id, region, amount, state, returned, at, rid, n)
      VALUES (?, ?, ?, 'c', 1, 100, 'outbid', 1, ?, ?, 'n')`).run(`bid-${k}`, `auction-kept`, p.id, at, `brid-${k}`);
  }
  _resetCronForTests();
  await runCron(svc.env, { cron: CRON_HOUR, nowS: T0, rand });
  const left = (table, col) => raw.prepare(`SELECT ${col} AS v FROM ${table} ORDER BY ${col}`).all().map((r) => r.v);
  assert.deepEqual(left('market_prices', 'material'), ['ore:kept']);
  assert.deepEqual(left('market_gold_prices', 'material'), ['ore:kept']);
  assert.deepEqual(left('market_sales', 'rid'), ['sale-kept']);
  assert.deepEqual(left('market_fills', 'rid'), ['fill-kept']);
  assert.deepEqual(left('market_listings', 'id'), ['listing-kept']);
  assert.deepEqual(left('market_orders', 'id'), ['order-kept']);
  assert.deepEqual(left('market_deliveries', 'id'), ['delivery-kept']);
  assert.deepEqual(left('market_bids', 'id'), ['bid-kept']);
  assert.deepEqual(left('market_auctions', 'id'), ['auction-kept'], 'the old auction gone with nothing of it waiting; the kept one keeps its bid');
});

test('AUDIT SCALE D9: a guild read with its master writes nothing, whatever its roster - the succession\'s probe reads the first in rank order, as its update does (lane D: the probe reversed survived, the one guild tested holding one member); one whose master is gone crowns its highest rank\'s longest-standing member', async () => {
  clock(T0);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const gm = await svc.registered('Master', { renown: 12 });
  await svc.found(gm, { name: 'The Many', tag: 'MNY' });
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(gm.id).guild_id;
  const officer = await svc.registered('Officer'), recruit = await svc.registered('Recruit');
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?), (?, ?, ?, 3, ?, ?)')
    .run(officer.id, officer.character, gid, 'Officer', T0 - 50, recruit.id, recruit.character, gid, 'Recruit', T0 - 100);
  const c = counting(svc);
  const mine = await svc.call('/v1/guilds/mine', { character: gm.character }, gm.secret);
  c.restore();
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.deepEqual(c.asked.filter((sql) => /UPDATE guild_members SET rank/.test(sql)), [], 'a guild with its master: no write');
  // the master gone: the officer (rank 1) crowned, not the longer-standing recruit (rank 3)
  raw.prepare('DELETE FROM guild_members WHERE player = ?').run(gm.id);
  await svc.call('/v1/guilds/mine', { character: officer.character }, officer.secret);
  assert.equal(raw.prepare('SELECT rank FROM guild_members WHERE player = ?').get(officer.id).rank, 0);
  assert.equal(raw.prepare('SELECT rank FROM guild_members WHERE player = ?').get(recruit.id).rank, 3);
});

test('AUDIT SCALE D9: the boards\' sweeps to the second - a note, a notice and a guild note whose end is now go; one a second younger stays (the reads show `expires_at > now`, so the two meet exactly)', async () => {
  clock(T0);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const a = await svc.registered('Author', { renown: 12 });
  await svc.found(a, { name: 'The Notes', tag: 'NTS' });
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(a.id).guild_id;
  for (const [k, end] of [['now', T0], ['later', T0 + 1]]) {
    raw.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, at, expires_at, rid) VALUES (?, 1, ?, 'A', 's', 'b', ?, ?, ?)`).run(`note-${k}`, a.id, T0 - DAY, end, `nr-${k}`);
    raw.prepare(`INSERT INTO board_notices (id, subject, body, author, author_name, at, expires_at, rid) VALUES (?, 's', 'b', ?, 'A', ?, ?, ?)`).run(`notice-${k}`, a.id, T0 - DAY, end, `cr-${k}`);
    raw.prepare(`INSERT INTO guild_notes (id, guild_id, author, char_id, author_name, subject, body, at, expires_at, rid) VALUES (?, ?, ?, ?, 'A', 's', 'b', ?, ?, ?)`).run(`gnote-${k}`, gid, a.id, a.character, T0 - DAY, end, `gr-${k}`);
  }
  _resetCronForTests();
  await runCron(svc.env, { cron: CRON_HOUR, nowS: T0, rand });
  for (const [table, k] of [['board_notes', 'note'], ['board_notices', 'notice'], ['guild_notes', 'gnote']]) {
    assert.deepEqual(raw.prepare(`SELECT id FROM ${table} ORDER BY id`).all().map((r) => r.id), [`${k}-later`], table);
  }
});

test('AUDIT SCALE D13: the touch is the SESSION\'s - a session stale by its own last_seen is touched though its player\'s is fresh (another device of the account touched it a moment ago); read by the player\'s, a device in use would never be touched and the year\'s sweep would take it', async () => {
  clock(T0);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const g = await svc.guest();
  const sid = raw.prepare('SELECT id FROM sessions WHERE player_id = ?').get(g.id).id;
  raw.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').run(T0 - SESSION_TOUCH_S - 60, sid);
  raw.prepare('UPDATE players SET last_seen = ? WHERE id = ?').run(T0 - 5, g.id);
  assert.equal((await svc.call('/v1/account/played', {}, g.secret)).status, 200);
  assert.equal(raw.prepare('SELECT last_seen FROM sessions WHERE id = ?').get(sid).last_seen, T0, 'the session touched');
});

test('AUDIT SCALE D17: a heartbeat naming board 0 is answered as /v1/board/read answers map 0 - a falsy board is still a part (lane D: `if (body?.board)` survived)', async () => {
  clock(T0);
  const svc = await standService({ BOARD_OPEN: 'on' });
  const me = await svc.registered('Zero');
  const route = await svc.call('/v1/board/read', { map: 0 }, me.secret);
  const beat = await svc.call('/v1/heartbeat', { board: 0 }, me.secret);
  assert.equal(beat.status, 200);
  assert.deepEqual(beat.body.board, route.status === 200 ? route.body : { error: route.body.error });
});

// ═══ B. THE CLIENT'S HEARTBEAT ══════════════════════════════════════════════════════════════════════════════════════

const HB = await import('../src/net/heartbeat.js');
const { createHeartbeat, partAnswer, whileLive, HEARTBEAT_TICK_MS, RIDE_EARLY_MS, BEAT_RIDE_MS, BEAT_GRACE_MARGIN_MS } = HB;
const { SESSION_KEY, SERVICE_KEY } = await import('../src/net/accountClient.js');
const { MailBox, MAIL_POLL_MS } = await import('../src/net/mail.js');
const { createNoticeBook, NOTICE_TRIES, NOTICE_RETRY_MS } = await import('../src/net/noticeBook.js');
const { BOARD_CACHE_MS } = await import('../src/net/boardLaw.js');
const { PLAY_BEAT_S, PLAY_GRACE_S } = await import('../src/net/playClock.js');

const SECRET = 'an-audit-secret-long-enough-01';
const storageOf = (entries = [[SESSION_KEY, JSON.stringify({ id: 'p1', secret: SECRET, name: 'Ann' })]]) => {
  const m = new Map(entries);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), _m: m };
};
/** A heartbeat on a fake clock over `answer(body, n, init)` - each request's body, moment and init kept. */
function rigHb({ answer = (body) => ({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, k === 'beat' ? { playedS: 1 } : {}])) }), storage = storageOf(), visible = () => true, waitMs = 50, sleeps = [] } = {}) {
  let t = 5_000_000;
  const sent = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, body, at: t, init });
    const a = await answer(body, sent.length, init);
    if (a === 'offline') throw new Error('down');
    return { ok: a.status < 400, status: a.status, headers: { get: () => 'application/json' }, json: async () => a.json };
  };
  const hb = createHeartbeat({
    fetch, storage, now: () => t, visible, waitMs,
    setInterval: () => 1, clearInterval: () => {}, sleep: async (ms) => { sleeps.push(ms); },
  });
  return { hb, sent, sleeps, at: () => t, set: (v) => { t = v; }, advance: async (ms) => { t += ms; await hb.tick(); await settle(); } };
}
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const clockPart = (r, everyMs, body = true) => {
  const p = { last: -Infinity, took: [] };
  p.part = { due: (t) => t - p.last >= everyMs, soon: (t, e) => t - p.last >= everyMs - e, every: everyMs, body: () => { p.last = r.at(); return body; }, take: (a) => p.took.push(a) };
  return p;
};

test('AUDIT SCALE B2: a heartbeat that hangs is given up after its wait (AUDIT 28 N6\'s law) - each part takes `offline`, the next tick asks again, and a board window waiting on the heartbeat\'s read is answered; one hung request had held all three clocks for the page', async () => {
  const hang = (body, n, init) => new Promise((resolve, reject) => {
    if (n > 3) { resolve({ status: 200, json: { board: { notes: [], notices: [] } } }); return; }
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const r = rigHb({ answer: hang, waitMs: 30 });
  const book = createNoticeBook({ door: { read: async () => { throw new Error('the board asked alone'); } }, nowMs: r.at, sleep: async () => {} });
  r.hb.add('board', book.heartbeatPart(() => 4242));
  const going = r.hb.tick();
  const window = book.read(4242);   // a window opened meanwhile: it waits on the heartbeat's read
  const done = await Promise.race([going.then(() => 'answered'), new Promise((x) => setTimeout(() => x('hung'), 2000))]);
  assert.equal(done, 'answered', 'given up, never wedged');
  assert.equal(r.sent.length, NOTICE_TRIES, 'asked NOTICE_TRIES times');
  assert.equal((await window).error, 'offline', 'the window answered with the failure');
  assert.equal(r.hb.flying, null);
  await r.advance(BOARD_CACHE_MS);
  assert.equal(r.sent.length, NOTICE_TRIES + 1, 'and the clocks go on');
  assert.ok(r.sent.every((x) => x.init.signal), 'every try carries its give-up');
});

test('AUDIT SCALE B1: the knock never waits past the grace - the page\'s first goes at once; after a dropped knock the next goes at once (its gap is already the grace); a knock waiting as the page hides goes with it, alone and kept alive; carried late after one on time, a knock still credits its whole gap', async () => {
  assert.ok(BEAT_RIDE_MS <= (PLAY_GRACE_S - PLAY_BEAT_S) * 1000 - BEAT_GRACE_MARGIN_MS, 'a knock carried as late as it may be, after one on time, credits all it would have');
  // the page's first: at once, though a part is due in a minute
  let failing = false;
  const r = rigHb({ answer: (body) => (failing ? 'offline' : { status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, k === 'beat' ? { playedS: 1 } : {}])) }) });
  const box = clockPart(r, MAIL_POLL_MS);
  r.hb.add('mail', box.part);
  await r.hb.tick(); await settle();   // the box's look
  r.set(r.at() + MAIL_POLL_MS - 60_000);
  r.hb.beat(); await settle();
  assert.deepEqual(r.sent.map((x) => x.body), [{ mail: true }, { beat: true }], 'the first knock at once');
  const credited = r.at();
  // a knock dropped: the service never answered it
  failing = true;
  r.set(credited + PLAY_BEAT_S * 1000);
  box.last = r.at() - MAIL_POLL_MS + 5_000_000;   // no ride for it
  r.hb.beat(); await settle(); await r.hb.flying; await settle();
  failing = false;
  // the next, at the grace: no wait though the box is due in a minute
  r.set(credited + PLAY_GRACE_S * 1000 - 5_000);
  box.last = r.at() - MAIL_POLL_MS + 60_000;
  const n = r.sent.length;
  r.hb.beat(); await settle();
  assert.deepEqual(r.sent.slice(n).map((x) => x.body), [{ beat: true }], 'gone at once, alone');
  // a knock waiting (the box a minute off) as the page hides: it goes then, kept alive past the page
  let shown = true;
  const h = rigHb({ visible: () => shown });
  const hbox = clockPart(h, MAIL_POLL_MS);
  h.hb.add('mail', hbox.part);
  h.hb.beat(); await settle();   // the first, at once - credited
  h.set(h.at() + MAIL_POLL_MS - 60_000);
  h.hb.beat(); await settle();
  const before = h.sent.length;
  shown = false;
  await h.hb.tick(); await settle();
  assert.deepEqual(h.sent.slice(before).map((x) => [x.body, x.init.keepalive]), [[{ beat: true }, true]]);
  await h.advance(60_000);
  assert.equal(h.sent.length, before + 1, 'and nothing else goes from a hidden page');
});

test('AUDIT SCALE B3: the box\'s look in flight on a heartbeat is the box\'s look - the Letters tab opened meanwhile takes its answer and asks nothing; two looks at once let the older answer land last, roll the box back and announce a letter twice', async () => {
  let release;
  const r = rigHb({ answer: () => new Promise((res) => { release = () => res({ status: 200, json: { mail: { letters: [{ id: 'l'.repeat(24), from: 'Dana', subject: 'Hi', sentAt: 9, read: false }], max: 50 } } }); }) });
  const notes = [];
  let alone = 0;
  const box = new MailBox({ ioOf: () => ({ fetch: async () => { alone++; return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ letters: [], max: 50 }) }; }, base: 'https://accounts.invalid', secret: SECRET, storage: null }), now: r.at, onLetter: (e) => notes.push(e) });
  box._known = new Set();   // a look before this one, so a letter is new
  r.hb.add('mail', box.heartbeatPart());
  const going = r.hb.tick(); await settle();
  const tab = box.refresh();   // the Letters tab opens while the heartbeat's look is out
  release(); await going; const answer = await tab;
  assert.equal(alone, 0, 'the tab asked nothing of its own');
  assert.equal(answer.ok, true);
  assert.deepEqual(notes.map((e) => e.kind), ['new'], 'the letter said once');
  assert.equal(box._looking, null, 'and the look done');
});

test('AUDIT SCALE B4: each part counts its clock from the send - with a slow service (4.5 s and 8 s a round trip) the box still looks every MAIL_POLL_MS in a town, riding the board\'s third minute, one request a minute; counted from the answer, it rode the second (28 looks an hour) or went alone', async () => {
 for (const RTT of [4_500, 8_000]) {
  let t0;
  const pending = [];
  const r = rigHb({ answer: (body) => new Promise((res) => pending.push({ due: t0() + RTT, go: () => res({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, k === 'board' ? { notes: [], notices: [] } : k === 'mail' ? { letters: [], max: 50 } : {}])) }) })) });
  t0 = r.at;
  const box = new MailBox({ ioOf: () => ({ fetch: async () => { throw new Error('the box asked alone'); }, base: 'https://accounts.invalid', secret: SECRET, storage: null }), now: r.at });
  const book = createNoticeBook({ door: { read: async () => { throw new Error('the board asked alone'); } }, nowMs: r.at, sleep: async () => {} });
  r.hb.add('mail', whileLive(box.heartbeatPart(), () => true));
  r.hb.add('board', book.heartbeatPart(() => 4242));
  const looks = [];
  for (let s = 0; s < 3600; s++) {
    r.set(r.at() + 1000);
    for (const p of pending.splice(0)) { if (p.due <= r.at()) p.go(); else pending.push(p); }
    await settle();
    const n = r.sent.length;
    r.hb.tick();   // never awaited: the answer comes as the clock reaches it, above
    await settle();
    for (const x of r.sent.slice(n)) if (x.body.mail) looks.push(x.at);
  }
  assert.equal(looks.length, 20, `${RTT} ms: ${looks.length} looks an hour`);
  assert.equal(r.sent.length, 60, `${RTT} ms: ${r.sent.length} requests an hour`);
 }
});

test('AUDIT SCALE B6: a part whose body throws does not ride, and the others do - every part told, the heartbeat let go, nothing thrown at the page', async () => {
  const r = rigHb();
  const good = clockPart(r, 60_000);
  r.hb.add('bad', { due: () => true, soon: () => true, every: 60_000, body: () => { throw new Error('a part broke'); }, take: () => {} });
  r.hb.add('good', good.part);
  const quiet = console.warn; console.warn = () => {};
  let thrown = null;
  const onRej = (e) => { thrown = e; };
  process.on('unhandledRejection', onRej);
  await r.hb.tick(); await settle(); await new Promise((x) => setTimeout(x, 5));
  process.off('unhandledRejection', onRej);
  console.warn = quiet;
  assert.equal(thrown, null);
  assert.deepEqual(r.sent.map((x) => x.body), [{ good: true }]);
  assert.equal(good.took.length, 1);
  assert.equal(r.hb.flying, null);
});

test('AUDIT SCALE D1: THE SHAPE THE PRODUCER MINTS - the client\'s heartbeat against the real Worker: its path, its POST, its credential and its base, every part answered as the service answers it (lane D: the path, the secret and the base all survived)', async () => {
  clock(T0);
  const svc = await standService({ BOARD_OPEN: 'on' });
  const me = await svc.registered('Wire');
  const storage = storageOf([[SESSION_KEY, JSON.stringify({ id: me.id, secret: me.secret, name: 'Wire' })], [SERVICE_KEY, 'https://accounts.invalid']]);
  const asked = [];
  const hb = createHeartbeat({
    fetch: (u, i) => { asked.push([u, i.method, i.headers?.authorization]); return svc.fetch(u, i); }, storage, now: () => T0 * 1000,
    setInterval: () => 1, clearInterval: () => {}, sleep: async () => {},
  });
  const box = new MailBox({ ioOf: () => ({ fetch: (u, i) => svc.fetch(u, i), base: 'https://accounts.invalid', secret: me.secret, storage }), now: () => T0 * 1000 });
  const book = createNoticeBook({ door: { read: async () => { throw new Error('the board asked alone'); } }, nowMs: () => T0 * 1000, sleep: async () => {} });
  hb.add('mail', box.heartbeatPart());
  hb.add('board', book.heartbeatPart(() => 1234));
  await hb.beat();
  assert.deepEqual(asked, [['https://accounts.invalid/v1/heartbeat', 'POST', `Bearer ${me.secret}`]]);
  assert.equal(box.state, 'ready');
  assert.ok(book.cached(1234), 'the board read');
  assert.equal(svc.env.DB._raw.prepare('SELECT played_at FROM players WHERE id = ?').get(me.id).played_at, T0, 'the beat credited');
});

test('AUDIT SCALE D10: the client parts\' small laws - a lost answer asked again NOTICE_RETRY_MS apart; a take that throws leaves the others theirs; the tick waits while one is out; the box\'s part stamped with no session (MAIL1); the board\'s part not due while a window\'s read is out, and its answers in `read`\'s shapes; an answer not an object is the server\'s refusal; the tick fine enough for RIDE_EARLY_MS', async () => {
  // the retries' spacing
  const sleeps = [];
  const r = rigHb({ answer: () => ({ status: 503, json: { error: 'server' } }), sleeps });
  const a = clockPart(r, 60_000), b = clockPart(r, 60_000);
  r.hb.add('a', { ...a.part, take: () => { throw new Error('a take broke'); } });
  r.hb.add('b', b.part);
  const quiet = console.warn; console.warn = () => {};
  const going = r.hb.tick();
  assert.equal(r.hb.tick(), null, 'the tick waits while one is out');
  await going; await settle();
  console.warn = quiet;
  assert.deepEqual(sleeps, NOTICE_RETRY_MS.slice(0, NOTICE_TRIES - 1));
  assert.equal(b.took.length, 1, 'b took its answer though a\'s take threw');
  assert.equal(b.took[0].ok, false);
  // the box's part, signed out: stamped all the same, and nothing rides
  let t = 7_000_000;
  const box = new MailBox({ ioOf: () => null, now: () => t });
  const part = box.heartbeatPart();
  assert.equal(part.body(), undefined);
  assert.equal(box.at, t, 'stamped');
  assert.equal(part.due(t + 1000), false, 'not due again at once');
  // the board's part: not due while the town's own read is out; its answers in read's shapes
  const doorWait = [];
  const book = createNoticeBook({ door: { read: () => new Promise((res) => doorWait.push(res)) }, nowMs: () => t, sleep: async () => {} });
  const bp = book.heartbeatPart(() => 77);
  const windowRead = book.read(77);
  assert.equal(bp.due(t), false, 'a window\'s read is out');
  doorWait[0]({ ok: true, data: { notes: [], notices: [] } }); await windowRead;
  t += BOARD_CACHE_MS;
  assert.equal(bp.due(t), true);
  bp.body();
  const window2 = book.read(77);
  bp.take({ ok: true, data: { notes: [{ id: 'n', at: 1 }], notices: [] } });
  assert.deepEqual(await window2, { board: { notes: [{ id: 'n', at: 1 }], notices: [] }, error: null, stale: false });
  t += BOARD_CACHE_MS;
  bp.body();
  const window3 = book.read(77);
  bp.take({ ok: false, error: 'server' });
  assert.deepEqual(await window3, { board: { notes: [{ id: 'n', at: 1 }], notices: [] }, error: 'server', stale: true });
  // a part's answer that is not an object is the server's refusal
  for (const v of [true, 7, 'x', null, undefined]) assert.deepEqual(partAnswer(v), { ok: false, error: 'server' });
  assert.deepEqual(partAnswer({ error: 'bad-board' }), { ok: false, error: 'bad-board' });
  // a good board after a refusal: the refusal let go
  t += BOARD_CACHE_MS;
  bp.body();
  const window4 = book.read(77);
  bp.take({ ok: true, data: { notes: [], notices: [] } });
  assert.deepEqual(await window4, { board: { notes: [], notices: [] }, error: null, stale: false });
  assert.deepEqual(await book.read(77), { board: { notes: [], notices: [] }, error: null, stale: false }, 'and the cache it keeps says so');
  assert.ok(HEARTBEAT_TICK_MS * 4 <= RIDE_EARLY_MS, 'the tick looks at the clocks several times inside RIDE_EARLY_MS');
  // the tick waits while one is out: a knock made meanwhile rides the next heartbeat, never a second request at once
  let open;
  const w = rigHb({ answer: (body) => new Promise((res) => { open = () => res({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, k === 'beat' ? { playedS: 1 } : {}])) }); }) });
  const wp = clockPart(w, 60_000);
  w.hb.add('p', wp.part);
  const first = w.hb.tick(); await settle();
  w.hb.beat(); await settle();
  assert.equal(w.sent.length, 1, 'one request out, the knock waits for it');
  open(); await first; await settle();
});

test('AUDIT SCALE D10: two clocks of one period out of step fall into step - an equal clock rides as a slower one does (lane D: `>` for `>=` survived), one request a period where there were two', async () => {
  const r = rigHb();
  const a = clockPart(r, 60_000), b = clockPart(r, 60_000);
  r.hb.add('a', a.part);
  await r.hb.tick(); await settle();
  for (let s = 0; s < 30; s++) await r.advance(1000);
  r.hb.add('b', b.part);   // half a minute out of step
  await r.hb.tick(); await settle();
  const n = r.sent.length;
  for (let s = 0; s < 600; s++) await r.advance(1000);
  assert.equal(r.sent.length - n, 10, `${r.sent.length - n} requests in ten minutes`);
  assert.ok(r.sent.slice(n + 1).every((x) => 'a' in x.body && 'b' in x.body), 'after the first, every one carries both');
});

// ═══ C. THE LOAD HARNESS ════════════════════════════════════════════════════════════════════════════════════════════

const H = await import('../tools/loadHarness.mjs');
const { mapPixelOfWire, POSE_TS_MOD } = await import('../src/net/wire.js');
const { PROF_CLOSED_RECHECK_MS } = await import('../src/net/profBook.js');

test('AUDIT SCALE C1: the professions\' state as the client\'s book reads it - once on arrival for an account it is open to, a refusal (a guest\'s) asked again every PROF_CLOSED_RECHECK_MS; the harness had asked it every 30 s of a gatherer\'s, the client\'s floor for a read that failed, thirty times the client', async () => {
  const asked = [];
  const fetch = async (url) => { asked.push(new URL(url).pathname); return { status: 200, ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}), text: async () => '{}' }; };
  const botOf = (registered) => ({
    n: 1, name: 'Pin Bot', mapId: 1000, registered, fighter: false, mover: true, fetch, realm: { id: 'r1', session: null },
    account: { secret: SECRET }, storage: storageOf([[SESSION_KEY, JSON.stringify({ id: 'p', secret: SECRET, name: 'P' })], [SERVICE_KEY, H.LOAD_SERVICE]]),
  });
  const o = H.parseArgs([]);
  for (const registered of [true, false]) {
    asked.length = 0;
    const bot = botOf(registered);
    const clocks = H.accountClocks(bot, o);
    bot.heartbeat?.stop(); bot.stopBeat?.();
    await settle();
    const prof = clocks.filter((c) => c.name === 'prof state');
    if (registered) {
      assert.deepEqual(prof, [], 'no clock: the state read once, on arrival');
      assert.equal(asked.filter((p) => p === '/v1/prof/state').length, 1);
    } else {
      assert.deepEqual(prof.map((c) => c.every), [PROF_CLOSED_RECHECK_MS]);
    }
    assert.ok(clocks.every((c) => c.every >= 30_000), JSON.stringify(clocks.map((c) => [c.name, c.every])));
  }
  assert.ok(!('gatherers' in H.KNOBS), 'no knob for a gathering the harness does not model');
});

test('AUDIT SCALE C2: the fleet\'s roles each their own - a share spread evenly over the fleet, the roles\' overlap their shares\' product; one spread for every share had made every fighter a mover', () => {
  const o = H.parseArgs(['--movers', '0.7', '--fighters', '0.5', '--registered', '0.6']);
  const N = 1000;
  const roles = Array.from({ length: N }, (_, n) => H.rolesOf(n, o));
  const count = (f) => roles.filter(f).length;
  assert.ok(Math.abs(count((r) => r.mover) - 700) <= 10);
  assert.ok(Math.abs(count((r) => r.fighter) - 500) <= 10);
  assert.ok(Math.abs(count((r) => r.registered) - 600) <= 10);
  assert.ok(Math.abs(count((r) => r.mover && r.fighter) - 350) <= 30, `${count((r) => r.mover && r.fighter)}`);
  assert.ok(Math.abs(count((r) => r.fighter && r.registered) - 300) <= 30);
});

test('AUDIT SCALE C5: the storm\'s seconds by their own moments - a call, a mint, a statement and a refusal in the second it happened, the bots back counted from their welcomes, a share back the moment its last bot was welcomed (not when a loop looked)', () => {
  const at = 1_000_000;
  const { seconds, reachedS } = H.stormSeconds([
    [at + 500, 'calls', 1], [at + 1600, 'calls', 1], [at + 1600, 'mints', 1], [at + 1700, 'statements', 11], [at + 1800, 'refused', 'busy'], [at + 2900, 'failed', 1],
  ], [at + 900, at + 2100, null, at + 3500], at, 4);
  assert.deepEqual(seconds.map((r) => [r.t, r.calls, r.mints, r.statements, r.failed, r.back, r.refused]), [
    [1, 1, 0, 0, 0, 1, {}], [2, 1, 1, 11, 0, 1, { busy: 1 }], [3, 0, 0, 0, 1, 2, {}], [4, 0, 0, 0, 0, 3, {}],
  ]);
  assert.deepEqual(reachedS, { 0.25: 0.9, 0.5: 2.1 });
});

test('AUDIT SCALE D12: a fleet\'s synthetic closes summed with the rest when the fleets merge (lane D: dropped from the merge\'s keys, it survived)', () => {
  const fleet = (k) => ({ bots: 1, account: [], relay: { opened: k, synthetic: 2 * k, inFrames: 0, inBytes: 0, outFrames: 0, outBytes: 0, inByType: {}, outByType: {}, closes: {}, refusals: {}, poseMs: [], poseSeen: 0 } });
  assert.equal(H.mergeFleets([fleet(1), fleet(2)]).relay.synthetic, 6);
});

test('AUDIT SCALE C12: a count is a whole number from 1, a share a share, the storm inside the play - 2.5 threads had built fleets past the bots asked, --setup 0 spun for ever', () => {
  for (const bad of [['--threads', '2.5'], ['--bots', '10.5'], ['--setup', '0'], ['--cells', '0'], ['--storm-at', '1.5'], ['--storm-at', '0'], ['--movers', '2'], ['--fighters', '-0.1'], ['--ramp', '-1']]) {
    assert.throws(() => H.parseArgs(bad), Error, bad.join(' '));
  }
  assert.equal(H.parseArgs(['--threads', '3']).threads, 3);
});

test('AUDIT SCALE C10 C2: the report\'s arithmetic - bot-hours from the play, a route\'s requests and statements a bot-hour, the clock\'s own rows in the statements and never the requests, the play\'s totals with the deploy\'s mints apart, and the fleet it measured', () => {
  const o = H.parseArgs(['--bots', '20', '--movers', '0.5', '--fighters', '0.5']);
  const account = { byRoute: new Map([['/v1/heartbeat', { n: 40, statuses: { 200: 40 }, ms: [5, 10] }], ['/v1/auth/token', { n: 4, statuses: { 200: 4 }, ms: [9] }]]) };
  const statsSum = { byRoute: new Map([['/v1/heartbeat', { n: 40, statements: 180 }], ['/v1/auth/token', { n: 4, statements: 44 }], ['cron:auctions', { n: 6, statements: 6 }]]), statements: new Map([['SELECT 1', { n: 3, rowsRead: 30, rowsWritten: 2 }]]) };
  const quiet = console.log; console.log = () => {};
  const r = H.report({ bots: 20, o, account, relay: H.relayTally(), poseSeen: 0, statsSum, playedMs: 6 * 60_000, storm: null, threads: 1 });
  console.log = quiet;
  assert.equal(r.botHours, 2);
  assert.deepEqual(r.routes.find((x) => x.route === '/v1/heartbeat').perBotHour, 20);
  assert.deepEqual(r.routes.find((x) => x.route === '/v1/heartbeat').statementsPerBotHour, 90);
  assert.equal(r.totals.requestsPerBotHour, 22, 'the clock\'s firings are no requests');
  assert.equal(r.totals.statementsPerBotHour, (180 + 44 + 6) / 2);
  assert.deepEqual(r.play, { requestsPerBotHour: 20, statementsPerBotHour: (180 + 6) / 2 });
  assert.equal(r.totals.rowsReadPerBotHour, 15);
  assert.deepEqual(Object.keys(r.fleet), ['bots', 'threads', 'movers', 'fighters', 'registereds']);
  assert.equal(r.fleet.bots, 20);
  assert.equal(r.fleet.movers, Array.from({ length: 20 }, (_, n) => H.rolesOf(n, o).mover).filter(Boolean).length);
});

test('AUDIT SCALE D12: the harness\'s counters - every frame and byte in and out by type, a pose\'s age across the stamp\'s wrap, a refusal by its word and its moment, a welcome told, a connect that never opened closed 1006 as a browser closes it; the percentile\'s rank; a reservoir uniform; the fetch\'s offline and refusal words, and a give-up honoured; a bot\'s pose in its town\'s cell', async () => {
  // the socket's tally over a fake base
  class Base extends EventTarget { constructor() { super(); this.sent = []; } send(d) { this.sent.push(d); } }
  const tally = H.relayTally();
  let t = 10_000;
  const welcomed = [];
  tally.onWelcome = (ws, room) => welcomed.push(room);
  const WS = H.localWebSocket({ port: 9, tally, Base, now: () => t });
  const ws = new WS('ws://127.0.0.1:9/room/w:1:2');
  const say = (text) => ws.dispatchEvent(Object.assign(new Event('message'), { data: text }));
  const heard = [`{"t":"pose","ts":${(t - 25) % POSE_TS_MOD}}`, '{"t":"welcome"}', '{"t":"error","m":"busy"}'];
  for (const text of heard) say(text);
  ws.send('{"t":"pose"}');
  assert.deepEqual([tally.inFrames, tally.inBytes, tally.outFrames, tally.outBytes], [3, heard.join('').length, 1, '{"t":"pose"}'.length]);
  assert.deepEqual(tally.inByType, { pose: 1, welcome: 1, error: 1 });
  assert.deepEqual(tally.poseMs, [25]);
  t = POSE_TS_MOD + 3;   // the stamp wrapped
  say(`{"t":"pose","ts":${POSE_TS_MOD - 2}}`);
  assert.deepEqual(tally.poseMs, [25, 5]);
  assert.deepEqual([tally.refusals, tally.refusedAt], [{ busy: 1 }, [[10_000, 'busy']]]);
  assert.deepEqual(welcomed, ['w:1:2']);
  const dead = new WS('ws://127.0.0.1:9/room/w:9:9');
  let closed = null;
  dead.onclose = (e) => { closed = e.code; };
  dead.dispatchEvent(new Event('error'));
  await new Promise((x) => setTimeout(x, 5));
  assert.equal(closed, 1006);
  assert.equal(tally.synthetic, 1);
  // the percentile's rank, and a reservoir uniform over what it was offered
  assert.equal(H.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5), 5);
  assert.equal(H.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95), 10);
  const kept = [];
  for (let i = 0; i < 200_000; i++) H.reservoir(kept, i, i + 1, 2000);
  const mean = kept.reduce((a, v) => a + v, 0) / kept.length;
  assert.ok(Math.abs(mean - 100_000) < 6_000, `kept uniformly: mean ${mean}`);
  // the fetch: a request that fails is noted offline; a refusal by its word; a give-up honoured
  const notes = [];
  const failing = (opts, onRes) => { const req = { on(ev, fn) { if (ev === 'error') setTimeout(() => fn(new Error('ECONNREFUSED')), 0); return req; }, write() {}, end() {}, destroy() {} }; return req; };
  await assert.rejects(H.localFetch({ port: 9, note: (...a) => notes.push(a), request: failing })(`${H.LOAD_SERVICE}/v1/board/read`, { method: 'POST', body: '{}' }));
  const refusing = (opts, onRes) => {
    const res = { statusCode: 429, headers: { 'content-type': 'application/json' }, on(ev, fn) { if (ev === 'data') setTimeout(() => fn(Buffer.from('{"error":"rate"}')), 0); if (ev === 'end') setTimeout(fn, 1); return res; } };
    setTimeout(() => onRes(res), 0);
    return { on() { return this; }, write() {}, end() {}, destroy() {} };
  };
  await H.localFetch({ port: 9, note: (...a) => notes.push(a), request: refusing })(`${H.LOAD_SERVICE}/v1/board/read`, { method: 'POST', body: '{}' });
  const gone = new AbortController(); gone.abort();
  await assert.rejects(H.localFetch({ port: 9, note: (...a) => notes.push(a), request: refusing })(`${H.LOAD_SERVICE}/v1/mail/inbox`, { signal: gone.signal }));
  assert.deepEqual(notes.map(([route, status]) => [route, status]), [['/v1/board/read', 'offline'], ['/v1/board/read', '429 rate'], ['/v1/mail/inbox', 'offline']]);
  // a bot's pose in its town's own cell, at every moment
  const bot = { town: H.townPixel(0), mover: true, phase: 1, speed: 0.8, radius: 0.3 };
  for (const s of [0, 1.5, 30, 600, 3600]) assert.deepEqual(mapPixelOfWire(H.poseAt(bot, s).x, H.poseAt(bot, s).z), [bot.town.px, bot.town.py]);
});

test('AUDIT SCALE C11 C13: an interrupted run takes its state, and the private half leaves the disk once the service is up; the account entry answers as workerd\'s binding does - a column the row has not thrown, raw() counted once, each point stamped with its moment', async () => {
  const h = src('tools/loadHarness.mjs');
  assert.match(h, /const onSignal = \(\) => \{\s*for \(const f of fleets\) f\.stop\?\.\(\);\s*stopAll\(\);\s*if \(!o\.keep\) \{ try \{ rmSync\(state, \{ recursive: true, force: true \}\); \} catch \{[^}]*\} \}\s*process\.exit\(130\);/);
  assert.match(h, /if \(!\(await healthy\(accountPort, '\/v1\/health', 180\)\)\)[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*rmSync\(acctEnv, \{ force: true \}\);/);
  const e = src('tools/loadAccountEntry.mjs');
  assert.match(e, /if \(!\(col in row\)\) throw new Error\(`D1_COLUMN_NOTFOUND/);
  assert.match(e, /if \(key === 'raw'\) return async \([^)]*\) => \{ const r = await target\.raw\(opts\); note\(sql, null\); return r; \};/);
  assert.match(e, /points\.push\(\{ \.\.\.p, t: Date\.now\(\) \}\)/);
});

// ═══ D. THE LAWS NO PIN HELD (lane D's surviving mutants) ═══════════════════════════════════════════════════════════

test('AUDIT SCALE D9: the guarded reads\' probes each a whole question - an order past its days expired on the market\'s read, a listing whose end is now expired (`<=`, as the update), a commission whose crafter is gone declined and one past its days expired on its CRAFTER\'s read too', async () => {
  clock(T0);
  const svc = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const DF = 17, HUBS = { [DF]: [207, 212] };
  const a = await svc.registered('Prober', { renown: 10 });
  const b = await svc.registered('Crafter', { renown: 10 });
  svc.seedMarks(a, 100_000, 'a');
  const market = () => svc.call('/v1/market/read', { character: a.character, region: DF, view: 'materials', hubs: HUBS }, a.secret);
  // an order past its days - no listing of the account's due
  raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
    VALUES ('O1', ?, ?, ?, 'ore:iron', 5, 5, 3, 15, ?, ?, 'rO1', 'n')`).run(a.id, a.character, DF, T0 - 4 * DAY, T0 - 1);
  assert.equal((await market()).status, 200);
  assert.equal(raw.prepare("SELECT state FROM market_orders WHERE id = 'O1'").get().state, 'expired');
  // a listing whose end is this very second
  raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n)
    VALUES ('L1', ?, ?, ?, 'material', 'ore:iron', 5, 5, 3, 1, ?, ?, 'rL1', 'n')`).run(a.id, a.character, DF, T0 - 4 * DAY, T0);
  assert.equal((await market()).status, 200);
  assert.equal(raw.prepare("SELECT state FROM market_listings WHERE id = 'L1'").get().state, 'expired');
  // a commission whose crafter is gone: declined on the poster's Work read
  raw.prepare(`INSERT INTO commissions (id, poster, poster_char, crafter, region, recipe, pay, at, expires_at, rid, n)
    VALUES ('C1', ?, ?, NULL, ?, 'longsword:mithril', 900, ?, ?, 'rC1', 'n')`).run(a.id, a.character, DF, T0 - DAY, T0 + 4 * DAY);
  assert.equal((await svc.call('/v1/writs/list', { character: a.character, region: DF }, a.secret)).status, 200);
  assert.equal(raw.prepare("SELECT state FROM commissions WHERE id = 'C1'").get().state, 'declined');
  // one naming the crafter, past its days: expired on the CRAFTER's read
  raw.prepare(`INSERT INTO commissions (id, poster, poster_char, crafter, region, recipe, pay, at, expires_at, rid, n)
    VALUES ('C2', ?, ?, ?, ?, 'longsword:mithril', 900, ?, ?, 'rC2', 'n')`).run(a.id, a.character, b.id, DF, T0 - 4 * DAY, T0 - 1);
  assert.equal((await svc.call('/v1/writs/list', { character: b.character, region: DF }, b.secret)).status, 200);
  assert.equal(raw.prepare("SELECT state FROM commissions WHERE id = 'C2'").get().state, 'expired');
});

test('AUDIT SCALE D7: a sweep\'s backlog past one page is taken in the one hour - the board\'s notes and the harvests each a page of SWEEP_ROWS a round, asked again while a page was full', async () => {
  clock(T0);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const p = await svc.registered('Swept');
  const day = utcDay(T0);
  raw.exec('BEGIN');
  const note = raw.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, at, expires_at, rid) VALUES (?, 1, ?, 'S', 's', 'b', ?, ?, ?)`);
  const harvest = raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n, carry) VALUES (?, ?, 'herbs', ?, 'c', 'herbalism', 'herb:x', 1, 1, ?, ?, 'n', 0)`);
  for (let i = 0; i < 1500; i++) {
    note.run(`old-note-${i}`, p.id, T0 - 2 * DAY, T0 - DAY, `nr-${i}`);
    harvest.run(day - 3, `node-${i}`, p.id, (day - 3) * DAY, `hr-${i}`);
  }
  raw.exec('COMMIT');
  _resetCronForTests();
  await runCron(svc.env, { cron: CRON_HOUR, nowS: T0, rand });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM board_notes').get().n, 0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM node_harvests').get().n, 0);
});

// ═══ M. THE AUDIT'S OWN MUTATION RUN ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE M1: a record whose tests fail with no mutant is no verdict - serially and with --jobs, said so and the run failed; the records beside it judged as ever (a test file that did not parse had read twenty "dead" in place)', (t) => {
  const d = mkdtempSync(join(tmpdir(), 'auditscale-m1-'));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  writeFileSync(join(d, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(join(d, 'target.js'), 'export const a = 1;\n');
  const pin = (body) => `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from './target.js';\n${body}\n`;
  writeFileSync(join(d, 'good.test.js'), pin("test('a', () => assert.equal(a, 1));"));
  writeFileSync(join(d, 'broken.test.js'), pin("test('it's', () => assert.equal(a, 1));"));   // the apostrophe: no parse
  writeFileSync(join(d, 'list.json'), JSON.stringify([
    { name: 'm1', file: 'target.js', old: '= 1;', new: '= 2;', tests: ['good.test.js'] },
    { name: 'm2', file: 'target.js', old: '= 1;', new: '= 3;', tests: ['broken.test.js'] },
    { name: 'm3', file: 'target.js', old: '= 1;', new: '= 4;', tests: ['good.test.js', 'broken.test.js'] },
  ]));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT'));
  const mutate = fileURLToPath(new URL('../tools/mutate.mjs', import.meta.url));
  for (const args of [[], ['--jobs', '2']]) {
    const r = spawnSync(process.execPath, [mutate, ...args, 'list.json'], { cwd: d, encoding: 'utf8', env, timeout: 120_000 });
    const say = `${args.join(' ') || 'serial'}:\n${r.stdout}`;
    assert.match(r.stdout, /m1: dead \(1 failing\)/, say);
    assert.match(r.stdout, /m2: ITS TESTS FAIL UNMUTATED \(broken\.test\.js\) - not a verdict/, say);
    assert.match(r.stdout, /m3: ITS TESTS FAIL UNMUTATED \(broken\.test\.js\) - not a verdict/, say);
    assert.match(r.stdout, /1 dead, 0 survived, 0 equivalent as recorded, 0 stale records, 2 did not apply/, say);
    assert.equal(r.status, 1, say);
    assert.equal(readFileSync(join(d, 'target.js'), 'utf8'), 'export const a = 1;\n', 'the source as it was');
  }
});
