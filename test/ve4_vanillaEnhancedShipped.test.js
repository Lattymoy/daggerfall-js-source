// VE4 (2026-10-05, Mac: "Put it in the codebase") - VANILLA ENHANCED SHIPS WITH THE PORT.
//
// VE3 had the player attach carademono's Vanilla Enhanced, because it is Daggerfall's own textures repainted and
// Port-Doctrine's A RENDER OF GAME DATA IS GAME DATA kept it out. Mac approved carrying it; the doctrine records the one
// exception (test/doctrine.test.js holds the bound). Three of its mods ship under public/art/vanilla-enhanced/, written
// by tools/vanillaEnhancedVendor.mjs from the mod's repository at a pinned commit, and register in the texture-mod door
// beside any the player attaches - one load order, one walk; the Base on by default (AUDIT VE), its add-ons off.
//
// Driven through the real door (systems/dfmodTextures.js), the real pack module over the REAL generated index, the
// real texture door, the real prefs shelf and the real Overhauls registry; only the network and the PNG decode are
// fakes, and each fake picture carries the URL it was fetched from, so every layer says which file drew it. The
// mutants are tools/mutants/ve4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, setShippedDfmods, clearDfmodSources, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF,
  DFMOD_INDEX_VERSION, dfmodStoreKey, dfmodGroundLayers, groundSource, dfmodGeneration, _resetDfmodForTests,
} from '../src/systems/dfmodTextures.js';
import { VE_PACK_MODS, VE_PACK_SOURCE, vePackClient, vePackUrl, installVanillaEnhancedPack, _setVePackIoForTests } from '../src/systems/vanillaEnhancedPack.js';
import { mipFitSize } from '../src/formats/resample.js';   // AUDIT VE P1: the mip rule's one home, the decode worker's and the page's
import { bundleTextureCount, preloadTextureRecord, clearTextureReplacements, textureEntry } from '../src/systems/textureReplacement.js';
import { VE_COMMIT, BC7_MEAN, BC7_MAX, VE_MODS } from '../tools/vanillaEnhancedVendor.mjs';
import { wearVanillaEnhanced, wearClassicTextures, setVeAddon, veAddons, veWorn, VE_ADDONS_PREF } from '../src/systems/vanillaEnhanced.js';
import { OVERHAUL_PANELS, currentOption } from '../src/systems/overhauls.js';
import { setValue } from '../src/systems/settings.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';

const ROOT = new URL('../', import.meta.url);
const bytes = (p) => readFileSync(new URL(p, ROOT));
const json = (p) => JSON.parse(bytes(p).toString('utf8').replace(/^﻿/, ''));
const src = (p) => bytes(`src/${p}`).toString('utf8');
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: new URL('.', ROOT), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
const sha = (b) => createHash('sha256').update(b).digest('hex');
/** A PNG's IHDR width and height. */
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

const INDEX = json('vendor/vanilla-enhanced/vanilla-enhanced.index.json');
const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const ROAD_SLICE = /^\d{3}-TexArray_\d+\.png$/;

// ---- the fake network: each picture is the URL it came from ---------------------------------------------------------
const fetched = [];
const ids = new Map();
const idOf = (url) => { if (!ids.has(url)) ids.set(url, ids.size + 1); return ids.get(url); };
function fakeIo({ w = 1, h = 1 } = {}) {
  _setVePackIoForTests({
    fetch: async (url) => { fetched.push(url); return new TextEncoder().encode(url); },
    decode: async (b) => {
      const id = idOf(new TextDecoder().decode(b));
      return { width: w, height: h, data: Uint8Array.from({ length: w * h * 4 }, (_, i) => [id & 255, id >> 8, 0, 255][i % 4]) };
    },
  });
}
/** The URL id a layer (getColor32's shape) was drawn from. */
const idAt = (layer) => layer.colors[0] + layer.colors[1] * 256;
const drawnFrom = (paths) => paths.map((p) => idOf(vePackUrl(p)));
/** A classic TEXTURE file's surface, as the hosts hand it: record r is 1x1, opaque. */
const classicTex = (n) => ({ recordCount: n, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: Uint8Array.of(0, 0, 0, 255) }) });

function fresh() {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  setPref(VE_ADDONS_PREF, []);
  clearTextureReplacements();
  fakeIo();
  fetched.length = 0;
}

