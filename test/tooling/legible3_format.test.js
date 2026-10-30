// LEGIBLE 3 (bible/01-Overview/Readability-Arc.md): the formatter owns the layout of the folders tools/formatted.json
// lists - Prettier at one pinned version and one configuration. A listed folder that drifts from it fails here; a folder
// joins by one change that formats it with its pins carried (node tools/carryPins.mjs --transform tools/format.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ROOT, IGNORE, formattedFolders, ignoreText, transform, unformatted } from '../../tools/format.mjs';

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

test('LEGIBLE 3 .prettierignore leaves every unlisted path alone and opens each listed folder through its parents, its own subfolders shut unless listed (mutants: a parent left shut; a listed folder\'s subfolders opened)', () => {
  assert.equal(ignoreText(['src/ui/ink', 'src/poi', 'src/poi/uv']), [
    '# Written by node tools/format.mjs --ignore from tools/formatted.json - edit that, not this.',
    '/*', '!/src/', '/src/*', '!/src/poi/', '/src/poi/*/', '!/src/poi/uv/', '/src/poi/uv/*/', '!/src/ui/', '/src/ui/*',
    '!/src/ui/ink/', '/src/ui/ink/*/', '',
  ].join('\n'));
  assert.equal(ignoreText(['src/systems/a.js', 'src/systems/item']), [
    '# Written by node tools/format.mjs --ignore from tools/formatted.json - edit that, not this.',
    '/*', '!/src/', '/src/*', '!/src/systems/', '/src/systems/*', '!/src/systems/a.js', '!/src/systems/item/', '/src/systems/item/*/', '',
  ].join('\n'), 'a file listed on its own opens alone, its folder shut round it');
  assert.equal(read(IGNORE), ignoreText(formattedFolders()), 'written from the list: node tools/format.mjs --ignore');
});

test('LEGIBLE 3 the tree: every file of every listed folder is formatted, and the list names each folder once, in order (node tools/format.mjs --check)', async () => {
  const folders = formattedFolders();
  assert.deepEqual(folders, [...new Set(folders)].sort());
  assert.deepEqual(await unformatted(), [], 'formatted by hand or not at all - run npx prettier --write on the file');
});
