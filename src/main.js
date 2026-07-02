// project-dagger entry point.
// Desktop-only. Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).
// Milestone 4: ?interior=<BLOCKNAME>:<record> renders one building interior
// standalone (e.g. ?interior=MAGEAA00.RMB:0), camera spawned at the Enter
// marker when present.
// Milestone 5: ?dungeon=<name> (&region=) renders a full dungeon (default
// Privateer's Hold), camera at the start marker, per-dungeon texture table
// applied exactly as DFU's SetDungeonTextures (UVs keep original-archive
// sizes; pixels come from the remapped archive).
// Milestone 6: ?terrain=<mapPixelX>,<mapPixelY> (default 207,213 -
// Daggerfall city environs) renders a 5x5 map-pixel heightfield
// neighborhood from WOODS.WLD through the DefaultTerrainSampler port,
// shaded by an elevation ramp (terrain texturing is the Rendering arc's).
//
// Controls: click to lock pointer, WASD + mouse to fly, Shift for speed.
// ?shot raises window.__shotReady at a fixed vantage for tools/screenshot.mjs.

import { BlocksFile } from './formats/blocksFile.js';
import { Arch3dFile } from './formats/arch3dFile.js';
import { TextureFile } from './formats/textureFile.js';
import { DFPalette } from './formats/dfPalette.js';
import { MapsFile } from './formats/mapsFile.js';
import { WoodsFile } from './formats/woodsFile.js';
import { dfMeshToModel } from './world/meshReader.js';
import { layoutLocation, RMB_SIDE } from './world/locationLayout.js';
import { collectBlockFlats, scaledBillboardSize } from './world/rmbFlats.js';
import { layoutInterior, INTERIOR_MARKER } from './world/interiorLayout.js';
import { layoutDungeon } from './world/dungeonLayout.js';
import { applyTextureTable } from './world/dungeonTextures.js';
import {
  generateSamples, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT,
  DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION,
} from './world/terrainSampler.js';
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
  const status = (msg) => {
    document.title = `project-dagger - ${msg}`;
  };
  if (params.has('interior')) return bootInterior(canvas, renderer, params, status);
  if (params.has('dungeon')) return bootDungeon(canvas, renderer, params, status);
  if (params.has('terrain')) return bootTerrain(canvas, renderer, params, status);
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';

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

