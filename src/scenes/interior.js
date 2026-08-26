// Milestone 4: ?interior=<BLOCKNAME>:<record> renders one building interior
// standalone (e.g. ?interior=MAGEAA00.RMB:0), camera spawned at the Enter
// marker when present.
// P7c: the scene folds onto buildInteriorContext - the exact build the
// world/exterior hosts use for transitions (M4/R8/R12/P4 semantics live
// there); this file is data loading, the fly camera, and the frame loop.

import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook } from '../player/pointerLock.js';
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_LIGHT_COLOR, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { isNight } from '../world/worldClock.js';   // AUDIT 23 (C12)
import { windowEmissionRGB } from '../render/windowEmission.js';   // AUDIT 26 (hosts-modal F001): the interior's WindowStyle.Disabled
import { worldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C12)
import { nearestLights } from '../world/cityLights.js';
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { lookAt, perspective, mirrorProjectionX } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { fetchBytes, parseSeason, ensureAudio } from './shared.js';
import { createDataPipeline } from './dataPipeline.js';
import { buildInteriorContext } from './interiorContext.js';
import { lookScale, lookInvert } from '../ui/lookSettings.js';   // AUDIT: the FOURTH host the SETT slice missed
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts

// Milestone 4 scene: one building interior, standalone at block-local origin.
export async function bootInterior(canvas, renderer, params, status) {
  const [blockName, recordStr] = params.get('interior').split(':');
  const recordIndex = Number(recordStr || 0);
  // DFU interiors climate-swap their models (SetClimate with
  // WindowStyle.Disabled - the window emission the frame sets below). A
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

  status(`laying out ${blockName}:${recordIndex}`);
  const pipeline = createDataPipeline({ renderer, arch, palette });
  // AUDIT 18 HOST GAP: the audio engine's bootstrap lived only in
  // buildDungeonContext, so every sound in this host was a silent
  // no-op until a dungeon was entered (DFU's sound reader is global
  // and the exterior prefab is audible from frame one).
  ensureAudio(fetchBytes);

  const ctx = await buildInteriorContext(
    { ...pipeline, renderer }, dfBlock, blockIndex, recordIndex, climateBase, season);

  // R8: verbatim interior ambient; verbatim InteriorFogSettings
  // (exponential 0.001, fog color black).
  renderer.setLighting(new Float32Array(isNight(worldMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT), 0);   // AUDIT 23 (C12): PlayerAmbientLight.cs:75-80
  // DaggerfallInterior.cs:473/:517/:1270 - SetClimate(..., WindowStyle
  // .Disabled), and Disabled is EmissionColor = Color.black
  // (MaterialReader.cs:934-936). "Dark by default" was not true: the
  // boot sets the global emission to Day for every scene (main.js:67),
  // so this host has to state the interior's own style like the modal
  // host does.
  renderer.setWindowEmission(windowEmissionRGB('disabled'));
  renderer.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));

  // Camera at the Enter marker when present, else the first placement,
  // facing the interior's bounding center (the marker sits at the entry
  // door, so yaw 0 would stare into it).
  const bb = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const p of ctx.drawList) {
    bb.minX = Math.min(bb.minX, p.matrix[12]); bb.maxX = Math.max(bb.maxX, p.matrix[12]);
    bb.minZ = Math.min(bb.minZ, p.matrix[14]); bb.maxZ = Math.max(bb.maxZ, p.matrix[14]);
  }
  const centerX = (bb.minX + bb.maxX) / 2;
  const centerZ = (bb.minZ + bb.maxZ) / 2;
  const enter = ctx.markers.find((m) => m.type === INTERIOR_MARKER.ENTER);
  const spawn = enter
    ? [enter.x, enter.y + 1, enter.z]
    : [ctx.drawList[0].matrix[12], 1.5, ctx.drawList[0].matrix[14]];
  const cam = {
    pos: spawn,
    yaw: Math.atan2(centerX - spawn[0], centerZ - spawn[2]),
    pitch: 0,
  };
  const keys = new Set();
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    // DFU parity: any keypress re-engages a dropped lock (no click-to-look mode).
    if (document.pointerLockElement !== canvas) requestLook(canvas);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => requestLook(canvas));
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    cam.yaw += e.movementX * lookScale();   // HANDEDNESS (mat4's law): mouse-right turns toward +x = screen-right
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * lookScale() * lookInvert()));
  });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      cam.yaw += dx * lookScale();   // HANDEDNESS (mat4's law)
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * lookScale() * lookInvert()));
    },
  });

  const shotMode = params.has('shot');
  status(`${blockName}:${recordIndex} - ${ctx.drawList.length} draws`);
  console.log(
    `interior: ${ctx.drawList.length} models, ${ctx.dynamicDraws.length} action doors, ` +
    `${ctx.flatCount} flats, ${ctx.markers.length} markers, ${ctx.doors.length} static doors, ` +
    `climate ${climateBase}, season ${season}, ${ctx.texRemap.size} swaps, ${ctx.lights.length} lights, ${ctx.people.length} people`
  );

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];   // HANDEDNESS (mat4's law): screen-right = (cos, 0, -sin) under the mirrored projection - Unity's own right
    const speed = (keys.has('ShiftLeft') ? 12 : 3) * dt;
    if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
    if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
    if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
    if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;

    const target = [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const proj = mirrorProjectionX(perspective(fieldOfView(), canvas.clientWidth / canvas.clientHeight, 0.05, 500));   // HANDEDNESS (mat4's law)
    const view = lookAt(cam.pos, target, [0, 1, 0]);

    renderer.setPointLights(
      nearestLights(ctx.lights, cam.pos, 16, ctx.lights.map((l) => l.range)),   // per-light range (DaggerfallInterior.AddLight); a scalar drops the per-record switch
      // l.intensity / l.color (AddLight's same switch) are carried but
      // not uploadable - one shared colour uniform; see interiorLights.js.
      new Float32Array(INTERIOR_LIGHT_COLOR));
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of ctx.drawList) renderer.drawMesh(d.mesh, d.matrix, ctx.texRemap);
    // Swing doors (P4) draw at rest through their ActionSystem matrices;
    // the standalone scene has no activation path, so they stay closed.
    for (const d of ctx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, ctx.texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    ctx.flatAnims.tick(dt);   // FA1: whoever draws the flats runs their clock
    renderer.drawBillboards(ctx.billboardBatches, camRight, new Float32Array([0, 1, 0]));

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
