// AUDIT 24 (the full-codebase parity sweep), wave 23: THE GENERATOR
// GATE.
//
// src/characters/enemyBasics.js is 3025 lines of MobileEnemy records
// GENERATED from EnemyBasics.cs. That is better than a hand
// transcription, but only while somebody re-runs the generator: the
// tool asserted C3 parity when a human invoked it, and nothing
// invoked it in CI. So a column the extraction never looked at was
// invisible from BOTH sides - absent from the port, and absent from
// every pin, because every pin read the port.
//
// SoulPts is that column. It is on the struct
// (DaggerfallUnityStructs.cs:216, "Number of enchantment points in a
// trapped soul of this enemy"), 32 of the 62 entries set it, and
// ItemBuilder.cs:303 mints a filled soul trap as
// `newItem.value = 5000 + mobileEnemy.SoulPts`.
//
// This gate re-extracts from the vendored source with the SAME pure
// function the generator uses and deep-equals the checked-in module.
// The DFU tree is gitignored, so it skips where it is absent - the
// charter the ARENA2-backed and LootTables pins already run under.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { extractEnemyBasics, sliceEnemyTable } from '../tools/extractEnemyBasics.lib.mjs';

const ENEMY_CS = new URL('../tools/parity/dfu/Assets/Scripts/Utility/EnemyBasics.cs', import.meta.url);
const SOUND_CS = new URL('../tools/parity/dfu/Assets/Scripts/SoundClips.cs', import.meta.url);
const noDfu = !existsSync(ENEMY_CS) || !existsSync(SOUND_CS);

test('audit24 wave23: ENEMY_BASICS is what the extractor produces from EnemyBasics.cs TODAY', { skip: noDfu }, () => {
  const fresh = extractEnemyBasics(readFileSync(ENEMY_CS, 'utf8'), readFileSync(SOUND_CS, 'utf8'));
  assert.equal(Object.keys(fresh).length, 62, 'the source still holds 62 MobileEnemy records');
  assert.deepEqual(Object.keys(ENEMY_BASICS).sort(), Object.keys(fresh).sort());
  for (const id of Object.keys(fresh)) {
    assert.deepEqual(ENEMY_BASICS[id], fresh[id], `enemy ${id} matches the source`);
  }
});

test('audit24 wave23: the extraction reads every column EnemyBasics.cs actually sets', { skip: noDfu }, () => {
  // The real gate against a dropped column: enumerate the field names
  // the SOURCE assigns inside its MobileEnemy initialisers and check
  // that each one has somewhere to land. A new DFU column - or one the
  // extractor has always skipped - fails here rather than silently
  // never existing on this side.
  // through the LIBRARY's slicer, not a hand-rolled copy of it - the
  // first draft of this pin rolled its own and lost the `=== -1`
  // guard, so it scanned an empty string and passed everything.
  const table = sliceEnemyTable(readFileSync(ENEMY_CS, 'utf8'));
  const csFields = new Set();
  for (const [, f] of table.matchAll(/^\s{16}(\w+) = /gm)) csFields.add(f);
  assert.ok(csFields.size >= 25, `the scan found ${csFields.size} columns in the source - it must not be scanning nothing`);

  const portFields = new Set();
  for (const e of Object.values(ENEMY_BASICS)) for (const f of Object.keys(e)) portFields.add(f);
  const lower = (f) => f[0].toLowerCase() + f.slice(1);

  // KNOWN-DROPPED, each with the reason. Anything else is a bug.
  // Every boolean here is omitted only when FALSE - the C# struct
  // default - and every consumer reads it as `?? false`.
  const dropped = new Map([
    ['ID', 'the array index IS the key of the port object'],
    ['HasIdle', 'omitted when false'],
    ['HasRangedAttack1', 'omitted when false'],
    ['HasRangedAttack2', 'omitted when false'],
    ['HasSpellAnimation', 'omitted when false'],
    ['CanOpenDoors', 'omitted when false'],
    ['ParrySounds', 'omitted when false'],
    ['CastsMagic', 'omitted when false'],
    ['SeesThroughInvisibility', 'omitted when false'],
    ['NoShadow', 'omitted when false'],
    ['HasSeducerTransform1', 'omitted when false'],
    ['HasSeducerTransform2', 'omitted when false'],
    ['PrefersRanged', 'omitted when false'],
    ['PrefersNoise', 'omitted when false'],
  ]);

  const missing = [...csFields].filter((f) => !portFields.has(lower(f)) && !dropped.has(f));
  assert.deepEqual(missing, [], `EnemyBasics.cs sets these and the extraction drops them: ${missing.join(', ')}`);
});