test('VE4 the pack: three mods, every file its directory holds listed with the repository path and the bytes it was written from; a mod\'s records are exactly the PNGs its own manifest names; the only other files are Masked Roads\' road slices, each with its recorded proof within BC7\'s error. AUDIT VE R14: the proof is the vendoring tool\'s - it decodes every BC7 slice against the pictures (the arrays are not in the repo), and its check re-runs it against a clone (`node tools/vanillaEnhancedVendor.mjs <clone>`); this reads the record it wrote and the bytes, not the slices', () => {
  assert.equal(INDEX.Commit, VE_COMMIT, 'the index is the pinned commit\'s');
  assert.deepEqual(VE_PACK_SOURCE, { repo: 'https://github.com/drcarademono/vanilla-enhanced', commit: VE_COMMIT });
  assert.deepEqual(INDEX.Mods.map((m) => m.dir), VE_MODS.map((m) => m.dir));
  let pictures = 0, slices = 0;
  for (const m of INDEX.Mods) {
    const listing = json(`vendor/vanilla-enhanced/${m.dir}.files.json`);
    const manifest = json(`vendor/vanilla-enhanced/${m.index.title}.dfmod.json`);
    assert.equal(listing.Commit, VE_COMMIT);
    assert.equal(listing.ModTitle, manifest.ModTitle);
    const here = tracked(`public/art/vanilla-enhanced/${m.dir}/`).map((f) => f.slice(`public/art/vanilla-enhanced/${m.dir}/`.length));
    assert.deepEqual(here.sort(), [...listing.Files].sort(), `${m.dir}: the tree is the listing`);
    for (const f of listing.Files) assert.equal(sha(bytes(`public/art/vanilla-enhanced/${m.dir}/${f}`)), listing.Sha256[f], `${m.dir}/${f}: the bytes vendored`);
    // the records are the manifest's PNGs - the listing cannot widen a mod
    const named = manifest.Files.filter((f) => /\.png$/i.test(f)).map((f) => f.split('/').pop().toLowerCase()).sort();
    assert.deepEqual(listing.Files.filter((f) => !ROAD_SLICE.test(f)).map((f) => f.toLowerCase()).sort(), named, `${m.dir}: its records are its manifest's`);
    const road = listing.Files.filter((f) => ROAD_SLICE.test(f));
    if (m.dir !== 'masked-roads') assert.deepEqual(road, [], `${m.dir} carries no slice of its own: its arrays are its records`);
    for (const f of road) {
      const [, arr, i] = /^(\d{3}-TexArray)_(\d+)\.png$/.exec(f);
      const proof = listing.Proofs[arr].find((p) => p[0] === Number(i));
      assert.ok(proof[1] <= BC7_MEAN && proof[2] <= BC7_MAX, `${f}: its recorded proof within BC7's error of its slice`);
      assert.match(listing.From[f], /^Textures\/Terrain - Masked Roads\/\d{3}_\d+-0\.png$/, `${f}: the repository's own source picture`);
    }
    for (const proof of Object.values(listing.Proofs).flat()) assert.ok(proof[1] <= BC7_MEAN && proof[2] <= BC7_MAX);
    pictures += listing.Files.length; slices += road.length;
  }
  assert.equal(pictures, 1436);
  assert.equal(slices, 21, 'Masked Roads\' road tiles 46, 47 and 55 in seven arrays');
});

test('VE4 the index: the shape an attached copy\'s index has, at the door\'s version, under the key a store gives the .dfmod; every texture served from its own directory at its own size; every slice from a file the pack carries; an array not 56 deep carries none', () => {
  const carried = new Set(INDEX.Mods.flatMap((m) => json(`vendor/vanilla-enhanced/${m.dir}.files.json`).Files.map((f) => `${m.dir}/${f}`)));
  const used = new Set();
  for (const m of INDEX.Mods) {
    assert.equal(m.index.v, DFMOD_INDEX_VERSION, 'regenerate the pack when the door\'s index changes');
    assert.equal(m.key, dfmodStoreKey(`${m.index.title}.dfmod`), 'an attached copy of the same mod is stored under this key - and shadows the shipped one');
    for (const [name, w, h] of m.index.textures) {
      const path = `${m.dir}/${name}.png`;
      assert.ok(carried.has(path), path);
      assert.deepEqual(pngSize(bytes(`public/art/vanilla-enhanced/${path}`)), [w, h], path);
      used.add(path);
    }
    for (const [name, , , depth] of m.index.arrays) {
      const s = m.slices[name];
      assert.equal(s.length, depth === 56 ? 56 : 0, `${m.dir} ${name}`);
      for (const p of s) { assert.ok(carried.has(p), p); used.add(p); }
    }
  }
  assert.deepEqual([...carried].filter((p) => !used.has(p)), [], 'every file the pack carries is drawn by something');
  const masked = INDEX.Mods.find((m) => m.key === MASKED);
  assert.deepEqual(masked.index.arrays.find((a) => a[0] === '403-TexArray'), ['403-TexArray', 256, 256, 57], 'the malformed array, indexed as it is');
});

