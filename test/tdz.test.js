// THE GAME DID NOT BOOT, AND EVERY GATE WAS GREEN.
//
// `createWorldModes` read `say` at its line 222 and declared
// `const say = ...` at 263, so the very first line of the game threw
// `ReferenceError: Cannot access 'say' before initialization` and the
// world host never reached a mode. Lint passed (a temporal dead zone
// is legal syntax and the identifier IS bound, so no-undef is blind to
// it), the vite build passed, and all 3005 tests passed - because
// nothing in the suite executes a host constructor. The first-hour
// playthrough probe found it the only way it can be found: by starting
// the game.
//
// eslint.config.js's own header describes this exact shape one rung
// down - "unbound identifiers are invisible to node --check, vite
// build, and headless tests - no-undef catches the whole class." A TDZ
// read is invisible to the same three. This is that leg for this
// class.
//
// WHY NOT no-use-before-define: it flags 510 sites across src/, and
// almost all are legal - a closure that mentions a const declared
// further down is fine, because it does not RUN until later. ESLint
// cannot tell a deferred reference from an immediate one. This can:
// it only reports a reference that is evaluated in the SAME execution
// scope as the declaration it precedes - not one nested inside a
// function that has yet to be called. That is precisely the shape that
// throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

/** A reference inside one of these is DEFERRED - the body has not run
 *  yet, so it cannot hit the enclosing scope's dead zone. (Class
 *  bodies count too: a field initialiser runs at construction.) */
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression']);
/** Nodes that open a LEXICAL scope. A `const x` inside one is a
 *  different binding from an outer `x`, which is what the first draft
 *  of this gate got wrong: it read every `for (const obj of ...)` in a
 *  file as one binding and reported 427 phantom dead zones. */
const LEXICAL = new Set(['BlockStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'SwitchStatement', 'CatchClause', 'StaticBlock']);

const SKIP_KEYS = new Set(['start', 'end', 'parent', 'loc', 'range']);
const kids = (node) => Object.keys(node).filter((k) => !SKIP_KEYS.has(k)).map((k) => node[k]);

/** Every identifier a pattern BINDS (destructuring included). */
function bound(node, into) {
  if (!node || typeof node !== 'object') return;
  switch (node.type) {
    case 'Identifier': into.push(node); return;
    case 'ObjectPattern': for (const p of node.properties) bound(p.type === 'RestElement' ? p.argument : p.value, into); return;
    case 'ArrayPattern': for (const el of node.elements) bound(el, into); return;
    case 'AssignmentPattern': bound(node.left, into); return;
    case 'RestElement': bound(node.argument, into); return;
    default: return;
  }
}

/** The const/let/class bindings declared DIRECTLY in this scope - not
 *  in a nested lexical scope, and not inside a nested function. */
function directDecls(scopeNode) {
  const decls = new Map();
  const visit = (node, top) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) visit(n, top); return; }
    if (!top && (FUNCTIONS.has(node.type) || LEXICAL.has(node.type))) return;
    if (node.type === 'VariableDeclaration' && node.kind !== 'var') {
      for (const d of node.declarations) {
        const names = []; bound(d.id, names);
        for (const n of names) if (!decls.has(n.name)) decls.set(n.name, node.start);
      }
    }
    if (node.type === 'ClassDeclaration' && node.id) decls.set(node.id.name, node.start);
    for (const c of kids(node)) visit(c, false);
  };
  visit(scopeNode, true);
  return decls;
}

/**
 * `scopes` runs outermost -> innermost, each { decls, immediate }.
 * `immediate` is false once the walk has crossed into a function body:
 * from in there, an outer binding is only read when that function is
 * CALLED, which is later, which is legal. A reference is a dead-zone
 * read only when it resolves to a scope that is still immediate and
 * sits before that binding's declaration.
 */
