// MW-D8: THE MORROWIND FIRST-PERSON ARM, IN THE GAME.
//
// Seven stages of this arc shipped diagnostics and nothing touched the
// game. This is the wire. It owns no rules: every rule it applies is
// already ported and pinned in src/formats/mwFirstPerson.js and
// src/formats/mwAnim.js, and this file IMPORTS them rather than
// restating them. That is deliberate - MW7 failed by carrying a second
// port of one rule, and two copies of a rule drift.
//
// WHAT IT DRAWS. An UNTEXTURED, flat-shaded, weaponless pair of arms
// playing the Idle clip. Not a texture failure - a scope boundary, and
// the card says so before you press the button. See the STATUS block in
// bible/02-Formats/Morrowind-Rules.md for the full deferred list.
//
// HOW IT DRAWS, and why this needs no renderer change at all: the port
// has ALREADY shipped a first-person pass. renderCharacterSprite
// (render/renderer.js:751) binds an offscreen target with its OWN depth
// renderbuffer, clears colour AND depth, swaps the frame's proj/view for
// ones the caller supplies, draws, and restores; drawScreenOverlayQuad
// (:987) composites it fullscreen with an alpha cut and no depth test.
// Two recorded rules fall out of that technique for free:
//
//   rule 29 - the first-person subtree renders with its OWN field of
//     view (60 degrees by default). We hand renderCharacterSprite its
//     own perspective, which is what the proj/view swap is for.
//   rule 52 - first person gets a bin whose draw CLEARS DEPTH first, so
//     the arms are never clipped by the world. Here that is structural
//     rather than emulated: no world geometry is ever drawn into that
//     framebuffer, so there is nothing to be clipped by.
//
// The framing constants below are the pre-existing viewmodel pass's own,
// probe-locked in an earlier audit (render/characterSprite.js:74-86) -
// including the two laws Mac's "stuck in a hole" report bought: this
// camera looks LEVEL (pitch is an animation channel, never a camera
// tilt), and the body sits BEHIND the lens or you render the inside of
// your own torso.

import { lookAt, perspective, trs } from '../world/mat4.js';
import { CHAR_PIXEL, CHAR_SPRITE_RT_SIZE } from '../render/renderer.js';
import { sampleTrack, resetClip, advanceClip } from '../formats/mwAnim.js';
import { accumRootRef } from '../formats/mwSkin.js';
import {
  assembleFirstPersonArm, poseAssembly, armPieceRows, clipReport, clipUnionBounds,
  armReport, armMeshPaths, bodyParts,
} from '../formats/mwFirstPerson.js';

/** Rule 6's table, as a decision rather than a list. Werewolf is out of
 *  scope (it ships with Bloodmoon and Part VI records it ABSENT from a
 *  vanilla archive), and Daggerfall has no beast race at all - the beast
 *  arm is here because the rule has one, not because a Daggerfall player
 *  can reach it. A skeleton this archive lacks is REPORTED, never
 *  silently swapped: a silent fallback here is how an empty view got
 *  called a working one for four releases. */
export function fpSkeletonPath({ female = false, beast = false } = {}) {
  if (beast) return 'meshes/base_animkna.1st.nif';
  if (female) return 'meshes/base_anim_female.1st.nif';
  return 'meshes/xbase_anim.1st.nif';
}
/** Rule 6 again: the first-person animation source sits beside it. */
export const FP_CLIP_PATH = 'meshes/xbase_anim.1st.kf';
export const FP_CLIP_GROUP = 'Idle';

/**
 * THE PORT MAPPER, and it is a PORT DECISION, not a claim of parity.
 *
 * Rule 54 says the first-person camera is a NODE OF THE RIG - it tracks
 * a bone named "Camera", falling back to "Head", with no height offset.
 * That is the authentic answer and this slice does not implement it,
 * because the actor-scale rules it would need are tier C (extracted,
 * never verified) and the doc's own warning is that a tier C rule must
 * be verified before code depends on it.
 *
 * So instead: solve a uniform scale ONCE, from the arm's own bounds over
 * the WHOLE clip, so the arm subtends a fixed span whatever unit scale
 * the file happens to use. It lands plausibly on any data. It is not yet
 * authentically right, the card says so, and the build REPORTS whether
 * the skeleton carries a Camera/Head bone - so the next slice starts
 * from a measurement instead of a guess.
 *
 * ONCE is the load-bearing word. Recomputed per frame from the live
 * bounds, the framing renormalises every time the arm moves and cancels
 * out exactly the motion it exists to show - the trap recorded at
 * mwFirstPerson.js's clipUnionBounds and the runaway at
 * render/mwViewer.js:430-436.
 */
