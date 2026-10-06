// AUDIT FLICKER (2026-09-30, a player: "interior lights flickering and not casting right"; the ask: "investigate
// shadow flickering with enhanced lighting") - THE SHADOWS THAT CHANGED WHEN NOTHING DID.
//
// Four passes over the lane (the sun, the lamps, the frame's records, the receivers) found the frames where a shadow
// moved, came or went with nothing in the world moving. Each fix is pinned here by what it does - the GLSL through the
// evaluator, the pass through the recording GL - and each has its mutants (tools/mutants/audit_flicker.json).
//
//   S1  a flat's soft sun read shadowed by its OWN card, by a share the sun's turn slid texel by texel
//   S2  a re-anchor put every cascade's grid on a new phase (up to half a texel, every 24-31 m walked)
//   P1  a flat's lamp read, taken ON its own card - a frame late, so a flat walking away from a lamp shadowed itself
//   P2  the first-person card's two lamps picked with no hold - turning in place hopped the shadow from lamp to lamp
//   P3  a floating-origin crossing lost every light kept by place (an exact match of two precisions' sums)
//   R1  a peer's sprite batch made anew each animation frame - its shadow strobed with its walk
//   R2  a crossing left the pixel-placed flats and the townsfolk a frame behind the world
//   R3  four flat lists (peers riding and walking, the bands, the yards) dropped out of shadow reach off screen
//   R4  a door crossed into the street replayed the room's records into the street's cascades
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_BB_FS, EL_FLAT_LAMP_LIFT } from '../src/render/enhancedLighting.js';
import {
  SHADOW_SUN_SIZE, SHADOW_SUN_BIAS, SHADOW_CASCADES, SUN_ANCHOR_HOLD, SUN_FLAT_REACH_TEXELS, SHADOW_STILL_EPS,
  CASTER_KEEP_RATIO, sunAnchorFor, sunCascadeMatrices, sunTexelWorld, samePlace, nearestRank, SHADOW_TUNING,
} from '../src/render/shadowPass.js';
SHADOW_TUNING.override = false;   // FLICKER-FIX: these tests pin the old schedule (the card's two lamps, DISC6's hold at the casters' edge)
import { transformPoint } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const eyeAt = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
const cascades = () => SHADOW_CASCADES.map(() => new Float32Array(16));
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const frac = (v) => Math.abs(v - Math.round(v));
const texelOf = (vp, p) => { const q = transformPoint(vp, p[0], p[1], p[2]); return [q[0] * SHADOW_SUN_SIZE / 2, q[1] * SHADOW_SUN_SIZE / 2]; };

// ── the sun map, drawn from quads ─────────────────────────────────────────────────────────────────────────────────

