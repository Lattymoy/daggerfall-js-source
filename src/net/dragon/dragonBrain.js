// @ts-check
// DRAGON2 (2026-10-29, the owner: "an extremely hard encounter with Telegraph and unique attack patterns, different
// movement and aerial integration"; bible/11-Multiplayer/Dwarven-Dragon.md sections 4-7): THE DRAGON'S BRAIN, kept by
// the cell its site stands in and stepped on its alarm. It fights ALOFT, where no swing reaches it, and GROUNDED after a
// Crash Landing, where every blow lands heavier. Its blows are the Spire's shape stamps (net/eliteGates/egShape.js), each
// held to its escape floor; its numbers are the gate's level-claim law. Pure: `rng` handed in. Ledger A (DRAGON).
import { egBlowOf, shDisc, shLane, shCone, shRing, egStampOk } from '../eliteGates/egShape.js';
import {
  clampLv,
  dpsRef,
  BUCKET_RATE_X,
  BUCKET_DEPTH_X,
  HIT_CAP_X,
  HIT_KINDS,
  MELEE_REACH,
  POSE_SLACK,
  THREAT_PICK,
  THREAT_DECAY,
  SEAT_KEEP_MS,
} from '../gate/gateBrain.js';
import { DRAGON_BRAIN_V } from './dragonLaw.js';
import {
  DRAGON_BODY_R,
  CIRCLE_ALT,
  ROOST_R,
  ROOST_ALT,
  WALK_V,
  DRAGON_ARENA_R,
  lineLeg,
  orbitLeg,
  orbitFrom,
  fallLeg,
  climbLeg,
  planAt,
  planEnd,
  legOf,
} from './dragonBody.js';
import { DRAGON_LEGS_MAX, DRAGON_CHART_MAX } from '../wire.js'; // the most legs a state names, the chart's rows - the wire's own bounds

/** The beat, ms, and the longest step one beat takes (a woken fight never leaps). */
export const DRAGON_TICK_MS = 250;
export const DRAGON_STEP_MAX_MS = 1000;
/** Health a second at most, the whole state every so often, the checkpoint (ms). */
export const DRAGON_HP_SEND_MS = 250;
export const DRAGON_STATE_SEND_MS = 5000;
export const DRAGON_CHECKPOINT_MS = 2000;
/** A woken fight's blow numbers carried this far past its checkpoint, so no screen takes a new blow for one it lived. */
export const DRAGON_WAKE_SEQ = 50;
/** A fight no beat stepped this long is taken up circling where it was, its blows in flight dropped. */
export const DRAGON_SLEEP_MS = 5000;

/** Where a fighter's blows are believed from, where it is a fighter, where it stands the fight (metres from its body). */
export const DRAGON_ENGAGE_R = 300;
export const DRAGON_SHOT_R = 220;
export const DRAGON_STAND_R = 150;
/** Who may join: within this of its site (section 4). */
export const DRAGON_ADMIT_R = 600;
/** The words fan to every socket within this of its site. */
export const DRAGON_FAN_R = 4000;

/** Seconds of reference damage each fighter's share stands for (section 4), and its fighters' bound. */
export const DRAGON_TTK_S = 720; // DRAGON-HARDER (the owner: "The dragon is way too easy to kill"): 200 before - the bucket deals 3x its reference, so it fell in a minute; 720 is twelve minutes at reference, four at the cap
export const DRAGON_FIGHTERS_MAX = 128;
/** The most blows one account lands a second. */
export const DRAGON_HIT_HZ_MAX = 4;
/** A share leaves its health when its fighter is gone this long; it comes back, at its fraction, when it returns. */
export const DRAGON_ABSENT_RETIRE_MS = 45_000;
/** Who earned it (section 7): dealt this share of its own share, or stood within DRAGON_STAND_R this share of the fight. */
export const DRAGON_DEALT_SHARE = 0.025;
export const DRAGON_STOOD_SHARE = 0.25;

/** The opening - its dive from the roost - before its first blow, ms. */
export const DRAGON_OPENING_MS = 6000;
/** A phase's ward (section 5), ms; the third phase's wind-ups cut by a fifth (never under their floors). */
export const DRAGON_SHIELD_MS = 3000;
export const PHASE3_WINDUP_X = 0.8;
/** On the ground: how long, its walk's stop short of its target, and every blow on it heavier (the Wyrm's law). */
export const GROUNDED_MS = 12_000;
export const GROUNDED_MS_P3 = 16_000;
export const GROUNDED_X = 1.3;
export const WALK_STOP_M = 6;
/** The longest walk it takes before it looks again, ms. */
export const WALK_LEG_MS = 1500;
/** Between its blows (ms) - a choice breathes after the last lands. */
export const RECOVER_AIR_MS = 1200;
export const RECOVER_GROUND_MS = 700;
/** How fast it closes on a blow's set-up point in the air (m/s), and the set-up's bounds (ms). */
export const SETUP_V = 26;
export const SETUP_MIN_MS = 800;
export const SETUP_MAX_MS = 4000;
/** It never throws one blow more than this many times running. */
export const DRAGON_REPEAT_MAX = 2;
/** How many air blows before it comes down: the least, and one more by chance. */
export const AIR_BLOWS_MIN = 2;
/** The most pending blows a state names. */
export const DRAGON_BLOWS_KEPT = 12;
/** A blow is forgotten this long after its landing. */
export const BLOW_KEEP_MS = 3000;

