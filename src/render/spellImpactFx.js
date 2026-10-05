// @ts-check
// IMPACTFX (2026-10-05, the player: "give it a high quality effect that suits the game and the spell that sprays to the
// ground based on the element, you have to see that it is shock and fire, water and heal like green heal lineish
// sparkles that rise up"): A LANDING SPELL, SEEN. The classic impact flash (record 1 of the element's own archive,
// scenes/hostMagic.js showImpactFlash) still plays - this is drawn OVER it, in light:
//
//   FIRE    a fireball bloom, ember streaks thrown out and up that fall, land and smoulder before they go out, licks of
//           flame climbing out of the burst, a scorch glow on the floor and a shock ring running out over it
//   FROST   (the player's "water") a splash crown of droplets that rain back down, each one a ripple ring where it
//           lands, ice glints scattered on the floor, a cold mist, two ripple rings and a frost glow
//   POISON  slow green globs lobbed out that splat into small pools and bubble, a sickly vapour, a spreading pool
//   SHOCK   jagged lightning arcing from the impact down to the floor - re-struck every few hundredths of a second,
//           with after-crackles - and fast white-blue sparks skittering over the ground, a flash ring
//   MAGIC   violet motes spiralling out, glints, rune rings
//   HEAL    no burst: a green pool of light on the floor and thin mint lines of light RISING out of it with twinkles
//
// Each burst also throws a short coloured light (`light()`) the host lights the walls with.
//
// The duel wall's law (render/duelWall.js, render/gateFx.js): ADDED onto the frame (ONE, ONE) so it only brightens,
// depth-tested against the world and never writing depth, fogged by the renderer's one fog block. One instanced quad
// per spark, bolt segment, glint, ring or pool; the simulation is plain JS and the pass only draws what it is handed.
// Not a DFU member.
import { FOG_GLSL } from './fogGlsl.js';
import { buildProgram } from './glProgram.js';

/** The looks, by name; the element order is DFU's ElementTypes (fire, frost, poison, shock, magic). */
export const IMPACT_FX_KINDS = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic', 'heal']);
/** A spell element (0..4) as its look; anything else is magic's. */
export const elementFxKind = (el) => IMPACT_FX_KINDS[Number.isInteger(el) && el >= 0 && el <= 4 ? el : 4];

/** The shapes the pass draws. */
export const FX_SHAPE = Object.freeze({ spark: 0, bolt: 1, star: 2, flare: 3, ring: 4, pool: 5 });
/** Floats per instance: a.xyz, b.xyz, width, r, g, b, intensity, shape, and (WALL-RING) the normal of the plane a ring
 *  or a pool lies in - up for the floor, the struck surface's for a wall or a ceiling. */
export const FX_FLOATS = 15;
const UP = Object.freeze([0, 1, 0]);
/** The most instances one frame draws, and the most sparks alive at once. */
export const FX_MAX_INSTANCES = 2400;
export const FX_MAX_PARTS = 1500;
/** The narrowest a spark may stand on the screen, as an angle of the eye's view - a burst across a hall still reads. */
export const FX_MIN_RAD = 0.0016;

/** The colours: white-hot at birth, the element's colour, what it cools to; and the light it throws (colour x level).
 *  ART-COLOUR: for the five elements these are only the FIRST GUESS - each is replaced by its own missile art's colour
 *  the first time that art is in hand (SpellImpactFx.setArtColour). The heal's green is the player's ask, and stays. */
export const FX_LOOK = Object.freeze({
  fire: Object.freeze({ hot: [1.0, 0.9, 0.62], main: [1.0, 0.46, 0.08], end: [0.5, 0.07, 0.01], light: [1.7, 0.8, 0.28], range: 7, lightS: 0.45 }),
  frost: Object.freeze({ hot: [0.9, 0.97, 1.0], main: [0.42, 0.74, 1.0], end: [0.1, 0.28, 0.72], light: [0.6, 0.95, 1.7], range: 6, lightS: 0.4 }),
  poison: Object.freeze({ hot: [0.9, 1.0, 0.5], main: [0.5, 0.92, 0.1], end: [0.14, 0.32, 0.02], light: [0.7, 1.4, 0.3], range: 5, lightS: 0.45 }),
  shock: Object.freeze({ hot: [1.0, 1.0, 1.0], main: [0.55, 0.72, 1.0], end: [0.38, 0.22, 0.95], light: [1.2, 1.35, 2.1], range: 8, lightS: 0.3 }),
  // ART-COLOUR: magic's first guess was violet - the player: "magic spells are also greenish". These are only the
  // colours before the element's own art is sampled (artLook below); this one now guesses the art's sea-green.
  magic: Object.freeze({ hot: [0.88, 1.0, 0.95], main: [0.35, 0.95, 0.72], end: [0.06, 0.4, 0.3], light: [0.7, 1.6, 1.25], range: 6, lightS: 0.4 }),
  heal: Object.freeze({ hot: [0.85, 1.0, 0.88], main: [0.3, 1.0, 0.5], end: [0.04, 0.48, 0.2], light: [0.5, 1.5, 0.7], range: 5, lightS: 0.9 }),
});

const TAU = Math.PI * 2;

/**
 * ART-COLOUR (the player: "magic spells are also greenish ... i dont know if the violet effects fit"): A LOOK OUT OF THE
 * ELEMENT'S OWN ART. `rgb` the colour sampled off the element's missile archive (375-379, the player's own ARENA2 -
 * characters/thunderlockIds.js orbColourFrom: chroma-weighted, peak-normalised, so the halo votes and the white core
 * does not), `base` the guess it replaces (its range and timing kept). The art's colour, a shade more saturated so it
 * still reads as light, is the burst's colour; white-hot at birth is that colour lifted most of the way to white; what
 * it cools to is that colour deepened; the light it throws is that colour. Pure. Null for no usable colour.
 */
