// MACRO-ONE (2026-09-22, Mac: "some npc dialogue and ui prompts are
// coming up with references instead of referenced items (%ra, %cr)" -
// "a recurring issue with a lot of things"). THE ONE GAMEMANAGER.
//
// DFU resolves a global macro (the player's race, the region, the date)
// off singletons whoever shows the text. The port's table reads the same
// facts off a quest machine's hooks, and only walks that were HANDED
// `questBridge.machine.macroContext()` could reach them - every walk that
// passed a bare value map left %ra, %crn, %cn on screen. The bridge now
// registers the world once and every walk falls back to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandMacroValues, expandRowValues, setMacroWorld, macroWorld } from '../src/systems/quest/questMacros.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const world = () => ({
  nowSeconds: () => 0,
  hooks: {
    playerName: () => 'Aldric Vane',
    playerRaceName: () => 'Dark Elf',
    world: {
      currentRegionIndex: () => 17,
      maps: { getRegion: (i) => (i === 17 ? { name: 'Daggerfall' } : null) },
      currentLocation: () => ({ loaded: true, name: 'Gothway Garden' }),
    },
  },
});

test('MACRO-ONE: a walk handed only a value map resolves the WORLD’S rows too', () => {
  setMacroWorld(world);
  try {
    const out = expandMacroValues('%pcf the %ra, welcome to %cn in %crn. %zzz', { pcf: 'Al' });
    assert.equal(out, 'Al the Dark Elf, welcome to Gothway Garden in Daggerfall. %zzz',
      'the map wins its own symbol, the world answers the rest, an unknown token stays verbatim');
    assert.deepEqual(expandRowValues([{ text: 'A %ra.', center: true }, 'In %crn.'], null, null),
      [{ text: 'A Dark Elf.', center: true }, 'In Daggerfall.'], 'the row walk takes the world with no values of its own');
  } finally { setMacroWorld(null); }
});

test('MACRO-ONE: the world never trades a raw token for an error shape, and a missing world costs nothing', () => {
  setMacroWorld(world);
  try {
    // subject-bound rows: the world has no speaker, guild or temple, so
    // they stay for the caller - never an error shape, never a random name
    assert.equal(expandMacroValues('Praise %god.', {}), 'Praise %god.', 'no "[nullMCP]" from the fallback');
    assert.equal(expandMacroValues('I am %n of the %fon.', {}), 'I am %n of the %fon.', 'the world does not invent a speaker');
    assert.equal(expandMacroValues('I am %n.', { n: 'Lord Kain' }), 'I am Lord Kain.', 'the caller who knows the speaker still names him');
  } finally { setMacroWorld(null); }
  assert.equal(macroWorld(), null);
  assert.equal(expandMacroValues('A %ra.', {}), 'A %ra.', 'no world registered: verbatim, exactly as before');
  setMacroWorld(() => ({ hooks: { playerRaceName: () => { throw new Error('entity gone'); } } }));
  try {
    assert.equal(expandMacroValues('A %ra.', {}), 'A %ra.', 'a hook that throws costs its token, never the box');
  } finally { setMacroWorld(null); }
  setMacroWorld(() => { throw new Error('torn down'); });
  try {
    assert.equal(expandMacroValues('A %ra.', {}), 'A %ra.', 'a throwing provider is no context, never a crash');
  } finally { setMacroWorld(null); }
});

test('MACRO-ONE: the bridge registers its machine as the world, in every host that builds one', () => {
  assert.match(read('src/scenes/questBridge.js'), /setMacroWorld\(\(\) => machine\.macroContext\(\)\);/);
  // both hosts that build a bridge hand it %ra's source
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(f), /playerRaceName: \(\) => \(playerEntity\.race \? raceDisplayName\(playerEntity\.race\) : null\)/, `${f} wires %ra`);
  }
});
