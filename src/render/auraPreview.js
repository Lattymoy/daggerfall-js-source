// @ts-check
// SHOP (2026-10-28; bible/06-Systems/Shop.md): AN AURA SEEN BEFORE IT IS BOUGHT - a small stage of its own on a canvas
// the shop's window owns: a floor, a stand-in figure posed as the cloak's rest pose stands (render/auraRing.js
// CLOAK_REST_POSE), and the aura drawn on it by the game's own pass. A cape's swing is the game's own (auraMotionStep)
// fed a stroll that starts, turns and stops, so it flows as it does on a walking player. The frame is the game's,
// mirrored as world/mat4.js's HANDEDNESS law has it, so a mark on the back reads as it does in the world.
// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 4): and an Aura Armory kit on the same figure, posed at
// rest (render/armoryPose.js), drawn by the game's own armory pass - seen from the front, where its pieces are.
import { AuraRingRenderer, auraMotionStep, CLOAK_REST_POSE, AURA_KINDLE_S } from './auraRing.js';
import { ArmoryRenderer, ARMORY_TRAIL, ARMORY_STRIDE_M } from './armoryPass.js';
import { newPose, poseAtRest } from './armoryPose.js';
import { perspective, lookAt, mirrorProjectionX, multiply } from '../world/mat4.js';

/** The stand-in figure, boxes about its feet facing +z: [x, y, z, half-width, half-height, half-depth]. Its shoulders
 *  stand where the cloak's rest pose hangs a cape (CLOAK_SHOULDER_Y, 1.42 m), its head where the hood's middle is. */
export const PREVIEW_FIGURE = Object.freeze(
  [
    [-0.09, 0.42, 0, 0.065, 0.42, 0.075],
    [0.09, 0.42, 0, 0.065, 0.42, 0.075], // legs
    [0, 0.9, 0, 0.17, 0.08, 0.1],
    [0, 1.17, 0, 0.18, 0.25, 0.11],
    [0, 1.39, 0, 0.21, 0.05, 0.115], // hips, chest, shoulders
    [-0.25, 1.08, 0, 0.05, 0.32, 0.055],
    [0.25, 1.08, 0, 0.05, 0.32, 0.055], // arms
    [0, 1.48, 0, 0.05, 0.05, 0.05],
    [0, 1.64, 0.01, 0.1, 0.12, 0.11], // neck, head
  ].map((b) => Object.freeze(b)),
);
/** The floor's reach (m), the camera's distance and height (m), what it looks at, and its field of view (rad). */
export const PREVIEW_STAGE = Object.freeze({ floorR: 2.4, dist: 3.1, height: 1.55, lookY: 0.95, fov: 0.78 });
/** The stroll that swings a cape: its pace (m/s), the seconds of one walk and stop, and of one sway of its facing. */
export const PREVIEW_STROLL = Object.freeze({ pace: 1.7, walkS: 9, turnS: 13, turn: 0.45 });

/** The figure's and the floor's triangles: (x, y, z, nx, ny, nz) a vertex, the floor first - its count `floorN`. Pure. */
export function previewMesh() {
  const v = [];
  const ring = 48;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2,
      b = ((i + 1) / ring) * Math.PI * 2,
      R = PREVIEW_STAGE.floorR;
    v.push(
      0,
      0,
      0,
      0,
      1,
      0,
      Math.cos(a) * R,
      0,
      Math.sin(a) * R,
      0,
      1,
      0,
      Math.cos(b) * R,
      0,
      Math.sin(b) * R,
      0,
      1,
      0,
    );
  }
  const floorN = v.length / 6;
  for (const [x, y, z, hx, hy, hz] of PREVIEW_FIGURE) {
    for (const [ax, s] of [
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [2, 1],
      [2, -1],
    ]) {
      const n = [0, 0, 0];
      n[ax] = s;
      const [u, w] = [
        [1, 2],
        [0, 2],
        [0, 1],
      ][ax];
      const h = [hx, hy, hz],
        c = [x, y, z];
      const corner = (du, dw) => {
        const p = [...c];
        p[ax] += s * h[ax];
        p[u] += du * h[u];
        p[w] += dw * h[w];
        return [...p, ...n];
      };
      v.push(
        ...corner(-1, -1),
        ...corner(1, -1),
        ...corner(1, 1),
        ...corner(-1, -1),
        ...corner(1, 1),
        ...corner(-1, 1),
      );
    }
  }
  return { data: new Float32Array(v), floorN, count: v.length / 6 };
}