test('audit24 wave23: SoulPts landed, with the values ItemBuilder reads', { skip: noDfu }, () => {
  // The column this gate was written to catch. Spot-check three the
  // C# names outright, then assert the population.
  assert.equal(ENEMY_BASICS['1'].soulPts, 1000, 'Imp - EnemyBasics.cs SoulPts = 1000');
  const withSouls = Object.values(ENEMY_BASICS).filter((e) => e.soulPts !== undefined);
  assert.equal(withSouls.length, 32, '32 of the 62 records carry soul points');
  const cs = readFileSync(ENEMY_CS, 'utf8');
  assert.equal((cs.match(/^\s*SoulPts = /gm) ?? []).length, 32, 'and the source sets it exactly 32 times');
  // an entry that does NOT set it takes the struct default of 0; the
  // port omits it, which every reader must treat as 0
  assert.equal(ENEMY_BASICS['0'].soulPts, undefined, 'the Rat has no soul (points)');
});

test('audit24 wave23: the eight columns the extraction had never looked at', { skip: noDfu }, () => {
  // Found by the gate above the moment it stopped scanning an empty
  // string. All eight have real DFU consumers; none has a port
  // consumer yet, which is exactly why nothing missed them.
  //
  //   BloodIndex               EnemyAttack.cs:332, WeaponManager.cs:572,
  //                            EnemyHealth.cs:52 - the TEXTURE.380 splash
  //   NoShadow, GlowColor      SetupDemoEnemy.cs:137-148 - the shadow
  //                            caster and the point light
  //   HasSeducerTransform1/2   DaggerfallMobileUnit.cs:850 - which
  //   SeducerTransform1/2Frames transform anim set the Lamia plays
  //   PrefersRanged            DaggerfallUnityStructs.cs:190 - the AI flag
  const withBlood = Object.entries(ENEMY_BASICS).filter(([, e]) => e.bloodIndex !== undefined);
  assert.equal(withBlood.length, 6, 'six enemies take a non-default blood splash');
  for (const [, e] of withBlood) assert.equal(e.bloodIndex, 2, 'and all six are index 2');

  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.noShadow).length, 7);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.prefersRanged).length, 1);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.hasSeducerTransform1).length, 1);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.hasSeducerTransform2).length, 1);
  assert.deepEqual(Object.values(ENEMY_BASICS).find((e) => e.seducerTransform1Frames)?.seducerTransform1Frames,
    [0, 1, 2, 3, 4, 5, 6, 7, 8]);

  // Unity's Color operator* scales EVERY channel including alpha, and
  // the 3-arg constructor leaves a = 1 - so `new Color(18, 68, 88) *
  // 0.1f` has alpha 0.1, not 1. (The channels are far outside 0..1;
  // that is DFU's own data, kept.)
  const daedroth = ENEMY_BASICS['25'];
  assert.deepEqual(daedroth.glowColor, { r: 18 * 0.1, g: 68 * 0.1, b: 88 * 0.1, a: 0.1 },
    'new Color(18, 68, 88) * 0.1f, alpha included');
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.glowColor).length, 3, 'three enemies glow');
});
