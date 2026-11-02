// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CSA-F (2026-09-27): COME SAIL AWAY'S WAVES, DRAWN - the wave object's
// mesh (systems/comeSailAway/comeSailAwayWaves.js) on the bundle's CurrentMaterial, its
// shader Daggerfall/Dither/Wave as the bundle's compiled program has it:
//
//   - the frame, tiled ten times each way (_MainTex_ST), point-sampled and
//     repeating, cut out below half its alpha times the tint's (_Cutoff);
//   - dithered out across the strip: the raw uv's v (the tiled one over
//     ten) folded about a half, `1 - x^2(3 - 2x)` of its span from
//     _DitherStart to _DitherEnd (LoadSettings' Fade and Length), against
//     the 8x8 Bayer threshold at the screen pixel (_DitherPattern, point,
//     one texel a pixel);
//   - tinted (0.5, 0.75, 1), Lambert-lit and fogged (the FORWARDBASE pass's
//     FOG_LINEAR / FOG_EXP / FOG_EXP2 variants), opaque, writing its depth,
//     back faces culled (Unity's winding, the port's world projection);
//   - (FIELD BUGS 2026-09-29 (the sea) #4) in its place in the sea's stack of
//     sheets in window depth: over the ground and the surface film
//     (render/waterSurface.js WATER_LAYER_UNITS).
//
// THE FRAME IS COMPOSED WHERE IT IS SAMPLED. Each of the 32 frames is one of
// the author's two paints scrolled down its rows, the paint's key colour
// standing for Daggerfall's snow (TEXTURE.303 record 1) tiled under it
// (formats/derivedTexture.js composeTiledPicture - the frame is a render of
// game data, so it is rebuilt from the player's ARENA2, never shipped). The
// shader does that composition for the one texel a fragment samples - the
// same integer arithmetic, point-sampled either way - so the port uploads
// the two paints and the snow, not 32 frames of 640x640.
//
// FIELD BUGS 2026-09-29 (the sea) #4 - AND FROM AFAR, THE CHAIN'S TEXEL. The
// mod's frames carry one level (m_MipCount 1), so a strip seen from a few
// hundred metres picked one texel of dozens a pixel and boiled as the deck
// bobbed the camera. Each paint is uploaded as its chain instead
// (systems/comeSailAway/comeSailAwayWaves.js wavePaintLevels): level 0 the paint itself,
// and past it the mean of the frame it composes, premultiplied - the snow at
// its record's mean. The shader picks the level NEAREST_MIPMAP_NEAREST would
// (GL ES 3.0 3.8.10, from the texel footprint): at level 0 - a texel a pixel
// and nearer - the mod's own read and cut, texel for texel; past it one fetch
// of the chain, its coverage dithered by the material's own Bayer table (a hard
// cut at a level's mean would fill the strip solid). A departure, in the
// Port-Ledger's Come Sail Away row.
//
// LIT AS THE PORT LIGHTS ITS FLATS (Port-Ledger, the Come Sail Away row):
// the scene's ambient plus the sun's Lambert term, where Unity's forward
// path adds its spherical-harmonic ambient, its vertex lights and the
// screen-space shadow.
// ═══════════════════════════════════════════════════════════════════

import { buildProgram, startPrograms } from './glProgram.js';
import { FOG_GLSL } from './fogGlsl.js';
import { BAYER_8X8, WAVE_MATERIAL, wavePaintLevels, wavePictureMean } from '../systems/comeSailAway/comeSailAwayWaves.js';
import { WATER_LAYER_UNITS } from './waterSurface.js';   // FIELD BUGS 2026-09-29 (the sea) #4: the breakers' place in the sea's stack
import { quatRotateInto } from '../world/quat.js';   // SHIP-FLAGS: quatRotate's answer, written in place
const _flagP = [0, 0, 0], _flagN = [0, 0, 0];   // SHIP-FLAGS: the flag cubes' two scratch turns

