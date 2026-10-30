// @ts-check
// ASHFALL1 (bible/07-Rendering/Weather-Arc.md E): THE DRY FALLS the rain program never draws (world/weather.js
// isDryFall) - WEATHER2d's sand (the wisps in SAND_LOOK) and the ash: grey flakes tumbling down a box that follows the
// eye and wraps, and a few embers kindled white-hot, reddening out and ADDED to the frame so they glow. Both take the
// front's intensity as their count's share and the ONE wind's travel as their drift; every rate is whole cycles and every
// fall whole boxes over DRY_CLOCK_PERIOD, so the wrapped clock moves no flake. The ash's program compiles at boot and is
// built at the first ashfall (compiledPass); a fault in it is the ash's alone.

import { WindWispsRenderer, SAND_LOOK, wispClock, WISP_CLOCK_PERIOD, WISP_GUST_DIV } from './windWisps.js';
import { buildProgram, compiledPass } from './glProgram.js';

/** A JS number as a GLSL float literal. */
const glslF = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

/** The clock's period, seconds: the wisps' own (wispClock wraps it). */
export const DRY_CLOCK_PERIOD = WISP_CLOCK_PERIOD;
/** The box that follows the eye, metres a side (the lab's rain and snow stand in 42). */
export const ASH_BOX = 40;
/** THE ASH: `count` flakes at a full fall; `fall` its speeds as whole boxes over the clock's period [least, steps more] -
 *  6 to 13, 0.6 to 1.3 m/s in a 40 m box; `size` the flake's width, metres [least, spread]; its colour and alpha. */
export const ASH_LOOK = Object.freeze({
  count: 12000,
  fall: Object.freeze([6, 7]),
  size: Object.freeze([0.018, 0.03]),
  color: Object.freeze([0.36, 0.34, 0.32]),
  alpha: 0.72,
});
/** THE EMBERS: fewer and smaller, falling slower (3 to 7 boxes: 0.3 to 0.7 m/s); `life` its glow's length as whole
 *  cycles over the period [least, steps more] - 40 to 99, a life of four to ten seconds; `flicker` the same for its
 *  flicker (4.25 to 6.5 a second); `gain` how bright it burns. */
export const EMBER_LOOK = Object.freeze({
  count: 320,
  fall: Object.freeze([3, 4]),
  size: Object.freeze([0.008, 0.012]),
  life: Object.freeze([40, 59]),
  flicker: Object.freeze([1700, 900]),
  gain: 1.6,
});
/** The tumble's two sways, whole cycles over the period (0.79 and 0.58 radians a second). */
export const ASH_SWAY_CYCLES = Object.freeze([50, 37]);
/** The least a flake stands on the screen, pixels across. */
export const DRY_MIN_PX = 1.5;

const HEAD = `#version 300 es
precision highp float;
`;
const TAU_OVER_PERIOD = (2 * Math.PI) / DRY_CLOCK_PERIOD;

