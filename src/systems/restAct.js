// REST1 (2026-10-03, bible/06-Systems/Rest-Arc.md; Mac: "Resting is no longer time based online with campfires, beds,
// camping sets, being the main way to rest", then "Go") - THE REST ACT ONLINE.
//
// Online a rest is no longer hours on a dial. It is an ACT at a REST POINT - a lit fire (a placed Campfire, a tent's
// fire, a world brazier or hearth), a bed where DFU lets you sleep indoors - and it is ONE NIGHT: the character's own
// clock moves eight hours in a single step, so everything that reads their time (spells, diseases, needs, rooms,
// training, guild waits - the arc's 29-row census, section 7) sees exactly the eight hours a rest gave it before.
//
// THE NIGHT IS THE SAME NIGHT. It is the timed rest's own RestSession - its sub-ticks, its quest ticks, its hourly
// enemy check, its vitals, its rent count - run to its end in one call instead of paced over the window's timer, with
// the host's own rest deps (scenes/shared.js createRestDeps). Nothing a sub-tick does is restated here, so nothing can
// drift from what an eight-hour rest does everywhere else. The resting encounter roll still rides each sub-tick's
// advance at the odds it always had; a foe it spawns breaks the night at the hour it lands, as it always did.
//
// THE NIGHT INTERVAL. A night passes at most once per NIGHT_INTERVAL_MINUTES of the character's clock since the last
// one ended (two hours: ten real minutes of play, the character's clock running at TimeScale 12). Inside it a rest is
// a SHORT REST: it heals, and nothing else - no clock moves, nothing ages, no encounter rolls. A fire is a place to
// recover, never a fast-forward button.
//
// THE YIELD. A night at a bed or a fire, or any rest the tier prices whole (Casual's rough, or the arc off), ends full:
// health, fatigue and magicka (online no career rests short of its magicka - REST-MANA1). A rough night the tier prices
// at half (Hard's) keeps what its eight hours gave. A short rest heals in full where the tier prices whole, and half of
// what is missing where it does not.
//
// Offline nothing here runs: DFU's rest window, byte for byte.

import { RestSession, REST_TEXT, REST_WAIT_PER_HOUR, MINUTES_PER_TICK } from './restSession.js';
import { restCost, REST_KIND } from './survival/rest.js';

/** A night: DFU's customary eight hours, on the character's own clock. */
export const NIGHT_HOURS = 8;
export const NIGHT_MINUTES = NIGHT_HOURS * 60;
/** Two hours of the character's clock between nights - ten real minutes of play. */
export const NIGHT_INTERVAL_MINUTES = 120;
/** The character's clock runs at TimeScale 12 while they play: twelve of its minutes a real minute. */
export const OWN_MINUTES_PER_REAL_MINUTE = 12;
/** The act's hold, in real seconds: long enough to need safety, short enough not to bore. */
export const REST_CHANNEL_SECONDS = 6;
/** A day of a rented room, in the character's minutes - a night online spends one. */
export const ROOM_DAY_MINUTES = 24 * 60;

