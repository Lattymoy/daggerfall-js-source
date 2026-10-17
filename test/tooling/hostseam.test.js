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
import { parseModule } from '../../tools/hostScope.mjs';

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

/** The moved modules: [module file, host file, constructor]. */
function seams() {
  const out = [];
  const dir = join(ROOT, 'src/scenes');
  for (const f of readdirSync(dir, { recursive: true }).filter((n) => n.endsWith('.js')).sort()) {
    const src = readFileSync(join(dir, f), 'utf8');
    const m = HEADER.exec(src);
    if (!m) continue;
    const ctor = /^export function (create\w+)\(/m.exec(src)?.[1];
    out.push([`src/scenes/${f}`, m[1], ctor]);
  }
  return out;
}

/** What a moved module takes from its handle: { settled, reads, writes }. */
function takes(file, ctor) {
  const ast = parseModule(readFileSync(join(ROOT, file), 'utf8'));
  const fn = ast.body.find((s) => s.type === 'ExportNamedDeclaration' && s.declaration?.id?.name === ctor)?.declaration;
  assert.ok(fn, `${file} exports ${ctor}`);
  const handle = fn.params[0]?.name;
  assert.ok(handle, `${file}: ${ctor} takes its handle`);
  const settled = new Set(), reads = new Set(), writes = new Set();
  const first = fn.body.body[0];
  if (first?.type === 'VariableDeclaration' && first.declarations[0]?.init?.name === handle) {
    for (const p of first.declarations[0].id.properties) settled.add(p.key.name);
  }
  for (const [n, parent, key] of nodes(fn.body)) {
    if (n.type !== 'MemberExpression' || n.computed || n.object.type !== 'Identifier' || n.object.name !== handle) continue;
    const isWrite = (parent?.type === 'AssignmentExpression' && key === 'left') || parent?.type === 'UpdateExpression';
    (isWrite ? writes : reads).add(n.property.name);
  }
  return { settled, reads, writes };
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

test('HOST-SPLIT 1 (AUDIT) THE SEAM IS PINNED: every module the tool moved out of a host takes from its construction exactly what it reads - each settled name handed over, each live name it reads through the handle handed over as a GETTER (never a copy, which reads the name\'s value at construction for ever), each it writes with a setter, and nothing handed over that it never reads (mutants: a live name handed over as a copy; a settled name dropped)', () => {
  const found = seams();
  assert.ok(found.length >= 1 && found.some(([f]) => f === 'src/scenes/travelViewMarks.js'), `the moved modules found by their header: ${JSON.stringify(found)}`);
  const wrong = [];
  for (const [mod, host, ctor] of found) {
    const t = takes(mod, ctor), h = hands(host, ctor);
    for (const n of t.settled) if (!h.plain.has(n) && !h.getters.has(n)) wrong.push(`${mod}: ${n} is destructured from the handle and ${host} never hands it over`);
    for (const n of t.reads) {
      if (h.plain.has(n)) wrong.push(`${mod}: ${n} is read live (host.${n}) and ${host} hands it over as a COPY - a getter, \`get ${n}() { return ${n}; }\``);
      else if (!h.getters.has(n)) wrong.push(`${mod}: host.${n} is read and ${host} hands over no ${n}`);
    }
    for (const n of t.writes) if (!h.setters.has(n)) wrong.push(`${mod}: host.${n} is written and ${host} hands over no setter for it`);
    for (const n of [...h.plain, ...h.getters]) if (!t.settled.has(n) && !t.reads.has(n) && !t.writes.has(n)) wrong.push(`${host}: ${ctor} is handed ${n}, which ${mod} never reads`);
  }
  assert.deepEqual(wrong, []);
});
