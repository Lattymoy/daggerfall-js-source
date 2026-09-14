// FT7 - THE TWO QUALITY TIERS OF THE ENHANCED OUTDOORS (2026-09-14, the
// Features arc): Grass density and Cloud quality (PERF1) leave the
// Enhanced category for the home. The audit: both are the port's own
// dials, both inert unless the outdoors row is on (world.js gates the
// grass on enhancedEnvironments; the clouds ride the enhanced lane) -
// which neither note said and both say now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, checkFeature, featureForControl } from '../src/systems/features.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { QUALITY } from '../src/render/volumetricClouds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT7: grass density - the four fractions, the full field by default, off a real tier', () => {
  const f = FEATURES.find((x) => x.id === 'grass-density');
  assert.ok(f); assert.deepEqual(f.kinds, ['enhanced']);
  assert.equal(f.control.key, 'grassDensity');
  assert.deepEqual(f.control.tiers.map(([v]) => v), [1, 0.5, 0.25, 0]);
  assert.equal(PREF_DEFAULTS.grassDensity, 1, 'the full field by default - the enhanced look is the law, the dial is the escape (PERF1)');
  assert.match(f.note, /under the enhanced outdoors/, 'the dial says what it is under');
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'grassDensity'), f);
  // the world host reads the fraction and builds no field at zero (PERF1's law, unchanged)
  const w = read('src/scenes/world.js');
  assert.match(w, /const grassDensity = Math\.max\(0, Math\.min\(1, Number\(getPref\('grassDensity'\)\) \|\| 0\)\) \* LAB_GRASS\.density;/);
  assert.match(w, /getPref\('enhancedEnvironments'\) && grassDensity > 0 &&/, 'gated on the outdoors row, and zero builds nothing');
});

test('FT7: cloud quality - the tiers are the march table\'s own keys, default by default', () => {
  const f = FEATURES.find((x) => x.id === 'cloud-quality');
  assert.ok(f); assert.deepEqual(f.kinds, ['enhanced']);
  assert.equal(f.control.key, 'cloudQuality');
  const keys = f.control.tiers.map(([v]) => v);
  assert.deepEqual(keys, ['default', 'lo', 'hi']);
  for (const k of keys) assert.ok(Object.hasOwn(QUALITY, k), `${k} is a QUALITY the clouds can be built at`);
  assert.deepEqual(Object.keys(QUALITY).sort(), [...keys].sort(), 'and every QUALITY has a tier - no hidden third setting');
  assert.equal(PREF_DEFAULTS.cloudQuality, 'default');
  assert.match(f.note, /over the enhanced outdoors/);
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'cloudQuality'), f);
  assert.match(read('src/scenes/shared.js'), /Object\.hasOwn\(CLOUD_QUALITY, getPref\('cloudQuality'\)\) \? getPref\('cloudQuality'\) : 'default'/, 'the host reads the pref and falls back to default (PERF1, unchanged)');
});

test('FT7: the Enhanced category\'s two rows left with their copy', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.ok(!/choiceRow\('grassDensity'|choiceRow\('cloudQuality'/.test(menu));
  assert.ok(!/function portRowsEnhanced\(/.test(menu), 'FT12: the Enhanced category is gone from the settings rail - its rows are the home\'s');
});
