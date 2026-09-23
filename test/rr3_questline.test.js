// RR3a - Roleplay & Realism 1.8 (Hazelnut): the Master Armorer quest
// line's registrations (RoleplayRealism.cs:41-53, :241-311, :414-484,
// :659-706) - the quest list and its three quests, the two table
// additions, the three custom factions, the custom armor service, the
// fort's tracks and the shop's discovery - and the DFU seams they
// stand on that the port did not have: FactionFile.RegisterCustomFaction,
// QuestListsManager.RegisterQuestList, Services.RegisterMerchantService,
// WorldDataVariants and the WorldUpdate action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import {
  RR_TEXT, RR_PLACES_TABLE, RR_FACTIONS_TABLE, RR_QUEST_LIST, RR_FACTION_IDS, RR_CUSTOM_FACTIONS, RR_FORT_PIXEL, rrFortProximityLines,
  rrMasterArmBuildingKey, rrMasterArmorerDiscovery, RR_CUSTOM_ARMOR_MATERIALS, rrCustomArmorOffered, rrCustomArmorMaterials, rrCustomArmorVariants,
  rrCustomArmorStock, rrCustomArmorService, RR_ARMORER_BLOCK, RR_ARMORER_RECORD,
} from '../src/systems/rrQuestLine.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { registerCustomFaction, customFactions, _resetCustomFactions, FactionFile, SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { addCustomFactions, createFactionRep } from '../src/systems/factionRep.js';
import { loadQuestTables, addIntoQuestTables, placesTable, factionsTable, _resetExtraQuestRows, resetQuestTables } from '../src/systems/quest/tables.js';
import { getIndividualFactionID } from '../src/systems/quest/person.js';
import { QuestListsManager, registerQuestList, registeredQuestLists, _resetQuestLists } from '../src/systems/quest/questLists.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { defaultActionTemplates, WorldUpdate } from '../src/systems/quest/actions.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import {
  NO_VARIANT, ANY_LOCATION_KEY, makeLocationKey, setLastLocationKeyTo, setLocationVariant, setNewLocationVariant, setBlockVariant, setBuildingVariant,
  getLocationVariant, getBlockVariantHere, getBuildingVariantHere, getBlockVariant, getBuildingVariant, clearWorldDataVariants, getWorldVariationSaveData,
  restoreWorldVariationData, setNewLocationIndexResolver, setVariantChangedHook, lastLocationKeyOf,
} from '../src/systems/worldDataVariants.js';
import { registerMerchantService, hasCustomMerchantService, getCustomMerchantService, getCustomMerchantServiceLabel, _resetMerchantServices } from '../src/systems/guildServices.js';
import { staticNpcRoute } from '../src/systems/guildServiceFlow.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { groupTemplates } from '../src/systems/itemTemplates.js';
import { DIRECTION_HINTS } from '../src/systems/talk.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism';
const on = (key, v = true) => setModSetting(V, key, v);
const QUESTS = 'vendor/roleplay-realism/Quests';
const questLines = (name) => rd(`${QUESTS}/${name}.txt`).replace(/^﻿/, '').split(/\r?\n/);
const tableSources = () => {
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(`vendor/dfu-quests/Tables/${f}`).replace(/^﻿/, '');
  return sources;
};

// the install registers at import, as the scene boot does (InitMod)
_resetModSettings();
installRoleplayRealism();

