// VE1-VE3 (2026-10-05) - VANILLA ENHANCED, and the two laws of DFU's mod door it found the port without.
//
// carademono's Vanilla Enhanced is Daggerfall's own textures remastered, worn through the texture-mod door - the
// player's own copy (VE3; Port-Doctrine - A RENDER OF GAME DATA IS GAME DATA), shipped since VE4 under the exception
// the doctrine records (test/ve4_vanillaEnhancedShipped.test.js). Its add-ons only work if that door keeps DFU's
// LOAD ORDER (VE1: a mod loads after the mods it depends on, and the one loaded last answers a name), and its terrain
// only reads right if the door keeps DFU's TERRAIN IMPORT (VE2: TryImportTextureArray - the first mod to carry the
// array OR the first record decides, a loose record 0 goes first, and a set made of records takes the classic one
// where a record is not replaced). VE3 wears it on the Texture Overhaul card, with Classic, and switches mods on and
// off as DFU's mod window does (Mod.Enabled); here the player's own copies, which shadow the shipped ones.
//
// Driven through the real door (systems/dfmodTextures.js) over fake bundles in unityBundleClient's shape, the real
// texture door, the real prefs shelf and the real Overhauls registry. The DFU members each pin answers to are cited
// beside it; the mutants are tools/mutants/ve1.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  setDfmodSources, attachedDfmods, dfmodLoadOrder, dfmodFileName, manifestDeps, buildDfmodIndex, DFMOD_INDEX_VERSION,
  setDfmodEnabled, dfmodEnabled, forgetDfmodOff, DFMOD_OFF_PREF, DFMOD_SHIPPED_PREF, dfmodGroundLayers, groundSource, hasDfmodGround,
  dfmodImgImage, dfmodGeneration, noteDfmodAttached, _resetDfmodForTests,
} from '../src/systems/dfmodTextures.js';
import { installVanillaEnhancedPack } from '../src/systems/vanillaEnhancedPack.js';
import { preloadTextureRecord, setTextureReplacements, clearTextureReplacements, looseTextureExists, looseTextureGeneration, PRELOAD_CONCURRENCY } from '../src/systems/textureReplacement.js';
import { billboardXmlScale } from '../src/world/billboardXml.js';
import { setValue, getBool } from '../src/systems/settings.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { OVERHAUL_PANELS, currentOption } from '../src/systems/overhauls.js';
import { VE_BASE, VE_BASE_GUID, VE_ADDONS_PREF, isVeFamily, veWorn, classicTexturesWorn } from '../src/systems/vanillaEnhanced.js';
import { IIL_MOD } from '../src/systems/improvedInteriorLighting.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const enc = (t) => new TextEncoder().encode(t);

/** A fake bundle in unityBundleClient's shape: textures `[name, w, h, fill]`, arrays `{ name: [w, h, depth, fill,
 *  slices?] }` (slice i filled with fill + i; `slices`, when given, what the bundle really decodes against the depth its
 *  header - and so its index - says), the manifest carrying `deps` as ModInfo.Dependencies. */
function fakeMod(title, { deps = [], textures = [], arrays = {}, xml = {}, guid = title, version = '3.4.7' } = {}) {
  const manifest = JSON.stringify({
    ModTitle: title, ModVersion: version, ModAuthor: 'carademono', GUID: guid,
    Dependencies: deps.map(([Name, IsOptional = false, IsPeer = false]) => ({ Name, IsOptional, IsPeer })),
  });
  const px = (w, h, v) => ({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(v) });
  return {
    textAssets: [{ name: `${title}.dfmod`, bytes: enc(manifest), get text() { return manifest; } },
      ...Object.entries(xml).map(([name, t]) => ({ name, bytes: enc(t), get text() { return t; } }))],
    textures: textures.map(([name, w, h]) => ({ name, width: w, height: h, format: 4 })),
    arrays: Object.entries(arrays).map(([name, [w, h, depth]]) => ({ name, width: w, height: h, depth })),
    rgba: async (name) => { const t = textures.find((x) => x[0] === name); return t ? px(t[1], t[2], t[3] ?? 200) : null; },
    layers: async (name) => { const a = arrays[name]; return a ? Array.from({ length: a[4] ?? a[2] }, (_, i) => px(a[0], a[1], a[3] + i)) : null; },
    close() {},
  };
}

