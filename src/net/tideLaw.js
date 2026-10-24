// @ts-check
// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE TIDES - the world moving under the
// war (bible/11-Multiplayer/Seats-Arc.md 9.3). Each seat week rolls one Tide for each of the three kingdoms, one for the
// Marches (the three regions share it) and one for the Free Lands - a pure function of the week and a salt, as the gate's
// site is (net/gate/gateLaw.js gateHash), so every client, the service and the relay roll the same Tide with nothing sent.
// Everyone knows the coming week's Tides at the Turning: the Seat tab says both.
//
// DECIDED: a Tide rolls only while a Season is counted (townSeatLaw.js seasonOf - the service's SEASON_ZERO_WEEK); with
// none, every land is Calm, so nothing the Tides touch moves before the seats open.
//
// Pure, a leaf both ends read (the professions' yields and the market's couriers read it too). Not a DFU member:
// Daggerfall's world has no weekly tides. Ledger A (THE WAR RUNS IN SEASONS' row).
import { gateHash } from './gate/gateLaw.js';
import { kingdomOf, isMarch, isFreeLand, KINGDOMS } from './kingdomLaw.js';

/** The Tides' own salt, beside the gate's (gateLaw.js GATE_SALT) and the nodes' (nodeLaw.js NODE_SALT). */
export const TIDE_SALT = 0x71de;
/** THE TIDES and their weights (9.3) - out of 100, in the table's order. */
export const TIDES = Object.freeze([
  Object.freeze({ id: 'calm', name: 'Calm', weight: 40 }),
  Object.freeze({ id: 'harvest', name: 'Harvest', weight: 10 }),
  Object.freeze({ id: 'blight', name: 'Blight', weight: 5 }),
  Object.freeze({ id: 'plague', name: 'Plague', weight: 5 }),
  Object.freeze({ id: 'orcs', name: 'Orc Raids', weight: 10 }),
  Object.freeze({ id: 'daedra', name: 'Daedric Incursion', weight: 10 }),
  Object.freeze({ id: 'wedding', name: 'Royal Wedding', weight: 5 }),
  Object.freeze({ id: 'bandits', name: 'Bandit Summer', weight: 5 }),
  Object.freeze({ id: 'storms', name: 'Storm Season', weight: 5 }),
  Object.freeze({ id: 'revolt', name: 'Tax Revolt', weight: 5 }),
]);
const TIDE_BY_ID = new Map(TIDES.map((t) => [t.id, t]));
/** The lands a Tide rolls for, in the roll's order: the three kingdoms, the Marches, the Free Lands. */
export const TIDE_LANDS = Object.freeze(['daggerfall', 'wayrest', 'sentinel', 'marches', 'free']);
/** A land's words: "the Kingdom of Wayrest", "the Marches", "the Free Lands". */
export const tideLandName = (land) => (KINGDOMS[land] ? `the Kingdom of ${KINGDOMS[land].name}` : land === 'marches' ? 'the Marches' : land === 'free' ? 'the Free Lands' : null);
/** The land a region's Tide is: its crown's kingdom, the Marches, the Free Lands - or null (the sea, a region no crown
 *  holds), which is always Calm. */
export const tideLandOf = (region) => kingdomOf(region) ?? (isMarch(region) ? 'marches' : isFreeLand(region) ? 'free' : null);
/** THE TIDE of `land` in seat week `week` (9.3) - a Tide's id; Calm for no land. Only the roll: a caller asks whether a
 *  Season is counted (tideAt). */
export function tideOf(week, land) {
  const i = TIDE_LANDS.indexOf(land);
  if (i < 0 || !Number.isSafeInteger(week)) return 'calm';
  let r = gateHash(TIDE_SALT, week, i) % 100;
  for (const t of TIDES) {
    if (r < t.weight) return t.id;
    r -= t.weight;
  }
  return 'calm';
}
/** THE TIDE at region `region` in seat week `week`, while a Season is counted (`counted`, townSeatLaw.js seasonOf's
 *  answer not null) - else Calm. */
export const tideAt = (week, region, counted) => (counted ? tideOf(week, tideLandOf(region)) : 'calm');
/** A Tide's name ("Plague"), or null for none. */
export const tideName = (id) => TIDE_BY_ID.get(id)?.name ?? null;

