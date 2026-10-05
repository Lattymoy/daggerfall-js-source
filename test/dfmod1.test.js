// DFMOD1 - any Daggerfall Unity texture mod the player attaches (.dfmod), and
// the BC7 decoder DREAM's paperdoll needed. The decoder was fuzzed bit-exact
// against the texture2ddecoder reference (~50k random blocks, all 8 modes,
// every partition) while it was written; these pin the shapes that matter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bc7Decode, decodeBc7Block } from '../src/formats/bc7.js';
import { TEXTURE_FORMAT } from '../src/formats/unityBundle.js';
import {
  setDfmodSources, clearDfmodSources, attachedDfmods, hasOwnDoor, dfmodStoreKey, dfmodIndexKey,
  xmlRect, xmlScale, hasDfmodImg, hasDfmodCifRci, dfmodImgImage, dfmodCifRciImage, resampleRgba, dfmodGeneration,
} from '../src/systems/dfmodTextures.js';
import { hasTextureReplacement, preloadTextureRecord, decodedTexture, textureReplacementRect, bundleTextureCount } from '../src/systems/textureReplacement.js';
import { billboardXmlScale } from '../src/world/billboardXml.js';
import { textureStoreKey } from '../src/scenes/dataSource.js';
import { textureEntry } from '../src/systems/textureReplacement.js';
import { seasonsAssetKey } from '../src/systems/seasonsIliacBayAssets.js';
import { setValue } from '../src/systems/settings.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

/** A little-endian bit writer for hand-built BC7 blocks. */
function block(fields) {
  const out = new Uint8Array(16);
  let pos = 0;
  for (const [v, n] of fields) for (let i = 0; i < n; i++, pos++) if ((v >>> i) & 1) out[pos >>> 3] |= 1 << (pos & 7);
  return out;
}

test('DFMOD1 bc7: mode 6 with every index 0 is endpoint 0, p-bit and all; the reader knows format 25', () => {
  // mode 6: 7 mode bits (0000001), R0 R1 G0 G1 B0 B1 A0 A1 at 7 bits, P0 P1, then 63 index bits
  const b = block([[0x40, 7], [127, 7], [0, 7], [0, 7], [127, 7], [64, 7], [0, 7], [127, 7], [0, 7], [1, 1], [0, 1]]);
  const px = new Uint8Array(64);
  decodeBc7Block(b, 0, px);
  for (let i = 0; i < 16; i++) assert.deepEqual([...px.subarray(i * 4, i * 4 + 4)], [255, 1, 129, 255]);
  assert.equal(TEXTURE_FORMAT.BC7, 25);
  assert.match(src('formats/unityBundle.js'), /case TEXTURE_FORMAT\.BC7:\s*\n\s*rgba = bc7Decode\(src, width, height\);/);
});

test('DFMOD1 bc7: a reserved mode (no bit set) is transparent black; a short buffer throws; odd sizes crop', () => {
  const px = new Uint8Array(64).fill(9);
  decodeBc7Block(new Uint8Array(16), 0, px);
  assert.ok(px.every((v) => v === 0));
  assert.throws(() => bc7Decode(new Uint8Array(15), 4, 4), /bc7/);
  assert.equal(bc7Decode(new Uint8Array(32), 5, 3).length, 5 * 3 * 4);
});

test('DFMOD1 xml: SetBillboardScale and GetRect, as DREAM writes them', () => {
  assert.deepEqual(xmlScale('<?xml version="1.0"?>\r\n<info>\r\n\t<scaleX>1.3</scaleX>\r\n\t<scaleY>1.3</scaleY>\r\n</info>'), [1.3, 1.3]);
  assert.equal(xmlScale('<info></info>'), null);
  assert.deepEqual(xmlRect('<info><rect scale="8"><x>284</x><y>280</y><width>385</width><height>620</height></rect></info>'), { x: 35.5, y: 35, width: 48.125, height: 77.5 });
});

