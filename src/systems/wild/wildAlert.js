// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-ALERT (2026-10-04, Mac: "Wilderness enemies now approach/non approach based on distance and a stealth check.
// Enemies alerted are given an exclamation point and slow down as they do now, non alerted enemies do not slowdown or
// bother the player"). The port's own, as the Overworld is (no DFU original: DFU has no fast travel through a living
// wilderness to notice anyone in).
//
// THE LAW. A wilderness enemy within its reach of a fast traveller - a band's sight on the Overworld (TV7), a foe's own
// sight in play (a camp's sixty metres, a wanderer's 102.4) - is UNAWARE until it notices them, and it notices on a
// STEALTH CHECK, one a classic game minute as DFU's own EnemySenses.StealthCheck rolls (WILD_ROLL_S of the traveller's
// clock: sixty game seconds at TimeScale 12), the first the moment it comes within reach. The check is DFU's own
// formula - FormulaHelper.CalculateStealthChance, characters/enemy/enemyMotor.js `stealthChance` - with the distance carried
// into the formula's own range: DFU rolls it out to STEALTH_MAX_DISTANCE (25.6 m) and saturates past it, so the
// enemy's reach is laid onto those 25.6 m. At its reach's edge the traveller stays unseen with twice their Stealth in
// a hundred, at half the reach with their Stealth, and close in almost never (`noticeChance`). An ALERTED enemy is the
// one that comes: a band gives chase, a foe hunts, and each is marked "!" and holds the journey's clock as OW6 does; an
// unaware one keeps to its own business - it neither comes nor holds the clock nor stops the journey.
//
// PURE: distances, a Stealth, a clock step and a die in; an answer out. The keys are the caller's (a band's id, a foe
// record) and the store is pruned by the caller's own life.
// ═══════════════════════════════════════════════════════════════════
import { stealthChance, STEALTH_MAX_DISTANCE, blockedByIllusionEffect } from '../../characters/enemy/enemyMotor.js';   // ONE DFU MEMBER, ONE EXPORT: FormulaHelper.CalculateStealthChance; INVIS-SWING: EnemySenses.BlockedByIllusionEffect

/** Seconds of the traveller's (scaled) clock between two checks of one enemy: a classic game minute (60 game seconds at
 *  DFU's TimeScale 12) - EnemySenses.StealthCheck's own cadence. */
export const WILD_ROLL_S = 5;
/** How long the "!" stands over a foe that has just noticed the player in play (real seconds). During fast travel an
 *  alerted enemy keeps its mark while it is alerted - it is what holds the clock. */
export const WILD_MARK_S = 3;
/** The mark's own glyph. */
export const WILD_MARK = '!';

/**
 * The chance (0..100) an enemy NOTICES the traveller on one check: one hundred less DFU's chance to stay unseen at the
 * distance laid onto the formula's range (`reachM` onto STEALTH_MAX_DISTANCE). Outside the reach, none.
 * @param {number} distM @param {number} reachM @param {number} stealth - the traveller's live Stealth
 */
export function noticeChance(distM, reachM, stealth) {
  if (!(reachM > 0) || !(distM <= reachM)) return 0;
  const d = Math.max(0, distM) * (STEALTH_MAX_DISTANCE / reachM);
  return 100 - Math.min(100, stealthChance(d, Math.max(0, stealth | 0)));
}

/**
 * ONE CHECK: whether an enemy notices the traveller on this roll. INVIS-SWING (FIELD BUGS 2026-10-15f): the check is
 * EnemySenses' stealth roll, and DFU makes no detection of any kind past BlockedByIllusionEffect (EnemySenses.cs:451-470)
 * - an Invisibility always blinds, a Chameleon or a Shadow mostly - save for the thirteen that see through it. The wild
 * gate rolled the stealth formula alone, so an invisible traveller was noticed on the road as if seen. `concealment` the
 * traveller's flags (effects.js concealmentFlags), `seesThrough` the enemy's (EnemyBasics' SeesThroughInvisibility).
 * The illusion's own die is drawn only where a Chameleon or a Shadow asks it, as the motor's is.
 * @param {number} distM @param {number} reachM @param {number} stealth
 * @param {{ seesThrough?: boolean, concealment?: { invisible?: boolean, blending?: boolean, shade?: boolean } | null, rng?: () => number }} [o]
 */
