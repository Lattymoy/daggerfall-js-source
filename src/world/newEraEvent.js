// @ts-check
// THE NEW ERA: a live event a dev stages with `/event newera` (net/wire.js LIVE_EVENTS). The ground rumbles, a giant
// AC-130 with a horse's head drops atomic bombs, the ground and the sky crack, the picture peels to a white canvas,
// a deep voice speaks, and the world comes back. One show on the shared clock from the stage's moment, played once.
// This file is what the show is; render/newEraPass.js draws the world's part, ui/newEraCanvas.js the white canvas,
// scenes/newEraHost.js wires both in. The gunship's orbit is round each eye, seeded by the stage, so every player sees
// it in the same quarter of the sky; a blast is pinned to the world where the eye stood as its bomb fell.
// Drawn and heard only: nothing is applied to any player. Not a DFU member: DFU has no live events.
import { seededRng } from '../systems/wind/wind.js';
import { slotHash } from './dreadSky.js';
import { t } from '../systems/textManager.js';

/** The live event this file is (net/wire.js LIVE_EVENTS). */
export const NEWERA_EVENT = 'newera';
/** Real seconds the show takes to come up on a player watching it staged, and to go when a dev ends it. */
export const NEWERA_FADE_S = 3;

// ── The show ──────────────────────────────────────────────────────
/** The show from the stage's own moment: each phase and its real seconds. It plays once. */
export const NEWERA_PHASES = Object.freeze([
  Object.freeze({ phase: 'rumble', s: 6 }),
  Object.freeze({ phase: 'flyin', s: 12 }),
  Object.freeze({ phase: 'bombs', s: 30 }),
  Object.freeze({ phase: 'crack', s: 14 }),
  Object.freeze({ phase: 'peel', s: 16 }),
  Object.freeze({ phase: 'canvas', s: 18 }),
  Object.freeze({ phase: 'dawn', s: 10 }),
]);
/** The show's real seconds, start to end. */
export const NEWERA_SHOW_S = NEWERA_PHASES.reduce((sum, row) => sum + row.s, 0);
/** The second each phase starts. */
export const NEWERA_AT = Object.freeze(
  Object.fromEntries(
    NEWERA_PHASES.map((row, i) => [row.phase, NEWERA_PHASES.slice(0, i).reduce((sum, before) => sum + before.s, 0)]),
  ),
);
/** When the screen itself starts to crack (seconds into the show), and how long the cracks take to cross it. */
export const NEWERA_SCREEN_CRACK = Object.freeze({ at: 59, s: 5 });
/** The share of the peel's time one shard takes to peel; the shards start one after another over the rest. */
export const NEWERA_PEEL_EACH = 0.3;
/** The shards the picture breaks into: a jittered grid, so each is its own shape. */
export const NEWERA_SHARD_GRID = Object.freeze({ cols: 7, rows: 5, jitter: 0.38 });

// ── The gunship ───────────────────────────────────────────────────
/** Its model's metres are a real gunship's (about 30 m nose to tail); it flies this many times larger. Its orbit round
 *  the eye (metres out, metres over, its bank and the seconds a turn takes), where it is first seen, and its leaving. */
export const NEWERA_PLANE = Object.freeze({
  scale: 7,
  orbitR: 950,
  alt: 420,
  bankDeg: 18,
  orbitS: 48,
  inFrom: 4000,
  inAlt: 760,
  inSpeed: 540,
  outAt: 50,
  outS: 12,
  outAccel: 50,
  outClimb: 600,
});
/** The seconds the gunship neighs at: as it comes into view, over its orbit, and as it leaves. */
export const NEWERA_NEIGHS = Object.freeze([8, 30, 51]);

// ── The bombs ─────────────────────────────────────────────────────
/** The seconds each atomic bomb falls from the gunship, the seconds its fall takes, how far from the eye it lands
 *  (metres), and how fast its shock travels (metres a second: the boom arrives with it). */
export const NEWERA_DROPS = Object.freeze([21, 26, 31.5, 37, 42.5]);
export const NEWERA_FALL_S = 6;
export const NEWERA_BLAST_R = Object.freeze([2000, 3100]);
export const NEWERA_SHOCK_SPEED = 480;
/** A bomb's model scale (its model is about 3.3 m long). */
export const NEWERA_BOMB_SCALE = 9;
/** The mushroom cloud: the height its cap climbs to and the seconds that takes, its cap's and stem's radius, its
 *  skirt of dust (radius from and to), the seconds its fire takes to cool, and its puffs. */
