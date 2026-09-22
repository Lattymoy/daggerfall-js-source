// WORLD-HOVER: THE MOD'S OWN SOURCE, OUT OF ITS OWN BUNDLE.
//
// World Tooltips 1.1 ships one file - `world tooltips.dfmod`, a Unity
// 2019.4.28f1 AssetBundle - and unlike most mods it carries its whole
// implementation as a TextAsset rather than a compiled assembly: the
// author's `Modded_HUDTooltipWindow.cs`, the manifest and the settings
// schema, all three in plain text inside the bundle.
//
// That is why `vendor/world-tooltips/Scripts/` can hold the author's
// source rather than a decompile, and why every cite the port writes
// against it resolves against a file anyone holding the shipped zip
// can reproduce byte for byte:
//
//   node tools/worldTooltipsAssets.mjs <path-to>/"world tooltips.dfmod" [outDir]
//
// Default outDir is vendor/world-tooltips. It prints each asset's
// size and sha256, which is what test/vendorIntegrity.test.js pins.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readUnityBundle } from '../src/formats/unityBundle.js';

/** The bundle's three text assets, by the name they carry inside it,
 *  mapped to the path this tree keeps them at. */
export const WORLD_TOOLTIPS_ASSETS = Object.freeze({
  'Modded_HUDTooltipWindow.cs': 'Scripts/Modded_HUDTooltipWindow.cs',
  'modsettings': 'modsettings.json',
  'tooltip.dfmod': 'tooltip.dfmod.json',
});

/** The text assets as { name, path, body } - pure, for a test to drive. */
export function readWorldTooltips(bytes) {
  const bundle = readUnityBundle(bytes);
  return bundle.textAssets.map((t) => ({
    name: t.name,
    path: WORLD_TOOLTIPS_ASSETS[t.name] ?? null,
    body: typeof t.text === 'string' ? t.text : Buffer.from(t.bytes ?? []).toString('utf8'),
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node tools/worldTooltipsAssets.mjs <world tooltips.dfmod> [outDir]'); process.exit(1); }
  const outDir = process.argv[3] ?? new URL('../vendor/world-tooltips/', import.meta.url).pathname;
  const assets = readWorldTooltips(readFileSync(src));
  for (const a of assets) {
    const sha = createHash('sha256').update(a.body).digest('hex');
    if (!a.path) { console.log(`  (unmapped) ${a.name}  ${a.body.length} chars  ${sha}`); continue; }
    const dest = `${outDir.replace(/\/$/, '')}/${a.path}`;
    mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
    writeFileSync(dest, a.body);
    console.log(`  ${a.path}  ${a.body.length} chars  ${sha}`);
  }
}
