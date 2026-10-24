// @ts-check
// WB3 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)", and Option B: the relay's
// Durable Object is the authority over the boss): THE BOSS'S BRAIN - the whole of what the relay runs for a gate's
// fight, as pure law. Design: bible/11-Multiplayer/World-Bosses.md sections 5-6.
//
// WHY THE RELAY CAN RUN THIS AND NOT A DUNGEON. Co-op's law is that the host's browser is the server, because a Durable
// Object running the simulation would be a second copy of the game (11-Multiplayer/Multiplayer.md). The arena is built
// so that a boss needs no game: it stands on a flat disc with nothing to path round, so its whole world is a point, a
// facing, a health bar, a clock and the players' feet - which the relay already holds (each socket's last pose rides
// its attachment). This file is that world: a state, and the functions that move it.
//
// PURE. No clock of its own (every function takes `now`, the relay's clock), no randomness of its own (an `rng` is
// handed in - a seeded one in the pins, the object's CSPRNG in the relay), no I/O: the relay's object
// (server/src/index.js) owns the sockets, the alarm that steps this, the storage that checkpoints it and the receipts,
// and turns what `stepBrain` answers into frames. The client reads the SAME tables (the attacks' shapes and timings) to
// draw the telegraphs and to resolve an attack against its own feet - one law, both ends. Everything here is a plain
// object of numbers and strings, so the checkpoint is the state itself.
//
// THE COURT'S FRAME. Metres, the court's centre at the origin, +z toward the south bridge the players arrive by
// (world/gate/gateArena.js stands the court so; the relay subtracts its centre from a pose before a body reaches this
// file). A facing is `atan2(dx, dz)` - 0 looks south, at the door.
//
// THE FIGHT'S NUMBERS (bible section 5): each player's level CLAIM scales both what they bring (health) and what they
// may deal (a bucket), so no claim buys a faster kill - the fastest possible is BOSS_TTK_S / BUCKET_RATE_X of
// full-rate damage whatever anybody says.
//
// Not a DFU member. Ledger A (WB).
import { t } from '../../systems/textManager.js';   // WB14a: the new arsenal's names in the player's language (L10N4)
import { readGateMods, validGateMods, GATE_TRIALS, validGatePortents, hasPortent, portentBits } from './gateMods.js';   // WB8b: the Warden's marks - the fight's profile is made from them; WB14b: the night's portents - its floor plan

// ── the court and the body ─────────────────────────────────────────────
/** Where the court's centre stands in the arena's own dungeon frame, metres: its one made block's middle
 *  (world/gate/gateArena.js lays the block at the grid's origin, RDB_SIDE 51.2 across, the floor's top at y 0 - pinned
 *  equal). The relay subtracts it from a pose, so the brain reads every body in the court's frame. */
export const COURT_CENTRE = Object.freeze([25.6, 0, 25.6]);
/** The court's floor, metres: the ring the motor keeps a player inside (motor.arena), and the relay's bound on where a
 *  blow can come from. */
export const COURT_R = 24;
/** The boss's body: its radius and height, metres (three times a Daedra Lord's - WB4 draws it at this size). */
export const BOSS_R = 1.8;
export const BOSS_H = 5.6;
/** The disc his centre keeps to - the rune ring he never crosses, so the floor past it is always a way out. */
export const BOSS_REACH_R = 16;
/** How fast he walks, metres a second (a player runs 7.6 - motor.js - so a runner can always get clear). */
export const BOSS_SPEED = 3.2;

// ── WB9b: THE THREE COURTS ──────────────────────────────────────────────
/**
 * WB9b (2026-09-30, Mac: "I want to add 2 more arena's of the same size that the boss leaps to between each phase. A
 * walkway should form to allow players to traverse through each arena"): THE COURTS - three floors of one size over the
 * one sea of fire, fought in turn: the Warden in the first (where the players arrive - this frame's origin), the Burning
 * Court in the second, Dagon's Champion in the third. West, then north: clear of the great tower's window
 * (render/deadlands.js SIGIL_TOWER, a little east of north), so the arrival's sightline to it stays as WB6a left it.
 * Each rim is some 24 m from the next - a walkway's length.
 */
//
// WB14b (2026-10-19, bible/11-Multiplayer/Breach-Portents.md section 2): AND THE FLOORS A PORTENT STANDS - every floor a
// night may hold is one table (all of COURT_R), its index its name: the three courts, then the Vanguard's Muster and
// Bridgehead south of the first (off its bridge's line), then the Captive's Pen east of it. A night's PLAN says which
// stand (nightPlan); a plain night's is WB9b's three.
export const COURTS = Object.freeze([Object.freeze([0, 0]), Object.freeze([-68, -22]), Object.freeze([-74, -94]), Object.freeze([-40, 60]), Object.freeze([-20, 128]), Object.freeze([70, -10])]);
/** WB14b: the floors by name (their index in COURTS) - the three courts WB9b fights in, and the portents'. */
export const FLOOR = Object.freeze({ first: 0, second: 1, third: 2, muster: 3, bridgehead: 4, pen: 5 });
/** WB14b: how many of COURTS are his courts - the floors a phase is fought in (courtOfPhase); the rest are the portents'. */
export const COURTS_HIS = 3;
/** WB14d: THE COURT HIS LAST PHASE IS FOUGHT IN - the third, or (the Sundering) the first, where his halves fall back
 *  together; his Reckonings are armed there. */
export const finalCourt = (f) => (hasPortent(f?.pt, 'sunder') ? FLOOR.first : FLOOR.third);
/** The court a phase is fought in (its index in COURTS). */
export const courtOfPhase = (phase) => Math.max(0, Math.min(COURTS_HIS - 1, (phase | 0) - 1));
/** The court nearest a point - where a body standing there is (the courts' discs never meet). */
export function nearestCourt(x, z) {
  let best = 0, bd = Infinity;
  COURTS.forEach((c, k) => { const d = Math.hypot(x - c[0], z - c[1]); if (d < bd) { bd = d; best = k; } });
  return best;
}
/** Is (x, z) within `pad` of court `k`'s floor? */
export const inCourt = (x, z, k, pad = 0) => !!COURTS[k] && Math.hypot(x - COURTS[k][0], z - COURTS[k][1]) <= COURT_R + pad;
/**
 * WB9b: THE WALKWAYS - a lane from one court to the next, WALK_HALF_W either side of the line between their centres,
 * reaching WALK_SINK_M into each floor it joins (no seam at either rim). LAID, not standing: from the word of the leap
 * that crosses it (the fight's `xa[k]`) its stones rise out of the fire from the court he leaves toward the one he leaps
 * to - the first WALK_LEAD_MS after the word, then on over WALK_FORM_MS - and it is floor as far as it has risen
 * (walkFormed; world/gate/gateArena.js slabRise raises each stone whole before the floor reaches it). Walkway k joins court k
 * to court k+1. WB14b: walkway k joins floor `a` to floor `b` (WALK_ENDS) - WB9b's two, then the Sundering's Rift Way from
 * the first court to the third, the Vanguard's two (the Bridgehead to the Muster, the Muster to the first court) and the
 * Captive's (the first court to the Pen); its stones rise from `a`, whatever laid it.
 */
export const WALK_HALF_W = 3.2;
export const WALK_LEAD_MS = 1000;
export const WALK_FORM_MS = 4000;
export const WALK_SINK_M = 2;
/** WB14b: each walkway's floors, [from, to] - by its index (bible/11-Multiplayer/Breach-Portents.md section 2). */
export const WALK_ENDS = Object.freeze([[0, 1], [1, 2], [0, 2], [4, 3], [3, 0], [0, 5]].map((e) => Object.freeze(e)));
/** WB14b: the walkways by name (their index in WALKS). */
export const WALKWAY = Object.freeze({ second: 0, third: 1, rift: 2, muster: 3, warden: 4, pen: 5 });
/** Walkway k's line: from `a` (in court k) to `b` (in court k+1), its direction and its length. WB14b: from floor `a` to
 *  floor `b` (WALK_ENDS[k]). */
export function walkwayOf(k) {
  const e = WALK_ENDS[k], A = e ? COURTS[e[0]] : null, B = e ? COURTS[e[1]] : null;
  if (!A || !B) return null;
  const dx = B[0] - A[0], dz = B[1] - A[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, r = COURT_R - WALK_SINK_M;
  const ax = A[0] + ux * r, az = A[1] + uz * r, bx = B[0] - ux * r, bz = B[1] - uz * r;
  return Object.freeze({ k, a: e[0], b: e[1], ax, az, bx, bz, ux, uz, len: Math.hypot(bx - ax, bz - az) });
}
export const WALKS = Object.freeze(WALK_ENDS.map((_, k) => walkwayOf(k)));
/** How much of walkway k is laid at `now` (0..1) - from WALK_LEAD_MS after its crossing's word (`xa[k]`) over
 *  WALK_FORM_MS; none before. */
export function walkFormed(xa, k, now) {
  const at = Array.isArray(xa) ? xa[k] : null;
  return Number.isFinite(at) ? Math.max(0, Math.min(1, (now - at - WALK_LEAD_MS) / WALK_FORM_MS)) : 0;
}

// ── WB14b: THE NIGHT'S FLOOR PLAN ───────────────────────────────────────
/**
 * WB14b (bible/11-Multiplayer/Breach-Portents.md section 2): A NIGHT'S PLAN - the floors and walkways its portents stand
 * (net/gate/gateMods.js GATE_PORTENTS), and its ROOT, where its fighters arrive: every night his three courts and the
 * walkway to the second; the walkway to the third unless he sunders (his halves leave the first court by the second's
 * and by the Rift Way); the Vanguard's two platforms and their walkways, its Bridgehead the root; the Captive's Pen and its
 * walkway. A plain night's is WB9b's exactly. Pure; one plan a set of portents, made once and kept.
 * @typedef {{key: string, pt: ReadonlyArray<string>|null, root: number, floors: ReadonlyArray<number>, walks: ReadonlyArray<number>}} FloorPlan
 * @param {unknown} pt the night's portents (net/gate/gateMods.js validGatePortents - anything else is a plain night)
 * @returns {Readonly<FloorPlan>}
 */
export function nightPlan(pt) {
  const ok = validGatePortents(pt) ?? null, key = ok ? ok.join(',') : '';
  let P = _plans.get(key);
  if (P) return P;
  const has = (id) => !!ok && ok.includes(id);
  /** @type {number[]} */ const floors = [FLOOR.first, FLOOR.second, FLOOR.third];
  /** @type {number[]} */ const walks = [WALKWAY.second];
  if (has('sunder')) walks.push(WALKWAY.rift); else walks.push(WALKWAY.third);
  if (has('vanguard')) { floors.push(FLOOR.muster, FLOOR.bridgehead); walks.push(WALKWAY.muster, WALKWAY.warden); }
  if (has('captive')) { floors.push(FLOOR.pen); walks.push(WALKWAY.pen); }
  P = Object.freeze({ key, pt: ok, root: has('vanguard') ? FLOOR.bridgehead : FLOOR.first, floors: Object.freeze(floors.sort((x, y) => x - y)), walks: Object.freeze(walks.sort((x, y) => x - y)) });
  _plans.set(key, P);
  return P;
}
/** The plans made (a handful at most - one a set of portents). */
const _plans = new Map();
/** WB14b: a plain night's plan - WB9b's three courts and two walkways, the first court the root. */
export const PLAN_PLAIN = nightPlan(null);
/** WB14b: a fight's plan, or a state's - the brain's fight and the court's state alike carry `pt` (the relay's word). */
export const planOf = (f) => nightPlan(f?.pt ?? null);
/**
 * WB14b: THE FLOORS THAT ARE FLOOR at `now` - the plan's root, and every floor of the plan a walkway of the plan laid
 * whole reaches from one that is (WB9b: a court past a walkway laid whole). Pure.
 * @param {Readonly<FloorPlan>} plan @param {ReadonlyArray<number>|null|undefined} xa @param {number} now
 * @returns {number[]}
 */
export function liveFloors(plan, xa, now) {
  const live = [plan.root];
  for (let grew = true; grew;) {
    grew = false;
    for (const k of plan.walks) {
      const w = WALKS[k];
      if (live.includes(w.b) || !live.includes(w.a) || !plan.floors.includes(w.b) || walkFormed(xa, k, now) < 1) continue;
      live.push(w.b);
      grew = true;
    }
  }
  return live;
}
/**
 * WB9b: THE FLOOR A BODY MAY STAND ON at `now` (the fight's crossings `xa`): the first court; each walkway as far as it
 * is laid; each court past a walkway laid whole. `pad` widens every part (a pose's slack). The relay's bound on where a
 * blow may come from, and (clampToFloor) the motor's on where a player may walk - one law, both ends. Pure. WB14b: the
 * night's plan's - its root (the first court, or the Vanguard's Bridgehead), each of its walkways as far as it is laid
 * from a floor that is floor, each of its floors such a walkway reaches laid whole (liveFloors).
 */
export function onFloor(x, z, xa, now, pad = 0, plan = PLAN_PLAIN) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const live = liveFloors(plan, xa, now);
  for (const k of live) if (inCourt(x, z, k, pad)) return true;
  for (const k of plan.walks) {
    const w = WALKS[k], f = walkFormed(xa, k, now);
    if (!(f > 0) || !live.includes(w.a)) continue;
    const t = (x - w.ax) * w.ux + (z - w.az) * w.uz, side = Math.abs((x - w.ax) * w.uz - (z - w.az) * w.ux);
    if (t >= -pad && t <= w.len * f + pad && side <= WALK_HALF_W + pad) return true;
  }
  return false;
}
/**
 * WB9b: THE NEAREST POINT OF THE FLOOR (onFloor's, every part drawn in by `inset` - a body's own radius) to (x, z), or
 * null when (x, z) already stands on it: the motor's clamp in the court (world/gate/gateArena.js courtArena), as the duel's
 * ring clamps to its disc. Pure. WB14b: the night's plan's floor (onFloor's).
 */
export function clampToFloor(x, z, xa, now, inset = 0, plan = PLAN_PLAIN) {
  let best = null, bd = Infinity;
  const consider = (px, pz) => { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz]; } };
  const live = liveFloors(plan, xa, now);
  for (const k of live) {
    const [cx, cz] = COURTS[k], r = Math.max(0, COURT_R - inset), d = Math.hypot(x - cx, z - cz);
    if (d <= r) return null;
    consider(cx + ((x - cx) / d) * r, cz + ((z - cz) / d) * r);
  }
  for (const k of plan.walks) {
    const w = WALKS[k], f = walkFormed(xa, k, now);
    if (!(f > 0) || !live.includes(w.a)) continue;
    const hw = Math.max(0, WALK_HALF_W - inset), L = w.len * f;
    const t = (x - w.ax) * w.ux + (z - w.az) * w.uz, s2 = (x - w.ax) * w.uz - (z - w.az) * w.ux;
    if (t >= 0 && t <= L && Math.abs(s2) <= hw) return null;
    const tc = Math.max(0, Math.min(L, t)), sc = Math.max(-hw, Math.min(hw, s2));
    consider(w.ax + w.ux * tc + w.uz * sc, w.az + w.uz * tc - w.ux * sc);
  }
  return best;
}

// ── the clock of the fight ─────────────────────────────────────────────
/** The brain's beat, ms: the relay's alarm steps it this often while the fight lives. */
export const BRAIN_TICK_MS = 250;
/** How often at most the health goes out, and the whole state at least. */
export const HP_SEND_MS = 250;
export const STATE_SEND_MS = 5000;
/** How often the relay writes the fight to storage - an eviction loses this much of it, not the fight. */
export const CHECKPOINT_MS = 2000;
/** The longest step one beat credits: a room woken after a long sleep stands nobody the time it slept. */
export const STEP_MAX_MS = 1000;
/** He stands this long after the first fighter enters before he moves - time to see him. WB9a: and to read his marks
 *  (ui/gate/gateMarksView.js - the card stands MARKS_CARD_ARRIVE_MS as a fighter steps in). */
export const OPENING_MS = 8000;
/** A walk is said again when its goal moves this far (metres) or this long has passed (ms). */
export const MOVE_RESAY_M = 1.5;
export const MOVE_RESAY_MS = 1000;
/** A walk's target is kept this long before he looks again (a target who died or left is dropped at once). */
export const TARGET_HOLD_MS = 6000;
/** After an attack's recovery, this long before the next is chosen. */
export const BREATH_MS = 300;
/** The most accounts one fight remembers - its checkpoint's bound (a newcomer past it is refused). */
export const GATE_FIGHTERS_MAX = 256;

// ── the numbers a claim sets ───────────────────────────────────────────
export const LV_MIN = 1;
export const LV_MAX = 60;
/** A level claim as the fight reads it: a whole number, LV_MIN..LV_MAX. */
export const clampLv = (lv) => Math.max(LV_MIN, Math.min(LV_MAX, Number.isFinite(lv) ? Math.floor(lv) : LV_MIN));
/** The reference damage a second at a level: the port's own formulas at a normal swing (bible section 5). */
export const dpsRef = (lv) => 5 + clampLv(lv);
/** Seconds of reference damage the health a player brings stands for. */
export const BOSS_TTK_S = 240;
/** A player's damage bucket: refilled at BUCKET_RATE_X times their reference a second, BUCKET_DEPTH_X deep, and no one
 *  blow over HIT_CAP_X times it. */
export const BUCKET_RATE_X = 3;
export const BUCKET_DEPTH_X = 15;
export const HIT_CAP_X = 12;
/** The most blows one account lands a second (a fast swing is about one; arrows and spells fewer). */
export const GATE_HIT_HZ_MAX = 4;
/** AUDIT WB11 W3: ONE BLOW, ONE TOKEN. A swing's arc, a blast or a volley meets every body in it, each body met its own
 *  frame - every one of them under the blow's one sequence (`q`). The hand charges a BLOW, not a body: a frame of the
 *  blow just charged (its `q`, within BLOW_GROUP_MS of the charge) on a body it has not met yet rides on it,
 *  BLOW_BODIES_MAX bodies at most; any other frame is a blow of its own. (A token a body met: a swing through five Imps
 *  landed four, and starved the blows after it.) */
export const BLOW_GROUP_MS = 250;
export const BLOW_BODIES_MAX = 8;
/** How far a melee blow reaches past the boss's body (the player's own 2.5 - playerWeapon.js) and the slack for the
 *  pose's age (a pose is up to a fifth of a second old, and the boss walks while it travels). */
export const MELEE_REACH = 2.5;
export const POSE_SLACK = 3;
/** The blow kinds on the wire: a swing, a shaft, a spell. */
export const HIT_KINDS = Object.freeze({ Melee: 0, Shaft: 1, Spell: 2 });

// ── phases ─────────────────────────────────────────────────────────────
/** The health fractions he changes phase at, and how long he stands shielded when he does. */
export const PHASE_AT = Object.freeze([0.66, 0.33]);
export const SHIELD_MS = 3000;
/** Phase three's wind-ups, shortened by a fifth (AUDIT WB14 PLAY-5: never the Chains' - a run from his far side at the
 *  ring, with a reaction's 400 ms, came short of their hold in phase three; and never Dagon's or the bound's). */
export const PHASE3_WINDUP = 0.8;
/** WBX5 (2026-09-26, Mac: "The boss phases need to be more defined and more detailed mechanics"): EACH PHASE HAS A NAME
 *  AND A SHAPE. The Warden fights with his blade and his weight alone (Cleave, Ground Slam, Charge); the Burning Court is
 *  fire and reach (Hellfire and the Meteor leave the floor burning, the Flame Nova, the Crushing Leap at whoever stands
 *  far off); Dagon's Champion adds the Spokes of Dagon - four lanes of fire from his feet, and then the four between
 *  them. Not faster: Mac, of a player's ask for mechanics half again as fast, "I dont think making mechanics faster is
 *  the play". The names are the bar's (ui/gate/gateBossBar.js) and the turn's words (scenes/gate/gateCourt.js). */
// AUDIT WB14 (TEXT-9): read through the text core as each card is made (L10N4) - the Sundering's card said its order in the
// player's language beside a phase's name in English
export const PHASE_NAMES = Object.freeze(Object.defineProperties([], {
  0: { get: () => t('gate.phase.warden', 'The Warden'), enumerable: true },
  1: { get: () => t('gate.phase.court', 'The Burning Court'), enumerable: true },
  2: { get: () => t('gate.phase.champion', "Dagon's Champion"), enumerable: true },
  length: { value: 3 },
}));

// ── the attacks ────────────────────────────────────────────────────────
// `shape` is what the ground shows and what a struck player's machine tests its own feet against:
//   cone - from the boss, `r` long, `arc` degrees wide, about his facing
//   disc - `r` around a point (his own feet, or each target's)
//   lane - from where he stood toward his target, `w` wide, `len` long; he runs it over `active`
//   ring - between `r0` and `r1` around him - safe at his feet (or far across the floor from him)
//   all  - the whole court
//   spokes - WBX5: `n` lanes from his feet, `width` wide and `len` long, the first along his facing
// `pct` is the share of the STRUCK player's own maximum health it takes (resolved on their machine - co-op's law) and
// `base` the points it takes on top (WBX4, below), `el` its element (fire honours the game's own saving throw), `aim`
// where it is laid ('point': WBX5, one spot - `tg[0]`), `phase` the first it may come in, `range` how near the target
// must be (metres, past his body) before it is begun, `minGap` how far at least, `w` its weight in the choice. `windup`
// is from the word to the landing, `active` the landing's own span (the charge's run), `recover` his stillness after it.
// `pool` (WBX5): the burning ground its landing leaves (POOLS).
//
// WBX4 (2026-09-26, Swololo on Discord: "boss damage is way too low. people who were dying were under 150 health and got
// hit by mechanic twice, should be hp % based maybe + base damage"): EVERY SHARE RAISED AND A BASE BESIDE IT. A blow was
// a share of the struck player's own health alone, and the health came back as fast as he took it (the court now keeps
// no regeneration - WBX6, systems/courtRules.js). Now each attack takes a larger share and `base` points more, so two of
// his landings leave anyone low and a third ends them - still his words at every level, the base a little heavier on a
// body with less to lose.
/** WBX5: BURNING GROUND - the fire a landing leaves on the floor (Hellfire's under each of its marks, the Meteor's where
 *  it fell): its radius, how long it burns, and what each POOL_TICK_MS of standing in it takes (a share and a base, fire -
 *  the saving throw answers it). Resolved on the standing player's machine, as every strike is; the relay never learns
 *  of it, because every screen that saw the landing knows where it burns. */
export const POOL_TICK_MS = 1000;
/** WB9d (2026-09-30, Mac: "ensure his ground affects actually cause damage and the player recieves proper feedback"):
 *  the ground bites harder - half again what WBX5 set (a second in it was 5% and 2 points, easy to stand through). */
export const POOLS = Object.freeze({
  hellfire: Object.freeze({ r: 3, ms: 6000, pct: 0.08, base: 3 }),
  meteor: Object.freeze({ r: 5, ms: 9000, pct: 0.1, base: 4 }),
});
/** WB14a: THE CHAINS' HOLD - a chained fighter past CHAIN_HOLD_M of his centre as it lands breaks it; one inside it is
 *  reeled to CHAIN_PULL_TO_M of him (CHAIN_PULL_MAX_M at most - the struck screen's own pull, the motor's blow push), and
 *  a Ground Slam follows at his feet (the relay's reading of the pose, POSE_SLACK of slack). */
