// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EVENT1 — THE DREAD: OBLIVION'S SKY OVER DAGGERFALL, FOR A LIVE EVENT.
//
// Mac (2026-09-25): "I wanna do a fun live event for the server ... turn
// the skies of Daggerfall into a detailed oblivion styled dread in prep
// for the world bosses. Red lightning and such."
//
// A dev stages it (`/event dread`, the relay's `stage` frame - net/wire.js
// LIVE_EVENTS), every player online sees it, and it ends when a dev ends
// it. This file is what it LOOKS like; the relay carries only the word.
//
// ONE GRADE, NOT A PALETTE PER RENDERER. The port draws its sky three ways
// (the classic panorama, its own dome, Dynamic Skies) with the volumetric
// clouds over the last two, and each keeps its colours in its own shape -
// a panorama texture, a state object, a Unity material. So the dread is a
// COLOUR GRADE applied where each one writes its pixel: a colour's
// luminance, dimmed, read along a crimson ramp - near-black maroon in the
// dark, blood red in the middle, a burning orange at the top. The zenith
// comes out dark, the horizon glows, lit cloud edges burn and their shaded
// bellies go black-red, at any hour and under any weather, because the
// grade reads the sky's own light rather than replacing it. `dreadGrade`
// is the law; DREAD_GLSL is the same law in the shaders (the sky passes
// and the clouds' composite), and the host grades the fog, the key light
// and the ambient with the JS twin, so the land sits under the sky it sees.
//
// THE STORM IS RED. The event brings its own lightning on a schedule keyed
// to the SHARED wall clock (net/wire.js WORLD5) - every player online sees
// a strike in the same second, each around themselves - through the same
// bolt field and renderer the weather's storms use, in the event's colour,
// with its thunder arriving over the speed of sound (distantStorms'
// thunderOf).
//
// IT FADES. A player who watches it begin sees the dread descend over
// DREAD_FADE_S, and lift the same way; a player who joins mid-event (or
// logs in to it) has it whole at once - they did not watch it come.
//
// ONLINE ALONE (Mac chose it): offline, nothing here is reached - the host
// asks the hub link, and there is none.
// ═══════════════════════════════════════════════════════════════════

import { seededRng } from '../systems/wind.js';
import { thunderOf } from '../systems/distantStorms.js';

/** The live event this file draws (net/wire.js LIVE_EVENTS). */
export const DREAD_EVENT = 'dread';
/** Real seconds the dread takes to descend on a player watching it begin, and to lift. */
export const DREAD_FADE_S = 12;

/** The grade dims a colour's luminance by this before reading the ramp - the dread is darker than the day it covers. */
export const DREAD_DIM = 0.85;
/** The crimson ramp, display space: `{at, color}` stops over dimmed luminance - black-maroon, blood, burning orange. */
export const DREAD_RAMP = Object.freeze([
  Object.freeze({ at: 0, color: Object.freeze([0.05, 0.004, 0.012]) }),
  Object.freeze({ at: 0.35, color: Object.freeze([0.55, 0.07, 0.03]) }),
  Object.freeze({ at: 0.8, color: Object.freeze([1.0, 0.42, 0.12]) }),
]);
/** Rec. 709 luminance weights - what "how bright is this colour" means for the grade. */
const LUMA = [0.2126, 0.7152, 0.0722];

