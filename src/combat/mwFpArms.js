// Morrowind first-person arms + weapons - slice 5 of the import arc.
//
// THE CLASSIC PATH IS LAW. combat/fpsWeapon.js is the 1:1 WeaponManager
// port and stays exactly as it is; this module is an OPT-IN alternate
// RENDERER for the same rig state. weaponRig still owns the state
// machine, the timing, the sounds, the combat - when this layer is
// active it draws a skinned 3D viewmodel where the sprite would have
// blitted, and when it is not (no flag, no data, missing meshes) the
// sprite draws as always. Nothing here changes a law.
//
// Activation needs BOTH: the `mwfp` query flag AND user-supplied
// Morrowind data in the morrowind asset store (dataSource.js - same
// contract as ARENA2: bytes never enter the repo or the build).
//
// The picture: a hidden 320x200 WebGL2 canvas (the classic design
// surface, so the pixel look is free) renders the assembled first-person
// rig - base_anim.1st skeleton, its skinned arm geometry, a weapon mesh
// attached at the Weapon Bone - CPU-skinned per frame by the slice-3/4
// modules. The canvas is uploaded into ONE dynamic texture on the main
// renderer and composited through the same drawScreenQuad the sprite
// uses, LAST in the host frame.
//
// STATE MAPPING (pure, pinned in test/mwfp.test.js): the rig's seven
// classic states map onto Morrowind's first-person groups - an idle
// group per weapon class (Idle1h/Idle2c/Idle2w/IdleBow) and an attack
// SEGMENT (chop/slash/thrust) inside the class's weapon group, read out
// of the group's own sub-markers ("Chop Start".."Chop Follow Stop").
// Daggerfall swings six directions where Morrowind swings three:
// down-family -> chop, sideways -> slash, up -> thrust.

import {
  loadMorrowindArchives,
  hasStoredMorrowind,
} from '../scenes/dataSource.js';
import { normalizeBsaPath } from '../formats/mwBsaFile.js';
import { parseNif } from '../formats/mwNifFile.js';
import { flattenNif } from '../formats/mwNifMesh.js';
import { decodeDds } from '../formats/mwDdsFile.js';
import {
  collectTextKeys,
  parseAnimGroups,
  extractTracks,
  sampleTrack,
} from '../formats/mwAnim.js';
import {
  buildSkeleton,
  poseSkeleton,
  skeletonSpaceMatrices,
  skinBatch,
} from '../formats/mwSkin.js';
import { bindPart, attachmentTransform } from '../formats/mwCharacter.js';
import { WEAPON_TYPES } from './fpsWeapon.js';

// --- pure mapping ----------------------------------------------------------

/** Morrowind weapon class per engine weapon type. */
export function mwWeaponClass(weaponType) {
  switch (weaponType) {
    case WEAPON_TYPES.Bow:
      return 'bow';
    case WEAPON_TYPES.Staff:
    case WEAPON_TYPES.Staff_Magic:
    case WEAPON_TYPES.Warhammer:
    case WEAPON_TYPES.Warhammer_Magic:
    case WEAPON_TYPES.Battleaxe:
    case WEAPON_TYPES.Battleaxe_Magic:
      return 'twohand';
    case WEAPON_TYPES.Melee:
    case WEAPON_TYPES.Werecreature:
      return 'handtohand';
    case WEAPON_TYPES.None:
      return 'none';
    default:
      return 'onehand';
  }
}

const CLASS_GROUPS = Object.freeze({
  onehand: { idle: 'Idle1h', attack: 'WeaponOneHand' },
  twohand: { idle: 'Idle2c', attack: 'WeaponTwoHand' },
  handtohand: { idle: 'Idle', attack: 'HandToHand' },
  bow: { idle: 'Idle1h', attack: 'BowAndArrow' },
  none: { idle: 'Idle', attack: null },
});

/** Daggerfall's six swing directions onto Morrowind's three. */
export function mwSegmentForState(state) {
  switch (state) {
    case 'StrikeDown':
    case 'StrikeDownLeft':
    case 'StrikeDownRight':
      return 'chop';
    case 'StrikeLeft':
    case 'StrikeRight':
      return 'slash';
    case 'StrikeUp':
      return 'thrust';
    default:
      return null;
  }
}