export const CHAIN_HOLD_M = 16;
export const CHAIN_PULL_TO_M = 4;
export const CHAIN_PULL_MAX_M = 12;
/** WB14a: THE BURNING GAZE - whoever's view holds him within GAZE_HALF_DEG of its heading and GAZE_RANGE_M of him as it
 *  lands is struck, and blinded GAZE_BLIND_MS. */
export const GAZE_HALF_DEG = 50;
export const GAZE_RANGE_M = 60;
export const GAZE_BLIND_MS = 2000;
//
// WB9e (2026-09-30, Mac: "Increase boss damage, further improve his telegraphs"): EVERY SHARE AND BASE RAISED AGAIN, by
// about a third over WBX4's - two of his heavy landings now end anyone who has not healed between them, and the Meteor
// or the Nova alone takes most of a body. Still his words at every level; still every one escaped by moving (the pins
// hold it under every set of marks), none of them faster.
export const ATTACKS = Object.freeze({
  cleave: Object.freeze({ id: 0, key: 'cleave', name: 'Cleave', windup: 1400, active: 200, recover: 900, shape: 'cone', r: 9, arc: 110, pct: 0.45, base: 12, el: null, aim: 'target', phase: 1, range: 7, w: 3, minGap: 0 }),   // AUDIT WBX R3: range 7 - a fighter at the court's edge stood 6.2 m past his body, out of the cleave's 6 and inside the charge's 8, and he struck nothing all phase
  slam: Object.freeze({ id: 1, key: 'slam', name: 'Ground Slam', windup: 1600, active: 200, recover: 1700, shape: 'disc', r: 7, pct: 0.52, base: 14, el: null, aim: 'self', phase: 1, range: 4, w: 2, minGap: 0 }),
  charge: Object.freeze({ id: 2, key: 'charge', name: 'Charge', windup: 1200, active: 900, recover: 1200, shape: 'lane', w: 2, width: 3.5, len: 22, pct: 0.40, base: 12, el: null, aim: 'target', phase: 1, range: 40, minGap: 8 }),
  hellfire: Object.freeze({ id: 3, key: 'hellfire', name: 'Hellfire', windup: 2000, active: 300, recover: 900, shape: 'disc', r: 3.5, max: 5, pct: 0.40, base: 9, el: 'fire', aim: 'players', phase: 2, range: 40, w: 2, minGap: 0, pool: POOLS.hellfire }),
  // WB13a (2026-10-01, Mac: "hone in telegraphs"): its ring to 16 m - it ran to 30 on a floor of 24, so with him at the
  // heart (every phase turn puts him there) 26% of the floor in phase two and 47% in phase three could not get out
  nova: Object.freeze({ id: 4, key: 'nova', name: 'Flame Nova', windup: 2200, active: 300, recover: 1900, shape: 'ring', r0: 4, r1: 16, pct: 0.58, base: 14, el: 'fire', aim: 'self', phase: 2, range: 40, w: 1, minGap: 0 }),
  wrath: Object.freeze({ id: 5, key: 'wrath', name: "Dagon's Wrath", windup: 6000, active: 500, recover: 0, shape: 'all', pct: 9.99, base: 0, el: 'fire', aim: 'self', phase: 99, range: 999, w: 0, minGap: 0 }),
  // WBX5: the Burning Court's reach - he leaps at whoever stands far off, and lands on them (and at every phase's turn,
  // into the court's heart); and a meteor falls where a fighter stands and leaves the ground burning
  leap: Object.freeze({ id: 6, key: 'leap', name: 'Crushing Leap', windup: 1500, active: 300, recover: 1500, shape: 'disc', r: 6, pct: 0.45, base: 12, el: null, aim: 'point', phase: 2, range: 40, w: 2, minGap: 10 }),
  meteor: Object.freeze({ id: 7, key: 'meteor', name: 'Meteor of Oblivion', windup: 2800, active: 300, recover: 700, shape: 'disc', r: 6.5, pct: 0.64, base: 16, el: 'fire', aim: 'point', phase: 2, range: 40, w: 1, minGap: 0, pool: POOLS.meteor }),
  // WBX5: Dagon's Champion's own - four lanes of fire from his feet; at the turn into his phase, the four between them
  // follow at once (PHASE_TURN)
  spokes: Object.freeze({ id: 8, key: 'spokes', name: 'Spokes of Dagon', windup: 1800, active: 200, recover: 500, shape: 'spokes', n: 4, width: 3.5, len: 30, pct: 0.52, base: 14, el: 'fire', aim: 'self', phase: 3, range: 40, w: 2, minGap: 0 }),
  // WB9b: THE BOUND ACROSS THE FIRE - at a phase's turn he leaps from the court he stands in to the next one's heart
  // (never chosen: PHASE_TURN's), a long flight (CROSS_AIR_MS) and a landing that strikes whoever ran ahead of him
  cross: Object.freeze({ id: 9, key: 'cross', name: 'Bound Across the Fire', windup: 2400, active: 300, recover: 600, shape: 'disc', r: 7, pct: 0.45, base: 12, el: null, aim: 'point', phase: 99, range: 999, w: 0, minGap: 0 }),
  // WB9c: DAGON'S RECKONING - Dagon's Champion's wipe: at the court's heart he calls Dagon over a long wind-up while
  // crystals of Oblivion grow across the floor (RECKON_*); break every one and the Reckoning breaks and stuns him (STUN_MS);
  // leave one standing and it lands on the whole arena - his fire answered by nothing (Dagon's, as the Wrath's)
  reckon: Object.freeze({ id: 10, key: 'reckon', name: "Dagon's Reckoning", windup: 22000, active: 600, recover: 1800, shape: 'all', pct: 9.99, base: 0, el: 'fire', aim: 'self', phase: 99, range: 999, w: 0, minGap: 0 }),
  // WB14a (2026-10-19, Mac: "More diabolical boss movesets"; bible/11-Multiplayer/Breach-Portents.md section 3): THE
  // WARDEN'S NEW ARSENAL - six more he chooses (each name read through the text core where it is read - L10N4), each waiting a cooldown of its own from its last use (`cd`, ms) and, where
  // it asks a court of more than one, `nMin` living challengers in it. None of the eleven before has either. `relay: false`
  // - a blow the relay cannot judge from the poses it holds (net/bossRef.js judgeGate): the struck screen's alone.
  // CHAINS OF THE WARDEN: a burning chain from him to one fighter near him, following them; past CHAIN_HOLD_M as it lands
  // it breaks, inside it they are struck and reeled to his feet - and a Ground Slam follows
  chains: Object.freeze({ id: 11, key: 'chains', get name() { return t('gate.attack.chains', 'Chains of the Warden'); }, windup: 3000, active: 150, recover: 1000, shape: 'tether', r: CHAIN_HOLD_M, pct: 0.15, base: 4, el: null, aim: 'target', phase: 1, range: 14, w: 1, minGap: 0, cd: 22_000, relay: false }),
  // DAGON'S BRAND: a ring under one to three fighters (`max`), following each; at its landing it bursts on everyone ELSE
  // within its reach of a branded one, and the branded take `selfPct` and `selfBase` - the branded run clear of the rest
  brand: Object.freeze({ id: 12, key: 'brand', get name() { return t('gate.attack.brand', 'Dagon\'s Brand'); }, windup: 5000, active: 200, recover: 900, shape: 'brand', r: 5, max: 3, pct: 0.40, base: 10, selfPct: 0.15, selfBase: 4, el: 'fire', aim: 'players', phase: 2, range: 40, w: 1, minGap: 0, cd: 28_000, nMin: 2 }),
  // SHARED TORMENT: a gold ring under one fighter, following them - its blow shared among everyone inside it as it lands
  torment: Object.freeze({ id: 13, key: 'torment', get name() { return t('gate.attack.torment', 'Shared Torment'); }, windup: 5000, active: 200, recover: 900, shape: 'torment', r: 4, pct: 0.80, base: 20, el: 'fire', aim: 'players', phase: 2, range: 40, w: 1, minGap: 0, cd: 28_000, nMin: 3 }),   // AUDIT WB14 (PLAY-3): three to share it - between two it was half a fighter's health each, unanswerable, and a duo died most
  // THE SCYTHING WHEEL: `n` blades from his feet, `len` long and `width` wide, turning about him `spin` radians a second over
  // its whole span (`active`), striking whoever a blade passes over - once
  wheel: Object.freeze({ id: 14, key: 'wheel', get name() { return t('gate.attack.wheel', 'Scything Wheel'); }, windup: 2200, active: 6000, recover: 900, shape: 'wheel', n: 2, width: 3.5, len: 16, spin: 0.36, pct: 0.40, base: 12, el: null, aim: 'self', phase: 3, range: 40, w: 1, minGap: 0, cd: 30_000 }),
  // THE BURNING GAZE: no ground - whoever's view holds him as it lands (GAZE_*) is struck and blinded: the one blow a step
  // does not answer, answered by turning away
  gaze: Object.freeze({ id: 15, key: 'gaze', get name() { return t('gate.attack.gaze', 'The Burning Gaze'); }, windup: 3000, active: 200, recover: 900, shape: 'gaze', r: GAZE_RANGE_M, arc: 2 * GAZE_HALF_DEG, pct: 0.35, base: 10, el: null, aim: 'self', phase: 3, range: 40, w: 1, minGap: 0, cd: 35_000, relay: false }),
  // THE UNMAKING: every other one of `n` wedges about his court's heart (`tg[0]`), the first centred on his facing, out to
  // `r`; then - a recovery and a breath later - the other half (a second cast turned a wedge on, the Spokes' own trick)
  unmake: Object.freeze({ id: 16, key: 'unmake', get name() { return t('gate.attack.unmake', 'The Unmaking'); }, windup: 3000, active: 300, recover: 1000, shape: 'wedges', n: 8, r: COURT_R + 1, pct: 0.45, base: 12, el: null, aim: 'point', phase: 3, range: 40, w: 1, minGap: 0, cd: 45_000 }),
  // WB14d (bible/11-Multiplayer/Breach-Portents.md section 5): THE SUNDERING - on a Sundering night, at the second phase's
  // turn, at his court's heart he tears in two (SUNDER_TURN; never chosen); and THE REJOINING - the halves met again at the
  // first court's heart, where he stands whole for his last stand. Each a disc about his feet, judged as any plain blow.
  sunder: Object.freeze({ id: 17, key: 'sunder', get name() { return t('gate.attack.sunder', 'The Sundering'); }, windup: 2600, active: 300, recover: 600, shape: 'disc', r: 8, pct: 0.45, base: 12, el: null, aim: 'self', phase: 99, range: 999, w: 0, minGap: 0 }),
  rejoin: Object.freeze({ id: 18, key: 'rejoin', get name() { return t('gate.attack.rejoin', 'The Rejoining'); }, windup: 3200, active: 300, recover: 800, shape: 'disc', r: 9, pct: 0.5, base: 14, el: null, aim: 'self', phase: 99, range: 999, w: 0, minGap: 0 }),
});
/** The attacks by their wire id. */
export const ATTACK_BY_ID = Object.freeze(Object.values(ATTACKS).sort((a, b) => a.id - b.id));
/** The ones he chooses among (the wrath is the clock's, not his; WB9b/c: the bound and the Reckoning are his turns'). */
const CHOSEN = Object.freeze([ATTACKS.cleave, ATTACKS.slam, ATTACKS.charge, ATTACKS.hellfire, ATTACKS.nova, ATTACKS.leap, ATTACKS.meteor, ATTACKS.spokes,
  ATTACKS.chains, ATTACKS.brand, ATTACKS.torment, ATTACKS.wheel, ATTACKS.gaze, ATTACKS.unmake]);   // WB14a: and the new six
/** WB14a: the attacks only a fighter's own screen can judge (`relay: false`) - the relay counts none of them. */
export const screenJudged = (A) => !!A && A.relay === false;
/** WB9c: the attacks no ward, no stun and no phase shortens - the clock's Wrath and Dagon's Reckoning. */
export const isDagons = (A) => A === ATTACKS.wrath || A === ATTACKS.reckon;
/**
 * WBX5: THE TURN OF A PHASE, as a sequence - he leaps into the court's heart (the Crushing Leap at its centre, while the
 * ward stands) and there casts the new phase's signature: the Flame Nova as the ward breaks, the Spokes of Dagon and at
 * once the four between them as he becomes Dagon's Champion. Each entry is an attack and, for the spokes, how far its
 * lanes are turned from the one before.
 */
export const PHASE_TURN = Object.freeze({
  // WB9b: the turn now CROSSES - he bounds from the court he stands in to the next one's heart, and under his ward waits
  // there for a challenger to come over the walkway the bound laid (`wait`), then casts the phase's signature
  2: Object.freeze([Object.freeze({ a: 'cross', court: 1 }), Object.freeze({ wait: 'arrive' }), Object.freeze({ a: 'nova' })]),
  3: Object.freeze([Object.freeze({ a: 'cross', court: 2 }), Object.freeze({ wait: 'arrive' }), Object.freeze({ a: 'spokes' }), Object.freeze({ a: 'spokes', turn: Math.PI / 4 })]),
});
/** WB9b: THE BOUND'S FLIGHT - he is in the air this long before it lands (a long arc over the fire), and the ward holds
 *  from the phase's turn until a challenger stands in his new court (the turn's `wait`) - or this long at most, when
 *  nobody comes. Once one does, it holds his profile's ward (P.shieldMs) more while the signature is cast. */
export const CROSS_AIR_MS = 2000;
export const CROSS_WAIT_MAX_MS = 30_000;
/** The ward the turn raises: through the bound, the walkway's laying and the whole wait at most - the wait's end (a
 *  challenger in the court) sets it to his profile's ward from then. */
export const CROSS_WARD_MAX_MS = 45_000;

// ── WB14d: THE SUNDERING (bible/11-Multiplayer/Breach-Portents.md section 5) ─────────────────────────────────────────
// (2026-10-19, Mac: "the boss splitting and players having to split and navigate to beat both sides and then merging at the
// end for its final stand (chance based encounter modifer)".) On a Sundering night the second phase's turn is no bound: he
// leaps to his court's heart and tears in two - RUHN'S BLADE (his body: `f` itself) and RUHN'S FLAME (his aspect's fire made
// flesh: `f.sd.fl`, a body of its own stepped by the same beat through a view of the fight - flameView). With
// SUNDER_SPLIT_MIN living challengers in the room the Blade bounds to the second court and the Flame to the third over the
// Rift Way; with fewer both bound to the second and fight there side by side. What he has left above SUNDER_LAST is their
// two pools (each a fraction of his whole, so a share in or out moves them with him); a half whose pool is spent KNEELS
// (its stun - no step, no blow, no blow taken) SUNDER_PAIR_MS, and rises with SUNDER_RISE of its pool unless the other is
// brought down first - then they REJOIN at the first court's heart and he stands whole at SUNDER_LAST for his last phase.
// AUDIT WB14 (PLAY-1): it rises LEVEL WITH THE OTHER - SUNDER_RISE of its pool at most, the other half's at least
// (SUNDER_RISE_MIN of a pool under it): risen with more than the other side could deal in the window, a court whose sides
// struck out of step knelt and rose for ever (at even rates, offsets of 24-28 s never rejoined).
// A standing half with nobody before it SUNDER_LONE_MS mends SUNDER_MEND of its pool a second (the split layout alone).
export const SUNDER_SPLIT_MIN = 4;
export const SUNDER_LAST = 0.26;
export const SUNDER_PAIR_MS = 20_000;
export const SUNDER_RISE = 0.3;
export const SUNDER_RISE_MIN = 0.05;
export const SUNDER_LONE_MS = 10_000;
export const SUNDER_MEND = 0.01;
/** The halves by number (the `hit` word's `b`, and every word of a half's): the Blade, the Flame. */
export const HALF = Object.freeze({ blade: 0, flame: 1 });
/** Each half's body, a share of his size. */
export const SUNDER_SIZE = Object.freeze([0.85, 0.75]);
/** Each half's arsenal - the Blade his steel and his reach, the Flame his fire. */
export const SUNDER_KITS = Object.freeze([Object.freeze(['cleave', 'slam', 'charge', 'leap', 'chains']), Object.freeze(['hellfire', 'meteor', 'nova', 'brand'])]);
/** Where the halves land beside one another in a court they share (the together layout, and the Rejoining's meeting):
 *  this far either side of its heart, east-west. */
export const SUNDER_SIDE_M = 5;
/** The turn on a Sundering night: the leap to the heart, then the Sundering itself (its end splits him - sunder). */
export const SUNDER_TURN = Object.freeze([Object.freeze({ a: 'leap', centre: true }), Object.freeze({ a: 'sunder' })]);
/** Is this fight's second phase a Sundering's (its night's portent)? */
export const sunders = (f) => hasPortent(f?.pt, 'sunder');
/** The turn a phase crossed begins (PHASE_TURN's, or the Sundering's). */
const turnOf = (f) => (f.phase === 2 && sunders(f) ? SUNDER_TURN : PHASE_TURN[f.phase]);

// ── WB9c: DAGON'S RECKONING AND THE CRYSTALS ────────────────────────────
/** When the first Reckoning comes after Dagon's Champion's turn is done, and each after the last one ended (broken or
 *  landed) - ms. */
export const RECKON_FIRST_MS = 18_000;
export const RECKON_EVERY_MS = 60_000;
/** THE CRYSTALS OF OBLIVION the Reckoning grows: how many (2 and one for every two living challengers in the court, 3
 *  to 8), their body (radius, height - a blow's reach is measured to it, as to his), where they rise (a ring about the
 *  court's heart, `RECKON_RING[0]` clear of him to `[1]` short of the rim) and how far apart at least. */
export const RECKON_CRYSTALS = Object.freeze([3, 8]);
export const CRYSTAL_R = 1.3;
export const CRYSTAL_H = 4.4;
export const RECKON_RING = Object.freeze([6, COURT_R - 3]);
export const CRYSTAL_GAP_M = 7;
/** How many crystals for `n` living challengers in the court. */
export const crystalCountFor = (n) => Math.max(RECKON_CRYSTALS[0], Math.min(RECKON_CRYSTALS[1], 2 + Math.ceil(Math.max(0, n) / 2)));
/** Each crystal's health: RECKON_TEAM_S seconds of the living challengers' reference damage between them all, shared
 *  across the crystals - so a court of any size breaks them in about half the wind-up if it splits up, and a court that
 *  stands together round one does not. At least RECKON_CRYSTAL_MIN. */
export const RECKON_TEAM_S = 8;
export const RECKON_CRYSTAL_MIN = 20;
export const crystalHpFor = (lvs, n) => Math.max(RECKON_CRYSTAL_MIN, Math.round((RECKON_TEAM_S * lvs.reduce((s, lv) => s + dpsRef(lv), 0)) / Math.max(1, n)));
/** THE STUN a broken Reckoning leaves him in: this long on his knees - no blow of his, no step - and every blow on him
 *  lands STUN_HIT_X heavier (before the caps: the bucket still decides what lands). */
export const STUN_MS = 8000;
export const STUN_HIT_X = 1.5;
/** WBX5: the pause between two attacks of one turn (a sequence breathes less than a choice does). */
export const TURN_BREATH_MS = 150;
/** The share of aimed attacks at the player who dealt the most lately; the rest at a random living one. */
export const THREAT_PICK = 0.6;
/** How fast threat forgets, a share a second (a player who stopped hitting stops being the target). */
export const THREAT_DECAY = 0.1;
/** Who earns a receipt (bible section 6): dealt this share of the health their own claim brought, or stood alive in
 *  the court this share of the fight. */
export const RECEIPT_SHARE = 0.02;
export const STOOD_SHARE = 0.5;
/** AUDIT WBX R1 (2026-09-26, Mac: "Do a comprehensive audit on everything so far"): A SHARE LEAVES WITH ITS FIGHTER. The
 *  health an account brought stayed in him after it left - twenty throwaway accounts that said `in` and went made the
 *  Warden unkillable before the Wrath for everyone who stayed. A fighter absent from the court (no socket, no pose)
 *  this long takes its share out of his health at the fraction he stands at, and brings it back at the fraction he
 *  stands at when it returns; its seat, its blows and its claim to a receipt are kept either way. */
export const ABSENT_RETIRE_MS = 30_000;
/** AUDIT WBX R2: what keeps a seat in a full court - a blow worth RECEIPT_SHARE of its share, or this long stood. One
 *  beat stood, or one blow of nothing, held a seat for the day; 256 throwaway accounts held the court. */
export const SEAT_KEEP_MS = 30_000;
/** A REAL PART IN THE FIGHT (AUDIT WBX R2's bar): a blow worth RECEIPT_SHARE of the fighter's share, or SEAT_KEEP_MS
 *  stood alive in the court. It keeps a seat in a full court, and (AUDIT PRE-MERGE 0929 W1-1) it is what a fall must
 *  have behind it to feed a Soul-Hungry Warden. */
export const hasPart = (p) => p.dealt >= RECEIPT_SHARE * p.share || p.stoodMs >= SEAT_KEEP_MS;
/** COURT-WATCH (bible/11-Multiplayer/World-Bosses.md section 24): a full court's watcher asks it for a seat again this often
 *  (scenes/gate/gateCourt.js askAgain). A seat frees only as freeSeat frees one - a fighter gone with no real part in the
 *  fight (hasPart): one who fought keeps its seat, and its claim, for the whole fight (AUDIT PLAN-1000 G2). Here, beside the
 *  seat's law, because the relay holds a socket's asks to it (AUDIT PLAN-1000 G7). */
export const COURT_WATCH_ASK_MS = 15_000;

// ── WB8b: the Warden's marks, as law ────────────────────────────────────
/** WB8b: SCARRED GROUND - under the Scarring trial his Ground Slam leaves it at his feet and his Crushing Leap where it
 *  lands (POOLS' shape: a radius, a span, a share and a base a POOL_TICK_MS), of his aspect's element as all his ground. */
export const SCAR_POOLS = Object.freeze({
  slam: Object.freeze({ r: 3, ms: 6000, pct: 0.08, base: 3 }),   // WB9d: the ground's bite, raised with POOLS'
  leap: Object.freeze({ r: 3.5, ms: 6000, pct: 0.08, base: 3 }),
});
/** An attack as the profile reads it - any of ATTACKS, each shape's own fields optional.
 * @typedef {{id: number, key: string, name: string, windup: number, active: number, recover: number, shape: string, pct: number,
 *   base: number, el: string|null, aim: string, phase: number, range: number, w: number, minGap: number, r?: number, arc?: number,
 *   width?: number, len?: number, n?: number, r0?: number, r1?: number, max?: number, pool?: {r: number, ms: number, pct: number, base: number},
 *   cd?: number, nMin?: number, relay?: boolean, selfPct?: number, selfBase?: number, spin?: number}} GateAttack   (WB14a: the new arsenal's own)
 */
/** WB8b: Dagon's Favoured - the phases the Burning Court's arsenal comes in early. */
export const FAVOURED_PHASE = Object.freeze({ hellfire: 1, meteor: 1, spokes: 2, brand: 1, torment: 1 });   // WB14a: the fire's own questions of a court, a phase early

