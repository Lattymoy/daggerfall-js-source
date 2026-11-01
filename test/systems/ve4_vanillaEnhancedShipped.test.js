// VE4 (2026-10-05, Mac: "Put it in the codebase") - VANILLA ENHANCED SHIPS WITH THE PORT. OWN-WORK4 (2026-10-31, the
// owner: "A proper 1 to 1 recreation for everything") - AND IS OUR OWN.
//
// VE4 shipped carademono's repaints under Port-Doctrine's exception; OWN-WORK4 retired them (vendor/vanilla-enhanced/
// and its art are gone). The three mods keep their place in the texture-mod door - key, title, switch, dependencies,
// the names and sizes they dress (systems/ownTextures/ownTexturePacks.json) - and each picture is built from the
// player's own classic record under our rule (systems/ownTextures/ownTextureRules.js); the Base on by default, its
// add-ons off.
//
// Driven through the real door (systems/dfmodTextures.js), the real pack module over our REAL listing, the real texture
// door, the real prefs shelf and the real Overhauls registry; only the build is a fake, and each fake picture carries
// the rule and the record it was built from, so every layer says which record and which rule drew it. The mutants are
// tools/mutants/ve4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, setShippedDfmods, clearDfmodSources, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF,
  DFMOD_INDEX_VERSION, dfmodStoreKey, dfmodGroundLayers, groundSource, dfmodGeneration, _resetDfmodForTests,
} from '../../src/systems/dfmodTextures.js';
import { VE_PACK_MODS, VE_PACK_SOURCE, vePackClient, installVanillaEnhancedPack, _setVePackIoForTests } from '../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';
import { ownSpec } from '../../src/systems/ownTextures/ownTexturePacks.js';
import { mipFitSize } from '../../src/formats/resample.js';   // AUDIT VE P1: the mip rule's one home, the decode worker's and the page's
import { bundleTextureCount, preloadTextureRecord, clearTextureReplacements, textureEntry } from '../../src/systems/textureReplacement.js';
import { wearVanillaEnhanced, wearClassicTextures, setVeAddon, veAddons, veWorn, VE_ADDONS_PREF } from '../../src/systems/vanillaEnhanced/vanillaEnhanced.js';
import { OVERHAUL_PANELS, currentOption } from '../../src/systems/overhauls.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';

const ROOT = new URL('../../', import.meta.url);
const src = (p) => readFileSync(new URL(`src/${p}`, ROOT), 'utf8');
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: new URL('.', ROOT), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);

const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
// ALIKR1 / SNOWFALL1 (2026-10-08): the two environment packs ship through the same door, on by default and built on the
// Base (test/systems/environs_texturePacks.test.js holds their own law); a pin over the whole door names them in their places
const SANDS = 'dfmod/sands of the alikr.dfmod';
const SNOWFALL = 'dfmod/snowfall.dfmod';

// ---- the fake build: each picture is the rule and the record it was built from -------------------------------------
const built = [];
const ids = new Map();
const idOf = (tag) => { if (!ids.has(tag)) ids.set(tag, ids.size + 1); return ids.get(tag); };
const tagOf = (rule, a, r) => `${rule}:${a}_${r}_0`;
function fakeIo() {
  _setVePackIoForTests({
    build: async (spec) => {
      built.push(spec);
      const id = idOf(tagOf(spec.rule, spec.from[0], spec.from[1]));
      return { width: spec.w, height: spec.h, data: Uint8Array.from({ length: spec.w * spec.h * 4 }, (_, i) => [id & 255, id >> 8, 0, 255][i % 4]) };
    },
  });
}
/** The tag id a layer (getColor32's shape) was drawn from. */
const idAt = (layer) => layer.colors[0] + layer.colors[1] * 256;
const drawnFrom = (tags) => tags.map(idOf);
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
  built.length = 0;
}