/** NDC -> world for an orthographic view-projection (an affine map: its inverse is the 3x3's and the translation). */
function unproject(m) {
  const [a0, a1, a2, b0, b1, b2, c0, c1, c2] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a0 * (b1 * c2 - b2 * c1) - a1 * (b0 * c2 - b2 * c0) + a2 * (b0 * c1 - b1 * c0);
  const inv = [
    [(b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det, (a1 * b2 - a2 * b1) / det],
    [(b2 * c0 - b0 * c2) / det, (a0 * c2 - a2 * c0) / det, (a2 * b0 - a0 * b2) / det],
    [(b0 * c1 - b1 * c0) / det, (a1 * c0 - a0 * c1) / det, (a0 * b1 - a1 * b0) / det],
  ];
  return (x, y, z) => { const d = [x - m[12], y - m[13], z - m[14]]; return inv.map((r) => r[0] * d[0] + r[1] * d[1] + r[2] * d[2]); };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** The depth the sun pass writes at an NDC texel centre: the nearest of `quads` ({o, e1, e2}, e1 and e2 square) along
 *  the light's ray there, 1 where none is. */
function depthAt(inv, quads, xn, yn) {
  const A = inv(xn, yn, 0), D = sub(inv(xn, yn, 1), A);
  let best = 1;
  for (const q of quads) {
    const nq = cross(q.e1, q.e2), den = dot(nq, D);
    if (Math.abs(den) < 1e-12) continue;
    const z = dot(nq, sub(q.o, A)) / den;
    if (z < -1 || z > 1) continue;
    const p = [A[0] + z * D[0], A[1] + z * D[1], A[2] + z * D[2]], r = sub(p, q.o);
    const s = dot(r, q.e1) / dot(q.e1, q.e1), t = dot(r, q.e2) / dot(q.e2, q.e2);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) best = Math.min(best, z * 0.5 + 0.5);
  }
  return best;
}
/** The sampler: COMPARE_REF_TO_TEXTURE with LINEAR - four texels compared, then filtered, as the hardware does. */
const sunMap = (vps, quads) => {
  const invs = vps.map(unproject), N = SHADOW_SUN_SIZE;
  return (name, P) => {
    if (name !== 'uSunShadow') return [1, 1, 1, 1];
    const inv = invs[P[2] | 0];
    const sx = P[0] * N - 0.5, sy = P[1] * N - 0.5, bx = Math.floor(sx), by = Math.floor(sy), fx = sx - bx, fy = sy - by;
    let lit = 0;
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      lit += w * (P[3] <= depthAt(inv, quads, ((bx + dx + 0.5) / N) * 2 - 1, ((by + dy + 0.5) / N) * 2 - 1) ? 1 : 0);
    }
    return lit;
  };
};
/** A flat's card as the sun replay draws it: upright through its base, turned square to the sun (shadowPass.js's
 *  `_right` - the sun's horizontal direction's perpendicular). */
const sunCard = (B, W, H, ld) => {
  const rl = Math.hypot(ld[2], ld[0]), right = [ld[2] / rl, 0, -ld[0] / rl];
  return { o: [B[0] - right[0] * W / 2, B[1], B[2] - right[2] * W / 2], e1: right.map((x) => x * W), e2: [0, H, 0] };
};
const slab = (B, y) => ({ o: [B[0] - 3, y, B[2] - 3], e1: [6, 0, 0], e2: [0, 0, 6] });
/** A board square to the sun, `t` up the light from `p`: one depth under every tap of the kernel. */
const board = (p, ld, t) => {
  const rl = Math.hypot(ld[2], ld[0]), right = [ld[2] / rl, 0, -ld[0] / rl], up = norm(cross(ld, right));
  const c = [p[0] + ld[0] * t, p[1] + ld[1] * t, p[2] + ld[2] * t];
  return { o: [c[0] - (right[0] + up[0]) * 3, c[1] - (right[1] + up[1]) * 3, c[2] - (right[2] + up[2]) * 3], e1: right.map((x) => x * 6), e2: up.map((x) => x * 6) };
};
/** The lane's flat read (sunShadowSoftAt, the evaluator on EL_BB_FS's own text) under a sun `ld` over `quads`. */
function flatSun(eye, ld, quads) {
  const anchor = new Float64Array([NaN, NaN, NaN]);
  sunAnchorFor(eye, anchor);
  const vps = sunCascadeMatrices(eye, ld, cascades(), anchor);
  const U = {
    uCamPos: eye, uSunOrigin: [0, 0, 0, 0], uSunShadowParams: [...SHADOW_CASCADES, 1],
    uSunTexel: [sunTexelWorld(0), sunTexelWorld(1), sunTexelWorld(2), 0], uSunVP: vps.map((m) => Array.from(m)),
    texture: sunMap(vps, quads),
  };
  const fs = glslFunctions(EL_BB_FS, U, { fp32: true });
  // the depth-per-world-unit along the light (the far cascade's row, which every cascade shares): the bias in world units
  const zl = Math.hypot(vps[2][2], vps[2][6], vps[2][10]);
  return { read: (p, h) => fs.sunShadowSoftAt(p, [0, 1, 0], h), biasWorld: SHADOW_SUN_BIAS / (0.5 * zl) };
}

