// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE OPEN ZONE REFEREED.
//
// WILD1 left a blow between two players in the zone to the defender's own machine and a fall to the fallen's own health
// - so a client that never took a blow never fell, and one that fell handed over what it chose. Now the relay that
// routes the zone's frames holds its fights:
//
//   - WHO FIGHTS. The relay cannot see the map (the zone is Cyrodiil, the province as each client's own traced picture
//     cuts it - systems/wild/cyrodiilZone.js, online the trace's alone, AUDIT TESA II Z11), so a socket's zone is its own word: each says it
//     stands in it, and leaves it (`zone`). A blow lands only where BOTH fighters said so - a crafted client can opt out
//     of the zone's fights, never into another's: an honest player outside the zone is nobody's target. And never on KIN
//     (wildKin, below): a party member or one under the party's truce (the hub's word), the fighter's own duel opponent
//     (the duel's referee holds that one), or - Mac's decision, 2026-10-14: "Guildmates are friends" - one of its guild.
//   - THE VITALITY is counted in the Royal Tourney's units (300 + 2 x the Renown the token signs), and since SHARED-HEALTH
//     (2026-10-26, net/siege/refereeHealthShare.js) it IS the player's own health, as a share: the client reports its
//     health (a foe's blow, a potion) and the referee's blows set it. No pool refills by itself.
//   - EVERY BLOW AND CAST is the referee's (refereeBlow, refereeCast - the weapon the striker's look holds, the arms its
//     token signs, the reach from both fighters' last BELIEVED places: a run the referee allows, never a teleport).
//   - A FALL is the referee's word: the fallen's vitality at none. The striker is its killer. AUDIT FOE-KEEPS E2 (the owner,
//     2026-10-24, asked: "Credit the last player"): and a fighter that dies to anything else - a foe, a fall, the sea -
//     within WILD_REF.creditMs of a fair player's blow falls to that player (wildCredit): since FOE-KEEPS such a death drops
//     nothing, and dying to a foe at the last second denied the killer everything. The killer then has
//     WILD_REF.pickMs to choose one worn piece of the fallen's (`pick` - its place in the offer the fallen's game showed,
//     systems/wild/wildDropLaw.js wornOffer); then the relay signs the fall (net/wild/wildReceipt.js `f1`) and hands it to both, and
//     the account service takes the drop and that piece off the fallen's judged record against it.
//
//   - SAFE PASSAGE (ZONE-GRACE, 2026-10-26 - the owner: "making the experience more palatable while retaining its
//     punishment"; asked, "Entry/rise grace"): for WILD_GRACE.ms after a fighter enters the zone or rises from its fall,
//     no player's blow or cast lands on it, and its own blow or cast on a player ends it at once. An entry grants it only
//     to one that has been away from the zone WILD_GRACE.awayMs and in no fight for WILD_GRACE.fightMs - so a step out
//     and back is no way out of a fight, and a cell crossed inside the zone (a new room's fighter, its carry fresh) is no
//     entry (its carry is a word of a moment ago); the grace rides the carry into the next room.
//
// Pure: no clock (every `now` an argument), no socket, no storage - the relay's room keeps the state in its memory
// (DECIDED, the duel's: a room that restarts mid-fight forgets it; a fall already signed is the service's to settle).
// ═════════════════════════════════════════════════════════════════════
import { SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, refereeCast, refereeStep } from '../siege/siegeRef.js';
import { resetHealthShare, pvpEvadeChance } from '../siege/refereeHealthShare.js'; // PVP-EVADE
import {
  castPaid,
  shaftPaid,
  swingPaid,
  bowFastCut,
  payFatigue,
  absorbLanded,
  runPaid,
  vitalsCarry,
  vitalsTake,
  PVP_VITALS,
} from './pvpVitals.js'; // PVP-VITALS: a flagged fighter's casts and swings paid for
import { pvpFlagCanDrop, pvpAggroLeft, pvpYoung, PVP_FLAG } from '../../systems/wild/pvpFlag.js'; // PVP-FLAG
import { isVillain, villainAfter, villainClamp, villainKillPoints, VILLAIN } from '../../systems/wild/villainLaw.js'; // PVP-VILLAIN

/** The zone referee's own numbers: how long a bar carried from another room stands (`mendMs` - SHARED-HEALTH: no longer a
 *  heal; the name is kept for its pins and the client's readout, which hides a fight this quiet); how long a fall waits to be signed (PVP-REWARD: no pick - the service rolls the piece; the wait lets the fallen's first dead frame lay its body); the party's truce
 *  (systems/wild/wildZone.js WILD_PARTY_TRUCE_MS, pinned equal - the hub holds it for the relay); how long a fallen stays down
 *  before its word that it stands in the zone raises it (the death screen's WILD_DEATH_HOLD_S, pinned equal - AUDIT INT9:
 *  it rose on its next word, where it fell, whole), and how long one away from the zone that long comes back whole; how
 *  long a fighter whose pose jumped past any run strikes nothing (AUDIT INT9: a jump was never believed, so a gallop, a
 *  respawn or a reconnect left its place stale for good - now it is believed, and the jumper waits); the most fighters
 *  and falls a room keeps; AUDIT FOE-KEEPS E2: how recent a fair player's blow names them the killer of a death the
 *  referee did not see (systems/wild/wildZone.js WILD_KILL_CREDIT_MS, pinned equal - "the player who brought you down"). */
