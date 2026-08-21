// THE SETTINGS SURFACE (Ledger section A, recorded 2026-08-21): the
// port has no settings store and no settings UI, so every
// DaggerfallUnity.Settings.* value our code branches on is a PINNED
// CONSTANT with a citation. These pins make that row enforceable:
// flipping a value in code without moving the Ledger fails here, and
// so does dropping a setting out of the row.
//
// DFU's shipped defaults are read from Assets/Resources/defaults.ini.txt
// and quoted in the row; the ONE deliberate divergence is
// EnhancedCombatAI (DFU ships True, we implement the classic False
// path), which the row states and the third test holds to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMBAT_VOICES } from '../src/combat/combatVoices.js';
import { FIELD_OF_VIEW } from '../src/characters/enemyMotor.js';
import { assignStartingGear } from '../src/systems/startingGear.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ledger = () => readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

/** The eight settings the port branches on: DFU's shipped default and
 *  the value we pin. Seven match; EnhancedCombatAI is the divergence. */
const PINNED = Object.freeze([
  { name: 'CombatVoices', dfuDefault: true, ours: true },
  { name: 'AdvancedClimbing', dfuDefault: false, ours: false },
  { name: 'PlayerTorchFromItems', dfuDefault: false, ours: false },
  { name: 'BowDrawback', dfuDefault: false, ours: false },
  { name: 'MeleeAttackDetection', dfuDefault: 0, ours: 0 },
  { name: 'WeaponSwingMode', dfuDefault: 0, ours: 0 },
  { name: 'SmallerDungeons', dfuDefault: false, ours: false },
  { name: 'LargeHUD', dfuDefault: false, ours: false },
  { name: 'EnhancedCombatAI', dfuDefault: true, ours: false },   // THE divergence
]);

test('settings: the pinned VALUES are what the code actually does', () => {
  // CombatVoices ships enabled and we match it
  assert.equal(COMBAT_VOICES, true, 'COMBAT_VOICES is DFU CombatVoices=True');
  // EnhancedCombatAI=false is observable: the classic 180 FOV, not 190
  // (EnemySenses.cs:239-241 widens it only on the enhanced path)
  assert.equal(FIELD_OF_VIEW, 180, 'the classic FOV - 190 would mean EnhancedCombatAI');
  // PlayerTorchFromItems defaults OFF: a fresh kit carries no torch
  const e = { items: [], stats: {}, skills: [] };
  assignStartingGear(e, { classIndex: 0, rolls: () => 0 });
  const torches = e.items.filter((it) => it.group === 'UselessItems2');
  assert.equal(torches.length, 0, 'no torches without the setting (DFU default False)');
  // ...and the seam still exists, so turning it on is one argument
  const e2 = { items: [], stats: {}, skills: [] };
  assignStartingGear(e2, { classIndex: 0, rolls: () => 0, torchesFromItems: true });
  assert.ok(e2.items.some((it) => it.group === 'UselessItems2'), 'the setting is a seam, not a deletion');
});

test('settings: every pinned setting is NAMED in the Ledger row', () => {
  const l = ledger();
  const i = l.indexOf('THE SETTINGS SURFACE');
  assert.ok(i > 0, 'the section A settings row exists');
  const row = l.slice(i, l.indexOf('\n', i));
  for (const { name } of PINNED) {
    assert.ok(row.includes(name), `the Ledger row must name ${name}`);
  }
  // the row must carry DFU's own default for the divergence, or the
  // reader cannot tell it IS one
  assert.ok(/EnhancedCombatAI[^|]*SHIPS TRUE/i.test(row), "the row states DFU's shipped value");
  assert.ok(row.includes('defaults.ini.txt'), 'and cites where the defaults come from');
});

test('settings: no NEW setting citation appears in src/ without a Ledger row', () => {
  // The audit18_bible_docs idiom, applied to settings: re-derive the
  // list of DaggerfallUnity.Settings.* names cited under src/ and
  // require each to be named in the row. A new branch on a setting
  // that nobody ledgered fails here rather than at a playtest.
  const files = [
    'combat/combatVoices.js', 'combat/playerWeapon.js', 'characters/enemyAttack.js',
    'characters/enemyCasting.js', 'characters/enemyMotor.js', 'scenes/hostCombat.js',
    'systems/playerDeath.js', 'systems/startingGear.js', 'player/cameraView.js',
    'player/climbing.js',
  ];
  const cited = new Set();
  for (const f of files) {
    for (const m of src(f).matchAll(/(?:Settings\.|DFU's |the )([A-Z][A-Za-z]{5,})\s+(?:SETTING|setting)/g)) {
      cited.add(m[1]);
    }
    for (const m of src(f).matchAll(/Settings\.([A-Za-z]+)/g)) cited.add(m[1]);
  }
  assert.ok(cited.size > 0, 'the sweep finds citations at all (it is a RULE, not a tautology)');
  const row = ledger().slice(ledger().indexOf('THE SETTINGS SURFACE'));
  const rowText = row.slice(0, row.indexOf('\n'));
  const unledgered = [...cited].filter((n) => !rowText.includes(n));
  assert.deepEqual(unledgered, [], `settings cited in src/ but absent from the Ledger row: ${unledgered.join(', ')}`);
});
