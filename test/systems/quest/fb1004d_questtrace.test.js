// QUEST-TRACE (FIELD BUGS 2026-10-04d, the Discord, 2026-10-04: "my letter says for me to steal priests Robes from
// Hawkton residence and i did it.. it should give me another letter with where should i go to bring the quest item and go
// on, but i didn't get the letter and nothing changed in quest dialog.. so i can't do my Class guild promotion quest";
// the letter on screen "Steal the Priestess Robes from The Hawkton Residence in Moorham Manor", the robes the player's
// paperdoll wears "Priest Robes").
//
// The letter is the Thieves Guild's invitation, O0A0AL00 (crimeGuilds.js THIEVES_GUILD_INITIATION_QUEST): `Item _clothing_
// womens_clothing`, `Place _mansion_ remote house1`, `place item _clothing_ at _mansion_`, and `clicked item _clothing_
// say 1018` / `get item _note_` - the note that names the thief to bring the robes to is the "another letter". Driven
// here whole, over the real parser and machine, in Beautiful Villages' own Moorham Manor (Shalgora; the vendored pack's
// location-42-177: its building list and grid, its blocks' building lists and subrecords - the author's interiors are
// carried whole, and an interior the pack names by reference into the player's BLOCKS.BSA stands in empty, since there
// is no game data here, which leaves the farmhouse FARMAA09 #0, a House1, with the author's own markers):
//  - THE QUEST IS SOUND. The robes stand at the house's 199.18 marker, and the one way a stood quest item is taken
//    (QuestResourceBehaviour.DoClick) hands them over, says 1018 and gives the note.
//  - THE ROBES ON THE PAPERDOLL ARE THE HOUSE'S. StockHouseContainer mints clothing by the PLAYER's gender
//    (CreateRandomClothing), so one wardrobe roll is Priestess Robes to a woman and Priest Robes to a man - while
//    `womens_clothing` is women's clothing for every character. Priest Robes (164) is no record O0A0AL00 can mint.
//  - THE NAME: the robes the letter sends for were nameless under the crosshair - main's WHERE-ROBES (FIELD BUGS
//    2026-10-04c, ROBES-NAME) landed that fix first, with its pins (test/systems/fb1004c_robes.test.js); this branch's copy of it
//    was withdrawn at the merge, and these two traces are kept as the record's regression pins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import zlib from 'node:zlib';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import { addQuestResourceObjects, markerScenePosition } from '../../../src/systems/quest/sceneMount.js';
import { SITE_TYPES, MARKER_TYPES } from '../../../src/systems/quest/place.js';
import { blockFromJson, buildingDataFromJson } from '../../../src/formats/worldData/worldDataReplacement.js';
import { ROW_CODECS } from '../../../src/formats/worldData/worldDataPack.js';
import { patchJson } from '../../../src/formats/worldData/worldDataJson.js';
import { templateByIndex, ITEM_TEMPLATES } from '../../../src/systems/item/itemTemplates.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { stockHouseContainer } from '../../../src/systems/shopStock.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import * as worldTooltips from '../../../src/systems/worldTooltips.js';   // looked up, so a tree without the namer fails its pin, not the file

const ROOT = new URL('../../../', import.meta.url);
const rd = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(new URL('vendor/dfu-quests/Tables/', ROOT))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(`vendor/dfu-quests/Tables/${f}`);
  loadQuestTables(sources);
}
const SCRIPT = rd('vendor/dfu-quests/Quests/O0A0AL00.txt').split(/\r?\n/);
const PRIEST_ROBES = 164, PRIESTESS_ROBES = 201;   // MensClothing / WomensClothing, itemTemplates.json

// ---- Beautiful Villages' Moorham Manor, out of the vendored pack ----

const PACK = JSON.parse(zlib.gunzipSync(readFileSync(new URL('vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', ROOT))).toString('utf8'));
const entry = (name) => { const e = PACK.files[name]; return typeof e === 'string' ? JSON.parse(e) : e; };
const CLASSIC = Symbol('a piece of the player\'s BLOCKS.BSA');
/** A pack value with its nodes, rows and runs expanded as the door's reader expands them (formats/worldData/worldDataPack.js
 *  openWorldDataPack: the pack's own ROW_CODECS, WD1's patchJson for a node's `$o`) - except a `$c`, a piece of the
 *  player's own BLOCKS.BSA, which is CLASSIC: no game data is here. */
