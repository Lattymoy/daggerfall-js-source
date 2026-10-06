#!/usr/bin/env node
// QUEST-AUDIT II TEMPLE-SUMMONER: THE BEAUTIFUL VILLAGES TEMPLES' DAEDRA SUMMONERS, MEASURED - the rows the port's
// curation carries (src/world/curatedPeople.js CURATED_TEMPLE_SUMMONERS), made from the player's own data, as
// tools/townQuestMarkers.mjs made the quest-marker curation.
//
//   ARENA2_PATH=<the player's arena2> node tools/templeSummoners.mjs           print the rows
//   ARENA2_PATH=<...> node tools/templeSummoners.mjs --check                   compare them with the committed rows (exit 1)
//
// Every Daggerfall temple stands its deity's Daedra summoner (factions 456-498, DaedraSummoning in guildServices.js
// NPC_SERVICE); all 24 of Beautiful Villages' temple designs (TEMPAS*, TEMPBS*) leave it out, and they are new
// buildings - Kynareth's 277 models over two storeys against Daggerfall's 9 - so Daggerfall's spot means nothing in
// them. For each design this lays the interior out over the player's ARCH3D (townQuestMarkers.mjs interiorTriangles)
// and walks it from its entrance (walkFloor), and stands the summoner at the walk's nearest floor cell to the temple's
// priest (its Quests NPC, faction 240) with half a metre of the same floor all round (clearSpot), on THE RAY's floor,
// and 1.5 m clear of every person, quest marker (199.11, 199.18) and enter marker (199.8, 199.4) of the room - so a
// quest's person or thing never stands on it and the player never lands in it. The person is Daggerfall's own summoner
// of the temple's deity (its faction, flags and picture, and the record position that seeds its name - the next free
// one where a person of the room holds it), read from the
// deity's classic temple (TEMPAA?0; Beautiful Villages' Akatosh temples carry faction 26 where Daggerfall's carry 92 -
// both Akatosh). Nothing of ARENA2 or the packs is written; the numbers are a measurement of the player's data.
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { openTownData, interiorTriangles, walkFloor, rayVerdict, UNIT } from './townQuestMarkers.mjs';
import { SUMMONER_FACTIONS, TEMPLE_SUMMONER_VENDOR as VENDOR } from '../src/world/curatedPeople.js';

/** Beautiful Villages' temple faction where Daggerfall's names the same deity otherwise (Akatosh: 26 for 92). */
export const DEITY_ALIAS = Object.freeze({ 26: 92 });
/** The temple's priest - its Quests NPC (guildServices.js NPC_SERVICE 240). */
const PRIEST = 240;
/** How far the summoner stands from every person and marker of the room, metres. */
export const SUMMONER_CLEAR_M = 1.5;
const EDITOR = 199, SPAWN = 11, ITEM = 18, ENTER = 8, REST = 4;

/** Daggerfall's summoner of each deity: { [deityFaction]: person record } from its TEMPAA?0 temple (the first such block
 *  by name holding one) - BLOCKS.BSA's own block (readClassicBlock: past the world-data door, which serves the town
 *  mods' own temples under these names). */
export function classicSummoners(blocks) {
  const out = {};
  const names = [];
  for (let i = 0; i < blocks.count; i++) { const n = blocks.getBlockName(i); if (/^TEMPAA.0\.RMB$/.test(n)) names.push([n, i]); }
  names.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [, i] of names) {
    const b = blocks.readClassicBlock(i);
    b.rmbBlock.subRecords.forEach((sub, r) => {
      const deity = b.rmbBlock.fldHeader.buildingDataList[r]?.factionId;
      const p = (sub.interior?.blockPeopleRecords ?? []).find((q) => SUMMONER_FACTIONS.includes(q.factionID));
      if (p && out[deity] == null) out[deity] = { position: p.position, factionID: p.factionID, flags: p.flags, textureArchive: p.textureArchive, textureRecord: p.textureRecord };
    });
  }
  return out;
}

