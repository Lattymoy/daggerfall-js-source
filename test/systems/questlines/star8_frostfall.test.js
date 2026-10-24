// STAR8 (bible/11-Multiplayer/Starfall.md section 7): THE THIRTEENTH OF FROSTFALL - the Starfall's questline. Its shape
// and its law on both ends (the first star and three more witnessed, the Starwarden on the three); its season - the line
// begins only on the Witches' Festival's days (net/festivalLaw.js, the Starfall's own calendar) and the window draws none
// not begun outside them (UI-Calm's law), while a begun line's star steps wait for the next Festival and the rest go on;
// a quest's foe named and stood as a
// woman (`ql name _foe_ <Name> female`); the three stars' step run through the real bridge to its outcome.
// tools/mutants/star8.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QL_LINES, lineById, lineOpens, opensWords } from '../../../src/systems/questlines/qlLines.js';
import { createLineRunner, NEED_CHECKS, STEP_GAP_S } from '../../../src/systems/questlines/qlLineRunner.js';
import { QL_SERVICE_LINES, QL_WITNESS_KINDS, qlStepClaimed, QL_TITLES, qlTitleBit } from '../../../src/net/questlineClaims.js';
import { ACT_KINDS } from '../../../src/systems/questlines/qlActs.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { TITLES } from '../../../src/net/identityToken.js';
import { TITLE_TEXT } from '../../../src/ui/playerBadge.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { freshState } from '../../../src/systems/questlines/qlState.js';
import { GENDERS } from '../../../src/characters/nameHelper.js';
import { packMachine, QUEST_FILES } from '../../qlSources.mjs';
import { mintQuestFoeWave } from '../../../src/scenes/quest/questFoeHost.js';   // AUDIT STAR8 S1: a wave as the host mints it - a behaviour a body
import { FOE_STANDS_TICKS } from '../../../src/systems/quest/machine.js';
import { isPlayerAtBuildingType } from '../../../src/systems/quest/place.js';
import { QL_PLACE_ROWS } from '../../../src/systems/questlines/qlActions.js';
import { HAS_ARENA2, loadMaps } from '../../arena1Data.mjs';

