// ═══════════════════════════════════════════════════════════════════
// THE VOXEL EDITOR, AS A PAGE
//
// The same orbit viewer tools/neutral/build-viewer.mjs bakes into a
// standalone file — but built by vite and fed at RUNTIME, so it can
// actually be deployed.
//
// WHY IT COULD NOT BE BEFORE. The editor's payload is derived from
// BODY00I0.IMG and FACE00I0.CIF, and the doctrine is explicit: A RENDER
// OF GAME DATA IS GAME DATA. Baking that payload into a published file
// puts ARENA2 on the open web as surely as committing a .BSA would, and
// AUDIT 21 caught exactly that happening with gallery PNGs. So this page
// asks for the user's own ARENA2 through dataSource — the same door the
// game uses, the same IndexedDB, the same one-time pick — and builds the
// payload in the browser from bytes that were always theirs.
//
// AND THE INJECTIONS BECOME IMPORTS. The standalone file pastes
// clothSim, anims, weaponStates and animate in as TEXT with `export`
// stripped, which once put two `const ZERO_ARM` in one scope and killed
// the whole script with a SyntaxError — the page loaded and nothing ran.
// A module imports them, with the same aliases that replacement was
// faking, and the entire class of failure goes away.
// ═══════════════════════════════════════════════════════════════════

import { MISSILE_SPEED } from '../systems/spellcast.js';   // AUDIT 23: the arrow speed's one home
import { buildPaperdollPayload } from '../characters/paperdollPayload.js';
import { makeCoreFn, buildCloth, stepCloth, articulatedCapsules } from '../characters/clothSim.js';
import { beastAttackPose, hitPointOf } from '../characters/beastAttack.js';
import { DIRECTION_TO_STRIKE, STRIKES, sampleClip, REACTIONS } from '../characters/anims.js';
import {
  CLASSIC_UPDATE_INTERVAL,
  getMeleeWeaponAnimTime,
  getBowCooldownTime,
  MAX_GESTURE_SECONDS,
  MAX_BOW_HELD_DRAWN_SECONDS,
  ATTACK_THRESHOLD,
  MELEE_NUM_FRAMES,
  HIT_FRAME_MELEE,
  HIT_FRAME_BOW,
  BOW_SOUND_FRAME,
  BOW_NUM_FRAMES,
  gestureDirection,
  createWeaponMachine,
  machineAttack,
  machineCancelBowDraw,
  machineStep,
} from '../characters/weaponStates.js';
// The aliases the standalone build faked with a regex. See the note above.
import {
  rotX,
  rotY,
  rotZ,
  POSE_L,
  WALK,
  RUN,
  createAnimContext,
  animateTarget as animateTargetCore,
} from '../characters/animate.js';

// three.js comes from the CDN tag in viewer.html, exactly as the
// standalone viewer has always taken it — dagger has no dependencies
// and this page is not the place to give it one.
/* global THREE */

// ── IT OPENS ON A LINK. NOTHING IS ASKED OF ANYBODY. ─────────────
//
// The rig is OURS — every loft row, every weapon, every pose. The only
// things that ever came out of ARENA2 were three colour lookups, and
// paperdollPayload now has defaults of ours for all of them. So this
// page never puts up a picker and never blocks: it opens, and the
// figure is there.
//
// If the game's data is ALREADY stored — same origin, same IndexedDB,
// because you have played it in this browser — it is used, and you get
// the authentic palette and the face. That is a silent upgrade, not a
// requirement, and it is attempted with a timeout so a slow or empty
// store cannot hold the editor shut.
async function tryArena2() {
  try {
    const [{ getBytes }, { DFPalette }, { ImgFile }, { CifRciFile }] = await Promise.all([
      import('../scenes/dataSource.js'),
      import('../formats/dfPalette.js'),
      import('../formats/imgFile.js'),
      import('../formats/cifRciFile.js'),
    ]);
    const race = (p) => Promise.race([p, new Promise((_, no) => setTimeout(no, 4000))]);
    const pal = new DFPalette();
    pal.load(await race(getBytes('ART_PAL.COL')), 'ART_PAL.COL');
    const img = new ImgFile();
    img.load(await race(getBytes('BODY00I0.IMG')), 'BODY00I0.IMG', pal);
    let cif = null;
    try {
      cif = new CifRciFile();
      cif.load(await race(getBytes('FACE00I0.CIF')), 'FACE00I0.CIF', pal);
    } catch {
      cif = null; // the face is optional; the figure is not
    }
    return { pal, img, cif };
  } catch {
    return { pal: null, img: null, cif: null };
  }
}

const { pal, img, cif } = await tryArena2();
const D = buildPaperdollPayload(pal, img, cif);

const coreFn = makeCoreFn(D.bodyCore || [[1.5,0.2,0.1],[0,0.14,0.05]]);
const CLOTH_RAMP = D.cloth || [[60,50,40],[210,190,155]];
// per-frame snapped shading for simulated cloth (matches the baked look)
function shadeClothGeo(geo, mat) {
  const nrm = geo.attributes.normal.array, col = geo.attributes.color.array;
  const ramp = mat.ramp, sheen = mat.sheen||0, rim = mat.rim||0, N = ramp.length-1;
  const Lx=0.5, Ly=0.55, Lz=0.67, Ln=Math.hypot(Lx,Ly,Lz);
  let Hx=Lx/Ln, Hy=Ly/Ln, Hz=Lz/Ln+1; const Hl=Math.hypot(Hx,Hy,Hz); Hx/=Hl; Hy/=Hl; Hz/=Hl; // half-vector (light + view~+z)
  for (let i = 0; i < col.length; i += 3) {
    const nx=nrm[i], ny=nrm[i+1], nz=nrm[i+2];
    let it = (nx*Lx + ny*Ly + nz*Lz)/Ln * 0.9 + 0.2; it = Math.max(0.08, Math.min(1, it));
    const c = ramp[Math.max(0, Math.min(N, Math.round(it*N)))];
    let r=c[0], g=c[1], b=c[2];
    if (sheen) { let sp = nx*Hx + ny*Hy + nz*Hz; if (sp > 0) { sp = Math.pow(sp, 30)*sheen*255; r+=sp; g+=sp; b+=sp; } } // specular -> silk sheen
    if (rim)   { let rr = 1 - Math.max(0, nz); rr = rr*rr*rim*170; r+=rr*0.55; g+=rr*0.7; b+=rr; }                     // cool rim light
    col[i]=Math.min(255,r)/255; col[i+1]=Math.min(255,g)/255; col[i+2]=Math.min(255,b)/255;
  }
  geo.attributes.color.needsUpdate = true;
}
const S = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: S, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14141a);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
let fpMode = false;
const setFP = (on) => { fpMode = on; camera.fov = on ? 62 : 35; camera.near = on ? 0.10 : 0.01; camera.updateProjectionMatrix(); document.getElementById('fpv').textContent = 'view: ' + (on ? 'first person' : 'orbit'); };   // FP near 0.10: chest/arm surfaces inside it CLIP instead of rasterizing as a screen fill (lean-heavy clips pitch the torso toward the eye)
// ── pixelize post-pipeline: render the scene to a low-res target, then
// a fullscreen quad upscales it (nearest) and quantizes colour depth
// with a 4x4 ordered-dither so bands don't posterize flat.
let pixel = 9, levels = 0; // PIXELIZE STANDARD (Mac 2026-07-06, revised same day 9 -> 7; raised to 12 and then tried at 9 on 2026-08-18): 9x for the character and everything character-side; the WORLD is excluded (engine renders the character pass at CHAR_PIXEL, world untouched). The engine's constant moves WITH this one - a viewer that pixelates differently from the game is a viewer you cannot trust to show you the game.
const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: rt.texture }, res: { value: new THREE.Vector2(2, 2) }, levels: { value: 0 }, bg: { value: new THREE.Color(0x14141a) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: [
    'varying vec2 vUv; uniform sampler2D tex; uniform vec2 res; uniform float levels; uniform vec3 bg;',
    'float dither(vec2 p){ int x=int(mod(p.x,4.0)), y=int(mod(p.y,4.0)); int i=x+y*4;',
    '  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;',
    '  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;',
    '  float v=0.; for(int k=0;k<16;k++){ if(k==i) v=m[k]; } return v/16.0 - 0.5; }',
    'void main(){ vec4 t = texture2D(tex, vUv); vec3 c = t.rgb;',
    '  if(levels >= 1.0){ vec2 px = vUv*res; c += dither(px)/levels; c = floor(c*levels + 0.5)/levels; }',
    '  gl_FragColor = vec4(mix(bg, clamp(c,0.0,1.0), t.a), 1.0); }' // rig only; bg stays smooth
  ].join('\n'),
});
{ const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat); postScene.add(q); }

