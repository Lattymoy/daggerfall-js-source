// @ts-check
// SD8a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S LAW -
// the Last Moment's fight, as the gate's Warden's is (net/gateBrain.js): pure (the moment and a [0,1) source handed in,
// no I/O), the relay's to run (SD8b) and every screen's to read. What the Warp kept of the Numidium: a brass colossus four
// times a man's height, its chest an open cage about a heart of shattered soul-gem light - the Mantella's echo.
//
//   THE FIGHT (newRemnantFight): one at a time in a realm room, born with the first fighter's `in`; the Remnant wakes
//     SD_OPENING_MS on. Each fighter who enters brings SD_TTK_S of its reference damage x SD_SHARE_X to its health, at
//     the fraction it stands at (the gate's law - joinRemnant), one seat an account, SD_FIGHTERS_MAX at most. A fight no
//     living fighter has stood in for SD_LOST_MS is LOST, and the next is fresh: it is meant to be lost, many times.
//   BELIEF (applyRemnantHit, applyEchoHit, applyHeartHit): the gate's hand and purse (net/gateBrain.js spendBlow,
//     spendPurse - one blow rate and one damage bucket for every body in the fight), a pose in the arena, a melee blow
//     within reach of the body it meets. A phase holds its floor: no blow takes the Remnant past the phase it is in
//     before the beat turns it.
//   THREE PHASES (SD_PHASE_NAMES):
//     1 THE WALKING HOUR (100% to 70%) - it walks at whoever it has chosen and strikes: the BRASS STOMP (a 7 m circle,
//       then a shock ring rolling out to 22 m - a body on the ground as the ring passes is struck: it is jumped), the
//       HOUR-HAND (a beam from its chest sweeping half the arena in 4 s - outrun, or kept behind a pillar) and the GEAR
//       VOLLEY (gears thrown at five fighters, 3 m circles, the brass burning 6 s where they fall).
//     2 THE DRAGON BREAK (70% to 35%) - it steps outside time (no blow lands on it) and two Echoes of it stand in the
//       arena, GOLD and SILVER, each with half of what is left to the break's end. They must fall within SD_ECHO_PAIR_MS
//       of each other: one left alone that long rises again with half its health. While both stand each fights with the
//       Stomp and the Volley, faster (SD_FAST), and every SD_ECHO_HAND_EVERY_MS the Hour-Hand sweeps from both at once -
//       each holds for the other, then both turn it, gold one way and silver the other; one left alone fights with all
//       three.
//     3 THE LAST MOMENT (35% to 0) - it returns, faster; every SD_RESET_EVERY_MS it winds up THE RESET while Hearts rise
//       about the arena (heartCountFor the living): every one broken before it lands and it is stunned SD_STUN_MS and
//       takes SD_STUN_HIT_X; one left and it lands - SD_RESET_PCT of everyone's health, no save - and it heals
//       SD_RESET_HEAL of its own.
//   THE HOUR'S OWN BLOWS - the clock's, not the Remnant's (body SD_BODY.hour): THE MANTELLA PULSE every
//     SD_PULSE_EVERY_MS from the wake through every phase (the whole arena, pulsePct - SD_PULSE_STEP more each pulse, no
//     save), and THE HOUR ENDS SD_ENDS_MS after the wake: every SD_END_EVERY_MS from then, SD_END_PCT of everyone's
//     health - a group that cannot finish it in fifteen minutes does not.
//   Every blow is a share of the STRUCK player's own health and a base (the gate's law), judged on the struck player's own
//   machine from the words said here (stompRingAt, handSwept, behindPillar - the geometry both ends read); the relay
//   never learns who was struck. No element: no resistance answers any of it.
//
// The fight's frame is the ARENA's: its centre the origin, the realm's axes (net/sdBrain.js SD_ARENA; arenaOf).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ARENA, SD_PILLAR_R, SD_PILLAR_W } from './sdBrain.js';
import { SD_FIGHTERS_MAX } from './sdLaw.js';
import {
  dpsRef, clampLv, BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, HIT_KINDS, MELEE_REACH, POSE_SLACK, ABSENT_RETIRE_MS, THREAT_PICK,
  THREAT_DECAY, STEP_MAX_MS, HP_SEND_MS, STATE_SEND_MS, REPEAT_MAX, TARGET_HOLD_MS, BREATH_MS, MOVE_RESAY_M, MOVE_RESAY_MS,
  standsAt, retireShare, restoreShare, freeSeat, topDealers, damageChart, chooseAttack, wrapYaw, spendBlow, spendPurse,
} from './gateBrain.js';

// ── the numbers ────────────────────────────────────────────────────────
/** A fighter's share of its health: SD_TTK_S seconds of its reference damage (net/gateBrain.js dpsRef), x SD_SHARE_X -
 *  nearly twice the Warden's. The most fighters a fight takes is the record's own bound (net/sdLaw.js SD_FIGHTERS_MAX -
 *  the gate's seat bound, one home on the wire). */
export const SD_TTK_S = 420;
export const SD_SHARE_X = 1.25;
/** It wakes this long after the fight is born; a fight no living fighter has stood in this long is lost. */
export const SD_OPENING_MS = 8000;
export const SD_LOST_MS = 30_000;
/** The phases' floors (its health over its whole), their names, and the moment a turn takes (the break's stepping out of
 *  time while the Echoes rise; its return). */
export const SD_PHASE_AT = Object.freeze([0.7, 0.35]);
export const SD_PHASE_NAMES = Object.freeze(['The Walking Hour', 'The Dragon Break', 'The Last Moment']);
export const SD_BREAK_MS = 2500;
/** The bodies, by the wire's `b`: the Remnant, the Echoes (GOLD and SILVER), and the Hour - its clock's blows. */
export const SD_BODY = Object.freeze({ remnant: 0, gold: 1, silver: 2, hour: 3 });
/** The Remnant's body (its radius - a blow's reach is measured to it - its height, its walk) and how far from the arena's
 *  centre it keeps; an Echo's; and where the Echoes stand up. */
