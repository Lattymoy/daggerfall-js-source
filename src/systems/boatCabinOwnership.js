// Legacy bank housing and sailing deeds resolve to the existing boat UID. This
// record is a link, never another deed, boat, cargo list or copy of stored items.
import { cabinUid, cabinShipType, cabinSceneName } from './sailingCabin.js';
import { SHIP_INTERIOR_MAP_IDS } from './banking.js';
import { BUILDING_KEY_0 } from './talk/talkTopics.js';
import { interiorSceneName } from './sceneCache.js';
import { BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from './comeSailAway/comeSailAwayItems.js';

export { readBankCabinLink } from '../net/boatIdentity.js';
import { readBankCabinLink } from '../net/boatIdentity.js';

export function bankCabinCandidates(type, boats = [], items = []) {
  if (![0, 1].includes(type)) return [];
  const byUid = new Map(), conflicts = new Set();
  const add = (uid, hull) => {
    if (!cabinUid(uid)) return;
    if (byUid.has(uid) && byUid.get(uid).hull !== hull) conflicts.add(uid);
    byUid.set(uid, { uid, hull });
  };
  for (const b of boats) if (!b.inside && !b.charter) add(b.uid, b.hull);   // AUDIT PASSAGE B1: a booked ship is her master's - the bank cabin moved into her was lost when she sailed on
  for (const it of items) if ([BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE].includes(it?.templateIndex)
    && Number.isInteger(it.message)) add(it.UID, Math.floor(it.message / 10));
  return [...byUid.values()].filter((b) => !conflicts.has(b.uid) && cabinShipType(b.hull) === type);
}

/** Auto-link only an unambiguous match. An explicit choice comes from the normal
 * boat menu. Never overwrite two separately furnished rooms or reassign a link. */
export function linkBankCabin(player, boats, items, chosenUid = null) {
  const prior = readBankCabinLink(player.boatCabinLink);
  if (prior && prior.type === player.ownedShip) return { status: 'linked', link: prior };
  const candidates = bankCabinCandidates(player.ownedShip, boats, items);
  const pick = chosenUid == null ? (candidates.length === 1 ? candidates[0] : null) : candidates.find((b) => b.uid === chosenUid);
  if (!pick) return { status: candidates.length > 1 ? 'choose' : 'unmatched', candidates };
  const cache = player.sceneCache;
  const oldKey = interiorSceneName(SHIP_INTERIOR_MAP_IDS[player.ownedShip], BUILDING_KEY_0);
  const key = cabinSceneName(pick.uid);
  if (cache?.scenes.has(oldKey) && cache.scenes.has(key)) return { status: 'conflict', candidates };
  // Move the existing record intact. Repeated migration finds the saved link and
  // does nothing; save/load, packing and relaunch keep the same destination key.
  if (cache?.scenes.has(oldKey)) { cache.scenes.set(key, cache.scenes.get(oldKey)); cache.scenes.delete(oldKey); }
  if (cache) { cache.permanent.delete(oldKey); cache.permanent.add(key); }
  const link = { v: 1, uid: pick.uid, hull: pick.hull, type: player.ownedShip };
  player.boatCabinLink = link;
  return { status: 'linked', link };
}
