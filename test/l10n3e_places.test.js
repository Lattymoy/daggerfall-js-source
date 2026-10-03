// L10N3e (2026-09-27): THE PLACES, IN THE PLAYER'S LANGUAGE. DFU shows a location by GetLocalizedLocationName - the
// pack's Internal_Locations row by the location's MapTableData.MapId (never its index), else the canonical MAPS.BSA
// name - and a region by GetLocalizedRegionName, the `regionNames` row by index. Pinned here through the port's own
// functions, one DFU site family at a time: talk (Where am I, the regional building's %fcn, the town host's %cn and its
// building names), the quest's Place and Person macros and the building a quest names, the macro table's %cn / %crn /
// %reg / %cn2, the journal's find-place box, the travel map (its label, its find and list, the confirmation, the
// teleport box, the journal's goto), the bank (the status box, the deed, %reg) and the loan reminder. English is byte
// for byte what each showed before, with no language chosen and with English chosen again; and every key the name
// also serves - discovery, a journey's pick, a quest site, a palace's choice - still reads the canonical name.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { generateBuildingName, BUILDING_TYPES } from '../src/world/buildingNames.js';
import { Place } from '../src/systems/quest/place.js';
import { Person } from '../src/systems/quest/person.js';
import { getContextValue, setIdRegion } from '../src/systems/quest/questMacros.js';
import { QuestJournalWindow } from '../src/ui/questJournal.js';
import { TravelMapWindow, _setTravelMapArtForTests } from '../src/ui/travelMapWindow.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { restoreDiscovery } from '../src/systems/discovery.js';
import { createBankAccounts, createHouses, bankingStatusRows, allocateHouseToPlayer, borrowLoan, MINUTES_PER_MONTH } from '../src/systems/banking.js';
import { BankWindow } from '../src/ui/bankWindow.js';
import { runDayChange, MINUTES_PER_DAY } from '../src/systems/worldTick.js';

beforeEach(() => { tm._resetTextManagerForTests(); setIdRegion(-1); });

// Made-up French (never a pack's text). Daggerfall city's own map id is the one the port's CASTLE_DAGGERFALL_MAP_ID
// names (world/actionSystem.js) and the one DFU's master Internal_Locations keys "Daggerfall" by.
const DAGGERFALL_MAP_ID = 1291010263;
const FR_REGIONS = REGION_NAMES.map((_, i) => `Région ${i}`);
FR_REGIONS[17] = 'Royaume de Chutedague';
FR_REGIONS[23] = 'Royaume de Reposvoie';
/** The language's rows: `places` [mapId, name] into Internal_Locations, and the whole regionNames list. */
const fr = (places = []) => {
  tm.patchLocaleTable('fr', 'Internal_Locations', places.map(([id, name]) => [String(id), name]));
  tm.patchLocaleTable('fr', 'Internal_Strings', [['regionNames', FR_REGIONS.join('\n')]]);
  tm.setLocale('fr');
};
/** Runs `show` in English, in French (`places` and the region list), and in English chosen again. */
const inFrench = (places, show) => {
  const en = show();
  fr(places);
  const french = show();
  tm.setLocale('en');
  assert.deepEqual(show(), en, 'English chosen again reads as before');
  return { en, fr: french };
};

