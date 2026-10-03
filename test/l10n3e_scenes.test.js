// L10N3e (2026-09-28): THE NAMES THE SCENE HOSTS SHOW - the scenes batch. The places, things and beings batches routed
// DFU's name lookups everywhere but the scene hosts, which they could not edit; this routes them there. A place by
// its MapTableData.MapId (GetLocalizedLocationName) and a region by its index (GetLocalizedRegionName), an item and a
// spell through the helpers the things batch left (shownItemName, shownSpellName), an enemy through corpseEntityName,
// a faction by its id (GetLocalizedFactionName) and a named lord through staticNpcShownName - each where the host SHOWS
// the name, while every key the name also serves (discovery, the promotion's and the map's gates, the talk partner's
// nameNPC, the cast frame on the wire) keeps the canonical one.
//
// The hosts are too big to mount whole, so each site is driven through the smallest seam that runs its real code: an
// exported function where there is one (effectRows, drawEnhancedHud, createPlayerMagic, createTownTalk), else the
// host's own function or statements sliced out of its source and run against the real systems they call (the
// audit68_dungeonctx harness's mount), with only the host's other state stood in. A by-source pin stands where the
// site sits inside a flow that cannot run without the whole host (the prince's lines, the two plaques and the talk door
// beside the ones run, the town map's title, the lists that read the item label, the reveal's thread down to the
// dungeon), and says so. Made-up French throughout; English is byte for byte what each site showed, with no language
// chosen and with English chosen again.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import * as tm from '../src/systems/textManager.js';
import { REGION_NAMES } from '../src/formats/mapsFile.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { restoreDiscovery, discoverRandomLocation, hasDiscoveredLocationId, snapshotDiscovery, discoveredBuildings } from '../src/systems/discovery.js';
import { expandGuildRows } from '../src/systems/guildServiceActions.js';
import { bulletinBoardRows } from '../src/systems/bulletinBoard.js';
import { tokenRows } from '../src/ui/messageBox.js';
import { generateBuildingName, BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PlayerNotebook } from '../src/systems/notebook.js';
import { expandMacros } from '../src/systems/talkSession.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { questLetterName, shownItemName } from '../src/systems/itemInfo.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { setSpellRecordsByIndex, shownSpellName } from '../src/systems/loot.js';
import { liveBundles, dispellableBundles, dispelBundle, DISPEL_MAGIC_TEXT } from '../src/systems/mysticism.js';
import { effectRows } from '../src/ui/enhancedHud.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { allyCastable, allyReachFor, allyCastPlaqueLine, strangerCastable } from '../src/systems/allyCast.js';
import { championName } from '../src/systems/champions.js';   // LOOT7 (main): a champion's body by its name
import { corpseEntityName } from '../src/scenes/corpseMarker.js';
import { corpseName, npcHoverName } from '../src/systems/worldTooltips.js';
import { enemyDisplayName } from '../src/characters/enemyBasics.js';
import { staticNpcName, staticNpcShownName, getNameBankOfRegion, isChildNPCData } from '../src/characters/staticNpc.js';
import { presentNpcInfoText } from '../src/player/activate.js';
import { TopicTree, INFO_FACTION_IDS } from '../src/systems/topicTree.js';
import { revealGuildHallsOnMap } from '../src/systems/guildHallReveal.js';
import { GUILDS, joinGuild } from '../src/systems/guilds.js';

beforeEach(() => { tm._resetTextManagerForTests(); restoreDiscovery(null); setSpellRecordsByIndex(null); });

// ─── the harness ─────────────────────────────────────────────────────────────────────────────────────────────────

const HOSTS = new Map();
/** A scene host's source and its parse, read once. */
function host(file) {
  if (!HOSTS.has(file)) {
    const text = readFileSync(new URL(`../src/scenes/${file}`, import.meta.url), 'utf8');
    HOSTS.set(file, { text, ast: acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }) });
  }
  return HOSTS.get(file);
}
const slice = (file, n) => host(file).text.slice(n.start, n.end);
/** The first node of `file` the predicate names, in source order. */
function find(file, pred, what) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(host(file).ast);
  assert.ok(hit, `${file} has ${what}`);
  return hit;
}
const declares = (name) => (x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name);
/** `const name = ...;` - the whole declaration, as the host holds it. */
const declSrc = (file, name) => slice(file, find(file, declares(name), `a declaration of ${name}`));
/** `function name(...) {...}`. */
const fnSrc = (file, name) => slice(file, find(file, (x) => x.type === 'FunctionDeclaration' && x.id?.name === name, `function ${name}`));
/** An object-literal member as a function expression - the first whose body carries `mark`. */
function memberSrc(file, name, mark) {
  const n = find(file, (x) => x.type === 'Property' && !x.computed && x.key?.name === name && /Function/.test(x.value?.type ?? '')
    && slice(file, x.value).includes(mark), `a member ${name} carrying ${mark}`);
  return n.method ? `function ${slice(file, n.value)}` : slice(file, n.value);
}
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
/** Runs `body` (source ending in a `return`) with `state` as its free variables - the host's own code, its other
 *  state stood in. */
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

/** `show()` in English, again with the French rows in (English still chosen), then in French, then in English once
 *  more: { en, fr }, every English read held to the first. `rows` is { table: [[key, value]] }. */
function inFrench(rows, show) {
  const en = show();
  for (const [table, list] of Object.entries(rows)) tm.patchLocaleTable('fr', table, list);
  assert.deepEqual(show(), en, 'English stands until French is chosen');
  tm.setLocale('fr');
  const fr = show();
  tm.setLocale('en');
  assert.deepEqual(show(), en, 'English again, byte for byte');
  return { en, fr };
}