test('DFMOD1 keys: any .dfmod is stored by the texture pick; the mods with their own door are left to it', () => {
  assert.equal(dfmodStoreKey('C:\\mods\\DREAM 90s - MOBs.dfmod'), 'dfmod/dream 90s - mobs.dfmod');
  assert.equal(dfmodStoreKey('readme.txt'), null);
  assert.equal(dfmodIndexKey('dfmod/a.dfmod'), 'dfmod-index/a.dfmod');
  const deps = { textureEntry, seasonsAssetKey };
  assert.equal(textureStoreKey({ name: 'DREAM 90s - NPCs.dfmod' }, deps), 'dfmod/dream 90s - npcs.dfmod');
  assert.ok(hasOwnDoor('dfmod/seasons of the iliac bay.dfmod') && hasOwnDoor('dfmod/diverse weapons.dfmod') && hasOwnDoor('dfmod/weaponwidget.dfmod'));
  assert.ok(!hasOwnDoor('dfmod/dream 90s - sprites.dfmod'));
});

test('DFMOD1 resample: a box filter to the classic size, alpha-weighted, pass-through at the same size', () => {
  const img = { width: 2, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 0, 255, 0, 0, 255, 0, 0, 255, 0]) };
  const one = resampleRgba(img, 1, 1);
  assert.deepEqual([...one.data], [255, 0, 0, 255], 'the clear texels add no colour; half coverage or more is solid - a pixel-art edge stays crisp');
  const quarter = resampleRgba({ width: 2, height: 2, data: new Uint8Array([0, 255, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }, 1, 1);
  assert.deepEqual([...quarter.data], [0, 255, 0, 64], 'a thin edge keeps its partial alpha');
  assert.equal(resampleRgba(img, 2, 2).data, img.data);
});

/** A fake bundle client in unityBundleClient's shape. */
function fakeBundle(title, textures, xml = {}) {
  const manifest = JSON.stringify({ ModTitle: title, ModVersion: '1.1', ModAuthor: 'K', GUID: title });
  const enc = (t) => new TextEncoder().encode(t);
  const textAssets = [{ name: `${title}.dfmod`, bytes: enc(manifest), get text() { return manifest; } },
    ...Object.entries(xml).map(([name, t]) => ({ name, bytes: enc(t), get text() { return t; } }))];
  return {
    textAssets,
    textures: textures.map(([name, w, h]) => ({ name, width: w, height: h, format: 4 })),
    rgba: async (name) => { const t = textures.find((x) => x[0] === name); return t ? { width: t[1], height: t[2], data: new Uint8Array(t[1] * t[2] * 4).fill(200) } : null; },
    close() { this.closed = true; },
  };
}

