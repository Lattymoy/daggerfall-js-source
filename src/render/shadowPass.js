// @ts-check
// EL2 (2026-09-17, the Enhanced Lighting arc, tier two - SHADOWS).
//
// WHAT THIS IS. The renderer has no scene graph: the hosts issue every
// world draw themselves, in their own order, from their own culled lists
// (world.js's pixel loop, dungeon.js's drawList). A shadow map needs the
// same geometry drawn again from the light, so the pass here RECORDS what
// the world pass draws - each mesh with a copy of its matrix, each terrain
// surface, each billboard batch list - into a pooled list, and at the
// start of the NEXT frame replays that list depth-only from the light,
// before the frame's own clear. The maps are then current with THIS
// frame's light and camera; only the caster list is a frame old, and a
// frame-old caster list is the same list to the eye. No host changes its
// draw order or draws anything twice.
//
// TWO MAPS, ONE PER KIND OF SCENE, chosen per frame off the lighting the
// host already set: outdoors (a sun with height) a two-cascade
// orthographic map centred on the eye - 40 units at 2048^2 for the street
// the player stands in, 240 for the town around it - indoors (no sun) a
// cube map from the nearest scene light, six faces of 512^2. The lane's
// fragment shaders (render/enhancedLighting.js) read them through
// SHADOW_GLSL: the sun's on the sun term, the cube's on the one lantern
// it belongs to (uShadowIndex), hardware-compared and PCF-softened, with a
// normal offset and a small constant bias against acne.
//
// KNOWN LIMITS, recorded: a caster the frame did not draw casts nothing -
// the hosts' frustum culling (EV3) means a tower behind the camera throws
// no shadow into the view; the character rigs (the Morrowind body, the
// peers, the first-person arm) cast none; the water surface receives none.
// Later tiers own those.
//
// The depth programs are the renderer's OWN vertex shaders (handed over
// at construction - this module imports nothing of the renderer, so a
// classic page never loads a shadow program) over two tiny fragment
// shaders: nothing at all for a solid, the 0.5 cutout for a flat.

import { lookAt, multiply, ortho, perspective } from '../world/mat4.js';

/** The sun map: two cascades of this size, as a depth texture array. */
export const SHADOW_SUN_SIZE = 2048;
/** The cube map's face size. */
export const SHADOW_POINT_SIZE = 512;
/** The cascades' radii around the eye, world units (a terrain tile is 6.4,
 *  an RMB block 102.4): the near street, and the town. */
export const SHADOW_CASCADES = Object.freeze([40, 240]);
/** The ortho box's half-depth along the light: enough to take a mountain
 *  pixel's height above or below the eye. */
export const SHADOW_SUN_DEPTH = 600;
/** Below this sun height the sun map is not drawn (a horizontal sun's
 *  shadows are a smear the map cannot hold) and no shadow is cast. */
export const SHADOW_MIN_SUN_Y = 0.05;
/** The cube map's near plane, and the distance under which a light is
 *  the eye's own (the Light effect's candle at the camera) and never the
 *  caster - its shadows would be hidden by their own occluders anyway. */
export const SHADOW_POINT_NEAR = 0.1;
export const SHADOW_CASTER_MIN_DISTANCE = 0.25;
/** AUDIT-EL F11: a light with a range past this is the storm's flash (Dynamic
 *  Skies: 500..1000 over the player, for a fifth of a second), never the
 *  caster - six 512^2 replays of the whole town to a far plane of a
 *  thousand, for a frame, were a hitch and nothing else. */
export const SHADOW_CASTER_MAX_RANGE = 120;
/** AUDIT-EL F15: the biases, in the space they mean - the sun's in the
 *  ortho box's [0,1] depth (600 units of half-depth: 5e-5 is 0.06 units),
 *  the lantern's in WORLD units off the major axis (the cube's depth is
 *  hyperbolic; a constant in it is a bias that grows with distance). */