// Build geometry from the quantized face payload (quads -> 2 tris).
const nf = D.n;
const pos = new Float32Array(nf * 6 * 3);
const col = new Float32Array(nf * 6 * 3);
const nrm = new Float32Array(nf * 6 * 3);
const TRI = [0, 1, 2, 0, 2, 3];
let o = 0;
for (let f = 0; f < nf; f++) {
  const pb = f * 12, cb = f * 3, nb = f * 3;
  const r = D.C[cb] / 255, g = D.C[cb + 1] / 255, b = D.C[cb + 2] / 255;
  const nx = D.N[nb] / 127, ny = D.N[nb + 1] / 127, nz = D.N[nb + 2] / 127;
  for (const vi of TRI) {
    pos[o] = D.P[pb + vi * 3] / 1000;
    pos[o + 1] = D.P[pb + vi * 3 + 1] / 1000;
    pos[o + 2] = D.P[pb + vi * 3 + 2] / 1000;
    col[o] = r; col[o + 1] = g; col[o + 2] = b;
    nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz;
    o += 3;
  }
}
// Per-vertex limb group (6 verts/face) for animation, + base positions.
const vgrp = new Uint8Array(nf * 6);
for (let f = 0; f < nf; f++) for (let k = 0; k < 6; k++) vgrp[f*6+k] = D.G ? D.G[f] : 0;
const basePos = pos.slice();
// ── VILLAGER DESIGNS (editor only) ────────────────────────────────
// A design's zones DISPLACE the body's own faces and recolour them -
// they never add geometry - so each villager ships as a DELTA over
// this same face list: the indices that changed, their new corners,
// their new colour. Selecting one writes the delta over pristine
// copies; selecting "none" restores them. basePos is rewritten too,
// because the animator poses from it rather than from `pos`.
const pristinePos = pos.slice(), pristineCol = col.slice();
let villagerOn = null;
// ORDER MATTERS HERE. applyVillagerHair -> syncHair -> applyTone calls
// setBodyRamp, which repaints EVERY body face from the skin ramp - run
// it after the delta and the villager's clothes are wiped, leaving a
// nude body under a floating gown. So: reset, set the skin tone and
// hair the design asks for, and only THEN lay the garment delta over
// the top. Unchanged faces keep the tone; garment faces take the
// delta's colour, which is what both halves want.
function applyVillager(v) {
  pos.set(pristinePos); col.set(pristineCol);
  applyVillagerHair(v);
  if (v) {
    for (let k = 0; k < v.idx.length; k++) {
      const f = v.idx[k], pb = k * 12, cb = k * 3;
      const r = v.C[cb] / 255, g = v.C[cb + 1] / 255, b = v.C[cb + 2] / 255;
      let o = f * 18;
      for (const vi of TRI) {
        pos[o] = v.P[pb + vi * 3] / 1000;
        pos[o + 1] = v.P[pb + vi * 3 + 1] / 1000;
        pos[o + 2] = v.P[pb + vi * 3 + 2] / 1000;
        col[o] = r; col[o + 1] = g; col[o + 2] = b;
        o += 3;
      }
    }
  }
  basePos.set(pos);
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('color').needsUpdate = true;
  villagerOn = v;
  if (!v) { shownLine = null; shownIdx = -1; shownDesign = null; beastAtk = null; }
  // Anything that is not spectral is solid — including the bare rig, or
  // the ghost's transparency outlives the ghost.
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.blending = THREE.NormalBlending; // or the fire's blend outlives the fire
  mat.needsUpdate = true;
  applyVillagerDrape(v);
  // A VILLAGER WEARS WHAT THEIR DESIGN SAYS AND NOTHING ELSE.
  //
  // The pauldrons and the helm are separate toggleable meshes on the
  // dress-up rig, and selecting a villager was leaving them wherever
  // they happened to be — so a fishwife turned up in a helm because
  // somebody had switched one on ten minutes earlier.
  //
  // Every garment a villager owns arrives in their DELTA, including the
  // City watch's armour, which is the one design in twenty-five that
  // declares any. So the loose pieces come off for all of them. The orc
  // path already did exactly this for the same reason — 'an orc wears
  // neither'.
  //
  // Only while a villager is selected: with none, this is the tuning rig
  // again and the toggles are the whole point of it.
  if (v) setLoosePieces(false);
}

/** Show or hide the toggleable armour, and keep the buttons honest. */
function setLoosePieces(on) {
  for (const name of ['pauldrons', 'helm']) {
    const m = pieceMesh[name];
    if (!m) continue;
    m.visible = on;
    const btn = document.getElementById(name);
    if (btn) btn.classList.toggle('on', on);
  }
}
function setBodyColors(Carr) {
  if (!Carr) Carr = D.C;
  let o = 0;
  for (let f = 0; f < nf; f++) { const cb = f*3, r = Carr[cb]/255, g = Carr[cb+1]/255, b = Carr[cb+2]/255; for (let k = 0; k < 6; k++) { col[o]=r; col[o+1]=g; col[o+2]=b; o += 3; } }
  geo.getAttribute('color').needsUpdate = true;
}
function setBodyRamp(ramp) { let o = 0; for (let f = 0; f < nf; f++) { const c = snapRamp(ramp, D.Ib ? D.Ib[f] : 150); const r=c[0]/255,g=c[1]/255,b=c[2]/255; for (let k = 0; k < 6; k++) { col[o]=r; col[o+1]=g; col[o+2]=b; o += 3; } } geo.getAttribute('color').needsUpdate = true; }
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); // shading is baked into vertex colours
const mesh = new THREE.Mesh(geo, mat);
const pivot = new THREE.Group();
pivot.add(mesh);
mesh.position.y = -D.cy; // centre the model on the pivot

