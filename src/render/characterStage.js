// @ts-check
// PROFILE-SLOTS (2026-10-28, the owner: "an actual preview of either your morrowind/sprite for the selected character";
// bible/04-Characters/Aura-Armory.md section 10) - THE CHARACTER'S STAGE on the profile: the character as the world draws
// it - its Morrowind body (combat/fpArm.js stage(): the picture, the camera that drew it and its bones) or its sprite (the
// skin or the layered gear it wears, at the world's size and offset, its picture's own marks read) - its aura at its feet
// and its Aura Armory kit on it, by the game's own passes; with no body to draw, the shop's stand-in. A Morrowind
// picture has no depth, so a stand-in of prisms on its bones writes the depth the pieces are tested against. Not a DFU
// member.
import {
  AuraRingRenderer,
  auraCapeStep,
  auraSpriteBones,
  CLOAK_REST_POSE,
  CLOAK_BONES,
  AURA_KINDLE_S,
  AURA_LOOK,
} from './auraRing.js';
import { ArmoryRenderer, armoryHeadTip, ARMORY_HEAD } from './armoryPass.js';
import { armoryKitWith } from '../net/armoryLaw.js';
import {
  newPose,
  poseAtRest,
  poseFromBones,
  poseFromFigure,
  spriteMarks,
  spriteArmsSeen,
  poseWorld,
  ARMORY_BONES,
  POSE_AT,
} from './armoryPose.js';
import { previewMesh } from './auraPreview.js';
import { ortho, lookAt, multiply } from '../world/mat4.js';
import { createEffectStage } from './effectStage.js'; // STOREFRONT: a kill effect or a portal skin tried on
import { prefersReducedMotion } from '../systems/hitFlash.js'; // STOREFRONT: the viewer's less motion, read live

/** THE STAGE'S FRAME, one for every body: an orthographic camera `pitch` (rad) over level, the highest a plate's anchor
 *  can stand over the body (stageTopOf) `top` of the way down the picture and the near edge of the widest aura's ring
 *  (`reach`, m) `bottom` of it - room over the head for the plate and round the feet for any ring, at any height. */
export const STAGE_FRAME = Object.freeze({
  pitch: /** @type {number} */ (0.2),
  top: 0.21,
  bottom: 0.95,
  reach: Math.max(...Object.values(AURA_LOOK).map((l) => l.ringR)),
});

/** The highest a plate's anchor stands over a body posed `pose` (m over its feet): its head point `head`, or the tip of
 *  the tallest head piece it could wear - so a head piece tried on moves the plate, never the camera. Pure. */
export const stageTopOf = (/** @type {number} */ head, /** @type {any} */ pose) =>
  Math.max(
    head,
    ...Object.keys(ARMORY_HEAD).map((key) => armoryHeadTip({ kit: armoryKitWith(null, 'head', key), pose }) ?? 0),
  );

/** The stage's camera with `top` (stageTopOf) STAGE_FRAME.top of the way down a picture `aspect` wide to its height, seen
 *  `pitch` over level: { proj, view, eye }. Morrowind's picture is drawn by it (combat/fpArm.js stage()) and so is all
 *  on it. Pure. */
export function stageCamera(/** @type {number} */ top, /** @type {number} */ aspect, pitch = STAGE_FRAME.pitch) {
  const F = STAGE_FRAME,
    c = Math.cos(pitch),
    s = Math.sin(pitch);
  const halfH = (top * c + F.reach * s) / (2 * (F.bottom - F.top));
  const center = [0, top - ((1 - 2 * F.top) * halfH) / c, 0];
  const eye = [0, center[1] + 4 * s, 4 * c];
  return { proj: ortho(halfH * aspect, halfH, 0.1, 8), view: lookAt(eye, center, [0, 1, 0]), eye };
}

/** The camera a Morrowind body is drawn by on the stage, from its head point and its bones as posed (fpArm stage()'s
 *  `frame`). Pure. */
