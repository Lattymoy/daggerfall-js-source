// FLOW1, FLOW3, FLOW4 (2026-09-26, Mac: "Weve accumulated a lot of tests and I feel like its slowed down our ability to
// iterate. If they help, I dont want things removed but is there a way to really ensure we have a faster workflow with
// the same standards?"). FLOW1: CI's one serial check (~7 min, run twice for every change - the PR's, then main's before
// the deploy) is verify.yml's parallel jobs - lint and the types, the suite in four shards balanced by recorded times
// (tools/testShards.mjs), the build - which the PR's check and the deploy both call, the deploy publishing only once
// every one passed, on one pinned commit. FLOW3: `npm run test:changed` runs the tests a change can move
// (tools/testChanged.mjs), and ESLint keeps a cache. FLOW4: `node tools/mutate.mjs --jobs N` judges N mutants at once in
// workspaces, the same verdicts. Nothing here removes or weakens a test: every file still runs on every PR and before
// every deploy. Design: bible/09-Testing/Testing.md "How the suite runs".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shardsOf, parseShard, testFiles, readTimes } from '../tools/testShards.mjs';
import { importsOf, closureOf, testsFor, EVERYTHING } from '../tools/testChanged.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const scratch = (t) => { const d = mkdtempSync(join(tmpdir(), 'flow1 ')); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT'));

test('FLOW1 the split: every file in exactly one shard, whatever the count; the longest first onto the lightest, so no shard runs past an even share by more than one file; a file with no recorded time weighs the median; the same split every time (mutants: a file dealt twice; the heaviest shard fed; an unknown file left out)', () => {
  const files = Array.from({ length: 57 }, (_, i) => `test/f${String(i).padStart(2, '0')}.test.js`);
  const times = Object.fromEntries(files.filter((_, i) => i % 7).map((f, i) => [f, ((i * 7919) % 5000) + (i === 3 ? 60000 : 0)]));
  for (const n of [1, 2, 3, 4, 6, 9]) {
    const shards = shardsOf(files, n, times);
    assert.equal(shards.length, n);
    const all = shards.flatMap((s) => s.files);
    assert.equal(all.length, files.length, `${n}: each file once`);
    assert.deepEqual([...all].sort(), [...files].sort(), `${n}: every file`);
    const weights = files.map((f) => times[f] ?? null);
    const known = weights.filter((w) => w !== null).sort((a, b) => a - b), median = known[Math.floor(known.length / 2)];
    const w = (f) => times[f] ?? median;
    const total = files.reduce((a, f) => a + w(f), 0), top = Math.max(...files.map(w));
    for (const s of shards) {
      assert.equal(s.ms, s.files.reduce((a, f) => a + w(f), 0), 'a shard\'s weight is its files\'');
      assert.ok(s.ms <= total / n + top, `${n}: a shard within one file of an even share (${s.ms} vs ${total / n})`);
      for (let k = 1; k < s.files.length; k++) assert.ok(w(s.files[k - 1]) >= w(s.files[k]), 'longest first inside a shard');
    }
    assert.deepEqual(shardsOf(files, n, times), shards, 'the same split every time');
  }
  assert.deepEqual(parseShard('2/4'), { index: 2, total: 4 });
  for (const bad of ['0/4', '5/4', '2', 'a/b', '2/0', '', null]) assert.equal(parseShard(bad), null, String(bad));
  // the suite as it stands: four shards, every file of `npm test`'s glob in exactly one
  const suite = testFiles(), shards = shardsOf(suite, 4, readTimes());
  assert.ok(suite.length > 1000);
  assert.deepEqual(shards.flatMap((s) => s.files).sort(), suite);
  assert.ok(Object.keys(readTimes()).length > 1000, 'the times are recorded (npm run test:times)');
});

