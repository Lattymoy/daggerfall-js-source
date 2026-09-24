// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster "tools": tools/ and
// scripts/, the dev tooling, the bakes, the cite and mutant tools. Each pin
// failed on the base (ad238de0) and passes on the fix. Most run the real tool
// on a scratch tree, so none of them can write the checkout; the cite
// fixtures name files no tree has (zq...), so no cite shift can move them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planDoc, applyPlan, lineMap } from '../tools/citeShift.mjs';
import { mapLine } from '../tools/citeMerge.mjs';
import { deployVerdict } from '../tools/verify-deploy.mjs';
import { parseSettingsText } from '../scripts/bakeSettingsText.mjs';
import { SETTINGS_LABELS } from '../src/systems/settingsText.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
/** A scratch directory - its name has a SPACE, the path the old guards failed on - removed after the test. */
const scratch = (t) => { const d = mkdtempSync(join(tmpdir(), 'audit68 tools ')); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
/** ...holding copies of these repo paths (files or directories). */
const tree = (t, paths) => { const d = scratch(t); for (const p of paths) cpSync(join(ROOT, p), join(d, p), { recursive: true }); return d; };
// The tools run `node --test` themselves; the runner's own NODE_TEST_CONTEXT would turn those into its reporting children.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT'));
const node = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, env: ENV, ...opts });
/** Every script under tools/ and scripts/. */
const scripts = () => ['tools', 'scripts'].flatMap((d) => readdirSync(join(ROOT, d), { recursive: true })
  .filter((f) => /\.(m?js|cjs)$/.test(f) && !f.includes('node_modules')).map((f) => `${d}/${f}`));

// ── the bakes and the "am I the program" guard ───────────────────────────

test('AUDIT 68 S01-bake-on-import-race: importing a bake for its parser writes nothing; run as the program it bakes the committed module', (t) => {
  for (const [script, input, out] of [
    ['scripts/bakeBooks.mjs', 'vendor/dfu-books/books.txt', 'src/systems/booksData.js'],
    ['scripts/bakeSettings.mjs', 'vendor/dfu-settings/defaults.ini.txt', 'src/systems/settingsDefaults.js'],
    ['scripts/bakeSettingsText.mjs', 'vendor/dfu-settings/GameSettings.txt', 'src/systems/settingsText.js'],
  ]) {
    const d = tree(t, [script, 'tools/lib', input]);
    mkdirSync(join(d, 'src/systems'), { recursive: true });
    const imp = node(['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(join(d, script)).href)});`]);
    assert.equal(imp.status, 0, imp.stderr);
    assert.equal(existsSync(join(d, out)), false,
      `importing ${script} baked ${out} - under node --test a parallel worker reads that file mid-write`);
    const run = node([join(d, script)]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(d, out), 'utf8'), read(out), `${script}, run, bakes the committed ${out}`);
  }
});

test('AUDIT 68 S01-bake-run-guard-fragile: a bake run from a path with a space, or through a symlink, still bakes', (t) => {
  const d = tree(t, ['scripts/bakeWindmill.mjs', 'tools/lib', 'vendor/windmills-kamer']);
  mkdirSync(join(d, 'src/world'), { recursive: true });
  const out = join(d, 'src/world/windmillMesh.js');
  const want = read('src/world/windmillMesh.js');
  const r = node([join(d, 'scripts/bakeWindmill.mjs')]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(out) && readFileSync(out, 'utf8'), want, 'a space: import.meta.url spells it %20, argv[1] does not');
  rmSync(out);
  const link = join(scratch(t), 'link');
  symlinkSync(d, link, 'dir');
  const viaLink = node([join(link, 'scripts/bakeWindmill.mjs')]);
  assert.equal(viaLink.status, 0, viaLink.stderr);
  assert.equal(existsSync(out) && readFileSync(out, 'utf8'), want, 'a symlink: import.meta.url is the real path, argv[1] the link');
});

test('AUDIT 68 X5-main-guard-url-paths: one "am I the program" test for every tool and script, and no path read off a URL string', () => {
  const files = scripts().filter((f) => f !== 'tools/lib/isMain.mjs');
  assert.ok(files.length > 200, `the sweep read the tools (${files.length})`);
  assert.deepEqual(files.filter((f) => /process\.argv\[1\][^\n]*import\.meta\.url|import\.meta\.url[^\n]*process\.argv\[1\]/.test(read(f))), [],
    'these compare import.meta.url with argv[1] themselves - false under a space, a symlink or Windows; use tools/lib/isMain.mjs');
  assert.deepEqual(files.filter((f) => /import\.meta\.url\)\.pathname/.test(read(f))), [],
    'these read a filesystem path off a URL\'s pathname, which stays percent-encoded - use fileURLToPath');
});

