#!/usr/bin/env node
// HCC (2026-09-23): HORSE CART AND CARGO'S OWN FILES, OUT OF ITS OWN BUNDLE.
//
// The mod ships one file - `horse cart and cargo.dfmod`, a Unity
// 2019.4.40f1 AssetBundle - carrying five text assets: the manifest
// (`horse-cart-and-cargo.dfmod`), the settings schema (`modsettings`),
// the settings' text table (`textdatabase`), the compiled assembly
// (`TrailingWagon.dll`, 276,480 bytes) and a sidecar assembly the mod
// installs only beside UncannyUI / Dragon Rider / Expanded Inventory
// (`HorseCartUiCompatibility.bytes`, 15,872 bytes). The horse art is
// not a Unity texture: the 45 PNGs are EMBEDDED IN THE ASSEMBLY as
// manifest resources, which `formats/dotnetResources.js` reads.
//
//   node tools/hccAssets.mjs "<path to>/Mods/horse cart and cargo.dfmod" [outDir]
//
// Default outDir is vendor/horse-cart-and-cargo. It writes the three
// text files, the two assemblies and the 45 PNGs under Textures/, and
// prints each one's size and sha256 - which test/hcc_assets.test.js
// pins (the PNGs against the vendored assembly, since the bundle is
// the player's and not the repository's). The IL listings beside the
// assemblies are `tools/ilDump.py`'s (dnfile + dncil).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readUnityBundle } from '../src/formats/unityBundle.js';
import { readManifestResources } from '../src/formats/dotnetResources.js';

/** The bundle's text assets, by the name they carry inside it, mapped
 *  to the path this tree keeps them at. */
export const HCC_ASSETS = Object.freeze({
  'horse-cart-and-cargo.dfmod': 'horse-cart-and-cargo.dfmod.json',
  'modsettings': 'modsettings.json',
  'textdatabase': 'textdatabase.csv',
  'TrailingWagon.dll': 'TrailingWagon.dll',
  'HorseCartUiCompatibility.bytes': 'HorseCartUiCompatibility.dll',
});
/** The assembly's resource names all start with this; the files drop it. */
export const RESOURCE_PREFIX = 'TrailingWagon.Horse.';
export const texturePath = (resourceName) => `Textures/${resourceName.startsWith(RESOURCE_PREFIX) ? resourceName.slice(RESOURCE_PREFIX.length) : resourceName}`;

/** The files as { name, path, bytes } - pure, for a test to drive. The
 *  assembly's embedded PNGs ride along under Textures/. */
export function readHccAssets(bundleBytes) {
  const bundle = readUnityBundle(bundleBytes);
  const out = [];
  for (const t of bundle.textAssets) {
    const bytes = t.bytes ?? new TextEncoder().encode(t.text ?? '');
    out.push({ name: t.name, path: HCC_ASSETS[t.name] ?? null, bytes });
    if (t.name === 'TrailingWagon.dll') for (const r of readManifestResources(bytes)) if (r.bytes) out.push({ name: r.name, path: texturePath(r.name), bytes: r.bytes });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node tools/hccAssets.mjs "<horse cart and cargo.dfmod>" [outDir]'); process.exit(1); }
  const outDir = process.argv[3] ?? new URL('../vendor/horse-cart-and-cargo/', import.meta.url).pathname;
  for (const a of readHccAssets(new Uint8Array(readFileSync(src)))) {
    const sha = createHash('sha256').update(a.bytes).digest('hex');
    if (!a.path) { console.log(`  (unmapped) ${a.name}  ${a.bytes.length} bytes  ${sha}`); continue; }
    const dest = `${outDir.replace(/\/$/, '')}/${a.path}`;
    mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
    writeFileSync(dest, a.bytes);
    console.log(`  ${a.path}  ${a.bytes.length} bytes  ${sha}`);
  }
}
