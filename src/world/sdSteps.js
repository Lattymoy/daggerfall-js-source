// @ts-check
// SD7a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS' LAW -
// the course from the Orrery's first step to the Last Moment's arena, in the realm's frame (net/sdBrain.js): where each
// step stands, how it moves on the realm's anchored clock, and what the void does with a body that falls. Pure: the
// page (SD7b) stands, moves and judges them; the relay never does - a player who reaches the arena simply arrives.
//
// THREE SPANS, each begun at a stone checkpoint (A the first step, SD6c's; B; C):
//   THE DRIFT - eight brass steps swinging side to side (1-2 m either way, 4-7 s a swing), their gaps a running jump's
//     (2.4-3.2 m when they line up): the leap is in the timing.
//   THE BEAT - seven steps there only on the Hour's beat (solid 2.4 s, gone 1.2 s, alternate steps half a beat apart),
//     and two brass RISERS between them, walls 2.3 m tall to run up (CLIMB3's wall run - up a wall run straight at, the
//     engine's own; its lip inside the run's reach at skill 0, so a run up takes it at any skill, as a climb does), the
//     course a riser higher after each.
//   THE CRUMBLE - eight cracked steps each a step down, falling 0.7 s after a foot touches one (back after 5 s - each
//     player's own: a step one broke is whole for the next), and THE WARP'S BREATH across them: a gust every 6 s pushing
//     3 m/s sideways for a second, its rising wind heard the second before.
// A body below y -30 is cast back to its span's checkpoint, 15% of its health lost (no shield takes it).
//
// Amended from the design (section 9) to the engine as it is (SD7a): the gaps are a plain running jump's at a modest
// build, not a running leap's (the leap flies 4.1 m at Jumping 0 - the design's 4-6.5 m shut such a player out); the
// walls are run UP, not along (the engine has no run along a wall); the gust moves the body itself (the motor's own push
// stops at every edge); and the course needs 145 m, so the arena moves out to z 246.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ARENA } from '../net/sdBrain.js';
import { SD_FIRST_STEP } from './sdHall.js';

/** Below this (the realm's y) the Hour casts a body back; and how much of its health it costs. */
export const SD_VOID_Y = -30;
export const SD_CAST_BACK_LOSS = 0.15;
/** A step's slab: thick, and the Drift's, the Beat's and the Crumble's tops (across x, along z). */
export const SD_STEP_THICK = 0.6;
export const SD_DRIFT_SIZE = Object.freeze({ w: 3.0, d: 2.4 });
export const SD_BEAT_SIZE = Object.freeze({ w: 3.0, d: 2.6 });
export const SD_CRUMBLE_SIZE = Object.freeze({ w: 2.6, d: 2.6 });
/** A riser: its top this far above the step it rises from - inside every wall run's reach, past every skill's jump. */
export const SD_RISER_H = 2.3;
/** The Beat: a step's cycle, its solid share, and the half beat between alternate steps (s); it blinks this long before
 *  it goes. */
export const SD_BEAT_CYCLE = 3.6;
export const SD_BEAT_SOLID = 2.4;
export const SD_BEAT_HALF = SD_BEAT_CYCLE / 2;
export const SD_BEAT_BLINK = 0.4;
/** The Crumble: a touched step falls this long after (s), and is whole again this long after it fell. */
export const SD_CRUMBLE_DELAY = 0.7;
export const SD_CRUMBLE_BACK = 5;
export const SD_CRUMBLE_FALL_G = 9.8;
/** The Warp's breath: a gust every SD_GUST_EVERY s, SD_GUST_FOR s long, SD_GUST_SPEED m/s across (+x, then -x, by
 *  turns), its wind heard SD_GUST_WARN s before. */
export const SD_GUST_EVERY = 6;
export const SD_GUST_FOR = 1;
export const SD_GUST_SPEED = 3;
export const SD_GUST_WARN = 1;