/**
 * WB8b (2026-09-28, Mac: "give him unique and different modifers on every 2 hour spawn"): A FIGHT'S PROFILE - the
 * numbers the brain and every screen read in place of the constants above, made from the fight's marks (`md`,
 * net/gate/gateMods.js: the day's draw, net/gate/gateLaw.js gateModsOf, kept on the fight and said in its state - one law, both
 * ends). The Warden unmarked - no `md`, a fight checkpointed before WB8 - is BASE_PROFILE, the constants exactly. The
 * attacks' own tables never change (an attack is its object: the brain and the screens test identity); what a mark
 * moves is each attack's line here (`atk[key]`: its reach, its phase, its element, its name, the ground it leaves, its
 * share and base) and the body's. Pure; ONE PROFILE A SET OF MARKS, made once and kept - keyed by the set as the tables
 * order it (its aspect, then its trials in GATE_TRIALS' order), so the order the words came in makes no second one, and
 * there are 185 sets at most (four aspects with none, one or two of nine trials - WB11a's ninth - and none at all).
 * @param {unknown} md
 */
export function fightProfile(md) {
  const ok = validGateMods(md) ?? null;
  const read = ok ? readGateMods(ok) : null;
  const key = read ? [read.aspect.id, ...GATE_TRIALS.filter((t) => read.trials.includes(t)).map((t) => t.id)].join(',') : '';
  let P = _profiles.get(key);
  if (P) return P;
  const aspect = (read ?? readGateMods(null)).aspect, trials = read ? GATE_TRIALS.filter((t) => read.trials.includes(t)) : [];
  const T = (id) => trials.find((t) => t.id === id) ?? null;
  const colossal = T('colossal'), unyielding = T('unyielding'), vengeful = T('vengeful'), scarring = T('scarring'), grudge = T('grudge'), hungry = T('soulhungry');
  const size = colossal?.size ?? 1, dmgX = vengeful?.dmg ?? 1, groundMsX = scarring?.groundMs ?? 1;
  const ground = (G) => (G ? Object.freeze({ r: G.r, ms: Math.round(G.ms * groundMsX), pct: G.pct * dmgX, base: G.base * dmgX }) : null);
  const atk = {};
  for (const A of /** @type {ReadonlyArray<GateAttack>} */ (ATTACK_BY_ID)) {
    const el = A.el === 'fire' && !isDagons(A) ? aspect.el : A.el;   // his fire is his aspect's; Dagon's Wrath and Reckoning are Dagon's
    atk[A.key] = Object.freeze({
      // AUDIT PRE-MERGE 0929 W1-2: a cone reaches from his body, as far past it as it ever did - its range is measured
      // past his body (attacksFor), and a Colossal Warden chose the Cleave at fighters up to 9.25 m from his centre with
      // a cone of 9: cleaving air all phase one at a fighter standing just outside it, never walking in (R3's law -
      // "its cone of 9 always reached" - for every body he wears)
      r: A === ATTACKS.slam && colossal ? colossal.slamR : A.shape === 'cone' ? A.r + BOSS_R * (size - 1) : A.r,
      phase: T('favoured') && FAVOURED_PHASE[A.key] != null ? FAVOURED_PHASE[A.key] : A.phase,
      el, get name() { return aspect.names[A.key] ?? A.name; },   // AUDIT WB14 (TEXT-8): read at each word - the new arsenal's in the player's language now, never the one the profile was made in
      pool: ground(A.pool ?? (scarring ? SCAR_POOLS[A.key] : null)),
      pct: A.pct * dmgX, base: (A.base ?? 0) * dmgX,
    });
  }
  P = Object.freeze({
    md: key ? Object.freeze(key.split(',')) : null, aspect, trials, el: aspect.el,
    size, bossR: BOSS_R * size, bossH: BOSS_H * size, hpX: colossal?.hp ?? 1,
    shieldMs: unyielding?.shieldMs ?? SHIELD_MS, hitX: unyielding?.hit ?? 1, dmgX,
    threatPick: grudge?.threatPick ?? THREAT_PICK, threatDecay: grudge?.threatDecay ?? THREAT_DECAY,
    feed: hungry?.heal ?? 0, feedsMax: hungry?.feeds ?? 0, echo: !!T('echoing'),
    legion: !!T('legion')?.legion,   // WB11b: his host fights beside him (HOST_KINDS) - nothing of it runs without the trial
    atk: Object.freeze(atk),
    trialsLine: trials.map((t) => t.name).join(' - '),   // AUDIT PRE-MERGE 0929 W2-2: said by the bar every frame, joined once
  });
  _profiles.set(key, P);
  return P;
}
/** The profiles made (the screens ask every frame) - never more than the sets there are. */
const _profiles = new Map();
/** The Warden unmarked: the constants exactly. */
export const BASE_PROFILE = fightProfile(null);
/** A fight's profile (its own marks), or a state's - the brain's fight and the court's state alike carry `md`. */
export const profileOf = (f) => {
  // AUDIT PRE-MERGE 0929 W2-2: FOUND ONCE A MARKS ARRAY. The profile was cached and finding it was not - every call
  // copied the marks (validGateMods), read them (readGateMods) and joined a key, ~1.9 KB a call, and the court asks
  // every frame (the bar, the glow, the telegraphs, target() on every swing and missile): a marked court's frame made
  // three and a half times the garbage of an unmarked one. The fight's `md` and the fold's are one array for as long
  // as they stand (the relay's is made at newFight, the screen's once an `st`), so the profile is kept by that array.
  const md = f?.md;
  let P = md == null || typeof md !== 'object' ? fightProfile(md) : _profileByMd.get(md);
  if (!P) { P = fightProfile(md); _profileByMd.set(md, P); }
  // WB14d: a sundered fight's body is its half's - the Flame's for its own beat and its own state (`half` 1), else the Blade's
  return f?.half === HALF.flame ? halfProfile(P, HALF.flame) : f?.sd ? halfProfile(P, HALF.blade) : P;
};
/** WB14d: THE FLAME'S PROFILE in a sundered fight - its body's (SUNDER_SIZE), the rest his marks'. */
export const flameProfileOf = (f) => halfProfile(profileOf(f?.sd ? { md: f.md } : f), HALF.flame);
/** WB14d: A HALF'S PROFILE - his marks' numbers with its body's size (SUNDER_SIZE of his: the Blade's reach measured from a
 *  smaller body, the Flame's smaller still); each made once a profile. */
export function halfProfile(P, b) {
  let two = _halves.get(P);
  if (!two) {
    two = SUNDER_SIZE.map((k, i) => Object.freeze({ ...P, size: P.size * k, bossR: P.bossR * k, bossH: P.bossH * k, half: i }));
    _halves.set(P, two);
  }
  return two[b] ?? two[HALF.blade];
}
const _halves = new WeakMap();
/** The profile each marks array was read as (arrays drop out with the states that hold them). */
const _profileByMd = new WeakMap();
/** What an attack is under a profile - its line (reach, phase, element, name, ground, share, base). */
export const attackUnder = (A, P = BASE_PROFILE) => P.atk[A.key];

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** A point kept inside a disc of radius `r` about a court's centre (the first court's, and the boss's own ring, by
 *  default - WB9b: `c` the court he fights in). */
export function keepInCourt(x, z, r = BOSS_REACH_R, c = COURTS[0]) {
  const dx = x - c[0], dz = z - c[1], d = Math.hypot(dx, dz);
  return d <= r ? [x, z] : [c[0] + (dx / d) * r, c[1] + (dz / d) * r];
}
/** WB9b: the centre of the court he fights in. */
const hisCourt = (f) => COURTS[Math.max(0, Math.min(COURTS.length - 1, f.court | 0))];

/**
 * A fresh fight: nobody in it, the boss at the court's centre facing the south door, no health until someone brings
 * some.
 * @param {number} day @param {number} now @param {number} wrathAt the gate's midnight (net/gate/gateLaw.js gateTimes)
 * @param {string} boss the boss's id (net/gate/gateLaw.js GATE_BOSSES)
 * @param {unknown} [md] WB8b: his marks (net/gate/gateLaw.js gateModsOf) - none, the Warden unmarked
 * @param {unknown} [pt] WB14b: the night's portents (net/gate/gateLaw.js gatePortentsOf) - none, a plain night
 * @param {number|null} [ti] WB14e: how long after his wake the night's Tithe-Imp rises (net/gate/gateLaw.js gateTitheOf) -
 *   none, a night without one
 */
export function newFight(day, now, wrathAt, boss, md = null, pt = null, ti = null) {
  const night = validGatePortents(pt) ? [...validGatePortents(pt)] : null;   // AUDIT WB14 (LAW-9): the portents as kept are the ones the fight is built on
  return {
    v: 1, day, boss, startedAt: now, wrathAt, phase: 1, shieldUntil: 0, hp: 0, max: 0,
    /** WB8b: the Warden's marks this fight is fought under (net/gate/gateLaw.js gateModsOf - the relay's draw at the fight's
     *  birth), or null for none; said in every state */
    md: validGateMods(md) ?? null,
    /** WB14b: the night's portents (net/gate/gateLaw.js gatePortentsOf - the relay's draw at the fight's birth), or null for
     *  none - its floor plan (nightPlan) and its waves, halves and captive; said in every state */
    pt: night,
    /** AUDIT PRE-MERGE 0929 W1-1: the feedings a Soul-Hungry Warden has had this fight (at most GATE_FEEDS_MAX) - a
     *  fight checkpointed before it counts from none */
    feeds: 0,
    pos: [0, 0], yaw: 0, move: null, atk: null, lastA: -1, runA: 0, freeAt: 0, nextAt: now + OPENING_MS, seq: 0,   // WB13f: how many times running the last was used, and when it ended
    target: null, targetAt: 0,
    /** WB9b: the court he fights in (COURTS), and the moment each crossing's word was said - walkway k is laid from xa[k]
     *  (walkFormed); `waitUntil` the longest his ward waits in a new court for a challenger */
    court: 0, xa: [], waitUntil: 0,
    /** WB9c: when the next Reckoning comes (0 none armed yet - armed as Dagon's Champion's turn ends in the last court;
     *  -2 while one is under way), the crystals of the one in flight ({i, c: [{x, z, h}], m} - its attack's number), and
     *  how long a broken one leaves him stunned */
    rk: 0, cx: null, stunUntil: 0, cxSentAt: 0, cxSent: '',
    /** WB11b: his host under the Legion-Lord trial (newHost - made at the fight's first beat under it), null in any other */
    lg: null,
    /** WB14c: the Vanguard on a night that holds it (newVanguard), null on any other; and when his opening began - the
     *  fight's birth, or the first fighter in his court after the Vanguard broke (null until then) */
    vg: hasPortent(night, 'vanguard') ? newVanguard() : null,
    openAt: hasPortent(night, 'vanguard') ? null : now,
    /** WB14e: how long after his wake the Tithe-Imp rises (null, none tonight), and its record once it has (`tt`) */
    ti: Number.isSafeInteger(ti) && ti >= 0 ? ti : null, tt: null,
    /** WB14f: the Captive on a night that holds him (newCaptive), null on any other */
    cp: hasPortent(night, 'captive') ? newCaptive() : null,
    /** WBX5: a phase's turn still to come - PHASE_TURN's entries after the one in flight - and the next of them, begun
     *  when the breath after the last is over */
    queue: [], pending: null,
    /** @type {Record<string, {name: string, lv: number, share: number, dealt: number, clipped: number, bucket: number, bucketAt: number, rate: number, rateAt: number, stoodMs: number, joinedAt: number, seenAt?: number, retired?: boolean, cxd?: number, hits?: number, best?: number, falls?: number, down?: boolean, hd?: number, bq?: number|null, bqAt?: number, bqWho?: string[], healed?: number, hb?: number, hbAt?: number}>} */
    players: {},
    /** AUDIT WBX R4: the time a living fighter stood in the court - what "stood half the fight" is half of */
    liveMs: 0,
    /** @type {Record<string, number>} sub -> decayed damage */
    threat: {},
    /** @type {{at: number, top: string[], n: number, dm?: ReturnType<typeof damageChart>}|null} */
    fell: null,
    /** @type {{at: number}|null} */
    wrath: null,
    lastHpAt: 0, lastHpSent: -1, lastStateAt: now, lastTickAt: now,
  };
}

/**
 * A player steps into the fight. A newcomer brings BOSS_TTK_S seconds of their reference damage as health - at the
 * boss's CURRENT fraction, so a late arrival does not heal him - and only while `admits` (the gate is open) and the
 * fight has room (AUDIT WB A1: a full fight frees an idle seat - freeSeat - over `present`, the accounts in the court).
 * A player already in keeps their FIRST claim: a second `in` cannot raise a cap. A fight that is over takes nobody new.
 * @param {Set<string>|null} [present]
 * @returns {boolean} whether they are in the fight
 */
/** AUDIT WBX2 M2: THE FRACTION HE STANDS AT - his health over the health his shares brought, or, while every share is
 *  out of him (each fighter away past ABSENT_RETIRE_MS or freed, max 0), the fraction he stood at as the last left
 *  (`idle`) - the first back stood him up whole. A return, or a newcomer, never heals him; a fresh fight, which nobody
 *  has brought any health to yet, stands whole. */
export const standsAt = (f) => (f.max > 0 ? f.hp / f.max : Number.isFinite(f.idle) ? f.idle : 1);
/** A share out of his health at the fraction he stands at - the last one out keeps that fraction (`idle`). */
function shareOut(f, share) {
  const frac = standsAt(f);
  f.max = Math.max(0, f.max - share);
  f.hp = f.max * frac;
  if (!(f.max > 0)) f.idle = frac;
}

export function joinFight(f, sub, name, lv, now, admits, present = null) {
  const known = f.players[sub];
  if (known) { if (typeof name === 'string' && name) known.name = name.slice(0, 24); if (!f.fell && !f.wrath) { known.seenAt = now; restoreShare(f, known); } return true; }
  if (f.fell || f.wrath || !admits) return false;
  if (Object.keys(f.players).length >= GATE_FIGHTERS_MAX && !freeSeat(f, present)) return false;
  const level = clampLv(lv);
  const share = BOSS_TTK_S * dpsRef(level) * profileOf(f).hpX * (f.vg ? VG_SHARE_X : 1);   // WB8b: Colossal - each share a quarter more; AUDIT WB14 (PLAY-4): a Vanguard night's less its Vanguard's
  const frac = standsAt(f);
  // AUDIT WB A8: a newcomer to a fight already bled comes with an EMPTY bucket - its share joins the health at the
  // fraction he stands at, and a full bucket on top of it let a string of late joiners each spend BUCKET_DEPTH_X
  // seconds of damage at once: a kill faster than any claim is meant to buy
  const fresh = frac >= 1;
  f.max += share;
  f.hp += share * frac;
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: level, share, dealt: 0, clipped: 0,
    bucket: fresh ? BUCKET_DEPTH_X * dpsRef(level) : 0, bucketAt: now, rate: GATE_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
    seenAt: now, retired: false,
    cxd: 0, hits: 0, best: 0, falls: 0, down: false,   // GATE-UX: the damage chart's detail (damageChart)
  };
  return true;
}

/** AUDIT WBX R1: a fighter's share out of his health (it has been gone ABSENT_RETIRE_MS), at the fraction he stands at. */
export function retireShare(f, p) {
  if (p.retired) return;
  shareOut(f, p.share);
  p.retired = true;
}
/** ...and back in (it has returned), at the fraction he stands at - a return never heals him. */
export function restoreShare(f, p) {
  if (!p.retired) return;
  const frac = standsAt(f);
  f.max += p.share;
  f.hp += p.share * frac;
  p.retired = false;
}

/**
 * AUDIT WB A1: THE COURT IS FULL OF ITS FIGHTERS, NOT OF EVERYONE WHO EVER CAME. A full fight frees the seat of one who
 * joined and left without a blow struck or a moment stood (`present` the accounts in the court now - none freed without
 * it): nothing earned is lost, and their share leaves the boss's health at the fraction he stands at, as it came.
 * Answers whether a seat was freed.
 * @param {ReturnType<typeof newFight>} f @param {Set<string>|null} present
 */
export function freeSeat(f, present) {
  if (!present) return false;
  for (const [sub, p] of Object.entries(f.players)) {
    if (present.has(sub) || hasPart(p)) continue;   // AUDIT WBX R2: a real part in the fight keeps a seat
    if (!p.retired) shareOut(f, p.share);
    delete f.players[sub];
    delete f.threat[sub];
    if (f.target === sub) f.target = null;
    return true;
  }
  return false;
}

/**
 * A blow on the boss from `sub`, standing at `pose` ({x, z} in the court's frame, or null), of kind `r`, claiming `d`.
 * Answers the damage ACCEPTED (0 for a refused blow). Refused: a stranger to the fight, a fight over, the boss
 * shielded, past the account's blow rate, a pose that says nothing, a melee blow from out of reach, anything from
 * off the court. Clipped (and counted): past the one-blow cap, past the bucket.
 */
export function applyHit(f, sub, d, r, pose, now, seq = null, o = {}) {
  const p = f.players[sub];
  if (!p || f.fell || f.wrath || !Number.isFinite(d) || !(d > 0)) return 0;
  if (now >= f.wrathAt) return 0;   // AUDIT WBX R6: midnight is the Wrath's, whether or not a beat has said so yet
  if (!(f.max > 0)) return 0;   // AUDIT WB14 (LAW-3): every share out - nothing to strike (a half's pool is a share of a whole of none)
  // WB14d: SUNDERED, a blow names the half it lands on (the `hit` word's `b` - the Blade's unless the Flame's), and each is
  // its own body: its ward, its court, its size, its pool; a half kneeling takes nothing
  const half = f.sd ? (o?.b === HALF.flame ? HALF.flame : HALF.blade) : null;
  const B = half === HALF.flame ? f.sd.fl : f, H = half === null ? null : half ? f.sd.fl : f.sd.bl;
  if (now < B.shieldUntil) return 0;
  if (H?.kn) return 0;
  // the blow rate: a token bucket, GATE_HIT_HZ_MAX a second, one second deep - spent whatever the blow turns out to be
  // (AUDIT WB11 W3: once a blow, however many bodies it meets - spendBlow, the one hand of every arm)
  if (!spendBlow(p, now, seq, 'b')) return 0;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return 0;
  if (!onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK, planOf(f))) return 0;   // nobody strikes the court from off it - WB9b: its floor as far as it is laid; WB14b: the night's plan's
  // AUDIT WB9 (brain F1): nor from outside the court he fights in - he chooses, aims at and waits for only those in it
  // (`here`), so a fighter on a walkway or in a court he has left struck him from where no blow of his could answer
  if (!inCourt(pose.x, pose.z, B.court, POSE_SLACK)) return 0;
  const P = half === HALF.flame ? flameProfileOf(f) : profileOf(f);
  const gap = dist(pose.x, pose.z, B.pos[0], B.pos[1]) - P.bossR;   // WB8b: his body's own size (Colossal's is larger)
  if (r === HIT_KINDS.Melee && gap > MELEE_REACH + POSE_SLACK) return 0;
  // the damage: WB8b's Unyielding lightens it, then it is capped a blow, then the bucket
  const ref = dpsRef(p.lv);
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const want = d * P.hitX * (!H && now < (f.stunUntil ?? 0) ? STUN_HIT_X : 1);   // WB9c: a stunned Warden takes it heavier - AUDIT WB14 (LAW-1): whole (a kneeling Blade's stun is his alone: the Flame takes no more for it)
  const got = Math.max(0, Math.min(want, HIT_CAP_X * ref, p.bucket, f.hp, H ? H.h * f.max : Infinity));   // WB14d: never past the half's pool
  p.bucket -= got;
  p.clipped += want - got;   // the caps' clipping - what his ward took off is his, not a cap's
  p.dealt += got;
  if (got > 0) { B.threat[sub] = (B.threat[sub] ?? 0) + got; p.hits = (p.hits ?? 0) + 1; p.best = Math.max(p.best ?? 0, got); }   // GATE-UX: the chart's blows and best; WB14d: each half's threat its own
  f.hp -= got;
  if (H) { H.h -= got / f.max; if (H.h <= 1e-9) kneel(f, half, now); }   // WB14d: the half's pool, and its kneel as it is spent
  if (f.hp <= 1e-6 && f.max > 0 && !f.sd) {   // AUDIT WB14 (LAW-3): sundered he never falls - his last phase is the Rejoining's
    settleAt(f, now);   // AUDIT WBX F3: where he fell, not where his last beat left him
    f.hp = 0;
    f.fell = { at: now, top: topDealers(f, 3), n: Object.keys(f.players).length, dm: damageChart(f) };   // GATE-UX: and every fighter's part, ranked
    f.move = null;
    f.atk = null;
    f.cx = null;   // AUDIT WB9 (brain F4): a kill mid-Reckoning spends its crystals - no beat after the fall clears them
    if (f.lg) f.lg.ads = [];   // WB11b: and his host goes with him (the fall's word says so - no word of its own)
  }
  return got;
}

/** AUDIT WBX F3: his place carried to `now` by the rule every beat carries it (the walk; the charge down its lane; the
 *  leap down where it lands) - the kill falls between beats, and the state a late joiner is told names where he fell. */
export function settleAt(f, now) {
  const A = f.atk ? ATTACK_BY_ID[f.atk.a] : null;
  if (A === ATTACKS.charge && now >= f.atk.at) {
    const k = Math.min(1, (now - f.atk.at) / A.active), end = f.atk.tg[0];
    if (end) f.pos = keepInCourt(f.atk.x + (end[0] - f.atk.x) * k, f.atk.z + (end[1] - f.atk.z) * k, BOSS_REACH_R, hisCourt(f));
  } else if (A === ATTACKS.leap || A === ATTACKS.cross) { const p = leapAt(f.atk, now); if (p) f.pos = p; }   // a leap lands where it was said to (begin kept it in the court)
  else if (!A && f.move) stepWalk(f, now);
}

/** WBX5: THE LEAP'S FLIGHT - he leaves the floor this long before it lands (world/gate/gateBoss.js draws the arc). WB9b: the
 *  bound across the fire flies CROSS_AIR_MS. */
export const LEAP_AIR_MS = 650;
/** How long a leap of either kind is in the air. */
export const airOf = (A) => (A === ATTACKS.cross ? CROSS_AIR_MS : LEAP_AIR_MS);
/** Where a leap carries him at `now`, or null while he still stands on the floor: from where it began to where it lands
 *  over its last LEAP_AIR_MS, and there after. The ONE law of it - the beat's, the kill's (`settleAt`) and every
 *  screen's (world/gate/gateBoss.js bossPlace). AUDIT WBX2 M5: the screens flew him while the relay held him at its start -
 *  a kill in the air stood him in two places, and a blow on him in the air was judged from where he had left. Pure. */
export function leapAt(atk, now) {
  const e = atk?.tg?.[0], A = ATTACK_BY_ID[atk?.a];
  if ((A !== ATTACKS.leap && A !== ATTACKS.cross) || !e) return null;   // WB9b: the bound across the fire flies the same law, longer
  const air = airOf(A);
  if (!(now >= atk.at - air)) return null;
  const k = Math.min(1, (now - (atk.at - air)) / air);
  return [atk.x + (e[0] - atk.x) * k, atk.z + (e[1] - atk.z) * k];
}