const DAGGERFALL_MAP_ID = 1291010263;
const FR_REGIONS = REGION_NAMES.map((_, i) => `Région ${i}`);
FR_REGIONS[17] = 'Royaume de Chutedague';
const REGIONS_ROW = [['regionNames', FR_REGIONS.join('\n')]];
const DAGGERFALL = { name: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, locationIndex: 0, mapTableData: { mapId: DAGGERFALL_MAP_ID }, exterior: { buildings: [] } };
const PLACES = { Internal_Locations: [[String(DAGGERFALL_MAP_ID), 'Chutedague']], Internal_Strings: REGIONS_ROW };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

// ─── places ──────────────────────────────────────────────────────────────────────────────────────────────────────

// One undiscovered crypt in the region the player stands in - DiscoverRandomLocation has one candidate to pick.
const CRYPT_ID = 7001;
const CRYPT_REGION = { name: 'Daggerfall', mapNames: ['Privateer\'s Hold'], mapTable: [{ mapId: CRYPT_ID, discovered: false }] };
/** world.js's reveal - revealLocation, the note table it writes through and the map item's arm (useHooks.revealMap) -
 *  over the real discovery store, the player's pixel on a location of region 17. */
function worldReveal() {
  const notes = [];
  const api = mount(`
    ${declSrc('world.js', 'REVEAL_NOTE_TEXT')}
    ${declSrc('world.js', 'revealLocation')}
    ${declSrc('world.js', '_locationRevealedByMapItem')}
    const revealMap = ${memberSrc('world.js', 'revealMap', 'revealLocation(\'readMap\')')};
    return { revealLocation, revealMap, mapMacro: () => _locationRevealedByMapItem };
  `, {
    locationIndex: new Map([['5,6', { regionIndex: 17 }]]), playerTravelPixel: () => ({ x: 5, y: 6 }),
    maps: { getRegion: () => CRYPT_REGION }, discoverRandomLocation, questBridge: { notebook: { addNote: (t) => notes.push(t) } },
    localizedStrings: tm.localizedStrings, getLocalizedLocationName: tm.getLocalizedLocationName,
  });
  return { ...api, notes };
}

test('L10N3e scenes: a map\'s reveal (world.js revealLocation) - the map item names the place as shown in its note, %map and record 499 (DaggerfallInventoryWindow.cs:1831-1834), the guilds\' notes keep DFU\'s canonical revealedDungeon.Name (ThievesGuild.cs:115, DarkBrotherhood.cs:109), and discovery files the canonical name', () => {
  const show = () => {
    const out = {};
    for (const key of ['readMap', 'readMapTG', 'readMapDB']) {
      restoreDiscovery(null);
      const w = worldReveal();
      out[key] = { r: w.revealLocation(key), note: w.notes[0], map: w.mapMacro() };
    }
    restoreDiscovery(null);
    const item = worldReveal();
    out.item = item.revealMap();
    out.filed = [hasDiscoveredLocationId(CRYPT_ID), Object.values(snapshotDiscovery().locations)[0]?.locationName];
    return out;
  };
  const { en, fr } = inFrench({ Internal_Locations: [[String(CRYPT_ID), 'Repaire factice']] }, show);
  const hold = 'Privateer\'s Hold';
  assert.deepEqual(en.readMap, { r: { name: hold, mapId: CRYPT_ID, shown: hold }, note: `Discovered the location of ${hold} after studying a map.`, map: hold });
  assert.equal(en.readMapTG.note, `The Thieves Guild have revealed the closely-guarded whereabouts of a treasure trove called ${hold}.`);
  assert.equal(en.readMapDB.note, `The Dark Brotherhood revealed the secret of some treasure-laden crypts located somewhere called ${hold}.`);
  assert.deepEqual([en.item, en.filed], [hold, [true, hold]]);
  assert.deepEqual(fr.readMap, { r: { name: hold, mapId: CRYPT_ID, shown: 'Repaire factice' }, note: 'Discovered the location of Repaire factice after studying a map.', map: 'Repaire factice' },
    'the note and %map as shown; the answer\'s name - the callers\' gate - canonical');
  assert.equal(fr.readMapTG.note, en.readMapTG.note, 'ThievesGuild.cs:115 writes revealedDungeon.Name, the canonical one');
  assert.equal(fr.readMapDB.note, en.readMapDB.note, 'and so does DarkBrotherhood.cs:109');
  assert.deepEqual(fr.readMapTG.r.name, hold);
  assert.equal(fr.item, 'Repaire factice', 'record 499\'s %map');
  assert.deepEqual(fr.filed, [true, hold], 'discovery files the canonical name, in every language');
  // A translation's EMPTY row: DFU's gate is the canonical name (:1828), so the map still reads as found - the note shows
  // the row as DFU's does, and record 499 names the canonical place rather than a map that says it found nothing
  tm.patchLocaleTable('fr', 'Internal_Locations', [[String(CRYPT_ID), '']]);
  tm.setLocale('fr');
  restoreDiscovery(null);
  const blank = worldReveal();
  assert.equal(blank.revealMap(), hold);
  assert.equal(blank.notes[0], 'Discovered the location of  after studying a map.');
});

/** The guild popup's macro context (worldModes.js openGuildService): from %fon's faction name through the
 *  `guildMacros` bag, over a host whose reveal is world.js's own. */
function guildContext({ dict, guild, hostReveal }) {
  const a = find('worldModes.js', declares('orderFaction'), 'the order\'s faction read');
  const b = find('worldModes.js', declares('guildMacros'), 'the guild\'s macro context');
  return mount(`${host('worldModes.js').text.slice(a.start, b.end)}\nreturn { revealLocation, guildMacros };`, {
    dict, guild, host: { revealLocation: hostReveal }, playerEntity: { name: 'Mac Anthor' },
    getTitle: () => 'Squire', membershipOf: () => null, activeMemberships: () => ({}), DEITY_DESCRIPTIONS: {},
    getLocalizedFactionName: tm.getLocalizedFactionName, getLocalizedLocationName: tm.getLocalizedLocationName,
  });
}

