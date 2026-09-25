// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-C (2026-09-25): ILIAC PUDDLE NO MORE'S TWO PASSES. The mod ships
// its own shaders (jet082's 1.2.2 bundle, GLCore programs read back to
// GLSL) and this pass is them, term for term:
//
//   SEAFLOOR (DeepWaters/Seafloor) - opaque, unlit, both faces: the
//     vertex colour's depth band shades a sand / mid / deep ramp (the
//     band to the gamma, the shelf by the coast distance, the swamp by
//     the climate band), the climate's texture over it at its strength
//     with a luminance lift, the night's ambient boost, the scene tint
//     while the camera is over the sea, and the world's fog.
//   SURFACE TOP (TransparentWaterSurfaceTop) - the surface texture
//     (TEXTURE.302 record 0, 128 repeats a pixel, scrolling) times the
//     time-adjusted tint, a fifth of the way to the tint's shade; its
//     alpha the tint's, rising to 1 with the water column behind it over
//     the vision distance; gone while the camera is under the surface.
//   SURFACE UNDERSIDE (TransparentWaterSurfaceUnderside) - drawn only
//     while the player's presentation is underwater: the same texture and
//     tint, to the horizon colour and opaque by the fade distances, a
//     third of the way to the fog colour by the column fog's strength.
//
// THE WATER COLUMN. The top's alpha reads Unity's camera depth texture:
// alpha = a + (1 - a) * min(behind / vision, 1), `behind` the eye depth
// of what the surface covers past the surface's own. The port's world
// pass has no depth texture to read on its classic set, so the same sum
// is split across the two draws (Port-Ledger A, the Iliac Puddle No More
// row): the floor - the one thing a carved sea covers - is itself carried
// toward the surface's colour by min(behind / vision, 1), with `behind`
// its own eye depth past the point its view ray crosses the sea, and the
// surface is then blended at alpha `a`. mix(mix(x, s, t), s, a) =
// mix(x, s, a + (1 - a) t): the same picture, on every lane, from the
// same numbers.
//
// GL DISCIPLINE (farRing.js's): a self-contained pass the host follows
// with renderer.markForeignPass(); depth tested LEQUAL; the floor writes
// depth, the surfaces do not (the top does once near-opaque, as the
// mod's ZWrite switch says). Colours are display colours on both lanes -
// the mod's materials are unlit, and what they write is what it shows.
// ═══════════════════════════════════════════════════════════════════

import { buildProgram } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';
import { SURFACE_TEXTURE_TILING, SURFACE_SCROLL, FLOOR_TEXTURE_WORLD_SCALE, FLOOR_SHADER_DEFAULTS } from '../world/deepWaterLook.js';

// THE COLUMN'S SHARE (the top's alpha, split - see above): what the top
// covers, carried toward the top's colour by min(behind / vision, 1). The
// floor takes it, and so does everything the mod draws under the sea that
// writes the depth texture the top reads (DW-E's decorations), each at its
// own fragment - the host's caller declares uCamPos and FOG_GLSL first.
export const COLUMN_GLSL = `
uniform sampler2D uSurfaceTex;
uniform vec3 uCamFwd;
uniform float uColumnOn;       // 1 while the camera is over the sea and the surfaces are drawn
uniform float uSeaY;           // the surface's world height
uniform vec4 uTopColor;        // the top's _Color (rgb tint, a alpha)
uniform float uTopVision;      // the top's _WaterSurfaceVisionDistance
uniform vec2 uSurfaceScroll;   // the top's texture offset now, in repeats
uniform vec3 uPixelOrigin;     // this pixel's world origin (the surface's uv is pixel-local)
vec3 dwColumn(vec3 col, vec3 worldPos) {
  if (uColumnOn > 0.5 && worldPos.y < uSeaY && uCamPos.y > worldPos.y) {
    // where the view ray crosses the sea, and the eye depth behind it
    vec3 toFrag = worldPos - uCamPos;
    float s = clamp((uSeaY - uCamPos.y) / min(toFrag.y, -1e-4), 0.0, 1.0);
    vec3 entry = uCamPos + toFrag * s;
    float behind = max(dot(worldPos - entry, uCamFwd), 0.0);
    float t = min(behind / max(uTopVision, 1.0), 1.0);
    vec2 uv = (entry.xz - uPixelOrigin.xz) / 819.2 * ${SURFACE_TEXTURE_TILING.toFixed(1)} + uSurfaceScroll;
    vec3 st = texture(uSurfaceTex, uv).rgb * uTopColor.rgb;
    st = mix(st, uTopColor.rgb * 0.32, 0.22);
    col = mix(col, st, t);
  }
  return col;
}`;