test('RR3 the record: the four quest files vendored, the list\'s three rows, the csv lines, the tables\' rows', () => {
  for (const f of ['QuestList-RoleplayRealism', 'RRMSTARM0', 'RRMSTARM1', 'RRMSTARM2']) assert.ok(existsSync(join(ROOT, `${QUESTS}/${f}.txt`)), f);
  const author = '/home/user/dfunity-mods/RoleplayRealism/Quests';
  if (existsSync(author)) for (const f of ['QuestList-RoleplayRealism', 'RRMSTARM0', 'RRMSTARM1', 'RRMSTARM2']) assert.equal(rd(`${QUESTS}/${f}.txt`), readFileSync(join(author, `${f}.txt`), 'utf8'), `${f}: verbatim`);
  const list = rd(`${QUESTS}/QuestList-RoleplayRealism.txt`);
  assert.match(list, /^RRMSTARM0, FightersGuild, M, 9, 1, Mountain Rumors$/m);
  assert.match(list, /^RRMSTARM1, FightersGuild, M, 101, 0, The Master Armorer$/m);
  assert.match(list, /^RRMSTARM2, FightersGuild, M, 101, 0, A Careless Price$/m);
  const csv = rd('vendor/roleplay-realism/RoleplayRealismModData.csv');
  for (const [k, v] of Object.entries(RR_TEXT)) assert.ok(csv.includes(`${k},"${v}"`), k);
  assert.equal(RR_QUEST_LIST, 'RoleplayRealism');
  assert.deepEqual(RR_PLACES_TABLE.map((r) => r.split(',')[0].trim()), ['Aldleigh', 'Northrock_Fort_Ext', 'Northrock_Fort']);
  assert.deepEqual(RR_FACTIONS_TABLE.map((r) => Number(r.split(',')[3])), [1020, 1021, 1022]);
  assert.deepEqual(RR_FACTION_IDS, { LordVerathon: 1020, CaptainUlthega: 1021, OrthusDharjen: 1022 });
  // the mod's Quests/ folder rides the pack loader's globs
  const qd = rd('src/scenes/questData.js');
  assert.match(qd, /import\.meta\.glob\('\.\.\/\.\.\/vendor\/roleplay-realism\/Quests\/\*\.txt'/);
  assert.match(qd, /if \(name\.startsWith\('QuestList-'\)\) tables\.set\(name, stripBom\(await load\(\)\)\);/);
});

// ---- RegisterFactionIds (:659-706) + FactionFile.RegisterCustomFaction + AddCustomFactions ----
test('RR3 the three factions: the registry, the records verbatim, the dictionary carries them with the relink, the talk reader too', () => {
  const [lord, captain, armorer] = RR_CUSTOM_FACTIONS;
  assert.deepEqual([lord.id, lord.parent, lord.type, lord.name, lord.summon, lord.region, lord.power, lord.face, lord.race, lord.flat1, lord.sgroup, lord.ggroup, lord.children],
    [1020, 0, 4, 'Lord Verathon', -1, 16, 10, 12, 2, (183 << 7) + 20, 3, 0, [1021]]);
  assert.deepEqual([captain.id, captain.parent, captain.name, captain.region, captain.power, captain.face, captain.flat1, captain.sgroup, captain.children],
    [1021, 1020, 'Captain Ulthega', 16, 2, 57, (180 << 7) + 2, 4, null]);
  assert.deepEqual([armorer.id, armorer.parent, armorer.name, armorer.region, armorer.power, armorer.face, armorer.flat1, armorer.sgroup],
    [1022, 0, 'Orthus Dharjen', 17, 2, 380, (334 << 7) + 14, SOCIAL_GROUPS.Merchants]);
  // the install registered them (the mod is on by default)
  assert.equal(customFactions().size, 3);
  assert.equal(customFactions().get(1022).name, 'Orthus Dharjen');
  assert.equal(customFactions().get(1022).ally1, 0, 'the record is FactionData whole - the fields the mod leaves are zero');
  assert.equal(registerCustomFaction(1022, { name: 'x' }), false, 'an id in use is refused');
  // AddCustomFactions (:139-155): into a dictionary that lacks them, relinked
  const dict = new Map([[0, { id: 0, name: 'root', parent: 0, children: null }]]);
  const nameToId = new Map();
  assert.equal(addCustomFactions(dict, nameToId), true, 'a parented faction asks the relink');
  assert.equal(dict.size, 4);
  // DFU's quirk, kept: RelinkChildren (FactionFile.cs:879-893) ADDS to every children list without clearing it, so the
  // lord's own [1021] gains the relinked 1021 - and every parented faction in the dictionary is listed under its parent
  // twice after a custom faction with a parent lands. The port's relinkChildren is the same walk.
  assert.deepEqual(dict.get(1020).children, [1021, 1021], 'the mod\'s own child list, plus the relink - DFU\'s own doubling');
  assert.equal(nameToId.get('Captain Ulthega'), 1021);
  assert.equal(addCustomFactions(dict), false, 'already there: nothing added, no relink');
  assert.notEqual(dict.get(1020), customFactions().get(1020), 'a copy, as the C# struct is');
  // Reset (:331): a fresh player dictionary carries them
  const rep = createFactionRep(new Map([[41, { id: 41, name: 'The Fighters Guild', parent: 0, children: null }]]));
  assert.equal(rep.dict.get(1022)?.name, 'Orthus Dharjen');
  assert.ok(Object.isFrozen(customFactions().get(1020)));
  assert.match(rd('src/scenes/townTalk.js'), /addCustomFactions\(factions\.factionDict, factions\.factionNameToId\);/, 'the talk reader stands in for PlayerEntity.FactionData');
  assert.ok(typeof FactionFile === 'function');
});

// ---- the two tables (:250-251) --------------------------------------------------
test('RR3 the tables: AddIntoTable before and after the load, the places and the individuals resolve', () => {
  resetQuestTables(); _resetExtraQuestRows();
  addIntoQuestTables({ places: [...RR_PLACES_TABLE], factions: [...RR_FACTIONS_TABLE] });   // at InitMod, before the pack loads
  loadQuestTables(tableSources());
  assert.equal(placesTable().hasValue('Northrock_Fort'), true);
  assert.equal(placesTable().getValue('p1', 'Northrock_Fort'), '0x73A1');
  assert.equal(placesTable().getValue('p1', 'Northrock_Fort_Ext'), '0x73A0');
  assert.equal(placesTable().getValue('p1', 'Aldleigh'), '0x3181');
  assert.equal(placesTable().getValue('p3', 'Aldleigh'), '-1');
  assert.equal(factionsTable().getValue('p3', 'Orthus_Dharjen'), '1022');
  assert.equal(getIndividualFactionID('Lord_Verathon'), 1020);
  assert.equal(getIndividualFactionID('Captain_Ulthega'), 1021);
  // and after the load, at once
  addIntoQuestTables({ places: ['Test_Place,   0x7777, 1, -1'] });
  assert.equal(placesTable().getValue('p1', 'Test_Place'), '0x7777');
  addIntoQuestTables({ nonsense: ['x'] });
  resetQuestTables(); _resetExtraQuestRows();
  addIntoQuestTables({ places: [...RR_PLACES_TABLE], factions: [...RR_FACTIONS_TABLE] });
  loadQuestTables(tableSources());
});

// ---- RegisterQuestList (:241) --------------------------------------------------
test('RR3 the quest list: registered once, loaded after the two shipped lists under the mod\'s gate, the three rows in the Fighters pool', () => {
  assert.equal(registeredQuestLists().includes('RoleplayRealism'), true, 'the install registered it');
  assert.equal(registerQuestList('RoleplayRealism'), false, 'a name in use is refused (the C# throws on this)');
  const readListTable = (name) => {
    if (name === 'RoleplayRealism') return rd(`${QUESTS}/QuestList-RoleplayRealism.txt`);
    return rd(`vendor/dfu-quests/Tables/QuestList-${name}.txt`).replace(/^﻿/, '');
  };
  const lists = new QuestListsManager({ readListTable });
  const fighters = lists.guilds.get(GUILD_GROUPS.FightersGuild);
  const rows = fighters.filter((q) => q.name.startsWith('RRMSTARM'));
  assert.deepEqual(rows.map((q) => [q.name, q.membership, q.minReq, q.oneTime]), [['RRMSTARM0', 'M', 9, true], ['RRMSTARM1', 'M', 101, false], ['RRMSTARM2', 'M', 101, false]]);
  assert.equal(fighters.indexOf(rows[0]) > 20, true, 'after DFU\'s own Fighters rows - the registered list loads last');
  on('Enabled', false);
  assert.deepEqual(registeredQuestLists(), [], 'the gate: the mod off is DFU\'s mod not loaded');
  const off = new QuestListsManager({ readListTable });
  assert.equal(off.guilds.get(GUILD_GROUPS.FightersGuild).some((q) => q.name.startsWith('RRMSTARM')), false);
  _resetModSettings();
  assert.equal(registeredQuestLists().length, 1);
  // the reset seam
  const before = registeredQuestLists();
  _resetQuestLists();
  assert.deepEqual(registeredQuestLists(), []);
  for (const n of before) registerQuestList(n, () => true);
});

test('RR3 the three quests parse under the port\'s parser - every line a known action, no warnings - and the registry has no guard left', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const warns = []; const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const q0 = m.parseQuestForLists(questLines('RRMSTARM0'), 0, { rolls: () => 0 });
    const q1 = m.parseQuestForLists(questLines('RRMSTARM1'), 0, { rolls: () => 0 });
    const q2 = m.parseQuestForLists(questLines('RRMSTARM2'), 0, { rolls: () => 0 });
    assert.ok(q0 && q1 && q2);
    assert.equal(q0.tasks.size, 4); assert.equal(q1.tasks.size, 87); assert.equal(q2.tasks.size, 15);
  } finally { console.warn = ow; }
  assert.deepEqual(warns, [], 'no line pended, none refused');
  const templates = defaultActionTemplates();
  assert.equal(templates.filter((t) => t.constructor.name === 'PendingTrigger').length, 0);
  assert.ok(templates.some((t) => t instanceof WorldUpdate));
  assert.equal(questLines('RRMSTARM1').filter((l) => /^\s*worldupdate building/.test(l)).length, 3, 'the line the guard used to refuse');
});

