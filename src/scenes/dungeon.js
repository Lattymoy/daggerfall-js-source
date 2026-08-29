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
import { getInteractionMode, setInteractionMode } from '../player/interactionMode.js';   // R1: the global PlayerActivate mode
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { audio } from '../systems/audio.js';   // FS-slice: the stride plays flat 2D, as PlayerFootsteps' customAudioSource does
import { requestLook, makeLookGate, bindCursorToggle } from '../player/pointerLock.js';   // U45: PlayerMouseLook.cursorActive
import { playerEntity } from '../characters/playerEntity.js';   // shot-mode __hp probe
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { lookAt, perspective, mirrorProjectionX } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { PlayerMotor } from '../player/motor.js';
import { jumpSpeedMultiplier } from '../systems/skills.js';
import {
  pickActivatable, activationTargets,
} from '../player/activate.js';
import { createMusicDirector, fetchBytes, motorStats, climbingDeps, ridePlatform, doorSpellFor, wireDoorSpells, claimFrame, frameAlive } from './shared.js';
import { routeKey, held, moveHeld, anyMove, actionOf, swallowBrowserKey } from '../ui/input.js';
import { capturePendingScreenshot } from '../systems/saveSlots.js';   // SS1: the context arms the shot, THIS loop delivers it
import { routeLargeHudClick } from '../ui/hudLarge.js';   // U45: the bar's eleven panels
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { createDataPipeline } from './dataPipeline.js';
import { buildDungeonContext } from './dungeonContext.js';
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // U14: the overlay pointer seam
import { lookScale, lookInvert } from '../ui/lookSettings.js';   // SETT: MouseLookSensitivity + InvertMouseVertical
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { totalWeight } from '../systems/inventory.js';   // F027: PlayerEntity.CarriedWeight
import { windowEmissionRGB } from '../render/windowEmission.js';   // AUDIT 26 F001/F002: WindowStyle per host (DaggerfallInterior.cs:473/:517/:1270 vs GetMaterial's Day default)

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
  let _poseCam = null;   // AUDIT 26 F222: filled once the camera exists
  let _motorRef = null;   // DC1: filled once the motor exists (the same late-bound shape)
  const ctx = await buildDungeonContext(
    { ...pipeline, renderer, arch, palette }, dfLocation, blocks, dfLocation.climate.climateType, { foes: !params.has('nofoes'), playerClass: params.has('class') ? Number(params.get('class')) : undefined, playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined, playerWeapon: params.get('weapon') ?? undefined,
      // AUDIT 26 F222/F223: the dev scene's half of the pose. The cam
      // is created AFTER the context (from startSpawn), so the seam
      // closes over the slot lazily.
      pose: {
        read: () => (_poseCam ? { yaw: _poseCam.yaw, pitch: _poseCam.pitch } : {}),
        apply: (p) => { if (_poseCam) { _poseCam.yaw = p.yaw ?? _poseCam.yaw; _poseCam.pitch = p.pitch ?? _poseCam.pitch; } },
      },
      // DC1: the death sequence starts from the LIVE eye and capsule
      // (a crouched death). Late-bound like pose - the motor is built
      // below, after this context; null falls to standing defaults.
      motorState: () => (_motorRef ? { eyeLevel: _motorRef.eye[1] - _motorRef.pos[1], capsule: _motorRef.height } : null) });

  // U21: the menu's LOAD GAME. The context is built, so restore into
  // it through the host's own quickLoad - the same call F12 makes -
  // rather than teaching the menu a second way to load. quickLoad
  // hands the saved position back through its setPlayerPos callback;
  // holding it here lets the spawn below prefer it over the start
  // marker, so a load lands where the save was taken.
  let loadedPos = null;
  if (params.has('load')) ctx.quickLoad((p) => { loadedPos = p ? [...p] : null; });

  // Classic water tile: ground archive record 0 for this location's
  // climate (the exterior ground path never routes single records).
  const waterArchive = dfLocation.climate.groundArchive;
  await pipeline.getTexture(waterArchive);
  pipeline.uploadRecord(waterArchive, 0);

  // The classic dungeon spawn - ONE source (ctx.startSpawn: verbatim
  // MovePlayerToMarker + FixStanding). The old raw-marker spawn put
  // the EYE at the marker - feet under the floor, wedged.
  // DE1: the standalone host is StartDungeonInterior by definition -
  // it starts the player inside a dungeon with no exterior to have
  // walked in from - so it keeps preferEnterMarker's default TRUE.
  // This is the host the enter-marker preference was written for; DE1
  // found it applied to the door transition as well, which is the
  // other member and takes the start marker.
  const spawn = loadedPos ?? ctx.startSpawn() ?? [0, 2, 0];   // U21: a loaded game resumes where it was saved
  const cam = { pos: spawn, yaw: 0, pitch: 0 };
  _poseCam = cam;   // AUDIT 26 F222: the pose seam's late-bound camera
  const shotMode = params.has('shot');
  // P2: grounded walking is the default (?fly restores the fly cam);
  // spawn drops onto the start-marker floor.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(ctx.collider, motorStats(playerEntity), { jumpBoost: () => jumpSpeedMultiplier(playerEntity), carriedWeight: () => totalWeight(playerEntity.items ?? []), climbing: climbingDeps(playerEntity) });   // AcrobatMotor skill jump (P14) + M3 climbing (no HUD seam in the standalone host); motorStats = the LIVE entity
  _motorRef = player;   // DC1: the motorState seam binds here
    const _footsteps = new FootstepMachine();   // FS-slice
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
  let prevCrouch = false;   // P12: the crouch-toggle key edge (jump is HELD - P14)
  let prevUse = false;
  console.log(`player: collider ${ctx.colliderTris} tris, ${ctx.actions.objects.size} activatables, walk=${walkMode}`);
  let zPrev = false;   // ReadyWeapon (Z) edge state
  const tryActivate = () => {
    const dir = [
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const eye = walkMode ? player.eye : cam.pos;
    const targets = activationTargets(ctx.actions.objects);   // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
    targets.push(...ctx.lootTargets());   // S2: piles + lootable corpses
    const key = pickActivatable(eye, dir, targets, ctx.collider);
    // U26: the player's OWN dropped piles are loot targets too, and
    // they carry the droppedLoot: prefix. Without this arm a dungeon
    // drop was one-way - the pile drew, the ray found it, and E did
    // nothing. The probe caught it on the first pickup.
    if (key !== null && (key.startsWith('loot:') || key.startsWith('corpse:') || key.startsWith('droppedLoot:'))) {
      ctx.takeLoot(key);
      return key;
    }
    if (key) ctx.actions.activate(key, { steal: getInteractionMode() === 'steal', doorSpell: doorSpellFor(playerEntity) });   // R1: Steal mode picks a locked door; X1: an armed Open/Lock fires here
    return key;
  };
  const keys = new Set();
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'AltLeft') e.preventDefault();
    // R1: F1-F4 switch the interaction mode here too - DFU's
    // currentMode is global and the standalone dungeon has no townTalk
    // to carry the keydown. Same keys, same line.
    const im = { F1: 'steal', F2: 'grab', F3: 'info', F4: 'dialogue' }[e.code];
    if (im) {
      e.preventDefault();   // ALWAYS consumed - a repeat press must not reach the browser (F1 = help)
      if (im !== getInteractionMode()) { setInteractionMode(im); ctx.hudSay?.(`Interaction is now in ${im} mode.`); }
    }
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!ctx.uiOverlayActive && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'AltLeft') e.preventDefault(); });
  // U14: an OPEN overlay owns the pointer - the click goes to the
  // window, not to the pointer lock. This host had no pointer path at
  // all, so chargen here was keyboard-only while the exterior hosts
  // had been clickable since U8b.
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    if (ctx.uiOverlayActive) {
      const v = pointToNative(nativeMetrics(canvas), px, py);
      if (v && ctx.overlayClick?.(v[0], v[1], e.button === 2)) return;
      return;   // a window is up: never grab the pointer behind it
    }
    // U45: the large HUD's eleven panels, BEFORE the relock - a click
    // on the bar is a button press, never a grab for the pointer. The
    // ctx it routes into is the SAME one routeKey uses, which is the
    // whole point of pulling routeAction out of it.
    if (routeLargeHudClick(px, py, e.button, ctx, { windowUp: ctx.uiOverlayActive })) return;
    requestLook(canvas);   // safe: a refused lock never crashes (was bare requestPointerLock - the sh/< crash + lock:N frozen yaw)
  });
  // U-scroll: the wheel reaches an open window (question scroll, list
  // pickers); passive:false so the page never scrolls under the game.
  canvas.addEventListener('wheel', (e) => {
    if (!ctx.uiOverlayActive) return;
    e.preventDefault();
    ctx.overlayWheel?.(Math.sign(e.deltaY));
  }, { passive: false });
  // C8 E3c: RMB drag-to-swing (classic weapon control; menu suppressed)
  // U45: Actions.ActivateCursor (Enter) frees the mouse during play.
  bindCursorToggle(canvas, () => ctx.uiOverlayActive, actionOf);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousedown', (e) => { if (e.button === 2 && !ctx.uiOverlayActive) ctx.playerAttackInput(0, 0, true); });   // I4: a right-click on a window is the window's (the remove gesture), never a swing

  addEventListener('keydown', (e) => {
    // The input map (ui/input.js) owns all bindings.
    // AUDIT 23 (hosts-6) - AUDIT 17e F41's own law, which only the
    // exterior hosts carried: swallowing the browser reload is not
    // optional. F5 under a keyed overlay (rest, level-up, chargen)
    // fell through routeKey's overlay branch and reloaded the page.
    swallowBrowserKey(e);   // U47: F11 joined F5/F6 - one list, in ui/input.js
    // I2 FOLLOW-UP: routeKey lost its castDir parameter when the cast
    // key became the spellbook opener, and this host was the one call
    // site not updated - it still passed the old `dir` thunk, which
    // landed in setPlayerPos, so a quickload here restored the
    // character and left them standing wherever they were.
    if (routeKey(e, ctx, (p) => player.spawn(p[0], p[1], p[2]))) e.preventDefault();   // P14: a load clears motion state (DFU CancelMovement + ClearFallingDamage)
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) ctx.playerAttackInput(0, 0, false); });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; look/attack ride the same seams as mouse
    look: (dx, dy) => {
      cam.yaw += dx * lookScale();   // HANDEDNESS (mat4's law)
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * lookScale() * lookInvert()));
    },
    attack: (dx, dy, held) => ctx.playerAttackInput(dx, dy, held),
    attackTap: () => ctx.playerClickAttack(),
  });
  addEventListener('mousemove', (e) => {
    ctx.reportMouse?.(e.movementX, e.movementY, document.pointerLockElement === canvas);   // raw input truth for F8
    // U37: a window frees the mouse, so an open overlay gets the HOVER
    // (native coords) instead of the look delta.
    trackHudPointer(canvas, e);   // U46: the spell-icon rows' tooltip, before the overlay return
    if (ctx.uiOverlayActive) {
      const r = canvas.getBoundingClientRect();
      const v = pointToNative(nativeMetrics(canvas),
        (e.clientX - r.left) * (canvas.width / r.width),
        (e.clientY - r.top) * (canvas.height / r.height));
      ctx.overlayHover?.(v ? v[0] : -1, v ? v[1] : -1);
      return;
    }
    if (document.pointerLockElement === canvas && (e.buttons & 2)) { ctx.playerAttackInput(e.movementX, e.movementY, true); return; }
    if (document.pointerLockElement !== canvas) return;
    cam.yaw += e.movementX * lookScale();   // HANDEDNESS (mat4's law): mouse-right turns toward +x = screen-right
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * lookScale() * lookInvert()));
  });

  status(`${dungeonName} - ${ctx.blockCount} blocks, ${ctx.drawList.length} draws`);
  console.log(
    `dungeon: ${ctx.blockCount} blocks, ${ctx.drawList.length} draws, table [${ctx.textureTable}], ` +
    `start ${JSON.stringify(ctx.startMarker)}, ${ctx.lights.length} lights, ${ctx.waterQuads.length} water, ${ctx.enemies.length} enemies`
  );

  // Verbatim dungeon lighting: PlayerAmbientLight.DungeonAmbientLight,
  // no sun; every light flickers (DaggerfallLight Animate).
  renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
  renderer.setWindowEmission(windowEmissionRGB('day'));   // F001: SetDungeonTextures keeps GetMaterial's Day default (MaterialReader.cs:456-461)
  // Verbatim DungeonFogSettings: exponential 0.005, fog color black.
  renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));

  if (shotMode) {
    // Probe hooks (parity with the world scene): displace the camera and
    // frame-sync instead of sleeping.
    window.__move = (dx, dy, dz) => { cam.pos[0] += dx; cam.pos[1] += dy; cam.pos[2] += dz; };
    window.__pose = (x, y, z, yaw, pitch) => { cam.pos = [x, y, z]; cam.yaw = yaw; cam.pitch = pitch; };
    window.__player = {
      get pos() { return [...player.pos]; },
      get eye() { return [...player.eye]; },   // I2 probe surface: the crouch drop is visible here
      warp: (x, y, z) => player.spawn(x, y, z),
    };
    window.__chargenFlow = () => ctx.chargenFlow?.() ?? null;   // AUDIT 17i probe surface
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
    // U26: the dungeon's overlay, for the native-inventory probe. The
    // window's own surface (mode/tab/box) rather than just its name.
    window.__overlay = () => {
      const w = ctx.overlayWindow?.();
      if (!w) return null;
      return JSON.stringify({
        kind: w.constructor.name, mode: w.mode ?? null, tab: w.tab ?? null,
        local: w._filtered?.().length ?? null, remote: w._remote?.().length ?? null,
        box: (w.topBox?.rows ?? []).map((r) => r.text ?? r).join(' | ') || null,
      });
    };
    window.__overlayWindow = () => ctx.overlayWindow?.() ?? null;   // U37 probe surface: the live window itself
    window.__overlayKey = (code) => ctx.overlayInput(code, { code, key: code });
    window.__overlayClick = (vx, vy) => ctx.overlayClick(vx, vy);
    window.__toggleInventory = () => { ctx.toggleInventory(); return window.__overlay(); };
    window.__piles = () => JSON.stringify(ctx.dropped?.().map((p) => ({ n: p.items.length, flat: !!p.batch })) ?? []);
    // The fist repro (2026-08-18): the entity + the rig's two combat
    // entries, so a probe can strip the worn weapon and swing bare.
    window.__playerEntity = playerEntity;
    window.__combat = { toggleSheath: ctx.toggleSheath, clickAttack: ctx.playerClickAttack, applySpellToPlayer: ctx.applySpellToPlayer };   // S24
    window.__foes = () => JSON.stringify(ctx.foes.map((f, i) => ({
      i, type: f.mobileType, dead: !!f.dead, health: f.entity?.health,
      // V1: the DESTROY-vs-KILL discriminator. damageFoe spawns a
      // corpse billboard; removeFoe (Destroy(gameObject)) never
      // does. Nothing else distinguishes the two from outside.
      corpse: !!f.corpseBatch,
      pos: f.ai ? f.ai.feet.map((v) => Number(v.toFixed(2))) : null,
      yaw: f.ai ? Number(f.ai.yaw.toFixed(3)) : null,   // C11: the sprite-orientation probe reads it
      sprite: f.mobile ? { state: f.mobile.state, o: f.mobile.orientation, frame: f.mobile.frame } : null,
    })));
    // V1 probe surface (X4-X9): the LIVE foe records, not the JSON
    // summary above. The nearby scan and the pacify door both act on
    // the record itself - its ai flags, its entity, its position - so
    // a probe that only sees the summary cannot exercise either.
    window.__foeRecord = (i) => ctx.foes[i] ?? null;
    // V3: kill a foe through the REAL damage door, where the Soul
    // Trap intercept sits. Returns the foe's live state after.
    window.__damageFoe = (i, n) => {
      const f = ctx.foes[i];
      if (!f) return null;
      ctx.damageFoe(f, n ?? (f.entity?.health ?? 1), null, null);
      return JSON.stringify({ dead: !!f.dead, health: f.entity?.health, corpse: !!f.corpseBatch });
    };
    window.__liveFoeRecords = () => ctx.foes
      .filter((f) => !f.dead && f.ai)
      .map((f) => ({ ref: f, pos: f.ai.feet,
        mobileType: f.mobileType ?? f.entity?.mobileType ?? 128,
        effectCount: (f.entity?.activeEffects ?? []).filter((a) => !a.ended).length }));
    window.__frame = 0;
    window.__renderer = renderer;   // U38 probe surface: the live draw path
    // X11 probe surface: the Light effect's candle, as the DRAW PATH
    // sees it. `light` is what the host prepends; `first` is the vec4
    // the renderer actually holds after setPointLights, which is the
    // only way to tell "the candle exists" from "the candle reaches
    // the shader".
    window.__castAtFoe = (spell, foe, caster) => ctx.castAtFoe(spell, foe, caster);
    window.__foeSinksFor = (foe) => ctx.foeSinksFor(foe);
    window.__candle = () => JSON.stringify({
      light: ctx.candleLight?.() ?? null,
      first: [...(renderer._pointLights ?? [])].slice(0, 4),
      count: (renderer._pointLights?.length ?? 0) / 4,
      // T1: the WHOLE array, so a probe can find the torch's own vec4
      // rather than guessing which slot it landed in.
      all: [...(renderer._pointLights ?? [])],
    });
  }

  let frames = 0;
  let last = performance.now();
  // AUDIT 19 / 1:1: this host gets the SAME music director as the other
  // three. Removing dungeonContext's own playFrom without giving this host
  // a director left ?dungeon silent - the host-gap shape, committed by the
  // very pass that was closing it. The pin below now sweeps ALL FOUR.
  const musicDirector = createMusicDirector();
  const lookGate = makeLookGate(canvas);
  const _frameToken = claimFrame();   // P0: this session owns the loop until someone claims after it
  function frame(now) {
    if (!frameAlive(_frameToken)) return;   // P0: a later boot or an unwind killed this loop
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];   // HANDEDNESS (mat4's law): screen-right = (cos, 0, -sin) under the mirrored projection - Unity's own right
    const overlayHeld = ctx.uiOverlayActive;   // overlays HOLD the world: no movers, no motor - typing a name must not walk the player off the start ledge
    lookGate(overlayHeld);   // a window up frees the cursor; closing re-locks
    if (!overlayHeld) ctx.actions.update(dt);
    if (!overlayHeld) ctx.automapTick?.(dt, cam.pos, fwd);   // A1: the 5 Hz reveal probes (paused under overlays, as DFU's coroutine pauses under the open map)
    if (walkMode && !overlayHeld) {
      // Platform riding (Ledger C row -> SHIPPED 2026-08-14): standing
      // on a mover applies its frame delta through the resolver
      // BEFORE the player's own move - the DFU global-point-delta
      // shape. Without this the elevator penetrated the capsule and
      // the nearest-face ejection could throw the player through
      // thin walls (Mac's out-of-bounds report).
      // AUDIT 18: extracted to shared.js so the worldModes host (which
      // had dropped it entirely) cannot half-apply it again.
      ridePlatform(player, ctx.actions);
      const jumpHeld = held(keys, 'Jump');
      player.slowFalling = ctx.playerSlowFalling;   // S8 slowfall (P14: the verbatim constant-speed law lives in the motor)
      // P11: the swim toggle (PlayerEnterExit verbatim - the CENTER
      // + 50*GlobalScale - 0.95 below the block water surface swims)
      // + the Levitate/waterWalking effect consumers. AUDIT 24 player:
      // the centre is the LIVE capsule's (feet + height/2), and a
      // swimmer is force-crouched, so the toggle and the motor's
      // surface clamp track each other exactly as DFU's do.
      // Float: Jump/FloatUp = Space/PageUp; FloatDown = PageDown
      // (DFU's defaults, read through the I2 registry).
      const surf = ctx.waterSurfaceYAt(player.pos[0], player.pos[2]);
      player.waterSurfaceY = surf;
      player.swimming = surf != null && player.pos[1] + player.height / 2 + 50 * 0.025 - 0.95 < surf;
      player.levitating = ctx.playerLevitating();
      player.waterWalking = ctx.playerWaterWalking();
      // S19 paralysis: FrictionMotor cancels ALL movement input (the
      // player still falls / rides platforms), AcrobatMotor cancels
      // the jump, LevitateMotor cancels levitate movement. Look
      // stays live (no DFU gate on mouselook).
      // P12 crouch: toggled on the Crouch edge (DFU's default C -
      // I2 retired the port's X-crouch/C-cast departure).
      const paralyzed = ctx.playerParalyzed?.() ?? false;
      const crouchHeld = held(keys, 'Crouch');
      const mv = moveHeld(keys);
      const moving = !paralyzed && anyMove(mv);
      // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
      // gates movement/jump only (DecideHeightAction has no check).
      player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !prevCrouch } : {
        forward: (mv.forwards ? 1 : 0) - (mv.backwards ? 1 : 0),
        strafe: (mv.right ? 1 : 0) - (mv.left ? 1 : 0),
        run: held(keys, 'Run'),
        sneak: held(keys, 'Sneak'),   // P15: DFU's default Sneak binding (LeftAlt), held
        jump: jumpHeld,   // P14: HELD, verbatim (AcrobatMotor re-fires past the 0.1 s grounded gate - intended bunny-hopping)
        up: jumpHeld || held(keys, 'FloatUp'),
        // AUDIT 26 F031: LevitateMotor's descent arm is Crouch OR
        // FloatDown (:88-89), the mirror of the rise arm above; the
        // port's own motor contract said so and every host passed
        // FloatDown alone, so C did nothing but toggle the stance.
        down: crouchHeld || held(keys, 'FloatDown'),
        crouch: crouchHeld && !prevCrouch,
      }, cam.yaw, cam.pitch);
      prevCrouch = crouchHeld;
      // FS-slice: PlayerFootsteps - the dungeon stride on stone with
      // the water arms (shallow = capsule center 0.57 under the line).
      {
        const _step = _footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          standingStill: !moving,
          halfSpeed: player.movingLessThanHalfSpeed,
        }, pickFootstepSet({ inside: true, inBuilding: false,
          dungeonSwimming: player.swimming,
          // F090: the LATCHED flag - shallow is entered at 0.57 and
          // only left at 0.95 (PlayerFootsteps :189, :199-208).
          dungeonShallow: _footsteps.waterStep(player.pos[1] + 0.9, surf, player.swimming) }));
        if (_step) audio.playOneShot(_step.clip, _step.volume);
      }
      cam.pos = player.eye;
      ctx.reportActivity?.({ running: held(keys, 'Run') && moving, swimming: player.swimming, climbing: !!player.climb?.isClimbing, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed, fell: player.landedFallDistance });   // P13 sneak state + P14 fall landing (AUDIT 26 F083)
      ctx.reportMotor(player.grounded, player.velY, cam.yaw);
      ctx.reportInput?.([...keys].join('+') || 'none', cam.pitch);
      const useHeld = keys.has('KeyE');   // I2 departure: DFU activates on Mouse0 and E is AbortSpell - the pointer-parity slice owns the move
      const zNow = held(keys, 'ReadyWeapon');   // sheathe toggle (audit 2026-08-17)
      if (zNow && !zPrev) ctx.toggleSheath?.();
      zPrev = zNow;
      if (useHeld && !prevUse) tryActivate();
      prevUse = useHeld;
      // `held` here USED to be this frame's local overlay boolean; it was
      // renamed overlayHeld (:353) and the name then resolved to the
      // input helper imported at :33 - a function, so `!held` was
      // permanently false and the dev fly-cam never moved. The gate is
      // the overlay one it always was: a window up holds the camera
      // exactly as it holds the motor above.
    } else if (!overlayHeld) {
      const speed = (keys.has('ShiftLeft') ? 24 : 5) * dt;   // fly-cam (dev): raw keys, not an action
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;   // fly-cam (dev)
    }
    // DC1: PlayerDeath.Update's camera sink. The walk branch above is
    // HELD while any overlay is up - the death screen included - so
    // the sink writes the camera itself, absolute off the motionless
    // eye each frame (never cumulative), the way DFU keeps moving the
    // camera while InputManager.IsPaused holds the player.
    if (walkMode && (ctx.deathDrop ?? 0) > 0) {
      const _eye = player.eye;
      cam.pos = [_eye[0], _eye[1] - ctx.deathDrop, _eye[2]];
    }

    const target = [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const proj = mirrorProjectionX(perspective(fieldOfView(), canvas.clientWidth / canvas.clientHeight, 0.05, 800));   // HANDEDNESS (mat4's law)
    const view = lookAt(cam.pos, target, [0, 1, 0]);

    ctx.flicker.tick(dt);
    // AUDIT 26 F183: per FRAME, not once at load - the ambient depends
    // on which block the player stands in (PlayerAmbientLight.cs:82-90),
    // so it has to follow them across a castle or special-area
    // boundary the way the load-time write never could.
    renderer.setLighting(new Float32Array(ctx.ambient), 0);
    renderer.setPointLights(
      withPlayerLights(nearestLights(ctx.lights, cam.pos, 16, ctx.flicker.ranges),
        ctx.candleLight?.(), playerTorchLight(playerEntity, player.pos, cam.yaw)),   // X11 candle; T1 torch
      new Float32Array(DUNGEON_LIGHT_COLOR));
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of ctx.drawList) renderer.drawMesh(d.mesh, d.matrix, ctx.texRemap);
    for (const d of ctx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, ctx.texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    ctx.flatAnims.tick(dt);   // FA1: whoever draws the flats runs their clock
    // (the blood pool's clock runs inside ctx.drawFoes now - both dungeon
    // hosts call it, so neither can forget it; 2026-08-27)
    renderer.drawBillboards(ctx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
    // AUDIT 23 (hosts-9 = audio-3) - SongManager.cs:193: Update() runs
    // every frame, windows open or not - THE MUSIC CONTEXT IS FED
    // BEFORE THE MODAL RETURN (AUDIT 21 F1's law, which this host
    // alone skipped: the boot chargen played no music and a song
    // ending under any window never re-picked). Fed ABOVE the gate so
    // both the overlay and gameplay arms ride the same call.
    musicDirector.update({
      inside: true, insideDungeon: true, insideDungeonCastle: ctx.inCastle ?? false,
      gameDays: Math.floor(ctx.classicMinutes / 1440),
      dungeonKey: ctx.musicSeed,
      locationIndex: dfLocation?.locationIndex ?? -1,
    });
    if (ctx.uiOverlayActive) {
      ctx.tickOverlay(dt); ctx.drawOverlay(canvas);
      // U26: the shot counter advances HERE TOO. This early return
      // skipped it, so __frame froze the moment any overlay opened -
      // and the Process rule says a probe must frame-sync rather than
      // sleep, which an overlay made impossible in this host. The
      // dungeon inventory probe hit it on its first press of F6.
      frames++;
      if (shotMode) window.__frame = frames;
      capturePendingScreenshot(canvas);   // SS1: a save armed under an overlay still lands its shot
      requestAnimationFrame(frame);
      return;   // U2b/U3: hold gameplay, keep the loop (AUDIT 18 F5: the overlay's own clock still runs - DFU's RestWindow.Update ticks on realtime under timeScale 0)
    }
    ctx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, anyMove(moveHeld(keys)), player.height);   // moveHeld: the collision-trigger input gate (verbatim)   // internally gated (S4b: missiles fire without foes)   // C8 E1+E2: rigged class enemies, classic senses + pursuit
    renderer.drawWater(ctx.waterQuads, WATER_COLOR,
      renderer.textures.get(`${waterArchive}_0`),
      (now / 1000) * WATER_SCROLL_TILES_PER_SEC);

    frames++;
    if (shotMode) window.__frame = frames;
    if (shotMode && frames === 5) window.__shotReady = true;
    // SS1: deliver a pending save screenshot after the frame's last
    // draw (preserveDrawingBuffer false - the buffer is only this
    // task's to read).
    capturePendingScreenshot(canvas);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