export const SD_REM = Object.freeze({ r: 2.2, h: 7.2, speed: 2.6, keep: 18 });
export const SD_ECHO = Object.freeze({ r: 1.7, h: 5.6, speed: 3.0 });
export const SD_ECHO_SPOTS = Object.freeze([Object.freeze([-9, 2]), Object.freeze([9, 2])]);
/** Where it stands at the fight's birth (facing the way in, -z) and where it returns to for the Last Moment. */
export const SD_REM_START = Object.freeze([0, 8]);
/** The Echoes' and the Last Moment's wind-ups (a share of the Walking Hour's), and the Last Moment's walk. */
export const SD_FAST = 0.8;
export const SD_LAST_SPEED_X = 1.25;
/** The Echoes must fall within this long of each other. */
export const SD_ECHO_PAIR_MS = 15_000;
/** The pair's Hour-Hand: the first this long after they rise, each after the last began - from both at once. */
export const SD_ECHO_HAND_FIRST_MS = 5000;
export const SD_ECHO_HAND_EVERY_MS = 14_000;
/** After a blow cast from afar it walks in this long before it chooses again - unless its chosen comes within its stomp. */
export const SD_WALK_IN_MS = 3000;
/** THE RESET: the first this long into the Last Moment, each after the last's end; what it takes and what it heals. */
export const SD_RESET_FIRST_MS = 50_000;
export const SD_RESET_EVERY_MS = 50_000;
export const SD_RESET_PCT = 0.7;
export const SD_RESET_HEAL = 0.08;
/** THE HEARTS the Reset raises: 3, and one for every two living fighters, 8 at most; their body; where they rise (a ring
 *  about the centre, so far apart, so far from a pillar); their health - SD_HEART.teamS seconds of the living's reference
 *  damage between them, SD_HEART.min at least each. They take no blow in the Reset's last SD_HEARTS_CLOSE_MS. */
export const SD_HEARTS = Object.freeze([3, 8]);
export const heartCountFor = (n) => Math.max(SD_HEARTS[0], Math.min(SD_HEARTS[1], SD_HEARTS[0] + Math.floor(Math.max(0, n) / 2)));
export const SD_HEART = Object.freeze({ r: 0.9, h: 2.4, ring: Object.freeze([8, 22]), gap: 6, pillarGap: 3, teamS: 3, min: 20 });
export const heartHpFor = (lvs, n) => Math.max(SD_HEART.min, Math.round((SD_HEART.teamS * lvs.reduce((s, lv) => s + dpsRef(lv), 0)) / Math.max(1, n)));
export const SD_HEARTS_CLOSE_MS = 500;
export const SD_STUN_MS = 8000;
export const SD_STUN_HIT_X = 1.5;
/** THE MANTELLA PULSE: every this long from the wake; the first's share, and how much more each after. */
export const SD_PULSE_EVERY_MS = 30_000;
export const SD_PULSE_PCT = 0.12;
export const SD_PULSE_STEP = 0.02;
export const pulsePct = (n) => SD_PULSE_PCT + SD_PULSE_STEP * Math.max(0, Math.floor(Number(n) || 0));
/** THE HOUR ENDS: this long after the wake; then every SD_END_EVERY_MS, SD_END_PCT of everyone's health. */
export const SD_ENDS_MS = 15 * 60_000;
export const SD_END_EVERY_MS = 2000;
export const SD_END_PCT = 0.99;
/** The arena's four brass pillars in its frame (world/sdRealm.js stands them: on the diagonals, SD_PILLAR_R out), each a
 *  square SD_PILLAR_W across - the Hour-Hand's shade. */
export const SD_PILLARS = Object.freeze([0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return Object.freeze([Math.cos(a) * SD_PILLAR_R, Math.sin(a) * SD_PILLAR_R]); }));

// ── the blows ──────────────────────────────────────────────────────────
// `shape` is what the ground shows and what a struck player's machine tests its own feet against (the gate's law):
//   stomp - a disc `r` about its feet as it lands; then a ring rolling out from `r` to `r1` at `wave` m/s (its front
//           `width` thick) over `active` - struck by the ring only on the ground (`ringPct`, `ringBase`)
//   sweep - a beam from its chest `len` long and `width` wide, swept `arc` about its facing over `active` - `sw` the way
//           it turns (1 the way the bearing grows); a pillar between it and a body shades the body
//   disc  - `r` about each of `max` fighters' feet; `pool` the brass it leaves burning (a share and a base a second)
//   all   - the whole arena
// `pct` is the share of the STRUCK player's own maximum health and `base` the points on top; `aim` where it is laid,
// `range` how near (past its body) its chosen must be, `w` its weight in the choice; `windup` from the word to the
// landing, `active` the landing's span, `recover` its stillness after.
export const SD_BLOWS = Object.freeze({
  stomp: Object.freeze({ id: 0, key: 'stomp', name: 'Brass Stomp', windup: 1800, active: 1500, recover: 1200, shape: 'stomp', r: 7, r1: 22, wave: 10, width: 1.2, pct: 0.5, base: 14, ringPct: 0.3, ringBase: 8, aim: 'self', range: 5, w: 2 }),
  hand: Object.freeze({ id: 1, key: 'hand', name: 'The Hour-Hand', windup: 1600, active: 4000, recover: 1000, shape: 'sweep', len: 34, width: 3, arc: Math.PI, pct: 0.45, base: 12, aim: 'target', range: 40, w: 2 }),
  volley: Object.freeze({ id: 2, key: 'volley', name: 'Gear Volley', windup: 2000, active: 300, recover: 900, shape: 'disc', r: 3, max: 5, pct: 0.4, base: 10, aim: 'players', range: 40, w: 2, pool: Object.freeze({ r: 3, ms: 6000, pct: 0.06, base: 3 }) }),
  pulse: Object.freeze({ id: 3, key: 'pulse', name: 'Mantella Pulse', windup: 2500, active: 300, recover: 0, shape: 'all', pct: SD_PULSE_PCT, base: 0, aim: 'all', range: 999, w: 0 }),
  reset: Object.freeze({ id: 4, key: 'reset', name: 'The Reset', windup: 8000, active: 600, recover: 1800, shape: 'all', pct: SD_RESET_PCT, base: 0, aim: 'all', range: 999, w: 0 }),
  end: Object.freeze({ id: 5, key: 'end', name: 'The Hour Ends', windup: 2000, active: 0, recover: 0, shape: 'all', pct: SD_END_PCT, base: 0, aim: 'all', range: 999, w: 0 }),
});
/** The blows by their wire id. */
export const SD_BLOW_BY_ID = Object.freeze(Object.values(SD_BLOWS).sort((a, b) => a.id - b.id));
/** The ones a body chooses among (the Pulse and the End are the clock's, the Reset the Last Moment's turn). */
const CHOSEN = Object.freeze([SD_BLOWS.stomp, SD_BLOWS.hand, SD_BLOWS.volley]);
/** A blow's wind-up for `body` in `phase`: the Echoes' and the Last Moment's faster; the clock's and the Reset never. */
export const windupFor = (A, phase, body) => (CHOSEN.includes(A) && (body === SD_BODY.gold || body === SD_BODY.silver || phase >= 3) ? Math.round(A.windup * SD_FAST) : A.windup);
/** The blows `gap` metres past its body allows - the last one left out when another is open, never a REPEAT_MAX+1th time
 *  running (`run`, how many times running the last was used): nothing then, and it walks in. `pair`: an Echo whose pair
 *  stands - the Hour-Hand is the pair's, not its own. */
