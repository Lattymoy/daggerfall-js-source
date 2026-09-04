// ═══════════════════════════════════════════════════════════════════
// MW-D41 — THE PEGAS HORSE. Mac: "implement this mod 1 to 1 to
// replace the current horses for the enhanced version." The Pegas
// Horse Ranch mod (MADMAX, 2004) carries what Morrowind itself never
// shipped: a rigged horse - one skinned NiTriShape ("Tri cavallo",
// ~1k verts; its 43 "Tri Bone##" siblings are HIDDEN per-bone hit
// boxes the flattener rightly skips), a 40+-bone skeleton, and a .kf
// whose text keys speak the full creature vocabulary (Idle 1-7 with
// SoundGen keys, Walkforward/Runforward with loop markers, turns,
// hits, attacks).
//
// THE FILES ARE VENDORED WITH PERMISSION (MW-D50, 2026-09-03). MW-D41
// shipped this module reading ONLY the player's own copy at runtime,
// on the readme's "no use in another mod without my written consent";
// Mac then confirmed the author's consent, so vendor/pegas-horse/
// carries the files VERBATIM (the readme's other condition - "kept
// original and intact" - see its README) and the horse rides for every
// enhanced player out of the box. The runtime door stays: the player's
// own attached copy (MW-D40's loose door) ranks AHEAD of the vendored
// set, the engine's data-files-over-archive law, so a coat or a newer
// build the player attaches wins. The assembly and the drive below are
// unchanged - everything still resolves through the one archives seam,
// and this module never knows which set answered.
//
// EVERYTHING BELOW RIDES THE PROVEN MW STACK - parse, flatten,
// skeleton, clip, pose, CPU skin, pack - through the exact call
// sequence the first-person arm has shipped since MW-D8. The one new
// composition is the per-frame drive: advanceClip -> poseSkeleton ->
// skeletonSpaceMatrices -> skinBatch into the piece's positions ->
// packFpArm repack (which re-derives flat normals from the deformed
// triangles, the arm's own normal law) -> updateCharacterMesh.
// ═══════════════════════════════════════════════════════════════════

import { parseNif } from '../formats/mwNifFile.js';
import { flattenNif } from '../formats/mwNifMesh.js';
import {
  buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, accumRootRef, GRAPH_ROOT,
} from '../formats/mwSkin.js';
import {
  collectTextKeys, normalizeTextKeys, clipGroups, extractTracks, sampleTrack, resetClip, advanceClip,
} from '../formats/mwAnim.js';
import { correctTexturePath, decodeTextureImage, wrapModes } from '../formats/mwTexture.js';
import { MW_UNITS_PER_METER } from '../formats/mwFirstPerson.js';
import { packFpArm, NIF_TO_PASS } from '../combat/fpArm.js';
import { trs, multiply } from '../world/mat4.js';
import { makeLooseArchive } from '../scenes/dataSource.js';   // MW-D50: the vendored set speaks the same duck

/** The mod's own paths, in the canonical data-files frame the MW-D40
 *  loose store keys by. Twenty coat variants ship; 1 is the default. */
export const horseMeshPath = (variant = 1) => `meshes/maxhorse/xhorse${variant}.nif`;
export const horseKfPath = (variant = 1) => `meshes/maxhorse/xhorse${variant}.kf`;

/** The creature clips the ride drives, by motor state. The names are
 *  the .kf's own text-key groups. */
export const HORSE_CLIPS = Object.freeze({
  still: 'Idle',
  walk: 'Walkforward',
  run: 'Runforward',
});

/** The mod's hoof/voice clips, keyed for audio.registerSound. */
export const HORSE_SOUNDS = Object.freeze({
  trot: 'sound/cr/maxhorse/horse_trot.wav',
  gallop: 'sound/cr/maxhorse/horse_gallop.wav',
  idle: 'sound/cr/maxhorse/horse_idle2.wav',
  roar: 'sound/cr/maxhorse/horse_roar.wav',
});

/** MW-D42: the mod's horse is LIFESIZE in Morrowind units (bind span
 *  ~189u tall = 2.7m at the ear tips, ~1.7m at the withers - measured
 *  on the real data), which sits exactly under the motor's F-E3 ride
 *  capsule (eye 2.51). The dial exists for a data set that disagrees. */
export const PEGAS_SCALE = 1.0;

/** MW-D42: motor state -> the .kf's own clip group. Airborne answers
 *  null - the pose HOLDS (the sprite law resets its frame; a 3D horse
 *  mid-jump freezing its stride reads right where a reset would pop). */
