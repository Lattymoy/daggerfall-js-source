// Milestone 4: ?interior=<BLOCKNAME>:<record> renders one building interior
// standalone (e.g. ?interior=MAGEAA00.RMB:0), camera spawned at the Enter
// marker when present.

import { Arch3dFile } from '../formats/arch3dFile.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { TextureFile } from '../formats/textureFile.js';
import { applyClimate, isExteriorWindow } from '../world/climateSwaps.js';
import { INTERIOR_MARKER, layoutInterior } from '../world/interiorLayout.js';
import { lookAt, perspective } from '../world/mat4.js';
import { dfMeshToModel } from '../world/meshReader.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { fetchBytes, parseSeason, texName } from './shared.js';

// Milestone 4 scene: one building interior, standalone at block-local origin.
export async function bootInterior(canvas, renderer, params, status) {
  const [blockName, recordStr] = params.get('interior').split(':');
  const recordIndex = Number(recordStr || 0);
  // DFU interiors climate-swap their models (SetClimate with
  // WindowStyle.Disabled - emission stays dark here by default). A
  // standalone block has no location, so ClimateBases.Temperate is the
  // verbatim field default; ?climate= overrides, ?season= applies.
  const CLIMATE_PARAM = { desert: 0, mountain: 100, temperate: 300, swamp: 400 };
  const climateBase = CLIMATE_PARAM[(params.get('climate') || 'temperate').toLowerCase()] ?? 300;
  const season = parseSeason(params);

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

  const blockIndex = blocks.getBlockIndex(blockName);
  if (blockIndex === -1) throw new Error(`block not found: ${blockName}`);
  const dfBlock = blocks.getBlock(blockIndex);

  // Decompose lazily during layout; getModel resolves id -> converted model.
  status(`laying out ${blockName}:${recordIndex}`);
  const textureFiles = new Map();
  const pendingArchives = new Set();
  const dfMeshes = new Map();
  const getModelRaw = (modelIdNum) => {
    if (!dfMeshes.has(modelIdNum)) {
      const index = arch.getRecordIndex(modelIdNum);
      if (index === -1) throw new Error(`model not found: ${modelIdNum}`);
      const dfMesh = arch.getMesh(index);
      dfMeshes.set(modelIdNum, dfMesh);
      for (const sm of dfMesh.subMeshes) pendingArchives.add(sm.textureArchive);
    }
    return dfMeshes.get(modelIdNum);
  };
  // First pass with unit texture sizes to collect archives + door/prop data;
  // UVs are finalized after archives load.
  const preModels = new Map();
  const getModelPre = (id) => {
    if (!preModels.has(id)) {
      preModels.set(id, dfMeshToModel(getModelRaw(id), () => ({ width: 1, height: 1 })));
    }
    return preModels.get(id);
  };
  const interior = layoutInterior(dfBlock, blockIndex, recordIndex, getModelPre);
  for (const d of interior.actionDoors) getModelPre(d.modelIdNum);
  for (const f of interior.flats) pendingArchives.add(f.archive);
  // Climate swap table over every model submesh (pruned after load if the
  // swapped archive lacks the record - the submesh then keeps its
  // original texture).
  const texRemap = new Map();
  for (const dfMesh of dfMeshes.values()) {
    for (const sm of dfMesh.subMeshes) {
      const swapped = applyClimate(sm.textureArchive, sm.textureRecord, climateBase, season);
      if (swapped === sm.textureArchive) continue;
      pendingArchives.add(swapped);
      texRemap.set(`${sm.textureArchive}_${sm.textureRecord}`, `${swapped}_${sm.textureRecord}`);
    }
  }

  status(`loading ${pendingArchives.size} texture archives`);
  await Promise.all(
    [...pendingArchives].map(async (archive) => {
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
    const bitmap = t.getDFBitmap(record, 0);
    renderer.uploadTexture(archive, record, t.getColor32(bitmap, 0));
    // Exterior windows also get their emission mask (R2, MaterialReader
    // semantics: glass texels glow with the active window style).
    if (isExteriorWindow(archive, record)) {
      renderer.uploadEmissionTexture(archive, record, t.getWindowColors32(bitmap));
    }
  };

  const gpuMeshes = new Map();
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    gpuMeshes.set(id, renderer.createMesh(model));
  }
  for (const [key, target] of texRemap) {
    const [archive, record] = target.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) texRemap.delete(key);
    else uploadRecord(archive, record);
  }

  const drawList = [];
  for (const p of [...interior.placements, ...interior.actionDoors]) {
    drawList.push({ mesh: gpuMeshes.get(p.modelIdNum), matrix: p.matrix });
  }

  const billboardBatches = [];
  const flatGroups = new Map();
  for (const flat of interior.flats) {
    const key = `${flat.archive}_${flat.record}`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([flat.x, flat.y, flat.z]);
  }
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
  }

  // Camera at the Enter marker when present, else the first placement,
  // facing the interior's bounding center (the marker sits at the entry
  // door, so yaw 0 would stare into it).
  const bb = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const p of interior.placements) {
    bb.minX = Math.min(bb.minX, p.matrix[12]); bb.maxX = Math.max(bb.maxX, p.matrix[12]);
    bb.minZ = Math.min(bb.minZ, p.matrix[14]); bb.maxZ = Math.max(bb.maxZ, p.matrix[14]);
  }
  const centerX = (bb.minX + bb.maxX) / 2;
  const centerZ = (bb.minZ + bb.maxZ) / 2;
  const enter = interior.markers.find((m) => m.type === INTERIOR_MARKER.ENTER);
  const spawn = enter
    ? [enter.x, enter.y + 1, enter.z]
    : [interior.placements[0].matrix[12], 1.5, interior.placements[0].matrix[14]];
  const cam = {
    pos: spawn,
    yaw: Math.atan2(centerX - spawn[0], centerZ - spawn[2]),
    pitch: 0,
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

  const shotMode = params.has('shot');
  status(`${blockName}:${recordIndex} - ${drawList.length} draws`);
  console.log(
    `interior: ${interior.placements.length} models, ${interior.actionDoors.length} action doors, ` +
    `${interior.flats.length} flats, ${interior.markers.length} markers, ${interior.doors.length} static doors, ` +
    `climate ${climateBase}, season ${season}, ${texRemap.size} swaps`
  );

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 12 : 3) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
    const view = lookAt(cam.pos, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix, texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