test('DFMOD1 door: names onto the bundle tier by dye and map, xml onto the billboard registry, IMG/CIF on their own', async () => {
  setValue('Enhancements', 'AssetInjection', 'True');
  const bundles = {
    'dfmod/a.dfmod': fakeBundle('A', [['210_1-0', 4, 2], ['210_1-0_Emission', 4, 2], ['235_56-0_Aquamarine', 8, 8], ['235_56-0_Iron_Mask', 8, 8], ['SCBG04I0.IMG', 3, 3], ['FACES.CIF_14-0', 2, 2], ['v23 despecle 094_0-0', 1, 1]],
      { '210_1-0': '<info><scaleX>1.5</scaleX><scaleY>2</scaleY></info>', '235_56-0_Aquamarine': '<info><rect scale="8"><x>8</x><y>16</y><width>32</width><height>64</height></rect></info>' }),
    'dfmod/b.dfmod': fakeBundle('B', [['210_1-0', 9, 9]]),
  };
  const opens = [];
  const open = async (bytes) => { const k = new TextDecoder().decode(bytes); opens.push(k); return bundles[k]; };
  const stored = new Map();
  const load = async (k) => stored.get(k) ?? (bundles[k] ? new TextEncoder().encode(k) : null);
  const saveIndex = async (k, j) => { stored.set(k, new TextEncoder().encode(j)); };
  const gen = dfmodGeneration();
  const names = ['dfmod/b.dfmod', 'dfmod/a.dfmod', 'dfmod/seasons.dfmod', '003_5-0.png'];
  const n = await setDfmodSources(names, load, { open, saveIndex, background: false });   // DFMOD2: a boot indexes in the background; here, awaited
  assert.ok(n > 0 && dfmodGeneration() > gen);
  assert.deepEqual(attachedDfmods().map((m) => m.title), ['A', 'B'], 'sorted by stored name; the own-door mod is not read');
  assert.ok(stored.has('dfmod-index/a.dfmod') && stored.has('dfmod-index/b.dfmod'), 'the index is written for a bundle stored without one');
  assert.equal(bundleTextureCount(), 3, 'albedo and mask only - emission and unnamed textures are not registered');
  assert.ok(hasTextureReplacement(210, 1, 0) && hasTextureReplacement(235, 56, 0, 'Albedo', 'Aquamarine') && hasTextureReplacement(235, 56, 0, 'Mask', 'Iron'));
  assert.deepEqual(billboardXmlScale(210, 1), { x: 1.5, y: 2 });
  assert.deepEqual(textureReplacementRect(235, 56, 0, 'Albedo', 'Aquamarine'), { x: 1, y: 2, width: 4, height: 8 });
  assert.ok(hasDfmodImg('scbg04i0.img') && hasDfmodCifRci('FACES.CIF', 14, 0) && !hasDfmodCifRci('FACES.CIF', 15, 0));

  // nothing is opened by a registration from stored indexes; the first picture opens its bundle, once
  opens.length = 0;
  clearDfmodSources();
  await setDfmodSources(names, load, { open, saveIndex });
  assert.equal(opens.length, 0, 'a boot registers from the index alone');
  const c = await preloadTextureRecord(210, 1, 0);
  // VE1: the mod loaded LAST answers (TryGetAsset walks EnumerateEnabledModsReverse) - with no dependency between the
  // two, DFU's load order is the folder's listing, so the later by file name; this pinned the first until VE1
  assert.equal(c.width, 9, 'the mod loaded last that carries a name answers it');
  assert.equal(decodedTexture(210, 1, 0).colors.length, 9 * 9 * 4);
  assert.equal((await dfmodImgImage('SCBG04I0.IMG')).width, 3);
  assert.equal((await dfmodCifRciImage('FACES.CIF', 14, 0)).height, 2);
  assert.deepEqual(opens, ['dfmod/b.dfmod', 'dfmod/a.dfmod'], 'one open a bundle, however many of its pictures are drawn');

  // idempotent for the same set; a removal re-registers
  const before = dfmodGeneration();
  await setDfmodSources(names, load, { open, saveIndex });
  assert.equal(dfmodGeneration(), before);
  await setDfmodSources(['dfmod/b.dfmod'], load, { open, saveIndex });
  assert.equal(bundleTextureCount(), 1);
  assert.equal(billboardXmlScale(210, 1), null, 'the removed mod takes its xml with it');
  clearDfmodSources();
  assert.equal(bundleTextureCount(), 0);
});

test('DFMOD1 wiring: the boot, the pick, the doll, the portraits and the packs card', () => {
  // PIN MOVED (AUDIT VE R2): the boot seam calls the store's one registration, which registers the bundles (warmed at a boot)
  assert.match(src('scenes/shared.js'), /const textures = registerTextureStore\(\)/);
  const ds = src('scenes/dataSource.js');
  assert.match(ds, /setDfmodSources\(names, loadTextureFile, \{ saveIndex: saveTextureJson, loadBlob: loadTextureBlob, warm \}\)/);
  assert.match(ds, /export async function pickDfmodFiles\(\)/);
  assert.match(ds, /export async function removeStoredDfmod\(key\)/);
  assert.match(ds, /export async function clearStoredMusic\(\)/);
  assert.match(ds, /export async function clearStoredTexturePack\(\)/);
  const menu = src('ui/enhancedMenu.js');
  for (const label of ['Add texture mods', 'Remove music pack', 'Remove sound pack', 'Remove texture pack', 'Remove all texture mods']) assert.ok(menu.includes(`'${label}'`), label);
  assert.match(menu, /d\.removeStoredDfmod\(m\.key\)/);
  const doll = src('ui/paperDoll.js');
  assert.match(doll, /alt: await dfmodAlt\(dfmodImgImage\(name\), bmp\)/);
  assert.match(doll, /alt: await dfmodAlt\(dfmodCifRciImage\(art\.heads, fi, 0\), headBmp\)/);
  assert.match(src('ui/nativeTalk.js'), /hasDfmodCifRci\(file, recordId, 0\)/);
});