/** The stroll at `t` seconds: how fast the figure walks (m/s, 0 standing) and which way it faces (rad). Pure. */
export function previewStroll(/** @type {number} */ t) {
  const s = PREVIEW_STROLL,
    walk = Math.sin((2 * Math.PI * t) / s.walkS);
  return { pace: s.pace * Math.max(0, walk) ** 0.6, yaw: s.turn * Math.sin((2 * Math.PI * t) / s.turnS) };
}

const VS = `#version 300 es
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN;
uniform mat4 uVP; uniform float uYaw;
out vec3 vN; out vec3 vW;
void main() {
  float c = cos(uYaw), s = sin(uYaw);
  vec3 p = vec3(c * aP.x + s * aP.z, aP.y, -s * aP.x + c * aP.z);
  vN = vec3(c * aN.x + s * aN.z, aN.y, -s * aN.x + c * aN.z);
  vW = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; uniform vec3 uEye; uniform vec3 uGround; uniform int uFloor; out vec4 o;
void main() {
  if (uFloor == 1) {   // the floor: stone, fading into the stage's dark
    float r = length(vW.xz);
    o = vec4(uGround * (1.0 - smoothstep(0.4, ${PREVIEW_STAGE.floorR.toFixed(2)}, r)) * (0.85 + 0.15 * fract(sin(dot(floor(vW.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5)), 1.0);
    return;
  }
  vec3 n = normalize(vN), e = normalize(uEye - vW);
  float key = max(dot(n, normalize(vec3(0.3, 0.8, 0.5))), 0.0), rim = pow(1.0 - max(dot(n, e), 0.0), 3.0);
  o = vec4(vec3(0.07, 0.065, 0.085) + vec3(0.09, 0.085, 0.1) * key + vec3(0.16, 0.14, 0.3) * rim, 1.0);
}`;

/**
 * THE STAGE on `canvas`, drawing `aura` until stopped. Answers { set(aura), setKit(kit), stop() } - or null where the
 * canvas has no WebGL2 (the window then shows the aura's words alone). A canvas taken out of the page stops its own clock.
 * ARMORY: `kit` an Aura Armory kit worn beside it (or alone, `aura` null) - the camera then sways round the figure's front.
 * @param {HTMLCanvasElement} canvas @param {string|null} aura @param {{ ground?: number[], clear?: number[], now?: () => number, kit?: string|null }} [o]
 */