// snap a 0-255 intensity onto a ramp (dark->light).
function snapRamp(ramp, i255) { const t = Math.max(0, Math.min(1, i255/255)); const idx = Math.max(0, Math.min(ramp.length-1, Math.round(t*(ramp.length-1)))); return ramp[idx]; }
// ── ARMOR PIECES (separate toggleable meshes, same pivot) ──
function buildPiece(cp) {
  const ncf = cp.C.length / 3;
  const pp = new Float32Array(ncf*6*3), pc = new Float32Array(ncf*6*3), pn = new Float32Array(ncf*6*3), pg = new Uint8Array(ncf*6);
  let o = 0, gi = 0;
  for (let f = 0; f < ncf; f++) {
    const r = cp.C[f*3]/255, g = cp.C[f*3+1]/255, b = cp.C[f*3+2]/255;
    const nx = cp.N[f*3]/127, ny = cp.N[f*3+1]/127, nz = cp.N[f*3+2]/127;
    const grp = cp.G ? cp.G[f] : 0;
    const v = (k) => [cp.P[f*12+k*3]/1000, cp.P[f*12+k*3+1]/1000, cp.P[f*12+k*3+2]/1000];
    for (const [a,bb,c] of [[0,1,2],[0,2,3]]) for (const k of [a,bb,c]) {
      const P = v(k); pp[o]=P[0]; pp[o+1]=P[1]; pp[o+2]=P[2]; pc[o]=r; pc[o+1]=g; pc[o+2]=b; pn[o]=nx; pn[o+1]=ny; pn[o+2]=nz; o += 3; pg[gi++]=grp;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(pn, 3));
  const m = new THREE.Mesh(geo, mat); m.position.y = -D.cy; m.visible = true; pivot.add(m);
  animTargets.push({ pos: pp, base: pp.slice(), vgrp: pg, geo }); // moves with the body
  m.userData.recolor = (ramp) => { if (!cp.I) return; let oo = 0; for (let f = 0; f < ncf; f++) { const c = snapRamp(ramp, cp.I[f]); const r=c[0]/255,g=c[1]/255,b=c[2]/255; for (let k=0;k<6;k++){ pc[oo]=r; pc[oo+1]=g; pc[oo+2]=b; oo+=3; } } geo.getAttribute('color').needsUpdate = true; };
  return m;
}
// Animated targets: body + every piece mesh (same FK moves armour with the body).
const animTargets = [{ pos, base: basePos, vgrp, geo }];
const pieceMesh = {};
for (const name of ['pauldrons','helm']) if (D[name]) pieceMesh[name] = buildPiece(D[name]);
// ORC PIECES: one tusk pair and one brow per design, all built up front
// and hidden. Building them lazily on selection would drop a new mesh
// into animTargets mid-animation, and the animator holds a base-pose
// snapshot per target - a target that joins late has no snapshot for
// the frame in flight and snaps to rest for one tick.
// ── PIECES A DESIGN CARRIES OF ITS OWN ───────────────────────────
// The orcs have tusks and a brow; the skeleton has a ribcage and a
// pelvis. Same table, same build, same show-and-hide — a design's
// pieces are looked up by the design, so adding a fourth kind of bone
// to a fifth enemy means adding a key here and nothing else.
const PIECE_KINDS = ['tusks', 'brow', 'ribcage', 'pelvis', 'horse', 'beast', 'beastHead', 'beastTail', 'arachnid', 'horns', 'wings', 'fish', 'claws'];
const buildPieces = (list) =>
  (list || []).map((d) => {
    const out = {};
    for (const k of PIECE_KINDS) out[k] = d[k] ? buildPiece(d[k]) : null;
    // A SET OF POSES, NOT A MESH. The sting ships as five frames from
    // coiled to thrown and the attack clock picks one — a scorpion's
    // tail is the only part of it anybody watches, and welded into the
    // body it could only move when the body did.
    out.stingPoses = d.sting ? d.sting.map((p) => buildPiece(p)) : null;
    return out;
  });
const hidePieces = (table) => {
  for (const m of table) {
    for (const k of PIECE_KINDS) if (m[k]) m[k].visible = false;
    if (m.stingPoses) for (const p of m.stingPoses) p.visible = false;
  }
};
const showPieces = (table, i) => {
  const m = table[i];
  if (!m) return;
  for (const k of PIECE_KINDS) if (m[k]) m[k].visible = true;
  // Only ONE sting pose is ever visible: the coiled one, until it strikes.
  if (m.stingPoses) m.stingPoses.forEach((p, k) => (p.visible = k === 0));
};
// A TABLE PER LINE, LOOKED UP BY LINE. This was two hardcoded tables —
// orcs and undead — and adding `beast` to PIECE_KINDS was not enough:
// the beasts' piece was never BUILT, so three animals whose entire body
// is a piece rendered as nothing at all. The rig under them is
// collapsed, so there was not even a man left to see.
//
// Keyed now, so a new line gets its pieces by existing rather than by
// being remembered here.
const pieceTables = {
  orc: buildPieces(D.orcs),
  undead: buildPieces(D.undead),
  class: buildPieces(D.classes),
  atronach: buildPieces(D.atronachs),
  beast: buildPieces(D.beasts),
  daedra: buildPieces(D.daedra),
};
const orcPieceMesh = pieceTables.orc;
const undeadPieceMesh = pieceTables.undead;
for (const t of Object.values(pieceTables)) hidePieces(t);
const RACES = ['Human','Elf','Khajiit','Argonian']; let raceIx = 0;
const raceHair = {};
for (const R of RACES) {
  const packs = (D.hair && D.hair[R]) ? D.hair[R] : {};
  const styles = Object.keys(packs);
  raceHair[R] = { styles, meshes: {}, ix: 0 };
  for (const st of styles) { const m = buildPiece(packs[st]); m.visible = false; raceHair[R].meshes[st] = m; }
}
const curHair = () => { const h = raceHair[RACES[raceIx]]; return h && h.styles.length ? h.meshes[h.styles[h.ix]] : null; };
const tailMesh = D.tail ? buildPiece(D.tail) : null;
const tailCatMesh = D.tailCat ? buildPiece(D.tailCat) : null;
const bodyScalesMesh = D.bodyScales ? buildPiece(D.bodyScales) : null;
const drapedMeshes = {}, clothSims = {}; const DRAPES = ['None', ...(D.drapedNames||[])];
// Simulated (grid) drapes: real verlet cloth, pinned at the top row.
for (const nm in (D.drapeGrids||{})) {
  const g = D.drapeGrids[nm]; g.pos = Float32Array.from(g.pos);
  const cloth = buildCloth(g, nm.indexOf('Cloak') >= 0 ? 2 : 1);
  const tris = []; for (const f of g.faces) { tris.push(f[0],f[1],f[2], f[0],f[2],f[3]); }
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(cloth.pos);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cloth.V*3), 3));
  const mat = (D.drapeMaterials||{})[nm] || { ramp: CLOTH_RAMP, sheen: 0, rim: 0 };
  geo.setIndex(tris); geo.computeVertexNormals(); shadeClothGeo(geo, mat);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.position.y = -D.cy; m.visible = false; pivot.add(m);
  drapedMeshes[nm] = m; clothSims[nm] = { cloth, geo, posArr, mat };
}
// Static drapes (surcoat/toga/sash/wrap): simple panels, bob with the body.
for (const nm in (D.draped||{})) { const m = buildPiece(D.draped[nm]); m.visible = false; drapedMeshes[nm] = m; }
let drapeIx = 0;
const setDrape = () => { for (const nm in drapedMeshes) drapedMeshes[nm].visible = false; const cur = DRAPES[drapeIx]; if (cur !== 'None' && drapedMeshes[cur]) drapedMeshes[cur].visible = true; };
// ── VILLAGER DYE. A villager's hanging cloth is a drape name plus the
// design's OWN ART_PAL ramp, so picking one has to repaint the garment
// rather than leave it in draped.js's built-in DRAPE_MATERIAL colour.
// Two kinds of drape, two repaint paths: a simulated one is reshaded
// from cs.mat every frame, so swapping the ramp on the material is
// enough; a static panel is baked, so it goes through the pack's own
// recolor(), which re-snaps each face's stored intensity.
const drapeBaseRamp = {};
for (const nm in clothSims) drapeBaseRamp[nm] = clothSims[nm].mat.ramp;
for (const nm in drapedMeshes) if (!clothSims[nm]) drapeBaseRamp[nm] = ((D.drapeMaterials||{})[nm] || {}).ramp || CLOTH_RAMP;
function dyeDrape(nm, ramp) {
  const use = ramp || drapeBaseRamp[nm];
  if (!use) return;
  if (clothSims[nm]) { clothSims[nm].mat = Object.assign({}, clothSims[nm].mat, { ramp: use }); return; }
  const m = drapedMeshes[nm];
  if (m && m.userData.recolor) m.userData.recolor(use);
}
// A design also names a HAIRSTYLE and a hair colour, so selecting a
// villager drives those controls the same way. The hair packs are all
// baked brown at build time; recolour() re-snaps each face's stored
// intensity onto the design's ramp, which is exactly the drape's
// static path.
function applyVillagerHair(v) {
  // The design's RACE picks a skin tone out of the human palette; the
  // rig race stays Human (Redguard/Nord/Breton all are). Deselecting
  // restores the viewer's own tone rather than stranding the last
  // villager's.
  if (v && v.tone) {
    const pal = (D.PALETTES || {})[PKEY.Human] || [];
    const ti = pal.findIndex((e) => e.name === v.tone);
    if (ti >= 0) { raceIx = RACES.indexOf('Human'); toneIx.Human = ti; }
  } else if (!v) { toneIx.Human = 0; }
  { const pal = (D.PALETTES || {})[PKEY[RACES[raceIx]]]; const b = document.getElementById('tone');
    if (pal && b) b.textContent = 'tone: ' + pal[toneIx[RACES[raceIx]] % pal.length].name; }
  const h = raceHair[RACES[raceIx]];
  if (!h || !h.styles.length) { applyTone(); return; }
  const ramps = D.hairRamps || {};
  const want = v && v.hair && h.styles.indexOf(v.hair.style);
  if (want >= 0) h.ix = want;
  const ramp = (v && v.hair && ramps[v.hair.ramp]) || ramps.brown;
  if (ramp) for (const st of h.styles) { const m = h.meshes[st]; if (m && m.userData.recolor) m.userData.recolor(ramp); }
  syncHair();
  refreshHairLabel();
}
// Selecting a villager DRIVES the drape control: their gown is part of
// the design, not a separate toggle the reader has to find.
// ═══════════════════════════════════════════════════════════════════
// A DRAPE HAS TO FIT WHO IS WEARING IT
//
// Every garment is carved ONCE at one size and shared by every design
// that asks for it, which is what keeps the payload small — so the fit
// is a scale applied to the mesh.
//
// THE SCALE IS MEASURED, NOT GUESSED, and it is measured where the body
// and the garment are both in hand: at build time, in
// characters/paperdollPayload.js, and shipped on the drape.
//
// It used to be computed here from `torso * 0.75 + shoulder * 0.25`,
// which is a guess from two build keys and ignores the thing that
// actually decides the answer — ARMS HANG OUTSIDE THE TORSO. Measured
// across every drape-wearing design, 669 rows were clipping and every
// single one was an arm: a lich's stuck 111% beyond its own robe, and
// the guess had cut that robe at 0.657 where the body needed 1.404.
//
// GIRTH ONLY. The rig's own law is that Y is never touched — every
// exported constant on it is a HEIGHT — so scaling a garment vertically
// would drop its hem through the floor on a giant and hitch it to the
// knee on a lich.
function fitDrape(design) {
  // THE GARMENT IS SIZED FOR THE BODY, NOT FOR THE ARMS.
  //
  // I had this scaling to the widest row the body needs, which is the
  // arms, always — and it made every robe a tent. Mac's words: oversized
  // and ugly, and much worse than what it replaced. He was right: I
  // traded a subtle fault for an obvious one, which is the wrong
  // direction even when the subtle fault is real.
  //
  // A robe is cut for a torso. Arms hang at the sides of it and always
  // have; what must not happen is cloth passing through a CHEST or a
  // HIP, and that is what the fit measures now — the trunk only, with
  // the limbs left to hang where limbs hang.
  const fit = design && design.drape ? design.drape.fit : null;
  const k = Array.isArray(fit) && fit.length ? Math.max(...fit) : typeof fit === 'number' ? fit : 1;
  // GIRTH ONLY. Every exported constant on this rig is a HEIGHT, so
  // widening a garment vertically would drop its hem through the floor.
  for (const nm in drapedMeshes) drapedMeshes[nm].scale.set(k, 1, k);
}


