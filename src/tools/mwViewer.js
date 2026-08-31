// ═══════════════════════════════════════════════════════════════════
// MORROWIND MESH VIEWER - slice 2 of the import arc: a static
// weapon/item/body mesh, on screen, from the user's own files.
//
// THE DOCTRINE HOLDS HERE TOO: a render of game data is game data, so
// this page ships empty and asks for the user's Morrowind.bsa (or loose
// .nif/.dds) through a file picker. Bytes never leave the tab. Same
// contract as viewer.html and the game's ARENA2 door.
//
// It is also the RECORD-COVERAGE SCOUT. mwNifFile.js is strict - an
// unimplemented record type throws with its name - and this page shows
// that name instead of a mesh, which is exactly the worklist for the
// animation/particle slices. Parse failures here are a to-do list, not
// a crash.
//
// three.js r128 from CDN, THREE as a global - the paperdoll viewer's
// pattern, kept so both viewer pages stay the same shape.
// ═══════════════════════════════════════════════════════════════════
/* global THREE */

import { MwBsaFile, normalizeBsaPath } from '../formats/mwBsaFile.js';
import { parseNif } from '../formats/mwNifFile.js';
import { flattenNif } from '../formats/mwNifMesh.js';
import { correctTexturePath, decodeTextureImage } from '../formats/mwTexture.js';
import {
  collectTextKeys,
  parseAnimGroups,
  extractTracks,
  sampleTrack,
  normalizeTextKeys,
  resetClip,
  advanceClip,
  isLoopingAnimation,
} from '../formats/mwAnim.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, accumRootRef, GRAPH_ROOT } from '../formats/mwSkin.js';
import { bindPart, attachmentTransform } from '../formats/mwCharacter.js';
import { assembleFirstPersonArm, poseAssembly } from '../formats/mwFirstPerson.js';
import { parseEsm } from '../formats/mwEsmFile.js';
import { assembleNpc, indexSkins } from '../formats/mwNpc.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const statusEl = $('status');
const meshSel = $('meshsel');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const BGS = [0x14141a, 0x3a3a44, 0x86868e, 0xd8cfae];
let bgIndex = 0;
scene.background = new THREE.Color(BGS[bgIndex]);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 5000);
scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x2a2620, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(1.5, 2.5, 1.8);
scene.add(sun);
const grid = new THREE.GridHelper(8, 16, 0x3a3a48, 0x26262f);
scene.add(grid);

// Morrowind is Z-up; three is Y-up. Everything loaded lives under this
// group, tipped once, so batch data stays in MW coordinates.
const holder = new THREE.Group();
holder.rotation.x = -Math.PI / 2;
scene.add(holder);

// --- orbit (drag rotate, wheel/pinch zoom) --------------------------------
const orbit = { yaw: 0.7, pitch: 0.4, dist: 4, target: new THREE.Vector3() };
function applyOrbit() {
  const cp = Math.cos(orbit.pitch);
  camera.position.set(
    orbit.target.x + orbit.dist * cp * Math.sin(orbit.yaw),
    orbit.target.y + orbit.dist * Math.sin(orbit.pitch),
    orbit.target.z + orbit.dist * cp * Math.cos(orbit.yaw),
  );
  camera.lookAt(orbit.target);
}
const pointers = new Map();
let pinchDist = 0;
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 1) {
    orbit.yaw -= (e.clientX - prev[0]) * 0.008;
    orbit.pitch = Math.min(1.5, Math.max(-1.5, orbit.pitch + (e.clientY - prev[1]) * 0.008));
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinchDist) orbit.dist = Math.min(500, Math.max(0.2, orbit.dist * (pinchDist / d)));
    pinchDist = d;
  }
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  pinchDist = 0;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    orbit.dist = Math.min(500, Math.max(0.2, orbit.dist * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
  },
  { passive: false },
);