/** The Drift's eight: the gap before each (and before B), each swing's half-width and period. */
const DRIFT_GAPS = [2.6, 2.8, 2.4, 3.0, 2.6, 3.2, 2.8, 2.6, 2.6];
const DRIFT_AMPS = [1.2, 1.6, 1.0, 1.8, 1.4, 2.0, 1.6, 1.2];
const DRIFT_PERIODS = [4, 5, 6, 4.5, 7, 5.5, 6.5, 5];
/** The Beat: the gaps (0: a riser stands against the step before it), and which are risers. */
const BEAT_PLAN = [['beat', 2.6], ['beat', 2.8], ['beat', 2.6], ['riser', 0], ['beat', 2.6], ['beat', 2.8], ['riser', 0], ['beat', 2.6], ['beat', 2.8]];
const BEAT_TO_C = 2.6;
/** The Crumble's eight, each a step down to the arena's floor: the gap before each, and before the arena. */
const CRUMBLE_GAPS = [2.6, 2.4, 2.8, 2.6, 2.8, 2.6, 2.8, 2.6];
const CRUMBLE_TO_ARENA = 2.4;
const CHECK_R = 3;

/**
 * THE COURSE, laid along +z from the first step's far edge: `steps` (each `{ i, kind, x, y, z, w, d, amp?, period?,
 * phase?, beat? }` - x, z its top's centre at rest, y its top) and `checkpoints` (A, B, C: `{ x, y, z, r }`), and the
 * span each step belongs to (0 the Drift, 1 the Beat, 2 the Crumble).
 */
function layCourse() {
  const steps = [], checkpoints = [{ x: SD_FIRST_STEP.x, y: 0, z: SD_FIRST_STEP.z, r: SD_FIRST_STEP.r }];
  let edge = SD_FIRST_STEP.z + SD_FIRST_STEP.r, y = 0;
  const put = (kind, span, size, gap, extra = {}) => {
    const z = edge + gap + size.d / 2;
    steps.push({ i: steps.length, kind, span, x: 0, y, z, w: size.w, d: size.d, ...extra });
    edge = z + size.d / 2;
  };
  const check = (gap) => { const z = edge + gap + CHECK_R; checkpoints.push({ x: 0, y, z, r: CHECK_R }); edge = z + CHECK_R; };
  for (let k = 0; k < 8; k++) put('drift', 0, SD_DRIFT_SIZE, DRIFT_GAPS[k], { amp: DRIFT_AMPS[k], period: DRIFT_PERIODS[k], phase: k * 0.9 });
  check(DRIFT_GAPS[8]);
  let beat = 0;
  for (const [kind, gap] of BEAT_PLAN) {
    if (kind === 'riser') { y += SD_RISER_H; put('riser', 1, SD_BEAT_SIZE, gap); continue; }
    put('beat', 1, SD_BEAT_SIZE, gap, { beat: (beat++ % 2) * SD_BEAT_HALF });
  }
  check(BEAT_TO_C);
  const drop = y / CRUMBLE_GAPS.length;
  for (let k = 0; k < CRUMBLE_GAPS.length; k++) { y = Math.max(0, y - drop); put('crumble', 2, SD_CRUMBLE_SIZE, CRUMBLE_GAPS[k]); }
  return { steps, checkpoints, end: edge + CRUMBLE_TO_ARENA };
}
const COURSE = layCourse();
/** Every step, in the order they are crossed. */
export const SD_STEPS_COURSE = Object.freeze(COURSE.steps.map((s) => Object.freeze(s)));
/** The checkpoints - A (the first step), B (before the Beat), C (before the Crumble). */
export const SD_CHECKPOINTS = Object.freeze(COURSE.checkpoints.map((c) => Object.freeze(c)));
/** Where the course ends - the arena's near edge (net/sdBrain.js SD_ARENA is laid there). */
export const SD_COURSE_END = COURSE.end;
/** The band the edge lets go of (world/sdRealm.js realmClamp): from just inside the first step's far edge to just inside
 *  the arena's near edge - the void below is the Hour's own, and the cast-back its edge. */
export const SD_STEPS_FREE = Object.freeze({ z0: SD_FIRST_STEP.z + SD_FIRST_STEP.r - 0.4, z1: SD_ARENA.z - SD_ARENA.r + 0.4 });
/** SD7b: the edge's floors past the first step (realmClamp's shapes), laid with the Concord's: that band, so wide no body
 *  over the Steps meets its sides before the void has it (SD_STEPS_FREE_HALF_W either way), and the arena. */