export const WILD_REF = Object.freeze({
  mendMs: 30_000,
  pickMs: 10_000,
  truceMs: 10 * 60_000,
  riseMs: 10_000,
  awayMs: 60_000,
  jumpMs: 2_000,
  fightersMax: 200,
  fallsMax: 64,
  creditMs: 10_000,
});

/** ZONE-GRACE (2026-10-26, the owner chose "Entry/rise grace"): safe passage's length (the owner's sixty seconds), and what
 *  an entry asks first - away from the zone this long, and no blow landed by or on the fighter this long. */
export const WILD_GRACE = Object.freeze({ ms: 60_000, awayMs: 30_000, fightMs: 60_000 });

/** MAC'S DECISION (2026-10-14, "Guildmates are friends"): ONE GUILD - two guilds' marks, each present and the same. A
 *  mark is the relay's verified guild id (the token's `gi`) or a client's guild tag (`gt` - a tag is one guild's alone,
 *  UNIQUE in the service's `guilds`), never one of each. */
export const sameGuild = (/** @type {unknown} */ a, /** @type {unknown} */ b) =>
  typeof a === 'string' && a.length > 0 && a === b;

/**
 * MAC'S DECISION (2026-10-14): WHO IS KIN IN THE ZONE - never a fair foe, struck by nobody: one of my party or under its
 * truce (`party` - the hub's word at the relay, the social picture and the truce book on a client), my own duel's
 * opponent (`duel` - its blows are the duel's), or one of my guild (`guilds`, the two guilds' marks - sameGuild). ONE LAW,
 * BOTH ENDS: the referee asks it of every blow and cast (server/src/index.js `_wildBlow`, before wildBlow below), every
 * client door asks it of its targets (scenes/world.js wildFair), and the remains' friend law reads its guild half
 * (`_wildWord`, world.js canTake). Answers whether the two are kin.
 * @param {{ party?: boolean, duel?: boolean, guilds?: unknown[] | null }} o
 */
export function wildKin({ party = false, duel = false, guilds = null } = {}) {
  return !!party || !!duel || (Array.isArray(guilds) && sameGuild(guilds[0], guilds[1]));
}

/** A room's zone: its fighters by account, its falls waiting on a pick or a signature. */
export const newWildRef = () => ({ fighters: new Map(), falls: new Map(), fights: new Map() });

/**
 * A SOCKET'S WORD ON THE ZONE (`zone` - `z` true: it stands in the zone; false: it has left it): its fighter made or
 * kept (`id` its socket's id now, `lv` the Renown its token signs, `cl` its character level, `ci` its realm character, `ed` its word that it walked in over the edge, `vl` the villain meter its token signs, `sf` its word that it stands in a settlement's safe streets), its place the pose it
 * stands at. A NEW fighter takes the vitality it CARRIES (`carry` - the hub's word on its last fight in another room:
 * `{ hp, max, down, downAt, at, heard }`, AUDIT INT9: a step into another cell was a fresh bar), unless that word is
 * older than WILD_REF.mendMs. A fighter down rises on its word that it stands in the zone again once WILD_REF.riseMs has
 * passed (its respawn - never at once), its count started again; so does one away from the zone WILD_REF.awayMs. One back
 * sooner keeps its bar (AUDIT INT9: a word off and on was a heal). SHARED-HEALTH: a count started again waits for the player's report, which can lower it and never lift it.
 * Answers the fighter, or null (none made: a word off, a full room).
 */
export function wildZone(
  st,
  sub,
  { id, lv = 1, cl = null, ci = '', carry = null, died = false, fl = null, ed = false, vl = 0, sf = false },
  z,
  pose,
  now,
) {
  let x = st.fighters.get(sub);
  if (!x) {
    if (!z) return null;
    if (st.fighters.size >= WILD_REF.fightersMax)
      for (const [k, v] of st.fighters)
        if (!v.zone && !v.down) {
          st.fighters.delete(k);
          break;
        }
    if (st.fighters.size >= WILD_REF.fightersMax) return null;
    x = {
      id,
      ci: ci || '',
      f: newFighter(lv, now),
      pose: pose ? { x: pose.x, y: Number.isFinite(pose.y) ? pose.y : 0, z: pose.z } : null,
      poseAt: now,
      zone: false,
      zoneAt: now,
      outAt: -Infinity,
      struckAt: -Infinity,
      down: false,
      downAt: -Infinity,
      jumpAt: -Infinity,
      fightAt: -Infinity,
      graceUntil: -Infinity,
      diedAt: -Infinity,
    };
    takeCarry(x, carry, now);
    st.fighters.set(sub, x);
  } else if (z && !x.zone && carry && carry.at > x.outAt) takeCarry(x, carry, now); // it fought in another room since it left this one
  x.id = id;
  if (ci) x.ci = ci;
  if (Number.isSafeInteger(cl)) x.cl = cl; // PVP-30: the character level its token signs
  if (villainClamp(vl) > villainClamp(x.vi)) x.vi = villainClamp(vl); // PVP-VILLAIN-KEEP: the meter its token signs, where it is the larger
  // PVP-FLAG: a word with its flag - up at once, down only past the lock after its last fight; a word with none keeps it.
  // PVP-30: never up under level 30
  if (pvpYoung(x.cl)) x.flag = false;
  else if (isVillain(x.vi))
    x.flag = true; // PVP-VILLAIN: a villain is always in aggro
  else if (fl === 0 && pvpFlagCanDrop(Math.max(x.fightAt, x.struckAt), now)) x.flag = false;
  else if (fl === 1 || x.flag === undefined) x.flag = true;
  // PVP-DEATH (the PvP rework, 2026-10-29 - the owner: "when u die u need to take away player protection form ebing killed
  // again", "they go to town in a safe zone when dead"): a rise, or an entry after a death, has no safe passage
  const rose = z && x.down && now - x.downAt >= WILD_REF.riseMs;
  if (rose) {
    x.f = newFighter(lv, now);
    x.down = false;
    x.struckAt = -Infinity;
  }
  if (z && !x.zone) {
    // SHARED-HEALTH: back after long away, the count starts again from the player's own health (its next report)
    if (now - x.outAt >= WILD_REF.awayMs && !x.down) {
      x.f.hp = x.f.max;
      x.struckAt = -Infinity;
      resetHealthShare(x.f, now);
    }
    // ZONE-GRACE: an entry - away long enough, and out of every fight long enough; never after a death (PVP-DEATH, above -
    // a foe's death, `died` on its way out or `dd` carried, as well); PVP-EDGE: and only walked in over the edge (`ed`)
    if (!x.down && x.diedAt > -Infinity) x.diedAt = -Infinity;
    else if (
      !x.down &&
      !rose &&
      ed &&
      now - x.outAt >= WILD_GRACE.awayMs &&
      now - Math.max(x.fightAt, x.struckAt) >= WILD_GRACE.fightMs
    )
      x.graceUntil = Math.max(x.graceUntil, now + WILD_GRACE.ms);
    x.zoneAt = now;
  }
  if (!z && x.zone) x.outAt = now;
  if (!z && died && !x.down) x.diedAt = now; // AUDIT PVP-EASE L3-6: a death the referee kept rises by its own law (above)
  x.zone = !!z;
  x.streets = !!z && !!sf; // PVP-SAFE-HIT: wildStreetsBar reads it
  return x;
}

