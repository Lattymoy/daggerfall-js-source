// Exterior location scene: a full location assembled on the block grid.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).

import { getFloat } from '../systems/settings.js';   // AUDIT 28 W1: NightAmbientLightScale
import { FlatAnimator, armFlatAnim } from '../render/flatAnimation.js';   // FA1: the flats that move
import { racialSuppressPopulationSpawns, racialSuppressInventory, racialSuppressTalk, lycanthropeMoveSound } from '../systems/lycanthropy.js';   // V4: the transformed gates; LM1: the 4-20s move-sound loop
import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook, makeLookGate, bindCursorToggle } from '../player/pointerLock.js';   // U45: bindCursorToggle is PlayerMouseLook.cursorActive
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { isPlayerInTown } from '../systems/nearbyObjects.js';   // PlayerGPS.IsPlayerInTown, both optional flags
import { convertTilemap, isOutdoorWaterTile } from '../world/terrainSurface.js';   // FD1: PlayerTileMapIndex == 0
import { GROUND_OFFSET, GROUND_TILE_DIM } from '../world/rmbLayout.js';
import { PlayerMotor, startRestGroundedCheck } from '../player/motor.js';   // the rest gate's grounded input, one home
import { jumpSpeedMultiplier, tallySkill, SKILLS } from '../systems/skills.js';
import { createWeaponRig } from '../combat/weaponRig.js';
import { racialRestBlock } from '../systems/vampirism.js';   // V2b: the vampire's rest gate
import { ArrowFlight, playerArrowHitFoe } from '../combat/arrowFlight.js';   // C13: visible exterior arrows; AUDIT 39 (#64): and the shaft that LANDS
import { inflictPoison } from '../systems/poisons.js';   // AUDIT 39 (#64): a poisoned shaft doses its mark
import { spendArrow, totalWeight } from '../systems/inventory.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { playerEntity, surfacePlayer, hurtPlayer, setDeathPresenter, setAvoidDeathHook } from '../characters/playerEntity.js';
import { SOUND } from '../systems/soundClips.js';
import { Collider } from '../player/collider.js';
import { mwViewFrame, mwViewWheel, mwViewDrawBody } from '../player/mwView.js';   // MW-D25: the Morrowind camera
import { PITCH_LIMIT } from '../player/mwCamera.js';   // MW-D30: camera.cpp:323-331's own clamp
import { getStaticDoors } from '../world/staticDoors.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1: the lights the PLAYER carries
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { applyClimate, getGroundArchive, getNatureArchive } from '../world/climateSwaps.js';
import { RMB_SIDE, layoutLocation } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, mirrorProjectionX, transformPoint, trs, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { frustumPlanes, aabbOutside, localAabb, transformedAabb, flatBatchAabb, cullDisabled } from '../render/frustum.js';   // EV3: the frustum
import { withMoonAmbient } from '../render/enhancedSky.js';   // EV5: secunda rides the ambient
import { drawCharacterSprite } from '../render/characterSprite.js';
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { collectExteriorNpcs, exteriorNpcRecord } from '../characters/exteriorNpcs.js';   // C2 / AUDIT 26: RMBLayout's street StaticNPCs
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { audio } from '../systems/audio.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4
import { CityNavigation } from '../world/cityNavigation.js';   // T1 towns
import { TownPopulation } from '../systems/townPopulation.js';
import { GUARD_TEXTURE, MobilePerson, PERSON_TEXTURES, personWantsToStop } from '../characters/mobilePerson.js';
import { createTownTalk } from './townTalk.js';   // T3b
import { createPlayerMagic } from './hostMagic.js';   // M2: spellcasting above ground
import { preloadSpellbookArt, spellbookArtLoaded } from '../ui/spellbookWindow.js';   // U42: the classic art window (retires M2's keyed stand-in)
import { createSpellbookWindow } from '../ui/spellbookDoor.js';   // PX23: the book's one door
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C2): the ONE clock
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS, playerPainVoice, playPlayerVoice } from './hostCombat.js';   // AUDIT 23 (C14)
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { RestWindow } from '../ui/restWindow.js';   // S40: rest above ground
import { setEnemyAlert, areEnemiesNearby } from '../systems/encounters.js';   // the enemy arm RAISES the alert before refusing; the RESTING variant asks the pool, the STRICT one gates the townsfolk idle
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5): the collapse box
import { healthStatusRows, statusInfoRows } from '../systems/healthStatus.js';   // BS1/F198: the Status health box
import { maxFatigue } from '../systems/statMods.js';   // AUDIT 23 (C5)
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { rangedDamageSpells } from '../systems/spellcast.js';   // U42: the flight probe's picker
import { seasonValue, dateFromClassicMinutes } from '../systems/gameDate.js';   // AUDIT 23 (wts-1)
import { getNameBankOfRegion } from '../characters/nameHelper.js';   // AUDIT 23 (characters-5)
import { createHitEffects } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { createCityGuards } from './cityGuards.js';   // G1
import { createArrestFlow } from './arrestFlow.js';   // G2
import { makeInView } from '../player/cameraView.js';   // AUDIT 17e F24
import { pickActivatable } from '../player/activate.js';   // G3: corpse loot
import { LevelUpScreen, preloadCharSheetArt } from '../ui/charsheet.js';
import { createCharSheetWindow, charSheetDoorReady } from '../ui/charSheetDoor.js';   // U52: the sheet's ONE seam, and the skin fork in front of it
import { restDecision } from '../systems/restSession.js';   // U48: the DISPATCH (DaggerfallUI.cs:651-688) above the rest window
import { QuestJournalWindow, preloadQuestJournalArt } from '../ui/questJournal.js';   // U43: the LogBook and NoteBook doors
import { makeOpenBookHook, preloadBookArt } from '../ui/bookReader.js';   // B1
import { DeathScreen } from '../ui/deathScreen.js';   // AUDIT 21 hosts F6: dying above ground
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the classic HUD, which this host did not draw
import { largeHudOptions, routeLargeHudClick, hudLargeNextMode, hudLargePrevMode } from '../ui/hudLarge.js';   // U45: the classic bottom bar and its eleven panels
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { getInteractionMode } from '../player/interactionMode.js';   // U45: the mode panel's cycle reads it
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
import { preloadInventoryArt } from '../ui/nativeInventory.js';   // U8d: the native inventory
import { createInventoryWindow, inventoryDoorReady } from '../ui/inventoryDoor.js';   // U53: the pack's ONE seam, and the skin fork in front of it
import { createDroppedLoot } from './droppedLoot.js';   // U8e: the ground piles
import { preloadPaperDollArt } from '../ui/paperDoll.js';   // U8f: the avatar base
import { seedStartingEquipment, EQUIP_SLOTS } from '../systems/equip.js';   // U8h: the worn-weapon binding
import { createChargenFlow, createChargenWindow, finishChargen, loadSpellIndex, applyHeadlessChargen } from '../systems/chargenSession.js';   // S3c/U9
import { preloadChargenArt } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { buildingDataForDoor } from '../systems/talkTopics.js';   // E2: the shop identity
import { hitSoundFor, swingSoundFor } from '../systems/soundClips.js';
import { isInvisible, entityIsParalyzed } from '../systems/effects.js';   // AUDIT 39: the S19 gate is host-agnostic in DFU
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD } from '../systems/soundClips.js';
import { ChoiceWindow } from '../ui/talkWindow.js';   // V1: the infection popup's box
import { startInfection, liveInfection } from '../systems/infection.js';   // V1 probe surface: the bite and the lifecycle
import { diseaseCount } from '../systems/diseases.js';
import { MINUTES_PER_DAY } from '../systems/gameDate.js';
import { fetchBytes, loadMagicRegistries, parseSeason, createSkyController, createPlayerTicker, createRestDeps, plainLines, wireInfectionVideos, createMusicDirector, motorStats, climbingDeps, createDetectFeed, foeNearbyRecord, lootNearbyRecord, nearbyLootRecords, claimFrame, frameAlive, frameHeld, applyFallLanding, ensureAudio, outdoorFogColor, applyMotorEffectFlags, populatesWanderingNpcs, endRunToTitleMenu, exitToTitleMenu, subscribeFoePools, sensesContext, routeMouseDrag } from './shared.js';
import {
  WEATHER_TYPES, fogForWeather, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
// WM2b: the windmill's law, and the vendored rotor it turns.
import { ROTOR_HUB, rotorPhase, advanceRotor, mountRotor, MILL_SOUND, millSoundPosition } from '../world/windmills.js';   // WM4c: and the hum
import { BODY } from '../world/windmillMesh.js';   // WM2d: the tower, for the collider
import { remapSubMeshes } from '../world/texRemap.js';   // WM3: the one climate/dungeon remap seam
import { isEnhanced } from '../systems/uiSkin.js';   // WM2d: mills are an enhanced-skin departure (the roads were the other one, removed whole at RX)
import { PrecipitationRenderer } from '../render/precipitation.js';
import { setWeather, currentWeather, tickWeather } from '../systems/weatherSim.js';   // W1: the live weather state
import { SEASON } from '../world/climateSwaps.js';
import { addGold, setCrimeCommitted } from '../systems/court.js';   // U10 probe surface; V4: the one crime setter
import { lookScale, lookInvert } from '../ui/lookSettings.js';   // SETT: MouseLookSensitivity + InvertMouseVertical
import { LookFilter } from '../player/lookFilter.js';   // AUDIT 28 W7: MouseLookSmoothingFactor
import { MoveAxes } from '../player/moveAxes.js';   // AUDIT 28 W8: MovementAcceleration
import { CameraRecoiler } from '../player/cameraRecoiler.js';   // AUDIT 28 W9: CameraRecoilStrength
import { HeadBobber } from '../player/headBobber.js';   // AUDIT 28 W10: HeadBobbing
import { lastHealthLost, lastHealthLostPercent } from '../ui/hudVitals.js';   // AUDIT 28 W9: the detector's loss
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { actionOf, held, moveHeld, anyMove, swallowBrowserKey } from '../ui/input.js';   // I2: the rebindable registry
import { openPauseFlow, preloadPauseFlowArt, pauseDoorReady } from '../ui/pauseDoor.js';   // I3/I4; U51 picks the skin
import { openPixelDial } from '../ui/pixelDial.js';   // PX15b: the Tab compass rose
import { ExteriorAutomapWindow } from '../ui/exteriorAutomapWindow.js';   // A2: the town map on M
import { discoveredBuildings } from '../systems/discovery.js';   // A2: the nameplates' gate
import { activeMemberships } from '../systems/guilds.js';   // F117
import { avoidDeath, AVOID_DEATH_TEXT } from '../systems/guildServices.js';   // F117: Stendarr

export async function bootExterior(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';

  audio.ensure(fetchBytes);   // AUDIT 18 F6: sound was booted ONLY by buildDungeonContext, so this host was silent until a dungeon was entered
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

  // Climate + season: swap every submesh archive exactly as DFU's
  // MaterialReader.ChangeClimate does - pixels from the swapped archive,
  // UVs from the original (the SetDungeonTextures pattern).
  const season = parseSeason(params);
  const climateBase = dfLocation.climate.climateType;
  // FS-slice: the location's raw CLIMATE.PAK index (the snow gate reads it)
  const _locPixel = longitudeLatitudeToMapPixel(dfLocation.mapTableData.longitude, dfLocation.mapTableData.latitude);
  const locClimateIndex = maps.getClimateIndex(_locPixel.x, _locPixel.y);
  const footsteps = new FootstepMachine();
  const groundArchive = getGroundArchive(climateBase, season);
  const natureArchive = getNatureArchive(dfLocation.climate.natureArchive, season);
  const texRemap = new Map();

  // Shared lazy pipeline (P7): the same caches the world scene uses,
  // PREWARMED for the location below so boot behavior is unchanged -
  // and able to lazy-load the models/archives interiors and dungeons
  // reference beyond the location's own set.
  const pipeline = createDataPipeline({ renderer, arch, palette });
  // AUDIT 18 HOST GAP: the audio engine's bootstrap lived only in
  // buildDungeonContext, so every sound in this host was a silent
  // no-op until a dungeon was entered (DFU's sound reader is global
  // and the exterior prefab is audible from frame one).
  ensureAudio(fetchBytes);

  const { textureFiles, getTexture, uploadRecord, uploadRecordFrame, getGpuMesh, getWindmillMeshes, getMachineryParts, gpuMeshes, cpuModels } = pipeline;

  // Collect the location's model ids + referenced texture archives.
  const modelIds = new Set();
  const archives = new Set([groundArchive, LIGHTS_ARCHIVE]);
  for (const b of loc.blocks) {
    for (const placed of b.layout.models) modelIds.add(placed.modelIdNum);
  }
  status(`loading ${modelIds.size} models`);
  await Promise.all([...modelIds].map((id) => getGpuMesh(id)));
  // Climate swap table over every submesh, exactly as the world's
  // per-pixel pass: pixels from the swapped archive, UVs from the
  // original (verbatim MaterialReader.ChangeClimate; missing-record
  // remaps pruned - 27 corpus pairs, R1 audit).
  const climateArchive = (archive, record) => applyClimate(archive, record, climateBase, season);
  for (const id of modelIds) {
    const gpu = gpuMeshes.get(id);
    if (!gpu) continue;
    for (const sm of gpu.subMeshes) archives.add(sm.textureArchive);
    await remapSubMeshes(gpu.subMeshes, texRemap, climateArchive, pipeline);
  }
  status(`loading ${archives.size} texture archives`);
  await Promise.all([...archives].map((a) => getTexture(a)));

  // Per-block scene list: world matrices with the block origin folded in,
  // plus one ground mesh per block, plus flats grouped into billboard batches.
  const sky = createSkyController(renderer.gl, params);
  // R9 ground: one tilemap for the whole location grid (16 tiles per
  // block side, square texture over max(w, h) blocks; the flat surface
  // only spans the real extent so padding is never sampled).
  const tilemapDim = GROUND_TILE_DIM * Math.max(loc.width, loc.height);
  const locationTilemap = new Uint8Array(tilemapDim * tilemapDim);
  const cityLights = []; // archive-210 lantern point lights (R3)
  const CITY_LIGHT_COLOR_F32 = new Float32Array(CITY_LIGHT_COLOR);
  // World clock (R5): ?tod=HH:MM (default noon), ?timescale=game-min/sec.
  // Weather (R12 presentation; W1 live state - world.js's twin note).
  // ?weather pins for shots; otherwise the sim drives and applyWeather
  // re-derives the presentation on each change.
  const weatherOverride = WEATHER_TYPES.includes(params.get('weather'))
    ? params.get('weather') : null;
  if (weatherOverride) setWeather(weatherOverride);
  const weatherSeed = weatherRng(Number(params.get('wseed')) || 1);
  let weather = weatherOverride ?? currentWeather();
  let weatherFog = fogForWeather(weather);
  let weatherSkyOffset = skyOffsetForWeather(weather, weatherSeed);
  let weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
  let precipMode = precipitationForWeather(weather);
  let precip = precipMode ? new PrecipitationRenderer(renderer.gl) : null;
  let lightning = weather === 'thunder'
    ? new LightningPlayer(Number(params.get('wseed')) || 1) : null;
  function applyWeather(w) {
    weather = w;
    weatherFog = fogForWeather(w);
    weatherSkyOffset = skyOffsetForWeather(w, weatherSeed);
    weatherSun = weatherSunlightScale(w, season === SEASON.Winter);
    precipMode = precipitationForWeather(w);
    if (precipMode && !precip) precip = new PrecipitationRenderer(renderer.gl);
    lightning = w === 'thunder'
      ? (lightning ?? new LightningPlayer(Number(params.get('wseed')) || 1)) : null;
  }
  // AUDIT 23 (C2: hosts-8 = audio-1): ONE clock. The time-of-day gates
  // (music night, city lights, window styles, sun) used a demo clock
  // frozen at noon by default while gameplay time advanced on
  // worldMinutes - night never fell. ?tod now SETS the world clock's
  // time-of-day at boot and ?timescale SCALES the world tick (DFU's
  // TimeScale, default 12); minuteNow reads the one clock.
  {
    const bootTod = parseTimeOfDay(params.get('tod'));
    if (bootTod != null) setWorldMinutes(Math.floor(worldMinutes() / 1440) * 1440 + bootTod);
  }
  const timeScaleMult = params.has('timescale') ? Number(params.get('timescale')) / 12 : 1;
  const minuteNow = () => worldMinutes() % 1440;

  // A5b: OUTDOOR MUSIC. AssignPlaylist's City/Wilderness arms - night
  // overrides everything, and by day the weather picks the list
  // (SongManager.cs:585-612). The pick itself is DFU's day-seeded
  // branch, so a location's song is stable until midnight.

  const lightsOnAt = (minute) =>
    params.has('window') ? params.get('window') === 'night' : isCityLightsOn(minute);
  const lightSize = (record) => {
    const t = textureFiles.get(LIGHTS_ARCHIVE);
    return scaledBillboardSize(t.getSize(record), t.getScale(record));
  };
  const drawList = [];
  const windmills = [];   // WM2b: placed mills whose rotor turns each frame
  // EV3: THE FRUSTUM. This host builds in plain world space, so every
  // drawList row carries a world-space box (one local scan per model
  // ARCHETYPE, eight corner transforms per placement, all at build).
  // ?cull=off is the escape hatch, read once here like the world host's.
  const cullOn = !cullDisabled();
  const _planes = new Float32Array(24);
  const _pv = new Float32Array(16);
  const archAabbs = new Map();
  const archAabb = (id, positions) => {
    let b = archAabbs.get(id);
    if (!b) archAabbs.set(id, b = localAabb(positions));
    return b;
  };
  const MILL_SAIL_PAD = 30;   // the sails sweep past the tower's own box
  const _visBatches = [];     // refilled per frame, never reallocated (the EV2 lesson)
  // WM2d: the mill's two parts, uploaded once for the location and only
  // when a block here actually stands one - a town with no farm pays
  // nothing. Enhanced skin only: the 1:1 lane sees the game's own farms.
  const millCount = loc.blocks.reduce((n, b) => n + b.layout.windmills.length, 0);
  const millParts = (millCount && isEnhanced())
    ? await getWindmillMeshes(climateBase, season === SEASON.Winter) : null;
  console.log(`[windmills] ${millCount} placed in ${locationName}`
    + (millCount && !isEnhanced() ? ' - classic skin, not drawn' : '')
    + (millCount ? '' : ' - no block here stands one'));
  // Player collision (P1): every placed model's triangles, world-space,
  // over the flat ground floor.
  const collider = new Collider(() => GROUND_OFFSET * 0.025);
  let colliderTris = 0;
  const buildingDoors = []; // {door, dfBlock, recordIndex, climateBase, season, dfLocation, group}
  const flatGroups = new Map(); // "archive_record" -> [centers]
  const ambientAnimals = [];    // A4: archive-201 town animals as audio sources
  const exteriorNpcFlats = [];  // AUDIT 26 (F019): the flats RMBLayout stands as StaticNPCs
  const animalAmbience = createAnimalAmbience(audio, () => ambientAnimals);
  const cityNav = new CityNavigation(loc.width, loc.height);   // T1 towns
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      // WM2f: the mill's companion building is part of an enhanced-skin
      // departure; the 1:1 lane must not see it.
      if (placed.enhancedOnly && !isEnhanced()) continue;
      const mesh = gpuMeshes.get(placed.modelIdNum);
      if (!mesh) continue;
      const matrix = multiply(originMatrix, placed.matrix);
      const cpu = cpuModels.get(placed.modelIdNum);
      drawList.push({ mesh, matrix, order: placed.modelIdNum, box: transformedAabb(archAabb(placed.modelIdNum, cpu.positions), matrix) });   // EV3; EV6: sort key
      collider.addMesh('world', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
      // Building models expose their static doors for E-transitions
      // (P7: the world's registry shape; matrices are already
      // world-space, so entries feed the machine unshifted).
      if (cpu.doors && cpu.doors.length) {
        // StaticDoor.blockIndex must be TRUTHFUL (RMBLayout.cs:848
        // passes blockData.Index): DaggerfallInterior.IsBadInteriorModel
        // keys the 31000-overlap repair on EntryDoor.blockIndex, and a
        // hardcoded 0 made it unreachable from this host.
        for (const door of getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, matrix)) {
          buildingDoors.push({
            door, dfBlock: b.dfBlock, recordIndex: placed.recordIndex,
            climateBase, season, dfLocation, group: 'loc',
          });
        }
      }
    }
    // WM2d: THE MILLS THIS BLOCK STANDS. Classic Daggerfall places none,
    // so rmbLayout adds them - the tower is a placement like any other
    // and joins the static list, and only the SAIL needs a matrix per
    // frame. Enhanced-skin only - the door the roads used to share,
    // and since RX removed them whole, the only departure standing here.
    if (millParts) {
      for (const w of b.layout.windmills) {
        const matrix = multiply(originMatrix, w.matrix);
        // EV3: tower box padded for the sails' sweep - the same box
        // gates the tower row and the rotor draw below.
        const box = transformedAabb(archAabb('millBody', BODY.positions), matrix);
        for (let i = 0; i < 3; i++) { box[i] -= MILL_SAIL_PAD; box[3 + i] += MILL_SAIL_PAD; }
        drawList.push({ mesh: millParts.body, matrix, order: -1, box });   // EV6: the mills group together
        collider.addMesh('world', BODY.positions, BODY.indices, matrix);
        windmills.push({
          matrix, box,
          // Deterministic in the mill's own world position, so a farm's
          // mills are not a chorus line and the same mill is at the same
          // phase every time the player walks up to it.
          state: { angle: rotorPhase(matrix[12], matrix[14]) },
        });
      }
    }

    // Ground tiles gather into one location-wide tilemap for the R9
    // tilemap-shader pass. These bytes are PRE-conversion (tileBitfield
    // space); convertTilemap turns a byte b into texture record
    // (b * 4) + rotate + flip. MeshReader.cs:487 resets a random marker
    // (TextureRecord >= 56) to RECORD 8, "Index 8 is grass" - so the
    // byte written here must be 2, not 8. Writing 8 made convertTilemap
    // decode record 32 and the shader drew a different ground texture.
    // Zeros ride the 0xFF sentinel.
    const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    for (let ty = 0; ty < GROUND_TILE_DIM; ty++) {
      for (let tx = 0; tx < GROUND_TILE_DIM; tx++) {
        const tile = srcTiles[tx][GROUND_TILE_DIM - 1 - ty];
        const raw = tile.textureRecord >= 56
          ? 2   // record 2 * 4 = 8, grass (MeshReader.cs:487)
          : (tile.tileBitfield === 0 ? 0xff : tile.tileBitfield);
        locationTilemap[(b.x * GROUND_TILE_DIM + tx) +
          (b.y * GROUND_TILE_DIM + ty) * tilemapDim] = raw;
      }
    }

    const blockFlats = collectBlockFlats(b.dfBlock, natureArchive);
    for (const flat of blockFlats) {
      const key = `${flat.archive}_${flat.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([flat.x + b.originX, flat.y, flat.z + b.originZ]);
      // A4: every archive-201 town animal is an audio source
      // (AddAnimalAudioSource on RMB flats, verbatim).
      if (flat.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[flat.record] != null) {
        ambientAnimals.push({ pos: [flat.x + b.originX, flat.y, flat.z + b.originZ], sound: ANIMAL_SOUND_BY_RECORD[flat.record] });
      }
    }
    // AUDIT 26 (F019): ...and the same flats' STATIC NPCs. RMBLayout
    // adds the StaticNPC behaviour to a billboard it has just stood
    // (RMBLayout.cs:366-378 / :442-454), so the collection runs off the
    // very list the batches above were built from. Location frame, like
    // every flat here; the identity and the billboard extent are
    // resolved once the archives are loaded, below.
    for (const npc of collectExteriorNpcs(blockFlats)) {
      exteriorNpcFlats.push({ ...npc, x: npc.x + b.originX, z: npc.z + b.originZ });
    }
    // T1: the navgrid - the automap carves (raw bytes, verbatim: a
    // tree flat BLOCKS its cell), tile weights from the same ground
    // grid the renderer reads.
    cityNav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData,
      (tx, ty) => srcTiles[tx][ty].textureRecord);
    for (const light of collectCityLights(b.dfBlock, lightSize)) {
      cityLights.push({ x: light.x + b.originX, y: light.y, z: light.z + b.originZ });
    }
  }
  // EV6: the draw list sorts by MESH at build, so the frame's draws of
  // one archetype run back to back and the renderer's VAO shadow skips
  // the rebind. Opaque geometry under a depth test - order costs
  // nothing visually.
  drawList.sort((a, b) => a.order - b.order);

  // R9 ground GL: cached tile array per archive, the location tilemap,
  // and a flat 2x2 surface at GroundOffset spanning the exact extent
  // (winding matches buildTerrainIndices' quad diagonal).
  if (!renderer.tileArrays.has(groundArchive)) {
    const groundTex = textureFiles.get(groundArchive);
    const layers = [];
    for (let r = 0; r < groundTex.recordCount; r++) {
      layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
    }
    renderer.uploadTileArray(groundArchive, layers);
  }
  const tilemapTex = renderer.uploadTilemapTexture(convertTilemap(locationTilemap), tilemapDim);
  const groundSurface = (() => {
    const gy = GROUND_OFFSET * 0.025;
    const gw = loc.width * RMB_SIDE;
    const gh = loc.height * RMB_SIDE;
    const positions = new Float32Array([0, gy, 0, gw, gy, 0, 0, gy, gh, gw, gy, gh]);
    const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 2, 3, 0, 3, 1]);
    return renderer.createTerrainSurface(positions, normals, indices);
  })();
  const identityMatrix = trs(0, 0, 0, 0, 0, 0);

  /** FD1 - the RAW (pre-conversion) tilemap byte under the player,
   *  this host's twin of world.js's FS1 `playerGroundTile`.
   *
   *  The ground quad above spans [0, loc.width * RMB_SIDE] x [0,
   *  loc.height * RMB_SIDE] at the IDENTITY transform, and its
   *  tilemap is `tilemapDim` tiles across, so one tile is
   *  RMB_SIDE / GROUND_TILE_DIM world units. That stride is DERIVED
   *  from the same two constants the layout uses rather than repeating
   *  the 6.4 the draw call passes as a literal - a probe that agrees
   *  with the picture only by coincidence is a probe that will stop
   *  agreeing.
   *
   *  Answers null off the tilemap (the padding beyond the real extent,
   *  and anywhere outside the location), which isOutdoorWaterTile
   *  reads as DFU's -1: not water, so the fall bills normally. */
  const TILE_WORLD = RMB_SIDE / GROUND_TILE_DIM;
  const playerGroundTileRaw = () => {
    const tx = Math.floor(player.pos[0] / TILE_WORLD);
    const ty = Math.floor(player.pos[2] / TILE_WORLD);
    if (tx < 0 || ty < 0 || tx >= tilemapDim || ty >= tilemapDim) return null;
    return locationTilemap[tx + ty * tilemapDim];
  };


  // Load any flat archives not already fetched, then build one batch per
  // (archive, record) with its scaled billboard size.
  status('loading flat archives');
  const flatArchives = new Set(
    [...flatGroups.keys()].map((k) => Number(k.split('_')[0]))
  );
  await Promise.all([...flatArchives].map((a) => getTexture(a)));
  const flatAnims = new FlatAnimator();   // FA1
  const billboardBatches = [];
  let flatCount = 0;
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    const batch = renderer.createBillboardBatch(archive, record, size, centers);
    batch._box = flatBatchAabb(centers, size);   // EV3: world-space here - this host has no floating origin
    armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
    billboardBatches.push(batch);
    flatCount += centers.length;
  }

  // AUDIT 26 (F019): the street StaticNPCs' identity + extent, once
  // their archives are loaded (they are flats, so the batch pass above
  // already fetched every one).
  //   - FLATS.CFG is awaited because SetLayoutData's exterior overload
  //     reads it for the gender (StaticNPC.cs:185-194); loadFlats never
  //     throws (dataPipeline catches) and is warmed with the scene, so
  //     this is a coalesced wait, not a second load.
  //   - the AABB is the swept billboard box, exactly as the interior
  //     host's static NPCs take it (interiorContext.js:298-316).
  await pipeline.loadFlats();
  const exteriorNpcs = [];
  for (const flat of exteriorNpcFlats) {
    const t = textureFiles.get(flat.archive) ?? await getTexture(flat.archive);
    if (!t || flat.record >= t.recordCount) continue;
    const size = scaledBillboardSize(t.getSize(flat.record), t.getScale(flat.record));
    const pn = exteriorNpcRecord(flat, pipeline.flatsFile()?.getFlatData(flat.archive, flat.record) ?? null);
    exteriorNpcs.push({ ...pn, width: size.w, height: size.h });
  }

  // Camera.
  const shotMode = params.has('shot');
  // P1: grounded first-person is the default; ?fly restores the fly cam.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(collider, motorStats(playerEntity), { jumpBoost: () => jumpSpeedMultiplier(playerEntity), carriedWeight: () => totalWeight(playerEntity.items ?? []), climbing: climbingDeps(playerEntity, (l) => townTalk?.say(l)) });   // AcrobatMotor skill jump (P14) + M3 climbing; motorStats = the LIVE entity (PlayerSpeedChanger reads LiveSpeed/Running/Swimming every step)
  // AUDIT 21 (hosts lane, F3): onLevelUp. Without it advancement.js takes its
  // HEADLESS arm - `spendPoolLowest`, which dumps every point into your LOWEST
  // stats with no message and no choice. Cross a level threshold walking a
  // town and you got a different character than crossing it in a dungeon, off
  // the same XP. The dungeon host has passed one since U3; the three carriers
  // above ground passed only `say`.
  //
  // `townTalk` is declared further down this function and the closure only
  // runs once time has passed, so it is initialised by then.
  // AUDIT 23 (C5: hosts-5 = entity-3): the exhaustion collapse above
  // ground - the same exhaustionOutcome law the dungeon runs, with
  // this host's context (guards as the nearby enemies, the one clock's
  // day, outside). Function-hoisted: cityGuards/townTalk close later.
  let _inExhaustion = false;
  function onExhaustedExterior() {
    if (_inExhaustion) return;
    _inExhaustion = true;
    try {
      const out = exhaustionOutcome({
        // CollapseFromExhaustion (PlayerEntity.cs:2397) asks
        // GameManager.AreEnemiesNearby() - the STRICT variant (no
        // resting narrowing), over EVERY active enemy behaviour: one
        // that can see the player or would have spawned in classic.
        // `activeCount() > 0` was a different question - one unaware
        // guard alive anywhere in town killed the collapse.
        enemiesNearby: areEnemiesNearby(cityGuards?.guards ?? []),
        swimming: !!player.swimming, entity: playerEntity,
        day: !isNight(minuteNow()), inside: false,
      });
      // RSC 1071/1072 pend the reader in this host; classic strings fall back.
      const lines = out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.'];
      if (!townTalk.overlay) townTalk.showOverlay(new ActionTextBox(lines));
      if (out.kind === 'rest') {
        playerTicker.advance(60);   // RaiseTime(1 hour); the latch holds re-entry
        playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
        playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
        playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
        tallySkill(playerEntity, SKILLS.Medical);
        surfacePlayer();
      } else {
        hurtPlayer(playerEntity, playerEntity.health, { bypassShield: true });   // SetHealth(0) through the one damage door
      }
    } finally { _inExhaustion = false; }
  }
  // C14: the swing's own fatigue drain rides the same collapse law.
  const drainExteriorFatigue = (n) => {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    surfacePlayer();
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0) onExhaustedExterior();
  };
  const playerTicker = createPlayerTicker(playerEntity, {
    // CG2: this host has no interior mode at all - the player is always
    // outdoors here, so the crime-guild letter may always land.
    isInside: () => false,
    say: (msg) => console.log('[player]', msg),
    onExhausted: onExhaustedExterior,
    onLevelUp: () => {
      console.log('[player] You have gained a level!');
      townTalk.showOverlay(new LevelUpScreen(playerEntity));
    },
  });   // AUDIT 18: the per-minute tick every host owes
  // AUDIT 21 (hosts lane, F6): this host's death presenter. Guard damage,
  // fall damage and the ticker's disease/poison sink all reach the one damage
  // door in playerEntity.js; the door calls this. Registered here rather than
  // passed down four call chains, because there is one player and one death.
  setDeathPresenter(() => {
    // DC1: the LIVE eye and capsule, as PlayerEntity_OnDeath reads them.
    if (!(townTalk.overlay instanceof DeathScreen)) townTalk.showOverlay(new DeathScreen({ eyeHeight: player.eye[1] - player.pos[1], capsuleHeight: player.height, onReset: () => endRunToTitleMenu(renderer) }));   // D1
  });
  // F117: Stendarr's rank-in-fifty, consulted by the door before the
  // presenter. No submersion model above ground; townTalk closes later
  // in this function, initialised by the first time damage can land.
  setAvoidDeathHook(() => {
    if (!avoidDeath(activeMemberships(playerEntity))) return false;
    townTalk.say(AVOID_DEATH_TEXT);
    return true;
  });

  // AUDIT 19 F4: the CUMULATIVE game-day count, for the music seed. The
  // ticker's classicMinutes is the only clock in this host that keeps
  // counting past midnight - minuteNow() wraps at 1440 by design (it
  // drives the sun and the window styles, which want a time of day).
  const gameDaysNow = () => Math.floor(playerTicker.classicMinutes / 1440);

  // AUDIT 19 / 1:1: the MUSIC DIRECTOR replaces this host's three ad-hoc
  // music entry points (boot, nightfall, returning from an interior). DFU
  // has one Update() that rebuilds a context every frame and reacts to the
  // difference; feeding that is the only way to get its law that a new day
  // or a new LOCATION re-picks even when the playlist is unchanged.
  // This host loads ONE location and the player stands in it, so the rect
  // test is constant. locationType/locationIndex come off the map table -
  // the same fields DFU's PlayerGPS reports.
  const _musicInLocationRect = () => true;
  const _musicLocationType = () => dfLocation?.mapTableData?.locationType ?? 0xffff;
  const _musicLocationIndex = () => dfLocation?.locationIndex ?? -1;
  const musicDirector = createMusicDirector();
  ensureAudio(fetchBytes);
  // C9: the exterior FP weapon (host rule - every motor host carries
  // it). AUDIT 17e F38 / RETIRING A FLAG DELETES THE SENTENCE: the
  // 'no HUD-text layer yet' flag that stood here was retired by T3b
  // three lines below, but survived to be re-published as live work
  // by the grep-regenerated open-flags list.
  // T3b: the town interaction seam (modes/talk/pickpocket) - shared
  // with the streaming host via townTalk.js. It also gives this host
  // its first HUD-text layer; the weapon rig's say routes there now.
  const townTalk = createTownTalk({
    renderer, canvas, fetchBytes, playerEntity, palette,
    regionIndex: dfLocation.regionIndex,
    onCrime: () => _crimeResponse(),   // G1: late-bound - the guards mount below
    // T3c: the Where-is topics - the named-building pool merges at
    // talk-load; building positions ride their exterior doors.
    topics: {
      exteriorBuildings: dfLocation.exterior.buildings,
      blocks: loc.blocks,
      doors: buildingDoors.map((e) => ({
        dfBlock: e.dfBlock, recordIndex: e.recordIndex,
        position: [e.door.matrix[12], e.door.matrix[13], e.door.matrix[14]],
      })),
      locationName, regionName,
      playerPos: () => (walkMode ? [...player.pos] : [...cam.pos]),
    },
  });
  townTalk.ensureLoaded();
  preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: INFO00I0 warms at boot
  preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));   // I3/I4
  preloadBookArt({ renderer, fetchBytes, palette });   // B1: BOOK00I0 warms at boot
  // B1 + AUDIT B-C2: an async open must not clobber a window the
  // player opened while the book was loading.
  const openBookHook = makeOpenBookHook({ fetchBytes, showReader: (w) => { if (!townTalk.overlayActive) townTalk.showOverlay(w); } });
  // AUDIT 21 (hosts lane, F7): the classic HUD art. loadHud swallows a missing
  // file and answers null, and drawHud no-ops on null, so a host without the
  // art draws no HUD rather than failing to boot - the same law the title
  // screen and the char sheet follow.
  let hudArt = null;
  loadHud({ fetchBytes, ImgFile, palette, renderer }).then((a) => { hudArt = a; })
    .catch((e) => console.error('[hud]', e));
  preloadInventoryArt({ renderer, fetchBytes, palette });   // U8d: INVE00I0/01I0 warm at boot
  preloadSpellbookArt({ renderer, fetchBytes, palette })   // U42: SPBK00I0/01I0 + the ICON/MASK sheets warm at boot
    .catch((e) => console.warn('[spellbook] classic spellbook art unavailable:', e?.message ?? e));
  preloadChargenArt({ renderer, fetchBytes, palette });   // U10: CHAR0*/PICK00/TMAP00 warm at boot
  preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11: SPOP/BUTTONS warm at boot
  preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture });   // U8f/U8g: SCBG/BODY/FACE + the item-record pipeline (town context; Breton male 0 is the PRE-chargen default, reloaded on the chosen identity)
  // S3d: the INTERIM dagger seed is the FALLBACK only - a character
  // who runs chargen gets AssignStartingGear's real kit instead, so
  // seeding here would leave a stray dagger in the bag.
  if (playerEntity.chargenDone) seedStartingEquipment(playerEntity);
  // S3c/U9 / THE FOUR HOSTS RULE: chargen lived only in the dungeon
  // host, so booting straight into a town left the player on the
  // pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
  // whole session. Both exterior hosts now run it through the shared
  // session, and the paperdoll reloads on the chosen identity.
  let spellsByIndex = null;   // M2: the host-level SPELLS.STD map (the spellbook + the cast engine read it)
  // G4: THE FOUR HOSTS RULE. The magic registries were set only
  // in the dungeon host's boot, so a magic item minted out here -
  // shop loot, a city corpse, the guild's Buy Magic Items shelf -
  // found no templates at all. Fired and not awaited: the boot
  // does not block on it and every consumer is a later frame.
  loadMagicRegistries(fetchBytes).then((r) => { spellsByIndex = spellsByIndex ?? r.spellsByIndex; });
  // V1: the infection's host seam - the dream/death videos, the
  // fortnight clock raise, the clan's region read and the popup.
  // One call per host (THE FOUR HOSTS RULE); without it the
  // lifecycle still runs and the player just never sees the dream.
  wireInfectionVideos(renderer, {
    textAt: (id) => townTalk.lines(id),
    showText: (lines) => townTalk.showOverlay(new ChoiceWindow({ lines })),
    factionDict: () => townTalk.factionDict ?? null,
  });
  if (!playerEntity.chargenDone && params.has('class')) {
    // AUDIT 17f: ?class=N is the headless skip - parsed here for the
    // DUNGEON the host might build, but never honoured for the host's
    // own chargen, so a town boot had no way past the overlay.
    loadSpellIndex(fetchBytes).then((sbi) => { spellsByIndex = sbi; return applyHeadlessChargen(playerEntity, Number(params.get('class')), { fetchBytes, spellsByIndex: sbi }); })
      .then(() => {
        preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
          { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
        surfacePlayer();
      })
      .catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  } else if (!playerEntity.chargenDone) {
    // AUDIT 17i: ONE construction seam - the flow arrives with every
    // dependency already attached (careers, SPELLS.STD, the biography
    // question sets), so a host cannot forget one. Three separate bugs
    // came from hosts wiring these by hand.
    createChargenFlow(fetchBytes).then(({ flow, spellsByIndex: sbi }) => {
      spellsByIndex = sbi;   // M2
      townTalk.showOverlay(createChargenWindow(flow, {
        // ui-chargen-4: the race screen's back cancels the wizard to
        // the front door (DFU unwinds to the start screen); the
        // reload re-runs the boot flow.
        onCancel: () => location.reload(),
        onDone: (r) => {
          finishChargen(playerEntity, r, sbi);
          preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
            { race: r.race, gender: r.gender, faceIndex: r.faceIndex });
          surfacePlayer();
        },
      }));
    }).catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  }
  const droppedLoot = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });   // U8e
  // FindGroundPosition (CreateDroppedLootContainer): the pile lands
  // on the ground BELOW the player, not at the motor's height
  const dropFeet = () => {
    const p0 = walkMode ? [...player.pos] : [...cam.pos];
    const d = collider.raycast(p0, [0, -1, 0], 10);
    if (Number.isFinite(d)) p0[1] -= d;
    return p0;
  };
  surfacePlayer();   // the probe surface exists from boot (T3b: pickpocket gold reads)
  let _livePersons = [];
  // G1: the city watch (SpawnCityGuards verbatim; Knight_CityWatch
  // class foes on the C11 stack). A guard's hit hurts the PLAYER
  // through the same entity the fall-damage path bills.
  // AUDIT 24 (wave 39): ONE blood pool for the host, shared by both
  // enemy pools - a splash is a world billboard and the host owns the
  // draw. EnemyBlood is per-entity in DFU only because Unity hangs a
  // component off each enemy; there is one archive and one clock.
  const hitEffects = createHitEffects({ renderer, getTexture, uploadRecordFrame });
  // X4: the Detect scan - declared before cityGuards so the frame body
  // and the feed share one definition; the thunks are lazy.
  const detectFeet = () => (walkMode ? player.pos : cam.pos);
  const detectFeed = createDetectFeed(playerEntity, {
    entities: () => ((modes?.mode ?? 'exterior') === 'exterior' ? cityGuards.guards : [])
      .filter((f) => !f.dead && f.ai).map(foeNearbyRecord),
    // FX1 (F207): the world piles + guard corpses mark outdoors -
    // UpdateNearbyObjects walks every active loot container with no
    // scene gate (PlayerGPS.cs:747, :766-776).
    // DT1: this host names its loot KINDS and shared.js's
    // nearbyLootRecords does the walk (see world.js's twin).
    loot: () => nearbyLootRecords({ piles: droppedLoot._piles, foes: cityGuards.guards }),
    feet: detectFeet,
  });
  const cityGuards = createCityGuards({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, hitEffects,
    playerWeaponSheathed: () => !!weaponRig.playerWeapon.sheathed,   // AUDIT 24 (wave 42): pacification's drawn-weapon penalty
    say: (l) => townTalk.say(l),   // C-slice: equipment breaks speak
    currentMinute: () => Math.floor(playerTicker.classicMinutes),   // AUDIT 23 (hosts-3): a guard's poison anchors at NOW, not 0
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      const apply = () => {
        hurtPlayer(playerEntity, dmg);   // AUDIT 21 hosts F6: the one damage door - this used to write health raw and never check for death
        audio.playOneShot(hitSoundFor(wpn), 1.1);
        // AUDIT 24 (wave 46): PlayerFootsteps hears the same
        // RemoveHealth the flash does - a 40% cry in the player's own
        // race and gender.
        playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
        surfacePlayer();
      };
      // G2: the verbatim arrest interception - a guard hit on an
      // active crime opens the surrender box instead of the damage
      if (!arrestFlow.onGuardHit(dmg, apply)) apply();
    },
  });
  const _guardPool = () => _livePersons.map(({ person, pos }) => ({
    pos, fwdYaw: person.facingYaw, guard: person.guard,
    disable: () => {
      const it = population?.pool.find((i) => i.person === person);
      if (it) { it.person.release(); it.active = false; it.scheduleEnable = false; it.scheduleRecycle = false; it.visible = false; }
    },
  }));
  // AUDIT 17e F6: DFU clears the active crime on OnExitLocationRect.
  // This host IS one fixed location with no rect to leave - the
  // streaming host (world.js) owns that edge. Nothing to clear here.
  function _crimeResponse() {
    const feet = walkMode ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(true, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  /** AUDIT 39 (#22): SpawnCityGuards(FALSE) - the WITNESS arm, the
   *  world host's twin (THE FOUR HOSTS RULE). The mode machine's
   *  private-property theft calls the member through the bag below
   *  and the bool picks the arm; this host had only the crime half. */
  function _witnessResponse() {
    const feet = walkMode ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(false, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  /** S40: THE REST KEY, OUTDOORS - world.js's twin (THE FOUR HOSTS
   *  RULE). This host stands in ONE location and never leaves its
   *  rect, so IsPlayerInTown(true, true) is the type test plus "not
   *  inside". No foe pool here but the city watch, which counts. */
  const _isPlayerInTownStrict = () => _musicInLocationRect()
    && isPlayerInTown(_musicLocationType(), {
      mustBeInLocationRect: true, mustBeOutside: true,
      inLocationRect: true, inside: (modes?.mode ?? 'exterior') !== 'exterior',
    });
  const outdoorRestDeps = createRestDeps(playerEntity, {
    advanceMinutes: (n) => playerTicker.advance(n),
    // No tickQuests: this dev host mounts no quest bridge at all
    // (grep questBridge in this file returns nothing), so TickRest
    // :379 has nothing to call. Named rather than omitted, because
    // the construction sweep should see a decision.
    tickQuests: null,
    // AreEnemiesNearby's RESTING variant. This host mounts no foe pool
    // but the city watch, and `activeCount() > 0` - which the first
    // draft borrowed from the exhaustion arm - would block sleep for
    // good the moment one guard spawned anywhere in town.
    enemiesNearby: () => areEnemiesNearby(cityGuards.guards, { resting: true }),
    place: () => ({
      inTownOutside: _isPlayerInTownStrict(),
      inTownLocation: isPlayerInTown(_musicLocationType()),
      insideBuilding: false,
    }),
    commitCrime: (crime, spawnGuards) => {
      setCrimeCommitted(playerEntity, crime);   // V4: through the one setter (SuppressCrime)
      if (spawnGuards) _crimeResponse();
    },
    endLines: (id) => townTalk.lines(id),
    // PopToHUD (:730) runs BEFORE RaiseSkills (:731), and onLevelUp
    // below only mounts when the slot is free - so the window has to
    // vacate it first or a rest-end level-up is silently swallowed.
    onClose: () => { if (townTalk.overlay?.isRestWindow) townTalk.closeOverlay?.(); },
    say: (msg) => townTalk.say(msg),
    onLevelUp: () => {
      townTalk.say('You have gained a level!');
      townTalk.showOverlay(new LevelUpScreen(playerEntity));
    },
    day: () => !isNight(minuteNow()), inside: () => false,
  });
  const toggleRest = () => {
    if (townTalk.overlayActive) return;
    // THE OPEN GATE (DaggerfallUI.cs:651-687), which is scene-free -
    // this host had none of it, because rest was a dungeon feature.
    // Outdoors all three inputs are live: real foes, real water, and a
    // levitating or falling player who cannot lie down.
    const rb = racialRestBlock(playerEntity, Math.floor(worldMinutes()));   // V2b: the vampire's rest gate
    const d = restDecision({
      enemiesNearby: outdoorRestDeps.enemiesNearby(),
      swimming: !!player.swimming,
      // StartRestGroundedCheck, not the raw flag: a levitating player
      // an inch off the floor reads grounded === false and DFU lets
      // them sleep anyway (PlayerMotor.cs:190-193's own comment) - and
      // up here it is also what lets a page whose motor is never
      // stepped rest at all, since `grounded` sits at its initialiser.
      grounded: startRestGroundedCheck(!!player.grounded, player.pos, collider),
      racialOverrideBlocks: !!rb,
    });
    if (d.kind !== 'rest') {
      // DFU raises the enemy alert on the enemies arm
      // (DaggerfallUI.cs:655 - NOT the rest window's :655, which is
      // DoRestForAWhile; a bare citation here resolves to the wrong
      // file, since every other number in this block is the window's).
      if (d.kind === 'enemies') setEnemyAlert(playerEntity, true, Math.floor(worldMinutes()));
      if (d.kind === 'blocked') {
        const lines = plainLines(townTalk.lines(rb.textId));   // V2b: the unfed vampire's own box
        if (lines) townTalk.showOverlay(new ActionTextBox(lines));
        return;
      }
      // plainLines: TEXT.RSC answers { text, center } ROWS and
      // ActionTextBox iterates STRINGS (V5b's finding).
      const lines = d.message ? [d.message] : plainLines(townTalk.lines(d.textId));
      if (lines) townTalk.showOverlay(new ActionTextBox(lines));
      return;
    }
    townTalk.showOverlay(new RestWindow(outdoorRestDeps));
  };
  // G2: arrest + court through the townTalk overlay seam.
  //
  // AUDIT 21 F8 RETIRED THE OPEN FLAG THAT STOOD HERE. It said the prison
  // day-skip was a no-op until the shared calendar lands, and it was false
  // twice over: the clock landed in AUDIT 21 F2 (worldTick owns one now), and
  // the no-op was no longer inert once DAYS drive diseases - a thirty-day
  // sentence cost the player and the world nothing. createArrestFlow now
  // defaults advanceDays to the real clock, so there is no argument left for a
  // host to forget. What still pends is the prison SCREEN and FillVitalSigns'
  // full refill, neither of which is a calendar.
  const arrestFlow = createArrestFlow({ townTalk, playerEntity, regionIndex: dfLocation.regionIndex });
  const weaponRig = createWeaponRig({
    activateHeld: () => held(keys, 'ActivateCenterObject'),   // AUDIT 28 W12: the drawn bow's un-draw key
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say: (l) => townTalk.say(l),
    // MW-D8: the Morrowind arm rides the player's eye. Required, not
    // optional - a host that forgets it gets the classic sprite and a
    // named reason rather than an arm at the world origin.
    // MW-D10: rule 54's neck pitch; MW-D15: rule 32(a)'s sneak sink.
    camera: () => ({ pos: player.eyeAt(), yaw: cam.yaw, pitch: cam.pitch, sneaking: !!player.isSneaking,
      bob: [0, player.bobOffset ? player.bobOffset[1] : 0],   // IG1: the bob's vertical feeds the first-person offset
      move: { forward: player.moveForward || 0, strafe: player.moveStrafe || 0, running: !!player.isRunning, speed: player.moveSpeed || 0,
        grounded: player.grounded !== false, jumping: !!player.jumping, swimming: !!player.swimming, levitating: !!player.levitating } }),   // MW-D26: the movement-settings vector, the reference's own selection source; MW-D39 added the jump-state inputs (grounded/jumping/swimming/levitating)
    spellArmed: () => magic.spellArmed(),   // M2: HasReadySpell hides the weapon
  });
  // M2 (the AUDIT 23 hosts-2 priority row): SPELLCASTING ABOVE GROUND.
  // One engine per page, mode-aware deps - exterior mode targets the
  // live guards through the SAME damage door as melee; interior mode
  // (worldModes' arm) has no foes and its own collider; the dungeon
  // keeps its integrated stack until M3. The absorb context finally
  // answers the exterior truth (inside false, day from the one clock) -
  // the S24 InLight/InDarkness arms go live here.
  /** The per-foe doors, hoisted (AUDIT 24 wave 32): the cast engine takes
   *  them, and so does the broker fan-out below - one set of doors per
   *  entity, exactly as one EntityEffectManager per entity. */
  const foeSinks = (g) => ({
    hurt: (n) => { if (n > 0) cityGuards.hurtGuard(g, n, player.pos); },
    heal: (n) => { if (n > 0) g.entity.health = Math.min(g.entity.maxHealth ?? Infinity, g.entity.health + n); },
    drainMagicka: (n) => { if (n > 0) g.entity.magicka = Math.max(0, (g.entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) g.entity.magicka = Math.min(g.entity.maxMagicka ?? Infinity, (g.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.max(0, (g.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.min(maxFatigue(g.entity), (g.entity.fatigue ?? 0) + n); },
  });
  const magic = createPlayerMagic({
    onTeleport: () => townTalk.say('(Recall pends here - the anchor machinery lives in the streaming ?world host)'),   // TP-slice INTERIM
    // X11b: the Create Item picker, through the same worldModes opener
    // the streaming host uses - which mounts into whichever slot the
    // current mode actually draws.
    onCreateItem: (d) => {
      if (!modes?.openCreateItemPicker?.({ rounds: d.rounds })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    // X11c: ...and the other two spell windows, which this host had
    // never routed at all. Both can be cast anywhere; until the slot
    // picker existed there was nowhere outdoors to put them, so the
    // seams were simply absent here and the cast went nowhere without
    // even a line. The streaming host routes all three the same way.
    onIdentify: (d) => {
      if (!modes?.openIdentifyWindow?.({ chance: d.chance, refund: d.refund })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    onDispelMagic: (d) => {
      if (!modes?.openDispelPicker?.({ chance: d.chance })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    renderer, audio, getTexture, uploadRecord, uploadRecordFrame,
    collider: { raycast: (o, d, m) => ((modes?.mode === 'interior' && modes?.interiorCollider) ? modes?.interiorCollider : collider).raycast(o, d, m) },
    playerEntity,
    now: () => playerTicker.classicMinutes,   // V2a: MorphSelf's once-a-day clock
    playerSinks: {
      hurt: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
      heal: (n) => { if (n > 0) { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); surfacePlayer(); } },
      drainMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n); surfacePlayer(); } },
      restoreMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + n); surfacePlayer(); } },
      drainFatigue: (n) => drainExteriorFatigue(n),
      restoreFatigue: (n) => { if (n > 0) { playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + n); surfacePlayer(); } },
      say: (l) => townTalk.say(l),
    },
    say: (l) => townTalk.say(l),
    surfacePlayer,
    foes: () => (modes?.mode ?? 'exterior') === 'exterior' ? cityGuards.guards : [],
    foeSinks,
    absorbCtx: () => ((modes?.mode ?? 'exterior') === 'exterior'
      ? { inside: false, day: !isNight(minuteNow()) }
      : { inside: true, day: false }),
    // AUDIT 36 F1: THE THIRD HOST CASTS TOO. MW-D39 wired the arm's
    // spellcast release into the dungeon and world hosts and MISSED
    // this one - the standalone exterior page, which has its own magic
    // engine and its own rig - so a spell cast above ground played the
    // stance and never the cast. The same moment, the same one door.
    onCastReadySpell: (sp) => { weaponRig?.castSpellAnim?.(sp?.rangeType); },
  });
  // AUDIT 24 (wave 32): the broker's foe subscribers - the watch (this host mints no encounter foes).
  // OnNewMagicRound is global and every EntityEffectManager handles it, so
  // these entities owe the same per-minute laws the player does. They got
  // none of them: above ground a foe's Continuous Damage never took a
  // round, its poison never fired, and a paralysed foe stayed paralysed.
  subscribeFoePools(playerTicker, [() => cityGuards.guards], foeSinks);
  /** AUDIT 24 (wave 36): the senses context every foe pool owes its
   *  foes, built ONCE per frame for all of them. This host used to pass
   *  `{ playerInvisible }` alone, which left Chameleon and Shade inert,
   *  read the player's Stealth as 0, tallied it never, and - because
   *  gameMinutes defaulted to 0 - froze each foe's detection on its
   *  first roll for the rest of its life. */
  const _foeSenses = () => sensesContext(playerEntity, playerTicker.classicMinutes, {
    movingLessThanHalfSpeed: player.movingLessThanHalfSpeed ?? true,
  });
  // U32: ONE construction for the town inventory - F6 opens it, and so
  // does the character sheet's INVENTORY button. Two `new` sites would
  // be two things to keep in step.
  // G6: the `extra` bag is the CHOOSE-ONE seam (and whatever a
  // later service needs). One builder per host, still - the
  // service asks the host for its own window rather than
  // assembling a second one from a different dependency list.
  const makeInventoryWindow = (extra = {}) => createInventoryWindow({
    openBook: openBookHook,   // B1: the use-mode book arm
    say: (l) => townTalk.say(l),   // FX1 (F128): the "Equipping %s" cue on close
    items: () => (playerEntity.items ??= []),
    wagonItems: () => (playerEntity.wagonItems ??= []),   // W-slice: the cart's collection
    entity: playerEntity,
    icons: { getTexture, uploadRecord, textures: renderer.textures },
    rows: (id) => townTalk.lines(id),   // U25: the real item info + use text (TEXT.RSC)
    // U42: USING the Spellbook item opens the book
    // (DaggerfallInventoryWindow.cs:1748-1764). showOverlay REPLACES
    // the slot, so this bypasses toggleSpellbook's already-open guard
    // - the inventory has just run its own close law.
    openSpellbook: () => { const b = makeSpellbookWindow(); if (b) townTalk.showOverlay(b); },
    // U44: NULL on purpose. RecordLocationFromMap reveals a random
    // undiscovered location in the CURRENT REGION, and this page has
    // no region index to walk - `?town` is one built location, not a
    // streamed world. The map arm reads the null and leaves the item
    // unread rather than eating it for nothing. Named rather than
    // omitted, so the construction sweep sees a DECISION.
    revealMap: null,
    drinkPotion: (key) => magic.drinkPotion(key),   // U44: DrinkPotion through the ONE cast engine
    // NULL on purpose, the same DECISION revealMap above is. This page
    // mounts no quest bridge at all, so there is no QuestMachine to
    // ask: the use-click block finds nothing watching and falls
    // through (DaggerfallInventoryWindow.cs:1681), and a quest
    // letter keeps its plain template name. Named, not omitted.
    getQuest: null,
    nowMinute: () => Math.floor(playerTicker.classicMinutes),
    onDrop: (items) => droppedLoot.dropPile(items, dropFeet()),   // U8e: OnPop mints the world pile
    ...extra,
  });
  // U42: the CLASSIC spellbook - the same ONE construction the world
  // host makes, handing the player's own array by reference so the
  // window's delete/swap/sort/rename land in the save envelope.
  let _spellbook = null;   // U42: the live window, for the probe surface
  // PX23: the book's ONE door (ui/spellbookDoor.js). This host hands it
  // only what this host knows - the entity, the engine, the cost and
  // the way it reaches TEXT.RSC.
  const makeSpellbookWindow = () => (_spellbook = createSpellbookWindow({
    entity: playerEntity,
    magic,
    castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
    rows: (id) => townTalk.lines(id),
  }));
  const toggleSpellbook = () => {
    if (townTalk.overlayActive) return;
    const w = makeSpellbookWindow();
    if (!w) { townTalk.say('(the spellbook art is unavailable)'); return; }
    townTalk.showOverlay(w);
  };
  // U43: ONE construction for the character sheet too. It was built
  // inline in this host's keydown, which meant the INTERIOR host -
  // which mounts this host's windows rather than building its own -
  // had no way to reach it, and F5 in a shop did nothing.
  const makeCharSheetWindow = () => createCharSheetWindow({
    entity: playerEntity,
    artDeps: { renderer, fetchBytes, palette },
    inventory: () => (inventoryDoorReady() ? makeInventoryWindow() : null),
    spellbook: makeSpellbookWindow,
    // U43: NO quest hooks here, on purpose. `?town` mounts no quest
    // bridge, so charSheetHooks withholds the LOGBOOK button and the
    // sheet gives its refusal - the same honest answer the standalone
    // `?dungeon` page gets. An empty journal would tell a player they
    // have no quests when the truth is this page cannot see them, and
    // for the same reason this host answers neither L nor N.
  });
  const arrows = new ArrowFlight({ getGpuMesh, collider: () => collider });   // C13
  let zPrevW = false;   // the ReadyWeapon (Z) edge
  const modeNow = () => modes?.mode ?? 'exterior';   // lazy - modes binds below (boot-time mouse events)
  // ENGINE RIG (slice 2, ?rig): the canonical animated character in
  // the world - same body, same animate.js runtime as the viewer.
  // Spawned near the player at terrain height (proper grounding =
  // slice 3); walks in place at the 9x character-pass standard once
  // the render split lands (slice 4).
  let rig = null, rigMat = null, rigPos = null;
  // WORLD CAMERA MODES (slice 6): first person (default) / third
  // person. In third person the rig RIDES the player - position from
  // the motor's feet, facing from cam.yaw, gait from live input - and
  // the camera pulls back along the view ray. ?tp is BOOT-ONLY: I2
  // retired the runtime V toggle (V is DFU's TravelMap default, see
  // the note at the keydown ladder), so tpMode is never reassigned and
  // the rig is built once, here. ?rig keeps its fixed-park probe
  // semantics when not riding.
  const tpMode = params.has('tp');
  const buildRig = async () => {
    const [{ createEngineRig, deriveClassicRamps }, { ImgFile }] = await Promise.all([
      import('../characters/engineRig.js'),
      import('../formats/imgFile.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    rig = createEngineRig(renderer, deriveClassicRamps(palette, bodyImg.getDFBitmap()));
    rig.setGait(1);
    window.__rig = rig;
  };
  if (params.has('rig') || tpMode) await buildRig();
  player.spawn(loc.width * RMB_SIDE * 0.46, GROUND_OFFSET * 0.025 + 2, loc.height * RMB_SIDE * 0.5);
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { use: false, crouch: false };   // audit 16f: jump is HELD since P14 - the latch slot was dead; I2 retired the view latch with the V toggle
  console.log(`player: collider ${colliderTris} tris, walk=${walkMode}`);
  if (shotMode) {
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => player.spawn(x, y, z),
    };
  }
  const extentX = loc.width * RMB_SIDE;
  const extentZ = loc.height * RMB_SIDE;
  const center = [extentX / 2, 4, extentZ / 2];
  const cam = {
    pos: [center[0], 14, extentZ + 40],
    yaw: Math.PI,
    pitch: -0.08,
  };
  const lookFilter = new LookFilter();   // AUDIT 28 W7: one filter per camera
  const moveAxes = new MoveAxes();   // AUDIT 28 W8: MovementAcceleration
  const cameraRecoiler = new CameraRecoiler();   // AUDIT 28 W9: CameraRecoilStrength
  const headBobber = new HeadBobber();   // AUDIT 28 W10: HeadBobbing
  let rightHeld = false;   // AUDIT 28 F-C2: HasAction(SwingWeapon) - the raw button, ungated
  const keys = new Set();
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  // T3b: the town seam eats its keys FIRST (F1-F4 modes; overlay
  // Esc/Enter) so a held overlay never leaks into the movement set.
  // U45 - THE ONE DOOR PER DESTINATION. The keydown ladder below and
  // the large HUD's eleven panels open the same windows, and DFU
  // reaches them the same way from both (PostMessage into the UI
  // manager). This object is that contract - ui/input.js's routeAction
  // reads it, the ladder below calls it, and routeLargeHudClick hands
  // it a click. Every member is an arrow, so nothing here is evaluated
  // before the helpers it names exist.
  const hudCtx = {
    // U52: THE HOST'S OWN FACTORY, not a second copy of it. This arm
    // hand-rolled the sheet while `makeCharSheetWindow` sat twenty
    // lines up being handed to the interior host - two builders for one
    // window in one file, and the inline one had already lost the
    // other's note about the deliberately withheld quest hooks. They
    // agreed. That is what drift looks like the day before it stops.
    toggleCharSheet: () => townTalk.showOverlay(makeCharSheetWindow()),
    // BS1/F198: the Status action's health box (the four-hosts seam).
    // ST1: the record-22 box leads here too; this dev scene has no
    // quest machine (see TickRest's note), so the null context leaves
    // each macro as its bracketed placeholder - the null-MCP posture.
    showStatus: () => {
      const rows = (id) => townTalk.lines(id);
      townTalk.showOverlay(new ActionTextBox(statusInfoRows(rows, null))
        .addNext(healthStatusRows(playerEntity, rows)));
    },
    toggleInventory: () => {
      // V4: GetSuppressInventory (LycanthropyEffect.cs:409-421)
      const sup = racialSuppressInventory(playerEntity);
      if (sup) { townTalk.say(sup.text); return; }
      if (inventoryDoorReady()) townTalk.showOverlay(makeInventoryWindow());
    },
    toggleSpellbook: () => toggleSpellbook(),
    // S40: the Rest door - world.js's twin (THE FOUR HOSTS RULE).
    toggleRest: () => toggleRest(),
    // PX26 (Mac: "the north option should be the new journal we
    // developed" / "the skill ui opens on the lefthand side when it
    // should be center"): ONE FIX FOR BOTH. The dial's north was the
    // F5 overlay - the last pre-PX surface, and the one that lays its
    // three columns against the left edge. The pause window's Stats
    // page IS that sheet, off the same sheetModel, and is centred by
    // construction. This host's own pause flow, landed on it.
    openSheetPage: () => hudCtx.togglePause({ at: 'stats' }),
    togglePause: (opts = {}) => {
      if (!pauseDoorReady()) return;
      openPauseFlow((w) => townTalk.showOverlay(w), {
        at: opts.at ?? null,   // PX26: the page the door was pressed for
        // PX25: the sheet's own doors. This host has no journal maker,
        // so it hands over two and the Chronicle button never draws -
        // which is the point of the filter, not a gap in it.
        openPack: () => townTalk.showOverlay(makeInventoryWindow()),
        openSpellbook: () => { const w = makeSpellbookWindow(); if (w) townTalk.showOverlay(w); },
        savingPrevented: () => true,
        exitToMenu: exitToTitleMenu,
        textLines: (id) => townTalk.lines(id),
        // PX3 FLAGGED: questMessages - this test host mounts no quest
        // bridge, so the pause window's Quests tab says so.
      });
    },
    // A2: the exterior automap (Actions.AutoMap outdoors,
    // DaggerfallUI.cs:633-650); this host always stands on a location.
    toggleAutomap: () => {
      const locId = `${dfLocation.regionIndex}:${dfLocation.name ?? locationName}`;
      townTalk.showOverlay(new ExteriorAutomapWindow({
        locationName: dfLocation.name ?? locationName,
        locationId: locId,
        gridW: loc.width, gridH: loc.height,
        blocks: loc.blocks.map((bl) => ({ x: bl.x, y: bl.y, autoMap: bl.dfBlock?.rmbBlock?.fldHeader?.autoMapData })),
        playerPos: () => (walkMode ? [...player.pos] : [...cam.pos]),
        playerYaw: () => cam.yaw,
        directory: () => townTalk.directory,
        discovered: () => discoveredBuildings(locId),
      }));
    },
    // PlayerActivate.ChangeInteractionMode through townTalk, which owns
    // the mode's HUD line - the panel's cycle is NOT the keyboard's,
    // see ui/hudLarge.js.
    cycleMode: (dir) => townTalk.setMode(dir > 0 ? hudLargeNextMode(getInteractionMode()) : hudLargePrevMode(getInteractionMode())),
  };
  addEventListener('keydown', (e) => {
    if (townTalk.keydown(e)) return;
    // U8a: F5 opens the classic character sheet (the dungeon's key,
    // host rule); preventDefault stops the browser reload.
    // AUDIT 17e F41: preventDefault must run for F5 in EVERY mode -
    // the mode gate skipped the handler AND its preventDefault, so
    // pressing F5 inside a building reloaded the page and destroyed
    // the session. Swallowing the browser reload is not conditional
    // on this ladder having a destination, which is why it runs above
    // it. FS1: the arc this used to defer to is U43, and U43 shipped.
    // This host is the standalone ?exterior one and builds no interior
    // to step into, so the sentence was second-hand here in the first
    // place - which is how it outlived the arc twice over.
    swallowBrowserKey(e);   // U47: F5/F6/F11 - one list, in ui/input.js
    const act = actionOf(e);   // I2: the registry owns the code -> action read
    // U45: the ladder below and the large HUD's panels are the SAME
    // doors, so they are one object now rather than two ladders that
    // would drift. `hudCtx` is ui/input.js's routeAction contract.
    if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      // PX15b: THE DIAL - this host routes its own keys (no routeKey),
      // so the Tab arm lives in ITS ladder, behind the same
      // overlay/mode gate as every sibling door. preventDefault only
      // when the dial answers, so classic Tab keeps its default.
      if (e.code === 'Tab' && openPixelDial([
        { id: 'skills', label: 'Skills', dir: 'n', open: () => hudCtx.openSheetPage() },
        { id: 'items', label: 'Items', dir: 'e', open: () => hudCtx.toggleInventory() },
        { id: 'map', label: 'Map', dir: 's', open: () => hudCtx.toggleAutomap() },
        { id: 'magic', label: 'Magic', dir: 'w', open: () => hudCtx.toggleSpellbook() },
      ])) { e.preventDefault(); return; }
      if (act === 'CharacterSheet') { hudCtx.toggleCharSheet(); return; }
      // U8d: F6 opens the classic inventory (DFU's default Inventory
      // binding; same host rule as F5).
      if (act === 'Inventory' && inventoryDoorReady()) { hudCtx.toggleInventory(); return; }
      // M2/I2: the CastSpell action opens the spellbook
      // (GameManager.cs:550-553); the cast is the attack click. The
      // C-cast key retired with I2.
      if (act === 'CastSpell') { e.preventDefault(); hudCtx.toggleSpellbook(); return; }
      // S40: Rest (R). The dungeon host has answered this key since
      // U7; above ground it did nothing at all, so a character outside
      // a dungeon could neither heal nor pass an hour.
      if (act === 'Rest') { e.preventDefault(); hudCtx.toggleRest(); return; }
      // I3: the Escape window. This dev host has no save path (the
      // quicksave lives in ?world and the dungeon contexts), so SAVE
      // answers with DFU's own cannot-save line and LOAD has nothing
      // to load - both stated by the hooks, not invented. U51: the
      // enhanced screen reads the same hooks and draws no button at
      // all where they refuse, which is the anti-lie law one step
      // further on than a dimmed control.
      if (act === 'Escape' && pauseDoorReady()) { hudCtx.togglePause(); return; }
      // A2: the exterior automap (Actions.AutoMap outdoors,
      // DaggerfallUI.cs:633-650); this host always stands on a
      // location. I2: through the registry, so M is rebindable like
      // every other action rather than a second hardcoded literal.
      if (act === 'AutoMap') { hudCtx.toggleAutomap(); return; }
    }
    // A2: the exterior automap (Actions.AutoMap outdoors,
    // DaggerfallUI.cs:633-650); this host always stands on a location.
    // I2: through the registry, so M is rebindable like every other
    // action rather than a second hardcoded literal.

    keys.add(e.code);
    if (e.code === 'AltLeft') e.preventDefault();
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!townTalk.overlayActive && !(modes?.overlayHeld ?? false) && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'AltLeft') e.preventDefault(); });
  // U45: Actions.ActivateCursor (Enter) frees the mouse during play
  // and takes it back - PlayerMouseLook.cursorActive, which had been
  // bound since I1 with no consumer at all. Without it the large HUD
  // is unreachable, because IsLargeHUDInteractable IS this flag.
  bindCursorToggle(canvas, () => townTalk.overlayActive || (modes?.overlayHeld ?? false), actionOf);
  // AUDIT 24 (wave 37) - THE LIVE CRASH. `modes` is a VAR, deliberately
  // hoisted so these two listeners can be installed HERE and still reach
  // the mode machine that is not built until ~600 lines below. `var`
  // means the binding exists and reads undefined until then; `const`
  // would make every reference above the assignment a TDZ
  // ReferenceError instead. But undefined is only survivable if the
  // guard is on the OBJECT, and the shipped line optional-CALLED the
  // method - `modes.pointerdown?.(e)` - which reads like a guard and is
  // not one.
  // ?world crashed on exactly this - a click during its
  // `await loadQuestPack()` threw
  //     TypeError: can't access property "pointerdown", it is undefined
  // out of the deployed build. This host's window is synchronous today,
  // so the same shape is LATENT here rather than live; one added await
  // between here and the declaration reopens it, which is why the cure
  // is the same. test/audit24_wave37.test.js holds both halves of it:
  // `modes?.` on every reference above the declaration, and `var` at it.
  canvas.addEventListener('pointerdown', (e) => {
    if (townTalk.pointerdown(e)) return;
    if (modes?.pointerdown?.(e)) return;
    // U45: the large HUD's panels, BEFORE the relock - a click on the
    // bar is a button press, never a grab for the pointer.
    const _r = canvas.getBoundingClientRect();
    if (routeLargeHudClick(
      (e.clientX - _r.left) * (canvas.width / _r.width),
      (e.clientY - _r.top) * (canvas.height / _r.height),
      e.button, hudCtx, { windowUp: townTalk.overlayActive || (modes?.overlayHeld ?? false) })) return;
    requestLook(canvas);
  });   // U8b/U8c: native windows own the pointer
  canvas.addEventListener('wheel', (e) => { if (townTalk.wheel(e) || modes?.wheel?.(e) || mwViewWheel(e.deltaY)) e.preventDefault(); }, { passive: false });   // U-scroll: an open window owns the wheel; MW-D25: otherwise the Morrowind camera zoom
  // C9: RMB is a weapon control (drag-to-swing) exactly as the
  // dungeon host - the drag feeds the rig INSTEAD of the look.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    // U46: the HUD is not a window and owns no pointer handler, so the
    // virtual position lands in its one store on the way past - BEFORE
    // the overlay return, because an overlay up is exactly when the
    // spell-icon tooltip is allowed to show.
    trackHudPointer(canvas, e);
    // U37: a window frees the mouse, so an open overlay gets the
    // HOVER before the look gate refuses the unlocked pointer.
    if (townTalk.hover(e) || modes?.hover?.(e)) return;
    if (document.pointerLockElement !== canvas) return;
    // AUDIT 24 (wave 45): RMB in walk mode ALWAYS ends here - it is a
    // weapon control, and whether this host or worldModes owns the
    // swing, it is never a look. The old line gated the whole thing on
    // `modeNow() === 'exterior'`, so indoors worldModes fed the modal
    // rig (:1517) and this fell through to the camera: every swing
    // inside a building or a dungeon turned the view with it.
    const drag = routeMouseDrag({ walkMode, buttons: e.buttons, mode: modeNow() });
    if (drag !== 'look') {
      if (drag === 'swing' && !magic.interceptAttack(true)) {   // M2: an armed cast eats the click
        weaponRig.attackInput(e.movementX, e.movementY, true);
      }
      return;
    }
    // AUDIT 28 W7: the delta goes to the look filter's target, not the
    // camera - PlayerMouseLook.ApplyLook (:126); the frame pays it out
    // at MouseLookSmoothingFactor. HANDEDNESS (mat4's law): mouse-right
    // turns toward +x = screen-right; the pitch clamp is the filter's.
    lookFilter.add(e.movementX * lookScale(), -e.movementY * lookScale() * lookInvert());
  });
  // U41: `!townTalk.overlayActive` is the dungeon host's own gate
  // (dungeon.js:184, "a right-click on a window is the window's...
  // never a swing"), which these two hosts never got. It matters now
  // that the travel map makes RMB a ROUTINE gesture - its zoom - and
  // an ungated one fires a readied spell or looses an arrow at the
  // world behind the map.
  addEventListener('mousedown', (e) => { if (e.button === 2) rightHeld = true; if (e.button === 2 && !townTalk.overlayActive && walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.attackInput(0, 0, true); } });   // M2
  addEventListener('mouseup', (e) => { if (e.button === 2) rightHeld = false; if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, false); });   // the RELEASE is never gated - a window opened mid-swing must still let go
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      lookFilter.add(dx * lookScale(), -dy * lookScale() * lookInvert());   // AUDIT 28 W7: through the look filter (HANDEDNESS, mat4's law)
    },
    attack: (dx, dy, held) => { if (walkMode && modeNow() === 'exterior') { if (held && magic.interceptAttack(true)) return; weaponRig.attackInput(dx, dy, held); } },   // M2
    // AUDIT 39: the tap is an attack entry like the other three, so it
    // takes the M2 gate they take - an armed cast eats the click
    // (WeaponManager.cs:244-263 defers to HasReadySpell before it
    // handles any attack). This was the one door in the host without
    // it, and touch.js:98 already promises the tap casts.
    attackTap: () => { if (walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.clickAttack(); } },
    cycleMode: () => townTalk.nextMode(),   // T3-touch: the phone's F1-F4
  });

  // P7: the exterior scene hosts the same mode machine as ?world -
  // E on a building door enters its interior, E on a DUNGEON_ENTRANCE
  // door drops into the location's crawl, exits land verbatim.
  // VAR, not const: the pointer and wheel listeners far above close over
  // this binding and are live before it is assigned, so it must exist
  // and read undefined rather than throw a TDZ ReferenceError. Every
  // reference BEFORE this line must therefore be `modes?.` - which is
  // what test/audit24_wave37.test.js asserts, both ways.
  // V2c: createWorldModes also registers setPassiveSpecialsHost (the
  // sunlight/holy-place seam) for THIS page - THE FOUR HOSTS RULE.
  var modes = createWorldModes({
    canvas, renderer, player, cam, keys, latch, blocks,
    // S40: IsPlayerInTown() with both flags at their defaults - the
    // location TYPE alone (PlayerGPS.cs:504-527), which is what
    // CanRest's inside-a-building arm asks.
    inTownLocation: () => isPlayerInTown(_musicLocationType()),
    // AUDIT 39 (#22): PlayerEntity.SpawnCityGuards(bool) - the theft
    // arm's caller, which neither host answered. Same shape as the
    // world host's.
    spawnCityGuards: (immediate) => (immediate ? _crimeResponse() : _witnessResponse()),
    // G6: the knightly smith's gift needs THIS host's inventory
    // window in choose-one mode - one builder, one dependency list.
    makeInventory: (extra) => (inventoryDoorReady() ? makeInventoryWindow(extra) : null),
    // S40: AbortRestForEnemySpawn (:301-304) reaches the rest window
    // in THIS host's overlay slot. In DFU the OnEncounter subscription
    // is on the WINDOW (OnPush :264, OnPop :275), so it follows the
    // window wherever it is mounted - and an outdoor rest is exactly
    // where a quest CreateFoe wave lands beside a sleeping player.
    abortRestForEnemySpawn: () => {
      if (townTalk.overlay?.isRestWindow) townTalk.overlay.abortForEnemySpawn?.();
    },
    // U43: and the other two windows the INTERIOR host answers keys
    // for. Same rule as makeInventory - this host owns the builder and
    // its dependency list; worldModes only chooses the slot.
    makeCharSheet: () => (charSheetDoorReady() ? makeCharSheetWindow() : null),
    magic, spellsByIndex: () => spellsByIndex,   // M2: the one cast engine + SPELLS.STD ride into the interior arm
    townTalk,   // U23: the interior host borrows FACTION.TXT/TEXT.RSC + the talk seam
    // R1: without this the exterior-lock anti-grind record and
    // DiscoverBuilding silently no-op in the ?exterior host (locId
    // null skips both) - the same `region:location` string the world
    // host and townTalk's reveal use.
    discoveryLocationId: () => `${dfLocation.regionIndex}:${dfLocation.name ?? locationName}`,
    // U39: this host never passed a scene context, so every consumer
    // of questSceneCtx().mapId read the `?? 0` fallback - which the
    // tavern's rental key exposed, since a room is stored by (mapId,
    // buildingKey) and a buildingKey is only unique WITHIN a location.
    // The world host has had this since Q4-v; the single-city host
    // knows its own location outright.
    questSceneCtx: () => ({
      mapId: dfLocation?.mapTableData?.mapId ?? 0,
      locationIndex: dfLocation?.locationIndex ?? 0,
    }),
    // A5b: the tavern arm needs the host's clock, and leaving one has to
    // hand the street back its own song - the host owns both, so both
    // ride in as closures rather than worldModes reaching for a global.
    // uploadRecordFrame rides here too: worldModes hands this bag
    // straight to buildDungeonContext and buildInteriorContext, and
    // BOTH destructure it for their mobile-sprite draw. Leaving it
    // out did not fail loudly - it arrived as undefined and threw
    // `is not a function` on the first enemy frame in a dungeon
    // entered from this host, while the standalone ?dungeon scene
    // (which spreads the whole pipeline) was fine.
    pipeline: { getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, arch, palette, getMachineryParts },   // WM4b: the mill machinery's moving parts, for the interior arm
    foes: !params.has('nofoes'),   // C11: foes are the DEFAULT now (monsters live; ?nofoes for the empty-dungeon dev view)
    playerClass: params.has('class') ? Number(params.get('class')) : undefined,
    playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined,
    playerWeapon: params.get('weapon') ?? undefined,
    doorTargets: () => buildingDoors,
    // AUDIT 26 (F019): RMBLayout's exterior StaticNPCs, world-frame -
    // the same list the activation ray reads for a building's people,
    // one mode up (PlayerActivate.ActivateStaticNPC :741-767).
    npcTargets: () => exteriorNpcs,
    baseCollider: () => collider,
    // E2: one entered door -> its merged building identity (the T3c
    // pool merge) + the directory name by buildingKey.
    buildingDataForDoor: (hit) => {
      if (!hit) return null;
      const d = buildingDataForDoor(dfLocation.exterior.buildings, loc.blocks, {
        dfBlock: hit.dfBlock, recordIndex: hit.recordIndex,
        position: [hit.door.matrix[12], hit.door.matrix[13], hit.door.matrix[14]],
      });
      if (!d) return null;
      return { ...d, regionIndex: dfLocation.regionIndex, name: townTalk.directory.find((e) => e.buildingKey === d.buildingKey)?.name ?? '' };
    },
  });
  if (shotMode) {
    window.__frame = window.__frame ?? 0;   // AUDIT 17e F37: the counter is now incremented, so seed it
    window.__renderer = renderer;   // EV2: the probe surface every host carries now (the dungeon's U38 precedent) - draw counts land against renderer.stats
    window.__pose = (x, y, z, yaw, pitch) => {
      cam.yaw = yaw; cam.pitch = pitch;
      // walk mode: the camera FOLLOWS the motor - move the player
      // (a bare cam.pos write is overwritten next frame; T1 probe fix)
      if (walkMode) player.spawn(x, y, z); else cam.pos = [x, y, z];
    };
    modes.installShotProbes();
    window.__magic = () => JSON.stringify({ mp: playerEntity.magicka, readied: magic.readied()?.name ?? null, armed: magic.spellArmed(), missiles: magic.missileCount(), mode: modes?.mode ?? 'exterior', book: (playerEntity.spells ?? []).map((sp) => ({ name: sp.name, range: sp.rangeType })) });   // M5 cast probe
    // X11c: the self-cast door, named as the dungeon host names it. A
    // spell that opens a WINDOW (Identify, Dispel Magic, Create Item)
    // can only be verified where the window actually mounts, and two
    // of those three had never been routed by this host at all.
    window.__combat = { applySpellToPlayer: (sp, lvl) => magic.applySpellToPlayer(sp, lvl ?? playerEntity.level) };
    // X11c: and the KEY seam into whatever holds the town's overlay
    // slot - the same surface the dungeon host has had since U26. A
    // window opened by a spell has to be DRIVEN to be verified, and
    // half of these windows answer only the keyboard for their
    // confirmation boxes.
    window.__overlayKey = (code) => townTalk.keydown({ code, key: code, preventDefault() {}, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false });
    // U42: the classic spellbook's live state - the same surface the
    // world host carries, because tools/spellbookProbe.mjs drives
    // BOTH exterior pages and the window's buttons are hit rects
    // painted into SPBK00I0 that a probe cannot see.
    window.__spellbook = () => JSON.stringify(_spellbook && !_spellbook.done ? {
      buyMode: _spellbook.buyMode, selected: _spellbook.selectedIndex,
      scroll: _spellbook.scrollIndex, top: _spellbook.top,
      name: _spellbook.selected?.name ?? null,
      effects: [0, 1, 2].map((i) => _spellbook.effectLabels(i)),
      rows: _spellbook._rows.map((r) => ({ text: r.text, dim: r.dim })),
    } : null);
    window.__readyRanged = () => { const sp = rangedDamageSpells(spellsByIndex).map((x) => [calculateCastCost(x, playerEntity).sp, x]).sort((a, b) => a[0] - b[0])[0]?.[1]; magic.setReadied(sp); return sp ? `${sp.name}:${calculateCastCost(sp, playerEntity).sp}` : null; };   // M5: no classic starting set carries a missile spell - ready the cheapest flier for the flight leg
    // T1: the townsfolk probe surface
    window.__people = () => JSON.stringify((population?.pool ?? []).map((it, i) => ({
      i, active: it.active, visible: it.visible, pend: it.scheduleEnable, recyc: it.scheduleRecycle,
      archive: it.person.archive, state: it.person.state, moves: it.person.moveCount, seeks: it.person.seekCount,
      pos: it.person.pos.map((v) => Number(v.toFixed(2))),
    })).filter((x) => x.active));
    window.__talk = () => JSON.stringify(townTalk._debug());   // T3b probe surface
    // U25: the inventory window's live message box (info, use, wagon,
    // the drop-gold field) - the probe reads what the player is being
    // told rather than only that a box exists.
    window.__invBox = () => townTalk._debug().overlayBox;
    window.__chargenRace = () => townTalk._debug().overlayFlow?.race?.key ?? null;   // U10 probe surface
    window.__chargenConfirm = () => townTalk._debug().overlayFlow?.raceConfirm ?? null;   // U11 probe surface
    window.__chargenFlow = () => townTalk._debug().overlayFlow ?? null;   // S3e probe surface
    window.__addGold = (n) => addGold(playerEntity, n);   // U10 probe surface: gold through the real producer
    // U47 probe surface: the inventory's info panel, whatever window
    // holds it. The panel is the ONLY state the hover seam writes, so
    // it is also the only way to prove from outside that a real
    // mousemove reached the window at all.
    window.__invInfo = () => {
      const o = townTalk.overlay;
      // duck-typed, as worldModes' own inventory probe is - the host
      // must not import the window class to recognise it (U26's pin)
      const isInv = !!o && typeof o._remote === 'function' && typeof o.hover === 'function';
      return isInv
        ? JSON.stringify({ item: o.infoItem?.name ?? null, gold: !!o.infoGold, tab: o.tab })
        : 'null';
    };
    // V1 probe surface: the bite, the clock and the lifecycle state.
    // The infection is minted through the REAL producer path's
    // startInfection, not by hand, so a probe cannot pass over a
    // shape the game never builds.
    window.__infect = (key) => JSON.stringify(startInfection(playerEntity, key, {
      day: Math.floor(playerTicker.classicMinutes / MINUTES_PER_DAY), regionIndex: dfLocation.regionIndex ?? -1,
    }) ?? null);
    window.__advanceDays = (d) => { playerTicker.advance(d * MINUTES_PER_DAY); return playerTicker.classicMinutes; };
    window.__infection = () => JSON.stringify({
      entry: liveInfection(playerEntity), diseases: diseaseCount(playerEntity),
      pending: playerEntity.racialOverridePending ?? null,
      videos: (typeof window !== 'undefined' ? window.__infectionVideos : null) ?? [],
    });
    window.__guards = () => JSON.stringify(cityGuards._debug());   // G1 probe surface
    window.__droppedLoot = () => JSON.stringify(droppedLoot._piles.map((pl) => ({ n: pl.items.length, pos: pl.pos.map((v) => +v.toFixed(1)), record: pl.record, flat: !!pl.batch })));   // U8e probe surface
    window.__crime = () => _crimeResponse();   // G1: force the response without pickpocket RNG
    window.__guardDamage = (i, dmg) => cityGuards._damage(i, dmg);   // G3: the real death path for loot probes
    window.__uiArt = () => JSON.stringify({ charsheet: charSheetDoorReady() });   // U8a probe surface; U52: the door, not the art alone
    window.__attack = () => weaponRig.clickAttack();   // G4: ClickToAttack for swing probes
    window.__townDebug = () => JSON.stringify({
      night: isNight(minuteNow()), pool: population?.pool.length ?? 0, max: population?.maxPopulation ?? 0, populated,
      player: cam.pos.map((v) => Number(v.toFixed(1))), yaw: Number(cam.yaw.toFixed(2)), walkMode,
    });
  }

  // T1 TOWNS: the wandering population (PopulationManager verbatim -
  // 10Hz pool, 24/16-blocks clamp, daytime only, anti-skate hidden
  // first move). Race: the region's people - Daggerfall = Breton
  // (FLAGGED: the climate People table pends; the test city is
  // correct). Each pool person owns a live billboard batch (the C11
  // shape) drawn on the flats' axis (the billboard-axis doctrine).
  // AUDIT 18 HOST GAP: StreamingWorld.cs:771-781 adds PopulationManager
  // to exactly SEVEN LocationTypes. The streaming host gated on them;
  // this host constructed a population for whatever ?region/?loc
  // resolved to, so every graveyard, coven, keep, ruin and poor home
  // got wandering townsfolk (and the talk/crime surfaces they carry)
  // that DFU never creates there. The table now lives in shared.js.
  const populated = populatesWanderingNpcs(dfLocation.mapTableData.locationType);
  // AUDIT 23 (characters-4) - PopulationManager.cs:94: the wandering
  // race is the CLIMATE's People (Redguard deserts, Nord mountains);
  // it was hardcoded Breton. FACTION_RACES numbers -> texture keys.
  const populationRace = ({ 0: 'Nord', 2: 'Redguard', 3: 'Breton' })[dfLocation.climate?.people] ?? 'Breton';
  const personArchives = [...PERSON_TEXTURES[populationRace].male, ...PERSON_TEXTURES[populationRace].female, GUARD_TEXTURE];
  const personTex = new Map();
  if (populated) await Promise.all(personArchives.map(async (a) => personTex.set(a, await getTexture(a))));
  const personBatchOf = new Map();   // person -> batch
  const population = !populated ? null : new TownPopulation(cityNav, {
          suppressSpawns: () => racialSuppressPopulationSpawns(playerEntity),   // V4: the transformed lycanthrope empties the streets
    totalBlocks: loc.width * loc.height,
    race: populationRace,
    // AUDIT 23 (characters-5) - MobilePersonNPC.cs:214: the NAME bank
    // is the REGION's (MapsFile.RegionRaces), not the billboard race.
    nameBank: getNameBankOfRegion(dfLocation.regionIndex),
    makePerson: (archive, guard) => {
      const person = new MobilePerson(cityNav, {
        archive, guard,
        // audit 2026-08-17: identity re-rolls per spawn - resolve the
        // texture by the person's LIVE archive, never the creation one
        frameCount: (rec, a) => personTex.get(a).getFrameCount(rec),
        collider,
        groundY: (x, z) => collider.heightAt(x, z),
      });
      personBatchOf.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
      return person;
    },
  });
  let _lastPlayerPos = null, _playerStill = false;

  const lightAnimator = new CityLightAnimator(cityLights.length, CITY_LIGHT_RANGE);
  const nightAmbientFloor = new Float32Array([0.25, 0.25, 0.25]);

  status(`${locationName} - ${loc.blocks.length} blocks, ${drawList.length} draws`);
  console.log(
    `scene: ${loc.blocks.length} blocks, ${drawList.length} placements, ` +
    `${gpuMeshes.size} meshes, ${renderer.textures.size} textures, ${flatCount} flats in ${billboardBatches.length} batches, ${cityLights.length} lights, ` +
    `ground ${groundArchive}, climate ${climateBase}, season ${season}, ${texRemap.size} swaps, ${renderer.emissionTextures.size} window masks`
  );

  let frames = 0;
  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);   // A3
  let last = performance.now();
  const lookGate = makeLookGate(canvas);
  const _frameToken = claimFrame();   // P0: this session owns the loop until someone claims after it
  function frame(now) {
    if (!frameAlive(_frameToken)) return;   // P0: a later boot or an unwind killed this loop
    // AUDIT 39 (#160): a full-screen video owns the canvas for its
    // lifetime (DFU pauses the game for it). The loop WAITS - it
    // neither simulates nor draws - and the clock does not accrue.
    if (frameHeld()) { last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - last) / 1000);
    // AUDIT 28 W7 + F-C1/F-C2 (self-audit 3): PlayerMouseLook.Update's
    // three answers - paused (:241-244) returns before ApplyLook and the
    // owed look WAITS; a held swing (:248-253, WeaponSwingMode 0, not a
    // bow) is SetFacing(lookCurrent) - the owed look is DROPPED; else
    // ApplySmoothing pays it out at the setting's fraction. Before the
    // camera is read.
    if (!(townTalk.overlayActive || (modes?.overlayHeld ?? false))) {
      if (rightHeld && walkMode && modeNow() === 'exterior' && !weaponRig.playerWeapon.machine?.isBow) lookFilter.settle();
      else lookFilter.tick(dt, cam);
    }
    // AUDIT 28 W9: CameraRecoiler.Update - the reel from a hit, on the
    // detector's loss from the vitals rig, same paused gate (:50-51).
    cameraRecoiler.update(dt, cam, { healthLost: lastHealthLost(), healthLostPercent: lastHealthLostPercent(), paused: townTalk.overlayActive || (modes?.overlayHeld ?? false) });
    // AUDIT 28 W10: HeadBobber.Update - the walk bob and nod, the landing
    // dip; the position rides player.eye as a world offset, the nod is a
    // per-frame offset on the look (removed and re-applied each frame).
    {
      const bob = headBobber.update(dt, cam, {
        health: playerEntity.health, paused: townTalk.overlayActive || (modes?.overlayHeld ?? false), climbing: !!player.climb?.isClimbing, grounded: !!player.grounded,
        swimming: !!player.swimming, running: !!player.isRunning, crouching: !!player.crouching, riding: !!player.riding, levitating: !!player.levitating,   // TR1: the Horse bob style
        velocity: player.moveSpeed || 0, moving: !!(player.moveForward || player.moveStrafe),
      });
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);   // HANDEDNESS (mat4's law): right = (cos, 0, -sin)
      player.bobOffset = [cy * bob[0], bob[1], -sy * bob[0]];
    }
    last = now;
    lookGate(townTalk.overlayActive || (modes?.overlayHeld ?? false));   // a window up frees the cursor; closing re-locks

    // Modal frame (worldModes.js): interior/dungeon consume the frame
    // entirely - none of the exterior sky/weather/light path runs.
    // AUDIT 21 F1: THE MUSIC CONTEXT IS FED BEFORE THE MODAL RETURN.
    // worldModes.frame() consumes the frame and returns TRUE for interior
    // and dungeon; musicContext() returns null ONLY for exterior. They are
    // the same predicate, so with the update below the early return it ran
    // exclusively on frames where the overlay was guaranteed to be null -
    // entering a tavern kept the street song, entering a dungeon kept the
    // sunny outdoor track, and when that song ended nothing fed `songEnded`
    // so it fell silent for the rest of the visit. The whole interior and
    // dungeon music path was dead code in this host.
    musicDirector.update({
      inside: false,
      inLocationRect: _musicInLocationRect(),
      locationType: _musicLocationType(),
      locationIndex: _musicLocationIndex(),
      weather,
      night: isNight(minuteNow()),
      gameDays: gameDaysNow(),
      // UpdatePlayerMusicArrested (:568-571). Checked FIRST in
      // AssignPlaylist and overrides the environment entirely.
      arrested: Boolean(playerEntity.arrested),
    }, modes?.musicContext?.() ?? null);

    if (modes.frame(dt, now)) {
      // WM4c: inside a building or a dungeon the exterior parent is
      // INACTIVE in DFU (PlayerEnterExit disables it), and a disabled
      // AudioSource stops. The mills fall silent with it and start
      // again on the way out, through the same retry that started them.
      for (const w of windmills) { w.hum?.stop(); w.hum = null; }
      // AUDIT F2-I1: the modal frame RETURNS, so an overlay held in the
      // townTalk slot got neither its clock nor its draw while the
      // player was inside a building or a dungeon - chargen mounts
      // there from an un-awaited load, so a constellation started on
      // the way in would hang until its deadline. Ticked and drawn
      // ABOVE the modal render, which is where townTalk always draws.
      // U43-ii: UNCONDITIONAL. AUDIT F2-I1 added this line to tick a
      // window held in the townTalk slot while the player was inside a
      // building or a dungeon, and gated it on the window existing -
      // but townTalk.frame ticks and draws the HUD TEXT LAYER too
      // (townTalk.js:571, :586). So every HUD line raised in a modal
      // mode had nowhere to land, which is why the interior weapon
      // rig's `say` was a console.warn and the interior ticker's was a
      // console.log. Drawn ABOVE the modal render, which is where
      // townTalk always draws.
      townTalk.frame(dt);
      requestAnimationFrame(frame);
      return;
    }


    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];   // HANDEDNESS (mat4's law): screen-right = (cos, 0, -sin) under the mirrored projection - Unity's own right
    // AUDIT 39 (S19 host gap): PARALYSIS, above ground. Every DFU gate
    // reads PlayerEntity.IsParalyzed with no interior/exterior test -
    // FrictionMotor.GroundedMovement (:75-81) and
    // AcrobatMotor.CheckAirControl (:135-141) zero the movement input,
    // HandleJumpInput (:64-70) and LevitateMotor.Update (:67-69)
    // return, WeaponManager (:235-239) does ShowWeapons(false) and
    // takes no swing. Declared above `walkMode` because the motor and
    // the weapon rig are two sibling blocks.
    const paralyzed = entityIsParalyzed(playerEntity);
    if (walkMode) {
      // Grounded movement: verbatim speeds in the motor, Space edge-jumps.
      const jumpHeld = held(keys, 'Jump');
      const crouchHeld = held(keys, 'Crouch');   // P12 host parity (audit F4); I2: DFU's default C
      const _overlayHeld = (modes?.dungeonCtx?.uiOverlayActive ?? false) || townTalk.overlayActive;   // chargen/windows/talk hold the motor - typing must not walk the player
      // AUDIT 18 F9: the player's world clock, HELD by the same gate.
      // It ran only inside a dungeon before F8 moved it here; F8 then
      // ran it unconditionally, which is the U7 bug shape inverted -
      // DFU stops the clock outright under a paused window. PauseGame
      // (GameManager.cs:600-610) sets Time.timeScale = 0, and
      // WorldTime.Update (:60-69) advances the calendar by
      // `Time.deltaTime * TimeScale`, so a PauseWhileOpen window
      // freezes game time entirely: no magic round, no disease day, no
      // fatigue, no skill advancement. Open the char sheet and the
      // motor already held here - the clock did not, so a disease
      // aged while the game was paused.
      if (!_overlayHeld) playerTicker.tick(dt * timeScaleMult, {
        // AUDIT 23 (entity-2): playerMotor.IsRunning && !IsStandingStill
        // (PlayerEntity.cs:408) - `player.running` never existed, so the
        // 88/min running drain was dead above ground. C6: the jump edge.
        running: player.isRunning && !player.standing,
        swimming: player.swimming,
        climbing: !!player.climb?.isClimbing,   // AUDIT 26 F083
        jumped: player.jumped,
      });
      // AUDIT 18 HOST GAP: levitate/waterWalking/slowFall were written
      // ONLY inside worldModes' dungeon branch and never cleared, so
      // leaving a dungeon while levitating stranded the player in the
      // motor's no-gravity branch forever. The EFFECT owns the flag
      // (Levitate.cs:131/:136); swimming is false outdoors (there is
      // no blockWaterLevel - PlayerEnterExit.IsPlayerSwimming).
      applyMotorEffectFlags(player, playerEntity);
      const mv = moveHeld(keys);
      // AUDIT 28 W8: the axes advance only on frames the motor runs (a
      // held overlay is DFU's timeScale 0 - no climb, no friction).
      const axes = _overlayHeld ? { forward: moveAxes.vertical, strafe: moveAxes.horizontal } : moveAxes.update(dt, mv);
      const moving = !paralyzed && anyMove(mv);   // AUDIT 39: dungeon.js:462's shape - a frozen player takes no stride
      // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
      // gates movement and the jump only (DecideHeightAction has no check).
      if (!_overlayHeld) player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
        forward: axes.forward,   // AUDIT 28 W8: InputManager's axes - accelerated under MovementAcceleration, the held difference without
        strafe: axes.strafe,
        run: held(keys, 'Run'),
        sneak: held(keys, 'Sneak'),   // P15: DFU's default Sneak binding (LeftAlt), held
        jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
        // LevitateMotor.Update (:71-91) reads Jump/FloatUp for up and
        // Crouch/FloatDown for down, and moves along the camera LOOK
        // (pitch included) - everywhere, not just underground.
        up: jumpHeld || held(keys, 'FloatUp'),
        // AUDIT 26 F031: LevitateMotor's descent arm is Crouch OR
        // FloatDown (:88-89), the mirror of the rise arm above; the
        // port's own motor contract said so and every host passed
        // FloatDown alone, so C did nothing but toggle the stance.
        down: crouchHeld || held(keys, 'FloatDown'),
        crouch: crouchHeld && !latch.crouch,
      }, cam.yaw, cam.pitch);
      latch.crouch = crouchHeld;
      // C9: ReadyWeapon (Z) - the sheathe toggle, host parity.
      const zNowW = held(keys, 'ReadyWeapon');
      if (zNowW && !zPrevW) weaponRig.toggleSheath();
      zPrevW = zNowW;
      // P14 fall damage (host parity). FD1: the outdoor-water
      // exemption is live here too - playerGroundTileRaw below is this
      // host's twin of world.js's FS1 probe, read off the same
      // locationTilemap and the same 6.4-unit stride the ground draw
      // uses, so the two hosts cannot answer differently for the same
      // ground.
      applyFallLanding(playerEntity, player.landedFallDistance, {
        sound: (id) => audio.playOneShot(id),
        inOutdoorWater: isOutdoorWaterTile(playerGroundTileRaw()),
      });
      // FS-slice: PlayerFootsteps - the exterior stride.
      {
        const _step = footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          standingStill: !moving,
          halfSpeed: player.movingLessThanHalfSpeed,
        }, pickFootstepSet({ inside: false, winter: season === SEASON.Winter, climateIndex: locClimateIndex }));
        if (_step) audio.playOneShot(_step.clip, _step.volume);
      }
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      // DC1: PlayerDeath.Update's camera sink (per-frame off the fresh eye array).
      if (townTalk.overlay instanceof DeathScreen) cam.pos[1] -= townTalk.overlay.drop;
      const useHeld = keys.has('KeyE');   // I2 departure: DFU activates on Mouse0 and E is AbortSpell - the pointer-parity slice owns the move
      if (useHeld && !latch.use && !modes.transitioning) {
        // T3b: a townsperson under the ray wins the activation (the
        // PlayerActivate nearest-hit order); G3: a guard corpse next
        // (loot pickup on the dungeon's S2 shape); doors otherwise.
        const useFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        if (!townTalk.tryActivate(cam.pos, useFwd, _livePersons)) {
          const lootKey = pickActivatable(cam.pos, useFwd, cityGuards.lootTargets(), collider);
          const dropKey = lootKey ? null : pickActivatable(cam.pos, useFwd, droppedLoot.lootTargets(), collider);
          if (lootKey) { cityGuards.takeLoot(lootKey, (l) => townTalk.say(l)); surfacePlayer(); }
          // U58: THE DOOR AGAIN. U53 pinned this arm to the ART
          // because the door handed every LOOT call the classic window,
          // which cannot draw without INVE00I0. The enhanced pane runs
          // the pile itself now, so the gate is the skin question every
          // other pack arm asks - and on the classic skin it still comes
          // down to the same art.
          else if (dropKey && inventoryDoorReady()) {
            // U8e: a pile under the ray opens the inventory WITH the
            // pile as the remote target (Remove defaults - the OnPush law)
            const pile = droppedLoot.pileFor(dropKey);
            townTalk.showOverlay(makeInventoryWindow({
              // U53: THE HOST'S OWN FACTORY, not a twelfth copy of it.
              // This arm hand-rolled the window with the SAME eleven hooks
              // makeInventoryWindow already passes, plus the two below -
              // which is precisely what its `extra` parameter is for.
              onClose: () => droppedLoot.releaseEmptied(),   // AUDIT 17e F28: DFU frees the container on window close
              loot: { items: () => pile.items },
            }));
          }
          else modes.tryEnter().catch((e) => console.error(e));
        }
      }
      latch.use = useHeld;
      // I2 retired the V third-person toggle: V is DFU's TravelMap
      // default and the ?world host already consumes it there; third
      // person rides the ?tp URL param, as it always has in ?world.
    } else {
      const speed = (keys.has('ShiftLeft') ? 120 : 30) * dt;   // fly-cam (dev): raw keys, not an action
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;   // fly-cam (dev)
    }

    // Shot vantage scales with the location extent.
    const riding = tpMode && walkMode && !!rig;
    const TP_DIST = 3.2;   // third-person pull-back along the view ray (camera-terrain clip: open, noted in the arc)
    // MW-D25: the plain walk eye rides the Morrowind camera machine;
    // the screenshot scout and the horse keep their own framing (the
    // ride-view predates the machine and is its own recorded law).
    const mwv = (!shotMode || walkMode) && !riding
      ? mwViewFrame({ fpEye: cam.pos, feet: player.pos, yaw: cam.yaw, pitch: cam.pitch,
          raycast: (o, d, m) => collider.raycast(o, d, m) })
      : { eye: cam.pos, thirdPerson: false };
    const target = shotMode && !walkMode
      ? [extentX * 0.46, 6, extentZ * 0.5]
      : riding
        ? [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]]
        : [mwv.eye[0] + fwd[0], mwv.eye[1] + fwd[1], mwv.eye[2] + fwd[2]];   // MW-D25: ahead of the machine's eye
    const eye = shotMode && !walkMode
      ? [extentX * 0.565, 11, extentZ * 0.72]
      : riding
        ? [cam.pos[0] - fwd[0] * TP_DIST, cam.pos[1] - fwd[1] * TP_DIST, cam.pos[2] - fwd[2] * TP_DIST]
        : mwv.eye;
    const proj = mirrorProjectionX(perspective(   // HANDEDNESS (mat4's law)
      fieldOfView(),
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      Math.max(2000, extentX * 4)
    ));
    const view = lookAt(eye, target, [0, 1, 0]);
    if (cullOn) frustumPlanes(multiply(proj, view, _pv), _planes);   // EV3: the same matrices the draws ride

    // World clock (R5): sun direction/intensity and ambient follow the time
    // of day; the sun is off at night leaving the 0.25 ambient floor.
    const minute = minuteNow();
    // W1/S41: the DRAIN ticks on the exterior frame (this host is one
    // location - locClimateIndex is the player's climate); the ROLL is
    // the entity tick's day block. A pinned ?weather never ticks.
    // Loads restore through save.js's one law and re-present here on
    // the next changed tick... which the restore's flag-down stamp
    // suppresses, so the applied value re-derives each frame below
    // from `weather` - refreshed when tickWeather answers true.
    if (!weatherOverride) {
      tickWeather(Math.floor(playerTicker.classicMinutes), locClimateIndex);
      if (currentWeather() !== weather) applyWeather(currentWeather());   // drift-aware (world.js's twin note)
    }
    // A3: the exterior ambience (WeatherAmbientEffects 5/25).
    audio.setListener(eye, [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    ambience.setPreset(presetForExterior(weather, isNight(minute)));
    ambience.update(dt, { playerPos: eye });
    animalAmbience.update(dt, eye);   // A4: town animal barks (PlayRandomlyIfPlayerNear)
    // Storm lightning: verbatim frame-strobe multiplier on the sun (2x
    // during a flash frame); ?flashtest pins it on for shots.
    const flash = params.has('flashtest') ? 2 : (lightning ? lightning.tick(dt) : 1);
    // EV5: the moons light the night - the masser as a second key, the
    // secunda folded into the ambient. null by day and under classic.
    const moonNow = sky.moonlight();
    renderer.setMoonlight(moonNow);
    renderer.setLighting(
      withMoonAmbient(exteriorAmbient(minute, getFloat('Enhancements', 'NightAmbientLightScale', 0, 1), weatherSun), moonNow), sunScale(minute) * weatherSun * flash * sky.sunFactor(),   // ES1d: the cloud in front of the sun takes the KEY light (never the ambient - the sky still lights the ground)
      new Float32Array(SUN_RIG_COLOR));
    // R12: the player-following indirect point light (SunlightRig) -
    // intensity x the daylight curve, weather-dimmed with the rig,
    // off at night; positioned at the player (the eye here - the
    // 0.8 controller-center offset is <1% of the 150 range).
    {
      const iScale = indirectLightScale(minute) * weatherSun;
      renderer.setIndirectLight(eye, INDIRECT_LIGHT_RANGE, new Float32Array([
        INDIRECT_LIGHT_COLOR[0] * iScale, INDIRECT_LIGHT_COLOR[1] * iScale, INDIRECT_LIGHT_COLOR[2] * iScale,
      ]));
    }
    renderer.setWindowEmission(windowEmissionRGB(
      params.has('window') ? params.get('window')
        : (windowStyleForWeather(weather) ?? windowStyleForTime(minute))));
    // DaggerfallSky.cs:363-367 - a non-Normal WeatherStyle (every rain,
    // thunder and snow) disables the clear night sky, so the DAY sky at
    // frame 0 is drawn instead. weatherSkyOffset IS the WeatherStyle
    // (Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7; Normal is 0).
    // AUDIT 23 (wts-1) - DaggerfallSky.cs:354-357: the Normal-weather
    // arm adds the CALENDAR season to SkyBase (Fall 0 / Spring 1 /
    // Summer 2 / Winter 3); the rain/snow variants keep their boot
    // roll. One clock, so the season reads the world date.
    sky.use(dfLocation.climate.skyBase + (weatherSkyOffset === 0
      ? seasonValue(dateFromClassicMinutes(playerTicker.classicMinutes)) : weatherSkyOffset), minute, weatherSkyOffset === 0,
    { weather, classicMinutes: playerTicker.classicMinutes });   // ES1: the enhanced sky's clouds and moons
    // Weather fog, colored by the live sky horizon fill (fills DFU's
    // fogColor TODO); heavy fog also swallows the sky.
    // Verbatim: fog is never disabled (SetFog keeps RenderSettings.fog on);
    // Sunny/Overcast ARE linear fog to 2400 - the classic distance haze.
    // DaggerfallSky.SetSkyFogColor (:318-325): anything denser than
    // heavy rain fogs to Color.gray, not to the sky tint.
    const fogColor = outdoorFogColor(weatherFog, sky.renderer.clearColor);
    renderer.setFog(weatherFog.mode,
      weatherFog.density, weatherFog.start, weatherFog.end, fogColor);
    sky.renderer.fogColor = fogColor;
    sky.renderer.fogMix = weatherFog.excludeSky ? 0 : 1 - fogFactor(weatherFog, 800);

    // City lanterns: on 17:00-08:00 (IsCityLightsOn), each flickering
    // verbatim DaggerfallLight (14 ticks/s toward random range targets).
    const lightsOn = lightsOnAt(minute);
    if (lightsOn) lightAnimator.tick(dt);
    renderer.setPointLights(
      withPlayerLights(lightsOn
        ? nearestLights(cityLights, eye, 16, lightAnimator.ranges)
        : new Float32Array(0),
      magic?.candleLight(), playerTorchLight(playerEntity, player.pos, cam.yaw)),   // X11: the candle burns by day too - the effect has no time gate; T1: so does the torch
      CITY_LIGHT_COLOR_F32
    );
    renderer.beginFrame(proj, view, sunDirection(minute));
    mwViewDrawBody(canvas, { proj, view, eye, feet: player.pos, yaw: cam.yaw });   // MW-D24
    {
      const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
      const horiz = Math.hypot(dx, dz) || 1e-6;
      sky.draw(Math.atan2(dx, dz), Math.atan2(dy, horiz), fieldOfView(),
        canvas.clientWidth / canvas.clientHeight);
      renderer.markForeignPass();   // EV6: the sky changed programs behind the shadows' back
    }
    renderer.drawTerrain(groundSurface, identityMatrix,
      renderer.tileArrays.get(groundArchive), tilemapTex, 6.4);
    for (const d of drawList) {
      if (cullOn && aabbOutside(_planes, d.box)) continue;   // EV3
      renderer.drawMesh(d.mesh, d.matrix, texRemap);
    }
    // WM2b: THE SAILS. Driven by the SAME eased wind vector the cloud
    // deck overhead is drawn with (shared.js's sky.wind()), so a storm
    // picks the mills up on the same fourteen-second curve it picks the
    // sky up on. A null row is "no wind is known" - the classic sky
    // eases nothing - and a mill then stands still rather than guessing.
    if (millParts && windmills.length) {
      const wind = sky.wind();
      if (wind) {
        for (const w of windmills) {
          // EV3: the ANGLE always advances (an off-screen mill keeps
          // turning); only the draw itself is gated.
          advanceRotor(w.state, dt, wind);
          if (cullOn && aabbOutside(_planes, w.box)) continue;
          renderer.drawMesh(millParts.rotor, mountRotor(w.matrix, ROTOR_HUB, w.state.angle), texRemap);
        }
      }
      // WM4c: THE HUM. Kamer's Spin_Up loops ArenaFireDaemon on the sail
      // from the moment it exists - LoopOnAwake, no player check - so
      // every mill in the location hums at once and the rolloff sorts
      // them. Retried each frame until the AudioContext is up (the
      // torches' idiom: loop3d answers null before the first gesture),
      // and NOT gated on the wind: his source has no idea what the
      // weather is.
      for (const w of windmills) {
        if (!w.hum) w.hum = audio.loop3d(MILL_SOUND.clip, millSoundPosition(w.matrix), MILL_SOUND.volume, MILL_SOUND);
      }
    }
    if (rig && (riding || params.has('rig'))) {
      if (riding) {
        // Gait from live input over the SAME keys the motor reads;
        // airborne keeps the last grounded gait's look via stand.
        const gmv = moveHeld(keys);
        rig.setGait(anyMove(gmv) ? (held(keys, 'Run') ? 2 : 1) : 3);
      } else rig.setGait(1);   // parked probe rig: the slice-2 walking-in-place semantics
      rig.update(dt);
      const s = rig.scale;
      let px, py, yawDeg;
      if (riding) {
        // Ride the motor: FEET position verbatim (jumps carry the rig),
        // facing = camera yaw (model +z is the body's front).
        px = player.pos[0]; py = player.pos[1]; yawDeg = cam.yaw * 180 / Math.PI;
        rigPos = [px, 0, player.pos[2]];
      } else {
        if (!rigPos) {
          if (params.has('rigNear')) {   // probe affordance: park at the view ray's GROUND intersection so the 9x texel grid is screen-measurable and centered
            const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
            const fl = Math.hypot(f[0], f[1], f[2]) || 1;
            const d = [f[0] / fl, f[1] / fl, f[2] / fl];
            const t = 24;   // fixed: deep enough that a grounded figure fits the frustum below a high near-horizontal vantage
            rigPos = [eye[0] + d[0] * t, 0, eye[2] + d[2] * t];
          } else { const p = player.pos; rigPos = [p[0] + 2, 0, p[2] + 3]; }   // FIXED world placement, captured once at first frame
        }
        px = rigPos[0]; yawDeg = 0;
        py = collider.heightAt(rigPos[0], rigPos[2]);   // grounded through the SAME contract the player stands on - real terrain inherits for free (slice 3)
      }
      const gy = py;
      rigMat = trs(px, gy - rig.liveFootY * s, rigPos[2], 0, yawDeg, 0, s, s, s);   // live support point: feet kiss the ground every frame
      // THE CHARACTER PIXELIZE PASS: shared implementation (C8 E1
      // extraction of slice 4 - characterSprite.js), identical math.
      const diag = drawCharacterSprite(renderer, canvas, rig, rigMat, proj, view, eye);
      if (params.has('shot')) {
        const { center, halfH, pw, ph } = diag;
        const pv = multiply(proj, view);
        const prj = (x, y, z) => { const w = pv[3]*x + pv[7]*y + pv[11]*z + pv[15]; return [ (pv[0]*x + pv[4]*y + pv[8]*z + pv[12]) / w, (pv[1]*x + pv[5]*y + pv[9]*z + pv[13]) / w ]; };
        const cN = prj(center[0], center[1], center[2]);
        const tN = prj(center[0], center[1] + halfH, center[2]);
        const W2 = canvas.clientWidth / 2, H2 = canvas.clientHeight / 2;
        window.__rigGround = { ty: rigMat[13], gy, footY: rig.liveFootY, s, pw, ph,
          scrX: cN[0] * W2 + W2, scrY: H2 - cN[1] * H2, scrHalfHpx: Math.abs((tN[1] - cN[1]) * H2) };
      }
    }
    // Classic Daggerfall billboards rotate about Y only: right from the view,
    // up stays world-Y.
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    if (shotMode) {
      const dx = target[0] - eye[0];
      const dz = target[2] - eye[2];
      const l = Math.hypot(dx, dz) || 1;
      camRight[0] = dz / l;    // HANDEDNESS (mat4's law): right of fwd (dx,dz) is (dz, -dx)
      camRight[2] = -dx / l;
    }
    // C13: exterior arrows fly with the scene meshes (lost on
    // geometry, as DFU misses are).
    // AUDIT 39 (#64): the player's shaft LANDS. It used to fly, spend
    // its Arrow and tally Archery against a live watchman and inflict
    // nothing - the module's foe arm was gated on `m.enemy` and this
    // host resolved no player arrow at all. cityGuards owns the damage
    // door, so a killed watchman still runs the crime and the corpse.
    // (No enemy arm here: this host mounts no bow-armed pool.)
    arrows.update(dt, {
      foeTargets: cityGuards.guards.filter((t) => !t.dead && t.ai).map((t) => ({ feet: t.ai.feet, ref: t })),
      onPlayerArrowHitFoe: (m, t) => playerArrowHitFoe(m, t, {
        playerEntity, playerWeapon: weaponRig.playerWeapon, playerFeet: player.pos,
        dealDamage: (f, d) => cityGuards.hurtGuard(f, d, player.pos),
        audio, hitEffects, say: (l) => townTalk.say(l),
        onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(playerTicker.classicMinutes) }),
      }),
    });
    arrows.draw(renderer, texRemap);
    flatAnims.tick(dt);   // FA1: the town's fires and braziers
    // EV3: per-batch skip off the build-time boxes; the clocks above
    // ticked already, so an off-screen fire keeps its frame.
    _visBatches.length = 0;
    for (const b of billboardBatches) {
      if (cullOn && aabbOutside(_planes, b._box)) continue;
      _visBatches.push(b);
    }
    renderer.drawBillboards(_visBatches, camRight, UP_Y);
    if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, UP_Y);   // M2: spell missiles in flight
    // T1: the wandering townsfolk - population ticks at 10Hz, the
    // politeness idle gate whole (mobilePerson.personWantsToStop),
    // daytime only; live persons render as C11-style mobile batches
    // on the flats' axis. The gate's AreEnemiesNearby() term reads
    // this host's one live pool, the city watch - so a townsperson
    // keeps walking while a guard is on you.
    if (walkMode) {
      _playerStill = _lastPlayerPos !== null &&
        Math.hypot(cam.pos[0] - _lastPlayerPos[0], cam.pos[2] - _lastPlayerPos[2]) < 0.001;
      _lastPlayerPos = [cam.pos[0], cam.pos[1], cam.pos[2]];
      // audit 2026-08-17: DFU pauses the sim under UI windows - the
      // population freezes (dt 0 still returns frames for drawing)
      // while the talk overlay is up, so nobody walks away mid-talk.
      const popDt = townTalk.overlayActive ? 0 : dt;
      const live = !population ? [] : population.update(popDt, cam.pos, cam.yaw, eye, !isNight(minute), (person) => personWantsToStop({
        playerStandingStill: _playerStill,
        distanceToPlayer: Math.hypot(person.pos[0] - cam.pos[0], person.pos[2] - cam.pos[2]),
        sheathed: weaponRig.playerWeapon.sheathed,
        invisible: isInvisible(playerEntity),
        enemiesNearby: () => areEnemiesNearby(cityGuards.guards),
      }));
      _livePersons = live.map(({ person }) => ({ person, pos: person.pos }));   // T3b: the activation ray's targets
      const personBatches = [];
      for (const { person, out } of live) {
        const batch = personBatchOf.get(person);
        batch.archive = person.archive;   // audit 2026-08-17: identity re-rolls per spawn - re-point the batch
        const t = personTex.get(person.archive);
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${person.archive}_${rkey}`)) uploadRecordFrame(person.archive, out.record, out.frame);
        const sz = scaledBillboardSize(t.getSize(out.record), t.getScale(out.record));
        batch.record = rkey;
        batch.size = { w: out.flip ? -sz.w : sz.w, h: sz.h };
        batch.origin = [person.pos[0], person.pos[1], person.pos[2]];
        personBatches.push(batch);
      }
      // G1: the guards drive + draw on the same flats' axis; the sim
      // freezes with the population under the talk overlay.
      const guardBatches = cityGuards.update(townTalk.overlayActive ? 0 : dt,
        walkMode ? player.pos : cam.pos, eye, _foeSenses());
      personBatches.push(...guardBatches);
      droppedLoot.tickFlats(dt);   // FA1 slice 3
      personBatches.push(...droppedLoot.batches());   // U8e: the ground piles
      // AUDIT 24 (wave 39): blood splashes ride the person axis too.
      hitEffects.tick(dt);
      personBatches.push(...hitEffects.batches());
      if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);
    }
    if (precipMode && precip) {   // W1 review: precipMode nulls on a clear-up; the renderer object outlives it
      precip.draw(precipMode, proj, view, new Float32Array(eye), camRight, now / 1000);
      renderer.markForeignPass();   // EV6: so did the rain
    }
    // C9: the exterior FP weapon (first-person walk only - the V
    // third-person view has no FP overlay). Same residuals as the
    // world host: no bashables in melee reach; bows consume + tally
    // and the loose is VISIBLE now (C13).
    if (walkMode && !tpMode) {
      // M2: the armed click's cast fires with the LIVE look; missiles
      // fly through this host's world every walk frame.
      if ((modes?.mode ?? 'exterior') === 'exterior') {
        const _mfwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        magic.firePending([...cam.pos], _mfwd);
        magic.update(dt, player.pos, _mfwd, player.height);   // X11: the candle hangs off the look direction
        { const mv = lycanthropeMoveSound(playerEntity, dt); if (mv != null) audio.playOneShot(mv, 1); }   // LM1: the beast's own noise while transformed (real time)
      }
      // U8h/AUDIT 17e F17: the worn-weapon bind moved INTO createWeaponRig
      // so all four hosts inherit it (the interior host was missing it).
      for (const ev of weaponRig.frame(dt, { paralyzed })) {
        // AUDIT 23 (combat-2): the bow machine's frame-4 loose sound.
        if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
        if (ev !== 'hit') continue;
        if (weaponTypeForItem(weaponRig.playerWeapon.weapon) === WEAPON_TYPES.Bow) {
          if (spendArrow(playerEntity.items)) {
            // AUDIT 23 (C14: hosts-4 = combat-5) - WeaponManager.cs
            // :419-436: the swing costs its fatigue whatever it hits,
            // and a BOW always takes the FULL tally arm (Archery AND
            // CriticalStrike) - this arm tallied Archery alone, free.
            drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
            tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            arrows.fire(eye, fwd, { fromPlayer: true, weapon: weaponRig.playerWeapon.weapon });   // #64: LastBowUsed rides the shaft - the impact prices off it
          }
          continue;
        }
        // C14: the melee swing's fatigue, unconditional - it lived
        // behind cityGuards' no-live-guards early return.
        drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
        // G1: melee swings resolve against live guards (reach + LOS
        // inside resolveHit); a landed hit tallies the weapon skill.
        // G4: no guard hit -> WANDERING townsfolk (civilian one-hit
        // Murder + response; wandering guard NPC -> Assault +
        // conversion with the swing carried onto the fresh foe).
        const guardHitSound = (g) => audio.play3d(hitSoundFor(weaponRig.playerWeapon.weapon), g.ai.feet, 1.1, { maxDistance: 16 });
        // AUDIT 23 (combat-4): the host-side WEAPON_SKILL tallies are
        // GONE - cityGuards.resolvePlayerHit already runs DFU's tally
        // arm (tallySwingSkills), so every connecting swing was
        // double-counted, keyed by the display-name rot AUDIT 18
        // removed elsewhere.
        if (!cityGuards.resolvePlayerHit(weaponRig.playerWeapon, eye, fwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
          cityGuards.resolveCivilianHit(weaponRig.playerWeapon, eye, fwd, player.pos, _guardPool(),
            { onMurder: () => _crimeResponse(), onHitSound: guardHitSound }).then((r) => {
            if (r?.carriedHit) tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            if (r) surfacePlayer();
            // AUDIT 23 (C9) - WeaponManager.cs:423-424: the no-enemy
            // swing sound at the hit frame (the rig's entry whoosh is
            // gone); a swing that found neither guard nor civilian.
            else audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);
          }).catch((e) => console.error('[civil]', e));
        }
      }
      weaponRig.draw({ paralyzed });
    }
    // AUDIT 21 (hosts lane, F7): THE HUD, which this host did not have.
    //
    // ?world and ?exterior drew no status bar at all - no health, no fatigue,
    // no magicka, no compass. Guards can hurt you here, falls can hurt you,
    // fatigue drains every classic minute and diseases drain attributes, and
    // you could see none of it. Walk into the dungeon and the whole classic
    // HUD appears; walk out and it vanishes.
    //
    // ui/hud.js was already host-agnostic - drawHud(renderer, canvas, art,
    // vitals, heading01) - so this is the art loaded once and drawn last,
    // over the viewmodel, exactly as dungeonContext draws it. Under the talk
    // layer, because a talk window is a modal above the vitals.
    // AUDIT 39: THE CALL IS UNCONDITIONAL. drawHud runs the damage
    // flash and the enhanced DOM HUD ABOVE its own `!art` return
    // (hud.js:377-402) because neither reads ARENA2 - "a player whose
    // HUD art failed to load still has vitals". Wrapping the whole
    // call in `if (hudArt)` inverted that: hudArt starts null and is
    // filled by a fire-and-forget load whose failure leaves it null
    // forever.
    {
      const _hfw = [-view[2], -view[10]];
      // X4: the Detect markers. This host's nearby pool is the city
      // guards - the only entities it spawns - and, since FX1 (F207),
      // the world piles and guard corpses: DFU's loot walk has no
      // scene gate.
      const _dFeet = detectFeet();
      const _detected = detectFeed.tick(dt);
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1, dt,
        { font: townTalk.font, cursorActive: townTalk.overlayActive || (modes?.overlayHeld ?? false),
          detected: _detected, playerXZ: [_dFeet[0], _dFeet[2]],
          largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity),
          weaponSheathed: !!weaponRig.playerWeapon.sheathed });   // AUDIT 28 W2: the arrow counter's drawn-bow gate   // U38 + X4 + U43
    }
    townTalk.frame(dt);   // T3b: HUD lines + the talk overlay, above everything

    frames++;
    if (shotMode) window.__frame++;   // T1: probes frame-sync (the process doctrine - sleeps sample stale state). AUDIT 17e F37: INCREMENT - assigning `frames` undid worldModes' modal-frame increments, so the counter ran backwards after an overlay and frame-synced probes stalled.
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
