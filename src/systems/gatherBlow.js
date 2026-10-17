// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GATHER-FEEL II (2026-10-13, Mac: "Do the not done" - the open items GATHER-FEEL recorded; bible/06-Systems/
// Professions-Arc.md section 45) - WHAT A LANDED BLOW DOES BESIDES ITS SOUND.
//
// A tool's blow lands on DFU's melee hit frame (the acts' `landsIn`, GATHER-FEEL); the gathering host knows the frame
// it does (scenes/gatherHost.js stepAct) and hands it here:
//
// BLOW-SHAKE - the view answers it: the look and the eye dip, the hands go down with the tool. Through the technique
// springs' one door (combat/technique/techniqueFx.js kickFx), which every host's view already folds (player/climb/climbFeel.js
// createClimbFeelHost) and never the look the act aims with (gatherHost.js aimAt - the glint's own test reads the
// camera's yaw and pitch, which the springs leave alone). A port's own motion: the enhanced skin alone (the classic
// skin is DFU's, and DFU moves no camera for a blow - its two, CameraRecoiler and HeadBobber, answer a wound and a
// step), at the player's own "Technique camera motion" (systems/uiPrefs.js techniqueMotion; its note names the tool's
// blow), and none at all where the system asks for reduced motion.
//
// VEIN-CRACKS - the vein answers it (5.2's Mining row: "It cracks in stages (crack decals) and sheds chunks"): each
// blow but the last opens its cracks to the share it has been worked (systems/veinCrack.js, on the node's own batch -
// the host lays it), and every blow sheds chunks of the ore - its own picture, small - out of the struck face toward the
// striker, to fall at its foot, lie a moment and sink away; the blow that breaks it sheds the most. The vein's own world,
// on both skins, as a tree's fall is (PROF4) - and the striker's alone, as the node is (section 6).
// ═══════════════════════════════════════════════════════════════════
import { kickFx, techniqueMotion } from '../combat/technique/techniqueFx.js';
import { prefersReducedMotion } from './hitFlash.js';
import { isEnhanced } from './uiSkin.js';

const f = Object.freeze;

/**
 * A LANDED BLOW'S FEEL, by the act's kind and whether it was the clean one (a Clean Cut, a strike on the glint): `cam`
 * the springs' peaks as the screen shows them (TECH_FX's units - `pitch` degrees, the look down negative; `eye` metres,
 * down negative), `hands` the first-person layer's dip (screen heights). Lighter than a technique's hit - every dip here
 * under the least any technique's hit dips that channel (TECH_FX's: the look cleave's 0.8 degrees, the eye execute's
 * 6 cm, the hands whirlwind's 0.04; AUDIT GATHER-FEEL F5/R1: three of the look's stood at 0.8 to 1.1, each scaled by
 * the one share) - and no shake of its own (no Better Ambience kick, no roll, no lens): an act repeats its blow every
 * half second. The pick's head is the heavier (its swing is heard pitched down, gatherSounds.js PICK_SWING_PITCH), its
 * blow a little deeper; a clean blow a little deeper again.
 */
export const GATHER_BLOW_FEEL = f({
  chop: f({
    plain: f({ cam: f({ pitch: -0.45, eye: -0.012 }), hands: f({ y: 0.022 }) }),
    clean: f({ cam: f({ pitch: -0.65, eye: -0.018 }), hands: f({ y: 0.03 }) }),
  }),
  mine: f({
    plain: f({ cam: f({ pitch: -0.5, eye: -0.014 }), hands: f({ y: 0.025 }) }),
    clean: f({ cam: f({ pitch: -0.7, eye: -0.02 }), hands: f({ y: 0.034 }) }),
  }),
});

/** The blow an act machine's state just landed: its `kind` ('chop', 'mine' - the machine's own) and whether it was the
 *  clean one - the machine's `last` is the blow just struck (a press while a swing is in the air counts nothing, so
 *  nothing struck it again before it landed): a Clean Cut ('clean'), a strike on the glint ('glint'). Pure. */
export const landedBlow = (st) => ({ kind: st?.kind ?? null, clean: st?.last === 'clean' || st?.last === 'glint' });

/**
 * BLOW-SHAKE: a blow of `kind` (an act machine's state kind - 'chop', 'mine') landed, `clean` a Clean Cut's or the
 * glint's: its feel kicked into the springs at the player's own technique motion. On the classic skin, at Off, under
 * reduced motion, or for an act that swings nothing, nothing. Answers whether the view moved. The doors are the pins'
 * - each defaults to the game's own.
 * @param {string} kind @param {boolean} clean
 * @param {{ enhanced?: () => boolean, motion?: () => number, reduced?: () => boolean, kick?: typeof kickFx }} [o]
 */