test('DFMOD1-E: the Enhanced Plus avatar follows the attached mods - the composite knows its mod generation, the art reloads, the pack asks', () => {
  const doll = src('ui/paperDoll.js');
  // DFMOD3-F: once per generation, never during a compose - the Enhanced Plus pack asks on every render, and an ask
  // that stayed true while the compose ran spun render -> ask -> render until the page froze
  assert.match(doll, /if \(!_art \|\| !_deps \|\| _refreshing \|\| _composedGen === gen \|\| _staleTried === gen\) return false;\n\s+_staleTried = gen;\n\s+return true;/);
  assert.match(doll, /else if \(_ident && !_identity\?\.endsWith\(`#\$\{dfmodGeneration\(\)\}`\)\) await preloadPaperDollArt\(_deps, _ident\);/, 'a boot-time art set is reloaded once the mods land');
  assert.match(doll, /_composedGen = gen;/);
  assert.match(doll, /if \(!_live \|\| paperDollStale\(\)\) refreshPaperDoll\(entity\);/, 'the classic doll recomposes on its draw');
  assert.match(src('ui/enhancedInventory.js'), /if \(paperDollStale\(\)\) refreshFigure\(\);\n\s*const figure = modelFigure\(\);/, 'the enhanced pack asks for a fresh avatar');
  assert.match(src('ui/textureCanvas.js'), /if \(_iconsGen !== dfmodGeneration\(\)\) \{ icons\.clear\(\); _iconsGen = dfmodGeneration\(\); \}/, 'and its icons are drawn again');
});

// ---- DFMOD2: big mods (DREAM's full-resolution set) never stand the game on a blank screen ----

test('DFMOD2 mips: the first level within the detail, and where it sits in the chain', async () => {
  const { mipLevelFor, mipSpan, TEXTURE_FORMAT: F } = await import('../src/formats/unityBundle.js');
  const tex = { m_Width: 2048, m_Height: 1024, m_MipCount: 12, m_TextureFormat: F.BC7 };
  assert.equal(mipLevelFor(tex, 512), 2);
  assert.equal(mipLevelFor(tex, Infinity), 0);
  assert.equal(mipLevelFor({ ...tex, m_MipCount: 1 }, 512), 0, 'no smaller mip carried: mip 0 (the worker box-filters it)');
  assert.deepEqual(mipSpan(tex, 2), { offset: 2048 * 1024 + 1024 * 512, size: 512 * 256 });
  assert.deepEqual(mipSpan({ m_Width: 5, m_Height: 5, m_TextureFormat: F.RGBA32 }, 1), { offset: 100, size: 16 });
});

test('DFMOD2 sources: a Uint8Array or a ranged source reads the same; a Blob is refused on this thread; the worker reads a Blob by range', async () => {
  const { byteSource } = await import('../src/formats/unityBundle.js');
  const { blobSource } = await import('../src/formats/unityBundleWorker.js');
  const u = Uint8Array.from({ length: 64 }, (_, i) => i);
  assert.deepEqual([...byteSource(u).slice(10, 14)], [10, 11, 12, 13]);
  assert.throws(() => byteSource(new Blob([u])), /read by range in the worker/);
  const reads = [];
  class FakeReader { readAsArrayBuffer(part) { reads.push(part.range); return u.slice(...part.range).buffer; } }
  const blob = { size: 64, slice: (a, b) => ({ range: [a, b] }) };
  const src = blobSource(blob, FakeReader);
  assert.deepEqual([...src.slice(60, 99)], [60, 61, 62, 63]);
  assert.deepEqual(reads, [[60, 64]], 'only the range asked, clamped to the file');
});

test('DFMOD2 wiring: the boot never indexes on its way in, opens by range and warms, asks wait a bounded time, detail is the player\'s', () => {
  const door = src('systems/dfmodTextures.js');
  // PIN MOVED (AUDIT VE R6): what is indexed in the background is the missing AND the version before's rebuild
  assert.match(door, /if \(todo\.length\) \{ if \(background\) indexMissing\(\); else await indexMissing\(\); \}/);
  assert.match(door, /if \(blob\?\.size\) return _opener\(blob, \{ maxTextureSize: maxSize\(\), knownTextures: knownOf\(key\) \}\);/);
  assert.match(door, /const b = await Promise\.race\(\[bundleFor\(key\), waited\]\);/);
  assert.match(src('scenes/dataSource.js'), /const index = await indexDfmodBytes\(f\);/, 'an attach reads the picked File by range, not whole');
  // PIN MOVED (AUDIT VE R11): the escape hatch is the door's own rule, wherever a registration comes from
  assert.match(door, /const names = noMods \? \[\] : stored;/, 'the ?nomods escape hatch');
  assert.match(src('ui/enhancedMenu.js'), /label: `Texture detail: \$\{detailLabel\}`/);
});

