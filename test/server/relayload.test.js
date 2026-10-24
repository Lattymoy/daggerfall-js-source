// RELAY-LOAD (2026-10-18, from play: "Server is kinda breaking down near oblivion gate cause so many ppl lol") - WHAT IS
// FILLING THE RELAY, READ BY THE OPERATOR: tools/relayLoad.mjs builds the Analytics Engine questions over the relay's own
// metrics points (server/src/relayScale.js RoomMetrics) and .github/workflows/relay-load.yml asks them by hand, writing
// nothing. bible/11-Multiplayer/Scale-Arc.md RELAY-LOAD; AUDIT PLAN-1000 lane A (its block under RELAY-LOAD there, and `01-Overview/Audit-Log.md`)
// widened every pin below to reach what its title claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATASET, QUESTIONS, WINDOW_KINDS, WINDOW_HOURS_MAX, loadSql, loadTable } from '../../tools/relayLoad.mjs';
import { HOURS_MAX } from '../../tools/d1Load.mjs';
import { RoomMetrics } from '../../server/src/relayScale.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** What each alias of the questions is, as RoomMetrics writes its point: the column a sum or a value reads. */
const DOUBLE_OF = { sockets: 2, hellos: 3, busy: 4, poses: 7, sends: 8, refused: 12, room_full: 13, drops: 14, peak: 15 };