test('AUDIT 68 S01-settingstext-labels-dead: the settings-text parse skips DFU\'s comment and schema lines, so no label is the schema', () => {
  assert.deepEqual(parseSettingsText('- a comment, with a comma\nschema: *key,text\nfoo, Bar'), { foo: 'Bar' });
  assert.deepEqual(Object.keys(SETTINGS_LABELS).filter((k) => /^schema:/i.test(k) || k.startsWith('-')), [],
    'the baked table carried "schema: *key" as a label');
});

// ── what the tree keeps out ──────────────────────────────────────────────

test('AUDIT 68 X2-dumpmidi-output-unignored: dumpMidi\'s default output - ARENA2 music - is ignored', () => {
  assert.doesNotThrow(() => execFileSync('git', ['check-ignore', '-q', 'midi-out/SONG_00.mid'], { cwd: ROOT }));
});

test('AUDIT 68 X2-probe-tmp-page-leak: the probes\' pages are ignored, and each is written inside the try whose finally unlinks it', () => {
  for (const p of ['tools/qs3-probe.tmp.html', 'play/foebar1-probe.tmp.html']) {
    assert.doesNotThrow(() => execFileSync('git', ['check-ignore', '-q', p], { cwd: ROOT }), `${p} is not ignored`);
  }
  const probes = scripts().filter((f) => /\.tmp\.html'/.test(read(f)));
  assert.ok(probes.length >= 7, `the probes that write a page (${probes.length})`);
  for (const f of probes) {
    const s = read(f);
    const open = s.search(/^try \{$/m), close = s.search(/^\} finally \{$/m);
    const writes = [...s.matchAll(/await writeFile\(/g)].map((m) => m.index);
    assert.ok(open > 0 && close > open && writes.length, `${f}: one top-level try/finally and a page write`);
    for (const w of writes) assert.ok(w > open && w < close, `${f}: a page written before the try stays behind when the browser fails to launch`);
  }
});

test('AUDIT 68 S06-villagerrender-double-compress: the still life draws the drape in the space draped.js authors - no second HSCALE', () => {
  const src = read('tools/villagerRender.mjs');
  assert.match(src, /return dr \? drapedPiece\(dr\.name, dr\.ramp\) : \[\];/);
  assert.doesNotMatch(src, /\bcompress\(/, 'buildNeutralBody and drapedPiece are both in the compressed rig already');
});

// ── the mutant runner ────────────────────────────────────────────────────

/** A scratch module package: target.js plus the given files, and a mutant list. */
function mutantBed(t, files, list) {
  const d = scratch(t);
  writeFileSync(join(d, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(join(d, 'target.js'), 'export const a = 1;\n');
  for (const [name, text] of Object.entries(files)) writeFileSync(join(d, name), text);
  writeFileSync(join(d, 'list.json'), JSON.stringify(list));
  return d;
}
const PASSES = "import { test } from 'node:test';\ntest('ok', () => {});\n";

test('AUDIT 68 X5-mutate-interrupt-loses-source: a .mutbak left by an interrupted run stops the next run before it touches anything', (t) => {
  const d = mutantBed(t, { 'ok.test.js': PASSES, 'target.js.mutbak': 'BACKUP' },
    [{ name: 'm', file: 'target.js', old: '= 1;', new: '= 2;', tests: ['ok.test.js'] }]);
  const r = node([join(ROOT, 'tools/mutate.mjs'), 'list.json'], { cwd: d });
  assert.equal(r.status, 2, r.stdout);
  assert.equal(readFileSync(join(d, 'target.js.mutbak'), 'utf8'), 'BACKUP', 'the only clean copy was copied over');
  assert.equal(readFileSync(join(d, 'target.js'), 'utf8'), 'export const a = 1;\n');
});

test('AUDIT 68 X5-mutate-interrupt-loses-source: a SIGTERM while the tests run puts the source back and stops', async (t) => {
  const slow = "import { test } from 'node:test';\nimport { writeFileSync } from 'node:fs';\n"
    + "test('slow', async () => { writeFileSync(new URL('./started', import.meta.url), ''); await new Promise((r) => setTimeout(r, 4000)); });\n";
  const d = mutantBed(t, { 'slow.test.js': slow }, [{ name: 'm', file: 'target.js', old: '= 1;', new: '= 2;', tests: ['slow.test.js'] }]);
  const child = spawn(process.execPath, [join(ROOT, 'tools/mutate.mjs'), 'list.json'], { cwd: d, stdio: 'ignore', env: ENV });
  const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));
  for (const t0 = Date.now(); !existsSync(join(d, 'started'));) {
    assert.ok(Date.now() - t0 < 30000, 'the mutant\'s tests never started');
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(readFileSync(join(d, 'target.js'), 'utf8'), 'export const a = 2;\n', 'the mutant is in place while its tests run');
  child.kill('SIGTERM');
  const { code, signal } = await exited;
  assert.deepEqual({ code, signal }, { code: 130, signal: null }, 'the harness outlives the signal long enough to restore');
  assert.equal(readFileSync(join(d, 'target.js'), 'utf8'), 'export const a = 1;\n', 'the source is back');
  assert.equal(existsSync(join(d, 'target.js.mutbak')), false);
});

test('AUDIT 68 X5-mutant-records-die-by-syntax-error: a mutant that does not parse is no verdict - unless its record says it means not to', (t) => {
  const pin = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from './target.js';\ntest('a', () => assert.equal(a, 1));\n";
  const rec = { name: 'm', file: 'target.js', old: '= 1;', new: '= (;', tests: ['t.test.js'] };
  const d = mutantBed(t, { 't.test.js': pin }, [rec]);
  const r = node([join(ROOT, 'tools/mutate.mjs'), 'list.json'], { cwd: d });
  assert.match(r.stdout, /m: DOES NOT PARSE/, 'it died of the SyntaxError, not of the pin');
  assert.equal(r.status, 1);
  writeFileSync(join(d, 'list.json'), JSON.stringify([{ ...rec, syntax: true }]));
  const meant = node([join(ROOT, 'tools/mutate.mjs'), 'list.json'], { cwd: d });
  assert.match(meant.stdout, /m: dead \(1 failing\)/);
  assert.equal(meant.status, 0);
});

test('AUDIT 68 X5-mutation-harness-enobufs-orphaned: confirm.mjs reads a whole suite past 1 MiB of TAP - a survivor is not "caught" by the buffer', (t) => {
  const d = mutantBed(t, {}, []);
  mkdirSync(join(d, 'test'));
  mkdirSync(join(d, '.mutaudit'));
  // ~2 MB of passing TAP: long names, so the suite is past the old 1 MiB ceiling without being slow
  writeFileSync(join(d, 'test/big.test.js'), "import { test } from 'node:test';\nconst pad = 'x'.repeat(300);\nfor (let i = 0; i < 3000; i++) test(`t${i} ${pad}`, () => {});\n");
  writeFileSync(join(d, 'spec.json'), JSON.stringify([{ file: 'target.js', line: 1, from: '1', to: '2' }]));
  const r = node([join(ROOT, 'tools/mutation/confirm.mjs'), join(d, 'spec.json')], { cwd: d });
  assert.equal(r.status, 0, r.stderr);
  const [res] = JSON.parse(readFileSync(join(d, '.mutaudit/confirm-spec.json'), 'utf8'));
  assert.equal(res.verdict, 'SURVIVED_FULL_SUITE', 'no test reads target.js, so the mutant survives');
  // and every whole-suite run in the harness lifts the ceiling
  for (const f of scripts().filter((x) => x.startsWith('tools/mutation/'))) {
    for (const m of read(f).matchAll(/spawnSync\(process\.execPath, \['--test'[^\]]*\], \{[^}]*\}/g)) {
      assert.match(m[0], /maxBuffer/, `${f}: ${m[0].slice(0, 60)}`);
    }
  }
});

// ── the cite tools ───────────────────────────────────────────────────────

const OLD = Array.from({ length: 400 }, (_, i) => `line ${i + 1}`);
const SHIFT = { oldLines: OLD, newLines: ['NEW', ...OLD], map: lineMap([{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]) };
const plan = (docText, target, extra = {}) => planDoc({ docText, target, ...SHIFT, ...extra });

test('AUDIT 68 X5-citeshift-foreign-path-and-ambiguous-basename: a directory before the basename names ONE file', () => {
  const doc = 'see `ui/zqgen.js:5` and `systems/zqgen.js:7`';
  const p = plan(doc, 'src/systems/zqgen.js');
  assert.deepEqual(p.map((x) => [x.text, x.status]), [['systems/zqgen.js:7', 'move']], 'ui/zqgen.js is another file');
  assert.equal(applyPlan(doc, p), 'see `ui/zqgen.js:5` and `systems/zqgen.js:8`');
  assert.deepEqual(plan('an absolute /work/repo/src/systems/zqgen.js:9', 'src/systems/zqgen.js').map((x) => x.status), ['move']);
  // a bare basename two targets of one run share is neither's to move
  assert.deepEqual(plan('zqloot.js:10, :12 and a/zqloot.js:20', 'src/a/zqloot.js', { ambiguousBare: true }).map((x) => [x.text, x.status]),
    [['zqloot.js:10', 'ambiguous'], ['a/zqloot.js:20', 'move'], [', :12', 'ambiguous']]);
});

test('AUDIT 68 X5-citeshift-foreign-path-and-ambiguous-basename: the CLI moves a shared basename once, never once per target', (t) => {
  const d = scratch(t);
  const git = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  cpSync(join(ROOT, 'tools/citeShift.mjs'), join(d, 'tools/citeShift.mjs'));
  cpSync(join(ROOT, 'tools/lib'), join(d, 'tools/lib'), { recursive: true });
  const body = Array.from({ length: 30 }, (_, i) => `export const l${i + 1} = ${i + 1};`).join('\n') + '\n';
  for (const f of ['src/a/zqloot.js', 'src/b/zqloot.js']) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), body); }
  mkdirSync(join(d, 'bible'));
  const doc = 'The hunt at zqloot.js:10; the roll at a/zqloot.js:12 and b/zqloot.js:14.\n';
  writeFileSync(join(d, 'bible/doc.md'), doc);
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  for (const f of ['src/a/zqloot.js', 'src/b/zqloot.js']) writeFileSync(join(d, f), '// one\n// two\n' + body);
  const r = node([join(d, 'tools/citeShift.mjs'), '--apply'], { cwd: d });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(readFileSync(join(d, 'bible/doc.md'), 'utf8'), 'The hunt at zqloot.js:10; the roll at a/zqloot.js:14 and b/zqloot.js:16.\n',
    'the bare cite is held for a person; each pathed cite moves by its own file, once');
  assert.match(r.stdout, /AMBIGUOUS/);
});

test('AUDIT 68 X5-citemerge-struck-continuations-move: a struck line holds its continuations too, and one that would not move is not work', () => {
  const T = 'src/zq/zqworld.js';
  const merge = { map: (n) => n + 1, oldLines: OLD, newLines: ['NEW', ...OLD] };
  const l = '| ~~**GONE** (F207)~~ FIXED - `zqworld.js:3/:5` both DELETED |';
  const r = mapLine(l, T, merge);
  assert.equal(r.out, l, 'the struck record keeps the pair its subject had');
  assert.equal(r.moved, 0);
  assert.deepEqual(r.held.map((h) => h.status), ['struck', 'struck']);
  assert.deepEqual(mapLine('~~x~~ zqworld.js:3', T, { ...merge, map: (n) => n, newLines: OLD }).held, [], 'nothing moved, nothing to hold');
});

test('AUDIT 68 X5-citeshift-escaped-regex-pins-never-move: a test\'s escaped cite that opens a regex, or escapes its path, moves with its file', () => {
  const out = (doc, target) => applyPlan(doc, plan(doc, target));
  assert.equal(out('assert.match(v, /zqsys\\/zqcast\\.js:158/)', 'src/zqsys/zqcast.js'), 'assert.match(v, /zqsys\\/zqcast\\.js:159/)');
  assert.equal(out('/zqform\\.js:306-307 statsToHit/', 'src/zq/zqform.js'), '/zqform\\.js:307-308 statsToHit/');
  assert.deepEqual(plan('/ui\\/zqgen\\.js:5/', 'src/systems/zqgen.js'), [], 'an escaped path names its file too');
});

// ── deploy verification ──────────────────────────────────────────────────

const page = ({ bundle, tag }) => `<head><meta name="build-tag" content="${tag}"></head><body><script type="module" src="./${bundle}"></script></body>`;

test('AUDIT 68 X5-verify-deploy-tag-length-bypasses-dirty: one commit stamped at two lengths is still one commit - a dirty build fails', () => {
  let asked = 0;
  const v = deployVerdict({
    localHtml: page({ bundle: 'assets/main-AAAA1111.js', tag: '62a2048c2' }),
    liveHtml: page({ bundle: 'assets/main-CCCC3333.js', tag: '62a2048' }),
    contains: () => { asked += 1; return true; },
  });
  assert.equal(v.kind, 'dirty', 'git answers that a commit contains itself, so this read VERIFIED');
  assert.equal(asked, 0);
});

test('AUDIT 68 X5-verify-deploy-tag-length-bypasses-dirty: the build tag is twelve characters of HEAD whatever the clone\'s size', (t) => {
  const d = scratch(t);
  const git = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  writeFileSync(join(d, 'a.txt'), 'a\n');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
  mkdirSync(join(d, 'src'));
  const r = node([join(ROOT, 'scripts/buildTag.mjs')], { cwd: d });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(d, 'src/buildTag.js'), 'utf8'), `export const BUILD_TAG = '${git('rev-parse', 'HEAD').slice(0, 12)}';\n`,
    'bare --short sizes it by the object count: 7 in this repo and in CI\'s shallow clone, 9 in a full one');
});