export const FLOOR_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec4 vColor;
out vec2 vUv;
out vec3 vWorldPos;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorldPos = w.xyz;
  vColor = aColor;
  vUv = aUv;
  gl_Position = uProj * uView * w;
}`;

// The Seafloor fragment program (no-fog variant, the fog after it as
// every world pass takes it), then the column's share of the top's alpha.
export const FLOOR_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uMainTex;
uniform vec3 uSandColor;
uniform vec3 uMidColor;
uniform vec3 uDeepColor;
uniform vec3 uSwampColor;
uniform float uTextureWorldScale;
uniform float uTextureStrength;
uniform float uShelfMix;
uniform float uDepthGamma;
uniform float uAmbientBoost;
uniform vec4 uSceneTint;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
${FOG_GLSL}
${COLUMN_GLSL}
void main() {
  vec2 cw = clamp(vColor.xw, 0.0, 1.0);
  float depth = exp2(log2(cw.x) * uDepthGamma);
  vec2 strength = vec2(cw.y * uTextureStrength) * vec2(0.35, 0.75);
  vec2 shelf = vec2(1.0, 0.7) - vColor.zy;
  float sand = clamp(shelf.x * uShelfMix - depth + 1.0, 0.0, 1.0);
  float swamp = clamp(shelf.y * 1.42857146, 0.0, 1.0) * 0.5;
  float deep = clamp(depth - shelf.x * uShelfMix * 0.5, 0.0, 1.0);
  float mid = max(1.0 - sand - deep, 0.0);
  vec3 col = mid * uMidColor + sand * uSandColor + deep * uDeepColor;
  col = mix(col, uSwampColor, swamp);
  vec3 tex = texture(uMainTex, vUv * uTextureWorldScale).rgb;
  col = mix(col, tex, strength.x);
  float lum = dot(tex, vec3(0.299, 0.587, 0.114)) * 0.9 - 0.45;
  col *= strength.y * lum + 1.0;
  col *= uAmbientBoost;
  col *= mix(vec3(1.0), uSceneTint.rgb, uSceneTint.a);
  col = mix(uFogColor, col, fogFactorAt(vWorldPos));
  col = dwColumn(col, vWorldPos);
  outColor = vec4(dwWaterFog(col, vWorldPos), 1.0);   // the distance fog, as every world pass takes it (off unless the camera is under)
}`;

export const SURFACE_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uLiftY;
uniform vec2 uSurfaceScroll;
out vec2 vUv;
out vec3 vWorldPos;
void main() {
  vec4 w = uModel * vec4(aPos.x, aPos.y + uLiftY, aPos.z, 1.0);
  vWorldPos = w.xyz;
  vUv = aUv * ${SURFACE_TEXTURE_TILING.toFixed(1)} + uSurfaceScroll;
  gl_Position = uProj * uView * w;
}`;

// TransparentWaterSurfaceTop, the camera-depth read taken out (the floor carries it - see above).
export const TOP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uMainTex;
uniform vec4 uColor;
uniform float uUnderwater;
uniform vec3 uCamPos;
out vec4 outColor;
void main() {
  if (uUnderwater > 0.5) discard;
  if (uCamPos.y - vWorldPos.y + 0.02 < 0.0) discard;
  vec3 col = texture(uMainTex, vUv).rgb * uColor.rgb;
  col = mix(col, uColor.rgb * 0.32, 0.22);
  float a = clamp(uColor.a, 0.0, 1.0);
  if (a - 0.001 < 0.0) discard;
  outColor = vec4(col, a);
}`;

// The top's other arm: where nothing opaque stands behind the surface (the
// cleared far plane - the sky, the far ring, the void past the streamed
// world) the C#'s depth read is 1e9 and the top is opaque. Tested against
// the depth buffer at the plane's edge, so it lands only there.
export const TOP_FAR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uMainTex;
uniform vec4 uColor;
uniform float uUnderwater;
uniform vec3 uCamPos;
out vec4 outColor;
void main() {
  if (uUnderwater > 0.5) discard;
  if (uCamPos.y - vWorldPos.y + 0.02 < 0.0) discard;
  vec3 col = texture(uMainTex, vUv).rgb * uColor.rgb;
  col = mix(col, uColor.rgb * 0.32, 0.22);
  gl_FragDepth = 0.99999;
  outColor = vec4(col, 1.0);
}`;

// TransparentWaterSurfaceUnderside.
export const UNDERSIDE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uMainTex;
uniform vec4 uColor;
uniform vec3 uUnderwaterFogColor;
uniform float uUndersideAlpha;
uniform vec3 uHorizonColor;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uColumnFogStrength;
uniform float uUnderwater;
uniform vec3 uCamPos;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  if (uUnderwater < 0.5) discard;
  vec3 d = vWorldPos - uCamPos;
  if (d.y + 0.02 < 0.0) discard;
  float fade = clamp((length(d) - uFadeStart) / (max(uFadeStart + 1.0, uFadeEnd) - uFadeStart), 0.0, 1.0);
  fade = fade * fade * (3.0 - 2.0 * fade);
  float a = min(max(fade, clamp(uUndersideAlpha, 0.0, 1.0)), 1.0);
  if (a - 0.001 < 0.0) discard;
  vec3 col = texture(uMainTex, vUv).rgb * uColor.rgb;
  col = mix(col, uHorizonColor, fade);
  col = mix(col, uUnderwaterFogColor, clamp(uColumnFogStrength, 0.0, 1.0) * 0.35);
  outColor = vec4(dwWaterFog(col, vWorldPos), a);   // the distance fog over it: the surface and all it shows share one capped ray
}`;