test('RELAY-LOAD the questions: each over the relay\'s own dataset and window, its columns exactly the aliases it selects, every alias the double RoomMetrics writes for it in EVERY question (a sum weighted by the sample, a row\'s value and a peak its room\'s own), the kind blob1; the kinds by their sends, the five-minute rows of the crowd\'s kinds over at most WINDOW_HOURS_MAX - every row of the span, never cut - the busiest rooms but the channels by their peak; the window whole hours 1 to a week, refused before the SQL; an answer drawn as its columns (mutants: the weight; a double moved in any question; a count unweighted; a column renamed; the IF; the orders; the limits; the span; the channels left in the crowds; the window\'s guard)', () => {
  assert.equal(DATASET, src('server/wrangler.toml').match(/\[\[analytics_engine_datasets\]\]\nbinding = "METRICS"\ndataset = "(\w+)"/)[1], 'the dataset the relay writes');
  assert.deepEqual(QUESTIONS.map(([n]) => n), ['kinds', 'windows', 'crowds', 'fulls', 'storage']);

  // THE DOUBLES ARE THE ONES ROOMMETRICS WRITES: a point flushed with every count its own value, read back by position
  let point = null;
  const m = new RoomMetrics(0);
  Object.assign(m.c, { hellos: 3, busy: 4, frames: 5, bytesIn: 6, poses: 7, sends: 8, bytesOut: 9, reads: 10, writes: 11, refusals: 12, full: 13, drops: 14, peak: 15 });
  m.flush({ writeDataPoint: (p) => { point = p; } }, 'world', 2, 'v', 1000, true);
  assert.equal(point.blobs[0], 'world', 'blob1 the kind');
  for (const [, k] of Object.entries(DOUBLE_OF)) assert.equal(point.doubles[k - 1], k, `double${k}`);
  assert.deepEqual([point.doubles[8], point.doubles[9], point.doubles[10]], [9, 10, 11], 'bytes out, reads, writes');

  for (const [name, , cols] of QUESTIONS) {
    const sql = loadSql(name, 3);
    assert.match(sql, new RegExp(`FROM ${DATASET} WHERE timestamp > NOW\\(\\) - INTERVAL '3' HOUR`));
    assert.match(sql, / FORMAT JSON$/);
    assert.deepEqual([...sql.matchAll(/ AS (\w+)/g)].map((x) => x[1]), cols, `${name}: its columns are what it selects`);
    assert.doesNotMatch(sql, /COUNT\(/, `${name}: a count is a sum of the sample`);
    for (const [sum] of sql.matchAll(/SUM\(.*? AS \w+/g)) assert.match(sum, /_sample_interval/, `${name}: ${sum} weighted by the sample`);
    assert.match(sql, /blob1 AS kind/, `${name}: the kind is blob1`);
    for (const [as, k] of Object.entries(DOUBLE_OF)) {
      if (!cols.includes(as)) continue;
      const want = as === 'peak' ? (name === 'crowds' ? 'double15 AS peak' : 'MAX(double15) AS peak') : name === 'crowds' ? `double${k} AS ${as}` : `SUM(double${k} * _sample_interval) AS ${as}`;
      assert.ok(sql.includes(` ${want}`) || sql.includes(`, ${want}`), `${name}: ${as} is double${k} (${want})`);
    }
  }
  const kinds = loadSql('kinds', 1);
  assert.ok(kinds.includes(', SUM(_sample_interval) AS room_windows,'), 'the room-windows a weighted count');
  assert.ok(kinds.includes('IF(SUM(double7 * _sample_interval) > 0, SUM(double8 * _sample_interval) / SUM(double7 * _sample_interval), 0.0) AS sends_per_pose'), 'sends over poses, and both arms of the IF a Double: the SQL API refuses a Double beside an Integer (HTTP 422, met live on 2026-10-18)');
  assert.ok(kinds.includes('SUM(double9 * _sample_interval) / 1000000 AS mb_out'));
  assert.ok(kinds.includes('SUM((double10 + double11) * _sample_interval) AS storage'));
  assert.match(kinds, /GROUP BY kind ORDER BY sends DESC LIMIT 40 FORMAT JSON$/);

  // THE FIVE-MINUTE ROWS: the crowd's kinds over the span, every row of it (twelve buckets an hour a kind, and the bucket
  // the window begins inside) - the span the asked hours, at most WINDOW_HOURS_MAX, said in the title
  assert.deepEqual([...WINDOW_KINDS], ['world', 'gate', 'chat']);
  assert.equal(WINDOW_HOURS_MAX, 24);
  for (const [h, span] of [[1, 1], [6, 6], [24, 24], [48, 24], [HOURS_MAX, 24]]) {
    const w = loadSql('windows', h);
    assert.ok(w.includes(`WHERE timestamp > NOW() - INTERVAL '${span}' HOUR AND blob1 IN ('world', 'gate', 'chat') GROUP BY bucket, kind`), `${h} h asked: ${span} h read`);
    assert.ok(w.endsWith(`ORDER BY bucket DESC, kind LIMIT ${12 * (span + 1) * 3} FORMAT JSON`), `${h} h: every row of ${span} h`);
  }
  assert.match(loadSql('windows', 1), /toStartOfInterval\(timestamp, INTERVAL '5' MINUTE\) AS bucket/);
  assert.match(QUESTIONS[1][1], /world, gate, chat; the last 24 hours at most/);
  const crowds = loadSql('crowds', 1);
  assert.ok(crowds.includes("WHERE timestamp > NOW() - INTERVAL '1' HOUR AND blob1 != 'chat' ORDER BY peak DESC LIMIT 40 FORMAT JSON"), 'the channels left out (their buses hold everyone), the forty busiest by peak');

  // FOES-FIRST and FOES-HOLD: the blobs past the doubles, each alias the blob RoomMetrics writes its count in - a point
  // flushed with every count its own value, read back by position - weighted by the sample through toUInt32, over the
  // points that carry the hold's blobs; the mean wait the waits over the frames sent, both arms of the IF a Double
  let bp = null;
  const bm = new RoomMetrics(0);
  Object.assign(bm.c, { frames: 1, hitDrops: 3, fullDrops: 4, fulls: 5, held: 6, heldSent: 7, heldGone: 8, heldMs: 9, beats: 10 });
  bm.flush({ writeDataPoint: (p) => { bp = p; } }, 'world', 2, 'v', 1000, true);
  const BLOB_OF = { hit_drops: 3, full_drops: 4, fulls: 5, held: 6, held_sent: 7, held_gone: 8, beats: 10 };
  for (const [as, k] of Object.entries(BLOB_OF)) assert.equal(bp.blobs[k - 1], String(k), `blob${k} RoomMetrics's`);
  assert.equal(bp.blobs[8], '9', 'blob9 the waits');
  const fulls = loadSql('fulls', 2);
  for (const [as, k] of Object.entries(BLOB_OF)) assert.ok(fulls.includes(`SUM(_sample_interval * toUInt32(blob${k})) AS ${as}`), `fulls: ${as} is blob${k}`);
  assert.ok(fulls.includes('IF(SUM(_sample_interval * toUInt32(blob7)) > 0, SUM(_sample_interval * toUInt32(blob9)) / SUM(_sample_interval * toUInt32(blob7)), 0.0) AS wait_ms'), 'the mean wait: the waits over the held frames sent');
  assert.ok(fulls.endsWith("WHERE timestamp > NOW() - INTERVAL '2' HOUR AND blob6 != '' GROUP BY kind ORDER BY fulls DESC LIMIT 40 FORMAT JSON"), 'the hold\'s points alone, by kind, the most full frames first');
  const storage = loadSql('storage', 2);
  assert.ok(storage.includes('blob1 AS kind, double11 AS writes, double10 AS reads, double2 AS room_sockets, double15 AS room_peak'), 'a room-window\'s writes and reads, the doubles RoomMetrics writes them in, and its sockets');
  assert.ok(storage.endsWith("WHERE timestamp > NOW() - INTERVAL '2' HOUR ORDER BY writes DESC LIMIT 40 FORMAT JSON"), 'every kind, the most writes first');

  for (const bad of ['0', String(HOURS_MAX + 1), '1.5', '-1', "1' HOUR; --", 'x']) {
    for (const [name] of QUESTIONS) assert.throws(() => loadSql(name, bad), /not a window/, `${name} ${bad}`);
  }
  assert.throws(() => loadSql('nope', 1), /no question/);
  const t = loadTable('crowds', { data: [{ stamp: '2026-10-18 14:35:00', kind: 'world', peak: 214, sockets: 198, hellos: 61, busy: 12, room_full: 0, drops: 340, poses: 52000, sends: 1210000 }] });
  assert.match(t, /\| stamp \| kind \| peak \| sockets \| hellos \| busy \| room_full \| drops \| poses \| sends \|/);
  assert.match(t, /\| 2026-10-18 14:35:00 \| world \| 214 \| 198 \| 61 \| 12 \| 0 \| 340 \| 52,000 \| 1,210,000 \|/);
  assert.match(loadTable('kinds', { data: [] }), /No points in the window\./);
  assert.throws(() => loadTable('kinds', { errors: [{ message: 'Authentication error' }] }), /carries no rows/);
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
/** A step's own block, from its name to the next step. */
const stepOf = (yml, stepName) => { const at = yml.indexOf(`- name: ${stepName}\n`); const end = yml.indexOf('\n      - ', at + 1); return yml.slice(at, end < 0 ? undefined : end); };

test('RELAY-LOAD the workflow: run by hand only, its one input read once as environment, its own queue, writing nothing, the token the two steps\' that use it and never the job\'s; the token step refuses to start without one and asks the tool before any question; its metrics step, run here as the runner runs it over an SQL API that holds it to its URL and method, draws every question into the summary under the window the SQL asks (an empty input the tool\'s own hour), and warns on a refusal - the token named only where the API refused it (AUDIT PLAN-1000 H3) - a refusal never drawn even when its body carries rows; a run that read nothing fails, its partial summary kept (H3); the step runs as written, strict, each call bounded and the job too (H10) (mutants: the input spliced into a run line; a refusal drawn; the token the job\'s; the token step\'s guard; the URL; the method; the window said; the token blamed for any answer; nothing read and green; the step not strict; the call unbounded; the job unbounded; the last warning gone)', () => {
  const wf = src('.github/workflows/relay-load.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 1, 'the one input, read once');
  assert.match(wf, /\n {6}HOURS: \$\{\{ inputs\.hours \}\}\n/);
  assert.match(wf, /\nconcurrency:\n {2}group: relay-load\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.match(wf, /\n {4}timeout-minutes: 10\n/, 'AUDIT PLAN-1000 H10: the job bounded');
  assert.match(stepOf(wf, 'Read the relay\'s metrics'), /run: \|\n {10}set -euo pipefail\n/, 'the step strict on its own');
  assert.match(stepOf(wf, 'Read the relay\'s metrics'), /curl -sS --max-time 60 /, 'each call bounded');
  assert.doesNotMatch(wf, /wrangler(@\d)? (deploy|d1)|migrations apply|d1 execute/, 'it deploys, migrates and executes nothing');
  // AUDIT PLAN-1000 A10: the token is the two steps' alone
  const job = wf.slice(wf.indexOf('\njobs:'), wf.indexOf('\n    steps:'));
  assert.doesNotMatch(job, /CLOUDFLARE_API_TOKEN/, 'never the job\'s');
  assert.equal(wf.match(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/g)?.length, 2);
  for (const name of ['Refuse to start without a token', 'Read the relay\'s metrics']) assert.match(stepOf(wf, name), /\n {8}env:\n {10}CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}\n/, name);

  const root = new URL('../..', import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), 'relayload-'));
  // THE TOKEN STEP: no token, a refusal; a token, the tool asked (its window's guard) before any question
  const guard = (token, hours) => {
    try { return { code: 0, out: execFileSync('bash', ['-c', stepRun(wf, 'Refuse to start without a token')], { cwd: root, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: token, HOURS: hours } }) }; } catch (e) { return { code: e.status, out: `${e.stdout}` }; }
  };
  const none = guard('', '2');
  assert.equal(none.code, 1);
  assert.match(none.out, /::error::secrets\.CLOUDFLARE_API_TOKEN is not set/);
  assert.equal(guard('x', '2').code, 0);
  assert.notEqual(guard('x', "1' HOUR; --").code, 0, 'a window the tool refuses stops the run before any question');

  // THE METRICS STEP over an SQL API that is held to its URL and its method
  const fake = join(dir, 'curl');
  writeFileSync(fake, `#!/usr/bin/env bash
out=""; data=""; url=""; method=""
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; --data-binary) data="$2"; shift 2;; -X) method="$2"; shift 2;; -H|-w|--max-time) shift 2;; -*) shift;; *) url="$1"; shift;; esac; done
[ "$method" = "POST" ] || { echo "not a POST: $method" >&2; exit 9; }
[ "$url" = "https://api.cloudflare.com/client/v4/accounts/$FAKE_ACCT/analytics_engine/sql" ] || { echo "not the SQL API: $url" >&2; exit 9; }
sql=$(cat "\${data#@}")
[ -n "$FAKE_ALL" ] && { echo '{"success":false,"errors":[{"message":"refused"}]}' > "$out"; echo -n "$FAKE_ALL"; exit 0; }
case "$sql" in *"ORDER BY peak DESC"*) cp "$FAKE_DIR/crowds.json" "$out"; echo -n "$FAKE_CODE";; *) echo '{"data":[]}' > "$out"; echo -n 200;; esac
`);
  chmodSync(fake, 0o755);
  const acct = src('server/wrangler.toml').match(/^account_id\s*=\s*"([^"]+)"/m)[1];
  const run = (answer, code, hours = '2', all = '') => {
    writeFileSync(join(dir, 'crowds.json'), JSON.stringify(answer));
    const summary = join(dir, `summary-${code}-${hours}-${all}.md`);
    writeFileSync(summary, '');
    let out, status = 0;
    try {
      out = execFileSync('bash', ['-c', stepRun(wf, 'Read the relay\'s metrics')], {   // H10: as written - its own `set -euo pipefail`
        cwd: root, encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir, FAKE_CODE: code, FAKE_ALL: all, FAKE_ACCT: acct, HOURS: hours, RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary, CLOUDFLARE_API_TOKEN: 'x' },
      });
    } catch (e) { out = `${e.stdout}`; status = e.status; }
    return { out, status, summary: readFileSync(summary, 'utf8') };
  };
  const row = { stamp: '2026-10-18 14:35:00', kind: 'gate', peak: 180, sockets: 170, hellos: 190, busy: 75, room_full: 0, drops: 0, poses: 30000, sends: 900000 };
  const ok = run({ data: [row] }, '200');
  assert.match(ok.summary, /\*\*Window: the last 2 hour\(s\)/);
  for (const [, title] of QUESTIONS) assert.ok(ok.summary.includes(`**${title}**`), title);
  assert.match(ok.summary, /\| 2026-10-18 14:35:00 \| gate \| 180 \| 170 \| 190 \| 75 \| 0 \| 0 \| 30,000 \| 900,000 \|/);
  assert.match(run({ data: [] }, '200', '').summary, /\*\*Window: the last 1 hour\(s\)/, 'an empty input: the hour the SQL asks, said as it');
  const refused = run({ success: false, errors: [{ message: 'Authentication error' }] }, '403');
  assert.doesNotMatch(refused.summary, /\*\*The busiest rooms/, 'a refusal is never drawn as a table');
  assert.match(refused.out, /::warning::the crowds question was refused \(HTTP 403\) - the token needs Account Analytics: Read/);
  assert.match(refused.out, /::warning::some readings are missing from the summary/, 'and the run says so at its end');
  assert.equal(refused.status, 0, 'a reading in part is a reading');
  assert.match(refused.summary, /\*\*Every five minutes, by kind/, 'the other questions still answer');
  // AUDIT PLAN-1000 H3: SQL the API would not run is not the token's fault, and a run that read nothing is red
  const sql = run({ success: false }, '422');
  assert.match(sql.out, /::warning::the crowds question was not answered \(HTTP 422\) - the API's own words follow/);
  assert.doesNotMatch(sql.out, /crowds question[^\n]*Account Analytics/, 'the token blamed for no 422');
  const nothing = run({ data: [] }, '200', '2', '403');
  assert.equal(nothing.status, 1, 'nothing read: red');
  assert.match(nothing.out, /::error::no question was answered/);
  assert.match(nothing.summary, /\*\*Window: the last 2 hour\(s\)/, 'its partial summary kept');
  // AUDIT PLAN-1000 A7: a refusal whose body carries rows is still a refusal - the status, not the shape, says so
  const odd = run({ data: [row] }, '500');
  assert.doesNotMatch(odd.summary, /\| 2026-10-18 14:35:00 \| gate \|/, 'an HTTP 500 is never drawn, whatever its body');
  assert.match(odd.out, /::warning::the crowds question was not answered \(HTTP 500\)/);
});