export const REST_ACT_TEXT = Object.freeze({
  noPoint: 'Find a fire or a bed to rest.',
  inTown: 'It is illegal to camp in town.',
  shortRest: 'You rest a while.',
  interrupted: 'Your rest is interrupted.',
  channel: (where) => `Resting by the ${where}...`,
  channelBed: 'Resting...',
  meditating: 'Meditating by the candle...',   // REST6: the Meditation Candle's kneel
  noVote: 'Online there is no vote: rest at a fire, a tent or a bed, and your party within 15 m rests with you.',   // AUDIT REST: /ready online
  nextNight: (minutes) => `A night can pass again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
  rested: 'Rested',
  carried: (name) => `${name} rests here, and you rest with them through the night.`,   // REST5: a member's night, carried
  carriedShort: (name) => `${name} rests here, and you rest a while with them.`,
  carriedSkipped: (name) => `${name} rests here - you are too busy to rest with them.`,
  carriedFar: (name) => `${name} rested a night without you - come within 15 m of them to rest with the party.`,   // AUDIT REST-PARTY: PARTY-REST-FAR1's word, online
});

/** Whether a night may pass now: none yet, the interval run out, or a clock behind the stamp (a load from another
 *  timeline) - never a night refused for a stamp from the future. */
export function nightDue(entity, ownNow) {
  const at = entity?.restNightAt;
  if (!Number.isFinite(at) || !Number.isFinite(ownNow)) return true;
  return ownNow < at || ownNow - at >= NIGHT_INTERVAL_MINUTES;
}

/** Real minutes until a night may pass again (0 when one may now) - the Rested tile's foot. */
export function nightRealMinutesLeft(entity, ownNow) {
  if (nightDue(entity, ownNow)) return 0;
  return Math.max(1, Math.ceil((NIGHT_INTERVAL_MINUTES - (ownNow - entity.restNightAt)) / OWN_MINUTES_PER_REAL_MINUTE));
}

/** The night's end, stamped on the character's clock. */
export function stampNight(entity, ownNow) {
  if (entity && Number.isFinite(ownNow)) entity.restNightAt = Math.floor(ownNow);
}

/**
 * One night: the timed rest's own session, eight hours, run to its end in one call. `deps` is the host's rest bag
 * (createRestDeps' output); `rentedHours` is CanRest's out-parameter, so a room that runs out mid-night ends the night
 * with the landlord's line, as an eight-hour rest always has. Answers the session's own result and the hours slept.
 *
 * AUDIT REST-PARTY A1: ONE SUB-TICK A CALL, AND THE AMBUSH HEARD AT ONCE. A host's resting encounter is rolled inside
 * a sub-tick's advance and STOOD asynchronously (its art awaited), so the foe joins no pool while one synchronous call
 * runs the whole night: the hour's enemy check never saw it, a night a hit rolled was slept to its end - healed whole,
 * stamped, the party carried - with the foe arriving after the wake, and every later sub-tick rolled again. A host
 * that stands a resting encounter now says so here (ambushNight) the moment its spot is found, which is the
 * session's own OnEncounter latch (DFU's AbortRestForEnemySpawn), and the night is ticked a sub-tick a call so the
 * latch is read before the next ten minutes roll: the night breaks with DFU's "enemies nearby" at the sub-tick the
 * hit fell in, its hours slept counted.
 */
let _night = null;
export function runRestNight(deps, { rentedHours = -1, hours = NIGHT_HOURS } = {}) {
  const s = new RestSession('timed', hours, deps, rentedHours, null);
  const step = REST_WAIT_PER_HOUR / MINUTES_PER_TICK;   // the session's own sub-tick (RestSession _subTickEvery), one a call
  const outer = _night;
  _night = s;
  let r = null;
  // a night is hours * 6 sub-ticks; the guard is twice that, so a float that falls a sub-tick short each call still
  // finishes, and a session that never answers cannot hang the frame
  try { for (let i = 0; r === null && i < hours * 12 + 8; i++) r = s.tick(step); } finally { _night = outer; }
  return { result: r ?? s._finish(REST_TEXT.wakeUp), hours: s.totalHours };
}
/** AUDIT REST-PARTY A1: a host has stood a resting encounter - the night running now (runRestNight) breaks at its next
 *  sub-tick. Answers whether a night heard it; with none running (offline's paced window, which hears the stood foe
 *  itself through onEnemySpawn) nothing happens. */
export function ambushNight() {
  if (!_night) return false;
  _night.abortForEnemySpawn();
  return true;
}

/** AUDIT REST-PARTY A5: THE CHANNEL HELD TO ITS END ASKS AGAIN. The plan was read at the open, and only enemies were asked
 *  at the end - so a fire gone in the six seconds (picked up by its owner, burned out, an Ember Jar's last minute) still
 *  gave a night priced as a camp's, a blow taken while holding (a poison, a foe beyond the resting scan) was simply
 *  topped up, and a night that came due while holding slept short. `opened` is the plan at the open, `now` the host's
 *  restAct() at the end, `hpAtOpen`/`hpNow` the sleeper's health: the plan to finish on, or null - interrupted. A
 *  candle's kneel is its own (anywhere a rest may begin). */
export function actAtChannelEnd(opened, now, hpAtOpen, hpNow) {
  if (opened?.meditate) return opened;
  if (opened?.point?.where && !now?.point) return null;   // a fire, a tent or a Bedroll gone - a bed (no `where`) is the room's or the ship's, and a ship's press lasts only the press
  if (Number.isFinite(hpAtOpen) && Number.isFinite(hpNow) && hpNow < hpAtOpen) return null;
  return { ...opened, night: now ? !!now.night : !!opened?.night };   // the point it opened on, the interval read now
}

/** Whether the tier prices a rest of this kind whole (a bed, a fire, Casual's rough, the arc off). */
export const restPricedWhole = (kind, rules) => !rules || (restCost(kind, rules)?.recovery ?? 1) >= 1;

/**
 * The yield's top-up. `maxFatigueOf` is the host's (statMods.maxFatigue). A night or short rest priced whole ends
 * full; a short rest priced at half heals half of what is missing; a night priced at half keeps what its hours gave.
 */
export function topUpRest(entity, kind, rules, { night = true, maxFatigueOf = (e) => e.maxFatigue ?? 0 } = {}) {
  if (!entity) return;
  const fill = (cur, max, frac) => Math.min(max, Math.round((cur ?? 0) + Math.max(0, max - (cur ?? 0)) * frac));
  const frac = restPricedWhole(kind, rules) ? 1 : night ? 0 : 0.5;
  if (frac <= 0) return;
  entity.health = fill(entity.health, entity.maxHealth ?? 0, frac);
  entity.fatigue = fill(entity.fatigue, maxFatigueOf(entity), frac);
  if (Number.isFinite(entity.maxMagicka)) entity.magicka = fill(entity.magicka, entity.maxMagicka, frac);
}

/** A rented room's night: the night's eight hours already ran off its expiry; the rest of the day goes with them, so a
 *  day rented is a night slept (the arc's OPEN 10). A room with less than a day left is simply spent. */
export function spendRoomNight(room) {
  if (!room || !Number.isFinite(room.expiryMinutes)) return;
  room.expiryMinutes -= ROOM_DAY_MINUTES - NIGHT_MINUTES;
}

/** REST5 (bible/06-Systems/Rest-Arc.md 2.6): THE NIGHT IS HEARD. A host that shares the night (world.js, the party's
 *  pose) listens here; createRestDeps' restNight calls it after a night slept whole - never a carried one (a member's
 *  night carried for me is theirs, and is not passed on again). One listener: the page has one party. AUDIT REST-PARTY:
 *  it hears WHERE - the rest kind of the spot the night was slept at (survival/rest.js REST_KIND), so the party sleeps
 *  it at the rester's fire and not on the ground beside it. */
let _nightListener = null;
export function setNightListener(fn) { const prev = _nightListener; _nightListener = typeof fn === 'function' ? fn : null; return prev; }
export const heardNight = (kind = null) => { _nightListener?.(kind); };

/** AUDIT REST F7: A NIGHT'S STAMP IS MARKED. The party's night rides the pose's `restStartedAt` (REST5, no relay bump),
 *  and an older build stamps that same field when its rest window OPENS - so a mate on an older build who opened the
 *  window, chose an hour or walked away from it would have carried every newer member into a whole night. A night's
 *  stamp is the shared clock's second with a night's mark for its milliseconds; an older build's open lands on one of
 *  them three times in a thousand.
 *  AUDIT REST-PARTY: THE MARK SAYS WHERE. One mark a rest kind - the night's spot, which a carried member sleeps at
 *  (partyRestLaw.js carriedRestKind) - still with no relay bump: the field and its bounds are the wire's already. A
 *  kind the table does not know stamps as a fire's. */
export const PARTY_NIGHT_MARKS = Object.freeze({ [REST_KIND.Rough]: 775, [REST_KIND.Camp]: 776, [REST_KIND.Bed]: 777 });
const markOf = (kind) => (typeof kind === 'string' && Object.hasOwn(PARTY_NIGHT_MARKS, kind) ? PARTY_NIGHT_MARKS[kind] : PARTY_NIGHT_MARKS[REST_KIND.Camp]);
export const nightStamp = (t, kind = REST_KIND.Camp) => Math.floor(t / 1000) * 1000 + markOf(kind);
/** The rest kind a night's stamp names, or null for a stamp that is no night's. */
export const nightKindOf = (t) => {
  if (!Number.isFinite(t)) return null;
  const ms = ((t % 1000) + 1000) % 1000;
  for (const kind of Object.keys(PARTY_NIGHT_MARKS)) if (PARTY_NIGHT_MARKS[kind] === ms) return kind;
  return null;
};
export const isNightStamp = (t) => nightKindOf(t) !== null;