/** The modes (section 5). */
export const DRAGON_MODE = Object.freeze({ air: 0, ground: 1 });

/**
 * THE BLOWS (section 6), by id - the wire's `a`. `wu` the wind-up after its set-up, `p` the share of the struck player's own
 * maximum health, `el` its element (null a plain blow - the relay's to count), `air` thrown aloft, `ph` the first phase
 * it comes in, `w` its weight in the draw.
 */
export const DRAGON_BLOWS = Object.freeze([
  Object.freeze({ id: 0, key: 'strafe', wu: 1600, p: 0.25, el: 'shock', air: true, ph: 1, w: 3 }),
  Object.freeze({ id: 1, key: 'volley', wu: 2000, p: 0.22, el: 'shock', air: true, ph: 1, w: 3 }),
  Object.freeze({ id: 2, key: 'breath', wu: 1800, p: 0.3, el: 'fire', air: true, ph: 1, w: 2 }),
  Object.freeze({ id: 3, key: 'crash', wu: 2200, p: 0.35, el: null, air: true, ph: 1, w: 0 }),
  Object.freeze({ id: 4, key: 'claw', wu: 1300, p: 0.3, el: null, air: false, ph: 1, w: 0 }),
  Object.freeze({ id: 5, key: 'tail', wu: 1400, p: 0.25, el: null, air: false, ph: 1, w: 0 }),
  Object.freeze({ id: 6, key: 'gust', wu: 2100, p: 0.2, el: null, air: false, ph: 1, w: 0 }),
  Object.freeze({ id: 7, key: 'vent', wu: 2400, p: 0.4, el: 'fire', air: true, ph: 2, w: 3 }),
  Object.freeze({ id: 8, key: 'rain', wu: 2200, p: 0.25, el: null, air: true, ph: 3, w: 3 }),
]);
export const DRAGON_BLOW = Object.freeze(Object.fromEntries(DRAGON_BLOWS.map((b) => [b.key, b])));
/** The blows' shapes' numbers (section 6), metres. */
export const STRAFE_HALF_LEN = 35;
export const STRAFE_W = 6;
export const STRAFE_ALT = 8;
export const STRAFE_RUN_MS = 1200;
export const VOLLEY_R = 4;
export const VOLLEY_MAX = 5;
export const BREATH_R = 20;
export const BREATH_ARC = 70;
export const BREATH_HOVER_M = 12;
export const BREATH_ALT = 14;
export const CRASH_R = 9;
export const CLAW_R = 9;
export const CLAW_ARC = 110;
export const TAIL_R = 10;
export const TAIL_ARC = 150;
export const GUST_R = 11;
export const GUST_CLIMB_MS = 2500;
export const VENT_SAFE_R = 6;
export const VENT_R = 32;
export const VENT_ALT = 20;
export const RAIN_DISCS = 8;
export const RAIN_SPREAD_M = 15;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const wrap = (a) => {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
};
const inside = (x, z, r = DRAGON_ARENA_R) => {
  const d = Math.hypot(x, z);
  return d <= r ? [x, z] : [(x / d) * r, (z / d) * r];
};

/**
 * A fight born at its first `in`: watch `w`, look `b`, its site's native point, the moment it leaves unslain. It comes
 * down out of its roost (`roost`, the leg every screen drew it on) over the opening.
 * @param {{ w: number, b: number, sx: number, sz: number, now: number, leaveAt: number, roost: any }} birth
 */
export function newDragonFight({ w, b, sx, sz, now, leaveAt, roost }) {
  const p = planAt([roost], now) ?? { x: ROOST_R, z: 0, a: ROOST_ALT, yw: 0 };
  return {
    v: DRAGON_BRAIN_V,
    w,
    b: b ? 1 : 0,
    sx,
    sz,
    startedAt: now,
    beatAt: now,
    leaveAt,
    openUntil: now + DRAGON_OPENING_MS,
    players: /** @type {Record<string, any>} */ ({}),
    threat: /** @type {Record<string, number>} */ ({}),
    target: null,
    max: 0,
    hp: 0,
    ph: 1,
    shieldUntil: 0,
    md: DRAGON_MODE.air,
    ma: 0,
    mdUntil: 0,
    legs: [orbitFrom(p, now, 55, roost.sd, CIRCLE_ALT, DRAGON_OPENING_MS)],
    blows: /** @type {any[]} */ ([]),
    seq: 0,
    busyUntil: now + DRAGON_OPENING_MS,
    last: /** @type {number[]} */ ([]),
    airCount: 0,
    airBeforeLand: AIR_BLOWS_MIN,
    hpSaidAt: 0,
    hpSaid: -1,
    stSaidAt: now,
    liveMs: 0,
    fell: /** @type {any} */ (null),
    gone: /** @type {any} */ (null),
  };
}

