// @ts-check
// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS ON THE
// PAGE - the dungeon host's set for the Shattered Hour's platforming, as scenes/sdHall.js is for its puzzle. The Steps are
// not the relay's: every screen moves them on the realm's anchored clock (scenes/world.js deadlandsSeconds - the relay's
// time), so every player sees the same step in the same place; what a foot breaks is its own.
//
//   STOOD once (stand): one mesh a kind of step (world/sdStepsModel.js), and for each step a draw and a collider bucket
//     - a MOVER's, its translation read at every query, so a step moves and its triangles never do - and the
//     checkpoints B and C, drawn and floored.
//   RIDDEN each frame BEFORE THE MOTOR (ride - the outer host asks it beside the action movers' ride): every step stood
//     where the law has it at the realm's now - the Drift's swing; a Beat step there or gone (its bucket sunk out of all
//     reach, its draw hidden) and its blink; a Crumble step's shudder, its fall and its return, from the moment my own
//     foot first stood on it - and a body standing on a step carried with the step's own move, as a deck carries one
//     (player/motor.js carryBy). Then, while the motor runs: THE WARP'S BREATH over the Crumble, the body moved through
//     the resolver as the movers' ride moves it (the motor's own push stops at every edge; the breath does not), its
//     wind heard the second before (and, every frame, its brass streaks seen blowing the way it blows, from then through
//     the gust - AUDIT SD II); the Beat's tick on each half beat, as its steps come back; and a body fallen past the
//     void's floor answered with the checkpoint of the span it last stood in - the outer host stands it there and takes
//     what it costs.
//
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 8): EVERY STEP SHOWS WHAT IT WILL DO NEXT,
// from across the void, before the jump. The law (world/sdSteps.js - its solids and its timing) is untouched; every
// picture stands inside its step's box, and every part that moves casts nothing (`noShadow`).
//   THE DRIFT hangs from pendulums: two rods up SD_PENDULUM.len to a gear, leaning with the law's own swing
//     (pendulumAngle) - the gear rocks with them - so a swing's period and phase read before the jump.
//   THE BEAT is a clock-plate: its frame (a draw's texRemap - world/sdStepsArt.js's twelve) its hand's place on the way
//     back to XII across its solid 2.4 s; in its last 0.4 s the hand in the ember, its light faltering once at
//     SD_BEAT_BLINK_HZ (the falter frame - the flash law, S0's) while it dissolves out through the ordered dither (its
//     cells, world/sdStepsModel.js buildBeatDissolve - the draw's mesh a stage a tenth of a second), dithering back in
//     over SD_BEAT_IN_S; gone, its GHOST hangs where it will return, its hand still running back (render/sdStepsPass.js).
//   THE CRUMBLE, mine: its cracks flaring in three stages across the shake (SD_STEPS_RECORD.crumble) while grit pours
//     from it; then its four chunks fall (drop, drift, tumble) while its ghost counts the return; in the last
//     SD_CHUNK.rewind of it the chunks fly back up out of the void, eased out, and click together - a shudder, whole.
//     The law's return still decides: the chunks are only where the time says.
//   THE WAYSTONES on A, B and C: the one my cast-back would stand me on lit gold, the others dark - one at a time.
//   THE VANE on C (the Hollow's Ending's sign on its fin) swings to point the coming gust's push a second before it,
//     with a clack (world/sdStepsModel.js vaneYawAt).
//   THE GHOSTS, one pass a frame for the whole course (drawPass - the world host's Hour pass draws it).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { realmToDungeon, SD_REALM_ORIGIN } from '../net/sdBrain.js';
import { SD_STEPS_COURSE, SD_BEAT_HALF, SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G, SD_GUST_EVERY, stepAt, beatStands, beatBlinks, crumbleAfter, gustAt, breathSeen, inBreath, inVoid, spanAt, castBackTo } from '../world/sdSteps.js';
import {
  SD_STEP_KINDS, SD_BREATH, SD_PENDULUM, SD_BEAT_DISSOLVE, SD_GRIT, SD_WAYSTONES, SD_VANE, buildStepModel, stepTris, buildChecksModel, checkFloorTris, buildBreathModel,
  buildBeatDissolve, buildPendulum, pendulumAngle, buildCrumbleChunks, buildGritModel, buildWaystoneModel, buildVaneModel, vaneYawInto,
} from '../world/sdStepsModel.js';
import { stepsArt, SD_STEPS_RECORD } from '../world/sdStepsArt.js';
import { SD_REALM_ARCHIVE } from '../world/sdRealm.js';
import { identity } from '../world/mat4.js';
import { SdStepsPass, SD_GHOST_STEPS, SD_GHOST } from '../render/sdStepsPass.js';
import { SD_SKY_STEPS } from '../render/sdSky.js';
import { isTouchDevice } from '../ui/touchDevice.js';

