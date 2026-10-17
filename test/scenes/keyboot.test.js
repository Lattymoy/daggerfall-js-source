// KEY-BOOT (2026-10-02, Discord "Keypress while loading/logging in": "Nothing pertinent, game still works, but all i
// did was turn the volume up via Fn + F11 keys ... just had to reload the game") - the screenshot's red crash banner.
// bootWorld registers its key ladder, then awaits (the quest pack, the first pixel's people) for seconds behind the
// loading screen; the ladder's arms read `socialMenuCanOpen` - declared past those awaits - on every key, so any key in
// that window threw "ReferenceError: Cannot access '..' before initialization" from the listener, and the banner (no
// dismiss) stood over the session. Now the ladder's arms wait on `_worldKeysLive`, flipped as the boot hands the first
// frame its turn; what runs before the latch reads nothing the boot has not reached. BOOT-HIDE's walk
// (test/scenes/fb0929h_boothide.test.js), turned on the keys. Each pin is red on the record's code (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

const SRC = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

const kids = (n) => {
  const out = [];
  for (const k of Object.keys(n)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && out.push([k, c]));
    else if (v && typeof v.type === 'string') out.push([k, v]);
  }
  return out;
};
const isFn = (n) => /FunctionDeclaration|FunctionExpression|ArrowFunctionExpression/.test(n.type);
const findFn = (n, name) => {
  if (n.type === 'FunctionDeclaration' && n.id?.name === name) return n;
  for (const [, c] of kids(n)) { const r = findFn(c, name); if (r) return r; }
  return null;
};
function readsOf(node) {
  const ids = new Set();
  (function walk(x) {
    if (x.type === 'Identifier') ids.add(x.name);
    for (const [k, c] of kids(x)) {
      if (x.type === 'MemberExpression' && k === 'property' && !x.computed) continue;
      if ((x.type === 'Property' || x.type === 'MethodDefinition' || x.type === 'PropertyDefinition') && k === 'key' && !x.computed) continue;
      walk(c);
    }
  })(node);
  return ids;
}
function suspends(n) {
  let found = false;
  (function walk(x, depth) {
    if (isFn(x)) depth += 1;
    if (depth === 0 && (x.type === 'AwaitExpression' || (x.type === 'ForOfStatement' && x.await))) found = true;
    for (const [, c] of kids(x)) walk(c, depth);
  })(n, 0);
  return found;
}
const calls = (node, name) => {
  let hit = false;
  (function walk(x) { if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && x.callee.name === name) hit = true; for (const [, c] of kids(x)) walk(c); })(node);
  return hit;
};
const isLatch = (s) => s.type === 'IfStatement' && s.test.type === 'UnaryExpression' && s.test.operator === '!' && s.test.argument.name === '_worldKeysLive' && s.consequent.type === 'ReturnStatement';

/** The ladder: the boot's top-level keydown listener that runs worldKeyAction - its index, its body's statements, the
 *  latch's place among them, and every binding the statements BEFORE the latch reach (the boot's own functions
 *  followed) that the boot declares past one of its awaits. */