// Debug/probe hook, the game's __set culture: pose the orbit exactly.
window.__mwviewerSetAnimTime = (t) => {
  anim.seek = t;
};
// The clip law's own state, readable from a probe. F2: Infinity does not
// survive page.evaluate, so the finite flag rides beside the number -
// clipReport's convention, kept so no probe asserts on a null it cannot
// read.
window.__mwviewerClip = () => {
  const c = anim.clip;
  if (!c) return null;
  return {
    group: c.group,
    time: c.time,
    playing: c.playing,
    startTime: c.startTime,
    stopTime: c.stopTime,
    loopStartTime: c.loopStartTime,
    loopStopFinite: Number.isFinite(c.loopStopTime),
    loopStopTime: Number.isFinite(c.loopStopTime) ? c.loopStopTime : null,
  };
};
window.__mwviewerSkinnedPositions = (i = 0) => {
  const s = loaded && loaded.skinnedMeshes[i];
  return s ? Array.from(s.mesh.geometry.attributes.position.array) : null;
};
window.__mwviewerAttachT = (p = 0) => {
  const part = loaded && loaded.parts[p];
  if (!part || !part.attachedMeshes.length) return null;
  const e = part.attachedMeshes[0].matrix.elements;
  return [e[12], e[13], e[14]];
};
window.__mwviewerView = (yaw, pitch, dist) => {
  orbit.yaw = yaw;
  orbit.pitch = pitch;
  if (dist) orbit.dist = dist;
  applyOrbit();
};

// --- data intake ----------------------------------------------------------
let bsa = null; // MwBsaFile of the last archive opened
const looseTextures = new Map(); // normalized name -> Uint8Array (loose .dds)
const textureCache = new Map(); // normalized name -> THREE.Texture|null
let loaded = null; // { name, group, batches, skinnedMeshes, skeleton }
let allMeshNames = [];
// Animation state. A dropped .kf overrides a mesh's inline tracks - the
// retail xbase_anim.kf arrangement.
let kfTracks = null;
let kfGroups = null;
let kfKeys = null;
// ESM state: parsed records + the skin index, for NPC assembly.
let esm = null;
let esmSkins = null;
const npcSel = $('npcsel');

function refreshNpcList() {
  const filter = $('filter').value.toLowerCase();
  npcSel.innerHTML = '';
  npcSel.style.display = esm && bsa ? '' : 'none';
  if (!esm || !bsa) return;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = `npc... (${esm.npcs.size})`;
  npcSel.appendChild(blank);
  for (const id of [...esm.npcs.keys()].sort()) {
    if (filter && !id.includes(filter)) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    npcSel.appendChild(opt);
  }
}

// ?mwdebug=1 - per-batch skin diagnostics to the console, the ground
// truth to send back when retail geometry misbehaves.
const MW_DEBUG = new URLSearchParams(location.search).get('mwdebug') === '1';

function debugDump(label, batches) {
  if (!MW_DEBUG) return;
  for (const b of batches) {
    if (!b.skinned || !b.skin) continue;
    console.log(`[mwdebug] ${label} :: ${b.name}`, {
      verts: b.positions.length / 3,
      skeletonRootRef: b.skin.skeletonRoot,
      bones: b.skin.bones.map((bn) => ({
        name: bn.name,
        ref: bn.ref,
        invBindT: Array.from(bn.invBind.t).map((x) => +x.toFixed(3)),
        weights: bn.indices.length,
      })),
      skinTransformT: Array.from(b.skin.transform.translation).map((x) => +x.toFixed(3)),
      firstVert: Array.from(b.positions.slice(0, 3)).map((x) => +x.toFixed(3)),
    });
  }
}