// ─── talk ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e places: Where am I names the place and the region as shown (PlayerGPS.cs:254/259 via TalkManager.cs:1531, :1536, :1547) - the location by its map id, the region by its index; the dungeon arm keeps DFU\'s canonical Summary.RegionName', () => {
  const region = { mapNames: ['Tulune', 'Daggerfall'], mapTable: [{ mapId: 42 }, { mapId: DAGGERFALL_MAP_ID }], mapNameLookup: new Map([['Tulune', 0], ['Daggerfall', 1]]) };
  const pipe = (over) => new AnswerPipeline({
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    currentLocationName: () => 'Daggerfall', currentRegionName: () => 'Daggerfall', currentRegionIndex: () => 17,
    currentRegion: () => region, ...over,
  });
  const show = () => [
    pipe().getAnswerWhereAmI(),
    pipe({ isPlayerInside: () => true, currentExteriorDoorBuildingKey: () => 5, getAnyBuilding: () => ({ displayName: 'The Odd Blades' }) }).getAnswerWhereAmI(),
    pipe({ isPlayerInside: () => true, isPlayerInsideDungeon: () => true, specialDungeonName: () => 'Privateer\'s Hold', dungeonRegionName: () => 'Daggerfall' }).getAnswerWhereAmI(),
    pipe({ currentRegionIndex: undefined }).getAnswerWhereAmI(),
  ];
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague']], show);
  assert.deepEqual(en, ['You are in Daggerfall in Daggerfall.', 'You are in The Odd Blades in Daggerfall.',
    'You are in Privateer\'s Hold in Daggerfall.', 'You are in Daggerfall in Daggerfall.']);
  assert.deepEqual(french, ['You are in Chutedague in Royaume de Chutedague.', 'You are in The Odd Blades in Chutedague.',
    'You are in Privateer\'s Hold in Daggerfall.', 'You are in Chutedague in Daggerfall.'],
  'no region index to read by: the host\'s canonical region name stands');
});

test('L10N3e places: the regional building\'s town (%fcn) is GetLocalizedLocationName(MapTableData.MapId, Name) (TalkManager.cs:1884); the location the walk returned keeps its canonical name', () => {
  const found = { name: 'Tulune', mapTableData: { mapId: 91234 } };
  const show = () => {
    const pipe = new AnswerPipeline({
      currentRegion: () => ({ locationCount: 1, mapTable: [{ key: 1 << 8 }] }),   // a tavern
      currentRegionIndex: () => 17, getLocation: () => found, rolls: () => 0, expandRandomTextRecord: (id) => `record:${id}`,
    });
    pipe.getRegionalLocationCityName({ index: 20 });   // row 20: the Tavern (lookup index 0x00)
    return pipe.locationOfRegionalBuilding;
  };
  const { en, fr: french } = inFrench([[91234, 'Tulûne-la-Neuve'], [1234, 'Ailleurs']], show);
  assert.equal(en, 'Tulune');
  assert.equal(french, 'Tulûne-la-Neuve', 'by the map id, not the location index');
  assert.equal(found.name, 'Tulune', 'the location record is untouched');
});

test('L10N3e places: the town talk host - %cn (MacroHelper.cs:571/:573), the court\'s and the trade windows\' city, and the name bag\'s shown pair (TalkManager.cs:2788-2789, :2857-2858); the canonical pair stays the bag\'s key, the palace\'s and the discovery\'s', async () => {
  const mk = (topics) => createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
    regionIndex: 17, topics,
  });
  const town = mk({ locationName: 'Daggerfall', regionName: 'Daggerfall', mapId: DAGGERFALL_MAP_ID, regionIndex: 17, exteriorBuildings: [], blocks: [] });
  const wild = mk({ regionName: 'Wayrest', regionIndex: 23, exteriorBuildings: [], blocks: [] });   // off-location: the region
  const warn = console.warn;
  console.warn = () => {};
  try { await town.ensureLoaded(); } finally { console.warn = warn; }
  const bank = () => generateBuildingName(3, BUILDING_TYPES.Bank, town.nameOpts());
  const show = () => {
    const o = town.nameOpts();
    return { cn: town.cityName(), court: town.locationName, wild: wild.cityName(), bag: [o.locationName, o.regionName, o.shownLocationName, o.shownRegionName], bank: bank() };
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague']], show);
  assert.deepEqual(en, { cn: 'Daggerfall', court: 'Daggerfall', wild: 'Wayrest', bag: ['Daggerfall', 'Daggerfall', 'Daggerfall', 'Daggerfall'], bank: 'The Bank of Daggerfall' });
  assert.deepEqual(french, {
    cn: 'Chutedague', court: 'Chutedague', wild: 'Royaume de Reposvoie',
    bag: ['Daggerfall', 'Daggerfall', 'Chutedague', 'Royaume de Chutedague'], bank: 'The Bank of Royaume de Chutedague',
  });
  // the discovery key is the canonical pair: the one line that files a revealed building reads cityName, and cityName
  // is the topics' own names
  const tt = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(tt, /const cityName = \(\) => topics\?\.locationName \?\? topics\?\.regionName \?\? '';/);
  assert.match(tt, /discoverBuilding\(`\$\{regionNow\(\)\}:\$\{cityName\(\)\}`, building, null, questBuildingSource\)/);
  assert.equal((tt.match(/shownCityName\(\)/g) ?? []).length, 5, 'the five places %cn is shown: two greetings, the answer, the accessor, the court');
});

