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
// MW-D10: the framing constants this pass USED to borrow from the voxel
// viewmodel (render/characterSprite.js:74-86) are gone with the mapper
// that needed them. Rule 54 places the camera inside the rig, so there
// is no distance to push, no drop to apply and no scale to solve - and
// the viewmodel's two hard-won laws do not transfer either: its camera
// looks level because ITS pitch is an animation channel, where this one
// takes the player's pitch through the neck the reference rotates.

import { lookAt, perspective, trs, mirrorProjectionX } from '../world/mat4.js';
import { CHAR_PIXEL, CHAR_SPRITE_RT_SIZE } from '../render/renderer.js';
import { sampleTrack, resetClip, advanceClip } from '../formats/mwAnim.js';
import { accumRootRef } from '../formats/mwSkin.js';
import {
  assembleFirstPersonArm, poseAssembly, armPieceRows, clipReport, clipUnionBounds,
  armReport, armMeshPaths, bodyParts,
  weaponRecords, dfWeaponToMw, pickWeaponRecord, weaponAttachBone, MW_WEAPON_TYPE,
  firstPersonCameraRef,
} from '../formats/mwFirstPerson.js';
import { WEAPONS } from '../characters/weapons.js';
import { correctTexturePath, wrapModes, warningImage } from '../formats/mwTexture.js';
import { decodeDds } from '../formats/mwDdsFile.js';

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
 * RULE 54, AND THE PORT MAPPER IS GONE.
 *
 * MW-D8 shipped an invented framing - fit the arm's clip bounds into a
 * fixed span, push it ARM_FORWARD metres ahead of the eye and ARM_DROP
 * below it, cast the lens down by a constant - and its own comment said
 * it was "a PORT DECISION, not a claim of parity" and that rule 54 was
 * the authentic answer. Mac's screenshot is what that decision looks
 * like on retail data: two forearms adrift at the horizon, detached,
 * wrong scale, wrong angle.
 *
 * The authentic law needs no framing at all, because the camera is
 * INSIDE THE RIG:
 *
 *   mTrackingNode = getNode("Camera") ?? getNode("Head")   camera.cpp:353
 *   position      = that node's world translation, and in first person
 *                   NO height term at all                  camera.cpp:96
 *   orientation   = the PLAYER's look                      camera.cpp:127
 *   the neck takes 0.75 of the pitch              npcanimation.cpp:719
 *   first person field of view = 60.0            settings-default.cfg
 *
 * Everything else follows. The arms sit where Morrowind authored them
 * relative to that node, at whatever scale the file uses, because the
 * camera and the arms are in the same rig. There is no metre to convert
 * into and no span to fit - which is why the invented version could
 * never have been made right by tuning its constants.
 *
 * AND THE BASIS CHANGE NOTHING IN THE CHAIN EVER MADE. A Morrowind NIF
 * is Z-UP with +Y forward; this renderer is Y-UP with -Z forward.
 * Neither the reader, the flattener, the assembly nor the pass converted
 * between them, so the rig was drawn lying on its side and pointing away
 * from the viewer - which is exactly the two end-on forearms in the
 * screenshot. The fit-to-span framing then scaled whatever bounds that
 * produced and landed it "plausibly", which is how a 90-degree error
 * survived three probes and a mutation campaign: every assertion was in
 * MODEL space, and model space cannot see the frame it is drawn in.
 */
export const NIF_TO_PASS = trs(0, 0, 0, -90, 0, 0);

/** files/settings-default.cfg: `first person field of view = 60.0`. */
export const FP_FIELD_OF_VIEW = Math.PI / 3;

/** MW-D11: nine floats became eleven - [pos.xyz, colour.rgb, normal.xyz,
 *  uv.xy]. Stated once, here, because the pack and the VAO have to agree
 *  and a second copy of the number is how they stop agreeing. */
export const FP_FLOATS = 11;

/** Rule 54's placement, in the pass's axes: the camera node's rig-space
 *  translation, with the Z-up basis turned into the renderer's Y-up. */
export function firstPersonEye(mats, cameraRef) {
  const node = mats && mats.get(cameraRef);
  if (!node) return null;
  const [x, y, z] = node.t;
  return [x, z, -y];
}

/** How far the arm reaches from the camera node, in RIG units - all the
 *  near and far planes need, measured off the data instead of assuming a
 *  unit scale the file need not use. */