function scan(node, scopes, report, path, isScopeRoot = false) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) scan(n, scopes, report, path); return; }

  if (!isScopeRoot && (FUNCTIONS.has(node.type) || LEXICAL.has(node.type))) {
    const crossed = FUNCTIONS.has(node.type);
    const outer = crossed ? scopes.map((s) => ({ decls: s.decls, immediate: false })) : scopes;
    // A function's PARAMETERS bind in its own scope; treat them as
    // declared at its start so a default that reads a later param is
    // still visible, and an outer name of the same spelling is not.
    const own = { decls: directDecls(node), immediate: true };
    if (crossed && node.params) for (const p of node.params) { const ns = []; bound(p, ns); for (const n of ns) own.decls.set(n.name, node.start); }
    if (node.type === 'CatchClause' && node.param) { const ns = []; bound(node.param, ns); for (const n of ns) own.decls.set(n.name, node.start); }
    scan(node, [...outer, own], report, path, true);
    return;
  }

  if (node.type === 'Identifier') {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const at = scopes[i].decls.get(node.name);
      if (at === undefined) continue;                      // not this scope's binding
      if (scopes[i].immediate && node.start < at) {
        report.push({ path, name: node.name, useStart: node.start, declStart: at });
      }
      return;                                              // innermost binding wins
    }
    return;
  }
  if (node.type === 'MemberExpression') { scan(node.object, scopes, report, path); if (node.computed) scan(node.property, scopes, report, path); return; }
  // A shorthand `{ say }` has key and value pointing at the same
  // identifier, so the generic walk below would count the reference
  // TWICE. It is one read - and it is the exact read this gate exists
  // for, since that is how the ticker took its `say` dep.
  if (node.type === 'Property') {
    if (node.computed) scan(node.key, scopes, report, path);
    scan(node.value, scopes, report, path);
    return;
  }
  if (node.type === 'MethodDefinition' && !node.computed) { scan(node.value, scopes, report, path); return; }
  if (node.type === 'VariableDeclarator') { scan(node.init, scopes, report, path); return; }   // the id BINDS, it does not read
  if (node.type === 'ImportDeclaration' || node.type === 'ExportSpecifier' || node.type === 'ImportSpecifier') return;

  for (const c of kids(node)) scan(c, scopes, report, path);
}

function scanFile(src, path, report) {
  const ast = parseAst(src, { jsx: false });
  scan(ast, [{ decls: directDecls(ast), immediate: true }], report, path, true);
}

const lineOf = (src, off) => src.slice(0, off).split('\n').length;

test('V4: no source in src/ reads a const or let before it is initialised', () => {
  const report = [];
  const sources = new Map();
  for (const f of jsFiles(SRC)) {
    const src = readFileSync(f, 'utf8');
    sources.set(f, src);
    scanFile(src, f, report);
  }
  const lines = report.map((r) => {
    const src = sources.get(r.path);
    return `${relative(ROOT, r.path)}:${lineOf(src, r.useStart)} reads '${r.name}', `
      + `declared at :${lineOf(src, r.declStart)}`;
  });
  assert.deepEqual(lines, [],
    'These run BEFORE the binding they read is initialised, so they throw\n'
    + '"Cannot access X before initialization" the moment the enclosing scope runs.\n'
    + 'Lint, the vite build and the whole suite all pass on this - move the\n'
    + 'declaration above its use.\n\n' + lines.join('\n'));
});

test('V4: the gate catches the shape it was written for', () => {
  // The real defect, reduced: the ticker takes `say` as a dep two
  // lines above where `say` is declared.
  const bad = `export function createHost(host) {
  const ticker = makeTicker({ say });
  const say = (l) => host.say(l);
  return ticker;
}`;
  const report = [];
  scanFile(bad, '<fixture>', report);
  assert.equal(report.length, 1, 'the immediate read must be reported');
  assert.equal(report[0].name, 'say');

  // ...and does NOT flag the legal, pervasive case: a DEFERRED
  // reference from inside a closure that has not run yet. A rule that
  // failed this would flag 510 sites in src/ and be turned off within
  // the week.
  const fine = `export function createHost() {
  const open = () => win;
  const win = {};
  return open;
}`;
  const ok = [];
  scanFile(fine, '<fixture>', ok);
  assert.deepEqual(ok, [], 'a closure mentioning a later const is legal - it does not run yet');

  // A block-scoped shadow below must not be read as the outer name.
  const shadowed = `export function f(x) {
  use(x);
  { const x = 1; return x; }
}`;
  const sh = [];
  scanFile(shadowed, '<fixture>', sh);
  assert.deepEqual(sh, [], 'an inner block const is a different binding');
});
