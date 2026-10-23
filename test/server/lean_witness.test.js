// LEAN-WITNESS (2026-10-19, the account database overloaded again: "D1 DB is overloaded. Requests queued for too long."
// on the harvest and the pixels; bible/11-Multiplayer/Scale-Arc.md LEAN-WITNESS; migration 0135) - A WITNESSED KEY'S
// ANSWERS READ AS FAR AS THEY CAN MATTER: the database keeps each hall's and seat's confirmation and lets every agreeing
// answer of a later second go LATE; the reads that judge (a hall witness's ignored, a region's chapters, the seats' kept
// facts) read the rows that are not late, a key an ignored account answered whole; a witness whose own answers could not
// have it ignored reads no region; a late report moves no region's version.
//
// The proof is an oracle: random answers (agreeing, dissenting, a liar's own, seconds shared and out of order), accounts
// deleted under them (the foreign key's cascade) and strikes - after each, the database's confirmation and late rows
// held to nodeLaw.js witnessedFact over every row, and the halls' and seats' laws over the rows the service judges by
// (its own reads: npcHalls.js judgedRows, townSeats.js judgedSeatRows) held to the same laws over every row (regionRows,
// SEAT_ROWS_SQL), region by region. And AUDIT LEAN-READS: every statement of the triggers finds its rows by a key's index
// range, and a key's thousands of answers deleted in one statement - a strike, the old Worker's - settle it once a
// confirmer, never once a row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1, T0 } from '../accountDb.mjs';
import { witnessedFact, factConfirmed, WITNESS } from '../../src/net/nodeLaw.js';
import { seatReportText, SEAT_WITNESS_IGNORED_S, SEAT_WITNESS_UNMATCHED_MAX } from '../../src/net/townSeatLaw.js';
import { hallReportText, parseHallReport, HALL_WITNESS_KIND } from '../../src/net/npcChapterLaw.js';
import { hallFacts, witnessHall, regionChapters, forgetChapters, listHalls, strikeHall, judgedRows, regionRows } from '../../server-account/src/npcHalls.js';
import { seatFacts, keepSeatFacts, listSeats, strikeSeat, judgedSeatRows, SEAT_ROWS_SQL, SEAT_JUDGED_SQL } from '../../server-account/src/townSeats.js';
import { LEAN_KINDS, LEAN_ROWS, LEAN_KEYS_A_STATEMENT, exactRows, keyRows, unmatchedRead, mayBeIgnored, witnessRow } from '../../server-account/src/leanWitness.js';
import { parseSeatReport } from '../../src/net/townSeatLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATION = 'server-account/migrations/0135_lean_witness.sql';
const DAY = 86_400;

/** A seeded generator (Park-Miller), so a failing seed is a failing seed again. */
const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };

/** The confirmation witnessedFact makes over `rows` - its answer and the second of its confirming row - or null. */
function confirmationOf(rows, parse) {
  const sorted = rows.filter((r) => parse(r.report)).sort((a, b) => (a.at - b.at) || (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));
  const seen = new Map();
  for (const r of sorted) {
    const s = seen.get(r.report) ?? new Set();
    s.add(r.account);
    seen.set(r.report, s);
    if (s.size >= WITNESS.confirm) return { report: r.report, at: r.at };
  }
  return null;
}

const KINDS = {
  npchall: { parse: parseHallReport, keyOf: (k) => `1:${k}`, report: (k, region, f) => hallReportText({ key: k, region, factions: [f] }) },
  seat: { parse: parseSeatReport, keyOf: (k) => String(k), report: (k, region, f) => seatReportText({ key: k, name: `Seat${f}`, region, tier: 'palace', pixel: [100 + k, 200] }) },
};