function ladder(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const lineOf = (p) => source.slice(0, p).split('\n').length;
  const body = findFn(ast, 'bootWorld').body.body;
  const decl = new Map(), bodies = new Map();
  body.forEach((n, i) => {
    if (n.type === 'VariableDeclaration' && n.kind !== 'var') {
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier') continue;
        if (!decl.has(d.id.name)) decl.set(d.id.name, i);
        if (d.init && isFn(d.init)) bodies.set(d.id.name, d.init);
      }
    } else if (n.type === 'FunctionDeclaration' && n.id) bodies.set(n.id.name, n);
  });
  const awaits = body.map((n, i) => (n.type !== 'FunctionDeclaration' && suspends(n) ? i : -1)).filter((i) => i >= 0);
  const at = body.findIndex((n) => n.type === 'ExpressionStatement' && n.expression.type === 'CallExpression' && n.expression.callee.name === 'addEventListener'
    && n.expression.arguments[0]?.value === 'keydown' && calls(n.expression.arguments[1], 'worldKeyAction'));
  assert.ok(at >= 0, 'the key ladder is no longer a top-level keydown listener of bootWorld');
  const stmts = body[at].expression.arguments[1].body.body;
  const latchAt = stmts.findIndex(isLatch);
  const firstAction = stmts.findIndex((s) => s.type !== 'FunctionDeclaration' && calls(s, 'worldKeyAction'));
  const local = new Map(stmts.filter((s) => s.type === 'FunctionDeclaration').map((s) => [s.id.name, s]));   // the ladder's own (worldKeyAction): what it reads, it reads when called
  const reach = (node, seen, out) => {
    for (const id of readsOf(node)) {
      out.add(id);
      const f = local.get(id) ?? bodies.get(id);
      if (f && !seen.has(id)) { seen.add(id); reach(f.body ?? f, seen, out); }
    }
    return out;
  };
  const late = [];
  const before = latchAt >= 0 ? stmts.slice(0, latchAt) : stmts;
  for (const s of before) {
    if (s.type === 'FunctionDeclaration') continue;
    for (const nm of reach(s, new Set(), new Set())) {
      const d = decl.get(nm);
      if (d === undefined || d <= at) continue;
      if (awaits.some((a) => a >= at && a < d)) late.push(`${nm} (declared line ${lineOf(body[d].start)}) from line ${lineOf(s.start)}`);
    }
  }
  const lifts = body.map((n, i) => (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression' && n.expression.left.name === '_worldKeysLive' ? i : -1)).filter((i) => i >= 0);
  const lifted = lifts.map((i) => source.slice(body[i].expression.right.start, body[i].expression.right.end));
  const latchDecl = body.findIndex((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id.name === '_worldKeysLive'));
  return { at, latchAt, firstAction, late, lifts, lifted, latchDecl, lastAwait: Math.max(...awaits) };
}

test('KEY-BOOT THE LADDER WAITS FOR THE WORLD: the latch stands in the key ladder before its first worldKeyAction, and nothing before it reads a binding the boot declares past one of its awaits - save the death screen\'s own flag, read only under a death screen no boot shows (mutants: the latch gone, the latch under the actions)', () => {
  const l = ladder(SRC);
  assert.ok(l.latchAt >= 0, 'no latch in the ladder');
  assert.ok(l.firstAction > l.latchAt, `the latch (statement ${l.latchAt}) stands under the first action (statement ${l.firstAction})`);
  assert.deepEqual(l.late.filter((x) => !x.startsWith('_deathWasOnline ')), [], 'read before the latch, in the boot\'s dead zone');
  assert.match(SRC, /if \(townTalk\.overlay instanceof DeathScreen[^\n]*_deathWasOnline|_deathWasOnline[^\n]*DeathScreen/, 'the flag is the death screen\'s alone');
});

test('KEY-BOOT THE LATCH LIFTS WHEN THE BOOT IS DONE: `_worldKeysLive = true` once, a statement of the boot\'s own past its last await (no key can land between it and the first frame - nothing suspends); declared false above the ladder (mutants: never lifted, lifted before an await)', () => {
  const l = ladder(SRC);
  assert.equal(l.lifts.length, 1, 'lifted once, by the boot');
  assert.deepEqual(l.lifted, ['true']);
  assert.ok(l.lifts[0] > l.lastAwait, 'past the last await');
  assert.ok(l.latchDecl >= 0 && l.latchDecl < l.at, 'declared above the ladder');
  assert.match(SRC, /  let _worldKeysLive = false;\n  addEventListener\('keydown', \(e\) => \{/, 'false until then');
});

test('KEY-BOOT THE GATE NAMES THE REPORT\'S CRASH: the latch taken out, the walk finds socialMenuCanOpen read across the quest pack\'s await (not vacuous)', () => {
  const latch = '    if (!_worldKeysLive) return;   // KEY-BOOT: the ladder\'s arms read bindings the boot has not reached yet\n';
  assert.ok(SRC.includes(latch), 'the latch is no longer written as pinned');
  const l = ladder(SRC.replace(latch, ''));
  assert.equal(l.latchAt, -1);
  assert.ok(l.late.some((x) => x.startsWith('socialMenuCanOpen ')), `the walk missed it:\n${l.late.join('\n')}`);
});
