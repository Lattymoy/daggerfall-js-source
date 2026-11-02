// CI-TIMES (2026-10-19, Mac: "Do it" - the shards' times recorded by CI, not re-taken by hand): every shard records
// each of its files' wall time (tools/fileTimes.mjs, through the summary's reporter), a green run's eight records are
// merged onto the times it was split by and saved in the Actions cache (tools/testTimes.mjs --merge, test-times.yml),
// and every later run's shards are split by the newest saved - all eight by the same one (verify.yml's `times`).
// Driven on the real runner over made files, on its own over made events, and against the workflows' text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fileEvent, fileTimeOf, addTimes } from '../../tools/fileTimes.mjs';
import { mergeTimes, mergeDir } from '../../tools/testTimes.mjs';
import { runTests, summaryReporters, testFiles } from '../../tools/testShards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const scratch = (t) => { const d = mkdtempSync(join(tmpdir(), 'citimes-')); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT' && k !== 'TEST_TIMES_RECORD'));

// the made files' tests indented - the suite's manifest counts a top-of-line test( call
const SLOW = `import { test } from 'node:test';
await new Promise((r) => setTimeout(r, 150));
  test('a test in it', () => {});
`;
const FAILS = `import { test } from 'node:test';
  test('fails', () => { throw new Error('no'); });
`;
const NESTS = (reporter) => `import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
  test('a runner of its own', () => {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=${reporter}', '--test-reporter-destination=stdout', 'inner/inner.test.js'], { encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  });
`;
const INNER = `import { test } from 'node:test';
  test('inner', () => {});
`;

test('CI-TIMES A RUN RECORDS EACH FILE\'S WALL TIME: on the real runner, every file it ran - a failing one too - by the path it was given, its imports in it, whole milliseconds, added to the record (what it held kept, a file timed again replaced), sorted; never a test\'s own name, never a runner a test starts of its own; the verdict unchanged (mutants: the record unwritten; what it held dropped; the held over the new; the path left in the environment)', (t) => {
  const dir = scratch(t), rec = join(dir, 'rec.json');
  writeFileSync(join(dir, 'slow.test.js'), SLOW);
  writeFileSync(join(dir, 'fails.test.js'), FAILS);
  writeFileSync(join(dir, 'nests.test.js'), NESTS(pathToFileURL(join(ROOT, 'tools/failSummary.mjs')).href));
  mkdirSync(join(dir, 'inner'));
  writeFileSync(join(dir, 'inner', 'inner.test.js'), INNER);
  writeFileSync(rec, JSON.stringify({ 'slow.test.js': 1, 'old.test.js': 5 }));
  const r = spawnSync(process.execPath, ['--test', ...summaryReporters(ROOT, false), 'slow.test.js', 'fails.test.js', 'nests.test.js'],
    { cwd: dir, encoding: 'utf8', env: { ...ENV, TEST_TIMES_RECORD: rec } });
  assert.equal(r.status, 1, 'the runner\'s own verdict');
  assert.match(r.stdout, /^not ok \d+ - fails$/m);
  assert.match(r.stdout, /^ok \d+ - a runner of its own$/m, 'the nested runner ran');
  const text = readFileSync(rec, 'utf8'), got = JSON.parse(text);
  assert.deepEqual(Object.keys(got), ['fails.test.js', 'nests.test.js', 'old.test.js', 'slow.test.js'], 'the files, by their paths, sorted - no test, no nested runner\'s file');
  assert.equal(got['old.test.js'], 5, 'what the record held, kept');
  assert.ok(got['slow.test.js'] >= 150, `its imports in its time (${got['slow.test.js']})`);
  for (const [f, ms] of Object.entries(got)) assert.ok(Number.isInteger(ms) && ms >= 0, `${f}: whole milliseconds`);
  assert.equal(text, JSON.stringify(got, null, 1) + '\n');
  assert.doesNotMatch(r.stdout, /"slow\.test\.js"/, 'nothing in the log');
});

