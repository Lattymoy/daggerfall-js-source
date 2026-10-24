// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md section 7): THE TONAL WARDEN'S LAW - the bridge's fight, as the Brass Remnant's
// is the Hour's (net/superDungeon/sdRemnant.js, its shape kept rung for rung): pure (the moment and a [0,1) source handed
// in), the relay's to run and every screen's to read. What the Rourken left at the Ketch's helm: a construct twice a man's
// height in tonal brass, a tuning-fork's tines for a crown, its chest a resonating chamber that keeps the ship's
// keel-song true - the steersman that has flown her alone since its masters went.
//
//   THE FIGHT (newWardenFight): one at a time on a ship's bridge, born with the first fighter's `in`; it wakes
//     KW_OPENING_MS on. Each fighter brings KW_TTK_S of its reference damage to its health at the fraction it stands at (the
//     gate's law), one seat an account, the crew's KT_CREW_MAX at most. A fight no living fighter has stood on the bridge
//     for KW_LOST_MS is LOST: the Warden stands whole again at its helm, its resonators false, and the next `in` is fresh.
//   BELIEF: the crew's one hand and purse (the voyage's record of each member - net/ketch/ketchBrain.js, the gate's
//     spendBlow and spendPurse), a pose on the bridge, a melee blow within reach. A phase holds its floor.
//   THREE PHASES (their floors KW_PHASE_AT; their names the page's, systems/ketch/ketchWords.js ketchPhaseName):
//     1 THE STEERSMAN (100% to 65%) - it walks at whoever it has chosen and strikes: the KEEL-STRIKE (a lane 26 m down its
//       facing), the STEAM LASH (a cone of fire 150 degrees across), the TONAL RING (a disc about it, then the wave rolling
//       out of it to 20 m - jumped).
//     2 THE DISCORD (65% to 35%) - it puts its ship out of tune to save itself: WARDED (no blow lands) while any of the
//       bridge's four RESONATORS is false. A resonator is put right with an aether cell from the bridge's two cradles,
//       carried to it and set (the Starved Engine's own law - net/ketch/ketchBrain.js): every KW_DISCORD_EVERY_MS while any
//       stands false, THE DISCORD - KW_DISCORD_PCT of everyone's health, no save. It still fights, quicker (KW_FAST), and
//       two Sentries climb onto the bridge. All four true: its ward breaks, it is STUNNED KW_STUN_MS and takes KW_STUN_HIT_X.
//     3 THE LAST NOTE (35% to 0) - quicker still; every KW_SONG_EVERY_MS it sings THE KEEL-SONG while TUNING-FORKS rise on
//       the core (forkCountFor the living): every one broken before it lands and it is stunned; one left and it lands -
//       KW_SONG_PCT of everyone's health, no save - and it heals KW_SONG_HEAL. And THE OUTER RING GIVES WAY: every
//       KW_SECTION_EVERY_MS two of its eight sections shudder KW_SECTION_WARN_MS and fall away for KW_SECTION_GONE_MS (a
//       body on one falls - the nets cast it back, net/ketch/ketchLaw.js castBack - and the bridge comes back together).
//   THE KETCH TURNS WEST: KW_ENDS_MS after the wake, every KW_END_EVERY_MS, KW_END_PCT of everyone's health - a crew that
//     cannot fell it in fourteen minutes does not.
//   Every blow a FULL SHAPE STAMP (net/eliteGates/egShape.js), judged on the struck player's own machine; the relay
//   counts the plain ones on its trails (judgeWarden).
//
// The fight's frame is the DECK's (net/ketch/ketchDeck.js): the bridge's centre at KT_BRIDGE.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_BRIDGE, KT_WARDEN_HOME, KT_FORK_RING, KT_SECTIONS, onBridge } from './ketchDeck.js';
import { KT_CREW_MAX } from './ketchLaw.js';
import {
  dpsRef, clampLv, BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, HIT_KINDS, MELEE_REACH, POSE_SLACK, ABSENT_RETIRE_MS, THREAT_PICK, THREAT_DECAY,
  STEP_MAX_MS, HP_SEND_MS, STATE_SEND_MS, REPEAT_MAX, TARGET_HOLD_MS, BREATH_MS, MOVE_RESAY_M, MOVE_RESAY_MS,
  standsAt, retireShare, restoreShare, freeSeat, topDealers, damageChart, chooseAttack, wrapYaw, earned,
} from '../gate/gateBrain.js';
import { egBlowOf, egFloorWindup, egInShape, shDisc, shLaneAt, shCone, shRing, shAll } from '../eliteGates/egShape.js';
import { bossSeam } from '../bossSeam.js';
import { posAt, posAfter } from '../bossRef.js';
import { deepIn, BODY_AFTER_MS } from '../bossBody.js';

