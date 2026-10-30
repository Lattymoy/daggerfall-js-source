// @ts-check
// STOREFRONT (2026-10-29, the owner: "kill effects would be a brand new feature"; bible/06-Systems/Storefront.md section
// 4): THE KILL EFFECTS - what plays where a foe falls to a blow of a player who wears one. The simulation is plain JS (a
// burst is a recipe of particles, rings, sigils, rifts and pillars), the pass draws what it is handed in two layers: the
// solid and the dark (ash, shards, cogs, smoke, a rift's void) blended over the world, then the light added on top.
// Depth-tested and never written, fogged by the renderer's one fog block, as the impact sparks are
// (render/spellImpactFx.js). Each host's magic engine owns one (scenes/hostMagic.js). Not a DFU member.
import { FOG_GLSL } from './fogGlsl.js';
import { buildProgram } from './glProgram.js';

/** The looks, by their effect key (net/effectLaw.js KILL_EFFECTS). */
export const KILL_FX_LOOKS = Object.freeze(['ashen', 'voidrend', 'pyre', 'tonal']);
/** The shapes the pass draws: under `ring` they face the eye (a spark stretched along its flight); ring, sigil and disc
 *  lie on the ground; rift and beam stand up, turned to the eye about the world's up. */
export const KFX_SHAPE = Object.freeze({ glow: 0, spark: 1, shard: 2, flake: 3, cog: 4, smoke: 5, ring: 6, sigil: 7, disc: 8, rift: 9, beam: 10 });
/** Floats an instance: centre xyz, size, turn, shape, rgb, alpha, dir xyz (a spark's streak, a ground shape's normal, a
 *  standing shape's height in x), seed, progress, heat (how much of its core burns white). */
export const KFX_FLOATS = 16;
/** A layer's instances at most; the pass's buffer holds both layers, each in its own range. */
export const KFX_MAX_INSTANCES = 3000;
/** THE BUDGET (AUDIT STOREFRONT RENDER L8): each pool its own cap, so no kind of burst takes another's room - the kills;
 *  a portal's opening and a fissure's waking (`event`); a place's breath, a portal's, a fissure's vents, the tremor's
 *  dust (`place`); the horses' beats (`mount`). The 52 bursts the kills' 12 and a shared 40 were, split. A pool full,
 *  its oldest burst fades out over KFX_FADE_S. None begun past KFX_FAR_M from the eye; past KFX_DETAIL_M a burst
 *  throws half its particles. */
export const KFX_POOL_CAP = Object.freeze({ kill: 12, event: 8, place: 16, mount: 16 });
export const KFX_FADE_S = 0.25;
export const KFX_FAR_M = 45;
export const KFX_DETAIL_M = 18;
/** The ghost's burn: the standing body eaten in the look's colour this long (s), the corpse lying under it. */
export const KFX_GHOST_S = Object.freeze({ ashen: 0.95, voidrend: 0.7, pyre: 0.8, tonal: 0.6 });
/** The edge the standing body burns away in (systems/dissolve.js's colours' shape). */
export const KILL_FX_EDGE = Object.freeze({
  ashen: Object.freeze([1.0, 0.55, 0.2]), voidrend: Object.freeze([0.72, 0.42, 1.0]), pyre: Object.freeze([1.0, 0.32, 0.06]), tonal: Object.freeze([0.5, 0.85, 1.0]),
});
/** The light each look throws (colour x level), its reach (m) and how long it holds (s) - a portal's opening too. */
export const KFX_LIGHT = Object.freeze({
  'portal-runic-open': Object.freeze({ color: [0.6, 1.1, 1.8], range: 6, life: 0.6 }),
  'portal-daedric-open': Object.freeze({ color: [2.0, 0.55, 0.2], range: 8, life: 0.8 }),
  'portal-aetheric-open': Object.freeze({ color: [1.3, 0.9, 1.9], range: 8, life: 1.0 }),
  'portal-brass-open': Object.freeze({ color: [0.6, 1.3, 2.0], range: 7, life: 0.7 }),
  'fissure-wake': Object.freeze({ color: [0.6, 1.3, 2.0], range: 14, life: 1.2 }),   // STOREFRONT: a Brass Fissure's constructs climbing out
  ashen: Object.freeze({ color: [1.5, 0.75, 0.3], range: 5, life: 0.5 }),
  voidrend: Object.freeze({ color: [1.1, 0.55, 1.8], range: 7, life: 1.3 }),
  pyre: Object.freeze({ color: [2.2, 0.75, 0.2], range: 9, life: 1.6 }),
  tonal: Object.freeze({ color: [0.6, 1.2, 2.0], range: 7, life: 0.8 }),
});

const TAU = Math.PI * 2;
const UP = Object.freeze([0, 1, 0]);
const ease = (/** @type {number} */ u) => 1 - Math.pow(1 - u, 3);
const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ t) => a + (b - a) * t;

/** A particle as the recipes write it - every field the simulation reads, with its default.
 *  @typedef {{ p: number[], v: number[], age: number, life: number, s0: number, s1: number, rot: number, spin: number,
 *   shape: number, c0: number[], c1: number[], a0: number, a1: number, add: boolean, g: number, drag: number, gy: number,
 *   bounce: number, rest: boolean, streak: number, seed: number, heat: number, swirl: any, h0: number, h1: number,
 *   fadeIn: number, flutter: number, twin: any }} Part */

/** THE SIMULATION - every live burst's parts and lights: `start` begins one, `step` flies them, `build` writes this
 *  frame's instances, the blended layer first (`alpha`, `nAlpha`) and the added (`add`, `nAdd`). Floating-origin safe. */
