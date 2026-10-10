// @ts-check
// WB9e (2026-09-30, Mac: "Further improve his effects ... Increase boss damage, further improve his telegraphs"): HIS
// BLOWS, SEEN LANDING. The telegraph says where a blow will fall (render/gateTelegraph.js); this pass is the fall itself:
//
//   - THE BURST: every landing throws sparks out of the stone where it lands - his weight's grit and embers, his fire's
//     flame, his aspect's frost, lightning or venom in their colours - flying out and up, falling, cooling from white-hot
//     to their colour to nothing over FX_BURST_MS; the heavy ones (the Crushing Leap, the Meteor, the bound across the
//     fire, the Nova, Dagon's own) throw more, further.
//   - THE METEOR: through the last METEOR_FALL_MS of its wind-up a burning stone streaks down out of the Deadlands' sky
//     onto its mark, its trail behind it - the fall the fighter it was called on has to beat.
//
// WB9f (Mac: "Improve the loot drops that emit on his death"): AND HIS SPOILS' - a gold burst out of his chest as his
// spoils leave it, falling to the floor under it (a burst's `floor`: its sparks rest there, not at its origin's height),
// and a small burst in its tier's colour where each piece comes to rest, a Rare-or-better's brighter (FX_KINDS.spoils,
// spoilRest, spoilRestRare).
//
// AUDIT SD IV (R3): A FLOOR WITH AN EDGE. A burst may say where its floor ends (`edge` - its centre's x, z and its
// radius; the Shattered Hour's arena is a disc over the void): a spark past it rests on nothing - one that crossed it
// flying flies on down, one that crossed it at rest slides off and falls. None said, the floor has no edge (the court's).
//
// The duel wall's law (render/duelWall.js): fixed geometry (a strip of seeds for the sparks, one quad for the stone and
// its trail) placed by uniforms; added onto the frame (ONE, ONE); tested against the depth the court wrote and never
// writing it; fogged to the frame's fog. Pure where it can be: `fxBurstOf`, `meteorFall` and `sparkAt` (the shader's own
// flight, in JS) are the pins' doors.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { ATTACK_BY_ID, ATTACKS } from '../net/gateBrain.js';

/** A burst's sparks fly this long (ms); the most sparks one burst throws; the most bursts drawn at once. */
export const FX_BURST_MS = 1100;
export const FX_SPARKS = 64;
export const FX_BURSTS_MAX = 16;
/** The sparks' fall (m/s²), and how big one stands (m) at the burst. */
export const FX_GRAVITY = 14;
export const FX_SPARK_M = 0.32;
/** THE METEOR: it falls through the last METEOR_FALL_MS of its wind-up from METEOR_FROM_M up its path (out of the sky
 *  from the great tower's side - METEOR_DIR, the path's direction back up from the mark), its stone METEOR_HEAD_M across
 *  and its trail METEOR_TRAIL_M long. WB13d: longer and lower - 1100 ms at 63 degrees was above the frame of anyone
 *  looking at him, and a dot to one under it; METEOR_ELEV_DEG over the horizon, from the same side. */
export const METEOR_FALL_MS = 1700;
export const METEOR_FROM_M = 90;
export const METEOR_ELEV_DEG = 35;
export const METEOR_DIR = Object.freeze((() => {
  const h = [0.28, -0.42], l = Math.hypot(...h), e = (METEOR_ELEV_DEG * Math.PI) / 180;
  return [(h[0] / l) * Math.cos(e), Math.sin(e), (h[1] / l) * Math.cos(e)];
})());
export const METEOR_HEAD_M = 4.2;
export const METEOR_TRAIL_M = 32;

/**
 * THE BURST A LANDING THROWS, by its attack - how many sparks (a share of FX_SPARKS), how hard (1 a slam's), and whether
 * it is his weight's (grit: darker, heavier) or his element's - or null for a landing that throws none (a blade's, the
 * charge's run, the spokes' lanes: their telegraph's flash is their landing). Pure.
 * @param {any} A an attack (net/gateBrain.js ATTACKS)
 * @returns {{ share: number, power: number, grit: boolean, light?: ReadonlyArray<number> }|null}
 */
