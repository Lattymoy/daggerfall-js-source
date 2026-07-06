// Milestone 5: ?dungeon=<n> (&region=) renders a full dungeon (default
// Privateer's Hold), camera at the start marker, per-dungeon texture table
// applied exactly as DFU's SetDungeonTextures (UVs keep original-archive
// sizes; pixels come from the remapped archive).
// P7c: the scene folds onto buildDungeonContext - the exact build the
// world/exterior hosts use for transitions (M5/M6/R6/R7/R11/P2 semantics
// live there; the table is a draw-time texRemap, the dungeon convention
// already on record); this file is data loading, walking + activation,
// and the frame loop.

import { Arch3dFile } from '../formats/arch3dFile.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective } from '../world/mat4.js';
import { PlayerMotor } from '../player/motor.js';
import {
  pickActivatable, worldAabb, DOOR_ACTIVATION_DISTANCE,
} from '../player/activate.js';
import { fetchBytes } from './shared.js';
import { createDataPipeline } from './dataPipeline.js';
import { buildDungeonContext } from './dungeonContext.js';

// Water surface color: presentation choice (see renderer WATER_VS note).
// R11: the surface is the classic water tile (climate ground archive
// record 0 - the 0xFF tilemap sentinel's target, same picture classic
// tiles across oceans), tinted only by alpha; slow diagonal scroll is
// the classic flow, presentation-tuned.
const WATER_COLOR = [1, 1, 1, 0.82];
const WATER_SCROLL_TILES_PER_SEC = 0.05;

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
  const pipeline = createDataPipeline({ renderer, arch, palette });
  const ctx = await buildDungeonContext(
    { ...pipeline, renderer, arch, palette }, dfLocation, blocks, dfLocation.climate.climateType, { foes: params.has('foes') });

  // Classic water tile: ground archive record 0 for this location's
  // climate (the exterior ground path never routes single records).
  const waterArchive = dfLocation.climate.groundArchive;
  await pipeline.getTexture(waterArchive);
  pipeline.uploadRecord(waterArchive, 0);

  // Camera at the start marker (the classic dungeon spawn).
  const spawn = ctx.startMarker
    ? [ctx.startMarker.x, ctx.startMarker.y, ctx.startMarker.z]
    : [0, 2, 0];
  const cam = { pos: spawn, yaw: 0, pitch: 0 };
  const shotMode = params.has('shot');
  // P2: grounded walking is the default (?fly restores the fly cam);
  // spawn drops onto the start-marker floor.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(ctx.collider);
  player.spawn(spawn[0], spawn[1], spawn[2]);
  let prevJump = false;
  let prevUse = false;
  console.log(`player: collider ${ctx.colliderTris} tris, ${ctx.actions.objects.size} activatables, walk=${walkMode}`);
  const tryActivate = () => {
    const dir = [
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const eye = walkMode ? player.eye : cam.pos;
    const targets = [];
    for (const o of ctx.actions.objects.values()) {
      targets.push({
        key: o.key,
        aabb: worldAabb(o.cpu.positions, o.matrix),
        distance: DOOR_ACTIVATION_DISTANCE,
      });
    }
    const key = pickActivatable(eye, dir, targets, ctx.collider);
    if (key) ctx.actions.activate(key);
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

  status(`${dungeonName} - ${ctx.blockCount} blocks, ${ctx.drawList.length} draws`);
  console.log(
    `dungeon: ${ctx.blockCount} blocks, ${ctx.drawList.length} draws, table [${ctx.textureTable}], ` +
    `start ${JSON.stringify(ctx.startMarker)}, ${ctx.lights.length} lights, ${ctx.waterQuads.length} water, ${ctx.enemies.length} enemies`
  );

  // Verbatim dungeon lighting: PlayerAmbientLight.DungeonAmbientLight,
  // no sun; every light flickers (DaggerfallLight Animate).
  renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
  // Verbatim DungeonFogSettings: exponential 0.005, fog color black.
  renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));

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
    window.__activateKey = (k) => ctx.actions.activate(k);
    window.__ray = () => {
      const dir = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
      return ctx.collider.raycast(walkMode ? player.eye : cam.pos, dir, 50);
    };
    window.__actions = () => JSON.stringify(
      [...ctx.actions.objects.values()].map((o) => ({ key: o.key, state: o.state, t: Number(o.t.toFixed(3)), pos: [o.matrix[12], o.matrix[13], o.matrix[14]].map((v) => Number(v.toFixed(2))) })));
    window.__frame = 0;
  }

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [-Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];   // camera-right = up x back (lookAt handedness): D must move SCREEN-right - the +cos/-sin vector was screen-LEFT (A/D felt swapped)
    ctx.actions.update(dt);
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

    ctx.flicker.tick(dt);
    renderer.setPointLights(
      nearestLights(ctx.lights, cam.pos, 16, ctx.flicker.ranges),
      new Float32Array(DUNGEON_LIGHT_COLOR));
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of ctx.drawList) renderer.drawMesh(d.mesh, d.matrix, ctx.texRemap);
    for (const d of ctx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, ctx.texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    renderer.drawBillboards(ctx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
    if (ctx.foes.length) ctx.drawFoes(dt, canvas, proj, view, cam.pos);   // C8 E1: rigged class enemies through the shared pixelize pass
    renderer.drawWater(ctx.waterQuads, WATER_COLOR,
      renderer.textures.get(`${waterArchive}_0`),
      (now / 1000) * WATER_SCROLL_TILES_PER_SEC);

    frames++;
    if (shotMode) window.__frame = frames;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
