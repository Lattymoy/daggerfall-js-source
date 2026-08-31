import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// UI4 - THE ITEM INFO PANEL (DaggerfallInventoryWindow :303-307). Setup
// only ADDS the panel when EnableInventoryInfoPanel is on, so with it
// off there is no ITEM00I0 cutout and no text in that rect - the plain
// background shows through. It ships True, which is why the port
// drawing it unconditionally has looked right all along.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('UI4: the panel draws behind the setting, not unconditionally', () => {
  const inv = read('src/ui/nativeInventory.js');
  assert.match(inv, /if \(_art\.info && getBool\('GUI', 'EnableInventoryInfoPanel'\)\) \{/);
  // The cutout and the label are INSIDE that gate - DFU never creates
  // the panel, so nothing in it can draw.
  const gate = inv.indexOf("if (_art.info && getBool('GUI', 'EnableInventoryInfoPanel')) {");
  const cutout = inv.indexOf('drawImgCrop(renderer, _art.info, m, INV_RECTS.infoCutout, INV_RECTS.itemInfoPanel);');
  assert.ok(gate > 0 && cutout > gate, 'the cutout is inside the gate');
});

test('UI4: it ships True, so the default is unchanged, and the key is LIVE', () => {
  resetToDefaults();
  assert.match(read('src/systems/settingsDefaults.js'), /"EnableInventoryInfoPanel": "True"/,
    'the shipped default - the port has been RIGHT by accident, and is right on purpose now');
  setValue('GUI', 'EnableInventoryInfoPanel', false);
  resetToDefaults();
  assert.equal(LIVE['GUI/EnableInventoryInfoPanel'], 'src/ui/nativeInventory.js');
});

test('UI4: the TRADE window has no panel to gate - recorded, not silently skipped', () => {
  // DaggerfallTradeWindow :217-223 puts the same panel in one of two
  // rects by mode. The port's trade window has never drawn it, so
  // there is nothing to gate here yet; when it grows one it takes the
  // same setting. This pin fails the day it appears, which is when the
  // gate has to be added with it.
  const trade = read('src/ui/nativeTrade.js');
  assert.doesNotMatch(trade, /infoCutout|itemInfoPanel/, 'the trade window has grown an info panel - gate it on EnableInventoryInfoPanel');
});