export function stageCameraOfBones(
  /** @type {number} */ head,
  /** @type {Record<string, number[]|null>} */ bones,
  /** @type {number} */ aspect,
) {
  const pose = newPose();
  return stageCamera(poseFromBones(bones, pose) ? stageTopOf(head, pose) : head, aspect);
}
/** STOREFRONT: no burn - the body whole. */
const NO_BURN = new Float32Array(4);
/** The floor's reach (m), drawn under every body. */
export const STAGE_FLOOR_R = 1.25;
/** THE DEPTH STAND-IN for a Morrowind picture: each part a prism between two pose points, its half-width across the body
 *  and half-depth through it (m) - inside the body as drawn, so a piece's near side is never hidden and its far side
 *  behind the body always is. */
export const STAGE_PROXY = Object.freeze(
  [
    ['head', 'crown', 0.075, 0.08],
    ['neck', 'head', 0.045, 0.045],
    ['pelvis', 'neck', 0.15, 0.075],
    ['shL', 'elL', 0.038, 0.038],
    ['shR', 'elR', 0.038, 0.038],
    ['elL', 'waL', 0.032, 0.032],
    ['elR', 'waR', 0.032, 0.032],
    ['hipL', 'knL', 0.06, 0.06],
    ['hipR', 'knR', 0.06, 0.06],
    ['knL', 'ftL', 0.045, 0.045],
    ['knR', 'ftR', 0.045, 0.045],
  ].map((p) => Object.freeze(p)),
);

