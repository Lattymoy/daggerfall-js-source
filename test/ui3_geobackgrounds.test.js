import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { paperDollBackground, REGION_BACKGROUND_CHARS } from '../src/ui/paperDoll.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// UI3 - GEOGRAPHIC BACKGROUNDS (PaperDoll.GetPaperDollBackground
// :203-230). `EnableGeographicBackgrounds` ships FALSE, so DFU's
// DEFAULT paperdoll backdrop is the RACE's - and the port has passed
// `context = 'town'` since U8f, which is the geographic answer. Every
// player has been looking at the town backdrop.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const RACE = 'SCBG00I0.IMG';

test('UI3: OFF (the shipped default) - the RACE\'s background, whatever the context says', () => {
  resetToDefaults();
  for (const where of [{}, { inTown: true }, { inDungeon: true }, { inGraveyard: true }, { region: 23 }]) {
    assert.equal(paperDollBackground(RACE, where), RACE, JSON.stringify(where));
  }
});

test('UI3: ON - town, then dungeon, then graveyard, then the region\'s own char (:219-227)', () => {
  const on = { enabled: true, region: 23 };
  assert.equal(paperDollBackground(RACE, { ...on, inTown: true }), 'SCBG04I0.IMG');
  assert.equal(paperDollBackground(RACE, { ...on, inDungeon: true }), 'SCBG07I0.IMG');
  assert.equal(paperDollBackground(RACE, { ...on, inGraveyard: true }), 'SCBG08I0.IMG');
  // The order is a chain of else-ifs: a town that is also a graveyard is a town.
  assert.equal(paperDollBackground(RACE, { ...on, inTown: true, inDungeon: true, inGraveyard: true }), 'SCBG04I0.IMG');
  assert.equal(paperDollBackground(RACE, { ...on, inDungeon: true, inGraveyard: true }), 'SCBG07I0.IMG');
  // Region 23's char is '6'.
  assert.equal(REGION_BACKGROUND_CHARS[23], '6');
  assert.equal(paperDollBackground(RACE, on), 'SCBG06I0.IMG');
  assert.equal(paperDollBackground(RACE, { enabled: true, region: 0 }), 'SCBG03I0.IMG', 'region 0 is \'3\'');
});

test('UI3: the region table is DFU\'s 62 - one per Daggerfall region - and an out-of-range index takes the RACE\'s', () => {
  assert.equal(REGION_BACKGROUND_CHARS.length, 62);
  assert.deepEqual(REGION_BACKGROUND_CHARS.slice(0, 8), ['3', '1', '2', '2', '2', '0', '5', '1']);
  assert.deepEqual(REGION_BACKGROUND_CHARS.slice(-4), ['0', '0', '2', '3']);
  // The guard runs BEFORE the town/dungeon arms, so a bad region gives
  // the race's background even standing in a town (:215-216).
  assert.equal(paperDollBackground(RACE, { enabled: true, region: -1, inTown: true }), RACE);
  assert.equal(paperDollBackground(RACE, { enabled: true, region: 62, inTown: true }), RACE);
  assert.equal(paperDollBackground(RACE, { enabled: true, region: 5, regionCount: 3 }), RACE, 'the READER\'s count bounds it too');
});

test('UI3: the setting is read live, is LIVE, and the loader asks it rather than the caller\'s context word', () => {
  resetToDefaults();
  assert.equal(paperDollBackground(RACE, { region: 23, inTown: true }), RACE);
  setValue('GUI', 'EnableGeographicBackgrounds', true);
  assert.equal(paperDollBackground(RACE, { region: 23, inTown: true }), 'SCBG04I0.IMG', 'read live');
  resetToDefaults();
  assert.equal(LIVE['GUI/EnableGeographicBackgrounds'], 'src/ui/paperDoll.js');
  const doll = read('src/ui/paperDoll.js');
  assert.match(doll, /bg: await loadImgBmp\(paperDollBackground\(art\.background, \{/);
  assert.doesNotMatch(doll, /loadImgBmp\(CONTEXT_BG\[context\]/, 'the old unconditional context lookup is gone');
});

test('UI3: the world host supplies the region, through HOISTED helpers (the boot-order trap)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /return \{ region: maps\.getPoliticIndex\(px\.x, px\.y\) - 128, regionCount: maps\.regionCount \};/,
    'GetPoliticIndex - 128, as DFU computes it (:214)');
  assert.match(world, /preloadPaperDollArt\(\{ renderer, fetchBytes, palette, getTexture \}, \{ where: paperDollWhere\(\) \}\)/);
  // The boot preload runs at the TOP of bootWorld and reaches both
  // helpers, so neither may be a `const` - that is the temporal dead
  // zone that took the site down the same day.
  assert.match(world, /function paperDollWhere\(\) \{/);
  assert.match(world, /function playerTravelPixel\(\) \{/);
  assert.doesNotMatch(world, /const paperDollWhere =/);
  assert.doesNotMatch(world, /const playerTravelPixel =/);
});