/** Attach `mods` ({ storeKey: fakeMod }) through the real registration, indexing each as an attach does. */
/** The mods registered from the store, as a boot registers them - or (`asPlayer`) attached as the packs card attaches:
 *  the shipped pack in the door, and each mod's attach step first (AUDIT VE R3: a mod attached is on, and a copy over
 *  a shipped mod switches that mod's switch). */
async function attach(mods, { asPlayer = false } = {}) {
  _resetDfmodForTests();
  if (asPlayer) {
    installVanillaEnhancedPack();
    for (const [k, b] of Object.entries(mods)) noteDfmodAttached(k, buildDfmodIndex(b));
  }
  const stored = new Map();
  const load = async (k) => stored.get(k) ?? (mods[k] ? enc(k) : null);
  const open = async (bytes) => mods[new TextDecoder().decode(bytes)];
  await setDfmodSources(Object.keys(mods), load, { open, saveIndex: async (k, j) => { stored.set(k, enc(j)); }, background: false });
  return stored;
}

/** A classic TEXTURE file's surface, as the hosts hand it: record r is `w x h` of red 10 + r, opaque. */
const classicTex = (n, w = 1, h = 1) => ({
  recordCount: n, getDFBitmap: (r) => r,
  getColor32: (r) => ({ width: w, height: h, colors: Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 0 ? 10 + r : i % 4 === 3 ? 255 : 0)) }),
});
const red = (layer) => layer.colors[0];

const VE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const WINTER = 'dfmod/vanilla enhanced - winter tracks.dfmod';

function fresh() {
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});   // VE4 / AUDIT VE: the shipped mods' switches
  setPref(VE_ADDONS_PREF, []);   // VE4: the add-ons the look is worn with
  clearTextureReplacements();
}

test('VE1 AutoSortMods: the listing by file name, each mod after every attached mod it depends on - optional or not, never a peer, the missing dropped, a cycle leaving the listing (mutants: the dependency visited after its dependent; a peer ordered; an optional one skipped; the cycle thrown)', () => {
  const m = (name, deps = []) => ({ key: `dfmod/${name}.dfmod`, index: { deps } });
  const order = (mods) => dfmodLoadOrder(mods).map((x) => dfmodFileName(x.key));
  assert.deepEqual(order([m('c'), m('a'), m('b')]), ['a', 'b', 'c'], 'no dependency: the Mods folder\'s listing, by file name');
  // TopologicalSort (ModManager.cs:1261-1288): a depth-first visit in the listing's order, a mod's dependencies first
  assert.deepEqual(order([m('a', [['c', false, false]]), m('b'), m('c')]), ['c', 'a', 'b'], 'a is visited first, so c lands before it - and b after both');
  assert.deepEqual(order([m('a', [['c', true, false]]), m('b'), m('c')]), ['c', 'a', 'b'], 'an OPTIONAL dependency that is attached orders too (AutoSortMods filters peers only)');
  assert.deepEqual(order([m('a', [['c', false, true]]), m('b'), m('c')]), ['a', 'b', 'c'], 'a PEER may stand anywhere: `where !dependency.IsPeer`');
  assert.deepEqual(order([m('a', [['nowhere', false, false]]), m('b')]), ['a', 'b'], 'a dependency not attached is dropped (GetModFromName answers null)');
  assert.deepEqual(order([m('a', [['b', false, false]]), m('b', [['c', false, false]]), m('c')]), ['c', 'b', 'a'], 'transitively');
  assert.deepEqual(order([m('a', [['B', false, false]]), m('b')]), ['b', 'a'], 'the store keeps every name lower case, and so does the match');
  const warn = console.warn; let said = '';
  console.warn = (s) => { said += s; };
  try {
    assert.deepEqual(order([m('a', [['b', false, false]]), m('b', [['a', false, false]]), m('c')]), ['a', 'b', 'c'], 'a cycle throws in TopologicalSort; AutoSortMods keeps the order it had');
  } finally { console.warn = warn; }
  assert.match(said, /Cyclic dependency found/);
  // Vanilla Enhanced's own manifests (3.4.7, github.com/drcarademono/vanilla-enhanced), stored under names that would
  // list them backwards: every add-on still loads after the Base, and Snowless Swamps after Masked Roads (its optional)
  const base = { key: 'dfmod/z.dfmod', index: { deps: manifestDeps({ Dependencies: [{ Name: 'world of daggerfall - biomes', IsOptional: true, IsPeer: false }, { Name: 'world of daggerfall', IsOptional: true, IsPeer: false }, { Name: 'rmb resource pack', IsOptional: true, IsPeer: false }] }) } };
  const ve = [
    { key: 'dfmod/a snowless.dfmod', index: { deps: [['z', false, false], ['b masked', true, false], ['world of daggerfall - biomes', true, false]] } },
    { key: 'dfmod/b masked.dfmod', index: { deps: [['world of daggerfall - biomes', true, false], ['z', false, false]] } },
    { key: 'dfmod/c winter.dfmod', index: { deps: [['z', false, false]] } },
    base,
  ];
  assert.deepEqual(dfmodLoadOrder(ve).map((x) => dfmodFileName(x.key)), ['z', 'b masked', 'a snowless', 'c winter']);
});

