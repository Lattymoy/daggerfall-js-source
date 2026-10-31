// WG2 (bible/03-World/World-2-Arc.md, Phase 2): THE BAKE TOOL. Makes a region's bake offline - the erosion a client
// never runs (WG-4) - and writes it gzipped where the game serves it: `node tools/wg2Bake.mjs <id|all> [--out dir]`.
// `--check` bakes again and compares each print with the file's, writing nothing; `--doc <package.json>` applies an editor
// package as the authored overrides (its base must be the served bake). Reads the repository alone: no ARENA2.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { TEST_REGIONS, testRegion } from '../src/world/gen2/testRegions.js';
import { bakeRegion } from '../src/world/gen2/regionBake.js';
import { encodeBake, bakePrint } from '../src/world/gen2/bakeCodec.js';
import { importPackage } from '../src/world/gen2/edit/contentPackage.js';
import { canonReady } from '../src/world/gen2/canon.js';

await canonReady();   // the relief is its own chunk: loaded before any bake reads the canon

export const BAKE_DIR = 'public/worldgen2';

/** Bake one region spec to its bytes and print. */
export function bakeBytes(spec, doc = null) {
  const bytes = encodeBake(bakeRegion(spec, { doc }));
  return { bytes, print: bakePrint(bytes) };
}
/** A served bake's raw bytes (its gzip opened). @param {string} file */
export const readBake = (file) => new Uint8Array(gunzipSync(readFileSync(file)));

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2), arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const which = args.find((a) => !a.startsWith('--') && a !== arg('--out') && a !== arg('--doc')) ?? 'all', out = arg('--out') ?? BAKE_DIR, check = args.includes('--check');
  const specs = which === 'all' ? TEST_REGIONS : [testRegion(which)];
  if (specs.some((s) => !s)) { console.error(`no region ${which}: ${TEST_REGIONS.map((r) => r.id).join(', ')}`); process.exit(2); }
  let bad = 0;
  const pkgFile = arg('--doc');
  for (const spec of specs) {
    let doc = null;
    if (pkgFile) {
      const got = importPackage(JSON.parse(readFileSync(pkgFile, 'utf8')), bakePrint(readBake(join(BAKE_DIR, `${spec.id}.wg2.gz`))));
      if (got.refused) { console.error(`${spec.id}: the package is refused - ${got.refused.join('; ')}`); process.exit(1); }
      doc = got.doc;
    }
    const t0 = Date.now(), { bytes, print } = bakeBytes(spec, doc), file = join(out, `${spec.id}.wg2.gz`);
    if (check) {
      const had = existsSync(file) ? bakePrint(readBake(file)) : '(none)';
      if (had !== print) bad++;
      console.log(`${spec.id}: ${print} (file ${had}) ${had === print ? 'same' : 'DIFFERENT'} in ${Date.now() - t0} ms`);
      continue;
    }
    mkdirSync(out, { recursive: true });
    const gz = gzipSync(bytes, { level: 9 });
    writeFileSync(file, gz);
    console.log(`${spec.id}: ${print}, ${bytes.length} bytes (${gz.length} gzipped) in ${Date.now() - t0} ms -> ${file}`);
  }
  if (bad) process.exit(1);
}
