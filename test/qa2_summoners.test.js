// QUEST-AUDIT II TEMPLE-SUMMONER (bible/01-Overview/Quest-Audit-II.md; the owner: "Restore the summoner"): every
// Daggerfall temple stands its deity's Daedra summoner, and all 24 of Beautiful Villages' temple designs leave it out
// (1,855 temples). Each design's summoner - Daggerfall's own of the temple's deity - stands at a floor spot measured over
// the player's data (tools/templeSummoners.mjs: the walk's nearest clear floor to the priest), put in where the block
// becomes the port's (formats/worldDataReplacement.js getDFBlockReplacementData) for every consumer at once. The door
// tests' own builders (test/wd3Fakes.mjs, blockToDfuJson); the measurement re-run, gated on the player's ARENA2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  registerWorldDataAsset, installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement, getDFBlockReplacementData, setLayoutPinOracle,
} from '../src/formats/worldDataReplacement.js';
import { blockToDfuJson } from '../src/formats/worldDataJson.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { clearWorldDataVariants } from '../src/systems/worldDataVariants.js';
import { _resetLayoutPins, pinAt } from '../src/systems/layoutPins.js';
import { CURATED_TEMPLE_SUMMONERS, SUMMONER_FACTIONS, TEMPLE_SUMMONER_VENDOR, curateBlockPeople } from '../src/world/curatedPeople.js';
import { NPC_SERVICE, npcServiceKind } from '../src/systems/guildServices.js';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { CURATED_QUEST_MARKERS, curatedMarkerSpot } from '../src/systems/quest/markerCuration.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';

const BV = 'beautiful-villages', BC = 'beautiful-cities';
const KYNARETH = 35, PRIEST = 240, KYNARETH_SUMMONER = 498;
const person = (factionID, x, position) => ({ Position: position, XPos: x, YPos: 0, ZPos: 10, TextureArchive: 182, TextureRecord: 20, FactionID: factionID, Flags: 1 });
/** Beautiful Villages' TEMPASH0 as the door serves it: record 11 its Kynareth temple, its priest and no summoner. `self`
 *  is the name the JSON gives itself - the pack's own `Name`, which is not always the file's (TEMPASA2's says TEMPAS2). */
function templeJson(name = 'TEMPASH0.RMB', { deity = KYNARETH, people = [person(PRIEST, 5, 3853)], record = 11, self = name } = {}) {
  const j = blockToDfuJson(tinyRmb(7, self));
  const sub = j.RmbBlock.SubRecords[1];
  while (j.RmbBlock.SubRecords.length <= record) j.RmbBlock.SubRecords.push(structuredClone(sub));
  while (j.RmbBlock.FldHeader.BuildingDataList.length <= record) j.RmbBlock.FldHeader.BuildingDataList.push(structuredClone(j.RmbBlock.FldHeader.BuildingDataList[0]));
  Object.assign(j.RmbBlock.FldHeader.BuildingDataList[record], { BuildingType: 'Temple', FactionId: deity });
  j.RmbBlock.SubRecords[record].Interior.BlockPeopleRecords = people;
  j.RmbBlock.SubRecords[record].Interior.Header.NumPeopleRecords = people.length;
  return j;
}
function door(t) {
  t.mock.method(console, 'log', () => {});
  _resetWorldDataReplacement(); clearWorldDataVariants(); resetToDefaults(); _resetLayoutPins();
  setValue('Enhancements', 'AssetInjection', 'True');
  installWorldDataReplacement();
  bindWorldDataBlocks(fakeBlocks(tinyRmb(7, 'TEMPASH0.RMB'), tinyRmb(8, 'TEMPAAH0.RMB')));
}
const summonersIn = (b, r = 11) => collectInteriorPeople(b.rmbBlock.subRecords[r]).filter((p) => SUMMONER_FACTIONS.includes(p.factionID));

test('QUEST-AUDIT II TEMPLE-SUMMONER: a Beautiful Villages Kynareth temple the door serves stands Kynareth\'s Daedra summoner - Daggerfall\'s own (faction 498, its picture) at the measured spot - in the room\'s people, its count with it, a person every consumer reads; the summoner offers DaedraSummoning (mutants: the door\'s call dropped, the row unread, the count unkept)', (t) => {
  door(t);
  try {
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson(), null, { priority: 10, vendor: BV });
    const b = getDFBlockReplacementData(7, 'TEMPASH0.RMB');
    const row = CURATED_TEMPLE_SUMMONERS.find((r) => r.block === 'TEMPASH0.RMB');
    const [s] = summonersIn(b);
    assert.ok(s, 'the summoner stands');
    assert.deepEqual([s.factionID, s.textureArchive, s.textureRecord, s.rawX, s.rawY, s.rawZ, s.position], [KYNARETH_SUMMONER, 177, 4, row.person.xPos, row.person.yPos, row.person.zPos, row.person.position]);
    const record = b.rmbBlock.subRecords[11].interior.blockPeopleRecords.find((p) => p.factionID === KYNARETH_SUMMONER);
    assert.equal(record.textureBitfield, (177 << 7) | 4, 'its picture as the reader keys it');
    assert.equal(b.rmbBlock.subRecords[11].interior.header.numPeopleRecords, 2, 'the priest and the summoner');
    assert.equal(npcServiceKind(s.factionID), 'DaedraSummoning');
    // served again from the door's cache: the summoner stands once
    assert.equal(summonersIn(getDFBlockReplacementData(7, 'TEMPASH0.RMB')).length, 1);
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
});

