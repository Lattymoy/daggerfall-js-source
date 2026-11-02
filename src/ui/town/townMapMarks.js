// TOWN-MARKS (2026-09-29, Mac: "For the notice boards in town. Can we physically mark them on the town map, and also mark
// owned player housing"; bible/10-UI/Enhanced-Maps-Arc.md TOWN-MARKS): THE TOWN MAP'S MARK OF A PLAYER'S HOUSE, as DATA -
// which houses, and what each is called. The ink is ui/ink/inkTown.js's (paintHomeMark); the sheet (ui/town/townSheet.js)
// carries them into sheet space and answers them under the pointer; the host (scenes/exteriorAutomapToggle.js townHere)
// hands them in through the door (ui/town/townMapDoor.js). The enhanced town map only - the classic exterior automap is
// DFU's own window and draws DFU's marks alone. NOTICE-PANEL (2026-10-29): the Notice Board's mark went with the boards.
//
//   A PLAYER'S HOUSING is a building a player owns in this town: an online home (HOME1, systems/online/onlineHomes.js, the
//   service's registry - the player's own, and every other player's, named as its door names it: homeDoorTitle), or
//   the house the character bought at a bank (DFU's one house a region, systems/banking.js - on the character's own
//   slot for this town's region, and only in THIS town: a building key is a location's own numbering, so the slot's
//   map id must be this town's too - isHouseOwned asks the region alone because its callers stand at the door).
import { homeDoorTitle } from '../../systems/online/onlineHomes.js';
import { regionDeedsOf } from '../../net/homeLaw.js'; // HOUSES-3: a region's three deeds
import { t } from '../../systems/textManager.js'; // VENDOR-HOUSES: the trader's word in the player's language

/** The name under the pointer of the house the character bought at a bank. */
export const TOWN_HOUSE_LABEL = 'Your house';
/** VENDOR-HOUSES: a trader's house says so under the pointer (the waypoint's own label already does). */
const vendorTitle = (home) =>
  home.vendor === true && home.waypoint !== true
    ? t('town.home.trader', '{home} - trader', { home: homeDoorTitle(home) })
    : homeDoorTitle(home);
/** How near a pointer must come to a mark, in paper pixels - the party's reach (townSheet PARTY_REACH). */
export const TOWN_MARK_REACH = 12;

/** The homes the host hands, read: `{ buildingKey, own, label }` (and `vendor` on a trader's house - VENDOR-HOUSES) - a
 *  row with no building is dropped. */
export function readTownHomes(fn) {
  let rows = [];
  try {
    rows = typeof fn === 'function' ? fn() : [];
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => Number.isSafeInteger(r?.buildingKey) && r.buildingKey > 0 && typeof r.label === 'string')
    .map((r) => ({
      buildingKey: r.buildingKey,
      own: r.own === true,
      ...(r.vendor === true ? { vendor: true } : {}),
      label: r.label,
    }));
}

/**
 * The town's player housing, one row a building: `buildings` (world/buildingSummaries.js's rows for this town), its
 * `mapId`, the character's bank-bought `houses` deeds for `regionIndex` (HOUSES-3: three a region, net/homeLaw.js
 * regionDeedsOf), and `homeAt(mapId, buildingKey)` (the online registry, or null offline). An online home answers first;
 * the bank's house only where no home stands.
 */
export function townHomeRows({ buildings = [], mapId, regionIndex, houses = null, homeAt = null }) {
  if (!Number.isFinite(Number(mapId))) return [];
  const id = Number(mapId) >>> 0;
  const bought = new Set(
    regionDeedsOf(houses, regionIndex)
      .filter((d) => Number.isFinite(Number(d.mapId)) && Number(d.mapId) >>> 0 === id)
      .map((d) => d.buildingKey),
  );
  const out = [];
  for (const b of buildings ?? []) {
    const key = b?.buildingKey;
    if (!(key > 0)) continue;
    const home = homeAt ? homeAt(id, key) : null;
    if (home)
      out.push({
        buildingKey: key,
        own: home.own === true,
        ...(home.vendor === true ? { vendor: true } : {}),
        label: vendorTitle(home),
      });
    else if (bought.has(key)) out.push({ buildingKey: key, own: true, label: TOWN_HOUSE_LABEL });
  }
  return out;
}