test('OWN-WORK4 the pack: three mods, our own - no picture of the authors\' and no file of Bethesda\'s in the tree, every picture built from the player\'s record under our rule; the keys, titles and switches the player had (mutants: a mod dropped)', () => {
  assert.deepEqual(tracked('vendor/vanilla-enhanced/'), [], 'the vendored directory is retired');
  assert.deepEqual(tracked('public/art/vanilla-enhanced/'), [], 'and its art');
  assert.deepEqual(VE_PACK_SOURCE, { rules: 'systems/ownTextures/ownTextureRules.js', records: 'systems/classicArt.js' });
  assert.deepEqual(VE_PACK_MODS.map((m) => [m.key, m.dir, m.rule, m.index.title, m.index.version, m.index.author]), [
    [BASE, 'base', 'enhance', 'Vanilla Enhanced - Base', null, 'DFO Online'],
    [MASKED, 'masked-roads', 'road', 'Vanilla Enhanced - Masked Roads', null, 'DFO Online'],
    [SNOWLESS, 'snowless-swamps-and-jungles', 'snowless', 'Vanilla Enhanced - Snowless Swamps and Jungles', null, 'DFO Online'],
  ]);
  assert.deepEqual(VE_PACK_MODS.map((m) => [m.index.textures.length, m.index.arrays.length]), [[1238, 11], [9, 11], [160, 2]]);
});

test('OWN-WORK4 the index: the shape an attached copy\'s index has, at the door\'s version, under the key a store gives the .dfmod; every name a classic record\'s, at the size the pack dressed it - terrain 256, walls twice the record; an array not 56 deep carries no slices', () => {
  for (const m of VE_PACK_MODS) {
    assert.equal(m.index.v, DFMOD_INDEX_VERSION, 'regenerate the listing when the door\'s index changes');
    assert.equal(m.key, dfmodStoreKey(`${m.index.title}.dfmod`), 'an attached copy of the same mod is stored under this key - and shadows the shipped one');
    for (const [name] of m.index.textures) assert.match(name, /^\d{3}_\d+-\d+$/, `${m.dir} ${name}: a classic record's name`);
  }
  const base = VE_PACK_MODS.find((m) => m.key === BASE);
  const size = (name) => base.index.textures.find((t) => t[0] === name).slice(1);
  assert.deepEqual([size('302_0-0'), size('017_0-0'), size('019_0-0'), size('501_13-0')], [[256, 256], [128, 128], [128, 64], [457, 700]]);
  const masked = VE_PACK_MODS.find((m) => m.key === MASKED);
  assert.deepEqual(masked.index.arrays.find((a) => a[0] === '403-TexArray'), ['403-TexArray', 256, 256, 57], 'the malformed array, indexed as it is');
});

