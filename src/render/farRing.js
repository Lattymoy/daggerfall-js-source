// ═══════════════════════════════════════════════════════════════════
// EV8 — THE FAR PROVINCE RING. Beyond the streamed grid the horizon
// was fog meeting sky; the province's actual mountains were sitting
// unread in the same WOODS.WLD heightmap the travel map already
// renders. This module puts them on the horizon: a coarse relief -
// ONE vertex per map pixel - built around the player and drawn as a
// self-contained pass between the sky and the streamed world.
//
// THE HEIGHT LAW IS THE STREAMED TERRAIN'S OWN, un-exaggerated:
// max(byte*8, oceanElevation) * terrainScale, in world units - the
// exact macro-shape generateSamples builds its detail on top of. The
// travel map's x24 OVERWORLD_RELIEF is display skin and stays there.
// Tints are overworldTint(climate, byte), the port's one documented
// map-pixel-to-ground-colour law (ocean-swamp trap and all); normals
// are real central differences so the ring takes the live sun.
//
// PLACEMENT rides the floating origin for free: vertices are built in
// pixel-corner units relative to a BASE pixel, and the draw takes
// state.pixelTranslation(base) as its one origin - a recenter changes
// that translation before the next draw, so the mesh never moves by
// hand (the law every hand-offset consumer in world.js exists for
// having broken).
//
// THE HOLE: the streamed grid draws AFTER the ring with a full depth
// story, so painter's order already hides the ring wherever real
// terrain covers it. The one case it cannot fix is a coarse ring peak
// spiking ABOVE the streamed silhouette from inside the grid - so the
// index buffer skips every cell inside the streamed rect, re-punched
// per pixel crossing (indices only - the vertex grid rebuilds only
// when the player has drifted far from the ring base).
//
// THE FADE is the pass's own, NOT the world fog: the world's linear
// fog saturates at 2400/3200 units and the ring lives entirely beyond
// it - drawn through renderer.setFog it would be an invisible flat
// wash. Instead the mix toward the live fog colour follows the world
// fog's own ramp but CAPS at RING_HAZE_HOLD through the middle
// distance (peaks read through haze - the point of the feature) and
// only closes to 1 at the mesh rim, where the ring must dissolve into
// the sky it sits against.
//
// GL DISCIPLINE: drawn between sky.draw and the host's existing
// markForeignPass, so the renderer's EV6 state shadows are already
// due a reset and this pass needs no save/restore of its own (the R9
// law: the next entry point owns its binding). Depth is untouched -
// the pass tests nothing and writes nothing, like the sky it extends.
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE } from '../world/terrainSampler.js';
import { overworldTint, BASE_HEIGHT_SCALE } from '../ui/overworldModel.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';

/** Ring radius in map pixels around the base - ~39 km of horizon. */
export const RING_RADIUS = 48;
/** Rebuild the vertex grid when the player drifts this far (pixels)
 *  from the ring base; until then only the hole re-punches. */
export const RING_REBUILD_DRIFT = 12;
/** The haze mix held through the middle distance - the last 15% is
 *  silhouette, and only the rim closes fully into the sky. */
export const RING_HAZE_HOLD = 0.85;

/** The streamed law's own macro height for one map-pixel byte. */
export const ringHeight = (byte) =>
  Math.max(byte * BASE_HEIGHT_SCALE, SCALED_OCEAN_ELEVATION) * DEFAULT_TERRAIN_SCALE;

/**
 * The ring's vertex grid: (2R+1)^2 vertices at map-pixel centres,
 * pixel-corner units relative to `base` (x = (px - baseX + 0.5) *
 * 819.2, z = -(py - baseY - 0.5) * 819.2 - map Y runs south, the
 * streamed world's own sign), heights un-exaggerated, tints from the
 * overworld law, normals by clamped central differences over the
 * neighbouring bytes.
 *
 * @param {object} o
 * @param {Uint8Array} o.heightBytes - woods.heightMapBuffer, y*width+x.
 * @param {number} o.mapWidth
 * @param {number} o.mapHeight
 * @param {(x:number,y:number)=>number} o.climateAt - raw CLIMATE.PAK value.
 * @param {number} o.baseX
 * @param {number} o.baseY
 * @param {number} [o.radius]
 */
