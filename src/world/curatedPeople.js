// QUEST-AUDIT II TEMPLE-SUMMONER (bible/01-Overview/Quest-Audit-II.md; the owner, on the audit's findings: "Restore
// the summoner"): THE DAEDRA SUMMONER OF EVERY BEAUTIFUL VILLAGES TEMPLE.
//
// Every Daggerfall temple stands its deity's Daedra summoner (factions 456-498 - guildServices.js NPC_SERVICE's
// DaedraSummoning), the door to the temple's Daedra and their quests for a member of summoning rank. All 24 of
// Beautiful Villages' temple designs leave it out - 1,855 temples, some 60% of the world's, laid by the mod - while
// keeping every other service of the temple. Their rooms are the author's own (Kynareth's 277 models over two storeys
// against Daggerfall's 9), so Daggerfall's spot means nothing in them: each row stands Daggerfall's own summoner of the
// temple's deity at a floor spot MEASURED over the player's data (tools/templeSummoners.mjs, ARCH3D's geometry) - the
// walk's nearest clear floor to the temple's priest on the priest's floor, 1.5 m off every person, quest marker and
// entrance of the room, and taking no click meant for another (AUDIT QA2: at the 1.5 m bound beside the priest it took
// 5-24% of the clicks aimed at the temple's questor).
//
// Applied where a block becomes the port's (formats/worldDataReplacement.js getDFBlockReplacementData), once, for every
// consumer at once - the room's people, the guild's services, the questor pool's walk: a block laid under a listed name
// (the door's `servedName` - AUDIT QA2: a pack's JSON names itself, and TEMPASA2's says TEMPAS2.RMB) served by the
// listed pack, its record a temple of the listed deity with no summoner of its own (a later version of the pack that
// stands one keeps its own). Daggerfall's own blocks, and any other pack's, are as they were. A curation of the mod's
// data (Port-Ledger A, TEMPLE-SUMMONER); DFU with the mod stands none.

import { NPC_SERVICE } from '../systems/guildNpcServices.js';

export const TEMPLE_SUMMONER_VENDOR = 'beautiful-villages';
/** The Mages Guild's summoner - a DaedraSummoning person of no temple. */
const MAGES_GUILD_SUMMONER = 66;
/** The deities' summoners: the factions DaedraSummoning names (Services.GuildNpcServices), the Mages Guild's aside - read
 *  from the table, never a second literal of it (AUDIT QA2, ONE DFU MEMBER ONE EXPORT). */
export const SUMMONER_FACTIONS = Object.freeze(Object.entries(NPC_SERVICE)
  .filter(([id, kind]) => kind === 'DaedraSummoning' && Number(id) !== MAGES_GUILD_SUMMONER).map(([id]) => Number(id)));

const row = (block, record, deity, person) => Object.freeze({ vendor: TEMPLE_SUMMONER_VENDOR, block, record, deity, person: Object.freeze(person) });
/** The measured rows (tools/templeSummoners.mjs --check holds them to the measurement): the block, the temple's record,
 *  its deity (the building's faction) and the person - Daggerfall's summoner of that deity, at the measured spot. */
