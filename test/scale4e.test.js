// SCALE4e (2026-10-10, PR #755's own deploy; bible/11-Multiplayer/Scale-Arc.md SCALE4e): AN OVERLOADED DATABASE IS
// WAITED OUT, NOTHING ELSE IS. The merge deployed the relay (world189) and the account service (acct106) at once; the
// relay's drop sent every player's reconnect at the one D1 primary, and the account deploy's `migrations apply` landed
// 23 s into that wave and was refused "D1 DB is overloaded. Requests queued for too long. [code: 7429]" - the deploy
// stopped there and acct106 never shipped. The step now asks again on that answer alone (it is D1 refusing to queue
// the query, which never ran), after 20, 40, 60, 90 and 120 s, and stops at once on any other failure. Its own script,
// run here as the runner runs it (bash, the deploy's `set` line), over a fake wrangler that answers as D1 did and a fake
// `sleep` that waits for nothing. tools/mutants/scale4e.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const WF = readFileSync(new URL('../.github/workflows/account-deploy.yml', import.meta.url), 'utf8');

/** A step's `run: |` block, as the runner hands it to bash. */
function runBlock(yml, stepName) {
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

const OVERLOADED = 'A request to the Cloudflare API (/accounts/x/d1/database/y/query) failed.\n\n  D1 DB is overloaded. Requests queued for too long. [code: 7429]';
const BROKEN = 'A request to the Cloudflare API (/accounts/x/d1/database/y/query) failed.\n\n  duplicate column name: seen [code: 7500]';

/** The step run against `answers` - one per call of wrangler: 'ok', 'overloaded' or 'broken' (its last repeats). */
function migrate(answers) {
  const dir = mkdtempSync(join(tmpdir(), 'scale4e-'));
  try {
    writeFileSync(join(dir, 'answers'), `${answers.join('\n')}\n`);
    const fake = join(dir, 'wrangler');
    writeFileSync(fake, `#!/usr/bin/env bash
echo "$*" >> "${dir}/calls"
n=$(wc -l < "${dir}/calls")
a=$(sed -n "\${n}p" "${dir}/answers"); [ -n "$a" ] || a=$(tail -n 1 "${dir}/answers")
case "$a" in
  ok) echo "Migrations applied" ;;
  overloaded) printf '%s\\n' ${JSON.stringify(OVERLOADED)} >&2; exit 1 ;;
  *) printf '%s\\n' ${JSON.stringify(BROKEN)} >&2; exit 1 ;;
esac
`);
    chmodSync(fake, 0o755);
    writeFileSync(join(dir, 'sleep'), `#!/usr/bin/env bash\necho "$1" >> "${dir}/slept"\n`);
    chmodSync(join(dir, 'sleep'), 0o755);
    const r = spawnSync('bash', ['-c', runBlock(WF, 'Apply migrations')], {
      cwd: dir,
      env: { PATH: `${dir}:${process.env.PATH}`, WRANGLER: fake, DB_NAME: 'daggerfall-accounts', RUNNER_TEMP: dir },
      encoding: 'utf8',
    });
    const lines = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').trim().split('\n').filter(Boolean) : []);
    return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: lines('calls'), slept: lines('slept').map(Number) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('SCALE4e an overloaded database is asked again after 20, 40, 60, 90 and 120 s, and the deploy goes on once it answers (mutants: no retry; the waits dropped)', () => {
  const r = migrate(['overloaded', 'overloaded', 'ok']);
  assert.equal(r.status, 0, r.out);
  assert.deepEqual(r.calls, ['d1 migrations apply daggerfall-accounts --remote', 'd1 migrations apply daggerfall-accounts --remote', 'd1 migrations apply daggerfall-accounts --remote'], 'the same migrations, asked three times');
  assert.deepEqual(r.slept, [20, 40], 'a wait before each ask again');
  assert.match(r.out, /::warning::the database is overloaded - asking again in 20s/);
  const first = migrate(['ok']);
  assert.equal(first.status, 0, first.out);
  assert.equal(first.calls.length, 1, 'a database that answers is asked once');
  assert.deepEqual(first.slept, [], 'and nothing is waited for');
});

test('SCALE4e a migration that fails for any other reason stops the deploy at once - never retried, never waited on (mutants: every failure retried; the overload test always true)', () => {
  const r = migrate(['broken']);
  assert.equal(r.status, 1, r.out);
  assert.equal(r.calls.length, 1, 'asked once');
  assert.deepEqual(r.slept, []);
  assert.match(r.out, /::error::the migrations failed, and not on an overloaded database - not retried/);
  const later = migrate(['overloaded', 'broken']);
  assert.equal(later.status, 1, later.out);
  assert.equal(later.calls.length, 2, 'an overload, then a real failure: it stops at the failure');
  assert.deepEqual(later.slept, [20]);
});

test('SCALE4e a database overloaded past five and a half minutes stops the deploy, saying to re-run it (mutants: the last answer taken as success; a wait after the last ask)', () => {
  const r = migrate(['overloaded']);
  assert.equal(r.status, 1, r.out);
  assert.equal(r.calls.length, 6, 'six asks');
  assert.deepEqual(r.slept, [20, 40, 60, 90, 120], 'five waits, 330 s - none after the last ask');
  assert.match(r.out, /::error::the database stayed overloaded for 5\.5 minutes - re-run this job once it settles/);
});

test('SCALE4e the step keeps the deploy\'s order and its one apply line: after the bookmark, before the Worker (mutant: none; the order pins are scale1\'s and accountdeploy\'s)', () => {
  const block = runBlock(WF, 'Apply migrations');
  assert.equal(block.match(/\$WRANGLER d1 migrations apply "\$DB_NAME" --remote/g)?.length, 1, 'the one line that applies them');
  assert.match(block, /^set -uo pipefail$/m, 'no -e: the loop reads a failure instead of dying on it');
  assert.ok(WF.indexOf('- name: Record the database\'s bookmark before the migrations') < WF.indexOf('- name: Apply migrations'));
  assert.ok(WF.indexOf('- name: Apply migrations') < WF.indexOf('- name: Deploy\n'));
});
