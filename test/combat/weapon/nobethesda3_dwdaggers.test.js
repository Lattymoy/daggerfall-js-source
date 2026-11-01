// NO-BETHESDA3 (2026-10-31; the owner: "Rebuild DW's 7 daggers"): twelve of Diverse Weapons' magic-dagger frames were
// 60% or more Daggerfall's own hand (WEAPON02.CIF) and left the tree as specs, the author's blades riding as edits.
// OWN-WORK4 (the same day): every frame of the set is ours now, these twelve with the rest - the specs are gone, no
// edit and no pixel of the author's read. In CI: the twelve are names of our set, built from the magic dagger's own
// file through our reader and never fetched, and no source reads a spec. With ARENA2_PATH: each builds at the classic
// magic frame's size, the hand Daggerfall's own pixel for pixel, the blade our own - broadened, grooved, our metal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CifRciFile } from '../../../src/formats/cifRciFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { diverseWeaponsImage, hasDiverseWeaponsSprite, clearDiverseWeaponsSources, _resetDiverseWeaponsImages } from '../../../src/combat/diverseWeapons/diverseWeaponsAssets.js';
import { createOwnWeaponArt, parseOwnName, metalLut, METAL_RAMPS, FULLER_SHADE, heldBladeMask } from '../../../src/combat/diverseWeapons/diverseWeaponsArt.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The twelve the specs held, by name. */
const TWELVE = Object.freeze([
  'DAGGERMAGIC.CIF_2-1_Adamantium', 'DAGGERMAGIC.CIF_2-1_Daedric', 'DAGGERMAGIC.CIF_2-1_Elven', 'DAGGERMAGIC.CIF_2-1_Iron',
  'DAGGERMAGIC.CIF_2-1_Orcish', 'DAGGERMAGIC.CIF_6-2_Adamantium', 'DAGGERMAGIC.CIF_6-2_Daedric', 'DAGGERMAGIC.CIF_6-2_Elven',
  'DAGGERMAGIC.CIF_6-3_Adamantium', 'DAGGERMAGIC.CIF_6-3_Dwarven', 'DAGGERMAGIC.CIF_6-3_Elven', 'DAGGERMAGIC.CIF_6-3_Iron',
]);

test('NO-BETHESDA3 / OWN-WORK4: the twelve are names of our set, built from the magic dagger\'s own file - no spec read anywhere', () => {
  for (const n of TWELVE) {
    assert.ok(hasDiverseWeaponsSprite(n), `${n}: in our set`);
    const ask = parseOwnName(n);
    assert.deepEqual([ask.look, ask.base, ask.wide], ['DAGGER', 'WEAPO102.CIF', false], `${n}: our dagger, over the classic magic dagger`);
  }
  const files = execFileSync('git', ['ls-files', 'src/combat'], { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => /\.m?js$/.test(f));
  assert.ok(files.length > 50);
  assert.deepEqual(files.filter((f) => read(f).includes('derived-art')), [], 'no weapon module reads a spec');
});

test('NO-BETHESDA3 / OWN-WORK4: a dagger frame takes our build path through the reader, never a fetch', async () => {
  _resetDiverseWeaponsImages(); clearDiverseWeaponsSources();
  const asked = [], fetch = globalThis.fetch;
  globalThis.fetch = async (u) => assert.fail(`fetched ${u}`);
  try {
    const art = { frame: async (n) => { asked.push(n); return { width: 1, height: 2, data: new Uint8Array([0, 0, 0, 0, 1, 2, 3, 255]) }; } };
    const img = await diverseWeaponsImage('DAGGERMAGIC.CIF_6-2_Elven', { art, enabled: true });
    assert.deepEqual(asked, ['DAGGERMAGIC.CIF_6-2_Elven']);
    assert.deepEqual([img.width, img.height, [...img.colors]], [1, 2, [0, 0, 0, 0, 1, 2, 3, 255]], 'screen order, a clear pixel 0,0,0,0');
  } finally { globalThis.fetch = fetch; _resetDiverseWeaponsImages(); clearDiverseWeaponsSources(); }
});

const ARENA2 = process.env.ARENA2_PATH;

test('NO-BETHESDA3 / OWN-WORK4 (ARENA2): each of the twelve at the classic magic frame\'s size - the hand Daggerfall\'s pixel for pixel, the blade our own', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const asked = [];
  const bytes = (n) => { asked.push(n); return readFileSync(join(ARENA2, n)); };
  const art = createOwnWeaponArt(async (n) => bytes(n));
  const pal = new DFPalette(); pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const cif = new CifRciFile(); cif.load(new Uint8Array(readFileSync(join(ARENA2, 'WEAPO102.CIF'))), 'WEAPO102.CIF', null);
  const shaped = [];
  for (const n of TWELVE) {
    const { record, frame, metal } = parseOwnName(n);
    const pic = await art.frame(n), bm = cif.getDFBitmap(record, frame), lut = metalLut(pal, METAL_RAMPS[metal]);
    assert.deepEqual([pic.width, pic.height], [bm.width, bm.height], `${n}: the box it is drawn into`);
    const own = heldBladeMask(bm.data, bm.width, bm.height) ?? new Uint8Array(bm.data.length);
    const ours = new Set(lut.flatMap((c) => [c.join(), c.map((v) => Math.round(v * FULLER_SHADE)).join()]));
    let hand = 0, classicBlade = 0, blade = 0, grooved = 0;
    for (let p = 0; p < bm.data.length; p++) {
      const i = bm.data[p], got = [...pic.data.subarray(p * 4, p * 4 + 4)], metalHere = i >= 0x70 && i <= 0x7f;
      if (metalHere && own[p]) classicBlade++;
      if (ours.has(got.slice(0, 3).join())) { blade++; if (!lut.some((c) => c.join() === got.slice(0, 3).join())) grooved++; }
      if (own[p] || !i) continue; // the broader blade may reach into the clear
      // past the blade's rule, every drawn pixel is the classic frame's: the hand Daggerfall's, a pommel by our law
      const want = metalHere ? [...lut[i - 0x70], 255] : [pal.get(i).r, pal.get(i).g, pal.get(i).b, 255];
      if (i && !metalHere) hand++;
      assert.deepEqual(got, want, `${n}: pixel ${p} past the blade is the classic frame's`);
    }
    assert.ok(hand > 500, `${n}: ${hand} hand pixels, Daggerfall's`);
    if (!own.some((v) => v)) continue; // a stab toward the eye: the blade's own shape, in our metal
    shaped.push(n);
    assert.ok(blade > classicBlade * 1.1, `${n}: our blade is broader (${blade} for ${classicBlade})`);
    assert.ok(grooved > 5, `${n}: and grooved (${grooved})`);
  }
  assert.deepEqual(shaped, TWELVE.filter((n) => !n.includes('_6-3_')), 'eight reshaped; the thrust\'s end-on frame (6-3) keeps its shape');
  assert.deepEqual([...new Set(asked)].sort(), ['ART_PAL.COL', 'WEAPO102.CIF'], 'the player\'s magic dagger and its palette, each read once');
  assert.equal(asked.length, 2);
});
