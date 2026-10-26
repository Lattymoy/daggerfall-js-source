// D1-LOAD (2026-10-11, from play: the account service stayed slow after SEAT-CAP and SEAT-LEASE; the owner: "do
// whatever is the most detailed. I dont want band aid fixes") - WHAT IS FILLING THE ONE DATABASE, READ BY THE OPERATOR:
// tools/d1Load.mjs builds the Analytics Engine questions over the service's own metrics points (metrics.js) and
// .github/workflows/d1-load.yml asks them by hand, beside D1's query insights, writing nothing.
// bible/01-Overview/bugs/Field-Bugs-2026-10-11h.md D1-LOAD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATASET, HOURS_MAX, QUESTIONS, loadHours, loadSql, loadTable } from '../../tools/d1Load.mjs';
import { standService, T0 } from '../accountDb.mjs';
import { confirmedSeats, SEAT_ROWS_KEPT_S, SEAT_ROWS_SQL, SEAT_JUDGED_SQL } from '../../server-account/src/townSeats.js';
import { HOT_TABLES, tablesBlob } from '../../server-account/src/metrics.js';
import { titheAt } from '../../server-account/src/seatHolding.js';
import { settleWeek, settleDueOnce } from '../../server-account/src/seatTurning.js';
import { seatReportText, seatWeekOf, seatWeekStartMs } from '../../src/net/townSeatLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('D1-LOAD the questions: each over the service\'s own dataset and window, every count and sum weighted by the sample, the D1 wait (double5) in seconds most first, the minute row, the clock\'s jobs, the errors, the rows written by route and tables (COST-0: blob5 the tables a request wrote, double8-11 the hot tables\' own); the window whole hours 1 to a week, anything else refused before it reaches the SQL; an answer drawn as its columns, none said so, a refusal thrown (mutants: the weight; the wait\'s double; the order; the window\'s guard; the empty answer; the tables\' blob; a hot table\'s double; the written rows\' order; the points that wrote)', () => {
  assert.equal(DATASET, src('server-account/wrangler.toml').match(/\[\[analytics_engine_datasets\]\]\nbinding = "METRICS"\ndataset = "(\w+)"/)[1], 'the dataset the service writes');
  assert.deepEqual(QUESTIONS.map(([n]) => n), ['routes', 'minutes', 'cron', 'errors', 'written']);
  for (const [name] of QUESTIONS) {
    const sql = loadSql(name, 3);
    assert.match(sql, new RegExp(`FROM ${DATASET} WHERE timestamp > NOW\\(\\) - INTERVAL '3' HOUR`));
    assert.match(sql, / FORMAT JSON$/);
    for (const [sum] of sql.matchAll(/SUM\(.*? AS \w+/g)) assert.match(sum, /_sample_interval/, `${name}: ${sum} weighted by the sample`);
  }
  const routes = loadSql('routes', 1);
  assert.match(routes, /SUM\(double5 \* _sample_interval\) \/ 1000 AS d1_wait_s/, 'the D1 wait is double5, in seconds');
  assert.match(routes, /SUM\(double3 \* _sample_interval\) AS statements/);
  assert.match(routes, /ORDER BY d1_wait_s DESC/);
  assert.match(loadSql('minutes', 1), /toStartOfInterval\(timestamp, INTERVAL '1' MINUTE\) AS minute/);
  assert.match(loadSql('cron', 1), /AND blob2 = 'CRON'/, 'the clock\'s points (cron.js: `CRON` its method)');
  assert.match(loadSql('errors', 1), /NOT startsWith\(blob3, '2'\)/);
  // COST-0: the rows written - blob5 the tables a request wrote (metrics.js tablesBlob), each hot table its own double in
  // HOT_TABLES' order (metrics.js writes them after its seven), weighted, over the points that wrote, the most first
  const written = loadSql('written', 2);
  assert.ok(written.startsWith('SELECT blob1 AS route, blob5 AS tables, SUM(_sample_interval) AS requests, SUM(double4 * _sample_interval) AS rows_written, '), written);
  HOT_TABLES.forEach((t, i) => assert.ok(written.includes(`SUM(double${8 + i} * _sample_interval) AS ${t}`), `${t} is double${8 + i}`));
  assert.ok(written.endsWith("WHERE timestamp > NOW() - INTERVAL '2' HOUR AND double4 > 0 GROUP BY route, tables ORDER BY rows_written DESC LIMIT 40 FORMAT JSON"), written);
  assert.deepEqual([...written.matchAll(/ AS (\w+)/g)].map((x) => x[1]), QUESTIONS.find(([n]) => n === 'written')[2], 'its columns are what it selects');
  assert.equal(tablesBlob({ sessions: 1, players: 3 }), 'players:3 sessions:1', 'blob5 as metrics.js writes it');
  assert.equal(loadHours(''), 1);
  assert.equal(loadHours(' 24 '), 24);
  assert.equal(loadHours(String(HOURS_MAX)), HOURS_MAX);
  for (const bad of ['0', String(HOURS_MAX + 1), '1.5', '-1', "1' HOUR; --", 'x']) assert.throws(() => loadSql('routes', bad), /not a window/, bad);
  assert.throws(() => loadSql('nope', 1), /no question/);
  const t = loadTable('routes', { data: [{ route: '/v1/heartbeat', method: 'POST', requests: '1200', d1_wait_s: '340.55', statements: 4800, rows_read: 0, rows_written: 2, p95_ms: 812.33 }] });
  assert.match(t, /\| route \| method \| requests \| d1_wait_s \| statements \| rows_read \| rows_written \| p95_ms \|/);
  assert.match(t, /\| \/v1\/heartbeat \| POST \| 1,200 \| 340\.6 \| 4,800 \| 0 \| 2 \| 812\.3 \|/);
  assert.match(loadTable('cron', { data: [] }), /No points in the window\./);
  assert.throws(() => loadTable('routes', { errors: [{ message: 'Authentication error' }] }), /carries no rows/);
});