test('L10N3e scenes: the guild popup\'s %fon/%kno is the order\'s faction name as GetFactionData hands it back (KnightlyOrder.cs:321 via Guild.cs:174, PersistentFactionData.cs:176) and %dng the revealed place by its MapId (ThievesGuild.cs:281, DarkBrotherhood.cs:290); the promotion\'s gate reads the canonical name', () => {
  const ORDER = 368;
  const dict = new Map([[ORDER, { id: ORDER, name: 'The Order of the Candle' }]]);
  const show = () => {
    restoreDiscovery(null);
    const ctx = guildContext({ dict, guild: { factionId: ORDER, divine: null }, hostReveal: worldReveal().revealLocation });
    const before = expandGuildRows(['%dng'], ctx.guildMacros)[0];
    const gate = ctx.revealLocation('readMapTG');
    const rows = expandGuildRows(['%fon always has room for a knight.', 'Welcome, %pcf, to %kno.', 'The crypt called %dng.'], ctx.guildMacros);
    const orphan = guildContext({ dict, guild: { factionId: 999, divine: null }, hostReveal: null });
    return { before, gate, rows, orphan: [orphan.revealLocation, expandGuildRows(['%fon'], orphan.guildMacros)[0]] };
  };
  const { en, fr } = inFrench({
    Internal_Factions: [[String(ORDER), 'L\'Ordre de la Chandelle factice'], ['999', 'Personne factice']],
    Internal_Locations: [[String(CRYPT_ID), 'Repaire factice']],
  }, show);
  assert.deepEqual(en, {
    before: '%dng', gate: 'Privateer\'s Hold',
    rows: ['The Order of the Candle always has room for a knight.', 'Welcome, Mac, to The Order of the Candle.', 'The crypt called Privateer\'s Hold.'],
    orphan: [null, '%fon'],
  });
  assert.deepEqual(fr, {
    before: '%dng', gate: 'Privateer\'s Hold',
    rows: ['L\'Ordre de la Chandelle factice always has room for a knight.', 'Welcome, Mac, to L\'Ordre de la Chandelle factice.', 'The crypt called Repaire factice.'],
    orphan: [null, '%fon'],
  }, 'the gate the promotion reads (ThievesGuild.cs:112) stays canonical; a faction FACTION.TXT lacks has no name to translate (GetFactionData fails)');
});

test('L10N3e scenes: the bulletin board\'s heading is PlayerGPS.CurrentLocalizedLocationName (PlayerActivate.cs:721) - the location by its MapId; the wilderness has none (worldModes.js activateBulletinBoard, run whole)', () => {
  const board = (here) => {
    const shown = [];
    const activate = mount(`${fnSrc('worldModes.js', 'activateBulletinBoard')}\nreturn activateBulletinBoard;`, {
      rayAabb: () => 1, BULLETIN_BOARD_ACTIVATION_DISTANCE: 10, setMidScreenText: () => {}, tooFarAwayText: () => 'too far',
      buildingDirectory: () => here, bulletinBoardRows, bulletinBoardNews: () => null, tokenRows,
      townTalk: { showOverlay: (w) => shown.push(w) }, ChoiceWindow: class { constructor(o) { this.lines = o.lines; } },
      getLocalizedLocationName: tm.getLocalizedLocationName,
    });
    activate({ min: [0, 0, 0], max: [1, 1, 1] }, [0, 0, 0], [0, 0, 1]);
    return shown[0]?.lines ?? null;
  };
  const show = () => [board({ mapId: DAGGERFALL_MAP_ID, locationName: 'Daggerfall', regionIndex: 17 }), board(null)];
  const { en, fr } = inFrench(PLACES, show);
  assert.deepEqual(en, [['Daggerfall'], ['']]);
  assert.deepEqual(fr, [['Chutedague'], ['']], 'no directory, no name - in any language');
});

test('L10N3e scenes: the town map\'s plates carry the shown pair beside the canonical one (ExteriorAutomap.cs:717-718) - world.js and exterior.js, their own statements run; the canonical name still chooses the palace, and the title is the name as shown', () => {
  const opts = (file, state) => {
    const a = find(file, declares('shownLocation'), 'the shown location');
    const b = find(file, (x) => declares('summaries')(x) && slice(file, x).includes('shownLocationName: shownLocation'), 'the plates\' summaries');
    return mount(`${host(file).text.slice(a.start, b.end)}\nreturn summaries;`, {
      ...state, maps: { getRegionName: (i) => REGION_NAMES[i] }, buildingSummaries: (bs, blocks, o) => o,
      getLocalizedLocationName: tm.getLocalizedLocationName, getLocalizedRegionName: tm.getLocalizedRegionName,
    });
  };
  const cnSeed = [...Array(400).keys()].find((s) => generateBuildingName(s, BUILDING_TYPES.GeneralStore, { locationName: 'Daggerfall' }).includes('Daggerfall'));
  assert.ok(cnSeed !== undefined, 'a seed whose shop name carries %cn');
  const plates = (o) => {
    const palace = (n) => (n === 'Daggerfall' ? 'Castle Daggerfall' : null);
    return [BUILDING_TYPES.Bank, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Palace]
      .map((t) => generateBuildingName(t === BUILDING_TYPES.GeneralStore ? cnSeed : 9, t, { ...o, palaceName: palace }));
  };
  const show = () => ({
    world: plates(opts('world.js', { dfLoc: DAGGERFALL, b: { locBlocks: [] } })),
    exterior: plates(opts('exterior.js', { dfLocation: DAGGERFALL, loc: { blocks: [] }, locationName: 'Daggerfall' })),
  });
  const { en, fr } = inFrench(PLACES, show);
  assert.deepEqual(en.world[0], 'The Bank of Daggerfall');
  assert.equal(en.world[2], 'Castle Daggerfall');
  assert.deepEqual(en.exterior, en.world, 'one law in both hosts');
  assert.deepEqual(fr.world, ['The Bank of Royaume de Chutedague', en.world[1].replaceAll('Daggerfall', 'Chutedague'), 'Castle Daggerfall']);
  assert.deepEqual(fr.exterior, fr.world);
  // the title: the window's `locationName` is the name as shown, its key the locationId - by source, since the window's
  // bag is built inside the M key's whole arm
  for (const file of ['world.js', 'exterior.js']) {
    assert.match(host(file).text, /locationName: shownLocation,   \/\/ L10N3e: the title, as shown - the key is locationId\n\s*locationId: locId,/, `${file}'s title`);
  }
});

