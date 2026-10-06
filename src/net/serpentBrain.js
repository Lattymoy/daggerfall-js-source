// @ts-check
// SERPENT1 (2026-10-04, Mac: "a new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"; "make this something truly special"): THE SERPENT'S BRAIN - the whole of what the relay runs
// for Sethrakul's fight, as pure law: its health and who brought it, how it swims, what it does to the ships about it,
// and what a blow on it is worth. Design: bible/11-Multiplayer/Sea-Serpent.md sections 4-7.
//
// THE GATE'S LAW AT SEA (net/gateBrain.js - Option B: the relay's Durable Object is the authority over a world boss).
// The gate could run on the relay because its boss stands on a disc with nothing to path round; the serpent can because
// the sea is the same - open water with nothing in it but the ships, and the ships are their players' poses, which the
// relay already holds. Its whole world is a body (net/serpentBody.js - a few legs of path, the way it rides the sea), a
// health bar, a clock and the poses about it. THE FIGHT LIVES IN THE CELL ROOM ITS SITE STANDS IN (server/src/index.js),
// whichever socket of a player's reaches it - its own cell's or a halo's (RAID3's law).
//
// THE SHIPS' LAW. A blow on it is a ball (or a fire barrel) the striker's own machine flew and saw strike one of its
// segments (scenes/navalHost.js - the shots' targets); the number is the gun's own, and the relay's caps decide what
// lands. What a player BRINGS is their ship: each fighter's claim of the hull they sail (`hl`) sets both the health they
// bring the serpent and the damage they may deal (SHIP_REF - a reference broadside a second), so no claim buys a faster
// kill (the gate's law: the fastest possible is SERPENT_TTK_S / SERPENT_BUCKET_RATE_X of a full broadside whatever is claimed).
// A player aboard another's ship brings nothing and deals nothing with the guns - they earn their part by standing the
// fight out (SERPENT_STOOD_SHARE).
//
// ITS BLOWS ARE RESOLVED ON THE STRUCK PLAYER'S MACHINE (co-op's law, and the sea's victim's law - navalHost.js landHit):
// every attack's shape and moment is said here, and each client tests its own boat and its own feet against it
// (systems/serpentStrike.js). The relay never learns a ship's hurts.
//
// PURE. No clock of its own (every function takes `now`), no randomness of its own (an `rng` is handed in), no I/O - the
// relay owns the sockets, the alarm that steps this, the storage that checkpoints it, and the receipts.
//
// Not a DFU member. Ledger A (SERPENT1).
import {
  LEG, MODE, legFrom, headAt, bodyAt, headExposed, nearestExposed, spinePoint, onTimeline, sameLeg, sameMode, coilAngleAt,
  BODY_LEN, LEGS_KEPT, MODES_KEPT, COIL_R, COIL_BLEND_MS, SWIM_MIN_V, DRIFT_V,
} from './serpentBody.js';
import { poseTsDiff } from './wire.js';   // AUDIT SHIPS A1: a ship's way off her own poses' send times
import { SERPENT_BRAIN_V } from './serpentLaw.js';   // AUDIT SHIPS B7: the law a fight was stepped by

// ── the waters ─────────────────────────────────────────────────────────
/** The serpent's head keeps within this of its site (m) - its waters, the ring the storm closes round at the seal. */
export const ARENA_R = 420;
/** A player within this of the site is AT the fight - chosen, struck at, standing their time (m). */
export const ENGAGE_R = 900;
/** An `in` is heard from a pose within this of the site (m): a ship sighting it from its waters' edge. */
export const ADMIT_R = 1500;
/** The relay says the fight to every socket within this of the site (m) - a watcher on a headland sees it too. */
export const FAN_R = 3000;
/** How far a gun reaches - the farthest a ball flies from a deck (navalShips.js: the heavy guns' 263 m), and slack -
 *  and the pose's own slack: a pose is the player at the helm, aft, and a broadside lies along the hull and up to a
 *  fifth of a second stale (m). */
export const GUN_REACH_M = 300;
export const SERPENT_POSE_SLACK = 45;

// ── the swim ───────────────────────────────────────────────────────────
/** Its speeds, m/s: cruising, under the sea, the ram's wind-up and its run, reared, adrift. */
export const CRUISE_V = 11;
export const DEEP_V = 14;
export const RAM_WIND_V = 6;
export const RAM_V = 34;
export const REAR_V = 4;
export { DRIFT_V };   // AUDIT SHIPS B6: adrift - serpentBody.js's, where the coil drawn turns at it
/** How tight it turns (m), the ring it circles a ship at (m) and how far ahead on it it aims (radians), the ring it
 *  circles the maelstrom's eye at (m). */
export const TURN_R = 60;
export const ORBIT_R = 120;
export const ORBIT_LEAD = 0.55;
export const MAEL_ORBIT_R = 85;
/** The ring it circles its waters' heart on as it first surfaces (m). */
export const RISE_RING = 160;
/** The steering: a turn is begun past STEER_TURN of error, a straight run within STEER_STRAIGHT (radians); no leg is
 *  cut shorter than LEG_MIN_MS unless an attack begins one. */
export const STEER_TURN = 0.35;
export const STEER_STRAIGHT = 0.12;
export const LEG_MIN_MS = 900;
/** SERPENT3 (2026-10-05, Mac: "the serpent world boss teleports"): IT NEVER LEAPS - every leg is swum from where the last
 *  left its head. Under the sea it DASHES at DASH_V (the ram's own run) for the place a Rising Maw bursts or a coil
 *  closes; a dash its wind-up cannot cover waits for it (the wind-up stretched, never shortened). Its jumps placed the
 *  whole 168 m body somewhere new in one frame - a breach's a median 195 m, a coil's up to a kilometre, the
 *  Maelstrom's turn 230-480 m, a stray's 384 m - about 2.3 a minute, seen through the water. */
export const DASH_V = RAM_V;
/** SERPENT3: a fight its room has not stepped this long (ms) - nobody heard it - is RESUMED circling where its head was
 *  (serpentResume), never swum on out of its waters to be leapt back (the stray's surfacing it replaces). */
export const SERPENT_SLEEP_MS = 5000;
/** AUDIT SHIPS B1: a screen keeps a fight it no longer hears this long (ms - scenes/serpentHost.js SERPENT_HEARD_MS is
 *  this one): a sleep no longer than it may have been drawn on as it was said, so it is never taken up from its last
 *  beat - a dropped socket's return threw every screen still drawing it back up to 148 m. */
export const SERPENT_DRAWN_MS = 12_000;
/** SERPENT3: a dash begins this long after it is said (ms) - its head keeps its way meanwhile - so every screen holds the
 *  word before the head takes it: begun at the beat's own moment, a client a wire's time behind drew its old way and
 *  then snapped its head on by the dash's start (4 m at 150 ms). */
export const SERPENT_SAY_AHEAD_MS = 500;
/** SERPENT3: CLOSING - a Rising Maw or a coil chosen at a ship beyond the dash its own wind-up swims is not begun: it
 *  surges at her ON THE SURFACE at CLOSE_V (m/s) at the least - AUDIT SHIPS A1/D5: closeV, CLOSE_GAIN_V over her own way,
 *  which SAIL-FREE takes past CLOSE_V (a galleon's best is 16.2 m/s at the rated wind and twice it in a storm) - until she
 *  lies within that dash, and begins it then, its telegraph its own length; she outsails it SERPENT_CLOSE_MS (ms) and it
 *  chooses again. A wind-up stretched to a long dash gave every moving ship ten seconds to sail clear (a lone galleon won
 *  10 fights in 12, simulated). */
export const CLOSE_V = 20;
export const SERPENT_CLOSE_MS = 12_000;
/** AUDIT SHIPS A1: and never slower than the ship it closes on - its surge is CLOSE_GAIN_V (m/s) over her way
 *  (serpentWayOf), to DASH_V at most. At a fixed CLOSE_V a ship under SAIL-FREE's full sail outsailed every surge (a
 *  Carrack circles at 21.2 m/s in a 2 m/s wind, a galleon at 17.7), its Rising Maw was begun once a fight and a lone
 *  ship won half of hers; at 6 over her a lone ship at 21.2 m/s still won 2 fights in 36. */
export const CLOSE_GAIN_V = 8;
/** AUDIT SHIPS A1: the pace it surges at closing on `target` (m/s). */
export function closeV(f, target) {
  const p = f.players[target?.sub];
  return Math.min(DASH_V, Math.max(CLOSE_V, Math.hypot(p?.vx ?? 0, p?.vz ?? 0) + CLOSE_GAIN_V));
}
/** SERPENT3: how tight it turns HUNTING (m) - closing on a ship and dashing under her - where it cruises on TURN_R: at
 *  TURN_R a ship astern took it 9.4 s to face at CLOSE_V, and one lying still inside its round was circled, never faced. */
export const HUNT_TURN_R = 30;
/** SERPENT3: a blow is judged where the body lay when the ball struck - asked at its word's moment and back as far as
 *  these (ms): a volley is gathered HIT_GATHER_MS on its machine and the wire takes its time, and a blow struck as the
 *  body sounded was thrown away for the water over it when its word came. */
export const SERPENT_HIT_LOOKBACK_MS = Object.freeze([0, 500, 1000]);
/** AUDIT SERPENT E1: the serpent goes only at what it can reach - a body within this of its waters' heart (m); its head
 *  is aimed within ARENA_R and orbits its mark at ORBIT_R. */
export const SERPENT_TARGET_R = 600;
/** AUDIT SHIPS A1 (2026-10-06, Mac: "Audit everything"): IT LEADS ITS MARKS - a Rising Maw, a coil, the ram's lane, a spit
 *  and the tail's sweep are aimed where their ship WILL BE at their landing, her way held (serpentWayOf - her velocity
 *  off her own poses), as every hunter aims; and so is its surge when it closes (closeAim). Aimed where she stood, a ship
 *  under SAIL-FREE's full sail had sailed out of every mark before it landed, and a lone galleon won every fight from
 *  15.5 m/s (tools/serpentFleetSim.mjs) - SAIL-FREE gives one circling under full sail 13.3 m/s at the rated wind and
 *  17.7 at 2 m/s. A helm that turns or slows as the telegraph shows still sails out of it: that is a telegraph's use.
 *  Never led past SERPENT_LEAD_MAX_MS (ms). */
export const SERPENT_LEAD_MAX_MS = 9000;   // the ram's word to the end of its run (8.5 s) the longest
/** AUDIT SHIPS A1: how many times the ram's lane is led again by its run's own time to her (serpentBrain.js begin). */
export const RAM_LEAD_STEPS = 6;
/** AUDIT SHIPS A1: a ship's way - and her turn - are read off each new pose's change over the time its sender kept
 *  between them, eased over SERPENT_WAY_EASE_MS (ms - a jostled pose never throws it), forgotten (at rest) past
 *  SERPENT_WAY_STALE_MS (ms) without a pose, and never learned past SERPENT_WAY_MAX_V (m/s - a warp, a placing or a
 *  rebase is no way at all) or a turn past SERPENT_TURN_MAX (rad/s - no hull answers her helm faster). Her turn is held
 *  in the lead too: led straight, a ship circling the fight at a storm's 26 m/s was missed by 25 m. */
export const SERPENT_WAY_EASE_MS = 500;
export const SERPENT_WAY_STALE_MS = 3000;
export const SERPENT_WAY_MAX_V = 60;
export const SERPENT_TURN_MAX = 0.35;
/** AUDIT 2 XB8 (2026-10-06): HER CLOCK HELD TO THE RELAY'S - over every SERPENT_CLOCK_SPAN_MS (ms) of the relay's own time
 *  between her new poses, her send times must have kept within SERPENT_CLOCK_SKEW times of it, or her way is no way at
 *  all (she is aimed where she lies). A client stamping true poses with a clock run at an eighth read 20 m/s of way off
 *  a ship making 5 - unseen by anyone, where a forged place is seen where it says - and the Maw led at it burst on an
 *  honest ship 95 m off. */
export const SERPENT_CLOCK_SPAN_MS = 2000;
export const SERPENT_CLOCK_SKEW = 2;

// ── the clock of the fight ─────────────────────────────────────────────
export const SERPENT_TICK_MS = 250;
/** AUDIT 2 XB6 (2026-10-06): THE WORDS THAT LAY WHAT EVERY SCREEN DRAWS - its swim, its ride, an attack, its coil, the
 *  whirl, a phase's turn, its end. The relay keeps the fight before it says one (server/src/index.js _serpentSay): kept
 *  every SERPENT_CHECKPOINT_MS alone, after its words had gone out, a relay restarted woke it up to 1.25 s before what
 *  its screens held, and the short sleep's law (AUDIT SHIPS B1) kept that track as said - a head snapped 12-24 m on 3
 *  restarts in 48, and an attack telegraphed was dropped. */