export function gatherBlowFeel(kind, clean, { enhanced = () => isEnhanced(), motion = techniqueMotion, reduced = () => prefersReducedMotion(), kick = kickFx } = {}) {
  const row = GATHER_BLOW_FEEL[/** @type {keyof typeof GATHER_BLOW_FEEL} */ (kind)]?.[clean ? 'clean' : 'plain'];
  if (!row || !enhanced() || reduced()) return false;
  const m = motion();
  if (!(m > 0)) return false;
  kick(row.cam, row.hands, m);
  return true;
}

// ---- VEIN-CRACKS: the chunks ----------------------------------------------------------------------------------------

/** The chunks: how many a blow sheds (a plain strike, one on the glint, the blow that breaks the vein); a chunk's size,
 *  of the ore picture's own (a vein's flats stand at scenes/mineHost.js VEIN_SCALE); where they leave from - the struck
 *  face, `face` metres toward the striker from the node's middle, `spread` either way about it; how they fly - `out`
 *  toward the striker and `up`, metres a second (low to high), `side` either way across - and fall (`gravity`, the
 *  world's own, m/s^2); a chunk lies `restS` where it fell, then sinks into the ground over `sinkS`, gone; at most
 *  `flyMaxS` in the air (a floor never met). */
export const VEIN_CHUNKS = f({
  plain: 3, clean: 5, last: 7,
  scale: 0.32,
  face: 0.35, spread: 0.12,
  out: f([1.1, 2.4]), up: f([1.4, 3]), side: 1.1,
  gravity: 9.81,
  restS: 1.2, sinkS: 0.35, flyMaxS: 1.5,
});

/** How many chunks a landed blow sheds: the last blow (the vein breaking) the most, one on the glint more. Pure. */
export const chunksFor = (last, clean) => (last ? VEIN_CHUNKS.last : clean ? VEIN_CHUNKS.clean : VEIN_CHUNKS.plain);

/**
 * The chunks a landed blow sheds: `n` of them out of the struck face - `at` the node's middle (the act's own place, its
 * lift), toward `eye` (the striker's) - each `{ p, v, t, rest, land, floor }`: its place and its velocity, its time in the
 * air, how long it has lain (-1 while it flies), and when and how high it comes down (chunkLandingOf). AUDIT GATHER-FEEL V3:
 * `floor` the ground under the node, `ground` ((x, z) => its height, in the same frame - a street pixel's heightmap) the
 * ground anywhere: a chunk comes down where its arc first meets the ground, on a slope's downhill and its uphill alike;
 * with no `ground` (a dungeon's floor under its wall) on `floor`. Pure but for `rand`.
 * @param {ArrayLike<number>} at @param {ArrayLike<number>} eye @param {number} n @param {() => number} [rand]
 * @param {number} [floor] @param {((x: number, z: number) => number)|null} [ground]
 */
export function shedChunks(at, eye, n, rand = Math.random, floor = at[1], ground = null) {
  let dx = eye[0] - at[0], dz = eye[2] - at[2];
  const l = Math.hypot(dx, dz);
  if (l > 1e-6) { dx /= l; dz /= l; } else { dx = 0; dz = 1; }
  const sx = -dz, sz = dx;   // across the face
  const C = VEIN_CHUNKS, out = [];
  for (let i = 0; i < n; i++) {
    const across = (2 * rand() - 1) * C.spread, high = (2 * rand() - 1) * C.spread;
    const o = C.out[0] + rand() * (C.out[1] - C.out[0]), a = (2 * rand() - 1) * C.side, u = C.up[0] + rand() * (C.up[1] - C.up[0]);
    const p = [at[0] + dx * C.face + sx * across, at[1] + high, at[2] + dz * C.face + sz * across];
    const v = [dx * o + sx * a, u, dz * o + sz * a];
    const down = chunkLandingOf(p, v, floor, ground);
    out.push({ p, v, t: 0, rest: -1, land: down.t, floor: down.y });
  }
  return out;
}

/** The arc's own height `t` seconds after it left `p` at `v`. */
const arcY = (p, v, t) => p[1] + v[1] * t - 0.5 * VEIN_CHUNKS.gravity * t * t;
/** The steps a landing is looked for in along the arc, and the halvings it is found to after (well under a millimetre). */
const LAND_STEPS = 64, LAND_HALVINGS = 24;
/**
 * WHEN AND HOW HIGH A CHUNK COMES DOWN: thrown from `p` at `v`, onto the flat `floor` (the arc's later root - down onto
 * it), or - AUDIT GATHER-FEEL V3 - onto `ground` ((x, z) => height) where the arc first meets it: found along the arc,
 * then halved to the moment, so a chunk thrown up a hill meets the hillside as it climbs and one thrown down it falls
 * past the node's foot. A chunk lay on the node's foot's height wherever it came down - on a 0.6 grade, a metre over the
 * downhill and as deep inside the uphill. At most `flyMaxS` aloft. `{ t, y }` - the seconds aloft and the height it lies
 * at. Pure.
 * @param {ArrayLike<number>} p @param {ArrayLike<number>} v @param {number} floor @param {((x: number, z: number) => number)|null} [ground]
 */