export const ARM_TARGET_SPAN = 0.75;   // metres the arm's longest axis fills
export const ARM_FORWARD = 0.62;       // metres in FRONT of the eye - see below
export const ARM_DROP = -0.28;         // and below it, so the arms hang in the lower frame
export const ARM_CAST = -0.20;         // fixed downward look toward the hands, NOT world pitch

/**
 * AND HERE IS WHERE THIS DIFFERS FROM THE VOXEL VIEWMODEL IT BORROWS
 * FROM, which is a difference the probe found by drawing rather than one
 * anybody reasoned out first.
 *
 * render/characterSprite.js pushes its rig BACKWARD from the eye
 * (`feet - fwd * 0.25`) and says why: that rig is the player's whole
 * BODY, the camera rides its head, and without the push you render the
 * inside of your own torso - Mac's "stuck in a hole". Only the raised
 * forearm reaches forward into frame.
 *
 * THIS assembly is arms ONLY. There is no head and no torso to hide, so
 * the same push puts every triangle behind the lens and the pass draws
 * NOTHING - measured, tools/mwArmProbe.mjs, 0 lit texels with a build
 * that otherwise reported four pieces bound and five tracks matched.
 * That is this arc's signature failure wearing yet another face, and it
 * is only visible to a probe that reads the target back.
 *
 * So the arms go IN FRONT of the eye and BELOW the view axis, and the
 * two constants are what put them there.
 */
export function armModelPoint(framing, eye, yaw) {
  const sinY = Math.sin(yaw); const cosY = Math.cos(yaw);
  const f = framing;
  // Where the arm's own CENTRE should land, in world space.
  const tx = eye[0] + sinY * ARM_FORWARD;
  const ty = eye[1] + ARM_DROP;
  const tz = eye[2] + cosY * ARM_FORWARD;
  // Back out the translation that puts the scaled centre on that point -
  // and the centre must be ROTATED first, because the model matrix spins
  // the mesh about its own origin, not about its centre. Subtracting the
  // unrotated offset leaves the arm swinging around the player as he
  // turns: measured, tools/mwArmProbe.mjs, 60 lit texels facing one way
  // and 20 facing another with the pose held still. Yaw-dependence in a
  // first-person arm is not a thing a still screenshot can show you.
  const cx = f.centre[0] * f.scale;
  const cy = f.centre[1] * f.scale;
  const cz = f.centre[2] * f.scale;
  // R_y from mat4.trs with rx = rz = 0: [c*x + s*z, y, -s*x + c*z].
  return [
    tx - (cosY * cx + sinY * cz),
    ty - cy,
    tz - (-sinY * cx + cosY * cz),
  ];
}

export function armFraming(unionBounds) {
  if (!unionBounds) return null;
  const span = Math.max(
    unionBounds.maxX - unionBounds.minX,
    unionBounds.maxY - unionBounds.minY,
    unionBounds.maxZ - unionBounds.minZ,
  );
  const scale = span > 1e-6 ? ARM_TARGET_SPAN / span : 1;
  return {
    scale,
    span,
    // Centre the arm on its own bounds so the solve does not depend on
    // where the authoring origin happens to sit.
    centre: [
      (unionBounds.minX + unionBounds.maxX) / 2,
      (unionBounds.minY + unionBounds.maxY) / 2,
      (unionBounds.minZ + unionBounds.maxZ) / 2,
    ],
  };
}