const { fromMs: FROM_MS, toMs: TO_MS } = FESTIVALS[0];   // the Witches' Festival's days, the Starfall's
const IN = FROM_MS + 86_400_000;   // a day into the Festival
const OUT = TO_MS + 86_400_000;   // a day after it
const LINE = lineById('thirteenthFrostfall');
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A machine the runner drives (ql12_lines.test.js's), and the runner on a clock both of its own. */
function runnerAt({ level = 10, online = true, ms = IN } = {}) {
  setPref(QUESTLINES_PREF, true);
  let uid = 1;
  const machine = {
    quests: new Map(), questsToInvoke: [], scheduled: [],
    scheduleQuestByName(name) { const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; machine.questsToInvoke.push(q); machine.scheduled.push(name); return q; },
    tick() { for (const q of machine.questsToInvoke.splice(0)) machine.quests.set(q.uid, q); },
    end(name) { for (const q of machine.quests.values()) if (q.questName === name && !q.questComplete) { q.questComplete = true; q.questSuccess = true; return q; } return null; },
  };
  const clock = { s: 1000, ms };
  const service = { claim: async () => ({ ok: true, data: { why: 'unpaid' } }), guest: () => false };
  const runner = createLineRunner({ machine, service, nowMs: () => clock.ms, ctx: { level: () => level, online: () => online, nowSeconds: () => clock.s } });
  // a dozen lines may open at once, an hour apart (LINES-17): step until this one has, or a day has gone
  const step = () => { runner.look(); machine.tick(); };
  const settle = () => { for (let i = 0; i < 24 && !runner.lineState(LINE.id); i++) { step(); clock.s += STEP_GAP_S; } };
  return { runner, machine, clock, step, settle };
}
const row = (runner) => runner.rows().find((r) => r.id === LINE.id) ?? null;

test('STAR8 THE LINE: the Festival\'s, tier 3 - from level 6, online, a registered account, while the Starfall runs; its four steps, the star steps needing the Starfall; the service witnesses the first star and three more and pays the Starwarden on the three, its last witnessed step - nothing on the client\'s word (mutants: a need, the opener, a witness, the title\'s step)', () => {
  assert.ok(LINE);
  assert.deepEqual([LINE.group, LINE.tier], ['festival', 3]);
  assert.deepEqual({ ...LINE.opens }, { level: 6, online: true, account: true, event: 'starfall' });
  assert.deepEqual(LINE.steps.map((s) => [s.quest, s.title(), [...(s.needs ?? [])]]), [
    ['QLTF01', 'Music in the Woods', ['starfall']], ['QLTF02', 'The Coven on the Bluff', []],
    ['QLTF03', 'Three Stars', ['starfall']], ['QLTF04', 'What the Thread Is Worth', []],
  ]);
  assert.deepEqual([LINE.title(), LINE.giver()], ['The Thirteenth of Frostfall', 'Morwen, a Wyrd Sister of Glenmoril']);   // PIN MOVED (AUDIT STAR8 T1): of the Festival's Glenmoril Wyrd
  assert.equal(QL_LINES.indexOf(LINE), QL_LINES.findIndex((l) => l.id === 'oldCoil') + 1, 'after the Coil, before the introductions');
  const law = QL_SERVICE_LINES.thirteenthFrostfall;
  assert.deepEqual({ ...law, witness: { ...law.witness } }, { steps: 4, witness: { 0: 'star', 2: 'stars3' }, title: 'starwarden', titleAt: 2 });
  assert.ok(QL_WITNESS_KINDS.includes('star') && QL_WITNESS_KINDS.includes('stars3'));
  assert.deepEqual([0, 1, 2, 3].map((s) => qlStepClaimed('thirteenthFrostfall', s)), [true, false, true, false], 'the spindle and its fate are the client\'s');
  assert.equal(ACT_KINDS['star-held'], 'endgame', 'a receipt the service holds');
  assert.deepEqual([QL_TITLES.at(-2) /* PIN MOVED (KETCH): the Sky-Ketch's Skyfarer after it */, TITLES.at(-4) /* PIN MOVED (WITCH1): the festival's two after it; (KETCH) and the Skyfarer */, qlTitleBit('starwarden'), TITLE_TEXT.starwarden], ['starwarden', 'starwarden', 32, 'Starwarden']);
});

test('STAR8 THE WITNESSES on the service: a star held - a row of stars_held inside the line\'s window - and the third such row for the three (mutants: the table, the offset)', () => {
  const sql = read('server-account/src/questlines.js');
  assert.match(sql, /star: `\(SELECT MIN\(s\.at\) FROM stars_held s WHERE s\.account = \?1 AND \$\{WINDOW\('s'\)\}\)`,/);
  assert.match(sql, /stars3: `\(SELECT s\.at FROM stars_held s WHERE s\.account = \?1 AND \$\{WINDOW\('s'\)\} ORDER BY s\.at, s\.star LIMIT 1 OFFSET 2\)`,/);
});

test('STAR8 THE SEASON: the line begins only on the Festival\'s days - the festival\'s own calendar, read off the runner\'s clock; out of season the window draws it not at all, in season locked with what it waits on, and it begins (mutants: the opener unread; the calendar unread)', () => {
  const probe = (ms, o = {}) => ({ level: () => 10, online: () => true, registered: () => true, lineDone: () => false, need: (n) => !!NEED_CHECKS[n]?.(ms), ...o });
  assert.equal(lineOpens(LINE, probe(OUT)), false, 'the Festival over');
  assert.equal(lineOpens({ ...LINE, steps: [{ quest: 'QLTF02', title: () => 'x' }] }, probe(OUT)), false, 'the opener its own, whatever the first step needs');
  assert.equal(opensWords(LINE, probe(OUT)), 'Opens during the Witches’ Festival.', 'said once, though the first step needs it too');
  const out = runnerAt({ ms: OUT });
  out.settle();
  assert.equal(out.runner.lineState(LINE.id), null, 'not begun');
  assert.equal(row(out.runner), null, 'UI-Calm: nothing drawn that cannot be taken');
  assert.equal(lineOpens(LINE, probe(IN)), true);
  assert.equal(lineOpens(LINE, probe(IN, { level: () => 5 })), false, 'level 6');
  assert.equal(opensWords(LINE, probe(IN, { level: () => 5 })), 'Opens at level 6.');
  assert.equal(NEED_CHECKS.starfall(FROM_MS - 1), false, 'before the Festival');
  assert.equal(NEED_CHECKS.starfall(FROM_MS), true, 'its first instant');
  assert.equal(NEED_CHECKS.starfall(TO_MS), false, 'after it');
  assert.equal(NEED_CHECKS.starfall(IN), true);
  const low = runnerAt({ level: 5 });
  low.step();
  assert.deepEqual([row(low.runner).state, row(low.runner).opens], ['locked', 'Opens at level 6.'], 'in season: drawn, and what it waits on said');
  const r = runnerAt();
  r.settle();
  assert.ok(r.machine.scheduled.includes('QLTF01'), 'it begins');
  const early = runnerAt({ ms: FROM_MS - 1 });
  early.settle();
  assert.equal(early.runner.lineState(LINE.id), null, 'before the Festival opens, nothing begins');
  assert.equal(row(early.runner), null);
});

test('STAR8 A BEGUN LINE OUT OF SEASON: drawn, its star step waiting for the next Festival and saying so; the spindle\'s steps go on without it (mutants: a star step begun out of season; the words)', () => {
  const r = runnerAt();
  r.settle();
  r.runner.ended(r.machine.end('QLTF01'), { id: 'met', failure: false });
  r.clock.ms = OUT;   // the Festival over
  r.clock.s += STEP_GAP_S;
  r.step();
  assert.ok(r.machine.scheduled.includes('QLTF02'), 'the Bluff is no star: it begins out of season');
  r.runner.ended(r.machine.end('QLTF02'), { id: 'wound', failure: false });
  r.clock.s += STEP_GAP_S;
  r.step();
  assert.ok(!r.machine.scheduled.includes('QLTF03'), 'three stars wait for stars');
  const w = row(r.runner);
  assert.deepEqual([w.state, w.opens], ['waiting', 'Opens during the Witches’ Festival.']);
  r.clock.ms = IN;   // the next Festival
  r.step();
  assert.ok(r.machine.scheduled.includes('QLTF03'), 'the next Festival: it begins');
});

test('STAR8 `ql name` NAMES A FOE: every one of it wears the name and a class foe stands as the gender named - the Coven on the Bluff\'s Spinner and her sisters are women; the name and the gender ride a save; a monster takes a name and no gender, with a warning (mutants: the gender unread; the foe unnamed; the class guard)', () => {
  const lines = ['Quest: __QLFOE', 'DisplayName: A Foe', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '',
    'QBN:', 'Foe _spinner_ is Sorcerer', 'Foe _sisters_ is 3 Nightblade', 'Foe _rat_ is Giant_rat', '',
    '\tql name _spinner_ The_Spinner female', '\tql name _sisters_ Sister_of_the_Bluff female', '\tql name _rat_ Old_Whiskers female'];
  const m = packMachine({ getQuestSourceLines: () => lines, questlinesStamp: () => freshState() });
  const quest = m.startQuestByName('__QLFOE');
  const warn = console.warn; const warned = [];
  console.warn = (s) => warned.push(String(s));
  try { m.tick(); } finally { console.warn = warn; }
  const foe = (name) => quest.getFoe({ name });
  assert.deepEqual([foe('spinner').displayName, foe('spinner').gender], ['The Spinner', GENDERS.Female]);
  assert.deepEqual([foe('sisters').displayName, foe('sisters').gender, foe('sisters').spawnCount], ['Sister of the Bluff', GENDERS.Female, 3]);
  assert.equal(foe('rat').displayName, 'Old Whiskers');
  assert.equal(foe('rat').gender, GENDERS.Male, 'a monster stands as DFU stands every monster');
  assert.ok(warned.some((s) => s.includes('ql name: _rat_ takes no gender here')), warned.join('\n'));
  const m2 = packMachine({ getQuestSourceLines: () => lines, questlinesStamp: () => freshState() });
  m2.restoreSaveData(m.getSaveData());
  const back = m2.quests.get(quest.uid).getFoe({ name: 'spinner' });
  assert.deepEqual([back.displayName, back.gender], ['The Spinner', GENDERS.Female], 'they ride the save');
});

test('STAR8 THE SCRIPTS: the Glenmoril Coven met on arrival each time, and nobody stood at an open-air coven; at the Bluff the Spinner and her three sisters come out of the dark - called by the arrival, and cleared only by `ql gone` once the coven is gone unfought (AUDIT STAR8 S1: its task ahead of the ambush\'s, so the ambush sees itself unset before it is set again), so a return while it stands brings no second - stood as women; the spindle the player\'s as she falls, never on her body, the Sisters\' favour lost with her and Morwen\'s patience endless once it is in hand; Morwen\'s meetings latched once; the spindle\'s fate handed over by `get item`, never `give pc` (a give is the quest\'s pay - qlLayer.js reward); the priest in Arkay\'s own temple; each way its own outcome and its sheet\'s pay, standing and named piece (mutants: a way\'s outcome; the spindle given as pay; the ambush unlatched)', () => {
  const text = (q) => readFileSync(QUEST_FILES.get(q).path, 'utf8');
  for (const q of ['QLTF01', 'QLTF02', 'QLTF04']) {
    assert.match(text(q), /^Place _glenmoril_ permanent GlenmorilCoven$/m, q);
    assert.match(text(q), /^\tpc at _glenmoril_ set _atcoven_( saying \d{4})?$/m, q);
    assert.doesNotMatch(text(q), /place (?:npc|foe|item) \S+ at _(?:glenmoril|bluff)_/, `${q}: a coven has no quest marker`);
  }
  assert.match(text('QLTF01'), /^\tql act star-held 1$/m);
  assert.match(text('QLTF01'), /^_met_ task:\n\twhen _held_ and _atcoven_$/m);
  assert.match(text('QLTF03'), /^\tql act star-held 3$/m);
  const bluff = text('QLTF02');
  for (const re of [/^Place _bluff_ permanent BluffCoven$/m, /^Foe _spinner_ is Sorcerer$/m, /^Foe _sisters_ is 3 Nightblade$/m, /^\tql name _spinner_ The_Spinner female$/m,
    /^\tql name _sisters_ Sister_of_the_Bluff female$/m,
    /^_arrived_ task:\n\twhen _courier_ and _atbluff_\n\tstart task _ambush_$/m,
    /^_lost_ task:\n\tql gone _spinner_ _sisters_\n\tclear _arrived_ _ambush_ _lost_$/m,
    /^_ambush_ task:\n\tcreate foe _spinner_ every 0 minutes 1 times with 100% success msg 1019\n\tcreate foe _sisters_ every 0 minutes 1 times with 100% success$/m,
    /^Person _bluffsister_ face 1 faction The_Sisters_of_the_Bluff remote$/m,
    /^_spinnerslain_ task:\n\tkilled 1 _spinner_ saying 1013\n\tget item _spindle_\n\tchange repute with _bluffsister_ by -10$/m,
    /^_hasspindle_ task:\n\tstop timer _wait_\n/m,
    /^_back_ task:\n\twhen _hasspindle_ and _atcoven_\n\tstart task _home_$/m]) assert.match(bluff, re);
  assert.doesNotMatch(bluff, /give item _spindle_/, 'AUDIT STAR8 S1: never on her body - a body can leave the world');
  assert.equal([...bluff.matchAll(/^\tclear .*_ambush_/gm)].length, 1, 'the ambush cleared by `ql gone` alone');
  assert.doesNotMatch(bluff, /clear _home_/, 'Morwen asks once');
  assert.ok(bluff.indexOf('_arrived_ task:') < bluff.indexOf('_lost_ task:') && bluff.indexOf('_lost_ task:') < bluff.indexOf('_ambush_ task:'), 'the re-arm\'s task between the arrival\'s and the ambush\'s');
  assert.match(text('QLTF04'), /^Place _temple_ remote templeArkay$/m, 'AUDIT STAR8 S4: Arkay\'s own temple');
  assert.match(text('QLTF04'), /^_arrived_ task:\n\twhen _courier_ and _atcoven_\n\tstart task _met_$/m);
  const worth = text('QLTF04');
  assert.doesNotMatch(worth, /give pc _spindle_/, 'the spindle is no pay');
  assert.equal([...worth.matchAll(/^\tget item _spindle_ saying 10\d\d$/gm)].length, 2, 'handed over for the Guild and for Arkay');
  const outcomes = (q) => Object.fromEntries(sheetFor(q).outcomes.map((o) => [o.id, [o.pay, { ...(o.standing ?? {}) }, o.named?.name ?? null]]));
  assert.deepEqual(outcomes('QLTF02'), { unwound: ['greater', {}, null], wound: ['lesser', { The_Glenmoril_Witches: 3 }, null], failed: ['none', {}, null] });
  assert.deepEqual(outcomes('QLTF04'), {
    burned: ['lesser', { The_Glenmoril_Witches: 10 }, 'Morwen\'s Hunt-Charm'], guild: ['greater', {}, 'Starglass Rod'],
    temple: ['standard', { The_Order_of_Arkay: 5 }, 'Thread-Cutter'], failed: ['none', {}, null],
  });
  for (const [q, ways] of [['QLTF02', ['_unwound_', '_wound_']], ['QLTF04', ['_burned_', '_guild_', '_temple_']]]) {
    for (const w of ways) assert.match(text(q), new RegExp(`^\\toutcome ${w}$`, 'm'), `${q} ${w}`);
  }
});

test('STAR8 THREE STARS, through the real bridge: the step waits on three stars held and settles `held`, paying a choice of three; a star short ends nothing (mutants: the count)', async () => {
  const { createQuestBridge } = await import('../../../src/scenes/quest/questBridge.js');
  const { questSource } = await import('../../qlSources.mjs');
  const { questlinesOn } = await import('../../../src/systems/questlines/qlLaw.js');
  setPref(QUESTLINES_PREF, true);
  const offers = [];
  const bridge = createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
    classicSeconds: () => 0, questlineService: null,
    playerEntity: { name: 'Hero', level: 8, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    onQuestlineOffer: (o) => offers.push(o), offerReward: () => {},
  });
  const q = bridge.machine.startQuestByName('QLTF03');
  for (let i = 0; i < 3; i++) bridge.machine.tick();
  bridge.questlines.act('star-held', 2);
  for (let i = 0; i < 6; i++) bridge.machine.tick();
  assert.equal(q.questComplete, false, 'two stars are not three');
  bridge.questlines.act('star-held', 1);
  for (let i = 0; i < 6; i++) bridge.machine.tick();
  assert.ok(q.questComplete);
  assert.equal(q.ql.outcome, 'held');
  assert.equal(offers.length, 1, 'the choice of three');
});

