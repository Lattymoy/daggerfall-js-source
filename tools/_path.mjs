import { parse } from 'acorn';
import { readFileSync } from 'node:fs';
const [file, want, target] = process.argv.slice(2);
const src = readFileSync(file, 'utf8');
const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const line = (p) => src.slice(0, p).split('\n').length;
const kids = (n) => { const o = []; for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && o.push([k, c])); else if (v && typeof v.type === 'string') o.push([k, v]); } return o; };
const isFn = (n) => /FunctionDeclaration|FunctionExpression|ArrowFunctionExpression/.test(n.type);
function find(n) { if (n.type === 'FunctionDeclaration' && n.id?.name === want) return n; for (const [, c] of kids(n)) { const r = find(c); if (r) return r; } return null; }
const body = find(ast).body.body;
const fns = new Map(), arrows = new Map();
body.forEach((n) => {
  if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, n);
  else if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => { if (d.id.type === 'Identifier' && d.init && isFn(d.init)) arrows.set(d.id.name, d.init); });
});
function surface(n) {
  const ids = new Set(), calls = new Set();
  (function w(x, d) {
    if (isFn(x)) d += 1;
    if (x.type === 'Identifier' && d === 0) ids.add(x.name);
    if (x.type === 'CallExpression' && x.callee.type === 'Identifier' && d === 0) calls.add(x.callee.name);
    for (const [k, c] of kids(x)) { if (x.type === 'MemberExpression' && k === 'property' && !x.computed) continue; if ((x.type === 'Property' || x.type === 'MethodDefinition') && k === 'key' && !x.computed) continue; w(c, d); }
  })(n, 0);
  return { ids, calls };
}
function search(name, path, seen) {
  const f = fns.get(name) ?? arrows.get(name);
  if (!f || seen.has(name)) return null;
  seen.add(name);
  const { ids, calls } = surface(f.body);
  if (ids.has(target)) return [...path, `${name}() at line ${line(f.start)} reads ${target}`];
  for (const c of calls) { const r = search(c, [...path, `${name}() at line ${line(f.start)} calls ${c}()`], seen); if (r) return r; }
  return null;
}
body.forEach((n) => {
  if (n.type === 'FunctionDeclaration') return;
  const { ids, calls } = surface(n);
  if (ids.has(target)) { console.log(`DIRECT: statement at line ${line(n.start)} reads ${target}`); return; }
  for (const c of calls) { const r = search(c, [`statement at line ${line(n.start)} calls ${c}()`], new Set()); if (r) { console.log(r.join('\n  -> ')); } }
});