/** The Steps' words. */
export const SD_STEPS_TEXT = Object.freeze({ cast: 'The Hour casts you back.' });
/** A step's collider bucket; the checkpoints'. */
export const sdStepKey = (i) => `sd:step:${i}`;
export const SD_CHECKS_KEY = 'sd:steps:checks';
/** The sounds (DAGGER.SND records): the Beat's tick (the hall's gear clunk, light and high), a Crumble step's grind as it
 *  cracks (AmbientGrind), the breath's rising wind (AmbientWindBlow1), the void's moan at a cast-back
 *  (AmbientWindMoanDeep); SD-LOOK S9: the vane's clack and the chunks' click home (the same clunk, pitched up). */
export const SD_STEPS_SOUNDS = Object.freeze({ tick: 433, grind: 68, wind: 70, moan: 66, clack: 433 });
/** Where a gone step's bucket waits (the realm's y): far under the void's floor, out of every reach. */
export const SD_STEP_GONE_Y = -400;
/** A shaking Crumble step's shudder (m); the Beat's blink (flashes a second); how far under the course a falling Crumble
 *  step is still drawn. SD-FLASH: the blink is a flash, under the project's ceiling (`TELEGRAPH_THROB_MAX_HZ`, 3) - at 8
 *  it toggled sixteen times a second; at 2.5 the warning's 0.4 s is one falter: shown, then out. */
export const SD_CRUMBLE_SHAKE = 0.035;
export const SD_BEAT_BLINK_HZ = 2.5;
export const SD_CRUMBLE_SEEN = 40;
/** SD-LOOK S9: a Beat frame's length (s - twelve across its solid: motion, never a flash), how long it dithers in, and
 *  how long each stage of its going stands (s). */
export const SD_BEAT_FRAME_S = SD_BEAT_SOLID / 12;
export const SD_BEAT_IN_S = 0.15;
export const SD_BEAT_OUT_STAGE_S = SD_BEAT_BLINK / SD_BEAT_DISSOLVE.keep.length;
/** SD-LOOK S9: THE CRUMBLE'S CHUNKS - the rewind's length at the end of SD_CRUMBLE_BACK (s), how far down their fall they
 *  fly back from (s of it), their drift outward (m/s) and their tumble (rad/s); the shudder when whole again (s, m). */
export const SD_CHUNK = Object.freeze({ rewind: 0.6, rise: 2.2, drift: 0.5, spin: 2.2, shudder: 0.25, settle: 0.02 });
/** The longest frame the breath pushes for (s) - a hitch is not a gale. */
const BREATH_DT_MAX = 0.1;
/** AUDIT SD: a step's place, the frame's one scratch (a frame is one call deep - nothing awaits between its uses). AUDIT SD
 *  II (L2 F9): and a Crumble step's state, the breath's push and its sight - "a frame of 23 steps makes nothing" was not
 *  so (eight Crumble states, the gust and the body's place in the realm, made a frame). */
const _at = [0, 0, 0];
/** AUDIT SD II (L2 F9): the frame's clock, where each step's pose reads it - a double handed to a call is a number made */
const _now = new Float64Array(1);
const _crumble = { drop: 0, whole: true, shaking: false };
const _gust = { push: 0, warn: false };
const _breath = { dir: 0, k: 0 };
/** SD-LOOK S9: the looks' scratch - a step's place (the scene's frame), its shake across, and its time since my foot (a
 *  Crumble's) - AUDIT SD II (L2 F9): a double handed to a call is a number made, so the looks read their numbers here. And
 *  the vane's clock and its yaw. */
const _p = new Float64Array(6);
const _vane = new Float64Array(2);