const ACCOUNTS = Array.from({ length: 14 }, (_, i) => `p-wit${String(i).padStart(2, '0')}`);
const addAccount = (raw, id) => raw.prepare('INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run(id, id);

/** Every row of a kind, and the rows that are not late. */
const rowsOf = (raw, kind, late = null) => raw.prepare(`SELECT key, account, report, at, late, region FROM world_witness WHERE kind = ?${late == null ? '' : ' AND late = 0'}`)
  .all(kind).map((r) => ({ ...witnessRow(r), late: Number(r.late), region: Number(r.region) }));

/** The database's confirmation and late rows, held to witnessedFact over every row of each key. */
function assertKept(raw, kind, label) {
  const { parse } = KINDS[kind];
  const all = rowsOf(raw, kind);
  const byKey = new Map();
  for (const r of all) { const a = byKey.get(r.key) ?? []; a.push(r); byKey.set(r.key, a); }
  const kept = new Map(raw.prepare('SELECT key, report, at FROM witness_confirmed WHERE kind = ? AND report IS NOT NULL').all(kind).map((r) => [r.key, { report: r.report, at: Number(r.at) }]));
  for (const [key, rows] of byKey) {
    const want = confirmationOf(rows, parse);
    assert.deepEqual(kept.get(key) ?? null, want, `${label}: ${kind} ${key}'s confirmation`);
    for (const r of rows) {
      const late = !!want && r.report === want.report && r.at > want.at;
      assert.equal(r.late, late ? 1 : 0, `${label}: ${kind} ${key} ${r.account}'s row late`);
    }
  }
  for (const { key, report, at } of raw.prepare('SELECT key, report, at FROM witness_confirmed WHERE kind = ?').all(kind)) {
    assert.ok(byKey.has(key), `${label}: no key's row without its rows (${kind} ${key})`);
    assert.equal(report == null, at == null, `${label}: a key confirms an answer at a second, or nothing (${kind} ${key})`);
  }
}

/** The laws over the rows the service judges by held to the laws over every row - each side the service's own read. */
async function assertJudged(db, raw, nowS, label) {
  for (const region of [21, 22]) {
    const a = hallFacts(await regionRows(db, region), nowS), b = hallFacts(await judgedRows(db, region, nowS), nowS);
    assert.deepEqual([...b.ignored].sort(), [...a.ignored].sort(), `${label}: region ${region}'s ignored`);
    const facts = (x) => x.towns.map((t) => [t.key, t.fact.state, t.fact.region ?? null, JSON.stringify(t.fact.factions ?? null)]).sort();
    assert.deepEqual(facts(b), facts(a), `${label}: region ${region}'s towns and their facts`);
  }
  const all = (await db.prepare(SEAT_ROWS_SQL).all()).results.map(witnessRow);
  const a = seatFacts(all, nowS), b = seatFacts(await judgedSeatRows(db, nowS), nowS);
  assert.deepEqual([...b.ignored].sort(), [...a.ignored].sort(), `${label}: the seats' ignored`);
  const facts = (x) => x.seats.map((s) => [s.key, s.fact.state, JSON.stringify(s.fact.seat ?? null)]).sort();
  assert.deepEqual(facts(b), facts(a), `${label}: the seats' facts`);
  return a.ignored.size + [...hallFacts(rowsOf(raw, HALL_WITNESS_KIND).map(witnessRow), nowS).ignored].length;
}

test('LEAN-WITNESS the schema: world_witness carries `late`, witness_confirmed keeps a key\'s confirmation, the triggers name the lean kinds alone and confirm at WITNESS.confirm, the judging reads\' indexes stand after every migration and hold the lean kinds\' rows that are not late alone, LEAN_ROWS their condition, and no source replaces a row the triggers keep (mutants: a kind dropped, the count moved)', () => {
  const db = d1();
  const raw = db._raw;
  assert.ok(raw.prepare('PRAGMA table_info(world_witness)').all().some((c) => c.name === 'late' && c.notnull === 1 && c.dflt_value === '0'),
    'a later rebuild of world_witness carries `late` (migration 0135\'s header)');
  const triggers = Object.fromEntries(raw.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'world_witness'").all().map((t) => [t.name, t.sql]));
  assert.deepEqual(Object.keys(triggers).sort(), ['witness_lean_fixed', 'witness_lean_in', 'witness_lean_out']);
  assert.deepEqual(raw.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'witness_confirmed' ORDER BY name").all().map((t) => t.name),
    ['witness_confirmed_moved', 'witness_confirmed_turned']);
  const kinds = `IN (${LEAN_KINDS.map((k) => `'${k}'`).join(', ')})`;
  assert.deepEqual(LEAN_KINDS, ['npchall', 'seat']);
  for (const [name, t] of Object.entries(triggers)) {
    assert.ok(t.includes(kinds), `${name} names the lean kinds`);
    if (name !== 'witness_lean_fixed') assert.ok(t.includes(`WHERE n = ${WITNESS.confirm} ORDER BY at, account LIMIT 1`), `${name} confirms at the law's count`);
  }
  const sql = src(MIGRATION);
  assert.ok(sql.includes(`WHERE kind IN ('npchall', 'seat'))\n    WHERE n = ${WITNESS.confirm})`), 'the backfill too');
  assert.equal(WITNESS.confirm, 3);
  const indexes = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'world_witness'").all().map((r) => r.name);
  for (const i of ['idx_world_witness_lean_region', 'idx_world_witness_lean_key', 'idx_world_witness_late', 'idx_world_witness_account']) assert.ok(indexes.includes(i), i);
  assert.equal(LEAN_ROWS, "kind IN ('npchall', 'seat') AND late = 0");
  for (const i of ['idx_world_witness_lean_region', 'idx_world_witness_lean_key']) {
    assert.ok(raw.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(i).sql.endsWith(`WHERE ${LEAN_ROWS}`), `${i}: the lean kinds' rows that are not late alone (AUDIT LEAN-READS A4)`);
  }
  // AUDIT LEAN-READS B6: a replaced row's implied delete fires no trigger - no source writes one into a table they keep
  // (AUDIT LEAN-READS 2 A4: its name quoted or its schema's named too)
  const kept = ['world_witness', 'home_decor', 'homes', 'market_listings', 'market_patron_sales', 'arena_pve', 'arena_pvp', 'arena_members'];
  const replaces = new RegExp(`(?:OR\\s+REPLACE\\s+INTO|REPLACE\\s+INTO)\\s+(?:main\\.)?["'\`\\[]?(?:${kept.join('|')})\\b`, 'i');
  assert.match('INSERT OR REPLACE INTO "world_witness" (kind)', replaces);
  assert.match('REPLACE INTO main.homes VALUES (1)', replaces);
  for (const f of readdirSync(new URL('../../server-account/src', import.meta.url))) {
    if (f.endsWith('.js')) assert.doesNotMatch(src(`server-account/src/${f}`), replaces, f);
  }
  // AUDIT LEAN-READS 2 A4: the key's row made whatever the outer write's conflict policy (a policy named on the outer
  // statement is every trigger statement's: an inner OR IGNORE refused a second answer under OR ABORT, and left it in
  // unsettled under OR FAIL), and an answer is never rewritten in place - no trigger would hear it
  const ins = (policy, key, account, f, at) => raw.prepare(`INSERT ${policy} INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, 21, ?)`)
    .run(key, account, KINDS.seat.report(Number(key), 21, f), at);
  ACCOUNTS.forEach((a) => addAccount(raw, a));
  const policies = ['', 'OR ABORT', 'OR FAIL', 'OR ROLLBACK', 'OR IGNORE', 'OR REPLACE'];
  policies.forEach((policy, i) => {
    const key = String(600 + i);
    ACCOUNTS.slice(0, 5).forEach((a, j) => ins(policy, key, a, j === 3 ? 41 : 40, T0 + j));
  });
  assertKept(raw, 'seat', 'every outer policy');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM witness_confirmed WHERE kind = 'seat' AND key BETWEEN '600' AND '605' AND report IS NOT NULL").get().n, policies.length);
  assert.throws(() => raw.prepare("UPDATE world_witness SET report = 'x' WHERE kind = 'seat' AND key = '600'").run(), /never rewritten/);
  assert.throws(() => raw.prepare("UPDATE world_witness SET at = at + 1 WHERE kind = 'seat' AND key = '600' AND late = 1").run(), /never rewritten/);
  assert.throws(() => raw.prepare(`INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', '600', ?, 'y', 21, 0)
    ON CONFLICT DO UPDATE SET report = excluded.report`).run(ACCOUNTS[0]), /never rewritten/, 'an upsert\'s update too');
  raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', 'p1', ?, 'a', 21, 0)").run(ACCOUNTS[0]);
  raw.prepare("UPDATE world_witness SET report = 'b' WHERE kind = 'pixel' AND key = 'p1'").run();   // another kind's rows are none of the triggers'
  assertKept(raw, 'seat', 'after the refused rewrites');
  assert.equal(LEAN_KEYS_A_STATEMENT, 99, 'one parameter is the kind: D1 binds 100');
});

test('LEAN-WITNESS the migration\'s backfill: the answers standing when 0135 is applied are confirmed and let go late by the triggers\' own law - seconds shared, answers split, a pixel\'s rows left alone (mutants: the backfill unlate, its count moved)', () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const files = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files.filter((f) => f < '0135')) raw.exec(src(`server-account/migrations/${f}`));
  for (const a of ACCOUNTS) addAccount(raw, a);
  const ins = raw.prepare('INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  const r = lcg(424242);
  for (let i = 0; i < 600; i++) {
    const kind = r() < 0.5 ? HALL_WITNESS_KIND : 'seat';
    const k = 1 + Math.floor(r() * 6), y = r();
    ins.run(kind, KINDS[kind].keyOf(k), ACCOUNTS[Math.floor(r() * ACCOUNTS.length)], KINDS[kind].report(k, 21, y < 0.7 ? 40 : y < 0.9 ? 41 : 42), 21, T0 + Math.floor(r() * 40));
    ins.run('pixel', `${k},${i % 7}`, ACCOUNTS[i % ACCOUNTS.length], '[1,2]', 21, T0 + i);
  }
  for (const f of files.filter((f) => f >= '0135')) raw.exec(src(`server-account/migrations/${f}`));
  assertKept(raw, HALL_WITNESS_KIND, 'the backfill');
  assertKept(raw, 'seat', 'the backfill');
  assert.ok(raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE late = 1 AND kind IN ('npchall', 'seat')").get().n > 40, 'late rows stood');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'pixel' AND late = 1").get().n, 0, 'a pixel is no lean kind');
});

