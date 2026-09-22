// MODS-ONLINE (2026-09-22, Mac: "Is it possible to allow all mods to be
// toggled on and off for online?").
//
// YES, FOR EVERY MOD THAT DRAWS ON YOUR OWN SCREEN AND NOWHERE ELSE -
// and the list is a READING of what each one touches, not a guess at
// what it sounds like.
//
// OL1's law is that a room plays one game: what one player walks
// through, another walks through. AUDIT-WH R8 drew the line inside it -
// that reasoning is about the WORLD, and a mod that "moves a light,
// stands an object, changes a roll or writes a save record" is what
// the room has to agree on, while one that draws a readout is not.
// Only `Enabled` was ever forced; a mod's other switches were always
// the player's.
//
// TWO CANDIDATES FAILED THE READING AND STAYED FORCED, which is why it
// has to be a reading:
//   - the Shield Widget SOUNDS cosmetic and carries `hitShield(damage,
//     item)` and a block coroutine. It is in the damage path, and two
//     players disagreeing about whether a blow was blocked is the room
//     disagreeing about the blow.
//   - Handheld Torches SOUNDS like a light and is an EQUIPPED ITEM in
//     the save, with a light standing in the world.
//
// This pin makes the classification total: every vendored mod is on
// one side or the other, with a reason, and a mod added tomorrow fails
// until somebody decides which it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOD_SETTINGS, modSetting } from '../src/systems/modSettings.js';
import { ONLINE_PLAYERS_OWN_MODS, ONLINE_FORCED_MOD_KEY, onlineForcedModSetting } from '../src/systems/onlineLane.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The mods the room must agree on, each with what makes it the
 *  room's. A mod is here or in ONLINE_PLAYERS_OWN_MODS - never both,
 *  never neither. */
const ROOM_MODS = Object.freeze({
  'roads-hazelnut': 'roads are ground and the paths travel follows - one player on a road and one in a field is two worlds',
  meanerMonsters: 'what a foe is: its stats and what spawns',
  pcaao: 'the combat and armour formulas behind every blow that crosses the wire',
  unleveledLoot: 'what is in a chest - a roll the room shares',
  'oblivion-remaster-leveling': 'how a character advances, which is save state',
  'travel-options': 'the journey itself, and where it puts you',
  'handheld-torches': 'an equipped item in the save, and a light standing in the world',
  'shield-widget': 'hitShield and the block coroutine - it is in the damage path',
});

test('MODS-ONLINE: every vendored mod is classified - the room\'s or the player\'s, never neither', () => {
  const all = Object.keys(MOD_SETTINGS).sort();
  const classified = [...Object.keys(ROOM_MODS), ...ONLINE_PLAYERS_OWN_MODS].sort();

  const unclassified = all.filter((m) => !classified.includes(m));
  assert.deepEqual(unclassified, [],
    'a new mod must be decided: does the room have to agree on it, or is it a readout?');

  const both = ONLINE_PLAYERS_OWN_MODS.filter((m) => m in ROOM_MODS);
  assert.deepEqual(both, [], 'a mod cannot be both');

  const ghosts = classified.filter((m) => !all.includes(m));
  assert.deepEqual(ghosts, [], 'a classification for a mod that does not exist is dead weight');
});

test('MODS-ONLINE: the player\'s mods are free online, the room\'s are forced', () => {
  for (const vendor of ONLINE_PLAYERS_OWN_MODS) {
    assert.equal(onlineForcedModSetting(vendor, ONLINE_FORCED_MOD_KEY, '?online=1'), undefined,
      `${vendor} is the player's - online must not force it`);
  }
  for (const vendor of Object.keys(ROOM_MODS)) {
    assert.equal(onlineForcedModSetting(vendor, ONLINE_FORCED_MOD_KEY, '?online=1'), true,
      `${vendor} is the room's (${ROOM_MODS[vendor]})`);
  }
  // Offline nothing is forced, either way - the lane is the only thing
  // that ever overrode the player.
  for (const vendor of [...ONLINE_PLAYERS_OWN_MODS, ...Object.keys(ROOM_MODS)]) {
    assert.equal(onlineForcedModSetting(vendor, ONLINE_FORCED_MOD_KEY, ''), undefined, `${vendor} offline is the player's`);
  }
});

test('MODS-ONLINE: only Enabled was ever forced - a mod\'s own dials stay the player\'s on both sides', () => {
  // The dials were never the lane's business, and freeing `Enabled` for
  // some mods must not quietly change that for the rest.
  assert.equal(ONLINE_FORCED_MOD_KEY, 'Enabled');
  // The dial has to come from a mod the room OWNS. The first draft of
  // this line took the first mod with a dial, which is now on the
  // player's list - and a player's mod returns undefined at the top of
  // onlineForcedModSetting before the key is ever looked at, so the
  // assertion passed whatever the key check did. A pin whose subject
  // short-circuits is not testing what it names.
  const withDials = Object.entries(MOD_SETTINGS)
    .find(([v, d]) => v in ROOM_MODS && Object.keys(d.keys).some((k) => k !== 'Enabled'));
  assert.ok(withDials, 'some mod the ROOM owns has a dial besides Enabled');
  const [vendor, def] = withDials;
  const dial = Object.keys(def.keys).find((k) => k !== 'Enabled');
  assert.equal(onlineForcedModSetting(vendor, dial, '?online=1'), undefined,
    'a dial is nobody else\'s business, online or not - even on a mod the room owns');
});

test('MODS-ONLINE: a mod the player owns reaches no wire, no save and no roll', () => {
  // THE READING, held by execution rather than by the note above it. A
  // module that would desync the room is one that puts something on
  // the wire, writes a save record, or draws from a shared roll - so a
  // player's mod whose own modules start doing any of that fails here
  // before a player finds it as two worlds.
  const OWN_MODULES = {
    'dynamic-skies': ['src/systems/dynamicSkies.js'],
    'seasons-iliac-bay': ['src/systems/seasonsIliacBay.js'],
    'weapon-widget': ['src/combat/weaponWidgetMotion.js'],
    'eye-of-the-beholder': ['src/player/eotbBody.js', 'src/player/eotbCamera.js'],
    'ambient-text': ['src/systems/ambientText.js'],
    'immersive-footsteps': ['src/systems/immersiveFootsteps.js'],
    'better-ambience': ['src/systems/betterAmbience.js'],
  };
  const BANNED = /\bsendWorld\b|\bsendAct\b|from '\.\.\/net\/|getSaveData|restoreSaveData|snapshotPlayer/;

  for (const [vendor, files] of Object.entries(OWN_MODULES)) {
    assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(vendor), `${vendor} is on the player's list`);
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8')
        .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      assert.ok(!BANNED.test(src),
        `${f} is a player's mod and must not reach the wire or the save`);
    }
  }
});
