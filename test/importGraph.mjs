// The import graph of a Worker entry, as wrangler bundles it - moved here
// from relayversion.test.js (SLAM13) at ACC4 so the account Worker's
// deploy filter can be held to its own graph by the SAME walk. The
// relay's hash reads the order this returns, so the walk is unchanged
// byte for byte in what it visits and when.
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** Every relative `from '...'`, depth first, each file once, in the order the imports are written. */
export function graph(entry) {
  const out = [];
  const walk = (file) => {
    if (out.includes(file)) return;
    out.push(file);
    const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
    for (const m of src.matchAll(/\bfrom\s+'(\.[^']+)'|\bexport\s+\*\s+from\s+'(\.[^']+)'|\bimport\s+'(\.[^']+)'/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      walk(relative('.', join(dirname(file), spec)).split('\\').join('/'));
    }
  };
  walk(entry);
  return out;
}