/** A step's `run:` block, as the runner sees it. */
function stepRun(yml, stepName) {
  const at = yml.indexOf(`- name: ${stepName}\n`);
  assert.ok(at >= 0, `no step named "${stepName}"`);
  const from = yml.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const l of yml.slice(from).split('\n')) {
    if (l.trim() && !l.startsWith('          ')) break;
    lines.push(l.slice(10));
  }
  return lines.join('\n');
}

test('D1-LOAD the workflow: run by hand only, its two inputs each read once as environment, its own queue, writing nothing; its insights step ranks the statements as the choice input asks (COST-0: time, reads or writes) and hands wrangler no other; its metrics step, run here as the runner runs it over the SQL API\'s answers, draws every question into the summary and warns - never fails - on a refusal (mutants: the input spliced into a run line; a refusal drawn as a table; the ranking fixed; the ranking unguarded)', () => {
  const wf = src('.github/workflows/d1-load.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 2, 'the two inputs, each read once');
  assert.match(wf, /\n {6}HOURS: \$\{\{ inputs\.hours \}\}\n/);
  assert.match(wf, /\n {6}SORT_BY: \$\{\{ inputs\.sort_by \}\}\n/);
  assert.match(wf, /\n {6}sort_by:\n(?: {8}.*\n)*? {8}type: choice\n {8}options:\n {10}- time\n {10}- reads\n {10}- writes\n/, 'COST-0: the ranking a choice of three');
  assert.match(wf, /\nconcurrency:\n {2}group: d1-load\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(wf, /d1 create|migrations apply|wrangler deploy|d1 execute/, 'it creates, migrates, deploys and executes nothing');
  assert.match(stepRun(wf, 'Read D1\'s query insights'), /\$WRANGLER d1 insights "\$DB_NAME" --sort-type sum --sort-by "\$sort"/);

  // COST-0: THE INSIGHTS STEP, run by bash over a wrangler that keeps its arguments and is refused (so no jq is asked):
  // the ranking asked reaches it, an empty one is time's, and one the choice does not offer never reaches it
  const wdir = mkdtempSync(join(tmpdir(), 'd1insights-'));
  const fakeWrangler = join(wdir, 'wrangler');
  writeFileSync(fakeWrangler, `#!/usr/bin/env bash\necho "$*" >> "$FAKE_ARGS"\necho refused >&2\nexit 1\n`);
  chmodSync(fakeWrangler, 0o755);
  let asked = 0;
  const insights = (sortBy) => {
    const args = join(wdir, `args-${++asked}.txt`);
    writeFileSync(args, '');
    const out = execFileSync('bash', ['-c', stepRun(wf, 'Read D1\'s query insights')], {
      cwd: wdir, encoding: 'utf8',
      env: { ...process.env, WRANGLER: fakeWrangler, DB_NAME: 'db', HOURS: '2', SORT_BY: sortBy, FAKE_ARGS: args, GITHUB_STEP_SUMMARY: join(wdir, 'summary.md') },
    });
    return { out, args: readFileSync(args, 'utf8') };
  };
  assert.match(insights('reads').args, /^d1 insights db --sort-type sum --sort-by reads --limit 30 --timePeriod 1d --json\n$/);
  assert.match(insights('writes').args, /--sort-by writes /);
  assert.match(insights('').args, /--sort-by time /, 'an empty input: time');
  const bad = insights('reads; rm -rf /');
  assert.equal(bad.args, '', 'a ranking the choice does not offer never reaches wrangler');
  assert.match(bad.out, /::warning::not a ranking/);
  assert.match(insights('time').out, /::warning::wrangler d1 insights was refused/, 'a refusal a warning, never a stop');

  // THE METRICS STEP, run by bash over a curl that answers as the SQL API does - each question its own answer
  const dir = mkdtempSync(join(tmpdir(), 'd1load-'));
  const fake = join(dir, 'curl');
  writeFileSync(fake, `#!/usr/bin/env bash
out=""; data=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; --data-binary) data="$2"; shift 2;; *) shift;; esac; done
sql=$(cat "\${data#@}")
case "$sql" in *"blob2 = 'CRON'"*) cp "$FAKE_DIR/cron.json" "$out"; echo -n "$FAKE_CODE";; *) echo '{"data":[]}' > "$out"; echo -n 200;; esac
`);
  chmodSync(fake, 0o755);
  const root = new URL('../..', import.meta.url).pathname;
  const run = (cronAnswer, code) => {
    writeFileSync(join(dir, 'cron.json'), JSON.stringify(cronAnswer));
    const summary = join(dir, `summary-${code}.md`);
    writeFileSync(summary, '');
    const out = execFileSync('bash', ['-c', `set -euo pipefail\n${stepRun(wf, 'Read the service\'s metrics')}`], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir, FAKE_CODE: code, HOURS: '2', RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary, CLOUDFLARE_API_TOKEN: 'x' },
    });
    return { out, summary: readFileSync(summary, 'utf8') };
  };
  const ok = run({ data: [{ job: 'cron:seats', firings: 60, failed: 0, d1_wait_s: 1.5, statements: 60, changed: 0, p95_ms: 40 }] }, '200');
  assert.match(ok.summary, /\*\*Window: the last 2 hour\(s\)/);
  for (const [, title] of QUESTIONS) assert.ok(ok.summary.includes(`**${title}**`), title);
  assert.match(ok.summary, /\| cron:seats \| 60 \| 0 \| 1\.5 \| 60 \| 0 \| 40 \|/);
  const refused = run({ success: false, errors: [{ message: 'Authentication error' }] }, '403');
  assert.doesNotMatch(refused.summary, /\*\*The clock's jobs\*\*/, 'a refusal is never drawn as a table');
  assert.match(refused.out, /::warning::the cron question was refused \(HTTP 403\)/);
  assert.match(refused.summary, /\*\*Minute by minute\*\*/, 'the other questions still answer');
  // AUDIT PLAN-1000 A7 (relay-load.yml's twin): a refusal whose body carries rows is still a refusal - never drawn
  const odd = run({ data: [{ job: 'cron:odd', firings: 1, failed: 0, d1_wait_s: 1, statements: 1, changed: 0, p95_ms: 1 }] }, '500');
  assert.doesNotMatch(odd.summary, /\| cron:odd \|/, 'an HTTP 500 is never drawn, whatever its body');
});

const ENV = { SEATS_OPEN: 'on' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const seatRead = (sql) => sql === SEAT_ROWS_SQL || sql === SEAT_JUDGED_SQL;   // LEAN-WITNESS (PIN MOVED): the rows the law judges by are a read of them
/** The service with Anticlere confirmed and held by a guild, its seat witness reads counted (`c.n`). */
async function heldSeat() {
  const svc = await standService(ENV);
  const raw = svc.env.DB._raw;
  for (const w of [await svc.guest(), await svc.guest(), await svc.guest()]) {
    raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - 86400);
  }
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'Holders', 'holders', 'HO', '[]', 1)").run();
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, tithe, at) VALUES (?, 'g1', ?, 'palace', 1, 50, 5, 1)").run(ANTICLERE.key, ANTICLERE.region);
  const base = svc.env.DB;
  const c = { n: 0, sql: [] };
  const db = Object.create(base);
  db.prepare = (sql) => { if (seatRead(sql)) c.n++; c.sql.push(sql); return base.prepare(sql); };
  db.batch = (l) => base.batch(l);
  return { svc, raw, db, c };
}