// ---- WorldDataVariants + WorldUpdate ----------------------------------------------
test('RR3 WorldDataVariants: the location key, the four setters and their C# returns, the here/any getters, save and restore', () => {
  clearWorldDataVariants();
  assert.equal(makeLocationKey(52, 7), 752);
  assert.equal(ANY_LOCATION_KEY, -8); assert.equal(NO_VARIANT, '');
  let changed = 0; setVariantChangedHook(() => { changed++; });
  assert.equal(setBuildingVariant('ARMRAM03.RMB', 14, 'master', makeLocationKey(52, 7)), true, 'added');
  assert.equal(setBuildingVariant('ARMRAM03.RMB', 14, 'master2', makeLocationKey(52, 7)), false, 'replaced');
  assert.equal(getBuildingVariant(52, 7, 'ARMRAM03.RMB', 14), 'master2');
  assert.equal(getBuildingVariant(52, 8, 'ARMRAM03.RMB', 14), null, 'another location: null');
  setLastLocationKeyTo(52, 7);
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), 'master2', 'the last location\'s');
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14, 'already'), NO_VARIANT, 'a key with a variant is not asked again');
  setLastLocationKeyTo(52, 9);
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), NO_VARIANT);
  setBuildingVariant('ARMRAM03.RMB', 14, 'everywhere');
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), 'everywhere', 'AnyLocationKey is the fallback');
  assert.equal(setBuildingVariant('ARMRAM03.RMB', 14, NO_VARIANT), false, 'NoVariant removes');
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), NO_VARIANT);
  assert.equal(setBlockVariant('RRFORT01.RMB', 'burnt', 1650), true);
  assert.equal(getBlockVariant(50, 16, 'RRFORT01.RMB'), 'burnt');
  setLastLocationKeyTo(50, 16); assert.equal(getBlockVariantHere('RRFORT01.RMB'), 'burnt');
  assert.equal(setLocationVariant(16, 3, 'v1'), false, 'SetLocationVariant answers ContainsKey BEFORE the write - the C#\'s own inversion');
  assert.equal(setLocationVariant(16, 3, 'v2'), true);
  assert.deepEqual(getLocationVariant(316), { variant: 'v2', newLocation: false });
  assert.equal(lastLocationKeyOf(), 316, 'GetLocationVariant sets the last location checked (:180)');
  assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), NO_VARIANT);
  // a new location without RR3b's resolver: the C#'s failure log, true
  const w = []; const ow = console.warn; console.warn = (...a) => w.push(a.join(' '));
  assert.equal(setNewLocationVariant(16, 'Northrock Fort', 'v'), true);
  console.warn = ow; assert.equal(w.length, 1);
  setNewLocationIndexResolver((region, name) => (region === 16 && name === 'Northrock Fort' ? 0 : -1));
  assert.equal(setNewLocationVariant(16, 'Northrock Fort', 'v'), true, 'added');
  assert.deepEqual(getLocationVariant(16), { variant: 'v', newLocation: true });
  setNewLocationIndexResolver(null);
  assert.ok(changed >= 6);
  const saved = getWorldVariationSaveData();
  assert.deepEqual(saved.newLocationVariants, [16]);
  assert.equal(saved.locationVariants[316], 'v2');
  clearWorldDataVariants();
  assert.deepEqual(getWorldVariationSaveData(), { newLocationVariants: [], locationVariants: {}, blockVariants: {}, buildingVariants: {} });
  restoreWorldVariationData(saved);
  assert.equal(getBlockVariant(50, 16, 'RRFORT01.RMB'), 'burnt');
  assert.deepEqual(getLocationVariant(316), { variant: 'v2', newLocation: false });
  restoreWorldVariationData({ blockVariants: null });
  assert.equal(getBlockVariant(50, 16, 'RRFORT01.RMB'), 'burnt', 'a null half keeps what stands');
  restoreWorldVariationData(null);
  clearWorldDataVariants(); setVariantChangedHook(null);
});