test('VE4 the door: the shipped mods register beside the attached in one load order - the Base ON by default, its add-ons off (AUDIT VE), the player\'s choice either way on its own shelf entry; switched on, their names are on the doors and drawn from the port\'s files; an attached copy shadows one and its removal brings the shipped one back as it was; a clear of the attached leaves them (mutants: the Base off by default; the attached copy not shadowing; the shipped mod read from the store; the clear taking the shipped)', async () => {
  // PIN MOVED (AUDIT VE, Mac: "Ensure this is on by default"): VE4 shipped every mod OFF until worn
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [MASKED, true, false], [SNOWLESS, true, false]], 'in load order: the Base on, its add-ons off');
  assert.equal(bundleTextureCount(), 1238, 'the Base\'s names on the doors from the start - its 1,246 PNGs but the eight World of Daggerfall biome pictures, which are not archive-named');
  const gen = dfmodGeneration();
  installVanillaEnhancedPack();
  assert.equal(dfmodGeneration(), gen, 'the same list again changes nothing');
  setDfmodEnabled(BASE, false);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: false }, 'a shipped mod\'s switch is the player\'s choice');
  assert.equal(bundleTextureCount(), 0, 'switched off: nothing on the doors');
  setDfmodEnabled(BASE, true);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: true });
  assert.deepEqual(getPref(DFMOD_OFF_PREF), [], 'and the attached shelf entry is untouched');
  assert.equal(bundleTextureCount(), 1238);
  const name = INDEX.Mods[0].index.textures.find(([n]) => /^500_/.test(n))[0];
  const e = textureEntry(`${name}.png`);
  const c = await preloadTextureRecord(e.archive, e.record, e.frame);
  assert.ok(c, 'a record of the Base\'s, decoded');
  assert.equal(idAt(c), idOf(vePackUrl(`base/${name}.png`)), 'from the port\'s own file');
  // the player's own copy of the Base: stored under the same key, it is the one read - and it is attached, so it is on
  const store = new Map();
  const attachedBase = {
    textAssets: [{ name: 'Vanilla Enhanced - Base.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Base', ModVersion: '3.5.0', GUID: INDEX.Mods[0].index.guid }); } }],
    textures: [{ name: '302_0-0', width: 2, height: 2 }], arrays: [], rgba: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(9) }), close() {},
  };
  const load = async (k) => store.get(k) ?? (k === BASE ? new Uint8Array([1]) : null);
  const opts = { open: async () => attachedBase, saveIndex: async (k, j) => { store.set(k, new TextEncoder().encode(j)); }, background: false };
  await setDfmodSources([BASE], load, opts);
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled, m.version]), [[BASE, false, true, '3.5.0'], [MASKED, true, false, '3.4.7'], [SNOWLESS, true, false, '3.4.7']], 'the attached copy in the shipped one\'s place');
  assert.equal(bundleTextureCount(), 1, 'the attached copy\'s names, not the shipped Base\'s');
  // removed: the shipped Base again, as its own switch left it
  await setDfmodSources([], load, opts);
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [MASKED, true, false], [SNOWLESS, true, false]]);
  assert.equal(bundleTextureCount(), 1238);
  // an add-on the port does not ship, attached by the player and built on the shipped Base, loads after it - one order
  const WINTER = 'dfmod/vanilla enhanced - winter tracks.dfmod';
  const winter = { ...attachedBase, textAssets: [{ name: 'Vanilla Enhanced - Winter Tracks.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Winter Tracks', Dependencies: [{ Name: 'vanilla enhanced - base' }] }); } }] };
  const wload = async (k) => store.get(k) ?? (k === WINTER ? new Uint8Array([1]) : null);
  const wopts = { ...opts, open: async () => winter };
  await setDfmodSources([WINTER], wload, wopts);   // indexed at the attach
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped]), [[BASE, true], [MASKED, true], [SNOWLESS, true], [WINTER, false]], 'AutoSortMods over the attached and the shipped together');
  await setDfmodSources([], wload, wopts);
  await setDfmodSources([WINTER], wload, wopts);   // a boot, from the stored index
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, MASKED, SNOWLESS, WINTER], 'and at every boot after');
  clearDfmodSources();
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, MASKED, SNOWLESS], 'a clear of the attached leaves what ships');
  setShippedDfmods([]);
  assert.deepEqual(attachedDfmods(), [], 'another list replaces it');
  // the pack put in AFTER an attached add-on registered (AUDIT VE R2: a menu may read the store first) - one order still
  await setDfmodSources([WINTER], wload, wopts);
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, MASKED, SNOWLESS, WINTER], 'the pack put in after the attached: AutoSortMods over both');
});

