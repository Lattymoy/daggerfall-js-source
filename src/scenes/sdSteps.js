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
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { realmToDungeon, SD_REALM_ORIGIN } from '../net/sdBrain.js';
import { SD_STEPS_COURSE, SD_BEAT_HALF, SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_GUST_EVERY, stepAt, beatStands, beatBlinks, crumbleAfter, gustAt, breathSeen, inBreath, inVoid, spanAt, castBackTo } from '../world/sdSteps.js';
import { SD_STEP_KINDS, SD_BREATH, buildStepModel, stepTris, buildChecksModel, checkFloorTris, buildBreathModel } from '../world/sdStepsModel.js';
import { stepsArt } from '../world/sdStepsArt.js';
import { SD_REALM_ARCHIVE } from '../world/sdRealm.js';
import { identity } from '../world/mat4.js';

/** The Steps' words. */
export const SD_STEPS_TEXT = Object.freeze({ cast: 'The Hour casts you back.' });
/** A step's collider bucket; the checkpoints'. */
export const sdStepKey = (i) => `sd:step:${i}`;
export const SD_CHECKS_KEY = 'sd:steps:checks';
/** The sounds (DAGGER.SND records): the Beat's tick (the hall's gear clunk, light and high), a Crumble step's grind as it
 *  cracks (AmbientGrind), the breath's rising wind (AmbientWindBlow1), the void's moan at a cast-back
 *  (AmbientWindMoanDeep). */
export const SD_STEPS_SOUNDS = Object.freeze({ tick: 433, grind: 68, wind: 70, moan: 66 });
/** Where a gone step's bucket waits (the realm's y): far under the void's floor, out of every reach. */
export const SD_STEP_GONE_Y = -400;
/** A shaking Crumble step's shudder (m); the Beat's blink (flashes a second); how far under the course a falling Crumble
 *  step is still drawn. */
export const SD_CRUMBLE_SHAKE = 0.035;
export const SD_BEAT_BLINK_HZ = 8;
export const SD_CRUMBLE_SEEN = 40;
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

/**
 * The Unmoored Steps.
 * @param {{ renderer?: any, audio?: any }} deps
 */