/** Where the dragon stands at `t` (the site's frame). @param {any} f @param {number} t */
export const dragonPlaceAt = (f, t) => planAt(f.legs, t) ?? { x: 0, z: 0, a: CIRCLE_ALT, yw: 0 };
/** Does a fighter have a real part in it - a blow worth its earned share, or the gate's SEAT_KEEP_MS stood (half a minute)? */
export const dragonHasPart = (p) => p.dealt >= DRAGON_DEALT_SHARE * p.share || p.stoodMs >= SEAT_KEEP_MS;
/** Is it on the ground at `now` - its mode as of the time it takes hold (`ma`: a Crash Landing's landing, a Takeoff Gust's
 *  lift), so a blow in its dive is an airborne one. @param {any} f @param {number} now */
export const dragonGroundedAt = (f, now) => (f.md === DRAGON_MODE.ground ? now >= (f.ma ?? 0) : now < (f.ma ?? 0));
/** AUDIT DRAGON: THE FRACTION IT STANDS AT - while every share is out of it, the fraction it stood at as the last left
 *  (`idle`, the gate's AUDIT WBX2 M2): a return, or a newcomer, never heals it. */
const standsAt = (f) => (f.max > 0 ? Math.max(0, Math.min(1, f.hp / f.max)) : Number.isFinite(f.idle) ? f.idle : 1);

/**
 * A fighter in: the gate's join, the dragon's numbers. A late one's share joins at the fraction the dragon stands at, its
 * bucket empty. A full fight frees the seat of one with no part who is not about (`present`). Answers whether it is in.
 * @param {any} f @param {string} sub @param {string} name @param {number} lv @param {number} now @param {boolean} admits
 * @param {Set<string>|null} [present]
 */
export function joinDragonFight(f, sub, name, lv, now, admits, present = null) {
  const known = f.players[sub];
  if (known) {
    if (typeof name === 'string' && name) known.name = name.slice(0, 24);
    if (!f.fell && !f.gone) {
      known.seenAt = now;
      restoreDragonShare(f, known);
    }
    return true;
  }
  if (f.fell || f.gone || !admits) return false;
  if (Object.keys(f.players).length >= DRAGON_FIGHTERS_MAX && !freeSeat(f, present)) return false;
  const level = clampLv(lv),
    share = DRAGON_TTK_S * dpsRef(level),
    frac = standsAt(f);
  f.max += share;
  f.hp += share * frac;
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24),
    lv: level,
    share,
    dealt: 0,
    clipped: 0,
    bucket: frac >= 1 ? BUCKET_DEPTH_X * dpsRef(level) : 0,
    bucketAt: now,
    rate: DRAGON_HIT_HZ_MAX,
    rateAt: now,
    stoodMs: 0,
    joinedAt: now,
    seenAt: now,
    retired: false,
    hits: 0,
    best: 0,
  };
  return true;
}
function shareOut(f, share) {
  const frac = standsAt(f);
  f.max = Math.max(0, f.max - share);
  f.hp = f.max * frac;
  if (!(f.max > 0)) f.idle = frac;
}
/** A fighter gone DRAGON_ABSENT_RETIRE_MS: its share out of the health, at the fraction it stands at. */
export function retireDragonShare(f, p) {
  if (p.retired) return;
  shareOut(f, p.share);
  p.retired = true;
}
/** ...and back in as it returns, at the fraction it stands at - a return never heals it. */
export function restoreDragonShare(f, p) {
  if (!p.retired) return;
  const frac = standsAt(f);
  f.max += p.share;
  f.hp += p.share * frac;
  p.retired = false;
}
function freeSeat(f, present) {
  if (!present) return false;
  for (const [sub, p] of Object.entries(f.players)) {
    if (present.has(sub) || dragonHasPart(p)) continue;
    if (!p.retired) shareOut(f, p.share);
    delete f.players[sub];
    delete f.threat[sub];
    if (f.target === sub) f.target = null;
    return true;
  }
  return false;
}

/**
 * A blow on the dragon from `sub` at `pose` ({x, z}, the site's frame) of kind `r` (HIT_KINDS), claiming `d`. Answers
 * the damage taken (0 refused). Refused: a stranger, a fight over, its ward, past the blow rate, no pose, a pose past its
 * reach - a swing only while it stands GROUNDED within reach, a shaft or a spell within DRAGON_SHOT_R. Grounded, a blow
 * lands GROUNDED_X heavier; then the gate's one-blow cap and bucket.
 * @param {any} f @param {string} sub @param {number} d @param {number} r @param {{x:number,z:number}|null} pose @param {number} now
 */