test('RR3 WorldUpdate: the six forms parse, the update writes the registry, `-` is NoVariant, the save shape', () => {
  clearWorldDataVariants();
  const t = new WorldUpdate(null);
  const mk = (line) => t.createNew(line, { hooks: null });
  const a = mk('worldupdate building ARMRAM03.RMB 14 at 7 in region 52 variant master');
  assert.deepEqual([a.type, a.blockName, a.recordIndex, a.locationIndex, a.regionIndex, a.variant], ['building', 'ARMRAM03.RMB', 14, 7, 52, 'master']);
  a.update({}); assert.equal(getBuildingVariant(52, 7, 'ARMRAM03.RMB', 14), 'master'); assert.equal(a.isComplete, true);
  const b = mk('worldupdate buildingAll ARMRAM03.RMB 14 variant master');
  assert.deepEqual([b.type, b.blockName, b.recordIndex, b.variant], ['buildingAll', 'ARMRAM03.RMB', 14, 'master']);
  b.update({}); setLastLocationKeyTo(1, 1); assert.equal(getBuildingVariantHere('ARMRAM03.RMB', 14), 'master');
  const c = mk('worldupdate block RRFORT01.RMB at 0 in region 16 variant burnt');
  assert.deepEqual([c.type, c.blockName, c.locationIndex, c.regionIndex, c.variant], ['block', 'RRFORT01.RMB', 0, 16, 'burnt']);
  c.update({}); assert.equal(getBlockVariant(16, 0, 'RRFORT01.RMB'), 'burnt');
  const d = mk('worldupdate blockAll RRFORT01.RMB variant burnt');
  assert.deepEqual([d.type, d.blockName, d.variant], ['blockAll', 'RRFORT01.RMB', 'burnt']);
  const e = mk('worldupdate location at 3 in region 16 variant v');
  assert.deepEqual([e.type, e.locationIndex, e.regionIndex, e.variant], ['location', 3, 16, 'v']);
  e.update({}); assert.deepEqual(getLocationVariant(316), { variant: 'v', newLocation: false });
  const f = mk('worldupdate locationnew named Northrock Fort in region 16 variant v');
  assert.deepEqual([f.type, f.locationName, f.regionIndex, f.variant], ['locationnew', 'Northrock Fort', 16, 'v']);
  const g = mk('worldupdate building ARMRAM03.RMB 14 at 7 in region 52 variant -');
  g.update({}); assert.equal(getBuildingVariant(52, 7, 'ARMRAM03.RMB', 14), null, '`-` clears');
  assert.equal(mk('worldupdate nonsense'), null);
  assert.deepEqual(a.getSaveData(), { type: 'building', regionIndex: 52, locationIndex: 7, locationName: '', blockName: 'ARMRAM03.RMB', recordIndex: 14, variant: 'master' });
  const h = new WorldUpdate(null); h.restoreSaveData(a.getSaveData());
  assert.equal(h.blockName, 'ARMRAM03.RMB'); assert.equal(h.recordIndex, 14);
  // the pattern audit's contract: the C#'s alternates, each group numbered by its alternate
  assert.match(t.pattern.source, /^worldupdate \(\?<type1>location\) at/);
  clearWorldDataVariants();
});

