// ═══════════════════════════════════════════════════════════════════
// U60 — THE OVERWORLD PASS: the Iliac Bay relief, its markers, the
// route line and the cloud deck, as one self-contained pass.
//
// The SkyRenderer/PrecipitationRenderer shape: this class takes the
// ONE shared gl, compiles its own programs, owns its own VAOs, takes
// proj/view as ARGUMENTS, saves the previous program and restores it,
// and brackets every piece of state it changes - so it is safe to run
// anywhere in a frame (it runs inside the overworld window's own
// second beginFrame, the automap's precedent).
//
// The relief is OUR data in a right-handed frame (east +x, north +z,
// up +y), not DFU's left-handed world, so the camera uses a PLAIN
// perspective - no mirrorProjectionX - and every draw here brackets
// CULL_FACE off (the global state is frontFace(CW) for the mirrored
// world passes; the sky-blue-screen lesson).
//
// Draw order is meaning: backdrop (the high-altitude sky), terrain
// (depth on), route then markers (depth OFF - a marker buried in a
// hillside is a location the player cannot see), rings, and the cloud
// deck LAST - it is translucent and must cover what it hides.
// ═══════════════════════════════════════════════════════════════════

const TERRAIN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
uniform mat4 uProj, uView;
out vec3 vColor;
out float vDist;
void main() {
  vColor = aColor;
  vec4 vp = uView * vec4(aPos, 1.0);
  vDist = length(vp.xyz);
  gl_Position = uProj * vp;
}`;
const TERRAIN_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vDist;
uniform vec3 uHaze;
uniform float uHazeDensity;
out vec4 o;
void main() {
  float f = 1.0 - exp(-vDist * uHazeDensity);
  o = vec4(mix(vColor, uHaze, f * 0.85), 1.0);
}`;

const MARKER_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
layout(location=2) in float aSize;
uniform mat4 uProj, uView;
uniform float uScale;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
  gl_PointSize = clamp(aSize * uScale, 2.5, 28.0);
}`;
const MARKER_FS = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  // a dark rim so a pale dot still reads on pale sand
  float rim = smoothstep(0.32, 0.5, r);
  o = vec4(mix(vColor, vColor * 0.25, rim), 1.0);
}`;

const RING_VS = `#version 300 es
layout(location=0) in vec2 aPos;   // unused placeholder attr for a 1-vertex draw
uniform mat4 uProj, uView;
uniform vec3 uCenter;
uniform float uSize;
void main() {
  gl_Position = uProj * uView * vec4(uCenter, 1.0);
  gl_PointSize = uSize;
}`;
const RING_FS = `#version 300 es
precision highp float;
uniform vec4 uRingColor;
uniform float uThickness;   // ring inner edge, 0..0.5
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5 || r < uThickness) discard;
  o = uRingColor;
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uProj, uView;
void main() { gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 uLineColor;
out vec4 o;
void main() { o = uLineColor; }`;

// The deck is a single huge quad; the clouds are made in the fragment
// shader from hash noise drifting on uTime - no texture, no CPU.
const CLOUD_VS = `#version 300 es
layout(location=0) in vec2 aPos;   // xz corners
uniform mat4 uProj, uView;
uniform float uCloudY;
out vec2 vXZ;
void main() {
  vXZ = aPos;
  gl_Position = uProj * uView * vec4(aPos.x, uCloudY, aPos.y, 1.0);
}`;
const CLOUD_FS = `#version 300 es
precision highp float;
in vec2 vXZ;
uniform float uTime;
uniform float uCloudAlpha;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x),
             mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vXZ * 0.035 + vec2(uTime * 0.012, uTime * 0.004);
  float n = vnoise(p) * 0.55 + vnoise(p * 2.7 + 13.1) * 0.3 + vnoise(p * 6.1 - 7.7) * 0.15;
  float body = smoothstep(0.42, 0.72, n);
  vec3 c = mix(vec3(0.78, 0.82, 0.88), vec3(0.99, 0.99, 1.0), body);
  o = vec4(c, body * uCloudAlpha);
}`;

