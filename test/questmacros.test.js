// Q4-i - THE MACRO ENGINE: QuestMacroHelper + QuestMCP + the
// resource ExpandMacro overrides, over the corpus and a crafted
// world. THE CORPUS GATE: all 3,817 messages of the 265 vendored
// quests expand HEADLESS - exactly 3 throw, the %di NRE trio
// (LastPlaceReferenced.Scope read before the null check, DFU's own
// crash surface), and the error shapes land exactly where C#'s
// GetValue ladder puts them - and NOTHING lands on [undefined], the
// missing-handler arm, now that the capitalized pronoun family is
// registered as MacroHelper.cs:240-245 registers it (AUDIT 24).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { getMacro, MACRO_TYPES, expandQuestString, getMessageResources, questMacroSource, getContextValue, setIdRegion } from '../src/systems/quest/questMacros.js';
import { srand } from '../src/formats/dfRandom.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// ---- the crafted world (the Q3-ii town + the macro seams) ----

const flat = (record, x = 40, y = 8, z = 60) => ({ textureArchive: 199, textureRecord: record, xPos: x, yPos: y, zPos: z });
const building = (buildingType, { factionId = 0, nameSeed = 777 } = {}) =>
  ({ buildingType, factionId, nameSeed, locationId: 0, sector: 0, quality: 9 });

const FACTIONS = new Map([
  [364, { id: 364, type: 4, name: 'King Gothryd', race: 3, flat1: (177 << 7) + 1, flat2: (177 << 7) + 2 }],
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1, flat1: (182 << 7) + 5, flat2: (182 << 7) + 6 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1, ruler: 2, rulerNameSeed: 0x12345678, race: 3, children: [] }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
  [40, { id: 40, type: 2, name: 'The Mages Guild', race: -1 }],
  // the two templar ORDERS the %god arms resolve through: Temple
  // .GetDivine answers by the record's PARENT for an order
  // (Temple.cs:312-319). 82 = The_Order_of_Arkay (parent 21),
  // 106 = The_Temple_of_Stendarr (parent 33), which is what
  // MapsFile.RegionTemples[0] names.
  [82, { id: 82, type: 2, parent: 21, name: 'The Order of Arkay', race: -1 }],
  [106, { id: 106, type: 2, parent: 33, name: 'The Temple of Stendarr', race: -1 }],
]);

function makeWorld() {
  const townBuildings = [building(15), building(17), building(9)];
  const townInteriors = [[flat(11), flat(18)], [flat(11)], [flat(18)]];
  const block = {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: townBuildings, otherNames: null },
      subRecords: townBuildings.map((_, i) => ({ interior: { blockFlatObjectRecords: townInteriors[i] ?? [] } })),
    },
  };
  const world0 = mapPixelToWorldCoord(100, 100);
  const town = {
    loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0,
    hasDungeon: false, mapTableData: { mapId: 111, locationType: 0, dungeonType: -1 },
    exterior: {
      buildings: [building(15), building(9)],
      recordElement: { header: { x: world0.x, y: world0.y } },
      exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] },
    },
    dungeon: null,
  };
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: 111, locationType: 0, dungeonType: -1 }] };
  const world = {
    maps: {
      regionCount: 1,
      getRegion: () => region,
      getLocation: () => town,
      getLocationByName: () => town,
      getRmbBlockName: () => 'TESTAA00.RMB',
      readLocationIdFast: () => 0x400,
      getClimateIndex: () => 231,
    },
    getBlock: () => block,
    currentLocation: () => town,
    currentRegionIndex: () => 0,
    currentLocationIndex: () => 0,
    isPlayerInLocationRect: () => true,
    playerInside: () => world._inside,
    isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}),
    getFactionData: (id) => FACTIONS.get(id) ?? null,
    findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
    currentRegionPeople: () => 201,
    currentRegionCourt: () => 867,
    currentRegionFaction: () => 201,
    currentRegionRace: () => 3,   // GetRaceOfCurrentRegion is a RACES value - 3 is Nord
    // the Q4-i macro seams
    getRandomText: (id) => `TEXT.RSC#${id}`,
    flatCaption: (archive, record) => `flat ${archive}.${record}`,
    playerVampireClanName: () => world._vamClan,
    regionVampireClanName: () => 'the Vraseth',
    divineOfTempleFaction: (id) => (id === 82 ? 'Akatosh' : null),
    locationCompassDirection: () => 'due north',
    buildingCompassDirection: (key) => `inside, key ${key}`,
    showClocksAsCountdown: () => false,
    findFactionByTypeAndRegion: (type) => (type === 7 ? world._province : null),
    _inside: null, _vamClan: null,
    _province: { ruler: 1, children: [364] },
  };
  return world;
}

