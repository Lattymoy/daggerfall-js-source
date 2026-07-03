import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DYE_COLORS, DYE_TARGETS, CLOTHING_DYES, METAL_TABLES,
  getDyeColorTable, applyDyeToIndex,
} from '../src/characters/dyes.js';

test('dyes: clothing tables are range shifts, Blue is identity', () => {
  assert.deepEqual(getDyeColorTable(DYE_COLORS.Blue, DYE_TARGETS.Clothing),
    Array.from({ length: 16 }, (_, i) => 0x60 + i));
  assert.equal(getDyeColorTable(DYE_COLORS.Red, DYE_TARGETS.Clothing)[0], 0xef);
  assert.equal(getDyeColorTable(DYE_COLORS.Green, DYE_TARGETS.Clothing)[15], 0xa0 + 15);
  assert.equal(CLOTHING_DYES.length, 10);
});

test('dyes: metal tables extraction pins', () => {
  assert.deepEqual(METAL_TABLES.Iron.slice(0, 4), [0x77, 0x78, 0x57, 0x79]);
  assert.deepEqual(METAL_TABLES.Steel, Array.from({ length: 16 }, (_, i) => 0x70 + i));
  assert.equal(Object.keys(METAL_TABLES).length, 11);
  for (const t of Object.values(METAL_TABLES)) assert.equal(t.length, 16);
  assert.equal(getDyeColorTable(DYE_COLORS.Daedric, DYE_TARGETS.WeaponsAndArmor), METAL_TABLES.Daedric);
});

test('dyes: applyDyeToIndex swaps only the band', () => {
  // Clothing band 0x60-0x6F remaps; everything else passes through.
  assert.equal(applyDyeToIndex(0x60, DYE_COLORS.Red, DYE_TARGETS.Clothing), 0xef);
  assert.equal(applyDyeToIndex(0x6f, DYE_COLORS.Grey, DYE_TARGETS.Clothing), 0x5f);
  assert.equal(applyDyeToIndex(0x5f, DYE_COLORS.Red, DYE_TARGETS.Clothing), 0x5f);
  // Armor band 0x70-0x7F onto the metal table.
  assert.equal(applyDyeToIndex(0x70, DYE_COLORS.Iron, DYE_TARGETS.WeaponsAndArmor), 0x77);
  assert.equal(applyDyeToIndex(0x72, DYE_COLORS.Iron, DYE_TARGETS.WeaponsAndArmor), 0x57);
  assert.equal(applyDyeToIndex(0x8f, DYE_COLORS.Iron, DYE_TARGETS.WeaponsAndArmor), 0x8f);
});