export function armReach(eye, unionBounds) {
  if (!eye || !unionBounds) return 1;
  let far = 0;
  for (const x of [unionBounds.minX, unionBounds.maxX]) {
    for (const y of [unionBounds.minY, unionBounds.maxY]) {
      for (const z of [unionBounds.minZ, unionBounds.maxZ]) {
        const d = Math.hypot(x - eye[0], z - eye[1], -y - eye[2]);
        if (d > far) far = d;
      }
    }
  }
  return far || 1;
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
  const buf = out && out.packed && out.packed.length === tris * 3 * FP_FLOATS
    ? out.packed : new Float32Array(tris * 3 * FP_FLOATS);
  const ranges = [];
  let o = 0;
  let first = 0;
  for (const p of pieces) {
    const pos = p.positions;
    const idx = p.indices;
    if (!pos || !idx) continue;
    const uvs = p.uvs || null;
    const cols = p.colors || null;
    const flip = p.mirrored ? -1 : 1;
    const textured = !!(uvs && p.material && p.material.textureFile);
    // THE INVENTED SKIN TONE IS GONE. The reference's fragment starts at
    // opaque WHITE with no diffuse map (objects.frag:152-154) and the
    // NIF material defaults are overridden to white too
    // (nifloader.cpp:2740-2742), so an untextured surface is white lit by
    // the scene - not a flat colour somebody chose. The vertex colour,
    // when the mesh HAS one, substitutes for the material's diffuse and
    // ambient terms, which in this pass's single-product lighting is the
    // same arithmetic: texel * colour * (ambient + sun * diff).
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a]; const uy = pos[b + 1] - pos[a + 1]; const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a]; const vy = pos[c + 1] - pos[a + 1]; const vz = pos[c + 2] - pos[a + 2];
      let nx = (uy * vz - uz * vy) * flip;
      let ny = (uz * vx - ux * vz) * flip;
      let nz = (ux * vy - uy * vx) * flip;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-8) { nx /= len; ny /= len; nz /= len; } else { nx = 0; ny = 1; nz = 0; }
      for (let k = 0; k < 3; k++) {
        const v = [a, b, c][k];
        const vi = idx[i + k] * 2;
        const ci = idx[i + k] * 4;
        buf[o++] = pos[v]; buf[o++] = pos[v + 1]; buf[o++] = pos[v + 2];
        buf[o++] = cols ? cols[ci] : 1;
        buf[o++] = cols ? cols[ci + 1] : 1;
        buf[o++] = cols ? cols[ci + 2] : 1;
        buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
        buf[o++] = uvs ? uvs[vi] : 0;
        buf[o++] = uvs ? uvs[vi + 1] : 0;
      }
    }
    const count = (idx.length / 3) * 3;
    // ONE RANGE PER PIECE, because a Morrowind arm is several meshes with
    // several textures and the character path issues drawArrays. The
    // range carries the piece's own texture name; the caller resolves it
    // once and hangs the GL texture here.
    ranges.push({ first, count, piece: p, textureFile: textured ? p.material.textureFile : null, tex: null });
    first += count;
  }
  return { packed: buf, ranges };
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
export async function buildFpArm({ race, female = false, beast = false, weapon = null, deps = null } = {}) {
  const d = deps || await import('../scenes/dataSource.js');
  const skeletonPath = fpSkeletonPath({ female, beast });
  try {
    const archives = await d.loadMorrowindArchives();
    if (!archives.length) return { ok: false, stage: 'data', error: 'no Morrowind .bsa attached' };

    // EVERY .esm, not the first one.
    //
    // THE DEFECT THIS REPLACES, reported by Mac with three archives
    // attached: `.find()` took whichever .esm the store listed first. An
    // expansion carries no base-race BODY records, so if Tribunal.esm or
    // Bloodmoon.esm sorted ahead of Morrowind.esm every arm slot came
    // back "no record for this actor" and the card had nothing more to
    // say. loadMorrowindArchives (dataSource.js) already RANKS the .bsa
    // files by name for exactly this reason; the .esm door simply never
    // got the same treatment.
    //
    // Reading all of them is also what the engine does - later masters
    // add to and override earlier ones - so this is the load order
    // rather than a workaround for it.
    const esmNames = (await d.storedMorrowindNames()).filter((n) => /\.esm$/i.test(n));
    if (!esmNames.length) {
      return { ok: false, stage: 'data', error: 'no Morrowind .esm attached - the body records live there, not in the .bsa' };
    }
    const esmBytes = [];
    for (const n of esmNames) esmBytes.push({ name: n, bytes: await d.loadMorrowindFile(n) });
    // bodyParts(), not loadMorrowindEsm(). The store's parseEsm door
    // returns mwEsmFile's body shape; armReport wants bodyParts' shape;
    // there is no adapter and writing one by guess inside this slice is
    // exactly how MW7 died. Raw bytes through the pinned path instead.
    const parts = esmBytes.flatMap((e) => bodyParts(e.bytes));

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
    // MW-D9: THE WEAPON, and it needs no new attach path at all.
    //
    // A Morrowind weapon is a RIGID part at a bone - rule 12's rigid
    // half, the same path armcuff has proved since MW-D6 - so it rides
    // in as one more part with an explicit `bones` override instead of
    // the PART_BONES table. Rule 17 is that override: the generic
    // "Weapon Bone" is replaced by the equipped type's own attach bone
    // when the actor has that node, which is how a bow reaches
    // "Weapon Bone Left" (rule 8).
    //
    // AND THE BOW COMES OUT MIRRORED, which is faithful and surprising
    // enough to write down before someone "fixes" it. Rule 13's mirror is
    // a SUBSTRING TEST on the attach bone's name
    // (SceneUtil::attach, components/sceneutil/attach.cpp:166-181), and
    // that function is the generic attach path for every part - weapons
    // included, not body parts only. "Weapon Bone Left" contains "Left",
    // so the bow is drawn with X negated by exactly the same rule that
    // mirrors the left hand. Nothing here special-cases it.
    const weaponNotes = [];
    let weaponInfo = null;
    const mwType = dfWeaponToMw(weapon, WEAPONS);
    if (mwType !== MW_WEAPON_TYPE.None) {
      const rec = pickWeaponRecord(esmBytes.flatMap((e) => weaponRecords(e.bytes)), mwType,
        weapon && weapon.materialName);
      if (!rec) {
        weaponNotes.push(`weapon: your archives carry no unenchanted Morrowind weapon of type ${mwType}`);
      } else {
        const path = `meshes/${rec.model}`;
        const arc = find(path);
        if (!arc) weaponNotes.push(`weapon: ${path} (${rec.id}) is not in your archives`);
        else {
          const bone = weaponAttachBone(mwType);
          partBytes.push({ slot: 'weapon', bones: [bone], bytes: arc.get(path).slice() });
          weaponInfo = { id: rec.id, name: rec.name, model: rec.model, type: mwType, bone };
        }
      }
    } else if (weapon) {
      weaponNotes.push('weapon: Morrowind has no weapon type for what you are holding');
    }

    const clipArc = find(FP_CLIP_PATH);
    const kfBytes = clipArc ? clipArc.get(FP_CLIP_PATH).slice() : null;

    if (!partBytes.length) {
      // "no record for this actor" is a dead end for whoever reads it.
      // MW-D4's pattern: report the MEASUREMENT - what was asked for, and
      // what the data actually offers - so the next step is obvious
      // instead of a guess.
      return {
        ok: false,
        stage: 'parts',
        error: `no arm mesh resolved for race "${race}"`,
        notes: missing,
        rows: wanted,
        esm: esmDiagnosis(esmNames, parts, race),
      };
    }
    const arm = await assembleFirstPersonArm({ skeletonBytes, parts: partBytes });
    // MW-D11: the textures the assembled pieces NAME, resolved through
    // rule 36's path law and decoded now - while the archives are still
    // open. The release moved below this for that reason: which textures
    // a mesh wants is not knowable until the mesh is parsed, and parsing
    // twice to keep the release where it was would cost seconds.
    const textures = arm.ok ? collectArmTextures(arm.pieces, archives) : new Map();
    archives.length = 0;   // release the mapped archives; the bytes we need are copied
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
    const union = clipUnionBounds(arm, poseAt, times);
    poseAt(c.startTime);

    // RULE 54. No third fallback, and no invented camera: a rig with
    // neither node has no first-person view, and saying so is the whole
    // difference between this and the mapper it replaces.
    const cameraRef = firstPersonCameraRef(arm.skeleton);
    if (cameraRef < 0) {
      return {
        ok: false,
        stage: 'camera',
        error: 'this skeleton has no "Camera" bone and no "Head" bone - '
          + 'rule 54 has nothing to track',
        notes: [...missing, ...(arm.notes || [])],
        rows: wanted,
      };
    }
    const reach = armReach(firstPersonEye(arm.mats, cameraRef), union);

    return {
      ok: true,
      arm,
      tracks,
      accumRoot,
      keys: clip.keys,
      clip: c,
      textures,
      cameraRef,
      reach,
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
      weapon: weaponInfo,
      esm: esmDiagnosis(esmNames, parts, race),
      notes: [...missing, ...weaponNotes, ...(arm.notes || [])],
      binding: clip.binding,
      pieces: armPieceRows(arm.pieces).length,
    };
  } catch (err) {
    return { ok: false, stage: 'build', error: err && err.message ? err.message : String(err) };
  }
}