export function buildFarRingGrid({ heightBytes, mapWidth, mapHeight, climateAt, baseX, baseY, radius = RING_RADIUS }) {
  const side = radius * 2 + 1;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  const colors = new Uint8Array(side * side * 3);
  const clampX = (x) => Math.max(0, Math.min(mapWidth - 1, x));
  const clampY = (y) => Math.max(0, Math.min(mapHeight - 1, y));
  const byteAt = (x, y) => heightBytes[clampY(y) * mapWidth + clampX(x)];
  let o = 0;
  for (let j = 0; j < side; j++) {
    const py = baseY - radius + j;
    for (let i = 0; i < side; i++) {
      const px = baseX - radius + i;
      const byte = byteAt(px, py);
      positions[o] = (px - baseX + 0.5) * TERRAIN_SIZE;
      positions[o + 1] = ringHeight(byte);
      positions[o + 2] = -(py - baseY - 0.5) * TERRAIN_SIZE;
      // central differences; +py is -z, so the z slope negates
      const nx = ringHeight(byteAt(px - 1, py)) - ringHeight(byteAt(px + 1, py));
      const nz = ringHeight(byteAt(px, py + 1)) - ringHeight(byteAt(px, py - 1));
      const ny = 2 * TERRAIN_SIZE;
      const l = Math.hypot(nx, ny, nz);
      normals[o] = nx / l;
      normals[o + 1] = ny / l;
      normals[o + 2] = nz / l;
      const tint = overworldTint(climateAt(clampX(px), clampY(py)), byte);
      colors[o] = tint[0]; colors[o + 1] = tint[1]; colors[o + 2] = tint[2];
      o += 3;
    }
  }
  return { positions, normals, colors, side };
}

/**
 * The ring's triangles, with the HOLE punched. AUDIT EV F-R2 made the
 * rule exact: vertices sit at pixel CENTRES, so cell (px, py) spans
 * corner-units [px+0.5, px+1.5] while the streamed footprint spans
 * [cx-d, cx+d+1] - the two lattices are offset by half a pixel and no
 * hole can match the footprint exactly. The rule skips every cell
 * that lies FULLY inside the footprint (px in [cx-d, cx+d-1], same in
 * y), which leaves one straddling cell on EVERY side, each
 * overlapping the streamed rim by half a pixel. That direction is the
 * law: an overlap costs nothing (the streamed grid draws after the
 * ring with the full depth story and paints over it), while the first
 * cut of this rule skipped the east/south straddlers too and opened a
 * 409.6-unit strip along those rims that NEITHER surface covered - a
 * sky gap under grazing sightlines. The residual exposure - a coarse
 * straddle vertex half a pixel inside the rect spiking above the
 * streamed silhouette where the sampler's noise runs low - is half a
 * pixel deep on all four sides, symmetric, and sits past the fog end
 * under the haze hold. Recorded, watched.
 */