test('STAR8 THE COVENS ARE OPEN AIR, gated on ARENA2_PATH: the Glenmoril Coven (Ilessan Hills) and the Coven on the Bluff (Daggerfall) stand in the player\'s MAPS.BSA as covens - one block of the wilds each, no building and no dungeon, so no quest marker - under the location ids the quest table names them by (GlenmorilCoven 0xc358, BluffCoven 0xc360); the scripts meet them by arrival for that reason', { skip: HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)' }, () => {
  const maps = loadMaps();
  const places = read('vendor/dfu-quests/Tables/Quests-Places.txt');
  for (const [region, name, place, block] of [['Ilessan Hills', 'Glenmoril Coven', 'GlenmorilCoven', 'WITCAA00.RMB'], ['Daggerfall', 'Coven on the Bluff', 'BluffCoven', 'WITCAA04.RMB']]) {
    const loc = maps.getLocationByName(region, name);
    assert.ok(loc, `${name} in ${region}`);
    const id = Number.parseInt(new RegExp(`^${place},\\s*(0x[0-9a-f]+),`, 'm').exec(places)?.[1] ?? 'NaN', 16);
    assert.equal(loc.exterior.exteriorData.locationId, id, `${place} is ${name}`);
    assert.equal(loc.mapTableData.locationType, 13, 'a coven');
    assert.equal(loc.hasDungeon, false, 'no dungeon');
    assert.deepEqual(loc.exterior.buildings ?? [], [], 'no building');
    assert.deepEqual([...loc.exterior.exteriorData.blockNames], [block]);
  }
});