export const SHADOW_SUN_BIAS = 0.00005;
export const SHADOW_POINT_BIAS = 0.04;
/** The reserved texture units (CLOUD_SHADOW_UNIT is 15). */
export const SHADOW_SUN_UNIT = 13;
export const SHADOW_POINT_UNIT = 14;
/** The record pool's ceiling - a city frame draws ~1000 meshes. Past it a
 *  frame's casters are truncated, never reallocated. */
export const SHADOW_RECORD_MAX = 6000;

const Y_UP = [0, 1, 0];
const Z_UP = [0, 0, 1];

/** The two cascades' view-projections for a sun at `lightDir` (the
 *  direction TOWARD the light) around `eye`, texel-snapped so the shadow
 *  edge does not shimmer as the camera walks. `out` is two Float32Array(16). */
export function sunCascadeMatrices(eye, lightDir, out) {
  const up = Math.abs(lightDir[1]) > 0.99 ? Z_UP : Y_UP;
  for (let c = 0; c < SHADOW_CASCADES.length; c++) {
    const r = SHADOW_CASCADES[c];
    const le = [eye[0] + lightDir[0] * SHADOW_SUN_DEPTH, eye[1] + lightDir[1] * SHADOW_SUN_DEPTH, eye[2] + lightDir[2] * SHADOW_SUN_DEPTH];
    const view = lookAt(le, eye, up);
    const proj = ortho(r, r, 0, 2 * SHADOW_SUN_DEPTH);
    const vp = multiply(proj, view, out[c]);
    // the snap: the world origin's map texel is rounded, and the box is
    // moved by the remainder, so every world point lands on the same
    // texel whatever the eye did between frames
    const half = SHADOW_SUN_SIZE / 2;
    const ox = vp[12] * half, oy = vp[13] * half;
    vp[12] += (Math.round(ox) - ox) / half;
    vp[13] += (Math.round(oy) - oy) / half;
  }
  return out;
}

/** The world-space size of one texel of cascade `c`. */
export function sunTexelWorld(c) {
  return 2 * SHADOW_CASCADES[c] / SHADOW_SUN_SIZE;
}

// The cube's six faces in GL's own order (+X -X +Y -Y +Z -Z) with the
// up vectors the cube convention wants, so a lookup by direction lands
// on the face that was drawn looking that way.
const CUBE_FACES = Object.freeze([
  [[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]],
  [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, -1]],
  [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]],
]);

/** The six face view-projections of a point light at `pos` reaching `far`.
 *  `out` is six Float32Array(16). */
export function pointFaceMatrices(pos, far, out) {
  const proj = perspective(Math.PI / 2, 1, SHADOW_POINT_NEAR, far);
  for (let f = 0; f < 6; f++) {
    const [d, up] = CUBE_FACES[f];
    const view = lookAt(pos, [pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]], up);
    multiply(proj, view, out[f]);
  }
  return out;
}

/** The depth the cube map holds for a point at `(dx, dy, dz)` from the
 *  light: the major axis is the face's view depth, and this is that depth
 *  through the face's projection, in [0, 1] - the JS of the shader's
 *  cubeDepthRef, term for term. */
export function cubeDepthRef(dx, dy, dz, far, near = SHADOW_POINT_NEAR) {
  return cubeDepthOfM(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)), far, near);
}
/** The same, off the major-axis distance itself (the shader's cubeDepthOfM). */
export function cubeDepthOfM(m, far, near = SHADOW_POINT_NEAR) {
  m = Math.max(m, near);
  const ndc = (far + near) / (far - near) - (2 * far * near) / ((far - near) * m);
  return ndc * 0.5 + 0.5;
}

/** The lantern the cube map belongs to: the nearest to the eye of the
 *  frame's point lights (vec4s: xyz, range) that is at least `minDist`
 *  away and has a range; -1 for none. */
