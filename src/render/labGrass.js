// ═══════════════════════════════════════════════════════════════════
// GR1 (Mac: integrate the grass BYTE-EXACT with the proto's max range and
// max blades, no exceptions; height 54; none on roads, pathways, water,
// or in winter).
//
// THE SHADERS ARE THE LAB'S, VERBATIM. Both stages are sliced out of
// grass-proto.html by the pin at test time and compared as strings.
// One thing differs, and it is declared here in the open: the lab's
// prelude defines `terrain(p)` as the lab's own noise ground; the game's
// prelude defines `terrain(p)` as the root height the placer baked from
// the real heightmap, carried on a THIRD instance attribute the vertex
// text never has to mention. The vertex stage's text is identical.
//
// THE PLACER IS THE LAB'S LAW: the same xorshift seed, the same span of
// 210m either side, the same clustering (a centre, an angle, a radius
// of rnd*rnd*0.55), the same height law (0.22 + rnd*0.42) * (height/34),
// the same lean, tint and width. The game adds only WHERE a blade may
// stand: on a tile the archive says is grass, not on a road record,
// not on water, and not at all in winter. The scatter walks the lab's
// full 1,200,000 candidates around the eye and keeps the ones that land
// on grass, so the density on a lawn is the lab's density.
//
// The field the lab's grass reads - snow, water, trodden - is a 1x1
// zero texture here: the shader's snow and wet terms are then exactly
// zero, and the text stays the lab's.

export const LAB_GRASS_HEAD = `#version 300 es
precision highp float;
`;
/** the game's prelude: hash/vnoise as the lab has them (the shader body
 *  does not call them, but the prelude is the lab's shape), and
 *  terrain() as the baked root height */