test('AUDIT FLICKER S1: A FLAT IS NEVER SHADOWED BY ITS OWN CARD - a townsman a hundred units off under a morning sun read a third of his light away off the card the sun pass drew through his own feet; now he reads lit, and the sun turning a hair a frame no longer steps him (mutants: no own-card bias; the bias with no height cap; the cap in height, not in depth)', () => {
  assert.equal(SUN_FLAT_REACH_TEXELS, 2.5, 'the kernel: two texels each side, and the bilinear tap\'s half');
  const eye = [0, 1.7, 0], B = [80, 0, 60];   // a hundred units off: the far cascade, where a texel is 23 cm
  const ld = norm([0.6, 0.55, 0.58]);
  const { read } = flatSun(eye, ld, [sunCard(B, 0.9, 2, ld)]);
  const P = [B[0], B[1] + 0.5, B[2]];   // EL2's point, where the lane reads a flat
  const before = read(P, 0);   // h 0: no bias - the read the lane took before
  assert.ok(before < 0.9, `the scene has the bug: the old read sat in its own card's shadow (${before})`);
  assert.equal(read(P, 2), 1, 'the flat reads its sun whole');
  // THE FLICKER: the sun turns (the far map is redrawn each other frame), the card's texels slide under the kernel
  const olds = [], nows = [];
  for (let k = 0; k < 24; k++) {
    const a = 0.4 + k * 0.0025, l = norm([Math.cos(a) * 0.83, 0.55, Math.sin(a) * 0.83]);
    const f = flatSun(eye, l, [sunCard(B, 0.9, 2, l)]);
    olds.push(f.read(P, 0)); nows.push(f.read(P, 2));
  }
  assert.ok(Math.max(...olds) - Math.min(...olds) > 0.1, `the old read stepped as the sun turned (${Math.min(...olds)} to ${Math.max(...olds)})`);
  assert.deepEqual(new Set(nows), new Set([1]), 'the new one never moves');
});

test('AUDIT FLICKER S1: the bias is only what the card could hold - a roof over a tall flat still shadows it, and a SHORT flat keeps its shadow from anything nearer the light than its own card above the read reaches (mutants: the cap gone; the cap in height)', () => {
  const eye = [0, 1.7, 0], B = [80, 0, 60], ld = norm([0.6, 0.55, 0.58]);
  const sinE = ld[1];
  const P = [B[0], B[1] + 0.5, B[2]];
  // a roof 2.6 up: far beyond any card's hold
  assert.equal(flatSun(eye, ld, [sunCard(B, 0.9, 2, ld), slab(B, 2.6)]).read(P, 2), 0, 'under a roof: dark');
  // a short flat (0.7: two tenths of a unit of card above the read) under a board just past that hold, up the light
  // from the point the lookup projects (the normal offset lifts it a texel and a half)
  const h = 0.7, S = [P[0], P[1] + 1.5 * sunTexelWorld(2), P[2]];
  const past = flatSun(eye, ld, []).biasWorld + (h - 0.5) * sinE + 0.03;   // the constant bias, the card's whole hold, and three centimetres
  assert.equal(flatSun(eye, ld, [sunCard(B, 0.9, h, ld), board(S, ld, past)]).read(P, h), 0, `a board ${past.toFixed(3)} up the light from a short flat's read still shadows it`);
  assert.equal(flatSun(eye, ld, [sunCard(B, 0.9, h, ld), board(S, ld, past - 0.06)]).read(P, h), 1, '...and one inside the hold is the card\'s own reach: lit (the law is the hold, not a bias to spare)');
});