test('CI-TIMES THE PIECES: a file\'s own event is the one at nesting 0 named its path (relative, absolute, a file URL); a test, a subtest, another event, a time not a time - none; the merge takes a record over the base and a later record over an earlier, keeps the base\'s time for a file no record has, drops a file no longer in the suite and invents none; the record\'s file merged and sorted (mutants: the name unread; any nesting; any event; the rounding; the base dropped; a gone file kept)', (t) => {
  const cwd = '/r', file = '/r/test/a.test.js', done = (data) => ({ type: 'test:complete', data });
  assert.equal(fileEvent({ nesting: 0, name: 'test/a.test.js', file }, cwd), true);
  assert.equal(fileEvent({ nesting: 0, name: '/r/test/a.test.js', file }, cwd), true);
  assert.equal(fileEvent({ nesting: 0, name: 'test/a.test.js', file: pathToFileURL(file).href }, cwd), true);
  assert.equal(fileEvent({ nesting: 0, name: 'a top-level test', file }, cwd), false, 'a test is named by its author');
  assert.equal(fileEvent({ nesting: 1, name: 'test/a.test.js', file }, cwd), false);
  assert.equal(fileEvent({ nesting: 0, name: 'test/a.test.js' }, cwd), false, 'no file, no time');
  assert.deepEqual(fileTimeOf(done({ nesting: 0, name: 'test/a.test.js', file, details: { duration_ms: 1234.6 } }), cwd), ['test/a.test.js', 1235]);
  assert.equal(fileTimeOf({ type: 'test:pass', data: { nesting: 0, name: 'test/a.test.js', file, details: { duration_ms: 9 } } }, cwd), null);
  for (const ms of [undefined, NaN, -1, Infinity]) assert.equal(fileTimeOf(done({ nesting: 0, name: 'test/a.test.js', file, details: { duration_ms: ms } }), cwd), null, String(ms));
  assert.equal(fileTimeOf(null, cwd), null);

  const files = ['test/b.test.js', 'test/a.test.js', 'test/c.test.js', 'test/d.test.js'];
  const merged = mergeTimes({ 'test/a.test.js': 10, 'test/c.test.js': 30, 'test/gone.test.js': 7, 'test/d.test.js': -4 },
    [{ 'test/a.test.js': 11.4, 'test/b.test.js': 20 }, { 'test/a.test.js': 12, 'test/b.test.js': 'slow', 'test/x.test.js': 1 }], files);
  assert.deepEqual(merged, { 'test/a.test.js': 12, 'test/b.test.js': 20, 'test/c.test.js': 30 });
  assert.deepEqual(Object.keys(merged), ['test/a.test.js', 'test/b.test.js', 'test/c.test.js'], 'sorted');
  assert.deepEqual(mergeTimes({}, [{ 'test/a.test.js': 2.5 }], ['test/a.test.js']), { 'test/a.test.js': 3 }, 'whole milliseconds');
  assert.deepEqual(mergeTimes(undefined, [], ['test/a.test.js']), {});

  const dir = scratch(t), p = join(dir, 'rec.json');
  addTimes(p, { 'b.test.js': 2 });
  addTimes(p, { 'a.test.js': 1, 'b.test.js': 3 });
  assert.equal(readFileSync(p, 'utf8'), JSON.stringify({ 'a.test.js': 1, 'b.test.js': 3 }, null, 1) + '\n');
  writeFileSync(p, '{ torn');
  addTimes(p, { 'c.test.js': 4 });
  assert.deepEqual(JSON.parse(readFileSync(p, 'utf8')), { 'c.test.js': 4 }, 'a broken record written afresh');
});

