// WOD1: WORLD OF DAGGERFALL - THE MOD'S OWN FILES, OUT OF ITS OWN ARCHIVE.
//
// World of Daggerfall 2.0 (Kamer) ships as a RAR holding two trees:
//
//   Mods/world_of_daggerfall.dfmod - a Unity 2019.4.10f1 AssetBundle
//     that carries the WHOLE implementation as TextAssets: eight C#
//     sources and the manifest. So, as with World Tooltips,
//     vendor/world-of-daggerfall/Scripts/ holds the author's source,
//     not a decompile.
//   Locations/ - StreamingAssets content: 65 prefab layouts under
//     LocationPrefab/ and 2,413 instance lists in 44 region folders.
//
// The prefabs are copied byte for byte. The instance lists are not
// carried as XML (61.0 MB); each region folder becomes ONE pack of the
// ported reader's output (src/world/wodLocationPack.js explains the
// layout and why it is a cache of the author's files rather than a
// re-authoring of them), and locations.json records every source file
// the packs were read from - name, byte size, sha256, instance count.
//
//   node tools/worldOfDaggerfallAssets.mjs <extracted archive root> [outDir]
//
// The root is the folder holding `Mods/` and `Locations/` (unrar x the
// shipped .rar; the archive tests clean with unrar 7). Default outDir
// is vendor/world-of-daggerfall. It prints each written file's size
// and sha256, which is what test/wod1_vendor.test.js pins.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readUnityBundle } from '../src/formats/unityBundle.js';
import { loadLocationInstance, loadLocationPrefab, ntfsCompare } from '../src/world/wodLocationData.js';
import { encodeRegionPack, decodeRegionPack, WOD_PACK_VERSION } from '../src/world/wodLocationPack.js';

/** The bundle's text assets, by the name they carry inside it, mapped
 *  to the path this tree keeps them at. */
export const WOD_BUNDLE_ASSETS = Object.freeze({
  'LocationLoader.cs': 'Scripts/LocationLoader.cs',
  'LocationHelper.cs': 'Scripts/LocationHelper.cs',
  'LocationEnemySpawner.cs': 'Scripts/LocationEnemySpawner.cs',
  'LocationData.cs': 'Scripts/LocationData.cs',
  'LocationModLoader.cs': 'Scripts/LocationModLoader.cs',
  'DungeonExterior.cs': 'Scripts/DungeonExterior.cs',
  'MainQuestLocationOverhaul.cs': 'Scripts/MainQuestLocationOverhaul.cs',
  'PrivateersHold.cs': 'Scripts/PrivateersHold.cs',
  'worldofdaggerfall.dfmod': 'worldofdaggerfall.dfmod.json',
});

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** The bundle's text assets as { name, path, body } - pure. `body` is the TextAsset's own BYTES (AUDIT BRANCH
 *  (WoD) n: the decoded text drops a UTF-8 byte-order mark, so a file that carried one was not written byte for byte). */
export function readWorldOfDaggerfallBundle(bytes) {
  const bundle = readUnityBundle(bytes);
  return bundle.textAssets.map((t) => ({
    name: t.name,
    path: WOD_BUNDLE_ASSETS[t.name] ?? null,
    body: t.bytes ? Buffer.from(t.bytes) : Buffer.from(t.text ?? '', 'utf8'),
  }));
}

/**
 * One region folder, read the way LocationLoader reads it: every file
 * in Directory.GetFiles order (NTFS name order), LoadLocationInstance
 * over each. Pure over { name, bytes } records.
 * @returns {{files:Array<{file:string, instances:object[], bytes:number, sha256:string}>}}
 */