export const GAME_GRASS_FIELD = `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
layout(location=3) in float aRootY;      // GR1: the real ground under this blade, baked by the placer
float terrain(vec2 p){ return aRootY; }`;
export const LAB_GRASS_VS = `layout(location=0) in vec2 aCorner;      // one blade quad, 0..1
layout(location=1) in vec4 aInst;        // xz, height, phase
layout(location=2) in vec4 aInst2;       // lean.xz, tint, width
uniform mat4 uVP; uniform float uTime, uWind, uRange; uniform vec3 uEye, uSunDir;
uniform vec2 uWindDir;
uniform float uSnowFull;           // PROTO-22: the SAME line the ground draws
uniform sampler2D uGField; uniform vec2 uGFieldOrigin; uniform float uGFieldM, uSnowGlobal; uniform vec2 uWindV;
out float vT; out float vTint; out float vFade; out float vLam; out float vSnow; out float vWet;
void main(){
  vec2 root = aInst.xy;
  float d = distance(root, uEye.xz);
  vFade = 1.0 - smoothstep(uRange*0.55, uRange, d);
  // PROTO-18: the fade thins the FIELD, it does not shrink the blades.
  // A hashed threshold drops whole blades with distance, so the count
  // falls away and every blade that remains is its true size.
  if (vFade <= 0.001 || fract(aInst.w * 91.7) > vFade * 1.15) { gl_Position = vec4(2,2,2,1); return; }
  // PROTO-14 (3): THE GRASS KNOWS ABOUT THE GROUND IT STANDS IN.
  // Blades stood up through snow that was supposedly burying them and
  // stayed green in standing water. Snow BURIES them - the depth eats
  // the height, and what is left is bent over and pale; water DROWNS
  // them; and a footfall PUSHES them over, because the field already
  // records where a foot went.
  // PROTO-16 (1, Mac: the grass pops out of the snow when moving).
  // The field is 64m across and the grass is drawn to 90m and beyond,
  // so most blades stand OUTSIDE the window. Their UV clamped to the
  // edge texel, and when the window jumped its 4m block the blades at
  // the boundary flipped between buried and bare in one frame - the
  // pop. Two things fix it, and both are needed: blades outside the
  // window fall back to the GLOBAL snow depth, because snow falls on
  // the whole world and not only on the part being simulated; and the
  // handover is FADED over the last few metres, so no blade changes
  // state in a single step.
  vec2 fuv = (root - uGFieldOrigin) / uGFieldM;
  vec4 fld = texture(uGField, clamp(fuv, 0.0, 1.0));
  vec2 edge = min(fuv, 1.0 - fuv);
  float inWin = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  fld = mix(vec4(0.0, uSnowGlobal, 0.0, 0.0), fld, inWin);
  float snowD = fld.g * (1.0 - fld.b * 0.55);
  float drown = smoothstep(0.10, 0.40, fld.r);
  vSnow = smoothstep(0.02, 0.22, snowD);
  vWet = smoothstep(0.0, 0.35, fld.r) + fld.a * 0.5;
  // PROTO-18 (Mac: grass pops THROUGH THE SNOW during movement, and
  // the snow itself is fine).
  //
  // THE HEIGHT WAS SCALED BY THE DISTANCE FADE. A blade far off stood
  // at 55% of its height and grew to 100% as you approached - which is
  // invisible on bare ground, and on snow is the whole bug: the snow
  // surface is a FIXED line, so a blade that was under it grows up
  // through it as you walk toward it. Every blade in the field does it,
  // continuously, which is exactly "popping through when moving".
  //
  // BURIAL IS GEOMETRIC NOW, not a multiplier. The snow has a real
  // surface height; a blade's true height is fixed and never changes
  // with distance; what shows is simply the part standing ABOVE that
  // surface, and the root is planted ON the snow rather than under it.
  // A blade shorter than the snow is gone because it is buried, not
  // because a factor shrank it - and walking toward it changes
  // nothing, because nothing in this depends on the camera any more.
  float snowSurf = snowD * uSnowFull;             // the SAME line the ground displaces to
  float trueH = aInst.z * (1.0 - drown * 0.9);
  float h = max(0.0, trueH - snowSurf);
  vT = aCorner.y;
  // the tip travels, the root does not: the offset is weighted by
  // height along the blade, squared, which is what a stalk does
  // AUDIT 39 F1: THE GRASS BENDS THE WAY THE WIND BLOWS. The sway was
  // on a fixed axis with a fixed 0.6 cross-term, so the field always
  // leaned the same way however the wind slider was set - and once the
  // rain took a direction, the grass and the rain disagreed in plain
  // sight. Now the lean is the wind VECTOR: a steady push plus a gust
  // that travels ACROSS the field as a wave (the phase carries the
  // blade's position along the wind), which is what makes a gust look
  // like one thing moving rather than every blade wobbling alone.
  vec2 wdir = length(uWindV) > 1e-4 ? normalize(uWindV) : vec2(1.0, 0.0);
  float along = dot(root, wdir);
  float gust = sin(uTime*1.7 - along*0.35 + aInst.w*0.6) * 0.5 + 0.5;
  float push = length(uWindV) * (0.55 + gust * 0.75);
  vec2 lean = aInst2.xy + wdir * push * 0.055;
  vec3 p;
  p.xz = root + lean * (vT*vT) * h;
  p.xz += vec2(aCorner.x-0.5) * aInst2.w * (1.0 - vT*0.75);
  // planted on the snow's own surface, so the burial line is the one
  // the ground draws and not an approximation of it
  p.y = terrain(root) + snowSurf + vT * h;
  vTint = aInst2.z;
  // MAC'S NOTE: the blades take the TIME OF DAY. A blade's normal is
  // roughly its own lean crossed with up, so a leaning blade catches
  // a low sun on one side and goes dark on the other - which is what
  // makes a dawn field glow along one edge.
  vec3 nrm = normalize(vec3(-lean.y, 0.35, lean.x) + vec3(0.0, 0.25, 0.0));
  vLam = max(dot(nrm, normalize(uSunDir)), 0.0);
  gl_Position = uVP * vec4(p,1.0);
}`;
export const LAB_GRASS_FS = `in float vT; in float vTint; in float vFade; in float vLam; in float vSnow; in float vWet;
uniform vec3 uAmb, uSunCol; uniform float uDim;
out vec4 o;
void main(){
  // PROTO-2: the blade is LIT along its length - dark at the root
  // where the sward shades it, bright at the tip where the sky does -
  // and the very tip catches a rim, which is what makes a field of
  // blades read as depth instead of a green haze.
  // PROTO-7 (Mac: reduce the bright colour): the sward is olive, not
  // emerald - a Daggerfall field, not a golf course.
  vec3 root = vec3(0.10,0.14,0.06);
  vec3 mid  = vec3(0.21,0.29,0.11);
  vec3 tip  = vec3(0.36,0.44,0.19);
  vec3 c = mix(root, mid, smoothstep(0.0,0.55,vT));
  c = mix(c, tip, smoothstep(0.5,1.0,vT));
  c *= 0.80 + vTint*0.42;
  // wet grass is DARKER; snow-laden grass is pale and cold
  c *= mix(1.0, 0.72, clamp(vWet, 0.0, 1.0));
  c = mix(c, vec3(0.74,0.78,0.86), vSnow * 0.75);
  // lit by the same sky and sun the ground is, so a blade at dusk is
  // the colour of dusk and not a green cut-out on an orange field
  c *= (uAmb * 1.25 * (0.42 + 0.58*vT) + uSunCol * 1.15 * vLam);
  c *= uDim;
  // the rim is the SUN's colour, and only where the sun can reach
  c += uSunCol * 0.20 * smoothstep(0.86,1.0,vT) * vLam;
  o = vec4(c, vFade);
}`;