test('CI-TIMES THE MERGE OF A RUN: every record under the downloaded folder (one folder a shard\'s artifact) onto the root\'s tools/testTimes.json, written back sorted, and counted - timed by the records, kept from before, untimed (mutants: the folders unread; the base unread)', (t) => {
  const root = scratch(t), dl = join(root, 'dl');
  for (const d of ['test/sub', 'tools', 'dl/test-times-shard-1', 'dl/test-times-shard-2']) mkdirSync(join(root, d), { recursive: true });
  for (const f of ['test/a.test.js', 'test/sub/b.test.js', 'test/c.test.js', 'test/d.test.js']) writeFileSync(join(root, f), '');
  writeFileSync(join(root, 'tools/testTimes.json'), JSON.stringify({ 'test/a.test.js': 10, 'test/c.test.js': 30, 'test/gone.test.js': 3 }));
  writeFileSync(join(dl, 'test-times-shard-1', 'test-times.json'), JSON.stringify({ 'test/sub/b.test.js': 20 }));
  writeFileSync(join(dl, 'test-times-shard-2', 'test-times.json'), JSON.stringify({ 'test/a.test.js': 40 }));
  writeFileSync(join(dl, 'test-times-shard-2', 'notes.txt'), 'not a record');
  assert.deepEqual(mergeDir(dl, root), { files: 4, recorded: 2, kept: 1, untimed: 1 });
  assert.equal(readFileSync(join(root, 'tools/testTimes.json'), 'utf8'),
    JSON.stringify({ 'test/a.test.js': 40, 'test/c.test.js': 30, 'test/sub/b.test.js': 20 }, null, 1) + '\n');
});