/** THE TIDES' NUMBERS (9.3). */
export const TIDE_EFFECTS = Object.freeze({
  /** Harvest: gathering yields a quarter more; Blight: herbs and wood a quarter less. */
  harvestYield: 1.25, blightYield: 0.75,
  /** Plague: the Watch counts half; Festivals cost double. */
  plagueWatch: 0.5, plagueFestival: 2,
  /** Orc Raids: each WoD camp cleared gives its clearer's guild influence at its pledged seat in the region, bounded. */
  orcsCampInfluence: 50, orcsCampsDay: 5, orcsInfluenceWeek: 250,
  /** Daedric Incursion: gate kills in the land give double influence. */
  daedraGates: 2,
  /** Royal Wedding: Festivals cost half; Standing +3 at every held seat. */
  weddingFestival: 0.5, weddingStanding: 3,
  /** Bandit Summer: a courier into the land takes twice as long. */
  banditsCourier: 2,
  /** Storm Season: fishing yields half again; sea travel slowed. */
  stormsFish: 1.5, stormsSea: 1.5,
  /** Tax Revolt: a Tithe above 5% costs Standing -3 more. */
  revoltTithe: 5, revoltStanding: -3,
});
/** What a Tide does, in the Seat tab's words. */
export const TIDE_WORDS = Object.freeze({
  calm: 'Nothing stirs.',
  harvest: 'Gathering yields a quarter more.',
  blight: 'Herbs and wood yield a quarter less.',
  plague: 'The Watch counts half, and Festivals cost double.',
  orcs: 'Each World of Daggerfall camp cleared gives your guild 50 influence at its seat in the region (up to 5 camps a day, 250 influence a week).',
  daedra: 'Gate kills give double influence and double silver.',   // AUDIT SEATS-2 L7: 9.3's Marks, paid since AUDIT-SEATS (seatIncursion.js)
  wedding: 'Festivals cost half, and every held seat gains 3 Standing.',
  bandits: 'Couriers into the land take twice as long.',
  storms: 'Fishing yields half again, and the sea is slow.',
  revolt: 'A Tithe above 5% costs 3 Standing more.',
});
/** The Seat tab's Tide line: "The Tide in the Kingdom of Wayrest this week: Plague - the Watch counts half, and Festivals
 *  cost double. Next week: Calm." - or null where no Season is counted or the land is no land. */
export function tideLine(region, now, next) {
  const land = tideLandName(tideLandOf(region));
  if (!land || !now) return null;
  return `The Tide in ${land} this week: ${tideName(now)} - ${TIDE_WORDS[now][0].toLowerCase()}${TIDE_WORDS[now].slice(1)}${next ? ` Next week: ${tideName(next)}.` : ''}`;
}
/** The land's gathering a Harvest raises (9.3: "gathering yields +25%") - every node on the ground: herbs, the basket,
 *  wood, ore, stone. DECIDED: not the net, whose Tide is the Storm Season's, and never a body (it names no ground). */
export const HARVEST_KINDS = Object.freeze(['herb', 'food', 'tree', 'vein', 'boulder']);
/** A TIDE ON A GATHERING'S YIELD (9.3), by what is worked - `kind` a node's ('herb', 'food', 'tree', 'vein', 'boulder')
 *  or 'haul' (the net): a Harvest a quarter more on the land's gathering, a Blight a quarter less on herbs and wood, a
 *  Storm Season half again on the net; else 1. The service asks it on confirmed ground alone, as the March's. */
export function tideYield(tide, kind) {
  if (tide === 'harvest' && HARVEST_KINDS.includes(kind)) return TIDE_EFFECTS.harvestYield;
  if (tide === 'blight' && (kind === 'herb' || kind === 'tree')) return TIDE_EFFECTS.blightYield;
  if (tide === 'storms' && kind === 'haul') return TIDE_EFFECTS.stormsFish;
  return 1;
}
/** A courier's road into a land in a Bandit Summer (9.3: "couriers into the kingdom take twice as long") - the factor on
 *  its seconds, by the Tide where it is bound. */
export const tideCourier = (tide) => (tide === 'bandits' ? TIDE_EFFECTS.banditsCourier : 1);
