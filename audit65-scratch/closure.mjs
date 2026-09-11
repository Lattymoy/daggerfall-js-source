import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
const seen = new Set();
function walk(f) {
  f = resolve(f);
  if (seen.has(f)) return;
  seen.add(f);
  let t; try { t = readFileSync(f, 'utf8'); } catch { return; }
  for (const m of t.matchAll(/^\s*(?:import|export)[^'"\n]*from\s*'([^']+)'/gm)) {
    if (m[1].startsWith('.')) walk(resolve(dirname(f), m[1]));
  }
  for (const m of t.matchAll(/^\s*import\s*'([^']+)'/gm)) if (m[1].startsWith('.')) walk(resolve(dirname(f), m[1]));
}
for (const entry of process.argv.slice(2)) {
  seen.clear();
  walk(entry);
  console.log(`${entry}: ${seen.size} modules`);
}
