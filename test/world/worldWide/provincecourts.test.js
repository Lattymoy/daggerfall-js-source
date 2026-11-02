// PROVINCE-COURTS (2026-10-27; the audit "no system left behind in the Bay", item 33 - the owner's call taken: "Every
// single thing here needs to be addressed. No exceptions."; bible/03-World/World-Wide.md PROVINCE-COURTS): THE PROVINCES'
// OWN COURTS AND PEOPLE. FACTION.TXT has a Province, a Court and a People for each of the Bay's regions and none past it;
// the port's own (systems/faction/provinceFactions.js) ride every faction dictionary through DFU's AddCustomFactions door,
// so every reader of a region's court or people finds a province's: the palace's nobles, %rn/%rt, a crime's People half,
// the price walk's tilt, the regional conditions (wars, plagues), a vampire's bloodline, the Standing page - and the Bay's
// records are FACTION.TXT's to the byte. Then, where ARENA2_PATH names the freeware, the proofs on the game's own files.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  PROVINCE_COURTS, PROVINCE_FACTION_BASE, PROVINCE_FACTION_IDS, RULER, CYRODIIL_RULER_NAME, provinceFactionId, provinceFactionRecords,
  addProvinceFactions, provinceRulerName, provinceFactionShownName, isProvinceFactionId, provinceCourtOf,
} from '../../../src/systems/faction/provinceFactions.js';
import { PROVINCE_BORDERS, BORDER_REGIONS, BORDERS_PER_REGION, provinceRegionsBorder, isEnemyStatePermanentUntilWarOver, isFaction2APotentialWarEnemyOfFaction1, startFactionEnemies } from '../../../src/systems/faction/factionRelations.js';
import { FactionFile, FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { REGION_NAMES, PROVINCE_REGION_NAMES, BAY_REGION_COUNT } from '../../../src/formats/mapsTables.js';
import { addCustomFactions, createFactionRep, getReputation, setReputation } from '../../../src/systems/faction/factionRep.js';
import { getPeopleOfCurrentRegion, getCourtOfCurrentRegion, findFactions, findFactionByTypeAndRegion } from '../../../src/systems/talk/talk.js';
import { RULER_TITLES, rulerTitle, BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { VAMPIRE_CLANS, startInfection, deployInfection, setInfectionHost, INFECTION } from '../../../src/systems/infection.js';
import { srand, getSeed } from '../../../src/formats/dfRandom.js';
import { getLocalizedFactionName, patchLocaleTable, setLocale, parseStringTableCsv, clearLocaleTables } from '../../../src/systems/textManager.js';
import { lowerRepForCrime, REPUTATION_LOSS_PER_CRIME } from '../../../src/systems/court.js';
import { worldPriceTiltOf, updateRegionalPrices } from '../../../src/systems/shopStock.js';
import { REGION_COUNT, REGION_FLAGS, createRegionConditions, conditionFlag, turnOnConditionFlag } from '../../../src/systems/region/regionConditions.js';
import { regionPowerUpdate, factionConditionsStep, isFactionValidForRumorMill } from '../../../src/systems/region/regionPower.js';
import { snapshotFactionRep, restoreFactionRep } from '../../../src/systems/save/save.js';
import { standingGroups } from '../../../src/systems/faction/factionStanding.js';
import { crownRulerFactionId, crownRulerHere } from '../../../src/systems/crownHall.js';
import { CASTLE_SEATS, castleSeatOf, castleSeated, castleKeeps, castleBlockOf, CASTLE_BLOCKS, BAY_CASTLE_HALLS, capitalCastleDungeon } from '../../../src/world/capitalCastles.js';
import { NPCSession, RANDOM_RULER, RANDOM_NOBLE, RANDOM_KNIGHT } from '../../../src/systems/npcSession.js';
import { repairOf, applyRepair } from '../../../src/net/repairLaw.js';
import { memberStanding, readStanding } from '../../../src/systems/legacy/influence.js';
import { ROLL_FACTIONS } from '../../../src/net/npcChapterLaw.js';
import { RDB_RESOURCE_TYPES, BlocksFile } from '../../../src/formats/blocksFile.js';
import { isNpcFlat } from '../../../src/world/npcFlatArchives.js';
import { MERCHANTS_FACTION_ID } from '../../../src/systems/guild/guilds.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'FACTION.TXT'));
const skipReal = HAVE ? false : 'ARENA2_PATH not set';
const ROOT = new URL('../../../', import.meta.url);
const rd = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const SKYRIM = 64, CYRODIIL = 70, SUMURSET = 66;

/** FACTION.TXT as the freeware ships it, raw, and the game's own dictionary over it (the talk host's reader:
 *  scenes/townTalk.js - FACTION.TXT, then addCustomFactions). */
function factions() {
  const raw = new FactionFile(); raw.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  const game = new FactionFile(); game.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  addCustomFactions(game.factionDict, game.factionNameToId);
  return { raw: raw.factionDict, game: game.factionDict, nameToId: game.factionNameToId };
}

test('PROVINCE-COURTS the records: four a province - its Province, ruler, Court and People - keyed by the region past FACTION.TXT\'s ids, shaped as FACTION.TXT\'s crowns are (mutants: an id base; the children\'s order; a type; a social or guild group; the immunity)', () => {
  const recs = provinceFactionRecords();
  assert.equal(recs.length, 36);
  assert.deepEqual(PROVINCE_FACTION_BASE, { province: 6000, ruler: 6100, court: 6200, people: 6300 });
  assert.deepEqual(PROVINCE_COURTS.map((p) => p.region), [62, 63, 64, 65, 66, 67, 68, 69, 70], 'the nine provinces past the Bay (WW-R)');
  assert.equal(provinceFactionId('court', SKYRIM), 6264);
  assert.equal(provinceFactionId('court', 17), -1, 'a Bay region is FACTION.TXT\'s');
  assert.equal(provinceFactionId('nobody', SKYRIM), -1);
  // every id clear of FACTION.TXT's (0..977, the resolver's 980 on) and the port's registered mods' (RR3, IT1)
  for (const id of PROVINCE_FACTION_IDS) assert.ok(id >= 6062 && id <= 6370 && ![1020, 1021, 1022, 8642, 8643].includes(id), `${id}`);
  assert.equal(new Set(PROVINCE_FACTION_IDS).size, 36);
  const sky = recs.filter((r) => r.region === SKYRIM);
  assert.deepEqual(sky.map((r) => [r.id, r.parent, r.type, r.name, r.sgroup, r.ggroup, r.children]), [
    [6064, 0, FACTION_TYPES.Province, 'Skyrim', SOCIAL_GROUPS.Nobility, GUILD_GROUPS.Region, [6164, 6264, 6364]],
    [6164, 6064, FACTION_TYPES.Individual, 'Haran Jurgarnesen', SOCIAL_GROUPS.Nobility, GUILD_GROUPS.None, null],
    [6264, 6064, FACTION_TYPES.Courts, 'Court of Skyrim', SOCIAL_GROUPS.Nobility, GUILD_GROUPS.Region, null],
    [6364, 6064, FACTION_TYPES.People, 'People of Skyrim', SOCIAL_GROUPS.Commoners, GUILD_GROUPS.GeneralPopulace, null],
  ]);
  // the crowns' own numbers (Daggerfall 201 / Court 595 / People 518's shape): the court's power 25 and flags 128, the
  // people's power 5; a crowned province's flags the crowns' 60, a crownless land's RulerImmune alone
  assert.deepEqual(sky.map((r) => [r.power, r.flags, r.summon, r.face, r.flat1, r.flat2, r.minf, r.maxf]), [
    [80, 60, -1, -1, (183 << 7) + 6, (183 << 7) + 8, 20, 70],
    [15, 0, -1, 377, (183 << 7) + 6, (183 << 7) + 6, 20, 90],
    [25, 128, -1, -1, (182 << 7) + 20, (182 << 7) + 20, 20, 80],
    [5, 0, -1, -1, (182 << 7) + 20, (182 << 7) + 28, 5, 30],
  ]);
  assert.deepEqual(recs.filter((r) => r.type === FACTION_TYPES.Province).map((r) => [r.region, r.flags]),
    [[62, 16], [63, 16], [64, 60], [65, 60], [66, 60], [67, 60], [68, 60], [69, 60], [70, 60]]);
  const parsed = new FactionFile();
  parsed.parse('#1\nname: x\n');
  assert.deepEqual(Object.keys(recs[0]).sort(), Object.keys(parsed.getFaction(1)).sort(), 'every field of the record FactionFile mints');
  assert.notEqual(provinceFactionRecords()[0], recs[0], 'fresh records each time (a dictionary owns what it is handed)');
  assert.equal(isProvinceFactionId(6264), true);
  assert.equal(isProvinceFactionId(595), false);
  assert.equal(provinceCourtOf(17), null);
});

test('PROVINCE-COURTS the rulers: named from the province\'s own name bank on the game\'s own banks, seeded by the ruler\'s id, the DFRandom stream put back; Cyrodiil\'s Daggerfall\'s own Emperor; titled by the lore - DFU\'s twelve and the port\'s four after them (mutants: the seed; the gender; the stream not restored; a title)', () => {
  srand(4242);
  const was = getSeed();
  const names = PROVINCE_COURTS.map((p) => provinceRulerName(p.region));
  assert.equal(getSeed(), was, 'the stream as it was - a dictionary is made mid-game');
  assert.deepEqual(names, ['Alabynak Masterton', 'Rlirptha', 'Haran Jurgarnesen', 'Helil Sailathil', 'Cymbana Larethwatch', 'Legoman Ivywood', 'Najjan Raihan', 'Caligius Calissius', CYRODIIL_RULER_NAME]);
  assert.equal(CYRODIIL_RULER_NAME, 'Uriel Septim VII');
  assert.equal(provinceRulerName(17), null);
  assert.deepEqual(PROVINCE_COURTS.map((p) => [p.region, rulerTitle(p.ruler)]), [[62, 'Duke'], [63, 'Duchess'], [64, 'High King'], [65, 'King'], [66, 'Queen'],
    [67, 'King'], [68, 'Queen'], [69, 'King'], [70, 'Emperor']]);
  assert.deepEqual(Object.fromEntries(Object.entries(RULER_TITLES)), { 1: 'King', 2: 'Queen', 3: 'Duke', 4: 'Duchess', 5: 'Marquis', 6: 'Marquise', 7: 'Count', 8: 'Countess',
    9: 'Baron', 10: 'Baroness', 11: 'Lord', 12: 'Lady', 13: 'High King', 14: 'High Queen', 15: 'Emperor', 16: 'Empress' }, 'DFU\'s twelve unchanged, the port\'s four after');
  assert.equal(rulerTitle(17), 'Lord', 'GetRulerTitle\'s default arm');
  assert.deepEqual(RULER, { King: 1, Queen: 2, Duke: 3, Duchess: 4, HighKing: 13, HighQueen: 14, Emperor: 15, Empress: 16 });
  // a man's title odd and a woman's even ((ruler + 1) % 2 - MacroHelper's gender law), and the name drawn for that gender
  for (const p of PROVINCE_COURTS) assert.equal(p.ruler % 2 === 1, [62, 64, 65, 67, 69, 70].includes(p.region), `${p.region}`);
});

test('PROVINCE-COURTS the bloodlines: one of Daggerfall\'s nine clans a province, each clan once (mutant: a clan swapped)', () => {
  assert.deepEqual(Object.fromEntries(PROVINCE_COURTS.map((p) => [p.region, Object.keys(VAMPIRE_CLANS).find((k) => VAMPIRE_CLANS[k] === p.vam)])), {
    62: 'Garlythi', 63: 'Anthotis', 64: 'Haarvenu', 65: 'Montalion', 66: 'Thrafey', 67: 'Khulari', 68: 'Lyrezi', 69: 'Selenu', 70: 'Vraseth',
  });
  assert.equal(new Set(PROVINCE_COURTS.map((p) => p.vam)).size, 9);
  // the people's race in FACTION.TXT's own numbering (FactionRaces): Breton, Redguard, Nord, Dark Elf, High Elf, Wood Elf,
  // Khajiit, Argonian, and Cyrodiil's Imperials as Bretons (WW-R)
  assert.deepEqual(PROVINCE_COURTS.map((p) => p.race), [3, 2, 0, 7, 6, 5, 1, 4, 3]);
});

test('PROVINCE-COURTS the door: every province faction a dictionary lacks, added once, its name in the name map where none holds it, a record already there kept; the store\'s Reset and the talk reader both through addCustomFactions (mutants: added twice; the name map overwritten; the door uncalled)', () => {
  const dict = new Map([[6264, { id: 6264, name: 'A mod\'s own' }]]);
  const names = new Map([['Skyrim', 9]]);
  assert.equal(addProvinceFactions(dict, names), 35);
  assert.equal(dict.get(6264).name, 'A mod\'s own', 'an id already held is kept');
  assert.equal(names.get('Skyrim'), 9, 'first name wins, as FactionFile\'s');
  assert.equal(names.get('People of Skyrim'), 6364);
  assert.equal(addProvinceFactions(dict, names), 0);
  assert.equal(addProvinceFactions(null), 0);
  const store = createFactionRep(new Map([[41, { id: 41, name: 'The Fighters Guild', parent: 0, children: null }]]));
  assert.equal(store.dict.size, 1 + 36, 'Reset (:331): a fresh store carries them');
  assert.equal(store.dict.get(6364).name, 'People of Skyrim');
  assert.match(rd('src/scenes/townTalk.js'), /addCustomFactions\(factions\.factionDict, factions\.factionNameToId\);/, 'the talk reader comes in by the same door');
  assert.match(rd('src/systems/faction/factionRep.js'), /export function addCustomFactions\(dict, nameToId = null\) \{[^}]*addProvinceFactions\(dict, nameToId\);/);
});

test('PROVINCE-COURTS the shown names: a province\'s court and people in the player\'s language through GetLocalizedFactionName\'s port door - the key stays English (mutants: the door unasked; the region\'s shown name unread)', () => {
  assert.equal(getLocalizedFactionName(6264, 'x'), 'Court of Skyrim');
  assert.equal(getLocalizedFactionName(6064, 'x'), 'Skyrim');
  assert.equal(getLocalizedFactionName(6164, 'x'), 'Haran Jurgarnesen');
  assert.equal(getLocalizedFactionName(595, 'Court of Daggerfall'), 'Court of Daggerfall', 'FACTION.TXT\'s keep their own fallback');
  assert.equal(provinceFactionShownName(595), null);
  const rows = parseStringTableCsv(rd('locales/de/Port_Strings.csv'));
  patchLocaleTable('de', 'Port_Strings', rows);
  patchLocaleTable('de', 'Internal_Strings', [['regionNames', [...REGION_NAMES.slice(0, 64), 'Himmelsrand', ...REGION_NAMES.slice(65)].join('\n')]]);
  setLocale('de');
  try {
    assert.equal(getLocalizedFactionName(6264, 'x'), 'Hof von Himmelsrand');
    assert.equal(getLocalizedFactionName(6364, 'x'), 'Volk von Himmelsrand');
    assert.equal(getLocalizedFactionName(6064, 'x'), 'Himmelsrand');
    assert.equal(rulerTitle(13), 'Hochkönig');
    const kingdoms = standingGroups({ name: 'x', factionRep: createFactionRep(new Map()), guildMemberships: {} }).find((g) => g.id === 'kingdoms').rows;
    assert.equal(kingdoms.find((r) => r.factionId === 6064)?.name, 'Himmelsrand', 'the Standing page shows a kingdom as GetFactionData shows its name');
    assert.equal(provinceFactionRecords().find((r) => r.id === 6264).name, 'Court of Skyrim', 'the key is English whatever the language');
  } finally { setLocale('en'); clearLocaleTables('de'); }
});

test('PROVINCE-COURTS the borders past the Bay: the provinces whose land meets on the politic map, and across the Bay\'s edge; a pair with a province in it read there alone, and for two Provinces alone - a vampire clan carries a province\'s number and is none (mutants: a pair dropped; the type gate; the Bay\'s table read for a province)', () => {
  assert.equal(PROVINCE_BORDERS.length, 23);
  assert.equal(provinceRegionsBorder(SKYRIM, CYRODIIL), true);
  assert.equal(provinceRegionsBorder(CYRODIIL, SKYRIM), true, 'both ways');
  assert.equal(PROVINCE_BORDERS.some(([a, b]) => a === SUMURSET || b === SUMURSET), false, 'an isle meets none');
  const P = (id, region) => ({ id, region, type: FACTION_TYPES.Province });
  assert.equal(isEnemyStatePermanentUntilWarOver(P(6064, SKYRIM), P(6070, CYRODIIL)), true);
  assert.equal(isEnemyStatePermanentUntilWarOver(P(6064, SKYRIM), P(6066, SUMURSET)), false);
  assert.equal(isEnemyStatePermanentUntilWarOver(P(208, 32), P(6062, 62)), true, 'Northmoor and High Rock past the Bay meet at its edge');
  assert.equal(isEnemyStatePermanentUntilWarOver({ id: 152, region: SKYRIM, type: FACTION_TYPES.VampireClan }, P(6070, CYRODIIL)), false, 'The Thrafey carry region 64 and are no Skyrim');
  assert.equal(isEnemyStatePermanentUntilWarOver(P(6070, CYRODIIL), { id: 152, region: SKYRIM, type: FACTION_TYPES.VampireClan }), false);
  // DFU's own rows name a 62 three times (Bantha's, the High Rock coasts') - never the port's High Rock
  assert.deepEqual([10, 30, 31].map((r) => BORDER_REGIONS.slice(r * BORDERS_PER_REGION, (r + 1) * BORDERS_PER_REGION).includes(62)), [true, true, true]);
  assert.equal(isEnemyStatePermanentUntilWarOver(P(1, 10), P(6062, 62)), false);
  // a Bay pair reads DFU's table as before: Daggerfall (17) and its row's neighbours
  assert.equal(isEnemyStatePermanentUntilWarOver(P(201, 17), P(204, 20)), BORDER_REGIONS.slice(17 * 11, 18 * 11).includes(20));
});

test('PROVINCE-COURTS the questor pool\'s palace is DFU\'s BuildingTypes.Palace as the pool mints it (a number): a factionless palace noble is the court\'s, as at a click (mutant: the number unread)', () => {
  const court = { id: 6264, parent: 6064, type: FACTION_TYPES.Courts, sgroup: SOCIAL_GROUPS.Nobility, ggroup: GUILD_GROUPS.Region };
  const people = { id: 6364, parent: 6064, type: FACTION_TYPES.People, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.GeneralPopulace };
  const dict = new Map([[6264, court], [6364, people]]);
  const s = new NPCSession({ factionData: (id) => dict.get(id) ?? null, courtOfCurrentRegion: () => 6264, peopleOfCurrentRegion: () => 6364, rolls: () => 0.9, currentLocationIndex: () => 1 });
  assert.equal(s.getStaticNPCFactionData(0, BUILDING_TYPES.Palace), court);
  assert.equal(s.getStaticNPCFactionData(0, 'Palace'), court, 'the click\'s name as before');
  assert.equal(s.getStaticNPCFactionData(0, BUILDING_TYPES.Tavern), people);
  s.buildQuestorPool([{ buildingKey: 9, buildingName: 'The Palace', buildingType: BUILDING_TYPES.Palace, isNamedBuilding: true, npcs: [{ nameSeed: 1, factionID: 0, isChild: false }, { nameSeed: 2, factionID: RANDOM_RULER, isChild: false }] }]);
  assert.deepEqual([...s.npcsWithWork.values()].map((e) => e.socialGroup), [SOCIAL_GROUPS.Nobility, SOCIAL_GROUPS.Nobility], 'noble work, both');
});

test('PROVINCE-COURTS the castle\'s court, the capital\'s own: a Bay court\'s person re-seated under DFU\'s generic faction (the ruler Random Ruler, the nobles Random Noble, the knights Random Knight, the commoners factionless), a noble in its generic faction\'s look by its gender, the rest as WW7-4 stood them down; the throne room\'s ruler a province\'s seated ruler (mutants: a seat\'s faction; the gender; the look kept; the throne unfound)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CASTLE_SEATS).map(([k, s]) => [k, s.faction])), { ruler: RANDOM_RULER, noble: RANDOM_NOBLE, knight: RANDOM_KNIGHT, people: 0 });
  const flat = (archive, record, faction, flags = 0, position = 0) => ({ type: RDB_RESOURCE_TYPES.Flat, position, resources: { flatResource: { textureArchive: archive, textureRecord: record, textureBitfield: (archive << 7) | record, factionOrMobileId: faction, magnitude: faction & 0xff, soundIndex: faction >> 8, flags, nextObjectOffset: 0 } } });
  const fr = (o) => o.resources.flatResource;
  const gothryd = castleSeated(flat(357, 15, 380, 32));
  assert.deepEqual([fr(gothryd).factionOrMobileId, fr(gothryd).magnitude, fr(gothryd).soundIndex, fr(gothryd).textureArchive, fr(gothryd).textureRecord, fr(gothryd).textureBitfield], [852, 852 & 0xff, 852 >> 8, 183, 8, (183 << 7) | 8], 'Akorithi\'s throne under Random Ruler, a queen\'s look');
  assert.deepEqual([fr(castleSeated(flat(334, 19, 364))).textureRecord, fr(castleSeated(flat(334, 17, 367))).factionOrMobileId], [6, RANDOM_NOBLE]);
  const knight = fr(castleSeated(flat(334, 16, 368, 32)));
  assert.deepEqual([knight.factionOrMobileId, knight.textureArchive, knight.textureRecord], [RANDOM_KNIGHT, 183, 14]);
  const commoner = fr(castleSeated(flat(334, 14, 518)));
  assert.deepEqual([commoner.factionOrMobileId, commoner.textureArchive, commoner.textureRecord], [0, 334, 14], 'a commoner keeps the look it had');
  const bard = flat(334, 11, 511);
  assert.equal(castleSeated(bard), bard, 'the castle\'s folk as they were');
  assert.equal(castleKeeps(flat(334, 19, 364)), true);
  assert.equal(castleKeeps(flat(334, 13, 150)), false, 'a vampire clan\'s spy goes, as before');
  assert.equal(castleKeeps(flat(357, 0, 501)), false, 'Lady Northbridge goes');
  assert.equal(castleSeatOf(501), null);
  // the throne room: a province's ruler sits under Random Ruler; a Bay crown's ruler is found by its own id alone
  const people = [{ factionID: 0 }, { factionID: RANDOM_RULER, x: 1 }];
  assert.equal(crownRulerHere(people, 6164), people[1]);
  assert.equal(crownRulerHere(people, 364), null);
  assert.equal(crownRulerHere([{ factionID: 364 }], 364)?.factionID, 364);
  assert.equal(crownRulerHere(people, null), null);
});

test('PROVINCE-COURTS a lookup of a faction by a region is typed - no reader of a region\'s court, people or crown can take a vampire clan for a province\'s (the source swept: every findFactions names a type, every findFactionByTypeAndRegion a FACTION_TYPES or the Province\'s 7, or passes its caller\'s type through)', () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(new URL(d, ROOT), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk('src');
  /** A call's arguments, its brackets balanced, split at its own commas. */
  const argsAt = (src, open) => {
    let depth = 0, cur = '';
    const out = [];
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (c === '(' || c === '{' || c === '[') { depth++; if (depth === 1) continue; }
      if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0) { out.push(cur.trim()); return out; } }
      if (c === ',' && depth === 1) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    return out;
  };
  const declared = (src, at) => /function\s+$/.test(src.slice(Math.max(0, at - 20), at));
  let n = 0;
  for (const f of files) {
    const src = rd(f);
    for (const m of src.matchAll(/\bfindFactions\(/g)) {
      if (declared(src, m.index)) continue;
      const args = argsAt(src, m.index + m[0].length - 1);
      n++;
      assert.match(args[1] ?? '', /\btype:/, `${f}: findFactions(${args.join(', ')}) names no type`);
    }
    for (const m of src.matchAll(/\bfindFactionByTypeAndRegion\??\.?\(/g)) {
      if (declared(src, m.index)) continue;
      const args = argsAt(src, m.index + m[0].length - 1);
      const type = args.length >= 3 ? args[1] : args[0];
      n++;
      assert.match(type ?? '', /^(FACTION_TYPES\.(Province|People|Courts|WitchesCoven)|7|type)$/, `${f}: findFactionByTypeAndRegion(${args.join(', ')})`);
    }
  }
  assert.ok(n >= 15, `${n} lookups found - the walk is reading the tree`);
  // crownHall's own walk asks the Province type with the region
  assert.match(rd('src/systems/crownHall.js'), /if \(f\?\.type !== FACTION_TYPES\.Province \|\| f\.region !== region\) continue;/);
});

test('PROVINCE-COURTS on the freeware: the Bay\'s 62 regions\' factions are FACTION.TXT\'s to the byte - every record, every child list, every region\'s court, people and Province as before; the clans\' records untouched (mutants: a Bay record moved; a Bay child gained)', { skip: skipReal }, () => {
  const { raw, game } = factions();
  assert.equal(game.size, raw.size + 36);
  for (const [id, f] of raw) assert.equal(JSON.stringify(game.get(id)), JSON.stringify(f), `faction ${id} to the byte`);
  assert.deepEqual([...game.keys()].slice(0, raw.size), [...raw.keys()], 'in FACTION.TXT\'s order, the provinces after');
  for (let r = 0; r < BAY_REGION_COUNT; r++) {
    assert.equal(getPeopleOfCurrentRegion(game, r)?.id, getPeopleOfCurrentRegion(raw, r)?.id, `region ${r} people`);
    assert.equal(getCourtOfCurrentRegion(game, r)?.id, getCourtOfCurrentRegion(raw, r)?.id, `region ${r} court`);
    assert.equal(findFactionByTypeAndRegion(game, FACTION_TYPES.Province, r)?.id, findFactionByTypeAndRegion(raw, FACTION_TYPES.Province, r)?.id, `region ${r} province`);
  }
  for (let id = 150; id <= 158; id++) assert.deepEqual([game.get(id).type, game.get(id).region], [FACTION_TYPES.VampireClan, id - 150 + 62], 'the clans carry the provinces\' numbers - and keep them');
});

test('PROVINCE-COURTS on the freeware: every reader of a province\'s court and people finds its own, never a clan - the People, the Court (GetCourtOfCurrentRegion\'s one match), the Province and %rn/%rt\'s lookup, the hosts\' region faction, the throne room\'s ruler; before, none (mutants: a record\'s type; a region)', { skip: skipReal }, () => {
  const { raw, game } = factions();
  for (const p of PROVINCE_COURTS) {
    const r = p.region;
    assert.equal(getPeopleOfCurrentRegion(raw, r), null, `before: no people in ${REGION_NAMES[r]}`);
    assert.equal(getCourtOfCurrentRegion(raw, r), null);
    assert.equal(findFactionByTypeAndRegion(raw, FACTION_TYPES.Province, r)?.name, 'Random Ruler', 'before: %rn/%rt read the placeholder');
    assert.equal(getPeopleOfCurrentRegion(game, r)?.id, 6300 + r);
    assert.equal(getCourtOfCurrentRegion(game, r)?.id, 6200 + r);
    assert.equal(findFactionByTypeAndRegion(game, FACTION_TYPES.Province, r)?.id, 6000 + r);
    assert.equal(findFactions(game, { type: FACTION_TYPES.Province, region: r })[0]?.id, 6000 + r, 'the hosts\' _regionFaction (world.js, questWorld.js, shared.js clanOf)');
    assert.equal(crownRulerFactionId(game, r), 6100 + r, 'the throne room\'s ruler');
    assert.equal(game.get(150 + r - 62).region, r, 'the clan of that number stands beside it, typed out');
  }
});

test('PROVINCE-COURTS on the freeware: %rn names Skyrim\'s ruler and %rt titles him, through the quest world past the Bay (mutant: the ruler not the first child)', { skip: skipReal }, async () => {
  const { getContextValue } = await import('../../../src/systems/quest/questMacros.js');
  const { game } = factions();
  const store = createFactionRep(game);
  const world = { findFactionByTypeAndRegion: (type, region) => findFactionByTypeAndRegion(store.dict, type, region), getFactionData: (id) => store.dict.get(id) ?? null, currentRegionIndex: () => SKYRIM, currentRegionFaction: () => findFactions(store.dict, { type: FACTION_TYPES.Province, region: SKYRIM })[0]?.id ?? -1 };
  assert.equal(getContextValue('%rn', null, { world }), 'Haran Jurgarnesen');
  assert.equal(getContextValue('%rt', null, { world }), 'High King');
  assert.equal(getContextValue('%nrn', null, { world }), 'Haran Jurgarnesen');
  assert.equal(getContextValue('%rt', null, { world: { ...world, currentRegionIndex: () => CYRODIIL } }), 'Emperor');
  assert.equal(getContextValue('%rn', null, { world: { ...world, currentRegionIndex: () => CYRODIIL } }), 'Uriel Septim VII');
});

test('PROVINCE-COURTS on the freeware: a crime in Skyrim moves the People of Skyrim\'s standing, half the legal loss, propagated through Skyrim\'s court as a Bay crime walks Daggerfall\'s; before, nothing moved (mutant: the People unfound)', { skip: skipReal }, () => {
  const { raw, game } = factions();
  const crime = 1;
  const before = { factionRep: createFactionRep(raw), legalRep: {} };
  before.factionRep.dict.forEach((f, id) => { if (id >= 6000) before.factionRep.dict.delete(id); });   // the store as it stood before
  lowerRepForCrime(before, SKYRIM, crime);
  assert.ok([...before.factionRep.dict.values()].every((f) => f.rep === raw.get(f.id)?.rep), 'before: no faction moved');
  const player = { factionRep: createFactionRep(game), legalRep: {} };
  lowerRepForCrime(player, SKYRIM, crime);
  const half = -Math.trunc(REPUTATION_LOSS_PER_CRIME[crime] / 2);
  assert.equal(getReputation(player.factionRep, 6364), half, 'the People take half the legal loss');
  assert.equal(getReputation(player.factionRep, 6064), half, 'the Province (the root) the full amount, as Daggerfall does');
  assert.equal(getReputation(player.factionRep, 6264), Math.trunc(half / 2), 'the Court half of it');
  const bay = { factionRep: createFactionRep(game), legalRep: {} };
  lowerRepForCrime(bay, 17, crime);
  assert.equal(getReputation(bay.factionRep, 518), half, 'a crime in Daggerfall as before');
  assert.equal(getReputation(bay.factionRep, 6364), 0);
});

test('PROVINCE-COURTS on the freeware: Skyrim\'s prices tilt by Skyrim\'s own power against The Merchants\' - the world\'s and the player\'s walk; before, by Random Ruler\'s (mutant: the power)', { skip: skipReal }, () => {
  const { raw, game } = factions();
  const merchants = raw.get(MERCHANTS_FACTION_ID);
  assert.equal(merchants.name, 'The Merchants');
  assert.equal(worldPriceTiltOf(raw)(SKYRIM), Math.trunc((merchants.power - 65) / 5), 'before: Random Ruler\'s 65');
  assert.equal(worldPriceTiltOf(game)(SKYRIM), Math.trunc((merchants.power - 80) / 5));
  assert.equal(worldPriceTiltOf(game)(CYRODIIL), Math.trunc((merchants.power - 90) / 5));
  assert.equal(worldPriceTiltOf(game)(17), worldPriceTiltOf(raw)(17), 'Daggerfall\'s as before');
  // the player's walk, one day, every region at 1000, one roll: a rise before (chance 45), a fall now (chance 42)
  const walk = (dict) => { const e = { regionPrices: Object.fromEntries([...Array(REGION_COUNT).keys()].map((i) => [i, 1000])) }; updateRegionalPrices(e, dict, 1, () => 0.43); return e.regionPrices; };
  assert.deepEqual([walk(raw)[SKYRIM], walk(game)[SKYRIM], walk(raw)[17], walk(game)[17]], [1020, 980, walk(raw)[17], walk(raw)[17]]);
});

test('PROVINCE-COURTS on the freeware: a vampire turned in Skyrim takes Skyrim\'s bloodline - the host\'s clan read (scenes/shared.js clanOf, off the player\'s own store) at the deploy; a Bay region\'s as before; before, a Lyrezi (mutant: the vam)', { skip: skipReal }, async () => {
  const { wireInfectionVideos } = await import('../../../src/scenes/shared.js');
  const { raw, game } = factions();
  const turned = (dict, region) => {
    const prev = wireInfectionVideos({ canvas: null }, { factionDict: () => dict });
    const host = setInfectionHost(prev);
    const entity = { isPlayer: true, level: 5, factionRep: createFactionRep(dict) };
    if (dict === raw) for (const id of [...entity.factionRep.dict.keys()]) if (id >= 6000) entity.factionRep.dict.delete(id);
    const entry = startInfection(entity, INFECTION.Vampirism, { day: 0, regionIndex: region });
    return deployInfection(entry, entity, { clanOf: host.clanOf }).clan;
  };
  assert.equal(turned(raw, SKYRIM), VAMPIRE_CLANS.Lyrezi, 'before: DFU\'s default');
  assert.equal(turned(game, SKYRIM), VAMPIRE_CLANS.Haarvenu);
  assert.equal(turned(game, CYRODIIL), VAMPIRE_CLANS.Vraseth);
  assert.equal(turned(game, 17), raw.get(201).vam, 'Daggerfall\'s Vraseth as before');
});

test('PROVINCE-COURTS on the freeware: the regional conditions walk the provinces - their Province factions in the walk, a famine, a plague or a crime wave lights in a province, and two bordering provinces at odds go to war (mutants: the province not walked; the border)', { skip: skipReal }, () => {
  const { game } = factions();
  assert.ok(PROVINCE_COURTS.every((p) => isFactionValidForRumorMill(game.get(6000 + p.region))), 'every province walks');
  const store = createFactionRep(game);
  const rc = createRegionConditions(REGION_COUNT);
  let seed = 7;
  const rolls = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 16777216; };
  const lit = new Set();
  for (let i = 0; i < 120; i++) {
    regionPowerUpdate(store, { rolls, updateConditions: true, regionConditions: rc });
    for (const p of PROVINCE_COURTS) for (const f of ['FamineBeginning', 'PlagueBeginning', 'CrimeWave', 'WarBeginning']) if (conditionFlag(rc, p.region, REGION_FLAGS[f])) lit.add(`${p.region}:${f}`);
  }
  assert.ok(lit.size > 0, `a province's conditions lit: ${[...lit].join(', ')}`);
  // a war: Skyrim and Cyrodiil at odds, the war begun - the next update fights it in Skyrim
  const dict = createFactionRep(game).dict;
  startFactionEnemies(dict, 6064, 0, 6070);
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(dict, 6064, 6070), true);
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(dict, 6064, 6066), false, 'Sumurset meets nobody');
  const war = createRegionConditions(REGION_COUNT);
  turnOnConditionFlag(war, SKYRIM, REGION_FLAGS.WarBeginning, () => 0);
  const sky = dict.get(6064);
  factionConditionsStep(dict, sky, [...dict.keys()], { allies: [0, 0, 0], enemies: [sky.enemy1, sky.enemy2, sky.enemy3], alliesPower: 0 }, { regionConditions: war, rolls: () => 0.99 });
  assert.equal(conditionFlag(war, SKYRIM, REGION_FLAGS.WarOngoing), true, 'the war is on in Skyrim');
});