test('DFMOD2 detail: unset is the default, 0 is full, a number is its own', async () => {
  const { setDfmodDetailSource, dfmodMaxSize, DFMOD_DETAIL_DEFAULT } = await import('../src/systems/dfmodTextures.js');
  setDfmodDetailSource(() => undefined); assert.equal(dfmodMaxSize(), DFMOD_DETAIL_DEFAULT);
  setDfmodDetailSource(() => 0); assert.equal(dfmodMaxSize(), Infinity);
  setDfmodDetailSource(() => 1024); assert.equal(dfmodMaxSize(), 1024);
  setDfmodDetailSource(null); assert.equal(dfmodMaxSize(), DFMOD_DETAIL_DEFAULT);
});

test('DFMOD2 memory: Seasons\' door opens only its own bundle, not every attached mod; the default detail is 256; a mod that will not open says why', async () => {
  const { setSeasonsSources, clearSeasonsSources } = await import('../src/systems/seasonsIliacBayAssets.js');
  const n = setSeasonsSources(['dfmod/dream - mobs.dfmod', 'dfmod/dream 90s - textures.dfmod', 'dfmod/seasons of the iliac bay.dfmod', 'dfmod-index/dream - mobs.dfmod'], async () => null);
  assert.equal(n, 1, 'DREAM\'s bundles are not Seasons\' to read');
  clearSeasonsSources();
  const { DFMOD_DETAIL_DEFAULT } = await import('../src/systems/dfmodTextures.js');
  assert.equal(DFMOD_DETAIL_DEFAULT, 256);
  assert.match(src('systems/dfmodTextures.js'), /error: _openErrors\.get\(key\) \?\? null,/);
  assert.match(src('ui/enhancedMenu.js'), /if \(m\.error\) row\.append\(el\('p', 'meta', `Not working: \$\{m\.error\}\.`\)\);/);
  assert.match(src('combat/diverseWeaponsAssets.js'), /return \(await dfmodWeaponImage\(name\)\) \?\? \(await weaponModImage\(name\)\);/, 'DWHD1: an attached replacer first');
});

// ---- DFMOD3: a shared pool, a bounded queue, a memory budget ----

/** A fake worker that answers opens at once and decodes one picture per tick, counting what it was sent. */
function fakeLane(log) {
  return {
    postMessage(m) {
      log.push(m);
      setTimeout(() => {
        if (m.t === 'open') this.onmessage({ data: { t: 'opened', id: m.id, textAssets: [], textures: [] } });
        else if (m.t === 'rgba') this.onmessage({ data: { t: 'rgba', id: m.id, image: { width: 1, height: 1, data: new Uint8Array(4), name: m.name } } });
      }, 1);
    },
    terminate() {},
  };
}

test('DFMOD3 pool: two workers hold every bundle; one decode in flight each; an ask past its deadline is never sent; a dead worker answers null', async () => {
  const { createBundlePool } = await import('../src/formats/unityBundlePool.js');
  const logs = [];
  const pool = createBundlePool({ size: 2, workerFactory: () => { const l = []; logs.push(l); return fakeLane(l); } });
  const b = await pool.open(new Uint8Array(8), { maxTextureSize: 256, knownTextures: [['a', 1, 1]] });
  assert.equal(logs.length, 2);
  assert.ok(logs.every((l) => l[0].t === 'open' && l[0].quiet === true && l[0].maxTextureSize === 256), 'opened quietly in each worker');
  const asks = Array.from({ length: 6 }, (_, i) => b.rgba(`t${i}`, { maxSize: 256, deadline: Date.now() + 60000 }));
  assert.equal(pool.busy(), 6);
  const sentNow = logs.map((l) => l.filter((m) => m.t === 'rgba').length);
  assert.deepEqual(sentNow, [1, 1], 'one in flight per worker; the rest wait as names');
  const imgs = await Promise.all(asks);
  assert.deepEqual(imgs.map((i) => i.name).sort(), ['t0', 't1', 't2', 't3', 't4', 't5']);
  const before = logs.flat().length;
  assert.equal(await b.rgba('late', { deadline: 1 }), null);
  assert.equal(logs.flat().length, before, 'an expired ask costs no message');
  pool.close();
  assert.equal(await b.rgba('after', {}), null, 'a closed pool answers null');
});

