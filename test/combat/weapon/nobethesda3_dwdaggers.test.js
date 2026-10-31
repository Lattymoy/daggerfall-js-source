// NO-BETHESDA3 (2026-10-31; the owner: "Rebuild DW's 7 daggers"): DIVERSE WEAPONS' SPRITES THAT ARE DAGGERFALL'S OWN
// HAND ARE REBUILT, NOT CARRIED. Twelve magic-dagger frames are 60% or more a WEAPON02.CIF frame's pixels, exactly
// (tools/classicDerive.mjs --cif). Each is a spec in vendor/diverse-weapons/derived-art.json, built from the player's
// own file with the author's blade pixels laid over it. In CI: every sprite the manifest names is a file or a spec,
// never both and never neither, and a spec's name takes the build path, never a fetch. With ARENA2_PATH: every spec
// builds, from the player's own WEAPON02.CIF, the pixels the mod's PNG gave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { createClassicPictures } from '../../../src/formats/classicPictures.js';
import { rebuiltPicture } from '../../../src/systems/rebuiltPicture.js';
import {
  diverseWeaponsImage, isDerivedDiverseWeaponsSprite, diverseWeaponsDerivedSpecs, hasDiverseWeaponsSprite, SHIPPED_DIR,
  clearDiverseWeaponsSources, _resetDiverseWeaponsImages,
} from '../../../src/combat/diverseWeapons/diverseWeaponsAssets.js';
import { DIVERSE_WEAPONS_DERIVED } from '../../../src/combat/diverseWeapons/diverseWeaponsIndex.js';
import { MANIFEST, DERIVED, manifestSpriteNames } from '../../../tools/diverseWeaponsIndex.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const SPECS = JSON.parse(read(DERIVED));
const isFile = (name) => existsSync(join(root, SHIPPED_DIR, `${name}.png`));

test('NO-BETHESDA3: every sprite Diverse Weapons\' manifest names is a file or a spec - never both, never neither', () => {
  const names = manifestSpriteNames(read(MANIFEST));
  assert.equal(names.length, 12624);
  const both = [], neither = [];
  for (const n of names) {
    const spec = Object.hasOwn(SPECS, n);
    if (spec && isFile(n)) both.push(n);
    if (!spec && !isFile(n)) neither.push(n);
  }
  assert.deepEqual(both, [], 'a sprite both rebuilt and carried - Daggerfall\'s pixels in the tree');
  assert.deepEqual(neither.slice(0, 10), [], `${neither.length} sprites neither carried nor rebuilt`);
  assert.deepEqual(Object.keys(SPECS).filter((n) => !names.includes(n)), [], 'a spec for a sprite the mod never shipped');
  assert.deepEqual([...DIVERSE_WEAPONS_DERIVED], Object.keys(SPECS).sort(), 'the door\'s index names the listing\'s sprites, no more');
});

test('NO-BETHESDA3: the twelve are magic-dagger frames over WEAPON02.CIF\'s own record and frame, in PAL.PAL, the author\'s blade as edits', () => {
  assert.deepEqual(Object.keys(SPECS).sort(), [
    'DAGGERMAGIC.CIF_2-1_Adamantium', 'DAGGERMAGIC.CIF_2-1_Daedric', 'DAGGERMAGIC.CIF_2-1_Elven', 'DAGGERMAGIC.CIF_2-1_Iron',
    'DAGGERMAGIC.CIF_2-1_Orcish', 'DAGGERMAGIC.CIF_6-2_Adamantium', 'DAGGERMAGIC.CIF_6-2_Daedric', 'DAGGERMAGIC.CIF_6-2_Elven',
    'DAGGERMAGIC.CIF_6-3_Adamantium', 'DAGGERMAGIC.CIF_6-3_Dwarven', 'DAGGERMAGIC.CIF_6-3_Elven', 'DAGGERMAGIC.CIF_6-3_Iron',
  ]);
  for (const [n, spec] of Object.entries(SPECS)) {
    const [, record, frame] = /_(\d+)-(\d+)_/.exec(n).map(Number);
    assert.equal(spec.file, 'WEAPON02.CIF', `${n}: the classic dagger's file`);
    assert.deepEqual(spec.from, [record, frame], `${n}: the sprite's own record and frame`);
    assert.equal(spec.pal, 'PAL.PAL', `${n}: the palette the author's copy was drawn in`);
    assert.equal(spec.size ?? null, null, `${n}: the frame's own size`);
    assert.equal(spec.at ?? null, null, `${n}: laid at the frame's corner`);
    assert.ok(spec.edits.length > 500, `${n}: the author's blade rides as edits`);
    assert.ok(hasDiverseWeaponsSprite(n) && isDerivedDiverseWeaponsSprite(n), `${n}: in the index, and rebuilt`);
  }
  assert.equal(isDerivedDiverseWeaponsSprite('DAGGERMAGIC.CIF_2-0_Iron'), false, 'a frame the author drew is a file');
  assert.equal(isDerivedDiverseWeaponsSprite('DAGGER.CIF_2-1_Iron'), false, 'the plain dagger is the author\'s');
});