// ── the numbers ────────────────────────────────────────────────────────
/** A fighter's share: KW_TTK_S seconds of its reference damage x KW_SHARE_X. */
export const KW_TTK_S = 300;
export const KW_SHARE_X = 1;
export const KW_OPENING_MS = 6000;
export const KW_LOST_MS = 30_000;
/** The phases' floors (their names are the page's - systems/ketch/ketchWords.js ketchPhaseName), the turn's moment. */
export const KW_PHASE_AT = Object.freeze([0.65, 0.35]);
export const KW_TURN_MS = 2500;
/** Its body (a blow's reach is measured to its radius), its walk, and how far from the bridge's centre it keeps - the core,
 *  less its body: it never stands on a section that falls. */
export const KW_BODY = Object.freeze({ r: 2.0, h: 6.4, speed: 2.5, keep: KT_BRIDGE.core - 2.4 });
/** Quicker in the Discord and the Last Note (a share of the Steersman's wind-ups; THE WIND-UP FLOOR still holds them). */
export const KW_FAST = Object.freeze([1, 0.85, 0.75]);
export const KW_LAST_SPEED_X = 1.25;
/** THE DISCORD: the first this long after it begins, each this long after the last while any resonator stands false. */
export const KW_DISCORD_FIRST_MS = 8000;
export const KW_DISCORD_EVERY_MS = 30_000;
export const KW_DISCORD_PCT = 0.25;
export const KW_STUN_MS = 10_000;
export const KW_STUN_HIT_X = 1.5;
/** THE KEEL-SONG: the first this long into the Last Note, each this long after the last's end. */
export const KW_SONG_FIRST_MS = 20_000;
export const KW_SONG_EVERY_MS = 45_000;
export const KW_SONG_PCT = 0.7;
export const KW_SONG_HEAL = 0.08;
export const KW_SONG_STUN_MS = 8000;
/** THE TUNING-FORKS: three and one for each two living, seven at most; each forkHpFor them; none broken in the song's
 *  last KW_FORKS_CLOSE_MS. */
export const KW_FORKS = Object.freeze([3, 7]);
export const forkCountFor = (n) => Math.max(KW_FORKS[0], Math.min(KW_FORKS[1], KW_FORKS[0] + Math.floor(Math.max(0, n) / 2)));
export const KW_FORK = Object.freeze({ r: 0.7, h: 2.2, gap: 4.5, teamS: 3, min: 20 });
export const forkHpFor = (lvs, n) => { const team = lvs.reduce((s, lv) => s + dpsRef(lv), 0); return Math.max(Math.min(KW_FORK.min, Math.round(team)), Math.round((KW_FORK.teamS * team) / Math.max(1, n))); };
export const KW_FORKS_CLOSE_MS = 500;
/** THE OUTER RING GIVES WAY: every this long in the Last Note, this many sections, warned this long, gone this long. */
export const KW_SECTION_EVERY_MS = 20_000;
export const KW_SECTION_FALLS = 2;
export const KW_SECTION_WARN_MS = 3000;
export const KW_SECTION_GONE_MS = 7000;
/** THE KETCH TURNS WEST. */
export const KW_ENDS_MS = 14 * 60_000;
export const KW_END_EVERY_MS = 2000;
export const KW_END_PCT = 0.99;

