// RSH1: THE MOD'S OWN SOURCE, OUT OF ITS OWN BUNDLE.
//
// Readied Spellcasting Hands 1.3 ships one file - `readied spellcasting hands.dfmod`, a Unity 2019.4.10f1 AssetBundle -
// and, like World Tooltips (the same author's, tools/worldTooltipsAssets.mjs), it carries its whole implementation as
// TextAssets rather than a compiled assembly: the author's `Modded_FPSSpellCasting_Ready.cs`, the `ModLoader.cs` that
// adds it to the player, and the manifest. The licence ships beside the bundle in the zip, as plain text.
//
// So `vendor/readied-spellcasting-hands/Scripts/` holds the author's source rather than a decompile, and every cite the
// port writes against it resolves against a file anyone holding the shipped zip can reproduce byte for byte:
//
//   node tools/readiedHandsAssets.mjs <path-to>/"readied spellcasting hands.dfmod" [outDir]
//
// Default outDir is vendor/readied-spellcasting-hands. It prints each asset's size and sha256, which is what
// test/systems/rsh1_readiedhands.test.js pins.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readUnityBundle } from '../src/formats/unity/unityBundle.js';
import { isMain } from './lib/isMain.mjs';

/** The bundle's three text assets, by the name they carry inside it, mapped to the path this tree keeps them at. */
export const READIED_HANDS_ASSETS = Object.freeze({
  'Modded_FPSSpellCasting_Ready.cs': 'Scripts/Modded_FPSSpellCasting_Ready.cs',
  'ModLoader.cs': 'Scripts/ModLoader.cs',
  'readiedSpellCastHand.dfmod': 'readiedSpellCastHand.dfmod.json',
});

/** The text assets as { name, path, body } - pure, for a test to drive. */
export function readReadiedHands(bytes) {
  const bundle = readUnityBundle(bytes);
  return bundle.textAssets.map((t) => ({
    name: t.name,
    path: READIED_HANDS_ASSETS[t.name] ?? null,
    // the asset's own BYTES - the decoded text would drop a byte-order mark (AUDIT BRANCH (WoD) n's lesson, in
    // tools/worldOfDaggerfallAssets.mjs); these three carry none, and the bytes are what the sha256 pins hold
    body: t.bytes ? Buffer.from(t.bytes) : Buffer.from(t.text ?? '', 'utf8'),
  }));
}

if (isMain(import.meta.url)) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node tools/readiedHandsAssets.mjs <readied spellcasting hands.dfmod> [outDir]'); process.exit(1); }
  const outDir = process.argv[3] ?? fileURLToPath(new URL('../vendor/readied-spellcasting-hands/', import.meta.url));
  const assets = readReadiedHands(readFileSync(src));
  for (const a of assets) {
    const sha = createHash('sha256').update(a.body).digest('hex');
    if (!a.path) { console.log(`  (unmapped) ${a.name}  ${a.body.length} chars  ${sha}`); continue; }
    const dest = `${outDir.replace(/\/$/, '')}/${a.path}`;
    mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
    writeFileSync(dest, a.body);
    console.log(`  ${a.path}  ${a.body.length} chars  ${sha}`);
  }
}
