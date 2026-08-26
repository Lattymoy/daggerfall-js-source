// AUDIT 26, wave systems-2.
//
// F191 - RegionPowerAndConditionsUpdate's CONDITIONS half
// (PlayerEntity.cs:1697-2118) and the 38-day arm that runs it
// (:468-472). The relation mutators (systems/factionRelations.js) and
// the region store (systems/regionConditions.js) had both shipped; the
// member that drives them had not, so no alliance ever ended, no war
// ever started and no region flag ever flipped for the life of a
// character.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionPowerUpdate, ALWAYS_AVAILABLE_RUMORS } from '../src/systems/regionPower.js';
import { createRegionConditions, REGION_FLAGS } from '../src/systems/regionConditions.js';
import {
  tickPlayerMinutes, CLASSIC_MINUTES_PER_SECOND,
  FACTION_POWER_INTERVAL_MINUTES, REGION_CONDITIONS_INTERVAL_MINUTES,
} from '../src/systems/worldTick.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const f = (o) => ({
  id: 1, parent: 0, type: FACTION_TYPES.Province, power: 50, rulerPowerBonus: 0, flags: 0,
  region: -1, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, ...o,
});
const store = (...fs) => ({ dict: new Map(fs.map((x) => [x.id, x])) });
const litFlags = (record) => Object.entries(REGION_FLAGS)
  .filter(([, bit]) => record.flags[bit]).map(([name]) => name);

// ── the conditions body, end to end ─────────────────────────────────

test('AUDIT 26 F191: the conditions half ends the alliance, starts the rivalry and opens the war', () => {
  // Two allied provinces whose regions BORDER (BORDER_REGIONS row 0
  // carries 2), which is what makes their new rivalry a war rather than
  // an ordinary falling-out - IsEnemyStatePermanentUntilWarOver.
  const alikr = f({ id: 100, region: 0, ally1: 200 });
  const dwynnen = f({ id: 200, region: 2, ally1: 100 });
  const s = store(alikr, dwynnen);
  const conditions = createRegionConditions();
  const filed = [];
  const mill = {
    refreshRumorMill: () => filed.push(['refresh']),
    addNonQuestRumor: (...args) => filed.push(args),
  };

  // A constant 0.99 roll is Dice100.Roll() == 100 - every FailedRoll
  // against a chance under 100 fires and every SuccessRoll misses, so
  // the whole ladder is decided by the law rather than by the stream.
  const walked = regionPowerUpdate(s, {
    rumorMill: mill, rolls: () => 0.99, updateConditions: true, regionConditions: conditions,
  });
  assert.deepEqual(walked, { walked: 2, changed: 2 });

  // :1697-1706 - the alliance ends on BOTH records (EndFactionAllies is
  // symmetric), and :1871-1935 puts each in the other's first enemy slot.
  assert.deepEqual(
    { ally1: alikr.ally1, enemy1: alikr.enemy1, power: alikr.power },
    { ally1: 0, enemy1: 200, power: 49 },
  );
  assert.deepEqual(
    { ally1: dwynnen.ally1, enemy1: dwynnen.enemy1, power: dwynnen.power },
    { ally1: 0, enemy1: 100, power: 49 },
  );

  // The region flags. Region 0 is left at WarBeginning by the rivalry
  // arm; region 2 reaches the war arm on the SECOND faction's pass with
  // WarBeginning already lit, so :1803-1809 promotes it to WarOngoing -
  // and TurnOnConditionFlag clears the rest of the war group as it goes,
  // which is why WarBeginning is not still standing beside it.
  assert.deepEqual(litFlags(conditions[0]), ['WarBeginning']);
  assert.deepEqual(litFlags(conditions[2]), ['WarOngoing']);

  // Every rumor the body files, in DFU's order. RefreshRumorMill is the
  // member's first line (:1630); the seven at the tail (:2112-2118) are
  // re-seeded once per conditions update, outside the faction walk.
  assert.deepEqual(filed, [
    ['refresh'],
    [100, 200, -1, 100, 1402],   // End faction allies
    [100, 200, 0, 27, 1482],     // Enemy faction sign message, both provinces
    [200, 100, 2, 27, 1482],
    [100, 200, -1, 100, 1401],   // Faction rivalry started
    [100, 200, -1, 100, 1407],   // War started/ongoing
    [100, 200, 0, 28, 1479],     // War started sign message, both provinces
    [200, 100, 2, 28, 1479],
    [100, 0, -1, 12, 1480],      // New ruler
    [200, 100, 2, 0, 1479],      // ...and the war arm's own pair on the second pass
    [100, 200, 0, 0, 1479],
    [200, 0, -1, 12, 1480],
    [0, 0, -1, 100, 1450],
    [0, 0, -1, 100, 1451],
    [0, 0, -1, 100, 1452],
    [0, 0, -1, 100, 1453],
    [0, 0, -1, 100, 1454],
    [0, 0, -1, 100, 1455],
    [0, 0, -1, 100, 1456],
  ]);
  assert.deepEqual([...ALWAYS_AVAILABLE_RUMORS], [1450, 1451, 1452, 1453, 1454, 1455, 1456]);
});