test('L10N3e scenes: the notebook\'s header names MacroHelper.CityName as shown (PlayerNotebook.cs:114, MacroHelper.cs:571/:573) - world.js the location by its MapId else the region by its index, exterior.js its one location; the header is written in the language of the moment', () => {
  const header = (cityName) => {
    const nb = new PlayerNotebook({ dateTimeString: () => '13:30:00', cityName });
    nb.addNote('A note.');
    return nb.getNote(0)[0].text;
  };
  const worldCity = (here) => mount(`return (${memberSrc('world.js', 'cityName', '_questLoc()')});`, {
    _questLoc: () => here, _questRegionIndex: () => 17, questWorld: { currentRegionName: () => 'Daggerfall' },
    getLocalizedLocationName: tm.getLocalizedLocationName, getLocalizedRegionName: tm.getLocalizedRegionName,
  });
  const exteriorCity = mount(`return (${memberSrc('exterior.js', 'cityName', 'getLocalizedLocationName')});`, {
    dfLocation: DAGGERFALL, locationName: 'Daggerfall', getLocalizedLocationName: tm.getLocalizedLocationName,
  });
  const show = () => [header(worldCity(DAGGERFALL)), header(worldCity(null)), header(exteriorCity)];
  const { en, fr } = inFrench(PLACES, show);
  assert.deepEqual(en, ['13:30:00 in Daggerfall:', '13:30:00 in Daggerfall:', '13:30:00 in Daggerfall:']);
  assert.deepEqual(fr, ['13:30:00 in Chutedague:', '13:30:00 in Royaume de Chutedague:', '13:30:00 in Chutedague:'], 'the wilderness: the region');
});

test('L10N3e scenes: the dungeon host\'s %cn (dungeonContext.js rscLines, MacroHelper.CityName) - the dungeon\'s location by its MapId, else its region by index - as townTalk.js\'s shownCityName shows it', () => {
  const lines = (dfLocation) => mount(`${declSrc('dungeonContext.js', 'shownCityName')}\n${declSrc('dungeonContext.js', 'rscLines')}\nreturn rscLines;`, {
    dfLocation, textRsc: { plainText: () => ['Do you wish to rest in %cn?'] }, expandMacros, playerEntity: { name: 'Mac' },
    getLocalizedLocationName: tm.getLocalizedLocationName, getLocalizedRegionName: tm.getLocalizedRegionName,
  })(4000);
  const HOLD = { name: 'Privateer\'s Hold', regionName: 'Daggerfall', regionIndex: 17, mapTableData: { mapId: CRYPT_ID } };
  const show = () => [lines(HOLD), lines({ ...HOLD, name: '' })];
  const { en, fr } = inFrench({ Internal_Locations: [[String(CRYPT_ID), 'Repaire factice']], Internal_Strings: REGIONS_ROW }, show);
  assert.deepEqual(en, [['Do you wish to rest in Privateer\'s Hold?'], ['Do you wish to rest in Daggerfall?']]);
  assert.deepEqual(fr, [['Do you wish to rest in Repaire factice?'], ['Do you wish to rest in Royaume de Chutedague?']]);
});

test('L10N3e scenes: the fixed-city host\'s talk topics carry the ids the name bag shows its pair by (TalkManager.cs:2788-2789, :2857-2858) - exterior.js\'s own topics object, handed to the real town host: %cn, a shop\'s and the bank\'s names as shown, the canonical pair its key', async () => {
  const n = find('exterior.js', (x) => x.type === 'Property' && x.key?.name === 'topics' && x.value?.type === 'ObjectExpression'
    && slice('exterior.js', x.value).includes('exteriorBuildings: dfLocation.exterior.buildings'), 'the town host\'s topics');
  const topics = mount(`return (${slice('exterior.js', n.value)});`, {
    dfLocation: DAGGERFALL, loc: { blocks: [] }, buildingDoors: [], locationName: 'Daggerfall', regionName: 'Daggerfall',
    walkMode: false, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0] },
  });
  assert.deepEqual([topics.mapId, topics.regionIndex], [DAGGERFALL_MAP_ID, 17]);
  const town = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: DAGGERFALL.regionIndex, topics,
  });
  await quiet(() => town.ensureLoaded());
  const show = () => { const o = town.nameOpts(); return [town.cityName(), o.locationName, o.shownLocationName, o.shownRegionName, generateBuildingName(9, BUILDING_TYPES.Bank, o)]; };
  const { en, fr } = inFrench(PLACES, show);
  assert.deepEqual(en, ['Daggerfall', 'Daggerfall', 'Daggerfall', 'Daggerfall', 'The Bank of Daggerfall']);
  assert.deepEqual(fr, ['Chutedague', 'Daggerfall', 'Chutedague', 'Royaume de Chutedague', 'The Bank of Royaume de Chutedague']);
});

