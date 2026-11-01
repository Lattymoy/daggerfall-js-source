// ALIKR1 / SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These
// should be on by default and integrate into our enhanced environments seamlessly") - THE ENVIRONMENT PACKS IN THE
// TEXTURE DOOR. OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): the authors' pictures
// are retired; the packs are ours. Sands of the Alik'r's desert ground is our desert rule over the player's own
// TEXTURE.002 records, and Snowfall's winter ground our snow law over the player's own TEXTURE.103, .303 and .403
// (systems/ownTextures/ownTextureRules.js) - through the door Vanilla Enhanced ships through
// (systems/vanillaEnhanced/vanillaEnhancedPack.js), on by default and built on its Base: the desert's TEXTURE.002 is
// the pack's records over Daggerfall's own (dfmodTextures.js groundSource's ALIKR1 rule - DFU's own walk would hand it
// to the Base's array, and the pack would never be seen), and Snowfall's record 0 decides its three winter archives as
// any mod's does. bible/07-Rendering/Sands-Of-The-Alikr.md and bible/03-World/Snowfall.md are the records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF, DFMOD_INDEX_VERSION, dfmodStoreKey,
  dfmodGroundLayers, groundSource, _resetDfmodForTests, setShippedDfmods,
} from '../../src/systems/dfmodTextures.js';
import { ENVIRONMENT_PACK_MODS, VE_PACK_MODS, installVanillaEnhancedPack, vePackClient, _setVePackIoForTests } from '../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';
import { ownSpec } from '../../src/systems/ownTextures/ownTexturePacks.js';
import { clearTextureReplacements } from '../../src/systems/textureReplacement.js';
import { VE_ADDONS_PREF } from '../../src/systems/vanillaEnhanced/vanillaEnhanced.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { SNOW_MASK_ARCHIVES } from '../../src/systems/snowfall.js';

const ROOT = new URL('../../', import.meta.url);
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: new URL('.', ROOT), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);

const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const SANDS = 'dfmod/sands of the alikr.dfmod';
const SNOWFALL = 'dfmod/snowfall.dfmod';
/** The records the pack dresses - every TEXTURE.002 record, so no classic one (and none of its violet) stands in the desert. */
const SANDS_RECORDS = Object.freeze(Array.from({ length: 56 }, (_, r) => r));

const ids = new Map();
const idOf = (tag) => { if (!ids.has(tag)) ids.set(tag, ids.size + 1); return ids.get(tag); };
const tagOf = (rule, a, r) => `${rule}:${a}_${r}_0`;
/** The tag id a layer (getColor32's shape) was drawn from; 0 is Daggerfall's own record (classicTex). */
const idAt = (layer) => layer.colors[0] + layer.colors[1] * 256;
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
    build: async (spec) => {
      const id = idOf(tagOf(spec.rule, spec.from[0], spec.from[1]));
      return { width: 1, height: 1, data: Uint8Array.of(id & 255, id >> 8, 0, 255) };
    },
  });
}

test('ALIKR1/SNOWFALL1 the packs, ours (OWN-WORK4): no picture of the authors\' in the tree; each index names exactly the pack\'s records at their own size, at the door\'s version, under the key a store gives the .dfmod; Sands names its ground archive, Snowfall none; Sands\' records are our desert rule over the player\'s own, Snowfall\'s our snow law over the winter record or, where the player\'s data has none, the summer one (mutants: a record dropped from an index; looseGround on the wrong pack)', () => {
  for (const d of ['vendor/sands-of-the-alikr/', 'public/art/sands-of-the-alikr/', 'vendor/snowfall/', 'public/art/snowfall/'])
    assert.deepEqual(tracked(d), [], `${d}: retired`);
  const [sands, snow] = ENVIRONMENT_PACK_MODS;
  assert.deepEqual(ENVIRONMENT_PACK_MODS.map((m) => [m.key, m.dir, m.rule, m.index.title, m.index.version, m.index.author]), [
    [SANDS, 'sands-of-the-alikr', 'desert', 'Sands of the Alik\'r', null, 'DFO Online'],
    [SNOWFALL, 'snowfall', 'snow', 'Snowfall', null, 'DFO Online'],
  ]);
  assert.equal(sands.key, dfmodStoreKey('sands of the alikr.dfmod'));
  assert.equal(sands.index.v, DFMOD_INDEX_VERSION);
  assert.deepEqual(sands.index.textures, SANDS_RECORDS.map((r) => [`002_${r}-0`, 64, 64]));
  assert.deepEqual(sands.index.looseGround, [2], 'the desert\'s ground, the archive the pack decides');
  assert.deepEqual(sands.index.deps, [['vanilla enhanced - base', true, false]], 'ordered after the Base, optionally');
  assert.deepEqual(ownSpec(sands, '002_9-0'), { rule: 'desert', from: [2, 9, 0], w: 64, h: 64, seed: ownSpec(sands, '002_9-0').seed });
  const records = SNOW_MASK_ARCHIVES.flatMap((a) => Array.from({ length: 56 }, (_, r) => `${a}_${r}-0`));
  assert.equal(snow.key, dfmodStoreKey('snowfall.dfmod'));
  assert.deepEqual(snow.index.textures, records.map((n) => [n, 64, 64]), 'the winter records alone - the albedo and masks are the snow host\'s');
  assert.equal(snow.index.looseGround, undefined, 'its record 0 decides, as any mod\'s does');
  // ordered after the Base on its own word - the walk below would put it there through Sands' dependency alone, and a
  // copy of Sands the player attaches (shadowing the shipped one) would not
  assert.deepEqual(snow.index.deps, [['vanilla enhanced - base', true, false]], 'built on the Base, optionally');
  const s = ownSpec(snow, '303_12-0');
  assert.deepEqual(s, { rule: 'snow', from: [303, 12, 0], fallback: [302, 12, 0], w: 64, h: 64, seed: s.seed });
});