test('AUDIT 26 F191: the power half alone leaves every relation and flag untouched', () => {
  // updateConditions false is DFU's 7-day call (:461-462): the same
  // member, and it must move powers and nothing else.
  const alikr = f({ id: 100, region: 0, ally1: 200 });
  const dwynnen = f({ id: 200, region: 2, ally1: 100 });
  const conditions = createRegionConditions();
  const filed = [];
  regionPowerUpdate(store(alikr, dwynnen), {
    rumorMill: { refreshRumorMill: () => {}, addNonQuestRumor: (...a) => filed.push(a) },
    rolls: () => 0.99, regionConditions: conditions,
  });
  assert.deepEqual([alikr.ally1, alikr.enemy1, dwynnen.ally1, dwynnen.enemy1], [200, 0, 100, 0]);
  assert.deepEqual(litFlags(conditions[0]), []);
  assert.deepEqual(litFlags(conditions[2]), []);
  assert.deepEqual(filed, []);
});

// ── the wiring: the 38-day arm, which is what was missing ───────────

test('AUDIT 26 F191: the 38-day tick arm runs the conditions half; the 7-day arm does not', () => {
  const entityWith = (faction, lastGameMinutes) => ({
    health: 20, maxHealth: 20, fatigue: 500, stats: {}, skills: [30], skillUses: [],
    items: [], activeEffects: [], regionPrices: {}, legalRep: {},
    factionRep: store(faction), regionConditions: createRegionConditions(),
    lastGameMinutes,
  });
  const run = (entity, from) => tickPlayerMinutes({
    entity, classicMinutes: from, dt: 5 / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0.99, say: () => {},
  });

  // The 7-day arm: PlayerEntity.cs:461-462 passes updateConditions
  // FALSE, so not one of the seven always-available rumors is re-seeded.
  const seven = f({ id: 100, region: 0, type: FACTION_TYPES.Province });
  const sevenDay = entityWith(seven, FACTION_POWER_INTERVAL_MINUTES);
  const sevenFiled = [];
  sevenDay.rumorMill = { refreshRumorMill: () => {}, addNonQuestRumor: (...a) => sevenFiled.push(a) };
  run(sevenDay, FACTION_POWER_INTERVAL_MINUTES);
  assert.equal(seven.power, 49, 'the power half ran');
  assert.deepEqual(sevenFiled, [], ':462 is RegionPowerAndConditionsUpdate(false)');

  // The 38-day arm: :468-472 passes TRUE, and the conditions half runs
  // over the entity's own region store. A new ruler and the seven
  // rumors are the two effects a lone faction with no allies reaches.
  const thirtyEight = f({ id: 100, region: 0, type: FACTION_TYPES.Province, rulerPowerBonus: 0 });
  const conditionsDay = entityWith(thirtyEight, REGION_CONDITIONS_INTERVAL_MINUTES);
  const conditionsFiled = [];
  conditionsDay.rumorMill = { refreshRumorMill: () => {}, addNonQuestRumor: (...a) => conditionsFiled.push(a) };
  run(conditionsDay, REGION_CONDITIONS_INTERVAL_MINUTES);
  assert.equal(REGION_CONDITIONS_INTERVAL_MINUTES % FACTION_POWER_INTERVAL_MINUTES !== 0, true,
    'minute 54720 is NOT also a 7-day minute, so only the conditions arm fires here');
  assert.deepEqual(conditionsFiled, [
    [100, 0, -1, 12, 1480],      // :1941 - New ruler, the ONE mutator a lone province reaches
    [0, 0, -1, 100, 1450],
    [0, 0, -1, 100, 1451],
    [0, 0, -1, 100, 1452],
    [0, 0, -1, 100, 1453],
    [0, 0, -1, 100, 1454],
    [0, 0, -1, 100, 1455],
    [0, 0, -1, 100, 1456],
  ]);
  assert.equal(thirtyEight.rulerPowerBonus >= 20 && thirtyEight.rulerPowerBonus <= 70, true,
    'SetNewRulerData (:851-865) - random_range_inclusive(0, 50) + 20');
});