async function loadNpc(id) {
  if (!esm || !bsa || !id) return;
  let a;
  try {
    a = assembleNpc(esm, id, esmSkins);
  } catch (err) {
    setStatus(err.message);
    return;
  }
  const baseKey = normalizeBsaPath(a.animFile);
  if (!bsa.has(baseKey)) {
    setStatus(`${a.npc.name}: base skeleton ${a.animFile} not in archive`);
    return;
  }
  loadNifBytes(bsa.get(baseKey), baseKey);
  // MW-D21: THE PARTS RIDE THE ONE ASSEMBLY DOOR. What stood here was a
  // per-part loop that attached paired limbs at their FIRST bone only
  // (Mac's missing right arm and right leg), applied no rule 15 filter,
  // no rule 13 mirror, no rule 14 offset - and previewed skinned parts
  // at their AUTHORED positions, which for a retail part (authored
  // part-local) is a torso on the ground. The assembly is the same
  // bindPartsInto + poseAssembly the game's arm rides: every attach
  // bone, filtered, mirrored, offset, in MW-D20's one graph space, and
  // the rest pose is t=0 through the real skinning equation.
  const troubles = [];
  const parts = [];
  for (const part of a.parts) {
    const key = normalizeBsaPath(part.model);
    if (!bsa.has(key)) {
      troubles.push(`${part.slot}: ${part.model} not in archive`);
      continue;
    }
    parts.push({ slot: part.slot, bones: part.attachBones, bytes: bsa.get(key).slice(), bodyId: part.bodyId });
  }
  const asm = parts.length
    ? await assembleFirstPersonArm({ skeletonBytes: bsa.get(baseKey).slice(), parts })
    : null;
  loaded.npcAsm = null;
  loaded.npcBound = [];
  if (asm && asm.ok) {
    const group = buildGroup(asm.pieces.map((p) => ({
      positions: p.positions,
      normals: null,
      uvs: p.uvs,
      colors: p.colors,
      indices: p.indices,
      material: p.material || { diffuse: [1, 1, 1], emissive: [0, 0, 0], alpha: 1 },
      skinned: false,
    })));
    holder.add(group);
    group.children.forEach((mesh, i) => {
      mesh.matrixAutoUpdate = false;
      // Rule 13's negation reverses the winding; the reference flips the
      // front face, the scout draws both.
      mesh.material.side = THREE.DoubleSide;
      asm.pieces[i].viewerMesh = mesh;
    });
    loaded.parts.push({ name: `${id} (npc)`, group, attachedMeshes: [], attachRef: null });
    loaded.npcAsm = asm;
    const boundSlots = new Set(asm.pieces.map((p) => p.slot));
    loaded.npcBound = parts.filter((p) => boundSlots.has(p.slot)).map((p) => p.bodyId);
  } else if (asm) {
    troubles.push(...(asm.notes || []).slice(0, 3));
  }
  frameCamera();
  window.__mwviewer = { name: baseKey, loaded, error: null };
  const notes = (asm && asm.notes) || [];
  setStatus(
    `${a.npc.name} (${a.race.name ?? a.npc.race}) - ${loaded.npcBound.length}/${a.parts.length} parts bound` +
      (troubles.length ? ` | ${troubles.slice(0, 3).join('; ')}` : '') +
      (notes.length ? ` | ${notes.slice(0, 2).join('; ')}` : '') +
      (a.missing.length ? ` | ${a.missing.length} slots without skins` : ''),
  );
}

/** Re-pose the NPC assembly and push the pieces into their meshes. */
function poseNpcAsm(opts) {
  const asm = loaded && loaded.npcAsm;
  if (!asm) return;
  poseAssembly(asm, opts);
  for (const p of asm.pieces) {
    const mesh = p.viewerMesh;
    if (!mesh) continue;
    // buildGroup used p.positions as the attribute array itself for
    // unskinned batches, so poseAssembly already wrote into it.
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }
}
// `groups` is parseAnimGroups' LISTING - the dropdown, keyed by the
// name the file wrote. `keys` is the normalized key array the CLIP LAW
// reads (rules 44/45), and `clip` is resetClip's state advanced by
// advanceClip - the same one home mw-inspect and fpArm ride. The two
// answers can disagree (a group the listing names and the law refuses)
// and the page shows the refusal instead of freezing on the listing.
const anim = {
  tracks: null, groups: null, keys: [], clip: null,
  accumRoot: null, playing: null, last: 0, seek: null,
};
const animSel = $('animsel');

function wireAnimation(nif) {
  const skinnedMeshes = loaded ? loaded.skinnedMeshes : [];
  const inlineTracks = extractTracks(nif);
  const rawTextKeys = collectTextKeys(nif);
  const inlineGroups = parseAnimGroups(rawTextKeys);
  anim.tracks = kfTracks && kfTracks.size ? kfTracks : inlineTracks;
  anim.groups = kfGroups && kfGroups.size ? kfGroups : inlineGroups;
  anim.keys = kfKeys && kfKeys.length ? kfKeys : normalizeTextKeys(rawTextKeys);
  // Rule 56's pick, made ONCE per track set instead of every frame -
  // the same skeleton and tracks always answer the same ref, so the
  // per-frame recompute was waste wearing a second-home face.
  anim.accumRoot =
    loaded && loaded.skeleton ? accumRootRef(loaded.skeleton, anim.tracks) : null;
  anim.playing = null;
  anim.clip = null;
  anim.seek = null;
  animSel.innerHTML = '';
  const usable = skinnedMeshes.length && anim.tracks.size && anim.groups.size;
  animSel.style.display = usable ? '' : 'none';
  if (!usable) return;
  const bind = document.createElement('option');
  bind.value = '';
  bind.textContent = 'bind pose';
  animSel.appendChild(bind);
  for (const name of anim.groups.keys()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `anim: ${name}`;
    animSel.appendChild(opt);
  }
  // BIND POSE FIRST (retail-scatter triage, 2026-08-28): a mesh loads
  // still, and animation is a choice - so a wrong pose can never be
  // mistaken for wrong skinning. Pick a group to play it.
  animSel.selectedIndex = 0;
  startGroup('');
}