test('L10N3e places: a building\'s name shows the pair as the language has it - a shop\'s %cn, the bank\'s region - while the CANONICAL location still chooses the palace (FormulaHelper.cs:3043-3048)', () => {
  const cnSeed = [...Array(400).keys()].find((s) => generateBuildingName(s, BUILDING_TYPES.GeneralStore, { locationName: 'Daggerfall' }).includes('Daggerfall'));
  assert.ok(cnSeed !== undefined, 'a seed whose shop name carries %cn');
  const opts = { locationName: 'Daggerfall', regionName: 'Daggerfall', shownLocationName: 'Chutedague', shownRegionName: 'Royaume de Chutedague',
    palaceName: (n) => (n === 'Daggerfall' ? 'Castle Daggerfall' : null) };
  const english = generateBuildingName(cnSeed, BUILDING_TYPES.GeneralStore, { locationName: 'Daggerfall', regionName: 'Daggerfall' });
  assert.equal(generateBuildingName(cnSeed, BUILDING_TYPES.GeneralStore, opts), english.replaceAll('Daggerfall', 'Chutedague'),
    'the same draw, the shown name where %cn stood');
  assert.equal(generateBuildingName(9, BUILDING_TYPES.Bank, opts), 'The Bank of Royaume de Chutedague');
  assert.equal(generateBuildingName(9, BUILDING_TYPES.Palace, opts), 'Castle Daggerfall', 'the palace is chosen by the canonical name');
  assert.equal(generateBuildingName(9, BUILDING_TYPES.Bank, { regionName: 'Daggerfall' }), 'The Bank of Daggerfall', 'no shown pair: the canonical one');
});

// ─── the quest ───────────────────────────────────────────────────────────────────────────────────────────────────

const questWith = (places = {}) => {
  const regions = { 17: { name: 'Daggerfall' }, 23: { name: 'Wayrest' } };
  const world = { maps: { getRegion: (i) => regions[i] ?? null, getRegionIndex: (n) => REGION_NAMES.indexOf(n) } };
  return { hooks: { world }, getPlace: (s) => places[s] ?? null, lastPlaceReferenced: null, lastResourceReferenced: null };
};
const placeAt = (quest, siteDetails) => { const p = new Place(quest); p.siteDetails = siteDetails; return p; };

