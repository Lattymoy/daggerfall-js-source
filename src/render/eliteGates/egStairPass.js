// @ts-check
// EG-ZE (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 7 - THE STAIR, "what
// the swap shows"): THE SPIRE'S STAIR ON THE VEIL - chosen by theme in ui/gate/gateVeil.js beside Dagon's fire and the Hour's
// blades (render/gate/gateVeil.js keeps the clock's law: `veilAt` times this one too, run at the stair's own pace -
// world/eliteGates/egLights.js EG_STAIR_VEIL). One triangle over the veil's own canvas, as theirs:
//   THE FALL (a band's first hall - world/eliteGates/egLook.js egStairOf): EG-ZO - a camera falling past THE SPIRE'S UNDERSIDE, the
//     torn academy the halls fell from, MODELLED (world/eliteGates/egUnderside.js: built with the arc's one mesh kit in the band's own
//     dress, the camera's path and timing its law). The triangle paints the band's void as that camera sees it - the deep
//     below rising to meet the faller, embers streaking up past the eye - and the underside is drawn over it as a mesh,
//     depth-tested, lit from below by the band's deep (the sky's own light, render/eliteGates/egSkyPass.js - and the Shade's moon),
//     melting into the void with distance. EG-ZE painted it as a picture on this canvas; the picture is gone;
//   THE VEIL (every other step): the band's void, dim, its motes drifting up;
//   THE CUT (reduced motion - the port's row or the system's, ui/eliteGates/egAccess.js): the same void standing still.
// Each takes the screen in THE DITHER - the ordered Bayer pattern (render/orderedDither.js bayer4) against how much the
// veil has covered, a pixel all or nothing, so the world goes and comes back in the Spire's pixel art and never slides.
// Every pixel posterized through the same dither (the pixel law, SD_PIXEL_GLSL) in the band's own sky (world/eliteGates/egLook.js
// EG_SKIES - the sky the hall stands in); the canvas a third of the device's pixels, drawn pixelated. Output
// premultiplied. The hall it steps to is held centred over it by the veil's own label (ui/gate/gateVeil.js).
//
// EVERY ALLOCATION HAS AN OWNER: the two programs are the pass's (the veil's, freed with it - `destroy`); the underside's
// buffers and pictures are the fall's own (`upload` answers an EgUnderside that owns them, `destroy` frees every one -
// ui/gate/gateVeil.js frees it as the fall ends, every way it ends), and an upload that fails part way frees what it made.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { buildProgram } from '../glProgram.js';
import { BAYER_GLSL, SD_PIXEL_GLSL } from '../orderedDither.js';
import { sdSkyBasisInto } from '../superDungeon/sdSky.js';
import { EG_SKIES } from '../../world/eliteGates/egLook.js';
import { EG_DRESS } from '../../world/eliteGates/egBandArt.js';
import { EG_SKY_MOON } from './egSkyMap.js';   // EG-LOOK: the moon the sky paints

/** The stair's modes (ui/gate/gateVeil.js VEIL_EG_MODE): the full fall, the veil, the plain cut. */
export const EG_STAIR_MODE = Object.freeze({ fall: 0, veil: 1, cut: 2 });
/** THE FALL'S LOOK: how fast the deep rises to meet the faller (1/s - its share risen is 1 - e^(-rate t)), the embers'
 *  speed up the screen (half-heights a second), how dim the veil's void is, and the posterize's steps. */
export const EG_STAIR_LOOK = Object.freeze({ rate: 0.9, streak: 1.5, veilDim: 0.55, steps: 8 });
/** EG-ZO: THE UNDERSIDE'S LIGHT (render/eliteGates/egSkyPass.js's sky, its own colours): the deep's on a face looking down and on a
 *  face side-on, the horizon's on every face, the zenith's on a face looking up, the moon's (the Shade's - EG_SKIES
 *  `moon`) on a face toward it; the void's haze it melts into (exponential, 1/m); the embers' columns about the eye (a
 *  radian's worth). Stone and metal are structure and do not glow (SD-LOOK): nothing here is lit but by the place. */
export const EG_UNDERSIDE_LOOK = Object.freeze({ deep: 0.9, side: 0.22, hor: 0.3, zen: 0.5, moon: 0.55, fog: 0.004, azimuth: 2 });
/** The Shade's moon: its colour, and where it stands - EG-LOOK: the sky's own (render/eliteGates/egSkyMap.js EG_SKY_MOON, on the
 *  Shade's key light's bearing), so the fall sees the moon the halls do. */
export const EG_MOON = Object.freeze({ color: Object.freeze([0.62, 0.66, 0.74]), dir: EG_SKY_MOON.dir });