function makeMachine(world) {
  const calls = [];
  const m = new QuestMachine({
    nowSeconds: () => 100000,
    world,
    playerName: () => 'Ada Lovelace',
    playerRaceName: () => 'Breton',
    playerGender: () => 'female',
    addDialog: (...args) => calls.push(['addDialog', ...args]),
    lastNPCClicked: () => m.clicked,
  });
  m.clicked = null;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const schedule = (m, lines, rolls = () => 0.4) => m.scheduleQuest(lines, 0, { rolls });
const expandOne = (q, id) => {
  const texts = q.getMessage(id).getTextTokens(-1, () => 0, true).map((t) => t.text ?? '');
  while (texts.length && texts[texts.length - 1] === '') texts.pop();
  return texts.join('|');
};

// ---------------------------------------------------------------

test('CORPUS GATE: all 3,817 messages of 265 quests expand headless; exactly the %di NRE trio throws', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  let quests = 0, messages = 0;
  const throwers = [];
  const shapes = new Map();
  for (const f of readdirSync(join(VENDOR, 'Quests')).filter((f) => f.endsWith('.txt')).sort()) {
    const q = m.parser.parse(read(join(VENDOR, 'Quests', f)).split(/\r\n|\r|\n/), 0,
      { rolls: () => 0.5, actionFactory: m._actionFactory });
    quests++;
    for (const msg of q.messages.values()) {
      messages++;
      try {
        for (const t of msg.getTextTokens(-1, () => 0.5, true)) {
          for (const mm of (t.text ?? '').matchAll(/%\w+\[(\w+)\]/g)) {
            shapes.set(mm[1], (shapes.get(mm[1]) ?? 0) + 1);
          }
        }
      } catch {
        throwers.push(`${f}:${msg.id}`);
      }
    }
  }
  assert.equal(quests, 265);
  assert.equal(messages, 3817);
  // the %di quirk: LastPlaceReferenced.Scope before the null check -
  // these three messages crash in DFU too
  assert.deepEqual(throwers, ['P0B00L01.txt:1014', 'R0C10Y12.txt:1012', 'R0C11Y03.txt:1011']);
  // C#'s GetValue error shapes, exactly. AUDIT 24 systems: the old
  // count here was 15 - the corpus's 14 %G3 lines plus its 1 %G1 -
  // on the false premise that "only %G has a capitalized handler".
  // MacroHelper.cs:240-245 registers all six (%G %G1 %G2 %G2self %G3
  // %G4), so NOTHING in the corpus reaches the [undefined] arm.
  assert.equal(shapes.get('undefined'), undefined, 'no corpus macro is missing a handler');
  assert.equal(shapes.get('srcDataUnknown'), 69);
  assert.ok(shapes.get('nullMCP') > 1000, 'the world-backed handlers pend LOUDLY headless');
});