test('VE1 the index carries ModInfo.Dependencies - name, optional, peer - at version 3; a v2 index is built again (mutants: the version left at 2; IsPeer read as IsOptional)', async () => {
  assert.equal(DFMOD_INDEX_VERSION, 3);
  const b = fakeMod('Vanilla Enhanced - Snowless Swamps and Jungles', { deps: [[VE_BASE], ['vanilla enhanced - masked roads', true], ['peer thing', false, true]] });
  assert.deepEqual(buildDfmodIndex(b).deps, [[VE_BASE, false, false], ['vanilla enhanced - masked roads', true, false], ['peer thing', false, true]]);
  assert.deepEqual(manifestDeps({ Dependencies: [{ Name: '' }, null, { IsOptional: true }] }), [], 'a dependency with no name is no dependency');
  // a bundle whose stored index is the old version is indexed again at registration
  _resetDfmodForTests();
  const opened = [];
  const stored = new Map([['dfmod-index/x.dfmod', enc(JSON.stringify({ v: 2, title: 'X', textures: [['302_0-0', 1, 1]], arrays: [], xml: {} }))]]);
  await setDfmodSources(['dfmod/x.dfmod'], async (k) => stored.get(k) ?? (k === 'dfmod/x.dfmod' ? enc(k) : null), {
    open: async (bytes) => { opened.push(new TextDecoder().decode(bytes)); return fakeMod('X', { deps: [['base']] }); },
    saveIndex: async (k, j) => { stored.set(k, enc(j)); }, background: false,
  });
  assert.deepEqual(opened, ['dfmod/x.dfmod'], 'the v2 index is refused and the bundle opened to build a v3');
  assert.equal(JSON.parse(new TextDecoder().decode(stored.get('dfmod-index/x.dfmod'))).v, 3);
  assert.deepEqual(attachedDfmods()[0].deps, ['base']);
});

test('VE1 TryGetAsset: the mod loaded LAST answers every door - its texture, the xml by its own name whichever mod drew the picture, its IMG - and a dependent named before its base still wins (mutants: the first-loaded kept; the walk in load order; the xml tied to the texture\'s mod)', async () => {
  fresh();
  const mods = {
    // the base sorts AFTER its add-on by name: only the dependency puts it first
    'dfmod/zz base.dfmod': fakeMod('Base', { textures: [['403_5-0', 4, 4, 40], ['210_1-0', 2, 2, 41], ['SCBG04I0.IMG', 3, 3, 42]], xml: { '210_1-0': '<info><scaleX>1</scaleX><scaleY>1</scaleY></info>' } }),
    'dfmod/aa addon.dfmod': fakeMod('Addon', { deps: [['zz base']], textures: [['403_5-0', 8, 8, 80], ['SCBG04I0.IMG', 5, 5, 82]], xml: { '210_1-0': '<info><scaleX>2</scaleX><scaleY>3</scaleY></info>' } }),
  };
  const stored = await attach(mods);
  assert.deepEqual(attachedDfmods().map((m) => m.fileName), ['zz base', 'aa addon'], 'listed in load order: the base first');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 8, 'the add-on, loaded after its base, answers 403_5-0');
  // a BOOT registers from the stored indexes - the order is taken there too, not only as each mod is indexed
  _resetDfmodForTests();
  await setDfmodSources(Object.keys(mods), async (k) => stored.get(k) ?? (mods[k] ? enc(k) : null), { open: async (bytes) => mods[new TextDecoder().decode(bytes)], background: false });
  assert.deepEqual(attachedDfmods().map((m) => m.fileName), ['zz base', 'aa addon'], 'a boot from stored indexes: the same order');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 8);
  assert.equal((await preloadTextureRecord(210, 1, 0)).width, 2, 'a name only the base carries is still the base\'s');
  assert.deepEqual(billboardXmlScale(210, 1), { x: 2, y: 3 }, 'XMLManager seeks the xml by name: the add-on\'s, though the picture is the base\'s');
  assert.equal((await dfmodImgImage('SCBG04I0.IMG')).width, 5);
  // with no dependency between them, the later by file name - DFU's default load order is the folder's listing
  fresh();
  await attach({ 'dfmod/a.dfmod': fakeMod('A', { textures: [['403_5-0', 4, 4]] }), 'dfmod/b.dfmod': fakeMod('B', { textures: [['403_5-0', 9, 9]] }) });
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 9);
});