test('LEAN-WITNESS the oracle: through answers agreeing, dissenting and a liar\'s own, seconds shared and out of order, accounts deleted under them and strikes, the database\'s confirmation and late rows are witnessedFact\'s over every row, and the halls\' and the seats\' laws over the judged rows are their laws over every row (mutants: the confirmation moved, an earlier answer unsettled, a late row of the confirming second, a deletion unsettled, a confirmation moved later leaving its confirmers late, its earliest late rows unread, a turned answer\'s late rows kept, the judged rows never read whole)', async () => {
  const db = d1();
  const raw = db._raw;
  for (const a of ACCOUNTS) addAccount(raw, a);
  const ins = raw.prepare('INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  let ignoredSeen = 0, resettles = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = lcg(seed * 7919);
    raw.exec('DELETE FROM world_witness; DELETE FROM witness_confirmed;');
    const base = T0 + seed * 10 * DAY;
    for (let op = 0; op < 120; op++) {
      const x = r();
      if (x < 0.86) {
        const kind = r() < 0.6 ? HALL_WITNESS_KIND : 'seat';
        const k = 1 + Math.floor(r() * 4);
        const account = ACCOUNTS[Math.floor(r() * ACCOUNTS.length)];
        const liar = ACCOUNTS.indexOf(account) < 2;   // two accounts that answer alone, to be ignored
        const y = r();
        // a liar answers alone, and now and then truly - so it is among a key's confirmers when it is ignored
        const f = liar && y < 0.6 ? 400 + ACCOUNTS.indexOf(account) : y < 0.72 ? 40 : y < 0.9 ? 41 : 42;
        const region = kind === HALL_WITNESS_KIND && f === 41 && k === 2 ? 22 : 21;   // one town an answer names for another region
        // seconds shared often, and now and then before the rest (another isolate's clock)
        const at = base + (r() < 0.12 ? -Math.floor(r() * 5) : Math.floor(op / 3) + (r() < 0.3 ? 0 : 1));
        const before = raw.prepare('SELECT COUNT(*) AS n FROM witness_confirmed WHERE kind = ? AND key = ? AND at >= ?').get(kind, KINDS[kind].keyOf(k), at).n;
        ins.run(kind, KINDS[kind].keyOf(k), account, KINDS[kind].report(k, region, f), region, at);
        resettles += before;
      } else if (x < 0.95) {
        const account = ACCOUNTS[Math.floor(r() * ACCOUNTS.length)];
        raw.prepare('DELETE FROM players WHERE id = ?').run(account);   // the cascade: every answer of the account
        addAccount(raw, account);
      } else {
        const kind = r() < 0.5 ? HALL_WITNESS_KIND : 'seat';
        const key = KINDS[kind].keyOf(1 + Math.floor(r() * 4));
        raw.prepare('DELETE FROM world_witness WHERE kind = ? AND key = ?').run(kind, key);   // a strike: the key's rows, in one statement
      }
      const label = `seed ${seed} op ${op}`;
      assertKept(raw, HALL_WITNESS_KIND, label);
      assertKept(raw, 'seat', label);
      if (op % 10 === 9) ignoredSeen += await assertJudged(db, raw, base + 60, label);
    }
    ignoredSeen += await assertJudged(db, raw, base + SEAT_WITNESS_IGNORED_S - 1, `seed ${seed} a week on`);
  }
  assert.ok(ignoredSeen > 0, 'the liars were ignored somewhere - the judged rows read whole were exercised');
  assert.ok(resettles > 0, 'answers at or before a confirmation\'s second were exercised');
  const late = raw.prepare('SELECT COUNT(*) AS n FROM world_witness WHERE late = 1').get().n;
  assert.ok(late > 0, 'and late rows stood');
});