export function chunkLandingOf(p, v, floor, ground = null) {
  const g = VEIN_CHUNKS.gravity, T = VEIN_CHUNKS.flyMaxS;
  if (!ground) {
    const disc = v[1] * v[1] + 2 * g * (p[1] - floor);
    const t = disc > 0 ? (v[1] + Math.sqrt(disc)) / g : 0;   // a start below the floor (never a vein's) lies on it at once
    return t < T ? { t, y: floor } : { t: T, y: arcY(p, v, T) };
  }
  const over = (t) => arcY(p, v, t) - ground(p[0] + v[0] * t, p[2] + v[2] * t);
  if (!(over(0) > 0)) return { t: 0, y: Math.max(p[1], ground(p[0], p[2])) };   // struck from under the ground: on it at once
  let a = 0;
  for (let k = 1; k <= LAND_STEPS; k++) {
    let b = (T * k) / LAND_STEPS;
    if (!(over(b) > 0)) {
      for (let i = 0; i < LAND_HALVINGS; i++) { const m = (a + b) / 2; if (over(m) > 0) a = m; else b = m; }
      return { t: b, y: ground(p[0] + v[0] * b, p[2] + v[2] * b) };   // lying on the ground where it came down, exactly
    }
    a = b;
  }
  return { t: T, y: arcY(p, v, T) };
}

/** One chunk's frame: in the air it flies the arc exactly (place + velocity t - gravity t^2 / 2), and lands at the very
 *  moment within the step it comes down (its `land`, shedChunks' - AUDIT GATHER-FEEL V3: on the ground where its arc
 *  meets it, found as it was shed), lying at its `floor`, exactly - the same place at any frame rate, a hitch's long step
 *  included. The rest of the step it lies. Answers false once it has lain and sunk away. */
export function stepChunk(c, dt) {
  const C = VEIN_CHUNKS;
  if (!(dt > 0)) return c.rest < C.restS + C.sinkS;
  if (c.rest < 0) {
    const g = C.gravity;
    const left = c.land - c.t;
    const s = left <= dt ? Math.max(0, left) : dt;   // the step's time aloft, at most to its landing
    c.p[0] += c.v[0] * s; c.p[2] += c.v[2] * s;
    c.p[1] += c.v[1] * s - 0.5 * g * s * s;
    c.v[1] -= g * s;
    if (left > dt) { c.t += s; return true; }
    c.t = c.land;
    c.p[1] = c.floor;   // on the ground it came down on, exactly
    c.rest = dt - s;   // the rest of the step, lain
    return c.rest < C.restS + C.sinkS;
  }
  c.rest += dt;
  return c.rest < C.restS + C.sinkS;
}

/** How far a lying chunk has sunk, of its height `h` (m): none in the air or at rest, then down to all of it. Pure. */
export const chunkSink = (c, h) => (c.rest < VEIN_CHUNKS.restS ? 0 : Math.min(1, (c.rest - VEIN_CHUNKS.restS) / VEIN_CHUNKS.sinkS) * h);

/** The box a burst's chunks can reach (`[x0, y0, z0, x1, y1, z1]`, the burst's own frame): about the node's middle `at`,
 *  as far across as the fastest chunk flies in the longest flight there is (from the face's top at the fastest climb to
 *  the `floor` - the lowest any of them comes down on; stepChunk lands exactly, so no step carries a chunk past it) and
 *  half a chunk's width `w` more (its picture faces the eye - AUDIT GATHER-FEEL V3), up to its arc's top over the face,
 *  down to the floor and the height `h` of one chunk below it (sunk). The street's pixel walk culls a batch by its box
 *  (scenes/world.js EV3), so a burst's box holds every place a chunk of it can be. Pure. */
export function chunkBox(at, floor, h, w = 0) {
  const C = VEIN_CHUNKS, g = C.gravity;
  const drop = Math.max(0, at[1] + C.spread - floor);
  const flight = Math.min(C.flyMaxS, (C.up[1] + Math.sqrt(C.up[1] * C.up[1] + 2 * g * drop)) / g);
  const r = C.face + C.spread + Math.hypot(C.out[1], C.side) * flight + w / 2;
  const rise = C.spread + (C.up[1] * C.up[1]) / (2 * g);
  return [at[0] - r, Math.min(floor, at[1]) - h, at[2] - r, at[0] + r, at[1] + rise + h, at[2] + r];
}