// DW-E2: THE DECORATIONS (DeepWaters/UnderwaterBillboardBatchUnlit), u_xlat
// for u_xlat. DFU's billboard-batch mesh layout: each billboard's four
// vertices at its CENTRE, the tangent (width, height, corner u, corner v);
// the vertex program stands the quad about the up vector, its right the
// normalised cross of the view's third column (UNITY_MATRIX_V._m02_m12_m22,
// DaggerfallBillboardBatch.shader's own "viewDirection") with the up - so it
// faces the camera as DFU's batches do, pitch quirk and all. Unlit: the
// texel times _Color (1.12), the cut-out, the scene tint; the forward pass
// takes no Unity fog (its other two programs are the shadow caster, and the
// decorations cast none), so the distance fog alone closes it (dwWaterFog).
// Seen from over the sea it takes the column's share, as the floor does:
// the batches write the depth texture the top reads (the mod's cut-out
// queue), so the top covers a weed by the water between it and the surface.
// The texture is an ARRAY - a record's frames its layers - and a billboard
// draws layer (start + tick) mod frames: DaggerfallBillboardBatch's
// per-billboard frame, advanced by its coroutine at FramesPerSecond.
//
// THE THREE FACINGS. The batches' is the program's own (above). The mod
// also puts the same material on single billboards, whose meshes (MeshReader
// .GetBillboardMesh) set no tangents - the object's own rotation is what
// faces those, and the port stands them by it: a DaggerfallBillboard (an animated replacement)
// turns to the camera's horizontal facing, the world's up kept (uFacing 1);
// a FaceY billboard (DW-E3's fish, DeepWaterRendering.FaceMainCamera) turns
// to the camera itself, its up the camera's (uFacing 2). The same corner
// offsets stand every one of them.
export const DECOR_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aTangent;
layout(location = 2) in float aStart;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uViewCol2;
uniform vec3 uUpVector;
uniform int uFacing;       // 0 the batch's, 1 a DaggerfallBillboard's, 2 FaceY's
uniform vec3 uCamRight;    // the camera's right (horizontal - the camera has no roll)
uniform vec3 uCamUp;       // the camera's up
out vec2 vUv;
out float vStart;
out vec3 vWorldPos;
void main() {
  vec3 right = uFacing == 0 ? normalize(cross(uViewCol2, uUpVector)) : uCamRight;
  vec3 up = uFacing == 2 ? uCamUp : uUpVector;
  vec2 corner = aTangent.zw - vec2(0.5);
  vec3 p = aPos + right * (corner.x * aTangent.x) + up * (corner.y * aTangent.y);
  vec4 w = uModel * vec4(p, 1.0);
  vWorldPos = w.xyz;
  vUv = aTangent.zw;
  vStart = aStart;
  gl_Position = uProj * uView * w;
}`;

export const DECOR_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUv;
in float vStart;
in vec3 vWorldPos;
uniform sampler2DArray uMainTex;
uniform vec4 uColor;
uniform float uCutoff;
uniform vec4 uSceneTint;
uniform float uTick;
uniform float uFrames;
uniform vec3 uCamPos;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
${COLUMN_GLSL}
void main() {
  vec4 t = texture(uMainTex, vec3(vUv, mod(vStart + uTick, uFrames)));
  if (t.w * uColor.w - uCutoff < 0.0) discard;
  vec3 tint = uSceneTint.www * (uSceneTint.xyz - vec3(1.0)) + vec3(1.0);
  vec3 col = dwColumn(t.xyz * uColor.xyz * tint, vWorldPos);   // the top's share over it, as over the floor
  outColor = vec4(dwWaterFog(col, vWorldPos), 1.0);
}`;

/** UnderwaterDecorationColor (1.12, 1.12, 1.12, 1) and the cut-out's default (the source material's _Cutoff where it has one). */
export const DECORATION_COLOR = Object.freeze([1.12, 1.12, 1.12, 1]);
export const DECORATION_CUTOFF = 0.5;