/**
 * PACK THE ASSEMBLY for drawCharacter's vertex stream: 9 floats per
 * vertex, [pos.xyz, colour.rgb, normal.xyz], NON-INDEXED, because
 * drawCharacter issues drawArrays (renderer.js:702). The MW readers hand
 * back indexed triangles, so the indices are expanded here.
 *
 * NORMALS ARE COMPUTED, not read. poseAssembly skins positions with a
 * null normals-out (mwFirstPerson.js's skinBatch call), so there are no
 * normals to carry. One cross product per triangle gives flat shading,
 * which is what makes an untextured arm's form readable at all.
 *
 * AND RULE 13'S RENDERING CONSEQUENCE, which MW8 also lacked: a mirrored
 * piece has its X negated, which REVERSES its triangle winding, so its
 * computed face normal points inward. Negate it back. Without this the
 * left arm is lit inside-out - dark where the right arm is bright - and
 * that is a lighting bug that reads as "the mesh is wrong" rather than
 * as "the mirror is wrong". drawCharacter disables back-face culling
 * (renderer.js:700), so the winding costs nothing else.
 */
export function packFpArm(pieces, out = null) {
  let tris = 0;
  for (const p of pieces) tris += (p.indices ? p.indices.length : 0) / 3;
  const buf = out && out.length === tris * 3 * 9 ? out : new Float32Array(tris * 3 * 9);
  let o = 0;
  for (const p of pieces) {
    const pos = p.positions;
    const idx = p.indices;
    if (!pos || !idx) continue;
    const flip = p.mirrored ? -1 : 1;
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a]; const uy = pos[b + 1] - pos[a + 1]; const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a]; const vy = pos[c + 1] - pos[a + 1]; const vz = pos[c + 2] - pos[a + 2];
      let nx = (uy * vz - uz * vy) * flip;
      let ny = (uz * vx - ux * vz) * flip;
      let nz = (ux * vy - uy * vx) * flip;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-8) { nx /= len; ny /= len; nz /= len; } else { nx = 0; ny = 1; nz = 0; }
      for (const v of [a, b, c]) {
        buf[o++] = pos[v]; buf[o++] = pos[v + 1]; buf[o++] = pos[v + 2];
        buf[o++] = 0.78; buf[o++] = 0.66; buf[o++] = 0.55;   // untextured skin tone; rules 36/61 deferred
        buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
      }
    }
  }
  return buf;
}

/**
 * BUILD. Async, expensive, explicitly triggered, and NEVER in a frame.
 *
 * Returns a status object and never throws: every failure is a named
 * stage and a message the card prints, because "an empty box" was the
 * reverted rig's defining behaviour and the one outcome forbidden here.
 *
 * `archives` and the raw esm bytes are dropped before returning.
 * MwBsaFile.get hands back a zero-copy subarray of the whole archive
 * (mwBsaFile.js), so keeping one 40 KB hand mesh would pin a ~300 MB
 * Morrowind.bsa for the life of the tab. Copy what we need, release the
 * rest.
 */
