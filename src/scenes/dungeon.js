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
import { requestLook } from '../player/pointerLock.js';
import { playerEntity } from '../characters/playerEntity.js';   // shot-mode __hp probe
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective } from '../world/mat4.js';
import { PlayerMotor } from '../player/motor.js';
import {
  pickActivatable, activationTargets,
} from '../player/activate.js';
import { fetchBytes } from './shared.js';
import { routeKey } from '../ui/input.js';
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
    { ...pipeline, renderer, arch, palette }, dfLocation, blocks, dfLocation.climate.climateType, { foes: params.has('foes'), playerClass: params.has('class') ? Number(params.get('class')) : undefined, playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined, playerWeapon: params.get('weapon') ?? undefined });

  // Classic water tile: ground archive record 0 for this location's
  // climate (the exterior ground path never routes single records).
  const waterArchive = dfLocation.climate.groundArchive;
  await pipeline.getTexture(waterArchive);
  pipeline.uploadRecord(waterArchive, 0);

  // The classic dungeon spawn - ONE source (ctx.startSpawn: verbatim
  // MovePlayerToMarker + FixStanding). The old raw-marker spawn put
  // the EYE at the marker - feet under the floor, wedged.
  const spawn = ctx.startSpawn();
  const cam = { pos: spawn, yaw: 0, pitch: 0 };
  const shotMode = params.has('shot');
  // P2: grounded walking is the default (?fly restores the fly cam);
  // spawn drops onto the start-marker floor.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(ctx.collider);
  player.spawn(spawn[0], spawn[1], spawn[2]);
  console.log(`[spawn] marker ${JSON.stringify(ctx.startMarker)} -> feet [${spawn.map((v) => v.toFixed(3)).join(', ')}] (startSpawn build)`);
  // P10 Teleport actions: player transform = the destination object's
  // (DFU DaggerfallAction.Teleport). spawn() zeroes velY and drops
  // the grounded flag, so the motor re-grounds on the destination
  // floor next step (the FreezeMotor 0.5s carry-suppression is a
  // no-op in our motor - velocity is per-frame input, not held).
  ctx.actions.onTeleport = ({ pos, yawDeg }) => {
    player.spawn(pos[0], pos[1], pos[2]);
    cam.pos = [...player.eye];
    cam.yaw = yawDeg * Math.PI / 180;
    console.log(`[action] teleport -> [${pos.map((v) => v.toFixed(2)).join(', ')}] yaw ${yawDeg.toFixed(1)}`);
  };
  let prevJump = false;
  let prevCrouch = false;   // P12: the crouch-toggle key edge
  let prevUse = false;
  console.log(`player: collider ${ctx.colliderTris} tris, ${ctx.actions.objects.size} activatables, walk=${walkMode}`);
  const tryActivate = () => {
    const dir = [
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const eye = walkMode ? player.eye : cam.pos;
    const targets = activationTargets(ctx.actions.objects);   // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
    targets.push(...ctx.lootTargets());   // S2: piles + lootable corpses
    const key = pickActivatable(eye, dir, targets, ctx.collider);
    if (key !== null && (key.startsWith('loot:') || key.startsWith('corpse:'))) { ctx.takeLoot(key); return; }
    if (key) ctx.actions.activate(key);
    return key;
  };
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => requestLook(canvas));   // safe: a refused lock never crashes (was bare requestPointerLock - the sh/< crash + lock:N frozen yaw)
  // C8 E3c: RMB drag-to-swing (classic weapon control; menu suppressed)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousedown', (e) => { if (e.button === 2) ctx.playerAttackInput(0, 0, true); });

  addEventListener('keydown', (e) => {
    // The input map (ui/input.js) owns all bindings.
    const dir = () => ({ eye: cam.pos, dir: [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)] });
    if (routeKey(e, ctx, dir, (p) => { player.pos[0] = p[0]; player.pos[1] = p[1]; player.pos[2] = p[2]; })) e.preventDefault();
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) ctx.playerAttackInput(0, 0, false); });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; look/attack ride the same seams as mouse
    look: (dx, dy) => {
      cam.yaw -= dx * 0.0025;
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * 0.0025));
    },
    attack: (dx, dy, held) => ctx.playerAttackInput(dx, dy, held),
    attackTap: () => ctx.playerClickAttack(),
  });
  addEventListener('mousemove', (e) => {
    ctx.reportMouse?.(e.movementX, e.movementY, document.pointerLockElement === canvas);   // raw input truth for F8
    if (document.pointerLockElement === canvas && (e.buttons & 2)) { ctx.playerAttackInput(e.movementX, e.movementY, true); return; }
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
    // Combat probes (2026-08-13 audit): the live-play smoke reads
    // vitals + the foe roster to verify the frame-loop combat path.
    window.__hp = () => JSON.stringify({ health: playerEntity.health, maxHealth: playerEntity.maxHealth });
    window.__foes = () => JSON.stringify(ctx.foes.map((f, i) => ({
      i, type: f.mobileType, dead: !!f.dead, health: f.entity?.health,
      pos: f.ai ? f.ai.feet.map((v) => Number(v.toFixed(2))) : null,
    })));
    window.__frame = 0;
  }

  let frames = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [-Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];   // camera-right = up x back (lookAt handedness): D must move SCREEN-right - the +cos/-sin vector was screen-LEFT (A/D felt swapped)
    const held = ctx.uiOverlayActive;   // overlays HOLD the world: no movers, no motor - typing a name must not walk the player off the start ledge
    if (!held) ctx.actions.update(dt);
    if (walkMode && !held) {
      // Platform riding (Ledger C row -> SHIPPED 2026-08-14): standing
      // on a mover applies its frame delta through the resolver
      // BEFORE the player's own move - the DFU global-point-delta
      // shape. Without this the elevator penetrated the capsule and
      // the nearest-face ejection could throw the player through
      // thin walls (Mac's out-of-bounds report).
      const gk = player.groundKey;
      if (gk && gk !== 'dungeon') {
        const rideO = ctx.actions.objects.get(gk);
        const d = rideO?.frameDelta;
        if (d && (d[0] || d[1] || d[2])) player.collider.move(player.pos, d[0], d[1], d[2]);
      }
      const jumpHeld = keys.has('Space');
      player.fallScale = ctx.playerFallScale;   // S8 slowfall
      // P11: the swim toggle (PlayerEnterExit verbatim - the CENTER
      // (feet + 0.9) + 50*GlobalScale - 0.95 below the block water
      // surface swims) + the Levitate/waterWalking effect consumers.
      // Float keys: Jump/FloatUp = Space/PageUp; FloatDown = PageDown
      // (DFU's default binding; DFU's Crouch alternative is C, which
      // this port binds to castSpell - crouch itself pends).
      const surf = ctx.waterSurfaceYAt(player.pos[0], player.pos[2]);
      player.waterSurfaceY = surf;
      player.swimming = surf != null && player.pos[1] + 0.9 + 50 * 0.025 - 0.95 < surf;
      player.levitating = ctx.playerLevitating();
      player.waterWalking = ctx.playerWaterWalking();
      // S19 paralysis: FrictionMotor cancels ALL movement input (the
      // player still falls / rides platforms), AcrobatMotor cancels
      // the jump, LevitateMotor cancels levitate movement. Look
      // stays live (no DFU gate on mouselook).
      // P12 crouch: toggled on the KeyX edge (DFU's default Crouch C
      // is this port's castSpell - documented departure).
      const paralyzed = ctx.playerParalyzed?.() ?? false;
      const crouchHeld = keys.has('KeyX');
      const moving = !paralyzed && (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD'));
      // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
      // gates movement/jump only (DecideHeightAction has no check).
      player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !prevCrouch } : {
        forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
        strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        run: keys.has('ShiftLeft'),
        jump: jumpHeld && !prevJump,
        up: jumpHeld || keys.has('PageUp'),
        down: keys.has('PageDown'),
        crouch: crouchHeld && !prevCrouch,
      }, cam.yaw, cam.pitch);
      prevJump = jumpHeld;
      prevCrouch = crouchHeld;
      cam.pos = player.eye;
      ctx.reportActivity?.({ running: keys.has('ShiftLeft') && moving, swimming: player.swimming, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed });   // P13: the stealth sneak state
      ctx.reportMotor(player.grounded, player.velY, cam.yaw);
      ctx.reportInput?.([...keys].join('+') || 'none', cam.pitch);
      const useHeld = keys.has('KeyE');
      if (useHeld && !prevUse) tryActivate();
      prevUse = useHeld;
    } else if (!held) {
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
    if (ctx.uiOverlayActive) { ctx.drawOverlay(canvas); requestAnimationFrame(frame); return; }   // U2b/U3: hold gameplay, keep the loop
    ctx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));   // moveHeld: the collision-trigger input gate (verbatim)   // internally gated (S4b: missiles fire without foes)   // C8 E1+E2: rigged class enemies, classic senses + pursuit
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