export const SERPENT_TRACK_WORDS = Object.freeze(new Set(['sw', 'dv', 'atk', 'coil', 'cx', 'cb', 'cr', 'mael', 'ph', 'fell', 'gone']));
export const serpentSaysTrack = (frames) => frames.some((w) => SERPENT_TRACK_WORDS.has(w.k));
export const SERPENT_HP_SEND_MS = 250;
export const SERPENT_STATE_SEND_MS = 5000;
export const SERPENT_CHECKPOINT_MS = 2000;
export const SERPENT_STEP_MAX_MS = 1000;
/** AUDIT SERPENT S9: a fight read back from its checkpoint after a wake - its attack numbers go on PAST any it may have
 *  said since (a checkpoint is at most CHECKPOINT_MS old, and no attack is shorter than a second), so no client takes a
 *  new attack or coil for one it already lived through. */
export const SERPENT_WAKE_SEQ = 50;
export function serpentWoke(f) {
  f.seq = (Number.isSafeInteger(f.seq) ? f.seq : 0) + SERPENT_WAKE_SEQ;
  // AUDIT SHIPS B7: a fight checkpointed by a brain before this law (a relay's deploy mid-fight) is TAKEN UP at its next
  // beat as one long asleep - its attack in flight let go, its swim to come swum no more (serpentResume): the old law's
  // leaps and words-at-the-beat were said into it, and this law would have honoured them once
  if (!(f.bv >= SERPENT_BRAIN_V)) { f.bv = SERPENT_BRAIN_V; f.woke = 'law'; }
  return f;
}
/** It surfaces and circles this long after the fight is born before it strikes - time to see it. */
export const SERPENT_OPENING_MS = 10_000;
/** A target is kept this long before it looks again. */
export const SERPENT_TARGET_HOLD_MS = 8000;
/** After an attack's recovery, this long before the next is chosen. */
export const SERPENT_BREATH_MS = 900;
/** No attack more than SERPENT_REPEAT_MAX times running (gateBrain.js WB13f's law). */
export const SERPENT_REPEAT_MAX = 2;
/** The most accounts one fight remembers - its checkpoint's bound. */
export const SERPENT_FIGHTERS_MAX = 128;

// ── the numbers a claim sets ───────────────────────────────────────────
export const SERPENT_LV_MIN = 1;
export const SERPENT_LV_MAX = 60;
export const clampSerpentLv = (lv) => Math.max(SERPENT_LV_MIN, Math.min(SERPENT_LV_MAX, Number.isFinite(lv) ? Math.floor(lv) : SERPENT_LV_MIN));
/** The hulls (navalShips.js HULL - pinned equal): -1 is aboard no ship of one's own. */
export const HULLS = 5;
export const clampHull = (hl) => (Number.isInteger(hl) && hl >= 0 && hl < HULLS ? hl : -1);
/** A REFERENCE BROADSIDE A SECOND by hull - a battery's hull points over its reload, both sides and the chasers taken
 *  in turn (navalShips.js GUNS and HULL_BUILDS): the rowboat none, the Large Boat's swivels, the Small Ship's and the
 *  Carrack's long guns and chasers, the galley's long guns and great guns. */
export const SHIP_REF = Object.freeze([0, 3.6, 10, 13, 12]);   // AUDIT SERPENT T6: the Large Boat has no crew to its guns (reload x1.4) - 5 overstated what she can deal by two fifths
export const refOf = (hl) => SHIP_REF[clampHull(hl)] ?? 0;
/** Seconds of reference broadside the health a ship brings stands for. */
export const SERPENT_TTK_S = 180;
/** A fighter's damage bucket: refilled at SERPENT_BUCKET_RATE_X their reference a second, SERPENT_BUCKET_DEPTH_X deep (a broadside's
 *  whole weight on the head lands), no one blow over SERPENT_HIT_CAP_X of it. */
export const SERPENT_BUCKET_RATE_X = 1.5;   // AUDIT SERPENT T5: honest fire measures 0.25-0.4 of the reference; 3 gave a forged claim a 12-20x ceiling
export const SERPENT_BUCKET_DEPTH_X = 20;
export const SERPENT_HIT_CAP_X = 14;
/** The words of blows an account says a second (its machine gathers a volley's balls into one). */
export const SERPENT_HIT_HZ_MAX = 6;
/** The weak place: a ball on the head while it is thrown up lands this many times, and a stunned serpent takes every
 *  blow this much heavier. */
export const HEAD_X = 2;
export const STUN_X = 1.5;
/** Where a blow struck: the body, the head, a coil about a ship. */
export const ZONES = Object.freeze({ body: 0, head: 1, coil: 2 });

// ── phases ─────────────────────────────────────────────────────────────
/** The health fractions it changes phase at, and the ward it stands under as it does. */
export const SERPENT_PHASE_AT = Object.freeze([0.66, 0.33]);
export const SERPENT_SHIELD_MS = 4000;
export const SERPENT_PHASE_NAMES = Object.freeze(['The Hunt', 'The Coil', 'The Maelstrom']);

// ── the attacks ────────────────────────────────────────────────────────
// `shape` is what the sea shows and what a struck player's machine tests its boat and feet against (systems/
// serpentStrike.js):
//   sector - from `tg[0]`, `r` long, `arc` degrees wide about the facing `yw` (the tail's sweep)
//   lane   - from `tg[0]` to `tg[1]`, `width` wide; the head runs it over `active`
//   disc   - `r` about `tg[0]`
//   ring   - `r` about `tg[0]` - the ship inside it at the landing is coiled; one that sailed out of it is not
//   rings  - between `r0` and `r1` about `tg[0]` (the roar - safe close in under its jaws)
//   none   - nothing struck (a phase's cry, the maelstrom's forming)
// A SHIP struck takes `hull` of her whole hull and `base` more, `sail` of her canvas and `crew` men (TOUGHER-SHIPS: her
// whole is her refits'); `shove` (m/s) throws her off her way. AUDIT SERPENT T1 (2026-10-04, Mac chose the validated
// rebalance): every blow lighter - a ship it focused was wrecked in 36-80 s, and no fleet of eight won at the measured
// gunnery - the ram kept the heaviest, the one blow a helm can sail out of. `pool` is the venom
// the spit leaves on the water and the decks (players standing in it take `pct` of their health and `base` more a
// SERPENT_POOL_TICK_MS). `mode` how it holds itself through the wind-up. `phase` the first it comes in, `range` how near its
// head the target must be (m), `minGap` how far at least, `w` its weight in the choice.
/** The venom's bite on a standing player, each second, resolved on their machine. */
export const SERPENT_POOL_TICK_MS = 1000;
export const SERPENT_ATTACK_TABLE = Object.freeze({
  lash: Object.freeze({ id: 0, key: 'lash', name: 'Tail Lash', windup: 2600, active: 400, recover: 900, shape: 'sector', r: 85, arc: 120, hull: 0.06, base: 6, sail: 0.06, crew: 2, shove: 4, mode: MODE.cruise, phase: 1, range: 170, minGap: 0, w: 3 }),
  ram: Object.freeze({ id: 1, key: 'ram', name: 'Breaching Ram', windup: 3600, active: 4400, recover: 1800, shape: 'lane', width: 18, hull: 0.14, base: 12, sail: 0.05, crew: 3, shove: 9, mode: MODE.deep, phase: 1, range: 170, minGap: 60, w: 2 }),   // AUDIT SERPENT 2 F7: its range its reach (ramReach - 171 m: the wind-up's crawl and the run) - at 240 it was chosen at ships its lane ends short of
  breach: Object.freeze({ id: 2, key: 'breach', name: 'Rising Maw', windup: 3200, active: 400, recover: 3000, shape: 'disc', r: 20, hull: 0.07, base: 8, sail: 0.1, crew: 2, shove: 6, mode: MODE.deep, phase: 1, range: 320, minGap: 0, w: 2 }),
  spit: Object.freeze({ id: 3, key: 'spit', name: 'Venom Spit', windup: 2600, active: 300, recover: 900, shape: 'disc', r: 13, hull: 0.015, base: 2, sail: 0, crew: 1, shove: 0, pool: Object.freeze({ r: 13, ms: 9000, pct: 0.02, base: 1 }), mode: MODE.breach, phase: 1, range: 260, minGap: 30, w: 2 }),
  coil: Object.freeze({ id: 4, key: 'coil', name: 'Constrict', windup: 4800, active: 0, recover: 600, shape: 'ring', r: 36, hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.deep, phase: 2, range: 320, minGap: 0, w: 2 }),
  roar: Object.freeze({ id: 5, key: 'roar', name: 'Abyssal Roar', windup: 2800, active: 300, recover: 1600, shape: 'rings', r0: 22, r1: 120, hull: 0.05, base: 5, sail: 0.18, crew: 1, shove: 3, mode: MODE.rear, phase: 3, range: 150, minGap: 0, w: 2 }),
  cry: Object.freeze({ id: 6, key: 'cry', name: "Satakal's Call", windup: 2600, active: 0, recover: 400, shape: 'none', hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.rear, phase: 99, range: 9999, minGap: 0, w: 0 }),
  mael: Object.freeze({ id: 7, key: 'mael', name: 'The Maelstrom', windup: 5000, active: 0, recover: 800, shape: 'none', hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.deep, phase: 99, range: 9999, minGap: 0, w: 0 }),
});
/** The attacks by their wire id. */
export const SERPENT_ATTACK_BY_ID = Object.freeze(Object.values(SERPENT_ATTACK_TABLE).sort((a, b) => a.id - b.id));
/** The ones it chooses among (the cry and the maelstrom are its phases' turns). */
const CHOSEN = Object.freeze([SERPENT_ATTACK_TABLE.lash, SERPENT_ATTACK_TABLE.ram, SERPENT_ATTACK_TABLE.breach, SERPENT_ATTACK_TABLE.spit, SERPENT_ATTACK_TABLE.coil, SERPENT_ATTACK_TABLE.roar]);
/** THE TURN OF A PHASE: the Coil begins with Satakal's Call and a coil about the ship it hates most; the Maelstrom with
 *  the whirlpool forming at the waters' heart and the Abyssal Roar from its eye. */
export const SERPENT_PHASE_TURN = Object.freeze({
  2: Object.freeze(['cry', 'coil']),
  3: Object.freeze(['mael', 'roar']),
});
/** The ram's lane is as long as its run (m). */
export const ramLen = () => RAM_V * (SERPENT_ATTACK_TABLE.ram.active / 1000);
/** How far from its head as it begins the ram reaches (m): the wind-up's crawl, then the lane. */
export const ramReach = () => RAM_WIND_V * (SERPENT_ATTACK_TABLE.ram.windup / 1000) + ramLen();
/** The spit's glob is in the air this long before it lands (ms) - its arc drawn from the jaws. */
export const SPIT_FLIGHT_MS = 900;
/** A breach's head is placed under its mark this long before it bursts out (ms) - the swim up from below. */
export const BREACH_LEAD_MS = 1200;

// ── the coil ───────────────────────────────────────────────────────────
/** How long a coil holds before it crushes the ship in it (ms); how long the coiled ship's word that she slipped it is
 *  heard (ms); its health - COIL_TEAM_S seconds of the fighters' reference broadsides between them, COIL_HP_MIN at the
 *  least - and the stun a broken coil leaves it in (ms). */
export const COIL_MS = 24_000;
export const COIL_ESC_MS = 3000;
export const COIL_TEAM_S = 4;   // AUDIT SERPENT T3: 6 seconds of every broadside about it held 35-40% of phases II and III, and no coil broke at the measured gunnery
export const COIL_HP_MIN = 60;
export const SERPENT_STUN_MS = 9000;
/** How far the coiled ship's word may move the coil's centre off her pose (m) - her hull's middle, not her helm. */
export const COIL_HELD_SLACK = 40;
/** AUDIT SERPENT S3: how early before its landing (the relay's clock) a coiled ship's word is kept for it (ms) - her clock
 *  is the relay's through the welcome's offset, which a frame's jitter may put a little ahead. */
export const COIL_WORD_EARLY_MS = 1000;
/** The crush and the coil's grip, on the coiled ship (her machine's): the crush at its end, the grip each second. */
export const CRUSH = Object.freeze({ hull: 0.25, base: 15, sail: 0.2, crew: 4, shove: 12 });   // AUDIT SERPENT T1: a full coil was 108-212% of any hull
export const GRIP = Object.freeze({ hull: 0.008, base: 1, crew: 0.15 });
/** AUDIT SERPENT T3: a blow on a coil holding a ship hurts the serpent too - this share of it off its own health (the
 *  fire a coil draws is never wasted, broken or not). */
export const SERPENT_COIL_PASS = 0.5;

// ── the maelstrom ──────────────────────────────────────────────────────
/** THE MAELSTROM - phase three's whirlpool at the waters' heart: how far it pulls (m), its eye (m), the pull at its rim
 *  and at the eye (m/s, toward the heart), its swirl (m/s about it), and what the eye grinds off a hull each second. */
