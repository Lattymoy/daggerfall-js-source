// @ts-check
// START2 (bible/06-Systems/Alternate-Starts-Arc.md section 8): THE STARTS' OWN ROWS OF Quests-Places - one a province's
// start, laid as a mod lays its own (quest/tables.js addIntoQuestTables, Roleplay & Realism's AddIntoTable; the
// questlines' rows' shape, questlines/qlActions.js QL_PLACE_ROWS), keyed so each is laid once. A row's p1 is its start's
// site id (starts.js startSiteId) - no MAPS.BSA place: quest/place.js asks the world for the dungeon it names
// (`startSiteOfId`, the world host's start host: the province's own dungeon its story wants, near its capital). p2 is a
// dungeon's ordinary 0x0001 (no fixed dungeon's magic number, 0xfa..), p3 DFU's -1. Imported by quest/place.js, so every
// parse of a Place reads the table with them.
import { addIntoQuestTables } from '../quest/tables.js';
import { STARTS, startSiteId } from './starts.js';

export const START_PLACE_ROWS = Object.freeze(
  STARTS.filter((s) => s.site).map((s) => `${s.site}, 0x${startSiteId(s).toString(16)}, 0x0001, -1`),
);
addIntoQuestTables({ places: START_PLACE_ROWS.map((line) => ({ line, unlessKey: line.split(',')[0].trim() })) });