export function readRegionFolder(entries) {
  const files = [];
  for (const { name, bytes } of [...entries].sort((a, b) => ntfsCompare(a.name, b.name))) {
    if (!/^[\x20-\x7e]+$/.test(name)) throw new Error(`non-ASCII file name ${name}: NTFS order would need the upcase table`);
    if (!name.endsWith('.txt')) continue;   // LocationLoader.cs:84 - file.EndsWith(".txt")
    const instances = loadLocationInstance(Buffer.from(bytes).toString('utf8'));
    if (instances == null) throw new Error(`${name}: no <locations> element`);
    files.push({ file: name, instances, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { files };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2];
  if (!root) { console.error('usage: node tools/worldOfDaggerfallAssets.mjs <extracted archive root> [outDir]'); process.exit(1); }
  const outDir = (process.argv[3] ?? new URL('../vendor/world-of-daggerfall/', import.meta.url).pathname).replace(/\/$/, '');
  const write = (rel, body) => {
    const dest = `${outDir}/${rel}`;
    mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
    writeFileSync(dest, body);
    return dest;
  };

  // 1. The bundle: the eight sources and the manifest, byte for byte.
  const dfmod = readFileSync(`${root}/Mods/world_of_daggerfall.dfmod`);
  console.log(`world_of_daggerfall.dfmod  ${dfmod.length} bytes  ${sha256(dfmod)}`);
  for (const a of readWorldOfDaggerfallBundle(dfmod)) {
    if (!a.path) { console.log(`  (unmapped) ${a.name}  ${a.body.length} bytes  ${sha256(a.body)}`); continue; }
    write(a.path, a.body);
    console.log(`  ${a.path}  ${a.body.length} bytes  ${sha256(a.body)}`);
  }

  // 2. The prefabs, byte for byte - and read once through the ported
  // reader, so a file it cannot read fails here, not in the game.
  const prefabDir = `${root}/Locations/LocationPrefab`;
  const prefabs = [];
  for (const name of readdirSync(prefabDir).sort(ntfsCompare)) {
    const bytes = readFileSync(`${prefabDir}/${name}`);
    const p = loadLocationPrefab(bytes.toString('utf8'));
    if (!p) throw new Error(`${name}: no <locationPrefab> element`);
    write(`LocationPrefab/${name}`, bytes);
    prefabs.push({ name, bytes: bytes.length, sha256: sha256(bytes), objects: p.obj.length });
  }
  console.log(`  LocationPrefab/  ${prefabs.length} files`);

  // 3. The region folders, one pack each.
  const regions = [];
  const folders = readdirSync(`${root}/Locations`).filter((d) => d !== 'LocationPrefab');
  for (const d of folders.sort((a, b) => Number(a) - Number(b))) {
    if (!/^\d+$/.test(d)) throw new Error(`unexpected folder Locations/${d}`);
    const dir = `${root}/Locations/${d}`;
    const { files } = readRegionFolder(readdirSync(dir).map((name) => ({ name, bytes: readFileSync(`${dir}/${name}`) })));
    const pack = encodeRegionPack(Number(d), files);
    const back = decodeRegionPack(pack);   // the pack must read back as what was written
    if (back.count !== files.reduce((n, f) => n + f.instances.length, 0)) throw new Error(`region ${d}: round trip`);
    write(`Locations/${d}.bin`, pack);
    regions.push({
      region: Number(d), pack: `Locations/${d}.bin`, bytes: pack.length, sha256: sha256(pack), count: back.count,
      files: files.map((f) => [f.file, f.bytes, f.instances.length, f.sha256]),
    });
    console.log(`  Locations/${d}.bin  ${pack.length} bytes  ${back.count} instances  ${files.length} files  ${sha256(pack)}`);
  }

  const manifest = {
    what: 'World of Daggerfall 2.0 (Kamer): the Locations tree, as tools/worldOfDaggerfallAssets.mjs read it',
    packVersion: WOD_PACK_VERSION,
    dfmod: { bytes: dfmod.length, sha256: sha256(dfmod) },
    prefabs,
    regions,
    totals: {
      prefabs: prefabs.length,
      prefabObjects: prefabs.reduce((n, p) => n + p.objects, 0),
      regions: regions.length,
      files: regions.reduce((n, r) => n + r.files.length, 0),
      instances: regions.reduce((n, r) => n + r.count, 0),
    },
  };
  // One source file per line: [name, bytes, instances, sha256].
  const json = JSON.stringify(manifest, null, 1)
    .replace(/\[\n\s+("[^"\n]*"),\n\s+(\d+),\n\s+(\d+),\n\s+("[0-9a-f]{64}")\n\s+\]/g, '[$1, $2, $3, $4]');
  write('locations.json', `${json}\n`);
  console.log(`  locations.json  ${JSON.stringify(manifest.totals)}`);
}
