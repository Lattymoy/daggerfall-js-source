// DW2 - THE SET COMES WITH THE GAME (2026-09-23, Mac: "this needs to be in the codebase, not an attachable file").
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): the set is our own. No picture
// ships: every name DFU asks for is built at runtime from the player's classic files by our looks
// (combat/diverseWeapons/diverseWeaponsArt.js), and the vendored sprites are gone. Pins: our coverage as a literal
// table (the looks, the files, the counts), the decoder over every grammar, the door executed with an injected reader
// (a hit, a name outside the set never built, the switch off, a failed build said once, an attached copy winning),
// the PNG helpers the other extractors share, and nothing of the mod's left in the tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hasDiverseWeaponsSprite, DIVERSE_WEAPONS_SPRITE_COUNT, diverseWeaponsImage, setDiverseWeaponsSources,
  clearDiverseWeaponsSources, _resetDiverseWeaponsImages,
} from '../../src/combat/diverseWeapons/diverseWeaponsAssets.js';
import {
  DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_METALS, DIVERSE_WEAPONS_BARE, LOOKS, OWN_FILES, MELEE_SHAPE, BOW_SHAPE, shapeOf,
} from '../../src/combat/diverseWeapons/diverseWeaponsIndex.js';
import { MATERIAL_NAMES } from '../../src/systems/item/itemInfo.js';
import { readPng, writePng, writeIndexedPng, encodeSprite, sameOnScreen } from '../../tools/pngIO.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tracked = (...p) => execFileSync('git', ['ls-files', ...p], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

/** Our looks, as designed (OWN-WORK4): the classic file each is built from and the rule that reshapes it. */
const OUR_LOOKS = {
  DAGGER: { plain: 'WEAPON02.CIF', magic: 'WEAPO102.CIF', blade: { width: 1.3, fuller: true, only: true } },
  TANTO: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.45, width: 0.95, curve: 0.03, tip: 'chisel' } },
  SHORTSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.62, width: 1.15, fuller: true } },
  WAKAZASHI: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.7, width: 0.85, curve: 0.07 } },
  BROADSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.86, width: 1.45, fuller: true } },
  SABER: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.9, width: 1.05, curve: 0.16 } },
  LONGSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { fuller: true } },
  KATANA: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.96, width: 0.8, curve: 0.1 } },
  CLAYMORE: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 1.25, width: 1.3, fuller: true } },
  DAIKATANA: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 1.2, width: 0.85, curve: 0.11 } },
  STAFF: { plain: 'WEAPON01.CIF', magic: 'WEAPO101.CIF', bands: [[2, 3], [9, 10]] },
  MACE: { plain: 'WEAPON05.CIF', magic: 'WEAPO105.CIF' },
  FLAIL: { plain: 'WEAPON06.CIF', magic: 'WEAPO106.CIF' },
  WARHAMMER: { plain: 'WEAPON07.CIF', magic: 'WEAPO107.CIF' },
  BATTLEAXE: { plain: 'WEAPON08.CIF', magic: 'WEAPO108.CIF' },
  WARAXE: { plain: 'WEAPON08.CIF', magic: 'WEAPO108.CIF', head: 'single' },
  SHORTBOW: { plain: 'WEAPON09.CIF', bow: true },
  LONGBOW: { plain: 'WEAPON09.CIF', bow: true },
  WABBAJACK: { plain: 'WEAPO101.CIF', bands: [[1, 2], [5, 6], [9, 10]], ramp: 'chaos', artifact: true },
  WEAPON06: { plain: 'WEAPON06.CIF' },
  WEAPON08: { plain: 'WEAPON08.CIF' },
};