test('LEAN-WITNESS one second, two answers: the confirmation is the first answer whose third account comes first in witnessedFact\'s order - by second, then account - and an answer given in the confirming second can move it (mutants: the second\'s accounts in another order, the confirming second unsettled)', () => {
  const db = d1();
  const raw = db._raw;
  for (const a of ['a', 'b', 'c', 'd', 'm', 'n', 'y', 'z']) addAccount(raw, a);
  const ins = raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  const A = KINDS.seat.report(5, 21, 40), B = KINDS.seat.report(5, 21, 41);
  const kept = () => ({ ...raw.prepare("SELECT report, at FROM witness_confirmed WHERE kind = 'seat' AND key = '5'").get() });
  // A once before the second and twice in it (m, y); B twice before it and once in it (n): in witnessedFact's order the
  // second runs m (A's second), n (B's third) - B confirms, though A's third is in the same second
  ins.run('seat', '5', 'a', A, 21, T0 - 1);
  ins.run('seat', '5', 'b', B, 21, T0 - 1);
  ins.run('seat', '5', 'c', B, 21, T0 - 1);
  ins.run('seat', '5', 'm', A, 21, T0);
  ins.run('seat', '5', 'y', A, 21, T0);
  ins.run('seat', '5', 'n', B, 21, T0);
  const rows = rowsOf(raw, 'seat');
  assert.deepEqual(confirmationOf(rows, parseSeatReport), { report: B, at: T0 });
  assert.deepEqual(kept(), { report: B, at: T0 });
  assertKept(raw, 'seat', 'one second');
  // a later agreeing answer late; then an answer given IN the confirming second whose account comes first moves it: A
  // two in the second before, and d at the confirming second sorts before n
  raw.exec("DELETE FROM world_witness WHERE kind = 'seat'");
  ins.run('seat', '5', 'a', A, 21, T0 - 1);
  ins.run('seat', '5', 'b', A, 21, T0 - 1);
  ins.run('seat', '5', 'c', B, 21, T0 - 1);
  ins.run('seat', '5', 'm', B, 21, T0 - 1);
  ins.run('seat', '5', 'n', B, 21, T0);
  ins.run('seat', '5', 'z', B, 21, T0 + 5);
  assert.deepEqual(kept(), { report: B, at: T0 });
  assert.equal(raw.prepare("SELECT late FROM world_witness WHERE kind = 'seat' AND account = 'z'").get().late, 1);
  ins.run('seat', '5', 'd', A, 21, T0);
  assert.deepEqual(kept(), { report: A, at: T0 }, 'd comes before n in the second: A\'s third first');
  assert.equal(raw.prepare("SELECT late FROM world_witness WHERE kind = 'seat' AND account = 'z'").get().late, 0, 'and B\'s later answer is a dissent now, never late');
  assertKept(raw, 'seat', 'the confirming second');
});

test('LEAN-WITNESS an ignored account among a town\'s confirmers: the town is judged over every row - the late fourth confirms it once the liar is left out, where its rows that are not late would leave it unconfirmed (mutant: the judged rows never read whole)', async () => {
  const db = d1();
  const raw = db._raw;
  for (const a of ['liar', 'a', 'b', 'c', 'd']) addAccount(raw, a);
  const ins = raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  const R = (k, f) => hallReportText({ key: k, region: 21, factions: [f] });
  // three towns the others confirm and the liar answers alone; a fourth the liar confirms with two others, a fourth
  // account agreeing a second later - late
  for (const k of [1, 2, 3]) {
    for (const [i, a] of ['a', 'b', 'c'].entries()) ins.run('npchall', `1:${k}`, a, R(k, 40), 21, T0 + i);
    ins.run('npchall', `1:${k}`, 'liar', R(k, 409), 21, T0 + 10 + k);
  }
  ins.run('npchall', '1:4', 'liar', R(4, 41), 21, T0);
  ins.run('npchall', '1:4', 'a', R(4, 41), 21, T0 + 1);
  ins.run('npchall', '1:4', 'b', R(4, 41), 21, T0 + 2);
  ins.run('npchall', '1:4', 'd', R(4, 41), 21, T0 + 20);
  assert.equal(raw.prepare("SELECT late FROM world_witness WHERE key = '1:4' AND account = 'd'").get().late, 1);
  const nowS = T0 + 60;
  assert.ok(hallFacts(rowsOf(raw, HALL_WITNESS_KIND).map(witnessRow), nowS).ignored.has('liar'));
  const lean = rowsOf(raw, HALL_WITNESS_KIND, 0).map(witnessRow);
  assert.equal(hallFacts(lean, nowS).towns.find((t) => t.key === '1:4').fact.state, 'unconfirmed', 'its rows that are not late, the liar left out: two');
  const judged = await exactRows(db, HALL_WITNESS_KIND, lean, (rows) => hallFacts(rows, nowS).ignored);
  assert.equal(hallFacts(judged, nowS).towns.find((t) => t.key === '1:4').fact.state, 'confirmed', 'read whole: the late fourth confirms it');
  await assertJudged(db, raw, nowS, 'the liar a confirmer');
});

