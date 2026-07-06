// Engine-side rig (engine-world integration, slice 2): the SAME
// neutral body + the SAME canonical animation runtime (animate.js)
// driving the renderer's character path (createCharacterMesh /
// updateCharacterMesh / drawCharacter). One animation implementation
// across viewer and engine - interiorContext's inline loco copy
// predates animate.js and migrates onto this module in a later slice.
//
// The packed stream is interleaved 9 floats/vertex (pos, normal,
// color); animateTarget writes T.pos and update() splices the moved
// positions back over the cached normals/colors before the GPU
// re-upload. Ramps derive from the classic palette exactly as the
// paperdoll does (skin from the mid torso of BODY00I0, boots from
// the feet), so the engine character matches the game palette.
import { buildNeutralBody, WRIST_JUNCTION_Y, ARM_X, NECK_PIVOT_Y } from './neutralBody.js';
import { createAnimContext, animateTarget, WALK, RUN, POSE_L } from './animate.js';
import { packCharacterFaces } from '../render/characterMesh.js';

const CLASSIC_HEIGHT = 1.8;
const GAITS = [null, WALK, RUN];

/** Classic-palette ramps for the neutral body (single source; the
 *  interior copy migrates here). */
export function deriveClassicRamps(palette, bodyBmp) {
  const W = bodyBmp.width;
  const lumOf = (i) => { const c = palette.get(i); return 0.299*c.r + 0.587*c.g + 0.114*c.b; };
  const rampOf = (r0, r1, keep) => {
    const m = new Map();
    for (let y = r0; y <= r1; y++) for (let x = 0; x < W; x++) {
      const i = bodyBmp.data[y*W + x];
      if (i && (!keep || keep(x, y))) m.set(i, lumOf(i));
    }
    return [...m.entries()].sort((a, b) => a[1] - b[1]).map((e) => { const c = palette.get(e[0]); return [c.r, c.g, c.b]; });
  };
  return { skin: rampOf(40, 60, (x) => Math.abs(x - ((W-1)/2)) < 14), boot: rampOf(132, 144) };
}

export function createEngineRig(renderer, ramps) {
  const faces = buildNeutralBody(ramps);
  const packed = packCharacterFaces(faces.map((f) => ({ p: f.p, n: f.n, c: f.c })));
  const mesh = renderer.createCharacterMesh(packed);
  const count = packed.length / 9;
  // per-PACKED-vertex base/vgrp (fan triangulation: 3 verts per tri,
  // np-2 tris per face) - same walk packCharacterFaces performs
  const GI = { body: 0, head: 1, armL: 2, armR: 3, legL: 4, legR: 5 };
  const base = new Float32Array(count * 3);
  const vgrp = new Uint8Array(count);
  {
    let v = 0;
    for (const f of faces) {
      const g = GI[f.g] ?? 0;
      const np = f.p.length / 3;
      for (let i = 1; i < np - 1; i++) {
        for (const k of [0, i, i + 1]) {
          base[v*3] = f.p[k*3]; base[v*3+1] = f.p[k*3+1]; base[v*3+2] = f.p[k*3+2];
          vgrp[v] = g; v++;
        }
      }
    }
  }
  const T = { pos: base.slice(), base, vgrp, held: false, dirty: false };
  const ctx = createAnimContext({
    basePos: base, vgrp,
    armX: ARM_X,
    wristY: WRIST_JUNCTION_Y * 0.9,   // post-HSCALE, exactly the viewer payload's values
    neckY: NECK_PIVOT_Y * 0.9,
  });
  // world placement: classic height, feet on the local origin
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < base.length; i += 3) { if (base[i] < minY) minY = base[i]; if (base[i] > maxY) maxY = base[i]; }
  const scale = CLASSIC_HEIGHT / (maxY - minY);
  const anim = packed.slice();
  let wt = 0, gait = 0, pose = null;

  return {
    mesh, T, ctx, scale, footY: minY, liveFootY: minY,
    setGait(g) { gait = g | 0; },
    setPose(p) { pose = p || null; },
    /** Advance the canonical runtime and re-upload moved vertices. */
    update(dt) {
      const L = GAITS[gait];
      if (L) {
        wt += dt * L.cadence;
        animateTarget(ctx, T, wt, L, L.bobAmp * Math.sin(wt * 2), pose, true);
      } else {
        animateTarget(ctx, T, 0, POSE_L, 0, pose, false);
      }
      let lo = Infinity;
      for (let v = 0; v < count; v++) { anim[v*9] = T.pos[v*3]; const y = T.pos[v*3+1]; anim[v*9+1] = y; anim[v*9+2] = T.pos[v*3+2]; if (y < lo) lo = y; }
      this.liveFootY = lo;   // the LIVE support point: grounding an animated character means the current lowest vertex kisses the floor (the stride arc dips below rest minY)
      renderer.updateCharacterMesh(mesh, anim);
      T.dirty = false;
    },
  };
}