export const LAB_GRASS = Object.freeze({ density: 1200000, height: 54, range: 200, span: 210, seed: 0x2f6e2b1 });
/** the lab's weather dim table, for uDim */
export const LAB_DIM = Object.freeze({ sunny: 1.00, cloudy: 0.90, overcast: 0.72, fog: 0.66, rain: 0.60, thunder: 0.46, snow: 0.80 });

/**
 * The lab's scatter, verbatim in its law, around `centre` (world xz):
 * returns the candidate list the lab would draw, before the game decides
 * which may stand. `keep(x, z)` answers with the ground height under a
 * candidate, or null if no blade may stand there.
 */
export function placeLabGrass({ centre, keep, density = LAB_GRASS.density, height = LAB_GRASS.height, span = LAB_GRASS.span, seed = LAB_GRASS.seed }) {
  const N = density | 0;
  const inst = new Float32Array(N * 4); const inst2 = new Float32Array(N * 4); const rootY = new Float32Array(N);
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  let n = 0;
  for (let i = 0; i < N; i++) {
    const cx = (rnd() - 0.5) * span * 2, cz = (rnd() - 0.5) * span * 2;
    const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
    const x = centre[0] + cx + Math.cos(a) * rr, z = centre[1] + cz + Math.sin(a) * rr;
    const h = (0.22 + rnd() * 0.42) * (height / 34);
    const phase = rnd() * 6.283;
    const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5;
    const tint = rnd();
    const w = 0.052 + rnd() * 0.055;
    const y = keep(x, z);
    if (y === null || y === undefined) continue;
    inst[n * 4] = x; inst[n * 4 + 1] = z; inst[n * 4 + 2] = h; inst[n * 4 + 3] = phase;
    inst2[n * 4] = lx; inst2[n * 4 + 1] = lz; inst2[n * 4 + 2] = tint; inst2[n * 4 + 3] = w;
    rootY[n] = y;
    n++;
  }
  return { inst: inst.subarray(0, n * 4), inst2: inst2.subarray(0, n * 4), rootY: rootY.subarray(0, n), count: n };
}

/** the lab's blade: five stacked quads */
export function labBladeCorners() {
  const corners = [];
  for (let seg = 0; seg < 5; seg++) {
    const a = seg / 5, b = (seg + 1) / 5;
    corners.push(0, a, 1, a, 1, b, 0, a, 1, b, 0, b);
  }
  return new Float32Array(corners);
}

/**
 * Which records of a ground archive are GRASS, from the archive's own
 * texels: the four bases are identified by their mean colour (base 0 is
 * water everywhere; a green-dominant base is grass; in winter no base
 * is green, so nothing is grass), and every record's texels are
 * classified to the nearest base. A record is grass when more than half
 * of it is. Roads are excluded by record regardless.
 */