/** A registered, week-old account as the service reads one, and its row. */
const witness = (raw, id, nowS) => {
  raw.prepare('INSERT INTO players (id, guest_name, handle, created_at, last_seen, registered_at) VALUES (?, ?, ?, 0, 0, ?)').run(id, id, id, nowS - 8 * DAY);
  return { id, handle: id, registered_at: nowS - 8 * DAY };
};
const ENV = { CHAPTERS_OPEN: 'on', SEATS_OPEN: 'on', DEVELOPER_HANDLES: 'devra' };
/** A database whose statements are recorded as they are prepared. */
const counted = (db) => {
  const seen = [];
  const out = Object.create(db);
  out.prepare = (sql) => { seen.push(sql); return db.prepare(sql); };
  out.batch = (list) => db.batch(list);
  return { db: out, seen };
};
const REGION_READ = /late = 0 AND region = \?/;

test('LEAN-WITNESS a hall witness reads no region unless its own answers could have it ignored; a report that lands late moves no region\'s version and keeps the isolate\'s chapters; a liar\'s fourth answer still reads the region and is ignored (mutants: the account\'s count unread, the threshold off by one, the window halved, the late report moving the version)', async () => {
  const base = d1();
  const raw = base._raw;
  forgetChapters();
  let nowS = T0;
  const town = { key: 700, region: 21, factions: [40] };
  const wits = Array.from({ length: 4 }, (_, i) => witness(raw, `wit${i}`, nowS));
  for (const w of wits.slice(0, 3)) {
    nowS += 1;
    assert.deepEqual(await witnessHall({ db: base, nowS }, w, ENV, { hall: town }), { ok: true, counted: true });
  }
  assert.deepEqual(await regionChapters(base, 21, nowS * 1000), [40]);
  const ver = () => raw.prepare('SELECT ver FROM npc_hall_regions WHERE region = 21').get().ver;
  const v0 = ver();
  nowS += 5;
  const c = counted(base);
  assert.deepEqual(await witnessHall({ db: c.db, nowS }, wits[3], ENV, { hall: town }), { ok: true, counted: true });
  assert.equal(c.seen.filter((s) => REGION_READ.test(s)).length, 0, 'no region read: the account answered nothing against a confirmation');
  assert.equal(raw.prepare("SELECT late FROM world_witness WHERE kind = 'npchall' AND account = 'wit3'").get().late, 1, 'the fourth agreeing answer lands late');
  assert.equal(ver(), v0, 'and moves no version');
  // a liar: three towns confirmed, its own answer against each - its fourth report reads the region and is ignored
  const liar = witness(raw, 'liar', nowS);
  const towns = [701, 702, 703].map((key) => ({ key, region: 21, factions: [41] }));
  for (const t of towns) for (const w of wits.slice(0, 3)) { nowS += 1; await witnessHall({ db: base, nowS }, w, ENV, { hall: t }); }
  for (const t of towns) { nowS += 1; assert.deepEqual(await witnessHall({ db: base, nowS }, liar, ENV, { hall: { ...t, factions: [409] } }), { ok: true, counted: true }); }
  assert.equal(Number((await unmatchedRead(base, 'npchall', 'liar', nowS).first()).n), SEAT_WITNESS_UNMATCHED_MAX);
  assert.equal(await mayBeIgnored(base, 'npchall', 'liar', nowS), true);
  const c2 = counted(base);
  nowS += 1;
  assert.deepEqual(await witnessHall({ db: c2.db, nowS }, liar, ENV, { hall: { key: 704, region: 21, factions: [40] } }), { ok: true, counted: false, why: 'ignored' });
  assert.equal(c2.seen.filter((s) => REGION_READ.test(s)).length, 1, 'the region read, once');
  // the window: answers older than twice the week cannot ignore it, and are not counted
  assert.equal(await mayBeIgnored(base, 'npchall', 'liar', nowS + 2 * SEAT_WITNESS_IGNORED_S), false);
  assert.equal(await mayBeIgnored(base, 'npchall', 'liar', nowS - 3 + 2 * SEAT_WITNESS_IGNORED_S - 1), true, 'the oldest of the three still inside twice the week');
  assert.equal(await mayBeIgnored(base, 'npchall', 'wit3', nowS), false);
  // the developers' audit list still counts every witness, late or not
  const dev = witness(raw, 'devra', nowS);
  const listed = await listHalls({ db: base, nowS }, dev, ENV, { region: 21 });
  assert.equal(listed.towns.find((t) => t.key === 700).witnesses, 4, 'the audit counts the late answer too');
  assert.equal(listed.towns.find((t) => t.key === 700).audit, false, 'a fourth joined: off the audit');
});

