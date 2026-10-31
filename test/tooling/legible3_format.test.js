// LEGIBLE 3 (bible/01-Overview/Readability-Arc.md): the formatter owns the layout of the folders tools/formatted.json
// lists - Prettier at one pinned version and one configuration. A listed folder that drifts from it fails here; a folder
// joins by one change that formats it with its pins carried (node tools/carryPins.mjs --transform tools/format.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import * as prettier from 'prettier';
import { ROOT, IGNORE, formattedFolders, ignoreText, transform, unformatted, missingEntries } from '../../tools/format.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('LEGIBLE 3 one version: the formatter is pinned exactly in package.json, and that is the one installed', () => {
  const pinned = JSON.parse(read('package.json')).devDependencies.prettier;
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'an exact version - a range would let two machines format one file two ways');
  assert.equal(JSON.parse(read('node_modules/prettier/package.json')).version, pinned);
});

test('LEGIBLE 3 the transform is synchronous, formats by the repository\'s configuration and changes nothing it already formatted (mutant: the wait dropped)', () => {
  const once = transform('const a = {b:"c"}\nfunction f(){return a}\n', 'src/poi/x.js');
  assert.equal(once, "const a = { b: 'c' };\nfunction f() {\n  return a;\n}\n");
  assert.equal(transform(once, 'src/poi/x.js'), once);
});

test('LEGIBLE 3 a listed file the formatter would change is named, and an unlisted one - another folder, or a subfolder of a listed one - is not looked at (mutants: the check unread; a subfolder walked)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'legible3-'));
  try {
    mkdirSync(join(root, 'tools'));
    mkdirSync(join(root, 'a'));
    mkdirSync(join(root, 'b'));
    writeFileSync(join(root, 'tools/formatted.json'), '["a"]');
    writeFileSync(join(root, 'a/messy.js'), 'const x={a:1}\n');
    writeFileSync(join(root, 'a/tidy.js'), 'const y = 1;\n');
    writeFileSync(join(root, 'b/messy.js'), 'const z={a:1}\n');
    mkdirSync(join(root, 'a/sub'));
    writeFileSync(join(root, 'a/sub/messy.js'), 'const w={a:1}\n');
    assert.deepEqual(await unformatted(root), ['a/messy.js']);
    writeFileSync(join(root, 'tools/formatted.json'), '["a/sub/messy.js", "b"]');
    assert.deepEqual(await unformatted(root), ['a/sub/messy.js', 'b/messy.js'], 'a file listed on its own, beside a folder');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('LEGIBLE 3 a listed folder or file that is not there is named, and the check reads the rest (AUDIT, 2026-10-31; mutant: a missing entry read)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'legible3-missing-'));
  try {
    mkdirSync(join(root, 'tools'));
    mkdirSync(join(root, 'a'));
    writeFileSync(join(root, 'a/messy.js'), 'const w={a:1}\n');
    writeFileSync(join(root, 'tools/formatted.json'), '["a", "gone", "gone.js"]');
    assert.deepEqual(missingEntries(root), ['gone', 'gone.js']);
    assert.deepEqual(await unformatted(root), ['a/messy.js'], 'no throw on the missing ones');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('LEGIBLE 3 .prettierignore leaves every unlisted path alone and opens each listed folder through its parents - its own .js and .mjs files only, its subfolders shut unless listed (mutants: a parent left open; a listed folder\'s other files opened; its code left shut)', async () => {
  const H = '# Written by node tools/format.mjs --ignore from tools/formatted.json - edit that, not this.';
  const code = (d) => [`!/${d}/*.js`, `!/${d}/*.mjs`];
  assert.equal(ignoreText(['src/ui/ink', 'src/poi', 'src/poi/uv']), [
    H, '/*', '!/src/', '/src/*', '!/src/poi/', '/src/poi/*', ...code('src/poi'), '!/src/poi/uv/', '/src/poi/uv/*', ...code('src/poi/uv'),
    '!/src/ui/', '/src/ui/*', '!/src/ui/ink/', '/src/ui/ink/*', ...code('src/ui/ink'), '',
  ].join('\n'));
  assert.equal(ignoreText(['src/systems/a.js', 'src/systems/item']), [
    H, '/*', '!/src/', '/src/*', '!/src/systems/', '/src/systems/*', '!/src/systems/a.js', '!/src/systems/item/', '/src/systems/item/*', ...code('src/systems/item'), '',
  ].join('\n'), 'a file listed on its own opens alone, its folder shut round it');
  // AUDIT (2026-10-31): read as Prettier reads it - a listed folder's README and page stay its own
  const root = mkdtempSync(join(tmpdir(), 'legible3-ignore-'));
  try {
    for (const f of ['a/x.js', 'a/y.mjs', 'a/README.md', 'a/page.html', 'a/sub/z.js', 'b/w.js']) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), '');
    }
    writeFileSync(join(root, '.prettierignore'), ignoreText(['a']));
    const opened = [];
    for (const f of ['a/x.js', 'a/y.mjs', 'a/README.md', 'a/page.html', 'a/sub/z.js', 'b/w.js'])
      if (!(await prettier.getFileInfo(join(root, f), { ignorePath: join(root, '.prettierignore') })).ignored) opened.push(f);
    assert.deepEqual(opened, ['a/x.js', 'a/y.mjs']);
  } finally { rmSync(root, { recursive: true, force: true }); }
  assert.equal(read(IGNORE), ignoreText(formattedFolders()), 'written from the list: node tools/format.mjs --ignore');
});

test('LEGIBLE 3 the tree: every file of every listed folder is formatted, and the list names each folder once, in order (node tools/format.mjs --check)', async () => {
  const folders = formattedFolders();
  assert.deepEqual(folders, [...new Set(folders)].sort());
  assert.deepEqual(await unformatted(), [], 'formatted by hand or not at all - run npx prettier --write on the file');
});