const MESH_VS = `#version 300 es
layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN;
uniform mat4 uVP;
out vec3 vN; out vec3 vW;
void main() { vN = aN; vW = aP; gl_Position = uVP * vec4(aP, 1.0); }`;
// STOREFRONT: a kill tried on burns the body away from the feet up, its edge in the kill's colour (uDissolve: share, rgb)
export const STAGE_BURN_GLSL = `
uniform vec4 uDissolve;
float bh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bh(i), bh(i + vec2(1.0, 0.0)), f.x), mix(bh(i + vec2(0.0, 1.0)), bh(i + vec2(1.0, 1.0)), f.x), f.y); }
bool burnt(float up, vec2 q, inout vec3 c) {
  if (uDissolve.x <= 0.0) return false;
  float k = 0.5 * up + 0.5 * (0.65 * bn(q * vec2(18.0, 30.0)) + 0.35 * bn(q * vec2(60.0, 90.0))), edge = uDissolve.x * 1.15 - 0.075;
  if (k < edge) return true;
  if (k < edge + 0.06) c = mix(c, uDissolve.yzw * 1.6, 0.85);
  return false;
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; uniform vec3 uEye; uniform vec3 uGround; uniform int uFloor; out vec4 o;
${STAGE_BURN_GLSL}
void main() {
  if (uFloor == 1) {
    float r = length(vW.xz);
    o = vec4(uGround * (1.0 - smoothstep(0.3, ${STAGE_FLOOR_R.toFixed(2)}, r)) * (0.85 + 0.15 * fract(sin(dot(floor(vW.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5)), 1.0);
    return;
  }
  vec3 n = normalize(vN), e = normalize(uEye - vW);
  float key = max(dot(n, normalize(vec3(0.3, 0.8, 0.5))), 0.0), rim = pow(1.0 - max(dot(n, e), 0.0), 3.0);
  vec3 c = vec3(0.07, 0.065, 0.085) + vec3(0.09, 0.085, 0.1) * key + vec3(0.16, 0.14, 0.3) * rim;
  if (burnt(vW.y / 1.9, vec2(vW.x + vW.z * 0.7, vW.y * 0.5) * 2.0, c)) discard;
  o = vec4(c, 1.0);
}`;
// a picture on a quad: the Morrowind picture over the whole canvas (uScreen 1, its rows top down), or a sprite's card
// standing in the world (uScreen 0, its rows bottom up), cut at half alpha and writing depth as the world's card does.
// uScreen is in both stages, so the fragment's ints are highp as the vertex's are - unequal precisions fail the link
const PIC_VS = `#version 300 es
layout(location = 0) in vec2 aC;
uniform mat4 uVP; uniform int uScreen; uniform vec3 uRight; uniform vec4 uCard;
out vec2 vUv;
void main() {
  if (uScreen == 1) { vUv = vec2(aC.x, 1.0 - aC.y); gl_Position = vec4(aC * 2.0 - 1.0, 0.0, 1.0); return; }
  vUv = aC;
  vec3 p = uRight * (uCard.x + (aC.x - 0.5) * uCard.z) + vec3(0.0, uCard.y + aC.y * uCard.w, 0.0);
  gl_Position = uVP * vec4(p, 1.0);
}`;
const PIC_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vUv; uniform sampler2D uTex; uniform int uScreen; out vec4 o;
${STAGE_BURN_GLSL}
void main() {
  vec4 c = texture(uTex, vUv);
  if (uScreen == 0 && c.a < 0.5) discard;
  vec3 rgb = c.rgb;
  if (burnt(uScreen == 1 ? 1.0 - vUv.y : vUv.y, vUv, rgb)) discard;
  o = uScreen == 1 ? vec4(rgb, c.a) : vec4(rgb, 1.0);
}`;

/** The depth stand-in's triangles round a pose (`pts`, world): an eight-sided prism a part, its across axis the body's
 *  right. (x, y, z, nx, ny, nz) a vertex. Pure. */
export function proxyMesh(/** @type {ArrayLike<number>} */ pts, /** @type {Record<string, number>} */ at) {
  const v = [];
  const P = (/** @type {string} */ n) => [pts[at[n]], pts[at[n] + 1], pts[at[n] + 2]];
  const shL = P('shL'),
    shR = P('shR');
  const right0 = [shR[0] - shL[0], 0, shR[2] - shL[2]],
    rl = Math.hypot(right0[0], right0[2]) || 1;
  const right = [right0[0] / rl, 0, right0[2] / rl],
    fwd = [-right[2], 0, right[0]];
  for (const [a, b, rx, rz] of STAGE_PROXY) {
    const A = P(/** @type {string} */ (a)),
      B = P(/** @type {string} */ (b));
    const ring = (/** @type {number[]} */ c, /** @type {number} */ k) => {
      const t = (k / 8) * Math.PI * 2,
        x = Math.cos(t) * /** @type {number} */ (rx),
        z = Math.sin(t) * /** @type {number} */ (rz);
      return [
        c[0] + right[0] * x + fwd[0] * z,
        c[1],
        c[2] + right[2] * x + fwd[2] * z,
        Math.cos(t) * right[0] + Math.sin(t) * fwd[0],
        0,
        Math.cos(t) * right[2] + Math.sin(t) * fwd[2],
      ];
    };
    for (let k = 0; k < 8; k++) {
      const a0 = ring(A, k),
        a1 = ring(A, k + 1),
        b0 = ring(B, k),
        b1 = ring(B, k + 1);
      v.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    }
    for (const [c, s] of [
      [A, -1],
      [B, 1],
    ])
      for (let k = 0; k < 8; k++)
        v.push(
          .../** @type {number[]} */ (c),
          0,
          s,
          0,
          ...ring(/** @type {number[]} */ (c), k),
          ...ring(/** @type {number[]} */ (c), k + 1),
        );
  }
  return new Float32Array(v);
}

/**
 * THE STAGE on `canvas`: `body` drawn with `aura` at its feet and `kit` on it until stopped - a Morrowind body (fpArm
 * stage()), a sprite (its rows bottom first) or the stand-in (null). Answers { setBody, setKit, setAura, setEffect, headAt,
 * stop, alive, step }, null with no WebGL2; `headAt()` the plate's anchor in CSS px (ui/nameLayer.js's), or null.
 * @param {HTMLCanvasElement} canvas
 * @param {{ body?: any, kit?: string|null, aura?: string|null, now?: () => number, clear?: number[], ground?: number[], pitch?: number,
 *   cue?: ((slot: string, key: string|null) => void)|null }} [o] `cue` an effect's loop beginning (STOREFRONT: its sound)
 */
export function startCharacterStage(
  canvas,
  {
    body = null,
    kit = null,
    aura = null,
    now = () => performance.now() / 1000,
    clear = [0.035, 0.03, 0.055],
    ground = [0.11, 0.1, 0.13],
    pitch = STAGE_FRAME.pitch,
    cue = null,
  } = {},
) {
  /** @type {WebGL2RenderingContext|null} */
  const gl = /** @type {any} */ (
    canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false })
  );
  if (!gl) return null;
  const program = (/** @type {string} */ vs, /** @type {string} */ fs) => {
    const p = /** @type {WebGLProgram} */ (gl.createProgram());
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ]) {
      const x = /** @type {WebGLShader} */ (gl.createShader(/** @type {number} */ (type)));
      gl.shaderSource(x, /** @type {string} */ (src));
      gl.compileShader(x);
      gl.attachShader(p, x);
    }
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const meshProg = program(MESH_VS, MESH_FS),
    picProg = program(PIC_VS, PIC_FS);
  if (!meshProg || !picProg) return null;
  const uni = (/** @type {WebGLProgram} */ p, /** @type {string[]} */ names) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const MU = uni(meshProg, ['uVP', 'uEye', 'uGround', 'uFloor', 'uDissolve']),
    PU = uni(picProg, ['uVP', 'uScreen', 'uRight', 'uCard', 'uTex', 'uDissolve']);
  const vbo = (/** @type {Float32Array} */ data, /** @type {number} */ stride) => {
    const vao = gl.createVertexArray(),
      buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    if (stride === 24) {
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    } else {
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    }
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / (stride / 4) };
  };
  const stand = previewMesh();
  const standVbo = vbo(stand.data, 24);
  const quad = vbo(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 8);
  let proxy = /** @type {{ vao: any, buf: any, count: number }|null} */ (null);
  const tex = gl.createTexture();
  let aurPass = null,
    armPass = null;
  try {
    aurPass = new AuraRingRenderer(gl);
  } catch {
    aurPass = null;
  }
  try {
    armPass = new ArmoryRenderer(gl);
  } catch {
    armPass = null;
  }
  // STOREFRONT: the effects tried on - a kill on the body, a portal behind it - and each loop's cue (`cue`: its sound)
  const effects = createEffectStage(gl, { reduced: () => prefersReducedMotion(), onCue: (sl, k) => cue?.(sl, k) }); // less motion followed mid-session
  let lastT = now();

  const t0 = now();
  const pose = newPose();
  const wearer = {
    id: 'stage',
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
  const kitWearer = {
    id: 'stage',
    at: [0, 0, 0],
    kit,
    seed: 0.37,
    kindle: 0,
    since: t0,
    yaw: 0,
    torn: -1,
    pose,
    vel: [0, 0, 0],
    trail: null,
    _d: 3,
  };
  let shown = /** @type {any} */ (null);
  let sprite = /** @type {{ w: number, h: number, x: number, y: number }|null} */ (null);
  let vp = new Float32Array(16),
    raf = 0,
    stopped = false,
    rest = 0;

  /** A body taken in: its pose, the cape's bones, its picture uploaded and its depth stand-in built. */
  function setBody(/** @type {any} */ b) {
    shown = b && (b.kind === 'mw' || b.kind === 'sprite') ? b : null;
    sprite = null;
    if (proxy) {
      gl.deleteBuffer(proxy.buf);
      gl.deleteVertexArray(proxy.vao);
      proxy = null;
    }
    wearer.cape = CLOAK_REST_POSE;
    if (shown?.kind === 'mw' && poseFromBones(shown.bones, pose)) {
      auraCapeStep(wearer, { feet: [0, 0, 0], yaw: 0, bones: shown.bones });
      proxy = vbo(proxyMesh(pose.pts, POSE_AT), 24);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        shown.width,
        shown.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(shown.data.buffer, shown.data.byteOffset, shown.width * shown.height * 4),
      );
    } else if (shown?.kind === 'sprite') {
      const fig = {
        base: shown.base ?? 0,
        mpp: shown.mpp,
        beast: false,
        marks: spriteMarks(shown.colors, shown.width, shown.height, {
          arms: spriteArmsSeen(shown.view),
          art: shown.art,
        }),
        shift: shown.shift ?? 0,
      };
      if (!poseFromFigure(fig, pose)) {
        shown = null;
        poseAtRest(pose);
      } else {
        auraCapeStep(wearer, { feet: [0, 0, 0], yaw: 0, bones: auraSpriteBones(fig) });
        sprite = { w: shown.width * shown.mpp, h: shown.height * shown.mpp, x: fig.shift, y: fig.base };
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          shown.width,
          shown.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array(shown.colors.buffer, shown.colors.byteOffset, shown.width * shown.height * 4),
        );
      }
    } else {
      shown = null;
      poseAtRest(pose);
    }
    if (shown?.kind === 'mw' && !proxy) {
      shown = null;
      poseAtRest(pose);
    }
    if (!shown) rest = /** @type {number[]} */ (poseWorld(pose, 'crown', [0, 0, 0], 0, [0, 0, 0]))[1];
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, shown?.kind === 'sprite' ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, shown?.kind === 'sprite' ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** The head point (m over the feet), where the world stands the body's plate: a Morrowind body's own, a sprite's
   *  card top (net/peer/peerRiders.js heightOf: its foot's offset and its height), the stand-in's crown. */
  const headY = () =>
    shown?.kind === 'mw' && shown.head > 0
      ? shown.head
      : sprite
        ? sprite.y + sprite.h
        : shown
          ? /** @type {number[]} */ (poseWorld(pose, 'crown', [0, 0, 0], 0, [0, 0, 0]))[1]
          : rest;
  /** The camera this frame: the one the Morrowind picture was drawn by, else the frame's over `w` by `h`. */
  function camera(/** @type {number} */ w, /** @type {number} */ h) {
    if (shown?.kind === 'mw') return { proj: shown.proj, view: shown.view, eye: shown.eye };
    return stageCamera(stageTopOf(headY(), pose), w / h, pitch);
  }

  const frame = () => {
    raf = 0;
    if (stopped) return;
    if (canvas.isConnected === false) {
      stop();
      return;
    }
    const t = now();
    let w, h;
    if (shown?.kind === 'mw') {
      w = shown.width;
      h = shown.height;
    } else {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const cam = camera(w, h);
    vp = multiply(cam.proj, cam.view);
    effects.step(t - lastT, headY()); // STOREFRONT
    lastT = t;
    const burn = effects.burn();
    const right = [cam.view[0], cam.view[4], cam.view[8]];
    wearer.kindle = Math.min(1, (t - wearer.since) / AURA_KINDLE_S);
    kitWearer.kindle = Math.min(1, (t - kitWearer.since) / AURA_KINDLE_S);
    gl.viewport(0, 0, w, h);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(meshProg);
    gl.uniformMatrix4fv(MU.uVP, false, vp);
    gl.uniform3fv(MU.uEye, cam.eye);
    gl.uniform3fv(MU.uGround, ground);
    gl.uniform4fv(MU.uDissolve, burn ?? NO_BURN);
    gl.bindVertexArray(standVbo.vao);
    gl.uniform1i(MU.uFloor, 1);
    gl.drawArrays(gl.TRIANGLES, 0, stand.floorN);
    effects.drawBehind(vp, right); // STOREFRONT: a portal tried on stands behind the body
    gl.useProgram(meshProg);
    gl.bindVertexArray(standVbo.vao);
    if (!shown) {
      gl.uniform1i(MU.uFloor, 0);
      gl.drawArrays(gl.TRIANGLES, stand.floorN, stand.count - stand.floorN);
    }
    gl.useProgram(picProg);
    gl.uniform4fv(PU.uDissolve, burn ?? NO_BURN);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(PU.uTex, 0);
    gl.bindVertexArray(quad.vao);
    if (shown?.kind === 'mw') {
      // the picture over the whole canvas, its own colour - the depth its prisms write after it
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(PU.uScreen, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(meshProg);
      gl.colorMask(false, false, false, false);
      if (proxy && !burn) {
        gl.bindVertexArray(proxy.vao);
        gl.uniform1i(MU.uFloor, 0);
        gl.drawArrays(gl.TRIANGLES, 0, proxy.count);
      } // STOREFRONT: a body burning away hides nothing
      gl.colorMask(true, true, true, true);
    } else if (shown?.kind === 'sprite' && sprite) {
      gl.uniformMatrix4fv(PU.uVP, false, vp);
      gl.uniform3f(PU.uRight, cam.view[0], cam.view[4], cam.view[8]);
      gl.uniform4f(PU.uCard, sprite.x, sprite.y, sprite.w, sprite.h);
      gl.uniform1i(PU.uScreen, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
    if (wearer.aura && !burn) aurPass?.draw([wearer], cam.proj, cam.view, new Float32Array(cam.eye), t, null); // STOREFRONT: gone with the body it burns off
    if (kitWearer.kit && !burn) armPass?.draw([kitWearer], cam.proj, cam.view, new Float32Array(cam.eye), t, null);
    effects.drawFront(cam.proj, cam.view, cam.eye); // STOREFRONT: the kill's and the portal's bursts
    raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  };
  function stop() {
    stopped = true;
    if (raf) globalThis.cancelAnimationFrame?.(raf);
    effects.destroy();
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // EVERY ALLOCATION HAS AN OWNER: the context and all it held
  }
  setBody(body);
  raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  return {
    setBody,
    setKit(/** @type {string|null} */ next) {
      if (next !== kitWearer.kit) {
        kitWearer.kit = next;
        kitWearer.since = now();
      }
    },
    setAura(/** @type {string|null} */ next) {
      if (next !== wearer.aura) {
        wearer.aura = next;
        wearer.since = now();
      }
    },
    /** STOREFRONT: an effect tried on - `slot` 'kill' or 'portal' and its look (a portal's null: the violet vortex), any
     *  other slot none. */
    setEffect(/** @type {string|null} */ slot, /** @type {string|null} */ key) {
      effects.set(slot, key);
    },
    /** The plate's anchor in CSS pixels, or null: the head point (net/remotePlayers.js namePoints' `head`), or over it
     *  the tip of the head piece worn or tried on (armoryHeadTip) - as the world's names stand. */
    headAt() {
      const y = Math.max(headY(), armoryHeadTip(kitWearer) ?? 0);
      const c = [0, 1, 2, 3].map((r) => vp[4 + r] * y + vp[12 + r]);
      if (!(c[3] > 0)) return null;
      const cw = canvas.clientWidth || canvas.width,
        ch = canvas.clientHeight || canvas.height;
      return { x: ((c[0] / c[3]) * 0.5 + 0.5) * cw, y: (0.5 - (c[1] / c[3]) * 0.5) * ch };
    },
    stop,
    /** Whether it still draws - false once stopped, its canvas taken off the page or let go. */
    alive: () => !stopped,
    /** for a probe: one frame drawn now */
    step: () => {
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      frame();
    },
  };
}

/** The bones a Morrowind stage is asked for: the pose's and the cape's. */
export const STAGE_BONES = Object.freeze([...new Set([...ARMORY_BONES, ...CLOAK_BONES])]);
