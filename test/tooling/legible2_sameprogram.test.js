// LEGIBLE 2 (bible/01-Overview/Readability-Arc.md): tools/sameProgram.mjs proves a mechanical change changed nothing -
// layout, comments and spelling are free, behaviour is not, and a name may change only where it was asked to, only for a
// variable, and only if every use still reaches the same declaration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sameProgram } from '../../tools/sameProgram.mjs';
import { breakLines } from '../breakLines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const same = (a, b, renames) => sameProgram(a, b, { renames });
const assertSame = (a, b, renames) => {
  const result = same(a, b, renames);
  assert.ok(result.same, `expected the same program: ${result.why}`);
};
const assertDiffers = (a, b, renames, why) => {
  const result = same(a, b, renames);
  assert.equal(result.same, false, `expected a difference between\n${a}\nand\n${b}`);
  if (why) assert.match(result.why, why);
  return result;
};

test('LEGIBLE 2 sameProgram: layout, comments, quote style, redundant parentheses and a number\'s spelling are the same program (mutants: a literal compared by its spelling)', () => {
  assertSame('const a = 1; function f(x) { return x + a; }', 'const a = 1;\nfunction f(x) {\n  return x + a;\n}\n');
  assertSame("const s = 'x'; // why\nconst t = (1 + 2);", 'const s = "x";\n/* other words */ const t = 1 + 2;');
  assertSame('const list = [1, 2, 3,];', 'const list = [\n  1,\n  2,\n  3,\n];');
  assertSame('const big = 1e3;', 'const big = 1000;');
});

test('LEGIBLE 2 sameProgram: a change to what the code does is not the same program, and it says where (mutants: a template\'s text uncompared)', () => {
  const result = assertDiffers('const t = 1 + 2;\nconst u = 3;', 'const t = 1 + 2;\nconst u = 4;', undefined, /3 became 4/);
  assert.deepEqual(result.before, { line: 2, column: 10 });
  assertDiffers('const t = 1 + 2;', 'const t = 1 - 2;', undefined, /operator/);
  assertDiffers('const a = `x${b}y`;', 'const a = `x${b}z`;', undefined, /template/);
  assertDiffers('const r = /a/g;', 'const r = /a/i;', undefined, /regular expression/);
  assertDiffers('f(); g();', 'f();', undefined, /number of parts/);
  assertDiffers('if (a) b();', 'if (a) { b(); }', undefined, /ExpressionStatement became a BlockStatement/);
});

test('LEGIBLE 2 sameProgram: a variable may be renamed only where asked, and only if every use still reaches the same declaration (mutants: a rename not asked for passes; the pairing unchecked; a rename beside eval passes)', () => {
  const before = 'function f(p) { return p * 2; }';
  const after = 'function f(pixel) { return pixel * 2; }';
  assertSame(before, after, { p: 'pixel' });
  assertDiffers(before, after, undefined, /not asked for/);
  // the rename lands on a name already in use: the local now hides the module's `pixel`
  assertDiffers('const pixel = 9; function f(p) { return p + pixel; }', 'const pixel = 9; function f(pixel) { return pixel + pixel; }', { p: 'pixel' }, /different declaration/);
  // a local that becomes a global's name reaches a different binding
  assertDiffers('function f() { const n = 1; return n; }', 'function f() { const n = 1; return window; }', { n: 'window' }, /declared variable/);
  // eval can read any name, so no rename beside it is provable
  assertDiffers('function f(p) { eval(code); return p; }', 'function f(pixel) { eval(code); return pixel; }', { p: 'pixel' }, /eval/);
});

test('LEGIBLE 2 sameProgram: names other code reads keep their spelling - exports, import and export names, property keys, member names (mutants: member names free; exported declarations free; an import\'s outer name free)', () => {
  const renames = { dw: 'deepWaters', dwTerrain: 'deepWaterTerrain' };
  assertDiffers('export const dw = 1;', 'export const deepWaters = 1;', renames, /other code reads the name/);
  assertSame('const dw = 1; export { dw };', 'const deepWaters = 1; export { deepWaters as dw };', renames);
  assertSame("import { dw } from './x.js'; dw();", "import { dw as deepWaters } from './x.js'; deepWaters();", renames);
  assertDiffers("import { dw } from './x.js'; dw();", "import { deepWaters } from './x.js'; deepWaters();", renames, /imported name/);
  assertSame('const dw = 1; const o = { dw };', 'const deepWaters = 1; const o = { dw: deepWaters };', renames);
  assertDiffers('const dw = 1; const o = { dw };', 'const deepWaters = 1; const o = { deepWaters };', renames, /other code reads the name/);
  assertDiffers('o.dwTerrain = 1;', 'o.deepWaterTerrain = 1;', renames, /other code reads the name/);
  assertDiffers('class K { dw() {} }', 'class K { deepWaters() {} }', renames, /other code reads the name/);
});

test('LEGIBLE 2 sameProgram: real files split by the layout-only transform are the same programs, and the same file with a real mutant applied is not', () => {
  for (const path of ['tools/hostScope.mjs', 'src/systems/gambit/gambitPatrons.js', 'src/characters/foeBodies.js', 'src/systems/smithItems.js']) {
    const source = read(path);
    const split = breakLines(source);
    assert.ok(split.split('\n').length > source.split('\n').length, `${path}: the transform split no line`);
    assertSame(source, split);
  }
  const [record] = JSON.parse(read('tools/mutants/legible1.json'));
  const source = read(record.file);
  assertDiffers(source, source.replace(record.old, record.new));
});
