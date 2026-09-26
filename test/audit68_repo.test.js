// AUDIT 68 (2026-09-24), cluster "repo": the house around the code - the
// release workflow's gate and tag, the dev server's data door, the build's
// page list, the lab's frame, the lint's reach, the runner's glob and the
// CDN scripts' integrity. Each pin failed on the tree before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const tracked = (spec) => execFileSync('git', ['ls-files', spec], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

test('AUDIT 68 X2-release-red-suite-ships: the suite is a JOB every packaging leg needs, not a step inside one leg', () => {
  const wf = read('.github/workflows/release-desktop.yml');
  const jobs = wf.slice(wf.indexOf('\njobs:\n'));
  const job = (name) => {
    const at = jobs.indexOf(`\n  ${name}:\n`);
    assert.ok(at >= 0, `release-desktop has a ${name} job`);
    const rest = jobs.slice(at + 1);
    const end = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n/);
    return end < 0 ? rest : rest.slice(0, end + 1);
  };
  const gate = job('gate'), build = job('build');
  assert.match(gate, /\n {8}run: npm run check\n/, 'the gate job runs the whole house check');
  assert.match(build, /^ {4}needs: gate$/m, 'every OS leg waits for the suite before it packages or attaches anything');
  assert.doesNotMatch(build, /npm run check/, 'the check is not a step one leg carries and two legs skip');
  assert.doesNotMatch(build, /if: matrix\.os/, 'every leg builds the site the same way');
});

test('AUDIT 68 X2-release-tag-commit: a new release tag is cut at the built commit, and the dispatch input is data, not script', () => {
  const wf = read('.github/workflows/release-desktop.yml');
  const attach = wf.slice(wf.indexOf('- name: Attach installers to the release'), wf.indexOf('- name: Keep installers as run artifacts'));
  assert.match(attach, /\n {10}tag_name: \$\{\{ steps\.reltag\.outputs\.tag \}\}\n {10}target_commitish: \$\{\{ github\.sha \}\}\n/,
    'without target_commitish GitHub cuts the tag at main\'s head at upload time');
  const uses = wf.split('\n').filter((l) => l.includes('${{ inputs.release_tag }}'));
  assert.ok(uses.length > 0, 'the input is still read');
  for (const line of uses) {
    assert.match(line, /^ +RELEASE_TAG: \$\{\{ inputs\.release_tag \}\}$/, `read through env, never pasted into bash: ${line.trim()}`);
  }
});

/** The dev server's arena2 middleware over a fake ARENA2 folder - its two mounts. */
async function devMounts(fake) {
  process.env.ARENA2_PATH = fake;
  const viteConfig = (await import(`../vite.config.js?audit68=${Date.now()}`)).default;
  const plugin = viteConfig.plugins.find((p) => p?.name === 'arena2-dev-server');
  const mounts = [];
  plugin.configureServer({ middlewares: { use: (mount, fn) => mounts.push([mount, fn]) } });
  return mounts;
}
/** One request to a mount: its status and body. */
const serve = (fn, url) => new Promise((resolve, reject) => {
  const body = [];
  const res = new Writable({ write(chunk, _e, cb) { body.push(chunk); cb(); } });
  res.setHeader = () => {};
  res.statusCode = 200;
  const t = setTimeout(() => reject(new Error(`${url}: no answer`)), 5000);
  const done = () => { clearTimeout(t); resolve({ status: res.statusCode, body: Buffer.concat(body).toString() }); };
  res.on('finish', done);
  fn({ url }, res, done);
});

test('AUDIT 68 X2-devserver-eisdir-crash: a directory name answers 404 and the dev server lives', async () => {
  const fake = mkdtempSync(join(tmpdir(), 'audit68-arena2-'));
  mkdirSync(join(fake, 'BOOKS'));
  writeFileSync(join(fake, 'BOOKS', 'BOK00001.TXT'), 'a book');
  try {
    const mounts = await devMounts(fake);
    for (const [mount, fn] of mounts) {
      for (const url of ['/BOOKS', '/.', '/..']) {
        assert.deepEqual(await serve(fn, url), { status: 404, body: 'not found' }, `${mount}${url} names a directory, not a file`);
      }
      assert.deepEqual(await serve(fn, '/BOK00001.TXT'), { status: 200, body: 'a book' }, `${mount}: the BOOKS fallback still serves`);
    }
  } finally {
    delete process.env.ARENA2_PATH;
    rmSync(fake, { recursive: true, force: true });
  }
});

