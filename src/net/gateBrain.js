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
// (world/gateArena.js stands the court so; the relay subtracts its centre from a pose before a body reaches this
// file). A facing is `atan2(dx, dz)` - 0 looks south, at the door.
//
// THE FIGHT'S NUMBERS (bible section 5): each player's level CLAIM scales both what they bring (health) and what they
// may deal (a bucket), so no claim buys a faster kill - the fastest possible is BOSS_TTK_S / BUCKET_RATE_X of
// full-rate damage whatever anybody says.
//
// Not a DFU member. Ledger A (WB).
import { readGateMods, validGateMods, GATE_TRIALS } from './gateMods.js';   // WB8b: the Warden's marks - the fight's profile is made from them

// ── the court and the body ─────────────────────────────────────────────
/** Where the court's centre stands in the arena's own dungeon frame, metres: its one made block's middle
 *  (world/gateArena.js lays the block at the grid's origin, RDB_SIDE 51.2 across, the floor's top at y 0 - pinned
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
export const COURTS = Object.freeze([Object.freeze([0, 0]), Object.freeze([-68, -22]), Object.freeze([-74, -94])]);
/** The court a phase is fought in (its index in COURTS). */
export const courtOfPhase = (phase) => Math.max(0, Math.min(COURTS.length - 1, (phase | 0) - 1));
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
 * (walkFormed; world/gateArena.js slabRise raises each stone whole before the floor reaches it). Walkway k joins court k
 * to court k+1.
 */
export const WALK_HALF_W = 3.2;
export const WALK_LEAD_MS = 1000;
export const WALK_FORM_MS = 4000;
export const WALK_SINK_M = 2;
/** Walkway k's line: from `a` (in court k) to `b` (in court k+1), its direction and its length. */
export function walkwayOf(k) {
  const A = COURTS[k], B = COURTS[k + 1];
  if (!A || !B) return null;
  const dx = B[0] - A[0], dz = B[1] - A[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, r = COURT_R - WALK_SINK_M;
  const ax = A[0] + ux * r, az = A[1] + uz * r, bx = B[0] - ux * r, bz = B[1] - uz * r;
  return Object.freeze({ k, ax, az, bx, bz, ux, uz, len: Math.hypot(bx - ax, bz - az) });
}
export const WALKS = Object.freeze(COURTS.slice(1).map((_, k) => walkwayOf(k)));
/** How much of walkway k is laid at `now` (0..1) - from WALK_LEAD_MS after its crossing's word (`xa[k]`) over
 *  WALK_FORM_MS; none before. */
export function walkFormed(xa, k, now) {
  const at = Array.isArray(xa) ? xa[k] : null;
  return Number.isFinite(at) ? Math.max(0, Math.min(1, (now - at - WALK_LEAD_MS) / WALK_FORM_MS)) : 0;
}
/**
 * WB9b: THE FLOOR A BODY MAY STAND ON at `now` (the fight's crossings `xa`): the first court; each walkway as far as it
 * is laid; each court past a walkway laid whole. `pad` widens every part (a pose's slack). The relay's bound on where a
 * blow may come from, and (clampToFloor) the motor's on where a player may walk - one law, both ends. Pure.
 */
export function onFloor(x, z, xa, now, pad = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (let k = 0; k < COURTS.length; k++) {
    if (k > 0 && walkFormed(xa, k - 1, now) < 1) break;
    if (inCourt(x, z, k, pad)) return true;
  }
  for (const w of WALKS) {
    const f = walkFormed(xa, w.k, now);
    if (!(f > 0)) break;
    const t = (x - w.ax) * w.ux + (z - w.az) * w.uz, side = Math.abs((x - w.ax) * w.uz - (z - w.az) * w.ux);
    if (t >= -pad && t <= w.len * f + pad && side <= WALK_HALF_W + pad) return true;
  }
  return false;
}
/**
 * WB9b: THE NEAREST POINT OF THE FLOOR (onFloor's, every part drawn in by `inset` - a body's own radius) to (x, z), or
 * null when (x, z) already stands on it: the motor's clamp in the court (world/gateArena.js courtArena), as the duel's
 * ring clamps to its disc. Pure.
 */
export function clampToFloor(x, z, xa, now, inset = 0) {
  let best = null, bd = Infinity;
  const consider = (px, pz) => { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz]; } };
  for (let k = 0; k < COURTS.length; k++) {
    if (k > 0 && walkFormed(xa, k - 1, now) < 1) break;
    const [cx, cz] = COURTS[k], r = Math.max(0, COURT_R - inset), d = Math.hypot(x - cx, z - cz);
    if (d <= r) return null;
    consider(cx + ((x - cx) / d) * r, cz + ((z - cz) / d) * r);
  }
  for (const w of WALKS) {
    const f = walkFormed(xa, w.k, now);
    if (!(f > 0)) break;
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
 *  (ui/gateMarksView.js - the card stands MARKS_CARD_ARRIVE_MS as a fighter steps in). */
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
/** Phase three's wind-ups, shortened by a fifth. */
export const PHASE3_WINDUP = 0.8;
/** WBX5 (2026-09-26, Mac: "The boss phases need to be more defined and more detailed mechanics"): EACH PHASE HAS A NAME
 *  AND A SHAPE. The Warden fights with his blade and his weight alone (Cleave, Ground Slam, Charge); the Burning Court is
 *  fire and reach (Hellfire and the Meteor leave the floor burning, the Flame Nova, the Crushing Leap at whoever stands
 *  far off); Dagon's Champion adds the Spokes of Dagon - four lanes of fire from his feet, and then the four between
 *  them. Not faster: Mac, of a player's ask for mechanics half again as fast, "I dont think making mechanics faster is
 *  the play". The names are the bar's (ui/gateBossBar.js) and the turn's words (scenes/gateCourt.js). */
export const PHASE_NAMES = Object.freeze(['The Warden', 'The Burning Court', "Dagon's Champion"]);

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
});
/** The attacks by their wire id. */
export const ATTACK_BY_ID = Object.freeze(Object.values(ATTACKS).sort((a, b) => a.id - b.id));
/** The ones he chooses among (the wrath is the clock's, not his; WB9b/c: the bound and the Reckoning are his turns'). */
const CHOSEN = Object.freeze([ATTACKS.cleave, ATTACKS.slam, ATTACKS.charge, ATTACKS.hellfire, ATTACKS.nova, ATTACKS.leap, ATTACKS.meteor, ATTACKS.spokes]);
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
 *   width?: number, len?: number, n?: number, r0?: number, r1?: number, max?: number, pool?: {r: number, ms: number, pct: number, base: number}}} GateAttack
 */
