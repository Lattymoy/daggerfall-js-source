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
  registerWorldDataAsset, installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement, getDFBlockReplacementData,
} from '../src/formats/worldDataReplacement.js';
import { blockToDfuJson } from '../src/formats/worldDataJson.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { clearWorldDataVariants } from '../src/systems/worldDataVariants.js';
import { _resetLayoutPins } from '../src/systems/layoutPins.js';
import { CURATED_TEMPLE_SUMMONERS, SUMMONER_FACTIONS, TEMPLE_SUMMONER_VENDOR, curateBlockPeople } from '../src/world/curatedPeople.js';
import { NPC_SERVICE, npcServiceKind } from '../src/systems/guildServices.js';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';

const BV = 'beautiful-villages', BC = 'beautiful-cities';
const KYNARETH = 35, PRIEST = 240, KYNARETH_SUMMONER = 498;
const person = (factionID, x, position) => ({ Position: position, XPos: x, YPos: 0, ZPos: 10, TextureArchive: 182, TextureRecord: 20, FactionID: factionID, Flags: 1 });
/** Beautiful Villages' TEMPASH0 as the door serves it: record 11 its Kynareth temple, its priest and no summoner. */
function templeJson(name = 'TEMPASH0.RMB', { deity = KYNARETH, people = [person(PRIEST, 5, 3853)] } = {}) {
  const j = blockToDfuJson(tinyRmb(7, name));
  const sub = j.RmbBlock.SubRecords[1];
  while (j.RmbBlock.SubRecords.length < 12) j.RmbBlock.SubRecords.push(structuredClone(sub));
  while (j.RmbBlock.FldHeader.BuildingDataList.length < 12) j.RmbBlock.FldHeader.BuildingDataList.push(structuredClone(j.RmbBlock.FldHeader.BuildingDataList[0]));
  Object.assign(j.RmbBlock.FldHeader.BuildingDataList[11], { BuildingType: 'Temple', FactionId: deity });
  j.RmbBlock.SubRecords[11].Interior.BlockPeopleRecords = people;
  j.RmbBlock.SubRecords[11].Interior.Header.NumPeopleRecords = people.length;
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

test('QUEST-AUDIT II TEMPLE-SUMMONER: the rows are the 24 designs of Beautiful Villages, each a temple record of its own block, each Daggerfall\'s summoner of its deity, each with a record position no other row of the design repeats; the summoners are DaedraSummoning\'s temple factions exactly (mutants: a row\'s faction, the list)', () => {
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
});
