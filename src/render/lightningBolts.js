// @ts-check
// BOLT (2026-09-24, Mac: "detailed cloud and cloud to ground lighting ...
// being able to be seen far away"): THE CHANNEL, DRAWN.
//
// A ground strike's channel (systems/lightning.js boltPath) as ribbons of
// light: each segment a quad turned to face the eye, a hot core with a
// soft halo across it, added onto the frame (ONE, ONE) so it only ever
// brightens. It is tested against the depth the world wrote, so a hill or
// a roof in front of a strike hides the part behind it, and it writes no
// depth of its own.
//
// SEEN FAR AWAY. A channel is metres wide; at thirty kilometres a metre is
// a hundredth of a pixel and the strike would vanish. The ribbon is never
// narrower than BOLT_MIN_PX on the screen - at a distance it is the
// pixel-thin line a real far strike is - and the air between thins its
// light by its distance (BOLT_SEEN_M, shortened by the weather's own
// visibility when the host hands one), so a far strike is a fainter line,
// never a gone one. Past the camera's far plane (six kilometres in the
// world) each vertex is drawn along its own sight line just inside it -
// where it lands on the screen and how wide it is there unchanged - so a
// strike thirty kilometres off is drawn behind everything nearer than the
// plane, and clipped by nothing.
//
// Built by the enhanced lane at boot (the wisps' law): a shader fault is a
// constructor fault the boot probe sees.

/** The channel's hot core, metres across (its halo is BOLT_HALO times it). */
export const BOLT_CORE_M = 2.5;
export const BOLT_HALO = 4;
/** The narrowest a channel's core is drawn, in pixels - so a strike thirty kilometres off is still a line. */
export const BOLT_MIN_PX = 1.4;
/** The distance over which clear air thins a strike's light to 1/e. */
export const BOLT_SEEN_M = 45000;
/** The channel's colour, linear - a hot blue-white. */
export const BOLT_COLOR = Object.freeze([0.85, 0.9, 1.0]);
/** The most segments a frame draws (every burning strike's together). */
export const BOLT_MAX_SEGS = 2048;

const HEAD = `#version 300 es
precision highp float;
`;
export const BOLT_VS = HEAD + `layout(location = 0) in vec3 aA;
layout(location = 1) in vec3 aB;
layout(location = 2) in vec2 aCorner;   // x: along the segment 0..1, y: across it -1..1
layout(location = 3) in float aGlow;    // the strike's brightness now x the segment's weight
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uPx;      // the height of a pixel at unit distance
uniform float uCore;
uniform float uHalo;
uniform float uMinPx;
uniform float uFar;     // the camera's far plane: a vertex past it is drawn along its sight line just inside
out float vAcross;
out float vGlow;
out float vDist;
out float vThin;        // how much of the drawn width is the true core (1) rather than the pixel floor (less)
void main() {
  vec3 p = mix(aA, aB, aCorner.x);
  vec3 dir = normalize(aB - aA);
  vec3 toEye = uEye - p;
  float dist = length(toEye);
  vec3 side = normalize(cross(dir, toEye / max(dist, 1e-3)));
  // the core's width, never under the pixel floor; its halo around it
  float core = max(uCore * mix(0.35, 1.0, clamp(aGlow, 0.0, 1.0)), dist * uPx * uMinPx);
  p += side * aCorner.y * core * uHalo;
  vec3 q = p - uEye;
  float l = length(q), lim = uFar * 0.97;
  if (l > lim) p = uEye + q * (lim / l);   // the same ray, the same place on the screen, the same width there
  vAcross = aCorner.y * uHalo;
  vGlow = aGlow;
  vDist = dist;
  vThin = clamp(uCore / core, 0.0, 1.0);
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const BOLT_FS = HEAD + `in float vAcross;
in float vGlow;
in float vDist;
in float vThin;
uniform vec3 uColor;
uniform float uSeen;
out vec4 o;
void main() {
  // a hot core a width across, a soft halo around it; the halo carries more of a thin far line's light
  float x = vAcross;
  float core = exp(-x * x * 2.5);
  float halo = 0.25 * exp(-x * x * 0.35);
  float air = exp(-vDist / uSeen);
  float light = (core + halo) * vGlow * air * mix(0.7, 1.0, vThin);
  o = vec4(uColor * light, 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** A GL perspective matrix's far plane: proj[14] / (proj[10] + 1) (= 2fn/(n-f) over 2n/(n-f)). Pure. */
export function farOf(proj) {
  return proj[14] / (proj[10] + 1);
}

/** Two triangles a segment: (along, across) at each corner. */
const CORNERS = [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]];
/** Floats a vertex: A xyz, B xyz, corner xy, glow. */
export const BOLT_STRIDE = 9;

/**
 * The vertices for `bolts` (`[{ segs, bright }]`, lightning.js createBoltField's), into `out` - six a segment,
 * BOLT_STRIDE floats each, glow the strike's brightness times the segment's weight. Answers the vertex count,
 * at most BOLT_MAX_SEGS segments' worth. Pure.
 */
export function boltVertices(bolts, out) {
  let v = 0;
  for (const b of bolts) {
    const s = b.segs;
    for (let i = 0; i + 7 <= s.length; i += 7) {
      if (v + 6 > BOLT_MAX_SEGS * 6) return v;
      const glow = b.bright * s[i + 6];
      for (const [al, ac] of CORNERS) {
        const o = v * BOLT_STRIDE;
        out[o] = s[i]; out[o + 1] = s[i + 1]; out[o + 2] = s[i + 2];
        out[o + 3] = s[i + 3]; out[o + 4] = s[i + 4]; out[o + 5] = s[i + 5];
        out[o + 6] = al; out[o + 7] = ac; out[o + 8] = glow;
        v++;
      }
    }
  }
  return v;
}

export class LightningBoltsRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, BOLT_VS));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, BOLT_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uPx', 'uCore', 'uHalo', 'uMinPx', 'uFar', 'uColor', 'uSeen']) this.u[n] = gl.getUniformLocation(prog, n);
    this.data = new Float32Array(BOLT_MAX_SEGS * 6 * BOLT_STRIDE);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const F = 4, S = BOLT_STRIDE * F;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 3 * F);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, 6 * F);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 8 * F);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._vp = new Float32Array(16);
    /** the segments the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** Draw the burning channels. `seen` the metres over which the air thins a strike's light (the weather's
   *  visibility; BOLT_SEEN_M in clear air). Nothing to draw, nothing touched. RETRO1: `viewH` the height in
   *  pixels of the image the world pass draws into (Renderer.worldViewportPx) - a retro frame's is 200, and a
   *  minimum width measured in the canvas's pixels is a fraction of one of its own; the drawing buffer's when
   *  the host has none to give. */
  draw(bolts, proj, view, eye, seen = BOLT_SEEN_M, viewH = 0) {
    this.drawn = 0;
    if (!bolts?.length) return;
    const verts = boltVertices(bolts, this.data);
    if (!verts) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uPx, 2 / (proj[5] * Math.max(1, viewH || gl.drawingBufferHeight)));   // proj[5] = 1 / tan(fov / 2)
    gl.uniform1f(U.uFar, farOf(proj));
    gl.uniform1f(U.uCore, BOLT_CORE_M); gl.uniform1f(U.uHalo, BOLT_HALO); gl.uniform1f(U.uMinPx, BOLT_MIN_PX);
    gl.uniform3fv(U.uColor, BOLT_COLOR); gl.uniform1f(U.uSeen, Math.max(1000, seen));
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, verts * BOLT_STRIDE));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = verts / 6;
  }
}
