// THE HOST SCOPE MAP - where a host's one giant function can be cut (HOST-SPLIT,
// bible/01-Overview/Host-Split.md).
//
// bootWorld, createWorldModes and buildDungeonContext each hold thousands of
// declarations in ONE scope, and that shared scope is the knot: a block can only
// leave the function if what it reads and writes there can be handed to it. This
// reads the scope instead of guessing it. Each statement of the host function's
// body is a MEMBER; for a member (or a group of them) the map counts
//
//   reads   the host-scope names the group uses that it does not declare
//   writes  the host-scope `let`s the group ASSIGNS that it does not declare -
//           shared mutable state, the hard part of any cut
//   used-by the members outside the group that use what the group declares
//
// A group with few writes and a small used-by is a cut that costs little.
//
//   node tools/hostScope.mjs src/scenes/world.js                  the 25 largest members
//   node tools/hostScope.mjs src/scenes/world.js --top 60         more of them
//   node tools/hostScope.mjs src/scenes/world.js --group onlineStart,chatStart,onlineFrame
//   node tools/hostScope.mjs src/scenes/world.js --lines 22181-22845   every member starting in the range
//   node tools/hostScope.mjs src/scenes/worldModes.js --fn createWorldModes
//
// The host function is the file's largest function unless --fn names it.
//
// AN APPROXIMATION, said plainly: names are matched by spelling, so a parameter
// or inner `const` that shadows a host-scope name is counted as a use of the
// host's. That over-counts - a cut the map calls cheap is cheap; one it calls
// costly may be a little cheaper. Read the group before moving it.
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { isMain } from './lib/isMain.mjs';

/** Every child node of `node`, in source order. */
function* children(node) {
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') yield c; }
    else if (v && typeof v.type === 'string') yield v;
  }
}

const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
/** A node's length in source lines, its first and last counted. */
export const lines = (n) => n.loc.end.line - n.loc.start.line + 1;

const FOR_HEAD = /^For(In|Of)?Statement$/;

/** Whether `node`, sitting under `parent` at `parent[key]`, is one logical line of code. */
function isLogicalLine(node, parent, key) {
  const type = node.type;
  if (type === 'BlockStatement' || type === 'EmptyStatement') return false;   // braces and stray semicolons are layout
  if (type.endsWith('Statement') || type.endsWith('Declaration')) {
    const isLoopHeadDeclaration = type === 'VariableDeclaration' && FOR_HEAD.test(parent.type) && key !== 'body';
    return !isLoopHeadDeclaration;   // `for (let i = 0; ...)` is one line, not two
  }
  if (type === 'Property') return parent.type === 'ObjectExpression';   // an object literal's entry, not a destructuring pattern's
  if (type === 'MethodDefinition' || type === 'PropertyDefinition' || type === 'StaticBlock' || type === 'SwitchCase') return true;
  return type === 'ArrowFunctionExpression' && node.expression;   // `() => value` holds an implicit return statement
}

/** A function's size in LOGICAL lines: its statements, the entries of its object literals and classes, its switch
 *  cases and the implicit returns of its expression-bodied arrows. The ceiling counts these because they do not move
 *  with layout - splitting a crowded line, reformatting a file, renaming a variable or adding a comment leaves the
 *  count where it was - while every kind of growth, wiring included, moves it.
 *  Readability-Arc.md, LEGIBLE 1, has the measurement this replaced and why. */
export function logicalLines(fn) {
  let count = 0;
  const visit = (node, parent, key) => {
    if (isLogicalLine(node, parent, key)) count++;
    for (const childKey of Object.keys(node)) {
      if (childKey === 'loc' || childKey === 'start' || childKey === 'end') continue;
      const value = node[childKey];
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') visit(child, node, childKey);
      } else if (value && typeof value.type === 'string') {
        visit(value, node, childKey);
      }
    }
  };
  visit(fn.body, fn, 'body');
  return count;
}