// ── F195 - the journal's click-to-find-place ────────────────────────
//
// DaggerfallQuestJournalWindow HandleClick (:385-401) -> HandleQuestClicks
// (:439-466) -> GetLastPlaceMentionedInMessage (:469-485) -> the
// confirmFind dialog -> DfTravelMapWindow.GotoPlace (:214-217). The port
// had GetMessageResources translated with no caller and the journal's log
// rect swallowing every click, so the classic navigation aid was gone.

import { QuestJournalWindow, JOURNAL_RECTS, FIND_PLACE_TEXT } from '../src/ui/questJournal.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { TravelMapWindow, OFFSET_LOOKUP, _setTravelMapArtForTests } from '../src/ui/travelMapWindow.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID, patchRegionIndex } from '../src/formats/mapsFile.js';
import { restoreDiscovery } from '../src/systems/discovery.js';

// questLogLabel's font: LineHeight is glyph height x textScale, and the
// window caches the font off its own draw.
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 } };

const placeAt = (locationName, regionName, regionIndex) => ({
  isPlace: true, siteDetails: { locationName, regionName, regionIndex, mapId: 1 },
});
/** A quest Message whose text names ONE Place through a symbol macro. */
const messageNaming = (symbol, place, text) => ({
  getTextTokens: () => [{ text, formatting: 'text' }],
  parentQuest: { getResource: ({ name }) => (name === symbol ? place : null) },
});

function journalWith(place, { here = 'Wayrest', findable = true, host = true } = {}) {
  const asked = [];
  const sent = [];
  const win = new QuestJournalWindow({
    questMessages: () => [messageNaming('dungeon', place, 'Meet me at _dungeon_ before dusk.')],
    currentLocationName: () => here,
    canFindPlace: (regionName, name) => { asked.push([regionName, name]); return findable; },
    gotoPlace: host ? ((p) => sent.push(p)) : null,
  });
  win._font = FONT;   // what draw() caches; the click divides by its height
  return { win, asked, sent };
}