/**
 * The full pure decision: which MW group plays for a rig state, and
 * which sub-segment of it when striking.
 */
export function mwAnimForState(weaponType, state) {
  const cls = CLASS_GROUPS[mwWeaponClass(weaponType)];
  const segment = mwSegmentForState(state);
  if (!segment || !cls.attack) return { group: cls.idle, segment: null };
  return { group: cls.attack, segment };
}

/**
 * A striking clip's window inside its group: [<segment> start ..
 * <segment> follow stop], read from the group's own sub-markers, with
 * honest fallbacks when a marker set is partial. Null when the group
 * doesn't carry the segment at all.
 */
export function mwSegmentWindow(group, segment) {
  if (!group) return null;
  const markers = group.markers;
  if (!markers) return null;
  const at = (m) => markers.get(`${segment} ${m}`);
  const start = at('start') ?? at('min attack');
  const stop = at('follow stop') ?? at('hit') ?? at('max attack');
  if (start == null || stop == null || stop <= start) return null;
  return { start, stop };
}

/** Default weapon meshes per engine type - the retail iron set. A
 *  missing file reports through status and simply draws bare hands. */
export const MW_WEAPON_MESH = Object.freeze({
  [WEAPON_TYPES.LongBlade]: 'meshes\\w\\w_iron_longsword.nif',
  [WEAPON_TYPES.LongBlade_Magic]: 'meshes\\w\\w_iron_longsword.nif',
  [WEAPON_TYPES.Dagger]: 'meshes\\w\\w_iron_dagger.nif',
  [WEAPON_TYPES.Dagger_Magic]: 'meshes\\w\\w_iron_dagger.nif',
  [WEAPON_TYPES.Staff]: 'meshes\\w\\w_iron_staff.nif',
  [WEAPON_TYPES.Staff_Magic]: 'meshes\\w\\w_iron_staff.nif',
  [WEAPON_TYPES.Mace]: 'meshes\\w\\w_iron_mace.nif',
  [WEAPON_TYPES.Mace_Magic]: 'meshes\\w\\w_iron_mace.nif',
  [WEAPON_TYPES.Flail]: 'meshes\\w\\w_iron_mace.nif',
  [WEAPON_TYPES.Flail_Magic]: 'meshes\\w\\w_iron_mace.nif',
  [WEAPON_TYPES.Warhammer]: 'meshes\\w\\w_iron_warhammer.nif',
  [WEAPON_TYPES.Warhammer_Magic]: 'meshes\\w\\w_iron_warhammer.nif',
  [WEAPON_TYPES.Battleaxe]: 'meshes\\w\\w_iron_battle_axe.nif',
  [WEAPON_TYPES.Battleaxe_Magic]: 'meshes\\w\\w_iron_battle_axe.nif',
  [WEAPON_TYPES.Bow]: 'meshes\\w\\w_long_bow.nif',
});

export const MW_WEAPON_BONE = 'weapon bone';

// --- the view --------------------------------------------------------------