test('VE4 the ground, over the real index: the Base\'s arrays dress the terrain from its own records; Masked Roads, loaded after it, decides its arrays - the Base\'s tiles but its road tiles; its 403 array, 57 deep, is refused and 403 is made of records - the Base\'s and its own three road records; Snowless Swamps, loaded last, decides 402 (DFU: TryImportTextureArray, the first mod in TryGetAsset\'s walk)', async () => {
  fresh();
  installVanillaEnhancedPack();
  setDfmodEnabled(BASE, false);   // PIN MOVED (AUDIT VE): the Base is on by default - switched off, the classic set
  assert.equal(await dfmodGroundLayers(302, classicTex(56)), null, 'off: the classic set');
  setDfmodEnabled(BASE, true);
  assert.deepEqual(groundSource(302), { kind: 'array', key: BASE, name: '302-TexArray', depth: 56 });
  let L = await dfmodGroundLayers(302, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => `base/302_${r}-0.png`)), 'slice r is the Base\'s own record r');
  setDfmodEnabled(MASKED, true);
  assert.deepEqual(groundSource(302), { kind: 'array', key: MASKED, name: '302-TexArray', depth: 56 }, 'the add-on is met first');
  L = await dfmodGroundLayers(302, classicTex(56));
  const road = (r) => [46, 47, 55].includes(r);
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => (road(r) ? `masked-roads/302-TexArray_${r}.png` : `base/302_${r}-0.png`))), 'the Base\'s tiles, the road tiles masked');
  L = await dfmodGroundLayers(303, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => (road(r) ? `masked-roads/303_${r}-0.png` : `base/303_${r}-0.png`))), 'where its own record is the slice, its record draws it');
  const warn = console.warn; let said = '';
  console.warn = (s) => { said += s; };
  try {
    assert.deepEqual(groundSource(403), { kind: 'array', key: MASKED, name: '403-TexArray', depth: 57 });
    L = await dfmodGroundLayers(403, classicTex(56));
  } finally { console.warn = warn; }
  assert.match(said, /403-TexArray: expected depth 56 but got 57/, 'refused, as DFU logs it');
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => (road(r) ? `masked-roads/403_${r}-0.png` : `base/403_${r}-0.png`))), 'the records: its own three, the Base\'s for the rest');
  setDfmodEnabled(SNOWLESS, true);
  assert.deepEqual(groundSource(402), { kind: 'array', key: SNOWLESS, name: '402-TexArray', depth: 56 }, 'loaded last, met first');
  L = await dfmodGroundLayers(402, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => `snowless-swamps-and-jungles/402_${r}-0.png`)));
  assert.equal(groundSource(302).key, MASKED, 'Snowless Swamps carries no 302: Masked Roads still decides it');
});