// THE SKY'S SHARE OF THE DISTANCE FOG. The mod's post effect takes every
// pixel of the camera's image, the sky included - where the depth read is
// the far plane (>= 0.9999) the ray's length is the band's own reach,
// V (3.6 - 2 strength), capped at the surface for a ray that climbs to it.
// Nothing the port draws there has a fragment of its own to fog (the sky
// and its decks write no depth, the far ring writes the far plane), so this
// pass lands on exactly those pixels - a full-screen triangle AT the far
// plane under LEQUAL - after the sky and the ring and before anything that
// blends over them. The fog is affine in the colour under it,
// c' = c * keep + add, and a blend can apply that: the first draw
// multiplies (ZERO, SRC_COLOR), the second adds (ONE, ONE), alpha kept.
export const SKY_FOG_VS = `#version 300 es
uniform vec3 uRayC;   // the view ray at the centre of the viewport, per unit of eye depth
uniform vec3 uRayX;   // and its change per NDC unit across
uniform vec3 uRayY;   // and up
out vec3 vRay;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vRay = uRayC + p.x * uRayX + p.y * uRayY;
  gl_Position = vec4(p, 1.0, 1.0);
}`;

export const SKY_FOG_FS = `#version 300 es
precision highp float;
in vec3 vRay;
uniform vec3 uCamPos;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform float uPass;   // 0 the multiplier, 1 the added colour
out vec4 outColor;
${FOG_GLSL}
void main() {
  vec3 dir = normalize(vRay);
  float toSurface = uDwFog[0].y - uCamPos.y;
  float d = (dir.y > 1e-4 && toSurface > 0.0) ? min(toSurface / dir.y, uDwFog[4].z) : uDwFog[4].z;
  float f = dwWaterClose(d);
  float k = uDwFog[2].w * (1.0 - f);
  if (uPass < 0.5) outColor = vec4(exp(-d * uDwFog[1].xyz) * k, 1.0);
  else outColor = vec4((1.0 - exp(-d * uDwFog[1].w)) * uDwFog[2].xyz * k + uDwFog[3].xyz * f, 0.0);
}`;

const locs = (gl, p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));

