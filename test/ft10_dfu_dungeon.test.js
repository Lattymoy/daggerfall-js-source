// FT10 - DFU'S OWN DUNGEON ENHANCEMENTS (2026-09-14, the Features arc):
// Enemies Fight Each Other, Varied Dungeon Monsters, Torches Light Your
// Way - three of the Enhancements section's switches, DFU Classic. Each
// is read by the port at its point of use as DFU reads it, and each
// row's note says what DFU ships it as - pinned against the baked
// defaults, so a re-bake cannot make the note lie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, checkFeature, featureForControl } from '../src/systems/features.js';
import { DEFAULTS, tierOf } from '../src/systems/settings.js';
import { labelOf } from '../src/ui/settingsCopy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const ROWS = [
  ['enemy-infighting', 'Enhancements/EnemyInfighting', 'True', 'Takes effect at once.'],
  ['varied-dungeon-monsters', 'Enhancements/AlternateRandomEnemySelection', 'False', 'Takes effect on the next dungeon you enter.'],
  ['torches-from-items', 'Enhancements/PlayerTorchFromItems', 'False', 'Takes effect at once; a new character’s starting gear and a shop’s next stocking follow it.'],
];

test('FT10: three DFU Classic rows over live DFU keys, titled as the settings pane titles them, sound', () => {
  for (const [id, key, , effect] of ROWS) {
    const f = FEATURES.find((x) => x.id === id);
    assert.ok(f, id);
    assert.deepEqual(f.kinds, ['classic'], `${id}: DFU's own`);
    assert.deepEqual(f.control, { store: 'settings', key });
    assert.equal(tierOf(key), 'live', `${key} is read by the port`);
    assert.equal(f.title, labelOf(key), `${id}: one name here and on the pointer row in Settings`);
    assert.equal(f.effect, effect);
    assert.deepEqual(checkFeature(f), []);
    assert.equal(featureForControl('settings', key), f);
  }
});

test('FT10: each note says what Daggerfall Unity ships it as, and the baked default agrees', () => {
  for (const [id, key, def] of ROWS) {
    const [sec, k] = key.split('/');
    assert.equal(DEFAULTS[sec][k], def, `${key} ships ${def}`);
    const f = FEATURES.find((x) => x.id === id);
    assert.match(f.note, def === 'True' ? /Daggerfall Unity ships it on\.$/ : /Daggerfall Unity ships it off\.$/, `${id}: the note's last sentence is the default`);
  }
});

test('FT10: the port reads each key where DFU reads it, live', () => {
  assert.match(read('src/characters/enemyTargets.js'), /export const enemyInfightingEnabled = \(\) => getBool\('Enhancements', 'EnemyInfighting'\);/, 'infighting: at the point of use');
  assert.match(read('src/characters/dungeonEnemies.js'), /alternate = getBool\('Enhancements', 'AlternateRandomEnemySelection'\) \} = \{\}\) \{/, 'alternate selection: as the dungeon\'s enemies are collected');
  assert.match(read('src/systems/playerTorch.js'), /const enabled = fromItems \?\? getBool\('Enhancements', 'PlayerTorchFromItems'\);/, 'the torch: inside the tick, as EnablePlayerTorch.Update reads it');
  assert.match(read('src/systems/startingGear.js'), /torchesFromItems = getBool\('Enhancements', 'PlayerTorchFromItems'\)/, 'and the starting gear');
  assert.match(read('src/systems/shopStock.js'), /torchesFromItems = getBool\('Enhancements', 'PlayerTorchFromItems'\)/, 'and the shop shelf');
});