// ── the Ledger and the open flags ────────────────────────────────────────

test('AUDIT 68 X5-ledgersweep-section-c-runs-to-eof: section C stops at the next heading, and a ledger without it is an error', (t) => {
  const d = scratch(t);
  const ledger = join(d, 'ledger.md');
  writeFileSync(ledger, '## C. DFU features not yet ported\n| Feature | Source | Target |\n|---|---|---|\n| CROWONEQQ | x | y |\n\n'
    + '## D. THE BOARD\n| DROWZZQQ | x | y |\n');
  const r = node([join(ROOT, 'tools/ledgerSweep.mjs'), '--all', '--ledger', ledger]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /CROWONEQQ/);
  assert.doesNotMatch(r.stdout, /DROWZZQQ/, 'a section D row was swept as an unported feature');
  writeFileSync(ledger, '## D. THE BOARD\n| DROWZZQQ | x | y |\n');
  assert.notEqual(node([join(ROOT, 'tools/ledgerSweep.mjs'), '--ledger', ledger]).status, 0, 'no section C read as "0 unstruck rows"');
});

test('AUDIT 68 X5-regenopenflags-dies-at-zero: the open-flags list empties, stays checkable, and fills again', (t) => {
  const d = tree(t, ['tools/regenOpenFlags.mjs', 'tools/flagSites.mjs']);
  mkdirSync(join(d, 'bible'));
  mkdirSync(join(d, 'src/zq'), { recursive: true });
  writeFileSync(join(d, 'bible/Home.md'), '# H\n\n## Open flags\n\nprose\n\n- `src/zq/zqold.js:1` - FLAGGED: old\n\n## Next\n');
  writeFileSync(join(d, 'src/zq/zqold.js'), '// retired\n');
  const regen = (...a) => node([join(d, 'tools/regenOpenFlags.mjs'), ...a]);
  assert.equal(regen().status, 0);
  assert.equal(readFileSync(join(d, 'bible/Home.md'), 'utf8'), '# H\n\n## Open flags\n\nprose\n\n## Next\n');
  const check = regen('--check');
  assert.equal(check.status, 0, `the empty list the tool wrote is one it can read (${check.stderr})`);
  writeFileSync(join(d, 'src/zq/zqnew.js'), '// FLAGGED: new one\n');
  assert.equal(regen().status, 0);
  assert.equal(readFileSync(join(d, 'bible/Home.md'), 'utf8'), '# H\n\n## Open flags\n\nprose\n\n- `src/zq/zqnew.js:1` - FLAGGED: new one\n\n## Next\n');
});