/** The names of the `k` who dealt the most, most first (ties by the earlier to join). */
export function topDealers(f, k) {
  return Object.values(f.players).filter((q) => q.dealt > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, k).map((q) => q.name);
}

/** GATE-UX (2026-10-01, Mac: "Develop a detailed damage chart after the boss kill, showing and ranking everyone's
 *  damage"): the most rows the chart the kill carries holds (net/wire.js GATE_CHART_MAX - pinned equal). A court of more
 *  fighters says its count (`fell.n`) and its first DAMAGE_CHART_MAX. */
export const DAMAGE_CHART_MAX = 32;
/**
 * GATE-UX: THE DAMAGE CHART, made at the kill - every fighter who had a part (a blow landed, or a moment stood alive in
 * the court), most damage first (ties by the earlier to join - topDealers' own order), each row whole numbers: `n` the
 * name, `l` the level claimed, `d` all they dealt (his health and the crystals', `dealt` - what the receipts and the
 * herald's names count), `x` the crystals' share of it, `h` the blows that landed on him, `b` the heaviest of them, `f`
 * how many times they fell in the court; WB11b: `a` his host's share of it, for one who struck it (none else). At most
 * DAMAGE_CHART_MAX rows. Pure.
 * @param {ReturnType<typeof newFight>} f
 */
export function damageChart(f) {
  return Object.values(f.players).filter((q) => q.dealt > 0 || q.stoodMs > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, DAMAGE_CHART_MAX)
    .map((q) => ({ n: q.name, l: q.lv, d: Math.round(q.dealt), x: Math.min(Math.round(q.dealt), Math.round(q.cxd ?? 0)), h: q.hits ?? 0, b: Math.round(q.best ?? 0), f: q.falls ?? 0,
      ...(q.hd > 0 ? { a: Math.min(Math.round(q.dealt), Math.round(q.hd)) } : {}),   // WB11b: his host's share of it, where they struck it
      ...(q.healed >= 1 ? { hl: Math.round(q.healed) } : {}) }));   // GATE-HEAL: what they healed, where they healed
}

// ═══ GATE-HEAL: HEALING ON THE ROUND-UP ════════════════════════════════════════════════════════════════════════════
//
// (2026-10-01, Mac: "Can we add a line on the damage round up showing the amount healed?" - each challenger's; "Like
// for healers" - allies only.) What a fighter's game says another's spell healed in it is credited to the CASTER, for the
// chart alone; a heal on oneself is no one's. Only the one healed knows what moved (ALLY-CAST's law: the receiver
// decides), so the receiver says it; what it says is believed within its own heal bucket, so no healer's figure can be
// made absurd. It buys nothing: no receipt, no share, no threat, no spoils. bible/11-Multiplayer/World-Bosses.md
// section 18.

/** A fighter's reference health at a level, for its heal bucket - generous (DFU's bars run lower). */
export const HEAL_REF_BASE = 40;
export const HEAL_REF_LV = 12;
export const healRef = (lv) => HEAL_REF_BASE + HEAL_REF_LV * Math.max(1, lv | 0);
/** The bucket a receiver's word is believed through: a whole reference refilled over HEAL_REFILL_S, HEAL_DEPTH_X of them
 *  deep - a full bar every few seconds at most, sustained. */
export const HEAL_REFILL_S = 3;
export const HEAL_DEPTH_X = 2;
/**
 * GATE-HEAL: `sub` WAS HEALED `n` POINTS BY `by` (ANOTHER fighter of this fight, the one whose spell it was - never
 * `sub` itself) - the receiver standing at `pose` (the court's frame, its own) on the laid floor while the fight lives.
 * Believed within the receiver's heal bucket and credited to the healer's `healed`; never a part in the fight. Answers
 * what was credited.
 * @param {any} f @param {string} sub @param {string} by @param {number} n @param {{x: number, z: number}|null} pose @param {number} now
 */
export function applyHeal(f, sub, by, n, pose, now) {
  const p = f.players[sub], q = f.players[by];
  if (!p || !q || sub === by || f.fell || f.wrath || now >= f.wrathAt || !Number.isFinite(n) || !(n > 0)) return 0;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK, planOf(f))) return 0;
  const ref = healRef(p.lv), depth = HEAL_DEPTH_X * ref;
  p.hb = Math.min(depth, (Number.isFinite(p.hb) ? p.hb : depth) + (Math.max(0, now - (Number.isFinite(p.hbAt) ? p.hbAt : now)) / 1000) * (ref / HEAL_REFILL_S));
  p.hbAt = now;
  const got = Math.max(0, Math.min(n, p.hb));
  p.hb -= got;
  q.healed = (q.healed ?? 0) + got;
  return got;
}

/** Did `sub` earn a receipt (bible section 6)? Only a fallen boss pays: dealt RECEIPT_SHARE of the health it brought, or
 *  stood alive in the court for STOOD_SHARE of the fight. */
export function earned(f, sub) {
  const p = f.players[sub];
  if (!p || !f.fell) return false;
  // AUDIT WBX R4: the fight is the time a living fighter stood in the court (`liveMs`, the beat's) - not the wall's since
  // the first `in`, which counted a court nobody stood in and cost a healer who stood the whole of the combat a receipt
  const fight = Math.max(1, Number.isFinite(f.liveMs) ? f.liveMs : f.fell.at - f.startedAt);
  return p.dealt >= RECEIPT_SHARE * p.share || p.stoodMs >= STOOD_SHARE * fight;
}
/** How `sub` earned it, for the receipt: 'dealt' first (it is the stronger claim), else 'stood'. */
export const earnedBy = (f, sub) => (f.players[sub]?.dealt >= RECEIPT_SHARE * (f.players[sub]?.share ?? Infinity) ? 'dealt' : 'stood');
/** WB14g (bible/11-Multiplayer/Breach-Portents.md section 11): THE PORTENTS A KILL'S RECEIPT SAYS (net/gate/gateReceipt.js `p`) -
 *  the night's, a bit each (net/gate/gateMods.js portentBits), the Captive's only where he went free; 0 a plain night. Pure. */
export const receiptPortents = (f) => portentBits((f?.pt ?? []).filter((id) => id !== 'captive' || f.cp?.f > 0));

/** The attack's wind-up in this phase (WB9c: Dagon's are never shortened; WB9b: nor the bound - its flight is fixed). */
export const windupOf = (atk, phase) => (phase >= 3 && atk.id !== ATTACKS.wrath.id && atk.id !== ATTACKS.reckon.id && atk.id !== ATTACKS.cross.id && atk.id !== ATTACKS.chains.id ? Math.round(atk.windup * PHASE3_WINDUP) : atk.windup);

/** Pick who he goes at: THREAT_PICK of the time (WB8b: his profile's - the Grudge-Bearer's is more) the living player
 *  with the most threat, else a random living one. */
export function pickTarget(f, bodies, rng) {
  const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
  if (!live.length) return null;
  if (rng() < profileOf(f).threatPick) {
    let best = null, t = 0;
    for (const b of live) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return live[Math.floor(rng() * live.length) % live.length];
}

/** WB13f (2026-10-01, Mac: "AAA grade polish"): no attack more than REPEAT_MAX times running - with the fighters spread,
 *  phase one was the Charge in 36 of 50 attacks, 28 of them back to back; past it he walks in instead. A walk-in of
 *  REPEAT_WALK_MS breaks the run: one who keeps away from him is charged again (in phase one the Charge alone reaches
 *  past 7 m - a cap with no end would leave a fighter at range untouched). */
export const REPEAT_MAX = 2;
export const REPEAT_WALK_MS = 6000;
/** The attacks this phase allows against a target `gap` metres past his body, with `near` living players inside his
 *  slam - the last one he used left out when anything else is open. WB8b: each attack's phase is its profile's (Dagon's
 *  Favoured brings the Burning Court's arsenal early). WB13f: and never a REPEAT_MAX+1th time running (`run` - how many
 *  times running the last was used): nothing, and he walks at his target. WB14a: an attack with a cooldown (`cd`) is
 *  open only with the fight's own word (`ctx`: `now`, when each was last used - `used`, by key - his wake, `woke`, and
 *  `n`, the living challengers in his court) - its cooldown passed since its last use (the first since his wake: he
 *  never opens on one), and `nMin` of them at least. AUDIT WB14 (LAW-6): `kit`, sundered, the half's own keys. */
export function attacksFor(phase, gap, near, lastA = -1, P = BASE_PROFILE, run = 1, ctx = null) {
  const out = CHOSEN.filter((a) => P.atk[a.key].phase <= phase && gap <= a.range && (a.minGap <= 0 || gap >= a.minGap) && !(a === ATTACKS.slam && near < 1)   // a body inside his (a negative gap) is still in reach
    && (!ctx?.kit || ctx.kit.includes(a.key))   // AUDIT WB14 (LAW-6): a half's own kit (`kit`), before the run's law below
    && !(a === ATTACKS.chains && gap + P.bossR >= CHAIN_HOLD_M)   // AUDIT WB14 (LAW-10): never at one the chain could not hold (Colossal's body is larger)
    && (!/** @type {GateAttack} */ (a).cd || cooled(a, ctx)));
  const fresh = out.filter((a) => a.id !== lastA);
  return fresh.length ? fresh : run >= REPEAT_MAX ? [] : out;
}

/** WB14a: is an attack with a cooldown open under the fight's word (attacksFor's `ctx`)? */
const cooled = (a, ctx) => !!ctx && Number.isFinite(ctx.now) && ctx.now - (ctx.used?.[a.key] ?? ctx.woke ?? -Infinity) >= a.cd && (ctx.n ?? 0) >= (a.nMin ?? 1);

/** One of `can` by weight. */
export function chooseAttack(can, rng) {
  const total = can.reduce((s, a) => s + a.w, 0);
  let x = rng() * total;
  for (const a of can) { x -= a.w; if (x < 0) return a; }
  return can[can.length - 1];
}

/**
 * ONE BEAT. `bodies` are the fight's players standing in the court now ({sub, x, z, dead}, the court's frame), `rng` a
 * [0,1) source. Answers the frames to send, in order, as plain objects the relay stamps and fans ({k, ...} - the
 * `gate` frame's kinds). Moves the state in place.
 */
export function stepBrain(f, now, bodies, rng) {
  const out = [];
  const dt = Math.min(STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  payTithe(f, now, rng, out);   // AUDIT WB14 (LAW-5): a tithe owed is paid before anything - the kill and the Wrath included
  if (f.fell || f.wrath) return out;
  const P = profileOf(f);   // WB8b: the numbers his marks move
  // a fight checkpointed before WB9 wakes in the first court with nothing crossed, nothing grown
  f.queue ??= [];   // (and one before WBX5 with no turn to come)
  if (!Array.isArray(f.xa)) f.xa = [];
  f.court ??= nearestCourt(f.pos?.[0] ?? 0, f.pos?.[1] ?? 0);
  // standing: a living body in the court stands its time; AUDIT WBX R4: and the fight's own clock runs while one does
  let living = false;
  for (const b of bodies) { const p = f.players[b.sub]; if (p && !b.dead) { p.stoodMs += dt; living = true; } }
  // GATE-UX: a fall counted once - the beat it is first seen dead, again only after it has stood up alive in the court
  for (const b of bodies) { const p = f.players[b.sub]; if (!p) continue; if (b.dead && !p.down) p.falls = (p.falls ?? 0) + 1; p.down = !!b.dead; }
  if (living) f.liveMs = (f.liveMs ?? 0) + dt;
  // AUDIT WBX R1: a fighter in the court is seen (its share back if it had gone); one gone ABSENT_RETIRE_MS takes its
  // share out of his health
  for (const b of bodies) { const p = f.players[b.sub]; if (p) { p.seenAt = now; restoreShare(f, p); } }
  for (const p of Object.values(f.players)) if (!p.retired && now - (p.seenAt ?? p.joinedAt) > ABSENT_RETIRE_MS) retireShare(f, p);
  // WB8b: SOUL-HUNGRY - each challenger who falls in the court feeds him, once a fight (a fall again, a death and a
  // walk back in, feeds him nothing more): a share of the health he stands for, never past it, said to the court.
  // AUDIT PRE-MERGE 0929 W1-1: a fall is the fighter's own word (the pose's `dd`), and a heal sized to the whole fight
  // outlives the share of one who leaves - twenty-five throwaway guests that said `in` dead and went took him from a
  // fifth of his health to all but full, for good. So only a fall with a REAL PART behind it feeds him (hasPart: the
  // blows or the time a seat is kept by), and no more than the trial's feedings a fight (GATE_FEEDS_MAX), however many
  // accounts come. W1-3: and the beat's feedings are ONE word naming every one of them - two falls in a beat were two
  // words with one moment, and the court said the first name alone.
  if (P.feed > 0) {
    let ns = null;
    for (const b of bodies) {
      const p = f.players[b.sub];
      if (!p || !b.dead || p.fed || !(f.max > 0) || !hasPart(p) || (f.feeds ?? 0) >= P.feedsMax) continue;
      p.fed = true;
      f.feeds = (f.feeds ?? 0) + 1;
      if (f.sd) sunderFed(f, P.feed);   // WB14d: sundered, each half standing drinks half of it, never past its pool
      else f.hp = Math.min(f.max, f.hp + P.feed * f.max);
      (ns ??= []).push(p.name);
    }
    if (ns) {
      out.push({ k: 'fed', ns, h: Math.round(f.hp), m: Math.round(f.max), at: now });
      f.lastHpSent = Math.round(f.hp); f.lastHpAt = now;   // the word says the health: no `hp` beside it this beat
    }
  }
  // threat forgets (WB8b: the Grudge-Bearer's never does)
  const keep = Math.pow(1 - P.threatDecay, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  // THE WRATH: the clock's, not his - begun so it lands on the gate's midnight (a room woken late gives a second's
  // warning at least), and unanswerable
  const wr = ATTACKS.wrath;
  if (f.atk?.a === wr.id) {
    if (now >= f.atk.at) { f.wrath = { at: f.atk.at }; f.atk = null; out.push({ k: 'wrath', at: f.wrath.at }); }
    else hpFrame(f, now, out);   // AUDIT WBX R5: the blows landing through its wind-up are seen on the bar
    return out;
  }
  if (now >= f.wrathAt - wr.windup) {
    f.move = null;
    f.cx = null; f.stunUntil = 0;   // WB9c: the midnight overtakes a Reckoning and a stun alike
    if (f.sd) { f.sd.fl.atk = null; f.sd.fl.move = null; f.sd.fl.queue = []; f.sd.fl.pending = null; }   // WB14d: and his Flame stands as Dagon gathers (every screen drops its blow at the Wrath's word)
    f.atk = { i: ++f.seq, a: wr.id, at: Math.max(f.wrathAt, now + 1000), x: f.pos[0], z: f.pos[1], yw: f.yaw, tg: [], until: 0 };
    f.atk.until = f.atk.at + wr.active;
    out.push({ k: 'atk', ...atkFrame(f.atk) });
    // WB11b: and his host - it crumbles as Dagon gathers; said AFTER his word (AUDIT WB11 B2: a screen that heard the
    // crumbling first read it as the Ward-Bearers' cap and said his ward broke - it stands through the wind-up)
    hostGone(f, now, out, HOST_GONE.crumbled);
    hpFrame(f, now, out);   // AUDIT WBX R5
    return out;
  }
  // WB14c: HIS VANGUARD HOLDS THE APPROACH - its waves on its platforms, and he waits in his court until it breaks and a
  // challenger stands before him (his opening begins then)
  if (stepVanguard(f, now, bodies, rng, out, P)) return heldBeat(f, now, out);
  // WB9b: the challengers standing in the court he fights in - the only ones he chooses, aims at and waits for (a body
  // still on the walkway, or left behind in a court he has leapt from, is not before him)
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && inCourt(b.x, b.z, f.court, POSE_SLACK));
  // a phase crossed: a roar, the ward, and the phase's turn (WB9b PHASE_TURN - the bound to the next court, the wait
  // there for a challenger, then its signature); an attack in flight is superseded - the new word is the one every
  // screen draws
  // WB14d: on a Sundering night the last phase is the Rejoining's, never his health's
  if (f.max > 0 && f.phase < 3 && f.hp / f.max <= PHASE_AT[f.phase - 1] && !(f.phase === 2 && sunders(f))) {
    f.phase++;
    f.shieldUntil = now + CROSS_WARD_MAX_MS;   // WB9b: the ward holds through the bound and the wait (the wait sets its end)
    f.move = null;
    f.cx = null; f.stunUntil = 0;
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    const [first, ...rest] = turnOf(f);   // WB14d: the Sundering's on its night
    f.queue = rest.map((e) => ({ ...e }));
    hostGone(f, now, out, HOST_GONE.fled, (a) => a.k === HOST.tithe);   // WB14e: a Tithe-Imp still running dives into the fire
    hostGone(f, now, out, HOST_GONE.crumbled, notGaoler);   // WB11b: his host crumbles at every turn - each kind is its phase's or its court's (WB14f: the Captive's gaolers are the Pen's)
    f.pending = null;
    beginTurn(f, first, now, here, rng, out);
  }
  stepHost(f, now, here, rng, out, P);   // WB11b: his host's beat - under the Legion-Lord alone
  stepTithe(f, now, here, rng, out, P);   // WB14e: the night's Tithe-Imp, where it runs
  stepCaptive(f, now, bodies, rng, out);   // WB14f: the Captive's gaolers, his freeing and his ward
  if (f.sd) stepSunder(f, now, dt, bodies, here, rng, out);   // WB14d: the halves' laws, and the Flame's own beat
  bodyBeat(f, now, here, bodies, rng, out, P);   // his body's beat (WB14d: the Blade's, while he is sundered)
  hpFrame(f, now, out);
  sdFrame(f, now, out);   // WB14d: the halves' pools
  cxFrame(f, now, out);
  stateFrame(f, now, out);
  return out;
}

/**
 * WB14d: ONE BODY'S BEAT - his, or (sundered) the Blade's and the Flame's each (the Flame's through its view of the fight,
 * flameView): its stun, its attack in flight and its end, its turn's waits and entries, his Reckonings, and the choice -
 * a target kept a while, and what its kit can do to it from here, else a walk at it. The frames are the caller's.
 */
function bodyBeat(f, now, here, bodies, rng, out, P) {
  // WB9c: STUNNED - his Reckoning broken, he kneels: no step, no blow, until it passes (WB14d: a half kneeling, the same)
  if (now < (f.stunUntil ?? 0)) return;
  // an attack in flight: the charge runs its lane over its active span, a leap lands him where it falls; the rest hold
  // still until their recovery ends
  if (f.atk) {
    settleAt(f, now);   // the charge down its lane, the leap through the air (WBX5) - AUDIT WBX2 M8: the kill's own rule, one copy
    const A = ATTACK_BY_ID[f.atk.a];
    if (A === ATTACKS.cross && now >= f.atk.at && Number.isInteger(f.atk.to)) {   // WB9b: he stands in the new court from the landing
      f.court = f.atk.to;
    }
    if (P.legion && A === ATTACKS.cross && f.court === f.atk.to) raiseBearers(f, now, bodies, rng, out);   // WB11b: his Ward-Bearers rise in the court he lands in (once a court)
    if (A === ATTACKS.reckon && now >= f.atk.at && f.cx) f.cx = null;   // WB9c: the Reckoning landed - the crystals are spent in it
    if (A === ATTACKS.chains && now >= f.atk.at && f.atk.held == null) f.atk.held = chainHeld(f, bodies);   // WB14a: the chain holds, or breaks, as it lands
    if (now < f.atk.until) return;
    const was = f.atk;
    f.runA = f.atk.a === f.lastA ? (f.runA ?? 0) + 1 : 1;   // WB13f
    f.lastA = f.atk.a;
    f.freeAt = now;
    f.atk = null;
    f.target = null;
    f.nextAt = now + BREATH_MS;
    if (ATTACK_BY_ID[was.a] === ATTACKS.reckon) f.rk = now + RECKON_EVERY_MS;   // WB9c: the next a minute after this one's end
    // WB14d: the Sundering's end tears him in two; the Rejoining's makes him whole for his last phase
    if (ATTACK_BY_ID[was.a] === ATTACKS.sunder && !f.sd) sunder(f, now, bodies);
    if (ATTACK_BY_ID[was.a] === ATTACKS.rejoin && f.sd) whole(f, now, out);
    // WB8b: ECHOING - a meteor falls again, a breath after the first: on the one it fell for, where they stand now (and
    // alive), else where the first fell; an echo has none of its own, and a phase's turn clears it with the rest
    if (P.echo && ATTACK_BY_ID[was.a] === ATTACKS.meteor && !was.echo) f.queue.unshift({ a: 'meteor', echo: true, who: was.who ?? null, point: was.tg?.[0] ?? null });
    // WB14a: a chain that held reels its fighter in to a Ground Slam at his feet; the Unmaking's first cast turns to the
    // other half of the wedges (its `echo` - a second cast, never a third)
    if (ATTACK_BY_ID[was.a] === ATTACKS.chains && was.held) f.queue.unshift({ a: 'slam' });
    if (ATTACK_BY_ID[was.a] === ATTACKS.unmake && !was.echo) f.queue.unshift({ a: 'unmake', turn: (2 * Math.PI) / ATTACKS.unmake.n, echo: true });
    // WBX5: a turn still to come goes on from here, a breath later
    if (f.queue.length) { const next = f.queue.shift(); f.nextAt = now + TURN_BREATH_MS; f.pending = next; if (next.wait) f.waitUntil = now + CROSS_WAIT_MAX_MS; }
  }
  // WB11b: UNDER THE LEGION-LORD THE WAIT IS HIS WARD-BEARERS' - his ward holds, as WB9b's below, until a living
  // challenger stands in the new court (or CROSS_WAIT_MAX_MS); from then it holds while one of his Ward-Bearers stands
  // (BEARER_WARD_MAX_MS at most - then any left crumble), and as the last falls it breaks into his profile's own ward,
  // the turn going on under it as before (the signature cast under it). Each change of the ward said (`ph`).
  if (P.legion && f.pending?.wait && now >= f.nextAt) {
    if (f.pending.wait !== 'bearers') {
      const none = !here.length && now < (f.waitUntil ?? 0);
      if (none) return;
      f.pending = { wait: 'bearers' };
      f.waitUntil = now + BEARER_WARD_MAX_MS;
      f.shieldUntil = f.waitUntil;
      out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    }
    if (bearersStand(f) && now < f.waitUntil) return;
    hostGone(f, now, out, HOST_GONE.crumbled, (a) => a.k === HOST.bearer);   // the cap: any still standing crumble
    f.shieldUntil = P.shieldMs + now;   // his own ward, as a challenger's arrival raises it below (Unyielding's 6 s)
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.pending = f.queue.length ? f.queue.shift() : null;
    f.nextAt = now + TURN_BREATH_MS;
  }
  // WB9b: THE WAIT in a new court - his ward holds until a living challenger stands in it (or CROSS_WAIT_MAX_MS), then
  // holds his profile's ward more while the turn goes on (the signature is cast under it)
  if (f.pending?.wait && now >= f.nextAt) {
    if (!here.length && now < (f.waitUntil ?? 0)) return;
    f.shieldUntil = now + P.shieldMs;
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.pending = f.queue.length ? f.queue.shift() : null;
    f.nextAt = now + TURN_BREATH_MS;
  }
  if (f.pending && !f.pending.wait && now >= f.nextAt) {
    const next = f.pending;
    f.pending = null;
    beginTurn(f, next, now, here, rng, out);
    return;
  }
  // WB9c: Dagon's Champion's turn done in the last court, his Reckonings are armed - the first RECKON_FIRST_MS from then;
  // one due - he leaps to the court's heart and calls it (`rk` -2 while it is under way: its end sets the next)
  if (f.phase >= 3 && !f.pending && !f.queue.length && !f.atk) {
    if (!f.rk && f.court === finalCourt(f)) f.rk = now + RECKON_FIRST_MS;   // WB14d: the last court his last phase is fought in
    if (f.rk > 0 && now >= f.rk && now >= f.nextAt) {
      f.rk = -2;
      f.move = null;
      f.queue = [{ a: 'reckon' }];
      beginTurn(f, { a: 'leap', centre: true }, now, here, rng, out);
      return;
    }
  }
  // choose: a target he keeps a while, and what can be done to it from here - else walk at it (WB14d: never while the
  // halves go to rejoin)
  if (now >= f.nextAt && !f.pending && !f.sd?.rj) {
    let target = f.target ? here.find((b) => b.sub === f.target) ?? null : null;
    if (!target || now - f.targetAt >= TARGET_HOLD_MS) {
      target = pickTarget(f, here, rng);
      f.target = target?.sub ?? null;
      f.targetAt = now;
    }
    if (target) {
      const gap = dist(target.x, target.z, f.pos[0], f.pos[1]) - P.bossR;
      const near = here.filter((b) => dist(b.x, b.z, f.pos[0], f.pos[1]) <= P.atk.slam.r).length;   // WB8b: Colossal's slam reaches further
      if (now - (f.freeAt ?? 0) >= REPEAT_WALK_MS) f.runA = 0;   // WB13f: a walk-in that long breaks the run
      const can = attacksFor(f.phase, gap, near, f.lastA, P, f.runA, { now, used: f.used, n: here.length, woke: Number.isFinite(openedAt(f)) ? openedAt(f) + OPENING_MS : -Infinity, kit: kitOf(f) });   // WB14d: a half's from its kit (AUDIT WB14 LAW-6: before the run's law, so a half repeats as he does); WB13f: never thrice running - he walks in; WB14a: the new six by their cooldowns
      if (can.length) { f.move = null; begin(f, chooseAttack(can, rng), now, target, here, rng, out); }
      else walkToward(f, target, now, out);
    } else if (f.move) {
      stepWalk(f, now);
      f.move = null;
      out.push({ k: 'mv', x: r2(f.pos[0]), z: r2(f.pos[1]), tx: r2(f.pos[0]), tz: r2(f.pos[1]), v: 0, at: now });
    }
  }
  stepWalk(f, now);
}

/** Where the last said walk has taken him by `now`. */
function stepWalk(f, now) {
  const m = f.move;
  if (!m) return;
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) { f.pos = [m.tx, m.tz]; return; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  f.pos = keepInCourt(m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along, BOSS_REACH_R, hisCourt(f));
}

/** Walk at a target, stopping short of it by his body and a little: a new segment is said when its goal moved past
 *  MOVE_RESAY_M or MOVE_RESAY_MS has passed. */
function walkToward(f, target, now, out) {
  stepWalk(f, now);
  const dx = target.x - f.pos[0], dz = target.z - f.pos[1], d = Math.hypot(dx, dz);
  const stop = Math.max(0, d - (profileOf(f).bossR + 1));
  const [tx, tz] = keepInCourt(f.pos[0] + (d > 0 ? (dx / d) * stop : 0), f.pos[1] + (d > 0 ? (dz / d) * stop : 0), BOSS_REACH_R, hisCourt(f));
  const m = f.move;
  if (m && dist(m.tx, m.tz, tx, tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  f.move = { x: f.pos[0], z: f.pos[1], tx, tz, v: BOSS_SPEED, at: now };
  if (d > 0) f.yaw = Math.atan2(dx, dz);
  out.push({ k: 'mv', x: r2(f.move.x), z: r2(f.move.z), tx: r2(tx), tz: r2(tz), v: BOSS_SPEED, at: now });
}

/** An angle turned into [-PI, PI) - the wire bounds a facing (net/wire.js gateAtk: |yw| <= 8). */
export const wrapYaw = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };

/** WBX5: one entry of a phase's turn begun: the leap into the court's heart, or the attack named, its lanes turned from
 *  the last one's facing (the spokes' second cast). WB8b: an echo's meteor falls on the fighter the first fell for, if
 *  they stand alive in the court, else where the first fell. */
function beginTurn(f, entry, now, bodies, rng, out) {
  const atk = ATTACKS[entry.a];
  if (!atk) return;
  if (entry.turn) f.yaw = wrapYaw(f.yaw + entry.turn);
  const who = entry.who ? bodies.find((b) => b.sub === entry.who && !b.dead && f.players[b.sub]) ?? null : null;
  // WB9b: the bound lands at the next court's heart, and says the walkway it lays (its word's moment, `xa`)
  if (atk === ATTACKS.cross && Number.isInteger(entry.court) && COURTS[entry.court]) {
    f.xa = [...(Array.isArray(f.xa) ? f.xa : [])];
    // every walkway up to the court he bounds to - a fight woken from a checkpoint older than WB9 crosses from the first
    // court straight to the third, and its players walk both (the wire says them in order: no gap). WB14d: a turn's own
    // walkway (`walk` - the Flame's Rift Way) is that walkway alone
    if (Number.isInteger(entry.walk)) { if (!Number.isFinite(f.xa[entry.walk])) f.xa[entry.walk] = now; }
    else for (let k = 0; k < entry.court; k++) if (!Number.isFinite(f.xa[k])) f.xa[k] = now;
    begin(f, atk, now, null, bodies, rng, out, entry.at ?? COURTS[entry.court], false, entry.court);   // WB14d: or beside the heart (`at` - two halves in one court)
    return;
  }
  begin(f, atk, now, who, bodies, rng, out, entry.centre ? hisCourt(f) : who ? null : entry.point ?? null, !!entry.echo);   // WB9b: the heart of the court he fights in
}

/** Begin an attack: where it lands and when, said now so every screen draws the wind-up at once. `point` (WBX5): where a
 *  'point' attack lands when it is not the target's feet (the leap into the court's heart). WB8b: the fighter it was
 *  begun at (`who`) and whether it is an echo are kept on the attack - the fight's own, never on the wire. */
function begin(f, atk, now, target, bodies, rng, out, point = null, echo = false, to = null) {
  const at = now + windupOf(atk, f.phase);
  const C = hisCourt(f);   // WB9b: the court he fights in - what he keeps to, and what his fire falls on
  let tg = [];
  if (target) f.yaw = Math.atan2(target.x - f.pos[0], target.z - f.pos[1]);
  if (atk === ATTACKS.charge) {
    tg = [keepInCourt(f.pos[0] + Math.sin(f.yaw) * atk.len, f.pos[1] + Math.cos(f.yaw) * atk.len, BOSS_REACH_R, C)];
  } else if (atk === ATTACKS.cross) {
    // WB9b: the bound - to the next court's heart, over the fire
    tg = [[point[0], point[1]]];
    f.yaw = Math.atan2(point[0] - f.pos[0], point[1] - f.pos[1]);
  } else if (atk.aim === 'point') {
    // WBX5: one spot - the leap comes down inside the ring he keeps to, a meteor falls anywhere on the floor
    const p = point ?? (target ? [target.x, target.z] : [f.pos[0], f.pos[1]]);
    const PC = point && atk === ATTACKS.meteor ? COURTS[nearestCourt(p[0], p[1])] : C;   // WB14c: his patience's meteor falls on the platform it is called at
    tg = [keepInCourt(p[0], p[1], atk === ATTACKS.leap ? BOSS_REACH_R : COURT_R, PC)];
    if (atk === ATTACKS.leap && (tg[0][0] !== f.pos[0] || tg[0][1] !== f.pos[1])) f.yaw = Math.atan2(tg[0][0] - f.pos[0], tg[0][1] - f.pos[1]);
  } else if (atk === ATTACKS.hellfire) {
    const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = live[i]; live[i] = live[j]; live[j] = t; }
    const first = live.slice(0, atk.max);
    tg = first.map((b) => keepInCourt(b.x, b.z, COURT_R, C));
    // phase three: a second volley, scattered about the same feet
    if (f.phase >= 3) tg = tg.concat(first.map((b) => keepInCourt(b.x + (rng() - 0.5) * 6, b.z + (rng() - 0.5) * 6, COURT_R, C)));
  }
  // WB14a: the marked - the chained (his target), the branded (brandCountFor of the living in his court, by the dice), the
  // tormented (his target) - each where they stand at the word (`tg`, the ring a screen draws for one it cannot see) and
  // by their peer id (`pk`: every screen draws the ring where it sees them now, and the marked know themselves)
  let marked = null;
  if (atk === ATTACKS.chains || atk === ATTACKS.torment) marked = target ? [target] : [];
  else if (atk === ATTACKS.brand) {
    const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = live[i]; live[i] = live[j]; live[j] = t; }
    marked = live.slice(0, brandCountFor(live.length));
  } else if (atk === ATTACKS.unmake) tg = [[C[0], C[1]]];   // WB14a: its wedges about his court's heart
  if (marked) tg = marked.map((b) => [b.x, b.z]);
  const pk = marked && marked.length && marked.every((b) => typeof b.id === 'string' && b.id) ? marked.map((b) => b.id) : null;
  if (/** @type {GateAttack} */ (atk).cd && !echo) (f.used ??= {})[atk.key] = now;   // WB14a: its cooldown from this word (AUDIT WB14 LAW-11: the first cast's - an echo is the same Unmaking)
  f.atk = { i: ++f.seq, a: atk.id, at, x: f.pos[0], z: f.pos[1], yw: f.yaw, tg, until: at + atk.active + atk.recover, ...(pk ? { pk } : {}), ...(target ? { who: target.sub } : {}), ...(echo ? { echo: true } : {}), ...(Number.isInteger(to) ? { to } : {}) };
  out.push({ k: 'atk', ...atkFrame(f.atk) });
  if (atk === ATTACKS.reckon) growCrystals(f, now, bodies, rng, out);   // WB9c: the crystals rise as he calls it
  if (atk === ATTACKS.reckon) captiveWard(f, now, out);   // WB14f: and the Covenant's ward takes it, the knight freed
}

/**
 * WB9c: THE CRYSTALS OF OBLIVION rise as the Reckoning is called - crystalCountFor(the living challengers in his court)
 * of them, anywhere on its floor (a ring RECKON_RING about its heart, CRYSTAL_GAP_M apart at least - the dice's, the
 * relay's CSPRNG), each with crystalHpFor(their levels) health. Said once (`cx`: the Reckoning's number, the spots, the
 * health each), then their health as it falls (`cxh`) and each one's breaking (`cxb`).
 */
function growCrystals(f, now, bodies, rng, out) {
  const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
  const n = crystalCountFor(live.length), m = crystalHpFor(live.map((b) => f.players[b.sub].lv), n);
  const [cx, cz] = hisCourt(f), spots = [];
  for (let tries = 0; spots.length < n && tries < n * 60; tries++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(RECKON_RING[0] ** 2 + rng() * (RECKON_RING[1] ** 2 - RECKON_RING[0] ** 2));   // even over the ring's area
    const x = r2(cx + Math.sin(a) * r), z = r2(cz + Math.cos(a) * r);
    if (spots.some((q) => Math.hypot(q[0] - x, q[1] - z) < CRYSTAL_GAP_M)) continue;
    spots.push([x, z]);
  }
  for (let k = spots.length; k < n; k++) { const a = (k / n) * Math.PI * 2; spots.push([r2(cx + Math.sin(a) * 14), r2(cz + Math.cos(a) * 14)]); }   // a floor too crowded for the dice: a ring
  f.cx = { i: f.atk.i, m, c: spots.map(([x, z]) => ({ x, z, h: m })) };
  f.cxSent = cxHealthKey(f.cx); f.cxSentAt = now;
  out.push({ k: 'cx', i: f.cx.i, m, c: spots.map((q) => [q[0], q[1]]) });
}
const cxHealthKey = (cx) => cx.c.map((q) => Math.ceil(q.h)).join(',');
/** WB9c: the crystals' health, at most every HP_SEND_MS, when it has moved. */
function cxFrame(f, now, out) {
  if (!f.cx || now - (f.cxSentAt ?? 0) < HP_SEND_MS) return;
  const key = cxHealthKey(f.cx);
  if (key === f.cxSent) return;
  f.cxSent = key; f.cxSentAt = now;
  out.push({ k: 'cxh', i: f.cx.i, h: f.cx.c.map((q) => Math.ceil(q.h)) });
}

/** AUDIT WB9 (brain F2): THE CRYSTALS TAKE NO BLOW in the Reckoning's last RECKON_CLOSE_MS - a break judged later reached
 *  a screen after its own clock had landed the Reckoning (a court wiped, then told he was stunned, and a screen that heard
 *  the stun first spared) - nor once it has landed, nor with no Reckoning in flight. The screens stop offering them then. */
export const RECKON_CLOSE_MS = 500;
export const reckonOpen = (f, now) => !!f.atk && f.atk.a === ATTACKS.reckon.id && now < f.atk.at - RECKON_CLOSE_MS;

/**
 * WB9c: A BLOW ON A CRYSTAL from `sub`, standing at `pose` ({x, z}, the court's frame), of kind `r`, claiming `d` on
 * crystal `c` of the Reckoning in flight. The same caps as a blow on him - his blow rate and his damage bucket (one hand,
 * one purse), a melee blow within reach of the crystal's body, from the floor - and it counts as dealt (a crystal broken
 * is a part in the fight). Answers the frames to fan: a crystal broken (`cxb`, by whom), and when it was the last, THE
 * RECKONING BROKEN - it is called off, and he is stunned STUN_MS (`stun`); the next comes RECKON_EVERY_MS after.
 */
export function applyCrystalHit(f, sub, c, d, r, pose, now, seq = null) {
  const out = [];
  const p = f.players[sub], X = f.cx, q = X && Number.isInteger(c) ? X.c[c] : null;
  if (!p || f.fell || f.wrath || !q || !(q.h > 0) || !Number.isFinite(d) || !(d > 0) || now >= f.wrathAt) return out;
  if (!reckonOpen(f, now)) return out;   // AUDIT WB9 (brain F2): only while the Reckoning still winds up, and not in its last breath
  if (!spendBlow(p, now, seq, `x${c}`)) return out;   // his hand (AUDIT WB11 W3: once a blow)
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK, planOf(f))) return out;
  if (!inCourt(pose.x, pose.z, f.court, POSE_SLACK)) return out;   // AUDIT WB9 (brain F1): from his court, as a blow on him
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, q.x, q.z) - CRYSTAL_R > MELEE_REACH + POSE_SLACK) return out;
  const ref = dpsRef(p.lv);
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const got = Math.max(0, Math.min(d, HIT_CAP_X * ref, p.bucket, q.h));
  p.bucket -= got;
  p.clipped += d - got;
  p.dealt += got;
  p.cxd = (p.cxd ?? 0) + got;   // GATE-UX: the chart says the crystals apart
  q.h -= got;
  if (q.h > 1e-6) return out;
  q.h = 0;
  out.push({ k: 'cxb', i: X.i, c, n: p.name, at: now });
  if (X.c.every((o) => o.h <= 0)) {
    if (f.cp?.w === X.i) f.cp.w = 0;   // WB14f: a Reckoning broken never lands - the Covenant's ward waits for the next
    f.cx = null;
    f.atk = null; f.move = null; f.queue = []; f.pending = null; f.target = null;
    f.stunUntil = now + STUN_MS;
    f.nextAt = f.stunUntil;
    f.rk = f.stunUntil + RECKON_EVERY_MS;
    out.push({ k: 'stun', until: f.stunUntil, at: now });
  }
  return out;
}