export class KillFx {
  /** `reduced` whether the player asks for less motion now: a function read at each burst's start (the setting followed
   *  mid-session), or a fixed answer. */
  constructor({ rng = Math.random, reduced = /** @type {boolean | (() => boolean)} */ (false) } = {}) {
    this.rng = rng;
    this._reduced = typeof reduced === 'function' ? reduced : () => !!reduced;
    /** @type {{ parts: Part[], at: number[], look: string, age: number, pool: string, fade: number }[]} `fade` -1 live, else s into its fade */
    this.bursts = [];
    /** @type {{ at: number[], color: number[], range: number, life: number, age: number }[]} */
    this.lights = [];
    this.alpha = new Float32Array(KFX_MAX_INSTANCES * KFX_FLOATS);
    this.add = new Float32Array(KFX_MAX_INSTANCES * KFX_FLOATS);
    this.nAlpha = 0;
    this.nAdd = 0;
    this._dir = [0, 0, 0];   // build's scratch, and light's answer: a frame allocates nothing
    this._light = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true };
  }
  /** Fewer and softer flashes where the player asks for less motion. */
  get reduced() { return this._reduced(); }
  r(/** @type {number} */ a, /** @type {number} */ b) { return a + (b - a) * this.rng(); }
  get live() { return this.bursts.length > 0; }

  /**
   * BEGIN A BURST of `look` at a fallen body: `at` its feet (the scene's), `h` and `w` its height and width (m), `eye`
   * the camera (none: the detail of a near one). Answers the burst, or null (no such look, or too far to be seen). Its
   * pool is its recipe's (KFX_POOL_OF). `dir` the body's facing on the ground ([x, z]; a portal's, away from the eye),
   * `pace` its gait (0 standing, 1 walking, 2 running) and `mane` whether its head is seen - a mount look's beat reads them.
   * @param {string} look @param {number[]} at
   * @param {{ h?: number, w?: number, eye?: number[]|null, dir?: ReadonlyArray<number>|null, pace?: number, mane?: boolean }} [o]
   */
  start(look, at, { h = 1.8, w = 0.8, eye = null, dir = null, pace = 0, mane = true } = {}) {
    const recipe = RECIPES[/** @type {keyof typeof RECIPES} */ (look)];
    if (!recipe || !at || !at.every?.(Number.isFinite)) return null;
    const far = eye ? Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]) : 0;
    if (far > KFX_FAR_M) return null;
    const pool = KFX_POOL_OF[/** @type {keyof typeof KFX_POOL_OF} */ (look)], cap = KFX_POOL_CAP[pool];
    let mine = 0;
    for (const x of this.bursts) if (x.pool === pool && x.fade < 0) mine++;
    for (let k = 0; mine >= cap && k < this.bursts.length; k++) { const x = this.bursts[k]; if (x.pool === pool && x.fade < 0) { x.fade = 0; mine--; } }   // the oldest of its pool fades out
    const H = Math.max(0.4, Math.min(8, Number.isFinite(h) ? h : 1.8)), W = Math.max(0.3, Math.min(5, Number.isFinite(w) ? w : 0.8));
    const b = { parts: /** @type {Part[]} */ ([]), at: [at[0], at[1], at[2]], look, age: 0, pool, fade: -1 };
    const dl = dir && Number.isFinite(dir[0]) && Number.isFinite(dir[1]) ? Math.hypot(dir[0], dir[1]) : 0;
    const ctx = { fx: this, b, at: b.at, h: H, w: W, gy: at[1], n: (/** @type {number} */ k) => Math.max(1, Math.round(k * (far > KFX_DETAIL_M ? 0.5 : 1))),
      dir: dl > 1e-6 ? [/** @type {ReadonlyArray<number>} */ (dir)[0] / dl, /** @type {ReadonlyArray<number>} */ (dir)[1] / dl] : [0, 1], pace: pace | 0, mane: mane !== false };
    recipe(ctx);
    this.bursts.push(b);
    const L = KFX_LIGHT[/** @type {keyof typeof KFX_LIGHT} */ (look)];
    if (L) this.lights.push({ at: [at[0], at[1] + H * 0.55, at[2]], color: L.color.map((c) => c * (this.reduced ? 0.45 : 1)), range: L.range, life: L.life, age: 0 });
    return b;
  }

  /** A part with the defaults - the recipes' one door. */
  part(/** @type {{ parts: Part[] }} */ b, /** @type {Partial<Part>} */ o) {
    /** @type {Part} */
    const p = {
      p: [0, 0, 0], v: [0, 0, 0], age: 0, life: 1, s0: 0.1, s1: 0.1, rot: 0, spin: 0, shape: KFX_SHAPE.glow, c0: [1, 1, 1], c1: [1, 1, 1],
      a0: 1, a1: 0, add: true, g: 0, drag: 0, gy: -Infinity, bounce: 0, rest: false, streak: 0, seed: this.rng(), heat: 0, swirl: null,
      h0: 0, h1: 0, fadeIn: 0, flutter: 0, twin: null, ...o,
    };
    b.parts.push(p);
    return p;
  }

  step(/** @type {number} */ dt) {
    const d = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.05);
    if (!(d > 0)) return;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += d;
      if (b.fade >= 0 && (b.fade += d) >= KFX_FADE_S) { this.bursts.splice(i, 1); continue; }
      const P = b.parts;
      for (let j = P.length - 1; j >= 0; j--) {
        const p = P[j];
        p.age += d;
        if (p.age < 0) continue;
        if (p.age >= p.life) { P.splice(j, 1); continue; }
        p.rot += p.spin * d;
        if (p.rest) continue;
        if (p.swirl) {
          // drawn round and in toward the rift's heart: the radius shrinks, the turn quickens
          const s = p.swirl, dx = p.p[0] - s.c[0], dy = p.p[1] - s.c[1], dz = p.p[2] - s.c[2];
          const rr = Math.hypot(dx, dz), ang = Math.atan2(dz, dx) + s.w * d * (1 + 1 / Math.max(0.15, rr));
          const nr = rr * Math.exp(-s.pull * d);
          p.p[0] = s.c[0] + Math.cos(ang) * nr; p.p[2] = s.c[2] + Math.sin(ang) * nr; p.p[1] = s.c[1] + dy * Math.exp(-s.pull * d * 0.8);
          continue;
        }
        const k = Math.exp(-p.drag * d);
        p.v[0] *= k; p.v[1] *= k; p.v[2] *= k;
        p.v[1] -= p.g * d;
        if (p.flutter) { const q = p.age * 5 + p.seed * 9; p.v[0] += Math.sin(q) * p.flutter * d; p.v[2] += Math.cos(q * 1.3) * p.flutter * d; }
        p.p[0] += p.v[0] * d; p.p[1] += p.v[1] * d; p.p[2] += p.v[2] * d;
        if (p.p[1] <= p.gy && p.v[1] < 0) {
          p.p[1] = p.gy;
          if (p.bounce > 0) { p.v[1] = -p.v[1] * p.bounce; p.v[0] *= 0.55; p.v[2] *= 0.55; p.spin *= 0.6; p.bounce *= 0.45; if (Math.abs(p.v[1]) < 0.4) p.bounce = 0; }
          else { p.rest = true; p.v[0] = p.v[1] = p.v[2] = 0; p.spin = 0; }
        }
      }
      if (!P.length) this.bursts.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) { const l = this.lights[i]; l.age += d; if (l.age >= l.life) this.lights.splice(i, 1); }
  }

  /** The floating origin moved: everything moves with it. */
  shift(/** @type {number[]} */ o) {
    if (!o) return;
    const mv = (/** @type {number[]} */ p) => { p[0] += o[0]; p[1] += o[1]; p[2] += o[2]; };
    for (const b of this.bursts) {
      mv(b.at);
      for (const p of b.parts) { mv(p.p); if (Number.isFinite(p.gy)) p.gy += o[1]; if (p.swirl) mv(p.swirl.c); }
    }
    for (const l of this.lights) mv(l.at);
  }

  clear() { this.bursts.length = 0; this.lights.length = 0; this.nAlpha = 0; this.nAdd = 0; }

  /** The brightest light the live bursts throw this frame, in nearestLights' shape (one record, rewritten), or null. */
  light() {
    let best = null, bestR = 0, bestK = 0;
    for (const l of this.lights) {
      const u = l.age / l.life, k = Math.pow(1 - u, 1.6) * Math.min(1, l.age / 0.04 + 0.3);
      if (k * l.range > bestR) { bestR = k * l.range; best = l; bestK = k; }
    }
    if (!best) return null;
    const o = this._light, k = bestK;
    o.x = best.at[0]; o.y = best.at[1]; o.z = best.at[2]; o.range = best.range * (0.5 + 0.5 * k);
    o.color[0] = best.color[0] * k; o.color[1] = best.color[1] * k; o.color[2] = best.color[2] * k;
    return o;
  }

  /** This frame's instances into `alpha` and `add`; answers how many in all. */
  build() {
    this.nAlpha = 0; this.nAdd = 0;
    const dir = this._dir;
    for (const b of this.bursts) {
      const out = b.fade >= 0 ? 1 - b.fade / KFX_FADE_S : 1;   // a burst its pool let go, fading
      for (const p of b.parts) {
        if (p.age < 0) continue;
        const u = Math.min(1, p.age / p.life);
        let a = lerp(p.a0, p.a1, u) * (1 - smoothstep(0.78, 1, u)) * out;
        if (p.fadeIn > 0) a *= Math.min(1, p.age / p.fadeIn);
        const s = lerp(p.s0, p.s1, ease(u));
        if (p.shape === KFX_SHAPE.spark && !p.rest && p.streak > 0) { dir[0] = p.v[0] * p.streak; dir[1] = p.v[1] * p.streak; dir[2] = p.v[2] * p.streak; }
        else if (p.shape === KFX_SHAPE.ring || p.shape === KFX_SHAPE.sigil || p.shape === KFX_SHAPE.disc) { dir[0] = UP[0]; dir[1] = UP[1]; dir[2] = UP[2]; }
        else if (p.shape === KFX_SHAPE.rift || p.shape === KFX_SHAPE.beam) { dir[0] = lerp(p.h0, p.h1, ease(u)); dir[1] = 0; dir[2] = 0; }
        else { dir[0] = dir[1] = dir[2] = 0; }
        // the part, then its twin in the other layer (a rift's rim beside its void) - written here, never through a call:
        // a call the engine does not inline boxes every number handed to it, and this loop runs a part a frame
        for (let k = 0; k < (p.twin ? 2 : 1); k++) {
          const tw = k ? p.twin : null, add = tw ? !p.add : p.add, A = tw ? a * tw.a : a, S = tw ? s * tw.s : s;
          const n = add ? this.nAdd : this.nAlpha;
          if (!(A > 0.003) || !(S > 0) || n >= KFX_MAX_INSTANCES) continue;
          const B = add ? this.add : this.alpha, o = n * KFX_FLOATS, at = p.p, c0 = tw ? tw.c : p.c0, c1 = tw ? tw.c : p.c1;
          B[o] = at[0]; B[o + 1] = at[1]; B[o + 2] = at[2]; B[o + 3] = S; B[o + 4] = p.rot; B[o + 5] = p.shape;
          B[o + 6] = lerp(c0[0], c1[0], u); B[o + 7] = lerp(c0[1], c1[1], u); B[o + 8] = lerp(c0[2], c1[2], u); B[o + 9] = A;
          B[o + 10] = dir[0]; B[o + 11] = dir[1]; B[o + 12] = dir[2]; B[o + 13] = tw ? p.seed + 0.5 : p.seed; B[o + 14] = u; B[o + 15] = tw ? tw.heat ?? 0 : p.heat;
          if (add) this.nAdd++; else this.nAlpha++;
        }
      }
    }
    return this.nAlpha + this.nAdd;
  }
}
const smoothstep = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** A direction out from the body's axis at a random bearing, `up` its rise. */
const outward = (/** @type {KillFx} */ fx, /** @type {number} */ speed, /** @type {number} */ up) => { const a = fx.r(0, TAU); return [Math.cos(a) * speed, up, Math.sin(a) * speed]; };
/** A burst's own axes (AUDIT STOREFRONT RENDER L2): `x` across a portal (along a fissure's crack), `y` up, `z` through
 *  it, turned by its facing `c.dir` - so a rim or a foot is round the portal as it is seen, never on world X. `turned` a
 *  velocity; `onAxes` a point off its feet. With no facing given ([0, 1]) across is world X. */
