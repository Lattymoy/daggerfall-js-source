// ALIKR1 / SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These
// should be on by default and integrate into our enhanced environments seamlessly") - THE ENVIRONMENT PACKS IN THE
// TEXTURE DOOR. Sands of the Alik'r's desert ground (a loose pack in DFU) and the winter ground Snowfall's bundle
// packages ship through the door Vanilla Enhanced ships through (systems/vanillaEnhancedPack.js), on by default and
// built on its Base: the desert's TEXTURE.002 is the pack's records over Daggerfall's own (dfmodTextures.js
// groundSource's ALIKR1 rule - DFU's own walk would hand it to the Base's array, and the pack would never be seen), and
// Snowfall's record 0 decides its three winter archives as any mod's does. bible/07-Rendering/Sands-Of-The-Alikr.md and
// bible/03-World/Snowfall.md are the records; test/doctrine.test.js holds the two directories to Port-Doctrine's
// second exception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF, DFMOD_INDEX_VERSION, dfmodStoreKey,
  dfmodGroundLayers, groundSource, _resetDfmodForTests,
} from '../src/systems/dfmodTextures.js';
import { ENVIRONMENT_PACK_MODS, vePackUrl, installVanillaEnhancedPack, _setVePackIoForTests } from '../src/systems/vanillaEnhancedPack.js';
import { clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { VE_ADDONS_PREF } from '../src/systems/vanillaEnhanced.js';
import { setValue } from '../src/systems/settings.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { SNOW_MASK_BYTES, SNOWFALL_ARCHIVES } from '../tools/environmentModsExtract.mjs';

const ROOT = new URL('../', import.meta.url);
const bytes = (p) => readFileSync(new URL(p, ROOT));
const json = (p) => JSON.parse(bytes(p).toString('utf8'));
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: new URL('.', ROOT), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const SANDS = 'dfmod/sands of the alikr.dfmod';
const SNOWFALL = 'dfmod/snowfall.dfmod';
/** The records the pack carries - every TEXTURE.002 record but 0, 3, 29 to 33, 50 and 54. */
const SANDS_RECORDS = Object.freeze([1, 2, ...Array.from({ length: 25 }, (_, i) => i + 4), ...Array.from({ length: 16 }, (_, i) => i + 34), 51, 52, 53, 55]);

const ids = new Map();
const idOf = (url) => { if (!ids.has(url)) ids.set(url, ids.size + 1); return ids.get(url); };
/** The URL id a layer (getColor32's shape) was drawn from; 0 is Daggerfall's own record (classicTex). */
const idAt = (layer) => layer.colors[0] + layer.colors[1] * 256;
const urlIn = (root, name) => vePackUrl(`${name}.png`, undefined, root);
const veUrl = (name) => vePackUrl(`base/${name}.png`);
/** A classic TEXTURE file's surface, as the hosts hand it: record r is 1x1, opaque, id 0. */
const classicTex = (n) => ({ recordCount: n, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: Uint8Array.of(0, 0, 0, 255) }) });

function fresh() {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  setPref(VE_ADDONS_PREF, []);
  clearTextureReplacements();
  _setVePackIoForTests({
    fetch: async (url) => new TextEncoder().encode(url),
    decode: async (b) => {
      const id = idOf(new TextDecoder().decode(b));
      return { width: 1, height: 1, data: Uint8Array.of(id & 255, id >> 8, 0, 255) };
    },
  });
}