test('VE4 the door: the shipped mods register beside the attached in one load order - the Base ON by default, its add-ons off (AUDIT VE), the player\'s choice either way on its own shelf entry; switched on, their names are on the doors and drawn from the port\'s files; an attached copy shadows one and its removal brings the shipped one back as it was; a clear of the attached leaves them (mutants: the Base off by default; the attached copy not shadowing; the shipped mod read from the store; the clear taking the shipped)', async () => {
  // PIN MOVED (AUDIT VE, Mac: "Ensure this is on by default"): VE4 shipped every mod OFF until worn
  fresh();
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [SANDS, true, true], [SNOWFALL, true, true], [MASKED, true, false], [SNOWLESS, true, false]], 'in load order: the Base on, its add-ons off; the environment packs, built on it, on');
  setDfmodEnabled([SANDS, SNOWFALL], false);   // ALIKR1/SNOWFALL1: the Base's own names below
  assert.equal(bundleTextureCount(), 1238, 'the Base\'s names on the doors from the start - every record it dresses');
  const gen = dfmodGeneration();
  installVanillaEnhancedPack();
  assert.equal(dfmodGeneration(), gen, 'the same list again changes nothing');
  setDfmodEnabled(BASE, false);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [SANDS]: false, [SNOWFALL]: false, [BASE]: false }, 'a shipped mod\'s switch is the player\'s choice');
  assert.equal(bundleTextureCount(), 0, 'switched off: nothing on the doors');
  setDfmodEnabled(BASE, true);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [SANDS]: false, [SNOWFALL]: false, [BASE]: true });
  assert.deepEqual(getPref(DFMOD_OFF_PREF), [], 'and the attached shelf entry is untouched');
  assert.equal(bundleTextureCount(), 1238);
  const name = VE_PACK_MODS[0].index.textures.find(([n]) => /^500_/.test(n))[0];
  const e = textureEntry(`${name}.png`);
  const c = await preloadTextureRecord(e.archive, e.record, e.frame);
  assert.ok(c, 'a record of the Base\'s, decoded');
  assert.equal(idAt(c), idOf(tagOf('enhance', e.archive, e.record)), 'built from the player\'s record under our rule (OWN-WORK4)');
  // the player's own copy of the Base: stored under the same key, it is the one read - and it is attached, so it is on
  const store = new Map();
  const attachedBase = {
    textAssets: [{ name: 'Vanilla Enhanced - Base.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Base', ModVersion: '3.5.0', GUID: '1f124f8c-dd01-48ad-a5b9-0b4a0e4702d2' }); } }],
    textures: [{ name: '302_0-0', width: 2, height: 2 }], arrays: [], rgba: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(9) }), close() {},
  };
  const load = async (k) => store.get(k) ?? (k === BASE ? new Uint8Array([1]) : null);
  const opts = { open: async () => attachedBase, saveIndex: async (k, j) => { store.set(k, new TextEncoder().encode(j)); }, background: false };
  await setDfmodSources([BASE], load, opts);
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled, m.version]), [[BASE, false, true, '3.5.0'], [SANDS, true, false, null], [SNOWFALL, true, false, null], [MASKED, true, false, null], [SNOWLESS, true, false, null]], 'the attached copy in the shipped one\'s place');
  assert.equal(bundleTextureCount(), 1, 'the attached copy\'s names, not the shipped Base\'s');
  // removed: the shipped Base again, as its own switch left it
  await setDfmodSources([], load, opts);
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]), [[BASE, true, true], [SANDS, true, false], [SNOWFALL, true, false], [MASKED, true, false], [SNOWLESS, true, false]]);
  assert.equal(bundleTextureCount(), 1238);
  // an add-on the port does not ship, attached by the player and built on the shipped Base, loads after it - one order
  const WINTER = 'dfmod/vanilla enhanced - winter tracks.dfmod';
  const winter = { ...attachedBase, textAssets: [{ name: 'Vanilla Enhanced - Winter Tracks.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Winter Tracks', Dependencies: [{ Name: 'vanilla enhanced - base' }] }); } }] };
  const wload = async (k) => store.get(k) ?? (k === WINTER ? new Uint8Array([1]) : null);
  const wopts = { ...opts, open: async () => winter };
  await setDfmodSources([WINTER], wload, wopts);   // indexed at the attach
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped]), [[BASE, true], [SANDS, true], [SNOWFALL, true], [MASKED, true], [SNOWLESS, true], [WINTER, false]], 'AutoSortMods over the attached and the shipped together');
  await setDfmodSources([], wload, wopts);
  await setDfmodSources([WINTER], wload, wopts);   // a boot, from the stored index
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, SANDS, SNOWFALL, MASKED, SNOWLESS, WINTER], 'and at every boot after');
  clearDfmodSources();
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, SANDS, SNOWFALL, MASKED, SNOWLESS], 'a clear of the attached leaves what ships');
  setShippedDfmods([]);
  assert.deepEqual(attachedDfmods(), [], 'another list replaces it');
  // the pack put in AFTER an attached add-on registered (AUDIT VE R2: a menu may read the store first) - one order still
  await setDfmodSources([WINTER], wload, wopts);
  installVanillaEnhancedPack();
  assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, SANDS, SNOWFALL, MASKED, SNOWLESS, WINTER], 'the pack put in after the attached: AutoSortMods over both');
});

