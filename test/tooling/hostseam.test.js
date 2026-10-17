// AUDIT HOST-SPLIT 1 (2026-10-15) - THE SEAM IS PINNED.
// A module tools/hostMove.mjs moved out of a host reads the host through one object: the names it destructures once
// (settled - handed over as themselves) and the names it reads as `host.<name>` (live - a getter, read at the use).
// Lint cannot see across it (`host` is any) and no test of behaviour can either - a stub hands every name over the
// same way - so the audit found that turning one getter into a copy (`get social()` -> `social,`, null at
// construction, the party's marks gone for good) or dropping a name passed the whole suite. This holds every moved
// module to its construction, by source: found by the header the tool writes, so the next move is held without
// being listed here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModule, findHostFunction, scopeOf } from '../../tools/hostScope.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const HEADER = /^\/\/ HOST-SPLIT: moved verbatim out of (\S+)'s (\w+) /;

/** Every node of a tree, with its parent and the key it hangs from. */
function* nodes(n, parent = null, key = null) {
  if (!n || typeof n.type !== 'string') return;
  yield [n, parent, key];
  for (const k of Object.keys(n)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue;
    const v = n[k];
    if (Array.isArray(v)) { for (const c of v) yield* nodes(c, n, k); } else yield* nodes(v, n, k);
  }
}

