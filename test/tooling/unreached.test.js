// UNREACHED (CLEANUP, 2026-10-30; bible/01-Overview/Code-Map.md): a module under src/ that no page, relay, worker, app,
// script or tool reaches runs only in its own tests. tools/unreached.mjs finds them; tools/unreachedBaseline.json lists
// the ones staged on purpose, each with its why. Anything else unreached fails here: wire it, or delete it with its tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { BASELINE, specifiersIn, unreached, verdict, globPattern } from '../../tools/unreached.mjs';

const base = JSON.parse(readFileSync(new URL(`../../${BASELINE}`, import.meta.url), 'utf8'));

test('UNREACHED every shape the tree loads a module by is read; a package, a template and a negated glob are not (mutants: a shape dropped from the pattern; the query kept; a negated glob walked)', () => {
  const text = [
    "import { a } from './a.js';", "export { b } from '../b.js';", "import './side.js';", "const c = await import('./c.js');",
    '<script type="module" src="/src/main.js"></script>', "new Worker(new URL('./w.js', import.meta.url));",
    "new SharedWorker('./s.js');", "import d from './d.js?worker';", "import x from 'acorn';", 'import(`./t/${n}.js`);',
    "import.meta.glob('./g/*.js');", "import.meta.glob(['./h/*.js', '!./h/skip.js']);",
  ].join('\n');
  const { plain, globs } = specifiersIn(text);
  assert.deepEqual(plain, ['./a.js', '../b.js', './side.js', './c.js', '/src/main.js', './w.js', './s.js', './d.js']);
  assert.deepEqual(globs, ['./g/*.js', './h/*.js']);
});

test('UNREACHED a module is reached through any depth from a page, main.js, a tool or a glob, and only an orphan is left (mutants: the walk stops at depth one; tools not an entry; a glob not followed)', () => {
  const root = mkdtempSync(join(tmpdir(), 'unreached-'));
  const put = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); };
  try {
    put('index.html', '<script type="module" src="/src/page.js"></script>');
    put('src/page.js', "import './deep/one.js';");
    put('src/deep/one.js', "import { two } from './two.js';");
    put('src/deep/two.js', 'export const two = 2;');
    put('src/main.js', "import.meta.glob('./g/*.js');");
    put('src/g/x.js', '');
    put('tools/t.mjs', "import '../src/byTool.js';");
    put('src/byTool.js', '');
    put('src/orphan.js', "import './deep/two.js';");
    assert.deepEqual(unreached(root), ['src/orphan.js']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('UNREACHED a glob reaches what its whole pattern names, from the root when it starts there, and an import with no semicolon before it is still read (AUDIT, 2026-10-31; mutants: a glob read by its prefix; a root glob read from the file; the import read across a quote; a comma read outside braces)', () => {
  assert.deepEqual(specifiersIn("export { a }\nimport './side.js'\nimport b from './b.js'").plain, ['./side.js', './b.js']);
  assert.equal(globPattern('src/a,b.js').test('src/a,b.js'), true, 'a comma outside braces is a comma');
  assert.equal(globPattern('src/a,b.js').test('src/a'), false, 'and no alternation');
  assert.equal(globPattern('src/{a,b}/*.js').test('src/b/x.js'), true);
  const root = mkdtempSync(join(tmpdir(), 'unreached-glob-'));
  const put = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); };
  try {
    put('src/main.js', "import.meta.glob('./g/*.txt'); import.meta.glob('/src/r/*.js');");
    put('src/g/a.txt', '');
    put('src/g/data.js', '');
    put('src/gate.js', '');
    put('src/r/y.js', '');
    assert.deepEqual(unreached(root), ['src/g/data.js', 'src/gate.js']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('UNREACHED the verdict: an unlisted module is dead, and a listed one reached again or gone is stale (mutants: either side unread)', () => {
  assert.deepEqual(verdict(['src/a.js', 'src/b.js'], { 'src/a.js': 'staged' }), { dead: ['src/b.js'], stale: [] });
  assert.deepEqual(verdict(['src/a.js'], { 'src/a.js': 'staged', 'src/c.js': 'wired since' }), { dead: [], stale: ['src/c.js'] });
});

test('UNREACHED the tree: every module nothing ships is staged in the baseline with its why, and the baseline lists nothing reached (node tools/unreached.mjs)', () => {
  const { dead, stale } = verdict(unreached(), base);
  assert.deepEqual(dead, [], 'reached by nothing but its tests - wire it, delete it, or stage it in the baseline with its why');
  assert.deepEqual(stale, [], `reached now or gone - take its line out of ${BASELINE}`);
  for (const [file, why] of Object.entries(base)) assert.ok(why.trim().length > 0, `${file} is staged with no why`);
});