test('VE4 the ground, over our listing: the Base\'s arrays dress the terrain, each slice its own record under our enhanced rule; Masked Roads, loaded after it, decides its arrays - the same tiles but the road tiles under our road rule; its 403 array, 57 deep, is refused and 403 is made of records - the Base\'s and its own three road records; Snowless Swamps, loaded last, decides 402, and its 403 is the summer\'s 402 under the enhanced rule - no snow (DFU: TryImportTextureArray, the first mod in TryGetAsset\'s walk)', async () => {
  fresh();
  installVanillaEnhancedPack();
  setDfmodEnabled([SANDS, SNOWFALL], false);   // ALIKR1/SNOWFALL1: Vanilla Enhanced's law alone - the packs' over it is test/systems/environs_texturePacks.test.js
  setDfmodEnabled(BASE, false);   // PIN MOVED (AUDIT VE): the Base is on by default - switched off, the classic set
  assert.equal(await dfmodGroundLayers(302, classicTex(56)), null, 'off: the classic set');
  setDfmodEnabled(BASE, true);
  assert.deepEqual(groundSource(302), { kind: 'array', key: BASE, name: '302-TexArray', depth: 56 });
  let L = await dfmodGroundLayers(302, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf('enhance', 302, r))), 'slice r is record r, enhanced');
  assert.deepEqual([L[0].width, L[0].height], [256, 256], 'at the size the pack dressed it');
  setDfmodEnabled(MASKED, true);
  assert.deepEqual(groundSource(302), { kind: 'array', key: MASKED, name: '302-TexArray', depth: 56 }, 'the add-on is met first');
  L = await dfmodGroundLayers(302, classicTex(56));
  const road = (r) => [46, 47, 55].includes(r);
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf(road(r) ? 'road' : 'enhance', 302, r))), 'the tiles enhanced, the road tiles our road');
  L = await dfmodGroundLayers(303, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf(road(r) ? 'road' : 'enhance', 303, r))));
  const warn = console.warn; let said = '';
  console.warn = (s) => { said += s; };
  try {
    assert.deepEqual(groundSource(403), { kind: 'array', key: MASKED, name: '403-TexArray', depth: 57 });
    L = await dfmodGroundLayers(403, classicTex(56));
  } finally { console.warn = warn; }
  assert.match(said, /403-TexArray: expected depth 56 but got 57/, 'refused, as DFU logs it');
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf(road(r) ? 'road' : 'enhance', 403, r))), 'the records: its own three, the Base\'s for the rest');
  setDfmodEnabled(SNOWLESS, true);
  assert.deepEqual(groundSource(402), { kind: 'array', key: SNOWLESS, name: '402-TexArray', depth: 56 }, 'loaded last, met first');
  L = await dfmodGroundLayers(402, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf('enhance', 402, r))));
  L = await dfmodGroundLayers(403, classicTex(56));
  assert.deepEqual(L.map(idAt), drawnFrom(Array.from({ length: 56 }, (_, r) => tagOf('enhance', 402, r))), 'the swamp\'s winter is its summer: no snow');
  assert.equal(groundSource(302).key, MASKED, 'Snowless Swamps carries no 302: Masked Roads still decides it');
});

test('VE4 the client: a texture asked at the texture detail is built at the mip a bundle would decode - halved until it fits, as mipLevelFor picks; an array is its slices, a few at a time; a picture built is kept, and two asks share one build; a name the mod does not carry is refused (mutants: the detail not honoured; every slice built at once; the build kept nowhere)', async () => {
  assert.deepEqual(mipFitSize(256, 256, 256), [256, 256]);
  assert.deepEqual(mipFitSize(512, 256, 256), [256, 128]);
  assert.deepEqual(mipFitSize(1024, 1024, 300), [256, 256], 'a mip, not a fit: 512 is over, 256 is the level');
  assert.deepEqual(mipFitSize(13, 107, 64), [6, 53]);
  assert.deepEqual(mipFitSize(64, 64, Infinity), [64, 64], 'full detail');
  fresh();
  const base = VE_PACK_MODS.find((m) => m.key === BASE);
  const client = vePackClient(base);
  const img = await client.rgba('501_13-0', { maxSize: 256 });
  assert.deepEqual([img.width, img.height], mipFitSize(457, 700, 256), 'the tree built at the texture detail');
  assert.deepEqual([(await client.rgba('501_13-0')).width], [457], 'no detail asked: the picture whole');
  built.length = 0;
  const [a, b] = await Promise.all([client.rgba('302_9-0'), client.rgba('302_9-0')]);
  assert.equal(a, b, 'two asks, one build');
  await client.rgba('302_9-0');
  assert.equal(built.length, 1, 'kept for the next ask');
  await assert.rejects(client.rgba('999_0-0'), /carries no 999_0-0/);
  // a few at a time
  let live = 0, most = 0;
  _setVePackIoForTests({
    build: async (spec) => { live++; most = Math.max(most, live); await new Promise((r) => setTimeout(r, 1)); live--; return { width: spec.w, height: spec.h, data: new Uint8Array(4) }; },
  });
  const layers = await client.layers('302-TexArray');
  assert.equal(layers.length, 56);
  assert.equal(most, 8, 'PRELOAD_CONCURRENCY at once, never all 56');
  await assert.rejects(vePackClient(VE_PACK_MODS.find((m) => m.key === MASKED)).layers('403-TexArray'), /carries no slices/);
  assert.deepEqual(ownSpec(base, '302_9-0'), { rule: 'enhance', from: [302, 9, 0], w: 256, h: 256, wrap: false, seed: ownSpec(base, '302_9-0').seed, ground: true });
  fakeIo();
});

