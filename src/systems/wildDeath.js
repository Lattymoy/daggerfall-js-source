// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - A DEATH IN THE OPEN ZONE: WHAT STAYS, WHAT DROPS, WHAT A KILLER MAY TAKE
// (bible/11-Multiplayer/Wild-Zone.md).
//
// The owner, of a player's death at another's hand: "cant get looted all of the items they have, except campfires,
// torches, potions etc ... players can choose 1 item of the equipped ones the killed player has"; asked what else is
// lost, "the bags" too (the mob death's law) "and the players can take the cart in to the zone and it also loses all
// loot in it". And of a death to a foe: "drops the loot he has in his bags ... (you dont drop your equipped stuff)".
//
// SO, EITHER DEATH:
//   KEPT, always: the consumables the owner named and their kin - potions, light sources (a torch, a lantern, a candle),
//     the camp's kit and its fire (Climates & Calories' gear, food and water), the rest consumables (REST6), arrows and
//     every other ammunition, bandages - and everything that may never change hands (a quest's item, a summoned or
//     bound piece, a boat's deed or parts, the Materials Bag, a vehicle, a deed, the spellbook, the wallet and the Embers
//     and Shards it holds - the trade's refusals and the decor's kept-back list, read, not rewritten).
//   DROPPED: every other thing in the bag and in the cart - into the room's remains (net/wildLaw.js), where anyone may
//     take it for ten minutes. A letter of credit too (LETTERS-DROP, 2026-10-09), ahead of the decor's kept-back list.
//   WORN: kept on a death to a foe. On a death at another player's hand the killer may take ONE worn piece the same
//     rules let go (`wornOffer`) - the fallen's own game gives it (net/wildFight.js).
// The purse is the death penalty's (systems/deathPenalty.js) and unchanged.
// ═══════════════════════════════════════════════════════════════════
import { WILD_ITEMS_MAX } from '../net/wire.js';

// THE LAW - INT9: its home is systems/wildDropLaw.js (a leaf the account Worker bundles: the service takes a death's drop
// off the record), re-exported here
export { WILD_NEVER_GROUPS, keptOnWildDeath, wildCanLose, takeWildDrop, WILD_GOLD_LOSS, takeWildGold, wornOffer, wildRecord, takeWildDeath } from './wildDropLaw.js';

/** A list cut into the wire's chunks. */
export function wildChunks(list, size = WILD_ITEMS_MAX) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * THE RESPAWN'S CLEAR GROUND (the owner: "make sure it doesnt stuck the player when he spawns and other players"): a
 * spot near `centre` (a scene point, the start marker) for a player and the team that follows them - no other body
 * within `room` metres, and ground behind it (the way the horse and the wagon stand) that `clear(from, yaw)` says is
 * open. Rings of `step` metres out to `reach`, eight bearings a ring, the centre first. Answers `{ pos, yaw }`, or the
 * centre itself when nothing better was found (a respawn is never refused).
 * @param {number[]} centre
 * @param {{ bodies?: number[][], clear?: (from: number[], yaw: number) => boolean, yaw?: number, room?: number, step?: number, reach?: number }} [opts]
 * @returns {{ pos: number[], yaw: number }}
 */
export function wildSpawnSpot(centre, { bodies = [], clear = () => true, yaw = 0, room = 2.5, step = 2, reach = 8 } = {}) {
  const free = (p) => bodies.every((b) => !b || Math.hypot(b[0] - p[0], b[2] - p[2]) >= room);
  for (let r = 0; r <= reach; r += step) {
    const n = r === 0 ? 1 : 8;
    for (let k = 0; k < n; k++) {
      const a = yaw + (k * Math.PI * 2) / n;
      const p = [centre[0] + Math.sin(a) * r, centre[1], centre[2] + Math.cos(a) * r];
      if (!free(p)) continue;
      for (let t = 0; t < 4; t++) {
        const face = yaw + (t * Math.PI) / 2;
        if (clear(p, face)) return { pos: p, yaw: face };
      }
    }
  }
  return { pos: [centre[0], centre[1], centre[2]], yaw };
}