// ── S2: the re-anchor ──────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT FLICKER S2: A RE-ANCHOR KEEPS THE GRID - walking past the hold moved every cascade\'s texel grid up to half a texel in one frame; now every world point keeps its phase on all three, and the new anchor stands within the hold of the eye (mutants: rounded at the eye as before; a whole NEAR texel in place of a far one; no move along the light)', () => {
  const texel = sunTexelWorld(SHADOW_CASCADES.length - 1);
  let worstNew = 0, worstOld = 0;
  const walks = [[36.37, 0.4, -7.91], [-18.2, 3.1, 32.6], [5.5, -0.7, -41.3], [31.1, 1.2, 24.4]];   // past the hold from any rounding
  for (const [minute, ldRaw] of [[9 * 60, [0.45, 0.8, 0.35]], [16 * 60, [-0.62, 0.41, 0.2]]]) {
    const ld = norm(ldRaw);
    for (const w of walks) {
      const eye0 = [403.7 + minute / 100, 12.2, -290.1];
      const a = new Float64Array([NaN, NaN, NaN]);
      assert.equal(sunAnchorFor(eye0, a, ld, texel), true, 'a first anchor');
      const vp0 = sunCascadeMatrices(eye0, ld, cascades(), a);
      const eye1 = [eye0[0] + w[0], eye0[1] + w[1], eye0[2] + w[2]];
      const old = Float64Array.from(a);
      assert.equal(sunAnchorFor(eye1, a, ld, texel), true, 'past the hold: moved');
      assert.ok(Math.hypot(a[0] - eye1[0], a[1] - eye1[1], a[2] - eye1[2]) < 0.2, `the anchor stands at the eye (${[...a]} for ${eye1})`);
      assert.equal(sunAnchorFor(eye1, a, ld, texel), false, 'and holds there');
      const vp1 = sunCascadeMatrices(eye1, ld, cascades(), a);
      assert.equal(sunAnchorFor(eye1, old), true, 'the old law re-anchors as well');
      const vpOld = sunCascadeMatrices(eye1, ld, cascades(), old);
      for (const d of [[1.3, -0.5, 2.2], [-7.9, 1.1, 4.4], [15.2, 0, -9.7]]) {
        const p = [eye1[0] + d[0], eye1[1] + d[1], eye1[2] + d[2]];
        for (let c = 0; c < SHADOW_CASCADES.length; c++) {
          const t0 = texelOf(vp0[c], p), t1 = texelOf(vp1[c], p), tOld = texelOf(vpOld[c], p);
          worstNew = Math.max(worstNew, frac(t0[0] - t1[0]), frac(t0[1] - t1[1]));
          worstOld = Math.max(worstOld, frac(t0[0] - tOld[0]), frac(t0[1] - tOld[1]));
        }
      }
    }
  }
  assert.ok(worstNew < 0.02, `every point keeps its phase in every cascade (worst ${worstNew.toFixed(4)} of a texel)`);
  assert.ok(worstOld > 0.2, `the old re-anchor jumped the grid (${worstOld.toFixed(3)} of a texel)`);
  assert.ok(SUN_ANCHOR_HOLD > 1, 'the hold');
  // the pass hands it the light and the far texel, at the travel view's scale
  assert.match(rd('src/render/shadowPass.js'), /sunAnchorFor\(f\.eye, this\._sunAnchor, f\.lightDir, sunTexelWorld\(SHADOW_CASCADES\.length - 1, k\)\);/);
});

// ── P1: a flat's lamp read, off its own card ───────────────────────────────────────────────────────────────────────

