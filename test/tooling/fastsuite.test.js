// FAST-SUITE (2026-10-04, Mac: "Our workflow is extremely slow"): HOW A LIST OF TEST FILES IS RUN - tools/testShards.mjs
// runTests, the one home `npm test` (`1/1`), a CI shard and `npm run test:changed` share: the files longest first by the
// recorded times (so the slowest no longer start last and run on alone), every core at once (Node's default leaves one
// idle), each file in its own process as before. The spawn is stood in: what is asserted is what would be run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runTests, runnerFlags, shardsOf, testFiles, WIN32_ARGV_BUDGET, summaryReporters } from '../../tools/testShards.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const spy = (status = 0) => {
  const calls = [];
  const spawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status }; };
  return { calls, spawn };
};

test('FAST-SUITE: runTests runs the files longest first, every core at once, in one runner - and answers its status (mutants: name order; the default concurrency; the status dropped)', () => {
  const times = { 'test/a.test.js': 10, 'test/b.test.js': 900, 'test/c.test.js': 50 };
  const { calls, spawn } = spy(3);
  assert.equal(runTests(['test/a.test.js', 'test/b.test.js', 'test/c.test.js', 'test/d.test.js'], { times, cores: 4, spawn, summary: false }), 3, 'the runner\'s own status');
  assert.equal(calls.length, 1, 'one runner for the list');
  const { cmd, args, opts } = calls[0];
  assert.equal(cmd, process.execPath);
  assert.deepEqual(args, ['--test', '--test-concurrency=4', 'test/b.test.js', 'test/c.test.js', 'test/d.test.js', 'test/a.test.js'],
    'the longest first; a file with no recorded time weighs the median (c\'s 50), ties by name');
  assert.equal(opts.stdio, 'inherit');
  assert.deepEqual(args.slice(2), shardsOf(Object.keys(times).concat('test/d.test.js'), 1, times)[0].files, 'the order is the shards\' own');
  // a machine's cores, whatever they are; never fewer than one at a time
  const one = spy();
  runTests(['test/a.test.js'], { times, cores: 0, spawn: one.spawn, summary: false });
  assert.equal(one.calls[0].args[1], '--test-concurrency=1');
  // nothing to run runs nothing
  const none = spy();
  assert.equal(runTests([], { times, spawn: none.spawn }), 0);
  assert.equal(none.calls.length, 0);
});

test('FAST-SUITE: every door runs through it - npm test is the whole suite as one shard, a CI shard and test:changed call runTests, and nothing spawns its own `node --test` (mutants: a door with its own spawn)', () => {
  assert.equal(JSON.parse(read('package.json')).scripts.test, 'node tools/testShards.mjs 1/1');
  const shards = read('tools/testShards.mjs'), changed = read('tools/testChanged.mjs');
  // PIN MOVED (CI-TIMES): the shard hands on the times it was split by and its record too
  assert.match(shards, /return runTests\(files, \{ times, extra: runnerFlags\(argv\.slice\(1\)\), record \}\);\n\}/, 'a shard, its runner flags handed on');
  assert.match(changed, /return runTests\(files, \{ extra: runnerFlags\(argv\) \}\);\n\}/, 'the changed tests, likewise');
  assert.equal((shards.match(/\['--test'/g) ?? []).length, 1, 'one spawn of the runner, runTests\'');
  assert.doesNotMatch(changed, /\['--test'/, 'test:changed spawns none of its own');
  // 1/1 is every test file: the whole of testFiles in one shard
  const all = testFiles();
  assert.deepEqual([...shardsOf(all, 1, {})[0].files].sort(), all);
});