export function artLook(rgb, base) {
  if (!Array.isArray(rgb) || rgb.length < 3 || !rgb.every(Number.isFinite)) return null;
  const peak = Math.max(rgb[0], rgb[1], rgb[2]);
  if (!(peak > 0.05)) return null;
  const c = rgb.map((v) => Math.max(0, v) / peak);
  const grey = (c[0] + c[1] + c[2]) / 3;
  const main = c.map((v) => Math.min(1, Math.max(0, grey + (v - grey) * 1.25)));   // a shade more saturated: it is light
  const m = Math.max(...main);
  for (let i = 0; i < 3; i++) main[i] /= m || 1;
  return Object.freeze({
    ...base,
    hot: Object.freeze(main.map((v) => v + (1 - v) * 0.72)),
    main: Object.freeze(main),
    end: Object.freeze(main.map((v) => Math.pow(v, 1.6) * 0.4)),
    light: Object.freeze(main.map((v) => v * 1.7)),
    art: true,
  });
}
/**
 * AOE-REACH: HOW FAR ALONG THE FLOOR A BLAST CATCHES A BODY. The sweep (systems/spellcast.js sphereOverlapsCapsule) does
 * not test a body's feet against the sphere - it tests its CAPSULE: the point of the body's axis nearest the sphere's
 * centre, clamped between `bodyR` over the feet and `bodyR` under the head, must lie within `A + bodyR`. So a body
 * standing level with the blast is caught `A + bodyR` out (4.45 m for a person in a 4 m blast, 5.8 m for the court's
 * boss), and one under a blast high on a wall still is, by the gap between the blast and its head. `h` the sphere
 * centre's height over the floor. Answers the radius on the floor inside which a body of that size standing there is
 * caught - the same arithmetic as the sweep, so the ring drawn is the line a foe crosses to get out of it.
 */
export function areaFootprint(A, h, bodyR = 0.45, bodyH = 1.8) {
  if (!(A > 0)) return 0;
  const half = Math.min(bodyR, bodyH / 2);
  const dy = Math.max(0, half - h, h - (bodyH - half));
  const R = A + bodyR;
  return dy >= R ? 0 : Math.sqrt(R * R - dy * dy);
}
/** WALL-RING: two unit axes across a plane of unit normal `n` - the shader's own basis for a ring or a pool, in JS. */
export function planeAxes(n) {
  const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  let a = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  a = [a[0] / l, a[1] / l, a[2] / l];
  return [a, [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]];
}
/** The body the drawn reach is measured for: a person, the sweep's default (spellcast.js BODY_CAPSULE_RADIUS). */
export const AREA_BODY = Object.freeze({ r: 0.45, h: 1.8 });
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The colour ramp: hot to the element's colour over the first quarter of a life, to the cooled colour after. */
export function rampColour(look, u) {
  return u < 0.25 ? mix3(look.hot, look.main, u / 0.25) : mix3(look.main, look.end, Math.min(1, (u - 0.25) / 0.75));
}

/**
 * THE SIMULATION - every live spark, bolt, ring and light of every burst. `burst` adds one, `step` flies them,
 * `build` writes this frame's instances into `buf` and answers how many. Floating-origin safe (`shift`).
 */