/** PVP-SAFE-HIT (the owner: "Let them hit them jit ge that back in safezone"): a fighter in a settlement's safe streets
 *  (`streets`, its own word) and no villain on the meter this room keeps strikes a villain alone, and nobody strikes it.
 *  A villain's word on the streets shields nothing: the meter is the referee's. Answers why a blow is refused, or null.
 *  @param {any} a the striker @param {any} t the struck */
export function wildStreetsBar(a, t) {
  if (t.streets && !isVillain(t.vi)) return 'streets';
  if (a.streets && !isVillain(a.vi) && !isVillain(t.vi)) return 'streets';
  return null;
}

/** A fighter takes the vitality it carries from another room (`carry` - wildCarry's word, kept by the hub), unless that word
 *  is older than the mend (or, for a fall, the rise). AUDIT PVP-EASE L3-1, L3-2, L3-5: and ZONE-GRACE's whole word, of any
 *  age - its last fight (`fa`), whether it stands in the zone still by the last room's word (`in` 1: a cell crossed, a room
 *  woken from its sleep - never an entry), when it left it (`at`), its safe passage left or ended (`gr`), and a death the
 *  referee did not keep (`dd`). Before, a fighter that had struck, or been struck more than the mend ago, carried
 *  nothing: each cell it crossed and each room that woke granted it a fresh minute. */
function takeCarry(x, carry, now) {
  if (!carry || !Number.isFinite(carry.at)) return;
  if (Number.isFinite(carry.fa)) x.fightAt = Math.max(x.fightAt, carry.fa);
  if (Number.isSafeInteger(carry.vi)) x.vi = carry.vi; // PVP-VILLAIN: the meter, of any age (it never decays)
  x.outAt = carry.in === 1 ? now : Math.max(x.outAt, carry.at);
  x.graceUntil = Number.isFinite(carry.gr) && carry.gr > now ? carry.gr : -Infinity; // ZONE-GRACE: the safe passage it had there - or none
  if (Number.isFinite(carry.dd)) x.diedAt = Math.max(x.diedAt, carry.dd);
  if (!(now - carry.at < Math.max(WILD_REF.mendMs, carry.down ? WILD_REF.riseMs : 0))) return; // the bar and the fall: a word of a moment ago alone
  if (carry.down && now - carry.downAt < WILD_REF.riseMs) {
    x.down = true;
    x.downAt = carry.downAt;
    x.f.down = true;
    x.f.hp = 0;
    return;
  }
  if (Number.isFinite(carry.hp) && carry.hp < x.f.max) {
    x.f.hp = Math.max(1, Math.min(x.f.max, Math.trunc(carry.hp)));
    x.struckAt = carry.at;
  }
  // SHARED-HEALTH: a count anchored in the last room is the player's health already - its next report is a loss or a
  // heal on it, never an anchor that could lift it back to whole
  if (carry.heard && x.f.share) x.f.share.heard = true;
  if (x.f.share) x.f.share.report = carry.rep; // the last report this count took: the client's first word here keeps what its health did since
  if (x.f.share) x.f.share.playerBlowAt = carry.pvpAt; // and its no-heal window: a step into another cell is no way out of a fight
  vitalsTake(x.f, carry, now); // PVP-VITALS: and its ledgers - a cell crossed fills nothing
}

/** INT9 (AUDIT): a hub's word on a fighter's carry, checked for the shape wildCarry writes - or null. AUDIT SEA VENTURES
 *  F1/A1: with its ship's where it has one (`sea` - net/sea/seaRef.js seaCarry: her bar's share and when a captain last
 *  struck her). */