export const NEWERA_CLOUD = Object.freeze({
  h: 1300,
  climbS: 5,
  capR: 430,
  stemR: 95,
  baseR: Object.freeze([140, 900]),
  coolS: 3.5,
  stem: 12,
  cap: 20,
  crown: 6,
  skirt: 14,
});
/** A blast's flash on the whole picture: how bright it starts and how fast it fades (per second). */
export const NEWERA_FLASH = Object.freeze({ peak: 0.92, fade: 2.2 });
/** The sky's glow round a blast fades over this many seconds. */
export const NEWERA_GLOW_S = 6;

// ── The cracks ────────────────────────────────────────────────────
/** The ground's cracks: how far round the traveller they run (metres), the grid laid on the ground to draw them, the
 *  size of a crack's cell (metres), and how far the traveller walks before the grid is laid again. */
export const NEWERA_GROUND = Object.freeze({ reach: 150, cells: 48, cellM: 12, regridM: 25 });
/** The sky's cracks start from this many points. */
export const NEWERA_SKY_CRACKS = 3;

// ── The colours (display space, 0..1) ─────────────────────────────
export const NEWERA_HULL = Object.freeze([0.36, 0.38, 0.4]);
export const NEWERA_HULL_DARK = Object.freeze([0.22, 0.23, 0.25]);
export const NEWERA_GUN = Object.freeze([0.12, 0.12, 0.13]);
export const NEWERA_COAT = Object.freeze([0.45, 0.27, 0.13]);
export const NEWERA_MANE = Object.freeze([0.08, 0.06, 0.05]);
export const NEWERA_BLAZE = Object.freeze([0.93, 0.91, 0.87]);
export const NEWERA_EYE = Object.freeze([0.03, 0.03, 0.03]);
export const NEWERA_BOMB = Object.freeze([0.55, 0.52, 0.2]);
/** The fire, hottest to coolest, and the smoke it cools to. */
export const NEWERA_FIRE = Object.freeze([
  Object.freeze([1.0, 0.98, 0.9]),
  Object.freeze([1.0, 0.78, 0.35]),
  Object.freeze([0.92, 0.36, 0.08]),
]);
export const NEWERA_SMOKE = Object.freeze([0.4, 0.34, 0.3]);
/** The sky as it burns, and the white the cracks show. */
export const NEWERA_BURN = Object.freeze([0.95, 0.5, 0.2]);
export const NEWERA_WHITE = Object.freeze([1.0, 1.0, 1.0]);
/** The paper's back as a shard peels, and its shade at the fold. */
export const NEWERA_PAPER = Object.freeze([0.93, 0.92, 0.9]);
export const NEWERA_PAPER_FOLD = Object.freeze([0.62, 0.6, 0.58]);
/** The voice's letters on the canvas. */
export const NEWERA_INK = Object.freeze([0.06, 0.06, 0.07]);

// ── The words ─────────────────────────────────────────────────────
/** The moments a line is said, seconds into the show. */
export const NEWERA_CUES = Object.freeze([
  Object.freeze({ cue: 'rumble', at: 0 }),
  Object.freeze({ cue: 'plane', at: 7 }),
  Object.freeze({ cue: 'bombs', at: NEWERA_DROPS[0] }),
  Object.freeze({ cue: 'crack', at: NEWERA_AT.crack }),
  Object.freeze({ cue: 'peel', at: NEWERA_AT.peel }),
  Object.freeze({ cue: 'voice', at: 80 }),
  Object.freeze({ cue: 'dawn', at: NEWERA_AT.dawn }),
]);
/** What a player watching is told at each cue: the event, and stop; at most one exclamation. Read when said, so a
 *  player's language is the one they chose then. */