test('getMacro: the ordered alternation, the token surface, and the underscore truncation quirk', () => {
  assert.deepEqual(getMacro('_qgiver_'), { token: '_qgiver_', type: MACRO_TYPES.NameMacro1, symbol: 'qgiver' });
  assert.deepEqual(getMacro('__qgiver_'), { token: '__qgiver_', type: MACRO_TYPES.NameMacro2, symbol: 'qgiver' });
  assert.deepEqual(getMacro('___dung_'), { token: '___dung_', type: MACRO_TYPES.NameMacro3, symbol: 'dung' });
  assert.deepEqual(getMacro('____dung_'), { token: '____dung_', type: MACRO_TYPES.NameMacro4, symbol: 'dung' });
  assert.deepEqual(getMacro('=clock_'), { token: '=clock_', type: MACRO_TYPES.DetailsMacro, symbol: 'clock' });
  assert.deepEqual(getMacro('==npc_'), { token: '==npc_', type: MACRO_TYPES.FactionMacro, symbol: 'npc' });
  assert.deepEqual(getMacro('=#jump_'), { token: '=#jump_', type: MACRO_TYPES.BindingMacro, symbol: 'jump' });
  assert.deepEqual(getMacro('%pcn'), { token: '%pcn', type: MACRO_TYPES.ContextMacro, symbol: 'pcn' });
  // adjacent punctuation stays outside the token
  assert.equal(getMacro('_qgiver_.').token, '_qgiver_');
  // KEPT QUIRK: the inner class has no underscore - _one_day_
  // truncates to _one_ and the symbol misses its resource
  assert.deepEqual(getMacro('_one_day_'), { token: '_one_', type: MACRO_TYPES.NameMacro1, symbol: 'one' });
});

test('the Person macros: name, dialog-place names, BLANK, the flat caption, the questor faction swap', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ of __npc_ in ___npc_ of ____npc_', '',
    'Message:  1012', ' =npc_ serves ==npc_', '',
    'QBN:',
    'Person _npc_ group Shopkeeper', '',
    'variable _pad_',
  ]);
  const p = q.getResource({ name: 'npc' });
  // the shopkeeper's home is the generalstore - the dialog place
  const line = expandOne(q, 1011);
  assert.ok(line.startsWith(` ${p.displayName} of `), 'NameMacro1 is the display name');
  const home = q.getPlace(p.homePlaceSymbol);
  assert.ok(line.includes(`of ${home.siteDetails.buildingName} in `), '__npc_ is the BUILDING, never the town');
  assert.ok(line.includes('in Bigtown of Testshire'), 'town and region ride the dialog place');
  assert.equal(q.lastResourceReferenced, p, 'the person latched for pronouns');
  const line2 = expandOne(q, 1012);
  assert.equal(line2, ' flat 182.5 serves The Merchants', 'the FLATS.CFG caption (male flat1) + the faction name');
});

test('a person with NO place answers the literal BLANK, as C# does', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' at __king_', '',
    'QBN:',
    'Person _king_ named King_Gothryd', '',
    'variable _pad_',
  ]);
  assert.equal(expandOne(q, 1011), ' at BLANK', 'individuals have no generated home (the dead-arm law)');
});

test('the Foe macros: _symbol_ is the TYPE name, =symbol_ the display name - the C# inversion', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' a _rat_ called =rat_', '',
    'QBN:',
    'Foe _rat_ is Giant_rat', '',
    'variable _pad_',
  ]);
  const rat = q.getResource({ name: 'rat' });
  assert.equal(expandOne(q, 1011), ` a Rat called ${rat.displayName}`);
  assert.equal(q.lastResourceReferenced, rat);
});

test('the Clock macro: =symbol_ answers CEILING days of the STARTING time (the DFU default setting)', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' =lim_ days', '',
    'QBN:',
    'Clock _lim_ 1.12:00', '',
    'variable _pad_',
  ]);
  assert.equal(expandOne(q, 1011), ' 2 days', 'Ceiling(1.5 days) = 2');
});

test('the %-macros over the seams: player facts, %pct falling to the player name, %G3 capitalized', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' %pcn / %pcf / %ra / %pct / %pg3 / %G3', '',
    'QBN:', 'variable _pad_',
  ]);
  assert.equal(expandOne(q, 1011),
    ' Ada Lovelace / Ada / Breton / Ada Lovelace / her / His',
    "the %pct chain lands on the PLAYER's name; %G3 is Pronoun3Cap over the null-LastResourceReferenced default");
});