export const MAEL_R = 230;
export const MAEL_EYE_R = 40;
export const MAEL_PULL = Object.freeze([1.0, 3.8]);   // AUDIT SERPENT T8: at [1.2, 5] a rowboat or a Large Boat in it never sailed out
export const MAEL_SWIRL = 4;
export const MAEL_GRIND = Object.freeze({ hull: 0.012, base: 1 });   // AUDIT SERPENT T1: the eye ground a carrack to a wreck in 31 s
/** In the Maelstrom it rears out of the whirl every MAEL_REAR_EVERY_MS for MAEL_REAR_MS - its head the prize. */
export const MAEL_REAR_EVERY_MS = 14_000;
export const MAEL_REAR_MS = 6000;

// ── the receipt ────────────────────────────────────────────────────────
/** Who earns a receipt: dealt this share of the health their own ship brought, or stood alive at the fight - within
 *  SERPENT_STAND_R of its body - this share of it (a hand aboard another's ship earns so). AUDIT SERPENT E1/E2 (Mac:
 *  "Must be in the fight"): 2% was one volley, and a boat parked at 900 m - where nothing of it reaches - stood. */
export const SERPENT_RECEIPT_SHARE = 0.1;
export const SERPENT_STOOD_SHARE = 0.5;
export const SERPENT_STAND_R = 450;
/** AUDIT SERPENT E2/E3: a ship whose guns have said nothing this long takes her share out of its health (back, at the
 *  fraction it stands at, with her next blow) - a claim never backed by fire no longer makes it tougher for everyone. */
export const SERPENT_IDLE_RETIRE_MS = 90_000;
/** A share leaves with its fighter (gateBrain.js AUDIT WBX R1): one away from the fight this long takes its share out
 *  of the health at the fraction it stands at. Longer than the gate's - a ship tacking back in is gone a while. */
export const SERPENT_ABSENT_RETIRE_MS = 45_000;
/** A real part in the fight - what keeps a seat in a full fight. */
export const SERPENT_SEAT_KEEP_MS = 45_000;
export const serpentHasPart = (p) => (p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share) || p.stoodMs >= SERPENT_SEAT_KEEP_MS;
/** AUDIT SERPENT T2/E2/S8: does a fighter's share belong in its health now - not wrecked, not away from the fight past
 *  SERPENT_ABSENT_RETIRE_MS, and (a ship) not silent past SERPENT_IDLE_RETIRE_MS. AUDIT 2 XB4 (2026-10-06): nor a game
 *  told to reload (`stale` - AUDIT SHIPS C2's mark, which the relay neither hears nor goes at): its share stood in the
 *  health and its ship in the count until its absence retired it, 45 s - a pair's survivor eased all that while. */
export const serpentShareWanted = (p, now) => !p.wreck && !p.stale && p.aboard !== false && now - (p.seenAt ?? p.joinedAt) <= SERPENT_ABSENT_RETIRE_MS && !(p.share > 0 && now - (p.hitAt ?? p.joinedAt) > SERPENT_IDLE_RETIRE_MS);
/** AUDIT SHIPS C1 (2026-10-06): THE SHIPS FIGHTING IT - the fighters whose share stands in its health now: a warship's
 *  (a rowboat brings none and deals none), afloat, at the fight, her guns heard, and her captain aboard her (every other
 *  share is retired - serpentShareWanted, serpentWreck). The pair's share reads it (systems/serpentStrike.js fleetShare).
 *  It counted every account at the fight whose hull claim, which only ever grows, was 0 or more: a lone galleon with a
 *  rowboat beside her, or with a friend riding her deck who had sighted it from their own ship, was "a pair" and took two
 *  thirds of every blow - the lone ship eased that Mac's call rules out - while a true pair with a rowboat by was three,
 *  and lost its share. The count is the health's own now, so two ships eased is two ships' health to fight. */
export const serpentShipsFighting = (f) => Object.values(f.players).filter((p) => p.share > 0 && !p.retired).length;
/** AUDIT 2 XC1 (2026-10-06): the count kept where a share changes - a join, a ship changed, a wreck - not only at the
 *  beat: the relay's answer to an `in` said the count from before it. */
const recount = (f) => { f.ships = serpentShipsFighting(f); };
/** AUDIT SHIPS C1: is she ON A SHIP of her own now - the hull her latest `in` says (`on`), never her share's claim (`hl`,
 *  the largest she ever made): one who sighted it from her own ship and rides another's deck is a hand, never coiled
 *  (her machine has no ship of hers to hold), and a captain in her rowboat is a boat. A fight checkpointed before `on`
 *  reads her claim. */
export const serpentOnShip = (p) => (p.on ?? p.hl) >= 0;
/** Threat: the share of aimed attacks at whoever dealt most lately, and how fast it forgets (a share a second). */
export const SERPENT_THREAT_PICK = 0.6;
export const SERPENT_THREAT_DECAY = 0.08;
/** The damage chart's rows at most. */
export const SERPENT_DAMAGE_CHART_MAX = 32;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** The nearest of the body's points to (x, z), metres - Infinity for none. */
const nearestPoint = (pts, x, z) => { let d = Infinity; for (const p of pts ?? []) d = Math.min(d, dist(p.x, p.z, x, z)); return d; };
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
/** An angle into [-PI, PI). */
export const serpentWrapYaw = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
/** A leg as the fight keeps it and the wire says it - its numbers rounded, so the relay and every client hold the same
 *  bits and draw the same body. */
function roundLeg(L) {
  const o = { k: L.k, at: Math.round(L.at), x: r2(L.x), z: r2(L.z), yw: r4(serpentWrapYaw(L.yw)), v: r2(Math.max(SWIM_MIN_V, L.v)) };
  if (L.k === LEG.arc) { o.r = r2(L.r); o.sd = L.sd < 0 ? -1 : 1; }
  if (L.j) o.j = 1;
  return o;
}
/** A point kept within `r` of the site. */
export function keepIn(x, z, r = ARENA_R) {
  const d = Math.hypot(x, z);
  return d <= r ? [x, z] : [(x / d) * r, (z / d) * r];
}
/**
 * AUDIT SHIPS A1: fighter `p`'s WAY on the sea (`vx`, `vz` m/s, the site frame), read off body `b` - each new pose's
 * change over the time its sender kept between them (the pose's own `ts`, net/wire.js poseTsDiff - never the network's
 * timing, and never the beat's). A pose with no `ts` leaves her at rest: she is aimed where she stands, as before. `now`
 * the relay's clock (the beat's): AUDIT 2 XB11 (2026-10-06) - no new pose of hers past SERPENT_WAY_STALE_MS of it and she
 * is at rest (a ship hove to says none for a heartbeat's 20 s, and was led on at her last way all that while); XB8 - her
 * clock held to it (SERPENT_CLOCK_SPAN_MS).
 */
export function serpentWayOf(p, b, now) {
  if (!p) return;
  const rest = () => { p.vx = 0; p.vz = 0; p.vw = 0; };
  if (!Number.isFinite(b.ts)) { rest(); p.wts = null; return; }
  if (!Number.isFinite(p.wts)) { p.wx = b.x; p.wz = b.z; p.wts = b.ts; p.wAt = now; p.cAt = now; p.cTs = b.ts; rest(); return; }
  const dt = poseTsDiff(b.ts, p.wts);
  // the same pose again, or an older copy of one: nothing new - and none past SERPENT_WAY_STALE_MS, at rest
  if (!(dt > 0)) { if (now - p.wAt > SERPENT_WAY_STALE_MS) rest(); return; }
  if (now - p.cAt >= SERPENT_CLOCK_SPAN_MS) {
    const rate = poseTsDiff(b.ts, p.cTs) / (now - p.cAt);
    p.skew = !(rate >= 1 / SERPENT_CLOCK_SKEW && rate <= SERPENT_CLOCK_SKEW);
    p.cAt = now; p.cTs = b.ts;
  }
  const vx = ((b.x - p.wx) * 1000) / dt, vz = ((b.z - p.wz) * 1000) / dt;
  if (p.skew || dt > SERPENT_WAY_STALE_MS || Math.hypot(vx, vz) > SERPENT_WAY_MAX_V) rest();
  else {
    const k = Math.min(1, dt / SERPENT_WAY_EASE_MS);
    const was = Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.5 ? Math.atan2(p.vx, p.vz) : null;
    p.vx = (p.vx ?? 0) + (vx - (p.vx ?? 0)) * k;
    p.vz = (p.vz ?? 0) + (vz - (p.vz ?? 0)) * k;
    // her turn: the way's own bearing as it swings, a second's worth eased like the way
    const now = Math.hypot(p.vx, p.vz) > 0.5 ? Math.atan2(p.vx, p.vz) : null;
    const w = was == null || now == null ? 0 : Math.max(-SERPENT_TURN_MAX, Math.min(SERPENT_TURN_MAX, (serpentWrapYaw(now - was) * 1000) / dt));
    p.vw = (p.vw ?? 0) + (w - (p.vw ?? 0)) * k;
  }
  p.wx = b.x; p.wz = b.z; p.wts = b.ts; p.wAt = now;
}
/** AUDIT SHIPS A1: WHERE `target` WILL BE `ms` on, her way and her turn held (serpentWayOf) - along the round she is
 *  sailing - never led past SERPENT_LEAD_MAX_MS, and kept within `r` of its waters' heart. A copy of the body, moved. */
export function serpentLeadOf(f, target, ms, r = ARENA_R + 60) {
  const p = f.players[target.sub];
  const s = Math.max(0, Math.min(ms, SERPENT_LEAD_MAX_MS)) / 1000;
  const vx = p?.vx ?? 0, vz = p?.vz ?? 0, v = Math.hypot(vx, vz), w = p?.vw ?? 0;
  let dx = vx * s, dz = vz * s;
  if (v > 0.5 && Math.abs(w) > 1e-3) {
    // the eased way lags her bearing by about the ease's own span of her turn - taken back before it is turned on
    const a = Math.atan2(vx, vz) + (w * SERPENT_WAY_EASE_MS) / 1000, R = v / w;
    dx = R * (Math.cos(a) - Math.cos(a + w * s)); dz = R * (Math.sin(a + w * s) - Math.sin(a));
  }
  const [x, z] = keepIn(target.x + dx, target.z + dz, r);
  return { ...target, x, z };
}

/**
 * A fresh fight: nobody in it, the serpent surfacing at its waters' heart, no health until a ship brings some. `soundAt`
 * the day's sounding (net/serpentLaw.js serpentTimes), `sx`/`sz` the site's native point (the first `in`'s word), `yaw`
 * the way it first swims (serpentLaw.js serpentRiseYaw).
 */
export function newSerpentFight(day, now, soundAt, boss, sx, sz, yaw = 0) {
  // circling its waters' heart at RISE_RING: an arc turning right from a point on that ring (its centre lies to the
  // right of the start - serpentBody.js legAt)
  const start = { k: LEG.arc, at: now, x: -RISE_RING * Math.cos(yaw), z: RISE_RING * Math.sin(yaw), yw: yaw, v: CRUISE_V, r: RISE_RING, sd: 1, j: 1 };
  return {
    v: 1, bv: SERPENT_BRAIN_V, day, boss, startedAt: now, soundAt, sx, sz,   // AUDIT SHIPS B7: and the brain's law it is stepped by
    phase: 1, shieldUntil: 0, stunUntil: 0, hp: 0, max: 0,
    legs: [roundLeg(start)],
    modes: [{ at: now, m: MODE.deep }, { at: now + 1500, m: MODE.breach }, { at: now + 6500, m: MODE.cruise }],
    coil: null, mael: null,
    atk: null, lastA: -1, runA: 0, freeAt: 0, nextAt: now + SERPENT_OPENING_MS, openUntil: now + SERPENT_OPENING_MS, seq: 0, coils: 0,
    target: null, targetAt: 0, queue: [], pending: null, rearAt: 0, closing: null,
    /** @type {Record<string, {name: string, lv: number, hl: number, ref: number, share: number, dealt: number, clipped: number, bucket: number, bucketAt: number, rate: number, rateAt: number, stoodMs: number, joinedAt: number, seenAt: number, retired: boolean, hits: number, best: number, cd: number, bq?: any, bqAt?: number}>} */
    players: {},
    liveMs: 0,
    /** @type {Record<string, number>} */
    threat: {},
    /** @type {{at: number, top: string[], n: number, dm?: any[]}|null} */
    fell: null,
    /** @type {{at: number}|null} */
    gone: null,
    lastHpAt: 0, lastHpSent: -1, lastNSent: -1, lastStateAt: now, lastTickAt: now,   // AUDIT 2 XC1: the count last said
  };
}