test('AUDIT 26 F195: clicking an active quest offers the find dialog, and Yes sends the Place to the map', () => {
  const place = placeAt('Daggerfall', 'Daggerfall', 17);
  const { win, asked, sent } = journalWith(place);

  // A click inside the log rect on the entry's first line.
  assert.equal(win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1), true);
  assert.equal(win.selectedEntry, 0, 'entryLineMap maps the line to its ABSOLUTE entry index');
  assert.deepEqual(asked, [['Daggerfall', 'Daggerfall']],
    'CanFindPlace (:452) is asked through the CANONICAL region and location names');

  // CreateDialogBox (:486-504) over confirmFind, and the entry line is
  // locationInRegionProvince (:478-481).
  assert.deepEqual(win.findBox.rows, [
    { text: FIND_PLACE_TEXT.head, center: true },
    { text: FIND_PLACE_TEXT.action, center: false },
    { text: '', center: false },
    { text: 'Daggerfall in Daggerfall province', center: true },
    { text: FIND_PLACE_TEXT.note, center: false },
  ]);
  assert.deepEqual(
    [FIND_PLACE_TEXT.head, FIND_PLACE_TEXT.action, FIND_PLACE_TEXT.note],
    ['Travel to location',
      'Do you want to open the world map to travel to:',
      '(Note: you can cancel travel from the world map)'],
    'Internal_Strings.csv :799-801, verbatim',
  );

  // FindPlace_OnButtonClick (:353-363): the journal closes and the map
  // gets the Place.
  win.answerFindPlace(MB_BUTTONS.Yes);
  assert.deepEqual(sent, [place]);
  assert.equal(win.done, true, 'this.CloseWindow() (:359)');
  assert.equal(win.findBox, null);
  assert.equal(win.findPlace, null);
});

test('AUDIT 26 F195: No closes the box and travels nowhere; the three gates each refuse', () => {
  const place = placeAt('Daggerfall', 'Daggerfall', 17);

  const no = journalWith(place);
  no.win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
  no.win.answerFindPlace(MB_BUTTONS.No);
  assert.deepEqual(no.sent, []);
  assert.equal(no.win.done, false, 'the journal stays open');

  // :450 - the place the player is ALREADY standing in is not offered.
  const home = journalWith(place, { here: 'Daggerfall' });
  home.win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
  assert.equal(home.win.findBox, null);
  assert.deepEqual(home.asked, [], 'CanFindPlace is not even asked');

  // :452 - an undiscovered location cannot be found, so no dialog.
  const hidden = journalWith(place, { findable: false });
  hidden.win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
  assert.equal(hidden.win.findBox, null);

  // A message that names no Place at all - DFU's own example is the
  // Dark Brotherhood initiation, whose entry is kept secret (:469-472).
  const secret = new QuestJournalWindow({
    questMessages: () => [messageNaming('dungeon', null, 'Tell no one of this.')],
    currentLocationName: () => 'Wayrest',
    canFindPlace: () => true,
    gotoPlace: () => assert.fail('a message with no Place must not travel'),
  });
  secret._font = FONT;
  secret.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
  assert.equal(secret.findBox, null);

  // A host with no travel map (the dungeon context, the `?town` page)
  // leaves gotoPlace unset and the click is the nothing it always was.
  const mapless = journalWith(place, { host: false });
  mapless.win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
  assert.equal(mapless.win.findBox, null);
});

test('AUDIT 26 F195: PatchRegionIndex only rescues an uninitialised index', () => {
  // MapsFile.cs:550-569 - the workaround for legacy SiteDetails.
  assert.equal(patchRegionIndex(17, 'Daggerfall'), 17, 'a real index is left alone');
  assert.equal(patchRegionIndex(0, REGION_NAMES[0]), 0, 'a player genuinely in Alik\'r matches');
  assert.equal(patchRegionIndex(0, 'Daggerfall'), 17, '0 plus a disagreeing name rescans');
  assert.equal(patchRegionIndex(0, 'Nowhere'), 0, 'and a name in no row falls back to 0, not -1');
});

// ── F195's other end: the map opens already on the place ────────────