test('VE3 Mod.Enabled: a mod switched off answers nothing and keeps its place; the choice is the prefs shelf\'s; every mod off is still a registration; a fresh attach and a removal forget it (mutants: the off mod still installed; the switch not re-installing; nothing registered read as no registration; forget leaving the key)', async () => {
  fresh();
  await attach({
    [VE]: fakeMod('Vanilla Enhanced - Base', { guid: VE_BASE_GUID, textures: [['403_5-0', 4, 4]] }),
    [SNOWLESS]: fakeMod('Vanilla Enhanced - Snowless Swamps and Jungles', { deps: [[VE_BASE], ['vanilla enhanced - masked roads', true]], textures: [['403_5-0', 8, 8]] }),
  });
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 8);
  const gen = dfmodGeneration();
  setDfmodEnabled(SNOWLESS, false);
  assert.ok(dfmodGeneration() > gen, 'the doors are put back at once');
  assert.deepEqual(getPref(DFMOD_OFF_PREF), [SNOWLESS]);
  assert.equal(dfmodEnabled(SNOWLESS), false);
  assert.deepEqual(attachedDfmods().map((m) => [m.fileName, m.enabled]), [[VE_BASE, true], ['vanilla enhanced - snowless swamps and jungles', false]], 'still listed, in its place, switched off');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 4, 'EnumerateEnabledModsReverse: the base answers');
  setDfmodEnabled([SNOWLESS], true);
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 8);
  // every mod switched off puts nothing on the doors - and that is still a registration: the next host's boot over the
  // same set must not register again (it would bump the generation every cache of pictures keys on)
  const store = new Map();
  const mods = { [VE]: fakeMod('Vanilla Enhanced - Base', { textures: [['403_5-0', 4, 4]] }) };
  const load = async (k) => store.get(k) ?? (mods[k] ? enc(k) : null);
  const opts = { open: async (bytes) => mods[new TextDecoder().decode(bytes)], saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false };
  _resetDfmodForTests();
  await setDfmodSources([VE], load, opts);
  setDfmodEnabled(VE, false);
  const off = dfmodGeneration();
  assert.equal(await setDfmodSources([VE], load, opts), 0, 'nothing on the doors');
  assert.equal(dfmodGeneration(), off, 'the same set, all off: not registered again');
  setDfmodEnabled(VE, true);
  setDfmodEnabled(SNOWLESS, false);
  forgetDfmodOff([SNOWLESS, 'dfmod/never.dfmod']);
  assert.deepEqual(getPref(DFMOD_OFF_PREF), []);
  // the attach and both removals forget, and the warm opens only what is on
  const ds = src('scenes/dataSource.js');
  assert.match(ds, /await storeAssets\(TEXTURE_STORE, \[f\], \(\) => true, \(\) => key\);\n\s+forgetDfmodOff\(key\);/);
  assert.match(ds, /await deleteAssets\(TEXTURE_STORE, \[key, dfmodIndexKey\(key\)\]\);\n\s+forgetDfmodOff\(key\);/);
  assert.match(ds, /await deleteAssets\(TEXTURE_STORE, names\);\n\s+\(await import\('\.\.\/systems\/dfmodTextures\.js'\)\)\.forgetDfmodOff\(names\);/);
  assert.match(src('systems/dfmodTextures.js'), /if \(dfmodEnabled\(key\)\) await bundleFor\(key\);/);
});

