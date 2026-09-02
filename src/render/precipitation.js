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


// ═══════════════════════════════════════════════════════════════════
// WX1 (Mac: implement the weather effects BYTE-EXACT to the proto - rain
// and snow still stick to the screen in game). The enhanced profile is
// no longer a mixed branch of DFU's sheet: it is the lab's own program,
// both stages copied VERBATIM from grass-proto.html, with the lab's
// instance layout (a world-space seed in a 42m box plus a phase), the
// lab's fall speeds (22 rain, 1.6 snow), the lab's counts (26,000 and
// 20,000), the lab's wind law (integrated travel, per-drop gust) and
// the lab's wrap:
//
//     p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
//
// which is the whole difference between rain that falls through the
// world and rain that sticks to the screen. The old profile wrapped a
// CAMERA-LOCAL position and then added the camera to it, so every drop
// moved with the player; the lab wraps a WORLD position around the eye,
// so moving reveals other drops and never drags the ones in view. The
// classic program above is untouched and still draws the classic skin.
const LAB_HEAD = `#version 300 es
precision highp float;
`;
export const LAB_WX_VS = LAB_HEAD + `layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSeed;      // x,y,z in the box + phase
uniform mat4 uVP; uniform vec3 uEye, uRight, uUp;
uniform float uTime, uKind, uBox, uFall;
uniform vec2 uWindV, uWindOff;
out float vT; out float vSeed;
void main(){
  vSeed = aSeed.w;
  // 1. a volume that FOLLOWS the eye, wrapped - a fixed count covers
  // any view, and turning never thins the fall
  vec3 p = aSeed.xyz;
  float fall = uFall * (0.72 + fract(vSeed*7.3)*0.6);
  // PROTO-9 (Mac: the wind should have a HEAVY impact on direction).
  // The drift was a tenth of the fall and the streaks stayed vertical.
  // Now the horizontal speed is a real fraction OF the fall - a gale
  // drives rain nearly sideways - and every drop takes a per-instance
  // gust so the sheet is not one rigid direction. The streak is then
  // stretched along the ACTUAL velocity, which is what makes a driven
  // rain read as driven rather than as a leaning texture.
  // PROTO-19 (2, Mac: the particles fall inverted when it first
  // starts). They were advected by wind multiplied by uTime - a CHANGING wind
  // multiplied by the page's whole uptime. uTime is tens of seconds,
  // so the smallest gust change moved every drop by metres at once,
  // and at the start, when the front is ramping the wind hardest, the
  // field lurched sideways and backwards faster than it fell: drops
  // visibly travelling the wrong way. The wind's displacement is
  // INTEGRATED on the CPU now and handed over as a distance already
  // travelled, so a change in the wind changes where drops go NEXT
  // and never where they have already been.
  float gust = 0.75 + fract(vSeed*3.7)*0.5;
  vec3 drift = vec3(uWindV.x, 0.0, uWindV.y) * gust;
  p += vec3(uWindOff.x, 0.0, uWindOff.y) * gust;
  p.y -= uTime * fall;
  p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
  // PROTO-14 (7, Mac: the particles show upright at the start instead
  // of coming down). The streak was oriented from a velocity whose
  // horizontal part is the wind - and the billboard's side vector came
  // from a cross product with the direction to the EYE, which goes
  // DEGENERATE for any drop near the eye line: a zero-length cross
  // normalises to NaN, the quad collapses, and what survives reads as
  // a standing sliver. Gravity now always dominates the orientation,
  // and the side vector falls back to a fixed axis when the cross is
  // too short to trust.
  vec3 vel = normalize(vec3(drift.x, -max(fall, 4.0), drift.z));
  float sz, len;
  if (uKind < 0.5) {
    // 2. a DROP is a streak along its own velocity, length = speed
    sz = 0.010 + fract(vSeed*13.1)*0.006;
    len = 0.06 + fall*0.030;
    // the streak's LENGTH is the true speed, so a driven drop is a
    // longer streak as well as a leaning one
    len *= length(vec3(drift.x, fall, drift.z)) / max(1.0, fall);
    p += vel * (aCorner.y-0.5) * len;
    vec3 toEye = uEye - p;
    vec3 c0 = cross(vel, toEye);
    vec3 side = length(c0) > 1e-4 ? normalize(c0) : vec3(1.0, 0.0, 0.0);
    p += side * (aCorner.x-0.5) * sz;
  } else {
    // 3. a FLAKE tumbles on its own phase, and faces the camera
    sz = 0.035 + fract(vSeed*11.7)*0.045;
    // a flake is LIGHT: the wind throws it much further than rain, and
    // its tumble rides on top of that
    float w1 = sin(uTime*1.1 + vSeed*24.0), w2 = cos(uTime*0.7 + vSeed*11.0);
    p += vec3(w1, 0.0, w2) * (0.55 + length(uWindV) * 0.35);
    p += (uRight*(aCorner.x-0.5) + uUp*(aCorner.y-0.5)) * sz;
  }
  vT = aCorner.y;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const LAB_WX_FS = LAB_HEAD + `in float vT; in float vSeed;
