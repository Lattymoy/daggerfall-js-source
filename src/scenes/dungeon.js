// Milestone 5: ?dungeon=<name> (&region=) renders a full dungeon (default
// Privateer's Hold), camera at the start marker, per-dungeon texture table
// applied exactly as DFU's SetDungeonTextures (UVs keep original-archive
// sizes; pixels come from the remapped archive).

import { Arch3dFile } from '../formats/arch3dFile.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { TextureFile } from '../formats/textureFile.js';
import { isExteriorWindow } from '../world/climateSwaps.js';
import { collectDungeonLights, DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { nearestLights } from '../world/cityLights.js';
import { CityLightAnimator } from '../world/worldClock.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { RDB_SIDE, MOVE_ACTION_FLAGS } from '../world/rdbLayout.js';

// Water surface color: presentation choice (see renderer WATER_VS note).
// R11: the surface is the classic water tile (climate ground archive
// record 0 - the 0xFF tilemap sentinel's target, same picture classic
// tiles across oceans), tinted only by alpha; slow diagonal scroll is
// the classic flow, presentation-tuned.
const WATER_COLOR = [1, 1, 1, 0.82];
const WATER_SCROLL_TILES_PER_SEC = 0.05;
import { layoutDungeon } from '../world/dungeonLayout.js';
import { applyTextureTable } from '../world/dungeonTextures.js';
import { lookAt, multiply, perspective, trs } from '../world/mat4.js';
import { dfMeshToModel } from '../world/meshReader.js';
import { PlayerMotor } from '../player/motor.js';
import { Collider } from '../player/collider.js';
import { ActionSystem } from '../world/actionSystem.js';
import {
  pickActivatable, worldAabb, RAY_DISTANCE, DOOR_ACTIVATION_DISTANCE,
} from '../player/activate.js';
import { ACTION_FLAGS } from '../world/rdbLayout.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { fetchBytes, texName } from './shared.js';

// Milestone 5 scene: a full dungeon on the block grid.
export async function bootDungeon(canvas, renderer, params, status) {
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
  // Classic water tile: ground archive record 0 for this location's climate.
  const waterArchive = dfLocation.climate.groundArchive;
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
  allArchives.add(waterArchive); // classic water tile source (R11)

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
    const bitmap = t.getDFBitmap(record, 0);
    renderer.uploadTexture(archive, record, t.getColor32(bitmap, 0));
    // Exterior windows also get their emission mask (R2, MaterialReader
    // semantics: glass texels glow with the active window style).
    if (isExteriorWindow(archive, record)) {
      renderer.uploadEmissionTexture(archive, record, t.getWindowColors32(bitmap));
    }
  };

  // GPU meshes: UVs from the original archive, submesh archives remapped
  // after conversion, verbatim DFU's material-swap order.
  const gpuMeshes = new Map();
  const cpuModels = new Map(); // id -> {positions, indices} for collision
  for (const [id, dfMesh] of dfMeshes) {
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) {
      sm.textureArchive = remap(sm.textureArchive);
      uploadRecord(sm.textureArchive, sm.textureRecord);
    }
    cpuModels.set(id, { positions: model.positions, indices: model.indices });
    gpuMeshes.set(id, renderer.createMesh(model));
  }

  const drawList = [];
  // P2: static geometry collides under one bucket; action doors and
  // Move-flagged action models live in the ActionSystem (own buckets,
  // animated matrices, activation targets).
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider);
  const dynamicDraws = []; // {gpu, object}
  let colliderTris = 0;
  const flatGroups = new Map();
  const dungeonLightList = [];
  uploadRecord(waterArchive, 0); // classic water tile (R11)
  const waterQuads = [];
  for (const b of dungeon.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) {
      const matrix = multiply(originMatrix, p.matrix);
      const cpu = cpuModels.get(p.modelIdNum);
      if (p.action && MOVE_ACTION_FLAGS.has(p.action.actionFlag)) {
        const o = actions.addAction(p.position, cpu, matrix, p.action);
        dynamicDraws.push({ gpu: gpuMeshes.get(p.modelIdNum), object: o });
        continue;
      }
      drawList.push({ mesh: gpuMeshes.get(p.modelIdNum), matrix });
      collider.addMesh('world', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
    }
    for (const d of b.layout.actionDoors) {
      if (d.disabled) continue;
      const matrix = multiply(originMatrix, d.matrix);
      const o = actions.addDoor(cpuModels.get(d.modelIdNum), matrix);
      dynamicDraws.push({ gpu: gpuMeshes.get(d.modelIdNum), object: o });
    }
    for (const f of b.layout.flats) {
      const key = `${f.archive}_${f.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([f.x + b.originX, f.y, f.z + b.originZ]);
    }
    // R6: one point light per RDB Light object, verbatim RDBLayout.AddLight
    // (position (X, -Y, Z) * scale, range = radius * scale * 3). The
    // [Dungeon] prefab flickers every light (Animate on).
    for (const l of collectDungeonLights(b.dfBlock)) {
      dungeonLightList.push({ x: l.x + b.originX, y: l.y, z: l.z + b.originZ, range: l.range });
    }
    // R7: one water plane per watered block, verbatim RDBLayout.AddWater -
    // the block's start-marker water level (10000 = none), plane covering
    // the RDB footprint at y = -waterLevel * GlobalScale.
    if (b.layout.waterLevel !== 10000) {
      waterQuads.push({
        x: b.originX, z: b.originZ, size: RDB_SIDE,
        y: -b.layout.waterLevel * GLOBAL_SCALE,
      });
    }
  }
  const billboardBatches = [];
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    // DFU's RDB AddFlat centers the billboard pivot at the raw position
    // (no AlignToBase, unlike the RMB/interior paths); our batches take
    // BASE positions, so shift down half the height - identical placement.
    const based = centers.map(([x, y, z]) => [x, y - size.h / 2, z]);
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, based));
  }

  // Camera at the start marker (the classic dungeon spawn).
  const spawn = dungeon.startMarker
    ? [dungeon.startMarker.x, dungeon.startMarker.y, dungeon.startMarker.z]
    : [0, 2, 0];
  const cam = { pos: spawn, yaw: 0, pitch: 0 };
  // P2: grounded walking is the default (?fly restores the fly cam);
  // spawn drops onto the start-marker floor.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(collider);
  player.spawn(spawn[0], spawn[1], spawn[2]);
  let prevJump = false;
  let prevUse = false;
  console.log(`player: collider ${colliderTris} tris, ${actions.objects.size} activatables, walk=${walkMode}`);
  const tryActivate = () => {
    const dir = [
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const eye = walkMode ? player.eye : cam.pos;
    const targets = [];
    for (const o of actions.objects.values()) {
      targets.push({
        key: o.key,
        aabb: worldAabb(o.cpu.positions, o.matrix),
        distance: DOOR_ACTIVATION_DISTANCE,
      });
    }
    const key = pickActivatable(eye, dir, targets, collider);
    if (key) actions.activate(key);
    return key;
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
  const nBlocks = dungeon.blocks.length;
  status(`${dungeonName} - ${nBlocks} blocks, ${drawList.length} draws`);
  console.log(
    `dungeon: ${nBlocks} blocks, ${drawList.length} draws, table [${dungeon.textureTable}], ` +
    `start ${JSON.stringify(dungeon.startMarker)}, ${dungeonLightList.length} lights, ${waterQuads.length} water`
  );

  // Verbatim dungeon lighting: PlayerAmbientLight.DungeonAmbientLight,
  // no sun; every light flickers (DaggerfallLight Animate).
  renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
  // Verbatim DungeonFogSettings: exponential 0.005, fog color black.
  renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));
  const flicker = new CityLightAnimator(
    dungeonLightList.length, dungeonLightList.map((l) => l.range));

  if (shotMode) {
    // Probe hooks (parity with the world scene): displace the camera and
    // frame-sync instead of sleeping.
    window.__move = (dx, dy, dz) => { cam.pos[0] += dx; cam.pos[1] += dy; cam.pos[2] += dz; };
    window.__pose = (x, y, z, yaw, pitch) => { cam.pos = [x, y, z]; cam.yaw = yaw; cam.pitch = pitch; };
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => player.spawn(x, y, z),
    };
    window.__activate = () => tryActivate();
    window.__activateKey = (k) => actions.activate(k);
    window.__ray = () => {
      const dir = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
      return collider.raycast(walkMode ? player.eye : cam.pos, dir, 50);
    };
    window.__actions = () => JSON.stringify(
      [...actions.objects.values()].map((o) => ({ key: o.key, state: o.state, t: Number(o.t.toFixed(3)), pos: [o.matrix[12], o.matrix[13], o.matrix[14]].map((v) => Number(v.toFixed(2))) })));
    window.__frame = 0;
  }

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    actions.update(dt);
    if (walkMode) {
      const jumpHeld = keys.has('Space');
      player.update(dt, {
        forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
        strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        run: keys.has('ShiftLeft'),
        jump: jumpHeld && !prevJump,
      }, cam.yaw);
      prevJump = jumpHeld;
      cam.pos = player.eye;
      const useHeld = keys.has('KeyE');
      if (useHeld && !prevUse) tryActivate();
      prevUse = useHeld;
    } else {
      const speed = (keys.has('ShiftLeft') ? 24 : 5) * dt;
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;
    }

    const target = [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 800);
    const view = lookAt(cam.pos, target, [0, 1, 0]);

    flicker.tick(dt);
    renderer.setPointLights(
      nearestLights(dungeonLightList, cam.pos, 16, flicker.ranges),
      new Float32Array(DUNGEON_LIGHT_COLOR));
    renderer.beginFrame(proj, view, lightDir);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix);
    for (const d of dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));
    renderer.drawWater(waterQuads, WATER_COLOR,
      renderer.textures.get(`${waterArchive}_0`),
      (now / 1000) * WATER_SCROLL_TILES_PER_SEC);

    frames++;
    if (shotMode) window.__frame = frames;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