test('AUDIT FAST-SUITE F7: where the platform caps a command line (Windows: 32,767), the list runs in as few runners as fit, in order, every file once, the first failure answered; elsewhere one runner; a runner that cannot start says why (mutants: no budget split; a later runner\'s status over the first failure; the start error unsaid)', () => {
  const files = Array.from({ length: 40 }, (_, i) => `test/f${String(i).padStart(2, '0')}.test.js`);
  const times = Object.fromEntries(files.map((f, i) => [f, 1000 - i]));   // already longest first
  const statuses = [0, 7, 3];
  const calls = [];
  const spawn = (cmd, args) => { calls.push(args); return { status: statuses[calls.length - 1] ?? 0 }; };
  const budget = process.execPath.length + 200;
  assert.equal(runTests(files, { times, cores: 4, spawn, budget, summary: false }), 7, 'the first failing runner\'s status');
  assert.ok(calls.length > 1, `split into ${calls.length} runners`);
  for (const args of calls) {
    assert.deepEqual(args.slice(0, 2), ['--test', '--test-concurrency=4'], 'each a whole runner');
    assert.ok(process.execPath.length + args.reduce((n, a) => n + a.length + 3, 0) <= budget, 'each inside the budget');
  }
  assert.deepEqual(calls.flatMap((a) => a.slice(2)), files, 'every file once, in the longest-first order');
  // no cap: one runner
  const one = []; runTests(files, { times, cores: 4, spawn: (c, a) => { one.push(a); return { status: 0 }; } , budget: Infinity });
  assert.equal(one.length, 1);
  assert.ok(WIN32_ARGV_BUDGET < 32767, 'Windows\' cap, with room for the executable');
  // the runner that never started
  const said = [], orig = console.error;
  console.error = (m) => said.push(String(m));
  try { assert.equal(runTests(['test/a.test.js'], { times, spawn: () => ({ status: null, error: new Error('E2BIG') }) }), 1); } finally { console.error = orig; }
  assert.match(said.join('\n'), /did not start: E2BIG/);
});

test('AUDIT FAST-SUITE F7: the runner\'s own flags are handed on - `npm test -- --test-name-pattern=x` filters again, after this file\'s own so a caller\'s concurrency wins; the tools\' own flags are not the runner\'s (mutants: flags dropped; put ahead of the concurrency)', () => {
  assert.deepEqual(runnerFlags(['--list', '--test-name-pattern=ROBES', '--base', 'HEAD~2', '--test-only', '--test-concurrency=1']),
    ['--test-name-pattern=ROBES', '--test-only', '--test-concurrency=1']);
  const calls = [];
  runTests(['test/a.test.js'], { times: {}, cores: 4, extra: ['--test-concurrency=1'], summary: false, spawn: (c, a) => { calls.push(a); return { status: 0 }; } });
  assert.deepEqual(calls[0], ['--test', '--test-concurrency=4', '--test-concurrency=1', 'test/a.test.js'], 'the caller\'s last, so it wins');
});

test('CI-FAST THE FAILURES NAMED: every runner reports twice to stdout - its own reporter as it would choose it (spec on a terminal, TAP elsewhere) and tools/failSummary.mjs - unless a caller says no; the caller\'s own flags still last (mutants: the summary never handed; the own reporter dropped, so a run prints only failures)', () => {
  const calls = [];
  runTests(['test/a.test.js'], { times: {}, cores: 4, extra: ['--test-name-pattern=X'], spawn: (c, a) => { calls.push(a); return { status: 0 }; } });
  const a = calls[0];
  assert.deepEqual(a.slice(0, 2), ['--test', '--test-concurrency=4']);
  assert.deepEqual(a.slice(2, 6), summaryReporters(), 'both reporters');
  assert.deepEqual(a.slice(6), ['--test-name-pattern=X', 'test/a.test.js'], 'the caller\'s flags after them, then the files');
  assert.deepEqual(summaryReporters(undefined, false).slice(0, 2), ['--test-reporter=tap', '--test-reporter-destination=stdout'], 'TAP off a terminal, as before');
  assert.equal(summaryReporters(undefined, true)[0], '--test-reporter=spec', 'spec on one');
  assert.match(summaryReporters()[2], /^--test-reporter=file:\/\/.*\/tools\/failSummary\.mjs$/);
  assert.equal(summaryReporters()[3], '--test-reporter-destination=stdout');
});