test('the pronoun family reads the LAST-REFERENCED resource, %G capitalizes', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ says %g %g2 %g2self %g3 %g4 %G', '',
    'QBN:',
    'Person _npc_ female group Shopkeeper', '',
    'variable _pad_',
  ]);
  const out = expandOne(q, 1011);
  assert.ok(out.endsWith(' says she her herself her hers She'), out);
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' %g %g3', '',
    'QBN:', 'variable _pad_',
  ]);
  assert.equal(expandOne(q2, 1011), ' he his', 'no resource referenced defaults MALE');
});

test('AUDIT 24: a Place expansion does NOT steal the pronoun context from the Person', () => {
  // Place.ExpandMacro (Place.cs:250) latches ParentQuest
  // .LastPlaceReferenced and nothing else - LastResourceReferenced is
  // written in exactly two places in the DFU tree, Person.cs:295 and
  // Foe.cs:157. The port latched BOTH from the Place, so any place
  // symbol standing earlier in a message re-pointed every later
  // pronoun at it, and QuestResource's base Gender (Male) answered.
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ wants you to visit _shop_. Bring %g3 the book.', '',
    'QBN:',
    'Person _npc_ female group Shopkeeper', '',
    'Place _shop_ local tavern', '',
    'variable _pad_',
  ]);
  const out = expandOne(q, 1011);
  assert.ok(out.endsWith('Bring her the book.'), out);
  // ...and the Place latch itself still happens - %di reads it.
  assert.ok(q.lastPlaceReferenced, 'LastPlaceReferenced is still set by the same call');
  assert.equal(q.lastResourceReferenced?.symbol?.name ?? q.lastResourceReferenced?.symbol, 'npc',
    'the last RESOURCE stayed the Person');
});

test('%n/%fn/%mn are SEEDED by the quest UID - deterministic per quest, %mn offset by 3457', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' %n', '', 'Message:  1012', ' %n', '',
    'Message:  1013', ' %fn', '', 'Message:  1014', ' %mn', '',
    'QBN:', 'variable _pad_',
  ]);
  const n1 = expandOne(q, 1011), n2 = expandOne(q, 1012);
  assert.equal(n1, n2, 'the same quest answers the same %n every time');
  assert.notEqual(expandOne(q, 1013), expandOne(q, 1014), 'the +3457 male seed differs');
});

test('%qdt reads the CURRENT log step time (falling to quest start); %dat the world clock', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' %qdt / %dat', '',
    'QBN:', 'variable _pad_',
  ]);
  m.tick();   // the quest STARTS on the first tick - questStartTime stamps
  const out = expandOne(q, 1011);
  const [qdt, dat] = out.slice(1).split(' / ');
  assert.equal(qdt, dat, 'no journal entry selected - quest start IS now here');
  assert.match(dat, / the \d+(st|nd|rd|th) of \w/, 'the DFU date string shape (AUDIT 24: no year)');
  assert.equal(/, 3E \d+$/.test(dat), false, 'DateString has no year slot');
});

test('%god: the temple arm, the REGION temple fallback, and the random roll only when neither answers', () => {
  // QuestMCP.God (:217-243). AUDIT 24 systems: the port had only the
  // first arm and rolled a random divine everywhere else, so %god named
  // a different god on every expansion outside a temple.
  const godOf = (world, rolls) => {
    const m = makeMachine(world);
    const q = schedule(m, [
      'Quest: __QM', 'QRC:', 'Message:  1011', ' %god', '',
      'QBN:', 'variable _pad_',
    ], rolls);
    return expandOne(q, 1011);
  };
  // inside a temple: its own faction. 82 is an ORDER, so GetDivine
  // resolves it through the record's parent (21 = Arkay).
  const inTemple = makeWorld();
  inTemple._inside = { building: { buildingType: 14, factionId: 82 } };
  assert.equal(godOf(inTemple), ' Arkay');
  // OUTSIDE: MapsFile.RegionTemples[region 0] = 106, The Temple of
  // Stendarr - and it is STABLE, not a fresh roll each expansion.
  const outside = makeWorld();
  assert.equal(godOf(outside, () => 0.5), ' Stendarr');
  assert.equal(godOf(outside, () => 0.9), ' Stendarr', 'no roll is taken at all');
  // a region with NO temple (a 0 entry) falls to the random divine
  const noTemple = makeWorld();
  noTemple.currentRegionIndex = () => 2;   // RegionTemples[2] === 0
  assert.equal(godOf(noTemple, () => 0.5), ' Akatosh', 'Range(0,9) at 0.5 -> index 4');
  // ...and so does a Fighters Guild hall, "considered temples in some areas"
  const fg = makeWorld();
  fg._inside = { building: { buildingType: 14, factionId: 41 } };
  assert.equal(godOf(fg, () => 0.5), ' Akatosh');
});