const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
const f4 = (v) => v.toFixed(4);
const unit = (c) => { const l = Math.hypot(c[0], c[1], c[2]); return c.map((v) => v / l); };

/** The deep's share risen to meet the faller after `t` seconds of the fall (0 at its first frame, toward 1). Pure - the
 *  shader's own law, pinned equal. */
export const egStairFallen = (t) => 1 - Math.exp(-Math.max(0, t) * EG_STAIR_LOOK.rate);

/** EG-ZO: THE BAND'S VOID, one text for both programs - the sky's own ramps, and the void along a ray of elevation e
 *  (its sine): the deep below, the band's own overhead. The underside melts into exactly what the triangle paints. */
export const EG_VOID_GLSL = `
const vec3 ZEN[4] = vec3[4](${EG_SKIES.map((s) => v3(s.zenith)).join(', ')});
const vec3 HOR[4] = vec3[4](${EG_SKIES.map((s) => v3(s.horizon)).join(', ')});
const vec3 DEEP[4] = vec3[4](${EG_SKIES.map((s) => v3(s.deep)).join(', ')});
const float EMBERS[4] = float[4](${EG_SKIES.map((s) => s.embers.toFixed(4)).join(', ')});
vec3 voidOf(float e, int b) { return e < 0.0 ? mix(HOR[b], DEEP[b], smoothstep(0.0, 1.0, -e)) : mix(HOR[b], ZEN[b], smoothstep(0.0, 0.8, e)); }
`;

