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
import { decodeDds } from '../formats/mwDdsFile.js';

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
let loaded = null; // { name, group, batches }
let allMeshNames = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function textureBytes(name) {
  if (looseTextures.has(name)) return looseTextures.get(name);
  if (bsa && bsa.has(name)) return bsa.get(name);
  // Retail NIFs frequently say "foo.tga" for a file shipped as foo.dds.
  const asDds = name.replace(/\.[a-z0-9]+$/, '.dds');
  if (looseTextures.has(asDds)) return looseTextures.get(asDds);
  if (bsa && bsa.has(asDds)) return bsa.get(asDds);
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
      const img = decodeDds(bytes);
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
    geo.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
    if (b.normals) geo.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3));
    else geo.computeVertexNormals();
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
  holder.remove(loaded.group);
  loaded.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  loaded = null;
}

function loadNifBytes(bytes, name) {
  disposeLoaded();
  try {
    const nif = parseNif(bytes);
    const batches = flattenNif(nif);
    const group = buildGroup(batches);
    holder.add(group);
    loaded = { name, group, batches };
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
    else if (lower.endsWith('.dds')) {
      looseTextures.set(normalizeBsaPath(`textures\\${f.name}`), bytes);
      looseTextures.set(normalizeBsaPath(f.name), bytes);
      textureCache.clear();
    } else if (lower.endsWith('.nif')) pendingNif = { bytes, name: f.name };
  }
  // Loose mesh last, so its textures (archive or loose) are already in.
  if (pendingNif) loadNifBytes(pendingNif.bytes, pendingNif.name);
}

$('file').addEventListener('change', (e) => takeFiles([...e.target.files]));
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  takeFiles([...e.dataTransfer.files]);
});
meshSel.addEventListener('change', () => loadNifBytes(bsa.get(meshSel.value), meshSel.value));
$('filter').addEventListener('input', refreshMeshList);

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
  resize();
  applyOrbit();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
