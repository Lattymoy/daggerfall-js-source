// COMPANION-VOL (2026-10-23, the owner: "add companion moaning random screaming in idle volume option"): THE AUDIO TAB'S
// COMPANION IDLE VOLUME (systems/monsterVolume.js companionVolume) - how loud a companion's idle call is, over Monster
// Volume; a foe's call and a companion's swing keep Monster Volume alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companionVolume, monsterVolume } from '../../src/systems/monsterVolume.js';
import { tickEnemySound, playEnemyClip } from '../../src/scenes/hostCombat.js';
import { EnemySoundSource } from '../../src/characters/enemy/enemySounds.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A device that hears what is played, and at what loudness. */
const ear = () => { const heard = []; return { heard, play3d: (clip, at, vol) => heard.push(vol) }; };
/** One idle call out of a rat's source, its clock run past its longest wait. */
const call = (companion) => {
  const audio = ear();
  const rat = new EnemySoundSource(0, () => 0);
  for (let t = 0; t < 400 && !audio.heard.length; t++) tickEnemySound(rat, [0, 0, 0], [1, 0, 0], 1, { audio, companion });
  return audio.heard[0] ?? null;
};

test('COMPANION-VOL: the shelf\'s 0..1, 1 by default, 0 a value (mutants: 0 read as unset; no clamp)', () => {
  _resetForTests();
  assert.equal(companionVolume(), 1);
  setPref('companionVolume', 0);
  assert.equal(companionVolume(), 0);
  setPref('companionVolume', 0.25);
  assert.equal(companionVolume(), 0.25);
  setPref('companionVolume', 4);
  assert.equal(companionVolume(), 1);
  _resetForTests();
});

test('COMPANION-VOL: a companion\'s idle call is played at its volume times Monster Volume, and at 0 not at all; a foe\'s call and any swing keep Monster Volume alone (mutants: the foe scaled; the companion unscaled; a muted call played at 0)', () => {
  _resetForTests();
  const loud = call(true);
  assert.ok(loud > 0, 'a companion calls');
  setPref('companionVolume', 0.5);
  assert.equal(call(true), loud * 0.5, 'at half');
  setPref('monsterVolume', 0.5);
  assert.equal(call(true), loud * 0.25, 'over Monster Volume');
  assert.equal(call(false), loud * 0.5, 'a foe\'s call: Monster Volume alone');
  setPref('companionVolume', 0);
  assert.equal(call(true), null, 'muted: never played');
  const audio = ear();
  playEnemyClip(audio, { clip: 1, volume: 1 }, [0, 0, 0]);
  assert.deepEqual(audio.heard, [monsterVolume()], 'a swing\'s clip: Monster Volume alone');
  _resetForTests();
});

test('COMPANION-VOL wired (by source): the Audio tab\'s Volume section names the row after Monster Volume, the menu draws it as Monster Volume\'s row is drawn, and the shelf defaults it (mutants: the row unlisted; a second row shape)', () => {
  assert.match(src('src/ui/settings/settingsMap.js'), /"Controls\/MusicVolume", "port:monsterVolume", "port:companionVolume"[,\]]/);   // HORSE-VOL: Horse and Animal Volume may follow
  const m = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(m, /return \[row, monsterVolumeRow\(\), companionVolumeRow\(\)[,\]]/);
  assert.match(m, /function companionVolumeRow\(\) \{\n\s*return volumeRow\('companionVolume', t\('menu\.audio\.companionVolume', COMPANION_VOLUME_NAME\),/);
  assert.match(m, /function monsterVolumeRow\(\) \{\n\s*return volumeRow\('monsterVolume',/);
  assert.match(src('src/systems/uiPrefs.js'), /companionVolume: 1,/);
});