export function blowsFor(gap, lastA = -1, run = 1, pair = false) {
  const out = CHOSEN.filter((A) => gap <= A.range && !(pair && A === SD_BLOWS.hand));
  const fresh = out.filter((A) => A.id !== lastA);
  return fresh.length ? fresh : run >= REPEAT_MAX ? [] : out;
}

// ── the frame and the geometry both ends read ─────────────────────────
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const r2 = (v) => Math.round(v * 100) / 100;
/** A point of the realm's frame in the arena's. */
export const arenaOf = (x, z) => [x - SD_ARENA.x, z - SD_ARENA.z];
/** Whether a point of the arena's frame stands on it (`pad` past its rim). */
export const inArena = (x, z, pad = 0) => Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) <= SD_ARENA.r + pad;
/** A point kept within `r` of the arena's centre. */
export function keepInArena(x, z, r) {
  const d = Math.hypot(x, z);
  return d <= r ? [x, z] : [(x / d) * r, (z / d) * r];
}
/** The STOMP's ring: how far out its front stands at `now` (null outside its roll). */
export function stompRingAt(atk, now) {
  const A = SD_BLOWS.stomp, k = now - atk.at;
  if (!(k >= 0 && k <= A.active)) return null;
  return Math.min(A.r1, A.r + (A.wave * k) / 1000);
}
/** Whether the STOMP's ring passed a body `d` metres from its centre between `t0` and `t1` - its front's whole width. */
export function ringPassed(atk, d, t0, t1) {
  const A = SD_BLOWS.stomp, a = Math.max(t0, atk.at), b = Math.min(t1, atk.at + A.active);
  if (!(b >= a)) return false;
  const r0 = A.r + (A.wave * (a - atk.at)) / 1000, r1 = A.r + (A.wave * (b - atk.at)) / 1000;
  return d >= r0 - A.width / 2 && d <= Math.min(A.r1, r1) + A.width / 2;
}
/** The HOUR-HAND's beam at `now`: its bearing from where it was cast (null outside its sweep). */
export function handAngleAt(atk, now) {
  const A = SD_BLOWS.hand, k = (now - atk.at) / A.active;
  if (!(k >= 0 && k <= 1)) return null;
  return wrapYaw(atk.yw + (atk.sw ?? 1) * (-A.arc / 2 + A.arc * k));
}
/** Whether the HOUR-HAND swept over a body at (x, z) between `t0` and `t1`: within its length, the beam's width at that
 *  distance about the body's bearing crossed by the sweep. Shade is behindPillar's, apart. */
export function handSwept(atk, x, z, t0, t1) {
  const A = SD_BLOWS.hand, d = dist(x, z, atk.x, atk.z);
  if (d > A.len) return false;
  const k0 = Math.max(0, (t0 - atk.at) / A.active), k1 = Math.min(1, (t1 - atk.at) / A.active);
  if (!(k1 >= k0)) return false;
  const half = d > A.width / 2 ? Math.asin(A.width / 2 / d) : Math.PI;
  const u = (atk.sw ?? 1) * wrapYaw(Math.atan2(x - atk.x, z - atk.z) - atk.yw) + A.arc / 2;   // its place along the sweep, 0 to arc
  return u + half >= A.arc * k0 && u - half <= A.arc * k1;
}
/** Whether a pillar stands between (ox, oz) and (x, z) - the segment meets one's square, short of the far end. */
export function behindPillar(ox, oz, x, z) {
  const w = SD_PILLAR_W / 2;
  for (const [px, pz] of SD_PILLARS) {
    let t0 = 0, t1 = 1;
    const d = [x - ox, z - oz], o = [ox, oz], lo = [px - w, pz - w], hi = [px + w, pz + w];
    let hit = true;
    for (let k = 0; k < 2 && hit; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) hit = false; continue; }
      let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) hit = false;
    }
    if (hit && t0 < 1) return true;
  }
  return false;
}

// ── the fight ──────────────────────────────────────────────────────────
/** A body's walk and blow: where it stands and faces, the walk said (`mv`), the blow in flight, the last blow and how many
 *  times running, when it was last free and may next choose, whom it has chosen and since when. */
const newBody = (x, z, yw) => ({ x, z, yw, mv: null, atk: null, lastA: -1, runA: 0, freeAt: 0, nextAt: 0, walkUntil: 0, tg: null, tgAt: 0 });