test('LEAN-WITNESS the judging reads use the lean indexes - a region\'s towns and a key\'s rows that are not late, an account\'s own answers - and the seats\' clock reads the judged rows while a developer\'s list reads every row (mutants: the late test dropped from a read, the clock reading every row, the developer\'s list judged)', async () => {
  const db = d1();
  const raw = db._raw;
  const plan = (sql, ...a) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...a).map((r) => r.detail).join(' | ');
  const hallSql = src('server-account/src/npcHalls.js').match(/async function judgedRows[\s\S]*?db\.prepare\(`([\s\S]*?)`\)/)[1].replaceAll('${HALL_WITNESS_KIND}', HALL_WITNESS_KIND).replaceAll('${LEAN_ROWS}', LEAN_ROWS);
  const p = plan(hallSql, 21, '1:%');
  assert.match(p, /idx_world_witness_lean_key/);
  assert.match(p, /idx_world_witness_lean_region/);
  assert.match(plan(SEAT_JUDGED_SQL), /idx_world_witness_lean_key/);
  const { sql } = unmatchedRead({ prepare: (s) => ({ bind: () => ({ sql: s }) }) }, 'npchall', 'a', T0);
  assert.match(plan(sql.replace('?2', "'a'").replace('?1', "'npchall'").replace('?3', '0')), /idx_world_witness_account/);
  // who reads which
  const c = counted(db);
  await keepSeatFacts(c.db, T0);
  assert.ok(c.seen.includes(SEAT_JUDGED_SQL) && !c.seen.includes(SEAT_ROWS_SQL), 'the clock: the judged rows');
  const dev = witness(raw, 'devra', T0);
  const c2 = counted(db);
  await listSeats({ db: c2.db, nowS: T0 }, dev, ENV);
  assert.ok(c2.seen.includes(SEAT_ROWS_SQL), 'a developer\'s list: every row - its audit counts every witness');
  const rows = await keyRows(db, 'seat', Array.from({ length: 150 }, (_, i) => String(i)));
  assert.deepEqual(rows, [], 'past one statement\'s bound, in parts');
});

test('LEAN-WITNESS a key\'s answers deleted in one statement - a strike, the old Worker\'s or the new, a hall\'s and a seat\'s - settle it a confirmer at a time, never a row at a time, and take its confirmation with them (AUDIT LEAN-READS A2/D1, A5: 1,516 rows rewrote 3.6 million; mutants: every deletion settling the key whole, the key\'s row kept)', async () => {
  const db = d1();
  const raw = db._raw;
  const N = 400;
  const nowS = T0;
  const ins = raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  const fill = (kind, key, k) => {
    for (let i = 0; i < N; i++) {
      const id = `w${String(i).padStart(4, '0')}`;
      addAccount(raw, id);
      ins.run(kind, key, id, KINDS[kind].report(k, 21, i % 50 === 7 ? 41 : 40), 21, nowS + i);   // eight dissents among them
    }
  };
  const total = () => raw.prepare('SELECT total_changes() AS n').get().n;
  const dev = witness(raw, 'devra', nowS);
  fill('npchall', '1:900', 900);
  fill('seat', '900', 900);
  fill('seat', '901', 901);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE late = 1").get().n, 3 * (N - 3 - 8), 'every agreeing answer after the third late');
  let t = total();
  assert.equal((await strikeHall({ db, nowS }, dev, ENV, { key: 900 })).reports, N);
  assert.ok(total() - t < 4 * N, `a hall's ${N} answers struck: ${total() - t} rows written - a confirmer at a time, a few rows each`);
  t = total();
  assert.equal((await strikeSeat({ db, nowS }, dev, ENV, { key: 900 })).reports, N);
  assert.ok(total() - t < 4 * N + 50, `a seat's: ${total() - t}`);
  t = total();
  raw.prepare("DELETE FROM world_witness WHERE kind = 'seat' AND key LIKE ?").run('901');   // the old Worker's strike: no step before
  assert.ok(total() - t < 4 * N, `the old Worker's delete: ${total() - t}`);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM witness_confirmed').get().n, 0, 'and every key\'s row gone with its rows');
});

/** Each statement of a trigger, its row's values named as a statement's parameters - for its plan. */
function triggerStatements(raw, name) {
  const sql = raw.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(name).sql;
  const body = sql.slice(sql.indexOf('BEGIN') + 5, sql.lastIndexOf('END'));
  return body.split(';').map((x) => x.trim()).filter(Boolean)
    .map((x) => x.replace(/\b(?:NEW|OLD)\.(kind|key|account|report|at)\b/g, (_, c) => ({ kind: "'seat'", key: "'5'", account: "'a'", report: "'r'", at: '0' })[c]));
}