export class SpellImpactFx {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    /** @type {any[]} */ this.parts = [];
    /** @type {any[]} */ this.decals = [];
    /** @type {any[]} */ this.bolts = [];
    /** @type {any[]} */ this.lights = [];
    /** ART-COLOUR: the looks this engine draws - the first guesses, until each element's art has been sampled. */
    this.looks = { ...FX_LOOK };
    this.buf = new Float32Array(FX_MAX_INSTANCES * FX_FLOATS);
    this.count = 0;
  }

  /** ART-COLOUR: the element `kind`'s look from its art's colour (artLook); answers whether it took. The heal's is
   *  never replaced - it is the player's green, whatever element a heal spell carries. */
  setArtColour(kind, rgb) {
    if (kind === 'heal' || !FX_LOOK[kind]) return false;
    const look = artLook(rgb, FX_LOOK[kind]);
    if (!look) return false;
    this.looks[kind] = look;
    return true;
  }
  /** ART-COLOUR: each element's colour as this engine draws it now, and whether it came from the art. */
  artColours() {
    const out = {};
    for (const k of IMPACT_FX_KINDS) out[k] = { main: this.looks[k].main.map((v) => +v.toFixed(3)), fromArt: !!this.looks[k].art };
    return out;
  }

  get live() { return this.parts.length + this.decals.length + this.bolts.length + this.lights.length > 0; }
  r(a, b) { return a + this.rng() * (b - a); }

  /** A spark. Defaults are a plain falling ember; a recipe overrides what it needs. */
  _part(look, at, v, o = {}) {
    if (this.parts.length >= FX_MAX_PARTS) return null;
    const life = o.life ?? 1;
    const p = {
      look, p: [at[0], at[1], at[2]], v: [v[0], v[1], v[2]], age: -(o.delay ?? 0), life, life0: life,
      w: o.w ?? 0.03, w1: o.w1 ?? 1, g: o.g ?? 9.8, drag: o.drag ?? 0.5, streak: o.streak ?? 0.04, maxLen: o.maxLen ?? 0.6,
      shape: o.shape ?? FX_SHAPE.spark, gy: o.gy ?? -Infinity, bounce: o.bounce ?? 0, bounces: o.bounces ?? 0,
      linger: o.linger ?? 0, flick: o.flick ?? 0, sway: o.sway ?? 0, fadeIn: o.fadeIn ?? 0, I: o.I ?? 1, onLand: o.onLand ?? null,
      seed: this.rng() * 100, rest: false,
    };
    this.parts.push(p);
    return p;
  }
  _decal(look, at, o) {
    if (this.decals.length > 160) return;
    this.decals.push({ look, at: [at[0], at[1], at[2]], n: o.n ?? UP, age: -(o.delay ?? 0), life: o.life ?? 1, r0: o.r0 ?? 0, r1: o.r1 ?? 1, band: o.band ?? 0.1,
      shape: o.shape ?? FX_SHAPE.ring, I: o.I ?? 1, fadeIn: o.fadeIn ?? 0, hot: !!o.hot });
  }
  _light(look, at, s, o = {}) {
    this.lights.push({ at: [at[0], at[1] + 0.5, at[2]], age: -(o.delay ?? 0), life: o.life ?? look.lightS, range: look.range * s, color: look.light, flick: o.flick ?? 0, fadeIn: o.fadeIn ?? 0 });
    if (this.lights.length > 8) this.lights.shift();
  }
  _bolt(look, from, to, o = {}) {
    if (this.bolts.length > 48) return;
    this.bolts.push({ look, from: [...from], to: [...to], age: -(o.delay ?? 0), life: o.life ?? 0.3, next: 0, flash: 1, w: o.w ?? 0.08, pts: [], fork: [] });
  }

  /**
   * ONE LANDING. `kind` an IMPACT_FX_KINDS name; `at` where it landed (scene frame). `ground` the floor's height under it (null:
   * a body's height below), `back` the unit direction out of what it struck (sparks spray back that way), `scale` the
   * missile's size, `power` 1 a bolt's, more for a blast, less for a touch; `radius` a heal's reach and `minR` the hole
   * a heal leaves at its middle (the caster's own eye stands there).
   * AOE-SIZE: `area` (metres) an area spell's blast radius - the sphere its sweep catches (spellcast.js EXPLOSION_RADIUS),
   * centred on `areaFrom` (default `at`). The burst is then drawn TO what it catches: AOE-REACH, its front runs out to
   * exactly where a body (`body`, a person's by default) standing on the floor stops being caught (areaFootprint), its
   * edge holds there a moment, a glow swells to the sphere's rim, and a heal's light fills it - and the wider that
   * footprint, the more the blast throws: its element breaks out across the whole of it as the front passes.
   * WALL-RING (the player: "the explosion shockwave when shot a bit higher at the wall still happens on the floor"):
   * THE SHOCKWAVE LIES ON WHAT WAS STRUCK. `normal` the struck surface's (collider.surfaceHit), `surfaceAt` the point
   * on it: the rings, the glow pool, the racing sparks and the outbreaks lie flat on that wall, ceiling or floor at the
   * impact, the blast's own radius across. Only with no surface (a body, the air) does the floor under it take them -
   * while it is within a body's height of it; higher than that the ring stands in the air across the line of flight.
   */
  burst(kind, at, { ground = null, back = null, scale = 1, power = 1, radius = null, minR = 0, area = 0, areaFrom = null, body = AREA_BODY, normal = null, surfaceAt = null } = {}) {
    if (!Array.isArray(at) || at.length < 3 || !at.every(Number.isFinite)) return false;
    const look = this.looks[kind] ?? this.looks.magic;   // ART-COLOUR: the element's own art's colour once sampled
    const s = Math.max(0.3, Math.min(4, Number.isFinite(scale) ? scale : 1));
    const P = Math.max(0.3, Math.min(2.5, Number.isFinite(power) ? power : 1));
    let gy = Number.isFinite(ground) ? ground : at[1] - 1.2;
    if (gy > at[1]) gy = at[1] - 0.05;
    const floorAt = [at[0], gy + 0.04, at[2]];
    // WALL-RING: the plane the shockwave lies in - its centre `pc`, its normal `pn`, and whether it is the floor
    const nl = Array.isArray(normal) && normal.every(Number.isFinite) ? Math.hypot(normal[0], normal[1], normal[2]) : 0;
    const bl = Array.isArray(back) && back.every(Number.isFinite) ? Math.hypot(back[0], back[1], back[2]) : 0;
    let pn = UP, pc = floorAt, onFloor = true;
    if (nl > 1e-6) {
      pn = [normal[0] / nl, normal[1] / nl, normal[2] / nl];
      const S = Array.isArray(surfaceAt) && surfaceAt.every(Number.isFinite) ? surfaceAt : at;
      pc = [S[0] + pn[0] * 0.04, S[1] + pn[1] * 0.04, S[2] + pn[2] * 0.04];
      onFloor = pn[1] > 0.7 && Math.abs(S[1] - gy) < 0.3;
    } else if (at[1] - gy > 1.7) {
      pn = bl > 1e-6 ? [back[0] / bl, back[1] / bl, back[2] / bl] : UP;
      pc = [at[0], at[1], at[2]]; onFloor = false;
    }
    const [t1, t2] = planeAxes(pn);
    const inPlane = (a, d) => [pc[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * d, pc[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * d, pc[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * d];
    const B = Array.isArray(back) && back.every(Number.isFinite) ? back : [0, 0, 0];
    const r = (a, b) => this.r(a, b);
    const out = (h, up, bk = 0) => { const a = r(0, TAU); return [Math.cos(a) * h + B[0] * bk, up + B[1] * bk, Math.sin(a) * h + B[2] * bk]; };
    const pg = gy + 0.02;
    const R = this.r.bind(this);
    // AOE-SIZE: the sphere's footprint on the floor, and whether the element's own rings and light give way to it
    const A = Number.isFinite(area) && area > 0 ? area : 0;
    const C = Array.isArray(areaFrom) && areaFrom.length >= 3 && areaFrom.every(Number.isFinite) ? areaFrom : at;
    const fr = A > 0 ? (onFloor ? areaFootprint(A, C[1] - gy, body?.r ?? AREA_BODY.r, body?.h ?? AREA_BODY.h) : A) : 0;   // AOE-REACH: the sweep's own law on the floor; WALL-RING: on a wall, the blast's own radius
    const own = A <= 0;
    const done = () => { if (A > 0) this._areaLayer(look, kind, at, onFloor ? [C[0], gy + 0.04, C[2]] : pc, onFloor ? UP : pn, A, fr, s); return true; };
    const Pn = A > 0 ? Math.min(2.5, P * Math.max(1, fr / 3)) : P;   // AOE-REACH: a wider area throws more, not the same spread thinner
    const n = (k) => Math.max(1, Math.round(k * Pn));

    if (kind === 'heal') {
      const rad = A > 0 ? Math.max(0.5, fr * 0.92) : (radius ?? 0.9) * Math.sqrt(s);   // AOE-SIZE: an area heal fills its sphere
      const edge = A > 0 ? Math.max(0.6, fr) : rad * 1.5;
      const hole = Math.min(minR, rad * 0.8);
      const many = Math.min(3, Math.max(1, rad / 1.2));   // a wider heal rises in more lines, not thinner ones
      const hf = [C[0], gy + 0.04, C[2]];
      // HEAL-NOWAVE (the player: "the healing still gives a wave on the floor"): NO RING, NO SPREAD. A heal is not a blast -
      // only a still, soft pool of green light under the rising lines, fading in and out where it stands.
      const poolR = A > 0 ? edge : rad * 1.15;
      this._decal(look, hf, { shape: FX_SHAPE.pool, r0: poolR, r1: poolR, life: 1.7, fadeIn: 0.3, I: 0.55 });
      const place = () => {
        const a = R(0, TAU), d = hole + Math.sqrt(this.rng()) * (rad - hole);
        return [[C[0] + Math.cos(a) * d, gy + R(0, 0.5), C[2] + Math.sin(a) * d], a];
      };
      for (let i = 0, N = n(44 * many); i < N; i++) {   // the rising lines
        const [p, a] = place(), tw = R(0.1, 0.35);
        this._part(look, p, [-Math.sin(a) * tw, R(1.1, 2.4), Math.cos(a) * tw], { delay: R(0, 0.95), life: R(0.9, 1.5), w: R(0.012, 0.022), g: -2.2, drag: 0.15,
          streak: 0.16, maxLen: 0.6, fadeIn: 0.14, sway: 0.5, I: R(1.0, 1.6) });
      }
      for (let i = 0, N = n(16 * many); i < N; i++) {   // the twinkles among them
        const [p] = place();
        this._part(look, p, [0, R(0.5, 1.3), 0], { delay: R(0, 1.05), life: R(0.7, 1.2), w: R(0.05, 0.09), g: -0.8, drag: 0.5, shape: FX_SHAPE.star, flick: 1, fadeIn: 0.15, I: 1.4 });
      }
      this._part(look, [C[0], gy + 0.9, C[2]], [0, 0.4, 0], { life: 1.1, w: rad * 0.8, w1: 1.3, g: 0, drag: 0, shape: FX_SHAPE.flare, streak: 0, fadeIn: 0.35, I: 0.22 });
      this._light(look, [C[0], gy + 0.6, C[2]], A > 0 ? Math.max(1, (rad * 1.6) / look.range) : s, { life: 1.1, fadeIn: 0.2 });
      return true;
    }

    if (kind === 'fire') {
      this._part(look, at, [0, 0, 0], { life: 0.28, w: 1.0 * s * P, w1: 1.7, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 2.0 });
      this._part(look, at, [0, 0.5, 0], { life: 0.6, w: 0.75 * s * P, w1: 2.1, g: -0.5, drag: 1, shape: FX_SHAPE.flare, streak: 0, I: 0.9 });
      for (let i = 0, N = n(34); i < N; i++) {   // embers: out, up, down - and they smoulder where they land
        this._part(look, at, out(R(2, 7.5) * Math.sqrt(P), R(1.5, 6), R(1, 4)), { life: R(0.7, 1.5), w: R(0.018, 0.04) * s, g: 9.5, drag: 0.9, streak: 0.045, maxLen: 0.45,
          gy: pg, bounce: 0.3, bounces: 1, linger: R(0.4, 1.1), flick: 0.5, I: R(1.2, 2.0) });
      }
      for (let i = 0, N = n(10); i < N; i++) {   // the flame licking up out of it
        const j = [at[0] + R(-0.15, 0.15), at[1] + R(-0.1, 0.1), at[2] + R(-0.15, 0.15)];
        this._part(look, j, out(R(0.3, 1.2), R(1, 2.6)), { life: R(0.4, 0.75), w: R(0.12, 0.22) * s, w1: 2.2, g: -1.5, drag: 2.5, streak: 0, shape: FX_SHAPE.flare, I: 0.7 });
      }
      if (own) {
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.4 * s, r1: 1.6 * s * P, life: 1.1, I: 0.9 });
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.2, r1: 2.2 * s * P, life: 0.4, band: 0.12, I: 1.4, hot: true });
      }
      if (own) this._light(look, at, s * Math.sqrt(P), { flick: 0.35 });
      return done();
    }

    if (kind === 'frost') {
      this._part(look, at, [0, 0, 0], { life: 0.2, w: 0.8 * s * P, w1: 1.5, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 1.8 });
      for (let i = 0, N = n(28); i < N; i++) {   // the splash crown: up, over, down - a ripple where some land
        this._part(look, at, out(R(1.2, 3.8), R(3.5, 7.5), R(0.5, 2.5)), { life: R(0.8, 1.3), w: R(0.016, 0.03) * s, g: 17, drag: 0.4, streak: 0.06, maxLen: 0.35,
          gy: pg, onLand: this.rng() < 0.45 ? 'ripple' : null, I: R(1.1, 1.7) });
      }
      for (let i = 0, N = n(10); i < N; i++) {   // ice: glints that settle on the floor and wink out
        this._part(look, at, out(R(1, 3), R(1.5, 4), R(0.5, 2)), { life: R(0.9, 1.4), w: 0.07 * s, g: 14, drag: 0.6, streak: 0, shape: FX_SHAPE.star,
          gy: pg + 0.03, linger: 0.6, flick: 0.9, I: 1.3 });
      }
      for (let i = 0, N = n(8); i < N; i++) {   // the cold mist
        this._part(look, at, out(R(0.5, 1.5), R(0.2, 1)), { life: R(0.8, 1.4), w: R(0.25, 0.45) * s, w1: 2.4, g: 0, drag: 2.2, streak: 0, shape: FX_SHAPE.flare, I: 0.35 });
      }
      if (own) {
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.1, r1: 2.3 * s * P, life: 0.75, band: 0.07, I: 1.2, hot: true });
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.1, r1: 1.6 * s * P, life: 0.75, band: 0.06, delay: 0.14, I: 0.9 });
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.4, r1: 1.5 * s * P, life: 1.4, I: 0.6 });
      }
      if (own) this._light(look, at, s * Math.sqrt(P));
      return done();
    }

    if (kind === 'poison') {
      this._part(look, at, [0, 0, 0], { life: 0.3, w: 0.7 * s * P, w1: 1.6, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 1.0 });
      for (let i = 0, N = n(16); i < N; i++) {   // the globs, lobbed - each splats into a little pool
        this._part(look, at, out(R(0.8, 3), R(2, 5), R(0.5, 2)), { life: R(1.0, 1.6), w: R(0.05, 0.09) * s, g: 9.5, drag: 0.3, streak: 0.02, maxLen: 0.12,
          gy: pg, onLand: 'splat', I: R(0.8, 1.2) });
      }
      for (let i = 0, N = n(10); i < N; i++) {   // the vapour
        this._part(look, at, out(R(0.2, 0.8), R(0.3, 0.9)), { life: R(1.2, 2.0), w: R(0.3, 0.5) * s, w1: 2, g: -0.3, drag: 1.5, streak: 0, shape: FX_SHAPE.flare, I: 0.28 });
      }
      if (own) {
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.3, r1: 1.6 * s * P, life: 1.8, I: 0.7 });
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.2, r1: 2.0 * s * P, life: 0.7, band: 0.1, I: 0.9 });
      }
      if (own) this._light(look, at, s * Math.sqrt(P));
      return done();
    }

    if (kind === 'shock') {
      this._part(look, at, [0, 0, 0], { life: 0.12, w: 0.9 * s * P, w1: 1.3, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 3.0 });
      this._part(look, at, [0, 0, 0], { life: 0.25, w: 1.4 * s * P, w1: 1.5, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 0.9 });
      const arc = (delay, life) => {   // to the floor when there is one near, into the air about it when not
        const a = R(0, TAU), d = A > 0 ? Math.max(0.8, fr) * R(0.5, 1) : R(0.8, 2.6) * s * Math.sqrt(P);   // AOE-SIZE: an area's arcs reach its edge
        const to = onFloor ? [at[0] + Math.cos(a) * d, gy + 0.02, at[2] + Math.sin(a) * d] : inPlane(a, d);   // WALL-RING: along the wall it struck
        this._bolt(look, at, to, { delay, life, w: 0.08 * s });
      };
      for (let i = 0, N = n(5); i < N; i++) arc(0, R(0.18, 0.4));
      for (let i = 0, N = n(4); i < N; i++) arc(R(0.12, 0.65), R(0.1, 0.2));   // the after-crackle
      for (let i = 0, N = n(32); i < N; i++) {   // fast sparks, skittering over the floor
        this._part(look, at, out(R(4, 11), R(1, 5), R(1, 4)), { life: R(0.35, 0.8), w: R(0.012, 0.022) * s, g: 13, drag: 0.5, streak: 0.03, maxLen: 0.5,
          gy: pg, bounce: 0.55, bounces: 2, flick: 0.6, I: R(1.4, 2.2) });
      }
      if (own) {
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.1, r1: 2.3 * s * P, life: 0.22, band: 0.08, I: 1.8, hot: true });
        this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.3, r1: 1.2 * s * P, life: 0.5, I: 0.8 });
      }
      if (own) this._light(look, at, s * Math.sqrt(P), { flick: 0.9 });
      return done();
    }

    // magic
    this._part(look, at, [0, 0, 0], { life: 0.22, w: 0.9 * s * P, w1: 1.4, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 2.0 });
    this._part(look, at, [0, 0, 0], { life: 0.45, w: 1.2 * s * P, w1: 1.6, g: 0, shape: FX_SHAPE.flare, streak: 0, I: 0.7 });
    for (let i = 0, N = n(26); i < N; i++) {   // the motes: out and round
      const a = R(0, TAU), rad = R(1.5, 4.5), tan = R(1.5, 3) * (this.rng() < 0.5 ? -1 : 1);
      this._part(look, at, [Math.cos(a) * rad - Math.sin(a) * tan + B[0], R(1, 4) + B[1], Math.sin(a) * rad + Math.cos(a) * tan + B[2]], { life: R(0.8, 1.4),
        w: R(0.02, 0.035) * s, g: 3.5, drag: 1.6, streak: 0.05, maxLen: 0.35, gy: pg, flick: 0.4, I: 1.5 });
    }
    for (let i = 0, N = n(8); i < N; i++) {
      this._part(look, at, out(R(0.5, 2), R(0.5, 2.5)), { life: R(0.7, 1.2), w: 0.09 * s, g: 0.5, drag: 1.5, streak: 0, shape: FX_SHAPE.star, flick: 0.8, I: 1.3 });
    }
    if (own) {
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.1, r1: 2.4 * s * P, life: 0.5, band: 0.06, I: 1.4, hot: true });
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.1, r1: 1.6 * s * P, life: 0.5, band: 0.1, delay: 0.12, I: 0.8 });
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.3, r1: 1.3 * s * P, life: 0.9, I: 0.6 });
    }
    if (own) this._light(look, at, s * Math.sqrt(P));
    return done();
  }

  /**
   * AOE-SIZE: THE AREA, DRAWN TO ITS SIZE. `C` the sphere's centre, `A` its radius, `fr` its footprint on the floor.
   * A front in the element's hot colour runs out to the footprint's rim, sparks race along the floor to that same rim
   * and stop there, the rim holds a moment as a thin ring (where the blast stopped catching), a pool lies under it and
   * a glow swells to the sphere's own size. Its light reaches about twice the radius.
   */
  _areaLayer(look, kind, at, pc, pn, A, fr, s) {
    const r = (a, b) => this.r(a, b);
    const [t1, t2] = planeAxes(pn);
    const along = (a, d, lift = 0) => [pc[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * d + pn[0] * lift, pc[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * d + pn[1] * lift, pc[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * d + pn[2] * lift];
    if (fr > 0.3) {
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: 0.3, r1: fr, life: 0.5, band: 0.12, I: 1.6, hot: true });   // the front
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.ring, r0: fr, r1: fr, life: 0.9, band: 0.05, delay: 0.35, fadeIn: 0.12, I: 0.75 });   // the rim, held
      this._decal(look, pc, { n: pn, shape: FX_SHAPE.pool, r0: 0.3 * fr, r1: 0.85 * fr, life: kind === 'poison' ? 1.8 : 1.1, I: 0.55 });
      const N = Math.min(70, Math.round(10 * fr));
      for (let i = 0; i < N; i++) {   // racing along the surface to the rim, and out there
        const a = (i / N) * TAU + r(-0.1, 0.1), T = r(0.32, 0.45), v = (fr * r(0.93, 1.0)) / T;
        const o = along(a, 0, 0.06), e = along(a, 1, 0.06);
        this._part(look, o, [(e[0] - o[0]) * v, (e[1] - o[1]) * v, (e[2] - o[2]) * v], { life: T, w: r(0.02, 0.035) * s, g: 0, drag: 0, streak: 0.06, maxLen: 0.7, I: r(1.1, 1.6) });
      }
      if (kind === 'shock') {
        for (let i = 0; i < 4; i++) this._bolt(look, at, along(r(0, TAU), fr * r(0.75, 1), 0.02), { delay: r(0, 0.15), life: r(0.2, 0.35), w: 0.09 * s });
      }
      // AOE-REACH: THE ELEMENT BREAKS OUT ACROSS ALL OF IT - one small outbreak per ~1.8 m² of the footprint, each going
      // off as the front passes over it (the front's own ease, inverted: it covers d of fr at 0.5 * (1 - cbrt(1 - d/fr)) s)
      const K = Math.min(48, Math.round((Math.PI * fr * fr) / 1.8));
      for (let i = 0; i < K; i++) {
        const d = fr * Math.sqrt(r(0.04, 0.92));
        this._outbreak(look, kind, along(r(0, TAU), d), 0.5 * (1 - Math.cbrt(1 - d / fr)) + r(0, 0.06), s, pn);
      }
    }
    this._part(look, at, [0, 0, 0], { life: 0.4, w: A * 0.3, w1: 1 / 0.3, g: 0, drag: 0, streak: 0, shape: FX_SHAPE.flare, I: 0.3 });   // the sphere, swelling to its rim
    this._light(look, at, Math.max(1, (Math.max(A, fr) * 2) / look.range));
  }

  /** AOE-REACH: one small outbreak of the element on the floor at `p`, `delay` seconds in - flame, frost, a spark of
   *  lightning, a bubble of venom, a mote. */
  _outbreak(look, kind, p, delay, s, pn = UP) {
    const r = (a, b) => this.r(a, b), up = [p[0] + pn[0] * 0.06, p[1] + pn[1] * 0.06, p[2] + pn[2] * 0.06];
    switch (kind) {
      case 'fire':
        this._part(look, up, [r(-0.2, 0.2), r(0.8, 1.8), r(-0.2, 0.2)], { delay, life: r(0.35, 0.6), w: r(0.14, 0.26) * s, w1: 1.8, g: -1, drag: 2, streak: 0, shape: FX_SHAPE.flare, I: 0.55 });
        this._part(look, up, [r(-0.6, 0.6), r(1.5, 3), r(-0.6, 0.6)], { delay, life: r(0.5, 0.9), w: 0.02 * s, g: 9, drag: 0.8, streak: 0.04, maxLen: 0.25, gy: p[1] + 0.02, linger: 0.4, flick: 0.5, I: 1.4 });
        break;
      case 'frost':
        this._part(look, up, [0, 0, 0], { delay, life: r(0.6, 1.0), w: r(0.06, 0.1) * s, g: 0, drag: 0, streak: 0, shape: FX_SHAPE.star, flick: 0.9, I: 1.2 });
        this._decal(look, up, { n: pn, shape: FX_SHAPE.ring, r0: 0.04, r1: 0.4, life: 0.5, band: 0.035, delay, I: 0.8 });
        break;
      case 'shock': {
        const a = r(0, TAU), l = r(0.4, 0.9);
        const [u1, u2] = planeAxes(pn), lift = r(0.3, 0.9);
        this._bolt(look, [p[0] + pn[0] * lift, p[1] + pn[1] * lift, p[2] + pn[2] * lift], [p[0] + (u1[0] * Math.cos(a) + u2[0] * Math.sin(a)) * l + pn[0] * 0.02, p[1] + (u1[1] * Math.cos(a) + u2[1] * Math.sin(a)) * l + pn[1] * 0.02, p[2] + (u1[2] * Math.cos(a) + u2[2] * Math.sin(a)) * l + pn[2] * 0.02], { delay, life: r(0.08, 0.16), w: 0.05 * s });
        break;
      }
      case 'poison':
        this._decal(look, up, { n: pn, shape: FX_SHAPE.pool, r0: 0.05, r1: r(0.25, 0.45), life: 1.2, delay, I: 0.7 });
        this._part(look, up, [0, r(0.3, 0.7), 0], { delay: delay + r(0.05, 0.3), life: r(0.4, 0.7), w: 0.03 * s, g: 0, drag: 1, streak: 0, I: 0.9 });
        break;
      case 'heal':
        break;   // a heal's own lines already fill its area, more of them the wider it is
      default:
        this._part(look, up, [0, r(0.8, 1.8), 0], { delay, life: r(0.5, 0.9), w: 0.025 * s, g: -0.5, drag: 0.6, streak: 0.12, maxLen: 0.4, flick: 0.4, I: 1.3 });
    }
  }

  /** What a spark does where it lands, beyond resting: a droplet's ripple, a glob's splat and its bubble. */
  _land(p) {
    if (p.onLand === 'ripple') {
      this._decal(p.look, p.p, { shape: FX_SHAPE.ring, r0: 0.03, r1: 0.38, life: 0.45, band: 0.035, I: 0.9 });
    } else if (p.onLand === 'splat') {
      this._decal(p.look, p.p, { shape: FX_SHAPE.pool, r0: 0.05, r1: 0.32, life: 1.1, I: 0.8 });
      if (this.rng() < 0.7) this._part(p.look, [p.p[0], p.p[1] + 0.02, p.p[2]], [0, this.r(0.3, 0.7), 0], { delay: this.r(0.05, 0.4), life: this.r(0.4, 0.7), w: 0.03, g: 0, drag: 1, streak: 0, I: 0.9 });
    }
  }

  step(dt) {
    const d = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.05);
    if (!(d > 0)) return;
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += d;
      if (p.age < 0) continue;
      if (p.age >= p.life) { P.splice(i, 1); continue; }
      if (p.rest) continue;
      const k = Math.exp(-p.drag * d);
      p.v[0] *= k; p.v[1] *= k; p.v[2] *= k;
      p.v[1] -= p.g * d;
      p.p[0] += p.v[0] * d; p.p[1] += p.v[1] * d; p.p[2] += p.v[2] * d;
      if (p.sway) { const q = p.age * 6 + p.seed; p.p[0] += Math.sin(q) * p.sway * d * 0.4; p.p[2] += Math.cos(q * 1.3) * p.sway * d * 0.4; }
      if (p.p[1] <= p.gy && p.v[1] < 0) {
        p.p[1] = p.gy;
        if (p.bounces > 0 && p.bounce > 0) {
          p.bounces--; p.v[1] = -p.v[1] * p.bounce; p.v[0] *= 0.6; p.v[2] *= 0.6;
        } else {
          p.rest = true; p.v[0] = p.v[1] = p.v[2] = 0;
          if (p.onLand) this._land(p);
          p.life = p.linger > 0 ? Math.max(p.age + 0.05, Math.min(p.life + p.linger, p.age + p.linger)) : p.age + 0.04;
        }
      }
    }
    for (const L of [this.decals, this.lights]) {
      for (let i = L.length - 1; i >= 0; i--) { L[i].age += d; if (L[i].age >= L[i].life) L.splice(i, 1); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += d;
      if (b.age >= b.life) { this.bolts.splice(i, 1); continue; }
      if (b.age >= 0 && b.age >= b.next) { this._jitter(b); b.next = b.age + this.r(0.035, 0.06); }
    }
  }

  /** A bolt struck again: a fresh jagged path from its root to its end, and a short fork off its middle. */
  _jitter(b) {
    const N = 7, f = b.from, t = b.to;
    const dx = t[0] - f[0], dy = t[1] - f[1], dz = t[2] - f[2], len = Math.hypot(dx, dy, dz) || 1;
    const amp = len * 0.13;
    b.pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, e = i === 0 || i === N ? 0 : Math.sin(Math.PI * u);
      b.pts.push([f[0] + dx * u + this.r(-1, 1) * amp * e, f[1] + dy * u + this.r(-1, 1) * amp * e * 0.6, f[2] + dz * u + this.r(-1, 1) * amp * e]);
    }
    const root = b.pts[3 + Math.floor(this.rng() * 2)];
    const fl = len * this.r(0.25, 0.45);
    b.fork = [root];
    for (let i = 1; i <= 3; i++) {
      const prev = b.fork[i - 1];
      b.fork.push([prev[0] + this.r(-1, 1) * fl / 3, prev[1] - this.r(0, 1) * fl / 3, prev[2] + this.r(-1, 1) * fl / 3]);
    }
    b.flash = this.r(0.45, 1);
  }

  /** The floating origin moved: everything moves with it. */
  shift(o) {
    if (!o) return;
    const mv = (p) => { p[0] += o[0]; p[1] += o[1]; p[2] += o[2]; };
    for (const p of this.parts) { mv(p.p); if (Number.isFinite(p.gy)) p.gy += o[1]; }
    for (const q of this.decals) mv(q.at);
    for (const l of this.lights) mv(l.at);
    for (const b of this.bolts) { mv(b.from); mv(b.to); b.pts.forEach(mv); b.fork.forEach(mv); }
  }

  clear() { this.parts.length = 0; this.decals.length = 0; this.bolts.length = 0; this.lights.length = 0; this.count = 0; }

  /** The brightest light the live bursts throw this frame, in nearestLights' shape (`color` colour x level), or null. */
  light() {
    let best = null, bestK = 0;
    for (const l of this.lights) {
      if (l.age < 0) continue;
      const u = l.age / l.life;
      let k = Math.pow(1 - u, 1.5) * (l.fadeIn > 0 ? Math.min(1, l.age / l.fadeIn) : 1);
      if (l.flick) k *= 1 - l.flick * 0.5 * this.rng();
      if (k * l.range > bestK) { bestK = k * l.range; best = { l, k }; }
    }
    if (!best) return null;
    const { l, k } = best;
    return { x: l.at[0], y: l.at[1], z: l.at[2], range: l.range * (0.45 + 0.55 * k), color: [l.color[0] * k, l.color[1] * k, l.color[2] * k], carried: true };
  }

  /** This frame's instances into `this.buf`; answers how many. */
  build() {
    const B = this.buf, max = FX_MAX_INSTANCES;
    let n = 0;
    const put = (a, b, w, c, I, shape, nn = UP) => {
      if (n >= max || !(I > 0.002) || !(w > 0)) return;
      const o = n * FX_FLOATS;
      B[o] = a[0]; B[o + 1] = a[1]; B[o + 2] = a[2]; B[o + 3] = b[0]; B[o + 4] = b[1]; B[o + 5] = b[2];
      B[o + 6] = w; B[o + 7] = c[0]; B[o + 8] = c[1]; B[o + 9] = c[2]; B[o + 10] = I; B[o + 11] = shape;
      B[o + 12] = nn[0]; B[o + 13] = nn[1]; B[o + 14] = nn[2];
      n++;
    };
    // the floor's first, so the sparks lie over their glow
    for (const q of this.decals) {
      if (q.age < 0) continue;
      const u = q.age / q.life, e = 1 - Math.pow(1 - u, 3);
      const R = q.r0 + (q.r1 - q.r0) * e;
      let I = q.I * Math.pow(1 - u, 1.4);
      if (q.fadeIn > 0) I *= Math.min(1, q.age / q.fadeIn);
      const c = q.hot ? mix3(q.look.hot, q.look.main, Math.min(1, u * 2.5)) : q.look.main;
      if (q.shape === FX_SHAPE.ring) {
        const th = q.band * Math.max(0.5, R * 0.5), Q = Math.max(R + 2.5 * th, 0.05);
        put(q.at, [R / Q, th / Q, 0], Q, c, I, FX_SHAPE.ring, q.n);
      } else {
        put(q.at, [0, 0, 0], Math.max(R, 0.05), c, I * 0.8, FX_SHAPE.pool, q.n);
      }
    }
    for (const p of this.parts) {
      if (p.age < 0) continue;
      const u = Math.min(1, p.age / p.life), uc = Math.min(1, p.age / p.life0);
      let I = p.I * Math.pow(1 - u, 1.3);
      if (p.fadeIn > 0) I *= Math.min(1, p.age / p.fadeIn);
      if (p.flick) I *= 1 - p.flick * 0.55 * (0.5 + 0.5 * Math.sin(p.age * 38 + p.seed * 7));
      const w = p.w * (1 + (p.w1 - 1) * u);
      const c = rampColour(p.look, uc);
      const head = p.rest ? [p.p[0], p.p[1] + w * 0.6, p.p[2]] : p.p;
      if (p.shape === FX_SHAPE.spark && !p.rest && p.streak > 0) {
        let tx = p.v[0] * p.streak, ty = p.v[1] * p.streak, tz = p.v[2] * p.streak;
        const L = Math.hypot(tx, ty, tz);
        if (L > p.maxLen) { const k = p.maxLen / L; tx *= k; ty *= k; tz *= k; }
        put([head[0] - tx, head[1] - ty, head[2] - tz], head, w, c, I, FX_SHAPE.spark);
      } else {
        put(head, head, w, c, I, p.shape);
      }
    }
    for (const b of this.bolts) {
      if (b.age < 0 || !b.pts.length) continue;
      const u = b.age / b.life, I = b.flash * (1 - u * u);
      const draw = (pts, k) => {
        for (let i = 1; i < pts.length; i++) {
          put(pts[i - 1], pts[i], b.w * 1.4 * k, b.look.main, I * 0.55, FX_SHAPE.spark);   // the glow round it
          put(pts[i - 1], pts[i], b.w * 0.28 * k, b.look.hot, I * 1.6, FX_SHAPE.bolt);    // the white core
        }
      };
      draw(b.pts, 1);
      draw(b.fork, 0.6);
    }
    this.count = n;
    return n;
  }
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
export const SPELL_FX_VS = HEAD + `layout(location = 0) in vec2 aC;   // the quad's corner, -1..1
layout(location = 1) in vec3 iA;
layout(location = 2) in vec3 iB;
layout(location = 3) in vec4 iWC;  // width, colour
layout(location = 4) in vec2 iIS;  // intensity, shape
layout(location = 5) in vec3 iN;   // WALL-RING: the plane a ring or a pool lies in (up: the floor)
uniform mat4 uVP;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uMinRad;
out vec2 vQ;
out vec2 vB;
out vec3 vWorld;
out vec3 vColor;
out float vI;
out float vLen;
flat out int vShape;
void main() {
  int shape = int(iIS.y + 0.5);
  float w = max(iWC.x, 1e-4);
  float inten = iIS.x;
  vec3 p;
  vB = iB.xy;
  if (shape >= 4) {   // a ring or a pool, lying in its plane - the floor, or the wall or ceiling the spell struck
    vec3 nrm = normalize(iN);
    vec3 t1 = normalize(cross(nrm, abs(nrm.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0)));
    vec3 t2 = cross(nrm, t1);
    p = iA + (t1 * aC.x + t2 * aC.y) * w;
    vQ = aC;
    vLen = 0.0;
  } else {            // a spark, a bolt, a glint or a flare: a quad stood facing the eye, stretched along its length
    vec3 a = iA;
    vec3 d = iB - iA;
    float len = length(d);
    vec3 mid = a + 0.5 * d;
    float dist = length(uEye - mid);
    float wm = max(w, dist * uMinRad);
    inten *= w / wm;                               // drawn wider than it is far off: as bright in all, not brighter
    inten *= smoothstep(0.12, 0.55, dist);         // nothing blinds the eye it passes
    vec3 axis = uUp;
    vec3 side = uRight;
    if (len > 1e-4) {
      vec3 ax = d / len;
      vec3 sd = cross(ax, normalize(uEye - mid));
      float sl = length(sd);
      if (sl > 1e-3) { axis = ax; side = sd / sl; }
      else { len = 0.0; a = iB; }                  // seen end-on: the head, as a point
    } else {
      len = 0.0;
    }
    float t = (aC.y * 0.5 + 0.5) * len + aC.y * wm;
    p = a + axis * t + side * (aC.x * wm);
    vQ = vec2(aC.x, t / wm);
    vLen = len / wm;
  }
  vShape = shape;
  vColor = iWC.yzw;
  vI = inten;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const SPELL_FX_FS = HEAD + `in vec2 vQ;
