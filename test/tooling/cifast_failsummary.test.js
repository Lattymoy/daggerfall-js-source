// CI-FAST (2026-10-19, Mac: "Do both and whatever else could speed up everything"): A RED SHARD NAMES ITS FAILURES.
// tools/failSummary.mjs, the second reporter every runner is handed (tools/testShards.mjs runTests): driven on the real
// runner over a made file that passes once, fails once and fails in a child, and on its own over made events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import failSummary, { ownFailure, whyOf, repoPath, summaryOf } from '../../tools/failSummary.mjs';
import { summaryReporters } from '../../tools/testShards.mjs';

const MADE = `import { test } from 'node:test';   // its tests indented - the suite's manifest counts a top-of-line test( call
import assert from 'node:assert/strict';
  test('passes', () => {});
  test('fails here', () => { assert.equal(1, 2, 'one is not two'); });
  test('parent', async (t) => { await t.test('child fails', () => { throw new Error('child broke\\nsecond line'); }); });
`;

test('CI-FAST THE RUN\'S END NAMES EVERY FAILING TEST: on the real runner, its file, line and name and the first line of why - never the parent failing only through its child, never the passing one; on GitHub Actions an ::error annotation each and the job summary\'s table; the runner\'s own verdict unchanged (mutants: a parent named; the cause unread; no annotation; the summary file unwritten)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'failsum-'));
  try {
    const file = join(dir, 'made.test.js'), summary = join(dir, 'summary.md');
    writeFileSync(file, MADE);
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary };
    delete env.NODE_TEST_CONTEXT;   // a runner of its own, never a child reporting to this one
    const r = spawnSync(process.execPath, ['--test', ...summaryReporters(undefined, false), file], { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 1, 'the runner\'s own verdict');
    const out = r.stdout;
    assert.match(out, /^# fail [1-9]\d*$/m, 'the TAP report still there');
    const block = out.slice(out.indexOf('# ---- 2 failing tests'));
    assert.match(block, /# FAIL made\.test\.js:[4] {2}fails here\n# {6}one is not two\n/);
    assert.match(block, /# FAIL made\.test\.js:[5] {2}child fails\n# {6}child broke\n/);
    assert.doesNotMatch(block, /FAIL [^\n]*  (parent|passes)\n/, 'only the tests that failed themselves');
    assert.match(out, /^::error file=made\.test\.js,line=4,title=fails here::one is not two$/m);
    assert.match(out, /^::error file=made\.test\.js,line=5,title=child fails::child broke$/m);
    const md = readFileSync(summary, 'utf8');
    assert.match(md, /### 2 failing tests/);
    assert.match(md, /\| `made\.test\.js:[4]` \| fails here \| one is not two \|/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CI-FAST THE SUMMARY\'S PIECES: a passing run writes nothing; off GitHub no annotation; a workflow command\'s data and properties escaped; a long reason cut; a path made the repository\'s (mutants: the escape skipped; an empty run summarised)', async () => {
  const none = []; for await (const s of failSummary((async function* () { yield { type: 'test:pass', data: { name: 'ok' } }; })())) none.push(s);
  assert.deepEqual(none, [], 'nothing to say');
  assert.equal(ownFailure({ details: { error: { failureType: 'subtestsFailed' } } }), false);
  assert.equal(ownFailure({ details: { error: { failureType: 'testCodeFailure' } } }), true);
  assert.equal(whyOf({ message: 'wrapper', cause: { message: '\n  the real one\nmore' } }), 'the real one');
  assert.equal(whyOf({ message: 'x'.repeat(400) }).length, 300);
  assert.equal(repoPath('/r/test/a.test.js', '/r'), 'test/a.test.js');
  assert.equal(repoPath('file:///r/test/a%20b.test.js', '/r'), 'test/a b.test.js');
  const off = summaryOf([{ file: 'a.js', line: 2, name: 'n', why: 'w' }]);
  assert.deepEqual(off.annotations, [], 'no annotation off GitHub');
  const on = summaryOf([{ file: 'a,b:c.js', line: 2, name: 'x: y, z', why: '50%\nmore' }], { github: true });
  assert.equal(on.annotations[0], '::error file=a%2Cb%3Ac.js,line=2,title=x%3A y%2C z::50%25%0Amore');
  assert.deepEqual(summaryOf([]), { log: '', annotations: [], markdown: '' });
});

test('CI-FAST THE WORKFLOWS: the suite in eight shards; every job of verify.yml and the course sweep restores node_modules from the cache keyed by package-lock.json and runs npm ci only on a miss; each shard runs through runTests, so it names its failures (mutants: a job installing every time; a key that never moves with the lockfile; the shards back to four)', () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['.github/workflows/verify.yml', '.github/workflows/eg-sweep.yml']) {
    const w = read(p);
    const installs = w.match(/- name: Install dependencies\n {8}if: steps\.deps\.outputs\.cache-hit != 'true'\n {8}run: npm ci\n/g) ?? [];
    const caches = w.match(/- name: Cached dependencies\n {8}id: deps\n {8}uses: actions\/cache@v4\n {8}with:\n {10}path: node_modules\n {10}key: node-modules-\$\{\{ runner\.os \}\}-node22-\$\{\{ hashFiles\('package-lock\.json'\) \}\}\n/g) ?? [];
    assert.ok(installs.length >= 1, `${p}: its installs`);
    assert.equal(caches.length, installs.length, `${p}: a cache before every install`);
    assert.equal((w.match(/run: npm ci/g) ?? []).length, installs.length, `${p}: no install outside the cache's miss`);
  }
  const v = read('.github/workflows/verify.yml');
  assert.match(v, /shard: \[1, 2, 3, 4, 5, 6, 7, 8\]/);
  assert.match(v, /run: node tools\/testShards\.mjs \$\{\{ matrix\.shard \}\}\/8 --record "\$RUNNER_TEMP\/test-times\.json"\n/, 'PIN MOVED (CI-TIMES): and records its times');
});