export function wildCarryOf(v) {
  if (!v || typeof v !== 'object' || !Number.isFinite(v.at) || !Number.isFinite(v.hp) || !Number.isFinite(v.max))
    return null;
  const sea =
    v.sea && typeof v.sea === 'object' && Number.isFinite(v.sea.h) && Number.isFinite(v.sea.at)
      ? { h: Math.max(0, Math.min(1, v.sea.h)), at: v.sea.at }
      : null;
  const grace = Number.isFinite(v.gr) ? { gr: v.gr } : {}; // ZONE-GRACE
  const pass = {
    ...(Number.isFinite(v.fa) ? { fa: v.fa } : {}),
    ...(v.in === 1 ? { in: 1 } : {}),
    ...(Number.isFinite(v.dd) ? { dd: v.dd } : {}),
    ...(typeof v.lr === 'string' && v.lr.length <= 96 ? { lr: v.lr } : {}),
    ...(Number.isSafeInteger(v.vi) && v.vi > 0 ? { vi: Math.min(VILLAIN.max, v.vi) } : {}),
  }; // AUDIT PVP-EASE L3-1 (`lr`, the last room: a foes frame's `rk` is a raid's, and the relay reads none - test/systems/raid2_raidsOnline.test.js)
  return {
    hp: Math.max(0, Math.trunc(v.hp)),
    max: Math.max(1, Math.trunc(v.max)),
    down: v.down === true,
    downAt: Number.isFinite(v.downAt) ? v.downAt : 0,
    at: v.at,
    heard: v.heard === true,
    pvpAt: Number.isFinite(v.pvpAt) ? v.pvpAt : 0,
    rep: Number.isSafeInteger(v.rep) && v.rep >= 0 ? v.rep : 0,
    ...grace,
    ...pass,
    ...(sea ? { sea } : {}),
    ...(Number.isFinite(v.mp) && Number.isFinite(v.fp) ? { mp: v.mp, fp: v.fp } : {}),
  }; // PVP-VITALS   // SHARED-HEALTH: `heard` - its count anchored to the player's health
}

/** INT9 (AUDIT): A FALL WAITING ON ITS PICK is kept in the room's storage under this prefix (a relay object that restarts
 *  mid-wait signed it never - no drop at all), and read back the first time the restarted room's zone is asked. */
export const WILD_FALL_PREFIX = 'wildfall:';
/** A fall read back from storage, checked for the shape wildBlow writes - or null. */
export function wildFallOf(v) {
  if (
    !v ||
    typeof v !== 'object' ||
    typeof v.r !== 'string' ||
    typeof v.fallen !== 'string' ||
    typeof v.killer !== 'string' ||
    !Number.isFinite(v.at)
  )
    return null;
  return {
    r: v.r,
    fallen: v.fallen,
    fallenId: typeof v.fallenId === 'string' ? v.fallenId : '',
    ci: typeof v.ci === 'string' ? v.ci : '',
    killer: v.killer,
    killerId: typeof v.killerId === 'string' ? v.killerId : '',
    kc: typeof v.kc === 'string' ? v.kc : '',
    m: typeof v.m === 'string' ? v.m : '',
    at: v.at,
    w: Number.isInteger(v.w) ? v.w : -1,
    wt: Array.isArray(v.wt) && v.wt.length === 2 ? [v.wt[0], v.wt[1]] : null,
    picked: v.picked === true,
    vp: Number.isSafeInteger(v.vp) && v.vp > 0 ? Math.min(VILLAIN.max, v.vp) : 0,
  };
}

/** A FIGHTER'S SOCKET GONE from the room (no other of its account's left): out of the zone, and its place in a full room
 *  any newcomer's (AUDIT INT9: a closed tab kept its `zone` for good, and a room of 200 such refused every newcomer). */
export function wildGone(st, sub, now) {
  const x = st.fighters.get(sub);
  if (x && x.zone) {
    x.zone = false;
    x.outAt = now;
  }
}

/** What a fighter CARRIES out of this room (the hub keeps it for the next room it stands in): its vitality and its fall (SHARED-HEALTH: its count's anchor, its no-heal window and its last report) -
 *  ZONE-GRACE: and its safe passage (`gr`), so a cell crossed ends none. A crossing is never an entry (AUDIT PVP-EASE L3-1):
 *  the carry says whether it stands in the zone (`in`), its last fight (`fa`) and a death the referee did not keep (`dd`),
 *  and the relay puts it as a fighter comes and goes (an entry, a leave, a socket gone, a death), when its passage ends
 *  (its blow, its take) and at a landed blow on it (its bar). A striker's blow puts none: while it stands in the zone the
 *  hub's word is `in` - no room grants it a minute - and its leave carries the fight. */
export const wildCarry = (st, sub, now) => {
  const x = st.fighters.get(sub);
  if (!x) return null;
  const grace = x.graceUntil > now ? { gr: x.graceUntil } : {};
  const pass = {
    ...(Number.isFinite(x.fightAt) ? { fa: x.fightAt } : {}),
    ...(x.zone ? { in: 1 } : {}),
    ...(x.diedAt > -Infinity ? { dd: x.diedAt } : {}),
    ...(x.vi > 0 ? { vi: x.vi } : {}),
  }; // PVP-VILLAIN: `vi`
  return {
    hp: Math.max(0, x.f.hp),
    max: x.f.max,
    down: x.down,
    downAt: Number.isFinite(x.downAt) ? x.downAt : 0,
    at: now,
    heard: x.f.share?.heard === true,
    pvpAt: x.f.share?.playerBlowAt ?? 0,
    rep: x.f.share?.report ?? 0,
    ...grace,
    ...pass,
    ...(vitalsCarry(x.f) ?? {}),
  }; // SHARED-HEALTH: its count's anchor, its no-heal window and its last report; PVP-VITALS: its ledgers
};
/** AUDIT PVP-EASE L3-4 (the owner: "Any take ends passage"): a fighter that takes from a remains - its own or another's -
 *  loses its safe passage, as its own blow ends it. Answers whether one ended. */