test('L10N3e places: a quest Place\'s ___/____ macros show its town by the site\'s map id and its region by index (Place.cs:261, :265, :276, :281), the legacy regionIndex-0 arm through the region name; the site keeps its canonical names', () => {
  const quest = questWith();
  const site = { mapId: DAGGERFALL_MAP_ID, locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, buildingName: 'The Odd Blades' };
  const legacy = { mapId: 630439035, locationName: 'Wayrest', regionName: 'Wayrest', regionIndex: 0 };   // a save before SiteDetails carried the index
  const show = () => {
    const p = placeAt(quest, site), old = placeAt(quest, legacy);
    return [p.expandMacro(1), p.expandMacro(2), p.expandMacro(3), p.expandMacro(4), old.expandMacro(3), old.expandMacro(4)];
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague'], [630439035, 'Reposvoie']], show);
  assert.deepEqual(en, ['The Odd Blades', 'Daggerfall', 'Daggerfall', 'Daggerfall', 'Wayrest', 'Wayrest']);
  assert.deepEqual(french, ['The Odd Blades', 'Chutedague', 'Chutedague', 'Royaume de Chutedague', 'Reposvoie', 'Royaume de Reposvoie']);
  assert.deepEqual([site.locationName, site.regionName, legacy.locationName], ['Daggerfall', 'Daggerfall', 'Wayrest'], 'the keys are untouched');
});

test('L10N3e places: a quest Person\'s ___/____ macros read the dialog place\'s town and region as shown (Person.cs:319, :323); a person who stands nowhere is BLANK in any language', () => {
  const home = placeAt(null, { mapId: DAGGERFALL_MAP_ID, locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, buildingName: 'The Odd Blades' });
  const quest = questWith({ home });
  home.parentQuest = quest;
  const show = () => {
    const p = new Person(quest);
    p.assignedPlaceSymbol = 'home';
    const nowhere = new Person(quest);
    return [p.expandMacro(2), p.expandMacro(3), p.expandMacro(4), nowhere.expandMacro(3), nowhere.expandMacro(4)];
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague']], show);
  assert.deepEqual(en, ['The Odd Blades', 'Daggerfall', 'Daggerfall', 'BLANK', 'BLANK']);
  assert.deepEqual(french, ['The Odd Blades', 'Chutedague', 'Royaume de Chutedague', 'BLANK', 'BLANK']);
});

test('L10N3e places: the building a quest names (Place.cs:1320-1321) shows ITS location and region, not the host\'s current ones, while the canonical pair chooses the palace', () => {
  const quest = questWith();
  const location = { name: 'Wayrest', regionName: 'Wayrest', regionIndex: 23, mapTableData: { mapId: 630439035 } };
  const here = { locationName: 'Daggerfall', regionName: 'Daggerfall', shownLocationName: 'Ici', shownRegionName: 'Ici aussi',
    palaceName: (n) => (n === 'Wayrest' ? 'Castle Wayrest' : null) };
  const world = { ...quest.hooks.world, buildingNameOpts: () => here };
  const cnSeed = [...Array(400).keys()].find((s) => generateBuildingName(s, BUILDING_TYPES.GeneralStore, { locationName: 'Wayrest' }).includes('Wayrest'));
  assert.ok(cnSeed !== undefined, 'a seed whose shop name carries %cn');
  const show = () => {
    const p = new Place(quest);
    return [[BUILDING_TYPES.Bank, 9], [BUILDING_TYPES.Palace, 9], [BUILDING_TYPES.GeneralStore, cnSeed]]
      .map(([t, seed]) => p._getBuildingName(world, t, location, { nameSeed: seed, buildingType: t, factionId: 0 }));
  };
  const { en, fr: french } = inFrench([[630439035, 'Reposvoie']], show);
  assert.deepEqual(en.slice(0, 2), ['The Bank of Wayrest', 'Castle Wayrest']);
  assert.ok(en[2].includes('Wayrest') && !en[2].includes('Ici'), 'the shop\'s %cn is ITS town, not the host\'s');
  assert.deepEqual(french, ['The Bank of Royaume de Reposvoie', 'Castle Wayrest', en[2].replaceAll('Wayrest', 'Reposvoie')],
    'the shop\'s %cn: the town by its map id, as shown');
});

test('L10N3e places: the macro table - %cn by the current location\'s map id, else the region (MacroHelper.cs:571, :573), %crn (:590), %reg by idRegion (:1053) or the current region, %cn2 by the row\'s map id (:583)', () => {
  const region17 = { name: 'Daggerfall', mapNames: ['Daggerfall', 'Tulune'], mapTable: [{ mapId: DAGGERFALL_MAP_ID, locationType: LOCATION_TYPES.TownCity }, { mapId: 42, locationType: LOCATION_TYPES.TownCity }] };
  const regions = { 17: region17, 23: { name: 'Wayrest' } };
  const world = (here) => ({
    maps: { getRegion: (i) => regions[i] ?? null },
    currentRegionIndex: () => 17, currentLocationIndex: () => 0,
    currentLocation: () => here,
  });
  const at = (w, sym) => { const hooks = { world: w }; return getContextValue(sym, { uid: 1, hooks }, hooks); };
  const inTown = world({ loaded: true, name: 'Daggerfall', mapTableData: { mapId: DAGGERFALL_MAP_ID } });
  const outside = world(null);
  const show = () => {
    const out = [at(inTown, '%cn'), at(outside, '%cn'), at(inTown, '%crn'), at(inTown, '%reg'), at(inTown, '%cn2')];
    setIdRegion(23);
    out.push(at(inTown, '%reg'));
    setIdRegion(-1);
    return out;
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague'], [42, 'Tulûne-la-Neuve']], show);
  assert.deepEqual(en, ['Daggerfall', 'Daggerfall', 'Daggerfall', 'Daggerfall', 'Tulune', 'Wayrest']);
  assert.deepEqual(french, ['Chutedague', 'Royaume de Chutedague', 'Royaume de Chutedague', 'Royaume de Chutedague', 'Tulûne-la-Neuve', 'Royaume de Reposvoie']);
});

// ─── the journal ─────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e places: the journal\'s find-place entry "{0} in {1} province" is displayed with the place\'s own name and the patched region\'s (DaggerfallQuestJournalWindow.cs:459-462); the gates ask through the canonical names', () => {
  const asked = [];
  const place = { isPlace: true, siteDetails: { locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, mapId: DAGGERFALL_MAP_ID } };
  const show = () => {
    const find = new QuestJournalWindow({
      questMessages: () => [{ getTextTokens: () => [{ text: 'Meet me at _dungeon_.', formatting: 'text' }], parentQuest: { getResource: ({ name }) => (name === 'dungeon' ? place : null) } }],
      currentLocationName: () => 'Wayrest', canFindPlace: (r, n) => { asked.push([r, n]); return true; }, gotoPlace() {},
    });
    find._font = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 } };
    find._handleQuestClicks(find.deps.questMessages()[0]);
    return find.findBox.rows[3].text;
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague']], show);
  assert.equal(en, 'Daggerfall in Daggerfall province');
  assert.equal(french, 'Chutedague in Royaume de Chutedague province');
  assert.deepEqual(asked, [['Daggerfall', 'Daggerfall'], ['Daggerfall', 'Daggerfall'], ['Daggerfall', 'Daggerfall']], 'CanFindPlace is asked by the canonical names, in every language');
});