test('ALIKR1/SNOWFALL1 the packs: each directory is its listing, byte for byte; each index names exactly the pack\'s records at their own size, at the door\'s version, under the key a store gives the .dfmod; Sands names its ground archive, Snowfall none (mutants: a record dropped from an index; looseGround on the wrong pack)', () => {
  // Sands of the Alik'r: 47 loose records of TEXTURE.002
  const sands = json('vendor/sands-of-the-alikr/sands-of-the-alikr.files.json');
  assert.deepEqual(tracked('public/art/sands-of-the-alikr/').map((f) => f.split('/').pop()).sort(), [...sands.Files].sort());
  for (const f of sands.Files) assert.equal(sha(bytes(`public/art/sands-of-the-alikr/${f}`)), sands.Sha256[f], f);
  assert.deepEqual(sands.Files, SANDS_RECORDS.map((r) => `002_${r}-0.png`), 'the records the pack carries, in record order');
  const sandsIdx = json('vendor/sands-of-the-alikr/sands-of-the-alikr.index.json').Mods[0];
  assert.equal(sandsIdx.key, SANDS);
  assert.equal(sandsIdx.key, dfmodStoreKey('sands of the alikr.dfmod'));
  assert.equal(sandsIdx.index.v, DFMOD_INDEX_VERSION);
  assert.deepEqual(sandsIdx.index.textures, SANDS_RECORDS.map((r) => [`002_${r}-0`, 64, 64]));
  for (const [name, w, h] of sandsIdx.index.textures) assert.deepEqual(pngSize(bytes(`public/art/sands-of-the-alikr/${name}.png`)), [w, h]);
  assert.deepEqual(sandsIdx.index.looseGround, [2], 'the desert\'s ground, the archive the pack decides');
  assert.deepEqual(sandsIdx.index.deps, [['vanilla enhanced - base', true, false]], 'ordered after the Base, optionally');
  // Snowfall: the 168 winter records, the albedo and the three masks
  const snow = json('vendor/snowfall/snowfall.files.json');
  assert.deepEqual(tracked('public/art/snowfall/').map((f) => f.split('/').pop()).sort(), [...snow.Files].sort());
  for (const f of snow.Files) assert.equal(sha(bytes(`public/art/snowfall/${f}`)), snow.Sha256[f], f);
  const records = SNOWFALL_ARCHIVES.flatMap((a) => Array.from({ length: 56 }, (_, r) => `${a}_${r}-0`));
  assert.deepEqual(snow.Files.filter((f) => /^\d+_\d+-0\.png$/.test(f)).map((f) => f.slice(0, -4)), records);
  assert.ok(snow.Files.includes('snow_albedo.png'));
  for (const a of SNOWFALL_ARCHIVES) assert.equal(bytes(`public/art/snowfall/snow_surface_masks_${a}.bytes`).length, SNOW_MASK_BYTES, `${a}: 56 records of 64 x 64`);
  const snowIdx = json('vendor/snowfall/snowfall.index.json').Mods[0];
  assert.equal(snowIdx.key, SNOWFALL);
  assert.deepEqual(snowIdx.index.textures, records.map((n) => [n, 64, 64]), 'the records alone - the albedo is no archive\'s');
  assert.equal(snowIdx.index.looseGround, undefined, 'its record 0 decides, as any mod\'s does');
  // ordered after the Base on its own word - the walk below would put it there through Sands' dependency alone, and a
  // copy of Sands the player attaches (shadowing the shipped one) would not
  assert.deepEqual(snowIdx.index.deps, [['vanilla enhanced - base', true, false]], 'built on the Base, optionally');
  assert.equal(snowIdx.index.title, json('vendor/snowfall/snowfall.dfmod.json').ModTitle);
  assert.equal(snowIdx.index.version, json('vendor/snowfall/snowfall.dfmod.json').ModVersion);
  assert.deepEqual(ENVIRONMENT_PACK_MODS.map((m) => [m.key, m.root]), [[SANDS, 'art/sands-of-the-alikr'], [SNOWFALL, 'art/snowfall']]);
});

test('ALIKR1/SNOWFALL1 the door: both ship ON by default, built on the Base - after it in the load order, so its walk meets them first; switched off, they are the player\'s choice (mutants: off by default; the dependency on the Base dropped)', () => {
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [SANDS, true, true], [SNOWFALL, true, true], [MASKED, true, false], [SNOWLESS, true, false]]);
  setDfmodEnabled([SANDS, SNOWFALL], false);
  assert.deepEqual(attachedDfmods().filter((m) => m.key === SANDS || m.key === SNOWFALL).map((m) => m.enabled), [false, false]);
});

