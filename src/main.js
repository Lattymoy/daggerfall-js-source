// project-dagger entry point.
// Desktop-only. Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// World-Arc milestone 1: assemble and render a real RMB block (MAGEAA00.RMB,
// the Mages Guild block pinned throughout the test suite) from original data:
// BLOCKS placement -> ARCH3D geometry -> TEXTURE archives via ART_PAL.
//
// Controls: click to lock pointer, WASD + mouse to fly, Shift for speed.
// ?shot puts the camera at a fixed vantage and raises window.__shotReady for
// the headless screenshot harness (tools/screenshot.mjs).

import { BlocksFile } from './formats/blocksFile.js';
import { Arch3dFile } from './formats/arch3dFile.js';
import { TextureFile } from './formats/textureFile.js';
import { DFPalette } from './formats/dfPalette.js';
import { dfMeshToModel } from './world/meshReader.js';
import { layoutRmbBlock } from './world/rmbLayout.js';
import { perspective, lookAt } from './world/mat4.js';
import { Renderer } from './render/renderer.js';
import { buildGroundMesh } from './render/groundMesh.js';

const BLOCK_NAME = 'MAGEAA00.RMB';
// Woodlands ground set (Daggerfall region climate). The per-location climate
// lookup wires in with the location loader, the next World-Arc feature.
const GROUND_ARCHIVE = 302;

async function fetchBytes(name) {
  const res = await fetch(`./arena2/${name}`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function texName(archive) {
  return `TEXTURE.${String(archive).padStart(3, '0')}`;
}

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  const status = (msg) => {
    document.title = `project-dagger - ${msg}`;
  };

  status('loading data');
  const [palBytes, blocksBytes, archBytes] = await Promise.all([
    fetchBytes('ART_PAL.COL'),
    fetchBytes('BLOCKS.BSA'),
    fetchBytes('ARCH3D.BSA'),
  ]);

  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');

  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);

  // Assemble the block.
  const block = blocks.getBlockByName(BLOCK_NAME);
  const layout = layoutRmbBlock(block);

  // Decompose every referenced mesh, collecting texture archives.
  const dfMeshes = new Map(); // modelIdNum -> dfMesh
  const archives = new Set([GROUND_ARCHIVE]);
  for (const placed of layout.models) {
    if (dfMeshes.has(placed.modelIdNum)) continue;
    const index = arch.getRecordIndex(placed.modelIdNum);
    if (index === -1) continue;
    const dfMesh = arch.getMesh(index);
    dfMeshes.set(placed.modelIdNum, dfMesh);
    for (const sm of dfMesh.subMeshes) archives.add(sm.textureArchive);
  }

  status(`loading ${archives.size} texture archives`);
  const textureFiles = new Map();
  await Promise.all(
    [...archives].map(async (archive) => {
      const t = new TextureFile();
      t.load(await fetchBytes(texName(archive)), texName(archive), palette);
      textureFiles.set(archive, t);
    })
  );
  const getTextureSize = (archive, record) => {
    const t = textureFiles.get(archive);
    return { width: t.getWidth(record), height: t.getHeight(record) };
  };

  // Convert meshes and upload every referenced texture record.
  const gpuMeshes = new Map(); // modelIdNum -> renderer mesh
  const uploadRecord = (archive, record) => {
    const t = textureFiles.get(archive);
    const color32 = t.getColor32(t.getDFBitmap(record, 0), 0);
    renderer.uploadTexture(archive, record, color32);
  };
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    gpuMeshes.set(id, renderer.createMesh(model));
  }

  // Ground.
  const groundModel = buildGroundMesh(layout.groundTiles, GROUND_ARCHIVE);
  for (const sm of groundModel.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
  const groundMesh = renderer.createMesh(groundModel);
  const identityMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  // Camera.
  const shotMode = new URLSearchParams(location.search).has('shot');
  const cam = {
    pos: shotMode ? [138, 46, 148] : [51.2, 12, 130],
    yaw: shotMode ? Math.PI * 0.78 : Math.PI,
    pitch: shotMode ? -0.34 : -0.1,
  };
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => canvas.requestPointerLock());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    cam.yaw -= e.movementX * 0.0025;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0025));
  });

  const lightDir = new Float32Array([0.45, 0.8, 0.35]);
  {
    const l = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
    lightDir[0] /= l; lightDir[1] /= l; lightDir[2] /= l;
  }

  status(`${BLOCK_NAME} - ${layout.models.length} models`);
  console.log(`scene: ${layout.models.length} placements, ${gpuMeshes.size} meshes, ${renderer.textures.size} textures`);
  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // Fly movement.
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 60 : 20) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = shotMode
      ? [51.2, 4, 51.2]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode ? [132, 52, 142] : cam.pos;
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    const view = lookAt(eye, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    renderer.drawMesh(groundMesh, identityMatrix);
    for (const placed of layout.models) {
      const mesh = gpuMeshes.get(placed.modelIdNum);
      if (mesh) renderer.drawMesh(mesh, placed.matrix);
    }

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  document.body.textContent = `boot failed: ${e.message}`;
  console.error(e);
});
