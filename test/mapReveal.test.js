// T4: the 35% map-reveal (TalkManager.GetKeySubjectBuildingHint
// :1707-1723 + MacroHelper's %loc mark, :1085-1090), the PlayerGPS
// building-discovery store it writes (PlayerGPS.cs:917-975), and the
// %hnr/%ra macro literals (TalkManager.GetHonoric :1826-1832,
// MacroHelper.PlayerRace :942-945).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildingHint, CHANCE_TO_REVEAL_LOCATION_ON_MAP,
  MAP_REVEAL_TEXT_ID, DIRECTION_TEXT_ID,
} from '../src/systems/talkTopics.js';
import {
  discoverBuilding, hasDiscoveredBuilding, discoveredBuildings,
  snapshotDiscovery, restoreDiscovery,
} from '../src/systems/discovery.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import {
  honorificOf, raceDisplayName, RACE_DISPLAY_NAME, expandAnswerRecord,
} from '../src/systems/talkSession.js';
import { TextRsc } from '../src/formats/textRsc.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('T4: the hint fork - reveal at or under 0.35, directions past it, NEVER inside', () => {
  assert.equal(CHANCE_TO_REVEAL_LOCATION_ON_MAP, 0.35);   // TalkManager.cs:123
  assert.equal(MAP_REVEAL_TEXT_ID, 7332);
  assert.equal(DIRECTION_TEXT_ID, 7333);
  // DFU tests `randomFloat > Chance` for the DIRECTION arm, so a roll
  // landing exactly ON the chance still reveals - a >= mutant fails here.
  assert.deepEqual(buildingHint(() => 0.35), { reveal: true, textId: 7332 });
  assert.deepEqual(buildingHint(() => 0.36), { reveal: false, textId: 7333 });
  assert.deepEqual(buildingHint(() => 0), { reveal: true, textId: 7332 });
  assert.deepEqual(buildingHint(() => 0.999), { reveal: false, textId: 7333 });
  // ...and IsPlayerInside forces directions whatever the roll (:1713).
  assert.deepEqual(buildingHint(() => 0, true), { reveal: false, textId: 7333 });
});

test('T4: the discovery store - the record lands whole, once, per location', () => {
  restoreDiscovery(null);   // a clean store for the pins
  const shelf = { name: 'The Odd Blades', buildingKey: 66051, factionId: 0, quality: 12, buildingType: 9, position: [1, 0, 2] };
  assert.equal(hasDiscoveredBuilding('17:Daggerfall', 66051), false);
  assert.equal(discoverBuilding('17:Daggerfall', shelf), true);
  assert.equal(hasDiscoveredBuilding('17:Daggerfall', 66051), true);
  // The DiscoveredBuilding columns this port has sources for
  // (PlayerGPS.cs:92-103 minus the quest/lockpick extras).
  assert.deepEqual(discoveredBuildings('17:Daggerfall'), [{
    buildingKey: 66051, displayName: 'The Odd Blades', factionId: 0, quality: 12, buildingType: 9,
  }]);
  // Already discovered is a no-op (:926-928 - the override arm pends quests).
  assert.equal(discoverBuilding('17:Daggerfall', { ...shelf, name: 'Renamed' }), false);
  assert.equal(discoveredBuildings('17:Daggerfall')[0].displayName, 'The Odd Blades');
  // The same buildingKey in ANOTHER location is its own discovery -
  // DFU namespaces by map pixel (:936); the port by the location id.
  assert.equal(hasDiscoveredBuilding('17:Wayrest', 66051), false);
  assert.equal(discoverBuilding('17:Wayrest', shelf), true);
  assert.equal(discoveredBuildings('17:Wayrest').length, 1);
});

test('T4: discovery rides the save envelope, and a pre-T4 save restores empty', () => {
  restoreDiscovery(null);
  discoverBuilding('17:Daggerfall', { name: 'Vintage Elixirs', buildingKey: 7, factionId: 0, quality: 8, buildingType: 2 });
  const entity = { stats: { endurance: 50 }, skills: [], skillUses: [], items: [], spells: [] };
  const snap = snapshotPlayer(entity, {});
  assert.equal(snap.discovery['17:Daggerfall'][7].displayName, 'Vintage Elixirs');
  // The snapshot is a COPY, not an alias into the live store.
  discoverBuilding('17:Daggerfall', { name: 'Second Shop', buildingKey: 8, buildingType: 2 });
  assert.equal(snap.discovery['17:Daggerfall'][8], undefined);
  // A load REPLACES the store with the envelope's state...
  restorePlayer({ stats: {} }, snap);
  assert.equal(hasDiscoveredBuilding('17:Daggerfall', 7), true);
  assert.equal(hasDiscoveredBuilding('17:Daggerfall', 8), false, 'the post-snapshot discovery is gone after the load');
  // ...and a save from before this field restores an empty store.
  delete snap.discovery;
  restorePlayer({ stats: {} }, snap);
  assert.equal(hasDiscoveredBuilding('17:Daggerfall', 7), false);
  restoreDiscovery(null);   // leave the module clean for other suites
});

test('T4: %hnr by gender and %ra by BIRTH race - the DFU display names, elves in two words', () => {
  assert.equal(honorificOf('male'), 'Sir');
  assert.equal(honorificOf('female'), "Ma'am");
  assert.deepEqual(RACE_DISPLAY_NAME, {
    Breton: 'Breton', Redguard: 'Redguard', Nord: 'Nord', DarkElf: 'Dark Elf',
    HighElf: 'High Elf', WoodElf: 'Wood Elf', Khajiit: 'Khajiit', Argonian: 'Argonian',
  });
  assert.equal(raceDisplayName('DarkElf'), 'Dark Elf');
  assert.equal(
    expandAnswerRecord("Beggin' yer pardon %hnr, I'm a %ra too.", { honorific: honorificOf('female'), race: raceDisplayName('WoodElf') }),
    "Beggin' yer pardon Ma'am, I'm a Wood Elf too.");
});

test('T4: the townTalk seam is wired - the lazy %hnt gate, the mark, the entity macros', () => {
  // The hosts have no execution coverage (AUDIT 18's standing gap), so
  // the wiring is pinned at the source, the audit18 idiom.
  const src = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(src, /raw\.includes\('%hnt'\)/, 'the fork must be LAZY - a refusal record never rolls or marks');
  assert.match(src, /buildingHint\(rolls/, 'the reveal roll rides the seam-injectable rolls');
  assert.match(src, /if \(h\.reveal\) discoverBuilding\(/, 'the %loc mark side effect fires only on the reveal arm');
  assert.match(src, /honorific: honorificOf\(playerEntity\.gender\)/, '%hnr reads the entity');
  assert.match(src, /race: raceDisplayName\(playerEntity\.race\)/, '%ra reads the entity');
});

test('T4: TEXT.RSC grounds the record ids - 7332 marks the map, 7333 gives directions', { skip: skipReal }, () => {
  const t = new TextRsc().load(readFileSync(join(ARENA2, 'TEXT.RSC')));
  const reveal = t.plainText(MAP_REVEAL_TEXT_ID);
  const directions = t.plainText(DIRECTION_TEXT_ID);
  assert.equal(reveal.length, 7);
  assert.ok(reveal.every((v) => v.includes('%loc') && /map/i.test(v)), 'every 7332 variant names %loc on the map');
  assert.ok(reveal.every((v) => !v.includes('%di')), 'the reveal set carries no compass macro');
  assert.equal(directions.length, 9);
  assert.ok(directions.every((v) => v.includes('%di')), 'every 7333 variant is a compass direction');
});