export function wildGraceTaken(st, sub, now) {
  const x = st.fighters.get(sub);
  if (!x || !(x.graceUntil > now)) return false;
  x.graceUntil = -Infinity;
  return true;
}
/** ZONE-GRACE: how long a fighter's safe passage has left, ms - 0 for none. */
export const wildGraceLeft = (/** @type {any} */ st, /** @type {string} */ sub, /** @type {number} */ now) => {
  const x = st.fighters.get(sub);
  return x && x.graceUntil > now ? Math.ceil(x.graceUntil - now) : 0;
};

/** A FIGHTER'S POSE (`{ x, y, z }`, the world frame): believed at a run the referee allows (refereeStep, on the fighter's
 *  own carried allowance); past it - a gallop, a respawn, a teleport - believed too, and the fighter JUMPED: it strikes
 *  nothing for WILD_REF.jumpMs (AUDIT INT9: a pose past the run was never believed, and the place stayed stale for good). */
export function wildPose(st, sub, p, now) {
  const x = st.fighters.get(sub);
  if (!x || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
  if (x.pose && !refereeStep(x.pose, p, now - x.poseAt, x.f)) x.jumpAt = now;
  else if (x.pose && x.flag && x.zone)
    runPaid(x.f, Math.hypot(p.x - x.pose.x, p.z - x.pose.z) / SIEGE_UNITS_PER_M, now - x.poseAt, now); // PVP-VITALS: a run's fatigue
  x.pose = { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z };
  x.poseAt = now;
  return true;
}

/** A client before world277 never answers the ask or reports its health, so its count stays unheard: it keeps the zone's old
 *  mend (whole again unstruck WILD_REF.mendMs and in the zone as long), or a struck player would lie at the lowered count
 *  until it died. A count a report has anchored is the player's own health and mends by its own report alone. */
const mendUnheard = (x, now) => {
  if (x.down || x.f.share?.heard) return;
  if (now - x.struckAt >= WILD_REF.mendMs && now - x.zoneAt >= WILD_REF.mendMs) x.f.hp = x.f.max;
};

/**
 * A BLOW OR A CAST in the zone - `by` and `to` accounts, `kin` the caller's wildKin over the two (one party or its truce,
 * a duel's two, one guild - asked by the relay before it): landed only between two fighters
 * that both stand in the zone, neither down, never kin; judged by the referee (a strike on the weapon `held` its look
 * carries and the arms `wa` its token signs; a cast, `r` SIEGE_HIT.Spell, to its harm's most and rate). A fall makes the
 * fall record (`r` the remains' id the caller minted) - its killer the striker, `room` the room that refereed it (SEA-BOUNTY:
 * signed into its receipt, `m`). ZONE-GRACE: a striker under safe passage loses it (`graceEnded`), and a struck one under it
 * takes nothing (`why` 'grace'). Answers `{ ok, dealt, fell, fall, why, graceEnded? }`.
 * @param {any} st @param {string} by @param {string} to
 * @param {{ d?: number, r?: number, held?: any, wa?: any, kin?: boolean, rid?: string, room?: string, el?: number|null, c?: number|null, roll?: () => number }} o
 * @param {number} now
 */
export function wildBlow(
  st,
  by,
  to,
  {
    d = 0,
    r = SIEGE_HIT.Melee,
    held = null,
    wa = null,
    kin = false,
    rid = '',
    room = '',
    el = null,
    c = null,
    roll = Math.random,
  } = {},
  now,
) {
  const a = st.fighters.get(by),
    t = st.fighters.get(to);
  if (!a || !t || by === to) return { ok: false, dealt: 0, fell: false, fall: null, why: 'no-fighter' };
  if (!a.zone || !t.zone) return { ok: false, dealt: 0, fell: false, fall: null, why: 'zone' };
  if (a.down || t.down) return { ok: false, dealt: 0, fell: false, fall: null, why: 'down' };
  if (kin) return { ok: false, dealt: 0, fell: false, fall: null, why: 'kin' };
  if (pvpYoung(a.cl) || pvpYoung(t.cl)) return { ok: false, dealt: 0, fell: false, fall: null, why: 'young' }; // PVP-30: under level 30 no player strikes or is struck
  const streets = wildStreetsBar(a, t); // PVP-SAFE-HIT: the safe streets
  if (streets) return { ok: false, dealt: 0, fell: false, fall: null, why: streets };
  if (!a.flag) return { ok: false, dealt: 0, fell: false, fall: null, why: 'unflagged' }; // PVP-FLAG: an unflagged striker touches no player - the struck one's flag never shields it
  if (now - a.jumpAt < WILD_REF.jumpMs) return { ok: false, dealt: 0, fell: false, fall: null, why: 'jump' };
  // ZONE-GRACE: my blow on a fair player ends my safe passage; theirs keeps them from it
  const graceEnded = a.graceUntil > now;
  if (graceEnded) a.graceUntil = -Infinity;
  if (t.graceUntil > now) return { ok: false, dealt: 0, fell: false, fall: null, why: 'grace', graceEnded };
  mendUnheard(a, now);
  mendUnheard(t, now);
  // PVP-VITALS: a cast paid from the relay's magicka, a swing from its fatigue - one it cannot pay lands nothing
  const spell = r === SIEGE_HIT.Spell;
  if (r === SIEGE_HIT.Shaft ? !shaftPaid(a.f, now) : r === SIEGE_HIT.Melee && !swingPaid(a.f, to, now))
    return { ok: false, dealt: 0, fell: false, fall: null, why: 'rate', graceEnded }; // BOW-RATE, SWING-RATE
  if (spell ? !castPaid(a.f, c, to, now) : !payFatigue(a.f, PVP_VITALS.swing, now))
    return { ok: false, dealt: 0, fell: false, fall: null, why: spell ? 'magicka' : 'tired', graceEnded };
  if (r === SIEGE_HIT.Shaft) d = bowFastCut(a.f, d, now, held?.w ?? null); // BOW-FAST: the game sends a shaft's claim uncut
  const evaded = !spell && roll() * 100 < pvpEvadeChance(t.f, a.cl ?? null, t.cl ?? null); // PVP-EVADE: after the striker's own hit roll, `why` 'evade'
  const res =
    r === SIEGE_HIT.Spell
      ? refereeCast(a.f, t.f, { from: a.pose, at: t.pose, d, el }, now)
      : refereeBlow(a.f, t.f, { from: a.pose, at: t.pose, held, d: evaded ? 0 : d, r, wa }, now);
  if (evaded && res.ok) {
    a.fightAt = now;
    t.fightAt = now;
    wildOpen(st, by, to, now);
    return { ok: true, dealt: 0, fell: false, fall: null, why: 'evade', graceEnded };
  } // the reach and the rate still judged
  if (!res.ok || !res.dealt) return { ok: res.ok, dealt: 0, fell: false, fall: null, why: res.why, graceEnded };
  if (spell) absorbLanded(t.f, now); // PVP-VITALS: a paid Absorb takes the cast's price back
  t.struckAt = now;
  a.fightAt = now;
  t.fightAt = now; // ZONE-GRACE: a fight, for an entry's ask
  wildOpen(st, by, to, now); // PVP-VILLAIN: who struck first
  t.by = { sub: by, at: now, room: typeof room === 'string' ? room : '' }; // AUDIT FOE-KEEPS E2: the last fair player's blow
  if (!res.fell) return { ok: true, dealt: res.dealt, fell: false, fall: null, why: null, graceEnded };
  const { fall, evicted } = fallOf(st, rid, to, t, by, a, room, now);
  return { ok: true, dealt: res.dealt, fell: true, fall, evicted, why: null, graceEnded };
}

/** A fighter `t` (account `to`) down at `a`'s hand (account `by`): its fall record under `rid` (the caller's), the room
 *  `room` that refereed it. A full room's oldest fall is SIGNED without its pick, never forgotten (AUDIT INT9: one pushed
 *  out was never signed - no drop at all): the caller signs `evicted`. */
function fallOf(
  /** @type {any} */ st,
  /** @type {string} */ rid,
  /** @type {string} */ to,
  /** @type {any} */ t,
  /** @type {string} */ by,
  /** @type {any} */ a,
  /** @type {unknown} */ room,
  /** @type {number} */ now,
) {
  t.down = true;
  t.downAt = now;
  t.by = null;
  // WILD-REJOIN: where the body lies, kept with the fighter after the fall is signed and forgotten - a fallen whose game
  // closed and comes back to this room is told it (wildDownWord), so the drop it takes is laid where it fell
  t.fell = { r: rid, at: now, pose: t.pose ? { ...t.pose } : null };
  let evicted = null;
  if (st.falls.size >= WILD_REF.fallsMax) {
    evicted = st.falls.values().next().value;
    evicted.picked = true;
    st.falls.delete(evicted.r);
  }
  // PVP-VILLAIN: the kill's points - none where the fallen struck its killer first (its party's: the relay's, wildVillainy)
  const vp = villainKillPoints({
    killer: a.cl ?? null,
    victim: t.cl ?? null,
    flagged: !!t.flag,
    defended: wildFirst(st, by, to, now) === to,
  });
  const fall = {
    r: rid,
    fallen: to,
    fallenId: t.id,
    ci: t.ci,
    killer: by,
    killerId: a.id,
    kc: a.ci || '',
    m: typeof room === 'string' ? room : '',
    at: now,
    w: -1,
    wt: null,
    picked: false,
    vp,
  }; // SEA-BOUNTY: the killer's character and the room, for the receipt
  st.falls.set(rid, fall);
  return { fall, evicted };
}

/** AUDIT FOE-KEEPS E2 (the owner, 2026-10-24, asked: "Credit the last player"): A DEATH THE REFEREE DID NOT SEE - the
 *  fighter's own word that it died (`zone` 0 with `dd`: a foe, a fall, the sea, a hall's trap) - is the kill of the last
 *  fair player whose blow landed on it within WILD_REF.creditMs, as the duel's referee counts a fighter fallen to
 *  something else its opponent's win and the sea's credits a wreck to a captain's shot: its fall made as a blow's is, in
 *  the room that last blow was refereed in. None when no player struck it that lately, it is down already, or its striker
 *  has left the room's memory. Answers `{ fall, evicted }` or null. */
export function wildCredit(
  /** @type {any} */ st,
  /** @type {string} */ sub,
  /** @type {string} */ rid,
  /** @type {number} */ now,
) {
  const t = st.fighters.get(sub),
    by = t?.by;
  if (!t || t.down || !by || !(now - by.at <= WILD_REF.creditMs)) return null;
  const a = st.fighters.get(by.sub);
  if (!a || by.sub === sub) return null;
  return fallOf(st, rid, sub, t, by.sub, a, by.room, now);
}

/** THE KILLER'S PICK (`w` - its place in the fallen's worn offer; `wt` - the piece's template and material as the offer
 *  showed it, `[t, m]`, which the service matches against what the fallen really wears, AUDIT INT9: the place alone was an
 *  index into a list the fallen built): its own fall's, once, inside WILD_REF.pickMs. Answers the fall, now ready to
 *  sign, or null. */
export function wildPick(st, killer, rid, w, now, wt = null) {
  const fall = st.falls.get(rid);
  if (!fall || fall.killer !== killer || fall.picked || now - fall.at > WILD_REF.pickMs) return null;
  if (!Number.isInteger(w) || w < -1 || w >= 16) return null;
  fall.w = w;
  fall.picked = true;
  if (Array.isArray(wt) && wt.length === 2 && wt.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 65536))
    fall.wt = [wt[0], wt[1]];
  return fall;
}