/** SD-LOOK S9: the records a draw's texRemap swaps in - made once (the renderer keys its cache on the map itself). */
const key = (rec) => `${SD_REALM_ARCHIVE}_${rec}`;
const BEAT_FRAMES = Object.freeze(SD_STEPS_RECORD.beat.map((rec, k) => (k === 0 ? null : new Map([[key(SD_STEPS_RECORD.beat[0]), key(rec)]]))));
const BEAT_FALTER = new Map([[key(SD_STEPS_RECORD.beat[0]), key(SD_STEPS_RECORD.falter)]]);
const CRUMBLE_STAGES = Object.freeze(SD_STEPS_RECORD.crumble.map((rec, k) => (k === 0 ? null : new Map([[key(SD_STEPS_RECORD.crumble[0]), key(rec)]]))));
const WAYSTONE_DARK = new Map([[key(SD_STEPS_RECORD.parts), key(SD_STEPS_RECORD.partsDark)]]);

const _uploaded = new WeakSet();
/** The Steps' pictures, uploaded once a renderer - albedo and their own light. */
export function ensureSdStepsArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (const [rec, art] of stepsArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true }); }   // AUDIT SD II (L2 F3): its own light, never the window's day tint
}
/** `out` made the translation to (x, y, z) - column-major, in place. */
function translate(out, x, y, z) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
/** `out` made a turn by `a` about z (+x toward +y), then the move to (x, y, z) - in place: a pendulum's lean. */
function leanAbout(out, a, x, y, z) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c; out[10] = 1; out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
/** `out` made a turn by `yw` about y (0 faces +z, a quarter turn +x), then the move to (x, y, z) - in place. */
function yawAbout(out, yw, x, y, z) {
  const c = Math.cos(yw), s = Math.sin(yw);
  out.fill(0);
  out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
const hide = (d) => { if (d && !d.hidden) { d.object.matrix.fill(0); d.hidden = true; } };

/**
 * The Unmoored Steps.
 * @param {{ renderer?: any, audio?: any, ending?: string | null, lite?: boolean }} deps - SD-LOOK S9: `ending` the Hollow's Ending
 *   (net/sdMarks.js SD_ENDINGS' id), its sign on the vane's fin; `lite` the phone's tier (ui/touchDevice.js isTouchDevice -
 *   its own by default): two chunks a Crumble step, not four, and the pendulums' gears without teeth
 */
export function createSdSteps({ renderer = null, audio = null, ending = null, lite = isTouchDevice() } = {}) {
  /** Each step: the law's record, its bucket's key and place (`T`, the dungeon's frame - the collider reads it at every
   *  query) and last frame's (`was`), whether it stands solid now and stood so then, its draw, and the realm's second my
   *  foot first stood on it (a Crumble step's - null untouched). SD-LOOK S9: its ghost's slot (render/sdStepsPass.js; -1
   *  none), its pendulum's draw (the Drift's), its chunks' and its grit's draws and when it was last whole again (the
   *  Crumble's). */
  const steps = SD_STEPS_COURSE.map((s) => ({ s, key: sdStepKey(s.i), T: [0, SD_STEP_GONE_Y, 0], was: [0, SD_STEP_GONE_Y, 0], solid: false, wasSolid: false, draw: null, touched: null, ghost: SD_GHOST_STEPS.indexOf(s), pend: null, chunks: null, grit: null, back: -Infinity }));
  const byKey = new Map(steps.map((st) => [st.key, st]));
  const lastStep = steps[steps.length - 1];
  /** @type {Map<string, any>} */
  const meshes = new Map();
  /** @type {any[] | null} */
  let draws = null;
  let checksMesh = null, lastTick = null, lastWarned = null;
  /** AUDIT SD II (L2 F18): the breath's streaks - their mesh and their draw, hidden but while the breath is seen. L4 F1:
   *  the span my feet last stood in (a checkpoint's included), where the void casts me back to. */
  let breathMesh = null, breathDraw = null, lastSpan = -1;
  /** SD-LOOK S9: the Beat's dissolve stages, the pendulum's, the chunks' (and their ways), the grit's, the waystones' and
   *  the vane's meshes; the waystones' and the vane's draws; the ghosts' places and states (render/sdStepsPass.js's two
   *  uniform arrays, written in place) and their pass. */
  /** @type {any[]} */
  let dissolve = [], chunkMeshes = [];
  let pendMesh = null, gritMesh = null, stoneMesh = null, vaneMesh = null, vaneDraw = null, lit = -2, pass = null, passTried = false;
  /** @type {any[]} */
  const stoneDraws = [];
  /** @type {Array<{ at: ReadonlyArray<number>, ox: number, oz: number, kx: number, kz: number, w: number, g: number }>} */
  let chunkWays = [];
  const ghostStep = new Float32Array(SD_GHOST_STEPS.length * 4), ghostState = new Float32Array(SD_GHOST_STEPS.length * 4);

  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(model); } catch (e) { console.warn('[sd] the Steps would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const play = (rec, vol, pitch = 1) => { try { audio?.playOneShot?.(rec, vol, pitch); } catch { /* no sound */ } };
  const play3 = (rec, at, vol, pitch = 1) => { try { audio?.play3d?.(rec, at, vol, { maxDistance: 30, pitch }); } catch { /* no sound */ } };
  /** SD-LOOK S9: A DRIFT STEP'S PENDULUM leaning with the law's own swing (its offset in `_at`), the gear rocking with it -
   *  its turn about z written in place (its other entries stood once). */
  function driftLook(st) {
    const m = st.pend.object.matrix, a = pendulumAngle(_at[0] - st.s.x), c = Math.cos(a), sn = Math.sin(a);
    m[0] = c; m[1] = sn; m[4] = -sn; m[5] = c;
    m[12] = SD_REALM_ORIGIN[0] + st.s.x; m[13] = _p[1] + SD_PENDULUM.len; m[14] = _p[2];
  }
  /** SD-LOOK S9: A BEAT STEP'S LOOK - its frame (the hand's place on the way back to XII), its light's falter, its dissolve
   *  out over its warning and in over SD_BEAT_IN_S - and its ghost while it is gone, its hand running back to the return. */
  function beatLook(st, solid, falter) {
    const s = st.s, u = (((_now[0] - s.beat) % SD_BEAT_CYCLE) + SD_BEAT_CYCLE) % SD_BEAT_CYCLE, warned = u - (SD_BEAT_SOLID - SD_BEAT_BLINK);
    if (st.draw && solid) {
      st.draw.texRemap = falter ? BEAT_FALTER : BEAT_FRAMES[Math.min(11, Math.floor(u / SD_BEAT_FRAME_S))];
      const out = warned >= 0 ? Math.min(dissolve.length - 1, Math.floor(warned / SD_BEAT_OUT_STAGE_S)) : -1, into = u < SD_BEAT_IN_S ? 2 - Math.floor((u / SD_BEAT_IN_S) * 3) : -1;
      st.draw.gpu = (out >= 0 ? dissolve[out] : into >= 0 ? dissolve[into] : null) ?? meshes.get('beat');
    }
    if (st.ghost < 0) return;
    const o = st.ghost * 4, left = SD_BEAT_CYCLE - u, k = (SD_GHOST.rise - left) / SD_GHOST.rise, e = k < 0 ? 0 : k > 1 ? 1 : k;
    ghostStep[o] = _p[0]; ghostStep[o + 1] = _p[1]; ghostStep[o + 2] = _p[2];
    ghostState[o] = solid ? 0 : 1; ghostState[o + 1] = solid ? 0 : left / (SD_BEAT_CYCLE - SD_BEAT_SOLID); ghostState[o + 2] = SD_GHOST.base + (SD_GHOST.peak - SD_GHOST.base) * e * e * (3 - 2 * e);
  }
  /** SD-LOOK S9: A CRUMBLE STEP'S LOOK (my own) - its cracks' stage across the shake, its grit pouring, then its four chunks
   *  falling (drop, drift, tumble) out of sight past SD_CRUMBLE_SEEN while its ghost counts the return, and in the last
   *  SD_CHUNK.rewind flying back up the same way, eased out; whole again, a shudder (into `_p`'s shake). The place, the
   *  shake and the time since my foot are `_p`'s. */
  function crumbleLook(st, shaking, whole) {
    const t = _now[0], since = _p[5], x = _p[0], y = _p[1], z = _p[2];
    if (!shaking && since < 0 && t >= st.back && t - st.back < SD_CHUNK.shudder) { const k = 1 - (t - st.back) / SD_CHUNK.shudder; _p[3] = SD_CHUNK.settle * k * Math.sin(t * 83); _p[4] = SD_CHUNK.settle * k * Math.cos(t * 61); }   // a shudder, and it is whole
    if (st.draw) st.draw.texRemap = shaking ? CRUMBLE_STAGES[1 + Math.min(2, Math.floor((since / SD_CRUMBLE_DELAY) * 3))] : null;
    const g = st.grit;
    if (g) {
      if (shaking) { const m = g.object.matrix; m[0] = m[5] = m[10] = m[15] = 1; m[12] = x + _p[3]; m[13] = y - ((t * SD_GRIT.speed) % SD_GRIT.period); m[14] = z + _p[4]; g.hidden = false; } else hide(g);
    }
    const f = whole ? -1 : since - SD_CRUMBLE_DELAY, back = SD_CRUMBLE_BACK - SD_CHUNK.rewind;
    if (st.chunks) {
      const r = f >= back ? 1 - (f - back) / SD_CHUNK.rewind : 0, tau = f >= back ? SD_CHUNK.rise * r * r : f, show = f >= back || (f >= 0 && _crumble.drop < SD_CRUMBLE_SEEN);
      for (let j = 0; j < st.chunks.length; j++) {
        const d = st.chunks[j];
        if (!show) { hide(d); continue; }
        // turned about its own horizontal axis (kx, 0, kz) by its tumble, stood where its fall has it - in place
        const C = chunkWays[j], m = d.object.matrix, a = C.w * tau, c = Math.cos(a), sn = Math.sin(a), v = 1 - c;
        m[0] = c + v * C.kx * C.kx; m[1] = sn * C.kz; m[2] = v * C.kx * C.kz; m[3] = 0;
        m[4] = -sn * C.kz; m[5] = c; m[6] = sn * C.kx; m[7] = 0;
        m[8] = v * C.kx * C.kz; m[9] = -sn * C.kx; m[10] = c + v * C.kz * C.kz; m[11] = 0;
        m[12] = x + C.at[0] + C.ox * SD_CHUNK.drift * tau; m[13] = y + C.at[1] - 0.5 * SD_CRUMBLE_FALL_G * tau * tau * C.g; m[14] = z + C.at[2] + C.oz * SD_CHUNK.drift * tau; m[15] = 1;
        d.hidden = false;
      }
    }
    if (st.ghost < 0) return;
    const o = st.ghost * 4, k = (f - back) / SD_CHUNK.rewind, e = k < 0 ? 0 : k > 1 ? 1 : k;
    ghostStep[o] = x; ghostStep[o + 1] = y; ghostStep[o + 2] = z;
    ghostState[o] = f >= 0 ? 1 : 0; ghostState[o + 1] = f >= 0 ? (SD_CRUMBLE_BACK - f) / SD_CRUMBLE_BACK : 0; ghostState[o + 2] = SD_GHOST.base + (SD_GHOST.peak - SD_GHOST.base) * e * e * (3 - 2 * e);
  }

  /** A step stood where the law has it at the frame's clock (`_now`): its bucket's place (sunk while it is gone) and its
   *  draw's. SD-LOOK S9: and its look (driftLook, beatLook, crumbleLook - each reading the place from `_p`). */
  function pose(st) {
    const s = st.s, t = _now[0];
    st.was[0] = st.T[0]; st.was[1] = st.T[1]; st.was[2] = st.T[2];
    st.wasSolid = st.solid;
    stepAt(s, t, _at);   // AUDIT SD: in place, and realmToDungeon's own sum - a frame of 23 steps makes nothing
    const x = SD_REALM_ORIGIN[0] + _at[0], y = SD_REALM_ORIGIN[1] + _at[1], z = SD_REALM_ORIGIN[2] + _at[2];
    let solid = true, seen = true, drawY = y, sx = 0, sz = 0;
    _p[0] = x; _p[1] = y; _p[2] = z;
    if (s.kind === 'drift') {
      if (st.pend) driftLook(st);
    } else if (s.kind === 'beat') {
      solid = beatStands(s, t);
      // SD-FLASH: the falter from the warning's own start (world/sdSteps.js beatWarned's sum, inline - AUDIT SD II L2 F9: a
      // double handed back from a call is a number made). SD-LOOK S9: the falter is the plate's LIGHT (its falter frame),
      // never the plate - a step that holds stays seen; its going is the dissolve's
      const warned = (((t - s.beat) % SD_BEAT_CYCLE) + SD_BEAT_CYCLE) % SD_BEAT_CYCLE - (SD_BEAT_SOLID - SD_BEAT_BLINK);
      const falter = beatBlinks(s, t) && Math.floor(warned * 2 * SD_BEAT_BLINK_HZ) % 2 === 1;
      seen = solid;
      beatLook(st, solid, falter);
    } else if (s.kind === 'crumble') {
      let since = -1;   // AUDIT SD II (L2 F9): untouched, a since before any touch (crumbleAfter's own whole) - never null beside a number
      if (st.touched != null) {
        since = t - st.touched;
        if (since >= SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK && since < SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK + 1) {   // SD-LOOK S9: back - its chunks click home
          st.back = st.touched + SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK;
          play3(SD_STEPS_SOUNDS.clack, [x, y, z], 0.7, 2.6);
        }
        if (!(since >= 0 && since < SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK)) { st.touched = null; since = -1; }   // whole again (or the clock went back)
      }
      const c = crumbleAfter(since, _crumble);
      solid = c.whole;
      seen = c.whole;   // SD-LOOK S9: fallen, its chunks fall in its stead
      if (c.shaking) { sx = SD_CRUMBLE_SHAKE * Math.sin(t * 71); sz = SD_CRUMBLE_SHAKE * Math.cos(t * 53); }
      _p[3] = sx; _p[4] = sz; _p[5] = since;
      crumbleLook(st, c.shaking, c.whole);
      sx = _p[3]; sz = _p[4];
    }
    st.solid = solid;
    st.T[0] = x; st.T[2] = z;
    if (solid) st.T[1] = y; else st.T[1] = SD_STEP_GONE_Y;   // AUDIT SD II (L2 F9): two stores - a choice of a made number and a whole one is a number made
    if (st.draw) { if (seen) translate(st.draw.object.matrix, x + sx, drawY, z + sz); else st.draw.object.matrix.fill(0); st.draw.hidden = !seen; }   // AUDIT SD II (L2 F11): a hidden step is no draw
    if (st === lastStep) poseMarks();   // SD-LOOK S9: the marks with the last step - out of the ride's own optimizer budget (AUDIT SD II L2 F9: there, its small calls were crowded out and a number made)
  }
  /** AUDIT SD II (L2 F18): THE BREATH SEEN - its streaks carried across the Crumble the way it blows (turned by x's sign,
   *  each face both ways), from its wind's rising through its gust; hidden the rest. */
  function poseBreath() {
    if (!breathDraw) return;
    breathSeen(_now[0], _breath);
    const m = breathDraw.object.matrix;
    if (!_breath.dir) { if (!breathDraw.hidden) { m.fill(0); breathDraw.hidden = true; } return; }
    translate(m, SD_REALM_ORIGIN[0] + _breath.dir * (_breath.k - 0.5) * SD_BREATH.sweep, SD_REALM_ORIGIN[1], SD_REALM_ORIGIN[2]);
    m[0] = _breath.dir;
    breathDraw.hidden = false;
  }
  /** SD-LOOK S9: the vane's swing, and the waystone my cast-back would stand me on lit - one at a time. */
  function poseMarks() {
    if (vaneDraw) {
      _vane[0] = _now[0];
      vaneYawInto(_vane);
      const m = vaneDraw.object.matrix, c = Math.cos(_vane[1]), sn = Math.sin(_vane[1]);
      m[0] = c; m[2] = -sn; m[8] = sn; m[10] = c;   // its turn about y (its move stood once)
    }
    const mine = lastSpan < 0 ? 0 : lastSpan;
    if (mine === lit) return;
    lit = mine;
    for (let k = 0; k < stoneDraws.length; k++) stoneDraws[k].texRemap = k === mine ? null : WAYSTONE_DARK;
  }

  return {
    /** Stand the Steps into the dungeon's draws and collider - once. */
    stand({ dynamicDraws, collider = null }) {
      if (draws) return false;
      draws = dynamicDraws;
      ensureSdStepsArt(renderer);
      for (const kind of SD_STEP_KINDS) { const m = make(buildStepModel(kind)); if (m) meshes.set(kind, m); }
      checksMesh = make(buildChecksModel());
      if (checksMesh) draws.push({ gpu: checksMesh, object: { matrix: identity() } });
      breathMesh = make(buildBreathModel());
      if (breathMesh) { breathDraw = { gpu: breathMesh, object: { matrix: new Float32Array(16) }, hidden: true, noShadow: true }; draws.push(breathDraw); }
      // SD-LOOK S9: the parts that show what each step will do - every one that moves casting nothing
      dissolve = SD_BEAT_DISSOLVE.keep.map((k) => make(buildBeatDissolve(k)));
      pendMesh = make(buildPendulum({ teeth: !lite }));
      const chunks = buildCrumbleChunks(lite ? 2 : 4);
      chunkMeshes = chunks.map((c) => make(c.model));
      chunkWays = chunks.map((c, j) => {
        const l = Math.hypot(c.at[0], c.at[2]) || 1, ox = c.at[0] / l, oz = c.at[2] / l;
        return { at: c.at, ox, oz, kx: oz, kz: -ox, w: SD_CHUNK.spin * (0.8 + 0.15 * j), g: 1 + 0.06 * (j - 1.5) };   // tumbling outward, each its own
      });
      gritMesh = make(buildGritModel());
      for (const st of steps) {
        const gpu = meshes.get(st.s.kind);
        if (gpu) { st.draw = { gpu, object: { matrix: new Float32Array(16) }, noShadow: true, texRemap: null }; draws.push(st.draw); }
        if (st.s.kind === 'drift' && pendMesh) { st.pend = { gpu: pendMesh, object: { matrix: leanAbout(new Float32Array(16), 0, ...realmToDungeon(st.s.x, st.s.y + SD_PENDULUM.len, st.s.z)) }, noShadow: true }; draws.push(st.pend); }
        if (st.s.kind === 'crumble') {
          st.chunks = chunkMeshes.filter(Boolean).map((m) => ({ gpu: m, object: { matrix: new Float32Array(16) }, hidden: true, noShadow: true }));
          for (const d of st.chunks) draws.push(d);
          if (gritMesh) { st.grit = { gpu: gritMesh, object: { matrix: new Float32Array(16) }, hidden: true, noShadow: true }; draws.push(st.grit); }
        }
        const { positions, indices } = stepTris(st.s.kind);
        try { collider?.addMesh?.(st.key, positions, indices, identity(), () => st.T); } catch (e) { console.warn('[sd] a step\'s collider', e?.message ?? e); }
      }
      stoneMesh = make(buildWaystoneModel());
      if (stoneMesh) for (const w of SD_WAYSTONES) { const d = { gpu: stoneMesh, object: { matrix: translate(new Float32Array(16), ...realmToDungeon(w[0], w[1], w[2])) }, noShadow: true, texRemap: null }; stoneDraws.push(d); draws.push(d); }
      vaneMesh = make(buildVaneModel(ending));
      if (vaneMesh) { vaneDraw = { gpu: vaneMesh, object: { matrix: new Float32Array(16) }, noShadow: true }; yawAbout(vaneDraw.object.matrix, 0, ...realmToDungeon(SD_VANE.at[0], SD_VANE.at[1], SD_VANE.at[2])); draws.push(vaneDraw); }
      const tris = checkFloorTris(), idx = [];
      for (let k = 0; k < tris.length / 3; k++) idx.push(k);
      try { collider?.addMesh?.(SD_CHECKS_KEY, tris, idx, identity()); } catch (e) { console.warn('[sd] the checkpoints\' floors', e?.message ?? e); }
      return true;
    },
    /**
     * One frame, BEFORE the motor: `t` the realm's anchored seconds, `body` the motor (its feet, ground, collider and
     * carry), `live` whether the motor runs this frame (a window held over it stops the breath, the touch and the void -
     * the steps still move, and still carry). The landing of a cast-back (the dungeon's frame), or null.
     * @returns {number[] | null}
     */
    ride(t, dt, body = null, live = true) {
      if (!draws) return null;
      const on = body?.grounded && typeof body.groundKey === 'string' ? byKey.get(body.groundKey) ?? null : null;
      if (on && live && on.s.kind === 'crumble' && on.touched == null) {
        on.touched = t;   // my foot on it: it shakes, and falls
        play3(SD_STEPS_SOUNDS.grind, [on.T[0], on.T[1], on.T[2]], 1, 1.3);
      }
      _now[0] = t;
      for (const st of steps) pose(st);
      poseBreath();
      // carried: the step I stand on moved under me this frame - standing before and after (its going and coming are no
      // move; a frame's hitch, or the clock put right, is: the body stays on its step)
      if (on && on.solid && on.wasSolid) {
        const dx = on.T[0] - on.was[0], dy = on.T[1] - on.was[1], dz = on.T[2] - on.was[2];
        if (dx || dy || dz) body.carryBy?.(dx, dy, dz);
      }
      if (!live || !body?.pos) return null;
      const ry = body.pos[1] - SD_REALM_ORIGIN[1], rz = body.pos[2] - SD_REALM_ORIGIN[2];   // AUDIT SD II (L2 F9): the realm's frame, net/sdBrain.js dungeonToRealm's own sum
      const span = spanAt(rz);
      if (body.grounded) lastSpan = on ? on.s.span : span;   // AUDIT SD II (L4 F1): the span I last stood in
      // the Warp's breath, and its wind the second before it - SD-LOOK S9: the vane's clack with it
      const g = gustAt(t, _gust);
      if (g.push && inBreath(rz) && dt > 0) body.collider?.move?.(body.pos, g.push * Math.min(dt, BREATH_DT_MAX), 0, 0, body.height, !!body.grounded && !body.jumping);
      const gust = Math.floor(t / SD_GUST_EVERY);
      if (g.warn && span === 2 && lastWarned !== gust) { lastWarned = gust; play(SD_STEPS_SOUNDS.wind, 0.9); play(SD_STEPS_SOUNDS.clack, 0.45, 2.2); }
      // the Beat's tick: a half beat gone by, and its steps come back
      if (span === 1) {
        const b = Math.floor(t / SD_BEAT_HALF);
        if (lastTick != null && b !== lastTick) play(SD_STEPS_SOUNDS.tick, 0.35, 1.6);
        lastTick = b;
      } else lastTick = null;
      // the void: back to the checkpoint of the span I last STOOD in - AUDIT SD II (L4 F1): the span the fall began in,
      // never the one its momentum carried it over (a fall back off the first Drift step passed under A and crossed the
      // void's floor short of A's near edge, before every span - no cast-back, a fall for ever; a run off a span's end was
      // cast forward to the next checkpoint); and any fall, wherever it crosses (castBackTo takes none to A)
      if (inVoid(ry)) {
        play(SD_STEPS_SOUNDS.moan, 1);
        return realmToDungeon(...castBackTo(lastSpan));
      }
      return null;
    },
    /** SD-LOOK S9: THE GHOSTS - the gone Beat plates and my gone Crumble pins outlined where they will return (one additive
     *  draw, render/sdStepsPass.js, made the first time), in `fog`. Answers whether it drew (the host marks a foreign pass). */
    drawPass(proj, view, fog = null) {
      if (!draws || !renderer?.gl) return false;
      if (!passTried) { passTried = true; try { pass = new SdStepsPass(renderer.gl); } catch (e) { console.warn('[sd] the Steps\' ghosts would not build', e?.message ?? e); pass = null; } }
      if (!pass) return false;
      const vp = renderer._worldViewportPx;   // the world image (px) - read, never copied: a frame makes nothing
      return pass.draw(proj, view, ghostStep, ghostState, fog, renderer.lightingLane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic, vp?.[2] ?? 0, vp?.[3] ?? 0);
    },
    /** The ghosts as the pass reads them (tests): each slot's top and state. */
    get ghosts() { return { step: ghostStep, state: ghostState }; },
    /** THE LAB'S KNOBS (src/tools/abyssLab.js): a Crumble step touched at realm second `at`, and the span my cast-back
     *  would take me to - what a foot and a fall would set. */
    touch(i, at) { const st = steps[i]; if (st?.s.kind === 'crumble') st.touched = at; },
    standOn(span) { lastSpan = span; },
    /** Every step as it stands (tests): its bucket's place, whether solid, its draw's matrix, its touch - SD-LOOK S9: and
     *  its draw's remap and mesh, and its chunks' matrices. */
    get steps() { return steps.map((st) => ({ i: st.s.i, kind: st.s.kind, key: st.key, T: [...st.T], solid: st.solid, touched: st.touched, matrix: st.draw ? Float32Array.from(st.draw.object.matrix) : null, remap: st.draw?.texRemap ?? null, gpu: st.draw?.gpu ?? null, chunks: st.chunks ? st.chunks.map((d) => Float32Array.from(d.object.matrix)) : null })); },
    /** Gone with the dungeon: every mesh freed, and the ghosts' pass. */
    clear() {
      for (const m of meshes.values()) drop(m);
      drop(checksMesh);
      drop(breathMesh);
      for (const m of [...dissolve, ...chunkMeshes, pendMesh, gritMesh, stoneMesh, vaneMesh]) drop(m);
      try { pass?.destroy(); } catch { /* gone */ }
      meshes.clear();
      checksMesh = null; breathMesh = null; breathDraw = null;
      dissolve = []; chunkMeshes = []; pendMesh = null; gritMesh = null; stoneMesh = null; vaneMesh = null; vaneDraw = null; pass = null; passTried = false; lit = -2;
      stoneDraws.length = 0;
      for (const st of steps) { st.draw = null; st.pend = null; st.chunks = null; st.grit = null; }
      draws = null;
    },
  };
}
