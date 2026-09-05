// Exterior location scene: a full location assembled on the block grid.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).

import { getFloat } from '../systems/settings.js';   // AUDIT 28 W1: NightAmbientLightScale
import { SKY_CLEAR } from '../render/renderer.js'; import { centreFromFeet } from '../characters/enemyAnchor.js';   // REVIEW 2026-09-05: one line, so the cites below it hold
import { FlatAnimator, armFlatAnim } from '../render/flatAnimation.js';   // FA1: the flats that move
import { racialSuppressPopulationSpawns, racialSuppressInventory, racialSuppressTalk, lycanthropeMoveSound } from '../systems/lycanthropy.js';   // V4: the transformed gates; LM1: the 4-20s move-sound loop
import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook, makeLookGate, bindCursorToggle } from '../player/pointerLock.js';   // U45: bindCursorToggle is PlayerMouseLook.cursorActive
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile, longitudeLatitudeToMapPixel, REGION_RACES, LOCATION_TYPES } from '../formats/mapsFile.js';   // QX1: GetRaceOfCurrentRegion   // AUDIT 58: LOCATION_TYPES for the graveyard ambient arm
import { isPlayerInTown } from '../systems/nearbyObjects.js';   // PlayerGPS.IsPlayerInTown, both optional flags
import { giveOffer } from '../ui/pendingOffer.js';   // AUDIT 58: DaggerfallUI.GiveOffer, the rung in front of the rest press
import { convertTilemap, isOutdoorWaterTile } from '../world/terrainSurface.js';   // FD1: PlayerTileMapIndex == 0
import { GROUND_OFFSET, GROUND_TILE_DIM } from '../world/rmbLayout.js';
import { PlayerMotor, startRestGroundedCheck } from '../player/motor.js';   // the rest gate's grounded input, one home
import { exteriorSurfaces, downProbe, rayDistanceFor, ON_EXTERIOR_WATER } from '../player/exteriorSurface.js';   // ROAD-B (b3): PlayerMotor's three exterior surface methods
import { isOnFoot } from '../systems/transport.js';   // TransportManager.IsOnFoot - the raycast's reach and the mounted footstep gate
import { jumpSpeedMultiplier, tallySkill, SKILLS } from '../systems/skills.js';
import { createWeaponRig } from '../combat/weaponRig.js';
import { racialRestBlock } from '../systems/vampirism.js';   // V2b: the vampire's rest gate
import { ArrowFlight, playerArrowHitFoe } from '../combat/arrowFlight.js';   // C13: visible exterior arrows; AUDIT 39 (#64): and the shaft that LANDS
import { inflictPoison } from '../systems/poisons.js';   // AUDIT 39 (#64): a poisoned shaft doses its mark
import { addItem, spendArrow, carriedWeight } from '../systems/inventory.js';   // E4: PlayerEntity.CarriedWeight carries the gold counter's own term; ROAD-G G2: BowDamage's recoverable shaft
import { calculateAttackDamage } from '../combat/formulas.js';   // ROAD-G G2: enemy-arrow impacts
import { flashPlayerDamage } from '../ui/damageFlash.js';   // ROAD-G G2: an arrow owes the flash too (AUDIT 24 wave 46)
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { playerEntity, surfacePlayer, hurtPlayer, setDeathPresenter, setAvoidDeathHook } from '../characters/playerEntity.js';
import { SOUND } from '../systems/soundClips.js';
import { Collider } from '../player/collider.js';
import { mwViewFrame, mwViewWheel, mwViewDrawBody } from '../player/mwView.js';   // MW-D25: the Morrowind camera
import { PITCH_LIMIT } from '../player/mwCamera.js';   // MW-D30: camera.cpp:323-331's own clamp
import { getStaticDoors } from '../world/staticDoors.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
import { setDefaultEnchantCtx } from '../systems/enchantments.js';   // AUDIT 58 (f2/hosts): the session's ONE enchant ctx - this host mounted none
import { createEnchantCtx, standLooseFoe, LOOSE_FOE_PLACE_ATTEMPTS } from './hostEnchant.js';   // FS1 (wave D): the ONE ctx body + SD1's loose-foe placement
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1: the lights the PLAYER carries
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { applyClimate, getTerrainGroundArchive, getNatureArchive, climateSeasonFromMinutes, INTERIOR_SEASON } from '../world/climateSwaps.js';   // A1: the season is the calendar's, and an interior's is Summer whatever the date
import { RMB_SIDE, layoutLocation, hasCustomLocationPosition } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, mirrorProjectionX, transformPoint, trs, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { frustumPlanes, aabbOutside, localAabb, transformedAabb, flatBatchAabb, cullDisabled } from '../render/frustum.js';   // EV3: the frustum
import { withMoonAmbient } from '../render/enhancedSky.js';   // EV5: secunda rides the ambient
import { drawCharacterSprite } from '../render/characterSprite.js';
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { isBulletinBoard } from '../world/rmbLayout.js';   // RMBLayout.cs:1013-1017 - the one model id a town sign wears
import { collectExteriorNpcs, exteriorNpcRecord } from '../characters/exteriorNpcs.js';   // C2 / AUDIT 26: RMBLayout's street StaticNPCs
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { audio } from '../systems/audio.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { createWeatherFront, blendTerms, soundWeather } from '../systems/weatherFront.js';   // WX2: the front reaches the ground
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4
import { CityNavigation } from '../world/cityNavigation.js';   // T1 towns
import { TownPopulation } from '../systems/townPopulation.js';
import { GUARD_TEXTURE, MobilePerson, PERSON_TEXTURES, personWantsToStop } from '../characters/mobilePerson.js';
import { createTownTalk } from './townTalk.js';   // T3b
import { createPlayerMagic } from './hostMagic.js';   // M2: spellcasting above ground
import { preloadSpellbookArt, spellbookArtLoaded } from '../ui/spellbookWindow.js';   // U42: the classic art window (retires M2's keyed stand-in)
import { createSpellbookWindow } from '../ui/spellbookDoor.js';   // PX23: the book's one door
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C2): the ONE clock
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS, playerPainVoice, playPlayerVoice, makeEnemiesHostile } from './hostCombat.js';   // AUDIT 23 (C14); QX1: GameManager.MakeEnemiesHostile, the quest action's door
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { RestWindow, preloadRestArt } from '../ui/restWindow.js';   // S40: rest above ground   // D3: REST00I0/01I0/02I0
import { setEnemyAlert, areEnemiesNearby, intermittentEnemySpawn, passiveGuardSpawns } from '../systems/encounters.js';   // ROAD-G TAIL: the catch-up loop's two rolls   // the enemy arm RAISES the alert before refusing; the RESTING variant asks the pool, the STRICT one gates the townsfolk idle
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5): the collapse box
import { healthStatusRows, statusInfoRows } from '../systems/healthStatus.js';   // BS1/F198: the Status health box
import { maxFatigue } from '../systems/statMods.js';   // AUDIT 23 (C5)
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { rangedDamageSpells } from '../systems/spellcast.js';   // U42: the flight probe's picker
import { seasonValue, dateFromClassicMinutes, dateTimeString, midDateTimeString } from '../systems/gameDate.js';   // AUDIT 23 (wts-1); QX1: the notebook's header shapes
import { getNameBankOfRegion } from '../characters/nameHelper.js';   // AUDIT 23 (characters-5)
import { createHitEffects } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { createCityGuards } from './cityGuards.js';   // G1
// ROAD-G G2: the encounter pool's ONE factory - the same one the
// streaming world host and the interior host mount. See the mount
// below for what stands foes in it on this route.
import { createExteriorFoes } from './exteriorFoes.js';
import { createArrestFlow } from './arrestFlow.js';   // G2
import { makeInView } from '../player/cameraView.js';   // AUDIT 17e F24
import { pickActivatable, pickQuestFoe } from '../player/activate.js';   // G3: corpse loot; QG1/ROAD-G G2: the foe-click door; TI1: the lock-on pick
import { preloadCharSheetArt } from '../ui/charsheet.js';   // AUDIT 44 (a11): a level-up opens the SHEET (dfuiOpenCharacterSheetWindow), through this host's makeCharSheetWindow
import { createCharSheetWindow, charSheetDoorReady } from '../ui/charSheetDoor.js';   // U52: the sheet's ONE seam, and the skin fork in front of it
import { restDecision, getPreventedRestMessage } from '../systems/restSession.js';   // U48: the DISPATCH (DaggerfallUI.cs:651-688) above the rest window   // ROAD-B B5: GetPreventedRestMessage
import { preloadQuestJournalArt } from '../ui/questJournal.js';   // U43: the LogBook and NoteBook doors   // QX1 dropped the unused `QuestJournalWindow` beside it - the classic window is reached through the chronicle door, never constructed here
import { createChronicleWindow } from '../ui/chronicleDoor.js';   // QX1/PX24d: the chronicle's ONE door - the skin fork lives behind it, and its classic arm IS the art gate
import { makeOpenBookHook, preloadBookArt } from '../ui/bookReader.js';   // B1
import { DeathScreen } from '../ui/deathScreen.js';   // AUDIT 21 hosts F6: dying above ground
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the classic HUD, which this host did not draw
import { largeHudOptions, routeLargeHudClick, hudLargeNextMode, hudLargePrevMode, activeMouseOverLargeHUD, trackLargeHudPointer } from '../ui/hudLarge.js';   // U45: the classic bottom bar and its eleven panels; ROAD-Ar: and the guard that stops them being world clicks too
import { largeHudViewportRect, largeHudWorldAspect } from '../ui/hudLarge.js';   // ROAD-E E5: ViewportChanger - the docked bar shrinks the world pass
import { createLockOn, LOCK_PICK_DISTANCE, pickFoeNearRay } from '../player/lockOn.js';   // TI1: touch lock-on
import { rayDirFromScreen, projectToScreen, ndcFromScreen } from '../player/tapRay.js';   // TI1: the finger's ray and the dot
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { getInteractionMode } from '../player/interactionMode.js';   // U45: the mode panel's cycle reads it
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
import { preloadInventoryArt } from '../ui/nativeInventory.js';   // U8d: the native inventory
import { createInventoryWindow, inventoryDoorReady } from '../ui/inventoryDoor.js';   // U53: the pack's ONE seam, and the skin fork in front of it
import { createDroppedLoot, droppedLootHooks, containerDropPos } from './droppedLoot.js';   // U8e: the ground piles; G5: the pile's DaggerfallLoot identity
import { preloadPaperDollArt } from '../ui/paperDoll.js';   // U8f: the avatar base
import { seedStartingEquipment, EQUIP_SLOTS } from '../systems/equip.js';   // U8h: the worn-weapon binding
import { createChargenFlow, createChargenWindow, finishChargen, loadSpellIndex, applyHeadlessChargen } from '../systems/chargenSession.js';   // S3c/U9
import { preloadChargenArt } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { buildingDataForDoor } from '../systems/talkTopics.js';   // E2: the shop identity
import { hitSoundFor, swingSoundFor, ENEMY_HIT_VOLUME, PLAYER_HIT_VOLUME } from '../systems/soundClips.js';   // AUDIT 58: DFU's two hit volumes
import { isInvisible, entityIsParalyzed } from '../systems/effects.js';   // AUDIT 39: the S19 gate is host-agnostic in DFU
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD } from '../systems/soundClips.js';
import { ChoiceWindow } from '../ui/talkWindow.js';   // V1: the infection popup's box
import { startInfection, liveInfection } from '../systems/infection.js';   // V1 probe surface: the bite and the lifecycle
import { diseaseCount } from '../systems/diseases.js';
import { MINUTES_PER_DAY } from '../systems/gameDate.js';
import { spellRecordOfIndex } from '../systems/loot.js';   // QG1: CastSpellDo's classic-record read (the G4 registry) - world.js:110's import
import { fetchBytes, loadMagicRegistries, seasonOverride, createSkyController, createPlayerTicker, createRestDeps, plainLines, wireInfectionVideos, createMusicDirector, motorStats, climbingDeps, createDetectFeed, foeNearbyRecord, lootNearbyRecord, nearbyLootRecords, claimFrame, frameAlive, frameHeld, applyFallLanding, ensureAudio, applyMotorEffectFlags, populatesWanderingNpcs, endRunToTitleMenu, exitToTitleMenu, subscribeFoePools, sensesContext, routeMouseDrag, liveEnchantFoes, liveEnchantFoeSinks, enchantFoeHost } from './shared.js';   // AUDIT 58 (f2/hosts): the live enchant pool, its sinks router and the membership question
import {
  WEATHER_TYPES, fogForWeather, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
// WM2b: the windmill's law, and the vendored rotor it turns.
import { ROTOR_HUB, rotorPhase, advanceRotor, mountRotor, MILL_SOUND, millSoundPosition } from '../world/windmills.js';   // WM4c: and the hum
import { BODY } from '../world/windmillMesh.js';   // WM2d: the tower, for the collider
import { remapSubMeshes } from '../world/texRemap.js';   // WM3: the one climate/dungeon remap seam
import { isEnhanced } from '../systems/uiSkin.js';
import { labWindSlider } from '../render/labGrass.js';   // GR2: the sky's wind on the lab's slider
import { PrecipitationRenderer } from '../render/precipitation.js';
import { setWeather, currentWeather, tickWeather, weatherJumpStamp } from '../systems/weatherSim.js';   // W1: the live weather state
import { SEASON } from '../world/climateSwaps.js';
import { addGold, goldAmount, totalGoldAmount, deductGold, deductGoldPieces, setCrimeCommitted, legalRepOf, changeLegalRep, CRIMES } from '../systems/court.js';   // U10 probe surface; V4: the one crime setter; QX1: the quest layer's gold, legal-rep and crime doors
import { lookScale, lookInvert } from '../ui/lookSettings.js';   // SETT: MouseLookSensitivity + InvertMouseVertical
import { LookFilter } from '../player/lookFilter.js';   // AUDIT 28 W7: MouseLookSmoothingFactor
import { MoveAxes } from '../player/moveAxes.js';   // AUDIT 28 W8: MovementAcceleration
import { CameraRecoiler } from '../player/cameraRecoiler.js';   // AUDIT 28 W9: CameraRecoilStrength
import { HeadBobber } from '../player/headBobber.js';   // AUDIT 28 W10: HeadBobbing
import { lastHealthLost, lastHealthLostPercent } from '../ui/hudVitals.js';   // AUDIT 28 W9: the detector's loss
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { actionOf, held, moveHeld, anyMove, swallowBrowserKey, mouseCode } from '../ui/input.js';   // I2: the rebindable registry; AUDIT 39r: the mouse half of the held set
import { createActivateGate, activateFrame, setClickDelay } from '../systems/activateGate.js';   // A8: PlayerActivate's ActivateCenterObject frame
import { openPauseFlow, preloadPauseFlowArt, pauseDoorReady } from '../ui/pauseDoor.js';   // I3/I4; U51 picks the skin
import { openPixelDial } from '../ui/pixelDial.js';   // PX15b: the Tab compass rose
import { ExteriorAutomapWindow, stampResidenceQuestNames, registerExteriorAutomapConsoleCommands } from '../ui/exteriorAutomapWindow.js';   // A2: the town map on M; QX1/ROAD-D D5: the quest-residence plate name; E3: ExteriorAutoMapConsoleCommands
import { installConsoleProbe } from '../systems/consoleCommands.js';   // E3: the console's door
import { buildingSummaries } from '../world/buildingSummaries.js';   // ROAD-C c2/S10: the plate anchor's Position-bearing walk
import { ServiceFlowWindow } from '../ui/guildServiceWindows.js';   // ROAD-C c2/S10: the plate rename's input box
import { discoveredBuildings, setDiscoveredBuildingCustomName, discoverLocation } from '../systems/discovery.js';   // A2: the nameplates' gate; c2/S10: the plate rename; QX1: RevealLocation's filing
import { activeMemberships } from '../systems/guilds.js';   // F117
import { avoidDeath, AVOID_DEATH_TEXT } from '../systems/guildServices.js';   // F117: Stendarr
import { dungeonLocationFor } from '../world/smallerDungeons.js';   // QX1/AUDIT 28 F-B2: the quest layer sees the SIZED dungeon
import { ensureFactionRep, getReputation, changeReputation } from '../systems/factionRep.js';   // QX1: the quest layer's reputation doors
import { findFactions, findFactionByTypeAndRegion, getPeopleOfCurrentRegion, getCourtOfCurrentRegion } from '../systems/talk.js';   // QX1 review: Person.cs's faction-type reads, over the PERSISTENT store
import { FACTION_TYPES } from '../formats/factionFile.js';   // QX1 review: GetRegionFaction's Province filter
import { liveVampirism } from '../systems/racialLive.js';   // QX1 review: the PC's clan, off the curse entry
import { mintQuestFoeWave, placeFoeEnv, entityOccupancy, questFoeGender } from './questFoeHost.js';   // QX1 review/B1: the data side of CreateFoeGameObjects; ROAD-G G2: and the placement side
import { placeFoeFreely } from '../systems/quest/sceneMount.js';   // ROAD-G G2: CreateFoe's raycast ring
import { ENEMY_BASICS } from '../characters/enemyBasics.js';   // ROAD-G G2: FinalizeFoe's Flying lift reads the behaviour flag
import { isHouseOwned } from '../systems/banking.js';   // QX1/H1: Place.SetupSites' residence filter
import { generateBuildingName } from '../world/buildingNames.js';   // QX1/IH1: %cbd regenerates the current building's name
import { createQuestBridge, tokensToRows } from './questBridge.js';   // QX1: THE QUEST MACHINE, in the fixed-city host
import { QuestAudioSource } from '../systems/audio.js';   // QX1/E6: PlaySound's ONE source per machine
import { WORLD_CONTEXT, makeAnchor, teleportPlan, ANCHOR_MUST_BE_SET } from '../systems/teleportAnchor.js';   // TP2/A10: the Recall anchor's law - shape, IsSameInterior, the plan, and the 4001 record id
import { locationWorldRect } from '../world/streamingWorld.js';   // TP2: the native frame this host's origin stands at
import { GLOBAL_SCALE } from '../world/meshReader.js';   // TP2: scene units <-> native world units

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
  // QX1 - THE QUEST PACK, loaded WITH the rest of the location's data
  // and not later. The bridge itself cannot be built until the clock,
  // the talk seam and the guard pool exist, far down this boot, but
  // the AWAIT belongs here: `?world` crashed on a click taken during
  // its own `await loadQuestPack()` (the pointerdown note below), and
  // the cure for that shape is not to add a second await between this
  // host's listeners and its `modes` declaration when the load can sit
  // in front of both. Vendored files, no network - `loadQuestPack` is
  // one shared promise however many hosts ask.
  //   DYNAMIC, not a static import: `questData.js` is built on Vite's
  // `import.meta.glob`, a compile-time transform that simply does not
  // exist under bare node, and a static import would drag THIS FILE out
  // of test/moduleload_smoke.test.js's importable set - the one test
  // that RUNS this host's module body rather than reading it as text,
  // and the test written after a boot failure that every text pin
  // missed. world.js is on that exclusion list for exactly this import;
  // one line of `await import` keeps this host off it.
  const { loadQuestPack } = await import('./questData.js');
  const questPack = await loadQuestPack();

  // Assemble the location.
  const dfLocation = maps.getLocationByName(regionName, locationName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${locationName}`);
  status(`laying out ${locationName}`);
  // AUDIT 39 (#18): the skin reaches the layout, because the mill's
  // subrecord widens the block's building count and must not exist on
  // the classic one.
  const loc = layoutLocation(dfLocation, maps, blocks, { enhanced: isEnhanced() });

  // Climate + season: swap every submesh archive exactly as DFU's
  // MaterialReader.ChangeClimate does - pixels from the swapped archive,
  // UVs from the original (the SetDungeonTextures pattern).
  // A1: THE TEXTURE SEASON IS THE CALENDAR'S, NOT A URL PARAM.
  // DaggerfallLocation.ApplyTimeAndSpace (:135-139) reads
  // DaggerfallUnity.WorldTime.Now.SeasonValue and answers Winter or
  // Summer; ?season demotes to a debug PIN (the ?cull=off shape).
  // `let` because two consumers below poll the clock the way the
  // reference does - PlayerFootsteps (:107, :122-133) and
  // SetSunlightScale (WeatherManager.cs:316-319). What this host
  // BUILDS is skinned once: it assembles the whole location up front
  // and has no per-pixel teardown to rebuild it through, so
  // DaggerfallLocation.Update's in-place re-skin lives in the
  // streaming host (world.js tickSeason).
  const seasonPin = seasonOverride(params);
  let season = seasonPin ?? climateSeasonFromMinutes(worldMinutes());
  let _seasonDay = Math.floor(worldMinutes() / MINUTES_PER_DAY);
  /** The season poll both live consumers ride. SeasonValue can only
   *  move on a day boundary (GetSeasonValue reads Month), so a frame
   *  inside the same day costs one division. */
  function refreshSeason() {
    if (seasonPin !== null) return;   // ?season pins the world for a shot
    const day = Math.floor(worldMinutes() / MINUTES_PER_DAY);
    if (day === _seasonDay) return;
    _seasonDay = day;
    const want = climateSeasonFromMinutes(worldMinutes());
    if (want === season) return;
    season = want;
    weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);   // SetSunlightScale's winter arm
  }
  const climateBase = dfLocation.climate.climateType;
  // FS-slice: the location's raw CLIMATE.PAK index (the snow gate reads it)
  const _locPixel = longitudeLatitudeToMapPixel(dfLocation.mapTableData.longitude, dfLocation.mapTableData.latitude);
  const locClimateIndex = maps.getClimateIndex(_locPixel.x, _locPixel.y);
  const footsteps = new FootstepMachine();
  const groundArchive = getTerrainGroundArchive(dfLocation.climate, season);   // the TERRAIN member, Desert winter-guarded (TerrainMaterialProvider.cs:126-133)
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
  let weatherFog = fogForWeather(weather, sky.fogSettings);   // DS1: WeatherManager's fog settings are the mod's while Dynamic Skies is the sky
  let weatherSkyOffset = skyOffsetForWeather(weather, weatherSeed);
  let weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
  let precipMode = precipitationForWeather(weather);
  // AUDIT 58 (f3/render): the rain's two DIALS, read once at boot from
  // the params this host already carries. `enhanced` is the LANE - the
  // sky controller's own answer (scenes/shared.js createSkyController),
  // fixed for a scene - so the enhanced lane compiles WX1's program in
  // the constructor (a shader fault stays a constructor fault) and the
  // classic lane never compiles it at all. `countCap` is ?rain=<n>, a
  // gate dial that cannot change during a page load: it was being read
  // by constructing a URLSearchParams and re-parsing location.search on
  // EVERY frame that rain, storm or snow drew, one step above the pass
  // EV2 swept for exactly this class of per-frame garbage.
  const precipOpts = { enhanced: sky.enhanced, countCap: Number(params.get('rain')) || null };
  if (sky.pixelSnow) precipOpts.pixelSnow = sky.pixelSnow;   // DS1: Dynamic Skies' InitSnow - the pixel snow replacement, when its switch is on
  let precip = precipMode ? new PrecipitationRenderer(renderer.gl, precipOpts) : null;
  let lightning = weather === 'thunder'
    ? new LightningPlayer(Number(params.get('wseed')) || 1) : null;
  // WX2: the front reaches the ground - world.js's twin note. This host
  // has no grass, so its dim is 1; the sun scale, the fog row and the
  // drops cross on the front under the enhanced sky, and the classic
  // path takes the row's own numbers whole.
  const weatherFront = createWeatherFront({ seed: Number(params.get('wseed')) || 7 });
  const weatherTerms = () => ({ sun: weatherSun, dim: 1, fog: weatherFog });
  let wxNow = weatherTerms();
  let wxFrom = wxNow;
  let seenJump = weatherJumpStamp();   // WX2a: the sim's jump stamp as this host last saw it
  function applyWeather(w) {
    weather = w;
    weatherFog = fogForWeather(w, sky.fogSettings);   // DS1
    weatherSkyOffset = skyOffsetForWeather(w, weatherSeed);
    weatherSun = weatherSunlightScale(w, season === SEASON.Winter);
    precipMode = precipitationForWeather(w);
    if (precipMode && !precip) precip = new PrecipitationRenderer(renderer.gl, precipOpts);
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
  const buildingDoors = []; // {door, dfBlock, recordIndex, climateBase, season (A1: INTERIOR_SEASON), dfLocation, group}
  const flatGroups = new Map(); // "archive_record" -> [centers]
  const ambientAnimals = [];    // A4: archive-201 town animals as audio sources
  const exteriorNpcFlats = [];  // AUDIT 26 (F019): the flats RMBLayout stands as StaticNPCs
  const bulletinBoards = [];    // the blocks' BULLETIN BOARDS (model 41739), world-frame boxes
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
      // THE BULLETIN BOARDS. RMBLayout stands model 41739 STANDALONE
      // (:857, :935) so it can carry DaggerfallBulletinBoard (:966-970)
      // - the component PlayerActivate's ray looks for (:393-398).
      // World-frame here, like this host's doors and its street NPCs.
      if (isBulletinBoard(placed.modelIdNum)) {
        const b3 = transformedAabb(archAabb(placed.modelIdNum, cpu.positions), matrix);
        bulletinBoards.push({ min: [b3[0], b3[1], b3[2]], max: [b3[3], b3[4], b3[5]] });
      }
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
            // A1: DaggerfallInterior.cs:51 declares `climateSeason =
            // ClimateSeason.Summer` and never assigns it - a reference
            // interior is summer-skinned in the depths of Evening Star.
            climateBase, season: INTERIOR_SEASON, dfLocation, group: 'loc',
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
  const tilemapBytes = convertTilemap(locationTilemap);
  const tilemapTex = renderer.uploadTilemapTexture(tilemapBytes, tilemapDim);
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

  /** ROAD-B (b3): PlayerMotor.Update's three exterior surface reads
   *  (:367-369), this host's twin of world.js's - one downward
   *  raycast from the controller centre plus the tilemap byte above.
   *
   *  The raycast's job is the ship/levitation case its own doc comment
   *  names (:501-503): being ABOVE water is not being IN it. The two
   *  surfaces split the same way here as in the streaming host - the
   *  flat GROUND_OFFSET floor is the terrain (DaggerfallTerrain) and
   *  every placed model is a collider mesh (the StaticGeometry tag) -
   *  so a player on a building roof reports static geometry and no
   *  water, whatever tile is painted under the building. */
  const _SURFACE_DOWN = [0, -1, 0];
  const exteriorSurfaceNow = () => {
    const cy = player.pos[1] + player.height / 2;   // transform.position on a CharacterController
    const rayDistance = rayDistanceFor(isOnFoot(player.transportMode));
    return exteriorSurfaces({
      inside: false,
      rawTile: playerGroundTileRaw(),
      waterWalking: !!player.waterWalking,   // PlayerEntity.IsWaterWalking (:590)
      probe: downProbe({
        centreY: cy,
        terrainY: collider.heightAt(player.pos[0], player.pos[2]),
        meshDist: collider.raycast([player.pos[0], cy, player.pos[2]], _SURFACE_DOWN, rayDistance * 2),
        rayDistance,
      }),
    });
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
  //   - E3: RMBLayout's THIRD act on one of these flats
  //     (`QuestMachine.Instance.SetupIndividualStaticNPC(go,
  //     obj.FactionID)`, :377/:453) still takes DFU's empty-machine
  //     answer here, and QX1 CHANGED WHY. This host has a quest bridge
  //     now (below, at `questBridge = createQuestBridge`) - what it
  //     does not have is one at LAYOUT: the bridge needs the clock,
  //     the talk seam and the guard pool, none of which exists until
  //     long after this loop, and DFU's layout can always ask because QuestMachine
  //     is a scene singleton. world.js survives the same ordering by
  //     re-running the pass idempotently when its bridge lands - and it
  //     can only do that because it keeps the NPC flats OUT of the
  //     pixel's billboard batches on purpose (`if (npcFlatSet.has(flat))
  //     continue;`, world.js:819) and stands them in batches of their
  //     own over the ACTIVE set. THIS host builds one batch per
  //     (archive, record) for the WHOLE city, up front, with every
  //     street NPC's center already inside it (the batch loop above), and
  //     the away arm's entire observable half is `SetActive(false)` -
  //     the home copy of an individual a live quest has placed elsewhere
  //     leaving the draw AND the activation ray. world.js's own sentence
  //     for why it splits them is the reason this cannot be bolted on
  //     here: "a center already inside a built batch cannot leave one."
  //     So every street NPC stands and none carries a behaviour, which
  //     is exactly C#'s answer with no individual placed away; closing
  //     it is a change to this route's ONE location batch, not to the
  //     quest layer. `scenes/world.js`'s standPixelNpcs is the pass with
  //     a machine behind it.
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
  const player = new PlayerMotor(collider, motorStats(playerEntity), { jumpBoost: () => jumpSpeedMultiplier(playerEntity), carriedWeight: () => carriedWeight(playerEntity), climbing: climbingDeps(playerEntity, (l) => townTalk?.say(l)) });   // AcrobatMotor skill jump (P14) + M3 climbing; motorStats = the LIVE entity (PlayerSpeedChanger reads LiveSpeed/Running/Swimming every step)
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
        enemiesNearby: areEnemiesNearby([...(cityGuards?.guards ?? []), ...(exteriorFoes?.foes ?? [])]),   // ROAD-G G2: BOTH street pools, world.js:1392's line
        swimming: !!player.swimming, entity: playerEntity,
        day: !isNight(minuteNow()), inside: false,
      });
      // RSC 1071/1072 pend the reader in this host; classic strings fall back.
      const lines = out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.'];
      // ROAD-B B5: a PUSH. PlayerEntity's OnExhausted handler is a plain
      // DaggerfallUI.MessageBox, and DaggerfallUI.MessageBox is
      // `new DaggerfallMessageBox(...); mb.Show()` -> uiManager
      // .PushWindow (DaggerfallUI.cs:1330-1360) - it has never asked
      // whether something else is open. Collapsing from exhaustion
      // WITH A WINDOW UP is not exotic: the fatigue drain runs through
      // the inventory, the map and the spellbook alike, and the
      // refusal meant the one message that explains the lost hour (or
      // the drowning) was dropped.
      townTalk.pushOverlay(new ActionTextBox(lines));
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
      townTalk.showOverlay(makeCharSheetWindow());   // dfuiOpenCharacterSheetWindow (RaiseSkills :1414)
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
    // AUDIT 58 (talk lane): the mode keys sit UNDER the window gate, and
    // this host's second slot is the mode machine's - a window held
    // there is invisible to townTalk's own `overlay`. `modes` is
    // declared below, so the read is deferred (the regionIndex idiom).
    otherOverlayActive: () => modes?.overlayHeld ?? false,
  });
  townTalk.ensureLoaded();
  /** THE GAME PAUSE for this host - ONE composition, asked of the
   *  stacks and never re-derived.
   *
   *  DFU has ONE UserInterfaceManager, so the question "is a window
   *  holding the world?" has one answer there: the pause AddWindow
   *  raised (UserInterfaceManager.cs:179-186 ->
   *  GameManager.PauseGame(true), GameManager.cs:600-635) and
   *  RemoveWindow has not yet lowered (:190-216). The port gives each
   *  modal host its own stack, so this host's answer is the union of
   *  the stacks that can be live over its frame: townTalk's street
   *  window and the mode machine's interior/dungeon window. BOTH terms
   *  are those hosts' own `paused()` (townTalk's `talkPaused`,
   *  worldModes' `interiorPaused`, dungeonContext's `dungeonPaused`) -
   *  the union is all this host adds, and it adds it once.
   *
   *  `modes?.` because the mode machine is built further down and the
   *  event handlers that ask this are bound before it exists. */
  const gamePaused = () => townTalk.overlayActive || (modes?.overlayHeld ?? false);
  preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: INFO00I0 warms at boot
  preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));   // I3/I4
  preloadBookArt({ renderer, fetchBytes, palette });   // B1: BOOK00I0 warms at boot
  preloadQuestJournalArt({ renderer, fetchBytes, palette });   // U43: LGBK00I0 warms at boot, so L / N / the pause Chronicle open on the FIRST press
  preloadRestArt({ renderer, fetchBytes, palette });   // D3: REST00I0/01I0/02I0 for the rest window's two pages
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
  // S3d retired the dagger seed outright: systems/startingGear.js is
  // ItemHelper.AssignStartingGear verbatim (ItemHelper.cs:1277-1364)
  // and every character who runs chargen gets that kit. The call
  // below cannot fire from this host either - chargenDone is false
  // for the whole boot walk (the wizard is mounted further down, and
  // a save's chargenDone arrives after the walk), and were it ever
  // true the bag is already non-empty and seedStartingEquipment
  // early-returns (equip.js:289).
  if (playerEntity.chargenDone) seedStartingEquipment(playerEntity);
  // S3c/U9 / THE FOUR HOSTS RULE: chargen lived only in the dungeon
  // host, so booting straight into a town left the player on the
  // pre-chargen stand-in entity (flat skills 30, maxHealth 50) for
  // the whole session. Both exterior hosts now run it through the
  // shared session - the ?class arm and the real flow just below,
  // both out of systems/chargenSession.js - and the paperdoll
  // reloads on the chosen identity.
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
    // ROAD review-p: a PUSH, like the two interior hosts - see the
    // world host's copy of this seam. VampirismInfection.cs:186-188 is
    // DaggerfallUI.MessageBox + Show(), i.e. PushWindow
    // (DaggerfallUI.cs:1352-1358), and a replacement here would
    // dispose whatever the player had open when they turned.
    showText: (lines) => townTalk.pushOverlay(new ChoiceWindow({ lines })),
    factionDict: () => townTalk.factionDict ?? null,
  });
  // QX1: InitAtGameStart runs ONCE when a NEW character finishes
  // chargen (StartGameBehaviour's OnStartGame path), world.js's own
  // shape and for its own reason - chargen resolves asynchronously and
  // the bridge is composed further down the boot, so the moment is
  // RECORDED and fired by whichever side is ready last. An already-made
  // character (chargenDone at boot) is a continuing session, not a new
  // game, and takes no init - exactly as DFU raises OnStartGame from the
  // starting flows alone.
  let questBridge = null;
  let _questStartPending = false, _questStarted = false;
  const questInitAtGameStart = () => {
    if (_questStarted) return;
    if (!questBridge) { _questStartPending = true; return; }
    _questStarted = true;
    questBridge.initAtGameStart();
  };
  /** QX1: the two journal seams a character sheet and an F5 journal
   *  take. charSheetHooks' LOGBOOK filter asks only that both were
   *  handed over, so this answers the EMPTY object while the bridge is
   *  still composing - the button is withheld rather than opened onto a
   *  log nothing can fill. dungeonContext's `questJournalHooks` is the
   *  same shape off its own `opts.questBridge`. */
  const questJournalHooks = () => (questBridge ? {
    questMessages: () => questBridge.machine.getAllQuestLogMessages() ?? [],
    notebook: () => questBridge.notebook ?? null,
    // ROAD-G G2 (c): HandleQuestClicks' FIRST world question
    // (DaggerfallQuestJournalWindow.cs:450) -
    // `place.SiteDetails.locationName != PlayerGPS.CurrentLocation.Name`.
    // What DFU does when the named place IS where the player is
    // standing is NOTHING - no CanFindPlace, no dialog, no travel - and
    // the window builds that arm (questJournal.js's second gate). This
    // host had never answered the question at all, so the gate compared
    // against `''` and could never match; this route stands in ONE city
    // for its whole life, so PlayerGPS.CurrentLocation.Name is
    // `dfLocation` outright, exactly as its twenty other PlayerGPS
    // reads are. The map half is the one this route cannot build - see
    // makeJournalWindow below - so today the answer changes WHICH gate
    // refuses rather than whether one does; it is the gate the C# asks
    // first, and it is a fact this host has.
    currentLocationName: () => dfLocation.name ?? locationName,
  } : {});
  /** QX1/PX4: the pause journal's rail - one active row per quest that
   *  has written a log entry, its newest-first messages, and the
   *  shortest live clock on the quest's resources. ONE home in this
   *  host, because both consumers are this host's: `hudCtx.togglePause`
   *  below and the `pauseQuestLog` the mode machine hands its INTERIOR
   *  pause (a pause in a shop shows the same rail as one in the
   *  street). world.js keeps two copies of this walk; two copies is two
   *  laws the day one of them moves. */
  const pauseQuestLog = () => {
    const m = questBridge?.machine;
    const active = [];
    if (m) {
      for (const q of m.quests.values()) {
        const les = q.getLogMessages();
        if (!les?.length) continue;
        const messages = les.map((le) => q.getMessage(le.messageID)).filter(Boolean);
        if (!messages.length) continue;
        let clockSeconds = null;
        for (const r of q.resources.values()) {
          if (r.clockEnabled && !r.clockFinished && Number.isFinite(r.remainingTimeInSeconds)) {
            clockSeconds = clockSeconds == null ? r.remainingTimeInSeconds : Math.min(clockSeconds, r.remainingTimeInSeconds);
          }
        }
        active.push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', clockSeconds, messages });
      }
    }
    return { active, finished: questBridge?.notebook?.getFinishedQuests() ?? [] };
  };
  const pauseQuestMessages = () => questBridge?.machine.getAllQuestLogMessages() ?? [];
  if (!playerEntity.chargenDone && params.has('class')) {
    // AUDIT 17f: ?class=N is the headless skip - parsed here for the
    // DUNGEON the host might build, but never honoured for the host's
    // own chargen, so a town boot had no way past the overlay.
    loadSpellIndex(fetchBytes).then((sbi) => { spellsByIndex = sbi; return applyHeadlessChargen(playerEntity, Number(params.get('class')), { fetchBytes, spellsByIndex: sbi }); })
      .then(() => {
        preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
          { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
        surfacePlayer();
        questInitAtGameStart();   // QX1: OnStartGame for the headless character
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
          questInitAtGameStart();   // QX1: OnStartGame for the new character
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
  // ROAD-G G2: THIS HOST'S ACTIVE-ENEMY DATABASE, ABOVE GROUND. DFU has
  // ONE database per scene (PlayerGPS.UpdateNearbyObjects walks
  // ActiveGameObjectDatabase.GetActiveEnemyBehaviours(), PlayerGPS.cs
  // :747-777), and this route now stands foes in two pools out in the
  // street - the watch, and the encounter pool the mount below adds -
  // so every reader that used to name `cityGuards.guards` alone names
  // the join. world.js's `exteriorFoePool` is the same expression.
  const exteriorFoePool = () => [...cityGuards.guards, ...exteriorFoes.foes];
  // ROAD-B/ROAD-G G2: the AREA, for GameManager.MakeEnemiesHostile
  // (:790-806) - the street's two pools joined with whatever inside
  // pool the mode machine holds, which is world.js:1797's line.
  const _liveEnemyDatabase = () => [
    ...exteriorFoes.foes, ...cityGuards.guards, ...(modes?.insideFoes?.() ?? []),
  ];
  const _makeEnemiesHostile = () => makeEnemiesHostile(_liveEnemyDatabase());
  // X4: the Detect scan - declared before cityGuards so the frame body
  // and the feed share one definition; the thunks are lazy.
  const detectFeet = () => (walkMode ? player.pos : cam.pos);
  const detectFeed = createDetectFeed(playerEntity, {
    entities: () => ((modes?.mode ?? 'exterior') === 'exterior' ? exteriorFoePool() : [])
      .filter((f) => !f.dead && f.ai).map(foeNearbyRecord),
    // FX1 (F207): the world piles + guard corpses mark outdoors -
    // UpdateNearbyObjects walks every active loot container with no
    // scene gate (PlayerGPS.cs:747, :766-776).
    // DT1: this host names its loot KINDS and shared.js's
    // nearbyLootRecords does the walk (see world.js's twin).
    loot: () => nearbyLootRecords({ piles: droppedLoot._piles, foes: exteriorFoePool() }),
    feet: detectFeet,
  });
  const cityGuards = createCityGuards({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, hitEffects,
    playerWeaponSheathed: () => !!weaponRig.playerWeapon.sheathed,   // AUDIT 24 (wave 42): pacification's drawn-weapon penalty
    say: (l) => townTalk.say(l),   // C-slice: equipment breaks speak
    currentMinute: () => Math.floor(playerTicker.classicMinutes),   // AUDIT 23 (hosts-3): a guard's poison anchors at NOW, not 0
    makeAreaHostile: _makeEnemiesHostile,   // ROAD-G G1: DaggerfallEntityBehaviour.cs:255-258 - a struck PASSIVE watchman turns the area
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      const apply = () => {
        hurtPlayer(playerEntity, dmg);   // AUDIT 21 hosts F6: the one damage door - this used to write health raw and never check for death
        audio.playOneShot(hitSoundFor(wpn), PLAYER_HIT_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:330-344 - the blow that lands ON the player is volumeScale 1, not EnemySounds' 1.1
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
  /** ROAD-G G2: THE ENCOUNTER POOL, ON THE FIXED-CITY HOST TOO - THE
   *  FOUR HOSTS RULE, and the pool three of this host's laws had no
   *  place to stand a foe in.
   *
   *  `?exterior` mounted the WATCH alone, and three seams recorded that
   *  absence as a refusal rather than as the missing producer it was:
   *  CreateFoe's OUTDOOR arm answered false so an `create foe` wave
   *  aimed at the street never deployed (TryPlacement's failed-placement
   *  shape, for ever), the Wabbajack's exterior arm refused to transform
   *  a struck foe, and SoulBound's break release and the Sanguine Rose
   *  had nowhere to put a Daedroth above ground. It is the SAME factory
   *  the other two exterior hosts mount - world.js:1837 over the street
   *  collider, worldModes' `makeInteriorFoes` over a building's - and
   *  the deps are this host's own.
   *
   *  WHAT STANDS A FOE IN IT HERE: CreateFoe's PlaceFoeExteriorLocation
   *  (CreateFoe.cs:245-248), the Wabbajack's re-stand, and the two
   *  loose-foe releases, and (ROAD-G TAIL) PlayerEntity.Update's
   *  per-minute catch-up loop - runEncounterTick below. It used to say
   *  here that the per-minute INTERMITTENT
   *  SPAWN roll (:486-492) still has no caller on this route - that
   *  loop carries the passive-guard and NPC-guard-conversion arms with
   *  it (world.js:1883-1967) and is its own slice; this pool does not
   *  wait on it. */
  const exteriorFoes = createExteriorFoes({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, hitEffects,
    playerWeaponSheathed: () => !!weaponRig.playerWeapon.sheathed,   // AUDIT 24 (wave 42): pacification's drawn-weapon penalty
    currentMinute: () => Math.floor(playerTicker.classicMinutes),
    // GameObjectHelper.CreateEnemyCorpseMarker (:836-839) hands an
    // outdoor corpse to TrackLooseObject, which stamps the streamer's
    // CURRENT map pixel. This route stands in ONE location that never
    // leaves range, so there is no pixel to stamp - worldModes' own
    // interior arm passes the same nothing for the same reason.
    currentPixelKey: () => null,
    playerSinks: playerTicker.sinks,   // AUDIT 24 (wave 30): OnMonsterHit's fatigue rider through the host's one set of doors
    makeAreaHostile: _makeEnemiesHostile,   // ROAD-B: DaggerfallEntityBehaviour.cs:255-258
    say: (l) => townTalk.say(l),
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      hurtPlayer(playerEntity, dmg);
      audio.playOneShot(hitSoundFor(wpn), PLAYER_HIT_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:330-344 - the blow that lands ON the player is volumeScale 1
      // EnemyAttack.SendDamageToPlayer (:404-406) SendMessages
      // "RemoveHealth" for EVERY attacker, and PlayerFootsteps
      // .RemoveHealth (:348-364) answers with the 40% pain cry.
      playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
      surfacePlayer();
    },
    // C13/X2-slice: the shoot frame looses a REAL arrow through this
    // host's own flight, ringing ArrowShoot from the archer. The watch
    // carries no bow arm; an encounter foe does.
    onArrow: (from, dir, f) => {
      arrows.fire(from, dir, { enemy: true, shooterFoe: f, weapon: f.entity.weapon });
      audio.play3d(SOUND.ArrowShoot, from, 1, { maxDistance: 16 });
    },
    // X3-slice: casters - the S16 lists assign once the SPELLS.STD map
    // lands, and the release seams ride the ONE engine this host has.
    spellsByIndex: () => spellsByIndex,
    magicHooks: {
      explodeAt: (...a) => magic.explodeAt(...a),
      fireMissile: (from, spell, casterLevel, foe) => {
        if (!walkMode) return;
        const d = [player.pos[0] - from[0], player.pos[1] + 0.9 - from[1], player.pos[2] - from[2]];
        const l = Math.hypot(...d) || 1;
        magic.fireEnemyMissile(from, [d[0] / l, d[1] / l, d[2] / l], spell, casterLevel, foe);
      },
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
  /** ROAD-B: the ONE entry to PlayerEntity.SpawnCityGuards for this
   *  host (world.js's twin - THE FOUR HOSTS RULE). The INDOOR arm
   *  (:628-642) is offered the call first and, when it takes it,
   *  RETURNS: a crime in an open shop, a tavern or a residence is
   *  answered at that building's own lowest outer door by the mode
   *  machine's own watch pool, and the street law below never runs.
   *  Everything else falls through, which is C#'s own fall-through. */
  function _spawnGuards(immediate) {
    if (modes?.spawnCityGuardsInside?.(immediate)) return;
    const feet = walkMode ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(!!immediate, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  function _crimeResponse() { _spawnGuards(true); }

  // ROAD-G TAIL (2026-09-05): THE CLASSIC CATCH-UP LOOP ON THE FIXED-CITY
  // ROUTE - PlayerEntity.Update:479-525, the world host's twin
  // (world.js runEncounterTick, THE FOUR HOSTS RULE). Wave G stood the
  // encounter pool here and wrote down that this loop still had no
  // caller on this route; it has one now. Per elapsed game minute, one
  // intermittent roll (broken on a spawn), then the two passive-guard
  // rolls, then the once-per-Update NPC-guard conversion sweep - all
  // inside `if (!preventEnemySpawns)`, cleared at the tail. The fixed
  // city has no fast travel and no ship; the clock jumps that raise the
  // flag here are the jail skip (arrestFlow) and the vampirism turn
  // (infection.js deployInfection, VampirismInfection.cs:157).
  // REVIEW 2026-09-05 (PR #59): the loop runs in EVERY mode, as DFU's
  // Update does - IntermittentEnemySpawn reads IsPlayerInside (:564)
  // and rolls nothing inside a building or an un-rested dungeon, so an
  // 8-hour tavern sleep is SKIPPED rather than banked and replayed as
  // outdoor night rolls at the door; the passive-guard rolls reach the
  // indoor watch through _spawnGuards' inside arm; the conversion
  // sweep asks the street population, which a dungeon has none of
  // (MakeNPCGuardsIntoEnemiesIfGuardsSpawned :768-770 returns on a
  // null location object).
  let _lastEncMinutes = null;
  function runEncounterTick(playerFeet) {
    const now = Math.floor(playerTicker.classicMinutes);
    if (_lastEncMinutes == null) _lastEncMinutes = now;
    const span = playerEntity.preventEnemySpawns ? 0 : Math.min(now - _lastEncMinutes, 1440);
    let _updatedGuards = false;   // :484 - declared OUTSIDE the loop, inside the guard
    for (let l = 0; l < span; l++) {
      // :488-491 - "Don't spawn encounters while player is swimming in
      // water or on ship (same as classic)". This host has no ship.
      const _m = _mode();
      const hit = player.swimming ? null : intermittentEnemySpawn({
        gameMinutes: _lastEncMinutes + l + 1, inside: _m !== 'exterior', inDungeon: _m === 'dungeon', isResting: false,   // the dungeon's rest roll is dungeonContext's own
        inLocationRect: _musicInLocationRect(),   // F061: the WIDENED TOWN RECT - this host lives inside it
        climateIndex: locClimateIndex,
        playerLevel: playerEntity.level,
      });
      if (hit) { _standEncounterFoe(hit, playerFeet); break; }
      // :498-511 - the SAME minute's two passive-guard arms, each
      // levying Criminal_Conspiracy first, exactly as DFU orders it.
      const _owed = passiveGuardSpawns({
        legalRep: legalRepOf(playerEntity, dfLocation.regionIndex),
        severePunishmentFlags: playerEntity.regionConditions?.[dfLocation.regionIndex]?.severePunishmentFlags ?? 0,
      });
      for (let s = 0; s < _owed; s++) {
        setCrimeCommitted(playerEntity, CRIMES.Criminal_Conspiracy);   // V4: through the one setter
        _witnessResponse();
      }
      // :513-516 - at most ONCE per Update however many minutes catch up
      if (!_updatedGuards) {
        _updatedGuards = true;
        if (_m !== 'dungeon') cityGuards.makeNpcGuardsIntoEnemies({ pool: _guardPool(), playerFeet })   // :768-770 - no location object in a dungeon
          .catch((e) => console.error('[guards]', e));
      }
    }
    _lastEncMinutes = now;   // :522 - OUTSIDE the guard: the suppressed window is skipped, not replayed
    if (playerEntity.preventEnemySpawns) playerEntity.preventEnemySpawns = false;   // :524-525
  }
  /** The intermittent roll's placement - CreateFoeSpawner = PlaceFoeFreely
   *  with the arm's own band and line-of-sight flag (the world host's
   *  _standEncounterFoe, verbatim over this host's pool). */
  const _standEncounterFoe = (hit, feet) => {
    if (!walkMode) return null;   // the fly camera has no controller capsule to place around
    const env = placeFoeEnv({
      collider,
      playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
      playerYawRad: cam.yaw,
      fovDegrees: fieldOfView() * 180 / Math.PI,
      isOccupied: entityOccupancy((f) => f.ai?.feet, exteriorFoePool, feet),
    });
    let spot = null;
    for (let i = 0; i < LOOSE_FOE_PLACE_ATTEMPTS && !spot; i++) {
      spot = placeFoeFreely(env, {
        minDistance: hit.minDistance, maxDistance: hit.maxDistance,
        lineOfSightCheck: hit.lineOfSightCheck,
      });
    }
    if (!spot) return null;
    const fly = (ENEMY_BASICS[hit.mobileType]?.behaviour ?? 'General') === 'Flying';
    return exteriorFoes.spawnFoe(hit.mobileType, [spot.x, fly ? spot.y + 1.5 : spot.y, spot.z], {   // FinalizeFoe (CreateFoe.cs:341-359): a FLYING foe lifts 1.5
      yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player
    }).catch(() => null);
  };
  /** AUDIT 39 (#22): SpawnCityGuards(FALSE) - the WITNESS arm, the
   *  world host's twin (THE FOUR HOSTS RULE). The mode machine's
   *  private-property theft calls the member through the bag below
   *  and the bool picks the arm; this host had only the crime half. */
  function _witnessResponse() { _spawnGuards(false); }
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
    // ROAD-B B5: `uiManager.TopWindow` for TickRest's two top-window
    // tests (:364, :399). B1 made this host's slot the MIRROR OF THE
    // TOP of its window stack, so the slot IS the answer - and the
    // reachable test is the second one, where a quest popup pushed by
    // the rest's own sub-tick suspends it mid-hour.
    topWindow: () => townTalk.overlay,
    // The MASTERY box (RaiseSkills :1390-1401) - TEXT.RSC 4020.
    box: (rows) => townTalk.showOverlay(new ActionTextBox(rows)),
    advanceMinutes: (n) => { playerTicker.advance(n); runEncounterTick(walkMode ? player.pos : cam.pos); },   // ROAD-G TAIL: the catch-up loop rides the rest's minutes, as world.js:2738 has it
    // QX1: TickRest's per-hour QuestMachine.Instance.Tick (:379),
    // through THIS host's own bridge. It used to be `null` with a note
    // saying "grep questBridge in this file returns nothing" - true
    // until QX1 mounted one, and a resting player is exactly when a
    // quest clock is meant to run out. Same expression the other three
    // hosts pass (THE FOUR HOSTS RULE).
    tickQuests: () => questBridge?.machine?.tick?.(),
    // AreEnemiesNearby's RESTING variant, over this host's whole street
    // database (ROAD-G G2 widened it - it named the watch alone on the
    // premise that the watch was the only pool here, and a quest foe
    // stood in the street by CreateFoe's exterior arm would otherwise
    // have let the player sleep beside it). `activeCount() > 0` - which
    // the first draft borrowed from the exhaustion arm - would block
    // sleep for good the moment one guard spawned anywhere in town.
    enemiesNearby: () => areEnemiesNearby(exteriorFoePool(), { resting: true }),
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
      townTalk.showOverlay(makeCharSheetWindow());   // dfuiOpenCharacterSheetWindow (RaiseSkills :1414)
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
      // ROAD-B B5: the gate's third arm has a producer now. ROAD
      // review-p: the PRODUCER, not a poll - :667-669 fetches it
      // inside the third `else`, after the other two arms have
      // returned.
      preventedMessage: getPreventedRestMessage,
      // AUDIT 58: DaggerfallUI.cs:680's `else if (!GiveOffer())` -
      // a pending `give pc ... notify` offer takes this press and
      // the rest window stays shut (ui/pendingOffer.js).
      giveOffer,
      racialOverrideBlocks: !!rb,
    });
    if (d.kind !== 'rest') {
      // DFU raises the enemy alert on the enemies arm
      // (DaggerfallUI.cs:655 - NOT the rest window's :655, which is
      // DoRestForAWhile; a bare citation here resolves to the wrong
      // file, since every other number in this block is the window's).
      if (d.kind === 'enemies') setEnemyAlert(playerEntity, true, Math.floor(worldMinutes()));
      // AUDIT 58: the offer took the press - the item was handed
      // over inside GiveOffer() and there is nothing to say.
      if (d.kind === 'offer') return;
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
  const arrestFlow = createArrestFlow({
    townTalk, playerEntity, regionIndex: dfLocation.regionIndex,
    onCourtScreen: () => cameraRecoiler.reset(),
    // ROAD-B B5: InputManager.GetBackButton, the prison countdown's
    // held-Escape accelerator (DaggerfallCourtWindow.cs:301-304).
    backButtonHeld: () => backButtonHeld,
  });
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
    hurt: (n) => { if (n > 0) (g._encounter ? exteriorFoes.damageFoe(g, n, player.pos) : cityGuards.hurtGuard(g, n, player.pos)); },   // ROAD-G G2: route by pool, world.js's line
    heal: (n) => { if (n > 0) g.entity.health = Math.min(g.entity.maxHealth ?? Infinity, g.entity.health + n); },
    drainMagicka: (n) => { if (n > 0) g.entity.magicka = Math.max(0, (g.entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) g.entity.magicka = Math.min(g.entity.maxMagicka ?? Infinity, (g.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.max(0, (g.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.min(maxFatigue(g.entity), (g.entity.fatigue ?? 0) + n); },
  });
  // ---- TP2 - THE RECALL ANCHOR, IN THE FIXED-CITY HOST ----
  //
  // Teleport.cs (the Mysticism effect the player calls Recall), the
  // arms this route CAN take. The line that stood at `onTeleport`
  // below said the whole spell pended here because "the anchor
  // machinery lives in the streaming ?world host" - true of ONE arm and
  // false as a refusal, the same shape A10 found and fixed in the
  // dungeon context. Set-anchor needs nothing but a position and a
  // context (:100-117); the same-interior arm needs nothing but a move
  // (:129-134); and a cross-context arm INSIDE one map pixel needs the
  // mode teardown and the two re-entries, all of which this host's own
  // mode machine owns. What it cannot do is the arm that leaves the
  // pixel - flagged, narrowed, at its own line inside recallToAnchor.
  //
  // The law is systems/teleportAnchor.js (the anchor's shape,
  // IsSameInterior, the plan); this is the host half.
  //
  // THE FRAME. `?exterior` lays its one location at the scene origin
  // (the automap's `locOrigin: [0, 0, 0]` below says so), and in the
  // streaming host that origin is the location's own world rect
  // (PlayerGPS.SetWorldLocationRect, streamingWorld.locationWorldRect).
  // So an anchor's nativeX/nativeZ are stated in the SAME native frame
  // both hosts use, rather than in a private one - and `y` goes in raw,
  // because this host has no floating origin to compensate for (the
  // batches' own `_box` comment above says it: "world-space here - this
  // host has no floating origin").
  const _anchorRect = locationWorldRect(dfLocation, _locPixel.x, _locPixel.y);
  const _anchorNative = (p) => ({ x: _anchorRect.minX + p[0] / GLOBAL_SCALE, z: _anchorRect.minZ + p[2] / GLOBAL_SCALE });
  /** RestorePosition's landing, in the frame the arrival speaks. A
   *  DUNGEON anchor's `local` IS the landing (its frame is its own and
   *  is rebuilt at the same origin every mount); everything else -
   *  outside and inside a building alike, P8's unified frame - comes
   *  back off the natives. */
  const anchorLanding = (a) => {
    if (a.insideDungeon && a.local) return [...a.local];
    return [(a.nativeX - _anchorRect.minX) * GLOBAL_SCALE, a.y ?? 2, (a.nativeZ - _anchorRect.minZ) * GLOBAL_SCALE];
  };
  /** SetAnchor (:100-117): the outer host's world half, the mounted
   *  mode's inside half, one record. Works in EVERY mode this route can
   *  stand in, which is why it is not the flagged half. */
  function setRecallAnchor() {
    const inside = modes?.anchorContext?.() ?? { worldContext: WORLD_CONTEXT.Exterior, local: null, buildingKey: 0, interior: null };
    const pf = walkMode ? player.pos : cam.pos;
    // A DUNGEON's local frame is its own, so its world coordinates are
    // the pixel's rather than the player's feet - "only one dungeon per
    // map pixel allowed" (:211) makes the pixel the whole identity.
    const inDungeon = inside.worldContext === WORLD_CONTEXT.Dungeon;
    const wc = inDungeon ? null : _anchorNative(pf);
    playerEntity.anchorPosition = makeAnchor({
      worldContext: inside.worldContext,
      pixel: _locPixel,
      nativeX: wc ? wc.x : _anchorRect.minX,
      nativeZ: wc ? wc.z : _anchorRect.minZ,
      y: pf[1],
      local: inside.local,
      yaw: cam.yaw, pitch: cam.pitch,
      buildingKey: inside.buildingKey,
      interior: inside.interior,
    });
  }
  let _recalling = false;
  /** TeleportPlayer (:119-164) + the respawner's tail (:228-256), the
   *  arms that land inside this route's one loaded city. */
  async function recallToAnchor() {
    if (_recalling) return;
    const anchor = playerEntity.anchorPosition;
    const plan = teleportPlan(anchor, {
      ...(modes?.insideContext?.() ?? { insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
      pixel: _locPixel,
    });
    // "An Anchor must be set before you can Teleport." - TEXT.RSC
    // record 4001 (Internal_RSC.csv:4821), raised in the same
    // ClickAnywhereToClose box DFU raises (:268-275) rather than as a
    // HUD line, and read through the same TEXT.RSC door the rest of
    // this host's boxes use. The cast is spent either way; DFU refunds
    // nothing.
    if (!plan) {
      townTalk.showOverlay(new ActionTextBox(plainLines(townTalk.lines(ANCHOR_MUST_BE_SET))
        ?? ['An Anchor must be set before you can Teleport.']));
      return;
    }
    if (plan.kind === 'same-interior') {
      // ":129-134 - Just need to move player." Nothing is torn down and
      // nothing is loaded: the room you stand in IS the anchor's room.
      modes?.setPlayerLocalPosition?.(anchorLanding(anchor));
      cam.yaw = plan.yaw; cam.pitch = plan.pitch;
      playerEntity.playerTeleportedIntoDungeon = plan.teleportedIntoDungeon;
      playerEntity.anchorPosition = null;   // consumed on arrival, both DFU arms (:133)
      surfacePlayer();
      return;
    }
    const a = plan.anchor;
    // TP2 INTERIM - THE ONE ARM THIS HOST CANNOT TAKE: a jump to an anchor on ANOTHER map pixel. Teleport.cs:145-163 respawns at the anchor's world position, which is StreamingWorld's job (scenes/world.js's `_teleportToPixel`, the door `teleportPrompt -> teleportTo` opens); `?exterior` loads ONE fixed city and runs no streamer, so there is no arrival to build - and it says so instead of eating the cast, the way the standalone dungeon says so about its two windows.
    if (a.pixel?.x !== _locPixel.x || a.pixel?.y !== _locPixel.y) {
      townTalk.say(`(Recall cannot leave ${dfLocation.name ?? locationName} here - the anchor is at another location, and the arrival is the streaming ?world host's)`);
      return;
    }
    _recalling = true;
    try {
      // "Cache scene before departing" (:145-151). This route caches no
      // exterior scene - there is nothing streamed to cache - so the
      // arm that survives is the BUILDING one, which forceExitToExterior
      // writes itself (the same write the real door makes,
      // PlayerEnterExit.cs:860); inside a dungeon DFU caches nothing at
      // all and takes TransitionDungeonExteriorImmediate (:151).
      if ((modes?.mode ?? 'exterior') !== 'exterior') {
        modes?.forceExitToExterior({ cacheScene: plan.cacheScene === 'building' });
      }
      // RestorePositionHelper's three arms (PlayerEnterExit.cs:622-655),
      // in its own order: dungeon first, then building with doors, then
      // outside.
      let landed = false;
      if (plan.arrive === 'dungeon') {
        landed = !!(await modes?.startInDungeon?.());
        if (landed) modes?.setPlayerLocalPosition(anchorLanding(a));
        // No entrance in this location: DFU's "all else fails" exterior
        // landing (RespawnPlayer :548-553, "Teleporting to origin of
        // nearest map pixel"). The landing below is NOT anchorLanding -
        // a dungeon anchor's `local` and its stored height are in the
        // DUNGEON's frame and would drop the player through the world -
        // it is the anchor's own natives, which for a dungeon anchor
        // setRecallAnchor deliberately stores as the location rect's
        // origin, at this host's ground height.
        else townTalk.say('The way underground is closed. Repositioning player.');
      } else if (plan.arrive === 'building') {
        landed = !!(await modes?.restoreInterior?.(a.interior, anchorLanding(a)));
        if (!landed) townTalk.say('Building has no exterior doors. Repositioning player.');
      }
      if (landed) {
        cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      } else {
        // EVERY unlanded arm repositions, the failed DUNGEON mount
        // included: the cast may have torn down the interior it was
        // made in (the forceExitToExterior above), so leaving the
        // player where they stood leaves them inside a building shell.
        const [lx, ly, lz] = plan.arrive === 'dungeon'
          ? [(a.nativeX - _anchorRect.minX) * GLOBAL_SCALE, GROUND_OFFSET * 0.025 + 2, (a.nativeZ - _anchorRect.minZ) * GLOBAL_SCALE]
          : anchorLanding(a);
        if (walkMode) player.spawn(lx, ly, lz); else cam.pos = [lx, ly + 40, lz];
      }
      // "Restore final position and unwire event" (:242) - the pose
      // rides the transform, exactly as RestorePosition sets it.
      cam.yaw = a.yaw ?? cam.yaw; cam.pitch = a.pitch ?? cam.pitch;
      playerEntity.playerTeleportedIntoDungeon = plan.teleportedIntoDungeon;   // :246
      playerEntity.anchorPosition = null;   // consumed on arrival
      surfacePlayer();
    } finally {
      _recalling = false;
    }
  }
  /** PromptPlayer (:81-98): the 4000 anchor/teleport box, with
   *  AllowCancel - DFU's own QoL, and its own comment says the cast is
   *  not refunded. Every host routes its Recall arrival here; this one
   *  routes its INTERIOR and DUNGEON modes here too (the createWorldModes
   *  bag's `onTeleport`), so a Recall cast in a shop raises the same box
   *  as one cast in the street. */
  function teleportPrompt() {
    townTalk.showOverlay(new ChoiceWindow({
      lines: ['Do you want to Teleport or Set an Anchor?'],
      options: [
        { code: 'KeyA', label: 'A - set anchor', action: () => setRecallAnchor() },
        { code: 'KeyT', label: 'T - teleport', action: () => { recallToAnchor(); } },
        { code: 'Escape', label: 'Esc - cancel', action: () => {} },
      ],
    }));
  }
  /** AUDIT 58 (f2/hosts): HOISTED, because the enchant ctx below needs
   *  the same object. A caster reaches applySpell as `{ entity, sinks }`
   *  and the sinks are what a Transfer effect heals the caster through
   *  (effects.js:828/:842) - world.js:2022 hoisted its copy for exactly
   *  that reason when reflection was wired, and this host's stayed
   *  inline only because nothing else had asked for it. */
  const playerSpellSinks = {
    hurt: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
    heal: (n) => { if (n > 0) { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); surfacePlayer(); } },
    drainMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n); surfacePlayer(); } },
    restoreMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + n); surfacePlayer(); } },
    drainFatigue: (n) => drainExteriorFatigue(n),
    restoreFatigue: (n) => { if (n > 0) { playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + n); surfacePlayer(); } },
    say: (l) => townTalk.say(l),
  };
  const magic = createPlayerMagic({
    onTeleport: () => teleportPrompt(),   // TP2: the 4000 box, the arms this host can take
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
    playerSinks: playerSpellSinks,
    say: (l) => townTalk.say(l),
    surfacePlayer,
    // QG1: the ready-spell doors - EntityEffectManager's two events
    // (hostMagic.js:73-74), which are the ONLY route into the quest
    // machine's CastSpellDo / CastEffectDo latches (machine.js:776/:782;
    // actions.js:2688). This host owns its own cast engine and passed
    // neither key, so on this route - and, because worldModes takes THIS
    // instance indoors, in every shop entered from it - `cast X spell do`
    // and `cast X effect do` could never latch and never fire. The other
    // two engine-owning hosts wire the identical pair (world.js:2109-2110,
    // dungeonContext.js:1789-1790); `questBridge` is assigned below this
    // mount, so the chain is optional both ways.
    onNewReadySpell: (sp) => questBridge?.machine?.notifyNewReadySpell?.(sp),
    onCastReadySpell: (sp) => questBridge?.machine?.notifyCastReadySpell?.(sp),
    // ROAD-G G2 (a): THE THREE-ARM SHAPE, the streaming host's law over
    // this host's pools. This read was `mode === 'exterior' ? guards :
    // []`, which is an INTERIOR SCENE GATE - and this is the only cast
    // engine this page has indoors: worldModes takes this instance,
    // drives firePending/update on every interior frame and routes the
    // interior attack click into `magic.interceptAttack`, and every
    // target read in the engine goes through this one thunk (explodeAt's
    // sweep, ByTouch's pick, the release-frame area arm, the missile
    // impact - hostMagic.js). Answering `[]` meant a Fireball cast in a
    // shop reached from ?exterior swept nobody, a ByTouch spell picked
    // nobody, and a missile passed through a Knight_CityWatch the MELEE
    // ray would have hit. DFU gates nothing here: the explosion is
    // `Physics.OverlapSphereNonAlloc` and the touch pick a raycast
    // (DaggerfallMissile.cs:481/:409-455) - whatever is in the scene.
    // The dungeon arm stays empty because dungeonContext builds its OWN
    // engine and this one never runs in that mode.
    foes: () => (_mode() === 'exterior' ? [...cityGuards.guards, ...exteriorFoes.foes]
      : _mode() === 'interior' ? _insidePool()
        : []),
    // ...and the sinks follow the RECORD, not the mode: a foe handed
    // out by the interior arm must knock back and die against THAT
    // building's collider and death chain, so this is the same
    // pool-membership router the enchant mount takes.
    foeSinks: (f) => enchantFoeSinks(f),
    absorbCtx: () => ((modes?.mode ?? 'exterior') === 'exterior'
      ? { inside: false, day: !isNight(minuteNow()) }
      : { inside: true, day: false }),
    // AUDIT 36 F1: THE THIRD HOST CASTS TOO. MW-D39 wired the arm's
    // spellcast release into the dungeon and world hosts and MISSED
    // this one - the standalone exterior page, which has its own magic
    // engine and its own rig - so a spell cast above ground played the
    // stance and never the cast. The same moment, the same one door.
    // ROAD-E6: CastReadySpell's PlayOneShot (:430-435) - the same one
    // door, now at the moment the magicka is spent rather than at the
    // release the engine parks on frame 5.
    startCastAnim: (sp, onRelease) => !!weaponRig?.castSpellAnim?.(sp?.rangeType, sp?.element, onRelease),
  });
  // AUDIT 24 (wave 32): the broker's foe subscribers - BOTH street pools (ROAD-G G2 mounted the second; the note here said 'the watch (this host mints no encounter foes)').
  // OnNewMagicRound is global and every EntityEffectManager handles it, so
  // these entities owe the same per-minute laws the player does. They got
  // none of them: above ground a foe's Continuous Damage never took a
  // round, its poison never fired, and a paralysed foe stayed paralysed.
  subscribeFoePools(playerTicker, [() => cityGuards.guards, () => exteriorFoes.foes], foeSinks);
  /** AUDIT 24 (wave 36): the senses context every foe pool owes its
   *  foes, built ONCE per frame for all of them. This host used to pass
   *  `{ playerInvisible }` alone, which left Chameleon and Shade inert,
   *  read the player's Stealth as 0, tallied it never, and - because
   *  gameMinutes defaulted to 0 - froze each foe's detection on its
   *  first roll for the rest of its life. */
  // AUDIT 58 (f2/hosts) / ROAD-G G2: the enchant ctx's live reads, at
  // function scope. THE LAW IS shared.js's (liveEnchantFoes /
  // liveEnchantFoeSinks / enchantFoeHost): one arm per live mode,
  // because DFU has one active-enemy database per scene
  // (PlayerGPS.cs:747-777), and the sinks routed by POOL MEMBERSHIP so
  // a record never knocks back against the wrong host's collider. This
  // host's exterior pool is BOTH street pools now - the watch and the
  // encounter pool ROAD-G G2 mounted; the interior and dungeon arms are
  // worldModes' own. `modes` is a `var` declared far below, so every
  // deref here is `modes?.` and every read is a thunk.
  const _mode = () => (modes?.mode ?? 'exterior');
  const _insidePool = () => modes?.insideFoes?.() ?? [];
  const enchantFeet = () => (walkMode ? player.pos : cam.pos);
  const enchantFoes = () => liveEnchantFoes(_mode(), modes?.dungeonCtx ?? null, exteriorFoePool, _insidePool);
  const enchantFoeSinks = (f) => liveEnchantFoeSinks(f, modes?.dungeonCtx ?? null, foeSinks, _insidePool, (g) => modes?.insideFoeSinksFor(g));
  const _foeSenses = () => sensesContext(playerEntity, playerTicker.classicMinutes, {
    movingLessThanHalfSpeed: player.movingLessThanHalfSpeed ?? true,
    // MT-ii/ROAD-G G2: the target-machine seam - EnemySenses reads ONE
    // active-enemy database (EnemySenses.cs:741-749), so a watchman and
    // a foe stood in the street by CreateFoe's exterior arm can see
    // each other. Absent, every foe on this route took the player-only
    // path. Passing the GETTER keeps one live view per frame with no
    // pool importing the other; dead records leave it the frame they
    // die, as DFU's database yields only ACTIVE behaviours.
    candidates: () => exteriorFoePool().filter((f) => !f.dead),
    playerEntity,
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
    rows: (id, pick) => townTalk.lines(id, pick),   // U25: the real item info + use text (TEXT.RSC)
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
    // QX1: the use-click block's quest read
    // (DaggerfallInventoryWindow.cs:1681) and the quest LETTER's
    // display name, off this host's own machine. It was `null` with a
    // note saying this page mounts no bridge; it mounts one now, so a
    // quest letter carries its quest's name here as it does in the
    // world host.
    getQuest: (uid) => questBridge?.machine?.getQuest?.(uid) ?? null,
    nowMinute: () => Math.floor(playerTicker.classicMinutes),
    // U8e: OnPop mints the world pile. G5: with the drop icon the
    // player cycled to (null = CreateDroppedLootContainer's -1 roll)
    // and, when the window replaced a loot target, that container's
    // own x/z (:710-714).
    onDrop: (items, icon = null, at = null) => droppedLoot.dropPile(items, containerDropPos(at, dropFeet()), null, icon),
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
    rows: (id, pick) => townTalk.lines(id, pick),
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
    rows: (id, pick) => townTalk.lines(id, pick),   // AUDIT 58: the eight attribute popups' TEXT.RSC records 0..7
    inventory: () => (inventoryDoorReady() ? makeInventoryWindow() : null),
    spellbook: makeSpellbookWindow,
    // QX1: THE LOGBOOK BUTTON DRAWS NOW. U43 withheld the two quest
    // hooks here and said why - "`?town` mounts no quest bridge, so
    // charSheetHooks withholds the LOGBOOK button and the sheet gives
    // its refusal... an empty journal would tell a player they have no
    // quests when the truth is this page cannot see them". The page can
    // see them: these are the same two expressions world.js and the
    // dungeon context hand their sheets, off this host's own machine.
    ...questJournalHooks(),
  });
  /** QX1/U43: the two journal doors (GameManager.cs:541-548), ONE
   *  window either way - LogBook opens it as it stands, NoteBook on the
   *  Notebook page (DaggerfallUI.cs:704-711). The import for this has
   *  sat at the top of this file since U43 with NO CALLER, because the
   *  host had no machine to fill a journal from; it has one, so the
   *  door is hung. Through ui/chronicleDoor.js, exactly as the other
   *  three hosts reach it - the host hands over what only it knows and
   *  the door picks the skin.
   *
   *  ROAD-G G2 (c) NARROWED HandleQuestClicks' RECORDED ABSENCE to its
   *  one true clause: this route mounts no travel map (DfTravelMapWindow
   *  is world.js's), so `gotoPlace` (:214-217) and its `canFindPlace`
   *  (:1134-1146) - both members of that window - stay unset and the
   *  dialog is never offered, which is the same nothing a CanFindPlace
   *  miss produces in C#. The seam's other gate, the one asking whether
   *  the place is the city the player is already in, IS answered:
   *  questJournalHooks above hands over PlayerGPS.CurrentLocation.Name.
   *  No bridge, no book - the same nothing the sheet's LOGBOOK button
   *  gives. */
  const makeJournalWindow = (mode) => {
    if (!questBridge) return null;
    // WARM FIRST, THEN ASK. The door's own classic arm IS the art gate
    // (chronicleDoor.js:68 `if (!questJournalArtLoaded()) return null`),
    // so a readiness test placed AHEAD of the preload that satisfies it
    // made the classic skin answer null for ever - the warm behind the
    // gate could never run. dungeonContext.js:1136-1138 is the shape:
    // warm, then let the door refuse.
    preloadQuestJournalArt({ renderer, fetchBytes, palette });
    return createChronicleWindow({
      ...questJournalHooks(),
      mode,
      entity: playerEntity,
      // The classic modes map onto the two sections the chronicle
      // holds; the two quest modes land on Notes because the pause
      // window has carried quests since PX4.
      section: mode === 'messages' ? 'messages' : 'notes',
    });
  };
  const arrows = new ArrowFlight({ getGpuMesh, collider: () => collider });   // C13
  let zPrevW = false;   // the ReadyWeapon (Z) edge
  let hPrevW = false;   // a12: the SwitchHand (H) edge - RELEASED, not pressed (WeaponManager.cs:272)
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
  // TI1: the touch layer's state. swipeHeld is the swipe's SwingWeapon
  // truth beside rightHeld (the settle law reads both); a tap arms a
  // ONE-frame Mouse0 press (_tapArmed counts it down at the frame's
  // top) and _tapDir carries the finger's ray for the release frame,
  // which is when A8's gate fires the activation. player/lockOn.js
  // holds the lock; _lockChest is this frame's dot target.
  let swipeHeld = false;
  let _tapArmed = 0, _tapPoint = null, _tapDir = null;
  let _lastProj = null, _lastView = null, _lockChest = null;
  const lockOn = createLockOn();
  /** TI1c: THE LOCK'S ARM, one for every ladder - the exterior's below
   *  and the modal ones through worldModes (host.tapLock). The cone
   *  pick, not the box hit: a thumb misses a sprite the mouse would
   *  strike. Answers whether the tap was the lock. */
  const tapLock = (eye, dir, foes, collider) => {
    const foe = pickFoeNearRay(eye, dir, foes, collider, LOCK_PICK_DISTANCE);
    if (foe) lockOn.toggle(foe);
    return !!foe;
  };
  /** TI1c: the dot over the locked foe's chest through THIS frame's
   *  lens - the exterior pass and the modal pass each hand theirs in. */
  const placeLockDot = (proj, view) => {
    if (!touch) return;
    const _dp = _lockChest ? projectToScreen(_lockChest, canvas.clientWidth, canvas.clientHeight, proj, view, largeHudViewportRect(canvas.clientHeight)) : null;
    touch.setLockDot(_dp && _dp.front ? _dp.x : null, _dp?.y);
  };
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
    // ST1: the record-22 box leads here too, and QX1 gave it a real
    // MACRO CONTEXT. It used to pass `null` because "this dev scene has
    // no quest machine", which left every macro as its bracketed
    // placeholder - the null-MCP posture, correct then and a lie now.
    // Same expression the world and dungeon hosts pass.
    showStatus: () => {
      const rows = (id) => townTalk.lines(id);
      townTalk.showOverlay(new ActionTextBox(statusInfoRows(rows, questBridge?.machine?.macroContext?.() ?? null))
        .addNext(healthStatusRows(playerEntity, rows)));
    },
    toggleInventory: () => {
      // V4: GetSuppressInventory (LycanthropyEffect.cs:409-421)
      const sup = racialSuppressInventory(playerEntity);
      if (sup) { townTalk.say(sup.text); return; }
      if (inventoryDoorReady()) townTalk.showOverlay(makeInventoryWindow());
    },
    toggleSpellbook: () => toggleSpellbook(),
    // AUDIT 58 (f2/hosts): the sheath panel's door - HUDLarge.cs:477-484
    // is a WeaponManager singleton call with no scene gate, so the
    // eleventh panel answers here too. The law is at world.js's twin
    // (THE FOUR HOSTS RULE); routeKey still declines the key
    // (ui/input.js:351), so the frame poll stays its only keyboard door.
    toggleSheath: () => weaponRig.toggleSheath(),
    // QX1/U43: the two journal keys, which this host had never
    // answered - the doors are the same ONE window the sheet's LOGBOOK
    // button opens, and the world and both interior hosts have answered
    // L and N since U43 (THE FOUR HOSTS RULE).
    toggleLogbook: () => { const w = makeJournalWindow('activeQuests'); if (w) townTalk.showOverlay(w); },
    toggleNotebook: () => { const w = makeJournalWindow('notebook'); if (w) townTalk.showOverlay(w); },
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
        // PX25: the sheet's own doors. QX1 gave this host the THIRD -
        // the note used to say "this host has no journal maker, so it
        // hands over two and the Chronicle button never draws", and the
        // maker exists now. The filter still does its job: no bridge or
        // no art and makeJournalWindow answers null, so the button opens
        // nothing rather than an empty book.
        openPack: () => townTalk.showOverlay(makeInventoryWindow()),
        openSpellbook: () => { const w = makeSpellbookWindow(); if (w) townTalk.showOverlay(w); },
        openChronicle: () => { const w = makeJournalWindow('notebook'); if (w) townTalk.showOverlay(w); },
        savingPrevented: () => true,
        exitToMenu: exitToTitleMenu,
        textLines: (id) => townTalk.lines(id),
        // PX3 SHIPPED (QX1): the Quests tab reads THIS host's own quest
        // machine. The flag here said "this test host mounts no quest
        // bridge, so the pause window's Quests tab says so" - the
        // refusal was honest and the premise is gone: the bridge is
        // built below over this route's one fixed city, and these are
        // the same two walks world.js and dungeonContext hand their
        // pause windows. The rail's own home is `pauseQuestLog` above,
        // which the interior pause reads too.
        questMessages: pauseQuestMessages,
        questLog: pauseQuestLog,
      });
    },
    // A2: the exterior automap (Actions.AutoMap outdoors,
    // DaggerfallUI.cs:633-650); this host always stands on a location.
    toggleAutomap: () => {
      const locId = `${dfLocation.regionIndex}:${dfLocation.name ?? locationName}`;
      // ROAD-C c2/S10: the real mesh-99900 arrow (rasterised once by
      // ui/meshStamp.js) and the Position-bearing subrecord walk the
      // plate anchors now come off.
      getGpuMesh(99900).catch(() => {});
      const summaries = buildingSummaries(dfLocation.exterior?.buildings ?? [], loc.blocks,
        { locationName: dfLocation.name ?? locationName, regionName: maps.getRegionName(dfLocation.regionIndex) });
      // ROAD-D D5, PAID BY QX1. The residence plate arm
      // (ExteriorAutomap.cs:682-709) walks QuestMachine.GetAllActiveQuests
      // and this host had no machine to walk, so every residence took
      // DFU's own empty-set answer. It has one now, and the stamp is the
      // same call world.js makes - resolved ONCE per open (:273), which
      // is this build.
      //   The THIRD source arm, `isBuildingQuestResource`, is
      // TalkManager's (:698-705, the `locationWasMarkedOnMapByNPC`
      // half) and stays ABSENT: it needs a topic tree, and this route
      // runs no rumor mill or topic tree at all - the same reason its
      // bulletin board opens on the location name alone.
      //   AND THAT COSTS THE WHOLE PLATE, not one clause. residenceQuestName
      // optional-calls the arm at exteriorAutomapWindow.js:460 and the
      // NEXT line is `if (!r?.isQuestResource) continue`, which skips
      // the only assignment to buildingQuestName - so with the arm
      // absent this stamp resolves '' for every residence and raises no
      // plate at all. That is still DFU's own answer HERE:
      // ExteriorAutomap.cs:695-700 reads locationWasMarkedOnMapByNPC
      // only through that ref call, and a route with no topic tree has
      // no NPC that can mark a house. So the stamp is wired and correct
      // the moment a topic tree lands on this route; today it is the
      // empty answer, not a plate this host raises.
      stampResidenceQuestNames(summaries, discoveredBuildings(locId), {
        getAllActiveQuestIds: () => [...(questBridge?.machine.quests.values() ?? [])]
          .filter((q) => !q.questTombstoned).map((q) => q.uid),
        getQuest: (questID) => questBridge?.machine.getQuest(questID) ?? null,
      }, dfLocation.mapTableData?.mapId ?? 0);
      townTalk.showOverlay(new ExteriorAutomapWindow({
        locationName: dfLocation.name ?? locationName,
        locationId: locId,
        gridW: loc.width, gridH: loc.height,
        blocks: loc.blocks.map((bl) => ({ x: bl.x, y: bl.y, autoMap: bl.dfBlock?.rmbBlock?.fldHeader?.autoMapData })),
        playerPos: () => (walkMode ? [...player.pos] : [...cam.pos]),
        // this host lays the location at the map pixel's own origin, so
        // the location frame IS the tile frame DFU's modulo needs
        locOrigin: [0, 0, 0],
        isCustomLocation: hasCustomLocationPosition(dfLocation),
        playerYaw: () => cam.yaw,
        arrowMesh: () => cpuModels.get(99900) ?? null,
        compassArt: hudArt,
        buildings: () => summaries,
        directory: () => townTalk.directory,
        discovered: () => discoveredBuildings(locId),
        // the box opens on the DISPLAYED name (`mb.TextBox.Text =
        // renamingLabelRef.Text`, :888); the canonical is only
        // TextBox.Name/DefaultText (:887, :889)
        rename: (buildingKey, displayed) => townTalk.pushOverlay(new ServiceFlowWindow([{
          rows: ['Custom name: '],   // Internal_Strings `customName` (:889)
          field: { numeric: false, maxCharacters: 80, initial: displayed ?? '' },
          onInput: (text) => { setDiscoveredBuildingCustomName(locId, buildingKey, text); return null; },
        }])),
      }));
    },
    // PlayerActivate.ChangeInteractionMode through townTalk, which owns
    // the mode's HUD line - the panel's cycle is NOT the keyboard's,
    // see ui/hudLarge.js.
    cycleMode: (dir) => townTalk.setMode(dir > 0 ? hudLargeNextMode(getInteractionMode()) : hudLargePrevMode(getInteractionMode())),
  };
  // ROAD-B B5 - InputManager.GetBackButton() (InputManager.cs:1075-1078)
  // is `Input.GetKey(KeyCode.Escape)`, a RAW held read that no window
  // intercepts. This ladder returns at `townTalk.keydown` while a
  // window is up, so `keys` never sees the press - hence its own latch,
  // above the return. Its one consumer is the prison countdown's
  // accelerator (DaggerfallCourtWindow.cs:301-304).
  let backButtonHeld = false;
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') backButtonHeld = true;
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
    // ROAD-G G3 - THE RING IS FILLED BEFORE THE LADDER. InputManager
    // .PollInput (:1795-1809) rebuilds `heldKeys` every frame whatever
    // the dispatch does - `foreach (KeyCode k in KeyCodeList) if
    // (GetPollKey(k)) AddHeldKey(heldKeys, k)` runs before
    // GameManager.Update reads a single Action. This add used to sit at
    // the BOTTOM of the ladder, so every key that DISPATCHED (F5, R, M,
    // V, Escape) returned above it and never entered the Set at all.
    // That was invisible while nothing read the ring; it is not now,
    // because the Set IS the ring ModifierOnlyHeld SCANS (:1632-1639,
    // through ui/input.js's latch) and a key missing from it is a key
    // that cannot disqualify a modifier at all. It stays BELOW
    // the overlay gate: DFU's own Update returns before PollInput while
    // a pausing window is up (:487-503), so a key typed into a window
    // joins no ring there either.
    keys.add(e.code);
    // AUDIT 58 (f3/input) - THE COMBO ARM'S MISSING ARGUMENT.
    // actionOf resolves a COMBO code only when it is handed the host's
    // held-keys Set (ui/input.js:156-177), and no host passed one - so
    // GetUnaryKey's combo branch (InputManager.cs:1666-1712) was live
    // for the POLLED actions, which read through held(), and dead for
    // every DISPATCHED one. A player who bound Inventory to Shift+I in
    // the controls window got the Status box instead and could never
    // open the inventory. The Set is the ring filled just above, this
    // press included, and actionOf reads it through the held-first
    // LATCH (G3/GR); it carries the suppression half too (:1681-1685,
    // "space is jump, LeftShift+Space opens inventory: ignore it").
    const act = actionOf(e, keys);   // I2: the registry owns the code -> action read
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
      // U43: LogBook (L) and NoteBook (N), two of GameManager's own
      // dispatch chain (:541-548). QX1 gave this host something to put
      // in them.
      if (act === 'LogBook') { e.preventDefault(); hudCtx.toggleLogbook(); return; }
      if (act === 'NoteBook') { e.preventDefault(); hudCtx.toggleNotebook(); return; }
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

    if (e.code === 'AltLeft') e.preventDefault();
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!gamePaused() && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  // D4: the overlay's KEY-UP edge. This listener has drained the
  // movement Set since the first host and never told the open window
  // anything; DFU's buttons hear both edges (Button.cs:79-92) and the
  // travel popup's EXIT is the deferral that needs the release.
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Escape') backButtonHeld = false; if (e.code === 'AltLeft') e.preventDefault(); townTalk.keyup(e); modes?.keyup?.(e); });   // ROAD-E E1: the up seam reaches BOTH slots this host feeds - the outer overlay and the mode machine's
  // U45: Actions.ActivateCursor (Enter) frees the mouse during play
  // and takes it back - PlayerMouseLook.cursorActive, which had been
  // bound since I1 with no consumer at all. Without it the large HUD
  // is unreachable, because IsLargeHUDInteractable IS this flag.
  // AUDIT 58 (f3/input) - THE ONE READER. This host builds the mode
  // machine unconditionally, and that machine used to register a
  // SECOND bindCursorToggle over the same module-global flag
  // (player/pointerLock.js:54-81), so ONE Enter flipped it twice and
  // `cursorActive()` could never rise here at all - the large HUD's
  // eleven panels were unreachable by mouse in this host, and the
  // second flip fired a releaseLook/requestLook pair inside one event.
  // PlayerMouseLook.cs:190-198 reads the action ONCE per press behind
  // ONE guard (`!GameManager.IsGamePaused`), so the machine's guard is
  // OR'd into this binding instead of carrying a listener of its own
  // (scenes/worldModes.js's modalWindowUp, published on the object).
  // `modes` is the hoisted var this file's other listeners already
  // read through `?.`, so the closure reaches it once it is built.
  bindCursorToggle(canvas, () => gamePaused() || (modes?.modalWindowUp?.() ?? false), actionOf);
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
      e.button, hudCtx, { windowUp: gamePaused() })) return;
    // ROAD-Ar: the click that GRABS the pointer back is a UI gesture,
    // not a world click, and it presses and releases Mouse0 into the
    // gate exactly as a window's close button does - so it takes
    // SetClickDelay too (PlayerActivate.cs:1050-1054). ONLY on a real
    // acquisition: with the pointer already locked this click IS the
    // world's. (worldModes shares this host's `latch`, so its gate is
    // this gate.)
    if (document.pointerLockElement !== canvas) setClickDelay((latch.activate ??= createActivateGate()));
    requestLook(canvas);
  });   // U8b/U8c: native windows own the pointer
  canvas.addEventListener('wheel', (e) => { if (townTalk.wheel(e) || modes?.wheel?.(e) || mwViewWheel(e.deltaY)) e.preventDefault(); }, { passive: false });   // U-scroll: an open window owns the wheel; MW-D25: otherwise the Morrowind camera zoom
  // ROAD-C c2/S4: THE OTHER TWO PHASES. This host already routed
  // `pointerdown` into the mode machine; the automap's chrome is
  // press-HOLD and drag driven, so a host that delivers `down` alone
  // latches a drag that spins the map forever - and nothing errors.
  // The listeners are on the WINDOW, not the canvas, because a release
  // outside the canvas must still end the drag.
  addEventListener('pointermove', (e) => { modes?.pointermove?.(e); });
  // ROAD-C c2/S10: townTalk's slot needs the RELEASE too, for the same
  // reason. Its 'down' rides `townTalk.pointerdown` and its 'move'
  // rides `townTalk.hover` (the mousemove listener below), so this is
  // the third phase and the only one with no existing route - a town
  // map that never hears the release keeps panning forever.
  addEventListener('pointerup', (e) => { townTalk.pointer('up', e); modes?.pointerup?.(e); });
  // C9: RMB is a weapon control (drag-to-swing) exactly as the
  // dungeon host - the drag feeds the rig INSTEAD of the look.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    // U46: the HUD is not a window and owns no pointer handler, so the
    // virtual position lands in its one store on the way past - BEFORE
    // the overlay return, because an overlay up is exactly when the
    // spell-icon tooltip is allowed to show.
    trackHudPointer(canvas, e);
    trackLargeHudPointer(canvas, e);   // ROAD-Ar: HUDLarge's MouseEnter/MouseLeave (:361-372), for the activate gate's HUD guard
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
  // (dungeon.js:198, "a right-click on a window is the window's...
  // never a swing"), which these two hosts never got. It matters now
  // that the travel map makes RMB a ROUTINE gesture - its zoom - and
  // an ungated one fires a readied spell or looses an arrow at the
  // world behind the map.
  // AUDIT 39r: the button goes into the held-keys set too. InputManager
  // polls Mouse0/1/2 through the same GetKey dictionary as the keyboard
  // (:995/:1010/:1017), and this Set was keydown-fed only - so AutoRun
  // (Mouse2, the wheel) and the drawn bow's ActivateCenterObject
  // un-draw (Mouse0) could never read true. mouseCode owns the
  // Unity/DOM middle-button crossover; the RELEASE is unconditional.
  addEventListener('mousedown', (e) => { if (e.button === 2) rightHeld = true; const mc = mouseCode(e.button); if (mc) keys.add(mc); if (e.button === 2 && !townTalk.overlayActive && walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.attackInput(0, 0, true); } });   // M2
  addEventListener('mouseup', (e) => { if (e.button === 2) rightHeld = false; const mc = mouseCode(e.button); if (mc) keys.delete(mc); if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, false); });   // the RELEASE is never gated - a window opened mid-swing must still let go
  const touch = attachTouch(canvas, {   // mobile: stick synthesizes WASD; the right half is classified (TI1)
    look: (dx, dy) => {
      lookFilter.add(dx * lookScale(), -dy * lookScale() * lookInvert());   // AUDIT 28 W7: through the look filter (HANDEDNESS, mat4's law)
    },
    // TI1: the swipe is the RMB drag - the mousemove arm above, on a
    // finger: this host's rig on the street, the modal rig through
    // worldModes indoors, the M2 cast gate in front of both.
    attack: (dx, dy, held) => {
      if (!walkMode) { swipeHeld = false; return; }
      if (modeNow() === 'exterior') {
        swipeHeld = held;
        if (held && magic.interceptAttack(true)) return;   // M2: an armed cast eats the swing
        weaponRig.attackInput(dx, dy, held);
      } else {
        swipeHeld = false;
        modes?.attackInput?.(dx, dy, held);
      }
    },
    // TI1: the tap is a one-frame press of the activate action along
    // the finger's ray - A8's gate fires it on the release. A finger in
    // the docked bar's strip is no world tap at all.
    tap: (x, y) => {
      if (!ndcFromScreen(x, y, canvas.clientWidth, canvas.clientHeight, largeHudViewportRect(canvas.clientHeight))) return;
      _tapPoint = [x, y]; _tapArmed = 2; keys.add('Mouse0');
    },
    locked: () => lockOn.locked,
    dial: true,
    cycleMode: () => townTalk.nextMode(),   // T3-touch: the phone's F1-F4
    overlayActive: () => townTalk.overlayActive,
  });

  // ---- QX1: THE QUEST BRIDGE - THE MACHINE OVER THIS ONE CITY ----
  //
  // PX3 flagged this route as "this test host mounts no quest bridge",
  // and EIGHT sites in this file had each recorded that same absence
  // separately, as a deliberate decision: TickRest's `tickQuests: null`,
  // the inventory's `getQuest: null`, the character sheet's withheld
  // LOGBOOK button, the Status box's null macro context, the automap's
  // unstamped residence plates, the pause window's Quests tab, the pause
  // window's undrawn Chronicle button, and the exterior static-NPC pass.
  // ONE missing construction under all of them. It is built here, the
  // way world.js builds its own - and it mounts over THIS route's one
  // fixed city rather than over a stream: every location read below
  // answers `dfLocation` outright, which is the whole difference between
  // the two hosts. SEVEN of the eight read the machine now; the eighth
  // (the static-NPC pass) keeps C#'s empty-machine answer for a
  // different and narrower reason, written down at its own site - the
  // location is laid and batched before any bridge can exist here, and
  // the away arm cannot take a center out of a batch already built.
  //
  // The world seam is composed from the host's REAL objects (MapsFile,
  // BlocksFile, the faction dictionary, the one clock, the guard pool,
  // the overlay slot); members this route cannot honestly answer stay
  // ABSENT and the law modules read the charter's null through their own
  // `ctx.x?.()` - the headless charter, world.js's own posture. What is
  // deliberately absent here, and why:
  //   - THE TALK SEAMS (addQuestTopics, the six rumor doors, the four
  //     %f-faction NAME getters, removeNpcQuestor). This route runs no
  //     rumor mill, topic tree or NPC session at all - the same absence
  //     its bulletin board records when it opens on the location name
  //     alone. The faction-TYPE family beside them is a different
  //     question with a different producer - the persistent store - and
  //     is mounted below.
  //   - THE ITEM SEAMS (giveItemToPlayer and its four siblings) and the
  //     videos, faces, disease and cure doors, none of which has a
  //     producer in this file.
  //   (ROAD-G G2 struck the third entry that stood here - "CreateFoe's
  //   OUTDOOR PLACEMENT ARM ONLY... this route mints no exterior foe
  //   pool, only the watch". It mounts one now, and tryPlaceFoe's
  //   exterior arm is PlaceFoeExteriorLocation verbatim; see below.)
  // Gold, crime, the guard call, the hostility pair, time, reputation,
  // the FACTION STORE (the Person chain's faction-type reads, all over
  // the persistent clone factionRep owns - never the raw FACTION.TXT
  // dictionary), the site mount and the popup stack all DO have
  // producers here, so they are wired.
  const _questAudioSource = new QuestAudioSource(audio);   // E6: ONE source per machine
  const _questStore = () => (townTalk.factionDict ? ensureFactionRep(playerEntity, townTalk.factionDict) : null);
  /** PersistentFactionData.GetRegionFaction (:272-287): FindFactions
   *  (Province, -1, -1, region) and take the first row - the record
   *  both GetCurrentRegionFaction and GetCurrentRegionVampireClan
   *  read. C# throws on a miss; the port answers null, the refusal
   *  convention its People/Courts siblings already keep. world.js's
   *  twin (:4446-4450) asks the travel pixel for its region index;
   *  this route stands on ONE location for its whole life, so the
   *  region is `dfLocation.regionIndex` outright. */
  const _regionFaction = () => {
    const dict = _questStore()?.dict ?? null;
    if (!dict) return null;
    return findFactions(dict, { type: FACTION_TYPES.Province, region: dfLocation.regionIndex })[0] ?? null;
  };
  /** Quest parchment boxes land in whichever overlay slot is LIVE -
   *  the mode machine's when a mode is mounted, this host's townTalk
   *  slot otherwise - and they PUSH (DaggerfallMessageBox.Show is a
   *  uiManager.PushWindow), so a box arriving mid-rest suspends the rest
   *  instead of throwing it away. world.js's showQuestBox, minus the
   *  scene-cache arm this route has no streamer for. */
  let _questBoxWin = null;
  const showQuestBox = (box) => {
    const live = (modes?.questOverlay ?? null) === _questBoxWin || (townTalk?.overlay ?? null) === _questBoxWin;
    if (_questBoxWin && !_questBoxWin.done && live) { _questBoxWin.push([box]); return; }
    const win = new ServiceFlowWindow([box], { onClose: () => { if (_questBoxWin === win) _questBoxWin = null; } });
    _questBoxWin = win;
    if (modes?.showQuestOverlay?.(win)) return;
    townTalk.pushOverlay(win);
  };
  const questWorld = {
    // AUDIT 28 W4/F-B2: DFU's smaller-dungeon law lives INSIDE
    // MapsFile.GetLocation, so quest marker enumeration walks the FIVE
    // BLOCK dungeon when the law says so - and the machine is
    // late-bound here exactly as DFU consults its singleton.
    maps: Object.create(maps, {
      getLocation: { value: (r, l) => dungeonLocationFor(maps.getLocation(r, l), { questMachine: questBridge?.machine }) },
      getLocationByName: { value: (rn, ln) => dungeonLocationFor(maps.getLocationByName(rn, ln), { questMachine: questBridge?.machine }) },
    }),
    getBlock: (name) => blocks.getBlockByName(name),
    flatCaption: (archive, record) => pipeline.flatCaption(archive, record),   // NPC1: the =symbol_ macro's caption
    // AUDIT 39 (#23) / QX1 review: EVERY faction read below goes
    // through `_questStore()` - PlayerEntity.FactionData, the MUTABLE
    // clone factionRep owns - and never the raw FACTION.TXT dictionary
    // the reader holds. The write path (getReputation / changeReputation
    // below) has always been the clone, so a read off the file was a
    // read of a different Map: `change repute with _npc_ by 30` landed
    // on one and `when repute with _npc_ is at least N` asked the
    // other. world.js:4910 is the same line.
    getFactionData: (id) => _questStore()?.dict.get(id) ?? null,
    /** PersistentFactionData.FindFactions by type - Person.cs's
     *  _getRandomFactionOfType (:967-1018). Unmounted, a Person
     *  declared `factiontype Temple/Daedra/Witches_Coven` threw. */
    findFactionsOfType: (type) => { const s = _questStore(); return s ? [...s.dict.values()].filter((f) => f.type === type) : []; },
    /** FindFactionByTypeAndRegion (PersistentFactionData.cs:236-265),
     *  %rn/%rt's producer - world.js:4912-4925. */
    findFactionByTypeAndRegion: (type, regionIndex) => {
      const s = _questStore();
      return s ? findFactionByTypeAndRegion(s.dict, type, regionIndex) : null;
    },
    /** PlayerGPS.GetPeopleOfCurrentRegion (:440-457). */
    currentRegionPeople: () => getPeopleOfCurrentRegion(_questStore()?.dict ?? null, dfLocation.regionIndex)?.id ?? -1,
    /** PlayerGPS.GetCourtOfCurrentRegion (:469-483). */
    currentRegionCourt: () => getCourtOfCurrentRegion(_questStore()?.dict ?? null, dfLocation.regionIndex)?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionFaction (:459-467). */
    currentRegionFaction: () => _regionFaction()?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionVampireClan (:485-490): the SAME
     *  Province record's `vam` column. */
    currentRegionVampireClan: () => _regionFaction()?.vam ?? -1,
    /** (racialEffect as VampirismEffect).VampireClan - -1 when the PC
     *  is no vampire. */
    playerVampireClan: () => liveVampirism(playerEntity)?.clan ?? -1,
    /** VampirismEffect.GetClanName (:317-320). NULL - never '' - is
     *  what makes %vam print C#'s own "PC not a vampire" literal. */
    playerVampireClanName: () => {
      const clan = liveVampirism(playerEntity)?.clan ?? 0;
      if (!clan) return null;
      return _questStore()?.dict.get(clan)?.name ?? '';
    },
    // PlayerGPS's location reads. This route stands on ONE location for
    // its whole life and never leaves its rect, so each of these is a
    // constant where the streaming host has to ask the pixel.
    currentLocation: () => dfLocation,
    currentRegionIndex: () => dfLocation.regionIndex,
    currentLocationIndex: () => dfLocation.locationIndex ?? -1,
    currentLocationType: () => dfLocation.mapTableData?.locationType ?? null,
    currentRegionName: () => maps.getRegion(dfLocation.regionIndex)?.name ?? '',
    currentRegionRace: () => REGION_RACES[dfLocation.regionIndex] + 1,   // PlayerGPS.GetRaceOfCurrentRegion (:432-435)
    currentClimateIndex: () => locClimateIndex,
    currentWeatherKey: () => currentWeather() ?? null,   // Q5: the Weather trigger's read
    isPlayerInLocationRect: () => _musicInLocationRect(),
    playerPixel: () => _locPixel,   // F114: the quest clock's travel arm
    // QG1: CastSpellDo's two world reads, world.js:4828-4831's pair.
    // Without them the action self-completes at parse (actions.js:2742/:2749)
    // and a `cast X spell do` on this route could never be armed, whatever
    // the ready-spell doors above raise.
    getClassicSpellEffects: (spellID) => spellRecordOfIndex(spellID)?.effects ?? null,
    spellHasMatchForClassicEffect: (sp, effect) => (sp?.effects ?? []).some((e) =>
      ((e.type ?? 0) & 0xff) === ((effect.type ?? 0) & 0xff)
      && ((e.subType ?? 0) & 0xff) === ((effect.subType ?? 0) & 0xff)),
    legalRepNow: () => legalRepOf(playerEntity, dfLocation.regionIndex),   // %ltn's fourteen bands
    changeLegalRep: (amount) => changeLegalRep(playerEntity, dfLocation.regionIndex, amount),
    isHouseOwned: (buildingKey) => isHouseOwned(playerEntity.houses ?? [], dfLocation.regionIndex, buildingKey),
    buildingNameOpts: () => townTalk.nameOpts?.() ?? {},
    // %cbd - MacroHelper.CurrentBuilding (:849-867): inside a building
    // the name is REGENERATED from the building's own seed; outside one
    // C# answers "[invalid]", which is the handler's null arm.
    currentBuildingName: () => {
      const b = modes?.interiorBuilding;
      if (!b) return null;
      return generateBuildingName(b.nameSeed, b.buildingType, { ...(townTalk.nameOpts?.() ?? {}), factionId: b.factionId ?? 0 });
    },
    // B2: PcAt / IsPlayerHere / ConfigureFromPlayerLocation - the
    // mounted mode is the answer, exactly as in the streaming host.
    playerInside: () => {
      if ((modes?.mode ?? 'exterior') === 'dungeon') return { dungeon: { name: modes?.dungeonLocation?.name ?? '' } };
      const b = modes?.interiorBuilding;
      if (!b) return null;
      return { building: { buildingKey: b.buildingKey, buildingType: b.buildingType, factionId: b.factionId, name: b.name ?? '' } };
    },
    /** Place.AssignQuestResource's hot-place tail (Place.cs:508-527) -
     *  AddQuestResourceObjects over whatever site the player already
     *  stands in. The mode machine owns the mount and is already
     *  mode-aware (worldModes:1258), so this is world.js:4801's line
     *  over this host's own modes bag. */
    mountCurrentSiteQuestResources: () => modes?.mountQuestResources?.(),
    // ---- B1: THE FOE SPAWN SEAMS, in the fixed-city host too. Without
    // them `create foe` minted nothing here and no quest that kills or
    // meets a Foe could complete on this route.
    /** GameObjectHelper.CreateFoeGameObjects (:1243-1305), data side:
     *  `count` inactive handles, activation deferred to placement.
     *  Bridge-only, no host state - world.js:4809's call verbatim. */
    createFoeGameObjects: (foe, count) => mintQuestFoeWave(questBridge.machine, foe, count),
    /** CreateFoe.TryPlacement (:183-211), ALL THREE ARMS. The INSIDE
     *  two are the mode machine's - worldModes.tryPlaceQuestFoe places
     *  in a dungeon and in a building, the same producer world.js
     *  calls - and ROAD-G G2 built the third.
     *
     *  THE OUTDOOR ARM IS PlaceFoeExteriorLocation (:245-248), which is
     *  `PlaceFoeFreely(gameObjects, locationParent.transform)` - the
     *  DEFAULT 5/20 ring, not the wilderness 8/25 one, because
     *  TryPlacement (:203-206) picks it exactly when
     *  `IsPlayerInLocationRect`. This route stands inside its ONE
     *  city's rect for its whole life (`_musicInLocationRect` is
     *  `() => true`), so the wilderness arm (:252-257) has no reachable
     *  branch here at all and the ring is the default one, unqualified.
     *  Everything else is world.js:4913's arm term for term: the cast
     *  origin is the controller CENTRE (DFU rays from
     *  PlayerObject.transform.position, not the feet), the FOV is
     *  handed over in DEGREES (`fieldOfView()` answers radians), the
     *  occupancy test is `Physics.OverlapSphere(testPoint, 0.65f)` over
     *  every live record this host has in the street (:317-321 tests
     *  ANY collider, so the watch is in it), FinalizeFoe (:341-359)
     *  lifts a FLYING foe 1.5 off the probed floor and leaves a walker
     *  on it, and the foe LookAt's the player (:328).
     *
     *  A refusal is `false`, which leaves the wave pending and
     *  re-attempted on the next machine tick - TryPlacement's own
     *  failed-placement shape, and now a real one (no open spot) rather
     *  than a host with nowhere to put a foe. */
    tryPlaceFoe: (handle) => {
      if ((modes?.mode ?? 'exterior') !== 'exterior') return modes?.tryPlaceQuestFoe?.(handle) ?? false;
      if (!walkMode) return false;   // the fly camera has no controller capsule to place around
      const feet = player.pos;
      const env = placeFoeEnv({
        collider,
        playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
        playerYawRad: cam.yaw,
        fovDegrees: fieldOfView() * 180 / Math.PI,
        isOccupied: entityOccupancy((f) => f.ai?.feet, exteriorFoePool, feet),
      });
      const spot = placeFoeFreely(env);
      if (!spot) return false;
      const foe = handle.foe;
      const _fly = (ENEMY_BASICS[foe.foeType]?.behaviour ?? 'General') === 'Flying';
      exteriorFoes.spawnFoe(foe.foeType, [spot.x, _fly ? spot.y + 1.5 : spot.y, spot.z], {
        gender: questFoeGender(foe),
        yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player (CreateFoe.cs:328)
        questBehaviour: handle.behaviour,
      }).catch((e) => console.error('[quest] exterior foe stand failed:', e?.message ?? e));
      return true;
    },
    /** GameManager.RaiseOnEncounterEvent - its one core consumer is the
     *  rest window's AbortRestForEnemySpawn, which worldModes routes
     *  back to THIS file's own slot (its `abortRestForEnemySpawn`). */
    raiseOnEncounterEvent: () => modes?.raiseOnEncounterEvent?.(),
    /** PlayerGPS.DiscoverLocation (:872-890) - resolve by name and file
     *  it, THROWING when the pair names nothing, C#'s own throw. */
    discoverLocation: (regionName_, locationName_) => {
      const l = maps.getLocationByName(regionName_, locationName_);
      if (!l?.loaded) throw new Error(`Error finding location ${regionName_} : ${locationName_}`);
      discoverLocation(l.mapTableData.mapId, { regionName: l.regionName, locationName: l.name });
    },
    addNote: (text) => questBridge?.notebook?.addNote(text),
    addNoteTokens: (tokens) => questBridge?.notebook?.addNoteTokens(tokens),
  };
  questBridge = createQuestBridge({
    data: questPack,
    world: questWorld,
    playerEntity,
    classicSeconds: () => playerTicker.classicMinutes * 60,
    // The notebook's three header reads (PlayerNotebook's own ctx).
    dateTimeString: () => dateTimeString(dateFromClassicMinutes(playerTicker.classicMinutes)),
    midDateTimeString: () => midDateTimeString(dateFromClassicMinutes(playerTicker.classicMinutes)),
    cityName: () => dfLocation.name ?? locationName,
    addHUDText: (t) => townTalk.say(t),
    // The tokens arrive ALREADY expanded and already chunked - Quest.cs:785.
    showPopup: (_q, tokens) => { const rows = tokensToRows(tokens); if (rows.length) showQuestBox({ rows }); },
    showPrompt: (q, message, respond) => showQuestBox({
      rows: tokensToRows(message.getTextTokens(-1, q.rolls)),
      buttons: 'YesNo',
      onYes: () => { respond(true); return []; },
      onNo: () => { respond(false); return []; },
    }),
    // QG1: PromptMulti's 2-4 BUTTONS.RCI records; the click answers the
    // record NUMBER back and the action routes by value.
    showPromptMulti: (q, message, buttons, respond) => showQuestBox({
      rows: tokensToRows(message.getTextTokens(-1, q.rolls)),
      buttonsMulti: buttons,
      onButton: (b) => { respond(b); return []; },
    }),
    // E6: PlaySound's busy skip over the ONE source (PlaySound.cs:110-116).
    // AUDIT 58: the table id goes through the ID door, as
    // PlaySound.cs:74-75 does at create - the four-hosts twin of the
    // world host's hook.
    playSound: (id) => {
      if (_questAudioSource.isPlaying()) return false;
      _questAudioSource.playOneShotId(id);
      return true;
    },
    // GivePc.cs:84 and its siblings ask IsPlayerInTown(TRUE, TRUE) -
    // both optional flags, mustBeInLocationRect AND mustBeOutside - so
    // a quest item handed over while the player stands in a shop goes
    // to the pending pile rather than straight into the pack. The
    // flagless form is a different question and has its own caller
    // below (`inTownLocation`, CanRest's second arm). This is the
    // closure S40 gave this host, and world.js:5485's line.
    isPlayerInTown: () => _isPlayerInTownStrict(),
    // Q5: the un-pended quest actions' doors, all of them this host's
    // own arms - the crime setter (V4's SuppressCrime gate), the gold
    // pair PayMoney needs, TrainPc's bare clock move, and F036's
    // witness-arm caller with the live watch.
    setPlayerCrime: (crime) => setCrimeCommitted(playerEntity, crime),
    getGoldPieces: () => goldAmount(playerEntity),
    deductGoldPieces: (n) => deductGoldPieces(playerEntity, n),
    getGold: () => goldAmount(playerEntity),
    getTotalGold: () => totalGoldAmount(playerEntity),   // PayMoney's `money` arm - coins PLUS letters
    deductGold: (n) => deductGold(playerEntity, n),
    addGold: (n) => addGold(playerEntity, n),
    raiseTime: (seconds) => playerTicker.advance(seconds / 60),
    spawnCityGuards: (immediate) => (immediate ? _crimeResponse() : _witnessResponse()),
    // ROAD-B: GameManager.cs:790-806 through the ONE law
    // (hostCombat.makeEnemiesHostile) over this route's whole live
    // database - BOTH street pools above ground (ROAD-G G2 mounted the
    // encounter pool beside the watch) and the mounted mode's pool.
    // The pool term is `insideFoes`, the UNNARROWED walk
    // (worldModes:6492): MakeEnemiesHostile flips every active enemy,
    // not only the ones carrying a QuestResourceBehaviour. The narrowed
    // walk (`liveQuestFoes`) has its own caller below - questFoeInstances,
    // which is the one seam that really does ask the narrower question.
    makeEnemiesHostile: _makeEnemiesHostile,
    // GameManager.ClearEnemies destroys every active enemy object; the
    // encounter half is world.js:5416's line and the watch half is this
    // host's own (cityGuards owns its live list).
    clearEnemies: () => { cityGuards.clearLive?.(); for (const f of [...exteriorFoes.foes]) { if (!f.dead) exteriorFoes.removeFoe(f); } },
    // MT-iii/MT-iv: ChangeFoeInfighting / ChangeFoeTeam's instance walk
    // over ONE database - the inside pool unioned in, or SetComplete
    // never completes and the action re-runs every tick for ever.
    questFoeInstances: (symbol) => {
      const want = symbol?.name ?? null;
      if (want == null) return [];
      return [...exteriorFoes.foes, ...cityGuards.guards, ...(modes?.liveQuestFoes?.() ?? [])].filter((f) =>
        !f.dead && f.questBehaviour && f.questBehaviour.targetSymbol?.name === want);
    },
    getReputation: (fid) => { const st = _questStore(); return st ? getReputation(st, fid) : 0; },
    changeReputation: (fid, amount, propagate) => { const st = _questStore(); if (st) changeReputation(st, fid, amount, propagate); },
    changeLegalRep: (amount) => questWorld.changeLegalRep(amount),
  });
  questBridge.onInitWorld();   // QuestMachine's OnInitWorld - this route's ONE city is its world
  if (_questStartPending) questInitAtGameStart();   // chargen got here first

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
    activateDir: () => _tapDir,   // TI1: the tap's ray for the modal ladders (eyeDir)
    tapLock,   // TI1c: the lock's arm for the modal ladders - the cone pick the exterior ladder takes
    onModalView: (proj, view) => { _lastProj = proj; _lastView = view; placeLockDot(proj, view); },   // TI1c: the modal pass's lens - the tap ray and the dot ride it as they ride the exterior pass's
    canvas, renderer, player, cam, keys, latch, blocks,
    // S40: IsPlayerInTown() with both flags at their defaults - the
    // location TYPE alone (PlayerGPS.cs:504-527), which is what
    // CanRest's inside-a-building arm asks.
    inTownLocation: () => isPlayerInTown(_musicLocationType()),
    // AUDIT 39 (#22): PlayerEntity.SpawnCityGuards(bool) - the theft
    // arm's caller, which neither host answered. Same shape as the
    // world host's.
    spawnCityGuards: (immediate) => (immediate ? _crimeResponse() : _witnessResponse()),
    // ROAD-B / G2: the arrest interception for the mode machine's
    // INDOOR watch - world.js's twin. The court flow is the host's, so
    // the interior pool asks through here rather than owning a copy.
    onGuardHit: (dmg, apply) => arrestFlow.onGuardHit(dmg, apply),
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
    // QX1/U43: ...and the journal, so L and N answer inside a shop off
    // this host's builder too (worldModes' toggleLogbook/toggleNotebook
    // read host.makeJournal and nothing else).
    makeJournal: (mode) => makeJournalWindow(mode),
    magic, spellsByIndex: () => spellsByIndex,   // M2: the one cast engine + SPELLS.STD ride into the interior arm
    townTalk,   // U23: the interior host borrows FACTION.TXT/TEXT.RSC + the talk seam
    // R1: without this the exterior-lock anti-grind record and
    // DiscoverBuilding silently no-op in the ?exterior host (locId
    // null skips both) - the same `region:location` string the world
    // host and townTalk's reveal use.
    discoveryLocationId: () => `${dfLocation.regionIndex}:${dfLocation.name ?? locationName}`,
    // QX1: THE BRIDGE RIDES INTO THE MODE MACHINE. This is what makes
    // the machine mount OVER THIS CITY rather than beside it: worldModes
    // runs `questBridge.mountScene(adapter, SITE_TYPES.Building,
    // buildingKey)` on every interior it opens and `SITE_TYPES.Dungeon`
    // on the crawl, walks the site links for the automap's active-quest
    // buildings, and registers a static-NPC click as
    // `setLastNPCClicked`. Without it every one of those evaporated
    // through its own `questBridge?.` - the AUDIT 24 seam shape.
    questBridge,
    // PX17c/QX1: the interior pause reads the SAME rail the street
    // pause does (worldModes hands these two to its openPauseFlow), so
    // a pause in a tavern is not a different journal.
    pauseQuestMessages, pauseQuestLog,
    // TP2: a Recall cast inside a shop or the crawl raises THIS host's
    // 4000 box, exactly as world.js hands its own prompt down. Without
    // it the mounted dungeon context kept its standalone refusal and a
    // cast underground did nothing at all.
    onTeleport: () => teleportPrompt(),
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
    // ...and the town signs, in the same ray (PlayerActivate.cs:314,
    // :393-398). This probe host runs no rumor mill, so it hands over
    // no `bulletinBoardNews` and the board opens on the location name
    // alone - which is the arm C# itself takes when the mill has
    // nothing fit for a sign (:727 guards only the second half).
    boardTargets: () => bulletinBoards,
    // ...and that name is not free: the heading is PlayerGPS
    // .CurrentLocalizedLocationName (PlayerActivate.cs:721), which
    // worldModes reads off `buildingDirectory` (:1649) and nowhere
    // else. Without this key the "location name alone" arm above drew
    // a BLANK parchment - one empty row, the starter label shifted off
    // (bulletinBoard.js:97). This host knows its own location outright,
    // so it hands over the same bag the world host builds; `buildings`
    // is empty (that list is the houses-for-sale roll's, and every
    // consumer guards on `?.buildings?.length`), while the mapId,
    // region and port-town byte are the host's real ones.
    buildingDirectory: () => ({
      buildings: [],
      mapId: dfLocation?.mapTableData?.mapId ?? 0,
      regionIndex: dfLocation.regionIndex ?? 0,
      locationName: dfLocation.name ?? locationName,
      regionName: maps.getRegionName(dfLocation.regionIndex ?? 0) ?? '',
      portTownAndUnknown: dfLocation.exterior?.exteriorData?.portTownAndUnknown ?? 0,
    }),
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
  /** AUDIT 58 (f2/hosts): THE ENCHANT CTX, MOUNTED HERE TOO - THE FOUR
   *  HOSTS RULE, and the third host that owed it.
   *
   *  scenes/hostEnchant.js:1-2 states the law as "one body, mounted by
   *  every host that can hold an enchanted item", and this host can:
   *  it mints starting gear, opens the native inventory (whose USE arm
   *  is systems/useItem.js's doItemEnchantmentPayloads with NO per-call
   *  ctx - "the cast arms ride the host's mounted enchantCtx"), and its
   *  mode machine reaches shop shelves (shopStock.js's MagicItems
   *  group) and dungeon loot. It mounted NOTHING, so
   *  setDefaultEnchantCtx's `_defaultCtx` stayed null for the whole
   *  session (enchantments.js:249-251) and every arm that folds it in
   *  optional-chained into silence - the exact FS1 shape the standalone
   *  ?dungeon host was in before wave D. Worse: exterior.js builds
   *  createWorldModes, which passes `enchantCtx: false` to
   *  buildDungeonContext unconditionally on the stated premise that an
   *  OUTER host already owns it - true of ?world and false here - so a
   *  dungeon or a shop entered from this route mounted nothing either.
   *
   *  What was dead, with the ctx null: CastWhenUsed and CastWhenStrikes
   *  found no spell record and still billed 10 condition
   *  (enchantments.js:333-341, :372-379), HealthLeech never billed the
   *  wearer and stamped its last-used minute at epoch 0
   *  (:556-577), CastWhenHeld could never take the resting degrade rate
   *  (:364), and the held/round scans - VampiricEffect AtRange,
   *  ExtraSpellPts' season/moon/affinity, RegensHealth's sun and dark
   *  arms, BadReactionsFrom - saw nothing at all.
   *
   *  The pools are this host's own, through the SAME shared law
   *  world.js routes by (shared.js liveEnchantFoes /
   *  liveEnchantFoeSinks / enchantFoeHost): one arm per live mode,
   *  because DFU has one active-enemy database per scene
   *  (PlayerGPS.cs:747-777), and the sinks routed by POOL MEMBERSHIP so
   *  a record never knocks back against the wrong host's collider. This
   *  host's exterior pool is the WATCH alone - it mints no encounter
   *  foes - and the interior/dungeon arms are worldModes' own
   *  (`insideFoes` / `insideFoeSinksFor` / `insideReplaceFoe`, and
   *  `modes.dungeonCtx`).
   *
   *  Placed AFTER `var modes = ...` so the fold routes by live mode the
   *  way EC1 routes world.js's, and it is the same BODY - a hand-rolled
   *  second ctx here is the shape FS1 was written about. */
  {
    // ROAD-G G2: the four live reads are at FUNCTION scope now, not
    // inside this block - the cast engine above takes the same pool and
    // the same pool-membership sinks router (world.js keeps its twins
    // at function scope for exactly that reason), and two definitions
    // would be two laws the day one of them moves. See `_mode` /
    // `_insidePool` / `enchantFeet` / `enchantFoes` / `enchantFoeSinks`
    // above the cast engine.
    /** SD1: SoulBound's break release and the Sanguine Rose's
     *  Daedroth, through DFU's own placement - in whichever world the
     *  player is actually standing in. ROAD-G G2 GAVE THE EXTERIOR ARM
     *  ITS POOL: the sentence that stood here said "above ground this
     *  host's only pool is the WATCH, which mints watchmen and exposes
     *  no free spawn pair", so a soul released or a Rose used in the
     *  street released nothing at all. That premise died with the
     *  encounter mount above, and world.js:2355-2371 is the shape.
     *  INTERIOR still refuses - worldModes' interior pool exposes no
     *  loose-spawn door - which is EC1's answer and world.js's own for
     *  the same mode. */
    const _standLooseFoe = (mobileType, o = {}) => {
      const mode = _mode();
      if (_mode() === 'interior') return modes?.insideStandLooseFoe?.(mobileType, o) ?? null;   // ROAD-G G1: a building stands it through the interior pool (CreateFoe.cs:219-233), the same door world.js reaches - THE FOUR HOSTS RULE
      if (mode !== 'exterior' && mode !== 'dungeon') return null;
      const d = mode === 'dungeon' ? (modes?.dungeonCtx ?? null) : null;
      return standLooseFoe({
        collider: d ? d.collider : collider,
        feet: enchantFeet(),
        yawRad: cam.yaw,
        fovDegrees: fieldOfView() * 180 / Math.PI,   // fieldOfView() answers RADIANS
        foes: enchantFoes(),
        spawn: (mt, pos, so) => (d
          ? d.spawnLooseFoe(mt, pos, { yawRad: so.yawRad, allied: so.allied })
          : exteriorFoes.spawnFoe(mt, pos, { yaw: so.yawRad, allied: so.allied })),
      }, mobileType, o);
    };
    /** V3: the Wabbajack's transform, routed by the same POOL
     *  MEMBERSHIP the sinks are - WabbajackEffect.cs:63-95 removes the
     *  struck enemy and CreateEnemy's the new career under its OWN
     *  parent transform, so the pool that owns the billboard is the one
     *  that must do both. Hoisted out of the mount literal for the
     *  reason world.js's twin is: a foe door that names a host pool
     *  from inside the ctx is the defect the AUDIT 58 review found
     *  there.
     *
     *  ROAD-G G2: THE EXTERIOR ARM TRANSFORMS NOW. It refused, and the
     *  refusal was written down honestly - `createCityGuards` exposes
     *  no remove/spawn pair, so the only reach available would have
     *  been another host's. The encounter pool mounted above owns both,
     *  so an encounter or quest foe struck in the street is removed and
     *  re-stood by the pool that owns its billboard, exactly as
     *  world.js:2297-2298 does it. ROAD-G TAIL: a WATCHMAN transforms
     *  too, through removeGuard. (The sentence that stood here:) it was left standing:
     *  the street pool cannot remove a record it does not own, which is
     *  the same departure worldModes records for the indoor watch. */
    const _enchantReplaceFoe = (targetEntity, mobileType) => {
      const f = enchantFoes().find((x) => !x.dead && x.entity === targetEntity);
      if (!f) return;
      if (f.questBehaviour && !f.questBehaviour.isFoeDead) return;
      const feet = f.ai?.feet ? centreFromFeet(f.ai.feet, f.idleH ?? f.ai.height) : enchantFeet();   // REVIEW 2026-09-05: WabbajackEffect.cs:90 hands CreateEnemy the struck foe's TRANSFORM (its sprite centre); the spawn chain reads a marker
      const missing = (targetEntity.maxHealth ?? 0) - (targetEntity.health ?? 0);
      const stamp = (nf) => {
        if (!nf?.entity) return;
        nf.entity.wabbajackActive = true;   // once per creature (WabbajackEffect:68)
        nf.entity.health -= missing;        // carry over damage (:94)
      };
      const host = enchantFoeHost(f, modes?.dungeonCtx ?? null, _insidePool);
      if (host === 'dungeon') { modes?.dungeonCtx.replaceFoe?.(targetEntity, mobileType); return; }
      if (host === 'inside') { Promise.resolve(modes?.insideReplaceFoe?.(f, mobileType, feet)).then(stamp).catch(() => {}); return; }
      // ROAD-G TAIL: the WATCH transforms too - the guard pool removes its own
      // record (removeGuard), the encounter pool re-stands (world.js's route)
      if (cityGuards.guards.includes(f)) cityGuards.removeGuard(f);
      else exteriorFoes.removeFoe(f);
      exteriorFoes.spawnFoe(mobileType, feet).then(stamp).catch(() => {});
    };
    setDefaultEnchantCtx(createEnchantCtx({
      playerEntity,
      spellsByIndex: () => spellsByIndex,
      now: () => Math.floor(playerTicker.classicMinutes),
      sinks: {
        hurt: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
        heal: (n) => { if (n > 0) { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); surfacePlayer(); } },
      },
      playerSpellSinks,
      say: (l) => townTalk.say(l),
      magic,
      foes: () => enchantFoes(),
      foeSinks: (f) => enchantFoeSinks(f),
      feet: () => enchantFeet(),
      standLooseFoe: _standLooseFoe,
      // V3: Azura's TEXT.RSC popup, through this host's overlay slot.
      messageBox: (id) => {
        const lines = plainLines(townTalk.lines(id));
        if (lines?.length) townTalk.showOverlay(new ChoiceWindow({ lines }));
      },
      // U52: the Oghma opens THIS host's one sheet construction.
      openCharacterSheet: () => townTalk.showOverlay(makeCharSheetWindow()),
      replaceFoe: (targetEntity, mobileType) => _enchantReplaceFoe(targetEntity, mobileType),
    }));
  }
  // E3 - THE CONSOLE. ExteriorAutomap.Start (:417) registers its two
  // verbs; this host owns that window too, so it registers them the way
  // world.js does. It has no travel map (that door is world.js's), so
  // TravelMapConsoleCommands is not this host's to register - and the
  // commands are still REACHABLE from here, because the database is one
  // static class in DFU and one module here.
  registerExteriorAutomapConsoleCommands({ isPlayerInside: () => (modes?.mode ?? 'exterior') !== 'exterior' });
  installConsoleProbe();
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
  // first move). Race: the CLIMATE's People, live a dozen lines below
  // since AUDIT 23 (characters-4) - PopulationManager.cs:94's
  // populationRace through GetEntityRace's Redguard/Nord/default-Breton
  // switch (:320-335) over FactionFile.cs:612-615's numbering, so
  // Daggerfall = Breton is the table's answer and not a hardcode.
  // Each pool person owns a live billboard batch (the C11
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
  ambience.onPlayEffect = (clip, playerPos) => sky.onAmbientEffect(playerPos);   // DS1: AmbientEffectsPlayer.OnPlayEffect -> Dynamic Skies' LightningFlashListener
  // AUDIT 58 (F089's other host): AmbientEffectsPlayer.Start subscribes
  // PlayerGPS.OnEnterLocationRect on EVERY instance (:89), and the
  // handler arms IsCemeteryNearby when the entered location is a
  // Graveyard and the player is outside (:518-529). This host loads ONE
  // location and stands in it - `_musicInLocationRect()` is constantly
  // true (:751) - so the rect is entered exactly once, at load, and the
  // arming edge is here rather than on a poll. Without it a graveyard
  // opened as ?exterior was silent while the streaming host howled.
  ambience.setCemeteryNearby(_musicLocationType() === LOCATION_TYPES.Graveyard);
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
    if (!gamePaused()) {
      if ((rightHeld || swipeHeld) && walkMode && modeNow() === 'exterior' && !weaponRig.playerWeapon.machine?.isBow) lookFilter.settle();
      else lookFilter.tick(dt, cam);
      _lockChest = lockOn.tick(dt, cam, cam.pos, lookFilter);   // TI1: the lock pays its facing into the same filter, owed to the NEXT tick like a look
    }
    // TI1: the tap's one-frame press. Armed 2 on the tap (the key is
    // already down): this frame counts to 1 and the gate sees the
    // press; next frame counts to 0, the key lifts, the ray is built
    // through the frame the finger saw, and the gate fires the
    // activation on that release. The frame after clears the ray.
    if (_tapArmed > 0 && --_tapArmed === 0) {
      keys.delete('Mouse0');
      _tapDir = (_tapPoint && _lastProj) ? rayDirFromScreen(_tapPoint[0], _tapPoint[1], canvas.clientWidth, canvas.clientHeight, _lastProj, _lastView, cam.pos, largeHudViewportRect(canvas.clientHeight)) : null;
    } else if (_tapArmed === 0 && _tapPoint) { _tapPoint = null; _tapDir = null; }
    // AUDIT 28 W9: CameraRecoiler.Update - the reel from a hit, on the
    // detector's loss from the vitals rig, same paused gate (:50-51).
    cameraRecoiler.update(dt, cam, { healthLost: lastHealthLost(), healthLostPercent: lastHealthLostPercent(), paused: gamePaused() });
    // AUDIT 28 W10: HeadBobber.Update - the walk bob and nod, the landing
    // dip; the position rides player.eye as a world offset, the nod is a
    // per-frame offset on the look (removed and re-applied each frame).
    {
      const bob = headBobber.update(dt, cam, {
        health: playerEntity.health, paused: gamePaused(), climbing: !!player.climb?.isClimbing, grounded: !!player.grounded,
        swimming: !!player.swimming, running: !!player.isRunning, crouching: !!player.crouching, riding: !!player.riding, levitating: !!player.levitating,   // TR1: the Horse bob style
        velocity: player.moveSpeed || 0, moving: !!(player.moveForward || player.moveStrafe),
      });
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);   // HANDEDNESS (mat4's law): right = (cos, 0, -sin)
      player.bobOffset = [cy * bob[0], bob[1], -sy * bob[0]];
    }
    last = now;
    lookGate(gamePaused());   // a window up frees the cursor; closing re-locks

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
    // A6: FrictionMotor.GroundedMovement's head-dip guard reads
    // IsParalyzed itself (:90-93) - the zeroed input bag below is
    // the movement half of the same law, not this one.
    player.paralyzed = paralyzed;
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
      // QX1: QuestMachine.Update's pacing (QuestMachine.cs:305-320) -
      // the bridge holds the ticksPerSecond timer, so the frame just
      // hands it real seconds. Behind the SAME overlay gate the clock
      // takes above: DFU's PauseGame zeroes Time.timeScale, and
      // QuestMachine.Update is an Update.
      if (!_overlayHeld) questBridge?.tick(dt);
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
      const moving = !paralyzed && anyMove(mv);   // AUDIT 39: dungeon.js:504's shape - a frozen player takes no stride
      // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
      // gates movement and the jump only (DecideHeightAction has no check).
      // AUDIT 39r: and so does the SPEED-ADJUSTMENT capture. DFU zeroes the
      // movement VECTOR (FrictionMotor :75-81, AcrobatMotor :135-141);
      // CaptureInputSpeedAdjustment runs in Update behind a levitate gate
      // and nothing else. Dropping run/sneak/autoRun/back from this bag read
      // as a RELEASE to the motor's press-edge latches, so a key held
      // through the paralysis fired a synthetic press on the frame it lifted.
      if (!_overlayHeld) player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: held(keys, 'Run'), autoRun: held(keys, 'AutoRun'), back: mv.backwards, sneak: held(keys, 'Sneak'), jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
        forward: axes.forward,   // AUDIT 28 W8: InputManager's axes - accelerated under MovementAcceleration, the held difference without
        strafe: axes.strafe,
        run: held(keys, 'Run'),
        // AUDIT 39: PlayerSpeedChanger's AutoRun latch (:82-99) - the
        // press flips ToggleRun; MoveBackwards is its cancel key.
        autoRun: held(keys, 'AutoRun'),
        back: mv.backwards,
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
      // a12: SwitchHand (H) - ActionComplete's RELEASE edge
      // (WeaponManager.cs:272), so the latch is inverted against Z's.
      const hNowW = held(keys, 'SwitchHand');
      if (!hNowW && hPrevW) weaponRig.switchHand();
      hPrevW = hNowW;
      // P14 fall damage (host parity). FD1: the outdoor-water
      // exemption is live here too - playerGroundTileRaw below is this
      // host's twin of world.js's FS1 probe, read off the same
      // locationTilemap and the same 6.4-unit stride the ground draw
      // uses, so the two hosts cannot answer differently for the same
      // ground.
      applyFallLanding(playerEntity, player.landedFallDistance, {
        sound: (id, vol) => audio.playOneShot(id, vol),   // AUDIT 58: the caller's FootstepVolumeScale rides through
        inOutdoorWater: isOutdoorWaterTile(playerGroundTileRaw()),
      });
      // ROAD-B (b3): the exterior surface model, recomputed where
      // PlayerMotor.Update recomputes it (:367-369) and before the
      // consumers below read it.
      const _surf = exteriorSurfaceNow();
      // PlayerHeightChanger's sink reads `OnExteriorWater == Swimming`
      // alone (:127, :294, :326, :550) - WaterWalking splashes but
      // never sinks the capsule. A6 left this flag false pending
      // "Wave B's exterior-water slice"; this is that slice.
      player.onExteriorWater = _surf.water === ON_EXTERIOR_WATER.Swimming;
      // FS-slice: PlayerFootsteps - the exterior stride.
      {
        // PlayerFootsteps.cs:116 - "Play splash footsteps whether
        // player is walking on or swimming in exterior water".
        const _onWater = _surf.water !== ON_EXTERIOR_WATER.None;
        const _step = footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          standingStill: !moving,
          halfSpeed: player.movingLessThanHalfSpeed,
          onFoot: isOnFoot(player.transportMode),   // :221-227, the mounted gate's water exception
          onExteriorWater: _onWater,
        }, pickFootstepSet({
          inside: false, winter: season === SEASON.Winter, climateIndex: locClimateIndex,
          onExteriorWater: _onWater,
          onExteriorPath: _surf.path,               // OnPathTile: records 46, 47, 55
          onStaticGeometry: _surf.staticGeometry,
        }));
        if (_step) audio.playOneShot(_step.clip, _step.volume);
      }
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      // DC1: PlayerDeath.Update's camera sink (per-frame off the fresh eye array).
      if (townTalk.overlay instanceof DeathScreen) cam.pos[1] -= townTalk.overlay.drop;
      // A8 - POINTER PARITY, THE FLAG AT THIS LINE RETIRED. Mouse0 is
      // DFU's ActivateCenterObject: the readied spell fires on its
      // PRESS (EntityEffectManager.cs:250) and the world activation
      // runs on its RELEASE (PlayerActivate.cs:279), with a readied
      // non-touch spell blocking the activation outright. The whole
      // of that law - castPending included - is in
      // systems/activateGate.js so all four hosts read one copy.
      // The port's E stays live BESIDE it (DFU binds E to
      // AbortSpell; a recorded departure, not a gap this slice closes).
      // ROAD-Ar: the gate's last three inputs, which A8 declared and
      // no host passed. `paused` is InputManager's own return under an
      // open window (:486-503) and carries RemoveWindow's 0.3 s click
      // delay with it; `hudBlocked` is PlayerActivate.cs:230-236;
      // `touchSpell` is its stated exception at :250-258.
      // a recorded departure). ROAD-Ar R10: the swing below is the raw
      // right button - DFU's own 'Mouse1' (InputManager.cs:1010) - but
      // never read through held(), so a SwingWeapon rebind is inert.

      const _act = activateFrame((latch.activate ??= createActivateGate()), {
        down: held(keys, 'ActivateCenterObject'),
        hasReadySpell: magic.spellArmed(),
        touchSpell: magic.readied()?.rangeType === 1,   // rangeType 1 is ByTouch (spellcast.js:197)
        hudBlocked: activeMouseOverLargeHUD(),
        paused: _overlayHeld,
      });
      if (_act.cast) magic.interceptAttack(true);   // the frame's firePending sends it down the live look
      const useHeld = keys.has('KeyE');   // I2 departure, kept beside A8's Mouse0: DFU binds E to AbortSpell
      if ((_act.activate || (useHeld && !latch.use)) && !modes.transitioning) {
        // T3b: a townsperson under the ray wins the activation (the
        // PlayerActivate nearest-hit order); G3: a guard corpse next
        // (loot pickup on the dungeon's S2 shape); doors otherwise.
        const useFwd = _tapDir ?? [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];   // TI1: the tap's ray, else the centre
        // QG1/ROAD-G G2: the quest-resource click arm runs FIRST and
        // does not consume the activation (PlayerActivate.cs:325-339 -
        // the Hit Checks region's opening arm, no return, skipped in
        // Info mode). It had no place on this route while nothing could
        // stand a quest foe in the street; CreateFoe's exterior arm
        // above does, so `clicked foe` has a ray to be seen by.
        if (getInteractionMode() !== 'info') {
          const qf = pickQuestFoe(cam.pos, useFwd, exteriorFoePool(), collider);
          if (qf) qf.questBehaviour.doClick();
        }
        // TI1: a tap on a live foe is the LOCK (player/lockOn.js),
        // toggled, and the activation ends there - the ladder has no
        // arm for a living enemy but the quest one above, which ran.
        if (_tapDir && tapLock(cam.pos, useFwd, exteriorFoePool(), collider)) { /* TI1c: the tap was the lock */ }
        else if (!townTalk.tryActivate(cam.pos, useFwd, _livePersons)) {
          // AUDIT 24 (wave 38)'s law, on this host: BOTH corpse pools go
          // into ONE pick, because which body you open is
          // PlayerActivate's nearest hit and not which pool the host
          // happens to ask first.
          const corpseTargets = [...cityGuards.lootTargets(), ...exteriorFoes.lootTargets()];
          const lootKey = pickActivatable(cam.pos, useFwd, corpseTargets, collider);
          const dropKey = lootKey ? null : pickActivatable(cam.pos, useFwd, droppedLoot.lootTargets(), collider);
          if (lootKey) { (lootKey.startsWith('foeCorpse:') ? exteriorFoes : cityGuards).takeLoot(lootKey, (l) => townTalk.say(l)); surfacePlayer(); }
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
              loot: droppedLootHooks(pile),   // G5: DaggerfallLoot's own identity
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
    // ROAD-E E5: the DOCKED large HUD shrinks the world pass rather
    // than covering it (ViewportChanger.cs:56-62), and Unity derives a
    // camera's aspect from its viewport - so the lens takes the bar's
    // height out of its denominator here, and the sky, which draws
    // into the same rect, takes the same number.
    const worldAspect = largeHudWorldAspect(canvas.clientWidth, canvas.clientHeight);
    const proj = mirrorProjectionX(perspective(   // HANDEDNESS (mat4's law)
      fieldOfView(),
      worldAspect,
      0.1,
      Math.max(2000, extentX * 4)
    ));
    const view = lookAt(eye, target, [0, 1, 0]);
    _lastProj = proj; _lastView = view;   // TI1: the tap ray unprojects through the frame the finger saw
    placeLockDot(proj, view);   // TI1c: through the exterior pass's lens - the modal pass hands its own in (onModalView)
    if (cullOn) frustumPlanes(multiply(proj, view, _pv), _planes);   // EV3: the same matrices the draws ride

    // World clock (R5): sun direction/intensity and ambient follow the time
    // of day; the sun is off at night leaving the 0.25 ambient floor.
    const minute = minuteNow();
    // A1: the season poll, DaggerfallLocation.Update's own place on
    // the frame - beside the weather drain, and ungated by ?weather.
    refreshSeason();
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
    // WX2: the front's word for this frame (world.js's twin note).
    // ?front=off is the slice's kill switch (the arc's rule: every slice
    // has one) - the row's numbers whole and DFU's cap on the cut, under
    // the enhanced sky, for gates and shots that want WX1's volume.
    const enhancedFront = !!sky?.cloudShadow && params.get('front') !== 'off';
    // WX2a (AUDIT 57): a change the player was not PRESENT for - a load,
    // a travel landing, a respawn roll, a day rolled while underground -
    // is a jump, not a front. The sim stamps it; the sky drops its eased
    // row and the wind its front, and the ground takes the word whole.
    const jump = weatherJumpStamp() !== seenJump;
    seenJump = weatherJumpStamp();
    if (jump) sky.weatherJump();
    const fx = weatherFront.tick({ dt, weather, arrival: enhancedFront ? sky.frontArrival() : 1, nowMinutes: playerTicker.classicMinutes, tsec: now / 1000, jump });
    if (fx.changed) wxFrom = wxNow;
    wxNow = enhancedFront ? blendTerms(wxFrom, weatherTerms(), fx.t) : weatherTerms();
    // A3: the exterior ambience (WeatherAmbientEffects 5/25).
    audio.setListener(eye, [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    // WX2: the ear follows what is falling under the front; the word, verbatim, on classic
    ambience.setPreset(presetForExterior(enhancedFront ? soundWeather(fx, weather) : weather, isNight(minute)));
    ambience.rainGain = enhancedFront ? fx.intensity : 1;
    ambience.update(dt, { playerPos: eye, inside: false });   // AUDIT 58: `!playerEnterExit.IsPlayerInside` (:154-162) - modes.frame consumed the frame already if the player is not outdoors
    animalAmbience.update(dt, eye);   // A4: town animal barks (PlayRandomlyIfPlayerNear)
    // Storm lightning strobe. AUDIT 39 (#14): ENHANCED-SKIN ONLY.
    // Shipped DFU renders no flash at all - PlayEffects starts the
    // coroutine only `if (PlayLightningEffect)` and both
    // AmbientEffectsPlayer instances serialize PlayLightningEffect: 0
    // with LightForEffects unassigned, so the storm is sound-only; and
    // the line this models sets an ABSOLUTE intensity on that separate
    // light, never a multiplier on the sun. The player keeps ticking on
    // both skins - it is the clip schedule the Audio arc reads.
    // ?flashtest pins the strobe on for shots.
    const strobeNow = lightning ? lightning.tick(dt) : 1;   // the player keeps ticking on both skins - the schedule is its own
    // WX2a (AUDIT 57): under the front the FLASH waits for the storm to be
    // HERE. The player was built at the sim's cut, so the strobe lit a
    // sky that was still mostly clear for the whole three-hour lead, and
    // went on after the storm had cleared while the last drops drained.
    // The thunder one-shots already follow the shown mode through the
    // ambience preset; the flash now follows the same word.
    const lightningShown = !enhancedFront || fx.shown === 'storm' ? lightning : null;
    const strobe = lightningShown ? strobeNow : 1;
    const flash = params.has('flashtest') ? 2 : (isEnhanced() ? strobe : 1);
    // EV5: the moons light the night - the masser as a second key, the
    // secunda folded into the ambient. null by day and under classic.
    const moonNow = sky.moonlight();
    renderer.setMoonlight(moonNow);
    renderer.setLighting(
      withMoonAmbient(exteriorAmbient(minute, getFloat('Enhancements', 'NightAmbientLightScale', 0, 1), wxNow.sun), moonNow), sunScale(minute) * wxNow.sun * flash * sky.sunFactor(),   // ES1d: the cloud in front of the sun takes the KEY light (never the ambient - the sky still lights the ground); WX2: the scale is the front's
      new Float32Array(SUN_RIG_COLOR));
    // R12: the player-following indirect point light (SunlightRig) -
    // intensity x the daylight curve, weather-dimmed with the rig,
    // off at night; positioned at the player (the eye here - the
    // 0.8 controller-center offset is <1% of the 150 range).
    {
      const iScale = indirectLightScale(minute) * wxNow.sun;   // WX2: the front's scale
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
    const fogNow = wxNow.fog;   // WX2: the row on the front (the table's own row, classic and settled)
    const fogColor = sky.fogColorFor(fogNow);   // DS1: the mod's own RenderSettings.fogColor while it is the sky; SetSkyFogColor over the horizon otherwise, as before
    renderer.setFog(fogNow.mode,
      fogNow.density, fogNow.start, fogNow.end, fogColor);
    sky.renderer.fogColor = fogColor;
    sky.renderer.fogMix = fogNow.excludeSky ? 0 : 1 - fogFactor(fogNow, 800);

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
    renderer.setClearColor(SKY_CLEAR);   // INCIDENT 2026-09-04 / REVIEW 2026-09-05: this frame is the EXTERIOR's (the mode frames returned above and clear black in worldModes) - CameraClearManager.cs:51-57
    renderer.setFlashLight(sky.lightningLight());   // DS1: Dynamic Skies' LightningFlash, composed first on the point-light channel just stored
    renderer.setWorldViewport(largeHudViewportRect(canvas.clientHeight));   // E5: ViewportChanger.Update, every frame
    renderer.beginFrame(proj, view, sunDirection(minute));
    mwViewDrawBody(canvas, { proj, view, eye, feet: player.pos, yaw: cam.yaw });   // MW-D24
    {
      const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
      const horiz = Math.hypot(dx, dz) || 1e-6;
      sky.draw(Math.atan2(dx, dz), Math.atan2(dy, horiz), fieldOfView(), worldAspect);
      renderer.markForeignPass();   // EV6: the sky changed programs behind the shadows' back
    }
    // EE5: the ground shadows under the SKY'S OWN deck - one field for the
    // cloud and for the shadow it casts. Null when there is no enhanced
    // sky, which is the classic skin and every interior.
    renderer.setCloudShadow(sky?.cloudShadow ?? null);
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
    // host resolved no player arrow at all. Each pool owns its own
    // damage door, so a killed watchman still runs the crime and the
    // corpse.
    // ROAD-G G2: THE ENEMY ARM EXISTS NOW - the note here said "this
    // host mounts no bow-armed pool", which stopped being true with the
    // encounter mount above, and an archer's shaft would have flown
    // through the player for ever. world.js:7025-7077 is the shape.
    arrows.update(dt, {
      // enemy arrows hunt only a WALKING player - the fly camera has no
      // capsule to hit
      playerFeet: walkMode ? player.pos : null,
      onPlayerHit: (m) => {
        const shooter = m.shooterFoe;
        tallySkill(playerEntity, SKILLS.Dodging, 1);
        const dmg = shooter && !shooter.dead ? calculateAttackDamage(shooter.entity, playerEntity, {
          weapon: m.weapon,
          onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(playerTicker.classicMinutes) }),
          say: (l) => townTalk.say(l),
        }) : 0;
        if (dmg > 0) {
          hurtPlayer(playerEntity, dmg);
          audio.playOneShot(hitSoundFor(m.weapon), PLAYER_HIT_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:330-344 - volumeScale 1 on the player
          // AUDIT 24 (wave 46): an arrow reaches the player through
          // BowDamage -> ApplyDamageToPlayer -> SendDamageToPlayer, the
          // same door as a blow, so it owes the flash and the cry too.
          flashPlayerDamage();
          playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
          surfacePlayer();
        }
        addItem(playerEntity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage: the arrow is recoverable from the target
      },
      // AR1: the impact learns the FOES - the shaft an archer looses at
      // another foe (MT-ii's infighting selection) lands on BowDamage's
      // non-player arm. Both pools are candidates; the shooter is
      // excluded inside the flight module.
      foeTargets: exteriorFoePool().filter((t) => !t.dead && t.ai).map((t) => ({ feet: t.ai.feet, ref: t })),
      onFoeHit: (m, t) => exteriorFoes.arrowHitFoe(m, t),
      onPlayerArrowHitFoe: (m, t) => playerArrowHitFoe(m, t, {
        playerEntity, playerWeapon: weaponRig.playerWeapon, playerFeet: player.pos,
        dealDamage: (f, d) => (cityGuards.guards.includes(f)
          ? cityGuards.hurtGuard(f, d, player.pos, m.dir)   // AUDIT-39r: WeaponManager's KnockbackDirection, the missile's forward
          : exteriorFoes.damageFoe(f, d, player.pos, m.dir)),
        audio, hitEffects, say: (l) => townTalk.say(l),
        onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(playerTicker.classicMinutes) }),
        // AUDIT 58: WeaponManager.cs:630's HandleAttackFromSource sits
        // AFTER the damage fork closes (:615), so a shaft that lost the
        // roll still enrages what it hit and wakes the area. ROAD-G G1
        // (review): the WATCH carries the pair now
        // (cityGuards.js:550-555), so this seam ROUTES by pool exactly
        // as `dealDamage` above it does, instead of excluding the
        // guards - a zero-damage shaft into a pacified watchman has to
        // reach the same door the zero-damage SWING already reaches
        // (cityGuards.js:967). DFU makes no pool distinction:
        // AssignBowDamageToTarget's player arm (DaggerfallMissile.cs
        // :660-688) calls WeaponDamage, so :630 runs for the shaft as
        // for the swing.
        onAttackFromPlayer: (f) => (cityGuards.guards.includes(f)
          ? cityGuards.handleAttackFromPlayer(f, player.pos)
          : exteriorFoes.handleAttackFromPlayer(f, player.pos)),
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
        enemiesNearby: () => areEnemiesNearby(exteriorFoePool()),
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
      const _senses = _foeSenses();   // ROAD-G G2: ONE context per frame for BOTH pools
      const guardBatches = cityGuards.update(townTalk.overlayActive ? 0 : dt,
        walkMode ? player.pos : cam.pos, eye, _senses);
      personBatches.push(...guardBatches);
      // ROAD-G G2: the encounter pool drives and draws on the same
      // flats' axis, and freezes with the population under an overlay.
      if (!townTalk.overlayActive) runEncounterTick(walkMode ? player.pos : cam.pos);   // ROAD-G TAIL: the cadence loop rolls the elapsed minutes - in EVERY mode (REVIEW 2026-09-05: indoor minutes are skipped by the loop's own inside arm, not banked)
      exteriorFoes.update(townTalk.overlayActive ? 0 : dt,
        walkMode ? player.pos : cam.pos, eye, _senses);
      personBatches.push(...exteriorFoes.batches());
      droppedLoot.tickFlats(dt);   // FA1 slice 3
      personBatches.push(...droppedLoot.batches());   // U8e: the ground piles
      // AUDIT 24 (wave 39): blood splashes ride the person axis too.
      hitEffects.tick(dt);
      personBatches.push(...hitEffects.batches());
      if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);
    }
    // WX2: what falls is what the front SHOWS (world.js's twin note)
    const precipShown = enhancedFront ? fx.shown : precipMode;
    if (precipShown && precip) {   // W1 review: the gate is the MODE, never the object - the renderer outlives a clear-up
      // EE8: the enhanced profile rides the switch, and the wind that drives
      // its rain is the SKY'S OWN - the deck's wind from the eased weather
      // row - INTEGRATED here as travel, so a change in the wind moves what
      // falls next and never what has already fallen.
      precip.enhanced = !!sky?.cloudShadow;
      if (precip.enhanced) {
        precip.intensity = fx.intensity;   // WX2: the front's share of the profile
        // WX1: THE LAB'S WIND LAW, term for term. The sky's eased row gives
        // a direction and a speed (its wind vector, in the deck's units,
        // times 260 for the lab's slider units); a slow three-sine GUST
        // rides on the speed; the rate handed to the shader is
        // speed * 0.16 (the lab's metres a second) WITHOUT the gust, and
        // the travel integrated on the CPU is speed * gust * 0.16 * dt,
        // exactly as grass-proto.html's frame() does it.
        const w = sky.cloudShadow.wind;
        const tsec = now / 1000;
        const gust = 0.72 + 0.20 * Math.sin(tsec * 0.31) + 0.14 * Math.sin(tsec * 0.83 + 1.7) + 0.10 * Math.sin(tsec * 2.10 + 0.4);
        const mag = Math.hypot(w[0], w[1]);
        const dir = mag > 1e-6 ? [w[0] / mag, w[1] / mag] : [1, 0];
        const slider = labWindSlider(w);   // GR2: one mapping for the rain and the grass
        const dtp = Math.min(0.05, (now - (precip._lastNow ?? now)) / 1000);
        precip.windV[0] = dir[0] * slider * 0.16; precip.windV[1] = dir[1] * slider * 0.16;
        precip.windOff[0] += dir[0] * slider * gust * 0.16 * dtp;
        precip.windOff[1] += dir[1] * slider * gust * 0.16 * dtp;
      }
      precip._lastNow = now;
      precip.draw(precipShown, proj, view, new Float32Array(eye), camRight, now / 1000);
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
        const guardHitSound = (g) => audio.play3d(hitSoundFor(weaponRig.playerWeapon.weapon), g.ai.feet, ENEMY_HIT_VOLUME, { maxDistance: 16 });
        // AUDIT 23 (combat-4): the host-side WEAPON_SKILL tallies are
        // GONE - cityGuards.resolvePlayerHit already runs DFU's tally
        // arm (tallySwingSkills), so every connecting swing was
        // double-counted, keyed by the display-name rot AUDIT 18
        // removed elsewhere.
        if (!cityGuards.resolvePlayerHit(weaponRig.playerWeapon, eye, fwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
          // ROAD-G G2: encounter foes resolve AFTER the watch and
          // BEFORE civilians - world.js:7135's order, and the order
          // matters because a watchman standing over a quest foe must
          // still be the one the swing finds.
          if (exteriorFoes.resolvePlayerHit(weaponRig.playerWeapon, eye, fwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
            tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            surfacePlayer();
          } else
          cityGuards.resolveCivilianHit(weaponRig.playerWeapon, eye, fwd, player.pos, _guardPool(),
            { onMurder: () => _crimeResponse(), onHitSound: guardHitSound }).then((r) => {
            if (r?.carriedHit) tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            if (r) surfacePlayer();
            // ROAD-B: WeaponEnvDamage's static-door arm (:474-477),
            // world.js's twin - THE FOUR HOSTS RULE.
            // AUDIT 23 (C9) - WeaponManager.cs:423-424: the no-enemy
            // swing sound at the hit frame (the rig's entry whoosh is
            // gone); a swing that found neither guard, civilian nor
            // door - a swing the env arm consumed returns true and
            // rings nothing (:1066).
            else if (!modes?.attemptExteriorDoorBash?.(eye, fwd)) audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);
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
        { font: townTalk.font, cursorActive: gamePaused(),
          detected: _detected, playerXZ: [_dFeet[0], _dFeet[2]],
          largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity),
          // AUDIT 39: the enhanced HUD's two hand plaques - see world.js.
          readied: magic?.readied?.() ?? null,
          weapon: weaponRig.playerWeapon.weapon ?? null,
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