test('VE4 the card over the shipped pack: Vanilla Enhanced is a fresh game\'s look (AUDIT VE) - the Base alone, the add-ons off until picked on the card; an add-on picked is kept across a turn to Classic and worn again with the Base (mutants: the add-ons worn by default; the pick not kept; Classic forgetting the add-ons)', () => {
  // PIN MOVED (AUDIT VE, Mac: "Ensure this is on by default"): VE4's fresh game was Classic
  fresh();
  const tex = OVERHAUL_PANELS.find((p) => p.id === 'texture');
  const [classic, ve] = tex.options;
  assert.equal(currentOption(tex), ve, 'a fresh game wears Vanilla Enhanced');
  // ALIKR1/SNOWFALL1: the environment packs are built on the Base, so the card offers them beside its own add-ons - on by
  // default (Mac: "These should be on by default"), kept across Classic as the add-ons are
  assert.deepEqual(ve.addons().map((m) => m.title), ['Sands of the Alik\'r', 'Snowfall', 'Vanilla Enhanced - Masked Roads', 'Vanilla Enhanced - Snowless Swamps and Jungles']);
  wearVanillaEnhanced();
  assert.ok(veWorn());
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, true, true, false, false], 'the Base, and the environment packs on by default');
  setVeAddon(MASKED, true);
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, true, true, true, false]);
  assert.deepEqual(getPref(VE_ADDONS_PREF), [MASKED]);
  wearClassicTextures();
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [false, false, false, false, false]);
  assert.equal(currentOption(tex), classic);
  assert.deepEqual(getPref(VE_ADDONS_PREF), [SANDS, SNOWFALL, MASKED], 'kept across Classic');
  ve.apply();
  assert.deepEqual(attachedDfmods().map((m) => m.enabled), [true, true, true, true, false], 'worn again as it was');
  setVeAddon(MASKED, false);
  assert.deepEqual(veAddons().map((m) => m.enabled), [true, true, false, false]);
  assert.deepEqual(getPref(VE_ADDONS_PREF), [SANDS, SNOWFALL]);
  assert.equal(currentOption(tex), ve, 'the Base is the look');
  setDfmodEnabled(BASE, false);
  setDfmodEnabled(SNOWLESS, true);
  assert.equal(currentOption(tex), null, 'an add-on without its Base is neither look: Custom');
});

test('VE4 wiring: the store\'s one registration puts the pack in before the attached register, and the boot seam calls it; the packs card lists it before any host boots; the paper doll\'s HD compose waits for a mod carrying doll art (AUDIT VE R13)', () => {
  // PIN MOVED (AUDIT VE R2): the boot seam's registration is the store's one, which puts the pack in first
  assert.match(src('scenes/shared.js'), /const textures = registerTextureStore\(\)/);
  assert.match(src('scenes/dataSource.js'), /installVanillaEnhancedPack\(\);   \/\/ VE4[^\n]*\n\s+const names = await storedTextureNames\(\);/);
  assert.match(src('ui/enhanced/enhancedMenu.js'), /function packsCard\(\) \{\n[^\n]*\n\s+installVanillaEnhancedPack\(\);/);   // PIN MOVED (AUDIT VE R2): after the wait for the store
  // PIN MOVED (AUDIT VE R13): a mod switched on that carries doll art, not any attached mod
  assert.match(src('ui/paperDoll.js'), /const composeScale = \(\) => \(dfmodCarriesDollArt\(\) \? PAPERDOLL_HD_SCALE : 1\);/);
  assert.match(src('systems/vanillaEnhanced/vanillaEnhanced.js'), /const doorMods = \(\) => \{\n\s*installVanillaEnhancedPack\(\);\n\s*return attachedDfmods\(\);\n\s*\};/);
});
