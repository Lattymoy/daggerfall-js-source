// @ts-check
// FIELD BUGS 2026-10-09e - HILL-HOUSE (bible/01-Overview/Field-Bugs-2026-10-09e.md; the Discord's "Missing quest location
// house - An Item On Loan": "The residence I'm supposed to go to is either missing or under a hill"): A BUILDING THE
// PACK'S OWN HILLS BURY, STOOD ON CLEAR GROUND OF ITS BLOCK.
//
// Beautiful Villages' TEMPASD1 - the temple design it lays in Akatosh's standalone temples, the Gentle Redeemer of
// Akatosh in Wayrest among them - stands its House2 #6 (model 159) inside two of the author's hills (52458 and 52713):
// 10.5-11.2 m of the pack's own meshes over its door, 10.1-10.4 m of the port's stand-ins (AUDIT FB1005 T3 measured it
// and carried it, the one walled door of both packs' 10,000-odd). DFU with the pack buries it too. It is a House2 - a
// house a quest seats its person in (Person.cs AssignHomeTown) - so a quest could send the player to a house no one can
// see or enter, and the town map lettered its name over the hill's ground.
//
// The house is moved, not the hill: each row stands one record of one pack block at a MEASURED spot of the same block -
// the nearest to the author's on the block's ground, its footprint 1.5 m clear of every other piece, hill and flat of
// the block and of the block's edge, its door and the four metres before it clear of every hill and piece
// (tools/curatedPlacements.mjs measures it; test/fb1009e_hillhouse.test.js holds the row to the measurement on the
// player's data) - with the author's own facing. Its RECORD is kept, so DFU's building key - (block x << 16) +
// (block y << 8) + record - is the same house's: a quest made before this stands its person in the same house, now
// standing where the player can reach it. The automap's bytes are stamped with the house's type at its new footprint, so
// the town map draws it where its name is lettered; the hill's bytes at the old spot are the author's.
//
// Applied where a block becomes the port's (formats/worldDataReplacement.js getDFBlockReplacementData), once, for every
// consumer at once - the layout, the doors, the town map, the quest's building - beside the temple summoners
// (world/curatedPeople.js), under the same two keys: the block's name as the town lays it and the pack that served it.
// A later version of the pack that moves the house itself keeps its own: a row applies only to a record that stands
// where the row found it. A curation of the mod's data (Port-Ledger A, HILL-HOUSE).

export const HILL_HOUSE_VENDOR = 'beautiful-villages';

/** One record moved: `from` where the pack stands it (xPos, zPos, yRotation - RMB block units and Daggerfall's angle),
 *  `to` the measured spot, `model` its first exterior model, `automap` the 64 x 64 automap cells its footprint covers
 *  at `to` ([col0, row0, col1, row1], inclusive - a cell is 64 block units, the row a zPos's). */
const row = (block, record, model, from, to, automap) => Object.freeze({
  vendor: HILL_HOUSE_VENDOR, block, record, model, from: Object.freeze(from), to: Object.freeze(to), automap: Object.freeze(automap),
});
export const CURATED_PLACEMENTS = Object.freeze([
  row('TEMPASD1.RMB', 6, 159, { xPos: 2816, zPos: 2176, yRotation: 0 }, { xPos: 3808, zPos: 2176, yRotation: 0 }, [57, 29, 61, 38]),
]);

/** The rows a block of `name` served by `vendor` takes, or none. */
export const curatedPlacementsOf = (name, vendor) => CURATED_PLACEMENTS.filter((r) => r.vendor === vendor && r.block === name);

/**
 * Stand each listed record of a block the door has just made (an RMB DFBlock, `fromWorldData`), served by `vendor`, at
 * its row's spot: the subrecord and the FLD header's position moved, the automap stamped with the building's type at its
 * new footprint - where the record stands at the row's `from` with the row's model. Answers how many moved.
 */
export function curateBlockPlacements(dfBlock, vendor) {
  const rows = curatedPlacementsOf(dfBlock?.servedName ?? dfBlock?.name, vendor);
  let moved = 0;
  for (const r of rows) {
    const sub = dfBlock.rmbBlock?.subRecords?.[r.record];
    const first = sub?.exterior?.block3dObjectRecords?.[0];
    if (!sub || sub.xPos !== r.from.xPos || sub.zPos !== r.from.zPos || sub.yRotation !== r.from.yRotation || first?.modelIdNum !== r.model) continue;
    sub.xPos = r.to.xPos; sub.zPos = r.to.zPos; sub.yRotation = r.to.yRotation;
    const fh = dfBlock.rmbBlock.fldHeader;
    const pos = fh?.blockPositions?.[r.record];
    if (pos) { pos.xPos = r.to.xPos; pos.zPos = r.to.zPos; pos.yRotation = r.to.yRotation; }
    const type = fh?.buildingDataList?.[r.record]?.buildingType;
    const map = fh?.autoMapData;
    if (map && Number.isInteger(type) && type >= 0) {
      const [c0, r0, c1, r1] = r.automap;
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) map[y * 64 + x] = type + 1;   // the automap's byte: the type plus one
    }
    moved++;
  }
  return moved;
}
