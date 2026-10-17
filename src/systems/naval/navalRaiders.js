// @ts-check
// NAV-R (2026-09-28, Mac, of main's Overworld raiders: "Definitely want them to appear as ships") - WARM ASHES'
// RAIDERS, STOOD AS SHIPS OF THE SEA. Main's OWS3 sails one raider a cell a life on the Overworld (systems/seaRaiders.js:
// seeded, so every player sees the same sail at the same minute) and drew none in play - alongside, the mod's raid
// boarded a ship the player was carried onto. Here a raider near a player at sea IS a pirate of the sea: its seed's own
// class and name, sailing its seeded course (steered for where that course is RAIDER_LEAD_S on, so the sail on the map is
// the sail met on the water) until its lookout (seaRaiders.js raiderSight: a day's 1,000 m, a night's 500) sights a
// boat - then a captain like any pirate's (systems/naval/navalAI.js): the broadsides, the grapple, and Warm Ashes' own
// raid on the boarded deck (WAQ_SHIP_SMALLRAID, scenes/naval/navalHost.js beginFight). Sunk, taken, struck or given the slip,
// it is SPENT for its life - OWS3's own law, so the map does not raise it again.
//
// ONE COPY. A raider is stood by the client it is near - the chased traveller's own, as OWS3's chase was - and said in
// that client's word (NAV-G) like any ship it stands. AUDIT NAV1 (online): her seed is who she is in every client's sea,
// so a peer's copy of it is the handover's claim rule's (scenes/naval/navalHost.js claimBeats - a taken-over copy holds her,
// else the lower id, TV7b's chaseYields law for a band two players chase): the weaker copy yields into the stronger's
// puppet, the same hull, and none is stood beside a copy already in my sea. THE MERGE with main's OW6 (its raider
// chases said on the cell's foes frames): a raider a peer HOLDS - their Overworld chase of it, or their sea's ship, each
// said in the raider word the world host hears (scenes/world.js seaRaidHear, seaRaidHeld) - is never stood here, OW6's
// own law ("never a sail a peer's chase holds"), and one stood here yields to a holder with the lower id - never from
// under a boarding.
//
// PURE: which raiders stand and which go, their class, and the course they steer; the host builds and steps them.

import { SHIP_CLASSES } from './navalShips.js';
import { seededRng } from '../seaRaiders.js';
import { chaseYields } from '../travel/travelBands.js';   // TV7b: a chase two players share, kept by the lower id - one law

/** A raider within this of the player (m) is stood as a ship; one stood goes past RAIDER_DROP_M unless it fights. */
export const RAIDER_STAND_M = 1200;
export const RAIDER_DROP_M = 1700;
/** Its course: the place its seeded course reaches this many seconds on is what it steers for. */
export const RAIDER_LEAD_S = 45;
/** At most this many raiders stand at once - the nearest (a raider is a cell's in a life: two is already a crowd).
 *  SEA-EASE (Mac: "too many ships are appearing", "The sea is too dangerous right now"): one (it was two). */
export const RAIDER_SHIPS_MAX = 1;
/** The seed's salt for its class (never the course's own stream). */
const CLASS_SALT = 0x5ea1c1a5;

/**
 * A raider's class: a pirate the player's level has met (navalShips.js minLevel), drawn by weight off the raider's own
 * seed - never the flagship (the small raid's crew, WAQ_SHIP_SMALLRAID, not the flagship's WAQ_SHIP_ATTACK_PIRATE).
 */
export function raiderClassOf(seed, level) {
  const pool = SHIP_CLASSES.filter((c) => c.faction === 'pirate' && !c.flagship && c.minLevel <= Math.max(1, level | 0));
  const list = pool.length ? pool : SHIP_CLASSES.filter((c) => c.faction === 'pirate' && !c.flagship).slice(0, 1);
  const total = list.reduce((s, c) => s + c.weight, 0);
  let x = seededRng((seed ^ CLASS_SALT) >>> 0)() * total;
  for (const c of list) { if ((x -= c.weight) < 0) return c; }
  return list[list.length - 1];
}

const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * THE PLAN of one refresh: which raiders to stand and which of mine go.
 * @param {{ raiders: { id: string, seed: number, pos: number[] }[], me: number[], myId: string,
 *   stood: Map<string, { pos: number[], engaged: boolean, boarding?: boolean }>, peers: Map<number, string>, spent: Set<string>,
 *   held?: Map<string, string> }} q
 *   `raiders` the raiders about the player where they sail now (scene), `stood` mine by raider id (`boarding`: the one
 *   I fight on), `peers` a peer's copy's owner by raider seed, `spent` the raiders spent this life, `held` the raiders a
 *   peer's raider word holds (OW6) - the peer's id by raider id.
 * @returns {{ stand: string[], drop: string[] }} raider ids
 */
export function raiderPlan({ raiders, me, myId, stood, peers, spent, held = new Map() }) {
  const byId = new Map(raiders.map((r) => [r.id, r]));
  const drop = [];
  for (const [id, s] of stood) {
    const owner = held.get(id);
    // a peer's word holding her (OW6: their Overworld chase) with the lower id keeps the raider - never from under a
    // boarding. AUDIT NAV1 (online): a peer's SEA copy is the claim rule's (navalHost.js claimBeats) - the weaker copy
    // yields into the stronger's puppet, the same hull, never one gone from view. Else she leaves only out of sight -
    // past the drop range and fighting no one: struck (to be boarded), spent (sheering off) or her life over (sailing
    // on), she is still a ship on the water, never one that vanishes in view
    if (owner !== undefined && !s.boarding && chaseYields(myId, owner)) { drop.push(id); continue; }
    if (!s.engaged && flat(s.pos, me) > RAIDER_DROP_M) drop.push(id);
  }
  const keep = [...stood.keys()].filter((id) => !drop.includes(id));
  // AUDIT NAV1 (online): a raider already on the water in my sea as another's - whoever's id - is hers: standing a
  // second copy of her seed beside it (a higher id's copy took her over) would put two of her in my sea
  const candidates = raiders
    .filter((r) => !stood.has(r.id) && !spent.has(r.id) && !held.has(r.id) && !peers.has(r.seed) && flat(r.pos, me) <= RAIDER_STAND_M)
    .sort((a, b) => flat(a.pos, me) - flat(b.pos, me));
  const stand = candidates.slice(0, Math.max(0, RAIDER_SHIPS_MAX - keep.length)).map((r) => r.id);
  return { stand, drop };
}