// ── WB11b: HIS HOST - the Legion-Lord trial ─────────────────────────────
/**
 * WB11b (2026-10-01 - Mac, offered adds in three kinds and asked four questions: "1. All three 2. Your choice 3. Your
 * choice 4. Trial rotation"): HIS HOST - the bodies the relay runs beside him under the Legion-Lord trial (net/gate/gateMods.js
 * `legion`; bible/11-Multiplayer/World-Bosses.md section 17). Section 9 left it: "No adds ... the relay could own simple
 * ones as it owns the boss - later". Simple, as he is: each a point on an open floor, a health, a walk said once and
 * carried by every screen, and a blow wound up and laid on the ground. By wire id:
 *   0 the HARRIER - an Imp: in waves in the first phase, it runs at the challenger who stands farthest from him, and Bites
 *   1 the SAPPER - an Atronach: in waves in the second phase, it walks at him; one that reaches him is drunk and heals him
 *   2 the WARD-BEARER - a Daedra: rises in each new court as he lands there; his ward holds while one stands, and it
 *     Pulses at whoever comes near
 * `r` its body's radius and `h` its height (a blow's reach is measured to its body, as to his), `speed` metres a second
 * (a player runs 7.6 - a runner always outruns them). Who each one IS by his aspect is the screen's (world/gate/gateBoss.js
 * HOST_LOOKS); the relay knows bodies, not faces.
 */
export const HOST_KINDS = Object.freeze([
  Object.freeze({ id: 0, key: 'harrier', r: 0.5, h: 1.5, speed: 5 }),
  Object.freeze({ id: 1, key: 'sapper', r: 0.7, h: 2.3, speed: 1.6 }),
  Object.freeze({ id: 2, key: 'bearer', r: 0.6, h: 2.2, speed: 0 }),
  // WB14c (bible/11-Multiplayer/Breach-Portents.md section 4): THE VANGUARD'S KINDS, beside the Harrier (its Imps) - never on a
  // Legion-Lord night, so never beside his host:
  //   3 the BRUTE - a Daedroth: it walks at the nearest fighter on its platform and Smashes the ground about itself
  //   4 the CASTER - a Daedra of his aspect (a Fire Daedra, a Frost Daedra, a Daedra Seducer, a Lich): it keeps
  //     VG_CASTER_KEEP from the nearest fighter and Bolts a fighter's feet within VG_CASTER_REACH
  //   5 the MARKYNAZ - the Warden's lieutenant, a Daedra Lord: a Brute's walk and a Rend of its own, and it calls Imps
  //     out of the fire every VG_CALL_MS (a markynaz serves a valkynaz - the Kyn's ranks)
  Object.freeze({ id: 3, key: 'brute', r: 0.8, h: 2.4, speed: 2.8 }),
  Object.freeze({ id: 4, key: 'caster', r: 0.6, h: 2.2, speed: 2.0 }),
  Object.freeze({ id: 5, key: 'markynaz', r: 0.9, h: 3.0, speed: 3.0 }),
  // WB14e (bible/11-Multiplayer/Breach-Portents.md section 9): 6 the TITHE-IMP - an Imp at 1.3 of its size, burning gold,
  // carrying the coven's tithe to its master: it runs from the nearest challenger, strikes nobody, and dives into the fire
  // TITHE_LIFE_MS after it rose; caught, its tithe is theirs who struck it. Any night, one in five, unannounced
  Object.freeze({ id: 6, key: 'tithe', r: 0.65, h: 1.95, speed: 6.8 }),   // AUDIT WB14 (PLAY-6): a chase - at 6.2 a lone chaser caught it in 5 s of its 22
  // WB14f (section 7): 7 the GAOLER - WB11's Ward-Bearer's body and Pulse under another name, in the Captive's Pen: the
  // knight's chain held while one stands, and a Pulse at whoever comes near (a Captive night is never a Legion-Lord's)
  Object.freeze({ id: 7, key: 'gaoler', r: 0.6, h: 2.2, speed: 0 }),
]);
/** The kinds by name. */
export const HOST = Object.freeze({ harrier: 0, sapper: 1, bearer: 2, brute: 3, caster: 4, markynaz: 5, tithe: 6, gaoler: 7 });
/**
 * THE HOST'S BLOWS, by the kind that strikes them (a Sapper strikes nobody - null): each a disc `r` about the body that
 * strikes it, laid where it stands at its word, wound up `windup`, landing over `active`, the body still `recover` after;
 * a share of the struck player's own health and points beside it (WBX4's law), its element - `aspect` his aspect's (the
 * saving throw answers it), null plain. Resolved on the struck player's machine, as his are (net/gate/gateStrike.js
 * hostVerdict). From the body's own feet a runner is out of either disc in a fraction of its wind-up (pinned).
 */
export const HOST_BLOWS = Object.freeze([
  Object.freeze({ kind: 0, key: 'bite', name: 'Bite', windup: 900, active: 200, recover: 900, r: 2, pct: 0.12, base: 4, el: null }),
  null,
  Object.freeze({ kind: 2, key: 'pulse', name: 'Ward Pulse', windup: 1400, active: 200, recover: 0, r: 3.5, pct: 0.18, base: 6, el: 'aspect' }),
  // WB14c: the Vanguard's - a Brute's Smash and the Markynaz's Rend about themselves, a Caster's Bolt at a fighter's feet
  // (its word's spot), his aspect's element
  Object.freeze({ kind: 3, key: 'smash', get name() { return t('gate.host.smash', 'Smash'); }, windup: 1300, active: 200, recover: 1100, r: 3, pct: 0.28, base: 9, el: null }),
  Object.freeze({ kind: 4, key: 'bolt', get name() { return t('gate.host.bolt', 'Bolt'); }, windup: 1600, active: 200, recover: 400, r: 3, pct: 0.22, base: 7, el: 'aspect' }),
  Object.freeze({ kind: 5, key: 'rend', get name() { return t('gate.host.rend', 'Rend'); }, windup: 1300, active: 200, recover: 1100, r: 4.5, pct: 0.38, base: 11, el: null }),
  null,   // WB14e: the Tithe-Imp strikes nobody
  // WB14f: a gaoler's Pulse - the Ward-Bearer's own, by its own name's reader
  Object.freeze({ kind: 7, key: 'pulse', get name() { return t('gate.host.pulse', 'Ward Pulse'); }, windup: 1400, active: 200, recover: 0, r: 3.5, pct: 0.18, base: 6, el: 'aspect' }),
]);
/** A host blow under a fight's profile: its element his aspect's where it takes one, and Vengeful's weight on its share
 *  and base (no other mark touches its blows - AUDIT WB11 D11: the host itself is touched through him, Colossal's body
 *  being what a Sapper reaches and Unyielding's ward the one the bearers' gives way to). Null for a kind that strikes
 *  nobody. Pure. */
export function hostBlowUnder(k, P = BASE_PROFILE) {
  const B = HOST_BLOWS[k] ?? null;
  return B ? { ...B, el: B.el === 'aspect' ? P.el : B.el, pct: B.pct * P.dmgX, base: B.base * P.dmgX } : null;
}
/** The least health any of his host stands with. */
export const HOST_HP_MIN = 20;
/** A Harrier's health: HARRIER_S seconds of the court's MEAN reference damage - three of a challenger's own blows. */
export const HARRIER_S = 3;
/** A Sapper's and a Ward-Bearer's: their team seconds of the court's WHOLE reference damage, shared over the wave - the
 *  crystals' law: a court that splits up breaks them, one that stands together round one does not. */