export function applyDragonHit(f, sub, d, r, pose, now) {
  const p = f.players[sub];
  if (!p || f.fell || f.gone || !Number.isFinite(d) || !(d > 0) || !(f.max > 0) || now < f.shieldUntil) return 0;
  p.rate = Math.min(DRAGON_HIT_HZ_MAX, p.rate + ((now - p.rateAt) / 1000) * DRAGON_HIT_HZ_MAX);
  p.rateAt = now;
  if (p.rate < 1) return 0;
  p.rate -= 1;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return 0;
  const at = dragonPlaceAt(f, now),
    grounded = dragonGroundedAt(f, now),
    gap = dist(pose.x, pose.z, at.x, at.z) - DRAGON_BODY_R;
  if (r === HIT_KINDS.Melee ? !grounded || gap > MELEE_REACH + POSE_SLACK : gap > DRAGON_SHOT_R) return 0;
  p.seenAt = now;
  restoreDragonShare(f, p);
  const ref = dpsRef(p.lv);
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const want = d * (grounded ? GROUNDED_X : 1),
    got = Math.max(0, Math.min(want, HIT_CAP_X * ref, p.bucket, f.hp));
  p.bucket -= got;
  p.clipped += want - got;
  p.dealt += got;
  if (got > 0) {
    f.threat[sub] = (f.threat[sub] ?? 0) + got;
    p.hits++;
    p.best = Math.max(p.best, got);
  }
  f.hp -= got;
  if (f.hp <= 1e-6) fall(f, now);
  return got;
}
/** THE KILL: where it was, it falls (dragonBody.js fallLeg - every screen walks the same), its blows in flight gone. */
function fall(f, now) {
  f.hp = 0;
  f.fell = { at: now, top: dragonTopDealers(f, 3), n: Object.keys(f.players).length, dm: dragonDamageChart(f) };
  f.legs = [fallLeg(dragonPlaceAt(f, now), now)];
  f.blows = [];
}
/** The `k` who dealt the most, most first. */
export const dragonTopDealers = (f, k) =>
  Object.values(f.players)
    .filter((q) => q.dealt > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt)
    .slice(0, k)
    .map((q) => q.name);
/** The damage chart at the kill (the gate's GATE-UX, its rows the dragon's): `n` name, `l` level, `d` dealt, `h` blows, `b` best -
 *  at most the wire's DRAGON_CHART_MAX rows. */
export const dragonDamageChart = (f) =>
  Object.values(f.players)
    .filter((q) => q.dealt > 0 || q.stoodMs > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt)
    .slice(0, DRAGON_CHART_MAX)
    .map((q) => ({ n: q.name, l: q.lv, d: Math.round(q.dealt), h: q.hits, b: Math.round(q.best) }));

/** Did `sub` earn a receipt? Only a fallen dragon pays (section 7). */
export function dragonEarned(f, sub) {
  const p = f.players[sub];
  if (!p || !f.fell) return false;
  return p.dealt >= DRAGON_DEALT_SHARE * p.share || p.stoodMs >= DRAGON_STOOD_SHARE * Math.max(1, f.liveMs);
}
/** How: 'dealt' first (the tame's own bar - section 8), else 'stood'. */
export const dragonEarnedBy = (f, sub) =>
  f.players[sub]?.dealt >= DRAGON_DEALT_SHARE * (f.players[sub]?.share ?? Infinity) ? 'dealt' : 'stood';
/** Who came and earned nothing, `[sub, level]` - the hub's party share (the serpent's SERPENT4 law). */
export const dragonKinOf = (f) =>
  Object.entries(f.players)
    .filter(([sub]) => !dragonEarned(f, sub))
    .map(([sub, p]) => [sub, p.lv]);

/** A word that lays what every screen draws - kept before it is said (the serpent's AUDIT 2 XB6 law). */
export const DRAGON_TRACK_WORDS = Object.freeze(new Set(['mv', 'atk', 'md', 'ph', 'gone']));
export const dragonSaysTrack = (frames) => frames.some((w) => DRAGON_TRACK_WORDS.has(w.k));
/** A woken fight: its blow numbers carried past any it may have said since its checkpoint. */
export function dragonWoke(f) {
  if (f && typeof f === 'object') f.seq = (f.seq ?? 0) + DRAGON_WAKE_SEQ;
  return f;
}
/** A fight no beat stepped for DRAGON_SLEEP_MS, taken up circling where it was: its blows in flight dropped, its plan an
 *  orbit from its place (a grounded one keeps its ground). Answers its words. @param {any} f @param {number} now */
export function dragonResume(f, now) {
  if (f.fell || f.gone || now - f.beatAt < DRAGON_SLEEP_MS) return [];
  const p = dragonPlaceAt(f, now);
  f.beatAt = now;
  f.blows = [];
  f.busyUntil = now + RECOVER_AIR_MS;
  f.legs =
    f.md === DRAGON_MODE.ground
      ? [lineLeg(now, 0, [p.x, p.z, 0], [p.x, p.z, 0], p.yw)]
      : [orbitFrom(p, now, 55, 1, CIRCLE_ALT, 1500)];
  if (f.md === DRAGON_MODE.ground) f.mdUntil = Math.max(f.mdUntil, now + GROUNDED_MS / 2);
  return [mvWord(f)];
}

