// Flag assertions whose EXPECTED side is computed by the same production code
// path as the actual side (self-referential / non-falsifiable pins).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEST = path.join(ROOT, 'test');

function splitArgs(s) {
  const out = []; let d = 0, cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; cur += c; continue; }
    if ('([{'.includes(c)) d++;
    if (')]}'.includes(c)) d--;
    if (c === ',' && d === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim());
}

for (const f of fs.readdirSync(TEST).filter(x => x.endsWith('.test.js')).sort()) {
  const text = fs.readFileSync(path.join(TEST, f), 'utf8');
  // imported production symbols
  const imported = new Set();
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.\.\/src[^']*)'/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(/\s+as\s+/).pop().trim();
      if (n) imported.add(n);
    }
  }
  if (!imported.size) continue;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const m = L.match(/assert\.(equal|strictEqual|deepEqual|deepStrictEqual)\((.*)\)\s*;?\s*$/);
    if (!m) continue;
    const args = splitArgs(m[2]);
    if (args.length < 2) continue;
    const [a, b] = args;
    const idsA = new Set([...a.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map(x => x[1]));
    const idsB = new Set([...b.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)].map(x => x[1]));
    const shared = [...idsA].filter(x => idsB.has(x) && imported.has(x));
    if (shared.length) console.log(`${f}:${i + 1}  shared=${shared.join(',')}  ${L.trim().slice(0, 150)}`);
    // also: identical arg text
    if (a === b) console.log(`${f}:${i + 1}  IDENTICAL ARGS  ${L.trim().slice(0, 150)}`);
  }
}