export const SAPPER_TEAM_S = 6;
export const BEARER_TEAM_S = 8;
/** How many rise a wave for `n` living challengers in his court (the Ward-Bearers: in the fight - it follows him over),
 *  and the most of a kind standing at once. */
export const harrierCountFor = (n) => Math.max(2, Math.min(5, 1 + Math.ceil(Math.max(0, n) / 3)));
export const sapperCountFor = (n) => Math.max(1, Math.min(4, 1 + Math.floor(Math.max(0, n) / 4)));
export const bearerCountFor = (n) => Math.max(2, Math.min(4, 2 + Math.floor(Math.max(0, n) / 6)));
export const HARRIERS_MAX = 6;
export const SAPPERS_MAX = 6;
/** The most of his host standing at once. The kinds never stand together - each is its phase's or its new court's, and
 *  every one crumbles at a phase's turn (the Captive's gaolers excepted: the Pen is no court of his) - so it is the most of
 *  one kind (net/wire.js GATE_HOST_MAX bounds every list on the wire - pinned over it, with room for a Tithe-Imp beside
 *  the gaolers or the Legion-Lord's host). */
/** WB14c: the most of the Vanguard standing at once (its waves and the Markynaz's Imps). */
export const VG_STANDING_MAX = 12;
export const HOST_STANDING_MAX = Math.max(HARRIERS_MAX, SAPPERS_MAX, bearerCountFor(Infinity), VG_STANDING_MAX);   // WB14c: the Vanguard's twelve
/** Each one's health for a wave over the levels `lvs` of the living challengers that size it (`k` how many rise). */
export const harrierHpFor = (lvs) => Math.max(HOST_HP_MIN, Math.round(lvs.length ? (HARRIER_S * lvs.reduce((s, lv) => s + dpsRef(lv), 0)) / lvs.length : 0));
export const hostTeamHpFor = (teamS, lvs, k) => Math.max(HOST_HP_MIN, Math.round((teamS * lvs.reduce((s, lv) => s + dpsRef(lv), 0)) / Math.max(1, k)));
/** When the waves come: the Harriers' first HARRY_FIRST_MS after the fight began (16 s after he first moves - OPENING_MS),
 *  then every HARRY_EVERY_MS while the first phase lasts; the Sappers' first SAP_FIRST_MS after the Burning Court's turn
 *  is done, then every SAP_EVERY_MS while the second lasts. A wave due with nobody in his court waits for somebody. */
export const HARRY_FIRST_MS = 24_000;
export const HARRY_EVERY_MS = 28_000;
export const SAP_FIRST_MS = 10_000;
export const SAP_EVERY_MS = 32_000;
/** A Harrier keeps its mark this long before it looks again (a mark who fell or left is dropped at once); it stops
 *  HARRIER_STOP_M short of the mark's feet, and Bites within HARRIER_BITE_REACH of them. */
export const HOST_RETARGET_MS = 3000;
export const HARRIER_STOP_M = 1;
export const HARRIER_BITE_REACH = 1.8;
/** Where a wave rises: on a ring HOST_RIM_R about the court's heart (out of the fire at its rim), never within
 *  HOST_SPAWN_CLEAR of a living challenger nor HOST_GAP_M of another of the wave. The Sappers' on the rim's far side from
 *  him - within SAP_SPREAD radians of the point opposite him, never within SAP_FROM_HIM of him. */
export const HOST_RIM_R = COURT_R - 2;
export const HOST_SPAWN_CLEAR = 5;
export const HOST_GAP_M = 2.5;
export const SAP_SPREAD = 1.2;
export const SAP_FROM_HIM = 12;
/** A Sapper rises this clear of every challenger, wider than a Harrier's HOST_SPAWN_CLEAR: he leaps at whoever stands far
 *  off, and a Sapper risen beside them was drunk the moment he landed there (the first simulated court: 2.75 s after it
 *  rose). */
export const SAP_SPAWN_CLEAR = 8;
/** How long each kind takes to RISE out of the fire before it moves or strikes (by wire id) - seen rising on every screen;
 *  a Sapper still rising is not drunk, whatever lands beside it. A blow meets each from its first moment. */
export const HOST_RISE_MS = Object.freeze([800, 2500, 1500, 1500, 1500, 2500, 800, 1500]);   // WB14c: a Brute, a Caster, the Markynaz; WB14e: the Tithe-Imp an Imp's; WB14f: a gaoler a Ward-Bearer's
/** A Sapper reaches him at his body, its own and this slack; while his feedings last (SAP_FEEDS_MAX a fight) he drinks it
 *  - SAP_HEAL of the health he stands for, never past it - and past them it burns out against him (crumbled). */
export const SAP_REACH_SLACK = 0.6;
export const SAP_HEAL = 0.02;
export const SAP_FEEDS_MAX = 6;
/** The Ward-Bearers: a ring BEARER_RING_R about the new court's heart; his ward held while one stands, BEARER_WARD_MAX_MS
 *  at most from the first challenger's arrival; each one Pulses every BEARER_PULSE_MS while a challenger stands within
 *  BEARER_PULSE_NEAR of it - its first BEARER_PULSE_FIRST_MS after it rose, each next one's first BEARER_PULSE_STAGGER_MS
 *  behind the one before (AUDIT WB11 D9: their first ones staggered - said "never all at once", and two a challenger
 *  walks up to between them Pulse together). */
export const BEARER_RING_R = 9;
export const BEARER_WARD_MAX_MS = 25_000;
export const BEARER_PULSE_MS = 6000;
export const BEARER_PULSE_FIRST_MS = 3000;
export const BEARER_PULSE_STAGGER_MS = 900;
export const BEARER_PULSE_NEAR = 6;
/** How one of his host left the floor, on the wire (`adie`'s `w`): slain by a challenger, drunk by him (a Sapper), or
 *  crumbled (a phase's turn, the bearers' cap, a Sapper past his feedings, Dagon's Wrath gathering). */
export const HOST_GONE = Object.freeze({ slain: 0, fed: 1, crumbled: 2, fled: 3 });   // WB14e: the Tithe-Imp into the fire

/** WB11b: a fight's host, made at its first beat under the trial: the last number given (each body's own, for the
 *  fight - a room woken from its checkpoint goes on from it), those standing (each `{i, k, h, m, x, z, mv, atk, tg, tgAt,
 *  up, next}` - its number, kind, health and whole, spot, walk, blow in flight, mark and when it was taken, when it has
 *  risen, when it may strike next), when each kind's next wave comes (0 not armed), the Sappers he has drunk, the court
 *  whose Ward-Bearers have risen (-1 none), and the health last said. */
export const newHost = () => ({ n: 0, ads: [], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0 });
/** Where one of his host stands at `now`: its walk carried on from its word (every screen carries it so - net/gate/gateLink.js
 *  reads this same law), else where it stands. Pure. */
export function hostAt(a, now) {
  const m = a?.mv;
  if (!m || !(m.v > 0)) return [a.x, a.z];
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}
/** Do any of his Ward-Bearers stand? */
export const bearersStand = (f) => !!f.lg?.ads?.some((a) => a.k === HOST.bearer);

/** A walk said to (gx, gz), `stop` short of it and kept to court C's floor - a new word only when its goal moved past
 *  MOVE_RESAY_M or MOVE_RESAY_MS has passed (his own walk's law), into the beat's `moves`. */