test('%rn/%rt/%t walk the Province faction; %oth and %jok ride TEXT.RSC; %reg/%cn the map', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' %rn the %rt of %reg, %cn / %oth / %jok', '',
    'QBN:', 'variable _pad_',
  ]);
  assert.equal(expandOne(q, 1011),
    ' King Gothryd the King of Testshire, Bigtown / TEXT.RSC#201 / TEXT.RSC#200',
    'the Individual child is the ruler; oath 201+FactionRaces(Races 3 = Nord = 0); joke 200');
});

test('%vam answers the clan or the C# ERROR LITERAL; %kno trims the The-prefix', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:', 'Message:  1011', ' %vam / %kno', '',
    'QBN:', 'variable _pad_',
  ]);
  q.factionId = 40;
  assert.equal(expandOne(q, 1011), ' %vam[ERROR: PC not a vampire] / Mages Guild');
  world._vamClan = 'the Montalion';
  assert.equal(expandOne(q, 1011), ' the Montalion / Mages Guild');
});

test('%di: remote compass, local same-town building compass, and the NRE quirk on nothing referenced', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _shop_ lies %di', '',
    'QBN:',
    'Place _shop_ local generalstore', '',
    'variable _pad_',
  ]);
  assert.equal(expandOne(q, 1011).endsWith('lies inside, key 2'), true,
    'the local same-town arm answers the building compass');
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, [
    'Quest: __QM', 'QRC:', 'Message:  1011', ' %di', '',
    'QBN:', 'variable _pad_',
  ]);
  assert.throws(() => expandOne(q2, 1011), TypeError,
    "C# reads LastPlaceReferenced.Scope BEFORE the null check - the NRE, kept");
});

test('revealDialogLinks feeds the dialog table on NameMacro1 only, typed per resource', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ at _shop_', '',
    'QBN:',
    'Person _npc_ group Shopkeeper', '',
    'Place _shop_ local tavern', '',
    'variable _pad_',
  ]);
  // AUDIT 24 systems: GetTextTokens has no reveal PARAMETER - it
  // passes the literal true (Message.cs:181, Nystul's comment: "quest
  // popups should reveal them"). GetTextTokensByVariant is the arm
  // that takes QuestMacroHelper.cs:91's false default.
  q.getMessage(1011).getTextTokens(-1, () => 0, true);
  assert.deepEqual(m.of('addDialog').map((c) => [c[2], c[3]]),
    [['npc', 'Person'], ['shop', 'Location']]);
  m.calls.length = 0;
  q.getMessage(1011).getTextTokensByVariant(0);
  assert.equal(m.of('addDialog').length, 0, 'byVariant reveals nothing');
  m.calls.length = 0;
  q.getMessage(1011).getTextTokens(-1, () => 0, false);
  assert.equal(m.of('addDialog').length, 0, 'and no expansion means no reveal at all');
});

// ---- the Q4-i VERIFY pins (AUDIT IX's mutation campaign) ----

test('the Item macros: template name, the GOLD stack count, and a wrong-type macro staying raw', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' take _map_ and _gp_ but ==map_', '',
    'QBN:',
    'Item _map_ map', '',
    'Item _gp_ gold', '',
    'variable _pad_',
  ]);
  const map = q.getResource({ name: 'map' });
  const gp = q.getResource({ name: 'gp' });
  const out = expandOne(q, 1011);
  assert.ok(out.includes(`take ${map.daggerfallUnityItem.name} and `), 'the template name');
  assert.ok(out.includes(` and ${gp.daggerfallUnityItem.stackCount} but `), 'gold answers the STACK COUNT');
  assert.ok(out.endsWith('==map_'), 'FactionMacro is not an Item macro - the raw token stands');
});