/** The pass: one per renderer, built on first use. */
export class DeepWatersRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this._programs = null;
    this._fwd = new Float32Array(3);
    this._stream = null;   // DW-E3: the moving billboards' streamed buffers
  }

  _ensure() {
    if (this._programs) return this._programs;
    const gl = this.gl;
    const floor = buildProgram(gl, FLOOR_VS, FLOOR_FS, 'deep waters seafloor');
    const top = buildProgram(gl, SURFACE_VS, TOP_FS, 'deep waters surface top');
    const topFar = buildProgram(gl, SURFACE_VS, TOP_FAR_FS, 'deep waters surface top (far plane)');
    const under = buildProgram(gl, SURFACE_VS, UNDERSIDE_FS, 'deep waters surface underside');
    const skyFog = buildProgram(gl, SKY_FOG_VS, SKY_FOG_FS, 'deep waters distance fog (sky)');
    const decor = buildProgram(gl, DECOR_VS, DECOR_FS, 'deep waters decorations');
    this._programs = {
      floor: { p: floor, u: locs(gl, floor, ['uProj', 'uView', 'uModel', 'uMainTex', 'uSurfaceTex', 'uSandColor', 'uMidColor', 'uDeepColor', 'uSwampColor',
        'uTextureWorldScale', 'uTextureStrength', 'uShelfMix', 'uDepthGamma', 'uAmbientBoost', 'uSceneTint',
        'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uCamFwd', 'uColumnOn', 'uSeaY', 'uTopColor', 'uTopVision', 'uSurfaceScroll', 'uPixelOrigin', 'uDwFog']) },
      top: { p: top, u: locs(gl, top, ['uProj', 'uView', 'uModel', 'uLiftY', 'uSurfaceScroll', 'uMainTex', 'uColor', 'uUnderwater', 'uCamPos']) },
      topFar: { p: topFar, u: locs(gl, topFar, ['uProj', 'uView', 'uModel', 'uLiftY', 'uSurfaceScroll', 'uMainTex', 'uColor', 'uUnderwater', 'uCamPos']) },
      under: { p: under, u: locs(gl, under, ['uProj', 'uView', 'uModel', 'uLiftY', 'uSurfaceScroll', 'uMainTex', 'uColor', 'uUnderwaterFogColor', 'uUndersideAlpha',
        'uHorizonColor', 'uFadeStart', 'uFadeEnd', 'uColumnFogStrength', 'uUnderwater', 'uCamPos', 'uDwFog']) },
      skyFog: { p: skyFog, u: locs(gl, skyFog, ['uRayC', 'uRayX', 'uRayY', 'uCamPos', 'uPass', 'uDwFog']) },
      decor: { p: decor, u: locs(gl, decor, ['uProj', 'uView', 'uModel', 'uViewCol2', 'uUpVector', 'uMainTex', 'uColor', 'uCutoff', 'uSceneTint',
        'uTick', 'uFrames', 'uCamPos', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog',
        'uSurfaceTex', 'uCamFwd', 'uColumnOn', 'uSeaY', 'uTopColor', 'uTopVision', 'uSurfaceScroll', 'uPixelOrigin', 'uFacing', 'uCamRight', 'uCamUp']) },
      empty: gl.createVertexArray(),   // the sky pass's triangle is gl_VertexID's
    };
    return this._programs;
  }

  /** One pixel's GPU half: the floor's and the surface's buffers. */
  create(result) {
    const gl = this.gl;
    const out = { floor: null, surface: null };
    const vao = (attrs, indices) => {
      const v = gl.createVertexArray();
      gl.bindVertexArray(v);
      const buffers = [];
      for (const [loc, data, size] of attrs) {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        buffers.push(b);
      }
      const ebo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      buffers.push(ebo);
      gl.bindVertexArray(null);
      return { vao: v, buffers, count: indices.length };
    };
    const f = result.floor;
    if (f && f.indices.length) out.floor = vao([[0, f.positions, 3], [1, f.colors, 4], [2, f.uvs, 2]], f.indices);
    const s = result.surface;
    if (s && s.indices.length) out.surface = vao([[0, s.positions, 3], [2, s.uvs, 2]], s.indices);
    this.renderer.markForeignPass?.();   // the VAO binds above are behind the renderer's back
    return out;
  }

  destroy(h) {
    if (!h) return;
    const gl = this.gl;
    for (const part of [h.floor, h.surface]) {
      if (!part) continue;
      for (const b of part.buffers) gl.deleteBuffer(b);
      gl.deleteVertexArray(part.vao);
    }
    h.floor = h.surface = null;
  }

  _frameUniforms(u, program) {
    const gl = this.gl, r = this.renderer;
    gl.uniformMatrix4fv(u.uProj, false, r._proj);
    gl.uniformMatrix4fv(u.uView, false, r._view);
    if (u.uCamPos) gl.uniform3fv(u.uCamPos, r._camPos);
    if (u.uDwFog) gl.uniform4fv(u.uDwFog, r._dwFog);   // the distance fog's frame (renderer.setWaterFog)
    if (program === 'floor') {
      gl.uniform3fv(u.uFogColor, r._fogColor);
      gl.uniform1i(u.uFogMode, r._fogMode);
      gl.uniform1f(u.uFogDensity, r._fogDensity);
      gl.uniform2fv(u.uFogRange, r._fogRange);
    }
  }

  /**
   * COLUMN_GLSL's frame: the camera's forward, the top's colour, vision
   * and scroll, and the surface texture on unit 1 (unit 0 is the caller's).
   * @param {Record<string, WebGLUniformLocation>} u
   * @param {{columnOn: boolean, seaY: number, topColor: number[], topVision: number, surfaceScroll: number[], surfaceTexture: ?WebGLTexture}} frame
   */
  _columnUniforms(u, frame) {
    const gl = this.gl, v = this.renderer._view;
    this._fwd[0] = -v[2]; this._fwd[1] = -v[6]; this._fwd[2] = -v[10];   // the camera's forward in world space: minus the view matrix's third row
    gl.uniform3fv(u.uCamFwd, this._fwd);
    gl.uniform1f(u.uColumnOn, frame.columnOn ? 1 : 0);
    gl.uniform1f(u.uSeaY, frame.seaY);
    gl.uniform4fv(u.uTopColor, frame.topColor);
    gl.uniform1f(u.uTopVision, frame.topVision);
    gl.uniform2fv(u.uSurfaceScroll, frame.surfaceScroll);
    gl.uniform1i(u.uSurfaceTex, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, frame.surfaceTexture ?? null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * The floors, opaque, after the streamed ground.
   * @param {Array<{h: any, model: Float32Array, origin: number[], material: {texture: ?WebGLTexture, strength: number, palette: {sand: number[], mid: number[], deep: number[], swamp: number[]}, ambientBoost: number}}>} list
   * @param {{sceneTint: number[], columnOn: boolean, seaY: number, topColor: number[], topVision: number, surfaceScroll: number[], surfaceTexture: ?WebGLTexture}} frame
   */
  drawFloors(list, frame) {
    if (!list.length) return;
    const gl = this.gl;
    const { floor } = this._ensure();
    const u = floor.u;
    gl.useProgram(floor.p);
    this._frameUniforms(u, 'floor');
    const d = FLOOR_SHADER_DEFAULTS;
    gl.uniform1f(u.uTextureWorldScale, FLOOR_TEXTURE_WORLD_SCALE);
    gl.uniform1f(u.uShelfMix, d.shelfMix);
    gl.uniform1f(u.uDepthGamma, d.depthGamma);
    gl.uniform4fv(u.uSceneTint, frame.sceneTint);
    this._columnUniforms(u, frame);
    gl.uniform1i(u.uMainTex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);   // Cull Off
    let lastTex;
    for (const it of list) {
      const part = it.h?.floor;
      if (!part) continue;
      const m = it.material;
      if (m.texture !== lastTex) { gl.bindTexture(gl.TEXTURE_2D, m.texture ?? null); lastTex = m.texture; }
      gl.uniform1f(u.uTextureStrength, m.texture ? m.strength : 0);
      gl.uniform3fv(u.uSandColor, m.palette.sand);
      gl.uniform3fv(u.uMidColor, m.palette.mid);
      gl.uniform3fv(u.uDeepColor, m.palette.deep);
      gl.uniform3fv(u.uSwampColor, m.palette.swamp);
      gl.uniform1f(u.uAmbientBoost, m.ambientBoost);
      gl.uniformMatrix4fv(u.uModel, false, it.model);
      gl.uniform3fv(u.uPixelOrigin, it.origin);
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
  }

  /**
   * The surfaces, blended, after every opaque thing and every cut-out flat
   * (the mod's Transparent queue): the top from above, the underside from
   * below - each program discards the other side itself.
   * @param {Array<{h: any, model: Float32Array}>} list
   * @param {Record<string, any>} frame - surfaceLook's values + {underwater, liftY, surfaceScroll, surfaceTexture}
   */
  drawSurfaces(list, frame) {
    if (!list.length || !frame.surfaceTexture) return;
    const gl = this.gl;
    const { top, topFar, under } = this._ensure();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frame.surfaceTexture);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    const pass = (prog, set, depthWrite) => {
      gl.useProgram(prog.p);
      const u = prog.u;
      this._frameUniforms(u, 'surface');
      gl.uniform1f(u.uLiftY, frame.liftY);
      gl.uniform2fv(u.uSurfaceScroll, frame.surfaceScroll);
      gl.uniform1i(u.uMainTex, 0);
      gl.uniform1f(u.uUnderwater, frame.underwater ? 1 : 0);
      set(u);
      gl.depthMask(depthWrite);
      for (const it of list) {
        const part = it.h?.surface;
        if (!part) continue;
        gl.uniformMatrix4fv(u.uModel, false, it.model);
        gl.bindVertexArray(part.vao);
        gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
      }
    };
    if (frame.underwater) {
      pass(under, (u) => {
        gl.uniform4fv(u.uColor, frame.undersideColor);
        gl.uniform3fv(u.uUnderwaterFogColor, frame.fogColor.slice(0, 3));
        gl.uniform1f(u.uUndersideAlpha, frame.undersideAlpha);
        gl.uniform3fv(u.uHorizonColor, frame.horizonColor.slice(0, 3));
        gl.uniform1f(u.uFadeStart, frame.undersideFadeStart);
        gl.uniform1f(u.uFadeEnd, frame.undersideFadeEnd);
        gl.uniform1f(u.uColumnFogStrength, frame.columnFogStrength);
      }, false);
    } else {
      pass(top, (u) => { gl.uniform4fv(u.uColor, frame.topColor); }, !!frame.topDepthWrite);
      gl.depthFunc(gl.LESS);
      pass(topFar, (u) => { gl.uniform4fv(u.uColor, frame.topColor); }, false);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
  }

  /**
   * DW-E2: a decoration texture - a record's frames as the layers of one
   * array (every frame the record's own size; a frame of another size ends
   * the array there), point-sampled over a mip chain as DFU's billboard
   * atlas is. `frames`: [{width, height, data: RGBA rows}].
   */
  createDecorationTexture(frames) {
    const gl = this.gl;
    const w = frames[0].width, h = frames[0].height;
    let n = 1;
    while (n < frames.length && frames[n].width === w && frames[n].height === h) n++;
    const bytes = new Uint8Array(w * h * 4 * n);
    for (let i = 0; i < n; i++) bytes.set(frames[i].data.subarray(0, w * h * 4), i * w * h * 4);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, w, h, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    this.renderer.markForeignPass?.();
    return { tex, frames: n };
  }

  deleteDecorationTexture(t) { if (t?.tex) this.gl.deleteTexture(t.tex); }

  /**
   * DW-E2: one pixel's decorations on the GPU - a VAO per group, a group
   * one texture: {texture: {tex, frames}, fps, born (s), facing (DECOR_VS's
   * uFacing, 0 when absent), billboards: [{centre: [x, y, z] pixel-local,
   * width, height, start}]}.
   */
  createDecorations(groups) {
    const gl = this.gl;
    const out = { groups: [] };
    for (const g of groups) {
      const n = g.billboards.length;
      if (!n || !g.texture) continue;
      const pos = new Float32Array(n * 12), tan = new Float32Array(n * 16), start = new Float32Array(n * 4);
      const idx = new Uint32Array(n * 6);
      const CORNERS = [[0, 1], [1, 1], [0, 0], [1, 0]];   // BuildMaterialBillboardBatchMesh's vertex order
      for (let i = 0; i < n; i++) {
        const b = g.billboards[i];
        for (let k = 0; k < 4; k++) {
          const v = i * 4 + k;
          pos[v * 3] = b.centre[0]; pos[v * 3 + 1] = b.centre[1]; pos[v * 3 + 2] = b.centre[2];
          tan[v * 4] = b.width; tan[v * 4 + 1] = b.height; tan[v * 4 + 2] = CORNERS[k][0]; tan[v * 4 + 3] = CORNERS[k][1];
          start[v] = b.start;
        }
        const v0 = i * 4;
        idx.set([v0, v0 + 1, v0 + 2, v0 + 3, v0 + 2, v0 + 1], i * 6);
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffers = [];
      for (const [loc, data, size] of [[0, pos, 3], [1, tan, 4], [2, start, 1]]) {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        buffers.push(b);
      }
      const ebo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      buffers.push(ebo);
      gl.bindVertexArray(null);
      out.groups.push({ vao, buffers, count: idx.length, texture: g.texture, fps: g.fps || 0, born: g.born || 0, facing: g.facing || 0, cutoff: g.cutoff ?? DECORATION_CUTOFF });
    }
    this.renderer.markForeignPass?.();
    return out;
  }

  destroyDecorations(h) {
    if (!h) return;
    const gl = this.gl;
    for (const g of h.groups) {
      for (const b of g.buffers) gl.deleteBuffer(b);
      gl.deleteVertexArray(g.vao);
    }
    h.groups = [];
  }

  /**
   * DW-E3: billboards that MOVE (the fish) - the same program, the same
   * groups, their centres in the world and written again every frame into
   * one set of streamed buffers (the pattern's indices kept, grown as the
   * count does). Returns a handle drawDecorations draws with an identity
   * model; valid until the next call.
   */
  streamDecorations(groups) {
    const gl = this.gl;
    let n = 0;
    for (const g of groups) if (g.texture) n += g.billboards.length;
    const st = this._stream ??= { vao: gl.createVertexArray(), pos: gl.createBuffer(), tan: gl.createBuffer(), start: gl.createBuffer(), ebo: gl.createBuffer(), cap: 0, handle: { groups: [] } };
    st.handle.groups = [];
    if (!n) return st.handle;
    gl.bindVertexArray(st.vao);
    if (n > st.cap) {
      st.cap = Math.max(n, st.cap * 2, 64);
      const idx = new Uint32Array(st.cap * 6);
      for (let i = 0; i < st.cap; i++) { const v0 = i * 4; idx.set([v0, v0 + 1, v0 + 2, v0 + 3, v0 + 2, v0 + 1], i * 6); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, st.ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      st.posData = new Float32Array(st.cap * 12); st.tanData = new Float32Array(st.cap * 16); st.startData = new Float32Array(st.cap * 4);
    } else gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, st.ebo);
    const CORNERS = [[0, 1], [1, 1], [0, 0], [1, 0]];
    let b = 0;
    for (const g of groups) {
      if (!g.texture || !g.billboards.length) continue;
      const first = b;
      for (const bb of g.billboards) {
        for (let k = 0; k < 4; k++) {
          const v = b * 4 + k;
          st.posData[v * 3] = bb.centre[0]; st.posData[v * 3 + 1] = bb.centre[1]; st.posData[v * 3 + 2] = bb.centre[2];
          st.tanData[v * 4] = bb.width; st.tanData[v * 4 + 1] = bb.height; st.tanData[v * 4 + 2] = CORNERS[k][0]; st.tanData[v * 4 + 3] = CORNERS[k][1];
          st.startData[v] = bb.start ?? 0;
        }
        b++;
      }
      st.handle.groups.push({ vao: st.vao, count: (b - first) * 6, offset: first * 6 * 4, texture: g.texture, fps: g.fps || 0, born: g.born || 0, facing: g.facing || 0, cutoff: g.cutoff ?? DECORATION_CUTOFF });
    }
    for (const [loc, buf, data, size] of [[0, st.pos, st.posData, 3], [1, st.tan, st.tanData, 4], [2, st.start, st.startData, 1]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 4 * size), gl.STREAM_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    this.renderer.markForeignPass?.();
    return st.handle;
  }

  /**
   * DW-E2: the decorations, cut-out and depth-writing (the AlphaTest queue
   * the mod's material takes), both faces.
   * @param {Array<{h: any, model: Float32Array, origin: number[]}>} list
   * @param {{sceneTint: number[], seconds: number, columnOn: boolean, seaY: number, topColor: number[], topVision: number, surfaceScroll: number[], surfaceTexture: ?WebGLTexture}} frame
   */
  drawDecorations(list, frame) {
    if (!list.length) return;
    const gl = this.gl, r = this.renderer;
    const { decor } = this._ensure();
    const u = decor.u, v = r._view;
    gl.useProgram(decor.p);
    this._frameUniforms(u, 'decor');
    // Unity's view matrix is (right, up, back) by rows; the port's lookAt is (-right, up, back) - its third column then
    gl.uniform3f(u.uViewCol2, -v[8], v[9], v[10]);
    gl.uniform3f(u.uUpVector, 0, 1, 0);
    gl.uniform3f(u.uCamRight, -v[0], -v[4], -v[8]);   // the lookAt's first row is minus the camera's right
    gl.uniform3f(u.uCamUp, v[1], v[5], v[9]);
    gl.uniform4fv(u.uColor, DECORATION_COLOR);
    gl.uniform4fv(u.uSceneTint, frame.sceneTint);
    gl.uniform1i(u.uFogMode, 0);
    this._columnUniforms(u, frame);
    gl.uniform1i(u.uMainTex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);   // Cull Off
    for (const it of list) {
      const groups = it.h?.groups;
      if (!groups?.length) continue;
      gl.uniformMatrix4fv(u.uModel, false, it.model);
      gl.uniform3fv(u.uPixelOrigin, it.origin);
      for (const g of groups) {
        gl.uniform1i(u.uFacing, g.facing);
        gl.uniform1f(u.uCutoff, g.cutoff ?? DECORATION_CUTOFF);   // DW-E3: a fish's is 0.1
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.texture.tex);
        gl.uniform1f(u.uFrames, g.texture.frames);
        gl.uniform1f(u.uTick, g.fps > 0 ? Math.floor((frame.seconds - g.born) * g.fps) : 0);
        gl.bindVertexArray(g.vao);
        gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, g.offset ?? 0);
      }
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
  }

  /**
   * The distance fog over the sky's pixels - after the sky and the far
   * ring, before the first thing blended over them. A no-op while the fog
   * is off. The rays are the view's own (the projection's mirror and any
   * off-centre shift included): per unit of eye depth, the camera's
   * forward plus right x (ndc.x + P[8]) / P[0] plus up x (ndc.y + P[9]) / P[5].
   */
  drawSkyFog() {
    const r = this.renderer;
    if (!(r._dwFog[0] > 0.5)) return;
    const gl = this.gl;
    const { skyFog, empty } = this._ensure();
    const u = skyFog.u, v = r._view, P = r._proj;
    const right = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]], fwd = [-v[2], -v[6], -v[10]];
    const cx = P[8] / P[0], cy = P[9] / P[5];
    gl.useProgram(skyFog.p);
    gl.uniform3f(u.uRayC, fwd[0] + right[0] * cx + up[0] * cy, fwd[1] + right[1] * cx + up[1] * cy, fwd[2] + right[2] * cx + up[2] * cy);
    gl.uniform3f(u.uRayX, right[0] / P[0], right[1] / P[0], right[2] / P[0]);
    gl.uniform3f(u.uRayY, up[0] / P[5], up[1] / P[5], up[2] / P[5]);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform4fv(u.uDwFog, r._dwFog);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(empty);
    gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE);
    gl.uniform1f(u.uPass, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.uniform1f(u.uPass, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
  }

  dispose() {
    const gl = this.gl;
    if (this._stream) {
      for (const b of [this._stream.pos, this._stream.tan, this._stream.start, this._stream.ebo]) gl.deleteBuffer(b);
      gl.deleteVertexArray(this._stream.vao);
      this._stream = null;
    }
    if (this._programs) {
      for (const k of Object.keys(this._programs)) if (this._programs[k]?.p) gl.deleteProgram(this._programs[k].p);
      gl.deleteVertexArray(this._programs.empty);
    }
    this._programs = null;
  }
}

/** The surface texture's offset now: _ScrollX, _ScrollY times Unity's _Time.y (seconds), in repeats. */
export function surfaceScrollAt(seconds) {
  return [SURFACE_SCROLL[0] * seconds, SURFACE_SCROLL[1] * seconds];
}