function startGroup(name) {
  anim.playing = name || null;
  anim.clip = null;
  anim.seek = null;
  anim.last = performance.now();
  if (!anim.playing) {
    if (loaded) for (const s of loaded.skinnedMeshes) restoreBind(s);
    // The NPC assembly's rest is t=0 through the real skinning equation
    // - a retail part is authored part-local and has no on-screen
    // position at all without it.
    poseNpcAsm({ sampleTrack, time: 0 });
    return;
  }
  // The play request is the scripted PlayGroup path: resetClip picks the
  // range (rule 22, with rule 21's own lowercase fold at the door - the
  // MWAUDIT case fix, now coming from the law instead of a second
  // lookup), and isLoopingAnimation answers loopFallback exactly as
  // character.cpp:2631 does for a group a script names.
  const clip = resetClip(anim.keys, name, {
    loopFallback: isLoopingAnimation(anim.keys, name),
  });
  if (!clip.ok) {
    // F3's case: the LISTING can name a group the LAW refuses (armidle's
    // backwards Idle). The refusal is the answer - not a frozen pose.
    setStatus(`${loaded ? `${loaded.name}\n` : ''}anim "${name}" refused: ${clip.reason}`);
    anim.playing = null;
    if (loaded) for (const s of loaded.skinnedMeshes) restoreBind(s);
    return;
  }
  anim.clip = clip;
}

function affineToMatrix4(m) {
  // Row-major {a,t} into THREE's column-major Matrix4 via set(row-major).
  return new THREE.Matrix4().set(
    m.a[0], m.a[1], m.a[2], m.t[0],
    m.a[3], m.a[4], m.a[5], m.t[1],
    m.a[6], m.a[7], m.a[8], m.t[2],
    0, 0, 0, 1,
  );
}


// ADD-PART MODE: a character is base_anim + body parts, joined by bone
// name. With the toggle on, the next mesh picked or dropped BINDS onto
// the loaded skeleton instead of replacing the scene.
let addPartMode = false;

function addPartFromBytes(bytes, name, opts = {}) {
  if (!loaded || !loaded.skeleton) {
    setStatus('load a base mesh first, then add parts');
    return;
  }
  try {
    const partNif = parseNif(bytes);
    const bound = bindPart(loaded.skeleton, partNif, {
      attachBone: opts.attachBone ?? ($('attachsel').value || undefined),
    });
    debugDump(`part ${name}`, bound.skinned);
    const group = buildGroup([...bound.skinned, ...bound.attached]);
    holder.add(group);
    const attachedMeshes = [];
    group.children.forEach((mesh, i) => {
      const batch = i < bound.skinned.length ? bound.skinned[i] : null;
      if (batch) {
        loaded.skinnedMeshes.push({
          mesh,
          batch,
          basePositions: Float32Array.from(batch.positions),
          baseNormals: batch.normals ? Float32Array.from(batch.normals) : null,
        });
      } else {
        mesh.matrixAutoUpdate = false;
        attachedMeshes.push(mesh);
      }
    });
    if (attachedMeshes.length) {
      // Rest placement now; the animation loop repositions when playing.
      const pose = poseSkeleton(loaded.skeleton, null, sampleTrack, 0);
      // MW-D20: one graph space - the same the bound skin now poses in.
      const mats = skeletonSpaceMatrices(loaded.skeleton, pose, GRAPH_ROOT);
      const m4 = affineToMatrix4(attachmentTransform(mats, bound.attachRef));
      for (const mesh of attachedMeshes) mesh.matrix.copy(m4);
    }
    loaded.parts.push({ name, group, attachedMeshes, attachRef: bound.attachRef });
    if (opts.quiet) {
      frameCamera();
      window.__mwviewer = { name, loaded, error: null };
      return true;
    }
    setStatus(
      `${loaded.name} + ${loaded.parts.length} part${loaded.parts.length === 1 ? '' : 's'} (${name}: ${bound.skinned.length} skinned, ${bound.attached.length} attached)`,
    );
    frameCamera();
  } catch (err) {
    setStatus(`${name}\n${err.message}`);
    window.__mwviewer = { name, loaded, error: err.message };
    return false;
  }
  window.__mwviewer = { name, loaded, error: null };
  return true;
}