test('D1-LOAD THE SEATS\' WITNESS ROWS ARE READ ONCE A MINUTE FOR EVERY CALLER: a market sale\'s Tithe in a held seat\'s region - which read all of them on every sale from the moment its first Charter was held - a standings and a pledge share the isolate\'s kept rows; a minute on, read again; the Turning reads the table as it stands (mutants: the default kept; the Turning fresh)', async () => {
  const { db, c } = await heldSeat();
  const t1 = await titheAt(db, T0, ANTICLERE.region, ANTICLERE.pixel);
  assert.deepEqual([t1?.key, t1?.guild, t1?.pct], [ANTICLERE.key, 'g1', 5], 'the Tithe is the holder\'s');
  assert.equal(c.n, 1);
  for (let i = 0; i < 20; i++) await titheAt(db, T0 + i, ANTICLERE.region, ANTICLERE.pixel);
  assert.equal((await confirmedSeats(db, T0 + 30)).has(ANTICLERE.key), true);
  assert.equal(c.n, 1, 'twenty sales and a standings inside the minute: the one read');
  await titheAt(db, T0 + SEAT_ROWS_KEPT_S, ANTICLERE.region, ANTICLERE.pixel);
  assert.equal(c.n, 2, 'a minute on: read again');
  await settleWeek(db, seatWeekOf(T0 * 1000) - 1, T0 + SEAT_ROWS_KEPT_S + 1);   // inside the minute the rows were kept
  assert.equal(c.n, 3, 'the Turning: the table as it stands, whatever this isolate kept');
});