export const EG_STAIR_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
export const EG_STAIR_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;       // the canvas, pixels
uniform float uTime;     // seconds since the veil began
uniform float uCover;    // how much of the screen the veil has taken (render/gate/gateVeil.js veilAt, at the stair's pace)
uniform float uMode;     // EG_STAIR_MODE
uniform int uBand;       // the band the step falls into
uniform vec3 uRight, uUp, uFwd;   // EG-ZO: the falling camera's axes (world/eliteGates/egUnderside.js egFallCamera)
uniform vec4 uLens;               // and its lens (render/superDungeon/sdSky.js sdSkyBasisInto)
out vec4 o;
${BAYER_GLSL}${SD_PIXEL_GLSL}${EG_VOID_GLSL}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// the deep's share risen after t seconds (egStairFallen)
float fallen(float t) { return 1.0 - exp(-max(0.0, t) * ${f4(EG_STAIR_LOOK.rate)}); }
// EG-ZO: where the falling camera's ray through pixel q points - (its bearing about the eye from straight ahead, the
// sine of its elevation): the void the triangle paints is the void the camera sees, its horizon the camera's
vec2 fallRay(vec2 q) {
  vec2 n = q / uRes * 2.0 - 1.0;
  vec3 d = normalize(uRight * ((n.x + uLens.z) / uLens.x) + uUp * ((n.y + uLens.w) / uLens.y) + uFwd);
  return vec2(atan(dot(d, uRight), dot(d, uFwd)) * ${f4(EG_UNDERSIDE_LOOK.azimuth)}, d.y);
}
// what the stair shows at p (screen half-heights, the middle at 0 - in the fall the camera's ray, fallRay) after t
// seconds, in band b
vec3 stairScene(vec2 p, float t, int b, float mode) {
  float e = p.y;
  vec3 c = voidOf(e, b);
  if (mode < 0.5) {
    // THE FALL: the deep rising to meet the faller, embers streaking up past the eye (the underside is the model's)
    float k = fallen(t);
    c += DEEP[b] * 0.35 * k * smoothstep(0.0, 1.0, -e);   // never a reversed edge (SD20c V14)
    vec2 g = vec2(p.x * 26.0, e * 6.0 - t * ${f4(EG_STAIR_LOOK.streak * 6)});
    float r = h21(floor(g));
    if (r > 0.9 && abs(fract(g.x) - 0.5) < 0.08) c += DEEP[b] * 0.7 * fract(g.y);
    return c;
  }
  // THE VEIL and THE CUT: the band's void, dim; the veil's motes drifting up, the cut's standing still
  c *= ${f4(EG_STAIR_LOOK.veilDim)};
  if (EMBERS[b] > 0.0) {
    vec2 g = vec2(p.x * 30.0, e * 30.0 - (mode < 1.5 ? t * 0.8 : 0.0));
    if (h21(floor(g)) > 1.0 - 0.03 * EMBERS[b] && length(fract(g) - 0.5) < 0.2) c += DEEP[b] * 0.5;
  }
  return c;
}
void main() {
  vec2 px = floor(gl_FragCoord.xy);
  // THE DITHER: a pixel the veil has not yet taken shows the world under it
  if (bayer4(px) >= uCover) { o = vec4(0.0); return; }
  vec2 p = uMode < 0.5 ? fallRay(gl_FragCoord.xy) : (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);   // EG-ZO: the fall's, the camera's
  vec3 c = stairScene(p, uTime, clamp(uBand, 0, 3), uMode);
  o = vec4(sdPixel(c, px, ${f4(EG_STAIR_LOOK.steps)}), 1.0);
}`;

/** EG-ZO: THE UNDERSIDE'S PROGRAM - the model (world/eliteGates/egUnderside.js) through the falling camera; its pictures the band's
 *  own (world/eliteGates/egBandArt.js), one a draw. */
export const EG_UNDERSIDE_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj, uView;
out vec3 vPos;
out vec3 vN;
out vec2 vUv;
void main() { vPos = aPos; vN = aNormal; vUv = aUv; gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
export const EG_UNDERSIDE_FS = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vN;
in vec2 vUv;
uniform sampler2D uTex;  // the record's picture
uniform vec3 uEye;       // the falling camera
uniform float uCover;    // how much of the screen the veil has taken
uniform int uBand;       // the band the step falls into
out vec4 o;
${BAYER_GLSL}${SD_PIXEL_GLSL}${EG_VOID_GLSL}
const float MOONS[4] = float[4](${EG_SKIES.map((s) => (s.moon ? 1 : 0).toFixed(1)).join(', ')});
const vec3 MOON = ${v3(EG_MOON.color)};
const vec3 MOON_DIR = ${v3(unit(EG_MOON.dir))};
// the place's light on a face of normal n in band b: the deep from below, the horizon all round, the zenith from above,
// the moon where it stands - nothing glows
vec3 litBy(vec3 n, int b) {
  vec3 l = DEEP[b] * (${f4(EG_UNDERSIDE_LOOK.deep)} * max(0.0, -n.y) + ${f4(EG_UNDERSIDE_LOOK.side)} * (1.0 - abs(n.y)))
    + HOR[b] * ${f4(EG_UNDERSIDE_LOOK.hor)} + ZEN[b] * ${f4(EG_UNDERSIDE_LOOK.zen)} * max(0.0, n.y);
  return l + MOON * ${f4(EG_UNDERSIDE_LOOK.moon)} * MOONS[b] * max(0.0, dot(n, MOON_DIR));
}
// the face at p (its normal n, its picture's colour alb) as the eye sees it: lit, and melting into the band's void
// along the eye's ray with distance
vec3 undersideAt(vec3 p, vec3 n, vec3 alb, vec3 eye, int b) {
  vec3 r = p - eye;
  float d = max(length(r), 1e-4);
  return mix(voidOf(r.y / d, b), alb * litBy(n, b), exp(-d * ${f4(EG_UNDERSIDE_LOOK.fog)}));
}
void main() {
  vec2 px = floor(gl_FragCoord.xy);
  if (bayer4(px) >= uCover) discard;   // THE DITHER: the world shows where the veil has not yet taken
  int b = clamp(uBand, 0, 3);
  vec3 c = undersideAt(vPos, normalize(vN), texture(uTex, vUv).rgb, uEye, b);
  o = vec4(sdPixel(c, px, ${f4(EG_STAIR_LOOK.steps)}), 1.0);
}`;

/** EG-ZO: THE UNDERSIDE ON THE GPU - the fall's own: its vertex array, its three vertex buffers and its index buffer (the
 *  pack's Uint32 indices), a picture a record, and each sub-mesh's draw. `destroy()` frees every one of them, once. */
export class EgUnderside {
  /** @param {WebGL2RenderingContext} gl @param {any} model @param {Map<number, WebGLTexture>} tex @param {{ vao: any, bufs: any[] }} vb */
  constructor(gl, model, tex, vb) {
    this.gl = gl; this.tex = tex; this.vao = vb.vao; this.bufs = vb.bufs;
    this.subMeshes = model.subMeshes.map((s) => ({ rec: s.textureRecord, start: s.startIndex, count: s.primitiveCount * 3 }));
    this.live = true;
  }
  destroy() {
    if (!this.live) return;
    this.live = false;
    const gl = this.gl;
    for (const b of this.bufs) gl.deleteBuffer(b);
    if (this.vao) gl.deleteVertexArray(this.vao);
    for (const t of this.tex.values()) gl.deleteTexture(t);
  }
}

/** The stair's pass, one triangle over the veil's canvas. `draw(w, h, t, v, look)` - `v` a veilAt answer (its `cover`),
 *  `look` `{ mode, band, cam, under }`: EG-ZO - in the fall, `cam` the falling camera (world/eliteGates/egUnderside.js egFallCamera)
 *  and `under` the underside uploaded (`upload`), drawn over the void; null while it is still being made. */