test('PROVINCE-COURTS on the freeware: the player\'s standing with a province rides the save, and an old save loads with the provinces at their default; the Standing page lists the provinces\' kingdoms (mutants: the snapshot\'s ids; the restore)', { skip: skipReal }, () => {
  const { raw, game } = factions();
  const store = createFactionRep(game);
  setReputation(store, 6364, -12);
  const snap = snapshotFactionRep(store);
  assert.ok(PROVINCE_FACTION_IDS.every((id) => snap.ids.includes(id)));
  const loaded = createFactionRep(game);
  restoreFactionRep(loaded, snap);
  assert.equal(getReputation(loaded, 6364), -12, 'a province\'s standing round-trips');
  // an old save: FACTION.TXT's ids alone
  const old = snapshotFactionRep({ dict: createFactionRep(raw).dict });
  const keep = old.ids.map((id, i) => (id < 6000 ? i : -1)).filter((i) => i >= 0);
  const oldSnap = Object.fromEntries(Object.entries(old).map(([k, v]) => [k, keep.map((i) => v[i])]));
  const fresh = createFactionRep(game);
  restoreFactionRep(fresh, oldSnap);
  for (const id of PROVINCE_FACTION_IDS) assert.deepEqual([fresh.dict.get(id).rep, fresh.dict.get(id).power], [0, provinceFactionRecords().find((r) => r.id === id).power], `${id} at its default`);
  const kingdoms = standingGroups({ name: 'x', factionRep: fresh, guildMemberships: {} }).find((g) => g.id === 'kingdoms').rows.map((r) => r.name);
  for (const n of PROVINCE_REGION_NAMES) assert.ok(kingdoms.includes(n), n);
});