test('L10N3e scenes: the arrival line after a teleport or a journey (world.js, the port\'s own words) names the place as shown, by the pick\'s MapId; the pick keeps the canonical name, and a pick with no id (bare coordinates) shows its own', () => {
  const says = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && slice('world.js', n.callee) === 'townTalk.say' && slice('world.js', n).includes('You arrive at')) says.push(slice('world.js', n));
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(host('world.js').ast);
  assert.equal(says.length, 2, 'the teleport\'s arrival and the journey\'s');
  const arrive = (pick) => says.map((call) => {
    const said = [];
    mount(`${call};\nreturn null;`, { pick, beside: null, townTalk: { say: (t) => said.push(t) }, getLocalizedLocationName: tm.getLocalizedLocationName });
    return said[0];
  });
  const city = { name: 'Daggerfall', region: 'Daggerfall', mapId: DAGGERFALL_MAP_ID };
  const show = () => [...arrive(city), ...arrive({ name: 'Coordinates 12, 34' }), city.name];
  const { en, fr } = inFrench(PLACES, show);
  assert.deepEqual(en, ['You arrive at Daggerfall.', 'You arrive at Daggerfall.', 'You arrive at Coordinates 12, 34.', 'You arrive at Coordinates 12, 34.', 'Daggerfall']);
  assert.deepEqual(fr, ['You arrive at Chutedague.', 'You arrive at Chutedague.', 'You arrive at Coordinates 12, 34.', 'You arrive at Coordinates 12, 34.', 'Daggerfall']);
});

