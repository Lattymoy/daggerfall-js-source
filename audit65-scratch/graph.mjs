import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
const ROOT = process.argv[2];
const start = process.argv[3];
const target = process.argv[4]; // optional prefix to find paths to
const seen = new Map(); // file -> parent
const order = [];
function deps(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  const re2 = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = re2.exec(src))) out.push('DYN:' + m[1]);
  const re3 = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  while ((m = re3.exec(src))) out.push(m[1]);
  return out;
}
const q = [resolve(ROOT, start)];
seen.set(q[0], null);
const dyn = [];
while (q.length) {
  const f = q.shift();
  order.push(f);
  let ds;
  try { ds = deps(f); } catch (e) { continue; }
  for (let d of ds) {
    let isDyn = false;
    if (d.startsWith('DYN:')) { d = d.slice(4); isDyn = true; }
    if (!d.startsWith('.')) continue;
    const r = resolve(dirname(f), d);
    if (!existsSync(r)) continue;
    if (isDyn) { dyn.push([relative(ROOT, f), relative(ROOT, r)]); continue; }
    if (seen.has(r)) continue;
    seen.set(r, f);
    q.push(r);
  }
}
console.log('STATIC REACHED:', seen.size);
const rels = [...seen.keys()].map((f) => relative(ROOT, f)).sort();
if (target) {
  const hits = rels.filter((r) => r.startsWith(target));
  console.log('MATCHING', target, ':', hits.length);
  for (const h of hits) {
    // print chain
    let cur = resolve(ROOT, h); const chain = [];
    while (cur) { chain.unshift(relative(ROOT, cur)); cur = seen.get(cur); }
    console.log('  ', chain.join(' -> '));
  }
} else {
  for (const r of rels) console.log('  ', r);
}
console.log('DYNAMIC IMPORTS from reached set:');
for (const [a, b] of dyn) console.log('  ', a, '=>', b);