test('PROVINCE-COURTS online: no book of the account\'s is a region\'s court or people - the Roll is the twenty-two guild factions; a province\'s standing rides the realm\'s save, which the staff repair and Project Legacy\'s standing take by any id (mutant: none - the laws as they stand, pinned)', () => {
  for (const id of PROVINCE_FACTION_IDS) assert.ok(!ROLL_FACTIONS.includes(id));
  const r = repairOf({ ticket: 'province-court', faction: 6264, flag: 0x40, gold: 0 });
  assert.deepEqual(r, { ticket: 'province-court', faction: 6264, flag: 0x40, gold: 0 });
  const save = { factionRep: { ids: [6264], flags: [0x40] } };
  assert.deepEqual(applyRepair(save, r), { was: 0x40 });
  const standing = memberStanding({ factionRep: { dict: new Map([[6364, { rep: -7 }]]) }, legalRep: {} }, null, 0);
  assert.deepEqual(readStanding(standing).factions, { 6364: -7 });
});

test('PROVINCE-COURTS on the freeware: a Solitude palace noble offers noble work - the Blue Palace\'s halls (Sentinel\'s palace\'s copy) seat Skyrim\'s court, and its nobles\' social group is the Nobility the noble quests are drawn by; before, the court stood down (mutants: the court stood down again; the redirect)', { skip: skipReal }, async () => {
  const { registerPortBlockOf, bindWorldDataBlocks, _resetWorldDataReplacement, installWorldDataReplacement } = await import('../../../src/formats/worldData/worldDataReplacement.js');
  const { layoutDungeon } = await import('../../../src/world/dungeon/dungeonLayout.js');
  const { CAPITALS, capitalPlaceId } = await import('../../../src/world/tamrielCapitals.js');
  const { staticNpcData, NPC_CONTEXT } = await import('../../../src/characters/staticNpc.js');
  const { QuestListsManager } = await import('../../../src/systems/quest/questLists.js');
  const { game } = factions();
  _resetWorldDataReplacement();
  installWorldDataReplacement();
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  bindWorldDataBlocks(blocks);
  for (const c of CASTLE_BLOCKS) registerPortBlockOf(c.name, (bf) => castleBlockOf(bf?.getBlockByName(c.from), c), c.index);
  try {
    const k = CAPITALS.findIndex((c) => c.key === 'solitude');
    const id = capitalPlaceId(k);
    const d = layoutDungeon({ name: 'Solitude', hasDungeon: true, dungeon: capitalCastleDungeon(k, id), mapTableData: { mapId: id }, climate: { worldClimate: 230 } }, blocks, () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] }));
    // the castle's people as the dungeon host mints them (scenes/dungeonContext.js: each NPC flat a person)
    const people = d.blocks.flatMap((b) => b.layout.flats.filter((f) => f.npc).map((f) => ({ textureArchive: f.archive, textureRecord: f.record, factionID: f.factionID, flags: f.flags, rawX: f.rawX, rawY: f.rawY, rawZ: f.rawZ, position: f.flatPosition })));
    const seated = people.filter((pn) => [RANDOM_RULER, RANDOM_NOBLE, RANDOM_KNIGHT].includes(pn.factionID));
    assert.ok(seated.some((pn) => pn.factionID === RANDOM_RULER), 'a ruler on the throne');
    assert.ok(seated.filter((pn) => pn.factionID === RANDOM_NOBLE).length >= 5, `the court's nobles: ${seated.length}`);
    assert.ok(seated.every((pn) => pn.textureArchive === 183), 'in the generic faction\'s look - no Bay royal');
    assert.ok(crownRulerHere(people, crownRulerFactionId(game, SKYRIM)), 'the throne room finds its ruler');
    // the talk, as the world host wires its session (world.js: the store's court and people of the location's region)
    const store = createFactionRep(game);
    const session = new NPCSession({
      factionData: (fid) => store.dict.get(fid) ?? null, courtOfCurrentRegion: () => getCourtOfCurrentRegion(store.dict, SKYRIM)?.id ?? 0,
      peopleOfCurrentRegion: () => getPeopleOfCurrentRegion(store.dict, SKYRIM)?.id ?? 0, isPlayerInsideCastle: () => true, rolls: () => 0, buildingType: () => null,
    });
    const noble = seated.find((pn) => pn.factionID === RANDOM_NOBLE);
    const offer = session.talkToStaticNPC({ data: staticNpcData(noble, { context: NPC_CONTEXT.Dungeon, mapId: id }), isChildNPC: false });
    assert.deepEqual([offer.kind, offer.socialGroup], ['questOffer', SOCIAL_GROUPS.Nobility], 'a castle noble of Skyrim\'s court offers noble work');
    const lists = new QuestListsManager({ readListTable: (name) => { try { return rd(`vendor/dfu-quests/Tables/QuestList-${name}.txt`); } catch { return null; } }, getQuestSourceLines: (n) => [n], parseQuest: (lines) => ({ name: lines[0] }) });
    const drawn = lists.getSocialQuest(offer.socialGroup, RANDOM_NOBLE, 'male', 0, 10);
    assert.ok(lists.social.get(SOCIAL_GROUPS.Nobility).some((q) => q.name === drawn.name), `${drawn.name} is the Nobility's work`);
    assert.ok(!lists.social.get(SOCIAL_GROUPS.Commoners).some((q) => q.name === drawn.name), 'not a commoner\'s');
  } finally { _resetWorldDataReplacement(); }
});