/**
 * A fresh fight in slot `s`, its number `fi` (the room's count - every screen knows a fresh one by it): nobody in it, the
 * Remnant at SD_REM_START facing the way in, no health until someone brings some; it wakes at `op`.
 * @param {number} s @param {number} fi @param {number} now
 */
export function newRemnantFight(s, fi, now) {
  const op = now + SD_OPENING_MS;
  return {
    v: 1, s, fi, startedAt: now, op, phase: 1, hp: 0, max: 0,
    rem: newBody(SD_REM_START[0], SD_REM_START[1], Math.PI), outUntil: 0,
    /** @type {null | Array<{e: number, h: number, m: number, up: number, downAt: number | null, body: ReturnType<typeof newBody>}>} */
    ec: null,
    /** the pair's next Hour-Hand (the Dragon Break's) */
    ecHandAt: 0,
    seq: 0,
    /** the Hour's blow in flight (the Pulse, the End), how many Pulses there have been, and when the next comes */
    clock: null, pulses: 0, pulseAt: op + SD_PULSE_EVERY_MS, endsAt: op + SD_ENDS_MS,
    /** @type {{at: number} | null} */
    ended: null,
    /** the next Reset (0 none armed), the Hearts of the one in flight ({i, m, c: [{x, z, h}]}), the stun */
    resetAt: 0, cx: null, cxSent: '', cxSentAt: 0, stunUntil: 0,
    /** @type {Record<string, any>} */
    players: {},
    /** @type {Record<string, number>} */
    threat: {}, target: null, liveMs: 0, emptySince: null,
    /** @type {{at: number, top: string[], n: number, dm?: ReturnType<typeof damageChart>} | null} */
    fell: null,
    /** @type {{at: number} | null} */
    lost: null,
    lastHpAt: 0, lastHpSent: -1, ecSent: '', ecSentAt: 0, lastStateAt: now, lastTickAt: now,
  };
}
/** A fight no new blow changes: fallen, lost, or past its Hour. */
const over = (f) => !!(f.fell || f.lost || f.ended);
/** The fight's floor in its phase: no blow takes it past the phase it is in. */
const floorOf = (f) => (f.phase === 1 ? SD_PHASE_AT[0] * f.max : f.phase === 2 ? SD_PHASE_AT[1] * f.max : 0);
/** Whether the Remnant can be struck now: awake, inside time, not past its return. */
export const remnantOpen = (f, now) => !over(f) && now >= f.op && f.phase !== 2 && now >= (f.outUntil ?? 0);
/** THE DRAGON BREAK'S POOL kept true: its health is the break's floor and what the Echoes stand for - a share coming or
 *  going (a newcomer, a retired fighter) moves the whole at the fraction it stands at, and the Echoes with it. */
function rescaleEchoes(f) {
  if (f.phase !== 2 || !f.ec) return;
  const pool = Math.max(0, f.hp - SD_PHASE_AT[1] * f.max), sum = f.ec.reduce((s, E) => s + E.h, 0);
  if (!(sum > 0) || Math.abs(pool - sum) < 1e-9) return;
  const k = pool / sum;
  for (const E of f.ec) { E.h *= k; E.m *= k; }
}

/**
 * A fighter steps into the fight - the gate's law (net/gateBrain.js joinFight): SD_TTK_S x dpsRef x SD_SHARE_X at the
 * fraction it stands at, an empty bucket for one who comes to it bled, its first claim kept; a full fight frees an idle
 * seat over `present`. A fight over takes nobody new.
 * @param {Set<string>|null} [present]
 */
export function joinRemnant(f, sub, name, lv, now, present = null) {
  const known = f.players[sub];
  if (known) {
    if (typeof name === 'string' && name) known.name = name.slice(0, 24);
    if (!over(f)) { known.seenAt = now; restoreShare(f, known); rescaleEchoes(f); }
    return true;
  }
  if (over(f)) return false;
  if (Object.keys(f.players).length >= SD_FIGHTERS_MAX && !freeSeat(f, present)) return false;
  const level = clampLv(lv), share = SD_TTK_S * dpsRef(level) * SD_SHARE_X, frac = standsAt(f), fresh = frac >= 1;
  f.max += share;
  f.hp += share * frac;
  rescaleEchoes(f);
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: level, share, dealt: 0, clipped: 0,
    bucket: fresh ? BUCKET_DEPTH_X * dpsRef(level) : 0, bucketAt: now, rate: GATE_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
    seenAt: now, retired: false, cxd: 0, hits: 0, best: 0, falls: 0, down: false, ed: 0,
  };
  return true;
}

const poseIn = (pose) => !!pose && Number.isFinite(pose.x) && Number.isFinite(pose.z) && inArena(pose.x, pose.z, POSE_SLACK);
const struck = (f, sub, p, got) => { if (got > 0) { f.threat[sub] = (f.threat[sub] ?? 0) + got; p.hits = (p.hits ?? 0) + 1; p.best = Math.max(p.best ?? 0, got); } };

/**
 * A blow on the Remnant from `sub` standing at `pose` ({x, z}, the arena's frame), of kind `r`, claiming `d`: the damage
 * ACCEPTED. Refused: a stranger, a fight over, the Remnant asleep or outside time, past the blow rate, a pose off the
 * arena, a melee blow out of reach. Clipped (and counted): the cap, the bucket - and the phase's floor. A stunned Remnant
 * takes it heavier. The Last Moment's last blow fells it.
 */
export function applyRemnantHit(f, sub, d, r, pose, now, seq = null) {
  const p = f.players[sub];
  if (!p || !remnantOpen(f, now) || !Number.isFinite(d) || !(d > 0)) return 0;
  if (!spendBlow(p, now, seq, 'b')) return 0;
  if (!poseIn(pose)) return 0;
  const B = f.rem;
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, B.x, B.z) - SD_REM.r > MELEE_REACH + POSE_SLACK) return 0;
  const got = spendPurse(p, d * (now < f.stunUntil ? SD_STUN_HIT_X : 1), Math.max(0, f.hp - floorOf(f)), now);
  struck(f, sub, p, got);
  f.hp -= got;
  if (f.phase === 3 && f.hp <= 1e-6 && f.max > 0) fall(f, now);
  return got;
}
/** It falls: where it stands, the fight's best and every fighter's part (the gate's chart), everything in flight gone. */
function fall(f, now) {
  stepWalk(f.rem, now);
  f.hp = 0;
  f.fell = { at: now, top: topDealers(f, 3), n: Object.keys(f.players).length, dm: damageChart(f) };
  f.rem.mv = null; f.rem.atk = null; f.cx = null; f.clock = null;
}