export async function buildFpArm({ race, female = false, beast = false, deps = null } = {}) {
  const d = deps || await import('../scenes/dataSource.js');
  const skeletonPath = fpSkeletonPath({ female, beast });
  try {
    const archives = await d.loadMorrowindArchives();
    if (!archives.length) return { ok: false, stage: 'data', error: 'no Morrowind .bsa attached' };

    const esmName = (await d.storedMorrowindNames()).find((n) => /\.esm$/i.test(n));
    if (!esmName) return { ok: false, stage: 'data', error: 'no Morrowind .esm attached - the body records live there, not in the .bsa' };
    // bodyParts(), not loadMorrowindEsm(). The store's parseEsm door
    // returns mwEsmFile's body shape; armReport wants bodyParts' shape;
    // there is no adapter and writing one by guess inside this slice is
    // exactly how MW7 died. Raw bytes through the pinned path instead.
    const parts = bodyParts(await d.loadMorrowindFile(esmName));

    const find = (p) => archives.find((a) => a.has(p));
    const skelArc = find(skeletonPath);
    if (!skelArc) return { ok: false, stage: 'skeleton', error: `${skeletonPath} is not in your archives` };
    const skeletonBytes = skelArc.get(skeletonPath).slice();

    const rows = armReport(parts, race, female);
    const wanted = armMeshPaths(rows);
    const partBytes = [];
    const missing = [];
    for (const w of wanted) {
      if (!w.path) { missing.push(`${w.slot}: no record for this actor`); continue; }
      const arc = find(w.path);
      if (!arc) { missing.push(`${w.slot}: ${w.path} is not in your archives`); continue; }
      partBytes.push({ slot: w.slot, bytes: arc.get(w.path).slice() });
    }
    const clipArc = find(FP_CLIP_PATH);
    const kfBytes = clipArc ? clipArc.get(FP_CLIP_PATH).slice() : null;
    archives.length = 0;   // release the mapped archives before any parsing

    if (!partBytes.length) {
      return { ok: false, stage: 'parts', error: 'no arm mesh resolved', notes: missing, rows: wanted };
    }
    const arm = await assembleFirstPersonArm({ skeletonBytes, parts: partBytes });
    if (!arm.ok) {
      return { ok: false, stage: arm.stage || 'assembly', error: arm.error, notes: [...missing, ...(arm.notes || [])], rows: wanted };
    }
    const clip = await clipReport({ kfBytes, skeleton: arm.skeleton, group: FP_CLIP_GROUP });
    if (!clip.ok || !clip.clip.ok) {
      return {
        ok: false,
        stage: 'clip',
        error: clip.ok ? clip.clip.reason : clip.error,
        notes: [...missing, ...(arm.notes || [])],
        rows: wanted,
      };
    }
    const tracks = clip.trackMap;
    const accumRoot = accumRootRef(arm.skeleton, tracks);
    const poseAt = (t) => poseAssembly(arm, { tracks, sampleTrack, time: t, accumRoot });
    const c = clip.clip;
    const times = Array.from({ length: 25 }, (_, i) => c.startTime + ((c.stopTime - c.startTime) * i) / 24);
    const framing = armFraming(clipUnionBounds(arm, poseAt, times));
    poseAt(c.startTime);

    return {
      ok: true,
      arm,
      tracks,
      accumRoot,
      keys: clip.keys,
      clip: c,
      framing,
      skeletonPath,
      // MW-D4's PATTERN, applied forward: report the bone the NEXT slice
      // needs rather than guessing it. Rule 54 says the first-person
      // camera tracks a node named "Camera", falling back to "Head". This
      // slice does not implement that - it uses the port mapper above -
      // but it says whether the data would support it, so MW-D9 starts
      // from a measurement. A missing bone is REPORTED, never worked
      // around.
      cameraBone: arm.skeleton.byName.has('camera') ? 'Camera'
        : arm.skeleton.byName.has('head') ? 'Head (rule 54 fallback)' : null,
      rows: wanted,
      notes: [...missing, ...(arm.notes || [])],
      binding: clip.binding,
      pieces: armPieceRows(arm.pieces).length,
    };
  } catch (err) {
    return { ok: false, stage: 'build', error: err && err.message ? err.message : String(err) };
  }
}

/**
 * THE LIVE ARM. One per game, module-level, because there is one player.
 *
 * active() is the whole safety story and every term earns its place: an
 * unbuilt arm, a missing GPU mesh, a host that forgot the camera dep, or
 * a clip that refused all answer FALSE, and weaponRig's branch then
 * falls straight through to the classic sprite. MWFIX2's failure was an
 * active() that stayed true when the group lookup returned null, so the
 * player got a frozen bind-pose arm where the sprite had been correct. A
 * frozen arm is not a reachable state here; the sprite is.
 */