test('PROVINCE-COURTS on the freeware: every court person the Bay\'s three palaces carry is seated by FACTION.TXT\'s own law - the ruler its Province\'s first child, a noble an Individual of the Nobility or a Court, a knight a knightly order, a commoner a People - and the rest stood down are no court\'s (mutant: a seat\'s list)', { skip: skipReal }, () => {
  const { raw } = factions();
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const provinceOf = (id) => [...raw.values()].find((f) => f.type === FACTION_TYPES.Province && f.children?.[0] === id);
  for (const [kind, seat] of Object.entries(CASTLE_SEATS)) {
    for (const id of seat.ids) {
      const f = raw.get(id);
      if (kind === 'ruler') assert.ok(provinceOf(id) && f.type === FACTION_TYPES.Individual, `${f.name}: a crown's first child`);
      if (kind === 'noble') assert.ok((f.type === FACTION_TYPES.Individual || f.type === FACTION_TYPES.Courts) && f.sgroup === SOCIAL_GROUPS.Nobility, `${f.name}: the Nobility`);
      if (kind === 'knight') assert.equal(f.ggroup, GUILD_GROUPS.KnightlyOrder, `${f.name}: a knightly order`);
      if (kind === 'people') assert.equal(f.type, FACTION_TYPES.People, `${f.name}: a People`);
    }
  }
  const seen = new Set();
  for (const c of Object.values(BAY_CASTLE_HALLS)) for (const [name] of c.halls) {
    for (const g of blocks.getBlockByName(name)?.rdbBlock?.objectRootList ?? []) for (const o of g.rdbObjects ?? []) {
      const fr = o.type === RDB_RESOURCE_TYPES.Flat ? o.resources.flatResource : null;
      if (!fr || !isNpcFlat(fr.textureArchive) || [0, 511, 512, 514].includes(fr.factionOrMobileId)) continue;
      seen.add(fr.factionOrMobileId);
      const f = raw.get(fr.factionOrMobileId);
      if (castleSeatOf(fr.factionOrMobileId)) continue;
      // stood down: a clan's spy, a named scholar or guild member, a mobile's record - none of the Nobility's court
      assert.ok(!f || f.type === FACTION_TYPES.VampireClan || f.sgroup !== SOCIAL_GROUPS.Nobility, `${f?.name ?? fr.factionOrMobileId}: a court person left unseated`);
    }
  }
  for (const seat of Object.values(CASTLE_SEATS)) for (const id of seat.ids) assert.ok(seen.has(id), `${id} stands in a Bay palace`);
});