function restoreBind(s) {
  s.mesh.geometry.attributes.position.array.set(s.basePositions);
  s.mesh.geometry.attributes.position.needsUpdate = true;
  if (s.baseNormals) {
    s.mesh.geometry.attributes.normal.array.set(s.baseNormals);
    s.mesh.geometry.attributes.normal.needsUpdate = true;
  }
  s.mesh.geometry.computeBoundingSphere();
}

function updateAnimation(nowMs) {
  if (!loaded || !anim.playing || !loaded.skeleton || !anim.clip) return;
  // MW-D17: the SECOND HOME FOR CLIP TIME booked at MW-D7 is retired.
  // What stood here - start plus elapsed-modulo-span - moved, stayed
  // symmetric and drew, and replayed the clip's INTRO on every wrap
  // instead of the authored loop window; it also looped EVERY group for
  // ever, where the law loops only what has loop keys or sits in rule
  // 51's hardcoded set, and plays the rest once to their stop key.
  // `seek` poses a time directly (the probe's deterministic door) and
  // deliberately does not advance the clip.
  let t;
  if (anim.seek != null) {
    t = anim.seek;
  } else {
    advanceClip(anim.clip, anim.keys, (nowMs - anim.last) / 1000);
    t = anim.clip.time;
  }
  anim.last = nowMs;
  // Root motion extracted (reference (1,1,0) accumulation) - the walk
  // stays under the actor instead of walking the mesh off the stage.
  const pose = poseSkeleton(loaded.skeleton, anim.tracks, sampleTrack, t, {
    accumRoot: anim.accumRoot,
  });
  const matsByRoot = new Map();
  // MW-D20: attached add-part pieces ride the same graph space as the
  // rebound skins they accompany.
  if (!matsByRoot.has(GRAPH_ROOT)) {
    matsByRoot.set(GRAPH_ROOT, skeletonSpaceMatrices(loaded.skeleton, pose, GRAPH_ROOT));
  }
  for (const part of loaded.parts) {
    if (!part.attachedMeshes.length) continue;
    const m4 = affineToMatrix4(attachmentTransform(matsByRoot.get(GRAPH_ROOT), part.attachRef));
    for (const mesh of part.attachedMeshes) mesh.matrix.copy(m4);
  }
  for (const s of loaded.skinnedMeshes) {
    const root = s.batch.skin.skeletonRoot;
    if (!matsByRoot.has(root)) {
      matsByRoot.set(root, skeletonSpaceMatrices(loaded.skeleton, pose, root));
    }
    const pos = s.mesh.geometry.attributes.position;
    const nrm = s.batch.normals ? s.mesh.geometry.attributes.normal : null;
    skinBatch(s.batch, loaded.skeleton, pose, matsByRoot.get(root), pos.array, nrm && nrm.array);
    pos.needsUpdate = true;
    if (nrm) nrm.needsUpdate = true;
    s.mesh.geometry.computeBoundingSphere();
  }
  // The NPC assembly poses whole, through the same one home the game
  // uses; its pieces' buffers are the mesh attributes.
  poseNpcAsm({ tracks: anim.tracks, sampleTrack, time: t, accumRoot: anim.accumRoot });
}

function setStatus(text) {
  statusEl.textContent = text;
}

/**
 * MW-D11: THE PATH LAW LIVES IN formats/mwTexture.js NOW.
 *
 * What stood here was a "textures\\" prefix and a .tga->.dds swap - and it
 * got three of the reference's rules wrong: it never re-rooted an
 * absolute authoring path, it never tried the basename under textures/,
 * and it took the LAST matching component rather than an inner one. The
 * viewer is a coverage scout, so a texture it failed to find was read as
 * "this mesh has none". One home, one answer.
 */
function textureBytes(name) {
  const has = (p) => looseTextures.has(p) || !!(bsa && bsa.has(p));
  const path = correctTexturePath(name, has);
  if (looseTextures.has(path)) return looseTextures.get(path);
  if (bsa && bsa.has(path)) return bsa.get(path);
  return null;
}