/** A world of three places (questplaces.test.js's crafted shape): a town the player starts in, and the two covens by
 *  the location ids the quest table names them by - open air, one block each, no building, no dungeon. AUDIT STAR8: a
 *  wave minted as the host mints it (questFoeHost.js mintQuestFoeWave - a behaviour a body, on the machine `world.machine`
 *  names), each body driven as its pool drives it (`drive`) until it is culled (`cull`) or killed (`kill`); the temple
 *  Arkay's (`templeFaction`, FACTION.TXT 21 - MAPS.BSA's own for a temple of Arkay). */
function covenWorld({ templeFaction = 21 } = {}) {
  const loc = (index, name, mapId, locationId, locationType) => ({
    loaded: true, regionIndex: 0, regionName: 'Testshire', name, locationIndex: index, hasDungeon: false,
    mapTableData: { mapId, locationType, dungeonType: 255 },
    exterior: { buildings: [], recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId, width: 1, height: 1, blockNames: ['WITCAA00.RMB'] } },
    dungeon: null,
  });
  // and a town of the region's with a Mages Guild hall, a temple and a house, a quest marker in each (QLTF04's other two
  // ways, and the house a person of a faction is homed in before the script stands it - Person.cs AssignHomeTown)
  const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
  const hall = { buildingType: 11, factionId: 40, nameSeed: 778, locationId: 0, sector: 0, quality: 9 };
  const temple = { buildingType: 14, factionId: templeFaction, nameSeed: 779, locationId: 0, sector: 0, quality: 9 };
  const house = { buildingType: 17, factionId: 0, nameSeed: 780, locationId: 0, sector: 0, quality: 9 }, house2 = { ...house, buildingType: 18, nameSeed: 781 };
  const marked = { interior: { blockFlatObjectRecords: [flat(11)] } };
  const blocks = { 'TOWNAA00.RMB': { position: 5000, rmbBlock: { fldHeader: { buildingDataList: [hall, temple, house, house2], otherNames: null }, subRecords: [marked, marked, marked, marked] } } };
  const town = { ...loc(3, 'Bigtown', 103, 0x401, 0) };
  town.exterior = { ...town.exterior, buildings: [hall, temple], exteriorData: { ...town.exterior.exteriorData, blockNames: ['TOWNAA00.RMB'] } };
  const locations = [loc(0, 'Hometown', 100, 0x400, 0), loc(1, 'Glenmoril Coven', 101, 0xc358, 13), loc(2, 'Coven on the Bluff', 102, 0xc360, 13), town];
  const region = { name: 'Testshire', locationCount: 4, mapTable: locations.map((l) => ({ mapId: l.mapTableData.mapId, locationType: l.mapTableData.locationType, dungeonType: 255 })) };
  const waves = [];
  const world = {
    maps: { regionCount: 1, getRegion: () => region, getLocation: (r, l) => locations[l] ?? null, getRmbBlockName: (l, x, y) => l.exterior.exteriorData.blockNames[y * l.exterior.exteriorData.width + x], readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId, getClimateIndex: () => 231 },
    getRmbBlockName: (l, x, y) => l.exterior.exteriorData.blockNames[y * l.exterior.exteriorData.width + x],
    // FACTION.TXT's two records the Guild's buyer and Arkay's priest are made of (#40, #82), as the reader hands them
    getFactionData: (id) => ({ 40: { id: 40, name: 'The Mages Guild', type: 2, parent: 0, face: -1, race: -1, flat1: 0, flat2: 0 }, 82: { id: 82, name: 'The Order of Arkay', type: 9, parent: 21, face: -1, race: -1, flat1: 0, flat2: 0 },
      423: { id: 423, name: 'The Sisters of the Bluff', type: 8, parent: 0, face: -1, race: -1, flat1: 0, flat2: 0 } })[id] ?? null,   // AUDIT STAR8 S8: the Sisters, whose favour the Spinner's death costs
    getBlock: (name) => blocks[name] ?? null, currentLocation: () => world._current, currentRegionIndex: () => 0, currentLocationIndex: () => world._current.locationIndex,
    currentRegionName: () => 'Testshire', isPlayerInLocationRect: () => true, playerInside: () => null, playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}), discoverLocation: () => {}, addNote: () => {},
    createFoeGameObjects: (foe, count) => {
      waves.push([foe.symbol.name, count, foe.gender, foe.displayName]);
      const made = mintQuestFoeWave(world.machine, foe, count);
      world.bodies.push(...made);
      return made;
    },
    tryPlaceFoe: () => true,
    _current: locations[0], waves, machine: null, bodies: [],
    at: (i) => { world._current = locations[i]; },
    /** the pools' frame: every body that stands drives its behaviour (resourceBehaviour.js update) */
    drive: () => { for (const b of world.bodies) if (!b.gone) b.behaviour.update(); },
    /** a cull or a sweep: the body gone with no fall, its behaviour told as the pool tells it (or, a sweep, not at all) */
    cull: (b, told = true) => { b.gone = true; if (told) b.behaviour.notifyDestroyed(); },
    /** a fall: the behaviour's death and the foe's count, as the behaviour's own update reads a body at no health */
    kill: (b) => { b.behaviour.isFoeDead = true; b.foe.incrementKills(1); },
    of: (name) => world.bodies.filter((b) => b.foe.symbol.name === name),
  };
  return world;
}