/** THE BLOWS, by the wire's `a`. `sh` its shape, the rest its numbers (THE WIND-UP FLOOR may lengthen a wind-up). */
export const KW_BLOWS = Object.freeze({
  keel: Object.freeze({ a: 0, key: 'keel', name: 'Keel-Strike', sh: 'lane', len: 26, w: 4.5, wu: 1900, rec: 1300, p: 0.32, b: 14, el: null, range: 24, w8: 2 }),
  lash: Object.freeze({ a: 1, key: 'lash', name: 'Steam Lash', sh: 'cone', r: 13, arc: 150, wu: 1700, rec: 1100, p: 0.26, b: 12, el: 'fire', range: 11, w8: 2 }),
  ring: Object.freeze({ a: 2, key: 'ring', name: 'Tonal Ring', sh: 'self', r: 7, wu: 1800, rec: 1300, p: 0.3, b: 14, el: null, range: 6, w8: 2, wave: Object.freeze({ r1: 20, after: 900, p: 0.16, b: 8, name: 'Tonal Wave' }) }),
  discord: Object.freeze({ a: 3, key: 'discord', name: 'The Discord', sh: 'all', wu: 2500, rec: 0, p: KW_DISCORD_PCT, b: 0, el: null, range: 999, w8: 0 }),
  song: Object.freeze({ a: 4, key: 'song', name: 'The Keel-Song', sh: 'all', wu: 8000, rec: 1800, p: KW_SONG_PCT, b: 0, el: null, range: 999, w8: 0 }),
  west: Object.freeze({ a: 5, key: 'west', name: 'The Ketch Turns West', sh: 'all', wu: 2000, rec: 0, p: KW_END_PCT, b: 0, el: null, range: 999, w8: 0 }),
});
export const KW_BLOW_BY_A = Object.freeze(Object.values(KW_BLOWS).sort((a, b) => a.a - b.a));
const CHOSEN = Object.freeze([KW_BLOWS.keel, KW_BLOWS.lash, KW_BLOWS.ring]);
/** The Warden's body number in the ship's frames (net/ketch/ketchBrain.js - constructs from 100, a fork 200 + its place). */
export const KW_ID = 1;
export const KW_FORK_ID0 = 200;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const r2 = (v) => Math.round(v * 100) / 100;
/** A point kept within `r` of the bridge's centre (into `out`). */
function keepOn(x, z, r, out = [0, 0]) {
  const dx = x - KT_BRIDGE.x, dz = z - KT_BRIDGE.z, d = Math.hypot(dx, dz);
  if (d <= r) { out[0] = x; out[1] = z; } else { out[0] = KT_BRIDGE.x + (dx / d) * r; out[1] = KT_BRIDGE.z + (dz / d) * r; }
  return out;
}
/** The blows `gap` m past its body allows (the last left out when another is open, never a third time running). */
export function wardenAllows(gap, lastA = -1, run = 1) {
  const out = CHOSEN.filter((A) => gap <= A.range);
  const fresh = out.filter((A) => A.a !== lastA);
  return fresh.length ? fresh : run >= REPEAT_MAX ? [] : out;
}

/**
 * A fresh fight on ship `room`, number `fi`; nobody in it; the Warden at its helm facing the way in; awake at `op`.
 * @param {string} room @param {number} fi @param {number} now
 */
export function newWardenFight(room, fi, now) {
  const op = now + KW_OPENING_MS;
  return {
    v: 1, room, fi, startedAt: now, op, phase: 1, hp: 0, max: 0,
    wd: { x: KT_WARDEN_HOME.x, z: KT_WARDEN_HOME.z, yw: KT_WARDEN_HOME.yaw, mv: null, atk: null, lastA: -1, runA: 0, freeAt: 0, nextAt: 0, walkUntil: 0, tg: null, tgAt: 0, until: 0 },
    seq: 0, outUntil: 0,
    /** @type {any[]} the blows in flight, as the wire says them (every screen draws and judges each) */
    blows: [],
    ward: false, rs: [1, 1, 1, 1], discordAt: 0, stunUntil: 0,
    songAt: 0, fk: null, fkSent: '', fkSentAt: 0,
    /** @type {Array<{ k: number, at: number, back: number }>} the outer ring's sections falling or fallen */
    sec: [], secAt: 0,
    clockAt: 0, endsAt: op + KW_ENDS_MS, ended: null,
    /** @type {string[]} constructs the fight asks the ship for (the Discord's two Sentries) */
    want: [],
    /** @type {Record<string, any>} */
    players: {},
    /** @type {Record<string, number>} */
    threat: {}, liveMs: 0, emptySince: null,
    /** @type {{at: number, top: string[], n: number, dm?: any} | null} */
    fell: null,
    /** @type {{at: number} | null} */
    lost: null,
    lastHpAt: 0, lastHpSent: -1, lastStateAt: now, lastTickAt: now,
  };
}
const over = (f, now) => !!(f.fell || f.lost || now >= f.endsAt);
const closed = (f, now) => over(f, now) || !!f.ended;
const floorOf = (f) => (f.phase === 1 ? KW_PHASE_AT[0] * f.max : f.phase === 2 ? KW_PHASE_AT[1] * f.max : 0);
/** Can the Warden be struck now: awake, not warded, past its turn. */
export const wardenOpen = (f, now) => !over(f, now) && now >= f.op && !f.ward && now >= (f.outUntil ?? 0);

/** A fighter steps in (the gate's law, sdRemnant's joinRemnant). */
export function joinWarden(f, sub, name, lv, now, present = null) {
  const known = f.players[sub];
  if (known) {
    if (typeof name === 'string' && name) known.name = name.slice(0, 24);
    if (!closed(f, now)) { known.seenAt = now; restoreShare(f, known); }
    return true;
  }
  if (closed(f, now)) return false;
  if (Object.keys(f.players).length >= KT_CREW_MAX && !freeSeat(f, present)) return false;
  const level = clampLv(lv), share = KW_TTK_S * dpsRef(level) * KW_SHARE_X, frac = standsAt(f), fresh = frac >= 1;
  f.max += share;
  f.hp += share * frac;
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: level, share, dealt: 0, clipped: 0,
    bucket: fresh ? BUCKET_DEPTH_X * dpsRef(level) : 0, bucketAt: now, rate: GATE_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
    seenAt: now, retired: false, cxd: 0, hits: 0, best: 0, falls: 0, down: false,
  };
  return true;
}