function packValue(v) {
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === 'object' ? packValue(x) : x));
  if (v === null || typeof v !== 'object') return v;
  const k = Object.keys(v).find((key) => key.startsWith('$') && key !== '$o');
  if (!k) return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, x !== null && typeof x === 'object' ? packValue(x) : x]));
  if (k === '$c') return CLASSIC;
  let node;
  if (k === '$n') { const n = PACK.nodes[v.$n]; node = packValue(typeof n === 'string' ? JSON.parse(n) : n); }
  else if (k === '$r') { node = []; for (let i = 0; i < v.$r.length; i += 2) for (let n = 0; n < v.$r[i + 1]; n++) node.push(v.$r[i]); }
  else node = v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : packValue(row)));
  return v.$o ? patchJson(node, v.$o.map((op) => (op[0] === 's' || op[0] === 'i' ? [op[0], op[1], packValue(op[2])] : op))) : node;
}
/** The value a file's own op sets whole at `path` - or, for a file based on another of the pack, that file's. */
function setAt(name, path) {
  for (let file = name; file;) {
    const [, base, ops] = entry(file);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === path);
    if (op) return packValue(op[2]);
    file = base[0] === 'f' ? base[1] : null;
  }
  return undefined;
}
const TOWN = 'location-42-177.json';
const BLOCK_NAMES = setAt(TOWN, 'Exterior.ExteriorData.BlockNames');
const WIDTH = setAt(TOWN, 'Exterior.ExteriorData.Width');
/** A block of the town as the door's converter builds one (blockFromJson): the author's building list and subrecords; a
 *  subrecord's interior that is a classic reference stands in empty (no marker - such a building is never a quest site
 *  here). A block whose file sets no subrecord list whole (the crop fields FARMAA10/11/13) names no building at all -
 *  its building list is empty - and stands with none. */
const blockOf = (() => {
  const made = new Map();
  return (name) => {
    if (!made.has(name)) {
      const list = setAt(`${name}.json`, 'RmbBlock.FldHeader.BuildingDataList');
      const subs = setAt(`${name}.json`, 'RmbBlock.SubRecords');
      if (subs === undefined) assert.deepEqual(list, [], `${name}: no whole subrecord list, and no building`);
      const SubRecords = (subs ?? []).map((sr) => (sr.Interior === CLASSIC ? { ...sr, Interior: {} } : sr));
      made.set(name, blockFromJson({ Name: name, RmbBlock: { FldHeader: { BuildingDataList: list }, SubRecords } }, 9000 + made.size));
    }
    return made.get(name);
  };
})();
const MAP_ID = 4242;
const town = {
  loaded: true, regionIndex: 42, regionName: 'Shalgora', name: entry(TOWN)[1][3], locationIndex: 177, hasDungeon: false,
  mapTableData: { mapId: MAP_ID, locationType: 9, dungeonType: -1 }, dungeon: null,
  exterior: { buildings: setAt(TOWN, 'Exterior.Buildings').map(buildingDataFromJson), recordElement: { header: { x: 0, y: 0 } },
    exteriorData: { locationId: 0x500, width: WIDTH, height: setAt(TOWN, 'Exterior.ExteriorData.Height'), blockNames: BLOCK_NAMES } },
};
/** The script's `_dungeon_` (the map the guild shows a new member): a crypt of one RDB block with one quest marker. */
const crypt = {
  loaded: true, regionIndex: 42, regionName: 'Shalgora', name: 'Shalgora Crypt', locationIndex: 3, hasDungeon: true,
  mapTableData: { mapId: 5151, locationType: 7, dungeonType: 3 }, dungeon: { blocks: [{ x: 0, z: 0, blockName: 'CRYPT.RDB' }] },
  exterior: { buildings: [], recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId: 0x600, width: 1, height: 1, blockNames: [] } },
};
const CRYPT = { position: 100, rdbBlock: { objectRootList: [{ rdbObjects: [{ type: 3, position: 7, xPos: 0, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: 11 } } }] }] } };
const LOCATIONS = [crypt, town];
const REGION = { name: 'Shalgora', locationCount: 2, mapTable: LOCATIONS.map((l) => l.mapTableData), mapNameLookup: new Map(LOCATIONS.map((l, i) => [l.name, i])) };
const faction = (id) => ({ id, type: 2, name: id === 42 ? 'The Thieves Guild' : `Faction ${id}`, race: -1, flat1: (182 << 7) | 1, flat2: (182 << 7) | 2 });

/** The letter taken, by a MALE thief, out in the wilds of Shalgora: the real O0A0AL00, its every draw at 0.55 - which is
 *  what lands the dart on Moorham Manor (the crypt first) and mints the robes the report names. */