test('the message DEFAULTS are DFU: bare reads expand, reveal nothing, and an explicit variant answers 0', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' hail %pcn from _npc_', '<--->', ' well met %pcn', '',
    'QBN:',
    'Person _npc_ group Shopkeeper', '',
    'variable _pad_',
  ]);
  const bare = q.getMessage(1011).getTextTokens();
  assert.ok(bare.some((t) => t.text?.includes('Ada Lovelace')), 'no-arg reads EXPAND (the DFU default)');
  // AUDIT 24 systems: ...and REVEAL, which the port had backwards -
  // Message.cs:181 hardcodes the reveal for every GetTextTokens read.
  // (Pinned on variant 0, the one that carries the _npc_ macro; the
  // no-arg read above rolls a variant and only sometimes names him.)
  m.calls.length = 0;
  q.getMessage(1011).getTextTokens(-1, () => 0);
  assert.deepEqual(m.of('addDialog').map((c) => c[2]), ['npc'],
    'a plain read reveals the Person it names');
  m.calls.length = 0;
  // an UNDEFINED variant hits the -1 default: the random draw, not 0
  const undef = q.getMessage(1011).getTextTokens(undefined, () => 0.99, false);
  assert.ok(undef.some((t) => t.text?.includes('well met')), 'the default variant is -1 = the roll');
  // the KEPT variant quirk: any explicit variant answers variant 0
  const v3 = q.getMessage(1011).getTextTokens(3, () => 0.99);
  assert.ok(v3.some((t) => t.text?.includes('hail')), 'explicit variant -> index 0, never variant');
  m.calls.length = 0;
  const byv = q.getMessage(1011).getTextTokensByVariant();
  assert.ok(byv.some((t) => t.text?.includes('hail Ada Lovelace')), 'byVariant defaults to 0 and expands');
  assert.equal(m.of('addDialog').length, 0, 'byVariant never reveals');
});

test('the Place macros exact: the BUILDING name, the town, and the regionIndex-0 workaround arm', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _shop_ / __shop_ / ___shop_ / ____shop_', '',
    'QBN:',
    'Place _shop_ local generalstore', '',
    'variable _pad_',
  ]);
  const shop = q.getResource({ name: 'shop' });
  assert.equal(expandOne(q, 1011),
    ` ${shop.siteDetails.buildingName} / Bigtown / Bigtown / Testshire`,
    'the exact per-type answers; regionIndex 0 + a non-Alik\'r name takes the workaround arm');
  // the workaround must RE-DERIVE the index from the legacy name -
  // an arg-exact map proves which arm ran
  const regions = { 0: { name: 'Testshire' }, 7: { name: 'WorkaroundLand' } };
  m.deps.world.maps = {
    ...m.deps.world.maps,
    getRegion: (i) => regions[i] ?? null,
    getRegionIndex: (name) => (name === 'Testshire' ? 7 : -1),
  };
  assert.equal(expandOne(q, 1011).endsWith('WorkaroundLand'), true,
    'regionIndex 0 + Testshire re-derives index 7, never reads region 0');
});

test("the Person questor FactionMacro answers the QUEST's guild; a binding macro stays raw", () => {
  const m = makeMachine(makeWorld());
  m.clicked = { factionID: 510, nameSeed: 7, gender: GENDERS.Male };
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' ==qg_ / =#qg_', '',
    'QBN:',
    'Person _qg_ group Questor', '',
    'variable _pad_',
  ]);
  q.factionId = 40;
  assert.equal(expandOne(q, 1011), ' The Mages Guild / =#qg_',
    'the questor swap reads quest.factionId; BindingMacro has no Person arm');
});