export const CURATED_TEMPLE_SUMMONERS = Object.freeze([
  row('TEMPASA0.RMB', 24, 21, { position: 8032, xPos: -90, yPos: 0, zPos: -226, factionID: 456, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASA1.RMB', 21, 21, { position: 8032, xPos: -90, yPos: 0, zPos: -226, factionID: 456, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASA2.RMB', 25, 21, { position: 8032, xPos: -90, yPos: 0, zPos: -232, factionID: 456, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASB0.RMB', 9, 22, { position: 49857, xPos: 97, yPos: 0, zPos: 224, factionID: 464, flags: 1, textureArchive: 181, textureRecord: 0 }),
  row('TEMPASC0.RMB', 9, 24, { position: 50600, xPos: -93, yPos: 0, zPos: 176, factionID: 470, flags: 33, textureArchive: 184, textureRecord: 29 }),
  row('TEMPASD0.RMB', 13, 26, { position: 49353, xPos: 97, yPos: 0, zPos: 314, factionID: 475, flags: 33, textureArchive: 181, textureRecord: 5 }),
  row('TEMPASD1.RMB', 11, 26, { position: 49353, xPos: 97, yPos: 0, zPos: 314, factionID: 475, flags: 33, textureArchive: 181, textureRecord: 5 }),
  row('TEMPASE0.RMB', 26, 29, { position: 8203, xPos: 82, yPos: 0, zPos: 146, factionID: 488, flags: 33, textureArchive: 184, textureRecord: 10 }),
  row('TEMPASF0.RMB', 12, 27, { position: 54605, xPos: 82, yPos: 0, zPos: 96, factionID: 482, flags: 1, textureArchive: 182, textureRecord: 40 }),
  row('TEMPASF1.RMB', 12, 27, { position: 54605, xPos: 82, yPos: 0, zPos: 96, factionID: 482, flags: 1, textureArchive: 182, textureRecord: 40 }),
  row('TEMPASG0.RMB', 18, 33, { position: 43356, xPos: 162, yPos: 0, zPos: -98, factionID: 492, flags: 33, textureArchive: 181, textureRecord: 1 }),
  row('TEMPASH0.RMB', 11, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASH1.RMB', 13, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASH2.RMB', 12, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASH3.RMB', 3, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPASH4.RMB', 4, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPBSA0.RMB', 9, 21, { position: 8032, xPos: -90, yPos: 0, zPos: -226, factionID: 456, flags: 1, textureArchive: 177, textureRecord: 4 }),
  row('TEMPBSB0.RMB', 9, 22, { position: 49857, xPos: 97, yPos: 0, zPos: 224, factionID: 464, flags: 1, textureArchive: 181, textureRecord: 0 }),
  row('TEMPBSC0.RMB', 12, 24, { position: 50600, xPos: -93, yPos: 0, zPos: 176, factionID: 470, flags: 33, textureArchive: 184, textureRecord: 29 }),
  row('TEMPBSD0.RMB', 8, 26, { position: 49353, xPos: 97, yPos: 0, zPos: 314, factionID: 475, flags: 33, textureArchive: 181, textureRecord: 5 }),
  row('TEMPBSE0.RMB', 7, 29, { position: 8203, xPos: 82, yPos: 0, zPos: 146, factionID: 488, flags: 33, textureArchive: 184, textureRecord: 10 }),
  row('TEMPBSF0.RMB', 12, 27, { position: 54605, xPos: 82, yPos: 0, zPos: 96, factionID: 482, flags: 1, textureArchive: 182, textureRecord: 40 }),
  row('TEMPBSG0.RMB', 10, 33, { position: 43356, xPos: 162, yPos: 0, zPos: -98, factionID: 492, flags: 33, textureArchive: 181, textureRecord: 1 }),
  row('TEMPBSH0.RMB', 8, 35, { position: 36089, xPos: -92, yPos: 0, zPos: 122, factionID: 498, flags: 1, textureArchive: 177, textureRecord: 4 }),
]);
const BY_BLOCK = new Map();
for (const r of CURATED_TEMPLE_SUMMONERS) (BY_BLOCK.get(r.block) ?? BY_BLOCK.set(r.block, []).get(r.block)).push(r);

/** The summoner rows a block of `name` served by `vendor` takes, or none. */
export const curatedSummonersOf = (name, vendor) => (vendor === TEMPLE_SUMMONER_VENDOR ? BY_BLOCK.get(name) ?? [] : []);

/**
 * Stand each listed temple's summoner in a block the door has just made (an RMB DFBlock, `fromWorldData`), served by
 * `vendor`: its record's interior takes the person (the reader's person record, its texture bitfield with it), the
 * people count with it - where the record is a temple of the row's deity holding no summoner already. Answers how many
 * stood.
 */
export function curateBlockPeople(dfBlock, vendor) {
  const rows = curatedSummonersOf(dfBlock?.servedName ?? dfBlock?.name, vendor);   // AUDIT QA2 B1: the name the town lays, not the JSON's own
  let stood = 0;
  for (const r of rows) {
    const sub = dfBlock.rmbBlock?.subRecords?.[r.record];
    const data = dfBlock.rmbBlock?.fldHeader?.buildingDataList?.[r.record];
    const interior = sub?.interior;
    if (!interior || data?.factionId !== r.deity) continue;
    const people = interior.blockPeopleRecords ?? (interior.blockPeopleRecords = []);
    if (people.some((p) => SUMMONER_FACTIONS.includes(p.factionID))) continue;
    const p = r.person;
    people.push({ ...p, textureBitfield: ((p.textureArchive << 7) | (p.textureRecord & 0x7f)) & 0xffff });
    if (interior.header) interior.header.numPeopleRecords = people.length;
    stood++;
  }
  return stood;
}