test('DFMOD3 budget: past the bundle tier\'s memory budget a mod picture is not decoded and the classic draws', async () => {
  const tr = await import('../src/systems/textureReplacement.js');
  setValue('Enhancements', 'AssetInjection', 'True');
  // The budget scales with navigator.deviceMemory (192 MB a GB, up to 1536 MB - DFMOD3b's raise, which is what lets
  // DREAM 90s load whole). The test stands on a 1 GB device so the budget is 192 MB and a few big pictures spend it,
  // rather than allocating past a real machine's 1.5 GB to prove the stop.
  const nav = globalThis.navigator;
  const had = Object.getOwnPropertyDescriptor(nav, 'deviceMemory');
  Object.defineProperty(nav, 'deviceMemory', { value: 1, configurable: true });
  assert.equal(tr.bundleBudgetBytes(), 192 * 1024 * 1024);
  const big = { width: 4096, height: 4096, data: new Uint8Array(4096 * 4096 * 4) };
  const many = Array.from({ length: 20 }, (_, i) => ({ archive: 900, record: i, fileName: `m:${i}`, image: async () => big }));
  tr.setBundleTextures(many);
  let decoded = 0;
  for (let i = 0; i < 20; i++) if (await tr.preloadTextureRecord(900, i, 0)) decoded++;
  assert.ok(decoded < 20 && decoded >= 1, `the budget stops the decodes (${decoded} of 20)`);
  assert.ok(tr.bundleDecodedBytes() >= tr.bundleBudgetBytes() && tr.bundleDecodedBytes() < tr.bundleBudgetBytes() + 4096 * 4096 * 4 + 1);
  tr.setBundleTextures([]);
  assert.equal(tr.bundleDecodedBytes(), 0, 'a new set starts a new budget');
  if (had) Object.defineProperty(nav, 'deviceMemory', had); else delete nav.deviceMemory;
  assert.equal(tr.bundleBudgetBytes(), 1536 * 1024 * 1024, 'an 8 GB report (or none) keeps the full 1536 MB');
});

// ---- DWHD1: Diverse Weapons HD (crunched handhelds), GROUND1: DREAM's terrain tile sets ----

test('DWHD1 crunch: a non-CRN stream is refused; formats 28/29 are known to the reader; the HD replacers are texture mods, the original keeps its door', async () => {
  const { unpackUnityCrunch } = await import('../src/formats/crunch.js');
  const { TEXTURE_FORMAT: F } = await import('../src/formats/unityBundle.js');
  assert.throws(() => unpackUnityCrunch(new Uint8Array(80)), /not a CRN stream/);
  assert.equal(F.DXT1Crunched, 28); assert.equal(F.DXT5Crunched, 29);
  assert.ok(!hasOwnDoor('dfmod/diverse weapons hd - handhelds i.dfmod') && !hasOwnDoor('dfmod/diverse weapons hd - inventory.dfmod'));
  assert.ok(hasOwnDoor('dfmod/diverse weapons.dfmod'), 'RealAKP\'s own bundle stays with its door');
  assert.match(src('combat/diverseWeaponsAssets.js'), /&& !\/\\bhd\\b\/i\.test\(name\.slice\(name\.lastIndexOf\('\/'\) \+ 1\)\);/, 'and that door no longer opens the HD ones to read their GUID');
});

// The crunch decoder was checked block for block against texture2ddecoder's unpack_unity_crunch on 122 of Diverse
// Weapons HD's own textures. With the mod on disk (DWHD_DIR), this re-runs a decode of it.
test('DWHD1 crunch: Diverse Weapons HD\'s handhelds decode (when the mod is on disk)', { skip: !process.env.DWHD_DIR }, async () => {
  const { readUnityBundle } = await import('../src/formats/unityBundle.js');
  const bytes = new Uint8Array(readFileSync(`${process.env.DWHD_DIR}/diverse weapons hd - handhelds i.dfmod`));
  const t = readUnityBundle(bytes).textures.find((x) => x.name === 'DAGGER.CIF_0-0_Steel');
  const img = t.rgba();
  assert.deepEqual([img.width, img.height], [256, 512]);
  assert.ok(img.data.some((v, i) => i % 4 === 3 && v === 255), 'an opaque blade');
});