test('AUDIT FLICKER P1: A FLAT READS A LAMP OFF ITS OWN CARD - the lamp\'s map holds the card as the flat stood LAST frame (the replay is a frame behind), and a read on the card itself shadowed a flat walking away from the lamp at any pace; the read is lifted EL_FLAT_LAMP_LIFT toward the lamp, half the way for a lamp nearer than twice that (mutants: no lift; the lift away from the lamp; no half-way cap)', () => {
  assert.equal(EL_FLAT_LAMP_LIFT, 0.35);
  // the lane's own lines, run: where elPointFlat reads light i's shadow for a flat whose EL2 point is `base`
  const m = /\n(\s*vec3 toL = uPointLights\[i\]\.xyz - base;\n\s*float tl = length\(toL\);\n\s*vec3 at = [^\n]*)/.exec(EL_BB_FS);
  assert.ok(m, 'the three lines, in the flat\'s lamp loop');
  const src = `uniform vec4 uPointLights[1];\nvec3 liftAt(vec3 base) { int i = 0;\n${m[1].replace(/\/\/[^\n]*/g, '')}\n  return at;\n}`;
  const lampAt = (L, base) => glslFunctions(src, { uPointLights: [[...L, 12]] }).liftAt(base);
  // the card a frame late: upright through where the flat stood, square to the lamp; a read behind it (from the lamp)
  // is in its shadow
  const shadowedByOwnCard = (L, base, prev, at) => {
    const f = norm([prev[0] - L[0], 0, prev[2] - L[2]]);
    return dot(sub(at, L), f) > dot(sub(prev, L), f) + 0.02;
  };
  const L = [3, 2.5, 1];
  for (const step of [0.03, 0.1, 0.2]) {   // a walk at 60 fps to a run at 30, straight away from the lamp
    const away = norm([-3, 0, -1]);
    const base = [0, 0.5, 0], prev = [base[0] - away[0] * step, 0.5, base[2] - away[2] * step];
    assert.ok(shadowedByOwnCard(L, base, prev, base), `a read on the card, ${step} a frame: in its own shadow`);
    const at = lampAt(L, base);
    assert.ok(!shadowedByOwnCard(L, base, prev, at), `lifted to ${at.map((x) => x.toFixed(3))}: lit`);
    assert.ok(Math.abs(Math.hypot(...sub(at, base)) - EL_FLAT_LAMP_LIFT) < 1e-6, 'lifted the lift');
    assert.ok(dot(sub(at, base), sub(L, base)) > 0, 'toward the lamp');
  }
  // a lantern the flat carries, 0.4 off: half the way, never past it
  const near = [0.2, 0.8, 0.2], at = lampAt(near, [0, 0.5, 0]);
  assert.ok(Math.abs(Math.hypot(...sub(at, [0, 0.5, 0])) - Math.hypot(...sub(near, [0, 0.5, 0])) / 2) < 1e-6, `half the way to a near lamp (${at})`);
});

// ── the pass on the recording GL (DISC29's hall) ─────────────────────────────────────────────────────────────────────

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
/** An interior: a room reaching every lamp, `lamps` (x, y, z, range) and the player's card, all about `at`. */
function hall(lamps, at = [0, 0, 0]) {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['201_1', '1_1']) r.textures.set(k, { id: `t${k}` });
  r.setLighting(new Float32Array([0.18, 0.18, 0.18]), 0);
  const walls = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 40]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const self = { archive: 201, record: 1, vao: { id: 'vao-self' }, indexCount: 6, size: { w: 0.8, h: 1.8 }, origin: [...at], bounds: new Float32Array([0, 0.9, 0, 1]), selfCard: true };
  const o = [...at], eye = [0, 1.6, 4];
  let L = lamps, view = eyeAt(at[0] + eye[0], eye[1], at[2] + eye[2]);
  const frame = () => {
    r.setPointLights(new Float32Array(L), new Float32Array(L.length / 4 * 3).fill(1));
    r.beginFrame(I, view, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    const st = { ...r.shadows.stats };
    r.drawMesh(walls, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, o[0], o[1], o[2], 1]), null);
    r.drawBillboards([self], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  const shift = (d) => {   // world.js's recentre: the renderer told, then the host's own things moved by its doubles
    r.shadowOriginShift(d);
    for (let k = 0; k < 3; k++) o[k] += d[k];
    self.origin = self.origin.map((x, k) => x + d[k]);
    L = L.map((x, i) => (i % 4 < 3 ? x + d[i % 4] : x));
    view = eyeAt(o[0] + eye[0], o[1] + eye[1], o[2] + eye[2]);
  };
  const setEye = (e) => { eye.splice(0, 3, ...e); view = eyeAt(o[0] + eye[0], o[1] + eye[1], o[2] + eye[2]); };
  const setLamp = (i, p) => { L = L.slice(); L[i * 4] = p[0]; L[i * 4 + 1] = p[1]; L[i * 4 + 2] = p[2]; };
  return { r, sp: r.shadows, self, frame, shift, setLamp, setEye };
}
/** Which lamps hold the player's card this frame (by the lamp's index in the host's list). */
const cardLamps = (sp, n) => { const out = []; for (let i = 0; i < n; i++) { const k = sp.shadowIndex[i]; if (k >= 0 && sp._slotSelf[k]) out.push(i); } return out.join(','); };