export const NEWERA_LINES = Object.freeze({
  rumble: () => t('newera.rumble', 'The ground rumbles. The world shakes.'),
  plane: () => t('newera.plane', 'A giant AC-130 with a horse head flies into view!'),
  bombs: () => t('newera.bombs', 'It drops atomic bombs.'),
  crack: () => t('newera.crack', 'The ground cracks. The sky cracks.'),
  peel: () => t('newera.peel', 'The layers peel away. Under them is a blank white canvas.'),
  voice: () => t('newera.voice', 'IT IS DONE. WE BEGIN A NEW ERA.'),
  dawn: () => t('newera.dawn', 'The world comes back. A new era begins.'),
});
/** The deep voice over the canvas: each phrase, the second it is spoken, and its words. */
export const NEWERA_VOICE = Object.freeze([
  Object.freeze({ at: 80, line: () => t('newera.voice1', 'IT IS DONE.') }),
  Object.freeze({ at: 84.5, line: () => t('newera.voice2', 'WE BEGIN A NEW ERA.') }),
]);
/** Seconds a phrase's letters take to come up on the canvas, and to go as the world comes back. */
export const NEWERA_CAPTION_IN_S = 1.2;
export const NEWERA_CAPTION_OUT_S = 3;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const smooth = (value) => {
  const k = clamp01(value);
  return k * k * (3 - 2 * k);
};
const lerp = (from, to, k) => from + (to - from) * k;
/** One seed out of a few integers (slotHash folded over them). */
const seedOf = (...parts) => parts.reduce((hash, part) => slotHash((hash ^ (part | 0)) >>> 0), 0x9e7e4a) >>> 0;
/** The stage's moment as the seeds read it: whole seconds, so a relay ms either side of a client's agrees. */
const stageSeed = (at) => (Number.isFinite(at) ? Math.floor(at / 1000) : 0);
const unit3 = (vec) => {
  const len = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The event's weight on this client, 0..1, as the Rocket's. `set(ev, {live})` takes the hub's word (net/online.js
 * onEvent: `{kind, at}` or null); `tick(dt)` walks the weight toward it over NEWERA_FADE_S (a welcome is whole at once).
 * `frame(sharedMs)` answers the show's second and the line a player watching is owed: the newest cue passed since the
 * last frame, or the stage's own when they watched it staged; a joiner is told nothing of what they never saw.
 */
export function createNewEra() {
  let target = 0,
    weight = 0;
  let at = NaN;
  /** @type {number | null} */
  let seen = null;
  let owed = false;
  return {
    set(word, { live = false } = {}) {
      target = word?.kind === NEWERA_EVENT ? 1 : 0;
      if (!live) weight = target;
      if (target) at = Number(word.at);
      seen = null;
      owed = !!live && target === 1;
    },
    /** The show's state at `sharedMs` (newEraPhase), and `cue` and `line`: the cue owed and its words, or null. */
    frame(sharedMs) {
      const state = newEraPhase((sharedMs - at) / 1000);
      const index = newEraCue(state.t);
      const fresh = (seen !== null && index !== seen) || (seen === null && owed);
      const cue = target === 1 && !state.done && fresh ? NEWERA_CUES[index].cue : null;
      if (target === 1) {
        seen = index;
        owed = false;
      } else seen = null;
      return { ...state, cue, line: cue ? NEWERA_LINES[cue]() : null, at };
    },
    tick(dt) {
      const step = Math.max(0, dt || 0) / NEWERA_FADE_S;
      weight = weight < target ? Math.min(target, weight + step) : Math.max(target, weight - step);
      return weight;
    },
    get weight() {
      return weight;
    },
    get on() {
      return target === 1;
    },
    get at() {
      return at;
    },
  };
}

/**
 * The show `sinceS` real seconds after the stage: `{ t, index, phase, into, done, world, crack, screenCrack, peel,
 * white, burn, caption }`. `world` says the world's part draws (the gunship, the bombs, the clouds, the cracks: up to
 * the canvas), `crack` the world's cracks, `screenCrack` the picture's, `peel` the peel's progress, `white` the canvas
 * held (whole through the canvas, gone by the end of the dawn), `burn` the sky's fire, `caption` each phrase's letters,
 * each 0..1. A time before the stage is its first moment. Pure.
 * @param {number} sinceS
 */
export function newEraPhase(sinceS) {
  const sec = Number.isFinite(sinceS) && sinceS > 0 ? sinceS : 0;
  const done = sec >= NEWERA_SHOW_S;
  let start = 0,
    index = 0;
  while (index < NEWERA_PHASES.length - 1 && sec >= start + NEWERA_PHASES[index].s) start += NEWERA_PHASES[index++].s;
  const { phase, s: length } = NEWERA_PHASES[index];
  const into = sec - start;
  const starts = NEWERA_AT;
  const world = !done && sec < starts.canvas;
  const crack = world ? smooth((sec - starts.crack) / NEWERA_PHASES[3].s) : 0;
  const screenCrack = world ? clamp01((sec - NEWERA_SCREEN_CRACK.at) / NEWERA_SCREEN_CRACK.s) : 0;
  const peel = world ? clamp01((sec - starts.peel) / NEWERA_PHASES[4].s) : 0;
  let white = 0;
  if (!done && phase === 'canvas') white = 1;
  else if (!done && phase === 'dawn') white = 1 - smooth(into / length);
  const firstLand = NEWERA_DROPS[0] + NEWERA_FALL_S;
  const burn = world ? 0.6 * smooth((sec - firstLand) / 6) + 0.4 * smooth((sec - starts.crack) / 8) : 0;
  const caption = NEWERA_VOICE.map((row) => {
    if (done || sec < row.at) return 0;
    const fadeIn = smooth((sec - row.at) / NEWERA_CAPTION_IN_S);
    return fadeIn * (1 - smooth((sec - starts.dawn) / NEWERA_CAPTION_OUT_S));
  });
  return { t: sec, index, phase, into, done, world, crack, screenCrack, peel, white, burn, caption };
}