/** WB8b: Dagon's Favoured - the phases the Burning Court's arsenal comes in early. */
export const FAVOURED_PHASE = Object.freeze({ hellfire: 1, meteor: 1, spokes: 2 });

/**
 * WB8b (2026-09-28, Mac: "give him unique and different modifers on every 2 hour spawn"): A FIGHT'S PROFILE - the
 * numbers the brain and every screen read in place of the constants above, made from the fight's marks (`md`,
 * net/gateMods.js: the day's draw, net/gateLaw.js gateModsOf, kept on the fight and said in its state - one law, both
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
      el, name: aspect.names[A.key] ?? A.name,
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
  if (md == null || typeof md !== 'object') return fightProfile(md);
  let P = _profileByMd.get(md);
  if (!P) { P = fightProfile(md); _profileByMd.set(md, P); }
  return P;
};
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
 * @param {number} day @param {number} now @param {number} wrathAt the gate's midnight (net/gateLaw.js gateTimes)
 * @param {string} boss the boss's id (net/gateLaw.js GATE_BOSSES)
 * @param {unknown} [md] WB8b: his marks (net/gateLaw.js gateModsOf) - none, the Warden unmarked
 */
export function newFight(day, now, wrathAt, boss, md = null) {
  return {
    v: 1, day, boss, startedAt: now, wrathAt, phase: 1, shieldUntil: 0, hp: 0, max: 0,
    /** WB8b: the Warden's marks this fight is fought under (net/gateLaw.js gateModsOf - the relay's draw at the fight's
     *  birth), or null for none; said in every state */
    md: validGateMods(md) ?? null,
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
  const share = BOSS_TTK_S * dpsRef(level) * profileOf(f).hpX;   // WB8b: Colossal - each share a quarter more
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
export function applyHit(f, sub, d, r, pose, now, seq = null) {
  const p = f.players[sub];
  if (!p || f.fell || f.wrath || !Number.isFinite(d) || !(d > 0)) return 0;
  if (now >= f.wrathAt) return 0;   // AUDIT WBX R6: midnight is the Wrath's, whether or not a beat has said so yet
  if (now < f.shieldUntil) return 0;
  // the blow rate: a token bucket, GATE_HIT_HZ_MAX a second, one second deep - spent whatever the blow turns out to be
  // (AUDIT WB11 W3: once a blow, however many bodies it meets - spendBlow, the one hand of every arm)
  if (!spendBlow(p, now, seq, 'b')) return 0;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return 0;
  if (!onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK)) return 0;   // nobody strikes the court from off it - WB9b: its floor as far as it is laid
  // AUDIT WB9 (brain F1): nor from outside the court he fights in - he chooses, aims at and waits for only those in it
  // (`here`), so a fighter on a walkway or in a court he has left struck him from where no blow of his could answer
  if (!inCourt(pose.x, pose.z, f.court, POSE_SLACK)) return 0;
  const P = profileOf(f);
  const gap = dist(pose.x, pose.z, f.pos[0], f.pos[1]) - P.bossR;   // WB8b: his body's own size (Colossal's is larger)
  if (r === HIT_KINDS.Melee && gap > MELEE_REACH + POSE_SLACK) return 0;
  // the damage: WB8b's Unyielding lightens it, then it is capped a blow, then the bucket
  const ref = dpsRef(p.lv);
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const want = d * P.hitX * (now < (f.stunUntil ?? 0) ? STUN_HIT_X : 1);   // WB9c: a stunned Warden takes it heavier
  const got = Math.max(0, Math.min(want, HIT_CAP_X * ref, p.bucket, f.hp));
  p.bucket -= got;
  p.clipped += want - got;   // the caps' clipping - what his ward took off is his, not a cap's
  p.dealt += got;
  if (got > 0) { f.threat[sub] = (f.threat[sub] ?? 0) + got; p.hits = (p.hits ?? 0) + 1; p.best = Math.max(p.best ?? 0, got); }   // GATE-UX: the chart's blows and best
  f.hp -= got;
  if (f.hp <= 1e-6 && f.max > 0) {
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

/** WBX5: THE LEAP'S FLIGHT - he leaves the floor this long before it lands (world/gateBoss.js draws the arc). WB9b: the
 *  bound across the fire flies CROSS_AIR_MS. */
export const LEAP_AIR_MS = 650;
/** How long a leap of either kind is in the air. */
export const airOf = (A) => (A === ATTACKS.cross ? CROSS_AIR_MS : LEAP_AIR_MS);
/** Where a leap carries him at `now`, or null while he still stands on the floor: from where it began to where it lands
 *  over its last LEAP_AIR_MS, and there after. The ONE law of it - the beat's, the kill's (`settleAt`) and every
 *  screen's (world/gateBoss.js bossPlace). AUDIT WBX2 M5: the screens flew him while the relay held him at its start -
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
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK)) return 0;
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

/** The attack's wind-up in this phase (WB9c: Dagon's are never shortened; WB9b: nor the bound - its flight is fixed). */
export const windupOf = (atk, phase) => (phase >= 3 && atk.id !== ATTACKS.wrath.id && atk.id !== ATTACKS.reckon.id && atk.id !== ATTACKS.cross.id ? Math.round(atk.windup * PHASE3_WINDUP) : atk.windup);

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
 *  times running the last was used): nothing, and he walks at his target. */
export function attacksFor(phase, gap, near, lastA = -1, P = BASE_PROFILE, run = 1) {
  const out = CHOSEN.filter((a) => P.atk[a.key].phase <= phase && gap <= a.range && (a.minGap <= 0 || gap >= a.minGap) && !(a === ATTACKS.slam && near < 1));   // a body inside his (a negative gap) is still in reach
  const fresh = out.filter((a) => a.id !== lastA);
  return fresh.length ? fresh : run >= REPEAT_MAX ? [] : out;
}

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
      f.hp = Math.min(f.max, f.hp + P.feed * f.max);
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
    f.atk = { i: ++f.seq, a: wr.id, at: Math.max(f.wrathAt, now + 1000), x: f.pos[0], z: f.pos[1], yw: f.yaw, tg: [], until: 0 };
    f.atk.until = f.atk.at + wr.active;
    out.push({ k: 'atk', ...atkFrame(f.atk) });
    // WB11b: and his host - it crumbles as Dagon gathers; said AFTER his word (AUDIT WB11 B2: a screen that heard the
    // crumbling first read it as the Ward-Bearers' cap and said his ward broke - it stands through the wind-up)
    hostGone(f, now, out, HOST_GONE.crumbled);
    hpFrame(f, now, out);   // AUDIT WBX R5
    return out;
  }
  // WB9b: the challengers standing in the court he fights in - the only ones he chooses, aims at and waits for (a body
  // still on the walkway, or left behind in a court he has leapt from, is not before him)
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && inCourt(b.x, b.z, f.court, POSE_SLACK));
  // a phase crossed: a roar, the ward, and the phase's turn (WB9b PHASE_TURN - the bound to the next court, the wait
  // there for a challenger, then its signature); an attack in flight is superseded - the new word is the one every
  // screen draws
  if (f.max > 0 && f.phase < 3 && f.hp / f.max <= PHASE_AT[f.phase - 1]) {
    f.phase++;
    f.shieldUntil = now + CROSS_WARD_MAX_MS;   // WB9b: the ward holds through the bound and the wait (the wait sets its end)
    f.move = null;
    f.cx = null; f.stunUntil = 0;
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    const [first, ...rest] = PHASE_TURN[f.phase];
    f.queue = rest.map((e) => ({ ...e }));
    hostGone(f, now, out, HOST_GONE.crumbled);   // WB11b: his host crumbles at every turn - each kind is its phase's or its court's
    f.pending = null;
    beginTurn(f, first, now, here, rng, out);
  }
  stepHost(f, now, here, rng, out, P);   // WB11b: his host's beat - under the Legion-Lord alone
  // WB9c: STUNNED - his Reckoning broken, he kneels: no step, no blow, until it passes
  if (now < (f.stunUntil ?? 0)) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
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
    if (now < f.atk.until) { hpFrame(f, now, out); cxFrame(f, now, out); stateFrame(f, now, out); return out; }
    const was = f.atk;
    f.runA = f.atk.a === f.lastA ? (f.runA ?? 0) + 1 : 1;   // WB13f
    f.lastA = f.atk.a;
    f.freeAt = now;
    f.atk = null;
    f.target = null;
    f.nextAt = now + BREATH_MS;
    if (ATTACK_BY_ID[was.a] === ATTACKS.reckon) f.rk = now + RECKON_EVERY_MS;   // WB9c: the next a minute after this one's end
    // WB8b: ECHOING - a meteor falls again, a breath after the first: on the one it fell for, where they stand now (and
    // alive), else where the first fell; an echo has none of its own, and a phase's turn clears it with the rest
    if (P.echo && ATTACK_BY_ID[was.a] === ATTACKS.meteor && !was.echo) f.queue.unshift({ a: 'meteor', echo: true, who: was.who ?? null, point: was.tg?.[0] ?? null });
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
      if (none) return heldBeat(f, now, out);
      f.pending = { wait: 'bearers' };
      f.waitUntil = now + BEARER_WARD_MAX_MS;
      f.shieldUntil = f.waitUntil;
      out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    }
    if (bearersStand(f) && now < f.waitUntil) return heldBeat(f, now, out);
    hostGone(f, now, out, HOST_GONE.crumbled, (a) => a.k === HOST.bearer);   // the cap: any still standing crumble
    f.shieldUntil = P.shieldMs + now;   // his own ward, as a challenger's arrival raises it below (Unyielding's 6 s)
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.pending = f.queue.length ? f.queue.shift() : null;
    f.nextAt = now + TURN_BREATH_MS;
  }
  // WB9b: THE WAIT in a new court - his ward holds until a living challenger stands in it (or CROSS_WAIT_MAX_MS), then
  // holds his profile's ward more while the turn goes on (the signature is cast under it)
  if (f.pending?.wait && now >= f.nextAt) {
    if (!here.length && now < (f.waitUntil ?? 0)) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
    f.shieldUntil = now + P.shieldMs;
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.pending = f.queue.length ? f.queue.shift() : null;
    f.nextAt = now + TURN_BREATH_MS;
  }
  if (f.pending && !f.pending.wait && now >= f.nextAt) {
    const next = f.pending;
    f.pending = null;
    beginTurn(f, next, now, here, rng, out);
    hpFrame(f, now, out); stateFrame(f, now, out);
    return out;
  }
  // WB9c: Dagon's Champion's turn done in the last court, his Reckonings are armed - the first RECKON_FIRST_MS from then;
  // one due - he leaps to the court's heart and calls it (`rk` -2 while it is under way: its end sets the next)
  if (f.phase >= 3 && !f.pending && !f.queue.length && !f.atk) {
    if (!f.rk && f.court === COURTS.length - 1) f.rk = now + RECKON_FIRST_MS;
    if (f.rk > 0 && now >= f.rk && now >= f.nextAt) {
      f.rk = -2;
      f.move = null;
      f.queue = [{ a: 'reckon' }];
      beginTurn(f, { a: 'leap', centre: true }, now, here, rng, out);
      hpFrame(f, now, out); stateFrame(f, now, out);
      return out;
    }
  }
  // choose: a target he keeps a while, and what can be done to it from here - else walk at it
  if (now >= f.nextAt && !f.pending) {
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
      const can = attacksFor(f.phase, gap, near, f.lastA, P, f.runA);   // WB13f: never thrice running - he walks in
      if (can.length) { f.move = null; begin(f, chooseAttack(can, rng), now, target, here, rng, out); }
      else walkToward(f, target, now, out);
    } else if (f.move) {
      stepWalk(f, now);
      f.move = null;
      out.push({ k: 'mv', x: r2(f.pos[0]), z: r2(f.pos[1]), tx: r2(f.pos[0]), tz: r2(f.pos[1]), v: 0, at: now });
    }
  }
  stepWalk(f, now);
  hpFrame(f, now, out);
  cxFrame(f, now, out);
  stateFrame(f, now, out);
  return out;
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
    // court straight to the third, and its players walk both (the wire says them in order: no gap)
    for (let k = 0; k < entry.court; k++) if (!Number.isFinite(f.xa[k])) f.xa[k] = now;
    begin(f, atk, now, null, bodies, rng, out, COURTS[entry.court], false, entry.court);
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
    tg = [keepInCourt(p[0], p[1], atk === ATTACKS.leap ? BOSS_REACH_R : COURT_R, C)];
    if (atk === ATTACKS.leap && (tg[0][0] !== f.pos[0] || tg[0][1] !== f.pos[1])) f.yaw = Math.atan2(tg[0][0] - f.pos[0], tg[0][1] - f.pos[1]);
  } else if (atk === ATTACKS.hellfire) {
    const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = live[i]; live[i] = live[j]; live[j] = t; }
    const first = live.slice(0, atk.max);
    tg = first.map((b) => keepInCourt(b.x, b.z, COURT_R, C));
    // phase three: a second volley, scattered about the same feet
    if (f.phase >= 3) tg = tg.concat(first.map((b) => keepInCourt(b.x + (rng() - 0.5) * 6, b.z + (rng() - 0.5) * 6, COURT_R, C)));
  }
  f.atk = { i: ++f.seq, a: atk.id, at, x: f.pos[0], z: f.pos[1], yw: f.yaw, tg, until: at + atk.active + atk.recover, ...(target ? { who: target.sub } : {}), ...(echo ? { echo: true } : {}), ...(Number.isInteger(to) ? { to } : {}) };
  out.push({ k: 'atk', ...atkFrame(f.atk) });
  if (atk === ATTACKS.reckon) growCrystals(f, now, bodies, rng, out);   // WB9c: the crystals rise as he calls it
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
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK)) return out;
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
 * choice 4. Trial rotation"): HIS HOST - the bodies the relay runs beside him under the Legion-Lord trial (net/gateMods.js
 * `legion`; bible/11-Multiplayer/World-Bosses.md section 17). Section 9 left it: "No adds ... the relay could own simple
 * ones as it owns the boss - later". Simple, as he is: each a point on an open floor, a health, a walk said once and
 * carried by every screen, and a blow wound up and laid on the ground. By wire id:
 *   0 the HARRIER - an Imp: in waves in the first phase, it runs at the challenger who stands farthest from him, and Bites
 *   1 the SAPPER - an Atronach: in waves in the second phase, it walks at him; one that reaches him is drunk and heals him
 *   2 the WARD-BEARER - a Daedra: rises in each new court as he lands there; his ward holds while one stands, and it
 *     Pulses at whoever comes near
 * `r` its body's radius and `h` its height (a blow's reach is measured to its body, as to his), `speed` metres a second
 * (a player runs 7.6 - a runner always outruns them). Who each one IS by his aspect is the screen's (world/gateBoss.js
 * HOST_LOOKS); the relay knows bodies, not faces.
 */