export class EgStairRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.prog = buildProgram(gl, EG_STAIR_VS, EG_STAIR_FS, 'eg stair');
    this.u = {};
    for (const n of ['uRes', 'uTime', 'uCover', 'uMode', 'uBand', 'uRight', 'uUp', 'uFwd', 'uLens']) this.u[n] = gl.getUniformLocation(this.prog, n);
    /** EG-ZO: the underside's program (built at the first upload and kept with the pass), whether it would not build, its
     *  uniforms, and the camera's ray basis (filled each frame, nothing made) */
    this.under = null; this.underBroken = false; this.uu = {};
    this._basis = { right: new Float32Array(3), up: new Float32Array(3), fwd: new Float32Array(3), lens: new Float32Array(4) };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
  }
  draw(w, h, t, v, look) {
    const gl = this.gl, U = this.u, cam = look?.mode === EG_STAIR_MODE.fall ? look?.cam ?? null : null;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(cam ? gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT : gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uCover, v.cover);
    gl.uniform1f(U.uMode, look?.mode ?? EG_STAIR_MODE.veil);
    gl.uniform1i(U.uBand, (look?.band ?? 0) | 0);
    if (cam) {   // EG-ZO: the void as the falling camera sees it
      const B = sdSkyBasisInto(cam.view, cam.proj, this._basis);
      gl.uniform3fv(U.uRight, B.right); gl.uniform3fv(U.uUp, B.up); gl.uniform3fv(U.uFwd, B.fwd); gl.uniform4fv(U.uLens, B.lens);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    if (cam && look.under?.live && this.under) this.drawUnderside(look.under, cam, v.cover, (look.band ?? 0) | 0);
  }
  /** EG-ZO: THE UNDERSIDE drawn over the void through the falling camera - depth-tested and written, its back faces
   *  culled, a sub-mesh a picture - and the state given back. */
  drawUnderside(under, cam, cover, band) {
    const gl = this.gl, U = this.uu;
    gl.useProgram(this.under);
    gl.uniformMatrix4fv(U.uProj, false, cam.proj); gl.uniformMatrix4fv(U.uView, false, cam.view);
    gl.uniform3fv(U.uEye, cam.eye);
    gl.uniform1f(U.uCover, cover);
    gl.uniform1i(U.uBand, band);
    gl.uniform1i(U.uTex, 0);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(under.vao);
    for (const s of under.subMeshes) {
      const tex = under.tex.get(s.rec);
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_INT, s.start * 4);
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
  }
  /**
   * EG-ZO: THE UNDERSIDE UPLOADED - `parts` world/eliteGates/egUnderside.js egUndersideParts' made whole (its `model` and its `art`,
   * `[record, { albedo }]`): the program built the first time (kept with the pass; one that will not build is never tried
   * again), the model's buffers and a picture a record (nearest up close - the Spire's pixel art - and mipmapped far off;
   * the strata clamped top to tip). An EgUnderside, the caller's to destroy; null - and nothing held - where any of it
   * would not build.
   */
  upload(parts) {
    const gl = this.gl;
    if (!this.under && !this.underBroken) {
      try {
        this.under = buildProgram(gl, EG_UNDERSIDE_VS, EG_UNDERSIDE_FS, 'eg underside');
        for (const n of ['uProj', 'uView', 'uEye', 'uCover', 'uBand', 'uTex']) this.uu[n] = gl.getUniformLocation(this.under, n);
      } catch (e) { console.warn('[eg] the underside would not build', e?.message ?? e); this.underBroken = true; this.under = null; }
    }
    if (!this.under || !parts?.model) return null;
    const m = parts.model, tex = new Map(), bufs = [];
    let vao = null;
    try {
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      for (const [loc, data, size] of /** @type {Array<[number, Float32Array, number]>} */ ([[0, m.positions, 3], [1, m.normals, 3], [2, m.uvs, 2]])) {
        const b = gl.createBuffer();
        bufs.push(b);
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      const ib = gl.createBuffer();
      bufs.push(ib);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      for (const [rec, art] of parts.art) {
        const img = art.albedo, t = gl.createTexture();
        tex.set(rec, t);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rec === EG_DRESS.root ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
      return new EgUnderside(gl, m, tex, { vao, bufs });
    } catch (e) {
      console.warn('[eg] the underside would not upload', e?.message ?? e);
      new EgUnderside(gl, m, tex, { vao, bufs }).destroy();   // what was made is freed
      return null;
    }
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.prog);
    if (this.under) gl.deleteProgram(this.under);   // EG-ZO: the underside's program, kept with the pass
    this.under = null;
  }
}