test('AUDIT QA2 TEMPLE-SUMMONER: a temple in a town a save pins to Beautiful Villages - served fresh by the door\'s pinned path at every ask, never from its cache - stands its summoner too, once each time, under the name the town lays (mutants: the pinned path\'s call dropped, its name unpassed)', (t) => {
  door(t);
  try {
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson('TEMPASH0.RMB', { self: 'TEMPASHX.RMB' }), null, { priority: 10, vendor: BV });   // its JSON naming itself otherwise (AUDIT QA2 B1)
    setLayoutPinOracle(() => ({ in: new Set([BV]), out: new Set() }));   // a pin letting the pack in wherever it is asked
    const first = getDFBlockReplacementData(7, 'TEMPASH0.RMB'), again = getDFBlockReplacementData(7, 'TEMPASH0.RMB');
    assert.notEqual(first, again, 'served fresh: the pinned path');
    assert.deepEqual([summonersIn(first).length, summonersIn(again).length], [1, 1]);
    assert.equal(summonersIn(first)[0].factionID, KYNARETH_SUMMONER);
  } finally { setLayoutPinOracle(pinAt); _resetWorldDataReplacement(); resetToDefaults(); }
});

test('QUEST-AUDIT II TEMPLE-SUMMONER: only the listed pack\'s listed temple of the listed deity, holding no summoner of its own - another pack\'s file of the name, a record of another deity, a temple that stands one already, and Daggerfall\'s own blocks are as they were (mutants: the vendor gate, the deity gate, the own-summoner gate)', (t) => {
  door(t);
  try {
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson(), null, { priority: 20, vendor: BC });
    assert.equal(summonersIn(getDFBlockReplacementData(7, 'TEMPASH0.RMB')).length, 0, 'Beautiful Cities\' file of the name');
    door(t);
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson('TEMPASH0.RMB', { deity: 21 }), null, { priority: 10, vendor: BV });
    assert.equal(summonersIn(getDFBlockReplacementData(7, 'TEMPASH0.RMB')).length, 0, 'a record of another deity');
    door(t);
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson('TEMPASH0.RMB', { people: [person(PRIEST, 5, 3853), person(KYNARETH_SUMMONER, 40, 3860)] }), null, { priority: 10, vendor: BV });
    const own = summonersIn(getDFBlockReplacementData(7, 'TEMPASH0.RMB'));
    assert.deepEqual(own.map((p) => p.rawX), [40], 'its own summoner, alone');
    // Daggerfall's own block, served by no pack: nothing curated
    const classic = structuredClone(tinyRmb(8, 'TEMPAAH0.RMB'));
    assert.equal(curateBlockPeople(classic, null), 0);
    assert.equal(curateBlockPeople({ ...classic, name: 'TEMPASH0.RMB' }, null), 0, 'no vendor, no row');
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
});