export function startAuraPreview(
  canvas,
  aura,
  { ground = [0.11, 0.1, 0.13], clear = [0.035, 0.03, 0.055], now = () => performance.now() / 1000, kit = null } = {},
) {
  /** @type {WebGL2RenderingContext|null} */
  const gl = /** @type {any} */ (
    canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false })
  );
  if (!gl) return null;
  const sh = (/** @type {number} */ type, /** @type {string} */ src) => {
    const x = /** @type {WebGLShader} */ (gl.createShader(type));
    gl.shaderSource(x, src);
    gl.compileShader(x);
    return x;
  };
  const prog = /** @type {WebGLProgram} */ (gl.createProgram());
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const mesh = previewMesh();
  const vao = gl.createVertexArray(),
    buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindVertexArray(null);
  const U = {
    vp: gl.getUniformLocation(prog, 'uVP'),
    yaw: gl.getUniformLocation(prog, 'uYaw'),
    eye: gl.getUniformLocation(prog, 'uEye'),
    ground: gl.getUniformLocation(prog, 'uGround'),
    floor: gl.getUniformLocation(prog, 'uFloor'),
  };
  let pass = null,
    armory = null;
  try {
    pass = new AuraRingRenderer(gl);
  } catch {
    pass = null;
  }
  try {
    armory = new ArmoryRenderer(gl);
  } catch {
    armory = null;
  }
  const t0 = now();
  const ghost = { at: [0, 0, 0], yaw: 0 }; // walks the stroll; the figure stays where it stands and wears its swing
  const wearer = {
    id: 'preview',
    at: [0, 0, 0],
    aura,
    seed: 0.37,
    kindle: 0,
    since: t0,
    yaw: 0,
    torn: -1,
    cape: CLOAK_REST_POSE,
    swing: null,
  };
  // ARMORY: the kit's wearer, at rest on the stand-in; its footfall embers left as the stroll walks and slid back under it
  const kitWearer = {
    id: 'preview',
    at: [0, 0, 0],
    kit,
    seed: 0.37,
    kindle: 0,
    since: t0,
    yaw: 0,
    torn: -1,
    pose: poseAtRest(newPose()),
    vel: [0, 0, 0],
    trail: new Float32Array(ARMORY_TRAIL * 4).fill(-1),
    _d: 3,
  };
  let walked = 0,
    foot = 0;
  let last = t0,
    raf = 0,
    stopped = false;
  const frame = () => {
    raf = 0;
    if (stopped) return;
    if (canvas.isConnected === false) {
      stop();
      return;
    }
    const t = now(),
      dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
      w = Math.max(1, Math.round(canvas.clientWidth * dpr)),
      h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const st = previewStroll(t - t0);
    ghost.yaw = st.yaw;
    ghost.at[0] += Math.sin(st.yaw) * st.pace * dt;
    ghost.at[2] += Math.cos(st.yaw) * st.pace * dt;
    if (Math.abs(ghost.at[0]) + Math.abs(ghost.at[2]) > 1e4) {
      ghost.at[0] = 0;
      ghost.at[2] = 0;
    } // a jump the swing reads as no motion (CLOAK_SWING snap)
    auraMotionStep(ghost, t);
    wearer.yaw = st.yaw;
    wearer.swing = /** @type {any} */ (ghost).swing;
    wearer.kindle = Math.min(1, (t - wearer.since) / AURA_KINDLE_S);
    const fx = Math.sin(st.yaw),
      fz = Math.cos(st.yaw);
    kitWearer.yaw = st.yaw;
    kitWearer.kindle = Math.min(1, (t - kitWearer.since) / AURA_KINDLE_S);
    kitWearer.vel[0] = fx * st.pace;
    kitWearer.vel[2] = fz * st.pace;
    for (let i = 0; i < ARMORY_TRAIL; i++)
      if (kitWearer.trail[i * 4 + 3] >= 0) {
        kitWearer.trail[i * 4] -= fx * st.pace * dt;
        kitWearer.trail[i * 4 + 2] -= fz * st.pace * dt;
      } // the ground slides back under the stand-in
    walked += st.pace * dt;
    if (walked >= ARMORY_STRIDE_M) {
      walked -= ARMORY_STRIDE_M;
      foot = 1 - foot;
      let slot = 0;
      for (let i = 1; i < ARMORY_TRAIL; i++) if (kitWearer.trail[i * 4 + 3] < kitWearer.trail[slot * 4 + 3]) slot = i;
      const side = foot ? 0.09 : -0.09;
      kitWearer.trail.set([Math.cos(st.yaw) * side, 0, -Math.sin(st.yaw) * side, t], slot * 4);
    }
    // the camera sways round behind the figure, where a cape hangs - ARMORY: round its front for a kit alone
    const a =
      (kitWearer.kit && !wearer.aura ? 0 : Math.PI) +
      (kitWearer.kit && !wearer.aura ? 1.05 : 0.85) * Math.sin((2 * Math.PI * (t - t0)) / 18);
    const S = PREVIEW_STAGE,
      eye = [Math.sin(a) * S.dist, S.height, Math.cos(a) * S.dist];
    const proj = mirrorProjectionX(perspective(S.fov, w / h, 0.05, 50)),
      view = lookAt(eye, [0, S.lookY, 0], [0, 1, 0]);
    gl.viewport(0, 0, w, h);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.vp, false, multiply(proj, view));
    gl.uniform3fv(U.eye, eye);
    gl.uniform3fv(U.ground, ground);
    gl.bindVertexArray(vao);
    gl.uniform1i(U.floor, 1);
    gl.uniform1f(U.yaw, 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.floorN);
    gl.uniform1i(U.floor, 0);
    gl.uniform1f(U.yaw, st.yaw);
    gl.drawArrays(gl.TRIANGLES, mesh.floorN, mesh.count - mesh.floorN);
    gl.bindVertexArray(null);
    gl.frontFace(gl.CW); // the game's own front face under the mirror (renderer init)
    if (wearer.aura) pass?.draw([wearer], proj, view, new Float32Array(eye), t, null);
    if (kitWearer.kit) armory?.draw([kitWearer], proj, view, new Float32Array(eye), t, null);
    gl.frontFace(gl.CCW);
    raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  };
  function stop() {
    stopped = true;
    if (raf) globalThis.cancelAnimationFrame?.(raf);
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // EVERY ALLOCATION HAS AN OWNER: the context and all it held
  }
  raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  return {
    set(/** @type {string|null} */ next) {
      if (next !== wearer.aura) {
        wearer.aura = next;
        wearer.since = now();
      }
    },
    /** ARMORY: wear another kit (null for none), kindled anew. */
    setKit(/** @type {string|null} */ next) {
      if (next !== kitWearer.kit) {
        kitWearer.kit = next;
        kitWearer.since = now();
      }
    },
    stop,
    /** for a probe: one frame drawn now */
    step: () => {
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      frame();
    },
  };
}
