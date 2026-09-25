// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PSCALE1 (2026-09-25) — A FIGHT WEIGHS WHAT THE PARTY WEIGHS.
//
// Mac: "I want enemy difficulty, enemy numbers, etc to scale approriately
// with party size". Asked three things, Mac answered: "+50% HP, +10% dmg"
// a player past the first, "One roll per group" outdoors with a foe more
// for every two players past the first, and in a dungeon "Everyone in it"
// counts. AUDIT PSCALE1 found "everyone in it" counted every player
// anywhere in the dungeon - seven strangers idling in Privateer's Hold
// made a new player's rats four and a half times as tough - and asked
// again; Mac answered "Whoever fights it". Daggerfall Unity has no other
// players; this is a Ledger A departure, and it is online's alone -
// offline only one player ever strikes, and every number below is
// Daggerfall's own.
//
// ═══ WHO A FOE FIGHTS ══════════════════════════════════════════════
//
// A FOE'S FIGHTERS are the players who have struck it within
// PARTY_FIGHT_WINDOW_MS (thirty seconds - the window Renown pays a kill
// by, net/renownTracker.js RENOWN_ASSIST_MS), strangers and partymates
// alike, never fewer than one and never more than the party's own seats
// (PARTY_MAX). They are counted where every blow on the foe lands - its
// AUTHORITY, the dungeon's host or an outdoor foe's owner, whose damage
// door hears its own player's blows and every peer's (`noteFighter`) -
// and the count rides the foe's stream record (`n`), so every client
// reads the same number for the same foe. A player idling across the
// dungeon, a silent tab, a stranger passing by never struck it and never
// count; an archer a hundred paces off who shoots it does. A copy only I
// can strike (a quest's, a building's, a dungeon split while its host is
// silent) only ever hears my blows, and fights one.
//
// ═══ WHAT IT WEIGHS ════════════════════════════════════════════════
//
// TOUGHER: a SHARED foe loses its damage over `partyToughness` of its
// fighters - the same fight as 50% more health a fighter, taken where
// the damage lands rather than in the foe's maximum. The maximum is the
// one number every client, the room's memory and a save already agree
// on (each rolls its own; the stream carries only the health), and a
// toughness that lived in it would have leaked into a save loaded alone.
// The remainder is kept per foe, so a party of eight's pinpricks still
// kill (every 4.5 blows of 1 take a point - the 5th and the 9th). A heal
// on a shared foe is weighed the same way (`partyFoeHeals`) - a heal of
// 20 on a foe with 2.5 times the health is 20 of the bigger pool, not 50.
// A blow that IS a kill - SetHealth(0), Disintegrate, a stat drained to
// zero, Mehrunes' Razor's whole-health strike (`markWholeBlow`) - is
// never divided.
//
// HARDER: a SHARED foe's weapon and arrow hit on a player is
// `partyDamageFactor` of its fighters, the remainder carried per victim
// (`partyFoeHits`) so a rat's 1 still rises by a tenth a fighter. A
// foe's SPELLS are not weighed: their damage runs through the spell
// engine's effects, bundles that tick on long after the cast (recorded).
//
// MORE: outdoors the party standing together rolls its encounters ONCE
// (world.js, the camps' `amGroupRollOwner` over the partymates) and
// every lone encounter, camp and pack stands `partyExtraFoes` more for
// the partymates within GROUP_ROLL_RADIUS of the roller (world.js
// partySize - the party before any blow is struck). A dungeon's count
// is its map's markers, shared by index with every client, and stays;
// its foes are tougher and harder instead.
//
// NEVER WEIGHED: a foe only I can see - a quest's wave, a dungeon rest's
// ambush or any foe past the dungeon's layout, a building's; the city
// watch, which answers a crime and not a party; my own summoned ally.
//
// Pure but for the per-foe records, which are WeakMaps - never a field
// a stream or a save could carry. The count and the clock are arguments.
// ═══════════════════════════════════════════════════════════════════

import { PARTY_MAX } from '../net/wire.js';

/** Health a fighter past the first, per cent: four fighters meet a foe with 2.5 times the health. */
export const PARTY_SCALE_HP_PCT = 50;
/** Damage a fighter past the first, per cent: four fighters are struck 30% harder. */
export const PARTY_SCALE_DAMAGE_PCT = 10;
/** Outdoors, one foe more for every this many partymates past the first... */
export const PARTY_SCALE_EXTRA_EVERY = 2;
/** ...and never more than this many more. */
export const PARTY_SCALE_EXTRA_MAX = 3;
/** A player is one of a foe's fighters for this long after their last blow on it - Renown's assist window. */
export const PARTY_FIGHT_WINDOW_MS = 30_000;
/** The key the local player's own blows are noted under (a peer's is its id; no id is a symbol). */
export const PARTY_ME = Symbol('me');