/** The fraction it stands at (gateBrain.js serpentStandsAt - AUDIT WBX2 M2's law). */
export const serpentStandsAt = (f) => (f.max > 0 ? f.hp / f.max : Number.isFinite(f.idle) ? f.idle : 1);
function shareOut(f, share) {
  const frac = serpentStandsAt(f);
  f.max = Math.max(0, f.max - share);
  f.hp = f.max * frac;
  if (!(f.max > 0)) f.idle = frac;
}
export function retireSerpentShare(f, p) { if (p.retired) return; shareOut(f, p.share); p.retired = true; }
export function restoreSerpentShare(f, p) {
  if (!p.retired) return;   // AUDIT SERPENT T2: every caller asks serpentShareWanted first - a wreck's never comes back
  const frac = serpentStandsAt(f);
  f.max += p.share; f.hp += p.share * frac; p.retired = false;
}

/**
 * A player joins the fight, claiming hull `hl` (-1 aboard none of their own) and level `lv` (the spoils' level). A
 * newcomer brings SERPENT_TTK_S seconds of their hull's reference broadside as health - at the fraction it stands at
 * (a late ship never heals it), with an empty bucket after the first blood (AUDIT WB A8) - and only while `admits`
 * and the fight has room (a full one frees an idle seat: `present`). A player already in keeps their first LEVEL;
 * AUDIT SERPENT B4/H2: a later claim of a bigger hull (a captain who sighted it off her helm, or from her rowboat)
 * takes her old share out and brings the new one in at the fraction it stands at, its bucket empty - the late ship's
 * law, so it buys no faster kill. `near` (AUDIT SERPENT S8): the word was said from within ENGAGE_R - only then does it
 * count as being at the fight (a ship anchored 1400 m off keeps no share in it by saying `in`). AUDIT SERPENT 2 F5: a
 * NEWCOMER's too - one whose first `in` is from farther joins with her share out of its health and unseen, so the
 * first beat that finds her at the fight brings it in (serpentShareWanted); S8's law held only a known fighter to it.
 * @returns {boolean}
 */
export function joinSerpentFight(f, sub, name, lv, hl, now, admits, present = null, near = true) {
  const known = f.players[sub];
  if (known) {
    if (typeof name === 'string' && name) known.name = name.slice(0, 24);
    if (f.fell || f.gone) return true;
    const hull = clampHull(hl), ref = refOf(hull);
    // AUDIT 2 XB9 (2026-10-06): a smaller warship of her own takes her share down to hers, at the fraction it stands at
    // (her bucket kept, to that ship's own depth - spendPurse): a captain sailing one was no ship of the fight, her share
    // out of its health and its count, and a true pair read as one
    if (ref > known.ref || (ref > 0 && ref < known.ref)) {
      if (!known.retired) shareOut(f, known.share);
      const share = SERPENT_TTK_S * ref, frac = serpentStandsAt(f);
      Object.assign(known, { hl: hull, ref, share, ...(ref > known.ref ? { bucket: 0, bucketAt: now, hitAt: now } : {}), retired: !!known.wreck });
      if (!known.wreck) { f.max += share; f.hp += share * frac; }
    }
    // AUDIT SHIPS C1: whether she is aboard the ship her share was brought by - the claim she says NOW (`on`), which the
    // share's own claim (`hl`, the largest she ever made) is not; off her (on another's deck, in her rowboat, in the sea)
    // her share leaves its health, and comes back at the fraction it stands at when she is aboard again
    known.on = hull;
    known.aboard = ref >= known.ref;
    if (!known.aboard) retireSerpentShare(f, known);
    if (near) { known.seenAt = now; if (serpentShareWanted(known, now)) restoreSerpentShare(f, known); }
    recount(f);   // AUDIT 2 XC1
    return true;
  }
  if (f.fell || f.gone || !admits) return false;
  if (Object.keys(f.players).length >= SERPENT_FIGHTERS_MAX && !freeSerpentSeat(f, present)) return false;
  const hull = clampHull(hl), ref = refOf(hull), share = SERPENT_TTK_S * ref, frac = serpentStandsAt(f);
  if (near) { f.max += share; f.hp += share * frac; }
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: clampSerpentLv(lv), hl: hull, ref, share, dealt: 0, clipped: 0,
    bucket: frac >= 1 ? SERPENT_BUCKET_DEPTH_X * ref : 0, bucketAt: now, rate: SERPENT_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
    seenAt: near ? now : now - SERPENT_ABSENT_RETIRE_MS - 1, hitAt: now, retired: !near, wreck: false, on: hull, aboard: true, hits: 0, best: 0, cd: 0,
  };
  recount(f);   // AUDIT 2 XC1
  return true;
}
/**
 * AUDIT SERPENT T2: a fighter's ship WRECKED (`w` 1) or afloat again (0) - her machine's word. A wreck's share leaves its
 * health and never comes back while she is one; it no longer goes at her; her stood time still counts. AUDIT 2 XC5
 * (2026-10-06): a coil holding her lets her go, said into `out` (`cx`, SERPENT_SAY_AHEAD_MS on - releaseCoil, as a phase's
 * turn lets go): held on, a wreck was gripped and crushed to the coil's end, the serpent bound to her all that while.
 * @returns {boolean} whether anything changed
 */
export function serpentWreck(f, sub, w, now, out = []) {
  const p = f.players[sub];
  // AUDIT SHIPS C1: a rowboat's too (her share is none) - a wreck is no longer gone at, whatever she brought
  if (!p || f.fell || f.gone) return false;
  const wreck = !!w;
  if (wreck === !!p.wreck) return false;
  p.wreck = wreck;
  if (wreck) {
    retireSerpentShare(f, p);
    if (f.target === sub) f.target = null;
    const c = f.coil;
    if (c && c.s === sub && coilHolds(f, now)) { c.why = 'wreck'; releaseCoil(f, now, out); out.push({ k: 'cx', i: c.i, at: c.off }); }
  } else { p.hitAt = now; if (serpentShareWanted(p, now)) restoreSerpentShare(f, p); }
  recount(f);   // AUDIT 2 XC1
  return true;
}
/** A full fight frees the seat of one who joined and left with no part in it (gateBrain.js AUDIT WB A1). */
export function freeSerpentSeat(f, present) {
  if (!present) return false;
  for (const [sub, p] of Object.entries(f.players)) {
    if (present.has(sub) || serpentHasPart(p)) continue;
    if (!p.retired) shareOut(f, p.share);
    delete f.players[sub]; delete f.threat[sub];
    if (f.target === sub) f.target = null;
    return true;
  }
  return false;
}

/** The blow rate's hand: one token a word (a word is one gathered volley). */
function spendBlow(p, now) {
  p.rate = Math.min(SERPENT_HIT_HZ_MAX, p.rate + (Math.max(0, now - p.rateAt) / 1000) * SERPENT_HIT_HZ_MAX);
  p.rateAt = now;
  if (!(p.rate >= 1)) return false;
  p.rate -= 1;
  return true;
}
/** The blow's purse: `d` capped a blow, by the bucket and by what is `left`; the clipping counted. */
function spendPurse(p, d, left, now) {
  const ref = p.ref;
  p.bucket = Math.min(SERPENT_BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * SERPENT_BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const got = Math.max(0, Math.min(d, SERPENT_HIT_CAP_X * ref, p.bucket, left));
  p.bucket -= got;
  p.clipped += Math.max(0, d - got);
  p.dealt += got;
  return got;
}
/** Is a coil holding a ship now (wound on, not broken, crushed or slipped)? */
export const coilHolds = (f, now) => !!f.coil && !(f.coil.off > 0) && now >= f.coil.at;
/** Is it stunned now? */
export const stunned = (f, now) => now < (f.stunUntil ?? 0);

/**
 * A BLOW on it from `sub`, standing at `pose` ({x, z} - the site frame), claiming `d` points where `z` (ZONES) of it was
 * struck. Answers the frames to fan (a coil broken, the kill) - what landed is the fighter's own `dealt`. Refused: a
 * stranger, a fight over or past its sounding, its ward, past the blow rate, a pose away from the fight, nothing of it
 * above the sea, the body beyond a gun's reach. Clipped (and counted): past the one-blow cap, past the bucket.
 * SERPENT3: the body, its head and its stun are judged at the latest of SERPENT_HIT_LOOKBACK_MS back from the word at
 * which some of it stood above the sea within her guns' reach - when the ball struck, not when its word came.
 */
export function applySerpentHit(f, sub, d, z, pose, now) {
  const out = [];
  const p = f.players[sub];
  if (!p || f.fell || f.gone || !Number.isFinite(d) || !(d > 0) || now >= f.soundAt) return out;
  if (now < f.shieldUntil) return out;
  if (!spendBlow(p, now)) return out;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || Math.hypot(pose.x, pose.z) > ENGAGE_R + SERPENT_POSE_SLACK) return out;
  let pts = null, at = now;
  for (const back of SERPENT_HIT_LOOKBACK_MS) {
    const seen = bodyAt(f, now - back);
    const near = nearestExposed(seen, pose.x, pose.z);
    if (near && near.d <= GUN_REACH_M + SERPENT_POSE_SLACK) { pts = seen; at = now - back; break; }
  }
  if (!pts) return out;
  // AUDIT SERPENT E2: her guns speak - a share retired for their silence comes back at the fraction it stands at
  p.hitAt = now;
  if (p.retired && serpentShareWanted(p, now)) restoreSerpentShare(f, p);
  const stun = stunned(f, at);
  if (z === ZONES.coil && coilHolds(f, now)) {
    const got = spendPurse(p, d * (stun ? STUN_X : 1), f.coil.h, now);
    p.cd += got;
    if (got > 0) { p.hits++; p.best = Math.max(p.best, got); f.threat[sub] = (f.threat[sub] ?? 0) + got; }
    f.coil.h -= got;
    // AUDIT SERPENT T3: the coil's fire is never wasted - SERPENT_COIL_PASS of it off its own health
    f.hp -= Math.min(f.hp, got * SERPENT_COIL_PASS);
    if (f.coil.h <= 1e-6) breakCoil(f, now, p.name, out);
    if (f.hp <= 1e-6 && f.max > 0) fall(f, now, out);
    return out;
  }
  const x = (z === ZONES.head && headExposed(f, pts, at, stun) ? HEAD_X : 1) * (stun ? STUN_X : 1);
  const got = spendPurse(p, d * x, f.hp, now);
  if (got > 0) { p.hits++; p.best = Math.max(p.best, got); f.threat[sub] = (f.threat[sub] ?? 0) + got; }
  f.hp -= got;
  if (f.hp <= 1e-6 && f.max > 0) fall(f, now, out);
  return out;
}

/** THE KILL: its health spent - its throes begun, everything in flight ended, every fighter's part ranked. */
function fall(f, now, out) {
  f.hp = 0;
  f.fell = { at: now, top: serpentTopDealers(f, 3), n: Object.keys(f.players).length, dm: serpentDamageChart(f) };
  f.atk = null; f.queue = []; f.pending = null;
  // AUDIT SERPENT M2: its throes said, as every other turn of its body is - AUDIT SHIPS B5: SERPENT_SAY_AHEAD_MS on, as
  // every turn of its swim is (killed mid-dash and said at the beat, a screen 150 ms behind snapped it 3.6 m). AUDIT 2 XB2
  // (2026-10-06): laid from then alone - the timeline's one rule lets go of what was to come after it, and what was said
  // to come before it is swum: a blow is judged as it comes, between beats, and the swim held from the blow's moment
  // (B5's holdNow) unsaid a dash said at the last beat that a screen a wire's time behind had begun (3.2 m at 250 ms)
  const go = now + SERPENT_SAY_AHEAD_MS;
  // AUDIT SERPENT S4/M1: a coil holding a ship lets her go, and says so - a dead serpent never grips (AUDIT SHIPS D2: let
  // go with its throes, as releaseCoil lets go)
  if (coilHolds(f, now) || (f.coil && !(f.coil.off > 0))) { f.coil.off = go; f.coil.why = 'fell'; out.push({ k: 'cx', i: f.coil.i, at: go }); }
  pushMode(f, go, MODE.dying, out);
  pushLeg(f, legFrom(f.legs, go, LEG.line, DRIFT_V), out);
  out.push({ k: 'fell', at: now, top: f.fell.top, n: f.fell.n, dm: f.fell.dm });
}
/** THE SOUNDING: the day's end with it unslain - it dives and is gone. */
function sound(f, now, out) {
  f.gone = { at: f.soundAt };
  f.atk = null; f.queue = []; f.pending = null;
  const go = now + SERPENT_SAY_AHEAD_MS;   // AUDIT SHIPS B5: said ahead, as the kill's throes are - AUDIT 2 XB2: from then alone
  if (coilHolds(f, now) || (f.coil && !(f.coil.off > 0))) { f.coil.off = go; f.coil.why = 'gone'; out.push({ k: 'cx', i: f.coil.i, at: go }); }
  pushMode(f, go, MODE.deep, out);
  pushLeg(f, legFrom(f.legs, go, LEG.line, DEEP_V), out);
  out.push({ k: 'gone', at: f.gone.at });
}

