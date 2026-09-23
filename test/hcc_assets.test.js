// HCC (2026-09-23, Mac: "Next mod I want to implement 1 to 1 and also enhance its online integration functionality"):
// THE VENDORED FILES ARE THE ASSEMBLY'S. Horse Cart and Cargo embeds its 45 horse PNGs in `TrailingWagon.dll` as .NET
// manifest resources - the first mod this port carries whose art is not a Unity texture - so `formats/dotnetResources.js`
// walks the PE's CLI metadata to them, `tools/hccAssets.mjs` writes them under vendor/horse-cart-and-cargo/Textures/, and
// this pins that what is vendored is byte for byte what the vendored assembly carries, that the reader refuses what is
// not an assembly, and that the mod's own texture names (HorseTextureSet / HorseWalkAnimationSet read them) are all there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifestResources, TABLES } from '../src/formats/dotnetResources.js';
import { HCC_ASSETS, RESOURCE_PREFIX, texturePath } from '../tools/hccAssets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = 'vendor/horse-cart-and-cargo';
const rd = (p) => readFileSync(join(root, p));
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('HCC assets: the 45 PNGs under Textures/ are the assembly\'s manifest resources, byte for byte, under the names the mod reads', () => {
  const res = readManifestResources(new Uint8Array(rd(`${V}/TrailingWagon.dll`)));
  assert.equal(res.length, 45);
  const names = res.map((r) => r.name);
  for (let d = 1; d <= 5; d++) assert.ok(names.includes(`${RESOURCE_PREFIX}horse${d}.png`), `stationary direction ${d}`);
  for (let d = 0; d < 5; d++) for (let f = 1; f <= 8; f++) assert.ok(names.includes(`${RESOURCE_PREFIX}Walk.${d}-${f}.png`), `walk ${d}-${f}`);
  for (const r of res) {
    assert.ok(r.bytes, `${r.name} is implemented in this file`);
    assert.deepEqual([...r.bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${r.name} is a PNG`);
    const p = `${V}/${texturePath(r.name)}`;
    assert.ok(existsSync(join(root, p)), `${p} is vendored`);
    assert.equal(sha(rd(p)), sha(r.bytes), `${p} is the assembly's`);
  }
  assert.equal(texturePath('TrailingWagon.Horse.Walk.2-1.png'), 'Textures/Walk.2-1.png');
});

test('HCC assets: the sidecar assembly carries no resources; a file that is not a PE, or not .NET, is refused; the table schema is ECMA-335\'s forty', () => {
  assert.deepEqual(readManifestResources(new Uint8Array(rd(`${V}/HorseCartUiCompatibility.dll`))), []);
  assert.throws(() => readManifestResources(new Uint8Array(rd(`${V}/Textures/horse1.png`))), /not a PE file|falls in no section/);
  assert.equal(TABLES.length, 0x29, 'Module (0x00) through ManifestResource (0x28)');
  assert.equal(TABLES[0x28][0], 'ManifestResource');
  assert.equal(TABLES[0x02][0], 'TypeDef'); assert.equal(TABLES[0x06][0], 'MethodDef'); assert.equal(TABLES[0x20][0], 'Assembly');
});

test('HCC assets: the bundle\'s five text assets map to the five vendored files, and every one is here', () => {
  assert.deepEqual(Object.values(HCC_ASSETS), ['horse-cart-and-cargo.dfmod.json', 'modsettings.json', 'textdatabase.csv', 'TrailingWagon.dll', 'HorseCartUiCompatibility.dll']);
  for (const f of Object.values(HCC_ASSETS)) assert.ok(existsSync(join(root, `${V}/${f}`)), f);
  const mf = JSON.parse(rd(`${V}/horse-cart-and-cargo.dfmod.json`).toString('utf8'));
  assert.equal(mf.ModVersion, '1.0.0-rc12'); assert.equal(mf.ModAuthor, 'demifiend000'); assert.equal(mf.GUID, '8f8c9e8c-3190-4a66-a4f8-bc38e4761830');
  const settings = JSON.parse(rd(`${V}/modsettings.json`).toString('utf8'));
  assert.deepEqual(settings.Sections.map((s) => s.Name), ['Persistence', 'Presentation', 'Following', 'WagonAccess', 'Hotkeys']);
  assert.equal(rd(`${V}/TrailingWagon.dll`).length, 276480); assert.equal(rd(`${V}/HorseCartUiCompatibility.dll`).length, 15872);
});
