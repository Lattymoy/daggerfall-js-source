// FT8 - ENHANCED COMBAT VISUALS, THE LAST ROW LEAVES THE ENHANCED
// CATEGORY (2026-09-14, the Features arc). ECV1's switch moves to the
// home; the Settings category it emptied becomes a POINTER to the home
// (the rail-hole law: a category that vanished would teach the player
// its switches vanished) and keeps the outdoors test door, which is a
// test door and not a switch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, checkFeature, featureForControl, featureCounts } from '../../src/systems/features.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { combatVisualsOn } from '../../src/systems/combatVisuals.js';
import { CATEGORIES } from '../../src/ui/settings/settingsMap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT8: the registry row - Enhanced, over the pref, on by default, taking effect at once', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-combat-visuals');
  assert.ok(f); assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedCombatVisuals', initial: true, online: true });   // RF4
  assert.equal(PREF_DEFAULTS.enhancedCombatVisuals, true);
  assert.equal(f.effect, 'Takes effect at once.', 'read once per frame by every foe host - no reload');
  assert.match(f.note, /Off hides them as the original does/); assert.match(f.note, /The rules don’t change/);
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'enhancedCombatVisuals'), f);
  // the switch's law is untouched: the kill door, the skin, the pref (ECV1)
  assert.equal(combatVisualsOn('', true), true); assert.equal(combatVisualsOn('', false), false);
  assert.equal(combatVisualsOn('?combatvisuals=off', true), false); assert.equal(combatVisualsOn('?skin=classic', true), false);
  for (const h of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) assert.match(read(h), /const ecvOn = combatVisualsOn\(\);/, `${h} reads the switch once per frame`);
});

test('FT8/FT12: the Enhanced category emptied into the home and then left the settings rail; its test door is the Test Room\'s', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.ok(!/function portRowsEnhanced\(|function featuresPointerRow\(/.test(menu), 'FT12: no category, no pointer - the rail has no Enhanced entry to point from');
  assert.equal(CATEGORIES.find((c) => c.id === 'enhanced'), undefined, 'gone from the category map');
  const test = menu.slice(menu.indexOf('function paneTest('), menu.indexOf('\n}', menu.indexOf('function paneTest(')));
  assert.match(test, /outdoors\.append\(outdoorsTestRow\(\)\);/, 'the outdoors test door is the Test Room\'s');
  // the home holds every switch the category ever drew
  assert.deepEqual(featureCounts(FEATURES).enhanced, 64);   // PIN MOVED (RESOURCE-HIGHLIGHTS, 2026-10-26): Resource highlights; BEAST-BOOTS's Beast Footwear and Beast Helmets (2026-10-24); MW-DETAIL's Morrowind Model Detail (2026-10-22), met at the merge with EVENTS1's Event board (2026-10-23); NPC-MARKS' Morrowind People Marks (2026-10-21); QL1's Questlines (2026-10-19), met at the merge with BANTHA1's Jungle of Bantha and BODY-MOTION's Morrowind Body Motion (2026-10-18), met at the merge; WEAPON-GLOW1's Weapon glow (2026-10-16); UI-CALM's Calm HUD (2026-10-14); BODY-CARD's Billboard Look (2026-10-14); STEED1's Horse care and WAGONS4's Wagon upkeep (2026-10-11); MWNPC5b's Morrowind People (2026-10-09, at MW-NPC's merge of main); RW1's Real windows (2026-10-09); TAMRIEL2's Land beyond the Bay and TAMRIEL1's Tamriel on the map (2026-10-08); WATER-NEXT's Water quality (2026-10-07, at the Super Dungeons arc's merge of main); MW-SPELLFX1's Morrowind spell effects (2026-10-07, at the Super Dungeons arc's merge of main); VERGE1's clear roadsides and ECOTONE1's blended climates (2026-10-07); LANDFORM1's landforms (2026-10-06); MW-STEEL1's Steel Helm (2026-10-06); SD-ONLINE (2026-10-05): the world's dungeon sizes; LW2's living world (2026-10-04); THE DELVE ARC (2026-10-05): medium dungeons, the look round, the lever echoes, the way out, the quest guidance tiers; LOAD1's loading screens (2026-10-05); FIELD BUGS 2026-10-04e: WILD-ROAD's encounters on the road (2026-10-04); NEARBY-QUESTS (2026-10-04); FOREST1's real forests; CLIMB1's enhanced climbing; GUIDE5's quest marks; GUIDE4's quest tracker; GUIDE3's quest herald; NAV's naval combat (2026-09-28); IIL1-T's modded lighting; EM3-3D's 3D dungeon map; PERF-SCALE's render scale; FT18: 27 less six - ten rows condensed into four (grass 2, wind 2, quick slots 2, blood 4), every switch still on a tile or in its drawer; DISC19-F's town watch, HB1's quickbar-or-hotbar switch, MAP-TOGGLE's enhanced map, QUICK-LOOT B4's take-from-the-plaque, GRASS-PX's grass style, BLOOD2g's gore dial, BLOOD2e's lens, FT4-FT8's seven, LR1's loot rarity, WIND3's three, WEATHER2b's field, EL1's lighting, QS's diamond, MAC-I's first-person lighting, CAMP1's camps & packs, SURV2's survival arc, GRAIN2's ground sharpness (which is BOTH kinds - the tile array is the classic lane's terrain too), BLOOD1a's blood marks, BLOOD1b's overkill
});