export function pickShadowCaster(lights, eye, minDist = SHADOW_CASTER_MIN_DISTANCE) {
  let best = -1, bestD = Infinity;
  const n = lights.length >> 2;
  for (let i = 0; i < n; i++) {
    const dx = lights[i * 4] - eye[0], dy = lights[i * 4 + 1] - eye[1], dz = lights[i * 4 + 2] - eye[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < minDist || !(lights[i * 4 + 3] > 0) || lights[i * 4 + 3] > SHADOW_CASTER_MAX_RANGE) continue;   // AUDIT-EL F11
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** The frame's shadow kind off the lighting the host set: the sun map
 *  when there is a sun with height, else the cube map. */
export function shadowKind(sunScale, lightDir) {
  return sunScale > 0.01 && lightDir && lightDir[1] > SHADOW_MIN_SUN_Y ? 'sun' : 'point';
}

/** THE RECEIVER BLOCK, interpolated into every lane shader that lights by
 *  the sun or a lantern. sunShadowAt: the sun term's visibility at a world
 *  point with normal n (1 = lit); pointShadowAt: the same for the one
 *  shadowed lantern. Both 1.0 while their map is off (params.w). */
export const SHADOW_GLSL = `
precision highp sampler2DArrayShadow;
precision highp samplerCubeShadow;
uniform sampler2DArrayShadow uSunShadow;
uniform mat4 uSunVP[2];
uniform vec4 uSunShadowParams;    // x the near cascade's radius, y z the two cascades' texel size (world), w 1 = on
uniform samplerCubeShadow uPointShadow;
uniform vec4 uPointShadowParams;  // xyz the light, w its far plane (0 = off)
uniform int uShadowIndex;         // the lantern the cube map belongs to, -1 for none
float sunShadowAt(vec3 wp, vec3 n) {
  if (uSunShadowParams.w <= 0.0) return 1.0;
  float d = length(wp - uCamPos);
  int c = d < uSunShadowParams.x * 0.9 ? 0 : 1;
  float texel = c == 0 ? uSunShadowParams.y : uSunShadowParams.z;
  mat4 vp = c == 0 ? uSunVP[0] : uSunVP[1];
  vec4 lp = vp * vec4(wp + n * texel * 1.5, 1.0);
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float ref = p.z - ${SHADOW_SUN_BIAS};   // AUDIT-EL F15: ~0.06 world units over the 1200-unit box (0.0004 was half a unit - feet floated off their shadows)
  float texelUv = 1.0 / ${SHADOW_SUN_SIZE}.0;   // AUDIT-EL F17: not 'step' - a built-in's name
  float lit = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      lit += texture(uSunShadow, vec4(p.xy + vec2(float(x), float(y)) * texelUv, float(c), ref));
    }
  }
  return lit / 9.0;
}
// the face's depth of a point whose major-axis distance is m (cubeDepthRef in shadowPass.js)
float cubeDepthOfM(float m, float far) {
  float near = ${SHADOW_POINT_NEAR};
  m = max(m, near);
  float ndc = (far + near) / (far - near) - (2.0 * far * near) / ((far - near) * m);
  return ndc * 0.5 + 0.5;
}
float pointShadowAt(vec3 wp, vec3 n) {
  float far = uPointShadowParams.w;
  if (far <= 0.0) return 1.0;
  vec3 d = (wp + n * 0.05) - uPointShadowParams.xyz;
  // AUDIT-EL F15: THE BIAS IS IN WORLD UNITS - the depth is hyperbolic, and a
  // constant 0.002 off it was half a unit at five units and four at fifteen:
  // an occluder within four units of a wall cast nothing near a lantern's range
  float m = max(max(abs(d.x), abs(d.y)), abs(d.z));
  float ref = cubeDepthOfM(m - ${SHADOW_POINT_BIAS}, far);
  float lit = texture(uPointShadow, vec4(d, ref));
  vec3 a = abs(d);
  vec3 t = a.x > a.y && a.x > a.z ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 u = normalize(cross(d, t)) * length(d) * 0.01;
  vec3 v = normalize(cross(d, u)) * length(d) * 0.01;
  lit += texture(uPointShadow, vec4(d + u, ref)) + texture(uPointShadow, vec4(d - u, ref))
       + texture(uPointShadow, vec4(d + v, ref)) + texture(uPointShadow, vec4(d - v, ref));
  return lit / 5.0;
}
`;

/** The depth-only fragment shaders: a solid writes depth and nothing else;
 *  a flat keeps the classic 0.5 cutout so a tree's shadow is its silhouette. */
export const DEPTH_FS = `#version 300 es
precision highp float;
void main() {}`;
export const DEPTH_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
}`;

const REC_MESH = 0, REC_TERRAIN = 1, REC_BB = 2;

/**
 * The pass: the maps, the depth programs, the record pool, the replay.
 * `opts.build(vs, fs)` compiles a program (the renderer's _buildProgram);
 * `opts.vs` is { mesh, bb, terrain } - the renderer's own vertex shaders.
 */
export class ShadowPass {
  constructor(gl, opts) {
    this.gl = gl;
    const u = (p, n) => gl.getUniformLocation(p, n);
    const mesh = opts.build(opts.vs.mesh, DEPTH_FS);
    const terrain = opts.build(opts.vs.terrain, DEPTH_FS);
    const bb = opts.build(opts.vs.bb, DEPTH_BB_FS);
    this.programs = {
      mesh: { p: mesh, proj: u(mesh, 'uProj'), view: u(mesh, 'uView'), model: u(mesh, 'uModel') },
      terrain: { p: terrain, proj: u(terrain, 'uProj'), view: u(terrain, 'uView'), model: u(terrain, 'uModel') },
      bb: {
        p: bb, proj: u(bb, 'uProj'), view: u(bb, 'uView'), right: u(bb, 'uRight'), up: u(bb, 'uUp'), origin: u(bb, 'uOrigin'),
        size: u(bb, 'uSize'), tex: u(bb, 'uTex'), flatWind: u(bb, 'uFlatWind'), sway: u(bb, 'uSway'),
      },
    };
    // the sun map: a depth array of two layers, one framebuffer per layer
    const sun = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, sun);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, SHADOW_SUN_SIZE, SHADOW_SUN_SIZE, SHADOW_CASCADES.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.sunTex = sun;
    this.sunFbos = [];
    for (let c = 0; c < SHADOW_CASCADES.length; c++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, sun, 0, c);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.sunFbos.push(fbo);
    }
    // the cube map: six depth faces, one framebuffer per face
    const cube = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 1, gl.DEPTH_COMPONENT24, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.pointTex = cube;
    this.pointFbos = [];
    for (let f = 0; f < 6; f++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, cube, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.pointFbos.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    // the pool: records are minted once and reused by index
    /** @type {Array<{kind:number, mesh:any, matrix:Float32Array, texRemap:any, surface:any, arrayTex:any, tilemapTex:any, tileSize:number, batches:any, flatWind:Float32Array, right:Float32Array, up:Float32Array}>} */
    this.records = [];
    this.count = 0;
    this.recording = true;
    this.sunVP = [new Float32Array(16), new Float32Array(16)];
    this.faceVP = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
    this.sunParams = new Float32Array(4);
    this.pointParams = new Float32Array(4);
    this.shadowIndex = -1;
    this.kind = null;
    /** per-frame counts, for a probe */
    this.stats = { records: 0, sunDraws: 0, pointDraws: 0 };
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._right = new Float32Array(3); this._up = new Float32Array([0, 1, 0]);
    this._zeroWind = new Float32Array(4);
    this._sunVPFlat = new Float32Array(32);
  }

  _rec() {
    if (this.count >= SHADOW_RECORD_MAX) return null;
    let r = this.records[this.count];
    if (!r) {
      r = { kind: 0, mesh: null, matrix: new Float32Array(16), texRemap: null, surface: null, arrayTex: null, tilemapTex: null, tileSize: 0, batches: null, flatWind: new Float32Array(4), right: new Float32Array(3), up: new Float32Array(3) };
      this.records[this.count] = r;
    }
    this.count++;
    return r;
  }
  recordMesh(mesh, matrix, texRemap) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_MESH; r.mesh = mesh; r.matrix.set(matrix); r.texRemap = texRemap;
  }
  recordTerrain(surface, matrix, arrayTex, tilemapTex, tileSize) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_TERRAIN; r.surface = surface; r.matrix.set(matrix); r.arrayTex = arrayTex; r.tilemapTex = tilemapTex; r.tileSize = tileSize;
  }
  recordBillboards(batches, flatWind, camRight, camUp) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_BB; r.batches = batches; r.flatWind.set(flatWind ?? this._zeroWind);
    r.right.set(camRight); r.up.set(camUp);   // EL3: the basis the batch was drawn with, for the emission replay
  }
  /** Drop the frame's records without drawing them (a frame that ran no
   *  world pass, a panel frame). */
  discard() {
    for (let i = 0; i < this.count; i++) { const r = this.records[i]; r.mesh = null; r.surface = null; r.batches = null; r.texRemap = null; }
    this.count = 0;
  }

  /**
   * Draw the maps for THIS frame from LAST frame's records. The records
   * stay for the air pass (EL3); the renderer discards them after both.
   * `f` is the frame: { eye, lightDir, sunScale, pointLights (the
   * vec4s), textures (the renderer's map), blackTex, bindVao, use }.
   * Leaves no framebuffer bound and the caller's program shadow dirty.
   */
  render(f) {
    const gl = this.gl;
    this.stats.records = this.count; this.stats.sunDraws = 0; this.stats.pointDraws = 0;
    this.kind = shadowKind(f.sunScale, f.lightDir);
    this.sunParams[3] = 0; this.pointParams[3] = 0; this.shadowIndex = -1;
    if (this.count === 0) { this.kind = null; return; }
    gl.disable(gl.CULL_FACE);   // the light's projection is not the mirrored one: winding is not the world's, and both faces of an open model must cast
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    if (this.kind === 'sun') {
      sunCascadeMatrices(f.eye, f.lightDir, this.sunVP);
      const ld = f.lightDir;
      // the flats face the sun for their silhouette: right = up x lightDir
      const rl = Math.hypot(ld[2], ld[0]) || 1;
      this._right[0] = ld[2] / rl; this._right[1] = 0; this._right[2] = -ld[0] / rl;
      for (let c = 0; c < SHADOW_CASCADES.length; c++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sunFbos[c]);
        gl.viewport(0, 0, SHADOW_SUN_SIZE, SHADOW_SUN_SIZE);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.stats.sunDraws += this.replay(f, this.sunVP[c], null);
      }
      this.sunParams[0] = SHADOW_CASCADES[0]; this.sunParams[1] = sunTexelWorld(0); this.sunParams[2] = sunTexelWorld(1); this.sunParams[3] = 1;
      this._sunVPFlat.set(this.sunVP[0], 0); this._sunVPFlat.set(this.sunVP[1], 16);
    } else {
      const i = pickShadowCaster(f.pointLights, f.eye);
      if (i >= 0) {
        const L = f.pointLights;
        const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
        const far = L[i * 4 + 3];
        pointFaceMatrices(pos, far, this.faceVP);
        for (let face = 0; face < 6; face++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[face]);
          gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          this.stats.pointDraws += this.replay(f, this.faceVP[face], pos);
        }
        this.pointParams[0] = pos[0]; this.pointParams[1] = pos[1]; this.pointParams[2] = pos[2]; this.pointParams[3] = far;
        this.shadowIndex = i;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.CULL_FACE);
  }

  /** One map's worth of depth-only draws under view-projection `vp`
   *  (uploaded as uProj with an identity uView). `lightPos` is the cube's
   *  light, for the flats' facing; null for the sun (this._right);
   *  `recordBasis` (the air pass's camera replay) faces each flat as its
   *  record was drawn. Returns the draw count. */
  replay(f, vp, lightPos, recordBasis = false) {
    const gl = this.gl;
    const P = this.programs;
    let draws = 0;
    let bound = null;
    const use = (prog) => { if (bound !== prog) { gl.useProgram(prog.p); gl.uniformMatrix4fv(prog.proj, false, vp); gl.uniformMatrix4fv(prog.view, false, this._identityView); bound = prog; } };
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind === REC_MESH) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        use(P.mesh);
        gl.uniformMatrix4fv(P.mesh.model, false, r.matrix);
        f.bindVao(mesh.vao);
        for (const sm of mesh.subMeshes) {
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          draws++;
        }
      } else if (r.kind === REC_TERRAIN) {
        const s = r.surface;
        if (!s?.vao || s._dead) continue;
        use(P.terrain);
        gl.uniformMatrix4fv(P.terrain.model, false, r.matrix);
        f.bindVao(s.vao);
        gl.drawElements(gl.TRIANGLES, s.indexCount, gl.UNSIGNED_INT, 0);
        draws++;
      } else {
        use(P.bb);
        gl.uniform1i(P.bb.tex, 0);
        gl.uniform4fv(P.bb.flatWind, r.flatWind);
        gl.activeTexture(gl.TEXTURE0);
        let lastSway = null;
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal || f.isSpectral(b.archive)) continue;   // a concealed foe and a ghost cast nothing
          const key = b._bbKey ?? (b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`);
          const tex = f.textures.get(key);
          if (!tex) continue;
          const o = b.origin || [0, 0, 0];
          if (lightPos) {
            // face the lantern: right = up x (light - flat)
            const dx = lightPos[0] - o[0], dz = lightPos[2] - o[2];
            const l = Math.hypot(dx, dz) || 1;
            this._right[0] = dz / l; this._right[1] = 0; this._right[2] = -dx / l;
          }
          // AUDIT-EL F13: the CAMERA's depth image (the air pass) draws a flat
          // with the basis it was drawn with, off the record - the sun's basis
          // drew every tree edge-on, a sliver the AO and the glares saw through
          gl.uniform3fv(P.bb.right, recordBasis ? r.right : this._right);
          gl.uniform3fv(P.bb.up, recordBasis ? r.up : this._up);
          gl.uniform3f(P.bb.origin, o[0], o[1], o[2]);
          gl.uniform2f(P.bb.size, b.size.w, b.size.h);
          const sw = b.sway || 0;
          if (sw !== lastSway) { gl.uniform1f(P.bb.sway, sw); lastSway = sw; }
          gl.bindTexture(gl.TEXTURE_2D, tex);
          f.bindVao(b.vao);
          gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
          draws++;
        }
      }
    }
    return draws;
  }

  /** Bind the maps on their reserved units and upload the receiver
   *  uniforms for one program (`loc` from the renderer's lookup: sunShadow,
   *  sunVP, sunParams, pointShadow, pointParams, shadowIndex). */
  upload(loc) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + SHADOW_SUN_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.sunTex);
    gl.activeTexture(gl.TEXTURE0 + SHADOW_POINT_UNIT);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.pointTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.sunShadow, SHADOW_SUN_UNIT);
    gl.uniform1i(loc.pointShadow, SHADOW_POINT_UNIT);
    gl.uniformMatrix4fv(loc.sunVP, false, this._sunVPFlat);
    gl.uniform4fv(loc.sunParams, this.sunParams);
    gl.uniform4fv(loc.pointParams, this.pointParams);
    gl.uniform1i(loc.shadowIndex, this.shadowIndex);
  }

}
