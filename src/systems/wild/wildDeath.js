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
// SO, EITHER DEATH (FOE-KEEPS, 2026-10-24 - the owner: "I dont want people to lose everything they have"; asked, "Only
// PvP deaths drop": a death to a foe now drops nothing, and pays the usual tenth at the rise):
//   KEPT, always: the consumables the owner named and their kin - potions, light sources (a torch, a lantern, a candle),
//     the camp's kit and its fire (Climates & Calories' gear, food and water), the rest consumables (REST6), arrows and
//     every other ammunition, bandages - and everything that may never change hands (a quest's item, a summoned or
//     bound piece, a boat's deed or parts, the Materials Bag, a vehicle, a deed, the spellbook, the wallet and the Embers
//     and Shards it holds - the trade's refusals and the decor's kept-back list, read, not rewritten).
//   DROPPED, AT ANOTHER PLAYER'S HAND ALONE: every other thing in the bag and in the cart - into the room's remains (net/wild/wildLaw.js), where anyone may
//     take it for ten minutes. A letter of credit too (LETTERS-DROP, 2026-10-09), ahead of the decor's kept-back list.
//     CART-AWAY (Mac, 2026-10-15: "if its parked outside the zone nothing should be lost"): the cart's only while the
//     wagon is with them - parked off the zone, stabled or none, it keeps every piece and its coin (systems/wild/wildCart.js).
//     COMPANION-DROP (2026-10-19, the owner: "Bag drops; no send-off in zone"): and every companion's at their side - a
//     crew hand's pack, a sworn revenant's pack and kit (wildDropLaw.js wildPacks) - as the cart is; and none is sent off
//     from inside the zone (crewCompanions.js, revenantCompanions.js).
//   WORN: kept on a death to a foe. On a death at another player's hand the killer may take ONE worn piece the same
//     rules let go (`wornOffer`) - the fallen's own game gives it (net/wild/wildFight.js).
// The purse: a kill drops a tenth of it into the remains in place of the death penalty (WILD GOLD, wildDropLaw.js
// takeWildGold); any other death pays the penalty (systems/deathPenalty.js).
// ═══════════════════════════════════════════════════════════════════
import { WILD_ITEMS_MAX } from '../../net/wire.js';
import { wildCartWord } from './wildCart.js';
import { WILD_FALL_PACKS, WILD_FALL_LETTERS } from './wildDropLaw.js';
import { wildInside, wildNear, wildRingAt } from './wildZone.js';   // AUDIT FOE-KEEPS E1: the rise's towns

// THE LAW - INT9: its home is systems/wild/wildDropLaw.js (a leaf the account Worker bundles: the service takes a death's drop
// off the record), re-exported here
export { WILD_NEVER_GROUPS, keptOnWildDeath, wildCanLose, takeWildDrop, WILD_GOLD_LOSS, takeWildGold, wornOffer, wildRecord, takeWildDeath, wildPickOf, wildDropCandidates, wildCartRecordOf, wildCartMayBeAway, wildTookOf, wildTakeTook, WILD_REVENANTS_MAX, wildSwornAtSide, WILD_PACK, wildPacks, wildPacksOf, WILD_FALL_PACKS, wildTakesPacks } from './wildDropLaw.js';

/** THE FALLEN'S OWN WORDS on /v1/wild/fall (world.js wildTakeDrop), beside its receipt (FOE-KEEPS: a foe's death asks none), its record's `at`, its
 *  room and its relay's `collect`: CART-AWAY's wagon (wildCart.js wildCartWord - `on` the Horse Cart mod, `rec` its record,
 *  `mask` the zone's) and COMPANION-DROP's `packs` 1 - this game takes a companion's piece out of his own pack and his
 *  coin's share out of his coin (wildTakeTook's `packs`, world.js wildDropTaken), so the service may hand it a take of the
 *  packs (WILD_FALL_PACKS; AUDIT FB1019f B2: a game from before the word, which would misapply one, is refused it).
 *  @param {boolean} on @param {any} rec @param {any} mask */
