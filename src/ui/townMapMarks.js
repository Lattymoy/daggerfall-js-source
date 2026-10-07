// TOWN-MARKS (2026-09-29, Mac: "For the notice boards in town. Can we physically mark them on the town map, and also mark
// owned player housing"; bible/10-UI/Enhanced-Maps-Arc.md TOWN-MARKS): THE TOWN MAP'S TWO NEW MARKS, as DATA - which boards and
// which houses, and what each is called. The ink is ui/inkTown.js's (paintBoardMark, paintHomeMark); the sheet
// (ui/townSheet.js) carries them into sheet space and answers them under the pointer; the host (scenes/world.js
// toggleExteriorAutomap) hands them in through the door (ui/townMapDoor.js). The enhanced town map only - the classic
// exterior automap is DFU's own window and draws DFU's marks alone, as DISC23-A left the party's bodies.
//
//   A NOTICE BOARD is a town board (model 41739, world/rmbLayout.js isBulletinBoard) that is not one of its bounty
//   boards (systems/bountyBoard.js questBoardIndices), while the Notice Board is open (NOTICE1: online, BOARD_OPEN) -
//   the same boards noticeCountPoints floats a town's unread count over. It stands in the street, so its mark stands
//   where it does: the middle of its box, in the location's own frame (metres, the frame the player's `local` is in).
//
//   A PLAYER'S HOUSING is a building a player owns in this town: an online home (HOME1, systems/onlineHomes.js, the
//   service's registry - the player's own, and every other player's, named as its door names it: homeDoorTitle), or
//   the house the character bought at a bank (DFU's one house a region, systems/banking.js - on the character's own
//   slot for this town's region, and only in THIS town: a building key is a location's own numbering, so the slot's
//   map id must be this town's too - isHouseOwned asks the region alone because its callers stand at the door).
import { homeDoorTitle } from '../systems/onlineHomes.js';
import { unseenText } from '../net/boardLaw.js';

/** The board's name under the pointer. */
export const TOWN_BOARD_LABEL = 'Notice Board';
/** The name under the pointer of the house the character bought at a bank. */
export const TOWN_HOUSE_LABEL = 'Your house';
/** How near a pointer must come to a mark, in paper pixels - the party's reach (townSheet PARTY_REACH). */
export const TOWN_MARK_REACH = 12;

/** A Notice Board's name, with its town's unread count when there is one ("Notice Board: 3 new"). */
export const boardMarkLabel = (unseen = 0) => (unseen > 0 ? `${TOWN_BOARD_LABEL}: ${unseenText(unseen)}` : TOWN_BOARD_LABEL);

const finite3 = (v) => Array.isArray(v) && v.length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);

/** The boards the host hands, read: `{ feet: [x, y, z] (location metres), label }` - a row with no place is dropped. */
export function readTownBoards(fn) {
  let rows = [];
  try { rows = typeof fn === 'function' ? fn() : []; } catch { rows = []; }
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => finite3(r?.feet))
    .map((r) => ({ feet: [r.feet[0], r.feet[1], r.feet[2]], label: typeof r.label === 'string' && r.label ? r.label : TOWN_BOARD_LABEL }));
}

/** The homes the host hands, read: `{ buildingKey, own, label }` - a row with no building is dropped. */
export function readTownHomes(fn) {
  let rows = [];
  try { rows = typeof fn === 'function' ? fn() : []; } catch { rows = []; }
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => Number.isSafeInteger(r?.buildingKey) && r.buildingKey > 0 && typeof r.label === 'string')
    .map((r) => ({ buildingKey: r.buildingKey, own: r.own === true, label: r.label }));
}

/**
 * The town's Notice Boards, off the host's record of its map pixel (`p`: scenes/world.js's built pixel - its `boards`,
 * pixel-local boxes [minX, minY, minZ, maxX, maxY, maxZ], and its `locOrigin`): every board that is not a bounty board
 * (`bountyAt`, the indices questBoardIndices took), at the middle of its box and at its foot, in the location's frame.
 */
export function townBoardRows(p, bountyAt, unseen = 0) {
  const o = p?.locOrigin;
  if (!Array.isArray(p?.boards) || !finite3(o)) return [];
  const label = boardMarkLabel(unseen);
  const out = [];
  p.boards.forEach((b, i) => {
    const box = b?.box;
    if (bountyAt?.has?.(i) || !Array.isArray(box) || box.length < 6) return;
    out.push({ feet: [(box[0] + box[3]) / 2 - o[0], box[1] - o[1], (box[2] + box[5]) / 2 - o[2]], label });
  });
  return out;
}

/**
 * The town's player housing, one row a building: `buildings` (world/buildingSummaries.js's rows for this town), its
 * `mapId`, the character's bank-bought `houses` slot for `regionIndex`, and `homeAt(mapId, buildingKey)` (the online
 * registry, or null offline). An online home answers first; the bank's house only where no home stands.
 */
export function townHomeRows({ buildings = [], mapId, regionIndex, houses = null, homeAt = null }) {
  if (!Number.isFinite(Number(mapId))) return [];
  const id = Number(mapId) >>> 0;
  const slot = houses?.[regionIndex];
  const bought = slot?.buildingKey > 0 && Number.isFinite(Number(slot.mapId)) && (Number(slot.mapId) >>> 0) === id ? slot.buildingKey : 0;
  const out = [];
  for (const b of buildings ?? []) {
    const key = b?.buildingKey;
    if (!(key > 0)) continue;
    const home = homeAt ? homeAt(id, key) : null;
    if (home) out.push({ buildingKey: key, own: home.own === true, label: homeDoorTitle(home) });
    else if (key === bought) out.push({ buildingKey: key, own: true, label: TOWN_HOUSE_LABEL });
  }
  return out;
}