function thiefLetter() {
  let inside = null;
  const world = {
    maps: { regionCount: 1, getRegion: () => REGION, getLocation: (_r, i) => LOCATIONS[i], getLocationByName: (_r, n) => LOCATIONS.find((l) => l.name === n),
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x], readLocationIdFast: () => 0x500 },
    getBlock: (name) => (name === 'CRYPT.RDB' ? CRYPT : blockOf(name)),
    currentLocation: () => town, currentRegionIndex: () => 42, currentLocationIndex: () => -1, currentRegionName: () => 'Shalgora',
    isPlayerInLocationRect: () => !inside, playerInside: () => (inside ? { building: inside } : null), isHouseOwned: () => false,
    playerPixel: () => ({ x: 1, y: 1 }), buildingNameOpts: () => ({}), getFactionData: faction, findFactionsOfType: (type) => [{ ...faction(201), type }],
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3,
  };
  const popups = [], given = [];
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {}, playerGender: () => 'male', playerLevel: () => 5,
    giveItemToPlayer: (it) => given.push(it), showPopup: (_q, tokens) => popups.push(tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim()) });
  const quest = machine.scheduleQuest(SCRIPT, 0, { rolls: () => 0.55 });
  machine.tick();
  // A building entered, its quest resources mounted by the real walk (AddQuestResourceObjects) through an adapter that
  // stands them as scenes/worldModes.js's does: an item on its template's WORLD texture (standItem), a person on the
  // picked billboard (standNPC), each a record of standQuestFlatIn's shape in the host's list
  const questFlats = [];
  const enter = (site, buildingType) => {
    inside = { buildingKey: site.buildingKey, buildingType };
    addQuestResourceObjects(machine, {
      currentMapId: () => MAP_ID, findBehaviours: () => questFlats.map((s) => s.behaviour),
      standItem: ({ item, position, behaviour }) => {
        const t = templateByIndex(item.daggerfallUnityItem?.templateIndex);
        if (!t) return null;
        questFlats.push({ archive: t.worldTextureArchive, record: t.worldTextureRecord, ...position, behaviour });
        return { setActive() {}, destroy() {} };
      },
      standNPC: ({ flatData, position, behaviour, person }) => {
        questFlats.push({ archive: flatData.archive, record: flatData.record, ...position, behaviour });
        return { staticNpcFactionId: person.factionId ?? null, setActive() {}, destroy() {} };
      },
      standFoe: () => null,
    }, SITE_TYPES.Building, site.buildingKey);
  };
  return { machine, quest, popups, given, questFlats, enter, place: (name) => quest.getPlace({ name }).siteDetails };
}
const taskTriggered = (quest, name) => [...quest.tasks.values()].find((t) => t.symbol?.name === name)?.triggered ?? false;