test('AUDIT QA2 B1: the port\'s curations key on the name the town lays - the door\'s - and not on the name a pack\'s JSON gives itself. Beautiful Villages\' TEMPASA2.RMB.json says "Name": "TEMPAS2.RMB" (the author\'s typo, the only temple so), and its Arkay temple stood no summoner in 46 towns; laid as TEMPASA2 it stands TEMPASA2\'s, and a JSON naming itself as a listed block but laid as another takes none - the quest-marker curation alike (mutants: the door\'s name unpassed on either path; each curation reading the JSON\'s name)', (t) => {
  door(t);
  try {
    const ARKAY = 21, ARKAY_SUMMONER = 456;
    const row = CURATED_TEMPLE_SUMMONERS.find((r) => r.block === 'TEMPASA2.RMB');
    registerWorldDataAsset('TEMPASA2.RMB.json', templeJson('TEMPASA2.RMB', { deity: ARKAY, record: row.record, self: 'TEMPAS2.RMB' }), null, { priority: 10, vendor: BV });
    const b = getDFBlockReplacementData(9, 'TEMPASA2.RMB');
    assert.equal(b.name, 'TEMPAS2.RMB', 'the block keeps the name its JSON gives itself, as DFU\'s does');
    const s = summonersIn(b, row.record);
    assert.deepEqual(s.map((p) => [p.factionID, p.rawX, p.rawY, p.rawZ, p.position]), [[ARKAY_SUMMONER, row.person.xPos, row.person.yPos, row.person.zPos, row.person.position]], 'TEMPASA2\'s summoner, at its spot');
    // a file laid as another block that names itself TEMPASA2 (the class of Beautiful Villages' FARMBA10-13, which name
    // themselves FARMAA10-13): not TEMPASA2's
    registerWorldDataAsset('TEMPASX2.RMB.json', templeJson('TEMPASX2.RMB', { deity: ARKAY, record: row.record, self: 'TEMPASA2.RMB' }), null, { priority: 10, vendor: BV });
    assert.equal(summonersIn(getDFBlockReplacementData(10, 'TEMPASX2.RMB'), row.record).length, 0, 'a block laid as TEMPASX2');
    // the quest-marker curation: TEMPASH0 #4's stairs marker moves in the block laid as TEMPASH0 whatever it calls itself
    const d = CURATED_QUEST_MARKERS.find((c) => c.where.some(([v, blk]) => v === BV && blk === 'TEMPASH0.RMB'));
    const [, , rec] = d.where.find(([v, blk]) => v === BV && blk === 'TEMPASH0.RMB');
    const [m] = d.markers;
    registerWorldDataAsset('TEMPASH0.RMB.json', templeJson('TEMPASH0.RMB', { self: 'TEMPASHX.RMB' }), null, { priority: 10, vendor: BV });
    assert.deepEqual(curatedMarkerSpot(getDFBlockReplacementData(7, 'TEMPASH0.RMB'), rec, m.record, ...m.at), m.to, 'laid as TEMPASH0, named TEMPASHX');
    registerWorldDataAsset('TEMPASHX.RMB.json', templeJson('TEMPASHX.RMB', { self: 'TEMPASH0.RMB' }), null, { priority: 10, vendor: BV });
    assert.equal(curatedMarkerSpot(getDFBlockReplacementData(11, 'TEMPASHX.RMB'), rec, m.record, ...m.at), null, 'laid as TEMPASHX, named TEMPASH0');
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
});

test('QUEST-AUDIT II TEMPLE-SUMMONER: the rows are the 24 designs of Beautiful Villages, one row a temple record of its own block, each Daggerfall\'s summoner of its deity; the summoners are DaedraSummoning\'s temple factions exactly, read from its table (the rows\' spots and name seeds are the measurement\'s, held by the gated test below) (mutants: a row\'s faction, the list)', () => {
  assert.equal(CURATED_TEMPLE_SUMMONERS.length, 24);
  assert.equal(new Set(CURATED_TEMPLE_SUMMONERS.map((r) => `${r.block}#${r.record}`)).size, 24, 'one row a design');
  assert.ok(CURATED_TEMPLE_SUMMONERS.every((r) => r.vendor === TEMPLE_SUMMONER_VENDOR && /^TEMP[AB]S..\.RMB$/.test(r.block)));
  const temples = Object.entries(NPC_SERVICE).filter(([id, kind]) => kind === 'DaedraSummoning' && Number(id) !== 66).map(([id]) => Number(id));
  assert.deepEqual([...SUMMONER_FACTIONS].sort(), temples.sort(), 'the temples\' summoners, and not the Mages Guild\'s (66)');
  // the deity -> summoner pairs Daggerfall's temples stand (TEMPAA?0; Akatosh is 92 there and 26 in the mod)
  const PAIRS = { 21: 456, 22: 464, 24: 470, 26: 475, 27: 482, 29: 488, 33: 492, 35: 498 };
  for (const r of CURATED_TEMPLE_SUMMONERS) assert.equal(r.person.factionID, PAIRS[r.deity], `${r.block}: deity ${r.deity}`);
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_GEOMETRY = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));
test('QUEST-AUDIT II TEMPLE-SUMMONER, gated on ARENA2_PATH (with ARCH3D): the rows are the measurement - every design laid out over the player\'s geometry, walked from its entrance, its summoner at the nearest clear floor to its priest (tools/templeSummoners.mjs)', { skip: HAVE_GEOMETRY ? false : 'ARENA2_PATH (with ARCH3D.BSA) not set' }, async () => {
  const { openTownData } = await import('../tools/townQuestMarkers.mjs');
  const { measureSummoners } = await import('../tools/templeSummoners.mjs');
  const log = console.log; console.log = () => {};
  let rows;
  try { rows = await measureSummoners(await openTownData(ARENA2)); } finally { console.log = log; }
  assert.deepEqual(rows, CURATED_TEMPLE_SUMMONERS.map(({ block, record, deity, person: p }) => ({ block, record, deity, person: { ...p } })));
  // AUDIT QA2 B1, in the producer's own shape: every row's temple, served by the door from the vendored pack as a town
  // lays it (TEMPASA2's JSON names itself TEMPAS2.RMB), stands exactly its summoner, at its spot, under a name seed no
  // other person of the room holds
  for (const r of CURATED_TEMPLE_SUMMONERS) {
    const b = getDFBlockReplacementData(-1, r.block);
    const people = collectInteriorPeople(b.rmbBlock.subRecords[r.record]);
    const s = people.filter((p) => SUMMONER_FACTIONS.includes(p.factionID));
    assert.deepEqual(s.map((p) => [p.factionID, p.rawX, p.rawY, p.rawZ, p.position]), [[r.person.factionID, r.person.xPos, r.person.yPos, r.person.zPos, r.person.position]], `${r.block} #${r.record}`);
    assert.equal(people.filter((p) => p.position === r.person.position).length, 1, `${r.block}: its name seed its own`);
  }
});