// ─── things ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e scenes: the repair, buy and sell lists and the repair note name an item as shown (worldModes.js _itemLabel; DFU\'s LongName, DaggerfallTradeWindow.cs:536) - its own name while still its template\'s, a nameless one\'s template by its index; a made name stands', () => {
  const label = mount(`${declSrc('worldModes.js', '_itemLabel')}\nreturn _itemLabel;`, {
    questLetterName, questBridge: null, shownItemName, templateByIndex, getLocalizedItemName: tm.getLocalizedItemName,
  });
  const show = () => [
    label({ group: 'Weapons', templateIndex: 113, name: 'Dagger' }),
    label({ group: 'Weapons', templateIndex: 113 }),
    label({ group: 'Weapons', templateIndex: 113, name: 'Mac\'s Blade' }),
    label({ group: 'Weapons', templateIndex: -1 }),
  ];
  const { en, fr } = inFrench({ Internal_Items: [['113', 'Poignard factice']] }, show);
  assert.deepEqual(en, ['Dagger', 'Dagger', 'Mac\'s Blade', 'Weapons']);
  assert.deepEqual(fr, ['Poignard factice', 'Poignard factice', 'Mac\'s Blade', 'Weapons']);
  // every list and both repair notes read the one label (the notes through DFU's own repairNote pattern)
  const wm = host('worldModes.js').text;
  assert.equal((wm.match(/formatText\(localizedText\('repairNote', 'Left my \{0\} for repair at \{1\}\.'\), _itemLabel\(it\), /g) ?? []).length, 2);
  assert.equal((wm.match(/label: `\$\{j \+ 1\} - \$\{_itemLabel\(it\)\}/g) ?? []).length, 4, 'the repair list, its status list, the buy list and the sell list');
});

const LEVITATE = { index: 4, name: 'Levitate', cost: 5, icon: 3, element: 4, rangeType: 0, effects: [] };
const SPELL_ROWS = { Internal_Spells: [['4', 'Envol']] };
/** A cast's entries as effects.js stamps them: the canonical bundleName, the SPELLS.STD index beside it. */
const bundleOf = (id, name, index, over = {}) => ({ kind: 'shield', bundleId: id, bundleName: name, bundleSpellIndex: index, bundleType: 'Spell', bundleSelfCast: true, roundsRemaining: 9, ...over });
const ACTIVE = () => [bundleOf(1, 'Levitate', 4), bundleOf(2, 'Big Boom', null), bundleOf(3, '', null)];

test('L10N3e scenes: the Dispel Magic pickers list bundle.name (DispelMagic.cs:95), which DFU gave a stock spell in the player\'s language (EntityEffectBroker.cs:877) - worldModes.js\'s and dungeonContext.js\'s, each run whole; a made spell shows its own name, and the pick still dispels by the bundle id', () => {
  setSpellRecordsByIndex(new Map([[4, LEVITATE]]));
  const picker = (body) => {
    let opened = null;
    const player = { activeEffects: ACTIVE() };
    const open = mount(`return (${body});`, {
      listPickerArtLoaded: () => true, dispellableBundles, liveBundles, playerEntity: player, dispelBundle, DISPEL_MAGIC_TEXT,
      townTalk: { say() {} }, hudText: { add() {} }, closeSpellWindow() {}, mountSpellWindow: () => true, shownSpellName,
      ListPickerWindow: class { constructor(o) { opened = o; } },
    });
    open({ chance: 0 });
    opened.onPick(0);
    return { items: opened.items, left: player.activeEffects.map((a) => a.bundleId) };
  };
  const show = () => ({
    surface: picker(memberSrc('worldModes.js', 'openDispelPicker', 'dispellableBundles')),
    dungeon: picker(fnSrc('dungeonContext.js', 'openDispelPicker')),
  });
  const { en, fr } = inFrench(SPELL_ROWS, show);
  assert.deepEqual(en.surface, { items: ['Levitate', 'Big Boom', '(unnamed)'], left: [2, 3] });
  assert.deepEqual(fr.surface, { items: ['Envol', 'Big Boom', '(unnamed)'], left: [2, 3] }, 'my own Levitate, picked, comes off');
  assert.deepEqual(fr.dungeon, fr.surface, 'the dungeon\'s picker is the same');
  assert.deepEqual(en.dungeon, en.surface);
});

test('L10N3e scenes: the readied spell on the classic HUD (dungeonContext.js) and the enhanced HUD\'s ready chip and spell tiles (effectRows - HUDActiveSpells.cs:304) name the spell as the book shows it', async () => {
  setSpellRecordsByIndex(new Map([[4, LEVITATE]]));
  const ready = find('dungeonContext.js', (x) => x.type === 'IfStatement' && slice('dungeonContext.js', x.test) === 'hudFont && magic.readied() && !isEnhanced()', 'the readied line');
  const classic = (sp) => {
    const drawn = [];
    mount(`${slice('dungeonContext.js', ready)}\nreturn null;`, {
      hudFont: {}, magic: { readied: () => sp, readiedCost: () => 12 }, isEnhanced: () => false, hudScaleFor: () => 1, canvas: { width: 640, height: 400 }, renderer: {},
      drawText: (r, f, text) => drawn.push(text), calculateCastCost: () => ({ sp: 12 }), playerEntity: {}, shownSpellName,
    });
    return drawn;
  };
  // the enhanced HUD, drawn over the same document fake test/qs3_hud.test.js drives it with
  const mkEl = () => ({
    className: '', textContent: '', id: '', src: '', children: [], dataset: {}, attrs: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }, getAttribute(k) { return this.attrs[k]; },
    removeAttribute(a) { delete this.attrs[a]; }, remove() {}, append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const all = (n, out = []) => { for (const c of n.children ?? []) { out.push(c); all(c, out); } return out; };
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const chip = (sp) => {
    destroyEnhancedHud();
    globalThis.document.body = mkEl();
    drawEnhancedHud({ health: 40, maxHealth: 80, magicka: 5, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null, activeEffects: [] }, 0, 0, { readied: sp });
    return all(globalThis.document.body).filter((n) => String(n.className).split(/\s+/).includes('hud-readyname')).map((n) => n.textContent);
  };
  try {
    const show = () => ({
      classic: classic({ ...LEVITATE }), made: classic({ ...LEVITATE, index: -2, name: 'Glide' }),
      chip: chip({ ...LEVITATE }), tiles: effectRows({ activeEffects: ACTIVE() }).map((r) => r.name),
    });
    const { en, fr } = inFrench(SPELL_ROWS, show);
    assert.deepEqual(en, { classic: ['Levitate (12)'], made: ['Glide (12)'], chip: ['Levitate'], tiles: ['Levitate', 'Big Boom', ''] });
    assert.deepEqual(fr, { classic: ['Envol (12)'], made: ['Glide (12)'], chip: ['Envol'], tiles: ['Envol', 'Big Boom', ''] });
  } finally { destroyEnhancedHud(); globalThis.document = prev; }
});

// the magic host, driven as itself (test/allycast.test.js's rig, with test/friendlyspells.test.js's party marks)
const fx = (type, subType = 0, mag = 20) => ({
  type, subType, magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8), FORTIFY = fx(9, 0, 10);
const BALM = { index: 90, name: 'Balyna\'s Balm', element: 4, rangeType: 0, effects: [HEAL, EMPTY, EMPTY] };
const STRENGTH = { index: 91, name: 'Strength', element: 4, rangeType: 1, effects: [FORTIFY, EMPTY, EMPTY] };
function magicRig({ ally = null, mates = [] } = {}) {
  const player = { isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const world = { said: [], frames: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity, heightAt: () => -100 }, playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
    say: (l) => world.said.push(l), surfacePlayer() {}, foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,
    allyTarget: () => ally, castAtAlly: (id, frame) => { world.frames.push({ id, frame }); return true; }, allyMarks: () => mates,
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, world };
}

test('L10N3e scenes: the caster\'s ally-cast line names the spell as the book shows it (hostMagic.js - the crosshair\'s mate and a touch that meets one), while the frame that crosses the wire keeps the canonical name (rule 1: the receiver has no index to read it by)', () => {
  setSpellRecordsByIndex(new Map([[90, BALM], [91, STRENGTH]]));
  const show = () => {
    const pick = magicRig({ ally: { id: 'peer-0002', name: 'Bran', distance: 3 } });
    pick.magic.readySpell({ ...BALM });
    pick.magic.castInput([0, 0.9, 0], [0, 0, 1]);
    const touch = magicRig({ mates: [{ id: 'peer-0002', name: 'Bran', feet: [0, 0, 1.5], height: 1.8 }] });
    touch.magic.readySpell({ ...STRENGTH });
    touch.magic.castInput([0, 0.9, 0], [0, 0, 1]);
    return {
      lines: [pick.world.said.find((l) => l.startsWith('You cast')), touch.world.said.find((l) => l.startsWith('You cast'))],
      wire: [pick.world.frames[0]?.frame.spell.name, touch.world.frames[0]?.frame.spell.name],
    };
  };
  const { en, fr } = inFrench({ Internal_Spells: [['90', 'Baume factice'], ['91', 'Force factice']] }, show);
  assert.deepEqual(en, { lines: ['You cast Balyna\'s Balm on Bran.', 'You cast Strength on Bran.'], wire: ['Balyna\'s Balm', 'Strength'] });
  assert.deepEqual(fr, { lines: ['You cast Baume factice on Bran.', 'You cast Force factice on Bran.'], wire: ['Balyna\'s Balm', 'Strength'] });
});

test('L10N3e scenes: the plaque over a party mate names my readied spell as the book shows it (world.js peerHoverName, run whole)', () => {
  setSpellRecordsByIndex(new Map([[90, BALM]]));
  const plaque = (sp) => mount(`${fnSrc('world.js', 'castPlaqueLine')}\n${declSrc('world.js', 'peerHoverName')}\nreturn peerHoverName;`, {   // SPELL-GIFT (main): the line has its own function
    peerIdOfKey: (k) => k.split(':')[1], peerMenuFor: 'peer-0002', peerName: () => 'Bran', online: { badgeOf: () => null, renownOf: () => null },
    glyphMarks: () => '', social: { isPartyPeer: () => true }, peerActsFor: () => null, peerRelationText: () => null, socialPlaqueRows: () => [],
    modes: { mode: 'exterior' }, magic: { readied: () => sp, allyInReach: () => ({ id: 'peer-0002' }) }, cam: { pos: [0, 0, 0] }, socialFwd: () => [0, 0, 1],
    allyCastable, allyReachFor, allyCastPlaqueLine, strangerCastable, shownSpellName,
  })('peer:peer-0002').subs;
  const { en, fr } = inFrench({ Internal_Spells: [['90', 'Baume factice']] }, () => [plaque({ ...BALM }), plaque({ ...BALM, name: 'My Balm', index: -1 })]);
  assert.deepEqual(en, [['Cast Balyna\'s Balm on Bran'], ['Cast My Balm on Bran']]);
  assert.deepEqual(fr, [['Cast Baume factice on Bran'], ['Cast My Balm on Bran']]);
});

// ─── beings ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('L10N3e scenes: the dungeon\'s corpse plaque is loot.entityName (GameObjectHelper.cs:701) - corpseEntityName, as the other pools\' plaques read it (World Tooltips .cs:526); dungeonContext.js _dungeonHoverName, run whole', () => {
  const hover = (foes) => mount(`${fnSrc('dungeonContext.js', '_dungeonHoverName')}\nreturn _dungeonHoverName;`, {
    worldTooltipsOn: () => false, hideInteractTooltip: () => false, foes, lootableBody: (f) => !!f, corpseName, corpseEntityName, enemyDisplayName, championName,
  });
  const enemyNames = Array.from({ length: 62 }, (_, i) => (i === 23 ? 'Spectre factice' : `Ennemi ${i}`)).join('\n');
  const { en, fr } = inFrench({ Internal_Strings: [['enemyNames', enemyNames]] }, () => hover([{ mobileType: 23 }])('corpse:0'));
  assert.deepEqual(en, { title: 'Wraith (dead)' });
  assert.deepEqual(fr, { title: 'Spectre factice (dead)' });
});

const LORD = 201;
const NPC_DICT = new Map([[LORD, { id: LORD, name: 'Lord Canon', type: FACTION_TYPES.Individual }]]);
const lord = { factionID: LORD, nameSeed: 7, gender: 0, billboardArchiveIndex: -1, billboardRecordIndex: -1 };
const commoner = { factionID: 999, nameSeed: 7, gender: 0, billboardArchiveIndex: -1, billboardRecordIndex: -1 };
/** worldModes.js's static-NPC names - npcDisplayName, npcShownName, the Info click, the guild popup's talk door and
 *  the dungeon's person plaque - run whole over the stood-in host. */
function npcHost() {
  const said = [], plates = [], partners = [];
  const plaqueCall = find('worldModes.js', (x) => x.type === 'CallExpression' && x.callee?.property?.name === 'addActivationNamer'
    && slice('worldModes.js', x.arguments[0] ?? x).includes('npcShownName('), 'the dungeon\'s person plaque');
  const api = mount(`
    ${declSrc('worldModes.js', 'currentNameBank')}
    ${declSrc('worldModes.js', 'npcNameDeps')}
    ${declSrc('worldModes.js', 'npcDisplayName')}
    ${declSrc('worldModes.js', 'npcShownName')}
    ${fnSrc('worldModes.js', 'presentNpcInfo')}
    ${fnSrc('worldModes.js', 'popupTalkToStaticNpc')}
    const plaque = ${slice('worldModes.js', plaqueCall.arguments[0])};
    return { npcDisplayName, npcShownName, presentNpcInfo, popupTalkToStaticNpc, plaque };
  `, {
    interiorBuilding: null, buildingDirectory: () => ({ regionIndex: 17 }), getNameBankOfRegion, staticNpcName, staticNpcShownName,
    townTalk: { factionDict: NPC_DICT, say: (t) => said.push(t), openTalkWindow: (greeting, o) => plates.push(o.npcName) },
    staticNpcSceneCtx: () => ({}), staticNpcData: (pn) => pn.npcData, presentNpcInfoText, isChildNPCData, npcHoverName,
    npcSession: { talkToStaticNPC: (t) => { partners.push(t.displayName); return { kind: 'talk', greeting: 'Well met.' }; }, startNewConversation() {} },
    openQuestOfferFor() {}, mountServiceWindow() {}, interiorOverlay: null, mode: 'exterior', staticNpcPortrait: () => null,
    localizedText: tm.localizedText, ctx: { npcTargets: () => [{ npcData: lord, archive: -1, record: -1 }] },
  });
  return { ...api, said, plates, partners };
}

test('L10N3e scenes: a named lord is shown by a translation\'s name for his faction (StaticNPC.cs:321 via PersistentFactionData.cs:176) - on the plaque, the Info line (PlayerActivate.cs:1484-1499) and the talk window\'s plate (DaggerfallTalkWindow.cs:390) - while the talk partner\'s nameNPC stays the canonical name the topic tree compares with a quest Person\'s', () => {
  const show = () => {
    const h = npcHost();
    h.presentNpcInfo({ npcData: lord });
    h.popupTalkToStaticNpc(lord);
    return {
      names: [h.npcDisplayName(lord), h.npcShownName(lord), h.npcShownName(commoner) === h.npcDisplayName(commoner)],
      plaque: h.plaque('person:0'), info: h.said, plate: h.plates, partner: h.partners,
    };
  };
  const { en, fr } = inFrench({ Internal_Factions: [[String(LORD), 'Seigneur factice'], ['999', 'Personne factice']] }, show);
  assert.deepEqual(en, { names: ['Lord Canon', 'Lord Canon', true], plaque: { title: 'Lord Canon' }, info: ['You see Lord Canon.'], plate: ['Lord Canon'], partner: ['Lord Canon'] });
  assert.deepEqual(fr, {
    names: ['Lord Canon', 'Seigneur factice', true], plaque: { title: 'Seigneur factice' }, info: ['You see Seigneur factice.'],
    plate: ['Seigneur factice'], partner: ['Lord Canon'],
  }, 'a commoner\'s seeded name is the same in every language; the partner the engine keys by is canonical');
  // the other two plaques and the other talk door sit inside flows that need the whole host: by source
  const wm = host('worldModes.js').text;
  assert.equal((wm.match(/const display = npcShownName\(staticNpcData\(pn, staticNpcSceneCtx\(pn\)\)\);/g) ?? []).length, 3, 'all three plaques');
  assert.doesNotMatch(wm, /npcDisplayName\(staticNpcData\(pn, /, 'no plaque or Info line on the canonical name');
  assert.match(wm, /\{ data: npcData, isChildNPC: isChildNPCData\(npcData\), displayName \},/, 'the static door\'s partner: the canonical name');
  assert.match(wm, /townTalk\.openTalkWindow\(talk\.greeting, \{ npcSeed: npcData\.nameSeed, npcName: npcShownName\(npcData\), portrait: staticNpcPortrait\(npcData\) \}\);/, 'and its plate, as shown');
});

test('L10N3e scenes: the talk window\'s organizations are GetFactionName\'s (TalkManager.cs:3194, PersistentFactionData.cs:307-313) - world.js\'s dep, through the real topic tree; the revealed guild hall is GetGuildName\'s (ThievesGuild.cs:246, DarkBrotherhood.cs:255) in both hosts', () => {
  const dict = new Map([[42, { id: 42, name: 'The Thieves Guild' }], [40, { id: 40, name: 'The Mages Guild' }]]);
  const captions = () => {
    const factionName = mount(`return (${memberSrc('world.js', 'factionName', "townTalk.factionDict?.get(id)?.name ?? ''")});`, {
      townTalk: { factionDict: dict }, getLocalizedFactionName: tm.getLocalizedFactionName,
    });
    const tree = new TopicTree({ factionName });
    tree.assembleTopiclistTellMeAbout();
    return tree.listTopicTellMeAbout.filter((i) => i.factionID === 42 || i.factionID === 40).map((i) => i.caption);
  };
  const halls = (file) => {
    restoreDiscovery(null);
    const factionName = mount(`return (${memberSrc(file, 'factionName', 'const n = townTalk.factionDict')});`, {
      townTalk: { factionDict: dict }, getLocalizedFactionName: tm.getLocalizedFactionName,
    });
    const book = {};
    joinGuild(book, GUILDS.ThievesGuild, 0);
    revealGuildHallsOnMap(book, 'r:loc', [{ buildingKey: 7001, factionId: 42, buildingType: 0x0e, name: '' }], { factionName });
    return [discoveredBuildings('r:loc')[0]?.displayName, factionName(999)];
  };
  const show = () => ({ captions: captions(), world: halls('world.js'), exterior: halls('exterior.js') });
  const { en, fr } = inFrench({ Internal_Factions: [['42', 'La Guilde factice'], ['40', 'Les Mages factices'], ['999', 'Personne factice']] }, show);
  assert.equal(INFO_FACTION_IDS[0], 42);
  assert.deepEqual(en, { captions: ['The Thieves Guild', 'The Mages Guild'], world: ['The Thieves Guild', ''], exterior: ['The Thieves Guild', ''] });
  assert.deepEqual(fr, { captions: ['La Guilde factice', 'Les Mages factices'], world: ['La Guilde factice', ''], exterior: ['La Guilde factice', ''] },
    'a faction FACTION.TXT lacks is no guild to name (Guild.cs:175\'s "unknown-guild" is the reveal\'s own)');
});

test('L10N3e scenes: a guild hall and a temple are named off GetFactionData (FormulaHelper.cs:3020-3036) - the town host\'s one name bag, so the Where-is list, %cbd and a quest\'s building read the translation\'s name', async () => {
  const town = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: 17,
    topics: { locationName: 'Daggerfall', regionName: 'Daggerfall', mapId: DAGGERFALL_MAP_ID, regionIndex: 17, exteriorBuildings: [], blocks: [] },
  });
  await quiet(() => town.ensureLoaded());
  town.factionDict.set(40, { id: 40, name: 'The Mages Guild', children: [] });
  town.factionDict.set(82, { id: 82, name: 'Arkay', children: [83] });
  town.factionDict.set(83, { id: 83, name: 'The Benevolence of Arkay', children: [] });
  const show = () => {
    const o = town.nameOpts();
    return [generateBuildingName(9, BUILDING_TYPES.GuildHall, { ...o, factionId: 40 }), generateBuildingName(9, BUILDING_TYPES.Temple, { ...o, factionId: 82 }),
      o.factionName(999), o.templeName(999)];
  };
  const { en, fr } = inFrench({ Internal_Factions: [['40', 'La Guilde des mages factice'], ['83', 'La Bienveillance factice'], ['82', 'Arkay factice']] }, show);
  assert.deepEqual(en, ['The Mages Guild', 'The Benevolence of Arkay', '', '']);
  assert.deepEqual(fr, ['La Guilde des mages factice', 'La Bienveillance factice', '', ''], 'the temple by its first child, as DFU names it');
});

test('L10N3e scenes: the summoning\'s own lines name the prince as %dae does (PersistentFactionData.cs:176) - by source, since they sit inside the summoning flow\'s answer, which needs the whole host', () => {
  const wm = host('worldModes.js').text;
  assert.match(wm, /box\(r\.textId, r\.daedra, `\$\{getLocalizedFactionName\(r\.daedra\.factionId, r\.daedra\.name\)\} has met you before\.`\)/);
  assert.match(wm, /text: `\$\{getLocalizedFactionName\(r\.daedra\.factionId, r\.daedra\.name\)\} answers your summons\.`/);
  assert.doesNotMatch(wm, /\$\{r\.daedra\.name\}/, 'no line shows the table\'s canonical name');
});

test('L10N3e scenes: the world host hands the dungeon its one map-item reveal - the name as shown - and worldModes passes it on (MAPLOOT1\'s door)', () => {
  assert.match(host('world.js').text, /revealLocation, revealMap: \(\) => useHooks\.revealMap\(\),/);
  assert.match(host('worldModes.js').text, /revealMap: host\.revealMap \?\? null,/);
});