test('AUDIT FLICKER P2: THE CARD\'S TWO LAMPS ARE HELD - in first person the card stands a pace before the eye and circles the feet as the player turns, and the pair nearest it was picked afresh each frame: a card wavering on the line between two lamps swapped its shadow between them every frame; now the lamp that has it keeps it until another is nearer by DISC6\'s keep ratio (mutants: no hold; the pair not carried to the next frame)', () => {
  // three lamps on a line: the card by the middle one, and the other two all but equally far from it
  const { sp, self, frame } = hall([-1, 2.5, 0, 12, 1, 2.5, 0, 12, 3, 2.5, 0, 12]);
  self.origin = [0.97, 0, 0];
  frame(); frame(); frame();
  const first = cardLamps(sp, 3);
  assert.equal(first, '0,1', 'the middle lamp and the west one (1.97 m against 2.03)');
  const seen = new Set();
  for (let f = 0; f < 12; f++) {
    self.origin = [f % 2 ? 1.04 : 0.96, 0, 0];   // the card wavers across the line, four centimetres each way
    frame();
    seen.add(cardLamps(sp, 3));
  }
  assert.deepEqual([...seen], ['0,1'], 'the pair never changed');
  // ...and a lamp truly nearer takes the card: past the keep ratio (the east lamp at 1.2 m against the west's 2.8)
  self.origin = [1.8, 0, 0];
  frame();
  assert.equal(cardLamps(sp, 3), '1,2', 'the card walked east: the east lamp has it');
  // the unit: a held light counts at CASTER_KEEP_RATIO of its distance, by place
  const lights = new Float32Array([-1, 2.5, 0, 12, 3, 2.5, 0, 12]), eye = [1.05, 2.5, 0];
  assert.equal(nearestRank([0, 1], lights, eye, 1), 0, 'unheld: the east lamp is the nearer');
  assert.equal(nearestRank([0, 1], lights, eye, 1, new Float64Array([-1, 2.5, 0, 0]), 1), 1, 'the west one held: it stays the nearer');
  assert.equal(CASTER_KEEP_RATIO, 0.8);
});

