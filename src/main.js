// project-dagger entry point.
// Desktop-only. Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).
//
// Controls: click to lock pointer, WASD + mouse to fly, Shift for speed.
// ?shot raises window.__shotReady at a fixed vantage for tools/screenshot.mjs.

import { BlocksFile } from './formats/blocksFile.js';
import { Arch3dFile } from './formats/arch3dFile.js';
import { TextureFile } from './formats/textureFile.js';
import { DFPalette } from './formats/dfPalette.js';
import { MapsFile } from './formats/mapsFile.js';
import { dfMeshToModel } from './world/meshReader.js';
import { layoutLocation, RMB_SIDE } from './world/locationLayout.js';
import { collectBlockFlats, scaledBillboardSize } from './world/rmbFlats.js';
import { perspective, lookAt, trs, multiply } from './world/mat4.js';
import { Renderer } from './render/renderer.js';
import { buildGroundMesh } from './render/groundMesh.js';

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
  const params = new URLSearchParams(location.search);
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';
  const status = (msg) => {
    document.title = `project-dagger - ${msg}`;
  };

  status('loading data');
  const [palBytes, blocksBytes, archBytes, mapsBytes, climateBytes, politicBytes] =
    await Promise.all([
      fetchBytes('ART_PAL.COL'),
      fetchBytes('BLOCKS.BSA'),
      fetchBytes('ARCH3D.BSA'),
      fetchBytes('MAPS.BSA'),
      fetchBytes('CLIMATE.PAK'),
      fetchBytes('POLITIC.PAK'),
    ]);

  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');
  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);

  // Assemble the location.
  const dfLocation = maps.getLocationByName(regionName, locationName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${locationName}`);
  status(`laying out ${locationName}`);
  const loc = layoutLocation(dfLocation, maps, blocks);

  // Decompose every referenced mesh once, collecting texture archives.
  const dfMeshes = new Map(); // modelIdNum -> dfMesh
  const archives = new Set([loc.groundArchive]);
  for (const b of loc.blocks) {
    for (const placed of b.layout.models) {
      if (dfMeshes.has(placed.modelIdNum)) continue;
      const index = arch.getRecordIndex(placed.modelIdNum);
      if (index === -1) continue;
      const dfMesh = arch.getMesh(index);
      dfMeshes.set(placed.modelIdNum, dfMesh);
      for (const sm of dfMesh.subMeshes) archives.add(sm.textureArchive);
    }
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
  const uploadRecord = (archive, record) => {
    const t = textureFiles.get(archive);
    const color32 = t.getColor32(t.getDFBitmap(record, 0), 0);
    renderer.uploadTexture(archive, record, color32);
  };

  // GPU meshes shared across blocks.
  const gpuMeshes = new Map(); // modelIdNum -> renderer mesh
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    gpuMeshes.set(id, renderer.createMesh(model));
  }

  // Per-block scene list: world matrices with the block origin folded in,
  // plus one ground mesh per block, plus flats grouped into billboard batches.
  const drawList = [];
  const flatGroups = new Map(); // "archive_record" -> [centers]
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const mesh = gpuMeshes.get(placed.modelIdNum);
      if (!mesh) continue;
      drawList.push({ mesh, matrix: multiply(originMatrix, placed.matrix) });
    }
    const groundModel = buildGroundMesh(b.layout.groundTiles, loc.groundArchive);
    for (const sm of groundModel.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    drawList.push({ mesh: renderer.createMesh(groundModel), matrix: originMatrix });

    for (const flat of collectBlockFlats(b.dfBlock, dfLocation.climate.natureArchive)) {
      const key = `${flat.archive}_${flat.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([flat.x + b.originX, flat.y, flat.z + b.originZ]);
    }
  }

  // Load any flat archives not already fetched, then build one batch per
  // (archive, record) with its scaled billboard size.
  status('loading flat archives');
  const flatArchives = new Set(
    [...flatGroups.keys()].map((k) => Number(k.split('_')[0]))
  );
  await Promise.all(
    [...flatArchives].filter((a) => !textureFiles.has(a)).map(async (archive) => {
      const t = new TextureFile();
      t.load(await fetchBytes(texName(archive)), texName(archive), palette);
      textureFiles.set(archive, t);
    })
  );
  const billboardBatches = [];
  let flatCount = 0;
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
    flatCount += centers.length;
  }

  // Camera.
  const shotMode = params.has('shot');
  const extentX = loc.width * RMB_SIDE;
  const extentZ = loc.height * RMB_SIDE;
  const center = [extentX / 2, 4, extentZ / 2];
  const cam = {
    pos: [center[0], 14, extentZ + 40],
    yaw: Math.PI,
    pitch: -0.08,
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

  status(`${locationName} - ${loc.blocks.length} blocks, ${drawList.length} draws`);
  console.log(
    `scene: ${loc.blocks.length} blocks, ${drawList.length} placements, ` +
    `${gpuMeshes.size} meshes, ${renderer.textures.size} textures, ${flatCount} flats in ${billboardBatches.length} batches, ground archive ${loc.groundArchive}`
  );

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 120 : 30) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    // Shot vantage scales with the location extent.
    const target = shotMode
      ? [extentX * 0.46, 6, extentZ * 0.5]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode
      ? [extentX * 0.565, 11, extentZ * 0.72]
      : cam.pos;
    const proj = perspective(
      Math.PI / 3,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      Math.max(2000, extentX * 4)
    );
    const view = lookAt(eye, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);
    // Classic Daggerfall billboards rotate about Y only: right from the view,
    // up stays world-Y.
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    if (shotMode) {
      const dx = target[0] - eye[0];
      const dz = target[2] - eye[2];
      const l = Math.hypot(dx, dz) || 1;
      camRight[0] = -dz / l;
      camRight[2] = dx / l;
    }
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));

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