function applyVillagerDrape(v) {
  for (const nm in drapeBaseRamp) dyeDrape(nm, null);   // undye whatever the last villager dyed
  const want = v && v.drape ? DRAPES.indexOf(v.drape.name) : (v ? 0 : drapeIx);
  if (want >= 0) drapeIx = want;
  setDrape();
  if (v && v.drape && want >= 0) dyeDrape(v.drape.name, v.drape.ramp);
  fitDrape(v);
  const btn = document.getElementById('drape');
  if (btn) btn.textContent = 'drape: ' + DRAPES[drapeIx];
}
// step the visible simulated cloth from the animation state
// Articulated collider (bent legs + swinging arms) for the current gait,
// using the rig's real joint heights + measured limb radii.
//
// ankleY comes from ACTX. It used to read a bare `ankL`, which is a
// LOCAL inside createAnimContext and has never existed in this scope -
// so drapeColliders threw a ReferenceError the first time any
// simulated drape was selected, and every drape in DRAPED_NAMES is
// simulated. The cloth never stepped and never reshaded. Exposing the
// ankle on the context is the fix; it was already measured there.
function drapeColliders(phase, motion, bob, L) {
  L = L || WALK;
  const walking = motion > 0.5, sA = L.strideAmp, kA = L.kneeAmp, kb = L.kneeBase;
  const legL = walking ? { sw: -sA*Math.sin(phase),         bd: kb + kA*Math.max(0, Math.sin(phase+1.2)) }         : { sw: 0, bd: 0 };
  const legR = walking ? { sw: -sA*Math.sin(phase+Math.PI), bd: kb + kA*Math.max(0, Math.sin(phase+Math.PI+1.2)) } : { sw: 0, bd: 0 };
  // capsules follow bob (leg mesh does too); bone-drive gets rest joints + bob separately
  const caps = articulatedCapsules({ legX: 0.082, hipY: hipY+bob, kneeY: kneeY+bob, ankleY: ankleY+bob, legR: [0.115, 0.10, 0.075] }, { legL, legR });
  const bones = { legX: 0.082, hipY, kneeY, ankleY, legL, legR, bob, strength: 0.85 };
  return { caps, bones };
}
function stepDrapeCloth(phase, motion, bob, L) {
  const cur = DRAPES[drapeIx]; const cs = clothSims[cur]; if (!cs) return;
  const col = drapeColliders(phase, motion, bob, L);
  const isCloak = cur.indexOf('Cloak') >= 0;   // cloaks hang from the shoulders, not the legs - free cloth, no bone-drive
  const shoulderDrape = isCloak || cur === 'Wrap' || cur === 'Sash';   // hang from the upper body, not the legs
  // bone-drive makes the lower drape follow the legs; capsule collision (last) guarantees no clip
  const lean = (motion > 0.5 && L) ? L.lean : 0;
  const rp = effectivePose() || {};
  const leanAll = lean + (rp.lean || 0);   // pins follow the FULL torso lean (gait + pose + attack), not just the gait's
  const opts = { gy: -7, gx: motion * 0.3 * Math.sin(phase), gz: -motion * 0.9, pinDY: bob, lean: leanAll, leanPivot: hipY + 0.10, iters: 10, damp: 0.90, maxStep: 0.04, groundY: 0.02,
    rootX: rp.rootX || 0, rootY: rp.rootY || 0, rootZ: rp.rootZ || 0,
    capsules: shoulderDrape ? (motion > 0.5 ? col.caps : null) : col.caps, bones: shoulderDrape ? null : col.bones };
  stepCloth(cs.cloth, 1/60, opts, coreFn);
  stepCloth(cs.cloth, 1/60, opts, coreFn); // 2 substeps for stability
  cs.posArr.set(cs.cloth.pos); cs.geo.attributes.position.needsUpdate = true;
  cs.geo.computeVertexNormals(); shadeClothGeo(cs.geo, cs.mat);
}
const bodyFurCoat = D.bodyFurCoat ? buildPiece(D.bodyFurCoat) : null;
const bodyFurBelly = D.bodyFurBelly ? buildPiece(D.bodyFurBelly) : null;
// weapon registry: every entry rides the armL chain (held) and shares
// the material ramps, the seat sliders and the stats line.
const WEAPON_DEFS = D.weaponPacks;   // registry-driven: every Daggerfall weapon
for (const w of WEAPON_DEFS) {
  w.mesh = w.pack ? buildPiece(w.pack) : null;
  if (!w.mesh) continue;
  w.mesh.visible = false;
  w.T = animTargets[animTargets.length - 1];
  w.T.held = true; // rigid in the grip
  w.fit0 = { base: w.T.base.slice(), nrm: w.mesh.geometry.getAttribute('normal').array.slice() };
}
let wpnIx = 0;
const activeWpn = () => WEAPON_DEFS[wpnIx];
const swordMesh = WEAPON_DEFS[0].mesh;   // legacy alias
// THE ARROW: its own held target - nocked it rides the chain like
// the bow; on the verbatim bow HIT frame it looses into straight
// flight at MISSILE_SPEED (DaggerfallMissile.MovementSpeed - the one
// home, AUDIT 23) along its own axis, then despawns
// and re-nocks on the next draw.
const arrowMesh = buildPiece(D.arrow);
arrowMesh.visible = false;
const arrowT = animTargets[animTargets.length - 1];
arrowT.held = true;
let arrowFlight = null;   // { dir, d, snap }
let arrowHidden = false;  // between despawn and the next draw
const ARROW_RANGE = 28;
const arrowVisible = () => { arrowMesh.visible = !!arrowFlight || (activeWpn().hands === 'bow' && !arrowHidden); };   // a FLYING arrow is world state - weapon switches must not vanish it mid-air
let swordT = WEAPON_DEFS[0].T, swordFit0 = WEAPON_DEFS[0].fit0;
const swordFit = { pitch: 0, dy: 0, dz: 0 };
// Adjust the sword's seat IN the hand (Mac): pitch about the GRIP
// POINT (y 0.81 post-HSCALE, z 0 - invariant under the mesh's grip
// bake) + fore/aft + up/down offsets. Rewrites the animTarget BASE
// and the normals; every pose/gait/attack transform then carries the
// adjusted seat for free.
function applySwordFit() {
  const w = activeWpn(); if (!w.T) return;
  const B = w.T.base, B0 = w.fit0.base;
  const N = w.mesh.geometry.getAttribute('normal').array, N0 = w.fit0.nrm;
  const gY = 0.81, c = Math.cos(swordFit.pitch), s = Math.sin(swordFit.pitch);
  for (let i = 0; i < B.length; i += 3) {
    const dy = B0[i+1] - gY, z = B0[i+2];
    B[i] = B0[i];
    B[i+1] = gY + c*dy - s*z + swordFit.dy;
    B[i+2] = s*dy + c*z + swordFit.dz;
  }
  for (let i = 0; i < N.length; i += 3) {
    const ny = N0[i+1], nz = N0[i+2];
    N[i] = N0[i]; N[i+1] = c*ny - s*nz; N[i+2] = s*ny + c*nz;
  }
  swordMesh.geometry.getAttribute('normal').needsUpdate = true;
}
window.__swordFit = (pitch, dy, dz) => { swordFit.pitch = pitch; swordFit.dy = dy; swordFit.dz = dz; applySwordFit(); };
if (bodyScalesMesh) bodyScalesMesh.visible = false;
if (bodyFurCoat) bodyFurCoat.visible = false;
if (bodyFurBelly) bodyFurBelly.visible = false;
if (tailMesh) tailMesh.visible = false;
if (tailCatMesh) tailCatMesh.visible = false;
const helmOn = () => !!(pieceMesh.helm && pieceMesh.helm.visible);
const PKEY = { Human:'human', Elf:'elf', Khajiit:'khajiit', Argonian:'argonian' };
const toneIx = { Human:0, Elf:0, Khajiit:0, Argonian:0 };
function applyTone() {
  const R = RACES[raceIx], pal = (D.PALETTES||{})[PKEY[R]]; if (!pal) return;
  const e = pal[toneIx[R] % pal.length];
  if (R === 'Khajiit') {
    setBodyRamp(e.coat);
    if (bodyFurCoat) bodyFurCoat.userData.recolor(e.coat);
    if (bodyFurBelly) bodyFurBelly.userData.recolor(e.belly);
    if (tailCatMesh) tailCatMesh.userData.recolor(e.coat);
    { const h = curHair(); if (h) h.userData.recolor(e.coat); }
  } else if (R === 'Argonian') {
    setBodyRamp(e.ramp);
    if (bodyScalesMesh) bodyScalesMesh.userData.recolor(e.ramp);
    if (tailMesh) tailMesh.userData.recolor(e.ramp);
    { const h = curHair(); if (h) h.userData.recolor(e.ramp); }
  } else {
    setBodyRamp(e.ramp); // Human / Elf skin tone
  }
}
const syncHair = () => { const R = RACES[raceIx]; applyTone(); for (const rr of RACES) { const h = raceHair[rr]; if (h) for (const st of h.styles) h.meshes[st].visible = false; } const m = curHair(); if (m) m.visible = !helmOn(); if (tailMesh) tailMesh.visible = (RACES[raceIx] === 'Argonian'); if (tailCatMesh) tailCatMesh.visible = (RACES[raceIx] === 'Khajiit'); if (bodyScalesMesh) bodyScalesMesh.visible = (RACES[raceIx] === 'Argonian'); if (bodyFurCoat) bodyFurCoat.visible = (RACES[raceIx] === 'Khajiit'); if (bodyFurBelly) bodyFurBelly.visible = (RACES[raceIx] === 'Khajiit'); }; // per-race body detail
syncHair();
scene.add(pivot);