// ---- the two PlayerGPS subscribers (:259-297) --------------------------------------
test('RR3 the fort\'s tracks and the armorer\'s discovery: nine pixels, the compass words, the building key by region, the variant gate', () => {
  assert.deepEqual(RR_FORT_PIXEL, { x: 938, y: 51 });
  assert.deepEqual(rrFortProximityLines(938, 51), [RR_TEXT.fortVerynear1, RR_TEXT.fortVerynear2]);
  const near = (d) => [RR_TEXT.fortNear.replace('{0}', DIRECTION_HINTS[d])];
  assert.deepEqual(rrFortProximityLines(938, 50), near('south'));
  assert.deepEqual(rrFortProximityLines(939, 50), near('southwest'));
  assert.deepEqual(rrFortProximityLines(939, 51), near('west'));
  assert.deepEqual(rrFortProximityLines(939, 52), near('northwest'));
  assert.deepEqual(rrFortProximityLines(938, 52), near('north'));
  assert.deepEqual(rrFortProximityLines(937, 52), near('northeast'));
  assert.deepEqual(rrFortProximityLines(937, 51), near('east'));
  assert.deepEqual(rrFortProximityLines(937, 50), near('southeast'));
  assert.deepEqual(rrFortProximityLines(936, 51), []); assert.deepEqual(rrFortProximityLines(938, 53), []);
  assert.equal(rrFortProximityLines(938, 50)[0], 'You spot signs of recent activity in the area that seem to lead to the south.');
  assert.deepEqual([52, 18, 48, 17].map(rrMasterArmBuildingKey), [131342, 197134, 131598, 0]);
  assert.equal(RR_ARMORER_BLOCK, 'ARMRAM03.RMB'); assert.equal(RR_ARMORER_RECORD, 14);
  const variantOf = (r, l, block, rec) => (r === 52 && l === 7 && block === 'ARMRAM03.RMB' && rec === 14 ? 'master' : null);
  assert.deepEqual(rrMasterArmorerDiscovery({ regionIndex: 52, locationIndex: 7 }, variantOf), { buildingKey: 131342, name: 'Dharjen Custom Armor' });
  assert.equal(rrMasterArmorerDiscovery({ regionIndex: 52, locationIndex: 8 }, variantOf), null, 'no variant set: nothing');
  assert.equal(rrMasterArmorerDiscovery(null, variantOf), null);
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(rrEnabled\(\)\) \{ const _px = playerTravelPixel\(\); for \(const line of rrFortProximityLines\(_px\.x, _px\.y\)\) townTalk\.say\(line, 5\); \}/, 'OnMapPixelChanged: AddHUDText(text, 5)');
  assert.match(w, /if \(dfLocation\) setLastLocationKeyTo\(dfLocation\.regionIndex, dfLocation\.locationIndex \?\? 0\);/);
  assert.match(w, /const arm = rrMasterArmorerDiscovery\(_musicLoc, getBuildingVariant\);\s*const armRec = arm \? \(topicTree\.listBuildings \?\? \[\]\)\.find\(\(b\) => b\.buildingKey === arm\.buildingKey\) : null;\s*if \(arm && armRec\) discoverBuilding\(`\$\{_musicLoc\.regionIndex\}:\$\{_musicLoc\.name\}`, armRec, arm\.name\);/, 'OnEnterLocationRect: DiscoverBuilding(key, name) - and nothing without the directory\'s record (AUDIT-RR F36, PlayerGPS.cs:932-933)');
});