/** The newest cue (NEWERA_CUES' index) at `sec` seconds into the show. Pure. */
export function newEraCue(sec) {
  let index = 0;
  while (index < NEWERA_CUES.length - 1 && sec >= NEWERA_CUES[index + 1].at) index++;
  return index;
}

/** The orbit's first angle (radians from +z toward +x), seeded by the stage's moment. Pure. */
export const newEraBearing = (at) => seededRng(seedOf(stageSeed(at), 7))() * 2 * Math.PI;

/** The gunship's place round the eye at `sec` (eye-relative metres), before its frame is worked out. */
function planeSpot(sec, theta0) {
  const plane = NEWERA_PLANE,
    omega = (2 * Math.PI) / plane.orbitS,
    orbitAt = NEWERA_AT.bombs;
  const orbit = (theta) => [plane.orbitR * Math.sin(theta), plane.alt, plane.orbitR * Math.cos(theta)];
  const tangent = (theta) => [Math.cos(theta), 0, -Math.sin(theta)];
  if (sec < orbitAt) {
    // in along the orbit's tangent: a Hermite ease that meets the orbit at its own speed
    const span = orbitAt - NEWERA_AT.flyin,
      k = clamp01((sec - NEWERA_AT.flyin) / span);
    const speed = omega * plane.orbitR,
      kSq = k * k,
      kCube = kSq * k;
    const along =
      (kCube - 2 * kSq + k) * plane.inSpeed * span +
      (-2 * kCube + 3 * kSq) * plane.inFrom +
      (kCube - kSq) * speed * span;
    const entry = orbit(theta0),
      way = tangent(theta0),
      back = plane.inFrom - along;
    return [entry[0] - way[0] * back, lerp(plane.inAlt, plane.alt, smooth(k)), entry[2] - way[2] * back];
  }
  if (sec < plane.outAt) return orbit(theta0 + omega * (sec - orbitAt));
  const exitTheta = theta0 + omega * (plane.outAt - orbitAt),
    gone = sec - plane.outAt;
  const exit = orbit(exitTheta),
    way = tangent(exitTheta);
  const along = omega * plane.orbitR * gone + 0.5 * plane.outAccel * gone * gone;
  const climb = plane.outClimb * (gone / plane.outS) ** 2;
  return [exit[0] + way[0] * along, plane.alt + climb, exit[2] + way[2] * along];
}

/**
 * WHERE THE GUNSHIP IS at `sec` seconds into the show, round the eye: `{ on, pos, forward, up, left, bank }` -
 * `pos` eye-relative metres, `forward` the way it flies, `up` its roof banked toward the orbit's middle, `left` its
 * port side (where its guns are; toward the middle in the orbit). In from far along the orbit's tangent, round a
 * left-hand turn over the eye, and out again climbing. Off before it flies in and once it is gone. Pure.
 * @param {number} sec @param {number} at the stage's moment (ms)
 */
export function newEraPlane(sec, at) {
  const plane = NEWERA_PLANE;
  const on = sec >= NEWERA_AT.flyin && sec < plane.outAt + plane.outS;
  const theta0 = newEraBearing(at);
  const pos = planeSpot(sec, theta0);
  const ahead = planeSpot(sec + 0.05, theta0),
    behind = planeSpot(sec - 0.05, theta0);
  const forward = unit3([ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]]);
  const middle = unit3([-pos[0], 0, -pos[2]]);
  const bankIn = smooth((sec - (NEWERA_AT.bombs - 2)) / 2) * (1 - smooth((sec - plane.outAt) / 2));
  const bank = ((plane.bankDeg * Math.PI) / 180) * bankIn;
  const leaned = unit3([middle[0] * Math.sin(bank), Math.cos(bank), middle[2] * Math.sin(bank)]);
  const left = unit3(cross(leaned, forward));
  const up = unit3(cross(forward, left));
  return { on, pos, forward, up, left, bank };
}