test('FLOW1 the workflows: verify.yml is the one check - lint and the types, every shard of the suite, the build; the PR\'s `check` passes only when all of it did (a skipped required check would pass, so it runs always and reads the result); the deploy verifies, builds and publishes ONE pinned commit, and publishes only after every part passed (mutants: a shard left out of the matrix; the aggregate skipped on failure; the deploy before the verification)', () => {
  const v = read('.github/workflows/verify.yml');
  assert.match(v, /on:\n {2}workflow_call:/);
  const matrix = /shard: \[([\d, ]+)\]/.exec(v);
  assert.ok(matrix, 'a shard matrix');
  const shards = matrix[1].split(',').map((x) => Number(x.trim()));
  const total = Number(/node tools\/testShards\.mjs \$\{\{ matrix\.shard \}\}\/(\d+)/.exec(v)?.[1]);
  assert.deepEqual(shards, Array.from({ length: total }, (_, i) => i + 1), 'the matrix holds every shard of the count it runs');
  assert.match(v, /fail-fast: false/);
  assert.match(v, /run: npm run lint\n[\s\S]*?run: npm run types/);
  assert.match(v, /build:\n {4}if: \$\{\{ inputs\.build \}\}[\s\S]*?run: npm run build/);
  for (const job of ['static', 'test', 'build']) assert.match(v, new RegExp(`\\n  ${job}:[\\s\\S]*?ref: \\$\\{\\{ inputs\\.ref \\}\\}`), `${job} checks out the ref it is asked`);
  const c = read('.github/workflows/check.yml');
  assert.match(c, /verify:\n {4}uses: \.\/\.github\/workflows\/verify\.yml/);
  assert.match(c, /\n {2}check:\n {4}if: \$\{\{ always\(\) \}\}\n {4}needs: \[verify\]/);
  assert.match(c, /if \[ "\$\{\{ needs\.verify\.result \}\}" != "success" \]; then[\s\S]*?exit 1/);
  const d = read('.github/workflows/deploy.yml');
  assert.match(d, /\n {2}main:\n[\s\S]*?ref: main\n[\s\S]*?sha=\$\(git rev-parse HEAD\)/, 'main\'s head, pinned once');
  assert.match(d, /\n {2}verify:\n {4}needs: main\n {4}uses: \.\/\.github\/workflows\/verify\.yml\n {4}with:\n {6}ref: \$\{\{ needs\.main\.outputs\.sha \}\}\n {6}build: false/);
  assert.match(d, /\n {2}site:\n {4}needs: main[\s\S]*?Checkout production\n[\s\S]*?ref: \$\{\{ needs\.main\.outputs\.sha \}\}[\s\S]*?run: npm run build\n {8}working-directory: production/);
  assert.match(d, /\n {2}deploy:\n {4}needs: \[verify, site\]\n[\s\S]*?uses: actions\/deploy-pages@v4/);
  assert.equal((d.match(/ref: main/g) ?? []).length, 1, 'only the pin reads main - every other job the commit it pinned');
  assert.equal((d.match(/actions\/deploy-pages/g) ?? []).length, 1);
  assert.ok(d.indexOf('actions/deploy-pages') > d.indexOf('\n  deploy:\n'), 'the deploy step lives in the job that waits for the verification');
  // the local check is the whole check still, and the loop's scripts are there
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.test, 'node --test "test/*.test.js"');
  assert.match(pkg.scripts.check, /npm run lint && npm run types && npm test && npm run build/);
  assert.equal(pkg.scripts['test:changed'], 'node tools/testChanged.mjs');
  assert.equal(pkg.scripts['test:shard'], 'node tools/testShards.mjs');
  assert.equal(pkg.scripts['test:times'], 'node tools/testTimes.mjs');
  assert.match(pkg.scripts.lint, /^eslint --cache --cache-strategy content --cache-location node_modules\/\.cache\/eslint\/ /, 'a warm lint reads only what changed; content, not mtimes, so a fresh checkout is never trusted');
});