/** The Echoes as the wire says them: each [health, whole, up (when it stands), fallen (0 standing)]. */
const echoesOf = (f) => (f.ec ? f.ec.map((E) => [Math.ceil(E.h), Math.ceil(E.m), E.up, E.downAt ?? 0]) : null);
/**
 * A blow on Echo `e` (0 GOLD, 1 SILVER) - the same hand and purse, a pose in the arena, a melee blow within reach of its
 * body; only in the Dragon Break, only one standing. What lands comes off the Remnant's whole too (its bar is the
 * break's floor and the Echoes). Answers the frames to fan: its fall (`ec`, by the striker's name).
 */
export function applyEchoHit(f, sub, e, d, r, pose, now, seq = null) {
  const out = [];
  const p = f.players[sub], E = f.phase === 2 && f.ec && Number.isInteger(e) ? f.ec[e] ?? null : null;
  if (!p || over(f) || !E || !(E.h > 0) || now < E.up || !Number.isFinite(d) || !(d > 0)) return out;
  if (!spendBlow(p, now, seq, `e${e}`)) return out;
  if (!poseIn(pose)) return out;
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, E.body.x, E.body.z) - SD_ECHO.r > MELEE_REACH + POSE_SLACK) return out;
  const got = spendPurse(p, d, E.h, now);
  struck(f, sub, p, got);
  p.ed = (p.ed ?? 0) + got;
  E.h -= got;
  f.hp -= got;
  if (E.h > 1e-6) return out;
  E.h = 0;
  E.downAt = now;
  stepWalk(E.body, now);
  E.body.atk = null; E.body.mv = null;
  f.ecSent = JSON.stringify(echoesOf(f)); f.ecSentAt = now;
  out.push({ k: 'ec', e: echoesOf(f), d: e, n: p.name, at: now });
  return out;
}

/** The Reset's Hearts take blows only while it still winds up, and not in its last SD_HEARTS_CLOSE_MS. */
export const heartsOpen = (f, now) => !!f.rem.atk && f.rem.atk.a === SD_BLOWS.reset.id && !!f.cx && now < f.rem.atk.at - SD_HEARTS_CLOSE_MS;
/**
 * A blow on Heart `c` of the Reset in flight - the same hand and purse, a pose in the arena, a melee blow within reach of
 * it; counted as dealt (a Heart broken is a part in the fight). Answers the frames to fan: a Heart broken (`cxb`, by
 * whom), and with the last THE RESET BROKEN - called off, the Remnant stunned SD_STUN_MS (`stun`); the next comes
 * SD_RESET_EVERY_MS after the stun.
 */
export function applyHeartHit(f, sub, c, d, r, pose, now, seq = null) {
  const out = [];
  const p = f.players[sub], X = f.cx, q = X && Number.isInteger(c) ? X.c[c] ?? null : null;
  if (!p || over(f) || !q || !(q.h > 0) || !Number.isFinite(d) || !(d > 0) || !heartsOpen(f, now)) return out;
  if (!spendBlow(p, now, seq, `x${c}`)) return out;
  if (!poseIn(pose)) return out;
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, q.x, q.z) - SD_HEART.r > MELEE_REACH + POSE_SLACK) return out;
  const got = spendPurse(p, d, q.h, now);
  p.cxd = (p.cxd ?? 0) + got;
  q.h -= got;
  if (q.h > 1e-6) return out;
  q.h = 0;
  out.push({ k: 'cxb', i: X.i, c, n: p.name, at: now });
  if (X.c.every((o) => o.h <= 0)) {
    f.cx = null;
    stepWalk(f.rem, now);
    f.rem.atk = null; f.rem.mv = null; f.rem.tg = null;
    f.stunUntil = now + SD_STUN_MS;
    f.rem.nextAt = f.stunUntil;
    f.resetAt = f.stunUntil + SD_RESET_EVERY_MS;
    out.push({ k: 'stun', until: f.stunUntil, at: now });
  }
  return out;
}

