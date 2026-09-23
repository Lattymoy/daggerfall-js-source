// DW2 - THE SPRITES SHIP WITH THE PORT (2026-09-23, Mac: "this needs to
// be in the codebase, not an attachable file"). public/art/diverse-
// weapons/ carries Diverse Weapons' 12,624 sprites by the name DFU asks
// for; the door's index of them is derived from the mod's own manifest
// (tools/diverseWeaponsIndex.mjs -> combat/diverseWeaponsIndex.js), the
// folder's membership from the same manifest (test/doctrine.test.js),
// and the tool that writes the folder (tools/diverseWeaponsExtract.mjs)
// checks each file against its texel. Pins: the generated index IS the
// manifest, the decoder over every grammar, the URL off the app root,
// the shipped arm executed with an injected fetch and decoder (a hit,
// an index miss that never fetches, a 404 said once, an attached bundle
// winning), the indexed PNG round trip and the encoder's two arms, and
// the folder against the index both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hasDiverseWeaponsSprite, diverseWeaponsSpriteUrl, DIVERSE_WEAPONS_SPRITE_COUNT, SHIPPED_DIR,
  diverseWeaponsImage, setDiverseWeaponsSources, clearDiverseWeaponsSources, _resetDiverseWeaponsImages,
} from '../src/combat/diverseWeaponsAssets.js';
import { DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_ODD, DIVERSE_WEAPONS_METALS, DIVERSE_WEAPONS_BARE } from '../src/combat/diverseWeaponsIndex.js';
import { MATERIAL_NAMES } from '../src/systems/itemInfo.js';
import { manifestSpriteNames, encodeIndex, renderIndex, MANIFEST, INDEX_FILE, METALS, BARE_BIT } from '../tools/diverseWeaponsIndex.mjs';
import { encodeSprite, sameOnScreen, OUT_DIR } from '../tools/diverseWeaponsExtract.mjs';
import { readPng, writePng, writeIndexedPng } from '../tools/pngIO.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

test('DW2 index: the generated module IS the manifest - every PNG basename the bundle names, once, as stems over MetalTypes\' order; regenerating writes the same file', () => {
  const names = manifestSpriteNames(rd(MANIFEST));
  assert.equal(names.length, 12624, 'the manifest\'s 12,934 PNGs name 12,624 sprites (310 twice)');
  const index = encodeIndex(names);
  assert.deepEqual(Object.fromEntries(index.stems), { ...DIVERSE_WEAPONS_STEMS });
  assert.deepEqual([...index.odd], [...DIVERSE_WEAPONS_ODD]);
  assert.deepEqual([...DIVERSE_WEAPONS_METALS], [...METALS]);
  assert.deepEqual([...METALS], [...MATERIAL_NAMES], 'the bit order is MetalTypes\' (itemInfo.js MATERIAL_NAMES)');
  assert.equal(DIVERSE_WEAPONS_BARE, BARE_BIT); assert.equal(BARE_BIT, 1 << 10);
  assert.equal(DIVERSE_WEAPONS_SPRITE_COUNT, 12624);
  assert.equal(renderIndex(index, '1.7.3'), rd(INDEX_FILE), 'the checked-in module is what the tool writes today');
  assert.ok(index.stems.size < 1400 && rd(INDEX_FILE).length < 60_000, 'a compact index, not 350 KB of names');
  // the whole set decodes back out of the module
  for (const n of names) assert.ok(hasDiverseWeaponsSprite(n), n);
});

test('DW2 index: the decoder over every grammar - a metal, the bare stem, the odd name, and the misses that cost no fetch', () => {
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0_Iron'), true);
  assert.equal(hasDiverseWeaponsSprite('KATANAMAGIC.CIF_3-4_Daedric'), true);
  assert.equal(hasDiverseWeaponsSprite('w_LONGSWORD.CIF_0-0_Iron'), true, 'Weapon Widget\'s double-scale idle');
  assert.equal(hasDiverseWeaponsSprite('w_LONGSWORD.CIF_3-2_Iron'), false, 'w_ is shipped for record 0 alone - the fall-through to the plain name (DW1)');
  assert.equal(hasDiverseWeaponsSprite('233_5-0_Elven'), true, 'an icon in a metal');
  assert.equal(hasDiverseWeaponsSprite('233_2-0'), true, 'an icon with no metal (the bare bit)');
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0'), false, 'the bare bit is per stem');
  assert.equal(hasDiverseWeaponsSprite('w_0'), true, 'the one odd name');
  assert.equal(hasDiverseWeaponsSprite('WEAPON04.CIF_0-0_Iron'), false, 'a classic archive nothing was painted for');
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0_Glass'), false, 'a metal that is not one');
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_9-0_Iron'), false, 'a record past the set');
  assert.equal(hasDiverseWeaponsSprite(''), false); assert.equal(hasDiverseWeaponsSprite(null), false);
  assert.equal(diverseWeaponsSpriteUrl('w_LONGSWORD.CIF_0-0_Iron', 'https://host/play/'), 'https://host/play/art/diverse-weapons/w_LONGSWORD.CIF_0-0_Iron.png', 'off the app root, the held map\'s shape');
  assert.equal(diverseWeaponsSpriteUrl('a b', 'https://host/'), 'https://host/art/diverse-weapons/a%20b.png');
  assert.equal(SHIPPED_DIR, OUT_DIR, 'the door and the tool name one folder');
  assert.equal(SHIPPED_DIR, 'public/art/diverse-weapons');
});

