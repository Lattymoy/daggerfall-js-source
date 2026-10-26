// @ts-check
// GOLD-WIRE (FIELD BUGS 2026-10-25b, bible/01-Overview/bugs/Field-Bugs-2026-10-25b.md): THE LISTS THE ROOM'S WORD CARRIES.
//
// A room's container - a dungeon's (scenes/roomLootHost.js) and a building's cupboard (world/interior/interiorRoomLoot.js) -
// is composed in place into the list its window shows, and that list alone is read for the takes and the puts the room
// is told. Every piece put in it rides the room's word, where no stack passes LOOT_STACK_MAX (systems/loot/loot.js), so a
// gold drop asks here before it lays coin in the list (systems/item/itemTransfer.js planDropGold). A home's and an owned
// house's cupboards keep no room (HOME1, world/interior/interiorShared.js mintInteriorShared) and are never marked; nor is
// the ground, the wagon, the bag or a companion's pack.
//
// A leaf: the windows' planner reaches it without the room's modules, whose graph reaches back to the windows. Weakly
// held - a list gone is a mark gone, and a list some load replaced is no list the room reads, so it carries no mark.

let _carried = new WeakSet();

/** Mark `list` as one the room's word carries. Answers the list. */
export const markRoomCarried = (/** @type {any[]} */ list) => {
  if (Array.isArray(list)) _carried.add(list);
  return list;
};

/** Whether the room's word carries `list` - what a piece put in it rides. */
export const isRoomCarried = (/** @type {unknown} */ list) => Array.isArray(list) && _carried.has(list);
