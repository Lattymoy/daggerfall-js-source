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
  loadMorrowindEsm,
} from '../scenes/dataSource.js';
import { normalizeBsaPath } from '../formats/mwBsaFile.js';
import { parseNif } from '../formats/mwNifFile.js';
import { flattenNif } from '../formats/mwNifMesh.js';
import { decodeDds } from '../formats/mwDdsFile.js';
import {
  collectTextKeys,
  parseAnimGroups,
  findAnimGroup,
  extractTracks,
  sampleTrack,
} from '../formats/mwAnim.js';
import {
  buildSkeleton,
  poseSkeleton,
  skeletonSpaceMatrices,
  skinBatch,
  accumRootRef,
} from '../formats/mwSkin.js';
import { bindPart, attachmentTransform } from '../formats/mwCharacter.js';
import { indexSkins, firstPersonArmParts, mwRaceId } from '../formats/mwNpc.js';   // MW7: the arms themselves
import { WEAPON_TYPES } from './fpsWeapon.js';
import { mwFpPreference } from './mwFpPref.js';

// --- pure mapping ----------------------------------------------------------

/** Morrowind weapon class per engine weapon type. */
export function mwWeaponClass(weaponType) {
  switch (weaponType) {
    case WEAPON_TYPES.Bow:
      return 'bow';
    // MWAUDIT: THESE ARE WIDE WEAPONS, not close ones. Morrowind
    // splits two-handed into CLOSE (weapontwohand / idle2c - the
    // two-handed long blades) and WIDE (weapontwowide / idle2w - axes,
    // war hammers, staves and spears), and all three of Daggerfall's
    // two-handers here are the wide kind. They were mapped to the
    // CLOSE grip, which is why this module's own header has listed
    // Idle2w among the four idle groups since slice 5 while the table
    // below never once reached it.
    //
    // INFERRED FROM MORROWIND'S TAXONOMY, NOT VERIFIED AGAINST RETAIL
    // DATA - there is no Morrowind install in this repo to read the
    // group names out of. It is safe to be wrong: an absent group
    // falls through idleFallback to the class idle and then to a
    // generic one, so a bad guess costs a grip, never a frozen rig.
    // Worth a look with real data attached.
    case WEAPON_TYPES.Staff:
    case WEAPON_TYPES.Staff_Magic:
    case WEAPON_TYPES.Warhammer:
    case WEAPON_TYPES.Warhammer_Magic:
    case WEAPON_TYPES.Battleaxe:
    case WEAPON_TYPES.Battleaxe_Magic:
      return 'twowide';
    case WEAPON_TYPES.Melee:
    case WEAPON_TYPES.Werecreature:
      return 'handtohand';
    case WEAPON_TYPES.None:
      return 'none';
    default:
      return 'onehand';
  }
}