export function horseGaitClip({ standingStill, grounded, movingLessThanHalfSpeed }) {
  if (!grounded) return null;
  if (standingStill) return HORSE_CLIPS.still;
  return movingLessThanHalfSpeed ? HORSE_CLIPS.walk : HORSE_CLIPS.run;
}

/** MW-D42: the world placement - the fpArm drawThird law verbatim:
 *  feet position, camera yaw plus the model's 180, the metre scale
 *  with NEGATIVE X (the handedness flip every MW pass takes), then
 *  NIF Z-up tipped to Y-up. */
export function horseModelMatrix(feet, yawRad) {
  const s = PEGAS_SCALE / MW_UNITS_PER_METER;
  const yawDeg = (yawRad * 180 / Math.PI) + 180;
  return multiply(trs(feet[0], feet[1], feet[2], 0, yawDeg, 0, -s, s, s), NIF_TO_PASS);
}

/** MW-D42: the mod's own hoof/voice clips into the audio engine's
 *  MW-D40 door, keyed `pegas:<name>`. Answers the registered set -
 *  the ride swaps a classic clip only for a key that actually landed,
 *  so a partial attach degrades sound by sound, never whole. */
export async function registerHorseSounds(audioEngine, archives) {
  const got = new Set();
  for (const [name, path] of Object.entries(HORSE_SOUNDS)) {
    const arc = (archives ?? []).find((a) => a.has(path));
    if (!arc) continue;
    if (await audioEngine.registerSound(`pegas:${name}`, arc.get(path))) got.add(`pegas:${name}`);
  }
  return got;
}

/** MW-D50: every loose path one coat variant rides on, in fetch
 *  order - the mesh and the clips the assembly cannot stand without,
 *  then the hoof/voice clips it degrades without. The coat is NOT
 *  here: its name lives inside the .nif (horseCoatPath reads it). */
export function horseFiles(variant = 1) {
  return [horseMeshPath(variant), horseKfPath(variant), ...Object.values(HORSE_SOUNDS)];
}

/** MW-D50: the coat the mesh names, resolved through the same
 *  correction the assembly applies (the MW texture-path law), or null
 *  when the bytes do not parse, the skinned shape names no texture, or
 *  `exists` knows no file for it. Never throws - a set that lacks the
 *  coat still stands (lit white, MW-D41's degrade). */
export function horseCoatPath(nifBytes, exists) {
  try {
    const batch = flattenNif(parseNif(nifBytes.slice())).find((b) => b.skinned && b.positions && b.indices);
    const file = batch && batch.material && batch.material.textureFile;
    return file ? (correctTexturePath(file, exists) || null) : null;
  } catch {
    return null;
  }
}

/**
 * MW-D50: the vendored set as ONE loose archive - the {has, get} duck
 * the assembly already speaks, so loadPegasHorse cannot tell it from
 * the player's own attach. `manifest` is the canonical paths the
 * vendor tree carries; `fetchBytes(path)` answers their bytes (null or
 * a throw for a miss). Only the files ONE variant needs are fetched -
 * mesh, clips, its coat, the sounds - never the whole tree. Answers
 * null when the mesh or the clips are missing or fail to arrive (no
 * horse is possible) and skips any optional file that fails, so a
 * partial vendor tree degrades exactly as a partial attach does.
 */
export async function assembleVendoredArchive({ manifest, fetchBytes, variant = 1 }) {
  const canon = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const have = new Set([...(manifest ?? [])].map(canon));
  const has = (p) => have.has(canon(p));
  const take = async (p) => {
    if (!has(p)) return null;
    try { return (await fetchBytes(p)) ?? null; } catch { return null; }
  };
  const [mesh, kf] = await Promise.all([take(horseMeshPath(variant)), take(horseKfPath(variant))]);
  if (!mesh || !kf) return null;
  const files = new Map([[horseMeshPath(variant), mesh], [horseKfPath(variant), kf]]);
  const coat = horseCoatPath(mesh, has);
  const optional = [...(coat ? [coat] : []), ...Object.values(HORSE_SOUNDS)];
  const got = await Promise.all(optional.map(take));
  optional.forEach((p, i) => { if (got[i]) files.set(p, got[i]); });
  return makeLooseArchive(files);
}

/**
 * Assemble the player's own Pegas horse. NEVER throws; a data gap
 * answers `{ ok:false, stage }` (the fpArm probe shape) and the
 * caller keeps the classic sprite. `renderer` provides the character
 * mesh/texture doors; `archives` is loadMorrowindArchives' list (the
 * MW-D40 loose duck included).
 */
