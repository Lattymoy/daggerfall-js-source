// Ordered reachability over a BUNDLED chunk: inside every function body,
// walk the statements in order and report a read of a const/let/class
// that is declared later in that same body - counting reads made by
// functions the statement calls (transitively, through bindings that are
// already initialised at that point). Reports the bundle offset so the
// sourcemap can name the line.
import { parse } from 'acorn';
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const src = readFileSync(file, 'utf8');
const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const kids = (n) => { const o = []; for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && o.push([k, c])); else if (v && typeof v.type === 'string') o.push([k, v]); } return o; };
const isFn = (n) => /FunctionDeclaration|FunctionExpression|ArrowFunctionExpression/.test(n.type);
const hits = [];
function surface(n) {
  const ids = new Set(), calls = new Set();
  (function walk(x, d) {
    if (isFn(x)) d += 1;
    if (x.type === 'Identifier' && d === 0) ids.add(x.name);
    if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && d === 0) calls.add(x.callee.name);
    for (const [k, c] of kids(x)) {
      if (x.type === 'MemberExpression' && k === 'property' && !x.computed) continue;
      if ((x.type === 'Property' || x.type === 'MethodDefinition' || x.type === 'PropertyDefinition') && k === 'key' && !x.computed) continue;
      walk(c, d);
    }
  })(n, 0);
  return { ids, calls };
}
function analyse(body, label) {
  const decl = new Map(), fns = new Map(), arrows = new Map();
  body.forEach((n, i) => {
    if (n.type === 'VariableDeclaration' && n.kind !== 'var') n.declarations.forEach((d) => {
      if (d.id.type !== 'Identifier') return;
      if (!decl.has(d.id.name)) decl.set(d.id.name, { i, pos: n.start });
      if (d.init && isFn(d.init)) arrows.set(d.id.name, d.init);
    });
    else if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, n);
  });
  const memo = new Map();
  const reach = (name, seen) => {
    if (seen.has(name)) return new Set();
    seen.add(name);
    if (memo.has(name)) return memo.get(name);
    const f = fns.get(name) ?? arrows.get(name);
    if (!f) return new Set();
    const { ids, calls } = surface(f.body);
    const out = new Set(ids);
    for (const c of calls) for (const x of reach(c, seen)) out.add(x);
    memo.set(name, out);
    return out;
  };
  body.forEach((n, i) => {
    if (n.type === 'FunctionDeclaration') return;
    if (n.type === 'VariableDeclaration' && n.kind !== 'var' && n.declarations.every((d) => !d.init || isFn(d.init))) return;
    const { ids, calls } = surface(n);
    const touched = new Set(ids);
    for (const c of calls) for (const x of reach(c, new Set())) touched.add(x);
    for (const nm of touched) { const d = decl.get(nm); if (d && d.i > i) hits.push({ label, name: nm, usePos: n.start, declPos: d.pos }); }
  });
  for (const n of body) descend(n, label);
}
function descend(n, label) {
  for (const [, c] of kids(n)) {
    if (isFn(c) && c.body?.type === 'BlockStatement') analyse(c.body.body, `${c.id?.name ?? 'fn'}@${c.start}`);
    else if (c.type === 'BlockStatement') analyse(c.body, label);
    else descend(c, label);
  }
}
analyse(ast.body, 'module');
console.log(JSON.stringify(hits));
