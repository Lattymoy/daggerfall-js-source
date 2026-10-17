// AUDIT HOST-SPLIT 1 (2026-10-15) - THE MOVE IS PROVEN BY WHAT THE MOVED CODE DOES.
// tools/hostMove.mjs moves a group of a host function's members into a module of its own, and will move far more
// than the pilot's 229 lines; the audit proved, fixture by fixture, the places its rules went wrong. Each fixture
// here is one of them: a host and a group, moved for real into a scratch directory, the original and the moved
// version both imported and run - the move holds only if both say the same thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { planMove, renderMove, unusedImports, dropImports, retargetRecords } from '../../tools/hostMove.mjs';

const DEP = "export const K = 1;\n";
/** [name, host source (exports `host`), the group, how to read the host's result] */
const CASES = [
  // a for-of head writes a binding: never a copy (the audit's f1 - the copy read 1, the host 3)
  ['for-of-write', `import { K } from './dep.js';
export function host() {
  let cur = K;
  const g = () => cur;
  for (cur of [2, 3]) { /* write via for-of */ }
  return g;
}
`, ['g'], (h) => h()()],
  // a function or class declaration someone reassigns is a binding like any other (f2: "a1A" against "bB")
  ['reassigned-declarations', `import { K } from './dep.js';
export function host() {
  function hook() { return 'a' + K; }
  class Kind { static tag() { return 'A'; } }
  const g = () => hook() + Kind.tag();
  hook = () => 'b';
  Kind = class { static tag() { return 'B'; } };
  return g;
}
`, ['g'], (h) => h()()],
  // the group writes a live name by a for-of head: it gets its setter (f3 threw)
  ['for-of-write-live', `import { K } from './dep.js';
export function host() {
  let cur = K;
  cur = 5;
  function g() { for (cur of [7]) { /* group writes a live name by for-of */ } return cur; }
  return () => [g(), cur];
}
`, ['g'], (h) => h()()],
  // a parameter's default reads the HOST's binding, never the body's own of the same name (f4 threw)
  ['default-parameter-scope', `import { K } from './dep.js';
export function host() {
  let mode = 'a' + K;
  mode = 'b';
  function g(x = mode) { const mode = 'local'; return [x, mode]; }
  return g;
}
`, ['g'], (h) => h()()],
  // a host var declared in a block is the host function's (f5 left it a global)
  ['hoisted-var', `import { K } from './dep.js';
export function host() {
  if (K) { var hv = 42; }
  const g = () => hv;
  return g;
}
`, ['g'], (h) => h()()],
  // a shorthand with a default, in an assignment pattern, keeps its key (f6 wrote \`{ host.s = 1 }\`)
  ['shorthand-default', `import { K } from './dep.js';
export function host() {
  let s = K;
  const g = (o) => { ({ s = 1 } = o); return s; };
  s = 2;
  return g;
}
`, ['g'], (h) => [h()({}), h()({ s: 9 })]],
  // new.target is no reference (f7 wrote \`new.host.target\`)
  ['new-target', `import { K } from './dep.js';
export function host() {
  let target = K;
  target = 2;
  function g() { return new.target === undefined && target === 2; }
  return g;
}
`, ['g'], (h) => h()()],
  // a comment ending the code line above the group is that line's, not the group's doc (PARTY-LOOT's move took the
  // host's `let` along with it, and the host's own write of it threw)
  ['trailing-comment-above', `import { K } from './dep.js';
export function host() {
  let count = K;   // a host let whose line ends in a comment
  // the group's own doc
  const g = () => ++count;
  count = 10;
  return () => [g(), count];
}
`, ['g'], (h) => h()()],
  // a host with no import line still takes the constructor's (f8 crashed)
  ['no-imports', `export function host() {
  const x = 1;
  const g = () => x;
  return g;
}
`, ['g'], (h) => h()()],
];

const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hostmove-'));
  writeFileSync(join(dir, 'dep.js'), DEP);
  return dir;
};
const run = async (file, read) => {
  try { return JSON.stringify(read((await import(`${pathToFileURL(file).href}?${Date.now()}`)).host)); } catch (e) { return `THROW ${e.constructor.name}: ${e.message}`; }
};