test('FLOW3 the tests a change can move: the ones that import it, through any depth of modules, the ones that name it, the ones that changed; a file every test leans on runs everything; a change nothing reaches runs nothing (mutants: a module two imports away missed; a pin that names the file missed)', (t) => {
  const d = scratch(t);
  const put = (p, text) => { mkdirSync(dirname(join(d, p)), { recursive: true }); writeFileSync(join(d, p), text); };
  put('src/a.js', "import { b } from './b.js';\nexport const a = b;\n");
  put('src/b.js', "import './c.js';\nexport const b = 1;\n");
  put('src/c.js', 'export const c = 1;\n');
  put('src/lone.js', 'export const lone = 1;\n');
  put('test/a.test.js', "import { a } from '../src/a.js';\n");
  put('test/pin.test.js', "const text = read('src/c.js');\n");
  put('test/name.test.js', "// the cite, lone.js:12\n");
  put('test/dyn.test.js', "const m = await import('../src/b.js');\n");
  put('test/other.test.js', "export {};\n");
  const tests = ['test/a.test.js', 'test/dyn.test.js', 'test/name.test.js', 'test/other.test.js', 'test/pin.test.js'];
  assert.deepEqual(importsOf('test/a.test.js', readFileSync(join(d, 'test/a.test.js'), 'utf8'), d), ['src/a.js']);
  assert.deepEqual([...closureOf('test/a.test.js', d)].sort(), ['src/a.js', 'src/b.js', 'src/c.js', 'test/a.test.js']);
  assert.deepEqual(testsFor(['src/c.js'], tests, d), ['test/a.test.js', 'test/dyn.test.js', 'test/pin.test.js'], 'two imports away, a dynamic import, a pin that reads it');
  assert.deepEqual(testsFor(['src/lone.js'], tests, d), ['test/name.test.js'], 'named in a cite');
  assert.deepEqual(testsFor(['test/other.test.js'], tests, d), ['test/other.test.js'], 'a changed test runs itself');
  assert.deepEqual(testsFor(['docs/unrelated.txt'], tests, d), [], 'nothing reaches it');
  for (const f of EVERYTHING) assert.equal(testsFor([f], tests, d), 'all', f);
});

test('FLOW4 mutants N at a time: the same verdicts and output as a serial run, in list order; the source here never touched (the workspaces are copies); a record whose test does not pass outside this tree is judged here, in place, as a serial run judges it (mutants: every record in place; the baseline unread)', (t) => {
  const d = scratch(t);
  writeFileSync(join(d, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(join(d, 'target.js'), 'export const a = 1;\nexport const b = 2;\n');
  const pin = (name, body) => writeFileSync(join(d, name), `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { existsSync } from 'node:fs';\nimport { a, b } from './target.js';\n${body}\n`);
  pin('a.test.js', "test('a', () => assert.equal(a, 1));");
  pin('b.test.js', "test('b', () => assert.ok(b >= 0));");
  // passes only in this tree: a workspace leaves the repository's .git behind
  mkdirSync(join(d, '.git')); writeFileSync(join(d, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  pin('here.test.js', "test('here', () => { assert.ok(existsSync('.git/HEAD')); assert.equal(a, 1); });");
  const list = [
    { name: 'm1', file: 'target.js', old: 'a = 1', new: 'a = 5', tests: ['a.test.js'] },
    { name: 'm2', file: 'target.js', old: 'b = 2', new: 'b = 3', tests: ['b.test.js'] },
    { name: 'm3', file: 'target.js', old: 'a = 1', new: 'a = 7', tests: ['here.test.js'] },
    { name: 'm4', file: 'target.js', old: 'nowhere', new: 'x', tests: ['a.test.js'] },
  ];
  writeFileSync(join(d, 'list.json'), JSON.stringify(list));
  const before = readFileSync(join(d, 'target.js'), 'utf8');
  const serial = spawnSync(process.execPath, [join(ROOT, 'tools/mutate.mjs'), 'list.json'], { cwd: d, encoding: 'utf8', env: ENV, timeout: 120000 });
  const par = spawnSync(process.execPath, [join(ROOT, 'tools/mutate.mjs'), '--jobs', '3', 'list.json'], { cwd: d, encoding: 'utf8', env: ENV, timeout: 120000 });
  const verdicts = (out) => out.split('\n').filter((l) => /^ {2}m\d:|^== |dead, .* survived/.test(l));
  assert.deepEqual(verdicts(par.stdout), verdicts(serial.stdout), `same verdicts, same order:\n${par.stdout}`);
  assert.equal(par.status, serial.status, 'the same exit');
  assert.match(par.stdout, /m1: dead \(1 failing\)/);
  assert.match(par.stdout, /m2: SURVIVED/);
  assert.match(par.stdout, /m3: dead \(1 failing\)/, 'judged in place, where its test can pass unmutated');
  assert.match(par.stdout, /m4: COULD NOT APPLY/);
  assert.match(par.stdout, /\(3 workspaces; 1 of 4 mutants judged in place - their tests do not pass outside this tree: here\.test\.js\)/);
  assert.equal(readFileSync(join(d, 'target.js'), 'utf8'), before, 'the source is as it was');
  assert.equal(existsSync(join(d, 'target.js.mutbak')), false);
});