export const wildFallWords = (on, rec, mask) => ({ ...wildCartWord(on, rec, mask), packs: WILD_FALL_PACKS, letters: WILD_FALL_LETTERS });   // AUDIT FOE-KEEPS LETTERS-TENTH: this game lowers a letter by its share

/** AUDIT INT9: DID MY DROP TAKE ANYTHING OF MINE - a piece out of a list (`out`, wildTakeTook's answer) or a share of coin:
 *  the purse's, the cart's, or (COMPANION-DROP, AUDIT FB1019f B5) a pack's at my side (`gold.packs`). A receipt that finds
 *  me risen says so when it did (world.js wildDropTaken, `WILD_TEXT.dropLate`): a companion's coin alone is my loss too -
 *  AUDIT FOE-KEEPS LETTERS-TENTH: and a letter's share (`gold.letters`).
 *  @param {any[]} out @param {{ purse?: number, cart?: number, packs?: Record<string, number>, letters?: Record<string, number> } | null | undefined} gold */
export const wildTookAny = (out, gold) => out.length > 0 || (gold?.purse ?? 0) > 0 || (gold?.cart ?? 0) > 0 || Object.values(gold?.packs ?? {}).some((n) => n > 0) || Object.values(gold?.letters ?? {}).some((n) => n > 0);   // LETTERS-TENTH: a letter's share alone is said too

/** A list cut into the wire's chunks. */
export function wildChunks(list, size = WILD_ITEMS_MAX, bytes = Infinity) {
  // INT9 (AUDIT): and `bytes` of their JSON a chunk - a frame of sixteen heavy records was past the wire's own bound
  // (net/wire.js WILD_DATA_MAX), refused at the sender, and the deposit never left
  const out = [];
  let cur = [], n = 2;
  for (const it of list) {
    const w = JSON.stringify(it).length + 1;
    if (cur.length && (cur.length >= size || n + w > bytes)) { out.push(cur); cur = []; n = 2; }
    cur.push(it); n += w;
  }
  if (cur.length) out.push(cur);
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

/** THE RISE'S TOWNS in the order they are asked (world.js wildRiseSite: the first `nearestSafeLocationAnywhere` finds) -
 *  `mask` the zone's, `px` where the body fell, `inDungeon` a hall's death, `kill` a death at another player's hand.
 *  WILD1 (the owner: "when the players respawns in a town near the zone the cart comes with him"): a kill rises at the
 *  nearest town or temple OUTSIDE the zone and its band. PVPDUNGEONS (the owner: "Dying in a dungeon respawns you in city
 *  near the dungeon"): a hall's death in the zone at the town nearest the hall. AUDIT FOE-KEEPS E1 (the owner, 2026-10-24,
 *  asked: "Rise inside the zone"): since FOE-KEEPS a death to a foe drops nothing, so its rise outside made dying the
 *  zone's free way out - where fast travel out is refused and the walk out an hour and more; it rises at the nearest town
 *  or temple INSIDE the zone in the ring it fell in, else anywhere inside, else outside as a kill does.
 *  @param {any} mask @param {{ x: number, y: number }} px @param {{ inDungeon?: boolean, kill?: boolean }} [o]
 *  @returns {((hit: any) => boolean)[]} */
export function wildRisePicks(mask, px, { inDungeon = false, kill = true } = {}) {
  const town = (/** @type {any} */ hit) => hit.kind === 'city' || hit.kind === 'temple';
  const out = (/** @type {any} */ hit) => town(hit) && !(mask && wildNear(mask, hit.mapPixel.x, hit.mapPixel.y));
  const inside = !!mask && wildInside(mask, px.x, px.y);
  if (inside && inDungeon) return [(hit) => hit.kind === 'city', out];
  if (inside && !kill) {
    const ring = wildRingAt(px.x, px.y, mask);
    const inZone = (/** @type {any} */ hit) => town(hit) && wildInside(mask, hit.mapPixel.x, hit.mapPixel.y);
    return [(hit) => inZone(hit) && wildRingAt(hit.mapPixel.x, hit.mapPixel.y, mask) === ring, inZone, out];
  }
  return [out];
}