test('%nrn: the Individual first child wins, else the rulerNameSeed & 0xffff draw on the faction race bank', () => {
  const world = makeWorld();
  const hooks = { world, playerName: () => 'Ada Lovelace' };
  // arm 1: the first child is an Individual - their name
  world.getFactionData = (id) => (id === 201
    ? { id: 201, children: [364], ruler: 2, rulerNameSeed: 0x12345678, race: 2 }
    : FACTIONS.get(id) ?? null);
  assert.equal(getContextValue('%nrn', { hooks, uid: 1 }, hooks), 'King Gothryd');
  // arm 2: no individual child - the SEEDED lord (Queen -> Female,
  // seed 0x5678, the Redguard bank)
  world.getFactionData = (id) => (id === 201
    ? { id: 201, children: [], ruler: 2, rulerNameSeed: 0x12345678, race: 2 }
    : FACTIONS.get(id) ?? null);
  const seeded = getContextValue('%nrn', { hooks, uid: 1 }, hooks);
  assert.equal(seeded, 'Saalpki', 'srand(0x5678) on the Redguard female bank, verbatim');
});

test('the UID-seeded name sources are exact: %n gender coin, %fn, and the +3457 male offset', () => {
  const world = makeWorld();
  const stub = { uid: 4242, hooks: { world } };
  const src = questMacroSource(stub);
  assert.equal(src.name(), 'Raithi', 'srand(4242) + the DFRandom gender coin');
  assert.equal(src.femaleName(), 'Baos-i');
  assert.equal(src.maleName(), 'Cauvin', 'the +3457 offset');
  // uid 7's coin lands MALE - the pair pins the coin itself
  assert.equal(questMacroSource({ uid: 7, hooks: stub.hooks }).name(), "F'orcten");
});

test('%vcn succeeds for a VampireClan person by home region; the region miss falls to the faction name', () => {
  const world = makeWorld();
  world.regionVampireClanName = (i) => (i === 0 ? 'the Vraseth' : null);
  const stub = {
    uid: 1, hooks: { world },
    lastResourceReferenced: { isPerson: true, factionData: { type: 6, name: 'The Selenu' }, homeRegionIndex: -1 },
  };
  const src = questMacroSource(stub);
  assert.equal(src.vampireNpcClan(), 'the Vraseth', 'home -1 falls to the CURRENT region (0)');
  stub.lastResourceReferenced.homeRegionIndex = 5;
  assert.equal(src.vampireNpcClan(), 'The Selenu', 'an unmapped region answers the faction name');
});

test("%oth reads the QUESTOR's race first, then the clicked NPC, then the region", () => {
  // AUDIT 24 (the seven-slice sweep): every branch carries a RACES
  // value and ONE GetFactionRaceFromRace runs at the end, as
  // QuestMCP.Oath does it. The port used to mix the enums - a
  // FactionRaces questor field, a Races off NPCData, and whatever the
  // region seam felt like - and add all three to 201 alike.
  const world = makeWorld();
  const stub = {
    uid: 1, hooks: { world },
    questors: new Map([['qg', {}]]),
    getPerson: (sym) => (sym?.name === 'qg' ? { race: 6 } : null),   // Races.WoodElf
  };
  const src = questMacroSource(stub);
  assert.equal(src.oath(), 'TEXT.RSC#206', 'WoodElf is FactionRaces 5, so 201 + 5');
  const stub2 = {
    uid: 1, hooks: { world, lastNPCClicked: () => ({ race: 4 }) },   // Races.DarkElf
    questors: new Map(),
  };
  assert.equal(questMacroSource(stub2).oath(), 'TEXT.RSC#208',
    'the clicked arm: DarkElf is FactionRaces 7, not 4 - the naive add read HighElf');
  // and the region fallback, the same conversion
  const stub3 = { uid: 1, hooks: { world }, questors: new Map() };
  assert.equal(questMacroSource(stub3).oath(), 'TEXT.RSC#201',
    'the fixture region is Races.Nord (3), which is FactionRaces 0');
});

test('%reg honors the static idRegion override, arg-exact against the map', () => {
  const world = makeWorld();
  const regions = { 0: { name: 'Testshire' }, 1: { name: 'Otherland' } };
  world.maps = { ...world.maps, getRegion: (i) => regions[i] ?? null };
  const hooks = { world };
    assert.equal(getContextValue('%reg', { uid: 1, hooks }, hooks), 'Testshire');
  setIdRegion(1);
  assert.equal(getContextValue('%reg', { uid: 1, hooks }, hooks), 'Otherland', 'the talk-window override');
  setIdRegion(-1);
});