function walkHost(a, gx, gz, stop, now, C, moves) {
  const K = HOST_KINDS[a.k];
  const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz), go = Math.max(0, d - stop);
  const [tx, tz] = keepInCourt(a.x + (d > 0 ? (dx / d) * go : 0), a.z + (d > 0 ? (dz / d) * go : 0), COURT_R - K.r, C);
  const m = a.mv;
  if (m && Math.hypot(m.tx - tx, m.tz - tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  if (!m && Math.hypot(tx - a.x, tz - a.z) < 0.05) return;   // there already, and still
  a.mv = { x: r2(a.x), z: r2(a.z), tx: r2(tx), tz: r2(tz), v: K.speed, at: now };
  a.x = a.mv.x; a.z = a.mv.z;
  moves.push([a.i, a.mv.x, a.mv.z, a.mv.tx, a.mv.tz, K.speed, now]);
}
/** A walk ended where it has come to: said once, a word of no pace. */
function stopHost(a, now, moves) {
  if (!a.mv) return;
  a.mv = null;
  a.x = r2(a.x); a.z = r2(a.z);
  moves.push([a.i, a.x, a.z, a.x, a.z, 0, now]);
}
/** AUDIT WB11 B1: how finely a rim too crowded for the dice is swept for a clear spot (the ring's circumference over
 *  this, about 2 m - under HOST_GAP_M, so no clear stretch of the rim is stepped over). */
export const RIM_SWEEP = 72;
/** At most `n` spots for a wave on court C's rim ring - each HOST_SPAWN_CLEAR from the living challengers `live` and
 *  HOST_GAP_M from the wave's others (and where `ok` says), on the dice's angles: anywhere round it, or within `spread` of
 *  `about`. AUDIT WB11 B1: a floor too crowded for the dice is SWEPT - the arc, then the whole rim - and a spot is never
 *  taken unchecked: what no spot clears rises fewer, or none (the rest went evenly round the arc, beside whoever stood
 *  there - four archers on the far rim had every Atronach rise inside their 8 m). */
function rimSpots(C, n, live, rng, about = null, spread = Math.PI, ok = null) {
  /** @type {(a: number) => [number, number]} */
  const at = (a) => [r2(C[0] + Math.sin(a) * HOST_RIM_R), r2(C[1] + Math.cos(a) * HOST_RIM_R)];
  const spots = [];
  /** @param {[number, number]} p */
  const take = ([x, z]) => {
    if (live.some((b) => dist(b.x, b.z, x, z) < HOST_SPAWN_CLEAR) || spots.some((q) => dist(q[0], q[1], x, z) < HOST_GAP_M) || (ok && !ok(x, z))) return;
    spots.push([x, z]);
  };
  for (let tries = 0; spots.length < n && tries < n * 40; tries++) take(at(about === null ? rng() * 2 * Math.PI : about + (rng() * 2 - 1) * spread));
  const sweep = (a0, half) => { for (let k = 0; spots.length < n && k < RIM_SWEEP; k++) take(at(a0 + ((k + 0.5) / RIM_SWEEP - 0.5) * 2 * half)); };
  if (spots.length < n && about !== null && spread < Math.PI) sweep(about, spread);
  if (spots.length < n) sweep(about ?? 0, Math.PI);
  return spots;
}
/** A wave risen: kind `k` at each spot with `m` health each, said in one word (`ad`). */
function raiseHost(f, k, spots, m, now, out) {
  const H = f.lg, a = [];
  for (const [x, z] of spots) {
    const i = ++H.n;
    H.ads.push({ i, k, h: m, m, x, z, mv: null, atk: null, tg: null, tgAt: 0, up: now + HOST_RISE_MS[k], next: k === HOST.bearer || k === HOST.gaoler ? now + BEARER_PULSE_FIRST_MS + a.length * BEARER_PULSE_STAGGER_MS : now });   // AUDIT WB14 (FIX-1): a gaoler's first Pulse the Ward-Bearer's, staggered as theirs
    a.push([i, x, z]);
  }
  if (!a.length) return;
  out.push({ k: 'ad', w: k, m, a, at: now });
  // the rising says ITS health - the risen's alone (AUDIT WB11 R2: the whole host's key here swallowed a blow on one
  // standing before, never said until the next state)
  H.hSent = [H.hSent, ...a.map(([i]) => `${i}:${Math.ceil(m)}`)].filter(Boolean).join(','); H.hSentAt = now;
}
/** Those of his host `which` picks (every one, by default) gone in one word - `w` how (HOST_GONE).
 * @param {any} f @param {number} now @param {any[]} out @param {number} w @param {(a: any) => boolean} [which] */
function hostGone(f, now, out, w, which = (a) => !!a) {
  const H = f.lg;
  if (!H?.ads?.length) return;
  const is = [];
  H.ads = H.ads.filter((a) => (which(a) ? (is.push(a.i), false) : true));
  if (is.length) out.push({ k: 'adie', is, w, at: now });
}
/** WB11b: HIS WARD-BEARERS RISE in the court the bound lands him in - bearerCountFor(the fight's challengers in the room:
 *  the whole court follows him over) on a ring BEARER_RING_R about its heart, evenly from the dice's turn - once a court.
 *  AUDIT WB11 B4: the FALLEN counted too - a court wiped as he landed had two Ward-Bearers of HOST_HP_MIN, one blow each,
 *  when it walked back in. */
function raiseBearers(f, now, bodies, rng, out) {
  const H = (f.lg ??= newHost());
  if (H.wardCt === f.court) return;
  H.wardCt = f.court;
  const fighters = bodies.filter((b) => f.players[b.sub]);
  const n = bearerCountFor(fighters.length), C = hisCourt(f), a0 = rng() * 2 * Math.PI, spots = [];
  for (let k = 0; k < n; k++) { const a = a0 + (k / n) * 2 * Math.PI; spots.push([r2(C[0] + Math.sin(a) * BEARER_RING_R), r2(C[1] + Math.cos(a) * BEARER_RING_R)]); }
  raiseHost(f, HOST.bearer, spots, hostTeamHpFor(BEARER_TEAM_S, fighters.map((b) => f.players[b.sub].lv), n), now, out);
}
/** A Harrier's beat: a Bite in flight runs out; its mark - the living challenger in his court standing farthest from him,
 *  kept HOST_RETARGET_MS - Bitten within reach (it stands, and the ground about it is struck), else run at. */
function harrierBeat(f, a, now, here, C, moves, blows) {
  if (a.atk) { if (now < a.atk.until) return; a.atk = null; }
  let mark = a.tg ? here.find((b) => b.sub === a.tg) ?? null : null;
  if (!mark || now - a.tgAt >= HOST_RETARGET_MS) {
    mark = null;
    for (const b of here) if (!mark || dist(b.x, b.z, f.pos[0], f.pos[1]) > dist(mark.x, mark.z, f.pos[0], f.pos[1])) mark = b;
    a.tg = mark?.sub ?? null; a.tgAt = now;
  }
  if (!mark) { stopHost(a, now, moves); return; }
  if (dist(a.x, a.z, mark.x, mark.z) <= HARRIER_BITE_REACH) {
    stopHost(a, now, moves);
    const B = HOST_BLOWS[HOST.harrier];
    a.atk = { at: now + B.windup, x: a.x, z: a.z, until: now + B.windup + B.active + B.recover };
    blows.push([a.i, a.atk.at, a.x, a.z]);
    return;
  }
  walkHost(a, mark.x, mark.z, HARRIER_STOP_M, now, C, moves);
}
/** A Sapper's beat: reaching him it is gone - drunk while his feedings last (his health after, said with it), else burnt
 *  out against him; short of him, it walks at him. */
function sapperBeat(f, a, now, C, moves, out, P) {
  const H = f.lg, reach = P.bossR + HOST_KINDS[HOST.sapper].r + SAP_REACH_SLACK;
  if (dist(a.x, a.z, f.pos[0], f.pos[1]) <= reach) {
    H.ads = H.ads.filter((o) => o !== a);
    if (H.fed < SAP_FEEDS_MAX && f.max > 0) {
      H.fed++;
      f.hp = Math.min(f.max, f.hp + SAP_HEAL * f.max);
      const h = Math.round(f.hp), m = Math.round(f.max);
      out.push({ k: 'adie', is: [a.i], w: HOST_GONE.fed, h, m, at: now });
      f.lastHpSent = h; f.lastHpAt = now;   // the word says his health: no `hp` beside it this beat
    } else out.push({ k: 'adie', is: [a.i], w: HOST_GONE.crumbled, at: now });
    return;
  }
  walkHost(a, f.pos[0], f.pos[1], reach - 0.3, now, C, moves);
}
/** A Ward-Bearer's beat: a Pulse in flight runs out; the next due with a challenger near is begun. */
function bearerBeat(a, now, here, blows) {
  if (a.atk) { if (now < a.atk.until) return; a.atk = null; }
  if (now < a.next || !here.some((b) => dist(b.x, b.z, a.x, a.z) <= BEARER_PULSE_NEAR)) return;
  const B = HOST_BLOWS[HOST.bearer];
  a.atk = { at: now + B.windup, x: a.x, z: a.z, until: now + B.windup + B.active + B.recover };
  a.next = now + BEARER_PULSE_MS;
  blows.push([a.i, a.atk.at, a.x, a.z]);
}
const hostHealthKey = (H) => H.ads.map((a) => `${a.i}:${Math.ceil(a.h)}`).join(',');
/** The host's health, at most every HP_SEND_MS, when it has moved (`ah` - every one standing). */
function hostHpFrame(f, now, out) {
  const H = f.lg;
  if (!H || now - (H.hSentAt ?? 0) < HP_SEND_MS) return;
  const key = hostHealthKey(H);
  if (key === H.hSent) return;
  H.hSent = key; H.hSentAt = now;
  if (H.ads.length) out.push({ k: 'ah', h: H.ads.map((a) => [a.i, Math.ceil(a.h)]) });
}
/**
 * WB11b: HIS HOST'S BEAT - under the Legion-Lord alone: nothing of it runs, rolls or is said in any other fight. Each one
 * standing carried to `now`; a wave due rises (the Harriers' in the first phase and court; the Sappers' in the second,
 * once its turn is done and his ward is down); each Harrier at its mark and its Bite, each Sapper at him (drunk on
 * reaching him), each Ward-Bearer's Pulse at whoever comes near; the beat's walks and blows one word each (`amv`,
 * `aatk`), the health as it falls (`ah`). `here` the living challengers in his court.
 */
function stepHost(f, now, here, rng, out, P) {
  if (!P.legion || f.fell || f.wrath) return;
  const H = (f.lg ??= newHost());
  const C = hisCourt(f);
  for (const a of H.ads) if (a.mv) { const [x, z] = hostAt(a, now); a.x = x; a.z = z; }
  const levels = () => here.map((b) => f.players[b.sub].lv);
  if (f.phase === 1 && f.court === 0) {
    if (!H.harryAt) H.harryAt = f.startedAt + HARRY_FIRST_MS;
    if (now >= H.harryAt && here.length) {
      const n = Math.min(harrierCountFor(here.length), HARRIERS_MAX - H.ads.filter((a) => a.k === HOST.harrier).length);
      const spots = n > 0 ? rimSpots(C, n, here, rng) : [];
      // AUDIT WB11 B1: a rim with no clear spot holds the wave a beat (it asks again), never raises it beside them
      if (n <= 0 || spots.length) { H.harryAt = now + HARRY_EVERY_MS; if (spots.length) raiseHost(f, HOST.harrier, spots, harrierHpFor(levels()), now, out); }
    }
  }
  if (f.phase === 2 && f.court === 1 && !f.pending && !f.queue.length && now >= f.shieldUntil) {
    if (!H.sapAt) H.sapAt = now + SAP_FIRST_MS;
    else if (now >= H.sapAt && here.length) {
      const n = Math.min(sapperCountFor(here.length), SAPPERS_MAX - H.ads.filter((a) => a.k === HOST.sapper).length);
      // the rim's far side from him: from where he stands through the court's heart (behind him, when he stands on it)
      const away = dist(f.pos[0], f.pos[1], C[0], C[1]) < 1 ? f.yaw + Math.PI : Math.atan2(C[0] - f.pos[0], C[1] - f.pos[1]);
      const clear = (x, z) => dist(x, z, f.pos[0], f.pos[1]) >= SAP_FROM_HIM && !here.some((b) => dist(b.x, b.z, x, z) < SAP_SPAWN_CLEAR);
      const spots = n > 0 ? rimSpots(C, n, here, rng, away, SAP_SPREAD, clear) : [];
      // AUDIT WB11 B1: held a beat on a rim with no clear spot; fewer risen share the wave's whole health
      if (n <= 0 || spots.length) { H.sapAt = now + SAP_EVERY_MS; if (spots.length) raiseHost(f, HOST.sapper, spots, hostTeamHpFor(SAPPER_TEAM_S, levels(), spots.length), now, out); }
    }
  }
  const moves = [], blows = [];
  for (const a of [...H.ads]) {
    if (now < (a.up ?? 0)) continue;   // still rising out of the fire
    if (a.k === HOST.harrier) harrierBeat(f, a, now, here, C, moves, blows);
    else if (a.k === HOST.sapper) sapperBeat(f, a, now, C, moves, out, P);
    else if (a.k === HOST.bearer) bearerBeat(a, now, here, blows);   // WB14e: a Tithe-Imp beside them steps its own way (stepTithe)
  }
  if (moves.length) out.push({ k: 'amv', m: moves });
  if (blows.length) out.push({ k: 'aatk', a: blows });
  hostHpFrame(f, now, out);
}

// ── WB14c: THE VANGUARD ─────────────────────────────────────────────────
/** WB14c (2026-10-19, Mac: "the chance of a gate to spawn with platforms of wave based adds that need to be defeated before
 *  encountering the boss"; bible/11-Multiplayer/Breach-Portents.md section 4): the Vanguard's beat. Its first wave rises
 *  VG_OPEN_MS after a fighter stands on the Bridgehead; each next one when VG_WAVE_LEFT of the last or fewer still stand,
 *  or VG_WAVE_MAX_MS after it rose - a wave due with nobody on its platform waits for somebody. A wave's health is its team
 *  seconds of the platform's living challengers' whole reference damage (the crystals' law), shared over its bodies by
 *  kind (VG_KIND_W); vanguardCountFor of them, VG_STANDING_MAX standing at most. */
export const VG_OPEN_MS = 6000;
export const VG_WAVE_MAX_MS = 30_000;
export const VG_WAVE_LEFT = 0.25;
export const vanguardCountFor = (n) => Math.max(3, Math.min(10, 2 + Math.ceil(Math.max(0, n) / 2)));
/** A body's share of its wave's health, by kind (the Imp's one - WB11's three take none here). */
export const VG_KIND_W = Object.freeze([1, 0, 0, 2.5, 1.5, 6]);
/** THE STAGES - each its platform (FLOOR), the walkway its clearing lays (WALKWAY) and its three waves, each its kinds (dealt
 *  round its count in turn) and its team seconds; the Muster's last its lord (the Markynaz, and Imps for the rest). */
const vgWave = (kinds, s, lord = false) => Object.freeze({ kinds: Object.freeze(kinds), s, lord });
export const VG_STAGES = Object.freeze([
  Object.freeze({ floor: FLOOR.bridgehead, walk: WALKWAY.muster, waves: Object.freeze([vgWave([HOST.harrier], 7), vgWave([HOST.harrier, HOST.brute], 9), vgWave([HOST.brute, HOST.caster], 10)]) }),
  Object.freeze({ floor: FLOOR.muster, walk: WALKWAY.warden, waves: Object.freeze([vgWave([HOST.caster, HOST.harrier], 10), vgWave([HOST.brute, HOST.caster, HOST.harrier], 11), vgWave([HOST.harrier], 14, true)]) }),
]);
/** AUDIT WB14 (PLAY-4): ON A VANGUARD NIGHT HIS HEALTH IS LESS ITS VANGUARD'S - the waves' team seconds (61) off his
 *  BOSS_TTK_S (240), each share that much smaller: the Vanguard's two and a half minutes left a lone fighter at half the
 *  reference short of his midnight on two nights in six, and a Dire Breach on three. */
export const VG_TEAM_S = VG_STAGES.reduce((s, S) => s + S.waves.reduce((q, W) => q + W.s, 0), 0);
export const VG_SHARE_X = (BOSS_TTK_S - VG_TEAM_S) / BOSS_TTK_S;
/** HIS PATIENCE: a Vanguard still standing VG_PATIENCE_MS after its first wave, he throws a Meteor of Oblivion from his
 *  court onto a living fighter on the platforms every VG_PATIENCE_EVERY_MS - a clock that keeps a stalled court moving. */
export const VG_PATIENCE_MS = 240_000;
export const VG_PATIENCE_EVERY_MS = 15_000;
/** The Markynaz calls VG_CALL_N Imps out of the fire every VG_CALL_MS; a Brute and the Markynaz strike within their reach
 *  of a fighter (VG_MELEE_REACH past their body); a Caster keeps VG_CASTER_KEEP from the nearest fighter and Bolts one
 *  within VG_CASTER_REACH every VG_CASTER_EVERY_MS. */
export const VG_CALL_MS = 15_000;
export const VG_CALL_N = 2;
export const VG_MELEE_REACH = 1.4;
export const VG_CASTER_KEEP = Object.freeze([10, 16]);
export const VG_CASTER_REACH = 22;
export const VG_CASTER_EVERY_MS = 5000;
/** The Vanguard's words on the wire (`vgw`'s `e`): a wave risen, a platform cleared, the Markynaz risen, the Vanguard
 *  broken, his patience, his opening. */
export const VG_WORD = Object.freeze({ wave: 0, clear: 1, lord: 2, broken: 3, patience: 4, open: 5 });
/** A Vanguard night's record: its stage (0 the Bridgehead, 1 the Muster, VG_STAGES.length broken), the waves risen in it,
 *  when the next is due, when the last rose and how many, when the first of all rose, his next patience, the Markynaz's
 *  number and his next call, and whether his opening has begun. */
export const newVanguard = () => ({ s: 0, w: 0, due: 0, rose: 0, last: 0, first: 0, pat: 0, said: false, lord: 0, call: 0, opened: false });   // AUDIT WB14 (RECORD-9): `said`, his patience's word
/** When his opening began (null while his Vanguard holds - a fight checkpointed before WB14c: its birth). */
export const openedAt = (f) => (f?.vg && !f.vg.opened ? null : f?.openAt ?? f?.startedAt ?? null);
/** Does a Vanguard still hold him? */
export const vanguardHolds = (f) => !!f?.vg && !f.vg.opened;

/** A Brute's or the Markynaz's beat: a blow in flight runs out; the nearest fighter on its platform struck within reach,
 *  else walked at. */
function vgMeleeBeat(a, now, on, C, moves, blows) {
  if (a.atk) { if (now < a.atk.until) return; a.atk = null; }
  let mark = null;
  for (const b of on) if (!mark || dist(b.x, b.z, a.x, a.z) < dist(mark.x, mark.z, a.x, a.z)) mark = b;
  if (!mark) { stopHost(a, now, moves); return; }
  const K = HOST_KINDS[a.k], B = HOST_BLOWS[a.k];
  if (dist(a.x, a.z, mark.x, mark.z) - K.r <= VG_MELEE_REACH) {
    stopHost(a, now, moves);
    a.atk = { at: now + B.windup, x: a.x, z: a.z, until: now + B.windup + B.active + B.recover };
    blows.push([a.i, a.atk.at, a.x, a.z]);
    return;
  }
  walkHost(a, mark.x, mark.z, K.r + 0.6, now, C, moves);
}
/** A Caster's beat: a Bolt in flight runs out; one due falls at the feet of the nearest fighter within reach (where they
 *  stand at its word); otherwise it keeps its distance - away from one too near, toward one too far. */
function vgCasterBeat(a, now, on, C, moves, blows) {
  if (a.atk) { if (now < a.atk.until) return; a.atk = null; }
  let mark = null;
  for (const b of on) if (!mark || dist(b.x, b.z, a.x, a.z) < dist(mark.x, mark.z, a.x, a.z)) mark = b;
  if (!mark) { stopHost(a, now, moves); return; }
  const d = dist(a.x, a.z, mark.x, mark.z), B = HOST_BLOWS[HOST.caster];
  if (now >= a.next && d <= VG_CASTER_REACH) {
    stopHost(a, now, moves);
    a.atk = { at: now + B.windup, x: r2(mark.x), z: r2(mark.z), until: now + B.windup + B.active + B.recover };
    a.next = now + VG_CASTER_EVERY_MS;
    blows.push([a.i, a.atk.at, a.atk.x, a.atk.z]);
    return;
  }
  if (d < VG_CASTER_KEEP[0] && d > 1e-6) walkHost(a, a.x + ((a.x - mark.x) / d) * 6, a.z + ((a.z - mark.z) / d) * 6, 0, now, C, moves);
  else if (d > VG_CASTER_KEEP[1]) walkHost(a, mark.x, mark.z, VG_CASTER_KEEP[1] - 2, now, C, moves);
  else stopHost(a, now, moves);
}
/** A Vanguard wave risen on its platform C: `W`'s kinds dealt round vanguardCountFor(the fighters on it), the standing cap
 *  kept; each body's health its kind's share of the wave's team seconds. Answers how many rose. */
function vgRaise(f, W, C, on, now, rng, out) {
  const H = f.lg;
  const n = Math.min(vanguardCountFor(on.length), VG_STANDING_MAX - H.ads.length);
  const spots = n > 0 ? rimSpots(C, n, on, rng) : [];
  if (!spots.length) return 0;
  const kinds = spots.map((_, i) => (W.lord ? (i === 0 ? HOST.markynaz : HOST.harrier) : W.kinds[i % W.kinds.length]));
  const total = W.s * on.reduce((s, b) => s + dpsRef(f.players[b.sub].lv), 0), wsum = kinds.reduce((s, k) => s + VG_KIND_W[k], 0);
  for (const k of new Set(kinds)) {
    const mine = spots.filter((_, i) => kinds[i] === k);
    raiseHost(f, k, mine, Math.max(HOST_HP_MIN, Math.round((total * VG_KIND_W[k]) / Math.max(1e-9, wsum))), now, out);
    if (k === HOST.markynaz) { f.vg.lord = H.n; f.vg.call = now + VG_CALL_MS; }
  }
  for (const a of H.ads) if (a.k === HOST.caster && a.next === now) a.next = now + 1500;   // a Caster's first Bolt a breath after it has risen
  return spots.length;
}
/**
 * WB14c: THE VANGUARD'S BEAT - true while it holds him (he waits in his court; the beat says only his health and his
 * state). Its bodies carried and stepped (the Imps WB11's Harriers, at the fighter farthest from him; a Brute and the
 * Markynaz at the nearest; a Caster at its distance), its waves raised on the platform they are due on, a platform
 * cleared laying the walkway onward (`vgw`, its walkway and moment beside it: every screen lays it at once), the
 * Markynaz's fall crumbling his Imps and breaking the Vanguard, his patience's meteors, and - broken - his opening as the
 * first challenger stands in his court.
 */
function stepVanguard(f, now, bodies, rng, out, P) {
  const V = f.vg;
  if (!V || V.opened || f.fell || f.wrath) return false;
  const H = (f.lg ??= newHost());
  for (const a of H.ads) if (a.mv) { const [x, z] = hostAt(a, now); a.x = x; a.z = z; }
  if (f.atk && now >= f.atk.until) {   // his patience's meteor spent
    const was = f.atk;
    f.atk = null; f.nextAt = now + BREATH_MS;
    // AUDIT WB14 (LAW-7): ECHOING's law here too - it falls again a breath on, on the one it fell for where they stand now
    // on the platforms, else where the first fell (bodyBeat's echo; an echo has none of its own)
    if (P.echo && !was.echo && ATTACK_BY_ID[was.a] === ATTACKS.meteor) f.pending = { a: 'meteor', echo: true, who: was.who ?? null, point: was.tg?.[0] ?? null };
  }
  const living = bodies.filter((b) => !b.dead && f.players[b.sub]);
  if (V.s >= VG_STAGES.length) {
    if (!living.some((b) => inCourt(b.x, b.z, FLOOR.first, POSE_SLACK))) return true;
    // broken, and a challenger before him: his opening begins - his wake OPENING_MS from now, said at once
    V.opened = true;
    f.openAt = now; f.nextAt = now + OPENING_MS; f.lastStateAt = -Infinity;
    if (f.pending?.echo) f.pending = null;   // AUDIT WB14 (LAW-7): an echo of his patience is the platforms', never his court's
    out.push({ k: 'vgw', e: VG_WORD.open, s: V.s, w: 0, at: now });
    return false;
  }
  const S = VG_STAGES[V.s], C = COURTS[S.floor];
  const on = living.filter((b) => inCourt(b.x, b.z, S.floor, POSE_SLACK));
  // the Markynaz down: his Imps crumble with him
  if (V.lord && !H.ads.some((a) => a.i === V.lord)) { V.lord = 0; hostGone(f, now, out, HOST_GONE.crumbled, (a) => a.k === HOST.harrier); }
  if (V.w < S.waves.length) {
    if (V.w === 0 && !V.due && on.length) V.due = now + VG_OPEN_MS;
    const due = V.w === 0 ? V.due > 0 && now >= V.due : H.ads.length <= Math.floor(V.last * VG_WAVE_LEFT) || now >= V.rose + VG_WAVE_MAX_MS;
    if (due && on.length) {
      const W = S.waves[V.w], n = vgRaise(f, W, C, on, now, rng, out);
      if (n > 0) {
        V.w++; V.rose = now; V.last = n;
        if (!V.first) { V.first = now; V.pat = now + VG_PATIENCE_MS; }
        out.push({ k: 'vgw', e: VG_WORD.wave, s: V.s, w: V.w, at: now });
        if (W.lord) out.push({ k: 'vgw', e: VG_WORD.lord, s: V.s, w: V.w, at: now });
      }
    }
  } else if (!H.ads.length) {
    // the platform cleared: the walkway onward rises (WB9b's slabs, its law of the laid floor)
    f.xa = [...(Array.isArray(f.xa) ? f.xa : [])];
    if (!Number.isFinite(f.xa[S.walk])) f.xa[S.walk] = now;
    out.push({ k: 'vgw', e: V.s === VG_STAGES.length - 1 ? VG_WORD.broken : VG_WORD.clear, s: V.s, w: V.w, x: S.walk, at: f.xa[S.walk] });
    V.s++; V.w = 0; V.due = 0; V.last = 0; V.rose = 0;
    f.lastStateAt = -Infinity;   // the state says the crossing at once
    return true;
  }
  // the Markynaz calls his Imps
  if (V.lord && now >= V.call) {
    V.call = now + VG_CALL_MS;
    const lord = H.ads.find((a) => a.i === V.lord), room = VG_STANDING_MAX - H.ads.length;
    if (lord && room > 0 && on.length) {
      const spots = rimSpots(C, Math.min(VG_CALL_N, room), on, rng, Math.atan2(lord.x - C[0], lord.z - C[1]), Math.PI / 3);
      if (spots.length) raiseHost(f, HOST.harrier, spots, harrierHpFor(on.map((b) => f.players[b.sub].lv)), now, out);
    }
  }
  // his patience: a meteor from his court on a fighter out on the platforms
  const out1 = V.first ? living.filter((b) => VG_STAGES.some((g) => inCourt(b.x, b.z, g.floor, POSE_SLACK))) : [];
  if (f.pending?.echo && !f.atk && now >= f.nextAt) {   // AUDIT WB14 (LAW-7): its echo
    const e = f.pending, who = out1.find((b) => b.sub === e.who) ?? null, at = who ? [who.x, who.z] : e.point;
    f.pending = null;
    if (at) begin(f, ATTACKS.meteor, now, null, out1, rng, out, at, true);
  }
  if (V.first && now >= V.pat && !f.atk) {
    if (out1.length) {
      if (!V.said) { V.said = true; out.push({ k: 'vgw', e: VG_WORD.patience, s: V.s, w: V.w, at: now }); }   // AUDIT WB14 (RECORD-9): said with the first that falls - a beat nobody stood out for kept no word
      const who = out1[Math.floor(rng() * out1.length) % out1.length];
      begin(f, ATTACKS.meteor, now, null, out1, rng, out, [who.x, who.z]);
      f.atk.who = who.sub;   // (the one its echo falls for)
    }
    V.pat = now + VG_PATIENCE_EVERY_MS;
  }
  const moves = [], blows = [];
  for (const a of [...H.ads]) {
    if (a.up > now) continue;   // its rising (WB11's law)
    if (a.k === HOST.harrier) harrierBeat(f, a, now, on, C, moves, blows);
    else if (a.k === HOST.caster) vgCasterBeat(a, now, on, C, moves, blows);
    else vgMeleeBeat(a, now, on, C, moves, blows);
  }
  if (moves.length) out.push({ k: 'amv', m: moves });
  if (blows.length) out.push({ k: 'aatk', a: blows });
  hostHpFrame(f, now, out);
  return true;
}

// ── WB14e: THE TITHE-IMP (section 9) ──────────────────────────────────────────────────────────────────────────────
/** WB14e (2026-10-19, Mac: "And whatever else you can cook up"): one night in five (net/gate/gateLaw.js gateTitheOf - not in
 *  the omen: the arc's one surprise, and it costs nobody anything), its moment after his wake, while he is in his first or
 *  second phase and a challenger stands before him, a Tithe-Imp rises at his court's rim farthest from him and runs from
 *  the nearest challenger (HOST_KINDS' 6.2 m/s, under a runner's 7.6), until it dives into the fire TITHE_LIFE_MS after it
 *  rose (or as his phase turns). Its health is TITHE_S of the court's mean reference damage: a few blows. Caught, each
 *  challenger who struck it is handed its tithe - a seed of the relay's own (`tithe`, to that account alone). */
export const TITHE_LIFE_MS = 22_000;
export const TITHE_S = 10;   // AUDIT WB14 (PLAY-6): ten seconds of a fighter's reference - a solo's chase about 12 s, four chasers' 5
/** How far ahead of the nearest challenger it runs for, and how near the rim's edge that run counts as cornered (it runs
 *  along the rim then, the way that leaves the chaser farther behind). */
export const TITHE_FLEE_M = 8;
export const TITHE_CORNER_M = 2;
/** Its health for the levels of the challengers in his court. Pure. */
export const titheHpFor = (lvs) => Math.max(HOST_HP_MIN, Math.round(lvs.length ? (TITHE_S * lvs.reduce((s, lv) => s + dpsRef(lv), 0)) / lvs.length : 0));

/** The Tithe-Imp's beat: risen once at its moment, gone into the fire past its life (or as he leaves its court), and
 *  between, running. AUDIT WB14 (LAW-2): it rises in the court he stands in - never while he is in the air between two -
 *  and keeps to it (`ct`): he bounds out of it (a phase's turn, the Sundering's halves going to their courts, the
 *  Rejoining's) and it dives into the fire, never running over it after him. */
function stepTithe(f, now, here, rng, out, P) {
  if (!Number.isSafeInteger(f.ti) || f.fell || f.wrath) return;
  const T = (f.tt ??= {});
  if (!T.at) {
    const woke = openedAt(f);
    if (!Number.isFinite(woke) || now < woke + OPENING_MS + f.ti || f.phase > 2 || !here.length || f.sd?.rj || f.atk?.a === ATTACKS.cross.id) return;
    const C = hisCourt(f), away = dist(f.pos[0], f.pos[1], C[0], C[1]) < 1 ? f.yaw + Math.PI : Math.atan2(C[0] - f.pos[0], C[1] - f.pos[1]);
    const spots = rimSpots(C, 1, here, rng, away, SAP_SPREAD);
    if (!spots.length) return;   // a rim with no clear spot: asked again a beat on
    const H = (f.lg ??= newHost());
    raiseHost(f, HOST.tithe, spots, titheHpFor(here.map((b) => f.players[b.sub].lv)), now, out);
    T.at = now; T.i = H.n; T.ct = f.court | 0;
    return;
  }
  const a = f.lg?.ads.find((o) => o.k === HOST.tithe) ?? null;
  if (!a) return;
  const ct = Number.isInteger(T.ct) ? T.ct : f.court | 0, C = COURTS[ct];   // (a fight checkpointed before the audit: his court as it was)
  if (now >= T.at + TITHE_LIFE_MS || ct !== (f.court | 0)) { hostGone(f, now, out, HOST_GONE.fled, (o) => o === a); return; }
  if (a.mv) { const [x, z] = hostAt(a, now); a.x = x; a.z = z; }
  if (now < (a.up ?? 0)) return;
  const moves = [];
  titheBeat(a, now, here, C, moves);
  if (moves.length) out.push({ k: 'amv', m: moves });
  if (!P.legion) hostHpFrame(f, now, out);   // under the Legion-Lord his host's beat says it with theirs
}
/** AUDIT WB14 (LAW-5, WIRE-4): A TITHE OWED PAID - a seed of the relay's dice to each who struck the Imp (`tithe`, to that
 *  account alone), once. Paid at the catch (applyHostHit, given the dice), else first thing the next beat - before the
 *  kill's or the Wrath's return, so a catch in the last beat before either is paid all the same. */
function payTithe(f, now, rng, out) {
  const T = f.tt;
  if (!T?.by || T.paid || typeof rng !== 'function') return;
  T.paid = true; T.c = {};
  for (const sub of T.by) { const c = Math.floor(rng() * 0x100000000) >>> 0; T.c[sub] = c; out.push({ k: 'tithe', to: sub, c, at: now }); }
}
/** It runs from the nearest challenger in his court - straight away, or along the rim when the rim stops it. */
function titheBeat(a, now, here, C, moves) {
  let near = null;
  for (const b of here) if (!near || dist(b.x, b.z, a.x, a.z) < dist(near.x, near.z, a.x, a.z)) near = b;
  if (!near) { stopHost(a, now, moves); return; }
  const d = dist(a.x, a.z, near.x, near.z) || 1, ux = (a.x - near.x) / d, uz = (a.z - near.z) / d;
  let [gx, gz] = keepInCourt(a.x + ux * TITHE_FLEE_M, a.z + uz * TITHE_FLEE_M, HOST_RIM_R, C);
  if (dist(gx, gz, a.x, a.z) < TITHE_CORNER_M) {
    const left = keepInCourt(a.x - uz * TITHE_FLEE_M, a.z + ux * TITHE_FLEE_M, HOST_RIM_R, C);
    const right = keepInCourt(a.x + uz * TITHE_FLEE_M, a.z - ux * TITHE_FLEE_M, HOST_RIM_R, C);
    [gx, gz] = dist(left[0], left[1], near.x, near.z) >= dist(right[0], right[1], near.x, near.z) ? left : right;
  }
  walkHost(a, gx, gz, 0, now, C, moves);
}

// ── WB14f: THE CAPTIVE (section 7) ────────────────────────────────────────────────────────────────────────────────
/** WB14f (2026-10-19, Mac: "And whatever else you can cook up"): ON A CAPTIVE NIGHT a knight of the Covenant kneels at the
 *  Pen's heart (who he is - net/gate/gateLaw.js captiveNameOf - is the screens'; the relay knows his gaolers). At his wake the
 *  walkway to the Pen rises (WALKWAY.pen), and as the first living challenger stands in the Pen his gaolers rise (AUDIT WB14
 *  LAW-8: sized then, for the fight's living challengers - at his wake the fight is the first few to come):
 *  bearerCountFor(them) on a ring CAPTIVE_RING_R about the Pen's heart, BEARER_TEAM_S of their reference damage shared over
 *  them (the Ward-Bearers' law), each Pulsing at whoever comes near. The last one down, he is free (`cpf`), and the next Dagon's Reckoning to land lands on
 *  the Covenant's ward and on no fighter (`cpw` at its word - or at once, for one still winding up as he goes free): the
 *  relay's judge and every screen spare it, and its crystals still break for the stun. A Reckoning broken before it lands
 *  leaves the ward for the next; it is spent once. Gaolers outlive his phases' turns (their Pen is no court of his). */
export const CAPTIVE_RING_R = 7;
/** A night's captive: when he was laid in the Pen (his wake - the walkway's moment) and how many gaolers rose, when he went
 *  free, the number of the Reckoning his ward takes (0 none yet) and when that one landed on it - each 0 until it comes. */
export const newCaptive = () => ({ at: 0, n: 0, f: 0, w: 0, s: 0 });
/** Does the Covenant's ward take `atk` - the Reckoning its `w` names? `cp` the fight's or a state's (net/gate/gateLink.js).
 *  Pure. */
export const wardTakes = (cp, atk) => !!cp && !!atk && cp.w > 0 && atk.i === cp.w && atk.a === ATTACKS.reckon.id;
/** Is the ward spent at `now` - said so (`s`), or the Reckoning it takes landed? Pure. */
export const captiveSpent = (cp, atk, now) => !!cp && (cp.s > 0 || (wardTakes(cp, atk) && now >= atk.at));
/** Those of his host a phase's turn crumbles - all but the Captive's gaolers. */
const notGaoler = (a) => a.k !== HOST.gaoler;

/** The Captive's beat: the walkway to the Pen at his wake, his gaolers risen as the first challenger stands in it, their
 *  Pulses while they stand, his freeing as the last falls, and his ward spent as the Reckoning it takes lands. */
function stepCaptive(f, now, bodies, rng, out) {
  const K = f.cp;
  if (!K || f.fell || f.wrath) return;
  if (!K.at) {
    const woke = openedAt(f);
    if (!Number.isFinite(woke) || now < woke + OPENING_MS) return;
    f.xa = [...(Array.isArray(f.xa) ? f.xa : [])];
    if (!Number.isFinite(f.xa[WALKWAY.pen])) f.xa[WALKWAY.pen] = now;
    K.at = now;
    f.lastStateAt = -Infinity;   // the state says the walkway at once
    return;
  }
  const living = bodies.filter((b) => !b.dead && f.players[b.sub]);
  if (!K.n) {
    if (!living.some((b) => inCourt(b.x, b.z, FLOOR.pen, POSE_SLACK))) return;
    const n = bearerCountFor(living.length), C = COURTS[FLOOR.pen], a0 = rng() * 2 * Math.PI, spots = [];
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * 2 * Math.PI; spots.push([r2(C[0] + Math.sin(a) * CAPTIVE_RING_R), r2(C[1] + Math.cos(a) * CAPTIVE_RING_R)]); }
    f.lg ??= newHost();
    raiseHost(f, HOST.gaoler, spots, hostTeamHpFor(BEARER_TEAM_S, living.map((b) => f.players[b.sub].lv), n), now, out);
    K.n = n;
    f.lastStateAt = -Infinity;
    return;
  }
  if (!K.f) {
    const gaolers = f.lg?.ads.filter((a) => a.k === HOST.gaoler) ?? [];
    if (gaolers.length) {
      for (const a of gaolers) if (a.mv) { const [x, z] = hostAt(a, now); a.x = x; a.z = z; }
      const near = living.filter((b) => inCourt(b.x, b.z, FLOOR.pen, POSE_SLACK)), blows = [];
      for (const a of gaolers) if (now >= (a.up ?? 0)) bearerBeat(a, now, near, blows);
      if (blows.length) out.push({ k: 'aatk', a: blows });
      hostHpFrame(f, now, out);
      return;
    }
    K.f = now;
    out.push({ k: 'cpf', at: now });
    f.lastStateAt = -Infinity;
    if (reckonOpen(f, now)) captiveWard(f, now, out);   // a Reckoning still winding up as he goes free: the ward takes it
  }
  if (!K.s && wardTakes(K, f.atk) && now >= f.atk.at) { K.s = f.atk.at; f.lastStateAt = -Infinity; }
}
/** The Covenant's ward given to the Reckoning in flight - the knight free, the ward neither spent nor given (`cpw`). */
function captiveWard(f, now, out) {
  const K = f.cp;
  if (!K || !K.f || K.s || K.w || f.atk?.a !== ATTACKS.reckon.id) return;
  K.w = f.atk.i;
  out.push({ k: 'cpw', i: K.w, at: now });
}