uniform float uKind;
out vec4 o;
void main(){
  if (uKind < 0.5) {
    // a drop is bright at its head and fades along the streak
    float a = smoothstep(0.0,0.35,vT) * 0.42;
    o = vec4(vec3(0.72,0.78,0.86), a);
  } else {
    o = vec4(vec3(0.94,0.96,1.0), 0.72);
  }
}`;
export const LAB_BOX = 42;
export const LAB_COUNTS = Object.freeze({ rain: 26000, storm: 26000, snow: 20000 });
export const LAB_FALL = Object.freeze({ rain: 22.0, storm: 22.0, snow: 1.6 });

/** out = a * b, column-major 4x4 - the lab's uVP is proj * view */
function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

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

    // WX1: the LAB's program beside the classic one - its own shaders,
    // its own instance layout, its own VAO. Built here so a shader fault
    // is a constructor fault, which the boot probe sees.
    {
      const lp = gl.createProgram();
      gl.attachShader(lp, compile(gl.VERTEX_SHADER, LAB_WX_VS));
      gl.attachShader(lp, compile(gl.FRAGMENT_SHADER, LAB_WX_FS));
      gl.linkProgram(lp);
      if (!gl.getProgramParameter(lp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(lp));
      this.labProgram = lp;
      this.lab = {};
      for (const u of ['uVP', 'uEye', 'uRight', 'uUp', 'uTime', 'uKind', 'uBox', 'uFall', 'uWindV', 'uWindOff']) this.lab[u] = gl.getUniformLocation(lp, u);
      // the lab's instances: x,y,z in [0, BOX) + a phase, from the lab's
      // own xorshift so the scatter is the lab's scatter
      const n = LAB_COUNTS.rain;
      const inst = new Float32Array(n * 4);
      let s2 = 0x9e3779b9;
      const rnd = () => { s2 ^= s2 << 13; s2 ^= s2 >>> 17; s2 ^= s2 << 5; s2 >>>= 0; return s2 / 4294967296; };
      for (let i = 0; i < n; i++) { inst[i * 4] = rnd() * LAB_BOX; inst[i * 4 + 1] = rnd() * LAB_BOX; inst[i * 4 + 2] = rnd() * LAB_BOX; inst[i * 4 + 3] = rnd(); }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const q = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
      const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
      gl.bindVertexArray(null);
      this.labVao = vao;
      /** the wind's instantaneous rate, m/s, for the streak's lean and the
       *  flake's throw - the lab's uWindV */
      this.windV = new Float32Array(2);
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
  /** WX1: the lab's draw, term for term - blend src-alpha, depth write
   *  off, the eye's right and WORLD up (a flake faces the camera about Y
   *  only), the lab's box, fall and counts, the wind's rate and its
   *  integrated travel. */
  drawLab(mode, proj, view, camPos, camRight, timeSeconds) {
    const gl = this.gl;
    const kind = mode === 'snow' ? 1 : 0;
    const full = LAB_COUNTS[mode] ?? LAB_COUNTS.rain;
    const count = this.countCap ? Math.min(full, this.countCap) : full;
    if (!this._vp) this._vp = new Float32Array(16);
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.labProgram);
    const L = this.lab;
    gl.uniformMatrix4fv(L.uVP, false, this._vp);
    gl.uniform3fv(L.uEye, camPos);
    gl.uniform3fv(L.uRight, camRight);
    gl.uniform3f(L.uUp, 0, 1, 0);
    gl.uniform1f(L.uTime, timeSeconds);
    gl.uniform1f(L.uKind, kind);
    gl.uniform1f(L.uBox, LAB_BOX);
    gl.uniform1f(L.uFall, LAB_FALL[mode] ?? LAB_FALL.rain);
    gl.uniform2fv(L.uWindV, this.windV);
    gl.uniform2fv(L.uWindOff, this.windOff);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.labVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  draw(mode, proj, view, camPos, camRight, timeSeconds) {
    if (this.enhanced) return this.drawLab(mode, proj, view, camPos, camRight, timeSeconds);
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