const mvWord = (f) => ({ k: 'mv', legs: f.legs });
const blowWord = (b) => ({ k: 'atk', i: b.i, a: b.a, at: b.at, wu: b.wu, s: b.s, ...(b.sp ? { sp: b.sp } : {}) }); // AUDIT DRAGON: a sweep's span (the Strafing Run's) rides with it

/** The fighters about it now: living bodies of the fight within DRAGON_ENGAGE_R of its body. */
function fightersAbout(f, bodies, at) {
  return bodies.filter(
    (b) =>
      !b.dead &&
      f.players[b.sub] &&
      !f.players[b.sub].stale &&
      dist(b.x, b.z, at.x, at.z) <= DRAGON_ENGAGE_R &&
      Math.hypot(b.x, b.z) <= DRAGON_ARENA_R + 60,
  );
}
/** Its target: the most threat THREAT_PICK of the time, else any fighter about it. */
function pickTarget(f, here, rng) {
  if (!here.length) return null;
  let top = null;
  for (const b of here) if (!top || (f.threat[b.sub] ?? 0) > (f.threat[top.sub] ?? 0)) top = b;
  if (top && (f.threat[top.sub] ?? 0) > 0 && rng() < THREAT_PICK) return top;
  return here[Math.min(here.length - 1, Math.floor(rng() * here.length))];
}

/**
 * ONE BEAT: its census (shares retired and back, the time stood), its phase, its leaving, then - when it is free - its
 * next blow. Answers the words to fan, in order.
 * @param {any} f @param {number} now @param {Array<{sub: string, x: number, z: number, dead?: boolean}>} bodies the site's frame
 * @param {() => number} rng
 */
export function stepDragonBrain(f, now, bodies, rng) {
  const out = [];
  if (f.fell || f.gone) return out;
  const dt = Math.max(0, Math.min(DRAGON_STEP_MAX_MS, now - f.beatAt));
  f.beatAt = now;
  const at = dragonPlaceAt(f, now);
  if (now >= f.leaveAt) {
    f.gone = { at: now };
    f.blows = [];
    f.legs = [climbLeg(at, now, 15_000)];
    out.push(mvWord(f), { k: 'gone', at: now });
    return out;
  }
  const here = fightersAbout(f, bodies, at);
  for (const b of here) {
    const p = f.players[b.sub];
    p.seenAt = now;
    restoreDragonShare(f, p);
    if (dist(b.x, b.z, at.x, at.z) <= DRAGON_STAND_R) p.stoodMs += dt;
  }
  if (here.length) f.liveMs += dt;
  for (const p of Object.values(f.players))
    if (!p.retired && now - p.seenAt > DRAGON_ABSENT_RETIRE_MS) retireDragonShare(f, p);
  for (const k of Object.keys(f.threat)) f.threat[k] *= Math.max(0, 1 - THREAT_DECAY * (dt / 1000));
  f.blows = f.blows.filter((b) => now < b.at + (b.sp ?? 0) + BLOW_KEEP_MS);
  if (f.legs.length > 1) {
    const cur = legOf(f.legs, now);
    f.legs = f.legs.slice(Math.max(0, f.legs.indexOf(cur)));
  }
  // its phase: 66% and 33%, a ward and a roar; on the ground it rises at once after the ward
  const frac = standsAt(f),
    ph = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
  if (f.max > 0 && ph > f.ph) {
    f.ph = ph;
    f.shieldUntil = now + DRAGON_SHIELD_MS;
    f.busyUntil = Math.max(f.busyUntil, f.shieldUntil);
    if (f.md === DRAGON_MODE.ground) f.mdUntil = f.shieldUntil;
    out.push({ k: 'ph', n: ph, until: f.shieldUntil });
  }
  if (f.hp !== f.hpSaid && now - f.hpSaidAt >= DRAGON_HP_SEND_MS) {
    f.hpSaid = f.hp;
    f.hpSaidAt = now;
    out.push({ k: 'hp', h: Math.round(f.hp), m: Math.round(f.max), n: here.length });
  }
  if (now - f.stSaidAt >= DRAGON_STATE_SEND_MS) {
    f.stSaidAt = now;
    out.push(dragonStateOf(f));
  }
  if (now < f.busyUntil) return out;
  if (f.md === DRAGON_MODE.ground && now >= f.mdUntil) {
    out.push(...gust(f, now, at, rng));
    return out;
  } // its time spent, it rises whoever is about
  if (!here.length) return out;
  const target = pickTarget(f, here, rng);
  if (!target) return out;
  f.target = target.sub;
  const said =
    f.md === DRAGON_MODE.ground ? groundTurn(f, now, at, target, here) : airTurn(f, now, at, target, here, rng);
  out.push(...said);
  return out;
}