// ─── the travel map ──────────────────────────────────────────────────────────────────────────────────────────────

const DAGGERFALL = 17;
const ORIGIN = [39, 106];   // FMAP0I17.IMG
const row = (x, y, locationType, discovered = true) => ({
  mapId: (DAGGERFALL << 20) | getMapPixelID(x, y), longitude: x * 128, latitude: (499 - y) * 128,
  locationType, discovered, dungeonType: 255, key: 0, locationId: 0,
});
const ENTRIES = [
  { name: 'Daggerfall', row: row(50, 120, LOCATION_TYPES.TownCity) },
  { name: 'Daggerfall Chapel', row: row(54, 122, LOCATION_TYPES.ReligionTemple) },
];
const CITY_ID = ENTRIES[0].row.mapId, CHAPEL_ID = ENTRIES[1].row.mapId;
function mapWorld(over = {}) {
  resetTravelMapState();
  const region = {
    name: REGION_NAMES[DAGGERFALL], locationCount: ENTRIES.length, mapNames: ENTRIES.map((e) => e.name), mapTable: ENTRIES.map((e) => e.row),
    mapNameLookup: new Map(ENTRIES.map((e, i) => [e.name, i])), mapIdLookup: new Map(ENTRIES.map((e, i) => [e.row.mapId, i])),
  };
  const regions = { [DAGGERFALL]: region };
  const maps = {
    regionCount: 62, getRegion: (i) => regions[i] ?? null, getRegionByName: (n) => (n === region.name ? region : null),
    getRegionName: (i) => REGION_NAMES[i] ?? '', getPoliticIndex: () => 128 + DAGGERFALL, getClimateIndex: () => CLIMATES.Woodlands,
  };
  const picks = [];
  const deps = {
    maps, mapDict: buildMapDict({ regionCount: 62, getRegion: (i) => regions[i] ?? null }),
    getPlayerPixel: () => ({ x: 50, y: 120 }), getClimateIndex: () => CLIMATES.Woodlands, gold: () => 1000, diseaseCount: () => 0,
    onTravel: (pick) => picks.push(pick), onTeleport: (pick) => picks.push(pick), ...over,
  };
  return { deps, picks };
}
const img = (name, w, h) => ({ tex: `tex:${name}`, w, h });
function mountMapArt() {
  _setTravelMapArtForTests({
    overworld: img('TRAV0I00', 320, 200), findAt: img('TRAV0I03', 45, 22), filterOn: img('TRAV01I0', 179, 22), filterOff: img('TRAV01I1', 179, 22),
    downArrow: img('TRAVAI05', 22, 20), upArrow: img('TRAVBI05', 22, 20), rightArrow: img('TRAVCI05', 22, 20), leftArrow: img('TRAVDI05', 22, 20),
    border: img('MBRD00I0', 320, 160), pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
    fmapPalette: null, textRsc: null, locationPixelColors: new Array(14).fill(0).map((_, i) => 0xff000001 + i), identifyFlashColor: 0xff0f27a3,
    regionMaps: new Map([['FMAP0I17.IMG', img('FMAP0I17', 320, 160)]]), deps: {},
  });
}
const FR_PLACES = [[CITY_ID, 'Chutedague'], [CHAPEL_ID, 'Chapelle de Chutedague']];