/** A module's source parsed as the port parses it - with locations. */
export const parseModule = (src) => parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });

/** The host function in a parsed module: the largest function (or method) `want` names, else the module's largest -
 *  `{ fn, name }`, `fn` the function node, or null when there is none. test/scenes/hostceiling.test.js measures by it. */
export function findHostFunction(ast, want) {
  let best = null;
  const visit = (n, name) => {
    if (isFn(n) && n.body.type === 'BlockStatement') {
      const nm = n.id?.name ?? name;
      if ((!want || nm === want) && (!best || lines(n) > lines(best.fn))) best = { fn: n, name: nm };   // a name worn twice: the largest
    }
    // a function's name, when it has no id, is the binding or key that holds it - `const f = () =>`, `m() {}`, `{ m: () => }`
    const nm = n.type === 'VariableDeclarator' ? n.id?.name
      : (n.type === 'MethodDefinition' || n.type === 'Property' || n.type === 'PropertyDefinition') && !n.computed ? n.key?.name : undefined;
    for (const c of children(n)) visit(c, nm);
  };
  visit(ast);
  return best;
}

/** The names a pattern binds. */
function bound(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) bound(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements) bound(q, out);
  else if (p.type === 'RestElement') bound(p.argument, out);
  else if (p.type === 'AssignmentPattern') bound(p.left, out);
  return out;
}

/** The `var`s a statement declares anywhere inside it short of a nested function - they belong to the function. */
function hoistedVars(stmt, out = []) {
  const walk = (n) => {
    if (!n || typeof n.type !== 'string' || isFn(n) || n.type === 'ClassBody') return;
    if (n.type === 'VariableDeclaration' && n.kind === 'var') for (const d of n.declarations) bound(d.id, out);
    for (const c of children(n)) walk(c);
  };
  walk(stmt);
  return out;
}

