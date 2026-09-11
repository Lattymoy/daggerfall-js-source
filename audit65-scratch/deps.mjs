import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const root = '/home/user/daggerfall-js-source';
const seen = new Set();
function walk(file, chain) {
  if (seen.has(file)) return;
  seen.add(file);
  let s; try { s = readFileSync(file, 'utf8'); } catch { return; }
  for (const m of s.matchAll(/from\s+'(\.[^']+)'/g)) {
    const p = resolve(dirname(file), m[1]);
    if (!existsSync(p)) continue;
    if (/scenes\/(dungeon|worldModes)\.js$/.test(p)) console.log('CYCLE TARGET REACHED:', p, 'via', [...chain, file].join(' -> '));
    walk(p, [...chain, file]);
  }
}
walk(root + '/src/render/waterSurface.js', []);
console.log('modules reachable from waterSurface.js:', seen.size);
console.log('reaches scenes/*:', [...seen].filter(f => f.includes('/scenes/')).join('\n') || 'none');