test('STAR8 THE BLUFF AND THE COVEN, run on the machine: the letter, then at the Bluff the Spinner and her three sisters come once - women by name - and a return brings no second coven; the Spinner slain and the spindle taken, Morwen meets the player at the Glenmoril Coven\'s fire once and asks; the way taken settles its outcome (mutants: the ambush unlatched; the meeting unlatched; the gender)', async () => {
  const { questSource } = await import('../../qlSources.mjs');
  const world = covenWorld();
  const clock = { s: 10_000 };
  const asked = [];
  const pack = [];
  const m = packMachine({
    world, nowSeconds: () => clock.s, getQuestSourceLines: (n) => questSource(n, true), questlinesStamp: () => freshState(),
    showPopup: () => {}, showChoice: (q, msg, choices, respond) => asked.push({ choices, respond }),
    giveItemToPlayer: (item) => pack.push(item), carriesQuestItem: (r) => pack.some((it) => it.questSymbol?.name === r.symbol?.name),
  });
  world.machine = m;
  const quest = m.startQuestByName('QLTF02');
  assert.ok(quest, 'it parses and starts on a world');
  const tick = (n = 3) => { for (let i = 0; i < n; i++) { m.tick(); world.drive(); } };
  tick();
  world.at(2);
  tick();
  assert.deepEqual(world.waves, [], 'before the letter, the Bluff is only a place');
  clock.s += 4 * 3600;
  world.at(0); tick();
  world.at(2); tick(6);
  assert.deepEqual(world.waves, [['spinner', 1, GENDERS.Female, 'The Spinner'], ['sisters', 3, GENDERS.Female, 'Sister of the Bluff']], 'the coven comes once, women all');
  world.at(0); tick();
  world.at(2); tick(6);
  assert.equal(world.waves.length, 2, 'a return brings no second coven');
  world.kill(world.of('spinner')[0]);
  tick();
  assert.deepEqual(pack.map((it) => it.questSymbol?.name).filter((n) => n === 'spindle'), ['spindle'], 'AUDIT STAR8 S1: the spindle the player\'s as she falls');
  world.at(1); tick();
  assert.equal(asked.length, 1, 'Morwen asks at the fire');
  assert.equal(asked[0].choices.length, 2);
  world.at(0); tick();
  world.at(1); tick();
  assert.equal(asked.length, 1, 'once: her question stands until it is answered');
  asked[0].respond(1);
  tick(4);
  assert.ok(quest.questComplete, 'ended');
  assert.equal(quest.ql.outcome, 'wound', 'given whole');
});

test('STAR8 WHAT THE THREAD IS WORTH, run on the machine: Morwen asks at the coven\'s fire once her letter has come; the Guild\'s way hands the spindle over (no pay - the quest has not settled), stands the buyer in the Guild\'s hall, and settles `guild` when the spindle is carried to the buyer (mutants: the spindle given as pay; the buyer never stood)', async () => {
  const { questSource } = await import('../../qlSources.mjs');
  const world = covenWorld();
  const clock = { s: 10_000 };
  const asked = [], given = [];
  let carrying = false;
  const m = packMachine({
    world, nowSeconds: () => clock.s, getQuestSourceLines: (n) => questSource(n, true), questlinesStamp: () => freshState(),
    showPopup: () => {}, showChoice: (q, msg, choices, respond) => asked.push({ choices, respond }),
    carriesQuestItem: (r) => r.symbol?.name === 'spindle' && carrying,
    giveItemToPlayer: (item) => given.push(item),
  });
  const quest = m.startQuestByName('QLTF04');
  assert.ok(quest, 'it parses and starts on a world');
  const tick = (n = 3) => { for (let i = 0; i < n; i++) m.tick(); };
  world.at(1); tick();
  assert.equal(asked.length, 0, 'before her letter, the fire is only a fire');
  clock.s += 4 * 3600;
  world.at(0); tick();
  world.at(1); tick();
  assert.equal(asked.length, 1);
  assert.equal(asked[0].choices.length, 3, 'burn, the Guild, Arkay');
  const hallSd = quest.getResource({ name: 'hall' }).siteDetails;
  const buyerStands = () => [hallSd.selectedMarker, ...(hallSd.questSpawnMarkers ?? [])].some((mk) => (mk?.targetResources ?? []).some((sym) => sym?.name === 'mage'));
  assert.equal(buyerStands(), false, 'nobody waits at the hall before the Guild is chosen');
  asked[0].respond(1);
  tick();
  assert.equal(given.length, 1, 'the spindle in the pack');
  assert.equal(quest.ql.paid ?? false, false, 'no pay: nothing is settled yet');
  assert.equal(quest.questComplete, false);
  const mage = quest.getPerson({ name: 'mage' });
  assert.equal(hallSd.locationName, 'Bigtown');
  assert.equal(buyerStands(), true, 'the buyer stands in the Guild\'s hall');
  carrying = true;
  mage.hasPlayerClicked = true;
  tick(4);
  assert.ok(quest.questComplete);
  assert.equal(quest.ql.outcome, 'guild', 'sold to the Mages Guild');
});

// ═══ AUDIT STAR8 (2026-10-20): the line's defects fixed, and its ties to the Witches' Festival ═══