/** What one body statement declares, and whether as a `let` (a `var` is one: it can be written). */
function declares(stmt) {
  if (stmt.type === 'VariableDeclaration') return { names: stmt.declarations.flatMap((d) => bound(d.id)), isLet: stmt.kind !== 'const' };
  if ((stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') && stmt.id) return { names: [stmt.id.name], isLet: false };
  const vars = hoistedVars(stmt);   // `if (x) { var y = 1; }` at the host's top level declares the host's y
  return { names: vars, isLet: vars.length > 0 };
}

/** Every identifier a subtree uses, and every one it assigns. */
function uses(root) {
  const read = new Set(), wrote = new Set();
  const walk = (n, parent, key) => {
    if (n.type === 'Identifier') {
      const propKey = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed)
        || ((parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition') && key === 'key' && !parent.computed && !parent.shorthand)
        || ((parent?.type === 'LabeledStatement' || parent?.type === 'BreakStatement' || parent?.type === 'ContinueStatement') && key === 'label');
      if (!propKey) read.add(n.name);
      return;
    }
    if (n.type === 'MetaProperty') return;   // new.target, import.meta - no binding
    if (n.type === 'AssignmentExpression') for (const nm of bound(n.left)) wrote.add(nm);
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') wrote.add(n.argument.name);
    // `for (x of xs)` / `for ([a] in o)` on a binding that already stands writes it every turn
    if ((n.type === 'ForOfStatement' || n.type === 'ForInStatement') && n.left.type !== 'VariableDeclaration') for (const nm of bound(n.left)) wrote.add(nm);
    for (const key of Object.keys(n)) {
      if (key === 'loc') continue;
      const v = n[key];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, n, key); }
      else if (v && typeof v.type === 'string') walk(v, n, key);
    }
  };
  walk(root, null, null);
  return { read, wrote };
}

/** The host function's scope: its members, what each declares and uses, and the cost of cutting a group out. */
export function scopeOf(host) {
  const params = host.fn.params.flatMap((p) => bound(p));
  const members = host.fn.body.body.map((stmt, i) => {
    const d = declares(stmt);
    return { i, stmt, names: d.names, isLet: d.isLet, from: stmt.loc.start.line, size: lines(stmt), ...uses(stmt) };
  });
  const owner = new Map();
  for (const m of members) for (const n of m.names) owner.set(n, m);
  const lets = new Set(members.filter((m) => m.isLet).flatMap((m) => m.names));
  const hostNames = new Set([...owner.keys(), ...params]);
  const writable = new Set([...lets, ...params]);   // what a group's write can change under the host: a let, a var, a parameter
  const cost = (group) => {
    const inGroup = new Set(group.flatMap((m) => m.names));
    const reads = new Set(), writes = new Set(), usedBy = new Set();
    for (const m of group) {
      for (const n of m.read) if (hostNames.has(n) && !inGroup.has(n)) reads.add(n);
      for (const n of m.wrote) if (writable.has(n) && !inGroup.has(n)) writes.add(n);
    }
    for (const m of members) {
      if (group.includes(m)) continue;
      for (const n of m.read) if (inGroup.has(n)) { usedBy.add(m); break; }
    }
    return { reads, writes, usedBy };
  };
  return { members, owner, lets, cost };
}

const label = (m) => (m.names.length ? m.names.slice(0, 3).join(', ') + (m.names.length > 3 ? ', ...' : '') : `<${m.stmt.type}>`);

function main(args) {
  const file = args[0];
  if (!file || file.startsWith('--')) {
    console.error('usage: node tools/hostScope.mjs <file> [--fn name] [--top N] [--group a,b,c] [--lines from-to]');
    process.exit(2);
  }
  const opt = (k) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : undefined; };
  const host = findHostFunction(parseModule(readFileSync(file, 'utf8')), opt('--fn'));
  if (!host) { console.error(`no function${opt('--fn') ? ` named ${opt('--fn')}` : ''} in ${file}`); process.exit(1); }
  const { members, owner, lets, cost } = scopeOf(host);
  console.log(`${file}: ${host.name ?? '(anonymous)'} - ${lines(host.fn)} lines, ${members.length} members, ${lets.size} host-scope lets`);

  let group = null;
  if (opt('--group')) {
    const want = opt('--group').split(',').map((s) => s.trim());
    const missing = want.filter((n) => !owner.has(n));
    if (missing.length) { console.error(`not host-scope names: ${missing.join(', ')}`); process.exit(1); }
    group = [...new Set(want.map((n) => owner.get(n)))];
  } else if (opt('--lines')) {
    const [a, b] = opt('--lines').split('-').map(Number);
    group = members.filter((m) => m.from >= a && m.from <= b);
  }

  if (group) {
    const { reads, writes, usedBy } = cost(group);
    console.log(`\ngroup: ${group.length} members, ${group.reduce((s, m) => s + m.size, 0)} lines (${group.map(label).join(' | ')})`);
    console.log(`  reads   ${reads.size}: ${[...reads].sort().join(', ')}`);
    console.log(`  writes  ${writes.size}: ${[...writes].sort().join(', ') || '-'}`);
    console.log(`  used-by ${usedBy.size}: ${[...usedBy].sort((x, y) => x.from - y.from).map((m) => `${label(m)} (:${m.from})`).join(', ') || '-'}`);
    return;
  }
  const top = Number(opt('--top') ?? 25);
  console.log(`\n${'lines'.padStart(6)} ${'line'.padStart(6)} ${'reads'.padStart(5)} ${'writes'.padStart(6)} ${'used-by'.padStart(7)}  member`);
  for (const m of [...members].sort((x, y) => y.size - x.size).slice(0, top)) {
    const { reads, writes, usedBy } = cost([m]);
    console.log(`${String(m.size).padStart(6)} ${String(m.from).padStart(6)} ${String(reads.size).padStart(5)} ${String(writes.size).padStart(6)} ${String(usedBy.size).padStart(7)}  ${label(m)}`);
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
