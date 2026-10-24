// FIELD BUGS 2026-10-13e AOE-PERF, THE PART ITS PROBE DID NOT TIME - THE COURT'S SHADOW PASS, COUNTED; and LIGHT-ID's
// before and after (2026-10-14, Mac: "Engine fix (Recommended)" - bible/07-Rendering/Enhanced-Lighting-Arc.md LIGHT-ID).
//
// HellRay's "massive FPS drops when the boss performs AoE attacks ... especially when more than 10 players are gathered"
// was measured by tools/fb1013ePerfProbe.mjs, which times the telegraph pass and the crowd's draws AFTER beginFrame. The
// shadow maps are drawn INSIDE beginFrame (renderer.js _renderPasses, render/shadowPass.js), from the last frame's records
// under this frame's lights, so what the boss's own lights and the crowd cost there never entered its numbers. This
// counts it: the real Renderer and ShadowPass on a counting GL (counts, not milliseconds - no load moves them), the
// Burning Court's own mesh as its static caster (world/gate/gateArena.js buildCourtModel, through renderer.createMesh), the
// court's own light composition (world/gate/gateArena.js withCourtLights over courtLightsNear - the dungeon arm's, worldModes.js
// `const _court = withCourtLights`), under everyLightCasts as that arm asks, Steady shadows (the default). His glow at his
// chest (world/gate/gateBoss.js GLOW_RANGE) in ONE kept record as the court keeps it (scenes/gate/gateCourt.js `_glow`), a
// Hellfire's landing flashes (render/gate/gateFx.js FX_KINDS.hellfire.light, for FX_LIGHT_MS) each its burst's record, and the
// crowd's Morrowind bodies recorded as renderer.recordShadowBody records them, a new pose every frame (WB9h's budget
// poses four of eight a frame, so the bodies in a light's reach change every frame either way), of BODY_CORNERS corners
// (the committed horse's, the AOE-PERF crowd's stand-in).
//
// Two arms: `before` - the pass with LIGHT-ID's two laws off (render/shadowPass.js SHADOW_TUNING `moverDirect` and
// `loUnread` false, the pins' oracles: a light that moved through its static cache, and a lo map for every light that may
// cast) - and `now`. test/render/lightid.test.js pins the counts (`courtShadowCounts`).
//
// Usage: node tools/courtShadowProbe.mjs [bodies=8]
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_TUNING } from '../src/render/shadowPass.js';
import { courtLightsNear, withCourtLights, courtToDungeon, buildCourtModel } from '../src/world/gate/gateArena.js';
import { GLOW_RANGE, LANDING_LIGHT_Y } from '../src/world/gate/gateBoss.js';
import { FX_KINDS, FX_LIGHT_MS } from '../src/render/gate/gateFx.js';
import { lookAt, perspective, mirrorProjectionX } from '../src/world/mat4.js';
import { isMain } from './lib/isMain.mjs';

export const BODY_CORNERS = 5934;
const FPS = 60;

/** A recording GL: every call a no-op, the vertex array bound and the corners each draw sends counted by array. */
function countingGl() {
  let ids = 0, bound = null;
  const corners = new Map();
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (k === 'bindVertexArray') return (v) => { bound = v; };
      if (k === 'drawArrays') return (_m, _first, n) => { const id = bound?.id; corners.set(id, (corners.get(id) ?? 0) + n); };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { canvas: { getContext: () => gl, clientWidth: 960, clientHeight: 540, width: 960, height: 540 }, corners };
}

/** The flashes' marks, about the fighters round him (the court's frame), and how many frames a flash stands. */
export const FLASH_MARKS = Object.freeze([[3, 4], [-4, 3], [5, -2], [-2, -5], [1, 6]]);
export const LANDING_FRAMES = Math.round((FX_LIGHT_MS / 1000) * FPS);
/** A case's frames: a landing's lit frames and the two after. */
export const CASE_FRAMES = LANDING_FRAMES + 2;
/** The cases, frame `k` from 0: where he stands, his glow's reach, the flashes standing, whether the crowd is posed. */
export const COURT_CASES = Object.freeze({
  still: () => ({ boss: [0, 0], glow: GLOW_RANGE.ember, flashes: false, posed: false }),
  posed: () => ({ boss: [0, 0], glow: GLOW_RANGE.ember, flashes: false, posed: true }),
  walks: (k) => ({ boss: [Math.cos(k / 40) * 4, Math.sin(k / 40) * 4], glow: GLOW_RANGE.ember, flashes: false, posed: true }),
  hellfire: (k) => ({ boss: [0, 0], glow: GLOW_RANGE.ember, flashes: k >= 0 && k < LANDING_FRAMES, posed: true }),
});
export const CASE_NAMES = Object.freeze({ still: 'a still court, the crowd still', posed: 'the crowd posed, he stands', walks: 'he walks among them', hellfire: `a Hellfire lands on five (${LANDING_FRAMES} frames lit)` });

/**
 * The shadow pass's work a frame for court case `name` under `arm` ('before' | 'now'), `bodies` about him: the frames'
 * rows ({ faces, stat, dyn, mover, lo, blits, draws, bodyCorners }) after four frames to settle on the case's first.
 */