in vec2 vB;
in vec3 vWorld;
in vec3 vColor;
in float vI;
in float vLen;
flat in int vShape;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${FOG_GLSL}
out vec4 o;
void main() {
  float k;
  float core = 0.0;
  if (vShape >= 4) {
    float r = length(vQ);
    if (r >= 1.0) discard;
    if (vShape == 4) {
      float x = (r - vB.x) / max(vB.y, 1e-3);
      k = exp(-x * x) * (1.0 - smoothstep(0.85, 1.0, r));
      core = k * 0.35;
    } else {
      float f = 1.0 - r;
      k = f * f * (0.55 + 0.45 * f);
    }
  } else {
    float da = max(0.0, max(-vQ.y, vQ.y - vLen));
    float r = length(vec2(vQ.x, da));
    if (r >= 1.0) discard;
    float f = 1.0 - r;
    if (vShape == 0) {
      k = f * f;
      core = 1.0 - smoothstep(0.0, 0.45, r);
    } else if (vShape == 1) {
      k = f * f * f * 0.7 + (1.0 - smoothstep(0.0, 0.35, r)) * 1.6;
      core = 1.0 - smoothstep(0.0, 0.4, r);
    } else if (vShape == 2) {
      vec2 q = abs(vQ);
      float rays = max(0.0, 1.0 - q.x * 9.0) * (1.0 - q.y) + max(0.0, 1.0 - q.y * 9.0) * (1.0 - q.x);
      k = rays * 1.2 + pow(f, 4.0) * 1.4;
      core = pow(f, 6.0);
    } else {
      k = pow(f, 2.2);
      core = pow(f, 5.0) * 0.8;
    }
  }
  vec3 c = mix(vColor, vec3(1.0), clamp(core, 0.0, 1.0) * 0.75);
  o = vec4(c * (k * vI * fogFactorAt(vWorld)), 1.0);
}`;

/** THE PASS: one program, one quad, one instance buffer, re-filled per frame. */
export class SpellImpactPass {
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, SPELL_FX_VS, SPELL_FX_FS, 'spell impact');
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uRight', 'uUp', 'uMinRad', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.prog, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, FX_MAX_INSTANCES * FX_FLOATS * 4, gl.DYNAMIC_DRAW);
    const S = FX_FLOATS * 4;
    const attr = (loc, size, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off); gl.vertexAttribDivisor(loc, 1); };
    attr(1, 3, 0); attr(2, 3, 12); attr(3, 4, 24); attr(4, 2, 40); attr(5, 3, 48);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the cast engine frees its pass with itself (hostMagic destroy). */
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.quad); gl.deleteBuffer(this.inst); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
  }

  /** Draw `count` instances of `buf` under this frame's camera and fog (`fog` the renderer's: mode, density, range,
   *  camPos, focus). Leaves the renderer's baseline: no blend, depth written, faces culled. */
  draw(buf, count, proj, view, eye, fog = null) {
    this.drawn = 0;
    if (!(count > 0) || !proj || !view) return 0;
    const gl = this.gl, u = this.u, m = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.uVP, false, m);
    gl.uniform3f(u.uEye, eye[0], eye[1], eye[2]);
    gl.uniform3f(u.uRight, view[0], view[4], view[8]);
    gl.uniform3f(u.uUp, view[1], view[5], view[9]);
    gl.uniform1f(u.uMinRad, FX_MIN_RAD);
    gl.uniform1i(u.uFogMode, fog?.mode ?? 0);
    gl.uniform1f(u.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(u.uFogRange, fog?.range ?? [0, 1]);
    gl.uniform3fv(u.uCamPos, fog?.camPos ?? eye);
    if (u.uFocus) gl.uniform4fv(u.uFocus, fog?.focus ?? [0, 0, 0, 0]);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf, 0, count * FX_FLOATS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = count;
    return count;
  }
}