export function grassRecordsOf(layers, { roadRecords = new Set([46, 47, 55]) } = {}) {
  if (!layers || layers.length < 4) return new Set();
  const meanOf = (l) => { let r = 0, g = 0, b = 0; const n = l.width * l.height; for (let k = 0; k < n; k++) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; } return [r / n, g / n, b / n]; };
  const means = [0, 1, 2, 3].map((i) => meanOf(layers[i]));
  const isGrass = (m) => m[1] >= m[0] && m[1] > m[2] * 1.1 && !(m[2] > m[0] * 1.25 && m[2] > m[1] * 1.1);
  const grassBase = means.map(isGrass);
  if (!grassBase.some(Boolean)) return new Set();
  const out = new Set();
  for (let rec = 0; rec < layers.length; rec++) {
    if (roadRecords.has(rec)) continue;
    const l = layers[rec]; const n = l.width * l.height; let g = 0;
    for (let k = 0; k < n; k++) {
      const r = l.colors[k * 4], gg = l.colors[k * 4 + 1], b = l.colors[k * 4 + 2];
      let best = 0, bd = Infinity;
      for (let i = 0; i < 4; i++) { const d = (r - means[i][0]) ** 2 + (gg - means[i][1]) ** 2 + (b - means[i][2]) ** 2; if (d < bd) { bd = d; best = i; } }
      if (grassBase[best] && bd < 42 * 42) g++;
    }
    if (g / n > 0.5) out.add(rec);
  }
  return out;
}

/**
 * GR1: the lab's grass pass, as a renderer of its own beside the world
 * renderer - the same shape as PrecipitationRenderer. Owns its program,
 * its blade quad, its instance buffers and a 1x1 zero field texture.
 * `set(placed)` uploads a scatter; `draw()` is the lab's draw, term for
 * term, with the game's light and wind in the lab's uniforms.
 */
export class LabGrassRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, LAB_GRASS_HEAD + GAME_GRASS_FIELD + LAB_GRASS_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, LAB_GRASS_HEAD + LAB_GRASS_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uTime', 'uWind', 'uRange', 'uEye', 'uSunDir', 'uWindDir', 'uSnowFull', 'uGField', 'uGFieldOrigin', 'uGFieldM', 'uSnowGlobal', 'uWindV', 'uAmb', 'uSunCol', 'uDim']) this.u[n] = gl.getUniformLocation(prog, n);
    // the blade, and three instance streams the lab's layout plus the game's root height
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    const corners = labBladeCorners();
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.verts = corners.length / 2;
    this.bufs = [1, 2, 3].map((loc) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, loc === 3 ? 1 : 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1);
      return b;
    });
    gl.bindVertexArray(null);
    // the field the lab's grass reads: nothing, so the snow and wet terms are zero
    this.zeroField = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.zeroField);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.count = 0;
    this._vp = new Float32Array(16);
  }

  /** upload a scatter from placeLabGrass. Creates nothing, draws nothing. */
  set(placed) {
    const gl = this.gl;
    for (const [i, data] of [[0, placed.inst], [1, placed.inst2], [2, placed.rootY]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.count = placed.count;
  }

  /** the lab's draw. `light` = {sunDir, amb, sunCol, dim}; `wind` = {dir, speed, windV}. */
  draw(proj, view, eye, timeSeconds, light, wind, range = LAB_GRASS.range) {
    if (!this.count) return;
    const gl = this.gl; const u = this.u;
    // out = proj * view, column-major
    const o = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(u.uVP, false, o);
    gl.uniform1f(u.uTime, timeSeconds);
    gl.uniform1f(u.uWind, wind.speed);
    gl.uniform2f(u.uWindDir, wind.dir[0], wind.dir[1]);
    gl.uniform2f(u.uGFieldOrigin, 0, 0);
    gl.uniform1f(u.uGFieldM, 1);
    gl.uniform1f(u.uSnowGlobal, 0);
    gl.uniform1f(u.uSnowFull, 1.1);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.zeroField);
    gl.uniform1i(u.uGField, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uWindV, wind.windV[0], wind.windV[1]);
    gl.uniform1f(u.uRange, range);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uSunDir, light.sunDir);
    gl.uniform3fv(u.uAmb, light.amb);
    gl.uniform3fv(u.uSunCol, light.sunCol);
    gl.uniform1f(u.uDim, light.dim);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.verts, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  destroy() {
    const gl = this.gl;
    for (const b of this.bufs) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.zeroField);
    gl.deleteProgram(this.program);
  }
}