/** The names of the `k` who dealt the most, most first (ties by the earlier to join). */
export function serpentTopDealers(f, k) {
  return Object.values(f.players).filter((q) => q.dealt > 0).sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, k).map((q) => q.name);
}
/**
 * THE DAMAGE CHART, made at the kill (the gate's GATE-UX): every fighter with a part, most damage first, whole numbers -
 * `n` the name, `h` the hull they sailed (-1 aboard another's), `d` all they dealt, `c` the coils' share of it, `x` the
 * blows that landed, `b` the heaviest.
 */
export function serpentDamageChart(f) {
  return Object.values(f.players).filter((q) => q.dealt > 0 || q.stoodMs > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, SERPENT_DAMAGE_CHART_MAX)
    .map((q) => ({ n: q.name, h: q.hl, d: Math.round(q.dealt), c: Math.min(Math.round(q.dealt), Math.round(q.cd ?? 0)), x: q.hits ?? 0, b: Math.round(q.best ?? 0) }));
}
/** Did `sub` earn a receipt? Only a slain serpent pays: dealt SERPENT_RECEIPT_SHARE of the health their ship brought, or stood
 *  alive within SERPENT_STAND_R of its body SERPENT_STOOD_SHARE of the fight. */
export function serpentEarned(f, sub) {
  const p = f.players[sub];
  if (!p || !f.fell) return false;
  const fight = Math.max(1, Number.isFinite(f.liveMs) ? f.liveMs : f.fell.at - f.startedAt);
  return (p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share) || p.stoodMs >= SERPENT_STOOD_SHARE * fight;
}
/** How it was serpentEarned, for the receipt: 'dealt' first, else 'stood'. */
export const serpentEarnedBy = (f, sub) => { const p = f.players[sub]; return p && p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share ? 'dealt' : 'stood'; };

/** Who it goes at: SERPENT_THREAT_PICK of the time the ship (or, with none at the fight, the body) with the most threat, else a
 *  random one. Ships first - a hand aboard another's ship stands where that ship does. AUDIT SERPENT E1/T2: only what it
 *  can reach (within SERPENT_TARGET_R of its waters), never a wreck; `shipOnly` (a coil - AUDIT SERPENT S10) no hand. */
export function pickSerpentTarget(f, bodies, rng, shipOnly = false) {
  const live = bodies.filter((b) => !b.dead && f.players[b.sub] && !f.players[b.sub].wreck && Math.hypot(b.x, b.z) <= SERPENT_TARGET_R);
  const ships = live.filter((b) => serpentOnShip(f.players[b.sub]));   // AUDIT SHIPS C1: on one now
  const pool = ships.length || shipOnly ? ships : live;
  if (!pool.length) return null;
  if (rng() < SERPENT_THREAT_PICK) {
    let best = null, t = 0;
    for (const b of pool) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return pool[Math.floor(rng() * pool.length) % pool.length];
}
/** The attacks this phase allows at a target `gap` metres from its head - the last used left out when anything else is
 *  open, and never SERPENT_REPEAT_MAX + 1 times running. A coil is for a ship (`ship`), and never twice at once. */
export function serpentAttacksFor(phase, gap, ship, lastA = -1, run = 1) {
  const out = CHOSEN.filter((a) => a.phase <= phase && gap <= a.range && gap >= a.minGap && (a !== SERPENT_ATTACK_TABLE.coil || ship));
  const fresh = out.filter((a) => a.id !== lastA);
  return fresh.length ? fresh : run >= SERPENT_REPEAT_MAX ? [] : out;
}
/** One of `can` by weight. */
export function chooseSerpentAttack(can, rng) {
  const total = can.reduce((s, a) => s + a.w, 0);
  let x = rng() * total;
  for (const a of can) { x -= a.w; if (x < 0) return a; }
  return can[can.length - 1];
}

/** A new leg, kept and said (the bound on how many are kept: pruneLegs's, on the beat - a leg may begin in the future,
 *  and the track is pruned by the clock that has come, never by the one a future leg names). */
function pushLeg(f, L, out) {
  const leg = roundLeg(L);
  // AUDIT SERPENT S2: THE TIMELINE'S ONE RULE - a leg said now supersedes any still to come (the relay and every client
  // apply it alike: serpentBody.js onTimeline), so the track is always in time order and every screen draws one body
  if (!onTimeline(f.legs, leg, sameLeg)) return leg;
  while (f.legs.length > LEGS_KEPT * 2) f.legs.shift();
  out?.push({ k: 'sw', l: leg });
  return leg;
}
/** The legs the body no longer lies along let go at `t` (the clock NOW - never a future leg's start: a jump still to
 *  come leaves the body where it is until it comes): the oldest goes while the track from the head at `t` back to the
 *  start of the one after it is a whole body long, or the one after it is a jump already begun (the body never reaches
 *  back past one). A client that lets go of more at a later clock lets go of nothing the body is drawn from. */
export function pruneLegs(f, t) {
  while (f.legs.length > 1) {
    const second = f.legs[1];
    if (second.at > t) break;
    if (!second.j && trackSince(f.legs, t, second.at) < BODY_LEN) break;
    f.legs.shift();
  }
  while (f.legs.length > LEGS_KEPT * 2) f.legs.shift();
}
/** The track's length (m) from the head at `t` back to the moment `since`. */
function trackSince(legs, t, since) {
  let len = 0, end = t;
  for (let i = legs.length - 1; i >= 0 && end > since; i--) {
    const L = legs[i];
    if (L.at > end) continue;
    const from = Math.max(L.at, since);
    len += (Math.max(SWIM_MIN_V, L.v) * (end - from)) / 1000;
    end = L.at;
  }
  return len;
}
/** A change of mode, kept and said. */
function pushMode(f, at, m, out) {
  // AUDIT SERPENT S2: the timeline's one rule - and a mode still to come that it takes away is said away (the word is said
  // even when the ride it keeps is the same, so every client's fold drops what the relay dropped). AUDIT SERPENT 2 F2:
  // the ride it keeps is never kept twice (serpentBody.js onTimeline - the client's fold the same)
  const d = { at: Math.round(at), m };
  if (!onTimeline(f.modes, d, sameMode)) return;
  while (f.modes.length > MODES_KEPT) f.modes.shift();
  out?.push({ k: 'dv', ...d });
}
/**
 * SERPENT3: THE WAY ONTO A ROUND - from the head at `p` heading `yw`, a turn of `r1` (HUNT_TURN_R) and then a straight that
 * leaves the turn's circle and meets the circle of `r2` about `c` tangent, going round it `s2` (+1 clockwise from above,
 * as legAt turns) - with `r2` 0, the straight runs onto the point `c` (Dubins's turn-and-straight). The shorter of the
 * two turns that can: `{ s1, turn, len, yw, r }` - the turn's side and its angle (radians, [0, 2PI)), the straight's
 * length (m), its heading and the turn's radius (r1) - or null (neither can: the round about the head itself).
 * @param {{x: number, z: number}} p @param {number} yw @param {number} r1 @param {{x: number, z: number}} c
 */
export function wayOnto(p, yw, r1, c, r2 = 0, s2 = 1) {
  let best = null;
  for (const s1 of [1, -1]) {
    // the turn's centre stands r1 to its side (serpentBody.js legAt: right of a heading yw is (cos yw, -sin yw))
    const cx = p.x + s1 * r1 * Math.cos(yw), cz = p.z - s1 * r1 * Math.sin(yw);
    const dx = c.x - cx, dz = c.z - cz, d = Math.hypot(dx, dz), k = s2 * r2 - s1 * r1;
    if (!(d > 1e-9) || Math.abs(k) > d * (1 + 1e-9)) continue;
    // the straight square to both radii: its heading off the centres' bearing by asin(k / d)
    const ys = Math.atan2(dx, dz) - Math.asin(Math.max(-1, Math.min(1, k / d)));
    let turn = s1 * serpentWrapYaw(ys - yw);
    if (turn < 0) turn += 2 * Math.PI;
    if (turn > 2 * Math.PI - 1e-6) turn = 0;
    const len = Math.sqrt(Math.max(0, d * d - k * k));
    if (!best || turn * r1 + len < best.turn * r1 + best.len) best = { s1, turn, len, yw: ys, r: r1 };
  }
  return best;
}
/** SERPENT3: a way's length (m) - its turn and its straight. */
export const wayLen = (way) => (way ? way.turn * way.r + way.len : 0);
/**
 * SERPENT3: THE HEAD SWIMS `way` (wayOnto's) from `t` at `v`, the straight's last `lead` metres at `vLead` -
 * each leg begun where the last leaves the head (legFrom), kept and said. Answers the moment it is done (ms).
 */
function swimWay(f, t, way, v, out, lead = 0, vLead = v) {
  let at = Math.round(t);
  if (!way) return at;
  const turn = way.turn * way.r, run = Math.max(0, way.len - lead), rise = Math.min(lead, way.len);
  if (turn >= 0.05) { pushLeg(f, legFrom(f.legs, at, LEG.arc, v, way.r, way.s1), out); at = Math.round(at + (turn * 1000) / v); }
  if (run >= 0.05) { pushLeg(f, legFrom(f.legs, at, LEG.line, v), out); at = Math.round(at + (run * 1000) / v); }
  if (rise >= 0.05) { pushLeg(f, legFrom(f.legs, at, LEG.line, vLead), out); at = Math.round(at + (rise * 1000) / vLead); }
  return at;
}
/** SERPENT3: the pace (m/s) that swims `len` metres in `ms`, between SWIM_MIN_V and DASH_V - past DASH_V the wind-up waits. */
const dashPace = (len, ms) => Math.max(SWIM_MIN_V, Math.min(DASH_V, len / Math.max(1e-3, ms / 1000)));
/** SERPENT3: THE DASH of attack `A` at `target` from the head `h` (its place and heading where the dash begins): the way
 *  (wayOnto's) onto a Rising Maw's mark (where she is, kept in its waters) or round a coil's ring about her, and the
 *  metres swum up at its end - null for an attack that swims none. */
function dashOf(A, h, target) {
  if (A === SERPENT_ATTACK_TABLE.breach) {
    const [px, pz] = keepIn(target?.x ?? 0, target?.z ?? 0, ARENA_R + 60);
    const way = wayOnto(h, h.yw, HUNT_TURN_R, { x: px, z: pz });
    return { way, rise: Math.min((CRUISE_V * BREACH_LEAD_MS) / 1000, way?.len ?? 0) };
  }
  // AUDIT SHIPS B6: onto its ring going round it COUNTER-clockwise - as the coil lies (serpentBody.js coilPoint lays the
  // body clockwise of its head, behind a head that swims the other way)
  if (A === SERPENT_ATTACK_TABLE.coil) return { way: wayOnto(h, h.yw, HUNT_TURN_R, { x: target?.x ?? 0, z: target?.z ?? 0 }, COIL_R, -1), rise: 0 };
  return null;
}
/** AUDIT SHIPS B3: THE TURN THAT FITS THE WHIRL - a head at `h` turning on HUNT_TURN_R, to whichever side turns it less,
 *  until the round of MAEL_ORBIT_R to its left lies in its waters (its eye within ARENA_R - MAEL_ORBIT_R): `{a, sd}`, the
 *  turn (radians - the least found every 2 degrees round) and its side (+1 right, -1 left, as legAt turns), or the one
 *  that brings that eye nearest the heart. */
export function maelTurnToFit(h) {
  const R = HUNT_TURN_R;
  let best = { a: 0, sd: -1 }, bestD = Infinity;
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 90) {
    for (const sd of [-1, 1]) {
      // the turn's centre to that side, and the head `a` round it
      const cx = h.x + sd * R * Math.cos(h.yw), cz = h.z - sd * R * Math.sin(h.yw);
      const yw = h.yw + sd * a, px = cx - sd * R * Math.cos(yw), pz = cz + sd * R * Math.sin(yw);
      const d = Math.hypot(px - Math.cos(yw) * MAEL_ORBIT_R, pz + Math.sin(yw) * MAEL_ORBIT_R);
      if (d <= ARENA_R - MAEL_ORBIT_R) return { a, sd };
      if (d < bestD) { bestD = d; best = { a, sd }; }
    }
  }
  return best;
}
/** SERPENT3: does attack `A`'s dash at `target`, begun now, fit its own wind-up (at DASH_V, its rise at CRUISE_V)? */
export function dashFits(f, A, now, target) {
  const d = dashOf(A, headAt(f.legs, now + SERPENT_SAY_AHEAD_MS), serpentLeadOf(f, target, serpentWindupOf(A)));   // AUDIT SHIPS A1
  if (!d) return true;
  return ((wayLen(d.way) - d.rise) / DASH_V + d.rise / CRUISE_V) * 1000 <= serpentWindupOf(A) - SERPENT_SAY_AHEAD_MS + 1;
}