export function loadPegasHorse({ renderer, archives, variant = 1 }) {
  const arcFor = (p) => (archives ?? []).find((a) => a.has(p)) ?? null;
  const meshArc = arcFor(horseMeshPath(variant));
  const kfArc = arcFor(horseKfPath(variant));
  if (!meshArc || !kfArc) return { ok: false, stage: 'data' };

  let nif, kf;
  try {
    nif = parseNif(meshArc.get(horseMeshPath(variant)).slice());
    kf = parseNif(kfArc.get(horseKfPath(variant)).slice());
  } catch (err) {
    return { ok: false, stage: 'parse', error: err?.message };
  }

  let batch;
  try {
    batch = flattenNif(nif).find((b) => b.skinned && b.positions && b.indices) ?? null;
  } catch (err) {
    return { ok: false, stage: 'flatten', error: err?.message };
  }
  if (!batch) return { ok: false, stage: 'flatten', error: 'no skinned shape' };

  let skeleton, keys, tracks, accumRoot, groups;
  try {
    skeleton = buildSkeleton(nif);
    keys = normalizeTextKeys(collectTextKeys(kf));
    tracks = extractTracks(kf);
    groups = clipGroups(keys);
    accumRoot = accumRootRef(skeleton, tracks);
  } catch (err) {
    return { ok: false, stage: 'skeleton', error: err?.message };
  }
  if (!groups || !groups.includes?.('Idle')) {
    // clipGroups may answer a Set or array across readers - normalize
    const list = Array.isArray(groups) ? groups : [...(groups ?? [])];
    if (!list.some((g) => String(g).toLowerCase() === 'idle')) {
      return { ok: false, stage: 'clips', error: 'no Idle group' };
    }
  }

  // The piece: the batch's bind pose copied out as the skin target -
  // skinBatch deforms positions in place per frame, the batch keeps
  // the bind data it reads from (poseAssembly's own split).
  const piece = {
    ...batch,
    slot: 'horse',
    mirrored: false,
    positions: new Float32Array(batch.positions),
  };
  const packed = packFpArm([piece]);
  const mesh = renderer.createCharacterMesh(packed.packed, { uv: true });
  mesh.ranges = packed.ranges;

  // The coat. Missing texture DEGRADES (an unlit-white horse with a
  // console note), never fails - the missing-data law.
  const notes = [];
  const file = batch.material && batch.material.textureFile;
  if (file) {
    try {
      const exists = (p) => (archives ?? []).some((a) => a.has(p));
      const tpath = correctTexturePath(file, exists);
      const tarc = tpath ? arcFor(tpath) : null;
      if (tarc) {
        const image = decodeTextureImage(tpath, tarc.get(tpath).slice());
        const clamp = batch.material ? batch.material.clampMode : 3;
        for (const r of mesh.ranges) {
          r.tex = renderer.createCharacterTexture(image.mips, wrapModes(clamp));
          r.alphaCut = batch.material && batch.material.alphaTest
            ? (batch.material.alphaThreshold || 0) / 255 : 0;
        }
      } else notes.push(`coat ${file}: not in the attached data`);
    } catch (err) {
      notes.push(`coat ${file}: ${err?.message}`);
    }
  }

  const horse = {
    ok: true,
    variant,
    mesh,
    keys,
    groups: Array.isArray(groups) ? groups : [...(groups ?? [])],
    notes,
    group: null,
    clipState: null,

    /** Switch clip group; answers false (state kept) when the .kf has
     *  no such group, so a caller can fall back a gait. */
    setClip(group) {
      if (this.group === group && this.clipState) return true;
      const st = resetClip(keys, group);
      if (!st || st.ok === false) return false;
      this.clipState = st;
      this.group = group;
      return true;
    },

    /** One frame: advance the clip, pose the bones, skin, repack,
     *  re-upload. dt 0 re-poses without advancing (the pause law is
     *  the CALLER's - a paused ride simply stops calling this). */
    advance(dt) {
      if (!this.clipState) return;
      advanceClip(this.clipState, keys, dt, null);
      const pose = poseSkeleton(skeleton, tracks, sampleTrack, this.clipState.time, { accumRoot });
      const mats = skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT);
      skinBatch(batch, skeleton, pose, mats, piece.positions, null);
      packFpArm([piece], packed);
      renderer.updateCharacterMesh(mesh, packed.packed);
    },

    /** Free the GL objects - the fpArm releaseGpu shape. */
    dispose() {
      const gl = renderer.gl;
      if (mesh.vao) gl.deleteVertexArray(mesh.vao);
      for (const b of mesh.buffers || []) gl.deleteBuffer(b);
      for (const r of mesh.ranges || []) if (r.tex) gl.deleteTexture(r.tex);
    },
  };
  return horse;
}