/** The ramp's colour at dimmed luminance `l` (clamped to the ends). Pure. */
export function dreadRamp(l) {
  const [s0, s1, s2] = DREAD_RAMP;
  if (!(l > s0.at)) return [...s0.color];
  const [a, b, t] = l < s1.at ? [s0.color, s1.color, (l - s0.at) / (s1.at - s0.at)] : [s1.color, s2.color, Math.min(1, (l - s1.at) / (s2.at - s1.at))];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** `rgb` graded toward the dread by `w` (0: untouched, 1: the ramp's colour for its luminance). A new array; `rgb` is
 *  never written (the sky's colours are often a palette's own frozen rows). Pure. */
export function dreadGrade(rgb, w) {
  const k = Math.max(0, Math.min(1, w || 0));
  if (k === 0) return [rgb[0], rgb[1], rgb[2]];
  const g = dreadRamp((LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2]) * DREAD_DIM);
  return [rgb[0] + (g[0] - rgb[0]) * k, rgb[1] + (g[1] - rgb[1]) * k, rgb[2] + (g[2] - rgb[2]) * k];
}

const glslVec = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
/** `dreadGrade` in GLSL - `vec3 dreadGrade(vec3 c, float w)`, the same stops, dim and weights (generated from them,
 *  so the two cannot drift). A shader includes it and grades its final colour by its own `uDread`. */
export const DREAD_GLSL = (() => {
  const [s0, s1, s2] = DREAD_RAMP, f = (v) => v.toFixed(4);
  return `
vec3 dreadRamp(float l) {
  if (l < ${f(s1.at)}) return mix(${glslVec(s0.color)}, ${glslVec(s1.color)}, clamp((l - ${f(s0.at)}) / ${f(s1.at - s0.at)}, 0.0, 1.0));
  return mix(${glslVec(s1.color)}, ${glslVec(s2.color)}, clamp((l - ${f(s1.at)}) / ${f(s2.at - s1.at)}, 0.0, 1.0));
}
vec3 dreadGrade(vec3 c, float w) {
  if (w <= 0.0) return c;
  return mix(c, dreadRamp(dot(c, vec3(${LUMA.map(f).join(', ')})) * ${f(DREAD_DIM)}), clamp(w, 0.0, 1.0));
}
`;
})();

/**
 * The dread's weight on this client, 0..1. `set(ev, {live})` takes the hub's word (net/online.js onEvent: `{kind, at}`
 * or null); `tick(dtSeconds)` walks the weight toward it and answers it. A change the player watched (`live`) fades
 * over DREAD_FADE_S; one they did not (a welcome - they joined into it, or the relay came back without it) is whole.
 */
export function createDread() {
  let target = 0, weight = 0;
  return {
    set(ev, { live = false } = {}) {
      target = ev?.kind === DREAD_EVENT ? 1 : 0;
      if (!live) weight = target;
    },
    tick(dt) {
      const step = Math.max(0, dt || 0) / DREAD_FADE_S;
      weight = weight < target ? Math.min(target, weight + step) : Math.max(target, weight - step);
      return weight;
    },
    get weight() { return weight; },
    get on() { return target === 1; },
  };
}

// ── The red storm ──────────────────────────────────────────────────
/** The strike schedule's slot, ms of the shared clock - each slot may hold one strike. */
export const DREAD_SLOT_MS = 900;
/** The chance a slot holds a strike at full dread - one every ~3.2 s on average, scaled by the weight as it fades. */
export const DREAD_STRIKE_CHANCE = 0.28;
/** Where a strike lands from the player: metres, near and far. */
export const DREAD_NEAR_M = 400;
export const DREAD_FAR_M = 6000;
/** The share of strikes that reach the ground (a channel drawn); the rest light their cloud from inside. */
export const DREAD_CG_SHARE = 0.75;
/** The event's channel and the light a near strike throws: blood red, hot at the core. */
export const DREAD_BOLT_COLOR = Object.freeze([1.0, 0.16, 0.07]);
export const DREAD_FLASH_COLOR = Object.freeze([1.0, 0.22, 0.1]);
/** The most slots one frame walks - a tab asleep for an hour does not fire the hour's strikes on waking. */
export const DREAD_SLOTS_MAX = 8;

/** A slot's hash (a 32-bit mix of its index), the one seed its strike is read from - the same on every client. */
const slotHash = (slot) => { let h = Math.imul(slot | 0, 0x9e3779b1) ^ 0x7f4a7c15; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };

/**
 * The strikes of the slots in (fromMs, toMs] of the shared clock at weight `w`: `[{ atMs, seed, bearing, distance,
 * kind, strength }]`, bearing radians from +z toward +x, distance metres. A slot holds a strike when its seed's first
 * draw falls under DREAD_STRIKE_CHANCE x w, at a seeded moment inside it - so every client online reads the same
 * seconds. At most DREAD_SLOTS_MAX slots (the latest). Pure.
 */
export function dreadStrikes(fromMs, toMs, w) {
  const out = [];
  if (!(w > 0) || !(toMs > fromMs)) return out;
  const last = Math.floor(toMs / DREAD_SLOT_MS);
  const first = Math.max(Math.floor(fromMs / DREAD_SLOT_MS), last - DREAD_SLOTS_MAX + 1);
  for (let slot = first; slot <= last; slot++) {
    const seed = slotHash(slot);
    const r = seededRng(seed);
    if (r() >= DREAD_STRIKE_CHANCE * Math.min(1, w)) continue;
    const atMs = (slot + r()) * DREAD_SLOT_MS;
    if (atMs <= fromMs || atMs > toMs) continue;
    const near = r() < 0.35;
    const distance = near ? DREAD_NEAR_M + (1600 - DREAD_NEAR_M) * r() : 1600 + (DREAD_FAR_M - 1600) * r();
    out.push({ atMs, seed, bearing: r() * 2 * Math.PI, distance, kind: r() < DREAD_CG_SHARE ? 'cg' : 'ic', strength: 0.8 + 0.2 * r() });
  }
  return out;
}

/**
 * The red storm on this client. `tick({ sharedMs, eye, weight })` once an exterior frame (`sharedMs` the shared clock,
 * `eye` host metres): answers `{ strikes, sounds }` - the strikes fired since the last tick, placed around the eye in
 * host metres with the event's colour (`[{ x, z, seed, kind, strength, color }]`, for systems/lightning.js'
 * createStormLights `distant` list), and the thunder due now (`[{ clip, volume, x, z }]`, the strike's place). The
 * first tick fires nothing (no backlog on arrival); `reset()` forgets the place (a jump, a load).
 */
export function createDreadStorm() {
  let lastMs = null;
  const thunder = [];   // { dueMs, clip, volume, x, z }
  return {
    tick({ sharedMs, eye, weight }) {
      const strikes = [], sounds = [];
      if (lastMs !== null && sharedMs < lastMs) lastMs = null;   // the clock went back (a new offset): start again from now
      if (lastMs !== null) {
        for (const s of dreadStrikes(lastMs, sharedMs, weight)) {
          const x = eye[0] + Math.sin(s.bearing) * s.distance, z = eye[2] + Math.cos(s.bearing) * s.distance;
          strikes.push({ x, z, seed: s.seed, kind: s.kind, strength: s.strength, color: DREAD_BOLT_COLOR });
          const t = thunderOf(s.distance);
          if (t) thunder.push({ dueMs: s.atMs + t.delay * 1000, clip: t.clip, volume: t.volume, x, z });
        }
      }
      lastMs = sharedMs;
      for (let i = thunder.length - 1; i >= 0; i--) {
        if (thunder[i].dueMs > sharedMs) continue;
        const { clip, volume, x, z } = thunder[i];
        sounds.push({ clip, volume, x, z });
        thunder.splice(i, 1);
      }
      if (thunder.length > 32) thunder.splice(0, thunder.length - 32);
      return { strikes, sounds };
    },
    reset() { lastMs = null; thunder.length = 0; },
  };
}

/** The weather the SKY wears under the dread (the dome's row, the clouds' profile, Dynamic Skies' preset) - the
 *  storm's roiling dark deck, graded crimson. The sky alone: the sim's own weather, its rain, its wind and its sound
 *  go on as they were, and the sky walks back to them as the dread lifts. */
export const DREAD_SKY_WORD = 'thunder';

/** How much the dread takes off the sun's key light at full weight - the land is darker under the Deadlands' sky. */
export const DREAD_KEY_DIM = 0.45;
/** A light's colour (the key, the ambient - rgb, any array) under the dread: `dreadGrade` as the renderer takes a
 *  light, a fresh Float32Array. At 0 it is the colour as given. Pure. */
export const dreadLight = (rgb, w) => new Float32Array(dreadGrade(rgb, w));
/** How much of a burning red strike's brightness lights the whole cloud deck (the composite's flash) - the storm's
 *  sheet glow, under the channel's own. */
export const DREAD_CLOUD_GLOW = 0.5;
/** The deck's glow this frame from the burning strikes (systems/lightning.js bolts - the dread's by their colour). Pure. */
export function dreadCloudGlow(bolts) {
  let best = 0;
  for (const b of bolts ?? []) if (b.color === DREAD_BOLT_COLOR && b.bright > best) best = b.bright;
  return DREAD_CLOUD_GLOW * Math.min(1, best);
}