test('D1-LOAD THE LEASE IS READ BEFORE IT IS ASKED OF THE WRITER: while another holds it, a caller that finds the week due reads the lease and answers pending with no write; one whose read raced the other\'s take (it read the lease free) is still held off by the write\'s own WHERE (mutants: the read; the WHERE)', async () => {
  const { db, raw, c } = await heldSeat();
  const W = seatWeekOf(T0 * 1000);
  const atS = Math.floor(seatWeekStartMs(W + 1) / 1000) + 60;
  raw.prepare("INSERT INTO town_seat_settling (id, holder, until) VALUES (1, 'another', ?)").run(atS + 30);
  c.sql.length = 0;
  assert.deepEqual(await settleDueOnce(db, atS), { settled: 0, pending: true });
  assert.deepEqual(c.sql.filter((q) => /^\s*(INSERT|UPDATE|DELETE)/i.test(q)), [], 'no write asked while the lease is held');
  // a racer: its read answered before the other's take landed
  const racer = Object.create(db);
  racer.prepare = (sql) => (/^SELECT until FROM town_seat_settling/.test(sql) ? { bind: () => ({ first: async () => null }), first: async () => null } : db.prepare(sql));
  racer.batch = (l) => db.batch(l);
  assert.deepEqual(await settleDueOnce(racer, atS), { settled: 0, pending: true }, 'the write\'s WHERE holds it off');
  assert.equal(raw.prepare('SELECT holder FROM town_seat_settling').get().holder, 'another', 'the lease still the other\'s');
});