export const SD_STEPS_FREE_HALF_W = 40;
export const SD_STEPS_FLOORS = Object.freeze([
  Object.freeze({ kind: 'band', x: 0, z0: SD_STEPS_FREE.z0, z1: SD_STEPS_FREE.z1, halfW: SD_STEPS_FREE_HALF_W }),
  Object.freeze({ kind: 'disc', ...SD_ARENA }),
]);
/** The span a z falls in (0 the Drift, 1 the Beat, 2 the Crumble), by the checkpoints' far edges; -1 before A's. */
export function spanAt(z) {
  for (let k = SD_CHECKPOINTS.length - 1; k >= 0; k--) if (z >= SD_CHECKPOINTS[k].z - SD_CHECKPOINTS[k].r) return k;
  return -1;
}

/** A step's top-centre at `t` (the realm's anchored seconds), the realm's frame: the Drift's swing across x. AUDIT SD: into
 *  `out` when one is given - the page's frame makes nothing. */
export function stepAt(s, t, out = [0, 0, 0]) {
  out[0] = s.kind === 'drift' ? s.x + s.amp * Math.sin((2 * Math.PI * t) / s.period + s.phase) : s.x;
  out[1] = s.y;
  out[2] = s.z;
  return out;
}
/** Whether a Beat step stands at `t` (the others always do): solid SD_BEAT_SOLID of every SD_BEAT_CYCLE, from its own
 *  half beat. */
export function beatStands(s, t) {
  if (s.kind !== 'beat') return true;
  const u = (((t - s.beat) % SD_BEAT_CYCLE) + SD_BEAT_CYCLE) % SD_BEAT_CYCLE;
  return u < SD_BEAT_SOLID;
}
/** Whether a Beat step is blinking at `t` - the last SD_BEAT_BLINK of its stand, its warning. */
export function beatBlinks(s, t) {
  if (s.kind !== 'beat') return false;
  const u = (((t - s.beat) % SD_BEAT_CYCLE) + SD_BEAT_CYCLE) % SD_BEAT_CYCLE;
  return u >= SD_BEAT_SOLID - SD_BEAT_BLINK && u < SD_BEAT_SOLID;
}
/**
 * A Crumble step `since` seconds after a foot first touched it (null: untouched): `{ drop, whole, shaking }` - how far it
 * has fallen, whether it stands whole (untouched, still shaking, or back), and whether it shakes (its warning).
 */
export function crumbleAfter(since) {
  if (since == null || since < 0 || since >= SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK) return { drop: 0, whole: true, shaking: false };
  if (since < SD_CRUMBLE_DELAY) return { drop: 0, whole: true, shaking: true };
  const f = since - SD_CRUMBLE_DELAY;
  return { drop: 0.5 * SD_CRUMBLE_FALL_G * f * f, whole: false, shaking: false };
}
/** The Warp's breath at `t`: `{ push, warn }` - the sideways speed it pushes with now (m/s along x, 0 between gusts),
 *  and whether its wind is rising (the second before a gust). */
export function gustAt(t) {
  const n = Math.floor(t / SD_GUST_EVERY), u = t - n * SD_GUST_EVERY;
  const push = u < SD_GUST_FOR ? (n % 2 === 0 ? 1 : -1) * SD_GUST_SPEED : 0;
  return { push, warn: u >= SD_GUST_EVERY - SD_GUST_WARN };
}
/** Whether a body at realm z feels the Warp's breath - over the Crumble alone, from C's far edge to the arena. */
export const inBreath = (z) => z > SD_CHECKPOINTS[2].z + SD_CHECKPOINTS[2].r && z < SD_COURSE_END;
/** Whether a body (the realm's y) has fallen past the course into the void. */
export const inVoid = (y) => y < SD_VOID_Y;
/** Where a body cast back stands: its span's checkpoint's centre (the realm's frame, feet on its stone). */
export const castBackTo = (span) => { const c = SD_CHECKPOINTS[Math.max(0, Math.min(SD_CHECKPOINTS.length - 1, span))]; return [c.x, c.y, c.z]; };
