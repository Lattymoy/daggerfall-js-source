// D1-NEAR and its audit (bible/11-Multiplayer/Scale-Arc.md D1-NEAR, bible/01-Overview/audits/Audit-D1-Near.md): THE DEPLOY'S
// REPORT STEP, RUN AS THE RUNNER RUNS IT - its script cut out of account-deploy.yml as the runner sees it, its own keys
// read, and a fake curl and a fake wrangler on PATH that answer as the deployed Worker's edge and D1's REST API do.
// Shared by test/bible/d1near.test.js and test/bible/audit_d1near.test.js, so both read one runner.
//
// THE FAKE CURL keeps real curl's ways, each measured against curl 8.5 by the audit's lane T: the `-D -` headers (an
// HTTP/2 status line with its trailing space and lower-case names, or an HTTP/1.1 one capitalised), then the body where
// `-o` sends it (stdout, glued to what follows, when there is no `-o` - a JSON body ends with no newline), then the `-w`
// text - written on a failed transfer too (a refused connection exits 7 and still says its time); an error answer exits
// 0 unless `-f` asks it to fail (22). Every call is logged with its URL, `-D`, `-o`, `--max-time` and whether `-f` was
// asked, so a pin can hold each.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const ROOT = new URL('..', import.meta.url).pathname;
export const WF = '.github/workflows/account-deploy.yml';
export const STEP = 'Report where the account Worker runs';
export const workflow = () => readFileSync(join(ROOT, WF), 'utf8');

/** Where a step starts in the workflow - asserted present, so an order compared against a missing name never passes. */
export function stepAt(yml, name) {
  const i = yml.indexOf(`\n      - name: ${name}\n`);
  assert.ok(i >= 0, `no step named "${name}"`);
  assert.equal(yml.indexOf(`\n      - name: ${name}\n`, i + 1), -1, `two steps named "${name}"`);
  return i;
}

/** A step's own keys as written between its name and its `run: |`, its comments dropped - `key: value` each. */
export function stepKeys(yml, name) {
  const from = stepAt(yml, name) + `\n      - name: ${name}\n`.length;
  const keys = [];
  for (const l of yml.slice(from).split('\n')) {
    if (l === '        run: |') return keys;
    assert.ok(l.startsWith('        ') && !l.startsWith('         '), `"${name}": a line that is no key of the step before its run: ${l}`);
    if (!l.trim().startsWith('#')) keys.push(l.trim());
  }
  assert.fail(`"${name}" has no run block`);
}

/** A step's `run:` block, as the runner sees it (its indentation shed). */
export function stepRun(yml, name) {
  const at = stepAt(yml, name);
  const from = yml.indexOf('        run: |\n', at) + '        run: |\n'.length;
  const lines = [];
  for (const l of yml.slice(from).split('\n')) {
    if (l.trim() && !l.startsWith('          ')) break;
    lines.push(l.slice(10));
  }
  return lines.join('\n');
}

const FAKE_CURL = String.raw`#!/usr/bin/env bash
url=""; dump=""; fmt=""; out=""; fail=0; maxt=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2;;
    -D) dump="$2"; shift 2;;
    -w) fmt="$2"; shift 2;;
    --max-time) maxt="$2"; shift 2;;
    --*) shift;;
    -*) case "$1" in *f*) fail=1;; esac; shift;;
    *) url="$1"; shift;;
  esac
done
case "$url" in */v1/health) kind=health;; *) kind=read;; esac
echo "$kind|$url|$dump|$out|$maxt|$fail" >> "$FAKE_DIR/asked"
n=$(( $(cat "$FAKE_DIR/n.$kind" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$FAKE_DIR/n.$kind"
line=$(sed -n "$n"p "$FAKE_DIR/plan.$kind")
status=$(echo "$line" | cut -d' ' -f1); took=$(echo "$line" | cut -d' ' -f2); hdr=$(echo "$line" | cut -d' ' -f3)
w() { printf "$(printf '%s' "$fmt" | sed "s/%{time_total}/$took/")"; }
if [ "$status" = refused ]; then echo "curl: (7) Failed to connect" >&2; w; exit 7; fi
if [ -n "$dump" ]; then
  case "$hdr" in
    h2:*) printf 'HTTP/2 %s \r\ncontent-type: application/json\r\ncf-placement: %s\r\n\r\n' "$status" "$(echo "$hdr" | cut -d: -f2-)";;
    h1:*) printf 'HTTP/1.1 %s OK\r\nContent-Type: application/json\r\nCF-Placement: %s\r\n\r\n' "$status" "$(echo "$hdr" | cut -d: -f2-)";;
    *) printf 'HTTP/2 %s \r\ncontent-type: application/json\r\n\r\n' "$status";;
  esac
fi
body='{"ok":true}'
if [ -n "$out" ]; then printf '%s' "$body" > "$out"; else printf '%s' "$body"; fi
w
if [ "$status" -ge 400 ] && [ "$fail" = 1 ]; then echo "curl: (22) The requested URL returned error: $status" >&2; exit 22; fi
exit 0
`;

