// Precipitation: rain streaks and drifting snow as a shader-animated
// particle volume that wraps around the camera - zero per-frame CPU.
// Presentation is ours (Port-Doctrine); DFU uses Unity particle prefabs
// whose values live in animation curves, so only the particle CAP (1000,
// Rain_Particles maxNumParticles) is anchored. Rain quads stretch along
// the fall direction (streaks), snow quads face the camera and drift on
// a per-particle sine. Depth-tested against the world, no depth writes,
// alpha blended, drawn after all other passes. Deliberately unfogged
// (the volume hugs the camera inside any fog's near field).

const PRECIP_VS = `#version 300 es
layout(location=0) in vec3 aSeed;   // 0..1 per particle
layout(location=1) in vec2 aCorner; // -0.5..0.5
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform float uTime;
uniform vec3 uBox;    // wrap volume around the camera
uniform float uFall;  // units per second downward
uniform float uDrift; // sine drift amplitude (snow)
uniform vec2 uSlant;  // constant xz wind per unit fall (rain)
uniform vec2 uSize;
uniform int uSnow;
// EE8 (Enhanced Environments): the enhanced profile's terms. uWindOff is
// the wind's travel INTEGRATED on the CPU - never speed multiplied by
// uptime, because uptime is tens of seconds and the smallest change in
// a gusting wind would then move every drop by metres at once. uEnh is
// 0 for the classic profile, and every term it gates is byte-for-byte
// what this pass always did when it is.
uniform vec2 uWindOff;
uniform float uEnh;
out float vFade;
out float vT;
void main() {
  // Base position advances with time and wraps inside the volume, then
  // recenters on the camera.
  float phase = aSeed.x * 37.0 + aSeed.z * 91.0;
  // a per-particle GUST, so the enhanced sheet is not one rigid direction
  float gust = mix(1.0, 0.75 + fract(phase * 0.371) * 0.5, uEnh);
  float fallY = aSeed.y * uBox.y - uTime * uFall * gust;
  vec2 travel = mix(uTime * uSlant, uWindOff * gust, uEnh);
  vec3 local = vec3(
    mod(aSeed.x * uBox.x + travel.x + (uSnow == 1 ? sin(uTime * 0.7 + phase) * uDrift : 0.0), uBox.x),
    mod(fallY, uBox.y),
    mod(aSeed.z * uBox.z + travel.y + (uSnow == 1 ? cos(uTime * 0.6 + phase * 1.3) * uDrift : 0.0), uBox.z)
  );
  vec3 center = uCamPos - uBox * 0.5 + local;

  // Rain streaks align with the fall direction; snow squares face the
  // camera about Y (billboard convention). EE8: in the enhanced profile
  // the fall direction is the ACTUAL velocity - the integrated wind's
  // rate against the fall - so a driven drop leans with the wind and its
  // streak is LONGER, because its length is its speed.
  vec2 windRate = mix(uSlant, uSlant * gust, uEnh);
  vec3 fallDir = normalize(vec3(windRate.x, -uFall * gust, windRate.y));
  vec3 upAxis = uSnow == 1 ? vec3(0.0, 1.0, 0.0) : -fallDir;
  float len = uSize.y * mix(1.0, length(vec3(windRate.x, uFall * gust, windRate.y)) / max(1.0, uFall), uEnh * float(uSnow == 0));
  vec3 world = center
    + uCamRight * (aCorner.x * uSize.x)
    + upAxis * (aCorner.y * len);
  vT = aCorner.y + 0.5;
  // Fade particles near the volume edge to hide the wrap.
  vec3 edge = abs(local / uBox - 0.5) * 2.0;
  vFade = 1.0 - smoothstep(0.85, 1.0, max(edge.x, edge.z));
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const PRECIP_FS = `#version 300 es
precision highp float;
// EE8: uSnow is read here now, and a uniform shared by two stages must
// carry the SAME precision in both. The vertex stage's ints are highp by
// default and a fragment stage's are mediump, so without this line the
// program refuses to link: "Precisions of uniform 'uSnow' differ" - and
// the exterior rendered no frame at all under rain. Found by the world
// gate, named by the browser console.
precision highp int;
in float vFade;
in float vT;
uniform vec4 uColor;
uniform int uSnow;
uniform float uEnh;
out vec4 outColor;
void main() {
  // EE8: an enhanced rain drop is bright at its HEAD and fades along
  // its tail - the eye reads the bright end as the leading one, which
  // is what makes a streak fall rather than rise. The classic profile
  // keeps its flat colour.
  float head = uSnow == 1 ? 1.0 : smoothstep(0.0, 0.35, vT) * 1.15;
  float a = uColor.a * vFade * mix(1.0, head, uEnh);
  outColor = vec4(uColor.rgb, a);
}`;

export const PRECIP_MAX_PARTICLES = 1000; // Rain_Particles_Splash maxNumParticles (AUDIT 23: the sibling named Rain_Particles carries 10000; this cap anchors the splash object)
const RAIN = {
  count: PRECIP_MAX_PARTICLES,
  box: [50, 30, 50],
  fall: 22,
  drift: 0,
  slant: [2.5, 1.2],
  size: [0.02, 0.45],
  color: [0.55, 0.62, 0.72, 0.35],
};
const SNOW = {
  count: 800,
  box: [45, 28, 45],
  fall: 1.6,
  drift: 0.8,
  slant: [0.3, 0.2],
  size: [0.07, 0.07],
  color: [1, 1, 1, 0.85],
};
// EE8: THE ENHANCED PROFILES, from the Enhanced Environments lab. The
// classic ones above anchor DFU's own cap; these are the lab's volume:
// a denser fall, and a wind that DRIVES it - the slant here is the base
// the weather's own wind multiplies, so a gale leans the rain hard and a
// calm barely tilts it. Presentation is ours (Port-Doctrine); only the
// classic cap is anchored, and classic keeps it.
export const PRECIP_ENHANCED_MAX = 26000;
const RAIN_ENH = { ...RAIN, count: 26000, box: [42, 26, 42], size: [0.014, 0.42], color: [0.62, 0.68, 0.78, 0.30] };
const STORM_ENH = { ...RAIN_ENH, count: PRECIP_ENHANCED_MAX, size: [0.014, 0.5], color: [0.58, 0.64, 0.74, 0.34] };
const SNOW_ENH = { ...SNOW, count: 18000, box: [42, 26, 42], drift: 0.9, size: [0.06, 0.06] };

export class PrecipitationRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, PRECIP_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, PRECIP_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    this.program = prog;
    for (const u of ['uProj', 'uView', 'uCamPos', 'uCamRight', 'uTime', 'uBox', 'uFall', 'uDrift', 'uSlant', 'uSize', 'uSnow', 'uColor', 'uWindOff', 'uEnh']) {
      this[u] = gl.getUniformLocation(prog, u);
    }

    // One buffer sized for the LARGEST set - EE8's enhanced storm - and
    // every profile draws a prefix of it. Per-particle quad (4 verts).
    const n = PRECIP_ENHANCED_MAX;
    const verts = new Float32Array(n * 4 * 5);
    const indices = new Uint32Array(n * 6);
    const corners = [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]];
    let s = 1;
    const rand = () => {
      // Deterministic LCG so the volume is identical every load.
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < n; i++) {
      const seed = [rand(), rand(), rand()];
      for (let c = 0; c < 4; c++) {
        const o = (i * 4 + c) * 5;
        verts[o] = seed[0];
        verts[o + 1] = seed[1];
        verts[o + 2] = seed[2];
        verts[o + 3] = corners[c][0];
        verts[o + 4] = corners[c][1];
      }
      const b = i * 4;
      const io = i * 6;
      indices[io] = b; indices[io + 1] = b + 2; indices[io + 2] = b + 1;
      indices[io + 3] = b; indices[io + 4] = b + 3; indices[io + 5] = b + 2;
    }
    /** EE8: the profile. false = classic (DFU's cap, byte for byte);
     *  true = the lab's volume, driven by the weather's wind. Set by the
     *  host from the Enhanced Environments switch. */
    this.enhanced = false;
    /** EE8: the wind's travel, integrated by the host in world units. */
    this.windOff = new Float32Array(2);
    /** EE8: an optional cap on the enhanced count (?rain=<n>), for gates. */
    this.countCap = null;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  /** mode 'rain'|'storm'|'snow'; storm shares the rain look. */
  draw(mode, proj, view, camPos, camRight, timeSeconds) {
    const cfg = this.enhanced
      ? (mode === 'snow' ? SNOW_ENH : mode === 'storm' ? STORM_ENH : RAIN_ENH)
      : (mode === 'snow' ? SNOW : RAIN);
    // EE8: ?rain=<n> caps the enhanced volume - a software rasteriser
    // cannot gate 26,000 quads inside its timeout, and a capped run still
    // exercises every enhanced term. Production is the profile's count.
    const cap = this.enhanced ? this.countCap : null;
    const count = cap ? Math.min(cfg.count, cap) : cfg.count;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3fv(this.uCamPos, camPos);
    gl.uniform3fv(this.uCamRight, camRight);
    gl.uniform1f(this.uTime, timeSeconds);
    // EV2: the config vectors upload from arrays built ONCE - four
    // fresh Float32Arrays per frame sat in a pass whose header claims
    // zero per-frame CPU, and now it is true again.
    if (!cfg._gpu) cfg._gpu = { box: new Float32Array(cfg.box), slant: new Float32Array(cfg.slant), size: new Float32Array(cfg.size), color: new Float32Array(cfg.color) };
    gl.uniform3fv(this.uBox, cfg._gpu.box);
    gl.uniform1f(this.uFall, cfg.fall);
    gl.uniform1f(this.uDrift, cfg.drift);
    gl.uniform2fv(this.uSlant, cfg._gpu.slant);
    gl.uniform2fv(this.uSize, cfg._gpu.size);
    gl.uniform1i(this.uSnow, mode === 'snow' ? 1 : 0);
    gl.uniform4fv(this.uColor, cfg._gpu.color);
    gl.uniform2fv(this.uWindOff, this.windOff);      // EE8
    gl.uniform1f(this.uEnh, this.enhanced ? 1 : 0);  // EE8
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    // EV2: no program restore, and no gl.getParameter round-trip to
    // learn what to restore - the R9 law (renderer.js drawMesh) is
    // that EVERY draw entry point owns its program binding, so the
    // next pass binds its own and a restore here was paying a
    // synchronous driver query per frame for nothing.
  }
}