/**
 * THE DROPS OF A STAGE: `[{ index, dropAt, landAt, boomAt, from, to, dist, seed }]` - `from` the gunship's place as it
 * lets go (eye-relative), `to` where it lands (eye-relative x and z), `dist` how far that is from the eye, and
 * `boomAt` the second its shock reaches the eye. Seeded by the stage's moment, so every client reads the same. Pure.
 * @param {number} at the stage's moment (ms)
 */
export function newEraDrops(at) {
  return NEWERA_DROPS.map((dropAt, index) => {
    const seed = seedOf(stageSeed(at), 300 + index),
      draw = seededRng(seed);
    const from = newEraPlane(dropAt, at).pos;
    const bearing = Math.atan2(from[0], from[2]) + (draw() - 0.5) * 1.1;
    const dist = lerp(NEWERA_BLAST_R[0], NEWERA_BLAST_R[1], draw());
    const landAt = dropAt + NEWERA_FALL_S;
    return {
      index,
      dropAt,
      landAt,
      boomAt: landAt + dist / NEWERA_SHOCK_SPEED,
      from,
      to: [dist * Math.sin(bearing), dist * Math.cos(bearing)],
      dist,
      seed,
    };
  });
}

/**
 * A BOMB `k` 0..1 through its fall, from `start` to `end` (scene points): `{ pos, dir }`. It keeps the gunship's way
 * across the ground and falls faster as it goes, nose along its path. Pure.
 * @param {ArrayLike<number>} start @param {ArrayLike<number>} end @param {number} k
 */
export function newEraBombAt(start, end, k) {
  const share = clamp01(k);
  const pos = [
    lerp(start[0], end[0], share),
    start[1] + (end[1] - start[1]) * share * share,
    lerp(start[2], end[2], share),
  ];
  const dir = unit3([end[0] - start[0], 2 * Math.max(share, 0.08) * (end[1] - start[1]), end[2] - start[2]]);
  return { pos, dir };
}

/** A blast's flash on the picture `age` seconds after it lands. Pure. */
export const newEraFlashOf = (age) =>
  age >= 0 && Number.isFinite(age) ? NEWERA_FLASH.peak * Math.exp(-age * NEWERA_FLASH.fade) : 0;

/** The flash of every blast at `sec`, together (at most 1). Pure. @param {ReturnType<typeof newEraDrops>} drops */
export const newEraFlash = (drops, sec) =>
  Math.min(
    1,
    drops.reduce((sum, drop) => sum + newEraFlashOf(sec - drop.landAt), 0),
  );

/**
 * HOW HARD THE CAMERA SHAKES at `sec` (the shaker's magnitude, 0..10): the rumble's swell, a boom as each shock
 * arrives and its aftershocks, the cracking, and a thud at each of the voice's phrases. Pure.
 * @param {number} sec @param {ReturnType<typeof newEraDrops>} drops
 */
export function newEraShake(sec, drops) {
  const starts = NEWERA_AT;
  if (!(sec >= 0) || sec >= NEWERA_SHOW_S) return 0;
  let shake = 0;
  if (sec < starts.flyin) shake = 1.5 + 2.5 * smooth(sec / starts.flyin) + 0.8 * Math.sin(sec * 9);
  else if (sec < starts.bombs) shake = 1.2 * (1 - smooth((sec - starts.flyin) / 6));
  else if (sec < starts.crack) shake = 0.4;
  else if (sec < starts.peel) shake = 2 + 4 * ((sec - starts.crack) / (starts.peel - starts.crack));
  else if (sec < starts.canvas) shake = 2.5 * (1 - (sec - starts.peel) / (starts.canvas - starts.peel));
  for (const drop of drops) {
    const age = sec - drop.boomAt;
    if (age >= 0 && age < 4) shake = Math.max(shake, 9 * Math.exp(-age * 1.6));
  }
  for (const row of NEWERA_VOICE) {
    const age = sec - row.at;
    if (age >= 0 && age < 1.5) shake = Math.max(shake, 3 * Math.exp(-age * 3));
  }
  return Math.max(0, Math.min(10, shake));
}

/**
 * THE MUSHROOM CLOUD `age` seconds after its bomb lands, round its ground zero: `[{ at, size, heat, alpha }]` - `at`
 * metres from ground zero (y up), `size` a puff's radius, `heat` 0..1 (fire to smoke). The fireball, the stem, the cap's
 * rolling ring and crown, and the skirt of dust spreading over the ground. Pure.
 * @param {number} age @param {number} seed
 */