/** A blow made and kept: its stamps, its wind-up (its set-up's lead before its own), the phase's cut, the floor. */
function throwBlow(f, B, now, lead, stamps, sp = 0) {
  const wu = Math.round(lead + B.wu * (f.ph >= 3 ? PHASE3_WINDUP_X : 1));
  const blow = {
    ...egBlowOf({ i: ++f.seq, s: stamps.filter((s) => egStampOk(s)), at: now + wu, wu, p: B.p, el: B.el, sp }),
    a: B.id,
  };
  blow.at = now + blow.wu; // the floor may have lengthened it
  f.blows.push(blow);
  if (f.blows.length > DRAGON_BLOWS_KEPT) f.blows.shift();
  f.last = [...f.last, B.id].slice(-DRAGON_REPEAT_MAX);
  return blow;
}
const setupMs = (from, to) =>
  Math.max(SETUP_MIN_MS, Math.min(SETUP_MAX_MS, (dist(from.x, from.z, to[0], to[1]) / SETUP_V) * 1000));
const sideOf = (rng) => (rng() < 0.5 ? -1 : 1);

/** A turn aloft: a Crash Landing once its air blows are spent, else a blow drawn by weight (never one thrice running). */
function airTurn(f, now, at, T, here, rng) {
  if (f.airCount >= f.airBeforeLand) return crash(f, now, at, T, rng);
  const can = DRAGON_BLOWS.filter(
    (B) =>
      B.air && B.w > 0 && B.ph <= f.ph && !(f.last.length >= DRAGON_REPEAT_MAX && f.last.every((id) => id === B.id)),
  );
  let roll = rng() * can.reduce((s, B) => s + B.w, 0),
    B = can[0];
  for (const c of can) {
    roll -= c.w;
    if (roll <= 0) {
      B = c;
      break;
    }
  }
  f.airCount++;
  if (B === DRAGON_BLOW.strafe) return strafe(f, now, at, T, rng);
  if (B === DRAGON_BLOW.breath) return breath(f, now, at, T, rng);
  if (B === DRAGON_BLOW.vent) return vent(f, now, at, here, rng);
  if (B === DRAGON_BLOW.rain) return rain(f, now, here, rng);
  return volley(f, now, T, here, rng);
}
/** STRAFING RUN: it sets up behind its target and dives down a lane through it, both cannons firing (section 6). */
function strafe(f, now, at, T, rng) {
  let dx = T.x - at.x,
    dz = T.z - at.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) {
    dx = Math.sin(at.yw);
    dz = Math.cos(at.yw);
  } else {
    dx /= d;
    dz /= d;
  }
  const s = inside(T.x - dx * STRAFE_HALF_LEN, T.z - dz * STRAFE_HALF_LEN, DRAGON_ARENA_R + 30),
    e = inside(T.x + dx * STRAFE_HALF_LEN, T.z + dz * STRAFE_HALF_LEN, DRAGON_ARENA_R + 30);
  const start = [s[0] - dx * 15, s[1] - dz * 15],
    lead = setupMs(at, start);
  const blow = throwBlow(
    f,
    DRAGON_BLOW.strafe,
    now,
    lead,
    [shLane(s[0], s[1], e[0], e[1], STRAFE_W)],
    STRAFE_RUN_MS / 2,
  );
  const runAt = blow.at - STRAFE_RUN_MS / 2,
    yw = Math.atan2(dx, dz);
  const exit = [e[0] + dx * 25, e[1] + dz * 25];
  f.legs = [
    lineLeg(now, runAt - now, [at.x, at.z, at.a], [start[0], start[1], STRAFE_ALT + 10], yw),
    lineLeg(runAt, STRAFE_RUN_MS, [start[0], start[1], STRAFE_ALT + 10], [e[0], e[1], STRAFE_ALT], yw),
    lineLeg(runAt + STRAFE_RUN_MS, 1800, [e[0], e[1], STRAFE_ALT], [exit[0], exit[1], CIRCLE_ALT], yw),
  ];
  f.legs.push(orbitFrom({ x: exit[0], z: exit[1], a: CIRCLE_ALT }, planEnd(f.legs), 55, sideOf(rng)));
  f.busyUntil = planEnd(f.legs.slice(0, -1)) + RECOVER_AIR_MS;
  return [{ k: 'mv', legs: f.legs }, blowWord(blow)];
}
/** CANNON VOLLEY: a disc under its target and up to four others, as it circles. */
function volley(f, now, T, here, rng) {
  const others = here
    .filter((b) => b.sub !== T.sub)
    .sort(() => rng() - 0.5)
    .slice(0, VOLLEY_MAX - 1);
  const blow = throwBlow(
    f,
    DRAGON_BLOW.volley,
    now,
    0,
    [T, ...others].map((b) => shDisc(b.x, b.z, VOLLEY_R)),
  );
  f.busyUntil = blow.at + RECOVER_AIR_MS;
  return [blowWord(blow)];
}
/** SCALDING BREATH: it comes to a hover before its target and breathes a cone of steam on the ground under it. */
function breath(f, now, at, T, rng) {
  let dx = at.x - T.x,
    dz = at.z - T.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const h = inside(T.x + dx * BREATH_HOVER_M, T.z + dz * BREATH_HOVER_M),
    yw = Math.atan2(T.x - h[0], T.z - h[1]),
    lead = setupMs(at, h);
  const blow = throwBlow(f, DRAGON_BLOW.breath, now, lead, [shCone(h[0], h[1], yw, BREATH_R, BREATH_ARC)]);
  f.legs = [
    lineLeg(now, lead, [at.x, at.z, at.a], [h[0], h[1], BREATH_ALT], yw),
    lineLeg(now + lead, blow.at + 800 - (now + lead), [h[0], h[1], BREATH_ALT], [h[0], h[1], BREATH_ALT], yw),
  ];
  f.legs.push(orbitFrom({ x: h[0], z: h[1], a: BREATH_ALT }, blow.at + 800, 55, sideOf(rng), CIRCLE_ALT, 2000));
  f.busyUntil = blow.at + RECOVER_AIR_MS;
  return [{ k: 'mv', legs: f.legs }, blowWord(blow)];
}
/** OVERPRESSURE (phase two on): it hovers over the fighters' heart and vents - safe under it, or far off. */
function vent(f, now, at, here, rng) {
  const cx = here.reduce((s, b) => s + b.x, 0) / here.length,
    cz = here.reduce((s, b) => s + b.z, 0) / here.length;
  const v = inside(cx, cz, DRAGON_ARENA_R - 20),
    lead = setupMs(at, v);
  const blow = throwBlow(f, DRAGON_BLOW.vent, now, lead, [shRing(v[0], v[1], VENT_SAFE_R, VENT_R)]);
  f.legs = [
    lineLeg(now, lead, [at.x, at.z, at.a], [v[0], v[1], VENT_ALT], at.yw),
    lineLeg(now + lead, blow.at + 600 - (now + lead), [v[0], v[1], VENT_ALT], [v[0], v[1], VENT_ALT], at.yw),
  ];
  f.legs.push(orbitFrom({ x: v[0], z: v[1], a: VENT_ALT }, blow.at + 600, 55, sideOf(rng), CIRCLE_ALT, 2000));
  f.busyUntil = blow.at + RECOVER_AIR_MS;
  return [{ k: 'mv', legs: f.legs }, blowWord(blow)];
}
/** SHRAPNEL RAIN (the third phase): eight discs - one under each fighter it can, the rest about them. */
function rain(f, now, here, rng) {
  const pts = here.slice(0, VOLLEY_MAX).map((b) => [b.x, b.z]);
  while (pts.length < RAIN_DISCS) {
    const b = here[Math.floor(rng() * here.length)],
      a = rng() * 2 * Math.PI,
      r = rng() * RAIN_SPREAD_M;
    pts.push(inside(b.x + Math.sin(a) * r, b.z + Math.cos(a) * r, DRAGON_ARENA_R + 30));
  }
  const blow = throwBlow(
    f,
    DRAGON_BLOW.rain,
    now,
    0,
    pts.map((q) => shDisc(q[0], q[1], VOLLEY_R)),
  );
  f.busyUntil = blow.at + RECOVER_AIR_MS;
  return [blowWord(blow)];
}
/** CRASH LANDING: it dives on its target and lands with a slam - grounded for GROUNDED_MS. */
function crash(f, now, at, T, rng) {
  const l = inside(T.x + (at.x - T.x) * 0.1, T.z + (at.z - T.z) * 0.1, DRAGON_ARENA_R - 10),
    yw = Math.atan2(T.x - at.x, T.z - at.z),
    lead = setupMs(at, l);
  const blow = throwBlow(f, DRAGON_BLOW.crash, now, lead, [shDisc(l[0], l[1], CRASH_R)]);
  f.legs = [
    lineLeg(now, lead, [at.x, at.z, at.a], [l[0], l[1], 25], yw),
    lineLeg(now + lead, blow.at - (now + lead), [l[0], l[1], 25], [l[0], l[1], 0], yw, 1),
    lineLeg(blow.at, 0, [l[0], l[1], 0], [l[0], l[1], 0], yw),
  ];
  f.md = DRAGON_MODE.ground;
  f.ma = blow.at; // AUDIT DRAGON: on the ground from its landing, never its dive
  f.mdUntil = blow.at + (f.ph >= 3 ? GROUNDED_MS_P3 : GROUNDED_MS);
  f.airCount = 0;
  f.airBeforeLand = AIR_BLOWS_MIN + (rng() < 0.5 ? 1 : 0);
  f.busyUntil = blow.at + RECOVER_GROUND_MS;
  return [{ k: 'mv', legs: f.legs }, blowWord(blow), { k: 'md', m: DRAGON_MODE.ground, at: blow.at, until: f.mdUntil }];
}
/** A turn on the ground: a Claw Rake at one before it, a Tail Sweep at one behind it, else a walk at its target (its
 *  Takeoff Gust, once its time is spent, is the beat's). */