test('revealDialogLinks types every resource - Person/Location/Thing - on the INSTANT rebuild', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ at _shop_ with _map_', '',
    'QBN:',
    'Person _npc_ group Shopkeeper', '',
    'Place _shop_ local tavern', '',
    'Item _map_ map', '',
    'variable _pad_',
  ]);
  q.getMessage(1011).getTextTokens(-1, () => 0, true);
  // AUDIT 24 systems: the 4th argument is instantRebuildTopicLists,
  // and these arms use C#'s THREE-argument overload - the default is
  // TRUE, so the open listbox refreshes. The port passed false and
  // left the rebuild flags stranded.
  assert.deepEqual(m.of('addDialog').map((c) => [c[2], c[3], c[4]]),
    [['npc', 'Person', undefined], ['shop', 'Location', undefined], ['map', 'Thing', undefined]]);
});

test('%qdt renders the log entry BEING READ - Message.cs latches its own id', () => {
  // AUDIT 24 systems: GetTextTokens brackets the expansion with
  // `ParentQuest.CurrentLogMessageId = this.id;` ... `= -1;`
  // (Message.cs:178/:183, the only assignment to that field in DFU).
  // The port never wrote it, so getCurrentLogMessageTime always fell
  // through to questStartTime and every %qdt printed the accept date.
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1050', ' logged %qdt', '',
    'Message:  1051', ' logged %qdt', '',
    'Message:  1011', ' unlogged %qdt', '',
    'QBN:',
    ' log 1050 step 0',
    ' log 1051 step 1', '',
    'variable _pad_',
  ]);
  m.tick();   // the quest starts at 100000 and logs both steps
  const atStart = expandOne(q, 1050);
  // a message that is not a log entry at all falls through to the
  // quest start, as C#'s no-match arm does
  assert.equal(expandOne(q, 1011).replace('unlogged', 'logged'), atStart);
  // move the SECOND entry's stamp: reading THAT message must answer
  // the moved date, and reading the first must not
  const second = [...q.activeLogMessages.values()].find((l) => l.messageID === 1051);
  second.time = 100000 + 5 * 86400;
  assert.notEqual(expandOne(q, 1051), atStart, 'the id-matched entry time wins over the quest start');
  assert.equal(expandOne(q, 1050), atStart, 'and the OTHER entry is untouched by it');
  // the latch is released again, exactly as C#'s trailing `= -1`
  assert.equal(q.currentLogMessageId, -1);
});

test('%rn falls to a seeded random full name when the province has no Individual child', () => {
  const world = makeWorld();
  world._province = { ruler: 1, children: [] };
  world.getFactionData = () => null;
  const hooks = { world };
    srand(9001);
  assert.equal(getContextValue('%rn', { uid: 1, hooks }, hooks), "D'eght-si",
    'the fallback draws on the live DFRandom chain - exact from srand(9001), the FEMALE coin');
  srand(9003);
  assert.equal(getContextValue('%rn', { uid: 1, hooks }, hooks), 'Rirhtun',
    'srand(9003) lands the MALE coin - the pair pins the coin itself');
});

test('expandQuestString expands ONE context macro in a bare string; getMessageResources enumerates', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Quest: __QM', 'QRC:',
    'Message:  1011', ' _npc_ and _shop_', '',
    'QBN:',
    'Person _npc_ group Shopkeeper', '',
    'Place _shop_ local tavern', '',
    'variable _pad_',
  ]);
  assert.equal(expandQuestString(q, 'Hail, %pcn'), 'Hail, Ada Lovelace');
  assert.equal(expandQuestString(q, '_npc_ stays'), '_npc_ stays', 'only context macros expand here');
  const resources = getMessageResources(q.getMessage(1011));
  assert.deepEqual(resources.map((r) => r.symbol.name), ['npc', 'shop']);
});