export function newEraCloud(age, seed) {
  const out = [];
  if (!(age >= 0)) return out;
  const cloud = NEWERA_CLOUD;
  const grow = 1 - Math.exp(-age / cloud.climbS);
  const height = cloud.h * (0.12 + 0.88 * grow);
  const capR = cloud.capR * (0.3 + 0.7 * (1 - Math.exp(-age / 4)));
  const heat0 = Math.exp(-age / cloud.coolS);
  const alpha = clamp01(age / 0.25);
  const turn = (seed % 997) / 997;
  if (age < 2.5)
    out.push({ at: [0, height * 0.9, 0], size: capR * 1.3, heat: 1, alpha: alpha * (1 - smooth((age - 1.5) / 1)) });
  for (let k = 0; k < cloud.stem; k++) {
    const y = height * ((k + 0.5) / cloud.stem) * 0.92;
    const widen = 1 + 1.4 * (1 - y / height) ** 3;
    const radius = cloud.stemR * (0.6 + 0.4 * grow) * widen;
    const wobble = turn * 6.283 + k * 1.7 + age * 0.5;
    out.push({
      at: [Math.sin(wobble) * radius * 0.25, y, Math.cos(wobble) * radius * 0.25],
      size: radius * 1.9,
      heat: heat0 * (0.4 + 0.6 * (y / height)),
      alpha: alpha * 0.9,
    });
  }
  for (let j = 0; j < cloud.cap; j++) {
    const around = (2 * Math.PI * j) / cloud.cap + turn * 6.283;
    const roll = age * 0.35 + j * 0.9;
    const ring = capR * 0.62 + Math.cos(roll) * capR * 0.36;
    out.push({
      at: [Math.cos(around) * ring, height + Math.sin(roll) * capR * 0.29, Math.sin(around) * ring],
      size: capR * 0.55,
      heat: heat0 * (Math.sin(roll) < 0 ? 1 : 0.7),
      alpha: alpha * 0.95,
    });
  }
  for (let j = 0; j < cloud.crown; j++) {
    const around = (2 * Math.PI * j) / cloud.crown + turn * 3.1;
    out.push({
      at: [Math.cos(around) * capR * 0.3, height + capR * 0.28, Math.sin(around) * capR * 0.3],
      size: capR * 0.62,
      heat: heat0 * 0.9,
      alpha: alpha * 0.95,
    });
  }
  const spread = cloud.baseR[0] + (cloud.baseR[1] - cloud.baseR[0]) * (1 - Math.exp(-age / 7));
  for (let j = 0; j < cloud.skirt; j++) {
    const around = (2 * Math.PI * j) / cloud.skirt + turn * 2.3;
    out.push({
      at: [Math.cos(around) * spread, 30 + 20 * grow, Math.sin(around) * spread],
      size: 160 + 80 * grow,
      heat: heat0 * 0.3,
      alpha: alpha * 0.75 * (1 - 0.3 * grow),
    });
  }
  return out;
}

/** The shock's dome `age` seconds after its bomb lands `dist` metres from the eye: its radius and how much it shows
 *  (nothing once it has passed the eye). Pure. */
export function newEraDome(age, dist) {
  if (!(age >= 0)) return { radius: 0, alpha: 0 };
  const radius = NEWERA_SHOCK_SPEED * age,
    reach = dist + 600;
  return { radius, alpha: radius < reach ? 0.55 * (1 - radius / reach) : 0 };
}

/** The sky's cracks of a stage: the unit ways (eye-relative) they start from, seeded, so every client cracks the same
 *  sky, and the offset of the crack pattern itself. Pure. @param {number} at */
export function newEraSkyCracks(at) {
  const draw = seededRng(seedOf(stageSeed(at), 900));
  const from = [];
  for (let i = 0; i < NEWERA_SKY_CRACKS; i++) {
    const around = draw() * 2 * Math.PI,
      elev = ((15 + 45 * draw()) * Math.PI) / 180;
    from.push([Math.cos(elev) * Math.sin(around), Math.sin(elev), Math.cos(elev) * Math.cos(around)]);
  }
  return { from, offset: [draw() * 40, draw() * 40, draw() * 40] };
}

/** Clip a convex polygon to the half plane where dot(point - mid, way) <= 0. */
function clipHalf(poly, mid, way) {
  const out = [];
  const side = (point) => (point[0] - mid[0]) * way[0] + (point[1] - mid[1]) * way[1];
  for (let i = 0; i < poly.length; i++) {
    const here = poly[i],
      next = poly[(i + 1) % poly.length];
    const sideHere = side(here),
      sideNext = side(next);
    if (sideHere <= 0) out.push(here);
    if (sideHere <= 0 !== sideNext <= 0) {
      const k = sideHere / (sideHere - sideNext);
      out.push([lerp(here[0], next[0], k), lerp(here[1], next[1], k)]);
    }
  }
  return out;
}