test('AUDIT 68 X2 (books): the BOOKS fallback finds DFU\'s own lowercase `books` folder, and a lowercase file in it', async () => {
  // BookFile.cs:27 opens "books"; the dev server asked for 'BOOKS' by
  // literal, so on a case-sensitive disk every book 404'd in dev
  // (app/main.cjs already looked both up case-insensitively)
  const fake = mkdtempSync(join(tmpdir(), 'audit68-books-'));
  mkdirSync(join(fake, 'books'));
  writeFileSync(join(fake, 'books', 'bok00002.txt'), 'a lowercase book');
  try {
    const mounts = await devMounts(fake);
    assert.equal(mounts.length, 2, 'both doors');
    for (const [mount, fn] of mounts) {
      assert.deepEqual(await serve(fn, '/BOK00002.TXT'), { status: 200, body: 'a lowercase book' }, `${mount}: the books folder and its file, whatever their case`);
      assert.deepEqual(await serve(fn, '/BOK00003.TXT'), { status: 404, body: 'not found' }, `${mount}: a book not there is still a 404`);
    }
  } finally {
    delete process.env.ARENA2_PATH;
    rmSync(fake, { recursive: true, force: true });
  }
});

test('AUDIT 68 X2-archive-sheet-orphan: every tracked root page is a build input', async () => {
  // bible/Home.md: "Prototype HTMLs at repo root must register in
  // vite.config.js rollupOptions.input" - held here, not by memory.
  const input = Object.values((await import('../vite.config.js')).default.build.rollupOptions.input);
  const pages = tracked('*.html').filter((p) => !p.includes('/'));
  assert.ok(pages.includes('index.html'));
  for (const page of pages) assert.ok(input.includes(page), `${page} works under npm run dev and never ships`);
});

test('AUDIT 68 X2-cdn-three-no-sri: every script a tracked page loads from another origin carries Subresource Integrity', () => {
  let seen = 0;
  for (const page of tracked('*.html')) {
    for (const [tag] of read(page).matchAll(/<script\b[^>]*\bsrc="(?:https?:)?\/\/[^"]*"[^>]*>/g)) {
      seen++;
      assert.match(tag, /\bintegrity="sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}"/, `${page}: ${tag}`);
      assert.match(tag, /\bcrossorigin="anonymous"/, `${page}: SRI on a cross-origin script needs CORS mode`);
    }
  }
  assert.ok(seen > 0, 'the pages still load three.js from cdnjs - this pin is not vacuous');
});

test('AUDIT 68 S08-gunproto-inlines-gunFrameRect: the gun lab draws through the game\'s frame rather than restating it', () => {
  const page = read('gun-proto.html');
  assert.match(page, /\bgunFrameRect\(\{/, 'the page composes its frame with combat/gunViewmodel.gunFrameRect (via gunLab.js)');
  for (const step of ['placeSprite(', 'widgetTransformRect(', 'unionDrawRect(']) {
    assert.ok(!page.includes(step), `the page calls ${step} itself - a second copy of the frame the game draws`);
  }
});

test('AUDIT 68 X2-eslint-coverage-gaps: tests, tools, scripts and the desktop shell are linted for the structural rules', async () => {
  const lint = JSON.parse(read('package.json')).scripts.lint.split(/\s+/);
  for (const dir of ['src/', 'test/', 'tools/', 'scripts/', 'app/']) assert.ok(lint.includes(dir), `npm run lint reaches ${dir}`);
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({ cwd: root });
  for (const [file, code, rule] of [
    ['test/audit68_probe.test.js', 'export const o = { race: -1, race: 3 };\n', 'no-dupe-keys'],
    ['tools/audit68Probe.mjs', 'const n = 1;\nn = 2;\n', 'no-const-assign'],
    ['scripts/audit68Probe.mjs', 'export function f() { return 1; return probe.lit; }\n', 'no-unreachable'],
    ['app/lib/audit68Probe.cjs', 'module.exports = { a: 1, a: 2 };\n', 'no-dupe-keys'],
  ]) {
    const [res] = await eslint.lintText(code, { filePath: join(root, file) });
    assert.ok(res.messages.some((m) => m.ruleId === rule && m.severity === 2), `${file}: ${rule} is an error`);
  }
});

test('AUDIT 68 X2-npm-test-glob: npm test runs the test files, not the helpers beside them', () => {
  // bare `node --test` also discovers **/test/**/*.{js,mjs,cjs}, so every
  // helper module in test/ ran as a "passing test" of its own
  assert.equal(JSON.parse(read('package.json')).scripts.test, 'node --test "test/*.test.js"');
  const stray = tracked('*.js').concat(tracked('*.mjs'), tracked('*.cjs'))
    .filter((f) => /\.test\.[cm]?js$/.test(f) && !/^test\/[^/]+\.test\.js$/.test(f));
  assert.deepEqual(stray, [], 'every test file sits where the glob looks');
});