scene.add(new THREE.HemisphereLight(0xffffff, 0x40404a, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(1, 1.4, 1.2); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-1, 0.5, -0.8); scene.add(fill);

// ── WALK CYCLE (engine WALK_LOCO from rewrite/rig/poseTables.js) ──
// Locomotion dials (informed by poseTables RUN_LOCO/WALK_LOCO). Run leans
// the torso hard, lifts the knees high, holds the elbows bent ~80deg, and
// bounces (big bob) at nearly double cadence.
// Loco dials, rot helpers, joint constants and the core animateTarget
// now live in src/characters/animate.js (inlined above) - the engine
// consumes the same module. The template binds a context and keeps a
// THREE adapter so every existing call site (and probe) is unchanged.
const ACTX = createAnimContext({ basePos, vgrp, armX: D.armX, wristY: D.wristY, neckY: D.neckY });

// ── ORC LINE picker (editor only) ────────────────────────────────
// An orc is the SAME delta mechanism as a villager (build girth moves
// the rig's own faces, adds none), so it reuses applyVillager's path
// for the body and adds its two authored pieces on top.
//
// The two pickers are MUTUALLY EXCLUSIVE. They write the same face
// list from the same pristine copy, so leaving one selected while the
// other applies would show a villager's gown stretched over a
// warlord's ribcage - whichever wrote last wins per face, and the
// result is neither design.
let orcOn = null;
function applyOrc(o) {
  for (const t of Object.values(pieceTables)) hidePieces(t);
  orcOn = o;
  if (!o) { applyVillager(null); return; }
  // Hide the human head furniture: an orc wears neither.
  const hs = document.getElementById('hairstyle');
  applyVillager(null);
  for (const rr of RACES) { const h = raceHair[rr]; if (h) for (const st of h.styles) h.meshes[st].visible = false; }
  setLoosePieces(false); // an orc wears neither. See applyVillager.
  // Body: repaint to the orc hide first (setBodyRamp touches EVERY body
  // face), THEN lay the delta over it - same ordering hazard the
  // villager path documents above.
  if (o.hide) setBodyRamp(o.hide);
  for (let k = 0; k < o.idx.length; k++) {
    const f = o.idx[k], pb = k * 12, cb = k * 3;
    const r = o.C[cb] / 255, g = o.C[cb + 1] / 255, b = o.C[cb + 2] / 255;
    let oo = f * 18;
    for (const vi of TRI) {
      pos[oo] = o.P[pb + vi * 3] / 1000;
      pos[oo + 1] = o.P[pb + vi * 3 + 1] / 1000;
      pos[oo + 2] = o.P[pb + vi * 3 + 2] / 1000;
      col[oo] = r; col[oo + 1] = g; col[oo + 2] = b;
      oo += 3;
    }
  }
  basePos.set(pos);
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('color').needsUpdate = true;
  // ── SPECTRAL ────────────────────────────────────────────────────
  // A ghost is not a shape, it is an ABSENCE, and the character path had
  // never been asked for a material property before — every enemy until now
  // said what it was with geometry and colour. This is the one that
  // cannot: what makes a ghost a ghost is that you see through it.
  //
  // The body material is shared by every design, so it is switched here
  // rather than rebuilt, and switched BACK for everything else — leave
  // it transparent and the next orc you pick is a see-through orc.
  const spec = o && o.spectral;
  mat.transparent = !!spec;
  mat.opacity = spec ? spec.opacity : 1;
  mat.depthWrite = !spec; // a translucent body must not occlude its own far side
  // FIRE IS NOT A COLOUR, IT IS A LIGHT. A ghost SUBTRACTS itself from
  // what is behind it; a flame ADDS to it. Same material, opposite
  // blend, and an orange body without this reads as a painted man
  // rather than a burning one.
  mat.blending = spec && spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  mat.needsUpdate = true;

  // Whichever line this design came from, show ITS pieces. The line is
  // carried on the design rather than guessed by searching every table,
  // which is what let a whole line go unbuilt without anything noticing.
  const line = o.line || 'orc';
  const list = { orc: D.orcs, undead: D.undead, class: D.classes, atronach: D.atronachs, beast: D.beasts, daedra: D.daedra }[line];
  const idx = (list || []).findIndex((x) => x.id === o.id);
  if (idx >= 0 && pieceTables[line]) showPieces(pieceTables[line], idx);
  // Remembered so the frame loop can move THIS design's pieces when it
  // attacks — an armless enemy moves its whole body, and the body is a
  // piece.
  shownLine = idx >= 0 ? line : null;
  shownIdx = idx;
  shownDesign = o;
  // AND IT MAY BE WEARING SOMETHING. applyVillagerDrape asks only for a
  // `.drape`, so a lich in robes goes through the code that already
  // dresses a villager's gown — the composition costs nothing because
  // the two systems never actually needed to know about each other.
  // PASS THE DESIGN, NOT NULL. `applyVillagerDrape(null)` means "no
  // design is selected, so leave the drape control where the user put
  // it" — which is right for the bare rig, where cycling garments is the
  // whole point, and absurd for an enemy. Handing it null for every
  // design that has no drape meant a bat wore whatever garment happened
  // to be showing: cycle the control to a skirt, pick an animal, and the
  // animal is in a skirt.
  //
  // Passing the design makes it say NONE, because a design with no drape
  // is a design that wears nothing. Same rule the loose armour pieces
  // got: what a design wears is what its design says and nothing else.
  applyVillagerDrape(o);
  if (hs) hs.textContent = 'hair: none (' + (o.line || 'orc') + ')';
}

// ── THE UNDEAD USE THE SAME PATH ─────────────────────────────────
// Zombie and Mummy are the same delta over the same face list with no
// geometry of their own, so they go through applyOrc rather than
// getting a near-identical copy of it. The one orc-specific step —
// showing that design's tusks and brow — finds nothing for them and
// does nothing, which is the correct behaviour rather than a special
// case: an undead simply has no pieces.
function applyUndead(u) {
  applyOrc(u ? { ...u, line: 'undead' } : null);
}
{
  const sel = document.getElementById('daedra');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'daedra: none (bare rig)';
    sel.appendChild(none);
    for (const dd of D.daedra || []) {
      const opt = document.createElement('option');
      opt.value = String(dd.id);
      opt.textContent = dd.name + '  (lvl ' + dd.level + ')';
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const dd = (D.daedra || []).find((x) => String(x.id) === sel.value) || null;
      for (const other of ['orc', 'undead', 'villager', 'classes', 'atronach', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyOrc(dd ? { ...dd, line: 'daedra' } : null);
      const hud = document.getElementById('hud');
      if (hud && dd) hud.textContent = dd.name + ' \u00b7 level ' + dd.level + ' \u00b7 ' + dd.damage[0] + '-' + dd.damage[1] + ' damage';
    };
  }
}
{
  const sel = document.getElementById('beast');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'beast: none (bare rig)';
    sel.appendChild(none);
    for (const bst of D.beasts || []) {
      const opt = document.createElement('option');
      opt.value = String(bst.id);
      opt.textContent = bst.name + '  (lvl ' + bst.level + ')';
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const bst = (D.beasts || []).find((x) => String(x.id) === sel.value) || null;
      for (const other of ['orc', 'undead', 'villager', 'classes', 'atronach', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyOrc(bst ? { ...bst, line: 'beast' } : null);
      const hud = document.getElementById('hud');
      if (hud && bst) hud.textContent = bst.name + ' \u00b7 level ' + bst.level + ' \u00b7 ' + bst.damage[0] + '-' + bst.damage[1] + ' damage';
    };
  }
}
{
  const sel = document.getElementById('atronach');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'atronach: none (bare rig)';
    sel.appendChild(none);
    for (const a of D.atronachs || []) {
      const opt = document.createElement('option');
      opt.value = String(a.id);
      opt.textContent = a.name;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const a = (D.atronachs || []).find((x) => String(x.id) === sel.value) || null;
      for (const other of ['orc', 'undead', 'villager', 'classes', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyOrc(a ? { ...a, line: 'atronach' } : null);
      const hud = document.getElementById('hud');
      // All four are level 16 with the same damage band: the game tells
      // them apart by element and by nothing else.
      if (hud && a) hud.textContent = a.name + ' \u00b7 level 16 \u00b7 5-15 damage (all four are)';
    };
  }
}
{
  const sel = document.getElementById('classes');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'class: none (bare rig)';
    sel.appendChild(none);
    for (const c of D.classes || []) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      // THEY SCALE WITH THE PLAYER, so there is no level to print. A
      // made-up number here would be a lie about the game's own rules.
      opt.textContent = c.name + '  (scales)';
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const c = (D.classes || []).find((x) => String(x.id) === sel.value) || null;
      for (const other of ['orc', 'undead', 'villager', 'atronach', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyOrc(c ? { ...c, line: 'class' } : null);
      const hud = document.getElementById('hud');
      if (hud && c) hud.textContent = c.name + ' \u00b7 scales to the player';
    };
  }
}
{
  const sel = document.getElementById('undead');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'undead: none (bare rig)';
    sel.appendChild(none);
    for (const u of D.undead || []) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = u.name + '  (lvl ' + u.level + ', ' + u.damage[0] + '-' + u.damage[1] + ')';
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const u = (D.undead || []).find((x) => String(x.id) === sel.value) || null;
      // The three pickers are exclusive: one body at a time.
      for (const other of ['orc', 'villager', 'classes', 'atronach', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyUndead(u);
      const hud = document.getElementById('hud');
      if (hud && u) hud.textContent = u.name + ' \u00b7 level ' + u.level + ' \u00b7 ' + u.damage[0] + '-' + u.damage[1] + ' damage';
    };
  }
}
{
  const sel = document.getElementById('orc');
  if (sel) {
    const none = document.createElement('option');
    none.value = ''; none.textContent = 'orc: none (bare rig)';
    sel.appendChild(none);
    for (const o of (D.orcs || [])) {
      const opt = document.createElement('option');
      opt.value = String(o.id);
      opt.textContent = o.name + '  (lvl ' + o.level + ', ' + o.damage[0] + '-' + o.damage[1] + ' dmg)';
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const o = (D.orcs || []).find((x) => String(x.id) === sel.value) || null;
      const vsel = document.getElementById('villager');
      if (o && vsel) vsel.value = '';   // the two pickers are exclusive
      applyOrc(o);
      const hud = document.getElementById('hud');
      if (hud) hud.textContent = o
        ? o.name + ' \u00b7 MobileType ' + o.id + ' \u00b7 lvl ' + o.level + ' \u00b7 ' + o.damage[0] + '-' + o.damage[1] + ' dmg \u00b7 weapon tier ' + o.weaponTier
        : 'NEUTRAL POSE prototype \u00b7 drag to rotate \u00b7 pinch to zoom';
    };
  }
}

// villager picker: grouped by race so the roster reads as a town
{
  const sel = document.getElementById('villager');
  const none = document.createElement('option');
  none.value = ''; none.textContent = 'villager: none (bare rig)';
  sel.appendChild(none);
  const byRace = {};
  for (const v of (D.villagers || [])) (byRace[v.race] ||= []).push(v);
  for (const [race, list] of Object.entries(byRace)) {
    const g = document.createElement('optgroup');
    g.label = race;
    for (const v of list) {
      const o = document.createElement('option');
      o.value = String(v.archive);
      o.textContent = v.archive + '  ' + v.name + '  (' + v.gender + ', ' + v.build + ')';
      g.appendChild(o);
    }
    sel.appendChild(g);
  }
  sel.onchange = () => {
    const v = (D.villagers || []).find((x) => String(x.archive) === sel.value) || null;
    if (v) { const osel = document.getElementById('orc'); if (osel) osel.value = ''; applyOrc(null); }
    applyVillager(v);
    const hud = document.getElementById('hud');
    if (hud) hud.textContent = v
      ? v.name + ' \u00b7 ' + v.race + ' ' + v.gender + ' \u00b7 archive ' + v.archive + ' \u00b7 ' + v.build + ' build'
      : 'NEUTRAL POSE prototype \u00b7 drag to rotate \u00b7 pinch to zoom';
  };
}
const { hipY, shoulderY, kneeY, elbowY, wristY, armRootX, ankleY } = ACTX;
let gaitIx = 0, wt = 0;   // 0 idle, 1 walk, 2 run
// arm/hand posing tuner (radians): applied to the rest stance at idle.
const armTune = { pitch: 0, spread: 0, elbow: 0, hand: 0, handPitch: 0, handYaw: 0 };
function poseArms(T) {
  const P = T.pos, B = T.base, VG = T.vgrp;
  const held = !!T.held;   // a gripped rigid object: EVERY vert is "in the hand" - no per-height joint cuts splitting it
  for (let i=0;i<VG.length;i++) { const g = VG[i], o = i*3;
    if (g === 2 || g === 3) {
      let x = B[o], y = B[o+1], z = B[o+2]; const by = y, rootX = armRootX[g], mir = g === 2 ? -1 : 1; // by: joint gates use REST y - the pitch mutates y and a moved vert must not change joints mid-chain
      const wpx = g === 2 ? -D.armX : D.armX;   // hand pivots live on the FOREARM AXIS - a centroid pivot (outer thumb pulls it ~0.011 wide) translates the wrist ring off the arm
      if (armTune.hand      && (held || by < wristY)) [x,z] = rotY(x, z, wpx, 0, mir * armTune.hand); // hand roll about the forearm axis (mirrored)
      if (armTune.handPitch && (held || by < wristY)) [y,z] = rotX(y, z, wristY, armTune.handPitch);            // hand pitch (flex/extend about the wrist)
      if (armTune.handYaw   && (held || by < wristY)) [x,y] = rotZ(x, y, wpx, wristY, mir * armTune.handYaw); // hand yaw (side wave, mirrored)
      if (armTune.elbow  && (held || by < elbowY)) [y,z] = rotX(y, z, elbowY, -armTune.elbow);   // elbow flex FORWARD
      if (armTune.pitch)  [y,z] = rotX(y, z, shoulderY, armTune.pitch);                  // shoulder fore/aft
      if (armTune.spread) [x,y] = rotZ(x, y, rootX, shoulderY, mir * armTune.spread);    // abduction (mirrored)
      P[o]=x; P[o+1]=y; P[o+2]=z;
    } else { P[o]=B[o]; P[o+1]=B[o+1]; P[o+2]=B[o+2]; }
  }
  T.geo.attributes.position.needsUpdate = true;
}
const animateTarget = (T, wt, L, bob, pose, moving) => { animateTargetCore(ACTX, T, wt, L, bob, pose, moving); T.geo.attributes.position.needsUpdate = true; T.dirty = false; };   // THREE adapter over the extracted core (signature unchanged for every call site + probe)
// Secondary cloth motion, DRIVEN BY the animation state. Inputs are the
// motion phase (the gait cycle when walking, an ambient clock at rest)
// and a motion factor 0..1; a future state (run, sit, ...) just feeds a
// different phase/factor. The fabric LAGS the body - each vertex trails
// by an amount proportional to how far it hangs (flowW) so a wave ripples
// down the cloth - swings fore/aft with the step, and billows back.
let ambientT = 0; const GAITS = [null, WALK, RUN];
const POSE_NAMES = ['none', ...Object.keys(D.poses || {})];
let poseIx = 0;
const curPose = () => (poseIx ? D.poses[POSE_NAMES[poseIx]] : null);
// ---- attack playback: a running clip layers DELTAS over the active
// pose (arms fully owned by the clip - gait pump + runElbow suppressed
// mid-strike), twist/lean/headPitch add on. Legs stay with the gait.
let atk = null;   // { clip, t }

// ── AN ATTACK FOR A BODY WITH NO ARMS ────────────────────────────
// The nine armless enemies collapse their arm groups to a POINT, so the
// authored 1H strike clips animate nothing: the timer fires, the hit
// lands, the damage applies, and the bear does not move. For these the
// motion belongs to the whole animal, because there are no joints to
// turn — see characters/beastAttack.js.
let shownLine = null;
let shownIdx = -1;
let shownDesign = null;
let beastAtk = null; // { kind, t, dur, hit }
const fireBeastAttack = (design) => {
  if (!design || !design.attack) return false;
  beastAtk = { kind: design.attack, t: 0, dur: 0.62, hit: hitPointOf(design.attackFrames) };
  return true;
};
// DFU-VERBATIM TIMING: the weapon machine owns WHEN (frames, ticks,
// hit moments, bow draw-hold, cooldown); the rig clips are the
// VISUAL. Clip time = machine progress mapped onto clip duration.
let wm = null;            // active weapon machine
let liveSpeed = 50;       // player SPD (classic default); drives the tick formula
const BOW_ANCHOR_U = 0.50;   // the Release clip's held-anchor key
const machineFrames = () => (wm.isBow ? BOW_NUM_FRAMES : MELEE_NUM_FRAMES)[wm.state] ?? 5;
const machineClipU = () => {
  if (!wm || wm.state === 'Idle') return null;
  const tick = wm.isBow ? CLASSIC_UPDATE_INTERVAL : getMeleeWeaponAnimTime(liveSpeed);
  if (wm.isBow) {
    if (wm.state === 'StrikeUp') return Math.min(BOW_ANCHOR_U, ((Math.min(wm.frame, 3)) + Math.min(wm.acc / tick, 1)) / 3 * BOW_ANCHOR_U);
    return Math.min(0.9999, BOW_ANCHOR_U + ((wm.frame - 3) + wm.acc / tick) / 3 * (1 - BOW_ANCHOR_U));
  }
  return Math.min(0.9999, (wm.frame + wm.acc / tick) / machineFrames());
};
const ZERO_ARM = { sw: 0, bd: 0, spread: 0, handRoll: 0, handPitch: 0, handYaw: 0 };
function effectivePose() {
  const base = curPose();
  if (!atk) return base;
  const d = sampleClip(atk.clip, atk.t);
  if (!d) { atk = null; return base; }
  const b = base || { lean: 0, armL: ZERO_ARM, armR: ZERO_ARM };
  const limb = (k, zero) => { const has = b[k] || d[k]; if (!has) return b[k]; const o = { ...(b[k] || zero) }; const dd = d[k]; if (dd) for (const c in dd) o[c] = (o[c] || 0) + dd[c]; return o; };
  return { ...b, gaitArm: 0, gaitElbow: 0, runElbow: 0,
    lean: (b.lean || 0) + (d.lean || 0), twist: (b.twist || 0) + (d.twist || 0), headPitch: (b.headPitch || 0) + (d.headPitch || 0),
    rootX: (b.rootX || 0) + (d.rootX || 0), rootY: (b.rootY || 0) + (d.rootY || 0), rootZ: (b.rootZ || 0) + (d.rootZ || 0),
    armL: limb('armL', ZERO_ARM), armR: limb('armR', ZERO_ARM),
    legL: limb('legL', { sw: 0, bd: 0 }), legR: limb('legR', { sw: 0, bd: 0 }) };
}
function animate(dt) {
  if (wm) {   // the machine clock runs EVERY frame - cooldowns must expire while idle (it froze after 'done' and locked bows after one shot)
    const evs = machineStep(wm, dt, liveSpeed);
    for (const e of evs) {
      if (e === 'hit') { swordInfo.textContent = 'HIT (frame ' + (wm.isBow ? HIT_FRAME_BOW : HIT_FRAME_MELEE) + ')';
        if (wm.isBow && arrowMesh.visible) {   // LOOSE: the arrow leaves the string (DFU spawns the missile at the hit frame)
          let hx=0,hy=0,hz=0,hn=0,tx=0,ty=0,tz=0,tn=0;
          for (let i=0;i<arrowT.vgrp.length;i++){ const by=arrowT.base[i*3+1];
            if (Math.hypot(arrowT.base[i*3]+0.235,by-0.594,arrowT.base[i*3+2])<0.03){hx+=arrowT.pos[i*3];hy+=arrowT.pos[i*3+1];hz+=arrowT.pos[i*3+2];hn++;}
            if (by>1.02){tx+=arrowT.pos[i*3];ty+=arrowT.pos[i*3+1];tz+=arrowT.pos[i*3+2];tn++;} }
          const dir=[hx/hn-tx/tn, hy/hn-ty/tn, hz/hn-tz/tn]; const L=Math.hypot(...dir);
          arrowFlight = { dir: [dir[0]/L, dir[1]/L, dir[2]/L], d: 0, snap: arrowT.pos.slice() };
        } }
      if (e === 'bowSound') swordInfo.textContent = 'loose (sound frame ' + BOW_SOUND_FRAME + ')';
      if (e === 'undraw') swordInfo.textContent = 'held past ' + MAX_BOW_HELD_DRAWN_SECONDS + 's: un-drawn';
      if (e === 'done') swordInfo.textContent = wm.isBow ? ('cooldown ' + getBowCooldownTime(liveSpeed).toFixed(2) + 's') : '';
    }
    if (atk && !atk.free) { const u = machineClipU(); if (u === null) atk = null; else atk.t = u * atk.clip.dur; }
    if (atk && atk.free) { atk.t += dt; if (atk.t >= atk.clip.dur) atk = null; }
  } else if (atk) { atk.t += dt; if (atk.t >= atk.clip.dur) atk = null; }

  // THE WHOLE ANIMAL MOVES. Applied to the piece rather than the rig,
  // because for these designs the piece IS the body.
  if (beastAtk) {
    beastAtk.t += dt;
    if (beastAtk.t >= beastAtk.dur) beastAtk = null;
  }
  {
    const line = shownLine;
    const table = line && pieceTables[line];
    const idx = shownIdx;
    const m = table && idx >= 0 ? table[idx] : null;
    if (m) {
      const p = beastAtk
        ? beastAttackPose(beastAtk.kind, beastAtk.t / beastAtk.dur, beastAtk.hit)
        : { z: 0, y: 0, pitch: 0, roll: 0 };
      // THE TAIL STRIKES WHILE THE BODY ROCKS BACK. The pose runs coiled
      // to thrown across the clip and peaks on the hit frame, which is
      // the whole reason the sting came out of the body: a scorpion that
      // stings by leaning backwards is a scorpion nobody believes.
      if (m.stingPoses) {
        const u = beastAtk ? Math.min(1, beastAtk.t / beastAtk.dur) : 0;
        const hitAt = beastAtk ? beastAtk.hit : 0.45;
        const thrown = u <= hitAt ? (hitAt ? u / hitAt : 0) : 1 - (u - hitAt) / Math.max(0.05, 1 - hitAt);
        const k = Math.max(0, Math.min(m.stingPoses.length - 1, Math.round(thrown * (m.stingPoses.length - 1))));
        m.stingPoses.forEach((mesh, j) => (mesh.visible = j === k));
      }
      for (const k of ['beast', 'arachnid', 'fish', 'wings', 'beastTail']) {
        const mesh = m[k];
        if (!mesh) continue;
        mesh.position.z = p.z;
        mesh.position.y = -D.cy + p.y;
        mesh.rotation.x = p.pitch;
        mesh.rotation.z = p.roll;
      }
      if (m.stingPoses) {
        for (const mesh of m.stingPoses) {
          mesh.position.z = p.z;
          mesh.position.y = -D.cy + p.y;
          mesh.rotation.x = p.pitch;
          mesh.rotation.z = p.roll;
        }
      }
    }
  }
  if (arrowFlight) {   // straight flight at the DFU missile speed
    arrowFlight.d += MISSILE_SPEED * dt;
    const { dir, d, snap } = arrowFlight;
    for (let i = 0; i < arrowT.pos.length; i += 3) { arrowT.pos[i] = snap[i] + dir[0]*d; arrowT.pos[i+1] = snap[i+1] + dir[1]*d; arrowT.pos[i+2] = snap[i+2] + dir[2]*d; }
    arrowT.dirty = true;
    if (d > ARROW_RANGE) { arrowFlight = null; arrowHidden = true; arrowVisible(); }
  }
  const L = GAITS[gaitIx];
  const pose = effectivePose();
  if (L) {
    wt += dt * L.cadence;
    const bob = L.bobAmp * Math.sin(wt*2);
    for (const T of animTargets) { if (T === arrowT && arrowFlight) continue; animateTarget(T, wt, L, bob, pose, true); }   // a flying arrow owns its verts
    stepDrapeCloth(wt, 1, bob, L);           // gait -> cloth reacts + trails
  } else if (poseIx || atk) {
    ambientT += dt * 1.4;
    for (const T of animTargets) { if (T === arrowT && arrowFlight) continue; animateTarget(T, 0, POSE_L, 0, pose, false); }
    stepDrapeCloth(ambientT, 0.10, 0, WALK);
  } else {
    ambientT += dt * 1.4;
    for (const T of animTargets) poseArms(T);   // idle: hold the tuned arm/hand pose
    stepDrapeCloth(ambientT, 0.10, 0, WALK);  // gentle idle settle/sway
  }
}

// Orbit state.
let yaw = 0.5, pitch = 0.15, dist = D.h * 2.1, autospin = true;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, true);   // updateStyle: canvas display size == buffer, or mobile 100vh != innerHeight stretches the aspect
  const rw = Math.max(1, Math.round(w / pixel)), rh = Math.max(1, Math.round(h / pixel));
  rt.setSize(rw, rh); postMat.uniforms.res.value.set(rw, rh);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const pxrowEl = document.getElementById('pxrow'), tunerTab = document.getElementById('tunertab');
tunerTab.onclick = () => { const open = pxrowEl.classList.toggle('open'); tunerTab.innerHTML = 'tuners ' + (open ? '&#9660;' : '&#9650;'); };
const pxLab = document.getElementById('pxlab'), cdLab = document.getElementById('cdlab');
const wireArm=(id,key,scale)=>{const el=document.getElementById(id),lab=document.getElementById(id+'_lab'),name=lab.textContent.split(':')[0];el.addEventListener('input',e=>{armTune[key]=(+e.target.value)/100*scale;lab.textContent=name+': '+e.target.value;});};
wireArm('ap','pitch',0.9); wireArm('as','spread',0.7); wireArm('ae','elbow',1.6); wireArm('ah','hand',Math.PI);   // hand roll: full +/-180deg
wireArm('ahp','handPitch',1.3); wireArm('ahy','handYaw',1.0);   // full hand rotation: pitch + yaw join the roll
// sword seat sliders: pitch +/-45deg about the grip, offsets +/-0.12
const wireSword = (id, key, scale, fmt) => { const el = document.getElementById(id), lab = document.getElementById(id + '_lab'), name = lab.textContent.split(':')[0];
  el.addEventListener('input', (e) => { swordFit[key] = (+e.target.value) / 100 * scale; applySwordFit(); lab.innerHTML = name + ': ' + fmt(swordFit[key]); }); };
wireSword('sp', 'pitch', Math.PI / 4, (v) => Math.round(v * 180 / Math.PI) + '&deg;');
wireSword('sf', 'dz', 0.12, (v) => v.toFixed(3));
wireSword('su', 'dy', 0.12, (v) => v.toFixed(3));
document.getElementById('px').addEventListener('input', (e) => { pixel = +e.target.value; pxLab.textContent = pixel <= 1 ? 'pixelize: off' : 'pixelize: ' + pixel + 'x'; resize(); });
document.getElementById('cd').addEventListener('input', (e) => { const v = +e.target.value; levels = v >= 9 ? 0 : Math.round(2 + (v-1) * 3); postMat.uniforms.levels.value = levels; cdLab.textContent = levels === 0 ? 'color: full' : 'color: ' + levels + ' lvl'; });

let _last = performance.now();
function frame() {
  const now = performance.now(); const dt = Math.min(0.05, (now - _last) / 1000); _last = now;
  animate(dt);
  if (autospin) yaw += 0.005;
  pitch = Math.max(-1.2, Math.min(1.2, pitch));
  dist = Math.max(D.h * 0.9, Math.min(D.h * 6, dist));
  if (fpMode) {
    // FIRST PERSON: the eye rides the POSED head (gait bob, lean and
    // attack root motion all read through the camera). Anchored just
    // forward of the face so the head shell sits behind the near
    // plane.
    const Bo = animTargets[0];
    let hx = 0, hy = 0, hz = 0, hn = 0;
    for (let i = 0; i < Bo.vgrp.length; i++) if (Bo.vgrp[i] === 0 && Bo.base[i*3+1] > 1.55) { hx += Bo.pos[i*3]; hy += Bo.pos[i*3+1]; hz += Bo.pos[i*3+2]; hn++; }
    const ex = hx/hn, ey = hy/hn - D.cy + 0.04, ez = hz/hn + 0.18;
    camera.position.set(ex, ey, ez);
    camera.lookAt(ex, ey - 0.05, ez + 1);
  } else {
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * Math.cos(pitch) * dist
    );
    camera.lookAt(0, 0, 0);
  }
  if (pixel <= 1 && levels === 0) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  else {
    const bgKeep = scene.background; scene.background = null; // model only, transparent
    renderer.setClearAlpha(0); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
    scene.background = bgKeep; renderer.setClearAlpha(1);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  requestAnimationFrame(frame);
}
frame();

// Pointer / touch orbit + pinch zoom.
let px = 0, py = 0, drag = false, pinchD = 0;
const pts = new Map();
// CLASSIC DRAG-TO-SWING (DFU TrackMouseAttack, verbatim mechanics):
// hold and drag to attack. Gesture accumulates pointer deltas; when
// travel >= ATTACK_THRESHOLD * longest canvas dimension (within
// MAX_GESTURE_SECONDS) the radial table picks the strike and the
// machine fires it (mid-swing spam is rejected by the verbatim
// interrupt rule). Active on LEFT-drag in first person and on
// RIGHT-drag in orbit (left-drag keeps the orbit camera). Bows:
// press = nock+draw, release = loose.
let gest = null;   // { x, y, t0 }
const combatPose = () => poseIx > 0;   // fpMelee1H swings now (ATTACKS_FP shipped) - the old exclusion predated the FP clips
const gestureStart = () => {
  if (!combatPose()) return false;
  if (POSE_NAMES[poseIx] === 'rangedAim') { fireAttack('Up'); return true; }   // draw
  gest = { x: 0, y: 0, t0: performance.now() };
  return true;
};
const gestureMove = (dx, dy) => {
  if (!gest) return;
  if (performance.now() - gest.t0 > MAX_GESTURE_SECONDS * 1000) { gest.x = 0; gest.y = 0; gest.t0 = performance.now(); }   // stale gesture resets (verbatim)
  gest.x += dx; gest.y += dy;
  const longest = Math.max(S.clientWidth, S.clientHeight);
  if (Math.hypot(gest.x, gest.y) / longest >= ATTACK_THRESHOLD) {
    const ang = Math.atan2(-gest.y, gest.x) * 180 / Math.PI;   // screen y-down -> math degrees (0=Right, 90=Up)
    fireAttack(gestureDirection(ang));
    gest = { x: 0, y: 0, t0: performance.now() };
  }
};
const gestureEnd = () => { gest = null; if (POSE_NAMES[poseIx] === 'rangedAim') bowRelease(); };
S.addEventListener('contextmenu', (e) => e.preventDefault());
S.addEventListener('pointerdown', (e) => {
  const swing = (e.button === 2) || (fpMode && e.button === 0);
  if (swing && gestureStart()) { pts.set(e.pointerId, [e.clientX, e.clientY]); px = e.clientX; py = e.clientY; e.target.dataset.swing = e.pointerId; return; }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 1) { drag = true; px = e.clientX; py = e.clientY; autospin = false; document.getElementById('spin').classList.remove('on'); }
});
S.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  const swinging = e.target.dataset.swing == e.pointerId;
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (swinging) { gestureMove(e.clientX - px, e.clientY - py); px = e.clientX; py = e.clientY; return; }
  if (pts.size >= 2) {
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinchD) dist *= pinchD / d;
    pinchD = d; drag = false; return;
  }
  if (drag) {
    yaw -= (e.clientX - px) * 0.01;
    pitch += (e.clientY - py) * 0.01;
    px = e.clientX; py = e.clientY;
  }
});
function up(e) { if (e.target.dataset.swing == e.pointerId) { delete e.target.dataset.swing; gestureEnd(); } pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0; if (pts.size === 0) drag = false; }
S.addEventListener('pointerup', up); S.addEventListener('pointercancel', up);
S.addEventListener('wheel', (e) => { dist *= 1 + Math.sign(e.deltaY) * 0.1; e.preventDefault(); }, { passive: false });