export function createSdSteps({ renderer = null, audio = null } = {}) {
  /** Each step: the law's record, its bucket's key and place (`T`, the dungeon's frame - the collider reads it at every
   *  query) and last frame's (`was`), whether it stands solid now and stood so then, its draw, and the realm's second my
   *  foot first stood on it (a Crumble step's - null untouched). */
  const steps = SD_STEPS_COURSE.map((s) => ({ s, key: sdStepKey(s.i), T: [0, SD_STEP_GONE_Y, 0], was: [0, SD_STEP_GONE_Y, 0], solid: false, wasSolid: false, draw: null, touched: null }));
  const byKey = new Map(steps.map((st) => [st.key, st]));
  /** @type {Map<string, any>} */
  const meshes = new Map();
  /** @type {any[] | null} */
  let draws = null;
  let checksMesh = null, lastTick = null, lastWarned = null;
  /** AUDIT SD II (L2 F18): the breath's streaks - their mesh and their draw, hidden but while the breath is seen. L4 F1:
   *  the span my feet last stood in (a checkpoint's included), where the void casts me back to. */
  let breathMesh = null, breathDraw = null, lastSpan = -1;

  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(model); } catch (e) { console.warn('[sd] the Steps would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const play = (rec, vol, pitch = 1) => { try { audio?.playOneShot?.(rec, vol, pitch); } catch { /* no sound */ } };
  const play3 = (rec, at, vol, pitch = 1) => { try { audio?.play3d?.(rec, at, vol, { maxDistance: 30, pitch }); } catch { /* no sound */ } };

  /** A step stood where the law has it at the frame's clock (`_now`): its bucket's place (sunk while it is gone) and its
   *  draw's. */
  function pose(st) {
    const s = st.s, t = _now[0];
    st.was[0] = st.T[0]; st.was[1] = st.T[1]; st.was[2] = st.T[2];
    st.wasSolid = st.solid;
    stepAt(s, t, _at);   // AUDIT SD: in place, and realmToDungeon's own sum - a frame of 23 steps makes nothing
    const x = SD_REALM_ORIGIN[0] + _at[0], y = SD_REALM_ORIGIN[1] + _at[1], z = SD_REALM_ORIGIN[2] + _at[2];
    let solid = true, seen = true, drawY = y, sx = 0, sz = 0;
    if (s.kind === 'beat') {
      solid = beatStands(s, t);
      seen = solid && !(beatBlinks(s, t) && Math.floor(t * SD_BEAT_BLINK_HZ) % 2 === 1);
    } else if (s.kind === 'crumble') {
      let since = -1;   // AUDIT SD II (L2 F9): untouched, a since before any touch (crumbleAfter's own whole) - never null beside a number
      if (st.touched != null) {
        since = t - st.touched;
        if (!(since >= 0 && since < SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK)) { st.touched = null; since = -1; }   // whole again (or the clock went back)
      }
      const c = crumbleAfter(since, _crumble);
      solid = c.whole;
      drawY = y - c.drop;
      seen = c.drop < SD_CRUMBLE_SEEN;
      if (c.shaking) { sx = SD_CRUMBLE_SHAKE * Math.sin(t * 71); sz = SD_CRUMBLE_SHAKE * Math.cos(t * 53); }
    }
    st.solid = solid;
    st.T[0] = x; st.T[2] = z;
    if (solid) st.T[1] = y; else st.T[1] = SD_STEP_GONE_Y;   // AUDIT SD II (L2 F9): two stores - a choice of a made number and a whole one is a number made
    if (st.draw) { if (seen) translate(st.draw.object.matrix, x + sx, drawY, z + sz); else st.draw.object.matrix.fill(0); st.draw.hidden = !seen; }   // AUDIT SD II (L2 F11): a hidden step is no draw
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
      if (breathMesh) { breathDraw = { gpu: breathMesh, object: { matrix: new Float32Array(16) }, hidden: true }; draws.push(breathDraw); }
      for (const st of steps) {
        const gpu = meshes.get(st.s.kind);
        if (gpu) { st.draw = { gpu, object: { matrix: new Float32Array(16) } }; draws.push(st.draw); }
        const { positions, indices } = stepTris(st.s.kind);
        try { collider?.addMesh?.(st.key, positions, indices, identity(), () => st.T); } catch (e) { console.warn('[sd] a step\'s collider', e?.message ?? e); }
      }
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
      // the Warp's breath, and its wind the second before it
      const g = gustAt(t, _gust);
      if (g.push && inBreath(rz) && dt > 0) body.collider?.move?.(body.pos, g.push * Math.min(dt, BREATH_DT_MAX), 0, 0, body.height, !!body.grounded && !body.jumping);
      const gust = Math.floor(t / SD_GUST_EVERY);
      if (g.warn && span === 2 && lastWarned !== gust) { lastWarned = gust; play(SD_STEPS_SOUNDS.wind, 0.9); }
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
    /** Every step as it stands (tests): its bucket's place, whether solid, its draw's matrix, its touch. */
    get steps() { return steps.map((st) => ({ i: st.s.i, kind: st.s.kind, key: st.key, T: [...st.T], solid: st.solid, touched: st.touched, matrix: st.draw ? Float32Array.from(st.draw.object.matrix) : null })); },
    /** Gone with the dungeon: every mesh freed. */
    clear() {
      for (const m of meshes.values()) drop(m);
      drop(checksMesh);
      drop(breathMesh);
      meshes.clear();
      checksMesh = null; breathMesh = null; breathDraw = null;
      for (const st of steps) st.draw = null;
      draws = null;
    },
  };
}