export function fxBurstOf(A) {
  switch (A?.key) {
    case 'slam': return FX_KINDS.slam;
    case 'leap': return FX_KINDS.leap;
    case 'cross': return FX_KINDS.cross;
    case 'hellfire': return FX_KINDS.hellfire;
    case 'meteor': return FX_KINDS.meteor;
    case 'nova': return FX_KINDS.nova;
    case 'wrath': case 'reckon': return FX_KINDS.dagon;
    default: return null;
  }
}
/** WB13d: the light a landing throws where it falls away from him - `light` [intensity, reach m] for FX_LIGHT_MS, fading
 *  (a landing at his own feet is his glow's: world/gateBoss.js bossGlow). */
export const FX_LIGHT_MS = 450;
export const FX_KINDS = Object.freeze({
  slam: Object.freeze({ share: 0.75, power: 1, grit: true }),
  leap: Object.freeze({ share: 0.85, power: 1.15, grit: true }),
  cross: Object.freeze({ share: 1, power: 1.5, grit: true }),
  hellfire: Object.freeze({ share: 0.4, power: 0.7, grit: false, light: Object.freeze([1.2, 7]) }),
  meteor: Object.freeze({ share: 1, power: 1.6, grit: false, light: Object.freeze([3.0, 16]) }),
  nova: Object.freeze({ share: 1, power: 1.3, grit: false }),
  dagon: Object.freeze({ share: 1, power: 2, grit: false }),
  // WB13e: his fall's column of embers as his body meets the floor, and the sparks his sputtering ember sheds
  embers: Object.freeze({ share: 0.7, power: 1.2, grit: false }),
  sputter: Object.freeze({ share: 0.12, power: 0.3, grit: false }),
  // WB9f: his spoils - the gold out of his chest, and each piece's landing (a Rare-or-better's brighter)
  spoils: Object.freeze({ share: 1, power: 0.9, grit: false }),
  spoilRest: Object.freeze({ share: 0.3, power: 0.45, grit: false }),
  spoilRestRare: Object.freeze({ share: 0.55, power: 0.7, grit: false }),
});

/** A seed's two numbers for spark `i` (0..1 each) - the shader's own hash of its vertex, in JS. */
export const sparkSeed = (i) => [fract(Math.sin(i * 12.9898 + 4.1) * 43758.5453), fract(Math.sin(i * 78.233 + 1.7) * 24634.6345)];
function fract(x) { return x - Math.floor(x); }
/**
 * WHERE SPARK `i` OF A BURST IS, `t` seconds after it (the shader's own flight, in JS): out along its bearing, up, and
 * falling - `[x, y, z]` from the burst's origin, and its life's share spent (1 gone). WB9f: `floorRel` the floor's
 * height under the origin (0 a burst on the floor; below it for one out of his chest), where a fallen spark rests.
 * AUDIT SD IV (R3): `edge` the floor's edge, `[x, z, radius]` - its centre from the origin - past which it rests on
 * nothing (null: none). Pure.
 */
export function sparkAt(i, t, power = 1, floorRel = 0, edge = null) {
  const [a, b] = sparkSeed(i);
  const bearing = a * Math.PI * 2, out = (3 + 7 * b) * power, up = (4 + 6 * fract(a * 7.31 + b)) * Math.sqrt(power);
  const life = (0.55 + 0.45 * fract(b * 5.17 + a)) * (FX_BURST_MS / 1000);
  const g = 0.5 * FX_GRAVITY, rest = floorRel + 0.05;
  let y = Math.max(rest, up * t - g * t * t);   // at rest on the floor once fallen
  if (edge && edge[2] > 0) {
    const ox = -edge[0], oz = -edge[1], dx = Math.sin(bearing) * out, dz = Math.cos(bearing) * out;
    const dd = Math.max(dx * dx + dz * dz, 1e-6), bq = ox * dx + oz * dz, cq = ox * ox + oz * oz - edge[2] * edge[2];
    const tc = cq >= 0 ? 0 : (-bq + Math.sqrt(Math.max(bq * bq - dd * cq, 0))) / dd;   // when its run out crosses the edge
    if (t > tc) y = up * tc - g * tc * tc > rest ? up * t - g * t * t : rest - g * (t - tc) * (t - tc);
  }
  return { at: [Math.sin(bearing) * out * t, y, Math.cos(bearing) * out * t], spent: Math.min(1, t / life) };
}