const BACKDROP_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out float vY;
void main() { vY = aPos.y * 0.5 + 0.5; gl_Position = vec4(aPos, 0.99999, 1.0); }`;
const BACKDROP_FS = `#version 300 es
precision highp float;
in float vY;
uniform vec3 uTop, uBottom;
out vec4 o;
void main() { o = vec4(mix(uBottom, uTop, vY), 1.0); }`;

function buildProgram(gl, vsSrc, fsSrc) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`overworld shader: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`overworld link: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

export class OverworldRenderer {
  constructor(gl) {
    this.gl = gl;
    this._terrain = null;   // { vao, indexCount, buffers[] }
    this._markers = null;   // { vao, count, buffers[] }
    this._route = null;     // { vao, count, buffer }
    this._cloud = null;     // { vao, buffer }
    this._fsTri = null;     // backdrop fullscreen triangle

    this.pTerrain = buildProgram(gl, TERRAIN_VS, TERRAIN_FS);
    this.pMarker = buildProgram(gl, MARKER_VS, MARKER_FS);
    this.pRing = buildProgram(gl, RING_VS, RING_FS);
    this.pLine = buildProgram(gl, LINE_VS, LINE_FS);
    this.pCloud = buildProgram(gl, CLOUD_VS, CLOUD_FS);
    this.pBackdrop = buildProgram(gl, BACKDROP_VS, BACKDROP_FS);
    const U = (p, n) => gl.getUniformLocation(p, n);
    this.u = {
      tProj: U(this.pTerrain, 'uProj'), tView: U(this.pTerrain, 'uView'),
      tHaze: U(this.pTerrain, 'uHaze'), tHazeD: U(this.pTerrain, 'uHazeDensity'),
      mProj: U(this.pMarker, 'uProj'), mView: U(this.pMarker, 'uView'), mScale: U(this.pMarker, 'uScale'),
      rProj: U(this.pRing, 'uProj'), rView: U(this.pRing, 'uView'), rCenter: U(this.pRing, 'uCenter'),
      rSize: U(this.pRing, 'uSize'), rColor: U(this.pRing, 'uRingColor'), rThick: U(this.pRing, 'uThickness'),
      lProj: U(this.pLine, 'uProj'), lView: U(this.pLine, 'uView'), lColor: U(this.pLine, 'uLineColor'),
      cProj: U(this.pCloud, 'uProj'), cView: U(this.pCloud, 'uView'), cY: U(this.pCloud, 'uCloudY'),
      cTime: U(this.pCloud, 'uTime'), cAlpha: U(this.pCloud, 'uCloudAlpha'),
      bTop: U(this.pBackdrop, 'uTop'), bBottom: U(this.pBackdrop, 'uBottom'),
    };
  }

  _freeSet(set) {
    if (!set) return;
    const gl = this.gl;
    if (set.vao) gl.deleteVertexArray(set.vao);
    for (const b of set.buffers ?? []) gl.deleteBuffer(b);
  }

  /** The relief, uploaded once per session - the world map does not
   *  change shape. Also sizes the cloud deck and the backdrop. */
  setTerrain({ positions, colors, indices, width, height }) {
    const gl = this.gl;
    this._freeSet(this._terrain);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this._terrain = { vao, indexCount: indices.length, buffers: [pb, cb, ib] };

    // cloud deck quad over the whole relief with a margin, and the
    // backdrop's fullscreen triangle
    this._freeSet(this._cloud);
    const m = 120;
    const quad = new Float32Array([
      -m, -(height + m), width + m, -(height + m), -m, m,
      width + m, -(height + m), width + m, m, -m, m,
    ]);
    const cvao = gl.createVertexArray();
    gl.bindVertexArray(cvao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this._cloud = { vao: cvao, buffers: [qb] };

    if (!this._fsTri) {
      const tvao = gl.createVertexArray();
      gl.bindVertexArray(tvao);
      const tb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this._fsTri = { vao: tvao, buffers: [tb] };
    }
  }

  /** The markers, re-uploaded whenever a filter or discovery changes -
   *  fifteen thousand points is one small dynamic buffer. */
  setMarkers({ positions, colors, sizes }) {
    const gl = this.gl;
    this._freeSet(this._markers);
    if (!positions || positions.length === 0) { this._markers = null; return; }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this._markers = { vao, count: positions.length / 3, buffers: [pb, cb, sb] };
  }

  /** The flight's route polyline, or null to clear it. */
  setRoute(points) {
    const gl = this.gl;
    this._freeSet(this._route);
    if (!points || points.length < 6) { this._route = null; return; }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this._route = { vao, count: points.length / 3, buffers: [b] };
  }

  /**
   * One overworld frame. proj/view are the window's own camera
   * (PLAIN perspective - see header). opts:
   *   time, cloudY, cloudAlpha - the deck
   *   markerScale - screen-px multiplier from the zoom
   *   haze {color:[r,g,b], density} - distance cue
   *   sky {top, bottom} - backdrop gradient
   *   rings - [{ center:[x,y,z], size, color:[r,g,b,a], thickness }]
   */
  draw(proj, view, opts = {}) {
    const gl = this.gl;
    const prev = gl.getParameter(gl.CURRENT_PROGRAM);
    gl.disable(gl.CULL_FACE);

    // backdrop - farthest depth, no write, so terrain draws over it
    const sky = opts.sky ?? { top: [0.045, 0.06, 0.10], bottom: [0.10, 0.13, 0.18] };
    gl.useProgram(this.pBackdrop);
    gl.depthMask(false);
    gl.uniform3fv(this.u.bTop, sky.top);
    gl.uniform3fv(this.u.bBottom, sky.bottom);
    gl.bindVertexArray(this._fsTri?.vao ?? null);
    if (this._fsTri) gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);

    if (this._terrain) {
      gl.useProgram(this.pTerrain);
      gl.uniformMatrix4fv(this.u.tProj, false, proj);
      gl.uniformMatrix4fv(this.u.tView, false, view);
      const haze = opts.haze ?? { color: [0.10, 0.13, 0.18], density: 0.0016 };
      gl.uniform3fv(this.u.tHaze, haze.color);
      gl.uniform1f(this.u.tHazeD, haze.density);
      gl.bindVertexArray(this._terrain.vao);
      gl.drawElements(gl.TRIANGLES, this._terrain.indexCount, gl.UNSIGNED_INT, 0);
    }

    // route + markers ride ON the picture, not in it: depth off
    gl.disable(gl.DEPTH_TEST);
    if (this._route) {
      gl.useProgram(this.pLine);
      gl.uniformMatrix4fv(this.u.lProj, false, proj);
      gl.uniformMatrix4fv(this.u.lView, false, view);
      gl.uniform4fv(this.u.lColor, opts.routeColor ?? [1.0, 0.86, 0.45, 1.0]);
      gl.bindVertexArray(this._route.vao);
      gl.drawArrays(gl.LINE_STRIP, 0, this._route.count);
    }
    if (this._markers) {
      gl.useProgram(this.pMarker);
      gl.uniformMatrix4fv(this.u.mProj, false, proj);
      gl.uniformMatrix4fv(this.u.mView, false, view);
      gl.uniform1f(this.u.mScale, opts.markerScale ?? 1);
      gl.bindVertexArray(this._markers.vao);
      gl.drawArrays(gl.POINTS, 0, this._markers.count);
    }
    for (const ring of opts.rings ?? []) {
      gl.useProgram(this.pRing);
      gl.uniformMatrix4fv(this.u.rProj, false, proj);
      gl.uniformMatrix4fv(this.u.rView, false, view);
      gl.uniform3fv(this.u.rCenter, ring.center);
      gl.uniform1f(this.u.rSize, ring.size);
      gl.uniform4fv(this.u.rColor, ring.color ?? [1, 1, 1, 1]);
      gl.uniform1f(this.u.rThick, ring.thickness ?? 0.36);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this._fsTri?.vao ?? null);
      gl.drawArrays(gl.POINTS, 0, 1);
      gl.disable(gl.BLEND);
    }
    gl.enable(gl.DEPTH_TEST);

    // the deck last - translucent over everything it hides
    if (this._cloud && (opts.cloudAlpha ?? 0) > 0.002) {
      gl.useProgram(this.pCloud);
      gl.uniformMatrix4fv(this.u.cProj, false, proj);
      gl.uniformMatrix4fv(this.u.cView, false, view);
      gl.uniform1f(this.u.cY, opts.cloudY ?? 20);
      gl.uniform1f(this.u.cTime, opts.time ?? 0);
      gl.uniform1f(this.u.cAlpha, opts.cloudAlpha);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(this._cloud.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(prev);
  }

  /** Every allocation has an owner (AUDIT 17e). */
  dispose() {
    const gl = this.gl;
    this._freeSet(this._terrain); this._terrain = null;
    this._freeSet(this._markers); this._markers = null;
    this._freeSet(this._route); this._route = null;
    this._freeSet(this._cloud); this._cloud = null;
    this._freeSet(this._fsTri); this._fsTri = null;
    for (const p of [this.pTerrain, this.pMarker, this.pRing, this.pLine, this.pCloud, this.pBackdrop]) {
      gl.deleteProgram(p);
    }
  }
}