test('ALIKR1 the desert\'s ground: Sands of the Alik\'r decides TEXTURE.002 over the Base\'s array - its 47 records over Daggerfall\'s own, at the classic size, no record of the Base\'s; switched off, the Base\'s array again; a mod loaded after it still decides first; the other archives are the Base\'s (mutants: the looseGround rule dropped; the set taking the Base\'s records where Sands carries none; the rule placed before the walk)', async () => {
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(groundSource(2), { kind: 'records', pack: SANDS });
  const L = await dfmodGroundLayers(2, classicTex(56));
  assert.equal(L.length, 56);
  const want = Array.from({ length: 56 }, (_, r) => (SANDS_RECORDS.includes(r) ? idOf(urlIn('art/sands-of-the-alikr', `002_${r}-0`)) : 0));
  assert.deepEqual(L.map(idAt), want, 'its own records, Daggerfall\'s for the eleven it carries none of - never the Base\'s');
  assert.ok(!L.some((l) => [0, 3, 29, 30, 31, 32, 33, 50, 54].map((r) => idOf(veUrl(`002_${r}-0`))).includes(idAt(l))));
  assert.deepEqual(groundSource(302), { kind: 'array', key: BASE, name: '302-TexArray', depth: 56 }, 'the pack names one archive');
  setDfmodEnabled(SANDS, false);
  assert.deepEqual(groundSource(2), { kind: 'array', key: BASE, name: '002-TexArray', depth: 56 }, 'off: DFU\'s own walk, the Base\'s array');
  setDfmodEnabled(SANDS, true);
  // a desert mod the player attaches, built on the pack, loads after it - and decides first, as DFU's walk would have it
  const store = new Map();
  const KEY = 'dfmod/dunes.dfmod';
  const dunes = {
    textAssets: [{ name: 'Dunes.dfmod', get text() { return JSON.stringify({ ModTitle: 'Dunes', ModVersion: '1', Dependencies: [{ Name: 'sands of the alikr' }] }); } }],
    textures: [], arrays: [{ name: '002-TexArray', width: 1, height: 1, depth: 56 }], rgba: async () => null, close() {},
  };
  await setDfmodSources([KEY], async (k) => store.get(k) ?? (k === KEY ? new Uint8Array([1]) : null),
    { open: async () => dunes, saveIndex: async (k, j) => { store.set(k, new TextEncoder().encode(j)); }, background: false });
  assert.deepEqual(attachedDfmods().map((m) => m.key).slice(0, 3), [BASE, SANDS, KEY], 'the attached mod after the pack it is built on');
  assert.deepEqual(groundSource(2), { kind: 'array', key: KEY, name: '002-TexArray', depth: 56 });
});

test('SNOWFALL1 the winter\'s ground: Snowfall\'s record 0 decides TEXTURE.103, .303 and .403 over the Base\'s arrays - its own 56 records each; switched off, the Base\'s arrays again; the summer archives are the Base\'s (mutants: the dependency on the Base dropped - the Base would decide)', async () => {
  fresh();
  installVanillaEnhancedPack();
  for (const a of SNOWFALL_ARCHIVES) {
    assert.deepEqual(groundSource(a), { kind: 'records' }, `${a}: decided by Snowfall's record 0`);
    const L = await dfmodGroundLayers(a, classicTex(56));
    assert.deepEqual(L.map(idAt), Array.from({ length: 56 }, (_, r) => idOf(urlIn('art/snowfall', `${a}_${r}-0`))), `${a}: every record Snowfall's`);
  }
  assert.deepEqual(groundSource(102), { kind: 'array', key: BASE, name: '102-TexArray', depth: 56 });
  setDfmodEnabled(SNOWFALL, false);
  for (const a of SNOWFALL_ARCHIVES) assert.deepEqual(groundSource(a), { kind: 'array', key: BASE, name: `${a}-TexArray`, depth: 56 });
});