/** A FALL SIGNED AT ONCE, without its pick - where no body is searched (a building's or a dungeon's room: the worn offer is
 *  the open country's). Answers the fall, or null. */
export function wildSignNow(st, rid) {
  const fall = st.falls.get(rid);
  if (!fall || fall.picked) return null;
  fall.picked = true;
  return fall;
}

/** A fall SIGNED: forgotten here (the receipt is the service's from now). */
export const wildSigned = (st, rid) => {
  st.falls.delete(rid);
};

/** ONE BEAT (the relay calls it on the frames the room takes - no alarm): every fall whose killer has not picked inside
 *  WILD_REF.pickMs is ready to sign without a piece. Answers them. */
export function wildStep(st, now) {
  const out = [];
  for (const fall of st.falls.values())
    if (!fall.picked && now - fall.at > WILD_REF.pickMs) {
      fall.picked = true;
      out.push(fall);
    }
  return out;
}

/** WILD-REJOIN: the least time a fallen must still have to lie for the referee to tell it so, ms. Its own game counts its
 *  two minutes from the fall on its own clock, and a death in a hall rises in a town of the zone - so a risen fallen
 *  can stand in the zone a moment before the referee's clock lets it up. Under this margin the word would kill it again. */
export const WILD_DOWN_SAY_MIN_MS = 5_000;