test('AUDIT STAR8 S1 THE COVEN GONE UNFOUGHT COMES AGAIN, NEVER BESIDE ITSELF: the Spinner culled while her sisters stand brings no second coven, even at a return; the whole coven gone - the Spinner unkilled, her sisters fallen (a body that fell stands for nobody) - calls it again at the Bluff; a load that did not bring it back calls it again (what stood is saved); the Spinner slain hands over the spindle, costs the Sisters of the Bluff their favour (FACTION.TXT 423, -10) and stops Morwen\'s clock - and nothing gone after her death calls a coven (mutants: `ql gone` on the first foe alone; the fallen standing; the beat unread; `seen` unsaved; the kill unread; the re-arm unscripted; the re-arm after the ambush; the spindle on her body; the repute; the clock run on)', async () => {
  const { questSource } = await import('../../qlSources.mjs');
  const clock = { s: 10_000 };
  const pack = [], repute = [];
  const machineOn = (w) => {
    const m = packMachine({
      world: w, nowSeconds: () => clock.s, getQuestSourceLines: (n) => questSource(n, true), questlinesStamp: () => freshState(),
      showPopup: () => {}, showChoice: () => {}, changeReputation: (id, n, along) => repute.push([id, n, along]),
      giveItemToPlayer: (item) => pack.push(item), carriesQuestItem: (r) => pack.some((it) => it.questSymbol?.name === r.symbol?.name),
    });
    w.machine = m;
    return m;
  };
  const world = covenWorld();
  const m = machineOn(world);
  const quest = m.startQuestByName('QLTF02');
  assert.ok(quest);
  const tick = (n = 3) => { for (let i = 0; i < n; i++) { m.tick(); world.drive(); } };
  const away = () => { world.at(0); tick(); world.at(2); tick(6); };
  tick();
  clock.s += 4 * 3600;   // the letter's hours
  away();
  assert.equal(world.waves.length, 2, 'the coven came');
  world.cull(world.of('spinner')[0]);   // the encounters' cull, past 120 m
  tick(FOE_STANDS_TICKS + 10);
  away();
  assert.equal(world.waves.length, 2, 'never a second coven while one of the first stands');
  for (const b of world.of('sisters')) world.kill(b);
  tick(6);
  assert.deepEqual(world.waves.slice(2).map((w) => w[0]), ['spinner', 'sisters'], 'all of it gone, the Spinner unkilled: called again where the player stands');
  // a load that did not bring the coven back - nothing tells the behaviours of a sweep: what stood is saved, and gone
  const world2 = covenWorld();
  const m2 = machineOn(world2);
  m2.restoreSaveData(m.getSaveData());
  world2.at(2);
  for (let i = 0; i < 6; i++) { m2.tick(); world2.drive(); }
  assert.equal(world2.waves.length, 2, 'the load: called again');
  // the Spinner slain: the spindle the player's, the Sisters' favour lost, Morwen's patience endless with it in hand
  world.kill(world.of('spinner')[1]);
  tick(3);
  assert.ok(pack.some((it) => it.questSymbol?.name === 'spindle'), 'the spindle as she falls');
  assert.deepEqual(repute, [[423, -10, true]], 'the Sisters of the Bluff');
  for (const b of world.of('sisters').slice(3)) world.cull(b, false);   // a sweep: told nothing
  tick(FOE_STANDS_TICKS + 10);
  away();
  assert.equal(world.waves.length, 4, 'nothing gone after her death calls a coven');
  clock.s += 61 * 86400;
  tick(6);
  assert.equal(quest.questComplete, false, 'the spindle in hand: Morwen waits, and the Sisters never "move their spindle"');
});

test('AUDIT STAR8 S1 `ql gone`: one to four foes, a trigger of the questlines\' own - claimed by its template and no DFU one, its foes and what it saw saved (mutants: the pattern; the symbols unsaved)', async () => {
  const { QlGone, questlineActionTemplates } = await import('../../../src/systems/questlines/qlActions.js');
  const { QuestMachine } = await import('../../../src/systems/quest/machine.js');
  const dfu = new QuestMachine({ nowSeconds: () => 0 });
  assert.equal(dfu.getActionTemplate('\tql gone _spinner_ _sisters_'), null, 'no DFU template claims it');
  const m = new QuestMachine({ nowSeconds: () => 0 });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  assert.ok(m.getActionTemplate('\tql gone _spinner_ _sisters_') instanceof QlGone);
  assert.equal(m.getActionTemplate('\tql gone'), null, 'a foe at least');
  assert.equal(m.getActionTemplate('\tql gone _a_ _b_ _c_ _d_ _e_'), null, 'four at most');
  const a = new QlGone(null).createNew('\tql gone _spinner_ _sisters_', null);
  assert.deepEqual(a.foeSymbols.map((s) => s.name), ['spinner', 'sisters']);
  a.seen = true;
  const b = new QlGone(null);
  b.restoreSaveData(JSON.parse(JSON.stringify(a.getSaveData())));
  assert.deepEqual([b.foeSymbols.map((s) => s.name), b.seen], [['spinner', 'sisters'], true]);
});

test('AUDIT STAR8 T1 MORWEN\'S LETTER FROM A WYRD SISTER: her window opened (`wyrd-met`) hands it over at once, and a star held after it brings no raven; a star held first brings the raven\'s note instead, and a Sister after it no letter; both in one breath, one word; neither, and nothing comes - no clock sends it (online REST8 cuts a delay to two minutes of play); Morwen meets the player once the star is held, wherever the word came from (mutants: the Sister unread; both ways given; the raven on a clock)', async () => {
  const { questSource } = await import('../../qlSources.mjs');
  const run = () => {
    const world = covenWorld();
    const clock = { s: 10_000 };
    const pack = [];
    const m = packMachine({
      world, nowSeconds: () => clock.s, getQuestSourceLines: (n) => questSource(n, true), questlinesStamp: () => freshState(),
      showPopup: () => {}, giveItemToPlayer: (item) => pack.push(item),
    });
    world.machine = m;
    const quest = m.startQuestByName('QLTF01');
    assert.ok(quest, 'it parses and starts on a world');
    const tick = (n = 3) => { for (let i = 0; i < n; i++) m.tick(); };
    const act = (...kinds) => { for (const k of kinds) quest.ql.acts[k] = (quest.ql.acts[k] ?? 0) + 1; tick(); };   // the layer's own count (qlLayer.js act)
    tick();
    return { world, clock, quest, tick, act, got: () => pack.map((it) => it.questSymbol?.name) };
  };
  const sister = run();
  sister.clock.s += 30 * 86400;
  sister.tick(6);
  assert.deepEqual(sister.got(), [], 'no clock sends a word');
  sister.act('wyrd-met');
  assert.deepEqual(sister.got(), ['letter'], 'the Wyrd Sister hands it over');
  sister.act('star-held');
  assert.deepEqual(sister.got(), ['letter'], 'and no raven after it');
  sister.world.at(1);
  sister.tick(40);   // her words, then her purse (GivePc's own beat)
  assert.ok(sister.quest.questComplete, 'Morwen met at her fire');
  const { outcomeNow } = await import('../../../src/systems/questlines/qlLaw.js');
  assert.equal(outcomeNow(sister.quest, sheetFor('QLTF01'))?.id, 'met', 'the sheet\'s own end');
  const raven = run();
  raven.act('star-held');
  assert.deepEqual(raven.got(), ['note'], 'the raven\'s note: the star held first');
  raven.act('wyrd-met');
  assert.deepEqual(raven.got(), ['note'], 'and no letter after it');
  const both = run();
  both.act('wyrd-met', 'star-held');
  both.tick(3);
  assert.deepEqual(both.got(), ['letter'], 'one word, never two');
});