test('DW2 / OWN-WORK4 index: our looks and coverage as designed - every file in every metal, the idles, the icons; a rule, not a file list', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(LOOKS)), OUR_LOOKS);
  assert.deepEqual([...DIVERSE_WEAPONS_METALS], [...MATERIAL_NAMES], 'the bit order is MetalTypes\' (itemInfo.js MATERIAL_NAMES)');
  assert.equal(DIVERSE_WEAPONS_BARE, 1 << 10);
  assert.deepEqual([...MELEE_SHAPE], [1, 5, 5, 5, 5, 5, 5], 'an idle and six strikes of five (WeaponBasics)');
  assert.deepEqual([...BOW_SHAPE], [7], 'a bow\'s one record of seven');
  // the asked names: each look plain, the magic set where it has one - and nothing the port never asks
  assert.equal(Object.keys(OWN_FILES).length, 37);
  assert.deepEqual(OWN_FILES['KATANAMAGIC.CIF'], { look: 'KATANA', base: 'WEAPO104.CIF' }, 'an enchanted blade is built into the magic box it is drawn in');
  assert.deepEqual(OWN_FILES['WABBAJACK.CIF'], { look: 'WABBAJACK', base: 'WEAPO101.CIF' }, 'an artifact is enchanted: the magic staff\'s box');
  for (const absent of ['SHORTBOWMAGIC.CIF', 'ARROW.CIF', 'WEAPON08MAGIC.CIF', 'EBONYBLADE.CIF', 'WEAPON04.CIF']) assert.equal(OWN_FILES[absent], undefined, absent);
  assert.deepEqual(shapeOf('LONGBOW.CIF'), BOW_SHAPE); assert.deepEqual(shapeOf('MACE.CIF'), MELEE_SHAPE);
  const all = (1 << 10) - 1, iconBits = (all & ~(1 << 2)) | DIVERSE_WEAPONS_BARE;
  for (const [stem, bits] of Object.entries(DIVERSE_WEAPONS_STEMS)) {
    if (/\.CIF_/.test(stem)) assert.equal(bits, all, `${stem}: every metal, no bare stem`);
    else if (/^23[34]_/.test(stem)) assert.equal(bits, iconBits, `${stem}: every dye but Silver, and the bare stem`);
    else assert.equal(bits, DIVERSE_WEAPONS_BARE, `${stem}: the Wabbajack's, bare`);
  }
  const stems = Object.keys(DIVERSE_WEAPONS_STEMS);
  assert.equal(stems.filter((s) => /\.CIF_/.test(s) && !s.startsWith('w_')).length, 35 * 31 + 2 * 7);
  assert.equal(stems.filter((s) => s.startsWith('w_')).length, 37, 'one double-size idle per file');
  assert.deepEqual(stems.filter((s) => /^\d/.test(s)).length, 2 * 28 + 2);
  assert.equal(DIVERSE_WEAPONS_SPRITE_COUNT, (35 * 31 + 2 * 7 + 37) * 10 + 2 * 28 * 10 + 2, '11,922 names');
});

test('DW2 / OWN-WORK4 index: the decoder over every grammar - a metal, the bare stem, the idle, and the misses that start no build', () => {
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0_Iron'), true);
  assert.equal(hasDiverseWeaponsSprite('KATANAMAGIC.CIF_3-4_Daedric'), true);
  assert.equal(hasDiverseWeaponsSprite('DAGGERMAGIC.CIF_2-1_Iron'), true, 'NO-BETHESDA3\'s twelve are ours like the rest');
  assert.equal(hasDiverseWeaponsSprite('w_LONGSWORD.CIF_0-0_Iron'), true, 'Weapon Widget\'s double-scale idle');
  assert.equal(hasDiverseWeaponsSprite('w_LONGSWORD.CIF_3-2_Iron'), false, 'w_ is for record 0 alone - the fall-through to the plain name (DW1)');
  assert.equal(hasDiverseWeaponsSprite('LONGBOW.CIF_0-6_Elven'), true); assert.equal(hasDiverseWeaponsSprite('LONGBOW.CIF_1-0_Elven'), false);
  assert.equal(hasDiverseWeaponsSprite('233_5-0_Elven'), true, 'an icon in a metal');
  assert.equal(hasDiverseWeaponsSprite('233_2-0'), true, 'an icon with no metal (the bare bit)');
  assert.equal(hasDiverseWeaponsSprite('233_5-0_Silver'), false, 'never asked: Silver is Unchanged');
  assert.equal(hasDiverseWeaponsSprite('432_25-0'), true); assert.equal(hasDiverseWeaponsSprite('432_25-0_Iron'), false);
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0'), false, 'the bare bit is per stem');
  assert.equal(hasDiverseWeaponsSprite('WEAPON04.CIF_0-0_Iron'), false, 'a classic archive we draw no set for');
  assert.equal(hasDiverseWeaponsSprite('WEAPON08.CIF_1-2_Iron'), true, 'the battle-axe archive a custom template asks by');
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_0-0_Glass'), false, 'a metal that is not one');
  assert.equal(hasDiverseWeaponsSprite('LONGSWORD.CIF_9-0_Iron'), false, 'a record past the set');
  assert.equal(hasDiverseWeaponsSprite('w_0'), false);
  assert.equal(hasDiverseWeaponsSprite(''), false); assert.equal(hasDiverseWeaponsSprite(null), false);
});