test('LEAN-WITNESS every statement of the triggers finds its rows by a key\'s index range - a late answer by its own and its key\'s primary keys, a settle by the key\'s rows that are not late and its earliest late ones - and never walks a kind; the bump finds its town\'s rows by their key (AUDIT LEAN-READS A1/A3; mutants: a read on its kind alone, the late index unread)', () => {
  const raw = d1()._raw;
  const plan = (sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
  const names = ['witness_lean_in', 'witness_lean_out', 'witness_confirmed_moved', 'witness_confirmed_turned'];
  let searched = 0;
  for (const name of names) {
    for (const st of triggerStatements(raw, name)) {
      const p = plan(st);
      assert.doesNotMatch(p, /SCAN world_witness|SCAN witness_confirmed/, `${name}: ${st.slice(0, 60)} - ${p}`);
      for (const step of p.split(' | ').filter((x) => /SEARCH (world_witness|witness_confirmed|w|c) /.test(x))) {
        if (/^SEARCH world_witness USING INTEGER PRIMARY KEY \(rowid=\?\)$/.test(step) && st.includes('WHERE rowid IN (SELECT rowid FROM world_witness INDEXED BY')) continue;   // the rows its named read found
        assert.match(step, /key=\?/, `${name}: a key's rows, not a kind's - ${step}`);
        searched++;
      }
    }
  }
  assert.ok(searched >= 10);
  const [settle] = triggerStatements(raw, 'witness_lean_out');
  assert.match(plan(settle), /idx_world_witness_lean_key \(kind=\? AND key=\?\)/);
  assert.match(plan(settle), /idx_world_witness_late \(kind=\? AND key=\?\)/);
  const [, , self] = triggerStatements(raw, 'witness_lean_in');
  assert.match(plan(self), /sqlite_autoindex_world_witness_1 \(kind=\? AND key=\? AND account=\?\)/, 'a late answer: its own row');
  const bump = src('server-account/src/npcHalls.js').match(/const bumpRegions = [\s\S]*?db\.prepare\(\s*`([\s\S]*?)`\)/)[1]
    .replaceAll('${HALL_WITNESS_KIND}', HALL_WITNESS_KIND).replaceAll('${LEAN_ROWS}', LEAN_ROWS).replace('${keySql}', 'key = ?1').replace('${guard}', 'changes() > 0');
  assert.match(plan(bump), /SEARCH world_witness USING (?:COVERING )?INDEX sqlite_autoindex_world_witness_1 \(kind=\? AND key=\?\)/, 'the bump: its town\'s rows (HALL-PLAN)');
});

test('LEAN-WITNESS with ANALYZE\'s statistics the triggers\' reads keep their indexes - where the planner, told pixels make a key three rows, takes the table\'s key index over both partial ones and every settle walks its key (AUDIT LEAN-READS 2 A3: a 10,000-row town\'s strike 0.2 s to 12 s; mutants: a settle\'s index unnamed, a moved row\'s)', () => {
  const raw = d1()._raw;
  ACCOUNTS.forEach((a) => addAccount(raw, a));
  Array.from({ length: 60 }, (_, i) => addAccount(raw, `x${i}`));
  const ins = raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, 21, ?)');
  raw.exec('BEGIN');
  for (let k = 0; k < 20_000; k++) ins.run('pixel', `p${k}`, ACCOUNTS[k % ACCOUNTS.length], 'g', T0);   // the day's shape: pixels, a key a row or so
  for (let k = 0; k < 100; k++) for (let j = 0; j < 27; j++) ins.run('seat', String(k), `x${(k + j) % 60}`, KINDS.seat.report(k, 21, 40), T0 + j);   // and seats of 27 answers
  for (let k = 0; k < 300; k++) for (let j = 0; j < 19; j++) ins.run('npchall', `1:${k}`, `x${(k + j) % 60}`, KINDS.npchall.report(k, 21, 40), T0 + j);   // and towns of 19
  raw.exec('COMMIT');
  raw.exec('ANALYZE');
  assert.ok(raw.prepare('SELECT COUNT(*) AS n FROM sqlite_stat1').get().n > 0);
  const plan = (sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
  const unnamed = (st) => st.replace(/ INDEXED BY idx_world_witness_\w+/g, '');
  // every row of the key read (a covering probe is the last answer's EXISTS; with its account, a row's own lookup)
  const KEY_WALK = /USING INDEX sqlite_autoindex_world_witness_1 \(kind=\? AND key=\?\)/;
  // the control: the same reads unnamed walk the key under these statistics - a settle's, a moved row's, a turned one's
  for (const [name, i] of [['witness_lean_in', 1], ['witness_lean_out', 0], ['witness_confirmed_moved', 1], ['witness_confirmed_turned', 0]]) {
    assert.match(plan(unnamed(triggerStatements(raw, name)[i])), KEY_WALK, `the statistics turn ${name}'s read unnamed`);
  }
  for (const name of ['witness_lean_in', 'witness_lean_out', 'witness_confirmed_moved', 'witness_confirmed_turned']) {
    for (const st of triggerStatements(raw, name)) {
      const p = plan(st);
      assert.doesNotMatch(p, /SCAN world_witness/, `${name}: ${p}`);
      assert.doesNotMatch(p, KEY_WALK, `${name}: its named index, not the key's every row - ${p}`);
    }
  }
  // and the service's own reads of the lean rows: a region's towns, the seats', a town's confirmers on a late report
  const hallSql = src('server-account/src/npcHalls.js').match(/async function judgedRows[\s\S]*?db\.prepare\(`([\s\S]*?)`\)/)[1].replaceAll('${HALL_WITNESS_KIND}', HALL_WITNESS_KIND).replaceAll('${LEAN_ROWS}', LEAN_ROWS);
  assert.match(plan(unnamed(hallSql).replace('?', '21').replace('?', "'1:%'")), KEY_WALK, 'the statistics turn the towns\' rows unnamed');
  const reads = { hall: hallSql.replace('?', '21').replace('?', "'1:%'"), seats: SEAT_JUDGED_SQL,
    confirmers: src('server-account/src/npcHalls.js').match(/const CONFIRMER_MAY_BE_IGNORED = `EXISTS \(SELECT 1 FROM \((SELECT[^)]*?)\) w/)[1]
      .replaceAll('${HALL_WITNESS_KIND}', HALL_WITNESS_KIND).replaceAll('${LEAN_ROWS}', LEAN_ROWS).replace('?1', "'1:5'") };
  for (const [what, sql] of Object.entries(reads)) {
    const p = plan(sql);
    assert.doesNotMatch(p, KEY_WALK, `${what}: ${p}`);
    assert.match(p, /idx_world_witness_lean_(key|region)/, `${what}: the lean rows by their index - ${p}`);
  }
  const named = (name) => triggerStatements(raw, name).join(' ').match(/INDEXED BY idx_world_witness_\w+/g)?.length ?? 0;
  assert.equal(named('witness_lean_in'), 3, 'the settle\'s three reads');
  assert.equal(named('witness_lean_out'), 3);
  assert.equal(named('witness_confirmed_moved'), 2);
  assert.equal(named('witness_confirmed_turned'), 1);
});

test('LEAN-WITNESS a strike of a key whose answers lie interleaved - split between two, or disputed - deletes each row once and writes none: the late rows, then the confirmation emptied, then the rest (AUDIT LEAN-READS 2 A1/D1: one DELETE turned the confirmation over at each confirmer, 1,516 rows wrote 1.1 million; mutants: the late rows not first, the confirmation not emptied)', async () => {
  const db = d1();
  const raw = db._raw;
  const nowS = T0;
  const ins = raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)');
  const N = 600;
  const ids = Array.from({ length: N }, (_, i) => `s${String(i).padStart(4, '0')}`);
  ids.forEach((id) => addAccount(raw, id));
  const shapes = {
    split: (i) => (i % 2 ? 41 : 40),   // two answers, turn and turn about, as a client version's split would
    disputed: (i) => (i < N / 2 ? 40 : 41),   // one answer's rows, then the other's
    late: (i) => (i < 3 ? 40 : i < 6 ? 41 : 40),   // a confirmation with a dissent among its late rows
  };
  const fill = (kind, key, k, shape) => ids.forEach((id, i) => ins.run(kind, key, id, KINDS[kind].report(k, 21, shape(i)), 21, nowS + i));
  const total = () => raw.prepare('SELECT total_changes() AS n').get().n;
  const dev = witness(raw, 'devra', nowS);
  let k = 50;
  for (const [label, shape] of Object.entries(shapes)) {
    k++;
    fill('npchall', `1:${k}`, k, shape);
    fill('seat', String(k), k, shape);
    assertKept(raw, 'seat', label);
    let t = total();
    assert.equal((await strikeHall({ db, nowS }, dev, ENV, { key: k })).reports, N, `${label}: every answer struck`);
    const hall = total() - t;
    t = total();
    assert.equal((await strikeSeat({ db, nowS }, dev, ENV, { key: k })).reports, N);
    const seat = total() - t;
    // each answer deleted once, the confirmation emptied and gone, the strike and the region's word: nothing rewritten
    assert.ok(hall <= N + 6, `${label}: a hall's ${N} answers struck wrote ${hall} rows`);
    assert.ok(seat <= N + 8, `${label}: a seat's wrote ${seat}`);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE key IN (?, ?)").get(`1:${k}`, String(k)).n, 0);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM witness_confirmed WHERE key IN (?, ?)").get(`1:${k}`, String(k)).n, 0, `${label}: and the keys' rows`);
  }
});