const WAVE_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uOrigin;
uniform float uScale;
uniform vec2 uTile;
out vec2 vUv;
out vec3 vNormal;
out vec3 vWorldPos;
void main() {
  vec3 w = uOrigin + aPos * uScale;   // the wave object: its position, 819.2 to a unit, no rotation
  vWorldPos = w;
  vNormal = aNormal;                  // a uniform scale turns no normal
  vUv = aUv * uTile;                  // TRANSFORM_TEX: _MainTex_ST (10, 10, 0, 0)
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

export const WAVE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
in vec3 vNormal;
in vec3 vWorldPos;
uniform highp sampler2D uPaint;   // the frame's paint, its rows top-down as the picture has them (#4: its chain - past level 0 the frame's means)
uniform highp sampler2D uSnow;    // TEXTURE.303 record 1, top-down
uniform ivec2 uFrameSize;
uniform ivec2 uSnowSize;
uniform int uLastLevel;           // #4: the chain's last level
uniform int uScroll;
uniform ivec2 uTileOffset;
const float BAYER[64] = float[64](${BAYER_8X8.map((v) => `${v}.0`).join(', ')});   // _DitherPattern's red, unorm8
uniform vec4 uColor;
uniform float uCutoff;
uniform float uDitherStart;
uniform float uDitherEnd;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
int wrapi(int a, int n) { int m = a % n; return m < 0 ? m + n : m; }
// #4: the level NEAREST_MIPMAP_NEAREST picks (GL ES 3.0 3.8.10-11, the magnification filter NEAREST): lambda from the
// texel footprint along the unwrapped uv, level 0 at magnification and to half a level past it
int waveLevel(vec2 uv) {
  vec2 t = uv * vec2(uFrameSize);
  vec2 dx = dFdx(t), dy = dFdy(t);
  float lambda = min(0.5 * log2(max(dot(dx, dx), dot(dy, dy))), 32.0);   // bounded: int() of an infinity is undefined
  return lambda > 0.5 ? min(int(ceil(lambda + 0.5)) - 1, uLastLevel) : 0;
}
// #4: a level-0 texel's texel at level L - floor((c + 0.5) * size_L / size_0), the map the chain was built by
ivec2 atLevel(ivec2 c, ivec2 size0, ivec2 sizeL) { return min(ivec2((vec2(c) + 0.5) * vec2(sizeL) / vec2(size0)), sizeL - 1); }
// the frame's texel under uv - composeTiledPicture's pixel: Unity's point sample with Repeat picks texel
// floor(frac(uv) * size), its row 0 the picture's bottom. Premultiplied, its alpha the frame's coverage there (level 0's
// 0 or 1 - the paint's own alpha is 0 or 255 in every one of the author's texels); #4: past level 0, the chain's mean
vec4 waveTexel(vec2 uv, int L) {
  ivec2 t = clamp(ivec2(floor(fract(uv) * vec2(uFrameSize))), ivec2(0), uFrameSize - 1);
  int x = t.x;
  int y = uFrameSize.y - 1 - t.y;
  ivec2 at = ivec2(x, wrapi(y + uScroll, uFrameSize.y));
  if (L > 0) return texelFetch(uPaint, atLevel(at, uFrameSize, textureSize(uPaint, L)), L);
  vec4 p = texelFetch(uPaint, at, 0);
  if (p == vec4(1.0, 0.0, 1.0, 1.0)) {   // the key, ff00ffff: the record's pixel, opaque
    vec3 s = texelFetch(uSnow, ivec2(wrapi(x + uTileOffset.x, uSnowSize.x), wrapi(y + uTileOffset.y, uSnowSize.y)), 0).rgb;
    return vec4(s, 1.0);
  }
  return vec4(p.rgb * p.a, p.a);
}
void main() {
  int L = waveLevel(vUv);   // #4: before any discard - the derivatives are the quad's
  float d = abs(vUv.y * 0.100000001 - 0.5) * 2.0 - uDitherStart;
  float x = clamp(d * (1.0 / (uDitherEnd - uDitherStart)), 0.0, 1.0);
  float a = 1.0 - (3.0 - 2.0 * x) * (x * x);
  ivec2 px = ivec2(gl_FragCoord.xy) & 7;
  if (a - BAYER[px.y * 8 + px.x] / 255.0 < 0.0) discard;
  vec4 tex = waveTexel(vUv, L);
  if (L == 0) {
    if (tex.a * uColor.a - uCutoff < 0.0) discard;
  } else if (tex.a * uColor.a - BAYER[((px.y + 4) & 7) * 8 + ((px.x + 4) & 7)] / 255.0 < 0.0) discard;   // #4: a minified texel's coverage, dithered
  vec4 c = vec4(tex.rgb / tex.a, tex.a) * uColor;
  vec3 lit = c.rgb * (uAmbient + uSunColor * (uSunScale * max(dot(vNormal, uLightDir), 0.0)));
  outColor = vec4(dwWaterFog(mix(uFogColor, lit, fogFactorAt(vWorldPos)), vWorldPos), c.a);   // and Iliac Puddle No More's water, under it
}`;

// ── CSA-F: the particles (world/unityParticles.js), as their ParticleSystemRenderers draw them ──
// HorizontalBillboard quads flat on the water, turned by each particle's rotation about the vertical, no larger than
// the renderer's maxParticleSize of the view's height; the flag's Mesh particles are Unity's cube, sized per axis and
// turned by the system's rotation and their own. Three materials: WakeMaterial (Daggerfall/BillboardWaterMasked - its
// splash cut out at half alpha, Lambert-lit, depth written, back faces culled), Default-Particle (Legacy
// Particles/Alpha Blended Premultiply - `tex * colour * colour.a` added over the frame, no depth, no fog, both faces;
// the port's own soft dot for Unity's built-in picture) and FlagMaterial (Daggerfall/Default: orange, opaque, lit).
const PART_VS = `#version 300 es
layout(location = 0) in vec3 aCentre;
layout(location = 1) in vec2 aCorner;
layout(location = 2) in vec3 aSizeRotMax;   // size, rotation (radians), maxParticleSize
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCamPos;
uniform float uViewScale;   // 2 / cot(fov / 2): the view's height in world units per unit of distance
out vec2 vUv;
out vec3 vWorldPos;
void main() {
  float d = max(length(aCentre - uCamPos), 1e-3);
  float size = min(aSizeRotMax.x, aSizeRotMax.z * uViewScale * d);
  float c = cos(aSizeRotMax.y), s = sin(aSizeRotMax.y);
  vec2 k = vec2(c * aCorner.x - s * aCorner.y, s * aCorner.x + c * aCorner.y) * size;
  vec3 w = aCentre + vec3(k.x, 0.0, k.y);   // flat, facing up
  vWorldPos = w;
  vUv = vec2(aCorner.x + 0.5, 0.5 - aCorner.y);   // the picture's top row at the quad's -z edge (uploaded top-down)
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;
export const PART_CUT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform vec4 uColor;
uniform float uCutoff;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  vec4 t = texture(uTex, vUv);
  if (t.a * uColor.a - uCutoff < 0.0) discard;
  vec4 c = t * uColor;
  vec3 lit = c.rgb * (uAmbient + uSunColor * (uSunScale * max(uLightDir.y, 0.0)));   // the quad's normal is up
  outColor = vec4(dwWaterFog(mix(uFogColor, lit, fogFactorAt(vWorldPos)), vWorldPos), c.a);
}`;
export const PART_PREMUL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vWorldPos;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec4 c = vec4(1.0);   // the particles' start colour, white
  outColor = texture(uTex, vUv) * c * c.a;
}`;
const CUBE_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vNormal;
out vec3 vWorldPos;
void main() {
  vWorldPos = aPos;
  vNormal = aNormal;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;
export const CUBE_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
uniform vec4 uColor;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform float uSunScale;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
out vec4 outColor;
${FOG_GLSL}
void main() {
  vec3 lit = uColor.rgb * (uAmbient + uSunColor * (uSunScale * max(dot(normalize(vNormal), uLightDir), 0.0)));
  outColor = vec4(dwWaterFog(mix(uFogColor, lit, fogFactorAt(vWorldPos)), vWorldPos), 1.0);
}`;
/** Unity's built-in cube: six faces, each two triangles wound as Unity's (their cross product along the face's outward normal). */
const CUBE_FACES = [
  { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, 0, 1], u: [-1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
];
/** The cube's 36 corners (unit cube about the origin) and their normals, each face's triangles wound so that
 *  cross(b - a, c - a) points out. */
export const CUBE_TRIANGLES = (() => {
  const out = [];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const { n, u, v } of CUBE_FACES) {
    const corner = (su, sv) => [0, 1, 2].map((i) => n[i] * 0.5 + u[i] * su * 0.5 + v[i] * sv * 0.5);
    let q = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const c = cross([q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]]);
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) q = [q[0], q[3], q[2], q[1]];
    for (const i of [0, 1, 2, 0, 2, 3]) out.push({ p: q[i], n });
  }
  return out;
})();
/**
 * NAV-B (2026-09-28): the flags in RUNS OF ONE COLOUR, in the order each colour first flies - a sea ship's flag
 * particle carries her faction's `color` (systems/naval/navalShips.js NAVAL_FACTIONS' `flag`: the pirates' black, a
 * merchantman's gold, a navy's red), a player's boat none (FlagMaterial's own orange, the mod's). One upload, one draw a run.
 * @param {any[]} flags
 * @returns {{ color: number[] | null, list: any[] }[]}
 */
export function flagRuns(flags) {
  const runs = new Map();
  for (const q of flags) {
    const key = Array.isArray(q.color) ? q.color.join(',') : '';
    let run = runs.get(key);
    if (!run) { run = { color: Array.isArray(q.color) ? q.color : null, list: [] }; runs.set(key, run); }
    run.list.push(q);
  }
  return [...runs.values()];
}
/**
 * The port's own stand-in for Unity's Default-Particle picture: a soft white disc (Port-Ledger, declared), PREMULTIPLIED
 * - its colour is its coverage (rgb = alpha), as the one material that samples it needs. That material is the drops'
 * "Alpha Blended Premultiply" (PART_PREMUL_FS: the texel times the premultiplied particle colour, blended One
 * OneMinusSrcAlpha), whose `One` takes the texel's rgb WHOLE: a disc white to its clear rim (rgb 255 where alpha is
 * 0) added full white over every pixel of the quad - each oar's and rudder's drop a white square on the sea. Found by
 * the naval arc (NAV-B, 2026-09-28), whose ships row and splash through this same pass.
 */
export function softParticleTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
    const r = Math.min(1, Math.hypot(dx, dy));
    const a = Math.round(255 * Math.pow(1 - r, 2));
    const i = (y * size + x) * 4;
    data[i] = a; data[i + 1] = a; data[i + 2] = a; data[i + 3] = a;   // white, premultiplied
  }
  return { width: size, height: size, data };
}

const locs = (gl, p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
const LIGHT_FOG = ['uAmbient', 'uSunColor', 'uSunScale', 'uLightDir', 'uCamPos', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus', 'uJungleHaze'];   // TV1: and the travel view's focus (fogGlsl.js FOCUS_GLSL)

/** #4: a chain of levels (systems/comeSailAway/comeSailAwayWaves.js wavePaintLevels), every level uploaded - texelFetch reads it,
 *  at a level the shader picks. */
const uploadLevels = (gl, levels) => {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  levels.forEach((l, i) => gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA8, l.width, l.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, l.data));
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, levels.length - 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);   // complete; texelFetch names its own level
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
};

const uploadPicture = (gl, pic) => {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pic.width, pic.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pic.data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);   // texelFetch reads it; no filter, no mips
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
};

/** Come Sail Away's own passes, on the world renderer they draw beside. */
/** SHADER-STALL: the particles' three programs (cut out, premultiplied, the cube) and the waves' one, as _ensurePart and
 *  _ensureWave build them - what the warm starts ahead of the build (warmSteps; render/glProgram.js startPrograms). */
export const CSA_PART_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[PART_VS, PART_CUT_FS], [PART_VS, PART_PREMUL_FS], [CUBE_VS, CUBE_FS]]));
export const CSA_WAVE_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[WAVE_VS, WAVE_FS]]));

export class ComeSailAwayRenderer {
  /** @param {any} renderer - render/renderer.js's (its frame's matrices, light and fog are these passes' too) */
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this._wave = null;
    /** @type {{ paints: WebGLTexture[], lastLevel: number, snow: WebGLTexture, snowSize: number[], specs: any[] } | null} */
    this._frames = null;
    this._mesh = null;   // the mesh uploaded, and the one it was uploaded from
    this._part = null;
    /** @type {Map<string, WebGLTexture>} */ this._partTex = new Map();
  }

  /** A particle material's picture (top-down RGBA, as decoded), point-sampled and clamped as its import has it. */
  setParticleTexture(name, pic, { linear = false } = {}) {
    const gl = this.gl;
    const tex = uploadPicture(gl, pic);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const filter = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const old = this._partTex.get(name);
    if (old) gl.deleteTexture(old);
    this._partTex.set(name, tex);
    this.renderer.markForeignPass?.();
  }
  hasParticleTexture(name) { return this._partTex.has(name); }

  /** PERF-COMPILE1's idle warm of the sea's four programs (scenes/world.js warmPrograms) - SHADER-STALL: each build once
   *  the driver says its programs are done (render/warmPrograms.js's named steps), never an idle task waiting on them. */
  warmSteps() {
    return [
      { start: () => startPrograms(this.gl, CSA_PART_PROGRAMS), run: () => { this._ensurePart(); }, need: () => !this._part },   // AUDIT SHADER-STALL: built by a draw first, the warm stands down
      { start: () => startPrograms(this.gl, CSA_WAVE_PROGRAMS), run: () => { this._ensureWave(); }, need: () => !this._wave },
    ];
  }

  _ensurePart() {
    if (this._part) return this._part;
    const gl = this.gl;
    const [cutSrc, preSrc, cubeSrc] = CSA_PART_PROGRAMS;
    const cut = buildProgram(gl, cutSrc[0], cutSrc[1], 'come sail away particles (cut out)');
    const pre = buildProgram(gl, preSrc[0], preSrc[1], 'come sail away particles (premultiplied)');
    const cube = buildProgram(gl, cubeSrc[0], cubeSrc[1], 'come sail away particles (cube)');
    const base = ['uProj', 'uView', 'uCamPos', 'uViewScale', 'uTex'];
    const stream = (stride, attrs) => {
      const vao = gl.createVertexArray(), vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      for (const [loc, n, off] of attrs) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); }
      gl.bindVertexArray(null);
      return { vao, vbo, cap: 0 };
    };
    this._part = {
      cut: { p: cut, u: locs(gl, cut, [...base, 'uColor', 'uCutoff', ...LIGHT_FOG]) },
      pre: { p: pre, u: locs(gl, pre, base) },
      cube: { p: cube, u: locs(gl, cube, ['uProj', 'uView', 'uColor', ...LIGHT_FOG]) },
      quads: stream(32, [[0, 3, 0], [1, 2, 12], [2, 3, 20]]),
      cubes: stream(24, [[0, 3, 0], [1, 3, 12]]),
    };
    return this._part;
  }

  _lightFog(u) {
    const gl = this.gl, r = this.renderer;
    gl.uniform3fv(u.uAmbient, r._ambient);
    gl.uniform3fv(u.uSunColor, r._sunColor);
    gl.uniform1f(u.uSunScale, r._sunScale ?? 0);
    gl.uniform3fv(u.uLightDir, r._lightDir);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform3fv(u.uFogColor, r._fogColor);
    gl.uniform1i(u.uFogMode, r._fogMode);
    gl.uniform1f(u.uFogDensity, r._fogDensity);
    gl.uniform2fv(u.uFogRange, r._fogRange);
    if (r._dwFog) gl.uniform4fv(u.uDwFog, r._dwFog);
    if (u.uFocus) gl.uniform4fv(u.uFocus, r._focus);   // AUDIT DEEP R-1 (merged beside CSA-F): under the travel view the fog is the traveller's
    if (u.uJungleHaze && r._haze) gl.uniform4fv(u.uJungleHaze, r._haze);   // BANTHA1: the jungle's haze (render/hazeGlsl.js)
  }

  /** Streams the quads of `parts` ({ position, size, rotation, maxSize }) into the quad buffer; returns the vertex count. */
  _fillQuads(st, parts) {
    const gl = this.gl;
    const n = parts.length * 6;
    if (st.cap < n) { st.cap = Math.max(n, st.cap * 2, 96); st.data = new Float32Array(st.cap * 8); gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo); gl.bufferData(gl.ARRAY_BUFFER, st.data.byteLength, gl.STREAM_DRAW); }
    const d = st.data;
    // two triangles, wound so that cross(b - a, c - a) is up (Unity's front face seen from above)
    const corners = [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]];
    let o = 0;
    for (const q of parts) {
      for (const c of corners) { d[o++] = q.position[0]; d[o++] = q.position[1]; d[o++] = q.position[2]; d[o++] = c[0]; d[o++] = c[1]; d[o++] = q.size[0]; d[o++] = q.rotation[2]; d[o++] = q.maxSize; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, o));
    return n;
  }

  /**
   * The cut-out and opaque particles - the wake's and the splashes' WakeMaterial, the flag's cubes - with the waves.
   * @param {{ wake: any[], flags: any[] }} lists - each particle { position, size, rotation, maxSize } (a flag's with
   *   its `systemRotation`, turned by `rotate(systemRotation, rotation)` to a quaternion)
   * @param {(q: number[], r: number[]) => number[]} rotate
   */
  drawParticlesOpaque({ wake, flags }, rotate) {
    const gl = this.gl, r = this.renderer;
    if (!wake.length && !flags.length) return;
    const P = this._ensurePart();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    if (wake.length && this._partTex.has('112395_0-0')) {
      const u = P.cut.u;
      gl.useProgram(P.cut.p);
      gl.uniformMatrix4fv(u.uProj, false, r._proj);
      gl.uniformMatrix4fv(u.uView, false, r._view);
      gl.uniform1f(u.uViewScale, 2 / Math.abs(r._proj[5] || 1));
      gl.uniform4f(u.uColor, 1, 1, 1, 1);
      gl.uniform1f(u.uCutoff, 0.5);
      this._lightFog(u);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._partTex.get('112395_0-0'));
      gl.uniform1i(u.uTex, 0);
      gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(P.quads.vao);
      const n = this._fillQuads(P.quads, wake);
      gl.drawArrays(gl.TRIANGLES, 0, n);
      gl.bindVertexArray(null);
    }
    if (flags.length) {
      const u = P.cube.u, st = P.cubes;
      const n = flags.length * CUBE_TRIANGLES.length;
      if (st.cap < n) { st.cap = Math.max(n, st.cap * 2, 360); st.data = new Float32Array(st.cap * 6); gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo); gl.bufferData(gl.ARRAY_BUFFER, st.data.byteLength, gl.STREAM_DRAW); }
      const d = st.data;
      let o = 0;
      const spans = [];
      for (const run of flagRuns(flags)) {
        const first = o / 6;
        for (const q of run.list) {
          const rot = rotate(q.systemRotation, q.rotation);
          // SHIP-FLAGS (FIELD BUGS 2026-10-01 #7): the corner and the normal turned into two scratch triples - quatRotate's
          // products to the bit, without the five arrays each turn made (two turns a triangle, 36 a cube, ~25 cubes a flag)
          for (const t of CUBE_TRIANGLES) {
            const p = quatRotateInto(rot, t.p[0] * q.size[0], t.p[1] * q.size[1], t.p[2] * q.size[2], _flagP);
            const nn = quatRotateInto(rot, t.n[0] / (q.size[0] || 1), t.n[1] / (q.size[1] || 1), t.n[2] / (q.size[2] || 1), _flagN);
            d[o++] = q.position[0] + p[0]; d[o++] = q.position[1] + p[1]; d[o++] = q.position[2] + p[2];
            d[o++] = nn[0]; d[o++] = nn[1]; d[o++] = nn[2];
          }
        }
        spans.push({ color: run.color, first, count: o / 6 - first });
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, o));
      gl.useProgram(P.cube.p);
      gl.uniformMatrix4fv(u.uProj, false, r._proj);
      gl.uniformMatrix4fv(u.uView, false, r._view);
      this._lightFog(u);
      gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(st.vao);
      for (const sp of spans) {
        if (sp.color) gl.uniform4f(u.uColor, sp.color[0], sp.color[1], sp.color[2], 1);   // NAV-B: a sea ship's own colours
        else gl.uniform4f(u.uColor, 1, 0.5, 0, 1);   // FlagMaterial's _Color
        gl.drawArrays(gl.TRIANGLES, sp.first, sp.count);
      }
      gl.bindVertexArray(null);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthFunc(gl.LESS);
    r.markForeignPass?.();
  }

  /** The blended particles - the oars' and rudders' drops (Default-Particle) - after the sea's transparent top. */
  drawParticlesBlended(drops) {
    if (!drops.length || !this._partTex.has('Default-Particle')) return;
    const gl = this.gl, r = this.renderer;
    const P = this._ensurePart();
    const u = P.pre.u;
    gl.useProgram(P.pre.p);
    gl.uniformMatrix4fv(u.uProj, false, r._proj);
    gl.uniformMatrix4fv(u.uView, false, r._view);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform1f(u.uViewScale, 2 / Math.abs(r._proj[5] || 1));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._partTex.get('Default-Particle'));
    gl.uniform1i(u.uTex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);   // ZWrite Off
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // Blend One OneMinusSrcAlpha
    gl.disable(gl.CULL_FACE);   // Cull Off
    gl.bindVertexArray(P.quads.vao);
    const n = this._fillQuads(P.quads, drops);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    r.markForeignPass?.();
  }

  /**
   * The waves' pictures: the two paints (top-down RGBA, as decoded), the snow record (top-down RGBA) and each frame's
   * spec, in frame order (Textures/derived.json's `112395_2-i`: its paint's index, scroll and tile).
   * @param {{ paints: {width:number,height:number,data:Uint8Array}[], snow: {width:number,height:number,data:Uint8Array}, specs: {paint:number, scroll:number, tile:number[], size:number[]}[] }} frames
   */
  setWaveFrames(frames) {
    const gl = this.gl;
    // #4: each paint as its chain - level 0 itself, past it the frame's means with the snow at its own mean
    const snowMean = wavePictureMean(frames.snow);
    const chains = frames.paints.map((p) => wavePaintLevels(p, snowMean));
    this._frames = { paints: chains.map((c) => uploadLevels(gl, c)), lastLevel: chains[0] ? chains[0].length - 1 : 0, snow: uploadPicture(gl, frames.snow), snowSize: [frames.snow.width, frames.snow.height], specs: frames.specs };
    this.renderer.markForeignPass?.();
  }
  get hasWaveFrames() { return !!this._frames; }

  _ensureWave() {
    if (this._wave) return this._wave;
    const gl = this.gl;
    const [[vs, fs]] = CSA_WAVE_PROGRAMS;
    const p = buildProgram(gl, vs, fs, 'come sail away waves');
    this._wave = { p, u: locs(gl, p, ['uProj', 'uView', 'uOrigin', 'uScale', 'uTile', 'uPaint', 'uSnow', 'uFrameSize', 'uSnowSize', 'uLastLevel', 'uScroll', 'uTileOffset',
      'uColor', 'uCutoff', 'uDitherStart', 'uDitherEnd', 'uAmbient', 'uSunColor', 'uSunScale', 'uLightDir', 'uCamPos', 'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uDwFog', 'uFocus', 'uJungleHaze']),
    vao: gl.createVertexArray(), vbo: gl.createBuffer(), ebo: gl.createBuffer() };
    return this._wave;
  }

  _uploadMesh(w, mesh) {
    if (this._mesh?.from === mesh) return;
    const gl = this.gl;
    const n = mesh.vertices.length / 3;
    const data = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      data.set(mesh.vertices.subarray(i * 3, i * 3 + 3), i * 8);
      data.set(mesh.normals.subarray(i * 3, i * 3 + 3), i * 8 + 3);
      data.set(mesh.uvs.subarray(i * 2, i * 2 + 2), i * 8 + 6);
    }
    gl.bindVertexArray(w.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, w.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this._mesh = { from: mesh, count: mesh.indices.length };
  }

  /**
   * The wave object, as the runtime's `waves()` reads it, with the dither LoadSettings set.
   * @param {{ position:number[], scale:number, mesh:any, frame:number }} waves
   * @param {{ start:number, end:number }} dither
   */
  drawWaves(waves, dither) {
    if (!waves?.mesh || !this._frames) return;
    const spec = this._frames.specs[waves.frame];
    if (!spec) return;
    const gl = this.gl, r = this.renderer;
    const w = this._ensureWave();
    this._uploadMesh(w, waves.mesh);
    const u = w.u;
    gl.useProgram(w.p);
    gl.uniformMatrix4fv(u.uProj, false, r._proj);
    gl.uniformMatrix4fv(u.uView, false, r._view);
    gl.uniform3fv(u.uOrigin, waves.position);
    gl.uniform1f(u.uScale, waves.scale);
    gl.uniform2f(u.uTile, WAVE_MATERIAL.tile[0], WAVE_MATERIAL.tile[1]);
    gl.uniform2i(u.uFrameSize, spec.size[0], spec.size[1]);
    gl.uniform2i(u.uSnowSize, this._frames.snowSize[0], this._frames.snowSize[1]);
    gl.uniform1i(u.uLastLevel, this._frames.lastLevel);   // #4
    gl.uniform1i(u.uScroll, spec.scroll);
    gl.uniform2i(u.uTileOffset, spec.tile[0], spec.tile[1]);
    gl.uniform4fv(u.uColor, WAVE_MATERIAL.color);
    gl.uniform1f(u.uCutoff, WAVE_MATERIAL.cutoff);
    gl.uniform1f(u.uDitherStart, dither.start);
    gl.uniform1f(u.uDitherEnd, dither.end);
    gl.uniform3fv(u.uAmbient, r._ambient);
    gl.uniform3fv(u.uSunColor, r._sunColor);
    gl.uniform1f(u.uSunScale, r._sunScale ?? 0);
    gl.uniform3fv(u.uLightDir, r._lightDir);
    gl.uniform3fv(u.uCamPos, r._camPos);
    gl.uniform3fv(u.uFogColor, r._fogColor);
    gl.uniform1i(u.uFogMode, r._fogMode);
    gl.uniform1f(u.uFogDensity, r._fogDensity);
    gl.uniform2fv(u.uFogRange, r._fogRange);
    if (r._dwFog) gl.uniform4fv(u.uDwFog, r._dwFog);
    if (u.uFocus) gl.uniform4fv(u.uFocus, r._focus);   // AUDIT DEEP R-1 (merged beside CSA-F): under the travel view the fog is the traveller's
    if (u.uJungleHaze && r._haze) gl.uniform4fv(u.uJungleHaze, r._haze);   // BANTHA1: the jungle's haze (render/hazeGlsl.js)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._frames.paints[spec.paint]);
    gl.uniform1i(u.uPaint, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._frames.snow);
    gl.uniform1i(u.uSnow, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);   // Cull Back, the shader's default, on Unity's winding
    gl.enable(gl.POLYGON_OFFSET_FILL);   // FIELD BUGS 2026-09-29 (the sea) #4: the breakers' place in the sea's stack (render/waterSurface.js WATER_LAYER_UNITS)
    gl.polygonOffset(0, WATER_LAYER_UNITS.breakers);
    gl.bindVertexArray(w.vao);
    gl.drawElements(gl.TRIANGLES, this._mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.depthFunc(gl.LESS);
    r.markForeignPass?.();
  }

  dispose() {
    const gl = this.gl;
    if (this._wave) { gl.deleteProgram(this._wave.p); gl.deleteVertexArray(this._wave.vao); gl.deleteBuffer(this._wave.vbo); gl.deleteBuffer(this._wave.ebo); this._wave = null; }
    if (this._frames) { for (const t of this._frames.paints) gl.deleteTexture(t); gl.deleteTexture(this._frames.snow); this._frames = null; }
    if (this._part) {
      for (const k of ['cut', 'pre', 'cube']) gl.deleteProgram(this._part[k].p);
      for (const k of ['quads', 'cubes']) { gl.deleteVertexArray(this._part[k].vao); gl.deleteBuffer(this._part[k].vbo); }
      this._part = null;
    }
    for (const t of this._partTex.values()) gl.deleteTexture(t);
    this._partTex.clear();
    this._mesh = null;
  }
}