const NATIVE_W = 320;
const NATIVE_H = 200;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
uniform mat4 uProj, uView;
out vec3 vNrm; out vec2 vUV;
void main(){ vNrm=aNrm; vUV=aUV; gl_Position=uProj*uView*vec4(aPos,1.0); }`;
const FS = `#version 300 es
precision mediump float;
in vec3 vNrm; in vec2 vUV;
uniform sampler2D uTex; uniform vec3 uDiffuse; uniform float uHasTex, uAlpha;
out vec4 o;
void main(){
  vec4 t = uHasTex > 0.5 ? texture(uTex, vUV) : vec4(1.0);
  if (t.a < 0.05) discard;
  float l = 0.55 + 0.45 * max(dot(normalize(vNrm), normalize(vec3(0.3,0.5,0.8))), 0.0);
  o = vec4(t.rgb * uDiffuse * l, t.a * uAlpha);
}`;

function param(name) {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

/**
 * Create the MW first-person view. Resolves inert (active() false, so
 * the sprite path runs untouched) unless the flag is up, the data is
 * attached, and the meshes load. `renderer` is the game renderer -
 * its gl uploads the stream texture, its drawScreenQuad composites.
 */
export async function createMwFpView(renderer) {
  const inert = { active: () => false, update: () => {}, draw: () => {}, status: 'off' };
  if (param('mwfp') !== '1') return inert;
  if (!(await hasStoredMorrowind())) {
    window.__mwfp = { ready: false, status: 'no morrowind data attached' };
    return inert;
  }
  const status = (s) => {
    view.status = s;
    window.__mwfp = { ready: view.ready, status: s };
  };
  const view = { ready: false, status: 'loading' };

  const archives = await loadMorrowindArchives();
  const file = (name) => {
    const key = normalizeBsaPath(name);
    for (const a of archives) if (a.has(key)) return a.get(key);
    return null;
  };

  // --- assemble the rig ----------------------------------------------------
  const baseName = param('mwfpbase') || 'meshes\\base_anim.1st.nif';
  const baseBytes = file(baseName);
  if (!baseBytes) {
    status(`missing ${baseName}`);
    return { ...inert, status: view.status };
  }
  let baseNif;
  try {
    baseNif = parseNif(baseBytes);
  } catch (err) {
    status(`${baseName}: ${err.message}`);
    return { ...inert, status: view.status };
  }
  const skeleton = buildSkeleton(baseNif);
  let tracks = extractTracks(baseNif);
  let groups = parseAnimGroups(collectTextKeys(baseNif));
  const kfName = param('mwfpkf') || 'meshes\\xbase_anim.1st.kf';
  const kfBytes = file(kfName);
  if (kfBytes) {
    try {
      const kfNif = parseNif(kfBytes);
      const kfTracks = extractTracks(kfNif);
      if (kfTracks.size) {
        tracks = kfTracks;
        groups = parseAnimGroups(collectTextKeys(kfNif));
      }
    } catch (err) {
      status(`${kfName}: ${err.message}`);
    }
  }

  const skinnedSets = [];
  const attachedSets = []; // {batches, attachRef, transforms}
  const baseBatches = flattenNif(baseNif);
  for (const b of baseBatches) {
    if (b.skinned && b.skin) skinnedSets.push(b);
  }
  for (const name of (param('mwfparms') || '').split(',').filter(Boolean)) {
    const bytes = file(name);
    if (!bytes) {
      status(`missing arms part ${name}`);
      continue;
    }
    try {
      const bound = bindPart(skeleton, parseNif(bytes));
      skinnedSets.push(...bound.skinned);
    } catch (err) {
      status(`${name}: ${err.message}`);
    }
  }

  const weaponMeshes = new Map(); // weaponType -> {batches, attachRef} | null
  function weaponFor(weaponType) {
    if (weaponMeshes.has(weaponType)) return weaponMeshes.get(weaponType);
    const name = param('mwfpweapon') || MW_WEAPON_MESH[weaponType];
    let entry = null;
    const bytes = name && file(name);
    if (bytes) {
      try {
        entry = bindPart(skeleton, parseNif(bytes), {
          attachBone: param('mwfpwbone') || MW_WEAPON_BONE,
        });
      } catch (err) {
        status(`${name}: ${err.message}`);
      }
    } else if (name) status(`missing weapon mesh ${name}`);
    weaponMeshes.set(weaponType, entry);
    return entry;
  }

  // --- the offscreen GL stage ---------------------------------------------
  const stage = document.createElement('canvas');
  stage.width = NATIVE_W;
  stage.height = NATIVE_H;
  const gl = stage.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  if (!gl) {
    status('webgl2 unavailable for the FP stage');
    return { ...inert, status: view.status };
  }
  const prog = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VS],
    [gl.FRAGMENT_SHADER, FS],
  ]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      status(`FP shader: ${gl.getShaderInfoLog(sh)}`);
      return { ...inert, status: view.status };
    }
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const texCache = new Map();
  function stageTexture(fileName) {
    const key = normalizeBsaPath(fileName);
    if (texCache.has(key)) return texCache.get(key);
    let tex = null;
    let bytes = file(key);
    if (!bytes) bytes = file(key.replace(/\.[a-z0-9]+$/, '.dds'));
    if (bytes) {
      try {
        const img = decodeDds(bytes);
        const mip = img.mips[0];
        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, mip.width, mip.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, mip.rgba);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      } catch {
        tex = null;
      }
    }
    texCache.set(key, tex);
    return tex;
  }

  function drawSet(batch, positions) {
    const geo = batch.__geo || (batch.__geo = {});
    if (!geo.vao) {
      geo.vao = gl.createVertexArray();
      gl.bindVertexArray(geo.vao);
      geo.pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.pos);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      geo.nrm = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.nrm);
      gl.bufferData(gl.ARRAY_BUFFER, batch.normals || new Float32Array(positions.length), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      const uvBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        batch.uvs || new Float32Array((positions.length / 3) * 2),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      geo.idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.indices, gl.STATIC_DRAW);
      geo.count = batch.indices.length;
      geo.tex = batch.material.textureFile ? stageTexture(batch.material.textureFile) : null;
    } else {
      gl.bindVertexArray(geo.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    }
    const m = batch.material;
    gl.uniform3f(U('uDiffuse'), m.diffuse[0], m.diffuse[1], m.diffuse[2]);
    gl.uniform1f(U('uAlpha'), m.alpha);
    gl.uniform1f(U('uHasTex'), geo.tex ? 1 : 0);
    if (geo.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, geo.tex);
      gl.uniform1i(U('uTex'), 0);
    }
    gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
  }

  // Perspective over the design surface; the rig stands in MW's Z-up.
  // Tunable through mwfpcam=x,y,z,tz until retail framing settles it.
  const cam = (param('mwfpcam') || '0,-2.4,1.1,0.9').split(',').map(Number);
  function projView() {
    const f = 1 / Math.tan((55 * Math.PI) / 360);
    const aspect = NATIVE_W / NATIVE_H;
    const near = 0.05;
    const far = 100;
    const proj = new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0,
    ]);
    // Look from cam xyz toward (0, 0, tz), MW Z mapped up: fixed basis
    // fwd=+y, up=+z in view space via an axis swap baked below.
    const [cx, cy, cz, tz] = cam;
    const fwd = norm3([0 - cx, 0 - cy, tz - cz]);
    const right = norm3(cross(fwd, [0, 0, 1]));
    const up = cross(right, fwd);
    const viewM = new Float32Array([
      right[0], up[0], -fwd[0], 0,
      right[1], up[1], -fwd[1], 0,
      right[2], up[2], -fwd[2], 0,
      -(right[0] * cx + right[1] * cy + right[2] * cz),
      -(up[0] * cx + up[1] * cy + up[2] * cz),
      fwd[0] * cx + fwd[1] * cy + fwd[2] * cz,
      1,
    ]);
    return { proj, viewM };
  }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm3 = (v) => {
    const l = Math.hypot(...v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  // One dynamic stream texture on the MAIN renderer, updated from the
  // stage canvas each draw (uploadTexture memoizes forever by design -
  // this stream owns its own texture instead).
  const mainGl = renderer.gl;
  const streamTex = mainGl.createTexture();
  mainGl.bindTexture(mainGl.TEXTURE_2D, streamTex);
  mainGl.texParameteri(mainGl.TEXTURE_2D, mainGl.TEXTURE_MIN_FILTER, mainGl.NEAREST);
  mainGl.texParameteri(mainGl.TEXTURE_2D, mainGl.TEXTURE_MAG_FILTER, mainGl.NEAREST);
  mainGl.texParameteri(mainGl.TEXTURE_2D, mainGl.TEXTURE_WRAP_S, mainGl.CLAMP_TO_EDGE);
  mainGl.texParameteri(mainGl.TEXTURE_2D, mainGl.TEXTURE_WRAP_T, mainGl.CLAMP_TO_EDGE);

  // --- per-frame -----------------------------------------------------------
  let clock = 0;
  let playing = null; // {group, window, oneShot, t}
  const posScratch = new Map();

  function pick(weaponType, state) {
    const want = mwAnimForState(weaponType, state);
    const group = groups.get(want.group);
    if (!group) return null;
    if (want.segment) {
      const win = mwSegmentWindow(group, want.segment);
      if (win) return { key: `${want.group}:${want.segment}`, ...win, oneShot: true };
      return null;
    }
    return { key: want.group, start: group.start, stop: group.stop, oneShot: false };
  }

  view.update = (dt, weaponType, state) => {
    clock += dt;
    const next = pick(weaponType, state);
    if (!next) {
      playing = null;
      return;
    }
    if (!playing || playing.key !== next.key) playing = { ...next, t: next.start };
    else {
      playing.t += dt;
      const span = playing.stop - playing.start;
      if (playing.t > playing.stop) {
        playing.t = playing.oneShot ? playing.stop : playing.start + ((playing.t - playing.start) % span);
      }
    }
  };

  view.draw = (canvas, weaponType) => {
    const t = playing ? playing.t : 0;
    const pose = poseSkeleton(skeleton, playing ? tracks : null, sampleTrack, t);
    const rootRef = [...skeleton.nodes.entries()].find(([, n]) => n.parent < 0)?.[0] ?? -1;
    const matsCache = new Map();
    const matsFor = (root) => {
      if (!matsCache.has(root)) matsCache.set(root, skeletonSpaceMatrices(skeleton, pose, root));
      return matsCache.get(root);
    };
    gl.viewport(0, 0, NATIVE_W, NATIVE_H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    const { proj, viewM } = projView();
    gl.uniformMatrix4fv(U('uProj'), false, proj);
    gl.uniformMatrix4fv(U('uView'), false, viewM);
    for (const batch of skinnedSets) {
      let out = posScratch.get(batch);
      if (!out) posScratch.set(batch, (out = new Float32Array(batch.positions.length)));
      skinBatch(batch, skeleton, pose, matsFor(batch.skin.skeletonRoot), out, null);
      drawSet(batch, out);
    }
    const weapon = weaponFor(weaponType);
    if (weapon) {
      for (const batch of weapon.skinned) {
        let out = posScratch.get(batch);
        if (!out) posScratch.set(batch, (out = new Float32Array(batch.positions.length)));
        skinBatch(batch, skeleton, pose, matsFor(batch.skin.skeletonRoot), out, null);
        drawSet(batch, out);
      }
      if (weapon.attached.length) {
        const at = attachmentTransform(matsFor(rootRef), weapon.attachRef);
        for (const batch of weapon.attached) {
          let out = posScratch.get(batch);
          if (!out) posScratch.set(batch, (out = new Float32Array(batch.positions.length)));
          for (let v = 0; v < batch.positions.length; v += 3) {
            const [x, y, z] = [batch.positions[v], batch.positions[v + 1], batch.positions[v + 2]];
            out[v] = at.a[0] * x + at.a[1] * y + at.a[2] * z + at.t[0];
            out[v + 1] = at.a[3] * x + at.a[4] * y + at.a[5] * z + at.t[1];
            out[v + 2] = at.a[6] * x + at.a[7] * y + at.a[8] * z + at.t[2];
          }
          drawSet(batch, out);
        }
      }
    }
    // Composite: the stage canvas into the stream texture, the stream
    // texture over the scene through the classic screen-quad path.
    mainGl.bindTexture(mainGl.TEXTURE_2D, streamTex);
    mainGl.pixelStorei(mainGl.UNPACK_FLIP_Y_WEBGL, false);
    mainGl.texImage2D(mainGl.TEXTURE_2D, 0, mainGl.RGBA, mainGl.RGBA, mainGl.UNSIGNED_BYTE, stage);
    renderer.drawScreenQuad(streamTex, { x: 0, y: 0, w: canvas.width, h: canvas.height });
  };

  view.active = () => view.ready;
  view.ready = skinnedSets.length > 0;
  status(view.ready ? `ready: ${skinnedSets.length} skinned sets, ${groups.size} groups` : 'no skinned geometry in base');
  return view;
}