test('LEAN-WITNESS a late report whose town rests on a confirmer the law may leave out moves the region\'s version - the law\'s confirmation then rests on it (AUDIT LEAN-READS 2 A2: the region\'s chapters stayed without its faction until another report came; mutants: the confirmers unasked, a dissent asked for a confirmer)', async () => {
  const db = d1();
  const raw = db._raw;
  forgetChapters();
  let nowS = T0;
  const [liar, a, b, c, x, y, z] = ['liar', 'a', 'b', 'c', 'x', 'y', 'z'].map((id) => witness(raw, id, nowS));
  const hall = (key, f) => ({ key, region: 21, factions: [f] });
  const say = async (who, h) => { nowS += 1; return witnessHall({ db, nowS }, who, ENV, { hall: h }); };
  for (const w of [liar, a, b]) await say(w, hall(800, 40));   // the liar one of town 800's three
  for (const t of [801, 802, 803]) for (const w of [x, y, z]) await say(w, hall(t, 41));
  for (const t of [801, 802, 803]) await say(liar, hall(t, 409));   // its own answer against three confirmed towns: ignored
  assert.equal(await mayBeIgnored(db, 'npchall', 'liar', nowS), true);
  forgetChapters();
  assert.deepEqual(await regionChapters(db, 21, nowS * 1000), [41], 'town 800 unconfirmed under the law: the liar left out');
  const ver = () => raw.prepare('SELECT ver FROM npc_hall_regions WHERE region = 21').get().ver;
  const v0 = ver();
  assert.deepEqual(await say(c, hall(800, 40)), { ok: true, counted: true });
  assert.equal(raw.prepare("SELECT late FROM world_witness WHERE kind = 'npchall' AND key = '1:800' AND account = 'c'").get().late, 1, 'late by the database\'s confirmation');
  assert.equal(ver(), v0 + 1, 'and the region told: its law confirms town 800 on it');
  forgetChapters();
  assert.deepEqual(await regionChapters(db, 21, nowS * 1000 + 61_000), [40, 41], 'the chapters counted again');
  // a late report whose town's confirmers none may be ignored moves nothing - a liar's dissent among its rows or not
  await say(liar, hall(801, 409));   // ignored: not counted
  const w = witness(raw, 'w4', nowS);
  const v1 = ver();
  assert.deepEqual(await say(w, hall(801, 41)), { ok: true, counted: true });
  assert.equal(ver(), v1, 'town 801 rests on x, y and z: the liar\'s dissent is no confirmer');
});