export const ASH_VS =
  HEAD +
  `layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeed;      // x,y,z in the box + phase
uniform mat4 uVP; uniform vec3 uEye;
uniform float uTime, uBox, uEmber, uProjY, uAspect, uMinSize;
uniform vec2 uWindV, uWindOff;
uniform vec2 uFall, uSize, uLife, uFlicker;   // [least, steps more]: boxes and cycles over the clock's period; the size in metres
out vec2 vUv; out float vGlow; out float vFade;
void main(){
  float seed = aSeed.w;
  vec3 p = aSeed.xyz;
  // the wind's travel at the flake's own share of it, in whole steps of the gust's denominator
  float gust = (${glslF((WISP_GUST_DIV * 4) / 5)} + floor(fract(seed*3.7) * ${glslF((WISP_GUST_DIV * 2) / 5 + 1)})) / ${glslF(WISP_GUST_DIV)};
  p += vec3(uWindOff.x, 0.0, uWindOff.y) * gust;
  // the fall: a whole number of boxes over the clock's period, so the clock's wrap moves no flake
  float boxes = uFall.x + floor(fract(seed*7.3) * (uFall.y + 1.0));
  p.y -= uTime * boxes * uBox / ${glslF(DRY_CLOCK_PERIOD)};
  // the tumble, wider in a stronger wind
  float sway = 0.18 + length(uWindV) * 0.25;
  p.x += sin(uTime*${glslF(TAU_OVER_PERIOD * ASH_SWAY_CYCLES[0])} + seed*24.0) * sway;
  p.z += cos(uTime*${glslF(TAU_OVER_PERIOD * ASH_SWAY_CYCLES[1])} + seed*11.0) * sway;
  p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
  vec3 edge = abs(p - uEye) / (uBox*0.5);
  vFade = 1.0 - smoothstep(0.8, 1.0, max(edge.x, max(edge.y, edge.z)));   // the box's faces, where the wrap is
  // an ember's life: kindled, white-hot, reddening and out - whole lives over the period, and a flicker as it cools
  float life = fract(uTime * (uLife.x + floor(fract(seed*5.3) * (uLife.y + 1.0))) / ${glslF(DRY_CLOCK_PERIOD)} + seed*7.0);
  float flick = 0.78 + 0.22 * sin(uTime * (uFlicker.x + floor(fract(seed*9.1) * (uFlicker.y + 1.0))) * ${glslF(TAU_OVER_PERIOD)} + seed*41.0);
  vGlow = uEmber * smoothstep(0.0, 0.06, life) * pow(1.0 - life, 1.6) * flick;
  // faced to the screen, held at its least size there, its light thinned by what the hold added
  float sz = uSize.x + fract(seed*11.7) * uSize.y;
  vec4 c = uVP * vec4(p, 1.0);
  float h = 0.5 * sz * uProjY / max(c.w, 1e-4);
  float k = max(h, uMinSize);
  vFade *= (h / k) * (h / k);
  vFade *= smoothstep(0.3, 1.0, c.w);   // ASHFALL1's audit: a flake at the eye goes before it fills the screen (0.2 m off, a disc 200 px across)
  c.xy += vec2((aCorner.x - 0.5) * 2.0 * k / uAspect, (aCorner.y - 0.5) * 2.0 * k) * c.w;
  vUv = aCorner;
  gl_Position = c;
}`;
export const ASH_FS =
  HEAD +
  `in vec2 vUv; in float vGlow; in float vFade;
uniform float uEmber, uGain;
uniform vec4 uColor;   // the ash's colour and alpha
out vec4 o;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.45, 1.0, d)) * vFade;
  if (uEmber > 0.5) {
    // an ember: red at its rim, white-hot at its heart while it burns - added to the frame
    vec3 hot = mix(vec3(0.55, 0.07, 0.01), vec3(1.0, 0.62, 0.24), clamp(vGlow * 1.3, 0.0, 1.0));
    hot = mix(hot, vec3(1.0, 0.86, 0.6), (1.0 - smoothstep(0.0, 0.7, d)) * vGlow);
    o = vec4(hot * vGlow * a * uGain, 1.0);
  } else {
    o = vec4(uColor.rgb, uColor.a * a);
  }
}`;
/** The ash's program, as its build starts it (compiledPass). */
export const ASH_PROGRAMS = Object.freeze([Object.freeze(/** @type {const} */ ([ASH_VS, ASH_FS]))]);
const ASH_UNIFORMS = [
  'uVP',
  'uEye',
  'uTime',
  'uBox',
  'uEmber',
  'uProjY',
  'uAspect',
  'uMinSize',
  'uWindV',
  'uWindOff',
  'uFall',
  'uSize',
  'uLife',
  'uFlicker',
  'uGain',
  'uColor',
];

/** How many of a look's flakes a fall of `strength01` draws: its share of the count. Pure. */
export const dryCount = (strength01, look) =>
  Math.round(look.count * Math.max(0, Math.min(1, Number(strength01) || 0)));

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** One look's instances - x, y, z in [0, ASH_BOX) and a phase, from one seeded xorshift (the same fall every load) - on
 *  the quad, in a VAO of their own. */
function flakeVao(gl, count, seed) {
  const inst = new Float32Array(count * 4);
  let s = seed;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    inst[i * 4] = rnd() * ASH_BOX;
    inst[i * 4 + 1] = rnd() * ASH_BOX;
    inst[i * 4 + 2] = rnd() * ASH_BOX;
    inst[i * 4 + 3] = rnd();
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const q = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);
  return vao;
}