function resolveTexture(fileName, clampMode) {
  const name = normalizeBsaPath(fileName);
  const key = `${name}#${clampMode}`;
  if (textureCache.has(key)) return textureCache.get(key);
  let tex = null;
  const bytes = textureBytes(name);
  if (bytes) {
    try {
      const img = decodeTextureImage(name, bytes);   // MW-D34: by extension (imagemanager.cpp:104-118)
      const mip = img.mips[0];
      tex = new THREE.DataTexture(mip.rgba, mip.width, mip.height, THREE.RGBAFormat);
      // DDS rows are top-down and NIF UVs put v=0 at the top - with
      // flipY off they already agree, so UVs pass through untouched.
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // clampMode bit 0 = wrap S, bit 1 = wrap T.
      tex.wrapS = clampMode & 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      tex.wrapT = clampMode & 2 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    } catch (err) {
      console.warn(`texture ${name}: ${err.message}`);
    }
  }
  textureCache.set(key, tex);
  return tex;
}

let twoSided = false;
let wireframe = false;

function buildGroup(batches) {
  const group = new THREE.Group();
  for (const b of batches) {
    const geo = new THREE.BufferGeometry();
    // Skinned batches are re-skinned in place every frame: the attribute
    // must be a COPY, or skinBatch reads its own last output (source is
    // b.positions) and the pose runs away frame over frame.
    const pos = b.skinned ? Float32Array.from(b.positions) : b.positions;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (b.normals) {
      const nrm = b.skinned ? Float32Array.from(b.normals) : b.normals;
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    } else geo.computeVertexNormals();
    if (b.uvs) geo.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2));
    if (b.colors) geo.setAttribute('color', new THREE.BufferAttribute(b.colors, 4));
    geo.setIndex(new THREE.BufferAttribute(b.indices, 1));
    const m = b.material;
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(m.diffuse[0], m.diffuse[1], m.diffuse[2]),
      emissive: new THREE.Color(m.emissive[0], m.emissive[1], m.emissive[2]),
      vertexColors: !!b.colors,
      wireframe,
      side: twoSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (m.textureFile) {
      const tex = resolveTexture(m.textureFile, m.clampMode);
      if (tex) mat.map = tex;
    }
    if (m.alphaBlend || m.alpha < 1) {
      mat.transparent = true;
      mat.opacity = m.alpha;
    }
    if (m.alphaTest) mat.alphaTest = m.alphaThreshold / 255;
    group.add(new THREE.Mesh(geo, mat));
  }
  return group;
}

function frameCamera() {
  if (!loaded) return;
  const box = new THREE.Box3().setFromObject(loaded.group);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(orbit.target);
  orbit.dist = Math.max(size.x, size.y, size.z, 0.1) * 1.8;
  grid.position.y = box.min.y;
  applyOrbit();
}