test('QUEST-ITEM-NAMED, the trace: O0A0AL00 stands its robes at the Moorham Manor house\'s own item marker, and the one way a stood quest item is taken hands them over, says 1018 and gives the note', () => {
  assert.equal(town.name, 'Moorham Manor', 'the pack\'s location-42-177 is Moorham Manor');
  const { machine, quest, popups, given, questFlats, enter, place } = thiefLetter();
  const mansion = place('mansion');
  const clothing = quest.getResource({ name: 'clothing' });
  // the letter's words, expanded as the player read them
  assert.equal(clothing.daggerfallUnityItem.group, 'WomensClothing', '`Item _clothing_ womens_clothing` (Quests-Items: class 12) - for a male thief too');
  assert.equal(clothing.daggerfallUnityItem.templateIndex, PRIESTESS_ROBES);
  assert.equal(itemLongName(clothing.daggerfallUnityItem), 'Priestess Robes');
  assert.match(mansion.buildingName, /^The .+ Residence$/, 'a House1 is "The <surname> Residence" (Place.GetBuildingName)');
  // PIN MOVED (QUEST-AUDIT III HOUSE-HOUSE): the pack's directory names no House1, so the darts fall back - to any HOUSE now
  // (it took any building with markers: the author's farmhouse FARMAA09 #0 was the draw among them), the house the draw
  // lands on read off its key: a house of the author's grid, with its own item marker
  const [bx, by, rec] = [(mansion.buildingKey >> 16) & 0xff, (mansion.buildingKey >> 8) & 0xff, mansion.buildingKey & 0xff];
  assert.equal(mansion.buildingKey, makeBuildingKey(bx, by, rec));
  const houseBlock = blockOf(BLOCK_NAMES[by * WIDTH + bx]);
  const houseType = houseBlock.rmbBlock.fldHeader.buildingDataList[rec].buildingType;
  assert.ok(houseType >= BUILDING_TYPES.House1 && houseType <= BUILDING_TYPES.House6, `a house (${houseType})`);
  const authorItemMarker = houseBlock.rmbBlock.subRecords[rec].interior.blockFlatObjectRecords.filter((f) => f.textureArchive === 199 && f.textureRecord === MARKER_TYPES.QuestItem);
  assert.equal(authorItemMarker.length, 1, 'the author\'s house holds one item marker');
  assert.equal(mansion.selectedMarker.markerType, MARKER_TYPES.QuestItem, 'an item takes an item marker first (Place.GetSiteMarker)');
  assert.deepEqual(mansion.selectedMarker.flatPosition, { x: authorItemMarker[0].xPos * 0.025, y: -authorItemMarker[0].yPos * 0.025, z: authorItemMarker[0].zPos * 0.025 });
  assert.deepEqual(mansion.selectedMarker.targetResources.map((s) => s.name), ['clothing']);

  enter(mansion, BUILDING_TYPES.House1);
  assert.equal(questFlats.length, 1, 'one thing stands in the house');
  const robes = questFlats[0];
  assert.equal(robes.behaviour.targetResource, clothing);
  assert.deepEqual([robes.x, robes.y, robes.z], Object.values(markerScenePosition(mansion.selectedMarker)), 'on the marker');
  assert.deepEqual([robes.archive, robes.record], [ITEM_TEMPLATES[PRIESTESS_ROBES].worldTextureArchive, ITEM_TEMPLATES[PRIESTESS_ROBES].worldTextureRecord], 'drawn as the item\'s world texture');

  // the take: PlayerActivate's quest arm, any mode but Info (worldModes.js clickQuestFlat -> DoClick)
  assert.equal(robes.behaviour.doClick(), true);
  machine.tick();
  assert.equal(given[0], clothing.daggerfallUnityItem, 'the quest\'s own record goes to the pack');
  assert.ok(given[0].questItem && given[0].questUID === quest.uid);
  assert.ok(taskTriggered(quest, 'S.03'), '`clicked item _clothing_` fired');
  assert.match(popups.at(-1), /^As you pick up the Priestess Robes you hear the soft rustle of paper\. A note is tucked inside the Priestess Robes\.$/, 'say 1018');
  const note = quest.getResource({ name: 'note' }).daggerfallUnityItem;
  assert.equal(given[1], note, '`get item _note_` - the second letter the report waited for');
  assert.equal(given.length, 2);
});

test('QUEST-ITEM-NAMED, the robes on the paperdoll: a house\'s wardrobe mints clothing by the PLAYER\'s gender, so one roll is Priestess Robes to a woman and Priest Robes to a man - never the quest\'s', () => {
  // StockHouseContainer (DaggerfallLoot.cs:291-375, shopStock.js) in a House1, a low-tier container: the table offers
  // [Armor, MensClothing, WomensClothing]; the 0.9 draws WOMEN's clothing, the next picks the template, and the continue
  // roll stops at one item
  const wardrobe = (gender) => {
    const draws = [0.9, 0.57];
    return stockHouseContainer({ buildingType: BUILDING_TYPES.House1, record: 0 }, { gender, level: 5 }, { rolls: () => draws.shift() ?? 0, contRand: () => 99 });
  };
  const [his] = wardrobe('male');
  const [hers] = wardrobe('female');
  assert.deepEqual([his.group, his.templateIndex, itemLongName(his)], ['MensClothing', PRIEST_ROBES, 'Priest Robes'], 'the report\'s robes: CreateRandomClothing(PlayerEntity.Gender)');
  assert.deepEqual([hers.group, hers.templateIndex, itemLongName(hers)], ['WomensClothing', PRIESTESS_ROBES, 'Priestess Robes']);
  assert.ok(!his.questItem, 'and no quest\'s');
  // every draw a man's wardrobe can make is men's clothing; the quest's robes are women's for him too (the trace above)
  for (let g = 0; g < 3; g++) {
    for (let t = 0; t < 41; t++) {
      const draws = [(g + 0.5) / 3, (t + 0.5) / 41];
      for (const it of stockHouseContainer({ buildingType: BUILDING_TYPES.House1, record: 0 }, { gender: 'male', level: 5 }, { rolls: () => draws.shift() ?? 0, contRand: () => 99 })) {
        assert.notEqual(it.group, 'WomensClothing', `draw ${g}/${t}`);
      }
    }
  }
});