/** STEER the head toward `aim` at speed `v`, cruising: a turn of TURN_R begun past STEER_TURN of error, a straight run
 *  within STEER_STRAIGHT, a change of pace said as a leg of its own - no leg cut under LEG_MIN_MS. AUDIT 2 XB1
 *  (2026-10-06): EVERY LEG OF IT SAID SERPENT_SAY_AHEAD_MS ON, judged from where its head will be then - AUDIT SHIPS D2
 *  said a change of pace ahead and its turns at the beat, where a screen a wire's time behind drew the head off the
 *  relay's (0.3 m at 150 ms, 2.2 m at 250 ms, closing). */
function steer(f, now, aim, v, out) {
  const go = now + SERPENT_SAY_AHEAD_MS;
  const L = f.legs[f.legs.length - 1];
  if (L && L.at > go) return;   // a swim still to come is the way
  const h = headAt(f.legs, go);
  const err = serpentWrapYaw(Math.atan2(aim[0] - h.x, aim[1] - h.z) - h.yw);
  const young = L && go - L.at < LEG_MIN_MS;
  const arc = L?.k === LEG.arc;
  if (Math.abs(err) > STEER_TURN && (!arc || L.sd !== Math.sign(err) || L.r !== TURN_R) && !young) { pushLeg(f, legFrom(f.legs, go, LEG.arc, v, TURN_R, Math.sign(err)), out); return; }
  if (Math.abs(err) <= STEER_STRAIGHT && arc && !young) { pushLeg(f, legFrom(f.legs, go, LEG.line, v), out); return; }
  if (L && Math.abs(L.v - v) > 0.5 && !young) pushLeg(f, L.k === LEG.arc ? legFrom(f.legs, go, LEG.arc, v, L.r, L.sd) : legFrom(f.legs, go, LEG.line, v), out);
}
/** Where it swims: about the maelstrom's eye in its last phase, about its target otherwise (a point ahead on a ring
 *  round it), about its waters' heart with no one at the fight - always within its waters. */
function aimOf(f, now, target) {
  const h = headAt(f.legs, now);
  let cx = 0, cz = 0, r = 200;
  if (f.mael) { cx = f.mael.x; cz = f.mael.z; r = MAEL_ORBIT_R; }
  else if (target) { cx = target.x; cz = target.z; r = ORBIT_R; }
  const a = Math.atan2(h.x - cx, h.z - cz) + ORBIT_LEAD;
  return keepIn(cx + Math.sin(a) * r, cz + Math.cos(a) * r);
}

/** WB-style: the attack's wind-up (never shortened: Mac, "I dont think making mechanics faster is the play"). */
export const serpentWindupOf = (A) => A.windup;
/** An attack as the wire says it. */
export function serpentAtkFrame(a) {
  return { i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r4(serpentWrapYaw(a.yw)), tg: a.tg.map((p) => [r2(p[0]), r2(p[1])]), ...(a.s ? { s: a.s } : {}) };
}

/**
 * BEGIN an attack at `target` (a body, or null for a turn's): where it lands and when, said now so every screen draws its
 * wind-up at once - and the swim and the bearing that go with it. SERPENT3: THE WHOLE OF ITS SWIM IS SAID WITH IT - every
 * leg and every change of its ride to its landing and past it, so no screen learns a turn of it a beat late (the ram's
 * run, said as it began, snapped its head on every screen); and where a Rising Maw bursts or a coil closes is swum to.
 */
function begin(f, A, now, target, rng, out) {
  let at = now + serpentWindupOf(A);
  const h = headAt(f.legs, now);
  let tg = [], yw = h.yw;
  const tx = target?.x ?? 0, tz = target?.z ?? 0;
  /** @type {{at: number, m: number}[]} the ride said with it, after its wind-up's */
  const rides = [];
  if (A === SERPENT_ATTACK_TABLE.lash) {
    // the tail's sweep: from the body's rear third, toward the ship - AUDIT SHIPS A1: where she will be as it lands
    const p = spinePoint(f.legs, now, BODY_LEN * 0.65);
    const aim = target ? serpentLeadOf(f, target, A.windup) : { x: tx, z: tz };
    yw = Math.atan2(aim.x - p.x, aim.z - p.z);
    tg = [[p.x, p.z]];
  } else if (A === SERPENT_ATTACK_TABLE.ram) {
    // under, turned on the ship, and along a lane at it - the run from the wind-up's end, and up at the lane's end.
    // SERPENT3: turned SERPENT_SAY_AHEAD_MS on, every screen holding the word first - its whole wind-up from there
    const go = now + SERPENT_SAY_AHEAD_MS, h1 = headAt(f.legs, go);
    at = go + serpentWindupOf(A);
    // AUDIT SHIPS A1: its lane aimed where she will be as its run reaches her - led by its crawl and its run's own time
    // to her, again and again until that holds (RAM_LEAD_STEPS: a ship slower than its run is met within centimetres;
    // led once, one sailing across its lane was missed by 18 m)
    const crawl = RAM_WIND_V * (A.windup / 1000);
    let aim = { x: tx, z: tz };
    for (let k = 0; target && k < RAM_LEAD_STEPS; k++) {
      const y = Math.atan2(aim.x - h1.x, aim.z - h1.z);
      const reach = dist(h1.x + Math.sin(y) * crawl, h1.z + Math.cos(y) * crawl, aim.x, aim.z);
      aim = serpentLeadOf(f, target, at - now + (reach / RAM_V) * 1000);
    }
    yw = Math.atan2(aim.x - h1.x, aim.z - h1.z);
    const x0 = h1.x + Math.sin(yw) * crawl, z0 = h1.z + Math.cos(yw) * crawl;
    tg = [[x0, z0], [x0 + Math.sin(yw) * ramLen(), z0 + Math.cos(yw) * ramLen()]];
    pushLeg(f, { k: LEG.line, at: go, x: h1.x, z: h1.z, yw, v: RAM_WIND_V }, out);
    pushLeg(f, { k: LEG.line, at, x: tg[0][0], z: tg[0][1], yw, v: RAM_V }, out);
    pushLeg(f, { k: LEG.line, at: at + A.active, x: tg[1][0], z: tg[1][1], yw, v: CRUISE_V }, out);
    rides.push({ at: at + A.active, m: MODE.breach });
  } else if (A === SERPENT_ATTACK_TABLE.breach) {
    // SERPENT3: it sounds and DASHES under the sea for the mark where she is now (dashOf) - a turn and a straight from
    // where its head is SERPENT_SAY_AHEAD_MS on - its last BREACH_LEAD_MS swum up at CRUISE_V, and bursts there
    const go = now + SERPENT_SAY_AHEAD_MS;
    const { way, rise } = /** @type {any} */ (dashOf(A, headAt(f.legs, go), target && serpentLeadOf(f, target, serpentWindupOf(A))));   // AUDIT SHIPS A1: her mark where she will be
    const len = wayLen(way), budget = A.windup - SERPENT_SAY_AHEAD_MS, slow = (len * 1000) / budget;
    // AUDIT SHIPS B4: a way its wind-up could swim at a cruise is swum at the one pace that fills the wind-up, rise and
    // all - dashed and risen at CRUISE_V it was swum early, and its head rose on past her mark until the landing (27 m
    // past a ship 8 m ahead), where it burst
    if (slow <= CRUISE_V) { const v = Math.max(SWIM_MIN_V, slow); at = Math.max(at, swimWay(f, go, way, v, out, rise, v)); }
    else { const riseMs = (rise / CRUISE_V) * 1000; at = Math.max(at, swimWay(f, go, way, dashPace(len - rise, budget - riseMs), out, rise, CRUISE_V)); }
    const burst = headAt(f.legs, at);
    tg = [[burst.x, burst.z]];
    yw = burst.yw;
    rides.push({ at, m: MODE.breach });
  } else if (A === SERPENT_ATTACK_TABLE.coil) {
    // SERPENT3: under the sea it dashes onto the round it closes about her - a turn, and a straight meeting it tangent -
    // and goes round it under her at DRIFT_V until it closes. AUDIT SHIPS B6: COUNTER-clockwise, as the coil lies
    // (serpentBody.js coilPoint) - clockwise, its body lay across the ring from the coil's, and swept over her ship as
    // the coil wound on and again as it let go; the coil drawn turns with it (coilAngleAt)
    const aim = target ? serpentLeadOf(f, target, serpentWindupOf(A)) : { x: tx, z: tz };   // AUDIT SHIPS A1: about where she will be
    tg = [[aim.x, aim.z]];
    yw = Math.atan2(aim.x - h.x, aim.z - h.z);
    const go = now + SERPENT_SAY_AHEAD_MS;
    const { way } = /** @type {any} */ (dashOf(A, headAt(f.legs, go), aim));
    const on = swimWay(f, go, way, dashPace(wayLen(way), A.windup - SERPENT_SAY_AHEAD_MS), out);
    pushLeg(f, legFrom(f.legs, on, LEG.arc, DRIFT_V, COIL_R, -1), out);
    at = Math.max(at, on);
    rides.push({ at, m: MODE.coil });
  } else if (A === SERPENT_ATTACK_TABLE.spit) {
    const aim = target ? serpentLeadOf(f, target, A.windup) : { x: tx, z: tz };   // AUDIT SHIPS A1: where she will be
    tg = [[aim.x, aim.z]];
    yw = Math.atan2(aim.x - h.x, aim.z - h.z);
  } else if (A === SERPENT_ATTACK_TABLE.roar) {
    // AUDIT SHIPS B5: it slows to rear SERPENT_SAY_AHEAD_MS on, every screen holding the word first - its rings about
    // where its head will be then
    const go = now + SERPENT_SAY_AHEAD_MS, h1 = headAt(f.legs, go);
    tg = [[h1.x, h1.z]];
    pushLeg(f, legFrom(f.legs, go, LEG.line, REAR_V), out);
  } else if (A === SERPENT_ATTACK_TABLE.cry) {
    pushLeg(f, legFrom(f.legs, now + SERPENT_SAY_AHEAD_MS, LEG.line, REAR_V), out);   // AUDIT SHIPS B5: said ahead
  } else if (A === SERPENT_ATTACK_TABLE.mael) {
    // SERPENT3: THE WHIRL FORMS WHERE IT SWIMS - its eye MAEL_ORBIT_R to its left, as the whirl turns (serpentStrike.js
    // maelPull), drawn in so the whole of its round lies in its waters; it swims onto that round and circles it, and
    // rears out of it as the whirl forms (it was formed at the waters' heart and the head leapt onto its round)
    const go = now + SERPENT_SAY_AHEAD_MS, h1 = headAt(f.legs, go);
    const [ex, ez] = keepIn(h1.x - Math.cos(h1.yw) * MAEL_ORBIT_R, h1.z + Math.sin(h1.yw) * MAEL_ORBIT_R, ARENA_R - MAEL_ORBIT_R);
    const way = wayOnto(h1, h1.yw, HUNT_TURN_R, { x: ex, z: ez }, MAEL_ORBIT_R, -1);
    let on;
    if (way) on = swimWay(f, go, way, dashPace(wayLen(way), A.windup - SERPENT_SAY_AHEAD_MS), out);
    else {
      // AUDIT SHIPS B3: drawn in so near that no turn and straight meets it (its head inside the round it seeks), it turns
      // on HUNT_TURN_R until the round to its left lies in its waters, and takes that one - the round about its head where
      // it stood lay out of them (a seventh of the third phase's turns, its eye up to 437 m out)
      const fit = maelTurnToFit(h1), len = fit.a * HUNT_TURN_R, v = dashPace(len, A.windup - SERPENT_SAY_AHEAD_MS);
      if (len >= 0.05) pushLeg(f, legFrom(f.legs, go, LEG.arc, v, HUNT_TURN_R, fit.sd), out);
      on = Math.round(go + (len * 1000) / v);
    }
    const round = pushLeg(f, legFrom(f.legs, on, LEG.arc, CRUISE_V, MAEL_ORBIT_R, -1), out);
    // its eye the round's own centre (the eye sought, to the centimetre - or, drawn in so near that no turn and straight
    // meets it, the round it swims), so the whirl is always where it circles
    tg = [[round.x + round.sd * round.r * Math.cos(round.yw), round.z - round.sd * round.r * Math.sin(round.yw)]];
    at = Math.max(at, on);
    rides.push({ at, m: MODE.rear });
  }
  // SERPENT3: a wind-up stretched for its dash is swum ON THE SURFACE - where the guns reach it - and it sounds for its own
  // wind-up alone before it lands, as it always did. AUDIT SHIPS D2: its ride taken SERPENT_SAY_AHEAD_MS on at the
  // soonest, with its swim - taken at the beat, a screen 150 ms behind snapped its head 8.5 m up or down (a spit's rise
  // from a rear, the Maw's sounding)
  const go = now + SERPENT_SAY_AHEAD_MS, dive = Math.max(go, at - serpentWindupOf(A));
  if (dive > go) pushMode(f, go, MODE.cruise, out);
  pushMode(f, dive, A.mode, out);
  for (const r of rides) pushMode(f, r.at, r.m, out);
  f.atk = { i: ++f.seq, a: A.id, at, x: h.x, z: h.z, yw, tg, until: at + A.active + A.recover, ...(target ? { s: target.sub } : {}) };
  out.push({ k: 'atk', ...serpentAtkFrame(f.atk) });
}