function disposeLoaded() {
  if (!loaded) return;
  const groups = [loaded.group, ...loaded.parts.map((p) => p.group)];
  for (const g of groups) {
    holder.remove(g);
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  loaded = null;
}

function loadNifBytes(bytes, name) {
  disposeLoaded();
  // A dropped .kf rides the mesh it was dropped on; a fresh load starts
  // from that mesh's own inline animation again.
  kfTracks = null;
  kfGroups = null;
  kfKeys = null;
  try {
    const nif = parseNif(bytes);
    const batches = flattenNif(nif);
    const group = buildGroup(batches);
    holder.add(group);
    const skinnedMeshes = [];
    group.children.forEach((mesh, i) => {
      if (batches[i].skinned && batches[i].skin) {
        skinnedMeshes.push({
          mesh,
          batch: batches[i],
          basePositions: Float32Array.from(batches[i].positions),
          baseNormals: batches[i].normals ? Float32Array.from(batches[i].normals) : null,
        });
      }
    });
    loaded = { name, group, batches, skinnedMeshes, skeleton: buildSkeleton(nif), parts: [] };
    debugDump(name, batches);
    // The attach-bone list follows the loaded skeleton.
    const attachSel = $('attachsel');
    attachSel.innerHTML = '';
    for (const [, node] of loaded.skeleton.nodes) {
      if (!node.name) continue;
      const opt = document.createElement('option');
      opt.value = node.name;
      opt.textContent = `attach: ${node.name}`;
      attachSel.appendChild(opt);
    }
    wireAnimation(nif);
    const tris = batches.reduce((s, b) => s + b.indices.length / 3, 0);
    const textured = batches.filter((b) => b.material.textureFile).length;
    setStatus(
      `${name}\n${batches.length} batch${batches.length === 1 ? '' : 'es'}, ${tris} tris, ${textured} textured${batches.some((b) => b.skinned) ? ' - skinned (bind-pose preview)' : ''}`,
    );
    frameCamera();
  } catch (err) {
    // The strict reader's error IS the coverage worklist - show it.
    setStatus(`${name}\n${err.message}`);
  }
  window.__mwviewer = { name, loaded, error: loaded ? null : statusEl.textContent };
}

function refreshMeshList() {
  const filter = $('filter').value.toLowerCase();
  meshSel.innerHTML = '';
  for (const n of allMeshNames) {
    if (filter && !n.includes(filter)) continue;
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    meshSel.appendChild(opt);
  }
}

function openArchive(bytes, label) {
  bsa = new MwBsaFile(bytes);
  textureCache.clear();
  allMeshNames = bsa.list().filter((n) => n.endsWith('.nif'));
  refreshMeshList();
  setStatus(`${label}: ${bsa.fileCount} files, ${allMeshNames.length} meshes`);
  if (meshSel.options.length) {
    meshSel.selectedIndex = 0;
    loadNifBytes(bsa.get(meshSel.value), meshSel.value);
  }
}

async function takeFiles(files) {
  let pendingNif = null;
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.bsa')) openArchive(bytes, f.name);
    else if (lower.endsWith('.esm') || lower.endsWith('.esp')) {
      try {
        esm = parseEsm(bytes);
        esmSkins = indexSkins(esm.bodies);
        refreshNpcList();
        setStatus(
          `${f.name}: ${esm.npcs.size} NPCs, ${esm.bodies.size} body parts, ${esm.races.size} races`,
        );
      } catch (err) {
        setStatus(`${f.name}\n${err.message}`);
      }
    }
    else if (lower.endsWith('.dds')) {
      looseTextures.set(normalizeBsaPath(`textures\\${f.name}`), bytes);
      looseTextures.set(normalizeBsaPath(f.name), bytes);
      textureCache.clear();
    } else if (lower.endsWith('.kf')) {
      try {
        const kfNif = parseNif(bytes);
        kfTracks = extractTracks(kfNif);
        const kfRawKeys = collectTextKeys(kfNif);
        kfGroups = parseAnimGroups(kfRawKeys);
        kfKeys = normalizeTextKeys(kfRawKeys);
        setStatus(`${f.name}: ${kfTracks.size} bone tracks, ${kfGroups.size} groups`);
        if (loaded) wireAnimation(kfNif);
      } catch (err) {
        setStatus(`${f.name}\n${err.message}`);
      }
    } else if (lower.endsWith('.nif')) pendingNif = { bytes, name: f.name };
  }
  // Loose mesh last, so its textures (archive or loose) are already in.
  if (pendingNif) {
    if (addPartMode) addPartFromBytes(pendingNif.bytes, pendingNif.name);
    else loadNifBytes(pendingNif.bytes, pendingNif.name);
  }
}

$('file').addEventListener('change', (e) => takeFiles([...e.target.files]));
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  takeFiles([...e.dataTransfer.files]);
});
meshSel.addEventListener('change', () => {
  if (addPartMode) addPartFromBytes(bsa.get(meshSel.value), meshSel.value);
  else loadNifBytes(bsa.get(meshSel.value), meshSel.value);
});
animSel.addEventListener('change', () => startGroup(animSel.value));
$('filter').addEventListener('input', () => {
  refreshMeshList();
  refreshNpcList();
});
npcSel.addEventListener('change', () => loadNpc(npcSel.value));

// --- bar buttons ----------------------------------------------------------
let spinning = true;
$('spin').addEventListener('click', () => {
  spinning = !spinning;
  $('spin').classList.toggle('on', spinning);
});
$('reset').addEventListener('click', () => {
  orbit.yaw = 0.7;
  orbit.pitch = 0.4;
  frameCamera();
});
$('wire').addEventListener('click', () => {
  wireframe = !wireframe;
  $('wire').classList.toggle('on', wireframe);
  if (loaded) loaded.group.traverse((o) => o.material && (o.material.wireframe = wireframe));
});
$('twoside').addEventListener('click', () => {
  twoSided = !twoSided;
  $('twoside').classList.toggle('on', twoSided);
  if (loaded)
    loaded.group.traverse(
      (o) => o.material && (o.material.side = twoSided ? THREE.DoubleSide : THREE.FrontSide),
    );
});
$('addpart').addEventListener('click', () => {
  addPartMode = !addPartMode;
  $('addpart').classList.toggle('on', addPartMode);
  $('attachsel').style.display = addPartMode ? '' : 'none';
});
$('bg').addEventListener('click', () => {
  bgIndex = (bgIndex + 1) % BGS.length;
  scene.background.setHex(BGS[bgIndex]);
});

