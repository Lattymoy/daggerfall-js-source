// WG2 (bible/03-World/World-2-Arc.md, Phase 2): THE BAKE TOOL. Makes a region's bake offline - the erosion a client
// never runs (WG-4) - and writes it gzipped where the game serves it: `node tools/wg2Bake.mjs <id|all> [--out dir]`.
// `--check` bakes again and compares each print with the file's, writing nothing; `--doc <package.json>` applies an editor
// package as the authored overrides (its base must be the served bake); `--province <Key>` bakes a province's tiles
// (tiling.js; `--tile`, `--overlap`) and prints their manifest rows; `--lean` writes the runtime planes alone (a
// published tile's cut, bakeCodec.js RUNTIME). Reads the repository alone: no ARENA2.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { TEST_REGIONS, testRegion } from '../src/world/gen2/testRegions.js';
import { bakeRegion, bakeTowns } from '../src/world/gen2/regionBake.js';
import { encodeBake, decodeBake, bakePrint } from '../src/world/gen2/bakeCodec.js';
import { regionSampler } from '../src/world/gen2/regionSampler.js';
import { generateSettlement } from '../src/world/gen2/settle/settlementGen.js';
import { settlementProblems } from '../src/world/gen2/settle/settlementValidate.js';
import { mintIds, settlementMapId } from '../src/world/gen2/settle/buildingRecord.js';
import { TEST_SETTLEMENTS } from '../src/world/gen2/settle/testSettlements.js';
import { provinceTiles } from '../src/world/gen2/tiling.js';
import { worldManifest, GENERATORS } from '../src/world/gen2/manifest.js';
import { PROVINCE_OF_ID } from '../src/world/tamriel/tamrielLand.js';
import { importPackage } from '../src/world/gen2/edit/contentPackage.js';
import { canonReady } from '../src/world/gen2/canon.js';

await canonReady();   // the relief is its own chunk: loaded before any bake reads the canon

export const BAKE_DIR = 'public/worldgen2';

/** Bake one region spec to its bytes and print. */
export function bakeBytes(spec, doc = null, lean = false) {
  const bake = bakeRegion(spec, { doc });
  // the region's towns: the prototypes and any the document placed, made on the bake's own ground (regionBake.js bakeTowns)
  const docTowns = (doc?.layers ?? []).filter((L) => L.visible).flatMap((L) => L.ops.filter((o) => o.kind === 'settlement').map((o) => o.spec));
  const towns = [...TEST_SETTLEMENTS.filter((t) => t.region === spec.id), ...docTowns];
  bake.towns = bakeTowns(encodeBake(bake), towns, regionSampler, { generate: generateSettlement, problems: settlementProblems, mint: mintIds, mapId: settlementMapId }, decodeBake);
  const bytes = encodeBake(bake, { lean });
  return { bytes, print: bakePrint(bytes) };
}
/** A served bake's raw bytes (its gzip opened). @param {string} file */
export const readBake = (file) => new Uint8Array(gunzipSync(readFileSync(file)));

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2), arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const which = args.find((a) => !a.startsWith('--') && ![arg('--out'), arg('--doc'), arg('--province'), arg('--tile'), arg('--overlap')].includes(a)) ?? 'all', out = arg('--out') ?? BAKE_DIR, check = args.includes('--check');
  const province = arg('--province'), m = worldManifest();
  const theatre = province ? Number(Object.keys(PROVINCE_OF_ID).find((t) => PROVINCE_OF_ID[t] === province)) : 0;
  if (province && !theatre) { console.error(`no province ${province}: ${Object.values(PROVINCE_OF_ID).join(', ')}`); process.exit(2); }
  const specs = province ? provinceTiles(m.fit, theatre, province, { tile: Number(arg('--tile') ?? 128), overlap: Number(arg('--overlap') ?? 12), seed: m.worldSeed })
    : which === 'all' ? TEST_REGIONS : [testRegion(which)];
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
    const t0 = Date.now(), { bytes, print } = bakeBytes(spec, doc, args.includes('--lean')), file = join(out, `${spec.id}.wg2.gz`);
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
    if (spec.tiling) console.log(`  manifest row: ${JSON.stringify({ id: spec.id, rect: spec.rect, bake: `${spec.id}.wg2`, print, generator: GENERATORS[GENERATORS.length - 1], revision: 1, tiling: spec.tiling, core: spec.core })}`);
  }
  if (bad) process.exit(1);
}
