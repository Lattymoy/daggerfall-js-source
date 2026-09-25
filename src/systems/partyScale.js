// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PSCALE1 (2026-09-25) — A FIGHT WEIGHS WHAT THE PARTY WEIGHS.
//
// Mac: "I want enemy difficulty, enemy numbers, etc to scale approriately
// with party size". Asked three things, Mac answered: "+50% HP, +10% dmg"
// a player past the first, "One roll per group" outdoors with a foe more
// for every two players past the first, and in a dungeon "Everyone in it"
// counts. Daggerfall Unity has no other players; this is a Ledger A
// departure, and it is online's alone - offline the party is one and
// every number below is Daggerfall's own.
//
// ═══ WHO THE PARTY IS ══════════════════════════════════════════════
//
// The HOST counts (scenes/world.js partySize): in a dungeon, everyone in
// that dungeon's room - its foes are every player's there, partymates and
// strangers alike, so everyone who can strike them counts; outdoors, me
// and the partymates within GROUP_ROLL_RADIUS (the camp's own group, 100
// units) - a town full of strangers is not my party. Never more than the
// party's own seats (PARTY_MAX).
//
// ═══ WHAT IT WEIGHS ════════════════════════════════════════════════
//
// TOUGHER: a SHARED foe loses its damage over `partyToughness` - the same
// fight as 50% more health a player, taken where the damage lands rather
// than in the foe's maximum. The maximum is the one number every client,
// the room's memory and a save already agree on (each rolls its own; the
// stream carries only the health), and a toughness that lived in it would
// have leaked into a save loaded alone and a room visited by fewer. Only
// the foe's AUTHORITY takes damage (the dungeon's host, an outdoor foe's
// owner - every other client sends its blow there), so only the authority
// reads this, with its own count. The remainder is kept per foe, so a
// party of eight's pinpricks still kill.
//
// HARDER: a SHARED foe's weapon and arrow hit on me is `partyDamageFactor`
// the blow. A hit is resolved on the victim's own machine, from its own
// copy of the foe, so the victim reads it with its own count - which is
// the host's in a dungeon, and the owner's for the owner's partymates
// outdoors; a stranger passing someone else's party's fight is not struck
// harder for that party's size. A foe's SPELLS are not weighed: their
// damage runs through the spell engine's effects, bundles that tick on
// long after the cast (recorded).
//
// MORE: outdoors the group rolls its encounters ONCE (world.js, the
// camps' `amGroupRollOwner` put on the lone encounter too - every player
// used to roll their own, so four together met four times the foes), and
// every lone encounter, camp and pack stands `partyExtraFoes` more. A
// dungeon's count is its map's markers, shared by index with every
// client, and stays; its foes are tougher and harder instead.
//
// NEVER WEIGHED: a foe only I can see - a quest's wave, a dungeon rest's
// ambush, a foe past the dungeon's layout, a building's - since nobody can
// help me with it; the city watch, which answers a crime and not a party; my own
// summoned ally; and a quest's scripted kill (the SetHealth(0) door is no
// blow).
//
// Pure: the count is an argument.
// ═══════════════════════════════════════════════════════════════════

import { PARTY_MAX } from '../net/wire.js';

/** Health a player past the first, per cent: a party of four meets foes with 2.5 times the health. */
export const PARTY_SCALE_HP_PCT = 50;
/** Damage a player past the first, per cent: a party of four is struck 30% harder. */
export const PARTY_SCALE_DAMAGE_PCT = 10;
/** Outdoors, one foe more for every this many players past the first... */
export const PARTY_SCALE_EXTRA_EVERY = 2;
/** ...and never more than this many more. */
export const PARTY_SCALE_EXTRA_MAX = 3;

/** A party's size as the law reads it: whole, from 1 (alone) to PARTY_MAX. */
export const partySizeOf = (n) => (Number.isFinite(n) ? Math.max(1, Math.min(PARTY_MAX, Math.floor(n))) : 1);

/** How many times its health a shared foe fights a party of `n` with: 1 alone, 2.5 for four, 4.5 for eight. */
export const partyToughness = (n) => 1 + (PARTY_SCALE_HP_PCT * (partySizeOf(n) - 1)) / 100;

/** How much harder a shared foe hits a party of `n`: 1 alone, 1.3 for four, 1.7 for eight. */
export const partyDamageFactor = (n) => 1 + (PARTY_SCALE_DAMAGE_PCT * (partySizeOf(n) - 1)) / 100;

/** How many more foes an outdoor encounter stands for a party of `n`: none for one or two, one for three or four,
 *  two for five or six, three for seven or eight. */
export const partyExtraFoes = (n) => Math.min(PARTY_SCALE_EXTRA_MAX, Math.floor((partySizeOf(n) - 1) / PARTY_SCALE_EXTRA_EVERY));

/** A camp's or a pack's members for a party of `n`: its own, then `partyExtraFoes(n)` more drawn from its own in
 *  order - a bandit gang grows by bandits, a vermin nest by vermin. Alone, the members themselves. */
export function partyGroupMembers(types, n) {
  const own = Array.isArray(types) ? types : [];
  const out = own.slice();
  const more = partyExtraFoes(n);
  for (let k = 0; k < more && own.length; k++) out.push(own[k % own.length]);
  return out;
}

/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();

/**
 * The health a SHARED `foe` loses to `damage` with a party of `n` fighting it: the damage over partyToughness(n),
 * kept whole by a remainder carried on the foe (a WeakMap, never a field a stream or a save could carry) - so a blow
 * of 1 against a party of eight takes nothing now and the remainder of the ninth blow takes a point. Alone, and for
 * no damage, the damage itself.
 */
export function partyFoeLoses(foe, damage, n) {
  if (!(damage > 0)) return damage;
  const t = partyToughness(n);
  if (t === 1) return damage;
  const key = foe && typeof foe === 'object' ? foe : null;
  const exact = damage / t + (key ? _carry.get(key) ?? 0 : 0);
  const whole = Math.floor(exact + 1e-9);   // 1.2 + 0.8 is 1.9999999999999998 in a double: a point owed is a point paid
  if (key) _carry.set(key, Math.max(0, exact - whole));
  return whole;
}

/** A SHARED foe's weapon or arrow hit on me, with a party of `n` beside me: never less than the hit, whole. */
export function partyFoeHits(damage, n) {
  if (!(damage > 0)) return damage;
  return Math.round(damage * partyDamageFactor(n));
}

/** Tests only: forget every foe's remainder. */
export function _resetPartyScaleForTests() { _carry = new WeakMap(); }