/**
 * THE SHARDS THE PICTURE PEELS AWAY IN: the Voronoi cells of a jittered grid over the unit square (x right, y down):
 * `[{ poly, centre, start, way, delay }]` - `start` the share of the peel before it starts (the sky's first, then the
 * land's), `way` the unit way its fold travels across it, `delay` the share of the screen's cracking before its edges
 * crack (from the middle out). Seeded. Pure.
 * @param {number} seed
 */
export function newEraShards(seed) {
  const grid = NEWERA_SHARD_GRID,
    draw = seededRng(seedOf(seed, 77));
  const sites = [];
  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++)
      sites.push([
        (col + 0.5 + (draw() - 0.5) * 2 * grid.jitter) / grid.cols,
        (row + 0.5 + (draw() - 0.5) * 2 * grid.jitter) / grid.rows,
      ]);
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const lastStart = 1 - NEWERA_PEEL_EACH;
  return sites.map((site, i) => {
    let poly = square;
    sites.forEach((other, j) => {
      if (i === j) return;
      const mid = [(site[0] + other[0]) / 2, (site[1] + other[1]) / 2];
      poly = clipHalf(poly, mid, [other[0] - site[0], other[1] - site[1]]);
    });
    const centre = poly.reduce(
      (sum, point) => [sum[0] + point[0] / poly.length, sum[1] + point[1] / poly.length],
      [0, 0],
    );
    const tilt = (draw() - 0.5) * 1.2;
    const fromMiddle = Math.hypot(centre[0] - 0.5, centre[1] - 0.5) / Math.SQRT1_2;
    return {
      poly,
      centre,
      start: lastStart * clamp01(0.72 * centre[1] + 0.28 * draw()),
      way: [Math.sin(tilt), Math.cos(tilt)],
      delay: 0.6 * clamp01(fromMiddle),
    };
  });
}

/** How far a shard has peeled (0..1) at the peel's `peel` progress. Pure. */
export const newEraPeelOf = (shard, peel) => smooth((peel - shard.start) / NEWERA_PEEL_EACH);

/** Put a voice's words in sentence case, so a speech engine reads "IT" as a word. Pure. */
export const newEraSpoken = (text) => {
  const low = String(text ?? '').toLowerCase();
  return low.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, letter) => lead + letter.toUpperCase());
};

// ── The sounds, made ──────────────────────────────────────────────
/** The made sounds' sample rate. */
export const NEWERA_RATE = 22050;

/** Scale `samples` so their peak is `peak`. */
const normalise = (samples, peak) => {
  let top = 0;
  for (let i = 0; i < samples.length; i++) top = Math.max(top, Math.abs(samples[i]));
  if (top > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / top;
  return samples;
};

/** THE GROUND'S RUMBLE: 5 s of deep noise that swells and settles. Pure. */
export function newEraRumbleSamples() {
  const count = Math.round(5 * NEWERA_RATE),
    out = new Float32Array(count),
    draw = seededRng(0x4e01);
  let brown = 0,
    low1 = 0,
    low2 = 0,
    swell = 0.5;
  for (let i = 0; i < count; i++) {
    const k = i / count;
    if (i % 512 === 0) swell = swell * 0.7 + draw() * 0.3;
    brown = brown * 0.995 + (draw() - 0.5) * 0.2;
    low1 += 0.02 * (brown - low1);
    low2 += 0.02 * (low1 - low2);
    const env = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.3);
    out[i] = low2 * env * (0.6 + 0.8 * swell);
  }
  return normalise(out, 0.9);
}