/** THE ASH AND ITS EMBERS: the program, the two instance sets, the wind's travel. Built by DryFallRenderer's pass. */
export class AshFallRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, ASH_VS, ASH_FS, 'ash');
    /** @type {Record<string, any>} */
    this.u = {};
    for (const n of ASH_UNIFORMS) this.u[n] = gl.getUniformLocation(this.program, n);
    this.ashVao = flakeVao(gl, ASH_LOOK.count, 0x5a17e3c1);
    this.emberVao = flakeVao(gl, EMBER_LOOK.count, 0x3e8b04d7);
    /** the wind's travel so far, metres, kept inside the box times WISP_GUST_DIV (every flake's gust times that span is
     *  whole boxes, so the wrap moves none) */
    this.windOff = new Float32Array(2);
    this._vp = new Float32Array(16);
    /** the flakes the last draw put up - the ash's and the embers' (the stats and the pins) */
    this.drawn = 0;
    this.embers = 0;
  }

  /** Advance the travel by the frame's step and wrap it. */
  advance(step) {
    const period = ASH_BOX * WISP_GUST_DIV;
    for (let i = 0; i < 2; i++) {
      const v = this.windOff[i] + (step?.[i] ?? 0);
      this.windOff[i] = ((v % period) + period) % period;
    }
  }

  /** Draw the frame's ash for `frame` ({ on, strength01, windV, step } - the hosts' fall: the front's intensity, the one
   *  wind's rate and the frame's travel). Advances the travel first. `viewH` the world image's height in pixels (the
   *  renderer's worldViewportPx - RETRO1's 200 or 400, the render scale's, a docked HUD's strip; ASHFALL1's audit: the
   *  canvas's held a flake at a third of a retro pixel), the canvas's where none is handed. */
  draw(frame, proj, view, eye, timeSeconds, viewH = 0) {
    this.drawn = 0;
    this.embers = 0;
    if (!frame?.on) return;
    this.advance(frame.step);
    const ash = dryCount(frame.strength01, ASH_LOOK),
      embers = dryCount(frame.strength01, EMBER_LOOK);
    if (ash + embers <= 0) return;
    const gl = this.gl,
      U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uTime, wispClock(timeSeconds)); // wrapped here, in double precision
    gl.uniform1f(U.uBox, ASH_BOX);
    gl.uniform1f(U.uProjY, proj[5]);
    gl.uniform1f(U.uAspect, proj[5] / proj[0]);
    gl.uniform1f(U.uMinSize, DRY_MIN_PX / Math.max(1, viewH || gl.drawingBufferHeight || 720)); // half the least size, in the world image's -1..1
    gl.uniform2f(U.uWindV, frame.windV?.[0] ?? 0, frame.windV?.[1] ?? 0);
    gl.uniform2fv(U.uWindOff, this.windOff);
    gl.uniform2f(U.uLife, EMBER_LOOK.life[0], EMBER_LOOK.life[1]);
    gl.uniform2f(U.uFlicker, EMBER_LOOK.flicker[0], EMBER_LOOK.flicker[1]);
    gl.uniform1f(U.uGain, EMBER_LOOK.gain);
    gl.uniform4f(U.uColor, ASH_LOOK.color[0], ASH_LOOK.color[1], ASH_LOOK.color[2], ASH_LOOK.alpha);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    if (ash > 0) {
      gl.uniform1f(U.uEmber, 0);
      gl.uniform2f(U.uFall, ASH_LOOK.fall[0], ASH_LOOK.fall[1]);
      gl.uniform2f(U.uSize, ASH_LOOK.size[0], ASH_LOOK.size[1]);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.ashVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, ash);
    }
    if (embers > 0) {
      gl.uniform1f(U.uEmber, 1);
      gl.uniform2f(U.uFall, EMBER_LOOK.fall[0], EMBER_LOOK.fall[1]);
      gl.uniform2f(U.uSize, EMBER_LOOK.size[0], EMBER_LOOK.size[1]);
      gl.blendFunc(gl.ONE, gl.ONE); // the embers' own light, added
      gl.bindVertexArray(this.emberVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, embers);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = ash;
    this.embers = embers;
  }
}

/** THE DRY FALLS' ONE RENDERER, as the hosts hold it: the sand's wisps built at boot (WEATHER2d's law: a shader fault a
 *  constructor fault), the ash's pass started beside them and built at the first ashfall. `draw` takes the hosts' fall
 *  with its `kind` (the front's shown mode: 'sand' or 'ash'). */
export class DryFallRenderer {
  constructor(gl) {
    this.gl = gl;
    this.sand = new WindWispsRenderer(gl, SAND_LOOK);
    this.ash = compiledPass(
      gl,
      ASH_PROGRAMS,
      () => new AshFallRenderer(gl),
      (e) => console.warn("[weather] the ash's program failed - no ash is drawn", e?.message ?? e),
    );
    this.ash(); // started with the boot: its compile runs while the world loads
    /** the flakes the last draw put up */
    this.drawn = 0;
  }

  /** Draw the frame's fall - the ash for `kind` 'ash', the sand else. `viewH` the world image's height (AshFallRenderer). */
  draw(frame, proj, view, eye, timeSeconds, viewH = 0) {
    this.drawn = 0;
    if (frame?.kind === 'ash') {
      const ash = this.ash(true); // needed now: built whatever the driver says (the start above has had the boot)
      if (!ash) return;
      ash.draw(frame, proj, view, eye, timeSeconds, viewH);
      this.drawn = ash.drawn + ash.embers;
      return;
    }
    this.sand.draw(frame, proj, view, eye, timeSeconds);
    this.drawn = this.sand.drawn;
  }
}