/**
 * WILD-REJOIN (FIELD BUGS 2026-10-25h, "if you die in the wilderness and alt f4 before you are looted ... you can also skip
 * the death timer this way"): THE REFEREE'S WORD TO A FALLEN THAT IS STILL DOWN. A fall lives in the referee and on the
 * dying game's screen alone: the account service's record is the last save from before it (a dead character is never
 * saved), so a game closed on the death screen came back alive. The referee keeps the fighter down for WILD_REF.riseMs -
 * here, or by the hub's carry in another room - and answers `{ k: 'down', ms, r?, p? }` for the socket that says it
 * stands in the zone: how long the death has left, and, where the fall was refereed in this room, its remains' id and
 * where the body lies (`[x, y, z]`, the room's frame). Null for a fighter up, unknown, or with less than
 * WILD_DOWN_SAY_MIN_MS to lie.
 * @param {any} st @param {string} sub @param {number} now
 * @returns {{ k: 'down', ms: number, r?: string, p?: number[] } | null}
 */
export function wildDownWord(st, sub, now) {
  const fighter = st.fighters.get(sub);
  if (!fighter || !fighter.down) return null;
  const left = WILD_REF.riseMs - (now - fighter.downAt);
  if (left < WILD_DOWN_SAY_MIN_MS) return null;
  const word = { k: /** @type {'down'} */ ('down'), ms: Math.ceil(left) };
  // a fall carried from another room (takeCarry) has its downAt and no body here
  const body = fighter.fell && fighter.fell.at === fighter.downAt ? fighter.fell : null;
  if (!body) return word;
  const where = body.pose ? { p: [body.pose.x, body.pose.y, body.pose.z] } : {};
  return { ...word, r: body.r, ...where };
}

/** The fighters' vitality as the referee's word says it: `[[id, hp, max], [id, hp, max]]` for `a` and `b`. */
export const wildVitals = (st, a, b) =>
  [a, b].map((sub) => {
    const x = st.fighters.get(sub);
    return [x.id, Math.max(0, x.f.hp), x.f.max];
  });

/** PVP-SKULL: the flag word for a flagged fighter in aggro after a blow (`a`, the ms its skull stays gold), or null - said
 *  once each PVP_FLAG.sayMs while its blows go on, so a fight of many blows costs the room a word in ten seconds. */
export function wildAggroWord(x, now) {
  if (!x?.flag || now - (x.aggroSaid ?? -Infinity) < PVP_FLAG.sayMs) return null;
  x.aggroSaid = now;
  return { t: 'wref', k: 'flag', id: x.id, f: 1, a: pvpAggroLeft(Math.max(x.fightAt, x.struckAt), now), ...wildRed(x) };
}

/** PVP-SKULL: a flagged fighter's word to one entering - its aggro left riding it. */
export const wildFlagWord = (x, now) => ({
  t: 'wref',
  k: 'flag',
  id: x.id,
  f: 1,
  ...(pvpAggroLeft(Math.max(x.fightAt, x.struckAt), now)
    ? { a: pvpAggroLeft(Math.max(x.fightAt, x.struckAt), now) }
    : {}),
  ...wildRed(x),
});