document.getElementById('spin').onclick = (e) => { autospin = !autospin; e.target.classList.toggle('on', autospin); };
document.getElementById('reset').onclick = () => { yaw = 0.5; pitch = 0.15; dist = D.h * 2.1; };
document.getElementById('wire').onclick = (e) => { mat.wireframe = !mat.wireframe; e.target.classList.toggle('on', mat.wireframe); };
let bgi = 0; const bgs = [0x14141a, 0x000000, 0x808088, 0xf0f0f0];
postMat.uniforms.bg.value = new THREE.Color(bgs[0]);

for (const name of ['pauldrons','helm']) { const btn = document.getElementById(name); if (btn) btn.onclick = (e) => { const m = pieceMesh[name]; if (m) { m.visible = !m.visible; e.target.classList.toggle('on', m.visible); if (name === 'helm') syncHair(); } }; }
document.getElementById('race').onclick = (e) => { raceIx = (raceIx+1)%RACES.length; syncHair(); e.target.textContent = 'race: '+RACES[raceIx]; const pal=(D.PALETTES||{})[PKEY[RACES[raceIx]]]; if(pal) document.getElementById('tone').textContent='tone: '+pal[toneIx[RACES[raceIx]]%pal.length].name; refreshHairLabel(); };
document.getElementById('tone').onclick = (e) => { const R=RACES[raceIx], pal=(D.PALETTES||{})[PKEY[R]]; if(!pal)return; toneIx[R]=(toneIx[R]+1)%pal.length; applyTone(); e.target.textContent='tone: '+pal[toneIx[R]%pal.length].name; };
function refreshHairLabel(){ const h=raceHair[RACES[raceIx]]; const b=document.getElementById('hairstyle'); if(b) b.textContent = (h&&h.styles.length>1)?('hair: '+h.styles[h.ix]):'hair: -'; }
document.getElementById('hairstyle').onclick = () => { const h=raceHair[RACES[raceIx]]; if(!h||h.styles.length<2) return; h.ix=(h.ix+1)%h.styles.length; syncHair(); refreshHairLabel(); };
refreshHairLabel();
document.getElementById('walk').onclick = (e) => { gaitIx = (gaitIx+1)%3; e.target.textContent = ['idle','walk','run'][gaitIx]; e.target.classList.toggle('on', gaitIx>0); };
const poseBtn = document.getElementById('pose');
const setPose = (i) => { poseIx = ((i % POSE_NAMES.length) + POSE_NAMES.length) % POSE_NAMES.length; poseBtn.textContent = 'pose: ' + POSE_NAMES[poseIx]; poseBtn.classList.toggle('on', poseIx > 0); atk = null; wm = null; arrowFlight = null; arrowHidden = false; arrowVisible(); swordInfo.textContent = ''; };   // a pose change is a STATE change: clear the clip + the weapon machine (a drawn bow must not persist over a melee stance)
poseBtn.onclick = () => setPose(poseIx + 1);
// script hooks (Playwright iteration): fixed camera + pose by index
window.__setPose = setPose;
window.__setView = (y, p, d) => { autospin = false; yaw = y; pitch = p; if (d) dist = d; };
document.getElementById('fpv').onclick = () => setFP(!fpMode);
document.getElementById('hurt').onclick = () => { fireHurt(); hurtIx = (hurtIx + 1) % HURT_DIRS.length; };
window.__setFP = (on) => setFP(!!on);
// Sword: off -> Iron -> ... -> Daedric -> off. Recolors via the classic
// metal table ramp; the stats line is the verbatim item record.
const SWORD_MATS = Object.keys(D.swordRamps || {});
let swordIx = -1;
const swordInfo = document.getElementById('swordinfo');
const setSword = (i) => {
  swordIx = i;
  const on = swordIx >= 0, name = on ? SWORD_MATS[swordIx] : null;
  for (const w of WEAPON_DEFS) if (w.mesh) w.mesh.visible = false;
  const aw = activeWpn();
  if (aw.mesh) aw.mesh.visible = on;
  document.getElementById('sword').textContent = 'sword: ' + (on ? name : 'off');
  document.getElementById('sword').classList.toggle('on', on);
  if (on) {
    const aw2 = activeWpn();
    aw2.mesh.userData.recolor(D.swordRamps[name]);
    const it = aw2.items[name];
    const mod = it.materialModifier >= 0 ? '+' + it.materialModifier : String(it.materialModifier);
    swordInfo.textContent = `${name} ${it.name} \u00b7 dmg ${it.minDamage}\u2013${it.maxDamage} \u00b7 mat ${mod} \u00b7 hit ${it.toHitModifier >= 0 ? '+' : ''}${it.toHitModifier} \u00b7 ${it.weightInKg.toFixed(2)}kg \u00b7 ${it.value}g \u00b7 cond ${it.maxCondition}`;
  } else swordInfo.textContent = '';
};
document.getElementById('sword').onclick = () => setSword(swordIx + 2 > SWORD_MATS.length ? -1 : swordIx + 1);
window.__setSword = setSword;
{ const sel = document.getElementById('wpn');
  for (let i = 0; i < WEAPON_DEFS.length; i++) { const o = document.createElement('option'); o.value = i; o.textContent = WEAPON_DEFS[i].name; sel.appendChild(o); }
  sel.onchange = (e) => { wpnIx = +e.target.value; applySwordFit(); setSword(swordIx); arrowVisible(); }; }