/** SERPENT3: attack `A` at `target` begun now if its dash fits its wind-up (dashFits) - else the serpent CLOSES on her,
 *  surging at her on the surface at CLOSE_V (`f.closing` - each beat asks again, SERPENT_CLOSE_MS at most). */
function closeOrBegin(f, A, now, target, rng, out) {
  if (!target || dashFits(f, A, now, target)) { f.closing = null; begin(f, A, now, target, rng, out); return; }
  if (!f.closing) f.closing = { a: A.id, s: target.sub, at: now };
  f.target = target.sub;
  closeOn(f, now, target, out);
}
/**
 * AUDIT 2 XB1 (2026-10-06): THE SURGE IS SWUM AS ITS DASHES ARE - from where its head will be SERPENT_SAY_AHEAD_MS on, a
 * turn of HUNT_TURN_R and a straight at where it meets her (closeAim; wayOnto's turn-and-straight), said whole, at her
 * pace (closeV) - and laid again only when its straight would no longer run at her within STEER_STRAIGHT, or its pace is
 * no longer hers. Steered as it cruises, at 4-6 times the cruise's turn rate and no turn cut under LEG_MIN_MS, the surge
 * swung 30 degrees each side of her and back every 1.25 s, each turn said at the beat.
 */
function closeOn(f, now, target, out) {
  const go = now + SERPENT_SAY_AHEAD_MS, v = closeV(f, target), [ax, az] = closeAim(f, now, target);
  const L = f.legs[f.legs.length - 1];
  // its straight, from where it begins (still to come, at the turn's end) or from where its head is then: kept
  const s = L && L.k === LEG.line && Math.abs(L.v - v) <= 0.5 ? headAt(f.legs, Math.max(go, L.at)) : null;
  if (s && Math.abs(serpentWrapYaw(Math.atan2(ax - s.x, az - s.z) - s.yw)) <= STEER_STRAIGHT) return;
  const h = headAt(f.legs, go), way = wayOnto(h, h.yw, HUNT_TURN_R, { x: ax, z: az });
  const turn = way && way.turn * way.r >= 0.05 ? (way.turn * way.r * 1000) / v : 0;
  if (turn) pushLeg(f, legFrom(f.legs, go, LEG.arc, v, HUNT_TURN_R, way.s1), out);
  pushLeg(f, legFrom(f.legs, Math.round(go + turn), LEG.line, v), out);
}
/** SERPENT3: where it surges when closing on `target` - at her, unless she lies inside the round it would turn on to
 *  face her: then on, straight, until she can be turned onto (turned at, it circled a ship lying still for ever and
 *  never faced her). AUDIT 2 XB1: from where its head will be as its surge is said to begin, SERPENT_SAY_AHEAD_MS on. */
export function closeAim(f, now, target0) {
  const h = headAt(f.legs, now + SERPENT_SAY_AHEAD_MS);
  // AUDIT SHIPS A1: it surges where it will meet her - led by the time its surge takes to reach her
  const target = serpentLeadOf(f, target0, SERPENT_SAY_AHEAD_MS + (dist(h.x, h.z, target0.x, target0.z) / closeV(f, target0)) * 1000);
  const err = serpentWrapYaw(Math.atan2(target.x - h.x, target.z - h.z) - h.yw);
  const sd = err >= 0 ? 1 : -1;
  const cx = h.x + sd * HUNT_TURN_R * Math.cos(h.yw), cz = h.z - sd * HUNT_TURN_R * Math.sin(h.yw);
  if (Math.abs(err) > STEER_STRAIGHT && Math.hypot(target.x - cx, target.z - cz) < HUNT_TURN_R) return [h.x + Math.sin(h.yw) * HUNT_TURN_R * 2, h.z + Math.cos(h.yw) * HUNT_TURN_R * 2];
  return keepIn(target.x, target.z, ARENA_R + 60);
}

/** The attack in flight, on its beat: the coil's winding, the maelstrom's forming (SERPENT3: their swims and rides were
 *  said as they began). */
function attackBeat(f, now, here, out) {
  const a = f.atk, A = SERPENT_ATTACK_BY_ID[a.a];
  if (A === SERPENT_ATTACK_TABLE.coil) {
    if (!a.done && now >= a.at) { a.done = true; beginCoil(f, a, now, here, out); }
  } else if (A === SERPENT_ATTACK_TABLE.mael) {
    if (!a.done && now >= a.at) {
      a.done = true;
      const x = r2(a.tg[0][0]), z = r2(a.tg[0][1]);   // as its word said it (serpentAtkFrame)
      f.mael = { at: a.at, x, z };
      out.push({ k: 'mael', at: a.at, x, z });
      f.rearAt = a.at;
    }
  }
}

/**
 * THE COIL WINDS about the ship it was begun at - where she stands at its landing - with COIL_TEAM_S of the fighters'
 * broadsides as its health, holding COIL_MS unless broken. Her own machine says whether she was inside its ring
 * (`held`, with her hull's middle) or had slipped it (`esc` - the coil closes on empty sea).
 */
function beginCoil(f, a, now, here, out) {
  // it closes where its ring was said - the ship's own word (`held`) brings it onto her hull's middle
  const cx = a.tg[0][0], cz = a.tg[0][1];
  const h = headAt(f.legs, a.at);   // SERPENT3: where its head goes round her at the landing
  const th = Math.atan2(h.x - cx, h.z - cz);
  // AUDIT SERPENT T3: COIL_TEAM_S of the broadsides of the ships FIGHTING it - afloat, and with some threat on it
  const refs = here.reduce((s, b) => { const p = f.players[b.sub]; return s + (p && !p.wreck && (f.threat[b.sub] ?? 0) > 0 ? p.ref : 0); }, 0);
  const m = Math.max(COIL_HP_MIN, Math.round(COIL_TEAM_S * refs));
  // its moment the landing's - the moment every client tested its own ship against the ring - not the beat's
  // AUDIT SHIPS D2: drawn winding on SERPENT_SAY_AHEAD_MS after this beat says it (`w` - serpentBody.js coilWeight)
  f.coil = { i: a.i, s: a.s ?? null, x: r2(cx), z: r2(cz), th: r4(th), at: a.at, w: now + SERPENT_SAY_AHEAD_MS, until: a.at + COIL_MS, off: 0, h: m, m, held: false, why: null };
  f.coils = (f.coils ?? 0) + 1;
  // SERPENT3: its head is on the round already, going round it (begin) - its ride said with its wind-up
  out.push(coilFrame(f.coil));
  // AUDIT SERPENT S3/B1: her word, said at the landing on her own clock, came before the beat that wound it - heard now
  if (a.word) out.push(...coilWord(f, a.word.sub, a.word.k, a.i, a.word.x, a.word.z, Math.max(now, f.coil.at)));
}
/**
 * AUDIT 2 XC3/XB5 (2026-10-06): ONE CENTRE - its head's round laid again about the coil `c` as it is drawn (its centre,
 * and its bearing gone round at DRIFT_V - serpentBody.js coilAngleAt): from `t0` the head swims straight onto the ring
 * where the coil drawn has gone round to, at DASH_V at most, and round it from there. Never before the coil holds the
 * whole body (its winding on drawn - coilWeight), so its track is out of sight as it moves. Her word (`held`) moves the
 * coil onto her hull's middle, up to COIL_HELD_SLACK, and a fight of an older law keeps that law's round: its head went
 * round the old ring, and as the coil let go the body unwound onto it - from 30 m off the coil drawn, a 42 m lurch.
 */
function coilRound(f, c, now, out) {
  const t0 = Math.max(now + SERPENT_SAY_AHEAD_MS, (c.w > c.at ? c.w : c.at) + COIL_BLEND_MS), h = headAt(f.legs, t0);
  const onRing = (t) => { const a = coilAngleAt(c, t); return { x: c.x + Math.sin(a) * COIL_R, z: c.z + Math.cos(a) * COIL_R, a }; };
  let t1 = t0 + 1, p = onRing(t1);
  // the ring's point it meets, and the moment - at DASH_V at most (its bearing goes round far slower than that)
  for (let k = 0; k < 8; k++) {
    const need = t0 + Math.max(1, Math.ceil((dist(h.x, h.z, p.x, p.z) * 1000) / DASH_V));
    if (need <= t1) break;
    t1 = need; p = onRing(t1);
  }
  pushLeg(f, { k: LEG.line, at: t0, x: h.x, z: h.z, yw: Math.atan2(p.x - h.x, p.z - h.z), v: (dist(h.x, h.z, p.x, p.z) * 1000) / (t1 - t0) }, out);
  pushLeg(f, { k: LEG.arc, at: t1, x: p.x, z: p.z, yw: p.a - Math.PI / 2, v: DRIFT_V, r: COIL_R, sd: -1 }, out);
}
/** The coil as the wire says it. */
export const coilFrame = (c) => ({ k: 'coil', i: c.i, s: c.s, x: c.x, z: c.z, th: c.th, at: c.at, ...(Number.isFinite(c.w) ? { w: c.w } : {}), until: c.until, h: Math.ceil(c.h), m: c.m });
/** The coil let go - broken, crushed or slipped - and the swim taken up again from where its head is (at `v`: a broken
 *  coil's adrift). AUDIT SHIPS D2: its round held, and the swim taken up and the coil unwound SERPENT_SAY_AHEAD_MS on
 *  (`off` - every word of its letting go says it): crushed at the beat and said so, a screen 150 ms behind snapped its
 *  head 0.8 m on and 0.24 m up. It holds no ship from the beat (coilHolds). AUDIT 2 XB2: laid from then alone, as the
 *  kill's throes are - a round laid again about her (coilRound) swum as it was said until then. */
function releaseCoil(f, now, out, v = CRUISE_V) {
  const go = now + SERPENT_SAY_AHEAD_MS;
  f.coil.off = go;
  pushLeg(f, legFrom(f.legs, go, LEG.line, v), out);
  pushMode(f, go, MODE.cruise, out);
}
/** A COIL BROKEN by the ships' fire: it lets go, and lies stunned on the water - its head the prize. */
function breakCoil(f, now, by, out) {
  f.coil.h = 0;
  f.coil.why = 'broken';
  f.stunUntil = now + SERPENT_STUN_MS;
  releaseCoil(f, now, out, DRIFT_V);   // AUDIT SHIPS D2: adrift, said ahead with its letting go
  if (f.atk) f.atk.until = Math.min(f.atk.until, now);
  out.push({ k: 'cb', i: f.coil.i, n: by, at: f.coil.off, su: f.stunUntil });
}
/**
 * The ship in a coil says her word: `held` (she was inside its ring - `x`/`z` her hull's middle, within COIL_HELD_SLACK
 * of the coil) or `esc` (she had slipped it, within COIL_ESC_MS of its winding). Only the coiled ship's account speaks
 * for her. Answers the frames to fan.
 */
export function coilWord(f, sub, k, i, x, z, now) {
  const out = [];
  const c = f.coil;
  // AUDIT SERPENT S3/B1: the word of a coil not yet wound - its landing come on her clock, the relay's beat still to
  // wind it (up to SERPENT_TICK_MS on) - is kept on the attack and heard as it winds (beginCoil)
  const a = f.atk;
  if ((!c || c.i !== i) && a && a.i === i && a.a === SERPENT_ATTACK_TABLE.coil.id && !a.done && a.s === sub && !a.word && now >= a.at - COIL_WORD_EARLY_MS && (k === 'held' || k === 'esc')) {
    a.word = { sub, k, x: Number.isFinite(x) ? x : null, z: Number.isFinite(z) ? z : null };
    return out;
  }
  if (!c || c.i !== i || c.s !== sub || !coilHolds(f, now) || c.held) return out;
  if (k === 'esc') {
    if (now - c.at > COIL_ESC_MS) return out;
    c.why = 'esc';
    releaseCoil(f, now, out);
    out.push({ k: 'cx', i: c.i, at: c.off });
    return out;
  }
  if (k === 'held') {
    c.held = true;
    const moved = Number.isFinite(x) && Number.isFinite(z) && dist(x, z, c.x, c.z) <= COIL_HELD_SLACK && dist(x, z, c.x, c.z) >= 0.01;
    if (moved) { c.x = r2(x); c.z = r2(z); }
    out.push(coilFrame(c));
    if (moved) coilRound(f, c, now, out);   // AUDIT 2 XC3: one centre
  }
  return out;
}

