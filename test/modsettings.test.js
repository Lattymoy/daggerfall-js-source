// ROADS 24: A VENDORED MOD'S OWN SWITCHES. Basic Roads' SmoothRoads and
// RiversAndStreams, with the mod's own names, defaults and descriptions,
// under the Mods pane, carried on the network object into the kernel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

test('ROADS 24: the switches are the mod\u2019s own - names, defaults, descriptions', () => {
  _resetModSettings();
  const m = MOD_SETTINGS['roads-hazelnut'];
  assert.equal(m.title, 'Basic Roads');
  assert.equal(m.keys.SmoothRoads.default, true);
  assert.equal(m.keys.RiversAndStreams.default, false);
  assert.match(m.keys.SmoothRoads.description, /light smoothing of road surfaces/);
  assert.match(m.keys.RiversAndStreams.description, /rivers and streams on terrain/);
  assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true, 'default read');
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), false);
  setModSetting('roads-hazelnut', 'RiversAndStreams', true);
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), true, 'flipped');
  assert.throws(() => modSetting('roads-hazelnut', 'PathEditingEnabled'), /not a declared switch/, 'the mod\u2019s editor switches are not carried');
  _resetModSettings();
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), false, 'reset forgets');
});

test('ROADS 24: the switches reach the kernel on both paths, and the Mods pane shows them', () => {
  const host = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /smooth: modSetting\('roads-hazelnut', 'SmoothRoads'\), water: modSetting\('roads-hazelnut', 'RiversAndStreams'\)/, 'read as the world loads');
  assert.match(host, /setRoadsData\(\{ \.\.\.his, \.\.\.roadSwitches \}/, 'on his data');
  assert.match(host, /setRoads\(settlementsOf\(maps\), logRoads, roadSwitches\)/, 'and on the fallback');
  const worker = readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(worker, /\.\.\.\(m\.switches \?\? \{\}\)/, 'the worker attaches them to the built network');
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /for \(const \[vendor, mod\] of Object\.entries\(MOD_SETTINGS\)\)/, 'the Mods pane lists every vendored mod\u2019s switches');
  assert.match(menu, /setModSetting\(vendor, key, !modSetting\(vendor, key\)\)/, 'a click flips one');
});