export function noticeRoll(distM, reachM, stealth, { seesThrough = false, concealment = null, rng = Math.random } = {}) {
  if (concealment && blockedByIllusionEffect(seesThrough, concealment, rng)) return false;
  return rng() * 100 < noticeChance(distM, reachM, stealth);
}

/**
 * THE ALERTS of a set of enemies. `rng` the die (0..1); `weak` true keys a WeakMap (foe records), else a Map (band ids).
 * @param {{ rng?: () => number, weak?: boolean }} [opts]
 */
export function createWildAlert({ rng = Math.random, weak = false } = {}) {
  /** @type {Map<any, { alerted: boolean, clock: number, at: number }> | WeakMap<object, { alerted: boolean, clock: number, at: number }>} */
  const st = weak ? new WeakMap() : new Map();
  const get = (k) => st.get(k) ?? null;
  return {
    /** Whether `k` has noticed the traveller. */
    alerted: (k) => !!get(k)?.alerted,
    /** When it noticed (the caller's clock), or null. */
    alertedAt: (k) => get(k)?.at ?? null,
    /** Whether `k` has been checked and has NOT noticed - an enemy in reach that keeps to its own business. */
    unaware: (k) => { const s = get(k); return !!s && !s.alerted; },
    /**
     * One frame of one enemy: `distM` its distance, `reachM` its reach, `stealth` the traveller's, `scaledDt` the frame on
     * the traveller's clock (real seconds times the time scale), `now` the caller's clock for `alertedAt`. Out of reach
     * nothing is rolled and the next check waits for it to come back within; an alerted enemy stays alerted (it is the
     * chase's, or the foe's own senses', to give up). Returns whether it is alerted, and whether it noticed this frame.
     * the traveller's concealment and the enemy's sight through it (`noticeRoll`).
     * @param {any} k @param {{ distM: number, reachM: number, stealth: number, scaledDt: number, now?: number, seesThrough?: boolean, concealment?: any }} q
     */
    step(k, { distM, reachM, stealth, scaledDt, now = 0, seesThrough = false, concealment = null }) {
      let s = get(k);
      if (s?.alerted) return { alerted: true, noticed: false };
      if (!(distM <= reachM)) { if (s) s.clock = WILD_ROLL_S; return { alerted: false, noticed: false }; }
      if (!s) { s = { alerted: false, clock: WILD_ROLL_S, at: 0 }; st.set(k, s); }
      s.clock += Math.max(0, scaledDt);
      if (s.clock < WILD_ROLL_S) return { alerted: false, noticed: false };
      s.clock = 0;
      if (noticeRoll(distM, reachM, stealth, { seesThrough, concealment, rng })) { s.alerted = true; s.at = now; return { alerted: true, noticed: true }; }
      return { alerted: false, noticed: false };
    },
    /** `k` was checked another way and did NOT notice (the wanderer's check at the spot it was placed) - its next check
     *  waits a full WILD_ROLL_S, as a rolled one's does. */
    checked(k) { if (!get(k)) st.set(k, { alerted: false, clock: 0, at: 0 }); },
    /** `k` has noticed the traveller another way (it struck, it was struck, its campmate woke it). */
    alert(k, now = 0) { const s = get(k); if (s) { if (!s.alerted) { s.alerted = true; s.at = now; } } else st.set(k, { alerted: true, clock: 0, at: now }); },
    /** `k` is forgotten - gone, or given up: the next sight of the traveller is a fresh check. */
    forget(k) { st.delete(k); },
    /** Map stores only: keep the keys `keep` answers for. */
    prune(keep) { if (st instanceof Map) for (const k of [...st.keys()]) if (!keep(k)) st.delete(k); },
  };
}