export function buildFarRingIndices({ baseX, baseY, radius = RING_RADIUS, holeX, holeY, holeRadius }) {
  const side = radius * 2 + 1;
  const out = new Uint32Array((side - 1) * (side - 1) * 6);
  let o = 0;
  for (let j = 0; j < side - 1; j++) {
    const py = baseY - radius + j;
    for (let i = 0; i < side - 1; i++) {
      const px = baseX - radius + i;
      if (px >= holeX - holeRadius && px <= holeX + holeRadius - 1
        && py >= holeY - holeRadius && py <= holeY + holeRadius - 1) continue;
      const i0 = j * side + i;
      const i1 = i0 + 1;
      const i2 = i0 + side;
      const i3 = i2 + 1;
      out[o++] = i0; out[o++] = i2; out[o++] = i3;
      out[o++] = i0; out[o++] = i3; out[o++] = i1;
    }
  }
  return out.subarray(0, o);
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uOrigin;
out vec3 vNormal;
out vec3 vColor;
out float vDist;
void main() {
  vec3 world = aPos + uOrigin;
  vNormal = aNormal;
  vColor = aColor;
  vec4 view = uView * vec4(world, 1.0);
  vDist = length(view.xyz);
  gl_Position = uProj * view;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in float vDist;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // AUDIT EV F-R4: the moonlit night reaches the horizon too
uniform float uMoonScale;
uniform vec3 uMoonColor;
uniform vec3 uFogColor;
uniform float uFogEnd;   // the WORLD fog's end - the ramp the seam must match
uniform float uRimStart; // where the hold starts closing into the sky
uniform float uRimEnd;   // the mesh rim - fully sky by here
uniform float uHazeHold;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = vColor * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
  // the world fog's own ramp, capped at the hold - silhouettes read
  // through the haze - then closed to 1 at the rim
  float base = uHazeHold * clamp(vDist / max(uFogEnd, 1.0), 0.0, 1.0);
  float rim = (1.0 - uHazeHold) * smoothstep(uRimStart, uRimEnd, vDist);
  outColor = vec4(mix(lit, uFogColor, min(base + rim, 1.0)), 1.0);
}`;

const FLAT_UP = new Float32Array([0, 1, 0]);
const FLAT_WHITE = new Float32Array([1, 1, 1]);

/** ?ring=off - the escape hatch, read once at scene build. */
export function ringDisabled(search = globalThis.location?.search) {
  try { return /[?&]ring=off\b/.test(search ?? ''); }
  catch { return false; }
}

export class FarRingRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`far ring shader: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`far ring link: ${gl.getProgramInfoLog(p)}`);
    }
    this.program = p;
    this.u = {};
    for (const name of ['uProj', 'uView', 'uOrigin', 'uLightDir', 'uAmbient', 'uSunScale', 'uSunColor',
      'uMoonDir', 'uMoonScale', 'uMoonColor',
      'uFogColor', 'uFogEnd', 'uRimStart', 'uRimEnd', 'uHazeHold']) {
      this.u[name] = gl.getUniformLocation(p, name);
    }
    this.vao = null;
    this.buffers = [];
    this.indexCount = 0;
    this.baseX = 0; this.baseY = 0;
    this._holeKey = '';
    this._proj = null;
    this._projKey = '';
    this._built = false;
  }

  /** (Re)build the vertex grid around `base` and punch the hole. */
  build(gridInputs, holeX, holeY, holeRadius) {
    const gl = this.gl;
    const { positions, normals, colors } = buildFarRingGrid(gridInputs);
    this.baseX = gridInputs.baseX; this.baseY = gridInputs.baseY;
    this.dispose(false);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (data, loc, type, normalized) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, type, normalized, 0, 0);
      this.buffers.push(b);
    };
    buf(positions, 0, gl.FLOAT, false);
    buf(normals, 1, gl.FLOAT, false);
    buf(colors, 2, gl.UNSIGNED_BYTE, true);
    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    this.buffers.push(this._indexBuffer);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._built = true;
    this._holeKey = '';
    this.punchHole(holeX, holeY, holeRadius);
  }

  /** Re-punch the hole (indices only; the vertex grid stands). */
  punchHole(holeX, holeY, holeRadius) {
    const key = `${holeX},${holeY},${holeRadius}`;
    if (!this._built || key === this._holeKey) return;
    const gl = this.gl;
    const indices = buildFarRingIndices({
      baseX: this.baseX, baseY: this.baseY, holeX, holeY, holeRadius,
    });
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this.indexCount = indices.length;
    this._holeKey = key;
  }

  /** True when the player has drifted far enough that the grid should
   *  re-centre (build() again) rather than just re-punch. */
  needsRebuild(px, py) {
    return !this._built
      || Math.max(Math.abs(px - this.baseX), Math.abs(py - this.baseY)) > RING_REBUILD_DRIFT;
  }

  /**
   * Draw the ring. Depth untouched (tests nothing, writes nothing -
   * the streamed world paints over it); its OWN projection, because
   * the world's 6000-unit far plane is 7.3 map pixels.
   */
  draw(view, { origin, lightDir, ambient, sunScale, sunColor, moonDir, moonScale = 0, moonColor, fogColor, fogEnd, fovY, aspect }) {
    if (!this._built || !this.indexCount) return;
    const gl = this.gl;
    const far = (RING_RADIUS + 1) * TERRAIN_SIZE * 1.5;
    const projKey = `${fovY},${aspect}`;
    if (projKey !== this._projKey) {
      this._proj = mirrorProjectionX(perspective(fovY, aspect, 40, far));
      this._projKey = projKey;
    }
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.uProj, false, this._proj);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniform3f(this.u.uOrigin, origin[0], origin[1], origin[2]);
    gl.uniform3fv(this.u.uLightDir, lightDir);
    gl.uniform3fv(this.u.uAmbient, ambient);
    gl.uniform1f(this.u.uSunScale, sunScale);
    gl.uniform3fv(this.u.uSunColor, sunColor);
    gl.uniform3fv(this.u.uMoonDir, moonDir ?? FLAT_UP);
    gl.uniform1f(this.u.uMoonScale, moonScale);
    gl.uniform3fv(this.u.uMoonColor, moonColor ?? FLAT_WHITE);
    gl.uniform3fv(this.u.uFogColor, fogColor);
    gl.uniform1f(this.u.uFogEnd, fogEnd);
    // AUDIT EV F-R3: the rim close must key on the NEAREST rim the
    // square mesh can present - an edge midpoint with the base drifted
    // RING_REBUILD_DRIFT toward it - not on the far plane that covers
    // the corners. Keyed on the far plane, the mix at edge midpoints
    // topped out at ~0.885 and tall ring terrain terminated against
    // the sky as a faint unblended straight edge at the four cardinal
    // directions; only the corners actually dissolved.
    const rimEnd = (RING_RADIUS - RING_REBUILD_DRIFT) * TERRAIN_SIZE * 0.95;
    gl.uniform1f(this.u.uRimStart, rimEnd * 0.6);
    gl.uniform1f(this.u.uRimEnd, rimEnd);
    gl.uniform1f(this.u.uHazeHold, RING_HAZE_HOLD);
    // depth off whole: like the sky it extends, and the streamed world
    // repaints everything nearer; culling off under the mirrored
    // projection (the handedness law every fullscreen pass learned).
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    // no program save/restore: this pass draws inside the host's
    // sky-to-markForeignPass span, where the renderer's EV6 shadows
    // are already due their reset (the R9 law).
  }

  /** Free the GL objects (every allocation has an owner). */
  dispose(whole = true) {
    const gl = this.gl;
    for (const b of this.buffers) gl.deleteBuffer(b);
    this.buffers = [];
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vao = null;
    this._built = false;
    this.indexCount = 0;
    if (whole && this.program) { gl.deleteProgram(this.program); this.program = null; }
  }
}
