// Build test-file -> transitive src-module closure via static import / dynamic import scan.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const TEST = path.join(ROOT, 'test');
const IMPORT_RE = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function resolve(spec, fromFile) {
  if (!spec.startsWith('.')) return null;
  const p = path.resolve(path.dirname(fromFile), spec);
  const cands = [p, p + '.js', path.join(p, 'index.js')];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch { /* ignore */ } }
  return null;
}

const cache = new Map();
function deps(file) {
  if (cache.has(file)) return cache.get(file);
  cache.set(file, new Set());
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return cache.get(file); }
  const out = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const r = resolve(m[1], file);
    if (r) out.add(r);
  }
  cache.set(file, out);
  return out;
}

function closure(file) {
  const seen = new Set();
  const stack = [file];
  while (stack.length) {
    const f = stack.pop();
    for (const d of deps(f)) if (!seen.has(d)) { seen.add(d); stack.push(d); }
  }
  return seen;
}

const map = {};
const rev = {};
for (const t of fs.readdirSync(TEST).filter(f => f.endsWith('.test.js')).sort()) {
  const abs = path.join(TEST, t);
  const cl = [...closure(abs)].map(f => path.relative(ROOT, f)).filter(f => f.startsWith('src/')).sort();
  map[t] = cl;
  for (const s of cl) (rev[s] ||= []).push(t);
}
const allSrc = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) allSrc.push(path.relative(ROOT, p));
  }
})(path.join(ROOT, 'src'));
const orphans = allSrc.filter(s => !rev[s]).sort();
fs.writeFileSync(process.argv[3], JSON.stringify({ map, rev, orphans, allSrc: allSrc.sort() }, null, 1));
console.log('tests', Object.keys(map).length, 'srcReached', Object.keys(rev).length, 'srcTotal', allSrc.length, 'orphans', orphans.length);
