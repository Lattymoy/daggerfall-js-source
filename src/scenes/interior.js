// Milestone 4: ?interior=<BLOCKNAME>:<record> renders one building interior
// standalone (e.g. ?interior=MAGEAA00.RMB:0), camera spawned at the Enter
// marker when present.
// P7c: the scene folds onto buildInteriorContext - the exact build the
// world/exterior hosts use for transitions (M4/R8/R12/P4 semantics live
// there); this file is data loading, the fly camera, and the frame loop.

import { Arch3dFile } from '../formats/arch3dFile.js';
import { PITCH_LIMIT } from '../player/mwCamera.js';   // MW-D30: camera.cpp:323-331's own clamp
import { requestLook } from '../player/pointerLock.js';
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { isNight } from '../world/worldClock.js';   // AUDIT 23 (C12)
import { worldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C12)
import { nearestLights } from '../world/cityLights.js';
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { lookAt, perspective, mirrorProjectionX, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { fetchBytes, seasonOverride, ensureAudio } from './shared.js';
import { INTERIOR_SEASON } from '../world/climateSwaps.js';   // A1: DaggerfallInterior.cs:51 - an interior is summer-skinned, always
import { createDataPipeline } from './dataPipeline.js';
import { audio } from '../systems/audio.js';   // WM4c
import { buildInteriorContext } from './interiorContext.js';
import { advanceMachinery, mountMachineryChild, machineryChildPos, MILL_SOUND } from '../world/windmills.js';   // WM4b: the machinery's moving parts; WM4c: its hum
import { lookScale, lookInvert } from '../ui/lookSettings.js';   // AUDIT: the FOURTH host the SETT slice missed
import { LookFilter } from '../player/lookFilter.js';   // AUDIT 28 W7: MouseLookSmoothingFactor
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { windowEmissionRGB } from '../render/windowEmission.js';   // AUDIT 26 F001/F002: WindowStyle per host (DaggerfallInterior.cs:473/:517/:1270 vs GetMaterial's Day default)
import { AutomapWindow, preloadAutomapArt } from '../ui/automapWindow.js';   // ROAD-C c2/S9: the second interior host's M window
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // ROAD-C c2/S9
import { makeFont } from '../ui/text.js';   // ROAD-C c2/S9: the map's status/hover labels
import { FntFile } from '../formats/fntFile.js';   // ROAD-C c2/S9
import { makeWindowStack, pauseWhileOpen } from '../ui/windowStack.js';   // ROAD-tail: UserInterfaceManager's stack, and its PAUSE, for the fourth host
import { installConsoleProbe } from '../systems/consoleCommands.js';   // E3: the console's door
import { swallowBrowserKey } from '../ui/input.js';   // U47: F5/F6/F11 - one list, in ui/input.js

// Milestone 4 scene: one building interior, standalone at block-local origin.
export async function bootInterior(canvas, renderer, params, status) {
  const [blockName, recordStr] = params.get('interior').split(':');
  const recordIndex = Number(recordStr || 0);
  // DFU interiors climate-swap their models (SetClimate with
  // WindowStyle.Disabled - emission stays dark here by default). A
  // standalone block has no location, so ClimateBases.Temperate is the
  // verbatim field default; ?climate= overrides.
  // A1: the season is NOT the calendar's here - DaggerfallInterior.cs
  // :51 declares `climateSeason = ClimateSeason.Summer` and never
  // assigns it, so every interior in the reference is summer-skinned
  // whatever the date outside. ?season= is the probe's override.
  const CLIMATE_PARAM = { desert: 0, mountain: 100, temperate: 300, swamp: 400 };
  const climateBase = CLIMATE_PARAM[(params.get('climate') || 'temperate').toLowerCase()] ?? 300;
  const season = seasonOverride(params) ?? INTERIOR_SEASON;

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
  renderer.setWindowEmission(windowEmissionRGB('disabled'));   // F002: the dev route draws the same Disabled interiors (DaggerfallInterior.cs:473/:517/:1270)
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
  const lookFilter = new LookFilter();   // AUDIT 28 W7: one filter per camera

  // ── ROAD-C c2/S9: THE SECOND INTERIOR HOST'S MAP ────────────────────
  // The FOUR HOSTS rule, applied to the arm this stage builds: the map
  // belongs to the interior CONTEXT, and both hosts that mount one owe
  // it a tick and a door. This scene is the dev route - a fly camera
  // over one building record, no player, no HUD - so its window has no
  // entrance beacon (DFU's building arm is gated on `door.HasValue`,
  // Automap.cs:2482, and there is no entered door here either) and its
  // "player" is the camera. Everything else is the same window.
  let overlay = null;
  /** ROAD-tail: ...and the stack under it, so THIS host's pause is the
   *  same primitive the other three ask. UserInterfaceManager.AddWindow
   *  (:179-186) calls `GameManager.PauseGame(true)` for a
   *  PauseWhileOpen window and RemoveWindow (:190-216) calls
   *  `PauseGame(false)` only when the stack drains; PauseGame
   *  (GameManager.cs:600-635) is the `Time.timeScale = 0` this frame's
   *  gates read. This scene is the dev route - one window, no depth
   *  today - and it is exactly the host the standing watch names: it
   *  took the gate by hand (`if (!overlay)`, and a look gate that was
   *  written `if (!(false))` and so never closed at all), and now it
   *  does not. */
  const windows = makeWindowStack({ onTop: (w) => { overlay = w; } });
  const gamePaused = () => windows.paused() || pauseWhileOpen(overlay);
  let mapFont = null;
  makeFontFor().catch((e) => console.warn('[automap] FONT0003 unavailable:', e?.message ?? e));
  async function makeFontFor() {
    mapFont = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003');
  }
  preloadAutomapArt({ renderer, fetchBytes, palette })
    .catch((e) => console.warn('[automap] native map art unavailable; keyed fallback:', e?.message ?? e));
  const toggleAutomap = () => {
    if (overlay) return;
    // PushWindow (UserInterfaceManager.cs:79-91) - `onTop` writes the
    // slot every reader below already uses, and the latch rises with it.
    windows.pushWindow(new AutomapWindow({
      record: () => ctx.automapRecord(),
      drawList: ctx.drawList, dynamicDraws: ctx.dynamicDraws, texRemap: ctx.texRemap,
      player: () => ({ feet: cam.pos, eye: cam.pos, yaw: cam.yaw }),
      startMarker: null,
      blocks: null,
      arrowMesh: ctx.automapArrow,
      arrowBounds: ctx.automapArrowBounds,
      dungeonName: blockName,
      indexSize: ctx.automapModel.length,
      model: ctx.automapModel,
      insideBuilding: true,
    }));
  };
  const nativeAt = (e) => {
    const r = canvas.getBoundingClientRect();
    return pointToNative(nativeMetrics(canvas),
      (e.clientX - r.left) * (canvas.width / r.width),
      (e.clientY - r.top) * (canvas.height / r.height));
  };
  // ROAD-tail: the slot is nulled by hand here as in every host, and
  // `reconcile` is what turns that into PopWindow - which is what
  // lowers the pause latch (RemoveWindow :201-215).
  const drainOverlay = () => { if (overlay?.done) { overlay.dispose?.(); overlay = null; windows.reconcile(overlay); } };

  const keys = new Set();
  addEventListener('keydown', (e) => {
    // U47: FIRST, before any early return - one list, in ui/input.js.
    // AUDIT 54 (f2/hosts): this host was the FIFTH keydown and the U47
    // rollout enumerated four, so F5 in the ?interior route reloaded
    // the page and destroyed the session - the exact failure AUDIT 17e
    // F41 recorded for the others - and F11 went fullscreen. The law
    // (ui/input.js:282-283) is "every host that registers a keydown
    // calls this FIRST", and it is NOT conditional on the host having
    // a destination for the key. First, because every arm below
    // returns before its own preventDefault - worldModes.js:6125 sits
    // ahead of its arms for the same reason.
    swallowBrowserKey(e);
    // The open map owns the keyboard, exactly as it does in the three
    // hosts that already carry it - including the toggle key, which the
    // window itself defers to its own close.
    if (overlay) { overlay.input(e.code, e); drainOverlay(); e.preventDefault(); return; }
    if (e.code === 'KeyM') { toggleAutomap(); e.preventDefault(); return; }
    keys.add(e.code);
    // DFU parity: any keypress re-engages a dropped lock (no click-to-look mode).
    if (document.pointerLockElement !== canvas) requestLook(canvas);
  });
  // ROAD-E E1: THE KEY-UP ROUTE, the shape the other four hosts carry.
  // An open window owns the keyboard on the way DOWN (the keydown arm
  // above) and had never been told about the way up, so the automap
  // this host mounts could neither close on DFU's key UP nor hold a
  // key down for more than the browser's repeat.
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (!overlay) return;
    overlay.keyup?.(e.code, e);
    drainOverlay();
  });
  canvas.addEventListener('pointerdown', (e) => {
    // An open window withholds the pointer lock (the dungeon.js law) -
    // the drag has to work with the lock released.
    if (overlay) {
      const v = nativeAt(e);
      if (v) overlay.pointer?.('down', v[0], v[1], e.button, { ctrl: !!e.ctrlKey, shift: !!e.shiftKey });
      drainOverlay();
      return;
    }
    requestLook(canvas);
  });
  addEventListener('pointermove', (e) => {
    if (!overlay) return;
    const v = nativeAt(e);
    if (v) { overlay.pointer?.('move', v[0], v[1], 0); overlay.hover?.(v[0], v[1]); }
  });
  addEventListener('pointerup', (e) => {
    if (!overlay) return;
    const v = nativeAt(e);
    overlay.pointer?.('up', v ? v[0] : -1, v ? v[1] : -1, e.button);
    overlay.release?.();   // ROAD-E E1: the latch-dropping edge, for a window with no pointer seam (the list picker's thumb)
    drainOverlay();
  });
  addEventListener('wheel', (e) => { if (overlay) overlay.wheel?.(Math.sign(e.deltaY)); });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    // AUDIT 28 W7: the delta goes to the look filter's target, not the
    // camera - PlayerMouseLook.ApplyLook (:126); the frame pays it out
    // at MouseLookSmoothingFactor. HANDEDNESS (mat4's law): mouse-right
    // turns toward +x = screen-right; the pitch clamp is the filter's.
    lookFilter.add(e.movementX * lookScale(), -e.movementY * lookScale() * lookInvert());
  });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      lookFilter.add(dx * lookScale(), -dy * lookScale() * lookInvert());   // AUDIT 28 W7: through the look filter (HANDEDNESS, mat4's law)
    },
  });

  const shotMode = params.has('shot');
  // E3: the console's door. This host mounts no window that registers a
  // command, but the database is one static class in DFU - every
  // command registered anywhere is reachable from any scene - and the
  // building's own automap registers the three map verbs from
  // interiorContext, so the door is not empty here.
  installConsoleProbe();
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
    // AUDIT 28 W7 + F-C1/F-C2 (self-audit 3): PlayerMouseLook.Update's
    // three answers - paused (:241-244) returns before ApplyLook and the
    // owed look WAITS; a held swing (:248-253, WeaponSwingMode 0, not a
    // bow) is SetFacing(lookCurrent) - the owed look is DROPPED; else
    // ApplySmoothing pays it out at the setting's fraction. Before the
    // camera is read.
    if (!gamePaused()) {
      if (false) lookFilter.settle();
      else lookFilter.tick(dt, cam);
    }
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

    // LT1: per-light range AND colour x intensity - AddLight's whole
    // second switch reaches the GPU (interiorLightProperties).
    const lit = nearestLights(ctx.lights, cam.pos, 16, ctx.lights.map((l) => l.range),
      (l) => [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity]);
    renderer.setPointLights(lit.data, null, lit.colors);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of ctx.drawList) renderer.drawMesh(d.mesh, d.matrix, ctx.texRemap);
    // WM4b: the mill's machinery turns at Kamer's rate, in here too.
    for (const r of ctx.rotors) {
      advanceMachinery(r.state, dt, r.child);
      renderer.drawMesh(r.gpu, mountMachineryChild(r.parent, r.child, r.state.angle), ctx.texRemap);
      // WM4c: the part that carries Spin_Up hums (the gear; the roller's
      // script adds no source). Retried until the context is up.
      if (r.child.loopsSound && !r.hum) r.hum = audio.loop3d(MILL_SOUND.clip, machineryChildPos(r.parent, r.child), MILL_SOUND.volume, MILL_SOUND);
    }
    // Swing doors (P4) draw at rest through their ActionSystem matrices;
    // the standalone scene has no activation path, so they stay closed.
    for (const d of ctx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, ctx.texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    ctx.flatAnims.tick(dt);   // FA1: whoever draws the flats runs their clock
    renderer.drawBillboards(ctx.billboardBatches, camRight, UP_Y);

    // ROAD-C c2/S9: the 5 Hz reveal probes and the map over them. The
    // probe PAUSES while the window is up: its driver is not Update but
    // CoroutineCheckForNewlyDiscoveredMeshes (Automap.cs:1280-1291),
    // whose body is `if (!isOpenAutomap) { CheckForNewlyDiscoveredMeshes(); }`
    // - the coroutine keeps its 1/scanRate cadence and simply skips the
    // scan, for the reason DFU states on the gate (SetActive(false) on
    // the geometry would mess with the open map's rendering). Update's
    // own call at :1001 is the one-shot lazy init, not a per-frame
    // driver. dungeon.js:520 and worldModes.js:4450/:4546 gate the same
    // way; this is that gate for this host.
    if (!gamePaused()) ctx.automapTick?.(dt, cam.pos, fwd);
    if (overlay) {
      overlay.tick(dt);
      drainOverlay();
      if (overlay) overlay.draw(renderer, canvas, mapFont, 1);
    }

    frames++;
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