test('VE2 TryImportTextureArray: the FIRST mod in load order to carry the array or record 0 decides; its array at the archive\'s depth is the set; a loose record 0 goes before every mod (mutants: the array preferred over a later mod\'s record; the loose tier skipped; the depth law loosened)', async () => {
  fresh();
  // b loads after a: b's record 0 is met before a's array, so the set is made of records
  await attach({
    'dfmod/a.dfmod': fakeMod('A', { arrays: { '302-TexArray': [2, 2, 3, 100] } }),
    'dfmod/b.dfmod': fakeMod('B', { textures: [['302_0-0', 2, 2, 50], ['302_2-0', 2, 2, 52]] }),
  });
  assert.deepEqual(groundSource(302), { kind: 'records' });
  let L = await dfmodGroundLayers(302, classicTex(3));
  assert.deepEqual(L.map((l) => [l.width, red(l)]), [[2, 50], [2, 11], [2, 52]], 'record 1 is replaced nowhere: the classic record, at the set\'s size');
  // a loads after b: its array is met first
  fresh();
  await attach({
    'dfmod/a.dfmod': fakeMod('A', { textures: [['302_0-0', 2, 2, 50]] }),
    'dfmod/b.dfmod': fakeMod('B', { arrays: { '302-TexArray': [2, 2, 3, 100] } }),
  });
  assert.deepEqual(groundSource(302), { kind: 'array', key: 'dfmod/b.dfmod', name: '302-TexArray', depth: 3 });
  L = await dfmodGroundLayers(302, classicTex(3));
  assert.deepEqual(L.map(red), [100, 101, 102], 'the array, slice by slice');
  // an array of another depth is refused: the records are sought (a's record 0, the classic for the rest)
  const warn = console.warn; console.warn = () => {};
  try {
    L = await dfmodGroundLayers(302, classicTex(4));
  } finally { console.warn = warn; }
  assert.deepEqual(L.map((l) => [l.width, red(l)]), [[2, 50], [2, 11], [2, 12], [2, 13]], '`textureArray.depth == depth` or the records');
  console.warn = () => {};
  try {
    L = await dfmodGroundLayers(302, classicTex(2));
  } finally { console.warn = warn; }
  assert.deepEqual(L.map(red), [50, 11], 'an array DEEPER than the archive is refused too - never cut down to it');
  // the bundle decodes another number of slices than its index says: the array decided and will not draw - classic
  fresh();
  await attach({ 'dfmod/b.dfmod': fakeMod('B', { arrays: { '302-TexArray': [2, 2, 3, 100, 4] } }) });
  assert.equal(await dfmodGroundLayers(302, classicTex(3)), null, 'one layer per record or none (GROUND1\'s whole-or-nothing)');
  // a LOOSE record 0 goes first - TextureExistsAmongLooseFiles - and each record is sought loose, then by the mods
  setTextureReplacements(['302_0-0.png', '302_2-0.png'], async () => new Uint8Array([1]));
  assert.ok(looseTextureExists(302, 0, 0));
  assert.deepEqual(groundSource(302), { kind: 'records' }, 'the mod\'s array is never asked');
  const decode = async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(77) });
  L = await dfmodGroundLayers(302, classicTex(3), { decode });
  assert.deepEqual(L.map(red), [77, 11, 77]);
  clearTextureReplacements();
});

