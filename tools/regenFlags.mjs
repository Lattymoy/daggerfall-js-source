// Regenerate Home.md's "Open flags" list from the FLAGGED/INTERIM sites
// themselves. The AUDIT 18 doc guards pin the list BOTH ways, so a slice
// that adds or moves a flag turns them red until this is run.
//
// The quotation is the source line trimmed, with a leading `// ` removed
// and truncated to 78 chars with a trailing "..." - exactly what
// test/audit18_bible_docs.test.js's citationMatches accepts.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir, out = []) => {
  for (const e of readdirSync(join(root, dir)).sort()) {
    const rel = `${dir}/${e}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (e.endsWith('.js')) out.push(rel);
  }
  return out;
};

const MAX = 78;
const entries = [];
for (const f of walk('src')) {
  readFileSync(join(root, f), 'utf8').split('\n').forEach((l, i) => {
    if (!/FLAGGED|INTERIM/.test(l)) return;
    let q = l.trim().replace(/^\/\/\s*/, '');
    if (q.length > MAX) q = `${q.slice(0, MAX)}...`;
    entries.push(`- \`${f}:${i + 1}\` - ${q}`);
  });
}

const p = join(root, 'bible/Home.md');
const src = readFileSync(p, 'utf8').split('\n');
const first = src.findIndex((l) => /^- `src\//.test(l));
let last = first;
while (last + 1 < src.length && (/^- `src\//.test(src[last + 1]) || src[last + 1] === '')) {
  if (src[last + 1] === '' && !/^- `src\//.test(src[last + 2] ?? '')) break;
  last++;
}
if (first < 0) throw new Error('no open-flags list found in bible/Home.md');
const out = [...src.slice(0, first), ...entries, ...src.slice(last + 1)];
writeFileSync(p, out.join('\n'));
console.log(`open flags: ${entries.length} (was ${last - first + 1})`);