test('GROUND1 array: each slice is its own mip chain - the front of every slice is its picture; an unknown format is refused', async () => {
  const { decodeTextureArray } = await import('../src/formats/unityBundle.js');
  // 2x1 RGBA32 (GraphicsFormat 8), 2 slices, each slice 2x1 + its 1x1 mip = 12 bytes
  const slice = (r) => [r, 0, 0, 255, r + 1, 0, 0, 255, 99, 99, 99, 99];
  const data = new Uint8Array([...slice(10), ...slice(20)]);
  const layers = decodeTextureArray({ m_Name: 'x', m_Format: 8, m_Width: 2, m_Height: 1, m_Depth: 2, m_DataSize: 24, 'image data': data });
  assert.equal(layers.length, 2);
  assert.deepEqual([...layers[1].data], [20, 0, 0, 255, 21, 0, 0, 255], 'slice 1 starts after slice 0\'s whole chain');
  assert.throws(() => decodeTextureArray({ m_Name: 'y', m_Format: 999, m_Width: 1, m_Height: 1, m_Depth: 1, m_DataSize: 4, 'image data': new Uint8Array(4) }), /GraphicsFormat 999/);
});

test('GROUND1 door: `<archive>-TexArray` is that ground archive\'s tile set - whole or nothing, behind the gate; the hosts ask it first', async () => {
  const { dfmodGroundLayers, hasDfmodGround } = await import('../src/systems/dfmodTextures.js');
  setValue('Enhancements', 'AssetInjection', 'True');
  const layerOf = (v) => ({ width: 1, height: 2, data: new Uint8Array([v, 0, 0, 255, v + 1, 0, 0, 255]) });
  const manifest = JSON.stringify({ ModTitle: 'G', GUID: 'g' });
  const bundle = {
    textAssets: [{ name: 'G.dfmod', bytes: new Uint8Array(0), get text() { return manifest; } }],
    textures: [], arrays: [{ name: '302-TexArray', width: 1, height: 2, depth: 3 }],
    rgba: async () => null, layers: async (n) => (n === '302-TexArray' ? [layerOf(1), layerOf(5), layerOf(9)] : null), close() {},
  };
  const stored = new Map();
  await setDfmodSources(['dfmod/g.dfmod'], async (k) => stored.get(k) ?? (k === 'dfmod/g.dfmod' ? new Uint8Array(4) : null),
    { open: async () => bundle, saveIndex: async (k, j) => stored.set(k, new TextEncoder().encode(j)), background: false });
  assert.ok(hasDfmodGround(302) && !hasDfmodGround(402));
  // VE2: the hosts hand the classic TEXTURE file - its record count is the depth TryImportTextureArray asks for
  const tex = (n) => ({ recordCount: n, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 2, colors: new Uint8Array(8) }) });
  const L = await dfmodGroundLayers(302, tex(3));
  assert.equal(L.length, 3);
  assert.deepEqual([...L[1].colors], [6, 0, 0, 255, 5, 0, 0, 255], 'bottom row first - getColor32\'s order, as the classic layers are');
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await dfmodGroundLayers(302, tex(4)), null, 'an array of another depth is refused, and no record of the archive is carried: the classic set');
  } finally { console.warn = warn; }
  assert.equal(await dfmodGroundLayers(402, tex(3)), null);
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(await dfmodGroundLayers(302, tex(3)), null, 'the gate shut: classic');
  setValue('Enhancements', 'AssetInjection', 'True');
  clearDfmodSources();
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /const modLayers = await dfmodGroundLayers\(groundArchive, groundTex\);[\s\S]{0,400}?const layers = modLayers \? carryPuddleMask\(modLayers, markPuddleWater\(classic\)\) : classic;\n\s+renderer\.uploadTileArray\(groundArchive, modLayers \? layers : markPuddleWater\(layers\)\);/, host);   // GROUND1-W: and the puddles' shapes from the classic set
  }
});
