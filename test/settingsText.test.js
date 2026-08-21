// DFU's OWN settings words (SETT/MENU): vendor/dfu-settings/
// GameSettings.txt baked into src/systems/settingsText.js.
//
// This table is why the settings screen can speak plain English
// without inventing a single word - DFU already wrote the label and
// the tooltip for every setting its UI exposes, plus the titles of
// its pages and section headings. Porting the words is porting a law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_LABELS, SETTINGS_INFO } from '../src/systems/settingsText.js';
import { parseSettingsText, splitLabels } from '../scripts/bakeSettingsText.mjs';
import { SETTINGS_DEFAULTS } from '../src/systems/settingsDefaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendored = () => readFileSync(join(root, 'vendor/dfu-settings/GameSettings.txt'), 'utf8');

test('settingsText: the BAKE is the vendored table - a stale bake fails here', () => {
  const { labels, info } = splitLabels(parseSettingsText(vendored()));
  assert.deepEqual(JSON.parse(JSON.stringify(SETTINGS_LABELS)), labels, 'run: node scripts/bakeSettingsText.mjs');
  assert.deepEqual(JSON.parse(JSON.stringify(SETTINGS_INFO)), info, 'run: node scripts/bakeSettingsText.mjs');
  // the parse must skip DFU's comment and schema lines, not swallow them
  assert.ok(!('schema' in SETTINGS_LABELS), 'the schema line is not a label');
  for (const k of Object.keys(SETTINGS_LABELS)) assert.ok(!k.startsWith('-'), `comment leaked in: ${k}`);
});

test('settingsText: DFU words for the pages, the sections and the settings', () => {
  // the five pages and a sample of the section headings DFU keys out
  // of this same table (DaggerfallAdvancedSettingsWindow.cs:234-238,
  // AddSectionTitle :653)
  for (const page of ['gamePlay', 'interface', 'enhancements', 'video', 'accessibility']) {
    assert.ok(SETTINGS_LABELS[page], `page title missing: ${page}`);
  }
  for (const section of ['game', 'controls', 'audio', 'hud', 'gui', 'modSystem', 'light', 'basic', 'advanced', 'automap']) {
    assert.ok(SETTINGS_LABELS[section], `section title missing: ${section}`);
  }
  // the settings this port has made LIVE all carry DFU's own words
  assert.equal(SETTINGS_LABELS.soundVolume, 'Sound volume');
  assert.equal(SETTINGS_LABELS.musicVolume, 'Music volume');
  assert.equal(SETTINGS_LABELS.mouseSensitivity, 'Mouse Sensitivity');
  assert.equal(SETTINGS_LABELS.combatVoices, 'Combat vocalizations');
  assert.ok(SETTINGS_INFO.combatVoices.length > 10, 'and a tooltip to explain it');
  // the raw ini identifier must never be the thing a player reads
  assert.ok(SETTINGS_LABELS.gameConsole && !SETTINGS_LABELS.LypyL_GameConsole,
    'DFU names it "Game Console", not LypyL_GameConsole');
});

test('settingsText: the label key is the ini key with a lowered first letter', () => {
  // the mapping the settings screen will rely on. It resolves 64 of
  // our 171 keys - DFU's own UI exposes only those; the other 107 are
  // ini-only and DFU never shows them either, which is the honest
  // reason a settings screen may hide them behind an advanced view.
  const lc = (k) => k.charAt(0).toLowerCase() + k.slice(1);
  const all = Object.entries(SETTINGS_DEFAULTS).flatMap(([s, ks]) => Object.keys(ks).map((k) => [s, k]));
  const resolved = all.filter(([, k]) => SETTINGS_LABELS[lc(k)] || SETTINGS_LABELS[k]);
  assert.equal(all.length, 171);
  assert.ok(resolved.length >= 60 && resolved.length <= 80,
    `expected DFU to label ~64 of the 171 ini keys, got ${resolved.length}`);
  // spot-check the convention in both directions
  assert.ok(SETTINGS_LABELS[lc('SoundVolume')], 'SoundVolume -> soundVolume');
  assert.ok(SETTINGS_LABELS[lc('PlayerTorchFromItems')], 'PlayerTorchFromItems -> playerTorchFromItems');
});