test('VE4 the client: a texture asked at the texture detail is the mip a bundle would decode - halved until it fits, as mipLevelFor picks; an array is its slices, a few at a time; a name the mod does not carry is refused (mutants: the detail not honoured; every slice fetched at once)', async () => {
  assert.deepEqual(mipFitSize(256, 256, 256), [256, 256]);
  assert.deepEqual(mipFitSize(512, 256, 256), [256, 128]);
  assert.deepEqual(mipFitSize(1024, 1024, 300), [256, 256], 'a mip, not a fit: 512 is over, 256 is the level');
  assert.deepEqual(mipFitSize(13, 107, 64), [6, 53]);
  assert.deepEqual(mipFitSize(64, 64, Infinity), [64, 64], 'full detail');
  fresh();
  fakeIo({ w: 512, h: 256 });
  const base = VE_PACK_MODS.find((m) => m.key === BASE);
  const client = vePackClient(base);
  const name = base.index.textures[0][0];
  const img = await client.rgba(name, { maxSize: 256 });
  assert.deepEqual([img.width, img.height], [256, 128]);
  assert.deepEqual([(await client.rgba(name)).width], [512], 'no detail asked: the picture whole');
  await assert.rejects(client.rgba('999_0-0'), /carries no 999_0-0/);
  // a few at a time
  let live = 0, most = 0;
  _setVePackIoForTests({
    fetch: async (url) => { live++; most = Math.max(most, live); await new Promise((r) => setTimeout(r, 1)); live--; return new TextEncoder().encode(url); },
    decode: async () => ({ width: 1, height: 1, data: new Uint8Array(4) }),
  });
  const layers = await client.layers('302-TexArray');
  assert.equal(layers.length, 56);
  assert.equal(most, 8, 'PRELOAD_CONCURRENCY at once, never all 56');
  await assert.rejects(vePackClient(VE_PACK_MODS.find((m) => m.key === MASKED)).layers('403-TexArray'), /carries no slices/);
  assert.equal(vePackUrl('masked-roads/302-TexArray_46.png', 'https://x.test/play/'), 'https://x.test/play/art/vanilla-enhanced/masked-roads/302-TexArray_46.png');
  fakeIo();
});

test('VE4 the card over the shipped pack: Vanilla Enhanced is a fresh game\'s look (AUDIT VE) - the Base alone, the add-ons off until picked on the card; an add-on picked is kept across a turn to Classic and worn again with the Base (mutants: the add-ons worn by default; the pick not kept; Classic forgetting the add-ons)', () => {
  // PIN MOVED (AUDIT VE, Mac: "Ensure this is on by default"): VE4's fresh game was Classic
  fresh();
  const tex = OVERHAUL_PANELS.find((p) => p.id === 'texture');
  const [classic, ve] = tex.options;
  assert.equal(currentOption(tex), ve, 'a fresh game wears Vanilla Enhanced');
  assert.deepEqual(ve.addons().map((m) => m.title), ['Vanilla Enhanced - Masked Roads', 'Vanilla Enhanced - Snowless Swamps and Jungles']);
  wearVanillaEnhanced();
  assert.ok(veWorn());
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, false, false], 'the Base alone');
  setVeAddon(MASKED, true);
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, true, false]);
  assert.deepEqual(getPref(VE_ADDONS_PREF), [MASKED]);
  wearClassicTextures();
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [false, false, false]);
  assert.equal(currentOption(tex), classic);
  assert.deepEqual(getPref(VE_ADDONS_PREF), [MASKED], 'kept across Classic');
  ve.apply();
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, true, false], 'worn again as it was');
  setVeAddon(MASKED, false);
  assert.deepEqual(veAddons().map((m) => m.enabled), [false, false]);
  assert.deepEqual(getPref(VE_ADDONS_PREF), []);
  assert.equal(currentOption(tex), ve, 'the Base is the look');
  setDfmodEnabled(BASE, false);
  setDfmodEnabled(SNOWLESS, true);
  assert.equal(currentOption(tex), null, 'an add-on without its Base is neither look: Custom');
});

test('VE4 wiring: the store\'s one registration puts the pack in before the attached register, and the boot seam calls it; the packs card lists it before any host boots; the paper doll\'s HD compose waits for a mod carrying doll art (AUDIT VE R13)', () => {
  // PIN MOVED (AUDIT VE R2): the boot seam's registration is the store's one, which puts the pack in first
  assert.match(src('scenes/shared.js'), /const textures = registerTextureStore\(\)/);
  assert.match(src('scenes/dataSource.js'), /installVanillaEnhancedPack\(\);   \/\/ VE4[^\n]*\n\s+const names = await storedTextureNames\(\);/);
  assert.match(src('ui/enhancedMenu.js'), /function packsCard\(\) \{\n[^\n]*\n\s+installVanillaEnhancedPack\(\);/);   // PIN MOVED (AUDIT VE R2): after the wait for the store
  // PIN MOVED (AUDIT VE R13): a mod switched on that carries doll art, not any attached mod
  assert.match(src('ui/paperDoll.js'), /const composeScale = \(\) => \(dfmodCarriesDollArt\(\) \? PAPERDOLL_HD_SCALE : 1\);/);
  assert.match(src('systems/vanillaEnhanced.js'), /const doorMods = \(\) => \{ installVanillaEnhancedPack\(\); return attachedDfmods\(\); \};/);
});