test('L10N3e places: the travel map SHOWS the language\'s names - the region label (:1622), the location in it (:1641), the confirmation\'s %tcn (:1695) and the find and list over localizedMapNameLookup (:1472) - while a journey hands its host the canonical name and region', () => {
  restoreDiscovery(null);
  mountMapArt();
  try {
    const show = () => {
      const { deps, picks } = mapWorld();
      const w = new TravelMapWindow(deps);
      w._openRegionPanel(DAGGERFALL);
      w.hover(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
      const label = w.regionLabelText();
      const list = w._currentRegionMapNames().sort();   // the L key's list
      w._handleLocationFindEvent(list.find((n) => !n.includes(' ')));   // the city, typed as the map shows it
      const found = w.locationSummary?.mapID;
      const confirm = w._confirmRows().map((r) => r.text ?? r).join(' ');
      w._createPopUpWindow();
      w.popUp.deps.onTravel({ x: 50, y: 120 }, {}, {});   // the popup's journey, begun
      return { label, list, found, confirm, pick: picks.map((p) => [p.name, p.region, p.mapId]) };
    };
    const { en, fr: french } = inFrench(FR_PLACES, show);
    assert.deepEqual(en, { label: 'Daggerfall : Daggerfall', list: ['Daggerfall', 'Daggerfall Chapel'], found: CITY_ID,
      confirm: 'Do you wish to travel to Daggerfall?', pick: [['Daggerfall', 'Daggerfall', CITY_ID]] });
    assert.deepEqual(french, { label: 'Royaume de Chutedague : Chutedague', list: ['Chapelle de Chutedague', 'Chutedague'], found: CITY_ID,
      confirm: 'Do you wish to travel to Chutedague?', pick: [['Daggerfall', 'Daggerfall', CITY_ID]] });
    // An EMPTY row. GetLocationNameInCurrentRegion reads it as no name (:1642) and shows the canonical one; :1695 asks
    // again over that, and TextProvider.GetLocalizedString (TextProvider.cs:314-320) answers an empty entry as found -
    // so DFU's confirmation names no place. The port asks twice, as DFU does.
    fr([[CITY_ID, '']]);
    const { deps } = mapWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.hover(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    assert.equal(w.regionLabelText(), 'Royaume de Chutedague : Daggerfall', 'the label: an empty row is no name');
    assert.equal(w._confirmRows().map((r) => r.text ?? r).join(' '), 'Do you wish to travel to ?', 'the confirmation: DFU\'s second lookup finds the empty row');
  } finally { _setTravelMapArtForTests(null); }
});

test('L10N3e places: the teleport box shows the destination as the language names it (DestinationName, :1712) and hands the host the canonical one; the journal\'s goto searches by the place\'s shown name (:447)', () => {
  restoreDiscovery(null);
  mountMapArt();
  try {
    const show = () => {
      const { deps, picks } = mapWorld();
      const tele = new TravelMapWindow(deps);
      tele.activateTeleportationTravel();
      tele._openRegionPanel(DAGGERFALL);
      tele.hover(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
      tele.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
      const shown = tele.telePopUp.destination.name;
      tele.telePopUp.input('KeyY');
      const goto = new TravelMapWindow(mapWorld().deps);
      goto.gotoPlace({ siteDetails: { mapId: CITY_ID, locationName: 'Daggerfall', regionName: 'Daggerfall', regionIndex: DAGGERFALL } });
      goto.tick(0);
      return { shown, pick: picks.map((p) => [p.name, p.region]), goto: [goto.locationSelected, goto.locationSummary?.mapID] };
    };
    const { en, fr: french } = inFrench(FR_PLACES, show);
    assert.deepEqual(en, { shown: 'Daggerfall', pick: [['Daggerfall', 'Daggerfall']], goto: [true, CITY_ID] });
    assert.deepEqual(french, { shown: 'Chutedague', pick: [['Daggerfall', 'Daggerfall']], goto: [true, CITY_ID] });
  } finally { _setTravelMapArtForTests(null); }
});

// ─── the bank and the loan ───────────────────────────────────────────────────────────────────────────────────────

test('L10N3e places: the bank - the status box\'s region column (DaggerfallBankingWindow.cs:537), the deed\'s region (DaggerfallBankManager.cs:447) and the records\' %reg (MacroHelper.cs:1053, :590) are shown; the house slot keeps its canonical town', () => {
  const show = () => {
    const accounts = createBankAccounts(62);
    accounts[17].accountGold = 500;
    const status = bankingStatusRows(accounts, { regionName: (i) => REGION_NAMES[i] ?? '' })[2].cells[0].text;
    const houses = createHouses(62);
    let note = null;
    allocateHouseToPlayer(houses, 17, { buildingKey: 7, mapId: DAGGERFALL_MAP_ID, location: 'Daggerfall' }, { regionName: 'Daggerfall', addNote: (t) => { note = t; } });
    const w = new BankWindow({ accounts: () => accounts, regionIndex: () => 17, regionName: () => 'Daggerfall', cityName: () => 'Daggerfall' });
    return { status, note, slot: houses[17].location, reg: w._macros(0).reg };
  };
  const { en, fr: french } = inFrench([[DAGGERFALL_MAP_ID, 'Chutedague']], show);
  assert.deepEqual(en, { status: 'Daggerfall', note: 'Deed to a house in Daggerfall, Daggerfall.', slot: 'Daggerfall', reg: 'Daggerfall' });
  assert.deepEqual(french, { status: 'Royaume de ...', note: 'Deed to a house in Daggerfall, Royaume de Chutedague.', slot: 'Daggerfall', reg: 'Royaume de Chutedague' },
    'ShortenName over the shown name; DFU\'s deed keeps location.Name for %town');
  assert.equal(new BankWindow({ accounts: () => [], regionIndex: () => 17 })._macros(0).reg, null, 'no producer: the token stands, in any language');
});

test('L10N3e places: the loan reminder\'s second line names the region as shown (LoanChecker.cs:45)', () => {
  const show = () => {
    const e = { bankAccounts: createBankAccounts(62), regionPrices: {}, factionRep: null, legalRep: {} };
    borrowLoan(e.bankAccounts, 17, 1000, { level: 10, nowMinutes: 0 });
    const due = e.bankAccounts[17].loanDueDate;
    const said = [];
    const at = due - 6 * MINUTES_PER_MONTH;
    runDayChange({ entity: e, lastMinutes: at - 1, nowMinutes: at + MINUTES_PER_DAY, rolls: () => 0.5, say: (t) => said.push(t) });
    return said[1];
  };
  const { en, fr: french } = inFrench([], show);
  assert.equal(en, 'less than 6 months in Daggerfall');
  assert.equal(french, 'less than 6 months in Royaume de Chutedague');
});
