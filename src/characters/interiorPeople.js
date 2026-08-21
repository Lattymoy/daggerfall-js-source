// Interior people flats (Characters C1).
// 1:1 translation of DaggerfallInterior.AddPeople's DATA layer (MIT,
// Daggerfall Workshop). Verbatim:
//   - Position: (XPos, -YPos, ZPos) * GlobalScale. DFU spawns the
//     billboard pivot at that point then shifts +size.y/2, i.e. the
//     raw position is the BASE - exactly the contract our billboard
//     batches take, so consumers pass the position through untouched.
//   - Every person carries the StaticNPC layout inputs: textureArchive,
//     textureRecord, factionID, flags, and the raw block-record
//     position triple (DFU's position hash feeds from these).
//   - Visibility gates from AddPeople's tail (house ownership, shop
//     open hours, building-type open rules, GuildHall anytime-access,
//     the TG/DB House2 member rule) depend on Systems (banking, guilds,
//     clock rules, quests) - the flags/factionID needed to evaluate
//     them ride on each person here; the gates themselves are routed
//     to the Systems arc (Port-Ledger C). C1 spawns everyone.

import { GLOBAL_SCALE } from '../world/meshReader.js';

/**
 * Collect the people of one building interior.
 * @param recordData - dfBlock.rmbBlock.subRecords[recordIndex]
 * @returns {Array<{x,y,z,textureArchive,textureRecord,factionID,flags,
 *   rawX,rawY,rawZ}>} base-positioned people (interior-local frame;
 *   hosts parent exactly like flats).
 */
export function collectInteriorPeople(recordData) {
  const out = [];
  for (const obj of recordData.interior.blockPeopleRecords) {
    out.push({
      x: obj.xPos * GLOBAL_SCALE,
      y: -obj.yPos * GLOBAL_SCALE,
      z: obj.zPos * GLOBAL_SCALE,
      textureArchive: obj.textureArchive,
      textureRecord: obj.textureRecord,
      factionID: obj.factionID,
      flags: obj.flags,
      rawX: obj.xPos, rawY: obj.yPos, rawZ: obj.zPos,
      // Q4-v: the record's stream position - DFU's obj.Position, the
      // StaticNPC nameSeed's identity component.
      position: obj.position,
    });
  }
  return out;
}