// ---- CustomArmorService (:414-484) ------------------------------------------------
test('RR3 the custom armor: the level gate, the material ladder\'s breaks, the variant spans, the shelf, the service\'s two doors', () => {
  assert.deepEqual(RR_CUSTOM_ARMOR_MATERIALS, [ARMOR_MATERIAL.Mithril, ARMOR_MATERIAL.Adamantium, ARMOR_MATERIAL.Ebony, ARMOR_MATERIAL.Orcish, ARMOR_MATERIAL.Daedric]);
  assert.equal(rrCustomArmorOffered(8), false); assert.equal(rrCustomArmorOffered(9), true);
  const M = ARMOR_MATERIAL;
  assert.deepEqual(rrCustomArmorMaterials(8), []);
  assert.deepEqual(rrCustomArmorMaterials(9), [M.Mithril]);
  assert.deepEqual(rrCustomArmorMaterials(11), [M.Mithril]);
  assert.deepEqual(rrCustomArmorMaterials(12), [M.Mithril, M.Adamantium, M.Ebony], 'Ebony rides Adamantium\'s tier - the next break is on >= Orcish');
  assert.deepEqual(rrCustomArmorMaterials(14), [M.Mithril, M.Adamantium, M.Ebony]);
  assert.deepEqual(rrCustomArmorMaterials(15), [M.Mithril, M.Adamantium, M.Ebony, M.Orcish]);
  assert.deepEqual(rrCustomArmorMaterials(18), RR_CUSTOM_ARMOR_MATERIALS);
  assert.deepEqual(rrCustomArmorVariants(102, 5), [1, 3]); assert.deepEqual(rrCustomArmorVariants(105, 5), [1, 3]); assert.deepEqual(rrCustomArmorVariants(106, 5), [1, 3]);
  assert.deepEqual(rrCustomArmorVariants(104, 7), [2, 5]);
  assert.deepEqual(rrCustomArmorVariants(103, 2), [1, 1]);
  assert.deepEqual(rrCustomArmorVariants(108, 3), [1, 2]); assert.deepEqual(rrCustomArmorVariants(107, 6), [1, 5]);
  assert.equal(rrCustomArmorVariants(109, 0), null, 'a shield: continue');
  assert.equal(rrCustomArmorVariants(110, 0), null);
  // the shelf at level 9: one material, 3 + 3 + 3 + 4 + 1 + 2 + 5 = 21 pieces, plus each custom class once
  const minted = [];
  const mint = (f) => { minted.push(f); return f; };
  const shelf = rrCustomArmorStock(9, { mint, customTemplates: [] });
  assert.equal(shelf.length, 21);
  assert.ok(shelf.every((i) => i.material === M.Mithril && i.group === 'Armor'));
  assert.deepEqual(shelf.filter((i) => i.templateIndex === 104).map((i) => i.variant), [2, 3, 4, 5]);
  assert.deepEqual(shelf.filter((i) => i.templateIndex === 107).map((i) => i.variant), [1, 2, 3, 4, 5]);
  assert.equal(shelf.some((i) => i.templateIndex >= 109), false, 'no shields');
  const withCustom = rrCustomArmorStock(12, { mint, customTemplates: [530, 531] });
  assert.equal(withCustom.length, (21 + 2) * 3);
  assert.deepEqual(withCustom.filter((i) => i.templateIndex === 530).map((i) => i.material), [M.Mithril, M.Adamantium, M.Ebony]);
  assert.equal(withCustom.find((i) => i.templateIndex === 530).variant, undefined, 'a custom class: CreateItem + ApplyArmorSettings, its own variant setter');
  assert.equal(rrCustomArmorStock(8, { mint }).length, 0);
  // the real mint stands the items
  const real = rrCustomArmorStock(18, { customTemplates: [] });
  assert.equal(real.length, 21 * 5);
  assert.ok(real.every((i) => i.currentCondition > 0 && i.name));
  assert.equal(groupTemplates('Armor').length, 11);
  // the service (:419-484)
  const calls = [];
  const window = { messageBox: (t) => calls.push(['box', t]), openBuy: (items) => calls.push(['buy', items.length]) };
  assert.equal(rrCustomArmorService(window, { level: 8 }), false);
  assert.deepEqual(calls, [['box', RR_TEXT.notEnoughMaterials]]);
  calls.length = 0;
  assert.equal(rrCustomArmorService(window, { level: 9 }), true);
  assert.equal(calls[0][0], 'buy'); assert.ok(calls[0][1] >= 21);
});

