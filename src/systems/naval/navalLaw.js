// @ts-check
// NAV-D (2026-09-28) - THE LAW AT SEA: what the crowns of the Bay make of a captain. The port's own, on DFU's own
// machinery - Daggerfall already names the crime (CRIMES.Piracy, 10, in the court's tables since the classic game),
// and its legal reputation and factions are the ledger. Pure: the host applies what this answers.
//
// THE WATERS ARE A CROWN'S. At sea DFU's region is 31 - "High Rock sea coast", a region with no town, no court and
// no people - so a crime there would be written in a ledger nobody reads. The port charges it to the crown whose
// waters these are (navalShips.js crownOf: the nearest of Daggerfall, Wayrest and Sentinel), each its own region.
//
// PIRACY. The first shot a player's guns land on a LAWFUL ship (a merchantman, a crown's navy) is Piracy against
// that ship's crown: DFU's own lowerRepForCrime (legal reputation by the crime's REPUTATION_LOSS_PER_CRIME, the
// region's people by half) - once per ship, however many shots follow - and NOTORIETY in that crown's waters
// (NOTORIETY.fire). Sinking her adds NOTORIETY.sink; taking her by boarding NOTORIETY.board and a second charge of
// the crime. A navy ship that SAW it (within WITNESS_RANGE of the lawful ship struck) is provoked at once.
//
// NOTORIETY is Black Flag's wanted level on Daggerfall's legal ledger: 0 to 100 in each crown's waters, falling
// NOTORIETY.decayPerDay each game day. From NAVY_HUNTS (navalAI.js) that crown's navy fights the player on sight,
// and from HUNTER_AT (navalDirector.js) it sends hunters. The HUD shows it as four anchors (`notorietyLevel`).
//
// A PIRATE'S END IS REWARDED as Warm Ashes rewards it (WAQ_SHIP_ATTACK_PIRATE's `_killcommanderknights_`: legal
// repute +3, the knightly order +3, the temple +1) - scaled to the pirate: a sloop's end is `PIRATE_REWARD.sunk`, a
// flagship's the quest's own numbers.
//
// CAPT-PAY (2026-10-11, bible/03-World/Captains-Sea.md): BOARDERS THROWN BACK are a pirate's end too - the act 'repel'
// (navalHost.js winBoarding), rewarded as a sinking is (`PIRATE_REWARD.repelled`): a raid fought off a captain's own deck
// had paid nothing - Warm Ashes' small raid declares its `_victory_` and never gives it, and the sea's own party
// returned before the law was asked.

import { CRIMES } from '../crimes.js';
import { CROWNS } from './navalShips.js';

export const NOTORIETY = Object.freeze({ max: 100, fire: 30, sink: 20, board: 15, decayPerDay: 12 });
/** The navy that sees a lawful ship struck within this (m) is provoked. */
export const WITNESS_RANGE = 650;
/** Warm Ashes' reward table (WAQ_SHIP_ATTACK_PIRATE): legal repute, the knightly order, the temple - per pirate. */
export const PIRATE_REWARD = Object.freeze({
  sunk: Object.freeze({ legal: 1, knightly: 1, temple: 0 }),
  taken: Object.freeze({ legal: 1, knightly: 2, temple: 0 }),
  flagship: Object.freeze({ legal: 3, knightly: 3, temple: 1 }),
  repelled: Object.freeze({ legal: 1, knightly: 1, temple: 0 }), // CAPT-PAY: boarders thrown back off my own deck
});
/** DFU's two factions WAQ_SHIP_ATTACK_PIRATE rewards: Generic_Knightly_Order and Generic_Temple (factionRep.js). */
export const KNIGHTLY_FACTION = 844;
export const TEMPLE_FACTION = 450;

/** The crown a crown's name names (CROWNS), or Daggerfall's. */
export const crownNamed = (name) => CROWNS.find((c) => c.name === name) ?? CROWNS[0];
/** The region a crime in a crown's waters is charged to. */
export const crownRegion = (name) => crownNamed(name).region;

/** Notoriety's four anchors: 0 below 25, then one for every quarter. */
export const notorietyLevel = (n) => Math.max(0, Math.min(4, Math.floor((Number(n) || 0) / 25)));

/**
 * The ledger of notoriety, crown by crown. `add(crown, n)`, `get(crown)`, `decay(days)`; a snapshot for the save
 * and its restore (bounded).
 */
export function createNotoriety() {
  const by = new Map();
  const n = {
    get: (crown) => by.get(crown) ?? 0,
    add(crown, amount) {
      if (!crown) return 0;
      const v = Math.max(0, Math.min(NOTORIETY.max, n.get(crown) + amount));
      by.set(crown, v);
      return v;
    },
    decay(days) {
      if (!(days > 0)) return;
      for (const [k, v] of by) {
        const w = Math.max(0, v - NOTORIETY.decayPerDay * days);
        if (w > 0) by.set(k, w);
        else by.delete(k);
      }
    },
    highest: () => Math.max(0, ...by.values()),
    snapshot: () => Object.fromEntries(by),
    restore(r) {
      by.clear();
      if (!r || typeof r !== 'object') return;
      for (const c of CROWNS) {
        const v = Number(r[c.name]);
        if (Number.isFinite(v) && v > 0) by.set(c.name, Math.min(NOTORIETY.max, v));
      }
    },
  };
  return n;
}

/**
 * What the law makes of an act, as the host applies it: `{ crimes: [{ region, crime }], notoriety: [{ crown, add }],
 * rewards: [{ legal, knightly, temple, region }] }`.
 * @param {'fire'|'sink'|'board'|'repel'} act
 * @param {{ faction: string, flagship?: boolean }} ship - the class struck
 * @param {{ crown: string, firstStrike?: boolean }} where - the crown whose waters (a navy ship: its own), and whether
 *   this is the first of the player's shots to land on this ship
 */
export function lawOf(act, ship, { crown, firstStrike = false }) {
  const out = { crimes: [], notoriety: [], rewards: [] };
  const region = crownRegion(crown);
  const lawful = ship.faction === 'merchant' || ship.faction === 'navy';
  if (lawful) {
    if (act === 'fire' && firstStrike) {
      out.crimes.push({ region, crime: CRIMES.Piracy });
      out.notoriety.push({ crown, add: NOTORIETY.fire });
    } else if (act === 'sink') out.notoriety.push({ crown, add: NOTORIETY.sink });
    else if (act === 'board') {
      out.crimes.push({ region, crime: CRIMES.Piracy });
      out.notoriety.push({ crown, add: NOTORIETY.board });
    }
  } else if (ship.faction === 'pirate' && (act === 'sink' || act === 'board')) {
    const r = ship.flagship ? PIRATE_REWARD.flagship : act === 'board' ? PIRATE_REWARD.taken : PIRATE_REWARD.sunk;
    out.rewards.push({ ...r, region });
  } else if (ship.faction === 'pirate' && act === 'repel') {
    out.rewards.push({ ...(ship.flagship ? PIRATE_REWARD.flagship : PIRATE_REWARD.repelled), region }); // CAPT-PAY: a flagship's raid beaten is her end
  }
  return out;
}