/**
 * SERPENT3: A FIGHT RESUMED after its room slept - not stepped for SERPENT_SLEEP_MS (the relay beats a fight only while
 * someone hears it). From its last beat its head circles where it was, cruising, on a round toward its waters' heart -
 * its track laid again from there, every leg and ride said since let go - and the attack it had in flight landed on
 * empty waters; a coil holding a ship keeps its round until its own clock ends it. Answers the frames to fan. Every beat
 * asks it first (stepSerpentBrain), and the relay before a joiner's whole state and before a word is judged
 * (server/src/index.js _serpentIn, _serpentFrame). The
 * stray's surfacing it replaces leapt a head that had swum on out of its waters back into them, seen through the water.
 */
export function serpentResume(f, now) {
  const out = [];
  const t0 = f.lastTickAt;
  const law = f.woke === 'law';
  if (f.fell || f.gone || (!law && !(now - t0 > SERPENT_SLEEP_MS))) return out;
  delete f.woke;
  // AUDIT SHIPS B1: A SHORT SLEEP - every screen that kept the fight drew it on as it was said, so what was said stands
  // (an attack in flight lands as it was told); its head swum out of its waters meanwhile turns for home from the moment
  // its word can reach them (after its last said leg begins), never from its last beat
  if (!law && now - t0 <= SERPENT_DRAWN_MS) {
    const L = f.legs[f.legs.length - 1];
    const from = Math.max(now + SERPENT_SAY_AHEAD_MS, L?.at ?? 0);
    const h = headAt(f.legs, from);
    if (Math.hypot(h.x, h.z) <= ARENA_R + 60) return out;
    f.lastTickAt = now;
    pushLeg(f, legFrom(f.legs, from, LEG.arc, CRUISE_V, ORBIT_R, h.x * Math.cos(h.yw) - h.z * Math.sin(h.yw) <= 0 ? 1 : -1), out);
    return out;
  }
  f.lastTickAt = now;
  // AUDIT 2 XB5 (2026-10-06): a coil holding a ship keeps its round - an older law's round laid again about it as this
  // law draws it (coilRound): kept, its head went round where that law sent it, up to 78 m off the coil drawn
  if (coilHolds(f, now)) { if (law) coilRound(f, f.coil, now, out); return out; }
  if (f.atk) { f.atk = null; f.target = null; f.nextAt = Math.max(f.nextAt, now + SERPENT_BREATH_MS); }
  f.closing = null;
  const h = headAt(f.legs, t0);
  const sd = h.x * Math.cos(h.yw) - h.z * Math.sin(h.yw) <= 0 ? 1 : -1;   // the heart to its right: turn right
  pushLeg(f, legFrom(f.legs, t0, LEG.arc, CRUISE_V, ORBIT_R, sd), out);
  pushMode(f, t0, MODE.cruise, out);
  return out;
}

/**
 * ONE BEAT. `bodies` are the fight's players about it now ({sub, x, z, dead} - the site frame), `rng` a [0,1) source.
 * Answers the frames to send, in order, as plain objects the relay stamps and fans (the `serpent` frame's kinds). Moves
 * the state in place.
 */
export function stepSerpentBrain(f, now, bodies, rng) {
  const out = serpentResume(f, now);   // SERPENT3: a room that slept - nobody heard it - takes it up circling where it was
  const dt = Math.min(SERPENT_STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  pruneLegs(f, now - SERPENT_HIT_LOOKBACK_MS[SERPENT_HIT_LOOKBACK_MS.length - 1]);   // SERPENT3: the body a blow is judged on
  if (f.fell || f.gone) { stateFrame(f, now, out); return out; }
  if (now >= f.soundAt) { sound(f, now, out); return out; }
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && Math.hypot(b.x, b.z) <= ENGAGE_R);
  // standing: a living body within SERPENT_STAND_R of its body stands its time (AUDIT SERPENT E1: never a boat parked
  // where nothing of it reaches), and the fight's own clock runs while anyone is at it
  const pts = here.length ? bodyAt(f, now) : null;
  for (const b of here) if (nearestPoint(pts, b.x, b.z) <= SERPENT_STAND_R) f.players[b.sub].stoodMs += dt;
  if (here.length) f.liveMs += dt;
  // a share leaves with its fighter, and comes back with them - never a wreck's, nor a silent ship's (serpentShareWanted)
  for (const b of here) { f.players[b.sub].seenAt = now; serpentWayOf(f.players[b.sub], b, now); }   // AUDIT SHIPS A1: and her way
  for (const p of Object.values(f.players)) { if (serpentShareWanted(p, now)) restoreSerpentShare(f, p); else retireSerpentShare(f, p); }
  // AUDIT SERPENT B7: the ships in its waters - AUDIT SHIPS C1: the ships fighting it, whose shares are its health
  recount(f);
  const keep = Math.pow(1 - SERPENT_THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  // a phase crossed: its ward, and the phase's turn. AUDIT SERPENT S2: an attack in flight lands as every screen was
  // told it would (the turn waits for its span - nothing said is unsaid); a coil holding a ship lets her go
  if (f.max > 0 && f.phase < 3 && f.hp / f.max <= SERPENT_PHASE_AT[f.phase - 1]) {
    f.phase++;
    f.shieldUntil = now + SERPENT_SHIELD_MS;
    f.stunUntil = 0;
    if (coilHolds(f, now)) { f.coil.why = 'turn'; releaseCoil(f, now, out); out.push({ k: 'cx', i: f.coil.i, at: f.coil.off }); }
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.queue = [...SERPENT_PHASE_TURN[f.phase]];
    f.pending = null;
    f.closing = null;   // SERPENT3: the turn's own attacks first
    if (!f.atk) { const [first, ...rest] = f.queue; f.queue = rest; begin(f, SERPENT_ATTACK_TABLE[first], now, null, rng, out); }
  }
  // the coil's own clock: its crush at its end
  if (coilHolds(f, now) && now >= f.coil.until) {
    f.coil.why = 'crushed';
    releaseCoil(f, now, out);
    out.push({ k: 'cr', i: f.coil.i, at: f.coil.off });   // AUDIT SHIPS D2: at its letting go, said ahead
  }
  // stunned: adrift, its head on the water - no blow of its
  if (stunned(f, now)) { endFrames(f, now, out); return out; }
  if (f.atk) {
    attackBeat(f, now, here, out);
    // an attack holds the turn through its span - a coil until it is let go, however long it holds
    const A = SERPENT_ATTACK_BY_ID[f.atk.a];
    if (now < f.atk.until || (A === SERPENT_ATTACK_TABLE.coil && coilHolds(f, now))) { endFrames(f, now, out); return out; }
    const was = f.atk;
    f.runA = was.a === f.lastA ? (f.runA ?? 0) + 1 : 1;
    f.lastA = was.a;
    f.freeAt = now;
    f.atk = null;
    f.target = null;
    f.nextAt = now + SERPENT_BREATH_MS;
    // it settles back to cruising (the coil's letting go said so already; the Maelstrom's forming leaves it reared)
    if (A.mode !== MODE.cruise && A !== SERPENT_ATTACK_TABLE.coil && A !== SERPENT_ATTACK_TABLE.mael) pushMode(f, now + SERPENT_SAY_AHEAD_MS, MODE.cruise, out);   // AUDIT SHIPS D2: said ahead
    if (f.queue.length) { f.pending = f.queue.shift(); f.nextAt = now + SERPENT_BREATH_MS; }
  }
  // SERPENT3: CLOSING on a ship for a dash its wind-up cannot swim yet - on the surface, at her - and the dash begun the
  // beat she lies within it; she outsailed it, or is gone, and it chooses again
  if (f.closing) {
    const c = f.closing, A = SERPENT_ATTACK_BY_ID[c.a];
    // AUDIT 2 XB10 (2026-10-06): and a coil's ship still on a ship of her own (serpentOnShip) - one who stepped onto a
    // friend's deck while it closed was coiled there, a hand AUDIT SHIPS C1 never coils
    const t = here.find((b) => b.sub === c.s && !f.players[b.sub]?.wreck && (A !== SERPENT_ATTACK_TABLE.coil || serpentOnShip(f.players[b.sub]))) ?? null;
    if (t && now - c.at < SERPENT_CLOSE_MS) { closeOrBegin(f, A, now, t, rng, out); endFrames(f, now, out); return out; }
    f.closing = null;
  }
  if (f.pending && now >= f.nextAt) {
    const A = SERPENT_ATTACK_TABLE[f.pending];
    f.pending = null;
    const t = A === SERPENT_ATTACK_TABLE.coil ? pickSerpentTarget(f, here, rng, true) : null;
    if (A && (A !== SERPENT_ATTACK_TABLE.coil || t)) { closeOrBegin(f, A, now, t, rng, out); endFrames(f, now, out); return out; }
  }
  // choose: a target kept a while, and what can be done to it from here
  let target = f.target ? here.find((b) => b.sub === f.target) ?? null : null;
  if (!target || now - f.targetAt >= SERPENT_TARGET_HOLD_MS) { target = pickSerpentTarget(f, here, rng); f.target = target?.sub ?? null; f.targetAt = now; }
  if (now >= f.nextAt && now >= f.openUntil && target && !f.pending) {
    const h = headAt(f.legs, now);
    if (now - (f.freeAt ?? 0) >= 6000) f.runA = 0;
    const can = serpentAttacksFor(f.phase, dist(target.x, target.z, h.x, h.z), serpentOnShip(f.players[target.sub]), f.lastA, f.runA);   // AUDIT SHIPS C1
    if (can.length) { closeOrBegin(f, chooseSerpentAttack(can, rng), now, target, rng, out); endFrames(f, now, out); return out; }
  }
  // the Maelstrom's rearing: its head up out of the whirl, then down again
  if (f.mael && !f.atk) {
    const m = f.modes[f.modes.length - 1]?.m;
    if (m === MODE.rear && now - f.rearAt >= MAEL_REAR_MS) { pushMode(f, now + SERPENT_SAY_AHEAD_MS, MODE.cruise, out); f.rearAt = now; }   // AUDIT SHIPS D2: said ahead
    else if (m !== MODE.rear && now - f.rearAt >= MAEL_REAR_EVERY_MS) { pushMode(f, now + SERPENT_SAY_AHEAD_MS, MODE.rear, out); f.rearAt = now; }
  }
  steer(f, now, aimOf(f, now, target), f.mael && f.modes[f.modes.length - 1]?.m === MODE.rear ? REAR_V + 2 : CRUISE_V, out);
  endFrames(f, now, out);
  return out;
}

function endFrames(f, now, out) { hpFrame(f, now, out); coilHpFrame(f, now, out); stateFrame(f, now, out); }
/** Its health's word, at most every SERPENT_HP_SEND_MS - AUDIT 2 XC1 (2026-10-06): and the count of the ships fighting it
 *  (`n`, the pair's share's - systems/serpentStrike.js fleetShare) whenever that changes: said in the whole state alone,
 *  every SERPENT_STATE_SEND_MS, a pair's survivor was eased and a third ship's joining was not for up to 5 s. */
function hpFrame(f, now, out) {
  const h = Math.round(f.hp), n = f.ships ?? 0;
  if ((h !== f.lastHpSent || n !== f.lastNSent) && now - f.lastHpAt >= SERPENT_HP_SEND_MS) { f.lastHpSent = h; f.lastNSent = n; f.lastHpAt = now; out.push({ k: 'hp', h, m: Math.round(f.max), n }); }
}
function coilHpFrame(f, now, out) {
  const c = f.coil;
  if (!c || !coilHolds(f, now)) return;
  const h = Math.ceil(c.h);
  if (h !== c.sent && now - (c.sentAt ?? 0) >= SERPENT_HP_SEND_MS) { c.sent = h; c.sentAt = now; out.push({ k: 'ch', i: c.i, h }); }
}
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < SERPENT_STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(serpentStateOf(f));
}
/** The whole state as the wire says it (the `st` kind): on joining, and every SERPENT_STATE_SEND_MS. */
export function serpentStateOf(f) {
  const c = f.coil;
  return {
    k: 'st', d: f.day, b: f.boss, sx: f.sx, sz: f.sz, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max),
    legs: f.legs.slice(-LEGS_KEPT * 2), modes: f.modes.slice(-MODES_KEPT),
    coil: c ? { i: c.i, s: c.s, x: c.x, z: c.z, th: c.th, at: c.at, ...(Number.isFinite(c.w) ? { w: c.w } : {}), until: c.until, off: c.off > 0 ? c.off : 0, h: Math.ceil(c.h), m: c.m } : null,
    mael: f.mael ? { at: f.mael.at, x: f.mael.x, z: f.mael.z } : null,
    atk: f.atk ? serpentAtkFrame(f.atk) : null, sh: f.shieldUntil, su: f.stunUntil > 0 ? f.stunUntil : 0, sa: f.soundAt,
    n: f.ships ?? 0, op: f.openUntil,   // AUDIT SERPENT B7: the ships afloat at the fight, never every account that ever joined
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null,
    gone: f.gone ? f.gone.at : null,
  };
}
