import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getTemplate } from '../src/characters/paperdoll.js';
import { resolvePaperdollRecord, isCloak, armorArchive, armorVariant, MATERIAL_FAMILY, morphologyOfRace } from '../src/characters/paperdollArt.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('paperdoll art: variant record resolution verbatim', () => {
  const cuirass = getTemplate(102);
  assert.equal(resolvePaperdollRecord(cuirass, 0), 3);
  assert.equal(resolvePaperdollRecord(cuirass, 4), 7);
  // Cloaks skip the interior image (+1): Casual_cloak mens = 154.
  const cloak = getTemplate(154);
  assert.ok(isCloak(cloak));
  assert.equal(resolvePaperdollRecord(cloak, 0), cloak.playerTextureRecord + 1);
  // No variants -> the plain record.
  const wand = getTemplate(140);
  assert.equal(resolvePaperdollRecord(wand, 0), wand.playerTextureRecord);
});

test('paperdoll art: material addressing verbatim', () => {
  // Gender bases + morphology offsets: human male = 249 + 2 = 251.
  assert.equal(armorArchive('male', 'Breton'), 251);
  assert.equal(armorArchive('female', 'Argonian'), 245);
  assert.equal(morphologyOfRace('HighElf'), 1);
  // Cuirass rows: leather 0, chain 4, plate clamps 1-3.
  assert.equal(armorVariant(102, MATERIAL_FAMILY.Leather, 3), 0);
  assert.equal(armorVariant(102, MATERIAL_FAMILY.Chain, 0), 4);
  assert.equal(armorVariant(102, MATERIAL_FAMILY.Plate, 0), 1);
  assert.equal(armorVariant(102, MATERIAL_FAMILY.Plate, 9), 3);
  // Greaves: leather 0-1, chain 6, plate 2-5.
  assert.equal(armorVariant(104, MATERIAL_FAMILY.Chain, 0), 6);
  assert.equal(armorVariant(104, MATERIAL_FAMILY.Plate, 0), 2);
});

test('paperdoll art: plate rows author in the metal band, leather does not', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const tex = new TextureFile();
  tex.load(readFileSync(join(ARENA2, 'TEXTURE.251')), 'TEXTURE.251', pal);
  const coverage = (rec) => {
    const bmp = tex.getDFBitmap(rec, 0);
    let band = 0, total = 0;
    for (const idx of bmp.data) {
      if (idx === 0) continue;
      total++;
      if (idx >= 0x70 && idx <= 0x7f) band++;
    }
    return band / total;
  };
  const tpl = getTemplate(102);
  const plateRec = resolvePaperdollRecord(tpl, armorVariant(102, MATERIAL_FAMILY.Plate, 1));
  const leatherRec = resolvePaperdollRecord(tpl, armorVariant(102, MATERIAL_FAMILY.Leather, 0));
  assert.ok(coverage(plateRec) > 0.5, `plate band ${coverage(plateRec)}`);
  assert.ok(coverage(leatherRec) < 0.1, `leather band ${coverage(leatherRec)}`);
});