test('HOST-SPLIT 1 (AUDIT) THE MOVED CODE SAYS WHAT THE HOST SAID: for-of writes, reassigned function and class declarations, a parameter default beside a body binding of its name, a host var in a block, a shorthand with a default, new.target, a host with no imports - each fixture moved for real, both versions run, the same answer (mutants: a for-of head no write; a declaration settled whatever writes it; the parameters in the body\'s scope)', async () => {
  const dir = scratch();
  try {
    const wrong = [];
    for (const [name, src, group, read] of CASES) {
      const hostFile = join(dir, `${name}.js`), toFile = join(dir, `${name}_mod.js`);
      writeFileSync(hostFile, src);
      const p = planMove({ hostFile, fn: 'host', names: group, toFile, ctor: 'createG' });
      if (p.refuse.length) { wrong.push(`${name}: refused - ${p.refuse.join('; ')}`); continue; }
      const r = renderMove(p);
      for (const [what, text] of [['module', r.moduleText], ['host', r.hostText]]) {
        try { parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { wrong.push(`${name}: the moved ${what} does not parse - ${e.message}`); }
      }
      const movedHost = join(dir, `${name}_host.js`);
      writeFileSync(toFile, r.moduleText);
      writeFileSync(movedHost, dropImports(r.hostText, unusedImports(r.hostText, [...p.mod.keys()])));
      const before = await run(hostFile, read), after = await run(movedHost, read);
      if (before !== after) wrong.push(`${name}: the host said ${before}, the moved code ${after}`);
    }
    assert.deepEqual(wrong, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HOST-SPLIT 1 (AUDIT) THE HANDLE CAPTURES NOTHING: a group whose code binds or reads the handle\'s own name anywhere - an inner parameter called host - is refused, never rewritten under it (the audit\'s f9: a map\'s callback parameter read every live name as its own) (mutants: only an unresolved host refused)', () => {
  const dir = scratch();
  try {
    const hostFile = join(dir, 'shadow.js');
    writeFileSync(hostFile, `import { K } from './dep.js';
export function host() {
  let social = K;
  social = 'live';
  const g = (rows) => rows.map((host) => \`\${host}:\${social}\`);
  return g;
}
`);
    const p = planMove({ hostFile, fn: 'host', names: ['g'], toFile: join(dir, 'shadow_mod.js'), ctor: 'createG' });
    assert.ok(p.refuse.some((x) => /already uses the name `host`/.test(x)), `refused: ${JSON.stringify(p.refuse)}`);
    const q = planMove({ hostFile, fn: 'host', names: ['g'], toFile: join(dir, 'shadow_mod.js'), ctor: 'createG', handle: 'hostOf' });
    assert.deepEqual(q.refuse, [], 'another handle moves it');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HOST-SPLIT 1 (AUDIT) THE TOOL TOUCHES ONLY WHAT MOVED: an import dropped from the host takes no sibling on its line; a mutant record is found by its own braces - its name last, a brace in a neighbour\'s quoted text - and retargeted alone; an anchor into overworld.js is not one into world.js (mutants: the whole line dropped; a quoted brace read as structure; the anchor with no left edge)', () => {
  // two imports on one line, one of them now unread
  const twoOnALine = "import { a } from './a.js'; import { b } from './b.js';\nexport const x = b;\n";
  const kept = dropImports(twoOnALine, ['a']);
  assert.match(kept, /import \{ b \} from '\.\/b\.js';/, 'the sibling stands');
  assert.doesNotMatch(kept, /import \{ a \}/);
  assert.equal(dropImports("import { a } from './a.js';   // why\nexport const x = 1;\n", ['a']), 'export const x = 1;\n', 'alone on its line, the line goes - its comment with it');

  const root = mkdtempSync(join(tmpdir(), 'hostmove-rec-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'tools/mutants'), { recursive: true });
    mkdirSync(join(root, 'bible'), { recursive: true });
    writeFileSync(join(root, 'src/world.js'), 'const stays = 1;\n');
    writeFileSync(join(root, 'src/marks.js'), 'if (on) { const moved = host.live + 1;\n');
    // the moved record writes its name LAST, and its own quoted text an unclosed brace; its neighbour's a stray one -
    // each stays the other's
    const moved = '{"file": "src/world.js", "old": "if (on) { const moved = live + 1;", "new": "if (on) { const moved = live;", "tests": [], "name": "name-last"}';
    const other = '{"name": "brace-quoted", "file": "src/other.js", "old": "x } y", "new": "y", "tests": []}';
    writeFileSync(join(root, 'tools/mutants/m.json'), `[\n  ${moved},\n  ${other}\n]\n`);
    // (spelled in two pieces, so the line is not itself an anchor into overworld.js to the docs' own checks)
    const doc = `An anchor into ${'overworld.js'}:"if (on) { const moved = live + 1;" names another file.\n`;
    writeFileSync(join(root, 'bible/page.md'), doc);
    const r = retargetRecords({ hostFile: 'src/world.js', toFile: 'src/marks.js', write: true, root });
    assert.deepEqual([r.records, r.unplaced], [1, []]);
    const [a, b] = JSON.parse(readFileSync(join(root, 'tools/mutants/m.json'), 'utf8'));
    assert.deepEqual(a, { file: 'src/marks.js', old: 'if (on) { const moved = host.live + 1;', new: 'if (on) { const moved = host.live;', tests: [], name: 'name-last' }, 'the moved record, retargeted whole');
    assert.deepEqual(b, JSON.parse(other), 'its neighbour untouched');
    assert.equal(readFileSync(join(root, 'bible/page.md'), 'utf8'), doc, 'overworld.js left as it is');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
