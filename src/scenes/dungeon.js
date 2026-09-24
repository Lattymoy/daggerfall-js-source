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
import { WORLD_FRAME } from '../render/renderer.js';   // AUDIT-EL F5
import { frameBegin, frameEnd, frameAbort } from '../systems/frameClock.js';   // PERF1: the frame's script time; AUDIT-WH2 L1-F4: and the door an early return takes
import { INTERIOR_CLEAR } from '../render/renderer.js';
import { getInteractionMode, setInteractionMode, MODE_ACTIONS } from '../player/interactionMode.js';   // R1: the global PlayerActivate mode; AUDIT 58: its four ACTIONS
import { setMidScreenText } from '../ui/midScreenText.js';   // AUDIT 64 F34: DaggerfallHUD's centred label
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { immersiveFootsteps } from '../systems/immersiveFootsteps.js';
import { betterAmbience, classicFootstepAllowed } from '../systems/betterAmbience.js';   // BA1: Better Ambience - the shake, the dungeon's fog and light, the reverb, the indoor rain, its own stride   // IF1: Immersive Footsteps owns the stride and the three landing sounds once its clips are in (DisableVanillaFootsteps)
import { applyFog, DUNGEON_FOG } from '../render/underwaterFog.js';   // ROAD-B (b3): UnderwaterFog + WeatherManager.DungeonFogSettings
import { audio } from '../systems/audio.js';   // FS-slice: the stride plays flat 2D, as PlayerFootsteps' customAudioSource does
import { requestLook, makeLookGate, bindCursorToggle } from '../player/pointerLock.js';   // U45: PlayerMouseLook.cursorActive
import { playerEntity } from '../characters/playerEntity.js';   // shot-mode __hp probe
import { attachTouch } from '../ui/touch.js';
import { attachGamepad } from '../ui/gamepadInput.js';   // GP1: the pad speaks the same hooks
import { isEnhanced } from '../systems/uiSkin.js';   // AUDIT 62 F10: the dial button's own skin gate
import { BlocksFile } from '../formats/blocksFile.js';
import { bindWorldDataBlocks } from '../formats/worldDataReplacement.js';   // RR3b
import { loadModWorldData } from './modWorldData.js';   // RR3b
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile } from '../formats/mapsFile.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR, DUNGEON_LIGHT_BLOCK_RANGE } from '../world/dungeonLights.js';   // A10: the block-range cut
import { syncLightingLane, lanternColor, dungeonAmbient, dungeonTrilight, dungeonFog } from '../render/enhancedLighting.js';   // EL1; EL4: the dark; AUDIT-EL F6: the fog with it
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { thunderlockMuzzleLight } from '../systems/thunderlock.js';   // FIELD-GUN13: the muzzle flash is a light the player carries, the torch's own shape
import { lookAt, perspective, mirrorProjectionX, identity, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
const BATCH_IDENTITY = identity();   // PERF5: the merged level is in world space already
import { PlayerMotor, TELEPORT_FREEZE_S, motionBagOf } from '../player/motor.js';   // A6: DaggerfallAction.Teleport's physics settle; WW2: the one motion bag
import { mwViewFrame, mwViewWheel, mwViewDrawBody, mwViewFootstep } from '../player/mwView.js';   // MW-D25: the Morrowind camera; AUDIT-EOTB2: the sprite's stride
import { PITCH_LIMIT } from '../player/mwCamera.js';   // MW-D30: camera.cpp:323-331's own clamp
import { jumpSpeedMultiplier, isEnhancedJumping } from '../systems/skills.js';   // AUDIT 64 F2: CheckAirControl's IsEnhancedJumping disjunct
import { pickFoe,   // TI1: the lock-on pick
  pickActivatableHit,   // AUDIT 63 F33 (review): the pick hands its distance back so the enemy arm can lose to a nearer target   // WORLD-HOVER: the LIST comes off the context's one seam now
  RAY_DISTANCE, TOO_FAR_AWAY_TEXT,   // AUDIT 65 MC-2: the ONE reach the foe arm competes at (DFU's one ray), and the refusal each handler speaks for itself
} from '../player/activate.js';
// AUDIT 63 F33: PlayerActivate.ActivateMobileEnemy (:800-841) - the
// standalone dungeon's copy of the living-foe arm.
import { tryMobileEnemyActivate } from '../player/mobileEnemyActivate.js';
import { FOUND_NOTHING_VALUABLE_TEXT_ID } from '../systems/talk.js';   // GetRandomText(8999)
import { hideWorldPlaque, destroyWorldPlaque } from '../ui/worldPlaque.js';   // AUDIT-WH H4: the plaque's hide door, for the overlay branch that returns above drawFoes
import { quickLootWheel, quickLootArm } from '../systems/quickLoot.js';   // QUICK-LOOT B4: the plaque owns the wheel while it lists, and the two keys arm what the next activate means
import { createMusicDirector, fetchBytes, motorStats, climbingDeps, ridePlatform, doorSpellFor, wireDoorSpells, claimFrame, frameAlive, frameHeld } from './shared.js';
import { isTextEntryTarget, keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, pressed, released, routeKey, routeKeyUp, held, moveHeld, anyMove, actionOf, swallowBrowserKey, mouseCode, isSwingButton, swingHeld, keyboardLook, installContextMenuGuard, swingKeyHeld } from '../ui/input.js';
import { armUnloadGuard } from '../systems/unloadGuard.js';   // MAC-L3: one door in front of every way out of a running game   // AUDIT 39r: the mouse half of the held set
import { createActivateGate, activateFrame, setClickDelay } from '../systems/activateGate.js';   // A8: PlayerActivate's ActivateCenterObject frame
import { capturePendingScreenshot } from '../systems/saveSlots.js';   // SS1: the context arms the shot, THIS loop delivers it
import { routeLargeHudClick, activeMouseOverLargeHUD, trackLargeHudPointer } from '../ui/hudLarge.js';   // U45: the bar's eleven panels; ROAD-Ar: and the guard that stops them being world clicks too
import { worldViewportRect, largeHudWorldAspect } from '../ui/hudLarge.js';   // ROAD-E E5: ViewportChanger - the docked bar shrinks the world pass (RETRO1: and retro mode's aspect correction pillarboxes it)
import { createLockOn, LOCK_PICK_DISTANCE } from '../player/lockOn.js';   // TI1: touch lock-on
import { rayDirFromScreen, projectToScreen, ndcFromScreen } from '../player/tapRay.js';   // TI1: the finger's ray and the dot
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { createDataPipeline } from './dataPipeline.js';
import { buildDungeonContext } from './dungeonContext.js';
import { setAmbientTextHost, tickAmbientText } from '../systems/ambientText.js';   // AT2: the standalone dungeon scene is the outermost motor here, so it claims the mod
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';   // U14: the overlay pointer seam
import { lookScale, lookInvert, keyboardLookRate } from '../ui/lookSettings.js';   // SETT: MouseLookSensitivity + InvertMouseVertical
import { LookFilter, swingSuppressesLook } from '../player/lookFilter.js';   // AUDIT 28 W7: MouseLookSmoothingFactor; MAC-O2: PlayerMouseLook.Update's swing suppression (:246-248)
import { getInt } from '../systems/settings.js';   // MAC-O4: Controls/WeaponSwingMode - only Gesture (0) may claim the mousemove drag
import { MoveAxes } from '../player/moveAxes.js';   // AUDIT 28 W8: MovementAcceleration
import { CameraRecoiler } from '../player/cameraRecoiler.js';   // AUDIT 28 W9: CameraRecoilStrength
import { HeadBobber } from '../player/headBobber.js';   // AUDIT 28 W10: HeadBobbing
import { lastHealthLost, lastHealthLostPercent } from '../ui/hudVitals.js';   // AUDIT 28 W9: the detector's loss
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { carriedWeight } from '../systems/inventory.js';   // F027 / E4: PlayerEntity.CarriedWeight, the gold counter's term and all
import { windowEmissionRGB } from '../render/windowEmission.js';   // AUDIT 26 F001/F002: WindowStyle per host (DaggerfallInterior.cs:473/:517/:1270 vs GetMaterial's Day default)
import { installConsoleProbe } from '../systems/consoleCommands.js';   // E3: the console's door

// Water surface: the classic water tile (R11), drawn by the context's
// own frame function since WATER-D1 - its colour (DUNGEON_WATER_COLOR)
// and its draw live in scenes/dungeonContext.js, one home for both
// dungeon hosts. This host names the tile's archive below.

// Milestone 5 scene: a full dungeon on the block grid.
export async function bootDungeon(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const dungeonName = params.get('dungeon') || "Privateer's Hold";
  const lightingOn = syncLightingLane(renderer);   // EL1: the lane, installed at mount
  const DUNGEON_LANTERN_F32 = lanternColor(lightingOn, new Float32Array(DUNGEON_LIGHT_COLOR));   // EL1: the lane's flame at the dungeon's intensity

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
  bindWorldDataBlocks(blocks);   // RR3b: WorldDataReplacement's ContentReader.BlockFileReader - the new block indices start past this BSA's count
  await loadModWorldData();   // RR3b: ModManager's world-data assets on the door before the first region or block loads
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);

  const dfLocation = maps.getLocationByName(regionName, dungeonName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${dungeonName}`);

  status(`laying out ${dungeonName}`);
  const pipeline = createDataPipeline({ renderer, arch, palette });
  renderer.setClearColor(INTERIOR_CLEAR);   // INCIDENT 2026-09-04: inside clears to BLACK (CameraClearManager.cs:24-25)
  let _poseCam = null;   // AUDIT 26 F222: filled once the camera exists
  let _motorRef = null;   // DC1: filled once the motor exists (the same late-bound shape)
  const ctx = await buildDungeonContext(
    { ...pipeline, renderer, arch, palette }, dfLocation, blocks, dfLocation.climate.climateType, { activateHeld: () => held(keys, 'ActivateCenterObject') || _tapArmed > 0, actionDown: (action) => held(keys, action),   // KB1: registry actions
      // HT1: the torch keys /* AUDIT 62 F8: the finger's press too - it was 'Mouse0' in the held set until the tap stopped speaking a literal code */ foes: !params.has('nofoes'), playerClass: params.has('class') ? Number(params.get('class')) : undefined, playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined, playerWeapon: params.get('weapon') ?? undefined,
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
      motorState: () => (_motorRef ? { eyeLevel: _motorRef.eye[1] - _motorRef.pos[1], capsule: _motorRef.height } : null),
      // MAC1 J: this host's canvas, for the pause door's relock. The
      // context owns none of its own (dungeonContext.js:6288), so each
      // dungeon host hands its own in and the resume gesture carries
      // the pointer back with it (ui/pauseDoor.js:270-287).
      relock: () => requestLook(canvas) });

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
  ctx.setWaterArchive(waterArchive);   // WATER-D1: drawFoes draws the plane with it, inside the world pass

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
  const lookFilter = new LookFilter();   // AUDIT 28 W7: one filter per camera
  const moveAxes = new MoveAxes();   // AUDIT 28 W8: MovementAcceleration
  const cameraRecoiler = new CameraRecoiler();   // AUDIT 28 W9: CameraRecoilStrength
  // CameraRecoiler's SaveLoadManager_OnStartLoad (:185-191): the
  // incoming character does not inherit the outgoing one's reel, and
  // the reposition the load ends in is OnInitWorld's half of the same
  // clear. The context owns this host's ONE load door (F12, the pause
  // menu and the boot ?load arm all reach it), so the hook rides it.
  const _ctxQuickLoad = ctx.quickLoad;
  if (typeof _ctxQuickLoad === 'function') {
    ctx.quickLoad = (...args) => { cameraRecoiler.reset(); return _ctxQuickLoad.apply(ctx, args); };
  }
  const headBobber = new HeadBobber();   // AUDIT 28 W10: HeadBobbing
  let rightHeld = false;   // AUDIT 28 F-C2: HasAction(SwingWeapon) - the raw button, ungated
  let swingKeyLatch = false;   // MAC-SWING1: the same action, bound to a key or pad code
  // TI1: the touch layer's state. swipeHeld is the swipe's SwingWeapon
  // truth beside rightHeld (the settle law reads both); a tap arms a
  // ONE-frame ActivateCenterObject press (_tapArmed counts it down at
  // the frame's top and is read straight into the gate's `down`)
  // and _tapDir carries the finger's ray for the release frame,
  // which is when A8's gate fires the activation. player/lockOn.js
  // holds the lock; _lockChest is this frame's dot target.
  let swipeHeld = false;
  let _tapArmed = 0, _tapPoint = null, _tapDir = null, _tapLockOnly = false;   // TS1: the stick-half tap locks a foe and activates nothing else
  let _lastProj = null, _lastView = null, _lockChest = null;
  const lockOn = createLockOn();
  _poseCam = cam;   // AUDIT 26 F222: the pose seam's late-bound camera
  const shotMode = params.has('shot');
  // P2: grounded walking is the default (?fly restores the fly cam);
  // spawn drops onto the start-marker floor.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(ctx.collider, motorStats(playerEntity), { jumpBoost: () => jumpSpeedMultiplier(playerEntity), enhancedJumping: () => isEnhancedJumping(playerEntity), carriedWeight: () => carriedWeight(playerEntity), climbing: climbingDeps(playerEntity) });   // AcrobatMotor skill jump (P14) + M3 climbing (no HUD seam in the standalone host); motorStats = the LIVE entity
  _motorRef = player;   // DC1: the motorState seam binds here
    const _footsteps = new FootstepMachine();   // FS-slice
    immersiveFootsteps.onTransitionDungeonInterior();   // IF1: the standalone dungeon boot IS the dungeon transition (UpdateFootsteps_OnTransitionDungeonInterior)
    betterAmbience.onTransition({ dungeon: { regionName: dfLocation.regionName, name: dfLocation.name, inCastle: () => !!ctx.insideDungeonCastle?.(), exitPos: ctx.enterMarker ? [ctx.enterMarker.x, ctx.enterMarker.y, ctx.enterMarker.z] : null } });   // BA1: the boot is the dungeon transition here too
  player.spawn(spawn[0], spawn[1], spawn[2]);
  console.log(`[spawn] marker ${JSON.stringify(ctx.startMarker)} -> feet [${spawn.map((v) => v.toFixed(3)).join(', ')}] (startSpawn build)`);
  // P10 Teleport actions: player transform = the destination object's
  // (DFU DaggerfallAction.Teleport :576-599). spawn() zeroes velY and
  // drops the grounded flag, so the motor re-grounds on the
  // destination floor next step.
  //
  // A6, the two halves the interim note here got wrong:
  //  - THE FREEZE IS REAL. `FreezeMotor = 0.5f` (:594) is set before
  //    the move and FixedUpdate (:296-307) then does NOTHING for half
  //    a second - no gravity, no input, no probe - and raises
  //    CancelMovement on the way out. The motor carries it now.
  //  - THE FACING DOES NOT CHANGE. DFU's next line copies the
  //    destination's full rotation onto the player, and
  //    PlayerMouseLook.Update overwrites it the very next frame from
  //    its own stored Yaw (`characterBody.transform.localEulerAngles =
  //    new Vector3(0, Yaw, 0)`, :256-259) - so the copy is dead on
  //    arrival and a teleported player keeps the heading they walked
  //    in with. Writing the marker's yaw here was the port's own
  //    departure; the destination's yawDeg stays on the seam (the
  //    resolvePosition contract) and nothing spends it.
  ctx.actions.onTeleport = ({ pos, yawDeg }) => {
    player.freezeMotor = TELEPORT_FREEZE_S;
    player.spawn(pos[0], pos[1], pos[2]);
    cam.pos = [...player.eye];
    console.log(`[action] teleport -> [${pos.map((v) => v.toFixed(2)).join(', ')}] (marker yaw ${yawDeg.toFixed(1)}, not applied - PlayerMouseLook owns the heading)`);
  };
  // MWCROUCH: the frame's key EDGES (ui/input.js). The four press
  // latches this host used to keep - crouch, E, Z and H - were
  // derivations off the held ring and dropped any tap that began and
  // ended between two frames; GetKeyDown/GetKeyUp do not.
  // THE ROTATION IS AT THE HEAD OF THE FRAME, above the video hold, on
  // purpose: an edge lives exactly one frame - the single frame Unity
  // gives it - and a held frame is DFU's paused InputManager, which
  // DROPS the edge rather than banking it for whenever the video ends.
  const keyEdge = keyEdges();
  const activateGate = createActivateGate();   // A8: this host's ActivateCenterObject frame state
  console.log(`player: collider ${ctx.colliderTris} tris, ${ctx.actions.objects.size} activatables, walk=${walkMode}`);
  const tryActivate = () => {
    const dir = _tapDir ?? [   // TI1: the tap's ray, else the centre
      Math.sin(cam.yaw) * Math.cos(cam.pitch),
      Math.sin(cam.pitch),
      Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const eye = walkMode ? player.eye : cam.pos;
    // TI1: a tap on a live foe is the LOCK (player/lockOn.js), toggled,
    // and the activation ends there.
    if (_tapDir) {
      const _lockFoe = pickFoe(eye, dir, ctx.foes, ctx.collider, LOCK_PICK_DISTANCE);
      if (_lockFoe) { lockOn.toggle(_lockFoe); return null; }
      if (_tapLockOnly) return null;   // TS1: the stick-half tap found no foe - it opens nothing
    }
    // AUDIT 63 F33: ActivateMobileEnemy (PlayerActivate.cs:800-841).
    // AUDIT 65 MC-2 collapsed F33's near/far pair into ONE call at the
    // RAY's reach, decided against the LADDER'S OWN WINNER: DFU reaches
    // :419 only for the one thing its single ray hit (:314), the Info
    // line (:806-826) and the pickpocket's refusal (:832-836) with it.
    const _enemyArm = (reach, nearerThan = Infinity) => tryMobileEnemyActivate(eye, dir, ctx.foes, ctx.collider,
      reach, getInteractionMode(), playerEntity, {
        nearerThan,
        hud: (t) => ctx.hudSay?.(t),
        modal: (t) => ctx.hudBox?.(String(t).split('\n')),
        makeEnemiesHostile: () => ctx.makeAreaHostile?.(),
        playerFeet: player.pos,
        nothingText: () => ctx.randomText?.(FOUND_NOTHING_VALUABLE_TEXT_ID) || 'You found nothing valuable.',   // GetRandomText(8999)
      });
    // WORLD-HOVER: ONE construction seam, shared with the modal host
    // and the hover plaque. This host registers NOTHING with it, and
    // that is the recorded difference rather than an accident of two
    // hand-copied lists: the dev door has no world to exit to and no
    // `exit:` or `person:` arm in the ladder below, so standing those
    // targets would win the pick and eat the press in silence.
    const targets = ctx.dungeonActivationTargets();
    const _pick = pickActivatableHit(eye, dir, targets, ctx.collider);
    if (_enemyArm(RAY_DISTANCE, _pick?.distance ?? Infinity)) return null;   // MC-2: the split pair's FAR half ran with `nearerThan` Infinity, so a foe 20 off ate a click DFU gives a chest at 5
    const key = _pick?.key ?? null;
    // AUDIT 65 MC-2: THE REFUSAL, where DFU keeps it - inside the handler its one ray dispatched into: the action door
    // (:686-689), the loot container (:868-873), the corpse (:936-941). activate.js's pickActivatableHit holds the law.
    if (_pick && _pick.distance > _pick.reach) { setMidScreenText(TOO_FAR_AWAY_TEXT); return true; }   // consumed, and no key: nothing was activated (the probe seam __activate reads this)
    // U26: the player's OWN dropped piles are loot targets too, and
    // they carry the droppedLoot: prefix. Without this arm a dungeon
    // drop was one-way - the pile drew, the ray found it, and E did
    // nothing. The probe caught it on the first pickup.
    // AUDIT-WH2 L2-F1/F2: `camp:` and `hearth:` too. The dungeon
    // CONTEXT stands both for whichever host drives it - a Campfire Kit
    // can be lit underground (only a TENT is refused there) and every
    // brazier is a `hearth:` - and this host routed neither, so both
    // read their name on the plaque and ate the press in silence. The
    // modal dungeon arm answers them; two hosts over one context must
    // not disagree about one key.
    if (key !== null && (key.startsWith('loot:') || key.startsWith('corpse:') || key.startsWith('droppedLoot:') || key.startsWith('droppedTorch:') || key.startsWith('camp:') || key.startsWith('hearth:'))) {
      ctx.takeLoot(key, getInteractionMode());   // HT1: a dropped torch takes the mode (Grab/Steal picks it up, Info/Talk names it)
      return key;
    }
    if (key) ctx.actions.activate(key, { steal: getInteractionMode() === 'steal', doorSpell: doorSpellFor(playerEntity) });   // R1: Steal mode picks a locked door; X1: an armed Open/Lock fires here
    return key;
  };
  const keys = new Set();
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  addEventListener('keydown', (e) => {
    // ROAD-G G3: this host already filled the ring first, which is
    // InputManager.PollInput's own order (:1795-1809) and now load-
    // bearing - the Set IS the ring ModifierOnlyHeld scans (:1632-1639,
    // through ui/input.js's latch). The other three hosts were
    // moved up to match. Both of this host's keydown listeners run
    // after it, so routeKey below sees this press placed.
    // KB1: A TYPED FIELD'S KEY JOINS NO RING (CG2). This listener had no gate, so a name typed into a DOM field (the
    // enhanced prompts) walked the player and flipped the modes with every letter; routeKey's own gate stood only
    // under an overlay.
    if (isTextEntryTarget(e.target)) return;
    // AUDIT KB1 (the hosts lens' second finding): and a key a WINDOW takes joins no ring - this listener runs before
    // the routing one below, so the window is still up here, and the E that closed it was on the next frame's down
    // ring: `pressed(..., 'Interact')` activated again on a slot now empty. DFU's PollInput never runs under a pausing
    // window (InputManager.cs:487-503).
    if (!ctx.uiOverlayActive) {
      keys.add(e.code);
      noteKeyDown(keyEdge, e.code, e.repeat);   // MWCROUCH: the press event, buffered for the frame that reads it
    }
    if (e.code === 'AltLeft') e.preventDefault();
    // R1: the four modes switch here too - DFU's currentMode is global
    // and the standalone dungeon has no townTalk to carry the keydown.
    // AUDIT 58 (talk lane), both halves of the law this copy was
    // missing: (1) the read is the REGISTRY's, because
    // PlayerActivate.cs:221-228 asks
    // `InputManager.ActionStarted(Actions.StealMode)` and F1-F4 are
    // only that action's DEFAULT binding (InputManager.cs:999-1002) -
    // a literal table made every rebind in the controls grid inert;
    // (2) a pausing window shuts the read down entirely
    // (UserInterfaceManager.cs:183-184 -> GameManager.cs:608 ->
    // InputManager.cs:487-503 returns before currentActions is
    // populated), so the mode must NOT flip under an open overlay -
    // the very next line already has the predicate.
    // QUICK-LOOT B4: the two keys, under this host's overlay gate and
    // above the mode ladder, for the reason the three hosts above put
    // them high: `quickLootArm` refuses unless something is
    // HIGHLIGHTED, so with no list under the crosshair the ladder falls
    // through. It arms a mode and fires the one-frame activate
    // (`_tapArmed`) the touch tap already uses, because the key is
    // known here and only the FRAME has the ray and the pools.
    if (!ctx.uiOverlayActive && quickLootArm(actionOf(e, keys))) { _tapArmed = 2; e.preventDefault(); return; }
    const im = MODE_ACTIONS[actionOf(e, keys)];
    if (im) {
      e.preventDefault();   // ALWAYS consumed - a repeat press must not reach the browser (F1 = help)
      // AUDIT 64 F34: PlayerActivate.cs:1424 - the mode line is
      // SetMidScreenText's, in EVERY host (one C# call site).
      if (!ctx.uiOverlayActive && im !== getInteractionMode()) { setInteractionMode(im); setMidScreenText(`Interaction is now in ${im} mode.`); }
    }
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!ctx.uiOverlayActive && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  // ROAD-E E1: THE KEY-UP ROUTE. This listener drained the held-keys
  // Set and told the open window nothing, so a window that answers
  // DFU's `GetKeyUp` (the automap's two-phase toggle-close) or polls
  // `GetKey` (its twenty-two IsPressedWith camera arms) could not.
  // routeKey's mirror, on the same ctx.
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    noteKeyUp(keyEdge, e.code);
    if (e.code === 'AltLeft') e.preventDefault();
    const hadOverlay = !!ctx.uiOverlayActive;
    routeKeyUp(e, ctx);
    if (hadOverlay && !ctx.uiOverlayActive) requestLook(canvas);
  });   // MWCROUCH: ...and the release, for SwitchHand's ActionComplete edge
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
      // ROAD-C c2/S4: the POINTER seam runs first and always - the
      // automap chrome is press-HOLD and drag driven, so `down` must
      // reach it whether or not the click seam consumes the event.
      // c2/S8: the DOWN route carries the modifiers with it - DFU's
      // double-click and debug-teleport handlers poll Input.GetKey at
      // the click, and this seam is the port's only reader of that.
      if (v) ctx.overlayPointer?.('down', v[0], v[1], e.button, { ctrl: !!e.ctrlKey, shift: !!e.shiftKey });
      if (v && ctx.overlayClick?.(v[0], v[1], e.button === 2, e.button === 1)) return;   // G5: the middle button too
      return;   // a window is up: never grab the pointer behind it
    }
    // U45: the large HUD's eleven panels, BEFORE the relock - a click
    // on the bar is a button press, never a grab for the pointer. The
    // ctx it routes into is the SAME one routeKey uses, which is the
    // whole point of pulling routeAction out of it.
    if (routeLargeHudClick(px, py, e.button, ctx, { windowUp: ctx.uiOverlayActive })) return;
    // ROAD-Ar: the click that GRABS the pointer back is a UI gesture,
    // not a world click, and it presses and releases Mouse0 into the
    // gate exactly as a window's close button does - so it takes
    // SetClickDelay too (PlayerActivate.cs:1050-1054). ONLY on a real
    // acquisition: with the pointer already locked this click IS the
    // world's.
    // AUDIT 62 F6: ...and NEVER for a touch pointer. A finger can never
    // hold the pointer lock (ui/touch.js's own note), so the test above
    // is permanently true on a phone and every finger-down armed a 0.3 s
    // window that swallowed the tap's release edge - the touch activation
    // was dead below a ~267 ms hold. No lock to re-acquire, no Mouse0
    // press on this event: no UI gesture for RemoveWindow's SetClickDelay
    // to model (PlayerActivate.cs:1050-1054, called only from
    // UserInterfaceManager.cs:206/:214).
    if (e.pointerType !== 'touch' && document.pointerLockElement !== canvas) setClickDelay(activateGate);
    requestLook(canvas);   // safe: a refused lock never crashes (was bare requestPointerLock - the sh/< crash + lock:N frozen yaw)
  });
  // ROAD-C c2/S4: THE UP ROUTE. A host that routes `down` but not `up`
  // latches an automap drag that spins the map forever, with nothing
  // to error on. It listens on the WINDOW, not the canvas, because a
  // release outside the canvas must still end the drag.
  addEventListener('pointerup', (e) => {
    if (!ctx.uiOverlayActive) return;
    const r = canvas.getBoundingClientRect();
    const v = pointToNative(nativeMetrics(canvas),
      (e.clientX - r.left) * (canvas.width / r.width),
      (e.clientY - r.top) * (canvas.height / r.height));
    ctx.overlayPointer?.('up', v ? v[0] : -1, v ? v[1] : -1, e.button);
  });
  // U-scroll: the wheel reaches an open window (question scroll, list
  // pickers); passive:false so the page never scrolls under the game.
  canvas.addEventListener('wheel', (e) => {
    if (!ctx.uiOverlayActive) {
      // QUICK-LOOT B4: ...but the plaque is asked first, and answers
      // only while it is listing a pile or a body. MW-D25: with no
      // window up and no list under the crosshair the wheel is the
      // Morrowind camera, exactly as before.
      if (quickLootWheel(e.deltaY)) { e.preventDefault(); return; }
      if (walkMode && mwViewWheel(e.deltaY)) e.preventDefault();
      return;
    }
    e.preventDefault();
    // AUDIT 65 UI-5: the point rides the notch, by the mousemove arm's
    // own arithmetic - DFU reads the mouse position afresh each Update
    // (BaseScreenComponent.cs:577-594 guards the scroll block :725-736), so the window must not be left
    // routing the wheel by the last hover it happened to get.
    const r = canvas.getBoundingClientRect();
    const v = pointToNative(nativeMetrics(canvas),
      (e.clientX - r.left) * (canvas.width / r.width),
      (e.clientY - r.top) * (canvas.height / r.height));
    ctx.overlayWheel?.(Math.sign(e.deltaY), v ? v[0] : -1, v ? v[1] : -1);
  }, { passive: false });
  // C8 E3c: RMB drag-to-swing (classic weapon control; menu suppressed)
  // U45: Actions.ActivateCursor (Enter) frees the mouse during play.
  bindCursorToggle(canvas, () => ctx.uiOverlayActive, (e) => actionOf(e, keys));   // KB1: the host's held Set, so a combo'd FreeMouse resolves
  // MAC-L3: the browser menu is shut for the WHOLE page, not just this
  // canvas - thirteen DOM surfaces sit over it and only two of them shut
  // it themselves. One listener, one home (ui/input.js).
  installContextMenuGuard(canvas.ownerDocument ?? undefined);
  // MAC-L3: ...AND THE OTHER HALF OF THE SAME REPORT. A gesture the
  // browser reads as Back, a stray Ctrl-W, a closed tab: every way out
  // of a running game was silent, and the port had no `beforeunload` in
  // it at all. The door is in front of ALL of them rather than chased
  // one gesture at a time. `exitToTitleMenu` stands it down, because a
  // door the game opened is not a door to warn about.
  // AUDIT-MACL F3: the predicate is the HOST'S HONEST WORD, not `true`.
  // The first cut said `() => true` here - "this host is booted, so
  // there is something to lose" - which is false for the whole of
  // chargen, before a character exists at all, and would have put a
  // browser prompt in front of the wizard's own Cancel.
  armUnloadGuard(() => !!playerEntity.chargenDone);

  // AUDIT 39r: the button goes into the held-keys set too. InputManager
  // polls Mouse0/1/2 through the same GetKey dictionary as the keyboard
  // (:995/:1010/:1017), and this Set was keydown-fed only - so AutoRun
  // (Mouse2, the wheel) and the drawn bow's ActivateCenterObject
  // un-draw (Mouse0) could never read true. mouseCode owns the
  // Unity/DOM middle-button crossover; the RELEASE is unconditional.
  addEventListener('mousedown', (e) => { if (isSwingButton(e.button)) rightHeld = true; const mc = mouseCode(e.button); if (mc) { keys.add(mc); noteKeyDown(keyEdge, mc); } if (isSwingButton(e.button) && !ctx.uiOverlayActive) ctx.playerAttackInput(0, 0, true); });   // FIX-F: the swing's button is the registry's   // I4: a right-click on a window is the window's (the remove gesture), never a swing

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
    const hadOverlay = !!ctx.uiOverlayActive;
    if (routeKey(e, ctx, (p) => player.spawn(p[0], p[1], p[2]), keys)) e.preventDefault();   // P14: a load clears motion state (DFU CancelMovement + ClearFallingDamage)   // AUDIT 58 (f3/input): + the held-keys Set, so a rebound combo reaches the dispatch (InputManager.cs:1666-1712)
    // MENU-RELOCK: reclaim inside the same key gesture that removed the
    // final window; the frame-late look gate is outside user activation.
    if (hadOverlay && !ctx.uiOverlayActive) requestLook(canvas);
  });
  addEventListener('mouseup', (e) => { if (isSwingButton(e.button)) rightHeld = false; const mc = mouseCode(e.button); if (mc) { keys.delete(mc); noteKeyUp(keyEdge, mc); } if (isSwingButton(e.button)) ctx.playerAttackInput(0, 0, false); });
  const inputHooks = {   // GP1: one hooks object for the finger AND the pad   // mobile: stick synthesizes WASD; the right half is classified (TI1)
    look: (dx, dy) => {
      lookFilter.add(dx * lookScale(), -dy * lookScale() * lookInvert());   // AUDIT 28 W7: through the look filter (HANDEDNESS, mat4's law)
    },
    // TI1: the swipe is the RMB drag - the context's own entry, with
    // its cast gate and sheathed check inside (dungeonContext.js
    // playerAttackInput), on a finger.
    attack: (dx, dy, held) => {
      swipeHeld = held && walkMode;
      if (walkMode) ctx.playerAttackInput(dx, dy, held);
    },
    // TI1: the tap is a one-frame press of the activate action along
    // the finger's ray - A8's gate fires it on the release. A finger in
    // the docked bar's strip is no world tap at all.
    tap: (x, y, opts = null) => {
      if (!ndcFromScreen(x, y, canvas.clientWidth, canvas.clientHeight, worldViewportRect(canvas.clientWidth, canvas.clientHeight))) return;
      _tapPoint = [x, y]; _tapArmed = 2;   // AUDIT 62 F8: the arm IS the press - see _tapArmed at the gate below
      _tapLockOnly = !!opts?.lockOnly;   // TS1: touch.js's stick-half tap (TI1b) - the lock pick and nothing below it
    },
    locked: () => lockOn.locked,
    // AUDIT 62 F10: the dial button is drawn only where Tab actually
    // opens the rose. openPixelDial refuses off the enhanced skin
    // (ui/pixelDial.js), so on the classic skin the ◆ was a drawn door
    // that opens nothing - the lie touch.js's own doc block names. The
    // skin cannot change without a reload (both switches end in
    // location.replace), so this boot-time read is exact.
    dial: isEnhanced(),
    enhanced: isEnhanced(),   // AUDIT FONT F5: the layer's text in the pixel face under the enhanced skin - FONT1 wired this in scenes/world.js alone, so every OTHER host's touch buttons stayed system-ui
    overlayActive: () => !!ctx.uiOverlayActive,
    // AUDIT 62 F7: the finger's pause gate - this host's own mouse
    // predicate (mousedown :`!ctx.uiOverlayActive`, mousemove's return).
    paused: () => !!ctx.uiOverlayActive,
  };
  const touch = attachTouch(canvas, inputHooks);
  const gamepad = attachGamepad(canvas, inputHooks);   // GP1: null without the Gamepad API
  addEventListener('mousemove', (e) => {
    ctx.reportMouse?.(e.movementX, e.movementY, document.pointerLockElement === canvas);   // raw input truth for F8
    // U37: a window frees the mouse, so an open overlay gets the HOVER
    // (native coords) instead of the look delta.
    trackHudPointer(canvas, e);   // U46: the spell-icon rows' tooltip, before the overlay return
    trackLargeHudPointer(canvas, e);   // ROAD-Ar: HUDLarge's MouseEnter/MouseLeave (:361-372), for the activate gate's HUD guard
    if (ctx.uiOverlayActive) {
      const r = canvas.getBoundingClientRect();
      const v = pointToNative(nativeMetrics(canvas),
        (e.clientX - r.left) * (canvas.width / r.width),
        (e.clientY - r.top) * (canvas.height / r.height));
      ctx.overlayHover?.(v ? v[0] : -1, v ? v[1] : -1, e);   // ROAD-A7: e.buttons is the scroll-bar drag's held-button poll
      if (v) ctx.overlayPointer?.('move', v[0], v[1], 0);      // ROAD-C c2/S4
      return;
    }
    // MAC-O4: only Gesture (0) tracks a drag at all - Click/Click-or-Hold
    // fire off the held latch alone (mousedown/mouseup, polled every
    // frame regardless of mousemove), so claiming the drag here in those
    // two modes fed the rig deltas it never reads and froze the look for
    // nothing. Same law as routeMouseDrag (scenes/shared.js, MAC-O4).
    if (document.pointerLockElement === canvas && swingHeld(e.buttons, keys) && getInt('Controls', 'WeaponSwingMode', 0, 2) === 0) { ctx.playerAttackInput(e.movementX, e.movementY, true); return; }   // FIX-F: the registry's button
    if (document.pointerLockElement !== canvas) return;
    // AUDIT 28 W7: the delta goes to the look filter's target, not the
    // camera - PlayerMouseLook.ApplyLook (:126); the frame pays it out
    // at MouseLookSmoothingFactor. HANDEDNESS (mat4's law): mouse-right
    // turns toward +x = screen-right; the pitch clamp is the filter's.
    lookFilter.add(e.movementX * lookScale(), -e.movementY * lookScale() * lookInvert());
  });

  status(`${dungeonName} - ${ctx.blockCount} blocks, ${ctx.drawList.length} draws`);
  console.log(
    `dungeon: ${ctx.blockCount} blocks, ${ctx.drawList.length} draws, table [${ctx.textureTable}], ` +
    `start ${JSON.stringify(ctx.startMarker)}, ${ctx.lights.length} lights, ${ctx.waterQuads.length} water, ${ctx.enemies.length} enemies`
  );
  ctx.goLive?.();   // ENH-NOTICE3 (AUDIT F1): this host's one context is the live top window from here on

  // Verbatim dungeon lighting: PlayerAmbientLight.DungeonAmbientLight,
  // no sun; every light flickers (DaggerfallLight Animate).
  renderer.setLighting(dungeonAmbient(lightingOn, new Float32Array(DUNGEON_AMBIENT)), 0);   // EL4: the lane's dark
  renderer.setWindowEmission(windowEmissionRGB('day'));   // F001: SetDungeonTextures keeps GetMaterial's Day default (MaterialReader.cs:456-461)
  // Verbatim DungeonFogSettings: exponential 0.005, fog color black.
  renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));

  // E3: the console's door, ungated - the database is one static class
  // in DFU and every command registered anywhere is reachable from any
  // scene, which is exactly what a static class means.
  installConsoleProbe();

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
    // ROAD-C c2/S8: AutoMapConsoleCommands' three verbs - map_revealall,
    // map_hideall, map_teleportmode. ROAD-E E3 registered them with the
    // real ConsoleCommandsDatabase (systems/consoleCommands.js), so this
    // probe is a NAMED door onto it - kept because the probes that drive
    // this host call it by this name. `window.__console` beside it is the
    // console's own door, where any registered command is reachable.
    window.__automapCommand = (name) => ctx.automapCommand?.(name) ?? 'Automap instance not found';
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
  // AT2: AMBIENT TEXT CLAIMS ITS HOST. THE FOUR HOSTS, and the reason
  // this scene is here while two of the four are not:
  //
  //   scenes/world.js       WIRED - claims and ticks above the modal gate
  //   scenes/exterior.js    WIRED - the same, in the probe town
  //   scenes/worldModes.js  NOT WIRED, and must not be. It is the
  //                         INTERIOR host, and its frame is CONSUMED by
  //                         one of the two above, whose tick runs first
  //                         on the very same frame. The mod's own
  //                         IsPlayerInsideBuilding arm is what silences
  //                         it in a building; a second call would be
  //                         either a no-op (the interval gate) or a
  //                         second Update, which the mod does not have.
  //   scenes/dungeonContext.js  NOT WIRED, for the same reason: it is
  //                         mounted by worldModes (shipping) or by THIS
  //                         file (the ?dungeon probe), never on its own,
  //                         so it never owns the outermost motor.
  //
  // This scene DOES own it - nothing ticks above it - so it claims the
  // slot and feeds the frame itself. It is always inside a dungeon, so
  // the location half of the key is never reached.
  setAmbientTextHost({
    paused: () => ctx.uiOverlayActive,
    say: (text, seconds) => ctx.hudSay?.(text, seconds),   // DaggerfallUI.AddHUDText(text, delay)
    insideBuilding: () => false,   // AUDIT AT F5: this probe is never in a building
    where: () => ({
      insideDungeon: true,
      dungeonType: dfLocation?.mapTableData?.dungeonType ?? 255,   // PlayerEnterExit.Dungeon.Summary.DungeonType
    }),
  });
  const _frameToken = claimFrame();   // P0: this session owns the loop until someone claims after it
  function frame(now) {
    // AUDIT-WH L4: THE PLAQUE DIES WITH THE LOOP THAT RAISED IT. This
    // is the host's only unwind point - a later boot or an unwind has
    // taken the frame - and the plaque is a `document.body` child, so
    // without this a name stayed painted over the next scene (or over
    // the title menu) until something else happened to write it. The
    // modal arms have said this at their mode exits since the slice
    // shipped; the HOSTS that drive it never did, and `world.js`
    // imported the door without ever calling it. A host that boots
    // after this one rebuilds the node on its first painted frame.
    if (!frameAlive(_frameToken)) { destroyWorldPlaque(); return; }   // P0: a later boot or an unwind killed this loop
    frameBegin(now);   // PERF1: the script time (systems/frameClock.js)
    beginInputFrame(keyEdge);   // MWCROUCH
    // AUDIT 39 (#160): a full-screen video owns the canvas for its
    // lifetime (DFU pauses the game for it). The loop WAITS - it
    // neither simulates nor draws - and the clock does not accrue.
    if (frameHeld()) { frameAbort(); hideWorldPlaque(); last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - last) / 1000);
    // AUDIT 28 W7 + F-C1/F-C2 (self-audit 3): PlayerMouseLook.Update's
    // three answers - paused (:241-244) returns before ApplyLook and the
    // owed look WAITS; a held swing (:248-253, WeaponSwingMode 0, not a
    // bow) is SetFacing(lookCurrent) - the owed look is DROPPED; else
    // ApplySmoothing pays it out at the setting's fraction. Before the
    // camera is read.
    gamepad?.tick(dt);   // GP1: the pad's frame - its keys, its stick, its look - before the paused gate, so a window still sees Back and a lifted thumb still releases
    if (!(ctx.uiOverlayActive)) {
      if (swingSuppressesLook({ swingHeld: rightHeld || swipeHeld || swingKeyLatch, weaponIsBow: ctx.weaponIsBow }) && walkMode) lookFilter.settle();   // MAC-O2: the law is lookFilter.js's one seam (:246-248, WeaponSwingMode included); `walkMode` is this host's own
      else lookFilter.tick(dt, cam);
      // FIX-F: the KEYBOARD look - TurnLeft/TurnRight/LookUp/LookDown
      // (InputManager.cs:1854-1865), one look unit a frame in DFU, paid
      // here per second at the live sensitivity (ui/lookSettings.js),
      // into the same filter the mouse feeds, owed to the NEXT tick as
      // a mouse delta is. Additive with the mouse rather than DFU's
      // override-for-the-frame (:1510-1511): a held turn key beside a
      // moving mouse is not a case a player reaches on purpose.
      const kb = keyboardLook(keys);
      if (kb.x || kb.y) lookFilter.add(kb.x * keyboardLookRate() * dt, kb.y * keyboardLookRate() * dt * lookInvert());
      if (pressed(keyEdge, keys, 'CenterView')) lookFilter.centerPitch(cam);   // KB1: Home levels the view (classic Daggerfall's centre key; DFU binds it and reads it nowhere)
      _lockChest = lockOn.tick(dt, cam, walkMode ? player.eye : cam.pos, lookFilter);   // TI1: the lock pays its facing into the same filter, owed to the NEXT tick like a look
    }
    // AT2: AmbientTextMod.Update - a MonoBehaviour Update, so it runs
    // whatever a window is doing and its own `paused` arm decides. It
    // needs no frame delta (its clock is Time.unscaledTime, a wall
    // timestamp), and Unity gives two Updates no order, so it sits
    // BELOW the look rather than anywhere above it: three pins hold
    // this frame's head tight - AUDIT 39 #160 wants the video hold
    // immediately followed by `const dt`, and GP1 and AUDIT 28 W7 want
    // the pad's tick and the look filter adjacent to that line - and a
    // statement dropped among them is indistinguishable, to those pins,
    // from a host that lost one.
    tickAmbientText();
    // TI1: the tap's one-frame press. Armed 2 on the tap: this frame
    // counts to 1 and the gate sees the press (AUDIT 62 F8: `_tapArmed
    // > 0` IS the press - the arm no longer stuffs a literal 'Mouse0'
    // into the held set, which a rebind of ActivateCenterObject would
    // have made inert); next frame counts to 0, the press lifts, the
    // ray is built through the frame the finger saw, and the gate fires
    // the activation on that release. The frame after clears the ray.
    if (_tapArmed > 0 && --_tapArmed === 0) {
      _tapDir = (_tapPoint && _lastProj) ? rayDirFromScreen(_tapPoint[0], _tapPoint[1], canvas.clientWidth, canvas.clientHeight, _lastProj, _lastView, walkMode ? player.eye : cam.pos, worldViewportRect(canvas.clientWidth, canvas.clientHeight)) : null;
    } else if (_tapArmed === 0 && _tapPoint) { _tapPoint = null; _tapDir = null; _tapLockOnly = false; }
    // AUDIT 28 W9: CameraRecoiler.Update - the reel from a hit, on the
    // detector's loss from the vitals rig, same paused gate (:50-51).
    cameraRecoiler.update(dt, cam, { healthLost: lastHealthLost(), healthLostPercent: lastHealthLostPercent(), paused: ctx.uiOverlayActive });
    // AUDIT 28 W10: HeadBobber.Update - the walk bob and nod, the landing
    // dip; the position rides player.eye as a world offset, the nod is a
    // per-frame offset on the look (removed and re-applied each frame).
    {
      const bob = headBobber.update(dt, cam, {
        health: playerEntity.health, paused: ctx.uiOverlayActive, climbing: !!player.climb?.isClimbing, grounded: !!player.grounded,
        swimming: !!player.isPlayerSwimming, running: !!player.isRunning, crouching: !!player.crouching, riding: !!player.riding, levitating: !!player.levitating,   // TR1: the Horse bob style   // XL-1: HeadBobber.cs:101/:215 read playerEnterExit.IsPlayerSwimming (this host writes both members, so the ANSWER is unchanged - the member is)
        velocity: player.moveSpeed || 0, moving: !!(player.moveForward || player.moveStrafe),
      });
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);   // HANDEDNESS (mat4's law): right = (cos, 0, -sin)
      player.bobOffset = [cy * bob[0], bob[1], -sy * bob[0]];
    }
    last = now;
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];   // HANDEDNESS (mat4's law): screen-right = (cos, 0, -sin) under the mirrored projection - Unity's own right
    const overlayHeld = ctx.uiOverlayActive;   // overlays HOLD the world: no movers, no motor - typing a name must not walk the player off the start ledge
    lookGate(overlayHeld);   // a window up frees the cursor; closing re-locks
    // A8 - POINTER PARITY, THE FLAG AT THIS LINE RETIRED. Mouse0 is
    // DFU's ActivateCenterObject: the readied spell fires on its
    // PRESS (EntityEffectManager.cs:250) and the world activation
    // runs on its RELEASE (PlayerActivate.cs:279), with a readied
    // non-touch spell blocking the activation outright. The whole
    // of that law - castPending included - is in
    // systems/activateGate.js so all four hosts read one copy.
    // The port's E stays live BESIDE it (DFU binds E to
    // AbortSpell; a recorded departure, not a gap this slice closes).
    // ROAD-Ar: the gate ticks EVERY frame, walk branch or not, because
    // the paused arm is where it learns a window is up and where it
    // arms RemoveWindow's click delay (:206/:214) for the frame that
    // window pops. Only the CONSUMERS below stay in the walk branch -
    // running the gate inside `!overlayHeld` was what left the click
    // that dismissed a window free to activate the world behind it.
    const _act = activateFrame(activateGate, {
      down: held(keys, 'ActivateCenterObject') || _tapArmed > 0,   // AUDIT 62 F8: the touch tap is the ACTION, not a synthesized 'Mouse0' - a rebind off Mouse0 must not kill the finger, and no key code can honestly stand for a mouse binding
      hasReadySpell: ctx.spellArmed?.() ?? false,
      // PlayerActivate.cs:250-258's stated exception: a readied TOUCH
      // spell leaves doors reachable. rangeType 1 is ByTouch
      // (spellcast.js:206 ClassicTargetIndexToTargetType).
      touchSpell: (ctx.readiedSpell?.() ?? null)?.rangeType === 1,
      hudBlocked: activeMouseOverLargeHUD(),   // PlayerActivate.cs:230-236 - the bar's own click is not the world's
      paused: overlayHeld,                     // InputManager.cs:486-503 - a window holds the action itself
    });
    // QS6 (AUDIT QS6 F6): THE HOLD MACHINE TICKS EVERY FRAME, ABOVE THE GATE.
    // It sat inside `walkMode && !overlayHeld` below, beside the ReadyWeapon
    // and SwitchHand latches it is modelled on - and there its `blocked`
    // argument was DEAD: a blocked frame never reached the call at all, so the
    // machine simply stopped being ticked with a key still down and read the
    // resumed frames as a fresh press. The other three hosts tick
    // unconditionally and let `blocked` disarm; this one does now too.
    ctx.tickQuickHold?.(dt, { isHeld: (a) => held(keys, a), blocked: overlayHeld || !walkMode });
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
      // AUDIT 64 F0/F1: GetOnExteriorWaterMethod (PlayerMotor.cs
      // :582-594) is recomputed every Update (:367) and answers None
      // underground - GetOnExteriorGroundMethod fails on
      // PlayerEnterExit.IsPlayerInside (:511-513). Only the exterior
      // hosts raise the port's flag and nothing cleared it; the swim
      // speed and the jump cancel read it now, so the standalone
      // dungeon states DFU's indoor answer for itself.
      player.onExteriorWater = false;
      const jumpHeld = held(keys, 'Jump');
      const swingKey = swingKeyHeld(keys);   // MAC-SWING1: a swing bound to a KEY or pad code has no mousedown - the latch is polled here, and fed to the rig on the change
      if (swingKey !== swingKeyLatch) { swingKeyLatch = swingKey; if (!swingKey || !ctx.uiOverlayActive) ctx.playerAttackInput(0, 0, swingKey); }
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
      player.isPlayerSwimming = player.swimming = surf != null && player.pos[1] + player.height / 2 + 50 * 0.025 - 0.95 < surf;   // XL-1 (THE FOUR HOSTS): BOTH swim members off the one blockWaterLevel test, as PlayerEnterExit.cs:384-392 writes them. Outdoors the two part company - :421 clears the motor's with no tile test - which is why the exterior hosts write only the host flag
      player.levitating = ctx.playerLevitating();
      player.waterWalking = ctx.playerWaterWalking();
      // S19 paralysis: FrictionMotor cancels ALL movement input (the
      // player still falls / rides platforms), AcrobatMotor cancels
      // the jump, LevitateMotor cancels levitate movement. Look
      // stays live (no DFU gate on mouselook).
      // P12 crouch: toggled on the Crouch edge (DFU's default C -
      // I2 retired the port's X-crouch/C-cast departure).
      const paralyzed = ctx.playerParalyzed?.() ?? false;
      // A6: FrictionMotor.GroundedMovement's head-dip guard reads
      // IsParalyzed itself (:90-93) - the zeroed input bag below is
      // the movement half of the same law, not this one.
      player.paralyzed = paralyzed;
      const crouchHeld = held(keys, 'Crouch');
      const crouchPress = pressed(keyEdge, keys, 'Crouch');   // MWCROUCH: GetKeyDown, not a held-ring derivation - the levitate descent below still reads the HELD key
      const mv = moveHeld(keys);
      mv.analog = touch?.axes() ?? gamepad?.axes() ?? null;   // TI2: the stick's throw, when the layer has one - MoveAxes' joystick arm takes it over the key impulse; GP1: the pad's stick when no finger
      // AUDIT 64 F3: InputManager.cs:542-545 - `if (ToggleAutorun)
      // ApplyVerticalForce(1);` runs in Update ahead of
      // FindKeyboardActions, so the latch drives the vertical axis
      // forward with no key held. The latch itself lives in the motor
      // (PlayerSpeedChanger's half), so this reads last step's value -
      // DFU's own script-order indeterminacy between InputManager.Update
      // and PlayerMotor.Update.
      const axes = moveAxes.update(dt, { ...mv, autorun: player.toggleAutorun });   // AUDIT 28 W8: one Update of the axes per frame the motor runs
      // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
      // gates movement/jump only (DecideHeightAction has no check).
      // AUDIT 39r: and so does the SPEED-ADJUSTMENT capture. DFU zeroes the
      // movement VECTOR (FrictionMotor :75-81, AcrobatMotor :135-141);
      // CaptureInputSpeedAdjustment runs in Update behind a levitate gate
      // and nothing else. Dropping run/sneak/autoRun/back from this bag read
      // as a RELEASE to the motor's press-edge latches, so a key held
      // through the paralysis fired a synthetic press on the frame it lifted.
      player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: held(keys, 'Run'), autoRun: held(keys, 'AutoRun'), back: mv.backwards, sneak: held(keys, 'Sneak'), jump: false, up: false, down: false, crouch: crouchPress } : {
        forward: axes.forward,   // AUDIT 28 W8: InputManager's axes - accelerated under MovementAcceleration, the held difference without
        strafe: axes.strafe,
        run: held(keys, 'Run'),
        // AUDIT 39: PlayerSpeedChanger's AutoRun latch (:82-99) - the
        // press flips ToggleRun; MoveBackwards is its cancel key.
        autoRun: held(keys, 'AutoRun'),
        back: mv.backwards,
        sneak: held(keys, 'Sneak'),   // P15: DFU's default Sneak binding (LeftAlt), held
        jump: jumpHeld,   // P14: HELD, verbatim (AcrobatMotor re-fires past the 0.1 s grounded gate - intended bunny-hopping)
        up: jumpHeld || held(keys, 'FloatUp'),
        // AUDIT 26 F031: LevitateMotor's descent arm is Crouch OR
        // FloatDown (:88-89), the mirror of the rise arm above; the
        // port's own motor contract said so and every host passed
        // FloatDown alone, so C did nothing but toggle the stance.
        down: crouchHeld || held(keys, 'FloatDown'),
        crouch: crouchPress,
      }, cam.yaw, cam.pitch);
      // FS-slice: PlayerFootsteps - the dungeon stride on stone with
      // the water arms (shallow = the LIVE capsule centre 0.57 under
      // the block water line - AUDIT 64 F4).
      {
        const _step = _footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          spriteStep: mwViewFootstep(),   // AUDIT-EOTB2: SyncFootsteps - the sprite's stride while it is on screen
          // AUDIT 64 F3 (review): PlayerFootsteps gates on
          // `playerMotor.IsStandingStill` (PlayerFootsteps.cs:264-265), which
          // is `Vector2(moveDirection.x, moveDirection.z).magnitude == 0`
          // inside `if (grounded)` (PlayerMotor.cs:113-125) - NOT a HasAction
          // read. Under AutoRun, InputManager.cs:542-545's ApplyVerticalForce
          // writes a non-zero moveDirection with no move key down, so DFU
          // plays the stride; `!anyMove(keys)` silenced it. `player.standing`
          // IS that getter (grounded && no forward/strafe axis), so it also
          // keeps the paralysed player silent - the hosts zero both axes.
          standingStill: player.standing,
          halfSpeed: player.movingLessThanHalfSpeed,
        }, pickFootstepSet({ inside: true, inBuilding: false,
          dungeonSwimming: player.swimming,
          // F090: the LATCHED flag - shallow is entered at 0.57 and
          // only left at 0.95 (PlayerFootsteps :189, :199-208).
          // AUDIT 64 F4: those two arms read `playerMotor.transform
          // .position.y`, the LIVE CharacterController centre -
          // ControllerHeightChange (PlayerHeightChanger.cs:477-478)
          // moves the transform by heightChange/2 so the FEET stay
          // planted and the centre is feet + controller.height/2 in
          // every stance. The standing half-height was baked here as
          // 0.9, so a CROUCHED player (0.45) carried a threshold 0.45
          // too high and kept the stone pair through water DFU has
          // already splashed in. (The sunk 0.30 swim capsule cannot
          // reach this arm: DoSinking/DoUnsinking arm only on
          // `OnExteriorWater == Swimming` - PlayerHeightChanger.cs
          // :127, :147-158 - which GetOnExteriorWaterMethod answers
          // None for indoors, PlayerMotor.cs:582-587 over :505-514. A
          // dungeon swimmer is force-crouched instead, :193-199.) motor.js's
          // `height` getter IS controller.height, and the swim toggle
          // three dozen lines above already reads it.
          dungeonShallow: _footsteps.waterStep(player.pos[1] + player.height / 2, surf, player.swimming) }));
        if (_step) ctx.hitEffects?.footfall?.(player.pos, [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)]);   // BLOOD2d: a foot came down - treading in blood tracks it
        if (_step && classicFootstepAllowed(_step.clip)) audio.playOneShot(_step.clip, _step.volume);   // IF1: DisableVanillaFootsteps - every classic clip is None while the mod owns the stride; BA1: Better Ambience nulls all but Dungeon2 and Outside2 (DisableBuiltInFootsteps' slip)
        // IF1: ImmersiveFootstepsObject.FixedUpdate - the dungeon arm off the water level (null = blockWaterLevel 10000) and the LIVE capsule centre.
        immersiveFootsteps.update(dt, {
          paused: overlayHeld, entity: playerEntity,
          grounded: player.grounded, standingStill: player.standing, isRunning: player.isRunning, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed,
          transportMode: player.transportMode, swimming: !!player.isPlayerSwimming, pos: player.pos,
          inside: true, inDungeon: true,
          centreY: player.pos[1] + player.height / 2, waterSurfaceY: surf ?? null,
        });
        // BA1: BetterFootstepsComponentPlayer.Update, CameraShaker.Update, ReverbMod.Update and the rain source's Update, one call.
        betterAmbience.frame(dt, {
          entity: playerEntity, inside: true, inBuilding: false, inDungeon: true,
          grounded: player.grounded, standingStill: player.standing, isRunning: player.isRunning, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed,
          levitating: player.levitating, swimming: !!player.isPlayerSwimming, motorSwimming: !!player.swimming, pos: player.pos, centreY: player.pos[1] + player.height / 2,
          waterSurfaceY: surf ?? null, onExteriorWater: false, onExteriorWaterAny: false, onExteriorPath: false, onStaticGeometry: false, onFoot: true,
          winter: false, climateIndex: 0, loadInProgress: false, paused: overlayHeld,   // AUDIT-BA F3
        });
      }
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      // AUDIT 64 F7: the two dungeon hosts fed the RAW Run key
      // (`held(keys,'Run') && moving`) where their three siblings feed
      // the motor's latch. PlayerMotor.IsRunning (:108-111) is
      // PlayerSpeedChanger.isRunning, latched from the run MODE only
      // while grounded (:107-118) - and the mode is the AutoRun/
      // ToggleRun latch, never the physical key, so an autorunning
      // dungeon crawler read false: no Running tally at all and
      // DefaultFatigueLoss 11/min where PlayerEntity.cs:408-409 charges
      // RunningFatigueLoss 88. The old `moving` term was input-derived
      // where DFU's IsStandingStill (PlayerMotor.cs:113-125) is
      // grounded-gated and false in the air, so `player.standing` is
      // the faithful term (and the footstep gate above now reads it
      // too - AUDIT 64 F3 review).
      ctx.reportActivity?.({ running: player.isRunning && !player.standing, runningTally: player.isRunning && !player.riding, swimming: player.swimming, climbing: !!player.climb?.isClimbing, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed, fell: player.landedFallDistance });   // P13 sneak state + P14 fall landing (AUDIT 26 F083)
      ctx.reportMotor(player.grounded, player.velY, cam.yaw);
      ctx.reportInput?.([...keys].join('+') || 'none', cam.pitch);