/**
 * WHERE THE METEOR IS at `now` - its stone's place in the court frame (`[x, y, z]` about the first court's centre) and
 * how far through its fall (0..1) - or null outside its last METEOR_FALL_MS. Pure.
 * @param {{a: number, at: number, tg?: number[][]}|null} atk
 */
export function meteorFall(atk, now) {
  const A = atk ? ATTACK_BY_ID[atk.a] : null, p = atk?.tg?.[0];
  if (A !== ATTACKS.meteor || !p || now < atk.at - METEOR_FALL_MS || now >= atk.at) return null;
  const k = (now - (atk.at - METEOR_FALL_MS)) / METEOR_FALL_MS, d = METEOR_FROM_M * (1 - k * k);   // it gathers speed as it falls
  return { at: [p[0] + METEOR_DIR[0] * d, METEOR_DIR[1] * d, p[1] + METEOR_DIR[2] * d], k };
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
export const FX_SPARK_VS = HEAD + `layout(location = 0) in float aI;
uniform mat4 uVP;
uniform vec3 uAt;        // the burst's origin in the scene
uniform float uFloor;    // WB9f: the floor's height under it, where a fallen spark rests
uniform vec3 uEdge;      // AUDIT SD IV (R3): where that floor ends - its centre's x, z and its radius (0: it never does)
uniform float uT;        // seconds since it
uniform float uPower;
uniform float uPxPerM;
uniform vec3 uColor;
uniform int uGrit;
out vec3 vColor;
out float vFade;
out vec3 vWorld;
float fr(float x) { return x - floor(x); }
void main() {
  float a = fr(sin(aI * 12.9898 + 4.1) * 43758.5453), b = fr(sin(aI * 78.233 + 1.7) * 24634.6345);
  float bearing = a * 6.283185307179586, outv = (3.0 + 7.0 * b) * uPower, upv = (4.0 + 6.0 * fr(a * 7.31 + b)) * sqrt(uPower);
  float life = (0.55 + 0.45 * fr(b * 5.17 + a)) * ${(FX_BURST_MS / 1000).toFixed(3)};
  float t = uT, spent = clamp(t / life, 0.0, 1.0);
  vec3 p = uAt + vec3(sin(bearing) * outv * t, max(upv * t - ${(0.5 * FX_GRAVITY).toFixed(3)} * t * t, uFloor - uAt.y + 0.05), cos(bearing) * outv * t);
  if (uEdge.z > 0.0) {   // AUDIT SD IV (R3): past the floor's edge it rests on nothing - flying, it flies on down; at rest, it slides off
    vec2 o = uAt.xz - uEdge.xy, d = vec2(sin(bearing), cos(bearing)) * outv;
    float dd = max(dot(d, d), 1e-6), bq = dot(o, d), cq = dot(o, o) - uEdge.z * uEdge.z;
    float tc = cq >= 0.0 ? 0.0 : (-bq + sqrt(max(bq * bq - dd * cq, 0.0))) / dd, rest = uFloor - uAt.y + 0.05, g = ${(0.5 * FX_GRAVITY).toFixed(3)};
    if (t > tc) p.y = uAt.y + (upv * tc - g * tc * tc > rest ? upv * t - g * t * t : rest - g * (t - tc) * (t - tc));
  }
  vWorld = p;
  vec4 cp = uVP * vec4(p, 1.0);
  gl_Position = cp;
  float size = ${FX_SPARK_M.toFixed(3)} * (uGrit == 1 ? 1.5 : 1.0) * (1.0 - 0.6 * spent);
  gl_PointSize = spent >= 1.0 ? 0.0 : clamp(size * uPxPerM / max(cp.w, 0.1), 1.5, 48.0);
  // white-hot at the burst, its colour after, embers at the end; grit darker and redder
  vec3 hot = mix(vec3(1.0, 0.95, 0.85), uColor, smoothstep(0.0, 0.35, spent));
  vColor = uGrit == 1 ? mix(hot, vec3(0.55, 0.3, 0.16), 0.45) : hot;
  vFade = (1.0 - spent) * (1.0 - spent);
}`;
export const FX_SPARK_FS = HEAD + `in vec3 vColor;
in float vFade;
in vec3 vWorld;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0) discard;
  float glow = (1.0 - r) * (1.0 - r);
  o = vec4(vColor * (glow * 2.2 + step(r, 0.2) * 1.2) * vFade * fogFactorAt(vWorld), 1.0);   // a hot core in a soft glow
}`;
/** THE METEOR: one quad, drawn twice - the trail (a ribbon from the stone back up its path) and the stone's glow. */
export const FX_METEOR_VS = HEAD + `layout(location = 0) in vec2 aP;   // x across -1..1, y 0..1 (the trail's length; the glow's up)
uniform mat4 uVP;
uniform int uKind;       // 0 the trail, 1 the stone's glow
uniform vec3 uHead;
uniform vec3 uDir;       // back up its path
uniform float uLen;
uniform float uW;
uniform vec3 uEye;
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = aP;
  vec3 w;
  if (uKind == 0) {
    vec3 mid = uHead + uDir * uLen * aP.y;
    vec3 side = normalize(cross(uDir, uEye - mid));
    w = mid + side * aP.x * uW * (1.0 - 0.7 * aP.y);
  } else {
    vec3 f = normalize(uEye - uHead), side = normalize(cross(vec3(0.0, 1.0, 0.0), f)), up = cross(f, side);
    w = uHead + side * aP.x * uW + up * (aP.y * 2.0 - 1.0) * uW;
  }
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const FX_METEOR_FS = HEAD + `in vec2 vUv;
in vec3 vWorld;
uniform int uKind;
uniform vec3 uColor;
uniform float uTime;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
void main() {
  float light;
  vec3 col;
  if (uKind == 0) {
    float across = 1.0 - abs(vUv.x);
    float flick = 0.8 + 0.2 * sin(vUv.y * 40.0 - uTime * 30.0);
    light = across * across * (1.0 - vUv.y) * (1.0 - vUv.y) * flick;
    col = mix(vec3(1.0, 0.9, 0.6), uColor, vUv.y * 1.4);
  } else {
    float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
    if (r > 1.0) discard;
    light = pow(1.0 - r, 1.6) * 1.8;
    col = mix(vec3(1.0, 0.97, 0.85), uColor, r);
  }
  o = vec4(col * light * fogFactorAt(vWorld), 1.0);
}`;

const NO_FOG_RANGE = new Float32Array([0, 1]);
function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

export class GateFxRenderer {
  constructor(gl) {
    this.gl = gl;
    this.sparks = buildProgram(gl, FX_SPARK_VS, FX_SPARK_FS, 'gate sparks');
    this.meteor = buildProgram(gl, FX_METEOR_VS, FX_METEOR_FS, 'gate meteor');
    this.us = {}; this.um = {};
    for (const n of ['uVP', 'uAt', 'uFloor', 'uEdge', 'uT', 'uPower', 'uPxPerM', 'uColor', 'uGrit', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.us[n] = gl.getUniformLocation(this.sparks, n);
    for (const n of ['uVP', 'uKind', 'uHead', 'uDir', 'uLen', 'uW', 'uEye', 'uColor', 'uTime', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.um[n] = gl.getUniformLocation(this.meteor, n);
    this.sparkVao = gl.createVertexArray();
    gl.bindVertexArray(this.sparkVao);
    this.sparkBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: FX_SPARKS }, (_, i) => i)), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 4, 0);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    this.quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many bursts and meteors the last draw put down, for the stats and the tests */
    this.bursts = 0;
    this.meteors = 0;
  }

  /**
   * Draw the frame's bursts (`[{ at: [x, y, z] the scene's, t: seconds since, kind: FX_KINDS entry, color, floor?, edge? }]` -
   * WB9f: `floor` the floor's height under a burst above it; AUDIT SD IV (R3): `edge` where it ends ([x, z, radius]) - at most
   * FX_BURSTS_MAX, those whose sparks are all spent skipped) and its meteor (`{ at: [x, y, z] the scene's, color }` or
   * null). `viewH` the world image's height in pixels (the sparks' size). Nothing to draw, nothing touched.
   */
  draw(bursts, meteor, proj, view, eye, seconds, fog = null, viewH = 0) {
    this.bursts = 0; this.meteors = 0;
    let any = !!meteor;
    for (const b of bursts ?? []) if (b && b.t >= 0 && b.t < FX_BURST_MS / 1000) { any = true; break; }
    if (!any) return;
    const gl = this.gl;
    mat4Multiply(this._vp, proj, view);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    const fogOn = (U) => {
      gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
      gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
      gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
      gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    };
    // the sparks
    const S = this.us;
    let n = 0;
    for (const b of bursts ?? []) {
      if (!b || !(b.t >= 0) || b.t >= FX_BURST_MS / 1000 || n >= FX_BURSTS_MAX) continue;
      if (!n) {
        gl.useProgram(this.sparks);
        gl.uniformMatrix4fv(S.uVP, false, this._vp);
        gl.uniform1f(S.uPxPerM, (Math.max(1, viewH || gl.drawingBufferHeight || 720) * proj[5]) / 2);
        fogOn(S);
        gl.bindVertexArray(this.sparkVao);
      }
      gl.uniform3f(S.uAt, b.at[0], b.at[1], b.at[2]);
      gl.uniform1f(S.uFloor, Number.isFinite(b.floor) ? b.floor : b.at[1]);   // WB9f: on the floor unless it says where the floor is
      gl.uniform3f(S.uEdge, b.edge ? b.edge[0] : 0, b.edge ? b.edge[1] : 0, b.edge ? b.edge[2] : 0);   // AUDIT SD IV (R3): and where it ends, if it says
      gl.uniform1f(S.uT, b.t);
      gl.uniform1f(S.uPower, b.kind?.power ?? 1);
      gl.uniform1i(S.uGrit, b.kind?.grit ? 1 : 0);
      gl.uniform3fv(S.uColor, b.color);
      gl.drawArrays(gl.POINTS, 0, Math.max(1, Math.round(FX_SPARKS * (b.kind?.share ?? 1))));
      n++;
    }
    this.bursts = n;
    // the meteor: its trail, then its stone's glow
    if (meteor && Array.isArray(meteor.at)) {
      const M = this.um;
      gl.useProgram(this.meteor);
      gl.uniformMatrix4fv(M.uVP, false, this._vp);
      gl.uniform3f(M.uEye, eye[0], eye[1], eye[2]);
      gl.uniform1f(M.uTime, ((seconds % 120) + 120) % 120);
      gl.uniform3fv(M.uColor, meteor.color);
      fogOn(M);
      gl.bindVertexArray(this.quadVao);
      gl.uniform3f(M.uHead, meteor.at[0], meteor.at[1], meteor.at[2]);
      gl.uniform3f(M.uDir, METEOR_DIR[0], METEOR_DIR[1], METEOR_DIR[2]);
      gl.uniform1i(M.uKind, 0); gl.uniform1f(M.uLen, METEOR_TRAIL_M); gl.uniform1f(M.uW, METEOR_HEAD_M * 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform1i(M.uKind, 1); gl.uniform1f(M.uW, METEOR_HEAD_M);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.meteors = 1;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
