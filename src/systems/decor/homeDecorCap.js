// @ts-check
// DECOR-ROOMY (FIELD BUGS 2026-10-29f; #feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 6: "Rise the decoration limit for bigger houses ... Some houses, for example in Sentinel, are REALLY WIDE").
// An online home's room holds the cap the account service says with its list (net/decorLaw.js decorCapOf, by the ground
// its price was set from); a home bought before the service kept its ground has its owner's client name it once - the
// same measure, which the service holds to the price - and holds the larger cap from then on.
import { decorCapOf } from '../../net/decorLaw.js';

/** @type {{ key: string, cap: number } | null} */
let room = null;
/** AUDIT FB1029f A6: the rooms whose ground the service refused this session - a home priced by another law (an arena
 *  move's, a home from before HOME-PRICE) never agrees, and is not asked again every visit. */
const refused = new Set();
const keyOf = (mapId, buildingKey) => `${mapId}:${buildingKey}`;

/** The service's word on a room as its list stands: its cap; and, where it keeps no ground yet and the room is the
 *  caller's own (`ground` its measure, else null), the ground named once - the cap the answer holds noted with it. */
export function noteHomeDecorList(mapId, buildingKey, data, ground, townBlocks, homeDecor, character) {
  const key = keyOf(mapId, buildingKey);
  room = Number.isSafeInteger(data?.cap) && data.cap > 0 ? { key, cap: data.cap } : null;
  if (data?.measured !== false || !(ground > 0) || typeof homeDecor?.use !== 'function' || refused.has(key)) return;
  const blocks = Number.isSafeInteger(townBlocks) && townBlocks >= 0 ? townBlocks : 0;
  Promise.resolve(homeDecor.use({ mapId, buildingKey, character, op: 'ground', ground, townBlocks: blocks })).then(
    (res) => {
      if (res?.ok === false) refused.add(key);
      if (res?.ok && room?.key === key && typeof res.data?.ground === 'number')
        room = { key, cap: decorCapOf(res.data.ground) };
    },
    () => {},
  );
}
/** The cap the service said this room holds, or null (another room, or a service from before DECOR-ROOMY). */
export const homeDecorCap = (mapId, buildingKey) => (room && room.key === keyOf(mapId, buildingKey) ? room.cap : null);