const turned = (/** @type {any} */ c, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => [c.dir[1] * x + c.dir[0] * z, y, c.dir[1] * z - c.dir[0] * x];
const onAxes = (/** @type {any} */ c, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => [c.at[0] + c.dir[1] * x + c.dir[0] * z, y, c.at[2] + c.dir[1] * z - c.dir[0] * x];

/** THE RECIPES: each writes its parts into the burst. `n(k)` a count at this burst's detail. */
/** A mount look's struck hoof: one of the four, fore or hind, either side, on the ground under it. */
const hoof = (/** @type {any} */ c) => {
  const fore = (c.fx.rng() < 0.5 ? 0.36 : -0.34) * c.w, lat = (c.fx.rng() < 0.5 ? -1 : 1) * 0.12;
  return [c.at[0] + c.dir[0] * fore + c.dir[1] * lat, c.gy + 0.05, c.at[2] + c.dir[1] * fore - c.dir[0] * lat];
};
/** A mount look's mane, `n` tongues of `c0` light going to `c1` along the neck's crest. */
function maneFire(/** @type {any} */ c, /** @type {number[]} */ c0, /** @type {number[]} */ c1, /** @type {number} */ n) {
  const { fx, b, at, h, w, dir } = c;
  for (let i = 0; i < n; i++) {
    const back = fx.r(0.12, 0.42) * w;
    fx.part(b, { p: [at[0] + dir[0] * (w * 0.4 - back) + fx.r(-0.05, 0.05), at[1] + h * (0.92 - 0.25 * back / w) + fx.r(-0.04, 0.06), at[2] + dir[1] * (w * 0.4 - back) + fx.r(-0.05, 0.05)],
      v: [-dir[0] * 0.25 * c.pace + fx.r(-0.08, 0.08), fx.r(0.4, 0.9), -dir[1] * 0.25 * c.pace + fx.r(-0.08, 0.08)], life: fx.r(0.22, 0.4), s0: 0.07, s1: 0.02, c0, c1, a0: 0.85, a1: 0, heat: 0.8, flutter: 1 });
  }
}

const RECIPES = Object.freeze({
  /** ASHEN SHATTER: the body crumbles from the feet up to ash; bone shards burst and fall; grey dust rolls out. */
  ashen(/** @type {any} */ { fx, b, at, h, w, gy, n }) {
    const mid = [at[0], at[1] + h * 0.55, at[2]], ghost = KFX_GHOST_S.ashen;
    fx.part(b, { p: [...mid], life: 0.3, s0: w * 0.6, s1: w * 1.2, c0: [1, 0.86, 0.6], c1: [1, 0.5, 0.2], a0: fx.reduced ? 0.4 : 0.9, heat: 1 });
    for (let i = 0, N = n(70); i < N; i++) {   // ash flakes off the burning front, rising and drifting down
      const t = (i / N) * ghost, y = at[1] + h * (t / ghost) * fx.r(0.85, 1.05);
      const v = outward(fx, fx.r(0.2, 0.9), fx.r(0.4, 1.4));
      const grey = fx.r(0.4, 0.62);
      fx.part(b, { p: [at[0] + fx.r(-0.5, 0.5) * w, y, at[2] + fx.r(-0.5, 0.5) * w], v, age: -t, life: fx.r(1.4, 2.4), s0: fx.r(0.02, 0.045), s1: 0.02, shape: KFX_SHAPE.flake,
        c0: [grey, grey * 0.97, grey * 0.93], c1: [grey * 0.45, grey * 0.43, grey * 0.4], a0: 0.95, a1: 0.6, add: false, g: 0.6, drag: 1.6, gy, flutter: 2.2, spin: fx.r(-6, 6), rot: fx.r(0, TAU) });
    }
    for (let i = 0, N = n(16); i < N; i++) {   // bone shards thrown out, bouncing once and lying
      const v = outward(fx, fx.r(1.2, 3.2), fx.r(1.5, 4));
      fx.part(b, { p: [at[0], at[1] + h * fx.r(0.3, 0.8), at[2]], v, age: -fx.r(0, 0.25), life: fx.r(1.8, 2.6), s0: fx.r(0.05, 0.1), s1: fx.r(0.04, 0.08), shape: KFX_SHAPE.shard,
        c0: [0.94, 0.9, 0.82], c1: [0.6, 0.56, 0.5], a0: 1, a1: 0.85, add: false, g: 9.8, drag: 0.4, gy, bounce: 0.35, spin: fx.r(-14, 14), rot: fx.r(0, TAU) });
    }
    for (let i = 0, N = n(24); i < N; i++) {   // embers lifting off the front
      const t = fx.r(0, ghost);
      fx.part(b, { p: [at[0] + fx.r(-0.4, 0.4) * w, at[1] + h * (t / ghost), at[2] + fx.r(-0.4, 0.4) * w], v: outward(fx, fx.r(0.1, 0.5), fx.r(0.8, 1.8)), age: -t, life: fx.r(0.7, 1.3),
        s0: fx.r(0.012, 0.022), s1: 0.006, shape: KFX_SHAPE.spark, c0: [1, 0.8, 0.45], c1: [0.8, 0.2, 0.03], a0: 1, a1: 0.4, g: -0.3, drag: 1.2, streak: 0.05, flutter: 1.5, heat: 0.8 });
    }
    for (let i = 0, N = n(12); i < N; i++) {   // the dust rolling out over the ground in a ring
      const a = (i / N) * TAU + fx.r(-0.2, 0.2), sp = fx.r(0.9, 1.6);
      fx.part(b, { p: [at[0] + Math.cos(a) * w * 0.3, gy + 0.15, at[2] + Math.sin(a) * w * 0.3], v: [Math.cos(a) * sp, 0.15, Math.sin(a) * sp], age: -fx.r(0.05, 0.35), life: fx.r(1.5, 2.2),
        s0: w * 0.35, s1: w * 0.9, shape: KFX_SHAPE.smoke, c0: [0.55, 0.53, 0.5], c1: [0.42, 0.4, 0.38], a0: 0.5, a1: 0.0, add: false, drag: 1.8, fadeIn: 0.15, rot: fx.r(0, TAU), spin: fx.r(-0.5, 0.5) });
    }
    fx.part(b, { p: [at[0], gy + 0.02, at[2]], life: 0.6, s0: w * 0.4, s1: w * 2.6, shape: KFX_SHAPE.ring, c0: [1, 0.7, 0.4], c1: [0.6, 0.35, 0.2], a0: fx.reduced ? 0.25 : 0.55 });
  },

  /** VOIDREND: a rift tears open in the chest; the body's shards spiral into it; it snaps shut in a ring of violet light. */
  voidrend(/** @type {any} */ { fx, b, at, h, w, gy, n }) {
    const mid = [at[0], at[1] + h * 0.58, at[2]], shut = 0.95;
    fx.part(b, { p: [...mid], life: shut + 0.05, s0: w * 0.08, s1: w * 0.34, shape: KFX_SHAPE.rift, h0: h * 0.15, h1: h * 0.95, c0: [0.03, 0.0, 0.07], c1: [0.02, 0.0, 0.05], a0: 0.95, a1: 0.95, add: false, fadeIn: 0.12,
      twin: { s: 1.25, c: [0.78, 0.48, 1.0], a: fx.reduced ? 0.5 : 1, heat: 0.6 } });
    for (let i = 0, N = n(30); i < N; i++) {   // the body's shards, drawn round and into the rift
      const a = fx.r(0, TAU), r = w * fx.r(0.25, 0.75), y = at[1] + h * fx.r(0.1, 1.0);
      fx.part(b, { p: [mid[0] + Math.cos(a) * r, y, mid[2] + Math.sin(a) * r], age: -fx.r(0.05, 0.4), life: fx.r(0.55, 0.85), s0: fx.r(0.06, 0.12), s1: 0.01, shape: KFX_SHAPE.shard,
        c0: [0.28, 0.1, 0.45], c1: [0.1, 0.02, 0.2], a0: 1, a1: 0.9, add: false, spin: fx.r(-10, 10), rot: fx.r(0, TAU), swirl: { c: [...mid], w: fx.r(3, 5), pull: fx.r(2.4, 3.6) } });
    }
    for (let i = 0, N = n(36); i < N; i++) {   // motes streaking in before it shuts
      const a = fx.r(0, TAU), r = w * fx.r(0.8, 1.6);
      fx.part(b, { p: [mid[0] + Math.cos(a) * r, mid[1] + fx.r(-0.5, 0.5) * h, mid[2] + Math.sin(a) * r], age: -fx.r(0, 0.6), life: fx.r(0.3, 0.5), s0: 0.018, s1: 0.006, shape: KFX_SHAPE.glow,
        c0: [0.85, 0.65, 1.0], c1: [0.5, 0.2, 0.9], a0: 1, a1: 0.6, swirl: { c: [...mid], w: 6, pull: 5 }, heat: 0.5 });
    }
    fx.part(b, { p: [...mid], age: -shut, life: 0.35, s0: w * 0.3, s1: w * 1.6, c0: [0.95, 0.85, 1.0], c1: [0.6, 0.3, 1.0], a0: fx.reduced ? 0.35 : 1, heat: 1 });   // the snap
    for (let i = 0, N = n(44); i < N; i++) {   // the burst of violet light it shuts in
      fx.part(b, { p: [...mid], v: outward(fx, fx.r(1.5, 4.5), fx.r(-1.5, 2.5)), age: -shut, life: fx.r(0.5, 1.0), s0: fx.r(0.015, 0.03), s1: 0.005, shape: KFX_SHAPE.spark,
        c0: [0.9, 0.75, 1.0], c1: [0.45, 0.15, 0.85], a0: 1, a1: 0.3, drag: 2.5, streak: 0.06, heat: 0.7 });
    }
    fx.part(b, { p: [at[0], gy + 0.02, at[2]], age: -shut, life: 0.7, s0: w * 0.5, s1: w * 3.4, shape: KFX_SHAPE.ring, c0: [0.85, 0.6, 1.0], c1: [0.4, 0.15, 0.8], a0: fx.reduced ? 0.3 : 0.8 });
    fx.part(b, { p: [at[0], gy + 0.015, at[2]], life: 2.6, s0: w * 0.6, s1: w * 1.0, shape: KFX_SHAPE.disc, c0: [0.07, 0.0, 0.13], c1: [0.05, 0.0, 0.09], a0: 0.65, a1: 0.4, add: false, fadeIn: 0.3 });   // the stain
  },

  /** DAEDRIC PYRE: a Daedric sigil burns into the ground; a pillar of crimson fire takes the body; embers storm upward. */
  pyre(/** @type {any} */ { fx, b, at, h, w, gy, n }) {
    const r = Math.max(0.8, w * 1.25);
    fx.part(b, { p: [at[0], gy + 0.025, at[2]], life: 2.4, s0: r * 0.2, s1: r, shape: KFX_SHAPE.sigil, c0: [1.0, 0.36, 0.08], c1: [0.7, 0.08, 0.02], a0: 1, a1: 0.7, spin: 0.35, fadeIn: 0.08, heat: 0.3 });
    fx.part(b, { p: [at[0], gy + 0.02, at[2]], age: -0.5, life: 3.0, s0: r, s1: r, shape: KFX_SHAPE.sigil, c0: [0.06, 0.02, 0.02], c1: [0.04, 0.02, 0.02], a0: 0.7, a1: 0.4, add: false, spin: 0.35, rot: 0.175, fadeIn: 0.6 });   // the scorch it leaves
    fx.part(b, { p: [at[0], gy, at[2]], age: -0.12, life: 1.25, s0: w * 0.35, s1: w * 0.6, shape: KFX_SHAPE.beam, h0: h * 0.5, h1: h * 2.4, c0: [1.0, 0.55, 0.18], c1: [0.85, 0.12, 0.03], a0: fx.reduced ? 0.55 : 1, a1: 0.4, fadeIn: 0.12, heat: 0.7 });
    for (let i = 0, N = n(32); i < N; i++) {   // tongues of flame licking up the body
      fx.part(b, { p: [at[0] + fx.r(-0.4, 0.4) * w, gy + fx.r(0, 0.4) * h, at[2] + fx.r(-0.4, 0.4) * w], v: [fx.r(-0.3, 0.3), fx.r(2, 4), fx.r(-0.3, 0.3)], age: -fx.r(0.05, 0.9), life: fx.r(0.45, 0.8),
        s0: w * fx.r(0.18, 0.3), s1: w * 0.05, c0: [1.0, 0.65, 0.22], c1: [0.7, 0.08, 0.02], a0: 0.9, a1: 0.2, drag: 1.2, flutter: 3, heat: 0.4 });
    }
    for (let i = 0, N = n(64); i < N; i++) {   // the ember storm, spiralling up
      const a = fx.r(0, TAU), rr = w * fx.r(0.3, 1.1), up = fx.r(2.5, 6);
      fx.part(b, { p: [at[0] + Math.cos(a) * rr, gy + fx.r(0, 0.6) * h, at[2] + Math.sin(a) * rr], v: [-Math.sin(a) * 2.2 + Math.cos(a) * 0.6, up, Math.cos(a) * 2.2 + Math.sin(a) * 0.6], age: -fx.r(0.1, 1.2), life: fx.r(0.8, 1.6),
        s0: fx.r(0.014, 0.026), s1: 0.005, shape: KFX_SHAPE.spark, c0: [1.0, 0.82, 0.4], c1: [0.85, 0.15, 0.02], a0: 1, a1: 0.3, drag: 0.9, g: -0.5, streak: 0.045, flutter: 2, heat: 0.8 });
    }
    for (let i = 0, N = n(14); i < N; i++) {   // the black smoke rising off it
      fx.part(b, { p: [at[0] + fx.r(-0.3, 0.3) * w, gy + h * fx.r(0.4, 1.1), at[2] + fx.r(-0.3, 0.3) * w], v: [fx.r(-0.25, 0.25), fx.r(0.8, 1.5), fx.r(-0.25, 0.25)], age: -fx.r(0.4, 1.3), life: fx.r(1.8, 2.8),
        s0: w * 0.35, s1: w * 1.3, shape: KFX_SHAPE.smoke, c0: [0.1, 0.05, 0.04], c1: [0.06, 0.05, 0.05], a0: 0.6, a1: 0, add: false, drag: 0.6, fadeIn: 0.25, rot: fx.r(0, TAU), spin: fx.r(-0.4, 0.4) });
    }
    fx.part(b, { p: [at[0], gy + 0.03, at[2]], age: -0.1, life: 0.55, s0: r * 0.6, s1: r * 3, shape: KFX_SHAPE.ring, c0: [1.0, 0.5, 0.18], c1: [0.7, 0.1, 0.03], a0: fx.reduced ? 0.3 : 0.9 });
  },

  // ═══ THE MOUNT LOOKS' BEATS (systems/horse/mountFx.js): `at` the horse's hooves' ground, `dir` its facing, `h` its
  //     height, `w` its length, `pace` its gait, `mane` whether its head is seen (not from its own saddle) ═══
  /** DAEDRIC WARHORSE: smoke and embers off a striking hoof, its mane burning. */
  'mount-warhorse'(/** @type {any} */ c) {
    const { fx, b } = c;
    if (c.pace) for (let k = 0; k < 2; k++) {
      const p = hoof(c), side = fx.rng() < 0.5 ? -1 : 1;
      fx.part(b, { p, v: [fx.r(-0.15, 0.15), fx.r(0.3, 0.7), fx.r(-0.15, 0.15)], life: fx.r(0.9, 1.4), s0: 0.08, s1: 0.34, shape: KFX_SHAPE.smoke, c0: [0.12, 0.1, 0.1], c1: [0.22, 0.2, 0.2], a0: 0.42, a1: 0, add: false, drag: 1, rot: fx.r(0, TAU), spin: side * fx.r(0.3, 0.8) });
      for (let i = 0; i < 2; i++) fx.part(b, { p: [...p], v: [fx.r(-0.4, 0.4), fx.r(0.6, 1.4), fx.r(-0.4, 0.4)], life: fx.r(0.5, 0.9), s0: 0.014, s1: 0.004, shape: KFX_SHAPE.spark, c0: [1, 0.7, 0.3], c1: [0.8, 0.1, 0.02], a0: 1, a1: 0.2, drag: 1, streak: 0.04, heat: 0.8 });
    }
    if (c.mane) maneFire(c, [1, 0.55, 0.15], [0.9, 0.1, 0.02], 3);
  },
  /** SPECTRAL STEED: a glowing print where a hoof falls, light wisping off its body, its mane flowing light. */
  'mount-spectral'(/** @type {any} */ c) {
    const { fx, b, at, h, w, dir } = c;
    if (c.pace) { const p = hoof(c); fx.part(b, { p: [p[0], c.gy + 0.012, p[2]], life: 2.4, s0: 0.12, s1: 0.1, shape: KFX_SHAPE.disc, c0: [0.55, 0.85, 1.0], c1: [0.2, 0.45, 1.0], a0: 0.7, a1: 0, fadeIn: 0.05, heat: 0.3 }); }
    for (let i = 0, N = c.pace ? 3 : 1; i < N; i++) {
      const along = fx.r(-0.45, 0.4) * w;
      fx.part(b, { p: [at[0] + dir[0] * along + fx.r(-0.12, 0.12), at[1] + h * fx.r(0.45, 0.8), at[2] + dir[1] * along + fx.r(-0.12, 0.12)], v: [-dir[0] * fx.r(0.3, 0.8) * c.pace, fx.r(0.05, 0.3), -dir[1] * fx.r(0.3, 0.8) * c.pace],
        life: fx.r(0.8, 1.3), s0: 0.09, s1: 0.03, c0: [0.75, 0.92, 1.0], c1: [0.3, 0.55, 1.0], a0: 0.55, a1: 0, flutter: 1.2, fadeIn: 0.1, heat: 0.4 });
    }
    if (c.mane) maneFire(c, [0.8, 0.95, 1.0], [0.3, 0.55, 1.0], 2);
  },
  /** DAWNFIRE CHARGER: a burning print where a hoof falls and its flame, sun motes about it, its mane golden fire. */
  'mount-dawnfire'(/** @type {any} */ c) {
    const { fx, b, at, h, w } = c;
    if (c.pace) {
      const p = hoof(c);
      fx.part(b, { p: [p[0], c.gy + 0.012, p[2]], life: 2.0, s0: 0.13, s1: 0.11, shape: KFX_SHAPE.disc, c0: [1.0, 0.6, 0.15], c1: [0.25, 0.08, 0.02], a0: 0.85, a1: 0, heat: 0.6 });
      for (let i = 0; i < 2; i++) fx.part(b, { p: [...p], v: [fx.r(-0.1, 0.1), fx.r(0.6, 1.2), fx.r(-0.1, 0.1)], life: fx.r(0.25, 0.45), s0: 0.06, s1: 0.015, c0: [1, 0.8, 0.35], c1: [1, 0.3, 0.05], a0: 0.9, a1: 0, heat: 0.9, flutter: 1 });
    }
    for (let i = 0; i < 2; i++) {
      const a = fx.r(0, TAU), r = fx.r(0.3, 0.6) * w;
      fx.part(b, { p: [at[0] + Math.cos(a) * r, at[1] + h * fx.r(0.2, 0.9), at[2] + Math.sin(a) * r], v: [0, fx.r(0.15, 0.4), 0], life: fx.r(1.0, 1.6), s0: 0.018, s1: 0.006, c0: [1, 0.95, 0.6], c1: [1, 0.7, 0.2], a0: 0.95, a1: 0, flutter: 0.6, heat: 0.7 });
    }
    if (c.mane) maneFire(c, [1, 0.88, 0.45], [1, 0.45, 0.08], 3);
  },
  /** BRASS AUTOMATON: sparks off a striking hoof, a breath of steam from its chest, its aetherium core flickering. */
  'mount-automaton'(/** @type {any} */ c) {
    const { fx, b, at, h, w, dir } = c;
    if (c.pace) { const p = hoof(c); for (let i = 0; i < 4; i++) fx.part(b, { p: [...p], v: [fx.r(-1.2, 1.2), fx.r(0.6, 1.6), fx.r(-1.2, 1.2)], life: fx.r(0.2, 0.45), s0: 0.012, s1: 0.004, shape: KFX_SHAPE.spark, c0: [1, 0.9, 0.55], c1: [1, 0.6, 0.2], a0: 1, a1: 0.2, g: 6, drag: 1.5, streak: 0.035, heat: 0.8 }); }
    const chest = [at[0] + dir[0] * w * 0.36, at[1] + h * 0.55, at[2] + dir[1] * w * 0.36];
    if (fx.rng() < (c.pace ? 0.45 : 0.25)) fx.part(b, { p: chest, v: [dir[0] * 0.3 + fx.r(-0.1, 0.1), fx.r(0.35, 0.6), dir[1] * 0.3 + fx.r(-0.1, 0.1)], life: fx.r(1.0, 1.5), s0: 0.08, s1: 0.32, shape: KFX_SHAPE.smoke, c0: [0.92, 0.94, 0.96], c1: [0.8, 0.84, 0.88], a0: 0.32, a1: 0, add: false, drag: 0.9, fadeIn: 0.1, rot: fx.r(0, TAU), spin: fx.r(-0.5, 0.5) });
    fx.part(b, { p: [chest[0], chest[1] - 0.06, chest[2]], life: 0.35, s0: 0.05, s1: 0.04, c0: [0.5, 0.85, 1.0], c1: [0.3, 0.6, 1.0], a0: 0.7, a1: 0, heat: 0.8 });
  },

  // ═══ THE PORTAL SKINS' BURSTS (scenes/portalSkins.js): `h` the portal's height, `w` its width, `dir` its facing - every
  //     point and flight on its own axes (onAxes, turned) ═══
  /** RUNIC STONE opening: frost glints thrown off the rim, a cold ring on the ground. */
  'portal-runic-open'(/** @type {any} */ c) {
    const { fx, b, at, h, w, gy, n } = c;
    for (let i = 0, N = n(28); i < N; i++) {
      const a = fx.r(0, TAU);
      fx.part(b, { p: onAxes(c, Math.cos(a) * w * 0.5, at[1] + h * (0.5 + Math.sin(a) * 0.48), Math.sin(a) * w * 0.15), v: turned(c, Math.cos(a) * fx.r(0.4, 1.4), fx.r(-0.2, 0.8), fx.r(-0.4, 0.4)), life: fx.r(0.5, 0.9),
        s0: 0.02, s1: 0.006, shape: KFX_SHAPE.spark, c0: [0.85, 0.97, 1.0], c1: [0.3, 0.7, 1.0], a0: 1, a1: 0.3, drag: 1.5, streak: 0.04, heat: 0.7 });
    }
    fx.part(b, { p: [at[0], gy + 0.03, at[2]], life: 0.6, s0: w * 0.3, s1: w * 1.6, shape: KFX_SHAPE.ring, c0: [0.7, 0.92, 1.0], c1: [0.3, 0.6, 1.0], a0: fx.reduced ? 0.25 : 0.6 });
  },
  /** DAEDRIC STONE opening: the arch tears up through the ground in a burst of crimson, embers flung up. */
  'portal-daedric-open'(/** @type {any} */ c) {
    const { fx, b, at, h, w, gy, n } = c;
    fx.part(b, { p: [at[0], at[1] + h * 0.5, at[2]], life: 0.3, s0: w * 0.5, s1: w * 1.4, c0: [1, 0.6, 0.3], c1: [1, 0.2, 0.05], a0: fx.reduced ? 0.35 : 0.9, heat: 1 });
    fx.part(b, { p: [at[0], gy + 0.025, at[2]], life: 1.2, s0: w * 0.5, s1: w * 0.9, shape: KFX_SHAPE.sigil, c0: [1.0, 0.35, 0.08], c1: [0.6, 0.06, 0.02], a0: 0.9, a1: 0.3, spin: 0.6, heat: 0.2 });
    for (let i = 0, N = n(40); i < N; i++) {
      fx.part(b, { p: onAxes(c, fx.r(-0.6, 0.6) * w, gy + 0.05, fx.r(-0.3, 0.3) * w), v: turned(c, fx.r(-0.6, 0.6), fx.r(2.5, 5.5), fx.r(-0.6, 0.6)), life: fx.r(0.6, 1.2), s0: fx.r(0.014, 0.024), s1: 0.005, shape: KFX_SHAPE.spark,
        c0: [1, 0.8, 0.4], c1: [0.8, 0.12, 0.02], a0: 1, a1: 0.3, drag: 1.0, g: 1.5, streak: 0.05, heat: 0.8 });
    }
    for (let i = 0, N = n(8); i < N; i++) {   // the ground broken where the iron came up
      fx.part(b, { p: onAxes(c, fx.r(-0.7, 0.7) * w, gy + 0.05, fx.r(-0.35, 0.35) * w), v: turned(c, fx.r(-1.5, 1.5), fx.r(1.5, 3.5), fx.r(-1.5, 1.5)), life: fx.r(1.0, 1.6), s0: fx.r(0.04, 0.08), s1: 0.05,
        shape: KFX_SHAPE.shard, c0: [0.22, 0.16, 0.15], c1: [0.14, 0.1, 0.1], a0: 1, a1: 0.8, add: false, g: 9.8, gy, bounce: 0.3, spin: fx.r(-12, 12), rot: fx.r(0, TAU) });
    }
    fx.part(b, { p: [at[0], gy + 0.03, at[2]], life: 0.55, s0: w * 0.4, s1: w * 2.2, shape: KFX_SHAPE.ring, c0: [1.0, 0.45, 0.15], c1: [0.6, 0.08, 0.02], a0: fx.reduced ? 0.3 : 0.85 });
  },
  /** DAEDRIC STONE standing: embers rising off the arch's foot. */
  'portal-daedric-embers'(/** @type {any} */ c) {
    const { fx, b, h, w, gy } = c;
    for (let i = 0; i < 3; i++) {
      const side = fx.rng() < 0.5 ? -1 : 1;
      fx.part(b, { p: onAxes(c, side * w * fx.r(0.55, 0.75), gy + fx.r(0, 0.4) * h, fx.r(-0.1, 0.1)), v: turned(c, fx.r(-0.2, 0.2), fx.r(0.7, 1.6), fx.r(-0.2, 0.2)), life: fx.r(0.9, 1.6),
        s0: fx.r(0.012, 0.02), s1: 0.004, shape: KFX_SHAPE.spark, c0: [1, 0.75, 0.35], c1: [0.8, 0.12, 0.02], a0: 0.9, a1: 0.2, drag: 0.6, flutter: 1.5, streak: 0.04, heat: 0.6 });
    }
  },
  /** AETHERIC STONE opening: motes spiralling up off the ground as the crystals gather, then a flash as the ring closes. */
  'portal-aetheric-open'(/** @type {any} */ c) {
    const { fx, b, at, h, w, gy, n } = c;
    const mid = [at[0], at[1] + h * 0.5, at[2]];
    for (let i = 0, N = n(48); i < N; i++) {
      const a = fx.r(0, TAU), r = fx.r(0.6, 1.3);
      fx.part(b, { p: onAxes(c, Math.cos(a) * r, gy + 0.05, Math.sin(a) * r), age: -fx.r(0, 0.5), life: fx.r(0.7, 1.0), s0: 0.018, s1: 0.006, c0: [0.9, 0.85, 1.0], c1: [0.55, 0.35, 1.0], a0: 1, a1: 0.5, heat: 0.6,
        swirl: { c: [mid[0], mid[1], mid[2]], w: fx.r(2.5, 4), pull: 1.6 } });
    }
    fx.part(b, { p: [...mid], age: -0.38, life: 0.4, s0: w * 0.4, s1: w * 1.5, c0: [1, 0.95, 1], c1: [0.7, 0.5, 1], a0: fx.reduced ? 0.35 : 1, heat: 1 });
    fx.part(b, { p: [at[0], gy + 0.03, at[2]], age: -0.38, life: 0.7, s0: w * 0.4, s1: w * 2.6, shape: KFX_SHAPE.ring, c0: [0.95, 0.75, 1.0], c1: [0.4, 0.6, 1.0], a0: fx.reduced ? 0.3 : 0.8 });
  },
  /** AETHERIC STONE standing: a few motes drifting off the ring. */
  'portal-aetheric-motes'(/** @type {any} */ c) {
    const { fx, b, at, h } = c;
    for (let i = 0; i < 3; i++) {
      const a = fx.r(0, TAU);
      fx.part(b, { p: onAxes(c, Math.cos(a) * 1.1, at[1] + h * fx.r(0.2, 0.9), Math.sin(a) * 1.1), v: turned(c, fx.r(-0.15, 0.15), fx.r(0.15, 0.45), fx.r(-0.15, 0.15)), life: fx.r(1.0, 1.6),
        s0: 0.016, s1: 0.004, c0: [0.95, 0.9, 1.0], c1: [0.5, 0.35, 1.0], a0: 0.9, a1: 0.2, flutter: 0.8, heat: 0.5 });
    }
  },
  /** BRASS GATE opening: a blast of steam at its foot, a blue ring, sparks off the cogs. */
  'portal-brass-open'(/** @type {any} */ c) {
    const { fx, b, at, h, w, gy, n } = c;
    for (let i = 0, N = n(10); i < N; i++) {
      const v = outward(fx, fx.r(0.8, 1.8), fx.r(0.6, 1.6));
      fx.part(b, { p: [at[0], gy + 0.1, at[2]], v: turned(c, v[0], v[1], v[2]), life: fx.r(1.0, 1.6), s0: w * 0.2, s1: w * 0.7, shape: KFX_SHAPE.smoke, c0: [0.9, 0.93, 0.95], c1: [0.75, 0.8, 0.85], a0: 0.45, a1: 0, add: false, drag: 1.6, rot: fx.r(0, TAU), spin: fx.r(-0.6, 0.6) });
    }
    for (let i = 0, N = n(24); i < N; i++) {
      const a = fx.r(0, TAU);
      fx.part(b, { p: onAxes(c, Math.cos(a) * w * 0.55, at[1] + h * (0.5 + Math.sin(a) * 0.5), 0), v: turned(c, Math.cos(a) * fx.r(1, 3), fx.r(0, 2), fx.r(-0.5, 0.5)), life: fx.r(0.3, 0.6),
        s0: 0.014, s1: 0.004, shape: KFX_SHAPE.spark, c0: [1, 0.85, 0.5], c1: [0.6, 0.85, 1.0], a0: 1, a1: 0.3, drag: 2, g: 5, streak: 0.04, heat: 0.8 });
    }
    fx.part(b, { p: [at[0], gy + 0.03, at[2]], life: 0.6, s0: w * 0.4, s1: w * 2.2, shape: KFX_SHAPE.ring, c0: [0.6, 0.9, 1.0], c1: [0.25, 0.55, 1.0], a0: fx.reduced ? 0.3 : 0.75 });
  },
  /** BRASS GATE standing: a breath of steam at its foot. */
  'portal-brass-steam'(/** @type {any} */ c) {
    const { fx, b, w, gy } = c;
    const side = fx.rng() < 0.5 ? -1 : 1;
    fx.part(b, { p: onAxes(c, side * w * 0.45, gy + 0.15, 0), v: turned(c, side * fx.r(0.1, 0.4), fx.r(0.5, 1.0), fx.r(-0.1, 0.1)), life: fx.r(1.2, 1.8), s0: w * 0.15, s1: w * 0.5, shape: KFX_SHAPE.smoke,
      c0: [0.92, 0.94, 0.96], c1: [0.8, 0.84, 0.88], a0: 0.32, a1: 0, add: false, drag: 0.8, fadeIn: 0.15, rot: fx.r(0, TAU), spin: fx.r(-0.5, 0.5) });
  },

  /** TONAL SHATTER: brass cogs and gear teeth burst out, steam jets, a blue tonal ring rolls out over the ground. */
  tonal(/** @type {any} */ { fx, b, at, h, w, gy, n }) {
    const mid = [at[0], at[1] + h * 0.55, at[2]];
    fx.part(b, { p: [...mid], life: 0.25, s0: w * 0.5, s1: w * 1.1, c0: [0.85, 0.95, 1.0], c1: [0.4, 0.75, 1.0], a0: fx.reduced ? 0.35 : 0.9, heat: 1 });
    for (let i = 0, N = n(18); i < N; i++) {   // the cogs, tumbling out, ringing off the ground
      const big = i < 4;
      fx.part(b, { p: [mid[0], mid[1] + fx.r(-0.3, 0.3) * h, mid[2]], v: outward(fx, fx.r(1.4, 3.8), fx.r(2, 5)), life: fx.r(2.0, 2.8), s0: big ? fx.r(0.14, 0.2) : fx.r(0.06, 0.11), s1: big ? 0.14 : 0.07,
        shape: KFX_SHAPE.cog, c0: [0.86, 0.66, 0.3], c1: [0.62, 0.46, 0.2], a0: 1, a1: 0.9, add: false, g: 9.8, drag: 0.3, gy, bounce: 0.45, spin: fx.r(-12, 12), rot: fx.r(0, TAU) });
    }
    for (let i = 0, N = n(22); i < N; i++) {   // gear teeth and rivets
      fx.part(b, { p: [...mid], v: outward(fx, fx.r(2, 5), fx.r(1, 4)), life: fx.r(1.4, 2.2), s0: fx.r(0.025, 0.05), s1: 0.03, shape: KFX_SHAPE.shard,
        c0: [0.9, 0.72, 0.36], c1: [0.55, 0.4, 0.18], a0: 1, a1: 0.8, add: false, g: 9.8, drag: 0.5, gy, bounce: 0.3, spin: fx.r(-18, 18), rot: fx.r(0, TAU) });
    }
    for (let i = 0, N = n(12); i < N; i++) {   // steam venting up and out
      const v = outward(fx, fx.r(0.6, 1.4), fx.r(1.2, 2.4));
      fx.part(b, { p: [at[0] + v[0] * 0.15, at[1] + h * fx.r(0.1, 0.7), at[2] + v[2] * 0.15], v, age: -fx.r(0, 0.3), life: fx.r(1.2, 1.9), s0: w * 0.2, s1: w * 0.85, shape: KFX_SHAPE.smoke,
        c0: [0.9, 0.93, 0.95], c1: [0.75, 0.8, 0.85], a0: 0.42, a1: 0, add: false, drag: 1.4, fadeIn: 0.1, rot: fx.r(0, TAU), spin: fx.r(-0.8, 0.8) });
    }
    for (let i = 0, N = n(28); i < N; i++) {
      fx.part(b, { p: [...mid], v: outward(fx, fx.r(2, 6), fx.r(-1, 3)), life: fx.r(0.3, 0.6), s0: 0.014, s1: 0.004, shape: KFX_SHAPE.spark, c0: [0.85, 0.95, 1.0], c1: [0.4, 0.7, 1.0], a0: 1, a1: 0.3, drag: 2, g: 4, streak: 0.04, heat: 0.8 });
    }
    // the tonal rings, one after another - by the body's width as every look's ring (THE VISUAL PASS: a fixed 4 to 5.6 m
    // ran past a small foe's ground and off the shop's stage)
    for (let k = 0; k < 3; k++) {
      fx.part(b, { p: [at[0], gy + 0.03 + k * 0.01, at[2]], age: -k * 0.18, life: 0.9, s0: w * 0.4, s1: w * (2.8 + k * 0.4), shape: KFX_SHAPE.ring, c0: [0.6, 0.9, 1.0], c1: [0.25, 0.55, 1.0], a0: (fx.reduced ? 0.35 : 0.85) * (1 - k * 0.2) });
    }
  },

  // ═══ THE SEASON'S (scenes/seasonHost.js): a Brass Fissure's vents and its waking, and the tremor ═══
  /** A FISSURE'S VENT: steam rising off the crack in a slow column, the aetherium's light in it. */
  'fissure-steam'(/** @type {any} */ { fx, b, at, gy }) {
    for (let i = 0; i < 3; i++) {
      fx.part(b, { p: [at[0] + fx.r(-0.3, 0.3), gy + 0.1, at[2] + fx.r(-0.3, 0.3)], v: [fx.r(-0.15, 0.15), fx.r(1.0, 1.8), fx.r(-0.15, 0.15)], age: -i * 0.35, life: fx.r(2.6, 3.6), s0: 0.35, s1: 1.7,
        shape: KFX_SHAPE.smoke, c0: [0.9, 0.93, 0.96], c1: [0.78, 0.82, 0.88], a0: 0.36, a1: 0, add: false, drag: 0.5, fadeIn: 0.4, rot: fx.r(0, TAU), spin: fx.r(-0.3, 0.3) });
    }
    fx.part(b, { p: [at[0], gy + 0.15, at[2]], v: [0, fx.r(0.3, 0.6), 0], life: fx.r(1.0, 1.6), s0: 0.12, s1: 0.05, c0: [0.55, 0.85, 1.0], c1: [0.25, 0.55, 1.0], a0: 0.6, a1: 0, flutter: 0.6, heat: 0.6 });
  },
  /** A FISSURE WAKING: a blast of steam out of the crack, its light flaring, sparks off the brass as the constructs climb
   *  out - along the crack, its facing `dir` the fissure's (seasonHost.js). */
  'fissure-wake'(/** @type {any} */ c) {
    const { fx, b, at, gy, n } = c;
    for (let i = 0, N = n(12); i < N; i++) {
      fx.part(b, { p: onAxes(c, fx.r(-3, 3), gy + 0.2, fx.r(-0.6, 0.6)), v: turned(c, fx.r(-0.5, 0.5), fx.r(2.5, 4.5), fx.r(-0.5, 0.5)), life: fx.r(1.8, 2.6), s0: 0.6, s1: 2.6, shape: KFX_SHAPE.smoke,
        c0: [0.92, 0.95, 0.98], c1: [0.78, 0.82, 0.88], a0: 0.5, a1: 0, add: false, drag: 1.2, rot: fx.r(0, TAU), spin: fx.r(-0.5, 0.5) });
    }
    for (let i = 0, N = n(36); i < N; i++) {
      fx.part(b, { p: onAxes(c, fx.r(-3, 3), gy + 0.3, 0), v: turned(c, fx.r(-2, 2), fx.r(2, 5), fx.r(-2, 2)), life: fx.r(0.4, 0.8), s0: 0.016, s1: 0.004, shape: KFX_SHAPE.spark,
        c0: [1, 0.88, 0.5], c1: [0.5, 0.8, 1.0], a0: 1, a1: 0.3, drag: 1.2, g: 6, streak: 0.04, heat: 0.8 });
    }
    fx.part(b, { p: [at[0], gy + 0.04, at[2]], life: 0.9, s0: 1, s1: 9, shape: KFX_SHAPE.ring, c0: [0.6, 0.9, 1.0], c1: [0.25, 0.55, 1.0], a0: fx.reduced ? 0.3 : 0.8 });
  },
  /** THE TREMOR: dust shaken up off the ground about the feet, and grit falling. */
  'tremor-dust'(/** @type {any} */ { fx, b, at, gy, n }) {
    for (let i = 0, N = n(6); i < N; i++) {
      const a = fx.r(0, TAU), r = fx.r(1.5, 6);
      fx.part(b, { p: [at[0] + Math.cos(a) * r, gy + 0.1, at[2] + Math.sin(a) * r], v: [fx.r(-0.3, 0.3), fx.r(0.3, 0.8), fx.r(-0.3, 0.3)], life: fx.r(1.6, 2.4), s0: 0.3, s1: 1.2, shape: KFX_SHAPE.smoke,
        c0: [0.62, 0.56, 0.46], c1: [0.55, 0.5, 0.42], a0: 0.3, a1: 0, add: false, drag: 1.0, fadeIn: 0.2, rot: fx.r(0, TAU), spin: fx.r(-0.4, 0.4) });
    }
    for (let i = 0, N = n(10); i < N; i++) {
      const a = fx.r(0, TAU), r = fx.r(0.5, 5);
      fx.part(b, { p: [at[0] + Math.cos(a) * r, gy + 0.05, at[2] + Math.sin(a) * r], v: [fx.r(-0.4, 0.4), fx.r(1, 2.2), fx.r(-0.4, 0.4)], life: fx.r(0.8, 1.2), s0: fx.r(0.02, 0.04), s1: 0.02, shape: KFX_SHAPE.shard,
        c0: [0.36, 0.3, 0.24], c1: [0.3, 0.25, 0.2], a0: 1, a1: 0.8, add: false, g: 9.8, gy, bounce: 0.3, spin: fx.r(-10, 10), rot: fx.r(0, TAU) });
    }
  },
});
/** Every recipe's name - the kill looks', the portal skins' bursts, the mount looks' beats and the season's (the tests walk them). */
export const KFX_RECIPES = Object.freeze(Object.keys(RECIPES));
/** Each recipe's pool (KFX_POOL_CAP) - the recipe's own, so no caller can start an opening in a kill's room. */
export const KFX_POOL_OF = Object.freeze({
  ashen: 'kill', voidrend: 'kill', pyre: 'kill', tonal: 'kill',
  'portal-runic-open': 'event', 'portal-daedric-open': 'event', 'portal-aetheric-open': 'event', 'portal-brass-open': 'event', 'fissure-wake': 'event',
  'portal-daedric-embers': 'place', 'portal-aetheric-motes': 'place', 'portal-brass-steam': 'place', 'fissure-steam': 'place', 'tremor-dust': 'place',
  'mount-warhorse': 'mount', 'mount-spectral': 'mount', 'mount-dawnfire': 'mount', 'mount-automaton': 'mount',
});


// ═══ THE PASS ════════════════════════════════════════════════════════════════════════════════════════════════════════
const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
export const KILL_FX_VS = HEAD + `layout(location = 0) in vec2 aC;   // the quad's corner, -1..1
layout(location = 1) in vec4 iPS;  // centre, size
layout(location = 2) in vec2 iRS;  // turn, shape
layout(location = 3) in vec4 iCA;  // colour, alpha
layout(location = 4) in vec3 iD;   // a spark's streak, a ground shape's normal, a standing shape's height (x)
layout(location = 5) in vec3 iQ;   // seed, progress, heat
uniform mat4 uVP;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vQ;
out vec3 vWorld;
out vec4 vCA;
out vec3 vSQ;
out float vLen;
flat out int vShape;
void main() {
  int shape = int(iRS.y + 0.5);
  float s = max(iPS.w, 1e-4);
  vec3 c = iPS.xyz, p;
  vLen = 0.0;
  if (shape >= 6 && shape <= 8) {   // lying on the ground, turned by its turn
    vec3 n = normalize(iD);
    vec3 t1 = normalize(cross(n, abs(n.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0)));
    vec3 t2 = cross(n, t1);
    float cs = cos(iRS.x), sn = sin(iRS.x);
    vec2 q = vec2(aC.x * cs - aC.y * sn, aC.x * sn + aC.y * cs);
    p = c + (t1 * q.x + t2 * q.y) * s;
    vQ = aC;
  } else if (shape >= 9) {         // standing up, its height along the world's up, turned to the eye about it
    vec3 toEye = uEye - c; toEye.y = 0.0;
    vec3 side = length(toEye) > 1e-4 ? normalize(cross(vec3(0.0, 1.0, 0.0), toEye)) : uRight;
    float hh = max(iD.x, 1e-3);
    vec3 base = shape == 10 ? c : c - vec3(0.0, hh * 0.5, 0.0);   // a beam stands on its foot, a rift about its middle
    p = base + side * (aC.x * s) + vec3(0.0, (aC.y * 0.5 + 0.5) * hh, 0.0);
    vQ = aC;
  } else if (shape == 1 && dot(iD, iD) > 1e-8) {   // a spark streaked along its flight
    vec3 d = iD;
    float len = length(d);
    vec3 a = c - d;
    vec3 mid = c - 0.5 * d;
    vec3 ax = d / len;
    vec3 sd = cross(ax, normalize(uEye - mid));
    float sl = length(sd);
    if (sl > 1e-3) {
      sd /= sl;
      float t = (aC.y * 0.5 + 0.5) * len + aC.y * s;
      p = a + ax * t + sd * (aC.x * s);
      vQ = vec2(aC.x, t / s);
      vLen = len / s;
    } else { p = c + (uRight * aC.x + uUp * aC.y) * s; vQ = aC; }
  } else {                          // facing the eye, turned by its turn
    float cs = cos(iRS.x), sn = sin(iRS.x);
    vec2 q = vec2(aC.x * cs - aC.y * sn, aC.x * sn + aC.y * cs);
    p = c + (uRight * q.x + uUp * q.y) * s;
    vQ = aC;
  }
  vShape = shape;
  vCA = iCA;
  vSQ = iQ;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const KILL_FX_FS = HEAD + `in vec2 vQ;
in vec3 vWorld;
in vec4 vCA;
in vec3 vSQ;
in float vLen;
flat in int vShape;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform int uAdd;
${FOG_GLSL}
out vec4 o;
const float TAU = 6.283185307179586;
float h12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.2 * vnoise(p * 4.01 + 3.7); }
// a triangle of three points round the centre, each its own reach off the seed - a shard's outline
float shardIn(vec2 q, float seed) {
  vec2 a = vec2(cos(seed * 6.0), sin(seed * 6.0)) * (0.75 + 0.25 * fract(seed * 13.0));
  vec2 b = vec2(cos(seed * 6.0 + 2.3), sin(seed * 6.0 + 2.3)) * (0.55 + 0.4 * fract(seed * 29.0));
  vec2 c = vec2(cos(seed * 6.0 + 4.2), sin(seed * 6.0 + 4.2)) * (0.6 + 0.4 * fract(seed * 47.0));
  float e1 = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
  float e2 = (c.x - b.x) * (q.y - b.y) - (c.y - b.y) * (q.x - b.x);
  float e3 = (a.x - c.x) * (q.y - c.y) - (a.y - c.y) * (q.x - c.x);
  return min(min(e1, e2), e3);   // > 0 inside; its size how far in
}
void main() {
  vec3 col = vCA.rgb;
  float a = vCA.a, k = 0.0, heat = vSQ.z, seed = vSQ.x, u = vSQ.y;
  float r = length(vQ);
  if (vShape == 0) {            // a glow
    if (r >= 1.0) discard;
    k = exp(-r * r * 4.5);
    heat *= exp(-r * r * 18.0);
  } else if (vShape == 1) {     // a spark, streaked
    float da = max(0.0, max(-vQ.y, vQ.y - vLen));
    float rr = length(vec2(vQ.x, da));
    if (rr >= 1.0) discard;
    k = pow(1.0 - rr, 2.0);
    heat *= 1.0 - smoothstep(0.0, 0.45, rr);
  } else if (vShape == 2) {     // a shard: its outline, two faces and a lit edge
    float e = shardIn(vQ, seed);
    if (e <= 0.0) discard;
    float face = step(0.0, vQ.x * cos(seed * 11.0) + vQ.y * sin(seed * 11.0));
    col *= mix(0.62, 1.12, face);
    col += vec3(0.35) * (1.0 - smoothstep(0.0, 0.07, e));
    k = 1.0;
  } else if (vShape == 3) {     // an ash flake, ragged
    vec2 q = abs(vQ);
    float d = pow(pow(q.x, 3.0) + pow(q.y, 3.0), 1.0 / 3.0);
    if (d > 0.85 - 0.35 * vnoise(vQ * 3.0 + seed * 17.0)) discard;
    col *= 0.85 + 0.3 * vnoise(vQ * 5.0 + seed * 3.0);
    k = 1.0;
  } else if (vShape == 4) {     // a cog: its teeth, its rim, its spokes' windows, brass lit from above
    if (r >= 1.0) discard;
    float ang = atan(vQ.y, vQ.x);
    float tooth = smoothstep(0.35, 0.45, abs(fract(ang * 10.0 / TAU) - 0.5) * 2.0);
    float outer = 0.74 + 0.22 * tooth;
    if (r > outer || r < 0.2) discard;
    float win = step(0.36, r) * step(r, 0.58) * step(0.2, abs(fract(ang * 5.0 / TAU) - 0.5) * 2.0);
    if (win > 0.5) discard;
    float lit = 0.62 + 0.38 * dot(normalize(vec2(vQ.x, vQ.y) + 1e-4), normalize(vec2(-0.5, 0.8)));
    col *= lit + 0.45 * (1.0 - smoothstep(0.0, 0.06, abs(r - outer + 0.03))) + 0.25 * (1.0 - smoothstep(0.0, 0.04, abs(r - 0.6)));
    k = 1.0;
  } else if (vShape == 5) {     // a puff of smoke or dust
    if (r >= 1.0) discard;
    float nz = fbm(vQ * 1.7 + vec2(seed * 7.0, seed * 3.0) + vec2(0.0, -u * 0.8));
    k = (1.0 - smoothstep(0.15, 1.0, r)) * (0.45 + 0.75 * nz);
    col *= 0.8 + 0.35 * nz;
  } else if (vShape == 6) {     // a ring rolling out over the ground
    if (r >= 1.0) discard;
    float x = (r - 0.82) / 0.07;
    k = exp(-x * x) * (0.8 + 0.4 * vnoise(vec2(atan(vQ.y, vQ.x) * 6.0, u * 4.0)));
    k += 0.12 * (1.0 - smoothstep(0.0, 0.82, r)) * (1.0 - u);
  } else if (vShape == 7) {     // the Daedric sigil: three rings, eight blades between, runes round its rim, an eye
    if (r >= 1.0) discard;
    float ang = atan(vQ.y, vQ.x);
    // every square a product, never pow(x, 2.0): GLSL leaves pow of a negative undefined (a driver's exp2/log2 is NaN)
    float d1 = (r - 0.93) / 0.025, d2 = (r - 0.8) / 0.015, d3 = (r - 0.42) / 0.02, d4 = (r - 0.14) / 0.03;
    float ring = exp(-d1 * d1) + exp(-d2 * d2) * 0.9 + exp(-d3 * d3);
    float sect = fract(ang * 8.0 / TAU) - 0.5;
    float blade = step(0.42, r) * step(r, 0.8) * step(abs(sect), (0.8 - r) * 0.55 + 0.012);
    float rune = step(0.82, r) * step(r, 0.91) * step(0.55, h12(vec2(floor(ang * 48.0 / TAU), 3.0))) * step(0.25, abs(fract(ang * 48.0 / TAU) - 0.5) * 2.0);
    float eye = exp(-d4 * d4) + (1.0 - smoothstep(0.0, 0.08, r));
    float burn = 0.75 + 0.5 * vnoise(vec2(ang * 5.0, r * 8.0 - u * 6.0));
    k = clamp(ring + blade * 0.9 + rune * 0.8 + eye, 0.0, 1.4) * burn;
    if (k < 0.02) discard;
  } else if (vShape == 8) {     // a stain on the ground
    if (r >= 1.0) discard;
    k = pow(1.0 - r * r, 2.0) * (0.7 + 0.5 * vnoise(vQ * 4.0 + seed * 9.0));
  } else if (vShape == 9) {     // a rift: its void, or (the added layer) its burning rim
    float wob = 0.55 + 0.45 * vnoise(vec2(vQ.y * 4.0, seed * 9.0 + u * 3.0));
    float e = (vQ.x * vQ.x) / (wob * wob) + vQ.y * vQ.y;
    if (e >= 1.0) discard;
    if (uAdd == 1) { float d = (sqrt(e) - 0.82) / 0.12; k = exp(-d * d) * (0.8 + 0.6 * vnoise(vQ * 8.0 + u * 5.0)); heat *= k; }
    else k = 1.0 - smoothstep(0.6, 1.0, e);
  } else {                      // a beam of fire standing on its foot
    float x = abs(vQ.x), y = vQ.y * 0.5 + 0.5;
    float nz = fbm(vec2(vQ.x * 2.2 + seed * 5.0, y * 3.0 - u * 6.0));
    float wdt = 0.55 + 0.45 * nz;
    if (x > wdt) discard;
    k = pow(1.0 - x / wdt, 1.6) * (1.0 - smoothstep(0.45 + 0.25 * nz, 1.0, y)) * (0.6 + 0.6 * nz);
    heat *= pow(1.0 - x / wdt, 3.0) * (1.0 - y);
  }
  vec3 lit = mix(col, vec3(1.0, 0.97, 0.9), clamp(heat, 0.0, 1.0) * 0.8);
  float f = fogFactorAt(vWorld);
  if (uAdd == 1) o = vec4(lit * (k * a * f), 1.0);
  else { float al = clamp(k * a, 0.0, 1.0) * f; o = vec4(lit * al, al); }   // premultiplied: ONE, ONE_MINUS_SRC_ALPHA
}`;
/** SHADER-STALL: the pass's one program, for the warm (render/glProgram.js startPrograms). */
export const KILL_FX_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[KILL_FX_VS, KILL_FX_FS]]));
const NO_HAZE = new Float32Array(8);

/** A layer's range of the pass's instance buffer (bytes): the blended layer's first, the added layer's after it. */
export const KFX_LAYER_BYTES = KFX_MAX_INSTANCES * KFX_FLOATS * 4;

/** THE PASS: one program, one quad, one instance buffer holding both layers - each its own range and its own VAO, so
 *  no range is written twice in a frame (a driver that cannot rename a buffer would stall on the draw before). */
export class KillFxPass {
  constructor(/** @type {WebGL2RenderingContext} */ gl) {
    this.gl = gl;
    const [[vs, fs]] = KILL_FX_PROGRAMS;
    this.prog = buildProgram(gl, vs, fs, 'kill effects');
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uRight', 'uUp', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze', 'uAdd']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    this.inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, 2 * KFX_LAYER_BYTES, gl.DYNAMIC_DRAW);
    const S = KFX_FLOATS * 4;
    /** @type {(WebGLVertexArrayObject|null)[]} the blended layer's VAO, the added layer's */
    this.vaos = [0, KFX_LAYER_BYTES].map((base) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
      const attr = (/** @type {number} */ loc, /** @type {number} */ size, /** @type {number} */ off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, base + off); gl.vertexAttribDivisor(loc, 1); };
      attr(1, 4, 0); attr(2, 2, 16); attr(3, 4, 24); attr(4, 3, 40); attr(5, 3, 52);
      return vao;
    });
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the magic engine frees its pass with itself (hostMagic destroy). */
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.quad); gl.deleteBuffer(this.inst); for (const v of this.vaos) gl.deleteVertexArray(v); gl.deleteProgram(this.prog);
  }

  /** Draw the simulation's two layers under this frame's camera and fog. Leaves the renderer's baseline: no blend, depth
   *  written, faces culled. Answers how many instances it drew. */
  draw(/** @type {KillFx} */ fx, /** @type {Float32Array} */ proj, /** @type {Float32Array} */ view, /** @type {number[]} */ eye, /** @type {any} */ fog = null) {
    this.drawn = 0;
    if (!(fx.nAlpha + fx.nAdd > 0) || !proj || !view) return 0;
    const gl = this.gl, u = this.u, m = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.uVP, false, m);
    gl.uniform3f(u.uEye, eye[0], eye[1], eye[2]);
    gl.uniform3f(u.uRight, view[0], view[4], view[8]);
    gl.uniform3f(u.uUp, view[1], view[5], view[9]);
    gl.uniform1i(u.uFogMode, fog?.mode ?? 0);
    gl.uniform1f(u.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(u.uFogRange, fog?.range ?? [0, 1]);
    gl.uniform3fv(u.uCamPos, fog?.camPos ?? eye);
    if (u.uFocus) gl.uniform4fv(u.uFocus, fog?.focus ?? [0, 0, 0, 0]);
    if (u.uJungleHaze) gl.uniform4fv(u.uJungleHaze, fog?.haze ?? NO_HAZE);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    if (fx.nAlpha > 0) {
      gl.uniform1i(u.uAdd, 0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, fx.alpha, 0, fx.nAlpha * KFX_FLOATS);
      gl.bindVertexArray(this.vaos[0]);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, fx.nAlpha);
    }
    if (fx.nAdd > 0) {
      gl.uniform1i(u.uAdd, 1);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bufferSubData(gl.ARRAY_BUFFER, KFX_LAYER_BYTES, fx.add, 0, fx.nAdd * KFX_FLOATS);
      gl.bindVertexArray(this.vaos[1]);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, fx.nAdd);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = fx.nAlpha + fx.nAdd;
    return this.drawn;
  }
}