/**
 * MW-D11: RESOLVE AND DECODE EVERY TEXTURE THE ARM NAMES.
 *
 * One entry per distinct textureFile, because a Morrowind arm's four
 * pieces routinely share two textures and decoding a DDS twice is pure
 * waste. The path goes through correctTexturePath - the reference's four
 * probes over a re-rooted, .tga->.dds-swapped name - and a MISS is not a
 * refusal: it becomes the 8x8 magenta warning image, exactly as
 * ImageManager does, so a texture the archives do not carry SAYS SO on
 * the arm instead of quietly leaving it flat.
 */
export function collectArmTextures(pieces, archives) {
  const out = new Map();
  const exists = (p) => archives.some((a) => a.has(p));
  for (const piece of pieces ?? []) {
    const file = piece.material && piece.material.textureFile;
    if (!file || out.has(file)) continue;
    const path = correctTexturePath(file, exists);
    const arc = archives.find((a) => a.has(path));
    if (!arc) {
      out.set(file, { ok: false, path, error: 'not in your archives', image: warningImage() });
      continue;
    }
    try {
      out.set(file, { ok: true, path, image: decodeDds(arc.get(path).slice()) });
    } catch (err) {
      out.set(file, { ok: false, path, error: err.message, image: warningImage() });
    }
  }
  return out;
}

