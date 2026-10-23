// @ts-check
// FIELD BUGS 2026-10-21d REGARD-OWN (lumin, the Discord's #bug-reports, "Family System appears to be broken": "I cannot
// raise the disposition of NPCs at all by talking to them. I can raise it, then after a while it resets back to
// baseline"): A REGARD IS COUNTED IN THE CHARACTER'S OWN DAYS.
//
// The regard (relations.js) eases back toward nothing by EASE_PER_DAY a day the player does not see a resident, and a
// word counts once a day - and its days were the SKY's (`Math.floor((skyMinutes() - 240) / 1440)`, the living day). Online
// the sky is a real hour a day and runs while the player is away (net/skyLaw.js), so a friendship eased twelve points a
// real day logged off, and a player who played an evening at a time came back to nought every evening: the +40 a
// courtship asks (legacy/marriage.js FRIEND_AT) was never reached. A word counted once a real hour. And the stamps were
// SAVED on the sky, which the clock law forbids (bible/06-Systems/Online-Time-Arc.md section 5: "No stamp is taken on the
// sky") - LIVED1 puts a character's standing on their own clock, and the courtship beside the regard was already there
// (legacyHost.js ownDay). Offline the sky, the world's clock and the character's are one clock: nothing changes there.
//
// The Living World's people, plans, roads and tales stay on the sky (LW0 decision 2: the world is shared); how it regards
// the character is theirs (decision 6), so its day is theirs. Every caller still hands the relations the living day it
// has (twenty-odd sites across the towns, roads, dives and caravans); this seam is the one place the relations are made
// (THE ONE CONSTRUCTION SEAM), and it counts every regard in the character's own day instead.
import { createRelations, regardStanding, EASE_PER_DAY } from './relations.js';
import { skyMinutes } from '../worldTick.js';   // AUDIT FB1021d RO-3: the sky, read once at an old record's load

/** A regard's day starts at 04:00, as the living day does (livingTown.js dayOf). */
export const REGARD_DAY_START_MIN = 240;
/** The day a regard is counted in, of the character's own minutes. @param {number} ownMinutes */
export const regardDayOf = (ownMinutes) => Math.floor((ownMinutes - REGARD_DAY_START_MIN) / 1440);
/** The record's mark: its stamps are the character's own days. A record without it was stamped on the sky. */
export const REGARD_CLOCK = 'own';
/** AUDIT FB1021d RO-4: the friends made that wait to be said, at most - one deed can make a crowd of them. */
export const FRIENDS_SAID_MAX = 6;

/**
 * A sky-stamped record's people, met and seen today, and its once-a-day marks - a sky day's number, meaningless on the
 * own clock - let go. A FRIENDSHIP stands as it was last written: what the sky eased since, unwritten, comes back - the
 * reported loss. AUDIT FB1021d RO-3: a GRUDGE stands as the sky had eased it by the load - the most the player ever saw
 * of it - never as it was written: a slain resident's kin at -75 when written, eased to -45 (an enemy) on the old sky,
 * came back -75 (hostile, LW7: an armed one draws) the day the update landed.
 * @param {Record<string, any>} people @param {number} day - today, the own clock's @param {number} skyDay - the sky's day
 */
const rebased = (people, day, skyDay) => Object.fromEntries(Object.entries(people).map(([id, e]) => {
  if (!e || typeof e !== 'object') return [id, e];
  const r = Number(e.r), seen = Number(e.seen);
  const eased = r < 0 && Number.isFinite(seen) ? Math.min(0, r + Math.max(0, skyDay - seen) * EASE_PER_DAY) : r;
  return [id, { r: eased, met: day, seen: day, talked: -1 }];
}));

/** Whether a record is the sky's: a REGARD-OWN record is marked; one from before is not, and is sky-stamped online -
 *  and offline when a stamp stands ahead of today (AUDIT FB1021d RO-5: an online save copied offline keeps its sky days,
 *  some 1,100 against an own day of 530, and no regard there eased until touched). @param {any} record
 *  @param {number} day @param {boolean} online */
const skyStampedIs = (record, day, online) => !!record && typeof record === 'object' && record.v === 1 && record.clock !== REGARD_CLOCK
  && !!record.people && typeof record.people === 'object'
  && (online || Object.values(record.people).some((e) => Number(e?.seen) > day || Number(e?.met) > day || Number(e?.talked) > day));

/**
 * One character's regards (relations.js createRelations), counted in their own days. A record from before REGARD-OWN (no
 * `clock`) is rebased once to today, online - and offline when its stamps are the sky's.
 * @param {any} record - a save's (`snapshot()`), or none
 * @param {() => number} own - the character's own minutes (worldTick.js ownMinutes)
 * @param {boolean} [online] - the lane
 * @param {() => number} [sky] - the sky's minutes, read once, for an old record's grudges (RO-3); offline it is the one
 *  clock - no stamp is taken on it
 */
export function characterRelations(record, own, online = false, sky = () => skyMinutes()) {
  const today = () => regardDayOf(own());
  const day = today();
  const rel = createRelations(skyStampedIs(record, day, online) ? { ...record, people: rebased(record.people, day, regardDayOf(sky())) } : record);
  /** AUDIT FB1021d RO-4: the friends made since the last read - a word, a tone, a deed (each a `note`), not a regard
   *  handed down (`inherit`: a family's friends, met as such) - said by townTalk once the HUD is clear. */
  /** @type {string[]} */
  const made = [];
  const isFriend = (/** @type {string} */ id) => regardStanding(rel.regard(id, today())) === 'friend';
  // the day a caller hands in is the living day it has; the regard's is the character's own
  return {
    ...rel,
    /** @param {string} id @param {number} [_day] */
    regard: (id, _day) => rel.regard(id, today()),
    /** @param {string} id @param {number} [_day] */
    standing: (id, _day) => rel.standing(id, today()),
    /** @param {string} id @param {any} kind @param {number} [_day] @param {number} [amount] */
    note: (id, kind, _day, amount) => {
      const was = isFriend(id);
      const r = rel.note(id, kind, today(), amount);
      if (!was && isFriend(id) && !made.includes(id) && made.length < FRIENDS_SAID_MAX) made.push(id);
      return r;
    },
    /** @param {string} id @param {number} amount @param {number} [_day] */
    inherit: (id, amount, _day) => rel.inherit(id, amount, today()),
    /** @param {string} id @param {number} [_day] */
    seen: (id, _day) => rel.seen(id, today()),
    snapshot: () => ({ ...rel.snapshot(), clock: REGARD_CLOCK }),
    /** The regard's day now - the People page's "seen N days ago" reads it. */
    today,
    /** The friends made since the last read, still friends now (one lost again before it was said is not said). */
    friendsMade: () => made.splice(0).filter(isFriend),
  };
}