const DAGGERFALL = 17;
const mapIdOf = (x, y) => (DAGGERFALL << 20) | getMapPixelID(x, y);
const mapRow = (x, y, locationType, discovered) => ({
  mapId: mapIdOf(x, y), longitude: x * 128, latitude: (499 - y) * 128,
  locationType, discovered, dungeonType: 255,
});

test('AUDIT 26 F195: GotoPlace is pending until the map ticks, then opens its region and finds it', () => {
  resetTravelMapState();
  restoreDiscovery(null);
  _setTravelMapArtForTests({
    overworld: { tex: 't', w: 320, h: 200 },
    findAt: { tex: 't', w: 45, h: 22 },
    filterOn: { tex: 't', w: 179, h: 22 }, filterOff: { tex: 't', w: 179, h: 22 },
    downArrow: { tex: 't', w: 22, h: 20 }, upArrow: { tex: 't', w: 22, h: 20 },
    rightArrow: { tex: 't', w: 22, h: 20 }, leftArrow: { tex: 't', w: 22, h: 20 },
    border: { tex: 't', w: 320, h: 160 },
    pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
    fmapPalette: null, textRsc: null,
    locationPixelColors: new Array(14).fill(0).map((_, i) => 0xff000001 + i),
    identifyFlashColor: 0xff0f27a3, regionMaps: new Map(), deps: {},
  });
  try {
    assert.ok(OFFSET_LOOKUP['FMAP0I17.IMG'], 'Daggerfall has a region page');
    const mapNames = ['Daggerfall'];
    const mapTable = [mapRow(50, 120, LOCATION_TYPES.TownCity, true)];
    const region = {
      name: REGION_NAMES[DAGGERFALL], locationCount: 1, mapNames, mapTable,
      mapNameLookup: new Map([['Daggerfall', 0]]),
      mapIdLookup: new Map([[mapTable[0].mapId, 0]]),
    };
    const maps = {
      regionCount: 62,
      getRegion: (i) => (i === DAGGERFALL ? region : null),
      getRegionByName: (n) => (n === region.name ? region : null),
      getRegionName: (i) => REGION_NAMES[i] ?? '',
      getPoliticIndex: () => 128 + DAGGERFALL,
      getClimateIndex: () => CLIMATES.Woodlands,
    };
    const w = new TravelMapWindow({
      maps, mapDict: buildMapDict(maps),
      getPlayerPixel: () => ({ x: 50, y: 120 }),
      getClimateIndex: () => CLIMATES.Woodlands,
      gold: () => 1000, diseaseCount: () => 0, onTravel: () => {},
    });

    // :214-217 - GotoPlace only PARKS the place.
    w.gotoPlace(placeAt('Daggerfall', REGION_NAMES[DAGGERFALL], DAGGERFALL));
    assert.equal(w.regionSelected, false, 'nothing happens where it is set');

    // :443-455 - Update opens the region page and runs the find.
    w.tick(0);
    assert.equal(w.selectedRegion, DAGGERFALL);
    assert.equal(w.locationSelected, true, 'HandleLocationFindEvent\'s single-match arm (:1435-1445)');
    assert.equal(w.findingLocation, true);

    // ...and it is a ONE-SHOT: a second tick does not re-open anything.
    w.selectedRegion = -1;
    w.tick(0);
    assert.equal(w.selectedRegion, -1, 'the pending place was consumed (:454)');
  } finally {
    _setTravelMapArtForTests(null);
    restoreDiscovery(null);
    resetTravelMapState();
  }
});

// ── F189 / F196 - regression pins on two seams this wave found ALREADY
// wired but unpinned. Both are the sweep-wiring defect class (a law
// translated, a caller missing), and neither had an end-to-end test, so
// nothing would have caught them coming apart again.

import { useItem, TEMPLATES } from '../src/systems/useItem.js';
import { questLetterName } from '../src/systems/itemInfo.js';