/** What the .esm layer actually saw, so a refusal names its own cause.
 *  A slot with no record is not information; the race that was asked
 *  for, beside the races the files carry, is. */
export function esmDiagnosis(names, parts, race) {
  const races = [...new Set((parts ?? []).filter((p) => p.skin && p.playable).map((p) => p.race))].sort();
  return {
    files: names,
    bodyRecords: (parts ?? []).length,
    firstPerson: (parts ?? []).filter((p) => p.firstPerson).length,
    raceWanted: race,
    racesFound: races,
    raceIsThere: races.includes(String(race || '').toLowerCase()),
  };
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

  /**
   * MW-D9f: THE UPDATE PREDICATE, WHICH IS NOT THE DRAW PREDICATE.
   *
   * active() is about DRAWING, and it requires a GPU mesh - correctly,
   * because drawing without one is the frozen-arm failure MWFIX2 shipped.
   * But the mesh is created BY update(), on its first run. Gate the
   * update on active() and the two deadlock: no mesh, so not active; not
   * active, so never updated; never updated, so no mesh. A built arm sat
   * at frames 0 forever and the classic sprite drew instead.
   *
   * Nothing could see it. The node pins drive update() directly and the
   * browser probe drives its own loop, so both skipped the one gate that
   * mattered - the seam, not the engine. THE MEASUREMENT HAS TO RUN THE
   * CALLER'S CONDITION, not a condition that reaches the same code.
   *
   * These are exactly update()'s own requirements: a camera is a DRAW
   * term, and posing without one is harmless work, not a wrong picture.
   */
  const ready = () => !!(built && built.ok && state && renderer);

  function releaseMesh() {
    if (mesh && renderer && renderer.gl) {
      const gl = renderer.gl;
      gl.deleteVertexArray(mesh.vao);
      for (const b of mesh.buffers || []) gl.deleteBuffer(b);
      // MW-D11: the textures go with the mesh that owns them. An arm
      // rebuilt on every attach would otherwise leak one upload per
      // piece per build, which is the shape of NT1's teardown leaks.
      for (const r of mesh.ranges || []) if (r.tex) gl.deleteTexture(r.tex);
    }
    mesh = null;
  }

  return {
    attach(r, cam) { renderer = r || null; camera = cam || null; },
    active,
    ready,
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
        if (!res.ok) { reason = `${res.stage}: ${res.error}`; built = res; return res; }
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
      // Rule 54's neck: the camera node hangs off "bip01 neck", so the
      // pitch has to be in the pose before any matrix is composed - the
      // eye MOVES with the look, it is not a lens tilt.
      const cam = camera && camera();
      poseAssembly(built.arm, {
        tracks: built.tracks, sampleTrack, time: state.time, accumRoot: built.accumRoot,
        // NEGATED, and the sign is a real difference between the two
        // engines rather than a fudge: Morrowind's rot[0] counts pitch
        // DOWNWARD (the controller takes `Quat(rot[0] * 0.75, (-1,0,0))`
        // and a positive angle tips the rig's +Y forward axis toward
        // -Z), while this port's cam.pitch counts UPWARD - world.js
        // SUBTRACTS the mouse's y delta. Passed unconverted, the neck
        // rotates the arms the wrong way and DOUBLES the loss: measured,
        // a 0.25 look-up put every vertex out of frame instead of
        // sliding them a tenth of the way down it.
        neckPitch: cam ? -(cam.pitch || 0) : 0,
      });
      packed = packFpArm(built.arm.pieces, packed);
      if (!mesh) {
        mesh = renderer.createCharacterMesh(packed.packed, { uv: true });
        // MW-D11: the ranges are the piece list, and the textures are
        // resolved ONCE and hung on them - the per-frame path re-uploads
        // vertices and touches nothing else.
        mesh.ranges = packed.ranges;
        for (const r of mesh.ranges) {
          if (!r.textureFile) continue;
          const entry = built.textures.get(r.textureFile);
          if (!entry) continue;
          const clamp = r.piece.material ? r.piece.material.clampMode : 3;
          r.tex = renderer.createCharacterTexture(entry.image.mips, wrapModes(clamp));
          // NiAlphaProperty's own threshold, 0-255 in the file.
          r.alphaCut = r.piece.material && r.piece.material.alphaTest
            ? (r.piece.material.alphaThreshold || 0) / 255 : 0;
        }
      } else {
        renderer.updateCharacterMesh(mesh, packed.packed);
      }
      frames++;
    },

    draw(canvas) {
      if (!active() || !canvas) return false;
      const cam = camera();
      if (!cam) return false;
      const wantW = canvas.clientWidth / CHAR_PIXEL;
      const wantH = canvas.clientHeight / CHAR_PIXEL;
      const s = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
      const pw = Math.max(2, Math.round(wantW * s));
      const ph = Math.max(2, Math.round(wantH * s));

      // RULE 54: THE WHOLE PASS LIVES IN THE RIG'S OWN SPACE.
      //
      // The camera is a node of this rig, so the player's world position
      // and heading do not enter into it at all - turning your head does
      // not move your arms relative to your eyes. What is left is the
      // camera node's translation, the player's pitch, and the basis
      // change from the file's Z-up axes into this renderer's Y-up.
      const eye = firstPersonEye(built.arm.mats, built.cameraRef);
      if (!eye) return false;
      // The neck has already taken 0.75 of the pitch (poseAssembly), so
      // the eye has MOVED with the look; the lens takes all of it, which
      // is the lag you feel when you glance down at your hands.
      const pitch = cam.pitch || 0;
      const fwd = [0, Math.sin(pitch), -Math.cos(pitch)];
      const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);

      // AND IT RIDES THE HANDEDNESS MIRROR, which the viewmodel pass
      // this technique was borrowed from does not.
      //
      // mat4's law: a right-handed lookAt puts world +x on screen-LEFT,
      // which is the mirror image the port presented until M1 - every
      // town flipped east-west, every sign reading backwards. The fix is
      // ONE mirror at the projection, and EVERY world pass rides it. The
      // voxel viewmodel was left out with the reason given as "its pass
      // never culls" - why it was SAFE to leave, not a claim it was right.
      //
      // For an arm it is the whole thing: measured, a point one metre to
      // the player's RIGHT lands at NDC x -1.96 through the unmirrored
      // pass and +1.96 through a world pass. Your sword hand would be on
      // the wrong side of the screen and every left hand a right one, and
      // no picture says so, because an arm looks like an arm either way.
      //
      // Mirroring is free for the reason the original note gives:
      // drawCharacter disables back-face culling (renderer.js), so the
      // winding flip a negative-x scale causes costs nothing.
      //
      // The planes are in RIG UNITS and come off the arm's own reach, so
      // a file authored at any scale is framed by its own geometry
      // rather than by a constant that assumes metres.
      const proj = mirrorProjectionX(
        perspective(FP_FIELD_OF_VIEW, pw / ph, Math.max(built.reach / 200, 1e-4), built.reach * 4),
      );
      const tex = renderer.renderCharacterSprite(mesh, NIF_TO_PASS, proj, view, pw, ph);
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
        weapon: built && built.ok ? built.weapon : null,
        esm: built && built.esm ? built.esm : null,
        cameraBone: built && built.ok ? built.cameraBone : null,
        reach: built && built.ok ? built.reach : null,
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