// ── the beat ───────────────────────────────────────────────────────────
/** Whom a body goes at: THREAT_PICK of the time the living fighter in the arena with the most threat, else any living. */
function chooseTarget(f, here, rng) {
  if (!here.length) return null;
  if (rng() < THREAT_PICK) {
    let best = null, t = 0;
    for (const b of here) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return here[Math.floor(rng() * here.length) % here.length];
}
/** Where a body's said walk has taken it by `now`. */
function stepWalk(B, now) {
  const m = B.mv;
  if (!m) return;
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) { B.x = m.tx; B.z = m.tz; return; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  [B.x, B.z] = keepInArena(m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along, SD_REM.keep);
}
const bodyR = (b) => (b === SD_BODY.remnant ? SD_REM.r : SD_ECHO.r);
const speedOf = (f, b) => (b === SD_BODY.remnant ? SD_REM.speed * (f.phase >= 3 ? SD_LAST_SPEED_X : 1) : SD_ECHO.speed);
const mvFrame = (b, B, now) => ({ k: 'mv', b, x: r2(B.mv ? B.mv.x : B.x), z: r2(B.mv ? B.mv.z : B.z), tx: r2(B.mv ? B.mv.tx : B.x), tz: r2(B.mv ? B.mv.tz : B.z), v: B.mv ? B.mv.v : 0, at: B.mv ? B.mv.at : now });
/** A body walks at its chosen, stopping short by its body and a little - a new segment said when its goal moved far or
 *  long enough ago (the gate's law). */
function walkToward(f, b, B, target, now, out) {
  stepWalk(B, now);
  const dx = target.x - B.x, dz = target.z - B.z, d = Math.hypot(dx, dz);
  const stop = Math.max(0, d - (bodyR(b) + 1));
  const [tx, tz] = keepInArena(B.x + (d > 0 ? (dx / d) * stop : 0), B.z + (d > 0 ? (dz / d) * stop : 0), SD_REM.keep);
  const m = B.mv;
  if (m && dist(m.tx, m.tz, tx, tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  B.mv = { x: B.x, z: B.z, tx, tz, v: speedOf(f, b), at: now };
  if (d > 0) B.yw = Math.atan2(dx, dz);
  out.push(mvFrame(b, B, now));
}
/** A blow as the wire says it. */
export function atkFrameOf(b, a) {
  return { k: 'atk', b, i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r2(a.yw), tg: a.tg.map((q) => [r2(q[0]), r2(q[1])]), ...(a.sw ? { sw: a.sw } : {}), ...(Number.isInteger(a.n) ? { n: a.n } : {}) };
}
/** Begin a blow: where it lands and when, said now so every screen draws its wind-up at once. */
function begin(f, b, B, A, now, target, here, rng, out, sw = 0) {
  const at = now + windupFor(A, f.phase, b);
  if (target) B.yw = Math.atan2(target.x - B.x, target.z - B.z);
  let tg = [];
  if (A === SD_BLOWS.volley) {
    const live = [...here];
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = live[i]; live[i] = live[j]; live[j] = t; }
    tg = live.slice(0, A.max).map((o) => keepInArena(o.x, o.z, SD_ARENA.r - 1));
  }
  const way = A === SD_BLOWS.hand ? (sw || (b === SD_BODY.silver ? -1 : b === SD_BODY.gold ? 1 : rng() < 0.5 ? 1 : -1)) : 0;
  B.atk = { i: ++f.seq, a: A.id, at, x: B.x, z: B.z, yw: B.yw, tg, until: at + A.active + A.recover, ...(way ? { sw: way } : {}) };
  out.push(atkFrameOf(b, B.atk));
}
/** One body's beat: its blow in flight held to its end; then a breath; then its chosen, and a blow it allows - else a
 *  walk in. `hold`: it stands, its blow done, for its pair's Hour-Hand; `pair`: its pair stands (the Hand is theirs). */
function beatBody(f, b, B, now, here, rng, out, { hold = false, pair = false } = {}) {
  if (B.atk) {
    if (now < B.atk.until) return;
    B.runA = B.atk.a === B.lastA ? B.runA + 1 : 1;
    B.lastA = B.atk.a;
    if (B.atk.a === SD_BLOWS.hand.id || B.atk.a === SD_BLOWS.volley.id) B.walkUntil = now + SD_WALK_IN_MS;   // a far blow: it walks in after
    B.freeAt = now;
    B.atk = null;
    B.nextAt = now + BREATH_MS;
  }
  if (hold) { stepWalk(B, now); if (B.mv) { B.mv = null; out.push(mvFrame(b, B, now)); } return; }
  if (now < B.nextAt) { stepWalk(B, now); return; }
  let target = B.tg ? here.find((o) => o.sub === B.tg) ?? null : null;
  if (!target || now - B.tgAt >= TARGET_HOLD_MS) {
    target = chooseTarget(f, here, rng);
    B.tg = target?.sub ?? null;
    B.tgAt = now;
  }
  if (!target) {
    if (B.mv) { stepWalk(B, now); B.mv = null; out.push(mvFrame(b, B, now)); }
    return;
  }
  stepWalk(B, now);
  const gap = dist(target.x, target.z, B.x, B.z) - bodyR(b);
  if (now - B.freeAt >= SD_WALK_IN_MS * 2) B.runA = 0;
  const near = gap <= SD_BLOWS.stomp.range;
  const can = now < B.walkUntil && !near ? [] : blowsFor(gap, B.lastA, B.runA, pair);
  if (!can.length) { walkToward(f, b, B, target, now, out); return; }
  if (B.mv) { B.mv = null; out.push(mvFrame(b, B, now)); }
  begin(f, b, B, chooseAttack(can, rng), now, target, here, rng, out);
}
/** THE PAIR'S HOUR-HAND: both Echoes free (their blows done), it sweeps from both at once - each at its own chosen, gold
 *  the way the bearing grows and silver the other - and the next is SD_ECHO_HAND_EVERY_MS on. */
function pairHand(f, standing, now, here, rng, out) {
  for (const X of standing) {
    const b = X.e === 0 ? SD_BODY.gold : SD_BODY.silver, B = X.body;
    if (B.atk) { B.runA = B.atk.a === B.lastA ? B.runA + 1 : 1; B.lastA = B.atk.a; B.freeAt = now; B.atk = null; }
    stepWalk(B, now);
    if (B.mv) { B.mv = null; out.push(mvFrame(b, B, now)); }
    const target = (B.tg ? here.find((o) => o.sub === B.tg) : null) ?? chooseTarget(f, here, rng);
    if (!target) continue;
    B.tg = target.sub; B.tgAt = now;
    begin(f, b, B, SD_BLOWS.hand, now, target, here, rng, out);
  }
  f.ecHandAt = now + SD_ECHO_HAND_EVERY_MS;
}

/** THE HEARTS rise as the Reset is called: heartCountFor the living, about the arena (SD_HEART.ring, SD_HEART.gap apart,
 *  clear of the pillars - the dice's, the relay's), each heartHpFor them. Said once (`cx`), their health as it falls
 *  (`cxh`), each one's breaking (`cxb`). */
function raiseHearts(f, now, here, rng, out) {
  const n = heartCountFor(here.length), m = heartHpFor(here.map((b) => f.players[b.sub].lv), n), spots = [];
  const [r0, r1] = SD_HEART.ring;
  for (let tries = 0; spots.length < n && tries < n * 80; tries++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(r0 * r0 + rng() * (r1 * r1 - r0 * r0));
    const x = r2(Math.sin(a) * r), z = r2(Math.cos(a) * r);
    if (spots.some((q) => dist(q[0], q[1], x, z) < SD_HEART.gap)) continue;
    if (SD_PILLARS.some(([px, pz]) => dist(px, pz, x, z) < SD_HEART.pillarGap)) continue;
    spots.push([x, z]);
  }
  for (let k = spots.length; k < n; k++) { const a = (k / n) * Math.PI * 2 + Math.PI / 8; spots.push([r2(Math.sin(a) * 12), r2(Math.cos(a) * 12)]); }   // a floor too crowded for the dice: a ring
  f.cx = { i: f.rem.atk.i, m, c: spots.map(([x, z]) => ({ x, z, h: m })) };
  f.cxSent = cxKey(f.cx); f.cxSentAt = now;
  out.push({ k: 'cx', i: f.cx.i, m, c: spots.map((q) => [q[0], q[1]]) });
}
const cxKey = (X) => X.c.map((q) => Math.ceil(q.h)).join(',');
function cxFrame(f, now, out) {
  if (!f.cx || now - f.cxSentAt < HP_SEND_MS) return;
  const key = cxKey(f.cx);
  if (key === f.cxSent) return;
  f.cxSent = key; f.cxSentAt = now;
  out.push({ k: 'cxh', i: f.cx.i, h: f.cx.c.map((q) => Math.ceil(q.h)) });
}
function hpFrame(f, now, out) {
  const h = Math.round(f.hp);
  if (h !== f.lastHpSent && now - f.lastHpAt >= HP_SEND_MS) { f.lastHpSent = h; f.lastHpAt = now; out.push({ k: 'hp', h, m: Math.round(f.max) }); }
}
function ecFrame(f, now, out) {
  if (!f.ec || now - f.ecSentAt < HP_SEND_MS) return;
  const key = JSON.stringify(echoesOf(f));
  if (key === f.ecSent) return;
  f.ecSent = key; f.ecSentAt = now;
  out.push({ k: 'ec', e: echoesOf(f), at: now });
}
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(remnantStateOf(f));
}
/** The Hour's own blow begun (the Pulse, the End): the whole arena, from no body. */
function clockBlow(f, A, at, out, n = null) {
  f.clock = { i: ++f.seq, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], until: at + A.active, ...(Number.isInteger(n) ? { n } : {}) };
  out.push(atkFrameOf(SD_BODY.hour, f.clock));
}