test('NO-BETHESDA3: a derived sprite takes the build path through the classic reader and is never fetched; a file is still fetched', async () => {
  _resetDiverseWeaponsImages(); clearDiverseWeaponsSources();
  const asked = [], fetched = [];
  const art = { build: async (spec) => { asked.push(spec); return { width: 1, height: 2, data: new Uint8Array([7, 7, 7, 0, 1, 2, 3, 255]) }; } };
  const fetchFn = async (u) => { fetched.push(u); return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) }; };
  const decode = async () => ({ width: 1, height: 1, data: new Uint8Array([9, 9, 9, 255]) });
  try {
    const img = await diverseWeaponsImage('DAGGERMAGIC.CIF_6-2_Elven', { fetchFn, decode, art });
    assert.deepEqual(asked, [(await diverseWeaponsDerivedSpecs())['DAGGERMAGIC.CIF_6-2_Elven']], 'built from its own spec');
    assert.deepEqual([img.width, img.height, [...img.colors]], [1, 2, [0, 0, 0, 0, 1, 2, 3, 255]], 'screen order, a clear pixel 0,0,0,0');
    assert.deepEqual(fetched, [], 'no fetch for a sprite that is Daggerfall\'s own');
    const own = await diverseWeaponsImage('DAGGERMAGIC.CIF_6-2_Iron', { fetchFn, decode, art });
    assert.deepEqual([...own.colors], [9, 9, 9, 255]);
    assert.equal(fetched.length, 1); assert.match(fetched[0], /\/art\/diverse-weapons\/DAGGERMAGIC\.CIF_6-2_Iron\.png$/, 'the author\'s own frame is fetched');
    assert.equal(asked.length, 1);
    // no player's file to build from: a miss, said once - the classic frame draws
    const warned = [], warn = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    try {
      const failing = { build: async () => { throw new Error('WEAPON02.CIF: missing'); } };
      assert.equal(await diverseWeaponsImage('DAGGERMAGIC.CIF_6-3_Iron', { fetchFn, decode, art: failing }), null);
      assert.equal(await diverseWeaponsImage('DAGGERMAGIC.CIF_6-3_Iron', { fetchFn, decode, art: failing }), null, 'cached');
    } finally { console.warn = warn; }
    assert.equal(warned.length, 1); assert.match(warned[0], /DAGGERMAGIC\.CIF_6-3_Iron would not build from the player's files: WEAPON02\.CIF: missing/);
    assert.equal(fetched.length, 1, 'and never fetched');
  } finally { _resetDiverseWeaponsImages(); clearDiverseWeaponsSources(); }
  // the 425 kB of specs are their own chunk: no static import pulls them into the weapon's
  assert.doesNotMatch(read('src/combat/diverseWeapons/diverseWeaponsAssets.js'), /^import [^\n]*derived-art\.json/m);
});

// The prints of the pictures the mod's PNGs gave, decoded as a browser decodes them (a clear pixel 0,0,0,0): sha256 of
// `WxH:` and the RGBA, first 16 hex digits. Taken from the PNGs before they left the tree. A print is no picture.
const PRINTS = Object.freeze({
  'DAGGERMAGIC.CIF_2-1_Adamantium': '50e1ffd81fa098f7', 'DAGGERMAGIC.CIF_2-1_Daedric': '3046aeb955c4f2c6',
  'DAGGERMAGIC.CIF_2-1_Elven': '927390de4256b292', 'DAGGERMAGIC.CIF_2-1_Iron': '9f53bfe44fa390f3',
  'DAGGERMAGIC.CIF_2-1_Orcish': 'ff3891112e10458a', 'DAGGERMAGIC.CIF_6-2_Adamantium': '80527e9cbc79774e',
  'DAGGERMAGIC.CIF_6-2_Daedric': '70b805ca5f00d53a', 'DAGGERMAGIC.CIF_6-2_Elven': 'd66d55b0393a4d93',
  'DAGGERMAGIC.CIF_6-3_Adamantium': 'd42af7d6f10435eb', 'DAGGERMAGIC.CIF_6-3_Dwarven': '420b43dc1e741a95',
  'DAGGERMAGIC.CIF_6-3_Elven': 'cfda2f5480c2ea39', 'DAGGERMAGIC.CIF_6-3_Iron': '715f05da14f9fcd2',
});
const printOf = (p) => createHash('sha256').update(`${p.width}x${p.height}:`).update(p.data).digest('hex').slice(0, 16);
const ARENA2 = process.env.ARENA2_PATH;

test('NO-BETHESDA3 (ARENA2): every spec builds, from the player\'s own WEAPON02.CIF, the pixels the mod\'s PNG gave', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const asked = [];
  const art = createClassicPictures(async (n) => { asked.push(n); return readFileSync(join(ARENA2, n)); });
  for (const [n, spec] of Object.entries(SPECS)) {
    const pic = await rebuiltPicture(spec, art);
    assert.deepEqual([pic.width, pic.height], n.includes('_2-1_') ? [296, 200] : [184, 120], `${n}: the frame's size`);
    assert.equal(printOf(pic), PRINTS[n], `${n}: the picture the PNG gave`);
  }
  assert.deepEqual(asked.sort(), ['PAL.PAL', 'WEAPON02.CIF'], 'the player\'s dagger file and its palette, nothing more');
  // and through the door, in the shape the first-person lane uploads
  _resetDiverseWeaponsImages(); clearDiverseWeaponsSources();
  try {
    const img = await diverseWeaponsImage('DAGGERMAGIC.CIF_6-2_Elven', { art, fetchFn: async (u) => assert.fail(`fetched ${u}`) });
    assert.equal(printOf({ width: img.width, height: img.height, data: new Uint8Array(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength) }), PRINTS['DAGGERMAGIC.CIF_6-2_Elven']);
  } finally { _resetDiverseWeaponsImages(); clearDiverseWeaponsSources(); }
});