test('AUDIT STAR8 T2 THE HEART-STAR, never a gate: held with the three stars, the step settles `heart` - the greater pay and the Heart-Star Ring among the three; held alone it ends nothing; without it the step is `held` (mutants: the Heart-Star made the gate; its outcome unread; its act unread)', async () => {
  const { createQuestBridge } = await import('../../../src/scenes/quest/questBridge.js');
  const { questSource } = await import('../../qlSources.mjs');
  const { questlinesOn } = await import('../../../src/systems/questlines/qlLaw.js');
  setPref(QUESTLINES_PREF, true);
  const run = (acts) => {
    const offers = [];
    const bridge = createQuestBridge({
      data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
      classicSeconds: () => 0, questlineService: null,
      playerEntity: { name: 'Hero', level: 8, gender: 'male', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
      onQuestlineOffer: (o) => offers.push(o), offerReward: () => {},
    });
    const q = bridge.machine.startQuestByName('QLTF03');
    for (let i = 0; i < 3; i++) bridge.machine.tick();
    for (const [kind, n] of acts) { bridge.questlines.act(kind, n); for (let i = 0; i < 6; i++) bridge.machine.tick(); }
    return { q, offers };
  };
  const alone = run([['heart-star-held', 1]]);
  assert.equal(alone.q.questComplete, false, 'the Heart-Star alone is not three stars');
  const heart = run([['heart-star-held', 1], ['star-held', 3]]);
  assert.ok(heart.q.questComplete);
  assert.equal(heart.q.ql.outcome, 'heart');
  assert.equal(heart.offers.length, 1);
  assert.deepEqual(heart.offers[0].pieces.filter((p) => p.named).map((p) => p.item.name), ['Heart-Star Ring'], 'Morwen\'s ring among the three');
  const plain = run([['star-held', 3]]);
  assert.equal(plain.q.ql.outcome, 'held');
  assert.equal(plain.offers[0].pieces.filter((p) => p.named).length, 0);
  const outcomes = Object.fromEntries(sheetFor('QLTF03').outcomes.map((o) => [o.id, [o.pay, o.named?.name ?? null]]));
  assert.deepEqual(outcomes, { heart: ['greater', 'Heart-Star Ring'], held: ['standard', null], failed: ['none', null] });
  assert.deepEqual(sheetFor('QLTF03').objectives.map((o) => [o.id, o.text, !!o.optional]), [['hold', 'Hold 3 more fallen stars', false], ['heart', 'Hold the Heart-Star', true]]);
});

test('AUDIT STAR8 S2 A STAR STEP THE FESTIVAL ENDS UNDER IS SET ASIDE, FAIL-FREE: its quest set aside as an Abandon sets one (its clocks stopped), the row waiting and saying for what; the next Festival reclaims it where it stood; a step the player set aside is the player\'s - never reclaimed by the line; the record rides a save (mutants: the running step\'s needs unread; never reclaimed; the player\'s reclaimed; `aside` unsaved; the row shelved)', () => {
  const shelfOf = (machine) => {
    const said = [];
    machine.shelveQuest = (uid) => { const q = machine.quests.get(uid); if (!q || q.shelvedAt != null) return { ok: false, reason: 'shelved' }; q.shelvedAt = 1; said.push(`away ${q.questName}`); return { ok: true, quest: q }; };
    machine.reclaimQuest = (uid) => { const q = machine.quests.get(uid); if (!q || q.shelvedAt == null) return { ok: false, reason: 'running' }; q.shelvedAt = null; said.push(`back ${q.questName}`); return { ok: true, quest: q }; };
    return said;
  };
  const r = runnerAt();
  const said = shelfOf(r.machine);
  r.settle();
  assert.equal(row(r.runner).state, 'running');
  r.clock.ms = OUT;   // the Festival over, the first star unheld
  r.step();
  assert.deepEqual(said, ['away QLTF01'], 'set aside');
  const w = row(r.runner);
  assert.deepEqual([w.state, w.opens, w.steps[0].state], ['waiting', 'Opens during the Witches’ Festival.', 'current']);
  r.step();
  assert.deepEqual(said, ['away QLTF01'], 'once');
  // a load between: the record says the line set it aside
  const again = createLineRunner({ machine: r.machine, service: { claim: async () => ({ ok: true, data: { why: 'unpaid' } }), guest: () => false }, nowMs: () => r.clock.ms, ctx: { level: () => 10, online: () => true, nowSeconds: () => r.clock.s } });
  again.restore(r.runner.snapshot());
  assert.equal(again.lineState(LINE.id).aside, true);
  r.clock.ms = IN;   // the next Festival
  again.look();
  assert.deepEqual(said, ['away QLTF01', 'back QLTF01'], 'reclaimed where it stood');
  assert.equal(again.rows().find((x) => x.id === LINE.id).state, 'running');
  // the player's own Abandon: never the line's to undo
  const p = runnerAt();
  const pSaid = shelfOf(p.machine);
  p.settle();
  [...p.machine.quests.values()].find((q) => q.questName === 'QLTF01').shelvedAt = 5;
  p.clock.ms = OUT;
  p.step();
  p.clock.ms = IN;
  p.step();
  assert.deepEqual(pSaid, [], 'neither set aside again nor reclaimed');
  assert.equal(row(p.runner).state, 'shelved');
});

test('AUDIT STAR8 S2 FAIL-FREE ON THE MACHINE: Three Stars set aside stops its sixty days; reclaimed, its clock goes on from where it stood (mutants: a set-aside quest ticked)', async () => {
  const { questSource } = await import('../../qlSources.mjs');
  const clock = { s: 10_000 };
  const m = packMachine({ nowSeconds: () => clock.s, getQuestSourceLines: (n) => questSource(n, true), questlinesStamp: () => freshState(), showPopup: () => {} });
  const q = m.startQuestByName('QLTF03');
  const tick = (n = 3) => { for (let i = 0; i < n; i++) m.tick(); };
  tick();
  clock.s += 4 * 3600;
  tick();
  assert.equal(q.getClock({ name: 'wait' }).clockEnabled, true, 'the letter came: sixty days run');
  assert.equal(m.shelveQuest(q.uid).ok, true);
  clock.s += 61 * 86400;
  tick(6);
  assert.equal(q.questComplete, false, 'set aside: no failure');
  assert.equal(m.reclaimQuest(q.uid).ok, true);
  tick(6);
  assert.equal(q.questComplete, false, 'reclaimed: its days as they stood');
});

test('AUDIT STAR8 S4 THE PRIEST OF ARKAY KEEPS VIGIL IN ARKAY\'S OWN TEMPLE: the questlines\' `templeArkay` row (p3 21, FACTION.TXT\'s Arkay) on Quests-Places, held as a guild hall\'s faction is held (Place.cs IsGuildFactionMatch - the departure, a temple too) - a region whose only temple is another god\'s has none for it, DFU\'s own `temple` (p3 0) takes any; `pc at`\'s type form the same (mutants: the temple\'s faction unread; the row\'s god; pc at\'s temple arm)', () => {
  assert.deepEqual([...QL_PLACE_ROWS], ['templeArkay,        0, 14, 21']);
  const lines = (place) => ['Quest: __QLTMP', 'DisplayName: A Temple', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '', 'QBN:', `Place _t_ remote ${place}`];
  const start = (god, place) => { const world = covenWorld({ templeFaction: god }); const m = packMachine({ world, getQuestSourceLines: () => lines(place) }); world.machine = m; return m.startQuestByName('__QLTMP'); };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(start(22, 'templeArkay'), null, 'another god\'s temple is none of Arkay\'s');
    assert.ok(start(22, 'temple'), 'DFU\'s own row: any temple');
    assert.equal(start(21, 'templeArkay')?.getPlace({ name: 't' })?.siteDetails?.locationName, 'Bigtown', 'Arkay\'s');
  } finally { console.warn = warn; }
  const inside = (factionId) => ({ playerInside: () => ({ building: { buildingType: 14, factionId } }) });
  assert.equal(isPlayerAtBuildingType(inside(21), 14, 21), true);
  assert.equal(isPlayerAtBuildingType(inside(22), 14, 21), false, '`pc at` holds a temple to its row too');
  assert.equal(isPlayerAtBuildingType(inside(22), 14, 0), true, 'DFU\'s any temple');
});