function groundTurn(f, now, at, T, here) {
  const facing = (b) => Math.abs(wrap(Math.atan2(b.x - at.x, b.z - at.z) - at.yw)) * (180 / Math.PI);
  const near = (b, r) => dist(b.x, b.z, at.x, at.z) <= r + DRAGON_BODY_R;
  const behind = here.find((b) => near(b, TAIL_R - 2) && facing(b) > 110);
  if (
    near(T, CLAW_R - 2) &&
    facing(T) <= CLAW_ARC / 2 &&
    !(f.last.length >= DRAGON_REPEAT_MAX && f.last.every((id) => id === DRAGON_BLOW.claw.id))
  ) {
    const blow = throwBlow(f, DRAGON_BLOW.claw, now, 0, [shCone(at.x, at.z, at.yw, CLAW_R + DRAGON_BODY_R, CLAW_ARC)]);
    f.legs = [lineLeg(now, 0, [at.x, at.z, 0], [at.x, at.z, 0], at.yw)];
    f.busyUntil = blow.at + RECOVER_GROUND_MS;
    return [{ k: 'mv', legs: f.legs }, blowWord(blow)];
  }
  if (behind && !(f.last.length >= DRAGON_REPEAT_MAX && f.last.every((id) => id === DRAGON_BLOW.tail.id))) {
    const blow = throwBlow(f, DRAGON_BLOW.tail, now, 0, [
      shCone(at.x, at.z, wrap(at.yw + Math.PI), TAIL_R + DRAGON_BODY_R, TAIL_ARC),
    ]);
    f.legs = [lineLeg(now, 0, [at.x, at.z, 0], [at.x, at.z, 0], at.yw)];
    f.busyUntil = blow.at + RECOVER_GROUND_MS;
    return [{ k: 'mv', legs: f.legs }, blowWord(blow)];
  }
  // a walk of WALK_LEG_MS at most toward its target, stopping short of it - then it looks again
  const yw = Math.atan2(T.x - at.x, T.z - at.z),
    step = Math.min(
      Math.max(0, dist(T.x, T.z, at.x, at.z) - WALK_STOP_M - DRAGON_BODY_R),
      (WALK_V * WALK_LEG_MS) / 1000,
    );
  const to = inside(at.x + Math.sin(yw) * step, at.z + Math.cos(yw) * step, DRAGON_ARENA_R - 5),
    ms = (step / WALK_V) * 1000;
  f.legs = [lineLeg(now, ms, [at.x, at.z, 0], [to[0], to[1], 0], yw)];
  f.busyUntil = now + Math.max(DRAGON_TICK_MS * 2, ms);
  return [{ k: 'mv', legs: f.legs }];
}
/** TAKEOFF GUST: its wings beat it off the ground - a disc about it - and it climbs back to its circle. */
function gust(f, now, at, rng) {
  const blow = throwBlow(f, DRAGON_BLOW.gust, now, 0, [shDisc(at.x, at.z, GUST_R)]);
  f.legs = [
    lineLeg(now, blow.at - now, [at.x, at.z, 0], [at.x, at.z, 0], at.yw),
    lineLeg(blow.at, GUST_CLIMB_MS, [at.x, at.z, 0], [at.x, at.z, CIRCLE_ALT], at.yw),
  ];
  f.legs.push(orbitFrom({ x: at.x, z: at.z, a: CIRCLE_ALT }, blow.at + GUST_CLIMB_MS, 55, sideOf(rng)));
  f.md = DRAGON_MODE.air;
  f.ma = blow.at; // on the ground until its wings lift it
  f.busyUntil = blow.at + GUST_CLIMB_MS + RECOVER_AIR_MS;
  return [{ k: 'mv', legs: f.legs }, blowWord(blow), { k: 'md', m: DRAGON_MODE.air, at: blow.at, until: 0 }];
}

/** The whole fight, as a joiner is told it (the `st` word): its site, look, phase, health, mode, ward, plan, blows in
 *  flight, fighters, leaving, and its end. @param {any} f */
export function dragonStateOf(f) {
  return {
    k: 'st',
    w: f.w,
    b: f.b,
    sx: f.sx,
    sz: f.sz,
    ph: f.ph,
    h: Math.round(f.hp),
    m: Math.round(f.max),
    md: f.md,
    mu: f.mdUntil,
    sh: f.shieldUntil,
    legs: f.legs.slice(-DRAGON_LEGS_MAX),
    blows: f.blows
      .slice(-DRAGON_BLOWS_KEPT)
      .map((b) => ({ i: b.i, a: b.a, at: b.at, wu: b.wu, s: b.s, ...(b.sp ? { sp: b.sp } : {}) })),
    ma: f.ma ?? 0,
    n: Object.values(f.players).filter((p) => !p.retired).length,
    lv: f.leaveAt,
    op: f.openUntil,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n } : null,
    gone: f.gone ? f.gone.at : null,
  };
}