test('VE2 the records\' set: record 0\'s size, else the classic; a record of another size stands classic; nothing replaced is null; the gate shut is null; a new loose pick builds again; the records decode a few at once (mutants: the mismatched picture kept; the classic size never taken; the cache keyed without the pick; every record decoded together)', async () => {
  fresh();
  // no record 0 anywhere: GetTerrainTextureArray's own loop - the classic size, the replaced records that fit it
  await attach({ 'dfmod/a.dfmod': fakeMod('A', { textures: [['302_1-0', 4, 4, 60], ['302_2-0', 1, 1, 61]] }) });
  assert.equal(groundSource(302), null, 'neither name of TryImportTextureArray');
  assert.ok(hasDfmodGround(302, 3), 'but the archive is dressed');
  const L = await dfmodGroundLayers(302, classicTex(3));
  assert.deepEqual(L.map((l) => [l.width, red(l)]), [[1, 10], [1, 11], [1, 61]], 'the set is the classic size; record 1 is not, so it stands classic, and record 2 is');
  assert.equal(await dfmodGroundLayers(402, classicTex(3)), null, 'nothing dresses 402');
  assert.ok(!hasDfmodGround(402, 3));
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(await dfmodGroundLayers(302, classicTex(3)), null, 'Replace Game Artwork off: the classic set');
  assert.equal(groundSource(302), null);
  setValue('Enhancements', 'AssetInjection', 'True');
  // a loose pick is a new generation, and the set is built again from it
  const before = looseTextureGeneration();
  setTextureReplacements(['302_0-0.png'], async () => new Uint8Array([1]));
  assert.ok(looseTextureGeneration() > before);
  const M = await dfmodGroundLayers(302, classicTex(3), { decode: async () => ({ width: 1, height: 1, data: new Uint8Array([90, 0, 0, 255]) }) });
  assert.deepEqual(M.map(red), [90, 11, 61], 'record 0 is loose now: its size is the set\'s');
  // fifty-six records of a pack decode a few at once, as an archive's preload does - never all together
  setTextureReplacements(Array.from({ length: 56 }, (_, r) => `102_${r}-0.png`), async () => new Uint8Array([1]));
  let live = 0, most = 0;
  const slow = async () => { live++; most = Math.max(most, live); await new Promise((r) => setTimeout(r, 2)); live--; return { width: 1, height: 1, data: new Uint8Array([5, 0, 0, 255]) }; };
  const N = await dfmodGroundLayers(102, classicTex(56), { decode: slow });
  assert.equal(N.length, 56);
  assert.equal(most, PRELOAD_CONCURRENCY, `at most ${PRELOAD_CONCURRENCY} decoding at once`);
  clearTextureReplacements();
});

test('VE2 the hosts: the two terrain hosts hand the classic file and upload what comes back; the interior and dungeon hosts draw no ground (THE FOUR HOSTS)', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /const modLayers = await dfmodGroundLayers\(groundArchive, groundTex\);[\s\S]{0,400}?renderer\.uploadTileArray\(groundArchive, modLayers \? layers : markPuddleWater\(layers\)\);/, host);
  }
  const uploaders = readdirSync(new URL('../src/scenes/', import.meta.url)).filter((f) => f.endsWith('.js') && /uploadTileArray\(/.test(src(`scenes/${f}`)));
  assert.deepEqual(uploaders.sort(), ['exterior.js', 'world.js'], 'worldModes.js (interiors) and dungeonContext.js have no ground to dress');
});