test('AUDIT STAR8 S4, gated on ARENA2_PATH: a temple of Arkay carries FACTION.TXT\'s god (21, Arkay - the Order of Arkay, #82, its child) in the player\'s MAPS.BSA, the Ilessan Hills among its regions', { skip: HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)' }, async () => {
  const { FactionFile } = await import('../../../src/formats/factionFile.js');
  const { ARENA2 } = await import('../../arena1Data.mjs');
  const ff = new FactionFile();
  ff.load(new Uint8Array(readFileSync(`${ARENA2}/FACTION.TXT`)));
  assert.deepEqual([ff.factionDict.get(21)?.name, ff.factionDict.get(82)?.parent], ['Arkay', 21]);
  const maps = loadMaps();
  let arkay = 0, glen = 0;
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    for (let l = 0; l < (reg?.locationCount ?? 0); l++) {
      const n = (maps.getLocation(r, l)?.exterior?.buildings ?? []).filter((b) => b.buildingType === 14 && b.factionId === 21).length;
      arkay += n;
      if (reg.name === 'Ilessan Hills') glen += n;
    }
  }
  assert.equal(arkay, 396, 'the Bay\'s temples of Arkay');
  assert.ok(glen > 0, 'Glenmoril\'s region has them');
});

/** A script's messages, each its words on one line (headers, `<ce>` and comments left out). */
function messagesOf(q) {
  const map = new Map();
  let id = null;
  for (const line of readFileSync(QUEST_FILES.get(q).path, 'utf8').split(/\r?\n/)) {
    if (/^\s*QBN:/.test(line)) break;
    const h = /^(?:Message:\s*(\d+)|[A-Za-z]+:\s*\[(\d+)\])\s*$/.exec(line);
    if (h) { id = Number(h[1] ?? h[2]); map.set(id, ''); } else if (id != null && !/^--/.test(line)) map.set(id, `${map.get(id)} ${line.replace(/^<ce>/, '').trim()}`);
  }
  for (const [k, v] of map) map.set(k, v.replace(/\s+/g, ' ').trim());
  return map;
}

test('AUDIT STAR8 S5, S6 THE WORDS: the coven open air (Morwen burns the spindle in a clearing, not a hall); one coven a night at the rite, Glenmoril and Wroth never (no "every coven but ours"); nothing said twice - her purse no echo of her greeting, the priests\' cut said once; no box thanking Morwen\'s way after a mage\'s or a priest\'s pay; no length "sold far from here" that was never handed over; Morwen\'s sisters at the taverns; the sheets\' objectives short; the line\'s lead; the holiday its own record, TEXT.RSC 8392 (mutants: the hall; every coven; the cut twice)', () => {
  const tf1 = messagesOf('QLTF01'), tf2 = messagesOf('QLTF02'), tf4 = messagesOf('QLTF04');
  assert.match(tf4.get(1034), /the clearing is as bright as noon/);
  assert.doesNotMatch(tf4.get(1034), /\bhall\b/);
  assert.match(tf1.get(1013), /The covens take turns at the same rite, a night each\./);
  assert.doesNotMatch(tf1.get(1013), /Every coven/);
  assert.equal(tf1.get(1004), 'Morwen presses _gold_ gold into your hand.');
  assert.match(tf1.get(1014), /My sisters keep the taverns' doors/, 'Morwen speaks of her sisters at the taverns');
  assert.equal([...tf4.values()].filter((v) => /cuts? what holds a thing past its time/.test(v)).length, 1, 'the priests\' cut, said once');
  assert.doesNotMatch(tf4.get(1004), /for the stars and the thread/);
  assert.doesNotMatch(tf2.get(1033), /Sell it far from here/);
  assert.deepEqual(sheetFor('QLTF01').objectives.map((o) => o.text), ['Ask a Wyrd Sister at a tavern\'s door for word from Morwen', 'Hold a fallen star', 'Find Morwen of Glenmoril at __glenmoril_ in ____glenmoril_']);
  assert.equal(LINE.lead(), 'At the Witches’ Festival the covens sing stars out of the sky. A witch of Glenmoril wants to know why.');
  for (const q of ['QLTF01', 'QLTF04']) {
    const head = readFileSync(QUEST_FILES.get(q).path, 'utf8');
    assert.match(head, /TEXT\.RSC 8392/, q);
    assert.doesNotMatch(head, /8349/, q);
  }
});

test('AUDIT STAR8 S6, gated on ARENA2_PATH: TEXT.RSC 8392 is the Witches\' Festival\'s own words (holiday 43, 8349 plus its id) - 8349 is no record', { skip: HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)' }, async () => {
  const { TextRsc } = await import('../../../src/formats/textRsc.js');
  const { ARENA2 } = await import('../../arena1Data.mjs');
  const rsc = new TextRsc().load(new Uint8Array(readFileSync(`${ARENA2}/TEXT.RSC`)), { table: null });
  assert.match((rsc.plainText(8392) ?? []).join(' '), /Witches' Festival when the forces\s+of sorcery and religion clash/);
  assert.equal(rsc.plainText(8349), null);
});