// ROAD-Ar: the gate itself ran at :459, above the overlay guard.
      // This is only where its answer is CONSUMED. R10: the swing below
      // is the raw right button - DFU's own 'Mouse1'
      // (InputManager.cs:1010) - but never read through held(), so a
      // SwingWeapon rebind is inert (recorded departure).
      if (_act.cast) ctx.playerAttackInput(0, 0, true);   // the armed click casts (dungeonContext:1827); firePending sends it down the live look
      const useEdge = pressed(keyEdge, keys, 'Interact');   // KB1: the Interact ACTION (E by default, Mac's call) - it was a raw `KeyE` beside DFU's E-AbortSpell, and one press did both
      if (pressed(keyEdge, keys, 'ReadyWeapon')) ctx.readyWeapon?.();   // sheathe toggle (audit 2026-08-17)   // MAC-O1: the KEY takes WeaponManager.Update's arm (:229-269), not HUDLarge's raw ToggleSheath
// a12: SwitchHand (H) - ActionComplete's RELEASE edge
      // (WeaponManager.cs:272), so the latch is inverted against Z's.
      if (released(keyEdge, keys, 'SwitchHand')) ctx.switchHand?.();
      if (_act.activate || useEdge) tryActivate();
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
      const _eye = player.eyeAt();   // EV1: a camera path, so the interpolated eye
      cam.pos = [_eye[0], _eye[1] - ctx.deathDrop, _eye[2]];
    }
    if (walkMode && (ctx.deathDrop ?? 0) > 0) ctx.deathTilt?.(cam);   // DEATH3: the enhanced fall looks up, off the same gate

    // ROAD-E E5: the DOCKED large HUD shrinks the world pass rather
    // than covering it (ViewportChanger.cs:56-62), and Unity derives a
    // camera's aspect from its viewport - so the lens takes the bar's
    // height out of its denominator. This host draws the bar through
    // dungeonContext's own drawHud, so it carries the law too.
    const proj = mirrorProjectionX(perspective(fieldOfView(), largeHudWorldAspect(canvas.clientWidth, canvas.clientHeight), 0.05, 800));   // HANDEDNESS (mat4's law)
    // MW-D25: the walk camera rides the Morrowind machine; the free-fly
    // scout keeps its own eye (it has no player body to orbit).
    const mwv = walkMode
      ? mwViewFrame({ fpEye: cam.pos, feet: player.feetAt(), yaw: cam.yaw, pitch: cam.pitch,
          dt, riding: !!player.riding,   // AUDIT-EOTB F3/F4: the host's own clock, and the one state only it has
          raycast: (o, d, m) => ctx.collider.raycast(o, d, m),
          spherecast: (o, r, d, m) => { const h = ctx.collider.sphereCast(o, r, d, m).dist; return Number.isFinite(h) ? h : null; } })   // MAC-A: castSphere's seam beside the ray - the camera's two obstacle guards are sphere casts (camera.cpp:186, :200)
      : { eye: cam.pos, thirdPerson: false };
    const target = [mwv.eye[0] + fwd[0], mwv.eye[1] + fwd[1], mwv.eye[2] + fwd[2]];
    const view = betterAmbience.view(lookAt(mwv.eye, target, [0, 1, 0]));   // BA1: the shaker sits between the follower and the camera
    _lastProj = proj; _lastView = view;   // TI1: the tap ray unprojects through the frame the finger saw
    if (touch) {   // TI1: the lock-on dot over the foe's chest, hidden behind the camera
      const _dp = _lockChest ? projectToScreen(_lockChest, canvas.clientWidth, canvas.clientHeight, proj, view, worldViewportRect(canvas.clientWidth, canvas.clientHeight)) : null;
      touch.setLockDot(_dp && _dp.front ? _dp.x : null, _dp?.y);
    }

    ctx.flicker.tick(dt);
    // AUDIT 26 F183: per FRAME, not once at load - the ambient depends
    // on which block the player stands in (PlayerAmbientLight.cs:82-90),
    // so it has to follow them across a castle or special-area
    // boundary the way the load-time write never could.
    { const _tri = dungeonTrilight(lightingOn, betterAmbience.dungeonAmbient()); renderer.setLighting(new Float32Array(_tri ? _tri.equator : dungeonAmbient(lightingOn, ctx.ambient)), 0, undefined, _tri); }   // EL4: the lane's dark - the trilight scaled once, the flat ambient once   // BA1: FoggyDungeons' Trilight, else PlayerAmbientLight's flat
    // ROAD-B (b3): UnderwaterFog.UpdateFog, at PlayerEnterExit.Update's
    // own cadence (:349-352). The load-time setFog at :331 stays as the
    // dry state; this is the per-frame one, and DUNGEON_FOG is the same
    // DungeonFogSettings written there (WeatherManager.cs:77).
    { const _fog = dungeonFog(lightingOn, betterAmbience.dungeonFog() ?? DUNGEON_FOG); applyFog(renderer, ctx.underwaterFogSettings?.(cam.pos[1], player.pos, _fog) ?? _fog); }   // AUDIT-EL F6: the fog colour under the lane's dark   // BA1: FoggyDungeons' linear fog is the base the water murk overrides
    renderer.setPointLights(
      // A10: DungeonLightHandler's XZ block range culls first, the
      // 16-slot shader cap picks from what survives (dungeonLights.js
      // carries the composition and why that order).
      withPlayerLights(nearestLights(ctx.lights, cam.pos, renderer.maxPointLights, ctx.flicker.ranges, null, DUNGEON_LIGHT_BLOCK_RANGE),   // EL1: the installed set's cap
        ctx.candleLight?.(), playerTorchLight(playerEntity, player.feetAt(), cam.yaw), thunderlockMuzzleLight(playerEntity, player.feetAt(), cam.yaw), ...ctx.campLights(), ...ctx.torchLights()),   // X11 candle; T1 torch; HT1 the dropped lights; FIELD-GUN13 the muzzle flash; DISC13-A the hand lights ride the render feet (feetAt), as the camera does
      DUNGEON_LANTERN_F32);
    renderer.setWorldViewport(worldViewportRect(canvas.clientWidth, canvas.clientHeight));   // E5: ViewportChanger.Update, every frame
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);   // AUDIT-EL F5: a WORLD frame - the lane replays its records for this one
    if (walkMode) mwViewDrawBody(canvas, { proj, view, eye: mwv.eye, feet: player.bodyFeetAt(), yaw: cam.yaw });   // MW-D24; DISC18: the body at the capsule's own feet, not the camera's smoothed ones
    if (ctx.staticBatch) renderer.drawMesh(ctx.staticBatch, BATCH_IDENTITY, null);   // PERF5: the level's static models, one call per texture (keys resolved in the merge)
    for (const d of ctx.drawList) if (!d._batched) renderer.drawMesh(d.mesh, d.matrix, ctx.texRemap);
    for (const d of ctx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, ctx.texRemap);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    ctx.flatAnims.tick(dt);   // FA1: whoever draws the flats runs their clock
    // (the blood pool's clock runs inside ctx.drawFoes now - both dungeon
    // hosts call it, so neither can forget it; 2026-08-27)
    ctx.bloodMarks?.draw?.(camRight, UP_Y);   // BLOOD1 AUDIT 3: the context's ring, drawn by THIS host beside the level's flats and under them - it used to ride drawFoes' gate, so a cleared level drew no blood at all
    renderer.drawBillboards([...ctx.billboardBatches, ...ctx.campBatches(), ...ctx.torchBatches()], camRight, UP_Y);   // HT1: the dropped torches on the same pass
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
    // AUDIT FONT F3: the branch below returns above `drawFoes`, the only
    // place this host reaches drawHud - so ui/hud.js's mid-screen
    // draw/hide and the popup column's never ran on an overlay frame,
    // and both are DOM under the enhanced skin: they stay painted until
    // told otherwise (AUDIT 64 F37's law). On ?dungeon there is no
    // townTalk drawing a second column behind them either. So the hide
    // doors ride the branch's own first line, before the return.
    if (ctx.uiOverlayActive) {
      ctx.hideHudText?.(); hideWorldPlaque(); ctx.tickOverlay(dt); ctx.drawOverlay(canvas);   // AUDIT-WH H4: the plaque is a DOM node and this return is ABOVE drawFoes, where the hover lives
      // U26: the shot counter advances HERE TOO. This early return
      // skipped it, so __frame froze the moment any overlay opened -
      // and the Process rule says a probe must frame-sync rather than
      // sleep, which an overlay made impossible in this host. The
      // dungeon inventory probe hit it on its first press of F6.
      frames++;
      if (shotMode) window.__frame = frames;
      capturePendingScreenshot(canvas);   // SS1: a save armed under an overlay still lands its shot
      frameAbort();   // AUDIT-WH2 L1-F4: the frame never reached frameEnd - close the token, take no sample
      requestAnimationFrame(frame);
      return;   // U2b/U3: hold gameplay, keep the loop (AUDIT 18 F5: the overlay's own clock still runs - DFU's RestWindow.Update ticks on realtime under timeScale 0)
    }
    ctx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, anyMove(moveHeld(keys)), player.height, !!player.isSneaking, motionBagOf(player), player.bobOffset ? player.bobOffset[1] : 0, !!player.crouching, player.feetAt());   // DISC13-A: the render feet, the candle's   // ROAD-H H1b: PlayerMotor.IsCrouching rides in beside the live height - the archer's 0.05 dip (DaggerfallMissile.cs:583-585) is the latched STATE, not a 0.9 capsule   // moveHeld: the collision-trigger input gate (verbatim)   // internally gated (S4b: missiles fire without foes)   // C8 E1+E2: rigged class enemies, classic senses + pursuit
    // WATER-D1: the water plane is drawn INSIDE drawFoes now, before the
    // weapon overlay - a draw here landed after the lane's resolve and
    // showed through every wall (dungeonContext.js's note at the draw).
    // STATUS-LIVE: ...AND A NON-PAUSING OCCUPANT, LAST OF ALL. THE FOUR
    // HOSTS RULE: this host mounts the SAME dungeonContext worldModes'
    // dungeon arm does and routes the same key table at it, so a window
    // the game is not stopped for - the status readout, ui/statusBox.js
    // - has to be ticked and painted here too. The branch above is the
    // PAUSED arm and it returns; without this line the Status key would
    // open a readout on `?dungeon` that no frame ever draws.
    if (ctx.unpausedOverlay) { ctx.tickOverlay(dt); ctx.drawOverlay(canvas); }

    frames++;
    if (shotMode) window.__frame = frames;
    if (shotMode && frames === 5) window.__shotReady = true;
    // SS1: deliver a pending save screenshot after the frame's last
    // draw (preserveDrawingBuffer false - the buffer is only this
    // task's to read).
    capturePendingScreenshot(canvas);
    frameEnd();   // PERF1
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