/** A party's size as the law reads it: whole, from 1 (alone) to PARTY_MAX. */
export const partySizeOf = (n) => (Number.isFinite(n) ? Math.max(1, Math.min(PARTY_MAX, Math.floor(n))) : 1);

/** How many times its health a shared foe fights `n` fighters with: 1 alone, 2.5 for four, 4.5 for eight. */
export const partyToughness = (n) => 1 + (PARTY_SCALE_HP_PCT * (partySizeOf(n) - 1)) / 100;

/** How much harder a shared foe hits with `n` fighters on it: 1 alone, 1.3 for four, 1.7 for eight. */
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

const _obj = (o) => (o && typeof o === 'object' ? o : null);

/** @type {WeakMap<object, Map<string|symbol, number>>} */
let _fighters = new WeakMap();

/** A blow on `foe` by `who` (PARTY_ME for the local player, else the striker's id) at `now` (ms, the door's clock). */
export function noteFighter(foe, who, now) {
  const key = _obj(foe);
  if (!key || who == null || !Number.isFinite(now)) return;
  let m = _fighters.get(key);
  if (!m) _fighters.set(key, (m = new Map()));
  m.set(who, now);
}

/** How many players are fighting `foe` at `now`: those who struck it within PARTY_FIGHT_WINDOW_MS, 1..PARTY_MAX. */
export function foeFighters(foe, now) {
  const key = _obj(foe);
  const m = key ? _fighters.get(key) : null;
  if (!m || !Number.isFinite(now)) return 1;
  let n = 0;
  for (const [who, at] of m) {
    if (now - at <= PARTY_FIGHT_WINDOW_MS) n++;
    else m.delete(who);
  }
  return partySizeOf(n);
}

/** `amount` over `t`, kept whole by a remainder carried in `carry` for `key` (none kept without a key). */
function weighDown(carry, key, amount, t) {
  const exact = amount / t + (key ? carry.get(key) ?? 0 : 0);
  const whole = Math.floor(exact + 1e-9);   // 1.2 + 0.8 is 1.9999999999999998 in a double: a point owed is a point paid
  if (key) carry.set(key, Math.max(0, exact - whole));
  return whole;
}

/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();
/** @type {WeakMap<object, number>} */
let _healCarry = new WeakMap();
/** @type {WeakMap<object, number>} */
let _hitCarry = new WeakMap();

/**
 * The health a SHARED `foe` loses to `damage` with `n` fighters on it: the damage over partyToughness(n), kept whole
 * by a remainder carried on the foe - every 4.5 blows of 1 against eight take a point. Alone, and for no damage, the
 * damage itself.
 */
export function partyFoeLoses(foe, damage, n) {
  if (!(damage > 0)) return damage;
  const t = partyToughness(n);
  if (t === 1) return damage;
  return weighDown(_carry, _obj(foe), damage, t);
}

/** The health a heal of `amount` restores to a SHARED `foe` with `n` fighters on it: over the same toughness, its own
 *  remainder carried - a heal is a heal of the bigger pool. Alone, the heal itself. */
export function partyFoeHeals(foe, amount, n) {
  if (!(amount > 0)) return amount;
  const t = partyToughness(n);
  if (t === 1) return amount;
  return weighDown(_healCarry, _obj(foe), amount, t);
}

/** A SHARED foe's weapon or arrow hit on `victim` with `n` fighters on it: never less than the hit, whole, the
 *  remainder carried per victim so a small hit rises too (a rat's 1 against four is 1, 1, 1, 2, ...). Without a
 *  victim to carry for, rounded. */
export function partyFoeHits(damage, n, victim = null) {
  if (!(damage > 0)) return damage;
  const f = partyDamageFactor(n);
  if (f === 1) return damage;
  const key = _obj(victim);
  if (!key) return Math.round(damage * f);
  const exact = damage * f + (_hitCarry.get(key) ?? 0);
  const whole = Math.floor(exact + 1e-9);
  _hitCarry.set(key, Math.max(0, exact - whole));
  return whole;
}

/** @type {WeakMap<object, true>} */
let _whole = new WeakMap();
/** A strike about to land on `entity` is a KILL, not a blow (Mehrunes' Razor's whole-health strike): the next door it
 *  reaches takes it undivided. Read once (`takeWholeBlow`). */
export function markWholeBlow(entity) { const key = _obj(entity); if (key) _whole.set(key, true); }
/** Whether a whole-blow mark waits on `entity` - and spend it. */
export function takeWholeBlow(entity) {
  const key = _obj(entity);
  if (!key || !_whole.has(key)) return false;
  _whole.delete(key);
  return true;
}

/** Tests only: forget every foe's fighters and remainders, every victim's, every mark. */
export function _resetPartyScaleForTests() {
  _fighters = new WeakMap();
  _carry = new WeakMap();
  _healCarry = new WeakMap();
  _hitCarry = new WeakMap();
  _whole = new WeakMap();
}