test('DW2 / OWN-WORK4 door: our arm executed - built through the reader in screen order, once a name; a name outside the set never reaches it; off answers nothing; a failed build is a miss said once; an attached copy wins', async () => {
  _resetDiverseWeaponsImages(); clearDiverseWeaponsSources();
  const asked = [];
  const art = { frame: async (n) => { asked.push(n); if (/_6-/.test(n)) throw new Error('WEAPON04.CIF: missing'); return { width: 1, height: 2, data: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }; } };
  const warned = [], warn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    const img = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { art, enabled: true });
    assert.deepEqual([img.width, img.height], [1, 2]);
    assert.ok(img.colors instanceof Uint8ClampedArray, 'the port\'s upload shape');
    assert.deepEqual([...img.colors], [1, 2, 3, 255, 4, 5, 6, 255], 'a screen quad: rows kept, no flip (HT3)');
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { art, enabled: true }), img, 'cached per name');
    assert.deepEqual(asked, ['LONGSWORD.CIF_0-0_Iron'], 'built once');
    assert.equal(await diverseWeaponsImage('WEAPON04.CIF_0-0_Iron', { art, enabled: true }), null, 'not in the set');
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_1-0_Iron', { art, enabled: false }), null, 'the switch off: the classic frame');
    assert.equal(asked.length, 1, 'neither reached the reader');
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_6-0_Iron', { art, enabled: true }), null);
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_6-0_Iron', { art, enabled: true }), null);
    assert.equal(asked.length, 2, 'a failed build is cached');
    assert.equal(warned.length, 1); assert.match(warned[0], /LONGSWORD\.CIF_6-0_Iron would not build from the player's files: WEAPON04\.CIF: missing/);
    // the player's own copy of the mod answers first
    _resetDiverseWeaponsImages();
    const loose = writePng({ width: 1, height: 1, data: new Uint8Array([9, 9, 9, 255]) });
    setDiverseWeaponsSources(['LONGSWORD.CIF_0-0_Iron.png'], async () => loose);
    const got = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron', { art, enabled: true, decode: async (b) => readPng(b) });
    assert.deepEqual([got.width, got.height, [...got.colors]], [1, 1, [9, 9, 9, 255]], 'the player\'s own file wins');
    assert.equal(asked.length, 2, 'and ours was not built');
  } finally { console.warn = warn; clearDiverseWeaponsSources(); _resetDiverseWeaponsImages(); }
});

test('DW2 tool: the PNG helpers the extractors share (tools/pngIO.mjs) - the indexed round trip, RGBA where the picture will not fit, the on-screen comparison', () => {
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
  assert.deepEqual([...writeIndexedPng(img)], [...indexed], 'the same picture writes the same bytes');
});

test('OWN-WORK4: nothing of the mod is left in the tree - no sprite folder, no vendored directory, no source that names either', () => {
  assert.deepEqual(tracked('public/art/diverse-weapons', 'vendor/diverse-weapons'), [], 'the sprites and the vendored record left the tree');
  const named = tracked('src').filter((f) => /\.m?js$/.test(f) && /art\/diverse-weapons|vendor\/diverse-weapons/.test(readFileSync(join(root, f), 'utf8')));
  assert.deepEqual(named, [], 'no source reaches for them');
});