/** THE BOMB'S BOOM: a crack, a body of noise darkening as it rolls away, and a falling thump under it. 6.5 s. Pure. */
export function newEraBoomSamples() {
  const count = Math.round(6.5 * NEWERA_RATE),
    out = new Float32Array(count),
    draw = seededRng(0x4e02);
  let low1 = 0,
    low2 = 0,
    phase = 0;
  for (let i = 0; i < count; i++) {
    const sec = i / NEWERA_RATE;
    const noise = draw() - 0.5;
    const cut = 0.02 + 0.23 * Math.exp(-sec / 0.5);
    low1 += cut * (noise - low1);
    low2 += cut * (low1 - low2);
    const body = low2 * (Math.exp(-sec / 1.4) + 0.4 * Math.exp(-sec / 3.5)) * Math.min(1, sec / 0.01);
    phase += lerp(55, 28, Math.min(1, sec / 2)) / NEWERA_RATE;
    const thump = Math.sin(2 * Math.PI * phase) * Math.exp(-sec / 1.0) * 0.35;
    const snap = sec < 0.04 ? noise * (1 - sec / 0.04) * 0.6 : 0;
    out[i] = body * 4 + thump + snap;
  }
  const tail = Math.round(0.4 * NEWERA_RATE);
  for (let i = 0; i < tail; i++) out[count - 1 - i] *= i / tail;
  return normalise(out, 0.95);
}

/** THE GUNSHIP'S FOUR ENGINES: a 2 s loop of four propellers a hair apart, each a whole number of turns in the loop,
 *  so it loops without a seam, and the turbines' whine over them. Pure. */
export function newEraEngineSamples() {
  const count = 2 * NEWERA_RATE,
    out = new Float32Array(count);
  const props = [67.5, 68, 68.5, 69];
  for (let i = 0; i < count; i++) {
    const sec = i / NEWERA_RATE;
    let sum = 0;
    for (const freq of props)
      for (let harmonic = 1; harmonic <= 8; harmonic++) sum += Math.sin(2 * Math.PI * freq * harmonic * sec) / harmonic;
    sum += 0.12 * Math.sin(2 * Math.PI * 1150 * sec);
    out[i] = sum;
  }
  return normalise(out, 0.8);
}

/** A BOMB'S WHISTLE as it falls: a tone sliding down from high to low over 4 s. Pure. */
export function newEraWhistleSamples() {
  const count = 4 * NEWERA_RATE,
    out = new Float32Array(count);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const k = i / count;
    const freq = 1500 * Math.pow(380 / 1500, k) * (1 + 0.006 * Math.sin(2 * Math.PI * 5 * k * 4));
    phase += freq / NEWERA_RATE;
    phase -= Math.floor(phase);
    const env = Math.min(1, k / 0.1) * (0.5 + 0.5 * k) * Math.min(1, (1 - k) / 0.05);
    out[i] = Math.sin(2 * Math.PI * phase) * env;
  }
  return normalise(out, 0.6);
}

/** THE CRACKING: sparse snaps, dense at first and fewer as it goes, over a low groan. 1.4 s. Pure. */
export function newEraCrackSamples() {
  const count = Math.round(1.4 * NEWERA_RATE),
    out = new Float32Array(count),
    draw = seededRng(0x4e03);
  let snap = 0,
    last = 0,
    low = 0;
  for (let i = 0; i < count; i++) {
    const k = i / count;
    if (draw() < 0.004 * (1 - k)) snap = 0.6 + 0.4 * draw();
    snap *= 0.985;
    const noise = draw() - 0.5;
    const high = noise - last;
    last = noise;
    low += 0.01 * (noise - low);
    out[i] = high * snap + low * 3 * (1 - k);
  }
  return normalise(out, 0.85);
}

/** A SHARD TEARING AWAY: noise that flutters in and out in tiny grains, swelling and fading. 1.2 s. Pure. */
export function newEraTearSamples() {
  const count = Math.round(1.2 * NEWERA_RATE),
    out = new Float32Array(count),
    draw = seededRng(0x4e04);
  let grain = 0,
    low1 = 0,
    low2 = 0;
  for (let i = 0; i < count; i++) {
    const k = i / count;
    if (i % 90 === 0) grain = draw() < 0.7 ? 0.3 + 0.7 * draw() : 0.05;
    const noise = draw() - 0.5;
    low1 += 0.35 * (noise - low1);
    low2 += 0.05 * (noise - low2);
    const env = Math.sin(Math.PI * k) ** 0.6;
    out[i] = (low1 - low2) * grain * env;
  }
  return normalise(out, 0.7);
}

/** THE VOICE'S BED: a deep hum that swells under the words and dies away. 7 s. Pure. */
export function newEraDroneSamples() {
  const count = 7 * NEWERA_RATE,
    out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const sec = i / NEWERA_RATE,
      k = i / count;
    const tone =
      Math.sin(2 * Math.PI * 43 * sec) +
      0.5 * Math.sin(2 * Math.PI * 86 * sec) +
      0.25 * Math.sin(2 * Math.PI * 129 * sec);
    out[i] = tone * Math.min(1, sec / 1.5) * (1 - k) ** 1.5;
  }
  return normalise(out, 0.8);
}