// MWAUDIT: `twohand` (idle2c / WeaponTwoHand) is Morrowind's
// two-handed CLOSE grip and NO Daggerfall weapon type can reach it -
// weaponTypeForItem folds Claymore and Dai-Katana into LongBlade
// beside Broadsword, because Daggerfall's own first-person art draws
// no separate two-handed blade. The row stays because it is the
// correct name for that grip the moment anything can ask for it, and
// saying so is better than a table that looks arbitrary.
const CLASS_GROUPS = Object.freeze({
  onehand: { idle: 'Idle1h', attack: 'WeaponOneHand' },
  twohand: { idle: 'Idle2c', attack: 'WeaponTwoHand' },
  twowide: { idle: 'Idle2w', attack: 'WeaponTwoWide' },
  handtohand: { idle: 'Idle', attack: 'HandToHand' },
  // The header has always named IdleBow; the table asked for Idle1h.
  // Ask for the specific one and let idleFallback reach Idle1h when a
  // file does not carry it - that is what the chain is for.
  bow: { idle: 'IdleBow', attack: 'BowAndArrow' },
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
export async function createMwFpView(renderer, playerEntity = null) {
  const inert = { active: () => false, update: () => {}, draw: () => {}, dispose: () => {}, status: 'off' };
  if (!mwFpPreference()) return inert;
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
        // MWAUDIT: the groups follow the tracks ONLY IF THE KF HAS
        // ANY. Retail's xbase_anim.1st.kf carries both, so this arm is
        // normally a straight swap - but a KF with tracks and no text
        // keys used to overwrite the base's groups with an EMPTY map,
        // which leaves a rig that cannot name a single clip. Keeping
        // the base's groups is strictly better than keeping none.
        const kfGroups = parseAnimGroups(collectTextKeys(kfNif));
        if (kfGroups.size) groups = kfGroups;
      }
    } catch (err) {
      status(`${kfName}: ${err.message}`);
    }
  }

  const skinnedSets = [];
  const attachedSets = []; // {batches, attachRef}

  /**
   * MW8: a body part is EITHER skinned - carrying its own bone weights
   * - OR a rigid mesh the engine HANGS OFF A BONE, and Morrowind's
   * arms are overwhelmingly the latter: one small mesh per limb,
   * attached at the left bone and again at the right. bindPart has
   * always answered both halves; every caller here took `.skinned` and
   * dropped `.attached` on the floor, so a rigid part was parsed,
   * bound, and thrown away. That is why MW7 did not fix the reported
   * sprite: the arms loaded and vanished, skinnedSets stayed empty,
   * and `ready` stayed false. attachedSets was declared at slice 5 and
   * never once written to - the home these parts needed, empty for as
   * long as it has existed.
   *
   * A missing bone costs that SIDE, not the part: retail skeletons
   * vary and half an arm beats no arm, which is the same rule the
   * mesh lookup already follows.
   */
  const addPart = (partNif, bones, label) => {
    const sides = bones?.length ? bones : [null];
    let tookSkinned = false;
    let placed = 0;
    for (const bone of sides) {
      let bound;
      try {
        bound = bindPart(skeleton, partNif, bone ? { attachBone: bone } : {});
      } catch (err) {
        status(`${label}: ${err.message}`);
        continue;
      }
      // Skinned geometry names its own bones, so it binds ONCE - only
      // the rigid half is placed per side.
      if (!tookSkinned && bound.skinned.length) {
        skinnedSets.push(...bound.skinned);
        tookSkinned = true;
        placed += bound.skinned.length;
      }
      if (bound.attached.length) {
        attachedSets.push({ batches: bound.attached, attachRef: bound.attachRef });
        placed += bound.attached.length;
      }
    }
    return placed;
  };
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
      addPart(parseNif(bytes), null, name);   // MW8: rigid parts kept too
    } catch (err) {
      status(`${name}: ${err.message}`);
    }
  }

  // MW7: THE ARMS. base_anim.1st.nif is Morrowind's first-person
  // SKELETON and animation carrier - it holds no body geometry, so
  // everything above this line leaves the rig with bones and clips and
  // nothing to draw. The visible arms are ordinary body parts chosen
  // by race and sex, in their `.1st` variants, exactly as the
  // third-person body is assembled (slice 6). The two slices were
  // built and never joined, which is why a retail attach showed the
  // classic sprite for ever: skinnedSets stayed empty and the view was
  // never ready.
  //
  // Explicit `mwfparms` still wins by running first - it is the probe
  // and dev door and must keep working against fixture data that has
  // no ESM at all.
  if (!skinnedSets.length && playerEntity) {
    const esm = await loadMorrowindEsm();
    const race = mwRaceId(playerEntity.race);
    if (!esm) {
      status('no Morrowind.esm attached - the arms live in its body records');
    } else if (!race) {
      status('no player race to choose arms for');
    } else {
      const parts = firstPersonArmParts(indexSkins(esm.bodies), race, playerEntity.gender === 'female');
      if (!parts.length) status(`no ${race} body parts in the ESM`);
      for (const part of parts) {
        // the first-person twin, then the third-person mesh: a
        // slightly wrong arm beats no arm, and beats falling back to
        // the sprite while holding perfectly good geometry.
        const bytes = file(part.model) || file(part.thirdPersonModel);
        if (!bytes) continue;
        const label = `${part.slot} (${part.bodyId})`;
        try {
          // MW8: at the left bone AND the right - one mesh, two arms.
          if (!addPart(parseNif(bytes), part.attachBones, label)) status(`${label}: nothing to draw`);
        } catch (err) {
          status(`${label}: ${err.message}`);
        }
      }
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
      const uvBuf = (geo.uv = gl.createBuffer());   // MWAUDIT: kept, so dispose can free it
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
    // Dev/probe override: force a named group while idling, so fixture
    // data (whose groups are not the retail names) can drive the loop.
    const forced = param('mwfpgroup');
    if (forced && !mwSegmentForState(state)) {
      const g = findAnimGroup(groups, forced);
      if (g) return { key: forced, start: g.start, stop: g.stop, oneShot: false };
    }
    // MWAUDIT: THE FALLBACK CHAIN. Every lookup used to be a hard
    // `groups.get(exactCase)` and every miss returned null - which
    // left `playing` null, and draw() renders t=0, so a rig that could
    // not find its group stood in its BIND POSE while active() still
    // answered true. Frozen arms are worse than the classic sprite,
    // and the sprite is what a player should get when the 3D layer has
    // nothing to play.
    //
    // So: the asked-for group, then the class idle, then any idle at
    // all, then whatever the file does carry. A rig that is `ready`
    // always has something to play, so the layer never flickers
    // between 3D and sprite mid-frame; a rig with NO usable group is
    // not ready at all (see view.ready) and the sprite draws.
    const group = findAnimGroup(groups, want.group);
    if (want.segment) {
      const win = group && mwSegmentWindow(group, want.segment);
      if (win) return { key: `${want.group}:${want.segment}`, ...win, oneShot: true };
      // the swing has no clip here - stand in the class idle rather
      // than freeze mid-strike
      const idle = idleFallback(weaponType);
      return idle && { key: `${idle.name}:idlefallback`, start: idle.g.start, stop: idle.g.stop, oneShot: false };
    }
    if (group) return { key: want.group, start: group.start, stop: group.stop, oneShot: false };
    const idle = idleFallback(weaponType);
    return idle && { key: idle.name, start: idle.g.start, stop: idle.g.stop, oneShot: false };
  }

  /** The idle this weapon class wants, then a generic one, then the
   *  first playable group the file carries. Named so the key that
   *  drives the playing-clip compare stays stable per fallback. */
  function idleFallback(weaponType) {
    const wanted = CLASS_GROUPS[mwWeaponClass(weaponType)]?.idle;
    for (const name of [wanted, 'Idle1h', 'Idle']) {
      const g = name && findAnimGroup(groups, name);
      if (g) return { name, g };
    }
    const first = groups.entries().next().value;
    return first ? { name: first[0], g: first[1] } : null;
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
    const pose = poseSkeleton(skeleton, playing ? tracks : null, sampleTrack, t, {
      accumRoot: playing ? accumRootRef(skeleton, tracks) : null,
    });
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
    // MW8: the rigid half of the rig - every attached part posed at its
    // OWN bone's skeleton-space affine. The weapon has always drawn
    // this way; the arms had no such loop at all, which is the other
    // half of why they never appeared.
    const drawAttached = (batches, attachRef, mats) => {
      const at = attachmentTransform(mats, attachRef);
      for (const batch of batches) {
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
    };
    for (const set of attachedSets) drawAttached(set.batches, set.attachRef, matsFor(rootRef));

    const weapon = weaponFor(weaponType);
    if (weapon) {
      for (const batch of weapon.skinned) {
        let out = posScratch.get(batch);
        if (!out) posScratch.set(batch, (out = new Float32Array(batch.positions.length)));
        skinBatch(batch, skeleton, pose, matsFor(batch.skin.skeletonRoot), out, null);
        drawSet(batch, out);
      }
      if (weapon.attached.length) drawAttached(weapon.attached, weapon.attachRef, matsFor(rootRef));
    }
    // Composite: the stage canvas into the stream texture, the stream
    // texture over the scene through the classic screen-quad path.
    mainGl.bindTexture(mainGl.TEXTURE_2D, streamTex);
    mainGl.pixelStorei(mainGl.UNPACK_FLIP_Y_WEBGL, false);
    mainGl.texImage2D(mainGl.TEXTURE_2D, 0, mainGl.RGBA, mainGl.RGBA, mainGl.UNSIGNED_BYTE, stage);
    renderer.drawScreenQuad(streamTex, { x: 0, y: 0, w: canvas.width, h: canvas.height });
  };

  /**
   * MWAUDIT: THE VIEW HANDS ITS GL BACK.
   *
   * Nothing here ever needed a teardown: the view was built exactly
   * once per weapon rig, so its owner was the process and the page
   * outlived it. MWFIX changed that - the rig REBUILDS the view on
   * every attach and every 3D toggle - and a rebuild that drops the
   * old view on the floor leaks everything it held: one texture per
   * material, four buffers and a VAO per geometry batch, and the
   * stream texture on the MAIN renderer's context, which is the one
   * that matters because it is the context the game draws through.
   *
   * (This is the same law the encounter pool needed a teardown for at
   * IF, and for the same reason: a second owner appears and the
   * process stops being it. Found auditing my own fix.)
   *
   * Idempotent - a rebuild races nothing, but a dispose that ran twice
   * would delete names GL has already recycled.
   */
  let disposed = false;
  view.dispose = () => {
    if (disposed) return;
    disposed = true;
    view.ready = false;                       // active() answers false the instant it is dropped
    for (const t of texCache.values()) if (t) gl.deleteTexture(t);
    texCache.clear();
    // MW8: this walked `set.batch?.__geo` and freed NOTHING - the sets
    // ARE the batches (drawSet hangs __geo straight off them), so every
    // lookup was undefined and every iteration hit the `continue`. The
    // MWAUDIT pin held me to a dispose that existed, not to one that
    // worked. It also never reached the rigid parts or the weapon
    // meshes, which is now everything the view uploaded.
    const freeBatch = (batch) => {
      const geo = batch?.__geo;
      if (!geo) return;
      if (geo.vao) gl.deleteVertexArray(geo.vao);
      for (const b of [geo.pos, geo.nrm, geo.uv, geo.idx]) if (b) gl.deleteBuffer(b);
      batch.__geo = null;
    };
    for (const batch of skinnedSets) freeBatch(batch);
    for (const set of attachedSets) for (const batch of set.batches) freeBatch(batch);
    for (const entry of weaponMeshes.values()) {
      if (!entry) continue;
      for (const batch of entry.skinned) freeBatch(batch);
      for (const batch of entry.attached) freeBatch(batch);
    }
    mainGl.deleteTexture(streamTex);          // the one on the GAME's context
  };

  view.active = () => view.ready;
  // MWAUDIT: READY MEANS POSEABLE, not merely built. This was
  // `skinnedSets.length > 0` alone - geometry with no playable group
  // counted as ready, and a rig that can name no clip draws its BIND
  // POSE for ever while the sprite path it should have fallen back to
  // sits unused. Both halves are required, and the status line says
  // which one is missing rather than reporting a bare failure.
  // MW8: ...and GEOMETRY means either kind. Counting only the skinned
  // half declared a rig with two perfectly good rigid arms unready.
  const drawable = skinnedSets.length + attachedSets.length;
  view.ready = drawable > 0 && groups.size > 0;
  status(view.ready
    ? `ready: ${skinnedSets.length} skinned + ${attachedSets.length} attached sets, ${groups.size} groups`
    : drawable === 0 ? 'no arm geometry loaded' : 'no animation groups - the sprite path stands');
  return view;
}