// ---- Services.RegisterMerchantService (:146-175) --------------------------------------
test('RR3 the merchant service: the registry, the gate, the route, the popup\'s label and body', () => {
  assert.equal(hasCustomMerchantService(1022), true, 'the install registered Orthus Dharjen\'s');
  assert.equal(getCustomMerchantServiceLabel(1022), 'Custom Armor');
  assert.equal(typeof getCustomMerchantService(1022), 'function');
  assert.equal(registerMerchantService(1022, () => {}, 'x'), false, 'a faction with one is refused');
  assert.equal(hasCustomMerchantService(1023), false); assert.equal(getCustomMerchantService(1023), null); assert.equal(getCustomMerchantServiceLabel(1023), '');
  on('Enabled', false);
  assert.equal(hasCustomMerchantService(1022), false, 'the gate: the mod off is DFU\'s mod not loaded');
  assert.equal(getCustomMerchantService(1022), null);
  _resetModSettings();
  // the delegate runs the service on the popup's door
  const calls = [];
  getCustomMerchantService(1022)({ messageBox: (t) => calls.push(t) }, { level: 3 });
  assert.deepEqual(calls, [RR_TEXT.notEnoughMaterials]);
  // StaticNPCClick (PlayerActivate.cs:1574): a merchant with a custom service routes to the popup's Sell before the shop test
  const route = staticNpcRoute({ npcFactionId: 1022, npcFaction: { id: 1022, sgroup: SOCIAL_GROUPS.Merchants, ggroup: 0 }, buildingType: -1, insideBuilding: true, hasCustomMerchantService });
  assert.deepEqual(route, { kind: 'merchant', service: 'sell' });
  assert.equal(staticNpcRoute({ npcFactionId: 1022, npcFaction: { id: 1022, sgroup: SOCIAL_GROUPS.Merchants, ggroup: 0 }, buildingType: -1, insideBuilding: true }).kind, 'talk', 'without the registry read: DFU\'s empty registry');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /hasCustomMerchantService,\s*\/\/ RR3/);
  assert.match(wm, /const custom = getCustomMerchantService\(pn\.factionID\);/);
  assert.match(wm, /label: custom \? getCustomMerchantServiceLabel\(pn\.factionID\) : undefined,/);
  assert.match(wm, /function openCustomMerchantService\(service\) \{[\s\S]*?messageBox: \(text\) => mountInterior\(new ActionTextBox\(\[text\]\)\),[\s\S]*?const win = openTradeWindow\(\{ items \}, b, 'Buy'\);/);
  assert.match(rd('src/ui/merchantServiceWindow.js'), /const label = this\.hooks\.label \?\? merchantServiceLabel\(this\.hooks\.service\);/);
  // the reset seam
  _resetMerchantServices();
  assert.equal(hasCustomMerchantService(1022), false);
  registerMerchantService(1022, getCustomMerchantService(1022) ?? (() => {}), RR_TEXT.customArmor, () => true);
  _resetCustomFactions();
  assert.equal(customFactions().size, 0);
  for (const f of RR_CUSTOM_FACTIONS) registerCustomFaction(f.id, f);
});