window.__setWeapon = (i) => { wpnIx = i % WEAPON_DEFS.length; document.getElementById('wpn').value = wpnIx; setSword(swordIx); arrowVisible(); };
// Attacks: cycle the classic directions; strike fires the mapped clip
// (Up/UpLeft/UpRight all thrust, per the verbatim DFU mapping).
const ATK_DIRS = ['Down', 'DownLeft', 'DownRight', 'Left', 'Right', 'Up'];
let atkDirIx = 0;
document.getElementById('atkdir').onclick = (e) => { atkDirIx = (atkDirIx + 1) % ATK_DIRS.length; e.target.textContent = 'dir: ' + ATK_DIRS[atkDirIx]; };
const fireAttack = (dirOrStrike) => {

  const isBow = POSE_NAMES[poseIx] === 'rangedAim';
  if (!wm || wm.isBow !== isBow) wm = createWeaponMachine(isBow);
  if (isBow) {   // press = nock+draw (BowDrawback); release comes from the button-up path
    if (machineAttack(wm, 'StrikeUp')) { atk = { clip: D.attacksRanged.Release, t: 0 }; swordInfo.textContent = 'drawing...'; arrowFlight = null; arrowHidden = false; arrowVisible(); }
    else if (wm.now < wm.cooldownUntil) swordInfo.textContent = 'bow cooldown';
    return;
  }
  const name = D.dirToStrike[dirOrStrike] || dirOrStrike;
  const table = POSE_NAMES[poseIx] === 'melee2H' ? D.attacks2H : (POSE_NAMES[poseIx] === 'fpMelee1H' ? D.attacksFP : D.attacks);   // pose routes the strike set (2H carries solved armR; FP carries the dedicated viewmodel sweeps)
  const clip = table[name];
  if (clip && machineAttack(wm, name)) atk = { clip, t: 0 };   // the interrupt rule lives in the machine (mid-swing rejected, verbatim)
};
const bowRelease = () => { if (wm && wm.isBow && wm.state === 'StrikeUp') { machineAttack(wm, 'StrikeDown'); swordInfo.textContent = 'loose!'; } };
window.__bowRelease = bowRelease;
const HURT_DIRS = ['HurtFront', 'HurtLeft', 'HurtBack', 'HurtRight'];
let hurtIx = 0;
const fireHurt = (name) => { const clip = D.reactions[name || HURT_DIRS[hurtIx]]; if (clip) { atk = { clip, t: 0, free: true }; swordInfo.textContent = (name || HURT_DIRS[hurtIx]); } };
window.__hurt = fireHurt;
window.__bowCancel = () => { if (wm && machineCancelBowDraw(wm)) { atk = null; swordInfo.textContent = 'un-drawn'; } };
window.__setSpeed = (v) => { liveSpeed = v; document.getElementById('spdv').textContent = 'SPD ' + v; };
document.getElementById('strike').onclick = () => {
  // AN ARMLESS DESIGN PLAYS ITS OWN MOTION. Nine enemies have no arms to
  // swing, so the authored strike clips animate a collapsed point and
  // nothing happens. Their whole body moves instead.
  if (fireBeastAttack(shownDesign)) {
    const si = document.getElementById('swordinfo');
    if (si) si.textContent = shownDesign.name + ' \u00b7 ' + shownDesign.attack;
    return;
  }
  return oldStrike();
};
const oldStrike = () => { if (POSE_NAMES[poseIx] === 'rangedAim') return; fireAttack(ATK_DIRS[atkDirIx]); };   // bows are owned by the pointer pair (press=draw, release=loose); click would double-path
window.__attack = fireAttack;
document.getElementById('spd').oninput = (e) => window.__setSpeed(+e.target.value);
{ const sb = document.getElementById('strike');
  sb.addEventListener('pointerdown', () => { if (POSE_NAMES[poseIx] === 'rangedAim') fireAttack('Up'); });
  sb.addEventListener('pointerup', () => { if (POSE_NAMES[poseIx] === 'rangedAim') bowRelease(); }); }
document.getElementById('bg').onclick = () => { bgi = (bgi + 1) % bgs.length; scene.background = new THREE.Color(bgs[bgi]); postMat.uniforms.bg.value = new THREE.Color(bgs[bgi]); };
document.getElementById('drape').onclick = (e) => { drapeIx = (drapeIx+1) % DRAPES.length; setDrape(); e.target.textContent = 'drape: ' + DRAPES[drapeIx]; };