export function createFpArm() {
  let renderer = null;
  let camera = null;
  let built = null;
  let mesh = null;
  let packed = null;
  let state = null;
  let reason = 'not built';
  let frames = 0;
  let busy = false;

  const active = () => !!(built && built.ok && mesh && renderer && camera && state);

  function releaseMesh() {
    if (mesh && renderer && renderer.gl) {
      const gl = renderer.gl;
      gl.deleteVertexArray(mesh.vao);
      for (const b of mesh.buffers || []) gl.deleteBuffer(b);
    }
    mesh = null;
  }

  return {
    attach(r, cam) { renderer = r || null; camera = cam || null; },
    active,
    get frames() { return frames; },

    async build(opts) {
      if (busy) return { ok: false, stage: 'build', error: 'already building' };
      busy = true;
      try {
        const res = await buildFpArm(opts);
        releaseMesh();
        built = res;
        packed = null;
        state = null;
        if (!res.ok) { reason = `${res.stage}: ${res.error}`; return res; }
        state = resetClip(res.keys, FP_CLIP_GROUP);
        if (!state.ok) {
          built = null; state = null;
          reason = `clip: ${state.reason}`;
          return { ok: false, stage: 'clip', error: state.reason };
        }
        reason = 'built';
        return res;
      } finally { busy = false; }
    },

    unload() { releaseMesh(); built = null; state = null; packed = null; reason = 'unloaded'; },

    /** PER FRAME. Synchronous, no allocation after the first pack, no
     *  await and no dynamic import - a promise per frame in a rAF body
     *  is a stutter you cannot profile out. */
    update(dt) {
      if (!built || !built.ok || !state || !renderer) return;
      advanceClip(state, built.keys, dt, null);
      poseAssembly(built.arm, {
        tracks: built.tracks, sampleTrack, time: state.time, accumRoot: built.accumRoot,
      });
      packed = packFpArm(built.arm.pieces, packed);
      if (!mesh) mesh = renderer.createCharacterMesh(packed);
      else renderer.updateCharacterMesh(mesh, packed);
      frames++;
    },

    draw(canvas) {
      if (!active() || !canvas) return false;
      const cam = camera();
      if (!cam || !cam.pos) return false;
      const wantW = canvas.clientWidth / CHAR_PIXEL;
      const wantH = canvas.clientHeight / CHAR_PIXEL;
      const s = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
      const pw = Math.max(2, Math.round(wantW * s));
      const ph = Math.max(2, Math.round(wantH * s));
      const yaw = cam.yaw || 0;
      const cosY = Math.cos(yaw); const sinY = Math.sin(yaw);
      const f = built.framing;
      const eye = [cam.pos[0], cam.pos[1], cam.pos[2]];
      const [rx, ry, rz] = armModelPoint(f, eye, yaw);
      const model = trs(rx, ry, rz, 0, yaw * 180 / Math.PI, 0, f.scale, f.scale, f.scale);
      // RULE 29: this pass gets its own 60-degree field of view. And the
      // camera looks LEVEL - the downward cast reaches the hands without
      // tilting the lens into the torso from beneath.
      const proj = perspective(Math.PI / 3, pw / ph, 0.05, 12);
      const fwd = [sinY, ARM_CAST, cosY];
      const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
      const tex = renderer.renderCharacterSprite(mesh, model, proj, view, pw, ph);
      renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
      return true;
    },

    status() {
      return {
        active: active(),
        reason: active() ? 'built' : reason,
        skeletonPath: built && built.skeletonPath,
        pieces: built && built.ok ? built.pieces : 0,
        rows: built && built.rows,
        notes: built && built.notes,
        binding: built && built.binding,
        cameraBone: built && built.ok ? built.cameraBone : null,
        framing: built && built.ok ? { scale: built.framing.scale, span: built.framing.span } : null,
        clip: built && built.ok ? { start: built.clip.startTime, stop: built.clip.stopTime } : null,
        time: state ? state.time : null,
        frames,
      };
    },

    /** Probe readbacks. Every one runs THIS module's own code - a probe
     *  with its own copy measures the copy. */
    rows: () => (built && built.ok ? armPieceRows(built.arm.pieces).map((r) => ({ ...r })) : null),
    trace({ dt = 0.2, steps = 40, loopCount = 2 } = {}) {
      if (!built || !built.ok) return null;
      const s2 = resetClip(built.keys, FP_CLIP_GROUP, { loopCount });
      const out = [];
      for (let i = 0; i < steps && s2.playing; i++) {
        advanceClip(s2, built.keys, dt, null);
        poseAssembly(built.arm, {
          tracks: built.tracks, sampleTrack, time: s2.time, accumRoot: built.accumRoot,
        });
        const rh = armPieceRows(built.arm.pieces).find((r) => r.bone === 'right hand');
        out.push({
          time: s2.time,
          playing: s2.playing,
          loopStartTime: s2.loopStartTime,
          loopStopTime: Number.isFinite(s2.loopStopTime) ? s2.loopStopTime : null,
          rightHandMaxX: rh && rh.bounds ? rh.bounds.maxX : null,
        });
      }
      return out;
    },
  };
}

export const fpArm = createFpArm();