/** PVP-BAR (the owner, 2026-10-29: "How does the health and shield bar look", then "Perfect" to its mockup): how often a
 *  room looks for a flagged fighter's bar that moved - so each is said at most once in that time. */
export const WILD_BAR = Object.freeze({ sayMs: 500 });

/** PVP-BAR: a flagged fighter's bar as the room hears it - its health in whole per cent (1 while it stands), and `s` a
 *  Shield's share in per cent of its top (PVP-KIT: 10..25, 25 full). Null for a pool no report anchored. */
export function wildBarWord(x) {
  const f = x?.f;
  if (!f || !f.share?.heard || !(f.max > 0)) return null;
  const hp = Math.max(0, f.hp);
  const h = hp > 0 ? Math.max(1, Math.min(100, Math.round((100 * hp) / f.max))) : 0;
  return {
    t: 'wref',
    k: 'bar',
    id: x.id,
    h,
    ...(f.share.shield > 0 ? { s: Math.min(100, Math.round(f.share.shield * 4)) } : {}),
  };
}

/** PVP-BAR: the bars that moved since the room last said them - flagged fighters in the zone alone, the room's whole look
 *  at most once each WILD_BAR.sayMs. A fighter unflagged or gone forgets its last bar, so its next flag says it again. */
export function wildBarWords(st, now) {
  if (now - (st.barAt ?? -Infinity) < WILD_BAR.sayMs) return [];
  st.barAt = now;
  const out = [];
  for (const x of st.fighters.values()) {
    if (!x.flag || !x.zone) {
      x.barSaid = undefined;
      continue;
    }
    const w = wildBarWord(x);
    const key = w ? `${w.h}/${w.s ?? 0}` : undefined;
    if (!w || key === x.barSaid) continue;
    x.barSaid = key;
    out.push(w);
  }
  return out;
}

/** PVP-VILLAIN: a pair's fight key (the order of the two never matters). */
const fightKey = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** The most fights a room keeps; past it the stale are dropped first, then the oldest. */
const FIGHTS_MAX = 512;

/** PVP-VILLAIN: a landed blow `by` on `to` - a fight between them opened by `by` when none is fresh (a blow between the
 *  two inside PVP_FLAG.lockMs - the aggro's minute), else kept fresh. */
export function wildOpen(
  /** @type {any} */ st,
  /** @type {string} */ by,
  /** @type {string} */ to,
  /** @type {number} */ now,
) {
  const fights = (st.fights ??= new Map()),
    key = fightKey(by, to),
    was = fights.get(key);
  if (was && now - was.at < PVP_FLAG.lockMs) {
    was.at = now;
    return;
  }
  if (fights.size >= FIGHTS_MAX) for (const [k, v] of fights) if (now - v.at >= PVP_FLAG.lockMs) fights.delete(k);
  if (fights.size >= FIGHTS_MAX) fights.delete(fights.keys().next().value);
  fights.delete(key);
  fights.set(key, { first: by, a: by, b: to, at: now });
}

/** PVP-VILLAIN: who struck first in the fresh fight between `a` and `b`, or null. */
export function wildFirst(
  /** @type {any} */ st,
  /** @type {string} */ a,
  /** @type {string} */ b,
  /** @type {number} */ now,
) {
  const f = st.fights?.get(fightKey(a, b));
  return f && now - f.at < PVP_FLAG.lockMs ? f.first : null;
}

/** PVP-VILLAIN: every account `sub` struck first in a fight still fresh - the relay asks whether one is its killer's party. */
export function wildOpenedBy(/** @type {any} */ st, /** @type {string} */ sub, /** @type {number} */ now) {
  const out = [];
  for (const f of st.fights?.values() ?? [])
    if (f.first === sub && now - f.at < PVP_FLAG.lockMs) out.push(f.a === sub ? f.b : f.a);
  return out;
}

/** PVP-VILLAIN: a fall's points laid on its killer's meter - none where `partyFirst` (the fallen struck one of the
 *  killer's party first; the relay asks the hub). Answers `{ vi, turned }`: the meter now, and whether it went red. */
export function wildVillainy(
  /** @type {any} */ st,
  /** @type {any} */ fall,
  /** @type {boolean} */ partyFirst = false,
) {
  if (partyFirst) fall.vp = 0;
  const x = st.fighters.get(fall.killer);
  if (!x) return { vi: 0, turned: false };
  const was = isVillain(x.vi);
  x.vi = villainAfter(x.vi, fall.vp);
  if (isVillain(x.vi)) x.flag = true;
  return { vi: x.vi, turned: !was && isVillain(x.vi) };
}

/** PVP-VILLAIN: a fighter's red mark on its flag word (`v` 1), or nothing. */
export const wildRed = (/** @type {any} */ x) => (isVillain(x?.vi) ? { v: 1 } : {});

/** PVP-VILLAIN-KEEP: what a realm character's hello puts on its socket - its id (AUDIT LEGACY III O1) and the villain meter
 *  its token signs (`vl`, absent at 0), which wildZone seeds its fighter from. */
export const wildTokenAtt = (/** @type {any} */ who) => ({
  ci: who.ci,
  ...(Number.isSafeInteger(who.vl) && who.vl > 0 ? { vl: villainClamp(who.vl) } : {}),
});