test('ALIKR1/SNOWFALL1 the door: both ship ON by default, built on the Base - after it in the load order, so its walk meets them first; switched off, they are the player\'s choice (mutants: off by default; the dependency on the Base dropped)', () => {
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [SANDS, true, true], [SNOWFALL, true, true], [MASKED, true, false], [SNOWLESS, true, false]]);
  setDfmodEnabled([SANDS, SNOWFALL], false);
  assert.deepEqual(attachedDfmods().filter((m) => m.key === SANDS || m.key === SNOWFALL).map((m) => m.enabled), [false, false]);
});

test('ALIKR1 the desert\'s ground: Sands of the Alik\'r decides TEXTURE.002 over the Base\'s array - all 56 records our desert rule, at the classic size, no record of the Base\'s; a loose pack that carries fewer stands Daggerfall\'s own for the rest; switched off, the Base\'s array again; a mod loaded after it still decides first; the other archives are the Base\'s (mutants: the looseGround rule dropped; the set taking the Base\'s records where a loose pack carries none; the rule placed before the walk)', async () => {
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(groundSource(2), { kind: 'records', pack: SANDS });
  const L = await dfmodGroundLayers(2, classicTex(56));
  assert.equal(L.length, 56);
  const want = Array.from({ length: 56 }, (_, r) => (SANDS_RECORDS.includes(r) ? idOf(tagOf('desert', 2, r)) : 0));
  assert.deepEqual(L.map(idAt), want, 'its own records, every one - never the Base\'s');
  // a loose pack that carries two records: its own two, and Daggerfall's own for the rest - never the Base's
  const LOOSE = 'dfmod/dunes loose.dfmod';
  const base = VE_PACK_MODS.find((m) => m.dir === 'base');
  const looseIndex = { v: DFMOD_INDEX_VERSION, title: 'Dunes', version: null, author: null, guid: null, deps: [['vanilla enhanced - base', true, false]], looseGround: [2], textures: [['002_1-0', 1, 1], ['002_2-0', 1, 1]], arrays: [], xml: {} };
  const looseClient = { rgba: async (name) => ({ width: 1, height: 1, data: Uint8Array.of(idOf(`loose:${name}`), 0, 0, 255) }), layers: async () => null, close() {} };
  setShippedDfmods([{ key: BASE, index: base.index, open: () => vePackClient(base), on: true }, { key: LOOSE, index: looseIndex, open: () => looseClient, on: true }]);
  assert.deepEqual(groundSource(2), { kind: 'records', pack: LOOSE });
  const loose = await dfmodGroundLayers(2, classicTex(56));
  assert.deepEqual(loose.map(idAt), Array.from({ length: 56 }, (_, r) => (r === 1 || r === 2 ? idOf(`loose:002_${r}-0`) : 0)), 'its own two, Daggerfall\'s for the rest');
  installVanillaEnhancedPack();
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

test('SNOWFALL1 the winter\'s ground: Snowfall\'s record 0 decides TEXTURE.103, .303 and .403 over the Base\'s arrays - our snow law over each of its 56 records; switched off, the Base\'s arrays again; the summer archives are the Base\'s (mutants: the dependency on the Base dropped - the Base would decide)', async () => {
  fresh();
  installVanillaEnhancedPack();
  for (const a of SNOW_MASK_ARCHIVES) {
    assert.deepEqual(groundSource(a), { kind: 'records' }, `${a}: decided by Snowfall's record 0`);
    const L = await dfmodGroundLayers(a, classicTex(56));
    assert.deepEqual(L.map(idAt), Array.from({ length: 56 }, (_, r) => idOf(tagOf('snow', a, r))), `${a}: every record our snow law's`);
  }
  assert.deepEqual(groundSource(102), { kind: 'array', key: BASE, name: '102-TexArray', depth: 56 });
  setDfmodEnabled(SNOWFALL, false);
  for (const a of SNOW_MASK_ARCHIVES) assert.deepEqual(groundSource(a), { kind: 'array', key: BASE, name: `${a}-TexArray`, depth: 56 });
});