test('RR3 the install: InitMod\'s order and the gates, by source', () => {
  const inst = rd('src/systems/rrInstall.js');
  assert.match(inst, /if \(!registerQuestList\(RR_QUEST_LIST, \(\) => rrEnabled\(\)\)\) throw new Error\('Quest list name is already in use, unable to register RoleplayRealism quest list\.'\);/);
  assert.match(inst, /if \(rrEnabled\(\)\) for \(const f of RR_CUSTOM_FACTIONS\) registerCustomFaction\(f\.id, f\);/);
  assert.match(inst, /addIntoQuestTables\(\{ places: \[\.\.\.RR_PLACES_TABLE\], factions: \[\.\.\.RR_FACTIONS_TABLE\] \}\);/);
  assert.match(inst, /registerMerchantService\(RR_FACTION_IDS\.OrthusDharjen, \(window, entity\) => rrCustomArmorService\(window, entity\), RR_TEXT\.customArmor, \(\) => rrEnabled\(\)\);/);
  const order = ['installRoleplayRealismArt();', 'registerQuestList(', 'registerCustomFaction(', 'addIntoQuestTables(', 'registerMerchantService('].map((s) => inst.indexOf(s));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), 'the C#\'s order: the list, the factions, the tables, the service');
  assert.match(rd('src/systems/quest/questLists.js'), /for \(const questList of registeredQuestLists\(\)\) this\._loadQuestList\(questList\);/);
  assert.match(rd('src/systems/factionRep.js'), /addCustomFactions\(dict\);\s*\/\/ Reset \(:331\)/);
});