test('CI-TIMES THE SHARD RECORDS: runTests hands a runner with a record the summary\'s reporter - on even where the summary is not - and the record\'s path, absolute, in its environment, and none without one; `node tools/testShards.mjs i/n --record <file>` runs its files into it, and asks for the file when none is given (mutants: the reporter off with the summary; the path relative; the record not handed on)', (t) => {
  const calls = [], spawn = (cmd, args, opts) => { calls.push({ args, opts }); return { status: 0 }; };
  runTests(['test/a.test.js'], { root: ROOT, times: {}, cores: 2, spawn, summary: false, record: 'rel/times.json' });
  runTests(['test/a.test.js'], { root: ROOT, times: {}, cores: 2, spawn, summary: false });
  assert.deepEqual(calls[0].args.slice(0, 2 + summaryReporters(ROOT).length), ['--test', '--test-concurrency=2', ...summaryReporters(ROOT)]);
  assert.equal(calls[0].opts.env.TEST_TIMES_RECORD, join(process.cwd(), 'rel/times.json'), 'absolute - the runner runs in the root');
  assert.equal(calls[1].opts.env, undefined, 'no record, the environment as it was');
  assert.ok(!calls[1].args.some((a) => a.includes('failSummary')), 'and no summary asked');

  const all = testFiles(ROOT), rec = join(scratch(t), 'shard.json');
  const r = spawnSync(process.execPath, ['tools/testShards.mjs', `${all.length}/${all.length}`, '--record', rec, '--test-name-pattern=^CITIMES-NO-SUCH-TEST$'],
    { cwd: ROOT, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, r.stderr);
  const [one] = Object.keys(JSON.parse(readFileSync(rec, 'utf8')));
  assert.ok(all.includes(one), `the shard's one file recorded (${one})`);
  const bare = spawnSync(process.execPath, ['tools/testShards.mjs', '1/8', '--record'], { cwd: ROOT, encoding: 'utf8', env: ENV });
  assert.equal(bare.status, 2);
  assert.match(bare.stderr, /--record wants the file/);
});

test('CI-TIMES THE WORKFLOWS: `times` finds the newest saved times (a lookup, nothing downloaded); every shard needs it and restores THAT key exactly, failing on a miss, before it runs - so all eight split by the same times; each shard records and keeps its record; after a green run the PR\'s check and the deploy save the merge under a key the lookup finds, beside the result, never ahead of it (mutants: the shards by the newest each; a miss run on; no record; a failed upload failing the shard; the save out of the lookup\'s reach; the check waiting on the save)', () => {
  const v = read('.github/workflows/verify.yml'), tt = read('.github/workflows/test-times.yml');
  const c = read('.github/workflows/check.yml'), d = read('.github/workflows/deploy.yml');
  assert.match(v, /\n {4}outputs:\n {6}times:\n {8}description: [^\n]+\n {8}value: \$\{\{ jobs\.times\.outputs\.key \}\}\n/);
  const times = v.slice(v.indexOf('\n  times:\n'), v.indexOf('\n  test:\n'));
  assert.match(times, /outputs:\n {6}key: \$\{\{ steps\.find\.outputs\.cache-matched-key \}\}\n/);
  assert.match(times, /id: find\n {8}continue-on-error: true[^\n]*\n {8}uses: actions\/cache\/restore@v4\n {8}with:\n {10}path: tools\/testTimes\.json\n {10}key: test-times-none\n {10}restore-keys: test-times-\n {10}lookup-only: true\n/);
  assert.doesNotMatch(times, /actions\/checkout/, 'a lookup needs no checkout');
  const shard = v.slice(v.indexOf('\n  test:\n'), v.indexOf('\n  sweep:\n'));
  assert.match(shard, /\n {4}needs: times\n/);
  const restore = shard.indexOf('- name: The times the shards split by'), run = shard.indexOf('run: node tools/testShards.mjs');
  assert.ok(restore > 0 && run > restore, 'the times restored before the shard is split');
  assert.match(shard, /- name: The times the shards split by\n {8}if: needs\.times\.outputs\.key != ''\n {8}uses: actions\/cache\/restore@v4\n {8}with:\n {10}path: tools\/testTimes\.json\n {10}key: \$\{\{ needs\.times\.outputs\.key \}\}\n {10}fail-on-cache-miss: true\n/);
  assert.doesNotMatch(shard, /restore-keys/, 'the one key, never the newest each shard finds');
  assert.match(shard, /run: node tools\/testShards\.mjs \$\{\{ matrix\.shard \}\}\/8 --record "\$RUNNER_TEMP\/test-times\.json"\n/);
  assert.match(shard, /- name: Keep this shard's times\n {8}if: \$\{\{ !cancelled\(\) \}\}\n {8}uses: actions\/upload-artifact@v4\n {8}continue-on-error: true[^\n]*\n {8}with:\n {10}name: test-times-shard-\$\{\{ matrix\.shard \}\}\n {10}path: \$\{\{ runner\.temp \}\}\/test-times\.json\n[\s\S]*? {10}overwrite: true/, 'kept - never turning the shard red, and a re-run replacing its own');

  assert.match(tt, /on:\n {2}workflow_call:/);
  assert.match(tt, /persist-credentials: false/);
  const at = (s) => { const i = tt.indexOf(s); assert.ok(i > 0, s); return i; };
  const steps = [at('key: ${{ inputs.planned }}'), at('pattern: test-times-shard-*'), at('run: node tools/testTimes.mjs --merge "$RUNNER_TEMP/test-times"'), at('uses: actions/cache/save@v4')];
  assert.deepEqual([...steps].sort((a, b) => a - b), steps, 'the planned times, the records, the merge, the save - in that order');
  assert.match(tt, /pattern: test-times-shard-\*\n {10}path: \$\{\{ runner\.temp \}\}\/test-times\n {10}merge-multiple: false\n/, 'a folder a record - the eight share one name');
  const save = /uses: actions\/cache\/save@v4\n {8}with:\n {10}path: ([^\n]+)\n {10}key: ([^\n]+)\n/.exec(tt);
  assert.equal(save?.[1], 'tools/testTimes.json');
  assert.equal(save?.[2], 'test-times-${{ github.run_id }}-${{ github.run_attempt }}');
  assert.ok(save[2].startsWith('test-times-'), 'the lookup\'s prefix finds it');
  for (const w of [v, tt]) for (const m of w.matchAll(/uses: actions\/cache\/(?:restore|save)@v4\n {8}with:\n {10}path: (\S+)\n/g)) assert.equal(m[1], 'tools/testTimes.json', 'one path - a cache is found only by the path it was saved with');

  assert.match(c, /\n {2}times:\n {4}needs: \[verify\]\n {4}uses: \.\/\.github\/workflows\/test-times\.yml\n {4}with:\n {6}planned: \$\{\{ needs\.verify\.outputs\.times \}\}\n/);
  assert.match(c, /\n {2}check:\n {4}if: \$\{\{ always\(\) \}\}\n {4}needs: \[verify\]\n/, 'the check never waits on the save');
  assert.match(d, /\n {2}times:\n {4}needs: \[main, verify\]\n {4}uses: \.\/\.github\/workflows\/test-times\.yml\n {4}with:\n {6}ref: \$\{\{ needs\.main\.outputs\.sha \}\}\n {6}planned: \$\{\{ needs\.verify\.outputs\.times \}\}\n/);
  assert.match(d, /\n {2}deploy:\n {4}needs: \[verify, site\]\n/, 'nor the publish');
});