/** A quest Item RESOURCE as the machine keeps it (quest/item.js:72-74). */
const questResource = (item, { usedMessageID = -1, actionWatching = true } = {}) => ({
  useClicked: false, actionWatching, usedMessageID, daggerfallUnityItem: item,
});

test('AUDIT 26 F189: a use click sets UseClicked - the one thing ItemUsedDo polls', () => {
  // DaggerfallInventoryWindow.UseItem :1681-1688. A non-parchment,
  // non-clothing quest item sets the flag and POPS TO HUD so the world
  // gets first shot at the click; the ladder under it never runs.
  const bell = { group: 'MiscItems', templateIndex: 900, questItem: true, questUID: 7, questSymbol: '_bell_' };
  const bellRes = questResource(bell);
  const shown = [];
  const bellQuest = { getItem: () => bellRes, showMessagePopup: (...a) => shown.push(a) };
  const out = useItem(bell, [], { getQuest: (uid) => (uid === 7 ? bellQuest : null) });
  assert.equal(bellRes.useClicked, true, 'ItemUsedDo.cs:65 polls exactly this');
  assert.deepEqual(out, { kind: 'questItem', questItem: true, popToHUD: true });
  assert.deepEqual(shown, [], ':1687-1688 returns before the used-message popup');

  // A PARCHMENT is DFU's own exception (:1685): a letter has to stay in
  // the window to be read, so it falls through to the popup AND the
  // ladder underneath.
  const letter = { group: 'UselessItems2', templateIndex: TEMPLATES.Parchment, questItem: true, questUID: 7, questSymbol: '_letter_' };
  const letterRes = questResource(letter, { usedMessageID: 1010 });
  const said = [];
  const letterQuest = { getItem: () => letterRes, showMessagePopup: (...a) => said.push(a) };
  const read = useItem(letter, [], { getQuest: () => letterQuest });
  assert.equal(letterRes.useClicked, true);
  assert.equal(read.popToHUD, undefined, 'no pop-to-HUD for a letter');
  assert.deepEqual(said, [[1010, true]], ':1692-1697 - ShowMessagePopup(id, true)');

  // Nothing WATCHING means nothing to set (:1682) - the click still runs
  // the ladder, which is how a quest torch lights.
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 9, questItem: true, questUID: 7, questSymbol: '_torch_' };
  const torchRes = questResource(torch, { actionWatching: false });
  const lit = useItem(torch, [], { getQuest: () => ({ getItem: () => torchRes }) });
  assert.equal(torchRes.useClicked, false);
  assert.equal(lit.kind, 'lit', 'the ladder ran');
});

test('AUDIT 26 F196: a quest letter reads as its signoff, not as bare Parchment', () => {
  // ItemHelper.ResolveItemLongName (:335-348) hands quest parchment to
  // QuestMacroHelper.ExpandLetterSignoff, which walks the message's
  // tokens BACKWARDS and keeps the first non-empty line it finds.
  const letter = {
    group: 'UselessItems2', templateIndex: TEMPLATES.Parchment,
    questItem: true, questUID: 3, questSymbol: '_letter_',
  };
  const quest = {
    uid: 3, hooks: {},
    getItem: () => ({ usedMessageID: 1016 }),
    getMessage: (id) => (id === 1016 ? {
      getTextTokens: () => [{ text: 'Meet me at the docks.' }, { text: '' }, { text: 'yours truly, Baron Snide' }],
    } : null),
    getResource: () => null,
  };
  assert.equal(questLetterName(letter, () => quest), 'Letter: yours truly, Baron Snide ');

  // An ORDINARY parchment, and a quest item whose resource never carries
  // a used-message (the ctor's -1), both keep the template name.
  assert.equal(questLetterName({ ...letter, questItem: false }, () => quest), null);
  assert.equal(questLetterName(letter, () => ({ ...quest, getItem: () => ({ usedMessageID: -1 }) })), null);
  assert.equal(questLetterName(letter, () => null), null, 'no machine, no long name');
});