export function courtShadowCounts(name, arm = 'now', { bodies: nBodies = 8, frames = CASE_FRAMES } = {}) {
  const was = { moverDirect: SHADOW_TUNING.moverDirect, loUnread: SHADOW_TUNING.loUnread };
  SHADOW_TUNING.moverDirect = arm !== 'before'; SHADOW_TUNING.loUnread = arm !== 'before';
  try {
    const scenario = COURT_CASES[name];
    const { canvas, corners } = countingGl();
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE);
    const sp = r.shadows;
    r.setLighting(new Float32Array([0.18, 0.1, 0.08]), 0);
    const court = r.createMesh(buildCourtModel());   // the court's own mesh - its bounds and its sub-meshes' - on the counting GL
    for (const sm of court.subMeshes) r.textures.set(`${sm.textureArchive}_${sm.textureRecord}`, { id: `court-${sm.textureRecord}` });
    // a fighter's eye, eight metres south of him (fb1013ePerfProbe's third-person camera)
    const eye = courtToDungeon(0, 2.6, 11.5);
    const view = lookAt(eye, courtToDungeon(0, 1.6, 0), [0, 1, 0]);
    const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, 16 / 9, 0.05, 500));
    const bodies = Array.from({ length: nBodies }, (_, i) => ({ vao: { id: `body${i}` }, count: BODY_CORNERS, ranges: [{ first: 0, count: BODY_CORNERS }], _poseGen: 0 }));
    const model = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // his glow, one kept record (scenes/gate/gateCourt.js `_glow`); each flash its burst's (`b.light`)
    const glow = { x: 0, y: 0, z: 0, range: 0, color: [1.2, 0.5, 0.15] };
    const flashes = FLASH_MARKS.map(([x, z]) => { const p = courtToDungeon(x, LANDING_LIGHT_Y, z); return { x: p[0], y: p[1], z: p[2], range: FX_KINDS.hellfire.light[1], color: [1.2, 0.6, 0.2] }; });
    const rows = [];
    for (let k = 0; k < 4 + frames; k++) {
      const s = scenario(k - 4);
      const g = courtToDungeon(s.boss[0], 3.5, s.boss[1]);
      glow.x = g[0]; glow.y = g[1]; glow.z = g[2]; glow.range = s.glow;
      const lit = withCourtLights({ data: new Float32Array(0), colors: new Float32Array(0) }, [glow, ...(s.flashes ? flashes : []), ...courtLightsNear(eye)]);
      r.setPointLights(lit.data, null, lit.colors);
      r.everyLightCasts();
      corners.clear();
      r.beginFrame(proj, view, new Float32Array([0.2, -0.9, 0.3]), WORLD_FRAME);
      const st = sp.stats;
      let bodyCorners = 0;
      for (const [id, n] of corners) if (typeof id === 'string' && id.startsWith('body')) bodyCorners += n;
      if (k >= 4) rows.push({ faces: st.facesDrawn, stat: st.staticFaces, dyn: st.dynFaces, mover: st.moverFaces, lo: st.loFaces, blits: st.blits, draws: st.pointDraws, bodyCorners });
      r.drawMesh(court, model, null);
      bodies.forEach((b, i) => {
        if (s.posed) b._poseGen++;
        const a = (i / Math.max(1, nBodies)) * Math.PI * 2, d = 3 + (i % 3);
        const at = courtToDungeon(Math.cos(a) * d, 0, Math.sin(a) * d);
        const m = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, at[0], at[1], at[2], 1]);
        r.recordShadowBody(b, m, [at[0], at[1] + 0.9, at[2], 1.1]);
      });
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 1, h: 1 });
    }
    return rows;
  } finally {
    SHADOW_TUNING.moverDirect = was.moverDirect; SHADOW_TUNING.loUnread = was.loUnread;
  }
}

/** A case's rows, as a frame's mean and its worst of `key`. */
export const meanOf = (rows, key) => rows.reduce((a, x) => a + x[key], 0) / rows.length;
export const worstOf = (rows, key) => Math.max(...rows.map((x) => x[key]));

if (isMain(import.meta.url)) {
  const bodies = Number(process.argv[2] ?? 8);
  console.log(`THE COURT'S SHADOW PASS - ${bodies} Morrowind bodies about him (${BODY_CORNERS} corners each), a fighter's eye, Steady shadows, ${CASE_FRAMES} frames a case - a landing's lit frames and the two after (per frame: mean, worst)\n`);
  console.log('case                                     arm      cube faces (static/dyn/moved)       lo faces     blits     depth draws   body corners');
  const f = (x) => x.toFixed(1).padStart(6);
  for (const name of Object.keys(COURT_CASES)) {
    for (const arm of ['before', 'now']) {
      const o = courtShadowCounts(name, arm, { bodies });
      console.log(`${CASE_NAMES[name].padEnd(40)} ${arm.padEnd(8)} ${f(meanOf(o, 'faces'))} (${f(meanOf(o, 'stat'))}/${f(meanOf(o, 'dyn'))}/${f(meanOf(o, 'mover'))}) ${String(worstOf(o, 'faces')).padStart(4)}  ${f(meanOf(o, 'lo'))} ${String(worstOf(o, 'lo')).padStart(4)}  ${f(meanOf(o, 'blits'))} ${String(worstOf(o, 'blits')).padStart(4)}  ${f(meanOf(o, 'draws'))} ${String(worstOf(o, 'draws')).padStart(4)}  ${(meanOf(o, 'bodyCorners') / 1e6).toFixed(2).padStart(6)}M ${(worstOf(o, 'bodyCorners') / 1e6).toFixed(2).padStart(5)}M`);
    }
  }
}