/**
 * ONE BEAT. `bodies` are the fight's players in the realm now ({sub, x, z, dead}, the arena's frame), `rng` a [0,1) source.
 * Answers the frames to send, in order ({k, ...} - the `sd` frame's kinds the relay stamps and fans). Moves the state.
 */
export function stepRemnant(f, now, bodies, rng) {
  const out = [];
  const dt = Math.min(STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  if (f.fell || f.lost) return out;
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && inArena(b.x, b.z, POSE_SLACK));
  for (const b of here) f.players[b.sub].stoodMs += dt;
  if (here.length) { f.liveMs += dt; f.emptySince = null; } else if (f.emptySince == null) f.emptySince = now;
  for (const b of bodies) { const p = f.players[b.sub]; if (!p) continue; if (b.dead && !p.down) p.falls = (p.falls ?? 0) + 1; p.down = !!b.dead; }
  // AUDIT SD II (L7 M2): a fighter is SEEN while its pose stands in the arena (alive or fallen there) - anywhere else in
  // the realm it is away, and its share leaves the Remnant ABSENT_RETIRE_MS on: four who said `in` and walked back to
  // the Threshold kept 34,000 health each in the Remnant from there, and six such made the Hour unwinnable for eight
  for (const b of bodies) { const p = f.players[b.sub]; if (p && inArena(b.x, b.z, POSE_SLACK)) { p.seenAt = now; restoreShare(f, p); } }
  for (const p of Object.values(f.players)) if (!p.retired && now - (p.seenAt ?? p.joinedAt) > ABSENT_RETIRE_MS) retireShare(f, p);
  rescaleEchoes(f);
  // LOST: nobody living has stood in the arena this long - the next fight is fresh. AUDIT SD: and an Hour ENDED is lost
  // SD_LOST_MS after its End, whoever's pose still says it stands there - a tab frozen in the arena held a fight nobody
  // could win, and the next could never begin
  if ((f.emptySince != null && now - f.emptySince >= SD_LOST_MS) || (f.ended && now - f.ended.at >= SD_LOST_MS)) {
    f.lost = { at: now };
    out.push({ k: 'lost', at: now });
    return out;
  }
  const keep = Math.pow(1 - THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  if (now < f.op) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
  // THE HOUR ENDS - the clock's: SD_ENDS_MS from the wake, every SD_END_EVERY_MS from then; nothing else is done
  const E = SD_BLOWS.end;
  if (f.ended || now >= f.endsAt - E.windup) {
    if (!f.ended) {
      f.ended = { at: f.endsAt };
      for (const B of [f.rem, ...(f.ec ?? []).map((x) => x.body)]) { stepWalk(B, now); B.mv = null; B.atk = null; }
      f.cx = null; f.stunUntil = 0;
      clockBlow(f, E, f.endsAt, out);
    } else if (now >= f.clock.at) clockBlow(f, E, f.clock.at + SD_END_EVERY_MS, out);
    hpFrame(f, now, out); stateFrame(f, now, out);
    return out;
  }
  // THE MANTELLA PULSE - the clock's, every SD_PULSE_EVERY_MS from the wake, whatever the phase
  const P = SD_BLOWS.pulse;
  if (f.clock && now >= f.clock.until) f.clock = null;
  if (!f.clock && now >= f.pulseAt - P.windup) { clockBlow(f, P, f.pulseAt, out, f.pulses); f.pulses++; f.pulseAt += SD_PULSE_EVERY_MS; }
  // THE DRAGON BREAK: it steps outside time, and the Echoes rise with half of what is left to the break's end each
  if (f.phase === 1 && f.max > 0 && f.hp <= SD_PHASE_AT[0] * f.max) {
    f.phase = 2;
    stepWalk(f.rem, now);
    f.rem.mv = null; f.rem.atk = null; f.rem.tg = null;
    const m = Math.max(0, f.hp - SD_PHASE_AT[1] * f.max) / 2, up = now + SD_BREAK_MS;
    f.ec = SD_ECHO_SPOTS.map(([x, z], e) => ({ e, h: m, m, up, downAt: null, body: { ...newBody(x, z, Math.PI), nextAt: up } }));
    f.ecHandAt = up + SD_ECHO_HAND_FIRST_MS;
    f.ecSent = JSON.stringify(echoesOf(f)); f.ecSentAt = now;
    out.push({ k: 'ph', n: 2, at: now, up });
    out.push({ k: 'ec', e: echoesOf(f), at: now });
  }
  if (f.phase === 2 && f.ec) {
    // the pair: one fallen and left alone SD_ECHO_PAIR_MS rises again with half its health; both fallen - the Last Moment
    const [g, s] = f.ec;
    if (g.h <= 0 && s.h <= 0) {
      f.phase = 3;
      f.ec = null;
      f.hp = Math.min(f.hp, SD_PHASE_AT[1] * f.max);
      f.outUntil = now + SD_BREAK_MS;
      f.rem = { ...newBody(0, 0, Math.PI), nextAt: f.outUntil };
      f.resetAt = f.outUntil + SD_RESET_FIRST_MS;
      out.push({ k: 'ph', n: 3, at: now, up: f.outUntil });
    } else {
      for (const X of f.ec) {
        if (X.h > 0 || X.downAt == null || now - X.downAt < SD_ECHO_PAIR_MS) continue;
        X.h = X.m / 2;
        f.hp += X.h;
        X.downAt = null;
        X.up = now + SD_BREAK_MS;
        X.body = { ...newBody(SD_ECHO_SPOTS[X.e][0], SD_ECHO_SPOTS[X.e][1], Math.PI), nextAt: X.up };
        f.ecSent = JSON.stringify(echoesOf(f)); f.ecSentAt = now;
        out.push({ k: 'ec', e: echoesOf(f), r: X.e, at: now });
      }
    }
  }
  // the bodies' beats: the Remnant (but in the Dragon Break) - stunned, it kneels; the Echoes standing
  if (f.phase === 2) {
    const standing = (f.ec ?? []).filter((X) => X.h > 0 && now >= X.up), both = standing.length === 2;
    const due = both && now >= f.ecHandAt;
    if (due && standing.every((X) => !X.body.atk || now >= X.body.atk.until) && here.length) pairHand(f, standing, now, here, rng, out);
    else for (const X of standing) beatBody(f, X.e === 0 ? SD_BODY.gold : SD_BODY.silver, X.body, now, here, rng, out, { hold: due, pair: both });
  } else if (now >= f.outUntil && now >= f.stunUntil) {
    const B = f.rem;
    // THE RESET: it lands - the Hearts unbroken - and heals; or one is due, and it is called, the Hearts rising
    if (B.atk && B.atk.a === SD_BLOWS.reset.id && now >= B.atk.at && f.cx) {
      f.cx = null;
      f.hp = Math.min(f.max, f.hp + SD_RESET_HEAL * f.max);
    }
    if (B.atk && B.atk.a === SD_BLOWS.reset.id && now >= B.atk.until) { f.resetAt = now + SD_RESET_EVERY_MS; }
    if (f.phase === 3 && !B.atk && f.resetAt > 0 && now >= f.resetAt && now >= B.nextAt) {
      stepWalk(B, now);
      if (B.mv) { B.mv = null; out.push(mvFrame(SD_BODY.remnant, B, now)); }
      f.resetAt = 0;
      begin(f, SD_BODY.remnant, B, SD_BLOWS.reset, now, null, here, rng, out);
      raiseHearts(f, now, here, rng, out);
    } else beatBody(f, SD_BODY.remnant, B, now, here, rng, out);
  }
  hpFrame(f, now, out);
  ecFrame(f, now, out);
  cxFrame(f, now, out);
  stateFrame(f, now, out);
  return out;
}

/** A body as the state says it: where it stands and faces, its walk, its blow in flight. */
const bodyOf = (b, B) => ({ x: r2(B.x), z: r2(B.z), yw: r2(B.yw), mv: B.mv ? { x: r2(B.mv.x), z: r2(B.mv.z), tx: r2(B.mv.tx), tz: r2(B.mv.tz), v: B.mv.v, at: B.mv.at } : null, atk: B.atk ? atkFrameOf(b, B.atk) : null });
/** The whole state as the wire says it (the `st` kind): on entering, and every STATE_SEND_MS. */
export function remnantStateOf(f) {
  return {
    k: 'st', s: f.s, fi: f.fi, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max), op: f.op, ou: f.outUntil ?? 0,
    rem: bodyOf(SD_BODY.remnant, f.rem),
    ec: f.ec ? f.ec.map((E) => ({ h: Math.ceil(E.h), m: Math.ceil(E.m), up: E.up, dn: E.downAt ?? 0, ...bodyOf(E.e === 0 ? SD_BODY.gold : SD_BODY.silver, E.body) })) : null,
    clk: f.clock ? atkFrameOf(SD_BODY.hour, f.clock) : null, pu: f.pulses, pa: f.pulseAt, ends: f.endsAt, ended: f.ended ? f.ended.at : 0,
    cx: f.cx ? { i: f.cx.i, m: f.cx.m, c: f.cx.c.map((q) => [q.x, q.z, Math.ceil(q.h)]) } : null,
    // AUDIT SD II (L6 F24): `n` the fighters whose share stands in it now - the bar's "N in the arena" (every seat the
    // fight ever took counted the cast-out and the gone)
    su: f.stunUntil > 0 ? f.stunUntil : 0, rk: f.resetAt > 0 ? f.resetAt : 0, n: Object.values(f.players).filter((p) => !p.retired).length,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null,
    lost: f.lost ? f.lost.at : 0,
  };
}