export const HOST_KINDS = Object.freeze([
  Object.freeze({ id: 0, key: 'harrier', r: 0.5, h: 1.5, speed: 5 }),
  Object.freeze({ id: 1, key: 'sapper', r: 0.7, h: 2.3, speed: 1.6 }),
  Object.freeze({ id: 2, key: 'bearer', r: 0.6, h: 2.2, speed: 0 }),
]);
/** The kinds by name. */
export const HOST = Object.freeze({ harrier: 0, sapper: 1, bearer: 2 });
/**
 * THE HOST'S BLOWS, by the kind that strikes them (a Sapper strikes nobody - null): each a disc `r` about the body that
 * strikes it, laid where it stands at its word, wound up `windup`, landing over `active`, the body still `recover` after;
 * a share of the struck player's own health and points beside it (WBX4's law), its element - `aspect` his aspect's (the
 * saving throw answers it), null plain. Resolved on the struck player's machine, as his are (net/gateStrike.js
 * hostVerdict). From the body's own feet a runner is out of either disc in a fraction of its wind-up (pinned).
 */
export const HOST_BLOWS = Object.freeze([
  Object.freeze({ kind: 0, key: 'bite', name: 'Bite', windup: 900, active: 200, recover: 900, r: 2, pct: 0.12, base: 4, el: null }),
  null,
  Object.freeze({ kind: 2, key: 'pulse', name: 'Ward Pulse', windup: 1400, active: 200, recover: 0, r: 3.5, pct: 0.18, base: 6, el: 'aspect' }),
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
 *  every one crumbles at a phase's turn - so it is the most of one kind (net/wire.js GATE_HOST_MAX bounds every list on
 *  the wire - pinned over it). */
export const HOST_STANDING_MAX = Math.max(HARRIERS_MAX, SAPPERS_MAX, bearerCountFor(Infinity));
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
export const HOST_RISE_MS = Object.freeze([800, 2500, 1500]);
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
export const HOST_GONE = Object.freeze({ slain: 0, fed: 1, crumbled: 2 });

/** WB11b: a fight's host, made at its first beat under the trial: the last number given (each body's own, for the
 *  fight - a room woken from its checkpoint goes on from it), those standing (each `{i, k, h, m, x, z, mv, atk, tg, tgAt,
 *  up, next}` - its number, kind, health and whole, spot, walk, blow in flight, mark and when it was taken, when it has
 *  risen, when it may strike next), when each kind's next wave comes (0 not armed), the Sappers he has drunk, the court
 *  whose Ward-Bearers have risen (-1 none), and the health last said. */
export const newHost = () => ({ n: 0, ads: [], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0 });
/** Where one of his host stands at `now`: its walk carried on from its word (every screen carries it so - net/gateLink.js
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
    H.ads.push({ i, k, h: m, m, x, z, mv: null, atk: null, tg: null, tgAt: 0, up: now + HOST_RISE_MS[k], next: k === HOST.bearer ? now + BEARER_PULSE_FIRST_MS + a.length * BEARER_PULSE_STAGGER_MS : now });
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
    else bearerBeat(a, now, here, blows);
  }
  if (moves.length) out.push({ k: 'amv', m: moves });
  if (blows.length) out.push({ k: 'aatk', a: blows });
  hostHpFrame(f, now, out);
}

/** WB11b: a blow's hand - the blow rate's token spent (one hand for a blow on him, on a crystal and on his host), false
 *  past GATE_HIT_HZ_MAX a second. AUDIT WB11 W3: ONCE A BLOW - a frame under the sequence `seq` (the wire's `q`) of the blow just charged,
 *  within BLOW_GROUP_MS, on a body `who` it has not met, rides on it (BLOW_BODIES_MAX bodies at most); every other frame
 *  is charged, and opens a blow of its own. SD8a: exported - the Brass Remnant's fight (net/sdRemnant.js) spends the same hand. */
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
export function spendPurse(p, d, left, now) {
  const ref = dpsRef(p.lv);
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
 * the beat says its health.
 */
export function applyHostHit(f, sub, i, d, r, pose, now, seq = null) {
  const out = [];
  const p = f.players[sub], H = f.lg, a = H && Number.isSafeInteger(i) ? H.ads.find((o) => o.i === i) ?? null : null;
  if (!p || f.fell || f.wrath || !a || !(a.h > 0) || !Number.isFinite(d) || !(d > 0) || now >= f.wrathAt) return out;
  if (!spendBlow(p, now, seq, `a${i}`)) return out;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !onFloor(pose.x, pose.z, f.xa, now, POSE_SLACK)) return out;
  if (!inCourt(pose.x, pose.z, f.court, POSE_SLACK)) return out;
  const [ax, az] = hostAt(a, now);
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, ax, az) - HOST_KINDS[a.k].r > MELEE_REACH + POSE_SLACK) return out;
  const got = spendPurse(p, d, a.h, now);
  p.hd = (p.hd ?? 0) + got;
  a.h -= got;
  if (a.h > 1e-6) return out;
  H.ads = H.ads.filter((o) => o !== a);
  out.push({ k: 'adie', is: [a.i], w: HOST_GONE.slain, n: p.name, at: now });
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
  return { i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r2(a.yw), tg: a.tg.map((p) => [r2(p[0]), r2(p[1])]) };
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
/** The whole state as the wire says it (the `st` kind): on entering, and every STATE_SEND_MS. */
export function stateOf(f) {
  return {
    k: 'st', d: f.day, b: f.boss, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max), x: r2(f.pos[0]), z: r2(f.pos[1]), yw: r2(f.yaw),
    mv: f.move ? { x: r2(f.move.x), z: r2(f.move.z), tx: r2(f.move.tx), tz: r2(f.move.tz), v: f.move.v, at: f.move.at } : null,
    atk: f.atk ? atkFrame(f.atk) : null, sh: f.shieldUntil, wr: f.wrathAt, n: Object.keys(f.players).length,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null, wrath: f.wrath ? f.wrath.at : null,   // GATE-UX: the chart with it (a late door, a reconnect)
    md: f.md ?? null,   // WB8b: his marks - every screen fights the fight's own, whatever the day's draw would say
    // WB9b: the court he fights in and the crossings' words (the walkways laid); WB9c: the crystals standing, the stun,
    // and when the next Reckoning comes (for its countdown)
    ct: f.court | 0, xa: (Array.isArray(f.xa) ? f.xa : []).filter(Number.isFinite),
    cx: f.cx ? { i: f.cx.i, m: f.cx.m, c: f.cx.c.map((q) => [q.x, q.z, Math.ceil(q.h)]) } : null,
    su: f.stunUntil > 0 ? f.stunUntil : 0, rk: f.rk > 0 ? f.rk : 0,
    ...(f.lg ? { lg: hostStateOf(f.lg) } : {}),   // WB11b: his host standing - said only under the Legion-Lord
    ...(Number.isSafeInteger(f.startedAt) ? { op: f.startedAt + OPENING_MS } : {}),   // WB13e: the opening's end - his wake, on every screen
  };
}