/** Each Beautiful Villages temple design's summoner row - { block, record, deity, person: { ...spot } } - sorted. */
export async function measureSummoners(data, { log = () => {} } = {}) {
  const { blocks, packs, getModel, packBlock } = data;
  const summoners = classicSummoners(blocks);
  const rows = [];
  for (const file of packs[VENDOR].names()) {
    const m = /^(TEMP[AB]S..\.RMB)\.json$/.exec(file);
    if (!m) continue;
    const name = m[1];
    const { dfBlock, index } = packBlock(VENDOR, name);
    for (let r = 0; r < dfBlock.rmbBlock.subRecords.length; r++) {
      const interior = dfBlock.rmbBlock.subRecords[r].interior;
      const people = interior.blockPeopleRecords ?? [];
      const priest = people.find((p) => p.factionID === PRIEST);
      if (!priest || people.some((p) => SUMMONER_FACTIONS.includes(p.factionID))) continue;
      const deity = dfBlock.rmbBlock.fldHeader.buildingDataList[r]?.factionId;
      const classic = summoners[DEITY_ALIAS[deity] ?? deity];
      if (!classic) throw new Error(`${name} #${r}: no Daggerfall summoner for deity ${deity}`);
      // the record position seeds the person's name and identity (staticNpc.js nameSeed): Daggerfall's own where it is
      // free in the room, else the next free one
      const used = new Set(people.map((p) => p.position));
      let position = classic.position;
      while (used.has(position)) position++;
      const { tris, layout } = await interiorTriangles(getModel, dfBlock, index, r);
      const metres = (f) => ({ x: f.xPos * UNIT, y: -f.yPos * UNIT, z: f.zPos * UNIT });
      const entries = layout.markers.filter((k) => k.type === ENTER || k.type === REST);
      const walk = walkFloor(tris, entries);
      const keepOff = [
        ...people.map(metres),
        ...interior.blockFlatObjectRecords.filter((f) => f.textureArchive === EDITOR && (f.textureRecord === SPAWN || f.textureRecord === ITEM)).map(metres),
        ...entries,
      ];
      const passes = (c) => rayVerdict(tris, c) === 'ok' && keepOff.every((k) => Math.hypot(c.x - k.x, c.z - k.z) >= SUMMONER_CLEAR_M || Math.abs(c.y - k.y) > 2);
      const spot = walk.clearSpot(metres(priest), passes);
      if (!spot) throw new Error(`${name} #${r}: no clear floor for the summoner`);
      const at = [Math.round(spot.x / UNIT), Math.round(-spot.y / UNIT) || 0, Math.round(spot.z / UNIT)];
      log(`${name} #${r} deity ${deity}: summoner ${classic.factionID} at ${at}`);
      rows.push({ block: name, record: r, deity, person: { position, xPos: at[0], yPos: at[1], zPos: at[2], factionID: classic.factionID, flags: classic.flags, textureArchive: classic.textureArchive, textureRecord: classic.textureRecord } });
    }
  }
  rows.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : a.record - b.record));
  return rows;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH not set'); process.exit(2); }
  const data = await openTownData(join(arena2));
  const rows = await measureSummoners(data, { log: (s) => console.error(s) });
  if (process.argv.includes('--check')) {
    const { CURATED_TEMPLE_SUMMONERS } = await import('../src/world/curatedPeople.js');
    const strip = (r) => ({ block: r.block, record: r.record, deity: r.deity, person: r.person });
    const want = JSON.stringify(rows), have = JSON.stringify(CURATED_TEMPLE_SUMMONERS.map(strip));
    if (want !== have) { console.error('the committed rows are not the measurement'); console.log(JSON.stringify(rows, null, 2)); process.exit(1); }
    console.log(`the ${rows.length} committed rows are the measurement`);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
}