// Milestone 4 scene: one building interior, standalone at block-local origin.
async function bootInterior(canvas, renderer, params, status) {
  const [blockName, recordStr] = params.get('interior').split(':');
  const recordIndex = Number(recordStr || 0);

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
    const color32 = t.getColor32(t.getDFBitmap(record, 0), 0);
    renderer.uploadTexture(archive, record, color32);
  };

  const gpuMeshes = new Map();
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    gpuMeshes.set(id, renderer.createMesh(model));
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
    `${interior.flats.length} flats, ${interior.markers.length} markers, ${interior.doors.length} static doors`
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
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Milestone 5 scene: a full dungeon on the block grid.
async function bootDungeon(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const dungeonName = params.get('dungeon') || "Privateer's Hold";

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

  const dfLocation = maps.getLocationByName(regionName, dungeonName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${dungeonName}`);

  status(`laying out ${dungeonName}`);
  const dfMeshes = new Map();
  const preModels = new Map();
  const getModelPre = (id) => {
    if (!preModels.has(id)) {
      const index = arch.getRecordIndex(id);
      if (index === -1) throw new Error(`model not found: ${id}`);
      dfMeshes.set(id, arch.getMesh(index));
      preModels.set(id, dfMeshToModel(dfMeshes.get(id), () => ({ width: 1, height: 1 })));
    }
    return preModels.get(id);
  };
  const dungeon = layoutDungeon(dfLocation, blocks, getModelPre);
  for (const b of dungeon.blocks) {
    for (const d of b.layout.actionDoors) getModelPre(d.modelIdNum);
  }

  // Original archives size the UVs; the texture table remaps which archive
  // supplies the pixels (SetDungeonTextures semantics). Fetch both sets.
  const climateBaseType = dfLocation.climate.climateType;
  const remap = (archive) => applyTextureTable(archive, dungeon.textureTable, climateBaseType);
  const originalArchives = new Set();
  for (const dfMesh of dfMeshes.values()) {
    for (const sm of dfMesh.subMeshes) originalArchives.add(sm.textureArchive);
  }
  const flatArchives = new Set();
  for (const b of dungeon.blocks) {
    for (const f of b.layout.flats) flatArchives.add(f.archive);
  }
  const allArchives = new Set([...originalArchives, ...flatArchives]);
  for (const a of originalArchives) allArchives.add(remap(a));

  status(`loading ${allArchives.size} texture archives`);
  const textureFiles = new Map();
  await Promise.all(
    [...allArchives].map(async (archive) => {
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

  // GPU meshes: UVs from the original archive, submesh archives remapped
  // after conversion, verbatim DFU's material-swap order.
  const gpuMeshes = new Map();
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) {
      sm.textureArchive = remap(sm.textureArchive);
      uploadRecord(sm.textureArchive, sm.textureRecord);
    }
    gpuMeshes.set(id, renderer.createMesh(model));
  }

  const drawList = [];
  const flatGroups = new Map();
  for (const b of dungeon.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) {
      drawList.push({ mesh: gpuMeshes.get(p.modelIdNum), matrix: multiply(originMatrix, p.matrix) });
    }
    for (const d of b.layout.actionDoors) {
      if (d.disabled) continue;
      drawList.push({ mesh: gpuMeshes.get(d.modelIdNum), matrix: multiply(originMatrix, d.matrix) });
    }
    for (const f of b.layout.flats) {
      const key = `${f.archive}_${f.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([f.x + b.originX, f.y, f.z + b.originZ]);
    }
  }
  const billboardBatches = [];
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
  }

  // Camera at the start marker (the classic dungeon spawn).
  const spawn = dungeon.startMarker
    ? [dungeon.startMarker.x, dungeon.startMarker.y, dungeon.startMarker.z]
    : [0, 2, 0];
  const cam = { pos: spawn, yaw: 0, pitch: 0 };
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
  const nBlocks = dungeon.blocks.length;
  status(`${dungeonName} - ${nBlocks} blocks, ${drawList.length} draws`);
  console.log(
    `dungeon: ${nBlocks} blocks, ${drawList.length} draws, table [${dungeon.textureTable}], ` +
    `start ${JSON.stringify(dungeon.startMarker)}`
  );

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 24 : 5) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 800);
    const view = lookAt(cam.pos, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Milestone 6 scene: a 5x5 map-pixel heightfield neighborhood.
async function bootTerrain(canvas, renderer, params, status) {
  const spec = params.get('terrain');
  const [cx, cy] = spec && spec.includes(',')
    ? spec.split(',').map(Number)
    : [207, 213]; // Daggerfall city environs

  status('loading WOODS.WLD');
  const woods = new WoodsFile();
  if (!woods.load(await fetchBytes('WOODS.WLD'))) throw new Error('WOODS.WLD failed to load');

  // Elevation ramp texture: sea -> beach -> grass -> rock -> snow. Sampled
  // by height so relief reads without the Rendering arc's tilemap.
  const rampW = 256;
  const ramp = new Uint32Array(rampW);
  const ocean = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT;
  const beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  const abgr = (r, g, b) => (0xff << 24) | (b << 16) | (g << 8) | r;
  for (let i = 0; i < rampW; i++) {
    const h = i / (rampW - 1);
    if (h <= ocean + 1e-4) ramp[i] = abgr(38, 66, 129);
    else if (h < beach) ramp[i] = abgr(190, 170, 120);
    else if (h < 0.25) ramp[i] = abgr(72, 108, 52);
    else if (h < 0.5) ramp[i] = abgr(112, 104, 84);
    else ramp[i] = abgr(228, 228, 232);
  }
  renderer.uploadTexture('ramp', 0, { width: rampW, height: 1, colors: ramp });

  status(`sampling terrain around ${cx},${cy}`);
  const hDim = HEIGHTMAP_DIMENSION;
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const step = TERRAIN_SIZE / (hDim - 1);
  const drawList = [];
  const radius = 2; // 5x5 neighborhood
  for (let py = cy - radius; py <= cy + radius; py++) {
    for (let px = cx - radius; px <= cx + radius; px++) {
      const samples = generateSamples(woods, px, py);
      const at = (x, y) => samples[x * hDim + y] * worldHeight;

      const positions = new Float32Array(hDim * hDim * 3);
      const normals = new Float32Array(hDim * hDim * 3);
      const uvs = new Float32Array(hDim * hDim * 2);
      for (let y = 0; y < hDim; y++) {
        for (let x = 0; x < hDim; x++) {
          const vi = (y * hDim + x) * 3;
          positions[vi] = x * step;
          positions[vi + 1] = at(x, y);
          positions[vi + 2] = y * step;
          // Central-difference normal.
          const hl = at(Math.max(0, x - 1), y);
          const hr = at(Math.min(hDim - 1, x + 1), y);
          const hd = at(x, Math.max(0, y - 1));
          const hu = at(x, Math.min(hDim - 1, y + 1));
          const nx = hl - hr, ny = 2 * step, nz = hd - hu;
          const nl = Math.hypot(nx, ny, nz) || 1;
          normals[vi] = nx / nl; normals[vi + 1] = ny / nl; normals[vi + 2] = nz / nl;
          uvs[(y * hDim + x) * 2] = samples[x * hDim + y];
          uvs[(y * hDim + x) * 2 + 1] = 0.5;
        }
      }
      const quads = hDim - 1;
      const indices = new Uint32Array(quads * quads * 6);
      let ii = 0;
      for (let y = 0; y < quads; y++) {
        for (let x = 0; x < quads; x++) {
          const a = y * hDim + x;
          const b = a + 1;
          const c = a + hDim;
          const d = c + 1;
          indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
          indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
        }
      }
      const mesh = renderer.createMesh({
        positions, normals, uvs, indices,
        subMeshes: [{ textureArchive: 'ramp', textureRecord: 0, startIndex: 0, primitiveCount: quads * quads * 2 }],
      });
      // Pixel (X, Y) at (xdif * size, 0, -ydif * size): map Y runs south.
      drawList.push({
        mesh,
        matrix: trs((px - cx) * TERRAIN_SIZE, 0, -(py - cy) * TERRAIN_SIZE, 0, 0, 0),
      });
    }
  }

  // Camera hovering over the center pixel.
  const centerH = generateSamples(woods, cx, cy)[(hDim >> 1) * hDim + (hDim >> 1)] * worldHeight;
  const cam = {
    pos: [TERRAIN_SIZE / 2, centerH + 120, TERRAIN_SIZE / 2 + 300],
    yaw: Math.PI,
    pitch: -0.25,
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
  status(`terrain ${cx},${cy} - ${drawList.length} pixels`);
  console.log(`terrain: pixels ${drawList.length}, hDim ${hDim}, size ${TERRAIN_SIZE}, worldHeight ${worldHeight}`);

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const speed = (keys.has('ShiftLeft') ? 400 : 80) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = shotMode
      ? [TERRAIN_SIZE / 2, centerH - 300, TERRAIN_SIZE / 2 - 1400]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode ? [TERRAIN_SIZE / 2, centerH + 700, TERRAIN_SIZE / 2 + 1200] : cam.pos;
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.5, 8000);
    const view = lookAt(eye, target, [0, 1, 0]);

    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);

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
