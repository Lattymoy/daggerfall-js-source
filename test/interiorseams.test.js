// IH1 - THE LAST FOUR PENDING SEAMS (2026-08-28). audit24_questseams'
// PENDING map is EMPTY of M-X rows now: %cbd (the current building's
// name), %nt (the random tavern), Place's isHouseOwned residence
// filter and its buildingNameOpts bag all answered by the world host.
// The name bag is townTalk's ONE nameOpts() - extracted so the quest
// world's generated names and the talk directory's cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getContextValue } from '../src/systems/quest/questMacros.js';

const read = (p) => readFileSync(p, 'utf8');

// ── the macro flows ──────────────────────────────────────────────

test('IH1 %cbd: the hook\'s answer inside, DFU\'s "[invalid]" outside (:851-854)', () => {
  assert.equal(getContextValue('%cbd', null, { world: { currentBuildingName: () => 'The Odd Blades' } }),
    'The Odd Blades');
  // outside a building the hook answers null and the HANDLER supplies
  // C#'s own literal - the world does not spell it
  assert.equal(getContextValue('%cbd', null, { world: { currentBuildingName: () => null } }),
    '[invalid]');
});

test('IH1 %nt: the hook\'s tavern, straight through', () => {
  assert.equal(getContextValue('%nt', null, { world: { randomTavernName: () => 'The Howling Stag' } }),
    'The Howling Stag');
});

// ── the world mounts, source-pinned ──────────────────────────────

test('IH1 world: %cbd regenerates the interior building through the ONE name bag', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const b = modes\?\.interiorBuilding;\s*\n\s*if \(!b\) return null;/,
    'outside a building the hook answers null - the handler owns "[invalid]"');
  assert.match(world, /generateBuildingName\(b\.nameSeed, b\.buildingType,\s*\n\s*\{ \.\.\.\(townTalk\.nameOpts\?\.\(\) \?\? \{\}\), factionId: b\.factionId \?\? 0 \}\)/,
    'the same seed, type and faction the building carries, over townTalk\'s bag');
});

test('IH1 world: %nt picks a tavern uniformly from the directory, "tavern" when there is none', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /randomTavernName: \(roll = Math\.random\) =>/,
    'the ENGINE-PRNG rule: a UnityEngine.Random draw rides an injectable uniform roll');
  assert.match(world, /\.filter\(\(b\) => b\.buildingType === TALK_BUILDING_TYPES\.Tavern\)/,
    'MacroHelper.cs:635 - GetBuildingsOfType(Tavern)');
  assert.match(world, /if \(!taverns\.length\) return 'tavern';/,
    ':641 - the localized fallback when the location has no tavern');
  assert.match(world, /taverns\[Math\.floor\(roll\(\) \* taverns\.length\)\]\?\.name \?\? 'tavern'/,
    ':636 - Random.Range(0, taverns.Count)');
});

test('IH1 world: isHouseOwned is banking\'s law over the CURRENT region; the bag is townTalk\'s', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /isHouseOwned: \(buildingKey\) => isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey\)/,
    'DaggerfallBankManager.IsHouseOwned (:140-148) reads Houses[CurrentLocation.RegionIndex]');
  assert.match(world, /buildingNameOpts: \(\) => townTalk\.nameOpts\?\.\(\) \?\? \{\}/,
    'Place\'s _getBuildingName rides the one bag');
});

test('IH1 townTalk: ONE name bag - nameOpts() extracted, the directory built FROM it, both exposed', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /function nameOpts\(\) \{/, 'the bag has a name');
  assert.match(tt, /const opts = nameOpts\(\);\s*\n\s*if \(!opts\) return;\s*\n\s*directory = buildBuildingDirectory\(topics\.exteriorBuildings, topics\.blocks, opts\)/,
    'rebuildDirectory consumes the SAME bag - no second copy of the regent/bank/palace laws');
  assert.equal((tt.match(/regentRuler:/g) ?? []).length, 1, 'the bag literal exists exactly once');
  assert.match(tt, /\n    nameOpts,\n/, 'the api hands the bag out');
  assert.match(tt, /get buildingDirectory\(\) \{ return directory; \}/, 'and the directory the tavern pick reads');
});