const poseIn = (pose) => !!pose && onBridge(pose.x, pose.z, 1.5) && (!Number.isFinite(pose.y) || Math.abs(pose.y - KT_BRIDGE.y) <= 4);
/**
 * A blow on the Warden: `got` - what the crew's purse already accepted (net/ketch/ketchBrain.js spends the voyage's hand
 * and purse, the one a member strikes everything with) - laid on it: refused (answers 0, and the brain gives the purse
 * back nothing - it is spent: a blow on a ward rings) where it is warded, asleep, past its fall, or the striker off the
 * bridge or out of melee reach; heavier stunned; held at its phase's floor. Answers what came off its health.
 * @param {any} f @param {string} sub @param {number} d the claim @param {number} r its kind @param {{x: number, y?: number, z: number}|null} pose
 * @param {number} now @param {(d: number, left: number) => number} spend the purse (what it accepts of `d` against `left`)
 */
export function applyWardenHit(f, sub, d, r, pose, now, spend) {
  const p = f.players[sub];
  if (!p || !wardenOpen(f, now) || !Number.isFinite(d) || !(d > 0) || !poseIn(pose)) return 0;
  const W = f.wd;
  stepWalk(W, now);
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, W.x, W.z) - KW_BODY.r > MELEE_REACH + POSE_SLACK) return 0;
  const got = spend(d * (now < f.stunUntil ? KW_STUN_HIT_X : 1), Math.max(0, f.hp - floorOf(f)));
  if (got > 0) { f.threat[sub] = (f.threat[sub] ?? 0) + got; p.dealt += got; p.hits = (p.hits ?? 0) + 1; p.best = Math.max(p.best ?? 0, got); }
  f.hp -= got;
  if (f.phase === 3 && f.hp <= 1e-6 && f.max > 0) fall(f, now);
  return got;
}
/** Its fall: where it stands, the fight's best and every fighter's part, everything in flight gone. */
function fall(f, now) {
  stepWalk(f.wd, now);
  f.hp = 0;
  f.fell = { at: now, top: topDealers(f, 3), n: Object.keys(f.players).length, dm: damageChart(f) };
  f.wd.mv = null; f.wd.atk = null; f.fk = null; f.blows = []; f.sec = [];
}

/** A RESONATOR PUT RIGHT (a cell set in it - the brain's word): answers the frames - the resonators, and with the last
 *  its ward broken and the stun. */
export function retune(f, k, now) {
  const out = [];
  if (f.phase !== 2 || !f.ward || !Number.isInteger(k) || f.rs[k] !== 0) return out;
  f.rs[k] = 1;
  out.push({ k: 'rs', rs: [...f.rs], at: now });
  if (f.rs.every((v) => v === 1)) {
    f.ward = false;
    stepWalk(f.wd, now);
    f.wd.atk = null; f.wd.mv = null; f.wd.tg = null;
    f.blows = f.blows.filter((b) => b.o !== KW_ID || b.at <= now);
    f.stunUntil = now + KW_STUN_MS;
    f.wd.nextAt = f.stunUntil;
    out.push({ k: 'ward', on: 0, stun: f.stunUntil, at: now });
  }
  return out;
}

/** The forks take blows only while the song still winds up, and not in its last KW_FORKS_CLOSE_MS. */
export const forksOpen = (f, now) => !!f.fk && now < f.fk.at - KW_FORKS_CLOSE_MS;
/**
 * A blow on fork `c` of the song in flight (`got` the purse's acceptance, as applyWardenHit): answers the frames - a fork
 * broken (`fkb`), and with the last THE SONG BROKEN: called off, the Warden stunned.
 */
export function applyForkHit(f, sub, c, d, r, pose, now, spend) {
  const out = [];
  const p = f.players[sub], X = f.fk, q = X && Number.isInteger(c) ? X.c[c] ?? null : null;
  if (!p || over(f, now) || !q || !(q.h > 0) || !Number.isFinite(d) || !(d > 0) || !forksOpen(f, now) || !poseIn(pose)) return out;
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, q.x, q.z) - KW_FORK.r > MELEE_REACH + POSE_SLACK) return out;
  const got = spend(d, q.h);
  p.dealt += got;   // a part in the fight, as the gate's crystals are (AUDIT KETCH L1-8: a fork's damage counted for nothing)
  p.cxd = (p.cxd ?? 0) + got;
  q.h -= got;
  if (q.h > 1e-6) return out;
  q.h = 0;
  out.push({ k: 'fkb', i: X.i, c, n: p.name, at: now });
  if (X.c.every((o) => o.h <= 0)) {
    f.fk = null;
    f.blows = f.blows.filter((b) => b.i !== X.i);
    stepWalk(f.wd, now);
    f.wd.atk = null; f.wd.mv = null; f.wd.tg = null;
    f.stunUntil = now + KW_SONG_STUN_MS;
    f.wd.nextAt = f.stunUntil;
    f.songAt = f.stunUntil + KW_SONG_EVERY_MS;
    out.push({ k: 'stun', until: f.stunUntil, at: now });
  }
  return out;
}

