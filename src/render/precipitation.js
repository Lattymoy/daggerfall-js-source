// Precipitation: rain streaks and drifting snow as a shader-animated
// particle volume that wraps around the camera - zero per-frame CPU.
// Presentation is ours (Port-Doctrine); DFU uses Unity particle prefabs
// whose values live in animation curves, so only the particle CAP (1000,
// Rain_Particles maxNumParticles) is anchored. Rain quads stretch along
// the fall direction (streaks), snow quads face the camera and drift on
// a per-particle sine. Depth-tested against the world, no depth writes,
// alpha blended, drawn after all other passes. Deliberately unfogged
// (the volume hugs the camera inside any fog's near field).
//
// AUDIT 58 (f3/render): TWO PROFILES ARE TWO PROGRAMS, not one shader
// with a switch. EE8 mixed an enhanced arm into the stages below under
// `uEnh`; WX1 then gave the enhanced lane the lab's own program and
// returned from draw() into it before any of that arm could be reached
// (`if (this.enhanced) return this.drawLab(...)`, below) - so every
// `uEnh` term was dead: uploaded as 0 on every frame the classic lane
// drew, and never once as 1. The mixed arms, the enhanced profiles and
// the 26,000-particle buffer they sized are gone with the branch that
// could have reached them; the stages below are the classic pass byte
// for byte as it stood before EE8, and the enhanced look is WX1's
// program (drawLab), untouched. The classic lane pays for the classic
// cap alone - the lab's program and its 26,000 instances are built for
// the lane that draws them, and for no other.

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
out float vFade;
void main() {
  // Base position advances with time and wraps inside the volume, then
  // recenters on the camera.
  float phase = aSeed.x * 37.0 + aSeed.z * 91.0;
  float fallY = aSeed.y * uBox.y - uTime * uFall;
  vec3 local = vec3(
    mod(aSeed.x * uBox.x + uTime * uSlant.x + (uSnow == 1 ? sin(uTime * 0.7 + phase) * uDrift : 0.0), uBox.x),
    mod(fallY, uBox.y),
    mod(aSeed.z * uBox.z + uTime * uSlant.y + (uSnow == 1 ? cos(uTime * 0.6 + phase * 1.3) * uDrift : 0.0), uBox.z)
  );
  vec3 center = uCamPos - uBox * 0.5 + local;

  // Rain streaks align with the fall direction; snow squares face the
  // camera about Y (billboard convention).
  vec3 fallDir = normalize(vec3(uSlant.x, -uFall, uSlant.y));
  vec3 upAxis = uSnow == 1 ? vec3(0.0, 1.0, 0.0) : -fallDir;
  vec3 world = center
    + uCamRight * (aCorner.x * uSize.x)
    + upAxis * (aCorner.y * uSize.y);
  // Fade particles near the volume edge to hide the wrap.
  vec3 edge = abs(local / uBox - 0.5) * 2.0;
  vFade = 1.0 - smoothstep(0.85, 1.0, max(edge.x, edge.z));
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const PRECIP_FS = `#version 300 es
precision highp float;
in float vFade;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = vec4(uColor.rgb, uColor.a * vFade);
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
// AUDIT 58 (f3/render): EE8's RAIN_ENH/STORM_ENH/SNOW_ENH profiles and
// their PRECIP_ENHANCED_MAX = 26000 stood here. Their only reader was
// the ternary in draw() below, downstream of WX1's early return into
// drawLab - unreachable from the day WX1 landed. The lab's volume is
// LAB_COUNTS, on the lab's own program; DFU's cap above is the classic
// one, and it is the only one this program draws.


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

/** One compile, shared by the classic program and the lab's. */
function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class PrecipitationRenderer {
  /** AUDIT 58 (f3/render): `opts.enhanced` is the LANE, not the frame -
   *  the host passes `sky.enhanced` (scenes/shared.js's createSkyController
   *  return), which is fixed for a scene, while the per-frame
   *  `precip.enhanced` field below rides the deck. The lane builds WX1's
   *  program here, so a shader fault is still a constructor fault the boot
   *  probe sees; the classic lane never compiles it and never uploads its
   *  26,000 instances. */
  constructor(gl, opts = {}) {
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, PRECIP_VS));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, PRECIP_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    this.program = prog;
    for (const u of ['uProj', 'uView', 'uCamPos', 'uCamRight', 'uTime', 'uBox', 'uFall', 'uDrift', 'uSlant', 'uSize', 'uSnow', 'uColor']) {
      this[u] = gl.getUniformLocation(prog, u);
    }

    /** the wind's instantaneous rate, m/s, for the streak's lean and the
     *  flake's throw - the lab's uWindV */
    this.windV = new Float32Array(2);
    this.labProgram = null;
    if (opts.enhanced) this._buildLab();

    // One buffer sized for the LARGEST set this program can draw, and
    // the smaller profile draws a prefix of it. Per-particle quad (4
    // verts). AUDIT 58 (f3/render): this was PRECIP_ENHANCED_MAX =
    // 26,000 - a 26,000-iteration build and ~2.7 MB of buffers for a
    // program whose only reachable counts are RAIN's 1000 (DFU's
    // Rain_Particles_Splash cap) and SNOW's 800. The lab's 26,000 are
    // instances of the LAB's buffer, in _buildLab.
    const n = Math.max(RAIN.count, SNOW.count);
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
     *  host each frame from the sky's deck; it opens at the lane's own
     *  answer so a renderer built for the enhanced lane is never asked
     *  to draw the lab's program before it owns one. */
    this.enhanced = !!opts.enhanced;
    /** EE8: the wind's travel, integrated by the host in world units. */
    this.windOff = new Float32Array(2);
    /** EE8: an optional cap on the enhanced count (?rain=<n>), for gates.
     *  AUDIT 58 (f3/render): taken at CONSTRUCTION, from the host's own
     *  boot params - it is a page dial and cannot change during a load,
     *  and both hosts were re-parsing `location.search` for it on every
     *  frame that rain drew, in the pass whose header claims zero
     *  per-frame CPU. */
    this.countCap = opts.countCap ?? null;
    /** WX2: the front's intensity, 0..1 - the fraction of the profile's
     *  drops on screen. 1 is the whole profile (WX1's volume). The hosts
     *  walk it on the front under the enhanced environments; the classic
     *  draw never reads it and never sets it. */
    this.intensity = 1;
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

  /** WX1: the LAB's program beside the classic one - its own shaders,
   *  its own instance layout, its own VAO. The enhanced lane builds it
   *  in the constructor, so a shader fault is a constructor fault the
   *  boot probe sees; drawLab builds it on demand, so a renderer that
   *  is handed the deck without the lane's flag still draws the lab's
   *  rain rather than throwing. AUDIT 58 (f3/render): it used to be
   *  built unconditionally - the classic skin compiled two stages it
   *  can never bind and uploaded 26,000 instances it can never draw. */
  _buildLab() {
    const gl = this.gl;
    const lp = gl.createProgram();
    gl.attachShader(lp, compileShader(gl, gl.VERTEX_SHADER, LAB_WX_VS));
    gl.attachShader(lp, compileShader(gl, gl.FRAGMENT_SHADER, LAB_WX_FS));
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
  }

  /** mode 'rain'|'storm'|'snow'; storm shares the rain look. */
  /** WX1: the lab's draw, term for term - blend src-alpha, depth write
   *  off, the eye's right and WORLD up (a flake faces the camera about Y
   *  only), the lab's box, fall and counts, the wind's rate and its
   *  integrated travel. */
  drawLab(mode, proj, view, camPos, camRight, timeSeconds) {
    const gl = this.gl;
    if (!this.labProgram) this._buildLab();
    const kind = mode === 'snow' ? 1 : 0;
    // WX2: the lab's own scaling - `Math.round(wx.n * wsky.fall)` in
    // grass-proto.html's frame() - the profile times the front's
    // intensity, so a sprinkle is a few thousand drops and a front
    // fills the volume in rather than switching it on.
    const full = Math.round((LAB_COUNTS[mode] ?? LAB_COUNTS.rain) * Math.min(1, Math.max(0, this.intensity)));
    const count = this.countCap ? Math.min(full, this.countCap) : full;
    if (count <= 0) return;
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
    // AUDIT 58 (f3/render): below this line `this.enhanced` is FALSE, and
    // every arm that asked it again was dead - the enhanced profiles it
    // chose, and the countCap it read (?rain=<n> caps the LAB's volume,
    // drawLab above, which is the only volume big enough to need it).
    // What is left is the classic profile, at DFU's cap.
    const cfg = mode === 'snow' ? SNOW : RAIN;
    const count = cfg.count;
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