// ── WB14d: THE SUNDERING, ITS LAWS (section 5) ─────────────────────────────────────────────────────────────────────
/** The keys of the attacks a body may begin - every one while he is whole (null), its own kit's while sundered (SUNDER_KITS). */
const kitOf = (f) => (f.sd ? SUNDER_KITS[f.half === HALF.flame ? HALF.flame : HALF.blade] : null);
/** The Flame's own body: every field its beat moves (the rest of the fight its view reads through to him). */
const FLAME_KEYS = Object.freeze(['pos', 'yaw', 'court', 'move', 'atk', 'lastA', 'runA', 'freeAt', 'nextAt', 'target', 'targetAt', 'queue', 'pending', 'waitUntil', 'shieldUntil', 'stunUntil', 'used', 'threat']);
/** The words of the Flame's beat that name their body (`b`). */
const FLAME_WORDS = new Set(['atk', 'mv', 'ph']);

/** THE FLAME'S VIEW OF THE FIGHT: the fight underneath (its phase, its fighters, its marks and portents, the halves), the
 *  Flame's body over it (FLAME_KEYS), and the count of attacks and the walkways laid read and written through to the fight
 *  - one count of attack numbers, one floor. Its beat moves the view; keepFlame writes the body back. */
function flameView(f) {
  const V = Object.create(f, {
    seq: { get: () => f.seq, set: (v) => { f.seq = v; } },
    xa: { get: () => f.xa, set: (v) => { f.xa = v; } },
  });
  for (const k of FLAME_KEYS) V[k] = f.sd.fl[k];
  V.half = HALF.flame;
  return V;
}
function keepFlame(f, V) { for (const k of FLAME_KEYS) f.sd.fl[k] = V[k]; }

/** THE SUNDERING'S END: he tears in two. The layout is the living challengers in the room's (SUNDER_SPLIT_MIN); the pools
 *  what he stands at above SUNDER_LAST, half each (a fraction of his whole); the Flame rises where he stands; each half has
 *  its turn (its bound, its wait, its signature as its ward breaks - the Blade a Ground Slam, the Flame a Flame Nova); and
 *  the state is said at once, the halves in it, before any word of the Flame's. */
function sunder(f, now, bodies) {
  const two = bodies.filter((b) => !b.dead && f.players[b.sub]).length >= SUNDER_SPLIT_MIN;
  const m = Math.max(0, standsAt(f) - SUNDER_LAST) / 2, C = COURTS[FLOOR.second];
  const side = (k) => [C[0] + k * SUNDER_SIDE_M, C[1]];
  f.queue = [two ? { a: 'cross', court: FLOOR.second } : { a: 'cross', court: FLOOR.second, at: side(-1) }, { wait: 'arrive' }, { a: 'slam' }];
  const turn = [two ? { a: 'cross', court: FLOOR.third, walk: WALKWAY.rift } : { a: 'cross', court: FLOOR.second, at: side(1) }, { wait: 'arrive' }, { a: 'nova' }];
  f.sd = {
    two, m, at: now, rj: 0, hSent: '', hAt: 0,
    bl: { h: m, kn: 0, said: false, lone: null, mend: false },
    fl: { h: m, kn: 0, said: false, lone: null, mend: false, pos: [f.pos[0], f.pos[1]], yaw: f.yaw, court: f.court, move: null, atk: null, lastA: -1, runA: 0,
      freeAt: now, nextAt: now + TURN_BREATH_MS, target: null, targetAt: 0, queue: turn.slice(1), pending: turn[0], waitUntil: 0,
      shieldUntil: f.shieldUntil, stunUntil: 0, used: {}, threat: {} },
  };
  f.lastStateAt = -Infinity;   // said this beat - before any word of the Flame's (its first is a beat on)
}

/** THE REJOINING'S END: he stands whole - the halves gone into him, the last phase begun in the first court (its ward, its
 *  wait for a challenger, its signature: the Spokes, then the four between), the state said this beat. */
function whole(f, now, out) {
  f.sd = null;
  f.phase = 3;
  f.shieldUntil = now + CROSS_WARD_MAX_MS;
  out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
  f.queue = PHASE_TURN[3].slice(1).map((e) => ({ ...e }));   // the turn's wait and signature - he already stands in his last court
  f.lastStateAt = -Infinity;
}

/** A HALF BROUGHT DOWN KNEELS: its pool spent, its blow and its walk dropped where they stand (a kneel mid-charge kneels
 *  where the charge has carried it), SUNDER_PAIR_MS of its stun - said by the next beat (`kn`). */
function kneel(f, b, now) {
  const H = b ? f.sd.fl : f.sd.bl;
  H.h = 0; H.kn = now; H.said = false; H.lone = null; H.mend = false;
  if (b) { const V = flameView(f); settleAt(V, now); keepFlame(f, V); } else settleAt(f, now);
  const B = b ? f.sd.fl : f;
  if (B.atk?.a !== ATTACKS.wrath.id) B.atk = null;   // AUDIT WB14 (LAW-4): the Wrath is the clock's - a Blade kneeling under its wind-up keeps it
  B.move = null; B.target = null; B.queue = []; B.pending = null;
  B.stunUntil = now + SUNDER_PAIR_MS;
}

/** THE PAIR LAW BROKEN: a half knelt past SUNDER_PAIR_MS rises (`kr`) level with the other - SUNDER_RISE of its pool at
 *  most, SUNDER_RISE_MIN at least (AUDIT WB14 PLAY-1) - and the court tries again, the two halves now even. */
function rise(f, b, now, out) {
  const S = f.sd, H = b ? S.fl : S.bl, B = b ? S.fl : f, O = b ? S.bl : S.fl;
  H.kn = 0; H.said = false;
  H.h = Math.min(SUNDER_RISE * S.m, Math.max(O.h, SUNDER_RISE_MIN * S.m));
  credit(f, H.h);
  B.stunUntil = 0;
  B.nextAt = now + BREATH_MS;
  out.push({ k: 'kr', b, h: Math.round(H.h * f.max), at: now });
}

/** BOTH KNELT: they rise to rejoin (`rj`) - each warded, each bounding back to the first court (the Blade to its heart, the
 *  Flame beside it), where the Blade calls the Rejoining; he stands at SUNDER_LAST from now. */
function rejoin(f, now, out) {
  const S = f.sd, C = COURTS[FLOOR.first];
  S.rj = now;
  for (const H of [S.bl, S.fl]) { H.h = 0; H.kn = 0; H.said = false; H.lone = null; H.mend = false; }
  f.hp = f.max * SUNDER_LAST;
  if (!(f.max > 0)) f.idle = SUNDER_LAST;   // AUDIT WB14 (LAW-3)
  for (const B of [f, S.fl]) { B.stunUntil = 0; B.atk = null; B.move = null; B.target = null; B.shieldUntil = now + CROSS_WARD_MAX_MS; B.nextAt = now + TURN_BREATH_MS; }
  f.pending = { a: 'cross', court: FLOOR.first };
  f.queue = [{ a: 'rejoin' }];
  S.fl.pending = { a: 'cross', court: FLOOR.first, at: [C[0] + SUNDER_SIDE_M, C[1]] };
  S.fl.queue = [];
  out.push({ k: 'rj', at: now });
  f.lastStateAt = -Infinity;   // AUDIT WB14 (WIRE-3): and the state this beat - each half's ward is in it, never in the word
}

/** AUDIT WB14 (LAW-3): a half's pool grown by `add` (a fraction of his whole) is his health grown by as much - and with
 *  every share out of the fight (`max` 0) the fraction he stands at, so the court come back finds his health its pools'. */
function credit(f, add) {
  if (f.max > 0) f.hp += add * f.max;
  else f.idle = (Number.isFinite(f.idle) ? f.idle : 1) + add;
}

/** WB8b's SOUL-HUNGRY under the Sundering: a feeding heals each standing half by half its share, never past its pool (his
 *  whole, once they go to rejoin). */
function sunderFed(f, feed) {
  const S = f.sd;
  if (S.rj) { f.hp = Math.min(f.max, f.hp + feed * f.max); return; }
  for (const H of [S.bl, S.fl]) {
    if (H.kn) continue;
    const add = Math.min(Math.max(0, S.m - H.h), feed / 2);
    H.h += add;
    credit(f, add);
  }
}

/**
 * THE HALVES' LAWS, each beat while he is sundered (`dt` the beat's span): a kneel said; both knelt and they rejoin; a
 * kneel past the pair law rises; a half with nobody living in its court SUNDER_LONE_MS mends (the split layout alone);
 * the Flame's threat forgets as his does; and the Flame's own beat - bodyBeat over its view, before the challengers in its
 * own court, its words naming it (`b`).
 */
function stepSunder(f, now, dt, bodies, here, rng, out) {
  const S = f.sd;
  for (const b of [HALF.blade, HALF.flame]) {
    const H = b ? S.fl : S.bl;
    if (H.kn && !H.said) { H.said = true; out.push({ k: 'kn', b, at: H.kn }); }
  }
  if (!S.rj && S.bl.kn && S.fl.kn) rejoin(f, now, out);
  if (!S.rj) for (const b of [HALF.blade, HALF.flame]) if ((b ? S.fl : S.bl).kn && now >= (b ? S.fl : S.bl).kn + SUNDER_PAIR_MS) rise(f, b, now, out);
  const hereF = bodies.filter((b) => !b.dead && f.players[b.sub] && inCourt(b.x, b.z, S.fl.court, POSE_SLACK));
  for (const b of [HALF.blade, HALF.flame]) {
    const H = b ? S.fl : S.bl, was = H.mend;
    if (!S.two || S.rj || H.kn || (b ? hereF : here).length) { H.lone = null; H.mend = false; }
    else { H.lone ??= now; H.mend = now - H.lone >= SUNDER_LONE_MS; }
    if (H.mend !== was) f.lastStateAt = -Infinity;   // AUDIT WB14 (WIRE-5): a half's mending begun or ended is said at once (the state's `lo`)
    if (!H.mend) continue;
    const add = Math.min(Math.max(0, S.m - H.h), (SUNDER_MEND * S.m * dt) / 1000);
    H.h += add;
    credit(f, add);
  }
  const keep = Math.pow(1 - profileOf(f).threatDecay, dt / 1000);
  for (const k of Object.keys(S.fl.threat)) { S.fl.threat[k] *= keep; if (S.fl.threat[k] < 0.5) delete S.fl.threat[k]; }
  const V = flameView(f), k0 = out.length;
  bodyBeat(V, now, hereF, bodies, rng, out, profileOf(V));
  keepFlame(f, V);
  for (let k = k0; k < out.length; k++) if (FLAME_WORDS.has(out[k].k)) out[k].b = HALF.flame;
}

/** Each half's pool in points, as the wire says it (a pool not quite spent is a point). */
const sdHealth = (f) => [Math.ceil(f.sd.bl.h * f.max), Math.ceil(f.sd.fl.h * f.max)];
/** The halves' pools, at most every HP_SEND_MS, when they have moved (`sdh`: each half's, and the whole each began at). */
function sdFrame(f, now, out) {
  const S = f.sd;
  if (!S || now - (S.hAt ?? 0) < HP_SEND_MS) return;
  const h = sdHealth(f), m = Math.ceil(S.m * f.max), key = `${h.join(',')}/${m}`;   // the whole as a pool rounds - never under it
  if (key === S.hSent) return;
  S.hSent = key; S.hAt = now;
  out.push({ k: 'sdh', h, m });
}
/** The Sundering as a state says it: the layout, each half's whole and pool, kneel and mending, the Rejoining's moment, and
 *  the Flame's body (where, its walk, its blow, its ward, its court, its stun - the Blade's are his own fields). */
function sunderState(f) {
  const S = f.sd, F = S.fl;
  return {
    two: S.two ? 1 : 0, m: Math.ceil(S.m * f.max), h: sdHealth(f), kn: [S.bl.kn || 0, F.kn || 0], lo: [S.bl.mend ? 1 : 0, F.mend ? 1 : 0], rj: S.rj || 0,
    fl: { x: r2(F.pos[0]), z: r2(F.pos[1]), yw: r2(F.yaw), mv: F.move ? { x: r2(F.move.x), z: r2(F.move.z), tx: r2(F.move.tx), tz: r2(F.move.tz), v: F.move.v, at: F.move.at } : null,
      atk: F.atk ? atkFrame(F.atk) : null, sh: F.shieldUntil, ct: F.court | 0, su: F.stunUntil > 0 ? F.stunUntil : 0 },
  };
}

/** WB11b: a blow's hand - the blow rate's token spent (one hand for a blow on him, on a crystal and on his host), false
 *  past GATE_HIT_HZ_MAX a second. AUDIT WB11 W3: ONCE A BLOW - a frame under the sequence `seq` (the wire's `q`) of the blow just charged,
 *  within BLOW_GROUP_MS, on a body `who` it has not met, rides on it (BLOW_BODIES_MAX bodies at most); every other frame
 *  is charged, and opens a blow of its own. SD8a: exported - the Brass Remnant's fight (net/superDungeon/sdRemnant.js) spends the same hand. */
export function spendBlow(p, now, seq = null, who = '') {
  if (seq != null && p.bq === seq && now - (p.bqAt ?? -Infinity) <= BLOW_GROUP_MS && Array.isArray(p.bqWho) && p.bqWho.length < BLOW_BODIES_MAX && !p.bqWho.includes(who)) {
    p.bqWho.push(who);
    return true;
  }
  p.rate = Math.min(GATE_HIT_HZ_MAX, p.rate + (Math.max(0, now - p.rateAt) / 1000) * GATE_HIT_HZ_MAX);
  p.rateAt = now;
  if (!(p.rate >= 1)) return false;
  p.rate -= 1;
  p.bq = seq; p.bqAt = now; p.bqWho = [who];
  return true;
}
/** WB11b: a blow's purse - `d` capped a blow (HIT_CAP_X), by the bucket and by what is `left` of the body it meets; the
 *  clipping counted, what lands dealt. Answers what landed. SD8a: exported - and the same purse. */
export function spendPurse(p, d, left, now, bx = 1) {
  const ref = dpsRef(p.lv) * bx;   // EG-FULL (Elite-Gates.md section 15, THE TRUST LAW): a Spire member's bucket grows by their Vestiges' declared factor (at most 1.25); every other caller's is the gate's own (1)
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const got = Math.max(0, Math.min(d, HIT_CAP_X * ref, p.bucket, left));
  p.bucket -= got;
  p.clipped += d - got;
  p.dealt += got;
  return got;
}
/**
 * WB11b: A BLOW ON ONE OF HIS HOST from `sub`, standing at `pose` ({x, z}, the court's frame), of kind `r`, claiming `d`
 * on body `i`: judged by the hand and the purse a blow on him and on a crystal is (his blow rate and the bucket), a melee
 * blow within MELEE_REACH of its body, from the floor and from his court; counted as dealt (a part in the fight) and
 * apart (`hd`, the chart's share), never his threat. Answers the frames to fan: its fall (`adie`, by the striker's name) -
 * the beat says its health. WB14e: a Tithe-Imp caught pays its tithe with them, by `rng` (the relay's dice).
 */
export function applyHostHit(f, sub, i, d, r, pose, now, seq = null, rng = null) {
  const out = [];
  const p = f.players[sub], H = f.lg, a = H && Number.isSafeInteger(i) ? H.ads.find((o) => o.i === i) ?? null : null;
  if (!p || f.fell || f.wrath || !a || !(a.h > 0) || !Number.isFinite(d) || !(d > 0) || now >= f.wrathAt) return out;
  if (!spendBlow(p, now, seq, `a${i}`)) return out;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK, planOf(f))) return out;
  const [ax, az] = hostAt(a, now);
  if (!inCourt(pose.x, pose.z, nearestCourt(ax, az), POSE_SLACK)) return out;   // WB14c: from the floor it stands on (his court, under the Legion-Lord; the Vanguard's platform)
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, ax, az) - HOST_KINDS[a.k].r > MELEE_REACH + POSE_SLACK) return out;
  const got = spendPurse(p, d, a.h, now);
  p.hd = (p.hd ?? 0) + got;
  a.h -= got;
  if (a.k === HOST.tithe && got > 0 && !(a.by ??= []).includes(sub)) a.by.push(sub);   // WB14e: who struck the Tithe-Imp
  if (a.h > 1e-6) return out;
  H.ads = H.ads.filter((o) => o !== a);
  out.push({ k: 'adie', is: [a.i], w: HOST_GONE.slain, n: p.name, at: now });
  if (a.k === HOST.tithe) { f.tt = { ...(f.tt ?? {}), by: [...a.by], caughtAt: now }; payTithe(f, now, rng, out); }   // its tithe paid now, by the relay's dice (AUDIT WB14 LAW-5: without them, first thing the next beat)
  return out;
}
/** WB11b: his host as the state says it - each one standing `[i, k, h, m, x, z, tx, tz, v, at, la, lx, lz]`: its walk
 *  (from (x, z) at `at` toward (tx, tz) at v; v 0 standing at (x, z)) and the blow in flight (`la` when it lands - 0 none -
 *  and the disc's centre). Pure. */
export const hostStateOf = (H) => (H?.ads ?? []).map((a) => [a.i, a.k, Math.ceil(a.h), a.m,
  ...(a.mv ? [a.mv.x, a.mv.z, a.mv.tx, a.mv.tz, a.mv.v, a.mv.at] : [r2(a.x), r2(a.z), r2(a.x), r2(a.z), 0, 0]),
  ...(a.atk ? [a.atk.at, a.atk.x, a.atk.z] : [0, 0, 0])]);

const r2 = (v) => Math.round(v * 100) / 100;
/** An attack as the wire says it: its sequence, which, when it lands (the relay's clock), where he stood, his facing,
 *  its targets. */
export function atkFrame(a) {
  return { i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r2(a.yw), tg: a.tg.map((p) => [r2(p[0]), r2(p[1])]), ...(Array.isArray(a.pk) ? { pk: [...a.pk] } : {}) };   // WB14a: and the marked, by peer id
}
/** WB14a: how many Dagon's Brand marks among `n` living challengers in his court - one for two or fewer, two to five,
 *  three from six (ATTACKS.brand.max). */
export const brandCountFor = (n) => Math.max(1, Math.min(ATTACKS.brand.max, 1 + Math.floor(Math.max(0, n) / 3)));
/** WB14a: does the chain hold as it lands - the chained fighter (the attack's `who`) alive in the fight and within
 *  CHAIN_HOLD_M of him, POSE_SLACK of slack for the pose's age (a fighter who ran is told so by their own screen, which
 *  never pulls past the break; the relay errs toward the Slam, which strikes at his feet, never at theirs). */
function chainHeld(f, bodies) {
  const b = bodies.find((x) => x.sub === f.atk.who && !x.dead && f.players[x.sub]);
  return !!b && dist(b.x, b.z, f.pos[0], f.pos[1]) <= CHAIN_HOLD_M + POSE_SLACK;
}
function hpFrame(f, now, out) {
  const h = Math.round(f.hp);
  if (h !== f.lastHpSent && now - f.lastHpAt >= HP_SEND_MS) { f.lastHpSent = h; f.lastHpAt = now; out.push({ k: 'hp', h, m: Math.round(f.max) }); }
}
/** WB11b: a beat that holds - its health and its state said, nothing more done. */
function heldBeat(f, now, out) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(stateOf(f));
}
/** WB14b: THE CROSSINGS ON THE WIRE - by walkway, a walkway not laid null, none after the last one laid (a plain night's
 *  are WB9b's, in order and whole). Pure. */
export const xaWire = (xa) => {
  const a = Array.isArray(xa) ? xa : [];
  const out = Array.from({ length: Math.min(a.length, WALKS.length) }, (_, i) => (Number.isFinite(a[i]) ? a[i] : null));   // a hole too (a sparse array's)
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
};
/** The whole state as the wire says it (the `st` kind): on entering, and every STATE_SEND_MS. */
export function stateOf(f) {
  return {
    k: 'st', d: f.day, b: f.boss, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max), x: r2(f.pos[0]), z: r2(f.pos[1]), yw: r2(f.yaw),
    mv: f.move ? { x: r2(f.move.x), z: r2(f.move.z), tx: r2(f.move.tx), tz: r2(f.move.tz), v: f.move.v, at: f.move.at } : null,
    atk: f.atk ? atkFrame(f.atk) : null, sh: f.shieldUntil, wr: f.wrathAt, n: Object.keys(f.players).length,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null, wrath: f.wrath ? f.wrath.at : null,   // GATE-UX: the chart with it (a late door, a reconnect)
    md: f.md ?? null,   // WB8b: his marks - every screen fights the fight's own, whatever the day's draw would say
    ...(f.pt ? { pt: f.pt } : {}),   // WB14b: the night's portents - none said, a plain night
    // WB9b: the court he fights in and the crossings' words (the walkways laid); WB9c: the crystals standing, the stun,
    // and when the next Reckoning comes (for its countdown)
    ct: f.court | 0, xa: xaWire(f.xa),   // WB14b: by walkway - a hole (a walkway not laid) null, none after the last laid
    cx: f.cx ? { i: f.cx.i, m: f.cx.m, c: f.cx.c.map((q) => [q.x, q.z, Math.ceil(q.h)]) } : null,
    su: f.stunUntil > 0 ? f.stunUntil : 0, rk: f.rk > 0 ? f.rk : 0,
    ...(f.lg ? { lg: hostStateOf(f.lg) } : {}),   // WB11b: his host standing - the Legion-Lord's (WB14: and the Vanguard's, the gaolers, a Tithe-Imp)
    ...(Number.isSafeInteger(openedAt(f)) ? { op: openedAt(f) + OPENING_MS } : {}),   // WB13e: the opening's end - his wake, on every screen (WB14c: none while his Vanguard holds)
    ...(f.vg ? { vg: [f.vg.s, f.vg.w] } : {}),   // WB14c: the Vanguard's stage and its waves risen
    ...(f.sd ? { sd: sunderState(f) } : {}),   // WB14d: the halves, while he is sundered
    ...(f.cp ? { cp: [f.cp.at, f.cp.n, f.cp.f, f.cp.w, f.cp.s] } : {}),   // WB14f: the Captive - his gaolers risen, freed, the Reckoning his ward takes, spent
  };
}