// ── the beat ───────────────────────────────────────────────────────────
function chooseTarget(f, here, rng) {
  if (!here.length) return null;
  if (rng() < THREAT_PICK) {
    let best = null, t = 0;
    for (const b of here) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return here[Math.floor(rng() * here.length) % here.length];
}
function stepWalk(W, now) {
  const m = W.mv;
  if (!m) return;
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) { W.x = m.tx; W.z = m.tz; return; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  [W.x, W.z] = keepOn(m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along, KW_BODY.keep);
}
const mvFrame = (W, now) => ({ k: 'mv', o: KW_ID, x: r2(W.mv ? W.mv.x : W.x), z: r2(W.mv ? W.mv.z : W.z), tx: r2(W.mv ? W.mv.tx : W.x), tz: r2(W.mv ? W.mv.tz : W.z), v: W.mv ? W.mv.v : 0, at: W.mv ? W.mv.at : now });
function walkToward(f, W, target, now, out) {
  stepWalk(W, now);
  const dx = target.x - W.x, dz = target.z - W.z, d = Math.hypot(dx, dz);
  const stop = Math.max(0, d - (KW_BODY.r + 1));
  const [tx, tz] = keepOn(W.x + (d > 0 ? (dx / d) * stop : 0), W.z + (d > 0 ? (dz / d) * stop : 0), KW_BODY.keep);
  const m = W.mv;
  if (m && dist(m.tx, m.tz, tx, tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  W.mv = { x: W.x, z: W.z, tx, tz, v: KW_BODY.speed * (f.phase >= 3 ? KW_LAST_SPEED_X : 1), at: now };
  if (d > 0) W.yw = Math.atan2(dx, dz);
  out.push(mvFrame(W, now));
}
/** A blow of its own as the wire says it (and its Tonal Wave a beat after, jumped). */
function begin(f, A, now, target, out) {
  const W = f.wd, fast = KW_FAST[f.phase - 1] ?? 1;
  if (target) W.yw = Math.atan2(target.x - W.x, target.z - W.z);
  const s = A.sh === 'lane' ? [shLaneAt(W.x, W.z, W.yw, KW_BODY.r + A.len, A.w)] : A.sh === 'cone' ? [shCone(W.x, W.z, W.yw, A.r, A.arc)] : [shDisc(W.x, W.z, A.r)];
  const wu = egFloorWindup(Math.round(A.wu * fast), s);   // THE WIND-UP FLOOR first, so its landing is that far off
  const blow = { ...egBlowOf({ i: ++f.seq, o: KW_ID, s, at: now + wu, wu, p: A.p, b: A.b, el: A.el, nm: A.name }), y: KT_BRIDGE.y, a: A.a };
  f.blows.push(blow); out.push({ k: 'bl', b: blow });
  let until = blow.at + A.rec;
  if (A.wave) {
    const V = A.wave, wave = { ...egBlowOf({ i: ++f.seq, o: KW_ID, s: [shRing(W.x, W.z, A.r, V.r1)], at: blow.at + V.after, wu: blow.wu + V.after, p: V.p, b: V.b, el: null, nm: V.name }), y: KT_BRIDGE.y, a: A.a, jp: 1 };
    f.blows.push(wave); out.push({ k: 'bl', b: wave });
    until += V.after;
  }
  W.atk = A.a; W.until = until;
}
/** A blow of the whole bridge, from no body (the Discord, the song, the turn west). */
function clockBlow(f, A, at, out) {
  const blow = { ...egBlowOf({ i: ++f.seq, o: 0, s: [shAll()], at, wu: A.wu, p: A.p, b: A.b, el: A.el, nm: A.name, ch: 1 }), y: KT_BRIDGE.y, a: A.a };
  f.blows.push(blow); out.push({ k: 'bl', b: blow });
  return blow;
}
function beatWarden(f, now, here, rng, out) {
  const W = f.wd;
  if (W.atk != null) {
    if (now < W.until) return;
    W.runA = W.atk === W.lastA ? W.runA + 1 : 1;
    W.lastA = W.atk; W.atk = null; W.freeAt = now; W.nextAt = now + BREATH_MS;
  }
  if (now < W.nextAt) { stepWalk(W, now); return; }
  let target = W.tg ? here.find((o) => o.sub === W.tg) ?? null : null;
  if (!target || now - W.tgAt >= TARGET_HOLD_MS) { target = chooseTarget(f, here, rng); W.tg = target?.sub ?? null; W.tgAt = now; }
  if (!target) { if (W.mv) { stepWalk(W, now); W.mv = null; out.push(mvFrame(W, now)); } return; }
  stepWalk(W, now);
  const gap = dist(target.x, target.z, W.x, W.z) - KW_BODY.r;
  const near = gap <= KW_BLOWS.ring.range;
  const can = now < W.walkUntil && !near ? [] : wardenAllows(gap, W.lastA, W.runA);
  if (!can.length) { walkToward(f, W, target, now, out); return; }
  if (W.mv) { W.mv = null; out.push(mvFrame(W, now)); }
  const A = chooseAttack(can.map((q) => ({ ...q, w: q.w8 })), rng);
  begin(f, KW_BLOWS[A.key], now, target, out);
  if (A.key === 'keel' || A.key === 'lash') W.walkUntil = now + 3000;
}
/** THE FORKS rise as the song is called: forkCountFor the living, on the core's ring, KW_FORK.gap apart, clear of the
 *  Warden. Said once (`fk`), their health as it falls (`fkh`), each one's breaking (`fkb`). */
function raiseForks(f, song, now, here, rng, out) {
  // the living on the bridge; nobody there - the fight's own fighters (AUDIT KETCH L1-13: forks of 0 hp, unbreakable)
  const who = here.length ? here.map((b) => b.sub) : Object.keys(f.players).filter((s) => !f.players[s].retired);
  const n = forkCountFor(who.length), m = forkHpFor(who.map((s) => f.players[s]?.lv ?? 1), n), spots = [];
  const [r0, r1] = KT_FORK_RING, W = f.wd, clear = KW_BODY.r + KW_FORK.r + 1;
  for (let tries = 0; spots.length < n && tries < n * 80; tries++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(r0 * r0 + rng() * (r1 * r1 - r0 * r0));
    const x = r2(KT_BRIDGE.x + Math.sin(a) * r), z = r2(KT_BRIDGE.z + Math.cos(a) * r);
    if (spots.some((q) => dist(q[0], q[1], x, z) < KW_FORK.gap)) continue;
    if (dist(W.x, W.z, x, z) < clear) continue;
    spots.push([x, z]);
  }
  const rm = (r0 + r1) / 2, a0 = Math.atan2(W.x - KT_BRIDGE.x, W.z - KT_BRIDGE.z) + Math.PI / n;
  for (let k = spots.length; k < n; k++) { const a = a0 + (k / n) * Math.PI * 2; spots.push([r2(KT_BRIDGE.x + Math.sin(a) * rm), r2(KT_BRIDGE.z + Math.cos(a) * rm)]); }
  f.fk = { i: song.i, at: song.at, m, c: spots.map(([x, z]) => ({ x, z, h: m })) };
  f.fkSent = fkKey(f.fk); f.fkSentAt = now;
  out.push({ k: 'fk', i: f.fk.i, at: f.fk.at, m, c: spots.map((q) => [q[0], q[1]]) });
}
const fkKey = (X) => X.c.map((q) => Math.ceil(q.h)).join(',');
/** THE OUTER RING: `KW_SECTION_FALLS` sections not falling now, by the dice, warned and gone. */
function dropSections(f, now, rng, out) {
  const busy = new Set(f.sec.map((s) => s.k)), free = [];
  for (let k = 0; k < KT_SECTIONS; k++) if (!busy.has(k)) free.push(k);
  for (let j = 0; j < KW_SECTION_FALLS && free.length; j++) {
    const k = free.splice(Math.floor(rng() * free.length) % free.length, 1)[0];
    f.sec.push({ k, at: now + KW_SECTION_WARN_MS, back: now + KW_SECTION_WARN_MS + KW_SECTION_GONE_MS });
  }
  out.push({ k: 'sec', s: f.sec.map((s) => [s.k, s.at, s.back]) });
}
/** Is section `k` of the outer ring gone (fallen) at `now` - by the fight's word? */
export const sectionGone = (secs, k, now) => (secs ?? []).some((s) => (Array.isArray(s) ? s[0] === k && now >= s[1] && now < s[2] : s.k === k && now >= s.at && now < s.back));

/**
 * ONE BEAT. `bodies` the crew on the ship now ({sub, x, z, y, dead}, the deck's frame); `rng` a [0,1) source. Answers the
 * frames to send, in order. Moves the state.
 */
export function stepWarden(f, now, bodies, rng) {
  const out = [];
  const dt = Math.min(STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  if (f.fell || f.lost) return out;
  f.blows = f.blows.filter((b) => now < b.at + Math.max(1, b.sp ?? 0) + 1500);
  f.sec = f.sec.filter((s) => now < s.back);
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && onBridge(b.x, b.z, 1.5) && (!Number.isFinite(b.y) || Math.abs(b.y - KT_BRIDGE.y) <= 4));
  for (const b of here) f.players[b.sub].stoodMs += dt;
  if (here.length) { f.liveMs += dt; f.emptySince = null; } else if (f.emptySince == null) f.emptySince = now;
  for (const b of bodies) { const p = f.players[b.sub]; if (!p) continue; if (b.dead && !p.down) p.falls = (p.falls ?? 0) + 1; p.down = !!b.dead; }
  for (const b of here) { const p = f.players[b.sub]; p.seenAt = now; restoreShare(f, p); }
  for (const p of Object.values(f.players)) if (!p.retired && now - (p.seenAt ?? p.joinedAt) > ABSENT_RETIRE_MS) retireShare(f, p);
  if ((f.emptySince != null && now - f.emptySince >= KW_LOST_MS) || (f.ended && now - f.ended.at >= KW_LOST_MS)) {
    f.lost = { at: now };
    out.push({ k: 'lost', at: now });
    return out;
  }
  const keep = Math.pow(1 - THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  if (now < f.op) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
  // THE KETCH TURNS WEST - nothing else is done
  const E = KW_BLOWS.west;
  if (f.ended || now >= f.endsAt - E.wu) {
    if (!f.ended) {
      f.ended = { at: f.endsAt };
      stepWalk(f.wd, now); f.wd.mv = null; f.wd.atk = null; f.fk = null; f.stunUntil = 0;
      clockBlow(f, E, f.endsAt, out);
      f.clockAt = f.endsAt;
    } else if (now >= f.clockAt) { f.clockAt += KW_END_EVERY_MS; clockBlow(f, E, f.clockAt, out); }
    hpFrame(f, now, out); stateFrame(f, now, out);
    return out;
  }
  // THE DISCORD BEGINS: warded, the resonators false, two Sentries asked of the ship
  if (f.phase === 1 && f.max > 0 && f.hp <= KW_PHASE_AT[0] * f.max) {
    f.phase = 2; f.ward = true; f.rs = [0, 0, 0, 0];
    f.discordAt = now + KW_DISCORD_FIRST_MS;
    f.outUntil = now + KW_TURN_MS;
    stepWalk(f.wd, now); f.wd.mv = null; f.wd.atk = null; f.wd.nextAt = f.outUntil;
    f.want.push('sentry', 'sentry');
    out.push({ k: 'ph', n: 2, at: now, up: f.outUntil });
    out.push({ k: 'ward', on: 1, at: now });
    out.push({ k: 'rs', rs: [...f.rs], at: now });
  }
  if (f.phase === 2 && f.ward && now >= f.discordAt - KW_BLOWS.discord.wu) {
    clockBlow(f, KW_BLOWS.discord, f.discordAt, out);
    f.discordAt += KW_DISCORD_EVERY_MS;
  }
  // THE LAST NOTE
  if (f.phase === 2 && !f.ward && f.max > 0 && f.hp <= KW_PHASE_AT[1] * f.max) {
    f.phase = 3;
    f.outUntil = now + KW_TURN_MS;
    stepWalk(f.wd, now); f.wd.mv = null; f.wd.atk = null; f.wd.nextAt = f.outUntil;
    f.songAt = f.outUntil + KW_SONG_FIRST_MS;
    f.secAt = f.outUntil + KW_SECTION_EVERY_MS / 2;
    out.push({ k: 'ph', n: 3, at: now, up: f.outUntil });
  }
  if (f.phase === 3) {
    if (now >= f.secAt) { dropSections(f, now, rng, out); f.secAt = now + KW_SECTION_EVERY_MS; }
    // the song lands - forks unbroken - and heals; its blow marked sung, for the judge comes BODY_AFTER_MS later
    if (f.fk && now >= f.fk.at) {
      const X = f.fk, song = f.blows.find((b) => b.i === X.i);
      if (song) song.sg = 1;
      f.fk = null; f.hp = Math.min(f.max, f.hp + KW_SONG_HEAL * f.max); f.songAt = now + KW_SONG_EVERY_MS;
    }
  }
  if (now >= f.outUntil && now >= f.stunUntil) {
    const W = f.wd;
    if (f.phase === 3 && W.atk == null && !f.fk && f.songAt > 0 && now >= f.songAt && now >= W.nextAt) {
      stepWalk(W, now);
      if (W.mv) { W.mv = null; out.push(mvFrame(W, now)); }
      const song = clockBlow(f, KW_BLOWS.song, now + KW_BLOWS.song.wu, out);
      f.songAt = 0;
      W.atk = KW_BLOWS.song.a; W.until = song.at + KW_BLOWS.song.rec;
      raiseForks(f, song, now, here, rng, out);
    } else beatWarden(f, now, here, rng, out);
  }
  hpFrame(f, now, out);
  fkFrame(f, now, out);
  stateFrame(f, now, out);
  return out;
}
function hpFrame(f, now, out) {
  const h = Math.round(f.hp);
  if (h !== f.lastHpSent && now - f.lastHpAt >= HP_SEND_MS) { f.lastHpSent = h; f.lastHpAt = now; out.push({ k: 'whp', h, m: Math.round(f.max) }); }
}
function fkFrame(f, now, out) {
  if (!f.fk || now - f.fkSentAt < HP_SEND_MS) return;
  const key = fkKey(f.fk);
  if (key === f.fkSent) return;
  f.fkSent = key; f.fkSentAt = now;
  out.push({ k: 'fkh', i: f.fk.i, h: f.fk.c.map((q) => Math.ceil(q.h)) });
}
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(wardenStateOf(f));
}

/** The whole fight as the wire says it (the `ws` kind, beside the ship's own state). */
export function wardenStateOf(f) {
  const W = f.wd;
  return {
    k: 'ws', fi: f.fi, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max), op: f.op, ou: f.outUntil ?? 0,
    wd: { x: r2(W.x), z: r2(W.z), yw: r2(W.yw), mv: W.mv ? { x: r2(W.mv.x), z: r2(W.mv.z), tx: r2(W.mv.tx), tz: r2(W.mv.tz), v: W.mv.v, at: W.mv.at } : null },
    bl: f.blows.map((b) => ({ ...b })), ward: f.ward ? 1 : 0, rs: [...f.rs], da: f.discordAt, su: f.stunUntil > 0 ? f.stunUntil : 0,
    sa: f.songAt, fk: f.fk ? { i: f.fk.i, at: f.fk.at, m: f.fk.m, c: f.fk.c.map((q) => [q.x, q.z, Math.ceil(q.h)]) } : null,
    sec: f.sec.map((s) => [s.k, s.at, s.back]), ends: f.endsAt, ended: f.ended ? f.ended.at : 0,
    n: Object.values(f.players).filter((p) => !p.retired).length,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null,
    lost: f.lost ? f.lost.at : 0,
  };
}

/**
 * THE WARDEN'S BLOWS JUDGED ON THE RELAY'S TRAILS (net/bossRef.js's law): each plain blow of its own (`el` none, never a
 * jumped wave) at its landing - a body deep in its stamps (net/eliteGates/egShape.js egInBlow) where it stood before and
 * after - and each clock's over the whole bridge; the song only when it was sung - its forks standing at its landing (`sg`,
 * stamped by stepWarden, which the relay beats AFTER this judge: AUDIT KETCH L1-3, the song was never counted while the
 * judge looked for forks the step had already cleared) or still standing now. `[{sub, share}]`.
 * @param {any} f @param {Array<{sub: string, x: number, z: number, dead: boolean, tr?: number[][]}>} bodies the deck's frame
 * @param {number} now
 */
export function judgeWarden(f, bodies, now) {
  if (f.fell || f.lost) return [];
  const out = [], live = bodies.filter((b) => !b.dead && f.players?.[b.sub]);
  for (const a of f.blows) {
    if (a.bj || now < a.at + BODY_AFTER_MS) continue;
    a.bj = true;
    if (a.el != null || a.jp) continue;
    const allBridge = a.s?.[0]?.[0] === 'a';
    const share = a.a === KW_BLOWS.song.a ? (a.sg || (f.fk && f.fk.i === a.i) ? Math.min(1, a.p) : 0) : Math.min(1, a.p);
    if (!(share > 0)) continue;
    for (const b of live) {
      const p0 = posAt(b, a.at), p1 = posAfter(b, a.at);
      if (!p0) continue;
      const test = allBridge ? (x, z) => onBridge(x, z, 1.5) : (x, z) => (a.s ?? []).some((s) => egInShape(s, x, z));
      if (allBridge ? test(p0[0], p0[1]) && test(p1[0], p1[1]) : deepIn(test, p0[0], p0[1]) && deepIn(test, p1[0], p1[1])) out.push({ sub: b.sub, share });
    }
  }
  return out;
}
/** THE TONAL WARDEN ON THE BOSS SEAM (net/bossSeam.js): born of `{ room, fi, now }`; its blow's claim spent by the crew's
 *  purse (`o.spend`); earned by the gate's own law. */
export const KETCH_SEAM = bossSeam('ketch', {
  new: ({ room, fi, now }) => newWardenFight(room, fi, now),
  join: joinWarden,
  hit: (f, sub, d, r, pose, now, _seq = null, o = {}) => applyWardenHit(f, sub, d, r, pose, now, o.spend ?? ((x) => x)),
  step: stepWarden, stateOf: wardenStateOf, judge: judgeWarden, earned,
});