test('DW2 door: the shipped arm executed - a hit through fetch and the PNG decoder in screen order, an index miss that never fetches, a 404 said once and cached, an attached loose PNG winning over the shipped one', async () => {
  _resetDiverseWeaponsImages(); clearDiverseWeaponsSources();
  const asked = [];
  const png = writePng({ width: 1, height: 2, data: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) });
  const fetchFn = async (url) => { asked.push(url); return /LONGSWORD\.CIF_0-0_Iron/.test(url) ? { ok: true, status: 200, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) } : { ok: false, status: 404 }; };
  const decode = async (bytes) => readPng(bytes);
  try {
    const img = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { fetchFn, decode });
    assert.deepEqual([img.width, img.height], [1, 2]);
    assert.ok(img.colors instanceof Uint8ClampedArray, 'the port\'s color32 shape');
    assert.deepEqual([...img.colors], [1, 2, 3, 255, 4, 5, 6, 255], 'a PNG keeps its rows (toScreenOrder, HT3) - no flip');
    assert.equal(asked.length, 1); assert.match(asked[0], /\/art\/diverse-weapons\/LONGSWORD\.CIF_0-0_Iron\.png$/);
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { fetchFn, decode }), img, 'cached per name');
    assert.equal(await diverseWeaponsImage('WEAPON04.CIF_0-0_Iron', { fetchFn, decode }), null, 'not in the index');
    assert.equal(asked.length, 1, 'an index miss never fetches');
    const warned = [];
    const warn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
    try {
      assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_1-0_Iron', { fetchFn, decode }), null, 'in the index, not on the site');
      assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_1-0_Iron', { fetchFn, decode }), null);
      assert.equal(asked.length, 2, 'the 404 is cached: one fetch');
      assert.equal(warned.length, 1); assert.match(warned[0], /LONGSWORD\.CIF_1-0_Iron\.png is in the index and not on the site \(404\)/);
    } finally { console.warn = warn; }
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_2-0_Iron', { fetchFn: null, decode }), null, 'no fetch in this host: a miss, not a throw');
    // an attached loose PNG of the same name answers first
    _resetDiverseWeaponsImages();
    const loose = writePng({ width: 1, height: 1, data: new Uint8Array([9, 9, 9, 255]) });
    setDiverseWeaponsSources(['LONGSWORD.CIF_0-0_Iron.png'], async () => loose);
    const got = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { fetchFn, decode });
    assert.deepEqual([got.width, got.height, [...got.colors]], [1, 1, [9, 9, 9, 255]], 'the player\'s own file wins');
    assert.equal(asked.length, 2, 'and the shipped one was not fetched');
  } finally { clearDiverseWeaponsSources(); _resetDiverseWeaponsImages(); }
});

test('DW2 tool: the indexed PNG round trip (palette, the transparent index, RGBA where the picture will not fit), the encoder\'s two arms, and the on-screen comparison', () => {
  const data = new Uint8Array([255, 0, 0, 255, 7, 7, 7, 0, 0, 255, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0]);
  const img = { width: 3, height: 2, data };
  const indexed = writeIndexedPng(img);
  assert.ok(indexed, 'fits: three colours, alpha 0 or 255');
  assert.equal(indexed[25], 3, 'colour type 3');
  const back = readPng(indexed);
  assert.ok(sameOnScreen(img, back), 'every drawn pixel identical, every hidden pixel hidden');
  assert.deepEqual([...back.data].slice(4, 8), [0, 0, 0, 0], 'the ghost colour under a transparent pixel collapsed to the one index');
  assert.ok(!sameOnScreen(img, { ...img, data: data.map((v, i) => (i === 0 ? 254 : v)) }), 'a drawn pixel off by one is not the same');
  assert.ok(!sameOnScreen(img, { ...img, data: data.map((v, i) => (i === 7 ? 255 : v)) }), 'a hidden pixel shown is not the same');
  assert.equal(writeIndexedPng({ width: 1, height: 1, data: new Uint8Array([1, 2, 3, 128]) }), null, 'a soft alpha does not fit');
  const many = new Uint8Array(256 * 4); for (let i = 0; i < 256; i++) { many[i * 4] = i; many[i * 4 + 3] = 255; }
  assert.equal(writeIndexedPng({ width: 256, height: 1, data: many }), null, '256 opaque colours do not fit beside the transparent index');
  assert.equal(encodeSprite(img).indexed, true);
  const soft = encodeSprite({ width: 1, height: 1, data: new Uint8Array([1, 2, 3, 128]) });
  assert.equal(soft.indexed, false); assert.equal(soft.png[25], 6, 'RGBA for the rest');
  assert.deepEqual([...readPng(soft.png).data], [1, 2, 3, 128]);
  // the same picture writes the same bytes
  assert.deepEqual([...writeIndexedPng(img)], [...indexed]);
});

test('DW2 folder: what is tracked under public/art/diverse-weapons/ is exactly the index, both ways', () => {
  const files = tracked(SHIPPED_DIR).filter((f) => /\.png$/i.test(f)).map((f) => f.slice(f.lastIndexOf('/') + 1).replace(/\.png$/i, ''));
  const strangers = files.filter((n) => !hasDiverseWeaponsSprite(n));
  assert.deepEqual(strangers, [], 'files the index (the manifest) does not name');
  const have = new Set(files);
  const missing = manifestSpriteNames(rd(MANIFEST)).filter((n) => !have.has(n));
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} index names with no file - run node tools/diverseWeaponsExtract.mjs "<diverse weapons.dfmod>"`);
  assert.equal(files.length, DIVERSE_WEAPONS_SPRITE_COUNT);
  // the doctrine gate's row is on this folder and derives from the same manifest
  assert.match(rd('test/doctrine.test.js'), /\['public\/art\/diverse-weapons\/',\n\s+\{ manifest: 'vendor\/diverse-weapons\/diverse-weapons\.dfmod\.json',/);
});