test('PROVINCE-COURTS on the freeware: the palaces past the Bay are their province\'s court - every palace of Skyrim\'s cities as the build stands it (Random Ruler\'s, as the Bay\'s are) offers its nobles\' work as the Court of Skyrim\'s, through the questor pool\'s own walk; before, the People\'s or nobody\'s (mutants: the court unfound; the pool\'s palace)', { skip: skipReal }, async () => {
  const { standWorldPastBay, questLayerAt } = await import('../../systems/quest/r25World.mjs');
  const { questorCandidateBuildings } = await import('../../../src/systems/talk/talkTopics.js');
  const { townBlockGrid } = await import('../../../src/systems/quest/place.js');
  const { inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const world = await standWorldPastBay(ARENA2);
  const dict = world.factions.factionDict;
  const { standAt } = world.places.provinceQuestPlaces;
  const rows = world.worldPlaces.all().filter((p) => !inBay(p.px, p.py) && p.type === 0);
  /** The pool of a town's palaces, its session wired as the world host wires it (world.js: the store's court and people
   *  of the location's region). */
  const poolOf = (loc, store, questWorld) => {
    const buildings = questorCandidateBuildings(loc.exterior.buildings, townBlockGrid(questWorld, loc).filter((b) => b.dfBlock), {
      locationIndex: loc.locationIndex ?? 0, mapId: loc.mapTableData?.mapId ?? 0, getFaction: (id) => store.dict.get(id) ?? null, raceOfCurrentRegion: () => 3,
    }).filter((b) => b.buildingType === BUILDING_TYPES.Palace);
    const s = new NPCSession({ factionData: (id) => store.dict.get(id) ?? null, courtOfCurrentRegion: () => getCourtOfCurrentRegion(store.dict, loc.regionIndex)?.id ?? 0,
      peopleOfCurrentRegion: () => getPeopleOfCurrentRegion(store.dict, loc.regionIndex)?.id ?? 0, rolls: () => 0.9, currentLocationIndex: () => loc.locationIndex ?? 1 });
    s.buildQuestorPool(buildings);
    return { buildings, groups: [...s.npcsWithWork.values()].map((e) => e.socialGroup) };
  };
  let palaces = 0, nobles = 0;
  for (const p of rows) {
    const loc = standAt(p.px, p.py);
    if (loc?.regionIndex !== SKYRIM || !loc.exterior.buildings.some((b) => b.buildingType === BUILDING_TYPES.Palace)) continue;
    const { questWorld } = await questLayerAt(world, { pixel: { x: p.px, y: p.py }, location: loc });
    assert.ok(loc.exterior.buildings.filter((b) => b.buildingType === BUILDING_TYPES.Palace).every((b) => b.factionId === RANDOM_RULER), `${loc.name}: a palace Random Ruler's, as the Bay's 319 are`);
    const now = poolOf(loc, createFactionRep(dict), questWorld);
    palaces += now.buildings.length;
    nobles += now.groups.length;
    assert.ok(now.groups.length > 0 && now.groups.every((g) => g === SOCIAL_GROUPS.Nobility), `${loc.name}: noble work (${now.groups})`);
    const was = createFactionRep(dict);
    for (const id of PROVINCE_FACTION_IDS) was.dict.delete(id);
    assert.ok(poolOf(loc, was, questWorld).groups.every((g) => g !== SOCIAL_GROUPS.Nobility), `${loc.name}: before, no noble's work`);
  }
  assert.equal(palaces, 8, 'Skyrim\'s eight palaces (Windhelm, Whiterun, Riften, Winterhold, Markarth, Falkreath, Dawnstar, Morthal)');
  assert.ok(nobles >= 16, `${nobles} nobles`);
});