// --- frame loop -----------------------------------------------------------
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
let last = performance.now();
function tick(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (spinning) orbit.yaw += dt * 0.5;
  updateAnimation(now);
  resize();
  applyOrbit();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ── MW-D34: THE FACE SHEET ──────────────────────────────────────────
// Mac's call: pair the classic portraits to Morrowind heads and hairs
// METICULOUSLY. The pairing is a likeness judgement, so it needs both
// sets in front of the same eye - and the Morrowind set lives only in
// the player's own archives, which this page already renders textured.
// One button: every playable head and hair for every race and sex,
// front and back, on one PNG, each cell labelled with its record id
// and the classic portrait indices the modulo walk currently hands it.
// That file is what the curation table (mwFaceTable.json) is authored
// against.
async function exportFaceSheet() {
  if (!esm || !bsa) { setStatus('face sheet needs an .esm and the .bsa attached'); return; }
  const wasSpinning = spinning; spinning = false;
  const races = [...esm.races.values()].filter((r) => r.playable).sort((a, b) => (a.id < b.id ? -1 : 1));
  const pool = (race, female, part) => {
    const all = [...esm.bodies.values()].filter((b) => b.kind === 0 && !b.vampire && b.playable
      && b.race === race && b.part === part && !String(b.id).endsWith('1st'));
    const sexed = all.filter((b) => b.female === female);
    return (sexed.length ? sexed : all.filter((b) => !b.female)).sort((a, b) => (a.id < b.id ? -1 : 1));
  };
  const CELL = 112; const LABEL = 26; const PAD = 6;
  const rows = [];
  for (const race of races) {
    for (const female of [false, true]) {
      const heads = pool(race.id, female, 0); const hairs = pool(race.id, female, 1);
      if (!heads.length && !hairs.length) continue;
      rows.push({ title: `${race.id} ${female ? 'female' : 'male'}`, heads, hairs });
    }
  }
  const cols = Math.max(1, ...rows.flatMap((r) => [r.heads.length, r.hairs.length])) * 2;   // front + back
  const sheet = document.createElement('canvas');
  sheet.width = PAD + cols * (CELL + PAD);
  sheet.height = rows.reduce((h, r) => h + 22 + 2 * (CELL + LABEL + PAD), PAD);
  const g = sheet.getContext('2d');
  g.fillStyle = '#17140f'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.font = '11px monospace';
  const snap = (rec, x, y, yawOffset) => {
    const key = normalizeBsaPath(`meshes\\${rec.model}`);
    if (!bsa.has(key)) { g.fillStyle = '#c66'; g.fillText('mesh missing', x + 4, y + CELL / 2); return; }
    loadNifBytes(bsa.get(key), rec.id);
    orbit.pitch = 0.05; orbit.yaw = yawOffset;
    frameCamera();
    orbit.dist *= 0.7;
    applyOrbit();
    renderer.setSize(CELL, CELL, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    g.drawImage(renderer.domElement, 0, 0, renderer.domElement.width, renderer.domElement.height, x, y, CELL, CELL);
  };
  let y = PAD;
  for (const row of rows) {
    g.fillStyle = '#e0a458'; g.fillText(row.title, PAD, y + 14); y += 22;
    for (const [kind, list] of [['head', row.heads], ['hair', row.hairs]]) {
      let x = PAD;
      for (let i = 0; i < list.length; i++) {
        const rec = list[i];
        const idx = [];
        for (let f = 0; f < 10; f++) if (f % list.length === i) idx.push(f);
        for (const yaw of [Math.PI, 0]) {
          snap(rec, x, y, yaw);
          x += CELL + PAD;
        }
        g.fillStyle = '#ddd';
        g.fillText(`${kind} ${rec.id}`, x - 2 * (CELL + PAD) + 2, y + CELL + 11);
        g.fillStyle = '#9c8';
        g.fillText(`portraits ${idx.join(',')}`, x - 2 * (CELL + PAD) + 2, y + CELL + 23);
        // yield so the page stays alive across a few hundred renders
        await new Promise((r) => setTimeout(r, 0));
      }
      y += CELL + LABEL + PAD;
    }
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight); camera.updateProjectionMatrix();
  spinning = wasSpinning;
  const a = document.createElement('a');
  a.download = 'mw-face-sheet.png';
  a.href = sheet.toDataURL('image/png');
  a.click();
  setStatus(`face sheet: ${rows.length} race/sex rows exported - upload it back and the table gets written by eye`);
}
$('facesheet')?.addEventListener('click', () => { exportFaceSheet(); });