/** The moved modules: [module file, host file, constructor, host function]. */
function seams() {
  const out = [];
  const dir = join(ROOT, 'src/scenes');
  for (const f of readdirSync(dir, { recursive: true }).filter((n) => n.endsWith('.js')).sort()) {
    const src = readFileSync(join(dir, f), 'utf8');
    const m = HEADER.exec(src);
    if (!m) continue;
    const ctor = /^export function (create\w+)\(/m.exec(src)?.[1];
    out.push([`src/scenes/${f}`, m[1], ctor, m[2]]);
  }
  return out;
}

/** What a moved module takes from its handle: { settled, reads, writes }. */
function takes(file, ctor) { return takesText(readFileSync(join(ROOT, file), 'utf8'), ctor, file); }

/** The same, of a module's text. */
function takesText(text, ctor, file) {
  const ast = parseModule(text);
  const fn = ast.body.find((s) => s.type === 'ExportNamedDeclaration' && s.declaration?.id?.name === ctor)?.declaration;
  assert.ok(fn, `${file} exports ${ctor}`);
  const handle = fn.params[0]?.name;
  assert.ok(handle, `${file}: ${ctor} takes its handle`);
  const settled = new Set(), reads = new Set(), writes = new Set();
  const first = fn.body.body[0];
  if (first?.type === 'VariableDeclaration' && first.declarations[0]?.init?.name === handle) {
    for (const p of first.declarations[0].id.properties) settled.add(p.key.name);
  }
  // a write is an assignment's target, an update, a for-in/of head, or a target inside a destructuring assignment's
  // pattern (AUDIT HOST-SPLIT 2: those read as reads, and a missing setter would throw only when the line ran)
  const patternOf = new Set();
  for (const [n, parent, key] of nodes(fn.body)) {
    if ((parent?.type === 'AssignmentExpression' && key === 'left') || ((parent?.type === 'ForOfStatement' || parent?.type === 'ForInStatement') && key === 'left')) {
      if (n.type === 'ObjectPattern' || n.type === 'ArrayPattern') patternOf.add(n);
    }
    if ((n.type === 'ObjectPattern' || n.type === 'ArrayPattern' || n.type === 'Property' || n.type === 'AssignmentPattern' || n.type === 'RestElement') && patternOf.has(parent)) patternOf.add(n);
  }
  for (const [n, parent, key] of nodes(fn.body)) {
    if (n.type !== 'MemberExpression' || n.computed || n.object.type !== 'Identifier' || n.object.name !== handle) continue;
    const isWrite = (parent?.type === 'AssignmentExpression' && key === 'left') || parent?.type === 'UpdateExpression'
      || ((parent?.type === 'ForOfStatement' || parent?.type === 'ForInStatement') && key === 'left')
      || (patternOf.has(parent) && !(parent.type === 'AssignmentPattern' && key === 'right') && !(parent.type === 'Property' && key === 'key'));
    (isWrite ? writes : reads).add(n.property.name);
  }
  return { settled, reads, writes };
}

/** The host's own bindings: name -> its declaration's kind ('const', 'let', 'FunctionDeclaration', 'param', ...) and
 *  whether any statement of the host function writes it (tools/hostScope.mjs's map - by spelling, so it over-counts). */
function bindings(file, fnName) {
  const host = findHostFunction(parseModule(readFileSync(join(ROOT, file), 'utf8')), fnName);
  assert.ok(host, `${file} has ${fnName}`);
  const { members, owner } = scopeOf(host);
  // every name a parameter binds - `opts = {}` and a destructured one too (AUDIT HOST-SPLIT 2, the second read: a default
  // read as no binding at all, and failed PARTY-LOOT's module, copied from buildDungeonContext's `opts = {}`)
  const bound = (p) => (p.type === 'Identifier' ? [p.name] : p.type === 'AssignmentPattern' ? bound(p.left)
    : p.type === 'RestElement' ? bound(p.argument) : p.type === 'ArrayPattern' ? p.elements.filter(Boolean).flatMap(bound)
    : p.type === 'ObjectPattern' ? p.properties.flatMap((q) => bound(q.type === 'RestElement' ? q.argument : q.value)) : []);
  const params = new Set(host.fn.params.flatMap(bound));
  return (n) => {
    const o = owner.get(n);
    const kind = o ? (o.stmt.type === 'VariableDeclaration' ? o.stmt.kind : o.stmt.type) : params.has(n) ? 'param' : null;
    return { kind, written: members.some((m) => m.wrote.has(n)) };
  };
}

/** What the host hands over at the construction: { plain, getters, setters }. */
function hands(file, ctor) {
  const ast = parseModule(readFileSync(join(ROOT, file), 'utf8'));
  const calls = [...nodes(ast)].filter(([n]) => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === ctor);
  assert.equal(calls.length, 1, `${file} constructs ${ctor} once`);
  const arg = calls[0][0].arguments[0];
  assert.equal(arg?.type, 'ObjectExpression', `${file}: ${ctor} is handed one object`);
  const plain = new Set(), getters = new Set(), setters = new Set();
  for (const p of arg.properties) {
    assert.ok(p.type === 'Property' && !p.computed, `${file}: ${ctor}'s handles are named properties`);
    ({ init: plain, get: getters, set: setters })[p.kind].add(p.key.name);
  }
  return { plain, getters, setters };
}

test('HOST-SPLIT 1 (AUDIT) THE SEAM IS PINNED: every module the tool moved out of a host takes from its construction exactly what it reads - each settled name handed over, and a binding its host never writes (AUDIT HOST-SPLIT 2: a copy of one the host writes goes stale) and never as a getter; each live name it reads through the handle handed over as a GETTER (never a copy, which reads the name\'s value at construction for ever), each it writes - a destructuring target and a for-of head too - with a setter, and nothing handed over that it never reads (mutants: a live name handed over as a copy; a settled name dropped; a settled binding written by the host; a settled name handed over as a getter)', () => {
  const found = seams();
  assert.ok(found.length >= 1 && found.some(([f]) => f === 'src/scenes/travelViewMarks.js'), `the moved modules found by their header: ${JSON.stringify(found)}`);
  const wrong = [];
  for (const [mod, host, ctor, hostFn] of found) {
    const t = takes(mod, ctor), h = hands(host, ctor), b = bindings(host, hostFn);
    for (const n of t.settled) if (!h.plain.has(n) && !h.getters.has(n)) wrong.push(`${mod}: ${n} is destructured from the handle and ${host} never hands it over`);
    // AUDIT HOST-SPLIT 2: a settled name is a COPY taken at construction - so the host's binding must be one that never
    // changes: a const, a function or class declaration, a parameter or let nothing writes. One the host writes (a const
    // turned let and reassigned) leaves the module reading the value it copied, stale; and a getter for it is no live
    // read - the module destructures it once all the same
    for (const n of t.settled) {
      const { kind, written } = b(n);
      if (!['const', 'let', 'var', 'FunctionDeclaration', 'ClassDeclaration', 'param'].includes(kind)) wrong.push(`${mod}: ${n} is copied at construction and ${host}'s ${hostFn} declares no such binding`);
      else if (written) wrong.push(`${mod}: ${n} is copied at construction and ${host}'s ${hostFn} writes it - the module would keep a stale copy; read it live, host.${n}`);
      if (h.getters.has(n)) wrong.push(`${mod}: ${n} is copied at construction, and ${host} hands it over as a getter - the copy is taken once all the same; read it live, host.${n}, or hand it over plain`);
    }
    for (const n of t.reads) {
      if (h.plain.has(n)) wrong.push(`${mod}: ${n} is read live (host.${n}) and ${host} hands it over as a COPY - a getter, \`get ${n}() { return ${n}; }\``);
      else if (!h.getters.has(n)) wrong.push(`${mod}: host.${n} is read and ${host} hands over no ${n}`);
    }
    for (const n of t.writes) if (!h.setters.has(n)) wrong.push(`${mod}: host.${n} is written and ${host} hands over no setter for it`);
    for (const n of [...h.plain, ...h.getters]) if (!t.settled.has(n) && !t.reads.has(n) && !t.writes.has(n)) wrong.push(`${host}: ${ctor} is handed ${n}, which ${mod} never reads`);
  }
  assert.deepEqual(wrong, []);
});

test('HOST-SPLIT 2 (AUDIT) A WRITE THROUGH THE HANDLE IS A WRITE IN EVERY SHAPE: an assignment, an update, a for-of head and a destructuring target each count as a write of host.<name> - so the seam asks its setter - and a default\'s value or a key is still a read (mutants: a destructuring write read as a read)', () => {
  const t = takesText(`export function createX(host) {
  const { a } = host;
  function g(o) {
    host.b = 1; host.c++;
    for (host.d of [1]) { /* a for-of head */ }
    [host.e] = [2];
    ({ k: host.f, m: host.g = host.h } = o);
    return a + host.i;
  }
  return { g };
}
`, 'createX', 'a fixture');
  assert.deepEqual([[...t.settled], [...t.writes].sort(), [...t.reads].sort()], [['a'], ['b', 'c', 'd', 'e', 'f', 'g'], ['h', 'i']]);
});
