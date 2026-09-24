// HT-WAIST (2026-09-24, Mac: "Let the lantern item be able to be hung at
// the waist instead of having to be held" - and, asked how: a switch on the
// Handheld Torches pane, off by default). THE SWITCH.
//
// `Handling.LanternsAtWaist` is the port's own key on a vendored mod's pane
// - the first key on this pane the mod does not ship at all (every earlier
// departure moved a shipped default). These pins hold what that promises:
// it is on the pane and reachable (the tile drawer draws only the curated
// keys - TORCH-BIND's lesson), it ships OFF, its words say it is the
// port's, the vendored modsettings.json is untouched, the component's
// settings frame carries it, and the one predicate every reader asks
// (systems/playerTorch.js lanternAtWaist) answers only for a lantern, only
// with the mod on, only with the switch on. The departure is recorded where
// this pane's others are: Handheld-Torches.md and Ledger A.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';
import { readTorchSettings, HANDHELD_TORCHES_VENDOR } from '../src/systems/handheldTorches.js';
import { lanternAtWaist } from '../src/systems/playerTorch.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const V = HANDHELD_TORCHES_VENDOR;
const KEY = 'Handling.LanternsAtWaist';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lantern = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, currentCondition: 100, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 });
const candle = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Candle, currentCondition: 16, maxCondition: 16 });

test('HT-WAIST: the switch is on the Handheld Torches pane - a toggle, OFF by default, its words the mod\'s kind and saying it is the port\'s; the shipped modsettings.json does not carry it (mutant: the key gone, defaulted on, or its words silent)', () => {
  const def = MOD_SETTINGS[V].keys[KEY];
  assert.ok(def, 'the key is declared on the vendored pane');
  assert.equal(def.default, false, 'OFF by default - Mac: a switch the player turns on');
  assert.equal(typeof def.default, 'boolean', 'a ToggleKey, not a slider or a choice');
  assert.equal(def.options, undefined); assert.equal(def.min, undefined); assert.equal(def.text, undefined);
  assert.match(def.description, /^If enabled, lanterns hang at your waist instead of being held/, 'in the mod\'s own voice - RelaxedLanterns\' "If enabled, ..."');
  assert.match(def.description, /Torches and candles are still held/);
  assert.match(def.description, /port’s own switch - the mod has none/, 'the pane says the knob is the port\'s, as ORL1\'s primarySkillsImpact does');
  // the vendored file is the mod's: the port adds its key on its own pane, never to the author's json
  const shipped = JSON.parse(read('vendor/handheld-torches/modsettings.json'));
  const names = shipped.Sections.flatMap((s) => s.Keys.map((k) => `${s.Name}.${k.Name}`));
  assert.ok(!names.includes(KEY), 'the shipped modsettings.json is untouched');
  assert.ok(names.includes('Handling.RelaxedLanterns'), 'and it sits beside the mod\'s own Relaxed Lanterns');
  const keys = Object.keys(MOD_SETTINGS[V].keys);
  assert.equal(keys.indexOf(KEY), keys.indexOf('Handling.RelaxedLanterns') + 1, 'directly under Relaxed Lanterns, the switch it takes the rest of the way');
  _resetModSettings();
  assert.equal(modSetting(V, KEY), false, 'the store reads it as a declared switch, off');
});

test('HT-WAIST: the switch is REACHABLE - curated onto the mod\'s tile, so the drawer draws it (mutant: left off MOD_CURATED, TORCH-BIND\'s unreachable key again)', () => {
  assert.ok(MOD_CURATED[V].includes(KEY), 'on the Handheld Torches tile');
  assert.ok(modDials(V).includes(KEY), 'and modDials keeps it - it is a real key, not a typo the drawer drops');
});

test('HT-WAIST: LoadSettings carries the switch - off by default, the store\'s value when set (mutant: the field misread or hard-wired)', () => {
  _resetModSettings();
  assert.equal(readTorchSettings().lanternsAtWaist, false, 'the shipped store: off');
  const defaults = Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
  assert.equal(readTorchSettings(() => ({ ...defaults, [KEY]: true })).lanternsAtWaist, true, 'a store with it on: on');
  assert.equal(readTorchSettings(() => ({ ...defaults, [KEY]: true })).lanternRelaxed, false, 'and it is its own field - Relaxed Lanterns is not turned on by it');
  assert.equal(readTorchSettings(() => ({ ...defaults, 'Handling.RelaxedLanterns': true })).lanternsAtWaist, false, 'nor it by Relaxed Lanterns');
});

test('HT-WAIST: lanternAtWaist - the ONE question: a lantern, with Handheld Torches on and the switch on; never a torch or a candle; nothing with the mod off (mutant: any leg dropped)', () => {
  _resetModSettings();
  try {
    assert.equal(lanternAtWaist(lantern()), false, 'the shipped switch is off: the lantern is held, as it always was');
    setModSetting(V, KEY, true);
    assert.equal(lanternAtWaist(lantern()), true, 'on: the lantern hangs at the waist');
    assert.equal(lanternAtWaist(torch()), false, 'a torch is still held');
    assert.equal(lanternAtWaist(candle()), false, 'a candle is still held');
    assert.equal(lanternAtWaist(null), false, 'no light, nothing at the waist');
    setModSetting(V, 'Enabled', false);
    assert.equal(lanternAtWaist(lantern()), false, 'the mod off: its switch goes with it');
  } finally { _resetModSettings(); }
});

test('HT-WAIST: the departure is RECORDED where this pane\'s others are - Handheld-Torches.md\'s own section and a Ledger A row naming the key and the files (mutant: a record dropped)', () => {
  const arc = read('bible/06-Systems/Handheld-Torches.md');
  assert.match(arc, /^## HT-WAIST - THE LANTERN AT THE WAIST/m, 'the arc page has the section');
  assert.match(arc, /Handling\.LanternsAtWaist/);
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  const lo = ledger.indexOf('## A. Approved departures from DFU');
  const hi = ledger.indexOf('## A-note (H1)');
  const a = ledger.slice(lo, hi);
  const row = a.split('\n').find((l) => l.startsWith('|') && /HT-WAIST/.test(l));
  assert.ok(row, 'a section-A row');
  assert.match(row, /Handling\.LanternsAtWaist/);
  for (const f of ['systems/playerTorch.js', 'systems/handheldTorches.js', 'systems/lanternSwing.js', 'combat/fpArm.js', 'player/eotbBody.js']) assert.ok(row.includes(f), `the row names ${f}`);
});