test('VE3/VE4 the Texture Overhaul card: Classic and Vanilla Enhanced - the pack ships and the player\'s own copy shadows it; wearing it switches the Base on with Replace Game Artwork and the add-ons it was last worn with; Classic switches every texture mod off but the lighting mod and keeps the add-ons for the next wear; Custom for a mix (mutants: Classic sparing a texture mod; the Base not switched on; the add-ons forgotten across Classic; Custom read as Classic)', async () => {
  fresh();
  const tex = OVERHAUL_PANELS.find((p) => p.id === 'texture');
  assert.deepEqual(tex.options.map((o) => [o.id, o.name]), [['classic', 'Classic'], ['vanilla-enhanced', 'Vanilla Enhanced']]);
  const [classic, ve] = tex.options;
  await attach({});
  // PIN MOVED (AUDIT VE, Mac: "Ensure this is on by default"): nothing attached was Classic while the shipped pack was off
  assert.equal(currentOption(tex), ve, 'nothing attached: the shipped Base, on by default');
  assert.equal(ve.by, 'carademono, version 3.4.7', 'VE4: the shipped Base');
  // PIN MOVED (AUDIT VE R3, one switch a mod): a copy over a shipped mod wears that mod's switch, so the attach's own
  // step is what switches it on - this registered the copies without it, and each was on by its own empty shelf
  await attach({
    'dfmod/dream - sprites.dfmod': fakeMod('DREAM - Sprites', { textures: [['210_0-0', 2, 2]] }),
    'dfmod/improved interior lighting.dfmod': fakeMod('Improved Interior Lighting', { guid: IIL_MOD.guid }),
    [VE]: fakeMod('Vanilla Enhanced - Base', { guid: VE_BASE_GUID, version: '3.5.0', textures: [['302_0-0', 2, 2]] }),
    [MASKED]: fakeMod('Vanilla Enhanced - Masked Roads', { deps: [['world of daggerfall - biomes', true], [VE_BASE]] }),
    [WINTER]: fakeMod('Vanilla Enhanced - Winter Tracks', { deps: [[VE_BASE]] }),
  }, { asPlayer: true });
  assert.equal(ve.by, 'carademono, version 3.5.0', 'the copy attached is the one read');
  assert.deepEqual(attachedDfmods().filter(isVeFamily).map((m) => [m.fileName, m.shipped, m.enabled]), [
    [VE_BASE, false, true], ['vanilla enhanced - masked roads', false, true],
    ['vanilla enhanced - snowless swamps and jungles', true, false], ['vanilla enhanced - winter tracks', false, true],
  ], 'in load order: the attached copies on (an attach is on), the shipped add-on no copy shadows off');
  assert.equal(currentOption(tex), ve, 'an attached Base is on');
  classic.apply();
  assert.deepEqual(attachedDfmods().map((m) => [m.title, m.enabled]), [
    ['DREAM - Sprites', false], ['Improved Interior Lighting', true], ['Vanilla Enhanced - Base', false], ['Vanilla Enhanced - Masked Roads', false],
    ['Vanilla Enhanced - Snowless Swamps and Jungles', false], ['Vanilla Enhanced - Winter Tracks', false],
  ], 'every texture mod off; the lighting mod is not a texture mod');
  assert.deepEqual(getPref(VE_ADDONS_PREF), [MASKED, WINTER], 'VE4: the add-ons it was worn with, kept for the next wear');
  assert.equal(currentOption(tex), classic);
  assert.ok(classicTexturesWorn() && !veWorn());
  setValue('Enhancements', 'AssetInjection', 'False');
  ve.apply();
  assert.equal(getBool('Enhancements', 'AssetInjection'), true, 'wearing the pack wears Replace Game Artwork with it');
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [false, true, true, true, false, true], 'the Base and the add-ons it was worn with; DREAM and Snowless Swamps left as they were');
  assert.equal(currentOption(tex), ve);
  setDfmodEnabled([VE, MASKED, WINTER], false);
  setDfmodEnabled('dfmod/dream - sprites.dfmod', true);
  assert.equal(currentOption(tex), null, 'DREAM alone is neither look: Custom');
  assert.match(tex.custom, /^Custom: a mix of texture mods/);
  setDfmodEnabled('dfmod/dream - sprites.dfmod', false);
  setTextureReplacements(['302_5-0.png'], async () => null);
  assert.equal(currentOption(tex), null, 'a loose texture pack is drawn: not Classic');
  clearTextureReplacements();
  assert.equal(currentOption(tex), classic);
});

test('VE3/VE4 the menu: the card\'s button wears the look at once - nothing to attach; its add-ons are switches while it is worn; the packs card switches a mod on and off, says the load order, and never offers to remove a shipped mod', () => {
  const menu = src('ui/enhancedMenu.js');
  assert.match(menu, /const use = el\('button', 'act primary look-use', o === cur \? 'In use' : `Use \$\{o\.name\}`\);/);
  assert.doesNotMatch(menu, /needsFiles|pickDfmodFiles\(o\.attach\)/, 'VE3\'s pick went with the attach');
  assert.match(menu, /const addons = o === cur \? o\.addons\?\.\(\) \?\? \[\] : \[\];/, 'the add-ons only while the look is worn');
  assert.match(menu, /b\.onclick = \(e\) => \{ e\.stopPropagation\(\); setVeAddon\(m\.key, on\); render\(\); \};/);
  assert.match(menu, /p\.custom \?\? 'Custom: your own mix from Features\./);
  assert.match(menu, /\{ label: m\.enabled \? 'Switch off' : 'Switch on', onClick: \(\) => \{ setDfmodEnabled\(m\.key, !m\.enabled\); render\(\); \} \},/);
  assert.match(menu, /\.\.\.\(m\.shipped \? \[\] : \[remove\('Remove', `Remove \$\{m\.title\}`/, 'a shipped mod is switched, never removed');
  assert.match(menu, /'In load order: where two mods carry the same texture, the later one is drawn\./);
  assert.match(src('scenes/dataSource.js'), /export async function pickDfmodFiles\(\) \{\n\s+return pickAssetFolder\(\{\n\s+title: 'Add texture mods',/);
});