test('AUDIT FLICKER P3: A FLOATING-ORIGIN CROSSING KEEPS THE LAMPS - the kept copies (a Float32 slot, a Float64 hold) and the host\'s moved lights are sums in two precisions, and an exact match lost them all on the crossing frame: DISC6\'s hold let go (a lamp held against a nearer one swapped out of the eight, and lit through its wall for good) and every slot read as changed; now the kept places move with the shift and match within SHADOW_STILL_EPS (mutants: exact matching again, in the hold, the sticky slots and the change test; the kept places left behind)', () => {
  assert.ok(samePlace([1, 2, 3], 0, [1 + SHADOW_STILL_EPS * 0.9, 2, 3 - SHADOW_STILL_EPS * 0.9], 0), 'within the epsilon: the same place');
  assert.ok(!samePlace([1, 2, 3], 0, [1, 2 + SHADOW_STILL_EPS * 1.1, 3], 0), 'past it: another');
  // a street 800 units from the origin, where a Float32 sum drops the offset's low bits; the eye at (0, 1.6, 4) off it
  const at = [800.3, 0, -611.7], d = [-819.2, 0, 614.4];
  const lamps = [];
  for (const [x, z] of [[-1.3, 3.2], [1.1, 3.6], [0.7, 1.9], [-2.1, 2.2], [2.9, 3.1], [-0.4, 6.3], [3.3, 5.1]]) lamps.push(at[0] + x, 2.5, at[2] + z, 12);
  for (const [x, z] of [[-1.0, 4.8], [1.8, 4.6], [-2.6, 3.9], [2.0, 2.4]]) lamps.push(at[0] + x, 2.5, at[2] + z, 12);   // FLICKER-FIX: lamps 7-10, so the edge is the twelfth
  lamps.push(at[0] - 4.9, 2.5, at[2] + 4.1, 12);   // lamp 11: the twelfth, 4.9 m from the eye
  lamps.push(at[0] + 7.3, 2.5, at[2] + 4.1, 12);   // lamp 12: 7.3 m, out of the twelve
  const h = hall(lamps, at);
  for (let f = 0; f < 3; f++) h.frame();
  const casting = () => [...h.sp.shadowIndex].filter((i) => i >= 0).sort((a, b) => a - b).join(',');
  assert.equal(casting(), '0,1,2,3,4,5,6,7,8,9,10,11', 'the twelve nearest');
  // lamp 12 is carried nearer - 4.5 m, within the keep ratio of the held 4.9: DISC6 keeps lamp 11
  h.setLamp(12, [at[0] + 4.5, 2.5, at[2] + 4.1]);
  for (let f = 0; f < 3; f++) h.frame();
  assert.equal(casting(), '0,1,2,3,4,5,6,7,8,9,10,11', 'held: lamp 11 keeps its place');
  const slots = [...h.sp.shadowIndex];
  h.shift(d);
  h.frame();
  assert.equal(casting(), '0,1,2,3,4,5,6,7,8,9,10,11', 'the crossing: still held');
  assert.deepEqual([...h.sp.shadowIndex], slots, 'every lamp in its own slot');
  // and no slot read as changed: the crossing frame draws what the same frame draws uncrossed (the cache off - SC1's
  // static layers rebuild at a crossing whatever this does, their signature is the meshes' places)
  // six lamps: the eye's nearest two and the card's two are redrawn every frame, and two only at the cadence
  const a = hall(lamps.slice(0, 24), at), b = hall(lamps.slice(0, 24), at);
  a.sp.cacheOn = false; b.sp.cacheOn = false;
  for (let f = 0; f < 4; f++) { a.frame(); b.frame(); }
  // the eye walks to the far side of the room: the lamps' ranks turn over, and each keeps the slot it had (SC1's sticky
  // slots) - so a match lost at the crossing would hand the slots out again by rank, not as they stand
  for (const h2 of [a, b]) h2.setEye([-2.5, 1.6, 7]);
  for (let f = 0; f < 3; f++) { a.frame(); b.frame(); }
  let differs = 0;
  for (let f = 0; f < 3; f++) {   // three crossings, one on each of the cadence's frames
    a.shift(f % 2 ? d.map((x) => -x) : d);   // there and back: a real crossing each time
    const sa = a.frame(), sb = b.frame();
    if (sa.facesDrawn !== sb.facesDrawn) differs++;
    assert.deepEqual([...a.sp.shadowIndex], [...b.sp.shadowIndex], `crossing ${f}: the slots as they stood`);
  }
  assert.equal(differs, 0, 'the crossings drew no face the cadence did not');
});

// ── R1-R4: the records ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT FLICKER R2-R4: the recentre moves the flats the next replay reads, the four flat lists keep their shadows off screen, and a door crossed either way discards the replay (source pins; R1 is invislook\'s)', () => {
  const w = rd('src/scenes/world.js');
  const i = w.indexOf('// AUDIT FLICKER R2:');
  assert.ok(i > 0 && i < w.indexOf('renderer.shadowOriginShift?.(r.offset);') + 400, 'R2 sits with the renderer\'s shift');
  const r2 = w.slice(i, i + 1600);
  assert.match(r2, /if \(p\._t\) state\.pixelTranslation\(p\.px, p\.py, p\._t\);/, 'the pixel-placed flats: their translation re-made');
  for (const list of ['peerRiders', 'peerWalkers', 'bandSprites', 'yards']) {
    assert.match(w, new RegExp(`if \\(${list}\\) for \\(const b of ${list}\\.batches\\(\\)\\) \\{ if \\(cullOn && billboardOutside\\(b\\)\\) \\{ if \\(renderer\\.shadowReachBatch\\(b\\)\\) castBatches\\.push\\(b\\); continue; \\} allBatches\\.push\\(b\\); \\}`), `R3: ${list} casts off screen`);
  }
  assert.match(rd('src/render/renderer.js'), /const cut = this\._everyLightNow !== this\._everyLightPrev;[^\n]*\n\s*if \(cut\) sp\.discard\(\);/, 'R4: either way');   // PIN MOVED (EMPTY-HOLD, 2026-10-06): the door's edge is named once - the replay's discard and the pass's hold (a cut is never held) read the same one
});