const FAKE_WRANGLER = String.raw`#!/usr/bin/env bash
echo "$*" >> "$FAKE_DIR/wrangler-asked"
if [ -f "$FAKE_DIR/d1.out" ]; then cat "$FAKE_DIR/d1.out"; exit 0; fi
echo "A request to the Cloudflare API failed." >&2; exit 1
`;

/** D1's REST answer to one `SELECT 1`, as `wrangler d1 execute --json` prints it, served from `colo`. */
export const d1Answer = (colo, region, primary) => JSON.stringify([{ results: [{ 1: 1 }], success: true,
  meta: { served_by_colo: colo, served_by_region: region, served_by_primary: primary, duration: 0.12, changes: 0, rows_read: 0, rows_written: 0 } }], null, 2);

/**
 * Run the step's script under `bash --noprofile --norc -eo pipefail` (the job's `shell: bash`) from server-account/ (its
 * `working-directory`), over the fakes. `plan.health` and `plan.read` are each call's answer in order -
 * `<status> <seconds> [h2:<placement> | h1:<placement>]` or `refused <seconds>`; `d1` is what the fake wrangler prints
 * (null: it fails). Answers what the runner would see and what the fakes were asked. The fakes' directory is removed.
 */
export function runStep({ plan, d1 = null, script = stepRun(workflow(), STEP) }) {
  const dir = mkdtempSync(join(tmpdir(), 'd1near-'));
  try {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'curl'), FAKE_CURL);
    writeFileSync(join(bin, 'wrangler'), FAKE_WRANGLER);
    chmodSync(join(bin, 'curl'), 0o755);
    chmodSync(join(bin, 'wrangler'), 0o755);
    writeFileSync(join(dir, 'plan.health'), plan.health.join('\n') + '\n');
    writeFileSync(join(dir, 'plan.read'), plan.read.join('\n') + '\n');
    if (d1 != null) writeFileSync(join(dir, 'd1.out'), d1);
    const summary = join(dir, 'summary.md');
    writeFileSync(summary, '');
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script.replaceAll('${{ steps.deploy.outputs.base }}', 'https://accounts.example')], {
      cwd: join(ROOT, 'server-account'), encoding: 'utf8',
      env: { PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: dir, GITHUB_STEP_SUMMARY: summary, WRANGLER: join(bin, 'wrangler'), DB_NAME: 'daggerfall-accounts' },
    });
    const lines = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').trim().split('\n').filter(Boolean) : []);
    return { status: r.status, stdout: r.stdout, stderr: r.stderr, summary: readFileSync(summary, 'utf8'),
      asked: lines('asked').map((l) => { const [kind, url, dump, out, maxTime, fail] = l.split('|'); return { kind, url, dump, out, maxTime, fail: fail === '1' }; }),
      wranglerAsked: lines('wrangler-asked') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Five health answers and five one-statement reads that all came, an outlier in each - the middle 81 ms and 86 ms. */
export const PLAN_UP = {
  health: ['200 0.081 h2:remote-SJC', '200 0.079 h2:remote-SJC', '200 0.300 h2:remote-SJC', '200 0.080 h1:local-SJC', '200 0.082 -'],
  read: ['200 0.086', '200 0.900', '200 0.085', '200 0.087', '200 0.084'],
};
/** Nothing reached. */
export const PLAN_DOWN = { health: Array(5).fill('refused 0.000236'), read: Array(5).fill('refused 0.000236') };
